//! The frame snapshot apps read: terrain changes, forts, Hobs, shells,
//! aim aids, HUD and the events since the last snapshot.

use crate::battle::{Battle, Control, Phase};
use crate::castle::Slot;
use crate::content::{FlightKind, Passive, TriggerOn};
use crate::math::cell;
use serde_json::{json, Value};

impl Battle {
    /// Preview dots for the active side's selected aim: the real sim from the
    /// Loophole with real gravity and wind, cut to the preview share.
    pub fn preview(&self) -> Vec<(i32, i32)> {
        if self.phase != Phase::Plan || self.acted {
            return vec![];
        }
        let side = self.side;
        let s = side as usize;
        let sel = &self.sel[s];
        let Some(id) = self.shot_for(sel.hob, &sel.shot) else { return vec![] };
        let Some(ix) = self.shot_index(&id) else { return vec![] };
        let def = &self.content.shots[ix];
        if def.flight.kind == FlightKind::SelfTarget {
            return vec![];
        }
        let h = &self.hobs[sel.hob as usize];
        let mut share = self.rules.preview_pct;
        if sel.shot == "plain" {
            if let Some(Passive::PreviewBonus { pct }) = &h.passive {
                share += share * pct / 100;
            }
        }
        if self.rules.full_preview_first_shot && !self.first_shot_done[s] {
            share = 100;
        }
        let stop_at_apex = def.triggers.iter().any(|t| t.on == TriggerOn::Apex) && def.flight.apex_gravity_pct.is_none();
        let a = self.aim_probe(side, sel.hob, ix, h.angle, h.power);
        let mut units = 0;
        let (path, _, _) = self.probe_path(a, 900, stop_at_apex, &mut units);
        // cut by path length
        let mut total: i64 = 0;
        for w in path.windows(2) {
            total += crate::math::isqrt((((w[1].0 - w[0].0) as i64).pow(2) + ((w[1].1 - w[0].1) as i64).pow(2)) as u64) as i64;
        }
        let limit = total * share as i64 / 100;
        let mut run: i64 = 0;
        let mut out = vec![path[0]];
        for w in path.windows(2) {
            run += crate::math::isqrt((((w[1].0 - w[0].0) as i64).pow(2) + ((w[1].1 - w[0].1) as i64).pow(2)) as u64) as i64;
            if run > limit {
                break;
            }
            out.push(w[1]);
        }
        out
    }

    pub fn snapshot(&mut self) -> Value {
        let content = self.content.clone();
        // terrain chunks
        let cw = self.terrain.chunks_wide();
        let mut chunks = vec![];
        for (i, d) in self.terrain.dirty.clone().iter().enumerate() {
            if *d {
                let cx = i as i32 % cw;
                let cy = i as i32 / cw;
                let (w, h, bytes) = self.terrain.chunk_bytes(cx, cy);
                chunks.push(json!({"cx": cx, "cy": cy, "x": cx * crate::terrain::CHUNK, "y": cy * crate::terrain::CHUNK, "w": w, "h": h, "data": crate::base64::encode(&bytes)}));
            }
        }
        for d in self.terrain.dirty.iter_mut() {
            *d = false;
        }
        let castles: Vec<Value> = self
            .castles
            .iter()
            .map(|cs| {
                let mut blocks = vec![];
                for r in 0..cs.rows {
                    for c in 0..cs.cols {
                        if let Slot::Block(b) = &cs.slots[cs.idx(c, r)] {
                            let m = &content.materials.blocks[b.mat as usize];
                            let (x0, y0, _, _) = cs.slot_box(c, r);
                            blocks.push(json!({"c": c, "r": r, "x": x0, "y": y0, "mat": m.id, "hp": b.hp, "max": b.max, "peephole": b.peephole, "root": b.root, "battered": cs.fatigue && b.hp < b.max}));
                        }
                    }
                }
                let held = self.held_slots(cs.side);
                let rooms: Vec<Value> = cs
                    .nooks
                    .iter()
                    .enumerate()
                    .map(|(i, n)| {
                        let (x0, y0, x1, y1) = cs.room_box(n);
                        let lh = cs.loophole_rect(n);
                        json!({"kind": "nook", "id": i, "c": n.c, "r": n.r, "box": [x0, y0, x1, y1], "intact": cs.room_intact(n, false), "flap": n.flap, "lid": n.lid, "loophole": [lh.0, lh.1, lh.2, lh.3]})
                    })
                    .collect();
                let kb = cs.kettle_box();
                let (kx0, ky0, kx1, ky1) = cs.room_box(&cs.kettle);
                json!({
                    "side": cs.side, "x": cs.x, "base_y": cs.base_y, "cols": cs.cols, "rows": cs.rows, "block": crate::castle::BLOCK,
                    "blocks": blocks, "rooms": rooms,
                    "kettle": {"hp": cs.kettle_hp.max(0), "max": crate::castle::KETTLE_HP, "box": [kb.0, kb.1, kb.2, kb.3], "room": [kx0, ky0, kx1, ky1], "c": cs.kettle.c, "r": cs.kettle.r, "lid": cs.kettle.lid, "intact": cs.room_intact(&cs.kettle, false)},
                    "steam": cs.steam, "steam_turn": cs.steam_turn, "fatigue": cs.fatigue,
                    "shimmer": cs.shimmer(&content, &held).iter().map(|p| json!([p.0, p.1])).collect::<Vec<_>>(),
                    "held": held.iter().map(|p| json!([p.0, p.1])).collect::<Vec<_>>(),
                })
            })
            .collect();
        let hobs: Vec<Value> = self
            .hobs
            .iter()
            .map(|h| {
                let (x, y) = self.hob_feet(h.id);
                json!({
                    "id": h.id, "side": h.side, "def": h.def, "name": h.name, "class": h.class,
                    "hp": h.hp.max(0), "max": h.max, "state": h.state.name(), "nook": h.nook, "x": x, "y": y,
                    "rest": h.rest.max(0), "knack": h.knack, "knack_uses": h.knack_uses, "plain": h.plain,
                    "buried": h.buried, "cover": h.state == crate::hob::HobState::Seated, "dummy": h.dummy,
                    "grudge": h.grudge, "clatter": h.clatter, "can_fire": h.side == self.side && self.can_fire_hob(h.side, h.id),
                    "aim": {"angle": h.angle, "power": h.power},
                })
            })
            .collect();
        let shells: Vec<Value> = self
            .actors
            .iter()
            .map(|a| {
                let rot = crate::math::atan2_t(-(a.vy as i64), a.vx as i64);
                json!([a.id, cell(a.x), cell(a.y), rot, content.shots[a.shot].id])
            })
            .collect();
        let full = self.snap_full || !self.events.is_empty();
        self.snap_full = false;
        if !full {
            let awaiting = match self.phase {
                Phase::Draft => ctl(self.control[self.draft.next as usize]),
                Phase::Plan => ctl(self.control[self.side as usize]),
                _ => "none",
            };
            return json!({"tick": self.tick, "phase": self.phase.name(), "side": self.side, "awaiting": awaiting, "full": false, "terrain": {"chunks": chunks}, "shells": shells, "events": []});
        }
        let props: Vec<Value> = self
            .props
            .iter()
            .map(|p| json!({"id": p.id, "side": p.side, "kind": p.kind, "tag": p.tag, "x": p.x, "y": p.y, "hp": p.hp.max(0), "max": p.max, "shot": p.shot.map(|s| content.shots[s].id.clone())}))
            .collect();
        let ghosts: Vec<Value> = self
            .ghosts
            .iter()
            .enumerate()
            .map(|(i, g)| json!({"index": i, "side": g.side, "hob": g.hob, "shot": g.shot, "angle": g.angle, "power": g.power, "round": g.round, "pin": g.pin.map(|p| json!([p.0, p.1])), "self_hit": g.self_hit, "recalled": g.recalled, "points": g.points.iter().map(|p| json!([p.0, p.1])).collect::<Vec<_>>()}))
            .collect();
        let preview: Vec<Value> = self.preview().iter().map(|p| json!([p.0, p.1])).collect();
        let s = self.side as usize;
        let crew = |side: u8| -> Vec<Value> {
            self.hobs.iter().filter(|h| h.side == side).map(|h| json!({"id": h.id, "hp_pct": h.hp.max(0) * 100 / h.max.max(1), "state": h.state.name(), "class": h.class, "rest": h.rest.max(0)})).collect()
        };
        let hand = |side: usize| -> Vec<Value> {
            self.hands[side]
                .iter()
                .map(|id| {
                    let d = content.shot(id);
                    json!({"id": id, "name": d.map(|x| x.name.clone()), "match": d.and_then(|x| x.match_class.clone()), "weight": d.map(|x| x.weight), "dud": d.map(|x| x.dud), "card": d.map(|x| x.card.clone())})
                })
                .collect()
        };
        let hud = json!({
            "turn": self.turn, "round": self.round, "round_cap": self.rules.round_cap, "side": self.side,
            "wind": self.wind, "forecast": self.forecast(), "front_rounds_left": self.front_rounds_left(),
            "steam": [self.castles[0].steam, self.castles[1].steam],
            "steam_turn_left": crate::battle::STEAM_PER_TURN - self.castles[s].steam_turn,
            "kettle_pct": [self.castles[0].kettle_hp.max(0) * 100 / crate::castle::KETTLE_HP, self.castles[1].kettle_hp.max(0) * 100 / crate::castle::KETTLE_HP],
            "crew": [crew(0), crew(1)],
            "squall_warning": self.squall_warning(), "squall_round": self.squall_round(), "squall": self.rules.squall,
            "hands": [hand(0), hand(1)], "doodads": [self.doodads[0].clone(), self.doodads[1].clone()],
            "selected": {"hob": self.sel[s].hob, "shot": self.sel[s].shot},
            "names": self.names, "control": [ctl(self.control[0]), ctl(self.control[1])],
            "score": [self.stats[0].score, self.stats[1].score],
            "puff_up": [self.puff_up_allowed[0] && !self.puff_up_used[0], self.puff_up_allowed[1] && !self.puff_up_used[1]],
        });
        let draft = if self.phase == Phase::Draft || !self.draft.pool.is_empty() || !self.draft.picks[0].is_empty() {
            json!({"pool": self.draft.pool, "picks": self.draft.picks, "next": self.draft.next, "picks_each": self.draft.picks_each, "wish": self.draft.wish})
        } else {
            Value::Null
        };
        let awaiting = match self.phase {
            Phase::Draft => ctl(self.control[self.draft.next as usize]),
            Phase::Plan => ctl(self.control[s]),
            _ => "none",
        };
        let events = std::mem::take(&mut self.events);
        json!({
            "tick": self.tick, "phase": self.phase.name(), "side": self.side, "awaiting": awaiting, "full": true,
            "level": self.level.id, "mode": self.mode,
            "map": {"w": self.terrain.w, "h": self.terrain.h, "chunk": crate::terrain::CHUNK},
            "terrain": {"chunks": chunks},
            "castles": castles, "hobs": hobs, "shells": shells, "props": props,
            "preview": preview, "ghosts": ghosts,
            "hud": hud, "draft": draft,
            "events": events,
            "result": self.result.as_ref().map(|r| json!({"winner": r.winner, "how": r.how, "round": r.round, "pennants": r.pennants})),
            "last_ai": self.last_ai,
            "hash": crate::hash::hex(self.hash()),
        })
    }
}

fn ctl(c: Control) -> &'static str {
    match c {
        Control::Human => "human",
        Control::Ai(_) => "ai",
    }
}

//! The Rival AI. It builds a knowledge view with only what the player can
//! see, samples aims with real sim probes, runs the best candidates through
//! the real sim on a cloned battle, scores them, then adds human-like aim
//! error that narrows shot by shot. All work is counted in work units (one
//! unit is one actor tick), never in time.

use crate::actor::Hit;
use crate::battle::{Battle, Control, Phase};
use crate::content::{FlightKind, ShotKind, Weight};
use crate::math::*;
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Preset {
    Cozy,
    Fair,
    Stubborn,
}

impl Preset {
    pub fn parse(s: &str) -> Preset {
        match s {
            "cozy" => Preset::Cozy,
            "stubborn" => Preset::Stubborn,
            _ => Preset::Fair,
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Preset::Cozy => "cozy",
            Preset::Fair => "fair",
            Preset::Stubborn => "stubborn",
        }
    }
}

/// Tuning per preset (grade 3 Rival). Angles in tenths of a degree, power in
/// tenths of a power point, percents as whole numbers.
pub struct Tuning {
    pub angle_sigma: i32,
    pub power_sigma: i32,
    pub c_low: i32,
    pub c_high: i32,
    pub angle_floor: i32,
    pub power_floor: i32,
    pub k_same: i32,
    pub k_walk: i32,
    pub wind_skill: i32,
    pub wind_use: i32,
    pub budget: i64,
    pub jitter: i32,
    pub pick_from: usize,
    pub self_care: bool,
}

pub fn tuning(p: Preset) -> Tuning {
    match p {
        Preset::Cozy => Tuning {
            angle_sigma: 50,
            power_sigma: 100,
            c_low: 10,
            c_high: 40,
            angle_floor: 15,
            power_floor: 30,
            k_same: 100,
            k_walk: 60,
            wind_skill: 5,
            wind_use: 50,
            budget: 60_000,
            jitter: 0,
            pick_from: 4,
            self_care: false,
        },
        Preset::Fair => Tuning {
            angle_sigma: 30,
            power_sigma: 60,
            c_low: 30,
            c_high: 110,
            angle_floor: 6,
            power_floor: 12,
            k_same: 80,
            k_walk: 40,
            wind_skill: 3,
            wind_use: 100,
            budget: 120_000,
            jitter: 1,
            pick_from: 2,
            self_care: true,
        },
        Preset::Stubborn => Tuning {
            angle_sigma: 15,
            power_sigma: 30,
            c_low: 35,
            c_high: 95,
            angle_floor: 3,
            power_floor: 6,
            k_same: 60,
            k_walk: 30,
            wind_skill: 2,
            wind_use: 100,
            budget: 180_000,
            jitter: 2,
            pick_from: 1,
            self_care: true,
        },
    }
}

fn grade_pct(g: i32) -> i32 {
    match g {
        1 => 140,
        2 => 120,
        4 => 85,
        5 => 70,
        _ => 100,
    }
}

#[derive(Clone, Debug, Default)]
pub struct AiMemory {
    /// (target key, angle offset tenths, power offset tenths)
    pub offsets: Vec<(i32, i32, i32)>,
    pub own_walked: bool,
    pub target_walked: i32,
    pub last_wind: Option<i32>,
    pub last_pin: Option<(i32, i32)>,
}

#[derive(Clone, Debug)]
struct Cand {
    hob: u8,
    shot: String,
    shot_ix: usize,
    target: i32,
    angle: i32,
    power: i32,
    miss: i32,
    score: i64,
    dial: Option<String>,
}

impl Battle {
    /// What `side` may know: the other side's hand, Doodads and live aims are
    /// wiped. Everything else on the field is public.
    pub fn knowledge(&self, side: u8) -> Battle {
        let mut k = self.clone();
        let o = 1 - side as usize;
        k.hands[o].clear();
        k.doodads[o].clear();
        k.draft.picks[o].clear();
        for h in k.hobs.iter_mut() {
            if h.side as usize == o {
                h.angle = if o == 0 { 450 } else { 1350 };
                h.power = 60;
            }
        }
        k.sel[o].shot = "plain".into();
        k.ai_mem[o] = AiMemory::default();
        k.events.clear();
        k.log.clear();
        k.control = [Control::Human, Control::Human];
        k
    }
}

fn score_result(before: &Battle, after: &Battle, side: u8, t: &Tuning) -> i64 {
    let s = side as usize;
    let o = 1 - s;
    let mut sc: i64 = 0;
    if let Some(r) = &after.result {
        sc += if r.winner == side { 10_000 } else { -10_000 };
    }
    for (hb, ha) in before.hobs.iter().zip(after.hobs.iter()) {
        let lost = (hb.hp - ha.hp.max(0)) as i64;
        if hb.side as usize == o {
            if !hb.dummy {
                sc += lost * 10;
                if hb.alive() && !ha.alive() {
                    sc += 1500;
                }
            } else {
                sc += lost * 2;
            }
        } else if t.self_care {
            sc -= lost * 20;
        }
    }
    let kb = before.castles[o].kettle_hp.max(0) as i64;
    let ka = after.castles[o].kettle_hp.max(0) as i64;
    sc += (kb - ka) * 15;
    let bb = before.castles[o].standing_hp(&before.content);
    let ba = after.castles[o].standing_hp(&after.content);
    sc += (bb - ba).max(0);
    let dropped = after.stats[s].blocks_dropped - before.stats[s].blocks_dropped;
    sc += dropped as i64 * 80;
    if t.self_care {
        let ob = before.castles[s].standing_hp(&before.content);
        let oa = after.castles[s].standing_hp(&after.content);
        sc -= (ob - oa).max(0) * 2;
    }
    sc
}

fn shell_cost(b: &Battle, c: &Cand) -> i64 {
    let def = &b.content.shots[c.shot_ix];
    let late = b.round >= b.rules.round_cap - 2 || b.squall_round() > 0;
    let mut cost: i64 = match def.kind {
        ShotKind::Knack => 150,
        ShotKind::Trick => def.value as i64 * 3,
        _ => 0,
    };
    if late {
        cost /= 10;
    }
    let is_match = def.match_class.as_deref() == Some(b.hobs[c.hob as usize].class.as_str());
    let rest = if is_match && def.kind == ShotKind::Trick {
        0
    } else {
        def.weight.rest()
    };
    cost + rest as i64 * 60
}

/// Targets: enemy Hobs, the kettle, and the weakest block by Lean Lines.
fn targets(k: &Battle, side: u8, units: &mut i64) -> Vec<(i32, i32, i32)> {
    let o = 1 - side;
    let mut t = vec![];
    for h in &k.hobs {
        if h.side == o && h.alive() {
            let (x, y) = k.hob_feet(h.id);
            t.push((h.id as i32, x, y - 10));
        }
    }
    let cs = &k.castles[o as usize];
    let (x0, y0, x1, y1) = cs.kettle_box();
    t.push((100, (x0 + x1) / 2, (y0 + y1) / 2));
    let held = k.held_slots(o);
    let mut best: Option<(usize, i32, i32)> = None;
    for r in 1..cs.rows {
        for c in 0..cs.cols {
            if cs.has_block(c, r) {
                *units += 40;
                let n = cs.lean_lines(&k.content, c, r, &held).len();
                if n >= 2 && best.is_none_or(|b| n > b.0) {
                    best = Some((n, c, r));
                }
            }
        }
    }
    if let Some((_, c, r)) = best {
        let (bx0, by0, bx1, by1) = cs.slot_box(c, r);
        t.push((200 + r * 10 + c, (bx0 + bx1) / 2, (by0 + by1) / 2));
    }
    t
}

/// Find the best angle and power for a probe to land at (tx, ty).
fn solve_aim(
    w: &Battle,
    side: u8,
    hob: u8,
    shot: usize,
    tx: i32,
    ty: i32,
    units: &mut i64,
    budget: i64,
) -> Option<(i32, i32, i32)> {
    let def = &w.content.shots[shot];
    let (lx, ly) = w.launch_point(hob);
    let front = w.castles[side as usize].front_dir();
    if def.flight.kind == FlightKind::Beam {
        let a = atan2_t((ly - ty) as i64, (tx - lx) as i64);
        return Some((a.clamp(0, 1800), 80, 0));
    }
    let angles: &[i32] =
        if def.flight.kind == FlightKind::Roller || def.flight.kind == FlightKind::Dig {
            &[150, 300, 450]
        } else {
            &[250, 400, 550, 700]
        };
    let mut best: Option<(i32, i32, i32)> = None;
    for &a0 in angles {
        let angle = if front > 0 { a0 } else { 1800 - a0 };
        let (mut lo, mut hi) = (5, 100);
        let mut local: Option<(i32, i32)> = None;
        for _ in 0..7 {
            if *units > budget {
                break;
            }
            let p = (lo + hi) / 2;
            let a = w.aim_probe(side, hob, shot, angle, p);
            let (_, end, hit) = w.probe_path(a, 700, false, units);
            let reach = (end.0 - lx) * front;
            let want = (tx - lx) * front;
            let miss = ((end.0 - tx).pow(2) as i64 + (end.1 - ty).pow(2) as i64) as u64;
            let miss = isqrt(miss) as i32;
            if local.is_none_or(|l| miss < l.1) {
                local = Some((p, miss));
            }
            let short = match hit {
                Some(Hit::Block { side: s, .. }) | Some(Hit::Kettle(s)) if s != side => {
                    reach < want - 4
                }
                _ => reach < want,
            };
            if short {
                lo = p + 1;
            } else {
                hi = p - 1;
            }
            if lo > hi {
                break;
            }
        }
        if let Some((p, miss)) = local {
            if best.is_none_or(|b| miss < b.2) {
                best = Some((angle, p, miss));
            }
        }
    }
    best
}

/// Run one candidate through the real sim on a copy of the knowledge view.
fn sim_candidate(
    k: &Battle,
    side: u8,
    c: &Cand,
    angle: i32,
    power: i32,
    units: &mut i64,
) -> Option<Battle> {
    let mut w = k.clone();
    let s = side as usize;
    w.sel[s].hob = c.hob;
    w.sel[s].shot = c.shot.clone();
    w.hobs[c.hob as usize].angle = angle.clamp(0, 1800);
    w.hobs[c.hob as usize].power = power.clamp(0, 100);
    let mut cmd = json!({"cmd": "fire"});
    if let Some(d) = &c.dial {
        cmd["dial"] = json!(d);
    }
    let r = w.command(&cmd);
    if r["ok"] != json!(true) {
        return None;
    }
    let n = w.run_until_plan(3000);
    *units += n as i64 * (1 + w.actors.len() as i64) + 50;
    Some(w)
}

pub fn draft_choice(b: &Battle, side: u8) -> Option<String> {
    let preset = match b.control[side as usize] {
        Control::Ai(p) => p,
        Control::Human => Preset::Fair,
    };
    let deny = match preset {
        Preset::Cozy => 0,
        Preset::Fair => 30,
        Preset::Stubborn => 60,
    };
    let mine: Vec<&String> = b
        .hobs
        .iter()
        .filter(|h| h.side == side)
        .map(|h| &h.class)
        .collect();
    let theirs: Vec<&String> = b
        .hobs
        .iter()
        .filter(|h| h.side != side)
        .map(|h| &h.class)
        .collect();
    // the Rival takes its wish at its first chance
    if let Some(w) = &b.draft.wish {
        if b.control[side as usize] != Control::Human
            && b.draft.pool.contains(w)
            && b.draft.picks[side as usize].is_empty()
        {
            return Some(w.clone());
        }
    }
    let mut best: Option<(i64, String)> = None;
    for id in &b.draft.pool {
        let Some(d) = b.content.shot(id) else {
            continue;
        };
        let val = |classes: &Vec<&String>| -> i64 {
            let mut v = d.value as i64;
            if d.match_class.as_ref().is_some_and(|m| classes.contains(&m)) {
                v += 10;
            }
            if d.dud {
                v -= 50;
            }
            v
        };
        let sc = val(&mine) * 100 + val(&theirs) * deny;
        if best.as_ref().is_none_or(|x| sc > x.0) {
            best = Some((sc, id.clone()));
        }
    }
    best.map(|b| b.1)
}

/// Plan a whole turn for `side`. Returns the commands, same format as a player.
pub fn plan_turn(b: &mut Battle, side: u8, preset: Preset) -> Vec<Value> {
    let t = tuning(preset);
    let s = side as usize;
    let mut out: Vec<Value> = vec![];
    let mut k = b.knowledge(side);
    let mut units: i64 = 0;

    // dig out a buried Hob with Shove Off when that is the only way to fire
    let usable: Vec<u8> = k
        .hobs
        .iter()
        .filter(|h| h.side == side && k.can_fire_hob(side, h.id))
        .map(|h| h.id)
        .collect();
    if usable.is_empty() {
        if let Some(h) = k
            .hobs
            .iter()
            .find(|h| h.side == side && h.alive() && !h.dummy && h.buried)
            .map(|h| h.id)
        {
            let cmd = json!({"cmd": "shove_off", "hob": h});
            if k.command(&cmd)["ok"] == json!(true) {
                out.push(cmd);
            }
        }
    }

    // world used to solve aims: Cozy only half reads the wind
    let mut solve_world = k.clone();
    solve_world.wind = solve_world.wind * t.wind_use / 100;

    let tg = targets(&k, side, &mut units);
    let mut cands: Vec<Cand> = vec![];
    let hobs: Vec<u8> = k
        .hobs
        .iter()
        .filter(|h| h.side == side && k.can_fire_hob(side, h.id))
        .map(|h| h.id)
        .collect();
    for &h in &hobs {
        let hob = &k.hobs[h as usize];
        let mut shots: Vec<String> = vec!["plain".into()];
        if hob.rest == 0 {
            if hob.knack_uses > 0 && hob.knack.is_some() {
                shots.push("knack".into());
            }
            for x in &k.hands[s] {
                if !shots.contains(x) {
                    shots.push(x.clone());
                }
            }
        }
        for sh in shots {
            let Some(id) = k.shot_for(h, &sh) else {
                continue;
            };
            let Some(ix) = k.shot_index(&id) else {
                continue;
            };
            let def = &k.content.shots[ix];
            if def.weight == Weight::H && k.turns_taken[s] == 0 && side == k.first_side {
                continue;
            }
            if def.flight.kind == FlightKind::SelfTarget {
                cands.push(Cand {
                    hob: h,
                    shot: sh.clone(),
                    shot_ix: ix,
                    target: -1,
                    angle: hob.angle,
                    power: hob.power,
                    miss: 0,
                    score: 0,
                    dial: None,
                });
                continue;
            }
            for &(key, tx, ty) in &tg {
                if units > t.budget / 2 {
                    break;
                }
                if let Some((a, p, miss)) =
                    solve_aim(&solve_world, side, h, ix, tx, ty, &mut units, t.budget / 2)
                {
                    cands.push(Cand {
                        hob: h,
                        shot: sh.clone(),
                        shot_ix: ix,
                        target: key,
                        angle: a,
                        power: p,
                        miss,
                        score: 0,
                        dial: None,
                    });
                }
            }
        }
    }
    // most likely first: small miss, cheap shells
    cands.sort_by_key(|c| (c.miss / 16, shell_cost(&k, c), c.hob, c.target));
    let mut scored: Vec<Cand> = vec![];
    for c in cands.into_iter() {
        if units > t.budget && !scored.is_empty() {
            break;
        }
        let Some(after) = sim_candidate(&k, side, &c, c.angle, c.power, &mut units) else {
            continue;
        };
        let mut sc = score_result(&k, &after, side, &t) - shell_cost(&k, &c);
        let mut n = 1;
        for j in 0..t.jitter {
            if units > t.budget {
                break;
            }
            let da = if j % 2 == 0 {
                t.angle_floor
            } else {
                -t.angle_floor
            };
            let dp = if j % 2 == 0 {
                -(t.power_floor / 10).max(1)
            } else {
                (t.power_floor / 10).max(1)
            };
            if let Some(w2) = sim_candidate(&k, side, &c, c.angle + da, c.power + dp, &mut units) {
                sc += score_result(&k, &w2, side, &t) - shell_cost(&k, &c);
                n += 1;
            }
        }
        let mut c2 = c.clone();
        c2.score = sc / n;
        scored.push(c2);
    }
    scored.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then(a.hob.cmp(&b.hob))
            .then(a.target.cmp(&b.target))
    });

    // Doodads: mend when walls are hurt and no shot pays more
    let best_score = scored.first().map(|c| c.score).unwrap_or(-1);
    if let Some(cmd) = doodad_choice(&k, side, best_score, preset) {
        out.push(cmd);
        return out;
    }

    // nothing worth firing: walk toward the rival and try once more
    if best_score <= 0 && k.castles[s].steam >= 20 && k.castles[s].steam_turn == 0 && out.is_empty()
    {
        let dx = 40 * k.castles[s].front_dir();
        let cmd = json!({"cmd": "walk", "dx": dx});
        if k.command(&cmd)["ok"] == json!(true) {
            out.push(cmd);
            b.ai_mem[s].own_walked = true;
            let mut rest = plan_after_walk(b, &k, side, preset);
            out.append(&mut rest);
            return out;
        }
    }

    let Some(choice) = pick(&scored, &t, b, s) else {
        out.push(json!({"cmd": "pass"}));
        return out;
    };
    let (angle, power) = apply_error(b, side, &choice, &t);
    let mut fire = json!({"cmd": "fire"});
    if let Some(d) = &choice.dial {
        fire["dial"] = json!(d);
    }
    out.push(json!({"cmd": "pick_hob", "hob": choice.hob}));
    out.push(json!({"cmd": "pick_shot", "shot": choice.shot}));
    out.push(json!({"cmd": "aim", "angle": angle, "power": power}));
    out.push(fire);
    let _ = units;
    out
}

fn plan_after_walk(b: &mut Battle, k: &Battle, side: u8, preset: Preset) -> Vec<Value> {
    // replan on the walked view; no further walks
    let s = side as usize;
    let mut tmp = k.clone();
    tmp.castles[s].steam = 0;
    tmp.ai_mem[s] = b.ai_mem[s].clone();
    tmp.rng.ai[s] = b.rng.ai[s].clone();
    let mut cmds = plan_turn(&mut tmp, side, preset);
    b.rng.ai[s] = tmp.rng.ai[s].clone();
    b.ai_mem[s] = tmp.ai_mem[s].clone();
    cmds.retain(|c| c["cmd"] != json!("walk"));
    cmds
}

fn pick(scored: &[Cand], t: &Tuning, b: &mut Battle, s: usize) -> Option<Cand> {
    if scored.is_empty() {
        return None;
    }
    // lethal check on every preset
    if scored[0].score >= 5_000 {
        return Some(scored[0].clone());
    }
    let n = scored.len().min(t.pick_from).max(1);
    let i = b.rng.ai[s].range(0, n as i32 - 1) as usize;
    Some(scored[i].clone())
}

fn apply_error(b: &mut Battle, side: u8, c: &Cand, t: &Tuning) -> (i32, i32) {
    let s = side as usize;
    let def = &b.content.shots[c.shot_ix];
    if def.flight.kind == FlightKind::SelfTarget {
        return (c.angle, c.power);
    }
    let g = grade_pct(b.aim_grade[s]);
    let sa = (t.angle_sigma * g / 100) as i64;
    let sp = (t.power_sigma * g / 100) as i64;
    let fa = (t.angle_floor * g / 100) as i64;
    let fp = (t.power_floor * g / 100) as i64;
    let wind = b.wind;
    let mem = b.ai_mem[s].clone();
    let rng = &mut b.rng.ai[s];
    let nrm = |rng: &mut crate::rng::Sfc32, sigma: i64| -> i64 { rng.normal_q16() * sigma / 65536 };
    let (mut ba, mut bp) = match mem.offsets.iter().find(|o| o.0 == c.target) {
        None => {
            let k = if mem.offsets.is_empty() {
                100
            } else {
                t.k_same
            } as i64;
            (nrm(rng, sa * k / 100), nrm(rng, sp * k / 100))
        }
        Some(&(_, oa, op)) => {
            let cpct = rng.range(t.c_low, t.c_high) as i64;
            (
                oa as i64 * (100 - cpct) / 100 + nrm(rng, fa),
                op as i64 * (100 - cpct) / 100 + nrm(rng, fp),
            )
        }
    };
    if mem.own_walked {
        let m = sa * 60 / 100;
        if ba.abs() < m {
            ba = if ba < 0 { -m } else { m };
        }
    }
    if mem.target_walked > 0 {
        bp += sp * t.k_walk as i64 / 100 * (mem.target_walked as i64 / 32).min(4) / 2;
    }
    if let Some(lw) = mem.last_wind {
        ba += (t.wind_skill * (wind - lw).abs() * 10) as i64
            * if (ba >= 0) == (wind >= lw) { 1 } else { -1 }
            / 10;
    }
    ba = ba.clamp(-sa * 5 / 2, sa * 5 / 2);
    bp = bp.clamp(-sp * 5 / 2, sp * 5 / 2);
    let mem = &mut b.ai_mem[s];
    mem.offsets.retain(|o| o.0 != c.target);
    mem.offsets.push((c.target, ba as i32, bp as i32));
    mem.own_walked = false;
    mem.target_walked = 0;
    mem.last_wind = Some(wind);
    let mut angle = (c.angle + ba as i32).clamp(0, 1800);
    let mut power = (c.power + (bp / 10) as i32).clamp(1, 100);
    // no self harm by error: redraw once if the errored shot lands on our own fort
    if t.self_care {
        let a = b.aim_probe(side, c.hob, c.shot_ix, angle, power);
        let mut u = 0;
        let (_, end, _) = b.probe_path(a, 700, false, &mut u);
        let cs = &b.castles[s];
        if end.0 >= cs.x - 16 && end.0 <= cs.x + cs.width_cells() + 16 {
            angle = (c.angle + (ba / 2) as i32).clamp(0, 1800);
            power = (c.power + (bp / 20) as i32).clamp(1, 100);
        }
    }
    (angle, power)
}

fn doodad_choice(k: &Battle, side: u8, best: i64, preset: Preset) -> Option<Value> {
    let s = side as usize;
    if k.phase != Phase::Plan {
        return None;
    }
    for d in &k.doodads[s] {
        let Some(def) = k.content.doodad(d) else {
            continue;
        };
        match &def.effect {
            crate::content::DoodadEffect::MendBlocks { count, hp } => {
                let cs = &k.castles[s];
                let mut deficits: Vec<i32> = cs
                    .slots
                    .iter()
                    .filter_map(|x| match x {
                        crate::castle::Slot::Block(b) => Some((b.max - b.hp).min(*hp)),
                        _ => None,
                    })
                    .collect();
                deficits.sort_by(|a, b| b.cmp(a));
                let gain: i64 = deficits
                    .iter()
                    .take(*count as usize)
                    .map(|x| *x as i64)
                    .sum();
                let worth = if preset == Preset::Cozy {
                    gain * 4
                } else {
                    gain * 6
                };
                if gain >= 60 && worth > best {
                    return Some(json!({"cmd": "doodad", "doodad": d}));
                }
            }
            crate::content::DoodadEffect::Lid => {
                // lid the kettle when the rival's last pin sat next to it
                let o = 1 - s;
                let pin = k
                    .ghosts
                    .iter()
                    .rev()
                    .find(|g| g.side as usize == o)
                    .and_then(|g| g.pin);
                if let Some((px, py)) = pin {
                    let (x0, y0, x1, y1) = k.castles[s].room_box(&k.castles[s].kettle);
                    let near = px >= x0 - 32 && px <= x1 + 32 && py >= y0 - 32 && py <= y1 + 32;
                    if near && best < 300 && k.castles[s].kettle_hp < 200 {
                        return Some(json!({"cmd": "doodad", "doodad": d, "room": "kettle"}));
                    }
                }
            }
        }
    }
    None
}

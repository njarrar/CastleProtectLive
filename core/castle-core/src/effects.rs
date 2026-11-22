//! What shells do: contacts, flight modes after contact, effect parts,
//! the damage model, collapse with crush, falls and Thumps.

use crate::actor::{Actor, FlyOut, Hit, Mode};
use crate::battle::*;
use crate::castle::{Slot, BLOCK};
use crate::content::*;
use crate::hob::HobState;
use crate::math::*;
use serde_json::json;

fn dist_to_box(x: i32, y: i32, b: (i32, i32, i32, i32)) -> i32 {
    let dx = (b.0 - x).max(0).max(x - b.2) as i64;
    let dy = (b.1 - y).max(0).max(y - b.3) as i64;
    isqrt((dx * dx + dy * dy) as u64) as i32
}

/// Damage rounded once: base x falloff (permille) x each percent.
pub fn calc(base: i32, falloff_pm: i64, pcts: &[i32]) -> i32 {
    let mut num: i128 = base as i128 * falloff_pm as i128;
    let mut den: i128 = 1000;
    for p in pcts {
        num *= *p as i128;
        den *= 100;
    }
    if num <= 0 {
        return 0;
    }
    ((num + den / 2) / den) as i32
}

impl Battle {
    fn triggers(&self, shot: usize, on: TriggerOn) -> Vec<Effect> {
        let def = &self.content.shots[shot];
        let dial = self.cur.as_ref().and_then(|c| c.dial.clone());
        let exact: Vec<&Trigger> = def
            .triggers
            .iter()
            .filter(|t| t.on == on && t.dial.is_some() && t.dial == dial)
            .collect();
        if !exact.is_empty() {
            return exact.iter().flat_map(|t| t.effects.clone()).collect();
        }
        def.triggers
            .iter()
            .filter(|t| t.on == on && t.dial.is_none())
            .flat_map(|t| t.effects.clone())
            .collect()
    }

    pub fn resolve_tick(&mut self) {
        let ids: Vec<u32> = self.actors.iter().map(|a| a.id).collect();
        for id in ids {
            let Some(idx) = self.actors.iter().position(|a| a.id == id) else {
                continue;
            };
            let mut a = self.actors[idx].clone();
            if a.done {
                continue;
            }
            self.step_actor(&mut a);
            if self.phase == Phase::Ended {
                return;
            }
            if a.root && a.age % 4 == 0 {
                if let Some(g) = self.ghosts.last_mut() {
                    if g.points.len() < 400 {
                        g.points.push((cell(a.x), cell(a.y)));
                    }
                }
            }
            if let Some(idx) = self.actors.iter().position(|x| x.id == id) {
                self.actors[idx] = a;
            }
        }
        self.actors.retain(|a| !a.done);
        if self.actors.is_empty() && self.phase == Phase::Resolve {
            self.phase = Phase::Settle(SETTLE_TICKS);
        }
    }

    fn step_actor(&mut self, a: &mut Actor) {
        a.age += 1;
        let f = self.content.shots[a.shot].flight.clone();
        if a.age > MAX_ACTOR_AGE {
            a.done = true;
            return;
        }
        if f.life_ticks > 0 && a.age >= f.life_ticks {
            let effs = self.triggers(a.shot, TriggerOn::Expire);
            let (x, y) = (cell(a.x), cell(a.y));
            self.mark_pin(x, y);
            self.run_effects(&effs, a, x, y, None, false);
            a.done = true;
            return;
        }
        match a.mode {
            Mode::Fly => match self.fly_tick(a) {
                FlyOut::Moving => {}
                FlyOut::Apex => {
                    if let Some(g) = f.apex_gravity_pct {
                        a.gravity_pct = g;
                    }
                    let effs = self.triggers(a.shot, TriggerOn::Apex);
                    if !effs.is_empty() {
                        let (x, y) = (cell(a.x), cell(a.y));
                        if self.run_effects(&effs, a, x, y, None, false) {
                            a.done = true;
                        }
                    }
                }
                FlyOut::Contact {
                    hit,
                    cx,
                    cy,
                    px,
                    py,
                } => self.contact(a, hit, cx, cy, px, py),
            },
            Mode::Roll { dir } => self.roll_tick(a, dir),
            Mode::Bore { dx, dy } => self.bore_tick(a, dx, dy),
        }
    }

    fn mark_pin(&mut self, x: i32, y: i32) {
        if let Some(c) = self.cur.as_mut() {
            if c.pin.is_none() {
                c.pin = Some((x, y));
            }
        }
    }

    fn lid_at(&self, side: u8, x: i32, y: i32) -> Option<(usize, Option<usize>)> {
        for cs in self.castles.iter() {
            if cs.side == side {
                continue;
            }
            let grow =
                |b: (i32, i32, i32, i32)| (b.0 - BLOCK, b.1 - BLOCK, b.2 + BLOCK, b.3 + BLOCK);
            if cs.kettle.lid {
                let b = grow(cs.room_box(&cs.kettle));
                if x >= b.0 && x <= b.2 && y >= b.1 && y <= b.3 {
                    return Some((cs.side as usize, None));
                }
            }
            for (i, n) in cs.nooks.iter().enumerate() {
                if n.lid {
                    let b = grow(cs.room_box(n));
                    if x >= b.0 && x <= b.2 && y >= b.1 && y <= b.3 {
                        return Some((cs.side as usize, Some(i)));
                    }
                }
            }
        }
        None
    }

    fn contact(&mut self, a: &mut Actor, hit: Hit, cx: i32, cy: i32, px: i32, py: i32) {
        if hit == Hit::Off {
            a.done = true;
            self.ev(json!({"t": "miss", "x": cx, "y": cy}));
            return;
        }
        let f = self.content.shots[a.shot].flight.clone();
        let mut hit = hit;
        // Pot Lid: the first shell to reach the room bounces off harmless
        if let Some((s, room)) = self.lid_at(a.side, cx, cy) {
            match room {
                None => self.castles[s].kettle.lid = false,
                Some(i) => self.castles[s].nooks[i].lid = false,
            }
            self.mark_pin(cx, cy);
            self.ev(json!({"t": "lid_block", "side": s, "x": cx, "y": cy}));
            a.done = true;
            return;
        }
        // Threads through a Loophole
        let mut threaded = false;
        if a.threads {
            if let Hit::Block { side, c, r } = hit {
                let cs = &self.castles[side as usize];
                let mut found = None;
                for (ni, n) in cs.nooks.iter().enumerate() {
                    let front = cs.room_walls(n)[3];
                    if front.contains(&(c, r)) {
                        let (x0, y0, x1, y1) = cs.loophole_rect(n);
                        if cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 {
                            found = Some((ni, n.flap));
                        }
                    }
                }
                if let Some((ni, flap)) = found {
                    let seated = self
                        .hobs
                        .iter()
                        .find(|h| h.side == side && h.alive() && h.nook == Some(ni as u8))
                        .map(|h| h.id);
                    if let (false, Some(hid)) = (flap, seated) {
                        self.castles[side as usize].nooks[ni].flap = true;
                        hit = Hit::Hob(hid);
                        threaded = true;
                        self.ev(json!({"t": "threaded", "side": side, "nook": ni, "hob": hid}));
                    }
                }
            }
        }
        self.mark_pin(cx, cy);
        match f.kind {
            FlightKind::Beam => {
                if let Hit::Block { side, c, r } = hit {
                    if a.passes > 0 {
                        a.passes -= 1;
                        a.passed_block = true;
                        a.skip = Some((side, c, r));
                        self.damage_block_direct(a.side, side, c, r, f.pass_dmg, DType::Pierce);
                        self.after_damage();
                        return;
                    }
                }
            }
            FlightKind::Bounce => {
                let hard = matches!(hit, Hit::Hob(_) | Hit::Kettle(_) | Hit::Water);
                if !hard && a.bounces < f.bounces {
                    let effs = self.triggers(a.shot, TriggerOn::Bounce);
                    a.bounces += 1;
                    self.run_effects(&effs, a, px, py, None, false);
                    let vert = self.collide(a.side, px, cy, None, false).is_some();
                    let horiz = self.collide(a.side, cx, py, None, false).is_some();
                    let (mut vx, mut vy) = (a.vx, a.vy);
                    if vert || !horiz {
                        vy = -vy;
                    }
                    if horiz || !vert {
                        vx = -vx;
                    }
                    a.vx = pct(vx, f.keep_pct);
                    a.vy = pct(vy, f.keep_pct);
                    a.x = fx(px) + FX_ONE / 2;
                    a.y = fx(py) + FX_ONE / 2;
                    return;
                }
            }
            FlightKind::Roller => {
                if hit == Hit::Terrain && cy >= py {
                    let dir = if a.vx > 0 {
                        1
                    } else if a.vx < 0 {
                        -1
                    } else {
                        self.castles[a.side as usize].front_dir()
                    };
                    a.mode = Mode::Roll { dir };
                    a.roll_speed = a.vx.abs().max(FX_ONE);
                    a.x = fx(px) + FX_ONE / 2;
                    a.y = fx(py) + FX_ONE / 2;
                    return;
                }
                let effs = self.triggers(a.shot, TriggerOn::Stop);
                self.run_effects(&effs, a, px, py, Some(hit), false);
                a.done = true;
                return;
            }
            FlightKind::Dig => {
                if matches!(hit, Hit::Terrain | Hit::Block { .. }) {
                    let l = len_fx(a.vx, a.vy).max(1);
                    let dx = (a.vx as i64 * FX_ONE as i64 / l as i64) as i32;
                    let dy = (a.vy as i64 * FX_ONE as i64 / l as i64) as i32;
                    a.mode = Mode::Bore { dx, dy };
                    a.x = fx(px) + FX_ONE / 2;
                    a.y = fx(py) + FX_ONE / 2;
                    return;
                }
                if let Hit::Hob(h) = hit {
                    if f.block_dmg > 0 {
                        self.damage_hob_direct(a.side, h, f.block_dmg, DType::Dig);
                    }
                }
                let effs = self.triggers(a.shot, TriggerOn::Stop);
                self.run_effects(&effs, a, px, py, Some(hit), false);
                a.done = true;
                return;
            }
            _ => {}
        }
        if let Some(c) = self.cur.as_mut() {
            c.threaded_now = threaded;
        }
        let effs = self.triggers(a.shot, TriggerOn::Impact);
        let (ix, iy) = if matches!(hit, Hit::Terrain | Hit::Water) {
            (px, py)
        } else {
            (cx, cy)
        };
        self.run_effects(&effs, a, ix, iy, Some(hit), false);
        if let Some(c) = self.cur.as_mut() {
            c.threaded_now = false;
        }
        a.done = true;
    }

    fn roll_tick(&mut self, a: &mut Actor, dir: i32) {
        let f = self.content.shots[a.shot].flight.clone();
        let n = (a.roll_speed >> FX_SHIFT).max(1);
        let mut descended = 0;
        let mut climbed = 0;
        for _ in 0..n {
            let (x, y) = (cell(a.x), cell(a.y));
            let nx = x + dir;
            let mut ny = y;
            match self.collide(a.side, nx, y, None, true) {
                None => {}
                Some(Hit::Terrain) => {
                    if self.collide(a.side, nx, y - 1, None, true).is_none()
                        && (f.motor || a.roll_speed > FX_ONE / 2)
                    {
                        ny = y - 1;
                        climbed += 1;
                    } else {
                        return self.roll_stop(a, x, y, Some(Hit::Terrain));
                    }
                }
                Some(Hit::Off) => {
                    a.done = true;
                    return;
                }
                Some(Hit::Prop(pi)) => {
                    if self.props[pi].stops_rollers {
                        self.props[pi].hp = 0;
                        let (pxx, pyy) = (self.props[pi].x, self.props[pi].y);
                        self.ev(json!({"t": "prop_break", "x": pxx, "y": pyy}));
                    }
                    return self.roll_stop(a, x, y, Some(Hit::Prop(pi)));
                }
                Some(other) => return self.roll_stop(a, x, y, Some(other)),
            }
            // fall onto the ground below
            let mut drop = 0;
            while drop < 4 && self.collide(a.side, nx, ny + 1, None, true).is_none() {
                ny += 1;
                drop += 1;
            }
            if drop == 4 && self.collide(a.side, nx, ny + 1, None, true).is_none() {
                a.x = fx(nx) + FX_ONE / 2;
                a.y = fx(ny) + FX_ONE / 2;
                a.mode = Mode::Fly;
                a.vx = dir * a.roll_speed;
                a.vy = 0;
                return;
            }
            descended += drop;
            a.x = fx(nx) + FX_ONE / 2;
            a.y = fx(ny) + FX_ONE / 2;
        }
        a.rolled += 1;
        let g = crate::actor::gravity_q();
        if f.motor {
            a.roll_speed = a.roll_speed.max(fx(2));
        } else {
            a.roll_speed += g * descended / 2;
            a.roll_speed -= g * climbed;
            a.roll_speed -= a.roll_speed / 64 + FX_ONE / 32;
        }
        let limit = if f.roll_ticks > 0 { f.roll_ticks } else { 240 };
        if a.rolled >= limit || a.roll_speed <= 0 {
            let (x, y) = (cell(a.x), cell(a.y));
            self.roll_stop(a, x, y, None);
        }
    }

    fn roll_stop(&mut self, a: &mut Actor, x: i32, y: i32, hit: Option<Hit>) {
        let effs = self.triggers(a.shot, TriggerOn::Stop);
        self.mark_pin(x, y);
        // Roller hop: burst one block up so it meets the first Body row
        let yy = if matches!(hit, Some(Hit::Block { .. })) {
            y - 4
        } else {
            y
        };
        self.run_effects(&effs, a, x, yy, hit, false);
        a.done = true;
    }

    fn bore_tick(&mut self, a: &mut Actor, dx: Fx, dy: Fx) {
        let f = self.content.shots[a.shot].flight.clone();
        for _ in 0..3 {
            a.x += dx;
            a.y += dy;
            let (x, y) = (cell(a.x), cell(a.y));
            if x < 0 || x >= self.terrain.w || y >= self.terrain.h {
                return self.bore_stop(
                    a,
                    x.clamp(0, self.terrain.w - 1),
                    y.min(self.terrain.h - 1),
                    None,
                    true,
                );
            }
            match self.collide(a.side, x, y, a.skip, false) {
                Some(Hit::Block { side, c, r }) => {
                    let mat = self.castles[side as usize]
                        .block(c, r)
                        .map(|b| b.mat as usize)
                        .unwrap_or(0);
                    if self.content.materials.blocks[mat].never_falls {
                        return self.bore_stop(a, x, y, Some(Hit::Block { side, c, r }), true);
                    }
                    a.skip = Some((side, c, r));
                    a.blocks_bored += 1;
                    if let Some(b) = self.castles[side as usize].block_mut(c, r) {
                        b.peephole = true;
                    }
                    self.damage_block_direct(a.side, side, c, r, f.block_dmg, DType::Dig);
                    self.after_damage();
                    if a.blocks_bored >= f.max_blocks.max(1) {
                        return self.bore_stop(a, x, y, None, false);
                    }
                }
                Some(Hit::Hob(h)) => {
                    if f.block_dmg > 0 {
                        self.damage_hob_direct(a.side, h, f.block_dmg, DType::Dig);
                        self.after_damage();
                    }
                    return self.bore_stop(a, x, y, Some(Hit::Hob(h)), false);
                }
                Some(Hit::Terrain) | Some(Hit::Water) => {
                    let v = self.terrain.get(x, y);
                    let bp = if v == 255 {
                        0
                    } else {
                        self.terrain.mats.bore_pct[v as usize]
                    };
                    if bp <= 0 {
                        return self.bore_stop(a, x, y, None, true);
                    }
                    let r = (f.tunnel / 2).max(1);
                    self.terrain.clear_rect(x - r, y - r, x + r, y + r);
                    a.in_ground = true;
                    a.bored += 10000 / bp;
                    if a.bored >= f.max_cells * 100 {
                        return self.bore_stop(a, x, y, None, false);
                    }
                }
                Some(Hit::Kettle(s)) => {
                    return self.bore_stop(a, x, y, Some(Hit::Kettle(s)), false)
                }
                Some(Hit::Prop(p)) => return self.bore_stop(a, x, y, Some(Hit::Prop(p)), false),
                Some(Hit::Off) => {
                    a.done = true;
                    return;
                }
                None => {
                    if a.in_ground && (f.stop_on_air || a.skip.is_none()) {
                        return self.bore_stop(a, x, y, None, false);
                    }
                }
            }
            if a.age > 600 {
                return self.bore_stop(a, x, y, None, false);
            }
        }
    }

    fn bore_stop(&mut self, a: &mut Actor, x: i32, y: i32, hit: Option<Hit>, half: bool) {
        self.mark_pin(x, y);
        self.update_buried();
        let effs = self.triggers(a.shot, TriggerOn::Stop);
        self.run_effects(&effs, a, x, y, hit, half);
        a.done = true;
    }

    /// Run effect parts at a point. Returns true if the parent shell ends.
    pub fn run_effects(
        &mut self,
        effs: &[Effect],
        a: &Actor,
        x: i32,
        y: i32,
        direct: Option<Hit>,
        half: bool,
    ) -> bool {
        if a.probe {
            return true;
        }
        if self.cur.is_none() {
            self.begin_ctx(a.side, None, None, false);
        }
        let mut parent_done = false;
        let content = self.content.clone();
        for e in effs {
            if self.phase == Phase::Ended {
                break;
            }
            match e {
                Effect::Explode {
                    dmg,
                    dtype,
                    band,
                    carve_pct,
                    mat_bonus,
                    low_row_pct,
                    per_bounce,
                    threads: _,
                } => {
                    let mut d = dmg + per_bounce * a.bounces.max(0);
                    if half {
                        d /= 2;
                    }
                    let mut band = *band;
                    if self.cur.as_ref().is_some_and(|c| c.band_up) {
                        band = band.bigger();
                    }
                    let r = band.radius();
                    let bonus: Vec<(usize, i32)> = mat_bonus
                        .iter()
                        .filter_map(|(k, v)| content.block_mat(k).map(|m| (m, *v)))
                        .collect();
                    let heavy = content.shots[a.shot].weight == Weight::H
                        || self.cur.as_ref().is_some_and(|c| c.heavy);
                    self.ev(
                        json!({"t": "explode", "x": x, "y": y, "r": r, "dmg": d, "type": dtype}),
                    );
                    self.blast(a, x, y, r, d, *dtype, &bonus, *low_row_pct, direct);
                    let cr = r * carve_pct / 100;
                    if cr > 0 {
                        let n = self.terrain.carve(x, y, cr, heavy);
                        if n > 0 {
                            self.settle_ground(x - cr - 2, x + cr + 2);
                            self.ev(json!({"t": "carve", "x": x, "y": y, "r": cr}));
                        }
                    }
                    self.after_damage();
                }
                Effect::Split {
                    child,
                    count,
                    spread,
                    speed_step,
                    centered,
                    speed_abs,
                    replace,
                } => {
                    let Some(ci) = self.shot_index(child) else {
                        continue;
                    };
                    let (bvx, bvy) = if *speed_abs > 0 {
                        let l = len_fx(a.vx, a.vy);
                        let v = (*speed_abs as i64 * FX_ONE as i64 / 120) as i32;
                        if l == 0 {
                            (0, -v)
                        } else {
                            (
                                (a.vx as i64 * v as i64 / l as i64) as i32,
                                (a.vy as i64 * v as i64 / l as i64) as i32,
                            )
                        }
                    } else {
                        (a.vx, a.vy)
                    };
                    for k in 0..*count {
                        if self.actors.len() >= MAX_ACTORS {
                            break;
                        }
                        let off2 = if *centered {
                            2 * k - (count - 1)
                        } else {
                            2 * k
                        };
                        let ang = spread * off2 / 2;
                        let sp = 1000 + speed_step * off2 / 2;
                        let (rx, ry) = rotate(bvx, bvy, -ang);
                        let vx = (rx as i64 * sp as i64 / 1000) as i32;
                        let vy = (ry as i64 * sp as i64 / 1000) as i32;
                        let mut ch = self.make_actor(
                            a.side,
                            ci,
                            fx(x) + FX_ONE / 2,
                            fx(y) + FX_ONE / 2,
                            vx,
                            vy,
                        );
                        ch.apex_done = a.apex_done || vy >= 0;
                        ch.root = a.root && k == 0 && *replace;
                        self.actors.push(ch);
                    }
                    self.ev(json!({"t": "split", "x": x, "y": y, "count": count, "child": child}));
                    if *replace {
                        parent_done = true;
                        if let Some(p) = self.actors.iter_mut().find(|p| p.id == a.id) {
                            p.done = true;
                        }
                    }
                }
                Effect::Column {
                    dmg,
                    dtype,
                    above_dmg,
                    above_n,
                } => {
                    if let Some(Hit::Block { side, c, r }) = direct {
                        self.damage_block_direct(a.side, side, c, r, *dmg, *dtype);
                        for k in 1..=*above_n {
                            if self.castles[side as usize].has_block(c, r + k) {
                                self.damage_block_direct(
                                    a.side,
                                    side,
                                    c,
                                    r + k,
                                    *above_dmg,
                                    *dtype,
                                );
                            }
                        }
                        // a Hob in the column takes it as an outside blast
                        let hit_hobs: Vec<u8> = self
                            .hobs
                            .iter()
                            .filter(|h| h.side == side && h.alive())
                            .filter(|h| {
                                h.nook.is_some_and(|n| {
                                    let room = &self.castles[side as usize].nooks[n as usize];
                                    (room.c == c || room.c + 1 == c)
                                        && room.r > r
                                        && room.r <= r + above_n
                                })
                            })
                            .map(|h| h.id)
                            .collect();
                        for h in hit_hobs {
                            let cover = if self.hobs[h as usize].state == HobState::Seated {
                                50
                            } else {
                                100
                            };
                            self.damage_hob(a.side, h, *above_dmg, *dtype, 1000, &[cover], false);
                        }
                        self.ev(json!({"t": "column", "side": side, "c": c, "r": r}));
                        self.after_damage();
                    } else {
                        let r = Band::Tiny.radius();
                        self.blast(a, x, y, r, *above_dmg, *dtype, &[], 100, direct);
                        self.after_damage();
                    }
                }
                Effect::Mound { radius } => {
                    let loam = content.terrain_code("loam");
                    self.terrain.stamp(x, y, *radius, loam);
                    self.settle_ground(x - radius - 2, x + radius + 2);
                    self.update_buried();
                    self.ev(json!({"t": "mound", "x": x, "y": y, "r": radius}));
                }
                Effect::BecomeProp { shot } => {
                    let Some(si) = self.shot_index(shot) else {
                        continue;
                    };
                    let mut yy = y;
                    while yy < self.terrain.h - 1 && !self.solid_any(x, yy + 1) {
                        yy += 1;
                    }
                    let pf = &content.shots[si].flight;
                    let id = self.next_id;
                    self.next_id += 1;
                    self.props.push(Prop {
                        id,
                        side: a.side,
                        shot: Some(si),
                        x,
                        y: yy,
                        hp: pf.prop_hp.max(1),
                        max: pf.prop_hp.max(1),
                        kind: "shell".into(),
                        tag: shot.clone(),
                        stops_rollers: pf.stops_rollers,
                    });
                    // a side keeps at most 3 props; a fourth pops the oldest
                    let mine: Vec<usize> = self
                        .props
                        .iter()
                        .enumerate()
                        .filter(|(_, p)| p.side == a.side)
                        .map(|(i, _)| i)
                        .collect();
                    if mine.len() > 3 {
                        self.props.remove(mine[0]);
                    }
                    self.ev(json!({"t": "prop", "x": x, "y": yy, "shot": shot}));
                }
                Effect::Mend { hp, restore_pct } => {
                    let s = a.side as usize;
                    let Some((c, r)) = self.self_target else {
                        continue;
                    };
                    if !self.castles[s].in_grid(c, r) {
                        continue;
                    }
                    let i = self.castles[s].idx(c, r);
                    if let Some(b) = self.castles[s].block_mut(c, r) {
                        b.hp = (b.hp + hp).min(b.max);
                        b.peephole = false;
                        self.ev(json!({"t": "mend", "side": s, "blocks": [[c, r]]}));
                    } else if let (Slot::Empty, Slot::Block(ob)) =
                        (&self.castles[s].slots[i], &self.castles[s].original[i])
                    {
                        let mut nb = ob.clone();
                        nb.hp = (nb.max * restore_pct / 100).max(1);
                        let mut test = self.castles[s].clone();
                        test.slots[i] = Slot::Block(nb.clone());
                        let held = self.held_slots(a.side);
                        if test.solve(&content, &held)[i].is_some() {
                            self.castles[s].slots[i] = Slot::Block(nb);
                            self.ev(json!({"t": "mend", "side": s, "blocks": [[c, r]], "restored": true}));
                        }
                    }
                    // mending the Nook wall also digs out its Loophole
                    let nook_hob = self
                        .hobs
                        .iter()
                        .find(|h| h.side == a.side && h.buried)
                        .map(|h| h.id);
                    if let Some(h) = nook_hob {
                        let near = self.hobs[h as usize].nook.is_some_and(|n| {
                            let room = &self.castles[s].nooks[n as usize];
                            self.castles[s]
                                .room_walls(room)
                                .iter()
                                .flatten()
                                .any(|p| *p == (c, r))
                        });
                        if near {
                            self.clear_loophole(h);
                        }
                    }
                    self.refresh_hob_states();
                }
                Effect::Rebuild { count, hp_pct } => {
                    let s = a.side as usize;
                    let mut done = vec![];
                    let held = self.held_slots(a.side);
                    let rows = self.castles[s].rows;
                    let cols = self.castles[s].cols;
                    'outer: for r in 0..rows {
                        for c in 0..cols {
                            if done.len() as i32 >= *count {
                                break 'outer;
                            }
                            let cs = &self.castles[s];
                            let i = cs.idx(c, r);
                            if let (Slot::Empty, Slot::Block(ob)) = (&cs.slots[i], &cs.original[i])
                            {
                                let mut nb = ob.clone();
                                nb.hp = (nb.max * hp_pct / 100).max(1);
                                nb.peephole = false;
                                let mut test = cs.clone();
                                test.slots[i] = Slot::Block(nb.clone());
                                if test.solve(&content, &held)[i].is_some() {
                                    self.castles[s].slots[i] = Slot::Block(nb);
                                    done.push(json!([c, r]));
                                }
                            }
                        }
                    }
                    self.ev(json!({"t": "rebuild", "side": s, "blocks": done}));
                    self.refresh_hob_states();
                }
                Effect::PuffUp { hp } => {
                    let s = a.side as usize;
                    if !self.puff_up_allowed[s] || self.puff_up_used[s] {
                        continue;
                    }
                    let Some(h) = self
                        .hobs
                        .iter()
                        .find(|h| h.side == a.side && !h.alive() && !h.dummy)
                        .map(|h| h.id)
                    else {
                        continue;
                    };
                    let Some(n) = self.lowest_free_nook(a.side) else {
                        continue;
                    };
                    let hm = &mut self.hobs[h as usize];
                    hm.hp = *hp;
                    hm.state = HobState::Open;
                    hm.nook = Some(n);
                    hm.rest = 2;
                    self.puff_up_used[s] = true;
                    self.refresh_hob_states();
                    self.ev(json!({"t": "puff_up", "hob": h, "nook": n}));
                }
            }
        }
        parent_done
    }

    pub fn solid_any(&self, x: i32, y: i32) -> bool {
        if self.terrain.blocks_shell(x, y) {
            return true;
        }
        self.castles
            .iter()
            .any(|cs| cs.slot_at(x, y).is_some_and(|(c, r)| cs.has_block(c, r)))
    }

    fn settle_ground(&mut self, x0: i32, x1: i32) {
        let castles = self.castles.clone();
        let blocked = |x: i32, y: i32| {
            castles
                .iter()
                .any(|cs| cs.slot_at(x, y).is_some_and(|(c, r)| cs.has_block(c, r)))
        };
        self.terrain.settle(x0, x1, blocked);
        self.settle_castles();
        self.update_buried();
    }

    /// A castle whose ground was carved away drops until a Stomper touches.
    fn settle_castles(&mut self) {
        for s in 0..2 {
            let cs = &self.castles[s];
            let w = cs.width_cells();
            let base = cs.base_y;
            let rests = (cs.x..cs.x + w).any(|x| self.terrain.solid(x, base));
            if rests {
                continue;
            }
            let ny = (cs.x..cs.x + w)
                .map(|x| self.terrain.surface_below(x, base))
                .min()
                .unwrap_or(self.terrain.h)
                .min(self.terrain.h);
            let drop = ny - base;
            if drop <= 0 {
                continue;
            }
            self.castles[s].base_y = ny;
            self.ev(json!({"t": "castle_drop", "side": s, "cells": drop}));
            if drop > 48 {
                self.ev(json!({"t": "thump", "side": s}));
                let cs = &mut self.castles[s];
                let mut broke = vec![];
                for r in 0..cs.rows {
                    for c in 0..cs.cols {
                        if let Some(b) = cs.block_mut(c, r) {
                            b.hp -= 10;
                            if b.hp <= 0 {
                                broke.push((c, r));
                            }
                        }
                    }
                }
                for (c, r) in broke {
                    let i = cs.idx(c, r);
                    cs.slots[i] = Slot::Empty;
                }
                let ids: Vec<u8> = self
                    .hobs
                    .iter()
                    .filter(|h| h.side as usize == s && h.alive())
                    .map(|h| h.id)
                    .collect();
                for h in ids {
                    self.hurt_hob_raw(h, 10, "thump");
                }
            }
        }
    }

    /// Damage that is not shot damage (crush, falls, Thump): no clamps.
    fn hurt_hob_raw(&mut self, h: u8, dmg: i32, why: &str) {
        if dmg <= 0 || !self.hobs[h as usize].alive() {
            return;
        }
        self.hobs[h as usize].hp -= dmg;
        self.ev(json!({"t": "hit", "target": "hob", "hob": h, "dmg": dmg, "why": why}));
        if self.hobs[h as usize].hp <= 0 {
            self.bonk(h);
        }
    }

    fn bonk(&mut self, h: u8) {
        if !self.hobs[h as usize].alive() {
            return;
        }
        let neighbours = self.next_door(h);
        let victim_side = self.hobs[h as usize].side;
        {
            let hm = &mut self.hobs[h as usize];
            hm.hp = 0;
            hm.state = HobState::Bonked;
            hm.rest = 0;
        }
        self.ev(json!({"t": "bonk", "hob": h, "side": victim_side}));
        self.stats[victim_side as usize].own_bonked += 1;
        for n in neighbours {
            if self.hobs[n as usize].has_passive(|p| matches!(p, Passive::OldGrudge))
                && !self.hobs[n as usize].grudge
            {
                self.hobs[n as usize].grudge = true;
                self.ev(json!({"t": "grudge", "hob": n}));
            }
        }
        if let Some(c) = self.cur.clone() {
            if c.side != victim_side {
                let s = c.side as usize;
                self.stats[s].score += 150;
                if let Some(sh) = c.hob {
                    let d = self.hobs[sh as usize].def.clone();
                    if !self.stats[s].bonked_by_hob.contains(&d) {
                        self.stats[s].bonked_by_hob.push(d);
                    }
                }
                match c.kind {
                    Some(ShotKind::Knack) => self.stats[s].bonk_with_knack = true,
                    Some(ShotKind::Trick) => self.stats[s].bonk_with_trick = true,
                    _ => {}
                }
                if let Some(cm) = self.cur.as_mut() {
                    cm.bonks.push(h);
                }
            }
        }
        // a Bonked Hetty lets go of her column
        self.refresh_hob_states();
    }

    fn pcts_common(&self, shooter: u8, target_side: u8) -> Vec<i32> {
        let mut v = vec![];
        if let Some(c) = &self.cur {
            if c.bonus_pct != 100 {
                v.push(c.bonus_pct);
            }
        }
        if shooter == target_side {
            v.push(50);
        }
        v
    }

    pub fn damage_block_direct(
        &mut self,
        shooter: u8,
        side: u8,
        c: i32,
        r: i32,
        dmg: i32,
        dtype: DType,
    ) {
        let Some(b) = self.castles[side as usize].block(c, r) else {
            return;
        };
        let m = self.content.materials.blocks[b.mat as usize]
            .mult
            .get(dtype);
        let mut p = self.pcts_common(shooter, side);
        p.push(m);
        let d = calc(dmg, 1000, &p);
        self.apply_block(shooter, side, c, r, d);
    }

    fn apply_block(&mut self, shooter: u8, side: u8, c: i32, r: i32, d: i32) {
        if d <= 0 {
            return;
        }
        let round = self.round;
        let mut broke = false;
        let mut root = false;
        if let Some(b) = self.castles[side as usize].block_mut(c, r) {
            b.hp -= d;
            broke = b.hp <= 0;
            root = b.root;
        }
        self.ev(json!({"t": "hit", "target": "block", "side": side, "c": c, "r": r, "dmg": d}));
        if broke {
            let cs = &mut self.castles[side as usize];
            let i = cs.idx(c, r);
            cs.slots[i] = Slot::Empty;
            self.ev(json!({"t": "break", "side": side, "c": c, "r": r}));
            if root && self.root_round == 0 {
                self.root_round = round;
            }
        }
        if let Some(cx) = self.cur.as_mut() {
            if shooter != side {
                cx.hit_enemy = true;
            } else {
                cx.self_hit = true;
            }
        }
        if shooter != side {
            self.stats[shooter as usize].score += d as i64;
        }
    }

    pub fn damage_hob_direct(&mut self, shooter: u8, h: u8, dmg: i32, dtype: DType) {
        self.damage_hob(shooter, h, dmg, dtype, 1000, &[], true);
    }

    /// Shot damage to a Hob with both clamps.
    fn damage_hob(
        &mut self,
        shooter: u8,
        h: u8,
        dmg: i32,
        dtype: DType,
        falloff: i64,
        extra: &[i32],
        direct: bool,
    ) {
        if !self.hobs[h as usize].alive() {
            return;
        }
        let side = self.hobs[h as usize].side;
        let m = self.content.materials.hob.get(dtype);
        let mut p = self.pcts_common(shooter, side);
        p.push(m);
        p.extend_from_slice(extra);
        let threaded = direct && self.cur.as_ref().is_some_and(|c| c.threaded_now);
        if threaded {
            if let Some(c) = &self.cur {
                if c.thread_bonus != 100 {
                    p.push(c.thread_bonus);
                }
            }
        }
        let mut d = calc(dmg, falloff, &p);
        let hob = &self.hobs[h as usize];
        if let Some(c) = &self.cur {
            if c.hob_start_full.get(h as usize).copied().unwrap_or(false) {
                let allowed = (hob.max - 1 - c.hob_dealt[h as usize]).max(0);
                d = d.min(allowed);
            }
        }
        if shooter == side {
            d = d.min(hob.hp - 1).max(0);
        }
        if d <= 0 {
            return;
        }
        self.hobs[h as usize].hp -= d;
        if let Some(c) = self.cur.as_mut() {
            if let Some(x) = c.hob_dealt.get_mut(h as usize) {
                *x += d;
            }
            if shooter != side {
                c.hit_enemy = true;
                c.hit_enemy_hob = true;
            } else {
                c.self_hit = true;
            }
        }
        self.ev(json!({"t": "hit", "target": "hob", "hob": h, "side": side, "dmg": d, "type": dtype, "threaded": threaded}));
        if shooter != side {
            self.stats[shooter as usize].score += d as i64 * if threaded { 3 } else { 2 } / 2;
            // Clatter Call: buff the shooter's next door Hobs once per shot
            if let Some(sh) = self.cur.as_ref().and_then(|c| c.hob) {
                if self.hobs[sh as usize].has_passive(|p| matches!(p, Passive::ClatterCall { .. }))
                {
                    for n in self.next_door(sh) {
                        if !self.hobs[n as usize].clatter {
                            self.hobs[n as usize].clatter = true;
                            self.ev(json!({"t": "clatter", "hob": n}));
                        }
                    }
                }
            }
        }
        if self.hobs[h as usize].hp <= 0 {
            self.bonk(h);
        }
    }

    fn damage_kettle(
        &mut self,
        shooter: u8,
        side: u8,
        dmg: i32,
        dtype: DType,
        falloff: i64,
        extra: &[i32],
    ) {
        if shooter == side || self.castles[side as usize].kettle_hp <= 0 {
            return;
        }
        let m = self.content.materials.kettle.get(dtype);
        let mut p = self.pcts_common(shooter, side);
        p.push(m);
        p.extend_from_slice(extra);
        let mut d = calc(dmg, falloff, &p);
        if let Some(c) = &self.cur {
            d = d.min((KETTLE_CAP - c.kettle_dealt[side as usize]).max(0));
        }
        self.apply_kettle(shooter, side, d, "shot");
    }

    fn apply_kettle(&mut self, shooter: u8, side: u8, d: i32, why: &str) {
        if d <= 0 {
            return;
        }
        self.castles[side as usize].kettle_hp -= d;
        if let Some(c) = self.cur.as_mut() {
            c.kettle_dealt[side as usize] += d;
            if shooter != side {
                c.hit_enemy = true;
            }
        }
        if shooter < 2 && shooter != side {
            self.stats[shooter as usize].score += d as i64 * 3 / 2;
        }
        let hp = self.castles[side as usize].kettle_hp;
        self.ev(json!({"t": "hit", "target": "kettle", "side": side, "dmg": d, "hp": hp.max(0), "why": why}));
        if hp <= 0 {
            self.ev(json!({"t": "kettle_pop", "side": side}));
        }
    }

    /// An area or point payload at (x, y).
    #[allow(clippy::too_many_arguments)]
    fn blast(
        &mut self,
        a: &Actor,
        x: i32,
        y: i32,
        r: i32,
        dmg: i32,
        dtype: DType,
        bonus: &[(usize, i32)],
        low_row_pct: i32,
        direct: Option<Hit>,
    ) {
        let shooter = a.side;
        let falloff = |d: i32| -> i64 {
            if r == 0 {
                1000
            } else {
                250 + 750 * (r - d.min(r)) as i64 / r as i64
            }
        };
        // blocks
        for s in 0..2u8 {
            let cs = &self.castles[s as usize];
            let mut hits: Vec<(i32, i32, i32)> = vec![];
            for rr in 0..cs.rows {
                for c in 0..cs.cols {
                    let Some(b) = cs.block(c, rr) else { continue };
                    let is_direct = direct == Some(Hit::Block { side: s, c, r: rr });
                    if r == 0 && !is_direct {
                        continue;
                    }
                    let d = if is_direct {
                        0
                    } else {
                        dist_to_box(x, y, cs.slot_box(c, rr))
                    };
                    if d > r {
                        continue;
                    }
                    let mut p = self.pcts_common(shooter, s);
                    p.push(
                        self.content.materials.blocks[b.mat as usize]
                            .mult
                            .get(dtype),
                    );
                    if let Some((_, v)) = bonus.iter().find(|(m, _)| *m == b.mat as usize) {
                        p.push(*v);
                    }
                    if rr == 1 && low_row_pct != 100 {
                        p.push(low_row_pct);
                    }
                    hits.push((c, rr, calc(dmg, falloff(d), &p)));
                }
            }
            for (c, rr, d) in hits {
                self.apply_block(shooter, s, c, rr, d);
            }
        }
        // Hobs
        let ids: Vec<u8> = self
            .hobs
            .iter()
            .filter(|h| h.alive())
            .map(|h| h.id)
            .collect();
        for h in ids {
            let (hx, hy) = self.hob_feet(h);
            let is_direct = direct == Some(Hit::Hob(h));
            if r == 0 && !is_direct {
                continue;
            }
            let d = if is_direct {
                0
            } else {
                dist_to_box(x, y, (hx - 6, hy - 19, hx + 6, hy))
            };
            if d > r {
                continue;
            }
            let hob = &self.hobs[h as usize];
            let mut extra = vec![];
            let threaded = is_direct && self.cur.as_ref().is_some_and(|c| c.threaded_now);
            if r > 0 && hob.state == HobState::Seated && !threaded {
                let cs = &self.castles[hob.side as usize];
                let inside = hob.nook.is_some_and(|n| {
                    let b = cs.room_box(&cs.nooks[n as usize]);
                    x >= b.0 && x <= b.2 && y >= b.1 && y <= b.3
                });
                if !inside {
                    extra.push(50);
                }
            }
            self.damage_hob(shooter, h, dmg, dtype, falloff(d), &extra, is_direct);
        }
        // kettles
        for s in 0..2u8 {
            if self.castles[s as usize].kettle_hp <= 0 {
                continue;
            }
            let kb = self.castles[s as usize].kettle_box();
            let is_direct = direct == Some(Hit::Kettle(s));
            if r == 0 && !is_direct {
                continue;
            }
            let d = if is_direct { 0 } else { dist_to_box(x, y, kb) };
            if d > r {
                continue;
            }
            let extra = if a.passed_block { vec![50] } else { vec![] };
            self.damage_kettle(shooter, s, dmg, dtype, falloff(d), &extra);
        }
        // props
        for pi in 0..self.props.len() {
            let p = &self.props[pi];
            if p.hp <= 0 {
                continue;
            }
            let is_direct = direct == Some(Hit::Prop(pi));
            if r == 0 && !is_direct {
                continue;
            }
            let d = if is_direct {
                0
            } else {
                dist_to_box(x, y, (p.x - 6, p.y - 10, p.x + 6, p.y))
            };
            if d > r {
                continue;
            }
            let dd = calc(dmg, falloff(d), &[]);
            let p = &mut self.props[pi];
            p.hp -= dd;
            if dtype == DType::Blast && r > 0 && p.kind == "shell" {
                let push = dd.min(80);
                p.x += if p.x >= x { push } else { -push };
                p.x = p.x.clamp(0, self.terrain.w - 1);
            }
            let (px, py, hp, kind) = (p.x, p.y, p.hp, p.kind.clone());
            self.ev(
                json!({"t": "hit", "target": "prop", "kind": kind, "x": px, "y": py, "dmg": dd}),
            );
            if hp <= 0 {
                self.ev(json!({"t": "prop_break", "kind": kind, "x": px, "y": py}));
            }
            if shooter == 0 && kind == "cage_bar" {
                if let Some(c) = self.cur.as_mut() {
                    c.hit_enemy = true;
                }
            }
        }
        // shoved props settle on the ground again
        for pi in 0..self.props.len() {
            let (px, mut py) = (self.props[pi].x, self.props[pi].y);
            while py < self.terrain.h - 1 && !self.solid_any(px, py + 1) {
                py += 1;
            }
            self.props[pi].y = py;
        }
        self.props.retain(|p| p.hp > 0 || p.kind != "shell");
    }

    /// After any damage: collapse both forts, falls, states, burials, win.
    pub fn after_damage(&mut self) {
        for s in 0..2u8 {
            self.resolve_collapse(s);
        }
        self.refresh_hob_states();
        self.update_buried();
        let maybe_over = self.castles.iter().any(|c| c.kettle_hp <= 0)
            || self.hobs.iter().any(|h| !h.alive())
            || self.rules.objective.is_some();
        if maybe_over && self.check_win() {
            self.actors.clear();
        }
    }

    pub fn resolve_collapse(&mut self, side: u8) {
        let content = self.content.clone();
        let s = side as usize;
        for _pass in 0..6 {
            // blocks at 0 HP from crush break first
            let held = self.held_slots(side);
            let chunks = self.castles[s].falling_chunks(&content, &held);
            if chunks.is_empty() {
                self.hob_falls(side);
                if self.held_slots(side) == held {
                    break;
                }
                continue;
            }
            let mut total = 0;
            for chunk in chunks {
                let cs = &self.castles[s];
                let mut cols: Vec<(i32, i32, i32)> = vec![]; // col, lowest row, crush
                for &(c, r) in &chunk {
                    let b = cs.block(c, r).map(|b| b.mat as usize).unwrap_or(0);
                    let crush = 15 * content.materials.blocks[b].crush_pct / 100;
                    match cols.iter_mut().find(|x| x.0 == c) {
                        Some(x) => {
                            x.1 = x.1.min(r);
                            x.2 += crush;
                        }
                        None => cols.push((c, r, crush)),
                    }
                }
                cols.sort();
                let mut blocks_json = vec![];
                for &(c, r) in &chunk {
                    let m = cs
                        .block(c, r)
                        .map(|b| content.materials.blocks[b.mat as usize].id.clone())
                        .unwrap_or_default();
                    blocks_json.push(json!([c, r, m]));
                }
                let mut falls = vec![];
                let mut landings: Vec<(i32, i32, i32, i32)> = vec![]; // col, land row, crush, rb
                for &(c, rb, crush) in &cols {
                    let mut r = rb - 1;
                    while r >= 0 && !(cs.has_block(c, r) && !chunk.contains(&(c, r))) {
                        r -= 1;
                    }
                    falls.push(json!([c, (rb - r - 1) * BLOCK]));
                    landings.push((c, r, crush, rb));
                }
                // remove the chunk: it breaks on landing
                for &(c, r) in &chunk {
                    let i = self.castles[s].idx(c, r);
                    self.castles[s].slots[i] = Slot::Empty;
                }
                self.ev(
                    json!({"t": "collapse", "side": side, "blocks": blocks_json, "falls": falls}),
                );
                total += chunk.len() as i32;
                // crush what lies under each column
                for (c, land, crush, rb) in landings {
                    if crush <= 0 {
                        continue;
                    }
                    let squashed: Vec<u8> = self
                        .hobs
                        .iter()
                        .filter(|h| h.side == side && h.alive())
                        .filter(|h| {
                            h.nook.is_some_and(|n| {
                                let room = &self.castles[s].nooks[n as usize];
                                (room.c == c || room.c + 1 == c) && room.r > land && room.r < rb
                            })
                        })
                        .map(|h| h.id)
                        .collect();
                    for h in squashed {
                        let m = content.materials.hob.crush;
                        self.hobs[h as usize].state = HobState::Squashed;
                        self.hurt_hob_raw(h, crush * m / 100, "crush");
                    }
                    let k = &self.castles[s].kettle;
                    if (k.c == c || k.c + 1 == c) && k.r > land && k.r < rb {
                        let mut d = crush * content.materials.kettle.crush / 100;
                        if let Some(cx) = &self.cur {
                            d = d.min((KETTLE_CAP - cx.kettle_dealt[s]).max(0));
                        }
                        let shooter = self.cur.as_ref().map(|c| c.side).unwrap_or(2);
                        self.apply_kettle(shooter, side, d, "crush");
                    }
                    if land >= 0 {
                        if let Some(b) = self.castles[s].block(c, land) {
                            let m = content.materials.blocks[b.mat as usize].mult.crush;
                            let d = crush * m / 100;
                            if d > 0 {
                                let shooter = self.cur.as_ref().map(|c| c.side).unwrap_or(side);
                                self.apply_block(shooter, side, c, land, d);
                            }
                        }
                    }
                }
            }
            self.stats[if let Some(c) = &self.cur {
                c.side as usize
            } else {
                s
            }]
            .blocks_dropped += total;
            if let Some(c) = self.cur.as_mut() {
                c.dropped_blocks += total;
                if c.dropped_blocks >= 4 {
                    let first = !self.drop_called;
                    self.drop_called = true;
                    self.ev(json!({"t": "big_drop", "callout": first, "blocks": total}));
                }
            }
            self.hob_falls(side);
        }
    }

    /// The fall ladder: Hobs whose floor is gone drop to the first surface.
    fn hob_falls(&mut self, side: u8) {
        let s = side as usize;
        let ids: Vec<u8> = self
            .hobs
            .iter()
            .filter(|h| h.side == side && h.alive())
            .map(|h| h.id)
            .collect();
        for h in ids {
            let (fx_, fy) = self.hob_feet(h);
            let cs = &self.castles[s];
            let falls = match self.hobs[h as usize].nook {
                Some(n) => {
                    let room = &cs.nooks[n as usize];
                    room.r >= 1
                        && !cs.has_block(room.c, room.r - 1)
                        && !cs.has_block(room.c + 1, room.r - 1)
                }
                None => {
                    !self.solid_any(fx_, fy + 1)
                        && !self.solid_any(fx_ - 4, fy + 1)
                        && !self.solid_any(fx_ + 4, fy + 1)
                }
            };
            if !falls {
                continue;
            }
            let mut ly = fy;
            while ly < self.terrain.h - 1 && !self.solid_any(fx_, ly + 1) {
                ly += 1;
            }
            let drop = ly - fy;
            if drop <= 0 {
                continue;
            }
            // lands in a free Nook?
            let cs = &self.castles[s];
            let mut seat = None;
            for (i, n) in cs.nooks.iter().enumerate() {
                let b = cs.room_box(n);
                let taken = self
                    .hobs
                    .iter()
                    .any(|o| o.id != h && o.side == side && o.alive() && o.nook == Some(i as u8));
                if !taken && fx_ >= b.0 && fx_ <= b.2 && ly >= b.1 && ly <= b.3 + 1 {
                    seat = Some(i as u8);
                }
            }
            let tumbled = seat.is_none() && drop > 64;
            let (bx, by) = (cs.x, cs.base_y);
            {
                let hm = &mut self.hobs[h as usize];
                hm.nook = seat;
                hm.free = (fx_ - bx, ly - by);
                hm.state = if tumbled {
                    HobState::Tumbled
                } else {
                    HobState::Dropped
                };
            }
            let dmg = if tumbled {
                20
            } else if drop > 32 {
                (10 * drop / 16).min(40)
            } else {
                0
            };
            self.ev(json!({"t": "drop", "hob": h, "side": side, "from": [fx_, fy], "to": [fx_, ly], "cells": drop, "state": if tumbled { "tumbled" } else { "dropped" }, "dmg": dmg}));
            self.hurt_hob_raw(h, dmg, "fall");
        }
    }
}

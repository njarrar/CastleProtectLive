//! Shells in flight: the flight models. Pure movement and contact finding
//! lives here; what a contact does lives in effects.rs.

use crate::battle::Battle;
use crate::content::FlightKind;
use crate::math::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Fly,
    Roll { dir: i32 },
    Bore { dx: Fx, dy: Fx },
}

#[derive(Clone, Debug)]
pub struct Actor {
    pub id: u32,
    pub side: u8,
    pub shot: usize,
    pub x: Fx,
    pub y: Fx,
    pub vx: Fx,
    pub vy: Fx,
    pub mode: Mode,
    pub gravity_pct: i32,
    pub age: i32,
    pub bounces: i32,
    pub bored: i32,
    pub blocks_bored: i32,
    pub in_ground: bool,
    pub passes: i32,
    pub passed_block: bool,
    pub bent: i32,
    pub rolled: i32,
    pub roll_speed: Fx,
    pub apex_done: bool,
    /// The block a beam or bore is passing through: (side, c, r).
    pub skip: Option<(u8, i32, i32)>,
    pub done: bool,
    /// Preview and AI probes: stop at the first contact or trigger, no effects.
    pub probe: bool,
    pub root: bool,
    pub threads: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Hit {
    Terrain,
    Water,
    Block { side: u8, c: i32, r: i32 },
    Hob(u8),
    Kettle(u8),
    Prop(usize),
    Off,
}

#[derive(Clone, Copy, Debug)]
pub enum FlyOut {
    Moving,
    Apex,
    Contact {
        hit: Hit,
        cx: i32,
        cy: i32,
        px: i32,
        py: i32,
    },
}

/// Speed cap per axis: 64 cells a tick (7,680 cells a second), far above any
/// shot. Keeps every position step inside `i32`.
pub const MAX_SPEED: Fx = 64 << FX_SHIFT;

pub fn gravity_q() -> Fx {
    accel_q(600)
}

impl Battle {
    /// What a shell from `side` meets at cell (x, y). Own blocks, Hobs and
    /// kettle never block own shots.
    pub fn collide(
        &self,
        side: u8,
        x: i32,
        y: i32,
        skip: Option<(u8, i32, i32)>,
        rollers: bool,
    ) -> Option<Hit> {
        if x < 0 || x >= self.terrain.w {
            return Some(Hit::Off);
        }
        if y >= self.terrain.h {
            return Some(Hit::Terrain);
        }
        for (pi, p) in self.props.iter().enumerate() {
            if p.hp > 0
                && x >= p.x - 6
                && x <= p.x + 6
                && y >= p.y - 10
                && y <= p.y
                && (rollers || !p.stops_rollers || p.side != side)
            {
                return Some(Hit::Prop(pi));
            }
        }
        for cs in self.castles.iter() {
            if cs.side == side {
                continue;
            }
            if let Some((c, r)) = cs.slot_at(x, y) {
                if cs.has_block(c, r) {
                    if skip == Some((cs.side, c, r)) {
                        return None;
                    }
                    return Some(Hit::Block {
                        side: cs.side,
                        c,
                        r,
                    });
                }
            }
        }
        for h in &self.hobs {
            if h.side == side || !h.alive() {
                continue;
            }
            let (hx, hy) = self.hob_feet(h.id);
            if x >= hx - 6 && x <= hx + 6 && y >= hy - 19 && y <= hy {
                return Some(Hit::Hob(h.id));
            }
        }
        for cs in self.castles.iter() {
            if cs.side == side || cs.kettle_hp <= 0 {
                continue;
            }
            let (x0, y0, x1, y1) = cs.kettle_box();
            if x >= x0 && x <= x1 && y >= y0 && y <= y1 {
                return Some(Hit::Kettle(cs.side));
            }
        }
        if y < 0 {
            return None;
        }
        let v = self.terrain.get(x, y);
        if v == 255 || self.terrain.mats.solid[v as usize] {
            return Some(Hit::Terrain);
        }
        if self.terrain.mats.liquid[v as usize] {
            return Some(Hit::Water);
        }
        None
    }

    /// One tick of free flight. Moves the actor up to its first contact.
    ///
    /// Positions are Q16.16 in `i32` (about 32,767 cells each way), so a shell
    /// that leaves the world must end before it gets far: anything above
    /// `-4 * map height` ends as `Hit::Off`, and a shell with no gravity (a
    /// beam) ends as soon as it is above the top of the map, since it can not
    /// come back. All position maths is done in `i64` and range checked.
    pub fn fly_tick(&self, a: &mut Actor) -> FlyOut {
        let def = &self.content.shots[a.shot];
        let f = &def.flight;
        let beam = f.kind == FlightKind::Beam;
        if !beam {
            let wind_acc = pct(accel_q(self.wind as i64 * 10), f.wind_pct);
            let g = pct(gravity_q(), a.gravity_pct);
            a.vx = a.vx.saturating_add(wind_acc).clamp(-MAX_SPEED, MAX_SPEED);
            a.vy = a.vy.saturating_add(g).clamp(-MAX_SPEED, MAX_SPEED);
            if f.guide_tenths > 0 && a.apex_done && a.bent < f.guide_tenths {
                if let Some((tx, ty)) = self.guide_target(a.side, cell(a.x), cell(a.y)) {
                    let dx = (tx - cell(a.x)) as i64;
                    let dy = (ty - cell(a.y)) as i64;
                    let cross = a.vx as i64 * dy - a.vy as i64 * dx;
                    let step = 10.min(f.guide_tenths - a.bent);
                    if cross != 0 {
                        let s = if cross > 0 { step } else { -step };
                        let (nx, ny) = rotate(a.vx, a.vy, s);
                        a.vx = nx;
                        a.vy = ny;
                        a.bent += step;
                    }
                }
            }
        }
        // no gravity and not falling: it never comes back once above the map
        let no_return = beam || (a.gravity_pct <= 0 && a.vy <= 0);
        let top_limit = -4 * self.terrain.h;
        let (sx, sy) = (a.x as i64, a.y as i64);
        let dx = a.vx as i64;
        let dy = a.vy as i64;
        let n = (dx.abs().max(dy.abs()) >> FX_SHIFT) + 1;
        let mut px = cell(a.x);
        let mut py = cell(a.y);
        for k in 1..=n {
            let nx = sx + dx * k / n;
            let ny = sy + dy * k / n;
            let (cx64, cy64) = (nx >> FX_SHIFT, ny >> FX_SHIFT);
            let gone = cy64 < top_limit as i64
                || (no_return && cy64 < 0)
                || cx64 < -1
                || cx64 > self.terrain.w as i64;
            if gone {
                let cx = cx64.clamp(-1, self.terrain.w as i64) as i32;
                let cy = cy64.clamp(top_limit as i64, self.terrain.h as i64) as i32;
                return FlyOut::Contact {
                    hit: Hit::Off,
                    cx,
                    cy,
                    px,
                    py,
                };
            }
            let (cx, cy) = (cx64 as i32, cy64 as i32);
            if (cx, cy) != (px, py) {
                if let Some(hit) = self.collide(a.side, cx, cy, a.skip, false) {
                    a.x = nx as i32;
                    a.y = ny as i32;
                    return FlyOut::Contact {
                        hit,
                        cx,
                        cy,
                        px,
                        py,
                    };
                }
                if a.skip.is_some() && beam {
                    // left the skipped block?
                    if let Some((s, c, r)) = a.skip {
                        let cs = &self.castles[s as usize];
                        if cs.slot_at(cx, cy) != Some((c, r)) {
                            a.skip = None;
                        }
                    }
                }
                px = cx;
                py = cy;
            }
        }
        a.x = (sx + dx) as i32;
        a.y = (sy + dy) as i32;
        // Apex: the first tick the shell is not rising. A shell launched flat
        // or downward is past its apex on its first tick.
        if !beam && !a.apex_done && a.vy >= 0 {
            a.apex_done = true;
            return FlyOut::Apex;
        }
        FlyOut::Moving
    }

    /// Nearest enemy Hob or kettle for guided shells.
    pub fn guide_target(&self, side: u8, x: i32, y: i32) -> Option<(i32, i32)> {
        let mut best: Option<(i64, i32, i32)> = None;
        for h in &self.hobs {
            if h.side == side || !h.alive() || h.dummy {
                continue;
            }
            let (hx, hy) = self.hob_feet(h.id);
            let d = ((hx - x) as i64).pow(2) + ((hy - 10 - y) as i64).pow(2);
            if best.is_none_or(|b| d < b.0) {
                best = Some((d, hx, hy - 10));
            }
        }
        let cs = &self.castles[1 - side as usize];
        let (x0, y0, x1, y1) = cs.kettle_box();
        let (kx, ky) = ((x0 + x1) / 2, (y0 + y1) / 2);
        let d = ((kx - x) as i64).pow(2) + ((ky - y) as i64).pow(2);
        if best.is_none_or(|b| d < b.0) {
            best = Some((d, kx, ky));
        }
        best.map(|b| (b.1, b.2))
    }

    /// Run a lone probe in free flight to its first contact or trigger point.
    /// Returns the path (sampled cells) and the end point. Costs ticks.
    pub fn probe_path(
        &self,
        mut a: Actor,
        max_ticks: i32,
        stop_at_apex: bool,
        units: &mut i64,
    ) -> (Vec<(i32, i32)>, (i32, i32), Option<Hit>) {
        let mut path = vec![(cell(a.x), cell(a.y))];
        for t in 0..max_ticks {
            *units += 1;
            let out = self.fly_tick(&mut a);
            if t % 2 == 1 {
                path.push((cell(a.x), cell(a.y)));
            }
            match out {
                FlyOut::Moving => {}
                FlyOut::Apex => {
                    if stop_at_apex {
                        path.push((cell(a.x), cell(a.y)));
                        return (path, (cell(a.x), cell(a.y)), None);
                    }
                    if let Some(g) = self.content.shots[a.shot].flight.apex_gravity_pct {
                        a.gravity_pct = g;
                    }
                }
                FlyOut::Contact { hit, cx, cy, .. } => {
                    path.push((cx, cy));
                    return (path, (cx, cy), Some(hit));
                }
            }
        }
        let end = (cell(a.x), cell(a.y));
        (path, end, None)
    }
}

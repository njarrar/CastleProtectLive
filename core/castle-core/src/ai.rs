//! The Rival AI. It builds a knowledge view with only what the player can
//! see, samples aims with real sim probes, runs the best candidates through
//! the real sim on a cloned battle, scores them, then adds human-like aim
//! error that narrows shot by shot. All work is counted in work units (one
//! unit is one actor tick), never in time.

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

/// Aim error scale per Rival aim grade, percent of the preset's sigma.
fn grade_pct(g: i32) -> i32 {
    match g {
        1 => 220,
        2 => 160,
        4 => 85,
        5 => 70,
        _ => 100,
    }
}

/// How fast a Rival corrects from its last Pin, percent of the preset's
/// correction. A grade 1 or 2 Rival (Region 1) finds its range slowly, so
/// "Aim 1 of 5" plays as a weak shooter, not only a wide first shot.
fn grade_correct_pct(g: i32) -> i32 {
    match g {
        1 => 45,
        2 => 70,
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
    /// Walks taken this battle (a walk that finds nothing must not repeat
    /// turn after turn).
    pub walks: i32,
    /// The Hob that fired last turn (the AI likes to spread shots round its
    /// crew, as a player does).
    pub last_hob: Option<u8>,
}

/// Most walks the AI takes in a battle when no shot pays.
const MAX_AI_WALKS: i32 = 2;
/// Score charged for firing the same Hob two turns running.
const SAME_HOB_COST: i64 = 60;

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
    /// What `side` may know: the other side's hand, Doodads, draft picks,
    /// live aims, memory and random streams are wiped, and so are the Weather
    /// Fronts past the forecast and the Squall direction. Everything else on
    /// the field is public. The view is quiet (no events) and has no log.
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
        k.rng.ai[o] = crate::rng::Sfc32::new(0, "hidden");
        k.rng.battle = crate::rng::Sfc32::new(0, "hidden");
        k.rng.hazard = crate::rng::Sfc32::new(0, "hidden");
        let fr = k.rules.wind.front_rounds.max(1);
        let known = ((k.round - 1).max(0) / fr + 1) as usize;
        for (i, f) in k.fronts.iter_mut().enumerate() {
            if i > known {
                *f = 0;
            }
        }
        k.squall_dir = 1;
        k.events.clear();
        k.log = std::sync::Arc::new(vec![]);
        k.last_ai.clear();
        k.quiet = true;
        // keep own preset (Cozy never Threads); the other side reads as human
        let own = k.control[side as usize];
        k.control = [Control::Human, Control::Human];
        k.control[side as usize] = own;
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
                // focus: damage that leaves a Hob low is worth more
                let gone = (ha.max - ha.hp.max(0)) as i64 * 100 / ha.max.max(1) as i64;
                sc += lost * 10 + lost * 10 * FOCUS_PCT / 100 * gone / 100;
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
    sc += (kb - ka) * KETTLE_WEIGHT;
    // the kettle path: walls of the Kettle Room are worth more
    let cb = &before.castles[o];
    let ca = &after.castles[o];
    for &(c, r) in cb.room_walls(&cb.kettle).iter().flatten() {
        let hb = cb.block(c, r).map(|x| x.hp).unwrap_or(0) as i64;
        let ha = ca.block(c, r).map(|x| x.hp).unwrap_or(0) as i64;
        sc += (hb - ha).max(0) * KETTLE_WALL_WEIGHT;
    }
    let bb = before.castles[o].standing_hp(&before.content);
    let ba = after.castles[o].standing_hp(&after.content);
    sc += (bb - ba).max(0) * BLOCK_WEIGHT;
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
        ShotKind::Knack => KNACK_COST,
        ShotKind::Trick => def.value as i64 * TRICK_COST_PCT / 100,
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
    cost + rest as i64 * REST_COST
}

// Pacing numbers (bot tuned, see examples/pacing.rs): what the AI charges
// itself for spending a Knack use, a Trick Shell (percent of its value) and
// each turn of Rest. Lower costs mean Knacks and shells are fired when they
// pay, so fights reach the canon end (rounds 7 to 11) instead of the Squall.
const KNACK_COST: i64 = 30;
const TRICK_COST_PCT: i64 = 100;
const REST_COST: i64 = 20;
/// Extra weight on damage that brings a Hob close to a Bonk (focus fire).
const FOCUS_PCT: i64 = 200;
/// Weight on enemy block HP lost (opens walls toward the kettle).
const BLOCK_WEIGHT: i64 = 1;
/// Weight on kettle HP and on the Kettle Room walls (the win path).
const KETTLE_WEIGHT: i64 = 30;
const KETTLE_WALL_WEIGHT: i64 = 3;

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
    // the walls that stand between us and a win: the Kettle Room's front and
    // ceiling, and the front wall of the weakest Hob's Nook (its Cover)
    let mut walls: Vec<(i32, i32)> = vec![];
    let kw = cs.room_walls(&cs.kettle);
    walls.extend(kw[3].iter().copied());
    walls.extend(kw[1].iter().copied());
    if let Some(h) = k
        .hobs
        .iter()
        .filter(|h| h.side == o && h.alive() && !h.dummy && h.nook.is_some())
        .min_by_key(|h| (h.hp, h.id))
    {
        if let Some(n) = h.nook {
            let nw = cs.room_walls(&cs.nooks[n as usize]);
            walls.extend(nw[3].iter().copied());
        }
    }
    for (c, r) in walls {
        if cs.has_block(c, r) && !t.iter().any(|x| x.0 == 300 + r * 10 + c) {
            let (bx0, by0, bx1, by1) = cs.slot_box(c, r);
            t.push((300 + r * 10 + c, (bx0 + bx1) / 2, (by0 + by1) / 2));
        }
    }
    t
}

/// Aim a beam straight at the target.
fn beam_aim(w: &Battle, hob: u8, tx: i32, ty: i32) -> (i32, i32, i32) {
    let (lx, ly) = w.launch_point(hob);
    let a = atan2_t((ly - ty) as i64, (tx - lx) as i64);
    (a.clamp(0, 1800), 80, 0)
}

/// Power for a probe at `angle` to land near (tx, ty): a few probes, each
/// rescaling power by the square root of wanted over reached range (range
/// grows about with the square of speed). Returns (power, miss in cells).
fn quick_solve(
    w: &Battle,
    side: u8,
    hob: u8,
    shot: usize,
    angle: i32,
    tx: i32,
    ty: i32,
    units: &mut i64,
    budget: i64,
) -> Option<(i32, i32)> {
    let (lx, _) = w.launch_point(hob);
    let front = w.castles[side as usize].front_dir();
    let want = ((tx - lx) * front).max(8) as i64;
    let mut p: i32 = 60;
    let mut best: Option<(i32, i32)> = None;
    let mut tried: Vec<i32> = vec![];
    // a power bracket: short shots raise `lo`, long ones lower `hi`
    let (mut lo, mut hi) = (1, 100);
    for _ in 0..5 {
        if *units > budget || tried.contains(&p) {
            break;
        }
        tried.push(p);
        let a = w.aim_probe(side, hob, shot, angle, p);
        let (_, end, _) = w.probe_path(a, 600, false, units);
        let miss =
            isqrt(((end.0 - tx) as i64).pow(2) as u64 + ((end.1 - ty) as i64).pow(2) as u64) as i32;
        if best.is_none_or(|b| miss < b.1) {
            best = Some((p, miss));
        }
        if miss <= 6 {
            break;
        }
        let reach = ((end.0 - lx) * front) as i64;
        if reach < want {
            lo = lo.max(p + 1);
        } else {
            hi = hi.min(p - 1);
        }
        if lo > hi {
            break;
        }
        let np = if reach <= 4 {
            p + 30
        } else {
            (p as i64 * isqrt((want * 10_000 / reach) as u64) as i64 / 100) as i32
        };
        // stay inside the bracket; bisect when the estimate leaves it
        p = if np >= lo && np <= hi {
            np
        } else {
            (lo + hi) / 2
        };
    }
    best
}

/// Flight signature: shots that fly the same share one aim solution.
fn flight_sig(w: &Battle, shot: usize) -> (i32, i32, i32, i32, i32) {
    let f = &w.content.shots[shot].flight;
    let kind = match f.kind {
        FlightKind::Beam => 1,
        FlightKind::Roller => 2,
        FlightKind::Dig => 3,
        FlightKind::Bounce => 4,
        _ => 0,
    };
    (kind, f.speed_pct, f.gravity_pct, f.wind_pct, f.guide_tenths)
}

fn angles_for(kind: i32, front: i32, first: bool) -> Vec<i32> {
    let base: &[i32] = match (kind, first) {
        (2, true) | (3, true) => &[250],
        (2, false) | (3, false) => &[150, 400],
        (_, true) => &[450],
        (_, false) => &[300, 620, 760],
    };
    base.iter()
        .map(|&a| if front > 0 { a } else { 1800 - a })
        .collect()
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
    let n = w.run_until_plan_fast(3000);
    *units += n as i64 * (1 + w.actors.len() as i64) + 200;
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
    let budget = tuning(preset).budget;
    plan_turn_with(b, side, preset, budget, true)
}

#[derive(Clone, Debug)]
struct Rough {
    hob: u8,
    sig: (i32, i32, i32, i32, i32),
    shot_ix: usize,
    key: i32,
    tx: i32,
    ty: i32,
    angle: i32,
    power: i32,
    miss: i32,
}

fn plan_turn_with(
    b: &mut Battle,
    side: u8,
    preset: Preset,
    budget: i64,
    allow_walk: bool,
) -> Vec<Value> {
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
    let front = k.castles[s].front_dir();

    let tg = targets(&k, side, &mut units);
    let mut hobs: Vec<u8> = k
        .hobs
        .iter()
        .filter(|h| h.side == side && k.can_fire_hob(side, h.id))
        .map(|h| h.id)
        .collect();
    // start from a Hob picked with the AI stream, then go round the crew
    if hobs.len() > 1 {
        let start = b.rng.ai[s].range(0, hobs.len() as i32 - 1) as usize;
        hobs.rotate_left(start);
    }
    // the shots each Hob may fire: never a Dud, no Heavy on the first turn
    let mut shots_of: Vec<(u8, Vec<(String, usize)>)> = vec![];
    let mut self_cands: Vec<Cand> = vec![];
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
        let mut list = vec![];
        for sh in shots {
            let Some(id) = k.shot_for(h, &sh) else {
                continue;
            };
            let Some(ix) = k.shot_index(&id) else {
                continue;
            };
            let def = &k.content.shots[ix];
            if def.dud {
                continue;
            }
            if def.weight == Weight::H && k.turns_taken[s] == 0 && side == k.first_side {
                continue;
            }
            if def.flight.kind == FlightKind::SelfTarget {
                self_cands.push(Cand {
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
            list.push((sh, ix));
        }
        shots_of.push((h, list));
    }

    // 1. rough aims, breadth first: every (Hob, flight) gets target 1, then
    //    target 2, and so on, so the budget never goes to one Hob alone
    let solve_budget = t.budget * 45 / 100;
    let mut rough: Vec<Rough> = vec![];
    let mut pairs: Vec<(u8, (i32, i32, i32, i32, i32), usize)> = vec![];
    for (h, list) in &shots_of {
        for (_, ix) in list {
            let sig = flight_sig(&k, *ix);
            if !pairs.iter().any(|p| p.0 == *h && p.1 == sig) {
                pairs.push((*h, sig, *ix));
            }
        }
    }
    'targets: for &(key, tx, ty) in &tg {
        for &(h, sig, ix) in &pairs {
            if units > solve_budget.min(budget / 2) {
                break 'targets;
            }
            let (a, p, miss) = if sig.0 == 1 {
                beam_aim(&solve_world, h, tx, ty)
            } else {
                let a = angles_for(sig.0, front, true)[0];
                match quick_solve(&solve_world, side, h, ix, a, tx, ty, &mut units, budget) {
                    Some((p, m)) => (a, p, m),
                    None => continue,
                }
            };
            rough.push(Rough {
                hob: h,
                sig,
                shot_ix: ix,
                key,
                tx,
                ty,
                angle: a,
                power: p,
                miss,
            });
        }
    }
    // 2. refine the closest few with more angles
    rough.sort_by_key(|r| (r.miss, r.hob, r.key));
    let refine_budget = budget * 60 / 100;
    for r in rough.iter_mut().take(6) {
        if r.sig.0 == 1 || r.miss <= 8 {
            continue;
        }
        for a in angles_for(r.sig.0, front, false) {
            if units > refine_budget {
                break;
            }
            if let Some((p, m)) = quick_solve(
                &solve_world,
                side,
                r.hob,
                r.shot_ix,
                a,
                r.tx,
                r.ty,
                &mut units,
                budget,
            ) {
                if m < r.miss {
                    r.angle = a;
                    r.power = p;
                    r.miss = m;
                }
            }
        }
    }
    // every shot of the Hob that flies this way is a candidate
    let mut cands: Vec<Cand> = self_cands;
    for r in &rough {
        for (h, list) in &shots_of {
            if *h != r.hob {
                continue;
            }
            for (sh, ix) in list {
                if flight_sig(&k, *ix) == r.sig {
                    cands.push(Cand {
                        hob: r.hob,
                        shot: sh.clone(),
                        shot_ix: *ix,
                        target: r.key,
                        angle: r.angle,
                        power: r.power,
                        miss: r.miss,
                        score: 0,
                        dial: None,
                    });
                }
            }
        }
    }
    // most likely first: small miss, cheap shells; then the best of each Hob
    // goes to the front so every Hob gets at least one real sim
    cands.sort_by_key(|c| (c.miss / 16, shell_cost(&k, c), c.hob, c.target));
    let mut order: Vec<Cand> = vec![];
    for &h in &hobs {
        if let Some(p) = cands.iter().position(|c| c.hob == h) {
            order.push(cands.remove(p));
        }
    }
    order.extend(cands);
    // 3. run the candidates through the real sim and score them
    let flaps_before: Vec<bool> = k.castles[1 - s].nooks.iter().map(|n| n.flap).collect();
    let mut scored: Vec<Cand> = vec![];
    for c in order.into_iter() {
        if units > budget && !scored.is_empty() {
            break;
        }
        let Some(after) = sim_candidate(&k, side, &c, c.angle, c.power, &mut units) else {
            continue;
        };
        // canon: Cozy never Threads a Loophole
        if preset == Preset::Cozy {
            let flaps: Vec<bool> = after.castles[1 - s].nooks.iter().map(|n| n.flap).collect();
            if flaps
                .iter()
                .zip(flaps_before.iter())
                .any(|(a, b)| *a && !*b)
            {
                continue;
            }
        }
        let mut sc = score_result(&k, &after, side, &t) - shell_cost(&k, &c);
        let mut n = 1;
        for j in 0..t.jitter {
            if units > budget {
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
        if b.ai_mem[s].last_hob == Some(c.hob) {
            c2.score -= SAME_HOB_COST;
        }
        scored.push(c2);
    }
    scored.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then(a.hob.cmp(&b.hob))
            .then(a.target.cmp(&b.target))
            .then(a.shot.cmp(&b.shot))
    });

    // Doodads: mend when walls are hurt and no shot pays more
    let best_score = scored.first().map(|c| c.score).unwrap_or(-1);
    if let Some(cmd) = doodad_choice(&k, side, best_score, preset) {
        out.push(cmd);
        return out;
    }

    // nothing worth firing: walk toward the rival and try once more (with
    // half the budget, so a walk never doubles the think time)
    if allow_walk
        && b.ai_mem[s].walks < MAX_AI_WALKS
        && best_score <= 0
        && k.castles[s].steam >= 20
        && k.castles[s].steam_turn == 0
        && out.is_empty()
    {
        let dx = 40 * k.castles[s].front_dir();
        let cmd = json!({"cmd": "walk", "dx": dx});
        if k.command(&cmd)["ok"] == json!(true) {
            out.push(cmd);
            b.ai_mem[s].own_walked = true;
            b.ai_mem[s].walks += 1;
            let mut tmp = k.clone();
            tmp.castles[s].steam = 0;
            tmp.ai_mem[s] = b.ai_mem[s].clone();
            tmp.rng.ai[s] = b.rng.ai[s].clone();
            let mut rest = plan_turn_with(&mut tmp, side, preset, budget / 2, false);
            b.rng.ai[s] = tmp.rng.ai[s].clone();
            b.ai_mem[s] = tmp.ai_mem[s].clone();
            rest.retain(|c| c["cmd"] != json!("walk"));
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
    b.ai_mem[s].last_hob = Some(choice.hob);
    out.push(json!({"cmd": "pick_hob", "hob": choice.hob}));
    out.push(json!({"cmd": "pick_shot", "shot": choice.shot}));
    if b.content.shots[choice.shot_ix].flight.kind != FlightKind::SelfTarget {
        out.push(json!({"cmd": "aim", "angle": angle, "power": power}));
    }
    out.push(fire);
    out
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
    let b_grade = b.aim_grade[s];
    let g = grade_pct(b_grade);
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
            let cpct = (rng.range(t.c_low, t.c_high) * grade_correct_pct(b_grade) / 100) as i64;
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

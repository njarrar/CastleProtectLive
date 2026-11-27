//! The Rival AI. It builds a knowledge view with only what the player can
//! see, samples aims with real sim probes, runs the best candidates through
//! the real sim on a cloned battle, scores them, then adds human-like aim
//! error that narrows shot by shot. All work is counted in work units (one
//! unit is one actor tick), never in time.

use crate::battle::{Battle, Control, Phase};
use crate::content::{Effect, FlightKind, ShotDef, ShotKind, Weight};
use crate::math::*;
use serde_json::{json, Value};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Preset {
    Cozy,
    Fair,
    Stubborn,
}

impl Preset {
    pub fn try_parse(s: &str) -> Option<Preset> {
        match s {
            "cozy" => Some(Preset::Cozy),
            "fair" => Some(Preset::Fair),
            "stubborn" => Some(Preset::Stubborn),
            _ => None,
        }
    }
    pub fn parse(s: &str) -> Preset {
        Self::try_parse(s).unwrap_or(Preset::Fair)
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
    pub focus_pct: i64,
    pub bonk_bonus: i64,
    pub lethal_override: bool,
    pub smart_targets: bool,
    pub sporting: bool,
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
            focus_pct: 40,
            bonk_bonus: 400,
            lethal_override: false,
            smart_targets: false,
            sporting: true,
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
            focus_pct: 200,
            bonk_bonus: 1500,
            lethal_override: true,
            smart_targets: true,
            sporting: false,
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
            focus_pct: 200,
            bonk_bonus: 1500,
            lethal_override: true,
            smart_targets: true,
            sporting: false,
        },
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Habit {
    Balanced,
    KettleHunter,
    RoofWrecker,
    HobSniper,
    CautiousMender,
    /// Loves big shells, spends them fast, cares little for its own fort and
    /// fires from its top few ideas, not always the best one.
    Reckless,
}

/// The habit this side plays with, read from the level's `habit_id`. The
/// free text `habit` line is display only, so a copy edit never changes play.
fn habit_for(b: &Battle, side: u8) -> Habit {
    let s = if side == 1 {
        &b.level.rival
    } else {
        &b.level.player
    };
    habit_from_id(s.habit_id.as_deref().unwrap_or("balanced"))
}

fn habit_from_id(id: &str) -> Habit {
    match id {
        "kettle_hunter" => Habit::KettleHunter,
        "roof_wrecker" => Habit::RoofWrecker,
        "hob_sniper" => Habit::HobSniper,
        "cautious_mender" => Habit::CautiousMender,
        "reckless" => Habit::Reckless,
        _ => Habit::Balanced,
    }
}

#[derive(Clone, Copy, Debug)]
struct Weights {
    kettle: i64,
    kettle_wall: i64,
    block: i64,
    drop: i64,
    focus_pct: i64,
    bonk_bonus: i64,
    self_block_mult: i64,
    mend_mult: i64,
    lid_best_cap: i64,
    top_hob_bonus: i64,
    /// Percent of own Hob harm charged (self care); Reckless shrugs it off.
    self_hob_pct: i64,
    /// Percent of the usual shell cost; Reckless spends shells fast.
    shell_cost_pct: i64,
}

fn weights_for(t: &Tuning, preset: Preset, habit: Habit) -> Weights {
    let mut w = Weights {
        kettle: KETTLE_WEIGHT,
        kettle_wall: KETTLE_WALL_WEIGHT,
        block: BLOCK_WEIGHT,
        drop: 80,
        focus_pct: t.focus_pct,
        bonk_bonus: t.bonk_bonus,
        self_block_mult: 2,
        mend_mult: if preset == Preset::Cozy { 4 } else { 6 },
        lid_best_cap: 300,
        top_hob_bonus: 0,
        self_hob_pct: 100,
        shell_cost_pct: 100,
    };
    match habit {
        Habit::Balanced => {}
        Habit::KettleHunter => {
            w.kettle = 48;
            w.kettle_wall = 6;
            w.focus_pct = w.focus_pct * 75 / 100;
        }
        Habit::RoofWrecker => {
            w.block = 3;
            w.drop = 140;
            w.kettle_wall = 4;
        }
        Habit::HobSniper => {
            w.focus_pct = w.focus_pct * 140 / 100;
            w.bonk_bonus = w.bonk_bonus * 130 / 100;
            w.kettle = 20;
            w.top_hob_bonus = 12;
        }
        Habit::CautiousMender => {
            w.mend_mult += 4;
            w.lid_best_cap = 600;
            w.kettle = 25;
            w.self_block_mult = 4;
        }
        Habit::Reckless => {
            w.drop = 160;
            w.block = 2;
            w.focus_pct = w.focus_pct * 40 / 100;
            w.self_block_mult = 1;
            w.mend_mult = 2;
            w.self_hob_pct = 40;
            w.shell_cost_pct = 70;
        }
    }
    w
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
fn grade_correct_pct(g: i32, preset: Preset) -> i32 {
    let slow = match g {
        1 => 45,
        2 => 70,
        _ => 100,
    };
    // A Stubborn Rival may start as wide as the card says, but it finds its
    // range one grade faster.
    if preset == Preset::Stubborn {
        match g {
            1 => 70,
            _ => 100,
        }
    } else {
        slow
    }
}

/// A new aim point this close (world units, 3 blocks) to one the Rival has
/// already ranged in on keeps what it learned there: it knows the spot.
const NEAR_TARGET: i32 = 3 * crate::castle::BLOCK;

/// What the Rival learned about one aim point: where it was and how far off
/// its last shot there was.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AimOffset {
    pub target: i32,
    pub x: i32,
    pub y: i32,
    /// angle offset, tenths of a degree
    pub angle: i32,
    /// power offset, tenths of a power point
    pub power: i32,
}

#[derive(Clone, Debug, Default)]
pub struct AiMemory {
    /// One entry per aim point the Rival has fired at.
    pub offsets: Vec<AimOffset>,
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
    tx: i32,
    ty: i32,
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

fn score_result(before: &Battle, after: &Battle, side: u8, t: &Tuning, w: &Weights) -> i64 {
    let s = side as usize;
    let o = 1 - s;
    let mut sc: i64 = 0;
    if let Some(r) = &after.result {
        sc += if r.winner == side { 10_000 } else { -10_000 };
    }
    let max_enemy_hp = before
        .hobs
        .iter()
        .filter(|h| h.side as usize == o && h.alive() && !h.dummy)
        .map(|h| h.hp)
        .max()
        .unwrap_or(0);
    let top_enemy_hob = if w.top_hob_bonus > 0 {
        before
            .hobs
            .iter()
            .filter(|h| h.side as usize == o && h.alive() && !h.dummy)
            .min_by_key(|h| (before.hob_feet(h.id).1, h.id))
            .map(|h| h.id)
    } else {
        None
    };
    for (hb, ha) in before.hobs.iter().zip(after.hobs.iter()) {
        let lost = (hb.hp - ha.hp.max(0)) as i64;
        if hb.side as usize == o {
            if !hb.dummy {
                let sporting_hold = t.sporting && hb.hp * 2 < hb.max && max_enemy_hp > hb.hp;
                if sporting_hold {
                    // Sporting: spread fire across healthier Hobs before finishing a low one
                    sc += lost * 4;
                } else {
                    // focus: damage that leaves a Hob low is worth more
                    let gone = (ha.max - ha.hp.max(0)) as i64 * 100 / ha.max.max(1) as i64;
                    sc += lost * 10 + lost * 10 * w.focus_pct / 100 * gone / 100;
                }
                if top_enemy_hob == Some(hb.id) {
                    sc += lost * w.top_hob_bonus;
                }
                if hb.alive() && !ha.alive() {
                    sc += if sporting_hold {
                        w.bonk_bonus / 2
                    } else {
                        w.bonk_bonus
                    };
                }
            } else {
                sc += lost * 2;
            }
        } else if t.self_care {
            sc -= lost * 20 * w.self_hob_pct / 100;
        }
    }
    // Avoid harming Rescue captives so the Rival does not throw the battle.
    for pb in &before.props {
        if pb.kind != "captive" {
            continue;
        }
        let after_hp = after
            .props
            .iter()
            .find(|pa| pa.id == pb.id)
            .map(|pa| pa.hp.max(0))
            .unwrap_or(0);
        let lost = (pb.hp.max(0) - after_hp).max(0) as i64;
        if lost > 0 {
            sc -= lost * 50;
        }
    }
    let kb = before.castles[o].kettle_hp.max(0) as i64;
    let ka = after.castles[o].kettle_hp.max(0) as i64;
    sc += (kb - ka) * w.kettle;
    // the kettle path: walls of the Kettle Room are worth more
    let cb = &before.castles[o];
    let ca = &after.castles[o];
    for &(c, r) in cb.room_walls(&cb.kettle).iter().flatten() {
        let hb = cb.block(c, r).map(|x| x.hp).unwrap_or(0) as i64;
        let ha = ca.block(c, r).map(|x| x.hp).unwrap_or(0) as i64;
        sc += (hb - ha).max(0) * w.kettle_wall;
    }
    let bb = before.castles[o].standing_hp(&before.content);
    let ba = after.castles[o].standing_hp(&after.content);
    sc += (bb - ba).max(0) * w.block;
    let dropped = after.stats[s].blocks_dropped - before.stats[s].blocks_dropped;
    sc += dropped as i64 * w.drop;
    if t.self_care {
        let ob = before.castles[s].standing_hp(&before.content);
        let oa = after.castles[s].standing_hp(&after.content);
        sc -= (ob - oa).max(0) * w.self_block_mult;
    }
    sc
}

fn shell_cost(b: &Battle, c: &Cand, w: &Weights) -> i64 {
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
    (cost + rest as i64 * REST_COST) * w.shell_cost_pct / 100
}

// Pacing numbers (bot tuned, see examples/pacing.rs): what the AI charges
// itself for spending a Knack use, a Trick Shell (percent of its value) and
// each turn of Rest. Lower costs mean Knacks and shells are fired when they
// pay, so fights reach the canon end (rounds 7 to 11) instead of the Squall.
const KNACK_COST: i64 = 30;
const TRICK_COST_PCT: i64 = 100;
const REST_COST: i64 = 20;
/// Weight on enemy block HP lost (opens walls toward the kettle).
const BLOCK_WEIGHT: i64 = 1;
/// Weight on kettle HP and on the Kettle Room walls (the win path).
const KETTLE_WEIGHT: i64 = 30;
const KETTLE_WALL_WEIGHT: i64 = 3;

/// Targets: enemy Hobs, the kettle, and (on Fair/Stubborn) Lean Lines & Cover walls.
fn targets(
    k: &Battle,
    side: u8,
    t_cfg: &Tuning,
    habit: Habit,
    units: &mut i64,
) -> Vec<(i32, i32, i32)> {
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
    if t_cfg.smart_targets {
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
    }
    // the walls that stand between us and a win: the Kettle Room's front and
    // ceiling, and (on Fair/Stubborn) the front wall of the weakest Hob's Nook
    let mut walls: Vec<(i32, i32)> = vec![];
    let kw = cs.room_walls(&cs.kettle);
    walls.extend(kw[3].iter().copied());
    walls.extend(kw[1].iter().copied());
    if t_cfg.smart_targets {
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
    }
    if habit == Habit::RoofWrecker {
        let mut roofs: Vec<(i32, i32)> = vec![];
        for c in 0..cs.cols {
            if let Some(r) = (1..cs.rows).rev().find(|&r| cs.has_block(c, r)) {
                roofs.push((r, c));
            }
        }
        roofs.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        for (r, c) in roofs.into_iter().take(2) {
            walls.push((c, r));
        }
    }
    if habit == Habit::HobSniper {
        if let Some(h) = k
            .hobs
            .iter()
            .filter(|h| h.side == o && h.alive() && !h.dummy && h.nook.is_some())
            .min_by_key(|h| (k.hob_feet(h.id).1, h.id))
        {
            if let Some(n) = h.nook {
                let nw = cs.room_walls(&cs.nooks[n as usize]);
                walls.extend(nw[3].iter().copied());
            }
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
    let (_, actor_ticks) = w.run_until_plan_fast(3000);
    *units += actor_ticks + 200;
    Some(w)
}

/// Deterministic blast-size weight for draft scoring (KettleHunter prefers big blasts).
fn shot_blast_score(d: &ShotDef) -> i64 {
    let max_radius = d
        .triggers
        .iter()
        .flat_map(|t| t.effects.iter())
        .map(|e| match e {
            Effect::Explode { band, .. } => band.radius() as i64,
            Effect::Mound { radius, .. } => *radius as i64,
            _ => 0,
        })
        .max()
        .unwrap_or(0);
    let w_bonus = match d.weight {
        Weight::H => 16,
        Weight::M => 8,
        Weight::L => 0,
    };
    max_radius + w_bonus
}

pub fn draft_choice(b: &mut Battle, side: u8) -> Option<String> {
    let preset = match b.control[side as usize] {
        Control::Ai(p) => p,
        Control::Human => Preset::Fair,
    };
    let deny = match preset {
        Preset::Cozy => 0,
        Preset::Fair => 30,
        Preset::Stubborn => 60,
    };
    let big_blast = matches!(habit_for(b, side), Habit::KettleHunter | Habit::Reckless)
        && b.control[side as usize] != Control::Human;
    // the Rival takes its wish at its first chance
    if let Some(w) = &b.draft.wish {
        if b.control[side as usize] != Control::Human
            && b.draft.pool.contains(w)
            && b.draft.picks[side as usize].is_empty()
        {
            return Some(w.clone());
        }
    }
    let ranked: Vec<(i64, bool, String)> = {
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
        let mut out: Vec<(i64, bool, String)> = vec![];
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
            let mut sc = val(&mine) * 100 + val(&theirs) * deny;
            if big_blast && !d.dud {
                sc += shot_blast_score(d) * 50;
            }
            out.push((sc, d.dud, id.clone()));
        }
        out.sort_by(|a, b| b.0.cmp(&a.0).then(a.2.cmp(&b.2)));
        out
    };
    if ranked.is_empty() {
        return None;
    }
    if preset == Preset::Cozy && b.control[side as usize] != Control::Human {
        let non_dud: Vec<&(i64, bool, String)> = ranked.iter().filter(|x| !x.1).collect();
        let pool: Vec<&(i64, bool, String)> = if non_dud.is_empty() {
            ranked.iter().collect()
        } else {
            non_dud
        };
        let n = pool.len().min(4);
        let i = b.rng.ai[side as usize].range(0, n as i32 - 1) as usize;
        return Some(pool[i].2.clone());
    }
    Some(ranked[0].2.clone())
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

    // world used to solve aims: Cozy only half reads the wind, and a grade-1
    // campaign Rival facing scheduled wind fronts under-corrects on the first
    // shot after each front change.
    let mut solve_world = k.clone();
    solve_world.wind = solve_world.wind * t.wind_use / 100;
    if k.mode == "campaign"
        && !k.rules.wind.fronts.is_empty()
        && k.aim_grade[s] == 1
        && k.ai_mem[s].last_wind != Some(k.wind)
    {
        solve_world.wind /= 3;
    }
    let front = k.castles[s].front_dir();
    let habit = habit_for(&k, side);
    let weights = weights_for(&t, preset, habit);

    let tg = targets(&k, side, &t, habit, &mut units);
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
                    tx: 0,
                    ty: 0,
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
                        tx: r.tx,
                        ty: r.ty,
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
    cands.sort_by_key(|c| (c.miss / 16, shell_cost(&k, c, &weights), c.hob, c.target));
    let mut order: Vec<Cand> = vec![];
    for &h in &hobs {
        if let Some(p) = cands.iter().position(|c| c.hob == h) {
            order.push(cands.remove(p));
        }
    }
    order.extend(cands);
    // 3. run the candidates through the real sim and score them (Cozy scores on half-wind)
    let sim_world = if preset == Preset::Cozy {
        &solve_world
    } else {
        &k
    };
    let flaps_before: Vec<bool> = sim_world.castles[1 - s]
        .nooks
        .iter()
        .map(|n| n.flap)
        .collect();
    let mut scored: Vec<Cand> = vec![];
    for c in order.into_iter() {
        if units > budget && !scored.is_empty() {
            break;
        }
        let Some(after) = sim_candidate(sim_world, side, &c, c.angle, c.power, &mut units) else {
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
        let mut sc =
            score_result(sim_world, &after, side, &t, &weights) - shell_cost(&k, &c, &weights);
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
            if let Some(w2) =
                sim_candidate(sim_world, side, &c, c.angle + da, c.power + dp, &mut units)
            {
                sc +=
                    score_result(sim_world, &w2, side, &t, &weights) - shell_cost(&k, &c, &weights);
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
    if let Some(cmd) = doodad_choice(&k, side, best_score, &weights) {
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

    let Some(choice) = pick(&scored, &t, habit, b, s) else {
        out.push(json!({"cmd": "pass"}));
        return out;
    };
    let (angle, power) = apply_error(b, side, &choice, &t, preset, habit);
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

fn pick(scored: &[Cand], t: &Tuning, habit: Habit, b: &mut Battle, s: usize) -> Option<Cand> {
    if scored.is_empty() {
        return None;
    }
    // lethal check on Fair and Stubborn (disabled on Cozy)
    if t.lethal_override && scored[0].score >= 5_000 {
        return Some(scored[0].clone());
    }
    let from = if habit == Habit::Reckless {
        t.pick_from.max(3)
    } else {
        t.pick_from
    };
    let n = scored.len().min(from).max(1);
    let i = b.rng.ai[s].range(0, n as i32 - 1) as usize;
    Some(scored[i].clone())
}

fn apply_error(
    b: &mut Battle,
    side: u8,
    c: &Cand,
    t: &Tuning,
    preset: Preset,
    habit: Habit,
) -> (i32, i32) {
    let s = side as usize;
    let def = &b.content.shots[c.shot_ix];
    if def.flight.kind == FlightKind::SelfTarget {
        return (c.angle, c.power);
    }
    let b_grade = b.aim_grade[s];
    // a Reckless Rival fires before it looks: a quarter wider
    let g = grade_pct(b_grade) * if habit == Habit::Reckless { 125 } else { 100 } / 100;
    let sa = (t.angle_sigma * g / 100) as i64;
    let sp = (t.power_sigma * g / 100) as i64;
    let fa = (t.angle_floor * g / 100) as i64;
    let fp = (t.power_floor * g / 100) as i64;
    let wind = b.wind;
    let mem = b.ai_mem[s].clone();
    // what it learned here: this aim point, else the nearest one within
    // three blocks (it knows that spot, not only the range)
    let known = mem
        .offsets
        .iter()
        .find(|o| o.target == c.target)
        .or_else(|| {
            mem.offsets
                .iter()
                .map(|o| ((o.x - c.tx).abs().max((o.y - c.ty).abs()), o))
                .filter(|(d, _)| *d <= NEAR_TARGET)
                .min_by_key(|(d, o)| (*d, o.target))
                .map(|(_, o)| o)
        });
    let rng = &mut b.rng.ai[s];
    let nrm = |rng: &mut crate::rng::Sfc32, sigma: i64| -> i64 { rng.normal_q16() * sigma / 65536 };
    let (mut ba, mut bp) = match known {
        None => {
            let k = if mem.offsets.is_empty() {
                100
            } else {
                t.k_same
            } as i64;
            (nrm(rng, sa * k / 100), nrm(rng, sp * k / 100))
        }
        Some(o) => {
            let cpct =
                (rng.range(t.c_low, t.c_high) * grade_correct_pct(b_grade, preset) / 100) as i64;
            (
                o.angle as i64 * (100 - cpct) / 100 + nrm(rng, fa),
                o.power as i64 * (100 - cpct) / 100 + nrm(rng, fp),
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
    // no self harm by error: redraw once (halve the error) if the errored
    // shot lands on our own fort. A Reckless Rival fires anyway.
    if t.self_care && habit != Habit::Reckless {
        let angle = (c.angle + ba as i32).clamp(0, 1800);
        let power = (c.power + (bp / 10) as i32).clamp(1, 100);
        let a = b.aim_probe(side, c.hob, c.shot_ix, angle, power);
        let mut u = 0;
        let (_, end, _) = b.probe_path(a, 700, false, &mut u);
        let cs = &b.castles[s];
        if end.0 >= cs.x - 16 && end.0 <= cs.x + cs.width_cells() + 16 {
            ba /= 2;
            bp /= 2;
        }
    }
    // remember the error it really fired with, so the next shot corrects
    // from the true miss
    let mem = &mut b.ai_mem[s];
    mem.offsets.retain(|o| o.target != c.target);
    mem.offsets.push(AimOffset {
        target: c.target,
        x: c.tx,
        y: c.ty,
        angle: ba as i32,
        power: bp as i32,
    });
    mem.own_walked = false;
    mem.target_walked = 0;
    mem.last_wind = Some(wind);
    (
        (c.angle + ba as i32).clamp(0, 1800),
        (c.power + (bp / 10) as i32).clamp(1, 100),
    )
}

fn doodad_choice(k: &Battle, side: u8, best: i64, w: &Weights) -> Option<Value> {
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
                let worth = gain * w.mend_mult;
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
                    let cs = &k.castles[s];
                    let (x0, y0, x1, y1) = cs.room_box(&cs.kettle);
                    let near = px >= x0 - 32 && px <= x1 + 32 && py >= y0 - 32 && py <= y1 + 32;
                    if near
                        && best < w.lid_best_cap
                        && !cs.kettle.lid
                        && cs.room_intact(&cs.kettle, false)
                        && cs.kettle_hp < cs.kettle_max
                    {
                        return Some(json!({"cmd": "doodad", "doodad": d, "room": "kettle"}));
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn battle() -> Battle {
        let content = Arc::new(crate::embedded::content());
        Battle::new(
            content,
            r#"{"level":"d1","first_turn":1,"rummage":{"pool":0,"picks":0}}"#,
            8,
        )
        .unwrap()
    }

    fn cand(b: &Battle, target: i32, tx: i32, ty: i32) -> Cand {
        let hob = b.hobs.iter().find(|h| h.side == 1 && h.alive()).unwrap().id;
        Cand {
            hob,
            shot: "plain".into(),
            shot_ix: b.shot_index(&b.shot_for(hob, "plain").unwrap()).unwrap(),
            target,
            tx,
            ty,
            angle: 1350,
            power: 60,
            miss: 0,
            score: 0,
            dial: None,
        }
    }

    fn learned(target: i32, x: i32, y: i32) -> AimOffset {
        AimOffset {
            target,
            x,
            y,
            angle: 120,
            power: 300,
        }
    }

    fn fire_at(mut b: Battle, old: AimOffset) -> AimOffset {
        b.ai_mem[1].offsets = vec![old];
        let c = cand(&b, 7, 400, 300);
        let t = tuning(Preset::Fair);
        apply_error(&mut b, 1, &c, &t, Preset::Fair, Habit::Balanced);
        *b.ai_mem[1].offsets.iter().find(|o| o.target == 7).unwrap()
    }

    #[test]
    fn a_near_aim_point_keeps_what_was_learned() {
        let b = battle();
        let same = fire_at(b.clone(), learned(7, 400, 300));
        let near = fire_at(b.clone(), learned(5, 400 + NEAR_TARGET, 300));
        let far = fire_at(b, learned(5, 400 + NEAR_TARGET + 1, 300));
        assert_eq!(same.angle, near.angle);
        assert_eq!(same.power, near.power);
        assert_ne!((same.angle, same.power), (far.angle, far.power));
    }

    #[test]
    fn stubborn_finds_its_range_one_grade_faster() {
        assert_eq!(grade_correct_pct(1, Preset::Cozy), 45);
        assert_eq!(grade_correct_pct(1, Preset::Fair), 45);
        assert_eq!(grade_correct_pct(1, Preset::Stubborn), 70);
        assert_eq!(grade_correct_pct(2, Preset::Stubborn), 100);
    }

    #[test]
    fn reckless_spends_shells_and_shrugs_off_self_harm() {
        assert_eq!(habit_from_id("reckless"), Habit::Reckless);
        let t = tuning(Preset::Fair);
        let calm = weights_for(&t, Preset::Fair, Habit::Balanced);
        let wild = weights_for(&t, Preset::Fair, Habit::Reckless);
        assert!(wild.shell_cost_pct < calm.shell_cost_pct);
        assert!(wild.self_hob_pct < calm.self_hob_pct);
        assert!(wild.drop > calm.drop);
    }
}

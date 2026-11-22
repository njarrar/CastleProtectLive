//! Battle state, setup, the turn machine and commands.

use crate::actor::{Actor, Mode};
use crate::ai::{AiMemory, Preset};
use crate::castle::{Castle, Slot, BLOCK};
use crate::content::*;
use crate::hob::{Hob, HobState};
use crate::math::*;
use crate::rng::Streams;
use crate::terrain::{MatTable, Terrain};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::sync::Arc;

pub const SETTLE_TICKS: i32 = 60;
/// Flight cap: 6 s at 120 Hz. A shell still out then ends with a `miss`.
pub const MAX_ACTOR_AGE: i32 = 720;
/// Most a fort climbs in one 4 cell walk step.
pub const WALK_CLIMB: i32 = 16;
/// A fort can not walk off a drop deeper than this.
pub const WALK_DROP: i32 = 64;
/// A drop deeper than this is a Thump.
pub const THUMP_DROP: i32 = 48;
pub const MAX_ACTORS: usize = 64;
pub const STEAM_PER_TURN: i32 = 40;
pub const SHOVE_OFF: i32 = 15;
pub const KETTLE_CAP: i32 = 60;
/// From this round, damaged (Battered) blocks lose one block of side support.
pub const FATIGUE_ROUND: i32 = 10;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase {
    Draft,
    Plan,
    Resolve,
    Settle(i32),
    Ended,
}

impl Phase {
    pub fn name(self) -> &'static str {
        match self {
            Phase::Draft => "draft",
            Phase::Plan => "plan",
            Phase::Resolve => "resolve",
            Phase::Settle(_) => "settle",
            Phase::Ended => "ended",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Control {
    Human,
    Ai(Preset),
}

#[derive(Clone, Debug)]
pub struct Prop {
    pub id: u32,
    pub side: u8,
    pub shot: Option<usize>,
    pub x: i32,
    pub y: i32,
    pub hp: i32,
    pub max: i32,
    pub kind: String,
    pub tag: String,
    pub stops_rollers: bool,
}

#[derive(Clone, Debug)]
pub struct Ghost {
    pub side: u8,
    pub hob: u8,
    pub shot: String,
    pub angle: i32,
    pub power: i32,
    pub points: Vec<(i32, i32)>,
    pub pin: Option<(i32, i32)>,
    pub self_hit: bool,
    pub recalled: bool,
    pub round: i32,
}

#[derive(Clone, Debug, Default)]
pub struct Draft {
    pub pool: Vec<String>,
    pub picks: [Vec<String>; 2],
    pub next: u8,
    pub picks_each: i32,
    pub wish: Option<String>,
}

#[derive(Clone, Debug)]
pub struct Selection {
    pub hob: u8,
    pub shot: String,
}

/// Per shot bookkeeping for the clamps and stats.
#[derive(Clone, Debug, Default)]
pub struct ShotCtx {
    pub side: u8,
    pub hob: Option<u8>,
    pub kind: Option<ShotKind>,
    pub bonus_pct: i32,
    pub thread_bonus: i32,
    pub band_up: bool,
    pub dial: Option<String>,
    pub kettle_dealt: [i32; 2],
    pub hob_start_full: Vec<bool>,
    pub hob_dealt: Vec<i32>,
    pub hit_enemy: bool,
    pub hit_enemy_hob: bool,
    pub self_hit: bool,
    pub bonks: Vec<u8>,
    pub dropped_blocks: i32,
    pub pin: Option<(i32, i32)>,
    pub heavy: bool,
    pub pre_total: [i64; 2],
    pub threaded_now: bool,
    /// Shot id, for the "what broke you" summary.
    pub shot: Option<String>,
    /// Siege Score Skill Factor, percent.
    pub skill_pct: i32,
    pub big_drop_sent: bool,
}

#[derive(Clone, Debug, Default)]
pub struct SideStats {
    pub streak: i32,
    pub best_streak: i32,
    pub bonked_by_hob: Vec<String>,
    pub bonk_with_knack: bool,
    pub bonk_with_trick: bool,
    pub tricks_used: i32,
    pub hit_spots: Vec<i32>,
    pub own_bonked: i32,
    pub shots: i32,
    pub hits: i32,
    pub blocks_dropped: i32,
    pub score: i64,
    /// Enemy Hobs this side Bonked.
    pub bonks: i32,
    /// Blocks this side lost, and kettle HP lost.
    pub blocks_lost: i32,
    pub kettle_lost: i64,
    /// Damage this side took, by (shot id, shooter Hob or -1).
    pub taken: Vec<(String, i32, i64)>,
    /// The last enemy shot that hurt this side: (shot id, Hob or -1, round).
    pub last_blow: Option<(String, i32, i32)>,
}

#[derive(Clone, Debug)]
pub struct Outcome {
    pub winner: u8,
    pub how: String,
    pub round: i32,
    pub pennants: Vec<bool>,
    /// Pennants earned this battle that the save did not hold yet.
    pub pennants_new: Vec<bool>,
    /// Buttons the player (side 0) earns from this battle.
    pub buttons: i32,
    /// "What broke you": a summary for the losing side.
    pub broke: Value,
}

/// What the save already holds for this level (campaign and Daily rewards).
#[derive(Deserialize, Default, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Progress {
    /// The level was won before (replay rewards).
    #[serde(default)]
    pub cleared: bool,
    /// Pennants already held for this level.
    #[serde(default)]
    pub pennants: Vec<bool>,
    /// Daily Dust-up: today's first clear was already paid.
    #[serde(default)]
    pub daily_paid: bool,
}

/// Grand Fort 1-10 rig: the lawn roller and the shears.
#[derive(Clone, Debug, Default)]
pub struct BossState {
    pub phase: i32,
    /// Prop id of the roller, once released.
    pub roller: Option<u32>,
    pub roller_done: bool,
    /// Prop id of the shears hinge, once open.
    pub hinge: Option<u32>,
    /// The cut box over the player's fort, telegraphed one turn ahead.
    pub cut: Option<(i32, i32, i32, i32)>,
    /// Boss turns the shears stay jammed.
    pub jam: i32,
}

#[derive(Deserialize, Default, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct SideCfg {
    #[serde(default)]
    pub control: Option<String>,
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub crew: Vec<String>,
    #[serde(default)]
    pub blueprint: Option<String>,
    /// Inline blueprint rows (Workshop forts).
    #[serde(default)]
    pub rows: Vec<String>,
    #[serde(default)]
    pub doodads: Option<Vec<String>>,
    #[serde(default)]
    pub kit: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub steam: Option<i32>,
    #[serde(default)]
    pub aim: Option<i32>,
    /// Help handicap: "none", "some" or "lots" (Steam pool from app.json).
    #[serde(default)]
    pub help: Option<String>,
    /// Preview share of the arc for this side, 30 to 100 percent.
    #[serde(default)]
    pub preview_pct: Option<i32>,
    /// Crew size handicap, 1 to 5.
    #[serde(default)]
    pub crew_size: Option<i32>,
}

#[derive(Deserialize, Default, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Setup {
    #[serde(default)]
    pub mode: Option<String>,
    pub level: String,
    #[serde(default)]
    pub sides: Vec<SideCfg>,
    /// 0, 1 or "coin".
    #[serde(default)]
    pub first_turn: Option<Value>,
    #[serde(default)]
    pub round_cap: Option<i32>,
    #[serde(default)]
    pub squall: Option<bool>,
    #[serde(default)]
    pub wind: Option<WindDef>,
    #[serde(default)]
    pub rummage: Option<RummageDef>,
    #[serde(default)]
    pub puff_up: Option<bool>,
    /// Volley Points: Actions per side (6, 10 or 14). Skirmish, Daily and
    /// Couch Duel only.
    #[serde(default)]
    pub volley: Option<i32>,
    /// What the save holds for this level, for the Buttons reward.
    #[serde(default)]
    pub progress: Option<Progress>,
}

#[derive(Clone, Debug)]
pub struct Battle {
    pub content: Arc<Content>,
    pub shot_ix: Arc<BTreeMap<String, usize>>,
    pub level: Arc<LevelDef>,
    pub mode: String,
    pub rules: Rules,
    pub seed: u64,
    pub terrain: Terrain,
    pub castles: [Castle; 2],
    pub hobs: Vec<Hob>,
    pub actors: Vec<Actor>,
    pub props: Vec<Prop>,
    pub rng: Streams,
    pub tick: i64,
    pub round: i32,
    pub turn: i32,
    pub side: u8,
    pub first_side: u8,
    pub phase: Phase,
    pub acted: bool,
    pub wind: i32,
    pub fronts: Vec<i32>,
    pub squall_dir: i32,
    pub control: [Control; 2],
    pub names: [String; 2],
    pub aim_grade: [i32; 2],
    pub hands: [Vec<String>; 2],
    pub doodads: [Vec<String>; 2],
    pub draft: Draft,
    pub sel: [Selection; 2],
    pub ghosts: Vec<Ghost>,
    pub events: Vec<Value>,
    pub result: Option<Outcome>,
    pub stats: [SideStats; 2],
    pub cur: Option<ShotCtx>,
    pub next_id: u32,
    pub ai_mem: [AiMemory; 2],
    /// Every accepted command, shared copy on write (AI views clone cheaply).
    pub log: Arc<Vec<Value>>,
    /// False while `ai_turn` plays its own commands (only `ai_turn` is logged).
    pub logging: bool,
    /// AI sims set this: no events are built.
    pub quiet: bool,
    pub puff_up_used: [bool; 2],
    pub puff_up_allowed: [bool; 2],
    pub drop_called: bool,
    pub first_shot_done: [bool; 2],
    pub hill_start: i64,
    pub last_ai: Vec<Value>,
    pub turns_taken: [i32; 2],
    pub ai_shots: [i32; 2],
    pub ai_misses: [i32; 2],
    pub fire_x: i32,
    pub self_target: Option<(i32, i32)>,
    pub root_round: i32,
    pub snap_full: bool,
    /// An aim changed since the last snapshot (lean snapshots carry it).
    pub snap_aim: bool,
    /// `kettle_pop` sent for this side (once per pop).
    pub popped: [bool; 2],
    /// Volley Points: Actions per side, and Actions left.
    pub volley: i32,
    pub actions_left: [i32; 2],
    /// Steam pool at the start (the Steam bar's 100%).
    pub steam_max: [i32; 2],
    /// Preview share per side, percent.
    pub preview: [i32; 2],
    pub help: [String; 2],
    pub progress: Progress,
    pub boss: BossState,
}

fn ok() -> Value {
    json!({"ok": true})
}
pub fn err(reason: &str) -> Value {
    json!({"ok": false, "reason": reason})
}
fn err_d(reason: &str, detail: &str) -> Value {
    json!({"ok": false, "reason": reason, "detail": detail})
}

/// Read an optional whole number field and check its range. A fraction, a
/// string or a value outside `lo..=hi` is refused with `bad_value`; the core
/// never wraps or clamps a bad number in silence.
pub fn num(v: &Value, key: &str, lo: i64, hi: i64) -> Result<Option<i64>, Value> {
    match v.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(x) => match x.as_i64() {
            Some(n) if n >= lo && n <= hi => Ok(Some(n)),
            Some(_) => Err(err_d("bad_value", &format!("{key} must be {lo} to {hi}"))),
            None => Err(err_d("bad_value", &format!("{key} must be a whole number"))),
        },
    }
}

/// A whole number inside a JSON array (targets), range checked.
fn num_at(x: &Value, lo: i64, hi: i64) -> Option<i32> {
    x.as_i64().filter(|n| *n >= lo && *n <= hi).map(|n| n as i32)
}

pub fn mat_table(content: &Content) -> MatTable {
    let mut t = MatTable {
        solid: [false; 256],
        loose: [false; 256],
        liquid: [false; 256],
        carve_pct: [0; 256],
        heavy_carve_pct: [0; 256],
        bore_pct: [0; 256],
    };
    for m in &content.materials.terrain {
        let i = m.code as usize;
        t.solid[i] = m.solid;
        t.loose[i] = m.loose;
        t.liquid[i] = m.liquid;
        t.carve_pct[i] = m.carve_pct;
        t.heavy_carve_pct[i] = m.heavy_carve_pct.max(m.carve_pct);
        t.bore_pct[i] = m.bore_pct;
    }
    t
}

fn ground_height(l: &LevelDef, x: i32) -> i32 {
    let p = &l.ground.points;
    if x <= p[0][0] {
        return p[0][1];
    }
    for w in p.windows(2) {
        let (a, b) = (w[0], w[1]);
        if x >= a[0] && x <= b[0] {
            if b[0] == a[0] {
                return b[1];
            }
            return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
        }
    }
    p[p.len() - 1][1]
}

pub fn build_terrain(content: &Content, l: &LevelDef) -> Terrain {
    let mut t = Terrain::new(l.width, l.height, mat_table(content));
    let loam = content.terrain_code("loam");
    let clay = content.terrain_code("clay");
    let rock = content.terrain_code("rock");
    let bed = content.terrain_code("bedrock");
    let water = content.terrain_code("water");
    for x in 0..l.width {
        let top = l.height - ground_height(l, x);
        for y in top.max(0)..l.height {
            let d = y - top;
            let m = if y >= l.height - 8 {
                bed
            } else if d < l.ground.loam_depth {
                loam
            } else if d < l.ground.clay_depth {
                clay
            } else {
                rock
            };
            t.set(x, y, m);
        }
        for (x0, x1, ht, hb, mat) in &l.ground.patches {
            if x >= *x0 && x <= *x1 {
                let code = content.terrain_code(mat);
                for y in (l.height - ht).max(0)..(l.height - hb).min(l.height) {
                    t.set(x, y, code);
                }
            }
        }
        for w in &l.water {
            if x >= w.x0 && x <= w.x1 {
                for y in (l.height - w.level).max(0)..l.height {
                    if t.get(x, y) == 0 {
                        t.set(x, y, water);
                    } else {
                        break;
                    }
                }
            }
        }
    }
    t
}

fn sel_default(hob: u8) -> Selection {
    Selection {
        hob,
        shot: "plain".into(),
    }
}

impl Battle {
    pub fn new(content: Arc<Content>, setup_json: &str, seed: u64) -> Result<Battle, String> {
        let setup: Setup = serde_json::from_str(setup_json).map_err(|e| format!("setup: {e}"))?;
        Battle::from_setup(content, setup, seed)
    }

    pub fn from_setup(content: Arc<Content>, setup: Setup, seed: u64) -> Result<Battle, String> {
        let level = content
            .level(&setup.level)
            .ok_or(format!("unknown level {}", setup.level))?
            .clone();
        let mode = setup.mode.clone().unwrap_or_else(|| {
            if level.kind == "skirmish" {
                "skirmish".into()
            } else {
                "campaign".into()
            }
        });
        if !matches!(
            mode.as_str(),
            "campaign" | "skirmish" | "couch" | "test_yard" | "daily"
        ) {
            return Err(format!("unknown mode {mode}"));
        }
        let mut rules = level.rules.clone();
        if let Some(c) = setup.round_cap {
            if !(1..=40).contains(&c) {
                return Err("round_cap must be 1 to 40".into());
            }
            rules.round_cap = c;
        }
        if let Some(s) = setup.squall {
            rules.squall = s;
        }
        if let Some(w) = &setup.wind {
            rules.wind = w.clone();
        }
        if let Some(r) = &setup.rummage {
            if !(0..=20).contains(&r.pool) || !(0..=10).contains(&r.picks) {
                return Err("rummage pool must be 0 to 20 and picks 0 to 10".into());
            }
            rules.rummage = r.clone();
        }
        if !(-10..=10).contains(&rules.wind.min)
            || !(-10..=10).contains(&rules.wind.max)
            || !(1..=20).contains(&rules.wind.front_rounds)
        {
            return Err("wind must be -10 to 10 and front_rounds 1 to 20".into());
        }
        let volley = match setup.volley {
            None => 0,
            Some(n) => {
                if !matches!(mode.as_str(), "skirmish" | "couch" | "daily") {
                    return Err("Volley Points is for Skirmish and Couch Duel only".into());
                }
                if !(1..=30).contains(&n) {
                    return Err("volley must be 1 to 30 Actions".into());
                }
                // no round cap and no Squall: the Actions end the match
                rules.squall = false;
                rules.round_cap = n + 1;
                rules.cap_win = None;
                n
            }
        };
        let mut rng = Streams::new(seed);
        let shot_ix: BTreeMap<String, usize> = content
            .shots
            .iter()
            .enumerate()
            .map(|(i, s)| (s.id.clone(), i))
            .collect();
        let mut terrain = build_terrain(&content, &level);
        let hill_start = (0..terrain.w)
            .step_by(8)
            .map(|x| (terrain.h - terrain.surface(x)) as i64)
            .sum();

        let mut side_cfg = setup.sides.clone();
        while side_cfg.len() < 2 {
            side_cfg.push(SideCfg::default());
        }
        let level_sides = [&level.player, &level.rival];
        let mut control = [Control::Human, Control::Ai(Preset::Fair)];
        if mode == "couch" {
            control[1] = Control::Human;
        }
        let mut castles: Vec<Castle> = vec![];
        let mut hobs: Vec<Hob> = vec![];
        let mut doodads: [Vec<String>; 2] = [vec![], vec![]];
        let mut names: [String; 2] = [String::new(), String::new()];
        let mut aim_grade = [3, 3];
        let mut preview = [rules.preview_pct; 2];
        let mut helps: [String; 2] = ["none".into(), "none".into()];
        let mut kit_shells: Vec<String> = vec![];
        for s in 0..2usize {
            let cfg = &side_cfg[s];
            let ls = level_sides[s];
            if let Some(c) = &cfg.control {
                control[s] = match c.as_str() {
                    "human" => Control::Human,
                    "ai" => Control::Ai(Preset::parse(cfg.preset.as_deref().unwrap_or("fair"))),
                    _ => return Err(format!("unknown control {c}")),
                };
            } else if let (Control::Ai(_), Some(p)) = (control[s], &cfg.preset) {
                control[s] = Control::Ai(Preset::parse(p));
            }
            let kit = match &cfg.kit {
                Some(k) => Some(
                    content
                        .starter_box
                        .kits
                        .iter()
                        .find(|x| &x.id == k)
                        .ok_or(format!("unknown kit {k}"))?
                        .clone(),
                ),
                None => None,
            };
            let mut crew: Vec<String> = if !cfg.crew.is_empty() {
                cfg.crew.clone()
            } else if let Some(k) = &kit {
                k.crew.clone()
            } else {
                ls.crew.clone()
            };
            if let Some(n) = ls.crew_size {
                if cfg.crew.is_empty() && kit.is_none() {
                    crew.truncate(n as usize);
                }
            }
            if let Some(n) = cfg.crew_size {
                if !(1..=5).contains(&n) {
                    return Err("crew_size must be 1 to 5".into());
                }
                crew.truncate(n as usize);
            }
            if crew.len() > 5 {
                return Err(format!("side {s} has more than 5 Hobs"));
            }
            if crew.is_empty() {
                return Err(format!("side {s} has no crew"));
            }
            let bp = if !cfg.rows.is_empty() {
                Blueprint {
                    id: "inline".into(),
                    name: String::new(),
                    rows: cfg.rows.clone(),
                }
            } else {
                let id = cfg
                    .blueprint
                    .clone()
                    .or_else(|| kit.as_ref().map(|k| k.blueprint.clone()))
                    .or_else(|| ls.blueprint.clone())
                    .unwrap_or_else(|| default_blueprint(crew.len()).into());
                content
                    .blueprint(&id)
                    .ok_or(format!("unknown blueprint {id}"))?
                    .clone()
            };
            crate::castle::validate_blueprint(&content, &bp, crew.len() as i32)?;
            let help = cfg.help.clone().unwrap_or_else(|| "none".into());
            let help_steam = content.app_help_steam(&help).ok_or(format!("unknown help {help}"))?;
            if let Some(st) = cfg.steam {
                if !(0..=1000).contains(&st) {
                    return Err("steam must be 0 to 1000".into());
                }
            }
            let steam = cfg
                .steam
                .unwrap_or(if help_steam > 0 { help_steam } else { rules.steam });
            if let Some(p) = cfg.preview_pct {
                if !(0..=100).contains(&p) {
                    return Err("preview_pct must be 0 to 100".into());
                }
            }
            preview[s] = cfg.preview_pct.unwrap_or(rules.preview_pct);
            helps[s] = help;
            if let Some(d) = &cfg.doodads {
                for id in d {
                    if content.doodad(id).is_none() {
                        return Err(format!("unknown doodad {id}"));
                    }
                }
            }
            let mut cs = Castle::from_blueprint(&content, &bp, s as u8, steam)?;
            let w = cs.width_cells();
            cs.x = (level.pads[s].x - w / 2).clamp(0, level.width - w);
            cs.base_y = (cs.x..cs.x + w)
                .map(|x| terrain.surface(x))
                .min()
                .unwrap_or(level.height);
            for (i, hid) in crew.iter().enumerate() {
                let hd = content.hob(hid).ok_or(format!("unknown hob {hid}"))?;
                let plain = match &hd.passive {
                    Some(Passive::PlainOverride { shot }) => shot.clone(),
                    _ => content
                        .class(&hd.class)
                        .map(|c| c.plain.clone())
                        .unwrap_or_default(),
                };
                let id = hobs.len() as u8;
                hobs.push(Hob {
                    id,
                    side: s as u8,
                    def: hd.id.clone(),
                    name: hd.name.clone(),
                    class: hd.class.clone(),
                    hp: hd.hp,
                    max: hd.hp,
                    nook: Some(i as u8),
                    free: (0, 0),
                    state: HobState::Seated,
                    rest: 0,
                    extra_rest: false,
                    knack_uses: if hd.knack.is_some() { 2 } else { 0 },
                    angle: if s == 0 { 450 } else { 1350 },
                    power: 60,
                    plain,
                    knack: hd.knack.clone(),
                    passive: hd.passive.clone(),
                    dummy: hd.dummy,
                    grudge: false,
                    clatter: false,
                    buried: false,
                    fired_this_turn: false,
                });
            }
            doodads[s] = cfg
                .doodads
                .clone()
                .or_else(|| kit.as_ref().map(|k| k.doodads.clone()))
                .unwrap_or_else(|| ls.doodads.clone());
            doodads[s].truncate(2);
            names[s] = cfg.name.clone().unwrap_or_else(|| {
                if !ls.name.is_empty() {
                    ls.name.clone()
                } else if s == 0 {
                    "Left".into()
                } else {
                    "Right".into()
                }
            });
            if cfg.aim.is_some_and(|a| !(1..=5).contains(&a)) {
                return Err("aim must be 1 to 5".into());
            }
            aim_grade[s] = cfg.aim.or(ls.aim).unwrap_or(3).clamp(1, 5);
            if let Some(k) = &kit {
                for sh in &k.shells {
                    if !kit_shells.contains(sh) {
                        kit_shells.push(sh.clone());
                    }
                }
            }
            castles.push(cs);
        }
        let castles: [Castle; 2] = [castles.remove(0), castles.remove(0)];
        // terrain under castles stays as is; mark everything dirty for the first frame
        terrain.mark_dirty(0, 0, level.width, level.height);

        let first_side: u8 = match &setup.first_turn {
            Some(Value::Number(n)) => match n.as_u64() {
                Some(0) => 0,
                Some(1) => 1,
                _ => return Err("first_turn must be 0, 1 or \"coin\"".into()),
            },
            Some(Value::String(s)) if s != "coin" => {
                return Err("first_turn must be 0, 1 or \"coin\"".into())
            }
            Some(Value::String(s)) if s == "coin" => rng.battle.range(0, 1) as u8,
            _ => {
                if rules.first_turn == 2
                    || (mode != "campaign"
                        && setup.first_turn.is_none()
                        && level.kind == "skirmish")
                {
                    rng.battle.range(0, 1) as u8
                } else {
                    rules.first_turn.min(1)
                }
            }
        };
        // weather fronts: fixed ones first, then random in range; enough for the cap plus squall
        let total_fronts = (rules.round_cap + 6) / rules.wind.front_rounds.max(1) + 2;
        let mut fronts = rules.wind.fronts.clone();
        while (fronts.len() as i32) < total_fronts {
            let mag = rng.battle.range(
                rules.wind.min.min(rules.wind.max),
                rules.wind.max.max(rules.wind.min),
            );
            let sign = if rng.battle.range(0, 1) == 0 { 1 } else { -1 };
            fronts.push((mag * sign).clamp(-10, 10));
        }
        let squall_dir = if rng.battle.range(0, 1) == 0 { 1 } else { -1 };
        let puff_default = setup.puff_up.unwrap_or(true);
        let puff_up_allowed = [
            puff_default
                && (control[0] == Control::Human
                    && (mode == "couch" || control[1] != Control::Human)
                    || mode == "couch"),
            puff_default
                && (control[1] == Control::Human
                    && (mode == "couch" || control[0] != Control::Human)
                    || mode == "couch"),
        ];
        let n_hobs = hobs.len();
        let first0 = hobs.iter().find(|h| h.side == 0).map(|h| h.id).unwrap_or(0);
        let first1 = hobs.iter().find(|h| h.side == 1).map(|h| h.id).unwrap_or(0);
        let mut b = Battle {
            content: content.clone(),
            shot_ix: Arc::new(shot_ix),
            level: Arc::new(level.clone()),
            mode,
            rules: rules.clone(),
            seed,
            terrain,
            castles,
            hobs,
            actors: vec![],
            props: vec![],
            rng,
            tick: 0,
            round: 1,
            turn: 0,
            side: first_side,
            first_side,
            phase: Phase::Draft,
            acted: false,
            wind: 0,
            fronts,
            squall_dir,
            control,
            names,
            aim_grade,
            hands: [
                level.player.loose_shells.clone(),
                level.rival.loose_shells.clone(),
            ],
            doodads,
            draft: Draft::default(),
            sel: [sel_default(first0), sel_default(first1)],
            ghosts: vec![],
            events: vec![],
            result: None,
            stats: [SideStats::default(), SideStats::default()],
            cur: None,
            next_id: 1,
            ai_mem: [AiMemory::default(), AiMemory::default()],
            log: Arc::new(vec![]),
            logging: true,
            quiet: false,
            puff_up_used: [false; 2],
            puff_up_allowed,
            drop_called: false,
            first_shot_done: [false; 2],
            hill_start,
            last_ai: vec![],
            turns_taken: [0; 2],
            ai_shots: [0; 2],
            ai_misses: [0; 2],
            fire_x: 0,
            self_target: None,
            root_round: 0,
            snap_full: true,
            snap_aim: false,
            popped: [false; 2],
            volley,
            actions_left: [volley; 2],
            steam_max: [0; 2],
            preview,
            help: helps,
            progress: setup.progress.clone().unwrap_or_default(),
            boss: BossState::default(),
        };
        let _ = n_hobs;
        // second side gets +20 Steam
        let second = 1 - first_side as usize;
        b.castles[second].steam = b.castles[second].steam.saturating_add(20);
        b.steam_max = [b.castles[0].steam, b.castles[1].steam];
        if b.rules.boss.is_some() {
            b.boss.phase = 1;
        }
        b.wind = b.fronts[0];
        for o in level.objects.iter() {
            let gy = b.terrain.surface(o.x) - o.lift;
            let id = b.next_id;
            b.next_id += 1;
            b.props.push(Prop {
                id,
                side: 2,
                shot: None,
                x: o.x,
                y: gy - 1,
                hp: o.hp,
                max: o.hp,
                kind: o.kind.clone(),
                tag: o.tag.clone(),
                stops_rollers: false,
            });
        }
        b.update_buried();
        b.refresh_hob_states();
        // the Rummage
        let rd = rules.rummage.clone();
        if rd.pool > 0 && rd.picks > 0 {
            let mut src: Vec<String> = if !rd.source.is_empty() {
                rd.source.clone()
            } else if !kit_shells.is_empty() {
                kit_shells
            } else {
                content.rummage.source.clone()
            };
            // shuffle with the battle stream, keep at most one Dud
            for i in (1..src.len()).rev() {
                let j = b.rng.battle.range(0, i as i32) as usize;
                src.swap(i, j);
            }
            let mut pool = vec![];
            let mut duds = 0;
            for s in src {
                if pool.len() as i32 >= rd.pool {
                    break;
                }
                let dud = content.shot(&s).is_some_and(|d| d.dud);
                if dud && duds >= 1 {
                    continue;
                }
                if dud {
                    duds += 1;
                }
                pool.push(s);
            }
            let picks_each = rd.picks.min(pool.len() as i32 / 2);
            b.draft = Draft {
                pool,
                picks: [vec![], vec![]],
                next: 1 - first_side,
                picks_each,
                wish: None,
            };
            for s in 0..2u8 {
                if let Control::Ai(p) = b.control[s as usize] {
                    if p != Preset::Stubborn && b.draft.wish.is_none() {
                        b.draft.wish = crate::ai::draft_choice(&b, s);
                    }
                }
            }
            b.ev(json!({"t": "draft_start", "pool": b.draft.pool, "first_pick": b.draft.next, "wish": b.draft.wish}));
            b.phase = Phase::Draft;
            b.ai_draft_picks();
        } else {
            b.start_battle();
        }
        Ok(b)
    }

    pub fn ev(&mut self, v: Value) {
        if self.quiet {
            return;
        }
        let mut v = v;
        if let Value::Object(m) = &mut v {
            m.insert("tick".into(), json!(self.tick));
        }
        self.events.push(v);
    }

    pub fn shot_index(&self, id: &str) -> Option<usize> {
        self.shot_ix.get(id).copied()
    }

    pub fn hob_feet(&self, id: u8) -> (i32, i32) {
        let h = &self.hobs[id as usize];
        let cs = &self.castles[h.side as usize];
        match h.nook {
            Some(n) => cs.seat_point(&cs.nooks[n as usize]),
            None => (cs.x + h.free.0, cs.base_y + h.free.1),
        }
    }

    fn start_battle(&mut self) {
        self.phase = Phase::Plan;
        self.round = 1;
        self.ev(json!({"t": "battle_start", "first": self.first_side, "wind": self.wind, "forecast": self.forecast()}));
        self.begin_turn(self.first_side);
    }

    pub fn forecast(&self) -> i32 {
        let fr = self.rules.wind.front_rounds.max(1);
        let idx = ((self.round - 1) / fr + 1) as usize;
        *self.fronts.get(idx).unwrap_or(&0)
    }

    pub fn front_rounds_left(&self) -> i32 {
        let fr = self.rules.wind.front_rounds.max(1);
        fr - (self.round - 1) % fr
    }

    pub fn squall_round(&self) -> i32 {
        if self.rules.squall && self.round > self.rules.round_cap {
            self.round - self.rules.round_cap
        } else {
            0
        }
    }

    pub fn squall_warning(&self) -> Option<i32> {
        if !self.rules.squall {
            return None;
        }
        let n = self.rules.round_cap - self.round + 1;
        if (1..=3).contains(&n) {
            Some(n)
        } else {
            None
        }
    }

    // ---------------------------------------------------------------- draft

    fn ai_draft_picks(&mut self) {
        while self.phase == Phase::Draft {
            let s = self.draft.next;
            if self.control[s as usize] == Control::Human {
                break;
            }
            let pick = crate::ai::draft_choice(self, s);
            match pick {
                Some(p) => {
                    let _ = self.draft_pick(s, &p);
                }
                None => break,
            }
        }
    }

    fn draft_pick(&mut self, s: u8, shell: &str) -> Value {
        if self.phase != Phase::Draft {
            return err("not_drafting");
        }
        if s != self.draft.next {
            return err("not_your_pick");
        }
        let Some(pos) = self.draft.pool.iter().position(|x| x == shell) else {
            return err("not_in_pool");
        };
        let sh = self.draft.pool.remove(pos);
        self.draft.picks[s as usize].push(sh.clone());
        self.hands[s as usize].push(sh.clone());
        self.ev(json!({"t": "draft_pick", "side": s, "shell": sh}));
        let pe = self.draft.picks_each as usize;
        let other = 1 - s;
        if self.draft.picks[other as usize].len() < pe {
            self.draft.next = other;
        } else if self.draft.picks[s as usize].len() < pe {
            self.draft.next = s;
        }
        if self.draft.picks[0].len() >= pe && self.draft.picks[1].len() >= pe {
            self.ev(json!({"t": "draft_end"}));
            self.start_battle();
        }
        ok()
    }

    fn quick_pick(&mut self, s: u8) -> Value {
        // Fair draft choice, never a Dud for a human side
        while self.phase == Phase::Draft && self.draft.next == s {
            let human = self.control[s as usize] == Control::Human;
            let mut choice = crate::ai::draft_choice(self, s);
            if human {
                if let Some(c) = &choice {
                    if self.content.shot(c).is_some_and(|d| d.dud) {
                        choice = self
                            .draft
                            .pool
                            .iter()
                            .find(|x| !self.content.shot(x).is_some_and(|d| d.dud))
                            .cloned()
                            .or(choice);
                    }
                }
            }
            match choice {
                Some(c) => {
                    self.draft_pick(s, &c);
                }
                None => break,
            }
        }
        ok()
    }

    // ---------------------------------------------------------------- turns

    pub fn begin_turn(&mut self, side: u8) {
        self.side = side;
        self.acted = false;
        self.phase = Phase::Plan;
        self.turn += 1;
        let s = side as usize;
        self.castles[s].steam_turn = 0;
        for n in self.castles[s].nooks.iter_mut() {
            n.lid = false;
        }
        self.castles[s].kettle.lid = false;
        for h in self.hobs.iter_mut() {
            h.fired_this_turn = false;
        }
        self.ev(json!({"t": "turn_start", "side": side, "round": self.round, "turn": self.turn}));
        if self.volley > 0 {
            self.volley_revive(side);
        }
        // props that wake at their owner's turn start (Tick-Tock Crock). Ids,
        // not indexes: a wake blast can break other props and shrink the list.
        let waking: Vec<u32> = self
            .props
            .iter()
            .filter(|p| p.side == side && p.hp > 0 && p.shot.is_some())
            .map(|p| p.id)
            .collect();
        for pid in waking.into_iter().rev() {
            let Some(pi) = self.props.iter().position(|p| p.id == pid && p.hp > 0) else {
                continue;
            };
            let p = self.props[pi].clone();
            let Some(shot) = p.shot else { continue };
            let trig: Vec<Effect> = self.content.shots[shot]
                .triggers
                .iter()
                .filter(|t| t.on == TriggerOn::OwnerTurnStart)
                .flat_map(|t| t.effects.clone())
                .collect();
            if trig.is_empty() {
                continue;
            }
            self.props.remove(pi);
            self.begin_ctx(
                side,
                None,
                Some(ShotKind::Knack),
                self.content.shots[shot].weight == Weight::H,
            );
            if let Some(c) = self.cur.as_mut() {
                c.shot = Some(self.content.shots[shot].id.clone());
            }
            let a = self.probe_actor_at(side, shot, p.x, p.y - 4);
            self.run_effects(&trig, &a, p.x, p.y - 4, None, false);
            self.ev(
                json!({"t": "prop_wake", "x": p.x, "y": p.y, "shot": self.content.shots[shot].id}),
            );
            self.finish_ctx();
            if self.check_win() {
                return;
            }
        }
        // boss regrow and rig
        if self.rules.regrow && side == 1 {
            self.regrow(1);
        }
        if self.rules.boss.is_some() && side == 1 {
            self.boss_turn();
            if self.check_win() {
                return;
            }
        }
        // newest burial clears if every live Hob is dug in
        self.update_buried();
        let live: Vec<u8> = self
            .hobs
            .iter()
            .filter(|h| h.side == side && h.alive() && !h.dummy)
            .map(|h| h.id)
            .collect();
        if !live.is_empty() && live.iter().all(|&i| self.hobs[i as usize].buried) {
            let newest = live
                .iter()
                .copied()
                .max_by_key(|&i| {
                    let h = &self.hobs[i as usize];
                    h.nook
                        .map(|n| self.castles[s].nooks[n as usize].buried_tick)
                        .unwrap_or(0)
                })
                .unwrap_or(live[0]);
            self.clear_loophole(newest);
            self.ev(json!({"t": "dug_out", "hob": newest, "why": "all_buried"}));
        }
        // pick a usable Hob for the selection
        if !self.can_fire_hob(side, self.sel[s].hob) {
            if let Some(h) = self
                .hobs
                .iter()
                .find(|h| h.side == side && self.can_fire_hob(side, h.id))
            {
                self.sel[s] = sel_default(h.id);
            }
        }
        // a stale shot (Trick Shell spent, Knack used up) falls back to plain
        let hob = self.sel[s].hob as usize;
        let valid = match self.sel[s].shot.as_str() {
            "plain" => true,
            "knack" => self
                .hobs
                .get(hob)
                .is_some_and(|h| h.knack.is_some() && h.knack_uses > 0),
            t => self.hands[s].iter().any(|x| x == t),
        };
        if !valid {
            self.sel[s].shot = "plain".into();
        }
    }

    /// Volley Points: a Bonked Hob puffs back at half HP in the lowest free
    /// Nook, and a popped kettle relights at 150, at its side's turn start.
    fn volley_revive(&mut self, side: u8) {
        let s = side as usize;
        if self.castles[s].kettle_hp <= 0 {
            self.castles[s].kettle_hp = 150;
            self.popped[s] = false;
            self.ev(json!({"t": "relight", "side": side, "hp": 150}));
        }
        let down: Vec<u8> = self
            .hobs
            .iter()
            .filter(|h| h.side == side && !h.alive() && !h.dummy)
            .map(|h| h.id)
            .collect();
        for h in down {
            let Some(n) = self.lowest_free_nook(side) else {
                break;
            };
            let hm = &mut self.hobs[h as usize];
            hm.hp = (hm.max / 2).max(1);
            hm.state = HobState::Open;
            hm.nook = Some(n);
            hm.free = (0, 0);
            self.ev(json!({"t": "puff_up", "hob": h, "nook": n, "why": "volley"}));
        }
        self.refresh_hob_states();
    }

    /// Grand Fort rig at the boss's turn start: phase changes, then the
    /// lawn roller rolls and the shears open or snip.
    fn boss_turn(&mut self) {
        let Some(bd) = self.rules.boss.clone() else {
            return;
        };
        let kpct = self.castles[1].kettle_hp.max(0) * 100 / crate::castle::KETTLE_HP;
        // a phase passed during the Squall is skipped
        let squall = self.squall_round() > 0;
        let mut want = 1;
        if kpct < bd.phase2_pct || self.root_round > 0 {
            want = 2;
        }
        if kpct < bd.phase3_pct {
            want = 3;
        }
        if want > self.boss.phase {
            if squall {
                self.boss.phase = want;
            } else {
                for ph in self.boss.phase + 1..=want {
                    self.boss.phase = ph;
                    self.ev(json!({"t": "boss_phase", "phase": ph}));
                    if ph == 2 {
                        if let Some(r) = &bd.roller {
                            self.spawn_roller(r);
                        }
                    }
                    if ph == 3 {
                        if let Some(sh) = &bd.shears {
                            self.spawn_hinge(sh);
                        }
                    }
                }
                // the newly released rig acts from the next boss turn
                return;
            }
        }
        if self.boss.phase >= 2 {
            if let Some(r) = &bd.roller {
                self.roll_roller(r);
            }
        }
        if self.boss.phase >= 3 {
            if let Some(sh) = &bd.shears {
                self.shears_turn(sh);
            }
        }
    }

    fn spawn_roller(&mut self, r: &RollerDef) {
        if self.boss.roller.is_some() {
            return;
        }
        let x = r.x.clamp(0, self.terrain.w - 1);
        let y = self.terrain.surface(x) - 1;
        let id = self.next_id;
        self.next_id += 1;
        self.props.push(Prop {
            id,
            side: 1,
            shot: None,
            x,
            y,
            hp: r.hp,
            max: r.hp,
            kind: "roller".into(),
            tag: "boiler".into(),
            stops_rollers: false,
        });
        self.boss.roller = Some(id);
        self.ev(json!({"t": "roller", "x": x, "y": y, "hp": r.hp}));
    }

    /// Big Smoothie Jr. rolls `step` cells toward the player, carving the
    /// ground down to the flat line behind it. Broken boiler: it stops for
    /// good. Dirt piled over the map's own ground by more than `climb`
    /// cells stops it for this turn.
    fn roll_roller(&mut self, r: &RollerDef) {
        if self.boss.roller_done {
            return;
        }
        let Some(pid) = self.boss.roller else { return };
        let Some(pi) = self.props.iter().position(|p| p.id == pid) else {
            return;
        };
        if self.props[pi].hp <= 0 {
            self.boss.roller_done = true;
            self.ev(json!({"t": "roller_stop", "why": "boiler"}));
            return;
        }
        let flat_y = self.terrain.h - r.flat_height;
        let cs0 = &self.castles[0];
        let stop_x = cs0.x + cs0.width_cells() + 32;
        let from = self.props[pi].x;
        let mut x = from;
        let mut why = "";
        for _ in 0..r.step {
            let nx = x - 1;
            if nx <= stop_x {
                why = "arrived";
                self.boss.roller_done = true;
                break;
            }
            let sy = self.terrain.surface(nx);
            let orig = self.terrain.h - ground_height(&self.level, nx);
            if orig - sy > r.climb {
                why = "mound";
                break;
            }
            x = nx;
            // shave the column down to the flat line
            for y in sy..flat_y {
                let v = self.terrain.get(x, y);
                if v != crate::terrain::AIR && !self.terrain.mats.liquid[v as usize] {
                    self.terrain.set(x, y, crate::terrain::AIR);
                }
            }
        }
        if x != from {
            self.terrain.mark_dirty(x, 0, from, self.terrain.h - 1);
            let castles = self.castles.clone();
            self.terrain.settle(x - 2, from + 2, |cx, cy| {
                castles
                    .iter()
                    .any(|cs| cs.slot_at(cx, cy).is_some_and(|(c, r)| cs.has_block(c, r)))
            });
        }
        let y = self.terrain.surface(x) - 1;
        let p = &mut self.props[pi];
        p.x = x;
        p.y = y;
        self.ev(json!({"t": "roller_move", "from": from, "to": x, "y": y, "why": why}));
    }

    fn spawn_hinge(&mut self, sh: &ShearsDef) {
        if self.boss.hinge.is_some() {
            return;
        }
        let cs = &self.castles[1];
        let x = cs.x + cs.width_cells() / 2;
        let y = cs.top_y() - 1;
        let id = self.next_id;
        self.next_id += 1;
        self.props.push(Prop {
            id,
            side: 1,
            shot: None,
            x,
            y,
            hp: sh.hp,
            max: sh.hp,
            kind: "shears".into(),
            tag: "hinge".into(),
            stops_rollers: false,
        });
        self.boss.hinge = Some(id);
        self.ev(json!({"t": "shears", "x": x, "y": y, "hp": sh.hp}));
    }

    /// The Big Snip: a turn with the cut line shown, then the snip. A broken
    /// hinge jams the shears for `jam_turns` boss turns.
    fn shears_turn(&mut self, sh: &ShearsDef) {
        let Some(hid) = self.boss.hinge else { return };
        let Some(hi) = self.props.iter().position(|p| p.id == hid) else {
            return;
        };
        if self.props[hi].hp <= 0 {
            self.props[hi].hp = sh.hp;
            self.boss.jam = sh.jam_turns;
            self.boss.cut = None;
            self.ev(json!({"t": "shears_jam", "turns": sh.jam_turns}));
        }
        if self.boss.jam > 0 {
            self.boss.jam -= 1;
            return;
        }
        if let Some(cut) = self.boss.cut.take() {
            // snip: every player block inside the cut box breaks
            let mut broke = vec![];
            let cs = &self.castles[0];
            for r in 0..cs.rows {
                for c in 0..cs.cols {
                    if cs.has_block(c, r) && !self.content.materials.blocks[cs.block(c, r).map(|b| b.mat as usize).unwrap_or(0)].never_falls {
                        let b = cs.slot_box(c, r);
                        if b.0 <= cut.2 && b.2 >= cut.0 && b.1 <= cut.3 && b.3 >= cut.1 {
                            broke.push((c, r));
                        }
                    }
                }
            }
            self.begin_ctx(1, None, Some(ShotKind::Knack), false);
            if let Some(c) = self.cur.as_mut() {
                c.shot = Some("shears".into());
            }
            for &(c, r) in &broke {
                let hp = self.castles[0].block(c, r).map(|b| b.hp).unwrap_or(0);
                self.apply_block(1, 0, c, r, hp);
            }
            self.ev(json!({"t": "shears_snip", "blocks": broke.iter().map(|p| json!([p.0, p.1])).collect::<Vec<_>>()}));
            self.after_damage();
            self.finish_ctx();
            return;
        }
        // open: aim at the top rows of the player's tallest column
        let cs = &self.castles[0];
        let mut best: Option<(i32, i32)> = None; // (top row, column)
        for c in 0..cs.cols {
            if let Some(r) = (1..cs.rows).rev().find(|&r| cs.has_block(c, r)) {
                if best.is_none_or(|b| r > b.0 || (r == b.0 && c > b.1)) {
                    best = Some((r, c));
                }
            }
        }
        let Some((top, col)) = best else { return };
        let low = (top - sh.rows + 1).max(1);
        let (x0, y0, x1, _) = cs.slot_box(col, top);
        let (_, _, _, y1) = cs.slot_box(col, low);
        self.boss.cut = Some((x0, y0, x1, y1));
        self.ev(json!({"t": "shears_open", "side": 0, "c": col, "cut": [x0, y0, x1, y1]}));
    }

    fn regrow(&mut self, side: usize) {
        let cs = &self.castles[side];
        let root_stands = cs
            .slots
            .iter()
            .any(|s| matches!(s, Slot::Block(b) if b.root));
        if !root_stands {
            return;
        }
        let content = self.content.clone();
        for r in 1..cs.rows {
            for c in 0..cs.cols {
                let i = cs.idx(c, r);
                if let (Slot::Empty, Slot::Block(ob)) = (&cs.slots[i], &cs.original[i]) {
                    let mut test = cs.clone();
                    test.slots[i] = Slot::Block(ob.clone());
                    if test.solve(&content, &[])[i].is_some() {
                        self.castles[side].slots[i] = Slot::Block(ob.clone());
                        self.ev(json!({"t": "regrow", "side": side, "c": c, "r": r}));
                        return;
                    }
                }
            }
        }
    }

    pub fn end_turn(&mut self) {
        if self.phase == Phase::Ended {
            return;
        }
        let side = self.side;
        self.turns_taken[side as usize] += 1;
        if self.volley > 0 {
            let a = &mut self.actions_left[side as usize];
            *a = (*a - 1).max(0);
        }
        for h in self.hobs.iter_mut() {
            if h.side == side && !h.fired_this_turn && h.rest > 0 {
                h.rest -= 1;
                if h.rest == 0 {
                    h.extra_rest = false;
                }
            }
            if h.side == side && h.fired_this_turn && h.rest > 0 {
                h.rest -= 1;
            }
        }
        self.climb_free_hobs();
        self.refresh_hob_states();
        if self.check_win() {
            return;
        }
        if self.volley > 0 && self.actions_left == [0, 0] {
            let sc = [self.stats[0].score, self.stats[1].score];
            let w = if sc[0] > sc[1] {
                0
            } else if sc[1] > sc[0] {
                1
            } else {
                1 - self.first_side
            };
            self.end_battle(w, "volley_points");
            return;
        }
        let next = 1 - side;
        if next == self.first_side {
            // round end
            let sq = self.squall_round();
            if sq > 0 {
                self.squall_hit(sq);
                if self.phase == Phase::Ended {
                    return;
                }
            }
            if !self.rules.squall && self.round >= self.rules.round_cap && self.volley == 0 {
                let winner = match self.rules.cap_win {
                    Some(w) => w.min(1),
                    None => {
                        let t = [self.total_hp(0), self.total_hp(1)];
                        if t[0] > t[1] {
                            0
                        } else if t[1] > t[0] {
                            1
                        } else {
                            1 - self.first_side
                        }
                    }
                };
                self.end_battle(
                    winner,
                    if self.rules.cap_win.is_some() {
                        "round_cap"
                    } else {
                        "total_hp"
                    },
                );
                return;
            }
            self.round += 1;
            self.round_start();
            // a Fatigue collapse can pop a kettle or Bonk the last Hob
            if self.check_win() {
                return;
            }
        }
        self.begin_turn(next);
    }

    fn round_start(&mut self) {
        if self.round >= FATIGUE_ROUND && !self.castles[0].fatigue {
            for cs in self.castles.iter_mut() {
                cs.fatigue = true;
            }
            self.ev(json!({"t": "fatigue", "round": self.round}));
            for s in 0..2u8 {
                self.resolve_collapse(s);
            }
            self.refresh_hob_states();
            self.update_buried();
        }
        let fr = self.rules.wind.front_rounds.max(1);
        let sq = self.squall_round();
        if sq > 0 {
            let w = if self.wind == 0 {
                self.squall_dir * 3
            } else {
                self.wind + 3 * self.wind.signum()
            };
            self.wind = w.clamp(-10, 10);
            self.ev(json!({"t": "squall_round", "n": sq, "wind": self.wind}));
        } else if (self.round - 1) % fr == 0 {
            let idx = ((self.round - 1) / fr) as usize;
            self.wind = *self.fronts.get(idx).unwrap_or(&0);
            for cs in self.castles.iter_mut() {
                for n in cs.nooks.iter_mut() {
                    n.flap = false;
                }
            }
            self.ev(json!({"t": "front", "wind": self.wind, "forecast": self.forecast()}));
        }
        if let Some(n) = self.squall_warning() {
            self.ev(json!({"t": "squall_warning", "n": n, "text": format!("Squall in {n}")}));
        }
        self.ev(json!({"t": "round_start", "round": self.round}));
    }

    pub fn total_hp(&self, side: u8) -> i64 {
        let cs = &self.castles[side as usize];
        let hobs: i64 = self
            .hobs
            .iter()
            .filter(|h| h.side == side && h.alive())
            .map(|h| h.hp as i64)
            .sum();
        cs.kettle_hp.max(0) as i64 + hobs + cs.standing_hp(&self.content)
    }

    fn squall_hit(&mut self, n: i32) {
        let pre = [self.total_hp(0), self.total_hp(1)];
        let kettle_loss = 50 * n;
        let block_loss = 10 * n;
        self.ev(json!({"t": "squall", "n": n, "kettle": kettle_loss, "blocks": block_loss}));
        let content = self.content.clone();
        self.cur = None;
        for s in 0..2 {
            let cs = &mut self.castles[s];
            cs.kettle_hp -= kettle_loss;
            let mut broke = vec![];
            for r in 0..cs.rows {
                for c in 0..cs.cols {
                    if let Some(b) = cs.block_mut(c, r) {
                        if content.materials.blocks[b.mat as usize].never_falls {
                            continue;
                        }
                        b.hp -= block_loss;
                        if b.hp <= 0 {
                            broke.push((c, r));
                        }
                    }
                }
            }
            for &(c, r) in &broke {
                let i = cs.idx(c, r);
                cs.slots[i] = Slot::Empty;
            }
            self.stats[s].kettle_lost += kettle_loss as i64;
            self.stats[s].blocks_lost += broke.len() as i32;
            self.note_taken(s as u8, kettle_loss);
            for (c, r) in broke {
                self.ev(json!({"t": "break", "side": s, "c": c, "r": r, "why": "squall"}));
            }
        }
        for s in 0..2u8 {
            self.resolve_collapse(s);
        }
        self.refresh_hob_states();
        self.update_buried();
        let pop = [
            self.castles[0].kettle_hp <= 0,
            self.castles[1].kettle_hp <= 0,
        ];
        for (s, popped) in pop.iter().enumerate() {
            if *popped {
                self.kettle_popped(s as u8, None);
            }
        }
        if pop[0] && pop[1] {
            let w = if pre[0] > pre[1] {
                0
            } else if pre[1] > pre[0] {
                1
            } else {
                1 - self.first_side
            };
            self.end_battle(w, "double_pop");
        } else if pop[0] {
            self.end_battle(1, "squall");
        } else if pop[1] {
            self.end_battle(0, "squall");
        } else {
            // the Squall collapse can Bonk the last Hob: a Clean Sweep
            self.check_win();
        }
    }

    /// Checks both win paths. Returns true when the battle ended.
    ///
    /// On a level with an objective (Rescue) the player wins only by the
    /// objective; the rival's kettle or crew does not end the fight. The
    /// player loses when the captive is Bonked or the player's fort falls.
    pub fn check_win(&mut self) -> bool {
        if self.phase == Phase::Ended {
            return true;
        }
        if self.volley > 0 {
            return false;
        }
        let mut lost = [false; 2];
        let mut how = ["", ""];
        for s in 0..2u8 {
            if self.castles[s as usize].kettle_hp <= 0 {
                lost[s as usize] = true;
                how[s as usize] = "kettle_pop";
            } else {
                let crew: Vec<&Hob> = self
                    .hobs
                    .iter()
                    .filter(|h| h.side == s && !h.dummy)
                    .collect();
                if !crew.is_empty() && crew.iter().all(|h| !h.alive()) {
                    lost[s as usize] = true;
                    how[s as usize] = "clean_sweep";
                }
            }
        }
        if let Some(obj) = &self.rules.objective {
            if !lost[0]
                && self
                    .props
                    .iter()
                    .any(|p| p.kind == "captive" && p.hp <= 0)
            {
                self.end_battle(1, "captive_bonked");
                return true;
            }
            let broken = self
                .props
                .iter()
                .filter(|p| p.tag == obj.tag && p.hp <= 0)
                .count() as i32;
            if broken >= obj.count && !lost[0] {
                self.end_battle(0, "rescue");
                return true;
            }
            lost[1] = false;
        }
        if lost[0] && lost[1] {
            let pre = self.cur.as_ref().map(|c| c.pre_total).unwrap_or([0, 0]);
            let w = if pre[0] > pre[1] {
                0
            } else if pre[1] > pre[0] {
                1
            } else {
                1 - self.first_side
            };
            self.end_battle(w, "double_pop");
            return true;
        }
        for s in 0..2 {
            if lost[s] {
                self.end_battle(1 - s as u8, how[s]);
                return true;
            }
        }
        false
    }

    pub fn end_battle(&mut self, winner: u8, how: &str) {
        if self.phase == Phase::Ended {
            return;
        }
        self.actors.clear();
        self.phase = Phase::Ended;
        // Siege Score extras (not in Volley Points)
        if self.volley == 0 {
            for s in 0..2 {
                self.stats[s].score += 50 * (self.rules.round_cap - self.round).max(0) as i64;
                if self.stats[s].own_bonked == 0 {
                    self.stats[s].score += 200;
                }
            }
        }
        let pennants = self.pennants(winner, how);
        let had = &self.progress.pennants;
        let pennants_new: Vec<bool> = pennants
            .iter()
            .enumerate()
            .map(|(i, p)| *p && !had.get(i).copied().unwrap_or(false))
            .collect();
        let buttons = self.buttons(winner, how, &pennants, &pennants_new);
        let broke = self.broke_summary(1 - winner, how);
        self.result = Some(Outcome {
            winner,
            how: how.into(),
            round: self.round,
            pennants: pennants.clone(),
            pennants_new: pennants_new.clone(),
            buttons,
            broke: broke.clone(),
        });
        self.ev(json!({"t": "win", "winner": winner, "how": how, "round": self.round, "pennants": pennants, "pennants_new": pennants_new, "buttons": buttons}));
    }

    /// Buttons the player (side 0) earns: canon 5.2 earn rates, numbers from
    /// app.json `rewards`. Couch Duel, Skirmish and Test Yard pay nothing.
    fn buttons(&self, winner: u8, how: &str, pennants: &[bool], new: &[bool]) -> i32 {
        let c = &self.content;
        let won = winner == 0;
        let gf = self.level.kind == "grand_fort";
        match self.mode.as_str() {
            "campaign" => {
                if !won {
                    return c.reward("loss");
                }
                let _ = how;
                if self.progress.cleared {
                    let base = c.reward(if gf { "replay_grand_fort" } else { "replay" });
                    base + c.reward("per_new_pennant") * new.iter().filter(|x| **x).count() as i32
                } else {
                    let base = c.reward(if gf { "first_clear_grand_fort" } else { "first_clear" });
                    base + c.reward("per_pennant") * pennants.iter().filter(|x| **x).count() as i32
                }
            }
            "daily" => {
                if won && !self.progress.daily_paid {
                    c.reward("daily")
                } else {
                    0
                }
            }
            _ => 0,
        }
    }

    /// "What broke you": for the losing side, the shots that hurt it most,
    /// the last blow, and what it lost.
    pub fn broke_summary(&self, side: u8, how: &str) -> Value {
        let st = &self.stats[side as usize];
        let mut top = st.taken.clone();
        top.sort_by(|a, b| b.2.cmp(&a.2).then(a.0.cmp(&b.0)).then(a.1.cmp(&b.1)));
        let name = |h: i32| -> Value {
            if h >= 0 {
                self.hobs
                    .get(h as usize)
                    .map(|x| json!(x.name))
                    .unwrap_or(Value::Null)
            } else {
                Value::Null
            }
        };
        let shot_name = |id: &str| -> Value {
            self.content
                .shot(id)
                .map(|d| json!(d.name))
                .unwrap_or(json!(id))
        };
        let last = st.last_blow.as_ref().map(|(sh, h, r)| {
            json!({"shot": sh, "shot_name": shot_name(sh), "hob": if *h >= 0 { json!(h) } else { Value::Null }, "hob_name": name(*h), "round": r})
        });
        json!({
            "side": side,
            "how": how,
            "last": last,
            "top": top.iter().take(3).map(|(sh, h, d)| json!({"shot": sh, "shot_name": shot_name(sh), "hob": if *h >= 0 { json!(h) } else { Value::Null }, "hob_name": name(*h), "dmg": d})).collect::<Vec<_>>(),
            "kettle_lost": st.kettle_lost,
            "blocks_lost": st.blocks_lost,
            "hobs_bonked": st.own_bonked,
        })
    }

    fn pennants(&self, winner: u8, how: &str) -> Vec<bool> {
        let won = winner == 0;
        let st = &self.stats[0];
        self.level
            .pennants
            .iter()
            .map(|p| {
                won && match p.kind.as_str() {
                    "win" => true,
                    "win_by_round" => self.round <= p.value,
                    "no_hob_bonked" => st.own_bonked == 0,
                    "kettle_above_pct" => {
                        self.castles[0].kettle_hp * 100 > p.value * crate::castle::KETTLE_HP
                    }
                    "hits_in_a_row" => st.best_streak >= p.value,
                    "kettle_pop" => how == "kettle_pop",
                    "bonk_with_each_hob" => {
                        let mine: Vec<&String> = self
                            .hobs
                            .iter()
                            .filter(|h| h.side == 0)
                            .map(|h| &h.def)
                            .collect();
                        mine.iter().all(|d| st.bonked_by_hob.contains(d))
                    }
                    "bonk_with_knack" => st.bonk_with_knack,
                    "bonk_with_trick" => st.bonk_with_trick,
                    "use_tricks" => st.tricks_used >= p.value,
                    "hits_from_spots" => st.hit_spots.len() as i32 >= p.value,
                    "captive_safe" => self
                        .props
                        .iter()
                        .filter(|x| x.kind == "captive")
                        .all(|x| x.hp >= x.max),
                    "root_by_round" => self.root_round > 0 && self.root_round <= p.value,
                    "hill_half" => {
                        let now: i64 = (0..self.terrain.w)
                            .step_by(8)
                            .map(|x| (self.terrain.h - self.terrain.surface(x)) as i64)
                            .sum();
                        now * 100 >= self.hill_start * p.value.max(1) as i64
                    }
                    _ => false,
                }
            })
            .collect()
    }

    // ---------------------------------------------------------------- crew

    pub fn update_buried(&mut self) {
        for i in 0..self.hobs.len() {
            let h = &self.hobs[i];
            if !h.alive() {
                continue;
            }
            let Some(n) = h.nook else {
                self.hobs[i].buried = false;
                continue;
            };
            let cs = &self.castles[h.side as usize];
            let (x0, y0, x1, y1) = cs.loophole_rect(&cs.nooks[n as usize]);
            let mut solid = 0;
            let mut total = 0;
            // only ground Shove Off can clear counts as a burial
            for y in y0..=y1 {
                for x in x0..=x1 {
                    total += 1;
                    if self.terrain.diggable(x, y) {
                        solid += 1;
                    }
                }
            }
            let buried = solid * 2 >= total;
            let was = self.hobs[i].buried;
            let side = self.hobs[i].side as usize;
            self.hobs[i].buried = buried;
            if buried && !was {
                self.castles[side].nooks[n as usize].buried_tick = self.tick;
                let id = self.hobs[i].id;
                self.ev(json!({"t": "buried", "hob": id}));
            }
        }
    }

    /// Clears the ground in front of a Hob's Loophole. Returns the cells cleared.
    pub fn clear_loophole(&mut self, hob: u8) -> i64 {
        let h = &self.hobs[hob as usize];
        let mut n = 0;
        if let Some(nk) = h.nook {
            let cs = &self.castles[h.side as usize];
            let (x0, y0, x1, y1) = cs.loophole_rect(&cs.nooks[nk as usize]);
            let d = cs.front_dir();
            let (ax, bx) = if d > 0 { (x0, x1 + 24) } else { (x0 - 24, x1) };
            n = self.terrain.clear_rect(ax, y0 - 4, bx, y1 + 4);
        }
        self.update_buried();
        n
    }

    /// Seated or Open from the Nook walls (transient states are kept).
    pub fn refresh_hob_states(&mut self) {
        for i in 0..self.hobs.len() {
            let h = &self.hobs[i];
            if !h.alive()
                || matches!(
                    h.state,
                    HobState::Dropped | HobState::Tumbled | HobState::Squashed
                )
            {
                continue;
            }
            let st = match h.nook {
                Some(n) => {
                    let cs = &self.castles[h.side as usize];
                    let excuse = self.broad_back_excuse(h.id);
                    if cs.room_intact(&cs.nooks[n as usize], excuse) && !self.skewered(h.id) {
                        HobState::Seated
                    } else {
                        HobState::Open
                    }
                }
                None => HobState::Open,
            };
            self.hobs[i].state = st;
        }
    }

    fn skewered(&self, _h: u8) -> bool {
        false
    }

    /// Grub's Broad Back: the Hob behind a seated Grub keeps Cover when their
    /// shared wall breaks.
    pub fn broad_back_excuse(&self, hob: u8) -> bool {
        let h = &self.hobs[hob as usize];
        let Some(n) = h.nook else { return false };
        let cs = &self.castles[h.side as usize];
        let me = &cs.nooks[n as usize];
        let d = cs.front_dir();
        self.hobs.iter().any(|g| {
            g.side == h.side
                && g.alive()
                && g.has_passive(|p| matches!(p, Passive::BroadBack))
                && matches!(g.state, HobState::Seated | HobState::Open)
                && g.nook.is_some_and(|gn| {
                    let gr = &cs.nooks[gn as usize];
                    gr.r == me.r && gr.c == me.c + 3 * d
                })
        })
    }

    /// Nooks next door to a Hob's Nook (sharing a wall, no room between).
    pub fn next_door(&self, hob: u8) -> Vec<u8> {
        let h = &self.hobs[hob as usize];
        let Some(n) = h.nook else { return vec![] };
        let cs = &self.castles[h.side as usize];
        let me = &cs.nooks[n as usize];
        self.hobs
            .iter()
            .filter(|o| o.id != hob && o.side == h.side && o.alive())
            .filter(|o| {
                o.nook.is_some_and(|on| {
                    let r = &cs.nooks[on as usize];
                    (r.r == me.r && (r.c - me.c).abs() == 3)
                        || (r.c == me.c && (r.r - me.r).abs() == 3)
                })
            })
            .map(|o| o.id)
            .collect()
    }

    /// Ridgepole slots held up by a seated Hetty.
    pub fn held_slots(&self, side: u8) -> Vec<(i32, i32)> {
        let mut out = vec![];
        let cs = &self.castles[side as usize];
        for h in &self.hobs {
            if h.side == side
                && h.alive()
                && h.has_passive(|p| matches!(p, Passive::Ridgepole))
                && matches!(
                    h.state,
                    HobState::Seated | HobState::Open | HobState::Squashed
                )
            {
                if let Some(n) = h.nook {
                    let room = &cs.nooks[n as usize];
                    for r in room.r + 2..cs.rows {
                        out.push((room.c, r));
                        out.push((room.c + 1, r));
                    }
                }
            }
        }
        out
    }

    fn climb_free_hobs(&mut self) {
        for i in 0..self.hobs.len() {
            let h = &self.hobs[i];
            if !h.alive() {
                continue;
            }
            if h.nook.is_none() {
                let side = h.side;
                if let Some(n) = self.lowest_free_nook(side) {
                    self.hobs[i].nook = Some(n);
                    let id = self.hobs[i].id;
                    self.ev(json!({"t": "climb", "hob": id, "nook": n}));
                }
            }
            if matches!(
                self.hobs[i].state,
                HobState::Dropped | HobState::Tumbled | HobState::Squashed
            ) {
                self.hobs[i].state = HobState::Open;
            }
        }
        self.update_buried();
    }

    pub fn lowest_free_nook(&self, side: u8) -> Option<u8> {
        let cs = &self.castles[side as usize];
        let mut best: Option<(i32, i32, u8)> = None;
        for (i, n) in cs.nooks.iter().enumerate() {
            let taken = self
                .hobs
                .iter()
                .any(|h| h.side == side && h.alive() && h.nook == Some(i as u8));
            let floor_ok = n.r == 0 || cs.has_block(n.c, n.r - 1) || cs.has_block(n.c + 1, n.r - 1);
            if !taken && floor_ok {
                let k = (n.r, n.c, i as u8);
                if best.is_none_or(|b| (k.0, k.1) < (b.0, b.1)) {
                    best = Some(k);
                }
            }
        }
        best.map(|b| b.2)
    }

    // ---------------------------------------------------------------- firing

    pub fn can_fire_hob(&self, side: u8, hob: u8) -> bool {
        let Some(h) = self.hobs.get(hob as usize) else {
            return false;
        };
        if h.side != side || !h.alive() || h.dummy || h.buried {
            return false;
        }
        if h.rest == 0 {
            return true;
        }
        // all resting: the lowest Rest Hob may fire a Plain Shot
        let live: Vec<&Hob> = self
            .hobs
            .iter()
            .filter(|o| o.side == side && o.alive() && !o.dummy && !o.buried)
            .collect();
        if live.iter().all(|o| o.rest > 0) {
            let min = live.iter().map(|o| o.rest).min().unwrap_or(0);
            let first = live.iter().find(|o| o.rest == min).map(|o| o.id);
            return first == Some(hob);
        }
        false
    }

    /// Resolve the shot id for a selection.
    pub fn shot_for(&self, hob: u8, which: &str) -> Option<String> {
        let h = self.hobs.get(hob as usize)?;
        match which {
            "plain" => Some(h.plain.clone()),
            "knack" => h.knack.clone(),
            other => Some(other.to_string()),
        }
    }

    pub fn launch_point(&self, hob: u8) -> (i32, i32) {
        let (x, y) = self.hob_feet(hob);
        (x, y - 16)
    }

    pub fn make_actor(&mut self, side: u8, shot: usize, x: Fx, y: Fx, vx: Fx, vy: Fx) -> Actor {
        let id = self.next_id;
        self.next_id += 1;
        let f = &self.content.shots[shot].flight;
        Actor {
            id,
            side,
            shot,
            x,
            y,
            vx,
            vy,
            mode: Mode::Fly,
            gravity_pct: f.gravity_pct,
            age: 0,
            bounces: 0,
            bored: 0,
            blocks_bored: 0,
            in_ground: false,
            passes: f.pass_blocks,
            passed_block: false,
            bent: 0,
            rolled: 0,
            roll_speed: 0,
            apex_done: false,
            skip: None,
            done: false,
            probe: false,
            root: false,
            // canon 8.1: a Cozy Rival never Threads a Loophole
            threads: self.content.shots[shot].has_tag("threads")
                && self.control[side as usize] != Control::Ai(Preset::Cozy),
        }
    }

    pub fn probe_actor_at(&mut self, side: u8, shot: usize, x: i32, y: i32) -> Actor {
        self.make_actor(side, shot, fx(x), fx(y), 0, 0)
    }

    pub fn launch_velocity(&self, shot: usize, angle: i32, power: i32) -> (Fx, Fx) {
        let f = &self.content.shots[shot].flight;
        let v = (power.clamp(0, 100) as i64 * f.speed_pct as i64 * FX_ONE as i64 / 1000) as i32;
        let vx = fx_mul(v, cos_t(angle));
        let vy = -fx_mul(v, sin_t(angle));
        (vx, vy)
    }

    /// A probe actor for the selected shot, no side effects on state.
    pub fn aim_probe(&self, side: u8, hob: u8, shot: usize, angle: i32, power: i32) -> Actor {
        let (lx, ly) = self.launch_point(hob);
        let (vx, vy) = self.launch_velocity(shot, angle, power);
        let f = &self.content.shots[shot].flight;
        Actor {
            id: 0,
            side,
            shot,
            x: fx(lx),
            y: fx(ly),
            vx,
            vy,
            mode: Mode::Fly,
            gravity_pct: f.gravity_pct,
            age: 0,
            bounces: 0,
            bored: 0,
            blocks_bored: 0,
            in_ground: false,
            passes: f.pass_blocks,
            passed_block: false,
            bent: 0,
            rolled: 0,
            roll_speed: 0,
            apex_done: false,
            skip: None,
            done: false,
            probe: true,
            root: true,
            threads: false,
        }
    }

    pub fn begin_ctx(&mut self, side: u8, hob: Option<u8>, kind: Option<ShotKind>, heavy: bool) {
        let full: Vec<bool> = self.hobs.iter().map(|h| h.hp >= h.max).collect();
        let n = self.hobs.len();
        self.cur = Some(ShotCtx {
            side,
            hob,
            kind,
            bonus_pct: 100,
            thread_bonus: 100,
            hob_start_full: full,
            hob_dealt: vec![0; n],
            heavy,
            pre_total: [self.total_hp(0), self.total_hp(1)],
            skill_pct: 100,
            ..Default::default()
        });
    }

    pub fn finish_ctx(&mut self) {
        self.cur = None;
    }

    fn fire(&mut self, dial: Option<String>, target: Option<(i32, i32)>) -> Value {
        if self.phase != Phase::Plan {
            return err("not_planning");
        }
        if self.acted {
            return err("already_acted");
        }
        let side = self.side;
        let s = side as usize;
        let sel = self.sel[s].clone();
        if !self.can_fire_hob(side, sel.hob) {
            return err("hob_cannot_fire");
        }
        let all_resting = self.hobs[sel.hob as usize].rest > 0;
        if all_resting && sel.shot != "plain" {
            return err("resting_plain_only");
        }
        let Some(shot_id) = self.shot_for(sel.hob, &sel.shot) else {
            return err("no_shot");
        };
        let Some(shot) = self.shot_index(&shot_id) else {
            return err("unknown_shot");
        };
        let def = self.content.shots[shot].clone();
        let h = self.hobs[sel.hob as usize].clone();
        if self.volley > 0 && self.actions_left[s] <= 0 {
            return err("no_actions_left");
        }
        match sel.shot.as_str() {
            "plain" => {}
            "knack" => {
                if h.knack_uses <= 0 {
                    return err("no_knack_uses");
                }
            }
            t => {
                if !self.hands[s].iter().any(|x| x == t) {
                    return err("not_in_hand");
                }
            }
        }
        if def.weight == Weight::H && self.turns_taken[s] == 0 && side == self.first_side {
            return err("no_heavy_first_turn");
        }
        if let Some(d) = &dial {
            let hop_ok = d == "hops3"
                && h.has_passive(|p| matches!(p, Passive::HopDial { .. }))
                && sel.shot == "plain";
            if !def.dials.contains(d) && !hop_ok {
                return err("bad_dial");
            }
            if d == "puff_up" && (!self.puff_up_allowed[s] || self.puff_up_used[s]) {
                return err("puff_up_not_allowed");
            }
        }
        // a self shot that would do nothing is refused before anything is paid
        let self_target = def.flight.kind == FlightKind::SelfTarget;
        if self_target || (target.is_some() && !def.self_effects.is_empty()) {
            self.cur = Some(ShotCtx {
                dial: dial.clone(),
                ..Default::default()
            });
            let effs: Vec<Effect> = if self_target {
                self.triggers(shot, TriggerOn::Fire)
            } else {
                def.self_effects.clone()
            };
            self.cur = None;
            if let Some(why) = self.self_shot_useless(side, &effs, target) {
                return err(why);
            }
        }
        let is_match =
            def.kind == ShotKind::Trick && def.match_class.as_deref() == Some(h.class.as_str());
        // pay
        match sel.shot.as_str() {
            "plain" => {}
            "knack" => self.hobs[sel.hob as usize].knack_uses -= 1,
            t => {
                if let Some(p) = self.hands[s].iter().position(|x| x == t) {
                    self.hands[s].remove(p);
                }
                self.stats[s].tricks_used += 1;
            }
        }
        let rest = if is_match { 0 } else { def.weight.rest() };
        {
            // firing never lowers Rest: a resting Hob's Plain Shot keeps its cog
            let hm = &mut self.hobs[sel.hob as usize];
            hm.rest = hm.rest.max(if rest > 0 { rest + 1 } else { 0 });
            hm.fired_this_turn = true;
        }
        self.acted = true;
        self.stats[s].shots += 1;
        self.begin_ctx(side, Some(sel.hob), Some(def.kind), def.weight == Weight::H);
        if let Some(c) = self.cur.as_mut() {
            c.shot = Some(shot_id.clone());
            c.skill_pct = def.skill_pct;
        }
        let (angle, power) = (h.angle, h.power);
        if let Some(c) = self.cur.as_mut() {
            if is_match {
                c.bonus_pct += 10;
            }
            if h.clatter {
                c.bonus_pct += 15;
            }
            if let Some(Passive::ThreadBonus { pct }) = &h.passive {
                c.thread_bonus = 100 + pct;
            }
            if h.grudge && sel.shot == "plain" {
                c.band_up = true;
            }
            c.dial = dial.clone();
        }
        if h.clatter {
            self.hobs[sel.hob as usize].clatter = false;
        }
        if h.grudge && sel.shot == "plain" {
            self.hobs[sel.hob as usize].grudge = false;
        }
        let castle_x = self.castles[s].x;
        self.ev(json!({"t": "fire", "side": side, "hob": sel.hob, "shot": shot_id, "angle": angle, "power": power, "dial": dial}));
        self.ghosts.push(Ghost {
            side,
            hob: sel.hob,
            shot: shot_id.clone(),
            angle,
            power,
            points: vec![],
            pin: None,
            self_hit: false,
            recalled: false,
            round: self.round,
        });
        self.fire_x = castle_x;
        // self targeted shots and Knacks with no flight: an exact dial
        // trigger replaces the plain one (Puff Up instead of Rebuild)
        if self_target || (target.is_some() && !def.self_effects.is_empty()) {
            let effs: Vec<Effect> = if self_target {
                self.triggers(shot, TriggerOn::Fire)
            } else {
                def.self_effects.clone()
            };
            let (lx, ly) = self.launch_point(sel.hob);
            let a = self.probe_actor_at(side, shot, lx, ly);
            self.self_target = target;
            self.run_effects(&effs, &a, lx, ly, None, false);
            self.self_target = None;
            self.phase = Phase::Settle(SETTLE_TICKS);
            return ok();
        }
        let (lx, ly) = self.launch_point(sel.hob);
        let (vx, vy) = self.launch_velocity(shot, angle, power);
        let mut a = self.make_actor(side, shot, fx(lx), fx(ly), vx, vy);
        a.root = true;
        if let Some(d) = &dial {
            if d == "hops3" {
                a.bounces = -1; // one extra hop before the count starts
            }
        }
        self.phase = Phase::Resolve;
        let launch: Vec<Effect> = def
            .triggers
            .iter()
            .filter(|t| t.on == TriggerOn::Launch)
            .flat_map(|t| t.effects.clone())
            .collect();
        self.actors.push(a.clone());
        if !launch.is_empty() {
            let idx = self.actors.len() - 1;
            self.run_effects(&launch, &a, lx, ly, None, false);
            // the split may have ended the parent
            if let Some(p) = self.actors.iter().position(|x| x.id == a.id) {
                let _ = idx;
                if self.actors[p].done {
                    self.actors.remove(p);
                }
            }
        }
        ok()
    }

    /// Why a self shot would do nothing, or None when it does something.
    fn self_shot_useless(
        &self,
        side: u8,
        effs: &[Effect],
        target: Option<(i32, i32)>,
    ) -> Option<&'static str> {
        let s = side as usize;
        let cs = &self.castles[s];
        let held = self.held_slots(side);
        let rebuildable = |i: usize| -> bool {
            if let (Slot::Empty, Slot::Block(ob)) = (&cs.slots[i], &cs.original[i]) {
                let mut test = cs.clone();
                test.slots[i] = Slot::Block(ob.clone());
                test.solve(&self.content, &held)[i].is_some()
            } else {
                false
            }
        };
        for e in effs {
            match e {
                Effect::Rebuild { .. } => {
                    if (0..cs.slots.len()).any(rebuildable) {
                        return None;
                    }
                }
                Effect::PuffUp { .. } => {
                    let down = self
                        .hobs
                        .iter()
                        .any(|h| h.side == side && !h.alive() && !h.dummy);
                    if self.puff_up_allowed[s]
                        && !self.puff_up_used[s]
                        && down
                        && self.lowest_free_nook(side).is_some()
                    {
                        return None;
                    }
                }
                Effect::Mend { .. } => {
                    let Some((c, r)) = target else {
                        return Some("bad_target");
                    };
                    if !cs.in_grid(c, r) {
                        return Some("bad_target");
                    }
                    if cs.block(c, r).is_some_and(|b| b.hp < b.max)
                        || rebuildable(cs.idx(c, r))
                        || self.hobs.iter().any(|h| h.side == side && h.buried)
                    {
                        return None;
                    }
                }
                _ => return None,
            }
        }
        Some(if effs.iter().any(|e| matches!(e, Effect::PuffUp { .. })) {
            "no_one_to_puff_up"
        } else {
            "nothing_to_mend"
        })
    }

    /// Ground top under a column for a fort whose Footing bottom sits at
    /// `base_y`: climbs from the base through solid ground (never from the
    /// sky down, so dirt on the roof is not ground), or falls to the first
    /// solid cell below. None when the climb is higher than `WALK_CLIMB`.
    fn ground_under(&self, x: i32, base_y: i32) -> Option<i32> {
        if self.terrain.blocks_shell(x, base_y - 1) {
            let mut y = base_y - 1;
            while self.terrain.blocks_shell(x, y - 1) {
                y -= 1;
                if base_y - y > WALK_CLIMB {
                    return None;
                }
            }
            Some(y)
        } else {
            Some(self.terrain.surface_below(x, base_y))
        }
    }

    fn walk(&mut self, dx: i32) -> Value {
        if self.phase != Phase::Plan || self.acted {
            return err("cannot_walk_now");
        }
        let s = self.side as usize;
        let dir = dx.signum();
        if dir == 0 {
            return ok();
        }
        let steps = dx.clamp(-self.terrain.w, self.terrain.w).abs() / 4;
        let mut thumps = 0;
        let mut moved = 0;
        let mut spent = 0;
        let start = (self.castles[s].x, self.castles[s].base_y);
        for _ in 0..steps {
            let cs = &self.castles[s];
            let nx = cs.x + 4 * dir;
            let w = cs.width_cells();
            if nx < 0 || nx + w > self.terrain.w {
                break;
            }
            let other = &self.castles[1 - s];
            let gap_ok = if s == 0 {
                nx + w + 64 <= other.x
            } else {
                nx >= other.x + other.width_cells() + 64
            };
            if !gap_ok {
                break;
            }
            let mut ny = i32::MAX;
            let mut too_steep = false;
            for x in nx..nx + w {
                match self.ground_under(x, cs.base_y) {
                    Some(y) => ny = ny.min(y),
                    None => too_steep = true,
                }
            }
            if too_steep || ny == i32::MAX || ny - cs.base_y > WALK_DROP {
                break;
            }
            let water = (nx..nx + w).any(|x| {
                let v = self.terrain.get(x, ny);
                v != 255 && self.terrain.mats.liquid[v as usize]
            });
            if water {
                break;
            }
            let mud_code = self.content.terrain_code("mud");
            let mud = mud_code != 0 && (nx..nx + w).any(|x| self.terrain.get(x, ny) == mud_code);
            let mut cost = if ny < cs.base_y { 2 } else { 1 };
            if mud {
                cost = 3;
            }
            if cs.steam < cost || cs.steam_turn + cost > STEAM_PER_TURN {
                break;
            }
            let drop = ny - cs.base_y;
            let cs = &mut self.castles[s];
            cs.steam -= cost;
            cs.steam_turn += cost;
            spent += cost;
            let old_x = cs.x;
            cs.x = nx;
            cs.base_y = ny;
            moved += 4 * dir;
            // dirt that rested on the fort settles in the old and new footprint
            let castles = self.castles.clone();
            self.terrain.settle(old_x.min(nx) - 2, old_x.max(nx) + w + 2, |cx, cy| {
                castles
                    .iter()
                    .any(|c| c.slot_at(cx, cy).is_some_and(|(cc, rr)| c.has_block(cc, rr)))
            });
            if drop > THUMP_DROP {
                thumps += 1;
                break;
            }
        }
        if moved == 0 {
            return err("cannot_walk_there");
        }
        let end = (self.castles[s].x, self.castles[s].base_y);
        self.update_buried();
        self.ai_mem[s].own_walked = true;
        self.ai_mem[1 - s].target_walked += moved.abs();
        self.ev(json!({"t": "walk", "side": s, "from": [start.0, start.1], "to": [end.0, end.1], "steam": spent}));
        if thumps > 0 {
            self.walk_thump(s);
        }
        json!({"ok": true, "moved": moved, "steam": spent})
    }

    /// Walking off a drop of more than 48 cells: a Thump (10 to every block
    /// and Hob of that fort).
    fn walk_thump(&mut self, s: usize) {
        self.ev(json!({"t": "thump", "side": s}));
        let mut broke = vec![];
        let footing = |b: &crate::castle::Block| self.content.materials.blocks[b.mat as usize].never_falls;
        let cs = &self.castles[s];
        for r in 0..cs.rows {
            for c in 0..cs.cols {
                if let Some(b) = cs.block(c, r) {
                    if !footing(b) {
                        broke.push((c, r));
                    }
                }
            }
        }
        self.cur = None;
        for (c, r) in broke {
            self.apply_block(2, s as u8, c, r, 10);
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
        self.after_damage();
    }

    fn shove_off(&mut self, hob: u8) -> Value {
        if self.phase != Phase::Plan || self.acted {
            return err("cannot_shove_now");
        }
        let s = self.side as usize;
        let Some(h) = self.hobs.get(hob as usize) else {
            return err("no_hob");
        };
        if h.side as usize != s || !h.alive() || !h.buried {
            return err("not_buried");
        }
        let cs = &self.castles[s];
        if cs.steam < SHOVE_OFF || cs.steam_turn + SHOVE_OFF > STEAM_PER_TURN {
            return err("not_enough_steam");
        }
        if self.clear_loophole(hob) == 0 {
            return err("not_buried");
        }
        self.castles[s].steam -= SHOVE_OFF;
        self.castles[s].steam_turn += SHOVE_OFF;
        self.ev(json!({"t": "shove_off", "hob": hob}));
        ok()
    }

    fn use_doodad(&mut self, id: &str, v: &Value) -> Value {
        if self.phase != Phase::Plan || self.acted {
            return err("cannot_use_now");
        }
        let s = self.side as usize;
        if self.volley > 0 && self.actions_left[s] <= 0 {
            return err("no_actions_left");
        }
        let Some(pos) = self.doodads[s].iter().position(|d| d == id) else {
            return err("no_doodad");
        };
        let Some(def) = self.content.doodad(id).cloned() else {
            return err("unknown_doodad");
        };
        match def.effect {
            DoodadEffect::MendBlocks { count, hp } => {
                let mut targets: Vec<(i32, i32)> = vec![];
                if let Some(a) = v.get("targets") {
                    let Some(a) = a.as_array() else {
                        return err_d("bad_value", "targets must be a list of [c, r]");
                    };
                    for t in a {
                        let p = (
                            t.get(0).and_then(|x| num_at(x, 0, 63)),
                            t.get(1).and_then(|x| num_at(x, 0, 63)),
                        );
                        match p {
                            (Some(c), Some(r)) => targets.push((c, r)),
                            _ => return err_d("bad_value", "targets must be a list of [c, r]"),
                        }
                    }
                }
                let cs = &self.castles[s];
                targets.retain(|&(c, r)| cs.block(c, r).is_some_and(|b| b.hp < b.max));
                if targets.is_empty() && v.get("targets").is_none() {
                    let mut hurt: Vec<(i32, i32, i32)> = vec![];
                    for r in 0..cs.rows {
                        for c in 0..cs.cols {
                            if let Some(b) = cs.block(c, r) {
                                if b.hp < b.max {
                                    hurt.push((b.hp - b.max, c, r));
                                }
                            }
                        }
                    }
                    hurt.sort();
                    targets = hurt.iter().map(|x| (x.1, x.2)).collect();
                }
                targets.truncate(count as usize);
                if targets.is_empty() {
                    return err("nothing_to_mend");
                }
                let mut done = vec![];
                for (c, r) in targets {
                    if let Some(b) = self.castles[s].block_mut(c, r) {
                        b.hp = (b.hp + hp).min(b.max);
                        b.peephole = false;
                        done.push(json!([c, r]));
                    }
                }
                self.ev(json!({"t": "mend", "side": s, "blocks": done, "doodad": id}));
            }
            DoodadEffect::Lid => {
                let room = v["room"].as_str().unwrap_or("kettle");
                if room == "kettle" {
                    self.castles[s].kettle.lid = true;
                } else {
                    let n: usize = room
                        .strip_prefix("nook:")
                        .and_then(|x| x.parse().ok())
                        .unwrap_or(usize::MAX);
                    if n >= self.castles[s].nooks.len() {
                        return err("bad_room");
                    }
                    self.castles[s].nooks[n].lid = true;
                }
                self.ev(json!({"t": "lid", "side": s, "room": room}));
            }
        }
        self.doodads[s].remove(pos);
        self.acted = true;
        self.phase = Phase::Settle(SETTLE_TICKS);
        ok()
    }

    // ---------------------------------------------------------------- stepping

    pub fn step(&mut self, ticks: i32) {
        for _ in 0..ticks.max(0) {
            match self.phase {
                Phase::Resolve => {
                    self.tick += 1;
                    self.resolve_tick();
                }
                Phase::Settle(n) => {
                    self.tick += 1;
                    if n <= 1 {
                        self.finish_shot();
                    } else {
                        self.phase = Phase::Settle(n - 1);
                    }
                }
                _ => return,
            }
        }
    }

    /// Step tick by tick until the shot is resolved and the turn has passed,
    /// including the full settle, exactly as a live app stepping at 120 Hz.
    pub fn run_until_plan(&mut self, max_ticks: i32) -> i32 {
        let mut n = 0;
        while matches!(self.phase, Phase::Resolve | Phase::Settle(_)) && n < max_ticks {
            self.step(1);
            n += 1;
        }
        n
    }

    /// AI sims only: like `run_until_plan` but the settle (60 quiet ticks) is
    /// cut to one tick. The tick count differs, so never use it on a live
    /// battle.
    pub fn run_until_plan_fast(&mut self, max_ticks: i32) -> i32 {
        let mut n = 0;
        while matches!(self.phase, Phase::Resolve | Phase::Settle(_)) && n < max_ticks {
            if let Phase::Settle(_) = self.phase {
                self.phase = Phase::Settle(1);
            }
            self.step(1);
            n += 1;
        }
        n
    }

    fn finish_shot(&mut self) {
        // stats and pennant tracking
        if let Some(c) = self.cur.clone() {
            let s = c.side as usize;
            if c.hit_enemy {
                self.stats[s].streak += 1;
                self.stats[s].hits += 1;
                self.stats[s].best_streak = self.stats[s].best_streak.max(self.stats[s].streak);
                let x = self.fire_x;
                if !self.stats[s].hit_spots.iter().any(|p| (p - x).abs() < 32) {
                    self.stats[s].hit_spots.push(x);
                }
            } else if c.kind.is_some() {
                self.stats[s].streak = 0;
                if let Control::Ai(_) = self.control[s] {
                    self.ai_misses[s] += 1;
                }
            }
            if let Control::Ai(_) = self.control[s] {
                self.ai_shots[s] += 1;
            }
            if let Some(g) = self.ghosts.iter_mut().rev().find(|g| g.side == c.side) {
                g.pin = c.pin;
                g.self_hit = c.self_hit;
            }
            if let Some(pin) = c.pin {
                self.ai_mem[s].last_pin = Some(pin);
            }
        }
        // keep the last two ghosts per Hob
        let mut keep: Vec<Ghost> = vec![];
        for g in self.ghosts.iter().rev() {
            if keep
                .iter()
                .filter(|k| k.side == g.side && k.hob == g.hob)
                .count()
                < 2
            {
                keep.push(g.clone());
            }
        }
        keep.reverse();
        self.ghosts = keep;
        self.first_shot_done[self.side as usize] = true;
        self.cur = None;
        if !self.check_win() {
            self.end_turn();
        }
    }

    // ---------------------------------------------------------------- commands

    pub fn command(&mut self, v: &Value) -> Value {
        if !v.is_object() {
            return err_d("bad_json", "a command is a JSON object");
        }
        let cmd = v["cmd"].as_str().unwrap_or("");
        let res = self.command_inner(cmd, v);
        let ok = res["ok"] == json!(true);
        if ok {
            match cmd {
                "aim" => self.snap_aim = true,
                "ai_turn" | "resume" => self.snap_full = true,
                c if is_logged(c) => self.snap_full = true,
                _ => {}
            }
        }
        if ok && is_logged(cmd) && self.logging {
            self.push_log(cmd, v);
        }
        res
    }

    /// Adds an accepted command to the log. A run of `aim` commands folds
    /// into one entry (a drag sends one per frame).
    pub(crate) fn push_log(&mut self, cmd: &str, v: &Value) {
        let tick = self.tick;
        let log = Arc::make_mut(&mut self.log);
        let mut entry = v.clone();
        if cmd == "give_up" {
            entry["tick"] = json!(tick);
        }
        if cmd == "aim" {
            if let Some(last) = log.last_mut() {
                if last["cmd"] == "aim" {
                    for k in ["angle", "power"] {
                        if let Some(x) = v.get(k) {
                            last[k] = x.clone();
                        }
                    }
                    return;
                }
            }
        }
        log.push(entry);
    }

    fn side_arg(&self, v: &Value) -> Result<u8, Value> {
        Ok(num(v, "side", 0, 1)?.map(|x| x as u8).unwrap_or(self.side))
    }

    fn command_inner(&mut self, cmd: &str, v: &Value) -> Value {
        match self.command_checked(cmd, v) {
            Ok(r) | Err(r) => r,
        }
    }

    fn command_checked(&mut self, cmd: &str, v: &Value) -> Result<Value, Value> {
        Ok(match cmd {
            "pick_shell" => {
                let s = num(v, "side", 0, 1)?
                    .map(|x| x as u8)
                    .unwrap_or(self.draft.next);
                let r = self.draft_pick(s, v["shell"].as_str().unwrap_or(""));
                self.ai_draft_picks();
                r
            }
            "quick_pick" => {
                let s = num(v, "side", 0, 1)?
                    .map(|x| x as u8)
                    .unwrap_or(self.draft.next);
                if self.phase != Phase::Draft {
                    return Err(err("not_drafting"));
                }
                if s != self.draft.next {
                    return Err(err("not_your_pick"));
                }
                let r = self.quick_pick(s);
                self.ai_draft_picks();
                r
            }
            "end_draft" => {
                if self.phase != Phase::Draft {
                    return Err(err("not_drafting"));
                }
                while self.phase == Phase::Draft {
                    let s = self.draft.next;
                    let before = self.draft.pool.len();
                    self.quick_pick(s);
                    self.ai_draft_picks();
                    if self.draft.pool.len() == before && self.phase == Phase::Draft {
                        self.draft.picks_each = 0;
                        self.ev(json!({"t": "draft_end"}));
                        self.start_battle();
                    }
                }
                ok()
            }
            "pick_hob" => {
                if self.phase != Phase::Plan || self.acted {
                    return Err(err("not_planning"));
                }
                let Some(hob) = num(v, "hob", 0, 255)? else {
                    return Err(err("bad_hob"));
                };
                let hob = hob as u8;
                if self
                    .hobs
                    .get(hob as usize)
                    .is_none_or(|h| h.side != self.side || !h.alive())
                {
                    return Err(err("bad_hob"));
                }
                let s = self.side as usize;
                self.sel[s].hob = hob;
                if self.sel[s].shot == "knack" && self.hobs[hob as usize].knack.is_none() {
                    self.sel[s].shot = "plain".into();
                }
                json!({"ok": true, "can_fire": self.can_fire_hob(self.side, hob)})
            }
            "pick_shot" => {
                if self.phase != Phase::Plan || self.acted {
                    return Err(err("not_planning"));
                }
                let s = self.side as usize;
                let shot = v["shot"].as_str().unwrap_or("plain");
                let valid = shot == "plain"
                    || (shot == "knack" && self.hobs[self.sel[s].hob as usize].knack.is_some())
                    || self.hands[s].iter().any(|x| x == shot);
                if !valid {
                    return Err(err("bad_shot"));
                }
                self.sel[s].shot = shot.into();
                ok()
            }
            "aim" => {
                if self.phase != Phase::Plan || self.acted {
                    return Err(err("not_planning"));
                }
                let angle = num(v, "angle", 0, 1800)?;
                let power = num(v, "power", 0, 100)?;
                let s = self.side as usize;
                let h = self.sel[s].hob as usize;
                if let Some(a) = angle {
                    self.hobs[h].angle = a as i32;
                }
                if let Some(p) = power {
                    self.hobs[h].power = p as i32;
                }
                json!({"ok": true, "angle": self.hobs[h].angle, "power": self.hobs[h].power})
            }
            "recall" => {
                if self.phase != Phase::Plan || self.acted {
                    return Err(err("not_planning"));
                }
                let Some(i) = num(v, "ghost", 0, 1000)? else {
                    return Err(err("no_ghost"));
                };
                let s = self.side;
                let Some(gi) = self
                    .ghosts
                    .iter()
                    .enumerate()
                    .filter(|(_, g)| g.side == s)
                    .nth(i as usize)
                    .map(|(k, _)| k)
                else {
                    return Err(err("no_ghost"));
                };
                let g = self.ghosts[gi].clone();
                if g.recalled {
                    return Err(err("pin_faded"));
                }
                if !self.hobs[g.hob as usize].alive() {
                    return Err(err("bad_hob"));
                }
                self.ghosts[gi].recalled = true;
                self.sel[s as usize].hob = g.hob;
                self.hobs[g.hob as usize].angle = g.angle;
                self.hobs[g.hob as usize].power = g.power;
                ok()
            }
            "walk" => {
                let dx = num(v, "dx", -100_000, 100_000)?.unwrap_or(0);
                self.walk(dx as i32)
            }
            "shove_off" => {
                let Some(h) = num(v, "hob", 0, 255)? else {
                    return Err(err("no_hob"));
                };
                self.shove_off(h as u8)
            }
            "fire" => {
                let dial = match v.get("dial") {
                    None | Some(Value::Null) => None,
                    Some(Value::String(d)) => Some(d.clone()),
                    Some(_) => return Err(err("bad_dial")),
                };
                let target = match v.get("target") {
                    None | Some(Value::Null) => None,
                    Some(t) => {
                        let p = (
                            t.get(0).and_then(|x| num_at(x, -64, 64)),
                            t.get(1).and_then(|x| num_at(x, -64, 64)),
                        );
                        match p {
                            (Some(c), Some(r)) if t.as_array().is_some_and(|a| a.len() == 2) => {
                                Some((c, r))
                            }
                            _ => return Err(err_d("bad_value", "target must be [c, r]")),
                        }
                    }
                };
                self.fire(dial, target)
            }
            "doodad" => self.use_doodad(v["doodad"].as_str().unwrap_or(""), v),
            "pass" => {
                if self.phase != Phase::Plan || self.acted {
                    return Err(err("not_planning"));
                }
                self.acted = true;
                self.ev(json!({"t": "pass", "side": self.side}));
                self.phase = Phase::Settle(1);
                ok()
            }
            "give_up" => {
                if self.phase == Phase::Ended {
                    return Err(err("battle_over"));
                }
                let humans: Vec<u8> = (0..2u8)
                    .filter(|&s| self.control[s as usize] == Control::Human)
                    .collect();
                let default = if humans.len() == 1 {
                    humans[0]
                } else if self.phase == Phase::Draft {
                    self.draft.next
                } else {
                    self.side
                };
                let side = num(v, "side", 0, 1)?.map(|x| x as u8).unwrap_or(default);
                self.cur = None;
                self.end_battle(1 - side, "gave_up");
                json!({"ok": true, "side": side})
            }
            "ai_turn" => {
                let preset_arg = match v.get("preset") {
                    None | Some(Value::Null) => None,
                    Some(Value::String(p))
                        if matches!(p.as_str(), "cozy" | "fair" | "stubborn") =>
                    {
                        Some(Preset::parse(p))
                    }
                    Some(_) => {
                        return Err(err_d(
                            "bad_value",
                            "preset must be cozy, fair or stubborn",
                        ))
                    }
                };
                let was = self.logging;
                self.logging = false;
                let r = self.ai_turn(preset_arg, was);
                self.logging = was;
                r
            }
            "resume" => {
                if !self.log.is_empty() {
                    return Err(err_d("cannot_resume", "resume only on a new battle"));
                }
                let Some(entries) = v["log"].as_array() else {
                    return Err(err_d("bad_value", "log must be a list of commands"));
                };
                let entries = entries.clone();
                match crate::replay::replay_log(self, &entries) {
                    Ok(()) => {
                        // the app redraws from the next full snapshot
                        self.events.clear();
                        let (w, h) = (self.terrain.w, self.terrain.h);
                        self.terrain.mark_dirty(0, 0, w, h);
                        self.snap_full = true;
                        json!({"ok": true, "applied": entries.len(), "hash": crate::hash::hex(self.hash())})
                    }
                    Err((i, r)) => {
                        json!({"ok": false, "reason": "bad_log", "detail": format!("entry {i}: {}", r["reason"]), "index": i})
                    }
                }
            }
            // queries
            "lean_lines" => {
                let s = self.side_arg(v)? as usize;
                let c = num(v, "c", -64, 64)?.unwrap_or(-1) as i32;
                let r = num(v, "r", -64, 64)?.unwrap_or(-1) as i32;
                let held = self.held_slots(s as u8);
                let fall = self.castles[s].lean_lines(&self.content, c, r, &held);
                json!({"ok": true, "side": s, "falls": fall.iter().map(|p| json!([p.0, p.1])).collect::<Vec<_>>()})
            }
            "shimmer" => {
                let s = self.side_arg(v)? as usize;
                let held = self.held_slots(s as u8);
                let sh = self.castles[s].shimmer(&self.content, &held);
                json!({"ok": true, "side": s, "blocks": sh.iter().map(|p| json!([p.0, p.1])).collect::<Vec<_>>()})
            }
            "hash" => json!({"ok": true, "hash": crate::hash::hex(self.hash())}),
            "terrain_all" => {
                let (w, h) = (self.terrain.w, self.terrain.h);
                self.terrain.mark_dirty(0, 0, w, h);
                ok()
            }
            "log" => json!({"ok": true, "log": *self.log}),
            "validate_blueprint" => {
                let rows: Vec<String> = v["rows"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|x| x.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let seats = num(v, "seats", 0, 5)?.unwrap_or(0) as i32;
                let bp = Blueprint {
                    id: "check".into(),
                    name: String::new(),
                    rows,
                };
                match crate::castle::validate_blueprint(&self.content, &bp, seats) {
                    Ok(()) => ok(),
                    Err(e) => json!({"ok": false, "reason": "invalid_blueprint", "detail": e}),
                }
            }
            _ => err("unknown_command"),
        })
    }

    /// `ai_turn`: the AI plays the whole turn (or one draft pick) for the side
    /// to move. Only `ai_turn` itself goes into the log, not the commands it
    /// plays: replaying it reruns the AI on the same state, memory and random
    /// stream, so the AI state is derived from the log too.
    fn ai_turn(&mut self, preset_arg: Option<Preset>, log_it: bool) -> Value {
        let mut entry = json!({"cmd": "ai_turn"});
        if let Some(p) = preset_arg {
            entry["preset"] = json!(p.name());
        }
        if self.phase == Phase::Draft {
            let s = self.draft.next;
            self.quick_pick(s);
            self.ai_draft_picks();
            if log_it {
                self.push_log("ai_turn", &entry);
            }
            return json!({"ok": true, "commands": [], "results": []});
        }
        if self.phase != Phase::Plan {
            return err("not_planning");
        }
        if self.acted {
            return err("already_acted");
        }
        let side = self.side;
        let preset = match self.control[side as usize] {
            Control::Ai(p) => p,
            Control::Human => preset_arg.unwrap_or(Preset::Fair),
        };
        let cmds = crate::ai::plan_turn(self, side, preset);
        let mut out = vec![];
        let mut played = vec![];
        for c in &cmds {
            let r = self.command(c);
            if r["ok"] == json!(true) {
                played.push(c.clone());
            }
            out.push(r);
        }
        if !self.acted && self.phase == Phase::Plan {
            // every AI turn spends its Action
            let c = json!({"cmd": "pass"});
            out.push(self.command(&c));
            played.push(c);
        }
        self.last_ai = played.clone();
        if log_it {
            self.push_log("ai_turn", &entry);
        }
        json!({"ok": true, "commands": played, "results": out})
    }

    /// The state hash: every field that can change a later result. The
    /// terrain part folds per tile hashes kept up to date as cells change,
    /// so this costs a few microseconds, not a walk over the map.
    pub fn hash(&self) -> u64 {
        let mut hs = crate::hash::StateHasher::default();
        hs.i64(self.tick);
        hs.i32(self.round);
        hs.i32(self.turn);
        hs.i32(self.side as i32);
        hs.i32(self.first_side as i32);
        hs.str(self.phase.name());
        if let Phase::Settle(n) = self.phase {
            hs.i32(n);
        }
        hs.i32(self.acted as i32);
        hs.i32(self.wind);
        hs.i32(self.squall_dir);
        hs.i32(self.fronts.len() as i32);
        for f in &self.fronts {
            hs.i32(*f);
        }
        self.terrain.hash_into(&mut hs);
        for c in &self.castles {
            c.hash_into(&mut hs);
        }
        for h in &self.hobs {
            hs.i32(h.hp);
            hs.i32(h.max);
            hs.i32(h.nook.map(|n| n as i32).unwrap_or(-1));
            hs.i32(h.free.0);
            hs.i32(h.free.1);
            hs.str(h.state.name());
            hs.i32(h.rest);
            hs.i32(h.extra_rest as i32);
            hs.i32(h.knack_uses);
            hs.i32(h.angle);
            hs.i32(h.power);
            hs.i32(h.grudge as i32);
            hs.i32(h.clatter as i32);
            hs.i32(h.buried as i32);
            hs.i32(h.fired_this_turn as i32);
        }
        for a in &self.actors {
            hs.u32(a.id);
            hs.i32(a.shot as i32);
            hs.i32(a.x);
            hs.i32(a.y);
            hs.i32(a.vx);
            hs.i32(a.vy);
            hs.i32(a.age);
            hs.i32(a.bounces);
            hs.i32(a.passes);
            hs.i32(a.gravity_pct);
            hs.i32(a.apex_done as i32);
            hs.i32(match a.mode {
                crate::actor::Mode::Fly => 0,
                crate::actor::Mode::Roll { dir } => 10 + dir,
                crate::actor::Mode::Bore { .. } => 20,
            });
        }
        for p in &self.props {
            hs.u32(p.id);
            hs.i32(p.side as i32);
            hs.str(&p.kind);
            hs.str(&p.tag);
            hs.i32(p.shot.map(|x| x as i32).unwrap_or(-1));
            hs.i32(p.x);
            hs.i32(p.y);
            hs.i32(p.hp);
        }
        hs.u32(self.next_id);
        for st in [
            &self.rng.battle,
            &self.rng.hazard,
            &self.rng.ai[0],
            &self.rng.ai[1],
        ] {
            for x in st.state() {
                hs.u32(x);
            }
        }
        for m in &self.ai_mem {
            hs.i32(m.offsets.len() as i32);
            for o in &m.offsets {
                hs.i32(o.0);
                hs.i32(o.1);
                hs.i32(o.2);
            }
            hs.i32(m.own_walked as i32);
            hs.i32(m.target_walked);
            hs.i32(m.last_wind.unwrap_or(-99));
            let lp = m.last_pin.unwrap_or((-1, -1));
            hs.i32(lp.0);
            hs.i32(lp.1);
        }
        for side in 0..2 {
            hs.i32(self.hands[side].len() as i32);
            for x in &self.hands[side] {
                hs.str(x);
            }
            hs.i32(self.doodads[side].len() as i32);
            for x in &self.doodads[side] {
                hs.str(x);
            }
            hs.i32(self.draft.picks[side].len() as i32);
            for x in &self.draft.picks[side] {
                hs.str(x);
            }
            hs.i32(self.sel[side].hob as i32);
            hs.str(&self.sel[side].shot);
            hs.i32(self.puff_up_used[side] as i32);
            hs.i32(self.puff_up_allowed[side] as i32);
            hs.i32(self.turns_taken[side]);
            hs.i32(self.first_shot_done[side] as i32);
            hs.i32(self.popped[side] as i32);
            hs.i32(self.actions_left[side]);
            let st = &self.stats[side];
            hs.i64(st.score);
            hs.i32(st.streak);
            hs.i32(st.best_streak);
            hs.i32(st.shots);
            hs.i32(st.hits);
            hs.i32(st.blocks_dropped);
            hs.i32(st.own_bonked);
            hs.i32(st.tricks_used);
            hs.i32(st.hit_spots.len() as i32);
            hs.i32(st.bonked_by_hob.len() as i32);
            hs.i32(st.bonk_with_knack as i32);
            hs.i32(st.bonk_with_trick as i32);
        }
        hs.i32(self.draft.pool.len() as i32);
        for x in &self.draft.pool {
            hs.str(x);
        }
        hs.i32(self.draft.next as i32);
        hs.i32(self.draft.picks_each);
        for g in &self.ghosts {
            hs.i32(g.side as i32);
            hs.i32(g.hob as i32);
            hs.i32(g.angle);
            hs.i32(g.power);
            hs.i32(g.recalled as i32);
        }
        hs.i32(self.root_round);
        hs.i32(self.drop_called as i32);
        hs.i32(self.boss.phase);
        hs.i32(self.boss.jam);
        hs.i32(self.boss.roller_done as i32);
        let cut = self.boss.cut.unwrap_or((0, 0, 0, 0));
        hs.i32(cut.0);
        hs.i32(cut.1);
        hs.i32(cut.2);
        hs.i32(cut.3);
        if let Some(r) = &self.result {
            hs.i32(r.winner as i32);
            hs.str(&r.how);
        }
        hs.finish()
    }
}

/// Commands that change the battle. `ai_turn` logs itself (see `ai_turn`);
/// the commands it plays are not logged.
fn is_logged(cmd: &str) -> bool {
    matches!(
        cmd,
        "pick_shell"
            | "quick_pick"
            | "end_draft"
            | "pick_hob"
            | "pick_shot"
            | "aim"
            | "recall"
            | "walk"
            | "shove_off"
            | "fire"
            | "doodad"
            | "pass"
            | "give_up"
    )
}

pub fn default_blueprint(crew: usize) -> &'static str {
    match crew {
        0..=3 => "bp_home_3",
        4 => "bp_home_4",
        _ => "bp_home_5",
    }
}

pub fn block_world_center(cs: &Castle, c: i32, r: i32) -> (i32, i32) {
    let (x0, y0, _, _) = cs.slot_box(c, r);
    (x0 + BLOCK / 2, y0 + BLOCK / 2)
}

//! Content data: the JSON shapes the sim reads. Every shot, Hob, fort and
//! level is data; no content id appears in rules code.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

fn d100() -> i32 {
    100
}
fn d_true() -> bool {
    true
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(deny_unknown_fields)]
pub struct DmgMult {
    #[serde(default = "d100")]
    pub blast: i32,
    #[serde(default = "d100")]
    pub pierce: i32,
    #[serde(default = "d100")]
    pub dig: i32,
    #[serde(default = "d100")]
    pub fire: i32,
    #[serde(default = "d100")]
    pub crush: i32,
}

impl DmgMult {
    pub fn get(&self, t: DType) -> i32 {
        match t {
            DType::Blast => self.blast,
            DType::Pierce => self.pierce,
            DType::Dig => self.dig,
            DType::Fire => self.fire,
            DType::Crush => self.crush,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum DType {
    Blast,
    Pierce,
    Dig,
    Fire,
    Crush,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct TerrainMat {
    pub id: String,
    pub code: u8,
    pub solid: bool,
    #[serde(default)]
    pub loose: bool,
    #[serde(default)]
    pub liquid: bool,
    /// Share of a blast radius this ground carves (Loam 100, Clay 50, Rock 0).
    pub carve_pct: i32,
    /// Heavy shots carve this much of the radius (Rock carves only under Heavy).
    #[serde(default)]
    pub heavy_carve_pct: i32,
    /// Bore speed share for dig shots, 0 stops a bore.
    #[serde(default)]
    pub bore_pct: i32,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BlockMat {
    pub id: String,
    pub name: String,
    /// One letter used in blueprint rows.
    pub glyph: String,
    pub hp: i32,
    pub cost: i32,
    /// Side support reach in blocks.
    pub side_support: i32,
    /// Crush dealt per falling block, percent of the base 15.
    pub crush_pct: i32,
    #[serde(default)]
    pub never_falls: bool,
    pub mult: DmgMult,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Materials {
    pub terrain: Vec<TerrainMat>,
    pub blocks: Vec<BlockMat>,
    pub hob: DmgMult,
    pub kettle: DmgMult,
    /// Percent of an area payload a Hob takes under Cover (seated in an
    /// intact Nook, burst outside it). Canon 50; a pacing number.
    #[serde(default = "d50")]
    pub cover_pct: i32,
}
fn d50() -> i32 {
    50
}

fn parse_level_num(id: &str) -> Option<(i32, i32)> {
    let (a, b) = id.split_once('-')?;
    Some((a.parse().ok()?, b.parse().ok()?))
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ClassDef {
    pub id: String,
    pub name: String,
    pub hp: i32,
    pub plain: String,
    pub role: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Passive {
    /// Longer preview on Plain Shots (Marge).
    PreviewBonus { pct: i32 },
    /// Threaded shots deal more (Quill).
    ThreadBonus { pct: i32 },
    /// A different Plain Shot (Jax).
    PlainOverride { shot: String },
    /// The Hob behind keeps Cover when the shared wall breaks (Grub).
    BroadBack,
    /// Pick extra hops on the Plain Shot (Bobbin).
    HopDial { max: i32 },
    /// Columns above the Nook cannot fall from lost support (Hetty).
    Ridgepole,
    /// Next door Bonk makes the next Plain Shot one band larger (Old Thumper).
    OldGrudge,
    /// Damage to an enemy Hob buffs next door Hobs' next shot (Nan).
    ClatterCall { pct: i32 },
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct HobDef {
    pub id: String,
    pub name: String,
    pub class: String,
    pub hp: i32,
    #[serde(default)]
    pub knack: Option<String>,
    #[serde(default)]
    pub passive: Option<Passive>,
    #[serde(default)]
    pub passive_name: String,
    /// Player Hob (true) or Flattener unit (false).
    #[serde(default = "d_true")]
    pub player: bool,
    /// Does not fire (Straw Stuffer).
    #[serde(default)]
    pub dummy: bool,
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Weight {
    L,
    M,
    H,
}

impl Weight {
    pub fn rest(self) -> i32 {
        match self {
            Weight::L => 0,
            Weight::M => 1,
            Weight::H => 2,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FlightKind {
    Arc,
    Bounce,
    Roller,
    Dig,
    Split,
    Rise,
    Beam,
    #[serde(rename = "self")]
    SelfTarget,
    Prop,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Flight {
    pub kind: FlightKind,
    #[serde(default = "d100")]
    pub speed_pct: i32,
    #[serde(default = "d100")]
    pub gravity_pct: i32,
    #[serde(default = "d100")]
    pub wind_pct: i32,
    /// Bounces before the last touch (bounce).
    #[serde(default)]
    pub bounces: i32,
    /// Speed kept per bounce, percent.
    #[serde(default = "d100")]
    pub keep_pct: i32,
    /// Roll time in ticks (roller).
    #[serde(default)]
    pub roll_ticks: i32,
    /// Rollers with a motor keep speed uphill up to 45 degrees.
    #[serde(default)]
    pub motor: bool,
    /// Bore length in cells of soft ground (dig).
    #[serde(default)]
    pub max_cells: i32,
    /// Castle blocks a bore passes before it stops (dig).
    #[serde(default)]
    pub max_blocks: i32,
    /// Dig damage to each block a bore passes.
    #[serde(default)]
    pub block_dmg: i32,
    /// Tunnel width in cells.
    #[serde(default)]
    pub tunnel: i32,
    /// Bore stops when it meets air.
    #[serde(default)]
    pub stop_on_air: bool,
    /// Blocks a beam passes through, and the Pierce it deals to each.
    #[serde(default)]
    pub pass_blocks: i32,
    #[serde(default)]
    pub pass_dmg: i32,
    /// Most a guided shell bends after its apex, tenths of a degree.
    #[serde(default)]
    pub guide_tenths: i32,
    /// Gravity percent after the apex (rise).
    #[serde(default)]
    pub apex_gravity_pct: Option<i32>,
    /// Ticks before the shell pops in the air on its own; 0 never.
    #[serde(default)]
    pub life_ticks: i32,
    /// Prop hit points (prop).
    #[serde(default)]
    pub prop_hp: i32,
    /// Prop stops the first roller that touches it.
    #[serde(default)]
    pub stops_rollers: bool,
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Band {
    Point,
    Tiny,
    Small,
    Medium,
    Large,
    Huge,
}

impl Band {
    pub fn radius(self) -> i32 {
        match self {
            Band::Point => 0,
            Band::Tiny => 10,
            Band::Small => 18,
            Band::Medium => 28,
            Band::Large => 42,
            Band::Huge => 64,
        }
    }
    pub fn bigger(self) -> Band {
        match self {
            Band::Point => Band::Tiny,
            Band::Tiny => Band::Small,
            Band::Small => Band::Medium,
            Band::Medium => Band::Large,
            Band::Large | Band::Huge => Band::Huge,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Effect {
    Explode {
        dmg: i32,
        dtype: DType,
        band: Band,
        #[serde(default = "d100")]
        carve_pct: i32,
        /// Extra multipliers by block material id, percent.
        #[serde(default)]
        mat_bonus: BTreeMap<String, i32>,
        /// Blocks in the row just above the Footing take this percent.
        #[serde(default = "d100")]
        low_row_pct: i32,
        /// Added damage per bounce made before this burst.
        #[serde(default)]
        per_bounce: i32,
        /// Threads Loopholes (point shots only).
        #[serde(default)]
        threads: bool,
    },
    Split {
        child: String,
        count: i32,
        /// Tenths of a degree between neighbours.
        #[serde(default)]
        spread: i32,
        /// Speed step between neighbours in permille.
        #[serde(default)]
        speed_step: i32,
        /// Spread centred on the parent (true) or counted up from it.
        #[serde(default = "d_true")]
        centered: bool,
        /// Start speed in cells/s; 0 keeps the parent's.
        #[serde(default)]
        speed_abs: i32,
        /// The parent ends when it splits.
        #[serde(default = "d_true")]
        replace: bool,
    },
    Column {
        dmg: i32,
        dtype: DType,
        above_dmg: i32,
        above_n: i32,
    },
    Mound {
        radius: i32,
    },
    BecomeProp {
        shot: String,
    },
    Mend {
        hp: i32,
        /// A broken block comes back at this percent of its max HP.
        restore_pct: i32,
    },
    Rebuild {
        count: i32,
        hp_pct: i32,
    },
    PuffUp {
        hp: i32,
    },
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TriggerOn {
    Launch,
    Apex,
    Impact,
    Bounce,
    Stop,
    Expire,
    OwnerTurnStart,
    Fire,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Trigger {
    pub on: TriggerOn,
    /// Only when the fire command picked this dial option.
    #[serde(default)]
    pub dial: Option<String>,
    #[serde(rename = "do")]
    pub effects: Vec<Effect>,
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ShotKind {
    Plain,
    Knack,
    Trick,
    Child,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ShotDef {
    pub id: String,
    pub name: String,
    pub kind: ShotKind,
    pub weight: Weight,
    /// Match Class for Trick Shells, or "all".
    #[serde(default)]
    pub match_class: Option<String>,
    #[serde(default)]
    pub dud: bool,
    /// Draft and AI value of the shell.
    #[serde(default)]
    pub value: i32,
    /// Siege Score weight, percent (50, 100, 150).
    #[serde(default = "d100")]
    pub skill_pct: i32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub card: String,
    /// Dial options the fire command may pick.
    #[serde(default)]
    pub dials: Vec<String>,
    pub flight: Flight,
    #[serde(default)]
    pub triggers: Vec<Trigger>,
    /// Effects used when the shot is aimed at a block of its own fort.
    #[serde(default)]
    pub self_effects: Vec<Effect>,
}

impl ShotDef {
    pub fn has_tag(&self, t: &str) -> bool {
        self.tags.iter().any(|x| x == t)
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum DoodadEffect {
    MendBlocks { count: i32, hp: i32 },
    Lid,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DoodadDef {
    pub id: String,
    pub name: String,
    pub card: String,
    pub effect: DoodadEffect,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Blueprint {
    pub id: String,
    #[serde(default)]
    pub name: String,
    /// Rows from the top down, front facing right. Glyphs: '.' empty,
    /// material glyphs, 'K' Kettle Room, '1'..'5' Nooks, 'r' a Timber root block.
    pub rows: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct GroundDef {
    /// Heightline points [x, height above the map bottom].
    pub points: Vec<[i32; 2]>,
    /// Loam depth under the surface, then Clay to clay_depth, then Rock.
    #[serde(default = "d_loam")]
    pub loam_depth: i32,
    #[serde(default = "d_clay")]
    pub clay_depth: i32,
    /// Extra patches of ground material: [x0, x1, top height, bottom height, material].
    #[serde(default)]
    pub patches: Vec<(i32, i32, i32, i32, String)>,
}
fn d_loam() -> i32 {
    120
}
fn d_clay() -> i32 {
    260
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct WaterDef {
    pub x0: i32,
    pub x1: i32,
    /// Water surface height above the map bottom.
    pub level: i32,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PadDef {
    /// Castle centre x in cells.
    pub x: i32,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(deny_unknown_fields)]
pub struct SideSetup {
    #[serde(default)]
    pub name: String,
    /// Display line only (the Rival's Habit as the player reads it).
    #[serde(default)]
    pub habit: String,
    /// The AI habit this side plays with, one of `HABIT_IDS`. None plays
    /// "balanced".
    #[serde(default)]
    pub habit_id: Option<String>,
    /// How long the app shows this Rival's think pose before each AI turn,
    /// in milliseconds. Presentation only: not in the state hash.
    #[serde(default)]
    pub think_ms: Option<i32>,
    /// Skirmish: named Rivals to pick from by seed when the setup gives no
    /// name. Display name and think time only; the habit stays `habit_id`.
    #[serde(default)]
    pub roster: Vec<RosterEntry>,
    #[serde(default)]
    pub blueprint: Option<String>,
    #[serde(default)]
    pub crew: Vec<String>,
    #[serde(default)]
    pub crew_size: Option<i32>,
    /// Aim grade 1 to 5 for an AI side.
    #[serde(default)]
    pub aim: Option<i32>,
    #[serde(default)]
    pub doodads: Vec<String>,
    /// Shells lent for this level only: in hand from the start, no draft.
    #[serde(default)]
    pub loose_shells: Vec<String>,
    /// Knack uses per Hob of this side in this level, 0 to 2 (default 2).
    #[serde(default)]
    pub knack_uses: Option<i32>,
    /// Hob HP of this side in this level, percent of each Hob's HP, 50 to
    /// 200 (default 100). Region 1 Rivals send green crews.
    #[serde(default)]
    pub hp_pct: Option<i32>,
    /// Per AI preset grade: when the AI plays this side on that preset,
    /// these replace `aim`, `knack_uses` and `hp_pct` (a setup `aim` still
    /// wins). The Skirmish maps use it so Cozy and Fair Rivals play like
    /// Region 1 Rivals.
    #[serde(default)]
    pub grades: Option<Grades>,
}

/// One named Rival a Skirmish map can pick by seed.
#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(deny_unknown_fields)]
pub struct RosterEntry {
    pub name: String,
    #[serde(default)]
    pub think_ms: Option<i32>,
}

impl SideSetup {
    /// The roster entry a Skirmish picks for this app seed (seed mod count).
    pub fn roster_pick(&self, seed: u64) -> Option<&RosterEntry> {
        if self.roster.is_empty() {
            return None;
        }
        self.roster.get((seed % self.roster.len() as u64) as usize)
    }
}

/// Rival grades per AI preset.
#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(deny_unknown_fields)]
pub struct Grades {
    #[serde(default)]
    pub cozy: Option<Grade>,
    #[serde(default)]
    pub fair: Option<Grade>,
    #[serde(default)]
    pub stubborn: Option<Grade>,
}

/// One preset's grade: aim 1 to 5, Knack uses 0 to 2, Hob HP percent.
#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(deny_unknown_fields)]
pub struct Grade {
    #[serde(default)]
    pub aim: Option<i32>,
    #[serde(default)]
    pub knack_uses: Option<i32>,
    #[serde(default)]
    pub hp_pct: Option<i32>,
}

impl Grades {
    pub fn get(&self, preset: &str) -> Option<&Grade> {
        match preset {
            "cozy" => self.cozy.as_ref(),
            "fair" => self.fair.as_ref(),
            "stubborn" => self.stubborn.as_ref(),
            _ => None,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct WindDef {
    #[serde(default)]
    pub min: i32,
    #[serde(default)]
    pub max: i32,
    /// Fixed wind per front, used in order before random fronts.
    #[serde(default)]
    pub fronts: Vec<i32>,
    #[serde(default = "d3")]
    pub front_rounds: i32,
}
fn d3() -> i32 {
    3
}

impl Default for WindDef {
    fn default() -> Self {
        WindDef {
            min: 0,
            max: 0,
            fronts: vec![],
            front_rounds: 3,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RummageDef {
    #[serde(default)]
    pub pool: i32,
    #[serde(default)]
    pub picks: i32,
    /// Shell ids the pool draws from; empty uses the content source list.
    #[serde(default)]
    pub source: Vec<String>,
}

impl Default for RummageDef {
    fn default() -> Self {
        RummageDef {
            pool: 6,
            picks: 2,
            source: vec![],
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Rules {
    #[serde(default = "d15")]
    pub round_cap: i32,
    #[serde(default = "d_true")]
    pub squall: bool,
    /// With no Squall, the side that wins when the cap runs out; None counts total HP.
    #[serde(default)]
    pub cap_win: Option<u8>,
    #[serde(default)]
    pub wind: WindDef,
    /// 0, 1 or "coin" as 2.
    #[serde(default)]
    pub first_turn: u8,
    #[serde(default = "d_steam")]
    pub steam: i32,
    #[serde(default)]
    pub rummage: RummageDef,
    #[serde(default)]
    pub full_preview_first_shot: bool,
    /// Preview share of the arc, percent.
    #[serde(default = "d30")]
    pub preview_pct: i32,
    /// Win by breaking this many props with this tag (Rescue).
    #[serde(default)]
    pub objective: Option<Objective>,
    /// Boss rule: while the root block stands, one lost block regrows per turn.
    #[serde(default)]
    pub regrow: bool,
    /// Grand Fort phases 2 and 3 (1-10: the lawn roller and the shears).
    #[serde(default)]
    pub boss: Option<BossDef>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BossDef {
    /// Phase 2 starts when the boss kettle falls under this percent, or the
    /// root block breaks.
    pub phase2_pct: i32,
    /// Phase 3 starts under this percent.
    pub phase3_pct: i32,
    #[serde(default)]
    pub roller: Option<RollerDef>,
    #[serde(default)]
    pub shears: Option<ShearsDef>,
}

/// Big Smoothie Jr.: rolls toward the player each boss turn start and shaves
/// the hill down to a flat line. Its boiler (a prop) stops it when broken; it
/// can not climb dirt piled more than `climb` cells over the map's own ground.
#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RollerDef {
    /// Start x (cells), on the ground there.
    pub x: i32,
    pub hp: i32,
    /// Cells rolled per boss turn.
    pub step: i32,
    pub climb: i32,
    /// The flat line, as a height above the map bottom.
    pub flat_height: i32,
}

/// The Big Snip: open one boss turn (the cut line shows), snip the next.
#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ShearsDef {
    /// Hinge prop HP; any hit that breaks it jams the shears.
    pub hp: i32,
    /// Rows cut from the top of the tallest column.
    pub rows: i32,
    /// Boss turns a jam lasts.
    pub jam_turns: i32,
}
fn d15() -> i32 {
    15
}
fn d_steam() -> i32 {
    100
}
fn d30() -> i32 {
    30
}

impl Default for Rules {
    fn default() -> Self {
        Rules {
            round_cap: 15,
            squall: true,
            cap_win: None,
            wind: WindDef::default(),
            first_turn: 0,
            steam: 100,
            rummage: RummageDef::default(),
            full_preview_first_shot: false,
            preview_pct: 30,
            objective: None,
            regrow: false,
            boss: None,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Objective {
    pub tag: String,
    pub count: i32,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ObjectDef {
    /// "cage_bar", "captive" or "prop".
    pub kind: String,
    pub x: i32,
    /// Height above the ground at x.
    #[serde(default)]
    pub lift: i32,
    pub hp: i32,
    #[serde(default)]
    pub tag: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Pennant {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub value: i32,
    #[serde(default)]
    pub text: String,
    /// `ground_kept`: the stretch of map [x0, x1] in cells whose ground
    /// must keep `value` percent of its height above its lowest point.
    #[serde(default)]
    pub area: Option<[i32; 2]>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct LevelDef {
    pub id: String,
    pub name: String,
    /// siege, rescue, grand_fort, skirmish.
    #[serde(rename = "type")]
    pub kind: String,
    pub size: String,
    pub width: i32,
    pub height: i32,
    pub ground: GroundDef,
    #[serde(default)]
    pub water: Vec<WaterDef>,
    pub pads: [PadDef; 2],
    #[serde(default)]
    pub player: SideSetup,
    #[serde(default)]
    pub rival: SideSetup,
    #[serde(default)]
    pub rules: Rules,
    #[serde(default)]
    pub objects: Vec<ObjectDef>,
    #[serde(default)]
    pub pennants: Vec<Pennant>,
    #[serde(default)]
    pub map_note: String,
    #[serde(default)]
    pub new_thing: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Kit {
    pub id: String,
    pub name: String,
    pub blueprint: String,
    pub crew: Vec<String>,
    pub doodads: Vec<String>,
    pub shells: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct StarterBox {
    pub map: String,
    pub kits: Vec<Kit>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RummageSource {
    pub source: Vec<String>,
}

/// The whole content bundle: one object whose keys match the content files.
#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct Content {
    pub materials: Materials,
    pub classes: Vec<ClassDef>,
    pub hobs: Vec<HobDef>,
    pub shots: Vec<ShotDef>,
    pub doodads: Vec<DoodadDef>,
    pub blueprints: Vec<Blueprint>,
    pub rummage: RummageSource,
    pub levels: Vec<LevelDef>,
    pub starter_box: StarterBox,
    /// `content/app.json`: app numbers the core also reads (Help Steam,
    /// Buttons rewards). Optional; defaults follow the design canon.
    #[serde(default)]
    pub app: serde_json::Value,
}

macro_rules! finder {
    ($name:ident, $field:ident, $t:ty) => {
        pub fn $name(&self, id: &str) -> Option<&$t> {
            self.$field.iter().find(|x| x.id == id)
        }
    };
}

impl Content {
    finder!(class, classes, ClassDef);
    finder!(hob, hobs, HobDef);
    finder!(shot, shots, ShotDef);
    finder!(doodad, doodads, DoodadDef);
    finder!(blueprint, blueprints, Blueprint);
    finder!(level, levels, LevelDef);

    pub fn block_mat(&self, id: &str) -> Option<usize> {
        self.materials.blocks.iter().position(|m| m.id == id)
    }
    pub fn terrain_code(&self, id: &str) -> u8 {
        self.materials
            .terrain
            .iter()
            .find(|m| m.id == id)
            .map(|m| m.code)
            .unwrap_or(0)
    }
    pub fn terrain(&self, code: u8) -> Option<&TerrainMat> {
        self.materials.terrain.iter().find(|m| m.code == code)
    }

    /// Steam pool for a Help level ("none" gives 0: use the level's pool).
    pub fn app_help_steam(&self, help: &str) -> Option<i32> {
        if help == "none" {
            return Some(0);
        }
        if let Some(v) = self.app["help_steam"][help].as_i64() {
            return Some(v as i32);
        }
        match help {
            "some" => Some(120),
            "lots" => Some(140),
            _ => None,
        }
    }

    /// True when walking is unlocked on a campaign level (`app.campaign.walk_from`).
    /// Non-numbered level ids (skirmish or custom maps) always allow walking.
    pub fn campaign_walk_allowed(&self, level_id: &str) -> bool {
        let from = self.app["campaign"]["walk_from"].as_str().unwrap_or("1-5");
        match (parse_level_num(level_id), parse_level_num(from)) {
            (Some(cur), Some(min)) => cur >= min,
            _ => true,
        }
    }

    /// A Buttons reward number from app.json `rewards`, or the canon default.
    pub fn reward(&self, key: &str) -> i32 {
        if let Some(v) = self.app["rewards"][key].as_i64() {
            return v as i32;
        }
        match key {
            "first_clear" => 200,
            "first_clear_grand_fort" => 500,
            "per_pennant" => 25,
            "replay" => 80,
            "replay_grand_fort" => 150,
            "per_new_pennant" => 10,
            "loss" => 40,
            "daily" => 60,
            _ => 0,
        }
    }

    /// Parse a content bundle. Empty input gives the built in content.
    pub fn from_json(s: &str) -> Result<Content, String> {
        if s.trim().is_empty() {
            return Ok(crate::embedded::content());
        }
        let c: Content = serde_json::from_str(s).map_err(|e| format!("content: {e}"))?;
        c.check()?;
        Ok(c)
    }

    /// Cross reference checks. Returns the first problem found.
    pub fn check(&self) -> Result<(), String> {
        let mut errs = Vec::new();
        // duplicate ids: finders return the first, the shot index the last
        fn dups<'a>(what: &str, ids: impl Iterator<Item = &'a String>, errs: &mut Vec<String>) {
            let mut seen: Vec<&String> = vec![];
            for id in ids {
                if seen.contains(&id) {
                    errs.push(format!("duplicate {what} id {id}"));
                }
                seen.push(id);
            }
        }
        dups("class", self.classes.iter().map(|x| &x.id), &mut errs);
        dups("hob", self.hobs.iter().map(|x| &x.id), &mut errs);
        dups("shot", self.shots.iter().map(|x| &x.id), &mut errs);
        dups("doodad", self.doodads.iter().map(|x| &x.id), &mut errs);
        dups(
            "blueprint",
            self.blueprints.iter().map(|x| &x.id),
            &mut errs,
        );
        dups("level", self.levels.iter().map(|x| &x.id), &mut errs);
        dups(
            "material",
            self.materials.blocks.iter().map(|x| &x.id),
            &mut errs,
        );
        dups(
            "terrain",
            self.materials.terrain.iter().map(|x| &x.id),
            &mut errs,
        );
        let mut seen_codes: Vec<u8> = vec![];
        for tm in &self.materials.terrain {
            if tm.code == 255 {
                errs.push(format!("terrain {} code 255 is reserved", tm.id));
            }
            if seen_codes.contains(&tm.code) {
                errs.push(format!("duplicate terrain code {}", tm.code));
            }
            seen_codes.push(tm.code);
        }
        for m in &self.materials.blocks {
            if m.hp <= 0 {
                errs.push(format!("material {} needs HP above 0", m.id));
            }
            let g: Vec<char> = m.glyph.chars().collect();
            if g.len() != 1 || matches!(g[0], '.' | 'K' | 'r' | '1'..='9') {
                errs.push(format!("material {} glyph must be one free letter", m.id));
            }
        }
        for h in &self.hobs {
            if h.hp <= 0 {
                errs.push(format!("hob {} needs HP above 0", h.id));
            }
        }
        for c in &self.classes {
            if c.hp <= 0 {
                errs.push(format!("class {} needs HP above 0", c.id));
            }
        }
        // split and prop chains must end: no shot may reach itself
        for (i, _) in self.shots.iter().enumerate() {
            let mut stack = vec![(i, 0)];
            while let Some((j, depth)) = stack.pop() {
                if depth > self.shots.len() {
                    errs.push(format!(
                        "shot {} splits or turns into itself",
                        self.shots[i].id
                    ));
                    break;
                }
                for child in self.children(j) {
                    if child == i {
                        errs.push(format!(
                            "shot {} splits or turns into itself",
                            self.shots[i].id
                        ));
                        stack.clear();
                        break;
                    }
                    stack.push((child, depth + 1));
                }
            }
        }
        for sh in &self.shots {
            let f = &sh.flight;
            if f.gravity_pct <= 0 && f.kind != FlightKind::Beam && f.life_ticks <= 0 {
                errs.push(format!(
                    "shot {} has no gravity and is not a beam: set life_ticks",
                    sh.id
                ));
            }
            for t in &sh.triggers {
                for e in &t.effects {
                    if let Effect::Explode { dmg, .. } | Effect::Column { dmg, .. } = e {
                        if *dmg > 110 {
                            errs.push(format!("shot {} deals over the 110 Thwack cap", sh.id));
                        }
                    }
                }
            }
        }
        for c in &self.classes {
            if self.shot(&c.plain).is_none() {
                errs.push(format!("class {} plain shot {} missing", c.id, c.plain));
            }
        }
        for h in &self.hobs {
            if self.class(&h.class).is_none() && !h.dummy {
                errs.push(format!("hob {} class {} missing", h.id, h.class));
            }
            if let Some(k) = &h.knack {
                if self.shot(k).is_none() {
                    errs.push(format!("hob {} knack {} missing", h.id, k));
                }
            }
            if let Some(Passive::PlainOverride { shot }) = &h.passive {
                if self.shot(shot).is_none() {
                    errs.push(format!("hob {} plain override {} missing", h.id, shot));
                }
            }
        }
        for s in &self.shots {
            let mut effs: Vec<&Effect> = s.triggers.iter().flat_map(|t| t.effects.iter()).collect();
            effs.extend(s.self_effects.iter());
            for e in effs {
                match e {
                    Effect::Split { child, .. } | Effect::BecomeProp { shot: child } => {
                        if self.shot(child).is_none() {
                            errs.push(format!("shot {} child {} missing", s.id, child));
                        }
                    }
                    Effect::Explode { mat_bonus, .. } => {
                        for k in mat_bonus.keys() {
                            if self.block_mat(k).is_none() {
                                errs.push(format!("shot {} bonus material {} missing", s.id, k));
                            }
                        }
                    }
                    Effect::Mound { radius } if *radius <= 0 || *radius > 2048 => {
                        errs.push(format!(
                            "shot {} mound radius {} out of range",
                            s.id, radius
                        ));
                    }
                    _ => {}
                }
            }
            if let Some(m) = &s.match_class {
                if m != "all" && self.class(m).is_none() {
                    errs.push(format!("shot {} match class {} missing", s.id, m));
                }
            }
        }
        for id in &self.rummage.source {
            match self.shot(id) {
                Some(s) if s.kind == ShotKind::Trick => {}
                _ => errs.push(format!("rummage source {} is not a trick shell", id)),
            }
        }
        for b in &self.blueprints {
            if let Err(e) = crate::castle::validate_blueprint(self, b, 0) {
                errs.push(format!("blueprint {}: {}", b.id, e));
            }
        }
        for l in &self.levels {
            for (side, s) in [(0, &l.player), (1, &l.rival)] {
                if let Some(bp) = &s.blueprint {
                    match self.blueprint(bp) {
                        None => errs.push(format!("level {} blueprint {} missing", l.id, bp)),
                        Some(b) => {
                            let seats = s.crew_size.unwrap_or(s.crew.len() as i32);
                            if let Err(e) = crate::castle::validate_blueprint(self, b, seats) {
                                errs.push(format!("level {} side {} fort: {}", l.id, side, e));
                            }
                        }
                    }
                }
                for h in &s.crew {
                    if self.hob(h).is_none() {
                        errs.push(format!("level {} hob {} missing", l.id, h));
                    }
                }
                for d in &s.doodads {
                    if self.doodad(d).is_none() {
                        errs.push(format!("level {} doodad {} missing", l.id, d));
                    }
                }
                for d in &s.loose_shells {
                    if self.shot(d).is_none() {
                        errs.push(format!("level {} loose shell {} missing", l.id, d));
                    }
                }
                if s.aim.is_some_and(|a| !(1..=5).contains(&a)) {
                    errs.push(format!("level {} side {} aim out of range", l.id, side));
                }
                if s.knack_uses.is_some_and(|k| !(0..=2).contains(&k)) {
                    errs.push(format!(
                        "level {} side {} knack_uses out of range",
                        l.id, side
                    ));
                }
                if s.hp_pct.is_some_and(|p| !(50..=200).contains(&p)) {
                    errs.push(format!("level {} side {} hp_pct out of range", l.id, side));
                }
                if let Some(gs) = &s.grades {
                    for (name, g) in [
                        ("cozy", &gs.cozy),
                        ("fair", &gs.fair),
                        ("stubborn", &gs.stubborn),
                    ] {
                        if let Some(g) = g {
                            if g.aim.is_some_and(|a| !(1..=5).contains(&a)) {
                                errs.push(format!(
                                    "level {} grade {} aim out of range",
                                    l.id, name
                                ));
                            }
                            if g.knack_uses.is_some_and(|k| !(0..=2).contains(&k)) {
                                errs.push(format!(
                                    "level {} grade {} knack_uses out of range",
                                    l.id, name
                                ));
                            }
                            if g.hp_pct.is_some_and(|p| !(50..=200).contains(&p)) {
                                errs.push(format!(
                                    "level {} grade {} hp_pct out of range",
                                    l.id, name
                                ));
                            }
                        }
                    }
                }
            }
            if l.pennants.len() != 3 && l.kind != "skirmish" {
                errs.push(format!("level {} needs 3 pennants", l.id));
            }
            for p in &l.pennants {
                if !PENNANT_TYPES.contains(&p.kind.as_str()) {
                    errs.push(format!("level {} unknown pennant type {}", l.id, p.kind));
                }
                if p.kind == "ground_kept" {
                    let ok = p.area.is_some_and(|[a, b]| 0 <= a && a < b && b < l.width)
                        && (1..=100).contains(&p.value);
                    if !ok {
                        errs.push(format!(
                            "level {} ground_kept needs an area inside the map and a value 1 to 100",
                            l.id
                        ));
                    }
                }
                if p.kind == "bonk_nook" && !(1..=l.rival.crew.len() as i32).contains(&p.value) {
                    errs.push(format!(
                        "level {} bonk_nook value must name a seated Rival Hob",
                        l.id
                    ));
                }
            }
            match &l.rival.habit_id {
                None => errs.push(format!("level {} rival needs a habit_id", l.id)),
                Some(h) if !HABIT_IDS.contains(&h.as_str()) => {
                    errs.push(format!("level {} unknown habit_id {}", l.id, h))
                }
                _ => {}
            }
            if let Some(h) = &l.player.habit_id {
                if !HABIT_IDS.contains(&h.as_str()) {
                    errs.push(format!("level {} unknown player habit_id {}", l.id, h));
                }
            }
            let think_ok =
                |t: Option<i32>| t.is_none_or(|t| (THINK_MS_MIN..=THINK_MS_MAX).contains(&t));
            for s in [&l.player, &l.rival] {
                if !think_ok(s.think_ms) || s.roster.iter().any(|r| !think_ok(r.think_ms)) {
                    errs.push(format!(
                        "level {} think_ms must be {} to {}",
                        l.id, THINK_MS_MIN, THINK_MS_MAX
                    ));
                }
                if s.roster.iter().any(|r| r.name.trim().is_empty()) {
                    errs.push(format!("level {} roster names must not be empty", l.id));
                }
            }
            if l.width < 640 || l.height < 240 || l.width > 8192 || l.height > 2048 {
                errs.push(format!("level {} map size out of range", l.id));
            }
            // a fort is at most 8 blocks (128 cells) wide; pads a fort plus 64 apart
            if (l.pads[1].x - l.pads[0].x) < 128 + 64
                || l.pads[0].x < 64
                || l.pads[1].x > l.width - 64
            {
                errs.push(format!("level {} pads too close or off the map", l.id));
            }
            if l.rules.first_turn > 2 {
                errs.push(format!("level {} first_turn must be 0, 1 or 2", l.id));
            }
            if l.rules.cap_win.is_some_and(|w| w > 1) {
                errs.push(format!("level {} cap_win must be 0 or 1", l.id));
            }
            if l.rules.round_cap < 1 || l.rules.round_cap > 40 {
                errs.push(format!("level {} round_cap must be 1 to 40", l.id));
            }
            if !(-10..=10).contains(&l.rules.wind.min)
                || !(-10..=10).contains(&l.rules.wind.max)
                || l.rules.wind.min > l.rules.wind.max
                || !(1..=20).contains(&l.rules.wind.front_rounds)
                || l.rules.wind.fronts.iter().any(|w| !(-10..=10).contains(w))
            {
                errs.push(format!("level {} wind out of range", l.id));
            }
            if l.kind == "rescue" && (l.rules.squall || l.rules.objective.is_none()) {
                errs.push(format!(
                    "level {}: a Rescue has no Squall and needs an objective",
                    l.id
                ));
            }
            for o in &l.objects {
                if o.hp <= 0 || o.x < 0 || o.x >= l.width {
                    errs.push(format!("level {} object {} out of range", l.id, o.kind));
                }
            }
            if let Some(bd) = &l.rules.boss {
                if !(0..=100).contains(&bd.phase2_pct)
                    || !(0..=100).contains(&bd.phase3_pct)
                    || bd.phase3_pct > bd.phase2_pct
                {
                    errs.push(format!("level {} boss phase percents", l.id));
                }
                if let Some(r) = &bd.roller {
                    if r.x < 0 || r.x >= l.width || r.hp <= 0 || r.step <= 0 {
                        errs.push(format!("level {} roller out of range", l.id));
                    }
                }
                if let Some(sh) = &bd.shears {
                    if sh.hp <= 0 || sh.rows <= 0 || sh.jam_turns < 0 {
                        errs.push(format!("level {} shears out of range", l.id));
                    }
                }
            }
            if l.ground.points.len() < 2 {
                errs.push(format!("level {} needs a heightline", l.id));
            }
            for pt in &l.ground.points {
                if pt[0] < 0 || pt[0] > l.width || pt[1] < 0 || pt[1] > l.height {
                    errs.push(format!("level {} ground point out of range", l.id));
                }
            }
            if l.ground.points.windows(2).any(|w| w[0][0] > w[1][0]) {
                errs.push(format!(
                    "level {} ground points must not go backwards",
                    l.id
                ));
            }
            for (_, _, _, _, mat) in &l.ground.patches {
                if !self.materials.terrain.iter().any(|m| m.id == *mat) {
                    errs.push(format!("level {} patch material {} missing", l.id, mat));
                }
            }
            for id in &l.rules.rummage.source {
                if self.shot(id).is_none() {
                    errs.push(format!("level {} rummage shell {} missing", l.id, id));
                }
            }
        }
        if self.level(&self.starter_box.map).is_none() {
            errs.push(format!("starter box map {} missing", self.starter_box.map));
        }
        for k in &self.starter_box.kits {
            if self.blueprint(&k.blueprint).is_none() {
                errs.push(format!("kit {} blueprint missing", k.id));
            }
            for h in &k.crew {
                if self.hob(h).is_none() {
                    errs.push(format!("kit {} hob {} missing", k.id, h));
                }
            }
            for d in &k.doodads {
                if self.doodad(d).is_none() {
                    errs.push(format!("kit {} doodad {} missing", k.id, d));
                }
            }
            for d in &k.shells {
                if self.shot(d).is_none() {
                    errs.push(format!("kit {} shell {} missing", k.id, d));
                }
            }
        }
        if errs.is_empty() {
            Ok(())
        } else {
            Err(errs.join("; "))
        }
    }

    /// Shots a shot turns into: split children and props.
    fn children(&self, i: usize) -> Vec<usize> {
        let s = &self.shots[i];
        let mut out = vec![];
        let effs = s
            .triggers
            .iter()
            .flat_map(|t| t.effects.iter())
            .chain(s.self_effects.iter());
        for e in effs {
            if let Effect::Split { child, .. } | Effect::BecomeProp { shot: child } = e {
                if let Some(j) = self.shots.iter().position(|x| &x.id == child) {
                    out.push(j);
                }
            }
        }
        out
    }
}

/// Pennant goal types the core knows.
pub const PENNANT_TYPES: &[&str] = &[
    "win",
    "win_by_round",
    "no_hob_bonked",
    "kettle_above_pct",
    "hits_in_a_row",
    "kettle_pop",
    "bonk_with_each_hob",
    "bonk_with_knack",
    "bonk_with_trick",
    "use_tricks",
    "hits_from_spots",
    "captive_safe",
    "root_by_round",
    "hill_half",
    "ground_kept",
    "bonk_nook",
];

/// Rival habits the AI knows, by id. A level names one in `habit_id`; the
/// free text `habit` line is for display only and never changes play.
pub const HABIT_IDS: &[&str] = &[
    "balanced",
    "kettle_hunter",
    "roof_wrecker",
    "hob_sniper",
    "cautious_mender",
];

/// Rival think time bounds, in milliseconds (presentation only).
pub const THINK_MS_MIN: i32 = 200;
pub const THINK_MS_MAX: i32 = 4000;

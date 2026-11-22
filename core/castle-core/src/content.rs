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
    #[serde(default)]
    pub habit: String,
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

    /// Parse a content bundle. Empty input gives the built in content.
    pub fn from_json(s: &str) -> Result<Content, String> {
        if s.trim().is_empty() || s.trim() == "{}" {
            return Ok(crate::embedded::content());
        }
        let c: Content = serde_json::from_str(s).map_err(|e| format!("content: {e}"))?;
        c.check()?;
        Ok(c)
    }

    /// Cross reference checks. Returns the first problem found.
    pub fn check(&self) -> Result<(), String> {
        let mut errs = Vec::new();
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
            }
            if l.pennants.len() != 3 && l.kind != "skirmish" {
                errs.push(format!("level {} needs 3 pennants", l.id));
            }
            if l.ground.points.len() < 2 {
                errs.push(format!("level {} needs a heightline", l.id));
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
}

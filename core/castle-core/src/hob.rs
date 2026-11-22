//! Hobs in battle.

use crate::content::Passive;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HobState {
    /// In an intact Nook, with Cover.
    Seated,
    Open,
    Dropped,
    Tumbled,
    Squashed,
    Bonked,
}

impl HobState {
    pub fn name(self) -> &'static str {
        match self {
            HobState::Seated => "seated",
            HobState::Open => "open",
            HobState::Dropped => "dropped",
            HobState::Tumbled => "tumbled",
            HobState::Squashed => "squashed",
            HobState::Bonked => "bonked",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Hob {
    pub id: u8,
    pub side: u8,
    pub def: String,
    pub name: String,
    pub class: String,
    pub hp: i32,
    pub max: i32,
    pub nook: Option<u8>,
    /// Feet position relative to the castle (x, base_y) when not in a Nook.
    pub free: (i32, i32),
    pub state: HobState,
    /// Turns left to sit out. Set to Rest + 1 on firing, counted down at the
    /// end of each own turn.
    pub rest: i32,
    pub extra_rest: bool,
    pub knack_uses: i32,
    pub angle: i32,
    pub power: i32,
    pub plain: String,
    pub knack: Option<String>,
    pub passive: Option<Passive>,
    pub dummy: bool,
    pub grudge: bool,
    pub clatter: bool,
    pub buried: bool,
    pub fired_this_turn: bool,
}

impl Hob {
    pub fn alive(&self) -> bool {
        self.state != HobState::Bonked
    }
    pub fn has_passive(&self, f: impl Fn(&Passive) -> bool) -> bool {
        self.passive.as_ref().is_some_and(f)
    }
}

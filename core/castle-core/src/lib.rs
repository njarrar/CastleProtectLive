//! Castle Protect core: the only place game rules live.
//!
//! Integer and Q16.16 maths only, a 120 Hz fixed tick, seeded named random
//! streams. Apps send commands as JSON and read snapshots as JSON.

pub mod actor;
pub mod ai;
pub mod base64;
pub mod battle;
pub mod castle;
pub mod content;
pub mod effects;
pub mod embedded;
pub mod hash;
pub mod hob;
pub mod math;
pub mod replay;
pub mod rng;
pub mod snapshot;
pub mod terrain;
mod trig_table;

pub use battle::Battle;
pub use content::Content;

use serde_json::{json, Value};
use std::sync::Arc;

pub const SIM_VERSION: &str = "0.1.0";
pub const TICK_HZ: i32 = 120;
/// Bumped whenever a rule changes results. Keys the Daily seed.
pub const RULES_VERSION: u32 = 1;

/// Daily Dust-up seed from the local date text ("2026-11-22") and the rules
/// version. No content delay: the same date and rules give the same seed.
pub fn daily_seed(date: &str) -> u64 {
    let mut h = hash::StateHasher::default();
    h.str("daily");
    h.str(date);
    h.u32(RULES_VERSION);
    h.finish()
}

/// The handle the bindings wrap.
pub struct Game {
    pub battle: Battle,
}

impl Game {
    /// `content_json` may be empty for the built in content.
    pub fn new(content_json: &str, level_json: &str, seed: u64) -> Result<Game, String> {
        let content = Arc::new(Content::from_json(content_json)?);
        let battle = Battle::new(content, level_json, seed)?;
        Ok(Game { battle })
    }

    /// Apply one command (or a list of commands). Returns the JSON reply.
    pub fn command(&mut self, json: &str) -> String {
        let v: Value = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(e) => return json!({"ok": false, "reason": "bad_json", "detail": e.to_string()}).to_string(),
        };
        if let Value::Array(items) = &v {
            let out: Vec<Value> = items.iter().map(|c| self.battle.command(c)).collect();
            return Value::Array(out).to_string();
        }
        self.battle.command(&v).to_string()
    }

    pub fn step(&mut self, ticks: i32) -> String {
        self.battle.step(ticks);
        json!({"tick": self.battle.tick, "phase": self.battle.phase.name()}).to_string()
    }

    pub fn snapshot(&mut self) -> String {
        self.battle.snapshot().to_string()
    }
}

/// Version info for apps.
pub fn version_json() -> String {
    json!({"sim": SIM_VERSION, "rules": RULES_VERSION, "tick_hz": TICK_HZ}).to_string()
}

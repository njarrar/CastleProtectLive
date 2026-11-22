//! Recorded battles and the golden runner. The same replays run in native
//! tests and in WebAssembly, and must give the same final hash everywhere.

use crate::battle::{Battle, Phase};
use crate::content::Content;
use serde_json::Value;
use std::sync::Arc;

pub const GOLDEN: &[(&str, &str)] = &[
    (
        "first_lump",
        include_str!("../tests/golden/first_lump.json"),
    ),
    (
        "twin_puddings_bots",
        include_str!("../tests/golden/twin_puddings_bots.json"),
    ),
    (
        "couch_starter_box",
        include_str!("../tests/golden/couch_starter_box.json"),
    ),
];

/// Play a replay script. Items: a command object ({"cmd": ...}), {"step": n},
/// or {"auto": n} which plays n turns with ai_turn for whichever side is up.
pub fn run(content: Arc<Content>, replay: &Value) -> Result<Battle, String> {
    let setup = serde_json::to_string(&replay["setup"]).map_err(|e| e.to_string())?;
    let seed = replay["seed"].as_u64().unwrap_or(1);
    let mut b = Battle::new(content, &setup, seed)?;
    for item in replay["script"].as_array().cloned().unwrap_or_default() {
        if let Some(n) = item["step"].as_i64() {
            b.step(n as i32);
        } else if let Some(n) = item["auto"].as_i64() {
            auto(&mut b, n as i32);
        } else if item.get("cmd").is_some() {
            b.command(&item);
        }
        let _ = b.snapshot();
    }
    Ok(b)
}

/// Play `turns` turns with the AI on both sides.
pub fn auto(b: &mut Battle, turns: i32) {
    for _ in 0..turns {
        if b.phase == Phase::Ended {
            return;
        }
        if b.phase == Phase::Draft {
            b.command(&serde_json::json!({"cmd": "end_draft"}));
        }
        if b.phase == Phase::Plan {
            b.command(&serde_json::json!({"cmd": "ai_turn"}));
        }
        b.run_until_plan(20_000);
    }
}

/// Apply a command log to a battle, stepping tick by tick between commands
/// exactly as a live app does (every command is sent in `draft` or `plan`;
/// `give_up` carries the tick it was sent on). Returns the index and the
/// reply of the first entry the battle refused.
pub fn replay_log(b: &mut Battle, log: &[Value]) -> Result<(), (usize, Value)> {
    for (i, c) in log.iter().enumerate() {
        if c["cmd"] == "give_up" {
            if let Some(t) = c["tick"].as_i64() {
                while b.tick < t && matches!(b.phase, Phase::Resolve | Phase::Settle(_)) {
                    b.step(1);
                }
            }
        } else {
            b.run_until_plan(1_000_000);
        }
        let mut cmd = c.clone();
        if let Some(o) = cmd.as_object_mut() {
            o.remove("tick");
        }
        let r = b.command(&cmd);
        if r["ok"] != serde_json::json!(true) {
            return Err((i, r));
        }
    }
    b.run_until_plan(1_000_000);
    Ok(())
}

/// Build a battle from its setup, seed and command log (a save).
pub fn from_log(
    content: Arc<Content>,
    setup: &str,
    seed: u64,
    log: &[Value],
) -> Result<Battle, String> {
    let mut b = Battle::new(content, setup, seed)?;
    replay_log(&mut b, log).map_err(|(i, r)| format!("log entry {i} refused: {r}"))?;
    Ok(b)
}

/// "<name> <hash>" lines for every golden replay.
pub fn golden_lines() -> String {
    let content = Arc::new(crate::embedded::content());
    let mut out = String::new();
    for (name, src) in GOLDEN {
        let v: Value = serde_json::from_str(src).unwrap_or(Value::Null);
        let line = match run(content.clone(), &v) {
            Ok(b) => format!("{} {}\n", name, crate::hash::hex(b.hash())),
            Err(e) => format!("{} error:{}\n", name, e.replace(' ', "_")),
        };
        out.push_str(&line);
    }
    out
}

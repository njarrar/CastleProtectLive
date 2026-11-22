//! The fixtures in `core/fixtures/`: a setup, a command list, the replies
//! and the snapshots they lead to. `examples/make_fixtures.rs` writes them;
//! a test rebuilds them and compares every file, so they never drift.

use crate::Game;
use serde_json::{json, Value};

fn snap(g: &mut Game) -> Value {
    serde_json::from_str(&g.snapshot()).unwrap_or(Value::Null)
}

fn cmd(g: &mut Game, c: &Value) -> Value {
    serde_json::from_str(&g.command(&c.to_string())).unwrap_or(Value::Null)
}

/// Every fixture file as (file name, JSON).
pub fn build() -> Vec<(&'static str, Value)> {
    let mut out = vec![];
    // 1-1: aim, fire, a lean frame mid flight, the frame after the shot
    let setup = json!({"level": "1-1"});
    let mut g = match Game::new("", &setup.to_string(), 42) {
        Ok(g) => g,
        Err(_) => return out,
    };
    let first = snap(&mut g);
    let chunks = first["terrain"]["chunks"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    let cmds = json!([
        {"cmd": "pick_hob", "hob": 0},
        {"cmd": "pick_shot", "shot": "plain"},
        {"cmd": "aim", "angle": 450, "power": 62},
        {"cmd": "lean_lines", "side": 1, "c": 0, "r": 1}
    ]);
    let replies = cmd(&mut g, &cmds);
    let plan = snap(&mut g);
    let drag = json!({"cmd": "aim", "angle": 455});
    let drag_reply = cmd(&mut g, &drag);
    let aim_lean = snap(&mut g);
    let fire = json!({"cmd": "fire"});
    let fire_reply = cmd(&mut g, &fire);
    let _ = snap(&mut g);
    g.step(30);
    let lean = snap(&mut g);
    g.step(2000);
    let after = snap(&mut g);
    out.push(("setup_1_1.json", setup));
    out.push((
        "commands_1_1.json",
        json!({"seed": 42, "first_snapshot_terrain_chunks": chunks, "commands": cmds,
               "then": [drag, fire, {"step": 30}, {"step": 2000}],
               "plan_hash": plan["hash"], "after_hash": after["hash"]}),
    ));
    out.push((
        "replies_1_1.json",
        json!({"commands": replies, "aim": drag_reply, "fire": fire_reply}),
    ));
    out.push(("snapshot_plan.json", plan));
    out.push(("snapshot_aim_lean.json", aim_lean));
    out.push(("snapshot_lean.json", lean));
    out.push(("snapshot_after_shot.json", after));
    // 1-7 Rescue: props (cage bars, the captive) in a plan frame
    if let Ok(mut g) = Game::new("", r#"{"level":"1-7"}"#, 42) {
        out.push(("snapshot_rescue_1_7.json", snap(&mut g)));
    }
    // 1-10 Grand Fort: the root block and the boss HUD
    if let Ok(mut g) = Game::new("", r#"{"level":"1-10"}"#, 42) {
        let _ = cmd(&mut g, &json!({"cmd": "end_draft"}));
        out.push(("snapshot_boss_1_10.json", snap(&mut g)));
    }
    // Couch Duel with a Help handicap, given up: the result with Buttons,
    // stats and the "what broke you" summary
    let couch = json!({"level": "d1", "mode": "couch", "first_turn": 0,
        "sides": [{"kit": "kit_oak", "help": "some"}, {"kit": "kit_stone", "preview_pct": 45}]});
    if let Ok(mut g) = Game::new("", &couch.to_string(), 7) {
        let _ = cmd(&mut g, &json!({"cmd": "end_draft"}));
        let _ = cmd(&mut g, &json!({"cmd": "aim", "angle": 440, "power": 78}));
        let _ = cmd(&mut g, &json!({"cmd": "fire"}));
        g.step(3000);
        let _ = cmd(&mut g, &json!({"cmd": "give_up", "side": 1}));
        out.push(("setup_couch.json", couch));
        out.push(("snapshot_ended.json", snap(&mut g)));
    }
    out
}

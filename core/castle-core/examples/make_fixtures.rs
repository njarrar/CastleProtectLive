//! Writes core/fixtures/: a setup, a command list, the replies and the
//! snapshots they lead to. Run: cargo run -p castle-core --example make_fixtures
use castle_core::Game;
use serde_json::{json, Value};

fn save(name: &str, v: &Value) {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/");
    std::fs::write(
        format!("{dir}{name}"),
        serde_json::to_string_pretty(v).unwrap() + "\n",
    )
    .unwrap();
}

fn main() {
    let setup = json!({"level": "1-1"});
    let mut g = Game::new("", &setup.to_string(), 42).unwrap();
    let first: Value = serde_json::from_str(&g.snapshot()).unwrap();
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
    let replies: Value = serde_json::from_str(&g.command(&cmds.to_string())).unwrap();
    let plan: Value = serde_json::from_str(&g.snapshot()).unwrap();
    let fire = json!({"cmd": "fire"});
    let fire_reply: Value = serde_json::from_str(&g.command(&fire.to_string())).unwrap();
    let _ = g.snapshot();
    g.step(30);
    let lean: Value = serde_json::from_str(&g.snapshot()).unwrap();
    g.step(2000);
    let after: Value = serde_json::from_str(&g.snapshot()).unwrap();
    save("setup_1_1.json", &setup);
    save(
        "commands_1_1.json",
        &json!({"seed": 42, "first_snapshot_terrain_chunks": chunks, "commands": cmds, "then": [fire, {"step": 30}, {"step": 2000}]}),
    );
    save(
        "replies_1_1.json",
        &json!({"commands": replies, "fire": fire_reply}),
    );
    save("snapshot_plan.json", &plan);
    save("snapshot_lean.json", &lean);
    save("snapshot_after_shot.json", &after);
    println!("fixtures written; first snapshot had {chunks} terrain chunks");
}

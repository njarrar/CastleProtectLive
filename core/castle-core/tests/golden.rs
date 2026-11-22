//! Golden replays: recorded battles whose final state hash is checked in.
//! Set CASTLE_GOLDEN_OUT to a file path to also write "<name> <hash>" lines
//! (used by the cross platform determinism job). Set UPDATE_GOLDEN=1 to
//! rewrite tests/golden/expected.txt after a deliberate rules change.

use castle_core::replay;

#[test]
fn golden_replays_match() {
    let lines = replay::golden_lines();
    if let Ok(path) = std::env::var("CASTLE_GOLDEN_OUT") {
        std::fs::write(&path, &lines).expect("write CASTLE_GOLDEN_OUT");
    }
    let expected_path = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden/expected.txt");
    if std::env::var("UPDATE_GOLDEN").is_ok() {
        std::fs::write(expected_path, &lines).expect("write expected");
        return;
    }
    let expected = std::fs::read_to_string(expected_path).expect("tests/golden/expected.txt");
    assert!(!lines.contains("error:"), "a replay failed: {lines}");
    assert_eq!(lines.trim(), expected.trim(), "golden hashes changed; if the rules change was meant, run with UPDATE_GOLDEN=1");
}

#[test]
fn golden_replays_are_repeatable() {
    assert_eq!(replay::golden_lines(), replay::golden_lines());
}

#[test]
fn golden_command_log_replays_to_same_hash() {
    // The AI's choices go into the command log; replaying the log alone (no
    // AI) must land on the same state.
    use castle_core::{battle::Battle, embedded};
    use std::sync::Arc;
    let content = Arc::new(embedded::content());
    let src = replay::GOLDEN[1].1;
    let v: serde_json::Value = serde_json::from_str(src).unwrap();
    let b = replay::run(content.clone(), &v).unwrap();
    let setup = serde_json::to_string(&v["setup"]).unwrap();
    let mut b2 = Battle::new(content, &setup, v["seed"].as_u64().unwrap()).unwrap();
    for c in &b.log {
        b2.command(c);
        b2.run_until_plan(20_000);
    }
    assert_eq!(b.hash(), b2.hash());
}

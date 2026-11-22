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
    assert_eq!(
        lines.trim(),
        expected.trim(),
        "golden hashes changed; if the rules change was meant, run with UPDATE_GOLDEN=1"
    );
}

#[test]
fn golden_replays_are_repeatable() {
    assert_eq!(replay::golden_lines(), replay::golden_lines());
}

#[test]
fn golden_command_log_replays_to_same_hash() {
    // Each golden's command log (ai_turn included) replays to the same state.
    use castle_core::embedded;
    use std::sync::Arc;
    let content = Arc::new(embedded::content());
    for (name, src) in replay::GOLDEN {
        let v: serde_json::Value = serde_json::from_str(src).unwrap();
        let b = replay::run(content.clone(), &v).unwrap();
        let setup = serde_json::to_string(&v["setup"]).unwrap();
        let b2 = replay::from_log(content.clone(), &setup, v["seed"].as_u64().unwrap(), &b.log)
            .unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(b.hash(), b2.hash(), "{name}: log replay differs");
    }
}

//! Live play against log replay. An app steps the sim a few ticks per frame
//! and sends commands only in `draft` and `plan`; the saved log (setup, seed,
//! commands, `ai_turn` included) must rebuild the same state, hash for hash.

use castle_core::battle::Phase;
use castle_core::{embedded, replay, Battle, Content};
use serde_json::{json, Value};
use std::sync::Arc;

fn content() -> Arc<Content> {
    Arc::new(embedded::content())
}

/// Step like a frame loop: two ticks at a time until the next decision.
fn frames(b: &mut Battle) {
    let mut guard = 0;
    while matches!(b.phase, Phase::Resolve | Phase::Settle(_)) && guard < 100_000 {
        b.step(2);
        let _ = b.snapshot();
        guard += 1;
    }
}

/// Play a golden script live: commands as written, `auto` as ai_turn, steps
/// in frames of two ticks.
fn play_live(content: Arc<Content>, v: &Value) -> Battle {
    let setup = serde_json::to_string(&v["setup"]).unwrap();
    let mut b = Battle::new(content, &setup, v["seed"].as_u64().unwrap()).unwrap();
    for item in v["script"].as_array().unwrap() {
        if let Some(n) = item["step"].as_i64() {
            for _ in 0..n / 2 {
                b.step(2);
                let _ = b.snapshot();
            }
            b.step((n % 2) as i32);
        } else if let Some(n) = item["auto"].as_i64() {
            for _ in 0..n {
                if b.phase == Phase::Ended {
                    break;
                }
                if b.phase == Phase::Draft {
                    b.command(&json!({"cmd": "end_draft"}));
                }
                if b.phase == Phase::Plan {
                    b.command(&json!({"cmd": "ai_turn"}));
                }
                frames(&mut b);
            }
        } else {
            b.command(item);
            let _ = b.snapshot();
        }
    }
    frames(&mut b);
    b
}

#[test]
fn every_golden_live_matches_its_log_replay() {
    let c = content();
    for (name, src) in replay::GOLDEN {
        let v: Value = serde_json::from_str(src).unwrap();
        let live = play_live(c.clone(), &v);
        let scripted = replay::run(c.clone(), &v).unwrap();
        assert_eq!(live.hash(), scripted.hash(), "{name}: frames vs script");
        let setup = serde_json::to_string(&v["setup"]).unwrap();
        let again = replay::from_log(c.clone(), &setup, v["seed"].as_u64().unwrap(), &live.log)
            .unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(live.hash(), again.hash(), "{name}: live vs log replay");
        assert_eq!(live.tick, again.tick, "{name}: tick");
    }
}

#[test]
fn bot_battles_live_match_their_log_replay() {
    let c = content();
    let levels = ["d1", "d2", "1-3", "1-8", "1-10", "1-7"];
    let presets = ["cozy", "fair", "stubborn"];
    for i in 0..9usize {
        let lvl = levels[i % levels.len()];
        let setup = format!(
            r#"{{"level":"{lvl}","mode":"skirmish","sides":[{{"control":"ai","preset":"{}"}},{{"control":"ai","preset":"{}"}}]}}"#,
            presets[i % 3],
            presets[(i / 3) % 3]
        );
        let mut b = Battle::new(c.clone(), &setup, 500 + i as u64).unwrap();
        let mut turns = 0;
        while b.phase != Phase::Ended && turns < 60 {
            if b.phase == Phase::Draft {
                b.command(&json!({"cmd": "ai_turn"}));
            } else if b.phase == Phase::Plan {
                b.command(&json!({"cmd": "ai_turn"}));
                turns += 1;
            }
            frames(&mut b);
        }
        let again = replay::from_log(c.clone(), &setup, 500 + i as u64, &b.log)
            .unwrap_or_else(|e| panic!("{lvl}: {e}"));
        assert_eq!(b.hash(), again.hash(), "battle {i} on {lvl}");
        // the AI memory and streams come back too
        assert_eq!(b.rng.ai, again.rng.ai, "battle {i}: AI streams");
        assert_eq!(
            format!("{:?}", b.ai_mem),
            format!("{:?}", again.ai_mem),
            "battle {i}: AI memory"
        );
    }
}

#[test]
fn resume_rebuilds_the_battle_in_one_command() {
    let c = content();
    let setup = r#"{"level":"d1","mode":"skirmish","sides":[{"control":"human"},{"control":"ai","preset":"fair"}],"first_turn":0}"#;
    let mut b = Battle::new(c.clone(), setup, 9).unwrap();
    b.command(&json!({"cmd": "end_draft"}));
    for _ in 0..6 {
        if b.phase == Phase::Ended {
            break;
        }
        if b.side == 0 {
            b.command(&json!({"cmd": "aim", "angle": 420}));
            b.command(&json!({"cmd": "aim", "power": 71}));
            b.command(&json!({"cmd": "fire"}));
        } else {
            b.command(&json!({"cmd": "ai_turn"}));
        }
        frames(&mut b);
    }
    // a run of aims folds into one log entry
    assert!(b
        .log
        .windows(2)
        .all(|w| !(w[0]["cmd"] == "aim" && w[1]["cmd"] == "aim")));
    let mut r = Battle::new(c, setup, 9).unwrap();
    let reply = r.command(&json!({"cmd": "resume", "log": *b.log}));
    assert_eq!(reply["ok"], true, "{reply}");
    assert_eq!(r.hash(), b.hash());
    assert_eq!(reply["hash"], castle_core::hash::hex(b.hash()));
    // only on a new battle
    let again = r.command(&json!({"cmd": "resume", "log": []}));
    assert_eq!(again["reason"], "cannot_resume");
}

#[test]
fn give_up_mid_flight_replays() {
    let c = content();
    let setup = r#"{"level":"d1","mode":"couch","first_turn":0,"sides":[{"kit":"kit_oak"},{"kit":"kit_stone"}]}"#;
    let mut b = Battle::new(c.clone(), setup, 4).unwrap();
    b.command(&json!({"cmd": "end_draft"}));
    b.command(&json!({"cmd": "aim", "angle": 450, "power": 80}));
    b.command(&json!({"cmd": "fire"}));
    b.step(20);
    let r = b.command(&json!({"cmd": "give_up", "side": 0}));
    assert_eq!(r["ok"], true);
    let res = b.result.clone().unwrap();
    assert_eq!((res.winner, res.how.as_str()), (1, "gave_up"));
    let again = replay::from_log(c, setup, 4, &b.log).unwrap();
    assert_eq!(again.hash(), b.hash());
}

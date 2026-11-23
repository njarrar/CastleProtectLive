//! Regression tests for QA playtest 1 (docs/qa/playtest-1/REPORT.md).
//! Each test names the bug it guards.

use castle_core::battle::Phase;
use castle_core::castle::Slot;
use castle_core::{embedded, Battle, Content};
use serde_json::{json, Value};
use std::sync::Arc;

fn content() -> Arc<Content> {
    Arc::new(embedded::content())
}

fn battle(setup: &str, seed: u64) -> Battle {
    Battle::new(content(), setup, seed).unwrap()
}

fn cmd(b: &mut Battle, v: Value) -> Value {
    b.command(&v)
}

/// Batter a fort and open the room under its roof so that the round 10
/// Fatigue collapse drops the roof onto the kettle and the Hobs.
fn rot(b: &mut Battle, side: usize) {
    let cs = &mut b.castles[side];
    let (kc, kr) = (cs.kettle.c, cs.kettle.r);
    for r in 0..cs.rows {
        for c in 0..cs.cols {
            if let Some(bl) = cs.block_mut(c, r) {
                bl.hp = (bl.max / 2 - 1).max(1);
            }
        }
    }
    // knock out what holds the blocks over the Kettle Room up
    for r in kr + 2..cs.rows {
        for c in [kc - 1, kc + 2] {
            if c >= 0 && c < cs.cols {
                let i = cs.idx(c, r);
                cs.slots[i] = Slot::Empty;
            }
        }
    }
}

fn first_plan(b: &mut Battle) {
    if b.phase == Phase::Draft {
        cmd(b, json!({"cmd": "end_draft"}));
    }
}

fn events(b: &mut Battle) -> Vec<Value> {
    b.snapshot()["events"].as_array().unwrap().clone()
}

#[test]
fn qa_m2_the_round_10_fatigue_collapse_never_ends_the_fight() {
    // QA case: 1-4 on Fair, round 9 of 15, both forts hurt, Marge on 54 HP,
    // the Rival's last Hob on 45 HP. Round 10 used to drop both roofs at
    // once, pop both kettles and end as "Double Pop, the Squall finished
    // your kettle" between two frames.
    let mut b = battle(
        r#"{"level":"1-4","mode":"campaign","first_turn":0,"sides":[{"control":"human"},{"control":"human"}]}"#,
        1,
    );
    first_plan(&mut b);
    for s in 0..2 {
        rot(&mut b, s);
        b.castles[s].kettle_hp = 25;
    }
    for h in b.hobs.iter_mut() {
        let keep = (h.side == 0 && h.def == "marge") || (h.side == 1 && h.id == 3);
        if keep {
            h.hp = if h.side == 0 { 54 } else { 45 };
        } else {
            h.hp = 0;
            h.state = castle_core::hob::HobState::Bonked;
        }
    }
    let _ = b.snapshot();
    b.round = 9;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    let ev = events(&mut b);
    assert_eq!(
        b.phase,
        Phase::Plan,
        "the fight goes on: {:?}",
        b.result.as_ref().map(|r| &r.how)
    );
    assert!(b.result.is_none());
    assert_eq!(b.round, 10);
    assert!(ev.iter().any(|e| e["t"] == "fatigue"));
    let collapses: Vec<&Value> = ev
        .iter()
        .filter(|e| e["t"] == "collapse" && e["why"] == "fatigue")
        .collect();
    assert!(
        collapses.iter().any(|e| e["side"] == 0) && collapses.iter().any(|e| e["side"] == 1),
        "both forts fall with normal collapse events: {ev:?}"
    );
    assert!(ev
        .iter()
        .any(|e| e["t"] == "hit" && e["target"] == "kettle" && e["why"] == "crush"));
    for s in 0..2 {
        assert!(
            b.castles[s].kettle_hp >= 1,
            "Fatigue alone never pops a kettle"
        );
    }
    assert!(!ev
        .iter()
        .any(|e| e["t"] == "kettle_pop" || e["t"] == "bonk" || e["t"] == "win"));
    for side in 0..2u8 {
        assert!(
            b.hobs.iter().any(|h| h.side == side && h.alive()),
            "no Bonk from Fatigue"
        );
    }
}

#[test]
fn qa_m2_fatigue_is_announced_a_round_ahead() {
    let mut b = battle(
        r#"{"level":"1-4","mode":"campaign","first_turn":0,"sides":[{"control":"human"},{"control":"human"}]}"#,
        1,
    );
    first_plan(&mut b);
    b.round = 8;
    assert_eq!(b.snapshot()["hud"]["fatigue_in"], 2);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    let s = b.snapshot();
    assert!(s["events"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["t"] == "fatigue_warning" && e["round"] == 10));
    assert_eq!(s["hud"]["fatigue_in"], 1);
    assert_eq!(s["hud"]["fatigue"], false);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    let s = b.snapshot();
    assert_eq!(s["hud"]["fatigue"], true);
    assert_eq!(s["hud"]["fatigue_in"], Value::Null);
}

#[test]
fn qa_m2_a_double_knockout_outside_the_squall_is_not_called_a_squall() {
    let mut b = battle(
        r#"{"level":"1-4","mode":"campaign","first_turn":0,"sides":[{"control":"human"},{"control":"human"}]}"#,
        1,
    );
    first_plan(&mut b);
    b.castles[0].kettle_hp = 0;
    b.castles[1].kettle_hp = 0;
    assert!(b.check_win());
    let r = b.result.as_ref().unwrap();
    assert_eq!(r.how, "kettle_pop", "not double_pop: there was no Squall");
}

#[test]
fn qa_m1_a_rest_turn_switches_the_picked_knack_to_the_plain_shot() {
    // 1-1: Grand Dumpling, then round 2 is a rest turn for Marge
    let mut b = battle(r#"{"level":"1-1","mode":"campaign"}"#, 3);
    first_plan(&mut b);
    assert_eq!(
        cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}))["ready"],
        true
    );
    cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 70}));
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    b.run_until_plan(10_000);
    assert_eq!(b.side, 1);
    cmd(&mut b, json!({"cmd": "ai_turn"}));
    b.run_until_plan(10_000);
    assert_eq!(b.side, 0);
    assert!(b.hobs[0].rest > 0, "Marge rests");
    let s = b.snapshot();
    assert_eq!(
        s["hud"]["selected"]["shot"], "plain",
        "switched at turn start"
    );
    assert!(s["events"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["t"] == "shot_switch" && e["from"] == "knack" && e["to"] == "plain"));
    assert_eq!(
        s["hud"]["fire"]["ready"], true,
        "Fire is lit for a shot that fires"
    );
    // picking the Knack anyway: the chip and Fire say why, fire refuses with words
    let r = cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    assert_eq!(
        (r["ok"].clone(), r["ready"].clone()),
        (json!(true), json!(false))
    );
    assert_eq!(r["why"], "resting_plain_only");
    let s = b.snapshot();
    assert_eq!(s["hud"]["fire"]["ready"], false);
    assert_eq!(s["hud"]["fire"]["why"], "resting_plain_only");
    assert!(s["hud"]["fire"]["text"].as_str().unwrap().contains("rest"));
    for chip in s["hud"]["shots"].as_array().unwrap() {
        assert_eq!(chip["ready"] == false, chip["why"].is_string(), "{chip}");
        assert_eq!(chip["ready"] == false, chip["text"].is_string(), "{chip}");
    }
    let r = cmd(&mut b, json!({"cmd": "fire"}));
    assert_eq!(r["ok"], false);
    assert_eq!(r["reason"], "resting_plain_only");
    assert!(r["detail"].as_str().unwrap().contains("Marge"));
    assert_eq!(r["ready_shot"], "plain");
    assert_eq!(b.phase, Phase::Plan, "nothing was spent");
}

#[test]
fn qa_m4_the_test_yard_never_hands_the_player_the_dummy_turn() {
    // the web app's setup: both sides human, no crew for the Dummy side
    let mut b = battle(
        r#"{"level":"d1","mode":"test_yard","sides":[{"control":"human","crew":["marge","quill"]},{"control":"human"}]}"#,
        7,
    );
    first_plan(&mut b);
    assert!(b.hobs.iter().filter(|h| h.side == 1).all(|h| h.dummy));
    for i in 0..20 {
        assert_eq!((b.phase, b.side), (Phase::Plan, 0), "turn {i}");
        let s = b.snapshot();
        assert_eq!(s["awaiting"], "human");
        assert_eq!(s["hud"]["side"], 0);
        cmd(&mut b, json!({"cmd": "pick_hob", "hob": 0}));
        let r = cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
        assert_eq!(r["ready"], true, "endless uses, no Rest: {r}");
        cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 75}));
        assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
        b.run_until_plan(100_000);
    }
    assert!(b.result.is_none(), "no round cap or win in the Test Yard");
    assert!(b.round > b.rules.round_cap);
    assert_eq!(b.hobs[0].knack_uses, 2);
}

#[test]
fn qa_m1_best_shot_belongs_to_its_side() {
    for seed in 0..6u64 {
        let mut b = battle(
            r#"{"level":"1-1","mode":"campaign","sides":[{"control":"ai"},{}]}"#,
            seed,
        );
        let mut guard = 0;
        while b.phase != Phase::Ended && guard < 200 {
            castle_core::replay::auto(&mut b, 1);
            guard += 1;
        }
        let s = b.snapshot();
        let r = &s["result"];
        let w = r["winner"].as_u64().unwrap();
        for side in 0..2u64 {
            let best = &r["stats"][side as usize]["best_shot"];
            if best.is_null() {
                continue;
            }
            assert_eq!(best["side"], side);
            let hob = best["hob"].as_u64().unwrap() as usize;
            assert_eq!(
                b.hobs[hob].side as u64, side,
                "the best shot's Hob is on its side"
            );
        }
        assert_eq!(r["best_shot"], r["stats"][w as usize]["best_shot"]);
        // the winning blow counts: the winner landed at least one hit
        assert!(r["stats"][w as usize]["hits"].as_i64().unwrap() > 0 || r["how"] != "clean_sweep");
    }
}

#[test]
fn qa_m6_a_retry_is_a_new_fight_but_the_daily_is_fixed() {
    let h = |setup: &str| {
        let mut b = battle(setup, 42);
        first_plan(&mut b);
        (b.fronts.clone(), b.squall_dir, b.hash())
    };
    let first = h(r#"{"level":"1-4","mode":"campaign"}"#);
    assert_eq!(first, h(r#"{"level":"1-4","mode":"campaign","attempt":0}"#));
    let retry = h(r#"{"level":"1-4","mode":"campaign","attempt":1}"#);
    assert_ne!(first.2, retry.2, "a Retry is not the same fight");
    assert_ne!(
        retry.2,
        h(r#"{"level":"1-4","mode":"campaign","attempt":2}"#).2
    );
    assert_eq!(
        h(r#"{"level":"d1","mode":"daily"}"#),
        h(r#"{"level":"d1","mode":"daily","attempt":3}"#),
        "the Daily stays one fight per date"
    );
    assert!(Battle::new(content(), r#"{"level":"1-4","attempt":-1}"#, 1).is_err());
}

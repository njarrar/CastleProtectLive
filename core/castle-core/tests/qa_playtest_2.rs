//! Regression tests for QA playtest 2 (docs/qa/playtest-2/REPORT.md).
//! Each test names the finding it guards.

use castle_core::battle::Phase;
use castle_core::castle::Slot;
use castle_core::hob::HobState;
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

fn first_plan(b: &mut Battle) {
    if b.phase == Phase::Draft {
        cmd(b, json!({"cmd": "end_draft"}));
    }
}

/// Cut the walls beside a Hob's Nook from its ceiling up (and, with
/// `batter`, take 1 HP off every block), so the round 10 Fatigue collapse
/// drops the roof on that Hob.
fn hang_roof_over(b: &mut Battle, hob: u8, batter: bool) {
    let side = b.hobs[hob as usize].side as usize;
    let n = b.hobs[hob as usize].nook.unwrap() as usize;
    let cs = &mut b.castles[side];
    let (nc, nr) = (cs.nooks[n].c, cs.nooks[n].r);
    for r in 0..cs.rows {
        for c in 0..cs.cols {
            if let Some(bl) = cs.block_mut(c, r).filter(|_| batter) {
                bl.hp -= 1;
            }
        }
    }
    for r in nr + 2..cs.rows {
        for c in [nc - 1, nc + 2] {
            if c >= 0 && c < cs.cols {
                let i = cs.idx(c, r);
                cs.slots[i] = Slot::Empty;
            }
        }
    }
}

/// Pass both turns of round 9 so round 10 (Fatigue) opens; returns the
/// snapshot that carries the round 10 start.
fn into_fatigue(b: &mut Battle) -> Value {
    let _ = b.snapshot();
    b.round = 9;
    for _ in 0..2 {
        cmd(b, json!({"cmd": "pass"}));
        b.run_until_plan(1000);
    }
    assert_eq!(b.round, 10);
    b.snapshot()
}

#[test]
fn qa2_n2_a_hob_crushed_to_1_hp_by_fatigue_is_squashed_not_bonked() {
    // 1-6 on Fair, round 10: the Fatigue collapse took Quill and Jax to 1 HP
    // and the app drew them as Bonked.
    let mut b = battle(
        r#"{"level":"1-6","mode":"campaign","first_turn":0,"sides":[{"control":"human"},{"control":"human"}]}"#,
        1,
    );
    first_plan(&mut b);
    let hob = b.hobs.iter().find(|h| h.side == 0).unwrap().id;
    hang_roof_over(&mut b, hob, false);
    for h in b.hobs.iter_mut().filter(|h| h.side == 0) {
        h.hp = 5;
    }
    let s = into_fatigue(&mut b);
    let ev = s["events"].as_array().unwrap();
    let crushed: Vec<u64> = ev
        .iter()
        .filter(|e| e["t"] == "hit" && e["target"] == "hob" && e["why"] == "crush")
        .map(|e| e["hob"].as_u64().unwrap())
        .collect();
    assert!(crushed.contains(&(hob as u64)), "the roof landed: {ev:?}");
    assert!(!ev.iter().any(|e| e["t"] == "bonk"), "Fatigue Bonks no one");
    let pips = s["hud"]["crew"][0].as_array().unwrap().clone();
    let mut squashed = vec![];
    for &id in &crushed {
        let h = &s["hobs"][id as usize];
        assert_eq!(h["hp"], 1, "crush stops at 1 HP: {h}");
        assert_ne!(h["state"], "bonked", "crushed, alive, not bonked: {h}");
        assert!(
            ["squashed", "dropped", "tumbled"].contains(&h["state"].as_str().unwrap()),
            "{h}"
        );
        assert_eq!(h["can_fire"], true, "a crushed Hob may act: {h}");
        let pip = pips.iter().find(|c| c["id"] == id).unwrap();
        assert_eq!(pip["state"], h["state"]);
        assert!(
            pip["hp_pct"].as_i64().unwrap() >= 1,
            "an alive Hob's pip never reads 0%: {pip}"
        );
        if h["state"] == "squashed" {
            squashed.push(id as usize);
        }
    }
    assert!(!squashed.is_empty(), "a Hob left in its Nook is squashed");
    // squashed Hobs pop back up at the end of their side's turn
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    for id in squashed {
        let st = b.hobs[id].state;
        assert!(
            matches!(st, HobState::Open | HobState::Seated),
            "back up: {st:?}"
        );
        assert_eq!(b.hobs[id].hp, 1);
    }
}

/// Every name in a "what broke you" or best shot entry is a string.
fn assert_named(v: &Value, what: &str) {
    assert!(
        v["hob_name"].as_str().is_some_and(|s| !s.is_empty()),
        "{what}: hob_name {v}"
    );
    assert!(
        v["shot_name"].as_str().is_some_and(|s| !s.is_empty()),
        "{what}: shot_name {v}"
    );
}

fn assert_result_named(r: &Value) {
    let broke = &r["broke"];
    if !broke["last"].is_null() {
        assert_named(&broke["last"], "broke.last");
        assert!(broke["last"]["by"].is_string());
    }
    for t in broke["top"].as_array().unwrap() {
        assert_named(t, "broke.top");
    }
    if !r["best_shot"].is_null() {
        assert_named(&r["best_shot"], "best_shot");
    }
    for s in 0..2 {
        let b = &r["stats"][s]["best_shot"];
        if !b.is_null() {
            assert_named(b, "stats.best_shot");
        }
    }
}

#[test]
fn qa2_b1_a_couch_duel_ended_by_the_squall_names_the_last_blow() {
    // B1: result.broke.last.hob_name was null when the last blow on the
    // losing side had no Hob behind it, and the results screen broke.
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"sides":[{"kit":"kit_oak"},{"kit":"kit_stone"}]}"#,
        7,
    );
    first_plan(&mut b);
    let cap = b.rules.round_cap;
    b.round = cap + 1; // Squall round 1
    b.castles[0].kettle_hp = 20;
    for _ in 0..2 {
        cmd(&mut b, json!({"cmd": "pass"}));
        b.run_until_plan(1000);
    }
    assert_eq!(b.phase, Phase::Ended);
    let s = b.snapshot();
    let r = &s["result"];
    assert_eq!(r["winner"], 1);
    assert_eq!(r["how"], "squall");
    let last = &r["broke"]["last"];
    assert_eq!(last["by"], "squall");
    assert_eq!(last["hob_name"], "The Squall");
    assert_eq!(last["shot_name"], "Squall");
    assert_eq!(last["hob"], Value::Null);
    assert_result_named(r);
}

#[test]
fn qa2_b1_couch_duels_played_to_the_end_always_name_every_blow() {
    // Both seats played by the Fair AI (as a hot seat would), to the end.
    for seed in 0..6u64 {
        let mut b = battle(
            r#"{"level":"d1","mode":"couch","sides":[{"kit":"kit_oak"},{"kit":"kit_reed"}]}"#,
            seed,
        );
        let mut guard = 0;
        while b.phase != Phase::Ended && guard < 400 {
            guard += 1;
            match b.phase {
                Phase::Draft => {
                    cmd(&mut b, json!({"cmd": "end_draft"}));
                }
                Phase::Plan => {
                    cmd(&mut b, json!({"cmd": "ai_turn"}));
                }
                _ => {}
            }
            b.run_until_plan(100_000);
        }
        assert_eq!(b.phase, Phase::Ended, "seed {seed}");
        let s = b.snapshot();
        assert_result_named(&s["result"]);
    }
}

#[test]
fn qa2_b1_field_blows_have_names() {
    let b = battle(r#"{"level":"1-10","mode":"campaign"}"#, 1);
    for (shot, by, who) in [
        ("squall", "squall", "The Squall"),
        ("ground", "ground", "A fall"),
        ("fatigue", "fatigue", "Fatigue"),
        ("self", "self", "Your own shot"),
        ("shears", "shears", "The shears"),
        ("prop", "prop", "A Prop"),
    ] {
        let (b2, s, h) = b.blow_names(shot, -1);
        assert_eq!((b2, h.as_str()), (by, who), "{shot}");
        assert!(!s.is_empty());
    }
    // a woken prop shell is named for its shell
    let (by, s, h) = b.blow_names("tick_tock_crock", -1);
    assert_eq!(by, "prop");
    assert!(
        h.starts_with("A ") && h.len() > 2 && !s.is_empty(),
        "{h} {s}"
    );
    // a Hob's blow names the Hob
    let (by, _, h) = b.blow_names("clodpot", 0);
    assert_eq!(by, "hob");
    assert_eq!(h, b.hobs[0].name);
}

#[test]
fn qa2_b2_the_fatigue_frame_stays_small() {
    // B2 (WebKit died after round 10 on 1-8 and 1-10): the core's round 10
    // frame must stay a normal frame, not a burst. API.md "Frame sizes".
    for lvl in ["1-8", "1-10"] {
        let mut b = battle(
            &format!(
                r#"{{"level":"{lvl}","mode":"campaign","first_turn":0,"sides":[{{"control":"human"}},{{"control":"human"}}]}}"#
            ),
            1,
        );
        first_plan(&mut b);
        for h in b
            .hobs
            .iter()
            .map(|h| h.id)
            .collect::<Vec<_>>()
            .into_iter()
            .take(2)
        {
            hang_roof_over(&mut b, h, true);
        }
        let side1 = b.hobs.iter().find(|h| h.side == 1).unwrap().id;
        hang_roof_over(&mut b, side1, true);
        let s = into_fatigue(&mut b);
        let ev = s["events"].as_array().unwrap();
        assert!(ev.iter().any(|e| e["t"] == "fatigue"));
        assert!(ev.iter().any(|e| e["t"] == "collapse"));
        let bytes = s.to_string().len();
        assert!(bytes < 96 * 1024, "{lvl}: Fatigue frame {bytes} bytes");
        assert!(ev.len() <= 200, "{lvl}: {} events", ev.len());
        assert!(
            s["terrain"]["chunks"].as_array().unwrap().len() <= 64,
            "{lvl}: the Fatigue frame does not resend the map"
        );
    }
}

#[test]
fn qa2_n4_skirmish_rival_grades_follow_the_preset() {
    let setup = |preset: &str, extra: &str| {
        format!(
            r#"{{"level":"d1","mode":"skirmish","sides":[{{"control":"human","crew":["marge","quill","jax","grub"]}},{{"control":"ai","preset":"{preset}","crew":["marge","quill","jax","grub"],"blueprint":"bp_kit_stone"{extra}}}]}}"#
        )
    };
    let hp = |b: &Battle, side: u8| -> Vec<i32> {
        b.hobs
            .iter()
            .filter(|h| h.side == side)
            .map(|h| h.max)
            .collect()
    };
    let full = battle(&setup("stubborn", ""), 1);
    assert_eq!(full.aim_grade[1], 3, "Stubborn keeps the map's grade");
    let fair = battle(&setup("fair", ""), 1);
    assert_eq!(fair.aim_grade[1], 2);
    assert!(fair
        .hobs
        .iter()
        .filter(|h| h.side == 1 && h.knack.is_some())
        .all(|h| h.knack_uses == 1));
    let (f, s) = (hp(&fair, 1), hp(&full, 1));
    for i in 0..f.len() {
        assert_eq!(f[i], s[i] * 90 / 100);
    }
    assert_eq!(hp(&fair, 0), hp(&full, 0), "the player's crew is untouched");
    let cozy = battle(&setup("cozy", ""), 1);
    assert_eq!(cozy.aim_grade[1], 1);
    // a setup aim still wins
    let set = battle(&setup("fair", r#","aim":4"#), 1);
    assert_eq!(set.aim_grade[1], 4);
    // the player's loaner fort is the same kit fort the Rival gets
    assert_eq!(
        fair.castles[0].slots.len(),
        fair.castles[1].slots.len(),
        "mirror loaner forts"
    );
}

#[test]
fn qa2_m7_the_1_7_cage_holds_longer_and_hetty_is_sturdier() {
    let b = battle(r#"{"level":"1-7","mode":"campaign"}"#, 1);
    let bars: Vec<i32> = b
        .props
        .iter()
        .filter(|p| p.kind == "cage_bar")
        .map(|p| p.hp)
        .collect();
    assert_eq!(bars, vec![100, 100, 100]);
    assert_eq!(
        b.props.iter().find(|p| p.kind == "captive").unwrap().hp,
        140
    );
}

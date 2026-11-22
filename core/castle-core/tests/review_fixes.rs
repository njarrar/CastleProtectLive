//! Regression tests for core review 1 (docs/review/code/core-review-1.md).
//! Each test names the finding it guards.

use castle_core::battle::Phase;
use castle_core::castle::Slot;
use castle_core::content::Blueprint;
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

fn couch(seed: u64) -> Battle {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_oak"},{"kit":"kit_stone"}]}"#,
        seed,
    );
    if b.phase == Phase::Draft {
        cmd(&mut b, json!({"cmd": "end_draft"}));
    }
    b
}

#[test]
fn c1_a_beam_straight_up_ends_cleanly() {
    // Quill's Sunspear at 90.0 degrees, power 100: used to overflow.
    let mut b = battle(
        r#"{"level":"1-2","sides":[{},{"control":"human"}],"first_turn":0,"rummage":{"pool":0,"picks":0}}"#,
        1,
    );
    let quill = b.hobs.iter().find(|h| h.def == "quill").unwrap().id;
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": quill}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    cmd(&mut b, json!({"cmd": "aim", "angle": 900, "power": 100}));
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    let n = b.run_until_plan(10_000);
    assert!(n < 200, "the beam leaves the top at once ({n} ticks)");
    let s = b.snapshot();
    assert!(s["events"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["t"] == "miss"));
}

#[test]
fn c1_every_shot_at_the_edges_never_panics() {
    // Fuzz: every shot (plain, Knack, Trick) at 0, 900 and 1800, power 0 and 100.
    let c = content();
    let tricks: Vec<String> = c
        .shots
        .iter()
        .filter(|s| s.kind == castle_core::content::ShotKind::Trick)
        .map(|s| s.id.clone())
        .collect();
    for angle in [0, 450, 880, 900, 920, 1800] {
        for power in [0, 1, 100] {
            for (k, kit) in ["kit_oak", "kit_stone", "kit_reed"].iter().enumerate() {
                for hob in 0..4usize {
                    for shot in ["plain", "knack"]
                        .iter()
                        .map(|s| s.to_string())
                        .chain(tricks.iter().take(if hob == 0 { 8 } else { 0 }).cloned())
                    {
                        let mut b = battle(
                            &format!(
                                r#"{{"level":"d2","mode":"couch","first_turn":1,"rummage":{{"pool":0,"picks":0}},"sides":[{{"kit":"kit_oak"}},{{"kit":"{kit}"}}]}}"#
                            ),
                            (angle + power + k as i32) as u64,
                        );
                        let id = b.hobs.iter().filter(|h| h.side == 1).nth(hob).unwrap().id;
                        if shot != "plain" && shot != "knack" {
                            b.hands[1].push(shot.clone());
                        }
                        cmd(&mut b, json!({"cmd": "pick_hob", "hob": id}));
                        cmd(&mut b, json!({"cmd": "pick_shot", "shot": shot}));
                        cmd(
                            &mut b,
                            json!({"cmd": "aim", "angle": angle, "power": power}),
                        );
                        cmd(&mut b, json!({"cmd": "fire"}));
                        let n = b.run_until_plan(20_000);
                        assert!(n < 900, "{kit} {hob} {shot} {angle}/{power}: {n} ticks");
                        let _ = b.snapshot();
                    }
                }
            }
        }
    }
}

#[test]
fn c2_a_crock_wake_that_breaks_other_props_does_not_panic() {
    let mut b = couch(3);
    let crock = b.shot_index("crock_prop").unwrap();
    let turnip = b.shot_index("turnip_prop").unwrap();
    let x = b.castles[0].x + b.castles[0].width_cells() + 200;
    let y = b.terrain.surface(x) - 1;
    let mk = |id: u32, side: u8, shot: usize, x: i32, hp: i32| castle_core::battle::Prop {
        id,
        side,
        shot: Some(shot),
        x,
        y,
        hp,
        max: hp,
        kind: "shell".into(),
        tag: String::new(),
        stops_rollers: false,
    };
    // an old turnip first, then the crock beside it, plus a rival crock
    b.props.push(mk(900, 0, turnip, x - 20, 10));
    b.props.push(mk(901, 0, crock, x, 30));
    b.props.push(mk(902, 1, crock, x + 400, 30));
    b.props.push(mk(903, 0, turnip, x + 20, 10));
    b.begin_turn(0);
    assert!(b.props.iter().all(|p| p.id != 901), "own crock woke");
    assert!(
        b.props.iter().any(|p| p.id == 902),
        "the rival crock did not go off early"
    );
}

#[test]
fn h1_a_mound_on_the_roof_does_not_lift_a_walking_fort() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0}}"#,
        2,
    );
    let cs = &b.castles[0];
    let (x, top) = (cs.x + cs.width_cells() / 2, cs.top_y());
    let base0 = cs.base_y;
    let ix = b.shot_index("sod_sack").unwrap();
    let mut a = b.aim_probe(1, 4, ix, 0, 0);
    a.probe = false;
    b.begin_ctx(1, None, None, false);
    let effs = b.content.shots[ix].triggers[0].effects.clone();
    b.run_effects(&effs, &a, x, top - 4, None, false);
    b.finish_ctx();
    // no dirt inside the fort's own box
    let cs = &b.castles[0];
    for yy in cs.top_y()..cs.base_y {
        for xx in cs.x..cs.x + cs.width_cells() {
            assert_eq!(b.terrain.get(xx, yy), 0, "dirt at {xx},{yy}");
        }
    }
    let r = cmd(&mut b, json!({"cmd": "walk", "dx": 4}));
    assert_eq!(r["ok"], true, "{r}");
    assert!(
        (b.castles[0].base_y - base0).abs() <= castle_core::battle::WALK_CLIMB,
        "base_y {} from {base0}",
        b.castles[0].base_y
    );
}

#[test]
fn h2_a_plain_shot_while_resting_keeps_the_rest_cog() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":1,"rummage":{"pool":0,"picks":0},"sides":[{"crew":["old_thumper"]},{"crew":["marge"]}]}"#,
        5,
    );
    let t = b.hobs.iter().find(|h| h.def == "old_thumper").unwrap().id;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(10_000);
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 10}));
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    b.run_until_plan(10_000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(10_000);
    // all resting: the Plain Shot is allowed and must not wipe Rest
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "plain"}));
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    assert!(b.hobs[t as usize].rest > 0, "rest kept");
    b.run_until_plan(10_000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(10_000);
    // Heavy sits out two turns: still resting, the Knack is refused
    assert!(b.hobs[t as usize].rest > 0);
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    assert_eq!(
        cmd(&mut b, json!({"cmd": "fire"}))["reason"],
        "resting_plain_only"
    );
}

#[test]
fn h3_m7_cozy_never_threads_and_no_ai_fires_a_dud() {
    let c = content();
    for i in 0..6u64 {
        let mut b = Battle::new(
            c.clone(),
            r#"{"level":"1-2","mode":"skirmish","sides":[{"control":"ai","preset":"cozy"},{"control":"ai","preset":"cozy"}],"rummage":{"pool":6,"picks":2,"source":["old_turnip","pudding_bomb","old_turnip","lid_lifter","marble_sack","nosy_goose"]}}"#,
            40 + i,
        )
        .unwrap();
        let mut turns = 0;
        while b.phase != Phase::Ended && turns < 40 {
            if b.phase == Phase::Draft {
                cmd(&mut b, json!({"cmd": "end_draft"}));
            }
            if b.phase == Phase::Plan {
                let r = cmd(&mut b, json!({"cmd": "ai_turn"}));
                for c2 in r["commands"].as_array().unwrap() {
                    assert_ne!(c2["shot"], "old_turnip", "the AI fired a Dud");
                }
                turns += 1;
            }
            b.run_until_plan(100_000);
            for e in b.snapshot()["events"].as_array().unwrap() {
                assert_ne!(e["t"], "threaded", "a Cozy Rival Threaded");
            }
        }
    }
}

#[test]
fn h3_the_ai_spreads_its_shots_over_the_crew() {
    // Turns where two or more Hobs could fire: no Hob takes most of them.
    let c = content();
    let mut over = 0;
    let mut sides = 0;
    for i in 0..6u64 {
        let lvl = ["d1", "1-8", "d2"][i as usize % 3];
        let mut b = Battle::new(
            c.clone(),
            &format!(r#"{{"level":"{lvl}","mode":"skirmish","sides":[{{"control":"ai"}},{{"control":"ai"}}]}}"#),
            900 + i,
        )
        .unwrap();
        let mut count = [[0i32; 16]; 2];
        let mut turns = 0;
        while b.phase != Phase::Ended && turns < 40 {
            if b.phase == Phase::Draft {
                cmd(&mut b, json!({"cmd": "end_draft"}));
            }
            if b.phase == Phase::Plan {
                let side = b.side;
                let able = b
                    .hobs
                    .iter()
                    .filter(|h| h.side == side && b.can_fire_hob(side, h.id))
                    .count();
                let r = cmd(&mut b, json!({"cmd": "ai_turn"}));
                if able >= 2 {
                    for c2 in r["commands"].as_array().unwrap() {
                        if c2["cmd"] == "pick_hob" {
                            count[side as usize][c2["hob"].as_u64().unwrap() as usize] += 1;
                        }
                    }
                }
                turns += 1;
            }
            b.run_until_plan(100_000);
        }
        for s in &count {
            let total: i32 = s.iter().sum();
            if total >= 4 {
                sides += 1;
                if *s.iter().max().unwrap() * 100 > total * 75 {
                    over += 1;
                }
            }
        }
    }
    assert!(over * 2 <= sides, "{over} of {sides} sides lean on one Hob");
}

#[test]
fn h4_aim_sends_a_lean_snapshot_with_the_aim_and_preview() {
    let mut b = couch(1);
    let first = b.snapshot();
    assert_eq!(first["map"]["chunk"], 64);
    assert_eq!(first["hud"]["steam_max"][1], 120);
    let r = cmd(&mut b, json!({"cmd": "aim", "angle": 500, "power": 70}));
    assert_eq!(r["ok"], true);
    let s = b.snapshot();
    assert_eq!(s["full"], false, "an aim is a lean frame");
    assert_eq!(s["aim"]["angle"], 500);
    assert!(!s["preview"].as_array().unwrap().is_empty());
    // the rival's aim is not shown
    let full = {
        cmd(&mut b, json!({"cmd": "pick_hob", "hob": 0}));
        b.snapshot()
    };
    for h in full["hobs"].as_array().unwrap() {
        assert_eq!(h["aim"].is_null(), h["side"] != json!(0));
    }
}

#[test]
fn h4_the_terrain_hash_is_incremental_and_exact() {
    let mut b = couch(1);
    let x = 1000;
    let top = b.terrain.surface(x);
    b.terrain.carve(x, top + 20, 30, true);
    b.terrain.stamp(x + 100, top - 10, 12, 1, |_, _| false);
    assert_eq!(b.terrain.full_tile_hashes(), b.terrain.tile_hashes());
}

#[test]
fn m1_a_fatigue_collapse_that_pops_a_kettle_ends_the_fight() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"blueprint":"bp_home_3_cobble","crew":["marge"]},{"kit":"kit_oak"}]}"#,
        5,
    );
    // open the Kettle Room ceiling, batter the roof arms over the kettle
    let cs = &mut b.castles[0];
    for c in [1, 2] {
        let i = cs.idx(c, 3);
        cs.slots[i] = Slot::Empty;
        cs.block_mut(c, 6).unwrap().hp -= 1;
    }
    cs.kettle_hp = 20;
    b.round = 9;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert_eq!(b.side, 1);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert_eq!(
        b.phase,
        Phase::Ended,
        "the round 10 collapse popped the kettle"
    );
    let r = b.result.as_ref().unwrap();
    assert_eq!((r.winner, r.how.as_str()), (1, "kettle_pop"));
}

#[test]
fn m2_barn_raising_puff_up_does_not_also_rebuild() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":1,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_oak"},{"kit":"kit_stone"}]}"#,
        5,
    );
    let hetty = b.hobs.iter().find(|h| h.def == "hetty").unwrap().id;
    let other = b
        .hobs
        .iter()
        .find(|h| h.side == 1 && h.id != hetty)
        .unwrap()
        .id;
    b.hobs[other as usize].hp = 0;
    b.hobs[other as usize].state = castle_core::hob::HobState::Bonked;
    let cs = &mut b.castles[1];
    for c in 0..4 {
        let i = cs.idx(c, cs.rows - 1);
        cs.slots[i] = Slot::Empty;
    }
    let _ = b.snapshot();
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": hetty}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    let r = cmd(&mut b, json!({"cmd": "fire", "dial": "puff_up"}));
    assert_eq!(r["ok"], true, "{r}");
    let ev = b.snapshot()["events"].as_array().unwrap().clone();
    assert!(ev.iter().any(|e| e["t"] == "puff_up"));
    assert!(!ev.iter().any(|e| e["t"] == "rebuild"), "no rebuild");
}

#[test]
fn m3_bad_numbers_are_refused_never_wrapped() {
    let mut b = couch(1);
    for c in [
        json!({"cmd": "walk", "dx": -2147483648i64}),
        json!({"cmd": "pick_hob", "hob": 256}),
        json!({"cmd": "recall", "ghost": 4294967296u64}),
        json!({"cmd": "aim", "angle": 452.7}),
        json!({"cmd": "aim", "angle": 12.0}),
        json!({"cmd": "aim", "power": 101}),
        json!({"cmd": "aim", "angle": "45"}),
        json!({"cmd": "shove_off", "hob": -1}),
        json!({"cmd": "fire", "target": [1, 2, 3]}),
        json!({"cmd": "doodad", "doodad": "mend_bucket", "targets": [[0.5, 1]]}),
        json!({"cmd": "lean_lines", "side": 2, "c": 0, "r": 1}),
    ] {
        let r = cmd(&mut b, c.clone());
        assert_eq!(r["ok"], false, "{c} -> {r}");
        assert!(
            r["reason"] == "bad_value" || r["reason"] == "bad_hob",
            "{c} -> {r}"
        );
    }
    // recall outside plan is refused and not logged
    cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 80}));
    cmd(&mut b, json!({"cmd": "fire"}));
    let r = cmd(&mut b, json!({"cmd": "recall", "ghost": 0}));
    assert_eq!(r["reason"], "not_planning");
    assert!(b.log.iter().all(|c| c["cmd"] != "recall"));
    // setup numbers
    for s in [
        r#"{"level":"d1","sides":[{"steam":2147483647}]}"#,
        r#"{"level":"d1","round_cap":0}"#,
        r#"{"level":"d1","first_turn":7}"#,
        r#"{"level":"d1","sides":[{"help":"tons"}]}"#,
        r#"{"level":"d1","sides":[{"doodads":["no_such"]}]}"#,
    ] {
        assert!(Battle::new(content(), s, 1).is_err(), "{s}");
    }
}

#[test]
fn m4_every_state_field_moves_the_hash() {
    let base = couch(2);
    let h0 = base.hash();
    type Change = Box<dyn Fn(&mut Battle)>;
    let changes: Vec<(&str, Change)> = vec![
        (
            "doodads",
            Box::new(|b| {
                b.doodads[0].pop();
            }),
        ),
        ("squall_dir", Box::new(|b| b.squall_dir = -b.squall_dir)),
        ("fronts", Box::new(|b| b.fronts[3] += 1)),
        ("first_side", Box::new(|b| b.first_side = 1 - b.first_side)),
        ("acted", Box::new(|b| b.acted = !b.acted)),
        ("selection", Box::new(|b| b.sel[0].shot = "knack".into())),
        ("buried", Box::new(|b| b.hobs[0].buried = !b.hobs[0].buried)),
        ("grudge", Box::new(|b| b.hobs[0].grudge = true)),
        ("clatter", Box::new(|b| b.hobs[0].clatter = true)),
        ("extra_rest", Box::new(|b| b.hobs[0].extra_rest = true)),
        ("puff_up_used", Box::new(|b| b.puff_up_used[0] = true)),
        ("turns_taken", Box::new(|b| b.turns_taken[1] += 1)),
        ("score", Box::new(|b| b.stats[0].score += 1)),
        (
            "block max",
            Box::new(|b| b.castles[0].block_mut(0, 1).unwrap().max += 1),
        ),
        (
            "block root",
            Box::new(|b| b.castles[0].block_mut(0, 1).unwrap().root = true),
        ),
        ("ai memory", Box::new(|b| b.ai_mem[1].walks += 1)),
        (
            "ai stream",
            Box::new(|b| {
                b.rng.ai[1].next_u32();
            }),
        ),
        ("draft pool", Box::new(|b| b.draft.pool.push("pan".into()))),
        ("terrain", Box::new(|b| b.terrain.set(5, 5, 1))),
    ];
    for (name, f) in changes {
        let mut b = base.clone();
        f(&mut b);
        assert_ne!(b.hash(), h0, "{name} is not in the hash");
    }
}

#[test]
fn m5_no_shot_flies_longer_than_six_seconds() {
    let mut b = couch(1);
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": 1}));
    cmd(&mut b, json!({"cmd": "aim", "angle": 850, "power": 100}));
    cmd(&mut b, json!({"cmd": "fire"}));
    let n = b.run_until_plan(100_000);
    assert!(n <= castle_core::battle::MAX_ACTOR_AGE + 120, "{n}");
}

#[test]
fn m8_rescue_has_no_squall_and_needs_the_rescue() {
    let mut b = battle(r#"{"level":"1-7","sides":[{},{"control":"human"}]}"#, 3);
    assert!(!b.rules.squall);
    // the rival kettle popping does not free Hetty
    b.castles[1].kettle_hp = 0;
    assert!(!b.check_win(), "no win without the rescue");
    b.castles[1].kettle_hp = 300;
    // the captive Bonked: the player loses
    let cap = b.props.iter().position(|p| p.kind == "captive").unwrap();
    b.props[cap].hp = 0;
    assert!(b.check_win());
    assert_eq!(b.result.as_ref().unwrap().how, "captive_bonked");
    // the cap runs out: the rival wins
    let mut b = battle(r#"{"level":"1-7","sides":[{},{"control":"human"}]}"#, 3);
    for _ in 0..40 {
        if b.phase == Phase::Ended {
            break;
        }
        cmd(&mut b, json!({"cmd": "pass"}));
        b.run_until_plan(1000);
    }
    let r = b.result.as_ref().unwrap();
    assert_eq!((r.winner, r.how.as_str()), (1, "round_cap"));
}

#[test]
fn m9_the_validator_and_content_check_refuse_broken_data() {
    let c = content();
    let hanging = Blueprint {
        id: "x".into(),
        name: String::new(),
        rows: vec![
            "ttttttt".into(),
            "t11t22t".into(),
            "t11t22t".into(),
            "ttttttt".into(),
            "tKKt33t".into(),
            "tKKt33t".into(),
            "FFFFFFF".into(),
        ]
        .into_iter()
        .enumerate()
        .map(|(i, r): (usize, String)| if i == 0 { "tttt.tt".to_string() } else { r })
        .collect(),
    };
    // a hanging block: no support (here the roof over a gap is fine, so cut more)
    let mut bp = hanging.clone();
    bp.rows[0] = "t......".into();
    bp.rows.insert(0, "ttttttt".into());
    assert!(castle_core::castle::validate_blueprint(&c, &bp, 3).is_err());
    let mut b = couch(1);
    let r = cmd(
        &mut b,
        json!({"cmd": "validate_blueprint", "rows": bp.rows, "seats": 3}),
    );
    assert_eq!(r["ok"], false);
    assert!(!r["cells"].as_array().unwrap().is_empty(), "{r}");
    let good = cmd(
        &mut b,
        json!({"cmd": "validate_blueprint", "rows": ["ttttttt","t11t22t","t11t22t","ttttttt","tKKt33t","tKKt33t","FFFFFFF"], "seats": 3}),
    );
    assert_eq!(good["ok"], true);
    assert_eq!(good["budget"], 72);
    assert!(good["cost"].as_i64().unwrap() > 0);
    // content checks
    let bad = |f: &dyn Fn(&mut Content)| {
        let mut c2 = (*c).clone();
        f(&mut c2);
        c2.check().is_err()
    };
    assert!(bad(&|c| {
        let s = c.shots[0].clone();
        c.shots.push(s);
    }));
    assert!(bad(&|c| c.levels[0].width = 0));
    assert!(bad(&|c| c.levels[0].pennants[1].kind = "no_such".into()));
    assert!(bad(&|c| {
        let l = c.levels.iter_mut().find(|l| l.kind == "rescue").unwrap();
        l.rules.squall = true;
    }));
    assert!(bad(&|c| {
        let i = c.shots.iter().position(|s| s.id == "pan").unwrap();
        c.shots[i].triggers.push(castle_core::content::Trigger {
            on: castle_core::content::TriggerOn::Impact,
            dial: None,
            effects: vec![castle_core::content::Effect::Split {
                child: "pan_parade".into(),
                count: 1,
                spread: 0,
                speed_step: 0,
                centered: true,
                speed_abs: 0,
                replace: true,
            }],
        });
    }));
}

#[test]
fn m10_squall_breaks_are_events_and_the_pop_is_sent_once() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","round_cap":1,"first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_reed"},{"kit":"kit_reed"}]}"#,
        5,
    );
    b.castles[0].kettle_hp = 40;
    let top = b.castles[0].rows - 1;
    for c in 0..b.castles[0].cols {
        if let Some(x) = b.castles[0].block_mut(c, top) {
            x.hp = 5;
        }
    }
    let mut pops = 0;
    let mut breaks = 0;
    for _ in 0..8 {
        if b.phase == Phase::Ended {
            break;
        }
        cmd(&mut b, json!({"cmd": "pass"}));
        b.run_until_plan(1000);
        for e in b.snapshot()["events"].as_array().unwrap() {
            if e["t"] == "kettle_pop" {
                pops += 1;
            }
            if e["t"] == "break" && e["why"] == "squall" {
                breaks += 1;
            }
        }
    }
    assert_eq!(pops, 1);
    assert!(breaks > 0, "worn blocks break in the first Squall");
}

#[test]
fn l3_a_flat_pepper_rain_still_splits() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"crew":["jax","marge"]},{"kit":"kit_oak"}]}"#,
        5,
    );
    let jax = b.hobs.iter().find(|h| h.def == "jax").unwrap().id;
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": jax}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    cmd(&mut b, json!({"cmd": "aim", "angle": 0, "power": 60}));
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    let mut split = false;
    for _ in 0..200 {
        b.step(1);
        split |= b.events.iter().any(|e| e["t"] == "split");
    }
    assert!(split);
}

#[test]
fn l7_wasted_actions_are_refused_before_paying() {
    let mut b = couch(1);
    let r = cmd(&mut b, json!({"cmd": "doodad", "doodad": "mend_bucket"}));
    assert_eq!(r["reason"], "nothing_to_mend");
    assert_eq!(b.doodads[0].len(), 2, "not spent");
}

#[test]
fn give_up_help_rewards_and_what_broke_you() {
    let mut b = battle(
        r#"{"level":"1-3","sides":[{"help":"lots"},{}],"rummage":{"pool":0,"picks":0},"progress":{"cleared":false}}"#,
        3,
    );
    assert_eq!(b.castles[0].steam, 140, "Help: lots");
    let s = b.snapshot();
    assert_eq!(s["hud"]["handicap"][0]["help"], "lots");
    // the Rival hits us, then we give up
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "ai_turn"}));
    b.run_until_plan(10_000);
    let r = cmd(&mut b, json!({"cmd": "give_up"}));
    assert_eq!(r["side"], 0);
    let s = b.snapshot();
    let res = &s["result"];
    assert_eq!(res["how"], "give_up");
    assert_eq!(res["buttons"], 40, "a loss pays 40");
    assert_eq!(res["broke"]["side"], 0);
    assert!(res["stats"][1]["shots"].as_i64().unwrap() >= 1);
    // a first clear win: 200 + 25 per Pennant
    let mut b = battle(
        r#"{"level":"1-3","sides":[{},{"control":"human"}],"rummage":{"pool":0,"picks":0}}"#,
        3,
    );
    cmd(&mut b, json!({"cmd": "give_up", "side": 1}));
    let r = b.result.clone().unwrap();
    let n = r.pennants.iter().filter(|p| **p).count() as i32;
    assert_eq!(r.buttons, 200 + 25 * n);
    // couch pays nothing
    let mut b = couch(1);
    cmd(&mut b, json!({"cmd": "give_up"}));
    assert_eq!(b.result.unwrap().buttons, 0);
}

#[test]
fn volley_points_counts_actions_and_never_ends_early() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","volley":6,"first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_oak"},{"kit":"kit_oak"}]}"#,
        5,
    );
    assert!(Battle::new(content(), r#"{"level":"1-3","volley":6}"#, 1).is_err());
    assert!(!b.rules.squall);
    // a popped kettle relights at the owner's next turn
    b.castles[1].kettle_hp = 0;
    assert!(!b.check_win());
    let mut turns = 0;
    while b.phase != Phase::Ended && turns < 30 {
        if b.side == 0 {
            cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 79}));
            cmd(&mut b, json!({"cmd": "fire"}));
        } else {
            cmd(&mut b, json!({"cmd": "pass"}));
            if turns == 1 {
                assert_eq!(b.castles[1].kettle_hp, 150, "relit");
            }
        }
        b.run_until_plan(10_000);
        turns += 1;
    }
    assert_eq!(turns, 12, "6 Actions each");
    let r = b.result.unwrap();
    assert_eq!(r.how, "volley_points");
    assert_eq!(
        r.winner,
        if b.stats[0].score > b.stats[1].score {
            0
        } else {
            1
        }
    );
}

#[test]
fn boss_phases_two_and_three_roller_and_shears() {
    let mut b = battle(
        r#"{"level":"1-10","sides":[{},{"control":"human"}],"rummage":{"pool":0,"picks":0}}"#,
        3,
    );
    assert_eq!(b.boss.phase, 1);
    // phase 2 then 3 on the boss's turn starts
    b.castles[1].kettle_hp = 200;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert_eq!(b.boss.phase, 2);
    let roller = b.boss.roller.unwrap();
    let x0 = b.props.iter().find(|p| p.id == roller).unwrap().x;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    let x1 = b.props.iter().find(|p| p.id == roller).unwrap().x;
    assert_eq!(x0 - x1, 120, "the roller rolled toward the player");
    b.castles[1].kettle_hp = 90;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert_eq!(b.boss.phase, 3);
    assert!(b.boss.hinge.is_some());
    // open, then snip the top rows of the tallest column
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert!(b.boss.cut.is_some(), "cut line shown a turn ahead");
    let before = b.castles[0]
        .slots
        .iter()
        .filter(|s| matches!(s, Slot::Block(_)))
        .count();
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    let after = b.castles[0]
        .slots
        .iter()
        .filter(|s| matches!(s, Slot::Block(_)))
        .count();
    assert!(after < before, "the shears snipped");
    // the hinge broken: jammed
    let h = b.boss.hinge.unwrap();
    b.props.iter_mut().find(|p| p.id == h).unwrap().hp = 0;
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert!(b.boss.jam > 0 || b.phase == Phase::Ended);
}

#[test]
fn test_yard_set_wind_and_dummy_side_passes_itself() {
    let mut b = battle(
        r#"{"level":"d1","mode":"test_yard","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{},{"control":"human","crew":["straw_stuffer"]}]}"#,
        1,
    );
    assert_eq!(
        cmd(&mut b, json!({"cmd": "set_wind", "wind": -4}))["ok"],
        true
    );
    assert_eq!(b.wind, -4);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert_eq!(b.side, 0, "the dummy side passed itself");
    let mut c = couch(1);
    assert_eq!(
        cmd(&mut c, json!({"cmd": "set_wind", "wind": 1}))["reason"],
        "test_yard_only"
    );
}

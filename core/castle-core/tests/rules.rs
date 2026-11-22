//! Unit tests for the rules: maths, terrain, support and collapse, damage
//! clamps, Cover, Loophole Flap, turns, Steam, the Squall and the AI.

use castle_core::actor::Hit;
use castle_core::battle::{Phase, KETTLE_CAP};
use castle_core::castle::Slot;
use castle_core::content::Blueprint;
use castle_core::hob::HobState;
use castle_core::math::*;
use castle_core::rng::Sfc32;
use castle_core::{embedded, Battle, Content};
use serde_json::json;
use std::sync::Arc;

fn content() -> Arc<Content> {
    Arc::new(embedded::content())
}

fn battle(setup: &str, seed: u64) -> Battle {
    Battle::new(content(), setup, seed).unwrap()
}

fn cmd(b: &mut Battle, v: serde_json::Value) -> serde_json::Value {
    b.command(&v)
}

#[test]
fn trig_table_is_sane() {
    for t in (0..3600).step_by(7) {
        let s = sin_t(t) as i64;
        let c = cos_t(t) as i64;
        let one = (s * s + c * c) >> 16;
        assert!((one - 65536).abs() < 8, "angle {t}");
    }
    assert_eq!(sin_t(900), FX_ONE);
    assert_eq!(cos_t(1800), -FX_ONE);
    assert_eq!(atan2_t(1, 1), 450);
    assert_eq!(atan2_t(1, -1), 1350);
    assert_eq!(isqrt(1_000_000), 1000);
    assert_eq!(isqrt(999_999), 999);
}

#[test]
fn rng_streams_are_named_and_repeatable() {
    let mut a = Sfc32::new(5, "battle");
    let mut b = Sfc32::new(5, "battle");
    let mut c = Sfc32::new(5, "ai.0");
    let xa: Vec<u32> = (0..8).map(|_| a.next_u32()).collect();
    let xb: Vec<u32> = (0..8).map(|_| b.next_u32()).collect();
    let xc: Vec<u32> = (0..8).map(|_| c.next_u32()).collect();
    assert_eq!(xa, xb);
    assert_ne!(xa, xc);
}

#[test]
fn gravity_and_range_match_the_canon() {
    // 600 cells/s^2 at 120 Hz
    assert_eq!(accel_q(600), 2731);
    // a probe at 45 degrees, power 100, no wind, from a high point flies
    // about 2400 cells on level ground (we only check it flies far and lands)
    let mut b = battle(r#"{"level":"d1"}"#, 1);
    b.wind = 0;
    let h = b.hobs.iter().find(|h| h.side == 0).unwrap().id;
    let ix = b.shot_index("clodpot").unwrap();
    let a = b.aim_probe(0, h, ix, 450, 50);
    let mut u = 0;
    let (_, end, _) = b.probe_path(a, 2000, false, &mut u);
    let (lx, _) = b.launch_point(h);
    // power 50: 600 cells/s, range about 600 cells at the same height
    let d = end.0 - lx;
    assert!(d > 450 && d < 800, "range {d}");
}

#[test]
fn blueprint_validator() {
    let c = content();
    let ok = Blueprint {
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
        ],
    };
    castle_core::castle::validate_blueprint(&c, &ok, 3).unwrap();
    assert!(
        castle_core::castle::validate_blueprint(&c, &ok, 4).is_err(),
        "seats"
    );
    let open = Blueprint {
        id: "x".into(),
        name: String::new(),
        rows: vec![
            "ttttttt".into(),
            "t11t22.".into(),
            "t11t22t".into(),
            "ttttttt".into(),
            "tKKt33t".into(),
            "tKKt33t".into(),
            "FFFFFFF".into(),
        ],
    };
    assert!(
        castle_core::castle::validate_blueprint(&c, &open, 3).is_err(),
        "unwalled nook"
    );
    let edge = Blueprint {
        id: "x".into(),
        name: String::new(),
        rows: vec!["tttt".into(), "KKtt".into(), "KKtt".into(), "FFFF".into()],
    };
    assert!(
        castle_core::castle::validate_blueprint(&c, &edge, 0).is_err(),
        "kettle on the face"
    );
}

/// A test fort: footing plus a column and an arm.
fn arm_fort(mat: char, reach: usize) -> Blueprint {
    let w = 7;
    let mut top = String::new();
    top.push(mat);
    for i in 1..w {
        top.push(if i <= reach { mat } else { '.' });
    }
    let mut rows = vec![top];
    rows.extend(
        ["t......", "tttt...", "tKKt...", "tKKt...", "FFFFFFF"]
            .iter()
            .map(|s| s.to_string()),
    );
    let _ = w;
    Blueprint {
        id: "arm".into(),
        name: String::new(),
        rows,
    }
}

#[test]
fn side_support_reach_by_material() {
    let c = content();
    for (mat, reach, ok) in [
        ('t', 2, true),
        ('t', 3, false),
        ('c', 1, true),
        ('c', 2, false),
        ('w', 2, true),
    ] {
        let bp = arm_fort(mat, reach);
        let cs = castle_core::castle::Castle::from_blueprint(&c, &bp, 0, 100).unwrap();
        let falls = cs.falling_chunks(&c, &[]);
        assert_eq!(falls.is_empty(), ok, "{mat} reach {reach}: {falls:?}");
    }
}

#[test]
fn lean_lines_show_what_falls() {
    let c = content();
    let bp = arm_fort('t', 2);
    let cs = castle_core::castle::Castle::from_blueprint(&c, &bp, 0, 100).unwrap();
    // the top row is (0..=2, 5); the column under it is (0, 4)
    let falls = cs.lean_lines(&c, 0, 4, &[]);
    assert_eq!(falls, vec![(0, 5), (1, 5), (2, 5)]);
    assert!(cs.lean_lines(&c, 2, 5, &[]).is_empty());
}

#[test]
fn collapse_crushes_and_kettle_takes_half() {
    let mut b = battle(
        r#"{"level":"d1","sides":[{},{"crew":["hedge_snipper","rake_hand","pebble_pitcher"],"rows":["ccccccc","ttttttt","t11t22t","t11t22t","ttttttt","tKKt33t","tKKt33t","FFFFFFF"]}]}"#,
        1,
    );
    let c = b.content.clone();
    // break the walls holding the top two rows above the kettle column
    let cs = &mut b.castles[1];
    let rows = cs.rows;
    for r in 1..rows - 2 {
        for col in [0, 3, 6] {
            let i = cs.idx(col, r);
            if matches!(cs.slots[i], Slot::Block(_)) {
                cs.slots[i] = Slot::Empty;
            }
        }
    }
    let before = b.castles[1].kettle_hp;
    b.begin_ctx(0, None, None, false);
    b.resolve_collapse(1);
    let after = b.castles[1].kettle_hp;
    assert!(after < before, "kettle took crush");
    assert!(before - after <= KETTLE_CAP, "capped at 60 per shot");
    let _ = c;
}

#[test]
fn full_hp_hob_survives_one_shot_and_kettle_cap() {
    let mut b = battle(r#"{"level":"d1"}"#, 1);
    let enemy = b.hobs.iter().find(|h| h.side == 1 && !h.dummy).unwrap().id;
    let max = b.hobs[enemy as usize].max;
    b.begin_ctx(0, None, None, false);
    b.damage_hob_direct(0, enemy, 500, castle_core::content::DType::Pierce);
    assert_eq!(
        b.hobs[enemy as usize].hp, 1,
        "clamped at HP minus 1 (max {max})"
    );
    b.finish_ctx();
    b.begin_ctx(0, None, None, false);
    b.damage_hob_direct(0, enemy, 500, castle_core::content::DType::Pierce);
    assert_eq!(b.hobs[enemy as usize].state, HobState::Bonked);
}

#[test]
fn self_damage_is_half_and_never_bonks() {
    let mut b = battle(r#"{"level":"d1"}"#, 1);
    let own = b.hobs.iter().find(|h| h.side == 0).unwrap().id;
    b.hobs[own as usize].hp = 10;
    b.begin_ctx(0, None, None, false);
    b.damage_hob_direct(0, own, 200, castle_core::content::DType::Blast);
    assert_eq!(b.hobs[own as usize].hp, 1);
    assert!(b.hobs[own as usize].alive());
}

#[test]
fn cover_halves_blasts_from_outside() {
    let mut b = battle(r#"{"level":"d1"}"#, 1);
    let enemy = b
        .hobs
        .iter()
        .find(|h| h.side == 1 && h.nook == Some(0))
        .unwrap()
        .id;
    assert_eq!(b.hobs[enemy as usize].state, HobState::Seated);
    let (x, y) = b.hob_feet(enemy);
    // a Clodpot (35, Medium) centred 20 cells outside the Nook's front
    let cs = &b.castles[1];
    let room = cs.room_box(&cs.nooks[0]);
    let bx = room.0 - 8;
    let ix = b.shot_index("clodpot").unwrap();
    let mut a = b.aim_probe(0, 0, ix, 450, 50);
    a.probe = false;
    b.begin_ctx(0, None, None, false);
    let hp0 = b.hobs[enemy as usize].hp;
    let effs: Vec<_> = b.content.shots[ix].triggers[0].effects.clone();
    b.run_effects(&effs, &a, bx, y - 10, None, false);
    let lost = hp0 - b.hobs[enemy as usize].hp;
    assert!(lost > 0 && lost <= 18, "covered hit took {lost}");
    let _ = x;
}

#[test]
fn loophole_flap_after_a_thread() {
    let mut b = battle(r#"{"level":"d1"}"#, 1);
    // the outer front Nook of the right fort: smallest column, top row
    let cs = &b.castles[1];
    let ni = (0..cs.nooks.len())
        .min_by_key(|&i| (cs.nooks[i].c, -cs.nooks[i].r))
        .unwrap();
    let enemy = b
        .hobs
        .iter()
        .find(|h| h.side == 1 && h.nook == Some(ni as u8))
        .unwrap()
        .id;
    let (x0, y0, x1, y1) = cs.loophole_rect(&cs.nooks[ni]);
    let front = cs.room_walls(&cs.nooks[ni])[3][0];
    let ix = b.shot_index("hatpin").unwrap();
    let mut a = b.aim_probe(0, 0, ix, 0, 80);
    a.probe = false;
    a.threads = true;
    b.begin_ctx(0, None, None, false);
    let hp0 = b.hobs[enemy as usize].hp;
    b.actors.push(a.clone());
    // reach the slot from the front
    let id = a.id;
    let _ = id;
    let hit = b.collide(0, (x0 + x1) / 2, (y0 + y1) / 2, None, false);
    match hit {
        Some(Hit::Block { side: 1, c, .. }) => assert_eq!(c, front.0),
        other => panic!("slot reads as {other:?}"),
    }
    // fly a hatpin straight into the slot
    b.actors.clear();
    let mut a = b.aim_probe(0, 0, ix, 0, 80);
    a.probe = false;
    a.threads = true;
    a.x = fx(x1 + 30);
    a.y = fx((y0 + y1) / 2);
    a.vx = -fx(4);
    a.vy = 0;
    a.gravity_pct = 0;
    a.side = 0;
    // side 1's front faces left; come from the left
    a.x = fx(x0 - 30);
    a.vx = fx(4);
    b.actors.push(a);
    b.phase = Phase::Resolve;
    for _ in 0..30 {
        b.resolve_tick();
    }
    assert!(b.castles[1].nooks[ni].flap, "flap dropped");
    assert!(b.hobs[enemy as usize].hp < hp0, "threaded hit the Hob");
}

#[test]
fn turn_rules_rest_steam_and_heavy() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"sides":[{"kit":"kit_stone"},{"kit":"kit_oak"}]}"#,
        3,
    );
    cmd(&mut b, json!({"cmd": "end_draft"}));
    assert_eq!(b.phase, Phase::Plan);
    // Old Thumper (Heavy crock) may not fire on the first side's first turn
    let thumper = b.hobs.iter().find(|h| h.def == "old_thumper").unwrap().id;
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": thumper}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    let r = cmd(&mut b, json!({"cmd": "fire"}));
    assert_eq!(r["reason"], "no_heavy_first_turn");
    // walking is capped at 40 Steam a turn
    let r = cmd(&mut b, json!({"cmd": "walk", "dx": 400}));
    assert!(r["ok"] == true && r["steam"].as_i64().unwrap() <= 40, "{r}");
    assert!(cmd(&mut b, json!({"cmd": "walk", "dx": 40}))["ok"] == false);
    // a Medium shot rests the Hob for its next turn
    let nan = b.hobs.iter().find(|h| h.def == "nan").unwrap().id;
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": nan}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 70}));
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    assert_eq!(
        cmd(&mut b, json!({"cmd": "walk", "dx": 8}))["ok"],
        false,
        "no walk after firing"
    );
    b.run_until_plan(10_000);
    assert_eq!(b.side, 1);
    assert_eq!(b.castles[1].steam, 120, "second side gets +20 Steam");
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(10_000);
    assert_eq!(b.side, 0);
    assert!(!b.can_fire_hob(0, nan), "Nan rests this turn");
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(10_000);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(10_000);
    assert!(b.can_fire_hob(0, nan), "rested");
}

#[test]
fn shove_off_clears_a_buried_loophole() {
    let mut b = battle(
        r#"{"level":"d1","first_turn":0,"sides":[{},{"control":"human"}]}"#,
        3,
    );
    cmd(&mut b, json!({"cmd": "end_draft"}));
    let h = b
        .hobs
        .iter()
        .find(|h| h.side == 0 && h.nook == Some(1))
        .unwrap()
        .id;
    let cs = &b.castles[0];
    let (x0, y0, x1, y1) = cs.loophole_rect(&cs.nooks[1]);
    let loam = b.content.terrain_code("loam");
    for y in y0 - 2..=y1 + 2 {
        for x in x0..=x1 {
            b.terrain.set(x, y, loam);
        }
    }
    b.update_buried();
    assert!(b.hobs[h as usize].buried);
    assert!(!b.can_fire_hob(0, h));
    let r = cmd(&mut b, json!({"cmd": "shove_off", "hob": h}));
    assert_eq!(r["ok"], true, "{r}");
    assert!(!b.hobs[h as usize].buried);
    assert_eq!(b.castles[0].steam_turn, 15);
}

#[test]
fn squall_warning_and_squall_ends_the_fight() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","round_cap":3,"first_turn":0,"sides":[{"kit":"kit_oak"},{"kit":"kit_oak"}]}"#,
        5,
    );
    cmd(&mut b, json!({"cmd": "end_draft"}));
    let mut warnings = vec![];
    let mut squalls = 0;
    for _ in 0..20 {
        if b.phase == Phase::Ended {
            break;
        }
        cmd(&mut b, json!({"cmd": "pass"}));
        b.run_until_plan(10_000);
        for e in b.events.drain(..) {
            if e["t"] == "squall_warning" {
                warnings.push(e["n"].as_i64().unwrap());
            }
            if e["t"] == "squall" {
                squalls += 1;
            }
        }
    }
    assert_eq!(b.phase, Phase::Ended);
    assert_eq!(
        warnings,
        vec![2, 1],
        "cap 3: round 1 starts the battle, then 2 and 1"
    );
    assert_eq!(squalls, 3, "the third Squall pops a full kettle");
    let r = b.result.as_ref().unwrap();
    assert_eq!(r.how, "double_pop");
    assert_eq!(r.winner, 1, "equal HP: the second side wins");
}

#[test]
fn first_lump_has_no_squall_and_pudge_dozes() {
    let mut b = battle(r#"{"level":"1-1","sides":[{},{"control":"human"}]}"#, 5);
    for _ in 0..40 {
        if b.phase == Phase::Ended {
            break;
        }
        cmd(&mut b, json!({"cmd": "pass"}));
        b.run_until_plan(10_000);
    }
    let r = b.result.as_ref().unwrap();
    assert_eq!((r.winner, r.how.as_str(), r.round), (0, "round_cap", 8));
}

#[test]
fn rummage_pool_six_two_picks_and_wish() {
    let mut b = battle(r#"{"level":"d1","first_turn":0}"#, 9);
    assert_eq!(b.phase, Phase::Draft);
    assert_eq!(b.draft.pool.len() + b.draft.picks[1].len(), 6);
    assert!(b.draft.wish.is_some());
    // side 1 (second) picked first; the AI took its wish
    assert_eq!(b.draft.picks[1].first(), b.draft.wish.as_ref());
    let pick = b.draft.pool[0].clone();
    assert_eq!(
        cmd(&mut b, json!({"cmd": "pick_shell", "shell": pick}))["ok"],
        true
    );
    let pick = b.draft.pool[0].clone();
    cmd(&mut b, json!({"cmd": "pick_shell", "shell": pick}));
    assert_eq!(b.phase, Phase::Plan);
    assert_eq!(b.hands[0].len(), 2);
    assert_eq!(b.hands[1].len(), 2);
    let duds = b
        .hands
        .iter()
        .flatten()
        .chain(b.draft.pool.iter())
        .filter(|s| b.content.shot(s).unwrap().dud)
        .count();
    assert!(duds <= 1);
}

#[test]
fn doodads_mend_bucket_and_pot_lid() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"sides":[{"kit":"kit_oak"},{"kit":"kit_oak"}]}"#,
        2,
    );
    cmd(&mut b, json!({"cmd": "end_draft"}));
    b.castles[0].block_mut(0, 1).unwrap().hp = 5;
    let r = cmd(
        &mut b,
        json!({"cmd": "doodad", "doodad": "mend_bucket", "targets": [[0, 1]]}),
    );
    assert_eq!(r["ok"], true);
    assert_eq!(b.castles[0].block(0, 1).unwrap().hp, 50);
    b.run_until_plan(1000);
    assert_eq!(b.side, 1);
    assert_eq!(
        cmd(
            &mut b,
            json!({"cmd": "doodad", "doodad": "pot_lid", "room": "kettle"})
        )["ok"],
        true
    );
    assert!(b.castles[1].kettle.lid);
    b.run_until_plan(1000);
    // side 0 lobs at side 1's kettle; the lid eats the first shell
    let cs = &b.castles[1];
    let (x0, y0, _, _) = cs.room_box(&cs.kettle);
    let ix = b.shot_index("clodpot").unwrap();
    let mut a = b.aim_probe(0, 0, ix, 450, 50);
    a.probe = false;
    a.x = fx(x0);
    a.y = fx(y0 - 4);
    a.vx = 0;
    a.vy = fx(3);
    b.begin_ctx(0, Some(0), None, false);
    b.actors.push(a);
    b.phase = Phase::Resolve;
    for _ in 0..60 {
        b.resolve_tick();
    }
    assert!(!b.castles[1].kettle.lid, "lid used");
    assert_eq!(b.castles[1].kettle_hp, 300);
}

#[test]
fn fatigue_from_round_ten_weakens_battered_stone() {
    let c = content();
    let bp = arm_fort('c', 1);
    let mut cs = castle_core::castle::Castle::from_blueprint(&c, &bp, 0, 100).unwrap();
    assert!(cs.falling_chunks(&c, &[]).is_empty());
    cs.block_mut(1, 5).unwrap().hp -= 1;
    assert!(cs.falling_chunks(&c, &[]).is_empty(), "no fatigue yet");
    cs.fatigue = true;
    assert_eq!(
        cs.falling_chunks(&c, &[]),
        vec![vec![(1, 5)]],
        "battered Cobble reaches 0"
    );
}

#[test]
fn ai_sees_only_what_the_player_sees() {
    // The AI's choice must not change with the player's hand or live aim.
    let make = |hand: Vec<&str>, angle: i32| {
        let mut b = battle(
            r#"{"level":"d1","first_turn":1,"rummage":{"pool":0,"picks":0}}"#,
            4,
        );
        b.hands[0] = hand.iter().map(|s| s.to_string()).collect();
        for h in b.hobs.iter_mut().filter(|h| h.side == 0) {
            h.angle = angle;
        }
        let side = b.side;
        castle_core::ai::plan_turn(&mut b, side, castle_core::ai::Preset::Fair)
    };
    let a = make(vec![], 450);
    let b = make(vec!["pudding_bomb", "mole_mail"], 300);
    assert_eq!(a, b);
}

#[test]
fn ai_error_narrows_shot_by_shot() {
    // Same target, repeated: the remembered offset shrinks on average.
    let mut b = battle(
        r#"{"level":"d1","first_turn":1,"rummage":{"pool":0,"picks":0}}"#,
        8,
    );
    let mut first = 0i64;
    let mut later = 0i64;
    for round in 0..40 {
        b.ai_mem[1] = Default::default();
        b.rng.ai[1] = Sfc32::new(round, "ai.1");
        let mut sizes = vec![];
        for _ in 0..4 {
            let cmds = castle_core::ai::plan_turn(&mut b.clone(), 1, castle_core::ai::Preset::Fair);
            let _ = cmds;
            let mut w = b.clone();
            castle_core::ai::plan_turn(&mut w, 1, castle_core::ai::Preset::Fair);
            b.ai_mem[1] = w.ai_mem[1].clone();
            b.rng.ai[1] = w.rng.ai[1].clone();
            let o = b.ai_mem[1]
                .offsets
                .last()
                .map(|o| (o.1.abs() + o.2.abs() / 2) as i64)
                .unwrap_or(0);
            sizes.push(o);
        }
        first += sizes[0];
        later += sizes[3];
        if round >= 7 {
            break;
        }
    }
    assert!(
        later < first,
        "error narrows: first {first}, fourth {later}"
    );
}

#[test]
fn every_shot_fires_without_panic() {
    let c = content();
    let shots: Vec<String> = c
        .shots
        .iter()
        .filter(|s| s.kind == castle_core::content::ShotKind::Trick)
        .map(|s| s.id.clone())
        .collect();
    for (i, s) in shots.iter().enumerate() {
        let mut b = battle(
            r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_reed"},{"kit":"kit_oak"}]}"#,
            i as u64,
        );
        b.hands[0].push(s.clone());
        cmd(&mut b, json!({"cmd": "pick_shot", "shot": s}));
        cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 76}));
        assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true, "{s}");
        b.run_until_plan(10_000);
        assert!(b.phase == Phase::Plan || b.phase == Phase::Ended, "{s}");
    }
    // every Knack too, via the kits
    for kit in ["kit_oak", "kit_stone", "kit_reed"] {
        for h in 0..4u8 {
            let mut b = battle(
                &format!(
                    r#"{{"level":"d1","mode":"couch","first_turn":1,"rummage":{{"pool":0,"picks":0}},"sides":[{{"kit":"kit_oak"}},{{"kit":"{kit}"}}]}}"#
                ),
                3,
            );
            let id = b
                .hobs
                .iter()
                .filter(|x| x.side == 1)
                .nth(h as usize)
                .unwrap()
                .id;
            cmd(&mut b, json!({"cmd": "pick_hob", "hob": id}));
            cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
            cmd(&mut b, json!({"cmd": "aim", "angle": 1350, "power": 76}));
            let r = cmd(&mut b, json!({"cmd": "fire"}));
            assert!(
                r["ok"] == true || r["reason"] == "no_heavy_first_turn",
                "{kit} {h}: {r}"
            );
            b.run_until_plan(10_000);
        }
    }
}

#[test]
fn terrain_carve_and_settle() {
    let mut b = battle(r#"{"level":"d1"}"#, 1);
    let x = 1000;
    let top = b.terrain.surface(x);
    let n = b.terrain.carve(x, top + 20, 18, false);
    assert!(n > 0);
    // loam above the hole falls in
    b.terrain.settle(x - 20, x + 20, |_, _| false);
    for dx in -10..=10 {
        let s = b.terrain.surface(x + dx);
        assert!(s > top, "column {dx} settled lower");
    }
    // nothing floats
    for y in 0..b.terrain.h - 1 {
        if b.terrain.get(x, y) == 1 {
            assert!(b.terrain.solid(x, y + 1), "floating loam at {y}");
        }
    }
}

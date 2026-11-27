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
        // Timber reach 1 since the pacing pass (canon 9.6: tune falls first)
        ('t', 1, true),
        ('t', 2, false),
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
    let bp = arm_fort('t', 1);
    let cs = castle_core::castle::Castle::from_blueprint(&c, &bp, 0, 100).unwrap();
    // the top row is (0..=1, 5); the column under it is (0, 4)
    let falls = cs.lean_lines(&c, 0, 4, &[]);
    assert_eq!(falls, vec![(0, 5), (1, 5)]);
    assert!(cs.lean_lines(&c, 1, 5, &[]).is_empty());
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
    assert!(before - after <= KETTLE_CAP, "capped at 80 per shot");
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
    // Squall alone: 50 + 100 stays under a full kettle, + 150 pops it, so
    // every fight still ends by the third Squall round.
    let k = castle_core::castle::KETTLE_HP;
    assert!(50 + 100 < k && 50 + 100 + 150 >= k);
    // Since bundle patch 02 (Kettle 200, crush 100%) the second Squall
    // already pops kit_oak forts: it leaves the kettle at 50, under half,
    // so kettle_crack drops the side support of the Timber round the Kettle
    // Room by one; that cover falls and crushes the kettle for 30 twice
    // (50 + 100 + 60 >= 200). Before it was 300 HP, no crack, crush at 50%,
    // so it took the third. Both sides pop at once: still a double pop.
    assert_eq!(
        squalls, 2,
        "the second Squall plus its crush pops the kettle"
    );
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
    assert_eq!(b.castles[1].kettle_hp, castle_core::castle::KETTLE_HP);
}

#[test]
fn fatigue_from_round_ten_weakens_battered_stone() {
    let c = content();
    let bp = arm_fort('c', 1);
    let mut cs = castle_core::castle::Castle::from_blueprint(&c, &bp, 0, 100).unwrap();
    assert!(cs.falling_chunks(&c, &[]).is_empty());
    // light scratch (79/80): stands under both stage 1 (<50%) and stage 2 (<80%)
    cs.block_mut(1, 5).unwrap().hp = 79;
    cs.fatigue = true;
    cs.fatigue_pct = 50;
    assert!(cs.falling_chunks(&c, &[]).is_empty(), "79/80 survives R10");
    cs.fatigue_pct = 80;
    assert!(cs.falling_chunks(&c, &[]).is_empty(), "79/80 survives R12");
    // 60/80 (75%): survives R10 (<50%), falls at R12 (<80%)
    cs.block_mut(1, 5).unwrap().hp = 60;
    cs.fatigue_pct = 50;
    assert!(cs.falling_chunks(&c, &[]).is_empty(), "60/80 survives R10");
    cs.fatigue_pct = 80;
    assert_eq!(
        cs.falling_chunks(&c, &[]),
        vec![vec![(1, 5)]],
        "60/80 falls at R12 (<80%)"
    );
    // 39/80 (<50%): falls immediately at R10
    cs.block_mut(1, 5).unwrap().hp = 39;
    cs.fatigue_pct = 50;
    assert_eq!(
        cs.falling_chunks(&c, &[]),
        vec![vec![(1, 5)]],
        "battered Cobble (<50%) reaches 0 at R10"
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
                .map(|o| (o.angle.abs() + o.power.abs() / 2) as i64)
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
            // a self shot with nothing to do is refused before it is paid
            assert!(
                r["ok"] == true
                    || r["reason"] == "no_heavy_first_turn"
                    || r["reason"] == "nothing_to_mend",
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

#[test]
fn c01_sod_sack_buries_intact_fort_and_shove_off_clears_cleanly() {
    // Use kit_oak on side 0 so Grub sits in row-1 Nook 3 on the outer front face.
    let mut b = battle(
        r#"{"level":"1-1","first_turn":1,"sides":[{"kit":"kit_oak"},{"control":"human"}]}"#,
        7,
    );
    b.hands[1].push("sod_sack".into());
    let h1 = b.hobs.iter().find(|h| h.side == 1).unwrap().id;
    let h0 = b
        .hobs
        .iter()
        .find(|h| h.side == 0 && h.def == "grub")
        .unwrap()
        .id;
    let n0 = b.hobs[h0 as usize].nook.unwrap();
    let (x0, y0, x1, y1) = b.castles[0].loophole_rect(&b.castles[0].nooks[n0 as usize]);
    let tx = x1 + 2;
    let ty = (y0 + y1) / 2;
    let sod_ix = b.shot_index("sod_sack").unwrap();
    let mut best = (i64::MAX, 1350, 62);
    for a in (1100..=1550).step_by(10) {
        for p in 35..=95 {
            let mut u = 0;
            let pr = b.aim_probe(1, h1, sod_ix, a, p);
            let (_, end, _) = b.probe_path(pr, 900, false, &mut u);
            let dx = (end.0 - tx) as i64;
            let dy = (end.1 - ty) as i64;
            let d2 = dx * dx + dy * dy;
            if d2 < best.0 {
                best = (d2, a, p);
            }
        }
    }
    assert!(
        best.0 <= 24 * 24,
        "probe should reach Grub's front face: {best:?}"
    );
    assert_eq!(
        cmd(&mut b, json!({"cmd": "pick_hob", "hob": h1}))["ok"],
        true
    );
    assert_eq!(
        cmd(&mut b, json!({"cmd": "pick_shot", "shot": "sod_sack"}))["ok"],
        true
    );
    assert_eq!(
        cmd(
            &mut b,
            json!({"cmd": "aim", "angle": best.1, "power": best.2})
        )["ok"],
        true
    );
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    b.run_until_plan(10_000);
    assert_eq!(b.side, 0);
    assert!(
        b.castles[0].room_intact(&b.castles[0].nooks[n0 as usize], false),
        "sod_sack does not break the intact front wall"
    );
    assert!(
        b.hobs[h0 as usize].buried,
        "exterior sod_sack mound buries intact Loophole"
    );
    assert_eq!(b.shot_ready(0, h0, "plain"), Err("buried"));
    let r = cmd(&mut b, json!({"cmd": "shove_off", "hob": h0}));
    assert_eq!(r["ok"], true, "{r}");
    assert!(!b.hobs[h0 as usize].buried, "shove_off unburies Hob");
    // No floating loam remains in the cleared chute.
    for x in x0.max(0)..=(x1 + 36).min(b.terrain.w - 1) {
        for y in 0..b.terrain.h - 1 {
            if b.terrain.get(x, y) == 1 {
                let held = b.terrain.solid(x, y + 1)
                    || b.castles[0]
                        .slot_at(x, y + 1)
                        .is_some_and(|(c, r)| b.castles[0].has_block(c, r));
                assert!(held, "floating loam at ({x}, {y}) after shove_off");
            }
        }
    }
    assert_eq!(
        cmd(&mut b, json!({"cmd": "pick_hob", "hob": h0}))["ok"],
        true
    );
    assert_eq!(
        cmd(&mut b, json!({"cmd": "pick_shot", "shot": "plain"}))["ok"],
        true
    );
    assert_eq!(
        cmd(&mut b, json!({"cmd": "aim", "angle": 450, "power": 62}))["ok"],
        true
    );
    assert_eq!(cmd(&mut b, json!({"cmd": "fire"}))["ok"], true);
    b.run_until_plan(10_000);
    let g = b.ghosts.last().unwrap();
    assert!(!g.self_hit, "next shot clears the fort without self_hit");
    assert!(g.pin.is_some_and(|p| p.0 > x1 + 100));
}

#[test]
fn c02_rescue_captive_blame_and_captive_safe_pennant() {
    // Rival (side 1) bonking the captive awards side 0 the win.
    let mut b = battle(r#"{"level":"1-7","sides":[{},{"control":"human"}]}"#, 3);
    cmd(&mut b, json!({"cmd": "pass"}));
    b.run_until_plan(1000);
    assert_eq!(b.side, 1);
    let cap = b.props.iter().position(|p| p.kind == "captive").unwrap();
    b.props[cap].hp = 0;
    assert!(b.check_win());
    let res = b.result.as_ref().unwrap();
    assert_eq!((res.winner, res.how.as_str()), (0, "captive_bonked"));

    // Rival grazing the captive does not steal the player's captive_safe Pennant.
    let mut b = battle(r#"{"level":"1-7","sides":[{},{"control":"human"}]}"#, 3);
    let cap = b.props.iter().position(|p| p.kind == "captive").unwrap();
    let (cx, cy) = (b.props[cap].x, b.props[cap].y);
    let ix = b.shot_index("clodpot").unwrap();
    let effs = b.content.shots[ix].triggers[0].effects.clone();
    let a1 = b.probe_actor_at(1, ix, cx, cy);
    b.run_effects(&effs, &a1, cx, cy, Some(Hit::Prop(cap)), false);
    b.finish_ctx();
    assert!(b.props[cap].hp < b.props[cap].max && b.props[cap].hp > 0);
    assert!(!b.captive_hit_by_player);
    let mut broken = 0;
    for p in &mut b.props {
        if p.tag == "cage" && broken < 2 {
            p.hp = 0;
            broken += 1;
        }
    }
    assert!(b.check_win());
    let res = b.result.as_ref().unwrap();
    assert_eq!(res.winner, 0);
    assert!(res.pennants[1], "Rival graze preserves captive_safe");

    // Player grazing the captive loses captive_safe.
    let mut b = battle(r#"{"level":"1-7","sides":[{},{"control":"human"}]}"#, 3);
    let cap = b.props.iter().position(|p| p.kind == "captive").unwrap();
    let (cx, cy) = (b.props[cap].x, b.props[cap].y);
    let a0 = b.probe_actor_at(0, ix, cx, cy);
    b.run_effects(&effs, &a0, cx, cy, Some(Hit::Prop(cap)), false);
    b.finish_ctx();
    assert!(b.captive_hit_by_player);
    let mut broken = 0;
    for p in &mut b.props {
        if p.tag == "cage" && broken < 2 {
            p.hp = 0;
            broken += 1;
        }
    }
    assert!(b.check_win());
    assert!(!b.result.as_ref().unwrap().pennants[1]);
}

#[test]
fn c03_self_target_shot_ready_refusal_and_pot_lid_guards() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_stone"},{"kit":"kit_oak"}]}"#,
        5,
    );
    let hetty = b.hobs.iter().find(|h| h.def == "hetty").unwrap().id;
    assert_eq!(b.shot_ready(0, hetty, "knack"), Err("nothing_to_mend"));
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": hetty}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "knack"}));
    let snap = b.snapshot();
    assert_eq!(snap["hud"]["fire"]["ready"], false);
    assert_eq!(snap["hud"]["fire"]["why"], "nothing_to_mend");
    let r = cmd(&mut b, json!({"cmd": "fire"}));
    assert_eq!(r["ok"], false);
    assert_eq!(r["reason"], "nothing_to_mend");
    assert!(r["detail"].as_str().is_some_and(|s| !s.is_empty()));
    assert_eq!(r["ready_shot"], "plain");

    // Pot Lid rejects already_lidded and broken rooms before spending the Doodad.
    let r = cmd(
        &mut b,
        json!({"cmd": "doodad", "doodad": "pot_lid", "room": "kettle"}),
    );
    assert_eq!(r["ok"], true, "{r}");
    b.acted = false;
    b.phase = Phase::Plan;
    b.doodads[0].push("pot_lid".into());
    let r = cmd(
        &mut b,
        json!({"cmd": "doodad", "doodad": "pot_lid", "room": "kettle"}),
    );
    assert_eq!(r["reason"], "already_lidded");
    b.castles[0].kettle.lid = false;
    let kw = b.castles[0].room_walls(&b.castles[0].kettle)[3][0];
    let idx = b.castles[0].idx(kw.0, kw.1);
    b.castles[0].slots[idx] = Slot::Empty;
    let r = cmd(
        &mut b,
        json!({"cmd": "doodad", "doodad": "pot_lid", "room": "kettle"}),
    );
    assert_eq!(r["reason"], "bad_target");
    assert!(b.doodads[0].contains(&"pot_lid".to_string()));
}

#[test]
fn c06_mend_multi_burial_and_full_hp_peephole() {
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_stone"},{"kit":"kit_oak"}]}"#,
        7,
    );
    // Nooks 0 and 1 in bp_kit_stone share wall (3, 7).
    for h in [0u8, 1u8] {
        let nk = b.hobs[h as usize].nook.unwrap();
        let (_, y0, x1, y1) = b.castles[0].loophole_rect(&b.castles[0].nooks[nk as usize]);
        for y in y0..=y1 {
            for x in (x1 + 1)..=(x1 + 6) {
                b.terrain.set(x, y, 1);
            }
        }
    }
    b.update_buried();
    assert!(b.hobs[0].buried && b.hobs[1].buried);
    let hetty = b.hobs.iter().find(|h| h.def == "hetty").unwrap().id;
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": hetty}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "plain"}));
    // Unrelated intact wall is refused even while allies are buried elsewhere.
    let bad = cmd(&mut b, json!({"cmd": "fire", "target": [0, 1]}));
    assert_eq!(bad["reason"], "nothing_to_mend");
    // Shared wall (3, 7) digs out both buried Hobs.
    let ok_r = cmd(&mut b, json!({"cmd": "fire", "target": [3, 7]}));
    assert_eq!(ok_r["ok"], true, "{ok_r}");
    assert!(!b.hobs[0].buried && !b.hobs[1].buried);

    // Full-HP block with a peephole can be mended by Dollop and by Mend Bucket.
    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_stone"},{"kit":"kit_oak"}]}"#,
        7,
    );
    b.castles[0].block_mut(0, 1).unwrap().peephole = true;
    let hetty = b.hobs.iter().find(|h| h.def == "hetty").unwrap().id;
    cmd(&mut b, json!({"cmd": "pick_hob", "hob": hetty}));
    cmd(&mut b, json!({"cmd": "pick_shot", "shot": "plain"}));
    let r = cmd(&mut b, json!({"cmd": "fire", "target": [0, 1]}));
    assert_eq!(r["ok"], true, "{r}");
    assert!(!b.castles[0].block(0, 1).unwrap().peephole);

    let mut b = battle(
        r#"{"level":"d1","mode":"couch","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{"kit":"kit_stone"},{"kit":"kit_oak"}]}"#,
        7,
    );
    b.castles[0].block_mut(0, 1).unwrap().peephole = true;
    let r = cmd(
        &mut b,
        json!({"cmd": "doodad", "doodad": "mend_bucket", "targets": [[0, 1]]}),
    );
    assert_eq!(r["ok"], true, "{r}");
    assert!(!b.castles[0].block(0, 1).unwrap().peephole);
}

#[test]
fn c08_cozy_campaign_balance_keeps_fair_unchanged() {
    let mut cozy = battle(
        r#"{"level":"1-3","mode":"campaign","sides":[{},{"preset":"cozy"}],"progress":{"cleared":true}}"#,
        5,
    );
    assert_eq!(cozy.castles[1].kettle_max, 150);
    assert_eq!(cozy.castles[1].kettle_hp, 150);
    let snap = cozy.snapshot();
    assert_eq!(snap["castles"][1]["kettle"]["max"], 150);
    assert_eq!(snap["hud"]["kettle_pct"][1], 100);
    cozy.end_battle(0, "kettle_pop");
    // Replay base 125 on Cozy (80 on Fair), plus 10 for each of the 3 new Pennants.
    assert_eq!(cozy.result.as_ref().unwrap().buttons, 125 + 30);

    let mut fair = battle(
        r#"{"level":"1-3","mode":"campaign","sides":[{},{"preset":"fair"}],"progress":{"cleared":true}}"#,
        5,
    );
    assert_eq!(fair.castles[1].kettle_max, 200);
    assert_eq!(fair.castles[1].kettle_hp, 200);
    fair.end_battle(0, "kettle_pop");
    assert_eq!(fair.result.as_ref().unwrap().buttons, 80 + 30);
}

#[test]
fn c09_c11_c11b_c12_c14_guards_and_miss_blocks() {
    // C-09: nested resume inside replay_log is rejected with bad_log.
    let mut b = battle(r#"{"level":"1-1"}"#, 1);
    let err_r = castle_core::replay::replay_log(&mut b, &[json!({"cmd": "resume", "log": []})]);
    assert!(err_r.is_err());
    assert_eq!(err_r.unwrap_err().1["reason"], "bad_log");

    // C-11: validate_blueprint reports structured problem id no_kettle_room.
    let r = cmd(
        &mut b,
        json!({"cmd": "validate_blueprint", "rows": ["ttt", "t1t", "FFF"], "seats": 1}),
    );
    assert_eq!(r["ok"], false);
    assert_eq!(r["reason"], "invalid_blueprint");
    assert_eq!(r["problem"], "no_kettle_room");

    // C-11b: Round 1 give_up with 0 shots fired pays 0 Buttons.
    let mut g = battle(r#"{"level":"1-1","mode":"campaign"}"#, 1);
    assert_eq!(cmd(&mut g, json!({"cmd": "give_up"}))["ok"], true);
    assert_eq!(g.result.as_ref().unwrap().buttons, 0);

    // C-14: Campaign walk is refused before walk_from (1-5) and allowed from 1-5.
    let mut early = battle(r#"{"level":"1-1","mode":"campaign"}"#, 1);
    assert_eq!(
        cmd(&mut early, json!({"cmd": "walk", "dx": 4}))["reason"],
        "cannot_walk_now"
    );
    let mut later = battle(r#"{"level":"1-5","mode":"campaign"}"#, 1);
    assert_eq!(cmd(&mut later, json!({"cmd": "walk", "dx": 4}))["ok"], true);

    // C-12: Boss 1-10 shears hinge re-anchors when side 1 drops into a crater.
    let mut boss = battle(
        r#"{"level":"1-10","first_turn":0,"rummage":{"pool":0,"picks":0},"sides":[{},{"control":"human"}]}"#,
        4,
    );
    boss.castles[1].kettle_hp = 50;
    cmd(&mut boss, json!({"cmd": "pass"}));
    boss.run_until_plan(1000);
    let hid = boss.boss.hinge.expect("phase 3 spawns hinge");
    let base0 = boss.castles[1].base_y;
    let cx = boss.castles[1].x;
    let cw = boss.castles[1].width_cells();
    boss.terrain.clear_rect(cx, base0, cx + cw - 1, base0 + 20);
    let ix = boss.shot_index("clodpot").unwrap();
    let effs = boss.content.shots[ix].triggers[0].effects.clone();
    let a = boss.probe_actor_at(0, ix, cx + cw / 2, base0 + 18);
    boss.run_effects(&effs, &a, cx + cw / 2, base0 + 18, None, false);
    boss.finish_ctx();
    assert!(boss.castles[1].base_y > base0, "boss fort dropped");
    let hp = boss.props.iter().find(|p| p.id == hid).unwrap();
    assert_eq!(hp.y, boss.castles[1].top_y() - 1);

    // C-14: ghosts carry signed miss_blocks (negative short, null on fort).
    let mut sh = battle(r#"{"level":"1-1"}"#, 42);
    cmd(&mut sh, json!({"cmd": "aim", "angle": 450, "power": 30}));
    cmd(&mut sh, json!({"cmd": "fire"}));
    sh.run_until_plan(5000);
    let snap = sh.snapshot();
    assert!(snap["ghosts"][0]["miss_blocks"]
        .as_i64()
        .is_some_and(|n| n < 0));
}

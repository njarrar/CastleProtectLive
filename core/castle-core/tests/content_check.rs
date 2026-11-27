//! Content check: every JSON file in content/ parses, matches its schema in
//! content/schema, loads into the sim types and passes the cross checks
//! (ids exist, forts pass the Workshop validator, three Pennants a level).

mod common;
use castle_core::{embedded, Battle, Content};
use common::*;
use std::sync::Arc;

#[test]
fn content_files_match_their_schemas() {
    let c = repo().join("content");
    let s = c.join("schema");
    let pairs = [
        ("materials.json", "materials.schema.json"),
        ("classes.json", "classes.schema.json"),
        ("hobs.json", "hobs.schema.json"),
        ("shots.json", "shots.schema.json"),
        ("doodads.json", "doodads.schema.json"),
        ("blueprints.json", "blueprints.schema.json"),
        ("rummage.json", "rummage.schema.json"),
        ("starter_box.json", "starter_box.schema.json"),
        ("app.json", "app.schema.json"),
    ];
    let mut errs = vec![];
    for (f, sc) in pairs {
        for e in validate(&read(&s.join(sc)), &read(&c.join(f))) {
            errs.push(format!("{f}: {e}"));
        }
    }
    let level_schema = read(&s.join("level.schema.json"));
    let mut n = 0;
    for e in std::fs::read_dir(c.join("levels")).unwrap() {
        let p = e.unwrap().path();
        n += 1;
        for e in validate(&level_schema, &read(&p)) {
            errs.push(format!("{}: {e}", p.display()));
        }
    }
    assert_eq!(
        n,
        embedded::LEVEL_FILES.len(),
        "every level file must be listed in embedded.rs"
    );
    assert!(errs.is_empty(), "{}", errs.join("\n"));
}

#[test]
fn content_loads_and_cross_checks() {
    let c = embedded::content();
    c.check().unwrap();
    // v0.1 scope
    assert_eq!(c.classes.len(), 6);
    assert_eq!(c.hobs.iter().filter(|h| h.player).count(), 8);
    assert_eq!(
        c.shots
            .iter()
            .filter(|s| s.kind == castle_core::content::ShotKind::Trick)
            .count(),
        8
    );
    assert_eq!(c.doodads.len(), 2);
    for id in [
        "1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8", "1-9", "1-10",
    ] {
        let l = c.level(id).unwrap_or_else(|| panic!("level {id}"));
        assert_eq!(l.pennants.len(), 3, "{id}");
    }
    assert_eq!(c.levels.iter().filter(|l| l.kind == "skirmish").count(), 2);
    assert_eq!(c.starter_box.kits.len(), 3);
}

#[test]
fn every_level_and_kit_starts() {
    let c = Arc::new(embedded::content());
    for l in &c.levels {
        let b = Battle::new(c.clone(), &format!(r#"{{"level":"{}"}}"#, l.id), 1)
            .unwrap_or_else(|e| panic!("{}: {e}", l.id));
        // forts stand on the ground, inside the map, not overlapping
        assert!(
            b.castles[0].x + b.castles[0].width_cells() + 64 < b.castles[1].x,
            "{}",
            l.id
        );
        for cs in &b.castles {
            assert!(cs.top_y() > 100, "{} fort pokes into the sky margin", l.id);
        }
        // the castle columns start supported
        for s in 0..2 {
            let held = b.held_slots(s);
            assert!(
                b.castles[s as usize].falling_chunks(&c, &held).is_empty(),
                "{} side {s} starts unsupported",
                l.id
            );
        }
    }
    for k in &c.starter_box.kits {
        Battle::new(
            c.clone(),
            &format!(
                r#"{{"level":"d1","mode":"couch","sides":[{{"kit":"{}"}},{{"kit":"{}"}}]}}"#,
                k.id, k.id
            ),
            1,
        )
        .unwrap();
    }
}

#[test]
fn bad_content_is_refused() {
    let mut v = embedded::bundle_json();
    v["hobs"][0]["knack"] = serde_json::json!("no_such_shot");
    let e = Content::from_json(&v.to_string()).unwrap_err();
    assert!(e.contains("no_such_shot"), "{e}");
}

#[test]
fn api_fixtures_match_the_api_schemas() {
    let core = repo().join("core");
    let snap = read(&core.join("schema/snapshot.schema.json"));
    let cmd = read(&core.join("schema/command.schema.json"));
    let reply = read(&core.join("schema/reply.schema.json"));
    let setup = read(&core.join("schema/setup.schema.json"));
    let f = core.join("fixtures");
    let mut errs = vec![];
    for n in [
        "snapshot_plan.json",
        "snapshot_aim_lean.json",
        "snapshot_lean.json",
        "snapshot_after_shot.json",
        "snapshot_rescue_1_7.json",
        "snapshot_boss_1_10.json",
        "snapshot_ended.json",
    ] {
        errs.extend(
            validate(&snap, &read(&f.join(n)))
                .into_iter()
                .map(|e| format!("{n}: {e}")),
        );
    }
    for n in ["setup_1_1.json", "setup_couch.json"] {
        errs.extend(
            validate(&setup, &read(&f.join(n)))
                .into_iter()
                .map(|e| format!("{n}: {e}")),
        );
    }
    errs.extend(validate(
        &cmd,
        &read(&f.join("commands_1_1.json"))["commands"],
    ));
    errs.extend(validate(
        &reply,
        &read(&f.join("replies_1_1.json"))["commands"],
    ));
    assert!(errs.is_empty(), "{}", errs.join("\n"));
}

#[test]
fn live_snapshots_match_the_schema() {
    let core = repo().join("core");
    let snap = read(&core.join("schema/snapshot.schema.json"));
    let c = Arc::new(embedded::content());
    let mut b = Battle::new(
        c,
        r#"{"level":"1-8","mode":"skirmish","sides":[{"control":"ai"},{"control":"ai"}]}"#,
        9,
    )
    .unwrap();
    let mut errs = vec![];
    for _ in 0..30 {
        errs.extend(validate(&snap, &b.snapshot()));
        castle_core::replay::auto(&mut b, 1);
    }
    errs.extend(validate(&snap, &b.snapshot()));
    assert!(errs.is_empty(), "{}", errs.join("\n"));
}

#[test]
fn fixtures_are_current() {
    // Every fixture file (setups, commands, replies, snapshots and their
    // hashes) is exactly what the current core makes.
    let f = repo().join("core").join("fixtures");
    let built = castle_core::fixtures::build();
    assert!(built.len() >= 10);
    for (name, v) in built {
        let on_disk = read(&f.join(name));
        assert!(
            on_disk == v,
            "{name} is stale; run: cargo run -p castle-core --example make_fixtures"
        );
    }
}

#[test]
fn no_two_forts_share_a_grid() {
    // Shape only: a fort in another material is still the same fort.
    let c = embedded::content();
    let mut seen: Vec<(String, &str)> = vec![];
    for b in &c.blueprints {
        let grid: String = b
            .rows
            .iter()
            .map(|r| {
                r.chars()
                    .map(|g| match g {
                        '.' => '.',
                        'K' | '1'..='5' => 'o',
                        _ => '#',
                    })
                    .collect::<String>()
            })
            .collect::<Vec<_>>()
            .join("|");
        if let Some((_, other)) = seen.iter().find(|(g, _)| *g == grid) {
            panic!("{} has the same grid as {}", b.id, other);
        }
        seen.push((grid, &b.id));
    }
}

#[test]
fn rival_habits_come_from_ids() {
    // The habit each level played with before habit_id existed (picked then
    // from words in the display line). The id keeps play the same.
    let c = embedded::content();
    let want = [
        ("1-1", "balanced"),
        ("1-2", "hob_sniper"),
        ("1-3", "kettle_hunter"),
        ("1-4", "balanced"),
        ("1-5", "hob_sniper"),
        ("1-6", "roof_wrecker"),
        ("1-7", "balanced"),
        ("1-8", "reckless"),
        ("1-9", "cautious_mender"),
        ("1-10", "roof_wrecker"),
        ("d1", "balanced"),
        ("d2", "balanced"),
    ];
    assert_eq!(want.len(), c.levels.len());
    for (id, h) in want {
        let l = c.level(id).unwrap();
        assert_eq!(l.rival.habit_id.as_deref(), Some(h), "{id}");
    }
    let mut v = embedded::bundle_json();
    v["levels"][0]["rival"]["habit_id"] = serde_json::json!("sulks");
    let e = Content::from_json(&v.to_string()).unwrap_err();
    assert!(e.contains("unknown habit_id sulks"), "{e}");
    let mut v = embedded::bundle_json();
    v["levels"][0]["rival"]["think_ms"] = serde_json::json!(9000);
    assert!(Content::from_json(&v.to_string()).is_err());
}

#[test]
fn region_one_rivals_and_pennants_are_their_own() {
    let c = embedded::content();
    let campaign: Vec<_> = c.levels.iter().filter(|l| l.kind != "skirmish").collect();
    // the Hedger is not in every level
    let with_hedger = c
        .levels
        .iter()
        .filter(|l| l.rival.crew.iter().any(|h| h == "hedge_snipper"))
        .count();
    assert!(
        with_hedger * 2 < c.levels.len(),
        "{with_hedger} levels field a Hedger"
    );
    let mut wins: Vec<&str> = vec![];
    for l in &campaign {
        assert!(l.rival.think_ms.is_some(), "{} Rival think time", l.id);
        assert!(!l.rival.name.is_empty(), "{} Rival name", l.id);
        let win = l.pennants.iter().find(|p| p.kind == "win").unwrap();
        assert_ne!(win.text, "Win", "{}: word the win goal", l.id);
        assert!(!wins.contains(&win.text.as_str()), "{} win text", l.id);
        wins.push(&win.text);
        // at least one goal no other level has
        let own = l.pennants.iter().filter(|p| p.kind != "win").any(|p| {
            !campaign.iter().any(|o| {
                o.id != l.id
                    && o.pennants
                        .iter()
                        .any(|q| q.kind == p.kind && q.value == p.value && q.area == p.area)
            })
        });
        assert!(own, "{} needs a goal of its own", l.id);
    }
    for l in c.levels.iter().filter(|l| l.kind == "skirmish") {
        assert!(l.rival.roster.len() >= 2, "{} Skirmish roster", l.id);
    }
}

#[test]
fn skirmish_rival_is_named_by_seed() {
    let c = Arc::new(embedded::content());
    let roster = &c.level("d1").unwrap().rival.roster;
    let mut seen = vec![];
    for seed in 0..12u64 {
        let mut b = Battle::new(c.clone(), r#"{"level":"d1"}"#, seed).unwrap();
        let want = &roster[(seed % roster.len() as u64) as usize];
        assert_eq!(b.names[1], want.name);
        assert_eq!(b.think_ms[1], want.think_ms);
        // a Retry keeps the same Rival
        let r = Battle::new(c.clone(), r#"{"level":"d1","attempt":2}"#, seed).unwrap();
        assert_eq!(r.names[1], want.name);
        if !seen.contains(&b.names[1]) {
            seen.push(b.names[1].clone());
        }
        let s = b.snapshot();
        assert_eq!(s["hud"]["names"][1], want.name.as_str());
        assert_eq!(s["hud"]["think_ms"][1], serde_json::json!(want.think_ms));
    }
    assert_eq!(seen.len(), roster.len());
    // a name from the setup wins
    let b = Battle::new(
        c.clone(),
        r#"{"level":"d1","sides":[{},{"name":"Sir Pudge"}]}"#,
        3,
    )
    .unwrap();
    assert_eq!(b.names[1], "Sir Pudge");
    // a campaign Rival keeps the level's name and think time
    let b = Battle::new(c.clone(), r#"{"level":"1-6"}"#, 3).unwrap();
    assert_eq!(b.names[1], "Warden Snedd");
    assert_eq!(b.think_ms[1], Some(600));
}

#[test]
fn text_json_matches_core_refusals_and_voice_rules() {
    let txt = read(&repo().join("content/text.json"));
    assert_eq!(txt["common"]["ok"], "OK");
    assert_eq!(txt["hud"]["release_to_cancel"], "Release to cancel");
    for key in [
        "resting_plain_only",
        "resting",
        "buried",
        "no_knack_uses",
        "not_in_hand",
        "no_heavy_first_turn",
        "no_actions_left",
        "already_acted",
        "not_planning",
        "hob_cannot_fire",
        "not_enough_steam",
        "cannot_walk_now",
        "cannot_walk_there",
        "battle_over",
        "bad_value",
        "bad_target",
        "no_shot",
        "nothing_to_mend",
        "no_one_to_puff_up",
        "puff_up_not_allowed",
        "already_lidded",
        "no_doodad",
    ] {
        assert!(
            txt["hud"]["why"][key]
                .as_str()
                .is_some_and(|s| !s.is_empty()),
            "missing hud.why.{key}"
        );
    }
    for path in [
        &txt["levels"]["1-2"]["goals"]["bonk_nook"],
        &txt["levels"]["1-6"]["goals"]["bonk_nook"],
        &txt["pennants"]["bonk_nook"],
    ] {
        assert!(
            path.as_str().is_some_and(|s| s.contains("first")),
            "bonk_nook goal must mention 'first': {path}"
        );
    }
    assert_eq!(
        txt["levels"]["1-6"]["goals"]["kettle_above_pct"],
        "Kettle over {n}%"
    );
    let shouts = ["Bonk!", "Thump!", "Drop!", "Snip!", "Kettle Pop!"];
    fn check_strings(v: &serde_json::Value, path: &str, shouts: &[&str]) {
        match v {
            serde_json::Value::Object(m) => {
                for (k, val) in m {
                    if k.starts_with('_') {
                        continue;
                    }
                    let next = if path.is_empty() {
                        k.clone()
                    } else {
                        format!("{path}.{k}")
                    };
                    check_strings(val, &next, shouts);
                }
            }
            serde_json::Value::Array(a) => {
                for (i, val) in a.iter().enumerate() {
                    check_strings(val, &format!("{path}[{i}]"), shouts);
                }
            }
            serde_json::Value::String(s) => {
                assert!(!s.contains('\u{2014}'), "em-dash in text.json at {path}");
                if s.contains('!') {
                    assert!(
                        shouts.contains(&s.as_str()),
                        "unexpected '!' in text.json at {path}: {s}"
                    );
                }
            }
            _ => {}
        }
    }
    check_strings(&txt, "", &shouts);
}

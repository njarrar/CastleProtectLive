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
        "snapshot_lean.json",
        "snapshot_after_shot.json",
    ] {
        errs.extend(
            validate(&snap, &read(&f.join(n)))
                .into_iter()
                .map(|e| format!("{n}: {e}")),
        );
    }
    errs.extend(validate(&setup, &read(&f.join("setup_1_1.json"))));
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

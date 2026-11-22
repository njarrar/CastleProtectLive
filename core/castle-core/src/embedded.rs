//! The content shipped in the repo, built into the core so a game can start
//! with an empty content argument and the golden replays run anywhere.

use crate::content::Content;
use serde_json::{json, Value};

macro_rules! c {
    ($p:literal) => {
        include_str!(concat!("../../../content/", $p))
    };
}

pub const LEVEL_FILES: &[&str] = &[
    c!("levels/1-1.json"),
    c!("levels/1-2.json"),
    c!("levels/1-3.json"),
    c!("levels/1-4.json"),
    c!("levels/1-5.json"),
    c!("levels/1-6.json"),
    c!("levels/1-7.json"),
    c!("levels/1-8.json"),
    c!("levels/1-9.json"),
    c!("levels/1-10.json"),
    c!("levels/d1.json"),
    c!("levels/d2.json"),
];

fn parse(s: &str) -> Value {
    serde_json::from_str(s).unwrap_or(Value::Null)
}

/// The content bundle as JSON, keys matching the content files.
pub fn bundle_json() -> Value {
    json!({
        "materials": parse(c!("materials.json")),
        "classes": parse(c!("classes.json")),
        "hobs": parse(c!("hobs.json")),
        "shots": parse(c!("shots.json")),
        "doodads": parse(c!("doodads.json")),
        "blueprints": parse(c!("blueprints.json")),
        "rummage": parse(c!("rummage.json")),
        "levels": LEVEL_FILES.iter().map(|s| parse(s)).collect::<Vec<_>>(),
        "starter_box": parse(c!("starter_box.json")),
        "app": parse(c!("app.json")),
    })
}

pub fn content() -> Content {
    match serde_json::from_value::<Content>(bundle_json()) {
        Ok(c) => c,
        Err(e) => panic!("built in content does not parse: {e}"),
    }
}

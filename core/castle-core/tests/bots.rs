//! Bot against bot: 50 battles on every map and preset mix must finish with
//! no panic and a result.

use castle_core::{battle::Phase, embedded, replay, Battle};
use std::sync::Arc;

#[test]
fn fifty_bot_battles_finish() {
    let content = Arc::new(embedded::content());
    let levels: Vec<String> = content.levels.iter().map(|l| l.id.clone()).collect();
    let presets = ["cozy", "fair", "stubborn"];
    let mut ends = std::collections::BTreeMap::new();
    for i in 0..50u64 {
        let lvl = &levels[i as usize % levels.len()];
        let p0 = presets[i as usize % 3];
        let p1 = presets[(i as usize / 3) % 3];
        let setup = format!(r#"{{"level":"{lvl}","mode":"skirmish","sides":[{{"control":"ai","preset":"{p0}"}},{{"control":"ai","preset":"{p1}"}}]}}"#);
        let mut b = Battle::new(content.clone(), &setup, 1000 + i).expect("setup");
        let mut guard = 0;
        while b.phase != Phase::Ended && guard < 120 {
            replay::auto(&mut b, 1);
            let _ = b.snapshot();
            guard += 1;
        }
        let r = b.result.as_ref().unwrap_or_else(|| panic!("battle {i} on {lvl} did not end"));
        *ends.entry(r.how.clone()).or_insert(0) += 1;
    }
    println!("ends: {ends:?}");
}

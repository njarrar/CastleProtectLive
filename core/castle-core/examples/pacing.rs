//! Bot pacing report: Fair against Fair (or any presets) on every duel map.
//! Prints the end round distribution, the Squall share, how battles end,
//! each side's share of shots per Hob, the Plain Shot share and AI think
//! time. Run: cargo run --release -p castle-core --example pacing -- [N] [p0] [p1]
use castle_core::battle::Phase;
use castle_core::{embedded, Battle};
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let n: usize = args.get(1).and_then(|x| x.parse().ok()).unwrap_or(60);
    let p0 = args.get(2).cloned().unwrap_or_else(|| "fair".into());
    let p1 = args.get(3).cloned().unwrap_or_else(|| p0.clone());
    let content = Arc::new(embedded::content());
    let levels: Vec<String> = content
        .levels
        .iter()
        .filter(|l| matches!(l.kind.as_str(), "siege" | "skirmish" | "grand_fort"))
        .filter(|l| l.rules.squall)
        .map(|l| l.id.clone())
        .collect();
    let mut rounds: BTreeMap<i32, i32> = BTreeMap::new();
    let mut hows: BTreeMap<String, i32> = BTreeMap::new();
    let mut squall = 0;
    let mut hob_max_share = vec![];
    let mut plain = 0;
    let mut fired = 0;
    let mut think: Vec<u128> = vec![];
    let mut lock_sides = 0;
    let mut sides = 0;
    for i in 0..n {
        let lvl = &levels[i % levels.len()];
        let setup = format!(
            r#"{{"level":"{lvl}","mode":"skirmish","sides":[{{"control":"ai","preset":"{p0}"}},{{"control":"ai","preset":"{p1}"}}]}}"#
        );
        let mut b = Battle::new(content.clone(), &setup, 7000 + i as u64).unwrap();
        let mut per_hob: BTreeMap<(u8, u8), i32> = BTreeMap::new();
        let mut guard = 0;
        while b.phase != Phase::Ended && guard < 200 {
            if b.phase == Phase::Draft {
                b.command(&json!({"cmd": "end_draft"}));
            }
            if b.phase == Phase::Plan {
                let t = Instant::now();
                let r = b.command(&json!({"cmd": "ai_turn"}));
                think.push(t.elapsed().as_micros());
                for c in r["commands"].as_array().unwrap() {
                    if c["cmd"] == "pick_hob" {
                        let h = c["hob"].as_u64().unwrap() as u8;
                        *per_hob.entry((b.hobs[h as usize].side, h)).or_insert(0) += 1;
                    }
                    if c["cmd"] == "pick_shot" {
                        fired += 1;
                        if c["shot"] == "plain" {
                            plain += 1;
                        }
                    }
                }
            }
            b.run_until_plan(100_000);
            guard += 1;
        }
        let r = b.result.as_ref().expect("ended");
        *rounds.entry(r.round).or_insert(0) += 1;
        *hows.entry(r.how.clone()).or_insert(0) += 1;
        if b.squall_round() > 0 || r.how == "squall" || r.how == "double_pop" {
            squall += 1;
        }
        for s in 0..2u8 {
            let total: i32 = per_hob.iter().filter(|(k, _)| k.0 == s).map(|(_, v)| *v).sum();
            let max = per_hob.iter().filter(|(k, _)| k.0 == s).map(|(_, v)| *v).max().unwrap_or(0);
            if total >= 4 {
                let share = max * 100 / total;
                hob_max_share.push(share);
                sides += 1;
                if share > 60 {
                    lock_sides += 1;
                }
            }
        }
    }
    let total: i32 = rounds.values().sum();
    let in_band: i32 = rounds.iter().filter(|(r, _)| (7..=11).contains(*r)).map(|(_, v)| *v).sum();
    let mut sorted: Vec<i32> = rounds.iter().flat_map(|(r, c)| std::iter::repeat_n(*r, *c as usize)).collect();
    sorted.sort();
    think.sort();
    println!("{p0} vs {p1}, {n} battles on {levels:?}");
    println!("end round: {rounds:?}");
    println!("median round {}, rounds 7 to 11: {}%, reached the Squall: {}%", sorted[sorted.len() / 2], in_band * 100 / total, squall * 100 / total as usize);
    println!("ends: {hows:?}");
    hob_max_share.sort();
    println!("busiest Hob share per side: median {}%, over 60%: {lock_sides} of {sides} sides", hob_max_share.get(hob_max_share.len() / 2).copied().unwrap_or(0));
    println!("Plain Shot share: {}%", plain * 100 / fired.max(1));
    println!("ai_turn ms: p50 {:.1} p95 {:.1} max {:.1}",
        think[think.len() / 2] as f64 / 1000.0,
        think[think.len() * 95 / 100] as f64 / 1000.0,
        *think.last().unwrap() as f64 / 1000.0);
}

use castle_core::battle::Phase;
use castle_core::{embedded, Battle};
use serde_json::json;
use std::sync::Arc;
fn main() {
    let c = Arc::new(embedded::content());
    let lvl = std::env::args().nth(1).unwrap_or("d1".into());
    let setup = format!(r#"{{"level":"{lvl}","mode":"skirmish","sides":[{{"control":"ai"}},{{"control":"ai"}}]}}"#);
    let mut b = Battle::new(c, &setup, std::env::args().nth(2).and_then(|x| x.parse().ok()).unwrap_or(7003)).unwrap();
    b.command(&json!({"cmd":"end_draft"}));
    let _ = b.snapshot();
    while b.phase != Phase::Ended && b.round < 25 {
        let side = b.side;
        let st: Vec<String> = b.hobs.iter().filter(|h| h.side==side).map(|h| format!("{}:{}hp{}{}{}r{}", h.id, h.def, h.hp, if h.buried {"B"} else {""}, if b.can_fire_hob(side,h.id) {"F"} else {""}, h.rest)).collect();
        println!("  crew {}", st.join(" "));
        let r = b.command(&json!({"cmd":"ai_turn"}));
        b.run_until_plan(100000);
        let snap = b.snapshot();
        let mut kettle = 0; let mut blocks = 0; let mut hob = 0; let mut br = 0; let mut col=0; let mut miss=0; let mut wake=0;
        for e in snap["events"].as_array().unwrap() {
            match e["t"].as_str().unwrap() {
                "hit" if b.round>=12 && e["target"]=="hob" => { println!("   {}", e); }
                "hit" => { let d = e["dmg"].as_i64().unwrap_or(0); if e["side"].as_u64()==Some(side as u64) {continue;} match e["target"].as_str().unwrap() {"kettle"=>kettle+=d,"block"=>blocks+=d,"hob"=>hob+=d,_=>{}} }
                "break" => br+=1, "collapse" => col+=1, "miss"=>miss+=1, "prop_wake"=>wake+=1, _=>{}
            }
        }
        let cmds: Vec<String> = r["commands"].as_array().unwrap().iter().map(|c| format!("{}", c)).collect();
        println!("r{} s{} kettle{} blocks{} hob{} breaks{} coll{} miss{} | k=[{},{}] | {}", b.round, side, kettle, blocks, hob, br, col, miss, b.castles[0].kettle_hp, b.castles[1].kettle_hp, cmds.join(" "));
    }
    for h in &b.hobs { println!("hob {} side {} {} hp {}/{} {:?} nook {:?}", h.id, h.side, h.def, h.hp, h.max, h.state, h.nook); }
    println!("{:?}", b.result.map(|r| (r.how, r.round)));
}

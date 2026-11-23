//! Campaign win rates for a human-like player bot against the level's Rival.
//!
//! The player bot plays like the QA playtest script: it picks a Hob that can
//! fire, its Knack when ready (else a Trick Shell, else the Plain Shot),
//! aims at the weakest enemy Hob (the cage on a Rescue, with Plain Shots once
//! the captive is hurt), solves the arc with
//! probes, then adds aim error that shrinks as it corrects from its last Pin.
//! It does not read Lean Lines, Walk or use Doodads. About 80% of its shots
//! hit the Rival fort.
//!
//! Run: cargo run --release -p castle-core --example winrate -- [N] [preset] [levels...]
//! A `d*` level plays as the web app's Skirmish: both sides seat the first
//! four player Hobs, the player on the level's loaner fort, the Rival on the
//! Stone Skirt kit fort, light wind, Quick Pick shells, coin toss for the
//! first turn and a 10 round cap (BOT_CAP overrides it).
//!
//! Env: BOT_ANGLE, BOT_POWER (aim error), BOT_APP_SEED (the web app's one
//! seed per level), BOT_CREW (player crew JSON list), BOT_RIVAL and
//! BOT_RULES (extra setup fields to try a tuning), BOT_TAKEN (print each
//! battle's end and what hurt the player most), BOT_FRAMES (play in 2 tick
//! frames with a snapshot each, as a live app does, and print snapshot sizes).
use castle_core::actor::Hit;
use castle_core::battle::{block_world_center, Phase};
use castle_core::content::FlightKind;
use castle_core::rng::Sfc32;
use castle_core::{embedded, Battle};
use serde_json::json;
use std::sync::Arc;

/// Aim error at a new target: angle in tenths of a degree, power points.
/// (BOT_ANGLE and BOT_POWER override them.)
fn sigma() -> (i64, i64) {
    let e = |k: &str, d: i64| {
        std::env::var(k)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(d)
    };
    (e("BOT_ANGLE", 15), e("BOT_POWER", 2))
}
/// Share of the last error kept when firing again at the same target.
const KEEP_PCT: i64 = 40;

struct Bot {
    rng: Sfc32,
    last_target: Option<(i32, i32)>,
    err: (i64, i64),
    next_hob: usize,
}

fn nrm(rng: &mut Sfc32, sigma: i64) -> i64 {
    rng.normal_q16() * sigma / 65536
}

impl Bot {
    fn target(&self, b: &Battle) -> (i32, i32) {
        // Rescue: the cage bars
        if let Some(p) = b
            .props
            .iter()
            .find(|p| p.tag == "cage" && p.hp > 0 && p.side == 2)
        {
            return (p.x, p.y - 8);
        }
        let weakest = b
            .hobs
            .iter()
            .filter(|h| h.side == 1 && h.alive() && !h.dummy)
            .min_by_key(|h| (h.hp, h.id));
        if let Some(h) = weakest {
            let (x, y) = b.hob_feet(h.id);
            return (x, y - 8);
        }
        let cs = &b.castles[1];
        block_world_center(cs, cs.kettle.c, cs.kettle.r)
    }

    fn solve(b: &Battle, hob: u8, shot: usize, tx: i32, ty: i32) -> (i32, i32) {
        let mut best = (450, 60, i32::MAX);
        let mut units = 0i64;
        for angle in [250, 350, 450, 550, 650, 750] {
            let (mut lo, mut hi) = (5, 100);
            for _ in 0..9 {
                let p = (lo + hi) / 2;
                let a = b.aim_probe(0, hob, shot, angle, p);
                let (_, end, hit) = b.probe_path(a, 720, false, &mut units);
                let enemy = match hit {
                    Some(Hit::Block { side, .. }) => side == 1,
                    Some(Hit::Hob(h)) => b.hobs[h as usize].side == 1,
                    Some(Hit::Kettle(s)) => s == 1,
                    Some(Hit::Prop(_)) => true,
                    _ => false,
                };
                let miss =
                    (end.0 - tx).abs() + (end.1 - ty).abs() / 2 + if enemy { 0 } else { 10_000 };
                if miss < best.2 {
                    best = (angle, p, miss);
                }
                if end.0 < tx {
                    lo = p + 1;
                } else {
                    hi = p - 1;
                }
                if lo > hi {
                    break;
                }
            }
        }
        (best.0, best.1)
    }

    fn turn(&mut self, b: &mut Battle) {
        let n = b.hobs.len();
        let mut hob = None;
        for k in 0..n {
            let i = (self.next_hob + k) % n;
            let h = &b.hobs[i];
            if h.side == 0 && b.can_fire_hob(0, h.id) {
                hob = Some(h.id);
                self.next_hob = i + 1;
                break;
            }
        }
        let Some(hob) = hob else {
            b.command(&json!({"cmd": "pass"}));
            return;
        };
        b.command(&json!({"cmd": "pick_hob", "hob": hob}));
        let arc = |b: &Battle, w: &str| -> Option<usize> {
            let id = b.shot_for(hob, w)?;
            let ix = b.shot_index(&id)?;
            let d = &b.content.shots[ix];
            (d.flight.kind != FlightKind::SelfTarget && !d.dud).then_some(ix)
        };
        let mut choice = None;
        // on a Rescue, once the captive is hurt, only Plain Shots go near her
        let careful = b
            .props
            .iter()
            .any(|p| p.kind == "captive" && p.hp > 0 && p.hp < p.max);
        let mut opts: Vec<String> = vec![];
        if !careful {
            opts.push("knack".into());
            opts.extend(b.hands[0].iter().cloned());
        }
        opts.push("plain".into());
        for w in opts {
            if b.shot_ready(0, hob, &w).is_ok() {
                if let Some(ix) = arc(b, &w) {
                    choice = Some((w, ix));
                    break;
                }
            }
        }
        let Some((w, ix)) = choice else {
            b.command(&json!({"cmd": "pass"}));
            return;
        };
        b.command(&json!({"cmd": "pick_shot", "shot": w}));
        let t = self.target(b);
        let (angle, power) = Bot::solve(b, hob, ix, t.0, t.1);
        let near = self
            .last_target
            .is_some_and(|l| (l.0 - t.0).abs() < 24 && (l.1 - t.1).abs() < 24);
        let (sa, sp) = sigma();
        self.err = if near {
            (
                self.err.0 * KEEP_PCT / 100 + nrm(&mut self.rng, sa / 4),
                self.err.1 * KEEP_PCT / 100 + nrm(&mut self.rng, sp / 4 + 1),
            )
        } else {
            (nrm(&mut self.rng, sa), nrm(&mut self.rng, sp))
        };
        self.last_target = Some(t);
        let a = (angle as i64 + self.err.0).clamp(0, 1800);
        let p = (power as i64 + self.err.1).clamp(1, 100);
        b.command(&json!({"cmd": "aim", "angle": a, "power": p}));
        let r = b.command(&json!({"cmd": "fire"}));
        if r["ok"] != json!(true) {
            b.command(&json!({"cmd": "pass"}));
        }
    }
}

/// Snapshot sizes as a live app sees them, by round.
#[derive(Default)]
struct Frames {
    /// (round, bytes, events, terrain chunks, collapse events, tick)
    big: Vec<(i32, usize, usize, usize, usize, i64)>,
    /// The frame that carries the `fatigue` event, and the next 120 frames
    /// (bytes, events) summed.
    fatigue: Option<(usize, usize, usize, usize)>,
    after: Option<usize>,
}

impl Frames {
    fn take(&mut self, b: &mut Battle) -> Vec<serde_json::Value> {
        let s = b.snapshot();
        let text = s.to_string();
        let ev = s["events"].as_array().cloned().unwrap_or_default();
        let chunks = s["terrain"]["chunks"].as_array().map_or(0, |c| c.len());
        let collapses = ev.iter().filter(|e| e["t"] == "collapse").count();
        self.big
            .push((b.round, text.len(), ev.len(), chunks, collapses, b.tick));
        if ev.iter().any(|e| e["t"] == "fatigue") {
            self.fatigue = Some((text.len(), ev.len(), collapses, 0));
            self.after = Some(0);
        } else if let (Some(n), Some(f)) = (self.after, self.fatigue.as_mut()) {
            if n < 120 {
                f.3 += text.len();
                self.after = Some(n + 1);
            }
        }
        ev
    }

    /// Step to the next plan (or the end) in 2 tick frames; returns the events.
    fn pump(&mut self, b: &mut Battle) -> Vec<serde_json::Value> {
        let mut seen = self.take(b);
        let mut guard = 0;
        while matches!(b.phase, Phase::Resolve | Phase::Settle(_)) && guard < 50_000 {
            guard += 1;
            b.step(2);
            seen.extend(self.take(b));
        }
        seen
    }

    fn report(&self, lvl: &str, seed: u64) {
        let first = self.big.iter().skip(1); // the first frame sends the whole map
        let max = first.clone().max_by_key(|x| x.1);
        let r10 = self
            .big
            .iter()
            .filter(|x| (9..=11).contains(&x.0))
            .max_by_key(|x| x.1);
        let most_ev = first.clone().max_by_key(|x| x.2);
        // the most bytes in any 60 frames (one second at 60 fps), after the first
        let mut win = (0usize, 0i32);
        for w in self.big[1..].windows(60) {
            let sum: usize = w.iter().map(|x| x.1).sum();
            if sum > win.0 {
                win = (sum, w[0].0);
            }
        }
        let full = self.big.iter().filter(|x| x.1 > 2000).count();
        println!(
            "frames {lvl} seed {seed}: busiest second {} B in round {}; full frames {full}; first {} B; biggest later (round, bytes, events, chunks, collapses, tick) {max:?}; rounds 9-11 {r10:?}; most events {most_ev:?}; fatigue frame (bytes, events, collapses, next 120 frames bytes) {:?}; frames {}",
            win.0,
            win.1,
            self.big.first().map_or(0, |x| x.1),
            self.fatigue,
            self.big.len()
        );
    }
}

struct Run {
    win: bool,
    round: i32,
    how: String,
    shots: i32,
    hits: i32,
    pennants: Vec<bool>,
}

fn play(content: &Arc<castle_core::Content>, lvl: &str, preset: &str, seed: u64) -> Run {
    // BOT_CREW: the player's crew as a JSON list (the app's crew picks)
    let crew = std::env::var("BOT_CREW")
        .map(|c| format!(r#","crew":{c}"#))
        .unwrap_or_default();
    // BOT_RIVAL and BOT_RULES: extra setup fields for the Rival side and the
    // battle, to try a tuning before it goes into content
    let extra = |k: &str| {
        std::env::var(k)
            .map(|v| format!(",{v}"))
            .unwrap_or_default()
    };
    let (rival, rules) = (extra("BOT_RIVAL"), extra("BOT_RULES"));
    let setup = if lvl.starts_with('d') {
        // the web app's Skirmish setup (apps/web/src/screens/setup.ts)
        let cap = std::env::var("BOT_CAP").unwrap_or_else(|_| "10".into());
        let crew = if crew.is_empty() {
            r#","crew":["marge","quill","jax","grub"]"#.to_string()
        } else {
            crew
        };
        format!(
            r#"{{"level":"{lvl}","mode":"skirmish","sides":[{{"control":"human","name":"You"{crew}}},{{"control":"ai","preset":"{preset}","name":"Sir Pudge","crew":["marge","quill","jax","grub"],"blueprint":"bp_kit_stone"{rival}}}],"round_cap":{cap},"wind":{{"min":0,"max":3}},"rummage":{{"pool":6,"picks":2}}{rules}}}"#
        )
    } else {
        format!(
            r#"{{"level":"{lvl}","mode":"campaign","sides":[{{"control":"human"{crew}}},{{"control":"ai","preset":"{preset}"{rival}}}]{rules}}}"#
        )
    };
    // BOT_APP_SEED: the battle seed the web app used in the playtest (FNV-1a
    // of the level id, the same on every Retry); only the bot's aim varies
    let battle_seed = if std::env::var("BOT_APP_SEED").is_ok() {
        lvl.bytes()
            .fold(2166136261u32, |h, c| (h ^ c as u32).wrapping_mul(16777619)) as u64
    } else {
        seed
    };
    let mut b = Battle::new(content.clone(), &setup, battle_seed).expect("setup");
    let mut bot = Bot {
        rng: Sfc32::new(seed, "player_bot"),
        last_target: None,
        err: (0, 0),
        next_hob: 0,
    };
    // BOT_FRAMES: play as a live app does (2 tick steps, a snapshot each
    // frame) and print the biggest frames around the round 10 Fatigue start
    let mut frames = std::env::var("BOT_FRAMES").is_ok().then(Frames::default);
    let (mut shots, mut hits) = (0, 0);
    let mut guard = 0;
    while b.phase != Phase::Ended && guard < 400 {
        guard += 1;
        match b.phase {
            Phase::Draft => {
                b.command(&json!({"cmd": "end_draft"}));
            }
            Phase::Plan => {
                if b.side == 0 {
                    b.events.clear();
                    bot.turn(&mut b);
                    let seen = match frames.as_mut() {
                        Some(f) => f.pump(&mut b),
                        None => {
                            b.run_until_plan(100_000);
                            std::mem::take(&mut b.events)
                        }
                    };
                    // a shot counts as a hit when it hurt the Rival fort, crew or a cage bar
                    if seen.iter().any(|e| e["t"] == "fire") {
                        shots += 1;
                        if seen
                            .iter()
                            .any(|e| e["t"] == "hit" && (e["side"] == 1 || e["target"] == "prop"))
                        {
                            hits += 1;
                        }
                    }
                } else {
                    b.command(&json!({"cmd": "ai_turn"}));
                }
            }
            _ => {}
        }
        match frames.as_mut() {
            Some(f) => {
                f.pump(&mut b);
            }
            None => {
                b.run_until_plan(100_000);
            }
        }
    }
    if let Some(f) = &frames {
        f.report(lvl, seed);
    }
    let r = b.result.as_ref().expect("battle ended");
    if std::env::var("BOT_TAKEN").is_ok() {
        let mut t = b.stats[0].taken.clone();
        t.sort_by_key(|x| std::cmp::Reverse(x.2));
        let hp: Vec<(u8, i32)> = b.hobs.iter().map(|h| (h.side, h.hp)).collect();
        println!(
            "{lvl} w{} {} r{} kettles {} {} hobs {hp:?} taken {:?}",
            r.winner,
            r.how,
            r.round,
            b.castles[0].kettle_hp,
            b.castles[1].kettle_hp,
            &t[..t.len().min(4)]
        );
    }
    Run {
        win: r.winner == 0,
        round: r.round,
        how: r.how.clone(),
        shots,
        hits,
        pennants: r.pennants.clone(),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let n: u64 = args.get(1).and_then(|x| x.parse().ok()).unwrap_or(30);
    let preset = args.get(2).cloned().unwrap_or_else(|| "fair".into());
    let content = Arc::new(embedded::content());
    let mut levels: Vec<String> = args.iter().skip(3).cloned().collect();
    if levels.is_empty() {
        levels = (1..=10).map(|i| format!("1-{i}")).collect();
    }
    // every (level, seed) is one job; a few worker threads share them
    let jobs: Vec<(usize, u64)> = (0..levels.len())
        .flat_map(|l| (0..n).map(move |i| (l, i)))
        .collect();
    let jobs = Arc::new(std::sync::Mutex::new(jobs));
    let workers = std::thread::available_parallelism()
        .map(|x| x.get())
        .unwrap_or(4);
    let handles: Vec<_> = (0..workers)
        .map(|_| {
            let (content, levels, preset, jobs) = (
                content.clone(),
                levels.clone(),
                preset.clone(),
                jobs.clone(),
            );
            std::thread::spawn(move || {
                let mut out = vec![];
                loop {
                    let job = jobs.lock().expect("jobs").pop();
                    let Some((l, i)) = job else { break };
                    out.push((l, i, play(&content, &levels[l], &preset, 0x5eed_0000 + i)));
                }
                out
            })
        })
        .collect();
    let mut all: Vec<(usize, u64, Run)> = handles
        .into_iter()
        .flat_map(|h| h.join().expect("thread"))
        .collect();
    all.sort_by_key(|x| (x.0, x.1));
    println!("level | wins | win % | median round | fort hits % | pennants % | ends");
    for (l, lvl) in levels.iter().enumerate() {
        let runs: Vec<&Run> = all.iter().filter(|x| x.0 == l).map(|x| &x.2).collect();
        let wins = runs.iter().filter(|r| r.win).count();
        let mut rounds: Vec<i32> = runs.iter().map(|r| r.round).collect();
        rounds.sort();
        let shots: i32 = runs.iter().map(|r| r.shots).sum();
        let hits: i32 = runs.iter().map(|r| r.hits).sum();
        let mut ends = std::collections::BTreeMap::new();
        for r in runs.iter() {
            *ends
                .entry(format!("{}{}", if r.win { "W " } else { "L " }, r.how))
                .or_insert(0) += 1;
        }
        // share of all battles that earned each Pennant
        let np = runs.iter().map(|r| r.pennants.len()).max().unwrap_or(0);
        let pen: Vec<String> = (0..np)
            .map(|i| {
                let got = runs
                    .iter()
                    .filter(|r| r.pennants.get(i).copied().unwrap_or(false))
                    .count();
                format!("{}", got * 100 / runs.len())
            })
            .collect();
        println!(
            "{lvl} | {wins}/{} | {}% | {} | {}% | {} | {ends:?}",
            runs.len(),
            wins * 100 / runs.len(),
            rounds[rounds.len() / 2],
            hits * 100 / shots.max(1),
            pen.join("/"),
        );
    }
}

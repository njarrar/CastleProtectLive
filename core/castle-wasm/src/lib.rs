//! wasm-bindgen wrapper with the same calls as the C ABI.
//! `Game` is the handle; JS frees it with `free()` (cp_free).
//!
//! Panics: on `wasm32-unknown-unknown` a Rust panic is a trap, which can not
//! be caught in Rust. A panic hook stores the panic text first; JS sees a
//! `RuntimeError` thrown from the call, and can read the text with
//! `last_error()`. That `Game` is then dead (wasm-bindgen leaves it marked as
//! borrowed, so every later method throws): drop it, make a new `Game` with
//! the same setup and seed, and send `{"cmd":"resume","log":[...]}` with the
//! saved command log. On native targets (the tests) the same calls catch the
//! panic and return `{"ok":false,"reason":"panic"}` like the C ABI.

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{Mutex, Once};
use wasm_bindgen::prelude::*;

static HOOK: Once = Once::new();
static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);

fn set_error(e: Option<String>) {
    match LAST_ERROR.lock() {
        Ok(mut g) => *g = e,
        Err(p) => *p.into_inner() = e,
    }
}

fn install_hook() {
    HOOK.call_once(|| {
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = info.payload().downcast_ref::<String>() {
                s.clone()
            } else {
                "unknown panic".to_string()
            };
            let at = info
                .location()
                .map(|l| format!(" at {}:{}", l.file(), l.line()))
                .unwrap_or_default();
            set_error(Some(format!("panic: {msg}{at}")));
            prev(info);
        }));
    });
}

fn refusal(reason: &str, detail: &str) -> String {
    serde_json::json!({"ok": false, "reason": reason, "detail": detail}).to_string()
}

#[wasm_bindgen]
pub struct Game {
    inner: castle_core::Game,
    dead: bool,
}

impl Game {
    fn guarded<F: FnOnce(&mut castle_core::Game) -> String>(
        &mut self,
        check_refusal: bool,
        f: F,
    ) -> String {
        if self.dead {
            let r = refusal(
                "dead_handle",
                "an earlier call panicked; rebuild from the log",
            );
            set_error(Some(r.clone()));
            return r;
        }
        match catch_unwind(AssertUnwindSafe(|| f(&mut self.inner))) {
            Ok(s) => {
                if check_refusal && is_refusal(&s) {
                    set_error(Some(s.clone()));
                }
                s
            }
            Err(_) => {
                self.dead = true;
                let e = last_error().unwrap_or_else(|| "panic".into());
                refusal("panic", &e)
            }
        }
    }
}

#[wasm_bindgen]
impl Game {
    /// cp_new. `content_json` may be "" for the built in content. `seed` is a
    /// u64: pass a `BigInt` from JS (`new Game("", setup, 42n)`).
    #[wasm_bindgen(constructor)]
    pub fn new(content_json: &str, level_json: &str, seed: u64) -> Result<Game, JsValue> {
        install_hook();
        match catch_unwind(|| castle_core::Game::new(content_json, level_json, seed)) {
            Ok(Ok(inner)) => {
                set_error(None);
                Ok(Game { inner, dead: false })
            }
            Ok(Err(e)) => {
                set_error(Some(e.clone()));
                Err(JsValue::from_str(&e))
            }
            Err(_) => Err(JsValue::from_str(
                &last_error().unwrap_or_else(|| "panic".into()),
            )),
        }
    }

    /// cp_command
    pub fn command(&mut self, json: &str) -> String {
        self.guarded(true, |g| g.command(json))
    }

    /// cp_step
    pub fn step(&mut self, ticks: i32) -> String {
        self.guarded(false, |g| g.step(ticks))
    }

    /// cp_snapshot
    pub fn snapshot(&mut self) -> String {
        self.guarded(false, |g| g.snapshot())
    }
}

/// Free function forms, matching the C names.
#[wasm_bindgen]
pub fn cp_new(content_json: &str, level_json: &str, seed: u64) -> Result<Game, JsValue> {
    Game::new(content_json, level_json, seed)
}

#[wasm_bindgen]
pub fn cp_command(game: &mut Game, json: &str) -> String {
    game.command(json)
}

#[wasm_bindgen]
pub fn cp_step(game: &mut Game, ticks: i32) -> String {
    game.step(ticks)
}

#[wasm_bindgen]
pub fn cp_snapshot(game: &mut Game) -> String {
    game.snapshot()
}

/// The last error: a refusal reply, a failed `new Game`, or the text of a
/// panic (after a call threw a `RuntimeError`). Needs no `Game`, so it works
/// when the `Game` is dead.
#[wasm_bindgen]
pub fn last_error() -> Option<String> {
    match LAST_ERROR.lock() {
        Ok(g) => g.clone(),
        Err(p) => p.into_inner().clone(),
    }
}

/// Same as `last_error`, under the C name.
#[wasm_bindgen]
pub fn cp_last_error() -> Option<String> {
    last_error()
}

#[wasm_bindgen]
pub fn cp_version() -> String {
    install_hook();
    castle_core::version_json()
}

/// The golden replay hashes, "<name> <hash>" per line, same as native.
#[wasm_bindgen]
pub fn golden_hashes() -> String {
    install_hook();
    castle_core::replay::golden_lines()
}

/// The built in content bundle as JSON.
#[wasm_bindgen]
pub fn default_content() -> String {
    install_hook();
    castle_core::embedded::bundle_json().to_string()
}

/// Daily Dust-up seed for a local date text.
#[wasm_bindgen]
pub fn daily_seed(date: &str) -> u64 {
    install_hook();
    castle_core::daily_seed(date)
}

/// Same as `daily_seed`, under the C name.
#[wasm_bindgen]
pub fn cp_daily_seed(date: &str) -> u64 {
    daily_seed(date)
}

/// A command reply (or a list of replies) with `"ok": false` in it.
fn is_refusal(s: &str) -> bool {
    if !s.contains("\"ok\":false") {
        return false;
    }
    match serde_json::from_str::<serde_json::Value>(s) {
        Ok(serde_json::Value::Array(a)) => a.iter().any(|v| v["ok"] == false),
        Ok(v) => v["ok"] == false,
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panics_are_caught_on_native_and_the_game_is_dead() {
        let mut g = Game {
            inner: castle_core::Game::new("", r#"{"level":"1-1"}"#, 1).unwrap(),
            dead: false,
        };
        install_hook();
        let r = g.guarded(true, |_| panic!("boom"));
        assert!(r.contains("\"panic\""), "{r}");
        assert!(last_error().unwrap_or_default().contains("boom"));
        assert!(g.command(r#"{"cmd":"pass"}"#).contains("dead_handle"));
    }
}

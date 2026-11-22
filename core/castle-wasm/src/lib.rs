//! wasm-bindgen wrapper with the same calls as the C ABI.
//! `Game` is the handle; JS frees it with `free()` (cp_free).

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Game {
    inner: castle_core::Game,
}

#[wasm_bindgen]
impl Game {
    /// cp_new. `content_json` may be "" for the built in content.
    #[wasm_bindgen(constructor)]
    pub fn new(content_json: &str, level_json: &str, seed: u64) -> Result<Game, JsValue> {
        castle_core::Game::new(content_json, level_json, seed)
            .map(|inner| Game { inner })
            .map_err(|e| JsValue::from_str(&e))
    }

    /// cp_command
    pub fn command(&mut self, json: &str) -> String {
        self.inner.command(json)
    }

    /// cp_step
    pub fn step(&mut self, ticks: i32) -> String {
        self.inner.step(ticks)
    }

    /// cp_snapshot
    pub fn snapshot(&mut self) -> String {
        self.inner.snapshot()
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

#[wasm_bindgen]
pub fn cp_version() -> String {
    castle_core::version_json()
}

/// The golden replay hashes, "<name> <hash>" per line, same as native.
#[wasm_bindgen]
pub fn golden_hashes() -> String {
    castle_core::replay::golden_lines()
}

/// The built in content bundle as JSON.
#[wasm_bindgen]
pub fn default_content() -> String {
    castle_core::embedded::bundle_json().to_string()
}

/// Daily Dust-up seed for a local date text.
#[wasm_bindgen]
pub fn daily_seed(date: &str) -> u64 {
    castle_core::daily_seed(date)
}

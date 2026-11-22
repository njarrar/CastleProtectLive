//! C ABI for the Castle Protect core. Strings in and out are UTF-8, NUL
//! terminated. Every string this library returns must be released with
//! `cp_free_string`. A handle from `cp_new` must be released with `cp_free`.

use castle_core::Game;
use std::ffi::{c_char, CStr, CString};
use std::ptr;

/// Opaque battle handle.
pub struct CpGame {
    game: Game,
    last_error: Option<CString>,
}

unsafe fn read_str<'a>(p: *const c_char) -> &'a str {
    if p.is_null() {
        return "";
    }
    CStr::from_ptr(p).to_str().unwrap_or("")
}

fn out(s: String) -> *mut c_char {
    CString::new(s.replace('\0', ""))
        .map(|c| c.into_raw())
        .unwrap_or(ptr::null_mut())
}

static mut LAST_NEW_ERROR: Option<CString> = None;

/// Start a battle. `content_json` may be NULL or "" for the built in content.
/// `level_json` is the battle setup (see core/API.md). Returns NULL on error;
/// `cp_last_error(NULL)` then gives the reason.
///
/// # Safety
/// The string arguments must be NULL or valid NUL terminated UTF-8.
#[no_mangle]
pub unsafe extern "C" fn cp_new(
    content_json: *const c_char,
    level_json: *const c_char,
    seed: u64,
) -> *mut CpGame {
    match Game::new(read_str(content_json), read_str(level_json), seed) {
        Ok(game) => Box::into_raw(Box::new(CpGame {
            game,
            last_error: None,
        })),
        Err(e) => {
            LAST_NEW_ERROR = CString::new(e).ok();
            ptr::null_mut()
        }
    }
}

/// Apply a command (JSON object or array of objects). Returns the JSON reply.
///
/// # Safety
/// `handle` must come from `cp_new`; `json` must be valid UTF-8 or NULL.
#[no_mangle]
pub unsafe extern "C" fn cp_command(handle: *mut CpGame, json: *const c_char) -> *mut c_char {
    let Some(h) = handle.as_mut() else {
        return out("{\"ok\":false,\"reason\":\"null_handle\"}".into());
    };
    out(h.game.command(read_str(json)))
}

/// Advance the sim by whole 120 Hz ticks. Returns {"tick":..,"phase":..}.
///
/// # Safety
/// `handle` must come from `cp_new`.
#[no_mangle]
pub unsafe extern "C" fn cp_step(handle: *mut CpGame, ticks: i32) -> *mut c_char {
    let Some(h) = handle.as_mut() else {
        return out("{}".into());
    };
    out(h.game.step(ticks))
}

/// The frame snapshot as JSON. Drains events and dirty terrain chunks.
///
/// # Safety
/// `handle` must come from `cp_new`.
#[no_mangle]
pub unsafe extern "C" fn cp_snapshot(handle: *mut CpGame) -> *mut c_char {
    let Some(h) = handle.as_mut() else {
        return out("{}".into());
    };
    out(h.game.snapshot())
}

/// The last error text for `handle`, or for `cp_new` when `handle` is NULL.
/// Returns NULL when there is none. Free with `cp_free_string`.
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`.
#[no_mangle]
pub unsafe extern "C" fn cp_last_error(handle: *mut CpGame) -> *mut c_char {
    let e = match handle.as_mut() {
        Some(h) => h.last_error.clone(),
        None => (*ptr::addr_of!(LAST_NEW_ERROR)).clone(),
    };
    e.map(|c| c.into_raw()).unwrap_or(ptr::null_mut())
}

/// Version info as JSON.
#[no_mangle]
pub extern "C" fn cp_version() -> *mut c_char {
    out(castle_core::version_json())
}

/// Daily Dust-up seed for a local date text such as "2026-11-22".
///
/// # Safety
/// `date` must be NULL or valid NUL terminated UTF-8.
#[no_mangle]
pub unsafe extern "C" fn cp_daily_seed(date: *const c_char) -> u64 {
    castle_core::daily_seed(read_str(date))
}

/// Golden replay hashes, one "<name> <hash>" line each.
#[no_mangle]
pub extern "C" fn cp_golden_hashes() -> *mut c_char {
    out(castle_core::replay::golden_lines())
}

/// Release a string returned by this library.
///
/// # Safety
/// `s` must be NULL or a pointer this library returned, freed only once.
#[no_mangle]
pub unsafe extern "C" fn cp_free_string(s: *mut c_char) {
    if !s.is_null() {
        drop(CString::from_raw(s));
    }
}

/// Release a battle handle.
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`, freed only once.
#[no_mangle]
pub unsafe extern "C" fn cp_free(handle: *mut CpGame) {
    if !handle.is_null() {
        drop(Box::from_raw(handle));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        unsafe {
            let level = CString::new(r#"{"level":"1-1"}"#).unwrap();
            let h = cp_new(ptr::null(), level.as_ptr(), 7);
            assert!(!h.is_null());
            let cmd = CString::new(r#"{"cmd":"aim","angle":450,"power":70}"#).unwrap();
            let r = cp_command(h, cmd.as_ptr());
            let s = CStr::from_ptr(r).to_str().unwrap().to_string();
            assert!(s.contains("\"ok\":true"), "{s}");
            cp_free_string(r);
            let st = cp_step(h, 10);
            cp_free_string(st);
            let snap = cp_snapshot(h);
            assert!(CStr::from_ptr(snap).to_str().unwrap().contains("\"hud\""));
            cp_free_string(snap);
            cp_free(h);
        }
    }

    #[test]
    fn header_lists_every_function() {
        let h = include_str!("../include/castle_core.h");
        for f in [
            "cp_new",
            "cp_command",
            "cp_step",
            "cp_snapshot",
            "cp_free_string",
            "cp_free",
            "cp_last_error",
            "cp_version",
            "cp_golden_hashes",
            "cp_daily_seed",
        ] {
            assert!(h.contains(f), "header misses {f}");
        }
    }
}

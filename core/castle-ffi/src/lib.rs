//! C ABI for the Castle Protect core. Strings in and out are UTF-8, NUL
//! terminated. Every string this library returns must be released with
//! `cp_free_string`. A handle from `cp_new` must be released with `cp_free`.
//!
//! No panic crosses this boundary: every function runs its body inside
//! `catch_unwind`. A panic inside a call on a handle returns
//! `{"ok":false,"reason":"panic","detail":...}`, stores the text for
//! `cp_last_error`, and marks the handle dead: every later call on it
//! returns `{"ok":false,"reason":"dead_handle",...}` without touching the
//! battle. `cp_free` still works. The app rebuilds the battle from its saved
//! setup, seed and command log (`cp_new`, then the `resume` command).

use castle_core::Game;
use std::cell::RefCell;
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;

/// Opaque battle handle.
pub struct CpGame {
    game: Game,
    last_error: Option<CString>,
    /// Set by a caught panic: the handle refuses every later call.
    dead: Option<String>,
    /// Debug builds refuse calls from a thread other than the one that made
    /// the handle (the core is single threaded per handle).
    #[cfg(debug_assertions)]
    owner: std::thread::ThreadId,
}

thread_local! {
    /// The error from this thread's last failed `cp_new`, cleared by a good
    /// one. Per thread, so a preload thread and the UI thread never race.
    static LAST_NEW_ERROR: RefCell<Option<CString>> = const { RefCell::new(None) };
}

fn set_new_error(e: Option<String>) {
    let v = e.and_then(|s| CString::new(s.replace('\0', "")).ok());
    LAST_NEW_ERROR.with(|c| *c.borrow_mut() = v);
}

/// NULL reads as "". Bad UTF-8 is an error, never a silent "".
unsafe fn read_str<'a>(p: *const c_char) -> Result<&'a str, String> {
    if p.is_null() {
        return Ok("");
    }
    CStr::from_ptr(p)
        .to_str()
        .map_err(|_| "string argument is not valid UTF-8".to_string())
}

fn out(s: String) -> *mut c_char {
    CString::new(s.replace('\0', ""))
        .map(|c| c.into_raw())
        .unwrap_or(ptr::null_mut())
}

fn refusal(reason: &str, detail: &str) -> String {
    serde_json::json!({"ok": false, "reason": reason, "detail": detail}).to_string()
}

fn panic_text(p: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = p.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = p.downcast_ref::<String>() {
        s.clone()
    } else {
        "unknown panic".to_string()
    }
}

/// Run `f` on a live handle. Catches panics (the handle is then dead) and
/// records refusals for `cp_last_error`.
fn guarded<F: FnOnce(&mut Game) -> String>(h: &mut CpGame, f: F) -> String {
    if let Some(why) = &h.dead {
        let r = refusal(
            "dead_handle",
            &format!("an earlier call panicked ({why}); rebuild the battle from its log"),
        );
        h.last_error = CString::new(r.clone()).ok();
        return r;
    }
    #[cfg(debug_assertions)]
    if std::thread::current().id() != h.owner {
        let r = refusal(
            "wrong_thread",
            "call a handle only from the thread that made it",
        );
        h.last_error = CString::new(r.clone()).ok();
        return r;
    }
    match catch_unwind(AssertUnwindSafe(|| f(&mut h.game))) {
        Ok(s) => {
            if is_refusal(&s) {
                h.last_error = CString::new(s.replace('\0', "")).ok();
            }
            s
        }
        Err(p) => {
            let msg = panic_text(p.as_ref());
            h.dead = Some(msg.clone());
            h.last_error = CString::new(format!("panic: {}", msg.replace('\0', ""))).ok();
            refusal("panic", &msg)
        }
    }
}

/// Start a battle. `content_json` may be NULL or "" for the built in content.
/// `level_json` is the battle setup (see core/API.md). Returns NULL on error;
/// `cp_last_error(NULL)` then gives the reason.
///
/// # Safety
/// The string arguments must be NULL or valid NUL terminated strings.
#[no_mangle]
pub unsafe extern "C" fn cp_new(
    content_json: *const c_char,
    level_json: *const c_char,
    seed: u64,
) -> *mut CpGame {
    let made = catch_unwind(AssertUnwindSafe(|| -> Result<Game, String> {
        let content = read_str(content_json).map_err(|e| format!("content_json: {e}"))?;
        let level = read_str(level_json).map_err(|e| format!("level_json: {e}"))?;
        Game::new(content, level, seed)
    }));
    match made {
        Ok(Ok(game)) => {
            set_new_error(None);
            Box::into_raw(Box::new(CpGame {
                game,
                last_error: None,
                dead: None,
                #[cfg(debug_assertions)]
                owner: std::thread::current().id(),
            }))
        }
        Ok(Err(e)) => {
            set_new_error(Some(e));
            ptr::null_mut()
        }
        Err(p) => {
            set_new_error(Some(format!("panic: {}", panic_text(p.as_ref()))));
            ptr::null_mut()
        }
    }
}

/// Apply a command (JSON object or array of objects). Returns the JSON reply.
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`; `json` must be NULL or a NUL
/// terminated string.
#[no_mangle]
pub unsafe extern "C" fn cp_command(handle: *mut CpGame, json: *const c_char) -> *mut c_char {
    let Some(h) = handle.as_mut() else {
        return out(refusal("null_handle", "the handle is NULL"));
    };
    let text = match read_str(json) {
        Ok(t) => t,
        Err(e) => {
            let r = refusal("bad_json", &e);
            h.last_error = CString::new(r.clone()).ok();
            return out(r);
        }
    };
    out(guarded(h, |g| g.command(text)))
}

/// Advance the sim by whole 120 Hz ticks. Returns {"tick":..,"phase":..}.
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`.
#[no_mangle]
pub unsafe extern "C" fn cp_step(handle: *mut CpGame, ticks: i32) -> *mut c_char {
    let Some(h) = handle.as_mut() else {
        return out(refusal("null_handle", "the handle is NULL"));
    };
    out(guarded(h, |g| g.step(ticks)))
}

/// The frame snapshot as JSON. Drains events and dirty terrain chunks.
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`.
#[no_mangle]
pub unsafe extern "C" fn cp_snapshot(handle: *mut CpGame) -> *mut c_char {
    let Some(h) = handle.as_mut() else {
        return out(refusal("null_handle", "the handle is NULL"));
    };
    out(guarded(h, |g| g.snapshot()))
}

/// The last error text for `handle` (the last refusal reply, or the panic
/// text), or for `cp_new` when `handle` is NULL. Returns NULL when there is
/// none. Free with `cp_free_string`.
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`.
#[no_mangle]
pub unsafe extern "C" fn cp_last_error(handle: *mut CpGame) -> *mut c_char {
    let e = match handle.as_mut() {
        Some(h) => h.last_error.clone(),
        None => LAST_NEW_ERROR.with(|c| c.borrow().clone()),
    };
    e.map(|c| c.into_raw()).unwrap_or(ptr::null_mut())
}

/// Version info as JSON.
#[no_mangle]
pub extern "C" fn cp_version() -> *mut c_char {
    out(catch_unwind(castle_core::version_json).unwrap_or_else(|_| "{}".into()))
}

/// Daily Dust-up seed for a local date text such as "2026-11-22". Returns 0
/// for NULL or bad UTF-8.
///
/// # Safety
/// `date` must be NULL or a NUL terminated string.
#[no_mangle]
pub unsafe extern "C" fn cp_daily_seed(date: *const c_char) -> u64 {
    match read_str(date) {
        Ok(d) => catch_unwind(|| castle_core::daily_seed(d)).unwrap_or(0),
        Err(_) => 0,
    }
}

/// Golden replay hashes, one "<name> <hash>" line each.
#[no_mangle]
pub extern "C" fn cp_golden_hashes() -> *mut c_char {
    out(catch_unwind(castle_core::replay::golden_lines)
        .unwrap_or_else(|p| format!("error panic:{}\n", panic_text(p.as_ref()))))
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

/// Release a battle handle (also a dead one).
///
/// # Safety
/// `handle` must be NULL or come from `cp_new`, freed only once.
#[no_mangle]
pub unsafe extern "C" fn cp_free(handle: *mut CpGame) {
    if !handle.is_null() {
        let b = Box::from_raw(handle);
        // a battle left half changed by a panic is still plain memory
        let _ = catch_unwind(AssertUnwindSafe(move || drop(b)));
    }
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

    unsafe fn text(p: *mut c_char) -> String {
        assert!(!p.is_null());
        let s = CStr::from_ptr(p).to_str().unwrap().to_string();
        cp_free_string(p);
        s
    }

    #[test]
    fn round_trip() {
        unsafe {
            let level = CString::new(r#"{"level":"1-1"}"#).unwrap();
            let h = cp_new(ptr::null(), level.as_ptr(), 7);
            assert!(!h.is_null());
            let cmd = CString::new(r#"{"cmd":"aim","angle":450,"power":70}"#).unwrap();
            let s = text(cp_command(h, cmd.as_ptr()));
            assert!(s.contains("\"ok\":true"), "{s}");
            assert!(cp_last_error(h).is_null(), "no error yet");
            let _ = text(cp_step(h, 10));
            assert!(text(cp_snapshot(h)).contains("\"hud\""));
            cp_free(h);
        }
    }

    #[test]
    fn a_panic_comes_back_as_a_refusal_and_kills_the_handle() {
        unsafe {
            let level = CString::new(r#"{"level":"1-1"}"#).unwrap();
            let h = cp_new(ptr::null(), level.as_ptr(), 7);
            let r = guarded(&mut *h, |_| panic!("boom in the sim"));
            assert!(
                r.contains("\"reason\":\"panic\"") && r.contains("boom"),
                "{r}"
            );
            let e = text(cp_last_error(h));
            assert!(e.contains("panic: boom"), "{e}");
            // every later call refuses, and touches nothing
            let cmd = CString::new(r#"{"cmd":"pass"}"#).unwrap();
            assert!(text(cp_command(h, cmd.as_ptr())).contains("dead_handle"));
            assert!(text(cp_step(h, 5)).contains("dead_handle"));
            assert!(text(cp_snapshot(h)).contains("dead_handle"));
            cp_free(h);
        }
    }

    #[test]
    fn errors_are_reported() {
        unsafe {
            // a bad setup: NULL handle, the reason from cp_last_error(NULL)
            let bad = CString::new(r#"{"level":"no-such"}"#).unwrap();
            assert!(cp_new(ptr::null(), bad.as_ptr(), 1).is_null());
            assert!(text(cp_last_error(ptr::null_mut())).contains("no-such"));
            // a good one clears it
            let level = CString::new(r#"{"level":"1-1"}"#).unwrap();
            let h = cp_new(ptr::null(), level.as_ptr(), 1);
            assert!(cp_last_error(ptr::null_mut()).is_null());
            // bad UTF-8 is an error, not the built in content
            let raw: [u8; 3] = [0xff, 0xfe, 0];
            assert!(cp_new(raw.as_ptr() as *const c_char, level.as_ptr(), 1).is_null());
            assert!(text(cp_last_error(ptr::null_mut())).contains("UTF-8"));
            // "{}" is not the built in content either
            let empty = CString::new("{}").unwrap();
            assert!(cp_new(empty.as_ptr(), level.as_ptr(), 1).is_null());
            // a refusal is kept for cp_last_error
            let cmd = CString::new(r#"{"cmd":"aim","angle":452.7}"#).unwrap();
            let r = text(cp_command(h, cmd.as_ptr()));
            assert!(r.contains("bad_value"), "{r}");
            assert!(text(cp_last_error(h)).contains("bad_value"));
            assert!(text(cp_command(h, raw.as_ptr() as *const c_char)).contains("bad_json"));
            // NULL handles
            assert!(text(cp_command(ptr::null_mut(), cmd.as_ptr())).contains("null_handle"));
            assert!(text(cp_step(ptr::null_mut(), 1)).contains("null_handle"));
            assert!(text(cp_snapshot(ptr::null_mut())).contains("null_handle"));
            cp_free(ptr::null_mut());
            cp_free_string(ptr::null_mut());
            assert_eq!(cp_daily_seed(raw.as_ptr() as *const c_char), 0);
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

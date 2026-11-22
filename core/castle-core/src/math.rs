//! Fixed point maths for the rules. Q16.16 in i32, products through i64.
//! Integer trig from a checked in table, integer square root.

pub type Fx = i32;
pub const FX_SHIFT: u32 = 16;
pub const FX_ONE: Fx = 1 << FX_SHIFT;

/// Cells per tick per tick for 1 cell/s^2 at 120 Hz, in Q16.16 is 65536 / 14400.
pub const TICKS_PER_SEC: i64 = 120;

#[inline]
pub fn fx(cells: i32) -> Fx {
    cells << FX_SHIFT
}

/// Floor of a Q16.16 value to whole cells.
#[inline]
pub fn cell(v: Fx) -> i32 {
    v >> FX_SHIFT
}

#[inline]
pub fn fx_mul(a: Fx, b: Fx) -> Fx {
    ((a as i64 * b as i64) >> FX_SHIFT) as i32
}

/// Scale by a whole percent (100 = unchanged). Rounds toward minus infinity.
#[inline]
pub fn pct(v: Fx, p: i32) -> Fx {
    (v as i64 * p as i64).div_euclid(100) as i32
}

/// Acceleration in cells/s^2 to Q16.16 cells/tick^2, rounded to nearest.
pub fn accel_q(cells_per_s2: i64) -> Fx {
    let num = cells_per_s2 * (FX_ONE as i64);
    let den = TICKS_PER_SEC * TICKS_PER_SEC;
    let r = if num >= 0 { (num + den / 2) / den } else { -((-num + den / 2) / den) };
    r as i32
}

use crate::trig_table::SIN_Q16;

/// sin of an angle in tenths of a degree, any integer, Q16.16 result.
pub fn sin_t(tenths: i32) -> Fx {
    let a = tenths.rem_euclid(3600);
    match a {
        0..=900 => SIN_Q16[a as usize],
        901..=1800 => SIN_Q16[(1800 - a) as usize],
        1801..=2700 => -SIN_Q16[(a - 1800) as usize],
        _ => -SIN_Q16[(3600 - a) as usize],
    }
}

pub fn cos_t(tenths: i32) -> Fx {
    sin_t(tenths + 900)
}

/// Rotate a Q16.16 vector by an angle in tenths of a degree (counter clockwise
/// in a y up frame; our y points down, so positive turns clockwise on screen).
pub fn rotate(vx: Fx, vy: Fx, tenths: i32) -> (Fx, Fx) {
    let c = cos_t(tenths) as i64;
    let s = sin_t(tenths) as i64;
    let x = vx as i64;
    let y = vy as i64;
    (((x * c - y * s) >> FX_SHIFT) as i32, ((x * s + y * c) >> FX_SHIFT) as i32)
}

/// Integer square root (floor) by Newton steps.
pub fn isqrt(n: u64) -> u64 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Length of a Q16.16 vector, Q16.16.
pub fn len_fx(vx: Fx, vy: Fx) -> Fx {
    let s = (vx as i64 * vx as i64 + vy as i64 * vy as i64) as u64;
    isqrt(s) as i32
}

/// Integer division rounding half away from zero.
pub fn div_round(num: i64, den: i64) -> i64 {
    if den == 0 {
        return 0;
    }
    let (n, d) = if den < 0 { (-num, -den) } else { (num, den) };
    if n >= 0 {
        (n + d / 2) / d
    } else {
        -((-n + d / 2) / d)
    }
}

/// Angle of a vector in tenths of a degree, 0..3600, y up frame. Integer
/// search over the table, good to a tenth of a degree.
pub fn atan2_t(y: i64, x: i64) -> i32 {
    if x == 0 && y == 0 {
        return 0;
    }
    // Find the quadrant angle with a binary search on tan via cross products.
    let ax = x.abs();
    let ay = y.abs();
    let (mut lo, mut hi) = (0i32, 900i32);
    while lo < hi {
        let mid = (lo + hi) / 2;
        // compare angle(mid) with atan(ay/ax): sin(mid)*ax vs cos(mid)*ay
        let s = SIN_Q16[mid as usize] as i64;
        let c = SIN_Q16[(900 - mid) as usize] as i64;
        if s * ax < c * ay {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    let q = lo;
    match (x >= 0, y >= 0) {
        (true, true) => q,
        (false, true) => 1800 - q,
        (false, false) => 1800 + q,
        (true, false) => (3600 - q) % 3600,
    }
}

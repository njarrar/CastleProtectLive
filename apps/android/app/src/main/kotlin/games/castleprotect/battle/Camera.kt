package games.castleprotect.battle

import kotlin.math.max
import kotlin.math.min

/**
 * Camera limits, kept apart from the view so they can be unit tested (review C2).
 * The framing itself (which fort, how much margin) is presentation; core/API.md
 * gives no camera fields, so it stays in the app until the core sends one.
 */
object Camera {
    /** Smallest and largest lens scale in px per cell, given the density. */
    fun minScale(dp: Float) = 0.08f * dp
    fun maxScale(dp: Float) = 6f * dp

    /** A finite scale inside the limits; NaN, zero and negative values come out as the minimum. */
    fun clampScale(s: Float, dp: Float): Float {
        if (s.isNaN() || s <= 0f) return minScale(dp)
        return s.coerceIn(minScale(dp), maxScale(dp))
    }

    /** Pinch zoom factor limits. */
    fun clampZoom(z: Float) = if (z.isNaN()) 1f else z.coerceIn(0.6f, 2.1f)

    /** Keeps a lens centre inside the world (with a margin of [slack] cells past each edge). */
    fun clampCenter(c: Float, worldSize: Int, slack: Float = 0f): Float {
        if (c.isNaN()) return worldSize / 2f
        return c.coerceIn(-slack, worldSize + slack)
    }

    /** A pan offset can never push the centre more than one world away. */
    fun clampPan(p: Float, worldSize: Int): Float = if (p.isNaN()) 0f else p.coerceIn(-worldSize.toFloat(), worldSize.toFloat())

    /**
     * Wide layout scale: both forts across the clear width, and a shell high above
     * the lower fort still in view. The divisor is floored so a shell below the forts
     * (y grows down) can never give a negative scale.
     */
    fun wideScale(clearW: Float, clearH: Float, span: Float, shellAbove: Float?, dp: Float): Float {
        var s = clearW / max(1f, span + 240f)
        if (shellAbove != null) s = min(s, clearH / max(110f, shellAbove + 110f))
        return clampScale(s, dp)
    }

    /** A castle block is 16 cells. In the Wide (landscape) layout a block is never drawn under 8 dp. */
    fun minBlockScale(dp: Float) = 8f * dp / 16f

    /**
     * The scale and centre that fit a world box [x0, y0, x1, y1] (plus [margin] cells on
     * each side) into a clear rect of [w] x [h] px, never below [floor] px per cell and
     * never above [ceil]. Writes cx, cy, scale into [out].
     */
    fun fit(x0: Float, y0: Float, x1: Float, y1: Float, w: Float, h: Float, margin: Float, floor: Float, ceil: Float, out: FloatArray) {
        val bw = max(1f, x1 - x0 + 2 * margin); val bh = max(1f, y1 - y0 + 2 * margin)
        var s = min(max(1f, w) / bw, max(1f, h) / bh)
        if (s.isNaN()) s = floor
        s = s.coerceIn(floor, max(floor, ceil))
        out[0] = (x0 + x1) / 2f; out[1] = (y0 + y1) / 2f; out[2] = s
    }

    /**
     * Shell follow with a dead zone: the centre moves only when the point leaves the
     * middle [zone] share of the view ([halfW], [halfH] are half the view in cells).
     * Returns the new centre on one axis.
     */
    fun follow(center: Float, point: Float, half: Float, zone: Float = 0.3f): Float {
        val dz = half * zone
        return when {
            point > center + dz -> point - dz
            point < center - dz -> point + dz
            else -> center
        }
    }

    /**
     * The fort of [side], found by its side field and then by place, or null. Camera,
     * hint and overlay code must never index the list directly: a missing fort falls back
     * (to the other fort, then to the whole map) and never crashes.
     */
    fun <T : games.castleprotect.core.Castle> fortOrNull(castles: List<T>, side: Int): T? {
        for (i in castles.indices) if (castles[i].side == side) return castles[i]
        return castles.getOrNull(side)
    }

    /** Index range [i0, i1] of samples inside a visible world range, clamped to 0..n-1. Empty when i0 > i1. */
    fun visibleRange(worldLeft: Float, worldRight: Float, step: Float, n: Int): IntArray {
        if (n <= 0 || step <= 0f || worldLeft.isNaN() || worldRight.isNaN()) return intArrayOf(0, -1)
        val lo = min(worldLeft, worldRight); val hi = max(worldLeft, worldRight)
        val i0 = ((lo / step).toInt() - 1).coerceIn(0, n - 1)
        val i1 = ((hi / step).toInt() + 2).coerceIn(0, n - 1)
        if (hi < 0f || lo > (n - 1) * step) return intArrayOf(0, -1)
        return intArrayOf(i0, i1)
    }
}

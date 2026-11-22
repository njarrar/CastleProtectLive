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

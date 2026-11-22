package games.castleprotect.game

import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * View time and screen shake (docs/design/07 section 6). View only: it never touches a
 * game rule. The sim stays fixed step; hit stop and slow motion only change how fast
 * the app feeds it ticks and how fast animations run, so replays and saves do not care.
 *
 * Written from the sim thread (events), the render thread (collapse beats, shake) and
 * the main thread (2x). Every write takes one lock (review 2 N-L19). The clock is
 * passed in ([now], uptime ms) so the rules can be unit tested.
 */
class Juice(private val reduceMotion: () -> Boolean = { false }, private val shakeScale: () -> Float = { 1f }) {
    @Volatile private var stopUntil = 0L
    private var lastStopAt = -10_000L
    @Volatile private var slowUntil = 0L
    @Volatile private var slowScale = 1f
    /** Slow motion time added this turn, in ms (cap 1500). */
    private var addedMs = 0f
    private var slowThisShot = false
    /** 2x tapped during this Resolve: no more slow motion this turn. */
    @Volatile private var noSlow = false

    @Volatile var trauma = 0f
        private set
    private var decayPerMs = 0f
    @Volatile private var kickX = 0f
    @Volatile private var kickY = 0f
    @Volatile private var verticalOnly = false
    private var shakeT = 0f
    /** Rim flash in place of shake when shake is at 0% (0 to 1). */
    @Volatile var flash = 0f
        private set

    /** View speed now: 0 in a hit stop, below 1 in slow motion, else 1. */
    fun scale(now: Long): Float = when {
        now < stopUntil -> 0f
        now < slowUntil -> slowScale
        else -> 1f
    }

    val calm: Boolean get() = trauma <= 0f && flash <= 0f

    /**
     * A new turn: the slow motion budget and the 2x cancel reset; shake stops (no shake in
     * Plan); a slow motion or hit stop from the last shot ends here and never runs into
     * the new turn (review 2 N-M12).
     */
    @Synchronized fun newTurn() { addedMs = 0f; noSlow = false; slowThisShot = false; trauma = 0f; flash = 0f; slowUntil = 0L; stopUntil = 0L }

    /** A new shot leaves: one slow motion per shot. */
    @Synchronized fun newShot() { slowThisShot = false }

    /**
     * Freezes the view for [ms]. At most one per 250 ms; halved at 2x Resolve speed;
     * capped at 50 ms with Reduce motion (hit stops are stillness, so they stay).
     */
    @Synchronized fun hitStop(ms: Int, now: Long, fast: Boolean) {
        if (now - lastStopAt < 250) return
        var d = ms
        if (fast) d /= 2
        if (reduceMotion()) d = min(d, 50)
        if (d <= 0) return
        lastStopAt = now
        stopUntil = max(stopUntil, now + d)
    }

    /**
     * Slow motion at [speed] for [ms] of real time. One per shot and 1.5 s of added
     * time per turn, except one that ends the battle, which always plays. With Reduce
     * motion a 150 ms hold plays instead. Returns true when it plays.
     */
    @Synchronized fun slowMo(speed: Float, ms: Int, now: Long, endsBattle: Boolean = false): Boolean {
        if (reduceMotion()) { stopUntil = max(stopUntil, now + 150); return false }
        if (!endsBattle && (noSlow || slowThisShot)) return false
        val added = ms * (1f - speed)
        if (!endsBattle && addedMs + added > 1500f) return false
        addedMs += added
        slowThisShot = true
        slowScale = speed.coerceIn(0.1f, 1f)
        slowUntil = max(slowUntil, max(now, stopUntil) + ms)
        return true
    }

    /** 2x tapped during Resolve: slow motion ends now and does not come back this turn. */
    @Synchronized fun cancelSlow() { noSlow = true; slowUntil = 0L }

    /**
     * Adds trauma (0 to 1) that decays to 0 over [decayMs]. [dx], [dy]: direction from the
     * blast to the screen centre, for the first kick. [scale]: distance falloff (1 within a
     * screen width, 0 beyond two).
     */
    @Synchronized fun addTrauma(amount: Float, decayMs: Int, dx: Float = 0f, dy: Float = 1f, upDown: Boolean = false, scale: Float = 1f) {
        val k = shakeScale()
        val a = amount * scale.coerceIn(0f, 1f)
        if (a <= 0f) return
        if (k <= 0f) { flash = max(flash, min(1f, a + 0.3f)); return }
        trauma = min(1f, trauma + a * k)
        decayPerMs = max(decayPerMs, trauma / max(1, decayMs))
        val len = sqrt(dx * dx + dy * dy)
        if (len > 0f) { kickX = dx / len; kickY = dy / len }
        verticalOnly = upDown
        shakeT = 0f
    }

    /**
     * Advances the shake by [dtMs] of real time and writes the offset into [out]:
     * x and y as a share of the cap (-1 to 1, times trauma squared) and roll in degrees.
     * [aiming]: the Plan step, where there is never any shake.
     */
    @Synchronized fun shake(dtMs: Float, aiming: Boolean, out: FloatArray) {
        if (aiming) { trauma = 0f; flash = 0f; out[0] = 0f; out[1] = 0f; out[2] = 0f; return }
        flash = max(0f, flash - dtMs / 200f)
        if (trauma <= 0f) { out[0] = 0f; out[1] = 0f; out[2] = 0f; return }
        val t2 = trauma * trauma
        shakeT += dtMs
        val firstKick = shakeT < 40f
        // First kick away from the blast; after that smooth noise near 30 Hz.
        val s = shakeT / 1000f * 2f * Math.PI.toFloat() * 30f
        val nx = if (firstKick) kickX else (sin(s) * 0.6f + sin(s * 0.53f + 1.7f) * 0.4f)
        val ny = if (firstKick) kickY else (sin(s * 1.13f + 0.6f) * 0.6f + sin(s * 0.71f + 2.9f) * 0.4f)
        out[0] = if (verticalOnly) 0f else nx * t2
        out[1] = ny * t2
        out[2] = if (verticalOnly) 0f else sin(s * 0.87f + 0.3f) * t2
        trauma = max(0f, trauma - decayPerMs * dtMs)
        if (trauma == 0f) decayPerMs = 0f
    }

    companion object {
        /** Shake cap: 12 logical px of offset and 1 degree of roll at trauma 1. */
        const val CAP_DP = 12f
        const val ROLL_DEG = 1f

        /** Blast band from an explode radius in cells (castle-core content.rs Band::radius). */
        fun band(r: Int): String = when {
            r <= 0 -> "point"
            r <= 10 -> "tiny"
            r <= 18 -> "small"
            r <= 28 -> "medium"
            r <= 42 -> "large"
            else -> "huge"
        }

        /** Trauma and decay for a blast band (07 section 6.2). */
        fun blastTrauma(band: String): Pair<Float, Int> = when (band) {
            "tiny", "point" -> 0.10f to 150
            "small" -> 0.20f to 200
            "medium" -> 0.35f to 250
            "large" -> 0.55f to 350
            else -> 0.80f to 450
        }
    }
}

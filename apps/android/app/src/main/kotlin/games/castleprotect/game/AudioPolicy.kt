package games.castleprotect.game

import android.media.AudioManager

/**
 * Audio focus as the game uses it (review 2 N-H1). Pure, so it is unit tested.
 *
 * - A granted request restores sound at once: the system sends no GAIN callback for a
 *   request it grants, so waiting for one would leave the game silent for good.
 * - A full loss (another app plays music) stops only the music. Effects are short and
 *   use USAGE_GAME, so they keep playing. A transient loss (a call, a navigation
 *   prompt) mutes both until the gain comes back.
 * - After a full loss the game does not take focus back on its own. It asks again only
 *   on a player action: a new screen, Resume, or a return to the app.
 */
class FocusState {
    var held = false
        private set
    /** Music gain from focus: 1 normal, 0.3 ducked, 0 lost. */
    var music = 1f
        private set
    /** Effects gain from focus: 0 only during a transient loss. */
    var effects = 1f
        private set
    /** True after a full loss, until the player acts. */
    var lost = false
        private set

    fun onChange(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> { held = false; lost = true; music = 0f; effects = 1f }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> { music = 0f; effects = 0f }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> { music = 0.3f; effects = 1f }
            AudioManager.AUDIOFOCUS_GAIN -> { held = true; lost = false; music = 1f; effects = 1f }
        }
    }

    /** The answer to a focus request. */
    fun onRequest(result: Int) {
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { held = true; lost = false; music = 1f; effects = 1f }
    }

    fun onAbandon() { held = false }

    /** Whether to ask for focus now. [wanted]: music is playing and audible. [playerAction]: a tap that may take focus back. */
    fun shouldRequest(wanted: Boolean, playerAction: Boolean): Boolean = wanted && !held && (playerAction || !lost)
}

/**
 * The sound lock: no sound until the first tap anywhere on a first launch (review 2
 * N-H2). Once open it stays open on every later launch ([persist] writes that down).
 */
class SoundGate(open: Boolean, private val persist: () -> Unit) {
    @Volatile var open = open
        private set

    /** A tap anywhere. Returns true only for the tap that opened the gate. */
    fun tap(): Boolean {
        if (open) return false
        open = true
        persist()
        return true
    }
}

/** Small sound rules, apart from the Android players so they can be tested. */
object AudioRules {
    /**
     * SoundPool priority by bus, from docs/design/07 section 9.5: when voices run out,
     * UI goes first, then flight, then material hits, then voice. Blasts, Bonks and the
     * kettle are never stolen. World loops do not use the pool at all (see [Audio]).
     */
    fun priority(bus: String, id: String): Int = when {
        bus == "kettle" || id.startsWith("hit_blast") || id == "hob_bonk" -> 6
        bus == "voice" || bus == "hob" -> 5
        bus == "material" || bus == "impact" -> 4
        bus == "world" -> 3
        bus == "flight" || bus == "launch" -> 2
        else -> 1 // ui
    }

    /** Music needs focus only when it can be heard (no focus grab with Music at 0 or Mute all on, review 2 N-M15). */
    fun wantsFocus(muteAll: Boolean, music: Int): Boolean = !muteAll && music > 0

    /**
     * The frames of a decoded sound to keep: [want] frames (the manifest's `samples`),
     * starting after the encoder delay. [delay] is the stream's own value when it has one;
     * an AAC stream without one is taken to have the usual 2112 frames of priming. This
     * removes the gap and tick AAC loops have on Android 8 and 9 (review 2 N-M7).
     * Returns start and count.
     */
    fun window(decoded: Int, want: Int, delay: Int?, aac: Boolean): IntArray {
        if (want <= 0 || decoded <= 0) return intArrayOf(0, decoded.coerceAtLeast(0))
        val extra = (decoded - want).coerceAtLeast(0)
        val skip = (delay ?: if (aac) 2112 else 0).coerceIn(0, extra)
        return intArrayOf(skip, minOf(want, decoded - skip))
    }
}

/**
 * The three music layers mixed into one stereo stream (review 2 N-M7): every layer is
 * read at the same sample, so they can never drift and nothing is ever re-seeked, and
 * each loops by sample count with no gap. A layer fades in or out over a given number
 * of frames from a given frame. Pure: the music thread feeds the output to an AudioTrack.
 */
class LayerMix(private val layers: List<Layer>) {
    /** One decoded layer: 16 bit PCM, 1 or 2 channels, [frames] long. */
    class Layer(val pcm: ShortArray, val channels: Int, val offset: Int = 0, val count: Int = pcm.size) {
        val frames: Int = if (channels > 0) count / channels else 0
        var gain = 0f
        internal var from = 0f
        internal var to = 0f
        internal var fadeAt = 0L
        internal var fadeLen = 1L
    }

    /** Loop length: the shortest layer, so every layer loops on the same frame. */
    val loopFrames: Int = layers.minOfOrNull { it.frames } ?: 0
    /** Frames played since the start (not wrapped). */
    var played = 0L
        private set
    val position: Int get() = if (loopFrames > 0) (played % loopFrames).toInt() else 0

    /** Fades layer [i] to [target] over [len] frames, starting at frame [at] (as counted by [played]). */
    fun fade(i: Int, target: Float, at: Long, len: Long) {
        val l = layers.getOrNull(i) ?: return
        l.from = l.gain; l.to = target; l.fadeAt = at; l.fadeLen = len.coerceAtLeast(1)
    }

    /** Sets layer [i] at once. */
    fun set(i: Int, gain: Float) { layers.getOrNull(i)?.let { it.gain = gain; it.from = gain; it.to = gain; it.fadeAt = 0; it.fadeLen = 1 } }

    fun target(i: Int): Float = layers.getOrNull(i)?.to ?: 0f

    /** Writes [frames] stereo frames into [out] (interleaved), each layer times its gain, times [master]. */
    fun mix(out: ShortArray, frames: Int, master: Float) {
        if (loopFrames <= 0) { out.fill(0, 0, frames * 2); return }
        for (f in 0 until frames) {
            val now = played + f
            val p = ((now) % loopFrames).toInt()
            var l = 0f; var r = 0f
            for (li in layers.indices) {
                val ly = layers[li]
                if (now >= ly.fadeAt) {
                    val u = ((now - ly.fadeAt).toFloat() / ly.fadeLen).coerceIn(0f, 1f)
                    ly.gain = ly.from + (ly.to - ly.from) * u
                }
                if (ly.gain <= 0f) continue
                if (ly.channels == 1) { val v = ly.pcm[ly.offset + p] * ly.gain; l += v; r += v }
                else { l += ly.pcm[ly.offset + p * 2] * ly.gain; r += ly.pcm[ly.offset + p * 2 + 1] * ly.gain }
            }
            out[f * 2] = (l * master).toInt().coerceIn(-32768, 32767).toShort()
            out[f * 2 + 1] = (r * master).toInt().coerceIn(-32768, 32767).toShort()
        }
        played += frames
    }

    /** The first bar line at or after now, in [played] frames, for a bar of [barFrames]. */
    fun nextBar(barFrames: Int): Long {
        if (barFrames <= 0) return played
        val pos = position.toLong()
        val wait = (barFrames - pos % barFrames) % barFrames
        return played + wait
    }
}

/**
 * Which loops the game wants and which are really playing (review 2 N-M14). A loop that
 * could not start (its sound not loaded yet) stays wanted and is started when it can.
 */
class LoopWants {
    class Want(var gain: Float, var semis: Float) { var playing = false }
    private val wants = HashMap<String, Want>()

    fun set(id: String, on: Boolean, gain: Float, semis: Float): Want? {
        if (!on) { wants.remove(id); return null }
        val w = wants.getOrPut(id) { Want(gain, semis) }
        w.gain = gain; w.semis = semis
        return w
    }

    fun started(id: String, ok: Boolean) { wants[id]?.playing = ok }
    fun pending(): List<String> = wants.filter { !it.value.playing }.keys.sorted()
    fun all(): Set<String> = wants.keys
    operator fun get(id: String): Want? = wants[id]
    fun clear() = wants.clear()
}

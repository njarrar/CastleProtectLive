package games.castleprotect.battle

import org.json.JSONArray
import org.json.JSONObject

/**
 * assets/animations.json: every animation the three apps play, with its real frame
 * order, times, loop rule, anchor and events, plus motion data with no frames
 * (fort bob, collapse beats, turn banner, hand-off card). See assets/README.md.
 */
class AnimDef(
    val name: String,
    val frames: Array<String>,
    val ms: IntArray,
    val loop: Boolean,
    val loopFrom: Int,
    val w: Float, val h: Float, val ax: Float, val ay: Float,
    /** Event names by frame index. */
    val events: Array<Array<String>>,
    val next: String?,
    val hold: String?,
    /** "power" for the aim pose set: not timed, frame by power. */
    val pick: String?,
) {
    val total: Int = ms.sum()
    /** Start time of each frame in ms. */
    val starts: IntArray = IntArray(ms.size).also { var t = 0; for (i in ms.indices) { it[i] = t; t += ms[i] } }

    /** Frame index at [t] ms from the start of this pass (t inside 0 until total). */
    fun frameAt(t: Float): Int {
        var i = 0
        while (i + 1 < starts.size && t >= starts[i + 1]) i++
        return i
    }
}

/** A key track: [time ms, value] pairs, straight lines between keys. */
class Track(private val keys: FloatArray) {
    val end: Float get() = if (keys.size >= 2) keys[keys.size - 2] else 0f
    fun at(t: Float): Float {
        if (keys.size < 2) return 0f
        if (t <= keys[0]) return keys[1]
        var i = 0
        while (i + 2 < keys.size) {
            val t0 = keys[i]; val t1 = keys[i + 2]
            if (t <= t1) { val u = if (t1 > t0) (t - t0) / (t1 - t0) else 1f; return keys[i + 1] + (keys[i + 3] - keys[i + 1]) * u }
            i += 2
        }
        return keys[keys.size - 1]
    }

    companion object {
        val ZERO = Track(floatArrayOf(0f, 0f))
        fun of(a: JSONArray?): Track {
            if (a == null) return ZERO
            val k = FloatArray(a.length() * 2)
            for (i in 0 until a.length()) { val p = a.optJSONArray(i) ?: continue; k[i * 2] = p.optDouble(0, 0.0).toFloat(); k[i * 2 + 1] = p.optDouble(1, 0.0).toFloat() }
            return Track(k)
        }
    }
}

/** Collapse beats by material (animations.json data.collapse), view only. */
class CollapseData(
    val creakMs: Int, val shiverX: Track, val wobble: Map<String, Track>,
    val leanMs: Int, val leanDeg: Map<String, Float>, val leanTrack: Track,
    val rowGapMs: Int, val sway: Map<String, Float>,
    val squash: Track, val skid: Map<String, Float>,
    val breakMs: Int, val chunks: Map<String, Int>, val rubbleHoldMs: Int, val dustScale: Map<String, Float>,
)

class Anims(val defs: Map<String, AnimDef>, val bobDy: FloatArray, val bobTilt: FloatArray, val bobFrameMs: Int, val collapse: CollapseData,
            val bannerIn: Track, val bannerInOpacity: Track, val bannerHoldMs: Int, val bannerOut: Track, val bannerOutOpacity: Track,
            val cardScale: Track) {
    operator fun get(name: String): AnimDef? = defs[name]

    companion object {
        val EMPTY: Anims = parse("{}")

        fun parse(text: String): Anims {
            val root = try { JSONObject(text) } catch (e: Exception) { JSONObject() }
            val out = HashMap<String, AnimDef>()
            val all = root.optJSONObject("animations") ?: JSONObject()
            for (name in all.keys()) {
                val a = all.optJSONObject(name) ?: continue
                val fr = a.optJSONArray("frames") ?: continue
                val frames = Array(fr.length()) { fr.optString(it) }
                if (frames.isEmpty()) continue
                val msA = a.optJSONArray("ms")
                val ms = IntArray(frames.size) { (msA?.optInt(it, 100) ?: 100).coerceAtLeast(1) }
                val an = a.optJSONArray("anchor")
                val evs = Array(frames.size) { ArrayList<String>() }
                a.optJSONObject("events")?.let { e -> for (k in e.keys()) { val i = e.optInt(k, -1); if (i in frames.indices) evs[i].add(k) } }
                out[name] = AnimDef(
                    name, frames, ms, a.optBoolean("loop", false), a.optInt("loop_from", 0).coerceIn(0, frames.size - 1),
                    a.optDouble("w", 16.0).toFloat(), a.optDouble("h", 16.0).toFloat(),
                    an?.optDouble(0, 0.0)?.toFloat() ?: 0f, an?.optDouble(1, 0.0)?.toFloat() ?: 0f,
                    Array(frames.size) { evs[it].toTypedArray() },
                    a.optString("next").ifEmpty { null }, a.optString("hold").ifEmpty { null }, a.optString("pick").ifEmpty { null },
                )
            }
            val data = root.optJSONObject("data") ?: JSONObject()
            val bob = data.optJSONObject("fort_bob") ?: JSONObject()
            fun floats(a: JSONArray?) = FloatArray(a?.length() ?: 0) { a!!.optDouble(it, 0.0).toFloat() }
            val c = data.optJSONObject("collapse") ?: JSONObject()
            fun mats(o: JSONObject?): Map<String, Float> { val m = HashMap<String, Float>(); o?.keys()?.forEach { k -> m[k] = o.optDouble(k, 0.0).toFloat() }; return m }
            val creak = c.optJSONObject("creak") ?: JSONObject()
            val wob = c.optJSONObject("wobble_deg") ?: JSONObject()
            val wobble = HashMap<String, Track>(); for (k in wob.keys()) wob.optJSONArray(k)?.let { wobble[k] = Track.of(it) }
            val lean = c.optJSONObject("lean") ?: JSONObject()
            val drop = c.optJSONObject("drop") ?: JSONObject()
            val land = c.optJSONObject("land") ?: JSONObject()
            val brk = c.optJSONObject("break") ?: JSONObject()
            val collapse = CollapseData(
                creak.optInt("ms", 300), Track.of(creak.optJSONArray("shiver_x")), wobble,
                lean.optInt("ms", 150), mats(lean.optJSONObject("deg")), Track.of(lean.optJSONArray("track")),
                drop.optInt("row_gap_ms", 40), mats(drop.optJSONObject("sway_deg")),
                Track.of(land.optJSONArray("squash_y")), mats(land.optJSONObject("skid_px")),
                brk.optInt("ms", 300), mats(brk.optJSONObject("chunks_per_block")).mapValues { it.value.toInt() },
                brk.optInt("rubble_hold_ms", 1500), mats(brk.optJSONObject("dust_scale")),
            )
            val banner = data.optJSONObject("turn_banner") ?: JSONObject()
            val bIn = banner.optJSONObject("in") ?: JSONObject(); val bOut = banner.optJSONObject("out") ?: JSONObject()
            val card = data.optJSONObject("hand_off_card")?.optJSONObject("in") ?: JSONObject()
            return Anims(
                out, floats(bob.optJSONArray("dy")), floats(bob.optJSONArray("tilt")), bob.optInt("frame_ms", 110), collapse,
                Track.of(bIn.optJSONArray("y")), Track.of(bIn.optJSONArray("opacity")), banner.optInt("hold_ms", 1200),
                Track.of(bOut.optJSONArray("y")), Track.of(bOut.optJSONArray("opacity")), Track.of(card.optJSONArray("scale")),
            )
        }
    }
}

/**
 * Plays one animation (assets/README.md "How to play one"): keeps view time, walks
 * the ms list, fires events when a frame first shows, loops from loop_from, then
 * starts next or shows hold. Not thread safe: the render thread owns it.
 */
class AnimClip(private val anims: Anims, start: AnimDef, private val backwards: Boolean = false) {
    var def: AnimDef = start
        private set
    var t = 0f
        private set
    /** Frame index in play order (already reversed when playing backwards). */
    var frame = -1
        private set
    var done = false
        private set
    /** Sprite to show after a play-once animation with no next has ended. */
    val holdName: String? get() = if (done) def.hold else null

    /** The sprite name to draw now. */
    val sprite: String get() = holdName ?: def.frames[if (frame < 0) idx(0) else frame]

    private fun idx(i: Int) = if (backwards) def.frames.size - 1 - i else i

    /** Shows one frame of a "pick" pose set (aim: 0, 1, 2 for low, mid, full power). */
    fun pick(i: Int) { frame = i.coerceIn(0, def.frames.size - 1); done = false }

    /** Advances by [dtMs] of view time. [onEvent] gets each event as its frame first shows. */
    fun advance(dtMs: Float, onEvent: ((String) -> Unit)? = null) {
        if (done || def.pick != null) { if (frame < 0) frame = 0; return }
        if (frame < 0) enter(0, onEvent)
        t += dtMs
        var guard = 0
        while (t >= def.total && guard++ < 8) {
            if (def.loop) {
                val loopStart = def.starts[def.loopFrom].toFloat()
                val loopLen = (def.total - loopStart).coerceAtLeast(1f)
                t = loopStart + (t - def.total) % loopLen
                val i = def.frameAt(t)
                if (idx(i) != frame) enter(i, onEvent)
                return
            }
            val nx = def.next?.let { anims[it] }
            if (nx != null) { t -= def.total; def = nx; frame = -1; enter(0, onEvent) } else { t = def.total.toFloat(); done = true; return }
        }
        val i = def.frameAt(t)
        if (idx(i) != frame) {
            // Fire events for every frame passed over, in order.
            val from = if (frame < 0) 0 else (if (backwards) def.frames.size - 1 - frame else frame) + 1
            for (k in from..i) enter(k, onEvent)
        }
    }

    private fun enter(i: Int, onEvent: ((String) -> Unit)?) {
        frame = idx(i)
        if (onEvent != null) for (e in def.events[i]) onEvent(e)
    }

    /** Starts [d] from its first frame. */
    fun play(d: AnimDef) { def = d; t = 0f; frame = -1; done = false }
}

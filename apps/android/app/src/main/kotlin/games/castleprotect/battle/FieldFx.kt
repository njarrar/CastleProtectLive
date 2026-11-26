package games.castleprotect.battle

import games.castleprotect.core.Text

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import games.castleprotect.core.Castle
import games.castleprotect.core.Frame
import games.castleprotect.core.GameEvent
import games.castleprotect.core.Ghost
import games.castleprotect.core.Hob
import games.castleprotect.core.Phase
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Pure-Kotlin 2D collision separation for simultaneous floating damage numbers and callouts
 * (Part 2 Plate 2: eliminates unreadable Round 10 Fatigue number stacks).
 */
object FloatLayout {
    /**
     * Finds a non-overlapping world position `[x, y]` near ([wx], [wy]) given [count] active
     * floating texts at ([xs], [ys]). Fans out vertically and horizontally so bursts stay legible.
     */
    fun place(
        wx: Float, wy: Float,
        xs: FloatArray, ys: FloatArray, count: Int,
        out: FloatArray,
        minDx: Float = 30f, minDy: Float = 20f,
    ) {
        var x = wx
        var y = wy
        var lateralStep = 0
        for (pass in 0 until 8) {
            var hit = false
            for (i in 0 until count) {
                if (abs(xs[i] - x) < minDx && abs(ys[i] - y) < minDy) {
                    hit = true
                    break
                }
            }
            if (!hit) break
            // Alternate gentle horizontal fan-out on even passes and vertical lift on odd passes.
            if (pass % 2 == 1) {
                lateralStep++
                val sign = if (lateralStep % 2 == 1) 1f else -1f
                x = wx + sign * ((lateralStep + 1) / 2) * (minDx * 0.72f)
            } else {
                y -= minDy
            }
        }
        out[0] = x
        out[1] = y
    }
}

/** Where sprites come from. [Sprites] in the app; a stand-in in unit tests. */
interface SpriteSource {
    /** Bumped when decoded bitmaps are dropped, so holders of resolved sprites look them up again. */
    val generation: Int
    fun get(name: String): Sprites.Sprite?
}

/**
 * Where each block of a core `collapse` event starts and lands (review 2 N-H3).
 *
 * The core lists the blocks at the cells they stood in before the fall (castle-core
 * effects.rs builds `blocks` before it removes the chunk), and `falls` is how far each
 * column drops, in cells. So a piece starts at its own cell and lands `fall` lower.
 */
object CollapsePlan {
    class Piece(val c: Int, val row: Int, val mat: String, val x: Float, val startY: Float, val fall: Float) {
        val landY: Float get() = startY + fall
    }

    fun of(e: GameEvent, castleX: Int, baseY: Int): List<Piece> {
        val out = ArrayList<Piece>(e.blocks.size / 3)
        var i = 0
        while (i + 2 < e.blocks.size) {
            val c = e.blocks[i]; val row = e.blocks[i + 1]
            val mat = if (e.blocks[i + 2] >= 0) GameEvent.matName(e.blocks[i + 2]) else "timber"
            out.add(Piece(c, row, mat, castleX + 16f * c, baseY - 16f * (row + 1), fallOf(e, c)))
            i += 3
        }
        return out
    }

    /** Cells column [c] falls, from the event's `falls` pairs (0 when absent). */
    fun fallOf(e: GameEvent, c: Int): Float {
        var j = 0
        while (j + 1 < e.falls.size) { if (e.falls[j] == c) return e.falls[j + 1].toFloat(); j += 2 }
        return 0f
    }
}

/**
 * Everything that moves on the field but is not a game rule: Hob poses, the Stomper
 * walk with its fort bob, the kettle pop, Loophole Flaps, the Pot Lid, shell trails,
 * impacts, the collapse choreography, rubble, dust, shimmer, Pin drops, wind leaves
 * and the Squall. All of it is driven by core events and by changes between frames,
 * and played from assets/animations.json. View only: the sim has already done it.
 *
 * Runs on the render thread. [cue] plays a sound that belongs to an animation frame
 * (assets/audio/README.md "Sounds that follow animations"); [beat] reports a view beat
 * (a collapse landing) so the session can add hit stop and shake.
 *
 * Frame cost (review 2 N-M8): [update] and [draw] allocate nothing on the common path.
 * Clip events go through one shared sink, sprites are resolved when a clip changes
 * frame and kept on the clip, flaps, lids and pins are kept in arrays by number, and
 * pose names are looked up once per Hob.
 */
class FieldFx(
    private val sprites: SpriteSource,
    private val dp: Float,
    private val cue: (anim: String, event: String, x: Float, shot: String?) -> Unit,
    private val beat: (kind: String, n: Int, x: Float, y: Float) -> Unit,
    private val reduceMotion: () -> Boolean,
    private val trailOf: (String) -> String,
) {
    var anims: Anims = Anims.EMPTY
        set(v) { if (v !== field) { field = v; clear() } }

    /** The shout for a big drop (`notes.big_drop`), drawn as a starburst. */
    private val dropWord: String by lazy { Text.t("notes.big_drop") }

    /** Mixed into each idle's start point, so two views of the same crew do not breathe alike. */
    private val seedSalt = System.nanoTime()

    /** One looping or one shot effect at a world point. [ambient]: leaves, never a reason to draw at full rate. */
    private class Fx(val clip: AnimClip, var x: Float, var y: Float, var vx: Float = 0f, var vy: Float = 0f, val g: Float = 0f,
                     val k: Float = 1f, var life: Float = 10_000f, val fadeMs: Float = 0f, var rot: Float = 0f, val spin: Float = 0f,
                     val sound: Boolean = true, val ambient: Boolean = false) {
        var age = 0f
    }

    private class HobPose(val id: Int, val prefix: String) {
        var clip: AnimClip? = null
        var pose = "idle"
        /** The def this pose started with; the clip has moved on (next) when it is no longer this. */
        var poseDef: AnimDef? = null
        var shot: String? = null
        /** A cheer that repeats plays without its sounds (review 2 N-L1). */
        var silent = false
        var seen = 0
        var blinkIn = 3000f
        var fallFrom = 0f; var fallTo = 0f; var fallMs = 0f; var fallT = -1f
        val defs = HashMap<String, Any>()
    }

    /** A block falling in a collapse: from [y] (its own cell) down [fall] cells. */
    private class Piece(val side: Int, val mat: String, val x: Float, val y: Float, val fall: Float, val delay: Float, val leanDir: Float, val first: Boolean, val count: Int) {
        var t = 0f
        var crack: AnimClip? = null
        var landed = false
        var broken = false
        var sp: Sprites.Sprite? = null
        var spGen = -1
    }

    private class Walk(val side: Int, val dx: Float, val ms: Float) { var t = 0f }
    private class Rubble(val sprite: String, val x: Float, val y: Float) { var age = 0f; var sp: Sprites.Sprite? = null; var spGen = -1 }
    private class PinDrop(val key: Long, val clip: AnimClip)
    /** Pooled floating damage number or field callout ("Drop!", "Threaded") (Android-M12). */
    private class FloatText {
        var active = false
        var x = 0f; var y = 0f; var vy = 0f
        var age = 0f; var life = 950f
        var text = ""; var color = 0; var callout = false
    }

    private val fx = ArrayList<Fx>()
    private val hobs = ArrayList<HobPose>()
    private val pieces = ArrayList<Piece>()
    private val rubble = ArrayList<Rubble>()
    private val floats = Array(MAX_FLOATS) { FloatText() }
    private val walks = arrayOfNulls<Walk>(2)
    private val legs = arrayOfNulls<AnimClip>(4)
    private val kettle = arrayOfNulls<AnimClip>(2)
    /** By side * [ROOMS] + room id. */
    private val flaps = arrayOfNulls<AnimClip>(2 * ROOMS)
    private val lids = arrayOfNulls<AnimClip>(2 * ROOMS)
    private val kettleLids = arrayOfNulls<AnimClip>(2)
    private val pins = ArrayList<PinDrop>()
    private var prev: Frame? = null
    private var shimmerT = 0f
    private var shimmerClip: AnimClip? = null
    private var leafT = 0f
    private var trailT = 0f
    private var squall: AnimClip? = null
    private var time = 0f
    private var frameNo = 0
    private val trailNames = HashMap<String, String>()
    private val paint by lazy(LazyThreadSafetyMode.NONE) { Paint(Paint.FILTER_BITMAP_FLAG) }
    private val line by lazy(LazyThreadSafetyMode.NONE) { Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE } }
    private val floatFill by lazy(LazyThreadSafetyMode.NONE) { Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = android.graphics.Typeface.DEFAULT_BOLD } }
    private val floatStroke by lazy(LazyThreadSafetyMode.NONE) { Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = 0xFF2C221E.toInt(); strokeJoin = Paint.Join.ROUND; textAlign = Paint.Align.CENTER; typeface = android.graphics.Typeface.DEFAULT_BOLD } }
    private val burstFill by lazy(LazyThreadSafetyMode.NONE) { Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = 0xFFFFE04A.toInt() } }
    private val burstStroke by lazy(LazyThreadSafetyMode.NONE) { Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = 0xFF2C221E.toInt(); strokeJoin = Paint.Join.ROUND } }
    private val burstPath by lazy(LazyThreadSafetyMode.NONE) { Path() }
    private val r by lazy(LazyThreadSafetyMode.NONE) { RectF() }
    private val tmpBox by lazy(LazyThreadSafetyMode.NONE) { RectF() }
    private val sepX = FloatArray(MAX_FLOATS)
    private val sepY = FloatArray(MAX_FLOATS)
    private val sepOut = FloatArray(2)

    /** The shared clip event sink: reads the clip's current name when an event fires. */
    private inner class Sink : ClipEvents {
        var clip: AnimClip? = null
        var name = ""
        var x = 0f
        var shot: String? = null
        override fun on(event: String) { cue(clip?.def?.name ?: name, event, x, shot) }
    }
    private val sink = Sink()
    private fun sink(clip: AnimClip?, name: String, x: Float, shot: String? = null): ClipEvents { sink.clip = clip; sink.name = name; sink.x = x; sink.shot = shot; return sink }

    /**
     * True while something that is not ambient moves: the field then draws at the display
     * rate. Wind leaves, shimmer and the Squall do not count (review 2 N-M2, M6): they run
     * at the idle rate.
     */
    /** True while collapse pieces are actively animating on screen (used for settle wait and shake gating). */
    val collapseShowing: Boolean get() = pieces.isNotEmpty()

    val busy: Boolean get() {
        for (i in fx.indices) if (!fx[i].ambient) return true
        if (pieces.isNotEmpty() || rubble.isNotEmpty()) return true
        for (fl in floats) if (fl.active) return true
        for (s in 0..1) { if (walks[s] != null) return true; val k = kettle[s]; if (k != null && !k.done) return true }
        for (a in flaps) if (a != null && !a.done) return true
        for (a in lids) if (a != null && !a.done) return true
        for (a in kettleLids) if (a != null && !a.done) return true
        return pins.isNotEmpty()
    }

    /** A new battle or a new view: nothing of the old one is kept (review 2 N-L4). */
    fun clear() {
        fx.clear(); hobs.clear(); pieces.clear(); rubble.clear(); walks.fill(null); legs.fill(null); kettle.fill(null)
        for (fl in floats) fl.active = false
        flaps.fill(null); lids.fill(null); kettleLids.fill(null); pins.clear(); prev = null
        flapState.clear(); lidState.clear(); pinKnown.clear(); lastStateFrame = null
        squall = null; shimmerClip = null; shimmerT = 0f; leafT = 0f; trailT = 0f
    }

    private fun spawnFloat(wx: Float, wy: Float, label: String, color: Int, callout: Boolean) {
        var nActive = 0
        for (fl in floats) if (fl.active) {
            sepX[nActive] = fl.x
            sepY[nActive] = fl.y
            nActive++
        }
        FloatLayout.place(
            wx, wy, sepX, sepY, nActive, sepOut,
            minDx = if (callout) 42f else 30f,
            minDy = if (callout) 26f else 20f,
        )
        var slot: FloatText? = null
        var oldest = floats[0]
        for (fl in floats) {
            if (!fl.active) { slot = fl; break }
            if (fl.age > oldest.age) oldest = fl
        }
        val t = slot ?: oldest
        t.active = true; t.x = sepOut[0]; t.y = sepOut[1]; t.vy = if (callout) -0.026f else -0.034f
        t.age = 0f; t.life = if (callout) 1300f else 950f
        t.text = label; t.color = color; t.callout = callout
    }

    private fun dmgText(dmg: Int): String = if (dmg in 1 until DMG_LABELS.size) DMG_LABELS[dmg] else "-$dmg"

    private fun def(name: String): AnimDef? = anims[name]
    private fun team(f: Frame, side: Int) = Sprites.team(side, f.hud.human(side))

    /** True when assets/animations.json has a clip by this name. */
    fun hasAnim(name: String): Boolean = anims[name] != null

    private fun spawn(name: String, x: Float, y: Float, k: Float = 1f, vx: Float = 0f, vy: Float = 0f, g: Float = 0f, life: Float = 10_000f,
                      fadeMs: Float = 0f, spin: Float = 0f, sound: Boolean = true, ambient: Boolean = false) {
        val d = def(name) ?: return
        if (fx.size >= MAX_FX) dropOne()
        val clip = AnimClip(anims, d)
        val f = Fx(clip, x, y, vx, vy, g, k, life, fadeMs, 0f, spin, sound, ambient)
        clip.advance(0f, if (sound) sink(clip, name, x) else null)
        if (sound) cue(name, "start", x, null)
        fx.add(f)
    }

    /** At the cap, an ambient effect (a leaf, a trail) goes first, so blasts and rubble stay (review 2 N-L17). */
    private fun dropOne() {
        for (i in fx.indices) if (fx[i].ambient) { fx.removeAt(i); return }
        fx.removeAt(0)
    }

    // ---- events -------------------------------------------------------------

    /** Reads one published frame's events, in order. */
    fun onFrame(f: Frame) {
        val p = prev
        val collapsed = HashSet<Long>()
        for (e in f.events) if (e.t == "collapse") {
            var i = 0
            while (i + 2 < e.blocks.size) { collapsed.add(key(e.side, e.blocks[i], e.blocks[i + 1])); i += 3 }
        }
        for (e in f.events) when (e.t) {
            "fire" -> pose(f, e.hob, "fire", e.shot)
            "explode" -> {
                val band = games.castleprotect.game.Juice.band(e.r)
                val boom = when (band) { "huge", "large" -> "large"; "medium" -> "medium"; else -> "small" }
                spawnBoom(boom, e.x.toFloat(), e.y.toFloat())
            }
            "carve" -> spawn("fx_impact_dirt", e.x.toFloat(), e.y.toFloat(), 1.4f, sound = false)
            "hit" -> when (e.target) {
                "block" -> blockAt(p ?: f, e.side, e.c, e.r)?.let { b ->
                    spawn("fx_impact_${b.third}", b.first + 8f, b.second + 8f, sound = false)
                    // 45 ms tactile hit-stop on heavy Cobble impacts.
                    if (b.third == "cobble" && e.dmg >= 20) beat("hit_stop", HIT_STOP_MS, b.first + 8f, b.second + 8f)
                    // Wall/block breaks: crisp cream (#FFF4DE) with espresso stroke (Part 2 Plate 2).
                    if (e.dmg > 0) spawnFloat(b.first + 8f, b.second, dmgText(e.dmg), 0xFFFFF4DE.toInt(), false)
                }
                "hob" -> if (e.dmg > 0) {
                    pose(f, e.hob, "hit")
                    // Hob hits: rich amber-gold (#FFC23D) with espresso stroke (Part 2 Plate 2) + 45 ms hit-stop.
                    f.hobs.firstOrNull { it.id == e.hob }?.let { h ->
                        if (e.dmg >= 15) beat("hit_stop", HIT_STOP_MS, h.x.toFloat(), h.y.toFloat())
                        spawnFloat(h.x.toFloat(), h.y - 26f, dmgText(e.dmg), 0xFFFFC23D.toInt(), false)
                    }
                }
                "kettle" -> f.castles.getOrNull(e.side)?.kettle?.let { k ->
                    if (k.box.size >= 4) {
                        val kx = (k.box[0] + k.box[2]) / 2f; val ky = (k.box[1] + k.box[3]) / 2f
                        spawn("fx_impact_footing", kx, ky, sound = false)
                        if (e.dmg > 0) {
                            beat("hit_stop", HIT_STOP_MS, kx, ky)
                            spawnFloat(kx, k.box[1] - 8f, dmgText(e.dmg), 0xFFFF5A5F.toInt(), false)
                        }
                    }
                }
                "prop" -> if (e.dmg > 0) spawnFloat(e.x.toFloat(), e.y - 10f, dmgText(e.dmg), 0xFFFFD23F.toInt(), false)
            }
            "big_drop" -> if (e.callout) {
                val k = f.castles.firstOrNull { it.side == e.side } ?: f.castles.firstOrNull { it.side == 1 - f.side } ?: f.castles.firstOrNull()
                if (k != null) spawnFloat(k.x + k.cols * 8f, k.topY - 26f, dropWord, 0xFFFFE04A.toInt(), true)
            }
            "threaded" -> {
                val h = f.hobs.firstOrNull { it.id == e.hob }
                if (h != null) spawnFloat(h.x.toFloat(), h.y - 34f, Text.t("notes.threaded"), 0xFF4FE3C1.toInt(), true)
                else f.castles.firstOrNull { it.side == e.side }?.let { k -> spawnFloat(k.x + k.cols * 8f, k.topY - 22f, Text.t("notes.threaded"), 0xFF4FE3C1.toInt(), true) }
            }
            "break" -> if (key(e.side, e.c, e.r) !in collapsed) blockAt(p ?: f, e.side, e.c, e.r)?.let { b -> breakBlock(b.third, b.first, b.second, 1) }
            "collapse" -> collapse(f, e)
            "drop" -> hobPose(e.hob)?.let { hp ->
                val d = hp.def(f, "tumble")
                if (d != null) { hp.clipFor(d).play(d); hp.pose = "tumble"; hp.poseDef = d }
                hp.fallFrom = e.fromY.toFloat(); hp.fallTo = e.toY.toFloat(); hp.fallT = 0f
                hp.fallMs = (sqrt(2f * max(1f, abs(e.toY - e.fromY).toFloat()) / FALL_G) + 150f)
            } ?: Unit
            "bonk" -> pose(f, e.hob, "bonked")
            "shove_off", "dug_out" -> pose(f, e.hob, "dig")
            "kettle_pop" -> if (e.side in 0..1) def("kettle_pop")?.let { d -> kettle[e.side] = AnimClip(anims, d) }
            // A relit kettle is whole again: drop the popped look (review 2 N-M5).
            "relight" -> if (e.side in 0..1) kettle[e.side] = null else kettle.fill(null)
            "walk" -> if (e.side in 0..1) {
                val dx = (e.fromX - e.toX).toFloat()
                if (dx != 0f) {
                    walks[e.side] = Walk(e.side, dx, max(330f, abs(dx) / 120f * 1000f))
                    def(WALK[e.side])?.let { d -> legs[e.side * 2] = AnimClip(anims, d); legs[e.side * 2 + 1] = AnimClip(anims, d).also { it.advance(3f * (d.ms.firstOrNull() ?: 110)) } }
                }
            }
            "win" -> for (h in f.hobs) if (h.side == e.winner && !h.bonked) pose(f, h.id, "cheer")
            "mend", "rebuild" -> {
                val k = f.castles.getOrNull(e.side)
                var i = 0
                if (k != null) {
                    if (e.blocks.size >= 2) spawnFloat(k.x + 16f * e.blocks[0] + 8f, k.baseY - 16f * (e.blocks[1] + 1) - 8f, Text.t(if (e.t == "rebuild") "notes.rebuild" else "notes.mend"), 0xFF8BD888.toInt(), false)
                    while (i + 1 < e.blocks.size) {
                        spawn("fx_fizz_pop", k.x + 16f * e.blocks[i] + 8f, k.baseY - 16f * (e.blocks[i + 1] + 1) + 4f)
                        i += 3
                    }
                }
            }
            "squall" -> beat("squall", 1, 0f, 0f)
        }
        notes(f)
        prev = f
    }

    /**
     * Small words by the action (`notes.<event>` in content/text.json). Only Bonk!, Thump!, Drop!,
     * Snip! and Kettle Pop! shout; the rest are small and quiet. An empty line shows nothing.
     * Drop and Threaded have their own callouts above.
     */
    private fun notes(f: Frame) {
        for (e in f.events) {
            if (e.t !in NOTE_EVENTS) continue
            val word = when (e.t) {
                "prop_break" -> Text.opt("notes.prop_break.${e.kind}") ?: Text.opt("notes.prop_break.default")
                "prop" -> Text.opt("notes.prop.${e.kind}")
                else -> Text.opt("notes.${e.t}")
            }?.takeIf { it.isNotEmpty() } ?: continue
            val h = if (e.hob >= 0) f.hobs.firstOrNull { it.id == e.hob } else null
            val k = f.castles.firstOrNull { it.side == e.side }
            val (x, y) = when {
                h != null -> h.x.toFloat() to h.y - 40f
                e.x != 0 || e.y != 0 -> e.x.toFloat() to e.y - 14f
                k != null -> k.x + k.cols * 8f to k.topY - 30f
                else -> continue
            }
            val shout = e.t in SHOUTS
            spawnFloat(x, y, word, if (shout) 0xFFFFE04A.toInt() else 0xFFF3EAD8.toInt(), shout)
        }
    }

    private fun key(side: Int, c: Int, r: Int): Long = (side.toLong() shl 40) or ((c + 1000).toLong() shl 20) or (r + 1000).toLong()

    /** World top left and material of a block in [f], or null. */
    private fun blockAt(f: Frame, side: Int, c: Int, r: Int): Triple<Float, Float, String>? {
        val k = f.castles.getOrNull(side) ?: f.castles.firstOrNull { it.side == side } ?: return null
        for (b in k.blocks) if (b.c == c && b.r == r) return Triple(b.x.toFloat(), b.y.toFloat(), b.mat)
        return Triple(k.x + 16f * c, k.baseY - 16f * (r + 1), "timber")
    }

    private fun hobPose(id: Int): HobPose? { for (i in hobs.indices) if (hobs[i].id == id) return hobs[i]; return null }

    private fun isFlattener(f: Frame, h: Hob): Boolean {
        if (h.dummy) return false
        if (h.def in FLATTENER_DEFS) return true
        return f.mode != "couch" && h.side == 1 && !f.hud.human(1) && !hasAnim("hob_${Sprites.hobKey(h.def)}_rival_idle")
    }

    private fun newPose(f: Frame, h: Hob): HobPose {
        val prefix = if (isFlattener(f, h)) {
            "flattener_${Sprites.flattenerKey(h.def, h.cls)}_"
        } else {
            "hob_${Sprites.hobKey(h.def)}_${team(f, h.side)}_"
        }
        return HobPose(h.id, prefix).also { hobs.add(it) }
    }

    /** The def for [pose] of this Hob, looked up once (no name is built per frame). */
    private fun HobPose.def(f: Frame?, pose: String): AnimDef? {
        val v = defs[pose]
        if (v != null) return v as? AnimDef
        val d = anims[prefix + pose]
        defs[pose] = d ?: NONE
        return d
    }

    private fun HobPose.clipFor(d: AnimDef): AnimClip = clip ?: AnimClip(anims, d).also { clip = it }

    private fun pose(f: Frame, id: Int, pose: String, shot: String? = null) {
        var h: Hob? = null
        for (x in f.hobs) if (x.id == id) { h = x; break }
        if (h == null) return
        val hp = hobPose(id) ?: newPose(f, h)
        val d = hp.def(f, pose) ?: return
        hp.clipFor(d).play(d); hp.pose = pose; hp.poseDef = d; hp.shot = shot; hp.silent = false
        if (pose == "bonked") cue(d.name, "start", h.x.toFloat(), null)
    }

    private fun spawnBoom(size: String, x: Float, y: Float) {
        // The boom frames are plain sprites (no entry in animations.json): play them as a 4 frame clip.
        val d = booms.getOrPut(size) {
            AnimDef("boom_$size", Array(4) { "fx_boom_${size}_$it" }, intArrayOf(50, 60, 70, 90), false, 0, 64f, 64f, 32f, 32f, Array(4) { emptyArray() }, null, null, null)
        }
        val k = when (size) { "large" -> 1.5f; "medium" -> 1.1f; else -> 0.8f }
        if (fx.size >= MAX_FX) dropOne()
        fx.add(Fx(AnimClip(anims, d), x, y, k = k, sound = false))
    }
    private val booms = HashMap<String, AnimDef>()

    /**
     * A block breaks where it stands: chunks fly, rubble plays once, then the broken block
     * holds 1.5 s and fades. The rubble clip lives only as long as its frames (review 2
     * N-M1); the [Rubble] object shows the hold.
     */
    private fun breakBlock(mat: String, x: Float, y: Float, n: Int) {
        val c = anims.collapse
        val chunks = if (n > 6) 1 else c.chunks[mat] ?: 3
        for (i in 0 until chunks) {
            val a = (i + 0.5f) / chunks
            spawn("fx_chunk_$mat", x + 16f * a, y + 6f, 1f, vx = (a - 0.5f) * 0.12f, vy = -0.10f - 0.04f * (i % 2), g = FALL_G, life = c.breakMs + 300f, fadeMs = 200f, spin = (a - 0.5f) * 0.8f, sound = i == 0)
        }
        val rub = "fx_rubble_$mat"
        spawn(rub, x + 2f, y + 13f, life = (def(rub)?.total ?: 0).toFloat())
        rubble.add(Rubble("block_${mat}_broken", x, y))
        if (rubble.size > 40) rubble.removeAt(0)
    }

    /** Collapse beats (06 section 6.3, animations.json data.collapse): creak, lean, drop row by row, land, break. */
    private fun collapse(f: Frame, e: GameEvent) {
        val k = f.castles.getOrNull(e.side) ?: f.castles.firstOrNull { it.side == e.side } ?: return
        val plan = CollapsePlan.of(e, k.x, k.baseY)
        val n = plan.size
        if (n == 0) return
        var minRow = Int.MAX_VALUE
        for (p in plan) minRow = min(minRow, p.row)
        val mid = k.x + k.cols * 8f
        var first = true
        for (cp in plan) {
            val p = Piece(e.side, cp.mat, cp.x, cp.startY, cp.fall, ((cp.row - minRow) * anims.collapse.rowGapMs).toFloat(), if (cp.x + 8f < mid) -1f else 1f, first, n)
            def("fx_crack_${cp.mat}")?.let { p.crack = AnimClip(anims, it) }
            pieces.add(p)
            first = false
        }
        cue("fx_crack_timber", "start", mid, null)
    }

    // ---- frame state changes (flaps, lids, pins) ---------------------------

    private fun states(f: Frame) {
        for (k in f.castles) {
            if (k.side !in 0..1) continue
            for (room in k.rooms) {
                val slot = slot(k.side, room.id)
                if (slot < 0) continue
                val was = flapState[slot]
                if (was != null && was != room.flap) def(FLAP[k.side])?.let { d ->
                    flaps[slot] = AnimClip(anims, d, backwards = !room.flap)
                    if (room.flap) cue(d.name, "start", k.x.toFloat(), null)
                }
                flapState[slot] = room.flap
                val lwas = lidState[slot]
                if (lwas != null && lwas != room.lid) def("pot_lid_raise")?.let { d -> lids[slot] = AnimClip(anims, d, backwards = !room.lid) }
                lidState[slot] = room.lid
            }
            val kk = k.kettle
            if (kk != null) {
                val slot = -1 - k.side
                val was = lidState[slot]
                if (was != null && was != kk.lid) def("pot_lid_raise")?.let { d -> kettleLids[k.side] = AnimClip(anims, d, backwards = !kk.lid) }
                lidState[slot] = kk.lid
            }
        }
        val seen = HashSet<Long>()
        for (g in f.ghosts) if (g.hasPin) {
            val key = pinKey(g)
            seen.add(key)
            if (key !in pinKnown) {
                pinKnown.add(key)
                if (prev != null) def(if (g.side == 0) "fx_pin_p1_drop" else "fx_pin_p2_drop")?.let { d -> pins.add(PinDrop(key, AnimClip(anims, d))) }
            }
        }
        pinKnown.retainAll(seen)
    }
    private val flapState = HashMap<Int, Boolean>()
    private val lidState = HashMap<Int, Boolean>()
    private val pinKnown = HashSet<Long>()
    private var lastStateFrame: Frame? = null

    private fun slot(side: Int, room: Int): Int = if (side in 0..1 && room in 0 until ROOMS) side * ROOMS + room else -1

    // ---- time ---------------------------------------------------------------

    /** Advances everything by [dt] ms of view time (already scaled by hit stop and slow motion). */
    fun update(f: Frame, dt: Float) {
        if (f !== lastStateFrame) {
            if (lastStateFrame == null || lastStateFrame?.fullSeq != f.fullSeq) states(f)
            lastStateFrame = f
        }
        time += dt
        frameNo++
        val still = reduceMotion()
        // Hobs
        val hs = f.hobs
        for (i in hs.indices) {
            val h = hs[i]
            val want = basePose(f, h)
            var hp = hobPose(h.id)
            if (hp == null || hp.clip == null) {
                val p = hp ?: newPose(f, h)
                p.seen = frameNo
                val d = p.def(f, want) ?: continue
                p.clip = AnimClip(anims, d); p.pose = want; p.poseDef = d
                // A pose that began before this view (an old Bonk) starts in its loop, with no sounds.
                if (want == "bonked") p.clip?.skipToLoop()
                // Idles start somewhere in their loop, so a crew never breathes in step (animations.json random_start, start_offset_ms).
                if (want == "idle") p.clip?.seek(AnimClip.idleStart(d, h.id * 7919L + h.side * 104729L + seedSalt))
                continue
            }
            hp.seen = frameNo
            val clip = hp.clip ?: continue
            val oneShot = hp.pose in ONE_SHOT && !clip.done && clip.def === hp.poseDef
            if (!oneShot && hp.pose != want && !(hp.pose == "tumble" && hp.fallT >= 0f)) {
                hp.def(f, want)?.let { clip.play(it); hp.pose = want; hp.poseDef = it; hp.silent = false }
            }
            if (hp.pose == "aim") clip.pick(if (h.power < 34) 0 else if (h.power < 67) 1 else 2)
            else if (!(still && hp.pose == "idle")) clip.advance(dt, if (hp.silent) null else sink(clip, "", h.x.toFloat(), hp.shot))
            // A play-once pose that ended goes back to the pose the core's state asks for. A winner keeps cheering, quietly.
            if (hp.pose in ONE_SHOT && clip.def !== hp.poseDef) {
                val pd = hp.poseDef
                if (hp.pose == "cheer" && want == "cheer" && pd != null) { clip.play(pd); hp.silent = true } else hp.pose = "idle"
            }
            if (hp.pose == "idle") {
                hp.blinkIn -= dt
                if (hp.blinkIn <= 0f) { hp.blinkIn = 3000f + (h.id * 677 % 2000); hp.def(f, "blink")?.let { clip.play(it) } }
            }
            if (hp.fallT >= 0f) {
                hp.fallT += dt
                if (hp.fallT >= hp.fallMs) { hp.fallT = -1f; hp.def(f, "land")?.let { clip.play(it); hp.pose = "land"; hp.poseDef = it } }
            }
        }
        var i = hobs.size - 1
        while (i >= 0) { if (hobs[i].seen != frameNo) hobs.removeAt(i); i-- }
        // Effects
        i = fx.size - 1
        while (i >= 0) {
            val e = fx[i]
            e.age += dt
            e.vy += e.g * dt
            e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spin * dt
            e.clip.advance(dt, if (e.sound) sink(e.clip, "", e.x) else null)
            if ((e.clip.done && e.clip.def.hold == null) || e.age > e.life) fx.removeAt(i)
            i--
        }
        // Collapse pieces
        val c = anims.collapse
        i = pieces.size - 1
        while (i >= 0) {
            val p = pieces[i]
            p.t += dt
            p.crack?.advance(dt)
            val dropAt = c.creakMs + c.leanMs + p.delay
            val fallMs = sqrt(2f * max(1f, p.fall) / FALL_G)
            if (!p.landed && p.t >= dropAt + fallMs) {
                p.landed = true
                if (p.first) { beat("collapse_land", p.count, p.x, p.y + p.fall); cue("collapse_land", "land", p.x, null) }
                spawn("fx_dustcloud", p.x + 8f, p.y + p.fall + 16f, (c.dustScale[p.mat] ?: 1f) * 0.7f, sound = p.first)
            }
            if (p.landed && !p.broken && p.t >= dropAt + fallMs + 200f) {
                p.broken = true
                breakBlock(p.mat, p.x, p.y + p.fall, p.count)
                pieces.removeAt(i)
            }
            i--
        }
        i = rubble.size - 1
        while (i >= 0) { val rb = rubble[i]; rb.age += dt; if (rb.age > c.rubbleHoldMs + 400f) rubble.removeAt(i); i-- }
        // Floating damage numbers and field callouts (Android-M12).
        for (fl in floats) {
            if (!fl.active) continue
            fl.age += dt
            if (!still) fl.y += fl.vy * dt
            if (fl.age >= fl.life) fl.active = false
        }
        // Walks
        for (s in 0..1) {
            val w = walks[s] ?: continue
            w.t += dt
            val k = f.castles.getOrNull(s)
            val wx = if (k != null) k.x + k.cols * 8f else 0f
            legs[s * 2]?.let { it.advance(dt, sink(it, WALK[s], wx)) }
            legs[s * 2 + 1]?.advance(dt)
            if (w.t >= w.ms + 120f) { walks[s] = null; legs[s * 2] = null; legs[s * 2 + 1] = null }
        }
        for (s in 0..1) {
            val kc = kettle[s] ?: continue
            val k = f.castles.getOrNull(s)
            kc.advance(dt, sink(kc, "kettle_pop", k?.x?.toFloat() ?: 0f))
            // Relit (or rebuilt from a save) while the pop had ended: the kettle is whole again.
            if (kc.done && k?.kettle?.intact == true) kettle[s] = null
        }
        val mid = f.mapW / 2f
        for (a in flaps) a?.advance(dt)
        for (a in lids) a?.let { it.advance(dt, sink(it, "pot_lid_raise", mid)) }
        for (a in kettleLids) a?.let { it.advance(dt, sink(it, "pot_lid_raise", mid)) }
        i = pins.size - 1
        while (i >= 0) { val pd = pins[i]; pd.clip.advance(dt, sink(pd.clip, "fx_pin_p1_drop", mid)); if (pd.clip.done) pins.removeAt(i); i-- }
        // Shimmer once every 3 s.
        shimmerT += dt
        if (shimmerT >= 3000f) { shimmerT = 0f; def("fx_shimmer")?.let { shimmerClip = AnimClip(anims, it) } }
        shimmerClip?.advance(dt)
        // Trails behind each shell.
        trailT += dt
        if (trailT >= 40f) {
            trailT = 0f
            val sh = f.shells
            for (j in sh.indices) {
                val s = sh[j]
                val name = trailNames.getOrPut(s.shot) { "fx_trail_${trailOf(s.shot)}" }
                spawn(name, s.x.toFloat(), s.y.toFloat(), sound = false, ambient = true)
            }
        }
        // Wind leaves drift with the wind; the Squall overlay loops in a Squall round. Both are ambient.
        val wind = f.hud.wind
        if (!still && wind != 0 && f.phase != Phase.NONE) {
            leafT += dt
            val every = 1400f / abs(wind)
            if (leafT >= every) {
                leafT = 0f
                val lx = if (wind > 0) 0f else f.mapW.toFloat()
                val ly = f.mapH * (0.2f + 0.4f * ((time.toInt() / 37) % 10) / 10f)
                if (leafCount() < MAX_FX / 4) spawn("fx_wind_leaf", lx, ly, 1f, vx = wind * 0.03f, vy = 0.005f, life = f.mapW / (abs(wind) * 0.03f), sound = false, ambient = true)
            }
        }
        squall = if (f.hud.squallRound > 0) (squall ?: def("fx_squall")?.let { AnimClip(anims, it) }) else null
        if (!still) squall?.advance(dt)
    }

    private fun leafCount(): Int { var n = 0; for (j in fx.indices) if (fx[j].ambient) n++; return n }

    private fun basePose(f: Frame, h: Hob): String = when {
        h.bonked -> "bonked"
        f.phase == Phase.ENDED && f.result?.winner == h.side -> "cheer"
        f.phase == Phase.PLAN && h.side == f.side && h.id == f.hud.selectedHob -> "aim"
        h.grudge || h.clatter -> if (hobPose(h.id)?.def(f, "nextdoor") != null) "nextdoor" else "idle"
        else -> "idle"
    }

    // ---- what the renderer asks -------------------------------------------

    /** The Hob's clip (its def gives size and anchor), or null. Resolve its sprite with [spriteOf]. */
    fun hobClip(h: Hob): AnimClip? = hobPose(h.id)?.clip

    /** The sprite a clip shows now, resolved only when its frame changes (kept on the clip). */
    fun spriteOf(c: AnimClip): Sprites.Sprite? {
        val name = c.sprite
        val gen = sprites.generation
        if (c.memoName !== name || c.memoGen != gen) { c.memoName = name; c.memoGen = gen; c.memo = sprites.get(name) }
        val sp = c.memo as Sprites.Sprite?
        if (sp != null) sp.usedAt = stamp
        return sp
    }

    /** Extra y offset in cells for a Hob mid fall (the snapshot already has it at the landing spot). */
    fun hobDy(h: Hob): Float {
        val hp = hobPose(h.id) ?: return 0f
        if (hp.fallT < 0f) return 0f
        val u = (hp.fallT / max(1f, hp.fallMs - 150f)).coerceIn(0f, 1f)
        return (hp.fallFrom - hp.fallTo) * (1f - u * u)
    }

    /** Fort offset while it walks: x, y in cells and tilt in degrees. */
    fun fortShift(side: Int, out: FloatArray) {
        out[0] = 0f; out[1] = 0f; out[2] = 0f
        val w = walks.getOrNull(side) ?: return
        val u = (w.t / w.ms).coerceIn(0f, 1f)
        out[0] = w.dx * (1f - u)
        if (reduceMotion() || u >= 1f) return
        val n = anims.bobDy.size
        if (n == 0) return
        val fi = ((w.t / max(1, anims.bobFrameMs)).toInt()) % n
        out[1] = anims.bobDy[fi]
        out[2] = anims.bobTilt.getOrElse(fi) { 0f }
    }

    /** The kettle pop clip, while it is the look to show (cleared on relight). */
    fun kettleClip(side: Int): AnimClip? = kettle.getOrNull(side)

    fun flapClip(side: Int, room: Int): AnimClip? {
        val s = slot(side, room); if (s < 0) return null
        val a = flaps[s] ?: return null
        return if (a.done && a.def.hold == null) null else a
    }
    fun lidClip(side: Int, room: Int): AnimClip? { val s = slot(side, room); return if (s < 0) null else lids[s] }
    fun kettleLidClip(side: Int): AnimClip? = kettleLids.getOrNull(side)
    fun pinClip(g: Ghost): AnimClip? { val k = pinKey(g); for (i in pins.indices) if (pins[i].key == k) return pins[i].clip; return null }

    /** Legs under a walking fort. */
    fun legClip(side: Int, leg: Int): AnimClip? = if (walks.getOrNull(side) == null) null else legs[side * 2 + leg]

    fun shimmerClip(): AnimClip? = if (reduceMotion()) null else shimmerClip?.let { if (it.done) null else it }
    fun squallClip(): AnimClip? = squall

    /** For tests: start and land y of each falling piece, in world cells. */
    internal fun pieceYs(): List<Pair<Float, Float>> = pieces.map { it.y to it.y + it.fall }
    internal val effectCount: Int get() = fx.size

    // ---- drawing ------------------------------------------------------------

    /** Draw time stamp for [Sprites.Sprite.usedAt], so a low memory trim keeps what is on screen. */
    private var stamp = 0L

    private fun memo(name: String, gen: Int, holder: Rubble): Sprites.Sprite? {
        if (holder.spGen != gen) { holder.spGen = gen; holder.sp = sprites.get(name) }
        return holder.sp?.also { it.usedAt = stamp }
    }

    private fun drawSpBox(c: Canvas, sp: Sprites.Sprite, box: RectF, p: Paint) {
        val spr = sprites as? Sprites
        if (spr != null) spr.drawBox(c, sp, box, r, p)
        else c.drawBitmap(sp.bmp, sp.src, box, p)
    }

    /** Draws collapse pieces, rubble and every effect through lens [l]. */
    fun draw(c: Canvas, l: Lens, f: Frame) {
        stamp = Sprites.now()
        val col = anims.collapse
        val gen = sprites.generation
        val spr = sprites as? Sprites
        for (i in rubble.indices) {
            val rb = rubble[i]
            val sp = memo(rb.sprite, gen, rb) ?: continue
            val a = if (rb.age < col.rubbleHoldMs) 1f else (1f - (rb.age - col.rubbleHoldMs) / 400f).coerceIn(0f, 1f)
            paint.alpha = (a * 255).toInt()
            tmpBox.set(l.sx(rb.x), l.sy(rb.y), l.sx(rb.x + 16f), l.sy(rb.y + 16f))
            drawSpBox(c, sp, tmpBox, paint)
        }
        paint.alpha = 255
        for (i in pieces.indices) drawPiece(c, l, pieces[i], col, gen)
        for (i in fx.indices) {
            val e = fx[i]
            val x = l.sx(e.x); val y = l.sy(e.y)
            if (x < l.rect.left - 200 || x > l.rect.right + 200) continue
            val sp = spriteOf(e.clip) ?: continue
            val d = e.clip.def
            val u = e.k * l.scale
            val fade = if (e.fadeMs > 0f && e.life - e.age < e.fadeMs) ((e.life - e.age) / e.fadeMs).coerceIn(0f, 1f) else 1f
            paint.alpha = (fade * 255).toInt()
            if (e.rot != 0f) {
                c.save(); c.rotate(e.rot * 57.3f, x, y)
                if (spr != null && (sp.trim != null || sp.overlays.isNotEmpty())) spr.drawAnchored(c, sp, x, y, u, flip = false, dst = r, paint = paint)
                else { r.set(x - d.ax * u, y - d.ay * u, x + (d.w - d.ax) * u, y + (d.h - d.ay) * u); c.drawBitmap(sp.bmp, sp.src, r, paint) }
                c.restore()
            } else {
                if (spr != null && (sp.trim != null || sp.overlays.isNotEmpty())) spr.drawAnchored(c, sp, x, y, u, flip = false, dst = r, paint = paint)
                else { r.set(x - d.ax * u, y - d.ay * u, x + (d.w - d.ax) * u, y + (d.h - d.ay) * u); c.drawBitmap(sp.bmp, sp.src, r, paint) }
            }
        }
        paint.alpha = 255
        // Pooled floating damage numbers and callouts (Android-M12 + Part 2 Plate 2 starburst Drop!).
        for (fl in floats) {
            if (!fl.active) continue
            val x = l.sx(fl.x); val y = l.sy(fl.y)
            if (x < l.rect.left - 80 || x > l.rect.right + 80) continue
            val rem = fl.life - fl.age
            val alpha = (if (rem < 250f) (rem / 250f).coerceIn(0f, 1f) else 1f) * 255f
            val alphaInt = alpha.toInt().coerceIn(0, 255)
            val sz = (if (fl.callout) 17f else 13.5f) * dp
            if (fl.callout && fl.text == dropWord) {
                drawStarburst(c, x, y - sz * 0.32f, 28f * dp, 16f * dp, alphaInt)
            }
            floatStroke.textSize = sz; floatStroke.strokeWidth = (if (fl.callout) 3.8f else 2.8f) * dp; floatStroke.alpha = alphaInt
            floatFill.textSize = sz; floatFill.color = fl.color; floatFill.alpha = alphaInt
            c.drawText(fl.text, x, y, floatStroke)
            c.drawText(fl.text, x, y, floatFill)
        }
    }

    private fun drawStarburst(c: Canvas, cx: Float, cy: Float, rx: Float, ry: Float, alpha: Int) {
        burstPath.rewind()
        val points = 12
        for (i in 0 until points * 2) {
            val a = i * PI / points
            val k = if (i % 2 == 0) 1.0f else 0.68f
            val px = cx + (cos(a) * rx * k).toFloat()
            val py = cy + (sin(a) * ry * k).toFloat()
            if (i == 0) burstPath.moveTo(px, py) else burstPath.lineTo(px, py)
        }
        burstPath.close()
        burstFill.alpha = (alpha * 0.92f).toInt()
        burstStroke.alpha = alpha; burstStroke.strokeWidth = 2f * dp
        c.drawPath(burstPath, burstFill)
        c.drawPath(burstPath, burstStroke)
    }

    private fun drawPiece(c: Canvas, l: Lens, p: Piece, col: CollapseData, gen: Int) {
        if (p.spGen != gen) { p.spGen = gen; p.sp = sprites.get("block_${p.mat}_scuffed") ?: sprites.get("block_${p.mat}_fresh") }
        val sp = p.sp
        if (sp != null) sp.usedAt = stamp
        var dx = 0f; var dy = 0f; var deg = 0f; var sy = 1f
        val still = reduceMotion()
        val dropAt = col.creakMs + col.leanMs + p.delay
        when {
            p.t < col.creakMs -> if (!still) { dx = col.shiverX.at(p.t); deg = (col.wobble[p.mat] ?: Track.ZERO).at(p.t) }
            p.t < col.creakMs + col.leanMs -> if (!still) deg = p.leanDir * (col.leanDeg[p.mat] ?: 0f) * col.leanTrack.at(p.t - col.creakMs)
            else -> {
                val ft = max(0f, p.t - dropAt)
                dy = min(p.fall, 0.5f * FALL_G * ft * ft)
                deg = p.leanDir * (col.leanDeg[p.mat] ?: 0f)
                if (!still) {
                    val sw = col.sway[p.mat] ?: 0f
                    if (sw > 0f && dy < p.fall) deg += sw * kotlin.math.sin(ft / 200f * Math.PI.toFloat())
                    if (dy >= p.fall) { val lt = ft - sqrt(2f * max(1f, p.fall) / FALL_G); sy = col.squash.at(lt); deg *= (1f - (lt / 120f).coerceIn(0f, 1f)) }
                }
            }
        }
        val x0 = l.sx(p.x + dx); val y1 = l.sy(p.y + dy + 16f); val w = 16f * l.scale; val h = 16f * l.scale * sy
        tmpBox.set(x0, y1 - h, x0 + w, y1)
        c.save()
        if (deg != 0f) c.rotate(deg, x0 + w / 2f, y1)
        if (sp != null) drawSpBox(c, sp, tmpBox, paint) else { line.color = 0xFF2C221E.toInt(); line.strokeWidth = dp; c.drawRect(tmpBox, line) }
        p.crack?.let { cr -> spriteOf(cr)?.let { drawSpBox(c, it, tmpBox, paint) } }
        c.restore()
    }

    /** Shimmer over the blocks at the end of their reach; with Reduce motion a still dotted outline. */
    fun drawShimmer(c: Canvas, l: Lens, k: Castle, dash: android.graphics.PathEffect) {
        if (k.shimmer.isEmpty()) return
        val sp = shimmerClip()?.let { spriteOf(it) }
        var i = 0
        while (i + 1 < k.shimmer.size) {
            val bx = k.x + 16f * k.shimmer[i]; val by = k.baseY - 16f * (k.shimmer[i + 1] + 1)
            tmpBox.set(l.sx(bx), l.sy(by), l.sx(bx + 16f), l.sy(by + 16f))
            if (sp != null) drawSpBox(c, sp, tmpBox, paint)
            else if (reduceMotion()) { line.color = 0xFFFFF4DE.toInt(); line.strokeWidth = 1.5f * dp; line.pathEffect = dash; c.drawRect(tmpBox, line); line.pathEffect = null }
            i += 2
        }
    }

    /** The Squall: rain and wind tiles over the lens, a few large tiles to keep overdraw down (review 2 N-L17). */
    fun drawSquall(c: Canvas, l: Lens) {
        val sp = squall?.let { spriteOf(it) } ?: return
        val s = max(160f * dp, l.rect.width() / 3f)
        paint.alpha = 150
        var y = l.rect.top
        while (y < l.rect.bottom) { var x = l.rect.left; while (x < l.rect.right) { tmpBox.set(x, y, x + s, y + s); drawSpBox(c, sp, tmpBox, paint); x += s }; y += s }
        paint.alpha = 255
    }

    companion object {
        /** Gravity for view falls, in cells per ms squared (16 cells in about 150 ms). */
        const val FALL_G = 0.0014f
        /** Tactile 45 ms hit-stop on direct Cobble/Hob/Kettle impacts. */
        const val HIT_STOP_MS = 45
        const val MAX_FX = 160
        private val FLATTENER_DEFS = setOf("hedge_snipper", "rake_hand", "mower_minder", "pebble_pitcher")
        private const val MAX_FLOATS = 24
        private val DMG_LABELS = Array(301) { "-$it" }
        /** Room ids per side kept for flaps and lids. */
        private const val ROOMS = 64
        private val ONE_SHOT = setOf("fire", "hit", "dig", "land", "cheer", "blink")
        private val NONE = Any()
        /** Core events that show their `notes` line by the action. */
        private val NOTE_EVENTS = setOf(
            "bonk", "kettle_pop", "thump", "shears_snip", "lid", "lid_block", "buried", "dug_out", "split", "regrow",
            "column", "prop", "prop_break", "prop_wake", "relight", "kettle_crack", "grudge", "clatter",
        )
        /** The five lines that shout. */
        private val SHOUTS = setOf("bonk", "kettle_pop", "thump", "shears_snip")
        private val WALK = arrayOf("stomper_blue_walk", "stomper_orange_walk")
        private val FLAP = arrayOf("loophole_flap_blue_close", "loophole_flap_orange_close")

        fun pinKey(g: Ghost): Long = (g.side.toLong() shl 60) or ((g.pinX.toLong() and 0xFFFFF) shl 40) or ((g.pinY.toLong() and 0xFFFFF) shl 20) or (g.round.toLong() and 0xFFFFF)
    }
}

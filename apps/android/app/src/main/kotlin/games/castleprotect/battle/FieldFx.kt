package games.castleprotect.battle

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import games.castleprotect.core.Castle
import games.castleprotect.core.Frame
import games.castleprotect.core.GameEvent
import games.castleprotect.core.Hob
import games.castleprotect.core.Phase
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

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
 */
class FieldFx(
    private val sprites: Sprites,
    private val dp: Float,
    private val cue: (anim: String, event: String, x: Float, shot: String?) -> Unit,
    private val beat: (kind: String, n: Int, x: Float, y: Float) -> Unit,
    private val reduceMotion: () -> Boolean,
    private val trailOf: (String) -> String,
) {
    var anims: Anims = Anims.EMPTY

    /** One looping or one shot effect at a world point. */
    private class Fx(val clip: AnimClip, var x: Float, var y: Float, var vx: Float = 0f, var vy: Float = 0f, val g: Float = 0f,
                     val k: Float = 1f, var life: Float = 10_000f, val fadeMs: Float = 0f, var rot: Float = 0f, val spin: Float = 0f,
                     val sound: Boolean = true) {
        var age = 0f
    }

    private class HobPose(var clip: AnimClip, var pose: String, var shot: String? = null) {
        var blinkIn = 3000f
        var fallFrom = 0f; var fallTo = 0f; var fallMs = 0f; var fallT = -1f
    }

    /** A block falling in a collapse. */
    private class Piece(val side: Int, val mat: String, val x: Float, val y: Float, val fall: Float, val delay: Float, val leanDir: Float, val first: Boolean, val count: Int) {
        var t = 0f
        var crack: AnimClip? = null
        var landed = false
        var broken = false
    }

    private class Walk(val side: Int, val dx: Float, val ms: Float) { var t = 0f }
    private class Rubble(val sprite: String, val x: Float, val y: Float) { var age = 0f }

    private val fx = ArrayList<Fx>()
    private val hobs = HashMap<Int, HobPose>()
    private val pieces = ArrayList<Piece>()
    private val rubble = ArrayList<Rubble>()
    private val walks = arrayOfNulls<Walk>(2)
    private val legs = arrayOfNulls<AnimClip>(4)
    private val kettle = arrayOfNulls<AnimClip>(2)
    private val flaps = HashMap<String, AnimClip>()
    private val lids = HashMap<String, AnimClip>()
    private val pins = HashMap<String, AnimClip>()
    private var prev: Frame? = null
    private var shimmerT = 0f
    private var shimmerClip: AnimClip? = null
    private var leafT = 0f
    private var trailT = 0f
    private var squall: AnimClip? = null
    private var time = 0f
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val r = RectF()

    val busy: Boolean get() = fx.isNotEmpty() || pieces.isNotEmpty() || rubble.isNotEmpty() || walks.any { it != null } || kettle.any { it != null && !it.done }

    fun clear() { fx.clear(); hobs.clear(); pieces.clear(); rubble.clear(); walks.fill(null); kettle.fill(null); flaps.clear(); lids.clear(); pins.clear(); prev = null }

    private fun def(name: String): AnimDef? = anims[name]
    private fun team(side: Int) = if (side == 0) "blue" else "orange"

    private fun spawn(name: String, x: Float, y: Float, k: Float = 1f, vx: Float = 0f, vy: Float = 0f, g: Float = 0f, life: Float = 10_000f, fadeMs: Float = 0f, spin: Float = 0f, sound: Boolean = true) {
        val d = def(name) ?: return
        if (fx.size >= MAX_FX) fx.removeAt(0)
        val clip = AnimClip(anims, d)
        val f = Fx(clip, x, y, vx, vy, g, k, life, fadeMs, 0f, spin, sound)
        clip.advance(0f) { e -> if (sound) cue(name, e, x, null) }
        if (sound) cue(name, "start", x, null)
        fx.add(f)
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
                "block" -> blockAt(p ?: f, e.side, e.c, e.r)?.let { b -> spawn("fx_impact_${b.third}", b.first + 8f, b.second + 8f, sound = false) }
                "hob" -> if (e.dmg > 0) pose(f, e.hob, "hit")
                "kettle" -> f.castles.getOrNull(e.side)?.kettle?.let { k -> if (k.box.size >= 4) spawn("fx_impact_footing", (k.box[0] + k.box[2]) / 2f, (k.box[1] + k.box[3]) / 2f, sound = false) }
            }
            "break" -> if (key(e.side, e.c, e.r) !in collapsed) blockAt(p ?: f, e.side, e.c, e.r)?.let { b -> breakBlock(b.third, b.first, b.second, 1) }
            "collapse" -> collapse(f, e)
            "drop" -> hobs[e.hob]?.let { hp ->
                val d = def("hob_${hobKey(f, e.hob)}_${team(e.side)}_tumble")
                if (d != null) { hp.clip.play(d); hp.pose = "tumble" }
                hp.fallFrom = e.fromY.toFloat(); hp.fallTo = e.toY.toFloat(); hp.fallT = 0f
                hp.fallMs = (sqrt(2f * max(1f, abs(e.toY - e.fromY).toFloat()) / FALL_G) + 150f)
            } ?: Unit
            "bonk" -> pose(f, e.hob, "bonked")
            "shove_off", "dug_out" -> pose(f, e.hob, "dig")
            "kettle_pop" -> if (e.side in 0..1) def("kettle_pop")?.let { d -> kettle[e.side] = AnimClip(anims, d) }
            "walk" -> if (e.side in 0..1) {
                val dx = (e.fromX - e.toX).toFloat()
                if (dx != 0f) {
                    walks[e.side] = Walk(e.side, dx, max(330f, abs(dx) / 120f * 1000f))
                    def("stomper_${team(e.side)}_walk")?.let { d -> legs[e.side * 2] = AnimClip(anims, d); legs[e.side * 2 + 1] = AnimClip(anims, d).also { it.advance(3f * (d.ms.firstOrNull() ?: 110)) } }
                }
            }
            "win" -> for (h in f.hobs) if (h.side == e.winner && !h.bonked) pose(f, h.id, "cheer")
            "mend", "rebuild" -> {
                val k = f.castles.getOrNull(e.side)
                var i = 0
                if (k != null) while (i + 1 < e.blocks.size) {
                    spawn("fx_fizz_pop", k.x + 16f * e.blocks[i] + 8f, k.baseY - 16f * (e.blocks[i + 1] + 1) + 4f)
                    i += 3
                }
            }
            "squall" -> beat("squall", 1, 0f, 0f)
        }
        prev = f
    }

    private fun key(side: Int, c: Int, r: Int): Long = (side.toLong() shl 40) or ((c + 1000).toLong() shl 20) or (r + 1000).toLong()

    /** World top left and material of a block in [f], or null. */
    private fun blockAt(f: Frame, side: Int, c: Int, r: Int): Triple<Float, Float, String>? {
        val k = f.castles.getOrNull(side) ?: f.castles.firstOrNull { it.side == side } ?: return null
        for (b in k.blocks) if (b.c == c && b.r == r) return Triple(b.x.toFloat(), b.y.toFloat(), b.mat)
        return Triple(k.x + 16f * c, k.baseY - 16f * (r + 1), "timber")
    }

    private fun hobKey(f: Frame, id: Int): String = Sprites.hobKey(f.hobs.firstOrNull { it.id == id }?.def ?: "marge")

    private fun pose(f: Frame, id: Int, pose: String, shot: String? = null) {
        val h = f.hobs.firstOrNull { it.id == id } ?: return
        val d = def("hob_${Sprites.hobKey(h.def)}_${team(h.side)}_$pose") ?: return
        val hp = hobs.getOrPut(id) { HobPose(AnimClip(anims, d), pose) }
        hp.clip.play(d); hp.pose = pose; hp.shot = shot
        if (pose == "bonked") cue(d.name, "start", h.x.toFloat(), null)
    }

    private fun spawnBoom(size: String, x: Float, y: Float) {
        val names = Array(4) { "fx_boom_${size}_$it" }
        val k = when (size) { "large" -> 1.5f; "medium" -> 1.1f; else -> 0.8f }
        // The boom frames are plain sprites (no entry in animations.json): play them as a 4 frame clip.
        val d = AnimDef("boom_$size", names, intArrayOf(50, 60, 70, 90), false, 0, 64f, 64f, 32f, 32f, Array(4) { emptyArray() }, null, null, null)
        if (fx.size >= MAX_FX) fx.removeAt(0)
        fx.add(Fx(AnimClip(anims, d), x, y, k = k, sound = false))
    }

    /** A block breaks where it stands: chunks fly, rubble plays, the broken block holds 1.5 s and fades. */
    private fun breakBlock(mat: String, x: Float, y: Float, n: Int) {
        val c = anims.collapse
        val chunks = if (n > 6) 1 else c.chunks[mat] ?: 3
        for (i in 0 until chunks) {
            val a = (i + 0.5f) / chunks
            spawn("fx_chunk_$mat", x + 16f * a, y + 6f, 1f, vx = (a - 0.5f) * 0.12f, vy = -0.10f - 0.04f * (i % 2), g = FALL_G, life = c.breakMs + 300f, fadeMs = 200f, spin = (a - 0.5f) * 0.8f, sound = i == 0)
        }
        spawn("fx_rubble_$mat", x + 2f, y + 13f)
        rubble.add(Rubble("block_${mat}_broken", x, y))
        if (rubble.size > 40) rubble.removeAt(0)
    }

    /** Collapse beats (06 section 6.3, animations.json data.collapse): creak, lean, drop row by row, land, break. */
    private fun collapse(f: Frame, e: GameEvent) {
        val k = f.castles.getOrNull(e.side) ?: return
        val n = e.blocks.size / 3
        if (n == 0) return
        var minRow = Int.MAX_VALUE
        var i = 0
        while (i + 2 < e.blocks.size) { minRow = min(minRow, e.blocks[i + 1]); i += 3 }
        val mid = k.x + k.cols * 8f
        i = 0
        var first = true
        while (i + 2 < e.blocks.size) {
            val c = e.blocks[i]; val row = e.blocks[i + 1]
            val mat = if (e.blocks[i + 2] >= 0) GameEvent.matName(e.blocks[i + 2]) else "timber"
            var fall = 0f
            var j = 0
            while (j + 1 < e.falls.size) { if (e.falls[j] == c) fall = e.falls[j + 1].toFloat(); j += 2 }
            val x = k.x + 16f * c; val y = k.baseY - 16f * (row + 1) - fall
            val p = Piece(e.side, mat, x, y, fall, ((row - minRow) * anims.collapse.rowGapMs).toFloat(), if (x + 8f < mid) -1f else 1f, first, n)
            def("fx_crack_$mat")?.let { p.crack = AnimClip(anims, it) }
            pieces.add(p)
            first = false
            i += 3
        }
        cue("fx_crack_timber", "start", mid, null)
    }

    // ---- frame state changes (flaps, lids, pins) ---------------------------

    private fun states(f: Frame) {
        for (k in f.castles) {
            for (room in k.rooms) {
                val key = "${k.side}:${room.id}"
                val was = flapState[key]
                if (was != null && was != room.flap) def("loophole_flap_${team(k.side)}_close")?.let { d ->
                    flaps[key] = AnimClip(anims, d, backwards = !room.flap)
                    if (room.flap) cue(d.name, "start", k.x.toFloat(), null)
                }
                flapState[key] = room.flap
                val lwas = lidState[key]
                if (lwas != null && lwas != room.lid) def("pot_lid_raise")?.let { d -> lids[key] = AnimClip(anims, d, backwards = !room.lid) }
                lidState[key] = room.lid
            }
            val kk = k.kettle
            if (kk != null) {
                val key = "${k.side}:k"
                val was = lidState[key]
                if (was != null && was != kk.lid) def("pot_lid_raise")?.let { d -> lids[key] = AnimClip(anims, d, backwards = !kk.lid) }
                lidState[key] = kk.lid
            }
        }
        val seen = HashSet<String>()
        for (g in f.ghosts) if (g.hasPin) {
            val key = "${g.side}:${g.pinX}:${g.pinY}:${g.round}"
            seen.add(key)
            if (key !in pinKnown) {
                pinKnown.add(key)
                if (prev != null) def("fx_pin_${if (g.side == 0) "p1" else "p2"}_drop")?.let { d -> pins[key] = AnimClip(anims, d) }
            }
        }
        pinKnown.retainAll(seen)
    }
    private val flapState = HashMap<String, Boolean>()
    private val lidState = HashMap<String, Boolean>()
    private val pinKnown = HashSet<String>()
    private var lastStateFrame: Frame? = null

    // ---- time ---------------------------------------------------------------

    /** Advances everything by [dt] ms of view time (already scaled by hit stop and slow motion). */
    fun update(f: Frame, dt: Float) {
        if (f !== lastStateFrame) {
            if (lastStateFrame?.fullSeq != f.fullSeq || lastStateFrame == null) states(f)
            lastStateFrame = f
        }
        time += dt
        val still = reduceMotion()
        // Hobs
        val gone = HashSet(hobs.keys)
        for (h in f.hobs) {
            gone.remove(h.id)
            val hp = hobs[h.id]
            val want = basePose(f, h)
            if (hp == null) { def(animName(h, want))?.let { hobs[h.id] = HobPose(AnimClip(anims, it), want) }; continue }
            val oneShot = hp.pose in ONE_SHOT && !hp.clip.done && hp.clip.def.name.endsWith("_${hp.pose}")
            if (!oneShot && hp.pose != want && !(hp.pose == "tumble" && hp.fallT >= 0f)) { def(animName(h, want))?.let { hp.clip.play(it); hp.pose = want } }
            if (hp.pose == "aim") hp.clip.pick(if (h.power < 34) 0 else if (h.power < 67) 1 else 2)
            else if (!(still && hp.pose == "idle")) hp.clip.advance(dt) { e -> cue(hp.clip.def.name, e, h.x.toFloat(), hp.shot) }
            // A play-once pose that ended goes back to the pose the core's state asks for.
            if (hp.clip.def.name.endsWith("_idle") && hp.pose != "idle" && hp.pose in ONE_SHOT) hp.pose = "idle"
            if (hp.pose == "idle") {
                hp.blinkIn -= dt
                if (hp.blinkIn <= 0f) { hp.blinkIn = 3000f + (h.id * 677 % 2000); def(animName(h, "blink"))?.let { hp.clip.play(it) } }
            }
            if (hp.fallT >= 0f) {
                hp.fallT += dt
                if (hp.fallT >= hp.fallMs) { hp.fallT = -1f; def(animName(h, "land"))?.let { hp.clip.play(it); hp.pose = "land" } }
            }
        }
        for (id in gone) hobs.remove(id)
        // Effects
        var i = fx.size - 1
        while (i >= 0) {
            val e = fx[i]
            e.age += dt
            e.vy += e.g * dt
            e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spin * dt
            e.clip.advance(dt) { ev -> if (e.sound) cue(e.clip.def.name, ev, e.x, null) }
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
        // Walks
        for (s in 0..1) {
            val w = walks[s] ?: continue
            w.t += dt
            legs[s * 2]?.advance(dt) { e -> cue("stomper_${team(s)}_walk", e, 0f, null) }
            legs[s * 2 + 1]?.advance(dt)
            if (w.t >= w.ms + 120f) { walks[s] = null; legs[s * 2] = null; legs[s * 2 + 1] = null }
        }
        for (s in 0..1) kettle[s]?.advance(dt) { e -> cue("kettle_pop", e, f.castles.getOrNull(s)?.x?.toFloat() ?: 0f, null) }
        for (a in flaps.values) a.advance(dt)
        for (a in lids.values) a.advance(dt) { e -> cue("pot_lid_raise", e, 0f, null) }
        for (a in pins.values) a.advance(dt) { e -> cue("fx_pin_p1_drop", e, 0f, null) }
        pins.values.removeAll { it.done }
        // Shimmer once every 3 s.
        shimmerT += dt
        if (shimmerT >= 3000f) { shimmerT = 0f; def("fx_shimmer")?.let { shimmerClip = AnimClip(anims, it) } }
        shimmerClip?.advance(dt)
        // Trails behind each shell.
        trailT += dt
        if (trailT >= 40f) {
            trailT = 0f
            for (sh in f.shells) spawn("fx_trail_${trailOf(sh.shot)}", sh.x.toFloat(), sh.y.toFloat(), sound = false)
        }
        // Wind leaves drift with the wind; the Squall overlay loops in a Squall round.
        val wind = f.hud.wind
        if (!still && wind != 0 && f.phase != Phase.NONE) {
            leafT += dt
            val every = 1400f / abs(wind)
            if (leafT >= every) {
                leafT = 0f
                val lx = if (wind > 0) 0f else f.mapW.toFloat()
                val ly = f.mapH * (0.2f + 0.4f * ((time.toInt() / 37) % 10) / 10f)
                spawn("fx_wind_leaf", lx, ly, 1f, vx = wind * 0.03f, vy = 0.005f, life = f.mapW / (abs(wind) * 0.03f), sound = false)
            }
        }
        squall = if (f.hud.squallRound > 0) (squall ?: def("fx_squall")?.let { AnimClip(anims, it) }) else null
        if (!still) squall?.advance(dt)
    }

    private fun basePose(f: Frame, h: Hob): String = when {
        h.bonked -> "bonked"
        f.phase == Phase.ENDED && f.result?.winner == h.side -> "cheer"
        f.phase == Phase.PLAN && h.side == f.side && h.id == f.hud.selectedHob && f.hud.human(f.side) -> "aim"
        h.grudge || h.clatter -> if (def(animName(h, "nextdoor")) != null) "nextdoor" else "idle"
        else -> "idle"
    }

    private fun animName(h: Hob, pose: String) = "hob_${Sprites.hobKey(h.def)}_${team(h.side)}_$pose"

    // ---- what the renderer asks -------------------------------------------

    /** The Hob's current sprite and the animation it belongs to (for size and anchor), or null. */
    fun hobFrame(h: Hob): Pair<String, AnimDef>? {
        val hp = hobs[h.id] ?: return null
        return hp.clip.sprite to hp.clip.def
    }

    /** Extra y offset in cells for a Hob mid fall (the snapshot already has it at the landing spot). */
    fun hobDy(h: Hob): Float {
        val hp = hobs[h.id] ?: return 0f
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

    fun kettleSprite(side: Int): String? = kettle.getOrNull(side)?.sprite

    fun flapSprite(side: Int, room: Int): String? = flaps["$side:$room"]?.let { if (it.done && it.def.hold == null) null else it.sprite }
    fun lidSprite(side: Int, room: String): String? = lids["$side:$room"]?.sprite
    fun pinSprite(key: String): String? = pins[key]?.sprite

    /** Legs under a walking fort, as sprites to draw at the fort base. */
    fun legSprite(side: Int, leg: Int): String? = if (walks.getOrNull(side) == null) null else legs[side * 2 + leg]?.sprite

    fun shimmerSprite(): String? = if (reduceMotion()) null else shimmerClip?.let { if (it.done) null else it.sprite }
    fun squallSprite(): String? = squall?.sprite

    // ---- drawing ------------------------------------------------------------

    /** Draws collapse pieces, rubble and every effect through lens [l]. */
    fun draw(c: Canvas, l: Lens, f: Frame) {
        val col = anims.collapse
        for (rb in rubble) {
            val sp = sprites.get(rb.sprite) ?: continue
            val a = if (rb.age < col.rubbleHoldMs) 1f else (1f - (rb.age - col.rubbleHoldMs) / 400f).coerceIn(0f, 1f)
            paint.alpha = (a * 255).toInt()
            r.set(l.sx(rb.x), l.sy(rb.y), l.sx(rb.x + 16f), l.sy(rb.y + 16f))
            c.drawBitmap(sp.bmp, null, r, paint)
        }
        paint.alpha = 255
        for (p in pieces) drawPiece(c, l, p, col)
        for (e in fx) {
            val name = e.clip.sprite
            val sp = sprites.get(name) ?: continue
            val d = e.clip.def
            val u = e.k * l.scale
            val x = l.sx(e.x); val y = l.sy(e.y)
            if (x < l.rect.left - 200 || x > l.rect.right + 200) continue
            val fade = if (e.fadeMs > 0f && e.life - e.age < e.fadeMs) ((e.life - e.age) / e.fadeMs).coerceIn(0f, 1f) else 1f
            paint.alpha = (fade * 255).toInt()
            r.set(x - d.ax * u, y - d.ay * u, x + (d.w - d.ax) * u, y + (d.h - d.ay) * u)
            if (e.rot != 0f) { c.save(); c.rotate(e.rot * 57.3f, x, y); c.drawBitmap(sp.bmp, null, r, paint); c.restore() } else c.drawBitmap(sp.bmp, null, r, paint)
        }
        paint.alpha = 255
    }

    private fun drawPiece(c: Canvas, l: Lens, p: Piece, col: CollapseData) {
        val sp = sprites.get("block_${p.mat}_scuffed") ?: sprites.get("block_${p.mat}_fresh")
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
        r.set(x0, y1 - h, x0 + w, y1)
        c.save()
        if (deg != 0f) c.rotate(deg, x0 + w / 2f, y1)
        if (sp != null) c.drawBitmap(sp.bmp, null, r, paint) else { line.color = 0xFF2B1E2E.toInt(); line.strokeWidth = dp; c.drawRect(r, line) }
        p.crack?.let { cr -> sprites.get(cr.sprite)?.let { c.drawBitmap(it.bmp, null, r, paint) } }
        c.restore()
    }

    /** Shimmer over the blocks at the end of their reach; with Reduce motion a still dotted outline. */
    fun drawShimmer(c: Canvas, l: Lens, k: Castle, dash: android.graphics.PathEffect) {
        if (k.shimmer.isEmpty()) return
        val name = shimmerSprite()
        val sp = name?.let { sprites.get(it) }
        var i = 0
        while (i + 1 < k.shimmer.size) {
            val bx = k.x + 16f * k.shimmer[i]; val by = k.baseY - 16f * (k.shimmer[i + 1] + 1)
            r.set(l.sx(bx), l.sy(by), l.sx(bx + 16f), l.sy(by + 16f))
            if (sp != null) c.drawBitmap(sp.bmp, null, r, paint)
            else if (reduceMotion()) { line.color = 0xFFFFF4DE.toInt(); line.strokeWidth = 1.5f * dp; line.pathEffect = dash; c.drawRect(r, line); line.pathEffect = null }
            i += 2
        }
    }

    /** The Squall: rain and wind tiles over the lens. */
    fun drawSquall(c: Canvas, l: Lens) {
        val sp = squallSprite()?.let { sprites.get(it) } ?: return
        val s = 96f * dp
        paint.alpha = 150
        var y = l.rect.top
        while (y < l.rect.bottom) { var x = l.rect.left; while (x < l.rect.right) { r.set(x, y, x + s, y + s); c.drawBitmap(sp.bmp, null, r, paint); x += s }; y += s }
        paint.alpha = 255
    }

    companion object {
        /** Gravity for view falls, in cells per ms squared (16 cells in about 150 ms). */
        const val FALL_G = 0.0014f
        const val MAX_FX = 160
        private val ONE_SHOT = setOf("fire", "hit", "dig", "land", "cheer", "blink")
    }
}

package games.castleprotect.battle

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import games.castleprotect.core.Block
import games.castleprotect.core.Castle
import games.castleprotect.core.Frame
import games.castleprotect.core.Hob
import games.castleprotect.core.Phase
import games.castleprotect.core.Terrain
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Canvas drawing of one frame through a Lens. Pure view code: it reads the frame
 * and never writes game state. Colours follow docs/design/06 (ink #2B1E2E, never
 * pure black; you blue and round, Rival orange and diamond).
 *
 * Per frame it allocates nothing on the common path (review H8): sprites are
 * resolved once per full snapshot and kept on the block and Hob objects, sprite
 * name tables are built at start, and text is formatted only when it changes.
 */
class BattleRenderer(private val sprites: Sprites, private val dp: Float) {
    private val ink = 0xFF2B1E2E.toInt()
    private val blue = 0xFF2F6FDE.toInt(); private val orange = 0xFFE8730C.toInt()
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = ink; strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
    private val bmp = Paint(Paint.FILTER_BITMAP_FLAG)
    private val terrainPaint = Paint() // no filtering: crisp cells
    private val path = Path()
    private val r = RectF()
    private val mtx = Matrix()
    private var sky: LinearGradient? = null; private var skyH = 0f
    private var time = 0f
    private class Blast(var x: Float, var y: Float, var age: Float, var big: Boolean)
    private val blasts = ArrayList<Blast>()
    private val ghostDash = DashPathEffect(floatArrayOf(8 * dp, 6 * dp), 0f)

    // Sprite tables built once.
    private class Looks(val gen: Int, val sp: Sprites.Sprite?)
    private class HobLook(val gen: Int, val idle: Array<Sprites.Sprite?>, val aim: Array<Sprites.Sprite?>, val fire: Sprites.Sprite?, val bonked: Array<Sprites.Sprite?>, val cheer: Array<Sprites.Sprite?>, val k: Float)
    private val shellSprites = HashMap<String, Sprites.Sprite?>()
    private var tableGen = -1
    private var boomLarge = arrayOfNulls<Sprites.Sprite>(4); private var boomMedium = arrayOfNulls<Sprites.Sprite>(4)
    private var dotP1: Sprites.Sprite? = null; private var dotP2: Sprites.Sprite? = null
    private var pinP1: Sprites.Sprite? = null; private var pinP2: Sprites.Sprite? = null
    private var kettleFull: Sprites.Sprite? = null; private var kettleHurt: Sprites.Sprite? = null; private var kettleCrit: Sprites.Sprite? = null; private var kettlePopped: Sprites.Sprite? = null; private var kettleHalo: Sprites.Sprite? = null
    private var nookSp: Sprites.Sprite? = null; private var kettleRoomSp: Sprites.Sprite? = null
    private var flagBlue: Sprites.Sprite? = null; private var flagOrange: Sprites.Sprite? = null
    private var skySp: Sprites.Sprite? = null; private var farSp: Sprites.Sprite? = null; private var nearSp: Sprites.Sprite? = null
    private val roundLabels = Array(41) { it.toString() }

    private fun tables() {
        val g = sprites.generation
        if (g == tableGen) return
        tableGen = g
        shellSprites.clear()
        for (i in 0..3) { boomLarge[i] = sprites.get("fx_boom_large_$i"); boomMedium[i] = sprites.get("fx_boom_medium_$i") }
        dotP1 = sprites.get("fx_ghost_dot_p1"); dotP2 = sprites.get("fx_ghost_dot_p2")
        pinP1 = sprites.get("fx_pin_p1"); pinP2 = sprites.get("fx_pin_p2")
        kettleFull = sprites.get("kettle_full"); kettleHurt = sprites.get("kettle_hurt"); kettleCrit = sprites.get("kettle_critical"); kettlePopped = sprites.get("kettle_popped"); kettleHalo = sprites.get("kettle_halo")
        nookSp = sprites.get("nook"); kettleRoomSp = sprites.get("kettle_room")
        flagBlue = sprites.get("flag_blue"); flagOrange = sprites.get("flag_orange")
        skySp = sprites.get("bg_downs_sky"); farSp = sprites.get("bg_downs_hills_far"); nearSp = sprites.get("bg_downs_hills_near")
    }

    fun addBlast(x: Float, y: Float, big: Boolean) {
        if (blasts.size >= 16) blasts.removeAt(0)
        blasts.add(Blast(x, y, 0f, big))
    }
    val animating: Boolean get() = blasts.isNotEmpty()
    fun clearBlasts() = blasts.clear()
    fun tick(dt: Float) {
        time += dt
        var i = blasts.size - 1
        while (i >= 0) { val b = blasts[i]; b.age += dt; if (b.age > 0.5f) blasts.removeAt(i); i-- }
    }

    // ---- terrain bitmap ----------------------------------------------------

    private var terrainBmp: Bitmap? = null
    private var terrainOf: Terrain? = null
    private val dirty = ArrayList<IntArray>()
    private var rowBuf = IntArray(0)

    /** Copies changed terrain into the bitmap. One pixel per 2 x 2 cells keeps it to about 1.7 MB on a Standard map. */
    fun syncTerrain(t: Terrain?) {
        if (t == null) { terrainBmp?.recycle(); terrainBmp = null; terrainOf = null; return }
        if (t !== terrainOf || terrainBmp == null) {
            terrainBmp?.recycle()
            terrainBmp = try { Bitmap.createBitmap(max(1, t.w / DS), max(1, t.h / DS), Bitmap.Config.ARGB_8888) } catch (e: OutOfMemoryError) { null }
            terrainOf = t
            t.markAllDirty()
        }
        val b = terrainBmp ?: return
        dirty.clear()
        t.takeDirty(dirty)
        if (dirty.isEmpty()) return
        val pw = b.width; val ph = b.height
        if (rowBuf.size < pw) rowBuf = IntArray(pw)
        t.lock {
            for (d in dirty) {
                val px0 = (d[0] / DS).coerceIn(0, pw); val px1 = ((d[0] + d[2] + DS - 1) / DS).coerceIn(0, pw)
                val py0 = (d[1] / DS).coerceIn(0, ph); val py1 = ((d[1] + d[3] + DS - 1) / DS).coerceIn(0, ph)
                if (px1 <= px0) continue
                for (py in py0 until py1) {
                    val cy = min(t.h - 1, py * DS)
                    val rowOff = cy * t.w
                    for (px in px0 until px1) rowBuf[px - px0] = MAT[t.cells[rowOff + min(t.w - 1, px * DS)].toInt() and 7]
                    b.setPixels(rowBuf, 0, px1 - px0, px0, py, px1 - px0, 1)
                }
            }
        }
    }

    private fun drawTerrain(c: Canvas, l: Lens, f: Frame) {
        val b = terrainBmp
        val t = f.terrain
        if (b == null || t == null) {
            // No terrain yet: a flat band at the footing line.
            fill.color = MAT[1]; c.drawRect(l.rect.left, l.sy(f.groundAt(0).toFloat()), l.rect.right, l.rect.bottom, fill)
            return
        }
        mtx.setScale(l.scale * DS, l.scale * DS)
        mtx.postTranslate(l.sx(0f), l.sy(0f))
        c.drawBitmap(b, mtx, terrainPaint)
        // Grass along the surface, only across the visible columns.
        val x0 = l.wx(l.rect.left).toInt().coerceIn(0, t.w - 1); val x1 = l.wx(l.rect.right).toInt().coerceIn(0, t.w - 1)
        if (x1 <= x0) return
        val stepCells = max(1, (3f * dp / l.scale).toInt())
        path.rewind()
        var x = x0
        var started = false
        while (x <= x1) {
            val y = t.surface[x]
            if (y < t.h) { val sx = l.sx(x.toFloat()); val sy = l.sy(y.toFloat()); if (!started) { path.moveTo(sx, sy); started = true } else path.lineTo(sx, sy) } else started = false
            x += stepCells
        }
        line.pathEffect = null
        line.color = 0xFF7CC36A.toInt(); line.strokeWidth = max(3f * dp, 4f * l.scale); c.drawPath(path, line)
    }

    // ---- background ----------------------------------------------------------

    private fun band(c: Canvas, sp: Sprites.Sprite, rc: RectF, bottom: Float, h: Float, shift: Float) {
        val w = h * sp.meta.w / sp.meta.h
        if (w < 1f) return
        var x = rc.left - (((shift % w) + w) % w)
        while (x < rc.right) { r.set(x, bottom - h, x + w + 1f, bottom); c.drawBitmap(sp.bmp, null, r, bmp); x += w }
    }

    fun drawEmpty(c: Canvas) { c.drawColor(0xFFA5D8EC.toInt()) }

    fun drawLens(c: Canvas, l: Lens, f: Frame, me: Int, drag: FloatArray?, readout: String?) {
        tables()
        val rc = l.rect
        c.save(); c.clipRect(rc)
        val sk = skySp
        if (sk != null) { r.set(rc); c.drawBitmap(sk.bmp, null, r, bmp) }
        else {
            if (sky == null || skyH != rc.height()) { skyH = rc.height(); sky = LinearGradient(0f, 0f, 0f, skyH, 0xFF9FD6EC.toInt(), 0xFFDDF1EE.toInt(), Shader.TileMode.CLAMP) }
            c.save(); c.translate(0f, rc.top); fill.shader = sky; c.drawRect(rc.left, 0f, rc.right, rc.height(), fill); fill.shader = null; c.restore()
        }
        val horizon = l.sy(f.groundAt(l.cx.toInt()).toFloat()).coerceIn(rc.top + rc.height() * 0.45f, rc.bottom)
        farSp?.let { band(c, it, rc, horizon + 6 * dp, rc.height() * 0.42f, l.cx * l.scale * 0.25f) }
        nearSp?.let { band(c, it, rc, horizon + 14 * dp, rc.height() * 0.30f, l.cx * l.scale * 0.5f) }

        drawTerrain(c, l, f)
        for (k in f.castles) drawCastle(c, l, f, k)

        // Ghost lines of earlier shots, then their Pins.
        line.strokeWidth = 1.5f * dp
        line.pathEffect = ghostDash
        for (gi in f.ghosts.indices) {
            val g = f.ghosts[gi]
            val p = g.points
            if (p.size < 4) continue
            path.rewind(); path.moveTo(l.sx(p[0].toFloat()), l.sy(p[1].toFloat()))
            var i = 2; while (i + 1 < p.size) { path.lineTo(l.sx(p[i].toFloat()), l.sy(p[i + 1].toFloat())); i += 2 }
            line.color = ink; line.alpha = if (g.side == f.side) 110 else 50
            c.drawPath(path, line)
        }
        line.pathEffect = null; line.alpha = 255
        val wl = l.wx(rc.left) - 20; val wr = l.wx(rc.right) + 20
        for (g in f.ghosts) if (g.hasPin && g.pinX >= wl && g.pinX <= wr) drawPin(c, l.sx(g.pinX.toFloat()), l.sy(g.pinY.toFloat()), g.side, g.round, g.recalled)

        // Preview dots for the side in Plan.
        val dot = if (f.side == 0) dotP1 else dotP2
        var i = 0
        val pv = f.preview
        while (i + 1 < pv.size) {
            val px = l.sx(pv[i].toFloat()); val py = l.sy(pv[i + 1].toFloat())
            if (dot != null) spriteAt(c, dot, px, py, 8f * dp)
            else { fill.color = Color.WHITE; c.drawCircle(px, py, 3.2f * dp, fill); line.color = ink; line.strokeWidth = 1.2f * dp; c.drawCircle(px, py, 3.2f * dp, line) }
            i += 2
        }

        // Props: crocks, turnips, cage bars, the captive. Simple shapes until they have art.
        for (p in f.props) {
            fill.color = if (p.side == 0) blue else if (p.side == 1) orange else 0xFF8A6A4A.toInt()
            c.drawCircle(l.sx(p.x.toFloat()), l.sy(p.y.toFloat()), max(4f * dp, 6f * l.scale), fill)
        }

        // Shells in flight.
        for (sh in f.shells) {
            val px = l.sx(sh.x.toFloat()); val py = l.sy(sh.y.toFloat()); val rad = max(4f * dp, 4f * l.scale)
            val sp = shellSprite(sh.shot)
            if (sp != null) {
                c.save(); c.rotate(-sh.rot / 10f, px, py)
                spriteAt(c, sp, px, py, max(12f * dp, sp.meta.h * l.scale)); c.restore()
            } else { fill.color = ink; c.drawCircle(px, py, rad, fill); fill.color = 0xFFFFC23D.toInt(); c.drawCircle(px + rad * 0.6f, py - rad * 0.7f, rad * 0.35f, fill) }
        }

        // Blasts: warm white with a gold rim.
        for (b in blasts) {
            val t = b.age / 0.5f; val rad = (if (b.big) 40f else 26f) * l.scale * (0.3f + 0.7f * t)
            val boom = (if (b.big) boomLarge else boomMedium)[min(3, (t * 4).toInt())]
            if (boom != null) { spriteAt(c, boom, l.sx(b.x), l.sy(b.y), (if (b.big) 96f else 64f) * l.scale); continue }
            fill.color = 0xFFFFF6E0.toInt(); fill.alpha = ((1 - t) * 230).toInt(); c.drawCircle(l.sx(b.x), l.sy(b.y), rad, fill); fill.alpha = 255
            line.color = 0xFFFFC23D.toInt(); line.alpha = ((1 - t) * 255).toInt(); line.strokeWidth = 3 * dp; c.drawCircle(l.sx(b.x), l.sy(b.y), rad, line); line.alpha = 255
        }

        // Aim Drag: stretchy band from anchor to finger.
        if (drag != null && f.phase == Phase.PLAN) {
            line.color = if (f.side == 0) blue else orange; line.strokeWidth = 4 * dp; line.alpha = 200
            c.drawLine(drag[0], drag[1], drag[2], drag[3], line); line.alpha = 255
            fill.color = Color.WHITE; c.drawCircle(drag[0], drag[1], 5 * dp, fill); line.strokeWidth = 1.5f * dp; line.color = ink; c.drawCircle(drag[0], drag[1], 5 * dp, line)
            line.alpha = 60; c.drawCircle(drag[0], drag[1], 12 * dp, line); line.alpha = 255
            fill.color = if (f.side == 0) blue else orange; c.drawCircle(drag[2], drag[3], 9 * dp, fill)
        }
        // Aim arrow from the selected Hob's Loophole, and the big readout while dragging.
        val hob = f.selectedHob
        if (hob != null && f.phase == Phase.PLAN && f.hud.human(f.side)) {
            val castle = f.castles.firstOrNull { it.side == f.side }
            val room = castle?.rooms?.firstOrNull { it.kind == "nook" && it.id == hob.nook }
            val lh = room?.loophole
            val ax: Float; val ay: Float
            if (lh != null && lh.size >= 4) { ax = (lh[0] + lh[2]) / 2f; ay = (lh[1] + lh[3]) / 2f } else { ax = hob.x.toFloat(); ay = hob.y - 14f }
            val a = Math.toRadians(hob.angle / 10.0); val len = (14f + hob.power * 0.3f) * dp
            val hx = l.sx(ax); val hy = l.sy(ay)
            val ex = hx + (cos(a) * len).toFloat(); val ey = hy - (sin(a) * len).toFloat()
            line.color = ink; line.strokeWidth = 3 * dp; c.drawLine(hx, hy, ex, ey, line)
            fill.color = 0xFFFFC23D.toInt(); c.drawCircle(ex, ey, 4 * dp, fill); line.strokeWidth = 1.5f * dp; c.drawCircle(ex, ey, 4 * dp, line)
            if (readout != null) {
                text.textSize = 18 * dp
                val tw = text.measureText(readout) / 2 + 10 * dp
                val ty = (hy - 64 * dp).coerceAtLeast(rc.top + 24 * dp)
                val tx = hx.coerceIn(rc.left + tw + 4 * dp, max(rc.left + tw + 4 * dp, rc.right - tw - 4 * dp))
                r.set(tx - tw, ty - 16 * dp, tx + tw, ty + 16 * dp)
                fill.color = 0xFFFFF4DE.toInt(); c.drawRoundRect(r, 10 * dp, 10 * dp, fill); line.strokeWidth = 2 * dp; c.drawRoundRect(r, 10 * dp, 10 * dp, line)
                c.drawText(readout, tx, ty + 6 * dp, text)
            }
        }
        c.restore()
    }

    private fun shellSprite(shot: String): Sprites.Sprite? {
        if (shellSprites.containsKey(shot)) return shellSprites[shot]
        val sp = sprites.get("shell_$shot", "shell_clodpot")
        shellSprites[shot] = sp
        return sp
    }

    /** Draws a sprite with its manifest anchor on the world point (wx, wy). */
    private fun sprite(c: Canvas, sp: Sprites.Sprite, l: Lens, wx: Float, wy: Float, k: Float = 1f, flip: Boolean = false) {
        val u = k * l.scale; val m = sp.meta
        val x = l.sx(wx); val y = l.sy(wy)
        r.set(x - m.ax * u, y - m.ay * u, x + (m.w - m.ax) * u, y + (m.h - m.ay) * u)
        if (flip) { c.save(); c.scale(-1f, 1f, x, y); c.drawBitmap(sp.bmp, null, r, bmp); c.restore() } else c.drawBitmap(sp.bmp, null, r, bmp)
    }

    /** Draws a sprite centred on a screen point at a given screen height. */
    private fun spriteAt(c: Canvas, sp: Sprites.Sprite, x: Float, y: Float, hPx: Float) {
        val wPx = hPx * sp.meta.w / sp.meta.h
        r.set(x - wPx / 2, y - hPx / 2, x + wPx / 2, y + hPx / 2); c.drawBitmap(sp.bmp, null, r, bmp)
    }

    /** Draws a sprite into a world box [x0, y0, x1, y1] (inclusive cells). */
    private fun spriteBox(c: Canvas, sp: Sprites.Sprite, l: Lens, box: IntArray) {
        if (box.size < 4) return
        r.set(l.sx(box[0].toFloat()), l.sy(box[1].toFloat()), l.sx(box[2] + 1f), l.sy(box[3] + 1f))
        c.drawBitmap(sp.bmp, null, r, bmp)
    }

    private fun matColor(m: String) = when (m) {
        "wicker" -> 0xFFE3B565.toInt(); "timber" -> 0xFFB9733A.toInt(); "cobble" -> 0xFFA9A39A.toInt()
        "footing" -> 0xFF5A4A42.toInt(); else -> 0xFF6B7A86.toInt()
    }

    /**
     * Block look. The core says `battered` (fatigue) and hp/max; the app shows battered
     * when the core says so, scuffed when it has taken any damage, fresh otherwise.
     * No damage thresholds are decided here.
     */
    private fun blockSprite(b: Block): Sprites.Sprite? {
        val cached = b.look as? Looks
        if (cached != null && cached.gen == tableGen) return cached.sp
        val wear = if (b.battered) "battered" else if (b.hp < b.max) "scuffed" else "fresh"
        val sp = sprites.get("block_${b.mat}_$wear", "block_${b.mat}_fresh")
        b.look = Looks(tableGen, sp)
        return sp
    }

    private fun hobLook(h: Hob, team: String): HobLook {
        val cached = h.look as? HobLook
        if (cached != null && cached.gen == tableGen) return cached
        val key = Sprites.hobKey(h.def)
        val base = "hob_${key}_${team}_"
        val idle = Array(3) { sprites.get("${base}idle_$it") }
        val look = HobLook(
            tableGen, idle,
            Array(2) { sprites.get("${base}aim_$it") }, sprites.get("${base}fire_1"),
            Array(2) { sprites.get("${base}bonked_$it") }, Array(2) { sprites.get("${base}cheer_$it") },
            // A Hob frame is about 80 cells tall in the art; it stands about 28 cells tall in a 32 cell Nook.
            28f / (idle[0]?.meta?.h ?: 80f),
        )
        h.look = look
        return look
    }

    private fun drawCastle(c: Canvas, l: Lens, f: Frame, k: Castle) {
        val col = if (k.side == 0) blue else orange
        val team = if (k.side == 0) "blue" else "orange"
        line.pathEffect = null
        // Rooms sit behind the blocks.
        val ks = k.kettle
        if (ks != null) kettleRoomSp?.let { spriteBox(c, it, l, ks.room) }
        nookSp?.let { n -> for (room in k.rooms) if (room.kind == "nook") spriteBox(c, n, l, room.box) }
        val left = l.rect.left; val right = l.rect.right
        val bs = k.block.toFloat()
        for (b in k.blocks) {
            r.set(l.sx(b.x.toFloat()), l.sy(b.y.toFloat()), l.sx(b.x + bs), l.sy(b.y + bs))
            if (r.right < left || r.left > right) continue
            val sp = blockSprite(b)
            if (sp != null) { c.drawBitmap(sp.bmp, null, r, bmp); continue }
            fill.color = matColor(b.mat); c.drawRect(r, fill)
            line.color = ink; line.strokeWidth = max(1f, 1.2f * dp * min(1f, l.scale / dp + 0.3f)); c.drawRect(r, line)
            if (b.hp < b.max) { fill.color = ink; fill.alpha = 70; c.drawRect(r, fill); fill.alpha = 255 }
        }
        // Heartkettle. The look follows the core's kettle_pct for this side.
        if (ks != null && ks.box.size >= 4) {
            val kx = l.sx((ks.box[0] + ks.box[2]) / 2f); val ky = l.sy((ks.box[1] + ks.box[3]) / 2f)
            val pct = f.hud.kettlePct.getOrElse(k.side) { 100 }
            val sp = if (!ks.intact || pct <= 0) kettlePopped else if (pct <= 25) kettleCrit else if (pct <= 50) kettleHurt else kettleFull
            if (sp != null) {
                if (ks.intact) kettleHalo?.let { spriteAt(c, it, kx, ky, 34f * l.scale * (1f + 0.06f * sin(time * 4f))) }
                spriteAt(c, sp, kx, ky, 24f * l.scale)
            } else if (ks.intact) {
                val kr = 9f * l.scale
                fill.color = 0xFFE8873A.toInt(); c.drawCircle(kx, ky, kr, fill); line.color = ink; line.strokeWidth = 1.5f * dp; c.drawCircle(kx, ky, kr, line)
                fill.color = 0xFF4FE3C1.toInt(); c.drawCircle(kx, ky, kr * (0.3f + 0.08f * sin(time * 4f)), fill)
            }
        }
        // Hobs; (x, y) is the feet. Art faces right, so the right-hand fort is flipped.
        val firing = (f.phase == Phase.RESOLVE) && f.side == k.side
        val frame2 = (time * 2f).toInt()
        for (h in f.hobs) {
            if (h.side != k.side) continue
            val hx = l.sx(h.x.toFloat()); val hy = l.sy(h.y.toFloat())
            val selected = h.id == f.hud.selectedHob && f.side == k.side
            val look = hobLook(h, team)
            val sp = when {
                h.bonked -> look.bonked[frame2 % 2]
                selected && firing -> look.fire
                selected && f.phase == Phase.PLAN -> look.aim[frame2 % 2]
                f.phase == Phase.ENDED && h.hp > 0 && f.result?.winner == k.side -> look.cheer[(time * 3f).toInt() % 2]
                else -> look.idle[(frame2 + h.id) % 3]
            } ?: look.idle[0]
            val hr = 9f * l.scale
            if (sp != null) sprite(c, sp, l, h.x.toFloat(), h.y.toFloat(), look.k, flip = k.side == 1)
            else if (h.bonked) { fill.color = 0xFF9A9198.toInt(); fill.alpha = 150; c.drawCircle(hx, hy - hr, hr * 0.8f, fill); fill.alpha = 255 }
            else {
                val cy = hy - hr * 1.2f
                fill.color = 0xFFF2C9A0.toInt(); c.drawCircle(hx, cy, hr, fill)
                fill.color = col; c.drawRect(hx - hr * 0.8f, cy + hr * 0.55f, hx + hr * 0.8f, cy + hr * 0.95f, fill) // team scarf
                line.color = ink; line.strokeWidth = 1.3f * dp; c.drawCircle(hx, cy, hr, line)
            }
            if (h.bonked) continue
            if (selected && f.phase == Phase.PLAN) {
                line.color = 0xFFFFC23D.toInt(); line.strokeWidth = 2.5f * dp; line.pathEffect = ghostDash
                c.drawCircle(hx, hy - 14f * l.scale, 19f * l.scale, line); line.pathEffect = null
            }
            if (h.hp < h.max) {
                val wbar = 22f * l.scale
                fill.color = ink; c.drawRect(hx - wbar / 2, hy + 2 * dp, hx + wbar / 2, hy + 5 * dp, fill)
                fill.color = 0xFF5CC35A.toInt(); c.drawRect(hx - wbar / 2, hy + 2 * dp, hx - wbar / 2 + wbar * h.hp / max(1, h.max), hy + 5 * dp, fill)
            }
        }
        // Flag on the top of the fort: yours points left with round shapes, the Rival's right with diamonds.
        val topY = k.topY.toFloat()
        val fx = k.x + if (k.side == 0) 4f else k.cols * bs - 4f
        val flag = if (k.side == 0) flagBlue else flagOrange
        if (flag != null) { sprite(c, flag, l, fx, topY, 1.4f, flip = k.side == 0); return }
        val sx = l.sx(fx); val sy = l.sy(topY); val fh = 22f * l.scale; val dir = if (k.side == 0) -1f else 1f
        line.color = ink; line.strokeWidth = 2 * dp; c.drawLine(sx, sy, sx, sy - fh, line)
        path.rewind(); path.moveTo(sx, sy - fh); path.lineTo(sx + dir * fh * 0.6f, sy - fh * 0.8f); path.lineTo(sx, sy - fh * 0.6f); path.close()
        fill.color = col; c.drawPath(path, fill); line.strokeWidth = 1.3f * dp; c.drawPath(path, line)
    }

    private fun drawPin(c: Canvas, x: Float, y: Float, side: Int, round: Int, spent: Boolean) {
        val col = if (side == 0) blue else orange
        val hr = 8f * dp; val cy = y - 16 * dp
        val label = roundLabels[round.coerceIn(0, roundLabels.size - 1)]
        val sp = if (spent) null else if (side == 0) pinP1 else pinP2
        if (sp != null) {
            val hPx = 28f * dp; val u = hPx / sp.meta.h
            r.set(x - sp.meta.ax * u, y - sp.meta.ay * u, x + (sp.meta.w - sp.meta.ax) * u, y + (sp.meta.h - sp.meta.ay) * u); c.drawBitmap(sp.bmp, null, r, bmp)
            text.textSize = 8 * dp; text.color = Color.WHITE; c.drawText(label, x, y - hPx * 0.58f, text); text.color = ink
            return
        }
        line.color = ink; line.strokeWidth = 2 * dp; c.drawLine(x, y, x, cy, line)
        path.rewind()
        if (side == 0) path.addCircle(x, cy, hr, Path.Direction.CW)
        else { path.moveTo(x, cy - hr * 1.2f); path.lineTo(x + hr * 1.2f, cy); path.lineTo(x, cy + hr * 1.2f); path.lineTo(x - hr * 1.2f, cy); path.close() }
        fill.color = if (spent) 0xFFFFF4DE.toInt() else col; c.drawPath(path, fill)
        line.strokeWidth = 1.5f * dp; c.drawPath(path, line)
        text.textSize = 9 * dp; text.color = if (spent) ink else Color.WHITE; c.drawText(label, x, cy + 3.2f * dp, text); text.color = ink
    }

    /** The Field Strip: the whole field in small, with both forts, the Pins, the shell and each lens's edges. */
    fun drawStrip(c: Canvas, rc: RectF, f: Frame, l1: Lens, l2: Lens?) {
        fill.color = 0xFFFFF4DE.toInt(); c.drawRect(rc, fill)
        line.pathEffect = null; line.color = ink; line.strokeWidth = 1.5f * dp
        c.drawLine(rc.left, rc.top, rc.right, rc.top, line); c.drawLine(rc.left, rc.bottom, rc.right, rc.bottom, line)
        val pad = 10 * dp
        val mw = max(1, f.mapW).toFloat(); val mh = max(1, f.mapH).toFloat()
        fun mx(wx: Float) = rc.left + pad + (wx / mw) * (rc.width() - 2 * pad)
        fun my(wy: Float) = rc.top + 3 * dp + (wy / mh).coerceIn(0f, 1f) * (rc.height() - 6 * dp)
        val t = f.terrain
        if (t != null && t.w > 1) {
            path.rewind()
            val step = max(1, t.w / 160)
            var x = 0; var first = true
            while (x < t.w) { val px = mx(x.toFloat()); val py = my(t.surface[x].toFloat()); if (first) { path.moveTo(px, py); first = false } else path.lineTo(px, py); x += step }
            line.color = 0xFF9B6240.toInt(); c.drawPath(path, line)
        }
        var i = 0
        val pv = f.preview
        fill.color = ink
        while (i + 1 < pv.size) { c.drawCircle(mx(pv[i].toFloat()), my(pv[i + 1].toFloat()), 1.5f * dp, fill); i += 4 }
        for (k in f.castles) {
            val x = mx(k.x + k.cols * k.block / 2f); val y = my(k.baseY.toFloat()); val s = 6 * dp
            fill.color = if (k.side == 0) blue else orange
            if (k.side == 0) c.drawRect(x - s, y - 2 * s, x + s, y, fill)
            else { path.rewind(); path.moveTo(x, y - 2.4f * s); path.lineTo(x + 1.2f * s, y - s * 1.2f); path.lineTo(x, y); path.lineTo(x - 1.2f * s, y - s * 1.2f); path.close(); c.drawPath(path, fill) }
        }
        for (g in f.ghosts) if (g.hasPin) {
            fill.color = if (g.side == 0) blue else orange
            val x = mx(g.pinX.toFloat()); val y = my(g.pinY.toFloat()) - 3 * dp
            if (g.side == 0) c.drawCircle(x, y, 3 * dp, fill) else { c.save(); c.rotate(45f, x, y); c.drawRect(x - 2.6f * dp, y - 2.6f * dp, x + 2.6f * dp, y + 2.6f * dp, fill); c.restore() }
        }
        fill.color = ink
        for (sh in f.shells) c.drawCircle(mx(sh.x.toFloat()), my(sh.y.toFloat()), 3 * dp, fill)
        line.color = ink; line.strokeWidth = 2 * dp
        bracket(c, rc, l1, pad, mw)
        if (l2 != null) bracket(c, rc, l2, pad, mw)
    }

    private fun bracket(c: Canvas, rc: RectF, l: Lens, pad: Float, mw: Float) {
        if (!l.live) return
        val span = rc.width() - 2 * pad
        val x0 = rc.left + pad + l.wx(l.rect.left).coerceIn(0f, mw) / mw * span; val x1 = rc.left + pad + l.wx(l.rect.right).coerceIn(0f, mw) / mw * span; val t = rc.top + 4 * dp; val b = rc.bottom - 4 * dp; val k = 5 * dp
        c.drawLine(x0, t, x0, b, line); c.drawLine(x0, t, x0 + k, t, line); c.drawLine(x0, b, x0 + k, b, line)
        c.drawLine(x1, t, x1, b, line); c.drawLine(x1, t, x1 - k, t, line); c.drawLine(x1, b, x1 - k, b, line)
    }

    companion object {
        /** Cells per terrain bitmap pixel on each axis. */
        const val DS = 2
        /** Terrain material code to colour (content/materials.json order). */
        private val MAT = intArrayOf(
            0x00000000, 0xFF9B6240.toInt(), 0xFFB5734A.toInt(), 0xFF8E8A85.toInt(),
            0xFF4F4744.toInt(), 0xFF6E5236.toInt(), 0xCC4FA3D9.toInt(), 0xFF9B6240.toInt(),
        )
    }
}

package games.castleprotect.battle

import games.castleprotect.core.Text

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
import games.castleprotect.core.Ghost
import games.castleprotect.core.Hob
import games.castleprotect.core.Phase
import games.castleprotect.core.Terrain
import games.castleprotect.core.TerrainStrata
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Canvas drawing of one frame through a Lens (Part 2 Plates 1, 2 & 3 visual redesign).
 * Pure view code: reads the frame and never writes game state.
 * - Dark espresso ink (#2C221E), opaque cutaway walking forts on 3 planted Stomper legs,
 *   double-weight outer silhouette contours, atmospheric haze over distant hills,
 *   painterly stratified earth, Round-vs-Flat Flattener enemy silhouettes, handcrafted
 *   Boss 1-10 & Rescue 1-7 props, and a 2-pin-per-side visual cap.
 *
 * Per frame it allocates nothing on the common path (review H8, review 2 N-M8).
 */
class BattleRenderer(private val sprites: Sprites, private val dp: Float, val fx: FieldFx) {
    // Part 2 Design System palette
    private val ink = 0xFF2C221E.toInt()
    private val blue = 0xFF2F6FDE.toInt(); private val orange = 0xFFE8730C.toInt()
    private val nookBack = 0xFF3B2D24.toInt(); private val nookWainscot = 0xFF4F3D31.toInt()
    private val lanternGlow = 0x48FFCE70.toInt(); private val glazeTint = 0x2EFFF4DE.toInt()
    private val brassHi = 0xFFFFE08A.toInt(); private val brassMid = 0xFFFFC23D.toInt()
    private val brassLo = 0xFFC88A2E.toInt(); private val brassDeep = 0xFF8C5A14.toInt()
    private val slate = 0xFF5A6572.toInt(); private val slateDark = 0xFF3D4652.toInt(); private val slateLight = 0xFF83909F.toInt()
    private val levelBubble = 0xFF4ADE80.toInt()
    private val hedgeDark = 0xFF265C36.toInt(); private val hedgeMid = 0xFF3A7D44.toInt(); private val hedgeLight = 0xFF5FA652.toInt()

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = ink; strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
    private val bmp = Paint(Paint.FILTER_BITMAP_FLAG)
    private val terrainPaint = Paint() // no filtering: crisp painterly cells
    private val path = Path()
    private val hillPath = Path()
    private val r = RectF()
    private val boxRect = RectF()
    private val mtx = Matrix()
    private var sky: LinearGradient? = null; private var skyH = 0f
    private var haze: LinearGradient? = null; private var hazeH = 0f
    private var time = 0f
    private val ghostDash = DashPathEffect(floatArrayOf(8 * dp, 6 * dp), 0f)
    private val visPins = IntArray(4)

    // Sprite tables built once per sprites.generation.
    private class Looks(val gen: Int, val sp: Sprites.Sprite?)
    private class HobLook(
        val gen: Int, val idle: Array<Sprites.Sprite?>, val aim: Array<Sprites.Sprite?>,
        val fire: Sprites.Sprite?, val bonked: Array<Sprites.Sprite?>, val cheer: Array<Sprites.Sprite?>,
        val k: Float, val isFlattenerArt: Boolean = false,
    )
    private val shellSprites = HashMap<String, Sprites.Sprite?>()
    private var tableGen = -1
    private var dotP1: Sprites.Sprite? = null; private var dotP2: Sprites.Sprite? = null
    private var pinP1: Sprites.Sprite? = null; private var pinP2: Sprites.Sprite? = null
    private var kettleFull: Sprites.Sprite? = null; private var kettleHurt: Sprites.Sprite? = null
    private var kettleCrit: Sprites.Sprite? = null; private var kettlePopped: Sprites.Sprite? = null; private var kettleHalo: Sprites.Sprite? = null
    private var nookSp: Sprites.Sprite? = null; private var kettleRoomSp: Sprites.Sprite? = null
    private var nookBackSp: Sprites.Sprite? = null; private var nookGlazeSp: Sprites.Sprite? = null
    private var flagBlue: Sprites.Sprite? = null; private var flagOrange: Sprites.Sprite? = null
    private var skySp: Sprites.Sprite? = null; private var farSp: Sprites.Sprite? = null; private var nearSp: Sprites.Sprite? = null
    private val roundLabels = Array(41) { it.toString() }

    // Optional Part 2 handcrafted prop sprites (fall back to detailed Canvas vectors when absent).
    private var propRollerSp: Sprites.Sprite? = null
    private var propShearsSp: Sprites.Sprite? = null
    private var propCageBarSp: Sprites.Sprite? = null
    private var propRescueHettySp: Sprites.Sprite? = null
    private var propPeacockSp: Sprites.Sprite? = null
    private var propSprinklerRootSp: Sprites.Sprite? = null
    private var propLawnSignSp: Sprites.Sprite? = null

    private fun tables() {
        val g = sprites.generation
        if (g == tableGen) return
        tableGen = g
        shellSprites.clear()
        dotP1 = sprites.get("fx_ghost_dot_p1"); dotP2 = sprites.get("fx_ghost_dot_p2")
        pinP1 = sprites.get("fx_pin_p1"); pinP2 = sprites.get("fx_pin_p2")
        kettleFull = sprites.get("kettle_full"); kettleHurt = sprites.get("kettle_hurt")
        kettleCrit = sprites.get("kettle_critical"); kettlePopped = sprites.get("kettle_popped"); kettleHalo = sprites.get("kettle_halo")
        nookSp = sprites.get("nook"); kettleRoomSp = sprites.get("kettle_room")
        nookBackSp = sprites.get("fort_nook_backing"); nookGlazeSp = sprites.get("fort_nook_glaze")
        flagBlue = sprites.get("flag_blue"); flagOrange = sprites.get("flag_orange")
        skySp = sprites.get("bg_downs_sky"); farSp = sprites.get("bg_downs_hills_far"); nearSp = sprites.get("bg_downs_hills_near")
        for (i in 0..2) { dotPulse[i] = sprites.get("fx_ghost_dot_p1_pulse_$i"); dotPulse[3 + i] = sprites.get("fx_ghost_dot_p2_pulse_$i") }
        stomperBlue = sprites.get("stomper_blue_0"); stomperOrange = sprites.get("stomper_orange_0")
        flapSp[0] = sprites.get("loophole_flap_blue"); flapSp[1] = sprites.get("loophole_flap_orange")
        lidUp = sprites.get("pot_lid_raise_2")
        for (i in 0..3) steam[i] = sprites.get("fx_kettle_steam_$i")
        // Optional Part 2 handcrafted prop sprites (never use shell_marble / timber block substitutes!).
        propRollerSp = sprites.get("prop_big_smoothie_jr", "prop_roller")
        propShearsSp = sprites.get("prop_shears")
        propCageBarSp = sprites.get("prop_cage_bar")
        propRescueHettySp = sprites.get("prop_rescue_cage_hetty")
        propPeacockSp = sprites.get("prop_topiary_peacock_crest")
        propSprinklerRootSp = sprites.get("prop_sprinkler_root")
        propLawnSignSp = sprites.get("prop_lawn_sign")
    }
    private val flapSp = arrayOfNulls<Sprites.Sprite>(2)
    private var lidUp: Sprites.Sprite? = null
    private val steam = arrayOfNulls<Sprites.Sprite>(4)
    private var stomperBlue: Sprites.Sprite? = null; private var stomperOrange: Sprites.Sprite? = null

    val animating: Boolean get() = fx.busy
    /** [dt] in seconds of view time. */
    fun tick(dt: Float) { time += dt }
    private val shift = FloatArray(3)
    private val dotPulse = arrayOfNulls<Sprites.Sprite>(6)

    // ---- terrain bitmap (painterly stratified earth) ------------------------

    private var terrainBmp: Bitmap? = null
    private var terrainOf: Terrain? = null
    private val dirty = ArrayList<IntArray>()
    private var rowBuf = IntArray(0)

    /** Copies changed terrain into the bitmap with deterministic painterly earth strata (zero per-frame allocs). */
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
                    for (px in px0 until px1) {
                        val cx = min(t.w - 1, px * DS)
                        val mat = t.cells[rowOff + cx].toInt() and 7
                        val depth = (cy - t.surface[cx]).coerceAtLeast(0)
                        rowBuf[px - px0] = TerrainStrata.colorAt(mat, cx, cy, depth)
                    }
                    b.setPixels(rowBuf, 0, px1 - px0, px0, py, px1 - px0, 1)
                }
            }
        }
    }

    private fun drawTerrain(c: Canvas, l: Lens, f: Frame) {
        val b = terrainBmp
        val t = f.terrain
        if (b == null || t == null) {
            fill.color = 0xFF935D3A.toInt(); c.drawRect(l.rect.left, l.sy(f.groundAt(0).toFloat()), l.rect.right, l.rect.bottom, fill)
            return
        }
        mtx.setScale(l.scale * DS, l.scale * DS)
        mtx.postTranslate(l.sx(0f), l.sy(0f))
        c.drawBitmap(b, mtx, terrainPaint)
        // Lush layered meadow grass cap with espresso underline along visible surface columns.
        val x0 = l.wx(l.rect.left).toInt().coerceIn(0, t.w - 1); val x1 = l.wx(l.rect.right).toInt().coerceIn(0, t.w - 1)
        if (x1 <= x0) return
        val stepCells = max(1, (3f * dp / l.scale).toInt())
        path.rewind()
        t.lock {
            var x = x0
            var started = false
            while (x <= x1) {
                val y = t.surface[x]
                if (y < t.h) {
                    val sx = l.sx(x.toFloat()); val sy = l.sy(y.toFloat())
                    if (!started) { path.moveTo(sx, sy); started = true } else path.lineTo(sx, sy)
                } else started = false
                x += stepCells
            }
        }
        line.pathEffect = null
        val grassW = max(3.5f * dp, 5.2f * l.scale)
        // Dark espresso edge under the grass sod for figure-ground crispness
        c.save(); c.translate(0f, max(1.2f * dp, 1.4f * l.scale))
        line.color = ink; line.strokeWidth = grassW + 1.6f * dp; c.drawPath(path, line)
        c.restore()
        // Mid meadow grass body
        line.color = 0xFF5FA652.toInt(); line.strokeWidth = grassW; c.drawPath(path, line)
        // Sunlit top grass ridge
        c.save(); c.translate(0f, -max(0.8f * dp, 0.9f * l.scale))
        line.color = 0xFF8CD66E.toInt(); line.strokeWidth = max(1.4f * dp, 1.8f * l.scale); c.drawPath(path, line)
        c.restore()
    }

    // ---- background & atmospheric depth ------------------------------------

    private fun band(c: Canvas, sp: Sprites.Sprite, rc: RectF, bottom: Float, h: Float, shift: Float) {
        sp.usedAt = stamp
        val w = h * sp.meta.w / sp.meta.h
        if (w < 1f) return
        var x = rc.left - (((shift % w) + w) % w)
        while (x < rc.right) {
            boxRect.set(x, bottom - h, x + w + 1f, bottom)
            sprites.drawBox(c, sp, boxRect, r, bmp)
            x += w
        }
    }

    /** Procedural rolling Puddingstone Downs hill layer when parallax PNGs are not loaded. */
    private fun drawFallbackHills(c: Canvas, rc: RectF, baseY: Float, amp: Float, period: Float, shiftX: Float, col: Int) {
        hillPath.rewind()
        hillPath.moveTo(rc.left, rc.bottom)
        val steps = 20
        val dx = rc.width() / steps
        for (i in 0..steps) {
            val sx = rc.left + i * dx
            val t = (sx + shiftX) / max(1f, period)
            val wy = baseY - amp * (0.55f + 0.35f * sin(t) + 0.15f * cos(t * 1.9f))
            hillPath.lineTo(sx, wy)
        }
        hillPath.lineTo(rc.right, rc.bottom)
        hillPath.close()
        fill.color = col
        c.drawPath(hillPath, fill)
    }

    fun drawEmpty(c: Canvas) { c.drawColor(0xFFA5D8EC.toInt()) }

    /** Draw time for [Sprites.Sprite.usedAt], so a low memory trim keeps what is on screen. */
    private var stamp = 0L

    /** Zero-allocation lookup of the last 2 ghosts with Pins per side (Plate 2 visual cap). */
    private fun fillVisiblePins(ghosts: List<Ghost>) {
        visPins[0] = -1; visPins[1] = -1; visPins[2] = -1; visPins[3] = -1
        var c0 = 0; var c1 = 0
        for (i in ghosts.indices.reversed()) {
            val g = ghosts[i]
            if (!g.hasPin) continue
            if (g.side == 0 && c0 < MAX_PINS_PER_SIDE) { visPins[c0++] = i }
            else if (g.side == 1 && c1 < MAX_PINS_PER_SIDE) { visPins[2 + c1++] = i }
            if (c0 >= MAX_PINS_PER_SIDE && c1 >= MAX_PINS_PER_SIDE) break
        }
    }

    private fun isVisiblePinIndex(idx: Int): Boolean =
        idx == visPins[0] || idx == visPins[1] || idx == visPins[2] || idx == visPins[3]

    fun drawLens(c: Canvas, l: Lens, f: Frame, me: Int, drag: FloatArray?, readout: String?, shake: FloatArray? = null) {
        tables()
        stamp = Sprites.now()
        val rc = l.rect
        c.save(); c.clipRect(rc)
        // Screen shake moves the field only (the HUD is Compose, above): offset and roll, capped.
        if (shake != null && (shake[0] != 0f || shake[1] != 0f || shake[2] != 0f)) {
            c.translate(shake[0] * games.castleprotect.game.Juice.CAP_DP * dp, shake[1] * games.castleprotect.game.Juice.CAP_DP * dp)
            c.rotate(shake[2] * games.castleprotect.game.Juice.ROLL_DEG, rc.centerX(), rc.centerY())
        }
        val sk = skySp
        if (sk != null) { sk.usedAt = stamp; boxRect.set(rc); sprites.drawBox(c, sk, boxRect, r, bmp) }
        else {
            if (sky == null || skyH != rc.height()) { skyH = rc.height(); sky = LinearGradient(0f, 0f, 0f, skyH, 0xFF9AD3EA.toInt(), 0xFFE3F4F0.toInt(), Shader.TileMode.CLAMP) }
            c.save(); c.translate(0f, rc.top); fill.shader = sky; c.drawRect(rc.left, 0f, rc.right, rc.height(), fill); fill.shader = null; c.restore()
        }
        val horizon = l.sy(f.groundAt(l.cx.toInt()).toFloat()).coerceIn(rc.top + rc.height() * 0.45f, rc.bottom)
        val fSp = farSp
        if (fSp != null) band(c, fSp, rc, horizon + 6 * dp, rc.height() * 0.42f, l.cx * l.scale * 0.25f)
        else drawFallbackHills(c, rc, horizon + 8 * dp, rc.height() * 0.24f, 220f * dp, l.cx * l.scale * 0.22f, 0xFF96C1B5.toInt())
        // Cool sky-tint atmospheric haze wash (15-22% sky tint) to push distant hills back behind warm forts (Plate 1).
        val hazeBandH = max(1f, horizon - rc.top + 16 * dp)
        if (haze == null || hazeH != hazeBandH) {
            hazeH = hazeBandH
            haze = LinearGradient(0f, 0f, 0f, hazeBandH, 0x00A5D8EC, 0x36CAE9F5, Shader.TileMode.CLAMP)
        }
        c.save(); c.translate(0f, rc.top); fill.shader = haze; c.drawRect(rc.left, 0f, rc.right, hazeBandH, fill); fill.shader = null; c.restore()

        val nSp = nearSp
        if (nSp != null) band(c, nSp, rc, horizon + 14 * dp, rc.height() * 0.30f, l.cx * l.scale * 0.5f)
        else drawFallbackHills(c, rc, horizon + 12 * dp, rc.height() * 0.14f, 160f * dp, l.cx * l.scale * 0.45f, 0xFF7CB66E.toInt())
        // Subtle second veil over near hills so forts pop cleanly
        fill.color = 0x18D8EFF7; c.drawRect(rc.left, rc.top, rc.right, horizon + 14 * dp, fill)

        drawTerrain(c, l, f)
        // Boss 1-10 "Keep off the grass" hill sign near the central ridge
        if (f.level == "1-10" || f.hud.boss != null) {
            val signWx = (f.hud.boss?.roller?.x?.toFloat() ?: (f.mapW * 0.5f)) + 56f
            val signWy = f.groundAt(signWx.toInt()).toFloat()
            drawLawnSign(c, l, signWx, signWy)
        }

        val ks = f.castles
        for (ki in ks.indices) drawCastle(c, l, f, ks[ki])

        // Ghost lines and Pins capped to the most recent 2 per side so Round 10 Fatigue never crowds the fort (Plate 2).
        fillVisiblePins(f.ghosts)
        line.strokeWidth = 1.5f * dp
        line.pathEffect = ghostDash
        for (gi in f.ghosts.indices) {
            val g = f.ghosts[gi]
            if (g.hasPin && !isVisiblePinIndex(gi)) continue
            val p = g.points
            if (p.size < 4) continue
            path.rewind(); path.moveTo(l.sx(p[0].toFloat()), l.sy(p[1].toFloat()))
            var i = 2; while (i + 1 < p.size) { path.lineTo(l.sx(p[i].toFloat()), l.sy(p[i + 1].toFloat())); i += 2 }
            line.color = ink; line.alpha = if (g.side == f.side) 110 else 50
            c.drawPath(path, line)
        }
        line.pathEffect = null; line.alpha = 255
        val wl = l.wx(rc.left) - 20; val wr = l.wx(rc.right) + 20
        for (gi in f.ghosts.indices) {
            if (!isVisiblePinIndex(gi)) continue
            val g = f.ghosts[gi]
            if (!g.hasPin || g.pinX < wl || g.pinX > wr) continue
            val drop = fx.pinClip(g)?.let { fx.spriteOf(it) }
            if (drop != null) {
                val hPx = 28f * dp; val u = hPx / 30f
                boxRect.set(l.sx(g.pinX.toFloat()) - 6f * u, l.sy(g.pinY.toFloat()) - 29.5f * u, l.sx(g.pinX.toFloat()) + 6f * u, l.sy(g.pinY.toFloat()) + 0.5f * u)
                sprites.drawBox(c, drop, boxRect, r, bmp)
            } else drawPin(c, l.sx(g.pinX.toFloat()), l.sy(g.pinY.toFloat()), g.side, g.round, g.recalled)
        }

        // Preview dots for the side in Plan.
        val dot = if (f.side == 0) dotP1 else dotP2
        var i = 0
        val pv = f.preview
        while (i + 1 < pv.size) {
            val px = l.sx(pv[i].toFloat()); val py = l.sy(pv[i + 1].toFloat())
            val pt = ((time * 1000f - i / 2 * 60f) % 420f + 420f) % 420f
            val pulse = if (reduceMotion) null else dotPulse[(if (f.side == 0) 0 else 3) + if (pt < 140f) 0 else if (pt < 260f) 1 else 2]
            if (pulse != null) spriteAt(c, pulse, px, py, 8f * dp)
            else if (dot != null) spriteAt(c, dot, px, py, 8f * dp)
            else { fill.color = Color.WHITE; c.drawCircle(px, py, 3.2f * dp, fill); line.color = ink; line.strokeWidth = 1.2f * dp; c.drawCircle(px, py, 3.2f * dp, line) }
            i += 2
        }

        // Props: crocks, turnips, 1-7 rescue cage & captive Hetty, 1-10 Big Smoothie Jr. roller and Topiary Shears.
        val props = f.props
        var cageUp = false
        for (pi in props.indices) if (props[pi].kind == "cage_bar") { cageUp = true; break }
        for (pi in props.indices) drawProp(c, l, props[pi], cageUp)
        f.hud.boss?.let { b ->
            if (b.roller != null && !hasProp(props, b.roller.id)) drawProp(c, l, b.roller, false)
            if (b.shears != null && !hasProp(props, b.shears.id)) drawProp(c, l, b.shears, false)
            // The red cut line, shown one boss turn before the snip.
            val cut = b.cut
            if (cut != null && cut.size >= 4) {
                line.pathEffect = ghostDash; line.color = 0xFFC9363E.toInt(); line.strokeWidth = 3f * dp
                c.drawRect(l.sx(cut[0].toFloat()), l.sy(cut[1].toFloat()), l.sx(cut[2] + 1f), l.sy(cut[3] + 1f), line)
                line.pathEffect = null
            }
        }

        // Shells in flight.
        for (si in f.shells.indices) {
            val sh = f.shells[si]
            val px = l.sx(sh.x.toFloat()); val py = l.sy(sh.y.toFloat()); val rad = max(4f * dp, 4f * l.scale)
            val sp = shellSprite(sh.shot)
            if (sp != null) {
                c.save(); c.rotate(-sh.rot / 10f, px, py)
                spriteAt(c, sp, px, py, max(12f * dp, sp.meta.h * l.scale)); c.restore()
            } else { fill.color = ink; c.drawCircle(px, py, rad, fill); fill.color = brassMid; c.drawCircle(px + rad * 0.6f, py - rad * 0.7f, rad * 0.35f, fill) }
        }

        // Trails, impacts, booms, collapse pieces, rubble, dust, leaves, de-overlapped damage numbers.
        fx.draw(c, l, f)
        if (f.hud.squallRound > 0) fx.drawSquall(c, l)

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
            fill.color = brassMid; c.drawCircle(ex, ey, 4 * dp, fill); line.strokeWidth = 1.5f * dp; c.drawCircle(ex, ey, 4 * dp, line)
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

    @Volatile var reduceMotion = false
    /** The gold ring on the picked Hob teaches the owner rule (QA playtest 2, 4.1). Set by the view. */
    @Volatile var teachRing = false
    /** Highlighted own-fort block [c, r] when targeting Mendglob (Android-H5). */
    @Volatile var mendTarget: Pair<Int, Int>? = null
    @Volatile var mendSide: Int = -1

    private fun hasProp(props: List<games.castleprotect.core.Prop>, id: Int): Boolean { for (i in props.indices) if (props[i].id == id) return true; return false }

    // ---- Handcrafted Boss 1-10 & Rescue 1-7 Props (Plate 1 & 3) -------------

    private fun drawLawnSign(c: Canvas, l: Lens, wx: Float, wy: Float) {
        val sx = l.sx(wx); val sy = l.sy(wy)
        if (sx < l.rect.left - 80 || sx > l.rect.right + 80) return
        val sp = propLawnSignSp
        if (sp != null) { sprite(c, sp, l, wx, wy, 1f); return }
        val u = max(0.55f * dp, l.scale)
        val postH = 22f * u
        val bw = 34f * u; val bh = 16f * u
        // Wooden post
        fill.color = 0xFF7B4F2B.toInt()
        r.set(sx - 2.2f * u, sy - postH, sx + 2.2f * u, sy + 2f * u)
        c.drawRect(r, fill); line.color = ink; line.strokeWidth = max(1f, 1.3f * dp); c.drawRect(r, line)
        // Cream signboard
        r.set(sx - bw / 2f, sy - postH - bh + 2f * u, sx + bw / 2f, sy - postH + 2f * u)
        fill.color = 0xFFFAF3E3.toInt(); c.drawRoundRect(r, 3f * u, 3f * u, fill)
        c.drawRoundRect(r, 3f * u, 3f * u, line)
        if (bh >= 10f * dp) {
            text.color = ink; text.textSize = max(5.5f * dp, 5.2f * u)
            val (l1, l2) = signLines
            c.drawText(l1, sx, r.top + bh * 0.44f, text)
            c.drawText(l2, sx, r.top + bh * 0.84f, text)
        }
    }

    private fun drawProp(c: Canvas, l: Lens, p: games.castleprotect.core.Prop, cageUp: Boolean) {
        val px = l.sx(p.x.toFloat()); val py = l.sy(p.y.toFloat())
        if (px < l.rect.left - 120 || px > l.rect.right + 120) return
        val u = max(0.55f * dp, l.scale)
        when (p.kind) {
            "shell" -> {
                val sp = shellSprite(p.shot ?: "old_turnip")
                if (sp != null) spriteAt(c, sp, px, py, max(10f * dp, 14f * l.scale))
                else { fill.color = if (p.side == 0) blue else orange; c.drawCircle(px, py, max(4f * dp, 7f * l.scale), fill) }
            }
            "roller" -> {
                val sp = propRollerSp
                if (sp != null) spriteAt(c, sp, px, py - 14f * u, max(24f * dp, 44f * l.scale))
                else drawBigSmoothieJr(c, px, py, u)
            }
            "shears" -> {
                val sp = propShearsSp
                if (sp != null) spriteAt(c, sp, px, py, max(18f * dp, 30f * l.scale))
                else drawTopiaryShears(c, px, py, u)
            }
            "cage_bar" -> {
                val sp = propCageBarSp
                if (sp != null) {
                    sp.usedAt = stamp
                    boxRect.set(px - 4.5f * u, py - 24f * u, px + 4.5f * u, py + 4f * u)
                    sprites.drawBox(c, sp, boxRect, r, bmp)
                } else drawWroughtIronBar(c, px, py, u)
            }
            "captive" -> {
                val sp = propRescueHettySp
                if (sp != null && cageUp) spriteAt(c, sp, px, py - 22f * u, max(26f * dp, 52f * l.scale))
                else drawRescueCaptive(c, px, py, u, cageUp)
            }
            else -> {
                fill.color = if (p.side == 0) blue else if (p.side == 1) orange else 0xFF8A6A4A.toInt()
                c.drawCircle(px, py, max(4f * dp, 7f * l.scale), fill)
                line.color = ink; line.strokeWidth = 1.4f * dp; c.drawCircle(px, py, max(4f * dp, 7f * l.scale), line)
            }
        }
        // Small HP bar for breakable props.
        if (p.max > 0 && p.hp < p.max) {
            val w = max(18f * dp, 24f * l.scale)
            fill.color = ink; c.drawRect(px - w / 2, py + 4 * dp, px + w / 2, py + 7.5f * dp, fill)
            fill.color = 0xFFC9363E.toInt(); c.drawRect(px - w / 2, py + 4 * dp, px - w / 2 + w * p.hp / max(1, p.max), py + 7.5f * dp, fill)
        }
    }

    /** Vintage Big Smoothie Jr. Flattener steam roller on the hill (Plate 1 & 3). */
    private fun drawBigSmoothieJr(c: Canvas, px: Float, py: Float, u: Float) {
        val sw = max(1.4f * dp, 1.8f * u)
        // Ground contact shadow
        fill.color = 0x402C221E; r.set(px - 32f * u, py - 3f * u, px + 32f * u, py + 5f * u); c.drawOval(r, fill)
        // Front heavy iron roller drum (facing left toward player)
        fill.color = slateDark; c.drawCircle(px - 19f * u, py - 12f * u, 13f * u, fill)
        fill.color = slateLight; c.drawCircle(px - 21f * u, py - 14f * u, 7f * u, fill)
        fill.color = brassMid; c.drawCircle(px - 19f * u, py - 12f * u, 3.2f * u, fill)
        line.color = ink; line.strokeWidth = sw; c.drawCircle(px - 19f * u, py - 12f * u, 13f * u, line)
        // Riveted slate-grey boiler body
        r.set(px - 18f * u, py - 32f * u, px + 22f * u, py - 12f * u)
        fill.color = slate; c.drawRoundRect(r, 4f * u, 4f * u, fill)
        // Orange/crimson racing stripe + brass boiler straps
        fill.color = orange; c.drawRect(px - 16f * u, py - 24f * u, px + 20f * u, py - 19f * u, fill)
        fill.color = brassMid
        c.drawRect(px - 8f * u, py - 32f * u, px - 4.5f * u, py - 12f * u, fill)
        c.drawRect(px + 6f * u, py - 32f * u, px + 9.5f * u, py - 12f * u, fill)
        line.color = ink; line.strokeWidth = sw; c.drawRoundRect(r, 4f * u, 4f * u, line)
        // Smokestack chimney + puff
        r.set(px - 15f * u, py - 45f * u, px - 8f * u, py - 31f * u)
        fill.color = slateDark; c.drawRect(r, fill); c.drawRect(r, line)
        r.set(px - 17f * u, py - 48f * u, px - 6f * u, py - 44f * u)
        fill.color = brassMid; c.drawRoundRect(r, 1.5f * u, 1.5f * u, fill); c.drawRoundRect(r, 1.5f * u, 1.5f * u, line)
        if (!reduceMotion) {
            val puffY = py - 53f * u - ((time * 8f) % 6f) * u
            fill.color = 0xAAFFF4DE.toInt(); c.drawCircle(px - 11f * u, puffY, 4.5f * u, fill)
            c.drawCircle(px - 6f * u, puffY - 4f * u, 3.2f * u, fill)
        }
        // Rear cab canopy & spoked rear wheel
        r.set(px + 8f * u, py - 42f * u, px + 24f * u, py - 30f * u)
        fill.color = brassLo; c.drawRoundRect(r, 2f * u, 2f * u, fill); c.drawRoundRect(r, 2f * u, 2f * u, line)
        fill.color = slateDark; c.drawCircle(px + 16f * u, py - 11f * u, 11f * u, fill)
        fill.color = brassMid; c.drawCircle(px + 16f * u, py - 11f * u, 5f * u, fill)
        c.drawCircle(px + 16f * u, py - 11f * u, 11f * u, line)
    }

    /** Brass-hinged, orange-handled giant Topiary Shears on Boss 1-10 (Plate 1 & 3). */
    private fun drawTopiaryShears(c: Canvas, px: Float, py: Float, u: Float) {
        val sw = max(1.4f * dp, 1.7f * u)
        val open = if (reduceMotion) 14f else 14f + 7f * sin(time * 2.4f)
        // Two crossed steel blades
        for (sign in intArrayOf(-1, 1)) {
            c.save(); c.rotate(sign * open, px, py)
            path.rewind()
            path.moveTo(px, py - 3f * u)
            path.lineTo(px - 28f * u, py - 5f * u * sign)
            path.lineTo(px - 18f * u, py + 3.5f * u * sign)
            path.lineTo(px + 2f * u, py + 3f * u)
            path.close()
            fill.color = 0xFFD0D8E2.toInt(); c.drawPath(path, fill)
            line.color = ink; line.strokeWidth = sw; c.drawPath(path, line)
            // Orange-gripped handle
            r.set(px + 2f * u, py - 3.5f * u, px + 22f * u, py + 3.5f * u)
            fill.color = orange; c.drawRoundRect(r, 3.5f * u, 3.5f * u, fill)
            c.drawRoundRect(r, 3.5f * u, 3.5f * u, line)
            c.restore()
        }
        // Gleaming brass hinge rivet
        fill.color = brassMid; c.drawCircle(px, py, 5.2f * u, fill)
        fill.color = brassHi; c.drawCircle(px - 1.2f * u, py - 1.2f * u, 2f * u, fill)
        line.color = ink; line.strokeWidth = sw; c.drawCircle(px, py, 5.2f * u, line)
    }

    /** Ornate riveted wrought-iron bar for Level 1-7 Rescue Cage (Plate 3). */
    private fun drawWroughtIronBar(c: Canvas, px: Float, py: Float, u: Float) {
        val sw = max(1.2f * dp, 1.4f * u)
        val topY = py - 34f * u
        r.set(px - 2.6f * u, topY, px + 2.6f * u, py + 2f * u)
        fill.color = slateDark; c.drawRoundRect(r, 1.5f * u, 1.5f * u, fill)
        fill.color = slateLight; c.drawRect(px - 1.1f * u, topY + 2f * u, px + 0.3f * u, py, fill)
        line.color = ink; line.strokeWidth = sw; c.drawRoundRect(r, 1.5f * u, 1.5f * u, line)
        // Spear finial at top of bar
        path.rewind()
        path.moveTo(px, topY - 7f * u); path.lineTo(px + 4f * u, topY); path.lineTo(px - 4f * u, topY); path.close()
        fill.color = brassLo; c.drawPath(path, fill); c.drawPath(path, line)
    }

    /** Ornate hanging wrought-iron cage arch + brass ring with cheerful Hetty waving inside (Level 1-7, Plate 3). */
    private fun drawRescueCaptive(c: Canvas, px: Float, py: Float, u: Float, cageUp: Boolean) {
        val sw = max(1.4f * dp, 1.6f * u)
        if (cageUp) {
            // Ornate wrought-iron domed cage frame & brass hanging ring behind Hetty
            fill.color = 0x263B2D24; r.set(px - 22f * u, py - 40f * u, px + 22f * u, py + 2f * u)
            c.drawRoundRect(r, 16f * u, 16f * u, fill)
            line.color = slateDark; line.strokeWidth = max(2f * dp, 2.8f * u)
            c.drawRoundRect(r, 16f * u, 16f * u, line)
            // Horizontal iron cage bands
            line.color = ink; line.strokeWidth = sw
            c.drawLine(px - 22f * u, py - 24f * u, px + 22f * u, py - 24f * u, line)
            c.drawLine(px - 22f * u, py - 8f * u, px + 22f * u, py - 8f * u, line)
            // Brass hanging ring at dome apex
            line.color = brassMid; line.strokeWidth = max(2f * dp, 2.4f * u)
            c.drawCircle(px, py - 45f * u, 5f * u, line)
            line.color = ink; line.strokeWidth = sw * 0.7f
            c.drawCircle(px, py - 45f * u, 6.2f * u, line)
        }
        // Plump warm Hetty waving inside
        val hr = 9f * u
        val cy = py - hr * 1.4f
        val wave = if (reduceMotion) 0f else sin(time * 5f) * 3f * u
        // Waving arm
        line.color = ink; line.strokeWidth = max(2.2f * dp, 3f * u)
        c.drawLine(px + hr * 0.7f, cy, px + hr * 1.35f, cy - hr * 0.7f + wave, line)
        // Body & blue scarf
        fill.color = 0xFFD99A5B.toInt(); c.drawCircle(px, cy + hr * 0.5f, hr * 0.9f, fill)
        line.color = ink; line.strokeWidth = sw; c.drawCircle(px, cy + hr * 0.5f, hr * 0.9f, line)
        fill.color = blue; c.drawRoundRect(px - hr * 0.85f, cy + hr * 0.05f, px + hr * 0.85f, cy + hr * 0.45f, 2f * u, 2f * u, fill)
        // Warm rosy face
        fill.color = 0xFFF2C9A0.toInt(); c.drawCircle(px, cy - hr * 0.45f, hr * 0.78f, fill)
        c.drawCircle(px, cy - hr * 0.45f, hr * 0.78f, line)
        // Mortarboard patcher cap
        r.set(px - hr * 0.95f, cy - hr * 1.35f, px + hr * 0.95f, cy - hr * 0.95f)
        fill.color = 0xFF6B4C35.toInt(); c.drawRoundRect(r, 2f * u, 2f * u, fill); c.drawRoundRect(r, 2f * u, 2f * u, line)
    }

    private fun shellSprite(shot: String): Sprites.Sprite? {
        if (shellSprites.containsKey(shot)) return shellSprites[shot]
        val sp = sprites.get("shell_$shot", "shell_clodpot")
        shellSprites[shot] = sp
        return sp
    }

    /** Draws a sprite with its manifest anchor on the world point (wx, wy), honoring --v2 trim & overlays. */
    private fun sprite(c: Canvas, sp: Sprites.Sprite, l: Lens, wx: Float, wy: Float, k: Float = 1f, flip: Boolean = false) {
        sp.usedAt = stamp
        sprites.drawAnchored(c, sp, l.sx(wx), l.sy(wy), k * l.scale, flip, r, bmp)
    }

    /** Draws a sprite centred on a screen point at a given screen height, honoring --v2 trim & overlays. */
    private fun spriteAt(c: Canvas, sp: Sprites.Sprite, x: Float, y: Float, hPx: Float) {
        sp.usedAt = stamp
        sprites.drawCentered(c, sp, x, y, hPx, r, bmp)
    }

    /** Draws a sprite into a world box [x0, y0, x1, y1] (inclusive cells), honoring --v2 trim. */
    private fun spriteBox(c: Canvas, sp: Sprites.Sprite, l: Lens, box: IntArray) {
        sp.usedAt = stamp
        if (box.size < 4) return
        boxRect.set(l.sx(box[0].toFloat()), l.sy(box[1].toFloat()), l.sx(box[2] + 1f), l.sy(box[3] + 1f))
        sprites.drawBox(c, sp, boxRect, r, bmp)
    }

    private fun matColor(m: String) = when (m) {
        "wicker" -> 0xFFE3B565.toInt(); "timber" -> 0xFFB9733A.toInt(); "cobble" -> 0xFFA9A39A.toInt()
        "footing" -> 0xFF5A4A42.toInt(); else -> 0xFF6B7A86.toInt()
    }

    private fun blockSprite(b: Block): Sprites.Sprite? {
        val cached = b.look as? Looks
        if (cached != null && cached.gen == tableGen) { cached.sp?.usedAt = stamp; return cached.sp }
        val wear = if (b.battered) "battered" else if (b.hp < b.max) "scuffed" else "fresh"
        val sp = sprites.get("block_${b.mat}_$wear", "block_${b.mat}_fresh")
        b.look = Looks(tableGen, sp)
        return sp
    }

    /**
     * True when [h] is drawn as a Flattener: the Neat Brigade units, or a Hob on the game's side
     * that has no Rival look. Player-class Hobs on the Rival side wear `hob_<name>_rival_*`.
     */
    private fun isFlattener(f: Frame, h: Hob): Boolean {
        if (h.dummy) return false
        if (h.def in FLATTENER_DEFS) return true
        return h.side == 1 && !f.hud.human(1) && !fx.hasAnim("hob_${Sprites.hobKey(h.def)}_rival_idle")
    }

    /** The lawn sign's words (`hud.signs`, the first is the 1-10 sign), split over two lines. */
    private val signLines: Pair<String, String> by lazy {
        val w = (Text.list("hud.signs").firstOrNull() ?: "").split(' ')
        val half = (w.size + 1) / 2
        w.take(half).joinToString(" ") to w.drop(half).joinToString(" ")
    }

    private fun hobLook(h: Hob, team: String, flattener: Boolean): HobLook {
        val cached = h.look as? HobLook
        if (cached != null && cached.gen == tableGen && cached.isFlattenerArt == flattener) return cached
        if (flattener) {
            val fk = Sprites.flattenerKey(h.def, h.cls)
            val base = "flattener_${fk}_"
            val idle = Array(3) { sprites.get("${base}idle_$it") }
            val look = HobLook(
                tableGen, idle,
                Array(2) { sprites.get("${base}aim_$it") }, sprites.get("${base}fire_1") ?: sprites.get("${base}fire_0"),
                Array(2) { sprites.get("${base}bonked_$it") }, Array(2) { sprites.get("${base}cheer_$it") },
                28f / (idle[0]?.meta?.h ?: 80f),
                isFlattenerArt = true,
            )
            h.look = look
            return look
        }
        val key = Sprites.hobKey(h.def)
        val base = "hob_${key}_${team}_"
        val idle = Array(3) { sprites.get("${base}idle_$it") }
        val look = HobLook(
            tableGen, idle,
            Array(2) { sprites.get("${base}aim_$it") }, sprites.get("${base}fire_1"),
            Array(2) { sprites.get("${base}bonked_$it") }, Array(2) { sprites.get("${base}cheer_$it") },
            28f / (idle[0]?.meta?.h ?: 80f),
            isFlattenerArt = false,
        )
        h.look = look
        return look
    }

    // ---- Opaque Cutaway Walking Fort (Plate 1, 2 & 3) -----------------------

    private fun drawCastle(c: Canvas, l: Lens, f: Frame, k: Castle) {
        val col = if (k.side == 0) blue else orange
        val team = Sprites.team(k.side, f.hud.human(k.side))
        line.pathEffect = null
        val bs = k.block.toFloat()
        val fortW = k.cols * bs
        val fortCenterWx = k.x + fortW * 0.5f

        // A walking fort: slides from the old place and bobs on its 3 Stomper legs.
        fx.fortShift(k.side, shift)
        val walking = shift[0] != 0f || shift[1] != 0f || shift[2] != 0f

        // Ground contact shadow beneath the fort & planted Stomper feet (figure-ground grounding).
        val shCx = l.sx(fortCenterWx + shift[0])
        val shCy = l.sy(k.baseY.toFloat() + 14f)
        fill.color = 0x422C221E
        r.set(shCx - fortW * 0.56f * l.scale, shCy - 5f * l.scale, shCx + fortW * 0.56f * l.scale, shCy + 6f * l.scale)
        c.drawOval(r, fill)

        if (walking) {
            c.save()
            c.translate(shift[0] * l.scale, shift[1] * l.scale)
            c.rotate(shift[2], l.sx(fortCenterWx), l.sy(k.baseY.toFloat()))
        }

        // 3 planted Stomper legs (ALWAYS visible at rest AND animated when walking! Plate 1 & 2).
        drawStomperLegs(c, l, k, walking)

        // Boss 1-10 sculpted clipped-hedge Topiary Peacock crest & fanned tail behind upper parapet.
        val isBossFort = k.side == 1 && (f.level == "1-10" || f.hud.boss != null)
        if (isBossFort) drawTopiaryPeacockCrest(c, l, k)

        val left = l.rect.left; val right = l.rect.right
        val blocks = k.blocks
        val outerStroke = max(2.2f * dp, 2.8f * l.scale)

        // Pass 1: Double-weight dark espresso outer silhouette contour around entire standing fort!
        fill.color = ink
        for (bi in blocks.indices) {
            val b = blocks[bi]
            r.set(l.sx(b.x.toFloat()) - outerStroke, l.sy(b.y.toFloat()) - outerStroke, l.sx(b.x + bs) + outerStroke, l.sy(b.y + bs) + outerStroke)
            if (r.right < left || r.left > right) continue
            c.drawRoundRect(r, 2f * dp, 2f * dp, fill)
        }

        // Pass 2: Opaque recessed #3B2D24 lantern-lit cutaway room chambers (ZERO background bleed-through!).
        val ks = k.kettle
        if (ks != null && ks.room.size >= 4) {
            drawCutawayChamber(c, l, ks.room, isKettle = true, col = col)
            // Brass steam pipe descending from Heartkettle chamber into central Stomper manifold
            drawKettleSteamPipe(c, l, ks.room, k.baseY.toFloat())
        }
        val rooms = k.rooms
        for (ri in rooms.indices) {
            val room = rooms[ri]
            if (room.kind == "nook" && room.box.size >= 4) {
                drawCutawayChamber(c, l, room.box, isKettle = false, col = col)
            }
        }

        // Pass 3: Opaque 1.0f exterior walls, roofs, footing, and Boss 1-10 Sprinkler Root.
        val mt = if (k.side == mendSide) mendTarget else null
        for (bi in blocks.indices) {
            val b = blocks[bi]
            boxRect.set(l.sx(b.x.toFloat()), l.sy(b.y.toFloat()), l.sx(b.x + bs), l.sy(b.y + bs))
            if (boxRect.right < left || boxRect.left > right) continue
            val sp = blockSprite(b)
            if (sp != null) {
                sprites.drawBox(c, sp, boxRect, r, bmp)
                // Crisp subtle 1px interior grain line separating courses
                line.color = 0x552C221E; line.strokeWidth = max(0.8f, 0.9f * dp); c.drawRect(boxRect, line)
            } else {
                fill.color = matColor(b.mat); c.drawRect(boxRect, fill)
                line.color = ink; line.strokeWidth = max(1f, 1.2f * dp * min(1f, l.scale / dp + 0.3f)); c.drawRect(boxRect, line)
                if (b.hp < b.max) { fill.color = ink; fill.alpha = 70; c.drawRect(boxRect, fill); fill.alpha = 255 }
            }
            if (b.root) drawSprinklerRoot(c, l, boxRect)
            if (mt != null && b.c == mt.first && b.r == mt.second) { line.color = 0xFF4ADE80.toInt(); line.strokeWidth = 3f * dp; c.drawRect(boxRect, line) }
        }
        fx.drawShimmer(c, l, k, ghostDash)

        // Pass 4: Dark Loophole arches on the enemy-facing front edge + Flaps + Pot Lids.
        val sideIx = if (k.side == 1) 1 else 0
        for (ri in rooms.indices) {
            val room = rooms[ri]
            val lh = room.loophole
            if (room.kind == "nook" && room.intact && lh.size >= 4) {
                drawLoopholeArch(c, l, lh, col)
            }
            val flap = fx.flapClip(k.side, room.id)?.let { fx.spriteOf(it) } ?: if (room.flap) flapSp[sideIx] else null
            if (flap != null && lh.size >= 4) {
                flap.usedAt = stamp
                boxRect.set(l.sx(lh[0].toFloat()), l.sy(lh[1] - 5f), l.sx(lh[2] + 1f), l.sy(lh[3] + 6f))
                sprites.drawBox(c, flap, boxRect, r, bmp)
            }
            val lid = fx.lidClip(k.side, room.id)?.let { fx.spriteOf(it) } ?: if (room.lid) lidUp else null
            if (lid != null && room.box.size >= 4) spriteBox(c, lid, l, room.box)
        }
        if (ks != null && ks.room.size >= 4) {
            val lid = fx.kettleLidClip(k.side)?.let { fx.spriteOf(it) } ?: if (ks.lid) lidUp else null
            if (lid != null) spriteBox(c, lid, l, ks.room)
        }

        // Pass 5: Glowing copper Heartkettle.
        if (ks != null && ks.box.size >= 4) {
            val kx = l.sx((ks.box[0] + ks.box[2]) / 2f); val ky = l.sy((ks.box[1] + ks.box[3]) / 2f)
            val pct = f.hud.kettlePct.getOrElse(k.side) { 100 }
            val popClip = fx.kettleClip(k.side)
            val popName = popClip?.let { fx.spriteOf(it) }
            val sp = popName ?: if (!ks.intact || pct <= 0) kettlePopped else if (pct <= 25) kettleCrit else if (pct <= 50) kettleHurt else kettleFull
            if (sp != null) {
                if (ks.intact && popName == null) {
                    val halo = kettleHalo
                    if (halo != null) spriteAt(c, halo, kx, ky, 34f * l.scale * (1f + (if (reduceMotion) 0f else 0.06f * sin(time * 4f))))
                    else { fill.color = 0x384FE3C1; c.drawCircle(kx, ky, 15f * l.scale, fill) }
                }
                spriteAt(c, sp, kx, ky, (if (popName != null) 40f else 25f) * l.scale)
            } else if (ks.intact) {
                val kr = 10.5f * l.scale
                fill.color = 0x384FE3C1; c.drawCircle(kx, ky, kr * 1.45f, fill)
                fill.color = 0xFFD97834.toInt(); c.drawCircle(kx, ky, kr, fill)
                fill.color = brassMid; c.drawRect(kx - kr * 0.9f, ky - kr * 0.22f, kx + kr * 0.9f, ky + kr * 0.22f, fill)
                line.color = ink; line.strokeWidth = max(1.4f * dp, 1.8f * l.scale); c.drawCircle(kx, ky, kr, line)
                val coreCol = if (pct <= 25) 0xFFE5484D.toInt() else if (pct <= 50) brassMid else 0xFF4FE3C1.toInt()
                fill.color = coreCol; c.drawCircle(kx, ky, kr * (0.38f + (if (reduceMotion) 0f else 0.07f * sin(time * 4f))), fill)
                line.strokeWidth = max(1f, 1.1f * dp); c.drawCircle(kx, ky, kr * 0.42f, line)
            }
            if (ks.intact && pct in 1..25 && !reduceMotion) steam[(time * 1000f / 180f).toInt() % 4]?.let { st ->
                st.usedAt = stamp
                boxRect.set(kx - 8f * l.scale, ky - 36f * l.scale, kx + 8f * l.scale, ky - 12f * l.scale)
                sprites.drawBox(c, st, boxRect, r, bmp)
            }
        }

        // Pass 6: Crew units — Round warm Hobs vs Rigid rectilinear Slate-Grey Flatteners (Plate 3).
        val frame2 = (time * 2f).toInt()
        val hobs = f.hobs
        for (hi in hobs.indices) {
            val h = hobs[hi]
            if (h.side != k.side) continue
            val dy = fx.hobDy(h)
            val hx = l.sx(h.x.toFloat()); val hy = l.sy(h.y.toFloat() - dy)
            val selected = h.id == f.hud.selectedHob && f.side == k.side
            val hr = 9f * l.scale
            val flattener = isFlattener(f, h)
            val flat = h.squashed
            if (flat) { c.save(); c.scale(1.18f, 0.55f, hx, hy) }

            if (flattener) {
                val flook = hobLook(h, team, flattener = true)
                val fsp = when {
                    h.bonked -> flook.bonked[frame2 % 2]
                    selected && f.phase == Phase.PLAN -> flook.aim[frame2 % 2]
                    else -> flook.idle[(frame2 + h.id) % 3]
                } ?: flook.idle[0]
                if (fsp != null) {
                    sprite(c, fsp, l, h.x.toFloat(), h.y.toFloat() - dy, flook.k, flip = k.side == 1)
                } else {
                    drawProceduralFlattener(c, hx, hy, l.scale, h, flip = k.side == 1)
                }
            } else {
                val anim = fx.hobClip(h)
                val asp = anim?.let { fx.spriteOf(it) }
                if (anim != null && asp != null) {
                    sprites.drawAnchored(c, asp, hx, hy, HOB_K * l.scale, flip = k.side == 1, dst = r, paint = bmp)
                } else {
                    val look = hobLook(h, team, flattener = false)
                    val sp = when {
                        h.bonked -> look.bonked[frame2 % 2]
                        selected && f.phase == Phase.PLAN -> look.aim[frame2 % 2]
                        else -> look.idle[(frame2 + h.id) % 3]
                    } ?: look.idle[0]
                    if (sp != null) sprite(c, sp, l, h.x.toFloat(), h.y.toFloat() - dy, look.k, flip = k.side == 1)
                    else drawProceduralHob(c, hx, hy, hr, col, h)
                }
            }

            if (flat) { c.restore(); drawStars(c, hx, hy - 16f * l.scale, hr) }
            if (h.bonked) continue
            // Owner rule: pulsing gold ring on the picked Hob until 3 aims were started from the fort.
            if (teachRing && selected && f.phase == Phase.PLAN && f.hud.human(f.side)) {
                val pulse = if (reduceMotion) 0f else ((time * 1.6f) % 1f)
                line.color = brassMid; line.strokeWidth = 4f * dp; line.alpha = (255 * (1f - 0.5f * pulse)).toInt()
                c.drawCircle(hx, hy - 14f * l.scale, (24f + 10f * pulse) * l.scale, line); line.alpha = 255
            }
            if (selected && f.phase == Phase.PLAN) {
                line.color = brassMid; line.strokeWidth = 2.5f * dp; line.pathEffect = ghostDash
                c.drawCircle(hx, hy - 14f * l.scale, 19f * l.scale, line); line.pathEffect = null
            }
            if (h.hp < h.max) {
                val wbar = 22f * l.scale
                fill.color = ink; c.drawRect(hx - wbar / 2, hy + 2 * dp, hx + wbar / 2, hy + 5.5f * dp, fill)
                fill.color = 0xFF4ADE80.toInt(); c.drawRect(hx - wbar / 2, hy + 2 * dp, hx - wbar / 2 + wbar * h.hp / max(1, h.max), hy + 5.5f * dp, fill)
            }
        }

        // Pass 7: Subtle 0.18f cutaway window glaze over intact Nooks (Plate 1 & Section 3).
        for (ri in rooms.indices) {
            val room = rooms[ri]
            if (room.kind == "nook" && room.intact && room.box.size >= 4) {
                drawNookGlaze(c, l, room.box)
            }
        }

        // Pass 8: Team pennant flag on top of fort.
        val topY = k.topY.toFloat()
        val fx0 = k.x + if (k.side == 0) 6f else fortW - 6f
        val flag = if (k.side == 0) flagBlue else flagOrange
        if (flag != null) sprite(c, flag, l, fx0, topY, 1.45f, flip = k.side == 0)
        else {
            val sx = l.sx(fx0); val sy = l.sy(topY); val fh = 24f * l.scale; val dir = if (k.side == 0) -1f else 1f
            line.color = ink; line.strokeWidth = max(1.8f * dp, 2.2f * l.scale); c.drawLine(sx, sy, sx, sy - fh, line)
            path.rewind(); path.moveTo(sx, sy - fh); path.lineTo(sx + dir * fh * 0.72f, sy - fh * 0.86f)
            path.lineTo(sx + dir * fh * 0.52f, sy - fh * 0.74f); path.lineTo(sx + dir * fh * 0.72f, sy - fh * 0.60f); path.lineTo(sx, sy - fh * 0.54f); path.close()
            fill.color = col; c.drawPath(path, fill); line.strokeWidth = 1.4f * dp; c.drawPath(path, line)
        }
        if (walking) c.restore()
    }

    /** 3 mechanical brass-and-iron Stomper legs planted firmly beneath the fort (at rest and walking). */
    private fun drawStomperLegs(c: Canvas, l: Lens, k: Castle, walking: Boolean) {
        val fortW = k.cols * k.block.toFloat()
        val u = l.scale
        val sw = max(1.4f * dp, 1.7f * u)
        val legSpBase = if (k.side == 0) stomperBlue else stomperOrange
        for (leg in 0..2) {
            val frac = when (leg) { 0 -> 0.18f; 1 -> 0.50f; else -> 0.82f }
            val lx = l.sx(k.x + fortW * frac)
            val ly = l.sy(k.baseY.toFloat())
            val strideSp = if (walking) fx.legClip(k.side, leg % 2)?.let { fx.spriteOf(it) } else null
            val sp = strideSp ?: legSpBase
            if (sp != null && walking) {
                sp.usedAt = stamp
                val su = u * 1.1f
                boxRect.set(lx - 13f * su, ly - 4f * su, lx + 15f * su, ly + 22f * su)
                sprites.drawBox(c, sp, boxRect, r, bmp)
            } else {
                // Crisp riveted brass-piston mechanical Stomper leg planted firmly into ground
                val lift = if (walking && !reduceMotion) sin(time * 14f + leg * 2.1f) * 3.5f * u else 0f
                val footY = ly + 15f * u + lift
                // Upper dark iron strut
                r.set(lx - 4.2f * u, ly - 3f * u, lx + 4.2f * u, ly + 7f * u)
                fill.color = slateDark; c.drawRoundRect(r, 1.5f * u, 1.5f * u, fill)
                line.color = ink; line.strokeWidth = sw; c.drawRoundRect(r, 1.5f * u, 1.5f * u, line)
                // Brass knee piston
                fill.color = brassMid; c.drawCircle(lx, ly + 6f * u, 4.8f * u, fill)
                fill.color = brassHi; c.drawCircle(lx - 1.2f * u, ly + 4.8f * u, 1.8f * u, fill)
                c.drawCircle(lx, ly + 6f * u, 4.8f * u, line)
                // Lower piston rod
                r.set(lx - 2.6f * u, ly + 7f * u, lx + 2.6f * u, footY - 2f * u)
                fill.color = brassLo; c.drawRect(r, fill); c.drawRect(r, line)
                // Wide planted iron boot pad
                r.set(lx - 8.5f * u, footY - 4.5f * u, lx + 8.5f * u, footY + 1.5f * u)
                fill.color = if (k.side == 0) 0xFF3E4B5B.toInt() else slateDark
                c.drawRoundRect(r, 2.5f * u, 2.5f * u, fill)
                c.drawRoundRect(r, 2.5f * u, 2.5f * u, line)
            }
        }
    }

    /** Recessed opaque #3B2D24 room backing with warm wainscoting and soft lantern glow. */
    private fun drawCutawayChamber(c: Canvas, l: Lens, box: IntArray, isKettle: Boolean, col: Int) {
        val x0 = l.sx(box[0].toFloat()); val y0 = l.sy(box[1].toFloat())
        val x1 = l.sx(box[2] + 1f); val y1 = l.sy(box[3] + 1f)
        if (x1 < l.rect.left || x0 > l.rect.right) return
        boxRect.set(x0, y0, x1, y1)
        // Always fill opaque #3B2D24 first so sky/trees NEVER bleed through cutaway rooms!
        fill.color = nookBack; c.drawRect(boxRect, fill)
        val backSp = if (isKettle) kettleRoomSp else nookBackSp
        if (backSp != null) {
            sprites.drawBox(c, backSp, boxRect, r, bmp)
        } else {
            // Warm interior wood paneling & floorboards
            val w = x1 - x0; val h = y1 - y0
            fill.color = nookWainscot; c.drawRect(x0, y0 + h * 0.58f, x1, y1, fill)
            line.color = 0x552C221E; line.strokeWidth = max(0.8f, 1f * dp)
            c.drawLine(x0, y0 + h * 0.58f, x1, y0 + h * 0.58f, line)
            // Warm amber lantern glow radiating from ceiling lamp
            val cx = (x0 + x1) * 0.5f; val ly = y0 + h * 0.28f
            fill.color = lanternGlow; c.drawCircle(cx, ly + h * 0.14f, min(w, h) * 0.44f, fill)
            if (!isKettle) {
                fill.color = brassHi; c.drawCircle(cx, y0 + h * 0.16f, max(2f * dp, 2.5f * l.scale), fill)
                line.color = ink; line.strokeWidth = max(1f, 1.1f * dp); c.drawLine(cx, y0, cx, y0 + h * 0.12f, line)
            }
        }
        // Recessed interior shadow frame
        line.color = 0x88201714.toInt(); line.strokeWidth = max(1.4f * dp, 1.8f * l.scale)
        c.drawRect(boxRect, line)
    }

    /** Gleaming brass steam conduit pipe running from Heartkettle chamber down to the Stomper manifold. */
    private fun drawKettleSteamPipe(c: Canvas, l: Lens, room: IntArray, baseY: Float) {
        val cx = l.sx((room[0] + room[2] + 1f) * 0.5f)
        val y0 = l.sy((room[1] + room[3]) * 0.5f)
        val y1 = l.sy(baseY + 4f)
        if (y1 <= y0) return
        val pw = max(2.2f * dp, 3.2f * l.scale)
        r.set(cx - pw, y0, cx + pw, y1)
        fill.color = brassLo; c.drawRect(r, fill)
        fill.color = brassHi; c.drawRect(cx - pw * 0.55f, y0, cx - pw * 0.05f, y1, fill)
        line.color = ink; line.strokeWidth = max(1.1f * dp, 1.2f * l.scale); c.drawRect(r, line)
    }

    /** Dark recessed Loophole firing arch on the enemy-facing edge of each Nook. */
    private fun drawLoopholeArch(c: Canvas, l: Lens, lh: IntArray, teamCol: Int) {
        val x0 = l.sx(lh[0].toFloat()); val y0 = l.sy(lh[1].toFloat())
        val x1 = l.sx(lh[2] + 1f); val y1 = l.sy(lh[3] + 1f)
        val cx = (x0 + x1) * 0.5f
        val hw = max(3.5f * dp, (x1 - x0) * 0.55f)
        val hh = max(5.5f * dp, (y1 - y0) * 0.55f)
        val cy = (y0 + y1) * 0.5f
        r.set(cx - hw, cy - hh, cx + hw, cy + hh)
        fill.color = 0xFF211814.toInt(); c.drawRoundRect(r, hw, hw, fill)
        line.color = brassLo; line.strokeWidth = max(1.3f * dp, 1.6f * l.scale); c.drawRoundRect(r, hw, hw, line)
        // Small team dot rivet on lintel
        fill.color = teamCol; c.drawCircle(cx, r.top - 1.2f * dp, max(1.5f * dp, 1.8f * l.scale), fill)
    }

    /** Subtle 0.18f diagonal window glass sheen over cutaway Nooks. */
    private fun drawNookGlaze(c: Canvas, l: Lens, box: IntArray) {
        val x0 = l.sx(box[0].toFloat()); val y0 = l.sy(box[1].toFloat())
        val x1 = l.sx(box[2] + 1f); val y1 = l.sy(box[3] + 1f)
        if (x1 < l.rect.left || x0 > l.rect.right) return
        val gsp = nookGlazeSp
        if (gsp != null) {
            boxRect.set(x0, y0, x1, y1)
            sprites.drawBox(c, gsp, boxRect, r, bmp)
            return
        }
        val w = x1 - x0; val h = y1 - y0
        path.rewind()
        path.moveTo(x0 + w * 0.10f, y0 + h * 0.08f)
        path.lineTo(x0 + w * 0.44f, y0 + h * 0.08f)
        path.lineTo(x0 + w * 0.10f, y0 + h * 0.46f)
        path.close()
        fill.color = glazeTint
        c.drawPath(path, fill)
    }

    /** Boss 1-10 sculpted clipped-hedge Topiary Peacock crest & fanned tail (Plate 1). */
    private fun drawTopiaryPeacockCrest(c: Canvas, l: Lens, k: Castle) {
        val cxWx = k.x + k.cols * k.block * 0.5f
        val topWx = k.topY.toFloat()
        val sp = propPeacockSp
        if (sp != null) {
            sprite(c, sp, l, cxWx, topWx + 6f, 1.0f)
            return
        }
        val cx = l.sx(cxWx); val ty = l.sy(topWx)
        val u = l.scale
        val sw = max(1.6f * dp, 2.2f * u)
        // Fanned clipped-hedge peacock tail behind upper parapet (5 scalloped emerald plumes)
        val fanR = 34f * u
        for (i in 0..4) {
            val deg = -56f + i * 28f
            val rad = Math.toRadians((deg - 90f).toDouble())
            val px = cx + (cos(rad) * fanR * 0.72f).toFloat()
            val py = ty + 4f * u + (sin(rad) * fanR * 0.72f).toFloat()
            fill.color = if (i % 2 == 0) hedgeDark else hedgeMid
            c.drawCircle(px, py, 14f * u, fill)
            line.color = ink; line.strokeWidth = sw; c.drawCircle(px, py, 14f * u, line)
            // Golden topiary feather eye-spot
            fill.color = brassMid; c.drawCircle(px, py - 2f * u, 4.5f * u, fill)
            fill.color = blue; c.drawCircle(px, py - 2f * u, 2.2f * u, fill)
        }
        // Sculpted hedge dome body
        r.set(cx - 26f * u, ty - 18f * u, cx + 26f * u, ty + 10f * u)
        fill.color = hedgeMid; c.drawOval(r, fill)
        fill.color = hedgeLight; r.set(cx - 18f * u, ty - 15f * u, cx + 10f * u, ty - 3f * u); c.drawOval(r, fill)
        line.color = ink; line.strokeWidth = sw
        r.set(cx - 26f * u, ty - 18f * u, cx + 26f * u, ty + 10f * u); c.drawOval(r, line)
        // Proud curved peacock neck & head facing left toward player
        path.rewind()
        path.moveTo(cx - 4f * u, ty - 8f * u)
        path.cubicTo(cx - 22f * u, ty - 14f * u, cx - 26f * u, ty - 34f * u, cx - 14f * u, ty - 38f * u)
        line.color = ink; line.strokeWidth = 11f * u; c.drawPath(path, line)
        line.color = hedgeMid; line.strokeWidth = 7.5f * u; c.drawPath(path, line)
        // Peacock head, brass beak & 3-plume crown
        val hx = cx - 14f * u; val hy = ty - 38f * u
        fill.color = hedgeLight; c.drawCircle(hx, hy, 7.5f * u, fill)
        line.color = ink; line.strokeWidth = sw; c.drawCircle(hx, hy, 7.5f * u, line)
        path.rewind(); path.moveTo(hx - 6f * u, hy - 1f * u); path.lineTo(hx - 14f * u, hy + 2f * u); path.lineTo(hx - 6f * u, hy + 4f * u); path.close()
        fill.color = brassMid; c.drawPath(path, fill); c.drawPath(path, line)
        fill.color = ink; c.drawCircle(hx - 2f * u, hy - 1f * u, 1.5f * u, fill)
        for (kPlume in -1..1) {
            val tx = hx + kPlume * 4.5f * u; val py = hy - 13f * u
            line.color = ink; line.strokeWidth = max(1.1f * dp, 1.4f * u); c.drawLine(hx, hy - 6f * u, tx, py, line)
            fill.color = brassMid; c.drawCircle(tx, py, 2.2f * u, fill)
        }
    }

    /** Boss 1-10 glowing vine-wrapped Sprinkler Root weak point (Plate 1 & 3). */
    private fun drawSprinklerRoot(c: Canvas, l: Lens, box: RectF) {
        val sp = propSprinklerRootSp
        if (sp != null) {
            sprites.drawBox(c, sp, box, r, bmp)
            return
        }
        val cx = box.centerX(); val cy = box.centerY()
        val rad = box.width() * 0.44f
        val pulse = if (reduceMotion) 1f else 1f + 0.14f * sin(time * 4.2f)
        // Glowing emerald-teal root aura
        fill.color = 0x554ADE80; c.drawCircle(cx, cy, rad * 1.35f * pulse, fill)
        // Copper sprinkler pipe hub + emerald vines
        line.color = 0xFF1F6B29.toInt(); line.strokeWidth = max(2f * dp, 2.8f * l.scale)
        c.drawRect(box, line)
        fill.color = brassLo; c.drawCircle(cx, cy, rad * 0.62f, fill)
        fill.color = 0xFF4FE3C1.toInt(); c.drawCircle(cx, cy, rad * 0.34f * pulse, fill)
        line.color = ink; line.strokeWidth = max(1.2f * dp, 1.5f * l.scale); c.drawCircle(cx, cy, rad * 0.62f, line)
        // Animated water spray droplets
        if (!reduceMotion) {
            fill.color = 0xCC7BE3F8.toInt()
            val spray = ((time * 3f) % 1f) * rad * 0.9f
            c.drawCircle(cx - rad * 0.5f - spray * 0.5f, cy - rad * 0.6f - spray * 0.4f, max(1.6f * dp, 2f * l.scale), fill)
            c.drawCircle(cx + rad * 0.5f + spray * 0.5f, cy - rad * 0.6f - spray * 0.4f, max(1.6f * dp, 2f * l.scale), fill)
        }
    }

    /** Procedural plump, curved, warm Hob fallback with round puffy Snooze Balloon ("Round vs Flat"). */
    private fun drawProceduralHob(c: Canvas, hx: Float, hy: Float, hr: Float, col: Int, h: Hob) {
        val sw = max(1.5f * dp, hr * 0.18f)
        if (h.bonked) {
            fill.color = 0xFF9A9198.toInt(); fill.alpha = 180; c.drawCircle(hx, hy - hr * 0.8f, hr * 0.85f, fill); fill.alpha = 255
            line.color = ink; line.strokeWidth = sw; c.drawCircle(hx, hy - hr * 0.8f, hr * 0.85f, line)
            // Round puffy Snooze Balloon
            val bx = hx; val by = hy - hr * 3.1f
            line.strokeWidth = max(1.2f * dp, hr * 0.13f); c.drawLine(hx, hy - hr * 1.6f, bx, by + hr * 0.9f, line)
            fill.color = 0xFFF3E6D8.toInt(); c.drawCircle(bx, by, hr * 0.95f, fill)
            c.drawCircle(bx, by, hr * 0.95f, line)
            text.color = ink; text.textSize = max(7f * dp, hr * 0.72f); c.drawText("zzz", bx, by + hr * 0.25f, text)
            return
        }
        val cy = hy - hr * 1.25f
        // Plump curved coat & warm face
        fill.color = 0xFFD89A56.toInt(); c.drawCircle(hx, hy - hr * 0.68f, hr * 0.88f, fill)
        line.color = ink; line.strokeWidth = sw; c.drawCircle(hx, hy - hr * 0.68f, hr * 0.88f, line)
        fill.color = 0xFFF2C9A0.toInt(); c.drawCircle(hx, cy - hr * 0.35f, hr * 0.78f, fill)
        c.drawCircle(hx, cy - hr * 0.35f, hr * 0.78f, line)
        // Saturated curved team scarf
        r.set(hx - hr * 0.88f, cy + hr * 0.15f, hx + hr * 0.88f, cy + hr * 0.58f)
        fill.color = col; c.drawRoundRect(r, hr * 0.25f, hr * 0.25f, fill); c.drawRoundRect(r, hr * 0.25f, hr * 0.25f, line)
        // Rounded domed Hob cap
        r.set(hx - hr * 0.85f, cy - hr * 1.15f, hx + hr * 0.85f, cy - hr * 0.35f)
        fill.color = col; c.drawArc(r, 180f, 180f, true, fill); c.drawArc(r, 180f, 180f, true, line)
    }

    /**
     * Rigid, vertical, rectilinear Slate-Grey Flattener ("Round vs Flat", Plate 1 & 3):
     * - #5A6572 creased uniform, #FFFFFF white gloves, sharp #E8730C orange tie,
     * - flat spirit-level pancake cap with #4ADE80 green level bubble (tilted when hurt/bonked),
     * - straight-edged tool, and a crisp SQUARE zzz Snooze Balloon when bonked!
     */
    private fun drawProceduralFlattener(c: Canvas, hx: Float, hy: Float, scale: Float, h: Hob, flip: Boolean) {
        val u = scale
        val sw = max(1.6f * dp, 2.2f * u) // double-weight dark espresso outer contour
        val dir = if (flip) -1f else 1f
        val hurtTilt = h.bonked || h.squashed || h.hp < h.max

        // Square-toed pressed boots
        fill.color = 0xFF2E2A30.toInt()
        c.drawRect(hx - 6.5f * u, hy - 3.5f * u, hx - 1f * u, hy, fill)
        c.drawRect(hx + 1f * u, hy - 3.5f * u, hx + 6.5f * u, hy, fill)

        // Rigid rectilinear slate-grey uniform torso
        val bodyL = hx - 6.8f * u; val bodyR = hx + 6.8f * u
        val bodyT = hy - 18.5f * u; val bodyB = hy - 3.2f * u
        r.set(bodyL, bodyT, bodyR, bodyB)
        fill.color = if (h.bonked) 0xFF7B8490.toInt() else slate
        c.drawRect(r, fill)
        // Pressed trouser/jacket crease
        line.color = slateDark; line.strokeWidth = max(1f, 1.1f * u)
        c.drawLine(hx, bodyT + 2f * u, hx, bodyB, line)
        line.color = ink; line.strokeWidth = sw; c.drawRect(r, line)

        // Sharp rival-orange necktie
        path.rewind()
        path.moveTo(hx - 1.8f * u, bodyT + 1f * u); path.lineTo(hx + 1.8f * u, bodyT + 1f * u)
        path.lineTo(hx + 2.2f * u, bodyT + 8.5f * u); path.lineTo(hx, bodyT + 11f * u); path.lineTo(hx - 2.2f * u, bodyT + 8.5f * u); path.close()
        fill.color = orange; c.drawPath(path, fill)
        line.color = ink; line.strokeWidth = max(1f, 1.1f * u); c.drawPath(path, line)

        // Stark white gloves + straight-edged tool
        val gloveX = hx + dir * 8.2f * u; val gloveY = hy - 11.5f * u
        if (!h.bonked) {
            line.color = slateDark; line.strokeWidth = max(1.6f * dp, 2.2f * u)
            c.drawLine(gloveX, gloveY + 4f * u, gloveX + dir * 2f * u, gloveY - 10f * u, line)
            line.color = orange; line.strokeWidth = max(1.2f * dp, 1.6f * u)
            c.drawLine(gloveX + dir * 1.5f * u, gloveY - 10f * u, gloveX + dir * 6f * u, gloveY - 10f * u, line)
        }
        fill.color = Color.WHITE
        c.drawRect(gloveX - 2.6f * u, gloveY - 2.4f * u, gloveX + 2.6f * u, gloveY + 2.4f * u, fill)
        line.color = ink; line.strokeWidth = max(1f, 1.2f * u)
        c.drawRect(gloveX - 2.6f * u, gloveY - 2.4f * u, gloveX + 2.6f * u, gloveY + 2.4f * u, line)

        // Square rectilinear head
        r.set(hx - 5.8f * u, hy - 26.5f * u, hx + 5.8f * u, hy - 18.2f * u)
        fill.color = 0xFFEAD3C0.toInt(); c.drawRect(r, fill)
        line.color = ink; line.strokeWidth = sw; c.drawRect(r, line)
        // Stern horizontal brow / eyes
        fill.color = ink
        c.drawRect(hx + dir * 1f * u - 1.2f * u, hy - 23.2f * u, hx + dir * 1f * u + 1.2f * u, hy - 21.8f * u, fill)

        // Flat spirit-level pancake cap with bright #4ADE80 green level bubble (tilted when hurt/bonked!)
        c.save()
        if (hurtTilt) c.rotate(10f * dir, hx, hy - 27f * u)
        r.set(hx - 9.5f * u, hy - 30.2f * u, hx + 9.5f * u, hy - 25.8f * u)
        fill.color = slateDark; c.drawRect(r, fill)
        // Brass endcaps on spirit level
        fill.color = brassMid
        c.drawRect(r.left, r.top, r.left + 2.5f * u, r.bottom, fill)
        c.drawRect(r.right - 2.5f * u, r.top, r.right, r.bottom, fill)
        // Bright green spirit-level bubble vial
        val vialL = hx - 4.2f * u; val vialR = hx + 4.2f * u
        fill.color = 0xFF1F3B2B.toInt(); c.drawRect(vialL, r.top + 0.9f * u, vialR, r.bottom - 0.9f * u, fill)
        val bubbleX = if (hurtTilt) hx + 2.2f * u else hx
        fill.color = levelBubble; c.drawCircle(bubbleX, r.centerY(), 1.6f * u, fill)
        line.color = ink; line.strokeWidth = sw; c.drawRect(r, line)
        c.restore()

        // Bonked Flattener: unmistakable SQUARE zzz Snooze Balloon + orange diamond ribbon tag!
        if (h.bonked) {
            val bx = hx; val by = hy - 44f * u
            line.color = ink; line.strokeWidth = max(1.2f * dp, 1.4f * u)
            c.drawLine(hx, hy - 30f * u, bx, by + 8f * u, line)
            // Diamond orange tag on string
            path.rewind()
            path.moveTo(bx, hy - 36f * u - 2.6f * u); path.lineTo(bx + 2.6f * u, hy - 36f * u)
            path.lineTo(bx, hy - 36f * u + 2.6f * u); path.lineTo(bx - 2.6f * u, hy - 36f * u); path.close()
            fill.color = orange; c.drawPath(path, fill); c.drawPath(path, line)
            // Crisp square flat-pack balloon
            r.set(bx - 8.5f * u, by - 8.5f * u, bx + 8.5f * u, by + 8.5f * u)
            fill.color = 0xFFC8D0DC.toInt(); c.drawRect(r, fill)
            line.strokeWidth = sw; c.drawRect(r, line)
            text.color = ink; text.textSize = max(7f * dp, 7f * u); c.drawText("ZZZ", bx, by + 2.5f * u, text)
        }
    }

    /** Three small stars circling a Squashed Hob's head. */
    private fun drawStars(c: Canvas, x: Float, y: Float, hr: Float) {
        val spin = if (reduceMotion) 0f else time * 3f
        for (i in 0 until 3) {
            val a = spin + i * 2.094f
            val sx = x + kotlin.math.cos(a) * hr * 1.3f; val sy = y + kotlin.math.sin(a) * hr * 0.45f
            star(c, sx, sy, max(2.5f * dp, hr * 0.38f))
        }
    }

    private val starPath = android.graphics.Path()
    private fun star(c: Canvas, x: Float, y: Float, r: Float) {
        starPath.rewind()
        for (k in 0 until 10) {
            val rr = if (k % 2 == 0) r else r * 0.45f
            val a = -Math.PI / 2 + k * Math.PI / 5
            val px = x + (rr * Math.cos(a)).toFloat(); val py = y + (rr * Math.sin(a)).toFloat()
            if (k == 0) starPath.moveTo(px, py) else starPath.lineTo(px, py)
        }
        starPath.close()
        fill.color = brassMid; c.drawPath(starPath, fill)
        line.color = ink; line.strokeWidth = 1f * dp; c.drawPath(starPath, line)
    }

    private fun drawPin(c: Canvas, x: Float, y: Float, side: Int, round: Int, spent: Boolean) {
        val col = if (side == 0) blue else orange
        val hr = 8f * dp; val cy = y - 16 * dp
        val label = roundLabels[round.coerceIn(0, roundLabels.size - 1)]
        val sp = if (spent) null else if (side == 0) pinP1 else pinP2
        if (sp != null) {
            sp.usedAt = stamp
            val hPx = 28f * dp; val u = hPx / sp.meta.h
            sprites.drawAnchored(c, sp, x, y, u, flip = false, dst = r, paint = bmp)
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

    /** The Field Strip: the whole field in small, with both forts, capped Pins, the shell and each lens's edges. */
    fun drawStrip(c: Canvas, rc: RectF, f: Frame, l1: Lens, l2: Lens?) {
        fill.color = 0xFFFAF3E3.toInt(); c.drawRect(rc, fill)
        line.pathEffect = null; line.color = 0xFF8C6F4E.toInt(); line.strokeWidth = 1.5f * dp
        c.drawLine(rc.left, rc.top, rc.right, rc.top, line); c.drawLine(rc.left, rc.bottom, rc.right, rc.bottom, line)
        val pad = 10 * dp
        val mw = max(1, f.mapW).toFloat(); val mh = max(1, f.mapH).toFloat()
        fun mx(wx: Float) = rc.left + pad + (wx / mw) * (rc.width() - 2 * pad)
        fun my(wy: Float) = rc.top + 3 * dp + (wy / mh).coerceIn(0f, 1f) * (rc.height() - 6 * dp)
        val t = f.terrain
        if (t != null && t.w > 1) {
            path.rewind()
            val step = max(1, t.w / 160)
            t.lock {
                var x = 0; var first = true
                while (x < t.w) { val px = mx(x.toFloat()); val py = my(t.surface[x].toFloat()); if (first) { path.moveTo(px, py); first = false } else path.lineTo(px, py); x += step }
            }
            line.color = 0xFF8E5A38.toInt(); c.drawPath(path, line)
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
        fillVisiblePins(f.ghosts)
        for (gi in f.ghosts.indices) {
            if (!isVisiblePinIndex(gi)) continue
            val g = f.ghosts[gi]
            if (!g.hasPin) continue
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
        /** Hob art scale: 28 cells for an 80 px (@1x) frame. */
        const val HOB_K = 28f / 80f
        /** Cells per terrain bitmap pixel on each axis. */
        const val DS = 2
        /** Visual cap on persistent trajectory pins per side (Part 2 Plate 2). */
        const val MAX_PINS_PER_SIDE = 2

        private val FLATTENER_DEFS = setOf("hedge_snipper", "rake_hand", "mower_minder", "pebble_pitcher")

        /**
         * Pure-Kotlin helper returning the indices of the most recent [maxPerSide] ghosts with a Pin
         * per side (Part 2 Plate 2: prevents Round 10 Fatigue visual soup).
         */
        fun visiblePinIndices(ghosts: List<Ghost>, maxPerSide: Int = MAX_PINS_PER_SIDE): Set<Int> {
            val out = HashSet<Int>(maxPerSide * 2)
            var c0 = 0; var c1 = 0
            for (i in ghosts.indices.reversed()) {
                val g = ghosts[i]
                if (!g.hasPin) continue
                if (g.side == 0 && c0 < maxPerSide) { out.add(i); c0++ }
                else if (g.side == 1 && c1 < maxPerSide) { out.add(i); c1++ }
                if (c0 >= maxPerSide && c1 >= maxPerSide) break
            }
            return out
        }

        /** Static sprite names looked up in [tables], verified by AnimsAudioTest (Android-M12). */
        internal val TABLE_SPRITES = listOf(
            "fx_ghost_dot_p1", "fx_ghost_dot_p2", "fx_pin_p1", "fx_pin_p2",
            "kettle_full", "kettle_hurt", "kettle_critical", "kettle_popped", "kettle_halo",
            "nook", "kettle_room", "flag_blue", "flag_orange",
            "bg_downs_sky", "bg_downs_hills_far", "bg_downs_hills_near",
            "stomper_blue_0", "stomper_orange_0", "loophole_flap_blue", "loophole_flap_orange",
            "pot_lid_raise_2", "shell_marble", "icon_lid_lifter", "block_timber_fresh",
        )
    }
}

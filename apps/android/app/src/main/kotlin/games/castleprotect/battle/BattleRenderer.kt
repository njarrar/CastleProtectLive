package games.castleprotect.battle

import android.graphics.BitmapShader
import android.graphics.Matrix
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import games.castleprotect.core.Fort
import games.castleprotect.core.Phase
import games.castleprotect.core.Snapshot
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Canvas drawing of one snapshot through a Lens. Pure view code: it reads the
 * snapshot and never writes game state. Colours follow docs/design/06 (ink
 * #2B1E2E, never pure black; you blue and round, Rival orange and diamond).
 */
class BattleRenderer(private val sprites: Sprites, private val dp: Float) {
    private val ink = 0xFF2B1E2E.toInt()
    private val blue = 0xFF2F6FDE.toInt(); private val orange = 0xFFE8730C.toInt()
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = ink; strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
    private val bmp = Paint(Paint.FILTER_BITMAP_FLAG)
    private val path = Path()
    private val r = RectF()
    private var sky: LinearGradient? = null; private var skyH = 0f
    private var time = 0f
    private class Blast(val x: Float, val y: Float, var age: Float, val big: Boolean)
    private val blasts = ArrayList<Blast>()

    fun addBlast(x: Float, y: Float, kind: String) { blasts.add(Blast(x, y, 0f, kind != "plain")) }
    fun tick(dt: Float) { time += dt; val it = blasts.iterator(); while (it.hasNext()) { val b = it.next(); b.age += dt; if (b.age > 0.5f) it.remove() } }

    private val soil: BitmapShader? = sprites.get("terrain_soil")?.let { BitmapShader(it.bmp, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT) }
    private val soilPxPerCell = sprites.get("terrain_soil")?.let { it.bmp.width / it.meta.w } ?: 2f
    private val mtx = Matrix()
    private val ghostDash = DashPathEffect(floatArrayOf(8 * dp, 6 * dp), 0f)

    /**
     * Draws a sprite with its manifest anchor on the world point (wx, wy).
     * [k] scales the sprite's own cell size (1 px at @1x is one cell); [flip] mirrors it for the right-hand fort.
     */
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

    private fun band(c: Canvas, sp: Sprites.Sprite, rc: RectF, bottom: Float, h: Float, shift: Float) {
        val w = h * sp.meta.w / sp.meta.h
        var x = rc.left - (((shift % w) + w) % w)
        while (x < rc.right) { r.set(x, bottom - h, x + w + 1f, bottom); c.drawBitmap(sp.bmp, null, r, bmp); x += w }
    }

    fun drawEmpty(c: Canvas, w: Float, h: Float) { c.drawColor(0xFFA5D8EC.toInt()) }

    private fun matColor(m: String) = when (m) {
        "wicker" -> 0xFFE3B565.toInt(); "timber" -> 0xFFB9733A.toInt(); "cobble" -> 0xFFA9A39A.toInt()
        "footing" -> 0xFF5A4A42.toInt(); "brassbound" -> 0xFF6B7A86.toInt(); else -> 0xFFB9733A.toInt()
    }
    private fun matShade(m: String) = when (m) {
        "wicker" -> 0xFFB8843A.toInt(); "timber" -> 0xFF87491F.toInt(); "cobble" -> 0xFF77716B.toInt()
        "footing" -> 0xFF3F332D.toInt(); else -> 0xFF47525C.toInt()
    }
    private fun hatColor(cls: String) = when (cls.lowercase()) {
        "lobber" -> 0xFFD9483B.toInt(); "zinger" -> 0xFF3F8FD9.toInt(); "scatterjack" -> 0xFF3FA98C.toInt()
        "delver" -> 0xFF8A5A2B.toInt(); "boinker" -> 0xFFE88BB5.toInt(); "patcher" -> 0xFF8FB04A.toInt(); else -> 0xFF7D6B5D.toInt()
    }
    private fun sideColor(side: Int, me: Int) = if (side == 0) blue else orange

    fun drawLens(c: Canvas, l: Lens, s: Snapshot, me: Int, drag: FloatArray?) {
        val rc = l.rect
        c.save(); c.clipRect(rc)
        // Sky, then two hill bands that slide at different speeds (parallax). Shapes stand in if the art is missing.
        val skySp = sprites.get("bg_downs_sky")
        if (skySp != null) { r.set(rc); c.drawBitmap(skySp.bmp, null, r, bmp) }
        else {
            if (sky == null || skyH != rc.height()) { skyH = rc.height(); sky = LinearGradient(0f, 0f, 0f, skyH, 0xFF9FD6EC.toInt(), 0xFFDDF1EE.toInt(), Shader.TileMode.CLAMP) }
            c.save(); c.translate(0f, rc.top); fill.shader = sky; c.drawRect(rc.left, 0f, rc.right, rc.height(), fill); fill.shader = null; c.restore()
        }
        val horizon = l.sy(s.groundAt(l.cx)).coerceIn(rc.top + rc.height() * 0.45f, rc.bottom)
        val far = sprites.get("bg_downs_hills_far"); val near = sprites.get("bg_downs_hills_near")
        if (far != null) band(c, far, rc, horizon + 6 * dp, rc.height() * 0.42f, l.cx * l.scale * 0.25f)
        if (near != null) band(c, near, rc, horizon + 14 * dp, rc.height() * 0.30f, l.cx * l.scale * 0.5f)
        if (far == null && near == null) {
            fill.color = 0xFFB5DDA0.toInt()
            path.rewind(); path.moveTo(rc.left, rc.bottom)
            var x = rc.left
            while (x <= rc.right + 24 * dp) {
                val wxf = l.cx * 0.5f + (x - rc.centerX()) / l.scale
                path.lineTo(x, horizon - rc.height() * 0.12f - (26f * sin(wxf * 0.012f) + 12f * sin(wxf * 0.031f)) * dp * 0.6f)
                x += 24 * dp
            }
            path.lineTo(rc.right, rc.bottom); path.close(); c.drawPath(path, fill)
        }

        // Ground
        val n = s.terrain.size
        if (n > 1) {
            val step = s.worldW / (n - 1)
            val i0 = max(0, (l.wx(rc.left) / step).toInt() - 1); val i1 = min(n - 1, (l.wx(rc.right) / step).toInt() + 2)
            path.rewind(); path.moveTo(l.sx(i0 * step), rc.bottom + 4)
            for (i in i0..i1) path.lineTo(l.sx(i * step), l.sy(s.terrain[i]))
            path.lineTo(l.sx(i1 * step), rc.bottom + 4); path.close()
            fill.color = 0xFF9B6240.toInt()
            if (soil != null) {
                // The soil tile is pinned to the world, so it does not swim when the camera moves.
                val k = l.scale / soilPxPerCell
                mtx.reset(); mtx.setScale(k, k); mtx.postTranslate(l.sx(0f), l.sy(0f)); soil.setLocalMatrix(mtx); fill.shader = soil
            }
            c.drawPath(path, fill); fill.shader = null
            path.rewind(); path.moveTo(l.sx(i0 * step), l.sy(s.terrain[i0]))
            for (i in i0 + 1..i1) path.lineTo(l.sx(i * step), l.sy(s.terrain[i]))
            line.pathEffect = null
            line.color = 0xFF7CC36A.toInt(); line.strokeWidth = max(5f * dp, 7f * l.scale); c.drawPath(path, line)
            line.color = ink; line.strokeWidth = 1.5f * dp
            c.save(); c.translate(0f, -max(2.5f * dp, 3.5f * l.scale)); c.drawPath(path, line); c.restore()
        }

        for (f in s.forts) drawFort(c, l, s, f, me)

        // Ghost lines of earlier shots, then Pins.
        line.strokeWidth = 1.5f * dp
        for ((gi, g) in s.ghosts.withIndex()) {
            if (g.size < 4) continue
            path.rewind(); path.moveTo(l.sx(g[0]), l.sy(g[1]))
            var i = 2; while (i + 1 < g.size) { path.lineTo(l.sx(g[i]), l.sy(g[i + 1])); i += 2 }
            line.color = ink; line.alpha = if (gi == s.ghosts.size - 1) 100 else 50
            line.pathEffect = ghostDash; c.drawPath(path, line)
        }
        line.pathEffect = null; line.alpha = 255
        for (p in s.pins) if (p.x >= l.wx(rc.left) - 20 && p.x <= l.wx(rc.right) + 20) drawPin(c, l.sx(p.x), l.sy(p.y), p.side, p.round, p.spent)

        // 30% preview dots
        var i = 0
        while (i + 1 < s.preview.size) {
            val px = l.sx(s.preview[i]); val py = l.sy(s.preview[i + 1])
            val dot = sprites.get(if (s.hud.activeSide == 0) "fx_ghost_dot_p1" else "fx_ghost_dot_p2")
            if (dot != null) spriteAt(c, dot, px, py, 8f * dp)
            else { fill.color = Color.WHITE; c.drawCircle(px, py, 3.2f * dp, fill); line.color = ink; line.strokeWidth = 1.2f * dp; c.drawCircle(px, py, 3.2f * dp, line) }
            i += 2
        }

        // Shells in flight
        for (sh in s.shells) {
            val px = l.sx(sh.x); val py = l.sy(sh.y); val rad = max(4f * dp, 4f * l.scale)
            val sp = sprites.get("shell_${sh.kind}", "shell_clodpot")
            if (sp != null) spriteAt(c, sp, px, py, max(12f * dp, sp.meta.h * l.scale))
            else { fill.color = ink; c.drawCircle(px, py, rad, fill); fill.color = 0xFFFFC23D.toInt(); c.drawCircle(px + rad * 0.6f, py - rad * 0.7f, rad * 0.35f, fill) }
        }

        // Blasts: warm white with a gold rim.
        for (b in blasts) {
            val t = b.age / 0.5f; val rad = (if (b.big) 40f else 26f) * l.scale * (0.3f + 0.7f * t)
            val boom = sprites.get("fx_boom_${if (b.big) "large" else "medium"}_${min(3, (t * 4).toInt())}")
            if (boom != null) { spriteAt(c, boom, l.sx(b.x), l.sy(b.y), (if (b.big) 96f else 64f) * l.scale); continue }
            fill.color = 0xFFFFF6E0.toInt(); fill.alpha = ((1 - t) * 230).toInt(); c.drawCircle(l.sx(b.x), l.sy(b.y), rad, fill); fill.alpha = 255
            line.color = 0xFFFFC23D.toInt(); line.alpha = ((1 - t) * 255).toInt(); line.strokeWidth = 3 * dp; c.drawCircle(l.sx(b.x), l.sy(b.y), rad, line); line.alpha = 255
        }

        // Aim Drag: stretchy band from anchor to finger, matching arrow and big readout at the Loophole.
        if (drag != null && s.hud.phase == Phase.PLAN) {
            line.color = if (s.hud.activeSide == 0) blue else orange; line.strokeWidth = 4 * dp; line.alpha = 200
            c.drawLine(drag[0], drag[1], drag[2], drag[3], line); line.alpha = 255
            fill.color = Color.WHITE; c.drawCircle(drag[0], drag[1], 5 * dp, fill); line.strokeWidth = 1.5f * dp; line.color = ink; c.drawCircle(drag[0], drag[1], 5 * dp, line)
            c.drawCircle(drag[0], drag[1], 12 * dp, line.apply { alpha = 60 }); line.alpha = 255
            fill.color = line.color; c.drawCircle(drag[2], drag[3], 9 * dp, fill)
        }
        val hob = s.forts.getOrNull(s.hud.activeSide)?.hobs?.firstOrNull { it.id == s.hud.selectedHob }
        if (hob != null && s.hud.phase == Phase.PLAN && s.hud.aimSet) {
            val a = Math.toRadians(s.hud.aimAngle / 10.0); val len = (14f + s.hud.aimPower * 0.3f) * dp
            val hx = l.sx(hob.x); val hy = l.sy(hob.y + 14f)
            val ex = hx + (cos(a) * len).toFloat(); val ey = hy - (sin(a) * len).toFloat()
            line.color = ink; line.strokeWidth = 3 * dp; c.drawLine(hx, hy, ex, ey, line)
            fill.color = 0xFFFFC23D.toInt(); c.drawCircle(ex, ey, 4 * dp, fill); line.strokeWidth = 1.5f * dp; c.drawCircle(ex, ey, 4 * dp, line)
            if (drag != null) {
                val label = "%.1f° | %d".format(s.hud.aimAngle / 10f, s.hud.aimPower)
                text.textSize = 18 * dp
                val tw = text.measureText(label) / 2 + 10 * dp
                val ty = (hy - 64 * dp).coerceAtLeast(rc.top + 24 * dp)
                val tx = hx.coerceIn(rc.left + tw + 4 * dp, max(rc.left + tw + 4 * dp, rc.right - tw - 4 * dp))
                r.set(tx - tw, ty - 16 * dp, tx + tw, ty + 16 * dp)
                fill.color = 0xFFFFF4DE.toInt(); c.drawRoundRect(r, 10 * dp, 10 * dp, fill); line.strokeWidth = 2 * dp; c.drawRoundRect(r, 10 * dp, 10 * dp, line)
                c.drawText(label, tx, ty + 6 * dp, text)
            }
        }
        c.restore()
    }

    private fun drawFort(c: Canvas, l: Lens, s: Snapshot, f: Fort, me: Int) {
        val col = sideColor(f.side, me)
        val team = if (f.side == 0) "blue" else "orange"
        line.pathEffect = null
        // Rooms sit behind everything: the Kettle Room and one Nook per Hob (2 x 2 blocks each).
        sprites.get("kettle_room")?.let { sprite(c, it, l, f.kettleX - it.meta.w / 2, f.kettleY + it.meta.h / 2) }
        sprites.get("nook")?.let { for (h in f.hobs) sprite(c, it, l, h.x - it.meta.w / 2, h.y + it.meta.h) }
        // Blocks
        for (b in f.blocks) {
            r.set(l.sx(b.x), l.sy(b.y + b.h), l.sx(b.x + b.w), l.sy(b.y))
            if (r.right < l.rect.left || r.left > l.rect.right) continue
            val hurt = 1f - b.hp.toFloat() / max(1, b.hpMax)
            val sp = sprites.get("block_${b.mat}_${if (hurt < 0.34f) "fresh" else if (hurt < 0.67f) "scuffed" else "battered"}", "block_${b.mat}_fresh")
            if (sp != null) { c.drawBitmap(sp.bmp, null, r, bmp); continue }
            fill.color = matColor(b.mat); c.drawRect(r, fill)
            fill.color = matShade(b.mat); c.drawRect(r.left, r.bottom - r.height() * 0.22f, r.right, r.bottom, fill)
            line.color = ink; line.strokeWidth = max(1f, 1.2f * dp * min(1f, l.scale / dp + 0.3f)); c.drawRect(r, line)
            if (hurt > 0.05f) {
                fill.color = ink; fill.alpha = (hurt * 110).toInt(); c.drawRect(r, fill); fill.alpha = 255
                if (hurt > 0.4f) { line.color = ink; line.strokeWidth = 1.2f * dp; c.drawLine(r.left + r.width() * 0.2f, r.top, r.centerX(), r.centerY(), line); c.drawLine(r.centerX(), r.centerY(), r.left + r.width() * 0.7f, r.bottom, line) }
            }
        }
        // Heartkettle: the teal glow is reserved for it. Its look changes at 50% and 25%.
        val kx = l.sx(f.kettleX); val ky = l.sy(f.kettleY)
        val pct = f.kettlePct
        val ks = sprites.get(if (pct <= 0) "kettle_popped" else if (pct <= 25) "kettle_critical" else if (pct <= 50) "kettle_hurt" else "kettle_full")
        if (ks != null) {
            if (pct > 0) sprites.get("kettle_halo")?.let { spriteAt(c, it, kx, ky, 34f * l.scale * (1f + 0.06f * sin(time * 4f))) }
            spriteAt(c, ks, kx, ky, 24f * l.scale)
        } else if (pct > 0) {
            val kr = 9f * l.scale
            fill.color = 0xFFE8873A.toInt(); c.drawCircle(kx, ky, kr, fill); line.color = ink; line.strokeWidth = 1.5f * dp; c.drawCircle(kx, ky, kr, line)
            fill.color = 0xFF4FE3C1.toInt(); c.drawCircle(kx, ky, kr * (0.3f + 0.08f * sin(time * 4f)), fill)
        }
        // Hobs stand in their Nooks; (x, y) is the feet. Art faces right, so the right-hand fort is flipped.
        val firing = (s.hud.phase == Phase.FLIGHT) && s.hud.activeSide == f.side
        for (h in f.hobs) {
            val hx = l.sx(h.x); val hy = l.sy(h.y)
            val selected = h.id == s.hud.selectedHob && s.hud.activeSide == f.side
            val key = Sprites.hobKey(h.id, h.name)
            val pose = when {
                h.bonked -> "bonked_${(time * 2f).toInt() % 2}"
                selected && firing -> "fire_1"
                selected && s.hud.phase == Phase.PLAN -> "aim_${(time * 2f).toInt() % 2}"
                s.hud.phase == Phase.ENDED && h.hp > 0 && s.hud.result?.winner == f.side -> "cheer_${(time * 3f).toInt() % 2}"
                else -> "idle_${((time * 2f).toInt() + h.id.length) % 3}"
            }
            val sp = sprites.get("hob_${key}_${team}_$pose", "hob_${key}_${team}_idle_0")
            // A Hob frame is 80 cells tall in the art; scaled so the Hob stands about 28 cells tall inside a 32 cell Nook.
            val k = 28f / (sprites.get("hob_${key}_${team}_idle_0")?.meta?.h ?: 80f)
            val hr = 9f * l.scale
            if (sp != null) sprite(c, sp, l, h.x, h.y, k, flip = f.side == 1)
            else if (h.bonked) { fill.color = 0xFF9A9198.toInt(); fill.alpha = 150; c.drawCircle(hx, hy - hr, hr * 0.8f, fill); fill.alpha = 255 }
            else {
                val cy = hy - hr * 1.2f
                fill.color = 0xFFF2C9A0.toInt(); c.drawCircle(hx, cy, hr, fill)
                fill.color = hatColor(h.cls); r.set(hx - hr, cy - hr * 1.5f, hx + hr, cy + hr * 0.3f); c.drawArc(r, 180f, 180f, true, fill)
                fill.color = col; c.drawRect(hx - hr * 0.8f, cy + hr * 0.55f, hx + hr * 0.8f, cy + hr * 0.95f, fill) // team scarf
                line.color = ink; line.strokeWidth = 1.3f * dp; c.drawCircle(hx, cy, hr, line)
            }
            if (h.bonked) continue
            if (selected && s.hud.phase == Phase.PLAN) {
                line.color = 0xFFFFC23D.toInt(); line.strokeWidth = 2.5f * dp; line.pathEffect = ghostDash
                c.drawCircle(hx, hy - 14f * l.scale, 19f * l.scale, line); line.pathEffect = null
            }
            if (h.hp < h.hpMax) {
                val wbar = 22f * l.scale
                fill.color = ink; c.drawRect(hx - wbar / 2, hy + 2 * dp, hx + wbar / 2, hy + 5 * dp, fill)
                fill.color = 0xFF5CC35A.toInt(); c.drawRect(hx - wbar / 2, hy + 2 * dp, hx - wbar / 2 + wbar * h.hp / max(1, h.hpMax), hy + 5 * dp, fill)
            }
        }
        // Flag: yours points left with round shapes, the Rival's points right with diamonds.
        val topY = (f.blocks.maxOfOrNull { it.y + it.h } ?: (f.kettleY + 20f))
        val flag = sprites.get("flag_$team")
        if (flag != null) { sprite(c, flag, l, f.x, topY, 1.4f, flip = f.side == 0); return }
        val fx = l.sx(f.x); val fy = l.sy(topY); val fh = 22f * l.scale; val dir = if (f.side == 0) -1f else 1f
        line.color = ink; line.strokeWidth = 2 * dp; c.drawLine(fx, fy, fx, fy - fh, line)
        path.rewind(); path.moveTo(fx, fy - fh); path.lineTo(fx + dir * fh * 0.6f, fy - fh * 0.8f); path.lineTo(fx, fy - fh * 0.6f); path.close()
        fill.color = col; c.drawPath(path, fill); line.strokeWidth = 1.3f * dp; c.drawPath(path, line)
    }

    private fun drawPin(c: Canvas, x: Float, y: Float, side: Int, round: Int, spent: Boolean) {
        val col = if (side == 0) blue else orange
        val hr = 8f * dp; val cy = y - 16 * dp
        val sp = if (spent) null else sprites.get(if (side == 0) "fx_pin_p1" else "fx_pin_p2")
        if (sp != null) {
            val hPx = 28f * dp; val u = hPx / sp.meta.h
            r.set(x - sp.meta.ax * u, y - sp.meta.ay * u, x + (sp.meta.w - sp.meta.ax) * u, y + (sp.meta.h - sp.meta.ay) * u); c.drawBitmap(sp.bmp, null, r, bmp)
            text.textSize = 8 * dp; text.color = Color.WHITE; c.drawText(round.toString(), x, y - hPx * 0.58f, text); text.color = ink
            return
        }
        line.color = ink; line.strokeWidth = 2 * dp; c.drawLine(x, y, x, cy, line)
        path.rewind()
        if (side == 0) path.addCircle(x, cy, hr, Path.Direction.CW)
        else { path.moveTo(x, cy - hr * 1.2f); path.lineTo(x + hr * 1.2f, cy); path.lineTo(x, cy + hr * 1.2f); path.lineTo(x - hr * 1.2f, cy); path.close() }
        fill.color = if (spent) 0xFFFFF4DE.toInt() else col; c.drawPath(path, fill)
        line.strokeWidth = 1.5f * dp; c.drawPath(path, line)
        text.textSize = 9 * dp; text.color = if (spent) ink else Color.WHITE; c.drawText(round.toString(), x, cy + 3.2f * dp, text); text.color = ink
    }

    /** The Field Strip: the whole field in small, with both forts, the last Pins, the shell and each lens's edges. */
    fun drawStrip(c: Canvas, rc: RectF, s: Snapshot, me: Int, lenses: List<Lens>) {
        fill.color = 0xFFFFF4DE.toInt(); c.drawRect(rc, fill)
        line.pathEffect = null; line.color = ink; line.strokeWidth = 1.5f * dp
        c.drawLine(rc.left, rc.top, rc.right, rc.top, line); c.drawLine(rc.left, rc.bottom, rc.right, rc.bottom, line)
        val pad = 10 * dp
        fun mx(wx: Float) = rc.left + pad + (wx / s.worldW) * (rc.width() - 2 * pad)
        val maxH = (s.terrain.maxOrNull() ?: 200f) + 260f
        fun my(wy: Float) = rc.bottom - 3 * dp - (wy / maxH).coerceIn(0f, 1f) * (rc.height() - 6 * dp)
        // ground line
        if (s.terrain.size > 1) {
            path.rewind()
            for (i in s.terrain.indices step 4) { val x = mx(i * s.worldW / (s.terrain.size - 1)); val y = my(s.terrain[i]); if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }
            line.color = 0xFF9B6240.toInt(); c.drawPath(path, line)
        }
        var i = 0
        while (i + 1 < s.preview.size) { fill.color = ink; c.drawCircle(mx(s.preview[i]), my(s.preview[i + 1]), 1.5f * dp, fill); i += 4 }
        for (f in s.forts) {
            val x = mx(f.x); val y = my(s.groundAt(f.x)); val k = 6 * dp
            fill.color = if (f.side == 0) blue else orange
            if (f.side == 0) c.drawRect(x - k, y - 2 * k, x + k, y, fill)
            else { path.rewind(); path.moveTo(x, y - 2.4f * k); path.lineTo(x + 1.2f * k, y - k * 1.2f); path.lineTo(x, y); path.lineTo(x - 1.2f * k, y - k * 1.2f); path.close(); c.drawPath(path, fill) }
        }
        for (p in s.pins) {
            fill.color = if (p.side == 0) blue else orange
            val x = mx(p.x); val y = my(p.y) - 3 * dp
            if (p.side == 0) c.drawCircle(x, y, 3 * dp, fill) else { c.save(); c.rotate(45f, x, y); c.drawRect(x - 2.6f * dp, y - 2.6f * dp, x + 2.6f * dp, y + 2.6f * dp, fill); c.restore() }
        }
        for (sh in s.shells) { fill.color = ink; c.drawCircle(mx(sh.x), my(sh.y), 3 * dp, fill) }
        // lens brackets
        line.color = ink; line.strokeWidth = 2 * dp
        for (l in lenses) if (l.live) {
            val x0 = mx(l.wx(l.rect.left).coerceIn(0f, s.worldW)); val x1 = mx(l.wx(l.rect.right).coerceIn(0f, s.worldW)); val t = rc.top + 4 * dp; val b = rc.bottom - 4 * dp; val k = 5 * dp
            c.drawLine(x0, t, x0, b, line); c.drawLine(x0, t, x0 + k, t, line); c.drawLine(x0, b, x0 + k, b, line)
            c.drawLine(x1, t, x1, b, line); c.drawLine(x1, t, x1 - k, t, line); c.drawLine(x1, b, x1 - k, b, line)
        }
    }
}

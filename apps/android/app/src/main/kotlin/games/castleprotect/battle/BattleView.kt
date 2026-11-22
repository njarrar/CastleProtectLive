package games.castleprotect.battle

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.RectF
import android.os.SystemClock
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import androidx.compose.runtime.mutableStateOf
import games.castleprotect.core.Cmd
import games.castleprotect.core.Phase
import games.castleprotect.core.Snapshot
import games.castleprotect.game.GameSession
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** One window onto the world: a screen rect, a world centre and a scale in px per cell. */
class Lens(val rect: RectF = RectF(), var cx: Float = 0f, var cy: Float = 0f, var scale: Float = 1f, var live: Boolean = false) {
    fun sx(wx: Float) = rect.centerX() + (wx - cx) * scale
    fun sy(wy: Float) = rect.centerY() - (wy - cy) * scale
    fun wx(sx: Float) = cx + (sx - rect.centerX()) / scale
    fun wy(sy: Float) = cy - (sy - rect.centerY()) / scale
}

/**
 * The battle field. A SurfaceView with its own render thread that draws the
 * latest core snapshot (Canvas first pass; the GLES 3.0 batcher replaces the
 * drawing later without touching input or layout). It also owns the Aim Drag.
 *
 * Layout is a pure function of the view size, the insets and the settings. It
 * is never saved and never touches the sim, so a turn of the device is free.
 */
@SuppressLint("ViewConstructor")
class BattleView(ctx: Context, private val session: GameSession) : SurfaceView(ctx), SurfaceHolder.Callback {
    private val dp = resources.displayMetrics.density
    private val renderer = BattleRenderer(session.sprites, dp)

    /** Tall layout (stacked lenses) or Wide layout. Set by the HUD from the window shape. */
    @Volatile var tall = false
    /** Space the Wide HUD covers on each edge, in px: left, top, right, bottom. */
    @Volatile var hudPad = floatArrayOf(0f, 0f, 0f, 0f)

    /** True while an Aim Drag is in progress; the HUD fades its clusters. */
    val dragging = mutableStateOf(false)
    /** True after a manual pan or zoom; the HUD shows Re-frame. */
    val manual = mutableStateOf(false)
    /** Uptime of the last Aim Drag end, for the 150 ms Fire guard. */
    @Volatile var dragEndedAt = 0L
        private set

    // Lenses. main: Wide layout and the joined flight view. top, bottom: Tall layout.
    private val main = Lens(); private val top = Lens(); private val bottom = Lens()
    private val strip = RectF()
    @Volatile private var zoom = 1f
    @Volatile private var panX = 0f
    @Volatile private var panY = 0f
    @Volatile private var topPan = 0f

    // Aim Drag state (screen px). Aim itself is angle and power, never screen points.
    private var downX = 0f; private var downY = 0f
    private var candidate = false
    private var panning = false
    private var anchorX = 0f; private var anchorY = 0f
    @Volatile private var fingerX = 0f
    @Volatile private var fingerY = 0f
    private var prevAngle = 0; private var prevPower = 0
    private var sentAngle = -1; private var sentPower = -1
    private var pinchDist = 0f; private var pinchX = 0f; private var pinchY = 0f
    private var lastTapAt = 0L
    private var blocked = false // after a pinch, a new touch is needed before aiming again

    private var thread: RenderThread? = null
    private var lastPhase = Phase.NONE

    init { holder.addCallback(this); isFocusable = true }

    fun reframe() { zoom = 1f; panX = 0f; panY = 0f; topPan = 0f; manual.value = false }

    // ---- surface ---------------------------------------------------------

    override fun surfaceCreated(h: SurfaceHolder) { thread = RenderThread().also { it.start() } }
    override fun surfaceChanged(h: SurfaceHolder, f: Int, w: Int, hh: Int) {}
    override fun surfaceDestroyed(h: SurfaceHolder) { thread?.quit(); thread = null }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        super.onSizeChanged(w, h, ow, oh)
        // Device turned or window resized mid-drag: the drag ends as if the finger lifted. The aim so far is kept, nothing fires.
        if (dragging.value) endDrag(keep = true, mayFire = false)
        candidate = false
    }

    private inner class RenderThread : Thread("castle-render") {
        @Volatile private var alive = true
        fun quit() { alive = false; try { join(400) } catch (e: InterruptedException) { } }
        override fun run() {
            var last = System.nanoTime()
            while (alive) {
                val c: Canvas? = try { holder.lockHardwareCanvas() } catch (e: Exception) { try { holder.lockCanvas() } catch (e2: Exception) { null } }
                if (c == null) { sleepQuiet(16); continue }
                try {
                    val now = System.nanoTime()
                    val dt = ((now - last) / 1e9f).coerceIn(0f, 0.1f); last = now
                    drawFrame(c, dt)
                } finally {
                    try { holder.unlockCanvasAndPost(c) } catch (e: Exception) { }
                }
            }
        }
        private fun sleepQuiet(ms: Long) { try { sleep(ms) } catch (e: InterruptedException) { } }
    }

    // ---- layout and camera -----------------------------------------------

    /** Which side the close-up Bottom lens belongs to: the human whose turn it is, else the last human, else side 0. */
    private fun viewer(s: Snapshot): Int {
        val h = s.hud
        return if (h.humans.getOrElse(h.activeSide) { false }) h.activeSide else if (h.humans.getOrElse(0) { true }) 0 else 1
    }

    private fun ease(l: Lens, cx: Float, cy: Float, scale: Float, dt: Float) {
        if (!l.live || session.settings.reduceMotion) { l.cx = cx; l.cy = cy; l.scale = scale; l.live = true; return }
        val k = 1f - Math.exp((-dt * 12f).toDouble()).toFloat() // settles in about 250 ms
        l.cx += (cx - l.cx) * k; l.cy += (cy - l.cy) * k; l.scale += (scale - l.scale) * k
    }

    private fun frameFort(l: Lens, s: Snapshot, side: Int, cellPx: Float, foot: Float, pan: Float, dt: Float) {
        val f = s.forts.getOrNull(side) ?: return
        val dir = if (side == 0) 1f else -1f
        val cx = f.x + dir * l.rect.width() * 0.16f / cellPx + pan
        val cy = s.groundAt(f.x) + (l.rect.height() / 2f - foot) / cellPx
        ease(l, cx, cy, cellPx, dt)
    }

    private fun drawFrame(c: Canvas, dt: Float) {
        val s = session.latest
        val w = width.toFloat(); val h = height.toFloat()
        if (w <= 0 || h <= 0) return
        val phase = s.hud.phase
        if (phase != lastPhase) {
            if (phase == Phase.FLIGHT) post { reframe() } // on Fire the camera snaps back to auto-frame
            lastPhase = phase
        }
        while (true) { val e = session.fx.poll() ?: break; renderer.addBlast(e.x, e.text.toFloatOrNull() ?: s.groundAt(e.x), e.cue) }
        val drag = if (dragging.value) floatArrayOf(anchorX, anchorY, fingerX, fingerY) else null
        val me = viewer(s)
        val flying = phase == Phase.FLIGHT || phase == Phase.RESOLVE
        if (tall && s.forts.size >= 2) {
            val stripH = 32f * dp
            if (flying) {
                // The two lenses join into one tall view that rides with the shell; the Field Strip slides to its foot.
                main.rect.set(0f, 0f, w, h - stripH); strip.set(0f, h - stripH, w, h)
                val scale = 0.62f * dp * zoom
                val sh = s.shells.firstOrNull()
                if (sh != null && !manual.value) {
                    val cy = max(sh.y, s.groundAt(sh.x) + (main.rect.height() / 2f - 120f * dp) / scale)
                    ease(main, sh.x, cy, scale, dt)
                } else if (!main.live) frameFort(main, s, me, scale, 120f * dp, 0f, dt)
                else { main.cx += panX; main.cy += panY; panX = 0f; panY = 0f; main.scale += (scale - main.scale) * 0.2f }
                renderer.drawLens(c, main, s, me, null)
                top.live = false; bottom.live = false
            } else {
                val topH = ((h - stripH) * 0.39f)
                top.rect.set(0f, 0f, w, topH); strip.set(0f, topH, w, topH + stripH); bottom.rect.set(0f, topH + stripH, w, h)
                frameFort(top, s, 1 - me, 0.75f * dp, 36f * dp, topPan, dt)     // target fort, blocks about 12 pt
                frameFort(bottom, s, me, 1.0f * dp, 96f * dp, 0f, dt)           // your fort, blocks about 16 pt
                renderer.drawLens(c, top, s, me, null)
                renderer.drawLens(c, bottom, s, me, drag)
                main.live = false
            }
            renderer.drawStrip(c, strip, s, me, if (flying) listOf(main) else listOf(top, bottom))
        } else if (s.forts.size >= 2) {
            main.rect.set(0f, 0f, w, h)
            val p = hudPad
            val clearW = max(1f, w - p[0] - p[2]); val clearH = max(1f, h - p[1] - p[3])
            val a = s.forts[0]; val b = s.forts[1]
            var scale = clearW / (abs(b.x - a.x) + 240f)
            val base = min(s.groundAt(a.x), s.groundAt(b.x))
            val sh = s.shells.firstOrNull()
            if (sh != null) scale = min(scale, clearH / (sh.y - base + 110f))
            scale *= zoom
            // Bias 55/45 toward the rival of whoever is looking.
            val cx = (a.x + b.x) / 2f + (if (me == 0) 1 else -1) * abs(b.x - a.x) * 0.02f + ((p[2] - p[0]) / 2f) / scale + panX
            val cy = base + (h / 2f - p[3] - 40f * dp) / scale + panY
            ease(main, cx, cy, scale, dt)
            renderer.drawLens(c, main, s, me, drag)
            top.live = false; bottom.live = false
        } else {
            renderer.drawEmpty(c, w, h)
        }
        renderer.tick(dt)
    }

    // ---- input -----------------------------------------------------------

    private fun aimLens(): Lens? = if (!tall) main else if (bottom.live) bottom else null

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        val hud = session.hud.value
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = e.x; downY = e.y; fingerX = e.x; fingerY = e.y
                blocked = false; panning = false
                val l = aimLens()
                // In the Tall layout an Aim Drag starts in the Bottom lens; a finger in the Top lens pans it.
                candidate = hud.humanTurn && !session.paused && l != null && l.rect.contains(e.x, e.y)
                return true
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                // A second finger cancels the drag (the old aim returns) and starts a pinch. Three or more are ignored.
                if (dragging.value) endDrag(keep = false, mayFire = false)
                candidate = false; blocked = true
                if (e.pointerCount == 2) { pinchDist = dist(e); pinchX = (e.getX(0) + e.getX(1)) / 2; pinchY = (e.getY(0) + e.getY(1)) / 2 }
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (e.pointerCount == 2) {
                    val d = dist(e); val mx = (e.getX(0) + e.getX(1)) / 2; val my = (e.getY(0) + e.getY(1)) / 2
                    if (pinchDist > 0) {
                        zoom = (zoom * d / pinchDist).coerceIn(0.6f, 2.1f)
                        val sc = main.scale.coerceAtLeast(0.01f)
                        panX -= (mx - pinchX) / sc; panY += (my - pinchY) / sc
                        manual.value = true
                    }
                    pinchDist = d; pinchX = mx; pinchY = my
                    return true
                }
                if (e.pointerCount > 2 || blocked) return true
                fingerX = e.x; fingerY = e.y
                val travel = hypot(e.x - downX, e.y - downY)
                if (dragging.value) updateAim()
                else if (candidate && travel >= 8f * dp) {
                    // A drag needs 8 pt of travel, not time. The spot where the finger went down is the anchor.
                    anchorX = downX; anchorY = downY
                    prevAngle = hud.aimAngle; prevPower = hud.aimPower; sentAngle = -1; sentPower = -1
                    dragging.value = true
                    updateAim()
                } else if (!candidate && travel >= 8f * dp) {
                    // Nothing to aim (Top lens, Rival's turn, flight): one finger pans.
                    val l = if (tall && top.live && top.rect.contains(downX, downY)) top else main
                    val sc = l.scale.coerceAtLeast(0.01f)
                    if (l === top) topPan -= (e.x - (if (panning) pinchX else downX)) / sc
                    else { panX -= (e.x - (if (panning) pinchX else downX)) / sc; panY += (e.y - (if (panning) pinchY else downY)) / sc }
                    pinchX = e.x; pinchY = e.y; panning = true
                    manual.value = true
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (dragging.value) {
                    // Lift within 12 pt of the anchor cancels; otherwise the aim is set and nothing fires (unless Quick Fire is on).
                    val cancel = hypot(e.x - anchorX, e.y - anchorY) < 12f * dp
                    endDrag(keep = !cancel, mayFire = !cancel)
                } else if (!blocked && !panning && hypot(e.x - downX, e.y - downY) < 10f * dp) {
                    val now = SystemClock.uptimeMillis()
                    if (now - lastTapAt < 300) { if (manual.value) reframe() else { zoom = 1.25f; manual.value = true }; lastTapAt = 0 } else lastTapAt = now
                }
                candidate = false; pinchDist = 0f
                return true
            }
            MotionEvent.ACTION_POINTER_UP -> { pinchDist = 0f; return true }
            MotionEvent.ACTION_CANCEL -> {
                // Pointer lost (call, alert, focus change): the drag cancels and the old aim returns. Nothing sticks.
                if (dragging.value) endDrag(keep = false, mayFire = false)
                candidate = false; pinchDist = 0f
                return true
            }
        }
        return super.onTouchEvent(e)
    }

    private fun dist(e: MotionEvent) = hypot(e.getX(0) - e.getX(1), e.getY(0) - e.getY(1))

    /**
     * Gesture to angle and power. Pull-back mode reads finger to anchor, point mode anchor to finger.
     * 40% of the screen's short side is power 100, so a drag feels the same in both layouts.
     * Angle snaps to 0.5 degrees while dragging, power to whole numbers. The core checks the values.
     */
    private fun updateAim() {
        var dx = anchorX - fingerX; var dy = anchorY - fingerY
        if (session.settings.pointMode) { dx = -dx; dy = -dy }
        val len = hypot(dx, dy)
        val m = resources.displayMetrics
        val full = 0.4f * min(m.widthPixels, m.heightPixels)
        val power = (len / full * 100f).roundToInt().coerceIn(0, 100)
        var deg = Math.toDegrees(atan2(-dy.toDouble(), dx.toDouble())).toFloat()
        if (deg < 0f) deg = if (dx >= 0f) 0f else 180f
        val angle = ((deg * 2f).roundToInt() * 5).coerceIn(0, 1800)
        if (angle != sentAngle || power != sentPower) {
            if (power == 100 && sentPower != 100 && sentPower >= 0) session.buzz(8)
            sentAngle = angle; sentPower = power
            session.send(Cmd.aim(angle, power))
        }
    }

    private fun endDrag(keep: Boolean, mayFire: Boolean) {
        dragging.value = false
        candidate = false
        dragEndedAt = SystemClock.uptimeMillis()
        if (!keep) session.send(Cmd.aim(prevAngle, prevPower))
        else if (mayFire && session.settings.quickFire) session.send(Cmd.FIRE)
    }
}

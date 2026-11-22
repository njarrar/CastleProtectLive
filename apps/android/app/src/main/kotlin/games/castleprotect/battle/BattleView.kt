package games.castleprotect.battle

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.RectF
import android.os.SystemClock
import android.util.Log
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import androidx.compose.runtime.mutableStateOf
import games.castleprotect.core.Frame
import games.castleprotect.core.Phase
import games.castleprotect.game.GameSession
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** One window onto the world: a screen rect, a world centre and a scale in px per cell. y grows down, as in the core. */
class Lens(val rect: RectF = RectF(), @Volatile var cx: Float = 0f, @Volatile var cy: Float = 0f, @Volatile var scale: Float = 1f, @Volatile var live: Boolean = false) {
    fun sx(wx: Float) = rect.centerX() + (wx - cx) * scale
    fun sy(wy: Float) = rect.centerY() + (wy - cy) * scale
    fun wx(sx: Float) = cx + (sx - rect.centerX()) / scale
    fun wy(sy: Float) = cy + (sy - rect.centerY()) / scale
}

/**
 * The battle field. A SurfaceView with its own render thread that draws the
 * latest frame. It also owns the Aim Drag.
 *
 * Drawing is on demand (review M6): a new frame, a moving camera, a drag or a blast
 * draws at the display rate; otherwise the idle animation draws at about 12 fps, and
 * nothing is drawn while paused.
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
    @Volatile private var draggingFlag = false
    /** True after a manual pan or zoom; the HUD shows Re-frame. */
    val manual = mutableStateOf(false)
    @Volatile private var manualFlag = false
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
    @Volatile private var bottomZoom = 1f
    @Volatile private var topZoom = 1f
    /** Copies of what input needs from the render thread (review L2). */
    @Volatile private var topLive = false
    @Volatile private var bottomLive = false
    @Volatile private var topBottomEdge = 0f
    @Volatile private var mainScale = 1f
    @Volatile private var topScale = 1f

    // Aim Drag state (screen px). Aim itself is angle and power, never screen points.
    private var downX = 0f; private var downY = 0f
    private var candidate = false
    private var panning = false
    private var panFromTop = false
    @Volatile private var anchorX = 0f
    @Volatile private var anchorY = 0f
    @Volatile private var fingerX = 0f
    @Volatile private var fingerY = 0f
    private var prevAngle = 0; private var prevPower = 0
    @Volatile private var sentAngle = -1
    @Volatile private var sentPower = -1
    private var lastX = 0f; private var lastY = 0f
    private var pinchDist = 0f; private var pinchX = 0f; private var pinchY = 0f
    private var lastTapAt = 0L
    private var blocked = false // after a pinch, a new touch is needed before aiming again

    private var thread: RenderThread? = null
    @Volatile private var redraw = true

    init { holder.addCallback(this); isFocusable = true }

    fun reframe() { zoom = 1f; topZoom = 1f; bottomZoom = 1f; panX = 0f; panY = 0f; topPan = 0f; manual.value = false; manualFlag = false; redraw = true }

    private fun setManual() { if (!manualFlag) { manualFlag = true; post { manual.value = true } } }

    // ---- surface ---------------------------------------------------------

    override fun surfaceCreated(h: SurfaceHolder) { redraw = true; thread = RenderThread().also { it.start() } }
    override fun surfaceChanged(h: SurfaceHolder, f: Int, w: Int, hh: Int) { redraw = true }
    /** Waits for the render thread to finish its frame: nothing may draw after this returns (review M1). */
    override fun surfaceDestroyed(h: SurfaceHolder) { thread?.quit(); thread = null }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        super.onSizeChanged(w, h, ow, oh)
        // Device turned or window resized mid-drag: the drag ends as if the finger lifted. The aim so far is kept, nothing fires.
        if (dragging.value) endDrag(keep = true, mayFire = false)
        candidate = false
        redraw = true
    }

    private inner class RenderThread : Thread("castle-render") {
        @Volatile private var alive = true
        fun quit() { alive = false; interrupt(); try { join() } catch (e: InterruptedException) { } }
        override fun run() {
            session.sprites.awaitIndex()
            var last = System.nanoTime()
            var lastFrame: Frame? = null
            var lastIdle = 0L
            while (alive) {
                val f = session.frame
                val now = SystemClock.uptimeMillis()
                if (session.paused) { if (!sleepQuiet(100)) return; redraw = true; continue }
                val idleDue = now - lastIdle >= IDLE_MS
                if (f === lastFrame && !redraw && !draggingFlag && !renderer.animating && !moving && !idleDue) { if (!sleepQuiet(8)) return; continue }
                if (idleDue) lastIdle = now
                lastFrame = f; redraw = false
                val c: Canvas? = try { holder.lockHardwareCanvas() } catch (e: Exception) { try { holder.lockCanvas() } catch (e2: Exception) { null } }
                if (c == null) { if (!sleepQuiet(16)) return; continue }
                try {
                    val t = System.nanoTime()
                    val dt = ((t - last) / 1e9f).coerceIn(0f, 0.1f); last = t
                    drawFrame(c, f, dt)
                } catch (e: RuntimeException) {
                    // One bad frame must not kill the app (review C2).
                    Log.e("CastleRender", "frame skipped", e)
                } finally {
                    try { holder.unlockCanvasAndPost(c) } catch (e: Exception) { }
                }
            }
        }
        private fun sleepQuiet(ms: Long): Boolean = try { sleep(ms); alive } catch (e: InterruptedException) { false }
    }

    // ---- layout and camera -----------------------------------------------

    @Volatile private var moving = false
    private var lastPhase = Phase.NONE
    private var lastTerrainFrame: Frame? = null

    /** Eases a lens toward a target. Returns true while it is still moving. */
    private fun ease(l: Lens, cx: Float, cy: Float, scale: Float, f: Frame, dt: Float): Boolean {
        val s = Camera.clampScale(scale, dp)
        val tx = Camera.clampCenter(cx, f.mapW, 200f); val ty = Camera.clampCenter(cy, f.mapH, 200f)
        if (!l.live || session.settings.reduceMotion) { l.cx = tx; l.cy = ty; l.scale = s; l.live = true; return false }
        val k = 1f - Math.exp((-dt * 12f).toDouble()).toFloat() // settles in about 250 ms
        l.cx += (tx - l.cx) * k; l.cy += (ty - l.cy) * k; l.scale += (s - l.scale) * k
        return abs(tx - l.cx) * l.scale > 0.5f || abs(ty - l.cy) * l.scale > 0.5f || abs(s - l.scale) > 0.001f
    }

    private fun frameFort(l: Lens, f: Frame, side: Int, cellPx: Float, foot: Float, pan: Float, dt: Float): Boolean {
        val k = f.castles.firstOrNull { it.side == side } ?: return false
        val dir = if (side == 0) 1f else -1f
        val s = Camera.clampScale(cellPx, dp)
        val cx = k.x + k.cols * k.block / 2f + dir * l.rect.width() * 0.16f / s + pan
        // The footing line sits [foot] px above the bottom of the lens.
        val cy = k.baseY - (l.rect.height() / 2f - foot) / s
        return ease(l, cx, cy, s, f, dt)
    }

    private val drag = FloatArray(4)
    private var readout: String? = null
    private var readoutA = -1; private var readoutP = -1

    private fun drawFrame(c: Canvas, f: Frame, dt: Float) {
        val w = width.toFloat(); val h = height.toFloat()
        if (w <= 0 || h <= 0) return
        if (f.phase != lastPhase) {
            if (f.phase == Phase.RESOLVE && manualFlag) post { reframe() } // on Fire the camera snaps back to auto-frame
            lastPhase = f.phase
        }
        if (f.terrain !== lastTerrainFrame?.terrain) renderer.clearBlasts()
        lastTerrainFrame = f
        renderer.syncTerrain(f.terrain)
        while (true) { val e = session.fx.poll() ?: break; renderer.addBlast(e.x.toFloat(), e.y.toFloat(), e.r >= 24) }
        val dragNow = if (draggingFlag) drag.also { it[0] = anchorX; it[1] = anchorY; it[2] = fingerX; it[3] = fingerY } else null
        val hob = f.selectedHob
        if (dragNow != null && hob != null && (hob.angle != readoutA || hob.power != readoutP)) {
            readoutA = hob.angle; readoutP = hob.power
            readout = "%.1f° | %d".format(hob.angle / 10f, hob.power)
        }
        val shown = if (dragNow != null) readout else null
        val me = if (f.hud.human(f.side)) f.side else if (f.hud.human(0)) 0 else 1
        val flying = f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE
        var mv = false
        if (f.castles.size < 2) { renderer.drawEmpty(c); renderer.tick(dt); moving = false; return }
        if (tall) {
            val stripH = 32f * dp
            if (flying) {
                // The two lenses join into one tall view that rides with the shell; the Field Strip slides to its foot.
                main.rect.set(0f, 0f, w, h - stripH); strip.set(0f, h - stripH, w, h)
                val scale = 0.62f * dp * zoom
                val sh = f.shells.firstOrNull()
                if (sh != null && !manualFlag) {
                    val ground = f.groundAt(sh.x).toFloat()
                    val cy = min(sh.y.toFloat(), ground - (main.rect.height() / 2f - 120f * dp) / scale)
                    mv = ease(main, sh.x.toFloat(), cy, scale, f, dt)
                } else if (!main.live) mv = frameFort(main, f, me, scale, 120f * dp, 0f, dt)
                else {
                    mv = ease(main, main.cx + panX, main.cy + panY, scale, f, dt); panX = 0f; panY = 0f
                }
                renderer.drawLens(c, main, f, me, null, null)
                top.live = false; bottom.live = false
                renderer.drawStrip(c, strip, f, main, null)
            } else {
                val topH = ((h - stripH) * 0.39f)
                top.rect.set(0f, 0f, w, topH); strip.set(0f, topH, w, topH + stripH); bottom.rect.set(0f, topH + stripH, w, h)
                mv = frameFort(top, f, 1 - me, 0.75f * dp * topZoom, 36f * dp, topPan, dt)        // target fort, blocks about 12 pt
                mv = frameFort(bottom, f, me, 1.0f * dp * bottomZoom, 96f * dp, 0f, dt) || mv     // your fort, blocks about 16 pt
                renderer.drawLens(c, top, f, me, null, null)
                renderer.drawLens(c, bottom, f, me, dragNow, shown)
                main.live = false
                renderer.drawStrip(c, strip, f, top, bottom)
            }
        } else {
            main.rect.set(0f, 0f, w, h)
            val p = hudPad
            val clearW = max(1f, w - p[0] - p[2]); val clearH = max(1f, h - p[1] - p[3])
            val a = f.castles[0]; val b = f.castles[1]
            val left = a.x.toFloat(); val right = (b.x + b.cols * b.block).toFloat()
            val base = max(a.baseY, b.baseY).toFloat()
            val sh = f.shells.firstOrNull()
            val scale = Camera.clampScale(Camera.wideScale(clearW, clearH, abs(right - left), sh?.let { base - it.y }, dp) * zoom, dp)
            // Bias 55/45 toward the rival of whoever is looking.
            val cx = (left + right) / 2f + (if (me == 0) 1 else -1) * abs(right - left) * 0.02f + ((p[2] - p[0]) / 2f) / scale + panX
            // The lower footing line sits 40 dp above the bottom HUD.
            val cy = base - (h / 2f - p[3] - 40f * dp) / scale + panY
            mv = ease(main, cx, cy, scale, f, dt)
            renderer.drawLens(c, main, f, me, dragNow, shown)
            top.live = false; bottom.live = false
        }
        moving = mv
        // Copies for input on the UI thread.
        topLive = top.live; bottomLive = bottom.live; topBottomEdge = top.rect.bottom; mainScale = main.scale; topScale = top.scale
        renderer.tick(dt)
    }

    // ---- input -----------------------------------------------------------

    private fun inAimLens(x: Float, y: Float): Boolean = if (!tall) true else bottomLive && y > topBottomEdge + 32f * dp

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        val u = session.ui.value
        redraw = true
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = e.x; downY = e.y; fingerX = e.x; fingerY = e.y; lastX = e.x; lastY = e.y
                blocked = false; panning = false
                // In the Tall layout an Aim Drag starts in the Bottom lens; a finger in the Top lens pans it.
                candidate = u.humanTurn && u.selected != null && !session.paused && session.handoffTo < 0 && inAimLens(e.x, e.y)
                panFromTop = tall && topLive && e.y <= topBottomEdge
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
                val fw = max(1, session.frame.mapW); val fh = max(1, session.frame.mapH)
                if (e.pointerCount == 2) {
                    val d = dist(e); val mx = (e.getX(0) + e.getX(1)) / 2; val my = (e.getY(0) + e.getY(1)) / 2
                    if (pinchDist > 0) {
                        val k = d / pinchDist
                        // Each lens has its own pinch range in the Tall layout.
                        if (tall && !session.ui.value.flying) { if (pinchY <= topBottomEdge) topZoom = Camera.clampZoom(topZoom * k) else bottomZoom = Camera.clampZoom(bottomZoom * k) }
                        else zoom = Camera.clampZoom(zoom * k)
                        val sc = Camera.clampScale(mainScale, dp)
                        panX = Camera.clampPan(panX - (mx - pinchX) / sc, fw); panY = Camera.clampPan(panY - (my - pinchY) / sc, fh)
                        setManual()
                    }
                    pinchDist = d; pinchX = mx; pinchY = my
                    return true
                }
                if (e.pointerCount > 2 || blocked) return true
                fingerX = e.x; fingerY = e.y
                val travel = hypot(e.x - downX, e.y - downY)
                if (draggingFlag) updateAim()
                else if (candidate && travel >= 8f * dp) {
                    // A drag needs 8 pt of travel, not time. The spot where the finger went down is the anchor.
                    val sel = u.selected
                    anchorX = downX; anchorY = downY
                    prevAngle = sel?.angle ?: 0; prevPower = sel?.power ?: 0; sentAngle = -1; sentPower = -1
                    draggingFlag = true; dragging.value = true
                    updateAim()
                } else if (!candidate && travel >= 8f * dp) {
                    // Nothing to aim (Top lens, Rival's turn, flight): one finger pans.
                    if (panFromTop) topPan = Camera.clampPan(topPan - (e.x - lastX) / Camera.clampScale(topScale, dp), fw)
                    else if (!tall || session.ui.value.flying) {
                        val sc = Camera.clampScale(mainScale, dp)
                        panX = Camera.clampPan(panX - (e.x - lastX) / sc, fw); panY = Camera.clampPan(panY - (e.y - lastY) / sc, fh)
                    }
                    panning = true
                    setManual()
                }
                lastX = e.x; lastY = e.y
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (draggingFlag) {
                    // Lift within 12 pt of the anchor cancels; otherwise the aim is set and nothing fires (unless Quick Fire is on).
                    val cancel = hypot(e.x - anchorX, e.y - anchorY) < 12f * dp
                    endDrag(keep = !cancel, mayFire = !cancel)
                } else if (!blocked && !panning && hypot(e.x - downX, e.y - downY) < 10f * dp) {
                    val now = SystemClock.uptimeMillis()
                    if (now - lastTapAt < 300) { if (manualFlag) reframe() else { zoom = 1.25f; setManual() }; lastTapAt = 0 } else lastTapAt = now
                }
                candidate = false; pinchDist = 0f
                return true
            }
            MotionEvent.ACTION_POINTER_UP -> { pinchDist = 0f; return true }
            MotionEvent.ACTION_CANCEL -> {
                // Pointer lost (call, alert, focus change): the drag cancels and the old aim returns. Nothing sticks.
                if (draggingFlag) endDrag(keep = false, mayFire = false)
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
     * The values are sent as they are; the core checks and keeps them.
     */
    private fun updateAim() {
        val m = resources.displayMetrics
        val (angle, power) = Aim.fromDrag(anchorX - fingerX, anchorY - fingerY, session.settings.pointMode, 0.4f * min(m.widthPixels, m.heightPixels))
        if (angle != sentAngle || power != sentPower) {
            if (power == 100 && sentPower != 100 && sentPower >= 0) session.buzz(8)
            sentAngle = angle; sentPower = power
            session.aim(angle, power)
        }
    }

    private fun endDrag(keep: Boolean, mayFire: Boolean) {
        draggingFlag = false
        dragging.value = false
        candidate = false
        dragEndedAt = SystemClock.uptimeMillis()
        if (!keep) session.aim(prevAngle, prevPower)
        else if (mayFire && session.settings.quickFire) session.send(games.castleprotect.core.Cmd.FIRE)
    }

    companion object { private const val IDLE_MS = 83L }
}

/** Aim Drag maths, apart from the view so it can be tested. */
object Aim {
    /**
     * dx, dy: anchor minus finger in screen px (y down). Returns angle in tenths of a
     * degree (0 right, 900 up, 1800 left) snapped to half degrees, and power 0 to 100.
     */
    fun fromDrag(dx0: Float, dy0: Float, pointMode: Boolean, fullPx: Float): Pair<Int, Int> {
        var dx = dx0; var dy = dy0
        if (pointMode) { dx = -dx; dy = -dy }
        val len = hypot(dx, dy)
        val power = (len / max(1f, fullPx) * 100f).roundToInt().coerceIn(0, 100)
        var deg = Math.toDegrees(atan2(-dy.toDouble(), dx.toDouble())).toFloat()
        if (deg < 0f) deg = if (dx >= 0f) 0f else 180f
        val angle = ((deg * 2f).roundToInt() * 5).coerceIn(0, 1800)
        return angle to power
    }
}

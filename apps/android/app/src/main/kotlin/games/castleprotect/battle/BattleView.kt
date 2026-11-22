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
 * Drawing is on demand (review M6, review 2 N-M2, N-M3): a new frame, a moving camera,
 * a drag or a blast draws at up to 60 fps; ambient motion (wind leaves, shimmer, the
 * Squall) and idle poses draw at about 12 fps. While paused the field draws once when
 * the surface is new or changes size (return from Home, a turn of the device), then
 * waits, so it is never left black behind the Pause card.
 */
@SuppressLint("ViewConstructor")
class BattleView(ctx: Context, private val session: GameSession) : SurfaceView(ctx), SurfaceHolder.Callback {
    private val dp = resources.displayMetrics.density
    private val fieldFx = FieldFx(
        session.sprites, dp,
        cue = { anim, event, x, shot -> session.animCue(anim, event, x, shot) },
        beat = { kind, n, x, y -> session.viewBeat(kind, n, x, y) },
        reduceMotion = { session.settings.reduceMotion },
        trailOf = { shot -> session.content.trail(shot) },
    )
    private val renderer = BattleRenderer(session.sprites, dp, fieldFx)
    private val shakeOut = FloatArray(3)

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
    @Volatile private var bottomPan = 0f
    @Volatile private var bottomZoom = 1f
    @Volatile private var topZoom = 1f
    /** Copies of what input needs from the render thread (review L2). */
    @Volatile private var topLive = false
    @Volatile private var bottomLive = false
    @Volatile private var topBottomEdge = 0f
    @Volatile private var mainScale = 1f
    @Volatile private var topScale = 1f
    @Volatile private var bottomScale = 1f

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

    fun reframe() { zoom = 1f; topZoom = 1f; bottomZoom = 1f; panX = 0f; panY = 0f; topPan = 0f; bottomPan = 0f; manual.value = false; manualFlag = false; redraw = true }

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
            var lastDraw = 0L
            while (alive) {
                val f = session.frame
                val now = SystemClock.uptimeMillis()
                val paused = session.paused
                if (paused && !redraw) { if (!sleepQuiet(100)) return; continue }
                val idleDue = now - lastIdle >= IDLE_MS
                if (!paused && f === lastFrame && !redraw && !draggingFlag && !renderer.animating && !moving && !idleDue && session.juice.calm && session.fxFrames.isEmpty()) { if (!sleepQuiet(8)) return; continue }
                // At most 60 fps, also on a 120 Hz screen.
                val wait = FRAME_MIN_MS - (now - lastDraw)
                if (wait > 0) { if (!sleepQuiet(wait)) return; continue }
                lastDraw = now
                if (idleDue) lastIdle = now
                lastFrame = f; redraw = false
                val c: Canvas? = try { holder.lockHardwareCanvas() } catch (e: Exception) { try { holder.lockCanvas() } catch (e2: Exception) { null } }
                if (c == null) { if (!sleepQuiet(16)) return; continue }
                try {
                    val t = System.nanoTime()
                    // Paused: one still frame (no time passes for the field).
                    val dt = if (paused) 0f else ((t - last) / 1e9f).coerceIn(0f, 0.1f); last = t
                    // View time: frozen in a hit stop, slowed in slow motion (docs/design/07 section 6).
                    val scale = session.juice.scale(SystemClock.uptimeMillis())
                    drawFrame(c, f, dt, dt * scale)
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
        val k = 1f - Math.exp((-dt * 9f).toDouble()).toFloat() // settles in about 400 ms
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

    // Camera state for the Wide layout (docs/design/07 section 3.5).
    private var hadShells = false
    private var lastShellX = 0f; private var lastShellY = 0f
    private var impactAt = 0L
    private var impactX = 0f; private var impactY = 0f
    private val fitOut = FloatArray(3)

    private fun drawFrame(c: Canvas, f: Frame, dt: Float, viewDt: Float) {
        val w = width.toFloat(); val h = height.toFloat()
        if (w <= 0 || h <= 0) return
        if (f.phase != lastPhase) {
            if (f.phase == Phase.RESOLVE && manualFlag) post { reframe() } // on Fire the camera snaps back to auto-frame
            lastPhase = f.phase
        }
        if (f.terrain !== lastTerrainFrame?.terrain) { fieldFx.clear(); hadShells = false; impactAt = 0L }
        lastTerrainFrame = f
        fieldFx.anims = session.anims
        renderer.reduceMotion = session.settings.reduceMotion
        renderer.syncTerrain(f.terrain)
        while (true) { val e = session.fxFrames.poll() ?: break; fieldFx.onFrame(e) }
        fieldFx.update(f, viewDt * 1000f)
        session.juice.shake(dt * 1000f, aiming = f.phase == Phase.PLAN, shakeOut)
        val dragNow = if (draggingFlag) drag.also { it[0] = anchorX; it[1] = anchorY; it[2] = fingerX; it[3] = fingerY } else null
        val hob = f.selectedHob
        if (dragNow != null && hob != null && (hob.angle != readoutA || hob.power != readoutP)) {
            readoutA = hob.angle; readoutP = hob.power
            readout = String.format(java.util.Locale.ROOT, "%.1f° | %d", hob.angle / 10f, hob.power)
        }
        val shown = if (dragNow != null) readout else null
        val me = if (f.hud.human(f.side)) f.side else if (f.hud.human(0)) 0 else 1
        val flying = f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE
        var mv = false
        if (f.castles.size < 2) { renderer.drawEmpty(c); renderer.tick(viewDt); moving = false; return }
        val now = SystemClock.uptimeMillis()
        val sh = f.shells.firstOrNull()
        if (sh != null) { hadShells = true; lastShellX = sh.x.toFloat(); lastShellY = sh.y.toFloat(); impactAt = 0L }
        else if (hadShells) { hadShells = false; impactAt = now; impactX = lastShellX; impactY = lastShellY }
        if (tall) {
            val stripH = 32f * dp
            if (flying) {
                // The two lenses join into one tall view that rides with the shell; the Field Strip slides to its foot.
                main.rect.set(0f, 0f, w, h - stripH); strip.set(0f, h - stripH, w, h)
                val scale = max(Camera.minBlockScale(dp), 0.62f * dp * zoom)
                if (sh != null && !manualFlag) {
                    val ground = f.groundAt(sh.x).toFloat()
                    val cy = min(sh.y.toFloat(), ground - (main.rect.height() / 2f - 120f * dp) / scale)
                    mv = ease(main, sh.x.toFloat(), cy, scale, f, dt)
                } else if (!main.live) mv = frameFort(main, f, me, scale, 120f * dp, 0f, dt)
                else {
                    mv = ease(main, main.cx + panX, main.cy + panY, scale, f, dt); panX = 0f; panY = 0f
                }
                renderer.drawLens(c, main, f, me, null, null, shakeOut)
                top.live = false; bottom.live = false
                renderer.drawStrip(c, strip, f, main, null)
            } else {
                val topH = ((h - stripH) * 0.39f)
                top.rect.set(0f, 0f, w, topH); strip.set(0f, topH, w, topH + stripH); bottom.rect.set(0f, topH + stripH, w, h)
                mv = frameFort(top, f, 1 - me, 0.75f * dp * topZoom, 36f * dp, topPan, dt)        // target fort, blocks about 12 pt
                mv = frameFort(bottom, f, me, 1.0f * dp * bottomZoom, 96f * dp, bottomPan, dt) || mv     // your fort, blocks about 16 pt
                renderer.drawLens(c, top, f, me, null, null, shakeOut)
                renderer.drawLens(c, bottom, f, me, dragNow, shown, null) // never shake under the aiming thumb
                main.live = false
                renderer.drawStrip(c, strip, f, top, bottom)
            }
        } else {
            main.rect.set(0f, 0f, w, h)
            val p = hudPad
            val clearW = max(1f, w - p[0] - p[2]); val clearH = max(1f, h - p[1] - p[3])
            // No camera move while a finger aims (07: "Holds still"): the target is frozen for the drag (review 2 N-M6).
            if (!draggingFlag || !main.live) wideTarget(f, me, clearW, clearH, now)
            var scale = fitOut[2] * zoom
            scale = max(Camera.minBlockScale(dp), Camera.clampScale(scale, dp))
            // The clear rect's centre sits off the screen centre by the HUD pads.
            val cx = fitOut[0] - ((p[0] - p[2]) / 2f) / scale + panX
            val cy = fitOut[1] - ((p[1] - p[3]) / 2f) / scale + panY
            mv = ease(main, cx, cy, scale, f, dt)
            renderer.drawLens(c, main, f, me, dragNow, shown, shakeOut)
            top.live = false; bottom.live = false
        }
        // Shake at 0%: a 2 pt white rim flash on the blast in its place, unless Reduce flashes is on.
        val fl = session.juice.flash
        if (fl > 0f && !session.settings.reduceFlashes) {
            rim.strokeWidth = 4f * dp; rim.alpha = (fl * 0.3f * 255).toInt().coerceIn(0, 255)
            c.drawRect(2f * dp, 2f * dp, w - 2f * dp, h - 2f * dp, rim)
        }
        moving = mv || !session.juice.calm
        // Copies for input on the UI thread.
        topLive = top.live; bottomLive = bottom.live; topBottomEdge = top.rect.bottom; mainScale = main.scale; topScale = top.scale; bottomScale = bottom.scale
        renderer.tick(viewDt)
    }

    private val rim = android.graphics.Paint().apply { style = android.graphics.Paint.Style.STROKE; color = android.graphics.Color.WHITE }

    private fun fortBox(k: games.castleprotect.core.Castle, out: FloatArray) {
        out[0] = k.x.toFloat(); out[1] = k.topY - 40f; out[2] = (k.x + k.cols * k.block).toFloat(); out[3] = k.baseY + 12f
    }
    private val boxA = FloatArray(4); private val boxB = FloatArray(4)

    /**
     * Where the Wide camera wants to be (fitOut: centre and scale before zoom):
     * - your turn: your fort plus the preview arc (and the rival's fort when it still fits with 8 dp blocks);
     * - the Rival's turn: both forts if they fit, else the Rival's fort with room toward yours;
     * - flight: the shell and the fort it flies at, following the shell with a dead zone when they do not fit;
     * - impact: hold on the hit for 0.6 s, then widen to the fort that was hit.
     */
    private fun wideTarget(f: Frame, me: Int, w: Float, h: Float, now: Long) {
        val floor = Camera.minBlockScale(dp); val ceil = 1.4f * dp
        val sh = f.shells.firstOrNull()
        // Never index a missing fort: fall back to the other one, then to the whole map.
        val active = Camera.fortOrNull(f.castles, f.side) ?: Camera.fortOrNull(f.castles, 1 - f.side)
        val other = Camera.fortOrNull(f.castles, 1 - f.side) ?: active
        if (active == null || other == null) { fitOut[0] = f.mapW / 2f; fitOut[1] = f.mapH / 2f; fitOut[2] = max(floor, min(w / max(1, f.mapW), h / max(1, f.mapH))); return }
        fortBox(active, boxA); fortBox(other, boxB)
        val margin = 24f
        when {
            sh != null && !manualFlag -> {
                // Shell plus the fort it flies at.
                val x0 = min(sh.x.toFloat(), boxB[0]); val x1 = max(sh.x.toFloat(), boxB[2])
                val y0 = min(sh.y.toFloat(), boxB[1]); val y1 = max(sh.y.toFloat(), boxB[3])
                Camera.fit(x0, y0, x1, y1, w, h, margin, floor, ceil, fitOut)
                if (fitOut[2] <= floor + 1e-4f || session.settings.reduceMotion) {
                    // Too wide to show both at 8 dp blocks: follow the shell with a 30% dead zone (a wide fixed frame with Reduce motion: it jumps only when the shell leaves).
                    val zone = if (session.settings.reduceMotion) 0.9f else 0.3f
                    val halfW = w / 2f / floor; val halfH = h / 2f / floor
                    fitOut[0] = Camera.follow(if (main.live) main.cx else sh.x.toFloat(), sh.x.toFloat(), halfW, zone)
                    fitOut[1] = Camera.follow(if (main.live) main.cy else sh.y.toFloat(), sh.y.toFloat(), halfH, zone)
                    fitOut[2] = floor
                }
            }
            impactAt != 0L && now - impactAt < 600 && (f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE) -> {
                fitOut[0] = impactX; fitOut[1] = impactY; fitOut[2] = if (main.live) main.scale / max(0.01f, zoom) else floor
            }
            f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE -> {
                // Widen to show the collapse settle on the fort nearest the hit.
                val hit = if (impactAt != 0L && abs(impactX - (boxA[0] + boxA[2]) / 2f) < abs(impactX - (boxB[0] + boxB[2]) / 2f)) boxA else boxB
                Camera.fit(hit[0], hit[1], hit[2], hit[3], w, h, margin * 3, floor, ceil, fitOut)
            }
            f.phase == Phase.PLAN && f.hud.human(f.side) -> {
                // Your fort plus the arc; add the rival's fort when it still fits.
                var x0 = boxA[0]; var y0 = boxA[1]; var x1 = boxA[2]; var y1 = boxA[3]
                val pv = f.preview
                var i = 0
                while (i + 1 < pv.size) { x0 = min(x0, pv[i].toFloat()); x1 = max(x1, pv[i].toFloat()); y0 = min(y0, pv[i + 1].toFloat()); y1 = max(y1, pv[i + 1].toFloat()); i += 2 }
                val ax0 = min(x0, boxB[0]); val ax1 = max(x1, boxB[2]); val ay0 = min(y0, boxB[1]); val ay1 = max(y1, boxB[3])
                Camera.fit(ax0, ay0, ax1, ay1, w, h, margin, floor, ceil, fitOut)
                if (fitOut[2] <= floor + 1e-4f) {
                    // Both do not fit: your fort and the arc, with a little lean toward the rival.
                    val lean = if (boxB[0] > boxA[0]) 80f else -80f
                    Camera.fit(min(x0, x0 + lean), y0, max(x1, x1 + lean), y1, w, h, margin, floor, ceil, fitOut)
                }
            }
            else -> {
                val x0 = min(boxA[0], boxB[0]); val x1 = max(boxA[2], boxB[2])
                Camera.fit(x0, min(boxA[1], boxB[1]), x1, max(boxA[3], boxB[3]), w, h, margin, floor, ceil, fitOut)
                if (fitOut[2] <= floor + 1e-4f) {
                    // Both forts do not fit: the side on turn, with room toward the other.
                    val toward = if (boxB[0] > boxA[0]) 1f else -1f
                    val span = w / floor
                    fitOut[0] = (boxA[0] + boxA[2]) / 2f + toward * span * 0.2f
                    fitOut[1] = (boxA[1] + boxA[3]) / 2f
                    fitOut[2] = floor
                }
            }
        }
    }

    // ---- input -----------------------------------------------------------

    private fun inAimLens(x: Float, y: Float): Boolean = if (!tall) true else bottomLive && y > topBottomEdge + 32f * dp

    /** True when a press at screen [x], [y] may start an Aim Drag: on the side on turn's fort (plus two blocks) or within 48 dp of the picked Hob. */
    private fun onOwnFort(x: Float, y: Float): Boolean {
        val f = session.frame
        val l = if (tall) bottom else main
        if (!l.live) return false
        val k = Camera.fortOrNull(f.castles, f.side) ?: return true
        val hob = f.selectedHob
        val hobDist = if (hob != null) hypot(x - l.sx(hob.x.toFloat()), y - l.sy(hob.y.toFloat())) else Float.POSITIVE_INFINITY
        return Aim.startsOnOwnFort(l.wx(x), l.wy(y), k.x.toFloat(), k.topY.toFloat(), (k.x + k.cols * k.block).toFloat(), k.baseY.toFloat(), hobDist, dp)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        val u = session.ui.value
        redraw = true
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = e.x; downY = e.y; fingerX = e.x; fingerY = e.y; lastX = e.x; lastY = e.y
                blocked = false; panning = false
                // In the Tall layout an Aim Drag starts in the Bottom lens; a finger in the Top lens pans it.
                // An Aim Drag starts only on your own fort or by the picked Hob (00 section 2.3); a press anywhere else pans.
                candidate = u.humanTurn && u.selected != null && !session.paused && session.handoffTo < 0 && inAimLens(e.x, e.y) && onOwnFort(e.x, e.y)
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
                    session.audio.play("aim_drag_start")
                    session.buzz(8)
                    updateAim()
                } else if (!candidate && travel >= 8f * dp) {
                    // Nothing to aim (Top lens, open sky, Rival's turn, flight): one finger pans.
                    if (panFromTop) topPan = Camera.clampPan(topPan - (e.x - lastX) / Camera.clampScale(topScale, dp), fw)
                    else if (tall && !session.ui.value.flying) bottomPan = Camera.clampPan(bottomPan - (e.x - lastX) / Camera.clampScale(bottomScale, dp), fw)
                    else {
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
            // The band's pitch follows power. Started and stopped on the UI thread only (review 2 N-L6).
            if (draggingFlag) session.audio.loop("aim_band_stretch", true, semis = power * 12f / 100f)
        }
    }

    private fun endDrag(keep: Boolean, mayFire: Boolean) {
        draggingFlag = false
        dragging.value = false
        candidate = false
        dragEndedAt = SystemClock.uptimeMillis()
        session.audio.loop("aim_band_stretch", false)
        session.audio.play("aim_set", semis = if (keep) 0f else -5f)
        if (!keep) session.aim(prevAngle, prevPower)
        else if (mayFire && session.settings.quickFire) session.fire()
    }

    companion object {
        private const val IDLE_MS = 83L
        private const val FRAME_MIN_MS = 16L
    }
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

    /** Fort margin in cells for an aim start: about two blocks. */
    const val FORT_MARGIN = 32f
    /** Press radius around the picked Hob for an aim start, in dp. */
    const val HOB_RADIUS_DP = 48f

    /**
     * 00 section 2.3: an Aim Drag may only start on the side on turn's fort ([fx0], [fy0] to [fx1], [fy1]
     * in world cells, grown by [FORT_MARGIN]) or within [HOB_RADIUS_DP] of the picked Hob ([hobDistPx]
     * screen px away). [wx], [wy] is the press in world cells. Anywhere else the press pans.
     */
    fun startsOnOwnFort(wx: Float, wy: Float, fx0: Float, fy0: Float, fx1: Float, fy1: Float, hobDistPx: Float, dp: Float): Boolean {
        val m = FORT_MARGIN
        if (wx >= min(fx0, fx1) - m && wx <= max(fx0, fx1) + m && wy >= min(fy0, fy1) - m && wy <= max(fy0, fy1) + m) return true
        return hobDistPx <= HOB_RADIUS_DP * dp
    }

    /**
     * One finger gesture from [down] to [up] (screen px) against the current aim [prev]. The aim changes
     * only when the press [startsOnFort] (see [startsOnOwnFort]) and lifts 12 dp or more from it; otherwise it pans and [prev] is kept.
     */
    fun afterDrag(startsOnFort: Boolean, downX: Float, downY: Float, upX: Float, upY: Float, prev: Pair<Int, Int>, pointMode: Boolean, fullPx: Float, dp: Float): Pair<Int, Int> {
        // No fort start: the finger pans. A lift within 12 dp of the anchor cancels (8 dp starts the drag).
        if (!startsOnFort || hypot(upX - downX, upY - downY) < 12f * dp) return prev
        return fromDrag(downX - upX, downY - upY, pointMode, fullPx)
    }
}

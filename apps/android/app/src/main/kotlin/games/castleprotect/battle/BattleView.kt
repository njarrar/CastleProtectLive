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
import games.castleprotect.game.FireLight
import games.castleprotect.game.GameSession
import games.castleprotect.game.OwnerRule
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
    /** Copies of what input needs from the render thread (review L2, Android-L2). */
    private class AimLensSnap(
        val left: Float, val top: Float, val right: Float, val bottom: Float,
        val cx: Float, val cy: Float, scale: Float, val live: Boolean,
    ) {
        val scale = if (scale > 0f) scale else 1f
        private val midX = (left + right) * 0.5f
        private val midY = (top + bottom) * 0.5f
        fun sx(wx: Float) = midX + (wx - cx) * this.scale
        fun sy(wy: Float) = midY + (wy - cy) * this.scale
        fun wx(sx: Float) = cx + (sx - midX) / this.scale
        fun wy(sy: Float) = cy + (sy - midY) / this.scale
    }
    @Volatile private var aimSnap = AimLensSnap(0f, 0f, 0f, 0f, 0f, 0f, 1f, false)
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
    /** The angle the pull had before the finger met the screen edge (QA playtest 1, m3). */
    private var heldAngle = -1
    @Volatile private var sentAngle = -1
    @Volatile private var sentPower = -1
    private var lastX = 0f; private var lastY = 0f
    private var pinchDist = 0f; private var pinchX = 0f; private var pinchY = 0f
    private var lastTapAt = 0L
    private var blocked = false // after a pinch, a new touch is needed before aiming again

    /** A phone (smallest width under 600 dp): the Wide plan frame may go down to 6 dp blocks (QA playtest 2, N3). */
    private val phone = resources.configuration.smallestScreenWidthDp in 1 until 600
    /** Wide layout Rival fort peek button state exposed to Compose for TalkBack accessibility (Android-L1, Android-L8). */
    val rivalPeekVisible = mutableStateOf(false)
    val rivalPeekRight = mutableStateOf(true)
    val rivalPeekOn = mutableStateOf(false)
    @Volatile private var rivalPeekVisFlag = false
    @Volatile private var rivalPeekRightFlag = true
    @Volatile private var rivalPeekOnFlag = false
    private var markX = 0f; private var markY = 0f
    /** Until when "Drag from your fort to aim" shows by your fort (uptime ms). */
    @Volatile private var nudgeUntil = 0L

    private var thread: RenderThread? = null
    @Volatile private var redraw = true

    init { holder.addCallback(this); isFocusable = true }

    fun reframe() { zoom = 1f; topZoom = 1f; bottomZoom = 1f; panX = 0f; panY = 0f; topPan = 0f; bottomPan = 0f; manual.value = false; manualFlag = false; redraw = true }

    /** Toggles the Wide layout Rival fort peek (called by the Compose Rival Peek button). */
    fun tapRivalPeek() {
        if (!session.peek.on) reframe()
        session.peek.tap()
        session.audio.play("ui_tap")
        rivalPeekOnFlag = session.peek.on
        rivalPeekOn.value = session.peek.on
        redraw = true
    }

    private fun updateRivalPeek(vis: Boolean, right: Boolean, on: Boolean) {
        if (vis != rivalPeekVisFlag || right != rivalPeekRightFlag || on != rivalPeekOnFlag) {
            rivalPeekVisFlag = vis; rivalPeekRightFlag = right; rivalPeekOnFlag = on
            post {
                rivalPeekVisible.value = vis
                rivalPeekRight.value = right
                rivalPeekOn.value = on
            }
        }
    }

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
        renderer.teachRing = session.teachRing
        renderer.mendTarget = session.mendTargetCell
        renderer.mendSide = f.side
        session.peek.onFrame(f.hud.turn, f.phase == Phase.RESOLVE || f.shells.isNotEmpty())
        renderer.syncTerrain(f.terrain)
        while (true) { val e = session.fxFrames.poll() ?: break; fieldFx.onFrame(e) }
        fieldFx.update(f, viewDt * 1000f)
        session.collapseShowing = fieldFx.collapseShowing
        // Suppress shake only while aiming calmly; allow Round 10 Fatigue and post-settle collapse shakes (Android-M2).
        session.juice.shake(dt * 1000f, aiming = draggingFlag || (f.phase == Phase.PLAN && !session.fatigueShaking && !fieldFx.collapseShowing), shakeOut)
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
                } else if (!main.live || (sh == null && session.fatigue.holdHome)) mv = frameFort(main, f, me, scale, 120f * dp, 0f, dt) // the Fatigue collapse: your own fort (N1)
                else {
                    mv = ease(main, main.cx + panX, main.cy + panY, scale, f, dt); panX = 0f; panY = 0f
                }
                renderer.drawLens(c, main, f, me, null, null, shakeOut)
                top.live = false; bottom.live = false
                renderer.drawStrip(c, strip, f, main, null)
            } else {
                val topH = ((h - stripH) * 0.39f)
                top.rect.set(0f, 0f, w, topH); strip.set(0f, topH, w, topH + stripH); bottom.rect.set(0f, topH + stripH, w, h)
                // Auto-frame Rescue objectives (1-7 Cage + Hetty) in the Top Lens until cleared (Part 2 §1.5).
                val rescueProp = if (f.hud.rules.objectiveTag == "cage") {
                    f.props.firstOrNull { it.kind == "captive" } ?: f.props.firstOrNull { it.kind == "cage_bar" }
                } else null
                val cageStanding = rescueProp != null && f.props.any { it.kind == "cage_bar" }
                mv = if (cageStanding && rescueProp != null) {
                    val s = Camera.clampScale(0.82f * dp * topZoom, dp)
                    val cy = rescueProp.y.toFloat() - (top.rect.height() / 2f - 44f * dp) / s
                    ease(top, rescueProp.x.toFloat() + topPan, cy, s, f, dt)
                } else {
                    frameFort(top, f, 1 - me, 0.75f * dp * topZoom, 36f * dp, topPan, dt) // target fort, blocks about 12 pt
                }
                // Walk rail moved into stitched bottom dock -> lower fort & 3 Stompers sit cleanly unobstructed (Part 2 Plate 2).
                mv = frameFort(bottom, f, me, 1.0f * dp * bottomZoom, 56f * dp, bottomPan, dt) || mv
                renderer.drawLens(c, top, f, me, null, null, shakeOut)
                renderer.drawLens(c, bottom, f, me, dragNow, shown, null) // never shake under the aiming thumb
                main.live = false
                renderer.drawStrip(c, strip, f, top, bottom)
            }
            updateRivalPeek(false, rivalPeekRightFlag, false)
        } else {
            main.rect.set(0f, 0f, w, h)
            val p = hudPad
            val clearW = max(1f, w - p[0] - p[2]); val clearH = max(1f, h - p[1] - p[3])
            // No camera move while a finger aims (07: "Holds still"): the target is frozen for the drag (review 2 N-M6).
            if (!draggingFlag || !main.live) wideTarget(f, me, clearW, clearH, now)
            val peeking = session.peek.on && !flying
            var scale = fitOut[2] * (if (peeking) 1f else zoom)
            scale = max(if (peeking) Camera.minScale(dp) else if (f.phase == Phase.PLAN) Camera.planBlockScale(dp, phone) else Camera.minBlockScale(dp), Camera.clampScale(scale, dp))
            // The clear rect's centre sits off the screen centre by the HUD pads.
            val cx = fitOut[0] - ((p[0] - p[2]) / 2f) / scale + (if (peeking) 0f else panX)
            val cy = fitOut[1] - ((p[1] - p[3]) / 2f) / scale + (if (peeking) 0f else panY)
            mv = ease(main, cx, cy, scale, f, dt)
            renderer.drawLens(c, main, f, me, dragNow, shown, shakeOut)
            top.live = false; bottom.live = false
            // Your fort is framed and the Rival's does not fit: expose Rival Peek button to Compose (M3, N3, Android-L1, Android-L8).
            var showMark = false
            var right = rivalPeekRightFlag
            if (!flying) Camera.fortOrNull(f.castles, 1 - me)?.let { k ->
                val mk = Camera.offscreenMarker(main.sx(k.x.toFloat()), main.sx((k.x + k.cols * k.block).toFloat()), main.sy((k.topY + k.baseY) / 2f),
                    w, h, p[0], p[2], p[1] + 8f * dp, p[3] + 8f * dp)
                if (mk != null && !peeking) {
                    markX = mk[0].coerceIn(p[0], max(p[0], w - p[2]))
                    markY = mk[1].coerceIn(p[1] + 24f * dp, max(p[1] + 24f * dp, h - p[3] - 24f * dp))
                    right = mk[2] > 0f
                    showMark = true
                } else if (peeking) {
                    markX = (if (right) w - p[2] else p[0]).coerceIn(p[0], max(p[0], w - p[2]))
                    markY = (if (markY > 0f) markY else h / 2f).coerceIn(p[1] + 24f * dp, max(p[1] + 24f * dp, h - p[3] - 24f * dp))
                    showMark = true
                }
            }
            updateRivalPeek(showMark, right, peeking)
        }
        if (now < nudgeUntil && !flying) drawNudge(c, f, me)
        // Shake at 0%: a 2 pt white rim flash on the blast in its place, unless Reduce flashes is on.
        val fl = session.juice.flash
        if (fl > 0f && !session.settings.reduceFlashes) {
            rim.strokeWidth = 4f * dp; rim.alpha = (fl * 0.3f * 255).toInt().coerceIn(0, 255)
            c.drawRect(2f * dp, 2f * dp, w - 2f * dp, h - 2f * dp, rim)
        }
        moving = mv || !session.juice.calm
        // Immutable snapshot and copies for input on the UI thread (Android-L2).
        val aimL = if (tall) bottom else main
        aimSnap = AimLensSnap(aimL.rect.left, aimL.rect.top, aimL.rect.right, aimL.rect.bottom, aimL.cx, aimL.cy, aimL.scale, aimL.live)
        topLive = top.live; bottomLive = bottom.live; topBottomEdge = top.rect.bottom; mainScale = main.scale; topScale = top.scale; bottomScale = bottom.scale
        renderer.tick(viewDt)
    }

    private val rim = android.graphics.Paint().apply { style = android.graphics.Paint.Style.STROKE; color = android.graphics.Color.WHITE }
    private val markPath = android.graphics.Path()

    private val nudgeFill = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFC23D.toInt() }
    private val nudgeText = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2C221E.toInt(); textSize = 14f * dp; isFakeBoldText = true }

    /** "Drag from your fort to aim", in a gold bubble over your own fort. */
    private fun drawNudge(c: Canvas, f: Frame, me: Int) {
        val l = if (tall) bottom else main
        if (!l.live) return
        val k = Camera.fortOrNull(f.castles, me) ?: return
        val text = OwnerRule.NUDGE
        val tw = nudgeText.measureText(text)
        val pw = tw + 24f * dp; val ph = 30f * dp
        val x = l.sx(k.x + k.cols * k.block / 2f).coerceIn(l.rect.left + pw / 2 + 4f * dp, l.rect.right - pw / 2 - 4f * dp)
        val y = (l.sy(k.topY.toFloat()) - 40f * dp).coerceIn(l.rect.top + ph, l.rect.bottom - ph)
        c.drawRoundRect(x - pw / 2, y - ph / 2, x + pw / 2, y + ph / 2, ph / 2, ph / 2, nudgeFill)
        markPath.reset(); markPath.moveTo(x - 8f * dp, y + ph / 2 - 1); markPath.lineTo(x + 8f * dp, y + ph / 2 - 1); markPath.lineTo(x, y + ph / 2 + 9f * dp); markPath.close()
        c.drawPath(markPath, nudgeFill)
        c.drawText(text, x - tw / 2, y + nudgeText.textSize * 0.35f, nudgeText)
    }

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
        val planFloor = Camera.planBlockScale(dp, phone)
        val home = Camera.fortOrNull(f.castles, me) ?: active
        val away = Camera.fortOrNull(f.castles, 1 - me) ?: other
        when {
            // The peek (N3): both forts at any zoom.
            session.peek.on && sh == null && f.phase == Phase.PLAN -> {
                fortBox(home, boxA); fortBox(away, boxB)
                Camera.fit(min(boxA[0], boxB[0]), min(boxA[1], boxB[1]), max(boxA[2], boxB[2]), max(boxA[3], boxB[3]), w, h, margin, Camera.minScale(dp), ceil, fitOut)
            }
            // The Fatigue collapse (N1): the camera holds your own fort (both forts when they fit) until the next shot.
            sh == null && session.fatigue.holdHome -> {
                fortBox(home, boxA); fortBox(away, boxB)
                if (Camera.bothFit(boxA, boxB, w, h, margin, planFloor))
                    Camera.fit(min(boxA[0], boxB[0]), min(boxA[1], boxB[1]), max(boxA[2], boxB[2]), max(boxA[3], boxB[3]), w, h, margin, planFloor, ceil, fitOut)
                else Camera.fit(boxA[0], boxA[1], boxA[2], boxA[3], w, h, margin * 3, floor, ceil, fitOut)
            }
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
                // Both forts hold whenever their blocks still draw at 8 dp or more (6 dp on a phone), even if the arc then runs off (M3, N3).
                if (fitOut[2] <= floor + 1e-4f && Camera.bothFit(boxA, boxB, w, h, margin, planFloor)) {
                    Camera.fit(min(boxA[0], boxB[0]), min(boxA[1], boxB[1]), max(boxA[2], boxB[2]), max(boxA[3], boxB[3]), w, h, margin, planFloor, ceil, fitOut)
                } else if (fitOut[2] <= floor + 1e-4f) {
                    // Both do not fit: your fort and the arc, with a little lean toward the rival.
                    val lean = if (boxB[0] > boxA[0]) 80f else -80f
                    Camera.fit(min(x0, x0 + lean), y0, max(x1, x1 + lean), y1, w, h, margin, floor, ceil, fitOut)
                }
            }
            else -> {
                val x0 = min(boxA[0], boxB[0]); val x1 = max(boxA[2], boxB[2])
                val fl = if (f.phase == Phase.PLAN) planFloor else floor
                Camera.fit(x0, min(boxA[1], boxB[1]), x1, max(boxA[3], boxB[3]), w, h, margin, fl, ceil, fitOut)
                if (fitOut[2] <= fl + 1e-4f && !Camera.bothFit(boxA, boxB, w, h, margin, fl)) {
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
        val l = aimSnap
        if (!l.live) return false
        val k = Camera.fortOrNull(f.castles, f.side) ?: return true
        val hob = f.selectedHob
        val hobDist = if (hob != null) hypot(x - l.sx(hob.x.toFloat()), y - l.sy(hob.y.toFloat())) else Float.POSITIVE_INFINITY
        return Aim.startsOnOwnFort(l.wx(x), l.wy(y), k.x.toFloat(), k.topY.toFloat(), (k.x + k.cols * k.block).toFloat(), k.baseY.toFloat(), hobDist, dp)
    }

    /** Returns the own-fort block (c, r) at screen [x], [y] for Mendglob self-targeting (Android-H5, Android-L2). */
    private fun hitOwnBlock(x: Float, y: Float): Pair<Int, Int>? {
        val l = aimSnap
        if (!l.live) return null
        val f = session.frame
        val k = Camera.fortOrNull(f.castles, f.side) ?: return null
        val wx = l.wx(x); val wy = l.wy(y)
        val bs = k.block.toFloat()
        for (b in k.blocks) {
            if (wx >= b.x && wx <= b.x + bs && wy >= b.y && wy <= b.y + bs) return b.c to b.r
        }
        return null
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
                        // Each lens has its own pinch zoom and pan in the Tall layout (Android-L7).
                        if (tall && !session.ui.value.flying) {
                            if (pinchY <= topBottomEdge) {
                                topZoom = Camera.clampZoom(topZoom * k)
                                topPan = Camera.clampPan(topPan - (mx - pinchX) / Camera.clampScale(topScale, dp), fw)
                            } else {
                                bottomZoom = Camera.clampZoom(bottomZoom * k)
                                bottomPan = Camera.clampPan(bottomPan - (mx - pinchX) / Camera.clampScale(bottomScale, dp), fw)
                            }
                        } else {
                            zoom = Camera.clampZoom(zoom * k)
                            val sc = Camera.clampScale(mainScale, dp)
                            panX = Camera.clampPan(panX - (mx - pinchX) / sc, fw); panY = Camera.clampPan(panY - (my - pinchY) / sc, fh)
                        }
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
                    // A drag needs 8 pt of travel, not time. Read real aim from session.aimBase (Android-H1).
                    val (baseAngle, basePower) = session.aimBase(u)
                    anchorX = downX; anchorY = downY
                    prevAngle = baseAngle; prevPower = basePower; sentAngle = -1; sentPower = -1; heldAngle = -1
                    draggingFlag = true; dragging.value = true
                    session.aimStarted()
                    session.audio.play("aim_drag_start")
                    session.buzz(8)
                    updateAim()
                } else if (!candidate && travel >= 8f * dp) {
                    // A drag from the sky on your turn says where aims start, once per battle (QA playtest 2, 4.1).
                    if (!panning && !panFromTop && session.skyDrag(inAimLens(downX, downY))) { nudgeUntil = SystemClock.uptimeMillis() + OwnerRule.NUDGE_MS; redraw = true }
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
                    val sel = u.selected
                    val mendTap = if (u.humanTurn && !session.paused && session.handoffTo < 0 && u.hud.selectedShot == "plain" &&
                        sel != null && session.content.hasSelfTarget(sel.plain) && inAimLens(e.x, e.y)
                    ) hitOwnBlock(e.x, e.y) else null
                    if (mendTap != null) {
                        session.pickMendTarget(if (session.mendTarget == mendTap) null else mendTap)
                        session.audio.play("ui_tap")
                        lastTapAt = 0
                    } else if (now - lastTapAt < 300) {
                        if (manualFlag) reframe()
                        else {
                            if (tall && !u.flying) {
                                if (e.y <= topBottomEdge) topZoom = 1.25f else bottomZoom = 1.25f
                            } else zoom = 1.25f
                            setManual()
                        }
                        lastTapAt = 0
                    } else lastTapAt = now
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
        val r = Aim.pull(anchorX, anchorY, fingerX, fingerY, width.toFloat(), height.toFloat(), session.settings.pointMode, dp, heldAngle)
        val angle = r[0]; val power = r[1]
        if (r[2] == 0) heldAngle = angle
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
        else if (mayFire && session.settings.quickFire) {
            val cur = session.ui.value
            if (FireLight.ready(cur.hud, cur.humanTurn, cur.selected)) {
                session.fire(dial = session.activeDial, target = session.mendTarget)
            } else {
                session.fireRefusedHere()
            }
        }
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

    /**
     * The pull for power 100 (QA playtest 1, m3): 40% of the screen's short side, or the room from
     * the anchor to the screen edge in the pull's direction when that is less, never under 64 dp.
     * So full power comes before the finger meets the edge.
     */
    fun fullPull(ax: Float, ay: Float, dirX: Float, dirY: Float, w: Float, h: Float, dp: Float): Float {
        val base = 0.4f * min(w, h)
        val len = hypot(dirX, dirY)
        var room = Float.POSITIVE_INFINITY
        if (len >= 1f) {
            val ux = dirX / len; val uy = dirY / len
            if (ux > 1e-4f) room = min(room, (w - ax) / ux) else if (ux < -1e-4f) room = min(room, -ax / ux)
            if (uy > 1e-4f) room = min(room, (h - ay) / uy) else if (uy < -1e-4f) room = min(room, -ay / uy)
        }
        return max(64f * dp, min(base, room))
    }

    /** The finger is on the screen edge (within 2 dp). */
    fun onEdge(x: Float, y: Float, w: Float, h: Float, dp: Float): Boolean = x <= 2f * dp || y <= 2f * dp || x >= w - 2f * dp || y >= h - 2f * dp

    /**
     * Aim from a pull from anchor [ax], [ay] to finger [fx], [fy] on a [w] x [h] screen. While the finger
     * is on the screen edge the angle keeps [heldAngle] (the last one off the edge, -1 for none) and
     * only power follows (m3): the edge never bends the angle. Returns angle, power and 1 when on the edge.
     */
    fun pull(ax: Float, ay: Float, fx: Float, fy: Float, w: Float, h: Float, pointMode: Boolean, dp: Float, heldAngle: Int): IntArray {
        val full = fullPull(ax, ay, fx - ax, fy - ay, w, h, dp)
        val (angle, power) = fromDrag(ax - fx, ay - fy, pointMode, full)
        val edge = onEdge(fx, fy, w, h, dp)
        return intArrayOf(if (edge && heldAngle >= 0) heldAngle else angle, power, if (edge) 1 else 0)
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

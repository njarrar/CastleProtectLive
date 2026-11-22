package games.castleprotect.ui

import android.os.SystemClock
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import games.castleprotect.battle.BattleView
import games.castleprotect.battle.Sprites
import games.castleprotect.core.Cmd
import games.castleprotect.core.Phase
import games.castleprotect.game.BattleUi
import games.castleprotect.game.GameSession
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.max

private class ViewRef { var view: BattleView? by mutableStateOf(null) }

/** Aim limits from core/API.md: angle 0 to 1800 tenths of a degree, power 0 to 100. */
private const val ANGLE_MAX = 1800
private const val POWER_MAX = 100

/**
 * Battle: the field (BattleView) with the native HUD over it.
 * Wide layout when width is at least 1.2 times the height, Tall layout (stacked
 * lenses) otherwise, with hysteresis 1.15 / 1.25 so a resize does not flap.
 * The HUD is always laid out left to right (the forts' sides are fixed); the
 * Left-hand setting mirrors the bottom clusters by hand.
 */
@Composable
fun BattleScreen(session: GameSession) {
    val u by session.ui.collectAsState()
    val ref = remember { ViewRef() }
    val field = remember {
        movableContentOf {
            AndroidView(factory = { ctx -> BattleView(ctx, session).also { ref.view = it } }, modifier = Modifier.fillMaxSize().semantics { contentDescription = "Battle field. Drag on your fort to aim, or use the Fine Tune keys, then press Fire." })
        }
    }
    val ctx = LocalContext.current
    val a11y = remember { ctx.getSystemService(AccessibilityManager::class.java) }
    var touchExplore by remember { mutableStateOf(a11y?.isTouchExplorationEnabled == true) }
    androidx.compose.runtime.DisposableEffect(a11y) {
        val l = AccessibilityManager.TouchExplorationStateChangeListener { touchExplore = it }
        a11y?.addTouchExplorationStateChangeListener(l)
        onDispose { a11y?.removeTouchExplorationStateChangeListener(l) }
    }
    var fineTuneAt by remember { mutableLongStateOf(0L) }   // uptime of the last nudge; the pad folds 4 s later
    var fineOpen by remember { mutableStateOf(false) }
    val dragging = ref.view?.dragging?.value ?: false
    val manual = ref.view?.manual?.value ?: false
    val s = session.settings
    val cardUp = session.paused || session.handoffTo >= 0 || session.confirm != null

    // TalkBack: speak turn starts, shot results and the winner (review M11).
    // A node that is always there and changes its text, which TalkBack speaks reliably.
    var spoken by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { session.announcements.collect { msg -> spoken = games.castleprotect.game.Announce.distinct(spoken, msg) } }
    // Fine Tune opens after any Aim Drag and folds away 4 s after the last nudge,
    // except with TalkBack or Tap only on, where it stays open (moving focus takes longer).
    // Overlay code never force-unwraps the view: no view yet means no pad, not a crash.
    LaunchedEffect(dragging) { val v = ref.view; if (!dragging && v != null && v.dragEndedAt > 0 && u.humanTurn) { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() } }
    val keepPad = touchExplore || s.tapOnly
    LaunchedEffect(fineOpen, fineTuneAt, keepPad) { if (fineOpen && !keepPad) { delay(4000); fineOpen = false } }
    LaunchedEffect(u.humanTurn, keepPad) { if (!u.humanTurn) fineOpen = false else if (keepPad) fineOpen = true }
    LaunchedEffect(u.phase) { if (u.phase == Phase.ENDED) { delay(1400); session.showResults() } }

    /** Steps the aim from the last value sent (review M9). [open] is false for the Slow Drag (review M8). Returns false at a limit. */
    val nudge: (Int, Int, Boolean) -> Boolean = { da, dp, open ->
        val (a0, p0) = session.aimBase(session.ui.value)
        val a = (a0 + da).coerceIn(0, ANGLE_MAX); val p = (p0 + dp).coerceIn(0, POWER_MAX)
        val changed = a != a0 || p != p0
        if (changed) { session.aim(a, p); session.audio.play("aim_tick", semis = if (dp != 0) -5f else 0f); session.buzz(5) }
        else session.audio.play("aim_limit")
        fineTuneAt = SystemClock.uptimeMillis(); if (open) fineOpen = true
        changed
    }
    val fire: () -> Unit = {
        // 150 ms guard after an Aim Drag ends, so a stray lift cannot land on Fire.
        val v = ref.view
        if (v == null || SystemClock.uptimeMillis() - v.dragEndedAt > 150) session.fire { r -> if (r.ok) fineOpen = false }
    }
    val recall: () -> Unit = { if (u.recallIndex >= 0) session.recall(u.recallIndex); fineTuneAt = SystemClock.uptimeMillis() }
    val viewer = u.viewer
    val flying = u.flying
    val dim = dragging
    val canAct = u.humanTurn && !dragging

    // Sides are fixed: the HUD never mirrors for a right-to-left system language (review L5).
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(Modifier.fillMaxSize().background(C.Sky)) {
            val ratio = maxWidth.value / maxHeight.value
            var tall by remember { mutableStateOf(ratio < 1.2f) }
            if (tall && ratio > 1.25f) tall = false else if (!tall && ratio < 1.15f) tall = true
            val safe = WindowInsets.safeDrawing.asPaddingValues()
            val dir = LocalLayoutDirection.current
            val density = LocalDensity.current
            ref.view?.tall = tall
            val hidden = if (cardUp) Modifier.clearAndSetSemantics { } else Modifier

            if (tall) {
                Column(Modifier.fillMaxSize().padding(top = safe.calculateTopPadding()).then(hidden)) {
                    TopStrip(u, tall = true)
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        field()
                        TurnBanner(session, u, Modifier.align(Alignment.TopCenter).padding(top = 8.dp))
                        if (manual) CastleButton("Re-frame", { ref.view?.reframe() }, Modifier.align(Alignment.TopEnd).padding(6.dp), color = C.Paper, size = 12)
                        // Floats along the foot of the Bottom lens: Pause and Walk on one side, readout or Fine Tune on the other.
                        HandRow(s.leftHand, Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(8.dp),
                            start = {
                                PauseButton(session)
                                Spacer(Modifier.width(6.dp))
                                if (!flying) Box(Modifier.alpha(if (dim) 0.25f else 1f).blockInput(dim)) { WalkPad(session, u, canAct) }
                                if (!flying) ShoveOff(session, u, canAct)
                            },
                            end = {
                                if (flying) SpeedButton(session)
                                else if (u.humanTurn) {
                                    if (fineOpen && !dragging) FineTunePad(session, u, s.tapOnly, nudge, recall)
                                    else if (!dragging) Readout(session, u, { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() }, nudge)
                                }
                            })
                    }
                    if (!flying) {
                        Column(Modifier.background(C.Paper).padding(bottom = safe.calculateBottomPadding())) {
                            Box(Modifier.alpha(if (dim) 0.25f else 1f).blockInput(dim)) { ShotTray(session, u, canAct, 48.dp) }
                            HandRow(s.leftHand, Modifier.fillMaxWidth().height(80.dp).padding(horizontal = 8.dp),
                                start = { Box(Modifier.weight(1f).alpha(if (dim) 0.25f else 1f).blockInput(dim)) { CrewRow(session, u, viewer, canAct, vertical = false) } },
                                end = { FireButton(u, fire) })
                        }
                    }
                }
            } else {
                // Tell the field how much of each edge the Wide HUD covers, so auto-frame keeps both forts in the Clear Rect.
                with(density) {
                    ref.view?.hudPad = floatArrayOf((safe.calculateLeftPadding(dir) + 60.dp).toPx(), (safe.calculateTopPadding() + 40.dp).toPx(), (safe.calculateRightPadding(dir) + 8.dp).toPx(), (safe.calculateBottomPadding() + 68.dp).toPx())
                }
                // The field node hides under a card too (review 2 N-L14).
                Box(Modifier.fillMaxSize().then(hidden)) { field() }
                // The top strip is padded for the status bar and any cutout (review M7).
                Column(Modifier.fillMaxSize().padding(start = safe.calculateLeftPadding(dir), end = safe.calculateRightPadding(dir), top = safe.calculateTopPadding(), bottom = safe.calculateBottomPadding()).then(hidden)) {
                    TopStrip(u, tall = false, pause = { PauseButton(session) })
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        TurnBanner(session, u, Modifier.align(Alignment.TopCenter).padding(top = 6.dp))
                        if (manual) CastleButton("Re-frame", { ref.view?.reframe() }, Modifier.align(if (s.leftHand) Alignment.TopStart else Alignment.TopEnd).padding(6.dp), color = C.Paper, size = 12)
                        if (!flying) Box(Modifier.align(if (s.leftHand) Alignment.CenterEnd else Alignment.CenterStart).padding(horizontal = 4.dp).alpha(if (dim) 0.25f else 1f).blockInput(dim)) { CrewRow(session, u, viewer, canAct, vertical = true) }
                        if (fineOpen && u.humanTurn && !dragging) Box(Modifier.align(if (s.leftHand) Alignment.BottomStart else Alignment.BottomEnd).padding(start = if (s.leftHand) 92.dp else 0.dp, end = if (s.leftHand) 0.dp else 92.dp, bottom = 4.dp)) { FineTunePad(session, u, s.tapOnly, nudge, recall) }
                    }
                    if (!flying) {
                        HandRow(s.leftHand, Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp),
                            start = {
                                Row(Modifier.weight(1f).alpha(if (dim) 0.25f else 1f).blockInput(dim), verticalAlignment = Alignment.Bottom) {
                                    WalkPad(session, u, canAct)
                                    ShoveOff(session, u, canAct)
                                    Spacer(Modifier.width(8.dp))
                                    Box(Modifier.weight(1f)) { ShotTray(session, u, canAct, 52.dp) }
                                }
                            },
                            end = {
                                Spacer(Modifier.width(8.dp))
                                if (u.humanTurn && !fineOpen && !dragging) Readout(session, u, { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() }, nudge)
                                Spacer(Modifier.width(8.dp))
                                FireButton(u, fire)
                            })
                    } else Row(Modifier.fillMaxWidth().padding(6.dp), horizontalArrangement = if (s.leftHand) Arrangement.Start else Arrangement.End) { SpeedButton(session) }
                }
            }

            Box(Modifier.size(1.dp).semantics { liveRegion = LiveRegionMode.Polite; contentDescription = spoken })
            Subtitle(session, Modifier.align(Alignment.BottomCenter).padding(bottom = if (tall) 150.dp else 84.dp))
            if (session.handoffTo >= 0) HandoffCard(session, u)
            if (session.paused) PauseCard(session)
            // A rebuild after a core fault replays the battle: show that, not a frozen field (review 2 N-M16).
            if (session.loading) Box(Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.4f)).pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
                .semantics { liveRegion = LiveRegionMode.Polite; contentDescription = "Loading the battle" }, contentAlignment = Alignment.Center) {
                Label("Loading...", Modifier.clip(RoundedCornerShape(12.dp)).background(C.Paper).padding(horizontal = 20.dp, vertical = 10.dp), size = 18, bold = true)
            }
        }
    }
}

/** A row whose two clusters swap ends for the Left-hand layout. Content inside stays left to right. */
@Composable
private fun HandRow(left: Boolean, modifier: Modifier, start: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit, end: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(modifier, verticalAlignment = Alignment.Bottom) {
        if (!left) { start(); Spacer(Modifier.weight(0.001f)); end() } else { end(); Spacer(Modifier.weight(0.001f)); start() }
    }
}

// ---- top strip ---------------------------------------------------------------

@Composable
private fun TopStrip(u: BattleUi, tall: Boolean, pause: (@Composable () -> Unit)? = null) {
    val h = u.hud
    val v = h.volley
    val round = when {
        v != null -> "Shots left ${v.left.getOrElse(u.side) { 0 }}/${v.actions}"
        h.squallRound > 0 -> "Sudden Squall ${h.squallRound}"
        h.squallWarning > 0 -> "Round ${h.round}/${h.roundCap}  Squall in ${h.squallWarning}"
        else -> "Round ${h.round}/${h.roundCap}"
    } + (h.boss?.let { b -> "  Phase ${b.phase}/3" } ?: "")
    val windText = if (h.wind == 0) "Calm" else "Wind ${abs(h.wind)} to the ${if (h.wind > 0) "right" else "left"}"
    val desc = "${h.names.getOrElse(0) { "" }} kettle ${h.kettlePct.getOrElse(0) { 0 }} percent. ${h.names.getOrElse(1) { "" }} kettle ${h.kettlePct.getOrElse(1) { 0 }} percent. $round. $windText." +
        (h.boss?.let { " The Grand Fort is in phase ${it.phase} of 3." } ?: "")
    val squall = h.squallRound > 0 || h.squallWarning > 0
    val mod = Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).clearAndSetSemantics { contentDescription = desc }
    if (tall) {
        Column(mod.height(56.dp).padding(horizontal = 8.dp), verticalArrangement = Arrangement.Center) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                KettleGauge(u, 0); Spacer(Modifier.weight(1f)); RoundLabel(round, squall); Spacer(Modifier.weight(1f)); KettleGauge(u, 1)
            }
            Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Pips(u, 0); Spacer(Modifier.weight(1f)); Wind(u); Spacer(Modifier.weight(1f)); Pips(u, 1)
            }
        }
    } else {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            pause?.invoke()
            Row(mod.weight(1f).height(36.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                KettleGauge(u, 0); Spacer(Modifier.width(6.dp)); Pips(u, 0)
                Spacer(Modifier.weight(1f)); RoundLabel(round, squall); Spacer(Modifier.width(12.dp)); Wind(u); Spacer(Modifier.weight(1f))
                Pips(u, 1); Spacer(Modifier.width(6.dp)); KettleGauge(u, 1)
            }
        }
    }
}

@Composable
private fun KettleGauge(u: BattleUi, side: Int) {
    // The core's kettle_pct, shown as it is.
    val pct = u.hud.kettlePct.getOrElse(side) { 0 }
    val plus = u.hud.handicap.getOrNull(side)?.marks ?: 0
    Row(Modifier.clip(RoundedCornerShape(10.dp)).border(2.dp, C.side(side), RoundedCornerShape(10.dp)).padding(horizontal = 6.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(if (pct <= 25) C.Danger else C.Kettle).border(1.5.dp, C.Ink, CircleShape))
        Label(" $pct%", size = 14, bold = true)
        // Help is shown openly: gold plus marks (07 section 4.9).
        if (plus > 0) Label(" " + "+".repeat(plus), size = 14, bold = true, color = C.GoldDark)
        // Volley Points: each side's Siege Score sits by its kettle.
        if (u.hud.volley != null) Label("  ${u.hud.score.getOrElse(side) { 0 }}", size = 12, color = C.InkSoft)
    }
}

@Composable
private fun Pips(u: BattleUi, side: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (h in u.hud.crew.getOrElse(side) { emptyList() }) {
            val frac = h.hpPct.coerceIn(0, 100) / 100f
            val out = h.state == "bonked"
            val col = C.side(side)
            // Yours are round, the Rival's are diamonds: shape as well as colour tells the sides apart.
            Canvas(Modifier.size(18.dp)) {
                val r = size.minDimension / 2
                if (side == 0) {
                    drawCircle(C.Paper, r); drawArc(if (out) C.Locked else col, -90f, 360f * frac, true)
                    drawCircle(C.Ink, r, style = Stroke(1.5.dp.toPx()))
                } else {
                    val p = androidx.compose.ui.graphics.Path().apply { moveTo(r, 0f); lineTo(2 * r, r); lineTo(r, 2 * r); lineTo(0f, r); close() }
                    drawPath(p, if (out) C.Locked else C.Paper)
                    if (!out) drawRect(col, Offset(r * 0.5f, r * 0.5f + r * (1 - frac)), Size(r, r * frac))
                    drawPath(p, C.Ink, style = Stroke(1.5.dp.toPx()))
                }
            }
        }
    }
}

@Composable
private fun RoundLabel(text: String, squall: Boolean) {
    Label(text, Modifier.clip(RoundedCornerShape(10.dp)).background(if (squall) C.InkSoft else Color.Transparent).padding(horizontal = 8.dp, vertical = 2.dp), size = 14, bold = true, color = if (squall) C.Paper else C.Ink, maxLines = 1)
}

@Composable
private fun Wind(u: BattleUi) {
    fun arrow(v: Int) = if (v == 0) "· 0" else if (v > 0) "→ $v" else "← ${-v}"
    Row(verticalAlignment = Alignment.CenterVertically) {
        Label(arrow(u.hud.wind), size = 15, bold = true)
        Label("   next ${arrow(u.hud.forecast)}", size = 11, color = C.InkSoft)
    }
}

@Composable
private fun TurnBanner(session: GameSession, u: BattleUi, modifier: Modifier) {
    var shown by remember { mutableIntStateOf(-1) }
    var t by remember { mutableStateOf(-1f) }
    val a = session.anims
    val still = session.settings.reduceMotion
    // Slide in, hold, slide out (animations.json data.turn_banner); a fade with Reduce motion.
    val total = a.bannerIn.end + a.bannerHoldMs + a.bannerOut.end
    LaunchedEffect(u.hud.turn, u.phase == Phase.PLAN) {
        if (u.phase == Phase.PLAN && shown != u.hud.turn) {
            shown = u.hud.turn
            val start = SystemClock.uptimeMillis()
            while (true) {
                val e = (SystemClock.uptimeMillis() - start).toFloat()
                t = e
                if (e > max(total, 1400f)) break
                delay(16)
            }
            t = -1f
        }
    }
    if (t < 0f) return
    val holdEnd = a.bannerIn.end + a.bannerHoldMs
    val (dy, alpha) = when {
        still -> 0f to (if (t < 150f) t / 150f else if (t > holdEnd) (1f - (t - holdEnd) / 150f).coerceIn(0f, 1f) else 1f)
        t < a.bannerIn.end -> a.bannerIn.at(t) to a.bannerInOpacity.at(t)
        t < holdEnd -> 0f to 1f
        else -> a.bannerOut.at(t - holdEnd) to a.bannerOutOpacity.at(t - holdEnd)
    }
    val name = u.hud.names.getOrElse(u.side) { "" }
    val both = u.hud.human(0) && u.hud.human(1)
    val plus = "+".repeat(u.hud.handicap.getOrNull(u.side)?.marks ?: 0)
    val text = when {
        u.hud.squallRound > 0 -> "Sudden Squall"
        both -> "$name's turn" + if (plus.isNotEmpty()) "  $plus" else ""
        u.humanTurn -> "Your turn"
        else -> "$name aims"
    }
    // Display only: it never takes taps. TalkBack hears the turn through the session's announcements.
    Label(text, modifier.offset(y = dy.dp).alpha(alpha.coerceIn(0f, 1f)).widthIn(min = 200.dp).clip(RoundedCornerShape(22.dp)).background(C.side(u.side)).border(2.dp, C.Ink, RoundedCornerShape(22.dp)).padding(horizontal = 24.dp, vertical = 10.dp).clearAndSetSemantics { },
        size = 18, bold = true, color = Color.White, align = TextAlign.Center)
}

/** Hob-speak subtitle line, when Subtitles is on. */
@Composable
private fun Subtitle(session: GameSession, modifier: Modifier) {
    val sub = session.subtitle ?: return
    var now by remember { mutableLongStateOf(SystemClock.uptimeMillis()) }
    LaunchedEffect(sub) { while (SystemClock.uptimeMillis() < sub.second) { now = SystemClock.uptimeMillis(); delay(200) }; now = SystemClock.uptimeMillis() }
    if (now >= sub.second) return
    Label("“${sub.first}”", modifier.clip(RoundedCornerShape(12.dp)).background(C.Ink.copy(alpha = 0.75f)).padding(horizontal = 12.dp, vertical = 6.dp).clearAndSetSemantics { },
        size = 14, color = Color.White, align = TextAlign.Center)
}

// ---- controls ----------------------------------------------------------------

@Composable
private fun PauseButton(session: GameSession) {
    Box(Modifier.size(48.dp).clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape)
        .clickable(onClickLabel = "pause") { session.paused = true }.semantics { contentDescription = "Pause" }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(18.dp)) {
            val w = size.width * 0.3f
            drawRect(C.Ink, Offset(size.width * 0.1f, 0f), Size(w, size.height))
            drawRect(C.Ink, Offset(size.width * 0.6f, 0f), Size(w, size.height))
        }
    }
}

@Composable
private fun SpeedButton(session: GameSession) {
    val fast = session.fastState
    CastleButton(if (fast) "1x" else "2x", { session.toggleFast() }, Modifier.size(64.dp, 48.dp), description = if (fast) "Normal speed" else "Double speed")
}

@Composable
private fun WalkPad(session: GameSession, u: BattleUi, enabled: Boolean) {
    val steam = u.hud.steam.getOrElse(u.side) { 0 }
    val can = enabled && u.hud.steamTurnLeft > 0 && steam > 0
    Column(Modifier.clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape).padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        // Steam gauge: the teal is reserved for the kettle and Steam.
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(64.dp).height(8.dp).clip(RoundedCornerShape(4.dp)).background(C.InkSoft)) {
                Box(Modifier.fillMaxHeight().fillMaxWidth((steam.coerceIn(0, 120) / 120f)).background(C.Kettle))
            }
            Label(" S $steam", Modifier.semantics { contentDescription = "Steam $steam, ${u.hud.steamTurnLeft} left this turn" }, size = 11, bold = true)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((label, dx, desc) in listOf(Triple("◀", -WALK_STEP, "Walk left"), Triple("▶", WALK_STEP, "Walk right"))) {
                Box(Modifier.size(48.dp).alpha(if (can) 1f else 0.4f).clip(CircleShape).background(C.Cream).border(2.dp, C.Ink, CircleShape)
                    .tapOrHold(can, session.settings.tapOnly, desc) { session.send(Cmd.walk(dx)) }, contentAlignment = Alignment.Center) { Label(label, size = 18, bold = true) }
            }
        }
    }
}

/** Cells per Walk tap: 1 Steam per 4 cells (core/API.md). */
private const val WALK_STEP = 4

@Composable
private fun ShotTray(session: GameSession, u: BattleUi, enabled: Boolean, chip: Dp) {
    val hob = u.selected
    val content = session.content
    // Plain, Knack (with its uses), then the Trick Shells in hand, all as the core reports them.
    data class Chip(val id: String, val name: String, val icon: String, val uses: Int, val weight: String, val best: Boolean)
    val chips = buildList {
        if (hob != null && hob.plain.isNotEmpty()) add(Chip("plain", content.shotName(hob.plain), "icon_${hob.plain}", -1, "", false))
        if (hob?.knack != null) add(Chip("knack", content.shotName(hob.knack), "", hob.knackUses, "", false))
        for (t in u.hud.hands.getOrElse(u.side) { emptyList() }) add(Chip(t.id, t.name, "icon_${t.id}", 1, t.weight, hob != null && t.match == hob.cls))
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 6.dp, vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally)) {
        for (shot in chips) {
            val sel = shot.id == u.hud.selectedShot
            // The core's own readiness for this shot (hud.shots): why `fire` would refuse it.
            val sc = u.hud.chip(shot.id)
            val ready = sc?.ready ?: true || sc?.why == "not_planning"
            val out = shot.uses == 0 || !ready
            val uses = if (shot.uses < 0) "" else ", ${shot.uses} left"
            val w = if (shot.weight.isNotEmpty()) ", weight ${shot.weight}" else ""
            Box(Modifier.size(width = chip + 12.dp, height = chip).alpha(if (out || !enabled) 0.5f else 1f).clip(RoundedCornerShape(10.dp)).background(if (sel) C.Gold else C.Paper).border(2.dp, C.Ink, RoundedCornerShape(10.dp))
                .clickable(enabled = enabled && !out, onClickLabel = "pick") { session.send(Cmd.pickShot(shot.id)); session.audio.play(if (ready) "ui_tap" else "ui_denied") }
                .semantics { contentDescription = "${shot.name}$uses$w${if (shot.best) ", best with this Hob" else ""}${if (!ready) ", ${whyText(sc?.why)}" else ""}"; this.selected = sel }, contentAlignment = Alignment.Center) {
                if (shot.icon.isEmpty() || !SpriteImage(session.sprites, shot.icon, Modifier.fillMaxSize().padding(bottom = 12.dp, top = 2.dp))) Label(shot.name, Modifier.padding(2.dp), size = 11, bold = true, align = TextAlign.Center, maxLines = 2)
                else Label(shot.name, Modifier.align(Alignment.BottomCenter).padding(horizontal = 2.dp), size = 9, bold = true, align = TextAlign.Center, maxLines = 1)
                if (shot.uses >= 0) Label("${shot.uses}", Modifier.align(Alignment.TopEnd).padding(end = 3.dp).clip(CircleShape).background(C.Ink).padding(horizontal = 4.dp), size = 9, bold = true, color = Color.White)
                if (shot.weight.isNotEmpty()) Label(shot.weight, Modifier.align(Alignment.BottomStart).padding(start = 3.dp), size = 9)
                if (shot.best) Box(Modifier.align(Alignment.TopStart).padding(3.dp).size(7.dp).clip(CircleShape).background(C.Good))
            }
        }
    }
}

@Composable
private fun CrewRow(session: GameSession, u: BattleUi, side: Int, enabled: Boolean, vertical: Boolean) {
    val hobs = u.hobsOf(side).filter { !it.dummy }
    val items: @Composable () -> Unit = {
        for (h in hobs) {
            val sel = h.id == u.hud.selectedHob && side == u.side
            val frac = if (h.max > 0) h.hp.toFloat() / h.max else 0f
            val state = if (h.bonked) "Bonked" else if (h.buried) "Loophole buried" else if (h.rest > 0) "resting ${h.rest}" else "${h.hp} of ${h.max} HP"
            Box(Modifier.size(48.dp).alpha(if (h.bonked) 0.45f else 1f).clip(CircleShape).background(if (sel) C.GoldLight else C.Cream)
                .clickable(enabled = enabled && !h.bonked) { session.pickHob(h) }
                .semantics { contentDescription = "${h.name}, ${h.cls}, $state"; this.selected = sel }, contentAlignment = Alignment.Center) {
                val ring = C.side(side)
                Canvas(Modifier.fillMaxSize()) {
                    val w = 3.5.dp.toPx()
                    drawArc(C.Locked, 0f, 360f, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w))
                    drawArc(if (sel) C.Gold else ring, -90f, 360f * frac, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w, cap = StrokeCap.Round))
                }
                if (!SpriteImage(session.sprites, "portrait_${Sprites.hobKey(h.def)}_${if (side == 0) "blue" else "orange"}", Modifier.fillMaxSize().padding(4.dp))) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Label(h.cls.take(1).uppercase(), size = 16, bold = true)
                        Label(h.name.take(6), size = 8, maxLines = 1)
                    }
                }
                if (h.rest > 0) Label("${h.rest}", Modifier.align(Alignment.BottomEnd).clip(CircleShape).background(C.InkSoft).padding(horizontal = 4.dp), size = 9, color = Color.White)
            }
        }
    }
    if (vertical) Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { items() } else Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { items() }
}

@Composable
private fun Readout(session: GameSession, u: BattleUi, onTap: () -> Unit, nudge: (Int, Int, Boolean) -> Boolean) {
    // The aim comes from its own flow: only this and the pad recompose during an Aim Drag (review 2 N-M9).
    val aim by session.aimState.collectAsState()
    val h = u.selected
    val text = if (h != null) String.format(java.util.Locale.ROOT, "%.1f° | %d", aim.angle / 10f, aim.power) else "--° | --"
    val d = LocalDensity.current
    val step by rememberUpdatedState(nudge)
    // Tap opens Fine Tune. A drag that starts here is the Slow Drag: 5 pt per power point (up and down),
    // 5 pt per half degree (left and right). It does not open the pad, so the drag keeps going.
    Box(Modifier.size(120.dp, 48.dp).clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape)
        .clickable(onClickLabel = "open Fine Tune", onClick = onTap)
        .pointerInput(Unit) {
            var ax = 0f; var ay = 0f
            val stepPx = with(d) { 5.dp.toPx() }
            detectDragGestures(onDragStart = { ax = 0f; ay = 0f }) { change, drag ->
                change.consume(); ax += drag.x; ay += drag.y
                val da = (ax / stepPx).toInt(); val dpw = (-ay / stepPx).toInt()
                if (da != 0 || dpw != 0) { ax -= da * stepPx; ay += dpw * stepPx; step(-da * 5, dpw, false) }
            }
        }
        .semantics { contentDescription = if (h != null) "Aim ${aim.angle / 10f} degrees, power ${aim.power}" else "No Hob selected" }, contentAlignment = Alignment.Center) {
        Label(text, size = 18, bold = true)
    }
}

@Composable
private fun FineTunePad(session: GameSession, u: BattleUi, tapOnly: Boolean, nudge: (Int, Int, Boolean) -> Boolean, recall: () -> Unit) {
    session.aimState.collectAsState().value // recompose on a new aim
    val (a, p) = session.aimBase(u)
    Row(Modifier.clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column { Key("ang −", "Angle down a tenth", a > 0, tapOnly) { nudge(-1, 0, true) }; Key("pow −", "Power down one", p > 0, tapOnly) { nudge(0, -1, true) } }
        Column(Modifier.width(64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Label(String.format(java.util.Locale.ROOT, "%.1f°", a / 10f), size = 16, bold = true)
            Label("$p", size = 16, bold = true)
            CastleButton("Recall", recall, Modifier.padding(top = 2.dp).size(64.dp, 48.dp), color = C.Cream, size = 11, enabled = u.recallIndex >= 0,
                description = "Recall the last shot's aim", pad = PaddingValues(0.dp))
        }
        Column { Key("ang +", "Angle up a tenth", a < ANGLE_MAX, tapOnly) { nudge(1, 0, true) }; Key("pow +", "Power up one", p < POWER_MAX, tapOnly) { nudge(0, 1, true) } }
    }
}

@Composable
private fun Key(text: String, desc: String, enabled: Boolean, tapOnly: Boolean, onStep: () -> Boolean) {
    Box(Modifier.padding(2.dp).size(48.dp).alpha(if (enabled) 1f else 0.4f).clip(RoundedCornerShape(10.dp)).background(C.Cream).border(2.dp, C.Ink, RoundedCornerShape(10.dp)).tapOrHold(enabled, tapOnly, desc, onStep), contentAlignment = Alignment.Center) {
        Label(text, size = 12, bold = true)
    }
}

@Composable
private fun FireButton(u: BattleUi, fire: () -> Unit) {
    val h = u.selected
    val buried = h?.buried == true
    val chip = u.hud.chip(u.hud.selectedShot)
    val ready = u.humanTurn && h != null && h.canFire && !buried && (chip?.ready ?: true)
    val label = if (buried) "Fire, dug in, the Loophole is buried" else if (ready) "Fire" else "Fire, locked" + (chip?.why?.let { ", ${whyText(it)}" } ?: "")
    // The press: ui_fire_press timing (40, 70, 90 ms), as a squash and settle.
    var pressAt by remember { mutableLongStateOf(0L) }
    var k by remember { mutableStateOf(1f) }
    LaunchedEffect(pressAt) {
        if (pressAt == 0L) return@LaunchedEffect
        while (true) {
            val e = SystemClock.uptimeMillis() - pressAt
            k = when { e < 40 -> 1f - 0.1f * e / 40f; e < 110 -> 0.9f + 0.14f * (e - 40) / 70f; e < 200 -> 1.04f - 0.04f * (e - 110) / 90f; else -> 1f }
            if (e >= 200) break
            delay(16)
        }
    }
    Box(Modifier.size(76.dp).graphicsLayer { scaleX = k; scaleY = k }.clip(CircleShape).background(if (ready) C.Gold else C.Locked).border(3.dp, C.Ink, CircleShape)
        .onReleaseInside(ready, label) { pressAt = SystemClock.uptimeMillis(); fire() }, contentAlignment = Alignment.Center) {
        Label(if (buried) "DUG IN" else "FIRE", size = if (buried) 12 else 18, bold = true)
    }
}

/** Shove Off: shown when the selected Hob's Loophole is buried. Costs hud.shove_off_cost Steam. */
@Composable
private fun ShoveOff(session: GameSession, u: BattleUi, enabled: Boolean) {
    val h = u.selected ?: return
    if (!h.buried || !u.humanTurn) return
    val cost = u.hud.shoveOffCost
    val can = enabled && u.hud.steamTurnLeft >= cost
    CastleButton("Shove Off $cost", { session.send(Cmd.shoveOff(h.id)) }, Modifier.height(48.dp), color = C.Cream, size = 12, enabled = can,
        description = "Shove Off: clear the buried Loophole for $cost Steam")
}

/** Plain words for hud.shots[].why. */
internal fun whyText(why: String?): String = when (why) {
    "resting_plain_only" -> "resting, Plain Shot only"
    "no_knack_uses" -> "no Knack uses left"
    "no_heavy_first_turn" -> "no Heavy shot on the first turn"
    "buried" -> "the Loophole is buried"
    "resting" -> "resting"
    "no_actions_left" -> "no shots left"
    "not_planning", null -> "not your turn"
    else -> why.replace('_', ' ')
}

// ---- cards -------------------------------------------------------------------

/** Hand-off card (Couch Duel): Ready is the only control and ignores input for its first 400 ms. */
@Composable
private fun HandoffCard(session: GameSession, u: BattleUi) {
    val to = session.handoffTo
    val name = u.hud.names.getOrElse(to) { "Player ${to + 1}" }
    var armed by remember(to, u.hud.turn) { mutableStateOf(false) }
    var scale by remember(to, u.hud.turn) { mutableStateOf(1f) }
    val track = session.anims.cardScale
    val still = session.settings.reduceMotion
    LaunchedEffect(to, u.hud.turn) {
        armed = false
        val start = SystemClock.uptimeMillis()
        // Pop in (animations.json data.hand_off_card); Ready ignores input for its first 400 ms.
        while (true) {
            val e = (SystemClock.uptimeMillis() - start).toFloat()
            scale = if (still) 1f else track.at(e)
            if (e >= 400f) break
            delay(16)
        }
        scale = 1f; armed = true
    }
    Box(Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f)).pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
        .semantics { paneTitle = "Pass the device" }, contentAlignment = Alignment.Center) {
        Column(Modifier.padding(20.dp).widthIn(max = 380.dp).graphicsLayer { scaleX = scale; scaleY = scale }.clip(RoundedCornerShape(20.dp)).background(C.Paper).border(8.dp, C.side(to), RoundedCornerShape(20.dp)).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (session.handoffLine.isNotEmpty()) Label(session.handoffLine, size = 14, color = C.InkSoft, align = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Label(if (to == 0) "●  ●  ●" else "◆  ◆  ◆", Modifier.clearAndSetSemantics { }, size = 20, color = C.side(to))
            Label("Pass the device to", size = 16)
            Label(name.uppercase(), Modifier.semantics { heading() }, size = 32, bold = true, color = C.side(to), align = TextAlign.Center)
            val marks = u.hud.handicap.getOrNull(to)?.marks ?: 0
            if (marks > 0) Label("Help: " + (if (marks == 1) "Some +" else "Lots ++"), size = 14, color = C.GoldDark, bold = true)
            u.hud.volley?.let { v -> Label("Score ${u.hud.score.getOrElse(0) { 0 }} to ${u.hud.score.getOrElse(1) { 0 }}    Shots left ${v.left.getOrElse(to) { 0 }}", size = 13) }
            Spacer(Modifier.height(6.dp))
            Label("Kettle ${u.hud.kettlePct.getOrElse(to) { 0 }}%    Round ${u.hud.round}/${u.hud.roundCap}", size = 14)
            Spacer(Modifier.height(16.dp))
            CastleButton("READY", { if (armed) session.handoffReady() }, Modifier.size(width = 200.dp, height = 72.dp), size = 22, description = "Pass the device to $name. Ready")
        }
    }
}

@Composable
private fun PauseCard(session: GameSession) {
    var settings by remember { mutableStateOf(false) }
    var giveUp by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f)).pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
        .semantics { paneTitle = "Paused" }, contentAlignment = Alignment.Center) {
        Plate(Modifier.padding(16.dp).widthIn(max = 520.dp), pad = 16.dp) {
            if (settings) {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) { SettingsBody(session) }
                CastleButton("Done", { settings = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
            } else if (giveUp) {
                val u = session.ui.collectAsState().value
                val duel = u.hud.human(0) && u.hud.human(1)
                val who = u.hud.names.getOrElse(u.side) { "" }
                Label(if (duel) "$who gives up?" else "Give up this battle?", Modifier.fillMaxWidth().semantics { heading() }, size = 22, bold = true, align = TextAlign.Center)
                Label(if (duel) "The other player wins." else "It ends here and counts as a loss. You still get the loss Buttons.", Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
                CastleButton("Keep playing", { giveUp = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
                CastleButton("Give up", { session.giveUp() }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
            } else {
                Label("Paused", Modifier.fillMaxWidth().semantics { heading() }, size = 24, bold = true, align = TextAlign.Center)
                Label("The battle is saved at the start of every turn and when you leave.", Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
                CastleButton("Resume", { session.paused = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
                CastleButton("Settings", { settings = true }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                CastleButton("Save and leave", { session.leaveBattle() }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                CastleButton("Give up", { giveUp = true }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
            }
        }
    }
}

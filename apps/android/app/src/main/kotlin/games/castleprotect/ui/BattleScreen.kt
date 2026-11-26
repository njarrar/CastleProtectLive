package games.castleprotect.ui

import android.os.SystemClock
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import games.castleprotect.battle.BattleView
import games.castleprotect.battle.Sprites
import games.castleprotect.core.Cmd
import games.castleprotect.core.LiveBattle
import games.castleprotect.core.Phase
import games.castleprotect.core.Text
import games.castleprotect.core.Names
import games.castleprotect.game.BattleUi
import games.castleprotect.game.FireLight
import games.castleprotect.game.GameSession
import games.castleprotect.game.HobLook
import games.castleprotect.game.HudText
import games.castleprotect.game.PhoneLayout
import games.castleprotect.game.RivalPeek
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.max

private class ViewRef { var view: BattleView? by mutableStateOf(null) }

/** Aim limits from core/API.md: angle 0 to 1800 tenths of a degree, power 0 to 100. */
private const val ANGLE_MAX = 1800
private const val POWER_MAX = 100

/**
 * Battle screen (Part 2 Plates 1, 2 & 5 3-Tier HUD redesign):
 * - Tier 3 frosted translucent Top Strip with brass Heartkettle dials, R10/18 · Ph1 + amber Fatigue badge, Wind pennant.
 * - Portrait mode keeps the lower player fort 100% unobstructed by tucking Walk + Steam + Readout into a slim
 *   integrated rail inside the stitched parchment bottom dock.
 * - Wide mode uses a zero-overlap responsive flex bottom dock (`Walk & Steam` | `Shot Tray` | `Aim Readout` | `FIRE`).
 * - Long-pressing any shot chip (or tapping the Inspect button) opens the decision-grade Shell Inspect Card.
 */
@Composable
fun BattleScreen(session: GameSession) {
    val u by session.ui.collectAsState()
    val ref = remember { ViewRef() }
    val field = remember {
        movableContentOf {
            AndroidView(factory = { ctx -> BattleView(ctx, session).also { ref.view = it } }, modifier = Modifier.fillMaxSize().semantics { contentDescription = Text.t("a11y.field") })
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
    var fineTuneAt by remember { mutableLongStateOf(0L) }
    var fineOpen by remember { mutableStateOf(false) }
    var potLidOpen by remember { mutableStateOf(false) }
    var inspectShotId by remember { mutableStateOf<String?>(null) }
    val dragging = ref.view?.dragging?.value ?: false
    val manual = ref.view?.manual?.value ?: false
    val s = session.settings
    val cardUp = session.paused || session.handoffTo >= 0 || session.confirm != null || potLidOpen || inspectShotId != null

    var spoken by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { session.announcements.collect { msg -> spoken = games.castleprotect.game.Announce.distinct(spoken, msg) } }
    LaunchedEffect(dragging) { val v = ref.view; if (!dragging && v != null && v.dragEndedAt > 0 && u.humanTurn) { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() } }
    val keepPad = touchExplore || s.tapOnly
    LaunchedEffect(fineOpen, fineTuneAt, keepPad) { if (fineOpen && !keepPad) { delay(4000); fineOpen = false } }
    LaunchedEffect(u.humanTurn, keepPad) { if (!u.humanTurn) { fineOpen = false; potLidOpen = false; inspectShotId = null } else if (keepPad) fineOpen = true }
    LaunchedEffect(u.phase) { if (u.phase == Phase.ENDED) { delay(if (session.settings.subtitles) 2000 else 1400); session.showResults() } }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { session.clearSubtitle() } }

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
        val v = ref.view
        if (v == null || SystemClock.uptimeMillis() - v.dragEndedAt > 150) {
            session.fire(dial = session.activeDial, target = session.mendTarget) { r -> if (r.ok) fineOpen = false }
        }
    }
    val pass: () -> Unit = { session.pass { r -> if (r.ok) fineOpen = false } }
    val recall: () -> Unit = { if (u.recallIndex >= 0) session.recall(u.recallIndex); fineTuneAt = SystemClock.uptimeMillis() }
    val currentShotRealId: () -> String? = {
        val h = u.selected
        when (u.hud.selectedShot) {
            "plain" -> h?.plain?.ifEmpty { null }
            "knack" -> h?.knack
            else -> u.hud.selectedShot.ifEmpty { null }
        }
    }
    val viewer = u.viewer
    val flying = u.flying
    val dim = dragging
    val canAct = u.humanTurn && !dragging

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(Modifier.fillMaxSize().background(C.Sky)) {
            val ratio = maxWidth.value / maxHeight.value
            var tall by remember { mutableStateOf(ratio < 1.2f) }
            if (tall && ratio > 1.25f) tall = false else if (!tall && ratio < 1.15f) tall = true
            val safe = WindowInsets.safeDrawing.asPaddingValues()
            val dir = LocalLayoutDirection.current
            val density = LocalDensity.current
            var tallTopPx by remember { mutableStateOf(0f) }
            var tallDockPx by remember { mutableStateOf(0f) }
            ref.view?.tall = tall
            val hidden = if (cardUp) Modifier.clearAndSetSemantics { } else Modifier

            // Full-screen BattleView behind HUD in BOTH Portrait and Wide so fullPull & onEdge use full window bounds (H-A02).
            Box(Modifier.fillMaxSize().then(hidden)) { field() }

            if (tall) {
                val safeTop = safe.calculateTopPadding()
                val safeBottom = safe.calculateBottomPadding()
                val topSafePx = with(density) { safeTop.toPx() }
                val botSafePx = with(density) { safeBottom.toPx() }
                val defaultTopPx = with(density) { 62.dp.toPx() }
                val defaultDockPx = with(density) { 218.dp.toPx() }
                ref.view?.tallTopInset = topSafePx + (if (tallTopPx > 0f) tallTopPx else defaultTopPx)
                ref.view?.tallBottomInset = if (tallDockPx > 0f) tallDockPx else (botSafePx + defaultDockPx)
                Column(Modifier.fillMaxSize().padding(top = safeTop).then(hidden)) {
                    Box(
                        Modifier.fillMaxWidth().onSizeChanged {
                            tallTopPx = it.height.toFloat()
                            ref.view?.tallTopInset = topSafePx + tallTopPx
                        },
                    ) {
                        CompactHud { TopStrip(u, tall = true, pause = { PauseButton(session) }) }
                    }
                    // Transparent overlay window above the full-screen BattleView (touches fall through to BattleView!).
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        TurnBanner(session, u, Modifier.align(Alignment.TopCenter).padding(top = 8.dp))
                        BattleBanner(session, Modifier.align(Alignment.TopCenter).padding(top = 60.dp))
                        if (u.mode == "test_yard" && !flying && !dragging) {
                            TestYardWind(session, u, Modifier.align(Alignment.TopStart).padding(6.dp))
                        }
                        if (manual) CastleButton(Text.t("hud.reframe"), { ref.view?.reframe() }, Modifier.align(Alignment.TopEnd).padding(6.dp), color = C.Paper, size = 12)
                        if (fineOpen && u.humanTurn && !dragging && !flying) {
                            val far = PhoneLayout.pad(tall = true, mySide = viewer) == PhoneLayout.Pad.BOTTOM_START
                            Box(Modifier.align(if (far) Alignment.BottomStart else Alignment.BottomEnd).padding(8.dp)) {
                                CompactHud { FineTunePad(session, u, s.tapOnly, nudge, recall) }
                            }
                        }
                        FireNote(session, u, Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp))
                    }
                    // Stitched parchment bottom dock fades cleanly while dragging so full lower pull runway stays visible (H-A02).
                    val dockDim = dim || flying
                    val dockBgAlpha = if (dim) 0.16f else 1f
                    val dockContentAlpha = if (dim) 1f else if (flying) 0.42f else 1f
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .onSizeChanged {
                                tallDockPx = it.height.toFloat()
                                ref.view?.tallBottomInset = tallDockPx
                            }
                            .alpha(dockBgAlpha)
                            .background(C.HudTier2Bg)
                            .drawBehind {
                                drawLine(C.SepiaBorder, Offset(0f, 0f), Offset(size.width, 0f), strokeWidth = 2.dp.toPx())
                                drawLine(
                                    C.SepiaBorder.copy(alpha = 0.45f),
                                    Offset(6.dp.toPx(), 4.dp.toPx()),
                                    Offset(size.width - 6.dp.toPx(), 4.dp.toPx()),
                                    strokeWidth = 1.dp.toPx(),
                                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())),
                                )
                            }
                            .padding(top = 6.dp, bottom = safeBottom),
                    ) {
                        // Slim integrated Walk + Steam + Readout rail (keeps the lower fort completely clear!).
                        HandRow(
                            s.leftHand,
                            Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 2.dp).alpha(dockContentAlpha).blockInput(dockDim),
                            start = { CompactHud { WalkRail(session, u, canAct && !flying) } },
                            end = {
                                if (!flying && u.humanTurn && !dragging) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        CompactHud { Readout(session, u, { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() }, nudge) }
                                        currentShotRealId()?.let { sid ->
                                            InspectTriggerButton { session.audio.play("ui_sheet_open"); inspectShotId = sid }
                                        }
                                    }
                                }
                            },
                        )
                        if (!flying && u.selected?.buried == true && u.humanTurn) {
                            Box(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp).alpha(dockContentAlpha).blockInput(dockDim), contentAlignment = Alignment.Center) {
                                ShoveOff(session, u, canAct)
                            }
                        }
                        // Illustrated Shot Tray
                        Box(Modifier.alpha(dockContentAlpha).blockInput(dockDim).padding(top = 2.dp)) {
                            CompactHud {
                                ShotTray(
                                    session = session, u = u, enabled = canAct && !flying, chip = 52.dp,
                                    onPotLid = { potLidOpen = true },
                                    onInspect = { sid -> session.audio.play("ui_sheet_open"); inspectShotId = sid },
                                )
                            }
                        }
                        // Crew medallions + Tier-1 Beveled Brass FIRE button
                        HandRow(
                            s.leftHand,
                            Modifier.fillMaxWidth().heightIn(min = 80.dp).padding(horizontal = 8.dp, vertical = 2.dp),
                            start = { Box(Modifier.weight(1f).alpha(dockContentAlpha).blockInput(dockDim)) { CrewRow(session, u, viewer, canAct && !flying, vertical = false) } },
                            end = {
                                if (flying) Box(Modifier.size(76.dp), contentAlignment = Alignment.Center) { SpeedButton(session) }
                                else FireButton(session, u, fire, pass)
                            },
                        )
                    }
                }
            } else {
                // Wide layout: swap left/right HUD pads in Left-Hand mode so CrewRow never overlaps framed forts (M-A07).
                with(density) {
                    val leftCrewPad = if (s.leftHand) 8.dp else 60.dp
                    val rightCrewPad = if (s.leftHand) 60.dp else 8.dp
                    ref.view?.hudPad = floatArrayOf(
                        (safe.calculateLeftPadding(dir) + leftCrewPad).toPx(),
                        (safe.calculateTopPadding() + 44.dp).toPx(),
                        (safe.calculateRightPadding(dir) + rightCrewPad).toPx(),
                        (safe.calculateBottomPadding() + 86.dp).toPx(),
                    )
                }
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(
                            start = safe.calculateLeftPadding(dir),
                            end = safe.calculateRightPadding(dir),
                            top = safe.calculateTopPadding(),
                            bottom = safe.calculateBottomPadding(),
                        )
                        .then(hidden),
                ) {
                    CompactHud { TopStrip(u, tall = false, pause = { PauseButton(session) }) }
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        TurnBanner(session, u, Modifier.align(Alignment.TopCenter).padding(top = 6.dp))
                        BattleBanner(session, Modifier.align(Alignment.TopCenter).padding(top = 56.dp))
                        if (u.mode == "test_yard" && !flying && !dragging) {
                            TestYardWind(session, u, Modifier.align(if (s.leftHand) Alignment.TopEnd else Alignment.TopStart).padding(start = if (s.leftHand) 6.dp else 60.dp, end = if (s.leftHand) 60.dp else 6.dp, top = 6.dp))
                        }
                        if (manual) CastleButton(Text.t("hud.reframe"), { ref.view?.reframe() }, Modifier.align(if (s.leftHand) Alignment.TopStart else Alignment.TopEnd).padding(6.dp), color = C.Paper, size = 12)
                        if (!flying) {
                            Box(Modifier.align(if (s.leftHand) Alignment.CenterEnd else Alignment.CenterStart).padding(horizontal = 4.dp).alpha(if (dim) 0.25f else 1f).blockInput(dim)) {
                                CrewRow(session, u, viewer, canAct, vertical = true)
                            }
                        }
                        val rv = ref.view
                        if (rv != null && rv.rivalPeekVisible.value && !flying && !dragging) {
                            val peeking = rv.rivalPeekOn.value
                            val onRight = rv.rivalPeekRight.value
                            val label = if (peeking) RivalPeek.HOME else RivalPeek.VIEW
                            val shown = if (onRight) "$label ▶" else "◀ $label"
                            val sharesEdgeWithCrew = onRight == s.leftHand
                            CastleButton(
                                shown, { rv.tapRivalPeek() },
                                Modifier.align(if (onRight) Alignment.CenterEnd else Alignment.CenterStart).padding(
                                    start = if (!onRight && sharesEdgeWithCrew) 64.dp else 6.dp,
                                    end = if (onRight && sharesEdgeWithCrew) 64.dp else 6.dp,
                                ),
                                color = C.Orange, size = 12, description = label,
                                pad = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                                textColor = Color.White,
                            )
                        }
                        if (fineOpen && u.humanTurn && !dragging && !flying) {
                            val start = PhoneLayout.pad(tall = false, mySide = viewer) == PhoneLayout.Pad.TOP_START
                            Box(
                                Modifier.align(if (start) Alignment.TopStart else Alignment.TopEnd).padding(
                                    start = if (start && !s.leftHand) 60.dp else 4.dp,
                                    end = if (!start && s.leftHand) 60.dp else 4.dp,
                                    top = if (manual) 56.dp else 4.dp,
                                ),
                            ) {
                                CompactHud { FineTunePad(session, u, s.tapOnly, nudge, recall) }
                            }
                        }
                        FireNote(session, u, Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp))
                    }
                    // Zero-overlap Wide 3-Tier Flex Bottom Bar (Walk & Steam | Shot Tray | Aim Readout | FIRE)
                    if (!flying) {
                        HandRow(
                            s.leftHand,
                            Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp),
                            start = {
                                Row(
                                    Modifier.weight(1f).alpha(if (dim) 0.25f else 1f).blockInput(dim),
                                    verticalAlignment = Alignment.Bottom,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    CompactHud { WalkPad(session, u, canAct) }
                                    ShoveOff(session, u, canAct)
                                    HudTier2Plate(Modifier.weight(1f), pad = PaddingValues(horizontal = 4.dp, vertical = 2.dp)) {
                                        CompactHud {
                                            ShotTray(
                                                session = session, u = u, enabled = canAct, chip = 52.dp,
                                                onPotLid = { potLidOpen = true },
                                                onInspect = { sid -> session.audio.play("ui_sheet_open"); inspectShotId = sid },
                                            )
                                        }
                                    }
                                }
                            },
                            end = {
                                Spacer(Modifier.width(6.dp))
                                if (u.humanTurn && !fineOpen && !dragging) {
                                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        CompactHud { Readout(session, u, { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() }, nudge) }
                                        currentShotRealId()?.let { sid ->
                                            InspectTriggerButton { session.audio.play("ui_sheet_open"); inspectShotId = sid }
                                        }
                                    }
                                    Spacer(Modifier.width(6.dp))
                                }
                                FireButton(session, u, fire, pass)
                            },
                        )
                    } else {
                        Row(Modifier.fillMaxWidth().padding(6.dp), horizontalArrangement = if (s.leftHand) Arrangement.Start else Arrangement.End) { SpeedButton(session) }
                    }
                }
            }

            Box(Modifier.size(1.dp).semantics { liveRegion = LiveRegionMode.Polite; contentDescription = spoken })
            Subtitle(session, Modifier.align(Alignment.BottomCenter).padding(bottom = if (tall) 190.dp else 92.dp))
            inspectShotId?.let { sid -> ShellInspectCard(session, u, sid) { inspectShotId = null } }
            if (potLidOpen) PotLidCard(session, u) { potLidOpen = false }
            if (session.handoffTo >= 0) HandoffCard(session, u)
            if (session.paused) PauseCard(session)
            if (session.loading) Box(
                Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.4f))
                    .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
                    .semantics { liveRegion = LiveRegionMode.Polite; contentDescription = Text.t("common.loading_fight") },
                contentAlignment = Alignment.Center,
            ) {
                Label(Text.t("common.loading_fight"), Modifier.clip(RoundedCornerShape(12.dp)).background(C.Paper).border(1.5.dp, C.Ink, RoundedCornerShape(12.dp)).padding(horizontal = 20.dp, vertical = 10.dp), size = 18, bold = true)
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

/** Caps extreme font scaling on compact battle HUD strips so gauges and chips never clip (Android-M10). */
@Composable
private fun CompactHud(content: @Composable () -> Unit) {
    val d = LocalDensity.current
    val capped = minOf(d.fontScale, 1.25f)
    if (capped < d.fontScale) {
        CompositionLocalProvider(LocalDensity provides Density(d.density, capped), content = content)
    } else content()
}

/** Test Yard wind adjuster (-10..10) with accessible 48 dp targets (Android-M11). */
@Composable
private fun TestYardWind(session: GameSession, u: BattleUi, modifier: Modifier) {
    val w = u.hud.wind
    val can = u.humanTurn && !u.flying
    HudTier2Plate(modifier, pad = PaddingValues(horizontal = 4.dp, vertical = 2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            CastleButton("−", { session.setTestWind(w - 1) }, color = C.Cream, enabled = can && w > -10, size = 16, description = Text.t("hud.wind.left", "n" to abs(w - 1)), pad = PaddingValues(0.dp))
            Label(Text.t("hud.wind.set", "n" to w), Modifier.padding(horizontal = 4.dp), size = 12, bold = true)
            CastleButton("+", { session.setTestWind(w + 1) }, color = C.Cream, enabled = can && w < 10, size = 16, description = Text.t("hud.wind.right", "n" to abs(w + 1)), pad = PaddingValues(0.dp))
        }
    }
}

// ---- Tier-3 Frosted Top Telemetry Strip --------------------------------------

@Composable
private fun TopStrip(u: BattleUi, tall: Boolean, pause: (@Composable () -> Unit)? = null) {
    val h = u.hud
    val roundLong = HudText.round(h, u.mode)
    val roundCompact = HudText.compactRound(h, u.mode)
    val statusBadge = HudText.statusPill(h, u.mode)
    val isSquall = h.squallRound > 0 || h.squallWarning > 0
    val desc = Text.t(
        "a11y.status", "left" to h.names.getOrElse(0) { "" }, "left_pct" to h.kettlePct.getOrElse(0) { 0 },
        "right" to h.names.getOrElse(1) { "" }, "right_pct" to h.kettlePct.getOrElse(1) { 0 }, "round" to roundLong, "wind" to windWords(h.wind),
    ) + (h.boss?.let { " " + Text.t("a11y.boss_phase", "n" to it.phase) } ?: "")
    val stripBg = Modifier
        .fillMaxWidth()
        .background(C.HudTier3Bg)
        .drawBehind {
            drawLine(C.SepiaBorder.copy(alpha = 0.5f), Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
        }
        .clearAndSetSemantics { contentDescription = desc }

    if (tall) {
        val splitBossBadge = statusBadge != null && h.boss != null
        Row(Modifier.fillMaxWidth().background(C.HudTier3Bg), verticalAlignment = Alignment.CenterVertically) {
            pause?.let { Box(Modifier.padding(start = 4.dp)) { it() } }
            Column(stripBg.weight(1f).heightIn(min = 56.dp).padding(horizontal = 5.dp, vertical = 3.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    KettleGauge(u, 0)
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        RoundTelemetry(roundCompact, if (splitBossBadge) null else statusBadge, isSquall)
                    }
                    KettleGauge(u, 1)
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Pips(u, 0)
                    Spacer(Modifier.weight(1f))
                    Wind(u)
                    Spacer(Modifier.weight(1f))
                    Pips(u, 1)
                }
                if (splitBossBadge && statusBadge != null) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        StatusBadgePill(statusBadge, isSquall)
                    }
                }
            }
        }
    } else {
        Row(Modifier.fillMaxWidth().background(C.HudTier3Bg), verticalAlignment = Alignment.CenterVertically) {
            pause?.invoke()
            Row(stripBg.weight(1f).heightIn(min = 40.dp).padding(horizontal = 8.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                KettleGauge(u, 0); Spacer(Modifier.width(6.dp)); Pips(u, 0)
                Spacer(Modifier.weight(1f))
                RoundTelemetry(roundCompact, statusBadge, isSquall)
                Spacer(Modifier.width(8.dp))
                Wind(u)
                Spacer(Modifier.weight(1f))
                Pips(u, 1); Spacer(Modifier.width(6.dp)); KettleGauge(u, 1)
            }
        }
    }
}

@Composable
private fun KettleGauge(u: BattleUi, side: Int) {
    val pct = u.hud.kettlePct.getOrElse(side) { 0 }
    val plus = u.hud.handicap.getOrNull(side)?.marks ?: 0
    HudTier3Pill(borderColor = C.side(side), pad = PaddingValues(horizontal = 6.dp, vertical = 2.dp)) {
        BrassKettleDialIcon(pct = pct, side = side, modifier = Modifier.size(20.dp))
        Label("$pct%", size = 13, bold = true, color = if (pct <= 25) C.BadInk else C.Ink, maxLines = 1)
        if (plus > 0) Label("+".repeat(plus), size = 12, bold = true, color = C.OrangeInk, maxLines = 1)
        if (u.hud.volley != null) Label("· ${u.hud.score.getOrElse(side) { 0 }}", size = 12, color = C.InkSoft, maxLines = 1)
    }
}

@Composable
private fun Pips(u: BattleUi, side: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (h in u.hud.crew.getOrElse(side) { emptyList() }) {
            val frac = HobLook.pipFill(h.state, h.hpPct)
            val out = HobLook.pipOut(h.state)
            val squashed = HobLook.pipSquashed(h.state, h.hpPct)
            val col = C.side(side)
            Canvas(Modifier.size(18.dp)) {
                val r = size.minDimension / 2
                val ring = if (squashed) Stroke(1.6.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 2.dp.toPx()))) else Stroke(1.6.dp.toPx())
                if (side == 0) {
                    drawCircle(C.Paper, r); drawArc(if (out) C.Locked else col, -90f, 360f * frac, true)
                    drawCircle(C.Ink, r, style = ring)
                } else {
                    val p = androidx.compose.ui.graphics.Path().apply { moveTo(r, 0f); lineTo(2 * r, r); lineTo(r, 2 * r); lineTo(0f, r); close() }
                    drawPath(p, if (out) C.Locked else C.Paper)
                    if (!out) drawRect(col, Offset(r * 0.5f, r * 0.5f + r * (1 - frac)), Size(r, r * frac))
                    drawPath(p, C.Ink, style = ring)
                }
            }
        }
    }
}

@Composable
private fun RoundTelemetry(round: String, statusBadge: String?, isSquall: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        HudTier3Pill(pad = PaddingValues(horizontal = 7.dp, vertical = 2.dp)) {
            Label(round, size = 12, bold = true, color = C.Ink, maxLines = 1)
        }
        if (statusBadge != null) {
            StatusBadgePill(statusBadge, isSquall)
        }
    }
}

@Composable
private fun StatusBadgePill(statusBadge: String, isSquall: Boolean) {
    HudTier3Pill(
        color = if (isSquall) C.BadBg else C.BrassHi,
        borderColor = if (isSquall) C.BadBorder else C.OrangeInk,
        pad = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
    ) {
        FatigueFlameIcon(Modifier.size(14.dp))
        Label(statusBadge, size = 12, bold = true, color = if (isSquall) C.BadInk else C.OrangeInk, maxLines = 1)
    }
}

@Composable
private fun Wind(u: BattleUi) {
    fun dirArrow(v: Int) = if (v == 0) "0" else if (v > 0) "$v →" else "← ${-v}"
    val next = u.hud.forecast
    val nextWords = when { next == 0 -> Text.t("hud.wind.next_none"); next > 0 -> Text.t("hud.wind.next_right", "n" to next); else -> Text.t("hud.wind.next_left", "n" to -next) }
    HudTier3Pill(Modifier.semantics(mergeDescendants = true) { contentDescription = windWords(u.hud.wind) + ". " + nextWords }, pad = PaddingValues(horizontal = 7.dp, vertical = 2.dp)) {
        WindPennantIcon(u.hud.wind, Modifier.size(17.dp))
        Label(dirArrow(u.hud.wind), size = 13, bold = true, color = C.Ink, maxLines = 1)
        Label(Text.t("common.next") + " " + dirArrow(next), size = 12, color = C.InkSoft, maxLines = 1)
    }
}

@Composable
private fun TurnBanner(session: GameSession, u: BattleUi, modifier: Modifier) {
    var shown by remember { mutableIntStateOf(-1) }
    var t by remember { mutableStateOf(-1f) }
    val a = session.anims
    val still = session.settings.reduceMotion
    val total = a.bannerIn.end + a.bannerHoldMs + a.bannerOut.end
    LaunchedEffect(u.hud.turn, u.phase == Phase.PLAN) {
        if (u.phase == Phase.PLAN && shown != u.hud.turn) {
            shown = u.hud.turn
            val waitStart = SystemClock.uptimeMillis()
            while (true) {
                val now = SystemClock.uptimeMillis()
                val w = session.fatigue.turnBannerWait(now)
                val collapsing = session.collapseShowing && !session.fast && now - waitStart < 2200L
                if (w <= 0L && !collapsing) break
                delay(if (w > 0L) minOf(w, 50L) else 32L)
            }
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
    // The Rival's turn: its start taunt once, now and then a "thinking" line (every 4th Rival turn), else "aims" (M-A10).
    val rivalLine = remember(u.hud.turn) {
        val rival = Names.rivalShort(u.level, name)
        val key = Names.rivalKey(u.level, name)
        val rivalTurn = (u.hud.turn + 1) / 2
        when {
            u.hud.human(u.side) -> ""
            u.hud.turn <= 2 && Text.has("rivals.$key.taunts.start") -> Text.t("rivals.$key.taunts.start")
            rivalTurn > 1 && rivalTurn % 4 == 0 && Text.has("rivals.banner.thinking") -> Text.t("rivals.banner.thinking", "rival" to rival)
            else -> Text.t("banners.rival_aims", "rival" to rival)
        }
    }
    val text = when {
        u.hud.squallRound > 0 -> Text.t("banners.weather.squall_round", "n" to u.hud.squallRound)
        both -> Text.t("banners.name_turn", "name" to name) + if (plus.isNotEmpty()) "  $plus" else ""
        u.humanTurn -> Text.t("banners.your_turn")
        else -> rivalLine
    }
    Label(
        text,
        modifier.offset(y = dy.dp).alpha(alpha.coerceIn(0f, 1f)).widthIn(min = 200.dp)
            .clip(RoundedCornerShape(22.dp)).background(C.side(u.side)).border(2.5.dp, C.Ink, RoundedCornerShape(22.dp))
            .padding(horizontal = 24.dp, vertical = 10.dp).clearAndSetSemantics { },
        size = 18, bold = true, color = Color.White, align = TextAlign.Center,
    )
}

/** "No wind", "Wind 3, blowing right" (`hud.wind`). */
private fun windWords(w: Int): String = when {
    w == 0 -> Text.t("hud.wind.none")
    w > 0 -> Text.t("hud.wind.right", "n" to w)
    else -> Text.t("hud.wind.left", "n" to -w)
}

/** Hob-speak subtitle line, when Subtitles is on. */
@Composable
private fun Subtitle(session: GameSession, modifier: Modifier) {
    val sub = session.subtitle ?: return
    var now by remember { mutableLongStateOf(SystemClock.uptimeMillis()) }
    LaunchedEffect(sub) { while (SystemClock.uptimeMillis() < sub.second) { now = SystemClock.uptimeMillis(); delay(200) }; now = SystemClock.uptimeMillis() }
    if (now >= sub.second) return
    Label(
        "“${sub.first}”",
        modifier.clip(RoundedCornerShape(12.dp)).background(C.Ink.copy(alpha = 0.82f)).padding(horizontal = 12.dp, vertical = 6.dp).clearAndSetSemantics { },
        size = 14, color = Color.White, align = TextAlign.Center,
    )
}

// ---- Tier-1 & Tier-2 Battle Controls -----------------------------------------

@Composable
private fun PauseButton(session: GameSession) {
    Box(
        Modifier.size(48.dp).clip(PlateShape).background(C.HudTier2Bg).border(1.5.dp, C.SepiaBorder, PlateShape)
            .clickable { session.paused = true; session.audio.play("ui_sheet_open") }
            .semantics { contentDescription = Text.t("hud.pause") },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(18.dp)) {
            val w = size.width * 0.3f
            drawRect(C.Ink, Offset(size.width * 0.1f, 0f), Size(w, size.height))
            drawRect(C.Ink, Offset(size.width * 0.6f, 0f), Size(w, size.height))
        }
    }
}

@Composable
private fun InspectTriggerButton(onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).clip(PlateShape).background(C.Cream).border(1.5.dp, C.SepiaBorder, PlateShape)
            .clickable(onClick = onClick)
            .semantics { contentDescription = Text.t("rummage.shows") },
        contentAlignment = Alignment.Center,
    ) {
        Label("i", size = 16, bold = true, color = C.Ink)
    }
}

@Composable
private fun SpeedButton(session: GameSession) {
    val fast = session.fastState
    CastleButton(if (fast) "1x" else "2x", { session.toggleFast() }, Modifier.size(64.dp, 48.dp), description = Text.t(if (fast) "hud.speed_normal" else "hud.speed_double"))
}

/** Slim single-row Walk & Steam rail tucked inside the Portrait bottom dock (Plate 2). */
@Composable
private fun WalkRail(session: GameSession, u: BattleUi, enabled: Boolean) {
    val steam = u.hud.steam.getOrElse(u.side) { 0 }
    val maxSteam = u.hud.steamMax.getOrElse(u.side) { 100 }.coerceAtLeast(1)
    val can = enabled && u.hud.steamTurnLeft > 0 && steam > 0
    HudTier2Plate(pad = PaddingValues(horizontal = 4.dp, vertical = 2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Column(horizontalAlignment = Alignment.Start) {
                Label(
                    Text.t("hud.steam", "n" to steam),
                    Modifier.semantics { contentDescription = Text.t("hud.steam_long", "n" to steam, "max" to maxSteam, "left" to u.hud.steamTurnLeft) },
                    size = 11, bold = true, color = C.Ink, maxLines = 1,
                )
                Box(Modifier.width(44.dp).height(6.dp).clip(RoundedCornerShape(3.dp)).background(C.NookBack)) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(steam.coerceIn(0, maxSteam).toFloat() / maxSteam).background(C.Kettle))
                }
            }
            for ((label, dx, desc) in listOf(Triple("◀", -WALK_STEP, Text.t("hud.walk_left")), Triple("▶", WALK_STEP, Text.t("hud.walk_right")))) {
                Box(
                    Modifier.size(48.dp).clip(CircleShape)
                        .background(if (can) C.Cream else C.DisabledBg)
                        .border(1.5.dp, if (can) C.Ink else C.SepiaBorder, CircleShape)
                        .tapOrHold(can, session.settings.tapOnly, desc) { session.send(Cmd.walk(dx)) },
                    contentAlignment = Alignment.Center,
                ) { Label(label, size = 16, bold = true, color = if (can) C.Ink else C.DisabledInk) }
            }
        }
    }
}

/** Compact stacked Walk & Steam plate for Wide bottom dock (Plate 1). */
@Composable
private fun WalkPad(session: GameSession, u: BattleUi, enabled: Boolean) {
    val steam = u.hud.steam.getOrElse(u.side) { 0 }
    val maxSteam = u.hud.steamMax.getOrElse(u.side) { 100 }.coerceAtLeast(1)
    val can = enabled && u.hud.steamTurnLeft > 0 && steam > 0
    HudTier2Plate(pad = PaddingValues(horizontal = 6.dp, vertical = 4.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.width(54.dp).height(7.dp).clip(RoundedCornerShape(4.dp)).background(C.NookBack)) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(steam.coerceIn(0, maxSteam).toFloat() / maxSteam).background(C.Kettle))
                }
                Label(
                    "$steam",
                    Modifier.semantics { contentDescription = Text.t("hud.steam_long", "n" to steam, "max" to maxSteam, "left" to u.hud.steamTurnLeft) },
                    size = 12, bold = true, color = C.Ink,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((label, dx, desc) in listOf(Triple("◀", -WALK_STEP, Text.t("hud.walk_left")), Triple("▶", WALK_STEP, Text.t("hud.walk_right")))) {
                    Box(
                        Modifier.size(48.dp).clip(CircleShape)
                            .background(if (can) C.Cream else C.DisabledBg)
                            .border(1.5.dp, if (can) C.Ink else C.SepiaBorder, CircleShape)
                            .tapOrHold(can, session.settings.tapOnly, desc) { session.send(Cmd.walk(dx)) },
                        contentAlignment = Alignment.Center,
                    ) { Label(label, size = 16, bold = true, color = if (can) C.Ink else C.DisabledInk) }
                }
            }
        }
    }
}

/** Cells per Walk tap: 1 Steam per 4 cells (core/API.md). */
private const val WALK_STEP = 4

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ShotTray(
    session: GameSession, u: BattleUi, enabled: Boolean, chip: Dp,
    onPotLid: () -> Unit,
    onInspect: (String) -> Unit,
) {
    val hob = u.selected
    val content = session.content
    data class Chip(val id: String, val realId: String, val name: String, val uses: Int, val weight: String, val best: Boolean)
    val chips = buildList {
        if (hob != null && hob.plain.isNotEmpty()) {
            add(Chip("plain", hob.plain, content.shotName(hob.plain), -1, "L", false))
        }
        if (hob?.knack != null) {
            val detail = content.shotDetail(hob.knack)
            add(Chip("knack", hob.knack, content.shotName(hob.knack), hob.knackUses, detail?.weight ?: "M", false))
        }
        for (t in u.hud.hands.getOrElse(u.side) { emptyList() }) {
            add(Chip(t.id, t.id, content.shotName(t.id), 1, t.weight, hob != null && t.match == hob.cls))
        }
    }
    val doodads = u.hud.doodads.getOrElse(u.side) { emptyList() }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 4.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (shot in chips) {
            val sel = shot.id == u.hud.selectedShot
            val sc = u.hud.chip(shot.id)
            val ready = sc?.ready ?: true || sc?.why == "not_planning"
            val out = shot.uses == 0 || !ready
            val weightWord = Text.t("shell_card.weight." + when (shot.weight.uppercase()) { "H" -> "heavy"; "M" -> "medium"; else -> "light" })
            val words = HudText.why(sc?.why, hob?.let { content.hobShort(it.def) } ?: "", shot.name)
            val chipWords = when {
                !ready -> Text.t("hud.shot_chip_locked", "shot" to shot.name, "why" to words)
                shot.uses >= 0 -> Text.t("hud.shot_chip_left", "shot" to shot.name, "weight" to weightWord, "n" to shot.uses)
                else -> Text.t("hud.shot_chip", "shot" to shot.name, "weight" to weightWord)
            }
            val bestWith = if (shot.best && hob != null) ". " + Text.t("shell_card.best_with_short", "class" to content.className(hob.cls)) else ""
            val chipShape = RoundedCornerShape(11.dp)
            val borderW = if (sel) 2.5.dp else 1.5.dp
            val borderCol = when {
                sel && !ready -> C.BadBorder
                sel -> C.Ink
                else -> C.SepiaBorder
            }
            val bgModifier = when {
                sel -> Modifier.background(Brush.verticalGradient(listOf(C.BrassHi, C.BrassMid)))
                out || !enabled -> Modifier.background(C.DisabledBg)
                else -> Modifier.background(C.ParchmentCard)
            }
            Box(
                Modifier
                    .widthIn(min = 74.dp, max = 96.dp)
                    .heightIn(min = maxOf(56.dp, chip))
                    .clip(chipShape)
                    .then(bgModifier)
                    .border(borderW, borderCol, chipShape)
                    .combinedClickable(
                        enabled = enabled,
                        onLongClickLabel = Text.t("shell_card.a11y_open", "shot" to shot.name),
                        onLongClick = { onInspect(shot.realId) },
                        onClick = {
                            session.setDial(null); session.pickMendTarget(null)
                            session.send(Cmd.pickShot(shot.id)); session.audio.play(if (ready) "ui_tap" else "ui_denied")
                            if (!ready) session.showFireNote(words)
                        },
                    )
                    .semantics {
                        contentDescription = chipWords + bestWith
                        this.selected = sel
                    }
                    .padding(horizontal = 4.dp, vertical = 3.dp),
            ) {
                // Dedicated clean vertical stack: artwork row above, readable >= 12 sp label below (ZERO badge collision!).
                Column(
                    Modifier.fillMaxWidth().align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Box(Modifier.fillMaxWidth().height(30.dp), contentAlignment = Alignment.Center) {
                        ShotArtwork(session.sprites, shot.realId, Modifier.size(28.dp).alpha(if (out) 0.55f else 1f))
                        if (shot.best) {
                            Box(
                                Modifier.align(Alignment.TopStart).size(10.dp).clip(CircleShape)
                                    .background(C.GoodBg).border(1.dp, Color.White, CircleShape),
                            )
                        }
                        if (shot.uses >= 0) {
                            Label(
                                "${shot.uses}",
                                Modifier.align(Alignment.TopEnd).clip(CircleShape).background(C.Ink).padding(horizontal = 4.dp),
                                size = 10, bold = true, color = Color.White, maxLines = 1,
                            )
                        }
                    }
                    Label(
                        shot.name,
                        size = 12,
                        bold = sel || !out,
                        color = if (out && !sel) C.DisabledInk else C.Ink,
                        align = TextAlign.Center,
                        maxLines = 1,
                    )
                }
                val badge = if (ready) "" else HudText.chipBadge(sc?.why)
                if (badge.isNotEmpty()) {
                    Label(
                        badge,
                        Modifier.align(Alignment.TopCenter).clip(RoundedCornerShape(5.dp))
                            .background(C.BadBorder).padding(horizontal = 4.dp, vertical = 1.dp).clearAndSetSemantics { },
                        size = 10, bold = true, color = Color.White, maxLines = 1,
                    )
                }
            }
        }
        // Optional shot dials and Mendglob own-block targeting (Android-H5).
        if (hob != null && u.hud.selectedShot == "plain" && hob.def == "bobbin") {
            val on = session.activeDial == "hops3"
            Box(
                Modifier.widthIn(min = 60.dp).heightIn(min = maxOf(56.dp, chip)).clip(RoundedCornerShape(11.dp))
                    .background(if (on) C.BrassHi else C.Cream).border(1.5.dp, C.Ink, RoundedCornerShape(11.dp))
                    .clickable(enabled = enabled) {
                        session.setDial(if (on) null else "hops3")
                        session.audio.play("ui_tap")
                    }
                    .semantics { contentDescription = Text.t("hud.dial.hops_hint", "shot" to content.shotName(hob.plain), "n" to (if (on) 3 else 2), "other" to Text.plural("hud.dial.hops", if (on) 2 else 3)); this.selected = on }
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Label(Text.plural("hud.dial.hops", if (on) 3 else 2), size = 12, bold = true, color = C.Ink, align = TextAlign.Center)
            }
        }
        if (hob != null && u.hud.selectedShot == "knack" && hob.knack != null && "puff_up" in content.shotDials(hob.knack)) {
            val on = session.activeDial == "puff_up"
            val canPuff = u.hud.puffUp.getOrElse(u.side) { false } && u.hobsOf(u.side).any { it.bonked }
            val active = enabled && (canPuff || on)
            Box(
                Modifier.widthIn(min = 68.dp).heightIn(min = maxOf(56.dp, chip)).clip(RoundedCornerShape(11.dp))
                    .background(if (on) C.GoodBg else if (active) C.Cream else C.DisabledBg)
                    .border(1.5.dp, if (active) C.Ink else C.SepiaBorder, RoundedCornerShape(11.dp))
                    .clickable(enabled = active) {
                        session.setDial(if (on) null else "puff_up")
                        session.audio.play("ui_tap")
                    }
                    .semantics { contentDescription = if (on) Text.t("hud.dial.puff_up_hint") else if (active) Text.t("hud.dial.rebuild") else Text.t("hud.dial.puff_up_none"); this.selected = on }
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Label(Text.t(if (on) "hud.dial.puff_up" else "hud.dial.rebuild"), size = 12, bold = true, color = if (on) Color.White else if (active) C.Ink else C.DisabledInk, align = TextAlign.Center)
            }
        }
        if (hob != null && u.hud.selectedShot == "plain" && content.hasSelfTarget(hob.plain)) {
            val mt = session.mendTarget
            Box(
                Modifier.widthIn(min = 72.dp).heightIn(min = maxOf(56.dp, chip)).clip(RoundedCornerShape(11.dp))
                    .background(if (mt != null) C.GoodBg else C.Cream).border(1.5.dp, C.Ink, RoundedCornerShape(11.dp))
                    .clickable(enabled = enabled) {
                        if (mt != null) {
                            session.pickMendTarget(null); session.audio.play("ui_tap")
                        } else {
                            val k = session.frame.castles.firstOrNull { it.side == u.side }
                            val hurt = k?.blocks?.filter { it.hp < it.max }?.minByOrNull { it.hp }
                            if (hurt != null) { session.pickMendTarget(hurt.c to hurt.r); session.audio.play("ui_tap") }
                            else { session.audio.play("ui_denied"); session.showFireNote(Text.t("hud.mend.none")) }
                        }
                    }
                    .semantics {
                        contentDescription = if (mt != null) Text.t("hud.mend.target", "col" to mt.first + 1, "row" to mt.second + 1) + ". " + Text.t("hud.mend.clear")
                        else Text.t("hud.mend.prompt")
                        this.selected = mt != null
                    }
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Label(if (mt != null) Text.t("hud.mend.target", "col" to mt.first + 1, "row" to mt.second + 1) + " ×" else Text.t("shell_card.stats.mend"), size = 12, bold = true, color = if (mt != null) Color.White else C.Ink, align = TextAlign.Center, maxLines = 2)
            }
        }
        // Doodads (1-10+, once per battle, uses this turn's Action) (Android-H4).
        for (id in doodads) {
            val name = content.shotName(id)
            val card = content.doodadCard(id)
            Box(
                Modifier.widthIn(min = 72.dp, max = 94.dp).heightIn(min = maxOf(56.dp, chip)).clip(RoundedCornerShape(11.dp))
                    .background(C.Kettle.copy(alpha = 0.24f)).border(1.5.dp, C.Blue, RoundedCornerShape(11.dp))
                    .clickable(enabled = enabled) {
                        if (id == "pot_lid") { session.audio.play("ui_sheet_open"); onPotLid() }
                        else session.useDoodad(id)
                    }
                    .semantics { contentDescription = Text.t("hud.doodad_chip", "doodad" to name, "card" to card) }
                    .padding(horizontal = 4.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    ShotArtwork(session.sprites, id, Modifier.size(28.dp))
                    Label(name, size = 12, bold = true, color = C.Ink, align = TextAlign.Center, maxLines = 1)
                }
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
            val state = HobLook.words(h)
            Box(
                Modifier.size(50.dp).alpha(if (h.bonked) 0.45f else 1f).clip(CircleShape)
                    .background(if (sel) C.BrassHi else C.ParchmentCard)
                    .border(if (sel) 2.5.dp else 1.5.dp, if (sel) C.Ink else C.SepiaBorder, CircleShape)
                    .clickable(enabled = enabled && !h.bonked) { session.pickHob(h) }
                    .semantics {
                        val args = arrayOf<Pair<String, Any?>>("hob" to session.content.hobShort(h.def), "class" to session.content.className(h.cls), "hp" to h.hp, "max" to h.max, "state" to state)
                        contentDescription = if (state.isEmpty()) Text.t("hud.hob_chip", *args) else Text.t("hud.hob_chip_state", *args)
                        this.selected = sel
                    },
                contentAlignment = Alignment.Center,
            ) {
                val ring = C.side(side)
                Canvas(Modifier.fillMaxSize().padding(1.dp)) {
                    val w = 3.5.dp.toPx()
                    drawArc(C.Locked, 0f, 360f, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w))
                    drawArc(if (sel) C.BrassMid else ring, -90f, 360f * frac, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w, cap = StrokeCap.Round))
                }
                if (!SpriteImage(session.sprites, "portrait_${Sprites.hobKey(h.def)}_${Sprites.team(side, u.hud.human(side))}", Modifier.fillMaxSize().padding(5.dp))) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Label(session.content.className(h.cls).take(1).uppercase(), size = 15, bold = true, color = C.Ink)
                        Label(session.content.hobShort(h.def), size = 9, color = C.InkSoft, maxLines = 1)
                    }
                }
                if (h.squashed) Label("★", Modifier.align(Alignment.TopEnd).clip(CircleShape).background(C.BrassMid).border(1.dp, C.Ink, CircleShape).padding(horizontal = 3.dp).clearAndSetSemantics { }, size = 10, bold = true, color = C.Ink)
                if (h.rest > 0) {
                    Row(
                        Modifier.align(Alignment.BottomEnd).clip(CircleShape).background(C.Ink).padding(horizontal = 4.dp, vertical = 1.dp).clearAndSetSemantics { },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RestCogIcon(Modifier.size(10.dp), tint = C.BrassHi)
                        Label("${h.rest}", size = 10, bold = true, color = Color.White)
                    }
                }
            }
        }
    }
    if (vertical) {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(5.dp)) { items() }
    } else {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { items() }
    }
}

@Composable
private fun Readout(session: GameSession, u: BattleUi, onTap: () -> Unit, nudge: (Int, Int, Boolean) -> Boolean) {
    val aim by session.aimState.collectAsState()
    val h = u.selected
    val dispAngle = if (h != null && h.side == 1) (1800 - aim.angle).coerceIn(0, 1800) else aim.angle
    val text = if (h != null) String.format(java.util.Locale.ROOT, "%.1f° | %d", dispAngle / 10f, aim.power) else "--° | --"
    val d = LocalDensity.current
    val step by rememberUpdatedState(nudge)
    HudTier2Plate(
        Modifier.widthIn(min = 88.dp).heightIn(min = 48.dp)
            .clickable(onClickLabel = Text.t("hud.fine_tune"), onClick = onTap)
            .pointerInput(Unit) {
                var ax = 0f; var ay = 0f
                val stepPx = with(d) { 5.dp.toPx() }
                detectDragGestures(onDragStart = { ax = 0f; ay = 0f }) { change, drag ->
                    change.consume(); ax += drag.x; ay += drag.y
                    val da = (ax / stepPx).toInt(); val dpw = (-ay / stepPx).toInt()
                    if (da != 0 || dpw != 0) { ax -= da * stepPx; ay += dpw * stepPx; step(-da * 5, dpw, false) }
                }
            }
            .semantics { contentDescription = if (h != null) Text.t("hud.aim_readout", "angle" to String.format(java.util.Locale.ROOT, "%.1f", dispAngle / 10f), "power" to aim.power) else Text.t("hud.no_hob") },
        pad = PaddingValues(horizontal = 7.dp, vertical = 4.dp),
    ) {
        Label(text, size = 15, bold = true, color = C.Ink, maxLines = 1)
    }
}

@Composable
private fun FineTunePad(session: GameSession, u: BattleUi, tapOnly: Boolean, nudge: (Int, Int, Boolean) -> Boolean, recall: () -> Unit) {
    session.aimState.collectAsState().value
    val (a, p) = session.aimBase(u)
    HudTier2Plate(pad = PaddingValues(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column { Key("−", Text.t("hud.angle_down"), a > 0, tapOnly, Text.t("hud.angle")) { nudge(-1, 0, true) }; Key("−", Text.t("hud.power_down"), p > 0, tapOnly, Text.t("hud.power")) { nudge(0, -1, true) } }
            Column(Modifier.widthIn(min = 66.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Label(String.format(java.util.Locale.ROOT, "%.1f°", a / 10f), size = 16, bold = true)
                Label("$p", size = 16, bold = true)
                CastleButton(
                    Text.t("hud.last_aim"), recall,
                    Modifier.padding(top = 2.dp).widthIn(min = 64.dp).heightIn(min = 48.dp),
                    color = C.Cream, size = 12, enabled = u.recallIndex >= 0,
                    description = Text.t("hud.last_aim_hint"), pad = PaddingValues(horizontal = 6.dp),
                )
            }
            Column { Key("+", Text.t("hud.angle_up"), a < ANGLE_MAX, tapOnly, Text.t("hud.angle")) { nudge(1, 0, true) }; Key("+", Text.t("hud.power_up"), p < POWER_MAX, tapOnly, Text.t("hud.power")) { nudge(0, 1, true) } }
        }
    }
}

@Composable
private fun Key(text: String, desc: String, enabled: Boolean, tapOnly: Boolean, what: String, onStep: () -> Boolean) {
    Box(
        Modifier.padding(2.dp).size(48.dp).clip(RoundedCornerShape(10.dp))
            .background(if (enabled) C.Cream else C.DisabledBg)
            .border(1.5.dp, if (enabled) C.Ink else C.SepiaBorder, RoundedCornerShape(10.dp))
            .tapOrHold(enabled, tapOnly, desc, onStep),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Label(what, size = 9, color = if (enabled) C.InkSoft else C.DisabledInk, maxLines = 1)
            Label(text, size = 14, bold = true, color = if (enabled) C.Ink else C.DisabledInk)
        }
    }
}

/** Tier-1 Beveled Brass Medallion FIRE / PASS button (Plate 1 & 2). */
@Composable
private fun FireButton(session: GameSession, u: BattleUi, fire: () -> Unit, pass: () -> Unit) {
    val h = u.selected
    val buried = h?.buried == true
    val mustPass = FireLight.mustPass(u.hud, u.humanTurn, u.hobs, u.side)
    val ready = !mustPass && FireLight.ready(u.hud, u.humanTurn, h)
    val why = whyNow(session, u)
    val label = when {
        mustPass -> Text.t("hud.pass.forced")
        buried -> Text.t("hud.why.buried")
        ready -> Text.t("hud.fire")
        else -> Text.t("hud.fire_locked", "why" to (why ?: ""))
    }
    val tappable = u.humanTurn && (h != null || mustPass)
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
    val brush = when {
        mustPass -> Brush.verticalGradient(listOf(C.Paper, C.Cream))
        ready -> Brush.verticalGradient(listOf(C.BrassHi, C.BrassMid, C.BrassLo))
        else -> Brush.verticalGradient(listOf(C.DisabledBg, Color(0xFFD2C7B4)))
    }
    val caption = when {
        mustPass -> Text.t("hud.pass.button")
        buried -> Text.t("hud.why_short.buried")
        else -> Text.t("hud.fire")
    }
    HudTier1Medallion(
        modifier = Modifier.size(76.dp).graphicsLayer { scaleX = k; scaleY = k }
            .onReleaseInside(tappable, label) {
                when {
                    mustPass -> { pressAt = SystemClock.uptimeMillis(); pass() }
                    ready -> { pressAt = SystemClock.uptimeMillis(); fire() }
                    else -> session.fireRefusedHere()
                }
            },
        shape = CircleShape,
        enabled = ready || mustPass,
        brush = brush,
    ) {
        Label(
            caption,
            size = if (buried && !mustPass) 12 else if (mustPass) 16 else 18,
            bold = true,
            color = if (ready || mustPass) C.Ink else C.DisabledInk,
        )
    }
}

/** Words by Fire: why a Fire was refused, or why grey Fire can not go (hud.fire.why in the string table's words). */
@Composable
private fun FireNote(session: GameSession, u: BattleUi, modifier: Modifier) {
    val note = session.fireNote
    var now by remember { mutableLongStateOf(SystemClock.uptimeMillis()) }
    LaunchedEffect(note) { while (note != null && SystemClock.uptimeMillis() < note.second) { now = SystemClock.uptimeMillis(); delay(250) }; now = SystemClock.uptimeMillis() }
    val mustPass = FireLight.mustPass(u.hud, u.humanTurn, u.hobs, u.side)
    val text = note?.takeIf { now < it.second }?.first ?: if (!mustPass && u.humanTurn && !FireLight.ready(u.hud, true, u.selected)) whyNow(session, u) else null
    if (text.isNullOrEmpty()) return
    Label(
        text,
        modifier.widthIn(max = 360.dp).clip(RoundedCornerShape(10.dp))
            .background(C.BadBg).border(1.5.dp, C.BadBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
        size = 13, bold = true, color = C.BadInk, align = TextAlign.Center, maxLines = 2,
    )
}

/** A battle banner from the core's events: Fatigue next round, Fatigue, a shot moved to the Plain Shot. */
@Composable
private fun BattleBanner(session: GameSession, modifier: Modifier) {
    val b = session.banner ?: return
    var now by remember { mutableLongStateOf(SystemClock.uptimeMillis()) }
    LaunchedEffect(b) { while (SystemClock.uptimeMillis() < b.second) { now = SystemClock.uptimeMillis(); delay(200) }; now = SystemClock.uptimeMillis() }
    if (now >= b.second) return
    Label(
        b.first,
        modifier.widthIn(max = 420.dp).clip(RoundedCornerShape(16.dp))
            .background(if (session.bannerDanger) C.BadBorder else C.Ink)
            .border(2.dp, C.Ink, RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 6.dp).clearAndSetSemantics { },
        size = 15, bold = true, color = Color.White, align = TextAlign.Center, maxLines = 2,
    )
}

/** Shove Off: shown when the selected Hob's Loophole is buried. Checks both per-turn and total Steam (Android-C2). */
@Composable
private fun ShoveOff(session: GameSession, u: BattleUi, enabled: Boolean) {
    val h = u.selected ?: return
    if (!h.buried || !u.humanTurn) return
    val cost = u.hud.shoveOffCost
    val can = enabled && FireLight.canShoveOff(u.hud, u.side)
    CastleButton(
        Text.t("hud.shove_off.cost", "n" to cost),
        {
            session.send(Cmd.shoveOff(h.id)) { r ->
                if (!r.ok && !LiveBattle.isDead(r.reason)) {
                    val words = when (r.reason) {
                        "no_steam" -> Text.t("hud.shove_off.no_steam")
                        "not_buried" -> Text.t("hud.shove_off.nothing")
                        else -> Text.opt("hud.why.${r.reason}", "hob" to session.content.hobShort(h.def)) ?: Text.t("hud.shove_off.not_now")
                    }
                    session.audio.play("ui_denied")
                    session.showFireNote(words)
                } else if (r.ok) {
                    session.audio.play("ui_confirm")
                    session.buzz(15)
                }
            }
        },
        Modifier.heightIn(min = 48.dp), color = C.Cream, size = 12, enabled = can,
        description = Text.t("hud.shove_off.hint", "n" to cost),
    )
}

/** Why grey Fire can not go, in the string table's words, with the picked Hob and shot named. */
internal fun whyNow(session: GameSession, u: BattleUi): String? {
    val h = u.selected
    val id = when (u.hud.selectedShot) { "plain" -> h?.plain; "knack" -> h?.knack; else -> u.hud.selectedShot }
    return FireLight.why(u.hud, h?.let { session.content.hobShort(it.def) } ?: "", id?.takeIf { it.isNotEmpty() }?.let { session.content.shotName(it) } ?: "")
}


// ---- Decision-Grade Shell Inspect Card (Plate 5) -----------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ShellInspectCard(session: GameSession, u: BattleUi, shotId: String, onDismiss: () -> Unit) {
    val detail = session.content.shotDetail(shotId)
    val handItem = u.hud.hands.getOrElse(u.side) { emptyList() }.firstOrNull { it.id == shotId }
    val name = detail?.name ?: handItem?.name ?: session.content.shotName(shotId)
    val weight = (detail?.weight ?: handItem?.weight ?: "L").uppercase()
    val weightLabel = Text.t("shell_card.weight." + when (weight) { "H" -> "heavy"; "M" -> "medium"; else -> "light" })
    val restCogs = detail?.restCogs ?: when (weight) { "H" -> 2; "M" -> 1; else -> 0 }
    val restLabel = if (restCogs == 0) Text.t("shell_card.rest.none") else Text.plural("shell_card.rest", restCogs)
    val cardText = detail?.card?.ifEmpty { null } ?: handItem?.card?.ifEmpty { null } ?: session.content.shotCard(shotId)
    val matchId = (detail?.matchClass ?: handItem?.match ?: "").takeIf { it.isNotEmpty() && it != "all" }
    val matchLabel = matchId?.let { session.content.className(it) }?.ifEmpty { null }
    val matchHob = matchId?.let { session.content.hobForClass(it) }
    // What kind of shot this is, for a shot that is not a Trick Shell: the Plain Shot, or a Hob's Knack.
    val owner = u.hobs.firstOrNull { it.side == u.side && it.knack == shotId }
    val kindLine = when {
        u.hobs.any { it.side == u.side && it.plain == shotId } -> Text.t("shell_card.plain")
        owner != null -> Text.t("shell_card.knack", "hob" to session.content.hobShort(owner.def))
        detail?.kind == "trick" || handItem != null -> Text.t("shell_card.trick")
        else -> ""
    }

    Box(
        Modifier.fillMaxSize().semantics { paneTitle = name },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.62f))
                .clickable(onClickLabel = Text.t("shell_card.a11y_close"), onClick = onDismiss),
        )
        Plate(
            Modifier.padding(16.dp).widthIn(max = 420.dp),
            color = C.ParchmentCard,
            pad = 16.dp,
        ) {
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Header: artwork + Name + Weight · N Rest Cogs chip
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        Modifier.size(60.dp).clip(RoundedCornerShape(12.dp))
                            .background(C.Cream).border(1.5.dp, C.SepiaBorder, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        ShotArtwork(session.sprites, shotId, Modifier.size(46.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Label(name, Modifier.semantics { heading() }, size = 20, bold = true, color = C.Ink)
                        Row(
                            Modifier.clip(PillShape).background(C.Cream).border(1.dp, C.SepiaBorder, PillShape)
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Label(
                                Text.t("shell_card.weight_rest", "weight" to weightLabel, "rest" to restLabel),
                                size = 12, bold = true, color = C.Ink,
                            )
                            repeat(restCogs) { RestCogIcon(Modifier.size(14.dp)) }
                        }
                    }
                }

                // Visual Damage Bar + Blast / Dig / Tunnel stats from ContentInfo
                if (detail != null) {
                    val dmgVal = if (detail.mendHp > 0 && detail.damage <= 8) detail.mendHp else detail.damage
                    val frac = (dmgVal / 90f).coerceIn(0.08f, 1f)
                    val barColor = when {
                        detail.mendHp > 0 && detail.damage <= 8 -> C.GoodBg
                        detail.dtype == "pierce" -> C.Blue
                        detail.flightKind == "dig" -> C.Orange
                        else -> C.BrassLo
                    }
                    val dmgCaption = when {
                        detail.dud -> Text.t("shell_card.stats.damage") + ": 1. " + Text.t("shell_card.stats.dud")
                        detail.mendHp > 0 && detail.damage <= 8 -> Text.t("shell_card.stats.mend") + ": " + Text.t("shell_card.stats.mend_value", "n" to detail.mendHp)
                        detail.splitCount > 1 -> Text.t("shell_card.stats.damage") + ": " + Text.t("shell_card.stats.split_damage", "n" to detail.splitCount, "dmg" to detail.damage) + ". " + detail.dtypeLabel
                        else -> Text.t("shell_card.stats.damage") + ": ${detail.damage}. " + detail.dtypeLabel
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Label(dmgCaption, size = 13, bold = true, color = C.Ink)
                        Box(Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp)).background(C.DisabledBg).border(1.dp, C.Ink, RoundedCornerShape(6.dp))) {
                            Box(Modifier.fillMaxHeight().fillMaxWidth(frac).background(barColor))
                        }
                    }

                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (detail.tunnelCells > 0) StatChip(Text.t("shell_card.stats.tunnel", "n" to detail.tunnelCells))
                        if (detail.band.isNotEmpty()) StatChip(Text.t("shell_card.stats.blast", "band" to (Text.opt("shell_card.bands.${detail.band}") ?: detail.band)))
                        if (detail.splitCount > 1) StatChip(Text.t("shell_card.stats.splits", "n" to detail.splitCount))
                        if (detail.bounces > 0) StatChip(Text.plural("shell_card.stats.bounces", detail.bounces))
                        if (detail.flightKind == "roller") StatChip(Text.t("shell_card.stats.rolls"))
                        if ("threads" in detail.tags) StatChip(Text.t("shell_card.stats.threads"))
                    }
                    if (detail.goodAt.isNotEmpty()) Label(detail.goodAt, size = 13, color = C.Ink)
                }

                // Golden Class Match banner ("Best with a Digger: no Rest, hits 10% harder").
                if (matchLabel != null) {
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                            .background(Brush.horizontalGradient(listOf(C.BrassHi, Color(0xFFFFEEB8))))
                            .border(1.5.dp, C.BrassLo, RoundedCornerShape(12.dp))
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (matchHob != null) {
                            Box(
                                Modifier.size(34.dp).clip(CircleShape).background(C.Paper).border(1.5.dp, C.Ink, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (!SpriteImage(session.sprites, "portrait_${Sprites.hobKey(matchHob.first)}_blue", Modifier.fillMaxSize().padding(2.dp))) {
                                    Label(session.content.hobShort(matchHob.first).take(1), size = 14, bold = true, color = C.Ink)
                                }
                            }
                        }
                        Label(Text.t("shell_card.best_with", "class" to matchLabel, "pct" to MATCH_PCT), Modifier.weight(1f), size = 13, bold = true, color = C.Ink)
                    }
                }

                // Plain-English tactical card description (never omitted!)
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                        .background(C.Cream).border(1.dp, C.SepiaBorder, RoundedCornerShape(10.dp))
                        .padding(10.dp),
                ) {
                    Column {
                        if (cardText.isNotEmpty()) Label(cardText, size = 14, color = C.Ink)
                        if (kindLine.isNotEmpty()) Label(kindLine, size = 12, color = C.InkSoft)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            CastleButton(Text.t("common.close"), onDismiss, Modifier.fillMaxWidth(), color = C.Gold, size = 15)
        }
    }
}

/** The Match Class bonus in percent (docs/design/00, "Match bonus": a rule of the core, not a content number). */
private const val MATCH_PCT = 10

@Composable
private fun StatChip(text: String) {
    Label(
        text,
        Modifier.clip(RoundedCornerShape(8.dp)).background(C.Paper).border(1.dp, C.SepiaBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        size = 12, bold = true, color = C.Ink,
    )
}

// ---- Modal Cards (Handoff, Pot Lid, Pause) -----------------------------------

@Composable
private fun HandoffCard(session: GameSession, u: BattleUi) {
    val to = session.handoffTo
    val name = u.hud.names.getOrElse(to) { Text.t("setup.player_label", "n" to to + 1) }
    var armed by remember(to, u.hud.turn) { mutableStateOf(false) }
    var scale by remember(to, u.hud.turn) { mutableStateOf(1f) }
    val track = session.anims.cardScale
    val still = session.settings.reduceMotion
    LaunchedEffect(to, u.hud.turn) {
        armed = false
        val start = SystemClock.uptimeMillis()
        while (true) {
            val e = (SystemClock.uptimeMillis() - start).toFloat()
            scale = if (still) 1f else track.at(e)
            if (e >= 400f) break
            delay(16)
        }
        scale = 1f; armed = true
    }
    BoxWithConstraints(
        Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f))
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
            .semantics { paneTitle = Text.t("handoff.pass_to") },
        contentAlignment = Alignment.Center,
    ) {
        val compact = PhoneLayout.handoffCompact(maxHeight.value)
        val gap = if (compact) 4.dp else 10.dp
        Column(
            Modifier.padding(if (compact) 8.dp else 20.dp).widthIn(max = if (compact) 460.dp else 380.dp)
                .verticalScroll(rememberScrollState()).graphicsLayer { scaleX = scale; scaleY = scale }
                .clip(RoundedCornerShape(20.dp)).background(C.Paper)
                .border(if (compact) 6.dp else 8.dp, C.side(to), RoundedCornerShape(20.dp))
                .padding(if (compact) 14.dp else 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (session.handoffLine.isNotEmpty()) Label(session.handoffLine, size = if (compact) 12 else 14, color = C.InkSoft, align = TextAlign.Center, maxLines = 2)
            Spacer(Modifier.height(gap))
            if (!compact) Label(if (to == 0) "●  ●  ●" else "◆  ◆  ◆", Modifier.clearAndSetSemantics { }, size = 20, color = C.side(to))
            Label(Text.t("handoff.pass_to"), size = if (compact) 14 else 16)
            Label(name, Modifier.semantics { heading() }, size = if (compact) 26 else 32, bold = true, color = C.sideInk(to), align = TextAlign.Center, maxLines = 1)
            val marks = u.hud.handicap.getOrNull(to)?.marks ?: 0
            if (marks > 0) Label(Text.t("handoff.help", "level" to Text.t(if (marks == 1) "setup.help.some" else "setup.help.lots")) + " " + "+".repeat(marks), size = 14, color = C.OrangeInk, bold = true)
            u.hud.volley?.let { v -> Label(Text.t("hud.score", "a" to u.hud.score.getOrElse(0) { 0 }, "b" to u.hud.score.getOrElse(1) { 0 }) + ". " + Text.t("hud.shots_left", "n" to v.left.getOrElse(to) { 0 }, "total" to v.actions), size = 13) }
            Spacer(Modifier.height(if (compact) 2.dp else 6.dp))
            Label(Text.t("handoff.kettle", "n" to u.hud.kettlePct.getOrElse(to) { 0 }) + ". " + HudText.round(u.hud, u.mode), size = 14)
            Spacer(Modifier.height(if (compact) 8.dp else 16.dp))
            CastleButton(Text.t("handoff.ready"), { if (armed) session.handoffReady() }, Modifier.size(width = 200.dp, height = if (compact) 56.dp else 72.dp), size = 22, description = Text.t("handoff.spoken", "name" to name))
        }
    }
}

/** Pot Lid room picker (Android-H4): choose Kettle Room or any intact unlidded Nook. */
@Composable
private fun PotLidCard(session: GameSession, u: BattleUi, onDismiss: () -> Unit) {
    val castle = session.frame.castles.firstOrNull { it.side == u.side }
    val kettleOpen = castle?.kettle?.let { it.intact && !it.lid } == true
    val nooks = castle?.rooms?.filter { it.kind == "nook" && it.intact && !it.lid }.orEmpty()
    val hobs = u.hobsOf(u.side)
    Box(
        Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f))
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
            .semantics { paneTitle = session.content.shotName("pot_lid") },
        contentAlignment = Alignment.Center,
    ) {
        Plate(Modifier.padding(16.dp).widthIn(max = 420.dp), pad = 16.dp) {
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                Label(session.content.shotName("pot_lid"), Modifier.fillMaxWidth().semantics { heading() }, size = 22, bold = true, align = TextAlign.Center)
                val card = session.content.doodadCard("pot_lid")
                if (card.isNotEmpty()) Label(card, Modifier.fillMaxWidth().padding(top = 4.dp), size = 13, align = TextAlign.Center)
                Label(Text.t("hud.doodad.go"), Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 12, color = C.InkSoft, align = TextAlign.Center)
                if (kettleOpen) {
                    CastleButton(Text.t("hud.doodad.kettle_room"), { session.useDoodad("pot_lid", "kettle"); onDismiss() }, Modifier.fillMaxWidth().padding(top = 6.dp))
                }
                for (rm in nooks) {
                    val seated = hobs.firstOrNull { it.nook == rm.id && !it.bonked }?.let { session.content.hobShort(it.def) }
                    val title = if (seated != null) Text.t("hud.doodad.nook_with", "n" to rm.id + 1, "hob" to seated) else Text.t("hud.doodad.nook", "n" to rm.id + 1)
                    CastleButton(title, { session.useDoodad("pot_lid", "nook:${rm.id}"); onDismiss() }, Modifier.fillMaxWidth().padding(top = 6.dp), color = C.Cream)
                }
                if (!kettleOpen && nooks.isEmpty()) {
                    Label(Text.t("hud.doodad.no_room"), Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
                }
            }
            CastleButton(Text.t("common.cancel"), { session.audio.play("ui_sheet_open", semis = -4f); onDismiss() }, Modifier.fillMaxWidth().padding(top = 10.dp), color = C.Cream)
        }
    }
}

@Composable
private fun PauseCard(session: GameSession) {
    var settings by remember { mutableStateOf(false) }
    var giveUp by remember { mutableStateOf(false) }
    Box(
        Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f))
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }
            .semantics { paneTitle = Text.t("pause.title") },
        contentAlignment = Alignment.Center,
    ) {
        Plate(Modifier.padding(16.dp).widthIn(max = 520.dp), pad = 16.dp) {
            if (settings) {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) { SettingsBody(session) }
                CastleButton(Text.t("common.done"), { settings = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
            } else if (giveUp) {
                val u = session.ui.collectAsState().value
                val duel = u.hud.human(0) && u.hud.human(1)
                val who = u.hud.names.getOrElse(u.side) { "" }
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                    Label(if (duel) Text.t("pause.give_up_confirm.title_duel", "name" to who) else Text.t("pause.give_up_confirm.title"), Modifier.fillMaxWidth().semantics { heading() }, size = 22, bold = true, align = TextAlign.Center)
                    Label(Text.t(if (duel) "pause.give_up_confirm.body_duel" else "pause.give_up_confirm.body"), Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
                    CastleButton(Text.t("pause.give_up_confirm.no"), { giveUp = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
                    CastleButton(Text.t("pause.give_up_confirm.yes"), { session.giveUp() }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                }
            } else {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                    val u = session.ui.collectAsState().value
                    val rule = when {
                        u.mode == "test_yard" -> Text.t("pause.rule_yard")
                        u.hud.volley != null -> Text.t("pause.rule_volley", "n" to u.hud.volley!!.actions)
                        else -> Text.t("pause.rule_knockout") + " " + Text.t("pause.rule_rounds_squall", "n" to u.hud.roundCap)
                    }
                    Label(Text.t("pause.title"), Modifier.fillMaxWidth().semantics { heading() }, size = 24, bold = true, align = TextAlign.Center)
                    Label(rule, Modifier.fillMaxWidth().padding(top = 4.dp), size = 13, color = C.Ink, align = TextAlign.Center)
                    Label(Text.t("pause.saved_note"), Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
                    CastleButton(Text.t("pause.carry_on"), { session.paused = false; session.audio.play("ui_sheet_open", semis = -4f) }, Modifier.fillMaxWidth().padding(top = 8.dp))
                    CastleButton(Text.t("pause.settings"), { settings = true }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                    CastleButton(Text.t("pause.save_and_leave"), { session.leaveBattle() }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                    CastleButton(Text.t("pause.give_up"), { giveUp = true }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                }
            }
        }
    }
}

package games.castleprotect.ui

import android.os.SystemClock
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import games.castleprotect.battle.Sprites
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import games.castleprotect.battle.BattleView
import games.castleprotect.core.Cmd
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.Phase
import games.castleprotect.game.GameSession
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.roundToInt

private class ViewRef { var view: BattleView? by mutableStateOf(null) }

/**
 * Battle: the field (BattleView) with the native HUD over it.
 * Wide layout when width is at least 1.2 times the height, Tall layout (stacked
 * lenses) otherwise, with hysteresis 1.15 / 1.25 so a resize does not flap.
 * The layout is recomputed from the window each time; no battle state lives here.
 */
@Composable
fun BattleScreen(session: GameSession) {
    val hud by session.hud.collectAsState()
    val ref = remember { ViewRef() }
    val field = remember {
        movableContentOf {
            AndroidView(factory = { ctx -> BattleView(ctx, session).also { ref.view = it } }, modifier = Modifier.fillMaxSize().semantics { contentDescription = "Battle field. Drag on your fort to aim, or use the Fine Tune keys, then press Fire." })
        }
    }
    var fineTuneAt by remember { mutableLongStateOf(0L) }   // uptime of the last nudge; the pad folds 4 s later
    var fineOpen by remember { mutableStateOf(false) }
    val dragging = ref.view?.dragging?.value ?: false
    val manual = ref.view?.manual?.value ?: false
    val s = session.settings

    // Fine Tune opens after any Aim Drag and folds away 4 s after the last nudge.
    LaunchedEffect(dragging) { if (!dragging && ref.view != null && ref.view!!.dragEndedAt > 0 && hud.humanTurn) { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() } }
    LaunchedEffect(fineOpen, fineTuneAt) { if (fineOpen) { delay(4000); fineOpen = false } }
    LaunchedEffect(hud.humanTurn) { if (!hud.humanTurn) fineOpen = false }
    // Rival turns at 2x, if the player asked for it.
    LaunchedEffect(hud.turnSeq, hud.phase) {
        if (hud.phase == Phase.PLAN) session.send(Cmd.speed(if (!hud.humanTurn && s.rival2x) 2 else 1))
    }
    LaunchedEffect(hud.phase) { if (hud.phase == Phase.ENDED) { delay(1400); session.showResults() } }

    val nudge: (Int, Int) -> Unit = { da, dp ->
        val a = (hud.aimAngle + da).coerceIn(0, 1800); val p = (hud.aimPower + dp).coerceIn(0, 100)
        if (a != hud.aimAngle || p != hud.aimPower || !hud.aimSet) { session.send(Cmd.aim(a, p)); session.sfx.play("tick", gain = 0.5f); session.buzz(5) }
        fineTuneAt = SystemClock.uptimeMillis(); fineOpen = true
    }
    val fire: () -> Unit = {
        // 150 ms guard after an Aim Drag ends, so a stray lift cannot land on Fire.
        val v = ref.view
        if (v == null || SystemClock.uptimeMillis() - v.dragEndedAt > 150) { if (session.send(Cmd.FIRE)) fineOpen = false }
    }
    val viewer = if (hud.humans.getOrElse(hud.activeSide) { false }) hud.activeSide else if (hud.humans.getOrElse(0) { true }) 0 else 1
    val flying = hud.phase == Phase.FLIGHT || hud.phase == Phase.RESOLVE
    val dim = dragging
    val canAct = hud.humanTurn && !dragging

    BoxWithConstraints(Modifier.fillMaxSize().background(C.Sky)) {
        val ratio = maxWidth.value / maxHeight.value
        var tall by remember { mutableStateOf(ratio < 1.2f) }
        if (tall && ratio > 1.25f) tall = false else if (!tall && ratio < 1.15f) tall = true
        val safe = WindowInsets.safeDrawing.asPaddingValues()
        val dir = LocalLayoutDirection.current
        val density = LocalDensity.current
        ref.view?.tall = tall

        if (tall) {
            Column(Modifier.fillMaxSize().padding(top = safe.calculateTopPadding())) {
                TopStrip(hud, tall = true)
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    field()
                    TurnBanner(hud, Modifier.align(Alignment.TopCenter).padding(top = 8.dp))
                    if (manual) CastleButton("Re-frame", { ref.view?.reframe() }, Modifier.align(Alignment.TopEnd).padding(6.dp), color = C.Paper, size = 12)
                    // Floats along the foot of the Bottom lens: Pause and Walk on the left, readout or Fine Tune on the right.
                    Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.Bottom) {
                        PauseButton(session)
                        Spacer(Modifier.width(6.dp))
                        if (!flying) Box(Modifier.alpha(if (dim) 0.25f else 1f).blockInput(dim)) { WalkPad(session, hud, canAct) }
                        Spacer(Modifier.weight(1f))
                        if (flying) SpeedButton(session, hud)
                        else if (hud.humanTurn) { if (fineOpen && !dragging) FineTunePad(hud, s.tapOnly, nudge) { session.send(Cmd.RECALL); fineTuneAt = SystemClock.uptimeMillis() } else if (!dragging) Readout(hud, { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() }, nudge) }
                    }
                }
                if (!flying) {
                    Column(Modifier.background(C.Paper).padding(bottom = safe.calculateBottomPadding())) {
                        Box(Modifier.alpha(if (dim) 0.25f else 1f).blockInput(dim)) { ShotTray(session, hud, canAct, 48.dp) }
                        Row(Modifier.fillMaxWidth().height(80.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.weight(1f).alpha(if (dim) 0.25f else 1f).blockInput(dim)) { CrewRow(session, hud, viewer, canAct, vertical = false) }
                            FireButton(hud, fire)
                        }
                    }
                }
            }
        } else {
            // Tell the field how much of each edge the Wide HUD covers, so auto-frame keeps both forts in the Clear Rect.
            with(density) {
                ref.view?.hudPad = floatArrayOf((safe.calculateLeftPadding(dir) + 60.dp).toPx(), (safe.calculateTopPadding() + 40.dp).toPx(), (safe.calculateRightPadding(dir) + 8.dp).toPx(), (safe.calculateBottomPadding() + 68.dp).toPx())
            }
            field()
            Column(Modifier.fillMaxSize().padding(start = safe.calculateLeftPadding(dir), end = safe.calculateRightPadding(dir), bottom = safe.calculateBottomPadding())) {
                TopStrip(hud, tall = false, pause = { PauseButton(session) })
                // The bottom clusters mirror for the Left-hand layout; the top strip never does (sides are fixed).
                CompositionLocalProvider(LocalLayoutDirection provides if (s.leftHand) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        TurnBanner(hud, Modifier.align(Alignment.TopCenter).padding(top = 6.dp))
                        if (manual) CastleButton("Re-frame", { ref.view?.reframe() }, Modifier.align(Alignment.TopEnd).padding(6.dp), color = C.Paper, size = 12)
                        if (!flying) Box(Modifier.align(Alignment.CenterStart).padding(start = 4.dp).alpha(if (dim) 0.25f else 1f).blockInput(dim)) { CrewRow(session, hud, viewer, canAct, vertical = true) }
                        if (fineOpen && hud.humanTurn && !dragging) Box(Modifier.align(Alignment.BottomEnd).padding(end = 92.dp, bottom = 4.dp)) { FineTunePad(hud, s.tapOnly, nudge) { session.send(Cmd.RECALL); fineTuneAt = SystemClock.uptimeMillis() } }
                    }
                    Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp), verticalAlignment = Alignment.Bottom) {
                        if (!flying) {
                            Row(Modifier.weight(1f).alpha(if (dim) 0.25f else 1f).blockInput(dim), verticalAlignment = Alignment.Bottom) {
                                WalkPad(session, hud, canAct)
                                Spacer(Modifier.width(8.dp))
                                Box(Modifier.weight(1f)) { ShotTray(session, hud, canAct, 52.dp) }
                            }
                            Spacer(Modifier.width(8.dp))
                            if (hud.humanTurn && !fineOpen && !dragging) Readout(hud, { fineOpen = true; fineTuneAt = SystemClock.uptimeMillis() }, nudge)
                            Spacer(Modifier.width(8.dp))
                            FireButton(hud, fire)
                        } else { Spacer(Modifier.weight(1f)); SpeedButton(session, hud) }
                    }
                }
            }
        }

        hud.handoff?.let { if (hud.phase == Phase.HANDOFF) HandoffCard(session, hud) }
        if (session.paused) PauseCard(session)
    }
}

// ---- top strip ---------------------------------------------------------------

@Composable
private fun TopStrip(hud: Hud, tall: Boolean, pause: (@Composable () -> Unit)? = null) {
    val round = when {
        hud.squallIn == 0 -> "Sudden Squall"
        hud.squallIn in 1..3 -> "Round ${hud.round}/${hud.roundCap}  Squall in ${hud.squallIn}"
        else -> "Round ${hud.round}/${hud.roundCap}"
    }
    val windText = if (hud.wind == 0) "Calm" else "Wind ${abs(hud.wind)} to the ${if (hud.wind > 0) "right" else "left"}"
    val desc = "${hud.names.getOrElse(0) { "" }} kettle ${hud.kettlePct.getOrElse(0) { 0 }} percent. ${hud.names.getOrElse(1) { "" }} kettle ${hud.kettlePct.getOrElse(1) { 0 }} percent. $round. $windText."
    val mod = Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).clearAndSetSemantics { contentDescription = desc }
    if (tall) {
        Column(mod.height(56.dp).padding(horizontal = 8.dp), verticalArrangement = Arrangement.Center) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                KettleGauge(hud, 0); Spacer(Modifier.weight(1f)); RoundLabel(round, hud.squallIn >= 0); Spacer(Modifier.weight(1f)); KettleGauge(hud, 1)
            }
            Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Pips(hud.hobs.getOrElse(0) { emptyList() }, 0); Spacer(Modifier.weight(1f)); Wind(hud); Spacer(Modifier.weight(1f)); Pips(hud.hobs.getOrElse(1) { emptyList() }, 1)
            }
        }
    } else {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            pause?.invoke()
            Row(mod.weight(1f).height(36.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                KettleGauge(hud, 0); Spacer(Modifier.width(6.dp)); Pips(hud.hobs.getOrElse(0) { emptyList() }, 0)
                Spacer(Modifier.weight(1f)); RoundLabel(round, hud.squallIn >= 0); Spacer(Modifier.width(12.dp)); Wind(hud); Spacer(Modifier.weight(1f))
                Pips(hud.hobs.getOrElse(1) { emptyList() }, 1); Spacer(Modifier.width(6.dp)); KettleGauge(hud, 1)
            }
        }
    }
}

@Composable
private fun KettleGauge(hud: Hud, side: Int) {
    val pct = hud.kettlePct.getOrElse(side) { 0 }
    Row(Modifier.clip(RoundedCornerShape(10.dp)).border(2.dp, C.side(side), RoundedCornerShape(10.dp)).padding(horizontal = 6.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(if (pct <= 25) C.Danger else C.Kettle).border(1.5.dp, C.Ink, CircleShape))
        Label(" $pct%" + if (pct in 1..50) " !" else "", size = 14, bold = true)
    }
}

@Composable
private fun Pips(hobs: List<Hob>, side: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (h in hobs) {
            val frac = if (h.hpMax > 0) h.hp.toFloat() / h.hpMax else 0f
            val col = C.side(side)
            // Yours are round, the Rival's are diamonds: shape as well as colour tells the sides apart.
            Canvas(Modifier.size(18.dp)) {
                val r = size.minDimension / 2
                if (side == 0) {
                    drawCircle(C.Paper, r); drawArc(if (h.bonked) C.Locked else col, -90f, 360f * frac, true)
                    drawCircle(C.Ink, r, style = Stroke(1.5.dp.toPx()))
                } else {
                    val p = androidx.compose.ui.graphics.Path().apply { moveTo(r, 0f); lineTo(2 * r, r); lineTo(r, 2 * r); lineTo(0f, r); close() }
                    drawPath(p, if (h.bonked) C.Locked else C.Paper)
                    if (!h.bonked) drawRect(col, Offset(r * 0.5f, r * 0.5f + r * (1 - frac)), Size(r, r * frac))
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
private fun Wind(hud: Hud) {
    fun arrow(v: Int) = if (v == 0) "· 0" else if (v > 0) "→ $v" else "← ${-v}"
    Row(verticalAlignment = Alignment.CenterVertically) {
        Label(arrow(hud.wind), size = 15, bold = true)
        Label("   next ${arrow(hud.forecast)}", size = 11, color = C.InkSoft)
    }
}

@Composable
private fun TurnBanner(hud: Hud, modifier: Modifier) {
    var shown by remember { mutableIntStateOf(-1) }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(hud.turnSeq, hud.phase == Phase.PLAN) {
        if (hud.phase == Phase.PLAN && shown != hud.turnSeq) { shown = hud.turnSeq; visible = true; delay(1200); visible = false }
    }
    if (!visible) return
    val name = hud.names.getOrElse(hud.activeSide) { "" }
    val both = hud.humans.all { it }
    val text = when {
        hud.squallIn == 0 -> "Sudden Squall"
        both -> "$name's turn"
        hud.humanTurn -> "Your turn"
        else -> "$name aims"
    }
    // Display only: it never takes taps. Screen readers hear it as a polite announcement.
    Label(text, modifier.widthIn(min = 200.dp).clip(RoundedCornerShape(22.dp)).background(C.side(hud.activeSide)).border(2.dp, C.Ink, RoundedCornerShape(22.dp)).padding(horizontal = 24.dp, vertical = 10.dp).semantics { liveRegion = LiveRegionMode.Polite },
        size = 18, bold = true, color = Color.White, align = TextAlign.Center)
}

// ---- controls ----------------------------------------------------------------

@Composable
private fun PauseButton(session: GameSession) {
    CastleButton("II", { session.paused = true }, Modifier.size(48.dp), color = C.Paper, description = "Pause", pad = androidx.compose.foundation.layout.PaddingValues(0.dp))
}

@Composable
private fun SpeedButton(session: GameSession, hud: Hud) {
    CastleButton(if (hud.speed >= 2) "1x" else "2x", { session.send(Cmd.speed(if (hud.speed >= 2) 1 else 2)) }, Modifier.size(64.dp, 48.dp), description = if (hud.speed >= 2) "Normal speed" else "Double speed")
}

@Composable
private fun WalkPad(session: GameSession, hud: Hud, enabled: Boolean) {
    val can = enabled && hud.steam > 0
    Column(Modifier.clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape).padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        // Steam gauge: the teal is reserved for the kettle and Steam.
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(64.dp).height(8.dp).clip(RoundedCornerShape(4.dp)).background(C.InkSoft)) {
                Box(Modifier.fillMaxHeight().fillMaxWidth(hud.steam.coerceIn(0, 100) / 100f).background(C.Kettle))
            }
            Label(" S ${hud.steam}", Modifier.semantics { contentDescription = "Steam ${hud.steam}" }, size = 11, bold = true)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for ((label, dx, desc) in listOf(Triple("◀", -2, "Walk left"), Triple("▶", 2, "Walk right"))) {
                Box(Modifier.size(48.dp).alpha(if (can) 1f else 0.4f).clip(CircleShape).background(C.Cream).border(2.dp, C.Ink, CircleShape)
                    .tapOrHold(can, session.settings.tapOnly, desc) { session.send(Cmd.walk(dx)) }, contentAlignment = Alignment.Center) { Label(label, size = 18, bold = true) }
            }
        }
    }
}

@Composable
private fun ShotTray(session: GameSession, hud: Hud, enabled: Boolean, chip: Dp) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 6.dp, vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally)) {
        for (shot in hud.shots) {
            val sel = shot.id == hud.selectedShot
            val out = shot.uses == 0
            val uses = if (shot.uses < 0) "" else ", ${shot.uses} left"
            val cogs = if (shot.weight > 0) ", weight ${shot.weight}" else ""
            Box(Modifier.size(width = chip + 12.dp, height = chip).alpha(if (out || !enabled) 0.5f else 1f).clip(RoundedCornerShape(10.dp)).background(if (sel) C.Gold else C.Paper).border(2.dp, C.Ink, RoundedCornerShape(10.dp))
                .clickable(enabled = enabled && !out, onClickLabel = "pick") { session.send(Cmd.pickShell(shot.id)); session.sfx.play("pick", gain = 0.6f) }
                .semantics { contentDescription = "${shot.name}$uses$cogs${if (shot.best) ", best with this Hob" else ""}"; this.selected = sel }, contentAlignment = Alignment.Center) {
                val cls = hud.hobs.getOrElse(hud.activeSide) { emptyList() }.firstOrNull { it.id == hud.selectedHob }?.cls ?: ""
                val icon = when (shot.kind) { "plain" -> "icon_${Sprites.plainShell(cls)}"; "knack" -> ""; else -> "icon_${shot.id}" }
                if (icon.isEmpty() || !SpriteImage(session.sprites, icon, Modifier.fillMaxSize().padding(bottom = 12.dp, top = 2.dp))) Label(shot.name, Modifier.padding(2.dp), size = 11, bold = true, align = TextAlign.Center, maxLines = 2)
                else Label(shot.name, Modifier.align(Alignment.BottomCenter).padding(horizontal = 2.dp), size = 9, bold = true, align = TextAlign.Center, maxLines = 1)
                if (shot.uses >= 0) Label("${shot.uses}", Modifier.align(Alignment.TopEnd).padding(end = 3.dp).clip(CircleShape).background(C.Ink).padding(horizontal = 4.dp), size = 9, bold = true, color = Color.White)
                if (shot.weight > 0) Label("⚙".repeat(shot.weight), Modifier.align(Alignment.BottomStart).padding(start = 3.dp), size = 9)
                if (shot.best) Box(Modifier.align(Alignment.TopStart).padding(3.dp).size(7.dp).clip(CircleShape).background(C.Good))
            }
        }
    }
}

@Composable
private fun CrewRow(session: GameSession, hud: Hud, side: Int, enabled: Boolean, vertical: Boolean) {
    val hobs = hud.hobs.getOrElse(side) { emptyList() }
    val items: @Composable () -> Unit = {
        for (h in hobs) {
            val sel = h.id == hud.selectedHob
            val frac = if (h.hpMax > 0) h.hp.toFloat() / h.hpMax else 0f
            val state = if (h.bonked) "Bonked" else if (h.rest > 0) "needs a rest" else "${h.hp} of ${h.hpMax} HP"
            Box(Modifier.size(48.dp).alpha(if (h.bonked) 0.45f else 1f).clip(CircleShape).background(if (sel) C.GoldLight else C.Cream)
                .clickable(enabled = enabled && !h.bonked) { session.send(Cmd.pickHob(h.id)); session.sfx.play("pick", gain = 0.6f) }
                .semantics { contentDescription = "${h.name}, ${h.cls}, $state"; this.selected = sel }, contentAlignment = Alignment.Center) {
                val ring = C.side(side)
                Canvas(Modifier.fillMaxSize()) {
                    val w = 3.5.dp.toPx()
                    drawArc(C.Locked, 0f, 360f, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w))
                    drawArc(if (sel) C.Gold else ring, -90f, 360f * frac, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w, cap = StrokeCap.Round))
                }
                if (!SpriteImage(session.sprites, "portrait_${Sprites.hobKey(h.id, h.name)}_${if (side == 0) "blue" else "orange"}", Modifier.fillMaxSize().padding(4.dp))) {
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
private fun Readout(hud: Hud, onTap: () -> Unit, nudge: (Int, Int) -> Unit) {
    val text = if (hud.aimSet) "%.1f° | %d".format(hud.aimAngle / 10f, hud.aimPower) else "--° | --"
    val d = LocalDensity.current
    // Tap opens Fine Tune. A drag that starts here is the Slow Drag: 5 pt per power point (up and down),
    // 5 pt per half degree (left and right).
    Box(Modifier.size(120.dp, 48.dp).clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape)
        .clickable(onClickLabel = "open Fine Tune", onClick = onTap)
        .pointerInput(Unit) {
            var ax = 0f; var ay = 0f
            val stepPx = with(d) { 5.dp.toPx() }
            detectDragGestures(onDragStart = { ax = 0f; ay = 0f }) { change, drag ->
                change.consume(); ax += drag.x; ay += drag.y
                val da = (ax / stepPx).toInt(); val dpw = (-ay / stepPx).toInt()
                if (da != 0 || dpw != 0) { ax -= da * stepPx; ay += dpw * stepPx; nudge(-da * 5, dpw) }
            }
        }
        .semantics { contentDescription = if (hud.aimSet) "Aim ${hud.aimAngle / 10f} degrees, power ${hud.aimPower}" else "No aim yet" }, contentAlignment = Alignment.Center) {
        Label(text, size = 18, bold = true)
    }
}

@Composable
private fun FineTunePad(hud: Hud, tapOnly: Boolean, nudge: (Int, Int) -> Unit, recall: () -> Unit) {
    // Always laid out left to right, whatever the hand setting: minus on the left, plus on the right.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Row(Modifier.clip(PlateShape).background(C.Paper).border(2.dp, C.Ink, PlateShape).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column { Key("ang −", "Angle down a tenth", hud.aimAngle > 0, tapOnly) { nudge(-1, 0) }; Key("pow −", "Power down one", hud.aimPower > 0, tapOnly) { nudge(0, -1) } }
            Column(Modifier.width(64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Label("%.1f°".format(hud.aimAngle / 10f), size = 16, bold = true)
                Label("${hud.aimPower}", size = 16, bold = true)
                Label("R", Modifier.padding(top = 2.dp).size(48.dp, 28.dp).clip(RoundedCornerShape(8.dp)).background(C.Cream).border(1.5.dp, C.Ink, RoundedCornerShape(8.dp)).clickable(onClickLabel = "Recall the last aim", onClick = recall).padding(top = 4.dp), size = 13, bold = true, align = TextAlign.Center)
            }
            Column { Key("ang +", "Angle up a tenth", hud.aimAngle < 1800, tapOnly) { nudge(1, 0) }; Key("pow +", "Power up one", hud.aimPower < 100, tapOnly) { nudge(0, 1) } }
        }
    }
}

@Composable
private fun Key(text: String, desc: String, enabled: Boolean, tapOnly: Boolean, onStep: () -> Unit) {
    Box(Modifier.padding(2.dp).size(48.dp).alpha(if (enabled) 1f else 0.4f).clip(RoundedCornerShape(10.dp)).background(C.Cream).border(2.dp, C.Ink, RoundedCornerShape(10.dp)).tapOrHold(enabled, tapOnly, desc, onStep), contentAlignment = Alignment.Center) {
        Label(text, size = 12, bold = true)
    }
}

@Composable
private fun FireButton(hud: Hud, fire: () -> Unit) {
    val ready = hud.humanTurn && hud.canFire && !hud.dugIn
    val label = if (hud.dugIn) "Fire, dug in, the Loophole is buried" else if (ready) "Fire" else "Fire, locked, set an aim first"
    Box(Modifier.size(76.dp).clip(CircleShape).background(if (ready) C.Gold else C.Locked).border(3.dp, C.Ink, CircleShape).onReleaseInside(ready, label, fire), contentAlignment = Alignment.Center) {
        Label(if (hud.dugIn) "DUG IN" else "FIRE", size = if (hud.dugIn) 12 else 18, bold = true)
    }
}

// ---- cards -------------------------------------------------------------------

/** Hand-off card (Couch Duel): Ready is the only control and ignores input for its first 400 ms. */
@Composable
private fun HandoffCard(session: GameSession, hud: Hud) {
    val to = hud.handoff?.toSide ?: hud.activeSide
    val name = hud.names.getOrElse(to) { "Player ${to + 1}" }
    var armed by remember(hud.turnSeq) { mutableStateOf(false) }
    LaunchedEffect(hud.turnSeq) { armed = false; delay(400); armed = true }
    Box(Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f)).pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }, contentAlignment = Alignment.Center) {
        Column(Modifier.padding(20.dp).widthIn(max = 380.dp).clip(RoundedCornerShape(20.dp)).background(C.Paper).border(8.dp, C.side(to), RoundedCornerShape(20.dp)).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Label(hud.handoff?.line ?: "", size = 14, color = C.InkSoft, align = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Label(if (to == 0) "●  ●  ●" else "◆  ◆  ◆", size = 20, color = C.side(to))
            Label("Pass the device to", size = 16)
            Label(name.uppercase(), Modifier.semantics { heading() }, size = 32, bold = true, color = C.side(to), align = TextAlign.Center)
            Spacer(Modifier.height(6.dp))
            Label("Kettle ${hud.kettlePct.getOrElse(to) { 0 }}%    Round ${hud.round}/${hud.roundCap}", size = 14)
            Spacer(Modifier.height(16.dp))
            CastleButton("READY", { if (armed) session.send(Cmd.READY) }, Modifier.size(width = 200.dp, height = 72.dp), size = 22, description = "Pass the device to $name. Ready")
        }
    }
}

@Composable
private fun PauseCard(session: GameSession) {
    var settings by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(C.Ink.copy(alpha = 0.6f)).pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }, contentAlignment = Alignment.Center) {
        Plate(Modifier.padding(16.dp).widthIn(max = 520.dp), pad = 16.dp) {
            if (settings) {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) { SettingsBody(session) }
                CastleButton("Done", { settings = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
            } else {
                Label("Paused", Modifier.fillMaxWidth().semantics { heading() }, size = 24, bold = true, align = TextAlign.Center)
                Label("The battle is saved at the start of every turn.", Modifier.fillMaxWidth().padding(vertical = 6.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
                CastleButton("Resume", { session.paused = false }, Modifier.fillMaxWidth().padding(top = 8.dp))
                CastleButton("Settings", { settings = true }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                CastleButton("Save and leave", { session.saveNow(); session.paused = false; session.leaveBattle() }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
                CastleButton("Give up", { session.quitBattle() }, Modifier.fillMaxWidth().padding(top = 8.dp), color = C.Cream)
            }
        }
    }
}

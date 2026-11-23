package games.castleprotect.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Cmd
import games.castleprotect.core.JsonText
import games.castleprotect.core.Phase
import games.castleprotect.core.SideOpts
import games.castleprotect.core.Text
import games.castleprotect.core.Names
import games.castleprotect.game.BrokeText
import games.castleprotect.game.GameSession
import games.castleprotect.game.HudText
import games.castleprotect.game.PhoneLayout
import games.castleprotect.game.ResultText
import games.castleprotect.game.Screen
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

@Composable
private fun Page(title: String, session: GameSession, back: Boolean = true, trailing: (@Composable () -> Unit)? = null, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().background(C.Parchment).safeDrawingPadding()) {
        Row(
            Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.SepiaBorder).padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (back) CastleButton("‹", { session.goBack() }, Modifier.size(48.dp), color = C.Cream, description = Text.t("common.back"), size = 22, pad = PaddingValues(0.dp))
            Label(title, Modifier.weight(1f).padding(horizontal = 10.dp).semantics { heading() }, size = 20, bold = true, color = C.Ink, maxLines = 1)
            trailing?.invoke()
        }
        Box(Modifier.weight(1f).fillMaxWidth()) { content() }
    }
}

// ---- Title ---------------------------------------------------------------------

@Composable
fun TitleScreen(session: GameSession) {
    Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
        // Painted Puddingstone Downs storybook rolling hills backdrop
        PuddingstoneHillsBackdrop(Modifier.fillMaxSize())
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp).widthIn(max = 380.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            // The logo: the title's two words stacked, read out once as the title.
            val title = Text.t("app.title")
            val words = title.split(' ', limit = 2)
            Label(words.first().uppercase(), Modifier.semantics { contentDescription = title; heading() }, size = 52, bold = true, color = C.Ink)
            if (words.size > 1) Label(words[1].uppercase(), Modifier.clearAndSetSemantics { }, size = 40, bold = true, color = C.BlueInk)
            Label(
                Text.t("app.tagline"),
                Modifier.padding(top = 4.dp, bottom = 22.dp)
                    .clip(PillShape).background(C.HudTier3Bg).border(1.dp, C.SepiaBorder, PillShape)
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                size = 14, bold = true, color = C.Ink, align = TextAlign.Center,
            )
            session.notice?.let { n ->
                Plate(Modifier.fillMaxWidth().padding(bottom = 12.dp).semantics { liveRegion = LiveRegionMode.Polite }, color = C.Cream) {
                    Label(n, size = 13)
                    CastleButton(Text.t("common.close"), { session.notice = null }, Modifier.padding(top = 6.dp), color = C.Paper, size = 13)
                }
            }
            if (session.coreMissing) {
                Label(
                    Text.t("errors.not_installed"),
                    Modifier.padding(bottom = 12.dp).clip(PlateShape).background(C.BadBg).border(1.5.dp, C.BadBorder, PlateShape).padding(10.dp),
                    size = 14, bold = true, color = C.BadInk, align = TextAlign.Center,
                )
            }
            if (session.canResume) {
                CastleButton(if (session.loading) Text.t("common.loading") else Text.t("home.carry_on.yes"), { if (!session.loading) session.resume() }, Modifier.fillMaxWidth().height(60.dp), size = 20, description = Text.t("home.carry_on.hint"))
                Spacer(Modifier.height(10.dp))
            }
            CastleButton(
                Text.t("home.play"),
                {
                    session.firstTap()
                    if (session.storeLoaded && !session.settings.seenIntro && !session.canResume) {
                        session.settings.seenIntro = true; session.go(Screen.MAP); session.openLevel("1-1"); session.fight()
                    } else session.go(Screen.MAP)
                },
                Modifier.fillMaxWidth().height(60.dp), size = 20, color = if (session.canResume) C.Cream else C.Gold,
            )
            Spacer(Modifier.height(10.dp))
            CastleButton(Text.t("modes.duel.button"), { session.go(Screen.DUEL_SETUP) }, Modifier.fillMaxWidth(), color = C.Cream, description = Text.t("modes.duel.name") + ". " + Text.t("modes.duel.line"))
            Spacer(Modifier.height(10.dp))
            CastleButton(Text.t("modes.skirmish.name"), { session.go(Screen.SKIRMISH) }, Modifier.fillMaxWidth(), color = C.Cream)
            Spacer(Modifier.height(10.dp))
            CastleButton(Text.t("common.settings"), { session.go(Screen.SETTINGS) }, Modifier.fillMaxWidth(), color = C.Cream)
            Label(
                Text.t("app.promise_long"),
                Modifier.padding(top = 18.dp).clip(PillShape).background(C.HudTier3Bg).padding(horizontal = 10.dp, vertical = 3.dp),
                size = 12, bold = true, color = C.Ink,
            )
        }
    }
}

// ---- Storybook Campaign Map (Part 2 Plate 5) ----------------------------------

/** Layered painted Puddingstone Downs rolling hills backdrop for Map & Title. */
@Composable
private fun PuddingstoneHillsBackdrop(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        // Sunlit morning sky gradient
        drawRect(Brush.verticalGradient(listOf(Color(0xFF8FCDE8), Color(0xFFD6EEF2), Color(0xFFF3F6E8))))
        // Soft sunlit storybook clouds
        val cloudCol = Color(0xCCFFFDF6)
        drawCircle(cloudCol, w * 0.08f, Offset(w * 0.18f, h * 0.14f))
        drawCircle(cloudCol, w * 0.06f, Offset(w * 0.24f, h * 0.15f))
        drawCircle(cloudCol, w * 0.07f, Offset(w * 0.76f, h * 0.12f))
        drawCircle(cloudCol, w * 0.055f, Offset(w * 0.82f, h * 0.135f))

        // Far hazy blue-sage Puddingstone ridge (atmospheric depth)
        val far = Path().apply {
            moveTo(0f, h)
            lineTo(0f, h * 0.44f)
            cubicTo(w * 0.25f, h * 0.30f, w * 0.45f, h * 0.48f, w * 0.68f, h * 0.36f)
            cubicTo(w * 0.84f, h * 0.28f, w * 0.94f, h * 0.38f, w, h * 0.35f)
            lineTo(w, h)
            close()
        }
        drawPath(far, Color(0xFF9AC5B7))

        // Midground lush meadow hills
        val mid = Path().apply {
            moveTo(0f, h)
            lineTo(0f, h * 0.56f)
            cubicTo(w * 0.22f, h * 0.46f, w * 0.38f, h * 0.62f, w * 0.62f, h * 0.50f)
            cubicTo(w * 0.82f, h * 0.42f, w * 0.92f, h * 0.54f, w, h * 0.48f)
            lineTo(w, h)
            close()
        }
        drawPath(mid, Color(0xFF74B665))

        // Foreground vibrant Puddingstone Downs slopes + sunlit highlight rim
        val fore = Path().apply {
            moveTo(0f, h)
            lineTo(0f, h * 0.72f)
            cubicTo(w * 0.28f, h * 0.62f, w * 0.54f, h * 0.78f, w * 0.78f, h * 0.66f)
            cubicTo(w * 0.90f, h * 0.61f, w * 0.96f, h * 0.67f, w, h * 0.64f)
            lineTo(w, h)
            close()
        }
        drawPath(fore, Color(0xFF5CA14E))
        // Subtle sunlit hilltop warmth
        drawCircle(Color(0x28FFE699), w * 0.26f, Offset(w * 0.26f, h * 0.68f))
        drawCircle(Color(0x22FFE699), w * 0.24f, Offset(w * 0.78f, h * 0.68f))
    }
}

/** Sculpted clipped-hedge Topiary Peacock landmark badge for Boss 1-10 on the Campaign Map. */
@Composable
private fun TopiaryPeacockMapBadge(modifier: Modifier = Modifier) {
    Canvas(modifier.size(width = 64.dp, height = 34.dp)) {
        val w = size.width; val h = size.height
        val cx = w * 0.5f; val baseY = h * 0.92f
        val sw = 1.6.dp.toPx()
        // Fanned clipped-hedge peacock tail (5 emerald plumes with brass eye-spots)
        for (i in 0..4) {
            val deg = -56.0 + i * 28.0
            val rad = (deg - 90.0) * PI / 180.0
            val px = cx + (cos(rad) * h * 0.62f).toFloat()
            val py = baseY + (sin(rad) * h * 0.62f).toFloat()
            drawCircle(if (i % 2 == 0) Color(0xFF265C36) else Color(0xFF3A7D44), 7.5.dp.toPx(), Offset(px, py))
            drawCircle(C.Ink, 7.5.dp.toPx(), Offset(px, py), style = Stroke(sw))
            drawCircle(C.BrassMid, 2.6.dp.toPx(), Offset(px, py - 1.dp.toPx()))
            drawCircle(C.Blue, 1.3.dp.toPx(), Offset(px, py - 1.dp.toPx()))
        }
        // Hedge crown body + head
        drawCircle(Color(0xFF4E984F), 8.dp.toPx(), Offset(cx, baseY - 4.dp.toPx()))
        drawCircle(C.Ink, 8.dp.toPx(), Offset(cx, baseY - 4.dp.toPx()), style = Stroke(sw))
        drawCircle(Color(0xFF5FA652), 4.5.dp.toPx(), Offset(cx - 5.dp.toPx(), baseY - 12.dp.toPx()))
        drawCircle(C.Ink, 4.5.dp.toPx(), Offset(cx - 5.dp.toPx(), baseY - 12.dp.toPx()), style = Stroke(sw * 0.9f))
        // Tiny golden beak
        val beak = Path().apply {
            moveTo(cx - 9.dp.toPx(), baseY - 12.dp.toPx())
            lineTo(cx - 14.dp.toPx(), baseY - 10.5.dp.toPx())
            lineTo(cx - 9.dp.toPx(), baseY - 9.dp.toPx())
            close()
        }
        drawPath(beak, C.BrassMid)
        drawPath(beak, C.Ink, style = Stroke(sw * 0.7f, join = StrokeJoin.Round))
    }
}

@Composable
fun MapScreen(session: GameSession) {
    val levels = session.content.campaign
    val prog = session.progress
    val firstOpen = levels.indexOfFirst { (prog[it.id] ?: 0) and 1 == 0 }
    val pennants = levels.sumOf { Integer.bitCount(prog[it.id] ?: 0) }
    val pennantsMax = levels.sumOf { it.pennants.size.coerceAtLeast(3) }
    val done = levels.count { (prog[it.id] ?: 0) and 1 != 0 }
    val nextPlayLevel = levels.getOrNull(if (firstOpen >= 0) firstOpen else (levels.size - 1).coerceAtLeast(0))

    Page(
        Text.t("map.regions.downs.name") + "  " + Text.t("map.cleared", "done" to done, "total" to levels.size),
        session,
        trailing = {
            HudTier3Pill(Modifier.padding(end = 6.dp).semantics { contentDescription = Text.t("map.pennants_count", "n" to pennants, "total" to pennantsMax) }) {
                PennantFlagIcon(earned = true, modifier = Modifier.size(16.dp))
                Label("$pennants/$pennantsMax", size = 13, bold = true, color = C.Ink)
            }
            Box(
                Modifier.size(48.dp).clip(PlateShape).background(C.Cream).border(1.5.dp, C.Ink, PlateShape)
                    .clickable(onClickLabel = Text.t("common.settings")) { session.go(Screen.SETTINGS) }
                    .semantics { contentDescription = Text.t("common.settings") },
                contentAlignment = Alignment.Center,
            ) { GearSettingsIcon() }
        },
    ) {
        Column(Modifier.fillMaxSize()) {
            // Scrollable storybook hillside map (occupies weight(1f) strictly ABOVE the bottom dock -> zero overlap on node 1-10!)
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val tall = maxWidth < maxHeight
                val viewW = maxWidth
                val viewH = maxHeight
                PuddingstoneHillsBackdrop(Modifier.fillMaxSize())

                val n = levels.size.coerceAtLeast(1)
                if (tall) {
                    val stepY = 132.dp
                    val topPad = 76.dp
                    val totalH = maxOf(viewH, topPad + stepY * n + 72.dp)
                    val wobbleAmp = minOf(72f, maxWidth.value * 0.22f).dp
                    Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        Box(Modifier.fillMaxWidth().height(totalH)) {
                            // Winding cobbled path connecting node 1 -> node 10
                            Canvas(Modifier.fillMaxSize()) {
                                val pts = List(n) { i ->
                                    val wOff = if (i % 2 == 0) -wobbleAmp.toPx() else wobbleAmp.toPx()
                                    Offset(size.width * 0.5f + wOff, (topPad + stepY * i).toPx())
                                }
                                drawCobbledPath(pts)
                            }
                            levels.forEachIndexed { i, lv ->
                                val wOff = if (i % 2 == 0) -wobbleAmp else wobbleAmp
                                val cy = topPad + stepY * i
                                val grand = lv.type == "grand_fort" || i == levels.size - 1
                                MapNodeItem(
                                    lv = lv, index = i, total = levels.size,
                                    bits = prog[lv.id] ?: 0, firstOpen = firstOpen,
                                    enabled = !session.coreMissing,
                                    onOpen = { session.openLevel(lv.id) },
                                    modifier = Modifier.align(Alignment.TopCenter).offset(x = wOff, y = cy - if (grand) 70.dp else 30.dp),
                                )
                            }
                        }
                    }
                } else {
                    val stepX = 148.dp
                    val leftPad = 88.dp
                    val totalW = maxOf(viewW, leftPad + stepX * n + 72.dp)
                    val wobbleAmp = minOf(48f, maxHeight.value * 0.16f).dp
                    Box(Modifier.fillMaxSize().horizontalScroll(rememberScrollState())) {
                        Box(Modifier.width(totalW).height(viewH)) {
                            // Winding cobbled path connecting node 1 -> node 10 horizontally
                            Canvas(Modifier.fillMaxSize()) {
                                val pts = List(n) { i ->
                                    val wOff = if (i % 2 == 0) -wobbleAmp.toPx() else wobbleAmp.toPx()
                                    Offset((leftPad + stepX * i).toPx(), size.height * 0.5f + wOff)
                                }
                                drawCobbledPath(pts)
                            }
                            levels.forEachIndexed { i, lv ->
                                val wOff = if (i % 2 == 0) -wobbleAmp else wobbleAmp
                                val cx = leftPad + stepX * i
                                MapNodeItem(
                                    lv = lv, index = i, total = levels.size,
                                    bits = prog[lv.id] ?: 0, firstOpen = firstOpen,
                                    enabled = !session.coreMissing,
                                    onOpen = { session.openLevel(lv.id) },
                                    modifier = Modifier.align(Alignment.CenterStart).offset(x = cx - 60.dp, y = wOff + 10.dp),
                                )
                            }
                        }
                    }
                }
            }

            // Dedicated stitched bottom navigation dock (Play | Workshop | 2 Players | Modes | Daily) — zero map collision!
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(C.HudTier2Bg)
                    .drawBehind {
                        drawLine(C.SepiaBorder, Offset(0f, 0f), Offset(size.width, 0f), 2.dp.toPx())
                        drawLine(
                            C.SepiaBorder.copy(alpha = 0.45f),
                            Offset(8.dp.toPx(), 4.dp.toPx()),
                            Offset(size.width - 8.dp.toPx(), 4.dp.toPx()),
                            1.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())),
                        )
                    }
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (session.canResume) {
                    CastleButton(Text.t("home.carry_on.yes"), { if (!session.loading) session.resume() }, color = C.Gold, size = 14, description = Text.t("home.carry_on.hint"))
                } else if (nextPlayLevel != null) {
                    CastleButton(
                        Text.t("home.play_next", "id" to nextPlayLevel.id),
                        { session.openLevel(nextPlayLevel.id) },
                        color = C.Gold, enabled = !session.loading && !session.coreMissing, size = 14,
                        description = Text.t("home.play_next_hint", "id" to nextPlayLevel.id, "name" to nextPlayLevel.name),
                    )
                }
                if (session.sideModesOpen) {
                    CastleButton(Text.t("modes.workshop.name"), { session.go(Screen.WORKSHOP) }, color = C.Cream, size = 14, description = Text.t("modes.workshop.name") + ". " + Text.t("modes.workshop.line"))
                }
                CastleButton(
                    Text.t("modes.duel.button"),
                    { session.go(Screen.DUEL_SETUP) },
                    color = C.Cream, size = 14,
                    description = Text.t("modes.duel.name") + ". " + Text.t("modes.duel.line"),
                )
                CastleButton(Text.t("modes.skirmish.name"), { session.go(Screen.SKIRMISH) }, color = C.Cream, size = 14, description = Text.t("modes.skirmish.name") + ". " + Text.t("modes.skirmish.line"))
                if (session.sideModesOpen) {
                    CastleButton(
                        Text.t("modes.yard.name"),
                        { session.startTestYard(session.fort.ifEmpty { null }) },
                        color = C.Cream, size = 14,
                        enabled = !session.loading && !session.coreMissing,
                        description = Text.t("modes.yard.name") + ". " + Text.t("modes.yard.line"),
                    )
                }
                CastleButton(
                    if (session.dailyDone) Text.t("modes.daily.done") else Text.t("modes.daily.short"),
                    { session.openDaily() },
                    color = if (session.dailyDone) C.GoodSoft else C.Cream,
                    enabled = !session.loading && !session.coreMissing,
                    size = 14,
                    description = if (session.dailyDone) Text.t("modes.daily.done_hint") else Text.t("modes.daily.name") + ". " + Text.t("modes.daily.line"),
                )
            }
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawCobbledPath(pts: List<Offset>) {
    if (pts.size < 2) return
    val p = Path().apply {
        moveTo(pts[0].x, pts[0].y)
        for (i in 0 until pts.size - 1) {
            val a = pts[i]; val b = pts[i + 1]
            val mx = (a.x + b.x) * 0.5f; val my = (a.y + b.y) * 0.5f
            cubicTo(mx, a.y, mx, b.y, b.x, b.y)
        }
    }
    // Espresso road edge
    drawPath(p, C.InkSoft.copy(alpha = 0.72f), style = Stroke(width = 16.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    // Warm sandstone cobble bed
    drawPath(p, Color(0xFFE3C89D), style = Stroke(width = 11.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    // Cobblestone stipple center dashes
    drawPath(
        p,
        Color(0xFFC4A06C),
        style = Stroke(
            width = 3.dp.toPx(),
            cap = StrokeCap.Round,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 10.dp.toPx())),
        ),
    )
}

@Composable
private fun MapNodeItem(
    lv: games.castleprotect.core.LevelInfo,
    index: Int,
    total: Int,
    bits: Int,
    firstOpen: Int,
    enabled: Boolean,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state = if (bits and 1 != 0) "done" else if (index == firstOpen) "next" else if (firstOpen >= 0 && index > firstOpen) "locked" else "open"
    val got = Integer.bitCount(bits)
    val locked = state == "locked"
    val grand = lv.type == "grand_fort" || index == total - 1
    val nodeWords = when (state) {
        "done" -> Text.t("map.node_done", "id" to lv.id, "name" to lv.name, "n" to got)
        "locked" -> Text.t("map.node_locked", "id" to lv.id, "name" to lv.name)
        else -> Text.t("map.node", "id" to lv.id, "name" to lv.name)
    }
    val grandWord = Text.t("map.grand_fort").replace(' ', '\n')
    val nodeShape = if (grand) RoundedCornerShape(14.dp) else CircleShape

    Column(
        modifier
            .widthIn(min = 116.dp, max = 132.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(enabled = !locked && enabled, onClick = onOpen)
            .semantics(mergeDescendants = true) { contentDescription = nodeWords }
            .padding(2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Boss 1-10 sculpted Topiary Peacock landmark crest above node 10
        if (grand) {
            TopiaryPeacockMapBadge(Modifier.padding(bottom = 2.dp))
        }
        val numColor = when (state) {
            "done" -> Color.White
            "locked" -> C.DisabledInk
            else -> C.Ink
        }
        if (state == "next") {
            HudTier1Medallion(modifier = Modifier.size(if (grand) 72.dp else 58.dp), shape = nodeShape) {
                Label(if (grand) grandWord else lv.id.substringAfter('-'), size = if (grand) 12 else 20, bold = true, color = C.Ink, align = TextAlign.Center)
            }
        } else {
            Box(
                Modifier.size(if (grand) 70.dp else 56.dp).clip(nodeShape)
                    .background(
                        when (state) {
                            "done" -> C.GoodBg // 6.1:1 AA+ green with crisp white numeral
                            "locked" -> C.DisabledBg
                            else -> C.Paper
                        },
                    )
                    .border(if (grand) 2.5.dp else 2.dp, if (locked) C.SepiaBorder else C.Ink, nodeShape),
                contentAlignment = Alignment.Center,
            ) {
                Label(if (grand) grandWord else lv.id.substringAfter('-'), size = if (grand) 12 else 20, bold = true, color = numColor, align = TextAlign.Center)
            }
        }
        // Golden vector pennant milestones (3 per node, zero Unicode!)
        Row(Modifier.padding(top = 3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
            for (pIdx in 0 until 3) {
                PennantFlagIcon(earned = (bits and (1 shl pIdx)) != 0, modifier = Modifier.size(15.dp))
            }
        }
        // High-contrast dark-espresso (#2C221E) on warm parchment ribbon (13.4:1 AAA — never white-on-cream!)
        Label(
            lv.name,
            Modifier.padding(top = 2.dp).widthIn(max = 124.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (locked) C.DisabledBg else C.Paper)
                .border(1.2.dp, if (locked) C.SepiaBorder else C.Ink, RoundedCornerShape(8.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
            size = 12,
            bold = true,
            color = if (locked) C.DisabledInk else C.Ink,
            align = TextAlign.Center,
            maxLines = 2,
        )
    }
}

// ---- Pre-battle, with the optional Rummage --------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PreBattleScreen(session: GameSession) {
    val u by session.ui.collectAsState()
    val spec = session.preSpec
    val info = spec?.let { session.levelInfo(it.level) }
    val content = session.content
    var focus by remember { mutableStateOf<String?>(null) }
    val title = when (spec?.kind) {
        "campaign" -> "${info?.id ?: ""}  ${info?.name ?: ""}"
        "daily" -> Text.t("modes.daily.name")
        "couch" -> Text.t("setup.duel_title")
        "test_yard" -> Text.t("modes.yard.name")
        else -> Text.t("setup.skirmish_title")
    }
    // The Rival before the fight: the level's own, or roster[seed % size] on a Skirmish map; the core's name once a draft is live.
    val rivalName = (if (u.live && !u.hud.human(1)) u.hud.names.getOrNull(1) else null)
        ?: spec?.let { sp -> info?.rivalFor(sp.seed)?.name } ?: ""
    val rivalShort = Names.rivalShort(info?.id, rivalName)
    val draft = u.draft.takeIf { u.live && u.phase == Phase.DRAFT }
    val draftDone = session.draftedOnPreBattle && u.live && u.phase == Phase.PLAN
    val rummageStarted = draft != null || draftDone
    val plainOnly = spec?.setup?.contains("\"pool\":0") == true
    Page(title, session) {
        Column(Modifier.fillMaxSize()) {
            FlowRow(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (info != null) Plate(Modifier.widthIn(min = 280.dp).weight(1f)) {
                    val typeWord = Text.opt("map.types.${info.type}") ?: ""
                    val roundsWord = if (spec?.kind == "campaign") Text.t("level_card.rounds_squall", "n" to info.roundCap) else ""
                    Label(listOf(typeWord, roundsWord, info.windText).filter { it.isNotEmpty() }.joinToString(". "), size = 13, color = C.InkSoft)
                    if (spec?.kind == "campaign") NoticeOfFlattening(info.id)
                    if (spec != null && spec.kind != "couch" && spec.kind != "test_yard" && rivalName.isNotEmpty()) {
                        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(20.dp).clip(RoundedCornerShape(3.dp)).background(C.Orange).border(2.dp, C.Ink, RoundedCornerShape(3.dp)))
                            Label("  $rivalName", Modifier.semantics { contentDescription = Text.t("setup.rival") + ": " + rivalName }, size = 17, bold = true, color = C.Ink)
                            if (spec.kind == "campaign") Label("   " + Text.t("level_card.their_aim", "n" to info.rivalAim), size = 13, color = C.InkSoft)
                        }
                        if (info.habit.isNotEmpty()) Label("“${info.habit}”", Modifier.padding(top = 4.dp).clip(RoundedCornerShape(8.dp)).background(C.Cream).border(1.dp, C.SepiaBorder, RoundedCornerShape(8.dp)).padding(6.dp), size = 13, color = C.Ink)
                        Label(Text.t("level_card.their_crew") + ": " + info.rivalCrew.joinToString(", ") { content.hobName(it) }, Modifier.padding(top = 6.dp), size = 13)
                    }
                    if (spec?.kind == "campaign") {
                        if (info.goals.isNotEmpty()) {
                            val bits = session.progress[info.id] ?: 0
                            Label(Text.t("level_card.goals"), Modifier.padding(top = 8.dp).semantics { heading() }, size = 13, bold = true)
                            info.goals.forEachIndexed { i, p ->
                                val g = Names.goal(info.id, p, rivalName)
                                val ok = bits and (1 shl i) != 0
                                Row(Modifier.padding(top = 2.dp).semantics(mergeDescendants = true) { contentDescription = Text.t(if (ok) "pennants.got" else "pennants.not_got", "goal" to g) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    PennantFlagIcon(earned = ok, modifier = Modifier.size(14.dp))
                                    Label(g, size = 13, color = C.Ink)
                                }
                            }
                        }
                        if (!rummageStarted && info.playerCrew.size > info.defaultSeats) {
                            val seats = info.defaultSeats
                            val picked = session.preCrew.ifEmpty { info.playerCrew.take(seats) }
                            Label(Text.t("level_card.your_crew") + ". " + Text.t("level_card.pick_up_to", "n" to seats), Modifier.padding(top = 8.dp).semantics { heading() }, size = 13, bold = true)
                            FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                for (hid in info.playerCrew) {
                                    val on = hid in picked
                                    CastleButton(
                                        content.hobShort(hid),
                                        {
                                            val next = when {
                                                on && picked.size > 1 -> picked - hid
                                                !on && picked.size < seats -> picked + hid
                                                !on -> picked.drop(1) + hid
                                                else -> picked
                                            }
                                            session.updatePreCrew(info.id, next)
                                        },
                                        color = if (on) C.Gold else C.Cream,
                                        selected = on,
                                        size = 13,
                                        description = content.hobName(hid),
                                        pad = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                    )
                                }
                            }
                        }
                        if (!rummageStarted) Choice(Text.t("setup.help.label"), HELP_WORDS(), session.settings.help) {
                            session.settings.help = it
                            session.openSpecQuiet(session.campaignSpec(info.id, crew = session.preCrew.ifEmpty { null }))
                        }
                    }
                    if (session.preUsingCustomFort) {
                        Label(Text.t("level_card.fort_yours"), Modifier.padding(top = 6.dp), size = 12, bold = true, color = C.BlueInk)
                    } else session.preFortNote?.let { note ->
                        Label(note, Modifier.padding(top = 6.dp).clip(RoundedCornerShape(8.dp)).background(C.BadBg).border(1.dp, C.BadBorder, RoundedCornerShape(8.dp)).padding(6.dp), size = 12, bold = true, color = C.BadInk)
                    }
                }
                // Rummage draft with illustrated chips & rich focused shell preview
                if ((!plainOnly && info?.rummage == true) || rummageStarted) Plate(Modifier.fillMaxWidth()) {
                    if (!rummageStarted) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Label(Text.t("rummage.title"), Modifier.semantics { heading() }, size = 15, bold = true)
                            Label("   " + Text.t("rummage.quick_ready"), Modifier.weight(1f), size = 13, color = C.InkSoft)
                            CastleButton(Text.t("rummage.open"), { session.openRummage() }, color = C.Cream, size = 13, enabled = !session.loading && !session.coreMissing, description = Text.t("rummage.open") + ". " + Text.t("rummage.open_hint"))
                        }
                    } else if (draftDone) {
                        val both = u.hud.human(0) && u.hud.human(1)
                        val mine = u.hud.hands.getOrElse(0) { emptyList() }.map { content.shotName(it.id) }
                        val theirs = u.hud.hands.getOrElse(1) { emptyList() }.map { content.shotName(it.id) }
                        Label(Text.t("rummage.title") + ". " + Text.t("rummage.all_picked"), Modifier.semantics { heading() }, size = 15, bold = true)
                        Label("${if (both) u.hud.names.getOrElse(0) { "" } else Text.t("rummage.yours")}: ${mine.joinToString(", ").ifEmpty { Text.t("common.nobody") }}", Modifier.padding(top = 4.dp), size = 13, color = C.BlueInk, bold = true)
                        Label("${if (both) u.hud.names.getOrElse(1) { "" } else Text.t("rummage.theirs")}: ${theirs.joinToString(", ").ifEmpty { Text.t("common.nobody") }}", size = 13, color = C.OrangeInk, bold = true)
                    } else if (draft != null) {
                        val both = u.hud.human(0) && u.hud.human(1)
                        val who = if (both) u.hud.names.getOrElse(draft.next) { "" } else Text.t("common.you")
                        val mine = draft.picks.getOrElse(0) { emptyList() }; val theirs = draft.picks.getOrElse(1) { emptyList() }
                        val full = mine.size >= draft.picksEach && theirs.size >= draft.picksEach
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Label(Text.t("rummage.title"), Modifier.semantics { heading() }, size = 15, bold = true)
                            Label("   " + if (full) Text.t("rummage.all_picked") else Text.t("rummage.to_pick", "name" to who, "n" to draft.picksEach), Modifier.weight(1f), size = 13, color = C.InkSoft)
                            CastleButton(Text.t("rummage.quick_pick"), { session.send(Cmd.QUICK_PICK) }, color = C.Cream, size = 13, enabled = !full)
                        }
                        Row(Modifier.padding(top = 6.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            for (id in draft.pool) {
                                val name = content.shotName(id)
                                val wish = draft.wish == id
                                Column(
                                    Modifier.size(width = 90.dp, height = 82.dp).clip(RoundedCornerShape(12.dp))
                                        .background(if (focus == id) C.BrassHi else C.Cream)
                                        .border(if (focus == id) 2.5.dp else 1.5.dp, if (focus == id) C.Ink else C.SepiaBorder, RoundedCornerShape(12.dp))
                                        .clickable(enabled = !full) {
                                            if (focus == id) { session.send(Cmd.pickShell(id)); session.audio.play("ui_tap"); focus = null }
                                            else { session.audio.play("ui_tap"); focus = id }
                                        }
                                        .semantics(mergeDescendants = true) { contentDescription = "$name. ${content.shotCard(id)} ${if (focus == id) Text.t("rummage.take") else Text.t("rummage.shows")}" + if (wish) ". " + Text.t("rummage.rival_wants", "rival" to rivalShort) else "" }
                                        .padding(4.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                ) {
                                    ShotArtwork(session.sprites, id, Modifier.size(30.dp))
                                    Spacer(Modifier.height(2.dp))
                                    Label(name, size = 12, bold = true, color = C.Ink, align = TextAlign.Center, maxLines = 2)
                                    if (wish) Label(Text.t("rummage.rival_wants", "rival" to rivalShort), size = 10, bold = true, color = C.OrangeInk, maxLines = 2, align = TextAlign.Center)
                                }
                            }
                        }
                        // Decision-grade preview strip for focused shell in Rummage
                        val fId = focus
                        if (fId != null) {
                            val det = content.shotDetail(fId)
                            Column(
                                Modifier.fillMaxWidth().padding(top = 6.dp).clip(RoundedCornerShape(10.dp))
                                    .background(C.Cream).border(1.dp, C.SepiaBorder, RoundedCornerShape(10.dp)).padding(8.dp),
                                verticalArrangement = Arrangement.spacedBy(3.dp),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Label(det?.name ?: content.shotName(fId), size = 14, bold = true, color = C.Ink)
                                    if (det != null) {
                                        Label(Text.t("shell_card.weight_rest", "weight" to det.weightLabel, "rest" to det.restLabel), size = 12, color = C.InkSoft)
                                        val cls = content.className(det.matchClass)
                                        if (cls.isNotEmpty()) {
                                            Label(Text.t("shell_card.best_with_short", "class" to cls), size = 12, bold = true, color = C.OrangeInk)
                                        }
                                    }
                                }
                                Label(content.shotCard(fId).ifEmpty { Text.t("rummage.take") }, size = 13, color = C.Ink)
                                det?.goodAt?.takeIf { it.isNotEmpty() }?.let { Label(it, size = 12, color = C.InkSoft) }
                            }
                        } else {
                            Label(Text.t("rummage.hint"), Modifier.padding(top = 4.dp), size = 12, color = C.InkSoft)
                        }
                        fun names(ids: List<String>) = ids.joinToString(", ") { content.shotName(it) }.ifEmpty { Text.t("common.nobody") }
                        Label("${if (both) u.hud.names.getOrElse(0) { "" } else Text.t("rummage.yours")}: ${names(mine)}", Modifier.padding(top = 4.dp), size = 13, color = C.BlueInk, bold = true)
                        Label("${if (both) u.hud.names.getOrElse(1) { "" } else Text.t("rummage.theirs")}: ${names(theirs)}", size = 13, color = C.OrangeInk, bold = true)
                    }
                }
            }
            Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.SepiaBorder).padding(10.dp), horizontalArrangement = Arrangement.End) {
                CastleButton(if (session.loading) Text.t("common.loading_fight") else Text.t("common.fight"), { session.fight() }, Modifier.size(width = 160.dp, height = 56.dp), size = 20, enabled = spec != null && !session.loading && !session.coreMissing)
            }
        }
    }
}

// ---- Results -----------------------------------------------------------------------

@Composable
fun ResultsScreen(session: GameSession) {
    val u by session.ui.collectAsState()
    val r = u.result
    val winner = r?.winner ?: -1
    val duel = u.hud.human(0) && u.hud.human(1)
    val won = winner >= 0 && u.hud.human(winner)
    val campaign = session.lastSpec?.kind == "campaign"
    // One pick per result: pools (sign-off, verdict) must not change on every redraw.
    val lines = remember(r) {
        r?.let {
            ResultText.of(
                it, u.level, campaign, won, duel, u.hud.names, u.hud.names.getOrNull(1),
                hettyMet = (session.progress["1-7"] ?: 0) and 1 != 0,
                hobShort = { id -> session.frame.hobs.firstOrNull { h -> h.id == id }?.let { h -> session.content.hobShort(h.def) } },
                shotName = { id -> session.content.shotName(id).takeIf { id.isNotEmpty() } },
            )
        }
    }
    val head = lines?.title ?: ""
    val info = session.levelInfo(u.level)
    val texts = info?.goals?.map { Names.goal(info.id, it, u.hud.names.getOrNull(1)) } ?: emptyList()
    fun hobShortOf(id: Int): String? = session.frame.hobs.firstOrNull { it.id == id }?.let { session.content.hobShort(it.def) }
    var t by remember { mutableStateOf(if (session.settings.reduceMotion) 9999f else 0f) }
    LaunchedEffect(r) {
        val start = android.os.SystemClock.uptimeMillis()
        var stamped = 0
        var tickedAt = 0f
        while (t < 2800f) {
            t = (android.os.SystemClock.uptimeMillis() - start).toFloat()
            val due = if (campaign && t >= 400f) kotlin.math.floor((t - 400f) / 500f).toInt() + 1 else 0
            while (stamped < minOf(due, r?.pennants?.size ?: 0)) {
                if (r?.pennants?.getOrNull(stamped) == true) { session.audio.play("meta_pennant_stamp", semis = stamped * 2f); session.buzz(15) }
                stamped++
            }
            if (!duel && (r?.buttons ?: 0) > 0 && t in 1900f..2700f && t - tickedAt >= 90f) {
                tickedAt = t
                session.audio.play("ui_buttons_tick")
            }
            delay(16)
        }
    }
    val count = ((t - 1900f) / 800f).coerceIn(0f, 1f)
    val nextLevel = if (campaign && won) {
        val camp = session.content.campaign
        val idx = camp.indexOfFirst { it.id == u.level }
        if (idx >= 0) camp.getOrNull(idx + 1) else null
    } else null
    Box(
        Modifier.fillMaxSize().background(if (winner == 1 && duel) C.OrangeLight else if (won) C.BlueLight else C.Parchment).safeDrawingPadding()
            .clickable { t = 9999f },
        contentAlignment = Alignment.Center,
    ) {
        Plate(Modifier.padding(16.dp).widthIn(max = 460.dp).verticalScroll(rememberScrollState()), pad = 20.dp) {
            Label(head, Modifier.fillMaxWidth().semantics { heading() }, size = 30, bold = true, align = TextAlign.Center, color = if (winner >= 0) C.sideInk(winner) else C.Ink)
            lines?.sub?.takeIf { it.isNotEmpty() }?.let { Label(it, Modifier.fillMaxWidth().padding(top = 2.dp), size = 15, color = C.Ink, align = TextAlign.Center) }
            Label(Text.t("results.round", "n" to (r?.round ?: u.hud.round)), Modifier.fillMaxWidth().padding(top = 2.dp), size = 13, color = C.InkSoft, align = TextAlign.Center)
            lines?.signOff?.let { Label("“$it”", Modifier.fillMaxWidth().padding(top = 6.dp), size = 14, color = C.Ink, align = TextAlign.Center) }
            lines?.verdict?.let { v ->
                Column(Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(10.dp)).background(C.Cream).border(1.dp, C.SepiaBorder, RoundedCornerShape(10.dp)).padding(8.dp).semantics(mergeDescendants = true) {}) {
                    lines.verdictBy?.let { Label(it, size = 12, bold = true, color = C.InkSoft) }
                    Label("“$v”", size = 14, color = C.Ink)
                }
            }
            if (r != null && campaign && r.pennants.isNotEmpty()) {
                val got = r.pennants.count { it }
                Row(Modifier.fillMaxWidth().padding(top = 10.dp).semantics(mergeDescendants = true) { contentDescription = Text.t("pennants.count", "n" to got, "total" to r.pennants.size) }, horizontalArrangement = Arrangement.Center) {
                    r.pennants.forEachIndexed { i, ok ->
                        val shown = t >= 400f + 500f * i
                        val frame = ((t - (400f + 500f * i)) / 80f).toInt().coerceIn(0, 4)
                        Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
                            val spName = if (shown && ok) "ui_pennant_earn_$frame" else "ui_pennant_empty"
                            val drawn = SpriteImage(session.sprites, spName, Modifier.fillMaxSize())
                            if (!drawn) PennantFlagIcon(earned = ok && shown, modifier = Modifier.size(38.dp))
                        }
                    }
                }
                r.pennants.forEachIndexed { i, ok ->
                    val g = texts.getOrElse(i) { Text.t("pennants.label", "n" to i + 1) }
                    val fresh = r.pennantsNew.getOrElse(i) { false }
                    Row(
                        Modifier.padding(top = 3.dp).semantics(mergeDescendants = true) { contentDescription = Text.t(if (ok) "pennants.got" else "pennants.not_got", "goal" to g) + if (fresh) " " + Text.t("pennants.new") + "." else "" },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        PennantFlagIcon(earned = ok, modifier = Modifier.size(16.dp))
                        Label(g + (if (fresh) "  " + Text.t("pennants.new") else ""), size = 14, bold = fresh, color = C.Ink)
                    }
                }
            } else {
                Label(Text.t("results.kettles", "a" to u.hud.names.getOrElse(0) { "" }, "a_pct" to u.hud.kettlePct.getOrElse(0) { 0 }, "b" to u.hud.names.getOrElse(1) { "" }, "b_pct" to u.hud.kettlePct.getOrElse(1) { 0 }), Modifier.fillMaxWidth().padding(top = 12.dp), size = 14, align = TextAlign.Center)
            }
            if (r != null) {
                val score = r.score
                if (score.size >= 2) Label(Text.t("results.score", "a" to (score[0] * count).toInt(), "b" to (score[1] * count).toInt()), Modifier.fillMaxWidth().padding(top = 10.dp).semantics { contentDescription = Text.t("results.score", "a" to score[0], "b" to score[1]) }, size = 15, bold = true, align = TextAlign.Center)
                if (!duel && (campaign || r.buttons > 0)) Label(Text.t("results.buttons", "n" to (r.buttons * count).toInt()), Modifier.fillMaxWidth().semantics { contentDescription = Text.t("results.buttons_spoken", "n" to r.buttons) }, size = 18, bold = true, color = C.OrangeInk, align = TextAlign.Center)
                if (!duel && !won && r.buttons > 0) Label(Text.t("results.buttons_loss_note"), Modifier.fillMaxWidth(), size = 12, color = C.InkSoft, align = TextAlign.Center)
                val me = if (duel) winner.coerceAtLeast(0) else 0
                r.stats.getOrNull(me)?.let { st ->
                    Label(Text.t("results.stats", "shots" to st.shots, "hits" to st.hits, "bonks" to st.bonks, "blocks" to st.blocksDropped, "streak" to st.bestStreak), Modifier.fillMaxWidth().padding(top = 6.dp), size = 12, color = C.InkSoft, align = TextAlign.Center)
                }
                r.bestShot?.let { b ->
                    Label(HudText.bestShot(b, hobShortOf(b.hob)), Modifier.fillMaxWidth().padding(top = 6.dp), size = 14, bold = true, align = TextAlign.Center, color = C.sideInk(b.side.coerceIn(0, 1)))
                }
                if (r.stats.size >= 2) Column(Modifier.fillMaxWidth().padding(top = 4.dp)) {
                    for (i in 0..1) {
                        val who = if (duel) u.hud.names.getOrElse(i) { Text.t("setup.player_label", "n" to i + 1) } else if (i == 0) Text.t("results.best_shot_yours") else Text.t("results.best_shot_theirs")
                        val b = r.bestOf(i)
                        Label("$who: " + (b?.let { HudText.bestShot(it, hobShortOf(it.hob)) } ?: Text.t("results.best_shot_none")), Modifier.fillMaxWidth(), size = 12, color = C.sideInk(i), align = TextAlign.Center)
                    }
                }
                val b = r.broke
                if (b != null && !won && !duel) BrokePanel(b, null, ::hobShortOf) { session.content.shotName(it) }
                if (b != null && duel) BrokePanel(b, u.hud.names.getOrElse(b.side) { "" }, ::hobShortOf) { session.content.shotName(it) }
            }
            Spacer(Modifier.height(16.dp))
            if (nextLevel != null) {
                CastleButton(Text.t("level_card.next_level", "id" to nextLevel.id, "name" to nextLevel.name), { session.audio.play("ui_confirm"); session.openLevel(nextLevel.id) }, Modifier.fillMaxWidth(), color = C.Gold)
                Spacer(Modifier.height(8.dp))
            }
            if (session.canRematch) CastleButton(if (campaign) Text.t("results.again") else Text.t("results.rematch"), { session.audio.play("ui_confirm"); session.rematch() }, Modifier.fillMaxWidth(), color = if (nextLevel != null || (won && campaign)) C.Cream else C.Gold)
            Spacer(Modifier.height(8.dp))
            CastleButton(if (campaign) Text.t("results.map") else Text.t("common.done"), { session.audio.play("ui_back"); session.goBack() }, Modifier.fillMaxWidth(), color = if (nextLevel == null && won && campaign) C.Gold else C.Cream)
        }
    }
}

@Composable
private fun BrokePanel(b: games.castleprotect.core.Broke, who: String?, hobShort: (Int) -> String?, shotName: (String) -> String?) {
    Column(Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(12.dp)).background(C.Cream).border(1.5.dp, C.SepiaBorder, RoundedCornerShape(12.dp)).padding(10.dp)) {
        Label(if (who != null) Text.t("results.duel.what_broke", "name" to who) else Text.t("results.what_broke_you"), Modifier.semantics { heading() }, size = 15, bold = true)
        b.last?.let { l -> Label(BrokeText.last(l, hobShort, shotName), Modifier.padding(top = 4.dp), size = 13) }
        b.top.take(3).forEachIndexed { i, t -> Label(Text.t("results.top_blows", "rank" to i + 1, "blow" to BrokeText.blow(t, hobShort, shotName), "n" to t.dmg), size = 13) }
        Label(ResultText.tally(b), Modifier.padding(top = 4.dp), size = 12, color = C.InkSoft)
    }
}

/** The Notice of Flattening on a campaign level card (`levels.<id>.notice`, signed by the Rival). */
@Composable
private fun NoticeOfFlattening(level: String) {
    val notice = Text.opt("levels.$level.notice") ?: return
    val sig = Text.opt("levels.$level.signature")
    Column(
        Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(6.dp)).background(C.Paper)
            .border(1.5.dp, C.SepiaBorder, RoundedCornerShape(6.dp)).padding(10.dp).semantics(mergeDescendants = true) {},
    ) {
        Label(Text.t("level_card.notice.title"), Modifier.semantics { heading() }, size = 14, bold = true, color = C.Ink)
        Label(Text.t("level_card.notice.ref", "id" to level), size = 11, color = C.InkSoft)
        Label(notice, Modifier.padding(top = 4.dp), size = 13, color = C.Ink)
        if (sig != null) Label(Text.t("level_card.notice.signed", "signature" to sig), Modifier.padding(top = 4.dp), size = 12, color = C.InkSoft)
    }
}

/** None, Some, Lots (`setup.help`). */
private fun HELP_WORDS() = listOf(Text.t("setup.help.none"), Text.t("setup.help.some"), Text.t("setup.help.lots"))

/** Off, Light, Full (`setup.wind`). */
private fun WIND_WORDS() = listOf(Text.t("setup.wind.off"), Text.t("setup.wind.light"), Text.t("setup.wind.full"))

/** Cosy, Fair, Stubborn (`setup.difficulty`). Ids stay cozy, fair, stubborn. */
private fun GRADE_WORDS() = listOf(Text.t("setup.difficulty.cozy"), Text.t("setup.difficulty.fair"), Text.t("setup.difficulty.stubborn"))

// ---- Skirmish ----------------------------------------------------------------------

@Composable
fun SkirmishScreen(session: GameSession) {
    var rounds by rememberSaveable { mutableIntStateOf(1) }
    var wind by rememberSaveable { mutableIntStateOf(1) }
    var draft by rememberSaveable { mutableIntStateOf(0) }
    var map by rememberSaveable { mutableIntStateOf(0) }
    var winBy by rememberSaveable { mutableIntStateOf(0) }
    val maps = session.content.duelMaps
    Page(Text.t("setup.skirmish_title"), session) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
            Plate(Modifier.fillMaxWidth().widthIn(max = 560.dp)) {
                Label(Text.t("modes.skirmish.line"), size = 14, color = C.InkSoft)
                if (maps.size > 1) Choice(Text.t("setup.map"), maps.map { it.name }, map.coerceAtMost(maps.size - 1)) { map = it }
                Choice(Text.t("setup.rival"), GRADE_WORDS(), session.settings.preset) { session.settings.preset = it }
                Choice(Text.t("setup.win_by.label"), WIN_BY(), winBy) { winBy = it }
                if (winBy == 0) Choice(Text.t("setup.rounds"), listOf("10", "15", "20"), rounds) { rounds = it }
                Choice(Text.t("setup.wind.label"), WIND_WORDS(), wind) { wind = it }
                Choice(Text.t("setup.shells.label"), listOf(Text.t("setup.shells.draft"), Text.t("setup.shells.plain")), draft) { draft = it }
                Choice(Text.t("setup.help.label"), HELP_WORDS(), session.settings.help) { session.settings.help = it }
                Spacer(Modifier.height(10.dp))
                CastleButton(Text.t("common.next"), {
                    val level = maps.getOrNull(map)?.id ?: "d1"
                    session.openSpec(
                        BattleSpec.skirmish(
                            level, session.settings.presetKey, listOf(10, 15, 20)[rounds], wind, draft == 1,
                            help = SideOpts(session.settings.helpKey), volley = VOLLEY[winBy], windRange = session.content.app.windRange(wind),
                        ),
                    )
                }, Modifier.fillMaxWidth().height(56.dp), size = 18, enabled = !session.coreMissing)
            }
        }
    }
}

// ---- Couch Duel setup ----------------------------------------------------------------

/** The one Couch Duel name list (`names.duel`) for the dice. */
private fun duelNames(): List<String> = Text.list("names.duel")

@Composable
fun DuelSetupScreen(session: GameSession) {
    val defaults = Text.list("names.player_default")
    var p1 by rememberSaveable { mutableStateOf(defaults.getOrElse(0) { Text.t("setup.player_label", "n" to 1) }) }
    var p2 by rememberSaveable { mutableStateOf(defaults.getOrElse(1) { Text.t("setup.player_label", "n" to 2) }) }
    var rounds by rememberSaveable { mutableIntStateOf(1) }
    var wind by rememberSaveable { mutableIntStateOf(1) }
    var draft by rememberSaveable { mutableIntStateOf(0) }
    var seats by rememberSaveable { mutableIntStateOf(0) }
    var map by rememberSaveable { mutableIntStateOf(0) }
    var winBy by rememberSaveable { mutableIntStateOf(0) }
    var help1 by rememberSaveable { mutableIntStateOf(0) }
    var help2 by rememberSaveable { mutableIntStateOf(0) }
    val maps = session.content.duelMaps
    Page(Text.t("setup.duel_title"), session, trailing = { CastleButton(Text.t("setup.swap_sides"), { val t = p1; p1 = p2; p2 = t; val hh = help1; help1 = help2; help2 = hh }, color = C.Cream, size = 13) }) {
        Column(Modifier.fillMaxSize()) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Label(Text.t("modes.duel.line"), size = 13, color = C.InkSoft)
                BoxWithConstraints {
                    val wide = PhoneLayout.duelSideBySide(maxWidth.value)
                    val a: @Composable (Modifier) -> Unit = { m -> PlayerPlate(m, 0, p1, { p1 = it }, help1, { help1 = it }) { p1 = duelNames().filter { it != p2 && it != p1 }.randomOrNull() ?: p1 } }
                    val b: @Composable (Modifier) -> Unit = { m -> PlayerPlate(m, 1, p2, { p2 = it }, help2, { help2 = it }) { p2 = duelNames().filter { it != p1 && it != p2 }.randomOrNull() ?: p2 } }
                    if (wide) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.weight(1f)); b(Modifier.weight(1f)) }
                    else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.fillMaxWidth()); b(Modifier.fillMaxWidth()) }
                }
                Plate(Modifier.fillMaxWidth()) {
                    if (maps.size > 1) Choice(Text.t("setup.map"), maps.map { it.name }, map.coerceAtMost(maps.size - 1)) { map = it }
                    Choice(Text.t("setup.win_by.label"), WIN_BY(), winBy) { winBy = it }
                    if (winBy == 0) Choice(Text.t("setup.rounds"), listOf("10", "15", "20"), rounds) { rounds = it }
                    Choice(Text.t("setup.wind.label"), WIND_WORDS(), wind) { wind = it }
                    Choice(Text.t("setup.shells.label"), listOf(Text.t("setup.shells.draft"), Text.t("setup.shells.plain")), draft) { draft = it }
                    Choice(Text.t("setup.seats.label"), listOf(Text.t("setup.seats.side_by_side"), Text.t("setup.seats.one_seat")), seats) { seats = it }
                }
            }
            Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.SepiaBorder).padding(10.dp), horizontalArrangement = Arrangement.End) {
                CastleButton(Text.t("common.next"), {
                    val level = maps.getOrNull(map)?.id ?: "d1"
                    session.openSpec(
                        BattleSpec.couch(
                            level, listOf(p1.ifBlank { Text.t("setup.player_label", "n" to 1) }, p2.ifBlank { Text.t("setup.player_label", "n" to 2) }), listOf(10, 15, 20)[rounds], wind, draft == 1,
                            if (seats == 0) "side_by_side" else "one_seat", help = listOf(BattleSpec.duelHelp(help1), BattleSpec.duelHelp(help2)),
                            volley = VOLLEY[winBy], windRange = session.content.app.windRange(wind),
                        ),
                    )
                }, Modifier.size(width = 160.dp, height = 56.dp), size = 18, enabled = !session.coreMissing)
            }
        }
    }
}

private val VOLLEY = listOf(0, 6, 10, 14)
/** Knockout, Volley 6, Volley 10, Volley 14 (`setup.win_by`). */
private fun WIN_BY() = listOf(Text.t("setup.win_by.knockout")) + VOLLEY.drop(1).map { Text.t("setup.win_by.volley", "n" to it) }

@Composable
private fun PlayerPlate(modifier: Modifier, side: Int, name: String, onName: (String) -> Unit, help: Int, onHelp: (Int) -> Unit, dice: () -> Unit) {
    val shape = if (side == 0) CircleShape else RoundedCornerShape(3.dp)
    Plate(modifier.border(3.dp, C.side(side), PlateShape)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(22.dp).clip(shape).background(C.side(side)).border(2.dp, C.Ink, shape))
            Label("  " + Text.t("setup.player_label", "n" to side + 1), Modifier.semantics { heading() }, size = 14, bold = true, color = C.sideInk(side))
            Label("   " + Text.t(if (side == 0) "setup.player_side_left" else "setup.player_side_right"), size = 12, color = C.InkSoft)
        }
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(
                name, { onName(JsonText.takeCodePoints(it, 12)) },
                Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(10.dp)).background(Color.White)
                    .border(1.5.dp, C.Ink, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 12.dp)
                    .semantics { contentDescription = Text.t("setup.player_name", "n" to side + 1) },
                singleLine = true, textStyle = TextStyle(color = C.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold),
            )
            Spacer(Modifier.width(8.dp))
            CastleButton(Text.t("setup.silly_name"), dice, Modifier.height(48.dp), color = C.Cream, description = Text.t("setup.silly_name_hint", "n" to side + 1), pad = PaddingValues(horizontal = 12.dp), size = 13)
        }
        Choice(Text.t("setup.help.label"), HELP_WORDS(), help) { onHelp(it) }
    }
}

// ---- Settings ------------------------------------------------------------------------

@Composable
fun SettingsScreen(session: GameSession) {
    Page(Text.t("settings.title"), session) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
            Plate(Modifier.fillMaxWidth().widthIn(max = 640.dp)) { SettingsBody(session) }
        }
    }
}

/** Shared by the Settings screen and the Pause card. Every change applies at once; there is no Apply button. */
@Composable
fun SettingsBody(session: GameSession) {
    val s = session.settings
    Section(Text.t("settings.sound.title"))
    Volume(Text.t("settings.sound.music"), s.music, { s.music = it; session.audio.onSettingsChanged() }) { session.audio.play("ui_slider_tick") }
    Volume(Text.t("settings.sound.sound"), s.sound, { s.sound = it; session.audio.onSettingsChanged() }) { session.audio.play("ui_slider_tick") }
    Volume(Text.t("settings.sound.voices"), s.voices, { s.voices = it; session.audio.onSettingsChanged() }) { session.audio.play("bark_marge_picked") }
    Toggle(Text.t("settings.sound.mute"), s.muteAll, session) { s.muteAll = it; session.audio.onSettingsChanged() }
    Toggle(Text.t("settings.sound.subtitles"), s.subtitles, session) { s.subtitles = it }
    Section(Text.t("settings.controls.title"))
    Choice(Text.t("settings.controls.rotation"), listOf(Text.t("settings.controls.follow"), Text.t("settings.controls.wide"), Text.t("settings.controls.tall")), s.rotation) { s.rotation = it }
    Choice(Text.t("settings.controls.drag_mode"), listOf(Text.t("settings.controls.pull_back"), Text.t("settings.controls.point")), if (s.pointMode) 1 else 0) { s.pointMode = it == 1 }
    Toggle(Text.t("settings.controls.quick_fire"), s.quickFire, session) { s.quickFire = it }
    Toggle(Text.t("settings.controls.rival_fast"), s.rival2x, session) { s.rival2x = it }
    Toggle(Text.t("settings.controls.left_hand"), s.leftHand, session) { s.leftHand = it }
    Toggle(Text.t("settings.controls.taps_only"), s.tapOnly, session) { s.tapOnly = it }
    Section(Text.t("settings.help.title"))
    Choice(Text.t("settings.help.difficulty"), GRADE_WORDS(), s.preset) { s.preset = it }
    Choice(Text.t("settings.help.more_steam"), HELP_WORDS(), s.help) { s.help = it }
    Section(Text.t("settings.comfort.title"))
    Choice(Text.t("settings.comfort.text_size"), listOf(Text.t("settings.comfort.small"), Text.t("settings.comfort.normal"), Text.t("settings.comfort.large")), s.textSize) { s.textSize = it }
    Choice(Text.t("settings.comfort.haptics"), listOf(Text.t("common.off"), Text.t("setup.wind.light"), Text.t("settings.comfort.full")), s.haptics) { s.haptics = it; session.buzz(20) }
    Toggle(Text.t("settings.comfort.reduce_motion"), s.reduceMotion, session) { s.reduceMotion = it }
    Choice(Text.t("settings.comfort.screen_shake"), listOf(Text.t("settings.comfort.full"), "50%", Text.t("common.off")), s.shake) { s.shake = it }
    Toggle(Text.t("settings.comfort.reduce_flashes"), s.reduceFlashes, session) { s.reduceFlashes = it }
    Section(Text.t("settings.about.title"))
    Label(Text.t("settings.about.promise"), size = 14, bold = true)
    Label(Text.t("settings.about.privacy"), size = 13)
    Label(Text.t("settings.about.version", "version" to session.appVersion, "rules" to session.rulesVersion), size = 12, color = C.InkSoft)
    Label(Text.t("map.buttons_count", "n" to session.buttons), size = 12, color = C.InkSoft)
}

@Composable
private fun Volume(label: String, value: Int, set: (Int) -> Unit, done: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Label(label, Modifier.width(72.dp), size = 14)
        Slider(value.toFloat(), { set(it.toInt()) }, Modifier.weight(1f).semantics { contentDescription = Text.t("a11y.volume", "label" to label); stateDescription = Text.t("common.percent", "n" to value) }, valueRange = 0f..100f, onValueChangeFinished = done)
        Label("$value", Modifier.width(36.dp), size = 14, align = TextAlign.End)
    }
}

@Composable
private fun Section(title: String) {
    Label(title, Modifier.padding(top = 12.dp, bottom = 2.dp).semantics { heading() }, size = 17, bold = true)
}

@Composable
private fun Toggle(label: String, on: Boolean, session: GameSession, set: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable {
            val next = !on
            set(next)
            session.audio.play("ui_toggle_on", semis = if (next) 0f else -4f)
        }.semantics(mergeDescendants = true) { stateDescription = Text.t(if (on) "common.on" else "common.off") }.padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Label(label, Modifier.weight(1f), size = 14)
        Switch(on, null)
    }
}

package games.castleprotect.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * WCAG AA+ Parchment / Dark Espresso Ink / Brass Design System (Part 2 Section 3).
 * Ink (#2C221E) on Paper (#FFF4DE) / ParchmentCard (#FAF3E3) reaches 13.4:1 AAA;
 * GoodBg (#1F6B29) + White reaches 6.1:1 AA+; OrangeInk (#A94D00) reaches 5.4:1 AA;
 * BadInk (#A61C24) on BadBg (#FDECEE) reaches 6.8:1 AA.
 */
object C {
    // Ink & Parchment neutrals
    val Ink = Color(0xFF2C221E)
    val InkSoft = Color(0xFF5C4A3E)
    val SepiaBorder = Color(0xFF8C6F4E)
    val Paper = Color(0xFFFFF4DE)
    val ParchmentCard = Color(0xFFFAF3E3)
    val Cream = Color(0xFFFBE9C4)
    val Parchment = Color(0xFFF3DDB0)
    val HudTier2Bg = Color(0xF2FAF3E3)
    val HudTier3Bg = Color(0xDCFFF4DE)

    // Brass bevel tokens
    val BrassHi = Color(0xFFFFE08A)
    val BrassMid = Color(0xFFFFC23D)
    val BrassLo = Color(0xFFC88A2E)
    val BrassDeep = Color(0xFF8C5A14)
    val Gold = BrassMid
    val GoldDark = Color(0xFFD9952B)
    val GoldLight = BrassHi
    val Pennant = Color(0xFFFFD23F)
    val Kettle = Color(0xFF4FE3C1)

    // Semantic WCAG AA+ status tokens
    val GoodBg = Color(0xFF1F6B29)
    val GoodSoft = Color(0xFF8BD888)
    val Good = GoodBg
    val OrangeInk = Color(0xFFA94D00)
    val Orange = Color(0xFFE8730C)
    val OrangeLight = Color(0xFFFFB070)
    val BadInk = Color(0xFFA61C24)
    val BadBg = Color(0xFFFDECEE)
    val BadBorder = Color(0xFFC9363E)
    val Danger = BadInk

    // Team & faction tokens
    val Blue = Color(0xFF2F6FDE)
    val BlueInk = Color(0xFF1D4EA8)
    val BlueLight = Color(0xFF9DBDF5)
    val NookBack = Color(0xFF3B2D24)
    val LanternGlow = Color(0x3DFFCE70)
    val FlattenerSlate = Color(0xFF5A6572)
    val FlattenerDark = Color(0xFF3D4652)
    val LevelBubble = Color(0xFF4ADE80)

    // Environment & disabled tokens
    val Sky = Color(0xFFA5D8EC)
    val Grass = Color(0xFF7CC36A)
    val Locked = Color(0xFFCFC6B8)
    val DisabledBg = Color(0xFFE5DCC9)
    val DisabledInk = Color(0xFF6B5D50)

    fun side(i: Int) = if (i == 0) Blue else Orange
    /** AA-compliant text ink color for a side name on parchment/cream surfaces. */
    fun sideInk(i: Int) = if (i == 0) BlueInk else OrangeInk
}

@Composable
fun CastleTheme(textScale: Float, content: @Composable () -> Unit) {
    val d = LocalDensity.current
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = C.Gold, onPrimary = C.Ink, secondary = C.Blue, background = C.Parchment, onBackground = C.Ink,
            surface = C.Paper, onSurface = C.Ink, surfaceVariant = C.Cream, onSurfaceVariant = C.InkSoft, outline = C.Ink,
        ),
    ) {
        // Text size steps on top of the system font scale.
        CompositionLocalProvider(LocalDensity provides Density(d.density, d.fontScale * textScale), content = content)
    }
}

val PlateShape = RoundedCornerShape(14.dp)
val PillShape = RoundedCornerShape(16.dp)

/** Standard parchment card with espresso outer edge and warm stitched parchment tone. */
@Composable
fun Plate(modifier: Modifier = Modifier, color: Color = C.ParchmentCard, pad: Dp = 12.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .clip(PlateShape)
            .background(color)
            .border(1.5.dp, C.SepiaBorder, PlateShape)
            .drawBehind {
                val inset = 4.dp.toPx()
                drawRoundRect(
                    color = C.SepiaBorder.copy(alpha = 0.28f),
                    topLeft = Offset(inset, inset),
                    size = Size((size.width - inset * 2).coerceAtLeast(1f), (size.height - inset * 2).coerceAtLeast(1f)),
                    cornerRadius = CornerRadius(10.dp.toPx(), 10.dp.toPx()),
                    style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))),
                )
            }
            .padding(pad),
        content = content,
    )
}

// ---- 3-Tier HUD Chrome (Part 2 Section 1.3 & Section 3) --------------------

/**
 * Tier 1 HUD Medallion (FIRE, Primary Actions, Active Selection):
 * Chunky beveled brass-gold gradient with 2.5 dp dark espresso border and warm rim highlight.
 */
@Composable
fun HudTier1Medallion(
    modifier: Modifier = Modifier,
    shape: Shape = CircleShape,
    enabled: Boolean = true,
    brush: Brush? = null,
    contentAlignment: Alignment = Alignment.Center,
    content: @Composable BoxScope.() -> Unit,
) {
    val bgBrush = brush ?: if (enabled) {
        Brush.verticalGradient(listOf(C.BrassHi, C.BrassMid, C.BrassLo))
    } else {
        Brush.verticalGradient(listOf(C.DisabledBg, Color(0xFFD6CCB7)))
    }
    Box(
        modifier = modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(shape)
            .background(bgBrush)
            .border(BorderStroke(2.5.dp, if (enabled) C.Ink else C.SepiaBorder), shape)
            .drawBehind {
                if (enabled) {
                    val m = 4.dp.toPx()
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.35f),
                        topLeft = Offset(m, m),
                        size = Size((size.width - m * 2).coerceAtLeast(1f), ((size.height - m * 2) * 0.45f).coerceAtLeast(1f)),
                        cornerRadius = CornerRadius(size.minDimension / 2f, size.minDimension / 2f),
                    )
                }
            },
        contentAlignment = contentAlignment,
        content = content,
    )
}

/**
 * Tier 2 HUD Plate (Shot Tray, Walk Rail, Fine Tune, Aim Readout):
 * Recessed warm-parchment container (0xF2FAF3E3) with 1.5 dp sepia border and subtle stitched trim.
 */
@Composable
fun HudTier2Plate(
    modifier: Modifier = Modifier,
    shape: Shape = PlateShape,
    pad: PaddingValues = PaddingValues(6.dp),
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .clip(shape)
            .background(C.HudTier2Bg)
            .border(BorderStroke(1.5.dp, C.SepiaBorder), shape)
            .drawBehind {
                val inset = 3.dp.toPx()
                drawRoundRect(
                    color = C.SepiaBorder.copy(alpha = 0.32f),
                    topLeft = Offset(inset, inset),
                    size = Size((size.width - inset * 2).coerceAtLeast(1f), (size.height - inset * 2).coerceAtLeast(1f)),
                    cornerRadius = CornerRadius(10.dp.toPx(), 10.dp.toPx()),
                    style = Stroke(width = 0.9.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
                )
            }
            .padding(pad),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/**
 * Tier 3 HUD Pill (Top Strip Telemetry: Round/Phase, Fatigue, Wind, Kettle Dials):
 * Soft frosted translucent parchment (0xDCFFF4DE) with thin 1 dp espresso border.
 */
@Composable
fun HudTier3Pill(
    modifier: Modifier = Modifier,
    color: Color = C.HudTier3Bg,
    borderColor: Color = C.Ink.copy(alpha = 0.55f),
    pad: PaddingValues = PaddingValues(horizontal = 8.dp, vertical = 3.dp),
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = modifier
            .clip(PillShape)
            .background(color)
            .border(BorderStroke(1.dp, borderColor), PillShape)
            .padding(pad),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        content = content,
    )
}

@Composable
fun Label(text: String, modifier: Modifier = Modifier, size: Int = 14, bold: Boolean = false, color: Color = C.Ink, align: TextAlign? = null, maxLines: Int = Int.MAX_VALUE) {
    Text(text, modifier, color = color, fontSize = size.sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal, textAlign = align, maxLines = maxLines, overflow = TextOverflow.Ellipsis, lineHeight = (size * 1.25f).sp)
}

/**
 * A button that acts on release with no minimum press time. A 0 ms click counts,
 * and both the down and the up must land inside it (docs/design/07 section 3.10).
 * Uses beveled brass styling for primary [C.Gold] buttons and high-contrast disabled tones.
 */
@Composable
fun CastleButton(
    text: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = C.Gold, enabled: Boolean = true,
    selected: Boolean? = null, description: String? = null, size: Int = 16, shape: Shape = PlateShape,
    pad: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
    textColor: Color? = null,
) {
    val isPrimaryBrass = color == C.Gold
    val bgModifier = when {
        !enabled -> Modifier.background(C.DisabledBg)
        isPrimaryBrass -> Modifier.background(Brush.verticalGradient(listOf(C.BrassHi, C.BrassMid, C.BrassLo)))
        else -> Modifier.background(color)
    }
    val strokeWidth = if (isPrimaryBrass && enabled) 2.5.dp else 1.5.dp
    val strokeColor = if (enabled) C.Ink else C.SepiaBorder
    val fg = textColor ?: when {
        !enabled -> C.DisabledInk
        color == C.GoodBg || color == C.Blue || color == C.BadBorder || color == C.BadInk -> Color.White
        else -> C.Ink
    }
    Box(
        modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(shape)
            .then(bgModifier)
            .border(BorderStroke(strokeWidth, strokeColor), shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics {
                if (description != null) contentDescription = description
                if (selected != null) this.selected = selected
            }
            .padding(pad),
        contentAlignment = Alignment.Center,
    ) { Label(text, size = size, bold = true, color = fg, align = TextAlign.Center) }
}

/** A row of choices where exactly one is picked. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun Choice(label: String, options: List<String>, picked: Int, modifier: Modifier = Modifier, onPick: (Int) -> Unit) {
    Column(modifier.padding(vertical = 4.dp)) {
        if (label.isNotEmpty()) Label(label, size = 13, color = C.InkSoft)
        // Options wrap on a narrow card (QA playtest 1, M8), so nothing runs off the edge.
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            options.forEachIndexed { i, o ->
                CastleButton(o, { onPick(i) }, color = if (i == picked) C.Gold else C.Cream, selected = i == picked, size = 14, description = "$label: $o", pad = PaddingValues(horizontal = 12.dp, vertical = 8.dp))
            }
        }
    }
}

/** Swallows all touches while [on] is true (HUD clusters during an Aim Drag). */
fun Modifier.blockInput(on: Boolean): Modifier = if (!on) this else pointerInput(Unit) {
    awaitPointerEventScope { while (true) { awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } } }
}

/**
 * Tap: one step on release. Hold: first repeat after 350 ms, then 8 steps a second
 * rising to 20 a second after 1 s. Every hold has this tap twin, and tap-only turns
 * the hold off.
 *
 * The repeat can never outlive its gesture (review H5): it stops when the finger
 * lifts or the pointer is lost, when the gesture is cancelled because [enabled]
 * changed, when the key leaves the screen, and when [onStep] reports that nothing
 * changed (a limit was reached).
 */
@Composable
fun Modifier.tapOrHold(enabled: Boolean, tapOnly: Boolean, label: String, onStep: () -> Boolean): Modifier {
    val step by rememberUpdatedState(onStep)
    val on by rememberUpdatedState(enabled)
    val scope = rememberCoroutineScope()
    val holder = remember { arrayOfNulls<Job>(1) }
    DisposableEffect(Unit) { onDispose { holder[0]?.cancel(); holder[0] = null } }
    return this
        .semantics { role = Role.Button; contentDescription = label; if (!enabled) disabled(); onClick { if (enabled) step(); true } }
        .pointerInput(enabled, tapOnly) {
            if (!enabled) return@pointerInput
            awaitEachGesture {
                awaitFirstDown()
                var repeats = 0
                holder[0]?.cancel()
                val job: Job? = if (tapOnly) null else scope.launch {
                    delay(350)
                    val t0 = System.nanoTime()
                    while (isActive && on) {
                        if (!step()) break
                        repeats++
                        delay(if (System.nanoTime() - t0 > 1_000_000_000L) 50 else 125)
                    }
                }
                holder[0] = job
                try {
                    val up = waitForUpOrCancellation()
                    job?.cancel()
                    if (up != null && repeats == 0) step()
                } finally {
                    job?.cancel()
                    if (holder[0] === job) holder[0] = null
                }
            }
        }
}

/** Fires [onRelease] when the finger lifts inside. Sliding off cancels. */
@Composable
fun Modifier.onReleaseInside(enabled: Boolean, label: String, onRelease: () -> Unit): Modifier {
    val act by rememberUpdatedState(onRelease)
    return this
        .semantics { role = Role.Button; contentDescription = label; if (!enabled) disabled(); onClick { if (enabled) act(); true } }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            awaitEachGesture {
                awaitFirstDown()
                if (waitForUpOrCancellation() != null) act()
            }
        }
}

/** Draws a sprite from the shared assets if it is in this build (supports legacy PNGs and --v2 trimmed/deduped atlases). */
@Composable
fun SpriteImage(sprites: games.castleprotect.battle.Sprites, name: String, modifier: Modifier = Modifier): Boolean {
    val ver by sprites.version.collectAsState()
    val state = remember(name, ver) { mutableStateOf(sprites.getCachedUiBitmap(name)?.asImageBitmap()) }
    LaunchedEffect(name, ver) {
        if (state.value == null) {
            state.value = withContext(Dispatchers.IO) { sprites.get(name)?.let { sprites.uiBitmap(it).asImageBitmap() } }
        }
    }
    val img = state.value ?: return false
    androidx.compose.foundation.Image(img, contentDescription = null, modifier = modifier)
    return true
}

/** Draws shot icon artwork from [sprites], falling back cleanly to a bespoke vector [KnackFallbackIcon] so no blank square ever renders. */
@Composable
fun ShotArtwork(sprites: games.castleprotect.battle.Sprites, shotId: String, modifier: Modifier = Modifier) {
    val spriteName = if (shotId == "gravel_sneeze" || shotId == "extra_shake") "icon_gravel" else "icon_$shotId"
    if (!SpriteImage(sprites, spriteName, modifier)) {
        KnackFallbackIcon(shotId, modifier)
    }
}

// ---- Crisp Vector Canvas HUD Icons (Zero Unicode Glyphs) --------------------

/** Brass pressure-dial Heartkettle icon with glowing liquid sweep and copper spout. */
@Composable
fun BrassKettleDialIcon(pct: Int, side: Int, modifier: Modifier = Modifier) {
    val clamped = pct.coerceIn(0, 100)
    val teamCol = C.side(side)
    Canvas(modifier.size(22.dp)) {
        val w = size.width; val h = size.height
        val cx = w * 0.5f; val cy = h * 0.54f
        val r = size.minDimension * 0.42f
        val sw = (size.minDimension * 0.085f).coerceAtLeast(1.2f)
        // Top copper steam knob
        drawCircle(C.BrassLo, r * 0.24f, Offset(cx, cy - r - r * 0.08f))
        drawCircle(C.Ink, r * 0.24f, Offset(cx, cy - r - r * 0.08f), style = Stroke(sw * 0.8f))
        // Outer brass bezel
        drawCircle(C.BrassMid, r, Offset(cx, cy))
        drawCircle(C.Ink, r, Offset(cx, cy), style = Stroke(sw))
        // Recessed espresso dial face
        val innerR = r * 0.74f
        drawCircle(C.NookBack, innerR, Offset(cx, cy))
        // Glowing kettle core fill arc
        val coreColor = when {
            clamped <= 25 -> Color(0xFFE5484D)
            clamped <= 50 -> C.BrassMid
            else -> C.Kettle
        }
        drawArc(
            color = coreColor,
            startAngle = -90f,
            sweepAngle = 360f * (clamped / 100f),
            useCenter = true,
            topLeft = Offset(cx - innerR * 0.86f, cy - innerR * 0.86f),
            size = Size(innerR * 1.72f, innerR * 1.72f),
        )
        // Team collar dot + pressure needle
        val rad = ((-135f + 270f * (clamped / 100f)) * PI / 180.0)
        val nx = cx + (cos(rad) * innerR * 0.78f).toFloat()
        val ny = cy + (sin(rad) * innerR * 0.78f).toFloat()
        drawLine(C.Paper, Offset(cx, cy), Offset(nx, ny), strokeWidth = sw * 0.9f, cap = StrokeCap.Round)
        drawCircle(teamCol, r * 0.22f, Offset(cx, cy))
        drawCircle(C.Ink, r * 0.22f, Offset(cx, cy), style = Stroke(sw * 0.6f))
    }
}

/** Fluttering wind pennant on an espresso pole; bends left/right with [wind], droops when calm. */
@Composable
fun WindPennantIcon(wind: Int, modifier: Modifier = Modifier) {
    Canvas(modifier.size(20.dp)) {
        val w = size.width; val h = size.height
        val sw = (size.minDimension * 0.09f).coerceAtLeast(1.3f)
        val poleX = if (wind < 0) w * 0.78f else w * 0.22f
        drawLine(C.Ink, Offset(poleX, h * 0.14f), Offset(poleX, h * 0.90f), strokeWidth = sw, cap = StrokeCap.Round)
        drawCircle(C.BrassMid, sw * 0.9f, Offset(poleX, h * 0.14f))
        val p = Path()
        if (wind == 0) {
            p.moveTo(poleX, h * 0.22f)
            p.lineTo(poleX + w * 0.28f, h * 0.42f)
            p.lineTo(poleX + w * 0.16f, h * 0.64f)
            p.lineTo(poleX, h * 0.56f)
            p.close()
        } else {
            val dir = if (wind > 0) 1f else -1f
            val reach = (0.42f + (kotlin.math.abs(wind).coerceAtMost(8) * 0.035f)) * w
            p.moveTo(poleX, h * 0.20f)
            p.lineTo(poleX + dir * reach, h * 0.30f)
            p.lineTo(poleX + dir * reach * 0.76f, h * 0.40f)
            p.lineTo(poleX + dir * reach, h * 0.50f)
            p.lineTo(poleX, h * 0.54f)
            p.close()
        }
        drawPath(p, if (wind == 0) C.Locked else C.Orange)
        drawPath(p, C.Ink, style = Stroke(sw * 0.8f, join = StrokeJoin.Round))
    }
}

/** Brass 8-tooth Rest Cog icon for Medium/Heavy shot weight indicators. */
@Composable
fun RestCogIcon(modifier: Modifier = Modifier, tint: Color = C.BrassLo) {
    Canvas(modifier.size(16.dp)) {
        val cx = size.width / 2f; val cy = size.height / 2f
        val rOut = size.minDimension * 0.44f
        val rIn = size.minDimension * 0.31f
        val p = Path()
        val teeth = 8
        for (i in 0 until teeth * 2) {
            val a = i * PI / teeth
            val rr = if (i % 2 == 0) rOut else rIn
            val x = cx + (cos(a) * rr).toFloat()
            val y = cy + (sin(a) * rr).toFloat()
            if (i == 0) p.moveTo(x, y) else p.lineTo(x, y)
        }
        p.close()
        drawPath(p, tint)
        drawPath(p, C.Ink, style = Stroke((size.minDimension * 0.08f).coerceAtLeast(1.1f), join = StrokeJoin.Round))
        drawCircle(C.Paper, size.minDimension * 0.14f, Offset(cx, cy))
        drawCircle(C.Ink, size.minDimension * 0.14f, Offset(cx, cy), style = Stroke((size.minDimension * 0.07f).coerceAtLeast(1f)))
    }
}

/** Crisp Fatigue amber/crimson flame icon for Round 10+ Fatigue badge. */
@Composable
fun FatigueFlameIcon(modifier: Modifier = Modifier) {
    Canvas(modifier.size(16.dp)) {
        val w = size.width; val h = size.height
        val sw = (size.minDimension * 0.09f).coerceAtLeast(1.1f)
        val outer = Path().apply {
            moveTo(w * 0.50f, h * 0.08f)
            cubicTo(w * 0.78f, h * 0.34f, w * 0.88f, h * 0.62f, w * 0.72f, h * 0.84f)
            cubicTo(w * 0.60f, h * 0.96f, w * 0.40f, h * 0.96f, w * 0.28f, h * 0.84f)
            cubicTo(w * 0.12f, h * 0.62f, w * 0.24f, h * 0.36f, w * 0.50f, h * 0.08f)
            close()
        }
        val inner = Path().apply {
            moveTo(w * 0.50f, h * 0.42f)
            cubicTo(w * 0.64f, h * 0.56f, w * 0.66f, h * 0.74f, w * 0.50f, h * 0.84f)
            cubicTo(w * 0.34f, h * 0.74f, w * 0.36f, h * 0.56f, w * 0.50f, h * 0.42f)
            close()
        }
        drawPath(outer, C.Orange)
        drawPath(inner, C.BrassHi)
        drawPath(outer, C.Ink, style = Stroke(sw, join = StrokeJoin.Round))
    }
}

/** Golden swallowtail Pennant icon (replaces Unicode flags on Map & Results). */
@Composable
fun PennantFlagIcon(earned: Boolean, modifier: Modifier = Modifier) {
    Canvas(modifier.size(18.dp)) {
        val w = size.width; val h = size.height
        val sw = (size.minDimension * 0.09f).coerceAtLeast(1.2f)
        val px = w * 0.22f
        drawLine(C.Ink, Offset(px, h * 0.12f), Offset(px, h * 0.90f), strokeWidth = sw, cap = StrokeCap.Round)
        val flag = Path().apply {
            moveTo(px, h * 0.16f)
            lineTo(w * 0.88f, h * 0.26f)
            lineTo(w * 0.70f, h * 0.40f)
            lineTo(w * 0.88f, h * 0.54f)
            lineTo(px, h * 0.60f)
            close()
        }
        drawPath(flag, if (earned) C.BrassMid else C.Locked)
        drawPath(flag, C.Ink, style = Stroke(sw * 0.85f, join = StrokeJoin.Round))
        if (earned) drawCircle(C.BrassHi, size.minDimension * 0.08f, Offset(px + w * 0.24f, h * 0.38f))
    }
}

/** Crisp Settings gear icon (replaces Unicode gear glyph). */
@Composable
fun GearSettingsIcon(modifier: Modifier = Modifier) {
    RestCogIcon(modifier.size(22.dp), tint = C.SepiaBorder)
}

/**
 * Bespoke storybook vector icon for every Knack, Plain Shot, Trick Shell, and Doodad
 * so ZERO blank squares ever appear in the Shot Tray or Shell Inspect Card (Plate 1, 2, 3, 5).
 */
@Composable
fun KnackFallbackIcon(shotId: String, modifier: Modifier = Modifier) {
    Canvas(modifier.size(32.dp)) {
        val w = size.width; val h = size.height
        val cx = w * 0.5f; val cy = h * 0.52f
        val r = size.minDimension * 0.36f
        val sw = (size.minDimension * 0.075f).coerceAtLeast(1.4f)
        val stroke = Stroke(sw, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (shotId) {
            "grand_dumpling" -> { // Golden pleated soup dumpling with steam curls
                val p = Path().apply {
                    moveTo(w * 0.16f, h * 0.68f)
                    cubicTo(w * 0.14f, h * 0.34f, w * 0.34f, h * 0.26f, cx, h * 0.22f)
                    cubicTo(w * 0.66f, h * 0.26f, w * 0.86f, h * 0.34f, w * 0.84f, h * 0.68f)
                    cubicTo(w * 0.84f, h * 0.84f, w * 0.16f, h * 0.84f, w * 0.16f, h * 0.68f)
                    close()
                }
                drawPath(p, C.BrassHi)
                drawPath(p, C.Ink, style = stroke)
                drawLine(C.BrassLo, Offset(cx, h * 0.26f), Offset(w * 0.36f, h * 0.52f), sw * 0.8f, StrokeCap.Round)
                drawLine(C.BrassLo, Offset(cx, h * 0.26f), Offset(w * 0.64f, h * 0.52f), sw * 0.8f, StrokeCap.Round)
                drawCircle(C.BrassMid, r * 0.18f, Offset(cx, h * 0.20f))
                drawCircle(C.Ink, r * 0.18f, Offset(cx, h * 0.20f), style = Stroke(sw * 0.8f))
            }
            "sunspear", "hatpin" -> { // Piercing sunlit spear / needle bolt
                val col = if (shotId == "sunspear") C.BrassMid else Color(0xFF94A3B8)
                drawLine(col, Offset(w * 0.16f, h * 0.80f), Offset(w * 0.78f, h * 0.20f), sw * 2.1f, StrokeCap.Round)
                drawLine(C.Ink, Offset(w * 0.16f, h * 0.80f), Offset(w * 0.78f, h * 0.20f), sw * 0.7f, StrokeCap.Round)
                val tip = Path().apply {
                    moveTo(w * 0.88f, h * 0.12f)
                    lineTo(w * 0.74f, h * 0.38f)
                    lineTo(w * 0.62f, h * 0.26f)
                    close()
                }
                drawPath(tip, if (shotId == "sunspear") C.BrassHi else Color.White)
                drawPath(tip, C.Ink, style = stroke)
                if (shotId == "sunspear") {
                    drawCircle(C.BrassHi, r * 0.28f, Offset(w * 0.30f, h * 0.68f))
                    drawCircle(C.Ink, r * 0.28f, Offset(w * 0.30f, h * 0.68f), style = Stroke(sw * 0.8f))
                } else {
                    drawCircle(C.Blue, r * 0.24f, Offset(w * 0.20f, h * 0.78f))
                    drawCircle(C.Ink, r * 0.24f, Offset(w * 0.20f, h * 0.78f), style = Stroke(sw * 0.8f))
                }
            }
            "pepper_rain", "gravel_sneeze", "extra_shake" -> { // Multi-stone rain / pepper fan
                val isPepper = shotId == "pepper_rain"
                val dotCol = if (isPepper) C.BadBorder else Color(0xFF8C7A6B)
                val pts = if (isPepper) listOf(0.50f to 0.20f, 0.26f to 0.42f, 0.50f to 0.48f, 0.74f to 0.42f, 0.22f to 0.74f, 0.50f to 0.76f, 0.78f to 0.74f)
                else listOf(0.28f to 0.38f, 0.52f to 0.26f, 0.74f to 0.42f, 0.48f to 0.68f)
                for ((px, py) in pts) {
                    val rr = if (isPepper) size.minDimension * 0.105f else size.minDimension * 0.14f
                    drawCircle(dotCol, rr, Offset(w * px, h * py))
                    drawCircle(C.Ink, rr, Offset(w * px, h * py), style = Stroke(sw * 0.75f))
                }
            }
            "burrowbomb", "mole_mail", "nibbler" -> { // Spiral brass drill nosecone
                val body = Path().apply {
                    moveTo(w * 0.16f, h * 0.74f)
                    lineTo(w * 0.36f, h * 0.38f)
                    lineTo(w * 0.86f, h * 0.18f)
                    lineTo(w * 0.66f, h * 0.66f)
                    lineTo(w * 0.30f, h * 0.84f)
                    close()
                }
                drawPath(body, if (shotId == "mole_mail") C.Orange else C.BrassLo)
                drawPath(body, C.Ink, style = stroke)
                drawLine(C.BrassHi, Offset(w * 0.44f, h * 0.42f), Offset(w * 0.64f, h * 0.58f), sw, StrokeCap.Round)
                drawLine(C.BrassHi, Offset(w * 0.58f, h * 0.28f), Offset(w * 0.74f, h * 0.42f), sw, StrokeCap.Round)
            }
            "rolypoly", "marble_sack" -> { // Armored rolling spiral ball
                drawCircle(if (shotId == "rolypoly") Color(0xFF7B8E9B) else C.BlueLight, r, Offset(cx, cy))
                drawCircle(C.Ink, r, Offset(cx, cy), style = stroke)
                drawArc(C.BrassHi, -40f, 220f, false, Offset(cx - r * 0.55f, cy - r * 0.55f), Size(r * 1.1f, r * 1.1f), style = stroke)
                drawCircle(C.Orange, r * 0.22f, Offset(cx, cy))
            }
            "barn_raising", "mendglob", "mend_bucket" -> { // Green repair trowel / bucket + crisp plus
                drawRoundRect(C.GoodSoft, Offset(w * 0.18f, h * 0.24f), Size(w * 0.64f, h * 0.58f), CornerRadius(6f, 6f))
                drawRoundRect(C.Ink, Offset(w * 0.18f, h * 0.24f), Size(w * 0.64f, h * 0.58f), CornerRadius(6f, 6f), style = stroke)
                drawLine(C.GoodBg, Offset(cx, h * 0.36f), Offset(cx, h * 0.70f), sw * 1.7f, StrokeCap.Round)
                drawLine(C.GoodBg, Offset(w * 0.34f, h * 0.53f), Offset(w * 0.66f, h * 0.53f), sw * 1.7f, StrokeCap.Round)
            }
            "tick_tock_crock" -> { // Heavy iron ticking bomb clock
                drawCircle(C.FlattenerDark, r, Offset(cx, cy + h * 0.04f))
                drawCircle(C.Ink, r, Offset(cx, cy + h * 0.04f), style = stroke)
                drawCircle(C.Paper, r * 0.64f, Offset(cx, cy + h * 0.04f))
                drawLine(C.BadInk, Offset(cx, cy + h * 0.04f), Offset(cx, cy - r * 0.35f), sw, StrokeCap.Round)
                drawLine(C.Ink, Offset(cx, cy + h * 0.04f), Offset(cx + r * 0.36f, cy + h * 0.04f), sw, StrokeCap.Round)
                drawCircle(C.BrassMid, r * 0.20f, Offset(cx + r * 0.55f, cy - r * 0.75f))
            }
            "pan_parade", "lid_lifter", "pot_lid" -> { // Gleaming copper skillet / pot lid
                drawCircle(C.BrassLo, r * 0.85f, Offset(cx - w * 0.06f, cy))
                drawCircle(C.BrassHi, r * 0.52f, Offset(cx - w * 0.06f, cy))
                drawCircle(C.Ink, r * 0.85f, Offset(cx - w * 0.06f, cy), style = stroke)
                drawLine(C.Ink, Offset(cx + r * 0.68f, cy), Offset(w * 0.90f, cy - h * 0.08f), sw * 1.5f, StrokeCap.Round)
            }
            "bouncebean", "rubber_radish" -> { // Springy bouncing pod with hop arcs
                drawCircle(if (shotId == "rubber_radish") Color(0xFFD94A6E) else C.Grass, r * 0.78f, Offset(cx, cy + h * 0.06f))
                drawCircle(C.Ink, r * 0.78f, Offset(cx, cy + h * 0.06f), style = stroke)
                drawArc(C.BrassLo, 200f, 140f, false, Offset(w * 0.14f, h * 0.12f), Size(w * 0.72f, h * 0.44f), style = Stroke(sw * 0.8f, cap = StrokeCap.Round))
            }
            "nosy_goose" -> { // Homing goose head with orange beak
                drawCircle(Color.White, r * 0.82f, Offset(cx - w * 0.06f, cy))
                drawCircle(C.Ink, r * 0.82f, Offset(cx - w * 0.06f, cy), style = stroke)
                val beak = Path().apply {
                    moveTo(cx + r * 0.55f, cy - r * 0.25f)
                    lineTo(w * 0.92f, cy)
                    lineTo(cx + r * 0.55f, cy + r * 0.25f)
                    close()
                }
                drawPath(beak, C.Orange)
                drawPath(beak, C.Ink, style = Stroke(sw * 0.8f, join = StrokeJoin.Round))
                drawCircle(C.Ink, r * 0.16f, Offset(cx + r * 0.12f, cy - r * 0.18f))
            }
            "pudding_bomb" -> { // Frosted pudding dome bomb
                drawCircle(Color(0xFF7A4E32), r * 0.92f, Offset(cx, cy + h * 0.05f))
                drawArc(C.Paper, 180f, 180f, true, Offset(cx - r * 0.92f, cy - r * 0.85f), Size(r * 1.84f, r * 1.15f))
                drawCircle(C.Ink, r * 0.92f, Offset(cx, cy + h * 0.05f), style = stroke)
                drawCircle(C.BadBorder, r * 0.22f, Offset(cx, cy - r * 0.88f))
            }
            "old_turnip" -> { // Plump purple-topped turnip
                drawCircle(Color(0xFFF3E2C6), r * 0.84f, Offset(cx, cy + h * 0.08f))
                drawArc(Color(0xFF8B4F8E), 180f, 180f, true, Offset(cx - r * 0.84f, cy - r * 0.74f), Size(r * 1.68f, r * 0.96f))
                drawCircle(C.Ink, r * 0.84f, Offset(cx, cy + h * 0.08f), style = stroke)
                drawLine(C.GoodBg, Offset(cx, cy - r * 0.74f), Offset(cx - r * 0.3f, h * 0.12f), sw, StrokeCap.Round)
                drawLine(C.GoodBg, Offset(cx, cy - r * 0.74f), Offset(cx + r * 0.3f, h * 0.12f), sw, StrokeCap.Round)
            }
            "sod_sack" -> { // Burlap sack with grass tuft
                drawRoundRect(Color(0xFFC49A62), Offset(w * 0.20f, h * 0.34f), Size(w * 0.60f, h * 0.52f), CornerRadius(8f, 8f))
                drawRoundRect(C.Ink, Offset(w * 0.20f, h * 0.34f), Size(w * 0.60f, h * 0.52f), CornerRadius(8f, 8f), style = stroke)
                drawLine(C.GoodBg, Offset(cx, h * 0.34f), Offset(cx - w * 0.12f, h * 0.14f), sw, StrokeCap.Round)
                drawLine(C.GoodBg, Offset(cx, h * 0.34f), Offset(cx + w * 0.12f, h * 0.14f), sw, StrokeCap.Round)
            }
            else -> { // Classic clay Clodpot / brass shell bomb with lit spark
                drawCircle(Color(0xFFB56B3D), r * 0.90f, Offset(cx, cy + h * 0.06f))
                drawCircle(C.Ink, r * 0.90f, Offset(cx, cy + h * 0.06f), style = stroke)
                drawLine(C.Ink, Offset(cx + r * 0.2f, cy - r * 0.76f), Offset(cx + r * 0.55f, h * 0.14f), sw, StrokeCap.Round)
                drawCircle(C.BrassHi, r * 0.26f, Offset(cx + r * 0.58f, h * 0.14f))
                drawCircle(C.Orange, r * 0.14f, Offset(cx + r * 0.58f, h * 0.14f))
            }
        }
    }
}

/** A note at the top of any screen, with OK to close it. Read out by TalkBack. */
@Composable
fun NoticeBar(text: String, onOk: () -> Unit) {
    Box(Modifier.fillMaxSize().safeDrawingPadding().padding(12.dp), contentAlignment = Alignment.TopCenter) {
        Plate(Modifier.widthIn(max = 420.dp).semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite }, color = C.Cream) {
            Label(text, size = 13)
            CastleButton("OK", onOk, Modifier.padding(top = 6.dp), color = C.Paper, size = 13)
        }
    }
}

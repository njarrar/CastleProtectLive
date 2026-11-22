package games.castleprotect.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.disabled
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Palette from docs/design/06-art-direction.md. */
object C {
    val Ink = Color(0xFF2B1E2E); val InkSoft = Color(0xFF4A3A4C)
    val Paper = Color(0xFFFFF4DE); val Cream = Color(0xFFFBE9C4); val Parchment = Color(0xFFF3DDB0)
    val Gold = Color(0xFFFFC23D); val GoldDark = Color(0xFFD9952B); val GoldLight = Color(0xFFFFE08A)
    val Pennant = Color(0xFFFFD23F); val Kettle = Color(0xFF4FE3C1)
    val Good = Color(0xFF5CC35A); val Danger = Color(0xFFE5484D)
    val Blue = Color(0xFF2F6FDE); val BlueLight = Color(0xFF9DBDF5)
    val Orange = Color(0xFFE8730C); val OrangeLight = Color(0xFFFFB070)
    val Sky = Color(0xFFA5D8EC); val Grass = Color(0xFF7CC36A); val Locked = Color(0xFFCFC6B8)
    fun side(i: Int) = if (i == 0) Blue else Orange
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

@Composable
fun Plate(modifier: Modifier = Modifier, color: Color = C.Paper, pad: Dp = 12.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.clip(PlateShape).background(color).border(2.dp, C.Ink, PlateShape).padding(pad), content = content)
}

@Composable
fun Label(text: String, modifier: Modifier = Modifier, size: Int = 14, bold: Boolean = false, color: Color = C.Ink, align: TextAlign? = null, maxLines: Int = Int.MAX_VALUE) {
    Text(text, modifier, color = color, fontSize = size.sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal, textAlign = align, maxLines = maxLines, overflow = TextOverflow.Ellipsis, lineHeight = (size * 1.25f).sp)
}

/**
 * A button that acts on release with no minimum press time. A 0 ms click counts,
 * and both the down and the up must land inside it (docs/design/07 section 3.10).
 */
@Composable
fun CastleButton(
    text: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = C.Gold, enabled: Boolean = true,
    selected: Boolean? = null, description: String? = null, size: Int = 16, shape: Shape = PlateShape,
    pad: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
) {
    Box(
        modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .alpha(if (enabled) 1f else 0.45f)
            .clip(shape).background(color).border(BorderStroke(2.dp, C.Ink), shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics {
                if (description != null) contentDescription = description
                if (selected != null) this.selected = selected
            }
            .padding(pad),
        contentAlignment = Alignment.Center,
    ) { Label(text, size = size, bold = true, align = TextAlign.Center) }
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

/** Draws a sprite from the shared assets if it is in this build. Returns false when it is not, so the caller can show text instead. */
@Composable
fun SpriteImage(sprites: games.castleprotect.battle.Sprites, name: String, modifier: Modifier = Modifier): Boolean {
    val img = remember(name, sprites.generation) { sprites.get(name)?.bmp?.asImageBitmap() } ?: return false
    androidx.compose.foundation.Image(img, contentDescription = null, modifier = modifier)
    return true
}

/** A note at the top of any screen, with OK to close it. Read out by TalkBack. */
@Composable
fun NoticeBar(text: String, onOk: () -> Unit) {
    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().safeDrawingPadding().padding(12.dp), contentAlignment = androidx.compose.ui.Alignment.TopCenter) {
        Plate(Modifier.widthIn(max = 420.dp).semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite }, color = C.Cream) {
            Label(text, size = 13)
            CastleButton("OK", onOk, Modifier.padding(top = 6.dp), color = C.Paper, size = 13)
        }
    }
}

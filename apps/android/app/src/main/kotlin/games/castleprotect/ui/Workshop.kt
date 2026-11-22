package games.castleprotect.ui

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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import games.castleprotect.game.FortCheck
import games.castleprotect.game.FortGrid
import games.castleprotect.game.GameSession

/**
 * The Workshop: place blocks and rooms on the fort grid, save one fort, try it in the Test Yard.
 * Whether a fort stands is the core's answer (`validate_blueprint`); the grid only edits glyphs.
 * Cells are never under 24 dp (QA playtest 1, M5). A short landscape screen puts the grid on
 * the left and the palette and buttons on the right; the screen scrolls when it must.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkshopScreen(session: GameSession) {
    val start = remember { FortGrid.fromRows(session.fort.ifEmpty { FortGrid.HOME }) }
    var grid by remember { mutableStateOf(start) }
    var tool by remember { mutableStateOf('t') }
    val undo = remember { ArrayDeque<FortGrid>() }
    var check by remember { mutableStateOf<FortCheck?>(null) }
    var savedRows by remember { mutableStateOf(session.fort) }
    var gen by remember { mutableIntStateOf(0) }
    DisposableEffect(Unit) { onDispose { session.leaveWorkshop() } }
    LaunchedEffect(gen) {
        val rows = grid.toRows()
        if (rows.isEmpty()) check = FortCheck(false, "Place some blocks.") else session.checkFort(rows, grid.seats()) { check = it }
    }
    fun edit(c: Int, r: Int) {
        val next = grid.copy()
        if (next.place(tool, c, r)) { undo.addLast(grid); if (undo.size > 50) undo.removeFirst(); grid = next; gen++; session.audio.play("ui_tap") }
        else session.audio.play("ui_denied")
    }
    val rows = grid.toRows()
    val ok = check?.ok == true
    val c0 = (0 until grid.cols).firstOrNull { c -> (0 until grid.rows).any { r -> grid[c, r] != '.' } } ?: 0
    val bad = check?.cells?.map { (c, r) -> (c + c0) to (r - 1) }?.toSet() ?: emptySet()

    Column(Modifier.fillMaxSize().background(C.Parchment).safeDrawingPadding()) {
        Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            CastleButton("‹", { session.goBack() }, Modifier.size(48.dp), color = C.Cream, description = "Back", size = 22, pad = androidx.compose.foundation.layout.PaddingValues(0.dp))
            Label("Workshop", Modifier.weight(1f).padding(horizontal = 10.dp).semantics { heading() }, size = 20, bold = true, maxLines = 1)
            CastleButton("Undo", { undo.removeLastOrNull()?.let { grid = it; gen++ } }, color = C.Cream, size = 13, enabled = undo.isNotEmpty())
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val side = FortGrid.sideBySide(maxWidth.value, maxHeight.value)
            // The grid's share of the screen: the left 60% when side by side, else the width and 62% of the height.
            val boxW = if (side) maxWidth.value * 0.6f - 16f else maxWidth.value - 16f
            val boxH = if (side) maxHeight.value - 16f else maxHeight.value * 0.62f
            val cell = FortGrid.cellDp(boxW, boxH).dp
            val gridView: @Composable () -> Unit = { Grid(grid, cell, bad) { c, r -> edit(c, r) } }
            val status: @Composable () -> Unit = {
                val ck = check
                val line = when {
                    ck == null -> "Checking..."
                    ck.ok -> "Ready. Blocks ${ck.used}/${ck.budget}   Cost ${ck.cost}   Nooks ${grid.seats()}"
                    else -> ck.why + if (ck.budget > 0) "   Blocks ${ck.used}/${ck.budget}" else ""
                }
                Label(line, Modifier.fillMaxWidth().padding(vertical = 4.dp).semantics { liveRegion = LiveRegionMode.Polite }, size = 13, bold = !ok, color = if (ok) C.Ink else C.Danger)
            }
            val palette: @Composable () -> Unit = {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for ((t, name) in TOOLS) CastleButton(name, { tool = t }, color = if (tool == t) C.Gold else C.Cream, selected = tool == t, size = 14, description = "Tool: $name")
                }
            }
            val buttons: @Composable () -> Unit = {
                FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CastleButton("Revert", { undo.addLast(grid); grid = FortGrid.fromRows(savedRows.ifEmpty { FortGrid.HOME }); gen++ }, color = C.Cream)
                    CastleButton("Save", { session.saveFort(rows); savedRows = rows; session.audio.play("ui_confirm") }, enabled = ok && rows != savedRows)
                    CastleButton("Test Yard", { if (ok) { session.saveFort(rows); savedRows = rows }; session.startTestYard(if (ok) rows else null) },
                        color = C.Cream, enabled = !session.loading && !session.coreMissing, description = "Try this fort in the Test Yard")
                }
            }
            if (side) Row(Modifier.fillMaxSize().padding(8.dp)) {
                Box(Modifier.weight(0.6f).verticalScroll(rememberScrollState()).horizontalScroll(rememberScrollState())) { gridView() }
                Column(Modifier.weight(0.4f).verticalScroll(rememberScrollState()).padding(start = 8.dp)) { status(); palette(); buttons() }
            } else Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.horizontalScroll(rememberScrollState())) { gridView() }
                status(); palette(); buttons()
            }
        }
    }
}

private val TOOLS = listOf('w' to "Wicker", 't' to "Timber", 'c' to "Cobble", 'N' to "Nook", 'K' to "Kettle", '.' to "Erase")

@Composable
private fun Grid(g: FortGrid, cell: Dp, bad: Set<Pair<Int, Int>>, onCell: (Int, Int) -> Unit) {
    Column(Modifier.border(2.dp, C.Ink)) {
        for (r in g.rows - 1 downTo 0) Row {
            for (c in 0 until g.cols) {
                val ch = g[c, r]
                val name = when (ch) { 'w' -> "Wicker"; 't' -> "Timber"; 'c' -> "Cobble"; 'K' -> "Kettle Room"; in '1'..'5' -> "Nook $ch"; else -> "empty" }
                Box(Modifier.size(cell).background(cellColor(ch)).border(if ((c to r) in bad) 2.dp else 0.5.dp, if ((c to r) in bad) C.Danger else C.InkSoft)
                    .clickable(onClickLabel = "place") { onCell(c, r) }
                    .semantics { contentDescription = "Column ${c + 1}, row ${r + 1}, $name" + if ((c to r) in bad) ", does not stand" else "" }, contentAlignment = Alignment.Center) {
                    if (ch == 'K') Label("K", size = 12, bold = true, color = Color.White)
                    else if (ch in '1'..'5') Label("$ch", size = 12, bold = true)
                }
            }
        }
        // The Footing row the fort stands on.
        Row { for (c in 0 until g.cols) Box(Modifier.size(width = cell, height = cell / 2).background(C.InkSoft)) }
    }
}

private fun cellColor(ch: Char): Color = when (ch) {
    'w' -> Color(0xFFD9B36C); 't' -> Color(0xFFA0703F); 'c' -> Color(0xFF9A9A9A)
    'K' -> C.Kettle; in '1'..'5' -> C.BlueLight; else -> Color(0xFFF7F1E1)
}

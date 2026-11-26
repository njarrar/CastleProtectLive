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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import games.castleprotect.battle.Sprites
import games.castleprotect.game.FortCheck
import games.castleprotect.game.FortGrid
import games.castleprotect.game.GameSession
import games.castleprotect.game.WorkshopDiag
import games.castleprotect.core.Text

/**
 * Workshop Fort Builder (Part 2 Plate 4 redesign):
 * - Drafting board with A-H column ticks, 1-9 row coordinates, bold FRONT → banner with dark
 *   Loophole arches on the enemy-facing side, and 3 planted Stomper legs beneath dark stone Footing.
 * - Unified 2x2 Kettle Room (single glowing copper Heartkettle + steam pipe, never 4 duplicate tiles)
 *   and unified 2x2 lantern-lit Nooks seating real Hob portraits & nameplates (1 Marge, 2 Quill, 3 Jax...).
 * - Pinpoint red dashed "Needs a wall" and red cross-hatched "Nothing under it" overlays mapped accurately via
 *   (c + c0, r - 1), structured inspector panel with AA green Ready / red issues list, Crew Seated,
 *   Blocks, Cost, high-contrast disabled Save, and Test Yard strictly disabled when invalid.
 *
 * Validation still comes 100% from the core (`validate_blueprint`).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkshopScreen(session: GameSession) {
    val app = session.content.app
    // The start fort comes from content/blueprints.json, never a copy in the app.
    val homeRows = session.content.blueprint(FortGrid.HOME_ID) ?: emptyList()
    val start = remember { FortGrid.fromRows(session.fort.ifEmpty { homeRows }, app.workshopCols, app.workshopRows, app.workshopMaxNooks) }
    var grid by remember { mutableStateOf(start) }
    var tool by remember { mutableStateOf('t') }
    val undo = remember { ArrayDeque<FortGrid>() }
    var check by remember { mutableStateOf<FortCheck?>(null) }
    var savedRows by remember { mutableStateOf(session.fort) }
    var gen by remember { mutableIntStateOf(0) }
    DisposableEffect(Unit) { onDispose { session.leaveWorkshop() } }
    LaunchedEffect(gen) {
        val reqGen = gen
        val rows = grid.toRows()
        if (rows.isEmpty()) check = FortCheck(false, Text.t("workshop.empty"), kind = "too_small")
        else session.checkFort(rows, grid.seats().coerceAtLeast(1)) { res -> if (reqGen == gen) check = res }
    }
    fun edit(c: Int, r: Int) {
        val next = grid.copy()
        if (next.place(tool, c, r)) {
            undo.addLast(grid); if (undo.size > 50) undo.removeFirst()
            check = null; grid = next; gen++
            session.audio.play("meta_block_place", semis = if (tool == '.') -5f else 0f)
        } else session.audio.play("ui_denied")
    }
    val rows = grid.toRows()
    val ok = check?.ok == true
    val badMap = remember(grid, check) { WorkshopDiag.mapBadCells(grid, check) }
    val rooms = remember(grid) { WorkshopDiag.roomAnchors(grid) }
    val roster = session.content.playerRoster

    Column(Modifier.fillMaxSize().background(C.Parchment).safeDrawingPadding()) {
        Row(
            Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.SepiaBorder).padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CastleButton("‹", { session.goBack() }, Modifier.size(48.dp), color = C.Cream, description = Text.t("common.back"), size = 22, pad = PaddingValues(0.dp))
            Label(Text.t("workshop.title"), Modifier.weight(1f).padding(horizontal = 10.dp).semantics { heading() }, size = 20, bold = true, color = C.Ink, maxLines = 1)
            CastleButton(Text.t("common.undo"), { undo.removeLastOrNull()?.let { check = null; grid = it; gen++ } }, color = C.Cream, size = 13, enabled = undo.isNotEmpty())
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val side = FortGrid.sideBySide(maxWidth.value, maxHeight.value)
            val boxW = if (side) maxWidth.value * 0.6f - 48f else maxWidth.value - 48f
            val boxH = if (side) maxHeight.value - 84f else maxHeight.value * 0.60f - 40f
            val cell = maxOf(36f, FortGrid.cellDp(boxW, boxH, grid.cols, grid.rows + 1)).dp

            val draftingBoard: @Composable () -> Unit = {
                DraftingBoard(
                    grid = grid,
                    cell = cell,
                    rooms = rooms,
                    badMap = badMap,
                    roster = roster,
                    sprites = session.sprites,
                    onCell = { c, r -> edit(c, r) },
                )
            }

            val inspector: @Composable () -> Unit = {
                val ck = check
                val issues = WorkshopDiag.issueCount(ck, badMap.size)
                Plate(
                    Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
                    color = if (ck != null && !ck.ok) C.BadBg else C.ParchmentCard,
                    pad = 10.dp,
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        when {
                            ck == null -> Label(Text.t("workshop.checking"), size = 13, bold = true, color = C.InkSoft)
                            ck.ok -> Label(
                                Text.t("workshop.ready"),
                                Modifier.clip(PillShape).background(C.GoodBg).padding(horizontal = 10.dp, vertical = 3.dp),
                                size = 13, bold = true, color = Color.White,
                            )
                            else -> Label(
                                Text.plural("workshop.to_fix", issues),
                                Modifier.clip(PillShape).background(C.BadBorder).padding(horizontal = 10.dp, vertical = 3.dp),
                                size = 13, bold = true, color = Color.White,
                            )
                        }
                        Label(
                            Text.t("workshop.nooks", "n" to grid.seats(), "total" to app.workshopMaxNooks),
                            size = 12, bold = true, color = C.Ink,
                        )
                    }
                    if (ck != null && !ck.ok) {
                        Label(
                            ck.why,
                            Modifier.fillMaxWidth().padding(top = 6.dp).clip(RoundedCornerShape(8.dp))
                                .background(C.Paper).border(1.dp, C.BadBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            size = 13, bold = true, color = C.BadInk,
                        )
                    }
                    FlowRow(
                        Modifier.padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        val budget = ck?.budget?.takeIf { it > 0 } ?: app.workshopBudget
                        val used = ck?.used ?: 0
                        val cost = ck?.cost ?: 0
                        MetricPill(Text.t("workshop.blocks_count", "n" to used, "total" to budget))
                        MetricPill(Text.t("workshop.cost") + ": " + Text.t("map.buttons_count", "n" to cost))
                    }
                }
            }

            val palette: @Composable () -> Unit = {
                Plate(Modifier.fillMaxWidth().padding(top = 8.dp), color = C.ParchmentCard, pad = 10.dp) {
                    Label(Text.t("workshop.palette"), Modifier.padding(bottom = 6.dp), size = 13, bold = true, color = C.InkSoft)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        for ((t, key) in TOOLS) {
                            val name = Text.t("workshop.tools.$key")
                            val active = tool == t
                            Row(
                                Modifier
                                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                    .clip(PlateShape)
                                    .background(if (active) C.BrassMid else C.Cream)
                                    .border(if (active) 2.5.dp else 1.5.dp, if (active) C.Ink else C.SepiaBorder, PlateShape)
                                    .clickable { tool = t }
                                    .semantics { contentDescription = Text.t("workshop.tool_pick", "tool" to name); this.selected = active }
                                    .padding(horizontal = 10.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Box(
                                    Modifier.size(14.dp).clip(RoundedCornerShape(3.dp))
                                        .background(toolSwatch(t)).border(1.dp, C.Ink, RoundedCornerShape(3.dp)),
                                )
                                Label(name, size = 13, bold = true, color = C.Ink)
                            }
                        }
                    }
                }
            }

            val buttons: @Composable () -> Unit = {
                FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CastleButton(
                        Text.t("common.revert"),
                        {
                            undo.addLast(grid); check = null
                            grid = FortGrid.fromRows(savedRows.ifEmpty { homeRows }, app.workshopCols, app.workshopRows, app.workshopMaxNooks)
                            gen++
                        },
                        color = C.Cream, size = 14,
                    )
                    CastleButton(
                        Text.t("common.save"),
                        { session.saveFort(rows); savedRows = rows; session.audio.play("ui_confirm") },
                        color = C.Gold, enabled = ok && rows != savedRows, size = 14,
                    )
                    // Test Yard tries the in-memory fort without touching the saved campaign fort (H-A06, workshop.test_yard_hint).
                    CastleButton(
                        Text.t("workshop.test_yard"),
                        {
                            if (ok) {
                                session.startTestYard(rows)
                            }
                        },
                        color = C.Blue,
                        enabled = ok && !session.loading && !session.coreMissing,
                        size = 14,
                        description = if (ok) Text.t("workshop.test_yard_hint") else Text.t("workshop.fix_first"),
                    )
                }
            }

            if (side) {
                Row(Modifier.fillMaxSize().padding(8.dp)) {
                    Box(Modifier.weight(0.6f).verticalScroll(rememberScrollState()).horizontalScroll(rememberScrollState())) { draftingBoard() }
                    Column(Modifier.weight(0.4f).verticalScroll(rememberScrollState()).padding(start = 10.dp)) {
                        inspector(); palette(); buttons()
                    }
                }
            } else {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.horizontalScroll(rememberScrollState())) { draftingBoard() }
                    Spacer(Modifier.height(8.dp))
                    inspector(); palette(); buttons()
                }
            }
        }
    }
}

/** Tool glyph to its key under `workshop.tools`. */
private val TOOLS = listOf('w' to "wicker", 't' to "timber", 'c' to "cobble", 'N' to "nook", 'K' to "kettle", '.' to "erase")

@Composable
private fun MetricPill(text: String) {
    Label(
        text,
        Modifier.clip(RoundedCornerShape(8.dp)).background(C.Paper).border(1.dp, C.SepiaBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        size = 12, bold = true, color = C.Ink,
    )
}

/**
 * Full Workshop Drafting Board (Plate 4):
 * - A-H column ticks along top + bold FRONT → banner on the enemy-facing right edge
 * - 1-9 row numbers along left + F Footing label
 * - Clickable cell grid with unified 2x2 Kettle Room & lantern-lit Hob Nooks overlay
 * - Pinpoint red dashed "Needs a wall" and cross-hatched "Nothing under it" overlays
 * - Dark stone Footing row resting on 3 planted brass-and-iron Stomper legs
 */
@Composable
private fun DraftingBoard(
    grid: FortGrid,
    cell: Dp,
    rooms: List<WorkshopDiag.RoomBox>,
    badMap: Map<Pair<Int, Int>, String>,
    roster: List<Pair<String, String>>,
    sprites: Sprites,
    onCell: (Int, Int) -> Unit,
) {
    val axisW = 24.dp
    val boardW = cell * grid.cols
    val boardH = cell * grid.rows

    Column(horizontalAlignment = Alignment.Start) {
        // Top header: A-H column ticks + bold FRONT → directional banner
        Row(verticalAlignment = Alignment.CenterVertically) {
            Spacer(Modifier.width(axisW))
            Row(Modifier.width(boardW), horizontalArrangement = Arrangement.SpaceBetween) {
                for (c in 0 until grid.cols) {
                    Box(Modifier.width(cell), contentAlignment = Alignment.Center) {
                        Label(WorkshopDiag.colLabel(c), size = 12, bold = true, color = C.InkSoft)
                    }
                }
            }
            Spacer(Modifier.width(6.dp))
            val frontLabel = Text.t("workshop.front")
            val frontHint = Text.t("workshop.front_hint")
            Label(
                "$frontLabel →",
                Modifier.clip(RoundedCornerShape(8.dp)).background(C.BrassHi).border(1.5.dp, C.Ink, RoundedCornerShape(8.dp))
                    .semantics { contentDescription = "$frontLabel. $frontHint" }
                    .padding(horizontal = 7.dp, vertical = 2.dp),
                size = 12, bold = true, color = C.Ink,
            )
        }

        Spacer(Modifier.height(3.dp))

        // Middle row: 9..1 row numbers + interactive cell grid + unified 2x2 room art + error overlays
        Row(verticalAlignment = Alignment.Top) {
            // Left row coordinates (9 down to 1, plus F for Footing)
            Column(Modifier.width(axisW), horizontalAlignment = Alignment.CenterHorizontally) {
                for (r in grid.rows - 1 downTo 0) {
                    Box(Modifier.height(cell), contentAlignment = Alignment.Center) {
                        Label("${r + 1}", size = 12, bold = true, color = C.InkSoft)
                    }
                }
                Box(Modifier.height(cell * 0.52f), contentAlignment = Alignment.Center) {
                    Label("F", size = 11, bold = true, color = C.Ink)
                }
            }

            Column {
                // Interactive fort grid + non-intercepting unified room & diagnostic layers
                Box(Modifier.size(boardW, boardH).border(2.dp, C.Ink)) {
                    // Layer 1: Base interactive cells (every cell remains clickable & TalkBack-accessible)
                    Column {
                        for (r in grid.rows - 1 downTo 0) {
                            Row {
                                for (c in 0 until grid.cols) {
                                    val ch = grid[c, r]
                                    val colLetter = WorkshopDiag.colLabel(c)
                                    val name = when (ch) {
                                        'w' -> Text.t("workshop.tools.wicker"); 't' -> Text.t("workshop.tools.timber"); 'c' -> Text.t("workshop.tools.cobble")
                                        'K' -> Text.t("workshop.kettle_room"); in '1'..'5' -> Text.t("workshop.nook", "n" to (ch - '0')); else -> ""
                                    }
                                    val badTag = badMap[c to r]
                                    Box(
                                        Modifier.size(cell)
                                            .background(cellColor(ch))
                                            .border(0.6.dp, C.SepiaBorder.copy(alpha = 0.45f))
                                            .clickable { onCell(c, r) }
                                            .semantics {
                                                contentDescription = when {
                                                    badTag != null -> Text.t("a11y.workshop_cell_bad", "col" to colLetter, "row" to r + 1, "what" to name.ifEmpty { Text.t("a11y.workshop_cell_empty", "col" to colLetter, "row" to r + 1) }, "problem" to badTag)
                                                    name.isEmpty() -> Text.t("a11y.workshop_cell_empty", "col" to colLetter, "row" to r + 1)
                                                    else -> Text.t("a11y.workshop_cell", "col" to colLetter, "row" to r + 1, "what" to name)
                                                }
                                            },
                                    ) {
                                        // Subtle plank / stone grain lines on material blocks
                                        if (ch == 'w' || ch == 't' || ch == 'c') {
                                            BlockCellTexture(ch, Modifier.fillMaxSize())
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Layer 2: Unified 2x2 Kettle Room & unified 2x2 lantern-lit Hob Nooks (non-clickable visual overlay)
                    for (rm in rooms) {
                        val offsetX = cell * rm.c
                        val offsetY = cell * (grid.rows - 2 - rm.r)
                        val roomSize = cell * 2
                        if (rm.glyph == 'K') {
                            UnifiedKettleRoom(Modifier.offset(x = offsetX, y = offsetY).size(roomSize).clearAndSetSemantics { })
                        } else {
                            val idx = (rm.glyph - '1').coerceAtLeast(0)
                            val hobPair = roster.getOrNull(idx) ?: ("" to Text.t("workshop.nook", "n" to (rm.glyph - '0')))
                            UnifiedNookRoom(
                                nookNum = rm.glyph - '0',
                                hobId = hobPair.first,
                                hobName = hobPair.second,
                                sprites = sprites,
                                modifier = Modifier.offset(x = offsetX, y = offsetY).size(roomSize).clearAndSetSemantics { },
                            )
                        }
                    }

                    // Layer 3: Pinpoint diagnostic error overlays ("Needs a wall" dashed red on empty, "Nothing under it" cross-hatch on occupied)
                    for ((coord, tag) in badMap) {
                        val (c, r) = coord
                        val ch = grid[c, r]
                        val offsetX = cell * c
                        val offsetY = cell * (grid.rows - 1 - r)
                        DiagnosticCellOverlay(
                            isEmpty = ch == '.',
                            tag = tag,
                            modifier = Modifier.offset(x = offsetX, y = offsetY).size(cell).clearAndSetSemantics { },
                        )
                    }
                }

                // Dark stone Footing row
                Box(Modifier.width(boardW).height(cell * 0.52f).border(2.dp, C.Ink).background(Color(0xFF4B433E))) {
                    Canvas(Modifier.fillMaxSize()) {
                        val sw = 1.2.dp.toPx()
                        val colW = size.width / grid.cols
                        for (i in 1 until grid.cols) {
                            drawLine(C.Ink, Offset(i * colW, 0f), Offset(i * colW, size.height), sw)
                        }
                        drawLine(Color(0xFF6B6059), Offset(0f, 2.dp.toPx()), Offset(size.width, 2.dp.toPx()), sw)
                    }
                }

                // 3 Planted Brass-and-Iron Stomper Legs beneath the Footing row (Plate 4)
                Canvas(Modifier.width(boardW).height(cell * 0.72f)) {
                    val w = size.width; val h = size.height
                    val sw = 1.6.dp.toPx()
                    // Lush meadow ground line
                    drawRect(C.Grass, Offset(0f, h * 0.76f), Size(w, h * 0.24f))
                    drawLine(C.Ink, Offset(0f, h * 0.76f), Offset(w, h * 0.76f), sw)
                    for (frac in floatArrayOf(0.18f, 0.50f, 0.82f)) {
                        val lx = w * frac
                        // Upper strut
                        drawRect(C.FlattenerDark, Offset(lx - 5.dp.toPx(), 0f), Size(10.dp.toPx(), h * 0.34f))
                        drawRect(C.Ink, Offset(lx - 5.dp.toPx(), 0f), Size(10.dp.toPx(), h * 0.34f), style = Stroke(sw))
                        // Brass knee rivet
                        drawCircle(C.BrassMid, 6.dp.toPx(), Offset(lx, h * 0.36f))
                        drawCircle(C.Ink, 6.dp.toPx(), Offset(lx, h * 0.36f), style = Stroke(sw))
                        // Piston rod
                        drawRect(C.BrassLo, Offset(lx - 3.dp.toPx(), h * 0.42f), Size(6.dp.toPx(), h * 0.30f))
                        drawRect(C.Ink, Offset(lx - 3.dp.toPx(), h * 0.42f), Size(6.dp.toPx(), h * 0.30f), style = Stroke(sw))
                        // Planted iron boot pad
                        drawRoundRect(
                            C.FlattenerDark,
                            Offset(lx - 11.dp.toPx(), h * 0.64f),
                            Size(22.dp.toPx(), h * 0.18f),
                            CornerRadius(3.dp.toPx(), 3.dp.toPx()),
                        )
                        drawRoundRect(
                            C.Ink,
                            Offset(lx - 11.dp.toPx(), h * 0.64f),
                            Size(22.dp.toPx(), h * 0.18f),
                            CornerRadius(3.dp.toPx(), 3.dp.toPx()),
                            style = Stroke(sw),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BlockCellTexture(ch: Char, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width; val h = size.height
        val sw = 1.dp.toPx()
        when (ch) {
            'w' -> { // Woven wicker diagonals
                drawLine(Color(0x558C5A14), Offset(0f, h * 0.33f), Offset(w, h * 0.33f), sw)
                drawLine(Color(0x558C5A14), Offset(0f, h * 0.67f), Offset(w, h * 0.67f), sw)
                drawLine(Color(0x448C5A14), Offset(w * 0.5f, 0f), Offset(w * 0.5f, h), sw)
            }
            't' -> { // Timber plank seams & rivets
                drawLine(Color(0x664A2C16), Offset(0f, h * 0.5f), Offset(w, h * 0.5f), sw)
                drawCircle(Color(0x882C221E), 1.4.dp.toPx(), Offset(w * 0.18f, h * 0.25f))
                drawCircle(Color(0x882C221E), 1.4.dp.toPx(), Offset(w * 0.82f, h * 0.75f))
            }
            'c' -> { // Cobble stone courses
                drawLine(Color(0x66524E4A), Offset(0f, h * 0.5f), Offset(w, h * 0.5f), sw)
                drawLine(Color(0x66524E4A), Offset(w * 0.5f, 0f), Offset(w * 0.5f, h * 0.5f), sw)
                drawLine(Color(0x66524E4A), Offset(w * 0.25f, h * 0.5f), Offset(w * 0.25f, h), sw)
            }
        }
    }
}

/** Single unified 2x2 Kettle Room with glowing copper boiler, teal core, and descending steam pipe. */
@Composable
private fun UnifiedKettleRoom(modifier: Modifier) {
    Box(modifier.background(C.NookBack).border(1.5.dp, C.Ink), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width; val h = size.height
            val cx = w * 0.5f; val cy = h * 0.46f
            val r = size.minDimension * 0.28f
            val sw = 1.6.dp.toPx()
            // Warm boiler glow
            drawCircle(C.Kettle.copy(alpha = 0.22f), r * 1.55f, Offset(cx, cy))
            // Brass steam conduit pipe down to Footing
            drawRect(C.BrassLo, Offset(cx - 4.dp.toPx(), cy + r * 0.6f), Size(8.dp.toPx(), h - (cy + r * 0.6f)))
            drawRect(C.Ink, Offset(cx - 4.dp.toPx(), cy + r * 0.6f), Size(8.dp.toPx(), h - (cy + r * 0.6f)), style = Stroke(sw * 0.8f))
            // Copper boiler drum + brass strap
            drawCircle(Color(0xFFD97834), r, Offset(cx, cy))
            drawRect(C.BrassMid, Offset(cx - r * 0.92f, cy - r * 0.20f), Size(r * 1.84f, r * 0.40f))
            drawCircle(C.Ink, r, Offset(cx, cy), style = Stroke(sw))
            // Glowing Heartkettle core
            drawCircle(C.Kettle, r * 0.44f, Offset(cx, cy))
            drawCircle(C.Ink, r * 0.44f, Offset(cx, cy), style = Stroke(sw * 0.7f))
        }
        Label(
            Text.t("workshop.tools.kettle"),
            Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp)
                .clip(RoundedCornerShape(4.dp)).background(C.Paper.copy(alpha = 0.92f))
                .padding(horizontal = 4.dp, vertical = 1.dp),
            size = 10, bold = true, color = C.Ink, maxLines = 1,
        )
    }
}

/** Single unified 2x2 lantern-lit Hob Nook with dark Loophole arch on enemy-facing right edge & Hob portrait. */
@Composable
private fun UnifiedNookRoom(nookNum: Int, hobId: String, hobName: String, sprites: Sprites, modifier: Modifier) {
    Box(modifier.background(C.NookBack).border(1.5.dp, C.Ink)) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width; val h = size.height
            // Warm amber ceiling lantern glow
            drawCircle(C.LanternGlow, size.minDimension * 0.44f, Offset(w * 0.46f, h * 0.42f))
            drawCircle(C.BrassHi, 3.dp.toPx(), Offset(w * 0.46f, h * 0.14f))
            // Dark Loophole firing arch on the right (FRONT → enemy-facing) edge
            val lhW = 8.dp.toPx(); val lhH = 18.dp.toPx()
            drawRoundRect(
                Color(0xFF1A120F),
                Offset(w - lhW - 1.dp.toPx(), h * 0.34f),
                Size(lhW, lhH),
                CornerRadius(4.dp.toPx(), 4.dp.toPx()),
            )
            drawRoundRect(
                C.BrassLo,
                Offset(w - lhW - 1.dp.toPx(), h * 0.34f),
                Size(lhW, lhH),
                CornerRadius(4.dp.toPx(), 4.dp.toPx()),
                style = Stroke(1.2.dp.toPx()),
            )
        }
        Column(Modifier.fillMaxSize().padding(3.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(
                Modifier.size(32.dp).clip(CircleShape).background(C.Cream).border(1.5.dp, C.Blue, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (!SpriteImage(sprites, "portrait_${Sprites.hobKey(hobId)}_blue", Modifier.fillMaxSize().padding(2.dp))) {
                    Label("$nookNum", size = 14, bold = true, color = C.Ink)
                }
            }
            Spacer(Modifier.height(2.dp))
            Label(
                "$nookNum $hobName",
                Modifier.clip(RoundedCornerShape(4.dp)).background(C.Paper.copy(alpha = 0.94f))
                    .padding(horizontal = 4.dp, vertical = 1.dp),
                size = 10, bold = true, color = C.Ink, maxLines = 1,
            )
        }
    }
}

/** Pinpoint error overlay: dashed red "Needs a wall" on empty cells, cross-hatched red "Nothing under it" on occupied blocks. */
@Composable
private fun DiagnosticCellOverlay(isEmpty: Boolean, tag: String, modifier: Modifier) {
    Box(
        modifier
            .background(if (isEmpty) C.BadBg.copy(alpha = 0.85f) else C.BadBorder.copy(alpha = 0.25f))
            .drawBehind {
                val sw = 2.dp.toPx()
                if (isEmpty) {
                    drawRoundRect(
                        color = C.BadBorder,
                        topLeft = Offset(sw / 2f, sw / 2f),
                        size = Size((size.width - sw).coerceAtLeast(1f), (size.height - sw).coerceAtLeast(1f)),
                        cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx()),
                        style = Stroke(width = sw, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
                    )
                } else {
                    // Diagonal red cross-hatching for floating/unsupported blocks
                    val step = size.minDimension * 0.35f
                    drawLine(C.BadBorder, Offset(0f, size.height), Offset(size.width, 0f), sw * 0.8f, StrokeCap.Round)
                    drawLine(C.BadBorder, Offset(0f, step), Offset(step, 0f), sw * 0.8f, StrokeCap.Round)
                    drawLine(C.BadBorder, Offset(size.width - step, size.height), Offset(size.width, size.height - step), sw * 0.8f, StrokeCap.Round)
                    drawRect(C.BadBorder, style = Stroke(sw))
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Label(
            tag,
            Modifier.clip(RoundedCornerShape(4.dp)).background(C.BadBg).border(1.dp, C.BadBorder, RoundedCornerShape(4.dp))
                .padding(horizontal = 2.dp, vertical = 1.dp),
            size = 9, bold = true, color = C.BadInk, align = TextAlign.Center, maxLines = 2,
        )
    }
}

private fun cellColor(ch: Char): Color = when (ch) {
    'w' -> Color(0xFFD9B36C); 't' -> Color(0xFFB57642); 'c' -> Color(0xFF9C9892)
    'K' -> C.NookBack; in '1'..'5' -> C.NookBack; else -> Color(0xFFF6EFE0)
}

private fun toolSwatch(ch: Char): Color = when (ch) {
    'w' -> Color(0xFFD9B36C); 't' -> Color(0xFFB57642); 'c' -> Color(0xFF9C9892)
    'K' -> C.Kettle; 'N' -> C.BlueLight; else -> C.BadBg
}

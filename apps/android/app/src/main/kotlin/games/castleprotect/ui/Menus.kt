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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import games.castleprotect.core.Cmd
import games.castleprotect.core.Phase
import games.castleprotect.game.GameSession
import games.castleprotect.game.Screen

@Composable
private fun Page(title: String, session: GameSession, back: Boolean = true, trailing: (@Composable () -> Unit)? = null, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().background(C.Parchment).safeDrawingPadding()) {
        Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            if (back) CastleButton("‹", { session.goBack() }, Modifier.size(48.dp), color = C.Cream, description = "Back", size = 22, pad = androidx.compose.foundation.layout.PaddingValues(0.dp))
            Label(title, Modifier.weight(1f).padding(horizontal = 10.dp).semantics { heading() }, size = 20, bold = true, maxLines = 1)
            trailing?.invoke()
        }
        Box(Modifier.weight(1f).fillMaxWidth()) { content() }
    }
}

// ---- Title ---------------------------------------------------------------------

@Composable
fun TitleScreen(session: GameSession) {
    Box(Modifier.fillMaxSize().background(C.Sky).safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp).widthIn(max = 380.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Label("CASTLE", Modifier.semantics { contentDescription = "Castle Protect"; heading() }, size = 52, bold = true, color = C.Ink)
            Label("PROTECT", size = 40, bold = true, color = C.Blue)
            Label("Stack it. Lob it. Un-flatten the Brickabrac.", Modifier.padding(top = 4.dp, bottom = 22.dp), size = 14, color = C.InkSoft, align = TextAlign.Center)
            if (session.canResume) {
                val h = session.hud.collectAsState().value
                CastleButton("Carry on", { session.resume() }, Modifier.fillMaxWidth().height(60.dp), size = 20, description = "Carry on. Round ${h.round}, ${h.names.getOrElse(h.activeSide) { "" }} to play")
                Spacer(Modifier.height(10.dp))
            }
            CastleButton("Play", {
                // First run: straight into level 1-1, so the first shot is seconds away.
                if (!session.settings.seenIntro) { session.settings.seenIntro = true; session.go(Screen.MAP); session.openLevel("1-1"); session.fight() } else session.go(Screen.MAP)
            }, Modifier.fillMaxWidth().height(60.dp), size = 20, color = if (session.canResume) C.Cream else C.Gold)
            Spacer(Modifier.height(10.dp))
            CastleButton("2 Players", { session.go(Screen.DUEL_SETUP) }, Modifier.fillMaxWidth(), color = C.Cream, description = "2 Players. Couch Duel on one device")
            Spacer(Modifier.height(10.dp))
            CastleButton("Skirmish", { session.go(Screen.SKIRMISH) }, Modifier.fillMaxWidth(), color = C.Cream)
            Spacer(Modifier.height(10.dp))
            CastleButton("Settings", { session.go(Screen.SETTINGS) }, Modifier.fillMaxWidth(), color = C.Cream)
            Label("Free forever. No ads. Nothing to buy.", Modifier.padding(top = 18.dp), size = 12, color = C.InkSoft)
        }
    }
}

// ---- Brickabrac Map, Region 1 ----------------------------------------------------

@Composable
fun MapScreen(session: GameSession) {
    val epoch = session.menuEpoch
    val camp = remember(epoch) { session.campaign() }
    val done = camp.levels.count { it.state == "done" }
    Page("${camp.region}  $done/${camp.levels.size}", session, trailing = {
        Label("⚑ ${camp.pennants}/${camp.pennantsMax}", Modifier.padding(end = 10.dp).semantics { contentDescription = "Pennants ${camp.pennants} of ${camp.pennantsMax}" }, size = 14, bold = true)
        Label("◎ ${camp.buttons}", Modifier.padding(end = 8.dp).semantics { contentDescription = "Buttons ${camp.buttons}" }, size = 14, bold = true)
        CastleButton("⚙", { session.go(Screen.SETTINGS) }, Modifier.size(48.dp), color = C.Cream, description = "Settings", pad = androidx.compose.foundation.layout.PaddingValues(0.dp))
    }) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val tall = maxWidth < maxHeight
            val nodes: @Composable () -> Unit = {
                camp.levels.forEachIndexed { i, lv ->
                    val locked = lv.state == "locked"
                    val grand = lv.kind == "grand_fort"
                    val stateWord = when (lv.state) { "done" -> "done, ${lv.pennants} of 3 Pennants"; "next" -> "next"; "locked" -> "locked"; else -> "open" }
                    val wobble = if (i % 2 == 0) (-14).dp else 14.dp
                    Column(
                        Modifier.then(if (tall) Modifier.offset(x = wobble * 3) else Modifier.offset(y = wobble * 2)).padding(6.dp).widthIn(min = 76.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(enabled = !locked, onClickLabel = "open level") { session.openLevel(lv.id) }
                            .semantics(mergeDescendants = true) { contentDescription = "Level ${lv.id}, ${lv.name}, $stateWord" }
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.size(if (grand) 72.dp else 56.dp).clip(if (grand) RoundedCornerShape(12.dp) else CircleShape)
                            .background(when (lv.state) { "done" -> C.Grass; "next" -> C.Gold; "locked" -> C.Locked; else -> C.Paper })
                            .border(if (lv.state == "next") 4.dp else 2.dp, C.Ink, if (grand) RoundedCornerShape(12.dp) else CircleShape), contentAlignment = Alignment.Center) {
                            Label(if (grand) "GRAND\nFORT" else lv.id.substringAfter('-'), size = if (grand) 11 else 20, bold = true, align = TextAlign.Center)
                        }
                        Label((0 until 3).joinToString("") { if (it < lv.pennants) "★" else "☆" }, size = 14, color = if (locked) C.Locked else C.Ink)
                        Label(lv.name, Modifier.widthIn(max = 96.dp), size = 11, color = C.InkSoft, align = TextAlign.Center, maxLines = 2)
                    }
                }
            }
            Column(Modifier.fillMaxSize()) {
                if (tall) Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) { nodes() }
                else Row(Modifier.weight(1f).fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 24.dp), verticalAlignment = Alignment.CenterVertically) { nodes() }
                // Dock. It grows as things open; Workshop and Tinker Tree arrive after v0.1.
                Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (session.canResume) CastleButton("Carry on", { session.resume() })
                    if (camp.skirmishOpen) CastleButton("Skirmish", { session.go(Screen.SKIRMISH) }, color = C.Cream)
                    Spacer(Modifier.weight(1f))
                    CastleButton("●◆ 2 Players", { session.go(Screen.DUEL_SETUP) }, Modifier.widthIn(min = 120.dp), color = C.Cream, description = "2 Players. Couch Duel on one device")
                }
            }
        }
    }
}

// ---- Pre-battle, with the Rummage draft strip --------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PreBattleScreen(session: GameSession) {
    val hud by session.hud.collectAsState()
    val info = session.levelInfo.takeIf { hud.mode == "campaign" }
    var focus by remember { mutableStateOf<String?>(null) }
    val title = when {
        info != null -> "${info.id}  ${info.name}"
        hud.mode == "duel" -> "Couch Duel"
        else -> "Skirmish"
    }
    Page(title, session) {
        Column(Modifier.fillMaxSize()) {
            FlowRow(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // The level and the Rival
                Plate(Modifier.widthIn(min = 280.dp).weight(1f)) {
                    Label(if (info != null) "${info.kind}   Round cap ${info.roundCap}   ${info.wind}" else "Round cap ${hud.roundCap}", size = 13, color = C.InkSoft)
                    Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(20.dp).clip(RoundedCornerShape(3.dp)).background(C.Orange).border(2.dp, C.Ink, RoundedCornerShape(3.dp)))
                        Label("  ${hud.names.getOrElse(1) { "Rival" }}" + if (!hud.humans.getOrElse(1) { false }) " (AI)" else "", size = 17, bold = true)
                        if (info != null) Label("   Aim ${info.rivalAim} of 5", size = 13, color = C.InkSoft)
                    }
                    if (info != null && info.habit.isNotEmpty()) Label("◆ “${info.habit}”", Modifier.padding(top = 4.dp).clip(RoundedCornerShape(8.dp)).background(C.Cream).padding(6.dp), size = 13)
                    val crew = hud.hobs.getOrElse(1) { emptyList() }
                    Label("Their crew: " + crew.joinToString(", ") { it.cls }, Modifier.padding(top = 6.dp), size = 13)
                    if (info != null && info.goals.isNotEmpty()) {
                        Label("Goals", Modifier.padding(top = 8.dp).semantics { heading() }, size = 13, bold = true)
                        for ((g, ok) in info.goals) Label((if (ok) "★ " else "☆ ") + g, Modifier.semantics { contentDescription = "$g, ${if (ok) "earned" else "not yet earned"}" }, size = 13)
                    }
                }
                // Your side
                Plate(Modifier.widthIn(min = 280.dp).weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(20.dp).clip(CircleShape).background(C.Blue).border(2.dp, C.Ink, CircleShape))
                        Label("  ${hud.names.getOrElse(0) { "You" }}", size = 17, bold = true)
                    }
                    Label("Crew", Modifier.padding(top = 6.dp).semantics { heading() }, size = 13, bold = true)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (h in hud.hobs.getOrElse(0) { emptyList() }) {
                            Column(Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).background(C.Cream).border(2.dp, C.Blue, RoundedCornerShape(12.dp)).semantics(mergeDescendants = true) { contentDescription = "${h.name}, ${h.cls}" }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Label(h.cls.take(1), size = 20, bold = true); Label(h.name, size = 10, maxLines = 1)
                            }
                        }
                    }
                    Label("Blueprint: Oak Lump   Doodads: none yet", Modifier.padding(top = 8.dp), size = 12, color = C.InkSoft)
                }
                // The draft strip. Levels and modes with no draft do not show it at all.
                hud.draft?.let { d ->
                    Plate(Modifier.fillMaxWidth()) {
                        val both = hud.humans.all { it }
                        val who = if (both) hud.names.getOrElse(d.turn) { "" } else "you"
                        val mine = d.hands.getOrElse(0) { emptyList() }; val theirs = d.hands.getOrElse(1) { emptyList() }
                        val full = mine.size >= d.picksEach && theirs.size >= d.picksEach
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Label("Rummage", Modifier.semantics { heading() }, size = 15, bold = true)
                            Label(if (full) "   all picked" else "   $who to pick, ${d.picksEach} each", Modifier.weight(1f), size = 13, color = C.InkSoft)
                            CastleButton("Quick Pick", { session.send(Cmd.QUICK_PICK) }, color = C.Cream, size = 13, enabled = !full)
                        }
                        Row(Modifier.padding(top = 6.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            for (chip in d.pool) {
                                val taken = chip.takenBy >= 0
                                val wish = d.wish == chip.id && !taken
                                val by = if (taken) "taken by ${hud.names.getOrElse(chip.takenBy) { "" }}" else if (focus == chip.id) "tap again to take" else "tap to look"
                                Column(Modifier.size(width = 84.dp, height = 76.dp).alpha(if (taken) 0.55f else 1f).clip(RoundedCornerShape(12.dp))
                                    .background(if (taken) (if (chip.takenBy == 0) C.BlueLight else C.OrangeLight) else if (focus == chip.id) C.Gold else C.Cream)
                                    .border(2.dp, C.Ink, RoundedCornerShape(12.dp))
                                    // Tap a chip to focus it; tap it again to take it.
                                    .clickable(enabled = !taken && !full) { if (focus == chip.id) { session.send(Cmd.draftPick(chip.id)); focus = null } else focus = chip.id }
                                    .semantics(mergeDescendants = true) { contentDescription = "${chip.name}, weight ${chip.weight}, best with ${chip.bestWith}. ${chip.hint} $by" + if (wish) ". The Rival wants this one" else "" }
                                    .padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                    Label(chip.name, size = 12, bold = true, align = TextAlign.Center, maxLines = 2)
                                    Label("⚙".repeat(chip.weight) + if (wish) "  ◆" else "", size = 11, color = if (wish) C.Orange else C.Ink)
                                }
                            }
                        }
                        val f = d.pool.firstOrNull { it.id == focus }
                        Label(if (f != null) "“${f.hint}”  Best with ${f.bestWith}" else " ", Modifier.padding(top = 4.dp), size = 13)
                        fun names(ids: List<String>) = ids.joinToString(", ") { id -> d.pool.firstOrNull { it.id == id }?.name ?: id }.ifEmpty { "none yet" }
                        Label("${if (both) hud.names.getOrElse(0) { "" } else "Yours"}: ${names(mine)}", size = 13, color = C.Blue, bold = true)
                        Label("${if (both) hud.names.getOrElse(1) { "" } else "Theirs"}: ${names(theirs)}", size = 13, color = C.Orange, bold = true)
                    }
                }
            }
            // One tap to fight. If the draft is not done, Fight quick-picks what is left.
            Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(10.dp), horizontalArrangement = Arrangement.End) {
                CastleButton("FIGHT", { session.fight() }, Modifier.size(width = 160.dp, height = 56.dp), size = 20, enabled = hud.phase == Phase.PRE)
            }
        }
    }
}

// ---- Results -----------------------------------------------------------------------

@Composable
fun ResultsScreen(session: GameSession) {
    val hud by session.hud.collectAsState()
    val r = hud.result
    val winner = r?.winner ?: -1
    val duel = hud.humans.all { it }
    val won = winner >= 0 && hud.humans.getOrElse(winner) { false }
    val head = when { winner < 0 -> "Draw"; duel -> "${hud.names.getOrElse(winner) { "" }} wins"; won -> "Victory"; else -> "Flattened" }
    val reason = when (r?.reason) { "kettle_pop" -> "Kettle Pop"; "clean_sweep" -> "Clean Sweep"; "squall" -> "Sudden Squall"; else -> r?.reason ?: "" }
    Box(Modifier.fillMaxSize().background(if (winner == 1 && duel) C.OrangeLight else if (won) C.BlueLight else C.Parchment).safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Plate(Modifier.padding(16.dp).widthIn(max = 420.dp).verticalScroll(rememberScrollState()), pad = 20.dp) {
            Label(head, Modifier.fillMaxWidth().semantics { heading() }, size = 30, bold = true, align = TextAlign.Center, color = if (winner >= 0) C.side(winner) else C.Ink)
            Label("$reason   Round ${hud.round}", Modifier.fillMaxWidth().padding(top = 2.dp), size = 14, color = C.InkSoft, align = TextAlign.Center)
            if (r != null && hud.mode == "campaign") {
                Label((0 until 3).joinToString(" ") { if (it < r.pennants) "★" else "☆" }, Modifier.fillMaxWidth().padding(top = 10.dp).semantics { contentDescription = "${r.pennants} of 3 Pennants" }, size = 40, color = C.GoldDark, align = TextAlign.Center)
                for ((g, ok) in r.goals) Label((if (ok) "★ " else "☆ ") + g, Modifier.semantics { contentDescription = "$g, ${if (ok) "earned" else "missed"}" }, size = 14)
                Label("Buttons +${r.buttons}", Modifier.padding(top = 8.dp), size = 15, bold = true)
            } else {
                Label("Kettles: ${hud.names.getOrElse(0) { "" }} ${hud.kettlePct.getOrElse(0) { 0 }}%, ${hud.names.getOrElse(1) { "" }} ${hud.kettlePct.getOrElse(1) { 0 }}%", Modifier.fillMaxWidth().padding(top = 12.dp), size = 14, align = TextAlign.Center)
            }
            Spacer(Modifier.height(16.dp))
            if (session.canRematch) CastleButton(if (hud.mode == "campaign") (if (won) "Play again" else "Try again") else "Rematch", { session.rematch() }, Modifier.fillMaxWidth(), color = if (won && hud.mode == "campaign") C.Cream else C.Gold)
            Spacer(Modifier.height(8.dp))
            CastleButton(if (hud.mode == "campaign") "Back to the map" else "Done", { session.goBack() }, Modifier.fillMaxWidth(), color = if (won && hud.mode == "campaign") C.Gold else C.Cream)
        }
    }
}

// ---- Skirmish ----------------------------------------------------------------------

@Composable
fun SkirmishScreen(session: GameSession) {
    var rounds by rememberSaveable { mutableIntStateOf(1) }
    var wind by rememberSaveable { mutableIntStateOf(1) }
    var draft by rememberSaveable { mutableIntStateOf(0) }
    Page("Skirmish", session) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
            Plate(Modifier.fillMaxWidth().widthIn(max = 560.dp)) {
                Label("One battle against the AI on a fresh map.", size = 14, color = C.InkSoft)
                Choice("Rival", listOf("Cozy", "Fair", "Stubborn"), session.settings.preset) { session.settings.preset = it }
                Choice("Rounds", listOf("10", "15", "20"), rounds) { rounds = it }
                Choice("Wind", listOf("Calm", "Light", "Gusty"), wind) { wind = it }
                Choice("Shells", listOf("Draft", "Plain only"), draft) { draft = it }
                Spacer(Modifier.height(10.dp))
                CastleButton("Next", {
                    session.startPre(Cmd.newBattle("skirmish", preset = session.settings.presetKey, rounds = listOf(10, 15, 20)[rounds], wind = listOf("calm", "light", "gusty")[wind], draft = draft == 0))
                }, Modifier.fillMaxWidth().height(56.dp), size = 18)
            }
        }
    }
}

// ---- Couch Duel setup ----------------------------------------------------------------

private val duelNames = listOf("Mabel", "Otis", "Pru", "Bert", "Dot", "Alf", "Ivy", "Stan", "Nell", "Gus")

@Composable
fun DuelSetupScreen(session: GameSession) {
    var p1 by rememberSaveable { mutableStateOf("Mabel") }
    var p2 by rememberSaveable { mutableStateOf("Otis") }
    var rounds by rememberSaveable { mutableIntStateOf(1) }
    var wind by rememberSaveable { mutableIntStateOf(1) }
    var draft by rememberSaveable { mutableIntStateOf(0) }
    var seats by rememberSaveable { mutableIntStateOf(0) }
    Page("Couch Duel", session, trailing = { CastleButton("Swap sides", { val t = p1; p1 = p2; p2 = t }, color = C.Cream, size = 13) }) {
        Column(Modifier.fillMaxSize()) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Label("2 players, 1 device. Free forever, no ads.", size = 13, color = C.InkSoft)
                BoxWithConstraints {
                    val wide = maxWidth > 560.dp
                    val a: @Composable (Modifier) -> Unit = { m -> PlayerPlate(m, 0, p1, { p1 = it }) { p1 = duelNames.filter { it != p2 }.random() } }
                    val b: @Composable (Modifier) -> Unit = { m -> PlayerPlate(m, 1, p2, { p2 = it }) { p2 = duelNames.filter { it != p1 }.random() } }
                    if (wide) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.weight(1f)); b(Modifier.weight(1f)) }
                    else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.fillMaxWidth()); b(Modifier.fillMaxWidth()) }
                }
                Plate(Modifier.fillMaxWidth()) {
                    Choice("Rounds", listOf("10", "15", "20"), rounds) { rounds = it }
                    Choice("Wind", listOf("Calm", "Light", "Gusty"), wind) { wind = it }
                    Choice("Shells", listOf("Draft", "Plain only"), draft) { draft = it }
                    Choice("Seats", listOf("Side by side", "One seat"), seats) { seats = it }
                }
            }
            Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(10.dp), horizontalArrangement = Arrangement.End) {
                CastleButton("Next", {
                    session.startPre(Cmd.newBattle("duel", names = listOf(p1.ifBlank { "Player 1" }, p2.ifBlank { "Player 2" }), seats = if (seats == 0) "side_by_side" else "one_seat",
                        rounds = listOf(10, 15, 20)[rounds], wind = listOf("calm", "light", "gusty")[wind], draft = draft == 0))
                }, Modifier.size(width = 160.dp, height = 56.dp), size = 18)
            }
        }
    }
}

@Composable
private fun PlayerPlate(modifier: Modifier, side: Int, name: String, onName: (String) -> Unit, dice: () -> Unit) {
    val shape = if (side == 0) CircleShape else RoundedCornerShape(3.dp)
    Plate(modifier.border(4.dp, C.side(side), PlateShape)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(22.dp).clip(shape).background(C.side(side)).border(2.dp, C.Ink, shape))
            Label("  PLAYER ${side + 1}", Modifier.semantics { heading() }, size = 14, bold = true, color = C.side(side))
            Label(if (side == 0) "   left fort, blue, round" else "   right fort, orange, diamond", size = 11, color = C.InkSoft)
        }
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(name, { onName(it.take(12)) }, Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(10.dp)).background(Color.White).border(2.dp, C.Ink, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 12.dp).semantics { contentDescription = "Player ${side + 1} name" },
                singleLine = true, textStyle = TextStyle(color = C.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold))
            Spacer(Modifier.width(8.dp))
            CastleButton("⚄", dice, Modifier.size(48.dp), color = C.Cream, description = "Random name for player ${side + 1}", pad = androidx.compose.foundation.layout.PaddingValues(0.dp), size = 20)
        }
    }
}

// ---- Settings ------------------------------------------------------------------------

@Composable
fun SettingsScreen(session: GameSession) {
    Page("Settings", session) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
            Plate(Modifier.fillMaxWidth().widthIn(max = 640.dp)) { SettingsBody(session) }
        }
    }
}

/** Shared by the Settings screen and the Pause card. Every change applies at once; there is no Apply button. */
@Composable
fun SettingsBody(session: GameSession) {
    val s = session.settings
    Section("Sound")
    Row(verticalAlignment = Alignment.CenterVertically) {
        Label("Sound", Modifier.width(72.dp), size = 14)
        Slider(s.sound.toFloat(), { s.sound = it.toInt() }, Modifier.weight(1f).semantics { contentDescription = "Sound volume"; stateDescription = "${s.sound} percent" }, valueRange = 0f..100f, onValueChangeFinished = { session.sfx.play("pick") })
        Label("${s.sound}", Modifier.width(36.dp), size = 14, align = TextAlign.End)
    }
    Toggle("Mute all", s.muteAll) { s.muteAll = it }
    Section("Controls")
    Choice("Rotation", listOf("Follow device", "Stay wide", "Stay tall"), s.rotation) { s.rotation = it }
    Choice("Drag mode", listOf("Pull-back", "Point"), if (s.pointMode) 1 else 0) { s.pointMode = it == 1 }
    Toggle("Quick Fire (lifting the finger fires)", s.quickFire) { s.quickFire = it }
    Toggle("Rival turns at 2x", s.rival2x) { s.rival2x = it }
    Toggle("Left-hand layout", s.leftHand) { s.leftHand = it }
    Toggle("Tap only (no hold to repeat)", s.tapOnly) { s.tapOnly = it }
    Section("Assists")
    Choice("Difficulty", listOf("Cozy", "Fair", "Stubborn"), s.preset) { s.preset = it }
    Section("Access")
    Choice("Text size", listOf("Small", "Normal", "Large"), s.textSize) { s.textSize = it }
    Choice("Haptics", listOf("Off", "Light", "Full"), s.haptics) { s.haptics = it; session.buzz(20) }
    Toggle("Reduce motion", s.reduceMotion) { s.reduceMotion = it }
    Section("About")
    Label("Free forever. No ads. Nothing to buy.", size = 14, bold = true)
    Label("Privacy: Data Not Collected.", size = 13)
    Label("Castle Protect v0.1, ${session.coreName}", size = 12, color = C.InkSoft)
}

@Composable
private fun Section(title: String) {
    Label(title, Modifier.padding(top = 12.dp, bottom = 2.dp).semantics { heading() }, size = 17, bold = true)
}

@Composable
private fun Toggle(label: String, on: Boolean, set: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(onClickLabel = "toggle") { set(!on) }.semantics(mergeDescendants = true) { stateDescription = if (on) "On" else "Off" }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Label(label, Modifier.weight(1f), size = 14)
        Switch(on, null)
    }
}

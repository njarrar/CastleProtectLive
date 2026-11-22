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
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
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
import kotlinx.coroutines.delay
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
            session.notice?.let { n ->
                Plate(Modifier.fillMaxWidth().padding(bottom = 12.dp).semantics { liveRegion = LiveRegionMode.Polite }, color = C.Cream) {
                    Label(n, size = 13)
                    CastleButton("OK", { session.notice = null }, Modifier.padding(top = 6.dp), color = C.Paper, size = 13)
                }
            }
            if (session.coreMissing) {
                Label("This build is missing its game engine and cannot start a battle. Please reinstall the app.", Modifier.padding(bottom = 12.dp), size = 14, color = C.Danger, align = TextAlign.Center)
            }
            if (session.canResume) {
                CastleButton(if (session.loading) "Loading..." else "Carry on", { if (!session.loading) session.resume() }, Modifier.fillMaxWidth().height(60.dp), size = 20, description = "Carry on the battle you left")
                Spacer(Modifier.height(10.dp))
            }
            CastleButton("Play", {
                session.firstTap()
                // First run: straight into level 1-1, so the first shot is seconds away.
                if (!session.settings.seenIntro && !session.canResume) { session.settings.seenIntro = true; session.go(Screen.MAP); session.openLevel("1-1"); session.fight() } else session.go(Screen.MAP)
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
    val levels = session.content.campaign
    val prog = session.progress
    // A level is done once won (Pennant 1); the first one not done is next; the rest wait.
    val firstOpen = levels.indexOfFirst { (prog[it.id] ?: 0) and 1 == 0 }
    val pennants = levels.sumOf { Integer.bitCount(prog[it.id] ?: 0) }
    val pennantsMax = levels.sumOf { it.pennants.size.coerceAtLeast(3) }
    val done = levels.count { (prog[it.id] ?: 0) and 1 != 0 }
    Page("Puddingstone Downs  $done/${levels.size}", session, trailing = {
        Label("⚑ $pennants/$pennantsMax", Modifier.padding(end = 10.dp).semantics { contentDescription = "Pennants $pennants of $pennantsMax" }, size = 14, bold = true)
        CastleButton("⚙", { session.go(Screen.SETTINGS) }, Modifier.size(48.dp), color = C.Cream, description = "Settings", pad = androidx.compose.foundation.layout.PaddingValues(0.dp))
    }) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val tall = maxWidth < maxHeight
            val nodes: @Composable () -> Unit = {
                levels.forEachIndexed { i, lv ->
                    val bits = prog[lv.id] ?: 0
                    val state = if (bits and 1 != 0) "done" else if (i == firstOpen) "next" else if (firstOpen >= 0 && i > firstOpen) "locked" else "open"
                    val got = Integer.bitCount(bits)
                    val locked = state == "locked"
                    val grand = lv.type == "grand_fort" || i == levels.size - 1
                    val stateWord = when (state) { "done" -> "done, $got of 3 Pennants"; "next" -> "next"; "locked" -> "locked"; else -> "open" }
                    val wobble = if (i % 2 == 0) (-14).dp else 14.dp
                    Column(
                        Modifier.then(if (tall) Modifier.offset(x = wobble * 3) else Modifier.offset(y = wobble * 2)).padding(6.dp).widthIn(min = 76.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(enabled = !locked && !session.coreMissing, onClickLabel = "open level") { session.openLevel(lv.id) }
                            .semantics(mergeDescendants = true) { contentDescription = "Level ${lv.id}, ${lv.name}, $stateWord" }
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.size(if (grand) 72.dp else 56.dp).clip(if (grand) RoundedCornerShape(12.dp) else CircleShape)
                            .background(when (state) { "done" -> C.Grass; "next" -> C.Gold; "locked" -> C.Locked; else -> C.Paper })
                            .border(if (state == "next") 4.dp else 2.dp, C.Ink, if (grand) RoundedCornerShape(12.dp) else CircleShape), contentAlignment = Alignment.Center) {
                            Label(if (grand) "GRAND\nFORT" else lv.id.substringAfter('-'), size = if (grand) 11 else 20, bold = true, align = TextAlign.Center)
                        }
                        Label((0 until 3).joinToString("") { if (bits and (1 shl it) != 0) "★" else "☆" }, size = 14, color = if (locked) C.Locked else C.Ink)
                        Label(lv.name, Modifier.widthIn(max = 96.dp), size = 11, color = C.InkSoft, align = TextAlign.Center, maxLines = 2)
                    }
                }
            }
            Column(Modifier.fillMaxSize()) {
                if (tall) Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) { nodes() }
                else Row(Modifier.weight(1f).fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 24.dp), verticalAlignment = Alignment.CenterVertically) { nodes() }
                // Dock. It grows as things open; Workshop and Tinker Tree arrive after v0.1.
                Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (session.canResume) CastleButton("Carry on", { if (!session.loading) session.resume() })
                    CastleButton("Skirmish", { session.go(Screen.SKIRMISH) }, color = C.Cream)
                    Spacer(Modifier.weight(1f))
                    CastleButton("●◆ 2 Players", { session.go(Screen.DUEL_SETUP) }, Modifier.widthIn(min = 120.dp), color = C.Cream, description = "2 Players. Couch Duel on one device")
                }
            }
        }
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
        "couch" -> "Couch Duel"
        else -> "Skirmish"
    }
    val draft = u.draft.takeIf { u.live && u.phase == Phase.DRAFT }
    Page(title, session) {
        Column(Modifier.fillMaxSize()) {
            FlowRow(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (info != null) Plate(Modifier.widthIn(min = 280.dp).weight(1f)) {
                    Label("${info.type.replaceFirstChar { it.uppercase() }}   Round cap ${info.roundCap}   ${info.windText}", size = 13, color = C.InkSoft)
                    if (spec?.kind == "campaign") {
                        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(20.dp).clip(RoundedCornerShape(3.dp)).background(C.Orange).border(2.dp, C.Ink, RoundedCornerShape(3.dp)))
                            Label("  ${info.rival} (AI)", size = 17, bold = true)
                            Label("   Aim ${info.rivalAim} of 5", size = 13, color = C.InkSoft)
                        }
                        if (info.habit.isNotEmpty()) Label("◆ “${info.habit}”", Modifier.padding(top = 4.dp).clip(RoundedCornerShape(8.dp)).background(C.Cream).padding(6.dp), size = 13)
                        Label("Their crew: " + info.rivalCrew.joinToString(", ") { content.hobName(it) }, Modifier.padding(top = 6.dp), size = 13)
                        if (info.pennants.isNotEmpty()) {
                            val bits = session.progress[info.id] ?: 0
                            Label("Pennants", Modifier.padding(top = 8.dp).semantics { heading() }, size = 13, bold = true)
                            info.pennants.forEachIndexed { i, g ->
                                val ok = bits and (1 shl i) != 0
                                Label((if (ok) "★ " else "☆ ") + g, Modifier.semantics { contentDescription = "$g, ${if (ok) "earned" else "not yet earned"}" }, size = 13)
                            }
                        }
                        if (info.note.isNotEmpty()) Label(info.note, Modifier.padding(top = 6.dp), size = 12, color = C.InkSoft)
                        if (draft == null) Choice("Help", listOf("None", "Some", "Lots"), session.settings.help) { session.settings.help = it; session.openSpecQuiet(session.campaignSpec(info.id)) }
                    }
                }
                // The Rummage. Fight quick-picks it, so opening it is optional.
                if (info?.rummage == true || draft != null) Plate(Modifier.fillMaxWidth()) {
                    if (draft == null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Label("Rummage", Modifier.semantics { heading() }, size = 15, bold = true)
                            Label("   Quick Pick is ready. Fight takes it as it is.", Modifier.weight(1f), size = 13, color = C.InkSoft)
                            CastleButton("Open", { session.openRummage() }, color = C.Cream, size = 13, enabled = !session.loading && !session.coreMissing, description = "Open the Rummage and pick shells yourself")
                        }
                    } else {
                        val both = u.hud.human(0) && u.hud.human(1)
                        val who = if (both) u.hud.names.getOrElse(draft.next) { "" } else "you"
                        val mine = draft.picks.getOrElse(0) { emptyList() }; val theirs = draft.picks.getOrElse(1) { emptyList() }
                        val full = mine.size >= draft.picksEach && theirs.size >= draft.picksEach
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Label("Rummage", Modifier.semantics { heading() }, size = 15, bold = true)
                            Label(if (full) "   all picked" else "   $who to pick, ${draft.picksEach} each", Modifier.weight(1f), size = 13, color = C.InkSoft)
                            CastleButton("Quick Pick", { session.send(Cmd.QUICK_PICK) }, color = C.Cream, size = 13, enabled = !full)
                        }
                        Row(Modifier.padding(top = 6.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            for (id in draft.pool) {
                                val name = content.shotName(id)
                                val wish = draft.wish == id
                                Column(Modifier.size(width = 84.dp, height = 76.dp).clip(RoundedCornerShape(12.dp))
                                    .background(if (focus == id) C.Gold else C.Cream)
                                    .border(2.dp, C.Ink, RoundedCornerShape(12.dp))
                                    // Tap a chip to look at it; tap it again to take it.
                                    .clickable(enabled = !full) { if (focus == id) { session.send(Cmd.pickShell(id)); focus = null } else focus = id }
                                    .semantics(mergeDescendants = true) { contentDescription = "$name. ${content.shotCard(id)} ${if (focus == id) "tap again to take" else "tap to look"}" + if (wish) ". The Rival wants this one" else "" }
                                    .padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                    Label(name, size = 12, bold = true, align = TextAlign.Center, maxLines = 2)
                                    if (wish) Label("◆", size = 11, color = C.Orange)
                                }
                            }
                        }
                        Label(focus?.let { "“${content.shotCard(it)}”" } ?: " ", Modifier.padding(top = 4.dp), size = 13)
                        fun names(ids: List<String>) = ids.joinToString(", ") { content.shotName(it) }.ifEmpty { "none yet" }
                        Label("${if (both) u.hud.names.getOrElse(0) { "" } else "Yours"}: ${names(mine)}", size = 13, color = C.Blue, bold = true)
                        Label("${if (both) u.hud.names.getOrElse(1) { "" } else "Theirs"}: ${names(theirs)}", size = 13, color = C.Orange, bold = true)
                    }
                }
            }
            // One tap to fight.
            Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(10.dp), horizontalArrangement = Arrangement.End) {
                CastleButton(if (session.loading) "..." else "FIGHT", { session.fight() }, Modifier.size(width = 160.dp, height = 56.dp), size = 20, enabled = spec != null && !session.loading && !session.coreMissing)
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
    val head = when {
        winner < 0 -> "Draw"
        duel -> "${u.hud.names.getOrElse(winner) { "" }} wins"
        won -> when (r?.how) { "clean_sweep" -> "Clean Sweep!"; "kettle_pop" -> "Kettle Pop!"; else -> "Victory" }
        r?.how == "give_up" -> "You gave up"
        else -> "Flattened"
    }
    val how = howText(r?.how)
    val texts = session.levelInfo(u.level)?.pennants ?: emptyList()
    // The beats (07 section 4.6): Pennants stamp in at 0.4, 0.9, 1.4 s; Score and Buttons count up from 1.9 s for 0.8 s. One tap skips.
    var t by remember { mutableStateOf(if (session.settings.reduceMotion) 9999f else 0f) }
    LaunchedEffect(r) {
        val start = android.os.SystemClock.uptimeMillis()
        var stamped = 0
        while (t < 2800f) {
            t = (android.os.SystemClock.uptimeMillis() - start).toFloat()
            val due = ((t - 400f) / 500f).toInt() + 1
            while (stamped < minOf(due, r?.pennants?.size ?: 0)) { if (r?.pennants?.getOrNull(stamped) == true) { session.audio.play("meta_pennant_stamp", semis = stamped * 2f); session.buzz(15) }; stamped++ }
            delay(16)
        }
    }
    val count = ((t - 1900f) / 800f).coerceIn(0f, 1f)
    Box(Modifier.fillMaxSize().background(if (winner == 1 && duel) C.OrangeLight else if (won) C.BlueLight else C.Parchment).safeDrawingPadding()
        .clickable(onClickLabel = "skip") { t = 9999f }, contentAlignment = Alignment.Center) {
        Plate(Modifier.padding(16.dp).widthIn(max = 460.dp).verticalScroll(rememberScrollState()), pad = 20.dp) {
            Label(head, Modifier.fillMaxWidth().semantics { heading() }, size = 30, bold = true, align = TextAlign.Center, color = if (winner >= 0) C.side(winner) else C.Ink)
            Label("$how   Round ${r?.round ?: u.hud.round}", Modifier.fillMaxWidth().padding(top = 2.dp), size = 14, color = C.InkSoft, align = TextAlign.Center)
            if (r != null && campaign && r.pennants.isNotEmpty()) {
                val got = r.pennants.count { it }
                Row(Modifier.fillMaxWidth().padding(top = 10.dp).semantics(mergeDescendants = true) { contentDescription = "$got of ${r.pennants.size} Pennants" }, horizontalArrangement = Arrangement.Center) {
                    r.pennants.forEachIndexed { i, ok ->
                        val shown = t >= 400f + 500f * i
                        val frame = ((t - (400f + 500f * i)) / 80f).toInt().coerceIn(0, 4)
                        Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
                            val drawn = shown && ok && frame < 4 && SpriteImage(session.sprites, "ui_pennant_earn_$frame", Modifier.fillMaxSize())
                            if (!drawn) Label(if (ok && shown) "★" else "☆", size = 40, color = if (ok && shown) C.GoldDark else C.Locked)
                        }
                    }
                }
                r.pennants.forEachIndexed { i, ok ->
                    val g = texts.getOrElse(i) { "Pennant ${i + 1}" }
                    val fresh = r.pennantsNew.getOrElse(i) { false }
                    Label((if (ok) "★ " else "☆ ") + g + (if (fresh) "  NEW" else ""), Modifier.semantics { contentDescription = "$g, ${if (ok) "earned" else "missed"}${if (fresh) ", new" else ""}" }, size = 14, bold = fresh)
                }
            } else {
                Label("Kettles: ${u.hud.names.getOrElse(0) { "" }} ${u.hud.kettlePct.getOrElse(0) { 0 }}%, ${u.hud.names.getOrElse(1) { "" }} ${u.hud.kettlePct.getOrElse(1) { 0 }}%", Modifier.fillMaxWidth().padding(top = 12.dp), size = 14, align = TextAlign.Center)
            }
            if (r != null) {
                val score = r.score
                if (score.size >= 2) Label("Siege Score  ${(score[0] * count).toInt()}  to  ${(score[1] * count).toInt()}", Modifier.fillMaxWidth().padding(top = 10.dp), size = 15, bold = true, align = TextAlign.Center)
                if (!duel && (campaign || r.buttons > 0)) Label("Buttons +${(r.buttons * count).toInt()}", Modifier.fillMaxWidth().semantics { contentDescription = "Buttons plus ${r.buttons}" }, size = 18, bold = true, color = C.GoldDark, align = TextAlign.Center)
                val me = if (duel) winner.coerceAtLeast(0) else 0
                r.stats.getOrNull(me)?.let { st ->
                    Label("Shots ${st.shots}   Hits ${st.hits}   Blocks dropped ${st.blocksDropped}   Bonks ${st.bonks}   Best streak ${st.bestStreak}", Modifier.fillMaxWidth().padding(top = 6.dp), size = 12, color = C.InkSoft, align = TextAlign.Center)
                }
                // "What broke you" after a loss (07 section 4.6): the last blow, the worst blows and what was lost.
                val b = r.broke
                if (b != null && !won && !duel) BrokePanel(b)
                if (b != null && duel) BrokePanel(b, u.hud.names.getOrElse(b.side) { "" })
            }
            Spacer(Modifier.height(16.dp))
            if (session.canRematch) CastleButton(if (campaign) (if (won) "Play again" else "Try again") else "Rematch", { session.audio.play("ui_confirm"); session.rematch() }, Modifier.fillMaxWidth(), color = if (won && campaign) C.Cream else C.Gold)
            Spacer(Modifier.height(8.dp))
            CastleButton(if (campaign) "Back to the map" else "Done", { session.audio.play("ui_back"); session.goBack() }, Modifier.fillMaxWidth(), color = if (won && campaign) C.Gold else C.Cream)
        }
    }
}

/** The result's `how` in plain words. */
fun howText(how: String?): String = when (how) {
    "kettle_pop" -> "Kettle Pop"; "clean_sweep" -> "Clean Sweep"; "squall" -> "Sudden Squall"; "double_pop" -> "Double Pop"
    "rescue" -> "Rescue"; "round_cap" -> "Dozed off"; "total_hp" -> "On points"; "give_up" -> "Given up"
    "volley_points" -> "Volley Points"; "captive_bonked" -> "The captive was Bonked"
    null -> ""; else -> how.replace('_', ' ')
}

/**
 * One plain line, eight words at most, from what the core says broke the side. It names
 * only what the result shows, and never invents a cause.
 */
fun brokeLine(b: games.castleprotect.core.Broke): String = when {
    b.how == "give_up" -> "You gave up. No shame in that."
    b.how == "captive_bonked" -> "The captive was Bonked."
    b.how == "clean_sweep" -> "Every Hob was Bonked."
    b.how in setOf("kettle_pop", "double_pop", "squall") && b.kettleLost > 0 -> "Your kettle took ${b.kettleLost} damage."
    b.blocksLost >= 8 -> "You lost ${b.blocksLost} blocks."
    b.hobsBonked > 0 -> "${b.hobsBonked} of your Hobs were Bonked."
    else -> "A close one. Nothing broke first."
}

@Composable
private fun BrokePanel(b: games.castleprotect.core.Broke, who: String? = null) {
    Column(Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(12.dp)).background(C.Cream).border(2.dp, C.Ink, RoundedCornerShape(12.dp)).padding(10.dp)) {
        Label(if (who != null) "What broke $who" else "What broke you", Modifier.semantics { heading() }, size = 15, bold = true)
        Label("“${brokeLine(b)}”", Modifier.padding(top = 2.dp), size = 15)
        b.last?.let { l ->
            val by = if (l.hobName.isNotEmpty()) " from ${l.hobName}" else ""
            Label("Last blow: ${l.shotName.ifEmpty { l.shot }}$by, round ${l.round}", Modifier.padding(top = 4.dp), size = 13)
        }
        b.top.take(3).forEachIndexed { i, t ->
            val by = if (t.hobName.isNotEmpty()) " (${t.hobName})" else ""
            Label("${i + 1}. ${t.shotName.ifEmpty { t.shot }}$by: ${t.dmg} damage", size = 13)
        }
        Label("Kettle lost ${b.kettleLost}   Blocks lost ${b.blocksLost}   Hobs Bonked ${b.hobsBonked}", Modifier.padding(top = 4.dp), size = 12, color = C.InkSoft)
    }
}

// ---- Skirmish ----------------------------------------------------------------------

@Composable
fun SkirmishScreen(session: GameSession) {
    var rounds by rememberSaveable { mutableIntStateOf(1) }
    var wind by rememberSaveable { mutableIntStateOf(1) }
    var draft by rememberSaveable { mutableIntStateOf(0) }
    var map by rememberSaveable { mutableIntStateOf(0) }
    var winBy by rememberSaveable { mutableIntStateOf(0) }
    val maps = session.content.duelMaps
    Page("Skirmish", session) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
            Plate(Modifier.fillMaxWidth().widthIn(max = 560.dp)) {
                Label("One battle against the AI.", size = 14, color = C.InkSoft)
                if (maps.size > 1) Choice("Map", maps.map { it.name }, map.coerceAtMost(maps.size - 1)) { map = it }
                Choice("Rival", listOf("Cozy", "Fair", "Stubborn"), session.settings.preset) { session.settings.preset = it }
                Choice("Win by", WIN_BY, winBy) { winBy = it }
                if (winBy == 0) Choice("Rounds", listOf("10", "15", "20"), rounds) { rounds = it }
                Choice("Wind", listOf("Calm", "Light", "Gusty"), wind) { wind = it }
                Choice("Shells", listOf("Rummage", "Plain only"), draft) { draft = it }
                Choice("Help", listOf("None", "Some", "Lots"), session.settings.help) { session.settings.help = it }
                Spacer(Modifier.height(10.dp))
                CastleButton("Next", {
                    val level = maps.getOrNull(map)?.id ?: "d1"
                    session.openSpec(BattleSpec.skirmish(level, session.settings.presetKey, listOf(10, 15, 20)[rounds], wind, draft == 1,
                        help = SideOpts(session.settings.helpKey), volley = VOLLEY[winBy]))
                }, Modifier.fillMaxWidth().height(56.dp), size = 18, enabled = !session.coreMissing)
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
    var map by rememberSaveable { mutableIntStateOf(0) }
    var winBy by rememberSaveable { mutableIntStateOf(0) }
    var help1 by rememberSaveable { mutableIntStateOf(0) }
    var help2 by rememberSaveable { mutableIntStateOf(0) }
    val maps = session.content.duelMaps
    Page("Couch Duel", session, trailing = { CastleButton("Swap sides", { val t = p1; p1 = p2; p2 = t; val hh = help1; help1 = help2; help2 = hh }, color = C.Cream, size = 13) }) {
        Column(Modifier.fillMaxSize()) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Label("2 players, 1 device. Free forever, no ads.", size = 13, color = C.InkSoft)
                BoxWithConstraints {
                    val wide = maxWidth > 560.dp
                    val a: @Composable (Modifier) -> Unit = { m -> PlayerPlate(m, 0, p1, { p1 = it }, help1, { help1 = it }) { p1 = duelNames.filter { it != p2 }.random() } }
                    val b: @Composable (Modifier) -> Unit = { m -> PlayerPlate(m, 1, p2, { p2 = it }, help2, { help2 = it }) { p2 = duelNames.filter { it != p1 }.random() } }
                    if (wide) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.weight(1f)); b(Modifier.weight(1f)) }
                    else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.fillMaxWidth()); b(Modifier.fillMaxWidth()) }
                }
                Plate(Modifier.fillMaxWidth()) {
                    if (maps.size > 1) Choice("Map", maps.map { it.name }, map.coerceAtMost(maps.size - 1)) { map = it }
                    Choice("Win by", WIN_BY, winBy) { winBy = it }
                    if (winBy == 0) Choice("Rounds", listOf("10", "15", "20"), rounds) { rounds = it }
                    Choice("Wind", listOf("Calm", "Light", "Gusty"), wind) { wind = it }
                    Choice("Shells", listOf("Rummage", "Plain only"), draft) { draft = it }
                    Choice("Seats", listOf("Side by side", "One seat"), seats) { seats = it }
                }
            }
            Row(Modifier.fillMaxWidth().background(C.Paper).border(1.dp, C.Ink).padding(10.dp), horizontalArrangement = Arrangement.End) {
                CastleButton("Next", {
                    val level = maps.getOrNull(map)?.id ?: "d1"
                    session.openSpec(BattleSpec.couch(level, listOf(p1.ifBlank { "Player 1" }, p2.ifBlank { "Player 2" }), listOf(10, 15, 20)[rounds], wind, draft == 1,
                        if (seats == 0) "side_by_side" else "one_seat", help = listOf(BattleSpec.duelHelp(help1), BattleSpec.duelHelp(help2)), volley = VOLLEY[winBy]))
                }, Modifier.size(width = 160.dp, height = 56.dp), size = 18, enabled = !session.coreMissing)
            }
        }
    }
}

/** Win by: Knockout, or Volley Points with 6, 10 or 14 Actions each. */
private val WIN_BY = listOf("Knockout", "Volley 6", "Volley 10", "Volley 14")
private val VOLLEY = listOf(0, 6, 10, 14)

@Composable
private fun PlayerPlate(modifier: Modifier, side: Int, name: String, onName: (String) -> Unit, help: Int, onHelp: (Int) -> Unit, dice: () -> Unit) {
    val shape = if (side == 0) CircleShape else RoundedCornerShape(3.dp)
    Plate(modifier.border(4.dp, C.side(side), PlateShape)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(22.dp).clip(shape).background(C.side(side)).border(2.dp, C.Ink, shape))
            Label("  PLAYER ${side + 1}", Modifier.semantics { heading() }, size = 14, bold = true, color = C.side(side))
            Label(if (side == 0) "   left fort, blue, round" else "   right fort, orange, diamond", size = 11, color = C.InkSoft)
        }
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(name, { onName(JsonText.takeCodePoints(it, 12)) }, Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(10.dp)).background(Color.White).border(2.dp, C.Ink, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 12.dp).semantics { contentDescription = "Player ${side + 1} name" },
                singleLine = true, textStyle = TextStyle(color = C.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold))
            Spacer(Modifier.width(8.dp))
            CastleButton("⚄", dice, Modifier.size(48.dp), color = C.Cream, description = "Random name for player ${side + 1}", pad = androidx.compose.foundation.layout.PaddingValues(0.dp), size = 20)
        }
        // Help is the handicap, per player, and is shown openly in battle.
        Choice("Help", listOf("None", "Some +", "Lots ++"), help) { onHelp(it) }
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
    Volume("Music", s.music, { s.music = it }) { session.audio.play("ui_slider_tick") }
    Volume("Sound", s.sound, { s.sound = it }) { session.audio.play("ui_slider_tick") }
    Volume("Voices", s.voices, { s.voices = it }) { session.audio.play("bark_marge_picked") }
    Toggle("Mute all", s.muteAll) { s.muteAll = it }
    Toggle("Subtitles for Hob-speak", s.subtitles) { s.subtitles = it }
    Section("Controls")
    Choice("Rotation", listOf("Follow device", "Stay wide", "Stay tall"), s.rotation) { s.rotation = it }
    Choice("Drag mode", listOf("Pull-back", "Point"), if (s.pointMode) 1 else 0) { s.pointMode = it == 1 }
    Toggle("Quick Fire (lifting the finger fires)", s.quickFire) { s.quickFire = it }
    Toggle("Rival turns at 2x", s.rival2x) { s.rival2x = it }
    Toggle("Left-hand layout", s.leftHand) { s.leftHand = it }
    Toggle("Tap only (no hold to repeat)", s.tapOnly) { s.tapOnly = it }
    Section("Assists")
    Choice("Difficulty", listOf("Cozy", "Fair", "Stubborn"), s.preset) { s.preset = it }
    Choice("Help (more Steam)", listOf("None", "Some", "Lots"), s.help) { s.help = it }
    Section("Access")
    Choice("Text size", listOf("Small", "Normal", "Large"), s.textSize) { s.textSize = it }
    Choice("Haptics", listOf("Off", "Light", "Full"), s.haptics) { s.haptics = it; session.buzz(20) }
    Toggle("Reduce motion", s.reduceMotion) { s.reduceMotion = it }
    Choice("Screen shake", listOf("100%", "50%", "Off"), s.shake) { s.shake = it }
    Toggle("Reduce flashes", s.reduceFlashes) { s.reduceFlashes = it }
    Section("About")
    Label("Free forever. No ads. Nothing to buy.", size = 14, bold = true)
    Label("Privacy: Data Not Collected.", size = 13)
    Label("Castle Protect v0.2, ${session.coreName}", size = 12, color = C.InkSoft)
    Label("Buttons: ${session.buttons}", size = 12, color = C.InkSoft)
}

@Composable
private fun Volume(label: String, value: Int, set: (Int) -> Unit, done: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Label(label, Modifier.width(72.dp), size = 14)
        Slider(value.toFloat(), { set(it.toInt()) }, Modifier.weight(1f).semantics { contentDescription = "$label volume"; stateDescription = "$value percent" }, valueRange = 0f..100f, onValueChangeFinished = done)
        Label("$value", Modifier.width(36.dp), size = 14, align = TextAlign.End)
    }
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

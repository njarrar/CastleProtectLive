package games.castleprotect

import games.castleprotect.battle.Aim
import games.castleprotect.battle.Camera
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Cmd
import games.castleprotect.core.CoreGame
import games.castleprotect.core.Frame
import games.castleprotect.core.Hud
import games.castleprotect.core.NativeCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Progress
import games.castleprotect.core.Reply
import games.castleprotect.core.SnapshotParser
import games.castleprotect.game.FireLight
import games.castleprotect.game.FortCheck
import games.castleprotect.game.FortGrid
import games.castleprotect.game.HudText
import games.castleprotect.game.PhoneLayout
import games.castleprotect.game.SaveCompat
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Core rules v3 and the QA playtest 1 lessons (core/API.md "Changes for QA playtest 1",
 * docs/qa/playtest-1/REPORT.md). Fixture tests always run; the native ones run against the
 * real core when CI (or a local run) passes -Pcastle.hostJni.
 */
class QaPlaytestOneTest {
    private val plan = Fixtures.fixture("snapshot_plan.json")
    private val ended = Fixtures.fixture("snapshot_ended.json")
    private fun parse(text: String): Frame = SnapshotParser().parse(text.toByteArray())

    // ---- M1: Fire is honest -------------------------------------------------

    @Test fun hudFireAndChipWordsComeFromTheCore() {
        val p = parse(plan)
        assertNotNull(p.hud.fire)
        assertTrue(p.hud.fire!!.ready)
        assertTrue(FireLight.ready(p.hud, p.humanTurn, p.selectedHob))
        assertNull(FireLight.why(p.hud))
        val e = parse(ended)
        val fire = e.hud.fire!!
        assertFalse(fire.ready)
        assertEquals("not_planning", fire.why)
        assertEquals("Not your turn", fire.text)
        assertTrue(e.hud.shots.all { !it.ready && it.text == "Not your turn" })
        assertEquals("Not your turn", FireLight.why(e.hud))
    }

    @Test fun fireIsGreyWhenTheCoreSaysSoEvenIfTheHobCanFire() {
        val p = parse(plan)
        val grey = p.hud.copy(fire = games.castleprotect.core.FireState(false, "resting_plain_only", "Marge Dumpling needs a rest: Plain Shot only"))
        assertFalse(FireLight.ready(grey, true, p.selectedHob))
        assertEquals("Marge Dumpling needs a rest: Plain Shot only", FireLight.why(grey))
        // Nobody on turn, or no Hob: never lit.
        assertFalse(FireLight.ready(p.hud, false, p.selectedHob))
        assertFalse(FireLight.ready(p.hud, true, null))
    }

    @Test fun aRefusedFireShowsTheDetailAndNamesTheShotToSwitchTo() {
        val r = Reply.parse("""{"ok":false,"reason":"resting_plain_only","detail":"Marge Dumpling needs a rest: Plain Shot only","shot":"knack","hob":0,"ready_shot":"plain"}""")
        assertFalse(r.ok)
        assertEquals("Marge Dumpling needs a rest: Plain Shot only", r.detail)
        assertEquals("plain", r.readyShot)
        assertEquals("Marge Dumpling needs a rest: Plain Shot only" to "plain", FireLight.onRefusal(r))
        val none = Reply.parse("""{"ok":false,"reason":"no_knack_uses","detail":"No Knack uses left","ready_shot":null}""")
        assertEquals("No Knack uses left" to null, FireLight.onRefusal(none))
        assertNull(FireLight.onRefusal(Reply.parse("""{"ok":true}""")))
        // In an array the first refusal speaks for it.
        val arr = Reply.parse("""[{"ok":true},{"ok":false,"reason":"bad_value","detail":"angle 0 to 1800"}]""")
        assertEquals("bad_value", arr.reason); assertEquals("angle 0 to 1800", arr.detail)
    }

    @Test fun shotSwitchEventIsReadWithItsStringFields() {
        val snap = """{"tick":5,"phase":"plan","side":0,"awaiting":"human","full":false,"shells":[],"events":[
            {"t":"shot_switch","tick":5,"side":0,"hob":0,"from":"knack","to":"plain","why":"resting_plain_only","when":"turn_start"},
            {"t":"walk","tick":5,"side":0,"from":[100,390],"to":[120,390],"steam":5}]}"""
        val p = SnapshotParser(); p.parse(plan.toByteArray())
        val f = p.parse(snap.toByteArray())
        val sw = f.events[0]
        assertEquals("shot_switch", sw.t)
        assertEquals("knack", sw.fromShot); assertEquals("plain", sw.toShot)
        assertEquals("resting_plain_only", sw.why); assertEquals("turn_start", sw.whenTag)
        val walk = f.events[1]
        assertEquals(100, walk.fromX); assertEquals(120, walk.toX)
        assertEquals("Marge needs a rest: Clodpot picked", HudText.shotSwitch("Marge", sw.why, "Clodpot"))
    }

    @Test fun unreadyChipsGetABadge() {
        assertEquals("REST", HudText.chipBadge("resting_plain_only"))
        assertEquals("0 LEFT", HudText.chipBadge("no_knack_uses"))
        assertEquals("HEAVY", HudText.chipBadge("no_heavy_first_turn"))
        assertEquals("", HudText.chipBadge("not_planning"))
    }

    // ---- M2: Fatigue ------------------------------------------------------------

    @Test fun fatigueFieldsAndTheRoundLabel() {
        val h = parse(plan).hud
        assertFalse(h.fatigue); assertEquals(10, h.fatigueRound); assertEquals(9, h.fatigueIn)
        assertEquals("Round 1/${h.roundCap}", HudText.round(h, "campaign"))
        val r7 = h.copy(round = 7, fatigueIn = 3)
        assertEquals("Round 7/${h.roundCap}  Fatigue in 3", HudText.round(r7, "campaign"))
        val r9 = h.copy(round = 9, fatigueIn = 1)
        assertEquals("Round 9/${h.roundCap}  Fatigue next round", HudText.round(r9, "campaign"))
        assertEquals("Fatigue next round", HudText.fatigueBanner(r9))
        assertTrue(HudText.warn(r9))
        assertNull(HudText.fatigueBanner(r7))
        val r10 = h.copy(round = 10, fatigue = true, fatigueIn = -1)
        assertEquals("Round 10/${h.roundCap}  Fatigue", HudText.round(r10, "campaign"))
        // The Squall warning wins the label when both are close.
        assertTrue(HudText.round(r9.copy(squallWarning = 2), "campaign").endsWith("Squall in 2"))
        // A null fatigue_in (Volley Points, Test Yard) reads as -1.
        val nul = SnapshotParser().parse(plan.replace("\"fatigue_in\": 9", "\"fatigue_in\": null").replace("\"fatigue_in\":9", "\"fatigue_in\":null").toByteArray())
        assertEquals(-1, nul.hud.fatigueIn)
    }

    // ---- m1: Best shot ----------------------------------------------------------

    @Test fun bestShotIsTheWinnersAndEachSideKeepsItsOwn() {
        val r = parse(ended).result!!
        assertEquals(0, r.winner)
        val b = r.bestShot!!
        assertEquals(0, b.side); assertEquals("Marge Dumpling", b.hobName); assertEquals("Clodpot", b.shotName)
        assertEquals(440, b.angle); assertEquals(78, b.power); assertEquals(29, b.dmg)
        assertEquals(b, r.bestOf(0))
        assertNull(r.bestOf(1))
        assertEquals("Clodpot by Marge Dumpling, 44.0° / 78, 29 dmg", HudText.bestShot(b))
    }

    // ---- M6: Retry sends attempt -------------------------------------------------

    @Test fun retryKeepsTheSeedAndCountsTheAttempt() {
        val a = BattleSpec.campaign("1-2", "fair", seed = 99, progress = Progress(false, listOf(false, false, false)))
        assertEquals(0, a.attempt)
        assertFalse(a.setup.contains("attempt"))
        val b = a.retry(); val c = b.retry()
        assertEquals(99, c.seed)
        assertEquals(1, b.attempt); assertEquals(2, c.attempt)
        assertEquals(1, Regex("\"attempt\"").findAll(c.setup).count())
        assertEquals(2, JSONObject(c.setup).getInt("attempt"))
        val sk = BattleSpec.skirmish("d1", "fair", 15, 1, false, seed = 5).retry()
        assertEquals(1, JSONObject(sk.setup).getInt("attempt")); assertEquals(5, sk.seed)
        // The Daily Dust-up is one fight per date: never an attempt.
        val daily = BattleSpec("""{"level":"d1","mode":"daily"}""", 3, "daily", "d1")
        assertFalse(daily.retry().setup.contains("attempt"))
        assertEquals(0, daily.retry().attempt)
    }

    // ---- M4: Test Yard -----------------------------------------------------------

    @Test fun testYardSetupAndTheDummySideIsNeverHuman() {
        val s = JSONObject(BattleSpec.testYard("d1", FortGrid.HOME, 3).setup)
        assertEquals("test_yard", s.getString("mode"))
        val sides = s.getJSONArray("sides")
        assertEquals("human", sides.getJSONObject(0).getString("control"))
        assertEquals(FortGrid.HOME.size, sides.getJSONObject(0).getJSONArray("rows").length())
        assertEquals(3, sides.getJSONObject(0).getInt("crew_size"))
        val h = Hud(control = listOf("human", "human"), yard = true)
        assertTrue(h.human(0)); assertFalse(h.human(1))
        val yard = SnapshotParser().parse(plan.replace("\"mode\": \"campaign\"", "\"mode\": \"test_yard\"").replace("\"mode\":\"campaign\"", "\"mode\":\"test_yard\"").toByteArray())
        assertEquals("test_yard", yard.mode)
        assertTrue(yard.hud.yard)
        assertEquals("Test Yard", HudText.round(yard.hud, yard.mode))
    }

    // ---- Rules version 3 -----------------------------------------------------------

    @Test fun savesFromRulesTwoAreRefusedWithAPlainMessage() {
        val v3 = """{"sim":"0.2.0","rules":3,"tick_hz":120}"""
        val v2 = """{"sim":"0.2.0","rules":2,"tick_hz":120}"""
        assertNull(SaveCompat.refusal(v3, v3, standIn = false))
        val msg = SaveCompat.refusal(v2, v3, standIn = false)!!
        assertTrue(msg, msg.contains("older game rules (version 2)"))
        assertFalse(msg.contains("_"))
        assertNotNull(SaveCompat.refusal("", v3, standIn = false))
        // No version from the core: this app's own rules version is assumed.
        assertNotNull(SaveCompat.refusal(v2, null, standIn = false))
        assertNull(SaveCompat.refusal("fixture", "fixture", standIn = true))
        // Rules v4 since QA playtest 2 (QaPlaytestTwoTest).
        assertTrue(SaveCompat.RULES >= 3)
    }

    // ---- Layout lessons (M3, M5, M7, M8, m3, m5) -----------------------------------------

    @Test fun fineTuneSitsAwayFromYourFort() {
        assertEquals(PhoneLayout.Pad.BOTTOM_END, PhoneLayout.pad(tall = true, mySide = 0))
        assertEquals(PhoneLayout.Pad.BOTTOM_START, PhoneLayout.pad(tall = true, mySide = 1))
        assertEquals(PhoneLayout.Pad.TOP_END, PhoneLayout.pad(tall = false, mySide = 0))
        assertEquals(PhoneLayout.Pad.TOP_START, PhoneLayout.pad(tall = false, mySide = 1))
    }

    @Test fun couchDuelSetupAndHandOffFitAPhoneInLandscape() {
        assertTrue(PhoneLayout.duelSideBySide(844f))
        assertFalse(PhoneLayout.duelSideBySide(390f))
        assertTrue(PhoneLayout.handoffCompact(390f))
        assertFalse(PhoneLayout.handoffCompact(844f))
    }

    @Test fun workshopCellsAreNeverUnder24dp() {
        // 844 x 390 landscape: the grid gets the left 60% beside the palette.
        assertTrue(FortGrid.sideBySide(844f, 334f))
        assertTrue(FortGrid.cellDp(844f * 0.6f - 16f, 334f - 16f) >= 24f)
        assertTrue(FortGrid.cellDp(390f - 16f, 700f * 0.62f) >= 24f)
        assertEquals(24f, FortGrid.cellDp(80f, 80f), 0f)
    }

    @Test fun workshopGridRoundTripsAndEditsRooms() {
        val g = FortGrid.fromRows(FortGrid.HOME)
        assertEquals(FortGrid.HOME, g.toRows())
        assertEquals(3, g.seats())
        // A new Nook takes the next free number on a clear 2 x 2.
        assertTrue(g.place('N', 0, 6))
        assertEquals(4, g.seats()); assertEquals('4', g[1, 7])
        assertFalse(g.place('t', 1, 7)) // a room is not built over
        assertTrue(g.place('.', 0, 6)) // erasing a room cell clears the room
        assertEquals(3, g.seats())
        assertEquals(FortGrid.HOME, g.toRows())
        assertTrue(g.place('c', 0, 6))
        assertEquals("c......", g.toRows().first())
        val bad = FortCheck.parse("""{"budget":72,"cells":[[1,3],[0,4]],"cost":255,"detail":"Kettle Room must be walled","ok":false,"reason":"invalid_blueprint","used":33}""")
        assertFalse(bad.ok); assertEquals("Kettle Room must be walled", bad.why); assertEquals(listOf(1 to 3, 0 to 4), bad.cells)
        assertTrue(FortCheck.parse("""{"budget":72,"cost":390,"ok":true,"used":42}""").ok)
    }

    @Test fun rivalFortEdgeMarker() {
        // Off the right edge: marker on the right, at the fort's height.
        val m = Camera.offscreenMarker(900f, 1000f, 200f, 844f, 390f, 60f, 8f, 40f, 68f)!!
        assertEquals(836f, m[0]); assertEquals(200f, m[1]); assertEquals(1f, m[2])
        // Partly in view: no marker.
        assertNull(Camera.offscreenMarker(800f, 900f, 200f, 844f, 390f, 60f, 8f, 40f, 68f))
        // Off the left, height kept off the HUD.
        val l = Camera.offscreenMarker(-200f, -100f, 380f, 844f, 390f, 60f, 8f, 40f, 68f)!!
        assertEquals(-1f, l[2]); assertEquals(322f, l[1])
        // Both forts framed while blocks still draw at 8 dp (0.5 px per cell at dp 1).
        val a = floatArrayOf(344f, 250f, 456f, 402f); val b = floatArrayOf(1144f, 250f, 1256f, 402f)
        assertTrue(Camera.bothFit(a, b, 784f, 282f, 24f, Camera.minBlockScale(1f)))
        assertFalse(Camera.bothFit(a, floatArrayOf(2144f, 250f, 2256f, 402f), 784f, 282f, 24f, Camera.minBlockScale(1f)))
    }

    @Test fun aPullIntoTheScreenEdgeKeepsItsAngleAndOnlyClampsPower() {
        val dp = 2.75f; val w = 844f * dp; val h = 390f * dp
        // Anchor near the left edge; the pull goes down left toward 45 degrees.
        val ax = 150f * dp; val ay = 200f * dp
        val full = Aim.fullPull(ax, ay, -1f, 1f, w, h, dp)
        assertTrue(full <= 0.4f * h + 0.01f)
        assertTrue(full >= 64f * dp)
        // Full power comes before the finger meets the edge.
        val reach = full / Math.sqrt(2.0).toFloat()
        assertTrue(ax - reach > 2f * dp)
        val off = Aim.pull(ax, ay, ax - reach * 0.9f, ay + reach * 0.9f, w, h, false, dp, -1)
        assertEquals(450, off[0]); assertEquals(0, off[2])
        // On the edge the finger slides: the angle holds, power follows the pull.
        val edge = Aim.pull(ax, ay, 0f, ay + reach * 0.6f, w, h, false, dp, off[0])
        assertEquals(1, edge[2]); assertEquals(450, edge[0])
        assertTrue(edge[1] in 0..100)
    }

    // ---- Against the real core ----------------------------------------------------------------

    private fun ready(): Boolean = System.getProperty("castle.hostJni") != null && NativeCore.available()

    private fun settle(g: CoreGame) {
        var n = 0
        while (JSONObject(g.step(0)).getString("phase").let { it == "resolve" || it == "settle" } && n++ < 20) g.step(600)
    }

    @Test fun nativeCoreMatchesTheAppRules() {
        assumeTrue(ready())
        assertEquals(SaveCompat.RULES, SaveCompat.rulesOf(NativeCore.version()))
    }

    @Test fun nativeRestTurnSwitchesToThePlainShotAndARefusedFireSaysWhy() {
        assumeTrue(ready())
        val g = NativeCore.factory()!!.newGame("""{"level":"1-1"}""", 7)
        val p = SnapshotParser()
        p.parse(g.snapshot())
        g.command(Cmd.pickHob(0)); g.command(Cmd.pickShot("knack"))
        assertTrue(Reply.parse(g.command(Cmd.FIRE)).ok)
        settle(g)
        assertTrue(Reply.parse(g.command(Cmd.AI_TURN)).ok)
        settle(g)
        val f = p.parse(g.snapshot())
        assertEquals(0, f.side); assertEquals(Phase.PLAN, f.phase)
        // Marge rests: the core moved her pick to the Plain Shot and Fire stays lit.
        assertEquals("plain", f.hud.selectedShot)
        assertTrue(f.hud.fire!!.ready)
        val knack = f.hud.chip("knack")!!
        assertFalse(knack.ready); assertEquals("resting_plain_only", knack.why); assertNotNull(knack.text)
        // Picked by hand anyway: the pick stands, Fire goes grey and says why.
        g.command(Cmd.pickShot("knack"))
        val grey = p.parse(g.snapshot())
        assertFalse(FireLight.ready(grey.hud, grey.humanTurn, grey.selectedHob))
        assertEquals(knack.text, FireLight.why(grey.hud))
        val refused = Reply.parse(g.command(Cmd.FIRE))
        val (words, to) = FireLight.onRefusal(refused)!!
        assertEquals(knack.text, words)
        assertEquals("plain", to)
        assertTrue(Reply.parse(g.command(Cmd.pickShot(to!!))).ok)
        assertTrue(Reply.parse(g.command(Cmd.FIRE)).ok)
        g.close()
    }

    @Test fun nativeShotSwitchEventComesAtTurnStart() {
        assumeTrue(ready())
        val g = NativeCore.factory()!!.newGame("""{"level":"1-1"}""", 7)
        val p = SnapshotParser()
        p.parse(g.snapshot())
        g.command(Cmd.pickHob(0)); g.command(Cmd.pickShot("knack")); g.command(Cmd.FIRE)
        val events = ArrayList<games.castleprotect.core.GameEvent>()
        settle(g); events += p.parse(g.snapshot()).events
        g.command(Cmd.AI_TURN); settle(g); events += p.parse(g.snapshot()).events
        val sw = events.firstOrNull { it.t == "shot_switch" && it.side == 0 }
        assertNotNull("a shot_switch event for the resting Hob", sw)
        assertEquals("knack", sw!!.fromShot); assertEquals("plain", sw.toShot); assertEquals("turn_start", sw.whenTag)
        g.close()
    }

    @Test fun nativeFatigueIsWarnedARoundAheadAndNeverEndsTheFight() {
        assumeTrue(ready())
        val spec = BattleSpec.couch("d1", listOf("A", "B"), 15, 0, true, "one_seat", seed = 3)
        val g = NativeCore.factory()!!.newGame(spec.setup, spec.seed)
        val p = SnapshotParser()
        var f = p.parse(g.snapshot())
        val seen = ArrayList<String>()
        var warnHud: Hud? = null
        var guard = 0
        while (f.hud.round < 11 && f.phase != Phase.ENDED && guard++ < 60) {
            g.command(Cmd.PASS); settle(g)
            f = p.parse(g.snapshot())
            seen += f.events.map { it.t }
            if (f.hud.round == 9 && warnHud == null) warnHud = f.hud
        }
        assertNotNull(warnHud)
        assertEquals(1, warnHud!!.fatigueIn)
        assertEquals("Fatigue next round", HudText.fatigueBanner(warnHud))
        assertTrue(seen.contains("fatigue_warning"))
        assertTrue(seen.contains("fatigue"))
        assertTrue(f.hud.fatigue)
        assertFalse(seen.contains("win"))
        assertNotEquals(Phase.ENDED, f.phase)
        g.close()
    }

    @Test fun nativeRetryIsANewFightButTheDailyIsNot() {
        assumeTrue(ready())
        val fac = NativeCore.factory()!!
        fun hash(setup: String, seed: Long): String {
            val g = fac.newGame(setup, seed)
            val h = JSONObject(g.command(Cmd.HASH)).getString("hash")
            g.close(); return h
        }
        val first = BattleSpec.skirmish("d1", "fair", 15, 2, false, seed = 21)
        val hashes = (0..3).map { hash(first.withAttempt(it).setup, first.seed) }
        assertTrue("a Retry changes the fight", hashes.drop(1).any { it != hashes[0] })
        val daily = BattleSpec("""{"level":"d1","mode":"daily"}""", 21, "daily", "d1")
        assertEquals(hash(daily.setup, 21), hash(daily.retry().setup, 21))
    }

    @Test fun nativeTestYardNeverHandsThePlayerTheDummyTurn() {
        assumeTrue(ready())
        for (rows in listOf(null, FortGrid.HOME)) {
            val spec = BattleSpec.testYard("d1", rows, if (rows == null) 0 else 3)
            val g = NativeCore.factory()!!.newGame(spec.setup, spec.seed)
            val p = SnapshotParser()
            var f = p.parse(g.snapshot())
            assertEquals(Phase.PLAN, f.phase)
            assertTrue(f.hud.yard)
            for (i in 0 until 6) {
                assertEquals(0, f.side); assertTrue(f.humanTurn); assertFalse(f.hud.human(1))
                // Endless uses: a Knack goes every time, no Hob rests.
                if (i % 2 == 1) g.command(Cmd.pickShot("knack"))
                assertTrue(FireLight.ready(f.hud, f.humanTurn, f.selectedHob))
                assertTrue(Reply.parse(g.command(Cmd.FIRE)).ok)
                settle(g)
                f = p.parse(g.snapshot())
            }
            assertNull(f.result)
            g.close()
        }
    }

    @Test fun nativeWorkshopFortChecksComeFromTheCore() {
        assumeTrue(ready())
        val g = NativeCore.factory()!!.newGame("""{"level":"d1","mode":"test_yard"}""", 1)
        assertTrue(FortCheck.parse(g.command(Cmd.validateBlueprint(FortGrid.HOME, 3))).ok)
        val grid = FortGrid.fromRows(FortGrid.HOME)
        grid.place('.', 0, 2) // knock a hole in the Kettle Room wall
        val bad = FortCheck.parse(g.command(Cmd.validateBlueprint(grid.toRows(), grid.seats())))
        assertFalse(bad.ok); assertTrue(bad.why.isNotEmpty())
        g.close()
    }
}

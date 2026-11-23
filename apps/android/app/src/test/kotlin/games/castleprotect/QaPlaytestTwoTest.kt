package games.castleprotect

import games.castleprotect.battle.Camera
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Blow
import games.castleprotect.core.Cmd
import games.castleprotect.core.CoreGame
import games.castleprotect.core.Frame
import games.castleprotect.core.Hob
import games.castleprotect.core.NativeCore
import games.castleprotect.core.Phase
import games.castleprotect.core.SnapshotParser
import games.castleprotect.game.BrokeText
import games.castleprotect.game.FatigueBeat
import games.castleprotect.game.HobLook
import games.castleprotect.game.HudText
import games.castleprotect.game.OwnerRule
import games.castleprotect.game.RivalPeek
import games.castleprotect.game.SaveCompat
import games.castleprotect.game.SaveData
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Core rules v4 and the QA playtest 2 lessons (docs/qa/playtest-2/REPORT.md "Core fixes" and
 * "8. Web fixes", core/API.md). Fixture tests always run; the native ones run against the
 * real core when CI (or a local run) passes -Pcastle.hostJni.
 */
class QaPlaytestTwoTest {
    private val ended = Fixtures.fixture("snapshot_ended.json")
    private fun parse(text: String): Frame = SnapshotParser().parse(text.toByteArray())

    private fun hob(id: Int, state: String, hp: Int, canFire: Boolean = true, side: Int = 0, max: Int = 100) =
        Hob(id, side, "marge", "Hob $id", "lobber", hp, max, state, 0, 0, 0, 0, null, 0, "clodpot", false, false, false, false, false, canFire, 0, 0)

    // ---- Rules version 5 (bundle patch 02) ----------------------------------------------------

    @Test fun savesFromRulesFourAreRefusedWithAPlainMessage() {
        val v5 = """{"sim":"0.2.0","rules":5,"tick_hz":120}"""
        val v4 = """{"sim":"0.2.0","rules":4,"tick_hz":120}"""
        assertEquals(5, SaveCompat.RULES)
        assertNull(SaveCompat.refusal(v5, v5, standIn = false))
        val msg = SaveCompat.refusal(v4, v5, standIn = false)!!
        assertEquals(games.castleprotect.core.Text.t("errors.saved_fight_old"), msg)
        assertTrue(msg.contains("Your progress and Pennants are safe"))
        assertFalse(msg.contains("_")); assertFalse(msg.contains("{"))
        // No version from the core: this app's own rules version (5) is assumed.
        assertNotNull(SaveCompat.refusal(v4, null, standIn = false))
        assertNull(SaveCompat.refusal(v5, null, standIn = false))
    }

    // ---- N2: Squashed is not Bonked -------------------------------------------------------

    @Test fun onlyBonkedOrZeroHpIsOutOfTheFight() {
        assertTrue(hob(0, "bonked", 0).bonked)
        assertTrue(hob(0, "seated", 0).bonked)
        for (st in listOf("squashed", "dropped", "tumbled", "seated", "open")) assertFalse(st, hob(0, st, 1).bonked)
        assertTrue(hob(0, "squashed", 1).squashed)
        assertTrue(hob(0, "dropped", 1).squashed)
        assertFalse(hob(0, "dropped", 40).squashed)
        assertFalse(hob(0, "bonked", 0).squashed)
        // The app's own reading agrees with the model's.
        for (st in listOf("bonked", "squashed", "dropped", "seated")) for (hp in listOf(0, 1, 50)) {
            assertEquals(HobLook.out(st, hp), hob(0, st, hp).bonked)
            assertEquals(HobLook.squashed(st, hp), hob(0, st, hp).squashed)
        }
    }

    @Test fun aSquashedHobKeepsAFilledPipALivePortraitAndItsWords() {
        assertEquals(1f, HobLook.pipFill("squashed", 1), 0f)
        assertEquals(1f, HobLook.pipFill("dropped", 1), 0f)
        assertEquals(0f, HobLook.pipFill("bonked", 0), 0f)
        assertEquals(0.5f, HobLook.pipFill("seated", 50), 1e-6f)
        // A live Hob's pip never reads empty, even from a core that rounded 1 HP down to 0.
        assertTrue(HobLook.pipFill("seated", 0) > 0f)
        assertFalse(HobLook.pipOut("squashed")); assertTrue(HobLook.pipOut("bonked"))
        assertTrue(HobLook.pipSquashed("squashed", 1)); assertFalse(HobLook.pipSquashed("seated", 1))
        assertEquals("Squashed. Back up soon.", HobLook.words(hob(0, "squashed", 1)))
        assertEquals("Fell a floor", HobLook.words(hob(0, "dropped", 1)))
        assertEquals("Bonked", HobLook.words(hob(0, "bonked", 0)))
        // A Hob that is fine has no state words: its chip line already says its HP (hud.hob_chip).
        assertEquals("", HobLook.words(hob(0, "seated", 80)))
    }

    @Test fun aSquashedHobFromTheSnapshotIsLiveAndMayBePicked() {
        val o = JSONObject(ended)
        val hobs = o.getJSONArray("hobs")
        hobs.getJSONObject(0).put("state", "squashed").put("hp", 1).put("can_fire", true)
        hobs.getJSONObject(1).put("state", "dropped").put("hp", 1).put("can_fire", true)
        val f = parse(o.toString())
        val a = f.hobs.first { it.id == hobs.getJSONObject(0).getInt("id") }
        val b = f.hobs.first { it.id == hobs.getJSONObject(1).getInt("id") }
        assertFalse(a.bonked); assertTrue(a.squashed); assertTrue(a.canFire)
        assertFalse(b.bonked); assertTrue(b.squashed)
        // A turn can open on it: it is able to act.
        assertNull(OwnerRule.openOn(f.hobs, a.side, a.id))
    }

    // ---- N1: Fatigue shown ------------------------------------------------------------------

    @Test fun fatigueGetsABannerAtRoundNineAndARedOneAtRoundTenAndYourTurnWaits() {
        val beat = FatigueBeat()
        val warn = beat.onEvent("fatigue_warning", "", 9, 1000L)!!
        assertEquals("The Creaks start next round. Cracked blocks hold less.", warn.text)
        assertFalse(warn.danger)
        assertEquals(FatigueBeat.WARN_MS, beat.turnBannerWait(1000L))
        assertEquals(0L, beat.turnBannerWait(1000L + FatigueBeat.WARN_MS))
        // The HUD repeat of the same warning does not show it twice.
        assertNull(beat.onTurnStart(1, 9, 1200L))
        assertFalse(beat.holdHome)
        val start = beat.onEvent("fatigue", "", 10, 10_000L)!!
        assertEquals("The fort creaks. Cracked blocks let go.", start.text)
        assertEquals(HudText.FATIGUE_ON, start.text)
        assertTrue(start.danger)
        assertTrue(beat.turnBannerWait(10_500L) > 0)
        // While the collapse plays the camera holds your own fort, until the next shot.
        assertTrue(beat.holdHome)
        assertNull(beat.onEvent("collapse", "fatigue", 10, 10_100L))
        assertTrue(beat.holdHome)
        beat.onEvent("fire", "", 10, 14_000L)
        assertFalse(beat.holdHome)
        beat.reset()
        assertEquals(0L, beat.turnBannerWait(0L))
    }

    @Test fun aResumedRoundNineStillWarnsOnce() {
        val beat = FatigueBeat()
        val b = beat.onTurnStart(1, 9, 50L)
        assertNotNull(b); assertFalse(b!!.danger)
        assertNull(beat.onTurnStart(1, 9, 60L))
        assertNull(beat.onTurnStart(2, 8, 60L))
        assertNull(beat.onTurnStart(-1, 11, 60L))
    }

    // ---- N3: both forts in landscape -------------------------------------------------------

    @Test fun aPhoneFramesBothFortsDownToSixDpBlocks() {
        val dp = 1f
        assertEquals(6f / 16f, Camera.planBlockScale(dp, phone = true), 1e-6f)
        assertEquals(8f / 16f, Camera.planBlockScale(dp, phone = false), 1e-6f)
        assertEquals(Camera.minBlockScale(dp), Camera.planBlockScale(dp, phone = false), 1e-6f)
        // 844 x 390 less the Wide HUD: forts about 1500 cells apart fit at 6 dp blocks, not at 8 dp.
        val a = floatArrayOf(200f, 250f, 330f, 402f); val b = floatArrayOf(1600f, 250f, 1730f, 402f)
        val w = 844f - 68f; val h = 390f - 108f
        assertFalse(Camera.bothFit(a, b, w, h, 24f, Camera.planBlockScale(dp, phone = false)))
        assertTrue(Camera.bothFit(a, b, w, h, 24f, Camera.planBlockScale(dp, phone = true)))
    }

    @Test fun theRivalMarkerIsAOneTapPeek() {
        val p = RivalPeek()
        p.onFrame(3, false)
        assertFalse(p.on); assertEquals("Look at the Rival's fort", p.label())
        p.tap()
        assertTrue(p.on); assertEquals("Back to my fort", p.label())
        p.onFrame(3, false); assertTrue(p.on)
        p.tap(); assertFalse(p.on)
        // A shot brings the camera home.
        p.tap(); p.onFrame(3, true); assertFalse(p.on)
        // So does the next turn.
        p.tap(); p.onFrame(4, false); assertFalse(p.on)
    }

    // ---- Owner rule teaching and turn start -------------------------------------------------

    @Test fun theGoldRingTeachesUntilThreeAimsStartedFromTheFort() {
        assertEquals(3, OwnerRule.TEACH)
        assertTrue(OwnerRule.ringOn(0)); assertTrue(OwnerRule.ringOn(2)); assertFalse(OwnerRule.ringOn(3))
        // The count is saved with progress.
        val back = SaveData.parse(SaveData(aimStarts = 2).toJson())
        assertEquals(2, back.aimStarts)
        assertEquals(0, SaveData.parse("""{"v":1}""").aimStarts)
    }

    @Test fun aSkyDragSaysDragFromYourFortOncePerBattle() {
        assertEquals("Drag back to aim", OwnerRule.NUDGE)
        assertTrue(OwnerRule.nudge(humanTurn = true, hasHob = true, inAimLens = true, shownThisBattle = false))
        assertFalse(OwnerRule.nudge(humanTurn = true, hasHob = true, inAimLens = true, shownThisBattle = true))
        assertFalse(OwnerRule.nudge(humanTurn = false, hasHob = true, inAimLens = true, shownThisBattle = false))
        assertFalse(OwnerRule.nudge(humanTurn = true, hasHob = false, inAimLens = true, shownThisBattle = false))
        assertFalse(OwnerRule.nudge(humanTurn = true, hasHob = true, inAimLens = false, shownThisBattle = false))
    }

    @Test fun aTurnOpensOnAHobWhoCanAct() {
        val crew = listOf(hob(0, "seated", 100, canFire = false), hob(1, "bonked", 0, canFire = false), hob(2, "squashed", 1), hob(3, "seated", 90),
            hob(4, "seated", 90, side = 1))
        // Jax must sit the turn out: the first crewmate who may fire is picked (Bonked ones are skipped).
        assertEquals(2, OwnerRule.openOn(crew, 0, 0))
        // The picked Hob can act: the pick is left alone.
        assertNull(OwnerRule.openOn(crew, 0, 3))
        // Nobody can act: Fire offers Pass as before.
        assertNull(OwnerRule.openOn(listOf(hob(0, "seated", 100, canFire = false)), 0, 0))
        // Never a Hob of the other side.
        assertNull(OwnerRule.openOn(listOf(hob(0, "seated", 100, canFire = false), hob(4, "seated", 90, side = 1)), 0, 0))
    }

    // ---- B1 and n5: results -------------------------------------------------------------------

    @Test fun whatBrokeYouReadsTheByField() {
        val f = parse(ended)
        val last = f.result!!.broke!!.last!!
        assertEquals("hob", last.by)
        // The Hob by its short name (text.json hobs.<id>.short); field blows in the table's words, never the core's English.
        assertEquals("Last blow: Marge's Clodpot, Round 1", BrokeText.last(last, { if (it == 0) "Marge" else null }))
        fun field(by: String, shot: String, name: String, shotName: String) = Blow(shot, shotName, -1, name, 12, 30, by)
        assertEquals("Last blow: the Squall, Round 16", BrokeText.last(Blow("squall", "Squall", -1, "The Squall", 16, 0, "squall")))
        assertEquals("a fall", BrokeText.blow(field("ground", "ground", "A fall", "Fall")))
        assertEquals("the Creaks", BrokeText.blow(field("fatigue", "fatigue", "Fatigue", "Fatigue collapse")))
        assertEquals("your own shot", BrokeText.blow(field("self", "clodpot", "Your own shot", "Clodpot")))
        assertEquals("the shears", BrokeText.blow(field("shears", "shears", "The shears", "Big Snip")))
        assertEquals("Tick-Tock Crock", BrokeText.blow(field("prop", "tick_tock_crock", "A Tick-Tock Crock", "Tick-Tock Crock")))
        // An older core with no `by` and no Hob name still reads.
        assertEquals("the Squall", BrokeText.blow(Blow("squall", "", -1, "", 3, 0)))
        assertEquals("Clodpot", BrokeText.blow(Blow("clodpot", "Clodpot", 0, "", 3, 0)))
    }

    @Test fun theByFieldIsParsedAndNullNamesNeverBreakTheResult() {
        val o = JSONObject(ended)
        val last = o.getJSONObject("result").getJSONObject("broke").getJSONObject("last")
        last.put("by", "fatigue").put("hob", JSONObject.NULL).put("hob_name", "Fatigue").put("shot", "fatigue").put("shot_name", "Fatigue collapse")
        o.getJSONObject("result").getJSONObject("broke").getJSONArray("top").getJSONObject(0).put("hob_name", JSONObject.NULL).put("by", JSONObject.NULL)
        val r = parse(o.toString()).result!!
        assertEquals("fatigue", r.broke!!.last!!.by)
        assertEquals(-1, r.broke!!.last!!.hob)
        assertEquals("Last blow: the Creaks, Round 1", BrokeText.last(r.broke!!.last!!))
        assertEquals("", r.broke!!.top[0].hobName)
        assertEquals("Marge Dumpling's Clodpot", BrokeText.blow(r.broke!!.top[0].copy(hobName = "Marge Dumpling")))
    }

    @Test fun aDoublePopSaysHowTheWinnerWasPicked() {
        val note = BrokeText.doublePop("double_pop")!!
        assertEquals(games.castleprotect.core.Text.t("results.double_pop_rule"), note)
        assertTrue(note.contains("before it wins"))
        assertNull(BrokeText.doublePop("kettle_pop"))
        assertNull(BrokeText.doublePop(null))
    }

    // ---- Against the real core ----------------------------------------------------------------

    private fun ready(): Boolean = System.getProperty("castle.hostJni") != null && NativeCore.available()

    private fun settle(g: CoreGame) {
        var n = 0
        while (JSONObject(g.step(0)).getString("phase").let { it == "resolve" || it == "settle" } && n++ < 40) g.step(600)
    }

    @Test fun nativeCoreIsRulesFive() {
        assumeTrue(ready())
        assertEquals(5, SaveCompat.rulesOf(NativeCore.version()))
        assertEquals(SaveCompat.RULES, SaveCompat.rulesOf(NativeCore.version()))
    }

    @Test fun nativeFatigueBannersComeInOrderAndNoLiveHobReadsAsBonked() {
        assumeTrue(ready())
        val spec = BattleSpec.couch("d1", listOf("A", "B"), 15, 0, true, "one_seat", seed = 5)
        val g = NativeCore.factory()!!.newGame(spec.setup, spec.seed)
        val p = SnapshotParser()
        var f = p.parse(g.snapshot())
        val beat = FatigueBeat()
        val banners = ArrayList<FatigueBeat.Banner>()
        var now = 0L
        var guard = 0
        while (f.hud.round < 11 && f.phase != Phase.ENDED && guard++ < 80) {
            g.command(Cmd.PASS); settle(g)
            f = p.parse(g.snapshot())
            now += 5000
            for (e in f.events) beat.onEvent(e.t, e.why, f.hud.round, now)?.let { banners += it }
            // Only `bonked` (or 0 HP) is out; every other Hob is live, and its pip never reads 0%.
            for (h in f.hobs) if (h.state != "bonked" && h.hp > 0) assertFalse(h.bonked)
            for (side in f.hud.crew) for (c in side) if (c.state != "bonked") assertTrue("pip ${c.id} ${c.hpPct}", c.hpPct >= 1)
        }
        assertEquals(2, banners.size)
        assertFalse(banners[0].danger); assertEquals(FatigueBeat.WARN, banners[0].text)
        assertTrue(banners[1].danger); assertEquals(FatigueBeat.START, banners[1].text)
        g.close()
    }

    @Test fun nativeCouchDuelsPlayedToTheEndNameEveryBlowWithItsDealer() {
        assumeTrue(ready())
        val known = setOf("hob", "squall", "ground", "fatigue", "self", "shears", "prop")
        for (seed in 0L..2L) {
            val g = NativeCore.factory()!!.newGame("""{"level":"d1","mode":"couch","sides":[{"kit":"kit_oak"},{"kit":"kit_reed"}]}""", seed)
            val p = SnapshotParser()
            var f = p.parse(g.snapshot())
            var guard = 0
            while (f.phase != Phase.ENDED && guard++ < 400) {
                when (f.phase) {
                    Phase.DRAFT -> g.command(Cmd.END_DRAFT)
                    Phase.PLAN -> g.command(Cmd.AI_TURN)
                    else -> {}
                }
                settle(g)
                f = p.parse(g.snapshot())
            }
            assertEquals("seed $seed", Phase.ENDED, f.phase)
            val b = f.result!!.broke
            if (b?.last != null) {
                assertTrue(b.last!!.by, b.last!!.by in known)
                assertTrue(b.last!!.hobName.isNotEmpty())
                assertFalse(BrokeText.last(b.last!!).contains("null"))
            }
            b?.top?.forEach { t -> assertTrue(t.by in known); assertTrue(t.hobName.isNotEmpty()) }
            g.close()
        }
    }
}

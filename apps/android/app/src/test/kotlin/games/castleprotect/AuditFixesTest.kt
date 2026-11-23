package games.castleprotect

import games.castleprotect.core.Awaiting
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Block
import games.castleprotect.core.Broke
import games.castleprotect.core.Castle
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.Frame
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.JsonReader
import games.castleprotect.core.Phase
import games.castleprotect.core.Terrain
import games.castleprotect.game.AimMemory
import games.castleprotect.game.AimUi
import games.castleprotect.game.BattleUi
import games.castleprotect.game.BlockLookup
import games.castleprotect.game.FireLight
import games.castleprotect.game.FortGrid
import games.castleprotect.game.Juice
import games.castleprotect.game.LayerMix
import games.castleprotect.game.MusicEngine
import games.castleprotect.game.PreBattleDraft
import games.castleprotect.game.RivalPeek
import games.castleprotect.game.SaveData
import games.castleprotect.game.StreamSink
import games.castleprotect.game.ResultText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Unit tests covering the Android audit fixes (Android-C1..C2, H1..H6, M1..M12, L1..L11).
 */
class AuditFixesTest {
    private fun hob(
        id: Int, side: Int = 0, hp: Int = 100, state: String = "seated",
        buried: Boolean = false, canFire: Boolean = true, angle: Int = 450, power: Int = 50,
    ) = Hob(
        id, side, "marge", "Hob $id", "lobber", hp, 100, state, 0, 100, 200,
        0, null, 0, "clodpot", buried, false, false, false, false, canFire, angle, power,
    )

    // ---- Android-C1: Pre-battle Rummage completion lifecycle ----

    @Test fun preBattleDraftKeepsCompletedHandleForFightAndDropsOnBack() {
        // Active DRAFT phase before last pick.
        assertTrue(PreBattleDraft.activeHandle(live = true, phase = Phase.DRAFT, draftedOnPreBattle = true))
        assertTrue(PreBattleDraft.fightUsesExisting(live = true, phase = Phase.DRAFT, draftedOnPreBattle = true))
        assertTrue(PreBattleDraft.needsEndDraft(Phase.DRAFT))
        assertTrue(PreBattleDraft.skipReplaceConfirm(onPreBattle = true, live = true, phase = Phase.DRAFT, draftedOnPreBattle = true))
        assertTrue(PreBattleDraft.dropOnBack(live = true, phase = Phase.DRAFT, draftedOnPreBattle = true))

        // After picking the last shell, core transitions immediately to PLAN while still on Pre-battle.
        assertTrue(PreBattleDraft.activeHandle(live = true, phase = Phase.PLAN, draftedOnPreBattle = true))
        assertTrue(PreBattleDraft.fightUsesExisting(live = true, phase = Phase.PLAN, draftedOnPreBattle = true))
        assertFalse(PreBattleDraft.needsEndDraft(Phase.PLAN))
        assertTrue(PreBattleDraft.skipReplaceConfirm(onPreBattle = true, live = true, phase = Phase.PLAN, draftedOnPreBattle = true))
        assertTrue(PreBattleDraft.dropOnBack(live = true, phase = Phase.PLAN, draftedOnPreBattle = true))

        // An existing in-progress battle (not drafted on this Pre-battle screen) must still prompt before replacing.
        assertFalse(PreBattleDraft.activeHandle(live = true, phase = Phase.PLAN, draftedOnPreBattle = false))
        assertFalse(PreBattleDraft.fightUsesExisting(live = true, phase = Phase.PLAN, draftedOnPreBattle = false))
        assertFalse(PreBattleDraft.skipReplaceConfirm(onPreBattle = true, live = true, phase = Phase.PLAN, draftedOnPreBattle = false))
        assertFalse(PreBattleDraft.dropOnBack(live = true, phase = Phase.PLAN, draftedOnPreBattle = false))
    }

    // ---- Android-C2: Shove Off Steam check + PASS fallback ----

    @Test fun shoveOffChecksBothPerTurnAndTotalSteam() {
        val enough = Hud(steam = listOf(20, 100), steamTurnLeft = 15, shoveOffCost = 15)
        assertTrue(FireLight.canShoveOff(enough, 0))
        val lowTotal = Hud(steam = listOf(10, 100), steamTurnLeft = 20, shoveOffCost = 15)
        assertFalse(FireLight.canShoveOff(lowTotal, 0))
        val lowTurn = Hud(steam = listOf(50, 100), steamTurnLeft = 10, shoveOffCost = 15)
        assertFalse(FireLight.canShoveOff(lowTurn, 0))
    }

    @Test fun mustPassTriggersOnlyWhenNoHobCanFireOrShoveOffAndNoDoodadsRemain() {
        val buriedCrew = listOf(hob(0, buried = true, canFire = false), hob(1, hp = 0, state = "bonked", canFire = false))
        // Buried, cannot afford Shove Off, no Doodads -> must PASS.
        val stuckHud = Hud(steam = listOf(10, 100), steamTurnLeft = 20, shoveOffCost = 15, doodads = listOf(emptyList(), emptyList()))
        assertTrue(FireLight.mustPass(stuckHud, humanTurn = true, hobs = buriedCrew, side = 0))
        // Not human turn -> never PASS.
        assertFalse(FireLight.mustPass(stuckHud, humanTurn = false, hobs = buriedCrew, side = 0))
        // Doodad available -> player can still use Doodad, so not forced to PASS.
        val withDoodad = stuckHud.copy(doodads = listOf(listOf("mend_bucket"), emptyList()))
        assertFalse(FireLight.mustPass(withDoodad, humanTurn = true, hobs = buriedCrew, side = 0))
        // Can afford Shove Off -> not forced to PASS.
        val canShove = stuckHud.copy(steam = listOf(15, 100), steamTurnLeft = 15)
        assertFalse(FireLight.mustPass(canShove, humanTurn = true, hobs = buriedCrew, side = 0))
        // Another crewmate can fire -> not forced to PASS.
        val oneAble = buriedCrew + hob(2, buried = false, canFire = true)
        assertFalse(FireLight.mustPass(stuckHud, humanTurn = true, hobs = oneAble, side = 0))
    }

    // ---- Android-H1: Cancelled Aim Drag preserves real angle/power ----

    @Test fun battleUiZeroesAimWhileAimUiAndFrameKeepRealValuesForDragCancel() {
        val h = hob(0, side = 0, angle = 635, power = 78)
        val f = Frame(
            1, Phase.PLAN, 0, Awaiting.HUMAN, 1, "1-1", "campaign", 1600, 720, null,
            emptyList(), listOf(h), emptyList(), emptyList(), IntArray(0), emptyList(),
            Hud(turn = 2, selectedHob = 0), null, null, emptyList(), "",
        )
        val ui = BattleUi.of(f)
        // BattleUi intentionally zeroes aim to avoid HUD recomposition during Aim Drag.
        assertEquals(0, ui.selected!!.angle)
        assertEquals(0, ui.selected!!.power)
        // AimUi and AimMemory retain the true core aim so drag cancel restores 635 / 78 instead of 0 / 0.
        val aimUi = AimUi.of(f)
        assertEquals(635, aimUi.angle)
        assertEquals(78, aimUi.power)
        val mem = AimMemory()
        assertEquals(635 to 78, mem.base(f.hud.turn, f.hud.selectedHob, aimUi.angle, aimUi.power))
    }

    // ---- Android-H2: MusicEngine single-thread lifecycle and fast release ----

    @Test fun musicEngineOwnsSinkExclusivelyOnAudioThreadAndReleasesPromptly() {
        val audioThread = AtomicBoolean(true)
        val releasedCount = AtomicInteger(0)
        val rates = ArrayList<Int>()
        val wrote = CountDownLatch(1)
        val slowed = CountDownLatch(1)
        val engine = MusicEngine(master = { 0.8f }, openSink = { rate ->
            if (Thread.currentThread().name != "castle-music") audioThread.set(false)
            object : StreamSink {
                override fun play() { if (Thread.currentThread().name != "castle-music") audioThread.set(false) }
                override fun pause() { if (Thread.currentThread().name != "castle-music") audioThread.set(false) }
                override fun flush() { if (Thread.currentThread().name != "castle-music") audioThread.set(false) }
                override fun stop() { if (Thread.currentThread().name != "castle-music") audioThread.set(false) }
                override fun setPlaybackRate(r: Int) {
                    if (Thread.currentThread().name != "castle-music") audioThread.set(false)
                    synchronized(rates) { rates.add(r) }
                    if (r < rate) slowed.countDown()
                }
                override fun writeNonBlocking(buf: ShortArray, off: Int, len: Int): Int {
                    if (Thread.currentThread().name != "castle-music") audioThread.set(false)
                    wrote.countDown()
                    return len
                }
                override fun release() {
                    if (Thread.currentThread().name != "castle-music") audioThread.set(false)
                    releasedCount.incrementAndGet()
                }
            }
        })
        val pcm = ShortArray(MusicEngine.BLOCK * 4) { 100 }
        val mix = LayerMix(listOf(LayerMix.Layer(pcm, channels = 2))).also { it.set(0, 1f) }
        engine.set(mix, 48000)
        engine.play(true)
        assertTrue("music engine should begin streaming", wrote.await(1, TimeUnit.SECONDS))
        engine.setSlowMo(true)
        assertTrue("slow-mo should lower playback rate", slowed.await(1, TimeUnit.SECONDS))
        engine.setSlowMo(false)
        engine.play(false)
        val t0 = System.nanoTime()
        engine.release()
        val elapsedMs = (System.nanoTime() - t0) / 1_000_000L
        assertTrue("all StreamSink calls must stay on castle-music thread", audioThread.get())
        assertEquals(1, releasedCount.get())
        assertTrue("release should complete quickly without stalling (${elapsedMs}ms)", elapsedMs < 400L)
        assertTrue("slow-mo should lower playback rate", synchronized(rates) { rates.any { it < 48000 } })
    }

    // ---- Android-H3: LayerMix offset/count avoids doubling decode array ----

    @Test fun layerMixReadsFromSliceOffsetAndCount() {
        val padded = ShortArray(16) { (it * 100).toShort() } // 8 stereo frames; slice frames 2..5 (offset 4, count 8)
        val mix = LayerMix(listOf(LayerMix.Layer(padded, channels = 2, offset = 4, count = 8))).also { it.set(0, 1f) }
        val out = ShortArray(12)
        mix.mix(out, 6, 1f)
        // Frame 0 reads padded[4,5], loops after 4 frames back to padded[4,5]
        assertEquals(padded[4], out[0])
        assertEquals(padded[5], out[1])
        assertEquals(padded[4], out[8])
        assertEquals(padded[5], out[9])
    }

    // ---- Android-M1: BlockLookup resolves broken block material from prev frame ----

    @Test fun blockLookupResolvesBrokenBlockFromPreviousFrame() {
        val broken = Block(2, 1, 200, 300, "cobble", 10, 80, true, false, false)
        val standing = Block(0, 0, 168, 316, "wicker", 30, 30, false, true, false)
        val prevCastle = Castle(1, 168, 332, 4, 4, 16, listOf(broken, standing), emptyList(), null, 100, 20, false, IntArray(0), IntArray(0))
        val curCastle = Castle(1, 168, 332, 4, 4, 16, listOf(standing), emptyList(), null, 100, 20, false, IntArray(0), IntArray(0))
        val prev = Frame(10, Phase.RESOLVE, 0, Awaiting.NONE, 1, "1-1", "campaign", 1600, 720, null, listOf(prevCastle), emptyList(), emptyList(), emptyList(), IntArray(0), emptyList(), Hud(), null, null, emptyList(), "")
        val cur = Frame(11, Phase.RESOLVE, 0, Awaiting.NONE, 2, "1-1", "campaign", 1600, 720, null, listOf(curCastle), emptyList(), emptyList(), emptyList(), IntArray(0), emptyList(), Hud(), null, null, emptyList(), "")
        assertEquals("cobble", BlockLookup.material(prev, cur, 1, 2, 1))
        assertEquals("wicker", BlockLookup.material(prev, cur, 1, 0, 0))
        assertNull(BlockLookup.material(prev, cur, 1, 9, 9))
    }

    // ---- Android-M2: Fatigue shake is not cancelled when aiming = false ----

    @Test fun fatigueCollapseShakeSurvivesWhenAimingIsFalse() {
        val juice = Juice({ false }, { 1f })
        juice.addTrauma(0.6f, 300)
        val out = FloatArray(3)
        juice.shake(16f, aiming = false, out)
        assertTrue("trauma should remain positive during Fatigue shake", juice.trauma > 0f)
    }

    // ---- Android-L1: RivalPeek resets between battles ----

    @Test fun rivalPeekResetsCleanlyBetweenBattles() {
        val p = RivalPeek()
        p.onFrame(3, false)
        p.tap()
        assertTrue(p.on)
        p.reset()
        assertFalse(p.on)
        p.onFrame(3, false)
        assertFalse("same turn number in a new battle must not stay zoomed out", p.on)
    }

    // ---- Android-L5: JsonReader bounds-checks malformed escapes & unterminated strings ----

    @Test fun jsonReaderRejectsTruncatedEscapeAndUnterminatedStringCleanly() {
        fun expectsMalformed(bad: String, readString: Boolean) {
            var failed = false
            try {
                val r = JsonReader(bad.toByteArray())
                r.beginObject()
                while (r.hasNext()) { r.nextName(); if (readString) r.nextString() else r.skipValue() }
            } catch (e: JsonReader.Malformed) {
                failed = true
            }
            assertTrue("expected JsonReader.Malformed for $bad", failed)
        }
        expectsMalformed("""{"a":"\u12"}""", readString = true)
        expectsMalformed("""{"a":"\uZZZZ"}""", readString = true)
        expectsMalformed("""{"a":"unterminated""", readString = true)
        expectsMalformed("""{"a":"unterminated""", readString = false)
        expectsMalformed("{\"a\":\"\\", readString = false)
        expectsMalformed("{\"a\":\"\\\"", readString = false)
    }

    // ---- Android-L6: ContentInfo loads app.json and blueprints.json from content/ ----

    @Test fun contentInfoLoadsAppJsonAndBlueprints() {
        val contentDir = File(Fixtures.root, "content")
        val ci = ContentInfo.load(
            read = { rel -> File(contentDir, rel).takeIf { it.isFile }?.readText() },
            list = { File(contentDir, "levels").list()?.toList() ?: emptyList() },
        )
        // From content/app.json (Doodads now open at 1-7).
        assertEquals(org.json.JSONObject(Fixtures.text("content/app.json")).getJSONObject("campaign").getString("doodads_from"), ci.app.doodadsFrom)
        assertEquals(listOf("mend_bucket", "pot_lid"), ci.app.campaignDoodads)
        assertEquals("1-5", ci.app.modesAfter)
        assertEquals(0 to 0, ci.app.windRange(0))
        assertEquals(0 to 3, ci.app.windRange(1))
        assertEquals(0 to 6, ci.app.windRange(2))
        assertEquals(8, ci.app.workshopCols)
        assertEquals(9, ci.app.workshopRows)
        assertEquals(5, ci.app.workshopMaxNooks)
        assertTrue(ci.app.levelAtLeast("1-10", "1-10"))
        assertFalse(ci.app.levelAtLeast("1-9", "1-10"))
        assertNotNull(ci.blueprint("bp_home_3"))
        assertTrue(ci.hasSelfTarget("mendglob"))
        assertTrue("puff_up" in ci.shotDials("barn_raising"))
        assertTrue(ci.doodadCard("pot_lid").isNotEmpty())
        val lv10 = ci.level("1-10")
        assertNotNull(lv10)
        assertTrue(lv10!!.playerCrew.isNotEmpty())
    }

    // ---- Android-L10 & M11: Kettle nudge, Terrain cw <= 0, SaveData dailyDate, the broke tally ----

    @Test fun workshopKettleCanNudgeOneCellOverItsOwnFootprint() {
        val g = FortGrid.fromRows(Fixtures.homeRows)
        // HOME has K at cols 1..2, rows 0..1 (above Footing). Nudging K to col 2..3 (or 0..1) should succeed!
        assertFalse("placing K at exact same spot is a no-op", g.place('K', 1, 0))
        // Clear timber at (0,0) and (0,1) so col 0..1 is open beside K at 1..2
        assertTrue(g.place('.', 0, 0))
        assertTrue(g.place('.', 0, 1))
        assertTrue("nudging K left onto overlapping cells should succeed", g.place('K', 0, 0))
        assertEquals('K', g[0, 0]); assertEquals('K', g[1, 1])
        assertEquals('.', g[2, 0]); assertEquals('.', g[2, 1])
    }

    @Test fun terrainWriteChunkIgnoresNonPositiveChunkDimensions() {
        val t = Terrain(16, 16)
        t.writeChunk(0, 0, 0, 4, "AAAA".toByteArray(), 0, 4)
        t.writeChunk(0, 0, 4, 0, "AAAA".toByteArray(), 0, 4)
        assertEquals(0, t.version)
    }

    @Test fun saveDataRoundTripsDailyDateAndTheBrokeTally() {
        val saved = SaveData(buttons = 42, dailyDate = "2026-11-23")
        val back = SaveData.parse(saved.toJson())
        assertEquals("2026-11-23", back.dailyDate)
        assertEquals(42, back.buttons)

        // What broke a side is one tally line from the string table, the same words for you or the other player.
        val b = Broke(1, "kettle_pop", null, emptyList(), kettleLost = 120, blocksLost = 4, hobsBonked = 1)
        assertEquals("Kettle 120. Blocks 4. Bonked: 1.", ResultText.tally(b))
        val g = Broke(1, "give_up", null, emptyList(), kettleLost = 0, blocksLost = 0, hobsBonked = 0)
        assertEquals("Kettle 0. Blocks 0. Nobody Bonked.", ResultText.tally(g))
    }

    @Test fun battleSpecWithSide0RowsReplacesRowsCleanly() {
        val spec = BattleSpec.campaign("1-3", "fair", seed = 9)
        val custom = spec.withSide0Rows(Fixtures.homeRows)
        assertTrue(custom.setup.contains("\"rows\""))
        val cleared = custom.withSide0Rows(null)
        assertFalse(cleared.setup.contains("\"rows\""))
    }
}

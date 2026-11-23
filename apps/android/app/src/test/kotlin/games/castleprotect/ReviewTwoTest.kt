package games.castleprotect

import android.media.AudioManager
import games.castleprotect.battle.AnimClip
import games.castleprotect.battle.Anims
import games.castleprotect.battle.Camera
import games.castleprotect.battle.CollapsePlan
import games.castleprotect.battle.CostLru
import games.castleprotect.battle.FieldFx
import games.castleprotect.battle.SpriteSource
import games.castleprotect.battle.Sprites
import games.castleprotect.core.Cmd
import games.castleprotect.core.CoreFactory
import games.castleprotect.core.CoreGame
import games.castleprotect.core.Frame
import games.castleprotect.core.GameEvent
import games.castleprotect.core.Hud
import games.castleprotect.core.LiveBattle
import games.castleprotect.core.Phase
import games.castleprotect.core.Reply
import games.castleprotect.core.SnapshotParser
import games.castleprotect.game.AimMemory
import games.castleprotect.game.AimUi
import games.castleprotect.game.Announce
import games.castleprotect.game.AudioRules
import games.castleprotect.game.BattleUi
import games.castleprotect.game.FocusState
import games.castleprotect.game.Juice
import games.castleprotect.game.LayerMix
import games.castleprotect.game.LoopWants
import games.castleprotect.game.SoundGate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The fixes for docs/review/code/android-review-2.md, one or more tests each. */
class ReviewTwoTest {
    private val anims = Anims.parse(Fixtures.text("assets/animations.json"))
    private val plan = SnapshotParser().parse(Fixtures.fixture("snapshot_plan.json").toByteArray())

    private class CountingSprites : SpriteSource {
        var gets = 0
        override var generation = 0
        override fun get(name: String): Sprites.Sprite? { gets++; return null }
    }

    private fun fieldFx(sprites: SpriteSource = CountingSprites(), beats: MutableList<FloatArray>? = null): FieldFx {
        val fx = FieldFx(sprites, 1f, cue = { _, _, _, _ -> }, beat = { k, n, x, y -> if (k == "collapse_land") beats?.add(floatArrayOf(n.toFloat(), x, y)) }, reduceMotion = { false }, trailOf = { "lob" })
        fx.anims = anims
        return fx
    }

    private fun ev(t: String, side: Int = 0, blocks: IntArray = GameEvent.EMPTY_INTS, falls: IntArray = GameEvent.EMPTY_INTS, c: Int = 0, r: Int = 0) =
        GameEvent(t, 0, 0, 0, r, side, -1, 0, 0, -1, 0, "", "", "", false, c = c, blocks = blocks, falls = falls)

    private fun frameOf(f: Frame, events: List<GameEvent> = emptyList(), hud: Hud = f.hud, phase: Phase = f.phase, fullSeq: Int = f.fullSeq) =
        Frame(f.tick, phase, f.side, f.awaiting, fullSeq, f.level, f.mode, f.mapW, f.mapH, f.terrain, f.castles, f.hobs, f.shells, f.props,
            f.preview, f.ghosts, hud, f.draft, f.result, events, f.hash)

    // ---- N-H1: audio focus ----------------------------------------------------

    @Test fun focusComesBackWhenARequestIsGrantedAfterAFullLoss() {
        val s = FocusState()
        s.onRequest(AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
        s.onChange(AudioManager.AUDIOFOCUS_LOSS)
        assertEquals(0f, s.music)
        assertEquals("effects keep playing after a full loss", 1f, s.effects)
        assertFalse("no grab back on its own", s.shouldRequest(wanted = true, playerAction = false))
        assertTrue(s.shouldRequest(wanted = true, playerAction = true))
        // No GAIN callback comes for a granted request: the grant itself restores the music.
        s.onRequest(AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
        assertEquals(1f, s.music); assertTrue(s.held); assertFalse(s.lost)
        s.onChange(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)
        assertEquals(0f, s.effects)
        s.onChange(AudioManager.AUDIOFOCUS_GAIN)
        assertEquals(1f, s.effects); assertEquals(1f, s.music)
        assertFalse("no focus while music is silent", s.shouldRequest(AudioRules.wantsFocus(muteAll = false, music = 0), true))
        assertFalse(AudioRules.wantsFocus(muteAll = true, music = 70))
    }

    // ---- N-H2: sound lock ------------------------------------------------------

    @Test fun theFirstTapAnywhereOpensTheSoundOnceAndForGood() {
        var writes = 0
        val g = SoundGate(open = false) { writes++ }
        assertFalse(g.open)
        assertTrue(g.tap())
        assertTrue(g.open)
        assertFalse(g.tap())
        assertEquals(1, writes)
        val later = SoundGate(open = true) { writes++ }
        assertFalse(later.tap()); assertEquals(1, writes)
    }

    // ---- N-H3: collapse placement ----------------------------------------------

    @Test fun collapsePiecesStartAtTheirCellAndLandWhereTheCoreSays() {
        val k = plan.castles.first { it.side == 0 }
        // As effects.rs sends it: blocks at the cells before the fall, falls in cells per column.
        val e = ev("collapse", 0, blocks = intArrayOf(3, 4, 1, 3, 5, 1), falls = intArrayOf(3, 32))
        val p = CollapsePlan.of(e, k.x, k.baseY)
        assertEquals(k.baseY - 16f * 5, p[0].startY)
        assertEquals(k.baseY - 16f * 5 + 32f, p[0].landY)
        assertEquals(k.baseY - 16f * 6, p[1].startY)

        val beats = ArrayList<FloatArray>()
        val fx = fieldFx(beats = beats)
        fx.update(plan, 0f)
        fx.onFrame(frameOf(plan, listOf(e)))
        val ys = fx.pieceYs()
        assertEquals(k.baseY - 16f * 5, ys[0].first)
        assertEquals(k.baseY - 16f * 5 + 32f, ys[0].second)
        repeat(200) { fx.update(plan, 16f) }
        assertEquals(1, beats.size)
        assertEquals("the land beat is at the landing place", k.baseY - 16f * 5 + 32f, beats[0][2])
    }

    // ---- M6 / N-M2: ambient effects do not keep the field at full rate --------------

    @Test fun windLeavesAreAmbient() {
        val fx = fieldFx()
        val windy = frameOf(plan, hud = plan.hud.copy(wind = 8))
        repeat(300) { fx.update(windy, 16f) }
        assertTrue("leaves are spawned", fx.effectCount > 0)
        assertFalse("but they do not make the field busy", fx.busy)
    }

    // ---- N-M1: rubble ----------------------------------------------------------

    @Test fun rubbleClipEndsWithItsFramesAndTheHoldFades() {
        val fx = fieldFx()
        fx.update(plan, 0f)
        val b = plan.castles[0].blocks[0]
        fx.onFrame(frameOf(plan, listOf(ev("break", 0, c = b.c, r = b.r))))
        assertTrue(fx.busy)
        repeat(40) { fx.update(plan, 16f) } // 640 ms: chunks and the rubble clip are gone
        assertEquals(0, fx.effectCount)
        repeat(150) { fx.update(plan, 16f) } // past the 1.5 s hold and its fade
        assertFalse(fx.busy)
    }

    // ---- N-M5: relit kettle ------------------------------------------------------

    @Test fun aRelitKettleDropsThePoppedLook() {
        val fx = fieldFx()
        fx.update(plan, 0f)
        fx.onFrame(frameOf(plan, listOf(ev("kettle_pop", 0))))
        fx.update(plan, 16f)
        assertNotNull(fx.kettleClip(0))
        fx.onFrame(frameOf(plan, listOf(ev("relight", 0))))
        assertNull(fx.kettleClip(0))
    }

    // ---- N-M8 / H8: sprites resolved per frame change, not per draw -----------------

    @Test fun aClipSpriteIsLookedUpOnlyWhenItsFrameChanges() {
        val src = CountingSprites()
        val fx = fieldFx(src)
        val clip = AnimClip(anims, anims["hob_marge_blue_idle"]!!)
        repeat(10) { fx.spriteOf(clip) }
        assertEquals(1, src.gets)
        clip.advance(10_000f)
        fx.spriteOf(clip); fx.spriteOf(clip)
        assertTrue(src.gets <= 2)
        val before = src.gets
        src.generation++
        fx.spriteOf(clip)
        assertEquals("a dropped cache resolves again", before + 1, src.gets)
    }

    // ---- N-M4: Recall then Fine Tune -------------------------------------------------

    @Test fun recallForgetsTheLastAimSent() {
        val m = AimMemory()
        m.sent(turn = 3, hob = 1, angle = 600, power = 80)
        assertEquals(600 to 80, m.base(3, 1, 450, 50))
        m.forget() // Recall
        assertEquals("the next step starts from the recalled aim", 450 to 50, m.base(3, 1, 450, 50))
        m.sent(3, 1, 610, 80)
        assertEquals(450 to 50, m.base(4, 1, 450, 50)) // a new turn
    }

    // ---- N-M9: aim steps do not change the HUD state ---------------------------------

    @Test fun anAimStepGivesAnEqualBattleUi() {
        val h = plan.selectedHob ?: plan.hobs.first()
        val moved = Frame(plan.tick, plan.phase, plan.side, plan.awaiting, plan.fullSeq, plan.level, plan.mode, plan.mapW, plan.mapH, plan.terrain,
            plan.castles, plan.hobs.map { if (it.id == h.id) it.copy(angle = it.angle + 5, power = (it.power + 1).coerceAtMost(100)) else it },
            plan.shells, plan.props, plan.preview, plan.ghosts, plan.hud, plan.draft, plan.result, emptyList(), plan.hash)
        assertEquals(BattleUi.of(plan), BattleUi.of(moved))
        assertNotEquals(AimUi.of(plan), AimUi.of(moved))
    }

    // ---- N-M11: TalkBack hears the shot result ------------------------------------------

    @Test fun announcementsOfOneFrameAreJoinedAndRepeatsStillChange() {
        assertEquals("Rival hit: 2 blocks, 40 damage. Your turn.", Announce.join(listOf("Rival hit: 2 blocks, 40 damage.", "Your turn")))
        val a = Announce.distinct("", "Your turn")
        val b = Announce.distinct(a, "Your turn")
        assertNotEquals(a, b)
    }

    // ---- N-M12: collapse beats never run into the next turn ----------------------------

    @Test fun aNewTurnEndsSlowMotionAndHitStop() {
        val j = Juice()
        assertTrue(j.slowMo(0.5f, 600, 1000))
        j.hitStop(50, 1000, false)
        j.newTurn()
        assertEquals(1f, j.scale(1100), 0f)
    }

    // ---- N-M13, N-M16: LiveBattle --------------------------------------------------------

    private class Fake(val phase: String = "plan", val panicOn: String? = null, val resumeThrows: Boolean = false) : CoreGame {
        var closed = false
        var dead = false
        val cmds = ArrayList<String>()
        override fun command(json: String): String {
            if (dead) return """{"ok":false,"reason":"dead_handle"}"""
            val c = JSONObject(json).getString("cmd")
            cmds.add(c)
            if (c == "resume" && resumeThrows) throw games.castleprotect.core.CoreException("bad log")
            if (c == "log") return """{"ok":true,"log":[{"cmd":"pick_hob","hob":0}]}"""
            if (c == panicOn) { dead = true; return """{"ok":false,"reason":"panic"}""" }
            return """{"ok":true}"""
        }
        override fun step(ticks: Int) = """{"tick":0,"phase":"$phase"}"""
        override fun snapshot() = "{}".toByteArray()
        override fun close() { closed = true }
    }

    @Test fun carryOnIntoARummageSaveEndsTheDraft() {
        val g = Fake(phase = "draft")
        val b = LiveBattle.open(object : CoreFactory { override val name = "f"; override val standIn = false; override fun newGame(setupJson: String, seed: Long) = g }, "{}", 1)
        assertTrue(b.finishDraft())
        assertEquals("end_draft", g.cmds.last { it != "log" })
    }

    @Test fun aFailedRebuildClosesItsHandleAndTheDroppedMoveIsReported() {
        val made = ArrayList<Fake>()
        val fac = object : CoreFactory {
            override val name = "f"; override val standIn = false
            override fun newGame(setupJson: String, seed: Long) = (if (made.isEmpty()) Fake(panicOn = "fire") else Fake(resumeThrows = true)).also { made.add(it) }
        }
        val b = LiveBattle.open(fac, "{}", 1)
        val busy = ArrayList<Boolean>()
        b.onRebuild = { busy.add(it) }
        b.command(Cmd.pickHob(0))
        assertFalse(Reply.parse(b.command(Cmd.fire())).ok)
        assertEquals("fire", b.takeDropped())
        assertNull(b.takeDropped())
        assertTrue("the new handle is closed", made[1].closed)
        assertNotNull(b.broken)
        assertEquals(listOf(true, false), busy)
    }

    @Test fun aPanicThatRepeatsRightAfterARebuildGivesUpAtOnce() {
        val made = ArrayList<Fake>()
        val fac = object : CoreFactory {
            override val name = "f"; override val standIn = false
            override fun newGame(setupJson: String, seed: Long) = Fake(panicOn = "fire").also { made.add(it) }
        }
        val b = LiveBattle.open(fac, "{}", 1)
        b.command(Cmd.fire())
        assertNull(b.broken)
        b.command(Cmd.fire())
        assertNotNull(b.broken)
        assertEquals("one rebuild, not three", 2, made.size)
    }

    // ---- N-M7: music layers ----------------------------------------------------------

    @Test fun layersLoopBySampleCountAndStayOnTheSameSample() {
        val base = ShortArray(8 * 2) { (it / 2 + 1).toShort() }   // stereo, 8 frames: 1..8
        val stir = ShortArray(8) { (100 * (it + 1)).toShort() }    // mono
        val m = LayerMix(listOf(LayerMix.Layer(base, 2), LayerMix.Layer(stir, 1)))
        m.set(0, 1f); m.set(1, 1f)
        val out = ShortArray(20 * 2)
        m.mix(out, 20, 1f)
        // Frame 8 is frame 0 again: no gap, and both layers wrap together.
        assertEquals(out[0], out[16]); assertEquals(out[0], out[32])
        assertEquals((1 + 100).toShort(), out[0])
        assertEquals((8 + 800).toShort(), out[14])
        assertEquals(20, m.played.toInt()); assertEquals(4, m.position)
        // A fade starts on the next bar line.
        assertEquals(24L, m.nextBar(8))
        m.fade(1, 0f, m.nextBar(8), 1)
        val out2 = ShortArray(8 * 2)
        m.mix(out2, 8, 1f)
        assertEquals((5 + 500).toShort(), out2[0])        // still on before the bar
        assertEquals(2, out2[10].toInt())                 // just after the bar line: Stir is silent
    }

    @Test fun decodedLoopsAreCutToTheirSamplesAfterTheEncoderDelay() {
        assertEquals(listOf(2112, 48000), AudioRules.window(48000 + 2112 + 900, 48000, null, aac = true).toList())
        assertEquals(listOf(1024, 48000), AudioRules.window(50000, 48000, 1024, aac = true).toList())
        assertEquals(listOf(0, 48000), AudioRules.window(48312, 48000, null, aac = false).toList())
        assertEquals(listOf(0, 40000), AudioRules.window(40000, 48000, null, aac = true).toList())
    }

    // ---- N-M14: loops and the steal order ---------------------------------------------

    @Test fun aLoopThatCouldNotStartStaysWanted() {
        val w = LoopWants()
        w.set("wx_wind_loop", true, 0.5f, 0f)
        w.started("wx_wind_loop", false)
        assertEquals(listOf("wx_wind_loop"), w.pending())
        w.started("wx_wind_loop", true)
        assertTrue(w.pending().isEmpty())
        w.set("wx_wind_loop", false, 0f, 0f)
        assertTrue(w.all().isEmpty())
        assertTrue(AudioRules.priority("impact", "hit_blast_large") > AudioRules.priority("material", "mat_timber_hit"))
        assertTrue(AudioRules.priority("kettle", "ket_pop") > AudioRules.priority("voice", "bark_marge_fire"))
        assertTrue(AudioRules.priority("ui", "ui_tap") < AudioRules.priority("flight", "fly_split"))
    }

    // ---- N-M10: bounded sprite cache --------------------------------------------------

    @Test fun theSpriteCacheIsBoundedByBytes() {
        val c = CostLru<String, Long>(100) { it }
        c.put("a", 40); c.put("b", 40)
        c["a"] // a is now newer than b
        assertEquals(1, c.put("c", 40))
        assertTrue(c.containsKey("a")); assertFalse(c.containsKey("b"))
        assertEquals(80, c.total)
    }

    // ---- lens and layout lookups fall back ----------------------------------------------

    @Test fun aMissingFortFallsBackAndNeverCrashes() {
        assertEquals(0, Camera.fortOrNull(plan.castles, 0)?.side)
        assertNull(Camera.fortOrNull(plan.castles.take(1), 1)?.takeIf { it.side == 1 })
        assertNull(Camera.fortOrNull(emptyList(), 0))
    }

    // ---- N-L3: events on the real frame when playing backwards -------------------------

    @Test fun aBackwardsClipFiresEventsOnTheirOwnFrame() {
        val d = anims["pot_lid_raise"]!!
        val up = d.events.indexOfFirst { "up" in it }
        val back = AnimClip(anims, d, backwards = true)
        var at = -1
        back.advance(0f) { if (it == "up") at = back.frame }
        back.advance(1000f) { if (it == "up" && at < 0) at = back.frame }
        assertEquals(up, at)
    }

    // ---- N-L15: set-aside saves do not pile up ------------------------------------------

    @Test fun onlyTheNewestTwoSetAsideSavesAreKept() {
        val dir = kotlin.io.path.createTempDirectory("saves").toFile()
        for (t in listOf(5L, 1L, 9L, 3L)) java.io.File(dir, "castle.sav.bad-$t").writeText("x")
        games.castleprotect.game.SaveStore(dir, "castle.sav").pruneSetAside()
        assertEquals(setOf("castle.sav.bad-9", "castle.sav.bad-5"), dir.list()!!.filter { it.contains(".bad-") }.toSet())
        dir.deleteRecursively()
    }
}

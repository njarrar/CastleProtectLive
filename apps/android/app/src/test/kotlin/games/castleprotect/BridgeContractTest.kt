package games.castleprotect

import games.castleprotect.core.Campaign
import games.castleprotect.core.Cmd
import games.castleprotect.core.FakeCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Snapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Exercises the CoreBridge contract the app relies on (commands in, snapshots out,
 * save and load) against the stand-in core. The same flow must hold for the native core.
 */
class BridgeContractTest {
    private fun ok(r: String) = r.contains("\"ok\":true")
    private fun snap(c: FakeCore) = Snapshot.parse(c.snapshot())

    @Test fun duelFlowWithDraftHandoffAndSave() {
        val c = FakeCore()
        assertTrue(ok(c.command(Cmd.newBattle("duel", names = listOf("Mabel", "Otis"), seed = 42))))
        var s = snap(c)
        assertEquals(Phase.PRE, s.hud.phase)
        assertEquals(6, s.hud.draft!!.pool.size)
        assertTrue(ok(c.command(Cmd.draftPick(s.hud.draft!!.pool[0].id))))
        assertTrue(ok(c.command(Cmd.END_DRAFT)))
        s = snap(c)
        assertEquals(Phase.PLAN, s.hud.phase)
        assertTrue(s.hud.humanTurn)
        assertEquals(2, s.forts.size)
        assertFalse(s.hud.canFire)
        assertFalse("Fire is locked until an aim exists", ok(c.command(Cmd.FIRE)))
        assertTrue(ok(c.command(Cmd.aim(625, 74))))
        s = snap(c)
        assertEquals(625, s.hud.aimAngle); assertEquals(74, s.hud.aimPower)
        assertTrue(s.hud.canFire); assertTrue(s.preview.isNotEmpty())
        assertTrue(ok(c.command(Cmd.FIRE)))
        assertEquals(Phase.FLIGHT, snap(c).hud.phase)
        var guard = 0
        while (snap(c).hud.phase != Phase.HANDOFF && guard++ < 2000) c.advance(16)
        s = snap(c)
        assertEquals(Phase.HANDOFF, s.hud.phase)
        assertEquals(1, s.hud.handoff!!.toSide)
        // A battle saved on the hand-off card resumes on it.
        val saved = c.save()
        val d = FakeCore()
        assertTrue(d.load(saved))
        assertEquals(Phase.HANDOFF, snap(d).hud.phase)
        assertTrue(ok(d.command(Cmd.READY)))
        s = snap(d)
        assertEquals(Phase.PLAN, s.hud.phase); assertEquals(1, s.hud.activeSide)
    }

    @Test fun campaignBattleRunsToAResult() {
        val c = FakeCore()
        c.command(Cmd.newBattle("campaign", level = "1-1", seed = 7))
        c.command(Cmd.END_DRAFT)
        var s = snap(c)
        var guard = 0
        while (s.hud.phase != Phase.ENDED && guard++ < 200000) {
            if (s.hud.humanTurn) { c.command(Cmd.aim(450 + (guard % 40) * 5, 60 + guard % 30)); c.command(Cmd.FIRE) }
            c.advance(50)
            s = snap(c)
        }
        assertEquals(Phase.ENDED, s.hud.phase)
        assertNotNull(s.hud.result)
        val camp = Campaign.parse(c.query("""{"q":"campaign"}"""))
        assertEquals(10, camp.levels.size)
    }
}

package games.castleprotect

import games.castleprotect.core.CoreFault
import games.castleprotect.core.SnapshotParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** Core v0.2 snapshot fields (core/API.md "Changes in v0.2") against the regenerated fixtures. */
class CoreV02Test {
    private fun parse(name: String) = SnapshotParser().parse(Fixtures.bytes("core/fixtures/$name"))

    @Test fun hudCarriesTheNewFields() {
        val f = parse("snapshot_plan.json")
        assertEquals(2, f.hud.steamMax.size)
        assertEquals(15, f.hud.shoveOffCost)
        assertTrue(f.hud.shots.isNotEmpty())
        assertEquals("plain", f.hud.shots[0].shot)
        assertNotNull(f.hud.chip("plain"))
        assertEquals(2, f.hud.handicap.size)
        assertNull(f.hud.volley)
    }

    @Test fun endedSnapshotHasTheWholeResult() {
        val f = parse("snapshot_ended.json")
        val r = f.result!!
        assertEquals("give_up", r.how)
        assertEquals(0, r.winner)
        assertEquals(2, r.score.size)
        assertEquals(2, r.stats.size)
        assertEquals(1, r.stats[0].shots)
        val b = r.broke!!
        assertEquals(1, b.side)
        assertEquals("give_up", b.how)
        assertEquals("Clodpot", b.last!!.shotName)
        assertTrue(b.top.isNotEmpty())
        // Couch Duel with Help: the handicap is open in the HUD.
        assertEquals("some", f.hud.handicap[0].help)
        assertEquals(1, f.hud.handicap[0].marks)
        assertEquals(45, f.hud.handicap[1].previewPct)
        // The win event carries its fields; castle_drop its cells.
        assertTrue(f.events.any { it.t == "win" && it.how == "give_up" && it.winner == 0 })
        assertTrue(f.events.any { it.t == "castle_drop" && it.cells == 3 })
        assertTrue(f.events.any { it.t == "fire" && it.shot == "clodpot" && it.power == 78 })
        assertTrue(f.events.any { it.t == "explode" && it.type == "blast" && it.r == 28 })
    }

    @Test fun bossAndRescueLevels() {
        val boss = parse("snapshot_boss_1_10.json")
        assertEquals(1, boss.hud.boss!!.phase)
        assertFalse(boss.hud.boss!!.rollerDone)
        assertTrue(boss.castles.any { k -> k.blocks.any { it.root } })
        val rescue = parse("snapshot_rescue_1_7.json")
        assertEquals("cage", rescue.hud.rules.objectiveTag)
        assertEquals(2, rescue.hud.rules.objectiveCount)
        assertEquals(1, rescue.hud.rules.capWin)
        assertEquals(4, rescue.props.size)
        assertEquals("captive", rescue.props.last().kind)
    }

    @Test fun aLeanAimSnapshotMovesTheSelectedHobsAim() {
        val p = SnapshotParser()
        p.parse(Fixtures.bytes("core/fixtures/snapshot_plan.json"))
        val lean = p.parse(Fixtures.bytes("core/fixtures/snapshot_aim_lean.json"))
        val hob = lean.hobs.first { it.id == 0 && it.side == 0 }
        assertEquals(455, hob.angle)
        assertEquals(62, hob.power)
        assertTrue(lean.preview.isNotEmpty())
    }

    @Test fun collapseEventsKeepBlocksAndFalls() {
        val text = """{"tick":5,"phase":"settle","side":0,"awaiting":"none","full":false,"terrain":{"chunks":[]},"shells":[],
            "events":[{"t":"collapse","tick":5,"side":1,"blocks":[[2,3,"timber"],[2,4,"wicker"]],"falls":[[2,32]]},
                      {"t":"walk","tick":5,"side":0,"from":[300,390],"to":[340,388],"steam":10},
                      {"t":"roller_move","tick":5,"from":900,"to":780,"y":400,"why":"roll"},
                      {"t":"big_drop","tick":5,"callout":true,"blocks":5}]}"""
        val f = SnapshotParser().parse(text.toByteArray())
        val c = f.events[0]
        assertEquals(2, c.blockCount)
        assertEquals(listOf(2, 3, 1, 2, 4, 0), c.blocks.toList())
        assertEquals(listOf(2, 32), c.falls.toList())
        val w = f.events[1]
        assertEquals(300, w.fromX); assertEquals(390, w.fromY); assertEquals(340, w.toX)
        assertEquals(900, f.events[2].fromX); assertEquals(780, f.events[2].toX)
        assertEquals(5, f.events[3].blockCount)
        assertTrue(f.events[3].callout)
    }

    @Test fun aDeadHandleSnapshotIsAFault() {
        val p = SnapshotParser()
        val good = p.parse(Fixtures.bytes("core/fixtures/snapshot_plan.json"))
        for (reason in listOf("panic", "dead_handle", "null_handle")) {
            try {
                p.parse("""{"ok":false,"reason":"$reason","detail":"boom"}""".toByteArray())
                fail("no fault for $reason")
            } catch (e: CoreFault) {
                assertEquals(reason, e.reason)
                assertTrue(e.dead)
            }
            assertEquals(good.hash, p.current.hash)
        }
    }
}

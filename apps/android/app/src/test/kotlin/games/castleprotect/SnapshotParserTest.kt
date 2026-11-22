package games.castleprotect

import games.castleprotect.core.Awaiting
import games.castleprotect.core.FixtureCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Reply
import games.castleprotect.core.SnapshotParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** The snapshot parser against the golden files the Rust core writes (core/fixtures). */
class SnapshotParserTest {
    private val plan = Fixtures.fixture("snapshot_plan.json")
    private val lean = Fixtures.fixture("snapshot_lean.json")
    private val after = Fixtures.fixture("snapshot_after_shot.json")

    @Test fun fullPlanSnapshot() {
        val f = SnapshotParser().parse(plan.toByteArray())
        assertEquals(Phase.PLAN, f.phase)
        assertEquals(Awaiting.HUMAN, f.awaiting)
        assertTrue(f.humanTurn)
        assertEquals("1-1", f.level)
        assertEquals("campaign", f.mode)
        assertEquals(1600, f.mapW); assertEquals(720, f.mapH)
        assertEquals(2, f.castles.size)
        val c0 = f.castles[0]
        assertEquals(0, c0.side); assertEquals(344, c0.x); assertEquals(390, c0.baseY); assertEquals(16, c0.block)
        assertTrue(c0.blocks.isNotEmpty())
        assertEquals("footing", c0.blocks[0].mat)
        assertEquals(374, c0.blocks[0].y)
        assertNotNull(c0.kettle)
        assertEquals(300, c0.kettle!!.max)
        assertTrue(c0.rooms.any { it.kind == "nook" && it.loophole.size == 4 })
        // Hobs are top level, with aim per Hob.
        val marge = f.hobs.first { it.def == "marge" }
        assertEquals(0, marge.side); assertEquals(450, marge.angle); assertEquals(62, marge.power); assertTrue(marge.canFire)
        assertEquals(marge, f.selectedHob)
        assertEquals(listOf("human", "ai"), f.hud.control)
        assertEquals(listOf(100, 100), f.hud.kettlePct)
        assertEquals(1, f.hud.round)
        assertEquals(-1, f.hud.squallWarning)
        assertTrue(f.preview.size >= 4 && f.preview.size % 2 == 0)
        assertEquals(375, f.preview[0]); assertEquals(309, f.preview[1])
        assertNull(f.draft); assertNull(f.result)
        assertEquals(16, f.hash.length)
    }

    @Test fun leanSnapshotKeepsTheLastFullOne() {
        val p = SnapshotParser()
        val full = p.parse(plan.toByteArray())
        val l = p.parse(lean.toByteArray())
        assertEquals(Phase.RESOLVE, l.phase)
        assertEquals(Awaiting.NONE, l.awaiting)
        assertEquals(30, l.tick)
        assertEquals(full.fullSeq, l.fullSeq)
        assertSame(full.castles, l.castles)
        assertSame(full.hobs, l.hobs)
        assertSame(full.hud, l.hud)
        assertEquals(1, l.shells.size)
        val s = l.shells[0]
        assertEquals(1, s.id); assertEquals(505, s.x); assertEquals(195, s.y); assertEquals(362, s.rot); assertEquals("clodpot", s.shot)
    }

    @Test fun afterShotEventsAndGhosts() {
        val p = SnapshotParser()
        p.parse(plan.toByteArray())
        val f = p.parse(after.toByteArray())
        assertEquals(Phase.PLAN, f.phase)
        assertEquals(1, f.side)
        assertEquals(Awaiting.AI, f.awaiting)
        val boom = f.events.first { it.t == "explode" }
        assertEquals(1301, boom.x); assertEquals(317, boom.y); assertEquals(28, boom.r)
        assertTrue(f.events.any { it.t == "break" && it.side == 1 })
        assertTrue(f.events.any { it.t == "turn_start" && it.side == 1 })
        val g = f.ghosts.first()
        assertTrue(g.hasPin)
        assertEquals(1301, g.pinX)
        assertTrue(g.points.size > 10)
        // Broken blocks are gone from the standing list.
        assertTrue(f.castles[1].blocks.none { it.c == 2 && it.r == 6 })
    }

    @Test fun eventsCanBeDroppedForAReplay() {
        val f = SnapshotParser().parse(after.toByteArray(), keepEvents = false)
        assertTrue(f.events.isEmpty())
    }

    @Test fun terrainChunksDecodeIntoTheGrid() {
        val p = SnapshotParser()
        val frame = p.parse(plan.toByteArray())
        val withGround = FixtureCore.withGround(plan, frame)
        val f = SnapshotParser().parse(withGround.toByteArray())
        val t = f.terrain!!
        assertEquals(1600, t.w); assertEquals(720, t.h)
        val ground = f.castles.minOf { it.baseY }
        assertEquals(0, t.cells[(ground - 1) * t.w + 10].toInt())
        assertEquals(1, t.cells[ground * t.w + 10].toInt())
        assertEquals(ground, t.groundAt(800))
        assertEquals(ground, t.groundAt(-50))
        assertEquals(ground, t.groundAt(99999))
        val dirty = ArrayList<IntArray>()
        t.takeDirty(dirty)
        assertTrue(dirty.isNotEmpty())
    }

    @Test fun badInputKeepsTheLastGoodFrame() {
        val p = SnapshotParser()
        val good = p.parse(plan.toByteArray())
        try { p.parse(plan.substring(0, plan.length / 2).toByteArray()); fail("should throw") } catch (e: RuntimeException) { }
        assertSame(good, p.current)
    }

    @Test fun repliesParse() {
        assertTrue(Reply.parse("""{"ok":true,"can_fire":true}""").ok)
        val no = Reply.parse("""{"ok":false,"reason":"not_planning"}""")
        assertEquals("not_planning", no.reason)
        assertEquals(false, Reply.parse("""[{"ok":true},{"ok":false,"reason":"bad_hob"}]""").ok)
        assertEquals("bad_reply", Reply.parse("garbage").reason)
    }
}

package games.castleprotect

import games.castleprotect.core.Awaiting
import games.castleprotect.core.Cmd
import games.castleprotect.core.FixtureCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Reply
import games.castleprotect.core.SnapshotParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The debug stand-in only replays the fixtures: plan, fire, flight, after the shot, AI turn, plan again. */
class FixtureCoreTest {
    private val files = FixtureCore.Files.load { name -> runCatching { Fixtures.fixture(name) }.getOrNull() }!!

    @Test fun playsTheFixtureLoop() {
        val g = FixtureCore.factory(files).newGame("""{"level":"1-1"}""", 42)
        val p = SnapshotParser()
        var f = p.parse(g.snapshot())
        assertEquals(Phase.PLAN, f.phase)
        assertNotNull(f.terrain)
        assertTrue(Reply.parse(g.command(Cmd.aim(450, 62))).ok)
        assertFalse(Reply.parse(g.command(Cmd.AI_TURN)).ok)
        assertTrue(Reply.parse(g.command(Cmd.FIRE)).ok)
        f = p.parse(g.snapshot())
        assertEquals(Phase.RESOLVE, f.phase)
        assertEquals(1, f.shells.size)
        g.step(FixtureCore.FLIGHT_TICKS)
        f = p.parse(g.snapshot())
        assertEquals(Phase.PLAN, f.phase)
        assertEquals(Awaiting.AI, f.awaiting)
        assertTrue(f.events.any { it.t == "explode" })
        assertTrue(Reply.parse(g.command(Cmd.AI_TURN)).ok)
        f = p.parse(g.snapshot())
        assertEquals(Awaiting.HUMAN, f.awaiting)
        // Nothing changed: a lean frame, which keeps the full one.
        val again = p.parse(g.snapshot())
        assertEquals(f.fullSeq, again.fullSeq)
        assertTrue(Reply.parse(g.command(Cmd.LOG)).raw.contains("\"fire\""))
        g.close()
    }

    @Test fun unknownCommandsAreRefused() {
        val g = FixtureCore.factory(files).newGame("{}", 1)
        assertEquals("unknown_command", Reply.parse(g.command("""{"cmd":"new_battle"}""")).reason)
        assertEquals("bad_json", Reply.parse(g.command("{nope")).reason)
    }
}

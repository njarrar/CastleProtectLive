package games.castleprotect

import games.castleprotect.core.Awaiting
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Cmd
import games.castleprotect.core.CoreException
import games.castleprotect.core.NativeCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Reply
import games.castleprotect.core.SnapshotParser
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * The real JNI shim against the real Rust core, built for the host (CI builds both and
 * passes -Pcastle.hostJni=<dir>). Skipped when the host libraries are not there.
 */
class NativeHostTest {
    private fun ready(): Boolean = System.getProperty("castle.hostJni") != null && NativeCore.available()

    @Test fun fixtureCommandsGiveTheFixtureReplies() {
        assumeTrue(ready())
        val cmds = JSONObject(Fixtures.fixture("commands_1_1.json"))
        val replies = JSONObject(Fixtures.fixture("replies_1_1.json"))
        val setup = Fixtures.fixture("setup_1_1.json")
        val g = NativeCore.factory()!!.newGame(setup, cmds.getLong("seed"))
        val p = SnapshotParser()
        val first = p.parse(g.snapshot())
        assertEquals(cmds.getInt("first_snapshot_terrain_chunks"), first.terrain!!.let { t -> val d = ArrayList<IntArray>(); t.takeDirty(d); d.size })
        val list = cmds.getJSONArray("commands")
        for (i in 0 until list.length()) {
            val r = JSONObject(g.command(list.getJSONObject(i).toString()))
            assertEquals(replies.getJSONArray("commands").getJSONObject(i).toString(), r.toString())
        }
        val plan = p.parse(g.snapshot())
        val golden = SnapshotParser().parse(Fixtures.bytes("core/fixtures/snapshot_plan.json"))
        assertEquals(golden.hash, plan.hash)
        assertTrue(Reply.parse(g.command(Cmd.FIRE)).ok)
        g.step(30)
        val lean = p.parse(g.snapshot())
        assertEquals(Phase.RESOLVE, lean.phase)
        assertTrue(lean.shells.isNotEmpty())
        g.step(2000)
        val after = p.parse(g.snapshot())
        assertEquals(Awaiting.AI, after.awaiting)
        g.close()
    }

    @Test fun emojiNamesReachTheCore() {
        assumeTrue(ready())
        val spec = BattleSpec.couch("d1", listOf("Mabel🙂", "Ötis"), 15, 1, false, "one_seat", seed = 7)
        val g = NativeCore.factory()!!.newGame(spec.setup, spec.seed)
        val f = SnapshotParser().parse(g.snapshot())
        assertEquals(listOf("Mabel🙂", "Ötis"), f.hud.names)
        assertTrue(Reply.parse(g.command(Cmd.QUICK_PICK)).raw.isNotEmpty())
        g.close()
    }

    @Test(expected = CoreException::class) fun aBadSetupGivesTheCoresReason() {
        assumeTrue(ready())
        NativeCore.factory()!!.newGame("""{"level":"no-such-level"}""", 1)
    }

    @Test fun replayingTheLogRebuildsTheSameState() {
        assumeTrue(ready())
        val f = NativeCore.factory()!!
        val a = f.newGame("""{"level":"1-1"}""", 11)
        a.command(Cmd.aim(430, 72)); a.command(Cmd.FIRE); a.step(2400)
        a.command(Cmd.AI_TURN); a.step(2400)
        val hash = JSONObject(a.command(Cmd.HASH)).getString("hash")
        val log = JSONObject(a.command(Cmd.LOG)).getJSONArray("log")
        val b = f.newGame("""{"level":"1-1"}""", 11)
        for (i in 0 until log.length()) {
            while (JSONObject(b.step(0)).getString("phase").let { it == "resolve" || it == "settle" }) b.step(2400)
            assertTrue(Reply.parse(b.command(log.getJSONObject(i).toString())).ok)
        }
        while (JSONObject(b.step(0)).getString("phase").let { it == "resolve" || it == "settle" }) b.step(2400)
        assertEquals(hash, JSONObject(b.command(Cmd.HASH)).getString("hash"))
        a.close(); b.close()
    }
}

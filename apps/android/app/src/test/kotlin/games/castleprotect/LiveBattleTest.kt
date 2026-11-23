package games.castleprotect

import games.castleprotect.core.Cmd
import games.castleprotect.core.CoreFactory
import games.castleprotect.core.CoreGame
import games.castleprotect.core.LiveBattle
import games.castleprotect.core.NativeCore
import games.castleprotect.core.Reply
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Dead handle recovery (core/API.md "Errors and panics"): cp_new plus resume from the kept log. */
class LiveBattleTest {
    /** A pretend core: keeps a log like the real one, and panics on a chosen command. */
    private class FakeGame(private val panicOn: String?, val made: MutableList<FakeGame>) : CoreGame {
        val log = ArrayList<String>()
        var dead = false
        var resumed: String? = null
        var aims = 0
        override fun command(json: String): String {
            if (dead) return """{"ok":false,"reason":"dead_handle"}"""
            val o = JSONObject(json)
            when (val c = o.getString("cmd")) {
                "log" -> return """{"ok":true,"log":[${log.joinToString(",")}]}"""
                "resume" -> { resumed = o.getJSONArray("log").toString(); val a = o.getJSONArray("log"); for (i in 0 until a.length()) log.add(a.getJSONObject(i).toString()); return """{"ok":true,"applied":${a.length()},"hash":"x"}""" }
                "hash" -> return """{"ok":true,"hash":"h${log.size}"}"""
                else -> {
                    if (c == panicOn) { dead = true; return """{"ok":false,"reason":"panic","detail":"boom"}""" }
                    if (c == "aim") { aims++; if (log.lastOrNull()?.contains("\"aim\"") == true) log[log.size - 1] = json else log.add(json) } else log.add(json)
                    return """{"ok":true}"""
                }
            }
        }
        override fun step(ticks: Int): String = if (dead) """{"ok":false,"reason":"dead_handle"}""" else """{"tick":0,"phase":"plan"}"""
        override fun snapshot(): ByteArray = (if (dead) """{"ok":false,"reason":"dead_handle"}""" else """{"tick":0,"phase":"plan","full":false,"terrain":{"chunks":[]},"shells":[],"events":[]}""").toByteArray()
        override fun close() {}
    }

    private class FakeFactory(val panicOn: String?) : CoreFactory {
        val made = ArrayList<FakeGame>()
        override val name = "fake"
        override val standIn = false
        override fun newGame(setupJson: String, seed: Long): CoreGame = FakeGame(if (made.isEmpty()) panicOn else null, made).also { made.add(it) }
    }

    @Test fun aPanicRebuildsTheBattleFromTheKeptLog() {
        val fac = FakeFactory(panicOn = "fire")
        val b = LiveBattle.open(fac, """{"level":"1-1"}""", 7)
        assertTrue(Reply.parse(b.command(Cmd.pickHob(0))).ok)
        assertTrue(Reply.parse(b.command(Cmd.aim(450, 60))).ok)
        val r = Reply.parse(b.command(Cmd.fire()))
        assertFalse(r.ok)
        assertEquals("panic", r.reason)
        assertEquals(2, fac.made.size)
        val second = fac.made[1]
        // The log as it was before the command that panicked, then the last aim sent again.
        assertNotNull(second.resumed)
        assertEquals(1, JSONArray(second.resumed).length())
        assertEquals(1, second.aims)
        assertTrue(b.takeRebuilt())
        assertNull(b.broken)
        // The new handle carries on.
        assertTrue(Reply.parse(b.command(Cmd.PASS)).ok)
        assertEquals(1, b.recoveries)
    }

    @Test fun recoveryStopsAfterTooManyFailures() {
        val fac = object : CoreFactory {
            override val name = "always dead"; override val standIn = false
            override fun newGame(setupJson: String, seed: Long): CoreGame = FakeGame("pass", ArrayList())
        }
        val b = LiveBattle.open(fac, "{}", 1)
        repeat(LiveBattle.MAX_RECOVERIES + 1) { b.command(Cmd.PASS) }
        assertNotNull(b.broken)
        assertEquals("dead_handle", Reply.parse(b.command(Cmd.PASS)).reason)
    }

    @Test fun aSnapshotFaultCanBeRecovered() {
        val fac = FakeFactory(panicOn = "pass")
        val b = LiveBattle.open(fac, "{}", 1)
        b.command(Cmd.pickHob(1))
        b.command(Cmd.PASS) // panics and recovers
        assertTrue(b.recover("dead_handle"))
        assertEquals(3, fac.made.size)
    }

    /** The real core on the host: a battle rebuilt with resume lands on the same hash. */
    @Test fun resumeOnTheRealCoreGivesTheSameHash() {
        assumeTrue(System.getProperty("castle.hostJni") != null && NativeCore.available())
        val f = NativeCore.factory()!!
        val a = LiveBattle.open(f, """{"level":"1-1"}""", 11)
        a.command(Cmd.aim(430, 72)); a.command(Cmd.fire()); a.step(2400)
        a.command(Cmd.AI_TURN); a.step(2400)
        val hash = JSONObject(a.command(Cmd.HASH)).getString("hash")
        val log = a.freshLog()
        val b = LiveBattle.open(f, """{"level":"1-1"}""", 11, log)
        LiveBattle.settle(object : CoreGame {
            override fun command(json: String) = b.command(json)
            override fun step(ticks: Int) = b.step(ticks)
            override fun snapshot() = b.snapshot()
            override fun close() {}
        })
        assertEquals(hash, JSONObject(b.command(Cmd.HASH)).getString("hash"))
        // Give up ends the battle with the core's result.
        assertTrue(Reply.parse(b.command(Cmd.giveUp())).ok)
        val snap = games.castleprotect.core.SnapshotParser().parse(b.snapshot())
        assertEquals("give_up", snap.result!!.how)
        assertEquals(1, snap.result!!.winner)
        a.close(); b.close()
    }
}

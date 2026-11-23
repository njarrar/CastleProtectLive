package games.castleprotect

import games.castleprotect.core.BattleResult
import games.castleprotect.core.Blow
import games.castleprotect.core.Broke
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.Hud
import games.castleprotect.core.Names
import games.castleprotect.core.Text
import games.castleprotect.game.GameSession
import games.castleprotect.game.ResultText
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** content/text.json as the app reads it (content/text.md), and the content names and Rival data it pairs with. */
class TextTableTest {
    private val contentDir = File(Fixtures.root, "content")
    private val ci = ContentInfo.load(
        read = { rel -> File(contentDir, rel).takeIf { it.isFile }?.readText() },
        list = { File(contentDir, "levels").list()?.toList() ?: emptyList() },
    )

    @Test fun keysPlaceholdersPoolsAndPlurals() {
        assertEquals("Castle Protect", Text.t("app.title"))
        assertEquals("Keep Brickabrac lumpy.", Text.t("app.tagline"))
        assertEquals("Play 1-4", Text.t("home.play_next", "id" to "1-4"))
        // Notes for people are never shown, and a missing key shows itself.
        assertNull(Text.opt("_readme.what"))
        assertNull(Text.opt("rivals._note"))
        assertEquals("no.such.key", Text.t("no.such.key"))
        // Plurals: one when the count is 1.
        assertEquals("1 thing to fix", Text.plural("workshop.to_fix", 1))
        assertEquals("3 things to fix", Text.plural("workshop.to_fix", 3))
        // A pool never gives the same line twice running.
        val pool = Text.list("results.loss.verdict.kettle_pop")
        assertTrue(pool.size > 1)
        var last = ""
        repeat(30) { val l = Text.t("results.loss.verdict.kettle_pop"); assertTrue(l in pool); assertNotEquals(last, l); last = l }
        // Core ids map to keys, with a default.
        assertEquals("Not your turn.", Text.byId("hud.why", "not_planning"))
        assertEquals("Clodpot cannot fire now.", Text.byId("hud.why", "some_new_id", "shot" to "Clodpot"))
        // "Full", never "Gusty".
        assertEquals("Full", Text.t("setup.wind.full"))
    }

    @Test fun shortNamesAreNeverCutAtASpace() {
        assertEquals("Old Thumper", ci.hobShort("old_thumper"))
        assertEquals("Miss Quill", ci.hobShort("quill"))
        assertEquals("Marge", ci.hobShort("marge"))
        assertEquals("Marge Dumpling", ci.hobName("marge"))
        val roster = ci.playerRoster.toMap()
        assertEquals("Old Thumper", roster["old_thumper"])
        assertEquals("Miss Quill", roster["quill"])
        assertEquals("Digger", ci.className("delver"))
        assertEquals("Bouncer", ci.className("boinker"))
        assertEquals("", ci.className("all"))
    }

    @Test fun theAppKeepsNoCopiesOfNamesOrTables() {
        val src = File(Fixtures.root, "apps/android/app/src/main/kotlin")
        val all = src.walkTopDown().filter { it.isFile && it.name.endsWith(".kt") }.map { it.readText() }.joinToString("\n")
        for (bad in listOf("\"Best vs", "Rollers & Distraction", "\"Victory\"", "\"Gusty\"", "\"Mabel\"", "\"Otis\"", "substringBefore(' ')", "\"Fatigue", "\"Sudden Squall")) {
            assertFalse("app source still holds $bad", all.contains(bad))
        }
    }

    @Test fun rivalDataComesFromTheLevelFiles() {
        val l1 = ci.level("1-1")!!
        assertEquals("Sir Pudge", l1.rival)
        assertTrue(l1.thinkMs in 200..4000)
        assertTrue(l1.habit.isNotEmpty())
        assertEquals("Sir Pudge", l1.rivalFor(12345)!!.name)
        assertEquals("pudge", Names.rivalKey("1-1", "Sir Pudge"))
        assertEquals("Pudge", Names.rivalShort("1-1", "Sir Pudge"))
        // 1-7: the acting Corporal has his own key.
        assertEquals("fernsby_acting", Names.rivalKey("1-7", ci.level("1-7")!!.rival))
        // A Skirmish map names no Rival: roster[seed % length] before the fight.
        val d1 = ci.level("d1")!!
        assertEquals("", d1.rival)
        assertTrue(d1.roster.size >= 2)
        for (seed in listOf(0L, 1L, 7L, 1_000_003L)) assertEquals(d1.roster[(seed % d1.roster.size).toInt()], d1.rivalFor(seed))
        assertEquals("Sergeant Rake", Names.rivalShort("d1", "Sergeant Posy Rake"))
        assertEquals("rake", Names.rivalKey("d1", "Sergeant Posy Rake"))
    }

    @Test fun goalsAreWordedPerLevelThenPerTypeThenFromTheLevelFile() {
        val l1 = ci.level("1-1")!!
        assertEquals(Text.t("levels.1-1.goals.win"), l1.pennants[0])
        assertEquals(Text.t("levels.1-1.goals.hits_in_a_row"), l1.pennants[1])
        // Every Region 1 goal reads from text.json or the level file, never blank.
        for (lv in ci.campaign) for (g in lv.pennants) assertTrue("${lv.id}: $g", g.isNotBlank() && !g.contains("{"))
    }

    @Test fun theRivalThinksForItsOwnTime() {
        assertEquals(1800L, GameSession.thinkMs(Hud(thinkMs = listOf(0, 1800)), 1, 1000L))
        assertEquals(1000L, GameSession.thinkMs(Hud(thinkMs = listOf(0, 0)), 1, 1000L))
        assertEquals(1000L, GameSession.thinkMs(Hud(), 1, 1000L))
    }

    @Test fun resultsFollowTheRule() {
        fun r(winner: Int, how: String, broke: Broke? = null) = BattleResult(winner, how, 4, emptyList(), broke = broke)
        // Campaign win: the level's win title, the how line, then the Rival signs off.
        val win = ResultText.of(r(0, "kettle_pop"), "1-1", campaign = true, won = true, duel = false, names = listOf("You", "Sir Pudge"), rivalName = "Sir Pudge", hettyMet = false)
        assertEquals(Text.t("levels.1-1.win_title"), win.title)
        assertEquals(Text.t("results.win.how.kettle_pop"), win.sub)
        assertTrue(win.signOff!! in Text.list("rivals.pudge.sign_off"))
        // Any other win: results.win.title.<how>.
        val sk = ResultText.of(r(0, "clean_sweep"), "d1", campaign = false, won = true, duel = false, names = listOf("You", "Warden Snedd"), rivalName = "Warden Snedd", hettyMet = false)
        assertEquals("Clean Sweep", sk.title)
        assertNull(sk.signOff)
        // Loss: title, cause (with the Hob's short name), then Hetty's verdict.
        val last = Blow("clodpot", "Clodpot", 3, "Hedger", 7, 40, "hob")
        val loss = ResultText.of(
            r(1, "kettle_pop", Broke(0, "kettle_pop", last, listOf(last), 200, 3, 0)), "1-2", campaign = true, won = false, duel = false,
            names = listOf("You", "Private Tuft"), rivalName = "Private Tuft", hettyMet = true, hobShort = { "Pitcher" },
        )
        assertEquals("Kettle popped", loss.title)
        assertEquals("Pitcher's Clodpot popped your kettle in Round 7.", loss.sub)
        assertTrue(loss.verdict!! in Text.list("results.loss.verdict.kettle_pop"))
        assertEquals("Hetty says", loss.verdictBy)
        // Give up: no "You gave up." under "You gave up", and Hetty's name only once she is met.
        val gave = ResultText.of(r(1, "give_up"), "1-3", campaign = true, won = false, duel = false, names = listOf("You", "Lance Corporal Fernsby"), rivalName = "Lance Corporal Fernsby", hettyMet = false)
        assertEquals("You gave up", gave.title)
        assertEquals("", gave.sub)
        assertNull(gave.verdictBy)
        assertNotNull(gave.verdict)
        // A blow by the Creaks picks Hetty's Creaks verdict.
        val creak = Blow("fatigue", "", -1, "", 11, 30, "fatigue")
        val fell = ResultText.of(r(1, "kettle_pop", Broke(0, "kettle_pop", creak, listOf(creak), 200, 9, 1)), "1-4", campaign = true, won = false, duel = false, names = listOf("You", "Corporal Dibber"), rivalName = "Corporal Dibber", hettyMet = true)
        assertTrue(fell.verdict!! in Text.list("results.loss.verdict.fatigue"))
        // Couch Duel: the winner by name.
        val duel = ResultText.of(r(1, "kettle_pop"), "d2", campaign = false, won = false, duel = true, names = listOf("Mabel", "Otis"), rivalName = null, hettyMet = true)
        assertEquals("Otis wins", duel.title)
    }

    @Test fun theDuelNameListIsTheOneInTheTable() {
        val names = Text.list("names.duel")
        assertTrue(names.size >= 20)
        val hobs = JSONArray(Fixtures.text("content/hobs.json"))
        val hobWords = (0 until hobs.length()).flatMap { hobs.getJSONObject(it).getString("name").split(' ') }.toSet()
        assertTrue(names.none { it in hobWords })
        assertTrue(JSONObject(Fixtures.text("content/text.json")).getJSONObject("names").has("player_default"))
    }
}

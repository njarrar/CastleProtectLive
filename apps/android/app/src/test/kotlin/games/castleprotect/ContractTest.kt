package games.castleprotect

import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Cmd
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Every command and setup the app writes must fit core/schema (names, required fields, nothing extra). */
class ContractTest {
    private val commandDefs: List<JSONObject> = JSONObject(Fixtures.text("core/schema/command.schema.json"))
        .getJSONObject("\$defs").getJSONObject("command").getJSONArray("oneOf").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    private val setup = JSONObject(Fixtures.text("core/schema/setup.schema.json"))

    private fun checkCommand(json: String) {
        val o = JSONObject(json)
        val name = o.getString("cmd")
        val def = commandDefs.firstOrNull { it.getJSONObject("properties").getJSONObject("cmd").optString("const") == name }
        assertNotNull("command $name is not in command.schema.json", def)
        val props = def!!.getJSONObject("properties")
        for (k in o.keys()) assertTrue("$name has unknown field $k", props.has(k))
        val req = def.optJSONArray("required") ?: JSONArray()
        for (i in 0 until req.length()) assertTrue("$name lacks ${req.getString(i)}", o.has(req.getString(i)))
    }

    @Test fun commandsMatchTheSchema() {
        listOf(
            Cmd.pickShell("pudding_bomb"), Cmd.QUICK_PICK, Cmd.END_DRAFT, Cmd.pickHob(0), Cmd.pickShot("plain"), Cmd.aim(450, 62),
            Cmd.recall(0), Cmd.walk(-4), Cmd.shoveOff(1), Cmd.FIRE, Cmd.PASS, Cmd.AI_TURN, Cmd.LOG, Cmd.HASH, Cmd.TERRAIN_ALL,
        ).forEach(::checkCommand)
    }

    @Test fun fixtureCommandsAreOnesTheAppCanWrite() {
        val cmds = JSONObject(Fixtures.fixture("commands_1_1.json")).getJSONArray("commands")
        for (i in 0 until cmds.length()) checkCommand(cmds.getJSONObject(i).toString())
        assertEquals(JSONObject(Cmd.aim(450, 62)).toString(), JSONObject(cmds.getJSONObject(2).toString()).toString())
    }

    private fun checkSetup(json: String) {
        val o = JSONObject(json)
        val props = setup.getJSONObject("properties")
        for (k in o.keys()) assertTrue("setup has unknown field $k", props.has(k))
        assertTrue(o.has("level"))
        val sideProps = props.getJSONObject("sides").getJSONObject("items").getJSONObject("properties")
        o.optJSONArray("sides")?.let { a -> for (i in 0 until a.length()) for (k in a.getJSONObject(i).keys()) assertTrue("side has unknown field $k", sideProps.has(k)) }
        o.optJSONObject("wind")?.let { w -> for (k in w.keys()) assertTrue(props.getJSONObject("wind").getJSONObject("properties").has(k)) }
        o.optJSONObject("rummage")?.let { w -> for (k in w.keys()) assertTrue(props.getJSONObject("rummage").getJSONObject("properties").has(k)) }
        val modes = props.getJSONObject("mode").getJSONArray("enum").toString()
        if (o.has("mode")) assertTrue(modes.contains("\"${o.getString("mode")}\""))
    }

    @Test fun setupsMatchTheSchema() {
        checkSetup(BattleSpec.campaign("1-1", "fair").setup)
        checkSetup(BattleSpec.skirmish("d1", "cozy", 15, 2, plainOnly = true).setup)
        checkSetup(BattleSpec.couch("d2", listOf("Mabel", "Otis"), 10, 0, plainOnly = false, seats = "side_by_side").setup)
    }

    @Test fun namesWithQuotesAndEmojiSurvive() {
        val spec = BattleSpec.couch("d1", listOf("Ma\"bel🙂\\", "Ötis🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂"), 15, 1, false, "one_seat")
        val sides = JSONObject(spec.setup).getJSONArray("sides")
        assertEquals("Ma\"bel🙂\\", sides.getJSONObject(0).getString("name"))
        val second = sides.getJSONObject(1).getString("name")
        assertEquals(12, second.codePointCount(0, second.length))
        assertTrue(spec.seed >= 0)
    }
}

package games.castleprotect.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * Typed view of the core's frame snapshot. This file is the single place that
 * knows the JSON field names, so a change in core/API.md is a change here only.
 * World units are cells, x to the right, y up from the bottom of the map.
 */
enum class Phase { PRE, PLAN, FLIGHT, RESOLVE, HANDOFF, ENDED, NONE }

data class Block(val x: Float, val y: Float, val w: Float, val h: Float, val mat: String, val hp: Int, val hpMax: Int)

data class Hob(
    val id: String, val name: String, val cls: String, val hp: Int, val hpMax: Int,
    val x: Float, val y: Float, val bonked: Boolean, val rest: Int,
)

data class Fort(
    val side: Int, val x: Float, val kettleX: Float, val kettleY: Float,
    val kettleHp: Int, val kettleMax: Int, val blocks: List<Block>, val hobs: List<Hob>,
) {
    val kettlePct: Int get() = if (kettleMax <= 0) 0 else (kettleHp * 100 + kettleMax - 1) / kettleMax
}

data class ShotChip(val id: String, val name: String, val kind: String, val uses: Int, val weight: Int, val best: Boolean)
data class Pin(val x: Float, val y: Float, val side: Int, val round: Int, val spent: Boolean)
data class Shell(val x: Float, val y: Float, val kind: String)
data class DraftChip(val id: String, val name: String, val weight: Int, val hint: String, val bestWith: String, val takenBy: Int)
data class Draft(val pool: List<DraftChip>, val picksEach: Int, val turn: Int, val hands: List<List<String>>, val wish: String?)
data class BattleResult(val winner: Int, val reason: String, val pennants: Int, val buttons: Int, val goals: List<Pair<String, Boolean>>)
data class Handoff(val line: String, val toSide: Int)
data class GameEvent(val type: String, val cue: String, val x: Float, val text: String)

/** Everything the HUD needs, with no arrays, so Compose can compare frames cheaply. */
data class Hud(
    val phase: Phase = Phase.NONE,
    val mode: String = "",
    val level: String = "",
    val round: Int = 1, val roundCap: Int = 15, val squallIn: Int = -1,
    val activeSide: Int = 0, val turnSeq: Int = 0,
    val wind: Int = 0, val forecast: Int = 0,
    val names: List<String> = listOf("You", "Rival"),
    val humans: List<Boolean> = listOf(true, false),
    val kettlePct: List<Int> = listOf(100, 100),
    val hobs: List<List<Hob>> = listOf(emptyList(), emptyList()),
    val selectedHob: String? = null,
    val shots: List<ShotChip> = emptyList(),
    val selectedShot: String? = null,
    val aimAngle: Int = 450, val aimPower: Int = 50, val aimSet: Boolean = false,
    val canFire: Boolean = false, val dugIn: Boolean = false,
    val steam: Int = 0, val steamTurn: Int = 0,
    val speed: Int = 1,
    val draft: Draft? = null,
    val result: BattleResult? = null,
    val handoff: Handoff? = null,
) {
    /** True when a person, not the AI, may act right now. */
    val humanTurn: Boolean get() = phase == Phase.PLAN && humans.getOrElse(activeSide) { false }
}

class Snapshot(
    val tick: Long,
    val hud: Hud,
    val worldW: Float, val worldH: Float,
    /** Ground height per column, evenly spaced across the world width. */
    val terrain: FloatArray,
    val forts: List<Fort>,
    /** x,y pairs of the 30% preview dots. */
    val preview: FloatArray,
    val ghosts: List<FloatArray>,
    val pins: List<Pin>,
    val shells: List<Shell>,
    val events: List<GameEvent>,
) {
    fun groundAt(x: Float): Float {
        if (terrain.isEmpty()) return 0f
        val f = (x / worldW).coerceIn(0f, 1f) * (terrain.size - 1)
        val i = f.toInt().coerceAtMost(terrain.size - 2).coerceAtLeast(0)
        if (terrain.size == 1) return terrain[0]
        val t = f - i
        return terrain[i] * (1 - t) + terrain[i + 1] * t
    }

    companion object {
        val EMPTY = Snapshot(0, Hud(), 1600f, 600f, FloatArray(0), emptyList(), FloatArray(0), emptyList(), emptyList(), emptyList(), emptyList())

        fun parse(json: String): Snapshot = try { parse(JSONObject(json)) } catch (e: Exception) { EMPTY }

        private fun parse(o: JSONObject): Snapshot {
            val world = o.optJSONObject("world")
            val forts = o.optJSONArray("forts").map { f ->
                Fort(
                    side = f.optInt("side"),
                    x = f.f("x"),
                    kettleX = f.f("kettle_x"), kettleY = f.f("kettle_y"),
                    kettleHp = f.optInt("kettle_hp"), kettleMax = f.optInt("kettle_max", 100),
                    blocks = f.optJSONArray("blocks").map { b ->
                        Block(b.f("x"), b.f("y"), b.f("w", 16f), b.f("h", 16f), b.optString("mat", "timber"), b.optInt("hp"), b.optInt("hp_max", 1))
                    },
                    hobs = f.optJSONArray("hobs").map { h ->
                        Hob(
                            h.optString("id"), h.optString("name"), h.optString("class"), h.optInt("hp"), h.optInt("hp_max", 1),
                            h.f("x"), h.f("y"), h.optBoolean("bonked"), h.optInt("rest"),
                        )
                    },
                )
            }.sortedBy { it.side }
            val aim = o.optJSONObject("aim")
            val draft = o.optJSONObject("draft")?.let { d ->
                Draft(
                    pool = d.optJSONArray("pool").map { c ->
                        DraftChip(c.optString("id"), c.optString("name"), c.optInt("weight"), c.optString("hint"), c.optString("best_with"), c.optInt("taken_by", -1))
                    },
                    picksEach = d.optInt("picks_each", 2),
                    turn = d.optInt("turn"),
                    hands = d.optJSONArray("hands").mapArr { a -> (0 until a.length()).map { a.optString(it) } },
                    wish = d.optString("wish").ifEmpty { null },
                )
            }
            val result = o.optJSONObject("result")?.let { r ->
                BattleResult(
                    r.optInt("winner", -1), r.optString("reason"), r.optInt("pennants"), r.optInt("buttons"),
                    r.optJSONArray("goals").map { g -> g.optString("label") to g.optBoolean("done") },
                )
            }
            val handoff = o.optJSONObject("handoff")?.let { Handoff(it.optString("line"), it.optInt("to_side")) }
            val hud = Hud(
                phase = when (o.optString("phase")) {
                    "pre", "draft" -> Phase.PRE
                    "plan" -> Phase.PLAN
                    "flight" -> Phase.FLIGHT
                    "resolve" -> Phase.RESOLVE
                    "handoff" -> Phase.HANDOFF
                    "ended", "end" -> Phase.ENDED
                    else -> Phase.NONE
                },
                mode = o.optString("mode"),
                level = o.optString("level"),
                round = o.optInt("round", 1), roundCap = o.optInt("round_cap", 15), squallIn = o.optInt("squall_in", -1),
                activeSide = o.optInt("active_side"), turnSeq = o.optInt("turn_seq"),
                wind = o.optInt("wind"), forecast = o.optInt("forecast"),
                names = o.optJSONArray("names").strings().ifEmpty { listOf("You", "Rival") },
                humans = o.optJSONArray("humans").let { a -> if (a == null) listOf(true, false) else (0 until a.length()).map { a.optBoolean(it) } },
                kettlePct = forts.map { it.kettlePct },
                hobs = forts.map { it.hobs },
                selectedHob = o.optString("selected_hob").ifEmpty { null },
                shots = o.optJSONArray("shots").map { s ->
                    ShotChip(s.optString("id"), s.optString("name"), s.optString("kind", "plain"), s.optInt("uses", -1), s.optInt("weight"), s.optBoolean("best"))
                },
                selectedShot = o.optString("selected_shot").ifEmpty { null },
                aimAngle = aim?.optInt("angle", 450) ?: 450,
                aimPower = aim?.optInt("power", 50) ?: 50,
                aimSet = aim?.optBoolean("set") ?: false,
                canFire = o.optBoolean("can_fire"), dugIn = o.optBoolean("dug_in"),
                steam = o.optInt("steam"), steamTurn = o.optInt("steam_turn"),
                speed = o.optInt("speed", 1),
                draft = draft, result = result, handoff = handoff,
            )
            return Snapshot(
                tick = o.optLong("tick"),
                hud = hud,
                worldW = world?.f("w", 1600f) ?: 1600f, worldH = world?.f("h", 600f) ?: 600f,
                terrain = o.optJSONArray("terrain").floats(),
                forts = forts,
                preview = o.optJSONArray("preview").floats(),
                ghosts = o.optJSONArray("ghosts").mapArr { it.floats() },
                pins = o.optJSONArray("pins").map { p -> Pin(p.f("x"), p.f("y"), p.optInt("side"), p.optInt("round"), p.optBoolean("spent")) },
                shells = o.optJSONArray("shells").map { s -> Shell(s.f("x"), s.f("y"), s.optString("kind")) },
                events = o.optJSONArray("events").map { e -> GameEvent(e.optString("type"), e.optString("cue"), e.f("x"), e.optString("text")) },
            )
        }

        private fun JSONObject.f(k: String, d: Float = 0f) = optDouble(k, d.toDouble()).toFloat()
        private inline fun <T> JSONArray?.map(fn: (JSONObject) -> T): List<T> {
            if (this == null) return emptyList()
            val out = ArrayList<T>(length())
            for (i in 0 until length()) optJSONObject(i)?.let { out.add(fn(it)) }
            return out
        }
        private inline fun <T> JSONArray?.mapArr(fn: (JSONArray) -> T): List<T> {
            if (this == null) return emptyList()
            val out = ArrayList<T>(length())
            for (i in 0 until length()) optJSONArray(i)?.let { out.add(fn(it)) }
            return out
        }
        private fun JSONArray?.floats(): FloatArray {
            if (this == null) return FloatArray(0)
            return FloatArray(length()) { optDouble(it, 0.0).toFloat() }
        }
        private fun JSONArray?.strings(): List<String> {
            if (this == null) return emptyList()
            return (0 until length()).map { optString(it) }
        }
    }
}

/** Menu query results. */
data class LevelNode(val id: String, val name: String, val kind: String, val state: String, val pennants: Int)
data class Campaign(val region: String, val levels: List<LevelNode>, val pennants: Int, val pennantsMax: Int, val buttons: Int, val skirmishOpen: Boolean) {
    companion object {
        fun parse(json: String): Campaign = try {
            val o = JSONObject(json)
            val a = o.optJSONArray("levels") ?: JSONArray()
            val levels = (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map {
                LevelNode(it.optString("id"), it.optString("name"), it.optString("kind", "siege"), it.optString("state", "locked"), it.optInt("pennants"))
            }
            Campaign(o.optString("region", "Puddingstone Downs"), levels, o.optInt("pennants"), o.optInt("pennants_max", levels.size * 3), o.optInt("buttons"), o.optBoolean("skirmish_open", true))
        } catch (e: Exception) { Campaign("Puddingstone Downs", emptyList(), 0, 30, 0, true) }
    }
}

data class LevelInfo(
    val id: String, val name: String, val kind: String, val roundCap: Int, val wind: String,
    val rival: String, val rivalAim: Int, val habit: String, val rivalCrew: List<String>, val goals: List<Pair<String, Boolean>>,
) {
    companion object {
        fun parse(json: String): LevelInfo = try {
            val o = JSONObject(json)
            val crew = o.optJSONArray("rival_crew") ?: JSONArray()
            val goals = o.optJSONArray("goals") ?: JSONArray()
            LevelInfo(
                o.optString("id"), o.optString("name"), o.optString("kind", "Siege"), o.optInt("round_cap", 15), o.optString("wind", "0 to 2"),
                o.optString("rival", "Rival"), o.optInt("rival_aim", 1), o.optString("habit"),
                (0 until crew.length()).map { crew.optString(it) },
                (0 until goals.length()).mapNotNull { goals.optJSONObject(it) }.map { it.optString("label") to it.optBoolean("done") },
            )
        } catch (e: Exception) { LevelInfo("", "", "Siege", 15, "", "Rival", 1, "", emptyList(), emptyList()) }
    }
}

package games.castleprotect.core

/**
 * Typed view of the core's frame snapshot, field for field from core/API.md and
 * core/schema/snapshot.schema.json. This file is the one place that knows the
 * snapshot's JSON names. World units are cells, x grows right, y grows down
 * (y = 0 is the top of the sky).
 *
 * Nothing here decides a game rule: every value comes from the core.
 */
enum class Phase { DRAFT, PLAN, RESOLVE, SETTLE, ENDED, NONE;
    companion object {
        fun of(s: String) = when (s) { "draft" -> DRAFT; "plan" -> PLAN; "resolve" -> RESOLVE; "settle" -> SETTLE; "ended" -> ENDED; else -> NONE }
    }
}

enum class Awaiting { HUMAN, AI, NONE;
    companion object { fun of(s: String) = when (s) { "human" -> HUMAN; "ai" -> AI; else -> NONE } }
}

class Block(
    @JvmField val c: Int, @JvmField val r: Int, @JvmField val x: Int, @JvmField val y: Int,
    @JvmField val mat: String, @JvmField val hp: Int, @JvmField val max: Int,
    @JvmField val battered: Boolean, @JvmField val root: Boolean, @JvmField val peephole: Boolean,
) {
    /** Renderer-owned cache slot (resolved sprite). Blocks are rebuilt on every full snapshot. */
    @JvmField var look: Any? = null
}

class Room(
    @JvmField val kind: String, @JvmField val id: Int, @JvmField val c: Int, @JvmField val r: Int,
    @JvmField val box: IntArray, @JvmField val intact: Boolean, @JvmField val flap: Boolean, @JvmField val lid: Boolean,
    @JvmField val loophole: IntArray,
)

class Kettle(@JvmField val hp: Int, @JvmField val max: Int, @JvmField val box: IntArray, @JvmField val room: IntArray, @JvmField val lid: Boolean, @JvmField val intact: Boolean)

class Castle(
    @JvmField val side: Int, @JvmField val x: Int, @JvmField val baseY: Int, @JvmField val cols: Int, @JvmField val rows: Int, @JvmField val block: Int,
    @JvmField val blocks: List<Block>, @JvmField val rooms: List<Room>, @JvmField val kettle: Kettle?,
    @JvmField val steam: Int, @JvmField val steamTurn: Int, @JvmField val fatigue: Boolean,
    /** c, r pairs. */
    @JvmField val shimmer: IntArray, @JvmField val held: IntArray,
) {
    /** Top of the highest standing block, or the base when nothing stands. */
    val topY: Int get() { var t = baseY; for (b in blocks) if (b.y < t) t = b.y; return t }
}

data class Hob(
    val id: Int, val side: Int, val def: String, val name: String, val cls: String,
    val hp: Int, val max: Int, val state: String, val nook: Int, val x: Int, val y: Int,
    val rest: Int, val knack: String?, val knackUses: Int, val plain: String,
    val buried: Boolean, val cover: Boolean, val dummy: Boolean, val grudge: Boolean, val clatter: Boolean,
    val canFire: Boolean, val angle: Int, val power: Int,
) {
    /** Out of the fight: only `bonked` or 0 HP (core/API.md rules v4, QA playtest 2 N2). */
    val bonked: Boolean get() = state == "bonked" || hp <= 0
    /** Crushed to 1 HP but alive and able to act: `squashed`, or `dropped` at 1 HP. Drawn flattened, never as Bonked. */
    val squashed: Boolean get() = !bonked && (state == "squashed" || (state == "dropped" && hp <= 1))
    /** Renderer-owned cache slot (resolved sprite set). */
    @Transient @JvmField var look: Any? = null
}

class Shell(@JvmField val id: Int, @JvmField val x: Int, @JvmField val y: Int, @JvmField val rot: Int, @JvmField val shot: String)

class Prop(@JvmField val id: Int, @JvmField val side: Int, @JvmField val kind: String, @JvmField val tag: String, @JvmField val x: Int, @JvmField val y: Int, @JvmField val hp: Int, @JvmField val max: Int, @JvmField val shot: String?)

class Ghost(
    @JvmField val index: Int, @JvmField val side: Int, @JvmField val hob: Int, @JvmField val shot: String,
    @JvmField val angle: Int, @JvmField val power: Int, @JvmField val round: Int,
    @JvmField val hasPin: Boolean, @JvmField val pinX: Int, @JvmField val pinY: Int,
    @JvmField val selfHit: Boolean, @JvmField val recalled: Boolean,
    /** x0, y0, x1, y1, ... */
    @JvmField val points: IntArray,
)

data class CrewPip(val id: Int, val hpPct: Int, val state: String, val cls: String, val rest: Int)
data class HandShell(val id: String, val name: String, val match: String, val weight: String, val dud: Boolean, val card: String)

/** One chip of `hud.shots`: what `fire` would do with that shot for the selected Hob. [text] is the core's plain words when not ready. */
data class ShotChip(val shot: String, val id: String, val ready: Boolean, val why: String?, val text: String? = null)

/** `hud.fire`: whether Fire may be lit for the selected shot, and the core's words when not (rules v3). */
data class FireState(val ready: Boolean, val why: String?, val text: String?)

/** `result.best_shot` and `result.stats[i].best_shot`: the shot of [side] that dealt the most damage to the other side. */
data class BestShot(
    val side: Int, val hob: Int, val hobName: String, val shot: String, val shotName: String,
    val angle: Int, val power: Int, val round: Int, val dmg: Int,
)

/** `hud.handicap[side]`, shown openly. */
data class Handicap(val help: String = "none", val steam: Int = 0, val previewPct: Int = 30, val crew: Int = 0) {
    /** Gold plus marks: none, one for Some, two for Lots. */
    val marks: Int get() = when (help) { "some" -> 1; "lots" -> 2; else -> 0 }
}

/** `hud.volley`: Actions per side and what is left. */
data class Volley(val actions: Int, val left: List<Int>)

/** `hud.boss` on a Grand Fort with phases. [cut] is the red cut line box, or null. */
data class Boss(val phase: Int, val roller: Prop?, val rollerDone: Boolean, val shears: Prop?, val cut: IntArray?, val jam: Int)

/** `hud.rules`. */
data class LevelRules(val objectiveTag: String? = null, val objectiveCount: Int = 0, val capWin: Int? = null)

data class Hud(
    val turn: Int = 0, val round: Int = 1, val roundCap: Int = 15, val side: Int = 0,
    val wind: Int = 0, val forecast: Int = 0, val frontRoundsLeft: Int = 0,
    val steam: List<Int> = listOf(0, 0), val steamTurnLeft: Int = 0,
    val kettlePct: List<Int> = listOf(100, 100),
    val crew: List<List<CrewPip>> = listOf(emptyList(), emptyList()),
    /** 3, 2, 1, or -1 for none. */
    val squallWarning: Int = -1, val squallRound: Int = 0, val squall: Boolean = false,
    val hands: List<List<HandShell>> = listOf(emptyList(), emptyList()),
    val doodads: List<List<String>> = listOf(emptyList(), emptyList()),
    val selectedHob: Int = -1, val selectedShot: String = "plain",
    val names: List<String> = listOf(Text.t("common.you"), Text.t("common.rival")),
    val control: List<String> = listOf("human", "ai"),
    val score: List<Int> = listOf(0, 0),
    val puffUp: List<Boolean> = listOf(false, false),
    val steamMax: List<Int> = listOf(100, 120),
    val shoveOffCost: Int = 15,
    val shots: List<ShotChip> = emptyList(),
    val handicap: List<Handicap> = listOf(Handicap(), Handicap()),
    val volley: Volley? = null,
    val boss: Boss? = null,
    val rules: LevelRules = LevelRules(),
    /** `hud.fire`, or null from a core before rules v3. */
    val fire: FireState? = null,
    /** Fatigue is on (from [fatigueRound]); [fatigueIn] rounds until it starts, or -1 (on, or none in this mode). */
    val fatigue: Boolean = false, val fatigueRound: Int = 0, val fatigueIn: Int = -1,
    /** Set by the parser in the Test Yard: side 1 is the Dummy side, which passes itself. */
    val yard: Boolean = false,
    /** `hud.think_ms`: think pose ms per side from the level or the Skirmish roster, 0 when unset (use app.json). */
    val thinkMs: List<Int> = listOf(0, 0),
) {
    /** A person plays [side]. In the Test Yard only side 0 does, whatever the control says (QA playtest 1, M4). */
    fun human(side: Int) = control.getOrElse(side) { "ai" } == "human" && !(yard && side == 1)
    /** The chip for a shot key (`plain`, `knack` or a shell id), if the core sent one. */
    fun chip(shot: String): ShotChip? = shots.firstOrNull { it.shot == shot }
}

data class Draft(val pool: List<String>, val picks: List<List<String>>, val next: Int, val picksEach: Int, val wish: String?)

/** `result.stats[side]`. */
data class SideStats(
    val shots: Int = 0, val hits: Int = 0, val blocksDropped: Int = 0, val bonks: Int = 0,
    val blocksLost: Int = 0, val kettleLost: Int = 0, val hobsLost: Int = 0, val bestStreak: Int = 0,
    /** This side's best shot (damage to the other side), or null. */
    val bestShot: BestShot? = null,
)

/**
 * One blow in `result.broke`: the shot and who dealt it. [by] (rules v4): `hob`, `squall`, `ground`,
 * `fatigue`, `self`, `shears` or `prop`; empty from an older core. [hobName] is never null from v4.
 */
data class Blow(val shot: String, val shotName: String, val hob: Int, val hobName: String, val round: Int, val dmg: Int, val by: String = "")

/** `result.broke`: "what broke you" for the losing side. */
data class Broke(
    val side: Int, val how: String, val last: Blow?, val top: List<Blow>,
    val kettleLost: Int, val blocksLost: Int, val hobsBonked: Int,
)

data class BattleResult(
    val winner: Int, val how: String, val round: Int, val pennants: List<Boolean>,
    val pennantsNew: List<Boolean> = emptyList(),
    /** What the player (side 0) earns, from the core. */
    val buttons: Int = 0,
    val score: List<Int> = emptyList(),
    val stats: List<SideStats> = emptyList(),
    val broke: Broke? = null,
    /** The winner's best shot (`result.best_shot`); never a shot of the losing side. */
    val bestShot: BestShot? = null,
) {
    /** The best shot of [side], from `stats[side].best_shot`. */
    fun bestOf(side: Int): BestShot? = stats.getOrNull(side)?.bestShot
}

/** The core refused a snapshot or step: the handle panicked (`panic`) or is dead (`dead_handle`), or `null_handle`. */
class CoreFault(val reason: String, val detail: String) : RuntimeException("$reason: $detail") {
    /** The handle can not be used again; rebuild with cp_new and resume. */
    val dead: Boolean get() = reason == "panic" || reason == "dead_handle" || reason == "null_handle"
}

/** One core event. Only the fields the app uses are kept; see core/API.md for the full list. */
class GameEvent(
    @JvmField val t: String, @JvmField val tick: Int,
    /** World position; `r` is a blast radius on `explode`/`carve`/`mound` and a block row on `hit`/`break`. */
    @JvmField val x: Int, @JvmField val y: Int, @JvmField val r: Int,
    @JvmField val side: Int, @JvmField val hob: Int, @JvmField val dmg: Int, @JvmField val n: Int,
    @JvmField val winner: Int, @JvmField val round: Int,
    @JvmField val target: String, @JvmField val how: String, @JvmField val text: String,
    @JvmField val callout: Boolean,
    /** Block column (`hit`, `break`, `shears_open`). */
    @JvmField val c: Int = 0,
    /** `shot` (fire, prop), `type` (explode, hit), `why`, `kind`, `state` (drop), `room` (lid). */
    @JvmField val shot: String = "", @JvmField val type: String = "", @JvmField val why: String = "",
    @JvmField val kind: String = "", @JvmField val state: String = "", @JvmField val room: String = "",
    /** `phase` (boss_phase), `cells` (drop, castle_drop), `nook`, `hp`, `wind`, `steam`. */
    @JvmField val phase: Int = 0, @JvmField val cells: Int = 0, @JvmField val nook: Int = -1, @JvmField val hp: Int = 0,
    @JvmField val wind: Int = 0, @JvmField val power: Int = 0, @JvmField val angle: Int = 0,
    /** `from` and `to`: [x, y] for walk and drop, a single x for roller_move (y then 0). */
    @JvmField val fromX: Int = 0, @JvmField val fromY: Int = 0, @JvmField val toX: Int = 0, @JvmField val toY: Int = 0,
    /** `blocks`: a count, or triples c, r, material code ([[c, r, mat]] for collapse; mat -1 when absent). */
    @JvmField val blockCount: Int = 0, @JvmField val blocks: IntArray = EMPTY_INTS,
    /** `falls`: pairs column, cells fallen. */
    @JvmField val falls: IntArray = EMPTY_INTS,
    /** `cut`: [x0, y0, x1, y1]. */
    @JvmField val cut: IntArray = EMPTY_INTS,
    @JvmField val threaded: Boolean = false,
    @JvmField val buttons: Int = 0,
    /** `shot_switch`: the shot it moved from and to, and `when` (`turn_start`, `pick_hob`). */
    @JvmField val fromShot: String = "", @JvmField val toShot: String = "", @JvmField val whenTag: String = "",
) {
    companion object {
        @JvmField val EMPTY_INTS = IntArray(0)
        /** Block material names to the codes used in [blocks]. */
        val MATS = listOf("wicker", "timber", "cobble", "footing")
        fun matCode(m: String): Int = MATS.indexOf(m)
        fun matName(code: Int): String = MATS.getOrElse(code) { "timber" }
    }
}

/**
 * One frame as the app sees it: the last full snapshot with a lean one laid on top
 * (core/API.md, "Snapshots are full or lean"). Frames are immutable once published.
 */
class Frame(
    @JvmField val tick: Int,
    @JvmField val phase: Phase,
    @JvmField val side: Int,
    @JvmField val awaiting: Awaiting,
    /** Counts full snapshots; equal between two frames means only shells moved. */
    @JvmField val fullSeq: Int,
    @JvmField val level: String,
    @JvmField val mode: String,
    @JvmField val mapW: Int, @JvmField val mapH: Int,
    @JvmField val terrain: Terrain?,
    @JvmField val castles: List<Castle>,
    @JvmField val hobs: List<Hob>,
    @JvmField val shells: List<Shell>,
    @JvmField val props: List<Prop>,
    /** x0, y0, x1, y1, ... */
    @JvmField val preview: IntArray,
    @JvmField val ghosts: List<Ghost>,
    @JvmField val hud: Hud,
    @JvmField val draft: Draft?,
    @JvmField val result: BattleResult?,
    @JvmField val events: List<GameEvent>,
    @JvmField val hash: String,
) {
    /** A person may act right now. */
    val humanTurn: Boolean get() = phase == Phase.PLAN && awaiting == Awaiting.HUMAN

    /** The Hob the active side has selected, if any. */
    val selectedHob: Hob? get() { val id = hud.selectedHob; for (h in hobs) if (h.id == id && h.side == side) return h; return null }

    fun hobsOf(s: Int): List<Hob> = hobs.filter { it.side == s }

    fun groundAt(x: Int): Int = terrain?.groundAt(x) ?: castles.firstOrNull()?.baseY ?: (mapH * 2 / 3)

    companion object {
        val EMPTY = Frame(0, Phase.NONE, 0, Awaiting.NONE, 0, "", "", 1600, 720, null, emptyList(), emptyList(), emptyList(), emptyList(),
            IntArray(0), emptyList(), Hud(), null, null, emptyList(), "")
    }
}

/**
 * Reads snapshots in order and keeps the state a lean snapshot leaves out.
 * Not thread safe: the sim thread owns one parser per battle.
 */
class SnapshotParser {
    private var last: Frame = Frame.EMPTY
    private var terrain: Terrain? = null
    private var fullSeq = 0
    private val raw = IntArray(2)

    val current: Frame get() = last

    /** Parses one snapshot. On bad input it throws and the last good frame stays current. */
    fun parse(bytes: ByteArray, keepEvents: Boolean = true): Frame {
        val j = JsonReader(bytes)
        var tick = last.tick; var phase = last.phase; var side = last.side; var awaiting = last.awaiting
        var full = false
        var level = last.level; var mode = last.mode
        var mapW = last.mapW; var mapH = last.mapH
        var castles = last.castles; var hobs = last.hobs; var shells: List<Shell> = emptyList(); var props = last.props
        var preview = last.preview; var ghosts = last.ghosts; var hud = last.hud; var draft = last.draft; var result = last.result
        var events: List<GameEvent> = emptyList(); var hash = last.hash
        // Chunks may come before "map" in the text; keep their byte ranges and apply them at the end.
        var chunks: IntArray? = null
        var nChunks = 0
        var sawPreview = false; var sawGhosts = false; var sawProps = false; var sawDraft = false; var sawResult = false
        var okFalse = false; var reason = ""; var detail = ""
        var aimSide = -1; var aimHob = -1; var aimAngle = 0; var aimPower = 0

        j.beginObject()
        while (j.hasNext()) {
            when (j.nextName()) {
                "tick" -> tick = j.nextInt()
                "phase" -> phase = Phase.of(j.nextString())
                "side" -> side = j.nextInt()
                "awaiting" -> awaiting = Awaiting.of(j.nextString())
                "full" -> full = j.nextBoolean()
                "level" -> level = j.nextString()
                "mode" -> mode = j.nextString()
                "map" -> { j.beginObject(); while (j.hasNext()) when (j.nextName()) { "w" -> mapW = j.nextInt(); "h" -> mapH = j.nextInt(); else -> j.skipValue() }; j.endObject() }
                "terrain" -> {
                    j.beginObject()
                    while (j.hasNext()) {
                        if (j.nextName() != "chunks") { j.skipValue(); continue }
                        j.beginArray()
                        while (j.hasNext()) {
                            var x = 0; var y = 0; var w = 0; var h = 0; var a = 0; var b = 0
                            j.beginObject()
                            while (j.hasNext()) when (j.nextName()) {
                                "x" -> x = j.nextInt(); "y" -> y = j.nextInt(); "w" -> w = j.nextInt(); "h" -> h = j.nextInt()
                                "data" -> { j.nextRawString(raw); a = raw[0]; b = raw[1] }
                                else -> j.skipValue()
                            }
                            j.endObject()
                            val arr = chunks ?: IntArray(6 * 8)
                            chunks = if (arr.size < (nChunks + 1) * 6) arr.copyOf(arr.size * 2) else arr
                            chunks!!.also { c -> val o = nChunks * 6; c[o] = x; c[o + 1] = y; c[o + 2] = w; c[o + 3] = h; c[o + 4] = a; c[o + 5] = b }
                            nChunks++
                        }
                        j.endArray()
                    }
                    j.endObject()
                }
                "castles" -> castles = readCastles(j)
                "hobs" -> hobs = readHobs(j)
                "shells" -> shells = readShells(j)
                "props" -> { props = readProps(j); sawProps = true }
                "preview" -> { preview = j.nextPairs(); sawPreview = true }
                "ghosts" -> { ghosts = readGhosts(j); sawGhosts = true }
                "hud" -> hud = readHud(j)
                "draft" -> { draft = if (j.nextNull()) null else readDraft(j); sawDraft = true }
                "events" -> { val e = readEvents(j); if (keepEvents) events = e }
                "result" -> { result = if (j.nextNull()) null else readResult(j); sawResult = true }
                "hash" -> hash = j.nextString()
                // A refusal in place of a snapshot (core/API.md "Errors and panics").
                "ok" -> okFalse = !j.nextBoolean()
                "reason" -> reason = j.nextString()
                "detail" -> detail = if (j.peek() == '"') j.nextString() else j.nextRaw()
                // A lean snapshot after `aim`: the selected Hob's new aim.
                "aim" -> if (!j.nextNull()) {
                    j.beginObject()
                    while (j.hasNext()) when (j.nextName()) {
                        "side" -> aimSide = j.nextInt(); "hob" -> aimHob = j.nextInt()
                        "angle" -> aimAngle = j.nextInt(); "power" -> aimPower = j.nextInt()
                        else -> j.skipValue()
                    }
                    j.endObject()
                }
                else -> j.skipValue()
            }
        }
        j.endObject()
        if (okFalse) throw CoreFault(reason.ifEmpty { "refused" }, detail)
        if ((mode == "test_yard") != hud.yard) hud = hud.copy(yard = mode == "test_yard")
        if (aimHob >= 0) hobs = hobs.map { h -> if (h.id == aimHob && (aimSide < 0 || h.side == aimSide)) h.copy(angle = aimAngle, power = aimPower) else h }

        if (full) {
            fullSeq++
            // A full snapshot replaces these; when one is missing it is empty, not stale.
            if (!sawPreview) preview = IntArray(0)
            if (!sawGhosts) ghosts = emptyList()
            if (!sawProps) props = emptyList()
            if (!sawDraft) draft = null
            if (!sawResult) result = null
        }
        var t = terrain
        if (mapW > 0 && mapH > 0 && (t == null || t.w != mapW || t.h != mapH)) { t = Terrain(mapW, mapH); terrain = t }
        val c = chunks
        if (t != null && c != null) for (i in 0 until nChunks) {
            val o = i * 6
            t.writeChunk(c[o], c[o + 1], c[o + 2], c[o + 3], bytes, c[o + 4], c[o + 5])
        }
        val f = Frame(tick, phase, side, awaiting, fullSeq, level, mode, mapW, mapH, t, castles, hobs, shells, props,
            preview, ghosts, hud, draft, result, events, hash)
        last = f
        return f
    }

    private fun box(j: JsonReader): IntArray = j.nextIntArray()

    private fun readCastles(j: JsonReader): List<Castle> {
        val out = ArrayList<Castle>(2)
        j.beginArray()
        while (j.hasNext()) {
            var side = 0; var x = 0; var baseY = 0; var cols = 0; var rows = 0; var block = 16
            var blocks: List<Block> = emptyList(); var rooms: List<Room> = emptyList(); var kettle: Kettle? = null
            var steam = 0; var steamTurn = 0; var fatigue = false; var shimmer = IntArray(0); var held = IntArray(0)
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "side" -> side = j.nextInt(); "x" -> x = j.nextInt(); "base_y" -> baseY = j.nextInt()
                "cols" -> cols = j.nextInt(); "rows" -> rows = j.nextInt(); "block" -> block = j.nextInt()
                "blocks" -> {
                    val bl = ArrayList<Block>(64)
                    j.beginArray()
                    while (j.hasNext()) {
                        var c = 0; var r = 0; var bx = 0; var by = 0; var mat = ""; var hp = 0; var max = 1
                        var battered = false; var root = false; var peephole = false
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) {
                            "c" -> c = j.nextInt(); "r" -> r = j.nextInt(); "x" -> bx = j.nextInt(); "y" -> by = j.nextInt()
                            "mat" -> mat = j.nextString(); "hp" -> hp = j.nextInt(); "max" -> max = j.nextInt()
                            "battered" -> battered = j.nextBoolean(); "root" -> root = j.nextBoolean(); "peephole" -> peephole = j.nextBoolean()
                            else -> j.skipValue()
                        }
                        j.endObject()
                        bl.add(Block(c, r, bx, by, mat.intern(), hp, max, battered, root, peephole))
                    }
                    j.endArray()
                    blocks = bl
                }
                "rooms" -> {
                    val rl = ArrayList<Room>(6)
                    j.beginArray()
                    while (j.hasNext()) {
                        var kind = ""; var id = 0; var c = 0; var r = 0; var bx = IntArray(0); var intact = true; var flap = false; var lid = false; var lh = IntArray(0)
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) {
                            "kind" -> kind = j.nextString(); "id" -> id = j.nextInt(); "c" -> c = j.nextInt(); "r" -> r = j.nextInt()
                            "box" -> bx = box(j); "intact" -> intact = j.nextBoolean(); "flap" -> flap = j.nextBoolean(); "lid" -> lid = j.nextBoolean()
                            "loophole" -> lh = box(j)
                            else -> j.skipValue()
                        }
                        j.endObject()
                        rl.add(Room(kind, id, c, r, bx, intact, flap, lid, lh))
                    }
                    j.endArray()
                    rooms = rl
                }
                "kettle" -> if (!j.nextNull()) {
                    var hp = 0; var max = 1; var bx = IntArray(0); var room = IntArray(0); var lid = false; var intact = true
                    j.beginObject()
                    while (j.hasNext()) when (j.nextName()) {
                        "hp" -> hp = j.nextInt(); "max" -> max = j.nextInt(); "box" -> bx = box(j); "room" -> room = box(j)
                        "lid" -> lid = j.nextBoolean(); "intact" -> intact = j.nextBoolean()
                        else -> j.skipValue()
                    }
                    j.endObject()
                    kettle = Kettle(hp, max, bx, room, lid, intact)
                }
                "steam" -> steam = j.nextInt(); "steam_turn" -> steamTurn = j.nextInt(); "fatigue" -> fatigue = j.nextBoolean()
                "shimmer" -> shimmer = j.nextPairs(); "held" -> held = j.nextPairs()
                else -> j.skipValue()
            }
            j.endObject()
            out.add(Castle(side, x, baseY, cols, rows, block, blocks, rooms, kettle, steam, steamTurn, fatigue, shimmer, held))
        }
        j.endArray()
        out.sortBy { it.side }
        return out
    }

    private fun readHobs(j: JsonReader): List<Hob> {
        val out = ArrayList<Hob>(8)
        j.beginArray()
        while (j.hasNext()) {
            var id = 0; var side = 0; var def = ""; var name = ""; var cls = ""; var hp = 0; var max = 1; var state = ""; var nook = -1
            var x = 0; var y = 0; var rest = 0; var knack: String? = null; var knackUses = 0; var plain = ""
            var buried = false; var cover = false; var dummy = false; var grudge = false; var clatter = false; var canFire = false
            var angle = 0; var power = 0
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "id" -> id = j.nextInt(); "side" -> side = j.nextInt(); "def" -> def = j.nextString(); "name" -> name = j.nextString()
                "class" -> cls = j.nextString(); "hp" -> hp = j.nextInt(); "max" -> max = j.nextInt(); "state" -> state = j.nextString()
                "nook" -> nook = if (j.nextNull()) -1 else j.nextInt()
                "x" -> x = j.nextInt(); "y" -> y = j.nextInt(); "rest" -> rest = j.nextInt()
                "knack" -> knack = if (j.nextNull()) null else j.nextString()
                "knack_uses" -> knackUses = j.nextInt(); "plain" -> plain = j.nextString()
                "buried" -> buried = j.nextBoolean(); "cover" -> cover = j.nextBoolean(); "dummy" -> dummy = j.nextBoolean()
                "grudge" -> grudge = j.nextBoolean(); "clatter" -> clatter = j.nextBoolean(); "can_fire" -> canFire = j.nextBoolean()
                "aim" -> if (!j.nextNull()) {
                    j.beginObject()
                    while (j.hasNext()) when (j.nextName()) { "angle" -> angle = j.nextInt(); "power" -> power = j.nextInt(); else -> j.skipValue() }
                    j.endObject()
                }
                else -> j.skipValue()
            }
            j.endObject()
            out.add(Hob(id, side, def, name, cls, hp, max, state, nook, x, y, rest, knack, knackUses, plain, buried, cover, dummy, grudge, clatter, canFire, angle, power))
        }
        j.endArray()
        return out
    }

    /** Compact transforms: [id, x, y, rot, shot]. */
    private fun readShells(j: JsonReader): List<Shell> {
        if (j.nextNull()) return emptyList()
        j.beginArray()
        if (!j.hasNext()) { j.endArray(); return emptyList() }
        val out = ArrayList<Shell>(2)
        while (j.hasNext()) {
            j.beginArray()
            val id = j.nextInt(); val x = j.nextInt(); val y = j.nextInt(); val rot = j.nextInt(); val shot = j.nextString()
            while (j.hasNext()) j.skipValue()
            j.endArray()
            out.add(Shell(id, x, y, rot, shot))
        }
        j.endArray()
        return out
    }

    private fun readProps(j: JsonReader): List<Prop> {
        val out = ArrayList<Prop>()
        if (j.nextNull()) return out
        j.beginArray()
        while (j.hasNext()) out.add(readProp(j))
        j.endArray()
        return out
    }

    private fun readProp(j: JsonReader): Prop {
        var id = 0; var side = 2; var kind = ""; var tag = ""; var x = 0; var y = 0; var hp = 0; var max = 0; var shot: String? = null
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "id" -> id = j.nextInt(); "side" -> side = j.nextInt(); "kind" -> kind = j.nextString(); "tag" -> tag = if (j.nextNull()) "" else j.nextString()
            "x" -> x = j.nextInt(); "y" -> y = j.nextInt(); "hp" -> hp = j.nextInt(); "max" -> max = j.nextInt()
            "shot" -> shot = if (j.nextNull()) null else j.nextString()
            else -> j.skipValue()
        }
        j.endObject()
        return Prop(id, side, kind, tag, x, y, hp, max, shot)
    }

    private fun readGhosts(j: JsonReader): List<Ghost> {
        val out = ArrayList<Ghost>()
        j.beginArray()
        while (j.hasNext()) {
            var index = 0; var side = 0; var hob = 0; var shot = ""; var angle = 0; var power = 0; var round = 0
            var hasPin = false; var px = 0; var py = 0; var selfHit = false; var recalled = false; var points = IntArray(0)
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "index" -> index = j.nextInt(); "side" -> side = j.nextInt(); "hob" -> hob = j.nextInt(); "shot" -> shot = j.nextString()
                "angle" -> angle = j.nextInt(); "power" -> power = j.nextInt(); "round" -> round = j.nextInt()
                "pin" -> { val a = j.nextIntArray(); if (a.size >= 2) { hasPin = true; px = a[0]; py = a[1] } }
                "self_hit" -> selfHit = j.nextBoolean(); "recalled" -> recalled = j.nextBoolean()
                "points" -> points = j.nextPairs()
                else -> j.skipValue()
            }
            j.endObject()
            out.add(Ghost(index, side, hob, shot, angle, power, round, hasPin, px, py, selfHit, recalled, points))
        }
        j.endArray()
        return out
    }

    private fun intList(j: JsonReader): List<Int> = j.nextIntArray().toList()

    private fun readHud(j: JsonReader): Hud {
        var h = Hud()
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "turn" -> h = h.copy(turn = j.nextInt())
            "round" -> h = h.copy(round = j.nextInt())
            "round_cap" -> h = h.copy(roundCap = j.nextInt())
            "side" -> h = h.copy(side = j.nextInt())
            "wind" -> h = h.copy(wind = j.nextInt())
            "forecast" -> h = h.copy(forecast = j.nextInt())
            "front_rounds_left" -> h = h.copy(frontRoundsLeft = j.nextInt())
            "steam" -> h = h.copy(steam = intList(j))
            "steam_turn_left" -> h = h.copy(steamTurnLeft = j.nextInt())
            "kettle_pct" -> h = h.copy(kettlePct = intList(j))
            "crew" -> {
                val sides = ArrayList<List<CrewPip>>(2)
                j.beginArray()
                while (j.hasNext()) {
                    val list = ArrayList<CrewPip>()
                    j.beginArray()
                    while (j.hasNext()) {
                        var id = 0; var pct = 0; var st = ""; var cls = ""; var rest = 0
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) {
                            "id" -> id = j.nextInt(); "hp_pct" -> pct = j.nextInt(); "state" -> st = j.nextString(); "class" -> cls = j.nextString(); "rest" -> rest = j.nextInt()
                            else -> j.skipValue()
                        }
                        j.endObject()
                        list.add(CrewPip(id, pct, st, cls, rest))
                    }
                    j.endArray()
                    sides.add(list)
                }
                j.endArray()
                h = h.copy(crew = sides)
            }
            "squall_warning" -> h = h.copy(squallWarning = if (j.nextNull()) -1 else j.nextInt())
            "squall_round" -> h = h.copy(squallRound = j.nextInt())
            "squall" -> h = h.copy(squall = j.nextBoolean())
            "hands" -> {
                val sides = ArrayList<List<HandShell>>(2)
                j.beginArray()
                while (j.hasNext()) {
                    val list = ArrayList<HandShell>()
                    j.beginArray()
                    while (j.hasNext()) {
                        var id = ""; var name = ""; var match = ""; var weight = ""; var dud = false; var card = ""
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) {
                            "id" -> id = j.nextString(); "name" -> name = j.nextString(); "match" -> match = j.nextString()
                            "weight" -> weight = if (j.peek() == '"') j.nextString() else j.nextInt().toString()
                            "dud" -> dud = j.nextBoolean(); "card" -> card = j.nextString()
                            else -> j.skipValue()
                        }
                        j.endObject()
                        list.add(HandShell(id, name, match, weight, dud, card))
                    }
                    j.endArray()
                    sides.add(list)
                }
                j.endArray()
                h = h.copy(hands = sides)
            }
            "doodads" -> {
                val sides = ArrayList<List<String>>(2)
                j.beginArray(); while (j.hasNext()) sides.add(j.nextStringList()); j.endArray()
                h = h.copy(doodads = sides)
            }
            "selected" -> if (!j.nextNull()) {
                var hob = -1; var shot = "plain"
                j.beginObject()
                while (j.hasNext()) when (j.nextName()) { "hob" -> hob = if (j.nextNull()) -1 else j.nextInt(); "shot" -> shot = j.nextString(); else -> j.skipValue() }
                j.endObject()
                h = h.copy(selectedHob = hob, selectedShot = shot)
            }
            "names" -> h = h.copy(names = j.nextStringList())
            "control" -> h = h.copy(control = j.nextStringList())
            "score" -> h = h.copy(score = intList(j))
            "puff_up" -> {
                val l = ArrayList<Boolean>(2)
                j.beginArray(); while (j.hasNext()) l.add(j.nextBoolean()); j.endArray()
                h = h.copy(puffUp = l)
            }
            "steam_max" -> h = h.copy(steamMax = intList(j))
            "shove_off_cost" -> h = h.copy(shoveOffCost = j.nextInt())
            "shots" -> {
                val l = ArrayList<ShotChip>(4)
                if (!j.nextNull()) {
                    j.beginArray()
                    while (j.hasNext()) {
                        var shot = ""; var id = ""; var ready = false; var why: String? = null; var text: String? = null
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) {
                            "shot" -> shot = j.nextString(); "id" -> id = j.nextString(); "ready" -> ready = j.nextBoolean()
                            "why" -> why = if (j.nextNull()) null else j.nextString()
                            "text" -> text = if (j.nextNull()) null else j.nextString()
                            else -> j.skipValue()
                        }
                        j.endObject()
                        l.add(ShotChip(shot, id, ready, why, text))
                    }
                    j.endArray()
                }
                h = h.copy(shots = l)
            }
            "fire" -> h = h.copy(fire = if (j.nextNull()) null else {
                var ready = false; var why: String? = null; var text: String? = null
                j.beginObject()
                while (j.hasNext()) when (j.nextName()) {
                    "ready" -> ready = j.nextBoolean()
                    "why" -> why = if (j.nextNull()) null else j.nextString()
                    "text" -> text = if (j.nextNull()) null else j.nextString()
                    else -> j.skipValue()
                }
                j.endObject()
                FireState(ready, why, text)
            })
            "fatigue" -> h = h.copy(fatigue = if (j.nextNull()) false else j.nextBoolean())
            "fatigue_round" -> h = h.copy(fatigueRound = num(j))
            "fatigue_in" -> h = h.copy(fatigueIn = num(j, -1))
            "think_ms" -> h = h.copy(thinkMs = if (j.nextNull()) listOf(0, 0) else {
                val l = ArrayList<Int>(2)
                j.beginArray(); while (j.hasNext()) l.add(num(j, 0)); j.endArray()
                l
            })
            "handicap" -> {
                val l = ArrayList<Handicap>(2)
                if (!j.nextNull()) {
                    j.beginArray()
                    while (j.hasNext()) {
                        var help = "none"; var steam = 0; var pv = 30; var crew = 0
                        if (j.nextNull()) { l.add(Handicap()); continue }
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) {
                            "help" -> help = j.nextString(); "steam" -> steam = j.nextInt(); "preview_pct" -> pv = j.nextInt(); "crew" -> crew = j.nextInt()
                            else -> j.skipValue()
                        }
                        j.endObject()
                        l.add(Handicap(help, steam, pv, crew))
                    }
                    j.endArray()
                }
                h = h.copy(handicap = l)
            }
            "volley" -> h = h.copy(volley = if (j.nextNull()) null else {
                var actions = 0; var left: List<Int> = emptyList()
                j.beginObject()
                while (j.hasNext()) when (j.nextName()) { "actions" -> actions = j.nextInt(); "left" -> left = intList(j); else -> j.skipValue() }
                j.endObject()
                Volley(actions, left)
            })
            "boss" -> h = h.copy(boss = if (j.nextNull()) null else {
                var phase = 1; var roller: Prop? = null; var done = false; var shears: Prop? = null; var cut: IntArray? = null; var jam = 0
                j.beginObject()
                while (j.hasNext()) when (j.nextName()) {
                    "phase" -> phase = j.nextInt()
                    "roller" -> roller = if (j.nextNull()) null else readProp(j)
                    "roller_done" -> done = j.nextBoolean()
                    "shears" -> shears = if (j.nextNull()) null else readProp(j)
                    "cut" -> cut = if (j.nextNull()) null else j.nextIntArray()
                    "jam" -> jam = j.nextInt()
                    else -> j.skipValue()
                }
                j.endObject()
                Boss(phase, roller, done, shears, cut, jam)
            })
            "rules" -> h = h.copy(rules = if (j.nextNull()) LevelRules() else {
                var tag: String? = null; var count = 0; var capWin: Int? = null
                j.beginObject()
                while (j.hasNext()) when (j.nextName()) {
                    "objective" -> if (!j.nextNull()) {
                        j.beginObject()
                        while (j.hasNext()) when (j.nextName()) { "tag" -> tag = j.nextString(); "count" -> count = j.nextInt(); else -> j.skipValue() }
                        j.endObject()
                    }
                    "cap_win" -> capWin = if (j.nextNull()) null else j.nextInt()
                    else -> j.skipValue()
                }
                j.endObject()
                LevelRules(tag, count, capWin)
            })
            else -> j.skipValue()
        }
        j.endObject()
        return h
    }

    private fun readDraft(j: JsonReader): Draft {
        var pool: List<String> = emptyList(); val picks = ArrayList<List<String>>(2); var next = 0; var each = 0; var wish: String? = null
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "pool" -> pool = j.nextStringList()
            "picks" -> { j.beginArray(); while (j.hasNext()) picks.add(j.nextStringList()); j.endArray() }
            "next" -> next = j.nextInt(); "picks_each" -> each = j.nextInt()
            "wish" -> wish = if (j.nextNull()) null else j.nextString()
            else -> j.skipValue()
        }
        j.endObject()
        return Draft(pool, picks, next, each, wish)
    }

    private fun bools(j: JsonReader): List<Boolean> {
        val l = ArrayList<Boolean>(3)
        if (j.nextNull()) return l
        j.beginArray(); while (j.hasNext()) l.add(j.nextBoolean()); j.endArray()
        return l
    }

    private fun readResult(j: JsonReader): BattleResult {
        var winner = -1; var how = ""; var round = 0; var pennants: List<Boolean> = emptyList(); var pNew: List<Boolean> = emptyList()
        var buttons = 0; var score: List<Int> = emptyList(); val stats = ArrayList<SideStats>(2); var broke: Broke? = null; var best: BestShot? = null
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "winner" -> winner = if (j.nextNull()) -1 else j.nextInt(); "how" -> how = j.nextString(); "round" -> round = j.nextInt()
            "pennants" -> pennants = bools(j)
            "pennants_new" -> pNew = bools(j)
            "buttons" -> buttons = j.nextInt()
            "score" -> score = intList(j)
            "stats" -> if (!j.nextNull()) {
                j.beginArray()
                while (j.hasNext()) {
                    var s = SideStats()
                    j.beginObject()
                    while (j.hasNext()) when (j.nextName()) {
                        "shots" -> s = s.copy(shots = j.nextInt()); "hits" -> s = s.copy(hits = j.nextInt())
                        "blocks_dropped" -> s = s.copy(blocksDropped = j.nextInt()); "bonks" -> s = s.copy(bonks = j.nextInt())
                        "blocks_lost" -> s = s.copy(blocksLost = j.nextInt()); "kettle_lost" -> s = s.copy(kettleLost = j.nextInt())
                        "hobs_lost" -> s = s.copy(hobsLost = j.nextInt()); "best_streak" -> s = s.copy(bestStreak = j.nextInt())
                        "best_shot" -> s = s.copy(bestShot = readBest(j))
                        else -> j.skipValue()
                    }
                    j.endObject()
                    stats.add(s)
                }
                j.endArray()
            }
            "broke" -> broke = if (j.nextNull()) null else readBroke(j)
            "best_shot" -> best = readBest(j)
            else -> j.skipValue()
        }
        j.endObject()
        return BattleResult(winner, how, round, pennants, pNew, buttons, score, stats, broke, best)
    }

    private fun readBest(j: JsonReader): BestShot? {
        if (j.nextNull()) return null
        var side = -1; var hob = -1; var hobName = ""; var shot = ""; var shotName = ""; var angle = 0; var power = 0; var round = 0; var dmg = 0
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "side" -> side = num(j, -1); "hob" -> hob = num(j, -1); "hob_name" -> hobName = str(j)
            "shot" -> shot = str(j); "shot_name" -> shotName = str(j)
            "angle" -> angle = num(j); "power" -> power = num(j); "round" -> round = num(j); "dmg" -> dmg = num(j)
            else -> j.skipValue()
        }
        j.endObject()
        return BestShot(side, hob, hobName, shot, shotName, angle, power, round, dmg)
    }

    private fun readBlow(j: JsonReader): Blow {
        var shot = ""; var shotName = ""; var hob = -1; var hobName = ""; var round = 0; var dmg = 0; var by = ""
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "shot" -> shot = str(j); "shot_name" -> shotName = str(j)
            "hob" -> hob = if (j.nextNull()) -1 else j.nextInt(); "hob_name" -> hobName = str(j)
            "round" -> round = num(j); "dmg" -> dmg = num(j); "by" -> by = str(j)
            else -> j.skipValue()
        }
        j.endObject()
        return Blow(shot, shotName, hob, hobName, round, dmg, by)
    }

    private fun readBroke(j: JsonReader): Broke {
        var side = 0; var how = ""; var last: Blow? = null; val top = ArrayList<Blow>(3); var kettle = 0; var blocks = 0; var bonked = 0
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "side" -> side = j.nextInt(); "how" -> how = j.nextString()
            "last" -> last = if (j.nextNull()) null else readBlow(j)
            "top" -> if (!j.nextNull()) { j.beginArray(); while (j.hasNext()) top.add(readBlow(j)); j.endArray() }
            "kettle_lost" -> kettle = j.nextInt(); "blocks_lost" -> blocks = j.nextInt(); "hobs_bonked" -> bonked = j.nextInt()
            else -> j.skipValue()
        }
        j.endObject()
        return Broke(side, how, last, top, kettle, blocks, bonked)
    }

    private fun readEvents(j: JsonReader): List<GameEvent> {
        if (j.nextNull()) return emptyList()
        j.beginArray()
        if (!j.hasNext()) { j.endArray(); return emptyList() }
        val out = ArrayList<GameEvent>()
        val xy = IntArray(2)
        while (j.hasNext()) {
            var t = ""; var tick = 0; var x = 0; var y = 0; var r = 0; var side = -1; var hob = -1; var dmg = 0; var n = 0
            var winner = -1; var round = 0; var target = ""; var how = ""; var text = ""; var callout = false
            var c = 0; var shot = ""; var type = ""; var why = ""; var kind = ""; var state = ""; var room = ""
            var phase = 0; var cells = 0; var nook = -1; var hp = 0; var wind = 0; var power = 0; var angle = 0
            var fx = 0; var fy = 0; var tx = 0; var ty = 0; var count = 0; var blocks = GameEvent.EMPTY_INTS; var falls = GameEvent.EMPTY_INTS
            var cut = GameEvent.EMPTY_INTS; var threaded = false; var buttons = 0
            var fromShot = ""; var toShot = ""; var whenTag = ""
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "t" -> t = j.nextString(); "tick" -> tick = j.nextInt()
                "x" -> x = num(j); "y" -> y = num(j); "r" -> r = num(j); "c" -> c = num(j)
                "side" -> side = num(j, -1); "hob" -> hob = num(j, -1); "dmg" -> dmg = num(j); "n" -> n = num(j)
                "winner" -> winner = num(j, -1); "round" -> round = num(j)
                "target" -> target = str(j); "how" -> how = str(j); "text" -> text = str(j)
                "callout" -> callout = if (j.nextNull()) false else j.nextBoolean()
                "threaded" -> threaded = if (j.nextNull()) false else j.nextBoolean()
                "shot" -> shot = str(j); "type" -> type = str(j); "why" -> why = str(j); "kind" -> kind = str(j)
                "state" -> state = str(j); "doodad" -> kind = str(j); "room" -> room = if (j.peek() == '"') j.nextString() else j.nextRaw()
                "phase" -> phase = num(j); "cells" -> cells = num(j); "nook" -> nook = num(j, -1); "hp" -> hp = num(j)
                "wind" -> wind = num(j); "power" -> power = num(j); "angle" -> angle = num(j); "buttons" -> buttons = num(j)
                "from" -> if (j.peek() == '"') fromShot = j.nextString() else { point(j, xy); fx = xy[0]; fy = xy[1] }
                "to" -> if (j.peek() == '"') toShot = j.nextString() else { point(j, xy); tx = xy[0]; ty = xy[1] }
                "when" -> whenTag = str(j)
                "blocks" -> if (j.peek() == '[') blocks = triples(j) else count = num(j)
                "falls" -> falls = j.nextPairs()
                "cut" -> cut = j.nextIntArray()
                else -> j.skipValue()
            }
            j.endObject()
            if (blocks.isNotEmpty() && count == 0) count = blocks.size / 3
            out.add(GameEvent(t, tick, x, y, r, side, hob, dmg, n, winner, round, target, how, text, callout,
                c, shot, type, why, kind, state, room, phase, cells, nook, hp, wind, power, angle, fx, fy, tx, ty, count, blocks, falls, cut, threaded, buttons,
                fromShot, toShot, whenTag))
        }
        j.endArray()
        return out
    }

    /** An int, or [def] for null or any other kind of value. */
    private fun num(j: JsonReader, def: Int = 0): Int = when (j.peek()) {
        'n' -> { j.nextNull(); def }
        '-', in '0'..'9' -> j.nextInt()
        else -> { j.skipValue(); def }
    }

    private fun str(j: JsonReader): String = when (j.peek()) {
        '"' -> j.nextString()
        'n' -> { j.nextNull(); "" }
        else -> j.nextRaw()
    }

    /** `[x, y]` or a single number x. */
    private fun point(j: JsonReader, out: IntArray) {
        out[0] = 0; out[1] = 0
        if (j.peek() == '[') { val a = j.nextIntArray(); if (a.isNotEmpty()) out[0] = a[0]; if (a.size > 1) out[1] = a[1] } else out[0] = num(j)
    }

    /** `[[c, r, "mat"], ...]` or `[[c, r], ...]` into c, r, material code triples. */
    private fun triples(j: JsonReader): IntArray {
        j.beginArray()
        var out = IntArray(24); var n = 0
        while (j.hasNext()) {
            if (n + 3 > out.size) out = out.copyOf(out.size * 2)
            var k = 0
            out[n] = 0; out[n + 1] = 0; out[n + 2] = -1
            if (j.peek() != '[') { j.skipValue(); continue }
            j.beginArray()
            while (j.hasNext()) {
                when {
                    j.peek() == '"' -> { val m = GameEvent.matCode(j.nextString()); if (k < 3) out[n + 2] = m }
                    k < 2 -> out[n + k] = num(j)
                    else -> j.skipValue()
                }
                k++
            }
            j.endArray()
            n += 3
        }
        j.endArray()
        return out.copyOf(n)
    }
}

/**
 * A command reply (core/schema/reply.schema.json). A refused `fire` also has [detail] (plain
 * words to show) and [readyShot] (`"plain"` when the Plain Shot would fire, else null).
 */
class Reply(val ok: Boolean, val reason: String, val raw: String, val detail: String = "", val readyShot: String? = null) {
    companion object {
        fun parse(text: String): Reply = try {
            val j = JsonReader(text.toByteArray(Charsets.UTF_8))
            if (j.peek() == '[') {
                // An array of replies: ok only if every one is; the first refusal speaks for it.
                var first: Reply? = null
                j.beginArray()
                while (j.hasNext()) { val r = one(j, text); if (!r.ok && first == null) first = r }
                j.endArray()
                first ?: Reply(true, "", text)
            } else one(j, text)
        } catch (e: RuntimeException) { Reply(false, "bad_reply", text) }

        private fun one(j: JsonReader, text: String): Reply {
            var ok = false; var reason = ""; var detail = ""; var ready: String? = null
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "ok" -> ok = j.nextBoolean(); "reason" -> reason = j.nextString()
                "detail" -> detail = when (j.peek()) { '"' -> j.nextString(); 'n' -> { j.nextNull(); "" }; else -> j.nextRaw() }
                "ready_shot" -> ready = if (j.nextNull()) null else j.nextString()
                else -> j.skipValue()
            }
            j.endObject()
            return Reply(ok, reason, text, detail, ready)
        }
    }
}

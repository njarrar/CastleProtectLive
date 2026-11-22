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
    val bonked: Boolean get() = state == "bonked"
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
    val names: List<String> = listOf("You", "Rival"),
    val control: List<String> = listOf("human", "ai"),
    val score: List<Int> = listOf(0, 0),
    val puffUp: List<Boolean> = listOf(false, false),
) {
    fun human(side: Int) = control.getOrElse(side) { "ai" } == "human"
}

data class Draft(val pool: List<String>, val picks: List<List<String>>, val next: Int, val picksEach: Int, val wish: String?)

data class BattleResult(val winner: Int, val how: String, val round: Int, val pennants: List<Boolean>)

/** One core event. Only the fields the app uses are kept; see core/API.md for the full list. */
class GameEvent(
    @JvmField val t: String, @JvmField val tick: Int,
    @JvmField val x: Int, @JvmField val y: Int, @JvmField val r: Int,
    @JvmField val side: Int, @JvmField val hob: Int, @JvmField val dmg: Int, @JvmField val n: Int,
    @JvmField val winner: Int, @JvmField val round: Int,
    @JvmField val target: String, @JvmField val how: String, @JvmField val text: String,
    @JvmField val callout: Boolean,
)

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
                else -> j.skipValue()
            }
        }
        j.endObject()

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
        j.beginArray()
        while (j.hasNext()) {
            var id = 0; var side = 2; var kind = ""; var tag = ""; var x = 0; var y = 0; var hp = 0; var max = 0; var shot: String? = null
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "id" -> id = j.nextInt(); "side" -> side = j.nextInt(); "kind" -> kind = j.nextString(); "tag" -> tag = j.nextString()
                "x" -> x = j.nextInt(); "y" -> y = j.nextInt(); "hp" -> hp = j.nextInt(); "max" -> max = j.nextInt()
                "shot" -> shot = if (j.nextNull()) null else j.nextString()
                else -> j.skipValue()
            }
            j.endObject()
            out.add(Prop(id, side, kind, tag, x, y, hp, max, shot))
        }
        j.endArray()
        return out
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

    private fun readResult(j: JsonReader): BattleResult {
        var winner = -1; var how = ""; var round = 0; val pennants = ArrayList<Boolean>(3)
        j.beginObject()
        while (j.hasNext()) when (j.nextName()) {
            "winner" -> winner = j.nextInt(); "how" -> how = j.nextString(); "round" -> round = j.nextInt()
            "pennants" -> { j.beginArray(); while (j.hasNext()) pennants.add(j.nextBoolean()); j.endArray() }
            else -> j.skipValue()
        }
        j.endObject()
        return BattleResult(winner, how, round, pennants)
    }

    private fun readEvents(j: JsonReader): List<GameEvent> {
        if (j.nextNull()) return emptyList()
        j.beginArray()
        if (!j.hasNext()) { j.endArray(); return emptyList() }
        val out = ArrayList<GameEvent>()
        while (j.hasNext()) {
            var t = ""; var tick = 0; var x = 0; var y = 0; var r = 0; var side = -1; var hob = -1; var dmg = 0; var n = 0
            var winner = -1; var round = 0; var target = ""; var how = ""; var text = ""; var callout = false
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) {
                "t" -> t = j.nextString(); "tick" -> tick = j.nextInt()
                "x" -> x = j.nextInt(); "y" -> y = j.nextInt(); "r" -> r = j.nextInt()
                "side" -> side = j.nextInt(); "hob" -> hob = j.nextInt(); "dmg" -> dmg = j.nextInt(); "n" -> n = j.nextInt()
                "winner" -> winner = j.nextInt(); "round" -> round = j.nextInt()
                "target" -> target = j.nextString(); "how" -> how = j.nextString(); "text" -> text = j.nextString()
                "callout" -> callout = j.nextBoolean()
                else -> j.skipValue()
            }
            j.endObject()
            out.add(GameEvent(t, tick, x, y, r, side, hob, dmg, n, winner, round, target, how, text, callout))
        }
        j.endArray()
        return out
    }
}

/** A command reply (core/schema/reply.schema.json). */
class Reply(val ok: Boolean, val reason: String, val raw: String) {
    companion object {
        fun parse(text: String): Reply = try {
            val j = JsonReader(text.toByteArray(Charsets.UTF_8))
            var ok = false; var reason = ""
            if (j.peek() == '[') {
                // An array of replies: ok only if every one is.
                ok = true
                j.beginArray()
                while (j.hasNext()) { val r = one(j); if (!r.first) { ok = false; if (reason.isEmpty()) reason = r.second } }
                j.endArray()
            } else { val r = one(j); ok = r.first; reason = r.second }
            Reply(ok, reason, text)
        } catch (e: RuntimeException) { Reply(false, "bad_reply", text) }

        private fun one(j: JsonReader): Pair<Boolean, String> {
            var ok = false; var reason = ""
            j.beginObject()
            while (j.hasNext()) when (j.nextName()) { "ok" -> ok = j.nextBoolean(); "reason" -> reason = j.nextString(); else -> j.skipValue() }
            j.endObject()
            return ok to reason
        }
    }
}

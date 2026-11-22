package games.castleprotect.core

/**
 * DEBUG ONLY. A thin player for the golden files in core/fixtures, used when the
 * native library is not in a debug APK so the screens can still be exercised.
 *
 * It holds no game rules. It plays a fixed loop:
 *   snapshot_plan  (side 0 to act)
 *   fire           -> snapshot_lean while the shell flies (for FLIGHT_TICKS ticks)
 *                  -> snapshot_after_shot (side 1, AI to act)
 *   ai_turn        -> back to snapshot_plan
 * Other commands are accepted and logged but change nothing; the fixtures do not
 * have frames for them. The fixtures carry no terrain (it was drained earlier), so
 * the first snapshot adds flat ground at the forts' footing line, for display only.
 */
class FixtureCore private constructor(private val f: Files) : CoreGame {

    class Files(val plan: String, val lean: String, val afterShot: String) {
        companion object {
            fun load(read: (String) -> String?): Files? {
                val plan = read("snapshot_plan.json") ?: return null
                val lean = read("snapshot_lean.json") ?: return null
                val after = read("snapshot_after_shot.json") ?: return null
                return Files(plan, lean, after)
            }
        }
    }

    private enum class State { PLAN, FLIGHT, AFTER }
    private var state = State.PLAN
    private var first = true
    private var dirty = true
    private var flown = 0
    private var tick = 0
    private val log = ArrayList<String>()
    private var closed = false

    private val planFrame = SnapshotParser().parse(f.plan.toByteArray())
    private val afterFrame = SnapshotParser().parse(f.afterShot.toByteArray())

    override fun command(json: String): String {
        check(!closed)
        val cmd = try { val j = JsonReader(json.toByteArray()); if (j.peek() == '[') "" else cmdName(j) } catch (e: RuntimeException) { return """{"ok":false,"reason":"bad_json"}""" }
        return when (cmd) {
            "fire" -> if (state == State.PLAN) { state = State.FLIGHT; flown = 0; dirty = true; log.add(json); """{"ok":true}""" } else no("not_planning")
            "ai_turn" -> if (state == State.AFTER) { state = State.PLAN; dirty = true; """{"ok":true,"commands":[]}""" } else no("not_planning")
            "log" -> """{"ok":true,"log":[${log.joinToString(",")}]}"""
            "hash" -> """{"ok":true,"hash":"${current().hash}"}"""
            "terrain_all" -> { first = true; dirty = true; """{"ok":true}""" }
            "pick_hob", "pick_shot", "aim", "recall", "walk", "shove_off", "doodad", "pass",
            "pick_shell", "quick_pick", "end_draft" -> { log.add(json); dirty = true; """{"ok":true}""" }
            "lean_lines", "shimmer", "validate_blueprint" -> """{"ok":true}"""
            else -> no("unknown_command")
        }
    }

    private fun cmdName(j: JsonReader): String {
        j.beginObject()
        while (j.hasNext()) { if (j.nextName() == "cmd") return j.nextString() else j.skipValue() }
        return ""
    }

    private fun no(r: String) = """{"ok":false,"reason":"$r"}"""

    override fun step(ticks: Int): String {
        check(!closed)
        if (state == State.FLIGHT) {
            flown += ticks; tick += ticks
            if (flown >= FLIGHT_TICKS) { state = State.AFTER; dirty = true }
        }
        val ph = if (state == State.FLIGHT) "resolve" else "plan"
        return """{"tick":$tick,"phase":"$ph"}"""
    }

    private fun current() = if (state == State.AFTER) afterFrame else planFrame

    override fun snapshot(): ByteArray {
        check(!closed)
        if (state == State.FLIGHT) return f.lean.toByteArray()
        if (!dirty) {
            val c = current()
            val aw = c.awaiting.name.lowercase()
            return """{"tick":${c.tick},"phase":"plan","side":${c.side},"awaiting":"$aw","full":false,"terrain":{"chunks":[]},"shells":[],"events":[]}""".toByteArray()
        }
        dirty = false
        var text = if (state == State.AFTER) f.afterShot else f.plan
        if (first) { first = false; text = withGround(text, planFrame) }
        return text.toByteArray()
    }

    override fun close() { closed = true }

    companion object {
        const val FLIGHT_TICKS = 180

        fun factory(files: Files) = object : CoreFactory {
            override val name = "fixture player (debug build, no native core)"
            override val standIn = true
            override fun newGame(setupJson: String, seed: Long): CoreGame = FixtureCore(files)
        }

        /** Splices flat ground chunks into a fixture that has an empty chunk list. */
        internal fun withGround(text: String, frame: Frame): String {
            val w = frame.mapW; val h = frame.mapH; val size = 256
            val ground = frame.castles.minOfOrNull { it.baseY } ?: (h * 2 / 3)
            val sb = StringBuilder("\"chunks\": [")
            var firstChunk = true
            var cy = 0
            while (cy * size < h) {
                var cx = 0
                while (cx * size < w) {
                    val x = cx * size; val y = cy * size
                    val cw = minOf(size, w - x); val ch = minOf(size, h - y)
                    if (y + ch > ground) {
                        val bytes = ByteArray(cw * ch) { i -> if (y + i / cw >= ground) 1 else 0 }
                        if (!firstChunk) sb.append(',')
                        firstChunk = false
                        sb.append("""{"cx":$cx,"cy":$cy,"x":$x,"y":$y,"w":$cw,"h":$ch,"data":"${java.util.Base64.getEncoder().encodeToString(bytes)}"}""")
                    }
                    cx++
                }
                cy++
            }
            sb.append(']')
            val at = Regex("\"chunks\"\\s*:\\s*\\[\\s*]").find(text) ?: return text
            return text.replaceRange(at.range, sb)
        }
    }
}

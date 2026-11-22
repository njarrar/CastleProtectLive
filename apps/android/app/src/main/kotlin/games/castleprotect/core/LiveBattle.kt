package games.castleprotect.core

/**
 * One battle on the core, with dead handle recovery (core/API.md "Errors and panics").
 *
 * A panic in the core comes back as `{"ok":false,"reason":"panic"}` and leaves the
 * handle dead: every later call answers `dead_handle`. The core never loses the
 * battle's log, but a dead handle can not be asked for it, so this class keeps a copy:
 * after every command that changes the battle it reads `{"cmd":"log"}` (aim runs fold
 * into one entry, so only the last aim is kept apart). On a dead reply it frees the
 * handle, starts a new one with `cp_new` and the same setup and seed, sends
 * `{"cmd":"resume","log":[...]}`, and sends the last aim again. The command that
 * panicked is dropped. After [MAX_RECOVERIES] the battle is marked [broken].
 *
 * Not thread safe: the sim thread owns it.
 */
class LiveBattle private constructor(
    private val factory: CoreFactory,
    val setup: String,
    val seed: Long,
    private var game: CoreGame,
) : AutoCloseable {
    /** The core's log as of the last command that changed the battle (raw JSON array text). */
    var log: String = "[]"
        private set
    private var lastAim: String? = null
    var recoveries = 0
        private set
    /** Set when the battle can not go on (recovery failed or ran out). */
    var broken: String? = null
        private set
    /** True after a rebuild, until the owner reads it with [takeRebuilt]. */
    private var rebuilt = false

    fun takeRebuilt(): Boolean { val r = rebuilt; rebuilt = false; return r }

    /** Sends one command. A dead reply starts a recovery and is returned as it came. */
    fun command(json: String): String {
        if (broken != null) return """{"ok":false,"reason":"dead_handle","detail":"battle could not be rebuilt"}"""
        val text = game.command(json)
        val r = Reply.parse(text)
        if (!r.ok && isDead(r.reason)) { recover(r.reason); return text }
        if (r.ok) after(json)
        return text
    }

    /** Steps the sim. A dead reply starts a recovery. */
    fun step(ticks: Int): String {
        if (broken != null) return """{"ok":false,"reason":"dead_handle"}"""
        val text = game.step(ticks)
        if (text.contains("\"ok\":false")) {
            val r = Reply.parse(text)
            if (isDead(r.reason)) recover(r.reason)
        }
        return text
    }

    /** The raw snapshot. A dead handle answers with a refusal, which [SnapshotParser] throws as a [CoreFault]. */
    fun snapshot(): ByteArray = game.snapshot()

    private fun after(json: String) {
        when (cmdName(json)) {
            "aim" -> lastAim = json
            "log", "hash", "terrain_all", "lean_lines", "shimmer", "validate_blueprint" -> {}
            else -> { readLog(game)?.let { log = it }; lastAim = null }
        }
    }

    /**
     * Rebuilds the battle on a new handle from the kept log. Returns true when the
     * battle can go on. Safe to call for a [CoreFault] seen in a snapshot.
     */
    fun recover(why: String): Boolean {
        if (broken != null) return false
        if (recoveries >= MAX_RECOVERIES) { broken = "the core failed again ($why)"; return false }
        recoveries++
        try { game.close() } catch (e: RuntimeException) { }
        return try {
            val g = factory.newGame(setup, seed)
            replay(g, log)
            lastAim?.let { g.command(it) }
            game = g
            rebuilt = true
            true
        } catch (e: Exception) {
            broken = e.message ?: why
            false
        }
    }

    override fun close() { try { game.close() } catch (e: RuntimeException) { } }

    companion object {
        const val MAX_RECOVERIES = 3

        fun isDead(reason: String) = reason == "panic" || reason == "dead_handle" || reason == "null_handle"

        /** Starts a battle, and when [log] is not empty, rebuilds it from that log. Throws [CoreException]. */
        fun open(factory: CoreFactory, setup: String, seed: Long, log: String = "[]"): LiveBattle {
            val g = factory.newGame(setup, seed)
            try { replay(g, log) } catch (e: Exception) { g.close(); throw e }
            val b = LiveBattle(factory, setup, seed, g)
            b.log = if (log.isBlank()) "[]" else log
            return b
        }

        /**
         * Replays a log on a new handle with `resume`. A core without `resume` (the debug
         * fixture player) gets the log one command at a time, stepping through each flight
         * first, as core/API.md describes for v0.1.
         */
        fun replay(g: CoreGame, log: String) {
            if (log.isBlank() || log.trim() == "[]") return
            val r = Reply.parse(g.command(Cmd.resume(log)))
            if (r.ok) return
            if (r.reason != "unknown_command") throw CoreException("the core refused the saved battle (${r.reason})")
            val j = JsonReader(log.toByteArray(Charsets.UTF_8))
            j.beginArray()
            while (j.hasNext()) {
                val cmd = j.nextRaw()
                settle(g)
                val one = Reply.parse(g.command(cmd))
                if (!one.ok) throw CoreException("the core refused a saved command (${one.reason})")
            }
            j.endArray()
            settle(g)
        }

        /** Steps through any flight, so the next command meets a Plan or Draft. */
        fun settle(g: CoreGame) {
            var guard = 0
            while (guard++ < 50) {
                val ph = field(g.step(0), "phase")
                if (ph != "resolve" && ph != "settle") return
                g.step(2400)
            }
        }

        fun readLog(g: CoreGame): String? = try {
            val j = JsonReader(g.command(Cmd.LOG).toByteArray(Charsets.UTF_8))
            var out: String? = null
            j.beginObject()
            while (j.hasNext()) { if (j.nextName() == "log") out = j.nextRaw() else j.skipValue() }
            out
        } catch (e: RuntimeException) { null }

        /** A top level string field of a small reply, or "". */
        fun field(text: String, name: String): String = try {
            val j = JsonReader(text.toByteArray(Charsets.UTF_8))
            var out = ""
            j.beginObject()
            while (j.hasNext()) { if (j.nextName() == name && j.peek() == '"') out = j.nextString() else j.skipValue() }
            out
        } catch (e: RuntimeException) { "" }

        fun cmdName(json: String): String {
            if (json.trimStart().startsWith("[")) return "batch"
            return field(json, "cmd")
        }
    }
}

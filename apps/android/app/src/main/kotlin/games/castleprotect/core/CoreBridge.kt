package games.castleprotect.core

/**
 * The only door between the app and the game rules (core/API.md).
 *
 * One [CoreGame] is one battle handle (`cp_new` ... `cp_free`). The app sends
 * commands as JSON and reads frame snapshots as JSON. It never computes rules.
 *
 * Implementations:
 *  - [NativeCore]: the shared Rust core through JNI (libcastle_jni.so + libcastle_ffi.so).
 *  - FixtureCore (debug builds only, src/debug): replays core/fixtures when the native
 *    library is missing, so screens can be exercised. It holds no game rules.
 *
 * Every call on a game is made from the one sim thread GameSession owns.
 */
interface CoreGame : AutoCloseable {
    /** One command object or an array of them. Returns the reply JSON. */
    fun command(json: String): String

    /** Advance whole 120 Hz ticks. Returns {"tick":n,"phase":"..."}. */
    fun step(ticks: Int): String

    /** The frame snapshot as UTF-8 JSON bytes. Drains events and dirty terrain chunks. */
    fun snapshot(): ByteArray

    override fun close()
}

class CoreException(message: String) : Exception(message)

interface CoreFactory {
    /** Shown in Settings > About. */
    val name: String
    /** True for the debug fixture player. Its saves go to their own file. */
    val standIn: Boolean
    /** Starts a battle from a setup (core/schema/setup.schema.json). Throws [CoreException] with the core's reason. */
    fun newGame(setupJson: String, seed: Long): CoreGame
}

object Core {
    /**
     * The native core when its libraries are packaged. In debug builds only, the
     * fixture player when they are not. Release builds get null and show an error
     * (and the release Gradle build fails without the native core anyway).
     */
    fun factory(ctx: android.content.Context): CoreFactory? = NativeCore.factory() ?: CoreFallback.factory(ctx)
}

/** Command JSON, written in one place. Names and fields are those of core/API.md. */
object Cmd {
    private fun q(s: String) = JsonText.quote(s)

    // Rummage (phase draft)
    fun pickShell(shell: String) = """{"cmd":"pick_shell","shell":${q(shell)}}"""
    const val QUICK_PICK = """{"cmd":"quick_pick"}"""
    const val END_DRAFT = """{"cmd":"end_draft"}"""

    // Turn (phase plan)
    fun pickHob(hob: Int) = """{"cmd":"pick_hob","hob":$hob}"""
    fun pickShot(shot: String) = """{"cmd":"pick_shot","shot":${q(shot)}}"""
    fun aim(angle: Int, power: Int) = """{"cmd":"aim","angle":$angle,"power":$power}"""
    fun recall(ghost: Int) = """{"cmd":"recall","ghost":$ghost}"""
    fun walk(dx: Int) = """{"cmd":"walk","dx":$dx}"""
    fun shoveOff(hob: Int) = """{"cmd":"shove_off","hob":$hob}"""
    const val FIRE = """{"cmd":"fire"}"""
    fun doodad(id: String) = """{"cmd":"doodad","doodad":${q(id)}}"""
    fun doodadRoom(id: String, room: String) = """{"cmd":"doodad","doodad":${q(id)},"room":${q(room)}}"""
    const val PASS = """{"cmd":"pass"}"""
    const val AI_TURN = """{"cmd":"ai_turn"}"""
    /** End the battle now; the other side wins (`how: "give_up"`). [side] -1: the core's default. */
    fun giveUp(side: Int = -1) = if (side < 0) """{"cmd":"give_up"}""" else """{"cmd":"give_up","side":$side}"""
    /** Test Yard only. */
    fun setWind(wind: Int) = """{"cmd":"set_wind","wind":$wind}"""
    /** Rebuild a battle on a fresh handle from its saved log (raw JSON array text). */
    fun resume(log: String) = """{"cmd":"resume","log":$log}"""

    // Queries
    const val LOG = """{"cmd":"log"}"""
    const val HASH = """{"cmd":"hash"}"""
    const val TERRAIN_ALL = """{"cmd":"terrain_all"}"""
}

/** Per side options for a setup (core/API.md "Starting a battle"). Defaults send nothing. */
data class SideOpts(
    /** Help handicap: none, some or lots. */
    val help: String = "none",
    /** Preview share 0 to 100, or -1 for the level's. */
    val previewPct: Int = -1,
    /** Crew size handicap 1 to 5, or 0 for all. */
    val crewSize: Int = 0,
) {
    fun json(): String {
        val sb = StringBuilder()
        if (help != "none") sb.append(""","help":${JsonText.quote(help)}""")
        if (previewPct in 0..100) sb.append(""","preview_pct":$previewPct""")
        if (crewSize in 1..5) sb.append(""","crew_size":$crewSize""")
        return sb.toString()
    }
}

/** `progress` in a campaign setup: what the save holds, for the core's Buttons reward. */
data class Progress(val cleared: Boolean, val pennants: List<Boolean>, val dailyPaid: Boolean = false) {
    fun json() = """{"cleared":$cleared,"pennants":[${pennants.take(3).joinToString(",")}],"daily_paid":$dailyPaid}"""
}

/**
 * A battle the app can start again: the setup sent to `cp_new`, the seed, and how
 * the app should present it. Rematch and Carry on both start from this.
 */
data class BattleSpec(
    val setup: String,
    val seed: Long,
    /** campaign, skirmish or couch: decides menus and the Results screen. */
    val kind: String,
    val level: String,
    /** Couch Duel: side_by_side shows the hand-off card between turns. */
    val seats: String = "one_seat",
) {
    fun withSeed(s: Long) = copy(seed = s)

    companion object {
        fun newSeed(): Long = System.nanoTime() and 0x7FFF_FFFF_FFFFL

        fun campaign(level: String, preset: String, seed: Long = newSeed(), help: SideOpts = SideOpts(), progress: Progress? = null) = BattleSpec(
            """{"level":${JsonText.quote(level)},"mode":"campaign","sides":[{"control":"human"${help.json()}},{"control":"ai","preset":${JsonText.quote(preset)}}]""" +
                (progress?.let { ""","progress":${it.json()}""" } ?: "") + "}",
            seed, "campaign", level,
        )

        /**
         * wind: 0 calm, 1 light, 2 gusty. Plain only turns the Rummage off.
         * volley: Actions per side for Volley Points (6, 10, 14), or 0 for Knockout.
         */
        fun skirmish(level: String, preset: String, roundCap: Int, wind: Int, plainOnly: Boolean, seed: Long = newSeed(), help: SideOpts = SideOpts(), volley: Int = 0) = BattleSpec(
            """{"level":${JsonText.quote(level)},"mode":"skirmish","sides":[{"control":"human"${help.json()}},{"control":"ai","preset":${JsonText.quote(preset)}}],""" +
                (if (volley > 0) """"volley":$volley""" else """"round_cap":$roundCap""") +
                ""","wind":${windJson(wind)}${if (plainOnly) ""","rummage":{"pool":0,"picks":0}""" else ""}}""",
            seed, "skirmish", level,
        )

        fun couch(level: String, names: List<String>, roundCap: Int, wind: Int, plainOnly: Boolean, seats: String, seed: Long = newSeed(),
                  help: List<SideOpts> = listOf(SideOpts(), SideOpts()), volley: Int = 0) = BattleSpec(
            """{"level":${JsonText.quote(level)},"mode":"couch","sides":[""" +
                names.take(2).mapIndexed { i, n -> """{"control":"human","name":${JsonText.quote(JsonText.takeCodePoints(n, 12))}${help.getOrElse(i) { SideOpts() }.json()}}""" }.joinToString(",") +
                "]," + (if (volley > 0) """"volley":$volley""" else """"round_cap":$roundCap""") +
                ""","wind":${windJson(wind)}${if (plainOnly) ""","rummage":{"pool":0,"picks":0}""" else ""}}""",
            seed, "couch", level, seats,
        )

        /** Couch Duel Help steps, from the design's table: preview arc 30, 60, 100 percent. */
        fun duelHelp(step: Int): SideOpts = when (step) {
            1 -> SideOpts("some", 60)
            2 -> SideOpts("lots", 100)
            else -> SideOpts()
        }

        private fun windJson(w: Int) = when (w) { 0 -> """{"min":0,"max":0}"""; 2 -> """{"min":2,"max":6}"""; else -> """{"min":0,"max":3}""" }
    }
}

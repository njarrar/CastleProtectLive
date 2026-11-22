package games.castleprotect.core

/**
 * The only door between the app and the game rules.
 *
 * The app sends commands as JSON and reads a frame snapshot as JSON. It never
 * computes rules itself. Two implementations exist:
 *  - [NativeCore]: the shared Rust core through JNI (libcastle_jni.so + libcastle_ffi.so).
 *  - [FakeCore]: a small stand-in used only when the native library is not in the APK,
 *    so screens can be built and tested before the core lands.
 *
 * All calls are made from the sim thread owned by GameSession, except [query],
 * which GameSession also serialises onto the same lock.
 */
interface CoreBridge {
    /** Human readable name, shown in Settings > About. */
    val name: String

    /** Send one command, for example {"cmd":"aim","angle":620,"power":74}. Returns {"ok":true} or {"ok":false,"reason":"key"}. */
    fun command(json: String): String

    /** Advance the sim by wall-clock milliseconds. The core steps whole 120 Hz ticks. */
    fun advance(ms: Int)

    /** Current frame snapshot as JSON. Events in it are drained by this call. */
    fun snapshot(): String

    /** Menu data off the hot path: {"q":"campaign"}, {"q":"level","id":"1-3"}, {"q":"roster"}. */
    fun query(json: String): String

    /** Full save (progress plus the battle in play, if any) as an opaque string. */
    fun save(): String

    /** Restore from [save] output. Returns false if the data was refused. */
    fun load(data: String): Boolean

    fun close()
}

object Core {
    /** Picks the native core when its libraries are packaged, else the stand-in. */
    fun create(): CoreBridge = NativeCore.tryCreate() ?: FakeCore()
}

/** Small helpers so command JSON is written in one place. */
object Cmd {
    fun aim(angleTenths: Int, power: Int) = """{"cmd":"aim","angle":$angleTenths,"power":$power}"""
    const val FIRE = """{"cmd":"fire"}"""
    const val READY = """{"cmd":"ready"}"""
    const val END_DRAFT = """{"cmd":"end_draft"}"""
    const val QUICK_PICK = """{"cmd":"quick_pick"}"""
    const val ABANDON = """{"cmd":"abandon"}"""
    const val RECALL = """{"cmd":"recall"}"""
    fun walk(dx: Int) = """{"cmd":"walk","dx":$dx}"""
    fun pickHob(id: String) = """{"cmd":"pick_hob","id":${q(id)}}"""
    fun pickShell(id: String) = """{"cmd":"pick_shell","id":${q(id)}}"""
    fun draftPick(id: String) = """{"cmd":"draft_pick","id":${q(id)}}"""
    fun speed(x: Int) = """{"cmd":"speed","x":$x}"""
    fun newBattle(
        mode: String, level: String? = null, preset: String = "fair",
        names: List<String> = emptyList(), seats: String = "side_by_side",
        rounds: Int = 15, wind: String = "light", draft: Boolean = true, seed: Long = System.nanoTime(),
    ): String {
        val sb = StringBuilder("""{"cmd":"new_battle","mode":${q(mode)},"preset":${q(preset)},"seats":${q(seats)},""")
        sb.append(""""rounds":$rounds,"wind":${q(wind)},"draft":$draft,"seed":$seed""")
        if (level != null) sb.append(""","level":${q(level)}""")
        if (names.isNotEmpty()) sb.append(""","names":[${names.joinToString(",") { q(it) }}]""")
        return sb.append("}").toString()
    }
    fun q(s: String) = org.json.JSONObject.quote(s)
}

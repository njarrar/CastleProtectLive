package games.castleprotect

import java.io.File

/** Reads the shared core/fixtures and core/schema files from the repo (path given by Gradle). */
object Fixtures {
    val root: File = File(System.getProperty("castle.repoRoot") ?: "../../..").canonicalFile
    fun text(path: String): String = File(root, path).readText()
    fun bytes(path: String): ByteArray = File(root, path).readBytes()
    fun fixture(name: String): String = text("core/fixtures/$name")

    /** `bp_home_3` from content/blueprints.json: the fort a new Workshop starts from. */
    val homeRows: List<String> by lazy {
        val a = org.json.JSONArray(text("content/blueprints.json"))
        val o = (0 until a.length()).map { a.getJSONObject(it) }.first { it.getString("id") == "bp_home_3" }
        val r = o.getJSONArray("rows")
        (0 until r.length()).map { r.getString(it) }
    }
}

package games.castleprotect

import java.io.File

/** Reads the shared core/fixtures and core/schema files from the repo (path given by Gradle). */
object Fixtures {
    val root: File = File(System.getProperty("castle.repoRoot") ?: "../../..").canonicalFile
    fun text(path: String): String = File(root, path).readText()
    fun bytes(path: String): ByteArray = File(root, path).readBytes()
    fun fixture(name: String): String = text("core/fixtures/$name")
}

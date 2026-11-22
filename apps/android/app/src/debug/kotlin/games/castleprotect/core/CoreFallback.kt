package games.castleprotect.core

/** Debug builds only: the fixture player stands in when libcastle_jni.so is not packaged. */
object CoreFallback {
    fun factory(ctx: android.content.Context): CoreFactory? {
        val a = ctx.assets
        val files = FixtureCore.Files.load { name -> try { a.open("fixtures/$name").bufferedReader().use { it.readText() } } catch (e: Exception) { null } }
            ?: return null
        return FixtureCore.factory(files)
    }
}

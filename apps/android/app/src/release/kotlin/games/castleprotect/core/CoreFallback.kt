package games.castleprotect.core

/** Release builds have no stand-in core: without the native library the app shows an error. */
object CoreFallback {
    @Suppress("UNUSED_PARAMETER")
    fun factory(ctx: android.content.Context): CoreFactory? = null
}

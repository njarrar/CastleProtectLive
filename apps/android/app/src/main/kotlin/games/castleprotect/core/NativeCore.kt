@file:JvmName("CoreJni")

package games.castleprotect.core

/**
 * The shared Rust core through JNI. libcastle_jni.so (app/src/main/cpp/castle_jni.c)
 * is a thin shim over the C ABI in core/castle-ffi/include/castle_core.h and links
 * against libcastle_ffi.so, which CI builds with cargo-ndk into jniLibs.
 *
 * Text crosses as UTF-8 byte arrays both ways, never as jstring, so characters
 * outside the Basic Multilingual Plane (an emoji in a name) reach Rust intact.
 */
class NativeCore private constructor(private var handle: Long) : CoreGame {

    private fun h(): Long { check(handle != 0L) { "core handle is closed" }; return handle }

    override fun command(json: String): String =
        nativeCommand(h(), z(json))?.let { String(it, Charsets.UTF_8) } ?: """{"ok":false,"reason":"native_null"}"""

    override fun step(ticks: Int): String =
        nativeStep(h(), ticks.coerceAtLeast(0))?.let { String(it, Charsets.UTF_8) } ?: "{}"

    override fun snapshot(): ByteArray = nativeSnapshot(h()) ?: throw IllegalStateException("cp_snapshot returned NULL")

    override fun close() { if (handle != 0L) { nativeFree(handle); handle = 0 } }

    companion object {
        /** UTF-8 bytes with a NUL at the end, ready for a C string. */
        private fun z(s: String): ByteArray { val b = s.toByteArray(Charsets.UTF_8); return b.copyOf(b.size + 1) }

        @Volatile private var loaded: Boolean? = null

        /** True once libcastle_jni.so (and through it libcastle_ffi.so) is loaded. */
        fun available(): Boolean {
            loaded?.let { return it }
            val ok = try { System.loadLibrary("castle_jni"); true } catch (e: UnsatisfiedLinkError) { false } catch (e: SecurityException) { false }
            loaded = ok
            return ok
        }

        fun version(): String = nativeVersion()?.let { String(it, Charsets.UTF_8) } ?: "{}"

        fun factory(): CoreFactory? {
            if (!available()) return null
            val v = runCatching { version() }.getOrDefault("{}")
            return object : CoreFactory {
                override val name = "castle-core $v"
                override val standIn = false
                override fun newGame(setupJson: String, seed: Long): CoreGame {
                    val h = nativeNew(z(setupJson), seed)
                    if (h == 0L) {
                        val why = nativeLastError(0L)?.let { String(it, Charsets.UTF_8) } ?: "cp_new failed"
                        throw CoreException(why)
                    }
                    return NativeCore(h)
                }
            }
        }
    }
}

// JNI entry points: static methods of games.castleprotect.core.CoreJni, implemented in
// app/src/main/cpp/castle_jni.c. content_json is always the built in content (NULL).
private external fun nativeNew(setup: ByteArray, seed: Long): Long
private external fun nativeVersion(): ByteArray?
private external fun nativeLastError(h: Long): ByteArray?
private external fun nativeCommand(h: Long, json: ByteArray): ByteArray?
private external fun nativeStep(h: Long, ticks: Int): ByteArray?
private external fun nativeSnapshot(h: Long): ByteArray?
private external fun nativeFree(h: Long)

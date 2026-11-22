package games.castleprotect.core

/**
 * The shared Rust core through JNI. libcastle_jni.so is a thin C shim
 * (app/src/main/cpp/castle_jni.c) over the C ABI in core/castle-ffi/include/castle_core.h;
 * it links against libcastle_ffi.so, which CI builds with cargo-ndk into jniLibs.
 */
class NativeCore private constructor(private var handle: Long) : CoreBridge {
    override val name = "castle-core " + (runCatching { nativeVersion() }.getOrNull() ?: "")

    override fun command(json: String): String = nativeCommand(handle, json) ?: """{"ok":false,"reason":"native_null"}"""
    override fun advance(ms: Int) = nativeAdvance(handle, ms)
    override fun snapshot(): String = nativeSnapshot(handle) ?: "{}"
    override fun query(json: String): String = nativeQuery(handle, json) ?: "{}"
    override fun save(): String = nativeSave(handle) ?: ""
    override fun load(data: String): Boolean = nativeLoad(handle, data)
    override fun close() { if (handle != 0L) { nativeFree(handle); handle = 0 } }

    private external fun nativeCommand(h: Long, json: String): String?
    private external fun nativeAdvance(h: Long, ms: Int)
    private external fun nativeSnapshot(h: Long): String?
    private external fun nativeQuery(h: Long, json: String): String?
    private external fun nativeSave(h: Long): String?
    private external fun nativeLoad(h: Long, data: String): Boolean
    private external fun nativeFree(h: Long)

    companion object {
        @JvmStatic private external fun nativeNew(): Long
        @JvmStatic private external fun nativeVersion(): String?

        fun tryCreate(): NativeCore? = try {
            System.loadLibrary("castle_jni")
            val h = nativeNew()
            if (h == 0L) null else NativeCore(h)
        } catch (e: UnsatisfiedLinkError) {
            null
        }
    }
}

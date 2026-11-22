package games.castleprotect.game

import android.content.Context
import android.util.AtomicFile
import java.io.File

/**
 * Local save. The core owns the format; the app only writes the bytes atomically
 * (temp file, then rename, through AtomicFile) so a kill mid-write cannot corrupt it.
 */
class SaveStore(ctx: Context) {
    private val file = AtomicFile(File(ctx.filesDir, "save/castle.sav").also { it.parentFile?.mkdirs() })

    fun read(): String? = try { String(file.readFully(), Charsets.UTF_8) } catch (e: Exception) { null }

    @Synchronized
    fun write(data: String) {
        if (data.isEmpty()) return
        var out: java.io.FileOutputStream? = null
        try {
            out = file.startWrite()
            out.write(data.toByteArray(Charsets.UTF_8))
            file.finishWrite(out)
        } catch (e: Exception) {
            if (out != null) file.failWrite(out)
        }
    }

    fun clear() = file.delete()
}

package games.castleprotect.core

/**
 * The terrain grid the core sends as base64 chunks (core/API.md, `terrain.chunks`).
 * One byte per world cell, row major, a material code (0 air, 1 Loam, 2 Clay,
 * 3 Rock, 4 Bedrock, 5 Mud, 6 Water). The app only stores and draws it.
 *
 * Written by the snapshot parser on the sim thread, read by the renderer. The
 * renderer takes the changed rectangles with [takeDirty] and copies them into its
 * bitmap under the same lock, so it never uploads the whole map again.
 */
class Terrain(val w: Int, val h: Int) {
    val cells = ByteArray(w * h)
    /** y of the first solid cell in each column (h when the column is empty). */
    val surface = IntArray(w) { h }
    @Volatile var version = 0
        private set
    private val dirty = ArrayList<IntArray>()

    /** Decodes one chunk's base64 straight from [src] bytes [from, to) into the grid. */
    fun writeChunk(x: Int, y: Int, cw: Int, ch: Int, src: ByteArray, from: Int, to: Int) {
        synchronized(this) {
            var bits = 0
            var nbits = 0
            var i = 0 // cells written within the chunk
            val total = cw * ch
            var k = from
            while (k < to && i < total) {
                val v = DEC[src[k].toInt() and 0xFF]
                k++
                if (v < 0) continue // '=', line breaks
                bits = (bits shl 6) or v
                nbits += 6
                if (nbits >= 8) {
                    nbits -= 8
                    val byte = (bits shr nbits) and 0xFF
                    val cx = x + i % cw
                    val cy = y + i / cw
                    if (cx in 0 until w && cy in 0 until h) cells[cy * w + cx] = byte.toByte()
                    i++
                }
            }
            for (cx in maxOf(0, x) until minOf(w, x + cw)) recomputeSurface(cx)
            dirty.add(intArrayOf(x, y, cw, ch))
            version++
        }
    }

    private fun recomputeSurface(cx: Int) {
        var y = 0
        while (y < h && cells[y * w + cx].toInt() == 0) y++
        surface[cx] = y
    }

    /** Ground height (y of the surface) at world x, clamped to the map. */
    fun groundAt(x: Int): Int = if (w == 0) h else surface[x.coerceIn(0, w - 1)]

    /** Moves the changed rectangles (x, y, w, h) into [out]. Call [lock] around the copy that follows. */
    fun takeDirty(out: MutableList<IntArray>) = synchronized(this) { out.addAll(dirty); dirty.clear() }

    /** Marks everything dirty again (a new bitmap, after the old one was dropped). */
    fun markAllDirty() = synchronized(this) { dirty.clear(); dirty.add(intArrayOf(0, 0, w, h)) }

    inline fun <T> lock(fn: () -> T): T = synchronized(this) { fn() }

    companion object {
        private val DEC = IntArray(256) { -1 }.also { t ->
            val a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
            for (i in a.indices) t[a[i].code] = i
            t['-'.code] = 62; t['_'.code] = 63 // url-safe alphabet too
        }
    }
}

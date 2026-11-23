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
        if (cw <= 0 || ch <= 0) return
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
    fun groundAt(x: Int): Int = synchronized(this) { if (w == 0) h else surface[x.coerceIn(0, w - 1)] }

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

/**
 * Painterly stratified earth cross-section shader (Part 2 Plate 1 & 2).
 * Pure deterministic integer hash math with zero per-frame allocations:
 * - 1 Loam: warm pebbled soil with rich dark topsoil rim
 * - 2 Clay: horizontal terracotta wavy strata bands
 * - 3 Rock: faceted cool slate-grey blocks & dark fracture veins
 * - 4 Bedrock: deep compressed basalt strata
 * - 5 Mud: damp marsh mottling & speckle
 * - 6 Water: sunlit brook ripples over deep stream teal
 */
object TerrainStrata {
    private fun hash(x: Int, y: Int): Int {
        var h = x * 374761393 + y * 668265263
        h = (h xor (h ushr 13)) * 1274126177
        return h xor (h ushr 16)
    }

    /** Returns an ARGB pixel for terrain material [mat] at world cell ([cx], [cy]), [depth] cells below surface. */
    fun colorAt(mat: Int, cx: Int, cy: Int, depth: Int): Int {
        val m = mat and 7
        if (m == 0) return 0x00000000
        val h = hash(cx shr 1, cy shr 1)
        val fine = hash(cx, cy)
        return when (m) {
            1 -> { // Loam: dark topsoil edge + warm organic pebbled soil
                if (depth in 0..5) {
                    if ((fine and 3) == 0) 0xFF6B4226.toInt() else 0xFF7B4C2D.toInt()
                } else {
                    val pebble = hash(cx / 6, cy / 5) and 15
                    val px = cx % 6; val py = cy % 5
                    when {
                        pebble == 0 && px in 1..3 && py in 1..2 -> 0xFFB47B4E.toInt() // warm ochre pebble
                        pebble == 1 && px in 2..4 && py in 1..3 -> 0xFF73482B.toInt() // dark clod
                        (h and 7) == 0 -> 0xFFA66E46.toInt()
                        (h and 7) == 1 -> 0xFF835132.toInt()
                        else -> 0xFF935D3A.toInt()
                    }
                }
            }
            2 -> { // Clay: terracotta horizontal undulating bands
                val wave = ((cx shr 4) + ((cx * 3) shr 5)) and 7
                val bandY = cy + (if (wave < 4) wave else 7 - wave)
                val band = (bandY / 5) and 3
                val seam = (bandY % 5) == 0
                when {
                    seam && (h and 3) != 0 -> 0xFF974E2D.toInt()
                    band == 0 -> if ((fine and 7) == 0) 0xFFD88F5E.toInt() else 0xFFC7784B.toInt()
                    band == 1 -> 0xFFB6683F.toInt()
                    band == 2 -> if ((fine and 5) == 0) 0xFFCF8354.toInt() else 0xFFBE6F44.toInt()
                    else -> 0xFFA85B36.toInt()
                }
            }
            3 -> { // Rock: faceted cool slate-grey stone & dark veins
                val fa = (cx + (cy shr 1)) / 10
                val fb = (cx - cy) / 12
                val facet = hash(fa, fb) and 3
                val veinA = ((cx + (cy shr 1)) % 10 == 0)
                val veinB = (((cx - cy) and 15) == 0)
                when {
                    veinA && (h and 3) != 0 -> 0xFF565F6B.toInt() // cool slate fracture vein
                    veinB && (h and 7) == 0 -> 0xFFABB3BD.toInt() // pale quartz streak
                    facet == 0 -> 0xFF919AA5.toInt()
                    facet == 1 -> 0xFF7E8792.toInt()
                    facet == 2 -> 0xFF88919C.toInt()
                    else -> 0xFF6E7782.toInt()
                }
            }
            4 -> { // Bedrock: deep basalt strata
                val layer = ((cy + ((cx shr 5) and 3)) / 4) and 3
                when {
                    (h and 15) == 0 -> 0xFF2B272D.toInt()
                    layer == 0 -> 0xFF4C474E.toInt()
                    layer == 1 -> 0xFF3E3A40.toInt()
                    layer == 2 -> 0xFF464148.toInt()
                    else -> 0xFF343036.toInt()
                }
            }
            5 -> { // Mud: damp marsh speckle
                when (h and 7) {
                    0 -> 0xFF4F3C2B.toInt()
                    1 -> 0xFF755B41.toInt()
                    2 -> 0xFF7C694C.toInt() // wet reed fleck
                    3 -> 0xFF594430.toInt()
                    else -> 0xFF664E37.toInt()
                }
            }
            6 -> { // Water: sunlit brook with surface shimmer
                val ripple = ((cx + cy * 3) shr 3) and 3
                when {
                    depth in 0..3 && ripple == 0 -> 0xD887D2F4.toInt()
                    depth in 0..6 -> 0xCC58AFDF.toInt()
                    ripple == 1 && (h and 3) == 0 -> 0xCC66BCE6.toInt()
                    else -> 0xCC3C8EC2.toInt()
                }
            }
            else -> 0xFF935D3A.toInt()
        }
    }
}

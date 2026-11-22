package games.castleprotect.game

import org.json.JSONObject

/**
 * The Workshop fort being edited: a grid of glyphs as the core reads them in a setup's
 * `sides[i].rows` (core/API.md "Starting a battle"): `.` empty, `w` Wicker, `t` Timber,
 * `c` Cobble, `K` Kettle Room, `1` to `5` Nooks; the Footing row is added under it.
 * Whether a fort stands is the core's call (`validate_blueprint`); this only edits glyphs.
 *
 * Grid rows here count from the bottom: row 0 sits on the Footing.
 */
class FortGrid(val cols: Int = COLS, val rows: Int = ROWS) {
    private val cells = Array(rows) { CharArray(cols) { '.' } }

    operator fun get(c: Int, r: Int): Char = if (c in 0 until cols && r in 0 until rows) cells[r][c] else '.'

    fun copy(): FortGrid = FortGrid(cols, rows).also { g -> for (r in 0 until rows) cells[r].copyInto(g.cells[r]) }

    /** The Nooks in use, 1 to 5. */
    fun nooks(): Set<Int> {
        val s = HashSet<Int>()
        for (r in cells) for (ch in r) if (ch in '1'..'5') s.add(ch - '0')
        return s
    }

    /** Seats the fort offers: its Nooks. */
    fun seats(): Int = nooks().size

    /**
     * Puts [tool] at column [c], row [r]: a block glyph fills one cell; `K` and `N` (the next free
     * Nook) fill the 2 x 2 room whose lower left is there; `.` erases (a whole room when it hits one).
     * Returns false when nothing changed.
     */
    fun place(tool: Char, c: Int, r: Int): Boolean {
        if (c !in 0 until cols || r !in 0 until rows) return false
        val here = cells[r][c]
        when (tool) {
            '.' -> {
                if (here == '.') return false
                if (here == 'K' || here in '1'..'5') clearGlyph(here) else cells[r][c] = '.'
            }
            'K', 'N' -> {
                if (c + 1 >= cols || r + 1 >= rows) return false
                val box = listOf(c to r, c + 1 to r, c to r + 1, c + 1 to r + 1)
                if (box.any { (x, y) -> isRoom(cells[y][x]) }) return false
                val glyph = if (tool == 'K') 'K' else ((1..MAX_NOOKS).firstOrNull { it !in nooks() } ?: return false).let { '0' + it }
                if (glyph == 'K') clearGlyph('K')
                for ((x, y) in box) cells[y][x] = glyph
            }
            'w', 't', 'c' -> {
                if (isRoom(here) || here == tool) return false
                cells[r][c] = tool
            }
            else -> return false
        }
        return true
    }

    private fun isRoom(ch: Char) = ch == 'K' || ch in '1'..'5'
    private fun clearGlyph(g: Char) { for (row in cells) for (i in row.indices) if (row[i] == g) row[i] = '.' }

    /**
     * The rows for the core: cut to the used columns, top down, with the Footing row last.
     * Empty when nothing is placed.
     */
    fun toRows(): List<String> {
        var c0 = cols; var c1 = -1; var top = -1
        for (r in 0 until rows) for (c in 0 until cols) if (cells[r][c] != '.') { c0 = minOf(c0, c); c1 = maxOf(c1, c); top = maxOf(top, r) }
        if (c1 < 0) return emptyList()
        val out = ArrayList<String>(top + 2)
        for (r in top downTo 0) out.add(String(cells[r], c0, c1 - c0 + 1))
        out.add("F".repeat(c1 - c0 + 1))
        return out
    }

    companion object {
        /** content/app.json `workshop`: 8 x 10 with the Footing, up to 5 Nooks. */
        const val COLS = 8
        const val ROWS = 9
        const val MAX_NOOKS = 5

        /** content/blueprints.json `bp_home_3`, the fort a new Workshop starts from. */
        val HOME = listOf("ttttttt", "t11t22t", "t11t22t", "ttttttt", "tKKt33t", "tKKt33t", "FFFFFFF")

        /** A grid from rows (top down, an `F` Footing row last is dropped). Out of grid cells are cut. */
        fun fromRows(rows: List<String>): FortGrid {
            val g = FortGrid()
            val body = if (rows.isNotEmpty() && rows.last().all { it == 'F' }) rows.dropLast(1) else rows
            body.reversed().forEachIndexed { r, line ->
                if (r < g.rows) line.forEachIndexed { c, ch -> if (c < g.cols) g.cells[r][c] = if (ch in "wtcK12345") ch else '.' }
            }
            return g
        }

        /**
         * The cell size in dp for a grid in a box of [w] x [h] dp: as big as fits, never under 24 dp
         * (QA playtest 1, M5: the landscape grid was 5 px cells). Under 24 the screen scrolls.
         */
        fun cellDp(w: Float, h: Float, cols: Int = COLS, rows: Int = ROWS + 1): Float =
            maxOf(MIN_CELL_DP, minOf(56f, minOf(w / cols, h / rows)))

        const val MIN_CELL_DP = 24f

        /** A short landscape screen puts the grid on the left and the palette and buttons on the right. */
        fun sideBySide(w: Float, h: Float): Boolean = w > h * 1.2f
    }
}

/** The core's `validate_blueprint` reply, as the Workshop shows it. [cells] are c, r pairs to mark (r from the Footing). */
class FortCheck(val ok: Boolean, val why: String, val used: Int = 0, val budget: Int = 0, val cost: Int = 0, val cells: List<Pair<Int, Int>> = emptyList()) {
    companion object {
        fun parse(reply: String): FortCheck {
            val o = JSONObject(reply)
            val cells = ArrayList<Pair<Int, Int>>()
            o.optJSONArray("cells")?.let { a -> for (i in 0 until a.length()) a.optJSONArray(i)?.let { p -> if (p.length() >= 2) cells.add(p.getInt(0) to p.getInt(1)) } }
            val ok = o.optBoolean("ok", false)
            val why = if (ok) "" else o.optString("detail").ifEmpty { o.optString("reason", "Not ready") }
            return FortCheck(ok, why, o.optInt("used"), o.optInt("budget"), o.optInt("cost"), cells)
        }
    }
}

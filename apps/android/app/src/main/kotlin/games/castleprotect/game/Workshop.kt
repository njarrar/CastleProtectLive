package games.castleprotect.game

import games.castleprotect.core.Text
import org.json.JSONObject

/**
 * The Workshop fort being edited: a grid of glyphs as the core reads them in a setup's
 * `sides[i].rows` (core/API.md "Starting a battle"): `.` empty, `w` Wicker, `t` Timber,
 * `c` Cobble, `K` Kettle Room, `1` to `5` Nooks; the Footing row is added under it.
 * Whether a fort stands is the core's call (`validate_blueprint`); this only edits glyphs.
 *
 * Grid rows here count from the bottom: row 0 sits on the Footing.
 */
class FortGrid(val cols: Int = COLS, val rows: Int = ROWS, val maxNooks: Int = MAX_NOOKS) {
    private val cells = Array(rows) { CharArray(cols) { '.' } }

    operator fun get(c: Int, r: Int): Char = if (c in 0 until cols && r in 0 until rows) cells[r][c] else '.'

    fun copy(): FortGrid = FortGrid(cols, rows, maxNooks).also { g -> for (r in 0 until rows) cells[r].copyInto(g.cells[r]) }

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
                if (here == 'K' || here in '1'..'5') {
                    clearGlyph(here)
                    if (here in '1'..'5') compactNooks()
                } else cells[r][c] = '.'
            }
            'K', 'N' -> {
                if (c + 1 >= cols || r + 1 >= rows) return false
                val box = listOf(c to r, c + 1 to r, c to r + 1, c + 1 to r + 1)
                // Allow nudging the Kettle Room onto its own previous cells (Android-L10).
                if (tool == 'K' && box.all { (x, y) -> cells[y][x] == 'K' }) return false
                if (box.any { (x, y) -> val ch = cells[y][x]; isRoom(ch) && !(tool == 'K' && ch == 'K') }) return false
                val glyph = if (tool == 'K') 'K' else ((1..maxNooks).firstOrNull { it !in nooks() } ?: return false).let { '0' + it }
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

    /** Renumbers remaining Nook glyphs to contiguous `'1'..'N'` so deleting Nook 1 or 2 never leaves a gap. */
    private fun compactNooks() {
        val present = nooks().sorted()
        var needs = false
        for (i in present.indices) if (present[i] != i + 1) { needs = true; break }
        if (!needs) return
        val map = CharArray(6) { ('0'.code + it).toChar() }
        for (i in present.indices) map[present[i]] = ('1'.code + i).toChar()
        for (row in cells) {
            for (i in row.indices) {
                val ch = row[i]
                if (ch in '1'..'5') row[i] = map[ch - '0']
            }
        }
    }

    /**
     * The rows for the core: cut to the used columns, top down, with the Footing row last.
     * Nook digits are compacted to contiguous `1..N`. Empty when nothing is placed.
     */
    fun toRows(): List<String> {
        var c0 = cols; var c1 = -1; var top = -1
        for (r in 0 until rows) for (c in 0 until cols) if (cells[r][c] != '.') { c0 = minOf(c0, c); c1 = maxOf(c1, c); top = maxOf(top, r) }
        if (c1 < 0) return emptyList()
        val present = nooks().sorted()
        val map = CharArray(6) { ('0'.code + it).toChar() }
        for (i in present.indices) map[present[i]] = ('1'.code + i).toChar()
        val out = ArrayList<String>(top + 2)
        val buf = CharArray(c1 - c0 + 1)
        for (r in top downTo 0) {
            for (c in c0..c1) {
                val ch = cells[r][c]
                buf[c - c0] = if (ch in '1'..'5') map[ch - '0'] else ch
            }
            out.add(String(buf))
        }
        out.add("F".repeat(c1 - c0 + 1))
        return out
    }

    companion object {
        /** content/app.json `workshop`: 8 x 10 with the Footing, up to 5 Nooks. */
        const val COLS = 8
        const val ROWS = 9
        const val MAX_NOOKS = 5

        /** The blueprint a new Workshop starts from: `bp_home_3` in content/blueprints.json (read through ContentInfo). */
        const val HOME_ID = "bp_home_3"

        /** A grid from rows (top down, an `F` Footing row last is dropped). Out of grid cells are cut. */
        fun fromRows(rows: List<String>, cols: Int = COLS, rowsCount: Int = ROWS, maxNooks: Int = MAX_NOOKS): FortGrid {
            val g = FortGrid(cols, rowsCount, maxNooks)
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

/**
 * The core's `validate_blueprint` reply, as the Workshop shows it. [cells] are c, r pairs to mark
 * (r from the Footing). [why] is in the string table's words (`workshop.problems`); [kind] is
 * the problem's key there, which also picks how a marked cell is labelled.
 */
class FortCheck(
    val ok: Boolean, val why: String, val used: Int = 0, val budget: Int = 0, val cost: Int = 0,
    val cells: List<Pair<Int, Int>> = emptyList(),
    val kind: String = if (ok) "" else problemOf(why).first,
) {
    companion object {
        fun parse(reply: String): FortCheck {
            val o = JSONObject(reply)
            val cells = ArrayList<Pair<Int, Int>>()
            o.optJSONArray("cells")?.let { a -> for (i in 0 until a.length()) a.optJSONArray(i)?.let { p -> if (p.length() >= 2) cells.add(p.getInt(0) to p.getInt(1)) } }
            val ok = o.optBoolean("ok", false)
            if (ok) return FortCheck(true, "", o.optInt("used"), o.optInt("budget"), o.optInt("cost"), cells, "")
            val detail = o.optString("detail")
            val coreProblem = if (o.isNull("problem")) null else o.optString("problem").takeIf { it.isNotEmpty() }
            val (kind, args) = problemOf(detail, coreProblem)
            return FortCheck(false, words(kind, args), o.optInt("used"), o.optInt("budget"), o.optInt("cost"), cells, kind)
        }

        private val NUMS = Regex("\\d+")

        /**
         * Reads a core `validate_blueprint` problem into a `workshop.problems` key and its numbers.
         * Prefers the structured core `problem` ID when present; falls back to parsing `detail`.
         */
        fun problemOf(detail: String, coreProblem: String? = null): Pair<String, Array<Pair<String, Any?>>> {
            val n = NUMS.findAll(detail).map { it.value.toInt() }.toList()
            if (!coreProblem.isNullOrEmpty() && (coreProblem == "wont_stand" || Text.has("workshop.problems.$coreProblem"))) {
                val args: Array<Pair<String, Any?>> = when (coreProblem) {
                    "nook_walls" -> arrayOf("n" to (n.firstOrNull() ?: 1))
                    "nooks_for_hobs" -> if (n.size >= 2) arrayOf("n" to n[0], "hobs" to n[1]) else emptyArray()
                    "nooks_max" -> arrayOf("n" to (n.firstOrNull() ?: 5))
                    "over_budget" -> if (n.size >= 2) arrayOf("n" to (n[0] - n[1]).coerceAtLeast(1)) else arrayOf("n" to (n.firstOrNull() ?: 1))
                    "too_big" -> arrayOf("cols" to n.getOrElse(4) { n.getOrElse(0) { 0 } }, "rows" to n.getOrElse(5) { n.getOrElse(1) { 0 } })
                    else -> emptyArray()
                }
                return coreProblem to args
            }
            val d = detail.lowercase()
            return when {
                d.isBlank() || d == "no rows" -> "too_small" to emptyArray()
                "support" in d || "float" in d || "nothing under" in d -> "nothing_under" to emptyArray()
                "kettle room" in d && "2 x 2" in d -> "kettle_room_size" to emptyArray()
                "kettle room" in d && ("one block in" in d || "outer face" in d) -> "kettle_room_edge" to emptyArray()
                "kettle room" in d && ("walled" in d || "walls" in d) -> "kettle_room_walls" to emptyArray()
                "kettle" in d && ("no " in d || "needs" in d || "missing" in d) -> "no_kettle_room" to emptyArray()
                "nook" in d && ("walled" in d || "walls" in d) -> "nook_walls" to arrayOf("n" to (n.firstOrNull() ?: 1))
                "nooks for" in d && n.size >= 2 -> "nooks_for_hobs" to arrayOf("n" to n[0], "hobs" to n[1])
                "at most" in d && "nook" in d -> "nooks_max" to arrayOf("n" to (n.firstOrNull() ?: 5))
                "nook" in d && ("no " in d || "needs" in d || "gap" in d) -> "no_nook" to emptyArray()
                "budget" in d && n.size >= 2 -> "over_budget" to arrayOf("n" to (n[0] - n[1]).coerceAtLeast(1))
                "footing" in d || "row 0" in d -> "footing_row" to emptyArray()
                "outside" in d && n.size >= 2 -> (if (n[0] < 3 || n[1] < 3) "too_small" else "too_big") to arrayOf("cols" to n.getOrElse(4) { 0 }, "rows" to n.getOrElse(5) { 0 })
                "wall" in d -> "needs_wall" to emptyArray()
                else -> "wont_stand" to emptyArray()
            }
        }

        /** The player's words for a problem key (`workshop.problems.<kind>`, plurals where the table has them). */
        fun words(kind: String, args: Array<Pair<String, Any?>>): String = when (kind) {
            "wont_stand" -> Text.t("workshop.wont_stand")
            "over_budget" -> Text.plural("workshop.problems.over_budget", (args.firstOrNull { it.first == "n" }?.second as? Int) ?: 1)
            else -> Text.t("workshop.problems.$kind", *args)
        }
    }
}

/**
 * Pure-Kotlin Workshop diagnostic mapping and unified 2x2 room layout helpers (Part 2 Plate 4).
 * Never decides validity rules (core `validate_blueprint` owns every rule); maps core problem
 * coordinates accurately onto the drafting grid and identifies unified 2x2 room boxes.
 */
object WorkshopDiag {
    data class RoomBox(val glyph: Char, val c: Int, val r: Int)

    /**
     * Maps core `validate_blueprint` problem cells onto the drafting grid using `(c + c0, r - 1)`
     * (core row 0 is Footing, so buildable row 0 is `r - 1`). Includes empty cells (e.g. missing wall
     * gaps labelled "Needs a wall") and occupied cells ("Nothing under it" or "Fix"), from `workshop.problems`.
     */
    fun mapBadCells(grid: FortGrid, check: FortCheck?): Map<Pair<Int, Int>, String> {
        if (check == null || check.ok || check.cells.isEmpty()) return emptyMap()
        val c0 = (0 until grid.cols).firstOrNull { c -> (0 until grid.rows).any { r -> grid[c, r] != '.' } } ?: 0
        val isFloatHint = check.kind == "nothing_under" || check.kind == "wont_stand"
        val isWallHint = check.kind == "needs_wall" || check.kind.endsWith("_walls") || check.kind == "kettle_room_edge"
        val needsWall = Text.t("workshop.problems.needs_wall")
        val out = LinkedHashMap<Pair<Int, Int>, String>()
        for ((cc, rr) in check.cells) {
            val gc = cc + c0
            val gr = rr - 1
            if (gc !in 0 until grid.cols || gr !in 0 until grid.rows) continue
            val ch = grid[gc, gr]
            val tag = when {
                ch == '.' -> needsWall
                isFloatHint -> Text.t("workshop.problems.nothing_under")
                isWallHint -> needsWall
                else -> Text.t("workshop.fix")
            }
            out[gc to gr] = tag
        }
        return out
    }

    /** Finds the bottom-left `(c, r)` anchor of each unique 2x2 room (`K`, `1`..`5`) on [grid]. */
    fun roomAnchors(grid: FortGrid): List<RoomBox> {
        val seen = HashSet<Char>()
        val out = ArrayList<RoomBox>()
        for (r in 0 until grid.rows) {
            for (c in 0 until grid.cols) {
                val ch = grid[c, r]
                if ((ch == 'K' || ch in '1'..'5') && ch !in seen) {
                    seen.add(ch)
                    out.add(RoomBox(ch, c, r))
                }
            }
        }
        return out
    }

    /** Column coordinate letter (`A`..`H`) for drafting board ticks. */
    fun colLabel(c: Int): String = if (c in 0..25) ('A' + c).toString() else (c + 1).toString()

    /** Issue count shown in the Workshop inspector badge when [check] fails. */
    fun issueCount(check: FortCheck?, badCount: Int): Int {
        if (check == null || check.ok) return 0
        return maxOf(1, badCount)
    }
}

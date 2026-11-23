package games.castleprotect.core

/**
 * A small pull parser over UTF-8 bytes, used for core snapshots and replies.
 *
 * It reads straight from the byte array the JNI shim returns: no String for the
 * whole document, no regex, no tree. Strings are only built for the values the
 * app keeps. Works the same on the phone and in JVM unit tests (android.util.JsonReader
 * does not run in unit tests).
 */
class JsonReader(private val b: ByteArray, private var p: Int = 0, private val end: Int = b.size) {

    class Malformed(msg: String) : RuntimeException(msg)

    val position: Int get() = p

    private fun ws() {
        while (p < end) {
            val c = b[p].toInt()
            if (c == ' '.code || c == '\n'.code || c == '\r'.code || c == '\t'.code) p++ else return
        }
    }

    private fun fail(what: String): Nothing = throw Malformed("$what at byte $p")

    /** Next significant byte as a char, or '\u0000' at the end. Skips a separating comma. */
    fun peek(): Char {
        ws()
        if (p < end && b[p] == ','.code.toByte()) { p++; ws() }
        return if (p < end) b[p].toInt().toChar() else '\u0000'
    }

    private fun expect(c: Char) {
        if (peek() != c) fail("expected '$c'")
        p++
    }

    fun beginObject() = expect('{')
    fun endObject() = expect('}')
    fun beginArray() = expect('[')
    fun endArray() = expect(']')

    /** True while the current object or array has more members. */
    fun hasNext(): Boolean {
        val c = peek()
        return c != '}' && c != ']' && c != '\u0000'
    }

    fun nextName(): String {
        val s = nextString()
        ws()
        if (p >= end || b[p] != ':'.code.toByte()) fail("expected ':'")
        p++
        return s
    }

    /** Consumes a null and returns true, or returns false and leaves the value. */
    fun nextNull(): Boolean {
        if (peek() == 'n') { literal("null"); return true }
        return false
    }

    private fun literal(word: String) {
        for (ch in word) { if (p >= end || b[p].toInt().toChar() != ch) fail("expected $word"); p++ }
    }

    fun nextBoolean(): Boolean = when (peek()) {
        't' -> { literal("true"); true }
        'f' -> { literal("false"); false }
        'n' -> { literal("null"); false }
        else -> fail("expected a boolean")
    }

    fun nextLong(): Long {
        val c = peek()
        if (c == 'n') { literal("null"); return 0 }
        val numStart = p
        var neg = false
        if (c == '-') { neg = true; p++ }
        var v = 0L
        var digits = 0
        while (p < end) {
            val d = b[p] - '0'.code.toByte()
            if (d in 0..9) { v = v * 10 + d; p++; digits++ } else break
        }
        if (digits == 0) fail("expected a number")
        // Fractions and exponents are not used by the core; read them as a double if they appear.
        if (p < end && (b[p] == '.'.code.toByte() || b[p] == 'e'.code.toByte() || b[p] == 'E'.code.toByte())) {
            p++
            while (p < end) {
                val ch = b[p].toInt().toChar()
                if (ch.isDigit() || ch == '-' || ch == '+' || ch == 'e' || ch == 'E' || ch == '.') p++ else break
            }
            return (String(b, numStart, p - numStart, Charsets.US_ASCII).toDoubleOrNull() ?: 0.0).toLong()
        }
        return if (neg) -v else v
    }

    fun nextInt(): Int = nextLong().toInt()

    fun nextString(): String {
        val c = peek()
        if (c == 'n') { literal("null"); return "" }
        if (c != '"') fail("expected a string")
        p++
        val start = p
        var escaped = false
        while (p < end) {
            val x = b[p]
            if (x == '"'.code.toByte()) break
            if (x == '\\'.code.toByte()) { escaped = true; p += 2; continue }
            p++
        }
        if (p >= end) fail("unterminated string")
        val stop = p
        p++ // closing quote
        if (!escaped) return String(b, start, stop - start, Charsets.UTF_8)
        return unescape(start, stop)
    }

    private fun unescape(start: Int, stop: Int): String {
        val raw = java.io.ByteArrayOutputStream(stop - start)
        val sb = StringBuilder(stop - start)
        var i = start
        fun flush() { if (raw.size() > 0) { sb.append(String(raw.toByteArray(), Charsets.UTF_8)); raw.reset() } }
        while (i < stop) {
            val x = b[i]
            if (x != '\\'.code.toByte()) { raw.write(x.toInt()); i++; continue }
            flush()
            if (i + 1 >= stop) fail("unterminated escape")
            val e = b[i + 1].toInt().toChar()
            i += 2
            when (e) {
                'n' -> sb.append('\n'); 't' -> sb.append('\t'); 'r' -> sb.append('\r')
                'b' -> sb.append('\b'); 'f' -> sb.append('\u000C')
                'u' -> {
                    if (i + 4 > stop) fail("truncated unicode escape")
                    val code = String(b, i, 4, Charsets.US_ASCII).toIntOrNull(16) ?: fail("bad unicode escape")
                    sb.append(code.toChar())
                    i += 4
                }
                else -> sb.append(e)
            }
        }
        flush()
        return sb.toString()
    }

    /** Start and end (exclusive) of the next string's raw bytes, without decoding it. Used for base64. */
    fun nextRawString(out: IntArray) {
        if (peek() != '"') fail("expected a string")
        p++
        out[0] = p
        while (p < end && b[p] != '"'.code.toByte()) p++
        if (p >= end) fail("unterminated string")
        out[1] = p
        p++
    }

    fun skipValue() {
        when (peek()) {
            '{' -> { beginObject(); while (hasNext()) { nextName(); skipValue() }; endObject() }
            '[' -> { beginArray(); while (hasNext()) skipValue(); endArray() }
            '"' -> {
                p++
                while (p < end && b[p] != '"'.code.toByte()) {
                    if (b[p] == '\\'.code.toByte()) { p++; if (p >= end) fail("unterminated string") }
                    p++
                }
                if (p >= end) fail("unterminated string")
                p++
            }
            't' -> literal("true")
            'f' -> literal("false")
            'n' -> literal("null")
            else -> nextLong()
        }
    }

    /** Raw JSON text of the next value (for keeping a command log verbatim). */
    fun nextRaw(): String {
        peek()
        val start = p
        skipValue()
        return String(b, start, p - start, Charsets.UTF_8)
    }

    /** Reads `[a, b, c, ...]` of ints into a new array. */
    fun nextIntArray(): IntArray {
        if (nextNull()) return IntArray(0)
        beginArray()
        var out = IntArray(8)
        var n = 0
        while (hasNext()) {
            if (n == out.size) out = out.copyOf(n * 2)
            out[n++] = nextInt()
        }
        endArray()
        return if (n == out.size) out else out.copyOf(n)
    }

    /** Reads `[[x, y], [x, y], ...]` into one flat int array x0, y0, x1, y1, ... */
    fun nextPairs(): IntArray {
        if (nextNull()) return IntArray(0)
        beginArray()
        var out = IntArray(16)
        var n = 0
        while (hasNext()) {
            beginArray()
            while (hasNext()) {
                if (n == out.size) out = out.copyOf(n * 2)
                out[n++] = nextInt()
            }
            endArray()
        }
        endArray()
        return if (n == out.size) out else out.copyOf(n)
    }

    fun nextStringList(): List<String> {
        if (nextNull()) return emptyList()
        beginArray()
        val out = ArrayList<String>()
        while (hasNext()) out.add(nextString())
        endArray()
        return out
    }
}

/** JSON writing helpers. Text is passed to the core as UTF-8 bytes, so non-ASCII stays as is. */
object JsonText {
    fun quote(s: String): String {
        val sb = StringBuilder(s.length + 2)
        sb.append('"')
        for (ch in s) {
            when {
                ch == '"' -> sb.append("\\\"")
                ch == '\\' -> sb.append("\\\\")
                ch == '\n' -> sb.append("\\n")
                ch == '\r' -> sb.append("\\r")
                ch == '\t' -> sb.append("\\t")
                ch < ' ' -> sb.append(String.format("\\u%04x", ch.code))
                else -> sb.append(ch)
            }
        }
        return sb.append('"').toString()
    }

    /** Cuts [s] to at most [n] code points, never through a surrogate pair. */
    fun takeCodePoints(s: String, n: Int): String {
        if (s.codePointCount(0, s.length) <= n) return s
        return s.substring(0, s.offsetByCodePoints(0, n))
    }
}

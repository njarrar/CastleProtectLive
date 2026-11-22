package games.castleprotect

import games.castleprotect.core.JsonReader
import games.castleprotect.core.JsonText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JsonReaderTest {
    private fun r(s: String) = JsonReader(s.toByteArray(Charsets.UTF_8))

    @Test fun readsObjectsArraysAndSkips() {
        val j = r("""{"a": 1, "b": [1, 2, {"x": null}], "c": "hi", "d": -42, "e": true, "f": 1.5e2, "g": {"deep": [[]]}}""")
        j.beginObject()
        assertEquals("a", j.nextName()); assertEquals(1, j.nextInt())
        assertEquals("b", j.nextName()); j.skipValue()
        assertEquals("c", j.nextName()); assertEquals("hi", j.nextString())
        assertEquals("d", j.nextName()); assertEquals(-42, j.nextInt())
        assertEquals("e", j.nextName()); assertTrue(j.nextBoolean())
        assertEquals("f", j.nextName()); assertEquals(150, j.nextInt())
        assertEquals("g", j.nextName()); assertEquals("""{"deep": [[]]}""", j.nextRaw())
        assertFalse(j.hasNext())
        j.endObject()
    }

    @Test fun decodesEscapesAndRealUtf8() {
        val name = "Mabel🙂 \"Q\" \\ é"
        val text = """{"n":${JsonText.quote(name)},"u":"é🙂"}"""
        val j = r(text)
        j.beginObject()
        assertEquals("n", j.nextName()); assertEquals(name, j.nextString())
        assertEquals("u", j.nextName()); assertEquals("é🙂", j.nextString())
    }

    @Test fun pairsAndNulls() {
        val j = r("""[[1, 2], [3, -4]]""")
        assertEquals(listOf(1, 2, 3, -4), j.nextPairs().toList())
        val k = r("null")
        assertTrue(k.nextNull())
    }

    @Test(expected = JsonReader.Malformed::class) fun truncatedInputThrows() {
        val j = r("""{"a": "abc""")
        j.beginObject(); j.nextName(); j.nextString()
    }

    @Test fun takeCodePointsNeverSplitsAPair() {
        val s = "abcdefghijk🙂🙂"
        val cut = JsonText.takeCodePoints(s, 12)
        assertEquals("abcdefghijk🙂", cut)
        assertEquals(12, cut.codePointCount(0, cut.length))
    }
}

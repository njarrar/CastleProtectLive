package games.castleprotect

import games.castleprotect.game.SaveData
import games.castleprotect.game.SaveStore
import games.castleprotect.game.SavedBattle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class SaveStoreTest {
    @get:Rule val tmp = TemporaryFolder()

    private val battle = SavedBattle("""{"level":"1-1"}""", 42, "campaign", "1-1", "one_seat", """[{"cmd":"aim","angle":450,"power":62},{"cmd":"fire"}]""", "test")

    @Test fun writeThenReadBack() {
        val dir = tmp.newFolder()
        val s = SaveStore(dir, "castle.sav")
        assertTrue(s.load() is SaveStore.Loaded.Missing)
        val data = SaveData(mapOf("1-1" to 5), battle, battle)
        assertTrue(s.write(data))
        val back = SaveStore(dir, "castle.sav").load()
        assertTrue(back is SaveStore.Loaded.Ok)
        val d = (back as SaveStore.Loaded.Ok).data
        assertEquals(5, d.pennants["1-1"])
        assertEquals(42L, d.battle!!.seed)
        assertEquals(org.json.JSONArray(battle.log).toString(), org.json.JSONArray(d.battle!!.log).toString())
        assertFalse(File(dir, "castle.sav.tmp").exists())
    }

    @Test fun nothingIsWrittenBeforeALoad() {
        val dir = tmp.newFolder()
        val s = SaveStore(dir, "castle.sav")
        assertFalse(s.write(SaveData()))
        assertFalse(File(dir, "castle.sav").exists())
    }

    @Test fun keepsTheLastGoodSaveAsBackup() {
        val dir = tmp.newFolder()
        val s = SaveStore(dir, "castle.sav"); s.load()
        s.write(SaveData(mapOf("1-1" to 1)))
        s.write(SaveData(mapOf("1-1" to 3)))
        assertEquals(1, SaveData.parse(File(dir, "castle.sav.prev").readText()).pennants["1-1"])
        // The main file is damaged: the backup loads and the damaged file is kept aside, not overwritten.
        File(dir, "castle.sav").writeText("{\"v\":1,\"pennants\":{\"1-1\":")
        val r = SaveStore(dir, "castle.sav").load()
        assertTrue(r is SaveStore.Loaded.Ok && r.fromBackup)
        assertEquals(1, (r as SaveStore.Loaded.Ok).data.pennants["1-1"])
        assertTrue(dir.listFiles()!!.any { it.name.startsWith("castle.sav.bad-") })
    }

    @Test fun unreadableSaveIsMovedAsideNeverOverwritten() {
        val dir = tmp.newFolder()
        val bad = "not a save"
        File(dir, "castle.sav").writeText(bad)
        val s = SaveStore(dir, "castle.sav")
        val r = s.load()
        assertTrue(r is SaveStore.Loaded.Unreadable)
        val aside = dir.listFiles()!!.first { it.name.startsWith("castle.sav.bad-") }
        assertEquals(bad, aside.readText())
        assertTrue(s.write(SaveData()))
        assertEquals(bad, aside.readText())
    }

    @Test fun aNewerSaveIsRefused() {
        val dir = tmp.newFolder()
        File(dir, "castle.sav").writeText("""{"v":99}""")
        assertTrue(SaveStore(dir, "castle.sav").load() is SaveStore.Loaded.Unreadable)
    }

    @Test fun debugStandInUsesItsOwnFile() {
        val dir = tmp.newFolder()
        val real = SaveStore(dir, "castle.sav"); real.load(); real.write(SaveData(mapOf("1-1" to 7)))
        val stand = SaveStore(dir, "castle-standin.sav")
        assertTrue(stand.load() is SaveStore.Loaded.Missing)
        stand.write(SaveData())
        assertEquals(7, SaveData.parse(File(dir, "castle.sav").readText()).pennants["1-1"])
        assertNull(SaveData.parse(File(dir, "castle-standin.sav").readText()).battle)
    }
}

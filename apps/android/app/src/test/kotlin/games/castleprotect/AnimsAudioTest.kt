package games.castleprotect

import games.castleprotect.battle.AnimClip
import games.castleprotect.battle.Anims
import games.castleprotect.battle.Camera
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.GameEvent
import games.castleprotect.game.AudioManifest
import games.castleprotect.game.BarkLines
import games.castleprotect.game.Cues
import games.castleprotect.game.Juice
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** assets/animations.json and assets/audio/audio.json as the app reads and plays them. */
class AnimsAudioTest {
    private val anims = Anims.parse(Fixtures.text("assets/animations.json"))
    private val audio = AudioManifest.parse(Fixtures.text("assets/audio/audio.json"))

    @Test fun everyAnimationLoadsWithFramesThatExist() {
        assertEquals(212, anims.defs.size)
        for (d in anims.defs.values) {
            assertEquals(d.frames.size, d.ms.size)
            for (fr in d.frames) assertTrue("missing sprite $fr", File(Fixtures.root, "assets/sprites/$fr@2x.png").isFile)
            d.next?.let { assertNotNull("next ${d.name} -> $it", anims[it]) }
        }
        assertEquals(6, anims.bobDy.size)
        assertEquals(300, anims.collapse.creakMs)
        assertTrue(anims.collapse.chunks["cobble"]!! >= 3)
    }

    @Test fun aClipPlaysInFileOrderFiresEventsAndGoesToNext() {
        val fire = anims["hob_marge_blue_fire"]!!
        val clip = AnimClip(anims, fire)
        val seen = ArrayList<String>()
        clip.advance(0f) { seen.add(it) }
        assertEquals("hob_marge_blue_fire_2", clip.sprite)   // play order, not the number in the name
        clip.advance(130f) { seen.add(it) }
        assertEquals("hob_marge_blue_fire_3", clip.sprite)
        assertEquals(listOf("release"), seen)
        clip.advance(1000f)
        assertTrue(clip.def.name.endsWith("_idle"))           // next
    }

    @Test fun loopFromAndHoldAndBackwards() {
        val bonk = AnimClip(anims, anims["hob_marge_blue_bonked"]!!)
        val ev = ArrayList<String>()
        bonk.advance(0f) { ev.add(it) }
        bonk.advance(5000f) { ev.add(it) }
        assertFalse(bonk.done)
        assertTrue(bonk.frame >= 2) // loops from loop_from
        assertTrue(ev.contains("inflate"))
        val pop = AnimClip(anims, anims["kettle_pop"]!!)
        val beats = ArrayList<String>()
        pop.advance(0f) { beats.add(it) }
        pop.advance(2000f) { beats.add(it) }
        assertEquals(listOf("crack", "pop", "sit"), beats)
        assertTrue(pop.done)
        assertEquals("kettle_popped", pop.sprite)
        val up = AnimClip(anims, anims["pot_lid_raise"]!!, backwards = true)
        up.advance(0f)
        assertEquals("pot_lid_raise_2", up.sprite)
    }

    @Test fun aimPicksAPoseByPower() {
        val aim = AnimClip(anims, anims["hob_jax_orange_aim"]!!)
        aim.pick(2)
        aim.advance(500f)
        assertEquals("hob_jax_orange_aim_2", aim.sprite)
    }

    @Test fun everySoundFileIsThere() {
        assertEquals(140, audio.sounds.size)
        for (s in audio.sounds.values) {
            assertTrue("missing ${s.file}", File(Fixtures.root, "assets/audio/${s.file}").isFile)
            assertTrue("missing m4a for ${s.id}", File(Fixtures.root, "assets/audio/${s.file.removeSuffix(".ogg")}.m4a").isFile)
        }
        assertEquals(3, audio.sounds.values.count { it.layer != null })
    }

    @Test fun everyCueTheAppPlaysIsInTheManifest() {
        val events = listOf("explode", "hit", "break", "carve", "mound", "split", "castle_drop", "thump", "threaded", "lid", "lid_block",
            "mend", "rebuild", "front", "squall_warning", "draft_start", "draft_pick", "miss", "relight", "shears_snip", "boss_phase")
        val targets = listOf("block", "kettle", "hob")
        for (t in events) for (target in targets) for (r in listOf(0, 10, 18, 28, 42, 64)) {
            val e = GameEvent(t, 0, 0, 0, r, 1, 0, 30, 0, -1, 0, target, "", "", false, kind = if (r == 0) "mend_bucket" else "")
            for (id in Cues.forEvent(e, audio) { _, _, _ -> "cobble" }) assertNotNull("$t -> $id", audio[id])
        }
        for ((name, d) in anims.defs) for (evs in d.events) for (ev in evs) Cues.forAnim(name, ev, audio, "clodpot")?.let { assertNotNull("$name:$ev -> $it", audio[it]) }
        for (ev in listOf("start")) for (n in listOf("hob_marge_blue_bonked", "fx_crack_wicker", "fx_chunk_cobble", "fx_rubble_timber", "fx_dustcloud", "loophole_flap_blue_close"))
            assertNotNull(audio[Cues.forAnim(n, ev, audio)!!])
        assertNotNull(audio[Cues.forAnim("collapse_land", "land", audio)!!])
        // Every shot launches with a sound from the manifest (Barn Raising has none).
        val shots = JSONArray(Fixtures.text("content/shots.json"))
        for (i in 0 until shots.length()) {
            val id = shots.getJSONObject(i).getString("id")
            audio.shotLaunch[id]?.let { assertNotNull("launch for $id", audio[it]) }
        }
        for (id in listOf("mus_r1_base", "mus_r1_stir", "mus_r1_peril", "mus_map", "sting_win", "sting_lose", "mus_title_jingle", "wx_wind_loop",
            "wx_squall_loop", "fly_whistle_loop", "ket_whistle_loop", "aim_band_stretch", "aim_drag_start", "aim_set", "aim_tick", "aim_limit",
            "aim_recall", "turn_yours", "turn_hob_pick", "ui_fire_press", "ui_denied", "ui_tap", "ui_slider_tick", "ui_confirm", "ui_back",
            "meta_pennant_stamp", "ui_handoff_flip")) assertNotNull(id, audio[id])
    }

    @Test fun barksHaveSubtitlesForEveryHob() {
        val b = BarkLines.parse(Fixtures.text("assets/audio/barks.json"))
        for (h in listOf("marge", "quill", "jax", "grub", "bobbin", "hetty", "old_thumper", "nan")) for (e in listOf("picked", "fire", "hit_lands", "takes_hit", "bonked", "win")) {
            val id = "bark_${Cues.barkKey(h)}_$e"
            assertNotNull(id, audio[id])
            assertTrue(id, b.lines[id].orEmpty().isNotEmpty())
        }
        assertEquals(1f, b.chance["bonked"]!!, 0f)
    }

    @Test fun musicLayersFollowTheRules() {
        assertEquals(false to false, Cues.layers(listOf(100, 100), listOf(3, 3), listOf(3, 3), -1, 0))
        assertEquals(true to false, Cues.layers(listOf(50, 100), listOf(3, 3), listOf(3, 3), -1, 0))
        assertEquals(true to false, Cues.layers(listOf(100, 100), listOf(3, 3), listOf(3, 3), 3, 0))
        assertEquals(true to true, Cues.layers(listOf(25, 100), listOf(3, 3), listOf(3, 3), -1, 0))
        assertEquals(true to true, Cues.layers(listOf(100, 100), listOf(1, 3), listOf(3, 3), -1, 0))
        assertEquals(true to true, Cues.layers(listOf(100, 100), listOf(3, 3), listOf(3, 3), -1, 1))
    }

    @Test fun hitStopShakeAndSlowMotionRules() {
        var reduce = false
        var shake = 1f
        val j = Juice({ reduce }, { shake })
        j.hitStop(80, 1000, fast = false)
        assertEquals(0f, j.scale(1050), 0f)
        assertEquals(1f, j.scale(1081), 0f)
        j.hitStop(80, 1100, fast = false)            // within 250 ms: skipped
        assertEquals(1f, j.scale(1110), 0f)
        j.hitStop(80, 2000, fast = true)             // halved at 2x
        assertEquals(1f, j.scale(2041), 0f)
        reduce = true
        j.hitStop(80, 3000, fast = false)            // capped at 50 with Reduce motion
        assertEquals(1f, j.scale(3051), 0f)
        assertFalse(j.slowMo(0.25f, 1200, 4000))     // Reduce motion: a hold, no slow motion
        reduce = false
        j.newTurn()
        assertTrue(j.slowMo(0.5f, 400, 5000))
        assertEquals(0.5f, j.scale(5100), 0f)
        assertFalse(j.slowMo(0.5f, 400, 5600))       // one per shot
        j.newShot()
        assertTrue(j.slowMo(0.25f, 1200, 6000, endsBattle = true))
        val out = FloatArray(3)
        j.addTrauma(1f, 600)
        j.shake(16f, aiming = false, out)
        assertTrue(Math.abs(out[0]) <= 1f && Math.abs(out[1]) <= 1f && Math.abs(out[2]) <= 1f)
        j.shake(16f, aiming = true, out)             // never while aiming
        assertEquals(0f, out[0], 0f); assertEquals(0f, j.trauma, 0f)
        shake = 0f
        j.addTrauma(0.5f, 300)                       // shake off: a rim flash instead
        assertEquals(0f, j.trauma, 0f)
        assertTrue(j.flash > 0f)
        assertEquals("medium", Juice.band(28)); assertEquals("huge", Juice.band(64)); assertEquals("tiny", Juice.band(10))
    }

    @Test fun blocksAreAtLeastEightDpInTheWideLayout() {
        val dp = 2.75f
        val out = FloatArray(3)
        // Two forts 2000 cells apart on an 800 dp wide phone: the fit would shrink blocks under 8 dp, so it stops at the floor.
        Camera.fit(300f, 200f, 2300f, 400f, 800 * dp, 300 * dp, 24f, Camera.minBlockScale(dp), 1.4f * dp, out)
        assertEquals(Camera.minBlockScale(dp), out[2], 1e-5f)
        assertEquals(8f * dp, 16f * out[2], 1e-4f)
        // A fort and its arc fit with room to spare: bigger blocks, up to the ceiling.
        Camera.fit(300f, 250f, 500f, 400f, 800 * dp, 300 * dp, 24f, Camera.minBlockScale(dp), 1.4f * dp, out)
        assertTrue(16f * out[2] >= 8f * dp)
        assertEquals(400f, out[0], 0.01f)
        // The dead zone: the camera moves only when the shell leaves the middle 30%.
        assertEquals(500f, Camera.follow(500f, 520f, 100f), 0f)
        assertEquals(540f, Camera.follow(500f, 570f, 100f), 0.001f)
    }

    @Test fun shotTrailsComeFromContent() {
        val shots = JSONArray(Fixtures.text("content/shots.json"))
        val byId = (0 until shots.length()).associate { shots.getJSONObject(it).getString("id") to ContentInfo.trailOf(shots.getJSONObject(it)) }
        assertEquals("blast", byId["clodpot"])
        assertEquals("dig", byId["nibbler"])
        assertEquals("pierce", byId["sunspear"])
        assertEquals("pierce", byId["hatpin"])
        for (t in byId.values.toSet()) assertNotNull("trail $t", anims["fx_trail_$t"])
        assertTrue(JSONObject(Fixtures.text("assets/animations.json")).has("data"))
    }
}

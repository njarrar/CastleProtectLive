package games.castleprotect

import games.castleprotect.battle.Aim
import games.castleprotect.battle.Anims
import games.castleprotect.battle.FieldFx
import games.castleprotect.battle.SpriteSource
import games.castleprotect.battle.Sprites
import games.castleprotect.core.Awaiting
import games.castleprotect.core.Block
import games.castleprotect.core.Castle
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.Frame
import games.castleprotect.core.GameEvent
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.Phase
import games.castleprotect.core.SnapshotParser
import games.castleprotect.game.AudioManifest
import games.castleprotect.game.Cues
import games.castleprotect.game.FortCheck
import games.castleprotect.game.FortGrid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Unit tests for Round 2 Android audit fixes and Award-Winning Aim redesign
 * (C-05, H-A01, H-A03, H-A07, H-A09, M-A01, M-A04, hit-stop).
 */
class Round2AuditFixesTest {
    private val anims = Anims.parse(Fixtures.text("assets/animations.json"))
    private val audio = AudioManifest.parse(Fixtures.text("assets/audio/audio.json"))
    private val contentDir = File(Fixtures.root, "content")
    private val ci = ContentInfo.load(
        read = { rel -> File(contentDir, rel).takeIf { it.isFile }?.readText() },
        list = { File(contentDir, "levels").list()?.toList() ?: emptyList() },
    )

    private class NullSprites : SpriteSource {
        override val generation = 0
        override fun get(name: String): Sprites.Sprite? = null
    }

    // ---- C-05: Unsigned Daily seed modulo -----------------------------------

    @Test fun dailySeedRivalForUsesUnsignedModuloForHighBitSeeds() {
        val d1 = ci.level("d1")!!
        assertEquals(6, d1.roster.size)
        // Unsigned 0xFFFF_FFFF_FFFF_FFFF % 6 == 3 (signed Math.floorMod(-1L, 6L) wrongly returned 5!).
        val negOne = -1L
        val expectedNegOne = java.lang.Long.remainderUnsigned(negOne, d1.roster.size.toLong()).toInt()
        assertEquals(3, expectedNegOne)
        assertEquals(d1.roster[expectedNegOne], d1.rivalFor(negOne))

        // Unsigned Long.MIN_VALUE (2^63) % 6 == 2 (signed Math.floorMod returned 4!).
        val minLong = Long.MIN_VALUE
        val expectedMin = java.lang.Long.remainderUnsigned(minLong, d1.roster.size.toLong()).toInt()
        assertEquals(2, expectedMin)
        assertEquals(d1.roster[expectedMin], d1.rivalFor(minLong))

        for (seed in listOf(0L, 1L, 42L, -1L, -2L, -1234567890123456789L, Long.MIN_VALUE, Long.MAX_VALUE)) {
            val idx = java.lang.Long.remainderUnsigned(seed, d1.roster.size.toLong()).toInt()
            assertEquals("seed=$seed", d1.roster[idx], d1.rivalFor(seed))
        }
    }

    // ---- H-A01: Flattener animations and audio cues -------------------------

    @Test fun flattenerAnimationsPlayAndEmitAudioCues() {
        val cues = ArrayList<Pair<String, String>>()
        val fx = FieldFx(
            NullSprites(), 1f,
            cue = { anim, ev, _, shot -> Cues.forAnim(anim, ev, audio, shot)?.let { cues.add(anim to it) } },
            beat = { _, _, _, _ -> },
            reduceMotion = { false },
            trailOf = { "blast" },
        )
        fx.anims = anims
        val flattener = Hob(
            id = 5, side = 1, def = "hedge_snipper", name = "Hedger", cls = "lobber",
            hp = 80, max = 80, state = "seated", nook = 0, x = 1100, y = 400,
            rest = 0, knack = null, knackUses = 0, plain = "clodpot",
            buried = false, cover = false, dummy = false, grudge = false, clatter = false,
            canFire = true, angle = 1350, power = 60,
        )
        val base = Frame(
            1, Phase.PLAN, 1, Awaiting.AI, 1, "1-6", "campaign", 1600, 720, null,
            emptyList(), listOf(flattener), emptyList(), emptyList(), IntArray(0), emptyList(),
            Hud(selectedHob = 5), null, null, emptyList(), "",
        )
        fx.update(base, 16f)
        val clip = fx.hobClip(flattener)
        assertNotNull("Flattener must get an AnimClip", clip)
        assertTrue("Expected flattener_snipper_* clip, got ${clip!!.def.name}", clip.def.name.startsWith("flattener_snipper_"))

        val fireEvent = GameEvent("fire", 2, 1100, 400, 0, 1, 5, 0, 0, -1, 1, "", "", "", false, shot = "clodpot")
        val fireFrame = Frame(
            2, Phase.RESOLVE, 1, Awaiting.NONE, 2, "1-6", "campaign", 1600, 720, null,
            emptyList(), listOf(flattener), emptyList(), emptyList(), IntArray(0), emptyList(),
            Hud(selectedHob = 5), null, null, listOf(fireEvent), "",
        )
        fx.onFrame(fireFrame)
        fx.update(fireFrame, 16f)
        assertTrue("Flattener fire release should emit launch sound", cues.any { it.first == "flattener_snipper_fire" && audio[it.second] != null })

        // Verify direct Cues.forAnim coverage across Flattener combat poses.
        assertEquals("launch_lob", Cues.forAnim("flattener_snipper_fire", "release", audio, null))
        assertEquals("hob_hit_boing", Cues.forAnim("flattener_rake_hit", "flash", audio))
        assertEquals("hob_bonk", Cues.forAnim("flattener_tamper_bonked", "start", audio))
        assertEquals("hob_balloon_inflate", Cues.forAnim("flattener_tamper_bonked", "inflate", audio))
        assertEquals("hob_balloon_float", Cues.forAnim("flattener_tamper_bonked", "lift", audio))
        assertEquals("hob_tumble_roll", Cues.forAnim("flattener_sniper_tumble", "fall", audio))
        assertEquals("hob_land_thud", Cues.forAnim("flattener_sniper_land", "thud", audio))
        assertEquals("hob_shove_dig", Cues.forAnim("flattener_snipper_dig", "clear", audio))
    }

    @Test fun fieldFxEmits45msHitStopOnCobbleAndHobImpacts() {
        val stops = ArrayList<Int>()
        val fx = FieldFx(
            NullSprites(), 1f,
            cue = { _, _, _, _ -> },
            beat = { kind, n, _, _ -> if (kind == "hit_stop") stops.add(n) },
            reduceMotion = { false },
            trailOf = { "blast" },
        )
        fx.anims = anims
        val cobble = Block(0, 0, 200, 400, "cobble", 60, 80, false, false, false)
        val castle = Castle(1, 200, 416, 4, 4, 16, listOf(cobble), emptyList(), null, 100, 20, false, IntArray(0), IntArray(0))
        val hitEvent = GameEvent("hit", 10, 208, 408, 0, 1, -1, 30, 0, -1, 1, "block", "", "", false, c = 0)
        val f = Frame(
            10, Phase.RESOLVE, 0, Awaiting.NONE, 1, "1-1", "campaign", 1600, 720, null,
            listOf(castle), emptyList(), emptyList(), emptyList(), IntArray(0), emptyList(),
            Hud(), null, null, listOf(hitEvent), "",
        )
        fx.onFrame(f)
        assertEquals(listOf(FieldFx.HIT_STOP_MS), stops)
        assertEquals(45, FieldFx.HIT_STOP_MS)
    }

    // ---- H-A03 + M-A01: Safe edge-assist projection, 8 dp margin & 20 dp cancel ----

    @Test fun aimEdgeAssistProjectsPowerAlongHeldAngleAndUsesEightDpMargin() {
        val dp = 3f
        val w = 360f * dp; val h = 800f * dp
        // 8 dp margin triggers onEdge; 9 dp is off-edge.
        assertTrue(Aim.onEdge(8f * dp, 400f * dp, w, h, dp))
        assertFalse(Aim.onEdge(9f * dp, 400f * dp, w, h, dp))
        assertEquals(20f, Aim.CANCEL_RADIUS_DP, 0f)
        assertEquals(220L, Aim.EDGE_DWELL_MS)

        // With heldAngle = 0 (horizontal right, pull-back left), sliding straight down along the left edge
        // must NOT inflate power because the vertical displacement is perpendicular to heldAngle.
        val ax = 60f * dp; val ay = 400f * dp
        val atZero = Aim.pull(ax, ay, 0f, ay, w, h, pointMode = false, dp = dp, heldAngle = 0, bonusPx = 0f)
        val slidDown = Aim.pull(ax, ay, 0f, ay + 250f * dp, w, h, pointMode = false, dp = dp, heldAngle = 0, bonusPx = 0f)
        assertEquals(1, slidDown[2])
        assertEquals(0, slidDown[0])
        assertEquals("Sideways edge slide must not inflate power", atZero[1], slidDown[1])

        // Virtual edge bonus climbs power cleanly without moving the Cancel Halo off-screen.
        val boosted = Aim.pull(ax, ay, 0f, ay, w, h, pointMode = false, dp = dp, heldAngle = 0, bonusPx = 60f * dp)
        assertTrue("Virtual edge bonus must increase power (${boosted[1]} > ${atZero[1]})", boosted[1] > atZero[1])
    }

    // ---- H-A07: Workshop Nook compaction & structured core problem ID --------

    @Test fun workshopErasingNookOneCompactsNooksToContiguousOneToN() {
        val g = FortGrid.fromRows(Fixtures.homeRows)
        assertEquals(setOf(1, 2, 3), g.nooks())
        // Find a cell belonging to Nook '1' and erase it.
        var c1 = -1; var r1 = -1
        outer@ for (r in 0 until g.rows) for (c in 0 until g.cols) if (g[c, r] == '1') { c1 = c; r1 = r; break@outer }
        assertTrue(c1 >= 0 && r1 >= 0)
        assertTrue(g.place('.', c1, r1))
        assertEquals(2, g.seats())
        assertEquals("Remaining Nooks must compact to 1..2 with zero gaps", setOf(1, 2), g.nooks())
        val joined = g.toRows().joinToString("")
        assertTrue(joined.contains('1'))
        assertTrue(joined.contains('2'))
        assertFalse(joined.contains('3'))
    }

    @Test fun fortCheckReadsStructuredCoreProblemIdFirst() {
        val reply = """{"ok":false,"reason":"invalid_blueprint","problem":"no_kettle_room","detail":"Kettle Room must be 2 x 2","used":20,"budget":72,"cost":180,"cells":[]}"""
        val ck = FortCheck.parse(reply)
        assertFalse(ck.ok)
        assertEquals("no_kettle_room", ck.kind)
        assertEquals(games.castleprotect.core.Text.t("workshop.problems.no_kettle_room"), ck.why)
    }

    // ---- H-A09: Ghost miss_blocks optional field parsing --------------------

    @Test fun snapshotParserReadsOptionalGhostMissBlocksGracefully() {
        val plan = Fixtures.fixture("snapshot_plan.json")
        val p = SnapshotParser()
        p.parse(plan.toByteArray())
        val snap = """{"tick":9,"phase":"plan","side":0,"awaiting":"human","full":true,"castles":[],"hobs":[],"shells":[],"ghosts":[
            {"index":0,"side":0,"hob":0,"shot":"clodpot","angle":450,"power":60,"round":1,"pin":[900,400],"self_hit":false,"recalled":false,"points":[100,400,900,400],"miss_blocks":-3},
            {"index":1,"side":0,"hob":0,"shot":"clodpot","angle":450,"power":70,"round":2,"pin":[1200,400],"self_hit":false,"recalled":false,"points":[100,400,1200,400],"miss_blocks":null},
            {"index":2,"side":0,"hob":0,"shot":"clodpot","angle":450,"power":80,"round":3,"pin":[1300,400],"self_hit":false,"recalled":false,"points":[100,400,1300,400]}
        ]}"""
        val f = p.parse(snap.toByteArray())
        assertEquals(3, f.ghosts.size)
        assertTrue(f.ghosts[0].hasMissBlocks)
        assertEquals(-3, f.ghosts[0].missBlocks)
        assertFalse(f.ghosts[1].hasMissBlocks)
        assertFalse(f.ghosts[2].hasMissBlocks)
    }
}

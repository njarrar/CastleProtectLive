package games.castleprotect

import games.castleprotect.battle.AtlasIndex
import games.castleprotect.battle.BattleRenderer
import games.castleprotect.battle.FloatLayout
import games.castleprotect.battle.Sprites
import games.castleprotect.core.Boss
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.Ghost
import games.castleprotect.core.Hud
import games.castleprotect.core.TerrainStrata
import games.castleprotect.game.FortCheck
import games.castleprotect.game.FortGrid
import games.castleprotect.game.HudText
import games.castleprotect.game.WorkshopDiag
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.math.abs

/**
 * Unit tests for Part 2 UX & Visual Redesign pure-Kotlin helpers:
 * --v2 trimmed/deduplicated atlas loader, stratified earth, 2-pin visual cap,
 * damage number collision separation, Workshop diagnostic coordinate mapping,
 * Shell Inspect Card content metadata, and compact Round/Phase/Fatigue badges.
 */
class Part2RedesignTest {

    // ---- 1. --v2 trimmed & deduplicated atlas loader ------------------------

    @Test fun atlasIndexParsesV2AliasesOverlaysTrimAndPerFrameScale() {
        val indexJson = """
            {
              "scale": 2,
              "v2": true,
              "trimmed": true,
              "dedupHobs": true,
              "pages": ["castle@2x-0.json"],
              "aliases": {
                "hob_marge_blue_idle_0": "hob_marge_neutral_idle_0",
                "hob_marge_orange_idle_0": "hob_marge_neutral_idle_0"
              },
              "overlays": {
                "hob_marge_blue_idle_0": [
                  { "sprite": "hob_scarf_blue_round", "dx": 1.5, "dy": -14.0, "rot": 2.0, "scale": 0.95 }
                ]
              }
            }
        """.trimIndent()
        val pageJson = """
            {
              "image": "castle@2x-0.png",
              "size": 2048,
              "scale": 2,
              "trimmed": true,
              "frames": {
                "hob_marge_neutral_idle_0": {
                  "x": 4, "y": 8, "w": 40, "h": 54,
                  "scale": 1,
                  "trim": [16, 18, 40, 54],
                  "sourceSize": [72, 80]
                },
                "hob_scarf_blue_round": {
                  "x": 60, "y": 8, "w": 24, "h": 20,
                  "trim": [4, 6, 24, 20],
                  "sourceSize": [32, 32]
                }
              }
            }
        """.trimIndent()

        val idx = AtlasIndex.parse(indexJson) { if (it == "castle@2x-0.json") pageJson else null }
        assertTrue(idx.v2)
        assertTrue(idx.trimmed)
        assertEquals("hob_marge_neutral_idle_0", idx.resolveName("hob_marge_blue_idle_0"))
        val fr = idx.frameFor("hob_marge_blue_idle_0")!!
        assertEquals("castle@2x-0.png", fr.page)
        assertEquals(1f, fr.frameScale, 1e-6f)
        assertEquals(listOf(16, 18, 40, 54), fr.trim!!.toList())
        assertEquals(72, fr.sourceW); assertEquals(80, fr.sourceH)

        val ovs = idx.overlaysFor("hob_marge_blue_idle_0")
        assertEquals(1, ovs.size)
        assertEquals("hob_scarf_blue_round", ovs[0].sprite)
        assertEquals(1.5f, ovs[0].dx, 1e-5f); assertEquals(-14.0f, ovs[0].dy, 1e-5f)

        // Verify trimmed anchor bounds with zero drift:
        // Untrimmed 72x80 @1x anchored at (36, 72) drawn at anchor (100, 200) with scale u=2:
        // Trim [16, 18, 40, 54] at frameScale=1 -> left = 100 + (16 - 36)*2 = 60, top = 200 + (18 - 72)*2 = 92
        val bounds = FloatArray(4)
        AtlasIndex.trimmedBounds(36f, 72f, 72f, 80f, fr.trim, fr.frameScale, 100f, 200f, 2f, bounds)
        assertEquals(60f, bounds[0], 1e-4f)
        assertEquals(92f, bounds[1], 1e-4f)
        assertEquals(140f, bounds[2], 1e-4f)
        assertEquals(200f, bounds[3], 1e-4f)
    }

    // ---- 2. Painterly stratified earth --------------------------------------

    @Test fun terrainStrataProducesDeterministicMultiToneTexturesPerMaterial() {
        assertEquals(0, TerrainStrata.colorAt(0, 10, 20, 0))
        // Each solid earth layer (Loam 1, Clay 2, Rock 3, Bedrock 4, Mud 5) must exhibit rich variation, never flat single RGB.
        for (mat in 1..5) {
            val colors = HashSet<Int>()
            for (y in 0 until 40 step 2) {
                for (x in 0 until 80 step 2) {
                    val col = TerrainStrata.colorAt(mat, x, y, depth = y)
                    assertEquals("deterministic at ($x,$y)", col, TerrainStrata.colorAt(mat, x, y, depth = y))
                    assertNotEquals(0, col ushr 24)
                    colors.add(col)
                }
            }
            assertTrue("material $mat should have >= 3 painterly tones (got ${colors.size})", colors.size >= 3)
        }
    }

    // ---- 3. 2-pin visual cap per side ---------------------------------------

    @Test fun visiblePinIndicesCapsAtTwoMostRecentPinsPerSide() {
        fun ghost(i: Int, side: Int, hasPin: Boolean) =
            Ghost(i, side, 0, "clodpot", 450, 50, i + 1, hasPin, 100 + i * 10, 300, false, false, IntArray(0))
        val list = listOf(
            ghost(0, 0, true),
            ghost(1, 1, true),
            ghost(2, 0, true),
            ghost(3, 0, false), // no pin: skipped
            ghost(4, 1, true),
            ghost(5, 0, true),  // side 0 newest
            ghost(6, 1, true),  // side 1 newest
            ghost(7, 0, true),  // side 0 even newer
        )
        val vis = BattleRenderer.visiblePinIndices(list, maxPerSide = 2)
        // Side 0 latest two with pins: 7, 5; Side 1 latest two with pins: 6, 4.
        assertEquals(setOf(4, 5, 6, 7), vis)
    }

    // ---- 4. Floating combat number collision separation ---------------------

    @Test fun floatLayoutSeparatesSimultaneousRoundTenFatigueBursts() {
        val xs = FloatArray(6)
        val ys = FloatArray(6)
        val out = FloatArray(2)
        for (i in 0 until 6) {
            FloatLayout.place(500f, 300f, xs, ys, i, out, minDx = 30f, minDy = 20f)
            xs[i] = out[0]; ys[i] = out[1]
        }
        for (i in 0 until 6) {
            for (j in i + 1 until 6) {
                val overlap = abs(xs[i] - xs[j]) < 29f && abs(ys[i] - ys[j]) < 19f
                assertTrue("burst items $i and $j must not stack on top of each other", !overlap)
            }
        }
    }

    // ---- 5. Decision-grade Shell Inspect Card metadata ----------------------

    @Test fun contentInfoProvidesDecisionGradeShotDetailsAndClassHobMatch() {
        val contentDir = File(Fixtures.root, "content")
        val ci = ContentInfo.load(
            read = { rel -> File(contentDir, rel).takeIf { it.isFile }?.readText() },
            list = { File(contentDir, "levels").list()?.toList() ?: emptyList() },
        )
        val mole = ci.shotDetail("mole_mail")
        assertNotNull(mole)
        assertEquals("Mole Mail", mole!!.name)
        assertEquals("Medium", mole.weightLabel)
        assertEquals(1, mole.restCogs)
        assertEquals(400, mole.tunnelCells)
        // Class names come from content/classes.json; the "Good at" line from text.json. No app-side "Best vs" table.
        assertEquals("delver", mole.matchClass)
        assertEquals("Digger", ci.className(mole.matchClass))
        assertEquals("Good at: " + games.castleprotect.core.Text.t("shots.mole_mail.good_at"), mole.goodAt)
        assertEquals("Rest 1 turn", mole.restLabel)
        assertTrue(mole.card.contains("Tunnels"))

        val grub = ci.hobForClass("delver")
        assertNotNull(grub)
        assertEquals("grub", grub!!.first)

        // Split and prop shots resolve real child explosion damage
        val pepper = ci.shotDetail("pepper_rain")!!
        assertEquals(7, pepper.splitCount)
        assertTrue(pepper.damage > 0)
        val crock = ci.shotDetail("tick_tock_crock")!!
        assertEquals("Heavy", crock.weightLabel)
        assertEquals(2, crock.restCogs)
        assertEquals(85, crock.damage)
    }

    // ---- 6. Workshop diagnostic mapping & unified 2x2 room anchors ----------

    @Test fun workshopDiagMapsEmptyWallGapsFloatingBlocksAndUnifiedRooms() {
        val g = FortGrid.fromRows(Fixtures.homeRows)
        val anchors = WorkshopDiag.roomAnchors(g)
        assertEquals(4, anchors.size)
        assertEquals(setOf('K', '1', '2', '3'), anchors.map { it.glyph }.toSet())
        // Kettle Room bottom-left is (1, 0) in Fixtures.homeRows
        val kBox = anchors.first { it.glyph == 'K' }
        assertEquals(1, kBox.c); assertEquals(0, kBox.r)
        assertEquals("A", WorkshopDiag.colLabel(0)); assertEquals("H", WorkshopDiag.colLabel(7))

        // Knock out the wall beside Nook 1 at (0, 3) -> empty gap should map to (0, 3) "Needs wall"!
        g.place('.', 0, 3)
        // Core returns (c=0, r=4) because r=0 is Footing -> gr = r - 1 = 3.
        val wallCheck = FortCheck(false, "Nook 1 must be walled", cells = listOf(0 to 4))
        val mappedWall = WorkshopDiag.mapBadCells(g, wallCheck)
        assertEquals("Needs a wall", mappedWall[0 to 3])

        // Floating block at (6, 6) -> core returns (c=6, r=7) -> gr = 6, classified "Floating"
        g.place('c', 6, 6)
        val floatCheck = FortCheck(false, "Blocks floating without support", cells = listOf(6 to 7))
        val mappedFloat = WorkshopDiag.mapBadCells(g, floatCheck)
        assertEquals("Nothing under it", mappedFloat[6 to 6])
        assertEquals(1, WorkshopDiag.issueCount(floatCheck, mappedFloat.size))
    }

    // ---- 7. Compact TopStrip telemetry & Flattener key mapping --------------

    @Test fun compactRoundSpellsThePartAndTheCreaksHaveABadge() {
        val bossHud = Hud(round = 10, roundCap = 18, fatigue = true, fatigueRound = 10, boss = Boss(1, null, false, null, null, 0))
        // The boss part is spelled out, never "Ph1", and the Creaks have their own badge (text.json hud.*).
        assertEquals("R10/18 · Part 1 of 3", HudText.compactRound(bossHud, "campaign"))
        assertEquals("The Creaks", HudText.statusPill(bossHud, "campaign"))

        val calmHud = Hud(round = 3, roundCap = 15, fatigue = false, fatigueRound = 10, fatigueIn = 7)
        assertEquals("R3/15", HudText.compactRound(calmHud, "campaign"))
        assertNull(HudText.statusPill(calmHud, "campaign"))

        assertEquals("Test Yard", HudText.compactRound(calmHud, "test_yard"))
        assertNull(HudText.statusPill(bossHud, "test_yard"))

        assertEquals("snipper", Sprites.flattenerKey("hedge_snipper", "lobber"))
        assertEquals("rake", Sprites.flattenerKey("rake_hand", "scatterjack"))
        assertEquals("tamper", Sprites.flattenerKey("mower_minder", "boinker"))
        assertEquals("sniper", Sprites.flattenerKey("pebble_pitcher", "zinger"))
    }
}

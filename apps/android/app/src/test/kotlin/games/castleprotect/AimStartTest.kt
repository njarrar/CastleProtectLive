package games.castleprotect

import games.castleprotect.battle.Aim
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 00 section 2.3: an Aim Drag starts only on your own fort or by the picked Hob; anywhere else pans. */
class AimStartTest {
    private val dp = 2.75f
    // Fort of the side on turn in world cells: x 100..228, top 400, base 528 (y grows down).
    private val fx0 = 100f; private val fy0 = 400f; private val fx1 = 228f; private val fy1 = 528f
    private val farHob = Float.POSITIVE_INFINITY
    private val prev = 450 to 60
    private val full = 400f

    private fun starts(wx: Float, wy: Float, hobPx: Float = farHob) = Aim.startsOnOwnFort(wx, wy, fx0, fy0, fx1, fy1, hobPx, dp)

    @Test fun dragFromOpenSkyLeavesTheAimUnchanged() {
        val ok = starts(600f, 120f)
        assertFalse(ok)
        val after = Aim.afterDrag(ok, 500f, 300f, 300f, 500f, prev, pointMode = false, fullPx = full, dp = dp)
        assertEquals(prev, after)
    }

    @Test fun dragFromOwnFortChangesTheAim() {
        val ok = starts(160f, 480f)
        assertTrue(ok)
        val after = Aim.afterDrag(ok, 500f, 300f, 300f, 500f, prev, pointMode = false, fullPx = full, dp = dp)
        assertNotEquals(prev, after)
        assertEquals(Aim.fromDrag(200f, -200f, false, full), after)
    }

    @Test fun fortGrowsByTwoBlocksAndHobRadiusIs48dp() {
        assertTrue(starts(fx0 - 31f, fy0 - 31f))
        assertTrue(starts(fx1 + 32f, fy1 + 32f))
        assertFalse(starts(fx0 - 33f, 460f))
        assertFalse(starts(160f, fy0 - 33f))
        // Open sky, but by the picked Hob.
        assertTrue(starts(600f, 120f, hobPx = 48f * dp))
        assertFalse(starts(600f, 120f, hobPx = 48f * dp + 1f))
    }

    @Test fun shortLiftFromTheFortKeepsTheAim() {
        assertEquals(prev, Aim.afterDrag(true, 500f, 300f, 505f, 305f, prev, false, full, dp))
    }
}

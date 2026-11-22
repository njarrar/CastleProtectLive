package games.castleprotect

import games.castleprotect.battle.Aim
import games.castleprotect.battle.Camera
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraAimTest {
    private val dp = 2.75f

    @Test fun scaleIsNeverZeroNegativeOrNaN() {
        for (s in listOf(-5f, 0f, Float.NaN, -0.0001f)) assertEquals(Camera.minScale(dp), Camera.clampScale(s, dp), 0f)
        assertEquals(Camera.maxScale(dp), Camera.clampScale(1e9f, dp), 0f)
    }

    @Test fun wideScaleWithAShellBelowTheFortsStaysPositive() {
        // y grows down: a shell 150 cells below the forts gives a negative height above them.
        val s = Camera.wideScale(1000f, 400f, 1100f, -150f, dp)
        assertTrue(s > 0f)
        val high = Camera.wideScale(1000f, 400f, 1100f, 600f, dp)
        assertTrue(high > 0f && high <= Camera.wideScale(1000f, 400f, 1100f, null, dp))
    }

    @Test fun centreAndPanStayInsideTheWorld() {
        assertEquals(1800f, Camera.clampCenter(99999f, 1600, 200f), 0f)
        assertEquals(-200f, Camera.clampCenter(-99999f, 1600, 200f), 0f)
        assertEquals(1600f, Camera.clampPan(5000f, 1600), 0f)
        assertEquals(0f, Camera.clampPan(Float.NaN, 1600), 0f)
        assertEquals(2.1f, Camera.clampZoom(50f), 0f)
    }

    @Test fun visibleRangePastEitherEdgeIsEmptyOrClamped() {
        val n = 201; val step = 8f
        val past = Camera.visibleRange(5000f, 6000f, step, n); assertTrue(past[0] > past[1])
        val before = Camera.visibleRange(-900f, -100f, step, n); assertTrue(before[0] > before[1])
        val part = Camera.visibleRange(1500f, 9000f, step, n); assertEquals(n - 1, part[1]); assertTrue(part[0] in 0 until n)
        val flipped = Camera.visibleRange(800f, 0f, step, n); assertTrue(flipped[0] <= flipped[1])
    }

    @Test fun pullBackAndPointAim() {
        // Pull back down-left of the anchor: the shot goes up-right at 45 degrees.
        val (a, p) = Aim.fromDrag(100f, -100f, pointMode = false, fullPx = 400f)
        assertEquals(450, a); assertEquals(35, p)
        // Point mode reads the other way.
        val (b, _) = Aim.fromDrag(-100f, 100f, pointMode = true, fullPx = 400f)
        assertEquals(450, b)
        // Toward the Rival on the right side: up-left.
        assertEquals(1350, Aim.fromDrag(-100f, -100f, false, 400f).first)
        // Below the horizon snaps flat, power caps at 100.
        assertEquals(0, Aim.fromDrag(100f, 50f, false, 400f).first)
        assertEquals(1800, Aim.fromDrag(-100f, 50f, false, 400f).first)
        assertEquals(100, Aim.fromDrag(5000f, 0f, false, 400f).second)
    }
}

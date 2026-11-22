package games.castleprotect.game

import games.castleprotect.core.BestShot
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.Reply

/**
 * What the HUD shows for the core rules v3 fields (core/API.md "Changes for QA playtest 1").
 * Plain functions over the core's own values, so they can be unit tested. None of them
 * decides a rule: they choose words and where things sit.
 */
object HudText {
    /** The round label. Test Yard: no rounds. Fatigue: counted down from 3 rounds before (M2). */
    fun round(h: Hud, mode: String): String {
        val v = h.volley
        val base = when {
            mode == "test_yard" -> "Test Yard"
            v != null -> return "Shots left ${v.left.getOrElse(h.side) { 0 }}/${v.actions}"
            h.squallRound > 0 -> return "Sudden Squall ${h.squallRound}"
            else -> "Round ${h.round}/${h.roundCap}"
        }
        val extra = when {
            mode == "test_yard" -> ""
            h.squallWarning > 0 -> "  Squall in ${h.squallWarning}"
            h.fatigueIn == 1 -> "  Fatigue next round"
            h.fatigueIn in 2..3 -> "  Fatigue in ${h.fatigueIn}"
            h.fatigue -> "  Fatigue"
            else -> ""
        }
        return base + extra
    }

    /** The round label is a warning colour: the Squall or Fatigue is close or on. */
    fun warn(h: Hud): Boolean = h.squallRound > 0 || h.squallWarning > 0 || h.fatigueIn in 1..3 || h.fatigue

    /** The banner one round before Fatigue starts (hud.fatigue_in 1), or null. */
    fun fatigueBanner(h: Hud): String? = if (h.fatigueIn == 1) "Fatigue next round" else null

    /** Banner for the `fatigue` event: the round 10 collapse that follows plays as normal collapses. */
    const val FATIGUE_ON = "Fatigue! Battered blocks give way"

    /** A short badge for an unready shot chip, from `hud.shots[].why`. The chip's full words are its `text`. */
    fun chipBadge(why: String?): String = when (why) {
        "resting_plain_only", "resting" -> "REST"
        "no_knack_uses" -> "0 LEFT"
        "no_heavy_first_turn" -> "HEAVY"
        "buried" -> "DUG IN"
        "no_actions_left" -> "NONE"
        null, "not_planning" -> ""
        else -> "NO"
    }

    /** Words for a `shot_switch` event: the picked shot could not fire, so the core moved to the Plain Shot. */
    fun shotSwitch(hobName: String, why: String, plainName: String): String {
        val who = hobName.ifEmpty { "This Hob" }
        val reason = when (why) {
            "resting_plain_only", "resting" -> "needs a rest"
            "no_knack_uses" -> "has no Knack uses left"
            "not_in_hand", "no_shot" -> "has no such shell left"
            else -> "cannot fire that now"
        }
        return "$who $reason: ${plainName.ifEmpty { "Plain Shot" }} picked"
    }

    /** "Best shot" line: the Hob, the shot, the aim and the damage. */
    fun bestShot(b: BestShot): String =
        "${b.shotName.ifEmpty { b.shot }} by ${b.hobName.ifEmpty { "a Hob" }}, " +
            String.format(java.util.Locale.ROOT, "%.1f", b.angle / 10f) + "° / ${b.power}, ${b.dmg} dmg"
}

/** Fire lit or grey (QA playtest 1, M1). */
object FireLight {
    /**
     * Lit only when the core's `hud.fire.ready` says so (a core before v3: the picked chip's readiness).
     * Also needs a person on turn and a picked Hob.
     */
    fun ready(h: Hud, humanTurn: Boolean, hob: Hob?): Boolean {
        if (!humanTurn || hob == null) return false
        val f = h.fire
        if (f != null) return f.ready
        return hob.canFire && !hob.buried && (h.chip(h.selectedShot)?.ready ?: true)
    }

    /** The words to show by grey Fire, or null: `hud.fire.text`, else the picked chip's text. */
    fun why(h: Hud): String? = h.fire?.takeIf { !it.ready }?.text ?: h.chip(h.selectedShot)?.takeIf { !it.ready }?.text

    /**
     * What to do with a `fire` reply: the words to show ([Reply.detail], never ignored) and the
     * shot to switch to ([Reply.readyShot]), or null for an accepted shot.
     */
    fun onRefusal(r: Reply): Pair<String, String?>? {
        if (r.ok) return null
        val words = r.detail.ifEmpty { r.reason.replace('_', ' ') }
        return words to r.readyShot
    }
}

/** Saves and the rules version (core/API.md: rules v3, old saves do not resume). */
object SaveCompat {
    /** The rules version this app is built for. */
    const val RULES = 3
    private val RULES_RE = Regex("\"rules\"\\s*:\\s*(\\d+)")

    fun rulesOf(version: String): Int? = RULES_RE.find(version)?.groupValues?.get(1)?.toIntOrNull()

    /**
     * A plain message when a saved battle can not be carried on with the core in this app, else
     * null. [saved] is the cp_version text the save was written with; [now] is this core's.
     * A save that names no rules version is from before rules v3 (or from the debug fixture
     * player, [standIn]), and the fixture player's own saves are fine.
     */
    fun refusal(saved: String, now: String?, standIn: Boolean): String? {
        if (standIn) return null
        val then = rulesOf(saved)
        val current = now?.let { rulesOf(it) } ?: RULES
        if (then == current) return null
        return "This saved battle was played under older game rules" + (then?.let { " (version $it)" } ?: "") +
            " and cannot be carried on. It was set aside. Your progress and Buttons are kept."
    }
}

/** Where things sit on a phone (QA playtest 1, M3, M7, M8, m5). Sizes in dp. */
object PhoneLayout {
    enum class Pad { BOTTOM_END, BOTTOM_START, TOP_END, TOP_START }

    /**
     * The Fine Tune pad never covers your fort (M7). Your fort is on the left for side 0 and on
     * the right for side 1. Tall layout: docked at the foot of the bottom lens on the far side.
     * Wide layout: under the top strip on the far side, clear of the tray and Fire.
     */
    fun pad(tall: Boolean, mySide: Int): Pad = when {
        tall -> if (mySide == 1) Pad.BOTTOM_START else Pad.BOTTOM_END
        else -> if (mySide == 1) Pad.TOP_START else Pad.TOP_END
    }

    /** The hand-off card goes compact on a short screen, so READY stays in view at 844 x 390 (m5). */
    fun handoffCompact(heightDp: Float): Boolean = heightDp < 520f

    /** Couch Duel setup puts the two player cards side by side from this width (M8). */
    fun duelSideBySide(widthDp: Float): Boolean = widthDp >= 600f
}

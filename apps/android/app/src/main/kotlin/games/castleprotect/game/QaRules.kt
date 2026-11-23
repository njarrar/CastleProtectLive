package games.castleprotect.game

import games.castleprotect.core.BestShot
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.Reply
import games.castleprotect.core.Text

/**
 * What the HUD shows for the core rules v3 fields (core/API.md "Changes for QA playtest 1").
 * Plain functions over the core's own values, so they can be unit tested. None of them
 * decides a rule: they choose words and where things sit.
 */
object HudText {
    private fun t(key: String, vararg a: Pair<String, Any?>) = Text.t(key, *a)

    /** The round label. Test Yard: no rounds. The Creaks: counted down from 3 rounds before (M2). */
    fun round(h: Hud, mode: String): String {
        val v = h.volley
        val base = when {
            mode == "test_yard" -> t("hud.test_yard")
            v != null -> return t("hud.shots_left", "n" to v.left.getOrElse(h.side) { 0 }, "total" to v.actions)
            h.squallRound > 0 -> return t("hud.squall.count", "n" to h.squallRound)
            else -> t("hud.round", "n" to h.round, "cap" to h.roundCap)
        }
        val extra = when {
            mode == "test_yard" -> ""
            h.squallWarning > 0 -> "  " + t("hud.squall.in", "n" to h.squallWarning)
            h.fatigueIn == 1 -> "  " + t("hud.creaks.next")
            h.fatigueIn in 2..3 -> "  " + t("hud.creaks.in", "n" to h.fatigueIn)
            h.fatigue -> "  " + t("hud.creaks.on")
            else -> ""
        }
        return base + extra
    }

    /** The round label is a warning colour: the Squall or the Creaks is close or on. */
    fun warn(h: Hud): Boolean = h.squallRound > 0 || h.squallWarning > 0 || h.fatigueIn in 1..3 || h.fatigue

    /**
     * Compact Tier-3 Top Strip label (Part 2 Plate 1 & 2). The boss part is spelled out
     * ("Part 1 of 3") so it is never misread as Player 1; the Creaks have their own badge.
     */
    fun compactRound(h: Hud, mode: String): String {
        val v = h.volley
        val base = when {
            mode == "test_yard" -> t("hud.test_yard")
            v != null -> t("hud.shots_left", "n" to v.left.getOrElse(h.side) { 0 }, "total" to v.actions)
            h.squallRound > 0 -> t("hud.squall.count", "n" to h.squallRound)
            else -> t("hud.round_short", "n" to h.round, "cap" to h.roundCap)
        }
        val phase = h.boss?.let { " · " + t("hud.boss.phase", "n" to it.phase) } ?: ""
        return base + phase
    }

    /** Dedicated warning pill text beside the compact Round pill, or null when calm (Part 2 Plate 2). */
    fun statusPill(h: Hud, mode: String): String? = when {
        mode == "test_yard" -> null
        h.squallRound > 0 -> t("hud.squall.short")
        h.squallWarning > 0 -> t("hud.squall.in", "n" to h.squallWarning)
        h.fatigue || (h.fatigueRound > 0 && h.round >= h.fatigueRound) -> t("hud.creaks.on")
        h.fatigueIn == 1 -> t("hud.creaks.next")
        h.fatigueIn in 2..3 -> t("hud.creaks.in", "n" to h.fatigueIn)
        else -> null
    }

    /** The banner one round before the Creaks start (hud.fatigue_in 1), or null. */
    fun fatigueBanner(h: Hud): String? = if (h.fatigueIn == 1) t("banners.creaks.warn") else null

    /** Banner for the `fatigue` event: the round 10 collapse that follows plays as normal collapses. */
    val FATIGUE_ON: String get() = FatigueBeat.START

    /** A short badge for an unready shot chip, from `hud.shots[].why` (`hud.why_short`). */
    fun chipBadge(why: String?): String = when (why) {
        null, "not_planning" -> ""
        else -> Text.opt("hud.why_short.$why") ?: ""
    }

    /**
     * Words for a `shot_switch` event: the picked shot could not fire, so the core moved to the
     * Plain Shot. [hob] is the Hob's short name, [shot] the name of the shot that could not fire.
     */
    fun shotSwitch(hob: String, why: String, shot: String): String {
        val reason = Text.opt("hud.why.$why", "hob" to hob, "shot" to shot)
        val switched = t("hud.switched_plain")
        return when {
            reason == null -> switched
            why == "resting_plain_only" -> reason
            else -> "$reason $switched"
        }
    }

    /** "Best shot" line: the Hob (short name), the damage, the aim. */
    fun bestShot(b: BestShot, hobShort: String? = null): String {
        val who = hobShort ?: b.hobName.ifEmpty { t("common.nobody") }
        return t("results.best_shot_long", "hob" to who, "n" to b.dmg, "angle" to String.format(java.util.Locale.ROOT, "%.1f", b.angle / 10f), "power" to b.power)
    }

    /** Why a shot can not fire, from the core's id (`hud.why.<why>`, else `hud.why.default`). Never the core's English. */
    fun why(why: String?, hob: String, shot: String): String = Text.byId("hud.why", why, "hob" to hob, "shot" to shot)
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

    /**
     * The words to show by grey Fire, or null: the id in `hud.fire.why`, else the picked chip's,
     * in the string table's words (`hud.why`). [hob] is the picked Hob's short name, [shot] the shot's name.
     */
    fun why(h: Hud, hob: String = "", shot: String = ""): String? {
        val f = h.fire
        val c = h.chip(h.selectedShot)
        val id = when {
            f != null && !f.ready -> f.why
            c != null && !c.ready -> c.why
            else -> return null
        }
        return HudText.why(id, hob, shot)
    }

    /** True when [side] has enough per-turn AND total Steam to pay for Shove Off (Android-C2). */
    fun canShoveOff(h: Hud, side: Int): Boolean {
        val cost = h.shoveOffCost
        val steam = h.steam.getOrElse(side) { 0 }
        return h.steamTurnLeft >= cost && steam >= cost
    }

    /**
     * True when no alive Hob on [side] can fire, no buried Hob can afford Shove Off, and no Doodads remain
     * (Android-C2): Fire turns into PASS sending Cmd.PASS so the turn can never soft-lock.
     */
    fun mustPass(h: Hud, humanTurn: Boolean, hobs: List<Hob>, side: Int): Boolean {
        if (!humanTurn) return false
        if (h.doodads.getOrElse(side) { emptyList() }.isNotEmpty()) return false
        val shove = canShoveOff(h, side)
        for (hb in hobs) {
            if (hb.side != side || hb.dummy || hb.bonked) continue
            if (hb.canFire) return false
            if (hb.buried && shove) return false
        }
        return true
    }

    /**
     * What to do with a `fire` reply: the words to show ([Reply.detail], never ignored) and the
     * shot to switch to ([Reply.readyShot]), or null for an accepted shot.
     */
    fun onRefusal(r: Reply, hob: String = "", shot: String = ""): Pair<String, String?>? {
        if (r.ok) return null
        // The refusal id in the table's words; an id the table does not know gets the plain "did not go through".
        val words = Text.opt("hud.why.${r.reason}", "hob" to hob, "shot" to shot) ?: Text.t("errors.move_failed")
        return words to r.readyShot
    }
}

/** Saves and the rules version (core/API.md: rules v5, saves from rules v4 do not resume). */
object SaveCompat {
    /** The rules version this app is built for. */
    const val RULES = 5
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
        return Text.t("errors.saved_fight_old")
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

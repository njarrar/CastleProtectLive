package games.castleprotect.game

import games.castleprotect.core.Blow
import games.castleprotect.core.Hob
import games.castleprotect.core.Text
import kotlin.math.max

/**
 * App side of the QA playtest 2 fixes (docs/qa/playtest-2/REPORT.md, "Core fixes" and
 * "8. Web fixes"; core/API.md rules v4). Plain functions and small state holders over
 * the core's own values, so they can be unit tested. None of them decides a rule.
 */

/** Hob states (core/API.md `hobs[]`, N2): only `bonked` or 0 HP is out of the fight. */
object HobLook {
    /** Out of the fight: no turns, portrait greyed, pip empty. */
    fun out(state: String, hp: Int): Boolean = state == "bonked" || hp <= 0

    /**
     * Crushed but alive: `squashed`, or `dropped` with its floor gone too at 1 HP (the
     * Fatigue collapse). Drawn flattened with stars, pip filled, portrait live, may fire.
     */
    fun squashed(state: String, hp: Int): Boolean = !out(state, hp) && (state == "squashed" || (state == "dropped" && hp <= 1))

    /** A crew pip is out only when its Hob is Bonked (`hud.crew[].hp_pct` is at least 1 while alive). */
    fun pipOut(state: String): Boolean = state == "bonked"

    /** A crew pip for a crushed Hob: drawn filled with a dashed ring, never as an empty pip. */
    fun pipSquashed(state: String, hpPct: Int): Boolean = !pipOut(state) && (state == "squashed" || (state == "dropped" && hpPct <= 1))

    /** How much of a pip is filled, 0 to 1. */
    fun pipFill(state: String, hpPct: Int): Float = when {
        pipOut(state) -> 0f
        pipSquashed(state, hpPct) -> 1f
        else -> hpPct.coerceIn(1, 100) / 100f
    }

    /** The portrait's state words, for TalkBack (`hobs.states`), or empty when the Hob is fine. */
    fun words(h: Hob): String = when {
        out(h.state, h.hp) -> Text.t("hobs.states.bonked")
        squashed(h.state, h.hp) -> Text.t(if (h.state == "squashed") "hobs.states.squashed" else "hobs.states.dropped")
        h.buried -> Text.t("hobs.states.dug")
        h.rest > 0 -> Text.t("hobs.states.rest")
        h.cover -> Text.t("hobs.states.cover")
        else -> ""
    }
}

/**
 * Fatigue shown (N1): a banner at round 9, a red banner when the collapse starts, the
 * "Your turn" banner waits for them, and the camera holds your own fort while the
 * collapse plays. Fed the core's events on the sim thread; read by the view and the HUD.
 */
class FatigueBeat {
    class Banner(val text: String, val danger: Boolean, val ms: Long)

    /** Uptime (ms) until which a Fatigue banner is up; "Your turn" waits until then. */
    @Volatile var bannerUntil = 0L
        private set
    /** The camera holds your own fort: from the Fatigue start until the next shot. */
    @Volatile var holdHome = false
        private set
    private var warnedRound = -1

    /** One core event. Returns a banner to show, or null. */
    fun onEvent(t: String, why: String, round: Int, now: Long): Banner? = when (t) {
        "fatigue_warning" -> { warnedRound = round; show(Banner(WARN, false, WARN_MS), now) }
        "fatigue" -> { holdHome = true; show(Banner(START, true, START_MS), now) }
        "collapse" -> { if (why == "fatigue") holdHome = true; null }
        "fire" -> { holdHome = false; null }
        else -> null
    }

    /**
     * The round 9 warning from the HUD (`hud.fatigue_in` 1), for a battle resumed in round 9
     * that never saw the event. Shown once per round.
     */
    fun onTurnStart(fatigueIn: Int, round: Int, now: Long): Banner? {
        if (fatigueIn != 1 || warnedRound == round) return null
        warnedRound = round
        return show(Banner(WARN, false, WARN_MS), now)
    }

    /** How long "Your turn" still waits, in ms. */
    fun turnBannerWait(now: Long): Long = max(0L, bannerUntil - now)

    fun reset() { bannerUntil = 0L; holdHome = false; warnedRound = -1 }

    private fun show(b: Banner, now: Long): Banner { bannerUntil = max(bannerUntil, now + b.ms); return b }

    companion object {
        val WARN: String get() = Text.t("banners.creaks.warn")
        val START: String get() = Text.t("banners.creaks.start")
        const val WARN_MS = 3500L
        const val START_MS = 3000L
    }
}

/** Teaching the owner rule (QA playtest 2, 4.1): aims start on your own fort. */
object OwnerRule {
    /** The gold ring shows on the picked Hob until this many aims were started from the fort. */
    const val TEACH = 3
    val NUDGE: String get() = Text.t("hud.aim_hint")
    const val NUDGE_MS = 2500L

    fun ringOn(aimStarts: Int): Boolean = aimStarts < TEACH

    /** A one finger drag that did not start an aim, on your turn, in the aim lens, says [NUDGE] once per battle. */
    fun nudge(humanTurn: Boolean, hasHob: Boolean, inAimLens: Boolean, shownThisBattle: Boolean): Boolean =
        humanTurn && hasHob && inAimLens && !shownThisBattle

    /**
     * A turn opens on a Hob who can act (n1): the picked Hob, if it may fire this turn, else
     * the first crewmate who may. Returns the id to pick, or null to leave the pick alone
     * (nobody can act: Fire offers Pass as before).
     */
    fun openOn(hobs: List<Hob>, side: Int, picked: Int): Int? {
        fun able(h: Hob) = h.side == side && !h.dummy && !h.bonked && h.canFire
        val cur = hobs.firstOrNull { it.id == picked && it.side == side }
        if (cur != null && able(cur)) return null
        return hobs.firstOrNull { able(it) }?.id
    }
}

/** The landscape Rival fort marker is a one tap peek (N3). */
class RivalPeek {
    @Volatile var on = false
        private set
    private var turn = -1

    fun tap() { on = !on }

    /** A shot or a new turn brings the camera home. */
    fun onFrame(turn: Int, shotFlying: Boolean) {
        if (turn != this.turn) { this.turn = turn; on = false }
        if (shotFlying) on = false
    }

    /** Resets peek state between battles so a new battle never starts zoomed out (Android-L1). */
    fun reset() { on = false; turn = -1 }

    fun label(): String = if (on) HOME else VIEW

    companion object {
        val VIEW: String get() = Text.t("hud.view_rival")
        val HOME: String get() = Text.t("hud.view_mine")
    }
}

/** "What broke you" (B1): the core's `by` names who dealt each blow. Words from `results.blow`, never the core's English. */
object BrokeText {
    /** Who dealt a blow, from `by` (older cores: from the shot). */
    fun by(b: Blow): String = b.by.ifEmpty {
        when (b.shot) { "squall" -> "squall"; "ground" -> "ground"; else -> if (b.hob >= 0) "hob" else "" }
    }

    /**
     * "Marge's Clodpot", or a field blow by its own words: "the Squall", "a fall", "the Creaks".
     * [hobShort] turns the blow's Hob id into its short name; [shotName] a shot id into its name.
     */
    fun blow(b: Blow, hobShort: (Int) -> String? = { null }, shotName: (String) -> String? = { null }): String {
        val shot = shotName(b.shot) ?: b.shotName.ifEmpty { b.shot.replace('_', ' ') }
        val who = if (b.hob >= 0) hobShort(b.hob) ?: b.hobName else ""
        val key = by(b).ifEmpty { "hob" }
        return if (key == "hob" && who.isEmpty()) Text.t("results.blow.shot_only", "shot" to shot)
        else Text.byId("results.blow", key, "who" to who, "shot" to shot).ifEmpty { shot }
    }

    fun last(b: Blow, hobShort: (Int) -> String? = { null }, shotName: (String) -> String? = { null }): String =
        Text.t("results.last_blow", "blow" to blow(b, hobShort, shotName), "n" to b.round)

    /** The result note for a Double Pop (n5): how the winner was picked (core battle.rs total_hp). */
    fun doublePop(how: String?): String? = if (how == "double_pop") Text.t("results.double_pop_rule") else null
}

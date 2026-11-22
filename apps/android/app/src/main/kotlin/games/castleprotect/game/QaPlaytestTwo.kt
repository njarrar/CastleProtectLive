package games.castleprotect.game

import games.castleprotect.core.Blow
import games.castleprotect.core.Hob
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

    /** The portrait's state words, for TalkBack. */
    fun words(h: Hob): String = when {
        out(h.state, h.hp) -> "Bonked"
        squashed(h.state, h.hp) -> if (h.state == "squashed") "Squashed, back up soon" else "Dropped, ${h.hp} HP"
        h.buried -> "Loophole buried"
        h.rest > 0 -> "resting ${h.rest}"
        else -> "${h.hp} of ${h.max} HP"
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
        const val WARN = "Fatigue next round: hurt blocks hold less"
        const val START = "Fatigue! Battered blocks give way"
        const val WARN_MS = 3500L
        const val START_MS = 3000L
    }
}

/** Teaching the owner rule (QA playtest 2, 4.1): aims start on your own fort. */
object OwnerRule {
    /** The gold ring shows on the picked Hob until this many aims were started from the fort. */
    const val TEACH = 3
    const val NUDGE = "Drag from your fort to aim"
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

    fun label(): String = if (on) HOME else VIEW

    companion object {
        const val VIEW = "View Rival fort"
        const val HOME = "Back to my fort"
    }
}

/** "What broke you" (B1): the core's `by` names who dealt each blow; `hob_name` is never null. */
object BrokeText {
    /** Who dealt a blow, from `by` (older cores: from the shot). */
    fun by(b: Blow): String = b.by.ifEmpty {
        when (b.shot) { "squall" -> "squall"; "ground" -> "ground"; else -> if (b.hob >= 0) "hob" else "" }
    }

    /** "Clodpot from Marge Dumpling", or a field blow by its own name: "The Squall", "A fall", "Fatigue". */
    fun blow(b: Blow): String {
        val shot = b.shotName.ifEmpty { b.shot.replace('_', ' ') }
        return when (by(b)) {
            "hob" -> if (b.hobName.isNotEmpty()) "$shot from ${b.hobName}" else shot
            "squall" -> b.hobName.ifEmpty { "The Squall" }
            "ground" -> b.hobName.ifEmpty { "A fall" }
            "fatigue" -> b.hobName.ifEmpty { "Fatigue" }
            "self" -> b.hobName.ifEmpty { "Your own shot" }
            "shears" -> b.hobName.ifEmpty { "The shears" }
            "prop" -> b.hobName.ifEmpty { shot }
            else -> if (b.hobName.isNotEmpty()) "$shot from ${b.hobName}" else shot
        }
    }

    fun last(b: Blow): String = "Last blow: ${blow(b)}" + if (b.round > 0) ", round ${b.round}" else ""

    /** The result note for a Double Pop (n5): how the winner was picked. */
    fun doublePop(how: String?): String? = if (how == "double_pop")
        "Both kettles popped in the same Squall round. The kettle that had more left before that round wins." else null
}

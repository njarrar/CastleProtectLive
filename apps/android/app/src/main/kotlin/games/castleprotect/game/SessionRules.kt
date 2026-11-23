package games.castleprotect.game

import games.castleprotect.core.Frame
import games.castleprotect.core.Phase

/**
 * The aim the Fine Tune keys step from (review M9, review 2 N-M4). Fast key presses
 * build on the last aim sent, not on a snapshot that has not come back yet. Anything
 * that sets the aim another way (Recall, picking a Hob, a refused aim) forgets it, so
 * the next step starts from the core's aim.
 */
class AimMemory {
    private var turn = -1
    private var hob = -1
    var angle = 0
        private set
    var power = 0
        private set

    fun sent(turn: Int, hob: Int, angle: Int, power: Int) { this.turn = turn; this.hob = hob; this.angle = angle; this.power = power }
    fun forget() { turn = -1; hob = -1 }

    /** The aim to step from for [hob] on [turn]: the last one sent, else the core's. */
    fun base(turn: Int, hob: Int, coreAngle: Int, corePower: Int): Pair<Int, Int> =
        if (turn == this.turn && hob == this.hob && hob >= 0) angle to power else coreAngle to corePower
}

/** The selected Hob's aim, apart from [BattleUi], so an Aim Drag recomposes only the readout and the pad (review 2 N-M9). */
data class AimUi(val turn: Int = -1, val hob: Int = -1, val angle: Int = 450, val power: Int = 50) {
    companion object {
        fun of(f: Frame): AimUi {
            val h = f.selectedHob ?: return AimUi(f.hud.turn)
            return AimUi(f.hud.turn, h.id, h.angle, h.power)
        }
    }
}

/** TalkBack texts (review 2 N-M11). */
object Announce {
    /** All texts of one frame as one, so the shot result is not overwritten by the turn text in the same frame. */
    fun join(parts: List<String>): String = parts.filter { it.isNotBlank() }.joinToString(". ") { it.trim().trimEnd('.') }.let { if (it.isEmpty()) it else "$it." }

    /**
     * The live region text for [next] after [prev]. The same words twice in a row would
     * not change the node, so TalkBack would stay quiet; a zero width space tells them apart.
     */
    fun distinct(prev: String, next: String): String = if (prev == next) next + "​" else next
}

/**
 * Looks up a block's material using the previous frame first so broken blocks (already removed from [cur])
 * still resolve to their real material for break/lethal-hit audio (Android-M1).
 */
object BlockLookup {
    fun material(prev: Frame, cur: Frame, side: Int, c: Int, r: Int): String? {
        for (src in arrayOf(prev, cur)) {
            val k = src.castles.firstOrNull { it.side == side } ?: src.castles.getOrNull(side)
            if (k != null) {
                for (b in k.blocks) if (b.c == c && b.r == r) return b.mat
            }
        }
        return null
    }
}

/**
 * Pure Pre-battle Rummage lifecycle rules (Android-C1). When the player picks the last shell,
 * the core immediately transitions from Phase.DRAFT to Phase.PLAN; [draftedOnPreBattle] tracks
 * that this unfought live handle belongs to the current Pre-battle screen.
 */
object PreBattleDraft {
    /** True when the current live handle was drafted on Pre-battle (in progress or already completed into PLAN). */
    fun activeHandle(live: Boolean, phase: Phase, draftedOnPreBattle: Boolean): Boolean =
        live && (phase == Phase.DRAFT || (draftedOnPreBattle && phase == Phase.PLAN))

    /** True when FIGHT should enter the existing live drafted handle directly instead of replacing it. */
    fun fightUsesExisting(live: Boolean, phase: Phase, draftedOnPreBattle: Boolean): Boolean =
        activeHandle(live, phase, draftedOnPreBattle)

    /** True when FIGHT must still send Cmd.END_DRAFT before entering Battle. */
    fun needsEndDraft(phase: Phase): Boolean = phase == Phase.DRAFT

    /** True when pressing Back from PRE_BATTLE should discard the unfought drafted handle and clear save.battle. */
    fun dropOnBack(live: Boolean, phase: Phase, draftedOnPreBattle: Boolean): Boolean =
        activeHandle(live, phase, draftedOnPreBattle)

    /** True when replacingBattle() should NOT show "Start a new battle?" because the live handle is this Pre-battle draft. */
    fun skipReplaceConfirm(onPreBattle: Boolean, live: Boolean, phase: Phase, draftedOnPreBattle: Boolean): Boolean =
        onPreBattle && activeHandle(live, phase, draftedOnPreBattle)
}

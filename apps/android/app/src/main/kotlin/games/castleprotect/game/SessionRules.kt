package games.castleprotect.game

import games.castleprotect.core.Frame

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

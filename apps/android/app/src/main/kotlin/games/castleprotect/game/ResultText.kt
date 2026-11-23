package games.castleprotect.game

import games.castleprotect.core.BattleResult
import games.castleprotect.core.Broke
import games.castleprotect.core.Names
import games.castleprotect.core.Text

/**
 * The words on the results card (content/text.md "Results"). Pure, so a unit test can
 * check the rule:
 *
 * - Campaign win: `levels.<id>.win_title`, then `results.win.how.<how>`, then one line
 *   from the Rival's `sign_off` pool.
 * - Any other win: `results.win.title.<how>`.
 * - Loss: `results.loss.title.<how>`, then `results.loss.cause.<how>` if it is not empty,
 *   then one line from `results.loss.verdict`.
 * - A cause line that says the same as the title is never shown.
 */
object ResultText {
    class Lines(
        val title: String,
        /** The line under the title, or empty. */
        val sub: String,
        /** The Rival's sign-off on a campaign win, or null. */
        val signOff: String? = null,
        /** Hetty's one-line verdict on a loss, or null. */
        val verdict: String? = null,
        /** "Hetty says", or null before the player has met her (she is freed in 1-7). */
        val verdictBy: String? = null,
    )

    /**
     * [won] the person won; [duel] both sides are people; [names] the sides' names;
     * [rivalName] the Rival's display name (`hud.names[1]`); [hobShort] and [shotName] turn the
     * core's ids into words; [hettyMet] shows "Hetty says" over the verdict.
     */
    fun of(
        r: BattleResult, level: String, campaign: Boolean, won: Boolean, duel: Boolean,
        names: List<String>, rivalName: String?, hettyMet: Boolean,
        hobShort: (Int) -> String? = { null }, shotName: (String) -> String? = { null },
    ): Lines {
        val how = r.how
        val rival = Names.rivalShort(level, rivalName)
        val captive = Names.captive(level).ifEmpty { Text.t("hud.objects.captive") }
        val args = arrayOf<Pair<String, Any?>>("rival" to rival, "captive" to captive)
        if (r.winner < 0) return Lines(Text.t("results.duel.draw"), BrokeText.doublePop(how) ?: "")
        if (duel) {
            val name = names.getOrElse(r.winner) { "" }
            return Lines(Text.t("results.duel.title", "name" to name), Text.t("results.duel.good_game"))
        }
        if (won) {
            if (campaign && Text.has("levels.$level.win_title")) {
                val key = Names.rivalKey(level, rivalName)
                return Lines(
                    Text.t("levels.$level.win_title", *args),
                    Text.byId("results.win.how", how, *args),
                    Text.opt("rivals.$key.sign_off", *args),
                )
            }
            return Lines(Text.byId("results.win.title", how, *args), "")
        }
        val title = Text.byId("results.loss.title", how, *args)
        val cause = cause(r.broke, how, hobShort, shotName, args).takeIf { it.isNotEmpty() && !same(it, title) } ?: ""
        val by = r.broke?.last?.let { BrokeText.by(it) }
        val verdict = (by?.takeIf { it in VERDICT_BY_BLOW }?.let { Text.opt("results.loss.verdict.$it") })
            ?: Text.opt("results.loss.verdict.$how") ?: Text.opt("results.loss.verdict.default")
        return Lines(title, cause, null, verdict, if (hettyMet) Text.t("results.loss.verdict_by") else null)
    }

    /** `results.loss.cause.<how>`, with the last blow filled in where the line needs it. */
    private fun cause(b: Broke?, how: String, hobShort: (Int) -> String?, shotName: (String) -> String?, args: Array<Pair<String, Any?>>): String {
        val last = b?.last
        when (how) {
            "kettle_pop" -> {
                val who = last?.takeIf { it.hob >= 0 }?.let { hobShort(it.hob) ?: it.hobName }.orEmpty()
                val shot = last?.let { shotName(it.shot) ?: it.shotName }.orEmpty()
                return if (who.isNotEmpty() && shot.isNotEmpty()) Text.t("results.loss.cause.kettle_pop", "who" to who, "shot" to shot, "n" to last!!.round)
                else Text.t("results.loss.cause.kettle_pop_plain", "n" to (last?.round ?: 0))
            }
            "clean_sweep" -> return Text.t("results.loss.cause.clean_sweep_plain")
        }
        return Text.opt("results.loss.cause.$how", *args) ?: Text.opt("results.loss.cause.default") ?: ""
    }

    /** "Kettle 120. Blocks 8. Bonked: 2." for the side that lost (`results.tally`). */
    fun tally(b: Broke): String =
        if (b.hobsBonked > 0) Text.t("results.tally", "kettle" to b.kettleLost, "blocks" to b.blocksLost, "hobs" to b.hobsBonked)
        else Text.t("results.tally_nobody", "kettle" to b.kettleLost, "blocks" to b.blocksLost)

    private fun same(a: String, b: String): Boolean {
        fun norm(s: String) = s.lowercase().filter { it.isLetterOrDigit() }
        val x = norm(a); val y = norm(b)
        return x == y || (y.isNotEmpty() && x.contains(y) && x.length <= y.length + 4)
    }

    private val VERDICT_BY_BLOW = setOf("ground", "fatigue", "self", "shears")
}

package games.castleprotect.core

/**
 * Names and goal words from the string table (content/text.md). Names of Hobs, shots and
 * Doodads come from content JSON; short names, Rival keys and goal wording from text.json.
 * Pure lookups, so unit tests can check them.
 */
object Names {
    /** A Hob's short name: `hobs.<id>.short`, else its full content name, else the id. Never cut at a space. */
    fun hobShort(def: String, full: String? = null): String =
        Text.opt("hobs.$def.short")?.takeIf { it.isNotEmpty() } ?: full?.takeIf { it.isNotEmpty() } ?: def.replace('_', ' ')

    /**
     * The Rival's key under `rivals`: `levels.<id>.rival` for a campaign level, else the Rival
     * whose `name` matches [name] (Skirmish picks one by seed), else `skirmish`.
     */
    fun rivalKey(levelId: String?, name: String?): String {
        if (!name.isNullOrEmpty()) for (k in Text.keys("rivals")) if (Text.opt("rivals.$k.name") == name) {
            // 1-7 has an acting Corporal who shares a name style: the level's own key wins when it matches too.
            val lv = levelId?.let { Text.opt("levels.$it.rival") }
            return if (lv != null && Text.opt("rivals.$lv.name") == name) lv else k
        }
        levelId?.let { Text.opt("levels.$it.rival") }?.let { return it }
        return "skirmish"
    }

    /** The Rival's short name for banners and lines (`rivals.<key>.short`), else [name], else the fallback. */
    fun rivalShort(levelId: String?, name: String?): String {
        val k = rivalKey(levelId, name)
        if (k == "skirmish" && !name.isNullOrEmpty()) return name
        return Text.opt("rivals.$k.short") ?: name?.takeIf { it.isNotEmpty() } ?: Text.t("rivals.skirmish.short")
    }

    /** The captive's name on a rescue level (`levels.<id>.captive`), or empty. */
    fun captive(levelId: String?): String = levelId?.let { Text.opt("levels.$it.captive") } ?: ""

    /**
     * Goal words for one Pennant (content/text.md "Goals"): `levels.<L>.goals.<type>`, else
     * `pennants.<type>`, else the level file's text. `{n}` is the Pennant's value.
     */
    fun goal(levelId: String, p: PennantInfo, rivalName: String? = null): String {
        val args = arrayOf<Pair<String, Any?>>("n" to p.value, "rival" to rivalShort(levelId, rivalName), "captive" to captive(levelId))
        return Text.opt("levels.$levelId.goals.${p.type}", *args)
            ?: Text.opt("pennants.${p.type}", *args)
            ?: p.text
    }
}

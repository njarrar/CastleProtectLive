package games.castleprotect.game

import games.castleprotect.core.GameEvent
import org.json.JSONObject

/** One sound from assets/audio/audio.json. */
class SoundDef(
    val id: String, val kind: String, val file: String, val loop: Boolean, val repeatGapS: Float,
    val layer: String?, val bus: String, val volume: Float, val pitchVar: Float, val durationS: Float, val barS: Float,
    /** Exact length in frames (the loop length); 0 when the manifest has none. */
    val samples: Int = 0,
) {
    /** Frames to keep from a decode at [rate]. */
    fun frames(rate: Int): Int = if (samples > 0) samples else (durationS * rate).toInt()
}

/** One bark's lines from assets/audio/barks.json. */
class BarkEntry(
    /** Lines that fit any fight. */
    val subtitles: List<String>,
    /** Lines that name a crewmate, by that Hob's content id: only when that Hob is on the crew. */
    val withMate: Map<String, List<String>> = emptyMap(),
    /** Lines with `{rival}`: only against a named Rival. */
    val withRival: List<String> = emptyList(),
    /** This bark's own chance, or null for the event's. */
    val chance: Float? = null,
) {
    /** The pool for a fight: plain lines, mate lines for [mates] on the crew, Rival lines with [rival] filled in. */
    fun pool(mates: Set<String>, rival: String?): List<String> {
        val out = ArrayList<String>(subtitles)
        for ((mate, lines) in withMate) if (mate in mates) out.addAll(lines)
        if (!rival.isNullOrEmpty()) for (l in withRival) out.add(l.replace("{rival}", rival))
        return out
    }
}

/** Hob-speak subtitles from assets/audio/barks.json, by sound id (`old_thumper` still sounds as `bark_thumper_*`). */
class BarkLines(
    val entries: Map<String, BarkEntry>,
    val chance: Map<String, Float>,
    /** `crew.win`: said once by the winning crew after the Hob's win line. */
    val crewWinLines: List<String> = emptyList(),
) {
    /** Plain lines by sound id. */
    val lines: Map<String, List<String>> get() = entries.mapValues { it.value.subtitles }
    /** One crew win line, or null. */
    val crewWin: String? get() = games.castleprotect.core.Text.pickFrom("barks.crew.win", crewWinLines)

    /** The chance that [event] barks for sound [id]: the bark's own, else the event's, else 0.4. */
    fun chanceOf(id: String, event: String): Float = entries[id]?.chance ?: chance[event] ?: 0.4f

    companion object {
        val EMPTY = BarkLines(emptyMap(), emptyMap())

        private fun strings(a: org.json.JSONArray?): List<String> = (0 until (a?.length() ?: 0)).map { a!!.optString(it) }.filter { it.isNotEmpty() }

        fun parse(text: String?): BarkLines {
            if (text == null) return EMPTY
            return try {
                val o = JSONObject(text)
                val entries = HashMap<String, BarkEntry>(); val chance = HashMap<String, Float>()
                o.optJSONObject("events")?.let { e -> for (k in e.keys()) chance[k] = e.optJSONObject(k)?.optDouble("chance", 0.4)?.toFloat() ?: 0.4f }
                val hobs = o.optJSONObject("hobs") ?: JSONObject()
                for (h in hobs.keys()) {
                    val b = hobs.optJSONObject(h)?.optJSONObject("barks") ?: continue
                    for (ev in b.keys()) {
                        val one = b.optJSONObject(ev) ?: continue
                        val mates = HashMap<String, List<String>>()
                        one.optJSONObject("with_mate")?.let { m -> for (k in m.keys()) mates[k] = strings(m.optJSONArray(k)) }
                        entries[one.optString("sound", "bark_${Cues.barkKey(h)}_$ev")] = BarkEntry(
                            strings(one.optJSONArray("subtitles")), mates, strings(one.optJSONArray("with_rival")),
                            if (one.has("chance")) one.optDouble("chance", 0.4).toFloat() else null,
                        )
                    }
                }
                val crew = strings(o.optJSONObject("crew")?.optJSONObject("win")?.optJSONArray("subtitles"))
                BarkLines(entries, chance, crew)
            } catch (e: Exception) { EMPTY }
        }
    }
}

/**
 * assets/audio/audio.json: 140 sounds with their bus, volume, pitch spread, loop rule
 * and trigger, plus the lookups (launch sound per shot, material and blast sounds).
 * Android plays the Opus (.ogg) files.
 */
class AudioManifest(
    val sounds: Map<String, SoundDef>,
    val shotLaunch: Map<String, String>,
    val materialHit: Map<String, String>,
    val materialBreak: Map<String, String>,
    val blast: Map<String, String>,
    /** Bus to slider default (Music, Sound, Voices). */
    val busSlider: Map<String, String>,
) {
    operator fun get(id: String): SoundDef? = sounds[id]

    companion object {
        val EMPTY = AudioManifest(emptyMap(), emptyMap(), emptyMap(), emptyMap(), emptyMap(), emptyMap())

        fun parse(text: String?): AudioManifest {
            if (text == null) return EMPTY
            return try {
                val o = JSONObject(text)
                val sounds = HashMap<String, SoundDef>()
                val arr = o.optJSONArray("sounds")
                if (arr != null) for (i in 0 until arr.length()) {
                    val s = arr.optJSONObject(i) ?: continue
                    val files = s.optJSONObject("files") ?: continue
                    val sync = s.optJSONObject("sync")
                    val id = s.optString("id")
                    sounds[id] = SoundDef(
                        id, s.optString("kind"), files.optString("ogg"), s.optBoolean("loop", false),
                        if (s.isNull("repeat_gap_s")) 0f else s.optDouble("repeat_gap_s", 0.0).toFloat(),
                        if (s.isNull("layer")) null else s.optString("layer"), s.optString("bus", "ui"),
                        s.optDouble("volume", 1.0).toFloat(), s.optDouble("pitch_var_semitones", 0.0).toFloat(),
                        s.optDouble("duration", 1.0).toFloat(), sync?.optDouble("bar_s", 0.0)?.toFloat() ?: 0f,
                        s.optInt("samples", 0),
                    )
                }
                fun strMap(src: JSONObject?): Map<String, String> {
                    val m = HashMap<String, String>()
                    src?.keys()?.forEach { k -> if (!src.isNull(k)) m[k] = src.optString(k) }
                    return m
                }
                val hit = HashMap<String, String>(); val brk = HashMap<String, String>()
                o.optJSONObject("material_sounds")?.let { ms ->
                    for (k in ms.keys()) {
                        val m = ms.optJSONObject(k) ?: continue
                        if (!m.isNull("hit")) hit[k] = m.optString("hit")
                        if (!m.isNull("brk")) brk[k] = m.optString("brk")
                    }
                }
                val buses = HashMap<String, String>()
                o.optJSONObject("mix")?.optJSONObject("buses")?.let { b -> for (k in b.keys()) buses[k] = b.optJSONObject(k)?.optString("slider") ?: "Sound" }
                AudioManifest(sounds, strMap(o.optJSONObject("shot_launch")), hit, brk, strMap(o.optJSONObject("blast_sounds")), buses)
            } catch (e: Exception) { EMPTY }
        }
    }
}

/**
 * Which sound a core event plays (assets/audio/audio.json `trigger.game`). Pure, so a
 * unit test can check every id against the manifest. Sounds that follow an animation
 * frame (launch on release, kettle pop beats, Hob poses) come from [forAnim] instead.
 *
 * [blockMat] gives the material of a block (side, c, r), or null when it is gone.
 */
object Cues {
    fun forEvent(e: GameEvent, m: AudioManifest, blockMat: (Int, Int, Int) -> String?): List<String> = when (e.t) {
        "explode" -> {
            val band = Juice.band(e.r)
            if (e.type == "pierce" || band == "point") listOf("hit_pierce") else listOfNotNull(m.blast[band] ?: "hit_blast_medium")
        }
        "hit" -> when (e.target) {
            "block" -> listOfNotNull(blockMat(e.side, e.c, e.r)?.let { m.materialHit[it] } ?: m.materialHit["timber"])
            "kettle" -> listOf("ket_hit")
            else -> emptyList() // Hob hits sound on the hit pose's flash frame
        }
        "break" -> listOfNotNull(blockMat(e.side, e.c, e.r)?.let { m.materialBreak[it] } ?: m.materialBreak["timber"])
        "carve" -> listOf("hit_dig_carve")
        "mound" -> listOf("gnd_mound_grow")
        "split" -> listOf("fly_split")
        "castle_drop", "thump" -> listOf("cas_thump")
        "threaded" -> listOf("hit_threaded_zip", "cas_loophole_flap")
        "lid" -> listOf("doo_pot_lid_clang")
        "lid_block" -> listOf("doo_lid_bounce")
        "buried" -> listOf("hob_buried_thlup")
        "mend" -> listOf(if (e.kind.isNotEmpty()) "doo_mend_bucket_slosh" else "ket_patch")
        "rebuild" -> listOf("ket_patch")
        "front" -> listOf("wx_front_chime")
        // The bell is the Squall's alone (assets/audio/README.md "One sound per event").
        "squall_warning" -> listOf("wx_squall_bell")
        "draft_start" -> listOf("ui_card_flip")
        "draft_pick" -> listOf("ui_card_take")
        "shove_off", "dug_out" -> emptyList() // the dig pose's clear frame
        "miss" -> listOf("hit_miss_thud")
        "relight" -> listOf("ket_patch")
        "shears_snip" -> listOf("mat_timber_break")
        "shears_jam" -> listOf("doo_shears_jam")
        "boss_phase" -> listOf("cas_boss_horn")
        "roller", "roller_stop", "roller_done" -> listOf("doo_roller_rumble")
        "bounce" -> listOf("fly_bounce_hop")
        "walk" -> listOf("cas_steam")
        else -> emptyList()
    }

    /** Pitch for an event's cue in semitones: Little Ethel stopping or going home rumbles 3 semitones down. */
    fun semis(e: GameEvent): Float = when (e.t) { "roller_stop", "roller_done" -> -3f; else -> 0f }

    /** Sound for an animation event (assets/audio/README.md "Sounds that follow animations"). */
    fun forAnim(anim: String, event: String, m: AudioManifest, shot: String? = null): String? {
        return when {
            anim.startsWith("hob_") && anim.endsWith("_fire") && event == "release" -> shot?.let { m.shotLaunch[it] } ?: "launch_lob"
            anim.startsWith("hob_") && anim.endsWith("_hit") && event == "flash" -> "hob_hit_boing"
            anim.startsWith("hob_") && anim.endsWith("_tumble") && event == "fall" -> "hob_tumble_roll"
            anim.startsWith("hob_") && anim.endsWith("_land") && event == "thud" -> "hob_land_thud"
            anim.startsWith("hob_") && anim.endsWith("_cheer") && event == "land" -> "hob_land_thud"
            anim.startsWith("hob_") && anim.endsWith("_cheer") && event == "jump" -> "hob_cheer"
            anim.startsWith("hob_") && anim.endsWith("_bonked") && event == "start" -> "hob_bonk"
            anim.startsWith("hob_") && anim.endsWith("_bonked") && event == "inflate" -> "hob_balloon_inflate"
            anim.startsWith("hob_") && anim.endsWith("_bonked") && event == "lift" -> "hob_balloon_float"
            anim.startsWith("hob_") && anim.endsWith("_dig") && event == "clear" -> "hob_shove_dig"
            anim.startsWith("stomper_") && event == "stomp" -> "cas_step"
            anim == "kettle_pop" -> when (event) { "crack" -> "ket_crack"; "pop" -> "ket_pop"; "sit" -> "ket_sit_down"; else -> null }
            anim.startsWith("fx_impact_") && event == "flash" -> anim.removePrefix("fx_impact_").let { if (it == "dirt") "hit_miss_thud" else m.materialHit[it] }
            anim.startsWith("fx_crack_") && event == "start" -> "col_creak"
            anim.startsWith("fx_crack_") && event == "crack" -> "col_crack"
            anim.startsWith("fx_chunk_") && event == "start" -> "col_chunk_fall"
            anim == "collapse_land" -> "col_chunk_land"
            anim.startsWith("fx_rubble_") && event == "start" -> "col_debris_patter"
            anim == "fx_dustcloud" && event == "start" -> "col_dust_settle"
            anim == "fx_splash" && event == "plop" -> "hit_water_splash"
            anim == "fx_fizz_pop" && event == "pop" -> "hit_mend_fizz"
            anim.startsWith("fx_pin_") && event == "stick" -> "aim_pin_drop"
            anim == "pot_lid_raise" && event == "up" -> "doo_pot_lid_clang"
            anim.startsWith("loophole_flap_") && event == "start" -> "cas_loophole_flap"
            anim == "ui_fire_press" && event == "fire" -> "ui_fire_press"
            anim == "ui_pennant_earn" && event == "ding" -> "meta_pennant_stamp"
            anim == "ui_handoff_flip" && event == "swap" -> "ui_handoff_flip"
            else -> null
        }
    }

    /** Sound name part for a Hob's barks from its content id. */
    fun barkKey(def: String): String = if (def == "old_thumper") "thumper" else def

    /**
     * Music layers (assets/audio/README.md): Stir when a kettle is at 50% or less, a side
     * has 2 Hobs or fewer up, or the Squall is within 3 rounds. Peril on a last Hob, a
     * kettle at 25% or less, or the Sudden Squall.
     */
    fun layers(kettlePct: List<Int>, hobsUp: List<Int>, hobsAtStart: List<Int>, squallWarning: Int, squallRound: Int): Pair<Boolean, Boolean> {
        val minKettle = kettlePct.minOrNull() ?: 100
        val lastHob = hobsUp.indices.any { hobsUp[it] <= 1 && hobsAtStart.getOrElse(it) { 0 } > 1 }
        val fewHobs = hobsUp.indices.any { hobsUp[it] <= 2 && hobsAtStart.getOrElse(it) { 0 } > 2 }
        val peril = lastHob || minKettle <= 25 || squallRound > 0
        val stir = peril || minKettle <= 50 || fewHobs || (squallWarning in 1..3)
        return stir to peril
    }
}

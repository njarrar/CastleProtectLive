package games.castleprotect.game

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.SoundPool
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

/**
 * All game sound, from assets/audio/audio.json (assets/audio/README.md, docs/design/07
 * section 9).
 *
 * - Effects, barks and stings: one SoundPool (16 voices, at most 3 of one sound in
 *   50 ms), with each sound's volume and pitch spread, the bus sliders (Sound, Music,
 *   Voices), stereo pan, and the steal order of 07 section 9.5 ([AudioRules.priority]).
 * - World loops (wind bed, Squall, flight whistle, aim band): each on its own looping
 *   AudioTrack ([LoopTrack]), cut to the manifest's sample count. They are never stolen
 *   by a burst of impacts, and a loop asked for before its sound is ready starts as soon
 *   as it is ([LoopWants]).
 * - Music: the layers are decoded once and mixed into one stream ([MusicEngine],
 *   [LayerMix]), so the three Region 1 layers can never drift and every loop is gapless,
 *   also from the AAC copies on Android 8 and 9. A layer fades in or out over one bar,
 *   starting on the next bar line.
 * - Ducking: an impact pulls the music down 6 dB (30 ms attack, 400 ms release), a bark
 *   3 dB (only when the bark can be heard).
 * - Audio focus ([FocusState]): music asks for focus only when it can be heard; a
 *   granted request restores sound at once; a full loss stops the music only.
 * - Pause (07 section 8.3): music and loops stop under the Pause card and resume only on
 *   Resume. Leaving the app stops everything. Headphones pulled out pause the battle and
 *   silence the game until the player acts again.
 * - No sound before the first tap anywhere on the first launch ([SoundGate]).
 *
 * Opus in Ogg plays on Android 10 and later; older phones get the AAC (.m4a) copies.
 * Pool and loop work runs on one audio thread; the public calls only post to it.
 */
class Audio(private val ctx: Context, private val settings: Settings) {
    private val thread = HandlerThread("castle-audio").also { it.start() }
    private val h = Handler(thread.looper)
    @Volatile var manifest: AudioManifest = AudioManifest.EMPTY
        private set
    @Volatile var barks: BarkLines = BarkLines.EMPTY
        private set
    private val pool = SoundPool.Builder().setMaxStreams(16).setAudioAttributes(PcmDecoder.attributes(false)).build()
    private val ids = HashMap<String, Int>()
    private val ready = HashSet<Int>()
    private val recent = HashMap<String, LongArray>()
    private val rnd = Random(SystemClock.uptimeMillis())
    private val useOgg = Build.VERSION.SDK_INT >= 29
    @Volatile private var released = false
    private val gate = SoundGate(settings.soundUnlocked || settings.seenIntro) { settings.soundUnlocked = true }
    /** False until the first tap anywhere on a first launch. */
    val unlocked: Boolean get() = gate.open
    @Volatile private var foreground = true
    /** The battle's Pause card is up. */
    @Volatile private var gamePaused = false
    /** Headphones were pulled out: silent until the player acts again. */
    @Volatile private var noisy = false
    private val focus = FocusState()
    /** View slow motion: new sounds drop 3 semitones. */
    @Volatile var slowMo = false
    @Volatile private var impactAt = -10_000L
    @Volatile private var barkAt = -10_000L
    private val barkTurn = IntArray(2) { -1 }
    private var lastSub = HashMap<String, Int>()
    /** Called on the main thread when headphones are pulled out. */
    var onNoisy: (() -> Unit)? = null

    private val am = ctx.getSystemService(AudioManager::class.java)
    private val focusReq: AudioFocusRequest? = try {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(PcmDecoder.attributes(true))
            .setOnAudioFocusChangeListener({ change -> onFocus(change) }, h)
            .setWillPauseWhenDucked(false)
            .build()
    } catch (e: Exception) { null }

    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) {
            if (i?.action != AudioManager.ACTION_AUDIO_BECOMING_NOISY) return
            noisy = true
            h.post { applyMusic(); stopLoopTracks() }
            onNoisy?.invoke()
        }
    }
    private var noisyOn = false

    init {
        pool.setOnLoadCompleteListener { _, id, status -> if (status == 0) h.post { ready.add(id); if (loopWants.pending().isNotEmpty()) applyLoops() } }
        h.post {
            manifest = AudioManifest.parse(read("audio/audio.json"))
            barks = BarkLines.parse(read("audio/barks.json"))
            // Barks load with the crew in play (preloadBarks), not all 48 at start (review 2 N-L8).
            for (s in manifest.sounds.values) {
                if (released) return@post
                if (s.kind == "music" || s.loopTrack || s.id.startsWith("bark_")) continue
                load(s)
            }
            applyLoops()
        }
    }

    private val SoundDef.loopTrack: Boolean get() = loop && kind != "music" && repeatGapS <= 0f

    private fun load(s: SoundDef) {
        if (ids.containsKey(s.id)) return
        val id = try { ctx.assets.openFd("audio/" + path(s)).use { pool.load(it, 1) } } catch (e: Exception) { 0 }
        if (id != 0) ids[s.id] = id
    }

    /** Loads the barks of the Hobs in play ([defs] are content ids). */
    fun preloadBarks(defs: Collection<String>) {
        h.post { for (d in defs) { val pre = "bark_${Cues.barkKey(d)}_"; for (s in manifest.sounds.values) if (s.id.startsWith(pre)) load(s) } }
    }

    private fun read(p: String): String? = try { ctx.assets.open(p).bufferedReader().use { it.readText() } } catch (e: Exception) { null }
    private fun path(s: SoundDef): String = if (useOgg) s.file else s.file.removeSuffix(".ogg") + ".m4a"

    /**
     * Any tap anywhere (MainActivity). The first one on a first launch opens the sound
     * (review 2 N-H2): the title jingle plays and the music that was asked for starts.
     */
    fun tap() {
        if (released || !gate.tap()) return
        h.post { playNow("mus_title_jingle", 0f, 1f, 0f); startMusic(); applyLoops() }
    }

    private fun slider(bus: String): Float {
        if (settings.muteAll) return 0f
        return when (manifest.busSlider[bus] ?: "Sound") { "Music" -> settings.music; "Voices" -> settings.voices; else -> settings.sound } / 100f
    }

    /**
     * Plays a sound once. [pan] -1 left to 1 right, [semis] a pitch shift on top of the
     * sound's random spread. Returns at once; the sound starts on the audio thread.
     */
    fun play(id: String, pan: Float = 0f, gain: Float = 1f, semis: Float = 0f) {
        if (released || !gate.open || !foreground) return
        h.post { playNow(id, pan, gain, semis) }
    }

    private fun playNow(id: String, pan: Float, gain: Float, semis: Float): Int {
        if (noisy) return 0
        val s = manifest[id] ?: return 0
        val pid = ids[id] ?: return 0
        if (pid !in ready) return 0
        val now = SystemClock.uptimeMillis()
        // At most 3 of one sound within 50 ms.
        val r = recent.getOrPut(id) { LongArray(3) { -1000L } }
        if (now - r.min() < 50) return 0
        r[r.indexOf(r.min())] = now
        val v = (s.volume * gain * slider(s.bus) * focus.effects).coerceIn(0f, 1f)
        if (v <= 0f) return 0
        var sh = semis
        if (s.pitchVar > 0f) sh += (rnd.nextFloat() * 2f - 1f) * s.pitchVar
        if (slowMo) sh -= 3f
        val rate = 2f.pow(sh / 12f).coerceIn(0.5f, 2f)
        val p = (pan * 0.6f).coerceIn(-0.6f, 0.6f)
        val l = v * min(1f, 1f - p); val rr = v * min(1f, 1f + p)
        if (s.bus == "impact" && id != "hit_blast_tiny") impactAt = now
        return pool.play(pid, l, rr, AudioRules.priority(s.bus, id), 0, rate)
    }

    // ---- loops ----------------------------------------------------------------

    private val loopWants = LoopWants()
    private val loopTracks = HashMap<String, LoopTrack>()
    private val loopPcm = HashMap<String, Pcm>()
    private var retryPosted = false

    /** Starts, updates or stops a looping sound (wind bed, Squall, whistle, aim band). */
    fun loop(id: String, on: Boolean, gain: Float = 1f, semis: Float = 0f) {
        if (released) return
        h.post {
            loopWants.set(id, on, gain, semis)
            if (!on) loopTracks[id]?.stop()
            applyLoops()
        }
    }

    fun stopLoops() { h.post { loopWants.clear(); stopLoopTracks() } }

    private fun stopLoopTracks() { for (t in loopTracks.values) t.stop(); for (id in loopWants.all()) loopWants.started(id, false) }

    /** Audio thread: plays every wanted loop that can play now; a loop that cannot start is tried again shortly. */
    private fun applyLoops() {
        if (released) return
        val can = gate.open && foreground && !gamePaused && !noisy
        if (!can) { stopLoopTracks(); return }
        for (id in loopWants.all()) {
            val w = loopWants[id] ?: continue
            val s = manifest[id] ?: continue
            val t = loopTracks[id] ?: loopTrackFor(s)
            val v = (s.volume * w.gain * slider(s.bus) * focus.effects).coerceIn(0f, 1f)
            val ok = t?.play(v, 2f.pow(w.semis / 12f)) ?: false
            if (!ok && t != null) { t.release(); loopTracks.remove(id) } // dead track: make a new one next time
            loopWants.started(id, ok)
        }
        if (loopWants.pending().isNotEmpty() && !retryPosted) {
            retryPosted = true
            h.postDelayed({ retryPosted = false; applyLoops() }, 500)
        }
    }

    private fun loopTrackFor(s: SoundDef): LoopTrack? {
        val pcm = loopPcm[s.id] ?: try {
            ctx.assets.openFd("audio/" + path(s)).use { PcmDecoder.decode(it, s.frames(SAMPLE_RATE)) }
        } catch (e: Exception) { null }?.also { loopPcm[s.id] = it } ?: return null
        return try { LoopTrack(pcm).also { loopTracks[s.id] = it } } catch (e: Exception) { Log.w(TAG, "loop ${s.id}", e); null }
    }

    /**
     * A Hob bark (07 section 9.4): one per side per turn step, 1.5 s apart, 40% of the time
     * except Bonks and wins. [say] gets the subtitle line, which shows even with Voices at 0.
     */
    fun bark(hobDef: String, event: String, side: Int, turn: Int, pan: Float, say: (String) -> Unit) {
        if (released || !gate.open) return
        h.post {
            val now = SystemClock.uptimeMillis()
            val always = event == "bonked" || event == "win"
            if (!always) {
                if (now - barkAt < 1500) return@post
                if (side in 0..1 && barkTurn[side] == turn) return@post
                if (rnd.nextFloat() > (barks.chance[event] ?: 0.4f)) return@post
            }
            val id = "bark_${Cues.barkKey(hobDef)}_$event"
            val s = manifest[id] ?: return@post
            // The music ducks only for a bark that can be heard (review 2 N-L7).
            if (slider(s.bus) > 0f) barkAt = now
            if (side in 0..1) barkTurn[side] = turn
            playNow(id, pan, 1f, 0f)
            val lines = barks.lines[id].orEmpty()
            if (lines.isNotEmpty()) {
                // A random line with no repeat of the last one.
                var i = rnd.nextInt(lines.size)
                if (lines.size > 1 && i == lastSub[id]) i = (i + 1) % lines.size
                lastSub[id] = i
                say(lines[i])
            }
        }
    }

    // ---- music -------------------------------------------------------------

    private val musicThread = HandlerThread("castle-music-load").also { it.start() }
    private val mh = Handler(musicThread.looper)
    private val engine = MusicEngine { musicGain() }
    /** The music asked for: key, ids, base level. Kept while sound is locked, so it starts on the first tap. */
    @Volatile private var musicKey = ""
    private var musicIds: List<String> = emptyList()
    private var musicLevel = 1f
    private var loadedKey = ""
    /** Decoded music sets, the current and the one before (map and battle), dropped on a memory trim. */
    private val decoded = LinkedHashMap<String, List<Pcm>>()

    /** Map, menus and pre-battle. [quiet] after a loss. */
    fun menuMusic(quiet: Boolean = false) = music("map", listOf("mus_map"), if (quiet) 0.5f else 1f)

    /** A Region 1 battle: Base on, Stir and Peril silent, all three on the same sample. */
    fun battleMusic() = music("r1", listOf("mus_r1_base", "mus_r1_stir", "mus_r1_peril"), 1f)

    fun stopMusic() { h.post { musicKey = ""; loadedKey = ""; engine.set(null, SAMPLE_RATE) } }

    /** The win or lose sting; the layers stop first. */
    fun sting(win: Boolean) {
        h.post { musicKey = ""; loadedKey = ""; engine.set(null, SAMPLE_RATE); playNow(if (win) "sting_win" else "sting_lose", 0f, 1f, 0f) }
    }

    /** Fades Stir and Peril in or out on the next bar line, over one bar. */
    fun setLayers(stir: Boolean, peril: Boolean) {
        h.post {
            if (loadedKey != "r1") return@post
            val bar = ((manifest["mus_r1_base"]?.barS ?: 1f) * SAMPLE_RATE).toInt().coerceAtLeast(SAMPLE_RATE / 5)
            engine.withMix { m ->
                val at = m.nextBar(bar)
                if (m.target(1) != (if (stir) 1f else 0f)) m.fade(1, if (stir) 1f else 0f, at, bar.toLong())
                if (m.target(2) != (if (peril) 1f else 0f)) m.fade(2, if (peril) 1f else 0f, at, bar.toLong())
            }
        }
    }

    /** A screen change asks for music: a player action, so it may take focus back and lifts the headphone mute. */
    private fun music(key: String, ids: List<String>, level: Float) {
        h.post {
            if (released) return@post
            noisy = false
            val same = musicKey == key
            musicKey = key; musicIds = ids; musicLevel = level
            if (same && loadedKey == key) {
                engine.withMix { m -> m.fade(0, level, m.played, (0.6f * SAMPLE_RATE).toLong()) }
                ensureFocus(true); applyMusic()
                return@post
            }
            startMusic()
        }
    }

    /** Audio thread: loads the wanted music (on the loader thread) and starts it. */
    private fun startMusic() {
        if (!gate.open || musicKey.isEmpty()) { applyMusic(); return }
        val key = musicKey; val ids = musicIds; val level = musicLevel
        val defs = ids.mapNotNull { manifest[it] }
        engine.set(null, SAMPLE_RATE); loadedKey = ""
        mh.post {
            val pcms = synchronized(decoded) { decoded[key] } ?: defs.map { d ->
                try { ctx.assets.openFd("audio/" + path(d)).use { PcmDecoder.decode(it, d.frames(SAMPLE_RATE)) } } catch (e: Exception) { null }
            }.takeIf { l -> l.isNotEmpty() && l.all { it != null } }?.map { it!! }
            if (pcms == null) { Log.w(TAG, "music $key could not be decoded"); return@post }
            synchronized(decoded) { decoded[key] = pcms; while (decoded.size > 2) decoded.remove(decoded.keys.first()) }
            h.post {
                if (released || musicKey != key) return@post
                val mix = LayerMix(pcms.map { LayerMix.Layer(it.data, it.channels) })
                mix.fade(0, level, 0, (0.4f * SAMPLE_RATE).toLong())
                engine.set(mix, pcms[0].rate)
                loadedKey = key
                ensureFocus(true)
                applyMusic()
            }
        }
    }

    /** Drops decoded music that is not playing (a memory trim). */
    fun trim() { h.post { synchronized(decoded) { decoded.keys.retainAll(setOf(loadedKey)) }; loopPcm.clear() } }

    private fun applyMusic() {
        engine.play(gate.open && foreground && !gamePaused && !noisy && focus.music > 0f && loadedKey.isNotEmpty())
    }

    /** Music thread: the music bus gain now (slider, focus, ducking). */
    private fun musicGain(): Float = slider("music") * focus.music * duck(SystemClock.uptimeMillis())

    /** Music gain under impacts (-6 dB, 30 ms attack, 400 ms release) and barks (-3 dB). */
    private fun duck(now: Long): Float {
        val dt = now - impactAt
        val impact = when {
            dt < 0 -> 1f
            dt < 30 -> 1f - 0.5f * dt / 30f
            dt < 430 -> 0.5f + 0.5f * (dt - 30) / 400f
            else -> 1f
        }
        val bark = if (now - barkAt < 1200) 0.708f else 1f
        return min(impact, bark)
    }

    // ---- focus and lifecycle ------------------------------------------------

    private fun ensureFocus(playerAction: Boolean) {
        if (focusReq == null || am == null) return
        val wanted = loadedKey.isNotEmpty() && AudioRules.wantsFocus(settings.muteAll, settings.music)
        if (!wanted) { if (focus.held) abandonFocus(); return }
        if (!focus.shouldRequest(true, playerAction)) return
        val r = try { am.requestAudioFocus(focusReq) } catch (e: Exception) { AudioManager.AUDIOFOCUS_REQUEST_FAILED }
        focus.onRequest(r)
    }

    private fun abandonFocus() {
        if (!focus.held || focusReq == null || am == null) return
        try { am.abandonAudioFocusRequest(focusReq) } catch (e: Exception) { }
        focus.onAbandon()
    }

    private fun onFocus(change: Int) {
        focus.onChange(change)
        applyMusic()
        applyLoops()
        if (focus.effects <= 0f) pool.autoPause() else pool.autoResume()
    }

    /** The Pause card went up or down (07 section 8.3: music and loops resume only on Resume). */
    fun setPaused(p: Boolean) {
        gamePaused = p
        h.post {
            if (!p) { noisy = false; ensureFocus(true) }
            applyMusic(); applyLoops()
        }
    }

    fun onStart() {
        foreground = true
        h.post {
            pool.autoResume()
            if (!noisyOn) try { ContextCompat.registerReceiver(ctx, noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED); noisyOn = true } catch (e: Exception) { }
            if (!gamePaused) ensureFocus(true)
            applyMusic(); applyLoops()
        }
    }

    fun onStop() {
        foreground = false
        h.post {
            pool.autoPause()
            stopLoopTracks()
            applyMusic()
            abandonFocus()
            if (noisyOn) { try { ctx.unregisterReceiver(noisyReceiver) } catch (e: Exception) { }; noisyOn = false }
        }
    }

    fun release() {
        released = true
        h.post {
            try {
                engine.release()
                for (t in loopTracks.values) t.release()
                loopTracks.clear()
                abandonFocus()
                if (noisyOn) try { ctx.unregisterReceiver(noisyReceiver) } catch (e: Exception) { }
            } finally {
                pool.release()
                musicThread.quitSafely()
                thread.quitSafely()
            }
        }
    }

    companion object {
        private const val TAG = "CastleAudio"
        const val SAMPLE_RATE = 48000
    }
}

package games.castleprotect.game

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.SoundPool
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

/**
 * All game sound, from assets/audio/audio.json (assets/audio/README.md, docs/design/07
 * section 9).
 *
 * - Effects, barks and stings: one SoundPool (16 voices, at most 3 of one sound in
 *   50 ms, kettle sounds never stolen), with each sound's volume and pitch spread, the
 *   bus sliders (Sound, Music, Voices) and stereo pan from the field position.
 * - Music: MediaPlayer per track. The three Region 1 layers start on the same sample
 *   and stay in sync (a drift check re-seeks a layer that wanders more than 40 ms);
 *   a layer fades in or out over one bar, starting on the next bar line.
 * - Ducking: an impact pulls the music down 6 dB (30 ms attack, 400 ms release), a
 *   bark 3 dB.
 * - Audio focus: music asks for focus; a loss pauses it and mutes effects, a duck
 *   lowers it, a gain brings it back. Leaving the app pauses everything.
 * - No sound before the Play tap on the first launch ([unlock]).
 *
 * Opus in Ogg plays on Android 10 and later; older phones get the AAC (.m4a) copies.
 * All work runs on one audio thread; the public calls only post to it.
 */
class Audio(private val ctx: Context, private val settings: Settings) {
    private val thread = HandlerThread("castle-audio").also { it.start() }
    private val h = Handler(thread.looper)
    @Volatile var manifest: AudioManifest = AudioManifest.EMPTY
        private set
    @Volatile var barks: BarkLines = BarkLines.EMPTY
        private set
    private val pool = SoundPool.Builder().setMaxStreams(16)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .build()
    private val ids = HashMap<String, Int>()
    private val ready = HashSet<Int>()
    private val recent = HashMap<String, LongArray>()
    private val loops = HashMap<String, Int>()
    private val rnd = Random(SystemClock.uptimeMillis())
    private val useOgg = Build.VERSION.SDK_INT >= 29
    @Volatile private var released = false
    /** False until the first Play tap on a first launch. */
    @Volatile var unlocked = settings.seenIntro
        private set
    @Volatile private var foreground = true
    /** Audio focus: 1 normal, 0.3 ducked by another app, 0 lost. */
    @Volatile private var focusGain = 1f
    private var hasFocus = false
    /** View slow motion: new sounds drop 3 semitones. */
    @Volatile var slowMo = false
    private var impactAt = -10_000L
    private var barkAt = -10_000L
    private val barkTurn = IntArray(2) { -1 }
    private var lastSub = HashMap<String, Int>()

    private val am = ctx.getSystemService(AudioManager::class.java)
    private val focusReq: AudioFocusRequest? = try {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener({ change -> onFocus(change) }, h)
            .setWillPauseWhenDucked(false)
            .build()
    } catch (e: Exception) { null }

    init {
        pool.setOnLoadCompleteListener { _, id, status -> if (status == 0) h.post { ready.add(id) } }
        h.post {
            manifest = AudioManifest.parse(read("audio/audio.json"))
            barks = BarkLines.parse(read("audio/barks.json"))
            for (s in manifest.sounds.values) {
                if (released) return@post
                if (s.kind == "music") continue
                val id = try { ctx.assets.openFd("audio/" + path(s)).use { pool.load(it, 1) } } catch (e: Exception) { 0 }
                if (id != 0) ids[s.id] = id
            }
        }
    }

    private fun read(p: String): String? = try { ctx.assets.open(p).bufferedReader().use { it.readText() } } catch (e: Exception) { null }
    private fun path(s: SoundDef): String = if (useOgg) s.file else s.file.removeSuffix(".ogg") + ".m4a"

    /** The first Play tap on a first launch: sound may start now. */
    fun unlock() { if (!unlocked) { unlocked = true; play("mus_title_jingle") } }

    private fun slider(bus: String): Float {
        if (settings.muteAll) return 0f
        return when (manifest.busSlider[bus] ?: "Sound") { "Music" -> settings.music; "Voices" -> settings.voices; else -> settings.sound } / 100f
    }

    /**
     * Plays a sound once. [pan] -1 left to 1 right, [semis] a pitch shift on top of the
     * sound's random spread. Returns at once; the sound starts on the audio thread.
     */
    fun play(id: String, pan: Float = 0f, gain: Float = 1f, semis: Float = 0f) {
        if (released || !unlocked || !foreground) return
        h.post { playNow(id, pan, gain, semis, false) }
    }

    private fun playNow(id: String, pan: Float, gain: Float, semis: Float, loop: Boolean): Int {
        val s = manifest[id] ?: return 0
        val pid = ids[id] ?: return 0
        if (pid !in ready) return 0
        val now = SystemClock.uptimeMillis()
        if (!loop) {
            // At most 3 of one sound within 50 ms.
            val r = recent.getOrPut(id) { LongArray(3) { -1000L } }
            if (now - r.min() < 50) return 0
            r[r.indexOf(r.min())] = now
        }
        val v = (s.volume * gain * slider(s.bus) * focusGain).coerceIn(0f, 1f)
        if (v <= 0f && !loop) return 0
        var sh = semis
        if (s.pitchVar > 0f) sh += (rnd.nextFloat() * 2f - 1f) * s.pitchVar
        if (slowMo) sh -= 3f
        val rate = 2f.pow(sh / 12f).coerceIn(0.5f, 2f)
        val p = (pan * 0.6f).coerceIn(-0.6f, 0.6f)
        val l = v * min(1f, 1f - p); val rr = v * min(1f, 1f + p)
        if (s.bus == "impact" && id != "hit_blast_tiny") impactAt = now
        val prio = if (s.bus == "kettle") 2 else 1
        return pool.play(pid, l, rr, prio, if (loop) -1 else 0, rate)
    }

    /** Starts, updates or stops a looping sound (wind bed, Squall, whistle, aim band). */
    fun loop(id: String, on: Boolean, gain: Float = 1f, semis: Float = 0f) {
        if (released) return
        h.post {
            val cur = loops[id]
            if (!on || !unlocked || !foreground) { if (cur != null) { pool.stop(cur); loops.remove(id) }; return@post }
            val s = manifest[id] ?: return@post
            val v = (s.volume * gain * slider(s.bus) * focusGain).coerceIn(0f, 1f)
            val rate = 2f.pow(semis / 12f).coerceIn(0.5f, 2f)
            if (cur == null || cur == 0) { val sid = playNow(id, 0f, gain, semis, true); if (sid != 0) loops[id] = sid }
            else { pool.setVolume(cur, v, v); pool.setRate(cur, rate) }
        }
    }

    fun stopLoops() { h.post { for (s in loops.values) pool.stop(s); loops.clear() } }

    /**
     * A Hob bark (07 section 9.4): one per side per turn step, 1.5 s apart, 40% of the time
     * except Bonks and wins. [say] gets the subtitle line, which shows even with Voices at 0.
     */
    fun bark(hobDef: String, event: String, side: Int, turn: Int, pan: Float, say: (String) -> Unit) {
        if (released || !unlocked) return
        h.post {
            val now = SystemClock.uptimeMillis()
            val always = event == "bonked" || event == "win"
            if (!always) {
                if (now - barkAt < 1500) return@post
                if (side in 0..1 && barkTurn[side] == turn) return@post
                if (rnd.nextFloat() > (barks.chance[event] ?: 0.4f)) return@post
            }
            val id = "bark_${Cues.barkKey(hobDef)}_$event"
            if (manifest[id] == null) return@post
            barkAt = now
            if (side in 0..1) barkTurn[side] = turn
            playNow(id, pan, 1f, 0f, false)
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

    private inner class Track(val def: SoundDef, val mp: MediaPlayer) {
        var gain = 0f
        var from = 0f
        var target = 0f
        var fadeAt = 0L
        var fadeMs = 1L
    }

    private val tracks = ArrayList<Track>()
    private var musicKey = ""
    private var ticking = false

    /** Map, menus and pre-battle. [quiet] after a loss. */
    fun menuMusic(quiet: Boolean = false) = music("map", listOf("mus_map"), if (quiet) 0.5f else 1f)

    /** A Region 1 battle: Base on, Stir and Peril silent, all three on the same sample. */
    fun battleMusic() = music("r1", listOf("mus_r1_base", "mus_r1_stir", "mus_r1_peril"), 1f)

    fun stopMusic() { h.post { stopTracks(); musicKey = "" } }

    /** The win or lose sting; the layers stop first. */
    fun sting(win: Boolean) {
        h.post { stopTracks(); musicKey = ""; playNow(if (win) "sting_win" else "sting_lose", 0f, 1f, 0f, false) }
    }

    /** Fades Stir and Peril in or out on the next bar line, over one bar. */
    fun setLayers(stir: Boolean, peril: Boolean) {
        h.post {
            if (musicKey != "r1" || tracks.size < 3) return@post
            val base = tracks[0]
            val barMs = (base.def.barS * 1000f).toLong().coerceAtLeast(200L)
            val pos = try { base.mp.currentPosition.toLong() } catch (e: IllegalStateException) { 0L }
            val wait = barMs - pos % barMs
            val now = SystemClock.uptimeMillis()
            for ((i, on) in listOf(1 to stir, 2 to peril)) {
                val t = tracks[i]
                val want = if (on) 1f else 0f
                if (t.target == want) continue
                t.from = t.gain; t.target = want; t.fadeAt = now + wait; t.fadeMs = barMs
            }
        }
    }

    private fun music(key: String, ids: List<String>, level: Float) {
        h.post {
            if (released) return@post
            if (musicKey == key) { tracks.firstOrNull()?.let { it.target = level; it.from = it.gain; it.fadeAt = SystemClock.uptimeMillis(); it.fadeMs = 600 }; return@post }
            stopTracks()
            musicKey = key
            if (!unlocked) return@post
            val made = ArrayList<Track>()
            for ((i, id) in ids.withIndex()) {
                val s = manifest[id] ?: continue
                val mp = try {
                    MediaPlayer().apply {
                        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                        ctx.assets.openFd("audio/" + path(s)).use { setDataSource(it.fileDescriptor, it.startOffset, it.length) }
                        isLooping = true
                        setVolume(0f, 0f)
                        prepare()
                    }
                } catch (e: Exception) { Log.w(TAG, "music $id", e); null } ?: continue
                val t = Track(s, mp)
                t.target = if (i == 0) level else 0f
                t.from = 0f; t.fadeAt = SystemClock.uptimeMillis(); t.fadeMs = if (i == 0) 400 else 1
                made.add(t)
            }
            tracks.addAll(made)
            requestFocus()
            if (foreground && focusGain > 0f) for (t in tracks) try { t.mp.start() } catch (e: IllegalStateException) { }
            startTicker()
        }
    }

    private fun stopTracks() {
        for (t in tracks) try { t.mp.stop(); t.mp.release() } catch (e: Exception) { }
        tracks.clear()
    }

    private fun startTicker() {
        if (ticking) return
        ticking = true
        h.post(object : Runnable {
            var lastSync = 0L
            override fun run() {
                if (released || tracks.isEmpty()) { ticking = false; return }
                val now = SystemClock.uptimeMillis()
                val bus = slider("music") * focusGain * duck(now)
                for (t in tracks) {
                    if (now >= t.fadeAt) {
                        val u = ((now - t.fadeAt).toFloat() / t.fadeMs).coerceIn(0f, 1f)
                        t.gain = t.from + (t.target - t.from) * u
                    }
                    val v = (t.gain * t.def.volume * bus).coerceIn(0f, 1f)
                    try { t.mp.setVolume(v, v) } catch (e: IllegalStateException) { }
                }
                // Keep the layers on the base layer's sample (drift over 40 ms is re-seeked).
                if (tracks.size > 1 && now - lastSync > 2000) {
                    lastSync = now
                    try {
                        val base = tracks[0].mp.currentPosition
                        val len = (tracks[0].def.durationS * 1000).toInt()
                        if (base in 200 until len - 500) for (i in 1 until tracks.size) {
                            val p = tracks[i].mp.currentPosition
                            if (abs(p - base) > 40) tracks[i].mp.seekTo(base.toLong() + 15, MediaPlayer.SEEK_CLOSEST)
                        }
                    } catch (e: IllegalStateException) { }
                }
                h.postDelayed(this, 33)
            }
        })
    }

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

    private fun requestFocus() {
        if (hasFocus || focusReq == null || am == null) return
        val r = try { am.requestAudioFocus(focusReq) } catch (e: Exception) { AudioManager.AUDIOFOCUS_REQUEST_FAILED }
        hasFocus = r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonFocus() {
        if (!hasFocus || focusReq == null || am == null) return
        try { am.abandonAudioFocusRequest(focusReq) } catch (e: Exception) { }
        hasFocus = false
    }

    private fun onFocus(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> { hasFocus = false; focusGain = 0f; pauseAll() }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> { focusGain = 0f; pauseAll() }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> focusGain = 0.3f
            AudioManager.AUDIOFOCUS_GAIN -> { hasFocus = true; focusGain = 1f; resumeAll() }
        }
    }

    private fun pauseAll() {
        for (t in tracks) try { if (t.mp.isPlaying) t.mp.pause() } catch (e: IllegalStateException) { }
        pool.autoPause()
    }

    private fun resumeAll() {
        if (!foreground) return
        // Restart the layers together, re-seeked to the base layer's place.
        val base = tracks.firstOrNull()?.let { try { it.mp.currentPosition } catch (e: IllegalStateException) { 0 } } ?: 0
        for ((i, t) in tracks.withIndex()) try { if (i > 0) t.mp.seekTo(base.toLong(), MediaPlayer.SEEK_CLOSEST); t.mp.start() } catch (e: IllegalStateException) { }
        pool.autoResume()
        startTicker()
    }

    fun onStart() { foreground = true; h.post { if (tracks.isNotEmpty()) { requestFocus(); if (focusGain > 0f) resumeAll() } } }

    fun onStop() {
        foreground = false
        h.post { pauseAll(); for (s in loops.values) pool.stop(s); loops.clear(); abandonFocus() }
    }

    fun release() {
        released = true
        h.post {
            stopTracks()
            abandonFocus()
            pool.release()
            thread.quitSafely()
        }
    }

    companion object { private const val TAG = "CastleAudio" }
}

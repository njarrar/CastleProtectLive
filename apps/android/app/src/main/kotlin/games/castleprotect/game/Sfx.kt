package games.castleprotect.game

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

/**
 * Sound effects through SoundPool. A cue plays the file assets/audio/<cue>.(ogg|wav)
 * when the shared assets folder ships one; otherwise a small tone generated once
 * into the cache folder, so v0.1 has sound before the real effects exist.
 */
class Sfx(private val ctx: Context, private val settings: Settings) {
    private val pool = SoundPool.Builder().setMaxStreams(8)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .build()
    private val ids = HashMap<String, Int>()
    @Volatile private var released = false

    private class Tone(val f0: Float, val f1: Float, val ms: Int, val noise: Float, val decay: Float)
    private val tones = mapOf(
        "fire" to Tone(220f, 90f, 260, 0.35f, 9f),
        "thud" to Tone(110f, 50f, 320, 0.6f, 8f),
        "break" to Tone(160f, 60f, 420, 0.85f, 6f),
        "kettle" to Tone(880f, 1320f, 380, 0.1f, 6f),
        "bonk" to Tone(520f, 260f, 240, 0.05f, 10f),
        "turn" to Tone(660f, 880f, 160, 0f, 12f),
        "pick" to Tone(740f, 990f, 90, 0f, 18f),
        "tick" to Tone(1200f, 1200f, 30, 0f, 40f),
        "walk" to Tone(90f, 70f, 80, 0.5f, 20f),
        "squall" to Tone(300f, 120f, 700, 0.7f, 3f),
        "win" to Tone(523f, 1047f, 700, 0f, 3f),
        "lose" to Tone(392f, 196f, 700, 0f, 3f),
    )

    init {
        Thread({
            val bundled = try { ctx.assets.list("audio")?.toSet() ?: emptySet() } catch (e: Exception) { emptySet() }
            for ((cue, tone) in tones) {
                if (released) return@Thread
                val hit = listOf("$cue.ogg", "$cue.wav").firstOrNull { it in bundled }
                synchronized(ids) {
                    // Loading and release() never overlap (review L10).
                    if (released) return@Thread
                    val id = try {
                        if (hit != null) ctx.assets.openFd("audio/$hit").use { pool.load(it, 1) }
                        else pool.load(synth(cue, tone).absolutePath, 1)
                    } catch (e: Exception) { 0 }
                    ids[cue] = id
                }
            }
        }, "sfx-load").start()
    }

    /** pan: -1 left to 1 right. */
    fun play(cue: String, pan: Float = 0f, gain: Float = 1f) {
        if (released || settings.muteAll || settings.sound == 0) return
        val id = synchronized(ids) { ids[cue] } ?: return
        if (id == 0) return
        val v = settings.sound / 100f * gain
        pool.play(id, v * (1f - pan.coerceIn(0f, 1f) * 0.6f), v * (1f + pan.coerceIn(-1f, 0f) * 0.6f), 1, 0, 1f)
    }

    fun release() { synchronized(ids) { released = true; pool.release() } }

    private fun synth(cue: String, t: Tone): File {
        // The file name carries the tone's values, so a changed tone table makes a new file.
        val f = File(ctx.cacheDir, "sfx_${cue}_${(t.f0 + 7 * t.f1 + 13 * t.ms + 17 * t.noise + 19 * t.decay).toBits().toString(16)}.wav")
        if (f.exists() && f.length() > 44) return f
        val rate = 22050
        val n = rate * t.ms / 1000
        val buf = ByteBuffer.allocate(44 + n * 2).order(ByteOrder.LITTLE_ENDIAN)
        buf.put("RIFF".toByteArray()).putInt(36 + n * 2).put("WAVE".toByteArray()).put("fmt ".toByteArray())
            .putInt(16).putShort(1).putShort(1).putInt(rate).putInt(rate * 2).putShort(2).putShort(16)
            .put("data".toByteArray()).putInt(n * 2)
        val rnd = Random(cue.hashCode())
        var phase = 0.0
        for (i in 0 until n) {
            val u = i / n.toFloat()
            val freq = t.f0 + (t.f1 - t.f0) * u
            phase += 2 * PI * freq / rate
            val env = exp(-t.decay * u) * minOf(1f, i / 60f)
            val s = (sin(phase).toFloat() * (1 - t.noise) + (rnd.nextFloat() * 2 - 1) * t.noise) * env
            buf.putShort((s * 0.8f * Short.MAX_VALUE).toInt().toShort())
        }
        f.writeBytes(buf.array())
        return f
    }
}

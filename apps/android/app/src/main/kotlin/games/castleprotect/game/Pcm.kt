package games.castleprotect.game

import android.content.res.AssetFileDescriptor
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import java.nio.ByteOrder

/** 16 bit PCM decoded from a sound file. */
class Pcm(val data: ShortArray, val channels: Int, val rate: Int) {
    val frames: Int get() = data.size / channels
}

/**
 * Decodes a whole sound to PCM with MediaExtractor and MediaCodec, then keeps exactly the
 * manifest's `samples` frames after the encoder delay ([AudioRules.window]), so a loop of
 * it has no gap on any Android version (review 2 N-M7).
 */
object PcmDecoder {
    private const val TAG = "CastlePcm"

    fun decode(afd: AssetFileDescriptor, wantFrames: Int): Pcm? {
        val ex = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            ex.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            var track = -1
            for (i in 0 until ex.trackCount) if (ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) { track = i; break }
            if (track < 0) return null
            ex.selectTrack(track)
            val fmt = ex.getTrackFormat(track)
            val mime = fmt.getString(MediaFormat.KEY_MIME) ?: return null
            var channels = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var rate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val delay = if (fmt.containsKey("encoder-delay")) fmt.getInteger("encoder-delay") else null
            val c = MediaCodec.createDecoderByType(mime)
            codec = c
            c.configure(fmt, null, null, 0)
            c.start()
            var out = ShortArray(maxOf(4096, (wantFrames + 4096) * channels))
            var n = 0
            val info = MediaCodec.BufferInfo()
            var inDone = false
            var guard = 0
            while (guard++ < 200_000) {
                if (!inDone) {
                    val i = c.dequeueInputBuffer(5000)
                    if (i >= 0) {
                        val buf = c.getInputBuffer(i) ?: return null
                        val size = ex.readSampleData(buf, 0)
                        if (size < 0) { c.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true }
                        else { c.queueInputBuffer(i, 0, size, ex.sampleTime, 0); ex.advance() }
                    }
                }
                val o = c.dequeueOutputBuffer(info, 5000)
                if (o >= 0) {
                    val b = c.getOutputBuffer(o)
                    if (b != null && info.size > 0) {
                        b.position(info.offset); b.limit(info.offset + info.size)
                        val sb = b.order(ByteOrder.nativeOrder()).asShortBuffer()
                        val k = sb.remaining()
                        if (n + k > out.size) out = out.copyOf(maxOf(out.size * 2, n + k))
                        sb.get(out, n, k); n += k
                    }
                    c.releaseOutputBuffer(o, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                } else if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    val nf = c.outputFormat
                    channels = nf.getInteger(MediaFormat.KEY_CHANNEL_COUNT); rate = nf.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                }
            }
            if (channels <= 0 || n == 0) return null
            val w = AudioRules.window(n / channels, wantFrames, delay, mime == MediaFormat.MIMETYPE_AUDIO_AAC)
            return Pcm(out.copyOfRange(w[0] * channels, (w[0] + w[1]) * channels), channels, rate)
        } catch (e: Exception) {
            Log.w(TAG, "decode", e); return null
        } catch (e: OutOfMemoryError) {
            Log.w(TAG, "decode: out of memory"); return null
        } finally {
            try { codec?.stop() } catch (e: Exception) { }
            try { codec?.release() } catch (e: Exception) { }
            ex.release()
        }
    }

    fun attributes(music: Boolean): AudioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(if (music) AudioAttributes.CONTENT_TYPE_MUSIC else AudioAttributes.CONTENT_TYPE_SONIFICATION).build()

    fun format(rate: Int, channels: Int): AudioFormat = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate)
        .setChannelMask(if (channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO).build()
}

/**
 * A world loop (wind bed, Squall, flight whistle, aim band) on its own static AudioTrack
 * that loops by sample count. Loops are not in the SoundPool, so a burst of impacts can
 * never steal them (review 2 N-M14), and they have no AAC gap on Android 8 and 9.
 */
class LoopTrack(private val pcm: Pcm) {
    private val track: AudioTrack = AudioTrack.Builder()
        .setAudioAttributes(PcmDecoder.attributes(false))
        .setAudioFormat(PcmDecoder.format(pcm.rate, pcm.channels))
        .setBufferSizeInBytes(pcm.data.size * 2)
        .setTransferMode(AudioTrack.MODE_STATIC)
        .build().also { t -> t.write(pcm.data, 0, pcm.data.size); t.setLoopPoints(0, pcm.frames, -1) }
    var playing = false
        private set

    /** Starts or updates the loop at [volume] and a pitch of [rate] times. Returns false when the track is dead. */
    fun play(volume: Float, rate: Float): Boolean = try {
        track.setVolume(volume.coerceIn(0f, 1f))
        track.playbackRate = (pcm.rate * rate.coerceIn(0.5f, 2f)).toInt()
        if (!playing) { track.play(); playing = true }
        track.playState == AudioTrack.PLAYSTATE_PLAYING
    } catch (e: IllegalStateException) { false }

    fun stop() {
        if (!playing) return
        playing = false
        try { track.stop(); track.reloadStaticData(); track.setLoopPoints(0, pcm.frames, -1) } catch (e: IllegalStateException) { }
    }

    fun release() { try { track.release() } catch (e: Exception) { } }
}

/**
 * Music: one streaming AudioTrack fed by a [LayerMix] on its own thread (review 2 N-M7).
 * [master] is read for every block (about 21 ms), so sliders, focus and ducking apply at
 * once. All calls are thread safe.
 */
class MusicEngine(private val master: () -> Float) {
    private val lock = Object()
    private var mix: LayerMix? = null
    private var track: AudioTrack? = null
    private var trackRate = 0
    private var playing = false
    @Volatile private var released = false
    private val buf = ShortArray(BLOCK * 2)
    private val thread = Thread({ run() }, "castle-music").also { it.priority = Thread.MAX_PRIORITY; it.start() }

    /** Swaps in a new mix (or none). */
    fun set(m: LayerMix?, rate: Int) {
        synchronized(lock) {
            mix = m
            if (m != null && (track == null || trackRate != rate)) {
                track?.release()
                track = try {
                    val min = AudioTrack.getMinBufferSize(rate, android.media.AudioFormat.CHANNEL_OUT_STEREO, android.media.AudioFormat.ENCODING_PCM_16BIT)
                    AudioTrack.Builder().setAudioAttributes(PcmDecoder.attributes(true)).setAudioFormat(PcmDecoder.format(rate, 2))
                        .setBufferSizeInBytes(maxOf(min, BLOCK * 4) * 2).setTransferMode(AudioTrack.MODE_STREAM).build()
                } catch (e: Exception) { null }
                trackRate = rate
                if (playing) try { track?.play() } catch (e: IllegalStateException) { }
            }
            if (m == null) try { track?.pause(); track?.flush() } catch (e: IllegalStateException) { }
            lock.notifyAll()
        }
    }

    /** Runs [fn] on the current mix under the lock (fades, layer changes). */
    fun <T> withMix(fn: (LayerMix) -> T): T? = synchronized(lock) { mix?.let(fn) }

    val hasMix: Boolean get() = synchronized(lock) { mix != null }

    fun play(on: Boolean) {
        synchronized(lock) {
            if (on == playing) return
            playing = on
            try { if (on) track?.play() else track?.pause() } catch (e: IllegalStateException) { }
            lock.notifyAll()
        }
    }

    fun release() {
        released = true
        synchronized(lock) { lock.notifyAll() }
        thread.interrupt()
        try { thread.join(500) } catch (e: InterruptedException) { }
        synchronized(lock) { track?.release(); track = null; mix = null }
    }

    private fun run() {
        while (!released) {
            var cur: AudioTrack? = null
            synchronized(lock) {
                while (!released && (!playing || mix == null || track == null)) try { lock.wait() } catch (e: InterruptedException) { if (released) return }
                if (released) return
                cur = track
                mix?.mix(buf, BLOCK, master())
            }
            val t = cur ?: continue
            // Blocks until the track has room: this paces the thread.
            val w = try { t.write(buf, 0, BLOCK * 2) } catch (e: IllegalStateException) { -1 }
            if (w < 0) synchronized(lock) {
                // A dead track (a route change on some phones): make a new one.
                if (track === t) { t.release(); track = null; set(mix, trackRate) }
            }
        }
    }

    companion object { const val BLOCK = 1024 }
}

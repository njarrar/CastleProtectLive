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
class Pcm(val data: ShortArray, val channels: Int, val rate: Int, val offset: Int = 0, val sampleCount: Int = data.size) {
    val frames: Int get() = if (channels > 0) sampleCount / channels else 0
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
            val padFrames = (delay ?: if (mime == MediaFormat.MIMETYPE_AUDIO_AAC) 2112 else 0) + 512
            var maxSamples = if (wantFrames > 0) (wantFrames + padFrames) * channels else Int.MAX_VALUE
            var out = ShortArray(maxOf(4096, if (wantFrames > 0) maxSamples else 4096))
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
                    if (b != null && info.size > 0 && n < maxSamples) {
                        b.position(info.offset); b.limit(info.offset + info.size)
                        val sb = b.order(ByteOrder.nativeOrder()).asShortBuffer()
                        val k = minOf(sb.remaining(), maxSamples - n)
                        if (n + k > out.size) {
                            val grown = if (wantFrames > 0) minOf(maxSamples, maxOf(out.size + 8192, n + k)) else maxOf(out.size * 2, n + k)
                            out = out.copyOf(grown)
                        }
                        sb.get(out, n, k); n += k
                    }
                    c.releaseOutputBuffer(o, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                    if (wantFrames > 0 && n >= maxSamples) break
                } else if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    val nf = c.outputFormat
                    channels = nf.getInteger(MediaFormat.KEY_CHANNEL_COUNT); rate = nf.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                    if (wantFrames > 0) maxSamples = (wantFrames + padFrames) * channels
                }
            }
            if (channels <= 0 || n == 0) return null
            val w = AudioRules.window(n / channels, wantFrames, delay, mime == MediaFormat.MIMETYPE_AUDIO_AAC)
            val start = w[0] * channels
            val count = w[1] * channels
            if (count <= 0) return null
            // Shift in place to avoid doubling the largest PCM buffer via copyOfRange (Android-H3).
            if (start > 0) System.arraycopy(out, start, out, 0, count)
            val data = if (out.size - count > 65_536) out.copyOf(count) else out
            return Pcm(data, channels, rate, 0, count)
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
        .setBufferSizeInBytes(pcm.sampleCount * 2)
        .setTransferMode(AudioTrack.MODE_STATIC)
        .build().also { t -> t.write(pcm.data, pcm.offset, pcm.sampleCount); t.setLoopPoints(0, pcm.frames, -1) }
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

/** Thin streaming sink over AudioTrack so [MusicEngine] lifecycle can be unit tested on JVM (Android-H2). */
internal interface StreamSink {
    fun play()
    fun pause()
    fun flush()
    fun stop()
    fun setPlaybackRate(rate: Int)
    fun writeNonBlocking(buf: ShortArray, off: Int, len: Int): Int
    fun release()
}

private class AndroidStreamSink(private val t: AudioTrack) : StreamSink {
    override fun play() { t.play() }
    override fun pause() { t.pause() }
    override fun flush() { t.flush() }
    override fun stop() { t.stop() }
    override fun setPlaybackRate(rate: Int) { t.playbackRate = rate }
    override fun writeNonBlocking(buf: ShortArray, off: Int, len: Int): Int = t.write(buf, off, len, AudioTrack.WRITE_NON_BLOCKING)
    override fun release() { t.release() }
}

/**
 * Music: one streaming AudioTrack fed by a [LayerMix] on its own thread (review 2 N-M7).
 * [master] is read for every block (about 21 ms), so sliders, focus and ducking apply at
 * once. All AudioTrack lifecycle calls (create, play, pause, flush, stop, release) run
 * exclusively on the `castle-music` thread using non-blocking writes, preventing any
 * concurrent mutation or 500 ms release stall (Android-H2).
 */
class MusicEngine internal constructor(
    private val master: () -> Float,
    private val openSink: ((Int) -> StreamSink?)?,
) {
    constructor(master: () -> Float) : this(master, null)

    private val lock = Object()
    private var mix: LayerMix? = null
    private var desiredRate = 0
    private var desiredPlaying = false
    private var desiredSlowMo = false
    private var needsFlush = false
    @Volatile private var released = false
    private val buf = ShortArray(BLOCK * 2)
    private val thread = Thread({ run() }, "castle-music").also { it.priority = Thread.MAX_PRIORITY; it.start() }

    /** Swaps in a new mix (or none). */
    fun set(m: LayerMix?, rate: Int) {
        synchronized(lock) {
            mix = m
            if (m != null && rate > 0) desiredRate = rate
            needsFlush = true
            lock.notifyAll()
        }
    }

    /** Runs [fn] on the current mix under the lock (fades, layer changes). */
    fun <T> withMix(fn: (LayerMix) -> T): T? = synchronized(lock) { mix?.let(fn) }

    val hasMix: Boolean get() = synchronized(lock) { mix != null }

    fun play(on: Boolean) {
        synchronized(lock) {
            if (on == desiredPlaying) return
            desiredPlaying = on
            lock.notifyAll()
        }
    }

    /** View slow motion: drops music playback rate by ~3 semitones while active. */
    fun setSlowMo(on: Boolean) {
        synchronized(lock) {
            if (on == desiredSlowMo) return
            desiredSlowMo = on
            lock.notifyAll()
        }
    }

    fun release() {
        released = true
        synchronized(lock) {
            desiredPlaying = false
            mix = null
            needsFlush = true
            lock.notifyAll()
        }
        thread.interrupt()
        try { thread.join(500) } catch (e: InterruptedException) { }
    }

    private fun buildSink(rate: Int): StreamSink? = openSink?.invoke(rate) ?: try {
        val min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
        val t = AudioTrack.Builder()
            .setAudioAttributes(PcmDecoder.attributes(true))
            .setAudioFormat(PcmDecoder.format(rate, 2))
            .setBufferSizeInBytes(maxOf(min, BLOCK * 4) * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        AndroidStreamSink(t)
    } catch (e: Exception) { null }

    private fun run() {
        var sink: StreamSink? = null
        var trackRate = 0
        var trackPlaying = false
        var trackSlow = false
        var pendingOff = 0
        var pendingLen = 0
        try {
            while (!released) {
                var wantPlay = false
                var wantRate = 0
                var wantSlow = false
                var doFlush = false
                var hasMixNow = false
                synchronized(lock) {
                    while (!released && (!desiredPlaying || mix == null) && !needsFlush && !trackPlaying && (mix == null || trackRate == desiredRate)) {
                        try { lock.wait() } catch (e: InterruptedException) { if (released) return }
                    }
                    if (released) return
                    wantPlay = desiredPlaying && mix != null
                    wantRate = desiredRate
                    wantSlow = desiredSlowMo
                    doFlush = needsFlush
                    needsFlush = false
                    hasMixNow = mix != null
                    if (!doFlush && wantPlay && pendingLen == 0 && sink != null && trackRate == wantRate) {
                        mix?.mix(buf, BLOCK, master())
                        pendingOff = 0
                        pendingLen = BLOCK * 2
                    }
                }
                if (hasMixNow && wantRate > 0 && (sink == null || trackRate != wantRate)) {
                    try { sink?.stop() } catch (e: Exception) { }
                    try { sink?.release() } catch (e: Exception) { }
                    sink = buildSink(wantRate)
                    trackRate = wantRate
                    trackPlaying = false
                    trackSlow = false
                    pendingOff = 0
                    pendingLen = 0
                    if (doFlush) continue
                }
                val s = sink
                if (s == null) {
                    synchronized(lock) { if (!released) try { lock.wait(20) } catch (e: InterruptedException) { if (released) return } }
                    continue
                }
                if (doFlush) {
                    if (trackPlaying) { try { s.pause() } catch (e: IllegalStateException) { }; trackPlaying = false }
                    try { s.flush() } catch (e: IllegalStateException) { }
                    pendingOff = 0; pendingLen = 0
                    continue
                }
                if (!wantPlay) {
                    if (trackPlaying) { try { s.pause() } catch (e: IllegalStateException) { }; trackPlaying = false }
                    continue
                }
                if (!trackPlaying) {
                    try { s.play(); trackPlaying = true } catch (e: IllegalStateException) {
                        try { s.release() } catch (e2: Exception) { }
                        sink = null; trackPlaying = false; pendingOff = 0; pendingLen = 0
                        continue
                    }
                }
                if (wantSlow != trackSlow) {
                    trackSlow = wantSlow
                    try { s.setPlaybackRate(if (wantSlow) (trackRate * 0.84f).toInt().coerceAtLeast(8000) else trackRate) } catch (e: IllegalStateException) { }
                }
                if (pendingLen > 0) {
                    val w = try { s.writeNonBlocking(buf, pendingOff, pendingLen) } catch (e: IllegalStateException) { -1 }
                    if (w < 0) {
                        try { s.stop() } catch (e: Exception) { }
                        try { s.release() } catch (e: Exception) { }
                        sink = null; trackPlaying = false; pendingOff = 0; pendingLen = 0
                    } else if (w == 0) {
                        // Buffer full: short timed wait so pause/flush/release wake immediately.
                        synchronized(lock) { if (!released && desiredPlaying && !needsFlush) try { lock.wait(8) } catch (e: InterruptedException) { if (released) return } }
                    } else {
                        pendingOff += w
                        pendingLen -= w
                    }
                }
            }
        } finally {
            try { sink?.stop() } catch (e: Exception) { }
            try { sink?.release() } catch (e: Exception) { }
        }
    }

    companion object { const val BLOCK = 1024 }
}

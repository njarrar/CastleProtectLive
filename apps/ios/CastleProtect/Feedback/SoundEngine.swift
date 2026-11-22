import AVFoundation

/// One sound from assets/audio/audio.json.
struct SoundEntry: Equatable, Sendable {
    var id: String
    /// sfx, music, sting, bark.
    var kind: String
    /// Path under `audio/` in the bundle (the `.m4a` file; iOS loads AAC).
    var file: String
    var loop: Bool
    var repeatGap: Double
    /// base, stir, peril, or nil.
    var layer: String?
    var bus: String
    var volume: Float
    var pitchVar: Double
    var samples: Int
    var sampleRate: Double
    var barSeconds: Double
}

struct MaterialSound: Equatable, Sendable {
    var hit: String?
    var brk: String?
}

/// The audio manifest, read once from the bundle.
final class SoundManifest: @unchecked Sendable {
    let sounds: [String: SoundEntry]
    let shotLaunch: [String: String]
    let blastSounds: [String: String]
    let materialSounds: [String: MaterialSound]
    /// Bus to music duck in dB (impact -6, voice -3).
    let duckDb: [String: Double]
    /// Bark subtitle lines: bark id to lines.
    let subtitles: [String: [String]]

    static let shared = SoundManifest(bundle: .main)

    var isEmpty: Bool { sounds.isEmpty }

    init(bundle: Bundle) {
        let url = bundle.url(forResource: "audio", withExtension: "json", subdirectory: "audio")
            ?? bundle.url(forResource: "audio", withExtension: "json")
        let data = url.flatMap { try? Data(contentsOf: $0) } ?? Data()
        let subsURL = bundle.url(forResource: "barks", withExtension: "json", subdirectory: "audio")
        let subs = subsURL.flatMap { try? Data(contentsOf: $0) } ?? Data()
        let parsed = Self.parse(data, barks: subs)
        sounds = parsed.sounds
        shotLaunch = parsed.launch
        blastSounds = parsed.blast
        materialSounds = parsed.material
        duckDb = parsed.duck
        subtitles = parsed.subs
    }

    init(data: Data) {
        let parsed = Self.parse(data, barks: Data())
        sounds = parsed.sounds
        shotLaunch = parsed.launch
        blastSounds = parsed.blast
        materialSounds = parsed.material
        duckDb = parsed.duck
        subtitles = parsed.subs
    }

    private static func parse(_ data: Data, barks: Data) -> (sounds: [String: SoundEntry], launch: [String: String],
                                                              blast: [String: String], material: [String: MaterialSound],
                                                              duck: [String: Double], subs: [String: [String]]) {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return ([:], [:], [:], [:], [:], [:]) }
        var sounds: [String: SoundEntry] = [:]
        for case let s as [String: Any] in root["sounds"] as? [Any] ?? [] {
            guard let id = s["id"] as? String, let files = s["files"] as? [String: Any], let m4a = files["m4a"] as? String else { continue }
            let sync = s["sync"] as? [String: Any]
            sounds[id] = SoundEntry(
                id: id, kind: s["kind"] as? String ?? "sfx", file: m4a, loop: s["loop"] as? Bool ?? false,
                repeatGap: Track.num(s["repeat_gap_s"] ?? 0), layer: s["layer"] as? String,
                bus: s["bus"] as? String ?? "ui", volume: Float(Track.num(s["volume"] ?? 1)),
                pitchVar: Track.num(s["pitch_var_semitones"] ?? 0), samples: Int(Track.num(s["samples"] ?? 0)),
                sampleRate: Track.num(s["sample_rate"] ?? 48_000), barSeconds: Track.num(sync?["bar_s"] ?? 0))
        }
        var launch: [String: String] = [:]
        for (k, v) in root["shot_launch"] as? [String: Any] ?? [:] {
            if let v = v as? String { launch[k] = v }
        }
        var blast: [String: String] = [:]
        for (k, v) in root["blast_sounds"] as? [String: Any] ?? [:] {
            if let v = v as? String { blast[k] = v }
        }
        var material: [String: MaterialSound] = [:]
        for (k, v) in root["material_sounds"] as? [String: Any] ?? [:] {
            let o = v as? [String: Any] ?? [:]
            material[k] = MaterialSound(hit: o["hit"] as? String, brk: o["brk"] as? String)
        }
        var duck: [String: Double] = [:]
        if let mix = root["mix"] as? [String: Any], let buses = mix["buses"] as? [String: Any] {
            for (k, v) in buses {
                if let o = v as? [String: Any], let d = o["ducks_music_db"] { duck[k] = Track.num(d) }
            }
        }
        var subs: [String: [String]] = [:]
        if let b = (try? JSONSerialization.jsonObject(with: barks)) as? [String: Any] {
            // barks.json: {"lines": {"bark_marge_fire": [..]}} or per Hob, per event.
            if let lines = b["lines"] as? [String: Any] {
                for (k, v) in lines { subs[k] = v as? [String] ?? [] }
            } else if let hobs = b["hobs"] as? [String: Any] {
                for (_, v) in hobs {
                    let barksByEvent = (v as? [String: Any])?["barks"] as? [String: Any] ?? [:]
                    for (_, bark) in barksByEvent {
                        guard let o = bark as? [String: Any], let sound = o["sound"] as? String else { continue }
                        subs[sound] = o["subtitles"] as? [String] ?? []
                    }
                }
            }
        }
        return (sounds, launch, blast, material, duck, subs)
    }
}

/// Carries a non-Sendable value into an audio or queue callback that only hands it back to the main actor.
final class UncheckedBox<T>: @unchecked Sendable {
    let value: T
    init(_ value: T) { self.value = value }
}

/// Decoded sound buffers, filled off the main thread, read from the main thread.
private final class BufferStore: @unchecked Sendable {
    private let lock = NSLock()
    private var buffers: [String: AVAudioPCMBuffer] = [:]

    func get(_ id: String) -> AVAudioPCMBuffer? {
        lock.lock()
        defer { lock.unlock() }
        return buffers[id]
    }

    func set(_ id: String, _ buffer: AVAudioPCMBuffer) {
        lock.lock()
        buffers[id] = buffer
        lock.unlock()
    }
}

/// Every sound in the game through one AVAudioEngine:
///
/// - SFX and barks: decoded once (off the main thread) to mono 48 kHz float
///   buffers, played from a pool of 16 voices, each with a varispeed for the
///   manifest's random pitch shift. At most 3 of one sound within 50 ms.
/// - Loops (wind, Squall, kettle whistle, flight whistle): own voices,
///   faded by volume.
/// - Music: the three Region 1 layers start on the same sample and loop
///   from the file (trimmed to `samples`), so they never drift; Stir and
///   Peril fade in and out on bar lines over one bar. Impacts duck the
///   music 6 dB, barks 3 dB.
///
/// The session is `ambient`: the silent switch and the player's own music
/// are respected. While another app plays audio, our music stays silent.
/// No sound plays before the first Play tap (`unlocked`).
@MainActor
final class SoundEngine {
    let manifest: SoundManifest
    private var engine = AVAudioEngine()
    private var observers: [NSObjectProtocol] = []
    private var sfxMixer = AVAudioMixerNode()
    private var musicMixer = AVAudioMixerNode()
    private var voiceMixer = AVAudioMixerNode()
    private var voices: [(player: AVAudioPlayerNode, pitch: AVAudioUnitVarispeed, bus: String, started: UInt64)] = []
    private var loops: [String: (player: AVAudioPlayerNode, pitch: AVAudioUnitVarispeed)] = [:]
    private var barkVoices: [AVAudioPlayerNode] = []
    private var nextBarkVoice = 0
    private var layers: [String: AVAudioPlayerNode] = [:]
    private var layerFiles: [String: AVAudioFile] = [:]
    private var layerGain: [String: Float] = [:]
    private var layerTarget: [String: Float] = [:]
    private var musicStartHost: UInt64 = 0
    private var musicTrack: String?
    private var stingPlayer: AVAudioPlayerNode?
    private let store = BufferStore()
    private var recent: [String: [UInt64]] = [:]
    private var nextVoice = 0
    private var started = false
    private var failed = false
    private var loading = false
    private var fadeTimer: Timer?
    private var duckGain: Float = 1
    private var duckUntil: UInt64 = 0
    private let format: AVAudioFormat
    private var lastBark: UInt64 = 0
    private var barkSides: Set<Int> = []
    private var lastLines: [String: String] = [:]
    private var rng: UInt32 = 0x1F12_3BB5

    /// Sliders, 0 to 100.
    var volume = 85 { didSet { applyVolume() } }
    var musicVolume = 70 { didSet { applyVolume() } }
    var voiceVolume = 80 { didSet { applyVolume() } }
    var muted = false { didSet { applyVolume() } }
    /// False until the first Play tap on first launch (no sound before it).
    var unlocked = true
    /// A subtitle for a bark: the line and the side.
    var onSubtitle: ((String, Int) -> Void)?

    init(manifest: SoundManifest = .shared) {
        self.manifest = manifest
        format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)
            ?? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48_000, channels: 1, interleaved: false)!
        observe()
    }

    // MARK: Session events

    private func observe() {
        let nc = NotificationCenter.default
        let me = WeakRef(self)
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let began = raw == AVAudioSession.InterruptionType.began.rawValue
            MainActor.assumeIsolated { me.value?.interrupted(began: began) }
        })
        observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { me.value?.rebuild() }
        })
        observers.append(nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { me.value?.restartIfNeeded() }
        })
        observers.append(nc.addObserver(forName: AVAudioSession.silenceSecondaryAudioHintNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { me.value?.applyVolume() }
        })
    }

    private func interrupted(began: Bool) {
        guard started else { return }
        if began {
            engine.pause()
        } else {
            try? AVAudioSession.sharedInstance().setActive(true)
            restartIfNeeded()
        }
    }

    private func restartIfNeeded() {
        guard started, !engine.isRunning else { return }
        try? engine.start()
        resumeMusicIfNeeded()
    }

    /// Media services were reset: every node is gone. Build the graph again on the next sound.
    private func rebuild() {
        let track = musicTrack
        voices = []
        barkVoices = []
        loops = [:]
        layers = [:]
        layerFiles = [:]
        stingPlayer = nil
        nextVoice = 0
        started = false
        failed = false
        engine = AVAudioEngine()
        sfxMixer = AVAudioMixerNode()
        musicMixer = AVAudioMixerNode()
        voiceMixer = AVAudioMixerNode()
        musicTrack = nil
        if let track {
            if track == "mus_r1" { startBattleMusic() } else { playMusic(track) }
        }
    }

    /// The app went to the background: let go of the audio session (UX 8.3).
    func release() {
        guard started else { return }
        engine.pause()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Stops all sound, for the Pause card and app switches.
    func pause() {
        guard started else { return }
        engine.pause()
    }

    func resume() {
        guard started, !engine.isRunning else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        try? engine.start()
        resumeMusicIfNeeded()
    }

    private func resumeMusicIfNeeded() {
        for p in layers.values where !p.isPlaying { p.play() }
    }

    // MARK: Graph

    private func prepare() -> Bool {
        if failed { return false }
        if started {
            if !engine.isRunning { try? engine.start() }
            return engine.isRunning
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Keep going: the engine still plays with the default session.
        }
        engine.attach(sfxMixer)
        engine.attach(musicMixer)
        engine.attach(voiceMixer)
        engine.connect(sfxMixer, to: engine.mainMixerNode, format: nil)
        engine.connect(musicMixer, to: engine.mainMixerNode, format: nil)
        engine.connect(voiceMixer, to: engine.mainMixerNode, format: nil)
        for _ in 0..<16 {
            let p = AVAudioPlayerNode()
            let v = AVAudioUnitVarispeed()
            engine.attach(p)
            engine.attach(v)
            engine.connect(p, to: v, format: format)
            engine.connect(v, to: sfxMixer, format: format)
            voices.append((p, v, "sfx", 0))
        }
        for _ in 0..<2 {
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: voiceMixer, format: format)
            barkVoices.append(p)
        }
        applyVolume()
        do {
            try engine.start()
            started = true
        } catch {
            failed = true
        }
        preload()
        return started
    }

    /// Decodes every SFX and bark off the main thread.
    private func preload() {
        guard !loading else { return }
        loading = true
        let entries = manifest.sounds.values.filter { $0.kind == "sfx" || $0.kind == "bark" }
        let store = self.store
        let format = UncheckedBox(self.format)
        DispatchQueue.global(qos: .utility).async {
            for e in entries where store.get(e.id) == nil {
                if let b = SoundEngine.decode(e, format: format.value) { store.set(e.id, b) }
            }
        }
    }

    nonisolated private static func url(for entry: SoundEntry) -> URL? {
        let name = (entry.file as NSString).deletingPathExtension
        let ext = (entry.file as NSString).pathExtension
        let bundle = Bundle.main
        return bundle.url(forResource: name, withExtension: ext, subdirectory: "audio")
            ?? bundle.url(forResource: (name as NSString).lastPathComponent, withExtension: ext,
                          subdirectory: "audio/" + (name as NSString).deletingLastPathComponent)
    }

    /// Decodes one file to mono 48 kHz float, trimmed to the manifest's sample count.
    nonisolated private static func decode(_ entry: SoundEntry, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let url = url(for: entry), let file = try? AVAudioFile(forReading: url) else { return nil }
        let frames = AVAudioFrameCount(file.length)
        guard frames > 0, let raw = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frames),
              (try? file.read(into: raw)) != nil, let src = raw.floatChannelData else { return nil }
        guard raw.format.sampleRate == format.sampleRate else { return nil }
        let count = entry.samples > 0 ? min(Int(raw.frameLength), entry.samples) : Int(raw.frameLength)
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)),
              let dst = out.floatChannelData?[0] else { return nil }
        out.frameLength = AVAudioFrameCount(count)
        let channels = Int(raw.format.channelCount)
        for i in 0..<count {
            var sum: Float = 0
            for ch in 0..<channels { sum += src[ch][i] }
            dst[i] = sum / Float(max(1, channels))
        }
        return out
    }

    private func buffer(_ id: String) -> AVAudioPCMBuffer? {
        if let b = store.get(id) { return b }
        guard let e = manifest.sounds[id], let b = Self.decode(e, format: format) else { return nil }
        store.set(id, b)
        return b
    }

    private func applyVolume() {
        let master: Float = muted ? 0 : 1
        sfxMixer.outputVolume = master * Float(max(0, min(100, volume))) / 100
        voiceMixer.outputVolume = master * Float(max(0, min(100, voiceVolume))) / 100
        // Another app's music wins over ours (silent switch is the session's job).
        let other = AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint
        musicMixer.outputVolume = other ? 0 : master * Float(max(0, min(100, musicVolume))) / 100 * duckGain
    }

    // MARK: SFX

    private func nextRandom() -> Double {
        rng ^= rng << 13
        rng ^= rng >> 17
        rng ^= rng << 5
        return Double(rng % 10_000) / 10_000
    }

    /// Plays one sound. `pitch` in semitones on top of the manifest's random shift.
    func play(_ id: String, pitch: Double = 0, gain: Float = 1) {
        guard unlocked, !muted else { return }
        guard let entry = manifest.sounds[id] else { return }
        if entry.kind == "music" || entry.kind == "sting" {
            playSting(id)
            return
        }
        guard prepare(), let buffer = buffer(id), !voices.isEmpty else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        var times = (recent[id] ?? []).filter { now &- $0 < 50_000_000 }
        guard times.count < 3 else { return }
        times.append(now)
        recent[id] = times
        // Steal the oldest voice that is not a kettle sound.
        var index = nextVoice
        for k in 0..<voices.count {
            let i = (nextVoice + k) % voices.count
            if !voices[i].player.isPlaying { index = i; break }
            if voices[i].bus != "kettle" { index = i }
        }
        nextVoice = (index + 1) % voices.count
        let v = voices[index]
        if v.player.isPlaying { v.player.stop() }
        let shift = pitch + (entry.pitchVar > 0 ? (nextRandom() * 2 - 1) * entry.pitchVar : 0)
        v.pitch.rate = Float(pow(2, shift / 12))
        v.player.volume = max(0, min(1, entry.volume * gain))
        v.player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        v.player.play()
        voices[index].bus = entry.bus
        voices[index].started = now
        if let db = manifest.duckDb[entry.bus], id != "hit_blast_tiny" { duck(db: db) }
    }

    /// Ducks the music for a moment (30 ms down, 400 ms back).
    private func duck(db: Double) {
        duckGain = min(duckGain, Float(pow(10, db / 20)))
        duckUntil = DispatchTime.now().uptimeNanoseconds + 200_000_000
        applyVolume()
        startFades()
    }

    // MARK: Loops

    /// Starts or updates a looping sound (wind, Squall, whistles). Volume 0 stops it.
    func setLoop(_ id: String, gain: Float, pitch: Double = 0) {
        guard unlocked else { return }
        if gain <= 0.001 || muted {
            if let l = loops[id] {
                l.player.stop()
                loops[id] = nil
            }
            return
        }
        guard let entry = manifest.sounds[id], prepare() else { return }
        if loops[id] == nil {
            guard let buffer = buffer(id) else { return }
            let p = AVAudioPlayerNode()
            let v = AVAudioUnitVarispeed()
            engine.attach(p)
            engine.attach(v)
            engine.connect(p, to: v, format: format)
            engine.connect(v, to: sfxMixer, format: format)
            if entry.repeatGap > 0 {
                // A loop with a gap: the buffer padded with silence.
                let gapFrames = AVAudioFrameCount(entry.repeatGap * format.sampleRate)
                if let padded = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: buffer.frameLength + gapFrames),
                   let dst = padded.floatChannelData?[0], let src = buffer.floatChannelData?[0] {
                    padded.frameLength = buffer.frameLength + gapFrames
                    for i in 0..<Int(padded.frameLength) { dst[i] = i < Int(buffer.frameLength) ? src[i] : 0 }
                    p.scheduleBuffer(padded, at: nil, options: [.loops], completionHandler: nil)
                }
            } else {
                p.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
            }
            p.play()
            loops[id] = (p, v)
        }
        if let l = loops[id] {
            l.player.volume = max(0, min(1, entry.volume * gain))
            l.pitch.rate = Float(pow(2, pitch / 12))
        }
    }

    func stopLoops() {
        for l in loops.values { l.player.stop() }
        loops = [:]
    }

    // MARK: Music

    /// Region 1 battle music: Base, Stir and Peril start on the same sample; Stir and Peril silent.
    func startBattleMusic() {
        guard musicTrack != "mus_r1" else { return }
        stopMusic()
        guard unlocked, prepare() else { return }
        musicTrack = "mus_r1"
        let ids = ["base": "mus_r1_base", "stir": "mus_r1_stir", "peril": "mus_r1_peril"]
        // One start time for all three, a little ahead, so they share the first sample.
        let lead = AVAudioTime.hostTime(forSeconds: 0.12)
        let startHost = mach_absolute_time() + lead
        musicStartHost = startHost
        for (layer, id) in ids {
            guard let entry = manifest.sounds[id], let url = Self.url(for: entry), let file = try? AVAudioFile(forReading: url) else { continue }
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: musicMixer, format: file.processingFormat)
            layers[layer] = p
            layerFiles[layer] = file
            let gain: Float = layer == "base" ? 1 : 0
            layerGain[layer] = gain
            layerTarget[layer] = gain
            p.volume = gain
            let frames = AVAudioFrameCount(entry.samples > 0 ? min(Int64(entry.samples), file.length) : file.length)
            // Two copies queued; each finished copy queues the next, so the loop never gaps.
            scheduleLoop(p, file: file, frames: frames, copies: 2)
            p.play(at: AVAudioTime(hostTime: startHost))
        }
    }

    private func scheduleLoop(_ p: AVAudioPlayerNode, file: AVAudioFile, frames: AVAudioFrameCount, copies: Int) {
        let me = WeakRef(self)
        let player = WeakRef(p)
        let fileBox = UncheckedBox(file)
        for _ in 0..<copies {
            p.scheduleSegment(file, startingFrame: 0, frameCount: frames, at: nil, completionCallbackType: .dataConsumed) { _ in
                DispatchQueue.main.async {
                    MainActor.assumeIsolated {
                        guard let engine = me.value, let p = player.value, engine.layers.values.contains(where: { $0 === p }) else { return }
                        engine.scheduleLoop(p, file: fileBox.value, frames: frames, copies: 1)
                    }
                }
            }
        }
    }

    /// The map and menu theme (or another single looping track).
    func playMusic(_ id: String) {
        guard musicTrack != id else { return }
        stopMusic()
        guard unlocked, let entry = manifest.sounds[id], prepare(), let url = Self.url(for: entry),
              let file = try? AVAudioFile(forReading: url) else { return }
        musicTrack = id
        let p = AVAudioPlayerNode()
        engine.attach(p)
        engine.connect(p, to: musicMixer, format: file.processingFormat)
        layers["base"] = p
        layerFiles["base"] = file
        layerGain["base"] = 1
        layerTarget["base"] = 1
        let frames = AVAudioFrameCount(entry.samples > 0 ? min(Int64(entry.samples), file.length) : file.length)
        scheduleLoop(p, file: file, frames: frames, copies: 2)
        p.play()
    }

    /// Stir and Peril on or off; the fade starts on the next bar line and lasts one bar.
    func setLayers(stir: Bool, peril: Bool) {
        guard musicTrack == "mus_r1" else { return }
        layerTarget["stir"] = stir || peril ? 1 : 0
        layerTarget["peril"] = peril ? 1 : 0
        startFades()
    }

    private func startFades() {
        guard fadeTimer == nil else { return }
        let me = WeakRef(self)
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { _ in
            MainActor.assumeIsolated { me.value?.fadeStep() }
        }
    }

    private var fadeStartedOnBar: [String: Bool] = [:]

    private func fadeStep() {
        let bar = manifest.sounds["mus_r1_base"]?.barSeconds ?? 1.111111
        let elapsed = musicStartHost == 0 ? 0 : AVAudioTime.seconds(forHostTime: mach_absolute_time() &- musicStartHost)
        let intoBar = bar > 0 ? elapsed.truncatingRemainder(dividingBy: bar) : 0
        var busy = false
        for (layer, target) in layerTarget {
            let gain = layerGain[layer] ?? 0
            guard abs(gain - target) > 0.001 else { fadeStartedOnBar[layer] = false; continue }
            busy = true
            // Wait for a bar line (within one frame of it) before a fade starts.
            if fadeStartedOnBar[layer] != true {
                guard intoBar < 1.0 / 30 + 0.005 else { continue }
                fadeStartedOnBar[layer] = true
            }
            let step = Float(1.0 / 30 / max(0.2, bar))
            let next = gain < target ? min(target, gain + step) : max(target, gain - step)
            layerGain[layer] = next
            layers[layer]?.volume = next
        }
        // Duck release over 400 ms.
        if duckGain < 1, DispatchTime.now().uptimeNanoseconds > duckUntil {
            duckGain = min(1, duckGain + Float(1.0 / 30 / 0.4))
            applyVolume()
            busy = true
        } else if duckGain < 1 {
            busy = true
        }
        if !busy {
            fadeTimer?.invalidate()
            fadeTimer = nil
        }
    }

    /// The win or lose sting: the layers stop, then the sting plays once.
    func playSting(_ id: String) {
        guard unlocked, let entry = manifest.sounds[id], prepare(), let url = Self.url(for: entry),
              let file = try? AVAudioFile(forReading: url) else { return }
        stopMusic()
        let p = stingPlayer ?? AVAudioPlayerNode()
        if stingPlayer == nil {
            engine.attach(p)
            stingPlayer = p
        }
        engine.disconnectNodeOutput(p)
        engine.connect(p, to: musicMixer, format: file.processingFormat)
        p.stop()
        p.scheduleFile(file, at: nil, completionHandler: nil)
        p.play()
    }

    func stopMusic() {
        for p in layers.values {
            p.stop()
            engine.detach(p)
        }
        layers = [:]
        layerFiles = [:]
        layerGain = [:]
        layerTarget = [:]
        fadeStartedOnBar = [:]
        musicTrack = nil
        musicStartHost = 0
    }

    // MARK: Barks (Hob-speak)

    /// A bark: one per side per turn step, 1.5 s apart; most events 40% of the time, Bonks and wins always.
    func bark(hob def: String, event: String, side: Int) {
        guard let art = SpriteImages.hobArtName(id: def, name: "") else { return }
        let id = "bark_\(art)_\(event)"
        guard manifest.sounds[id] != nil else { return }
        let always = event == "bonked" || event == "win"
        let now = DispatchTime.now().uptimeNanoseconds
        guard always || (now &- lastBark > 1_500_000_000 && !barkSides.contains(side) && nextRandom() < 0.4) else { return }
        lastBark = now
        barkSides.insert(side)
        playVoice(id)
        if let lines = manifest.subtitles[id], !lines.isEmpty {
            var pick = lines[Int(nextRandom() * Double(lines.count)) % lines.count]
            if pick == lastLines[id], lines.count > 1 { pick = lines.first { $0 != pick } ?? pick }
            lastLines[id] = pick
            onSubtitle?(pick, side)
        }
    }

    /// A new turn step: each side may bark again.
    func newTurnStep() { barkSides = [] }

    private func playVoice(_ id: String) {
        guard unlocked, !muted, voiceVolume > 0, prepare(), let buffer = buffer(id), !barkVoices.isEmpty else { return }
        let p = barkVoices[nextBarkVoice % barkVoices.count]
        nextBarkVoice += 1
        p.stop()
        p.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        p.play()
        duck(db: manifest.duckDb["voice"] ?? -3)
    }
}

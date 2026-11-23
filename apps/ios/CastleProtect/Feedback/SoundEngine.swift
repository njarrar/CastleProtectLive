import AVFoundation
import os

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

/// One bark's lines from assets/audio/barks.json: the plain pool, lines that name a crewmate
/// (used only when that Hob is on the crew), lines with `{rival}` (only against a named Rival),
/// and an optional chance that overrides the event's.
struct BarkLines: Equatable, Sendable {
    var subtitles: [String] = []
    var withMate: [String: [String]] = [:]
    var withRival: [String] = []
    var chance: Double?

    /// The pool for this fight: plain lines, plus mate lines for crewmates here, plus Rival lines
    /// with `{rival}` swapped for the Rival's short name.
    func pool(mates: [String], rival: String?) -> [String] {
        var out = subtitles
        for mate in mates { out += withMate[mate] ?? [] }
        if let rival, !rival.isEmpty {
            out += withRival.map { $0.replacingOccurrences(of: "{rival}", with: rival) }
        }
        return out
    }
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
    /// World bus duck in dB when a Hob bark plays (-4).
    let worldDuckDb: Double
    /// Bark subtitle lines: bark id to lines.
    let subtitles: [String: [String]]
    /// Every bark's lines and options by sound id (`bark_marge_fire`).
    let barkLines: [String: BarkLines]
    /// Chance per bark event (`events.<event>.chance` in barks.json).
    let eventChance: [String: Double]
    /// The whole crew's win line (`crew.win`), said once after the Hob win lines.
    let crewWin: [String]

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
        worldDuckDb = parsed.worldDuck
        let barks = Self.parseBarks(subs)
        barkLines = barks.lines
        eventChance = barks.chance
        crewWin = barks.crewWin
        subtitles = barks.lines.mapValues(\.subtitles)
    }

    init(data: Data) {
        let parsed = Self.parse(data, barks: Data())
        sounds = parsed.sounds
        shotLaunch = parsed.launch
        blastSounds = parsed.blast
        materialSounds = parsed.material
        duckDb = parsed.duck
        worldDuckDb = parsed.worldDuck
        barkLines = [:]
        eventChance = [:]
        crewWin = []
        subtitles = [:]
    }

    /// barks.json: `hobs.<hob id>.barks.<event>` with `sound`, `subtitles` and the optional
    /// `with_mate`, `with_rival` and `chance`; `events.<event>.chance`; `crew.win.subtitles`.
    static func parseBarks(_ data: Data) -> (lines: [String: BarkLines], chance: [String: Double], crewWin: [String]) {
        guard let b = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return ([:], [:], []) }
        var lines: [String: BarkLines] = [:]
        if let flat = b["lines"] as? [String: Any] {
            for (k, v) in flat { lines[k] = BarkLines(subtitles: v as? [String] ?? []) }
        }
        for (_, v) in b["hobs"] as? [String: Any] ?? [:] {
            let barksByEvent = (v as? [String: Any])?["barks"] as? [String: Any] ?? [:]
            for (_, bark) in barksByEvent {
                guard let o = bark as? [String: Any], let sound = o["sound"] as? String else { continue }
                var entry = BarkLines(subtitles: o["subtitles"] as? [String] ?? [])
                for (mate, list) in o["with_mate"] as? [String: Any] ?? [:] {
                    entry.withMate[mate] = list as? [String] ?? []
                }
                entry.withRival = o["with_rival"] as? [String] ?? []
                if let c = o["chance"] { entry.chance = Track.num(c) }
                lines[sound] = entry
            }
        }
        var chance: [String: Double] = [:]
        for (event, v) in b["events"] as? [String: Any] ?? [:] {
            if let c = (v as? [String: Any])?["chance"] { chance[event] = Track.num(c) }
        }
        let crew = (b["crew"] as? [String: Any])?["win"] as? [String: Any]
        return (lines, chance, crew?["subtitles"] as? [String] ?? [])
    }

    private static func parse(_ data: Data, barks: Data) -> (sounds: [String: SoundEntry], launch: [String: String],
                                                              blast: [String: String], material: [String: MaterialSound],
                                                              duck: [String: Double], worldDuck: Double,
                                                              subs: [String: [String]]) {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return ([:], [:], [:], [:], [:], -4, [:]) }
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
            // `null` means the shot has no launch sound (L4): kept as "", which plays nothing.
            if let v = v as? String { launch[k] = v } else if v is NSNull { launch[k] = "" }
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
        var worldDuck = -4.0
        if let mix = root["mix"] as? [String: Any], let buses = mix["buses"] as? [String: Any] {
            for (k, v) in buses {
                if let o = v as? [String: Any] {
                    if let d = o["ducks_music_db"] { duck[k] = Track.num(d) }
                    if k == "world", let wd = o["ducked_by_voice_db"] { worldDuck = Track.num(wd) }
                }
            }
        }
        let subs = parseBarks(barks).lines.mapValues(\.subtitles)
        return (sounds, launch, blast, material, duck, worldDuck, subs)
    }
}

/// Carries a non-Sendable value into an audio or queue callback that only hands it back to the main actor.
final class UncheckedBox<T>: @unchecked Sendable {
    let value: T
    init(_ value: T) { self.value = value }
}

/// Holds NotificationCenter tokens and the fade timer so `nonisolated deinit` can tear both down safely in Swift 6.
private final class SoundCleanupBag: @unchecked Sendable {
    private let lock = NSLock()
    private var observers: [NSObjectProtocol] = []
    private var fadeTimer: Timer?

    func addObserver(_ token: NSObjectProtocol) {
        lock.lock()
        observers.append(token)
        lock.unlock()
    }

    var hasTimer: Bool {
        lock.lock()
        defer { lock.unlock() }
        return fadeTimer != nil
    }

    func setTimer(_ timer: Timer?) {
        lock.lock()
        let old = fadeTimer
        fadeTimer = timer
        lock.unlock()
        old?.invalidate()
    }

    func tearDown() {
        lock.lock()
        let obs = observers
        observers = []
        let timer = fadeTimer
        fadeTimer = nil
        lock.unlock()
        let nc = NotificationCenter.default
        for token in obs { nc.removeObserver(token) }
        if let timer {
            let box = UncheckedBox(timer)
            if Thread.isMainThread {
                box.value.invalidate()
            } else {
                DispatchQueue.main.async { box.value.invalidate() }
            }
        }
    }
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

/// The SFX voice pick rule (review 2, H3).
///
/// `AVAudioPlayerNode.isPlaying` stays true after a buffer has ended (it only
/// turns false on `stop()` or `pause()`), so it cannot say which voice is
/// free. Each voice keeps when its sound ends (start plus buffer length over
/// rate), and the buffer's completion handler frees it as soon as it has
/// played. A free voice is taken first; when all 16 sound, the oldest one
/// that is not on the kettle bus is stolen.
struct VoicePool: Equatable {
    struct Voice: Equatable {
        var bus = "sfx"
        var started: UInt64 = 0
        var busyUntil: UInt64 = 0
        var generation = 0
    }

    private(set) var voices: [Voice]
    private var next = 0

    init(count: Int) {
        voices = Array(repeating: Voice(), count: max(1, count))
    }

    var count: Int { voices.count }

    func isFree(_ i: Int, now: UInt64) -> Bool {
        i >= 0 && i < voices.count && voices[i].busyUntil <= now
    }

    /// The voice the next sound plays on.
    mutating func pick(now: UInt64) -> Int {
        let n = voices.count
        for k in 0..<n {
            let i = (next + k) % n
            if voices[i].busyUntil <= now {
                next = (i + 1) % n
                return i
            }
        }
        var best: Int?
        for i in 0..<n where voices[i].bus != "kettle" {
            if best == nil || voices[i].started < voices[best ?? i].started { best = i }
        }
        let pick = best ?? (0..<n).min { voices[$0].started < voices[$1].started } ?? 0
        next = (pick + 1) % n
        return pick
    }

    /// A sound of `seconds` starts on voice `i`. Returns the generation its completion handler must name.
    @discardableResult
    mutating func start(_ i: Int, now: UInt64, seconds: Double, bus: String) -> Int {
        guard i >= 0 && i < voices.count else { return -1 }
        voices[i].bus = bus
        voices[i].started = now
        voices[i].busyUntil = now &+ UInt64(max(0, seconds) * 1_000_000_000)
        voices[i].generation += 1
        return voices[i].generation
    }

    /// The buffer of that generation has played: the voice is free (a stolen voice's old handler is ignored).
    mutating func finished(_ i: Int, generation: Int) {
        guard i >= 0 && i < voices.count, voices[i].generation == generation else { return }
        voices[i].busyUntil = 0
    }

    mutating func reset() {
        for i in voices.indices {
            voices[i].busyUntil = 0
            voices[i].generation += 1
        }
    }
}

/// Every sound in the game through one AVAudioEngine:
///
/// - SFX and barks: decoded once (off the main thread) to mono 48 kHz float
///   buffers, played from a pool of 16 voices, each with a varispeed for the
///   manifest's random pitch shift. At most 3 of one sound within 50 ms.
/// - Loops (wind, Squall, kettle whistle, flight whistle): own voices,
///   faded by volume, detached from the graph when they stop.
/// - Music: the three Region 1 layers start on the same sample and loop
///   from the file (trimmed to `samples`), so they never drift; Stir and
///   Peril fade in and out on bar lines over one bar. Impacts duck the
///   music 6 dB, barks 3 dB.
///
/// The session is `ambient`: the silent switch and the player's own music
/// are respected. While another app plays audio, our music stays silent.
/// No sound plays before the first Play tap (`unlocked`), and none while the
/// battle's Pause card is up (`held`, UX 8.2 and 8.3).
@MainActor
final class SoundEngine {
    let manifest: SoundManifest
    private var engine = AVAudioEngine()
    private let cleanup = SoundCleanupBag()
    private var sfxMixer = AVAudioMixerNode()
    private var worldMixer = AVAudioMixerNode()
    private var musicMixer = AVAudioMixerNode()
    private var musicSpeed = AVAudioUnitVarispeed()
    private var voiceMixer = AVAudioMixerNode()
    private var voices: [(player: AVAudioPlayerNode, pitch: AVAudioUnitVarispeed, panner: AVAudioMixerNode)] = []
    private var pool = VoicePool(count: 16)
    private var loops: [String: (player: AVAudioPlayerNode, pitch: AVAudioUnitVarispeed)] = [:]
    /// What each running loop should be (gain, pitch), so a route change or the end of a
    /// pause can bring them back without waiting for a new frame.
    private var loopWanted: [String: (gain: Float, pitch: Double)] = [:]
    private var barkVoices: [AVAudioPlayerNode] = []
    private var nextBarkVoice = 0
    private var layers: [String: AVAudioPlayerNode] = [:]
    private var layerFiles: [String: AVAudioFile] = [:]
    private var layerGain: [String: Float] = [:]
    private var layerTarget: [String: Float] = [:]
    private var musicTrack: String?
    /// Bumps when music stops, so a layer start that waits for the engine clock can tell it is stale.
    private var musicToken = 0
    /// The track to bring back when the engine runs again (after a pause or a route change).
    private var suspendedTrack: String?
    private var stingPlayer: AVAudioPlayerNode?
    private var stingPlaying = false
    private var stingToken = 0
    private var pendingMusicAfterSting: String?
    private let store = BufferStore()
    private var recent: [String: [UInt64]] = [:]
    private var graphBuilt = false
    private var started = false
    private var failed = false
    private var loading = false
    private var duckGain: Float = 1
    private var duckTarget: Float = 1
    private var duckUntil: UInt64 = 0
    private var worldDuckGain: Float = 1
    private var worldDuckTarget: Float = 1
    private var worldDuckUntil: UInt64 = 0
    private var slowMoScale: Float = 1
    private let format: AVAudioFormat
    private let stereoFormat: AVAudioFormat
    private var lastBark: UInt64 = 0
    private var barkSides: Set<Int> = []
    private var lastLines: [String: String] = [:]
    private var crewWinTask: Task<Void, Never>?
    private var rng: UInt32 = 0x1F12_3BB5
    /// `secondaryAudioShouldBeSilencedHint`, read once and refreshed on notice / resume (L4).
    private var otherAudioPlaying = AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint

    /// Sliders, 0 to 100.
    var volume = 85 { didSet { applyVolume() } }
    var musicVolume = 70 { didSet { applyVolume() } }
    var voiceVolume = 80 { didSet { applyVolume() } }
    var muted = false {
        didSet {
            applyVolume()
            if muted {
                for id in Array(loops.keys) { removeLoop(id) }
            } else if !held {
                restoreLoops()
            }
        }
    }
    /// False until the first Play tap on first launch (no sound before it).
    var unlocked = true
    /// True while the battle's Pause card is up: the engine is paused and no sound starts.
    private(set) var held = false
    /// A subtitle for a bark: the line and the side.
    var onSubtitle: ((String, Int) -> Void)?
    /// Headphones (or another output) went away: the battle pauses (UX 8.3).
    var onOutputLost: (() -> Void)?

    init(manifest: SoundManifest = .shared) {
        self.manifest = manifest
        format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)
            ?? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48_000, channels: 1, interleaved: false)!
        stereoFormat = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)
            ?? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48_000, channels: 2, interleaved: false)!
        observe()
    }

    deinit {
        cleanup.tearDown()
    }

    // MARK: Session events

    private func observe() {
        let nc = NotificationCenter.default
        let me = WeakRef(self)
        cleanup.addObserver(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let began = raw == AVAudioSession.InterruptionType.began.rawValue
            let optRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let shouldResume = AVAudioSession.InterruptionOptions(rawValue: optRaw).contains(.shouldResume)
            MainActor.assumeIsolated { me.value?.interrupted(began: began, shouldResume: shouldResume) }
        })
        cleanup.addObserver(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { me.value?.rebuild() }
        })
        cleanup.addObserver(nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { me.value?.configurationChanged() }
        })
        cleanup.addObserver(nc.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { note in
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            let lost = raw == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue
            MainActor.assumeIsolated { if lost { me.value?.onOutputLost?() } }
        })
        cleanup.addObserver(nc.addObserver(forName: AVAudioSession.silenceSecondaryAudioHintNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                me.value?.otherAudioPlaying = AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint
                me.value?.applyVolume()
            }
        })
    }

    private func interrupted(began: Bool, shouldResume: Bool) {
        guard started else { return }
        if began {
            stopFades()
            engine.pause()
        } else if shouldResume {
            try? AVAudioSession.sharedInstance().setActive(true)
            resume()
        }
    }

    /// The engine's I/O format changed (headphones in or out, AirPods): the engine stopped and
    /// every player node lost what was scheduled. Clear the voices and loops, start the music
    /// again from its first sample, and bring the loops back (review 2, M3).
    private func configurationChanged() {
        guard started else { return }
        let track = musicTrack ?? suspendedTrack ?? pendingMusicAfterSting
        stopSting()
        stopMusic()
        suspendedTrack = track
        for v in voices { v.player.stop() }
        pool.reset()
        for p in barkVoices { p.stop() }
        let wanted = loopWanted
        removeAllLoops()
        loopWanted = wanted
        guard !held else { return }
        resume()
    }

    /// Media services were reset: every node is gone. Build the graph again on the next sound.
    private func rebuild() {
        stopFades()
        let track = musicTrack ?? suspendedTrack ?? pendingMusicAfterSting
        let wanted = loopWanted
        voices = []
        pool = VoicePool(count: 16)
        barkVoices = []
        loops = [:]
        layers = [:]
        layerFiles = [:]
        layerGain = [:]
        layerTarget = [:]
        fadeStartedOnBar = [:]
        stingPlayer = nil
        stingPlaying = false
        pendingMusicAfterSting = nil
        stingToken += 1
        graphBuilt = false
        started = false
        failed = false
        musicToken += 1
        duckGain = 1
        duckTarget = 1
        worldDuckGain = 1
        worldDuckTarget = 1
        slowMoScale = 1
        engine = AVAudioEngine()
        sfxMixer = AVAudioMixerNode()
        worldMixer = AVAudioMixerNode()
        musicMixer = AVAudioMixerNode()
        musicSpeed = AVAudioUnitVarispeed()
        voiceMixer = AVAudioMixerNode()
        musicTrack = nil
        suspendedTrack = nil
        loopWanted = wanted
        guard !held else {
            suspendedTrack = track
            return
        }
        if let track { startTrack(track) }
        restoreLoops()
    }

    /// The app went to the background: let go of the audio session (UX 8.3).
    func release() {
        stopFades()
        guard started else { return }
        engine.pause()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Stops all sound for an app switch; `resume()` brings it back.
    func pause() {
        stopFades()
        guard started else { return }
        engine.pause()
    }

    /// The Pause card is up (true) or gone (false). While held no sound plays, the UI's
    /// own taps included, and coming back to the app does not restart the engine (UX 8.2, 8.3 rule 4).
    func setHeld(_ on: Bool) {
        guard on != held else { return }
        held = on
        if on {
            stopFades()
            if started { engine.pause() }
        } else {
            resume()
        }
    }

    /// Back to the app (or out of a pause): start the engine, and only then the music and loops.
    func resume() {
        guard !held else { return }
        otherAudioPlaying = AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint
        applyVolume()
        // One failed start does not silence the whole run: try again on each foreground (L4).
        failed = false
        guard started || suspendedTrack != nil || !loopWanted.isEmpty else { return }
        if started { try? AVAudioSession.sharedInstance().setActive(true) }
        guard prepare() else { return }
        resumeMusicIfNeeded()
        restoreLoops()
        if hasPendingFades { startFades() }
    }

    /// Only with the engine running (`play()` on a stopped engine raises an exception Swift cannot catch).
    private func resumeMusicIfNeeded() {
        guard engine.isRunning else { return }
        if let track = suspendedTrack {
            suspendedTrack = nil
            startTrack(track)
            return
        }
        // A layer that stopped cannot be restarted alone without leaving the others: restart them together.
        if let track = musicTrack, layers.values.contains(where: { !$0.isPlaying }) {
            stopMusic()
            startTrack(track)
        }
    }

    private func startTrack(_ track: String) {
        if track == "mus_r1" { startBattleMusic() } else { playMusic(track) }
    }

    // MARK: Graph

    /// Verifies the engine is running immediately before any `AVAudioPlayerNode.play()`.
    private func ensureRunning() -> Bool {
        if engine.isRunning { return true }
        guard !held, !failed, graphBuilt else { return false }
        do {
            try engine.start()
        } catch {
            failed = true
            return false
        }
        return engine.isRunning
    }

    /// Builds the graph once and starts the engine. False while held, after a failed start,
    /// or when the engine cannot run.
    private func prepare() -> Bool {
        if held || failed { return false }
        if !graphBuilt {
            do {
                try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                // Keep going: the engine still plays with the default session.
            }
            engine.attach(sfxMixer)
            engine.attach(worldMixer)
            engine.attach(musicMixer)
            engine.attach(musicSpeed)
            engine.attach(voiceMixer)
            engine.connect(sfxMixer, to: engine.mainMixerNode, format: nil)
            engine.connect(worldMixer, to: engine.mainMixerNode, format: nil)
            engine.connect(musicMixer, to: musicSpeed, format: stereoFormat)
            engine.connect(musicSpeed, to: engine.mainMixerNode, format: stereoFormat)
            engine.connect(voiceMixer, to: engine.mainMixerNode, format: nil)
            for _ in 0..<pool.count {
                let p = AVAudioPlayerNode()
                let v = AVAudioUnitVarispeed()
                let panner = AVAudioMixerNode()
                engine.attach(p)
                engine.attach(v)
                engine.attach(panner)
                engine.connect(p, to: v, format: format)
                engine.connect(v, to: panner, format: format)
                engine.connect(panner, to: sfxMixer, format: format)
                voices.append((p, v, panner))
            }
            for _ in 0..<2 {
                let p = AVAudioPlayerNode()
                engine.attach(p)
                engine.connect(p, to: voiceMixer, format: format)
                barkVoices.append(p)
            }
            graphBuilt = true
            applyVolume()
            preload()
        }
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                failed = true
                return false
            }
        }
        started = true
        return engine.isRunning
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

    nonisolated private static let log = Logger(subsystem: "games.castleprotect", category: "audio")

    /// Decodes one file to mono 48 kHz float, trimmed to the manifest's sample count.
    nonisolated private static func decode(_ entry: SoundEntry, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let url = url(for: entry), let file = try? AVAudioFile(forReading: url) else { return nil }
        let frames = AVAudioFrameCount(file.length)
        guard frames > 0, let raw = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frames),
              (try? file.read(into: raw)) != nil, let src = raw.floatChannelData else { return nil }
        guard raw.format.sampleRate == format.sampleRate else {
            // The asset rules say 48 kHz; a file that is not is skipped, and said so (round 1 M6).
            log.warning("Skipped \(entry.id, privacy: .public): \(raw.format.sampleRate, privacy: .public) Hz, not 48000 Hz")
            return nil
        }
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
        let sfx = master * Float(max(0, min(100, volume))) / 100
        sfxMixer.outputVolume = sfx
        worldMixer.outputVolume = sfx * worldDuckGain
        voiceMixer.outputVolume = master * Float(max(0, min(100, voiceVolume))) / 100
        // Another app's music wins over ours (silent switch is the session's job).
        musicMixer.outputVolume = otherAudioPlaying ? 0 : master * Float(max(0, min(100, musicVolume))) / 100 * duckGain
    }

    /// Shifts music and active loop playback rate gently during battle slow-motion moments.
    func setSlowMotion(_ scale: Float) {
        let clamped = max(0.35, min(1.0, scale))
        guard abs(clamped - slowMoScale) > 0.005 else { return }
        slowMoScale = clamped
        let rate = audioSlowRate
        musicSpeed.rate = rate
        for (id, loop) in loops {
            let pitch = loopWanted[id]?.pitch ?? 0
            loop.pitch.rate = Float(pow(2, pitch / 12)) * rate
        }
    }

    private var audioSlowRate: Float {
        slowMoScale < 0.99 ? max(0.72, 0.6 + 0.4 * slowMoScale) : 1.0
    }

    // MARK: SFX

    private func nextRandom() -> Double {
        rng ^= rng << 13
        rng ^= rng >> 17
        rng ^= rng << 5
        return Double(rng % 10_000) / 10_000
    }

    /// Plays one sound. `pitch` in semitones on top of the manifest's random shift.
    /// `pan` is stereo placement from -1 (left) to +1 (right), clamped to +/-0.8.
    func play(_ id: String, pitch: Double = 0, gain: Float = 1, pan: Float = 0) {
        guard unlocked, !muted, !held else { return }
        guard let entry = manifest.sounds[id] else { return }
        if entry.kind == "music" || entry.kind == "sting" {
            playSting(id)
            return
        }
        guard prepare(), let buffer = buffer(id), buffer.frameLength > 0, !voices.isEmpty else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        var times = (recent[id] ?? []).filter { now &- $0 < 50_000_000 }
        guard times.count < 3 else { return }
        times.append(now)
        recent[id] = times
        let index = pool.pick(now: now)
        let v = voices[index]
        // A stolen voice stops; its old completion handler names an old generation and is ignored.
        v.player.stop()
        let shift = pitch + (entry.pitchVar > 0 ? (nextRandom() * 2 - 1) * entry.pitchVar : 0)
        let rate = pow(2, shift / 12)
        v.pitch.rate = Float(rate)
        v.panner.pan = max(-0.8, min(0.8, pan))
        v.player.volume = max(0, min(1, entry.volume * gain))
        let seconds = Double(buffer.frameLength) / max(1, buffer.format.sampleRate) / max(0.25, rate)
        let generation = pool.start(index, now: now, seconds: seconds, bus: entry.bus)
        let me = WeakRef(self)
        v.player.scheduleBuffer(buffer, at: nil, options: [], completionCallbackType: .dataPlayedBack) { _ in
            DispatchQueue.main.async {
                MainActor.assumeIsolated { me.value?.pool.finished(index, generation: generation) }
            }
        }
        guard ensureRunning() else { return }
        v.player.play()
        if let db = manifest.duckDb[entry.bus], id != "hit_blast_tiny" { duck(db: db) }
    }

    /// Ducks the music for a moment (ramped over 30 ms down, 400 ms back).
    private func duck(db: Double) {
        duckTarget = min(duckTarget, Float(pow(10, db / 20)))
        duckUntil = DispatchTime.now().uptimeNanoseconds + 200_000_000
        startFades()
    }

    /// Ducks world ambience loops when a Hob bark plays (30 ms attack, 400 ms release).
    private func duckWorld(db: Double) {
        worldDuckTarget = min(worldDuckTarget, Float(pow(10, db / 20)))
        worldDuckUntil = DispatchTime.now().uptimeNanoseconds + 250_000_000
        startFades()
    }

    // MARK: Loops

    /// Live loop voices (tests and the leak check: stopped loops leave the graph).
    var loopNodeCount: Int { loops.count }
    /// Desired loops remembered across mute/pause/route changes.
    var wantedLoopCount: Int { loopWanted.count }
    /// Nodes attached to the engine (tests: loops that stop leave nothing behind).
    var attachedNodeCount: Int { engine.attachedNodes.count }

    /// Starts or updates a looping sound (wind, Squall, whistles). Volume 0 stops it.
    func setLoop(_ id: String, gain: Float, pitch: Double = 0) {
        guard unlocked else { return }
        if gain <= 0.001 {
            loopWanted[id] = nil
            removeLoop(id)
            return
        }
        loopWanted[id] = (gain, pitch)
        if muted {
            removeLoop(id)
            return
        }
        guard let entry = manifest.sounds[id], prepare() else { return }
        if loops[id] == nil {
            guard let buffer = buffer(id), buffer.frameLength > 0 else { return }
            let p = AVAudioPlayerNode()
            let v = AVAudioUnitVarispeed()
            let targetMixer = entry.bus == "world" ? worldMixer : sfxMixer
            engine.attach(p)
            engine.attach(v)
            engine.connect(p, to: v, format: format)
            engine.connect(v, to: targetMixer, format: format)
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
            loops[id] = (p, v)
            guard ensureRunning() else {
                removeLoop(id)
                return
            }
            p.play()
        }
        if let l = loops[id] {
            l.player.volume = max(0, min(1, entry.volume * gain))
            l.pitch.rate = Float(pow(2, pitch / 12)) * audioSlowRate
        }
    }

    /// Stops a loop and takes both of its nodes out of the graph (review 2, M4).
    private func removeLoop(_ id: String) {
        guard let l = loops[id] else { return }
        l.player.stop()
        engine.disconnectNodeOutput(l.player)
        engine.disconnectNodeOutput(l.pitch)
        engine.detach(l.player)
        engine.detach(l.pitch)
        loops[id] = nil
    }

    private func removeAllLoops() {
        for id in Array(loops.keys) { removeLoop(id) }
        loopWanted = [:]
    }

    /// The loops that should sound, after the engine came back.
    private func restoreLoops() {
        guard !muted else { return }
        for (id, want) in loopWanted where loops[id] == nil {
            setLoop(id, gain: want.gain, pitch: want.pitch)
        }
    }

    func stopLoops() {
        removeAllLoops()
    }

    // MARK: Music

    /// Region 1 battle music: Base, Stir and Peril start on the same sample; Stir and Peril silent.
    func startBattleMusic() {
        stopSting()
        guard musicTrack != "mus_r1" else { return }
        stopMusic()
        guard unlocked else { return }
        guard prepare() else {
            suspendedTrack = "mus_r1"
            return
        }
        musicTrack = "mus_r1"
        let ids = ["base": "mus_r1_base", "stir": "mus_r1_stir", "peril": "mus_r1_peril"]
        for (layer, id) in ids {
            guard let entry = manifest.sounds[id], let url = Self.url(for: entry), let file = try? AVAudioFile(forReading: url) else { continue }
            let rawFrames = entry.samples > 0 ? min(Int64(entry.samples), file.length) : file.length
            guard rawFrames > 0 else { continue }
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: musicMixer, format: file.processingFormat)
            layers[layer] = p
            layerFiles[layer] = file
            let gain: Float = layer == "base" ? 1 : 0
            layerGain[layer] = gain
            layerTarget[layer] = gain
            p.volume = gain
            // Two copies queued; each finished copy queues the next, so the loop never gaps.
            scheduleLoop(p, file: file, frames: AVAudioFrameCount(rawFrames), copies: 2)
        }
        startLayersTogether(token: musicToken, tries: 25)
    }

    /// One start time for every layer on the engine's sample clock, a little ahead, so they
    /// share the first sample. Right after the engine starts that clock is not valid yet:
    /// wait a short tick and look again, never start a layer alone (review 2, M5).
    private func startLayersTogether(token: Int, tries: Int) {
        guard token == musicToken, !layers.isEmpty else { return }
        guard ensureRunning() else { return }
        if let last = engine.outputNode.lastRenderTime, last.isSampleTimeValid, last.sampleRate > 0 {
            let at = AVAudioTime(sampleTime: last.sampleTime + AVAudioFramePosition(0.12 * last.sampleRate), atRate: last.sampleRate)
            for p in layers.values { p.play(at: at) }
            #if DEBUG
            checkLayersLocked(token: token)
            #endif
            return
        }
        guard tries > 0 else {
            // The clock never came (no output device): start them in one go, the best left.
            guard ensureRunning() else { return }
            for p in layers.values { p.play(at: nil) }
            return
        }
        let me = WeakRef(self)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) {
            MainActor.assumeIsolated { me.value?.startLayersTogether(token: token, tries: tries - 1) }
        }
    }

    #if DEBUG
    /// Debug builds: half a second in, the three layers' own sample times must agree.
    private func checkLayersLocked(token: Int) {
        let me = WeakRef(self)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            MainActor.assumeIsolated {
                guard let engine = me.value, engine.musicToken == token else { return }
                let times = engine.layers.values.compactMap { p -> AVAudioFramePosition? in
                    guard let node = p.lastRenderTime, let t = p.playerTime(forNodeTime: node) else { return nil }
                    return t.sampleTime
                }
                if let lo = times.min(), let hi = times.max(), hi - lo > 0 {
                    SoundEngine.log.warning("Music layers out of step by \(hi - lo, privacy: .public) samples")
                }
            }
        }
    }
    #endif

    private func scheduleLoop(_ p: AVAudioPlayerNode, file: AVAudioFile, frames: AVAudioFrameCount, copies: Int) {
        guard frames > 0 else { return }
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
        if stingPlaying {
            pendingMusicAfterSting = id
            return
        }
        guard musicTrack != id else { return }
        stopMusic()
        guard unlocked, let entry = manifest.sounds[id], let url = Self.url(for: entry) else { return }
        guard prepare() else {
            suspendedTrack = id
            return
        }
        guard let file = try? AVAudioFile(forReading: url) else { return }
        let rawFrames = entry.samples > 0 ? min(Int64(entry.samples), file.length) : file.length
        guard rawFrames > 0 else { return }
        musicTrack = id
        let p = AVAudioPlayerNode()
        engine.attach(p)
        engine.connect(p, to: musicMixer, format: file.processingFormat)
        layers["base"] = p
        layerFiles["base"] = file
        layerGain["base"] = 1
        layerTarget["base"] = 1
        scheduleLoop(p, file: file, frames: AVAudioFrameCount(rawFrames), copies: 2)
        guard ensureRunning() else {
            stopMusic()
            suspendedTrack = id
            return
        }
        p.play()
    }

    /// Stir and Peril on or off; the fade starts on the next bar line and lasts one bar.
    func setLayers(stir: Bool, peril: Bool) {
        guard musicTrack == "mus_r1" else { return }
        layerTarget["stir"] = stir || peril ? 1 : 0
        layerTarget["peril"] = peril ? 1 : 0
        startFades()
    }

    private var hasPendingFades: Bool {
        for (layer, target) in layerTarget {
            if abs((layerGain[layer] ?? 0) - target) > 0.001 { return true }
        }
        return duckGain < 0.999 || duckTarget < 0.999 || worldDuckGain < 0.999 || worldDuckTarget < 0.999
    }

    private func startFades() {
        guard !held, engine.isRunning, !cleanup.hasTimer else { return }
        let me = WeakRef(self)
        let timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { _ in
            MainActor.assumeIsolated { me.value?.fadeStep() }
        }
        cleanup.setTimer(timer)
    }

    private func stopFades() {
        noClockTicks = 0
        cleanup.setTimer(nil)
    }

    private var fadeStartedOnBar: [String: Bool] = [:]
    private var noClockTicks = 0

    private func fadeStep() {
        guard engine.isRunning else {
            stopFades()
            return
        }
        let dt = 1.0 / 60
        let bar = manifest.sounds["mus_r1_base"]?.barSeconds ?? 1.111111
        // Where the Base layer is in its loop, from its own sample clock.
        let hasClock: Bool
        let intoBar: Double
        if let base = layers["base"], let node = base.lastRenderTime, let t = base.playerTime(forNodeTime: node), t.sampleRate > 0 {
            let elapsed = max(0, Double(t.sampleTime) / t.sampleRate)
            intoBar = bar > 0 ? elapsed.truncatingRemainder(dividingBy: bar) : 0
            hasClock = true
            noClockTicks = 0
        } else {
            intoBar = 0
            hasClock = false
            noClockTicks += 1
        }
        var busy = false
        for (layer, target) in layerTarget {
            let gain = layerGain[layer] ?? 0
            guard abs(gain - target) > 0.001 else { fadeStartedOnBar[layer] = false; continue }
            if !hasClock && noClockTicks > 90 {
                // No render clock (e.g. headless output): stop spinning rather than running at 60 Hz forever.
                layerGain[layer] = target
                layers[layer]?.volume = target
                fadeStartedOnBar[layer] = false
                continue
            }
            busy = true
            // Wait for a valid engine clock near a bar line before starting the fade.
            if fadeStartedOnBar[layer] != true {
                guard hasClock, intoBar < dt + 0.008 else { continue }
                fadeStartedOnBar[layer] = true
            }
            let step = Float(dt / max(0.2, bar))
            let next = gain < target ? min(target, gain + step) : max(target, gain - step)
            layerGain[layer] = next
            layers[layer]?.volume = next
        }
        // Smooth duck envelope: 30 ms attack down, 400 ms release back up.
        let now = DispatchTime.now().uptimeNanoseconds
        let attackStep = Float(dt / 0.03)
        let releaseStep = Float(dt / 0.4)
        var volumeChanged = false
        if now > duckUntil { duckTarget = 1 }
        if abs(duckGain - duckTarget) > 0.001 {
            if duckGain > duckTarget {
                duckGain = max(duckTarget, duckGain - attackStep)
            } else {
                duckGain = min(duckTarget, duckGain + releaseStep)
            }
            volumeChanged = true
            busy = true
        } else if duckGain < 0.999 {
            busy = true
        }
        if now > worldDuckUntil { worldDuckTarget = 1 }
        if abs(worldDuckGain - worldDuckTarget) > 0.001 {
            if worldDuckGain > worldDuckTarget {
                worldDuckGain = max(worldDuckTarget, worldDuckGain - attackStep)
            } else {
                worldDuckGain = min(worldDuckTarget, worldDuckGain + releaseStep)
            }
            volumeChanged = true
            busy = true
        } else if worldDuckGain < 0.999 {
            busy = true
        }
        if volumeChanged { applyVolume() }
        if !busy { stopFades() }
    }

    /// Stops any playing sting and clears any music queued behind it.
    func stopSting() {
        stingToken += 1
        stingPlaying = false
        pendingMusicAfterSting = nil
        stingPlayer?.stop()
    }

    /// The win or lose sting: the layers stop, then the sting plays once.
    func playSting(_ id: String) {
        stopMusic()
        guard unlocked, !muted, !held, let entry = manifest.sounds[id], prepare(),
              let url = Self.url(for: entry), let file = try? AVAudioFile(forReading: url),
              file.length > 0 else { return }
        let p = stingPlayer ?? AVAudioPlayerNode()
        if stingPlayer == nil {
            engine.attach(p)
            stingPlayer = p
        }
        engine.disconnectNodeOutput(p)
        engine.connect(p, to: musicMixer, format: file.processingFormat)
        p.stop()
        stingToken += 1
        let token = stingToken
        stingPlaying = true
        pendingMusicAfterSting = nil
        let me = WeakRef(self)
        p.scheduleFile(file, at: nil, completionCallbackType: .dataPlayedBack) { _ in
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    guard let sound = me.value, sound.stingToken == token else { return }
                    sound.stingPlaying = false
                    if let next = sound.pendingMusicAfterSting {
                        sound.pendingMusicAfterSting = nil
                        sound.playMusic(next)
                    }
                }
            }
        }
        guard ensureRunning() else {
            stingPlaying = false
            return
        }
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
        suspendedTrack = nil
        musicToken += 1
        duckGain = 1
        duckTarget = 1
        applyVolume()
        if !hasPendingFades { stopFades() }
    }

    // MARK: Barks (Hob-speak)

    /// A bark: one per side per turn step, 1.5 s apart; most events at the chance barks.json
    /// gives (40%), Bonks and wins always. `mates` are the content ids of the Hob's crew, for the
    /// `with_mate` lines; `rival` is the named Rival's short name, for the `with_rival` lines.
    func bark(hob def: String, event: String, side: Int, mates: [String] = [], rival: String? = nil) {
        guard let art = SpriteImages.hobArtName(id: def, name: "") else { return }
        let id = "bark_\(art)_\(event)"
        guard manifest.sounds[id] != nil else { return }
        let lines = manifest.barkLines[id]
        let always = event == "bonked" || event == "win"
        let chance = lines?.chance ?? manifest.eventChance[event] ?? 0.4
        let now = DispatchTime.now().uptimeNanoseconds
        guard always || (now &- lastBark > 1_500_000_000 && !barkSides.contains(side) && nextRandom() < chance) else { return }
        lastBark = now
        barkSides.insert(side)
        playVoice(id)
        let pool = lines?.pool(mates: mates.filter { $0 != def }, rival: rival) ?? []
        if !pool.isEmpty {
            var pick = pool[Int(nextRandom() * Double(pool.count)) % pool.count]
            if pick == lastLines[id], pool.count > 1 { pick = pool.first { $0 != pick } ?? pick }
            lastLines[id] = pick
            onSubtitle?(pick, side)
        }
        if event == "win" { crewWinLine(side: side) }
    }

    /// The crew's win line (`crew.win`), shown once after the Hob's own win line.
    private func crewWinLine(side: Int) {
        guard !manifest.crewWin.isEmpty else { return }
        let line = manifest.crewWin[Int(nextRandom() * Double(manifest.crewWin.count)) % manifest.crewWin.count]
        crewWinTask?.cancel()
        crewWinTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            guard !Task.isCancelled, let self else { return }
            self.onSubtitle?(line, side)
        }
    }

    /// A new turn step: each side may bark again.
    func newTurnStep() { barkSides = [] }

    private func playVoice(_ id: String) {
        guard unlocked, !muted, !held, voiceVolume > 0, prepare(),
              let buffer = buffer(id), buffer.frameLength > 0, !barkVoices.isEmpty else { return }
        let p = barkVoices[nextBarkVoice % barkVoices.count]
        nextBarkVoice += 1
        p.stop()
        p.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        guard ensureRunning() else { return }
        p.play()
        duck(db: manifest.duckDb["voice"] ?? -3)
        duckWorld(db: manifest.worldDuckDb)
    }
}

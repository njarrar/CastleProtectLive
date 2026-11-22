import AVFoundation

/// Sound effects through AVAudioEngine with pre-loaded PCM buffers.
///
/// Cues are picked from the core's events (fire, explode, break, bonk,
/// kettle_pop, turn_start, win). Each cue loads `sounds/<cue>.caf`, `.wav` or
/// `.m4a` from the app bundle (assets/sounds, copied at build time, mono
/// 44.1 kHz float); a cue with no file uses a small generated sound so v0.1 is
/// never silent. The session is `ambient`, so the silent switch and the
/// player's own music are respected.
@MainActor
final class SoundEngine {
    static let cues = [
        "ui_tap", "ui_sheet_open", "ui_card_pick", "fire_launch", "blast_small", "blast_large",
        "block_break", "hob_bonk", "kettle_pop", "turn_yours", "turn_theirs", "pennant_stamp",
        "win_fanfare", "loss_sting", "squall_warn",
    ]

    private let engine = AVAudioEngine()
    private var players: [AVAudioPlayerNode] = []
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var nextPlayer = 0
    private var started = false
    private var failed = false
    private let format: AVAudioFormat

    /// 0 to 100.
    var volume = 70 { didSet { applyVolume() } }
    var muted = false { didSet { applyVolume() } }

    init() {
        format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)
            ?? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 44_100, channels: 1, interleaved: false)!
    }

    func play(_ cue: String) {
        guard !muted, volume > 0 else { return }
        guard prepare() else { return }
        guard let buffer = buffer(for: cue), !players.isEmpty else { return }
        let player = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        if player.isPlaying { player.stop() }
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        player.play()
    }

    /// Stops all sound, for the Pause card and app switches.
    func pause() {
        guard started else { return }
        for p in players { p.stop() }
        engine.pause()
    }

    func resume() {
        guard started, !engine.isRunning else { return }
        try? engine.start()
    }

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
        for _ in 0..<8 {
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: engine.mainMixerNode, format: format)
            players.append(p)
        }
        applyVolume()
        do {
            try engine.start()
            started = true
        } catch {
            failed = true
        }
        return started
    }

    private func applyVolume() {
        engine.mainMixerNode.outputVolume = muted ? 0 : Float(max(0, min(100, volume))) / 100
    }

    private func buffer(for cue: String) -> AVAudioPCMBuffer? {
        if let b = buffers[cue] { return b }
        let b = loadFile(cue) ?? Self.synth(cue, format: format)
        buffers[cue] = b
        return b
    }

    private func loadFile(_ cue: String) -> AVAudioPCMBuffer? {
        for ext in ["caf", "wav", "m4a"] {
            guard let url = Bundle.main.url(forResource: cue, withExtension: ext, subdirectory: "sounds")
                ?? Bundle.main.url(forResource: cue, withExtension: ext) else { continue }
            guard let file = try? AVAudioFile(forReading: url) else { continue }
            let frames = AVAudioFrameCount(file.length)
            guard frames > 0,
                  let raw = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frames),
                  (try? file.read(into: raw)) != nil else { continue }
            if raw.format.sampleRate == format.sampleRate && raw.format.channelCount == format.channelCount
                && raw.format.commonFormat == format.commonFormat {
                return raw
            }
        }
        return nil
    }

    /// A short generated sound per cue: a pitched blip, a noise burst, or both.
    static func synth(_ cue: String, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let rate = format.sampleRate
        let spec: (Double, Double, Double, Double)
        switch cue {
        case "fire_launch": spec = (0.25, 180, 0.6, -0.5)
        case "blast_small": spec = (0.35, 90, 0.9, -0.6)
        case "blast_large": spec = (0.6, 60, 1.0, -0.7)
        case "block_break": spec = (0.2, 320, 0.7, -0.3)
        case "hob_bonk": spec = (0.3, 520, 0.1, 0.8)
        case "kettle_pop": spec = (0.7, 880, 0.5, 1.0)
        case "turn_yours": spec = (0.25, 660, 0, 0.2)
        case "turn_theirs": spec = (0.25, 440, 0, -0.1)
        case "pennant_stamp": spec = (0.2, 520, 0.3, 0)
        case "win_fanfare": spec = (0.6, 523, 0, 0.5)
        case "loss_sting": spec = (0.5, 330, 0, -0.4)
        case "squall_warn": spec = (0.5, 120, 0.8, 0.2)
        case "ui_sheet_open": spec = (0.12, 700, 0.1, 0.3)
        default: spec = (0.06, 900, 0, 0)
        }
        let (duration, pitch, noise, sweep) = spec
        let frames = AVAudioFrameCount(duration * rate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let channel = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frames
        var seed: UInt32 = 0x1234_5678
        var phase = 0.0
        for i in 0..<Int(frames) {
            let t = Double(i) / rate
            let progress = t / duration
            let envelope = min(1, t * 200) * pow(1 - progress, 2)
            let freq = pitch * (1 + sweep * progress)
            phase += 2 * .pi * freq / rate
            seed = seed &* 1_664_525 &+ 1_013_904_223
            let white = Double(seed >> 8) / Double(1 << 24) * 2 - 1
            let tone = sin(phase) * (1 - noise)
            channel[i] = Float((tone + white * noise) * envelope * 0.5)
        }
        return buffer
    }
}

import CoreHaptics
import UIKit

/// A weak reference that can cross into system callbacks.
final class WeakRef<T: AnyObject>: @unchecked Sendable {
    weak var value: T?
    init(_ value: T) { self.value = value }
}

/// Plays the haptic table from the UX doc (6.5) with Core Haptics, falling
/// back to UIKit feedback generators on devices without a haptic engine.
/// The core sends `haptic` events with a kind; the app plays them.
@MainActor
final class Haptics {
    enum Kind: String, CaseIterable, Sendable {
        case tick, dragStart = "drag_start", fire
        case blastSmall = "blast_small", blastLarge = "blast_large"
        case chunk, hobHit = "hob_hit", bonkTheirs = "bonk_theirs", bonkYours = "bonk_yours"
        case kettlePop = "kettle_pop", thump, threaded, pennant, illegal

        /// The Light setting keeps wins, Bonks and Fire only.
        var inLightSet: Bool {
            switch self {
            case .fire, .bonkTheirs, .bonkYours, .kettlePop, .pennant: return true
            default: return false
            }
        }
    }

    var level: HapticsLevel = .full
    private var engine: CHHapticEngine?
    private let supportsHaptics: Bool
    /// One player per kind, made once (M7).
    private var players: [Kind: CHHapticPatternPlayer] = [:]
    private var running = false
    /// Times of recent patterns, to keep a cluster shot to a few a moment.
    private var recent: [UInt64] = []
    /// Cached UIKit fallback generators (reused across impacts instead of allocating per event).
    private let selectionGenerator = UISelectionFeedbackGenerator()
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let rigidImpact = UIImpactFeedbackGenerator(style: .rigid)
    private let notificationGenerator = UINotificationFeedbackGenerator()

    init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        if supportsHaptics {
            engine = try? CHHapticEngine()
            engine?.isAutoShutdownEnabled = true
            engine?.playsHapticsOnly = true
            // After a server reset or a stop, players are stale: make them again (M7).
            let me = WeakRef(self)
            engine?.resetHandler = {
                Task { @MainActor in me.value?.engineLost() }
            }
            engine?.stoppedHandler = { _ in
                Task { @MainActor in me.value?.engineLost() }
            }
        }
    }

    private func engineLost() {
        players = [:]
        running = false
    }

    /// Starts the engine when a battle opens, so the first blast does not pay for it.
    func warmUp() {
        guard level != .off else { return }
        if let engine, !running {
            do {
                try engine.start()
                running = true
                return
            } catch {
                running = false
            }
        }
        if engine == nil || !running {
            selectionGenerator.prepare()
            lightImpact.prepare()
            mediumImpact.prepare()
            heavyImpact.prepare()
            rigidImpact.prepare()
            notificationGenerator.prepare()
        }
    }

    func play(_ name: String) {
        if let kind = Kind(rawValue: name) { play(kind) }
    }

    func play(_ kind: Kind) {
        switch level {
        case .off: return
        case .light where !kind.inLightSet: return
        default: break
        }
        let now = DispatchTime.now().uptimeNanoseconds
        recent.removeAll { now &- $0 > 100_000_000 }
        guard recent.count < 4 else { return }
        recent.append(now)
        if let engine, let pattern = Self.pattern(kind) {
            do {
                if !running {
                    try engine.start()
                    running = true
                }
                let player: CHHapticPatternPlayer
                if let cached = players[kind] {
                    player = cached
                } else {
                    player = try engine.makePlayer(with: pattern)
                    players[kind] = player
                }
                try player.start(atTime: CHHapticTimeImmediate)
                return
            } catch {
                engineLost()
                // Fall through to the UIKit generators.
            }
        }
        fallback(kind)
    }

    private func fallback(_ kind: Kind) {
        switch kind {
        case .tick:
            selectionGenerator.selectionChanged()
            selectionGenerator.prepare()
        case .dragStart, .threaded:
            lightImpact.impactOccurred()
            lightImpact.prepare()
        case .fire, .blastSmall, .pennant:
            mediumImpact.impactOccurred()
            mediumImpact.prepare()
        case .blastLarge, .hobHit, .thump, .kettlePop:
            heavyImpact.impactOccurred()
            heavyImpact.prepare()
        case .chunk:
            rigidImpact.impactOccurred()
            rigidImpact.prepare()
        case .bonkTheirs:
            notificationGenerator.notificationOccurred(.success)
            notificationGenerator.prepare()
        case .bonkYours:
            notificationGenerator.notificationOccurred(.warning)
            notificationGenerator.prepare()
        case .illegal:
            notificationGenerator.notificationOccurred(.error)
            notificationGenerator.prepare()
        }
    }

    /// (time in seconds, intensity, sharpness) for each transient. No pattern lasts over 0.5 s.
    static func taps(_ kind: Kind) -> [(Double, Float, Float)] {
        switch kind {
        case .tick: return [(0, 0.35, 0.9)]
        case .dragStart: return [(0, 0.45, 0.6)]
        case .fire: return [(0, 0.7, 0.5)]
        case .blastSmall: return [(0, 0.7, 0.4)]
        case .blastLarge: return [(0, 1.0, 0.3)]
        case .chunk: return [(0, 0.8, 0.9)]
        case .hobHit: return [(0, 1.0, 0.4), (0.08, 0.45, 0.6)]
        case .bonkTheirs: return [(0, 0.6, 0.7), (0.1, 0.9, 0.7)]
        case .bonkYours: return [(0, 0.9, 0.3), (0.12, 0.6, 0.3)]
        case .kettlePop: return [(0, 0.6, 0.3), (0.18, 0.8, 0.3), (0.36, 1.0, 0.3)]
        case .thump: return [(0, 1.0, 0.1)]
        case .threaded: return [(0, 0.45, 0.9), (0.06, 0.45, 0.9)]
        case .pennant: return [(0, 0.7, 0.5)]
        case .illegal: return [(0, 0.3, 0.2), (0.07, 0.3, 0.2)]
        }
    }

    private static func pattern(_ kind: Kind) -> CHHapticPattern? {
        let events = taps(kind).map { t, intensity, sharpness in
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
                ],
                relativeTime: t
            )
        }
        return try? CHHapticPattern(events: events, parameters: [])
    }
}

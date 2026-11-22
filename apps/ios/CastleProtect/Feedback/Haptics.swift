import CoreHaptics
import UIKit

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

    init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        if supportsHaptics {
            engine = try? CHHapticEngine()
            engine?.isAutoShutdownEnabled = true
            engine?.playsHapticsOnly = true
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
        if let engine, let pattern = Self.pattern(kind) {
            do {
                try engine.start()
                let player = try engine.makePlayer(with: pattern)
                try player.start(atTime: CHHapticTimeImmediate)
                return
            } catch {
                // Fall through to the UIKit generators.
            }
        }
        fallback(kind)
    }

    private func fallback(_ kind: Kind) {
        switch kind {
        case .tick:
            UISelectionFeedbackGenerator().selectionChanged()
        case .dragStart, .threaded:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .fire, .blastSmall, .pennant:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .blastLarge, .hobHit, .thump, .kettlePop:
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case .chunk:
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        case .bonkTheirs:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .bonkYours:
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case .illegal:
            UINotificationFeedbackGenerator().notificationOccurred(.error)
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

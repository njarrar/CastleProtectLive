import SwiftUI
import UIKit

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }
}

/// The art kit palette (docs/art/png/20-palette-and-style.png).
enum Theme {
    static let ink = Color(hex: 0x2B1E2E)
    static let inkSoft = Color(hex: 0x4A3A4C)
    static let paper = Color(hex: 0xFFF4DE)
    static let cream = Color(hex: 0xFBE9C4)
    static let gold = Color(hex: 0xFFC23D)
    static let goldDark = Color(hex: 0xD9952B)
    static let pennant = Color(hex: 0xFFD23F)
    static let kettleGlow = Color(hex: 0x4FE3C1)
    static let good = Color(hex: 0x5CC35A)
    static let slate = Color(hex: 0x6F7E9A)
    static let sky = Color(hex: 0xA6DCEF)
    static let grass = Color(hex: 0x8BCB3A)

    static func side(_ side: Int, _ set: ColourSet = .brickabrac) -> Color {
        switch set {
        case .brickabrac: return side == 0 ? Color(hex: 0x2F6FDE) : Color(hex: 0xE8730C)
        case .dusk: return side == 0 ? Color(hex: 0x1B2A6B) : Color(hex: 0xF2C200)
        case .ink: return side == 0 ? Color.white : Color(hex: 0x1A1A1A)
        }
    }

    /// Text size steps (UX 7.2): the system text size, capped so the HUD still
    /// fits, times 1.2 with the Large text setting. Set from AppModel.
    nonisolated(unsafe) static var largeText = false

    /// A point size scaled for the reader's text size, never under the 12 pt floor.
    static func scaled(_ size: CGFloat) -> CGFloat {
        let system = UIFontMetrics.default.scaledValue(for: size)
        let capped = min(system, size * 1.4)
        return max(12, capped * (largeText ? 1.2 : 1))
    }

    static func title(_ size: CGFloat) -> Font { .system(size: scaled(size), weight: .heavy, design: .rounded) }
    static func label(_ size: CGFloat) -> Font { .system(size: scaled(size), weight: .semibold, design: .rounded) }
    static func number(_ size: CGFloat) -> Font { .system(size: scaled(size), weight: .bold, design: .rounded).monospacedDigit() }
}

/// Places a view at a rect given in the parent's coordinate space.
extension View {
    func place(_ rect: CGRect) -> some View {
        frame(width: max(0, rect.width), height: max(0, rect.height))
            .position(x: rect.midX, y: rect.midY)
    }

    /// Paper panel with the ink outline used on every card.
    func panel(corner: CGFloat = 18, fill: Color = Theme.paper) -> some View {
        background(
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(fill)
                .overlay(RoundedRectangle(cornerRadius: corner, style: .continuous).stroke(Theme.ink, lineWidth: 3))
        )
    }
}

/// The gold main button (Play, Fight, Fire, Next). Acts on release inside, as every button does.
struct GoldButtonStyle: ButtonStyle {
    var height: CGFloat = 56
    var minWidth: CGFloat = 160

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.title(22))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 24)
            .frame(minWidth: minWidth, minHeight: height)
            .background(
                RoundedRectangle(cornerRadius: height / 2, style: .continuous)
                    .fill(configuration.isPressed ? Theme.goldDark : Theme.gold)
                    .overlay(RoundedRectangle(cornerRadius: height / 2, style: .continuous).stroke(Theme.ink, lineWidth: 3))
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .contentShape(Rectangle())
    }
}

struct PaperButtonStyle: ButtonStyle {
    var height: CGFloat = 48

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.label(17))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 16)
            .frame(minHeight: height)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(configuration.isPressed ? Theme.cream : Theme.paper)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.ink, lineWidth: 2.5))
            )
            .contentShape(Rectangle())
    }
}

/// A sprite from assets/sprites, or an SF Symbol when the sprite is missing.
struct SpriteIcon: View {
    let name: String
    var fallback: String = "circle.fill"
    var size: CGFloat = 32

    var body: some View {
        if let img = SpriteImages.image(name) {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Image(systemName: fallback)
                .resizable()
                .scaledToFit()
                .frame(width: size * 0.7, height: size * 0.7)
                .frame(width: size, height: size)
                .foregroundStyle(Theme.ink)
                .accessibilityHidden(true)
        }
    }
}

/// The repeat loop behind a held key. It ends when cancelled, when the
/// action refuses (returns false), or when its owner goes away, so a held key
/// can never repeat for ever (C1, UX 3.10 rule 6).
@MainActor
final class Repeater {
    private var task: Task<Void, Never>?
    /// True once the held key has acted at least once by repeating.
    private(set) var repeated = false

    var isRunning: Bool { task != nil }

    nonisolated init() {}

    func start(delay: Double, rate: Double, fastRate: Double, action: @escaping @MainActor () -> Bool) {
        cancel()
        repeated = false
        task = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(max(0, delay) * 1_000_000_000))
            let begun = Date()
            while !Task.isCancelled {
                self?.repeated = true
                if !action() { break }
                let r = Date().timeIntervalSince(begun) > 1 ? fastRate : rate
                try? await Task.sleep(nanoseconds: UInt64(1_000_000_000 / max(1, r)))
            }
            if !Task.isCancelled { self?.task = nil }
        }
    }

    func cancel() {
        task?.cancel()
        task = nil
    }
}

/// A button that acts on release with no minimum press, and repeats while
/// held (first repeat at `delay`, then `rate` a second, rising to `fastRate`
/// after a second). A press that repeated does not also act on release.
/// With `tapOnly` the hold does nothing extra (UX 3.10 rule 2).
///
/// The repeat stops when the finger lifts, when the system cancels the touch
/// (`@GestureState` resets), when the button leaves the screen, when the app
/// leaves the foreground, when the button is disabled, and when the action
/// refuses (C1).
struct RepeatButton<Label: View>: View {
    let delay: Double
    let rate: Double
    let fastRate: Double
    let tapOnly: Bool
    let accessibilityName: String
    let action: () -> Bool
    let label: () -> Label

    init(delay: Double = 0.35, rate: Double = 8, fastRate: Double = 20, tapOnly: Bool = false,
         accessibilityName: String, action: @escaping () -> Bool, @ViewBuilder label: @escaping () -> Label) {
        self.delay = delay
        self.rate = rate
        self.fastRate = fastRate
        self.tapOnly = tapOnly
        self.accessibilityName = accessibilityName
        self.action = action
        self.label = label
    }

    @GestureState private var isPressing = false
    @State private var pressed = false
    @State private var repeater = Repeater()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        label()
            .contentShape(Rectangle())
            .scaleEffect(pressed ? 0.94 : 1)
            .opacity(isEnabled ? 1 : 0.5)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .updating($isPressing) { _, state, _ in state = true }
                    .onChanged { _ in
                        guard !pressed, isEnabled else { return }
                        pressed = true
                        startRepeat()
                    }
                    .onEnded { value in
                        let didRepeat = repeater.repeated
                        stopRepeat()
                        let moved = hypot(value.translation.width, value.translation.height)
                        if !didRepeat && moved < 40 && isEnabled { _ = action() }
                    }
            )
            .onChange(of: isPressing) { pressing in
                if !pressing { stopRepeat() }
            }
            .onChange(of: scenePhase) { _ in stopRepeat() }
            .onChange(of: isEnabled) { enabled in
                if !enabled { stopRepeat() }
            }
            .onDisappear { stopRepeat() }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityName)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { _ = action() }
    }

    private func startRepeat() {
        guard !tapOnly else { return }
        let act = action
        repeater.start(delay: delay, rate: rate, fastRate: fastRate) { act() }
    }

    private func stopRepeat() {
        pressed = false
        repeater.cancel()
    }
}

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

    static func title(_ size: CGFloat) -> Font { .system(size: size, weight: .heavy, design: .rounded) }
    static func label(_ size: CGFloat) -> Font { .system(size: size, weight: .semibold, design: .rounded) }
    static func number(_ size: CGFloat) -> Font { .system(size: size, weight: .bold, design: .rounded).monospacedDigit() }
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

/// A button that acts on release with no minimum press, and repeats while
/// held (first repeat at `delay`, then `rate` a second, rising to `fastRate`
/// after a second). A press that repeated does not also act on release.
/// With `tapOnly` the hold does nothing extra (UX 3.10 rule 2).
struct RepeatButton<Label: View>: View {
    let delay: Double
    let rate: Double
    let fastRate: Double
    let tapOnly: Bool
    let accessibilityName: String
    let action: () -> Void
    let label: () -> Label

    init(delay: Double = 0.35, rate: Double = 8, fastRate: Double = 20, tapOnly: Bool = false,
         accessibilityName: String, action: @escaping () -> Void, @ViewBuilder label: @escaping () -> Label) {
        self.delay = delay
        self.rate = rate
        self.fastRate = fastRate
        self.tapOnly = tapOnly
        self.accessibilityName = accessibilityName
        self.action = action
        self.label = label
    }

    @State private var pressed = false
    @State private var repeated = false
    @State private var task: Task<Void, Never>?

    var body: some View {
        label()
            .contentShape(Rectangle())
            .scaleEffect(pressed ? 0.94 : 1)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard !pressed else { return }
                        pressed = true
                        repeated = false
                        startRepeat()
                    }
                    .onEnded { value in
                        pressed = false
                        task?.cancel()
                        task = nil
                        let moved = hypot(value.translation.width, value.translation.height)
                        if !repeated && moved < 40 { action() }
                    }
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityName)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { action() }
    }

    private func startRepeat() {
        guard !tapOnly else { return }
        task?.cancel()
        task = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            let begun = Date()
            while !Task.isCancelled {
                repeated = true
                action()
                let r = Date().timeIntervalSince(begun) > 1 ? fastRate : rate
                try? await Task.sleep(nanoseconds: UInt64(1_000_000_000 / max(1, r)))
            }
        }
    }
}

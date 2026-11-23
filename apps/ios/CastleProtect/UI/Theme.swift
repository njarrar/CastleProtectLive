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

/// The Part 2 WCAG AA+ Brickabrac design system palette and typography tokens.
enum Theme {
    // Ink & parchment hierarchy (13.4:1 AAA ink on paper/parchmentCard)
    static let ink = Color(hex: 0x2C221E)
    static let inkSoft = Color(hex: 0x5C4A3E)
    static let sepiaBorder = Color(hex: 0x8C6F4E)
    static let paper = Color(hex: 0xFFF4DE)
    static let parchmentCard = Color(hex: 0xFAF3E3)
    static let cream = Color(hex: 0xFBE9C4)

    // Brass bevel tokens (Tier-1 medallions & active controls)
    static let brassHi = Color(hex: 0xFFE08A)
    static let brassMid = Color(hex: 0xFFC23D)
    static let brassLo = Color(hex: 0xC88A2E)
    static let brassDeep = Color(hex: 0x8C5A14)
    static let gold = brassMid
    static let goldDark = brassLo
    static let pennant = Color(hex: 0xFFD23F)

    // Semantic WCAG AA+ status tokens
    static let goodBg = Color(hex: 0x1F6B29)        // 6.1:1 AA+ with white text
    static let goodSoft = Color(hex: 0x8BD888)      // AA+ with Theme.ink
    static let good = goodBg
    static let orangeInk = Color(hex: 0xA94D00)     // 5.4:1 AA for text/pills on cream
    static let orange = Color(hex: 0xE8730C)        // icons/fills with Theme.ink border
    static let badInk = Color(hex: 0xA61C24)        // 6.8:1 AA on badBg
    static let badBg = Color(hex: 0xFDECEE)
    static let badBorder = Color(hex: 0xC9363E)

    // World, cutaway & Flattener faction tokens
    static let kettleGlow = Color(hex: 0x4FE3C1)
    static let nookBack = Color(hex: 0x3B2D24)
    static let lanternGlow = Color(hex: 0xFFCE70)
    static let flattenerSlate = Color(hex: 0x5A6572)
    static let levelBubble = Color(hex: 0x4ADE80)
    static let slate = Color(hex: 0x5A6572)
    static let sky = Color(hex: 0xA6DCEF)
    static let grass = Color(hex: 0x8BCB3A)

    /// Team colour for icons, pips, rings and strokes.
    static func side(_ side: Int, _ set: ColourSet = .brickabrac) -> Color {
        switch set {
        case .brickabrac: return side == 0 ? Color(hex: 0x2F6FDE) : orange
        case .dusk: return side == 0 ? Color(hex: 0x1B2A6B) : Color(hex: 0xF2C200)
        case .ink: return side == 0 ? Color.white : Color(hex: 0x1A1A1A)
        }
    }

    /// Team text colour guaranteed >= 5.4:1 AA on light parchment (`paper` / `cream`).
    static func sideInk(_ side: Int, _ set: ColourSet = .brickabrac) -> Color {
        switch set {
        case .brickabrac: return side == 0 ? Color(hex: 0x1D4FA8) : orangeInk
        case .dusk: return side == 0 ? Color(hex: 0x1B2A6B) : Color(hex: 0x7A5C00)
        case .ink: return ink
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

/// Places a view at a rect given in the parent's coordinate space and provides the 3-tier HUD chrome.
extension View {
    func place(_ rect: CGRect) -> some View {
        frame(width: max(0, rect.width), height: max(0, rect.height))
            .position(x: rect.midX, y: rect.midY)
    }

    /// Paper panel with warm espresso outline used on cards and sheets.
    func panel(corner: CGFloat = 18, fill: Color = Theme.parchmentCard) -> some View {
        background(
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(fill)
                .overlay(
                    RoundedRectangle(cornerRadius: max(4, corner - 3), style: .continuous)
                        .stroke(Theme.sepiaBorder.opacity(0.32), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .padding(3)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .stroke(Theme.ink, lineWidth: 2.2)
                )
                .shadow(color: Theme.ink.opacity(0.16), radius: 2, x: 0, y: 2)
        )
    }

    /// Tier 1 HUD chrome: chunky beveled brass medallion / selected control (`2.5 pt` espresso border).
    func hudTier1(corner: CGFloat = 14, pressed: Bool = false) -> some View {
        background(
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: pressed
                            ? [Theme.brassMid, Theme.brassLo, Theme.brassDeep]
                            : [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: max(3, corner - 2), style: .continuous)
                        .stroke(Color.white.opacity(pressed ? 0.15 : 0.45), lineWidth: 1.2)
                        .padding(2)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .stroke(Theme.ink, lineWidth: 2.5)
                )
                .shadow(color: Theme.brassDeep.opacity(pressed ? 0.25 : 0.55), radius: 0, x: 0, y: pressed ? 1 : 3)
        )
    }

    /// Tier 2 HUD chrome: recessed stitched warm-parchment card (`1.5 pt` warm sepia border).
    func hudTier2Panel(corner: CGFloat = 14, fill: Color = Theme.parchmentCard) -> some View {
        background(
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(fill.opacity(0.94))
                .overlay(
                    RoundedRectangle(cornerRadius: max(3, corner - 3), style: .continuous)
                        .stroke(Theme.sepiaBorder.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .padding(2.5)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .stroke(Theme.sepiaBorder, lineWidth: 1.5)
                )
                .shadow(color: Theme.ink.opacity(0.14), radius: 1.5, x: 0, y: 1.5)
        )
    }

    /// Tier 3 HUD chrome: soft frosted translucent parchment pill (`1 pt` espresso border at 35% opacity).
    func hudTier3Pill(corner: CGFloat = 12, fill: Color = Theme.paper) -> some View {
        background(
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(fill.opacity(0.86))
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .stroke(Theme.ink.opacity(0.35), lineWidth: 1)
                )
                .shadow(color: Theme.ink.opacity(0.08), radius: 1, x: 0, y: 1)
        )
    }
}

/// Tier 1 beveled brass main button (Play, Fight, Fire, Next, Save). Acts on release inside.
struct GoldButtonStyle: ButtonStyle {
    var height: CGFloat = 56
    var minWidth: CGFloat = 160

    func makeBody(configuration: Configuration) -> some View {
        let clampedHeight = max(48, height)
        let clampedWidth = max(48, minWidth)
        configuration.label
            .font(Theme.title(22))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 22)
            .frame(minWidth: clampedWidth, minHeight: clampedHeight)
            .background(
                RoundedRectangle(cornerRadius: clampedHeight / 2, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: configuration.isPressed
                                ? [Theme.brassMid, Theme.brassLo]
                                : [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: max(6, clampedHeight / 2 - 2.5), style: .continuous)
                            .stroke(Color.white.opacity(configuration.isPressed ? 0.15 : 0.45), lineWidth: 1.4)
                            .padding(2.5)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: clampedHeight / 2, style: .continuous)
                            .stroke(Theme.ink, lineWidth: 2.5)
                    )
                    .shadow(color: Theme.brassDeep.opacity(configuration.isPressed ? 0.25 : 0.55),
                            radius: 0, x: 0, y: configuration.isPressed ? 1 : 3)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .contentShape(Rectangle())
    }
}

/// Tier 2 stitched-parchment secondary button (`>= 48 pt` hitbox floor).
struct PaperButtonStyle: ButtonStyle {
    var height: CGFloat = 48

    func makeBody(configuration: Configuration) -> some View {
        let clampedHeight = max(48, height)
        configuration.label
            .font(Theme.label(16))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 14)
            .frame(minWidth: 48, minHeight: clampedHeight)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(configuration.isPressed ? Theme.cream : Theme.parchmentCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .stroke(Theme.sepiaBorder.opacity(0.32), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                            .padding(2.5)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.sepiaBorder, lineWidth: 1.5)
                    )
                    .shadow(color: Theme.ink.opacity(configuration.isPressed ? 0.06 : 0.14),
                            radius: 0, x: 0, y: configuration.isPressed ? 0.5 : 1.5)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
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

// MARK: Crisp Vector SwiftUI Icons (Zero Unicode glyphs or blank boxes)

/// Brass Heartkettle pressure dial icon: loads regenerated `ui_kettle_dial_*` when present,
/// else draws a tactile copper-and-brass gauge with live needle angle and crack/steam states.
struct BrassKettleDialIcon: View {
    let percent: Int
    var side: Int = 0
    var colours: ColourSet = .brickabrac
    var size: CGFloat = 26

    private var state: String {
        percent <= 0 ? "popped" : (percent <= 25 ? "critical" : (percent <= 50 ? "hurt" : "full"))
    }

    var body: some View {
        if let img = SpriteImages.image("ui_kettle_dial_\(state)") ?? SpriteImages.image("ui_kettle_gauge_\(state)") {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Canvas { ctx, sz in
                let w = sz.width, h = sz.height
                let cx = w * 0.5, cy = h * 0.54
                let r = min(w, h) * 0.40
                let ink = Theme.ink

                // Top pressure valve cap
                let capRect = CGRect(x: cx - r * 0.34, y: cy - r * 1.24, width: r * 0.68, height: r * 0.34)
                ctx.fill(Path(roundedRect: capRect, cornerRadius: r * 0.14), with: .color(Theme.brassLo))
                ctx.stroke(Path(roundedRect: capRect, cornerRadius: r * 0.14), with: .color(ink), lineWidth: max(1, w * 0.055))

                // Outer brass bezel ring
                let bezel = Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
                ctx.fill(bezel, with: .linearGradient(
                    Gradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo]),
                    startPoint: CGPoint(x: cx, y: cy - r),
                    endPoint: CGPoint(x: cx, y: cy + r)
                ))
                ctx.stroke(bezel, with: .color(ink), lineWidth: max(1.2, w * 0.065))

                // Inner gauge face
                let innerR = r * 0.72
                let face = Path(ellipseIn: CGRect(x: cx - innerR, y: cy - innerR, width: innerR * 2, height: innerR * 2))
                let faceColor: Color = percent <= 0 ? Theme.slate.opacity(0.65)
                    : (percent <= 25 ? Theme.badBg : Theme.paper)
                ctx.fill(face, with: .color(faceColor))
                ctx.stroke(face, with: .color(Theme.side(side, colours)), lineWidth: max(1.1, w * 0.05))

                // Pressure gauge needle (-135 deg empty -> +135 deg full)
                let clamped = max(0, min(100, percent))
                let deg = -210.0 + Double(clamped) * 2.4
                let rad = deg * .pi / 180.0
                var needle = Path()
                needle.move(to: CGPoint(x: cx, y: cy))
                needle.addLine(to: CGPoint(x: cx + CGFloat(cos(rad)) * innerR * 0.8,
                                           y: cy + CGFloat(sin(rad)) * innerR * 0.8))
                ctx.stroke(needle, with: .color(percent <= 25 ? Theme.badInk : Theme.ink),
                           style: StrokeStyle(lineWidth: max(1.4, w * 0.075), lineCap: .round))

                // Center brass rivet
                let dotR = r * 0.16
                ctx.fill(Path(ellipseIn: CGRect(x: cx - dotR, y: cy - dotR, width: dotR * 2, height: dotR * 2)), with: .color(Theme.ink))

                // Crack line when hurt/critical
                if percent > 0 && percent <= 50 {
                    var crack = Path()
                    crack.move(to: CGPoint(x: cx + innerR * 0.45, y: cy - innerR * 0.55))
                    crack.addLine(to: CGPoint(x: cx + innerR * 0.12, y: cy - innerR * 0.15))
                    crack.addLine(to: CGPoint(x: cx + innerR * 0.30, y: cy + innerR * 0.25))
                    ctx.stroke(crack, with: .color(Theme.badInk), lineWidth: max(1, w * 0.05))
                }
                // Critical steam puff
                if percent <= 25 && percent > 0 {
                    let puff = Path(ellipseIn: CGRect(x: cx + r * 0.35, y: cy - r * 1.32, width: r * 0.52, height: r * 0.42))
                    ctx.fill(puff, with: .color(Color.white.opacity(0.92)))
                    ctx.stroke(puff, with: .color(Theme.badBorder), lineWidth: max(0.8, w * 0.04))
                }
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        }
    }
}

/// Wind pennant flag icon: loads `ui_wind_pennant` when available, else renders a fluttering
/// wooden-mast brass pennant pointing in the wind direction.
struct WindPennantIcon: View {
    let wind: Int
    var size: CGFloat = 22

    var body: some View {
        if let img = SpriteImages.image("ui_wind_pennant") {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .scaleEffect(x: wind < 0 ? -1 : 1, y: 1)
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Canvas { ctx, sz in
                let w = sz.width, h = sz.height
                let dir: CGFloat = wind < 0 ? -1 : 1
                let mastX: CGFloat = wind == 0 ? w * 0.35 : (dir > 0 ? w * 0.24 : w * 0.76)

                // Mast pole & brass finial
                var mast = Path()
                mast.move(to: CGPoint(x: mastX, y: h * 0.16))
                mast.addLine(to: CGPoint(x: mastX, y: h * 0.88))
                ctx.stroke(mast, with: .color(Theme.ink), style: StrokeStyle(lineWidth: max(1.6, w * 0.09), lineCap: .round))
                let finial = Path(ellipseIn: CGRect(x: mastX - w * 0.08, y: h * 0.08, width: w * 0.16, height: w * 0.16))
                ctx.fill(finial, with: .color(Theme.brassMid))
                ctx.stroke(finial, with: .color(Theme.ink), lineWidth: 1)

                // Swallowtail pennant cloth
                var flag = Path()
                if wind == 0 {
                    flag.move(to: CGPoint(x: mastX, y: h * 0.22))
                    flag.addQuadCurve(to: CGPoint(x: mastX + w * 0.34, y: h * 0.62), control: CGPoint(x: mastX + w * 0.30, y: h * 0.32))
                    flag.addLine(to: CGPoint(x: mastX + w * 0.16, y: h * 0.54))
                    flag.addLine(to: CGPoint(x: mastX, y: h * 0.58))
                } else {
                    let stretch = min(1.0, 0.55 + CGFloat(abs(wind)) * 0.08) * w * 0.64
                    let tipX = mastX + dir * stretch
                    let midX = mastX + dir * stretch * 0.52
                    let notchX = mastX + dir * stretch * 0.78
                    flag.move(to: CGPoint(x: mastX, y: h * 0.20))
                    flag.addQuadCurve(to: CGPoint(x: tipX, y: h * 0.28), control: CGPoint(x: midX, y: h * 0.12))
                    flag.addLine(to: CGPoint(x: notchX, y: h * 0.40))
                    flag.addLine(to: CGPoint(x: tipX, y: h * 0.54))
                    flag.addQuadCurve(to: CGPoint(x: mastX, y: h * 0.56), control: CGPoint(x: midX, y: h * 0.48))
                }
                flag.closeSubpath()
                ctx.fill(flag, with: .color(abs(wind) >= 5 ? Theme.orange : Theme.brassMid))
                ctx.stroke(flag, with: .color(Theme.ink), style: StrokeStyle(lineWidth: max(1.1, w * 0.065), lineJoin: .round))
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        }
    }
}

/// Brass toothed Rest Cog icon (replaces raw gear glyphs and plain SF symbols).
struct RestCogIcon: View {
    var size: CGFloat = 12

    var body: some View {
        if let img = SpriteImages.image("ui_cog_rest") {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Canvas { ctx, sz in
                let c = CGPoint(x: sz.width * 0.5, y: sz.height * 0.5)
                let outer = min(sz.width, sz.height) * 0.46
                let inner = outer * 0.72
                let teeth = 6
                var gear = Path()
                for i in 0..<(teeth * 2) {
                    let r = i % 2 == 0 ? outer : inner
                    let a = CGFloat(i) * .pi / CGFloat(teeth) - .pi / 2
                    let pt = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
                    if i == 0 { gear.move(to: pt) } else { gear.addLine(to: pt) }
                }
                gear.closeSubpath()
                ctx.fill(gear, with: .color(Theme.brassLo))
                ctx.stroke(gear, with: .color(Theme.ink), style: StrokeStyle(lineWidth: max(0.9, size * 0.09), lineJoin: .round))
                let holeR = outer * 0.30
                let hole = Path(ellipseIn: CGRect(x: c.x - holeR, y: c.y - holeR, width: holeR * 2, height: holeR * 2))
                ctx.fill(hole, with: .color(Theme.paper))
                ctx.stroke(hole, with: .color(Theme.ink), lineWidth: max(0.7, size * 0.07))
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        }
    }
}

/// Fatigue cracking ember flame icon.
struct FatigueFlameIcon: View {
    var active: Bool = true
    var size: CGFloat = 14

    var body: some View {
        if let img = SpriteImages.image("ui_fatigue_flame") {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Canvas { ctx, sz in
                let w = sz.width, h = sz.height
                var flame = Path()
                flame.move(to: CGPoint(x: w * 0.5, y: h * 0.08))
                flame.addCurve(to: CGPoint(x: w * 0.86, y: h * 0.62),
                               control1: CGPoint(x: w * 0.78, y: h * 0.28),
                               control2: CGPoint(x: w * 0.90, y: h * 0.45))
                flame.addQuadCurve(to: CGPoint(x: w * 0.50, y: h * 0.92), control: CGPoint(x: w * 0.80, y: h * 0.92))
                flame.addQuadCurve(to: CGPoint(x: w * 0.14, y: h * 0.62), control: CGPoint(x: w * 0.20, y: h * 0.92))
                flame.addCurve(to: CGPoint(x: w * 0.5, y: h * 0.08),
                               control1: CGPoint(x: w * 0.10, y: h * 0.42),
                               control2: CGPoint(x: w * 0.34, y: h * 0.26))
                flame.closeSubpath()
                ctx.fill(flame, with: .color(active ? Theme.orange : Theme.brassMid))
                ctx.stroke(flame, with: .color(Theme.ink), lineWidth: max(1.0, size * 0.08))
                let core = Path(ellipseIn: CGRect(x: w * 0.36, y: h * 0.48, width: w * 0.28, height: h * 0.30))
                ctx.fill(core, with: .color(Theme.brassHi))
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        }
    }
}

/// Golden cloth swallowtail Pennant ribbon icon for Campaign Map & Results.
struct PennantRibbonIcon: View {
    let earned: Bool
    var size: CGFloat = 16

    var body: some View {
        let name = earned ? "ui_pennant_ribbon_gold" : "ui_pennant_ribbon_empty"
        if let img = SpriteImages.image(name) {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Canvas { ctx, sz in
                let w = sz.width, h = sz.height
                var pole = Path()
                pole.move(to: CGPoint(x: w * 0.22, y: h * 0.12))
                pole.addLine(to: CGPoint(x: w * 0.22, y: h * 0.90))
                ctx.stroke(pole, with: .color(Theme.ink.opacity(earned ? 1 : 0.45)),
                           style: StrokeStyle(lineWidth: max(1.3, size * 0.10), lineCap: .round))

                var ribbon = Path()
                ribbon.move(to: CGPoint(x: w * 0.22, y: h * 0.16))
                ribbon.addLine(to: CGPoint(x: w * 0.88, y: h * 0.28))
                ribbon.addLine(to: CGPoint(x: w * 0.70, y: h * 0.40))
                ribbon.addLine(to: CGPoint(x: w * 0.86, y: h * 0.54))
                ribbon.addLine(to: CGPoint(x: w * 0.22, y: h * 0.58))
                ribbon.closeSubpath()
                if earned {
                    ctx.fill(ribbon, with: .linearGradient(
                        Gradient(colors: [Theme.brassHi, Theme.pennant, Theme.brassLo]),
                        startPoint: CGPoint(x: w * 0.22, y: h * 0.16),
                        endPoint: CGPoint(x: w * 0.88, y: h * 0.58)
                    ))
                    ctx.stroke(ribbon, with: .color(Theme.ink), style: StrokeStyle(lineWidth: max(1.0, size * 0.08), lineJoin: .round))
                } else {
                    ctx.fill(ribbon, with: .color(Theme.parchmentCard.opacity(0.75)))
                    ctx.stroke(ribbon, with: .color(Theme.sepiaBorder.opacity(0.65)),
                               style: StrokeStyle(lineWidth: max(0.9, size * 0.07), lineJoin: .round))
                }
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        }
    }
}

/// Storybook vector icon fallback for EVERY shot, Knack, Trick Shell, and Doodad
/// so ZERO blank white boxes ever render even before PNG sprite regeneration.
struct KnackFallbackIcon: View {
    let shotId: String
    var kind: String = "plain"
    var size: CGFloat = 32

    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            let ink = Theme.ink
            let lw = max(1.2, min(w, h) * 0.065)
            let key = shotId.lowercased()

            func drawCircle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, fill: Color, stroke: Bool = true) {
                let p = Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
                ctx.fill(p, with: .color(fill))
                if stroke { ctx.stroke(p, with: .color(ink), lineWidth: lw) }
            }

            switch key {
            case "grand_dumpling":
                // Plump golden pleated steamer dumpling with warm steam curls
                let aura = Path(ellipseIn: CGRect(x: w * 0.10, y: h * 0.16, width: w * 0.80, height: h * 0.74))
                ctx.fill(aura, with: .color(Theme.brassHi.opacity(0.55)))
                var dumpling = Path()
                dumpling.move(to: CGPoint(x: w * 0.16, y: h * 0.72))
                dumpling.addCurve(to: CGPoint(x: w * 0.50, y: h * 0.24), control1: CGPoint(x: w * 0.14, y: h * 0.42), control2: CGPoint(x: w * 0.34, y: h * 0.28))
                dumpling.addCurve(to: CGPoint(x: w * 0.84, y: h * 0.72), control1: CGPoint(x: w * 0.66, y: h * 0.28), control2: CGPoint(x: w * 0.86, y: h * 0.42))
                dumpling.addQuadCurve(to: CGPoint(x: w * 0.16, y: h * 0.72), control: CGPoint(x: w * 0.50, y: h * 0.88))
                dumpling.closeSubpath()
                ctx.fill(dumpling, with: .linearGradient(Gradient(colors: [Color(hex: 0xFFF2C2), Color(hex: 0xF0C060)]),
                                                         startPoint: CGPoint(x: w * 0.5, y: h * 0.24), endPoint: CGPoint(x: w * 0.5, y: h * 0.84)))
                ctx.stroke(dumpling, with: .color(ink), style: StrokeStyle(lineWidth: lw, lineJoin: .round))
                for dx in [-0.14, 0.0, 0.14] as [CGFloat] {
                    var pleat = Path()
                    pleat.move(to: CGPoint(x: w * 0.50, y: h * 0.26))
                    pleat.addQuadCurve(to: CGPoint(x: w * (0.50 + dx), y: h * 0.50), control: CGPoint(x: w * (0.50 + dx * 0.6), y: h * 0.36))
                    ctx.stroke(pleat, with: .color(Theme.brassDeep), lineWidth: lw * 0.7)
                }
                // Top knot & steam
                drawCircle(w * 0.50, h * 0.24, w * 0.08, fill: Theme.brassHi)

            case "sunspear":
                // Blazing sun-gold crystalline spear ray
                var ray = Path()
                ray.move(to: CGPoint(x: w * 0.14, y: h * 0.84))
                ray.addLine(to: CGPoint(x: w * 0.68, y: h * 0.30))
                ctx.stroke(ray, with: .color(Theme.brassLo), style: StrokeStyle(lineWidth: lw * 2.1, lineCap: .round))
                ctx.stroke(ray, with: .color(Theme.brassHi), style: StrokeStyle(lineWidth: lw * 0.9, lineCap: .round))
                var head = Path()
                head.move(to: CGPoint(x: w * 0.90, y: h * 0.12))
                head.addLine(to: CGPoint(x: w * 0.72, y: h * 0.44))
                head.addLine(to: CGPoint(x: w * 0.62, y: h * 0.38))
                head.addLine(to: CGPoint(x: w * 0.56, y: h * 0.28))
                head.closeSubpath()
                ctx.fill(head, with: .color(Theme.brassMid))
                ctx.stroke(head, with: .color(ink), style: StrokeStyle(lineWidth: lw, lineJoin: .round))
                drawCircle(w * 0.72, h * 0.28, w * 0.08, fill: Color.white, stroke: false)

            case "pepper_rain":
                // Crimson pepper burst raining 7 peppercorns
                let puff = Path(ellipseIn: CGRect(x: w * 0.20, y: h * 0.12, width: w * 0.60, height: h * 0.32))
                ctx.fill(puff, with: .color(Color(hex: 0xD94136)))
                ctx.stroke(puff, with: .color(ink), lineWidth: lw)
                let drops: [(CGFloat, CGFloat)] = [(0.24, 0.56), (0.42, 0.54), (0.60, 0.54), (0.78, 0.56), (0.32, 0.76), (0.52, 0.80), (0.70, 0.76)]
                for (dx, dy) in drops {
                    drawCircle(w * dx, h * dy, w * 0.085, fill: Color(hex: 0x4A231E))
                    drawCircle(w * dx - w * 0.02, h * dy - h * 0.02, w * 0.025, fill: Color(hex: 0xFF8C66), stroke: false)
                }

            case "burrowbomb":
                // Banded brass digger bomb with mole claws
                drawCircle(w * 0.50, h * 0.56, w * 0.30, fill: Color(hex: 0x5A4A42))
                let band = Path(roundedRect: CGRect(x: w * 0.20, y: h * 0.48, width: w * 0.60, height: h * 0.16), cornerRadius: 3)
                ctx.fill(band, with: .color(Theme.brassMid))
                ctx.stroke(band, with: .color(ink), lineWidth: lw * 0.85)
                var nose = Path()
                nose.move(to: CGPoint(x: w * 0.50, y: h * 0.14))
                nose.addLine(to: CGPoint(x: w * 0.68, y: h * 0.34))
                nose.addLine(to: CGPoint(x: w * 0.32, y: h * 0.34))
                nose.closeSubpath()
                ctx.fill(nose, with: .color(Theme.orange))
                ctx.stroke(nose, with: .color(ink), style: StrokeStyle(lineWidth: lw, lineJoin: .round))

            case "rolypoly":
                // Curled brass-studded rolling woodlouse wheel
                drawCircle(w * 0.50, h * 0.52, w * 0.34, fill: Color(hex: 0x7A8796))
                drawCircle(w * 0.50, h * 0.52, w * 0.18, fill: Theme.brassMid)
                for i in 0..<6 {
                    let a = CGFloat(i) * .pi / 3
                    var spoke = Path()
                    spoke.move(to: CGPoint(x: w * 0.50 + cos(a) * w * 0.18, y: h * 0.52 + sin(a) * h * 0.18))
                    spoke.addLine(to: CGPoint(x: w * 0.50 + cos(a) * w * 0.34, y: h * 0.52 + sin(a) * h * 0.34))
                    ctx.stroke(spoke, with: .color(ink), lineWidth: lw * 0.85)
                }

            case "barn_raising":
                // Timber roof frame + golden mallet
                var roof = Path()
                roof.move(to: CGPoint(x: w * 0.14, y: h * 0.52))
                roof.addLine(to: CGPoint(x: w * 0.50, y: h * 0.18))
                roof.addLine(to: CGPoint(x: w * 0.86, y: h * 0.52))
                ctx.stroke(roof, with: .color(Color(hex: 0xB9733A)), style: StrokeStyle(lineWidth: lw * 2.2, lineCap: .round, lineJoin: .round))
                ctx.stroke(roof, with: .color(ink), style: StrokeStyle(lineWidth: lw * 0.8, lineCap: .round, lineJoin: .round))
                let house = Path(roundedRect: CGRect(x: w * 0.26, y: h * 0.48, width: w * 0.48, height: h * 0.36), cornerRadius: 3)
                ctx.fill(house, with: .color(Color(hex: 0xE3B565)))
                ctx.stroke(house, with: .color(ink), lineWidth: lw)
                drawCircle(w * 0.50, h * 0.66, w * 0.10, fill: Theme.kettleGlow)

            case "tick_tock_crock":
                // Glazed stoneware crock with twin alarm bells and clock face
                drawCircle(w * 0.26, h * 0.24, w * 0.11, fill: Theme.brassMid)
                drawCircle(w * 0.74, h * 0.24, w * 0.11, fill: Theme.brassMid)
                drawCircle(w * 0.50, h * 0.58, w * 0.32, fill: Color(hex: 0xC66E3E))
                drawCircle(w * 0.50, h * 0.58, w * 0.20, fill: Theme.paper)
                var hand = Path()
                hand.move(to: CGPoint(x: w * 0.50, y: h * 0.58))
                hand.addLine(to: CGPoint(x: w * 0.50, y: h * 0.44))
                hand.move(to: CGPoint(x: w * 0.50, y: h * 0.58))
                hand.addLine(to: CGPoint(x: w * 0.61, y: h * 0.58))
                ctx.stroke(hand, with: .color(Theme.badInk), style: StrokeStyle(lineWidth: lw * 0.9, lineCap: .round))

            case "pan_parade":
                // Marching copper skillets
                for (ox, oy, sc) in [(0.34, 0.36, 0.16), (0.58, 0.62, 0.22)] as [(CGFloat, CGFloat, CGFloat)] {
                    var handle = Path()
                    handle.move(to: CGPoint(x: w * (ox - sc * 1.5), y: h * oy))
                    handle.addLine(to: CGPoint(x: w * ox, y: h * oy))
                    ctx.stroke(handle, with: .color(ink), style: StrokeStyle(lineWidth: lw * 1.5, lineCap: .round))
                    drawCircle(w * ox, h * oy, w * sc, fill: Color(hex: 0xD9773A))
                    drawCircle(w * ox, h * oy, w * sc * 0.55, fill: Theme.brassHi, stroke: false)
                }

            case "gravel_sneeze", "extra_shake":
                // Fan of 3 or 4 faceted pebbles
                let pebbles: [(CGFloat, CGFloat, CGFloat)] = key == "extra_shake"
                    ? [(0.24, 0.66, 0.13), (0.44, 0.36, 0.14), (0.68, 0.44, 0.13), (0.72, 0.72, 0.12)]
                    : [(0.26, 0.64, 0.15), (0.50, 0.32, 0.16), (0.74, 0.64, 0.14)]
                for (px, py, pr) in pebbles {
                    drawCircle(w * px, h * py, w * pr, fill: Color(hex: 0xA9A39A))
                    drawCircle(w * (px - 0.03), h * (py - 0.03), w * pr * 0.35, fill: Theme.paper.opacity(0.8), stroke: false)
                }

            case "hatpin":
                var shaft = Path()
                shaft.move(to: CGPoint(x: w * 0.16, y: h * 0.84))
                shaft.addLine(to: CGPoint(x: w * 0.72, y: h * 0.28))
                ctx.stroke(shaft, with: .color(ink), style: StrokeStyle(lineWidth: lw * 1.2, lineCap: .round))
                drawCircle(w * 0.72, h * 0.28, w * 0.18, fill: Theme.kettleGlow)
                drawCircle(w * 0.68, h * 0.24, w * 0.05, fill: .white, stroke: false)

            case "nibbler":
                var drill = Path()
                drill.move(to: CGPoint(x: w * 0.86, y: h * 0.50))
                drill.addLine(to: CGPoint(x: w * 0.24, y: h * 0.24))
                drill.addLine(to: CGPoint(x: w * 0.24, y: h * 0.76))
                drill.closeSubpath()
                ctx.fill(drill, with: .color(Theme.brassLo))
                ctx.stroke(drill, with: .color(ink), style: StrokeStyle(lineWidth: lw, lineJoin: .round))
                for x in [0.40, 0.56, 0.70] as [CGFloat] {
                    var ridge = Path()
                    ridge.move(to: CGPoint(x: w * x, y: h * (0.30 + (x - 0.35) * 0.35)))
                    ridge.addLine(to: CGPoint(x: w * x, y: h * (0.70 - (x - 0.35) * 0.35)))
                    ctx.stroke(ridge, with: .color(ink), lineWidth: lw * 0.8)
                }

            case "bouncebean", "rubber_radish":
                let col: Color = key == "rubber_radish" ? Color(hex: 0xD94B7A) : Color(hex: 0x7BC943)
                drawCircle(w * 0.52, h * 0.56, w * 0.28, fill: col)
                var arc = Path()
                arc.move(to: CGPoint(x: w * 0.14, y: h * 0.82))
                arc.addQuadCurve(to: CGPoint(x: w * 0.42, y: h * 0.32), control: CGPoint(x: w * 0.16, y: h * 0.46))
                ctx.stroke(arc, with: .color(Theme.brassDeep), style: StrokeStyle(lineWidth: lw * 0.9, dash: [3, 2]))

            case "mendglob", "mend_bucket":
                let pail = Path(roundedRect: CGRect(x: w * 0.22, y: h * 0.32, width: w * 0.56, height: h * 0.52), cornerRadius: 5)
                ctx.fill(pail, with: .color(key == "mend_bucket" ? Color(hex: 0xB9733A) : Theme.kettleGlow))
                ctx.stroke(pail, with: .color(ink), lineWidth: lw)
                var plus = Path()
                plus.move(to: CGPoint(x: w * 0.50, y: h * 0.44)); plus.addLine(to: CGPoint(x: w * 0.50, y: h * 0.72))
                plus.move(to: CGPoint(x: w * 0.36, y: h * 0.58)); plus.addLine(to: CGPoint(x: w * 0.64, y: h * 0.58))
                ctx.stroke(plus, with: .color(key == "mend_bucket" ? Theme.kettleGlow : Theme.goodBg),
                           style: StrokeStyle(lineWidth: lw * 1.4, lineCap: .round))

            case "pot_lid":
                var dome = Path()
                dome.move(to: CGPoint(x: w * 0.14, y: h * 0.68))
                dome.addQuadCurve(to: CGPoint(x: w * 0.86, y: h * 0.68), control: CGPoint(x: w * 0.50, y: h * 0.22))
                dome.closeSubpath()
                ctx.fill(dome, with: .color(Theme.flattenerSlate))
                ctx.stroke(dome, with: .color(ink), style: StrokeStyle(lineWidth: lw, lineJoin: .round))
                drawCircle(w * 0.50, h * 0.34, w * 0.10, fill: Theme.brassMid)

            case "mole_mail":
                let env = Path(roundedRect: CGRect(x: w * 0.16, y: h * 0.30, width: w * 0.68, height: h * 0.46), cornerRadius: 4)
                ctx.fill(env, with: .color(Color(hex: 0xE8C88A)))
                ctx.stroke(env, with: .color(ink), lineWidth: lw)
                var flap = Path()
                flap.move(to: CGPoint(x: w * 0.16, y: h * 0.32))
                flap.addLine(to: CGPoint(x: w * 0.50, y: h * 0.56))
                flap.addLine(to: CGPoint(x: w * 0.84, y: h * 0.32))
                ctx.stroke(flap, with: .color(ink), lineWidth: lw)
                drawCircle(w * 0.50, h * 0.56, w * 0.09, fill: Theme.badBorder)

            case "nosy_goose":
                drawCircle(w * 0.54, h * 0.54, w * 0.26, fill: Color.white)
                var beak = Path()
                beak.move(to: CGPoint(x: w * 0.76, y: h * 0.48))
                beak.addLine(to: CGPoint(x: w * 0.94, y: h * 0.56))
                beak.addLine(to: CGPoint(x: w * 0.74, y: h * 0.62))
                beak.closeSubpath()
                ctx.fill(beak, with: .color(Theme.orange))
                ctx.stroke(beak, with: .color(ink), lineWidth: lw * 0.85)
                drawCircle(w * 0.60, h * 0.48, w * 0.09, fill: Theme.brassMid)

            case "pudding_bomb":
                drawCircle(w * 0.50, h * 0.58, w * 0.30, fill: Color(hex: 0x6B3B2A))
                var icing = Path()
                icing.move(to: CGPoint(x: w * 0.24, y: h * 0.46))
                icing.addQuadCurve(to: CGPoint(x: w * 0.76, y: h * 0.46), control: CGPoint(x: w * 0.50, y: h * 0.20))
                icing.addQuadCurve(to: CGPoint(x: w * 0.24, y: h * 0.46), control: CGPoint(x: w * 0.50, y: h * 0.58))
                ctx.fill(icing, with: .color(Theme.paper))
                ctx.stroke(icing, with: .color(ink), lineWidth: lw * 0.8)
                drawCircle(w * 0.50, h * 0.28, w * 0.08, fill: Theme.badBorder)

            case "lid_lifter":
                drawCircle(w * 0.50, h * 0.64, w * 0.24, fill: Theme.brassLo)
                var arrow = Path()
                arrow.move(to: CGPoint(x: w * 0.50, y: h * 0.14))
                arrow.addLine(to: CGPoint(x: w * 0.72, y: h * 0.38))
                arrow.addLine(to: CGPoint(x: w * 0.28, y: h * 0.38))
                arrow.closeSubpath()
                ctx.fill(arrow, with: .color(Theme.kettleGlow))
                ctx.stroke(arrow, with: .color(ink), lineWidth: lw)

            case "marble_sack":
                drawCircle(w * 0.46, h * 0.58, w * 0.26, fill: Color(hex: 0xC89B5E))
                drawCircle(w * 0.68, h * 0.68, w * 0.11, fill: Color(hex: 0x2F6FDE))
                drawCircle(w * 0.76, h * 0.48, w * 0.10, fill: Theme.orange)
                drawCircle(w * 0.60, h * 0.34, w * 0.09, fill: Theme.kettleGlow)

            case "sod_sack":
                let sack = Path(roundedRect: CGRect(x: w * 0.22, y: h * 0.36, width: w * 0.56, height: h * 0.48), cornerRadius: 8)
                ctx.fill(sack, with: .color(Color(hex: 0x8E5D33)))
                ctx.stroke(sack, with: .color(ink), lineWidth: lw)
                let turf = Path(roundedRect: CGRect(x: w * 0.22, y: h * 0.28, width: w * 0.56, height: h * 0.18), cornerRadius: 5)
                ctx.fill(turf, with: .color(Theme.grass))
                ctx.stroke(turf, with: .color(ink), lineWidth: lw)

            case "old_turnip":
                drawCircle(w * 0.50, h * 0.60, w * 0.26, fill: Color(hex: 0x9C6B9E))
                var leaf = Path()
                leaf.move(to: CGPoint(x: w * 0.50, y: h * 0.34))
                leaf.addQuadCurve(to: CGPoint(x: w * 0.70, y: h * 0.14), control: CGPoint(x: w * 0.66, y: h * 0.30))
                leaf.addQuadCurve(to: CGPoint(x: w * 0.50, y: h * 0.34), control: CGPoint(x: w * 0.52, y: h * 0.16))
                ctx.fill(leaf, with: .color(Theme.grass))
                ctx.stroke(leaf, with: .color(ink), lineWidth: lw * 0.85)

            default:
                // Clodpot or general stoneware pot shell with fuse spark
                drawCircle(w * 0.50, h * 0.58, w * 0.30, fill: kind == "knack" ? Theme.brassMid : Color(hex: 0xC66B3B))
                let rim = Path(roundedRect: CGRect(x: w * 0.34, y: h * 0.24, width: w * 0.32, height: h * 0.12), cornerRadius: 3)
                ctx.fill(rim, with: .color(Color(hex: 0x9E4F26)))
                ctx.stroke(rim, with: .color(ink), lineWidth: lw * 0.85)
                drawCircle(w * 0.64, h * 0.18, w * 0.08, fill: Theme.brassHi)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
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

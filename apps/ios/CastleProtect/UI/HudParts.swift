import SwiftUI

/// Kettle HP gauge: icon state changes at 50% and 25% (crack, then steam).
struct KettleGauge: View {
    let percent: Int
    let side: Int
    var compact = false

    private var state: String {
        percent <= 0 ? "popped" : (percent <= 25 ? "critical" : (percent <= 50 ? "hurt" : "full"))
    }

    var body: some View {
        HStack(spacing: 4) {
            SpriteIcon(name: "ui_kettle_gauge_\(state)", fallback: "flame.fill", size: compact ? 24 : 28)
            Text("\(percent)%")
                .font(Theme.number(compact ? 15 : 17))
                .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 8)
        .frame(minWidth: 64, minHeight: 32)
        .panel(corner: 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(side == 0 ? "Blue" : "Orange") kettle \(percent) percent")
    }
}

/// Crew pips: round for side 0, diamond for side 1, filled by HP; grey when Bonked.
struct PipRow: View {
    let crew: [HobView]
    let side: Int
    var colours: ColourSet = .brickabrac
    var size: CGFloat = 20

    var body: some View {
        HStack(spacing: 4) {
            ForEach(crew) { hob in
                pip(hob)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(crew.filter { !$0.bonked && $0.hp > 0 }.count) of \(crew.count) Hobs standing")
    }

    @ViewBuilder
    private func pip(_ hob: HobView) -> some View {
        let down = hob.bonked || hob.hp <= 0
        let colour = down ? Theme.slate : Theme.side(side, colours)
        ZStack(alignment: .bottom) {
            pipShape.fill(Theme.paper)
            pipShape.fill(colour)
                .mask(alignment: .bottom) {
                    Rectangle().frame(height: size * CGFloat(down ? 1 : hob.hpFraction))
                }
            pipShape.stroke(Theme.ink, lineWidth: 2)
        }
        .frame(width: size, height: size)
    }

    private var pipShape: AnyShape {
        side == 0 ? AnyShape(Circle()) : AnyShape(Diamond())
    }
}

struct Diamond: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        p.closeSubpath()
        return p
    }
}

/// `Round 6/15`, widening to `Squall in 3` two rounds before the cap, then `Squall 2 of 3` on a slate plate.
struct RoundLabel: View {
    let hud: HudState

    var body: some View {
        HStack(spacing: 6) {
            if hud.squallRound > 0 {
                SpriteIcon(name: "ui_squall", fallback: "cloud.bolt.fill", size: 20)
                Text("Squall \(hud.squallRound) of 3")
            } else {
                Text("Round \(hud.round)/\(hud.roundCap)")
                if hud.squallIn > 0 && hud.squallIn <= 3 {
                    SpriteIcon(name: "ui_squall", fallback: "cloud.fill", size: 14 + CGFloat(4 - hud.squallIn) * 3)
                    Text("Squall in \(hud.squallIn)")
                        .foregroundStyle(Theme.slate)
                }
            }
        }
        .font(Theme.label(15))
        .foregroundStyle(hud.squallRound > 0 ? Color.white : Theme.ink)
        .padding(.horizontal, 10)
        .frame(minHeight: 32)
        .panel(corner: 12, fill: hud.squallRound > 0 ? Theme.slate : Theme.paper)
        .accessibilityElement(children: .combine)
    }
}

/// Wind arrow and number, with the next front's forecast.
struct WindView: View {
    let wind: Int
    let forecast: Int

    var body: some View {
        HStack(spacing: 8) {
            arrow(wind, big: true)
            arrow(forecast, big: false).opacity(0.7)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(wind == 0 ? "No wind" : "Wind \(abs(wind)) \(wind > 0 ? "right" : "left"). Next \(abs(forecast)).")
    }

    private func arrow(_ value: Int, big: Bool) -> some View {
        HStack(spacing: 2) {
            if value == 0 {
                Image(systemName: "circle.fill").font(.system(size: big ? 8 : 6))
            } else {
                Image(systemName: value > 0 ? "arrow.right" : "arrow.left")
                    .font(.system(size: big ? (value.magnitude > 6 ? 20 : (value.magnitude > 3 ? 17 : 14)) : 12, weight: .heavy))
            }
            Text("\(abs(value))").font(Theme.number(big ? 17 : 13))
        }
        .foregroundStyle(Theme.ink)
    }
}

/// A Hob portrait in the crew column or row: HP ring, selected ring and notch, grey when Bonked.
struct HobPortrait: View {
    let hob: HobView
    let side: Int
    let selected: Bool
    var size: CGFloat = 48
    var colours: ColourSet = .brickabrac
    let action: () -> Void

    var body: some View {
        let down = hob.bonked || hob.hp <= 0
        Button(action: action) {
            ZStack {
                Circle().fill(Theme.paper)
                if let img = SpriteImages.portrait(id: hob.id, name: hob.name, side: side) {
                    Image(uiImage: img).resizable().scaledToFit().padding(4)
                        .saturation(down ? 0 : 1)
                } else {
                    Text(String(hob.name.prefix(1))).font(Theme.title(size * 0.4)).foregroundStyle(Theme.ink)
                }
                Circle()
                    .trim(from: 0, to: CGFloat(down ? 0 : hob.hpFraction))
                    .stroke(Theme.side(side, colours), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(2)
                Circle().stroke(selected ? Theme.gold : Theme.ink, lineWidth: selected ? 4 : 2)
                if hob.rest > 0 {
                    Text("\(hob.rest)")
                        .font(Theme.number(12))
                        .foregroundStyle(.white)
                        .frame(width: 18, height: 18)
                        .background(Circle().fill(Theme.inkSoft))
                        .offset(x: size * 0.36, y: size * 0.36)
                }
            }
            .frame(width: size, height: size)
            .overlay(alignment: .top) {
                if selected {
                    Image(systemName: "arrowtriangle.down.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.gold)
                        .offset(y: -9)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(down)
        .accessibilityLabel("\(hob.name), \(hob.cls). \(hob.hp) of \(hob.hpMax) HP\(down ? ", Bonked" : "")\(selected ? ", picked" : "")")
    }
}

/// One shot chip in the tray: icon, uses left, Weight cogs.
struct ShotChipView: View {
    let chip: ShotChip
    let selected: Bool
    var size: CGFloat = 52
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 1) {
                if let img = SpriteImages.shotIcon(chip) {
                    Image(uiImage: img).resizable().scaledToFit().frame(width: size * 0.55, height: size * 0.55)
                } else {
                    Image(systemName: chip.kind == "knack" ? "bolt.fill" : (chip.kind == "doodad" ? "bag.fill" : "circle.fill"))
                        .font(.system(size: size * 0.32))
                }
                Text(chip.name)
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .foregroundStyle(Theme.ink)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(selected ? Theme.gold : (chip.ready ? Theme.paper : Theme.cream.opacity(0.6)))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.ink, lineWidth: 2))
            )
            .overlay(alignment: .topTrailing) {
                if chip.uses >= 0 {
                    Text("\(chip.uses)")
                        .font(Theme.number(11))
                        .foregroundStyle(.white)
                        .frame(width: 18, height: 18)
                        .background(Circle().fill(Theme.ink))
                        .offset(x: 4, y: -4)
                }
            }
            .overlay(alignment: .topLeading) {
                if chip.weight > 0 {
                    HStack(spacing: 1) {
                        ForEach(0..<chip.weight, id: \.self) { _ in
                            Image(systemName: "gearshape.fill").font(.system(size: 8))
                        }
                    }
                    .foregroundStyle(Theme.inkSoft)
                    .padding(3)
                }
            }
            .opacity(chip.ready ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!chip.ready)
        .accessibilityLabel("\(chip.name)\(chip.uses >= 0 ? ", \(chip.uses) left" : "")\(chip.weight > 0 ? ", weight \(chip.weight)" : "")\(selected ? ", picked" : "")")
    }
}

/// The aim readout: angle to 0.1 degree and power. Tap opens Fine Tune.
struct ReadoutView: View {
    let hud: HudState
    var big = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("\(hud.angleText) | \(hud.powerText)")
                .font(Theme.number(big ? 26 : 20))
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 12)
                .frame(minWidth: 120, minHeight: 44)
                .panel(corner: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(hud.aim.set ? "Angle \(hud.angleText) degrees, power \(hud.aim.power)" : "No aim yet")
        .accessibilityHint("Opens Fine Tune")
        .accessibilityIdentifier("readout")
    }
}

/// Fine Tune: angle and power keys plus Recall. Tap steps 0.1 degree or 1 power; hold repeats.
struct FineTunePad: View {
    @ObservedObject var session: BattleSession
    var key: CGFloat = 48

    var body: some View {
        let tapOnly = session.settings.tapOnly
        HStack(spacing: 4) {
            VStack(spacing: 4) {
                tuneKey("minus", "Angle down", tapOnly) { session.nudge(angle: -1, power: 0) }
                tuneKey("chevron.down", "Power down", tapOnly) { session.nudge(angle: 0, power: -1) }
            }
            VStack(spacing: 2) {
                Text(session.hud.angleText).font(Theme.number(16))
                Text(session.hud.powerText).font(Theme.number(16))
                Button {
                    session.recall()
                } label: {
                    Text("R").font(Theme.title(15)).frame(width: 40, height: 28).panel(corner: 8, fill: Theme.cream)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Recall last aim")
            }
            .foregroundStyle(Theme.ink)
            .frame(width: 64)
            VStack(spacing: 4) {
                tuneKey("plus", "Angle up", tapOnly) { session.nudge(angle: 1, power: 0) }
                tuneKey("chevron.up", "Power up", tapOnly) { session.nudge(angle: 0, power: 1) }
            }
        }
        .padding(6)
        .panel(corner: 16)
    }

    private func tuneKey(_ symbol: String, _ name: String, _ tapOnly: Bool, _ action: @escaping () -> Void) -> some View {
        RepeatButton(tapOnly: tapOnly, accessibilityName: name, action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Theme.ink)
                .frame(width: key, height: key)
                .panel(corner: 12, fill: Theme.cream)
        }
    }
}

/// Walk left and right (hold to walk), with the Steam gauge.
struct WalkPad: View {
    @ObservedObject var session: BattleSession
    var key: CGFloat = 48

    var body: some View {
        let hud = session.hud
        VStack(spacing: 3) {
            HStack(spacing: 6) {
                walkKey(-1, "ui_walk_left", "arrowtriangle.left.fill", "Walk left")
                walkKey(1, "ui_walk_right", "arrowtriangle.right.fill", "Walk right")
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.paper)
                    Capsule().fill(Theme.kettleGlow)
                        .frame(width: g.size.width * CGFloat(max(0, min(1, Double(hud.steam) / Double(max(1, hud.steamMax))))))
                    Capsule().stroke(Theme.ink, lineWidth: 1.5)
                    Text("S \(hud.steam)").font(Theme.number(10)).foregroundStyle(Theme.ink).padding(.leading, 6)
                }
            }
            .frame(height: 12)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Steam \(hud.steam)")
        }
        .frame(width: key * 2 + 12)
    }

    private func walkKey(_ dx: Int, _ sprite: String, _ symbol: String, _ name: String) -> some View {
        RepeatButton(delay: 0.12, rate: 10, fastRate: 10, tapOnly: session.settings.tapOnly, accessibilityName: name,
                     action: { _ = session.walk(dx) }) {
            SpriteIcon(name: sprite, fallback: symbol, size: key * 0.7)
                .frame(width: key, height: key)
                .panel(corner: 12, fill: Theme.cream)
        }
    }
}

/// Fire: acts on finger up inside the button. Locked until a Hob, a shot and an aim exist.
struct FireButton: View {
    let hud: HudState
    var size: CGFloat = 76
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(hud.canFire ? Theme.gold : Theme.cream)
                Circle().stroke(Theme.ink, lineWidth: 3)
                VStack(spacing: 0) {
                    if hud.dugIn {
                        Image(systemName: "mountain.2.fill").font(.system(size: size * 0.22))
                    }
                    Text("FIRE").font(Theme.title(size * 0.27))
                }
                .foregroundStyle(hud.canFire ? Theme.ink : Theme.inkSoft.opacity(0.6))
            }
            .frame(width: size, height: size)
            .shadow(color: Theme.ink.opacity(0.25), radius: 0, x: 0, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(hud.dugIn ? "Fire, dug in" : "Fire")
        .accessibilityValue(hud.canFire ? "ready" : "locked")
        .accessibilityIdentifier("fire")
    }
}

/// Turn banner: slides in for 1.2 s and never blocks taps.
struct TurnBanner: View {
    let text: String
    let side: Int
    var colours: ColourSet = .brickabrac

    var body: some View {
        Text(text)
            .font(Theme.title(22))
            .foregroundStyle(.white)
            .padding(.horizontal, 28)
            .frame(minWidth: 260, minHeight: 44)
            .background(Capsule().fill(text.contains("Squall") ? Theme.slate : Theme.side(side, colours)))
            .overlay(Capsule().stroke(Theme.ink, lineWidth: 3))
            .allowsHitTesting(false)
            .accessibilityAddTraits(.isHeader)
    }
}

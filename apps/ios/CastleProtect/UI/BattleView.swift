import SwiftUI
import UIKit

/// Hosts the SpriteKit battle view in SwiftUI.
struct BattleCanvas: UIViewRepresentable {
    let session: BattleSession

    func makeUIView(context: Context) -> BattleSKView {
        BattleSKView(session: session)
    }

    func updateUIView(_ view: BattleSKView, context: Context) {
        if view.session !== session { view.session = session }
    }
}

private struct ViewportKey: Equatable {
    var size: CGSize
    var insets: EdgeInsets
}

/// S7, the battle. The field draws edge to edge; the HUD is native SwiftUI over it.
/// Wide layout (UX 2.3) when the window is wide, Tall layout with stacked lenses (2.6) when tall.
/// Turning the device only changes the layout: the sim, the aim and the Pins all stay.
struct BattleView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var session: BattleSession
    @State private var inspectedShot: ShotChip?

    init(session: BattleSession) {
        self.session = session
    }

    var body: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            ZStack(alignment: .topLeading) {
                BattleCanvas(session: session)
                    .accessibilityIdentifier("battlefield")
                if session.layout.mode == .tall {
                    TallHud(session: session, inspectedShot: $inspectedShot)
                } else {
                    WideHud(session: session, insets: insets, inspectedShot: $inspectedShot)
                }
                DragBandLayer(model: session.dragModel, side: session.hud.activeSide, colours: session.settings.colourSet)
                if let nudge = session.aimNudge {
                    // A drag from the sky: where to press, by your fort (QA playtest 2, owner rule).
                    SubtitleView(text: nudge.text, side: session.hud.activeSide, colours: session.settings.colourSet)
                        .fixedSize()
                        .position(AimNudge.clamped(nudge.point, in: geo.size))
                        .transition(.opacity)
                }
                if let banner = session.banner {
                    MovingBanner(text: banner, side: session.hud.activeSide, colours: session.settings.colourSet,
                                 reduceMotion: session.settings.reduceMotion)
                        .id(banner)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: .infinity)
                        .padding(.top, insets.top + (session.layout.mode == .tall ? 124 : 58))
                        .transition(.opacity)
                }
                if let line = session.subtitle {
                    SubtitleView(text: line.text, side: line.side, colours: session.settings.colourSet)
                        .frame(maxWidth: .infinity)
                        .padding(.top, insets.top + (session.layout.mode == .tall ? 176 : 108))
                        .transition(.opacity)
                }
                if let shot = inspectedShot, !session.showPauseCard {
                    ZStack {
                        Theme.ink.opacity(0.45)
                            .ignoresSafeArea()
                            .onTapGesture { inspectedShot = nil }
                        ShellInspectCard(chip: shot, catalog: session.game.catalog, selectedHob: session.selectedHobView?.def) {
                            inspectedShot = nil
                        }
                        .padding(20)
                    }
                    .transition(.opacity)
                }
                if let handoff = session.hud.handoff, session.setup.seats == .sideBySide, !session.showPauseCard {
                    HandOffCard(session: session, handoff: handoff)
                }
                if session.showPauseCard {
                    PauseCard(session: session)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .animation(session.settings.reduceMotion ? nil : .easeOut(duration: 0.15), value: session.hud.inFlight)
            .animation(session.settings.reduceMotion ? nil : .easeOut(duration: 0.2), value: session.banner)
            .onAppear { updateViewport(geo.size, insets) }
            .onChange(of: ViewportKey(size: geo.size, insets: insets)) { key in
                updateViewport(key.size, key.insets)
            }
            .onChange(of: session.hud.inFlight) { flying in
                if flying { inspectedShot = nil }
            }
        }
        .background { keyboardShortcuts }
        .ignoresSafeArea()
        // A pull-back drag that ends near an edge must not be taken by the home gesture (M10).
        .defersSystemGestures(on: .all)
        .statusBarHidden(session.layout.mode == .wide)
        .persistentSystemOverlays(.hidden)
    }

    @ViewBuilder
    private var keyboardShortcuts: some View {
        Group {
            Button("") { _ = session.nudge(angle: 5, power: 0) }.keyboardShortcut(.upArrow, modifiers: [])
            Button("") { _ = session.nudge(angle: -5, power: 0) }.keyboardShortcut(.downArrow, modifiers: [])
            Button("") { _ = session.nudge(angle: 0, power: 1) }.keyboardShortcut(.rightArrow, modifiers: [])
            Button("") { _ = session.nudge(angle: 0, power: -1) }.keyboardShortcut(.leftArrow, modifiers: [])
            Button("") { session.fire() }.keyboardShortcut(.return, modifiers: [])
            Button("") { session.fire() }.keyboardShortcut(.space, modifiers: [])
            Button("") { session.recall() }.keyboardShortcut("r", modifiers: [])
            Button("") { _ = session.walk(-1) }.keyboardShortcut("[", modifiers: [])
            Button("") { _ = session.walk(1) }.keyboardShortcut("]", modifiers: [])
            Button("") {
                if session.paused { session.resume() } else { session.pause() }
            }.keyboardShortcut(.escape, modifiers: [])
        }
        .frame(width: 0, height: 0)
        .opacity(0.001)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func updateViewport(_ size: CGSize, _ insets: EdgeInsets) {
        session.updateViewport(size: size, insets: Insets(top: insets.top, left: insets.leading,
                                                          bottom: insets.bottom, right: insets.trailing))
    }
}

/// Observes only the drag band, so a touch move redraws the band and not the HUD (H8).
struct DragBandLayer: View {
    @ObservedObject var model: DragModel
    let side: Int
    let colours: ColourSet

    var body: some View {
        DragBandView(drag: model.overlay, side: side, colours: colours)
    }
}

/// Aim colour by power: blue at 0, orange near 89, red only from 90. Shape and numbers carry power too.
func aimHeat(_ power: Int) -> Color {
    let p = Double(min(100, max(0, power)))
    let hue = p >= 90 ? 4.0 : 205 - 175 * p / 89
    return Color(hue: hue / 360, saturation: 0.78, brightness: 0.92)
}

/// The Aim Drag: a 10 step power scale from the anchor that fills as you pull, the last shot's
/// notch and the change from it, the cancel spot at the anchor, and power and angle badges.
struct DragBandView: View {
    let drag: DragOverlay?
    let side: Int
    let colours: ColourSet

    /// The direction from the anchor toward the finger for an aim angle in tenths (screen, y down).
    private func along(_ angle: Int, _ d: DragOverlay) -> CGVector {
        let r = Double(angle) / 10 * .pi / 180
        let s: CGFloat = d.pullBack ? 1 : -1
        return CGVector(dx: -CGFloat(cos(r)) * s, dy: CGFloat(sin(r)) * s)
    }

    private func quad(_ a: CGPoint, _ u: CGVector, _ b0: CGFloat, _ b1: CGFloat, _ hw: CGFloat) -> Path {
        let n = CGVector(dx: -u.dy, dy: u.dx)
        var p = Path()
        p.move(to: CGPoint(x: a.x + u.dx * b0 + n.dx * hw, y: a.y + u.dy * b0 + n.dy * hw))
        p.addLine(to: CGPoint(x: a.x + u.dx * b1 + n.dx * hw, y: a.y + u.dy * b1 + n.dy * hw))
        p.addLine(to: CGPoint(x: a.x + u.dx * b1 - n.dx * hw, y: a.y + u.dy * b1 - n.dy * hw))
        p.addLine(to: CGPoint(x: a.x + u.dx * b0 - n.dx * hw, y: a.y + u.dy * b0 - n.dy * hw))
        p.closeSubpath()
        return p
    }

    private static func signed(_ v: Double, digits: Int) -> String {
        let s = v > 0 ? "+" : v < 0 ? "\u{2212}" : "\u{00B1}"
        return s + String(format: "%.\(digits)f", abs(v))
    }

    var body: some View {
        if let drag {
            GeometryReader { geo in
                ZStack(alignment: .topLeading) {
                    if drag.cancel {
                        Path { p in p.move(to: drag.anchor); p.addLine(to: drag.finger) }
                            .stroke(Theme.ink.opacity(0.45), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    } else {
                        let u = along(drag.angle, drag)
                        let seg = drag.span / 10
                        let pull = CGFloat(drag.power) / 100 * drag.span
                        ForEach(0..<10, id: \.self) { k in
                            let b0 = CGFloat(k) * seg + 1.5, b1 = CGFloat(k + 1) * seg - 1.5
                            quad(drag.anchor, u, b0, b1, 5)
                                .fill(Theme.paper.opacity(0.55))
                                .overlay(quad(drag.anchor, u, b0, b1, 5)
                                    .stroke(drag.armed ? Color(hex: 0xE5484D) : Theme.ink.opacity(0.6), lineWidth: drag.armed ? 2 : 1))
                            if pull > b0 {
                                quad(drag.anchor, u, b0, min(b1, pull), 5).fill(aimHeat((k + 1) * 10))
                            }
                        }
                        if let la = drag.lastAngle, let lp = drag.lastPower {
                            let v = along(la, drag)
                            let d = CGFloat(lp) / 100 * drag.span
                            let m = CGPoint(x: drag.anchor.x + v.dx * d, y: drag.anchor.y + v.dy * d)
                            Rectangle()
                                .fill(Theme.paper)
                                .overlay(Rectangle().stroke(Theme.ink, lineWidth: 1.5))
                                .frame(width: 5, height: 22)
                                .rotationEffect(.radians(Double(atan2(v.dy, v.dx))))
                                .position(m)
                            Text(Self.signed(Double(drag.power - lp), digits: 0) + " | " + Self.signed(Double(drag.angle - la) / 10, digits: 1) + "\u{00B0}")
                                .font(.system(size: 13, weight: .semibold).monospacedDigit())
                                .foregroundStyle(Theme.ink)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Theme.paper.opacity(0.94)))
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 1.5))
                                .position(x: m.x - v.dy * 24, y: m.y + v.dx * 24)
                        }
                    }
                    // The cancel spot: drag back onto it and let go to keep the old aim.
                    ZStack {
                        Circle().fill(drag.cancel ? Color(hex: 0xE5484D) : Theme.paper)
                        Circle().stroke(Theme.ink, lineWidth: 2)
                        Image(systemName: "xmark").font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(drag.cancel ? Theme.paper : Theme.ink)
                    }
                    .frame(width: 30, height: 30)
                    .position(drag.anchor)
                    if drag.cancel {
                        Text(GameText.shared.t("hud.cancel_aim"))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color(hex: 0xE5484D))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(RoundedRectangle(cornerRadius: 6).fill(Theme.paper.opacity(0.94)))
                            .position(x: drag.anchor.x, y: max(20, drag.anchor.y - 32))
                    }
                    // Power and angle badges at the top, where the eyes are free.
                    HStack(spacing: 10) {
                        AimBadge(bolt: true, title: GameText.shared.t("hud.power").uppercased(), value: "\(drag.power)%", power: drag.power, degrees: 0)
                        AimBadge(bolt: false, title: GameText.shared.t("hud.angle").uppercased(),
                                 value: String(format: "%.1f\u{00B0}", Double(drag.angle) / 10), power: drag.power, degrees: Double(drag.angle) / 10)
                    }
                    .position(x: geo.size.width / 2, y: 76)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

/// One aim badge: an icon in a light circle, a small title and the value.
struct AimBadge: View {
    let bolt: Bool
    let title: String
    let value: String
    let power: Int
    let degrees: Double

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle().fill(Theme.paper)
                if bolt {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(aimHeat(power))
                } else {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .rotationEffect(.degrees(-degrees))
                }
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 0) {
                Text(title).font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.paper)
                Text(value).font(.system(size: 15, weight: .bold).monospacedDigit()).foregroundStyle(Theme.paper)
            }
            Spacer(minLength: 0)
        }
        .padding(.leading, 4)
        .frame(width: 124, height: 36)
        .background(Capsule().fill(Theme.ink.opacity(0.88)))
    }
}

// MARK: Wide layout (UX 2.3, 2.5)

struct WideHud: View {
    @ObservedObject var session: BattleSession
    let insets: EdgeInsets
    @Binding var inspectedShot: ShotChip?

    var body: some View {
        let hud = session.hud
        let pad = session.layout.usePadScale
        let colours = session.settings.colourSet
        let canAct = hud.humanTurn && !session.paused
        let dragging = session.dragging
        let showClusters = canAct && !hud.inFlight
        let leftHand = session.settings.leftHand
        ZStack(alignment: .topLeading) {
        VStack(spacing: 0) {
            // Tier-3 translucent top telemetry strip: Pause & Pass kept safely away from FIRE.
            HStack(spacing: 6) {
                PauseButton(session: session)
                if showClusters {
                    PassButton(session: session)
                        .opacity(dragging ? 0.25 : 1)
                        .allowsHitTesting(!dragging)
                }
                KettleGauge(percent: hud.kettlePercent[0], side: 0, colours: colours,
                            label: hud.isDuel ? hud.names[0] : nil)
                PipRow(crew: hud.crews[0], side: 0, colours: colours)
                Spacer(minLength: 4)
                RoundLabel(hud: hud)
                WindView(wind: hud.wind, forecast: hud.forecast)
                    .padding(.horizontal, 8)
                    .frame(minHeight: 34)
                    .hudTier3Pill(corner: 12)
                Spacer(minLength: 4)
                PipRow(crew: hud.crews[1], side: 1, colours: colours)
                KettleGauge(percent: hud.kettlePercent[1], side: 1, colours: colours,
                            label: hud.isDuel ? hud.names[1] : nil)
            }
            .padding(.top, max(insets.top, 6))
            .padding(.leading, max(insets.leading, 10))
            .padding(.trailing, max(insets.trailing, 10))
            .padding(.bottom, 4)
            .background(Theme.ink.opacity(hud.humanTurn ? 0.0 : 0.08))

            HStack(alignment: .top) {
                if !leftHand { hobColumn(hud, pad: pad, colours: colours) }
                Spacer()
                if leftHand { hobColumn(hud, pad: pad, colours: colours) }
            }
            .padding(.leading, max(insets.leading, 8))
            .padding(.trailing, max(insets.trailing, 8))
            .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
            .allowsHitTesting(showClusters && !dragging)
            .disabled(!showClusters)
            .accessibilityHidden(!showClusters)

            Spacer(minLength: 0)

            // Responsive zero-collision bottom flex bar (Plate 1): Walk | stitched Shot Tray | Aim + brass FIRE.
            HStack(alignment: .bottom, spacing: 8) {
                if leftHand {
                    aimCluster(hud, pad: pad, show: showClusters)
                        .fixedSize()
                } else {
                    WalkPad(session: session, key: pad ? 56 : 48)
                        .fixedSize()
                        .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                        .accessibilityHidden(!showClusters)
                }
                VStack(spacing: 4) {
                    if showClusters && !dragging {
                        if let why = hud.fireText {
                            FireReason(text: why)
                                .allowsHitTesting(false)
                        }
                        ActionOptionsBar(session: session)
                    }
                    ShotTray(session: session, chip: pad ? 64 : 52, inspectedShot: $inspectedShot)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                        .hudTier2Panel(corner: 14)
                        .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                        .accessibilityHidden(!showClusters)
                }
                .frame(maxWidth: .infinity)
                if leftHand {
                    WalkPad(session: session, key: pad ? 56 : 48)
                        .fixedSize()
                        .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                        .accessibilityHidden(!showClusters)
                } else {
                    aimCluster(hud, pad: pad, show: showClusters)
                        .fixedSize()
                }
            }
            .padding(.leading, max(insets.leading, 10))
            .padding(.trailing, max(insets.trailing, 10))
            .padding(.bottom, max(insets.bottom, 8))
        }
            FineTuneDock(session: session, key: pad ? 56 : 48, show: showClusters && (session.fineTuneOpen || pad))
            RivalPeekButton(session: session, insets: insets)
        }
    }

    @ViewBuilder
    private func hobColumn(_ hud: HudState, pad: Bool, colours: ColourSet) -> some View {
        VStack(spacing: 4) {
            ForEach(hud.myCrew) { hob in
                HobPortrait(hob: hob, side: hud.hudSide, selected: hob.id == hud.selectedHob,
                            size: pad ? 64 : 48, colours: colours) {
                    session.pickHob(hob.id)
                }
            }
        }
        .padding(.top, 6)
    }

    @ViewBuilder
    private func aimCluster(_ hud: HudState, pad: Bool, show: Bool) -> some View {
        if hud.inFlight {
            SpeedButton(session: session)
        } else {
            HStack(alignment: .bottom, spacing: 8) {
                ReadoutView(hud: hud, onAdjust: { _ = session.nudge(angle: $0, power: $1) }) {
                    session.toggleFineTune()
                }
                FireButton(hud: hud, size: pad ? 96 : 76, armedDoodad: session.armedDoodad) { session.fire() }
            }
            .opacity(show ? 1 : 0.0)
            .disabled(!show)
            .allowsHitTesting(show && !session.dragging)
            .accessibilityHidden(!show)
        }
    }
}

/// Native SwiftUI "View Rival fort" / "Back to my fort" button (iOS-C1).
/// Safe-area inset and positioned below Fine Tune when open on the same edge.
struct RivalPeekButton: View {
    @ObservedObject var session: BattleSession
    let insets: EdgeInsets

    var body: some View {
        if let edge = session.rivalMarkerEdge, !session.dragging, !session.panning, !session.paused {
            let hud = session.hud
            let rivalSide = 1 - hud.activeSide
            let colours = session.settings.colourSet
            let pad = session.layout.usePadScale
            let fineTuneVisible = hud.humanTurn && !hud.inFlight && (session.fineTuneOpen || pad)
            let fineTuneRect = session.layout.fineTune
            let fineTuneOnRight = hud.hudSide == 0
            let sameEdgeAsPad = fineTuneVisible && fineTuneRect.width > 0 && ((edge > 0) == fineTuneOnRight)
            let topY = sameEdgeAsPad
                ? fineTuneRect.maxY + 8
                : max(insets.top, 6) + (pad ? 52 : 44) + 10
            let text = Camera.markerText(peek: session.rivalPeek)
            HStack(spacing: 0) {
                if edge > 0 { Spacer(minLength: 0) }
                Button {
                    session.toggleRivalPeek()
                } label: {
                    HStack(spacing: 6) {
                        if edge < 0 {
                            Image(systemName: "chevron.left").font(.system(size: 13, weight: .heavy))
                        }
                        Text(text)
                            .font(Theme.label(13))
                            .lineLimit(1)
                        if edge > 0 {
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .heavy))
                        }
                    }
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 12)
                    .frame(minWidth: 48, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Theme.parchmentCard.opacity(0.95))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Theme.side(rivalSide, colours), lineWidth: 2.5)
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(text)
                .accessibilityIdentifier("rivalPeek")
                if edge < 0 { Spacer(minLength: 0) }
            }
            .padding(.leading, max(insets.leading, 10))
            .padding(.trailing, max(insets.trailing, 10))
            .padding(.top, topY)
        }
    }
}

/// Contextual shot dial / self-mend target / Doodad room & block-target picker (iOS-H4).
struct ActionOptionsBar: View {
    @ObservedObject var session: BattleSession

    var body: some View {
        let dials = session.availableDials
        if !dials.isEmpty {
            HStack(spacing: 6) {
                ForEach(Array(dials.enumerated()), id: \.offset) { _, item in
                    let active = session.selectedDial == item.id
                        || (session.selectedDial == nil && item.id == dials.first?.id)
                    Button {
                        session.selectDial(item.id)
                    } label: {
                        Text(item.label)
                            .font(Theme.label(12))
                            .foregroundStyle(Theme.ink)
                            .padding(.horizontal, 10)
                            .frame(minHeight: 34)
                            .panel(corner: 10, fill: active ? Theme.gold : Theme.paper)
                    }
                    .buttonStyle(.plain)
                    .disabled(!item.enabled)
                    .opacity(item.enabled ? 1 : 0.45)
                }
            }
        } else if session.canPickMendTarget {
            let label: String = {
                if session.pickingMendTarget { return tx("hud.mend.prompt") }
                if let t = session.selectedBlockTarget, t.count >= 2 {
                    return tx("hud.mend.target", ["col": t[0] + 1, "row": t[1] + 1]) + " \u{00D7}"
                }
                return tx("hud.mend.prompt")
            }()
            Button {
                session.toggleMendTargetMode()
            } label: {
                Text(label)
                    .font(Theme.label(12))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 34)
                    .panel(corner: 10, fill: (session.pickingMendTarget || session.selectedBlockTarget != nil) ? Theme.gold : Theme.paper)
            }
            .buttonStyle(.plain)
        } else if session.armedDoodad == "pot_lid" {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(session.potLidRooms, id: \.id) { room in
                        let active = session.armedDoodadRoom == room.id
                        Button {
                            session.selectDoodadRoom(room.id)
                        } label: {
                            Text(room.label)
                                .font(Theme.label(12))
                                .foregroundStyle(Theme.ink)
                                .padding(.horizontal, 10)
                                .frame(minHeight: 34)
                                .panel(corner: 10, fill: active ? Theme.gold : Theme.paper)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 4)
            }
        } else if session.armedDoodad == "mend_bucket" {
            let count = session.armedDoodadTargets.count
            HStack(spacing: 6) {
                Text(count == 0 ? tx("hud.mend.prompt_many", ["n": 3]) : tx("hud.mend.picked", ["n": count, "total": 3]))
                    .font(Theme.label(12))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 34)
                    .panel(corner: 10, fill: Theme.cream)
                if count > 0 {
                    Button(tx("common.clear")) { session.clearDoodadTargets() }
                        .font(Theme.label(12))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 8)
                        .frame(minHeight: 34)
                        .panel(corner: 10, fill: Theme.paper)
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: Tall layout (UX 2.6, stacked lenses)

struct TallHud: View {
    @ObservedObject var session: BattleSession
    @Binding var inspectedShot: ShotChip?

    var body: some View {
        let hud = session.hud
        let layout = session.layout
        let colours = session.settings.colourSet
        let pad = layout.usePadScale
        let canAct = hud.humanTurn && !session.paused
        let dragging = session.dragging
        let showClusters = canAct && !hud.inFlight
        let fade = showClusters ? (dragging ? 0.25 : 1.0) : 0.0
        let bottomLens = layout.lenses.last?.viewport ?? .zero
        ZStack(alignment: .topLeading) {
            // Tier-3 frosted top telemetry strip: Pause & Pass sit safely away from FIRE!
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    PauseButton(session: session, compact: true)
                    KettleGauge(percent: hud.kettlePercent[0], side: 0, compact: true, colours: colours,
                                label: hud.isDuel ? hud.names[0] : nil)
                    Spacer(minLength: 2)
                    RoundLabel(hud: hud, compact: true)
                    Spacer(minLength: 2)
                    KettleGauge(percent: hud.kettlePercent[1], side: 1, compact: true, colours: colours,
                                label: hud.isDuel ? hud.names[1] : nil)
                }
                HStack(spacing: 6) {
                    PipRow(crew: hud.crews[0], side: 0, colours: colours, size: 17)
                    Spacer(minLength: 2)
                    WindView(wind: hud.wind, forecast: hud.forecast)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .hudTier3Pill(corner: 10)
                    if showClusters {
                        PassButton(session: session, size: 52, compact: true)
                            .opacity(dragging ? 0.25 : 1)
                            .allowsHitTesting(!dragging)
                    }
                    Spacer(minLength: 2)
                    PipRow(crew: hud.crews[1], side: 1, colours: colours, size: 17)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Rectangle()
                    .fill(Theme.paper.opacity(0.90))
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(Theme.ink.opacity(0.22)).frame(height: 1)
                    }
            )
            .place(layout.topStrip)

            if !hud.inFlight {
                // Player's lower fort stays 100% UNOBSTRUCTED: Walk + Steam + Readout sit inside `walkRail`
                // inside the stitched bottom dock instead of floating on top of the fort (Plate 2)!
                if showClusters && !dragging {
                    VStack(spacing: 4) {
                        if let why = hud.fireText {
                            FireReason(text: why)
                                .allowsHitTesting(false)
                        }
                        ActionOptionsBar(session: session)
                    }
                    .padding(.horizontal, 8)
                    .padding(.top, 6)
                    .frame(width: bottomLens.width, height: bottomLens.height, alignment: .top)
                    .position(x: bottomLens.midX, y: bottomLens.midY)
                }

                FineTuneDock(session: session, key: pad ? 56 : 48, show: showClusters && (session.fineTuneOpen || pad))

                WalkRail(session: session)
                    .place(layout.walkRail)

                ShotTray(session: session, chip: pad ? 58 : 50, inspectedShot: $inspectedShot)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.parchmentCard)
                    .opacity(showClusters ? (dragging ? 0.25 : 1) : 0.4)
                    .allowsHitTesting(showClusters && !dragging)
                    .disabled(!showClusters)
                    .accessibilityHidden(!showClusters)
                    .place(layout.tray)

                HStack(spacing: 6) {
                    if session.settings.leftHand {
                        FireButton(hud: hud, size: pad ? 96 : 76, armedDoodad: session.armedDoodad) { session.fire() }
                            .opacity(showClusters ? 1 : 0.4)
                            .allowsHitTesting(showClusters && !dragging)
                            .disabled(!showClusters)
                            .accessibilityHidden(!showClusters)
                        Spacer(minLength: 0)
                    }
                    ForEach(hud.myCrew) { hob in
                        HobPortrait(hob: hob, side: hud.hudSide, selected: hob.id == hud.selectedHob,
                                    size: pad ? 64 : 48, colours: colours) {
                            session.pickHob(hob.id)
                        }
                    }
                    .opacity(fade == 0 ? 0.4 : fade)
                    .allowsHitTesting(showClusters && !dragging)
                    .disabled(!showClusters)
                    .accessibilityHidden(!showClusters)
                    if !session.settings.leftHand {
                        Spacer(minLength: 0)
                        FireButton(hud: hud, size: pad ? 96 : 76, armedDoodad: session.armedDoodad) { session.fire() }
                            .opacity(showClusters ? 1 : 0.4)
                            .allowsHitTesting(showClusters && !dragging)
                            .disabled(!showClusters)
                            .accessibilityHidden(!showClusters)
                    }
                }
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(
                    Rectangle()
                        .fill(Theme.cream)
                        .overlay(alignment: .top) {
                            Rectangle().fill(Theme.sepiaBorder.opacity(0.45)).frame(height: 1)
                        }
                )
                .place(layout.crewRow)
            } else if let host = (layout.lenses.first(where: { $0.focus == .follow }) ?? layout.lenses.last)?.viewport {
                HStack {
                    PauseButton(session: session)
                    Spacer()
                    SpeedButton(session: session)
                }
                .padding(10)
                .frame(width: host.width, height: host.height, alignment: .bottom)
                .position(x: host.midX, y: host.midY)
            }
        }
    }
}

/// The Fine Tune pad at its layout spot, away from your fort. It hides while a finger
/// aims or pans and while the lenses are joined (QA playtest 1, M7).
struct FineTuneDock: View {
    @ObservedObject var session: BattleSession
    var key: CGFloat
    var show: Bool

    var body: some View {
        let rect = session.layout.fineTune
        if show && !session.dragging && !session.panning && rect.width > 0 {
            FineTunePad(session: session, key: key)
                .frame(width: rect.width, height: rect.height)
                .position(x: rect.midX, y: rect.midY)
                .transition(.opacity)
        }
    }
}

/// Why Fire is grey, in the core's words.
struct FireReason: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.label(13))
            .foregroundStyle(Theme.badInk)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Theme.badBg)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.badBorder, lineWidth: 1.5))
            )
            .accessibilityLabel(tx("hud.fire_locked", ["why": text]))
    }
}

struct ShotTray: View {
    @ObservedObject var session: BattleSession
    var chip: CGFloat = 52
    @Binding var inspectedShot: ShotChip?

    private var currentChip: ShotChip? {
        if let d = session.armedDoodad {
            return ShotChip(id: d, name: DoodadNames.name(d), kind: "doodad", art: d, uses: 1)
        }
        return session.hud.shots.first { $0.id == session.hud.selectedShot } ?? session.hud.shots.first
    }

    var body: some View {
        let hud = session.hud
        let armed = session.armedDoodad
        HStack(spacing: 4) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(hud.shots) { shot in
                        ShotChipView(
                            chip: shot,
                            selected: armed == nil && shot.id == hud.selectedShot,
                            size: chip,
                            onInspect: { inspectedShot = shot }
                        ) {
                            session.pickShot(shot.id)
                        }
                    }
                    ForEach(Array(hud.doodads.enumerated()), id: \.offset) { _, id in
                        let doodadChip = ShotChip(id: id, name: DoodadNames.name(id), kind: "doodad", art: id, uses: 1)
                        ShotChipView(
                            chip: doodadChip,
                            selected: armed == id,
                            size: chip,
                            onInspect: { inspectedShot = doodadChip }
                        ) {
                            session.armDoodad(id)
                        }
                    }
                }
                .padding(.vertical, 3)
                .padding(.horizontal, 4)
            }
            if let current = currentChip {
                Button {
                    inspectedShot = current
                } label: {
                    Image(systemName: "info.circle.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.inkSoft)
                        .frame(width: 48, height: 48)
                        .hudTier3Pill(corner: 10, fill: Theme.paper)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tx("shell_card.a11y_open", ["shot": current.name]))
                .accessibilityIdentifier("inspectShot")
            }
        }
        .disabled(!hud.humanTurn)
    }
}

struct PauseButton: View {
    @ObservedObject var session: BattleSession
    var compact: Bool = false

    var body: some View {
        Button {
            session.pause()
        } label: {
            SpriteIcon(name: "ui_pause", fallback: "pause.fill", size: compact ? 20 : 24)
                .frame(width: compact ? 36 : 44, height: compact ? 32 : 40)
                .hudTier3Pill(corner: 10)
                .frame(minWidth: 48, minHeight: compact ? 34 : 48)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tx("hud.pause"))
        .accessibilityIdentifier("pause")
    }
}

/// During Resolve the Fire spot shows 2x.
struct SpeedButton: View {
    @ObservedObject var session: BattleSession

    var body: some View {
        Button {
            session.speedUp()
        } label: {
            Text(session.hud.speed >= 2 ? "1x" : "2x")
                .font(Theme.title(20))
                .foregroundStyle(Theme.ink)
                .frame(width: 68, height: 48)
                .hudTier1(corner: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tx(session.hud.speed >= 2 ? "hud.speed_normal" : "hud.speed_double"))
    }
}

// MARK: Pause card (S8)

struct PauseCard: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var session: BattleSession
    @State private var confirmGiveUp = false

    init(session: BattleSession) {
        self.session = session
    }

    private var capLine: String {
        let hud = session.hud
        if hud.isYard { return tx("pause.rule_yard") }
        if hud.isVolley { return tx("pause.rule_volley", ["n": hud.volleyActions]) }
        return session.snapshot.squall
            ? tx("pause.rule_rounds_squall", ["n": hud.roundCap])
            : tx("pause.rule_rounds_count", ["n": hud.roundCap])
    }

    var body: some View {
        ZStack {
            Theme.ink.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                Text(tx("pause.title")).font(Theme.title(30)).foregroundStyle(Theme.ink)
                Text(session.title).font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
                Text(capLine)
                    .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                if session.hud.isYard {
                    // Test Yard: set the wind for this shot and every later front.
                    HStack(spacing: 10) {
                        Text(tx("hud.wind.label")).font(Theme.label(15)).foregroundStyle(Theme.ink)
                        Button { session.setWind(session.hud.wind - 1) } label: {
                            Image(systemName: "minus").frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(tx("hud.wind.left", ["n": abs(session.hud.wind - 1)]))
                        Text("\(session.hud.wind)").font(Theme.number(18)).frame(minWidth: 32)
                        Button { session.setWind(session.hud.wind + 1) } label: {
                            Image(systemName: "plus").frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(tx("hud.wind.right", ["n": abs(session.hud.wind + 1)]))
                    }
                    .foregroundStyle(Theme.ink)
                }
                Button(tx("pause.carry_on")) { session.resume() }
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("resume")
                HStack(spacing: 10) {
                    Button(tx("pause.again")) { model.retry() }.buttonStyle(PaperButtonStyle())
                    Button(tx("pause.settings")) { model.showSettings = true }.buttonStyle(PaperButtonStyle())
                    Button(tx("pause.save_and_leave")) { model.leaveToMap() }.buttonStyle(PaperButtonStyle())
                }
                Button(tx("pause.give_up")) { confirmGiveUp = true }
                    .buttonStyle(PaperButtonStyle(height: 44))
                    .accessibilityIdentifier("giveUp")
                    .confirmationDialog(session.hud.isDuel
                                            ? tx("pause.give_up_confirm.title_duel", ["name": session.hud.activeName])
                                            : tx("pause.give_up_confirm.title"),
                                        isPresented: $confirmGiveUp, titleVisibility: .visible) {
                        Button(tx("pause.give_up_confirm.yes"), role: .destructive) {
                            model.giveUp()
                        }
                        .accessibilityIdentifier("confirmGiveUp")
                        Button(tx("pause.give_up_confirm.no"), role: .cancel) {}
                    } message: {
                        Text(session.hud.isDuel ? tx("pause.give_up_confirm.body_duel") : tx("pause.give_up_confirm.body"))
                    }
            }
            .padding(24)
            .frame(maxWidth: 420)
            .panel(corner: 24)
            .padding(24)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}

// MARK: Hand-off card (S24)

struct HandOffCard: View {
    @ObservedObject var session: BattleSession
    let handoff: HandoffView
    @State private var shownAt = Date()
    @EnvironmentObject private var model: AppModel

    init(session: BattleSession, handoff: HandoffView) {
        self.session = session
        self.handoff = handoff
    }

    var body: some View {
        let hud = session.hud
        let side = handoff.toSide
        let name = side < hud.names.count ? hud.names[side] : tx("setup.player_label", ["n": side + 1])
        let help = side < session.setup.help.count ? session.setup.help[side] : .none
        let colours = session.settings.colourSet
        GeometryReader { geo in
        let m = Self.metrics(height: geo.size.height)
        ZStack {
            Theme.ink.opacity(0.6).ignoresSafeArea()
            ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: m.spacing) {
                if !handoff.line.isEmpty {
                    Text(handoff.line).font(Theme.label(m.compact ? 15 : 17)).foregroundStyle(Theme.inkSoft)
                }
                if !m.compact {
                    AnimSprite(clip: "ui_handoff_flip", size: 48, start: shownAt,
                               reduceMotion: session.settings.reduceMotion, fallback: "arrow.left.arrow.right")
                        .accessibilityHidden(true)
                }
                HStack(spacing: 10) {
                    Group {
                        if side == 0 { Circle().fill(Theme.side(0, colours)) } else { Diamond().fill(Theme.side(1, colours)) }
                    }
                    .frame(width: m.crest, height: m.crest)
                    .overlay(Group { if side == 0 { Circle().stroke(Theme.ink, lineWidth: 3) } else { Diamond().stroke(Theme.ink, lineWidth: 3) } })
                    if m.compact {
                        Text(tx("handoff.pass_to")).font(Theme.label(16)).foregroundStyle(Theme.ink)
                    }
                }
                if !m.compact {
                    Text(tx("handoff.pass_to")).font(Theme.label(18)).foregroundStyle(Theme.ink)
                }
                Text(name.uppercased() + (side < hud.helpMarks.count && !hud.helpMarks[side].isEmpty ? " \(hud.helpMarks[side])" : ""))
                    .font(Theme.title(m.title)).foregroundStyle(Theme.sideInk(side, colours))
                    .lineLimit(1).minimumScaleFactor(0.6)
                if help != .none {
                    Text(tx("handoff.help", ["level": "\(help.label) \(help.marks)"])).font(Theme.label(15)).foregroundStyle(Theme.orangeInk)
                }
                HStack(spacing: 10) {
                    KettleGauge(percent: hud.kettlePercent[side], side: side, compact: true, colours: colours,
                                label: hud.isDuel ? name : nil)
                    PipRow(crew: hud.crews[side], side: side, colours: colours, size: 18)
                    Text(tx("hud.round", ["n": hud.round, "cap": hud.roundCap])).font(Theme.label(15)).foregroundStyle(Theme.ink)
                }
                Button(tx("handoff.ready").uppercased()) {
                    // Ignores input for the first 400 ms so a tap meant for the old turn cannot close it.
                    guard Date().timeIntervalSince(shownAt) >= 0.4 else { return }
                    session.ready()
                }
                .buttonStyle(GoldButtonStyle(height: m.ready, minWidth: 200))
                .accessibilityLabel(tx("handoff.ready"))
                .accessibilityIdentifier("ready")
            }
            .padding(m.padding)
            .frame(maxWidth: 440)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(Theme.paper)
                    .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Theme.side(side, colours), lineWidth: m.compact ? 6 : 10))
            )
            .padding(m.compact ? 8 : 24)
            .frame(maxWidth: .infinity, minHeight: geo.size.height)
            }
            .modifier(KeyframeIn(scale: AnimationLibrary.shared.motion.handoffScale,
                                 opacity: AnimationLibrary.shared.motion.handoffOpacity,
                                 start: shownAt, reduceMotion: session.settings.reduceMotion))
        }
        }
        .onAppear {
            shownAt = Date()
            model.sound.play("ui_handoff_flip")
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .accessibilityLabel(tx("handoff.spoken", ["name": name]))
    }
}

extension HandOffCard {
    struct Metrics: Equatable {
        var compact: Bool
        var spacing: CGFloat
        var crest: CGFloat
        var title: CGFloat
        var ready: CGFloat
        var padding: CGFloat

        /// The card's height estimate: the shot line, crest, name, Help, the status row and READY.
        var estimatedHeight: CGFloat {
            let rows: [CGFloat] = compact
                ? [20, crest, title + 6, 18, 32, ready]
                : [22, 48, crest, 22, title + 6, 18, 32, ready]
            return rows.reduce(0, +) + spacing * CGFloat(rows.count - 1) + padding * 2 + (compact ? 16 : 48)
        }
    }

    /// A short screen (phone landscape) gets the compact card, so READY is fully on screen
    /// (QA playtest 1, M8). It also scrolls inside the scrim when it must.
    static func metrics(height: CGFloat) -> Metrics {
        height < 560
            ? Metrics(compact: true, spacing: 6, crest: 32, title: 26, ready: 56, padding: 14)
            : Metrics(compact: false, spacing: 12, crest: 56, title: 34, ready: 72, padding: 28)
    }
}

/// Scale and fade keyframes (animations.json `hand_off_card`) from `start`.
/// Pauses its TimelineView once the finite keyframes finish (iOS-M5).
struct KeyframeIn: ViewModifier {
    let scale: Track
    let opacity: Track
    let start: Date
    let reduceMotion: Bool
    @State private var finished = false

    private var totalMs: Double { max(scale.duration, opacity.duration) }

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: reduceMotion || finished)) { context in
            let t = finished ? totalMs + 1 : context.date.timeIntervalSince(start) * 1000
            content
                .scaleEffect(reduceMotion ? 1 : CGFloat(scale.value(at: t)))
                .opacity(reduceMotion ? 1 : opacity.value(at: t))
        }
        .task(id: start) {
            finished = false
            guard !reduceMotion else { finished = true; return }
            let remaining = max(0, totalMs - Date().timeIntervalSince(start) * 1000) + 50
            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000))
            if !Task.isCancelled { finished = true }
        }
    }
}

/// The turn banner, sliding in and settling by the `turn_banner` keyframes
/// (a fade with Reduce motion). Pauses its TimelineView once settled (iOS-M5).
struct MovingBanner: View {
    let text: String
    let side: Int
    var colours: ColourSet = .brickabrac
    var reduceMotion = false
    @State private var start = Date()
    @State private var finished = false

    var body: some View {
        let m = AnimationLibrary.shared.motion
        let totalMs = reduceMotion ? m.bannerFadeMs : max(m.bannerInY.duration, m.bannerInOpacity.duration)
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: finished)) { context in
            let t = finished ? totalMs + 1 : context.date.timeIntervalSince(start) * 1000
            TurnBanner(text: text, side: side, colours: colours)
                .offset(y: reduceMotion ? 0 : CGFloat(m.bannerInY.value(at: t)))
                .opacity(reduceMotion ? min(1, t / max(1, m.bannerFadeMs)) : m.bannerInOpacity.value(at: t))
        }
        .task(id: text) {
            start = Date()
            finished = false
            try? await Task.sleep(nanoseconds: UInt64((totalMs + 50) * 1_000_000))
            if !Task.isCancelled { finished = true }
        }
        .allowsHitTesting(false)
    }
}

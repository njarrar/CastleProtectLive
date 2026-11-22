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
                    TallHud(session: session)
                } else {
                    WideHud(session: session, insets: insets)
                }
                DragBandLayer(model: session.dragModel, side: session.hud.activeSide, colours: session.settings.colourSet)
                if let banner = session.banner {
                    MovingBanner(text: banner, side: session.hud.activeSide, colours: session.settings.colourSet,
                                 reduceMotion: session.settings.reduceMotion)
                        .id(banner)
                        .frame(maxWidth: .infinity)
                        .padding(.top, insets.top + (session.layout.mode == .tall ? 120 : 56))
                        .transition(.opacity)
                }
                if let line = session.subtitle {
                    SubtitleView(text: line.text, side: line.side, colours: session.settings.colourSet)
                        .frame(maxWidth: .infinity)
                        .padding(.top, insets.top + (session.layout.mode == .tall ? 170 : 104))
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
        }
        .ignoresSafeArea()
        // A pull-back drag that ends near an edge must not be taken by the home gesture (M10).
        .defersSystemGestures(on: .all)
        .statusBarHidden(session.layout.mode == .wide)
        .persistentSystemOverlays(.hidden)
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

/// The stretchy band from the anchor to the finger during an Aim Drag, with a big readout.
struct DragBandView: View {
    let drag: DragOverlay?
    let side: Int
    let colours: ColourSet

    var body: some View {
        if let drag {
            ZStack(alignment: .topLeading) {
                Path { p in
                    p.move(to: drag.anchor)
                    p.addLine(to: drag.end)
                }
                .stroke(drag.armed ? Color(hex: 0xE5484D) : Theme.side(side, colours),
                        style: StrokeStyle(lineWidth: 6, lineCap: .round, dash: [10, 6]))
                Circle()
                    .stroke(Theme.ink, lineWidth: 2)
                    .frame(width: 24, height: 24)
                    .position(drag.anchor)
                Circle()
                    .fill(Theme.paper)
                    .overlay(Circle().stroke(Theme.ink, lineWidth: 3))
                    .frame(width: 30, height: 30)
                    .position(drag.end)
                Text(String(format: "%.1f\u{00B0} | %d", Double(drag.angle) / 10, drag.power))
                    .font(Theme.number(26))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .panel(corner: 14)
                    .position(x: drag.anchor.x, y: max(40, drag.anchor.y - 70))
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

// MARK: Wide layout (UX 2.3, 2.5)

struct WideHud: View {
    @ObservedObject var session: BattleSession
    let insets: EdgeInsets

    var body: some View {
        let hud = session.hud
        let pad = session.isPad
        let colours = session.settings.colourSet
        let canAct = hud.humanTurn && !session.paused
        let dragging = session.dragging
        let showClusters = canAct && !hud.inFlight
        let leftHand = session.settings.leftHand
        VStack(spacing: 0) {
            // Top strip: display only, except Pause.
            HStack(spacing: 8) {
                PauseButton(session: session)
                KettleGauge(percent: hud.kettlePercent[0], side: 0)
                PipRow(crew: hud.crews[0], side: 0, colours: colours)
                Spacer(minLength: 4)
                RoundLabel(hud: hud)
                WindView(wind: hud.wind, forecast: hud.forecast)
                    .padding(.horizontal, 8)
                    .frame(minHeight: 32)
                    .panel(corner: 12)
                Spacer(minLength: 4)
                PipRow(crew: hud.crews[1], side: 1, colours: colours)
                KettleGauge(percent: hud.kettlePercent[1], side: 1)
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

            Spacer(minLength: 0)

            HStack(alignment: .bottom, spacing: 10) {
                if leftHand {
                    aimCluster(hud, pad: pad, show: showClusters)
                } else {
                    WalkPad(session: session, key: pad ? 56 : 48)
                        .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                }
                Spacer(minLength: 0)
                ShotTray(session: session, chip: pad ? 64 : 52)
                    .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
                    .allowsHitTesting(showClusters && !dragging)
                    .disabled(!showClusters)
                Spacer(minLength: 0)
                if leftHand {
                    WalkPad(session: session, key: pad ? 56 : 48)
                        .opacity(showClusters ? (dragging ? 0.25 : 1) : 0)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                } else {
                    aimCluster(hud, pad: pad, show: showClusters)
                }
            }
            .padding(.leading, max(insets.leading, 10))
            .padding(.trailing, max(insets.trailing, 10))
            .padding(.bottom, max(insets.bottom, 8))
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
                if session.fineTuneOpen || pad {
                    FineTunePad(session: session, key: pad ? 56 : 48)
                } else {
                    ReadoutView(hud: hud) { session.toggleFineTune() }
                }
                VStack(spacing: 6) {
                    PassButton(session: session)
                    FireButton(hud: hud, size: pad ? 96 : 76, armedDoodad: session.armedDoodad) { session.fire() }
                }
            }
            .opacity(show ? 1 : 0.0)
            .disabled(!show)
            .allowsHitTesting(show && !session.dragging)
        }
    }
}

// MARK: Tall layout (UX 2.6, stacked lenses)

struct TallHud: View {
    @ObservedObject var session: BattleSession

    var body: some View {
        let hud = session.hud
        let layout = session.layout
        let colours = session.settings.colourSet
        let pad = session.isPad
        let canAct = hud.humanTurn && !session.paused
        let dragging = session.dragging
        let showClusters = canAct && !hud.inFlight
        let fade = showClusters ? (dragging ? 0.25 : 1.0) : 0.0
        let bottomLens = layout.lenses.last?.viewport ?? .zero
        ZStack(alignment: .topLeading) {
            // Top strip, two rows, display only.
            VStack(spacing: 4) {
                HStack {
                    KettleGauge(percent: hud.kettlePercent[0], side: 0, compact: true)
                    Spacer()
                    RoundLabel(hud: hud)
                    Spacer()
                    KettleGauge(percent: hud.kettlePercent[1], side: 1, compact: true)
                }
                HStack {
                    PipRow(crew: hud.crews[0], side: 0, colours: colours, size: 18)
                    Spacer()
                    WindView(wind: hud.wind, forecast: hud.forecast)
                    Spacer()
                    PipRow(crew: hud.crews[1], side: 1, colours: colours, size: 18)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Theme.cream)
            .place(layout.topStrip)

            if !hud.inFlight {
                // Floats along the Bottom lens foot: Pause and Walk on the left, readout or Fine Tune on the right.
                HStack(alignment: .bottom) {
                    PauseButton(session: session)
                    WalkPad(session: session, key: 44)
                        .opacity(fade)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                    PassButton(session: session)
                        .opacity(fade == 0 ? 0.4 : fade)
                        .allowsHitTesting(showClusters && !dragging)
                        .disabled(!showClusters)
                    Spacer()
                    Group {
                        if session.fineTuneOpen || pad {
                            FineTunePad(session: session, key: pad ? 56 : 44)
                        } else {
                            ReadoutView(hud: hud) { session.toggleFineTune() }
                        }
                    }
                    .opacity(showClusters ? 1 : 0)
                    .allowsHitTesting(showClusters && !dragging)
                    .disabled(!showClusters)
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 6)
                .frame(width: bottomLens.width, height: bottomLens.height, alignment: .bottom)
                .position(x: bottomLens.midX, y: bottomLens.midY)

                ShotTray(session: session, chip: pad ? 60 : 48)
                    .frame(maxWidth: .infinity)
                    .background(Theme.cream)
                    .opacity(showClusters ? (dragging ? 0.25 : 1) : 0.4)
                    .allowsHitTesting(showClusters && !dragging)
                    .disabled(!showClusters)
                    .place(layout.tray)

                HStack(spacing: 6) {
                    if session.settings.leftHand {
                        FireButton(hud: hud, size: pad ? 96 : 76, armedDoodad: session.armedDoodad) { session.fire() }
                            .opacity(showClusters ? 1 : 0.4)
                            .allowsHitTesting(showClusters && !dragging)
                            .disabled(!showClusters)
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
                    if !session.settings.leftHand {
                        Spacer(minLength: 0)
                        FireButton(hud: hud, size: pad ? 96 : 76, armedDoodad: session.armedDoodad) { session.fire() }
                            .opacity(showClusters ? 1 : 0.4)
                            .allowsHitTesting(showClusters && !dragging)
                            .disabled(!showClusters)
                    }
                }
                .padding(.horizontal, 10)
                .background(Theme.cream)
                .place(layout.crewRow)
            } else if let joined = layout.lenses.first?.viewport {
                HStack {
                    PauseButton(session: session)
                    Spacer()
                    SpeedButton(session: session)
                }
                .padding(10)
                .frame(width: joined.width, height: joined.height, alignment: .bottom)
                .position(x: joined.midX, y: joined.midY)
            }
        }
    }
}

struct ShotTray: View {
    @ObservedObject var session: BattleSession
    var chip: CGFloat = 52

    var body: some View {
        let hud = session.hud
        let armed = session.armedDoodad
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(hud.shots) { shot in
                    ShotChipView(chip: shot, selected: armed == nil && shot.id == hud.selectedShot, size: chip) {
                        session.pickShot(shot.id)
                    }
                }
                ForEach(Array(hud.doodads.enumerated()), id: \.offset) { _, id in
                    ShotChipView(chip: ShotChip(id: id, name: DoodadNames.name(id), kind: "doodad", art: id, uses: 1),
                                 selected: armed == id, size: chip) {
                        session.armDoodad(id)
                    }
                }
            }
            .padding(.vertical, 2)
            .padding(.horizontal, 4)
        }
        .disabled(!hud.humanTurn)
    }
}

struct PauseButton: View {
    @ObservedObject var session: BattleSession

    var body: some View {
        Button {
            session.pause()
        } label: {
            SpriteIcon(name: "ui_pause", fallback: "pause.fill", size: 28)
                .frame(width: 44, height: 44)
                .panel(corner: 12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Pause")
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
                .frame(width: 64, height: 48)
                .panel(corner: 14, fill: Theme.gold)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(session.hud.speed >= 2 ? "Normal speed" : "Double speed")
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
        if hud.isVolley { return hud.volleyText }
        return "Round cap \(hud.roundCap), then the Squall"
    }

    var body: some View {
        ZStack {
            Theme.ink.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                Text("Paused").font(Theme.title(30)).foregroundStyle(Theme.ink)
                Text(session.title).font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
                Text(capLine)
                    .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                if session.hud.isYard {
                    // Test Yard: set the wind for this shot and every later front.
                    HStack(spacing: 10) {
                        Text("Wind").font(Theme.label(15)).foregroundStyle(Theme.ink)
                        Button { session.setWind(session.hud.wind - 1) } label: {
                            Image(systemName: "minus").frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Wind left")
                        Text("\(session.hud.wind)").font(Theme.number(18)).frame(minWidth: 32)
                        Button { session.setWind(session.hud.wind + 1) } label: {
                            Image(systemName: "plus").frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Wind right")
                    }
                    .foregroundStyle(Theme.ink)
                }
                Button("Resume") { session.resume() }
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("resume")
                HStack(spacing: 10) {
                    Button("Retry") { model.retry() }.buttonStyle(PaperButtonStyle())
                    Button("Settings") { model.showSettings = true }.buttonStyle(PaperButtonStyle())
                    Button("Map") { model.leaveToMap() }.buttonStyle(PaperButtonStyle())
                }
                Button("Give up") { confirmGiveUp = true }
                    .buttonStyle(PaperButtonStyle(height: 44))
                    .accessibilityIdentifier("giveUp")
                    .confirmationDialog("Give up this fight?", isPresented: $confirmGiveUp, titleVisibility: .visible) {
                        Button(session.hud.isDuel ? "\(session.hud.activeName) gives up" : "Give up", role: .destructive) {
                            model.giveUp()
                        }
                        .accessibilityIdentifier("confirmGiveUp")
                        Button("Keep fighting", role: .cancel) {}
                    } message: {
                        Text(session.setup.mode == .campaign ? "It counts as a loss. You still get the Buttons for trying." : "The other side wins.")
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
        let name = side < hud.names.count ? hud.names[side] : "Player \(side + 1)"
        let help = side < session.setup.help.count ? session.setup.help[side] : .none
        let colours = session.settings.colourSet
        ZStack {
            Theme.ink.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 12) {
                if !handoff.line.isEmpty {
                    Text(handoff.line).font(Theme.label(17)).foregroundStyle(Theme.inkSoft)
                }
                AnimSprite(clip: "ui_handoff_flip", size: 48, start: shownAt,
                           reduceMotion: session.settings.reduceMotion, fallback: "arrow.left.arrow.right")
                    .accessibilityHidden(true)
                Group {
                    if side == 0 { Circle().fill(Theme.side(0, colours)) } else { Diamond().fill(Theme.side(1, colours)) }
                }
                .frame(width: 56, height: 56)
                .overlay(Group { if side == 0 { Circle().stroke(Theme.ink, lineWidth: 3) } else { Diamond().stroke(Theme.ink, lineWidth: 3) } })
                Text("Pass the device to").font(Theme.label(18)).foregroundStyle(Theme.ink)
                Text(name.uppercased() + (side < hud.helpMarks.count && !hud.helpMarks[side].isEmpty ? " \(hud.helpMarks[side])" : ""))
                    .font(Theme.title(34)).foregroundStyle(Theme.side(side, colours))
                if help != .none {
                    Text("Help: \(help.label) \(help.marks)").font(Theme.label(15)).foregroundStyle(Theme.goldDark)
                }
                HStack(spacing: 10) {
                    KettleGauge(percent: hud.kettlePercent[side], side: side, compact: true)
                    PipRow(crew: hud.crews[side], side: side, colours: colours, size: 18)
                    Text("Round \(hud.round)/\(hud.roundCap)").font(Theme.label(15)).foregroundStyle(Theme.ink)
                }
                Button("READY") {
                    // Ignores input for the first 400 ms so a tap meant for the old turn cannot close it.
                    guard Date().timeIntervalSince(shownAt) >= 0.4 else { return }
                    session.ready()
                }
                .buttonStyle(GoldButtonStyle(height: 72, minWidth: 200))
                .accessibilityLabel("Ready")
                .accessibilityIdentifier("ready")
            }
            .padding(28)
            .frame(maxWidth: 440)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(Theme.paper)
                    .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Theme.side(side, colours), lineWidth: 10))
            )
            .padding(24)
            .modifier(KeyframeIn(scale: AnimationLibrary.shared.motion.handoffScale,
                                 opacity: AnimationLibrary.shared.motion.handoffOpacity,
                                 start: shownAt, reduceMotion: session.settings.reduceMotion))
        }
        .onAppear {
            shownAt = Date()
            model.sound.play("ui_handoff_flip")
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .accessibilityLabel("Pass the device to \(name)")
    }
}

/// Scale and fade keyframes (animations.json `hand_off_card`) from `start`.
struct KeyframeIn: ViewModifier {
    let scale: Track
    let opacity: Track
    let start: Date
    let reduceMotion: Bool

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSince(start) * 1000
            content
                .scaleEffect(reduceMotion ? 1 : CGFloat(scale.value(at: t)))
                .opacity(reduceMotion ? 1 : opacity.value(at: t))
        }
    }
}

/// The turn banner, sliding in and settling by the `turn_banner` keyframes
/// (a fade with Reduce motion). It never blocks taps.
struct MovingBanner: View {
    let text: String
    let side: Int
    var colours: ColourSet = .brickabrac
    var reduceMotion = false
    @State private var start = Date()

    var body: some View {
        let m = AnimationLibrary.shared.motion
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: false)) { context in
            let t = context.date.timeIntervalSince(start) * 1000
            TurnBanner(text: text, side: side, colours: colours)
                .offset(y: reduceMotion ? 0 : CGFloat(m.bannerInY.value(at: t)))
                .opacity(reduceMotion ? min(1, t / m.bannerFadeMs) : m.bannerInOpacity.value(at: t))
        }
        .onAppear { start = Date() }
        .allowsHitTesting(false)
    }
}

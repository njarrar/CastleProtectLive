import Foundation
import CoreGraphics

/// Everything the HUD shows, taken from one snapshot. Equatable so SwiftUI
/// redraws only when something visible changed, not on every frame.
struct HudState: Equatable {
    var phase: BattlePhase = .none
    var mode = ""
    var round = 1
    var roundCap = 15
    var squallIn = -1
    var squallRound = 0
    var wind = 0
    var forecast = 0
    var activeSide = 0
    /// The side whose controls the HUD shows: the active side in a Couch Duel, else side 0.
    var hudSide = 0
    var names = ["You", "Rival"]
    var humanTurn = false
    var isDuel = false
    var kettlePercent = [100, 100]
    var crews: [[HobView]] = [[], []]
    var selectedHob: String?
    var shots: [ShotChip] = []
    var selectedShot: String?
    var aim = AimView()
    var canFire = false
    var dugIn = false
    var steam = 0
    var steamTurn = 0
    var steamMax = 100
    var speed = 1
    var draft: DraftView?
    var handoff: HandoffView?
    var result: BattleResult?

    init() {}

    init(_ s: BattleSnapshot) {
        phase = s.phase
        mode = s.mode
        round = s.round
        roundCap = s.roundCap
        squallIn = s.squallIn
        squallRound = s.squallRound
        wind = s.wind
        forecast = s.forecast
        activeSide = s.activeSide
        isDuel = s.isDuel
        hudSide = isDuel ? s.activeSide : 0
        names = [s.name(0), s.name(1)]
        humanTurn = s.humanTurn
        kettlePercent = [s.fort(0)?.kettlePercent ?? 100, s.fort(1)?.kettlePercent ?? 100]
        crews = [s.fort(0)?.hobs ?? [], s.fort(1)?.hobs ?? []]
        selectedHob = s.selectedHob
        shots = s.shots
        selectedShot = s.selectedShot
        aim = s.aim
        canFire = s.canFire
        dugIn = s.dugIn
        steam = s.steam
        steamTurn = s.steamTurn
        steamMax = s.steamMax
        speed = s.speed
        draft = s.draft
        handoff = s.phase == .handoff ? (s.handoff ?? HandoffView(line: "", toSide: s.activeSide)) : nil
        result = s.result
    }

    var inFlight: Bool { phase.isResolving }
    var myCrew: [HobView] { hudSide < crews.count ? crews[hudSide] : [] }
    var theirCrew: [HobView] { 1 - hudSide < crews.count ? crews[1 - hudSide] : [] }
    var myName: String { names[hudSide] }
    var activeName: String { activeSide < names.count ? names[activeSide] : "" }
    var angleText: String { aim.set ? String(format: "%.1f\u{00B0}", Double(aim.angle) / 10) : "--" }
    var powerText: String { aim.set ? "\(aim.power)" : "--" }
}

/// The band drawn during an Aim Drag, in view points.
struct DragOverlay: Equatable {
    var anchor: CGPoint
    var end: CGPoint
    var angle: Int
    var power: Int
    /// Quick Fire is on and the finger is outside the cancel ring: lifting fires.
    var armed: Bool
}

/// A short blast flash drawn by the renderer after a `hit` event. View only.
struct BlastEffect: Equatable {
    var x: Double
    var y: Double
    var big: Bool
    var start: UInt64
}

/// One battle on screen: drives the core clock, turns touches into commands,
/// and hands the latest snapshot to the renderer and the HUD.
@MainActor
final class BattleSession: ObservableObject {
    let bridge: any CoreBridge
    let setup: BattleSetup
    let title: String

    @Published private(set) var hud = HudState()
    @Published private(set) var drag: DragOverlay?
    @Published var fineTuneOpen = false
    @Published private(set) var paused = false
    @Published var showPauseCard = false
    @Published private(set) var banner: String?
    @Published private(set) var layout = BattleLayout.empty

    /// The newest frame, read by the renderer each draw.
    private(set) var snapshot = BattleSnapshot()
    /// Blast flashes still on screen, read by the renderer.
    private(set) var effects: [BlastEffect] = []
    var settings = GameSettings()
    var isPad = false

    var onTurnStarted: ((BattleSession) -> Void)?
    var onEnded: ((BattleSession, BattleResult) -> Void)?
    var onEvents: (([CoreEvent], BattleSnapshot) -> Void)?
    var onLocalHaptic: ((Haptics.Kind) -> Void)?

    private var driver: Task<Void, Never>?
    private var bannerTask: Task<Void, Never>?
    private var foldTask: Task<Void, Never>?
    private var lastNanos: UInt64 = 0
    private var lastTurnSeq = -1
    private var endReported = false
    private var gesture: AimGesture?
    private var aimBeforeDrag: AimView?
    private var dragEndedAt: UInt64 = 0
    private var hitFullPower = false
    private var squallWarned = false
    private var squallAnnounced = false
    private var viewSize: CGSize = .zero
    private var viewInsets = Insets()

    init(bridge: any CoreBridge, setup: BattleSetup, title: String) {
        self.bridge = bridge
        self.setup = setup
        self.title = title
        if let s = bridge.currentSnapshot() {
            snapshot = s
            hud = HudState(s)
            lastTurnSeq = s.phase == .draft ? -1 : s.turnSeq
        }
    }

    // MARK: Clock

    /// Starts the battle clock. The sim steps whole 120 Hz ticks inside the core.
    func start() {
        guard driver == nil else { return }
        lastNanos = 0
        driver = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                self.tick()
                try? await Task.sleep(nanoseconds: 8_000_000)
            }
        }
    }

    func stop() {
        driver?.cancel()
        driver = nil
        bannerTask?.cancel()
        foldTask?.cancel()
    }

    func tick() {
        let now = DispatchTime.now().uptimeNanoseconds
        if lastNanos == 0 || paused {
            lastNanos = now
        } else if now > lastNanos {
            let ms = Int((now - lastNanos) / 1_000_000)
            if ms > 0 {
                bridge.advance(milliseconds: min(ms, 250))
                lastNanos += UInt64(ms) * 1_000_000
            }
        }
        guard let snap = bridge.currentSnapshot() else { return }
        apply(snap)
    }

    private func apply(_ snap: BattleSnapshot) {
        let wasInFlight = snapshot.phase.isResolving
        snapshot = snap
        let now = DispatchTime.now().uptimeNanoseconds
        effects.removeAll { now &- $0.start > 600_000_000 }
        for e in snap.events where e.type == "hit" {
            effects.append(BlastEffect(x: e.x, y: e.y, big: e.amount > 40, start: now))
        }
        if !snap.events.isEmpty { onEvents?(snap.events, snap) }
        if snap.phase != .draft && snap.phase != .none && snap.turnSeq != lastTurnSeq {
            lastTurnSeq = snap.turnSeq
            turnStarted(snap)
        }
        let next = HudState(snap)
        if next != hud { hud = next }
        if wasInFlight != snap.phase.isResolving {
            if snap.phase.isResolving { endDragKeepingAim(); fineTuneOpen = false }
            relayout()
        }
        if let result = snap.result, !endReported {
            endReported = true
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                guard let self else { return }
                self.onEnded?(self, result)
            }
        }
    }

    private func turnStarted(_ snap: BattleSnapshot) {
        let name = snap.name(snap.activeSide)
        var text: String
        if snap.isDuel {
            text = "\(name)'s turn"
        } else if snap.isHuman(snap.activeSide) {
            text = "Your turn"
        } else {
            text = "\(name) aims"
        }
        if snap.squallRound >= 1 && !squallAnnounced {
            squallAnnounced = true
            text = "Sudden Squall"
        } else if snap.squallIn == 3 && !squallWarned {
            squallWarned = true
            text = "Squall in 3"
        }
        showBanner(text)
        onTurnStarted?(self)
    }

    private func showBanner(_ text: String) {
        banner = text
        bannerTask?.cancel()
        bannerTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            guard !Task.isCancelled else { return }
            self?.banner = nil
        }
    }

    // MARK: Layout

    func updateViewport(size: CGSize, insets: Insets) {
        guard size != viewSize || insets != viewInsets else { return }
        let resized = size != viewSize && viewSize != .zero
        viewSize = size
        viewInsets = insets
        if resized { endDragKeepingAim() }
        relayout()
    }

    private func relayout() {
        let mode = LayoutMode.resolve(size: viewSize, previous: layout.size == .zero ? nil : layout.mode)
        let next = BattleLayout.compute(size: viewSize, insets: viewInsets, mode: mode,
                                        inFlight: snapshot.phase.isResolving, isPad: isPad)
        if next != layout { layout = next }
    }

    // MARK: Pause

    func pause() {
        guard !paused else { return }
        endDragKeepingAim(restore: true)
        paused = true
        showPauseCard = true
    }

    func resume() {
        paused = false
        showPauseCard = false
    }

    // MARK: Aim Drag

    func touchBegan(at point: CGPoint) {
        guard hud.humanTurn, !paused, gesture == nil, layout.aimRegion.contains(point) else { return }
        gesture = AimGesture(anchor: point, powerSpan: layout.powerSpan, mode: settings.dragMode)
        aimBeforeDrag = snapshot.aim
        hitFullPower = false
    }

    func touchMoved(to point: CGPoint) {
        guard var g = gesture else { return }
        let started = g.move(to: point)
        gesture = g
        if started {
            onLocalHaptic?(.dragStart)
            fineTuneOpen = false
        }
        guard g.isDragging else { return }
        bridge.send(.aim(angle: g.angleTenths, power: g.power))
        if g.power >= 100 && !hitFullPower {
            hitFullPower = true
            onLocalHaptic?(.tick)
        } else if g.power < 100 {
            hitFullPower = false
        }
        drag = DragOverlay(anchor: g.anchor, end: g.bandEnd, angle: g.angleTenths, power: g.power,
                           armed: settings.quickFire && !g.isInCancelRing)
    }

    func touchEnded(at point: CGPoint) {
        guard var g = gesture else { return }
        _ = g.move(to: point)
        gesture = nil
        drag = nil
        guard g.isDragging else { return }
        if g.isInCancelRing {
            restoreAim()
            return
        }
        bridge.send(.aim(angle: g.angleTenths, power: g.power))
        dragEndedAt = DispatchTime.now().uptimeNanoseconds
        fineTuneOpen = true
        scheduleFold()
        if settings.quickFire {
            sendFire()
        }
    }

    /// A second finger, a lost touch or the app leaving: the old aim returns.
    func touchCancelled() {
        endDragKeepingAim(restore: true)
    }

    /// A device turn mid-drag ends the drag as if the finger lifted, keeping the aim. Nothing fires.
    func endDragKeepingAim(restore: Bool = false) {
        guard let g = gesture else { return }
        gesture = nil
        drag = nil
        if restore || !g.isDragging || g.isInCancelRing {
            if g.isDragging { restoreAim() }
        } else {
            bridge.send(.aim(angle: g.angleTenths, power: g.power))
        }
    }

    private func restoreAim() {
        guard let before = aimBeforeDrag, before.set else { return }
        bridge.send(.aim(angle: before.angle, power: before.power))
    }

    // MARK: HUD actions

    /// Fire acts on finger up inside the button, with a 150 ms guard after an Aim Drag.
    func fire() {
        let now = DispatchTime.now().uptimeNanoseconds
        guard now - dragEndedAt >= 150_000_000 else { return }
        sendFire()
    }

    private func sendFire() {
        let reply = bridge.send(.fire)
        if reply.ok {
            fineTuneOpen = false
            onLocalHaptic?(.fire)
        } else {
            onLocalHaptic?(.illegal)
        }
    }

    /// Fine Tune: angle in tenths of a degree, power in whole points.
    func nudge(angle dAngle: Int, power dPower: Int) {
        let a = snapshot.aim
        let angle = min(1800, max(0, a.angle + dAngle))
        let power = min(100, max(0, a.power + dPower))
        if angle == a.angle && power == a.power && a.set {
            onLocalHaptic?(.illegal)
            return
        }
        let reply = bridge.send(.aim(angle: angle, power: power))
        onLocalHaptic?(reply.ok ? .tick : .illegal)
        scheduleFold()
        tick()
    }

    func toggleFineTune() {
        fineTuneOpen.toggle()
        if fineTuneOpen { scheduleFold() }
    }

    func recall() {
        bridge.send(.recall)
        fineTuneOpen = true
        scheduleFold()
    }

    func pickHob(_ id: String) {
        let ok = bridge.send(.pickHob(id)).ok
        onLocalHaptic?(ok ? .tick : .illegal)
        tick()
    }

    func pickShot(_ id: String) {
        let ok = bridge.send(.pickShot(id)).ok
        onLocalHaptic?(ok ? .tick : .illegal)
        tick()
    }

    /// One Walk step; the HUD repeats it while the key is held.
    @discardableResult
    func walk(_ dx: Int) -> Bool {
        let ok = bridge.send(.walk(dx: dx)).ok
        if !ok { onLocalHaptic?(.illegal) }
        return ok
    }

    func speedUp() {
        bridge.send(.speed(hud.speed >= 2 ? 1 : 2))
    }

    func ready() {
        bridge.send(.ready)
        tick()
    }

    func draftPick(_ id: String) {
        let ok = bridge.send(.draftPick(id)).ok
        onLocalHaptic?(ok ? .tick : .illegal)
        tick()
    }

    func quickPick() {
        bridge.send(.quickPick)
        tick()
    }

    func endDraft() {
        bridge.send(.endDraft)
        tick()
    }

    func giveUp() {
        bridge.send(.giveUp)
        resume()
    }

    private func scheduleFold() {
        guard !isPad else { return }
        foldTask?.cancel()
        foldTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled else { return }
            self?.fineTuneOpen = false
        }
    }
}

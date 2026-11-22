import Foundation
import CoreGraphics
import QuartzCore

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
    var doodads: [String] = []
    var puffUp = false
    var steam = 0
    var steamTurn = 0
    var steamMax = 100
    var speed = 1
    var draft: DraftView?
    var handoff: HandoffView?
    var result: BattleResult?
    var shoveOffCost = 15
    var helpMarks = ["", ""]
    /// Volley Points: Actions per side and Actions left per side (empty when off).
    var volleyActions = 0
    var volleyLeft: [Int] = []
    /// 1-10: the boss phase (1 to 3) and the shears jam, or nil.
    var bossPhase: Int?
    var bossJam = 0
    var cutShown = false
    /// Rescue: what to break, for the round label.
    var objective: String?
    var isYard = false

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
        doodads = s.doodads
        puffUp = s.puffUp
        steam = s.steam
        steamTurn = s.steamTurn
        steamMax = s.steamMax
        speed = s.speed
        draft = s.draft
        handoff = s.phase == .handoff ? (s.handoff ?? HandoffView(line: "", toSide: s.activeSide)) : nil
        result = s.result
        shoveOffCost = s.shoveOffCost
        helpMarks = s.helpMarks
        volleyActions = s.volleyActions
        volleyLeft = s.volleyLeft
        bossPhase = s.boss?.phase
        bossJam = s.boss?.jam ?? 0
        cutShown = s.boss?.cut != nil
        objective = s.objective
        isYard = s.mode == "test_yard"
    }

    var isVolley: Bool { volleyActions > 0 }
    /// "Shots left 7/10" for the side the HUD shows.
    var volleyText: String {
        guard isVolley, hudSide < volleyLeft.count else { return "" }
        return "Shots left \(volleyLeft[hudSide])/\(volleyActions)"
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

/// The Aim Drag band, kept apart from the session so a touch move redraws
/// only the band, not the whole HUD (H8).
@MainActor
final class DragModel: ObservableObject {
    @Published var overlay: DragOverlay?
}

/// Calls `onFrame` once per display refresh on the main run loop.
@MainActor
final class FrameClock: NSObject {
    private var link: CADisplayLink?
    private let onFrame: () -> Void

    init(onFrame: @escaping () -> Void) {
        self.onFrame = onFrame
        super.init()
    }

    var isRunning: Bool { link != nil }

    func start() {
        guard link == nil else { return }
        let l = CADisplayLink(target: self, selector: #selector(fire))
        l.add(to: .main, forMode: .common)
        link = l
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    @objc private func fire() { onFrame() }
}

/// A short blast flash drawn by the renderer after a `hit` event. View only.
struct BlastEffect: Equatable {
    var x: Double
    var y: Double
    var big: Bool
    var start: UInt64
}

/// One battle on screen: drives the core clock from the display, turns
/// touches into commands, and hands the latest snapshot to the renderer and
/// the HUD.
///
/// Every player action goes through one guard (`canAct`, H3): it is the
/// human's Plan step, the battle is not paused or stopped, and the core is not
/// busy with the Rival's turn. A refused action returns false, which also ends
/// any held key repeat (C1).
@MainActor
final class BattleSession: ObservableObject {
    let game: CoreGame
    let setup: BattleSetup
    let title: String

    @Published private(set) var hud = HudState()
    /// True while an Aim Drag is under way (changes twice a drag).
    @Published private(set) var dragging = false
    @Published var fineTuneOpen = false
    @Published private(set) var paused = false
    @Published var showPauseCard = false
    @Published private(set) var banner: String?
    @Published private(set) var layout = BattleLayout.empty
    /// A Doodad picked in the tray: Fire uses it instead of a shot.
    @Published private(set) var armedDoodad: String?
    let dragModel = DragModel()

    /// The newest frame, read by the renderer each draw.
    private(set) var snapshot = BattleSnapshot()
    /// Bumps whenever `snapshot` or `effects` change, so the renderer skips idle frames.
    private(set) var frameVersion = 0
    /// Blast flashes still on screen, read by the renderer.
    private(set) var effects: [BlastEffect] = []
    var settings = GameSettings()
    var isPad = false
    private(set) var stopped = false

    var onTurnStarted: ((BattleSession) -> Void)?
    /// The result, in the same frame it arrives: record it now (H5).
    var onResult: ((BattleSession, BattleResult) -> Void)?
    /// 1.2 s after the result: change screens.
    var onEnded: ((BattleSession, BattleResult) -> Void)?
    var onEvents: (([BattleEvent], BattleSnapshot) -> Void)?
    var onLocalHaptic: ((Haptics.Kind) -> Void)?
    /// The core stopped answering sensibly (M13).
    var onFault: ((BattleSession, String) -> Void)?
    /// Spoken lines (shot results) for VoiceOver.
    var onAnnounce: ((String) -> Void)?

    private var clock: FrameClock?
    private var bannerTask: Task<Void, Never>?
    private var foldTask: Task<Void, Never>?
    private var endTask: Task<Void, Never>?
    private var lastNanos: UInt64 = 0
    private var lastTurnSeq = -1
    private var endReported = false
    private var faultReported = false
    private var gesture: AimGesture?
    private var aimBeforeDrag: AimView?
    private var dragEndedAt: UInt64 = 0
    private var hitFullPower = false
    private var squallWarned = false
    private var squallAnnounced = false
    private var viewSize: CGSize = .zero
    private var viewInsets = Insets()
    /// The newest drag aim not yet sent, and when one was last sent (H8).
    private var pendingAim: (angle: Int, power: Int)?
    private var lastAimSentAt: UInt64 = 0
    /// Aim commands during a drag go out at most this often.
    static let aimInterval: UInt64 = 66_000_000

    init(game: CoreGame, setup: BattleSetup, title: String) {
        self.game = game
        self.setup = setup
        self.title = title
        if let s = game.frame() {
            snapshot = s
            hud = HudState(s)
            lastTurnSeq = s.phase == .draft ? -1 : s.turnSeq
        }
    }

    // MARK: Guard (H3)

    /// True when the person at the device may act on the field right now.
    var canAct: Bool {
        !stopped && !paused && !game.isBusy && game.isRunning && snapshot.phase == .plan && snapshot.humanTurn
    }

    /// True when the person may pick in the Rummage.
    var canDraft: Bool {
        !stopped && !game.isBusy && game.isRunning && snapshot.phase == .draft
    }

    // MARK: Clock

    /// Starts the battle clock, one step per display frame.
    func start() {
        guard clock == nil, !stopped else { return }
        lastNanos = 0
        let c = FrameClock { [weak self] in self?.tick() }
        clock = c
        c.start()
    }

    /// Ends the session for good: the clock, every task, any held key.
    func stop() {
        stopped = true
        clock?.stop()
        clock = nil
        bannerTask?.cancel()
        foldTask?.cancel()
        endTask?.cancel()
        endTask = nil
        gesture = nil
        pendingAim = nil
        dragModel.overlay = nil
        if dragging { dragging = false }
    }

    func tick() {
        guard !stopped else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        if lastNanos == 0 || paused {
            lastNanos = now
        } else if now > lastNanos {
            let ms = Int((now - lastNanos) / 1_000_000)
            if ms > 0 {
                game.advance(milliseconds: min(ms, 250))
                lastNanos += UInt64(ms) * 1_000_000
            }
        }
        flushAim(now: now, force: false)
        if let snap = game.frameIfNeeded() {
            apply(snap)
        } else if let fault = game.fault, !faultReported {
            faultReported = true
            stop()
            onFault?(self, fault)
        } else if !effects.isEmpty {
            // Blast flashes still playing: keep drawing until they are gone.
            effects.removeAll { now &- $0.start > 600_000_000 }
            frameVersion &+= 1
        }
    }

    private func apply(_ snap: BattleSnapshot) {
        let wasInFlight = snapshot.phase.isResolving
        let oldPhase = snapshot.phase
        snapshot = snap
        frameVersion &+= 1
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
        if !snap.lean || snap.phase != oldPhase {
            let next = HudState(snap)
            if next != hud { hud = next }
        }
        if !snap.humanTurn || snap.phase != .plan { armedDoodad = nil }
        if wasInFlight != snap.phase.isResolving {
            if snap.phase.isResolving { endDragKeepingAim(); fineTuneOpen = false }
            relayout()
        }
        if let result = snap.result, !endReported {
            endReported = true
            // Record at once; only the screen change waits (H5).
            onResult?(self, result)
            endTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                guard !Task.isCancelled, let self, !self.stopped else { return }
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
        game.rivalFast = settings.rivalTurnsFast
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

    /// A short line for a refused action, so a buzz is never the only answer (H2).
    private func refused(_ reply: CoreReply) {
        onLocalHaptic?(.illegal)
        guard let reason = reply.reason, reason != "busy" else { return }
        showBanner(Self.refusalText(reason))
    }

    static func refusalText(_ reason: String) -> String {
        switch reason {
        case "not_enough_steam": return "Not enough Steam"
        case "hob_cannot_fire": return "That Hob cannot fire"
        case "resting_plain_only": return "Resting: Plain Shot only"
        case "no_knack_uses": return "No Knack left"
        case "no_heavy_first_turn": return "No Heavy shot on the first turn"
        case "cannot_walk_now", "cannot_walk_there": return "Cannot walk there"
        case "cannot_shove_now", "not_buried": return "Nothing to shove off"
        case "already_acted": return "You have acted this turn"
        case "pin_faded": return "That Pin has faded"
        case "no_ghost": return "No shot to recall yet"
        case "no_doodad", "cannot_use_now": return "Cannot use that now"
        default: return reason.replacingOccurrences(of: "_", with: " ").capitalized
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
        // The larger iPad scale only when the window is big enough (Split View, Slide Over: M10).
        let big = isPad && min(viewSize.width, viewSize.height) >= 600
        let next = BattleLayout.compute(size: viewSize, insets: viewInsets, mode: mode,
                                        inFlight: snapshot.phase.isResolving, isPad: big)
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
        guard canAct, gesture == nil, layout.aimRegion.contains(point) else { return }
        gesture = AimGesture(anchor: point, powerSpan: layout.powerSpan, mode: settings.dragMode)
        aimBeforeDrag = snapshot.aim
        hitFullPower = false
    }

    func touchMoved(to point: CGPoint) {
        guard var g = gesture else { return }
        guard canAct else {
            endDragKeepingAim(restore: true)
            return
        }
        let started = g.move(to: point)
        gesture = g
        if started {
            onLocalHaptic?(.dragStart)
            fineTuneOpen = false
            dragging = true
        }
        guard g.isDragging else { return }
        // Throttled: the newest aim goes out at most every 66 ms, and always on release (H8).
        pendingAim = (g.angleTenths, g.power)
        if g.power >= 100 && !hitFullPower {
            hitFullPower = true
            onLocalHaptic?(.tick)
        } else if g.power < 100 {
            hitFullPower = false
        }
        dragModel.overlay = DragOverlay(anchor: g.anchor, end: g.bandEnd, angle: g.angleTenths, power: g.power,
                                        armed: settings.quickFire && !g.isInCancelRing)
    }

    private func flushAim(now: UInt64, force: Bool) {
        guard let aim = pendingAim else { return }
        guard force || now &- lastAimSentAt >= Self.aimInterval else { return }
        pendingAim = nil
        lastAimSentAt = now
        guard canAct else { return }
        game.send(.aim(angle: aim.angle, power: aim.power))
    }

    private func clearDrag() {
        gesture = nil
        pendingAim = nil
        dragModel.overlay = nil
        if dragging { dragging = false }
    }

    func touchEnded(at point: CGPoint) {
        guard var g = gesture else { return }
        _ = g.move(to: point)
        clearDrag()
        guard g.isDragging, canAct else { return }
        if g.isInCancelRing {
            restoreAim()
            return
        }
        game.send(.aim(angle: g.angleTenths, power: g.power))
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
        clearDrag()
        guard canAct else { return }
        if restore || !g.isDragging || g.isInCancelRing {
            if g.isDragging { restoreAim() }
        } else {
            game.send(.aim(angle: g.angleTenths, power: g.power))
        }
    }

    private func restoreAim() {
        guard let before = aimBeforeDrag, before.set else { return }
        game.send(.aim(angle: before.angle, power: before.power))
    }

    // MARK: HUD actions

    /// Fire acts on finger up inside the button, with a 150 ms guard after an
    /// Aim Drag. With a Doodad picked it uses the Doodad; with the Hob dug in
    /// it shoves off.
    func fire() {
        guard canAct else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        guard now - dragEndedAt >= 150_000_000 else { return }
        if let doodad = armedDoodad {
            _ = useDoodad(doodad)
        } else if snapshot.dugIn {
            _ = shoveOff()
        } else {
            sendFire()
        }
    }

    private func sendFire() {
        guard canAct else { return }
        let reply = game.send(.fire())
        if reply.ok {
            fineTuneOpen = false
            onLocalHaptic?(.fire)
        } else {
            refused(reply)
        }
        tick()
    }

    /// Pass: spend the Action doing nothing, so a turn can always end (H2).
    @discardableResult
    func pass() -> Bool {
        guard canAct else { return false }
        let reply = game.send(.pass)
        if reply.ok { onLocalHaptic?(.tick) } else { refused(reply) }
        tick()
        return reply.ok
    }

    /// Shove Off: 15 Steam to clear the selected Hob's buried Loophole. No Action spent.
    @discardableResult
    func shoveOff() -> Bool {
        guard canAct, let id = snapshot.selectedHob, let hob = Int(id) else { return false }
        let reply = game.send(.shoveOff(hob: hob))
        if reply.ok { onLocalHaptic?(.tick) } else { refused(reply) }
        tick()
        return reply.ok
    }

    /// Picks a Doodad chip: Fire then uses it. Picking it again puts it down.
    func armDoodad(_ id: String) {
        guard canAct else { return }
        armedDoodad = armedDoodad == id ? nil : id
        onLocalHaptic?(.tick)
    }

    /// Uses a Doodad as the Action, with the core's default targets (Mend
    /// Bucket: the most hurt blocks; Pot Lid: the Kettle Room).
    @discardableResult
    func useDoodad(_ id: String) -> Bool {
        guard canAct else { return false }
        let reply = game.send(.doodad(doodad: id))
        armedDoodad = nil
        if reply.ok { onLocalHaptic?(.fire) } else { refused(reply) }
        tick()
        return reply.ok
    }

    /// Fine Tune: angle in tenths of a degree, power in whole points.
    /// Returns false when refused, which also ends a held repeat.
    @discardableResult
    func nudge(angle dAngle: Int, power dPower: Int) -> Bool {
        guard canAct else { return false }
        let a = snapshot.aim
        let angle = min(1800, max(0, a.angle + dAngle))
        let power = min(100, max(0, a.power + dPower))
        if angle == a.angle && power == a.power && a.set {
            onLocalHaptic?(.illegal)
            return false
        }
        let reply = game.send(.aim(angle: angle, power: power))
        onLocalHaptic?(reply.ok ? .tick : .illegal)
        scheduleFold()
        tick()
        return reply.ok
    }

    func toggleFineTune() {
        guard canAct else { return }
        fineTuneOpen.toggle()
        if fineTuneOpen { scheduleFold() }
    }

    func recall() {
        guard canAct else { return }
        let reply = game.recall()
        if !reply.ok {
            refused(reply)
            return
        }
        fineTuneOpen = true
        scheduleFold()
        tick()
    }

    func pickHob(_ id: String) {
        guard canAct else { return }
        let reply = game.send(.pickHob(hob: Int(id) ?? -1))
        if reply.ok { onLocalHaptic?(.tick) } else { refused(reply) }
        tick()
    }

    func pickShot(_ id: String) {
        guard canAct else { return }
        armedDoodad = nil
        let reply = game.send(.pickShot(shot: id))
        if reply.ok { onLocalHaptic?(.tick) } else { refused(reply) }
        tick()
    }

    /// One Walk step of 4 cells (1 Steam); the HUD repeats it while the key is
    /// held. Returns false when refused or not allowed, which ends the repeat.
    @discardableResult
    func walk(_ dir: Int) -> Bool {
        guard canAct else { return false }
        let reply = game.send(.walk(dx: dir * 4))
        if !reply.ok { refused(reply) }
        return reply.ok
    }

    func speedUp() {
        guard !stopped else { return }
        game.speed = game.speed >= 2 ? 1 : 2
        game.markDirty()
        tick()
    }

    func ready() {
        guard !stopped else { return }
        game.ready()
        tick()
    }

    func draftPick(_ id: String) {
        guard canDraft else { return }
        let ok = game.send(.pickShell(shell: id)).ok
        onLocalHaptic?(ok ? .tick : .illegal)
        tick()
    }

    func quickPick() {
        guard canDraft else { return }
        game.send(.quickPick())
        tick()
    }

    func endDraft() {
        guard !stopped, game.isRunning else { return }
        game.send(.endDraft)
        tick()
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

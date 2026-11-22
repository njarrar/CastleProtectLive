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
    /// Why Fire is grey, in the core's words (rules 3), or nil.
    var fireText: String?
    /// Fatigue (rules 3): on, and rounds until it starts.
    var fatigue = false
    var fatigueIn: Int?

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
        fireText = s.fireText
        fatigue = s.fatigue
        fatigueIn = s.fatigueIn
    }

    /// "Fatigue in 3", "2", "1" before Fatigue starts, "Fatigue" once it is on, else nil.
    var fatigueText: String? {
        if isYard || isVolley { return nil }
        if fatigue { return "Fatigue" }
        if let n = fatigueIn, n >= 1, n <= 3 { return "Fatigue in \(n)" }
        return nil
    }

    /// The round label's main words: the Test Yard has no rounds to count.
    var roundText: String { isYard ? "Test Yard" : "Round \(round)/\(roundCap)" }

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
    /// Banners waiting for the one on screen (a turn line, then Fatigue or a shot switch).
    private(set) var bannerQueue: [String] = []
    /// The plan camera's pan in world cells: a press away from your fort drags the view
    /// (QA playtest 1). Read by the renderer each draw; reset at each turn start.
    private(set) var cameraPan: Double = 0
    /// True while a finger pans the camera (the camera follows it without easing).
    @Published private(set) var panning = false
    private var panStart: (point: CGPoint, pan: Double, scale: CGFloat)?
    private var fatigueWarnedRound = -1

    /// The newest frame, read by the renderer each draw.
    private(set) var snapshot = BattleSnapshot()
    /// Bumps whenever `snapshot` changes, so the renderer skips idle frames.
    private(set) var frameVersion = 0
    /// View time, hit stop, slow motion, shake and every effect on the field.
    let fx = FieldFX()
    var settings = GameSettings() {
        didSet { applyFxSettings() }
    }
    /// A bark subtitle on screen, and its side.
    @Published private(set) var subtitle: (text: String, side: Int)?
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
    /// Where a view point lands in the world, from the field view's lens cameras.
    var lensMap: ((CGPoint) -> LensMap?)?
    /// Each new frame, for loops and music layers.
    var onFrame: ((BattleSnapshot) -> Void)?
    /// The Pause card went up (true) or away (false): sound follows it (UX 8.2).
    var onPausedChanged: ((Bool) -> Void)?

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
    /// Sim time owed after hit stop and slow motion scale the clock (ms).
    private var simCarry = 0.0
    private var subtitleTask: Task<Void, Never>?
    /// The HUD kept its old numbers while a collapse show plays.
    private var hudHeld = false
    /// Aim commands during a drag go out at most this often.
    static let aimInterval: UInt64 = 66_000_000

    init(game: CoreGame, setup: BattleSetup, title: String) {
        self.game = game
        self.setup = setup
        self.title = title
        let catalog = game.catalog
        fx.trailKind = { catalog.trailKind($0) }
        if let s = game.frame() {
            snapshot = s
            hud = HudState(s)
            lastTurnSeq = s.phase == .draft ? -1 : s.turnSeq
            fx.noteState(s)
        }
    }

    private func applyFxSettings() {
        fx.reduceMotion = settings.reduceMotion
        fx.shakeAmount = settings.reduceMotion ? min(0.5, Double(settings.shake) / 100) : Double(settings.shake) / 100
    }

    /// Shows a bark's subtitle for 1.5 s plus a little per letter (at least 2 s).
    func showSubtitle(_ text: String, side: Int) {
        guard settings.subtitles else { return }
        subtitle = (text, side)
        subtitleTask?.cancel()
        let seconds = max(2, 1.5 + 0.06 * Double(text.count))
        subtitleTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.subtitle = nil
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
        subtitleTask?.cancel()
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
                let real = min(ms, 250)
                // View time first: hit stop and slow motion hold the sim clock too (the sim
                // is fixed step, so this changes when it is drawn, never what happens).
                let view = fx.advance(realMs: Double(real), nowNanos: now)
                fx.runTimers()
                if fx.collapseShowing && snapshot.shells.isEmpty && snapshot.phase.isResolving {
                    // The core's settle is shorter than the fall show: the sim waits for the blocks
                    // to land, so the next turn never starts with blocks in the air (review 2, M6).
                    simCarry = 0
                } else {
                    simCarry = min(500, simCarry + view)
                    let simMs = Int(simCarry)
                    if simMs > 0 {
                        simCarry -= Double(simMs)
                        game.advance(milliseconds: simMs)
                    }
                }
                lastNanos += UInt64(ms) * 1_000_000
            }
        }
        flushAim(now: now, force: false)
        if hudHeld && !fx.collapseShowing {
            hudHeld = false
            let next = HudState(snapshot)
            if next != hud { hud = next }
        }
        if let snap = game.frameIfNeeded() {
            apply(snap)
        } else if let fault = game.fault, !faultReported {
            faultReported = true
            stop()
            onFault?(self, fault)
        }
        if game.recoveredNotice {
            game.recoveredNotice = false
            // The battle was rebuilt from the turn start: no pose or show of the old run is left (L5).
            fx.reset()
            if let s = game.frame() { apply(s) }
            showBanner("Hiccup! Back to the start of the turn")
        }
    }

    private func apply(_ snap: BattleSnapshot) {
        let wasInFlight = snapshot.phase.isResolving
        let oldPhase = snapshot.phase
        let now = DispatchTime.now().uptimeNanoseconds
        let old = snapshot
        if !snap.events.isEmpty {
            fx.ingest(snap.events, old: old, new: snap, nowNanos: now)
        } else if !snap.lean {
            fx.noteState(snap)
        }
        if !snap.shells.isEmpty || !old.shells.isEmpty { fx.trail(snap.shells, ids: Array(0..<snap.shells.count)) }
        snapshot = snap
        frameVersion &+= 1
        if !snap.events.isEmpty { onEvents?(snap.events, snap) }
        onFrame?(snap)
        if snap.phase != .draft && snap.phase != .none && snap.turnSeq != lastTurnSeq {
            lastTurnSeq = snap.turnSeq
            turnStarted(snap)
        }
        noteRulesEvents(snap)
        // A lean frame can still move what the HUD shows: the aim after `aim` (Fine Tune, the
        // readout, VoiceOver), Fire after READY, and the 2x label (review 2, H1 and H2).
        if fx.collapseShowing && snap.phase == oldPhase {
            // Kettle and crew numbers wait for the ghost blocks to land (review 2, M6).
            hudHeld = true
        } else if !snap.lean || snap.phase != oldPhase || snap.aim != hud.aim || snap.canFire != hud.canFire
            || snap.speed != hud.speed || snap.selectedHob != hud.selectedHob || hudHeld {
            hudHeld = false
            let next = HudState(snap)
            if next != hud { hud = next }
        }
        if !snap.humanTurn || snap.phase != .plan { armedDoodad = nil }
        if wasInFlight != snap.phase.isResolving {
            if snap.phase.isResolving { endDragKeepingAim(); endPan(); cameraPan = 0; fineTuneOpen = false }
            relayout()
        }
        if let result = snap.result, !endReported {
            endReported = true
            // Record at once; only the screen change waits (H5).
            onResult?(self, result)
            endTask = Task { [weak self] in
                // At least 1.2 s, then wait for the kettle pop show and any collapse to end,
                // so the screen change never cuts the slow motion (review 2, M8). Capped at 3 s.
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                var waited = 1_200
                while waited < 3_000 {
                    guard !Task.isCancelled, let self, !self.stopped else { return }
                    if !self.fx.isPopShowing && !self.fx.collapseShowing { break }
                    try? await Task.sleep(nanoseconds: 100_000_000)
                    waited += 100
                }
                guard !Task.isCancelled, let self, !self.stopped else { return }
                self.onEnded?(self, result)
            }
        }
    }

    private func turnStarted(_ snap: BattleSnapshot) {
        // Test Yard: the Dummy side passes itself in a blink; no banner for it (rules 3).
        if snap.mode == "test_yard" && !snap.isHuman(snap.activeSide) { return }
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
        cameraPan = 0
        endPan()
        bannerQueue = []
        showBanner(text)
        // Fatigue next round: a warning one round before it starts (rules 3, QA playtest 1 M2).
        if snap.fatigueIn == 1 && !snap.fatigue && fatigueWarnedRound != snap.round {
            fatigueWarnedRound = snap.round
            showBanner("Fatigue next round", queued: true)
        }
        // The Fine Tune pad moves to the side away from the fort on turn (Couch Duel).
        relayout()
        onTurnStarted?(self)
    }

    /// Banners for the rules 3 events: the Fatigue warning and start, and a picked shot that
    /// moved to the Plain Shot. Each waits for the banner on screen.
    private func noteRulesEvents(_ snap: BattleSnapshot) {
        for e in snap.events {
            switch e.type {
            case "fatigue_warn":
                if fatigueWarnedRound != snap.round {
                    fatigueWarnedRound = snap.round
                    showBanner(e.text.isEmpty ? "Fatigue next round" : e.text, queued: true)
                }
            case "fatigue":
                showBanner(e.text.isEmpty ? "Fatigue!" : e.text, queued: true)
            case "shot_switch":
                guard snap.isHuman(e.side) else { break }
                showBanner(Self.shotSwitchText(e, snap: snap), queued: true)
            default:
                break
            }
        }
    }

    /// The line for a `shot_switch`: the unready chip's own words when the core sent them.
    static func shotSwitchText(_ e: BattleEvent, snap: BattleSnapshot) -> String {
        let from = e.raw?.fromShot ?? ""
        if let chip = snap.shots.first(where: { $0.id == from }), let text = chip.text, !text.isEmpty {
            return text
        }
        let hob = snap.forts.flatMap(\.hobs).first { $0.id == String(e.amount) }
        let reason = e.text.isEmpty ? "" : refusalText(e.text)
        if let hob, !reason.isEmpty { return "\(hob.name): \(reason)" }
        return "Switched to the Plain Shot"
    }

    /// Shows a banner for 1.2 s. A queued one waits for the banner on screen to finish.
    private func showBanner(_ text: String, queued: Bool = false) {
        if queued, banner != nil {
            if banner != text && !bannerQueue.contains(text) { bannerQueue.append(text) }
            return
        }
        banner = text
        bannerTask?.cancel()
        bannerTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            guard !Task.isCancelled, let self else { return }
            if self.bannerQueue.isEmpty {
                self.banner = nil
            } else {
                self.showBanner(self.bannerQueue.removeFirst())
            }
        }
    }

    /// A short line for a refused action, so a buzz is never the only answer (H2). A refusal
    /// with the core's own words (rules 3 `detail`) shows those.
    private func refused(_ reply: CoreReply) {
        onLocalHaptic?(.illegal)
        guard let reason = reply.reason, reason != "busy" else { return }
        if let detail = reply.detail, !detail.isEmpty, reply.shot != nil || reply.readyShot != nil {
            showBanner(detail)
        } else {
            showBanner(Self.refusalText(reason))
        }
    }

    nonisolated static func refusalText(_ reason: String) -> String {
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
        case "nothing_to_mend": return "Nothing to mend"
        case "no_one_to_puff_up": return "No one to Puff Up"
        case "bad_target": return "Pick one of your own blocks"
        case "no_actions_left": return "No shots left"
        case "battle_over": return "The battle is over"
        case "buried": return "Dug in: Shove Off first"
        case "resting": return "Resting this turn"
        case "bad_value": return "That aim is out of range"
        case "recovered": return "Hiccup! Back to the start of the turn"
        case "dead_handle", "panic": return "The rules core stopped"
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
        let hudSide = snapshot.isDuel ? snapshot.activeSide : 0
        let next = BattleLayout.compute(size: viewSize, insets: viewInsets, mode: mode,
                                        inFlight: snapshot.phase.isResolving, isPad: big,
                                        hudSide: hudSide, leftHand: settings.leftHand)
        if next != layout { layout = next }
    }

    // MARK: Pause

    func pause() {
        guard !paused else { return }
        endDragKeepingAim(restore: true)
        paused = true
        showPauseCard = true
        onPausedChanged?(true)
    }

    func resume() {
        let was = paused
        paused = false
        showPauseCard = false
        if was { onPausedChanged?(false) }
    }

    // MARK: Aim Drag

    func touchBegan(at point: CGPoint) {
        guard canAct, gesture == nil, panStart == nil, layout.aimRegion.contains(point) else { return }
        guard aimMayStart(at: point) else {
            // A press away from your fort pans the camera instead (QA playtest 1).
            beginPan(at: point)
            return
        }
        gesture = AimGesture(anchor: point, powerSpan: layout.powerSpan, mode: settings.dragMode,
                             bounds: CGRect(origin: .zero, size: viewSize == .zero ? layout.size : viewSize))
        aimBeforeDrag = snapshot.aim
        hitFullPower = false
    }

    // MARK: Camera pan

    private func beginPan(at point: CGPoint) {
        let scale = lensMap?(point)?.scale ?? 1
        panStart = (point, cameraPan, max(0.0001, scale))
    }

    /// Moves the plan camera with the finger: dragging right shows more of the left.
    private func movePan(to point: CGPoint) {
        guard let start = panStart else { return }
        let dx = point.x - start.point.x
        if !panning && abs(dx) < AimGesture.dragThreshold { return }
        if !panning {
            panning = true
            fineTuneOpen = false
        }
        let limit = max(1, snapshot.world.w)
        cameraPan = min(limit, max(-limit, start.pan - Double(dx / start.scale)))
        frameVersion &+= 1
    }

    private func endPan() {
        panStart = nil
        if panning {
            panning = false
            frameVersion &+= 1
        }
    }

    /// Pans the plan camera by `cells` (tests and the screen reader).
    func pan(by cells: Double) {
        let limit = max(1, snapshot.world.w)
        cameraPan = min(limit, max(-limit, cameraPan + cells))
        frameVersion &+= 1
    }

    /// Design 00, 2.3: an Aim Drag only starts on the player's own fort (its blocks' box grown
    /// by 32 cells, two blocks) or within 48 pt of the picked Hob. A press anywhere else never
    /// changes the aim. Without a lens camera yet (no draw so far) the old rule holds.
    func aimMayStart(at point: CGPoint) -> Bool {
        guard let map = lensMap?(point) else { return lensMap == nil }
        guard let fort = snapshot.fort(snapshot.activeSide) else { return true }
        let w = map.world(point)
        let m = 32.0
        let x0 = fort.originX
        let x1 = fort.originX + Double(fort.cols) * fort.block
        let tops = fort.blocks.map { $0.y + $0.h }
        let bottoms = fort.blocks.map { $0.y }
        let y0 = min(bottoms.min() ?? fort.baseY, fort.baseY)
        let y1 = max(tops.max() ?? fort.baseY + fort.block, fort.baseY)
        if Double(w.x) >= x0 - m && Double(w.x) <= x1 + m && Double(w.y) >= y0 - m && Double(w.y) <= y1 + m { return true }
        if let id = snapshot.selectedHob, let hob = fort.hobs.first(where: { $0.id == id }) {
            let at = map.view(CGPoint(x: hob.x, y: hob.y))
            if hypot(at.x - point.x, at.y - point.y) <= 48 { return true }
        }
        return false
    }

    func touchMoved(to point: CGPoint) {
        if panStart != nil {
            movePan(to: point)
            return
        }
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
        if panStart != nil {
            movePan(to: point)
            endPan()
            return
        }
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
        endPan()
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
            // Rules 3: a refused Fire spends nothing. Show the core's words, and move the pick to
            // the shot it names (`ready_shot`), so the next tap fires (QA playtest 1, M1).
            refused(reply)
            if let next = reply.readyShot, !next.isEmpty, next != snapshot.selectedShot, canAct {
                let switched = game.send(.pickShot(shot: next))
                if switched.ok { onLocalHaptic?(.tick) }
            }
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
        if reply.ok {
            onLocalHaptic?(.tick)
            // The pick stands even when it cannot fire now; say why (rules 3).
            if reply.ready == false {
                let chip = snapshot.shots.first { $0.id == id }
                let text = reply.text ?? chip?.text ?? reply.why.map(Self.refusalText)
                if let text, !text.isEmpty { showBanner(text) }
            }
        } else {
            refused(reply)
        }
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
        fx.fast = game.speed >= 2
        if game.speed >= 2 { fx.cancelSlowMotion() }
        game.markDirty()
        tick()
    }

    /// Give up: the other side wins (`how: "give_up"`); a campaign loss still pays its Buttons.
    /// Works in any phase but ended, even while the Rival thinks.
    @discardableResult
    func giveUp() -> Bool {
        guard !stopped, game.isRunning, snapshot.phase != .ended else { return false }
        game.waitUntilIdle()
        let side: Int? = snapshot.isDuel ? snapshot.activeSide : nil
        let reply = game.giveUp(side: side)
        let was = paused
        paused = false
        showPauseCard = false
        if was { onPausedChanged?(false) }
        if !reply.ok { refused(reply) }
        game.markDirty()
        tick()
        return reply.ok
    }

    /// Test Yard: set the wind now and for every later front.
    func setWind(_ wind: Int) {
        guard !stopped, game.isRunning, hud.isYard else { return }
        let reply = game.send(.setWind(wind: wind))
        if !reply.ok { refused(reply) }
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

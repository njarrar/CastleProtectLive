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
    var names = [GameText.shared.t("common.you"), GameText.shared.t("common.rival")]
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

    /// "Creaks in 3", "2", "1" before the Creaks start, "The Creaks" once on, else nil (`hud.creaks`).
    var fatigueText: String? {
        if isYard || isVolley { return nil }
        if fatigue { return GameText.shared.t("hud.creaks.on") }
        if let n = fatigueIn, n >= 1, n <= 3 { return GameText.shared.t("hud.creaks.in", ["n": n]) }
        return nil
    }

    /// The round label's main words: the Test Yard has no rounds to count.
    var roundText: String {
        isYard ? GameText.shared.t("hud.test_yard") : GameText.shared.t("hud.round", ["n": round, "cap": roundCap])
    }

    var isVolley: Bool { volleyActions > 0 }
    /// "Shots left: 7 of 10" for the side the HUD shows.
    var volleyText: String {
        guard isVolley, hudSide < volleyLeft.count else { return "" }
        return GameText.shared.t("hud.shots_left", ["n": volleyLeft[hudSide], "total": volleyActions])
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

/// "Drag from your fort to aim": a short line by the player's fort (view points).
struct AimNudge: Equatable {
    var text: String
    var point: CGPoint

    /// Above the fort, kept on screen with room for the line.
    static func clamped(_ p: CGPoint, in size: CGSize) -> CGPoint {
        let x = min(max(p.x, 120), max(120, size.width - 120))
        let y = min(max(p.y - 20, 70), max(70, size.height - 60))
        return CGPoint(x: x, y: y)
    }
}

/// The Aim Drag band, kept apart from the session so a touch move redraws
/// only the band, not the whole HUD (H8).
@MainActor
final class DragModel: ObservableObject {
    @Published var overlay: DragOverlay?
}

/// Carries a CADisplayLink so `FrameClock.deinit` can invalidate it safely in Swift 6.
private final class DisplayLinkBox: @unchecked Sendable {
    private let lock = NSLock()
    private var link: CADisplayLink?

    var isRunning: Bool {
        lock.lock()
        defer { lock.unlock() }
        return link != nil
    }

    func replace(with newLink: CADisplayLink?) {
        lock.lock()
        let old = link
        link = newLink
        lock.unlock()
        if let old {
            let box = UncheckedBox(old)
            if Thread.isMainThread {
                box.value.invalidate()
            } else {
                DispatchQueue.main.async { box.value.invalidate() }
            }
        }
    }
}

/// Weak target proxy so `CADisplayLink` never creates a retain cycle with `FrameClock`.
@MainActor
private final class DisplayLinkProxy: NSObject {
    weak var owner: FrameClock?
    init(_ owner: FrameClock) {
        self.owner = owner
        super.init()
    }
    @objc func fire() { owner?.handleFire() }
}

/// Calls `onFrame` once per display refresh on the main run loop.
@MainActor
final class FrameClock {
    private let linkBox = DisplayLinkBox()
    private let onFrame: () -> Void

    init(onFrame: @escaping () -> Void) {
        self.onFrame = onFrame
    }

    deinit {
        linkBox.replace(with: nil)
    }

    var isRunning: Bool { linkBox.isRunning }

    func start() {
        guard !linkBox.isRunning else { return }
        let proxy = DisplayLinkProxy(self)
        let l = CADisplayLink(target: proxy, selector: #selector(DisplayLinkProxy.fire))
        l.add(to: .main, forMode: .common)
        linkBox.replace(with: l)
    }

    func stop() {
        linkBox.replace(with: nil)
    }

    fileprivate func handleFire() { onFrame() }
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
    /// Optional shot dial ("hops3", "rebuild", "puff_up") sent with `fire`.
    @Published var selectedDial: String?
    /// Optional own-fort block `[c, r]` sent with self-mend shots (`mendglob`).
    @Published var selectedBlockTarget: [Int]?
    /// True while tapping an own-fort block selects a self-mend target for `mendglob`.
    @Published var pickingMendTarget = false
    /// Room chosen for Pot Lid ("kettle" or "nook:N").
    @Published var armedDoodadRoom: String = "kettle"
    /// Up to 3 own-fort blocks `[c, r]` picked for Mend Bucket (empty = core picks most hurt).
    @Published var armedDoodadTargets: [[Int]] = []
    /// Edge (-1 left, +1 right) for the native SwiftUI "View Rival fort" / "Back to my fort" button.
    @Published private(set) var rivalMarkerEdge: Int?
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
    private var fatigueShownRound = -1
    /// The fort the camera holds while the round 10 Fatigue collapse plays and settles, so your
    /// own fort is in view when your turn opens (QA playtest 2, N1). Cleared by the next shot.
    private(set) var cameraHome: Int?
    /// Phone landscape: a tap on the Rival fort marker shows both forts at any zoom; a second tap,
    /// a shot or the next turn brings the camera home (QA playtest 2, N3).
    @Published private(set) var rivalPeek = false
    /// Aims started from the fort so far (saved). The gold ring on the picked Hob shows until 3.
    var aimStarts = 0
    /// "Drag from your fort to aim", shown once a battle when a drag starts in the sky.
    @Published private(set) var aimNudge: AimNudge?
    private var skyNudged = false
    /// How many times the nudge showed this battle (at most once).
    private(set) var nudgeCount = 0
    private var nudgeTask: Task<Void, Never>?
    /// The turn whose opening Hob was checked (n1: open each turn on a Hob who can act).
    private var openCheckedTurn = -1

    /// The newest frame, read by the renderer each draw.
    private(set) var snapshot = BattleSnapshot()
    /// Bumps whenever `snapshot` changes, so the renderer skips idle frames.
    private(set) var frameVersion = 0
    /// View time, hit stop, slow motion, shake and every effect on the field.
    let fx = FieldFX()
    @Published var settings = GameSettings() {
        didSet {
            applyFxSettings()
            game.rivalFast = settings.rivalTurnsFast
            if settings.leftHand != oldValue.leftHand
                || settings.reduceMotion != oldValue.reduceMotion
                || settings.largeText != oldValue.largeText {
                relayout()
            }
            if settings.colourSet != oldValue.colourSet
                || settings.reduceMotion != oldValue.reduceMotion {
                frameVersion &+= 1
            }
        }
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
    /// An Aim Drag started from the fort: the app counts it toward hiding the gold ring.
    var onAimStarted: ((Int) -> Void)?
    /// Where a view point lands in the world, from the field view's lens cameras.
    var lensMap: ((CGPoint) -> LensMap?)?
    /// Each new frame, for loops and music layers.
    var onFrame: ((BattleSnapshot) -> Void)?
    /// The Pause card went up (true) or away (false): sound follows it (UX 8.2).
    var onPausedChanged: ((Bool) -> Void)?
    /// One-shot UI/aim audio cues (`aim_set`, `aim_limit`, `aim_tick`, `aim_recall`, `turn_hob_pick`, `fly_fast_zip`).
    var onAudioCue: ((String) -> Void)?
    /// Continuous aim band stretch loop `(gain, pitch)`.
    var onAimBand: ((Float, Double) -> Void)?
    /// Current slow-motion time scale for music/loop varispeed.
    var onSlowMo: ((Float) -> Void)?
    /// A Hob was explicitly picked by the player (for `"picked"` bark).
    var onHobPicked: ((String, Int) -> Void)?
    /// Fired after each display-link tick so `BattleSKView` shares the session's single display link.
    var onDisplayTick: (() -> Void)?

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
    /// The last Rival turn banner was a `rivals.banner.thinking` line (never two running).
    private var lastRivalLine = false
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

    /// The gold ring on the picked Hob shows until this many aims were started from the fort.
    nonisolated static let ownerRingAims = 3
    nonisolated static var skyNudgeText: String { GameText.shared.t("hud.aim_hint") }
    /// Round 9: one round before the Creaks. Round 10: the collapse starts (shown in red).
    nonisolated static var fatigueWarnText: String { GameText.shared.t("banners.creaks.warn") }
    nonisolated static var fatigueStartText: String { GameText.shared.t("banners.creaks.start") }

    /// True for the Creaks banners, which the turn banner waits for.
    nonisolated static func isFatigueBanner(_ text: String) -> Bool {
        !text.isEmpty && (text == fatigueWarnText || text == fatigueStartText)
    }

    /// The gold ring shows on the picked Hob on the player's Plan step until 3 aims were started
    /// from the fort (QA playtest 2, owner rule).
    var showOwnerRing: Bool { aimStarts < Self.ownerRingAims && snapshot.humanTurn }

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
            openCheckedTurn = s.phase == .draft ? -1 : s.turnSeq
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
        nudgeTask?.cancel()
        endTask = nil
        gesture = nil
        pendingAim = nil
        dragModel.overlay = nil
        onAimBand?(0, 0)
        onSlowMo?(1)
        if dragging { dragging = false }
        if rivalMarkerEdge != nil { rivalMarkerEdge = nil }
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
        if !paused { onSlowMo?(Float(fx.timeScale(nowNanos: now))) }
        flushAim(now: now, force: false)
        if hudHeld && !fx.collapseShowing {
            hudHeld = false
            let next = HudState(snapshot)
            if next != hud { hud = next }
        }
        // Check recovery BEFORE reading the next frame so stale FX are reset first (iOS-M7).
        if game.recoveredNotice {
            game.recoveredNotice = false
            fx.reset()
            openCheckedTurn = -1
            resetActionOptions()
            armedDoodad = nil
            if let s = game.frame() { apply(s) }
            showBanner(GameText.shared.t("errors.turn_reset"))
        } else if let snap = game.frameIfNeeded() {
            apply(snap)
        } else if let fault = game.fault, !faultReported {
            faultReported = true
            stop()
            onFault?(self, fault)
        }
        onDisplayTick?()
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
        if !snap.shells.isEmpty || !old.shells.isEmpty { fx.trail(snap.shells, ids: snap.shells.map(\.id)) }
        // A shell in the air: the Fatigue hold and any Rival peek end, the camera follows it.
        if !snap.shells.isEmpty { cameraHome = nil; if rivalPeek { rivalPeek = false } }
        snapshot = snap
        frameVersion &+= 1
        if !snap.events.isEmpty { onEvents?(snap.events, snap) }
        onFrame?(snap)
        if snap.phase != .draft && snap.phase != .none && snap.turnSeq != lastTurnSeq {
            lastTurnSeq = snap.turnSeq
            turnStarted(snap)
        }
        noteRulesEvents(snap)
        openOnAnActingHob(snap)
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
        if !snap.humanTurn || snap.phase != .plan {
            armedDoodad = nil
            resetActionOptions()
        }
        if wasInFlight != snap.phase.isResolving {
            if snap.phase.isResolving {
                endDragKeepingAim(); endPan(); cameraPan = 0; fineTuneOpen = false
                if rivalPeek { rivalPeek = false }
            }
            relayout()
        } else {
            refreshRivalMarker()
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
        resetActionOptions()
        // Test Yard: the Dummy side passes itself in a blink; no banner for it (rules 3).
        if snap.mode == "test_yard" && !snap.isHuman(snap.activeSide) { return }
        let words = GameText.shared
        let name = snap.name(snap.activeSide)
        var text: String
        if snap.isDuel {
            text = words.t("banners.name_turn", ["name": name])
        } else if snap.isHuman(snap.activeSide) {
            text = words.t("banners.your_turn")
        } else {
            let rival = words.rivalShort(name)
            // Now and then a Rival line in place of "aims", one turn in four at most (text.json).
            if !lastRivalLine && Double.random(in: 0..<1) < 0.25, words.has("rivals.banner.thinking") {
                text = words.pick("rivals.banner.thinking", ["rival": rival])
                lastRivalLine = true
            } else {
                text = words.t("banners.rival_aims", ["rival": rival])
                lastRivalLine = false
            }
        }
        if snap.squallRound >= 1 && !squallAnnounced {
            squallAnnounced = true
            text = words.t("banners.weather.squall")
        } else if snap.squallIn == 3 && !squallWarned {
            squallWarned = true
            text = words.t("banners.weather.squall_in", ["n": 3])
        }
        game.rivalFast = settings.rivalTurnsFast
        cameraPan = 0
        endPan()
        if rivalPeek { rivalPeek = false }
        // Fatigue comes first and the turn banner waits for it (QA playtest 2, N1): "Fatigue next
        // round" in round 9, a red "Fatigue!" in round 10 while the collapse plays.
        let lead = fatigueLead(snap)
        let holding = banner.map(Self.isFatigueBanner) ?? false
        if !holding { bannerQueue = [] }
        if let lead {
            if snap.events.contains(where: { $0.type == "fatigue" }) { holdHome(snap) }
            showBanner(lead, seconds: Self.fatigueBannerSeconds)
            showBanner(text, queued: true)
        } else if holding {
            showBanner(text, queued: true)
        } else {
            showBanner(text)
        }
        // Pick an acting Hob BEFORE autosave runs so the saved turn starts on that Hob (iOS-M3).
        openOnAnActingHob(snap)
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
                    showBanner(Self.fatigueWarnText, queued: true)
                }
            case "fatigue":
                holdHome(snap)
                if fatigueShownRound != snap.round {
                    fatigueShownRound = snap.round
                    // The collapse starts now: its banner takes over at once, and a turn banner
                    // that follows waits for it.
                    showBanner(Self.fatigueStartText, seconds: Self.fatigueBannerSeconds)
                }
            case "shot_switch":
                guard snap.isHuman(e.side) else { break }
                showBanner(Self.shotSwitchText(e, snap: snap), queued: true)
            default:
                break
            }
        }
    }

    /// How long a Fatigue banner stays up before the turn banner it holds back.
    static let fatigueBannerSeconds = 1.8

    /// The Fatigue banner a turn start opens with, or nil. Marks it shown for this round.
    private func fatigueLead(_ snap: BattleSnapshot) -> String? {
        if snap.events.contains(where: { $0.type == "fatigue" }), fatigueShownRound != snap.round {
            fatigueShownRound = snap.round
            return Self.fatigueStartText
        }
        let warn = snap.events.first { $0.type == "fatigue_warn" }
        if (warn != nil || (snap.fatigueIn == 1 && !snap.fatigue)), fatigueWarnedRound != snap.round {
            fatigueWarnedRound = snap.round
            return Self.fatigueWarnText
        }
        return nil
    }

    /// Holds the camera on the player's own fort while the Fatigue collapse plays and settles.
    private func holdHome(_ snap: BattleSnapshot) {
        cameraHome = snap.isDuel ? snap.activeSide : 0
        frameVersion &+= 1
    }

    /// n1 (QA playtest 2): when the player's turn opens on a Hob who has no shot it may fire this
    /// turn, the first crewmate who has one is picked. If nobody can, Fire offers Pass as before.
    private func openOnAnActingHob(_ snap: BattleSnapshot) {
        guard snap.phase == .plan, snap.humanTurn, openCheckedTurn != snap.turnSeq, canAct else { return }
        openCheckedTurn = snap.turnSeq
        guard let id = Self.hobToOpen(snap), let hob = Int(id) else { return }
        // No tick here: the next frame shows the pick.
        game.send(.pickHob(hob: hob))
    }

    /// The Hob a turn should open on, or nil when the picked Hob can act (or nobody can).
    nonisolated static func hobToOpen(_ snap: BattleSnapshot) -> String? {
        guard snap.phase == .plan, snap.humanTurn, let fort = snap.fort(snap.activeSide) else { return nil }
        let canShove = snap.steam >= snap.shoveOffCost
        func ableToAct(_ h: HobView) -> Bool {
            !h.isOut && (h.canFire || (h.buried && canShove))
        }
        if let id = snap.selectedHob, let hob = fort.hobs.first(where: { $0.id == id }) {
            // Dug in counts as able to act only when Steam covers Shove Off (iOS-M3).
            let shotReady = snap.shots.isEmpty || snap.shots.contains { $0.ready }
            if !hob.isOut && ((hob.canFire && shotReady) || (hob.buried && canShove)) { return nil }
            return fort.hobs.first { $0.id != id && ableToAct($0) }?.id
        }
        return fort.hobs.first { ableToAct($0) }?.id
    }

    /// The line for a `shot_switch`: the unready chip's words when there are some.
    static func shotSwitchText(_ e: BattleEvent, snap: BattleSnapshot) -> String {
        let from = e.raw?.fromShot ?? ""
        let chip = snap.shots.first(where: { $0.id == from })
        if let text = chip?.text, !text.isEmpty {
            return text
        }
        let hob = snap.forts.flatMap(\.hobs).first { $0.id == String(e.amount) }
        if let hob, !e.text.isEmpty,
           let line = whyLine(e.text, hob: hob.shortName, shot: chip?.name) {
            return line
        }
        return GameText.shared.t("hud.switched_plain")
    }

    /// Shows a banner for 1.2 s (a Fatigue banner longer). A queued one waits for the banner on
    /// screen to finish.
    private func showBanner(_ text: String, queued: Bool = false, seconds: Double? = nil) {
        if queued, banner != nil {
            if banner != text && !bannerQueue.contains(text) { bannerQueue.append(text) }
            return
        }
        banner = text
        bannerTask?.cancel()
        let wait = seconds ?? (Self.isFatigueBanner(text) ? Self.fatigueBannerSeconds : 1.2)
        bannerTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            guard !Task.isCancelled, let self else { return }
            if self.bannerQueue.isEmpty {
                self.banner = nil
            } else {
                self.showBanner(self.bannerQueue.removeFirst())
            }
        }
    }

    /// A short line for a refused action, so a buzz is never the only answer (H2). The words
    /// come from text.json by the refusal id, with the Hob's short name and the shot's name.
    private func refused(_ reply: CoreReply) {
        // Recovery is handled by `game.recoveredNotice` in `tick()` with its own banner (iOS-M7).
        guard reply.reason != "recovered" else { return }
        onLocalHaptic?(.illegal)
        guard let reason = reply.reason, reason != "busy" else { return }
        let fort = snapshot.fort(snapshot.activeSide)
        let namedId: String? = reply.hob.map { String($0) }
        let named: HobView? = namedId == nil ? nil : fort?.hobs.first(where: { $0.id == namedId })
        let hob: HobView? = named ?? selectedHobView
        let shotId = reply.shot ?? snapshot.selectedShot
        let shot = snapshot.shots.first { $0.id == shotId }?.name
        let doodad = armedDoodad.map { game.catalog.doodadName($0) }
        showBanner(Self.refusalText(reason, hob: hob?.shortName, shot: shot, doodad: doodad, detail: reply.detail))
    }

    /// The text.json key for a refusal id the core sends (core/API.md, Refusal reasons).
    nonisolated static func refusalKey(_ reason: String) -> String {
        switch reason {
        case "resting_plain_only", "resting", "buried", "no_knack_uses", "not_in_hand", "no_heavy_first_turn",
             "no_actions_left", "already_acted", "not_planning", "hob_cannot_fire", "no_ghost":
            return "hud.why.\(reason)"
        case "no_shot": return "hud.why.not_in_hand"
        case "not_enough_steam": return "hud.why.no_steam"
        case "cannot_walk_now", "cannot_walk_there": return "hud.why.cannot_walk"
        case "bad_value": return "hud.why.out_of_range"
        case "bad_target": return "hud.why.own_block"
        case "battle_over": return "hud.why.over"
        case "pin_faded": return "hud.pin_faded"
        case "cannot_shove_now": return "hud.shove_off.not_now"
        case "not_buried": return "hud.shove_off.nothing"
        case "nothing_to_mend": return "hud.mend.none"
        case "no_one_to_puff_up", "puff_up_not_allowed": return "hud.dial.puff_up_none"
        case "no_doodad": return "hud.doodad.none_left"
        case "cannot_use_now": return "hud.doodad.not_now"
        case "recovered": return "errors.turn_reset"
        case "dead_handle", "panic", "null_handle": return "errors.core_stopped"
        default: return "hud.why.default"
        }
    }

    /// The text.json line for a refusal id, or nil when a name it needs is missing.
    nonisolated static func whyLine(_ reason: String, hob: String? = nil, shot: String? = nil,
                                    doodad: String? = nil) -> String? {
        var vars: [String: any CustomStringConvertible] = [:]
        if let hob, !hob.isEmpty { vars["hob"] = hob }
        if let shot, !shot.isEmpty { vars["shot"] = shot }
        if let doodad, !doodad.isEmpty { vars["doodad"] = doodad }
        return GameText.shared.complete(refusalKey(reason), vars)
    }

    /// Plain words for a refusal: the text.json line, else the core's own `detail`, else a
    /// plain "that did not go through" line.
    nonisolated static func refusalText(_ reason: String, hob: String? = nil, shot: String? = nil,
                                        doodad: String? = nil, detail: String? = nil) -> String {
        if let line = whyLine(reason, hob: hob, shot: shot, doodad: doodad) { return line }
        if let detail, !detail.isEmpty { return detail }
        return GameText.shared.t("errors.move_failed")
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
                                        hudSide: hudSide, leftHand: settings.leftHand,
                                        reduceMotion: settings.reduceMotion,
                                        largeText: settings.largeText)
        if next != layout { layout = next }
        refreshRivalMarker()
    }

    // MARK: Pause

    func pause() {
        guard !paused else { return }
        endDragKeepingAim(restore: true)
        paused = true
        showPauseCard = true
        refreshRivalMarker()
        onPausedChanged?(true)
    }

    func resume() {
        let was = paused
        paused = false
        showPauseCard = false
        refreshRivalMarker()
        if was { onPausedChanged?(false) }
    }

    // MARK: Aim Drag

    func touchBegan(at point: CGPoint) {
        guard canAct, gesture == nil, panStart == nil, layout.aimRegion.contains(point) else { return }
        guard aimMayStart(at: point) else {
            // A press away from your fort pans the camera instead (QA playtest 1), and once a
            // battle says where to press (QA playtest 2, owner rule).
            beginPan(at: point)
            if !skyNudged {
                skyNudged = true
                showNudge(near: point)
            }
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
        refreshRivalMarker()
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
        refreshRivalMarker()
        frameVersion &+= 1
    }

    // MARK: Teaching the owner rule

    /// Shows "Drag from your fort to aim" next to the player's fort for 2.5 s.
    private func showNudge(near point: CGPoint) {
        var at = point
        if let map = lensMap?(point), let fort = snapshot.fort(snapshot.activeSide) {
            let top = (fort.blocks.map { $0.y + $0.h }.max() ?? fort.baseY + fort.block) + 24
            at = map.view(CGPoint(x: fort.originX + Double(fort.cols) * fort.block / 2, y: top))
        }
        aimNudge = AimNudge(text: Self.skyNudgeText, point: at)
        nudgeCount += 1
        nudgeTask?.cancel()
        nudgeTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            self?.aimNudge = nil
        }
    }

    // MARK: Rival fort peek

    /// True while the plan camera may peek at the Rival fort.
    var canPeek: Bool {
        !stopped && !paused && (snapshot.phase == .plan || snapshot.phase == .handoff) && layout.mode == .wide
    }

    /// Recomputes whether the native SwiftUI Rival fort button should appear and on which edge.
    private func refreshRivalMarker() {
        guard canPeek, let lens = layout.lenses.first, lens.focus == .both else {
            if rivalMarkerEdge != nil { rivalMarkerEdge = nil }
            return
        }
        let rivalSide = 1 - snapshot.activeSide
        let edge: Int?
        if rivalPeek {
            edge = rivalSide == 1 ? 1 : -1
        } else {
            var target = Camera.worldRect(for: .both, snap: snapshot, fx: fx, frame: lens.frame.size,
                                          minBlock: lens.minBlock, home: cameraHome, peek: false)
            target = Camera.panned(target, by: cameraPan, worldW: snapshot.world.w)
            edge = Camera.rivalEdge(worldRect: target, snap: snapshot)
        }
        if rivalMarkerEdge != edge { rivalMarkerEdge = edge }
    }

    /// The Rival fort marker was tapped: both forts at any zoom, or back home on a second tap.
    func toggleRivalPeek() {
        guard canPeek || rivalPeek else { return }
        rivalPeek.toggle()
        if rivalPeek { cameraPan = 0; endPan() }
        onLocalHaptic?(.tick)
        refreshRivalMarker()
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
            if aimStarts < Self.ownerRingAims {
                aimStarts += 1
                frameVersion &+= 1
                onAimStarted?(aimStarts)
            }
        }
        guard g.isDragging else { return }
        // Throttled: the newest aim goes out at most every 66 ms, and always on release (H8).
        pendingAim = (g.angleTenths, g.power)
        onAimBand?(min(1, Float(g.power) / 100), Double(g.power) / 100 * 5)
        if g.power >= 100 && !hitFullPower {
            hitFullPower = true
            onLocalHaptic?(.tick)
            onAudioCue?("aim_limit")
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
        onAimBand?(0, 0)
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
        onAudioCue?("aim_set")
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

    // MARK: Action options (iOS-H4: dial, self-mend target, Pot Lid room, Mend Bucket targets)

    var selectedShotChip: ShotChip? {
        snapshot.shots.first { $0.id == snapshot.selectedShot }
    }

    var selectedShotDef: ContentCatalog.Shot? {
        selectedShotChip.flatMap { game.catalog.shots[$0.art] }
    }

    var selectedHobView: HobView? {
        snapshot.fort(snapshot.activeSide)?.hobs.first { $0.id == snapshot.selectedHob }
    }

    /// Dial choices for the current shot (`barn_raising` Rebuild/Puff Up, or Bobbin Plain 2/3 Hops).
    var availableDials: [(id: String?, label: String, enabled: Bool)] {
        guard armedDoodad == nil else { return [] }
        if let dials = selectedShotDef?.dials, !dials.isEmpty {
            return dials.map { id -> (id: String?, label: String, enabled: Bool) in
                switch id {
                case "rebuild": return (id, GameText.shared.t("hud.dial.rebuild"), true)
                case "puff_up": return (id, GameText.shared.t("hud.dial.puff_up"), hud.puffUp)
                default: return (id, id.replacingOccurrences(of: "_", with: " ").capitalized, true)
                }
            }
        }
        if snapshot.selectedShot == "plain", selectedHobView?.def == "bobbin" {
            let text = GameText.shared
            return [(nil, text.plural("hud.dial.hops", 2), true), ("hops3", text.plural("hud.dial.hops", 3), true)]
        }
        return []
    }

    /// True when the picked shot supports tapping an own-fort block to self-mend (`mendglob`).
    var canPickMendTarget: Bool {
        armedDoodad == nil && (selectedShotDef?.hasSelfTarget ?? false)
    }

    /// Rooms that Pot Lid may protect on the active side's fort (`kettle` or `nook:N`).
    var potLidRooms: [(id: String, label: String)] {
        let text = GameText.shared
        let kettle: (id: String, label: String) = ("kettle", text.t("hud.doodad.kettle_room"))
        guard let fort = snapshot.fort(snapshot.activeSide) else { return [kettle] }
        return [kettle] + fort.rooms.enumerated().map { idx, room -> (id: String, label: String) in
            (id: "nook:\(room.id)", label: text.t("hud.doodad.nook", ["n": idx + 1]))
        }
    }

    /// True while a field tap should select an own-fort block instead of starting an Aim Drag.
    var wantsBlockTap: Bool {
        canAct && (armedDoodad == "mend_bucket" || (armedDoodad == nil && canPickMendTarget && pickingMendTarget))
    }

    /// Highlighted own-fort blocks for the renderer (self-mend target or Mend Bucket targets).
    var highlightedBlocks: [[Int]] {
        if armedDoodad == "mend_bucket" { return armedDoodadTargets }
        if let target = selectedBlockTarget, canPickMendTarget { return [target] }
        return []
    }

    func selectDial(_ dial: String?) {
        guard canAct else { return }
        selectedDial = dial
        onLocalHaptic?(.tick)
    }

    func toggleMendTargetMode() {
        guard canAct, canPickMendTarget else { return }
        if selectedBlockTarget != nil && !pickingMendTarget {
            selectedBlockTarget = nil
            pickingMendTarget = false
        } else {
            pickingMendTarget.toggle()
        }
        onLocalHaptic?(.tick)
        frameVersion &+= 1
    }

    func selectDoodadRoom(_ room: String) {
        guard canAct, armedDoodad == "pot_lid" else { return }
        armedDoodadRoom = room
        onLocalHaptic?(.tick)
    }

    func clearDoodadTargets() {
        armedDoodadTargets = []
        frameVersion &+= 1
    }

    /// Handles a tap on the player's own fort while targeting `mendglob` or `mend_bucket`.
    /// Returns true if the tap picked/toggled a block (suppressing Aim Drag).
    func handleBlockTap(at point: CGPoint) -> Bool {
        guard wantsBlockTap, let map = lensMap?(point), let fort = snapshot.fort(snapshot.activeSide) else {
            return false
        }
        let w = map.world(point)
        guard let block = fort.blocks.first(where: {
            Double(w.x) >= $0.x && Double(w.x) <= $0.x + $0.w && Double(w.y) >= $0.y && Double(w.y) <= $0.y + $0.h
        }) else {
            return false
        }
        let c = Int(((block.x - fort.originX) / fort.block).rounded())
        let r = Int(((block.y - fort.baseY) / fort.block).rounded())
        let cell = [c, r]
        if armedDoodad == "mend_bucket" {
            if let idx = armedDoodadTargets.firstIndex(of: cell) {
                armedDoodadTargets.remove(at: idx)
            } else if armedDoodadTargets.count < 3 {
                armedDoodadTargets.append(cell)
            } else {
                onLocalHaptic?(.illegal)
                return true
            }
            onLocalHaptic?(.tick)
            frameVersion &+= 1
            return true
        }
        if pickingMendTarget {
            selectedBlockTarget = selectedBlockTarget == cell ? nil : cell
            pickingMendTarget = false
            onLocalHaptic?(.tick)
            frameVersion &+= 1
            return true
        }
        return false
    }

    private func resetActionOptions() {
        selectedDial = nil
        selectedBlockTarget = nil
        pickingMendTarget = false
        armedDoodadRoom = "kettle"
        armedDoodadTargets = []
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
        let dialToSend: String?
        if let d = selectedDial, availableDials.contains(where: { $0.id == d && $0.enabled }) {
            dialToSend = d
        } else {
            dialToSend = nil
        }
        let targetToSend = canPickMendTarget ? selectedBlockTarget : nil
        let reply = game.send(.fire(dial: dialToSend, target: targetToSend))
        if reply.ok {
            fineTuneOpen = false
            if rivalPeek { rivalPeek = false }
            resetActionOptions()
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
        let next = armedDoodad == id ? nil : id
        armedDoodad = next
        armedDoodadRoom = "kettle"
        armedDoodadTargets = []
        pickingMendTarget = false
        onLocalHaptic?(.tick)
        frameVersion &+= 1
    }

    /// Uses a Doodad as the Action, passing the chosen Pot Lid room or Mend Bucket block targets
    /// (nil falls back to the core's default: Kettle Room or most-hurt blocks).
    @discardableResult
    func useDoodad(_ id: String, room: String? = nil, targets: [[Int]]? = nil) -> Bool {
        guard canAct else { return false }
        let chosenRoom: String? = id == "pot_lid" ? (room ?? (armedDoodadRoom == "kettle" ? nil : armedDoodadRoom)) : nil
        let chosenTargets: [[Int]]? = id == "mend_bucket" ? (targets ?? (armedDoodadTargets.isEmpty ? nil : armedDoodadTargets)) : nil
        let reply = game.send(.doodad(doodad: id, targets: chosenTargets, room: chosenRoom))
        armedDoodad = nil
        armedDoodadRoom = "kettle"
        armedDoodadTargets = []
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
            onAudioCue?("aim_limit")
            return false
        }
        let reply = game.send(.aim(angle: angle, power: power))
        onLocalHaptic?(reply.ok ? .tick : .illegal)
        if reply.ok { onAudioCue?("aim_tick") }
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
        onAudioCue?("aim_recall")
        fineTuneOpen = true
        scheduleFold()
        tick()
    }

    func pickHob(_ id: String) {
        guard canAct else { return }
        let reply = game.send(.pickHob(hob: Int(id) ?? -1))
        if reply.ok {
            resetActionOptions()
            onLocalHaptic?(.tick)
            onAudioCue?("turn_hob_pick")
            if let def = snapshot.fort(snapshot.activeSide)?.hobs.first(where: { $0.id == id })?.def {
                onHobPicked?(def, snapshot.activeSide)
            }
        } else {
            refused(reply)
        }
        tick()
    }

    func pickShot(_ id: String) {
        guard canAct else { return }
        armedDoodad = nil
        resetActionOptions()
        let reply = game.send(.pickShot(shot: id))
        if reply.ok {
            onLocalHaptic?(.tick)
            // The pick stands even when it cannot fire now; say why (rules 3).
            if reply.ready == false {
                let chip = snapshot.shots.first { $0.id == id }
                let hob = selectedHobView?.shortName
                let text = reply.why.map { Self.refusalText($0, hob: hob, shot: chip?.name, detail: reply.text) }
                    ?? chip?.text ?? reply.text
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
        let reply = game.send(.walk(dx: dir * game.catalog.appConfig.walkCells))
        if !reply.ok { refused(reply) }
        return reply.ok
    }

    func speedUp() {
        guard !stopped else { return }
        game.speed = game.speed >= 2 ? 1 : 2
        fx.fast = game.speed >= 2
        if game.speed >= 2 {
            fx.cancelSlowMotion()
            onAudioCue?("fly_fast_zip")
        }
        game.markDirty()
        tick()
    }

    /// Give up: the other side wins (`how: "give_up"`); a campaign loss still pays its Buttons.
    /// Works in any phase but ended, even while the Rival thinks, without blocking the main thread (iOS-M8).
    @discardableResult
    func giveUp() -> Bool {
        guard !stopped, game.isRunning, snapshot.phase != .ended else { return false }
        let side: Int? = snapshot.isDuel ? snapshot.activeSide : nil
        let was = paused
        paused = false
        showPauseCard = false
        if was { onPausedChanged?(false) }
        if game.isBusy {
            Task { @MainActor [weak self] in
                guard let self, !self.stopped, self.game.isRunning else { return }
                _ = await self.game.host.run { _ in () }
                guard !self.stopped, self.game.isRunning, self.snapshot.phase != .ended else { return }
                let reply = self.game.giveUp(side: side)
                if !reply.ok { self.refused(reply) }
                self.game.markDirty()
                self.tick()
            }
            return true
        }
        let reply = game.giveUp(side: side)
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
        guard !layout.usePadScale else { return }
        foldTask?.cancel()
        foldTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled else { return }
            self?.fineTuneOpen = false
        }
    }
}

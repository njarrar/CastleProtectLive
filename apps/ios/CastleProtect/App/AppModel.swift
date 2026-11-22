import SwiftUI
import UIKit

/// What the Results screen shows, kept after the battle session ends.
struct ResultInfo: Equatable {
    var result: BattleResult
    var setup: BattleSetup
    var title: String
    var names: [String]
    var goals: [String]

    var isDuel: Bool { setup.mode == .duel }
    var won: Bool { result.winner == 0 }
    var headline: String {
        if isDuel {
            let name = result.winner >= 0 && result.winner < names.count ? names[result.winner] : "Nobody"
            return "\(name) wins!"
        }
        guard won else { return "Flattened" }
        switch result.reason {
        case "kettle_pop": return "Kettle Pop!"
        default: return "Clean Sweep!"
        }
    }
}

/// App state: which screen is up, the save, and the battle in play.
/// Layout is never stored here; it is worked out from the window each frame.
@MainActor
final class AppModel: ObservableObject {
    enum Screen: Equatable {
        case title, map, battle, results, skirmish, duelSetup
    }

    @Published var screen: Screen
    @Published private(set) var save: SaveData
    @Published private(set) var campaign: CampaignView
    @Published private(set) var session: BattleSession?
    /// The level whose pre-battle sheet is up (also used for Skirmish and Couch Duel drafts).
    @Published var preBattle: LevelInfo?
    @Published var showSettings = false
    @Published var showResume = false
    @Published var lastResult: ResultInfo?
    @Published var notice: String?
    /// Couch Duel running score since the players opened Couch Duel. Never saved.
    @Published private(set) var tonight = [0, 0]

    let bridge: any CoreBridge
    let store: SaveStore
    let haptics = Haptics()
    let sound = SoundEngine()
    let isUITesting: Bool

    init(arguments: [String] = ProcessInfo.processInfo.arguments) {
        isUITesting = arguments.contains("-uiTesting")
        let useStandIn = isUITesting || arguments.contains("-useStandIn")
        if isUITesting {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("CastleProtectUITest", isDirectory: true)
            store = SaveStore(directory: dir)
            store.eraseAll()
        } else {
            store = SaveStore()
        }
        bridge = CoreFactory.make(preferStandIn: useStandIn)
        let loaded = store.load()
        save = loaded
        campaign = bridge.campaign(pennants: loaded.progress.pennants)
        screen = loaded.firstRunDone ? .map : .title
        showResume = loaded.firstRunDone && loaded.battle != nil
        applySettings()
    }

    // MARK: Save

    private func persist() {
        save.counter += 1
        store.write(save)
    }

    func updateSettings(_ change: (inout GameSettings) -> Void) {
        var s = save.settings
        change(&s)
        guard s != save.settings else { return }
        save.settings = s
        applySettings()
        persist()
    }

    private func applySettings() {
        let s = save.settings
        sound.volume = s.sound
        sound.muted = s.muteAll
        haptics.level = s.haptics
        session?.settings = s
        OrientationLock.apply(s.rotation)
    }

    /// Battle save at every turn start (UX 8.1): the core's own bytes plus a line for the resume card.
    func autosave() {
        guard let s = session, s.snapshot.result == nil, s.snapshot.phase != .draft else { return }
        let core = bridge.save()
        guard !core.isEmpty else { return }
        let snap = s.snapshot
        save.battle = BattleSave(core: core, setup: s.setup, title: s.title, round: snap.round,
                                 turnName: snap.name(snap.activeSide))
        persist()
    }

    func resetProgress() {
        endSession(abandon: true)
        let settings = save.settings
        save = SaveData()
        save.settings = settings
        save.firstRunDone = true
        persist()
        refreshCampaign()
        screen = .map
    }

    private func refreshCampaign() {
        campaign = bridge.campaign(pennants: save.progress.pennants)
    }

    // MARK: App life

    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background, .inactive:
            if let s = session, screen == .battle {
                s.pause()
                autosave()
            }
            sound.pause()
            store.flush()
        case .active:
            sound.resume()
        @unknown default:
            break
        }
    }

    // MARK: Title and map

    func play() {
        sound.play("ui_tap")
        save.firstRunDone = true
        persist()
        if save.progress.pennants.isEmpty, let first = campaign.levels.first {
            // First launch: straight into the first fight, no pre-battle sheet.
            startCampaign(first, skipSheet: true)
        } else {
            screen = .map
        }
    }

    func openLevel(_ level: LevelInfo) {
        guard !level.isLocked else {
            haptics.play(.illegal)
            return
        }
        sound.play("ui_sheet_open")
        startCampaign(level, skipSheet: false)
    }

    private func startCampaign(_ level: LevelInfo, skipSheet: Bool) {
        let setup = BattleSetup.campaign(level.id, preset: save.settings.preset, seed: Self.newSeed())
        save.lastLevel = level.id
        begin(setup, title: "\(level.id)  \(level.name)", sheet: skipSheet ? nil : level)
    }

    func startSkirmish(_ options: SkirmishOptions) {
        save.skirmish = options
        persist()
        var setup = BattleSetup(mode: .skirmish, map: options.map, preset: options.preset, seed: Self.newSeed())
        setup.rounds = options.rounds
        setup.wind = options.wind
        setup.winBy = options.winBy
        setup.shells = options.shells
        let mapName = bridge.maps().first { $0.id == options.map }?.name ?? "Skirmish"
        let sheet = LevelInfo(id: "skirmish", name: mapName, state: "open", rival: "Rival (AI)",
                              habit: "Plays \(options.preset.label).", goals: ["Win"],
                              hasDraft: options.shells == .draft, roundCap: options.rounds)
        begin(setup, title: "Skirmish  \(mapName)", sheet: options.shells == .draft ? sheet : nil)
    }

    func startDuel(_ options: DuelOptions) {
        save.duel = options
        persist()
        var setup = BattleSetup(mode: .duel, map: options.map, preset: .fair, seed: Self.newSeed())
        setup.rounds = options.rounds
        setup.wind = options.wind
        setup.winBy = options.winBy
        setup.shells = options.shells
        setup.seats = options.seats
        setup.names = options.names
        setup.help = options.help
        setup.forts = options.forts
        let sheet = LevelInfo(id: "duel", name: "Couch Duel", state: "open",
                              rival: "\(options.names[0]) and \(options.names[1])",
                              goals: [], hasDraft: options.shells == .draft, roundCap: options.rounds)
        begin(setup, title: "Couch Duel", sheet: options.shells == .draft ? sheet : nil)
    }

    private func begin(_ setup: BattleSetup, title: String, sheet: LevelInfo?) {
        endSession(abandon: true)
        let reply = bridge.send(.newBattle(setup))
        guard reply.ok else {
            notice = "This fight could not start (\(reply.reason ?? "unknown"))."
            return
        }
        let s = makeSession(setup: setup, title: title)
        session = s
        s.start()
        if let sheet {
            preBattle = sheet
        } else {
            s.quickPick()
            s.endDraft()
            screen = .battle
        }
    }

    private func makeSession(setup: BattleSetup, title: String) -> BattleSession {
        let s = BattleSession(bridge: bridge, setup: setup, title: title)
        s.settings = save.settings
        s.isPad = UIDevice.current.userInterfaceIdiom == .pad
        s.onTurnStarted = { [weak self] _ in self?.autosave() }
        s.onEvents = { [weak self] events, snap in self?.handle(events, snap) }
        s.onLocalHaptic = { [weak self] kind in self?.haptics.play(kind) }
        s.onEnded = { [weak self] session, result in self?.battleEnded(session, result) }
        return s
    }

    /// Fight on the pre-battle sheet: picks left are filled by Quick Pick in the core.
    func fight() {
        guard let s = session else { return }
        sound.play("ui_tap")
        s.endDraft()
        preBattle = nil
        screen = .battle
    }

    func closePreBattle() {
        preBattle = nil
        endSession(abandon: true)
    }

    private func endSession(abandon: Bool) {
        guard let s = session else { return }
        s.stop()
        if abandon && s.snapshot.result == nil { bridge.send(.abandon) }
        session = nil
    }

    // MARK: Battle

    func leaveToMap() {
        // The battle save stays, so Carry on? greets the player next time.
        autosave()
        endSession(abandon: false)
        screen = .map
        showResume = save.battle != nil
        refreshCampaign()
    }

    func retry() {
        guard let setup = session?.setup ?? lastResult?.setup else { return }
        var again = setup
        again.seed = Self.newSeed()
        let title = session?.title ?? lastResult?.title ?? ""
        save.battle = nil
        persist()
        begin(again, title: title, sheet: nil)
    }

    private func battleEnded(_ s: BattleSession, _ result: BattleResult) {
        guard session === s else { return }
        let names = [s.snapshot.name(0), s.snapshot.name(1)]
        let goals = campaign.levels.first { $0.id == s.setup.level }?.goals ?? []
        lastResult = ResultInfo(result: result, setup: s.setup, title: s.title, names: names, goals: goals)
        if s.setup.mode == .campaign, let level = s.setup.level {
            save.progress.record(level: level, pennants: result.winner == 0 ? result.pennants : 0, buttons: result.buttons)
        } else if s.setup.mode == .duel, result.winner == 0 || result.winner == 1 {
            tonight[result.winner] += 1
        }
        save.battle = nil
        persist()
        refreshCampaign()
        endSession(abandon: false)
        if result.pennants > 0 { haptics.play(.pennant) }
        screen = .results
    }

    func nextLevel() {
        guard let current = lastResult?.setup.level,
              let i = campaign.levels.firstIndex(where: { $0.id == current }),
              i + 1 < campaign.levels.count else {
            screen = .map
            return
        }
        let next = campaign.levels[i + 1]
        if next.isLocked {
            screen = .map
        } else {
            screen = .map
            openLevel(next)
        }
    }

    func rematch(swapSides: Bool) {
        guard let info = lastResult, info.isDuel else { retry(); return }
        var options = save.duel
        if swapSides {
            options.names.reverse()
            options.help.reverse()
            options.forts.reverse()
            tonight.reverse()
        }
        startDuel(options)
    }

    func openDuelSetup() {
        sound.play("ui_sheet_open")
        screen = .duelSetup
    }

    func leaveDuel() {
        tonight = [0, 0]
        screen = .map
    }

    // MARK: Resume (S18)

    func carryOn() {
        showResume = false
        guard let saved = save.battle else { return }
        endSession(abandon: false)
        guard bridge.load(saved.core) else {
            notice = "This fight could not be saved."
            save.battle = nil
            persist()
            return
        }
        let s = makeSession(setup: saved.setup, title: saved.title)
        session = s
        s.start()
        screen = .battle
    }

    func leaveIt() {
        showResume = false
        save.battle = nil
        persist()
    }

    // MARK: Events from the core

    private func handle(_ events: [CoreEvent], _ snap: BattleSnapshot) {
        let coreSendsCues = events.contains { $0.type == "audio" }
        let coreSendsHaptics = events.contains { $0.type == "haptic" }
        for e in events {
            switch e.type {
            case "audio":
                sound.play(e.cue)
            case "haptic":
                haptics.play(e.cue)
            case "announce":
                announce(e.text)
            case "turn":
                let side = e.side >= 0 ? e.side : snap.activeSide
                let who = snap.isDuel ? "\(snap.name(side))'s turn" : (snap.isHuman(side) ? "Your turn" : "\(snap.name(side)) aims")
                announce("\(who). Wind \(abs(snap.wind)) \(snap.wind >= 0 ? "right" : "left").")
                if !coreSendsCues { sound.play(snap.isHuman(side) ? "turn_yours" : "turn_theirs") }
            default:
                if !coreSendsCues, let cue = Self.fallbackCue(e) { sound.play(cue) }
                if !coreSendsHaptics, let kind = Self.fallbackHaptic(e, snap: snap) { haptics.play(kind) }
            }
        }
    }

    /// Used only when a core build sends raw events without audio cues.
    static func fallbackCue(_ e: CoreEvent) -> String? {
        switch e.type {
        case "fire": return "fire_launch"
        case "hit": return e.amount > 40 ? "blast_large" : "blast_small"
        case "break", "fall": return "block_break"
        case "bonk": return "hob_bonk"
        case "kettle_pop": return "kettle_pop"
        case "squall_warn": return "squall_warn"
        default: return nil
        }
    }

    static func fallbackHaptic(_ e: CoreEvent, snap: BattleSnapshot) -> Haptics.Kind? {
        switch e.type {
        case "hit": return e.amount > 40 ? .blastLarge : .blastSmall
        case "fall": return .chunk
        case "bonk": return e.side == 0 && !snap.isDuel ? .bonkYours : .bonkTheirs
        case "kettle_pop": return .kettlePop
        default: return nil
        }
    }

    private func announce(_ text: String) {
        guard !text.isEmpty, UIAccessibility.isVoiceOverRunning else { return }
        UIAccessibility.post(notification: .announcement, argument: text)
    }

    private static func newSeed() -> UInt64 {
        UInt64.random(in: 1...0x1F_FFFF_FFFF_FFFF)
    }
}

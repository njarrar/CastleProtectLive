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
        return Self.headline(how: result.reason, won: won)
    }

    /// One headline per `how` (L9).
    static func headline(how: String, won: Bool) -> String {
        switch (how, won) {
        case ("kettle_pop", true): return "Kettle Pop!"
        case ("kettle_pop", false): return "Your kettle popped"
        case ("clean_sweep", true): return "Clean Sweep!"
        case ("clean_sweep", false): return "Swept clean"
        case ("squall", true): return "The Squall did it!"
        case ("squall", false): return "Blown over"
        case ("double_pop", _): return "Double Pop!"
        case ("rescue", true): return "Rescued!"
        case ("rescue", false): return "The captive is lost"
        case ("round_cap", true): return "He dozed off!"
        case ("round_cap", false): return "Out of rounds"
        case ("total_hp", true): return "Won on points!"
        case ("total_hp", false): return "Lost on points"
        case ("gave_up", false), ("give_up", false): return "You gave up"
        case ("gave_up", true), ("give_up", true): return "They gave up"
        case (_, true): return "Victory!"
        default: return "Flattened"
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
    let catalog: ContentCatalog
    let game: CoreGame
    let store: SaveStore
    let haptics = Haptics()
    let sound = SoundEngine()
    let isUITesting: Bool

    init(arguments: [String] = ProcessInfo.processInfo.arguments) {
        isUITesting = arguments.contains("-uiTesting")
        // Only Debug builds may use the stand-in core (CoreFactory ignores this in Release).
        let useStandIn = isUITesting || arguments.contains("-useStandIn")
        if isUITesting {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("CastleProtectUITest", isDirectory: true)
            let testStore = SaveStore(directory: dir)
            testStore.eraseAll()
            store = testStore
        } else {
            store = SaveStore()
        }
        let bridge = CoreFactory.make(preferStandIn: useStandIn)
        let catalog = ContentCatalog.load()
        self.bridge = bridge
        self.catalog = catalog
        game = CoreGame(bridge: bridge, catalog: catalog)
        var loaded = store.load()
        var launchNotice: String?
        if loaded.resumeInProgress {
            // The last resume never finished (the app was killed or crashed in the replay): drop that fight (H4).
            loaded.resumeInProgress = false
            loaded.battle = nil
            launchNotice = "Your saved fight could not be resumed last time, so it was cleared. Your progress is safe."
            try? store.writeNow(loaded)
        }
        if !loaded.firstRunDone {
            // First run: start from the system's Reduce Motion (UX 7.3, L6).
            loaded.settings.reduceMotion = UIAccessibility.isReduceMotionEnabled
        }
        save = loaded
        campaign = catalog.campaign(pennants: loaded.progress.pennants)
        screen = loaded.firstRunDone ? .map : .title
        showResume = loaded.firstRunDone && loaded.battle != nil
        applySettings()
        notice = launchNotice
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
        Theme.largeText = s.largeText
        sound.volume = s.sound
        sound.muted = s.muteAll
        haptics.level = s.haptics
        session?.settings = s
        OrientationLock.apply(s.rotation)
    }

    /// Battle save at every turn start (UX 8.1): the core's own bytes plus a line for the resume card.
    func autosave() {
        guard let s = session, s.snapshot.result == nil, s.snapshot.phase != .draft else { return }
        let core = game.save()
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
        campaign = catalog.campaign(pennants: save.progress.pennants)
    }

    // MARK: App life

    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background, .inactive:
            if let s = session, screen == .battle, !s.paused {
                // Once per app switch: inactive then background saves only the first time (L10).
                s.pause()
                autosave()
            }
            if phase == .background { sound.release() } else { sound.pause() }
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
        let mapName = catalog.maps.first { $0.id == options.map }?.name ?? "Skirmish"
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
        if let error = game.start(setup) {
            notice = "This fight could not start (\(error))."
            return
        }
        let s = makeSession(setup: setup, title: title)
        session = s
        s.start()
        if let sheet {
            game.holdTurns = true
            preBattle = sheet
        } else {
            s.endDraft()
            screen = .battle
        }
    }

    private func makeSession(setup: BattleSetup, title: String) -> BattleSession {
        let s = BattleSession(game: game, setup: setup, title: title)
        s.settings = save.settings
        haptics.warmUp()
        s.isPad = UIDevice.current.userInterfaceIdiom == .pad
        s.onTurnStarted = { [weak self] _ in self?.autosave() }
        s.onEvents = { [weak self] events, snap in self?.handle(events, snap) }
        s.onLocalHaptic = { [weak self] kind in self?.haptics.play(kind) }
        s.onResult = { [weak self] session, result in self?.recordResult(session, result) }
        s.onEnded = { [weak self] session, result in self?.battleEnded(session, result) }
        s.onFault = { [weak self] session, why in self?.battleFault(session, why) }
        return s
    }

    /// Fight on the pre-battle sheet: picks left are filled by Quick Pick in the core.
    func fight() {
        guard let s = session else { return }
        sound.play("ui_tap")
        s.endDraft()
        game.holdTurns = false
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
        // The core keeps nothing between battles; the battle save (if any) stays in SaveData.
        _ = abandon
        game.end()
        session = nil
    }

    // MARK: Battle

    func leaveToMap() {
        // The battle save stays, so Carry on? greets the player next time
        // (autosave skips a fight that already has a result: it is recorded).
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

    /// The result, in the frame it arrives: Pennants, the duel score and the
    /// cleared battle save are stored at once, so leaving or a kill in the next
    /// moment loses nothing (H5).
    func recordResult(_ s: BattleSession, _ result: BattleResult) {
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
        store.flush()
        refreshCampaign()
    }

    /// 1.2 s after the result: only the screen changes.
    private func battleEnded(_ s: BattleSession, _ result: BattleResult) {
        guard session === s else { return }
        endSession(abandon: false)
        if result.pennants > 0 { haptics.play(.pennant) }
        screen = .results
    }

    /// The core stopped answering (M13): leave the fight, keep the last autosave.
    private func battleFault(_ s: BattleSession, _ why: String) {
        guard session === s else { return }
        endSession(abandon: false)
        screen = .map
        showResume = save.battle != nil
        refreshCampaign()
        notice = save.battle != nil
            ? "This fight hit a snag. Your last autosave is kept: tap Carry on to try again from there."
            : "This fight hit a snag and had to stop."
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

    /// True while a saved fight is being replayed off the main thread.
    @Published private(set) var resuming = false

    func carryOn() {
        showResume = false
        guard let saved = save.battle, !resuming else { return }
        endSession(abandon: false)
        resuming = true
        // Mark the replay as under way first: if it kills the app, the next launch drops this save (H4).
        save.resumeInProgress = true
        save.counter += 1
        try? store.writeNow(save)
        Task { @MainActor [weak self] in
            guard let self else { return }
            let result = await self.game.load(saved.core)
            self.resuming = false
            self.save.resumeInProgress = false
            switch result {
            case .ok:
                self.persist()
                let s = self.makeSession(setup: saved.setup, title: saved.title)
                self.session = s
                s.start()
                self.screen = .battle
            case .rulesChanged:
                self.dropSavedBattle("This saved fight was made by an older version of the game rules, so it cannot be carried on.")
            case .damaged, .replayFailed:
                self.dropSavedBattle("This saved fight could not be loaded, so it was cleared. Your progress is safe.")
            }
        }
    }

    private func dropSavedBattle(_ text: String) {
        notice = text
        save.battle = nil
        persist()
    }

    func leaveIt() {
        showResume = false
        save.battle = nil
        persist()
    }

    // MARK: Events from the core

    /// Sounds, haptics and screen reader lines for what the core says happened.
    private func handle(_ events: [BattleEvent], _ snap: BattleSnapshot) {
        for e in events {
            switch e.type {
            case "fire":
                shotDamage = 0
                shotBonks = 0
                shotLive = true
                sound.play("fire_launch")
            case "damage":
                shotDamage += max(0, e.amount)
                if e.text == "hob", e.side == 0, !snap.isDuel { haptics.play(.hobHit) }
            case "bonk":
                shotBonks += 1
                sound.play("hob_bonk")
                haptics.play(e.side == 0 && !snap.isDuel ? .bonkYours : .bonkTheirs)
            case "turn":
                var shot = ""
                if shotLive {
                    // One short line per shot for VoiceOver (M5), spoken with the turn line.
                    shotLive = false
                    shot = shotDamage > 0 ? "Hit for \(shotDamage) damage" : "Missed"
                    if shotBonks > 0 { shot += ", \(shotBonks) Bonked" }
                    shot += ". "
                }
                let side = e.side >= 0 ? e.side : snap.activeSide
                let who = snap.isDuel ? "\(snap.name(side))'s turn" : (snap.isHuman(side) ? "Your turn" : "\(snap.name(side)) aims")
                announce("\(shot)\(who). Wind \(abs(snap.wind)) \(snap.wind >= 0 ? "right" : "left").")
                sound.play(snap.isHuman(side) && !snap.isDuel ? "turn_yours" : (side == 0 ? "turn_yours" : "turn_theirs"))
            case "kettle_pop":
                sound.play("kettle_pop")
                haptics.play(.kettlePop)
                announce(e.side == 0 && !snap.isDuel ? "Your kettle popped!" : "\(snap.name(e.side)) kettle popped!")
            case "end":
                let headline = ResultInfo.headline(how: e.text, won: e.side == 0)
                announce(snap.isDuel ? "\(snap.name(e.side)) wins!" : headline)
                let win = snap.isDuel || e.side == 0
                sound.play(win ? "win_fanfare" : "loss_sting")
            case "squall_warn":
                if !e.text.isEmpty { announce(e.text) }
                sound.play("squall_warn")
            default:
                if let cue = Self.cue(for: e) { sound.play(cue) }
                if let kind = Self.haptic(for: e, snap: snap) { haptics.play(kind) }
            }
        }
    }

    static func cue(for e: BattleEvent) -> String? {
        switch e.type {
        case "fire": return "fire_launch"
        case "hit": return e.amount > 40 ? "blast_large" : "blast_small"
        case "break", "fall": return "block_break"
        case "bonk": return "hob_bonk"
        case "kettle_pop": return "kettle_pop"
        default: return nil
        }
    }

    static func haptic(for e: BattleEvent, snap: BattleSnapshot) -> Haptics.Kind? {
        switch e.type {
        case "hit": return e.amount > 40 ? .blastLarge : .blastSmall
        case "fall": return .chunk
        case "thump": return .thump
        case "threaded": return .threaded
        case "bonk": return e.side == 0 && !snap.isDuel ? .bonkYours : .bonkTheirs
        case "kettle_pop": return .kettlePop
        default: return nil
        }
    }

    private var shotDamage = 0
    private var shotBonks = 0
    private var shotLive = false

    private func announce(_ text: String) {
        guard !text.isEmpty, UIAccessibility.isVoiceOverRunning else { return }
        UIAccessibility.post(notification: .announcement, argument: text)
    }

    private static func newSeed() -> UInt64 {
        UInt64.random(in: 1...0x1F_FFFF_FFFF_FFFF)
    }
}

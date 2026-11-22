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
        case ("volley_points", true): return "Won on Volley Points!"
        case ("volley_points", false): return "Lost on Volley Points"
        case ("captive_bonked", _): return "The captive was Bonked"
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
        // No sound before the Play tap on first launch (audio README, mixing rules).
        sound.unlocked = loaded.firstRunDone && !isUITesting
        applySettings()
        notice = launchNotice
        sound.onOutputLost = { [weak self] in self?.outputLost() }
        if screen == .map { sound.playMusic("mus_map") }
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
        sound.musicVolume = s.music
        sound.voiceVolume = s.voices
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
            // Held while the Pause card is up: the sound comes back on Resume, not here (UX 8.3 rule 4).
            sound.resume()
        @unknown default:
            break
        }
    }

    /// Headphones pulled out (or another output went away): pause and mute the battle (UX 8.3).
    private func outputLost() {
        guard let s = session, screen == .battle, !s.paused else { return }
        s.pause()
        autosave()
    }

    // MARK: Title and map

    func play() {
        if !isUITesting { sound.unlocked = true }
        sound.play("mus_title_jingle")
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
        var setup = BattleSetup.campaign(level.id, preset: save.settings.preset, seed: Self.newSeed())
        setup.progress = save.progress.coreProgress(level: level.id)
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
        setup.help = [options.help, .none]
        if options.winBy == .volley { setup.rounds = BattleSetup.volleyChoices.contains(options.rounds) ? options.rounds : 10 }
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
        if options.winBy == .volley { setup.rounds = BattleSetup.volleyChoices.contains(options.rounds) ? options.rounds : 10 }
        let sheet = LevelInfo(id: "duel", name: "Couch Duel", state: "open",
                              rival: "\(options.names[0]) and \(options.names[1])",
                              goals: [], hasDraft: options.shells == .draft, roundCap: options.rounds)
        begin(setup, title: "Couch Duel", sheet: options.shells == .draft ? sheet : nil)
    }

    private func begin(_ setup: BattleSetup, title: String, sheet: LevelInfo?) {
        // A saved fight is replaying: nothing else may start until it is ready (review 2, M1).
        guard !resuming else { return }
        endSession(abandon: true)
        if let error = game.start(setup) {
            notice = "This fight could not start (\(error))."
            return
        }
        let s = makeSession(setup: setup, title: title)
        session = s
        s.start()
        sound.startBattleMusic()
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
        s.onLocalHaptic = { [weak self] kind in
            guard let self else { return }
            self.haptics.play(kind)
            // The UI sounds that go with the player's own touches (audio 9.3).
            switch kind {
            case .fire: self.sound.play("ui_fire_press")
            case .dragStart: self.sound.play("aim_drag_start")
            case .illegal: self.sound.play("ui_denied")
            default: break
            }
        }
        s.onResult = { [weak self] session, result in self?.recordResult(session, result) }
        s.onEnded = { [weak self] session, result in self?.battleEnded(session, result) }
        s.onFault = { [weak self] session, why in self?.battleFault(session, why) }
        s.onFrame = { [weak self] snap in self?.updateAudio(snap) }
        s.onPausedChanged = { [weak self] paused in self?.sound.setHeld(paused) }
        let sound = self.sound
        s.fx.onSound = { id, pitch, gain in sound.play(id, pitch: pitch, gain: gain) }
        s.fx.onBark = { def, event, side in sound.bark(hob: def, event: event, side: side) }
        pendingSting = nil
        s.fx.onPopFrame = { [weak self] in
            guard let self, let sting = self.pendingSting else { return }
            self.pendingSting = nil
            self.sound.playSting(sting)
        }
        sound.onSubtitle = { [weak s] text, side in s?.showSubtitle(text, side: side) }
        return s
    }

    /// Loops and music layers from the frame (audio README: music layers; 9.3 loops).
    private func updateAudio(_ snap: BattleSnapshot) {
        guard screen == .battle || preBattle != nil else { return }
        let kettles = snap.forts.map { $0.kettlePercent }
        let standing = snap.forts.map { f in f.hobs.filter { !$0.bonked && $0.hp > 0 }.count }
        let ended = snap.phase == .ended
        let peril = !ended && (standing.contains(1) || kettles.contains { $0 <= 25 } || snap.squallRound > 0)
        let stir = !ended && (kettles.contains { $0 <= 50 } || standing.contains { $0 <= 2 }
            || (snap.squallIn > 0 && snap.squallIn <= 3))
        sound.setLayers(stir: stir, peril: peril)
        sound.setLoop("wx_wind_loop", gain: ended ? 0 : Float(abs(snap.wind)) / 10)
        sound.setLoop("wx_squall_loop", gain: snap.squallRound > 0 && !ended ? min(1, 0.5 + 0.25 * Float(snap.squallRound)) : 0)
        // The kettle whistle: your kettle at 50% or less, pitch up as HP falls.
        let mine = snap.isDuel ? snap.activeSide : 0
        let k = mine < kettles.count ? kettles[mine] : 100
        sound.setLoop("ket_whistle_loop", gain: k <= 50 && k > 0 && !ended ? 1 : 0, pitch: Double(50 - min(50, k)) / 50 * 3)
        // A shell's whistle while it flies, pitched by height.
        if let sh = snap.shells.first, snap.world.h > 0 {
            sound.setLoop("fly_whistle_loop", gain: 1, pitch: min(7, max(-7, (sh.y / snap.world.h) * 14 - 7)))
        } else {
            sound.setLoop("fly_whistle_loop", gain: 0)
        }
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
        sound.stopLoops()
        sound.setHeld(false)
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
        sound.playMusic("mus_map")
        showResume = save.battle != nil
        refreshCampaign()
    }

    /// Give up from the Pause card: the other side wins; the result screen follows as usual.
    func giveUp() {
        guard let s = session else { return }
        sound.play("ui_back")
        s.giveUp()
    }

    func retry() {
        guard let setup = session?.setup ?? lastResult?.setup else { return }
        // Same seed, the next try (QA playtest 1, M6): the core mixes `attempt` into the seed,
        // so the Retry is a new fight under the same rules. The Daily sends no attempt.
        let again = setup.retried()
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
            // The core worked out the Buttons from `setup.progress` (design 5.2).
            save.progress.record(level: level, flags: result.winner == 0 ? result.pennantFlags : [],
                                 won: result.winner == 0, buttons: result.buttons)
        } else if s.setup.mode == .duel, result.winner == 0 || result.winner == 1 {
            tonight[result.winner] += 1
        } else {
            save.progress.buttons += max(0, result.buttons)
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
        if let sting = pendingSting {
            pendingSting = nil
            sound.playSting(sting)
        }
        if result.pennants > 0 { haptics.play(.pennant) }
        screen = .results
    }

    /// The map theme after the results sting (quietly after a loss).
    func resultsShown() {
        sound.playMusic("mus_map")
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
            guard self.session == nil else {
                // Something else started meanwhile: leave it alone, keep the save for next time.
                self.persist()
                return
            }
            switch result {
            case .ok:
                self.persist()
                let s = self.makeSession(setup: saved.setup, title: saved.title)
                self.session = s
                s.start()
                self.sound.startBattleMusic()
                self.screen = .battle
            case .rulesChanged:
                self.dropSavedBattle(Self.rulesChangedNotice)
            case .damaged, .replayFailed:
                self.dropSavedBattle("This saved fight could not be loaded, so it was cleared. Your progress is safe.")
            case .superseded:
                self.persist()
            }
        }
    }

    /// The plain words for a save made under older game rules (rules 2 before QA playtest 1).
    nonisolated static let rulesChangedNotice =
        "The game rules changed since this fight was saved, so it cannot be carried on. Your progress and Pennants are safe."

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

    /// Haptics, the turn chime, stings and screen reader lines for what the core
    /// says happened. Field sounds that follow an animation come from FieldFX.
    private func handle(_ events: [BattleEvent], _ snap: BattleSnapshot) {
        for e in events {
            switch e.type {
            case "fire":
                shotDamage = 0
                shotBonks = 0
                shotLive = true
            case "damage":
                shotDamage += max(0, e.amount)
                if e.text == "hob", e.side == 0, !snap.isDuel { haptics.play(.hobHit) }
            case "bonk":
                shotBonks += 1
                haptics.play(e.side == 0 && !snap.isDuel ? .bonkYours : .bonkTheirs)
            case "turn":
                sound.newTurnStep()
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
                // Pitch 0 for side 0 or Player 1, 2 semitones down for the Rival or Player 2.
                sound.play("turn_yours", pitch: side == 0 ? 0 : -2)
            case "kettle_pop":
                haptics.play(.kettlePop)
                announce(e.side == 0 && !snap.isDuel ? "Your kettle popped!" : "\(snap.name(e.side)) kettle popped!")
            case "end":
                let headline = ResultInfo.headline(how: e.text, won: e.side == 0)
                announce(snap.isDuel ? "\(snap.name(e.side)) wins!" : headline)
                let win = snap.isDuel || e.side == 0
                sound.stopLoops()
                let sting = win ? "sting_win" : "sting_lose"
                if let fx = session?.fx, fx.popFramePending {
                    // The sting starts on the kettle's pop frame, not before it has cracked (review 2, M8).
                    pendingSting = sting
                } else {
                    sound.playSting(sting)
                }
            case "squall_warn":
                if !e.text.isEmpty { announce(e.text) }
            case "draft_start":
                sound.play("ui_card_flip")
            case "draft_pick":
                sound.play("ui_card_take", pitch: snap.isHuman(e.side) ? 0 : -3)
            case "boss_phase":
                announce("The Grand Fort changes: phase \(e.raw?.phase ?? 2)")
            default:
                if let kind = Self.haptic(for: e, snap: snap) { haptics.play(kind) }
            }
        }
    }

    static func haptic(for e: BattleEvent, snap: BattleSnapshot) -> Haptics.Kind? {
        switch e.type {
        case "hit":
            let r = e.raw?.r ?? 16
            return r > 30 ? .blastLarge : .blastSmall
        case "fall": return .chunk
        case "thump": return .thump
        case "threaded": return .threaded
        case "bonk": return e.side == 0 && !snap.isDuel ? .bonkYours : .bonkTheirs
        case "kettle_pop": return .kettlePop
        default: return nil
        }
    }

    /// A result sting waiting for the kettle's pop frame.
    private var pendingSting: String?
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

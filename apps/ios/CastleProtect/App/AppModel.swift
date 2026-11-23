import SwiftUI
import UIKit

/// What the Results screen shows, kept after the battle session ends. Every line follows
/// content/text.md, Results.
struct ResultInfo: Equatable {
    var result: BattleResult
    var setup: BattleSetup
    var title: String
    var names: [String]
    var goals: [String]
    /// Campaign win: one line from the Rival's `sign_off` pool. Picked once, when the fight ends.
    var signOff: String?
    /// Loss: one line from `results.loss.verdict`. Picked once, when the fight ends.
    var verdict: String?
    /// Hetty is named on the verdict only once 1-7 is cleared (text.json, verdict note).
    var verdictNamed = false

    var isDuel: Bool { setup.mode == .duel }
    var won: Bool { result.winner == 0 }
    var isCampaign: Bool { setup.mode == .campaign }
    var rivalName: String { names.count > 1 ? names[1] : "" }
    var captive: String { GameText.shared.complete("levels.\(setup.level ?? "").captive") ?? "" }

    var headline: String {
        let text = GameText.shared
        if isDuel {
            guard result.winner >= 0, result.winner < names.count else { return text.t("results.duel.draw") }
            return text.t("results.duel.title", ["name": names[result.winner]])
        }
        if won, isCampaign, let level = setup.level, let title = text.complete("levels.\(level).win_title") {
            return title
        }
        return Self.headline(how: result.reason, won: won, rival: rivalName, captive: captive)
    }

    /// The line under the headline: on a campaign win `results.win.how`, on a loss the cause
    /// (never one that says the same as the title), and the Double Pop rule.
    var explainer: String? {
        let text = GameText.shared
        if result.reason == "double_pop" { return text.t("results.double_pop_rule") }
        let how = Self.howId(result.reason)
        if isDuel { return nil }
        if won {
            guard isCampaign, text.has("levels.\(setup.level ?? "").win_title") else { return nil }
            let line = text.byId("results.win.how", how, ["captive": captive])
            return line.isEmpty || line == headline ? nil : line
        }
        let line = cause(how)
        return line.isEmpty || line == headline ? nil : line
    }

    /// `results.loss.cause.<how>`, with the last blow's Hob and shot when the core sent them.
    private func cause(_ how: String) -> String {
        let text = GameText.shared
        let last = result.broke?.last
        let round = last?.round ?? result.round
        switch how {
        case "kettle_pop":
            if let last, last.byHob, !last.hobName.isEmpty {
                let who = ContentCatalog.shared.hobShort(named: last.hobName)
                return text.t("results.loss.cause.kettle_pop", ["who": who, "shot": BrokeView.shotWords(last), "n": round])
            }
            return text.t("results.loss.cause.kettle_pop_plain", ["n": round])
        case "clean_sweep":
            // The core does not say which of your Hobs went last, so the plain line is used.
            return text.t("results.loss.cause.clean_sweep_plain")
        default:
            guard text.has("results.loss.cause.\(how)") else { return text.t("results.loss.cause.default") }
            return text.t("results.loss.cause.\(how)", ["captive": captive])
        }
    }

    /// "Double Pop": both kettles went in the same Squall round; says how the winner was picked
    /// (QA playtest 2, n5; `results.double_pop_rule`).
    static var doublePopNote: String { tx("results.double_pop_rule") }

    /// The core's `how` as a text.json id (`gave_up` is the older spelling of `give_up`).
    static func howId(_ how: String) -> String { how == "gave_up" ? "give_up" : how }

    /// Win: `results.win.title.<how>`; loss: `results.loss.title.<how>` (`default` for an id
    /// with no line). A line that needs a name we do not have falls back to `default`.
    static func headline(how: String, won: Bool, rival: String = "", captive: String = "") -> String {
        let text = GameText.shared
        let group = won ? "results.win.title" : "results.loss.title"
        var vars: [String: any CustomStringConvertible] = [:]
        if !rival.isEmpty { vars["rival"] = text.rivalShort(rival) }
        if !captive.isEmpty { vars["captive"] = captive }
        if let line = text.complete("\(group).\(howId(how))", vars) { return line }
        return text.t("\(group).default")
    }

    /// One line from the Rival's `sign_off` pool after a campaign win, else nil.
    static func pickSignOff(level: String?) -> String? {
        let text = GameText.shared
        guard let level, let key = text.complete("levels.\(level).rival") else { return nil }
        let line = text.pick("rivals.\(key).sign_off")
        return line.isEmpty ? nil : line
    }

    /// One Hetty line after a loss: the pool for the last blow's `by` (ground, fatigue, self,
    /// shears) when there is one, else the pool for `how`, else `default`.
    static func pickVerdict(how: String, by: String?) -> String? {
        let text = GameText.shared
        let base = "results.loss.verdict"
        let key: String
        if let by, !by.isEmpty, by != "hob", text.has("\(base).\(by)") {
            key = "\(base).\(by)"
        } else if text.has("\(base).\(howId(how))") {
            key = "\(base).\(howId(how))"
        } else {
            key = "\(base).default"
        }
        let line = text.pick(key)
        return line.isEmpty ? nil : line
    }
}

/// App state: which screen is up, the save, and the battle in play.
/// Layout is never stored here; it is worked out from the window each frame.
@MainActor
final class AppModel: ObservableObject {
    enum Screen: Equatable {
        case title, map, battle, results, skirmish, duelSetup, workshop
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
            launchNotice = GameText.shared.t("errors.saved_fight_cleared")
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
        save.firstRunDone = true
        persist()
        if save.progress.pennants.isEmpty, let first = campaign.levels.first {
            // First launch: straight into the first fight, no pre-battle sheet (no jingle clash on mus_r1).
            sound.play("ui_confirm")
            startCampaign(first, skipSheet: true)
        } else {
            sound.play("mus_title_jingle")
            screen = .map
            sound.playMusic("mus_map")
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

    /// Saved Workshop fort rows when present and big enough for `minSeats` Hobs.
    func workshopFortRows(minSeats: Int) -> [String]? {
        guard let rows = save.fort?.rows, !rows.isEmpty else { return nil }
        let grid = WorkshopGrid(rows: rows)
        guard grid.nooks >= max(1, minSeats) else { return nil }
        return rows
    }

    /// Local calendar date string (`yyyy-MM-dd`) for the Daily Dust-up seed and payout check.
    static func localDateString(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar.current
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    var dailyDoneToday: Bool { save.progress.dailyPaidOn == Self.localDateString() }

    private func startCampaign(_ level: LevelInfo, skipSheet: Bool) {
        var setup = BattleSetup.campaign(level.id, preset: save.settings.preset, seed: Self.newSeed())
        setup.progress = save.progress.coreProgress(level: level.id)
        setup.fortRows = workshopFortRows(minSeats: level.crewSize)
        save.lastLevel = level.id
        begin(setup, title: "\(level.id)  \(level.name)", sheet: skipSheet ? nil : level)
        game.thinkMs = catalog.level(level.id)?.thinkMs ?? game.defaultThinkMs
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
        setup.fortRows = workshopFortRows(minSeats: 4)
        if options.winBy == .volley { setup.rounds = BattleSetup.volleyChoices.contains(options.rounds) ? options.rounds : 10 }
        let text = GameText.shared
        let mapName = catalog.maps.first { $0.id == options.map }?.name ?? text.t("modes.skirmish.name")
        // The core picks the Rival from the map's roster by seed (`roster[seed % count]`); the
        // sheet shows the same one before the fight, and `hud.names[1]` names it during.
        let pick = catalog.skirmishRival(map: options.map, seed: setup.seed)
        let sheet = LevelInfo(id: "skirmish", name: mapName, state: "open",
                              rival: pick?.name ?? text.t("rivals.skirmish.name"),
                              habit: text.t("setup.rival_plays", ["grade": options.preset.label]),
                              goals: [text.t("pennants.win")],
                              hasDraft: options.shells == .draft, roundCap: setup.rounds,
                              squall: options.winBy == .knockout, crewSize: 4)
        begin(setup, title: "\(text.t("modes.skirmish.name"))  \(mapName)", sheet: options.shells == .draft ? sheet : nil)
        game.thinkMs = pick?.thinkMs ?? game.defaultThinkMs
    }

    /// Starts today's Daily Dust-up using the core's `cp_daily_seed` and payout tracking (iOS-H4).
    func startDaily() {
        sound.play("ui_sheet_open")
        let today = Self.localDateString()
        let seed = CoreFactory.dailySeed(date: today)
        var setup = BattleSetup(mode: .daily, map: "d1", preset: save.settings.preset, seed: seed)
        setup.rounds = 15
        setup.wind = .full
        setup.shells = .draft
        setup.progress = CoreProgress(cleared: false, pennants: [false, false, false],
                                      dailyPaid: save.progress.dailyPaidOn == today)
        setup.fortRows = workshopFortRows(minSeats: 4)
        let text = GameText.shared
        let pick = catalog.skirmishRival(map: "d1", seed: seed)
        let sheet = LevelInfo(id: "daily", name: text.t("modes.daily.name"), state: "open",
                              rival: pick?.name ?? text.t("rivals.skirmish.name"),
                              habit: text.t("modes.daily.line"), goals: [text.t("modes.daily.goal")],
                              hasDraft: true, roundCap: 15, squall: true, crewSize: 4)
        begin(setup, title: text.t("modes.daily.name"), sheet: sheet)
        game.thinkMs = pick?.thinkMs ?? game.defaultThinkMs
    }

    /// Opens the Test Yard (free-fire practice range), optionally testing an unsaved Workshop fort.
    func startTestYard(customRows: [String]? = nil) {
        sound.play("ui_tap")
        var setup = BattleSetup(mode: .yard, map: "d1", seed: Self.newSeed())
        if let rows = customRows, !rows.isEmpty {
            setup.fortRows = rows
        } else {
            setup.fortRows = workshopFortRows(minSeats: 4)
        }
        begin(setup, title: GameText.shared.t("modes.yard.name"), sheet: nil)
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
        setup.fortRows = workshopFortRows(minSeats: 4)
        if options.winBy == .volley { setup.rounds = BattleSetup.volleyChoices.contains(options.rounds) ? options.rounds : 10 }
        let text = GameText.shared
        let both = options.names.count >= 2
            ? text.t("common.list_and", ["a": options.names[0], "b": options.names[1]]) : ""
        let sheet = LevelInfo(id: "duel", name: text.t("modes.duel.name"), state: "open",
                              rival: both,
                              goals: [], hasDraft: options.shells == .draft, roundCap: setup.rounds,
                              squall: options.winBy == .knockout, crewSize: 4)
        begin(setup, title: text.t("modes.duel.name"), sheet: options.shells == .draft ? sheet : nil)
    }

    private func begin(_ setup: BattleSetup, title: String, sheet: LevelInfo?) {
        // A saved fight is replaying: nothing else may start until it is ready (review 2, M1).
        guard !resuming else { return }
        endSession(abandon: true)
        var activeSetup = setup
        if let error = game.start(activeSetup) {
            if activeSetup.fortRows != nil {
                activeSetup.fortRows = nil
                if game.start(activeSetup) != nil {
                    notice = GameText.shared.t("errors.fight_cannot_start")
                    return
                }
                notice = GameText.shared.t("errors.fort_did_not_fit")
            } else {
                _ = error
                notice = GameText.shared.t("errors.fight_cannot_start")
                return
            }
        }
        let s = makeSession(setup: activeSetup, title: title)
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
        // The gold ring on the picked Hob shows until 3 aims were started from the fort (saved).
        s.aimStarts = save.aimStarts
        s.onAimStarted = { [weak self] count in self?.noteAimStarted(count) }
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
        s.onAudioCue = { id in sound.play(id) }
        s.onAimBand = { gain, pitch in sound.setLoop("aim_band_stretch", gain: gain, pitch: pitch) }
        s.onSlowMo = { scale in sound.setSlowMotion(scale) }
        s.onHobPicked = { [weak s] def, side in
            let who = s.map { Self.barkContext($0.snapshot, side: side) } ?? ([], nil)
            sound.bark(hob: def, event: "picked", side: side, mates: who.mates, rival: who.rival)
        }
        s.fx.onSound = { id, pitch, gain in sound.play(id, pitch: pitch, gain: gain) }
        s.fx.onSoundAt = { [weak s] id, pitch, gain, x in
            let pan: Float
            if let x, let w = s?.snapshot.world.w, w > 0 {
                pan = Float(max(-0.8, min(0.8, (x / w * 2 - 1) * 0.8)))
            } else {
                pan = 0
            }
            sound.play(id, pitch: pitch, gain: gain, pan: pan)
        }
        s.fx.onBark = { [weak s] def, event, side in
            let who = s.map { Self.barkContext($0.snapshot, side: side) } ?? ([], nil)
            sound.bark(hob: def, event: event, side: side, mates: who.mates, rival: who.rival)
        }
        pendingSting = nil
        s.fx.onPopFrame = { [weak self] in
            guard let self, let sting = self.pendingSting else { return }
            self.pendingSting = nil
            self.sound.playSting(sting)
        }
        sound.onSubtitle = { [weak s] text, side in s?.showSubtitle(text, side: side) }
        return s
    }

    /// Who a bark may name: the Hob's crewmates (content ids) and, for the player's crew
    /// against a named Rival, the Rival's short name (barks.json `with_mate`, `with_rival`).
    static func barkContext(_ snap: BattleSnapshot, side: Int) -> (mates: [String], rival: String?) {
        let mates = snap.fort(side)?.hobs.map(\.def) ?? []
        guard !snap.isDuel, side == 0, snap.mode != "test_yard" else { return (mates, nil) }
        let text = GameText.shared
        let name = snap.name(1)
        // Only a Rival the string table knows by name (not the Skirmish fallback "A Rival").
        guard let key = text.rivalKey(named: name), key != "skirmish" else { return (mates, nil) }
        return (mates, text.rivalShort(name))
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
        sound.setSlowMotion(1)
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
        store.flush()
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
        var info = ResultInfo(result: result, setup: s.setup, title: s.title, names: names, goals: goals)
        if result.winner == 0, s.setup.mode == .campaign {
            info.signOff = ResultInfo.pickSignOff(level: s.setup.level)
        } else if result.winner != 0, s.setup.mode != .duel {
            info.verdict = ResultInfo.pickVerdict(how: result.reason, by: result.broke?.last?.by)
            info.verdictNamed = (save.progress.pennants["1-7"] ?? 0) > 0
        }
        lastResult = info
        if s.setup.mode == .campaign, let level = s.setup.level {
            // The core worked out the Buttons from `setup.progress` (design 5.2).
            save.progress.record(level: level, flags: result.winner == 0 ? result.pennantFlags : [],
                                 won: result.winner == 0, buttons: result.buttons)
        } else if s.setup.mode == .duel, result.winner == 0 || result.winner == 1 {
            tonight[result.winner] += 1
        } else if s.setup.mode == .daily {
            if result.winner == 0 {
                save.progress.dailyPaidOn = Self.localDateString()
            }
            save.progress.buttons += max(0, result.buttons)
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
            ? GameText.shared.t("errors.fight_broke_saved")
            : GameText.shared.t("errors.fight_broke")
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
                self.dropSavedBattle(GameText.shared.t("errors.saved_fight_cleared"))
            case .superseded:
                self.persist()
            }
        }
    }

    /// One more aim started from the fort (up to 3), kept so the ring stays gone next time.
    func noteAimStarted(_ count: Int) {
        let next = min(BattleSession.ownerRingAims, max(save.aimStarts, count))
        guard next != save.aimStarts else { return }
        save.aimStarts = next
        persist()
    }

    // MARK: Workshop (S10)

    func openWorkshop() {
        sound.play("ui_tap")
        screen = .workshop
    }

    /// Keeps one fort. Only a fort the core accepted is offered for saving.
    func saveWorkshopFort(_ rows: [String]) {
        save.fort = WorkshopFort(name: GameText.shared.t("workshop.my_fort"), rows: rows)
        persist()
        sound.play("meta_pennant_stamp")
    }

    /// The plain words for a save made under older game rules (rules 3 before QA playtest 2,
    /// rules 2 before QA playtest 1). The core's rules version is stored with every save.
    nonisolated static var rulesChangedNotice: String { GameText.shared.t("errors.saved_fight_old") }

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
                shotBlocks = 0
                shotLive = true
                shotSide = e.side >= 0 ? e.side : snap.activeSide
                let hobId = e.raw?.hob.map { String($0) }
                let hob = snap.fort(shotSide)?.hobs.first { $0.id == hobId }
                    ?? snap.fort(shotSide)?.hobs.first { $0.id == snap.selectedHob }
                shotHob = hob?.shortName ?? ""
            case "damage":
                shotDamage += max(0, e.amount)
                if e.text == "hob", e.side == 0, !snap.isDuel { haptics.play(.hobHit) }
            case "bonk":
                shotBonks += 1
                haptics.play(e.side == 0 && !snap.isDuel ? .bonkYours : .bonkTheirs)
            case "turn":
                sound.newTurnStep()
                let text = GameText.shared
                var shot = ""
                if shotLive {
                    // One short line per shot for VoiceOver (M5), spoken with the turn line, with
                    // the Hob's name (a11y.shot_summary), never a side id.
                    shotLive = false
                    let hob = shotHob.isEmpty ? snap.name(shotSide) : shotHob
                    if shotDamage > 0 || shotBlocks > 0 {
                        shot = shotBonks > 0
                            ? text.t("a11y.shot_summary_bonks", ["hob": hob, "dmg": shotDamage, "n": shotBonks])
                            : text.plural("a11y.shot_summary", shotBlocks, ["hob": hob, "dmg": shotDamage])
                    } else {
                        shot = text.t("a11y.shot_missed", ["hob": hob])
                    }
                    shot += " "
                }
                let side = e.side >= 0 ? e.side : snap.activeSide
                let who: String
                if snap.isDuel {
                    who = text.t("a11y.round_name_turn", ["n": snap.round, "name": snap.name(side)])
                } else if snap.isHuman(side) {
                    who = text.t("a11y.round_your_turn", ["n": snap.round])
                } else {
                    who = text.t("a11y.round_rival_aims", ["n": snap.round, "rival": text.rivalShort(snap.name(side))])
                }
                let wind = snap.wind == 0 ? text.t("hud.wind.none")
                    : text.t(snap.wind > 0 ? "hud.wind.right" : "hud.wind.left", ["n": abs(snap.wind)])
                announce("\(shot)\(who) \(wind).")
                // Pitch 0 for side 0 or Player 1, 2 semitones down for the Rival or Player 2.
                sound.play("turn_yours", pitch: side == 0 ? 0 : -2)
            case "kettle_pop":
                haptics.play(.kettlePop)
                let text = GameText.shared
                if e.side == 0 && !snap.isDuel {
                    announce(text.t("results.loss.cause.kettle_pop_plain", ["n": snap.round]))
                } else {
                    let name = snap.isDuel ? snap.name(e.side) : text.rivalShort(snap.name(e.side))
                    announce(text.t("a11y.kettle_popped", ["name": name]))
                }
            case "end":
                let captive = GameText.shared.complete("levels.\(snap.level).captive") ?? ""
                let headline = ResultInfo.headline(how: e.text, won: e.side == 0, rival: snap.name(1), captive: captive)
                announce(snap.isDuel ? GameText.shared.t("a11y.wins", ["name": snap.name(e.side)]) : headline)
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
                let phase = e.raw?.phase ?? 2
                let line = GameText.shared.complete("levels.\(snap.level).phases.\(phase)")
                announce(line ?? GameText.shared.t("a11y.boss_phase", ["n": phase]))
            case "break":
                if shotLive, e.side != shotSide { shotBlocks += 1 }
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
    private var shotBlocks = 0
    private var shotSide = 0
    private var shotHob = ""
    private var shotLive = false

    private func announce(_ text: String) {
        guard !text.isEmpty, UIAccessibility.isVoiceOverRunning else { return }
        UIAccessibility.post(notification: .announcement, argument: text)
    }

    private static func newSeed() -> UInt64 {
        UInt64.random(in: 1...0x1F_FFFF_FFFF_FFFF)
    }
}

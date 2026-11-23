import Foundation

enum RotationSetting: String, Codable, Sendable, CaseIterable, Identifiable {
    case followDevice = "follow", stayWide = "wide", stayTall = "tall"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .followDevice: return tx("settings.controls.follow")
        case .stayWide: return tx("settings.controls.wide")
        case .stayTall: return tx("settings.controls.tall")
        }
    }
}

enum DragMode: String, Codable, Sendable, CaseIterable, Identifiable {
    case pullBack = "pull_back", point
    var id: String { rawValue }
    var label: String { tx(self == .pullBack ? "settings.controls.pull_back" : "settings.controls.point") }
}

enum HapticsLevel: String, Codable, Sendable, CaseIterable, Identifiable {
    case off, light, full
    var id: String { rawValue }
    var label: String {
        switch self {
        case .off: return tx("common.off")
        case .light: return tx("setup.wind.light")
        case .full: return tx("settings.comfort.full")
        }
    }
}

enum ColourSet: String, Codable, Sendable, CaseIterable, Identifiable {
    case brickabrac, dusk, ink
    var id: String { rawValue }
    /// "Blue and Orange": the two side colours of the set.
    var label: String { tx("common.list_and", ["a": sideName(0), "b": sideName(1)]) }

    func sideName(_ side: Int) -> String {
        let id: String
        switch self {
        case .brickabrac: id = side == 0 ? "blue" : "orange"
        case .dusk: id = side == 0 ? "navy" : "gold"
        case .ink: id = side == 0 ? "white" : "black"
        }
        return tx("settings.comfort.colours.\(id)")
    }
}

/// Every player setting. Each change applies at once and is saved at once.
struct GameSettings: Codable, Equatable, Sendable {
    var music = 70
    var sound = 85
    var voices = 80
    var muteAll = false
    var subtitles = true
    var rotation = RotationSetting.followDevice
    var dragMode = DragMode.pullBack
    var quickFire = false
    var leftHand = false
    var tapOnly = false
    var rivalTurnsFast = false
    var preset = Preset.fair
    var haptics = HapticsLevel.full
    var reduceMotion = false
    var colourSet = ColourSet.brickabrac
    var largeText = false
    /// Reduce shake: 100, 50 or 0 percent (UX 6.2).
    var shake = 100

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = GameSettings()
        music = c.value(.music, d.music)
        sound = c.value(.sound, d.sound)
        voices = c.value(.voices, d.voices)
        muteAll = c.value(.muteAll, d.muteAll)
        subtitles = c.value(.subtitles, d.subtitles)
        rotation = c.value(.rotation, d.rotation)
        dragMode = c.value(.dragMode, d.dragMode)
        quickFire = c.value(.quickFire, d.quickFire)
        leftHand = c.value(.leftHand, d.leftHand)
        tapOnly = c.value(.tapOnly, d.tapOnly)
        rivalTurnsFast = c.value(.rivalTurnsFast, d.rivalTurnsFast)
        preset = c.value(.preset, d.preset)
        haptics = c.value(.haptics, d.haptics)
        reduceMotion = c.value(.reduceMotion, d.reduceMotion)
        colourSet = c.value(.colourSet, d.colourSet)
        largeText = c.value(.largeText, d.largeText)
        shake = c.value(.shake, d.shake)
    }

    private enum CodingKeys: String, CodingKey {
        case music, sound, voices, muteAll, subtitles, rotation, dragMode, quickFire, leftHand
        case tapOnly, rivalTurnsFast, preset, haptics, reduceMotion, colourSet, largeText, shake
    }
}

/// Campaign progress the app shows on the map. The core is the judge of what
/// was earned; the app only keeps the best result per level.
struct CampaignProgress: Codable, Equatable, Sendable {
    /// Best Pennant count per level id ("1-1": 2).
    var pennants: [String: Int] = [:]
    /// Which of the three Pennants each level has ("1-1": [true, false, true]).
    var flags: [String: [Bool]] = [:]
    var buttons = 0
    /// The local date (yyyy-MM-dd) the Daily Dust-up last paid.
    var dailyPaidOn: String?

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Strict: damaged Pennants make the whole file count as damaged, so the
        // backup is read instead of an empty record that a later write would keep (M11).
        pennants = try c.decodeIfPresent([String: Int].self, forKey: .pennants) ?? [:]
        flags = c.value(.flags, [:])
        buttons = c.value(.buttons, 0)
        dailyPaidOn = c.value(.dailyPaidOn, nil)
    }

    /// What the core needs to work out the Buttons for this level (`setup.progress`).
    func coreProgress(level: String) -> CoreProgress {
        let count = pennants[level] ?? 0
        var bits = flags[level] ?? (0..<3).map { $0 < count }
        while bits.count < 3 { bits.append(false) }
        return CoreProgress(cleared: count > 0 || bits.contains(true), pennants: Array(bits.prefix(3)))
    }

    /// Keeps every Pennant ever earned on a level (the core's flags, OR'd).
    mutating func record(level: String, flags earned: [Bool], won: Bool, buttons gained: Int) {
        var bits = flags[level] ?? []
        while bits.count < max(3, earned.count) { bits.append(false) }
        for (i, f) in earned.enumerated() where f { bits[i] = true }
        if won || bits.contains(true) {
            flags[level] = bits
            pennants[level] = max(pennants[level] ?? 0, max(won ? 1 : 0, bits.filter { $0 }.count))
        }
        buttons += max(0, gained)
    }

    var totalPennants: Int { pennants.values.reduce(0, +) }

    mutating func record(level: String, pennants earned: Int, buttons gained: Int) {
        pennants[level] = max(pennants[level] ?? 0, earned)
        buttons += max(0, gained)
    }

    private enum CodingKeys: String, CodingKey { case pennants, flags, buttons, dailyPaidOn }
}

/// The battle in play: the core's own bytes, plus a few words for the
/// "Carry on?" card so it can be drawn without asking the core.
struct BattleSave: Codable, Equatable, Sendable {
    var core: Data
    var setup: BattleSetup
    var title: String
    var round: Int
    var turnName: String
    var savedAt: Date

    init(core: Data, setup: BattleSetup, title: String, round: Int, turnName: String, savedAt: Date = Date()) {
        self.core = core; self.setup = setup; self.title = title
        self.round = round; self.turnName = turnName; self.savedAt = savedAt
    }
}

struct DuelOptions: Codable, Equatable, Sendable {
    /// `names.player_default` from text.json, else "Player 1" and "Player 2" (`setup.player_label`).
    var names = DuelOptions.defaultNames
    var help: [HelpLevel] = [.none, .none]
    var forts = ["box_2", "box_1"]
    var map = "d1"
    var winBy = WinBy.knockout
    var rounds = 15
    var wind = WindSetting.light
    var shells = ShellRule.draft
    var seats = Seats.sideBySide

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = DuelOptions()
        names = c.value(.names, d.names)
        help = c.value(.help, d.help)
        forts = c.value(.forts, d.forts)
        map = c.value(.map, d.map)
        winBy = c.value(.winBy, d.winBy)
        rounds = c.value(.rounds, d.rounds)
        wind = c.value(.wind, d.wind)
        shells = c.value(.shells, d.shells)
        seats = c.value(.seats, d.seats)
        if names.count < 2 { names = d.names }
        if help.count < 2 { help = d.help }
        if forts.count < 2 { forts = d.forts }
    }

    private enum CodingKeys: String, CodingKey { case names, help, forts, map, winBy, rounds, wind, shells, seats }
}

struct SkirmishOptions: Codable, Equatable, Sendable {
    var map = "d1"
    var preset = Preset.fair
    var rounds = 15
    var wind = WindSetting.light
    var winBy = WinBy.knockout
    var shells = ShellRule.draft
    var help = HelpLevel.none

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = SkirmishOptions()
        help = c.value(.help, d.help)
        map = c.value(.map, d.map)
        preset = c.value(.preset, d.preset)
        rounds = c.value(.rounds, d.rounds)
        wind = c.value(.wind, d.wind)
        winBy = c.value(.winBy, d.winBy)
        shells = c.value(.shells, d.shells)
    }

    private enum CodingKeys: String, CodingKey { case map, preset, rounds, wind, winBy, shells, help }
}

/// The one fort the Workshop keeps: the core's glyph rows, top first, the Footing last
/// (core/API.md, `sides[i].rows`).
struct WorkshopFort: Codable, Equatable, Sendable {
    var name = tx("workshop.my_fort")
    var rows: [String] = []
}

/// Everything the app keeps on the device, in one Codable file.
struct SaveData: Codable, Equatable, Sendable {
    static let currentSchema = 1

    var schema = SaveData.currentSchema
    /// Bumps on every write, shown in About, and used to pick the newer of two files.
    var counter = 0
    var firstRunDone = false
    var settings = GameSettings()
    var progress = CampaignProgress()
    var battle: BattleSave?
    var duel = DuelOptions()
    var skirmish = SkirmishOptions()
    /// Last level played, so the map opens on it.
    var lastLevel: String?
    /// Set while a saved battle is being replayed; still set at launch means the replay killed the app (H4).
    var resumeInProgress = false
    /// Aims started from the fort, up to 3: the gold ring on the picked Hob shows until then
    /// (QA playtest 2, owner rule).
    var aimStarts = 0
    /// The fort saved in the Workshop, or nil.
    var fort: WorkshopFort?

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = SaveData()
        schema = c.value(.schema, d.schema)
        counter = c.value(.counter, d.counter)
        firstRunDone = c.value(.firstRunDone, d.firstRunDone)
        settings = c.value(.settings, d.settings)
        progress = try c.decodeIfPresent(CampaignProgress.self, forKey: .progress) ?? d.progress
        battle = c.value(.battle, nil)
        duel = c.value(.duel, d.duel)
        skirmish = c.value(.skirmish, d.skirmish)
        lastLevel = c.value(.lastLevel, nil)
        resumeInProgress = c.value(.resumeInProgress, false)
        aimStarts = max(0, c.value(.aimStarts, 0))
        fort = c.value(.fort, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case schema, counter, firstRunDone, settings, progress, battle, duel, skirmish, lastLevel, resumeInProgress
        case aimStarts, fort
    }
}

extension DuelOptions {
    /// The two names a new Couch Duel starts with (`names.player_default`).
    static var defaultNames: [String] {
        let pool = GameText.shared.pool("names.player_default")
        if pool.count >= 2 { return Array(pool.prefix(2)) }
        return [tx("setup.player_label", ["n": 1]), tx("setup.player_label", ["n": 2])]
    }
}

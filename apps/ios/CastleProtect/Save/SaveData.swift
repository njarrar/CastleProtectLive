import Foundation

enum RotationSetting: String, Codable, Sendable, CaseIterable, Identifiable {
    case followDevice = "follow", stayWide = "wide", stayTall = "tall"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .followDevice: return "Follow device"
        case .stayWide: return "Stay wide"
        case .stayTall: return "Stay tall"
        }
    }
}

enum DragMode: String, Codable, Sendable, CaseIterable, Identifiable {
    case pullBack = "pull_back", point
    var id: String { rawValue }
    var label: String { self == .pullBack ? "Pull-back" : "Point" }
}

enum HapticsLevel: String, Codable, Sendable, CaseIterable, Identifiable {
    case off, light, full
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum ColourSet: String, Codable, Sendable, CaseIterable, Identifiable {
    case brickabrac, dusk, ink
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

/// Every player setting. Each change applies at once and is saved at once.
struct GameSettings: Codable, Equatable, Sendable {
    var music = 70
    var sound = 70
    var voices = 70
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
    }

    private enum CodingKeys: String, CodingKey {
        case music, sound, voices, muteAll, subtitles, rotation, dragMode, quickFire, leftHand
        case tapOnly, rivalTurnsFast, preset, haptics, reduceMotion, colourSet, largeText
    }
}

/// Campaign progress the app shows on the map. The core is the judge of what
/// was earned; the app only keeps the best result per level.
struct CampaignProgress: Codable, Equatable, Sendable {
    /// Best Pennant count per level id ("1-1": 2).
    var pennants: [String: Int] = [:]
    var buttons = 0

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pennants = c.value(.pennants, [:])
        buttons = c.value(.buttons, 0)
    }

    var totalPennants: Int { pennants.values.reduce(0, +) }

    mutating func record(level: String, pennants earned: Int, buttons gained: Int) {
        pennants[level] = max(pennants[level] ?? 0, earned)
        buttons += max(0, gained)
    }

    private enum CodingKeys: String, CodingKey { case pennants, buttons }
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
    var names = ["Player 1", "Player 2"]
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

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = SkirmishOptions()
        map = c.value(.map, d.map)
        preset = c.value(.preset, d.preset)
        rounds = c.value(.rounds, d.rounds)
        wind = c.value(.wind, d.wind)
        winBy = c.value(.winBy, d.winBy)
        shells = c.value(.shells, d.shells)
    }

    private enum CodingKeys: String, CodingKey { case map, preset, rounds, wind, winBy, shells }
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

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = SaveData()
        schema = c.value(.schema, d.schema)
        counter = c.value(.counter, d.counter)
        firstRunDone = c.value(.firstRunDone, d.firstRunDone)
        settings = c.value(.settings, d.settings)
        progress = c.value(.progress, d.progress)
        battle = c.value(.battle, nil)
        duel = c.value(.duel, d.duel)
        skirmish = c.value(.skirmish, d.skirmish)
        lastLevel = c.value(.lastLevel, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case schema, counter, firstRunDone, settings, progress, battle, duel, skirmish, lastLevel
    }
}

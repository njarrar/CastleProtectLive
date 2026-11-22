import Foundation

// What the app asks for when it starts a battle. CoreGame turns it into the
// core's setup (CoreSetup); the core fills in everything else from the level.

enum GameMode: String, Codable, Sendable, CaseIterable {
    case campaign, skirmish, duel, yard
    /// The Daily Dust-up: a Skirmish on the day's seed that pays the Daily reward.
    case daily
}

enum Preset: String, Codable, Sendable, CaseIterable, Identifiable {
    case cozy, fair, stubborn
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum WindSetting: String, Codable, Sendable, CaseIterable, Identifiable {
    case off, light, full
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum WinBy: String, Codable, Sendable, CaseIterable, Identifiable {
    case knockout, volley
    var id: String { rawValue }
    var label: String { self == .knockout ? "Knockout" : "Volley Points" }
}

enum ShellRule: String, Codable, Sendable, CaseIterable, Identifiable {
    case draft, quick, plain
    var id: String { rawValue }
    var label: String {
        switch self {
        case .draft: return "Draft"
        case .quick: return "Quick Pick"
        case .plain: return "Plain only"
        }
    }
}

enum Seats: String, Codable, Sendable, CaseIterable, Identifiable {
    case sideBySide = "side_by_side", oneSeat = "one_seat"
    var id: String { rawValue }
    var label: String { self == .sideBySide ? "Side by side" : "One seat" }
}

enum HelpLevel: String, Codable, Sendable, CaseIterable, Identifiable {
    case none, some, lots
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    /// The core's setup value (`sides[i].help`), nil for None.
    var core: String? { self == .none ? nil : rawValue }
    /// Preview arc share for this Help step (UX 4.9: 30%, 60%, full); nil keeps the level's.
    var previewPct: Int? {
        switch self {
        case .none: return nil
        case .some: return 60
        case .lots: return 100
        }
    }
    /// Gold plus marks shown openly beside a name.
    var marks: String {
        switch self {
        case .none: return ""
        case .some: return "+"
        case .lots: return "++"
        }
    }
}

/// What a battle is, as the app asks for it. The core fills in everything else.
struct BattleSetup: Codable, Equatable, Sendable {
    var mode: GameMode = .campaign
    var level: String?
    var map: String?
    var preset: Preset = .fair
    var seed: UInt64 = 1
    var rounds: Int = 15
    var wind: WindSetting = .light
    var shells: ShellRule = .draft
    var winBy: WinBy = .knockout
    var seats: Seats = .sideBySide
    var names: [String] = []
    var help: [HelpLevel] = []
    /// Starter Box fort per side ("box_1"...), duel only.
    var forts: [String] = []
    /// What the save holds for this level, so the core can work out the Buttons (campaign).
    var progress: CoreProgress?
    /// Which try at this fight: nil or 0 the first, 1 the first Retry, and so on. Sent as the
    /// setup's `attempt`, so a Retry with the same seed is a new fight (QA playtest 1, M6).
    /// Optional so a save written before rules 3 still reads (and is then refused by rules).
    var attempt: Int?

    /// The same fight tried again: same seed, the next attempt.
    func retried() -> BattleSetup {
        var next = self
        next.attempt = min(1_000_000, (attempt ?? 0) + 1)
        return next
    }

    /// The `attempt` the core is sent: none on a first try, and never in the Daily Dust-up,
    /// which stays one fight per date (core/API.md).
    var coreAttempt: Int? {
        guard let attempt, attempt > 0, !isDaily else { return nil }
        return min(1_000_000, attempt)
    }

    /// The Daily Dust-up (setup mode `daily`): one fight per date, so a Retry sends no `attempt`.
    var isDaily: Bool { mode == .daily }

    static func campaign(_ level: String, preset: Preset, seed: UInt64) -> BattleSetup {
        BattleSetup(mode: .campaign, level: level, preset: preset, seed: seed)
    }
}

extension WindSetting {
    /// Wind range for the core's setup. Off is calm; Light and Full widen the range.
    var coreWind: CoreWind {
        switch self {
        case .off: return CoreWind(min: 0, max: 0, fronts: nil, frontRounds: nil)
        case .light: return CoreWind(min: 0, max: 3, fronts: nil, frontRounds: nil)
        case .full: return CoreWind(min: 2, max: 7, fronts: nil, frontRounds: nil)
        }
    }
}

extension BattleSetup {
    /// Starter Box forts on the Couch Duel setup screen, by core kit id.
    static let kits = ["box_1": "kit_oak", "box_2": "kit_stone", "box_3": "kit_reed"]

    /// Volley Points Actions per side, offered on the setup screens (API: 6, 10 or 14).
    static let volleyChoices = [6, 10, 14]

    /// The core's battle setup (`level_json` for `cp_new`), with only the fields API.md lists.
    func coreSetup() -> CoreSetup {
        let rummage: CoreRummage? = shells == .plain ? CoreRummage(pool: 0, picks: 0, source: nil) : nil
        let volley: Int? = winBy == .volley ? (Self.volleyChoices.contains(rounds) ? rounds : 10) : nil
        // Volley Points has no round cap; the core refuses none, but sends no cap with it.
        let cap: Int? = winBy == .volley ? nil : rounds
        func help(_ i: Int) -> HelpLevel { i < self.help.count ? self.help[i] : .none }
        switch mode {
        case .campaign:
            return CoreSetup(level: level ?? "1-1", mode: "campaign",
                             sides: [CoreSideConfig(control: "human"), CoreSideConfig(control: "ai", preset: preset.rawValue)],
                             progress: progress, attempt: coreAttempt)
        case .skirmish, .daily:
            return CoreSetup(level: map ?? "d1", mode: mode == .daily ? "daily" : "skirmish",
                             sides: [CoreSideConfig(control: "human", help: help(0).core, previewPct: help(0).previewPct),
                                     CoreSideConfig(control: "ai", preset: preset.rawValue)],
                             firstTurn: .coin, roundCap: cap, wind: wind.coreWind, rummage: rummage, volley: volley,
                             attempt: coreAttempt)
        case .duel:
            let sides = (0..<2).map { i in
                CoreSideConfig(control: "human",
                               kit: i < forts.count ? Self.kits[forts[i]] : nil,
                               name: i < names.count ? names[i] : "Player \(i + 1)",
                               help: help(i).core, previewPct: help(i).previewPct)
            }
            return CoreSetup(level: map ?? "d1", mode: "couch", sides: sides, firstTurn: .coin,
                             roundCap: cap, wind: wind.coreWind, rummage: rummage, volley: volley, attempt: coreAttempt)
        case .yard:
            // Side 1 is the Dummy side whatever is sent: the core seats Straw Stuffers and passes
            // its turns (rules 3), so the app sends no sides at all.
            return CoreSetup(level: map ?? "d1", mode: "test_yard")
        }
    }
}

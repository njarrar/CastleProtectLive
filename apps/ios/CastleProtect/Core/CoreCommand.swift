import Foundation

/// Everything the app may ask of the rules core. The core checks each command
/// against the rules and answers ok or a reason key; the app never decides.
enum CoreCommand: Equatable, Sendable {
    case newBattle(BattleSetup)
    /// Angle in tenths of a degree (0 to 1800), power 0 to 100.
    case aim(angle: Int, power: Int)
    case fire
    /// One Walk step while the Walk key is held: -1 left, 1 right, 0 stop.
    case walk(dx: Int)
    case pickHob(String)
    case pickShot(String)
    case draftPick(String)
    case quickPick
    case endDraft
    /// Couch Duel: the next player tapped Ready on the hand-off card.
    case ready
    /// Steps through the picked Hob's Ghosts: last shot, the one before, current.
    case recall
    /// Resolve speed, 1 or 2.
    case speed(Int)
    case giveUp
    /// Leave the battle without a result (pre-battle close, Leave it).
    case abandon

    var name: String {
        switch self {
        case .newBattle: return "new_battle"
        case .aim: return "aim"
        case .fire: return "fire"
        case .walk: return "walk"
        case .pickHob: return "pick_hob"
        case .pickShot: return "pick_shot"
        case .draftPick: return "draft_pick"
        case .quickPick: return "quick_pick"
        case .endDraft: return "end_draft"
        case .ready: return "ready"
        case .recall: return "recall"
        case .speed: return "speed"
        case .giveUp: return "give_up"
        case .abandon: return "abandon"
        }
    }

    /// The command as a JSON object, keys sorted so the bytes are stable.
    func jsonData() -> Data {
        var obj: [String: Any] = ["cmd": name]
        switch self {
        case .newBattle(let setup):
            for (k, v) in setup.jsonObject() { obj[k] = v }
        case .aim(let angle, let power):
            obj["angle"] = angle
            obj["power"] = power
        case .walk(let dx):
            obj["dx"] = dx
        case .pickHob(let id), .pickShot(let id), .draftPick(let id):
            obj["id"] = id
        case .speed(let x):
            obj["x"] = x
        case .fire, .quickPick, .endDraft, .ready, .recall, .giveUp, .abandon:
            break
        }
        return (try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])) ?? Data("{}".utf8)
    }

    func jsonString() -> String { String(decoding: jsonData(), as: UTF8.self) }
}

enum GameMode: String, Codable, Sendable, CaseIterable {
    case campaign, skirmish, duel, yard
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

    static func campaign(_ level: String, preset: Preset, seed: UInt64) -> BattleSetup {
        BattleSetup(mode: .campaign, level: level, preset: preset, seed: seed)
    }

    func jsonObject() -> [String: Any] {
        var o: [String: Any] = [
            "mode": mode.rawValue,
            "preset": preset.rawValue,
            // Kept under 2^53 so every JSON reader (the web too) reads it exactly.
            "seed": seed & 0x1F_FFFF_FFFF_FFFF,
            "rounds": rounds,
            "wind": wind.rawValue,
            "shells": shells.rawValue,
            "draft": shells == .draft,
            "win_by": winBy.rawValue,
            "seats": seats.rawValue,
        ]
        if let level { o["level"] = level }
        if let map { o["map"] = map }
        if !names.isEmpty { o["names"] = names }
        if !help.isEmpty { o["help"] = help.map(\.rawValue) }
        if !forts.isEmpty { o["forts"] = forts }
        return o
    }
}

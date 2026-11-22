import Foundation

/// Read-only menu data from the repo's content/ folder (copied into the app
/// bundle as `content/`): level names, Rivals and their habits, Pennant goal
/// text, Skirmish maps and shot names. The core reads the same files for the
/// rules; the app only shows the words.
struct ContentCatalog: Sendable {
    struct Level: Sendable, Equatable {
        var id: String
        var name: String
        var kind: String
        var rival: String
        var habit: String
        var goals: [String]
        var hasDraft: Bool
        var roundCap: Int
    }

    struct Shot: Sendable, Equatable {
        var name: String
        var weight: String
        var card: String
    }

    var region = "Puddingstone Downs"
    var levels: [Level]
    var maps: [MapChoice]
    var shots: [String: Shot]

    func shotName(_ id: String) -> String {
        shots[id]?.name ?? id.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    func level(_ id: String) -> Level? { levels.first { $0.id == id } ?? skirmishLevels.first { $0.id == id } }

    /// Skirmish and Couch Duel maps (`d1`, `d2`...).
    var skirmishLevels: [Level] = []

    /// The campaign map. A level opens when the one before it is won
    /// (any Pennant); this is what the map shows, the core still runs the battle.
    func campaign(pennants: [String: Int]) -> CampaignView {
        var out: [LevelInfo] = []
        var previousWon = true
        var nextMarked = false
        for l in levels {
            let p = pennants[l.id] ?? 0
            let state: String
            if p > 0 {
                state = "done"
            } else if previousWon && !nextMarked {
                state = "next"
                nextMarked = true
            } else {
                state = "locked"
            }
            previousWon = p > 0
            out.append(LevelInfo(id: l.id, name: l.name, kind: l.kind, state: state, pennants: p, rival: l.rival,
                                 habit: l.habit, goals: l.goals, hasDraft: l.hasDraft, roundCap: l.roundCap))
        }
        return CampaignView(region: region, levels: out)
    }

    // MARK: Loading

    static func load(bundle: Bundle = .main) -> ContentCatalog {
        var levels: [Level] = []
        var skirmish: [Level] = []
        let urls = (bundle.urls(forResourcesWithExtension: "json", subdirectory: "content/levels") ?? [])
        for url in urls {
            guard let data = try? Data(contentsOf: url),
                  let level = try? JSONDecoder().decode(RawLevel.self, from: data) else { continue }
            let entry = Level(id: level.id, name: level.name, kind: level.type, rival: level.rival?.name ?? "Rival",
                              habit: level.rival?.habit ?? "", goals: (level.pennants ?? []).map(\.text),
                              hasDraft: (level.rules?.rummage?.pool ?? 0) > 0, roundCap: level.rules?.roundCap ?? 15)
            if level.type == "skirmish" { skirmish.append(entry) } else { levels.append(entry) }
        }
        levels.sort { Self.order($0.id) < Self.order($1.id) }
        skirmish.sort { $0.id < $1.id }
        var shots: [String: Shot] = [:]
        if let url = bundle.url(forResource: "shots", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let list = try? JSONDecoder().decode([RawShot].self, from: data) {
            for s in list { shots[s.id] = Shot(name: s.name, weight: s.weight ?? "L", card: s.card ?? "") }
        }
        if levels.isEmpty { levels = fallbackLevels }
        if skirmish.isEmpty {
            skirmish = [
                Level(id: "d1", name: "Twin Puddings", kind: "skirmish", rival: "Skirmish Rival", habit: "", goals: [], hasDraft: true, roundCap: 15),
                Level(id: "d2", name: "Orchard Dip", kind: "skirmish", rival: "Skirmish Rival", habit: "", goals: [], hasDraft: true, roundCap: 15),
            ]
        }
        var catalog = ContentCatalog(levels: levels, maps: skirmish.map { MapChoice(id: $0.id, name: $0.name) }, shots: shots)
        catalog.skirmishLevels = skirmish
        return catalog
    }

    /// "1-10" sorts after "1-9".
    static func order(_ id: String) -> Int {
        let parts = id.split(separator: "-").compactMap { Int($0) }
        return parts.count == 2 ? parts[0] * 100 + parts[1] : 10_000
    }

    /// Used only when the content folder is not in the bundle.
    static let fallbackLevels: [Level] = [
        Level(id: "1-1", name: "First Lump", kind: "siege", rival: "Sir Pudge", habit: "Shoots wide first. Then a bit closer.",
              goals: ["Win", "Land 2 hits in a row", "Win by Round 5"], hasDraft: false, roundCap: 8),
        Level(id: "1-2", name: "Two Hats", kind: "siege", rival: "Private Tuft Edgerly", habit: "Shoots your top Hob first.",
              goals: ["Win", "Bonk a Hob with each of your Hobs", "No Hob of yours Bonked"], hasDraft: false, roundCap: 10),
        Level(id: "1-3", name: "Kettle on the Knoll", kind: "siege", rival: "Corporal Fernsby Clip", habit: "Hides his crew deep.",
              goals: ["Win", "Win by Kettle Pop", "Your kettle above 50%"], hasDraft: false, roundCap: 12),
        Level(id: "1-4", name: "Breezy Tops", kind: "siege", rival: "Rival", habit: "",
              goals: ["Win", "Land 3 hits in a row", "No Hob of yours Bonked"], hasDraft: false, roundCap: 15),
        Level(id: "1-5", name: "The Big One", kind: "siege", rival: "Rival", habit: "",
              goals: ["Win", "Bonk a Hob with a Knack", "Your kettle above 60%"], hasDraft: false, roundCap: 15),
        Level(id: "1-6", name: "Roof Trouble", kind: "siege", rival: "Rival", habit: "",
              goals: ["Win", "No Hob of yours Bonked", "Your kettle above 60%"], hasDraft: false, roundCap: 15),
        Level(id: "1-7", name: "Hetty in a Jam", kind: "rescue", rival: "Rival", habit: "",
              goals: ["Free Hetty", "Captive takes no damage", "Free her by Round 6"], hasDraft: false, roundCap: 14),
        Level(id: "1-8", name: "Rummage Sale", kind: "siege", rival: "Sergeant Posy Rakewell", habit: "Grabs the biggest shell in the Rummage.",
              goals: ["Win", "Bonk a Hob with a Trick Shell", "Use both your Trick Shells"], hasDraft: true, roundCap: 15),
        Level(id: "1-9", name: "Over Loaf Hill", kind: "siege", rival: "Rival", habit: "",
              goals: ["Win", "Land hits from two spots", "No Hob of yours Bonked"], hasDraft: true, roundCap: 15),
        Level(id: "1-10", name: "The Topiary Keep", kind: "grand_fort", rival: "Marshal Trimm", habit: "",
              goals: ["Beat Marshal Trimm", "Break the Sprinkler Root by Round 4", "The hill keeps half its height"], hasDraft: true, roundCap: 18),
    ]
}

private struct RawLevel: Decodable {
    struct Rival: Decodable {
        var name: String?
        var habit: String?
    }

    struct Pennant: Decodable {
        var text: String
    }

    struct Rules: Decodable {
        struct Rummage: Decodable { var pool: Int? }
        var roundCap: Int?
        var rummage: Rummage?

        private enum CodingKeys: String, CodingKey {
            case rummage
            case roundCap = "round_cap"
        }
    }

    var id: String
    var name: String
    var type: String
    var rival: Rival?
    var pennants: [Pennant]?
    var rules: Rules?
}

private struct RawShot: Decodable {
    var id: String
    var name: String
    var weight: String?
    var card: String?
}

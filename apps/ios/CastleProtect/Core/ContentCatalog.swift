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
        var squall: Bool = true
        var crewSize: Int = 4
        /// `rival.think_ms` (the Rival's pause before each turn), or nil.
        var thinkMs: Int? = nil
        /// Skirmish maps: `rival.roster`, the named Rivals the core picks from by seed.
        var roster: [RosterEntry] = []
    }

    /// One named Rival a Skirmish map may field (`rival.roster`).
    struct RosterEntry: Sendable, Equatable {
        var name: String
        var thinkMs: Int?
    }

    /// A Hob from `content/hobs.json`: its display name and Class id.
    struct HobInfo: Sendable, Equatable {
        var name: String
        var cls: String
    }

    /// A name and card line from `classes.json` (role) or `doodads.json` (card).
    struct NamedCard: Sendable, Equatable {
        var name: String
        var line: String
    }

    struct Shot: Sendable, Equatable {
        var name: String
        var weight: String
        var card: String
        /// Flight kind (arc, split, dig, bounce, roller, prop, beam, self) and first damage type.
        var flight: String = "arc"
        var dtype: String = "blast"
        var dud: Bool = false
        var matchClass: String? = nil
        var dials: [String] = []
        var hasSelfTarget: Bool = false
        // Display-only inspect metadata decoded from content/shots.json (zero rules).
        var kind: String = "plain"
        var damage: Int = 0
        var band: String = ""
        var maxCells: Int = 0
        var bounces: Int = 0
        var splitCount: Int = 0
        var tags: [String] = []

        /// The Class display name for `matchClass`, from classes.json (set when loading).
        var matchClassName: String? = nil

        var weightLabel: String {
            switch weight.uppercased() {
            case "H": return GameText.shared.t("shell_card.weight.heavy")
            case "M": return GameText.shared.t("shell_card.weight.medium")
            default: return GameText.shared.t("shell_card.weight.light")
            }
        }

        var restCogs: Int { CoreHandShell.cogs(weight) }

        var matchClassTitle: String? {
            guard !dud, let m = matchClass, !m.isEmpty else { return nil }
            if m == "all" { return GameText.shared.t("shell_card.any_class") }
            return matchClassName ?? m.capitalized
        }

        var matchedHobArt: String? {
            switch (matchClass ?? "").lowercased() {
            case "lobber": return "marge"
            case "zinger": return "quill"
            case "scatterjack": return "jax"
            case "delver": return "grub"
            case "boinker": return "bobbin"
            case "patcher": return "hetty"
            default: return nil
            }
        }

        /// The damage type id for `shell_card.damage_types`: mend, dig, pierce, fire or blast.
        var damageTypeId: String {
            if flight == "self" || hasSelfTarget { return "mend" }
            if flight == "dig" { return "dig" }
            switch dtype.lowercased() {
            case "pierce": return "pierce"
            case "fire": return "fire"
            case "crush": return "crush"
            default: return "blast"
            }
        }

        var damageTypeLabel: String { GameText.shared.t("shell_card.damage_types.\(damageTypeId)") }
    }

    /// The "Good at" line for a shot (`shell_card.good_at` with `shots.<id>.good_at`), or nil.
    func goodAt(_ id: String) -> String? {
        let text = GameText.shared
        guard let what = text.complete("shots.\(id).good_at") else { return nil }
        return text.t("shell_card.good_at", ["what": what])
    }

    struct WindRange: Sendable, Equatable {
        var min: Int
        var max: Int
    }

    struct WorkshopConfig: Sendable, Equatable {
        var budget = 72
        var cols = 8
        /// Total rows in the core including the Footing row (buildable rows = rows - 1).
        var rows = 10
        var maxNooks = 5
    }

    struct AppConfig: Sendable, Equatable {
        var windPresets: [String: WindRange] = [
            "off": WindRange(min: 0, max: 0),
            "light": WindRange(min: 0, max: 3),
            "full": WindRange(min: 0, max: 6),
        ]
        var workshop = WorkshopConfig()
        var walkCells = 4
        var rivalThinkSeconds = 1.0

        static let defaults = AppConfig()
    }

    static let shared = ContentCatalog.load()

    /// Only when content/blueprints.json is missing from the bundle: the Workshop always starts
    /// from `bp_home_3` in that file (content-pass-core, section 3). This is a plain box so a
    /// missing file is easy to spot.
    static let fallbackHomeRows = ["ttttttt", "t11t22t", "t11t22t", "ttttttt", "tKKt33t", "tKKt33t", "FFFFFFF"]
    static let fallbackKitNames = ["kit_oak": "Oak", "kit_stone": "Stone Skirt", "kit_reed": "Reed Roof"]

    /// Trail kind for a shot in flight (assets: fx_trail_{blast,pierce,dig,fire,mend}).
    func trailKind(_ id: String) -> String {
        if id.contains("mend") { return "mend" }
        guard let s = shots[id] else { return "blast" }
        if s.flight == "self" { return "mend" }
        if s.flight == "dig" { return "dig" }
        switch s.dtype {
        case "pierce": return "pierce"
        case "fire": return "fire"
        case "dig": return "dig"
        default: return s.flight == "beam" ? "pierce" : "blast"
        }
    }

    var region = GameText.shared.t("map.regions.downs.name")
    var levels: [Level]
    var maps: [MapChoice]
    var shots: [String: Shot]
    var appConfig: AppConfig = .defaults
    var homeBlueprintRows: [String] = ContentCatalog.fallbackHomeRows
    var kitNames: [String: String] = ContentCatalog.fallbackKitNames
    /// Hobs by content id (hobs.json).
    var hobs: [String: HobInfo] = [:]
    /// Classes by id: display name and role line (classes.json).
    var classes: [String: NamedCard] = [:]
    /// Doodads by id: display name and card line (doodads.json).
    var doodads: [String: NamedCard] = [:]

    func shotName(_ id: String) -> String {
        shots[id]?.name ?? id.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    /// A Doodad's name from doodads.json.
    func doodadName(_ id: String) -> String {
        doodads[id]?.name ?? id.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    /// A Class's display name from classes.json ("delver" is shown as Digger).
    func className(_ id: String) -> String {
        classes[id]?.name ?? id.capitalized
    }

    /// A Hob's short name for lines and chips (`hobs.<id>.short` in text.json).
    func hobShort(_ id: String, name: String = "") -> String {
        GameText.shared.hobShort(id, name: name.isEmpty ? (hobs[id]?.name ?? "") : name)
    }

    /// A Hob's short name from its full content name ("Old Thumper", "Marge Dumpling"), as the
    /// core sends it in `hob_name`. A name that is not a Hob is given back as it is.
    func hobShort(named name: String) -> String {
        guard let id = hobs.first(where: { $0.value.name == name })?.key else { return name }
        return GameText.shared.hobShort(id, name: name)
    }

    /// The Rival a Skirmish map fields for a seed, before the fight: `roster[seed % count]`.
    func skirmishRival(map: String, seed: UInt64) -> RosterEntry? {
        guard let roster = level(map)?.roster, !roster.isEmpty else { return nil }
        return roster[Int(seed % UInt64(roster.count))]
    }

    func kitName(_ key: String) -> String {
        let kitId = BattleSetup.kits[key] ?? key
        return kitNames[kitId] ?? Self.fallbackKitNames[kitId] ?? key
    }

    func windRange(for preset: String) -> WindRange {
        appConfig.windPresets[preset] ?? AppConfig.defaults.windPresets[preset] ?? WindRange(min: 0, max: 3)
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
                                 habit: l.habit, goals: l.goals, hasDraft: l.hasDraft, roundCap: l.roundCap,
                                 squall: l.squall, crewSize: l.crewSize))
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
            let seats = level.player?.crewSize ?? level.player?.crew?.count ?? 4
            let roster = (level.rival?.roster ?? []).map { RosterEntry(name: $0.name, thinkMs: $0.thinkMs) }
            let entry = Level(id: level.id, name: level.name, kind: level.type, rival: level.rival?.name ?? "",
                              habit: level.rival?.habit ?? "",
                              goals: (level.pennants ?? []).map { goalText($0, level: level.id, rival: level.rival?.name ?? "") },
                              hasDraft: (level.rules?.rummage?.pool ?? 0) > 0, roundCap: level.rules?.roundCap ?? 15,
                              squall: level.rules?.squall ?? true, crewSize: max(1, min(5, seats)),
                              thinkMs: level.rival?.thinkMs, roster: roster)
            if level.type == "skirmish" { skirmish.append(entry) } else { levels.append(entry) }
        }
        levels.sort { Self.order($0.id) < Self.order($1.id) }
        skirmish.sort { $0.id < $1.id }
        var shots: [String: Shot] = [:]
        if let url = bundle.url(forResource: "shots", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let list = try? JSONDecoder().decode([RawShot].self, from: data) {
            for s in list {
                let ops = (s.triggers ?? []).flatMap { $0.ops ?? [] }
                let dtype = ops.compactMap { $0.dtype }.first ?? "blast"
                let opDmg = ops.compactMap { $0.dmg }.max() ?? 0
                let selfHp = (s.selfEffects ?? []).compactMap { $0.hp }.max() ?? 0
                let damage = max(opDmg, max(s.flight?.blockDmg ?? 0, max(s.flight?.passDmg ?? 0, selfHp)))
                let band = ops.compactMap { $0.band }.first ?? ""
                let splitCount = ops.filter { $0.op == "split" }.compactMap { $0.count }.max() ?? 0
                shots[s.id] = Shot(name: s.name, weight: s.weight ?? "L", card: s.card ?? "",
                                   flight: s.flight?.kind ?? "arc", dtype: dtype,
                                   dud: s.dud ?? false, matchClass: s.matchClass,
                                   dials: s.dials ?? [], hasSelfTarget: !(s.selfEffects ?? []).isEmpty,
                                   kind: s.kind ?? "plain", damage: damage, band: band,
                                   maxCells: s.flight?.maxCells ?? 0, bounces: s.flight?.bounces ?? 0,
                                   splitCount: splitCount, tags: s.tags ?? [])
            }
        }
        var appConfig = AppConfig.defaults
        if let url = bundle.url(forResource: "app", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let rawApp = try? JSONDecoder().decode(RawApp.self, from: data) {
            if let wp = rawApp.windPresets {
                var parsed: [String: WindRange] = appConfig.windPresets
                for (k, v) in wp { parsed[k] = WindRange(min: v.min, max: v.max) }
                appConfig.windPresets = parsed
            }
            if let ws = rawApp.workshop {
                appConfig.workshop = WorkshopConfig(budget: ws.budget ?? 72, cols: ws.cols ?? 8,
                                                    rows: ws.rows ?? 10, maxNooks: ws.maxNooks ?? 5)
            }
            if let cells = rawApp.walk?.cells, cells > 0 { appConfig.walkCells = cells }
            if let secs = rawApp.rivalThinkSeconds, secs > 0 { appConfig.rivalThinkSeconds = secs }
        }
        var homeRows = fallbackHomeRows
        if let url = bundle.url(forResource: "blueprints", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let bps = try? JSONDecoder().decode([RawBlueprint].self, from: data),
           let home = bps.first(where: { $0.id == "bp_home_3" }), !home.rows.isEmpty {
            homeRows = home.rows
        }
        var hobs: [String: HobInfo] = [:]
        if let url = bundle.url(forResource: "hobs", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let list = try? JSONDecoder().decode([RawHob].self, from: data) {
            for h in list { hobs[h.id] = HobInfo(name: h.name, cls: h.cls ?? "") }
        }
        var classes: [String: NamedCard] = [:]
        if let url = bundle.url(forResource: "classes", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let list = try? JSONDecoder().decode([RawNamed].self, from: data) {
            for c in list { classes[c.id] = NamedCard(name: c.name, line: c.role ?? "") }
        }
        var doodads: [String: NamedCard] = [:]
        if let url = bundle.url(forResource: "doodads", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let list = try? JSONDecoder().decode([RawNamed].self, from: data) {
            for d in list { doodads[d.id] = NamedCard(name: d.name, line: d.card ?? "") }
        }
        for (id, shot) in shots {
            if let m = shot.matchClass, let cls = classes[m] { shots[id]?.matchClassName = cls.name }
        }
        var kitNames = fallbackKitNames
        if let url = bundle.url(forResource: "starter_box", withExtension: "json", subdirectory: "content"),
           let data = try? Data(contentsOf: url),
           let box = try? JSONDecoder().decode(RawStarterBox.self, from: data) {
            for kit in box.kits where !kit.name.isEmpty { kitNames[kit.id] = kit.name }
        }
        if levels.isEmpty { levels = fallbackLevels }
        if skirmish.isEmpty {
            let text = GameText.shared
            skirmish = ["d1", "d2"].map { id in
                Level(id: id, name: text.t("map.skirmish_maps.\(id)", or: id), kind: "skirmish", rival: "", habit: "",
                      goals: [], hasDraft: true, roundCap: 15, squall: true, crewSize: 4)
            }
        }
        var catalog = ContentCatalog(levels: levels, maps: skirmish.map { MapChoice(id: $0.id, name: $0.name) },
                                     shots: shots, appConfig: appConfig, homeBlueprintRows: homeRows, kitNames: kitNames)
        catalog.skirmishLevels = skirmish
        catalog.hobs = hobs
        catalog.classes = classes
        catalog.doodads = doodads
        return catalog
    }

    /// A Pennant's words (content/text.md, Goals): `levels.<L>.goals.<type>`, else `pennants.<type>`,
    /// else the text in the level file. `{n}` is the Pennant's value.
    private static func goalText(_ p: RawLevel.Pennant, level: String, rival: String) -> String {
        let text = GameText.shared
        guard let type = p.type, !type.isEmpty else { return p.text }
        var vars: [String: any CustomStringConvertible] = ["rival": text.rivalShort(rival)]
        if let n = p.value { vars["n"] = n }
        if let captive = text.complete("levels.\(level).captive") { vars["captive"] = captive }
        if let line = text.complete("levels.\(level).goals.\(type)", vars) { return line }
        if let line = text.complete("pennants.\(type)", vars) { return line }
        return p.text
    }

    /// "1-10" sorts after "1-9".
    static func order(_ id: String) -> Int {
        let parts = id.split(separator: "-").compactMap { Int($0) }
        return parts.count == 2 ? parts[0] * 100 + parts[1] : 10_000
    }

    /// Used only when the content folder is not in the bundle: ids, names and sizes only.
    /// Every line a player reads comes from content (naming-decisions.md, rule 3).
    static let fallbackLevels: [Level] = [
        fallback("1-1", "First Lump", "siege", cap: 8, squall: false, crew: 1),
        fallback("1-2", "Two Hats", "siege", cap: 10, squall: true, crew: 2),
        fallback("1-3", "Kettle on the Knoll", "siege", cap: 12, squall: true, crew: 2),
        fallback("1-4", "Breezy Tops", "siege", cap: 15, squall: true, crew: 3),
        fallback("1-5", "Under the Roof", "siege", cap: 15, squall: true, crew: 3),
        fallback("1-6", "Roof Trouble", "siege", cap: 15, squall: true, crew: 3),
        fallback("1-7", "Hetty in a Jam", "rescue", cap: 14, squall: false, crew: 4),
        fallback("1-8", "Rummage Sale", "siege", cap: 15, squall: true, crew: 4, draft: true),
        fallback("1-9", "Over Loaf Hill", "siege", cap: 14, squall: true, crew: 4, draft: true),
        fallback("1-10", "The Topiary Keep", "grand_fort", cap: 18, squall: true, crew: 4, draft: true),
    ]

    private static func fallback(_ id: String, _ name: String, _ kind: String, cap: Int, squall: Bool, crew: Int,
                                 draft: Bool = false) -> Level {
        Level(id: id, name: name, kind: kind, rival: "", habit: "", goals: [], hasDraft: draft,
              roundCap: cap, squall: squall, crewSize: crew)
    }
}

private struct RawLevel: Decodable {
    struct Player: Decodable {
        var crew: [String]?
        var crewSize: Int?

        private enum CodingKeys: String, CodingKey {
            case crew
            case crewSize = "crew_size"
        }
    }

    struct Rival: Decodable {
        struct Roster: Decodable {
            var name: String
            var thinkMs: Int?

            private enum CodingKeys: String, CodingKey {
                case name
                case thinkMs = "think_ms"
            }
        }
        var name: String?
        var habit: String?
        var thinkMs: Int?
        var roster: [Roster]?

        private enum CodingKeys: String, CodingKey {
            case name, habit, roster
            case thinkMs = "think_ms"
        }
    }

    struct Pennant: Decodable {
        var type: String?
        var text: String
        var value: Int?
    }

    struct Rules: Decodable {
        struct Rummage: Decodable { var pool: Int? }
        var roundCap: Int?
        var squall: Bool?
        var rummage: Rummage?

        private enum CodingKeys: String, CodingKey {
            case rummage, squall
            case roundCap = "round_cap"
        }
    }

    var id: String
    var name: String
    var type: String
    var player: Player?
    var rival: Rival?
    var pennants: [Pennant]?
    var rules: Rules?
}

private struct RawShot: Decodable {
    struct Flight: Decodable {
        var kind: String?
        var maxCells: Int?
        var blockDmg: Int?
        var bounces: Int?
        var passDmg: Int?

        private enum CodingKeys: String, CodingKey {
            case kind, bounces
            case maxCells = "max_cells"
            case blockDmg = "block_dmg"
            case passDmg = "pass_dmg"
        }
    }
    struct Op: Decodable {
        var op: String?
        var dtype: String?
        var dmg: Int?
        var band: String?
        var count: Int?
        var hp: Int?
    }
    struct Trigger: Decodable {
        var ops: [Op]?
        private enum CodingKeys: String, CodingKey { case ops = "do" }
    }

    var id: String
    var name: String
    var kind: String?
    var weight: String?
    var card: String?
    var dud: Bool?
    var matchClass: String?
    var dials: [String]?
    var tags: [String]?
    var selfEffects: [Op]?
    var flight: Flight?
    var triggers: [Trigger]?

    private enum CodingKeys: String, CodingKey {
        case id, name, kind, weight, card, dud, dials, tags, flight, triggers
        case matchClass = "match_class"
        case selfEffects = "self_effects"
    }
}

private struct RawApp: Decodable {
    struct Wind: Decodable { var min: Int; var max: Int }
    struct Workshop: Decodable {
        var budget: Int?
        var cols: Int?
        var rows: Int?
        var maxNooks: Int?

        private enum CodingKeys: String, CodingKey {
            case budget, cols, rows
            case maxNooks = "max_nooks"
        }
    }
    struct Walk: Decodable { var cells: Int? }

    var windPresets: [String: Wind]?
    var workshop: Workshop?
    var walk: Walk?
    var rivalThinkSeconds: Double?

    private enum CodingKeys: String, CodingKey {
        case workshop, walk
        case windPresets = "wind_presets"
        case rivalThinkSeconds = "rival_think_seconds"
    }
}

private struct RawBlueprint: Decodable {
    var id: String
    var rows: [String]
}

private struct RawStarterBox: Decodable {
    struct Kit: Decodable {
        var id: String
        var name: String
    }
    var kits: [Kit]
}

private struct RawHob: Decodable {
    var id: String
    var name: String
    var cls: String?

    private enum CodingKeys: String, CodingKey {
        case id, name
        case cls = "class"
    }
}

/// A class (`role`) or a Doodad (`card`): id, name and one line.
private struct RawNamed: Decodable {
    var id: String
    var name: String
    var role: String?
    var card: String?
}

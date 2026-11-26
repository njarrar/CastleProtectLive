import Foundation

// The wire types of the rules core, matching core/API.md and core/schema/
// field for field: the setup (level_json for cp_new), the commands
// (cp_command input), the replies and the frame snapshot (cp_snapshot).
//
// Core units: world cells, x right, y DOWN (y = 0 is the top of the sky).
// Angle in tenths of a degree, 0 right, 900 up, 1800 left. Power 0 to 100.
//
// Decoding is lenient (a missing field takes its default), so a newer core
// never crashes an older app. FrameAssembler turns these into the view model.

extension KeyedDecodingContainer {
    /// Decodes `key` if it is present and well formed, else returns `fallback`.
    func value<T: Decodable>(_ key: Key, _ fallback: T) -> T {
        (try? decodeIfPresent(T.self, forKey: key)) ?? fallback
    }
}

// MARK: Setup (setup.schema.json)

struct CoreWind: Codable, Equatable, Sendable {
    var min: Int?
    var max: Int?
    var fronts: [Int]?
    var frontRounds: Int?

    private enum CodingKeys: String, CodingKey {
        case min, max, fronts
        case frontRounds = "front_rounds"
    }
}

struct CoreRummage: Codable, Equatable, Sendable {
    var pool: Int?
    var picks: Int?
    var source: [String]?
}

struct CoreSideConfig: Codable, Equatable, Sendable {
    /// "human" or "ai".
    var control: String?
    /// "cozy", "fair", "stubborn".
    var preset: String?
    var crew: [String]?
    var blueprint: String?
    var rows: [String]?
    var doodads: [String]?
    /// Starter Box kit: "kit_oak", "kit_stone", "kit_reed".
    var kit: String?
    var name: String?
    var steam: Int?
    var aim: Int?
    /// Help handicap: "none", "some", "lots" (Steam from content/app.json).
    var help: String?
    /// Preview share 0 to 100 (Couch Duel handicap).
    var previewPct: Int?
    /// Seat only the first n Hobs (1 to 5).
    var crewSize: Int?

    init(control: String? = nil, preset: String? = nil, crew: [String]? = nil, blueprint: String? = nil,
         rows: [String]? = nil, doodads: [String]? = nil, kit: String? = nil, name: String? = nil,
         steam: Int? = nil, aim: Int? = nil, help: String? = nil, previewPct: Int? = nil, crewSize: Int? = nil) {
        self.control = control; self.preset = preset; self.crew = crew; self.blueprint = blueprint
        self.rows = rows; self.doodads = doodads; self.kit = kit; self.name = name
        self.steam = steam; self.aim = aim; self.help = help; self.previewPct = previewPct; self.crewSize = crewSize
    }

    private enum CodingKeys: String, CodingKey {
        case control, preset, crew, blueprint, rows, doodads, kit, name, steam, aim, help
        case previewPct = "preview_pct", crewSize = "crew_size"
    }
}

/// What the save holds for this level, so the core can work out `result.buttons`.
struct CoreProgress: Codable, Equatable, Sendable {
    var cleared = false
    var pennants: [Bool] = [false, false, false]
    var dailyPaid = false

    init(cleared: Bool = false, pennants: [Bool] = [false, false, false], dailyPaid: Bool = false) {
        self.cleared = cleared
        self.pennants = pennants
        self.dailyPaid = dailyPaid
    }

    private enum CodingKeys: String, CodingKey {
        case cleared, pennants
        case dailyPaid = "daily_paid"
    }
}

/// `first_turn`: 0, 1 or "coin".
enum CoreFirstTurn: Codable, Equatable, Sendable {
    case side(Int)
    case coin

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let n = try? c.decode(Int.self) { self = .side(n) } else { self = .coin }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .side(let n): try c.encode(n)
        case .coin: try c.encode("coin")
        }
    }
}

/// The battle setup, `level_json` for `cp_new`. Nil fields are left out, so the level rules apply.
struct CoreSetup: Codable, Equatable, Sendable {
    var level: String
    /// "campaign", "skirmish", "couch", "test_yard", "daily".
    var mode: String?
    var sides: [CoreSideConfig]?
    var firstTurn: CoreFirstTurn?
    var roundCap: Int?
    var squall: Bool?
    var wind: CoreWind?
    var rummage: CoreRummage?
    var puffUp: Bool?
    /// Volley Points: Actions per side (skirmish, daily, couch only).
    var volley: Int?
    /// The save's record of this level, for `result.buttons`.
    var progress: CoreProgress?
    /// Which try at this fight (0 the first, 1 the first Retry): the core mixes it into the
    /// seed, so a Retry is a new fight under the same rules. Ignored by the core in `daily`.
    var attempt: Int?

    init(level: String, mode: String? = nil, sides: [CoreSideConfig]? = nil, firstTurn: CoreFirstTurn? = nil,
         roundCap: Int? = nil, squall: Bool? = nil, wind: CoreWind? = nil, rummage: CoreRummage? = nil,
         puffUp: Bool? = nil, volley: Int? = nil, progress: CoreProgress? = nil, attempt: Int? = nil) {
        self.level = level; self.mode = mode; self.sides = sides; self.firstTurn = firstTurn
        self.roundCap = roundCap; self.squall = squall; self.wind = wind; self.rummage = rummage
        self.puffUp = puffUp; self.volley = volley; self.progress = progress; self.attempt = attempt
    }

    private enum CodingKeys: String, CodingKey {
        case level, mode, sides, squall, wind, rummage, volley, progress, attempt
        case firstTurn = "first_turn", roundCap = "round_cap", puffUp = "puff_up"
    }

    func jsonString() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(self) else { return #"{"level":"\#(level)"}"# }
        return String(decoding: data, as: UTF8.self)
    }
}

// MARK: Commands (command.schema.json)

/// Every command the core takes, with the exact field names of API.md.
/// Commands act for the side whose turn it is; draft commands act for `draft.next` unless `side` is given.
enum CoreCommand: Equatable, Sendable {
    // Rummage (phase draft)
    case pickShell(shell: String, side: Int? = nil)
    case quickPick(side: Int? = nil)
    case endDraft
    // Turn (phase plan)
    case pickHob(hob: Int)
    /// "plain", "knack" or a Trick Shell id in hand.
    case pickShot(shot: String)
    case aim(angle: Int?, power: Int?)
    /// Index among this side's ghosts.
    case recall(ghost: Int)
    /// Cells, + right, - left. 1 Steam per 4 cells.
    case walk(dx: Int)
    case shoveOff(hob: Int)
    case fire(dial: String? = nil, target: [Int]? = nil)
    case doodad(doodad: String, targets: [[Int]]? = nil, room: String? = nil)
    case pass
    case aiTurn(preset: String? = nil)
    /// End the battle now; the other side wins (`how: "give_up"`). Any phase but ended.
    case giveUp(side: Int? = nil)
    /// Test Yard only: the wind now and for every later front.
    case setWind(wind: Int)
    /// Only on a new battle: replays a saved log (the `log` reply's array, as JSON text).
    case resume(log: String)
    // Queries (change nothing)
    case leanLines(side: Int, c: Int, r: Int)
    case shimmer(side: Int)
    case validateBlueprint(rows: [String], seats: Int)
    case hash
    case log
    case terrainAll

    var name: String {
        switch self {
        case .pickShell: return "pick_shell"
        case .quickPick: return "quick_pick"
        case .endDraft: return "end_draft"
        case .pickHob: return "pick_hob"
        case .pickShot: return "pick_shot"
        case .aim: return "aim"
        case .recall: return "recall"
        case .walk: return "walk"
        case .shoveOff: return "shove_off"
        case .fire: return "fire"
        case .doodad: return "doodad"
        case .pass: return "pass"
        case .aiTurn: return "ai_turn"
        case .giveUp: return "give_up"
        case .setWind: return "set_wind"
        case .resume: return "resume"
        case .leanLines: return "lean_lines"
        case .shimmer: return "shimmer"
        case .validateBlueprint: return "validate_blueprint"
        case .hash: return "hash"
        case .log: return "log"
        case .terrainAll: return "terrain_all"
        }
    }

    /// The command as a JSON object, keys sorted so the bytes are stable.
    func jsonObject() -> [String: Any] {
        var o: [String: Any] = ["cmd": name]
        switch self {
        case .pickShell(let shell, let side):
            o["shell"] = shell
            if let side { o["side"] = side }
        case .quickPick(let side):
            if let side { o["side"] = side }
        case .pickHob(let hob), .shoveOff(let hob):
            o["hob"] = hob
        case .pickShot(let shot):
            o["shot"] = shot
        case .aim(let angle, let power):
            if let angle { o["angle"] = min(1800, max(0, angle)) }
            if let power { o["power"] = min(100, max(0, power)) }
        case .recall(let ghost):
            o["ghost"] = ghost
        case .walk(let dx):
            o["dx"] = dx
        case .fire(let dial, let target):
            if let dial { o["dial"] = dial }
            if let target { o["target"] = target }
        case .doodad(let doodad, let targets, let room):
            o["doodad"] = doodad
            if let targets { o["targets"] = targets }
            if let room { o["room"] = room }
        case .aiTurn(let preset):
            if let preset { o["preset"] = preset }
        case .giveUp(let side):
            if let side { o["side"] = side }
        case .setWind(let wind):
            o["wind"] = min(10, max(-10, wind))
        case .resume(let log):
            o["log"] = (try? JSONSerialization.jsonObject(with: Data(log.utf8))) as? [Any] ?? []
        case .leanLines(let side, let c, let r):
            o["side"] = side
            o["c"] = c
            o["r"] = r
        case .shimmer(let side):
            o["side"] = side
        case .validateBlueprint(let rows, let seats):
            o["rows"] = rows
            o["seats"] = seats
        case .endDraft, .pass, .hash, .log, .terrainAll:
            break
        }
        return o
    }

    func jsonString() -> String {
        if case .resume(let log) = self {
            // The log goes back byte for byte as the core wrote it.
            let body = log.trimmingCharacters(in: .whitespacesAndNewlines)
            return #"{"cmd":"resume","log":"# + (body.hasPrefix("[") ? body : "[]") + "}"
        }
        guard let data = try? JSONSerialization.data(withJSONObject: jsonObject(), options: [.sortedKeys]) else {
            return #"{"cmd":"\#(name)"}"#
        }
        return String(decoding: data, as: UTF8.self)
    }
}

// MARK: Replies (reply.schema.json)

struct CoreReply: Decodable, Equatable, Sendable {
    var ok: Bool
    var reason: String?
    var detail: String?
    var canFire: Bool?
    var angle: Int?
    var power: Int?
    var moved: Int?
    var steam: Int?
    var hash: String?
    /// `resume`: commands replayed; `bad_log`: the entry that failed.
    var applied: Int?
    var index: Int?
    /// `fire` refusals (rules 3): the shot that could not go, its Hob, and the shot that would
    /// (`"plain"`, or nil). `pick_shot` and `pick_hob`: `shot` is the pick now.
    var shot: String?
    var hob: Int?
    var readyShot: String?
    /// `pick_shot` and `pick_hob`: whether `fire` would take the pick, why not, and in plain words.
    var ready: Bool?
    var why: String?
    var text: String?
    /// `validate_blueprint`: Buttons cost, blocks used against the budget, the budget, the
    /// structured problem id, and the cells to mark (`[c, r]`, row 0 the Footing) when refused.
    var cost: Int?
    var used: Int?
    var budget: Int?
    var cells: [[Int]]?
    var problem: String?

    /// The handle is dead (a panic, or every call after one): rebuild with cp_new and resume.
    var isDeadHandle: Bool { reason == "panic" || reason == "dead_handle" }

    init(ok: Bool, reason: String? = nil) {
        self.ok = ok
        self.reason = reason
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        ok = c.value(.ok, false)
        reason = c.value(.reason, nil)
        detail = c.value(.detail, nil)
        canFire = c.value(.canFire, nil)
        angle = c.value(.angle, nil)
        power = c.value(.power, nil)
        moved = c.value(.moved, nil)
        steam = c.value(.steam, nil)
        hash = c.value(.hash, nil)
        applied = c.value(.applied, nil)
        index = c.value(.index, nil)
        shot = c.value(.shot, nil)
        hob = c.value(.hob, nil)
        readyShot = c.value(.readyShot, nil)
        ready = c.value(.ready, nil)
        why = c.value(.why, nil)
        text = c.value(.text, nil)
        cost = c.value(.cost, nil)
        used = c.value(.used, nil)
        budget = c.value(.budget, nil)
        cells = c.value(.cells, nil)
        problem = c.value(.problem, nil)
    }

    static func decode(_ json: String) -> CoreReply {
        (try? JSONDecoder().decode(CoreReply.self, from: Data(json.utf8))) ?? CoreReply(ok: false, reason: "bad_reply")
    }

    private enum CodingKeys: String, CodingKey {
        case ok, reason, detail, angle, power, moved, steam, hash, applied, index, shot, hob, ready, why, text
        case cost, used, budget, cells, problem
        case canFire = "can_fire", readyShot = "ready_shot"
    }
}

// MARK: Snapshot (snapshot.schema.json)

struct CoreMap: Decodable, Equatable, Sendable {
    var w = 2400
    var h = 720
    var chunk = 64

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        w = max(1, c.value(.w, 2400))
        h = max(1, c.value(.h, 720))
        chunk = max(1, c.value(.chunk, 64))
    }

    private enum CodingKeys: String, CodingKey { case w, h, chunk }
}

struct CoreTerrainChunk: Decodable, Equatable, Sendable {
    var cx = 0, cy = 0, x = 0, y = 0, w = 0, h = 0
    /// Base64 of w * h bytes, row major; each byte a terrain material code (0 air).
    var data = ""

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        cx = c.value(.cx, 0); cy = c.value(.cy, 0)
        x = c.value(.x, 0); y = c.value(.y, 0)
        w = c.value(.w, 0); h = c.value(.h, 0)
        data = c.value(.data, "")
    }

    private enum CodingKeys: String, CodingKey { case cx, cy, x, y, w, h, data }
}

struct CoreTerrain: Decodable, Equatable, Sendable {
    var chunks: [CoreTerrainChunk] = []

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        chunks = c.value(.chunks, [])
    }

    private enum CodingKeys: String, CodingKey { case chunks }
}

struct CoreBlock: Decodable, Equatable, Sendable {
    var c = 0, r = 0, x = 0, y = 0
    var mat = "timber"
    var hp = 1, max = 1
    var peephole = false, root = false, battered = false

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        c = k.value(.c, 0); r = k.value(.r, 0); x = k.value(.x, 0); y = k.value(.y, 0)
        mat = k.value(.mat, "timber")
        hp = k.value(.hp, 1); max = Swift.max(1, k.value(.max, 1))
        peephole = k.value(.peephole, false); root = k.value(.root, false); battered = k.value(.battered, false)
    }

    private enum CodingKeys: String, CodingKey { case c, r, x, y, mat, hp, max, peephole, root, battered }
}

struct CoreRoom: Decodable, Equatable, Sendable {
    var kind = "nook"
    var id = 0, c = 0, r = 0
    /// [x0, y0, x1, y1] inclusive.
    var box: [Int] = []
    var intact = true, flap = false, lid = false
    var loophole: [Int] = []

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        kind = k.value(.kind, "nook"); id = k.value(.id, 0); c = k.value(.c, 0); r = k.value(.r, 0)
        box = k.value(.box, []); intact = k.value(.intact, true); flap = k.value(.flap, false)
        lid = k.value(.lid, false); loophole = k.value(.loophole, [])
    }

    private enum CodingKeys: String, CodingKey { case kind, id, c, r, box, intact, flap, lid, loophole }
}

struct CoreKettle: Decodable, Equatable, Sendable {
    var hp = 300, max = 300
    var box: [Int] = []
    var room: [Int] = []
    var c = 0, r = 0
    var lid = false, intact = true

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        hp = k.value(.hp, 300); max = Swift.max(1, k.value(.max, 300))
        box = k.value(.box, []); room = k.value(.room, [])
        c = k.value(.c, 0); r = k.value(.r, 0)
        lid = k.value(.lid, false); intact = k.value(.intact, true)
    }

    private enum CodingKeys: String, CodingKey { case hp, max, box, room, c, r, lid, intact }
}

struct CoreCastle: Decodable, Equatable, Sendable {
    var side = 0
    /// Left edge of the fort and the bottom of the Footing.
    var x = 0, baseY = 0
    var cols = 0, rows = 0, block = 16
    var blocks: [CoreBlock] = []
    var rooms: [CoreRoom] = []
    var kettle = CoreKettle()
    var steam = 0, steamTurn = 0
    var shimmer: [[Int]] = []
    var held: [[Int]] = []
    /// True from round 10: battered blocks reach one block less to the side.
    var fatigue = false

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        side = k.value(.side, 0); x = k.value(.x, 0); baseY = k.value(.baseY, 0)
        cols = k.value(.cols, 0); rows = k.value(.rows, 0); block = k.value(.block, 16)
        blocks = k.value(.blocks, []); rooms = k.value(.rooms, []); kettle = k.value(.kettle, CoreKettle())
        steam = k.value(.steam, 0); steamTurn = k.value(.steamTurn, 0)
        shimmer = k.value(.shimmer, []); held = k.value(.held, [])
        fatigue = k.value(.fatigue, false)
    }

    private enum CodingKeys: String, CodingKey {
        case side, x, cols, rows, block, blocks, rooms, kettle, steam, shimmer, held, fatigue
        case baseY = "base_y", steamTurn = "steam_turn"
    }
}

struct CoreAim: Decodable, Equatable, Sendable {
    var angle = 450
    var power = 60

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        angle = k.value(.angle, 450); power = k.value(.power, 60)
    }

    private enum CodingKeys: String, CodingKey { case angle, power }
}

struct CoreHob: Decodable, Equatable, Sendable {
    var id = 0, side = 0
    var def = "", name = "", cls = "lobber"
    var hp = 1, max = 1
    /// seated, open, dropped, tumbled, squashed, bonked.
    var state = "seated"
    var nook: Int?
    /// The Hob's feet.
    var x = 0, y = 0
    var rest = 0
    var knack: String?
    var knackUses = 0
    var plain = "clodpot"
    var buried = false, cover = false, dummy = false, grudge = false, clatter = false
    var canFire = false
    var aim = CoreAim()

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        id = k.value(.id, 0); side = k.value(.side, 0)
        def = k.value(.def, ""); name = k.value(.name, ""); cls = k.value(.cls, "lobber")
        hp = k.value(.hp, 1); max = Swift.max(1, k.value(.max, 1))
        state = k.value(.state, "seated"); nook = k.value(.nook, nil)
        x = k.value(.x, 0); y = k.value(.y, 0); rest = k.value(.rest, 0)
        knack = k.value(.knack, nil); knackUses = k.value(.knackUses, 0); plain = k.value(.plain, "clodpot")
        buried = k.value(.buried, false); cover = k.value(.cover, false); dummy = k.value(.dummy, false)
        grudge = k.value(.grudge, false); clatter = k.value(.clatter, false)
        canFire = k.value(.canFire, false); aim = k.value(.aim, CoreAim())
    }

    private enum CodingKeys: String, CodingKey {
        case id, side, def, name, hp, max, state, nook, x, y, rest, knack, plain, buried, cover, dummy, grudge, clatter, aim
        case cls = "class", knackUses = "knack_uses", canFire = "can_fire"
    }
}

/// A thing on the field: a Tick-Tock Crock or turnip (`kind` "shell"), a cage bar, the captive.
struct CoreProp: Decodable, Equatable, Sendable {
    var id = 0
    /// 0 or 1, or 2 for a level object.
    var side = 2
    /// "shell", "cage_bar", "captive" (a newer core may send others).
    var kind = ""
    var tag = ""
    var x = 0, y = 0
    var hp = 1, max = 1
    /// The shot id of a shell prop (Crock, turnip), else nil.
    var shot: String?

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        id = k.value(.id, 0); side = k.value(.side, 2); kind = k.value(.kind, ""); tag = k.value(.tag, "")
        x = k.value(.x, 0); y = k.value(.y, 0)
        hp = k.value(.hp, 1); max = Swift.max(1, k.value(.max, 1)); shot = k.value(.shot, nil)
    }

    private enum CodingKeys: String, CodingKey { case id, side, kind, tag, x, y, hp, max, shot }
}

/// A shell in flight, sent compact as `[id, x, y, rot, shot]`.
struct CoreShell: Decodable, Equatable, Sendable {
    var id = 0, x = 0, y = 0
    /// Flight direction in tenths of a degree.
    var rot = 0
    var shot = ""

    init(id: Int, x: Int, y: Int, rot: Int, shot: String) {
        self.id = id; self.x = x; self.y = y; self.rot = rot; self.shot = shot
    }

    init(from decoder: Decoder) throws {
        var u = try decoder.unkeyedContainer()
        id = (try? u.decode(Int.self)) ?? 0
        x = (try? u.decode(Int.self)) ?? 0
        y = (try? u.decode(Int.self)) ?? 0
        rot = (try? u.decode(Int.self)) ?? 0
        shot = (try? u.decode(String.self)) ?? ""
    }
}

struct CoreGhost: Decodable, Equatable, Sendable {
    var index = 0, side = 0, hob = 0
    var shot = ""
    var angle = 0, power = 0, round = 0
    var pin: [Int]?
    var selfHit = false, recalled = false
    var points: [[Int]] = []
    /// Optional core-computed miss distance in blocks (negative = short, positive = long, 0/nil = hit or older core).
    var missBlocks: Int?

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        index = k.value(.index, 0); side = k.value(.side, 0); hob = k.value(.hob, 0)
        shot = k.value(.shot, ""); angle = k.value(.angle, 0); power = k.value(.power, 0); round = k.value(.round, 0)
        pin = k.value(.pin, nil); selfHit = k.value(.selfHit, false); recalled = k.value(.recalled, false)
        points = k.value(.points, []); missBlocks = k.value(.missBlocks, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case index, side, hob, shot, angle, power, round, pin, recalled, points
        case selfHit = "self_hit", missBlocks = "miss_blocks"
    }
}

struct CoreCrewPip: Decodable, Equatable, Sendable {
    var id = 0, hpPct = 100, rest = 0
    var state = "seated", cls = "lobber"

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        id = k.value(.id, 0); hpPct = k.value(.hpPct, 100); rest = k.value(.rest, 0)
        state = k.value(.state, "seated"); cls = k.value(.cls, "lobber")
    }

    private enum CodingKeys: String, CodingKey {
        case id, rest, state
        case hpPct = "hp_pct", cls = "class"
    }
}

struct CoreHandShell: Decodable, Equatable, Sendable {
    var id = "", name = ""
    var match: String?
    /// "L", "M" or "H" (Light, Medium, Heavy).
    var weight = "L"
    var dud = false
    var card = ""

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        id = k.value(.id, ""); name = k.value(.name, ""); match = k.value(.match, nil)
        weight = k.value(.weight, "L"); dud = k.value(.dud, false); card = k.value(.card, "")
    }

    /// Weight cogs shown on chips: 0 Light, 1 Medium, 2 Heavy.
    static func cogs(_ weight: String) -> Int {
        switch weight.uppercased() {
        case "M": return 1
        case "H": return 2
        default: return 0
        }
    }

    private enum CodingKeys: String, CodingKey { case id, name, match, weight, dud, card }
}

struct CoreSelected: Decodable, Equatable, Sendable {
    var hob = 0
    var shot = "plain"

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        hob = k.value(.hob, 0); shot = k.value(.shot, "plain")
    }

    private enum CodingKeys: String, CodingKey { case hob, shot }
}

/// `hud.shots[]`: a shot chip for the selected Hob, with whether `fire` would take it.
struct CoreShotState: Decodable, Equatable, Sendable {
    /// "plain", "knack" or a shell id: what `pick_shot` takes.
    var shot = ""
    /// The shot id (sprite and name).
    var id = ""
    var ready = true
    /// What `fire` would refuse with, or nil.
    var why: String?
    /// The same in plain words ("Marge Dumpling needs a rest: Plain Shot only"), or nil.
    var text: String?

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        shot = k.value(.shot, ""); id = k.value(.id, ""); ready = k.value(.ready, true); why = k.value(.why, nil)
        text = k.value(.text, nil)
    }

    private enum CodingKeys: String, CodingKey { case shot, id, ready, why, text }
}

/// `hud.fire` (rules 3): whether Fire may be lit for the selected shot, and why not.
struct CoreFireState: Decodable, Equatable, Sendable {
    var ready = false
    var why: String?
    var text: String?

    init(ready: Bool, why: String? = nil, text: String? = nil) {
        self.ready = ready; self.why = why; self.text = text
    }

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        ready = k.value(.ready, false); why = k.value(.why, nil); text = k.value(.text, nil)
    }

    private enum CodingKeys: String, CodingKey { case ready, why, text }
}

/// `hud.handicap[side]`: shown openly (Couch Duel house rule 6).
struct CoreHandicap: Decodable, Equatable, Sendable {
    var help = "none"
    var steam = 100
    var previewPct = 30
    var crew = 0

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        help = k.value(.help, "none"); steam = k.value(.steam, 100)
        previewPct = k.value(.previewPct, 30); crew = k.value(.crew, 0)
    }

    private enum CodingKeys: String, CodingKey {
        case help, steam, crew
        case previewPct = "preview_pct"
    }
}

/// `hud.volley`: "Shots left 7/10".
struct CoreVolley: Decodable, Equatable, Sendable {
    var actions = 0
    var left: [Int] = [0, 0]

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        actions = k.value(.actions, 0); left = k.value(.left, [0, 0])
    }

    private enum CodingKeys: String, CodingKey { case actions, left }
}

/// `hud.boss`: the 1-10 phases, the roller and the shears.
struct CoreBoss: Decodable, Equatable, Sendable {
    var phase = 1
    var roller: CoreProp?
    var rollerDone = false
    var shears: CoreProp?
    /// The red cut line `[x0, y0, x1, y1]`, one boss turn before the snip.
    var cut: [Int]?
    var jam = 0

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        phase = k.value(.phase, 1); roller = k.value(.roller, nil); rollerDone = k.value(.rollerDone, false)
        shears = k.value(.shears, nil); cut = k.value(.cut, nil); jam = k.value(.jam, 0)
    }

    private enum CodingKeys: String, CodingKey {
        case phase, roller, shears, cut, jam
        case rollerDone = "roller_done"
    }
}

/// `hud.rules`: the level's objective (Rescue) and cap rule.
struct CoreRules: Decodable, Equatable, Sendable {
    var objectiveTag: String?
    var objectiveCount = 0
    var capWin: Int?

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        struct Objective: Decodable { var tag: String?; var count: Int? }
        let o: Objective? = k.value(.objective, nil)
        objectiveTag = o?.tag; objectiveCount = o?.count ?? 0
        capWin = k.value(.capWin, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case objective
        case capWin = "cap_win"
    }
}

struct CoreHud: Decodable, Equatable, Sendable {
    var turn = 0, round = 1, roundCap = 15, side = 0
    var wind = 0, forecast = 0, frontRoundsLeft = 0
    var steam: [Int] = [0, 0]
    var steamTurnLeft = 40
    var kettlePct: [Int] = [100, 100]
    var crew: [[CoreCrewPip]] = [[], []]
    var squallWarning: Int?
    var squallRound = 0
    var squall = false
    var hands: [[CoreHandShell]] = [[], []]
    var doodads: [[String]] = [[], []]
    var selected = CoreSelected()
    var names: [String] = ["Left", "Right"]
    var control: [String] = ["human", "ai"]
    var score: [Int] = [0, 0]
    var puffUp: [Bool] = [false, false]
    /// Steam at the start per side (the bar's 100%).
    var steamMax: [Int] = []
    var shoveOffCost = 15
    var shots: [CoreShotState] = []
    var handicap: [CoreHandicap] = []
    var volley: CoreVolley?
    var boss: CoreBoss?
    var rules = CoreRules()
    /// Rules 3: the Fire button state; nil from an older core.
    var fire: CoreFireState?
    /// Rules 3: Fatigue is on, the round it starts, and rounds until it starts (nil once on,
    /// and in Volley Points and the Test Yard).
    var fatigue = false
    var fatigueRound = 10
    var fatigueIn: Int?
    /// `[player, rival]` think pose in ms (content `rival.think_ms`), null entries when unset.
    var thinkMs: [Int?] = []

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        thinkMs = k.value(.thinkMs, [Int?]())
        steamMax = k.value(.steamMax, []); shoveOffCost = k.value(.shoveOffCost, 15)
        shots = k.value(.shots, []); handicap = k.value(.handicap, [])
        volley = k.value(.volley, nil); boss = k.value(.boss, nil); rules = k.value(.rules, CoreRules())
        fire = k.value(.fire, nil); fatigue = k.value(.fatigue, false)
        fatigueRound = k.value(.fatigueRound, 10); fatigueIn = k.value(.fatigueIn, nil)
        turn = k.value(.turn, 0); round = k.value(.round, 1); roundCap = k.value(.roundCap, 15); side = k.value(.side, 0)
        wind = k.value(.wind, 0); forecast = k.value(.forecast, 0); frontRoundsLeft = k.value(.frontRoundsLeft, 0)
        steam = k.value(.steam, [0, 0]); steamTurnLeft = k.value(.steamTurnLeft, 40)
        kettlePct = k.value(.kettlePct, [100, 100]); crew = k.value(.crew, [[], []])
        squallWarning = k.value(.squallWarning, nil); squallRound = k.value(.squallRound, 0); squall = k.value(.squall, false)
        hands = k.value(.hands, [[], []]); doodads = k.value(.doodads, [[], []])
        selected = k.value(.selected, CoreSelected())
        names = k.value(.names, ["Left", "Right"]); control = k.value(.control, ["human", "ai"])
        score = k.value(.score, [0, 0]); puffUp = k.value(.puffUp, [false, false])
    }

    private enum CodingKeys: String, CodingKey {
        case turn, round, side, wind, forecast, steam, crew, squall, hands, doodads, selected, names, control, score
        case shots, handicap, volley, boss, rules, fire, fatigue
        case fatigueRound = "fatigue_round", fatigueIn = "fatigue_in", thinkMs = "think_ms"
        case steamMax = "steam_max", shoveOffCost = "shove_off_cost"
        case roundCap = "round_cap", frontRoundsLeft = "front_rounds_left", steamTurnLeft = "steam_turn_left"
        case kettlePct = "kettle_pct", squallWarning = "squall_warning", squallRound = "squall_round", puffUp = "puff_up"
    }
}

struct CoreDraft: Decodable, Equatable, Sendable {
    var pool: [String] = []
    var picks: [[String]] = [[], []]
    var next = 0
    var picksEach = 2
    var wish: String?

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        pool = k.value(.pool, []); picks = k.value(.picks, [[], []]); next = k.value(.next, 0)
        picksEach = k.value(.picksEach, 2); wish = k.value(.wish, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case pool, picks, next, wish
        case picksEach = "picks_each"
    }
}

/// `result.best_shot` and `stats[i].best_shot` (rules 3): the shot of one side that dealt the
/// most damage to the other side.
struct CoreBestShot: Decodable, Equatable, Sendable {
    var side = 0, hob = 0
    var hobName = "", shot = "", shotName = ""
    var angle = 0, power = 0, round = 0, dmg = 0

    init(side: Int, hob: Int = 0, hobName: String = "", shot: String = "", shotName: String = "",
         angle: Int = 0, power: Int = 0, round: Int = 0, dmg: Int = 0) {
        self.side = side; self.hob = hob; self.hobName = hobName; self.shot = shot; self.shotName = shotName
        self.angle = angle; self.power = power; self.round = round; self.dmg = dmg
    }

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        side = k.value(.side, 0); hob = k.value(.hob, 0)
        hobName = k.value(.hobName, ""); shot = k.value(.shot, ""); shotName = k.value(.shotName, "")
        angle = k.value(.angle, 0); power = k.value(.power, 0); round = k.value(.round, 0); dmg = k.value(.dmg, 0)
    }

    private enum CodingKeys: String, CodingKey {
        case side, hob, shot, angle, power, round, dmg
        case hobName = "hob_name", shotName = "shot_name"
    }
}

/// Per side battle stats in the result.
struct CoreStats: Decodable, Equatable, Sendable {
    var shots = 0, hits = 0, blocksDropped = 0, bonks = 0, blocksLost = 0, kettleLost = 0, hobsLost = 0, bestStreak = 0
    /// This side's best shot (rules 3), or nil.
    var bestShot: CoreBestShot?

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        shots = k.value(.shots, 0); hits = k.value(.hits, 0); blocksDropped = k.value(.blocksDropped, 0)
        bonks = k.value(.bonks, 0); blocksLost = k.value(.blocksLost, 0); kettleLost = k.value(.kettleLost, 0)
        hobsLost = k.value(.hobsLost, 0); bestStreak = k.value(.bestStreak, 0)
        bestShot = k.value(.bestShot, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case shots, hits, bonks
        case bestShot = "best_shot"
        case blocksDropped = "blocks_dropped", blocksLost = "blocks_lost", kettleLost = "kettle_lost"
        case hobsLost = "hobs_lost", bestStreak = "best_streak"
    }
}

/// One blow in "what broke you".
struct CoreBlow: Decodable, Equatable, Sendable {
    var shot = "", shotName = "", hobName = ""
    var hob: Int?
    var round = 0, dmg = 0
    /// Who dealt it (rules 4): `hob`, or the field: `squall`, `ground`, `fatigue`, `self`,
    /// `shears`, `prop`. An older core sends none: then a Hob id means `hob`.
    var by = ""

    init(shot: String = "", shotName: String = "", hobName: String = "", hob: Int? = nil, round: Int = 0,
         dmg: Int = 0, by: String = "") {
        self.shot = shot; self.shotName = shotName; self.hobName = hobName; self.hob = hob
        self.round = round; self.dmg = dmg; self.by = by
    }

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        shot = k.value(.shot, ""); shotName = k.value(.shotName, ""); hobName = k.value(.hobName, "")
        hob = k.value(.hob, nil); round = k.value(.round, 0); dmg = k.value(.dmg, 0)
        by = k.value(.by, "")
    }

    /// True when a Hob dealt the blow (`by: "hob"`, or a Hob id from a core without `by`).
    var byHob: Bool { by.isEmpty ? hob != nil : by == "hob" }

    private enum CodingKeys: String, CodingKey {
        case shot, hob, round, dmg, by
        case shotName = "shot_name", hobName = "hob_name"
    }
}

/// `result.broke`: what broke the losing side.
struct CoreBroke: Decodable, Equatable, Sendable {
    var side = 0
    var how = ""
    var last: CoreBlow?
    var top: [CoreBlow] = []
    var kettleLost = 0, blocksLost = 0, hobsBonked = 0

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        side = k.value(.side, 0); how = k.value(.how, ""); last = k.value(.last, nil); top = k.value(.top, [])
        kettleLost = k.value(.kettleLost, 0); blocksLost = k.value(.blocksLost, 0); hobsBonked = k.value(.hobsBonked, 0)
    }

    private enum CodingKeys: String, CodingKey {
        case side, how, last, top
        case kettleLost = "kettle_lost", blocksLost = "blocks_lost", hobsBonked = "hobs_bonked"
    }
}

struct CoreResult: Decodable, Equatable, Sendable {
    var winner = 0
    /// clean_sweep, kettle_pop, squall, double_pop, rescue, round_cap, total_hp, give_up, volley_points, captive_bonked.
    var how = ""
    var round = 0
    var pennants: [Bool] = []
    /// Pennants earned now that the save did not hold.
    var pennantsNew: [Bool] = []
    /// Buttons the player (side 0) earns, worked out by the core.
    var buttons = 0
    var score: [Int] = []
    var stats: [CoreStats] = []
    var broke: CoreBroke?
    /// The winner's best shot (rules 3): what "Best shot" shows, never a shot of the losing side.
    var bestShot: CoreBestShot?

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        winner = k.value(.winner, 0); how = k.value(.how, ""); round = k.value(.round, 0); pennants = k.value(.pennants, [])
        pennantsNew = k.value(.pennantsNew, []); buttons = k.value(.buttons, 0)
        score = k.value(.score, []); stats = k.value(.stats, []); broke = k.value(.broke, nil)
        bestShot = k.value(.bestShot, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case winner, how, round, pennants, buttons, score, stats, broke
        case pennantsNew = "pennants_new", bestShot = "best_shot"
    }
}

/// A `[c, r]` or `[c, r, mat]` entry of an event list (collapse blocks, mends).
struct CoreCell: Decodable, Equatable, Sendable {
    var c = 0
    var r = 0
    var mat: String?

    init(c: Int, r: Int, mat: String? = nil) { self.c = c; self.r = r; self.mat = mat }

    init(from decoder: Decoder) throws {
        var u = try decoder.unkeyedContainer()
        c = (try? u.decode(Int.self)) ?? 0
        r = (try? u.decode(Int.self)) ?? 0
        mat = u.isAtEnd ? nil : (try? u.decode(String.self))
    }
}

/// One event. Every event has `t` and `tick`; the other fields depend on `t` (API.md, events).
struct CoreEvent: Decodable, Equatable, Sendable {
    var t = ""
    var tick = 0
    var side: Int?
    var hob: Int?
    var x: Int?
    var y: Int?
    var r: Int?
    var dmg: Int?
    var n: Int?
    var round: Int?
    var target: String?
    var winner: Int?
    var how: String?
    var text: String?
    var shell: String?
    var shot: String?
    var callout: Bool?
    var threaded: Bool?
    /// Block grid cell (`hit` on a block, `break`, `regrow`).
    var c: Int?
    var type: String?
    var why: String?
    var kind: String?
    var state: String?
    var room: String?
    var nook: Int?
    var phase: Int?
    var cells: Int?
    var hp: Int?
    var turns: Int?
    var wind: Int?
    /// `mend`: the Doodad id when triggered by Mend Bucket, else nil (self-mend shot).
    var doodad: String?
    /// `collapse` and `mend`: the cells; `big_drop` sends a count instead (`blockCount`).
    var blocks: [CoreCell]?
    var blockCount: Int?
    /// `collapse`: cells each column fell, `[[c, cells]]`.
    var falls: [[Int]]?
    /// `walk` and `drop`: points; `roller_move`: x values.
    var from: [Int]?
    var to: [Int]?
    var fromX: Int?
    var toX: Int?
    /// `shot_switch`: the shot the pick moved from and to (`"plain"`), and when
    /// (`turn_start` or `pick_hob`).
    var fromShot: String?
    var toShot: String?
    var when: String?

    init(t: String) { self.t = t }

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        t = k.value(.t, ""); tick = k.value(.tick, 0)
        side = k.value(.side, nil); hob = k.value(.hob, nil)
        x = k.value(.x, nil); y = k.value(.y, nil); r = k.value(.r, nil)
        dmg = k.value(.dmg, nil); n = k.value(.n, nil); round = k.value(.round, nil)
        target = k.value(.target, nil); winner = k.value(.winner, nil); how = k.value(.how, nil)
        text = k.value(.text, nil); shell = k.value(.shell, nil); shot = k.value(.shot, nil)
        callout = k.value(.callout, nil); threaded = k.value(.threaded, nil)
        c = k.value(.c, nil); type = k.value(.type, nil); why = k.value(.why, nil); kind = k.value(.kind, nil)
        state = k.value(.state, nil); nook = k.value(.nook, nil); phase = k.value(.phase, nil)
        cells = k.value(.cells, nil); hp = k.value(.hp, nil); turns = k.value(.turns, nil); wind = k.value(.wind, nil)
        doodad = k.value(.doodad, nil)
        // `room` is "kettle" or "nook:N" on a lid, a number elsewhere.
        let roomText: String? = k.value(.room, nil)
        let roomNumber: Int? = k.value(.room, nil)
        room = roomText ?? roomNumber.map { "nook:\($0)" }
        blocks = k.value(.blocks, nil)
        blockCount = k.value(.blocks, nil)
        falls = k.value(.falls, nil)
        from = k.value(.from, nil); to = k.value(.to, nil)
        let fx: Int? = k.value(.from, nil)
        let tx: Int? = k.value(.to, nil)
        fromX = fx; toX = tx
        fromShot = k.value(.from, nil); toShot = k.value(.to, nil); when = k.value(.when, nil)
    }

    private enum CodingKeys: String, CodingKey {
        case t, tick, side, hob, x, y, r, dmg, n, round, target, winner, how, text, shell, shot, callout, threaded
        case c, type, why, kind, state, room, nook, phase, cells, hp, turns, wind, doodad, blocks, falls, from, to, when
    }
}

/// `aim` on a lean snapshot after an `aim` command.
struct CoreLeanAim: Decodable, Equatable, Sendable {
    var side = 0, hob = 0, angle = 450, power = 60

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        side = k.value(.side, 0); hob = k.value(.hob, 0); angle = k.value(.angle, 450); power = k.value(.power, 60)
    }

    private enum CodingKeys: String, CodingKey { case side, hob, angle, power }
}

/// The frame snapshot. A lean snapshot (`full == false`) carries only tick,
/// phase, side, awaiting, terrain, shells and events; keep the rest from the last full one.
struct CoreSnapshot: Decodable, Equatable, Sendable {
    var tick = 0
    /// draft, plan, resolve, settle, ended.
    var phase = "plan"
    var side = 0
    /// human, ai or none.
    var awaiting = "none"
    var full = true
    var level = ""
    var mode = ""
    var map = CoreMap()
    var terrain = CoreTerrain()
    var castles: [CoreCastle] = []
    var hobs: [CoreHob] = []
    var shells: [CoreShell] = []
    var props: [CoreProp] = []
    var preview: [[Int]] = []
    var ghosts: [CoreGhost] = []
    var hud = CoreHud()
    var draft: CoreDraft?
    var events: [CoreEvent] = []
    var result: CoreResult?
    var hash = ""
    /// Lean snapshots after `aim`: the new aim (preview comes in `preview`).
    var aim: CoreLeanAim?
    /// A snapshot or step reply with `"ok": false` is an error (dead handle, panic).
    var ok: Bool?
    var reason: String?

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        tick = k.value(.tick, 0); phase = k.value(.phase, "plan"); side = k.value(.side, 0)
        awaiting = k.value(.awaiting, "none"); full = k.value(.full, true)
        level = k.value(.level, ""); mode = k.value(.mode, "")
        map = k.value(.map, CoreMap()); terrain = k.value(.terrain, CoreTerrain())
        castles = k.value(.castles, []); hobs = k.value(.hobs, []); shells = k.value(.shells, [])
        props = k.value(.props, [])
        preview = k.value(.preview, []); ghosts = k.value(.ghosts, []); hud = k.value(.hud, CoreHud())
        draft = k.value(.draft, nil); events = k.value(.events, []); result = k.value(.result, nil)
        hash = k.value(.hash, "")
        aim = k.value(.aim, nil)
        ok = k.value(.ok, nil); reason = k.value(.reason, nil)
    }

    static func decode(_ json: String) -> CoreSnapshot? {
        try? JSONDecoder().decode(CoreSnapshot.self, from: Data(json.utf8))
    }

    private enum CodingKeys: String, CodingKey {
        case tick, phase, side, awaiting, full, level, mode, map, terrain, castles, hobs, shells, props
        case preview, ghosts, hud, draft, events, result, hash, aim, ok, reason
    }
}

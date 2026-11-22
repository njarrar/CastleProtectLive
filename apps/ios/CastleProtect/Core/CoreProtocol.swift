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
    /// "campaign", "skirmish", "couch", "test_yard".
    var mode: String?
    var sides: [CoreSideConfig]?
    var firstTurn: CoreFirstTurn?
    var roundCap: Int?
    var squall: Bool?
    var wind: CoreWind?
    var rummage: CoreRummage?
    var puffUp: Bool?

    private enum CodingKeys: String, CodingKey {
        case level, mode, sides, squall, wind, rummage
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
    }

    static func decode(_ json: String) -> CoreReply {
        (try? JSONDecoder().decode(CoreReply.self, from: Data(json.utf8))) ?? CoreReply(ok: false, reason: "bad_reply")
    }

    private enum CodingKeys: String, CodingKey {
        case ok, reason, detail, angle, power, moved, steam, hash
        case canFire = "can_fire"
    }
}

// MARK: Snapshot (snapshot.schema.json)

struct CoreMap: Decodable, Equatable, Sendable {
    var w = 2400
    var h = 720
    var chunk = 256

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        w = max(1, c.value(.w, 2400))
        h = max(1, c.value(.h, 720))
        chunk = max(1, c.value(.chunk, 256))
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
    var peephole = false, root = false

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        c = k.value(.c, 0); r = k.value(.r, 0); x = k.value(.x, 0); y = k.value(.y, 0)
        mat = k.value(.mat, "timber")
        hp = k.value(.hp, 1); max = Swift.max(1, k.value(.max, 1))
        peephole = k.value(.peephole, false); root = k.value(.root, false)
    }

    private enum CodingKeys: String, CodingKey { case c, r, x, y, mat, hp, max, peephole, root }
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

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        side = k.value(.side, 0); x = k.value(.x, 0); baseY = k.value(.baseY, 0)
        cols = k.value(.cols, 0); rows = k.value(.rows, 0); block = k.value(.block, 16)
        blocks = k.value(.blocks, []); rooms = k.value(.rooms, []); kettle = k.value(.kettle, CoreKettle())
        steam = k.value(.steam, 0); steamTurn = k.value(.steamTurn, 0)
        shimmer = k.value(.shimmer, []); held = k.value(.held, [])
    }

    private enum CodingKeys: String, CodingKey {
        case side, x, cols, rows, block, blocks, rooms, kettle, steam, shimmer, held
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

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        index = k.value(.index, 0); side = k.value(.side, 0); hob = k.value(.hob, 0)
        shot = k.value(.shot, ""); angle = k.value(.angle, 0); power = k.value(.power, 0); round = k.value(.round, 0)
        pin = k.value(.pin, nil); selfHit = k.value(.selfHit, false); recalled = k.value(.recalled, false)
        points = k.value(.points, [])
    }

    private enum CodingKeys: String, CodingKey {
        case index, side, hob, shot, angle, power, round, pin, recalled, points
        case selfHit = "self_hit"
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

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
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

struct CoreResult: Decodable, Equatable, Sendable {
    var winner = 0
    /// clean_sweep, kettle_pop, squall, double_pop, rescue, round_cap, total_hp.
    var how = ""
    var round = 0
    var pennants: [Bool] = []

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        winner = k.value(.winner, 0); how = k.value(.how, ""); round = k.value(.round, 0); pennants = k.value(.pennants, [])
    }

    private enum CodingKeys: String, CodingKey { case winner, how, round, pennants }
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
    }

    private enum CodingKeys: String, CodingKey {
        case t, tick, side, hob, x, y, r, dmg, n, round, target, winner, how, text, shell, shot, callout, threaded
    }
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
    var preview: [[Int]] = []
    var ghosts: [CoreGhost] = []
    var hud = CoreHud()
    var draft: CoreDraft?
    var events: [CoreEvent] = []
    var result: CoreResult?
    var hash = ""

    init() {}

    init(from decoder: Decoder) throws {
        let k = try decoder.container(keyedBy: CodingKeys.self)
        tick = k.value(.tick, 0); phase = k.value(.phase, "plan"); side = k.value(.side, 0)
        awaiting = k.value(.awaiting, "none"); full = k.value(.full, true)
        level = k.value(.level, ""); mode = k.value(.mode, "")
        map = k.value(.map, CoreMap()); terrain = k.value(.terrain, CoreTerrain())
        castles = k.value(.castles, []); hobs = k.value(.hobs, []); shells = k.value(.shells, [])
        preview = k.value(.preview, []); ghosts = k.value(.ghosts, []); hud = k.value(.hud, CoreHud())
        draft = k.value(.draft, nil); events = k.value(.events, []); result = k.value(.result, nil)
        hash = k.value(.hash, "")
    }

    static func decode(_ json: String) -> CoreSnapshot? {
        try? JSONDecoder().decode(CoreSnapshot.self, from: Data(json.utf8))
    }

    private enum CodingKeys: String, CodingKey {
        case tick, phase, side, awaiting, full, level, mode, map, terrain, castles, hobs, shells
        case preview, ghosts, hud, draft, events, result, hash
    }
}

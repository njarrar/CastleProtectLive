import Foundation

// The typed view of what the rules core sends back. This is the one file that
// knows the JSON field names, so a change in core/API.md is a change here only.
//
// World units are cells: x grows to the right, y grows up from the map floor.
// Angles are tenths of a degree (0 right, 900 straight up, 1800 left).
// Power runs 0 to 100.
//
// Every field decodes leniently: a missing or odd field takes its default, so
// a newer core never crashes an older app and the reverse.

extension KeyedDecodingContainer {
    /// Decodes `key` if it is present and well formed, else returns `fallback`.
    func value<T: Decodable>(_ key: Key, _ fallback: T) -> T {
        (try? decodeIfPresent(T.self, forKey: key)) ?? fallback
    }
}

enum BattlePhase: String, Sendable, Equatable {
    case none, draft, plan, flight, resolve, handoff, ended

    init(coreName: String) {
        switch coreName {
        case "pre", "draft": self = .draft
        case "plan", "aim": self = .plan
        case "flight": self = .flight
        case "resolve": self = .resolve
        case "handoff": self = .handoff
        case "ended", "end": self = .ended
        default: self = .none
        }
    }

    /// A shell is up or the field is settling: the HUD clusters slide off.
    var isResolving: Bool { self == .flight || self == .resolve }
}

struct WorldSize: Decodable, Equatable, Sendable {
    var w: Double = 2400
    var h: Double = 720

    init(w: Double = 2400, h: Double = 720) {
        self.w = w
        self.h = h
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        w = max(1, c.value(.w, 2400.0))
        h = max(1, c.value(.h, 720.0))
    }

    private enum CodingKeys: String, CodingKey { case w, h }
}

struct BlockView: Decodable, Equatable, Sendable {
    var x: Double = 0
    var y: Double = 0
    var w: Double = 16
    var h: Double = 16
    var material: String = "timber"
    var hp: Int = 1
    var hpMax: Int = 1
    var shimmer: Bool = false

    init(x: Double, y: Double, w: Double = 16, h: Double = 16, material: String, hp: Int, hpMax: Int, shimmer: Bool = false) {
        self.x = x; self.y = y; self.w = w; self.h = h
        self.material = material; self.hp = hp; self.hpMax = hpMax; self.shimmer = shimmer
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        x = c.value(.x, 0.0); y = c.value(.y, 0.0)
        w = c.value(.w, 16.0); h = c.value(.h, 16.0)
        material = c.value(.material, "timber")
        hp = c.value(.hp, 1); hpMax = max(1, c.value(.hpMax, 1))
        shimmer = c.value(.shimmer, false)
    }

    private enum CodingKeys: String, CodingKey {
        case x, y, w, h, hp, shimmer
        case material = "mat"
        case hpMax = "hp_max"
    }
}

struct HobView: Decodable, Equatable, Sendable, Identifiable {
    var id: String = ""
    var name: String = ""
    var cls: String = "lobber"
    var hp: Int = 1
    var hpMax: Int = 1
    var x: Double = 0
    var y: Double = 0
    var bonked: Bool = false
    var rest: Int = 0
    var state: String = "ready"

    init(id: String, name: String, cls: String, hp: Int, hpMax: Int, x: Double, y: Double,
         bonked: Bool = false, rest: Int = 0, state: String = "ready") {
        self.id = id; self.name = name; self.cls = cls; self.hp = hp; self.hpMax = hpMax
        self.x = x; self.y = y; self.bonked = bonked; self.rest = rest; self.state = state
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.value(.id, "")
        name = c.value(.name, "")
        cls = c.value(.cls, "lobber")
        hp = c.value(.hp, 1); hpMax = max(1, c.value(.hpMax, 1))
        x = c.value(.x, 0.0); y = c.value(.y, 0.0)
        bonked = c.value(.bonked, false)
        rest = c.value(.rest, 0)
        state = c.value(.state, bonked ? "bonked" : "ready")
    }

    var hpFraction: Double { Double(max(0, hp)) / Double(max(1, hpMax)) }

    private enum CodingKeys: String, CodingKey {
        case id, name, hp, x, y, bonked, rest, state
        case cls = "class"
        case hpMax = "hp_max"
    }
}

struct FortView: Decodable, Equatable, Sendable {
    var side: Int = 0
    var x: Double = 0
    var kettleX: Double = 0
    var kettleY: Double = 0
    var kettleHp: Int = 300
    var kettleMax: Int = 300
    var blocks: [BlockView] = []
    var hobs: [HobView] = []

    init(side: Int, x: Double, kettleX: Double, kettleY: Double, kettleHp: Int, kettleMax: Int,
         blocks: [BlockView], hobs: [HobView]) {
        self.side = side; self.x = x; self.kettleX = kettleX; self.kettleY = kettleY
        self.kettleHp = kettleHp; self.kettleMax = kettleMax; self.blocks = blocks; self.hobs = hobs
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        side = c.value(.side, 0)
        x = c.value(.x, 0.0)
        kettleX = c.value(.kettleX, 0.0); kettleY = c.value(.kettleY, 0.0)
        kettleHp = c.value(.kettleHp, 300); kettleMax = max(1, c.value(.kettleMax, 300))
        blocks = c.value(.blocks, [])
        hobs = c.value(.hobs, [])
    }

    /// Kettle HP as a whole percent, rounded up so 1 HP never reads 0%.
    var kettlePercent: Int {
        let hp = max(0, kettleHp)
        return (hp * 100 + kettleMax - 1) / max(1, kettleMax)
    }

    private enum CodingKeys: String, CodingKey {
        case side, x, blocks, hobs
        case kettleX = "kettle_x", kettleY = "kettle_y"
        case kettleHp = "kettle_hp", kettleMax = "kettle_max"
    }
}

struct ShotChip: Decodable, Equatable, Sendable, Identifiable {
    var id: String = ""
    var name: String = ""
    var kind: String = "plain"
    /// -1 means endless.
    var uses: Int = -1
    var weight: Int = 0
    var best: Bool = false
    var ready: Bool = true

    init(id: String, name: String, kind: String = "plain", uses: Int = -1, weight: Int = 0, best: Bool = false, ready: Bool = true) {
        self.id = id; self.name = name; self.kind = kind; self.uses = uses
        self.weight = weight; self.best = best; self.ready = ready
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.value(.id, "")
        name = c.value(.name, "")
        kind = c.value(.kind, "plain")
        uses = c.value(.uses, -1)
        weight = c.value(.weight, 0)
        best = c.value(.best, false)
        ready = c.value(.ready, uses != 0)
    }

    private enum CodingKeys: String, CodingKey { case id, name, kind, uses, weight, best, ready }
}

struct AimView: Decodable, Equatable, Sendable {
    var angle: Int = 450
    var power: Int = 50
    var set: Bool = false

    init(angle: Int = 450, power: Int = 50, set: Bool = false) {
        self.angle = angle; self.power = power; self.set = set
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        angle = c.value(.angle, 450)
        power = c.value(.power, 50)
        set = c.value(.set, false)
    }

    private enum CodingKeys: String, CodingKey { case angle, power, set }
}

struct PinView: Decodable, Equatable, Sendable {
    var x: Double = 0
    var y: Double = 0
    var side: Int = 0
    var round: Int = 0
    var spent: Bool = false
    var hob: String = ""

    init(x: Double, y: Double, side: Int, round: Int, spent: Bool = false, hob: String = "") {
        self.x = x; self.y = y; self.side = side; self.round = round; self.spent = spent; self.hob = hob
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        x = c.value(.x, 0.0); y = c.value(.y, 0.0)
        side = c.value(.side, 0); round = c.value(.round, 0)
        spent = c.value(.spent, false)
        hob = c.value(.hob, "")
    }

    private enum CodingKeys: String, CodingKey { case x, y, side, round, spent, hob }
}

struct ShellView: Decodable, Equatable, Sendable {
    var x: Double = 0
    var y: Double = 0
    var kind: String = ""

    init(x: Double, y: Double, kind: String = "") {
        self.x = x; self.y = y; self.kind = kind
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        x = c.value(.x, 0.0); y = c.value(.y, 0.0)
        kind = c.value(.kind, "")
    }

    private enum CodingKeys: String, CodingKey { case x, y, kind }
}

struct DraftChip: Decodable, Equatable, Sendable, Identifiable {
    var id: String = ""
    var name: String = ""
    var weight: Int = 0
    var hint: String = ""
    var bestWith: String = ""
    var dud: Bool = false
    /// -1 while still in the pool, else the side that took it.
    var takenBy: Int = -1

    init(id: String, name: String, weight: Int = 0, hint: String = "", bestWith: String = "", dud: Bool = false, takenBy: Int = -1) {
        self.id = id; self.name = name; self.weight = weight; self.hint = hint
        self.bestWith = bestWith; self.dud = dud; self.takenBy = takenBy
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.value(.id, "")
        name = c.value(.name, "")
        weight = c.value(.weight, 0)
        hint = c.value(.hint, "")
        bestWith = c.value(.bestWith, "")
        dud = c.value(.dud, false)
        takenBy = c.value(.takenBy, -1)
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, weight, hint, dud
        case bestWith = "best_with", takenBy = "taken_by"
    }
}

struct DraftView: Decodable, Equatable, Sendable {
    var pool: [DraftChip] = []
    var picksEach: Int = 2
    /// The side whose pick it is.
    var turn: Int = 0
    var hands: [[String]] = [[], []]
    /// The shell the Rival wants next, shown as a small eye tag.
    var wish: String?
    var done: Bool = false

    init(pool: [DraftChip], picksEach: Int = 2, turn: Int = 0, hands: [[String]] = [[], []], wish: String? = nil, done: Bool = false) {
        self.pool = pool; self.picksEach = picksEach; self.turn = turn
        self.hands = hands; self.wish = wish; self.done = done
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pool = c.value(.pool, [])
        picksEach = c.value(.picksEach, 2)
        turn = c.value(.turn, 0)
        hands = c.value(.hands, [[], []])
        let w: String? = c.value(.wish, nil)
        wish = (w?.isEmpty ?? true) ? nil : w
        done = c.value(.done, false)
    }

    func hand(_ side: Int) -> [String] { side < hands.count ? hands[side] : [] }

    private enum CodingKeys: String, CodingKey {
        case pool, turn, hands, wish, done
        case picksEach = "picks_each"
    }
}

struct GoalView: Decodable, Equatable, Sendable {
    var label: String = ""
    var done: Bool = false

    init(label: String, done: Bool) {
        self.label = label; self.done = done
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        label = c.value(.label, "")
        done = c.value(.done, false)
    }

    private enum CodingKeys: String, CodingKey { case label, done }
}

struct BattleResult: Decodable, Equatable, Sendable {
    /// Winning side, or -1 for none.
    var winner: Int = -1
    /// "clean_sweep", "kettle_pop", "squall", "doze_off", "give_up"...
    var reason: String = ""
    var pennants: Int = 0
    var buttons: Int = 0
    var round: Int = 0
    var goals: [GoalView] = []

    init(winner: Int, reason: String, pennants: Int = 0, buttons: Int = 0, round: Int = 0, goals: [GoalView] = []) {
        self.winner = winner; self.reason = reason; self.pennants = pennants
        self.buttons = buttons; self.round = round; self.goals = goals
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        winner = c.value(.winner, -1)
        reason = c.value(.reason, "")
        pennants = c.value(.pennants, 0)
        buttons = c.value(.buttons, 0)
        round = c.value(.round, 0)
        goals = c.value(.goals, [])
    }

    private enum CodingKeys: String, CodingKey { case winner, reason, pennants, buttons, round, goals }
}

struct HandoffView: Decodable, Equatable, Sendable {
    var line: String = ""
    var toSide: Int = 0

    init(line: String, toSide: Int) {
        self.line = line; self.toSide = toSide
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        line = c.value(.line, "")
        toSide = c.value(.toSide, 0)
    }

    private enum CodingKeys: String, CodingKey {
        case line
        case toSide = "to_side"
    }
}

/// One thing that happened since the last snapshot. Apps react; they never write state.
struct CoreEvent: Decodable, Equatable, Sendable {
    /// "turn", "fire", "hit", "break", "fall", "bonk", "kettle_pop", "squall",
    /// "squall_warn", "end", "audio", "haptic", "announce".
    var type: String = ""
    /// Audio cue id or haptic kind, for "audio" and "haptic" events.
    var cue: String = ""
    var side: Int = -1
    var x: Double = 0
    var y: Double = 0
    var amount: Int = 0
    /// Plain text for "announce" (screen reader) events.
    var text: String = ""

    init(type: String, cue: String = "", side: Int = -1, x: Double = 0, y: Double = 0, amount: Int = 0, text: String = "") {
        self.type = type; self.cue = cue; self.side = side
        self.x = x; self.y = y; self.amount = amount; self.text = text
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = c.value(.type, "")
        cue = c.value(.cue, "")
        side = c.value(.side, -1)
        x = c.value(.x, 0.0); y = c.value(.y, 0.0)
        amount = c.value(.amount, 0)
        text = c.value(.text, "")
    }

    private enum CodingKeys: String, CodingKey { case type, cue, side, x, y, amount, text }
}

/// One frame of the battle as the core sees it.
struct BattleSnapshot: Decodable, Equatable, Sendable {
    var tick: Int = 0
    var phase: BattlePhase = .none
    var mode: String = ""
    var level: String = ""
    var round: Int = 1
    var roundCap: Int = 15
    /// Rounds until the Sudden Squall, or -1 when no warning shows.
    var squallIn: Int = -1
    /// Squall round (1 to 3) once the storm is on, else 0.
    var squallRound: Int = 0
    var activeSide: Int = 0
    /// Grows by one at every turn start. The app autosaves when it changes.
    var turnSeq: Int = 0
    var wind: Int = 0
    var forecast: Int = 0
    var names: [String] = ["You", "Rival"]
    var humans: [Bool] = [true, false]
    var world: WorldSize = WorldSize()
    /// Ground height per column, evenly spaced across the world width.
    var terrain: [Double] = []
    var forts: [FortView] = []
    var selectedHob: String?
    var shots: [ShotChip] = []
    var selectedShot: String?
    var aim: AimView = AimView()
    var canFire: Bool = false
    var dugIn: Bool = false
    var steam: Int = 0
    var steamTurn: Int = 0
    var steamMax: Int = 100
    var speed: Int = 1
    /// Flat x, y pairs of the 30% preview dots.
    var preview: [Double] = []
    var pins: [PinView] = []
    var shells: [ShellView] = []
    var draft: DraftView?
    var result: BattleResult?
    var handoff: HandoffView?
    var events: [CoreEvent] = []

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tick = c.value(.tick, 0)
        phase = BattlePhase(coreName: c.value(.phase, ""))
        mode = c.value(.mode, "")
        level = c.value(.level, "")
        round = c.value(.round, 1)
        roundCap = c.value(.roundCap, 15)
        squallIn = c.value(.squallIn, -1)
        squallRound = c.value(.squallRound, 0)
        activeSide = c.value(.activeSide, 0)
        turnSeq = c.value(.turnSeq, 0)
        wind = c.value(.wind, 0)
        forecast = c.value(.forecast, 0)
        names = c.value(.names, ["You", "Rival"])
        humans = c.value(.humans, [true, false])
        world = c.value(.world, WorldSize())
        terrain = c.value(.terrain, [])
        let decodedForts: [FortView] = c.value(.forts, [])
        forts = decodedForts.sorted { $0.side < $1.side }
        selectedHob = Self.nonEmpty(c.value(.selectedHob, nil))
        shots = c.value(.shots, [])
        selectedShot = Self.nonEmpty(c.value(.selectedShot, nil))
        aim = c.value(.aim, AimView())
        canFire = c.value(.canFire, false)
        dugIn = c.value(.dugIn, false)
        steam = c.value(.steam, 0)
        steamTurn = c.value(.steamTurn, 0)
        steamMax = max(1, c.value(.steamMax, 100))
        speed = c.value(.speed, 1)
        preview = c.value(.preview, [])
        pins = c.value(.pins, [])
        shells = c.value(.shells, [])
        draft = c.value(.draft, nil)
        result = c.value(.result, nil)
        handoff = c.value(.handoff, nil)
        events = c.value(.events, [])
    }

    static func decode(_ data: Data) throws -> BattleSnapshot {
        try JSONDecoder().decode(BattleSnapshot.self, from: data)
    }

    private static func nonEmpty(_ s: String?) -> String? {
        guard let s, !s.isEmpty else { return nil }
        return s
    }

    func fort(_ side: Int) -> FortView? { forts.first { $0.side == side } }
    func name(_ side: Int) -> String { side < names.count ? names[side] : (side == 0 ? "You" : "Rival") }
    func isHuman(_ side: Int) -> Bool { side < humans.count ? humans[side] : side == 0 }

    /// True when a person, not the AI, may act right now.
    var humanTurn: Bool { phase == .plan && isHuman(activeSide) }

    /// True in a Couch Duel (two people on one device).
    var isDuel: Bool { mode == "duel" || humans.filter { $0 }.count >= 2 }

    /// Ground height at world x, linear between samples.
    func groundAt(_ x: Double) -> Double {
        guard !terrain.isEmpty else { return 0 }
        guard terrain.count > 1 else { return terrain[0] }
        let f = min(max(x / world.w, 0), 1) * Double(terrain.count - 1)
        let i = min(max(Int(f), 0), terrain.count - 2)
        let t = f - Double(i)
        return terrain[i] * (1 - t) + terrain[i + 1] * t
    }

    private enum CodingKeys: String, CodingKey {
        case tick, phase, mode, level, round, wind, forecast, names, humans, world, terrain, forts
        case shots, aim, steam, speed, preview, pins, shells, draft, result, handoff, events
        case roundCap = "round_cap", squallIn = "squall_in", squallRound = "squall_round"
        case activeSide = "active_side", turnSeq = "turn_seq"
        case selectedHob = "selected_hob", selectedShot = "selected_shot"
        case canFire = "can_fire", dugIn = "dug_in"
        case steamTurn = "steam_turn", steamMax = "steam_max"
    }
}

/// A node on the campaign map, from the core's "campaign" query.
struct LevelInfo: Decodable, Equatable, Sendable, Identifiable, Hashable {
    var id: String = ""
    var name: String = ""
    /// "siege", "rescue", "grand_fort"...
    var kind: String = "siege"
    /// "done", "next", "open", "locked".
    var state: String = "locked"
    var pennants: Int = 0
    var rival: String = ""
    var habit: String = ""
    var goals: [String] = []
    var hasDraft: Bool = false
    var roundCap: Int = 15

    init(id: String, name: String, kind: String = "siege", state: String = "locked", pennants: Int = 0,
         rival: String = "", habit: String = "", goals: [String] = [], hasDraft: Bool = false, roundCap: Int = 15) {
        self.id = id; self.name = name; self.kind = kind; self.state = state; self.pennants = pennants
        self.rival = rival; self.habit = habit; self.goals = goals; self.hasDraft = hasDraft; self.roundCap = roundCap
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.value(.id, "")
        name = c.value(.name, "")
        kind = c.value(.kind, "siege")
        state = c.value(.state, "locked")
        pennants = c.value(.pennants, 0)
        rival = c.value(.rival, "")
        habit = c.value(.habit, "")
        goals = c.value(.goals, [])
        hasDraft = c.value(.hasDraft, false)
        roundCap = c.value(.roundCap, 15)
    }

    var isLocked: Bool { state == "locked" }
    var number: String { id.split(separator: "-").last.map(String.init) ?? id }

    private enum CodingKeys: String, CodingKey {
        case id, name, kind, state, pennants, rival, habit, goals
        case hasDraft = "has_draft", roundCap = "round_cap"
    }
}

struct CampaignView: Decodable, Equatable, Sendable {
    var region: String = "Puddingstone Downs"
    var levels: [LevelInfo] = []

    init(region: String, levels: [LevelInfo]) {
        self.region = region; self.levels = levels
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        region = c.value(.region, "Puddingstone Downs")
        levels = c.value(.levels, [])
    }

    private enum CodingKeys: String, CodingKey { case region, levels }
}

/// The answer to every command.
struct CommandReply: Decodable, Equatable, Sendable {
    var ok: Bool
    var reason: String?

    init(ok: Bool, reason: String? = nil) {
        self.ok = ok; self.reason = reason
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        ok = c.value(.ok, false)
        let r: String? = c.value(.reason, nil)
        let e: String? = c.value(.error, nil)
        reason = r ?? e
    }

    static func decode(_ data: Data) -> CommandReply {
        (try? JSONDecoder().decode(CommandReply.self, from: data)) ?? CommandReply(ok: false, reason: "bad_reply")
    }

    private enum CodingKeys: String, CodingKey { case ok, reason, error }
}

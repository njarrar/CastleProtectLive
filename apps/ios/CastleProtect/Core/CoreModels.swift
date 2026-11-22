import Foundation

// The view model the HUD and the battle view draw from. FrameAssembler builds
// it from the core's snapshot (CoreProtocol.swift). Nothing here is a rule.
//
// World units are cells with y UP from the map floor (the core sends y down;
// the assembler flips it once), so SpriteKit can use them as they are.

enum BattlePhase: String, Sendable, Equatable {
    case none, draft, plan, flight, resolve, handoff, ended

    /// A shell is up or the field is settling: the HUD clusters slide off.
    var isResolving: Bool { self == .flight || self == .resolve }
}

struct WorldSize: Equatable, Sendable {
    var w: Double = 2400
    var h: Double = 720
}

struct BlockView: Equatable, Sendable {
    var x: Double
    var y: Double
    var w: Double = 16
    var h: Double = 16
    var material: String
    var hp: Int
    var hpMax: Int
    var shimmer = false
}

struct HobView: Equatable, Sendable, Identifiable {
    /// The core's Hob id as text (pick_hob takes the number).
    var id: String
    /// Content id ("marge"), used to pick the sprites.
    var def: String = ""
    var name: String
    var cls: String
    var hp: Int
    var hpMax: Int
    /// Feet position.
    var x: Double
    var y: Double
    var bonked = false
    var rest = 0
    var state = "seated"
    var buried = false

    var hpFraction: Double { Double(max(0, hp)) / Double(max(1, hpMax)) }
}

struct FortView: Equatable, Sendable {
    var side: Int
    /// Centre of the fort.
    var x: Double
    /// Bottom centre of the kettle.
    var kettleX: Double
    var kettleY: Double
    var kettleHp: Int
    var kettleMax: Int
    var blocks: [BlockView]
    var hobs: [HobView]

    /// Kettle HP as a whole percent, rounded up so 1 HP never reads 0%.
    var kettlePercent: Int {
        let hp = max(0, kettleHp)
        return (hp * 100 + kettleMax - 1) / max(1, kettleMax)
    }
}

struct ShotChip: Equatable, Sendable, Identifiable {
    /// "plain", "knack" or a Trick Shell id: what pick_shot takes.
    var id: String
    var name: String
    /// "plain", "knack", "shell".
    var kind: String = "plain"
    /// Shot id for the icon ("clodpot", "grand_dumpling", "marble_sack").
    var art: String = ""
    /// -1 means endless.
    var uses: Int = -1
    var weight: Int = 0
    var best: Bool = false
    var ready: Bool = true
}

struct AimView: Equatable, Sendable {
    var angle: Int = 450
    var power: Int = 60
    var set: Bool = true
}

struct PinView: Equatable, Sendable {
    var x: Double
    var y: Double
    var side: Int
    var round: Int
    var spent = false
    var hob = ""
}

struct ShellView: Equatable, Sendable {
    var x: Double
    var y: Double
    var kind: String = ""
}

struct DraftChip: Equatable, Sendable, Identifiable {
    var id: String
    var name: String
    var weight: Int = 0
    var hint: String = ""
    var bestWith: String = ""
    var dud: Bool = false
    /// -1 while still in the pool, else the side that took it.
    var takenBy: Int = -1
}

struct DraftView: Equatable, Sendable {
    var pool: [DraftChip]
    var picksEach: Int = 2
    /// The side whose pick it is.
    var turn: Int = 0
    var hands: [[String]] = [[], []]
    /// Name of the shell the Rival wants.
    var wish: String?
    var done: Bool = false

    func hand(_ side: Int) -> [String] { side < hands.count ? hands[side] : [] }
}

struct GoalView: Equatable, Sendable {
    var label: String
    var done: Bool
}

struct BattleResult: Equatable, Sendable {
    /// Winning side, or -1 for none.
    var winner: Int
    /// The core's `how`: clean_sweep, kettle_pop, squall, double_pop, rescue, round_cap, total_hp.
    var reason: String
    var pennants: Int = 0
    var buttons: Int = 0
    var round: Int = 0
    var goals: [GoalView] = []
}

struct HandoffView: Equatable, Sendable {
    var line: String
    var toSide: Int
}

/// One thing that happened, in the app's words, for sound, haptics and the screen reader.
struct BattleEvent: Equatable, Sendable {
    /// "turn", "fire", "hit" (a burst, with x and y), "damage", "break", "fall",
    /// "bonk", "kettle_pop", "squall_warn", "squall", "end", or the core's own `t`.
    var type: String
    var side: Int = -1
    var x: Double = 0
    var y: Double = 0
    var amount: Int = 0
    var text: String = ""
}

/// One frame of the battle, ready to draw.
struct BattleSnapshot: Equatable, Sendable {
    var tick = 0
    var phase: BattlePhase = .none
    /// "campaign", "skirmish", "duel", "test_yard".
    var mode = ""
    var level = ""
    var round = 1
    var roundCap = 15
    /// Rounds until the Sudden Squall, or -1 when no warning shows.
    var squallIn = -1
    /// Squall round (1 to 3) once the storm is on, else 0.
    var squallRound = 0
    var activeSide = 0
    /// The core's turn counter. The app autosaves when it changes.
    var turnSeq = 0
    var wind = 0
    var forecast = 0
    var names = ["You", "Rival"]
    var humans = [true, false]
    var world = WorldSize()
    /// Ground height per column, evenly spaced across the world width.
    var terrain: [Double] = []
    var forts: [FortView] = []
    var selectedHob: String?
    var shots: [ShotChip] = []
    var selectedShot: String?
    var aim = AimView()
    var canFire = false
    var dugIn = false
    var steam = 0
    var steamTurn = 0
    var steamMax = 100
    var speed = 1
    /// Flat x, y pairs of the preview dots.
    var preview: [Double] = []
    var pins: [PinView] = []
    /// Ghost count per side, for Recall.
    var ghostCount = [0, 0]
    var shells: [ShellView] = []
    var draft: DraftView?
    var result: BattleResult?
    var handoff: HandoffView?
    var events: [BattleEvent] = []

    func fort(_ side: Int) -> FortView? { forts.first { $0.side == side } }
    func name(_ side: Int) -> String { side >= 0 && side < names.count ? names[side] : (side == 0 ? "You" : "Rival") }
    func isHuman(_ side: Int) -> Bool { side >= 0 && side < humans.count ? humans[side] : side == 0 }

    /// True when a person, not the AI, may act right now.
    var humanTurn: Bool { phase == .plan && isHuman(activeSide) }

    /// True in a Couch Duel (two people on one device).
    var isDuel: Bool { mode == "duel" }

    /// Ground height at world x, linear between samples.
    func groundAt(_ x: Double) -> Double {
        guard !terrain.isEmpty else { return 0 }
        guard terrain.count > 1 else { return terrain[0] }
        let f = min(max(x / world.w, 0), 1) * Double(terrain.count - 1)
        let i = min(max(Int(f), 0), terrain.count - 2)
        let t = f - Double(i)
        return terrain[i] * (1 - t) + terrain[i + 1] * t
    }
}

/// A node on the campaign map.
struct LevelInfo: Equatable, Sendable, Identifiable, Hashable {
    var id: String
    var name: String
    /// "siege", "rescue", "grand_fort", "skirmish".
    var kind: String = "siege"
    /// "done", "next", "open", "locked".
    var state: String = "locked"
    var pennants: Int = 0
    var rival: String = ""
    var habit: String = ""
    var goals: [String] = []
    var hasDraft: Bool = false
    var roundCap: Int = 15

    var isLocked: Bool { state == "locked" }
    var number: String { id.split(separator: "-").last.map(String.init) ?? id }
}

struct CampaignView: Equatable, Sendable {
    var region: String
    var levels: [LevelInfo]
}

struct MapChoice: Equatable, Sendable, Identifiable, Hashable {
    var id: String
    var name: String
}

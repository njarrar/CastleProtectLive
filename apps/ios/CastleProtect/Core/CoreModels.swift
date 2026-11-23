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
    var battered = false
    /// The boss weak spot.
    var root = false
}

/// A thing on the field (props in core/API.md): a cage bar, the captive, a Crock or a turnip.
struct PropView: Equatable, Sendable {
    var id: Int
    /// "shell", "cage_bar", "captive", or what a newer core sends.
    var kind: String
    var tag: String
    /// Feet position, y up.
    var x: Double
    var y: Double
    var hp: Int
    var hpMax: Int
    /// Shot id of a shell prop (sprite pick), else "".
    var shot: String = ""

    var hpFraction: Double { Double(max(0, hp)) / Double(max(1, hpMax)) }
    var broken: Bool { hp <= 0 }

    /// Words for the screen reader (`hud.objects.<kind>`; a shell on the field says its shot).
    var spoken: String {
        let text = GameText.shared
        if kind == "shell", !shot.isEmpty { return ContentCatalog.shared.shotName(shot) }
        if let line = text.complete("hud.objects.\(kind)") { return line }
        return kind.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

/// The terrain cell grid the core sends in dirty chunks (one material byte a
/// cell, row major, y down). A reference type: the assembler writes the
/// chunks, the renderer turns changed chunks into textures. Main actor isolated.
@MainActor
final class TerrainGrid: Equatable {
    let w: Int
    let h: Int
    let chunk: Int
    private(set) var cells: [UInt8]
    /// Bumps when a chunk changes; one entry per chunk, row major.
    private(set) var chunkVersions: [Int]
    /// Bumps when any chunk changes.
    private(set) var version = 0
    private(set) var hasData = false

    /// Largest map the app accepts (cells a side).
    nonisolated static let maxSide = 8192

    init(w: Int, h: Int, chunk: Int) {
        self.w = max(1, min(w, Self.maxSide))
        self.h = max(1, min(h, Self.maxSide))
        self.chunk = max(8, min(chunk, 1024))
        cells = [UInt8](repeating: 0, count: self.w * self.h)
        chunkVersions = [Int](repeating: 0, count: ((self.w + self.chunk - 1) / self.chunk) * ((self.h + self.chunk - 1) / self.chunk))
    }

    var cols: Int { (w + chunk - 1) / chunk }
    var rows: Int { (h + chunk - 1) / chunk }

    nonisolated static func == (a: TerrainGrid, b: TerrainGrid) -> Bool { a === b }

    func cell(_ x: Int, _ y: Int) -> UInt8 {
        guard x >= 0, y >= 0, x < w, y < h else { return 0 }
        return cells[y * w + x]
    }

    /// Writes one chunk from the core. Returns false (and writes nothing) when
    /// its sizes are bad or its bytes do not match them (L2).
    @discardableResult
    func apply(x cx: Int, y cy: Int, w cw: Int, h ch: Int, base64: String) -> Bool {
        guard cw > 0, ch > 0, cw <= Self.maxSide, ch <= Self.maxSide, cx >= 0, cy >= 0,
              let bytes = Data(base64Encoded: base64), bytes.count >= cw * ch else { return false }
        bytes.withUnsafeBytes { (src: UnsafeRawBufferPointer) in
            for row in 0..<ch {
                let gy = cy + row
                guard gy < h else { break }
                for col in 0..<cw {
                    let gx = cx + col
                    guard gx < w else { break }
                    cells[gy * w + gx] = src[row * cw + col]
                }
            }
        }
        let c0 = cx / chunk, c1 = min(cols - 1, (cx + cw - 1) / chunk)
        let r0 = cy / chunk, r1 = min(rows - 1, (cy + ch - 1) / chunk)
        if c0 <= c1, r0 <= r1 {
            for r in r0...r1 {
                for c in c0...c1 { chunkVersions[r * cols + c] += 1 }
            }
        }
        version += 1
        hasData = true
        return true
    }

    /// Ground height (y up) at column x: the first solid cell from the top.
    func surface(_ x: Int) -> Int {
        let cx = min(max(0, x), w - 1)
        var y = 0
        while y < h && cells[y * w + cx] == 0 { y += 1 }
        return h - y
    }

    /// RGBA bytes for one chunk, bottom row first (SpriteKit textures start at
    /// the lower left), or nil when the chunk is all air. Paints stratified painterly
    /// earth textures per material (pebbled Loam with lush grass turf, terracotta Clay
    /// strata, cool faceted slate Rock veins, basalt Bedrock, marsh Mud, rippling Water).
    func rgba(chunkIndex i: Int) -> (data: Data, w: Int, h: Int)? {
        let c = i % cols, r = i / cols
        let x0 = c * chunk, y0 = r * chunk
        let cw = min(chunk, w - x0), ch = min(chunk, h - y0)
        guard cw > 0, ch > 0 else { return nil }
        var out = [UInt8](repeating: 0, count: cw * ch * 4)
        var solid = false
        for row in 0..<ch {
            let gy = y0 + row
            let outRow = ch - 1 - row
            let rowBase = gy * w
            for col in 0..<cw {
                let gx = x0 + col
                let m = cells[rowBase + gx]
                guard m != 0 else { continue }
                solid = true
                // Fast deterministic spatial hash for organic pebbles & mineral grain.
                let h0 = UInt32(bitPattern: Int32(truncatingIfNeeded: gx &* 374_761_393 &+ gy &* 668_265_263))
                let hash = ((h0 ^ (h0 >> 13)) &* 1_274_126_177) >> 24
                let rgb: (UInt8, UInt8, UInt8)
                switch m {
                case 1: // Loam: lush 2-tone turf cap, dark root rim, warm pebbled earth
                    let air1 = gy > 0 && cells[(gy - 1) * w + gx] == 0
                    let air3 = gy > 2 && cells[(gy - 3) * w + gx] == 0
                    let air5 = gy > 4 && cells[(gy - 5) * w + gx] == 0
                    let air7 = gy > 6 && cells[(gy - 7) * w + gx] == 0
                    if air1 || air3 {
                        if air1 || (hash & 7) == 0 {
                            rgb = (0x9C, 0xD8, 0x46) // sunlit turf highlight
                        } else if (hash & 3) == 1 {
                            rgb = (0x74, 0xB4, 0x2F) // grass blade shadow
                        } else {
                            rgb = (0x8B, 0xCB, 0x3A) // meadow turf
                        }
                    } else if air5 || air7 {
                        // rich sub-turf root edge
                        if (hash & 3) == 0 {
                            rgb = (0x6B, 0x43, 0x22)
                        } else {
                            rgb = (0x7B, 0x4E, 0x29)
                        }
                    } else {
                        // Organic pebbled loam cross-section
                        let pebble = ((gx >> 1) &* 31 ^ (gy >> 1) &* 17) & 31
                        if pebble == 3 {
                            rgb = (0xB6, 0x86, 0x54) // light sand pebble
                        } else if pebble == 19 || (hash & 15) == 0 {
                            rgb = (0x74, 0x4A, 0x26) // dark humus fleck
                        } else if ((gy + (gx >> 4)) & 7) == 0 {
                            rgb = (0x8D, 0x5E, 0x34) // subtle soil bed seam
                        } else {
                            rgb = (0x9A, 0x6A, 0x3A)
                        }
                    }
                case 2: // Clay: warm terracotta horizontal wavy sedimentary bands
                    let wave = ((gx >> 3) & 3) ^ ((gx >> 5) & 1)
                    let band = (gy + wave) & 7
                    if band == 0 {
                        rgb = (0x9D, 0x4A, 0x2B) // deep ochre bedding crease
                    } else if band == 3 || band == 4 {
                        rgb = (0xCE, 0x7A, 0x50) // warm terracotta highlight band
                    } else if (hash & 15) == 1 {
                        rgb = (0xA8, 0x56, 0x35) // clay fleck
                    } else {
                        rgb = (0xBA, 0x64, 0x3E)
                    }
                case 3: // Rock: cool faceted slate-grey angular veins (high contrast vs warm forts)
                    let diagA = (gx + gy * 2) & 15
                    let diagB = (gx * 2 - gy) & 15
                    let facet = ((gx >> 2) ^ (gy >> 2)) & 3
                    if diagA == 0 || diagB == 0 {
                        rgb = (0x53, 0x5B, 0x66) // angular fracture vein
                    } else if diagA == 1 {
                        rgb = (0x9B, 0xA4, 0xAE) // faceted crystal edge highlight
                    } else if facet == 0 {
                        rgb = (0x6D, 0x75, 0x80)
                    } else if facet == 3 {
                        rgb = (0x88, 0x90, 0x9B)
                    } else {
                        rgb = (0x7A, 0x82, 0x8D)
                    }
                case 4: // Bedrock: deep espresso-basalt strata with heavy fault lines
                    let strata = (gy + ((gx >> 4) & 1)) % 6
                    if strata == 0 {
                        rgb = (0x2A, 0x22, 0x26)
                    } else if strata == 3 && (hash & 7) < 4 {
                        rgb = (0x4D, 0x44, 0x49)
                    } else {
                        rgb = (0x3B, 0x33, 0x38)
                    }
                case 5: // Mud: dark marsh speckle with wet sheen pebbles
                    if (hash & 15) == 2 {
                        rgb = (0x84, 0x62, 0x42) // wet specular fleck
                    } else if (hash & 7) == 0 {
                        rgb = (0x4E, 0x35, 0x20)
                    } else {
                        rgb = (0x66, 0x47, 0x2D)
                    }
                case 6: // Water: storybook teal-blue with surface ripples
                    let nearTop = gy > 0 && cells[(gy - 1) * w + gx] == 0
                    let nearTop3 = gy > 2 && cells[(gy - 3) * w + gx] == 0
                    if nearTop {
                        rgb = (0xC9, 0xED, 0xFA) // foam crest
                    } else if nearTop3 && ((gx + gy * 2) & 7) < 3 {
                        rgb = (0x6F, 0xB4, 0xEC) // surface shimmer
                    } else if (gy & 5) == 0 && ((gx >> 2) & 3) == 1 {
                        rgb = (0x3D, 0x80, 0xC6)
                    } else {
                        rgb = (0x4A, 0x90, 0xD9)
                    }
                default:
                    rgb = Self.colour(m)
                }
                let o = (outRow * cw + col) * 4
                out[o] = rgb.0; out[o + 1] = rgb.1; out[o + 2] = rgb.2; out[o + 3] = 255
            }
        }
        return solid ? (Data(out), cw, ch) : nil
    }

    /// Material colours from content/materials.json codes: 1 Loam, 2 Clay,
    /// 3 Rock, 4 Bedrock, 5 Mud, 6 Water.
    nonisolated static func colour(_ m: UInt8) -> (UInt8, UInt8, UInt8) {
        switch m {
        case 1: return (0x9A, 0x6A, 0x3A)
        case 2: return (0xB8, 0x62, 0x3E)
        case 3: return (0x8C, 0x8A, 0x86)
        case 4: return (0x4E, 0x4A, 0x50)
        case 5: return (0x6B, 0x4A, 0x2E)
        case 6: return (0x4A, 0x90, 0xD9)
        default: return (0x9A, 0x6A, 0x3A)
        }
    }
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
    var canFire = false

    var hpFraction: Double { Double(max(0, hp)) / Double(max(1, hpMax)) }

    /// Out of the fight: only `bonked`, or 0 HP (core/API.md, rules 4). `squashed`, `dropped`
    /// and `tumbled` Hobs are hurt but alive and may act.
    var isOut: Bool { bonked || hp <= 0 }

    /// Crushed by a falling chunk (`squashed` in core/API.md, rules 4): drawn flattened with stars,
    /// still live, back up at the end of its side's turn.
    var isCrushed: Bool { !isOut && state == "squashed" }

    /// Words for the screen reader and the portrait label (`hobs.states`).
    var stateWords: String {
        if isOut { return GameText.shared.t("hobs.states.bonked") }
        if isCrushed { return GameText.shared.t("hobs.states.squashed") }
        return ""
    }

    /// The Hob's short name for chips, banners and spoken lines (`hobs.<id>.short`). Never the
    /// content name cut at the first space.
    var shortName: String { GameText.shared.hobShort(def, name: name) }
}

/// A Nook (or the Kettle Room) as the renderer needs it: world boxes, y up.
struct RoomView: Equatable, Sendable {
    var id: Int
    /// Room box: min x, min y (bottom), max x, max y (top).
    var box: CGRectLike
    /// The Loophole slot, or nil.
    var loophole: CGRectLike?
    var intact = true
    /// Loophole Flap down (after a Thread, until the front changes).
    var flap = false
    /// Pot Lid on this room.
    var lid = false
}

/// A plain rectangle that is Sendable and Equatable without CoreGraphics.
struct CGRectLike: Equatable, Sendable {
    var x0: Double
    var y0: Double
    var x1: Double
    var y1: Double

    var midX: Double { (x0 + x1) / 2 }
    var midY: Double { (y0 + y1) / 2 }
    var width: Double { x1 - x0 }
    var height: Double { y1 - y0 }

    /// A core box `[x0, y0, x1, y1]` (inclusive, y down) in view space (y up).
    init?(core b: [Int], mapHeight H: Double) {
        guard b.count >= 4 else { return nil }
        x0 = Double(min(b[0], b[2])); x1 = Double(max(b[0], b[2]) + 1)
        y0 = H - Double(max(b[1], b[3]) + 1); y1 = H - Double(min(b[1], b[3]))
    }

    init(x0: Double, y0: Double, x1: Double, y1: Double) {
        self.x0 = x0; self.y0 = y0; self.x1 = x1; self.y1 = y1
    }
}

/// The 1-10 boss state from `hud.boss`, in view space.
struct BossView: Equatable, Sendable {
    var phase = 1
    /// The red cut line box, shown one boss turn before the snip.
    var cut: CGRectLike?
    var jam = 0
    var rollerDone = false
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
    /// Left edge of the fort and the bottom of the Footing (y up), and the block size.
    var originX: Double = 0
    var baseY: Double = 0
    var block: Double = 16
    var cols: Int = 0
    var rooms: [RoomView] = []
    /// The Kettle Room box and whether the Pot Lid is on it.
    var kettleRoom: CGRectLike?
    var kettleLid = false
    var fatigue = false

    /// World position (lower left) of block (c, r) of this fort.
    func blockOrigin(c: Int, r: Int) -> (x: Double, y: Double) {
        (originX + block * Double(c), baseY + block * Double(r))
    }

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
    /// Match class id for Trick Shells (`"scatterjack"`, `"lobber"`, `"all"`, ...), or nil.
    var matchClass: String? = nil
    var ready: Bool = true
    /// Why `fire` would refuse it (from `hud.shots`), or nil.
    var why: String?
    /// The same in plain words, shown on an unready chip (rules 3), or nil.
    var text: String?

    /// A word or two for an unready chip, from the core's `why` (`hud.why_short`).
    static func shortReason(why: String?) -> String {
        let text = GameText.shared
        let id = why == "no_shot" ? "not_in_hand" : (why ?? "")
        if let line = text.complete("hud.why_short.\(id)") { return line }
        return text.t("hud.why_short.not_planning")
    }
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
    var id: Int = 0
    var x: Double
    var y: Double
    var kind: String = ""
    /// Flight direction in tenths of a degree, 0 right, 900 up.
    var rot: Int = 0
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
    /// The core's `how`: clean_sweep, kettle_pop, squall, double_pop, rescue, round_cap, total_hp,
    /// give_up, volley_points, captive_bonked.
    var reason: String
    var pennants: Int = 0
    var buttons: Int = 0
    var round: Int = 0
    var goals: [GoalView] = []
    /// Which Pennants were earned this time (core `pennants` as flags) and which are new.
    var pennantFlags: [Bool] = []
    var pennantsNew: [Bool] = []
    /// Siege Score per side.
    var score: [Int] = []
    var stats: [CoreStats] = []
    /// What broke the losing side.
    var broke: CoreBroke?
    /// The winner's best shot (core `result.best_shot`), and each side's (`stats[i].best_shot`).
    var bestShot: CoreBestShot?
    var bestShots: [CoreBestShot?] = []

    /// The best shot of `side`, or nil (never the other side's).
    func bestShot(of side: Int) -> CoreBestShot? {
        if side >= 0, side < bestShots.count, let shot = bestShots[side] { return shot }
        if let shot = bestShot, shot.side == side { return shot }
        return nil
    }
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
    /// The core's event as sent (cells, falls, hob ids), for the renderer's choreography.
    var raw: CoreEvent?
}

/// One frame of the battle, ready to draw.
struct BattleSnapshot: Equatable, Sendable {
    var tick = 0
    var phase: BattlePhase = .none
    /// "campaign", "skirmish", "duel", "test_yard".
    var mode = ""
    var level = ""
    /// True when this frame came from a lean snapshot (shell flight only).
    var lean = false
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
    var names = [GameText.shared.t("common.you"), GameText.shared.t("common.rival")]
    var humans = [true, false]
    var world = WorldSize()
    /// Ground height per column, evenly spaced across the world width.
    var terrain: [Double] = []
    /// The real cell grid, drawn chunk by chunk (H6). Nil until the core sends terrain.
    var ground: TerrainGrid?
    var forts: [FortView] = []
    var props: [PropView] = []
    /// Doodad ids the HUD side still has (Mend Bucket, Pot Lid).
    var doodads: [String] = []
    /// Whether the active side may still use Puff Up.
    var puffUp = false
    var selectedHob: String?
    var shots: [ShotChip] = []
    var selectedShot: String?
    var aim = AimView()
    var canFire = false
    /// Why Fire is grey, in plain words (core `hud.fire.text`), or nil.
    var fireText: String?
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
    /// Steam a Shove Off costs (`hud.shove_off_cost`).
    var shoveOffCost = 15
    /// Help marks per side ("", "+", "++"), shown openly.
    var helpMarks = ["", ""]
    /// Volley Points: Actions per side and what is left, or nil.
    var volleyActions = 0
    var volleyLeft: [Int] = []
    var boss: BossView?
    /// Rescue objective ("cage", 2) or nil.
    var objective: String?
    var objectiveCount = 0
    var score: [Int] = [0, 0]
    /// Shimmer cells per side, for the shimmer effect.
    var squall = false
    /// Fatigue is on (from round 10); rounds until it starts, or nil (core `hud.fatigue_in`).
    var fatigue = false
    var fatigueRound = 10
    var fatigueIn: Int?

    func fort(_ side: Int) -> FortView? { forts.first { $0.side == side } }
    func name(_ side: Int) -> String {
        side >= 0 && side < names.count ? names[side] : GameText.shared.t(side == 0 ? "common.you" : "common.rival")
    }
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
    var squall: Bool = true
    var crewSize: Int = 4

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

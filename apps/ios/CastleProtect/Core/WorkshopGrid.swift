import CoreGraphics
import Foundation

// S10, the simple Workshop: place and remove blocks on a grid and keep one fort. The core
// judges every fort (`validate_blueprint`, core/API.md); this file only edits the grid and
// turns it into the core's glyph rows.

/// What a tap on the grid does.
enum WorkshopTool: String, CaseIterable, Identifiable, Sendable {
    case wicker, timber, cobble, nook, kettle, erase

    var id: String { rawValue }

    var label: String {
        switch self {
        case .wicker: return "Wicker"
        case .timber: return "Timber"
        case .cobble: return "Cobble"
        case .nook: return "Nook"
        case .kettle: return "Kettle"
        case .erase: return "Erase"
        }
    }

    /// The core's glyph for a block tool (content/materials.json), else nil.
    var glyph: Character? {
        switch self {
        case .wicker: return "w"
        case .timber: return "t"
        case .cobble: return "c"
        default: return nil
        }
    }
}

/// One cell of the Workshop grid.
enum WorkshopCell: Equatable, Sendable {
    case empty
    /// A block: `w` Wicker, `t` Timber, `c` Cobble.
    case block(Character)
    /// A Nook cell, numbered 1 to 5 (seat order).
    case nook(Int)
    /// A Kettle Room cell.
    case kettle

    var isRoom: Bool {
        switch self {
        case .nook, .kettle: return true
        default: return false
        }
    }

    var glyph: Character {
        switch self {
        case .empty: return "."
        case .block(let g): return g
        case .nook(let n): return Character(String(n))
        case .kettle: return "K"
        }
    }
}

/// The Workshop grid: 8 columns by 9 rows above the Footing (the core's grid is at most 8 x 10
/// with the Footing row, so a 10th row could never be built on: QA playtest 2, n2).
/// Row 0 sits just above the Footing; column 0 is the back of the fort.
struct WorkshopGrid: Equatable, Sendable {
    static let cols = 8
    static let rows = 9
    static let maxNooks = 5
    /// The block budget the core checks (core/API.md, `validate_blueprint` `budget`).
    static let budget = 72

    /// `cells[row][col]`.
    private(set) var cells: [[WorkshopCell]]

    init() {
        cells = Array(repeating: Array(repeating: .empty, count: Self.cols), count: Self.rows)
    }

    /// From the core's glyph rows (top first, Footing last). Anything past the grid is dropped.
    init(rows glyphRows: [String]) {
        self.init()
        let body = glyphRows.filter { !$0.isEmpty && !$0.allSatisfy { $0 == "F" } }
        for (i, line) in body.enumerated() {
            let r = body.count - 1 - i
            guard r >= 0, r < Self.rows else { continue }
            for (c, g) in line.enumerated() where c < Self.cols {
                switch g {
                case "w", "t", "c": cells[r][c] = .block(g)
                case "K": cells[r][c] = .kettle
                case "1", "2", "3", "4", "5": cells[r][c] = .nook(Int(String(g)) ?? 1)
                default: cells[r][c] = .empty
                }
            }
        }
    }

    /// The Home fort with three seats (content/blueprints.json `bp_home_3`), where a new fort starts.
    static let homeRows = ["ttttttt", "t11t22t", "t11t22t", "ttttttt", "tKKt33t", "tKKt33t", "FFFFFFF"]

    func cell(_ c: Int, _ r: Int) -> WorkshopCell {
        guard c >= 0, r >= 0, c < Self.cols, r < Self.rows else { return .empty }
        return cells[r][c]
    }

    var isEmpty: Bool { cells.allSatisfy { $0.allSatisfy { $0 == .empty } } }

    /// Nooks placed (each seats one Hob).
    var nooks: Int {
        var seen = Set<Int>()
        for row in cells { for cell in row { if case .nook(let n) = cell { seen.insert(n) } } }
        return seen.count
    }

    /// Blocks and room cells, as the core counts them against the budget.
    var used: Int { cells.reduce(0) { $0 + $1.filter { $0 != .empty }.count } }

    /// Applies a tool at (c, r). Rooms are 2 x 2 with (c, r) their lower left. Returns false when
    /// nothing changed (no room there, a block on a room, the sixth Nook).
    @discardableResult
    mutating func apply(_ tool: WorkshopTool, c: Int, r: Int) -> Bool {
        guard c >= 0, r >= 0, c < Self.cols, r < Self.rows else { return false }
        switch tool {
        case .erase:
            switch cells[r][c] {
            case .empty: return false
            case .kettle: replaceAll(.kettle, with: .empty)
            case .nook(let n): removeNook(n)
            case .block: cells[r][c] = .empty
            }
            return true
        case .nook, .kettle:
            guard c + 1 < Self.cols, r + 1 < Self.rows else { return false }
            let box = [(c, r), (c + 1, r), (c, r + 1), (c + 1, r + 1)]
            if box.contains(where: { cells[$0.1][$0.0].isRoom }) { return false }
            let room: WorkshopCell
            if tool == .kettle {
                replaceAll(.kettle, with: .empty)
                room = .kettle
            } else {
                guard nooks < Self.maxNooks else { return false }
                room = .nook(nooks + 1)
            }
            for (x, y) in box { cells[y][x] = room }
            return true
        case .wicker, .timber, .cobble:
            guard let g = tool.glyph else { return false }
            if cells[r][c].isRoom || cells[r][c] == .block(g) { return false }
            cells[r][c] = .block(g)
            return true
        }
    }

    private mutating func replaceAll(_ old: WorkshopCell, with new: WorkshopCell) {
        for r in 0..<Self.rows { for c in 0..<Self.cols where cells[r][c] == old { cells[r][c] = new } }
    }

    /// Removes Nook `n`; later Nooks move down a number, so they stay 1, 2, 3 with no gaps (the core's rule).
    private mutating func removeNook(_ n: Int) {
        for r in 0..<Self.rows {
            for c in 0..<Self.cols {
                if case .nook(let k) = cells[r][c] {
                    if k == n { cells[r][c] = .empty } else if k > n { cells[r][c] = .nook(k - 1) }
                }
            }
        }
    }

    /// The used columns (the fort is cut to them so it sits on its Footing), or nil when empty.
    var usedColumns: ClosedRange<Int>? {
        var lo = Int.max, hi = Int.min
        for row in cells { for (c, cell) in row.enumerated() where cell != .empty { lo = min(lo, c); hi = max(hi, c) } }
        return lo <= hi ? lo...hi : nil
    }

    /// The highest row with anything on it, or nil when empty.
    var topRow: Int? { cells.lastIndex { $0.contains { $0 != .empty } } }

    /// The core's glyph rows: cut to the used columns, top row first, a full Footing row last.
    func glyphRows() -> [String] {
        guard let cols = usedColumns, let top = topRow else { return [] }
        var out: [String] = []
        for r in stride(from: top, through: 0, by: -1) {
            out.append(String(cols.map { cells[r][$0].glyph }))
        }
        out.append(String(repeating: "F", count: cols.count))
        return out
    }

    /// The grid cell of a core problem cell `[c, r]` (core row 0 is the Footing), or nil.
    func gridCell(core: [Int]) -> (c: Int, r: Int)? {
        guard core.count >= 2, let cols = usedColumns else { return nil }
        let c = core[0] + cols.lowerBound, r = core[1] - 1
        guard c >= 0, r >= 0, c < Self.cols, r < Self.rows else { return nil }
        return (c, r)
    }

    /// The core's reason in plain words (it can say "grid 8x11 outside 3x3 to 8x10": QA playtest 2, n2).
    static func plainWords(_ detail: String) -> String {
        let d = detail.lowercased()
        if d.contains("outside") || d.hasPrefix("grid ") {
            let numbers = detail.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
            if numbers.count >= 2, numbers[0] < 3 || numbers[1] < 3 {
                return "Too small: build at least 3 wide and 2 tall"
            }
            return "Too big: keep the fort within \(cols) wide and \(rows) tall"
        }
        if d.contains("kettle room must be 2") { return "Place the Kettle Room" }
        if d.contains("kettle room must sit") { return "Keep one block of wall on every side of the Kettle Room" }
        if d.contains("kettle room must be walled") { return "Wall the Kettle Room in on all four sides" }
        if d.hasPrefix("nook numbers") { return "Number the Nooks from 1 with no gaps" }
        if d.contains("nook") && d.contains("walled") {
            let n = detail.split(whereSeparator: { !$0.isNumber }).first.map { String($0) } ?? ""
            return "Wall Nook \(n) in on all four sides"
        }
        if d.contains("nooks for") { return "Add a Nook for each Hob" }
        if d.contains("at most 5 nooks") { return "Five Nooks at most" }
        if d.hasPrefix("block budget") {
            let used = detail.split(whereSeparator: { !$0.isNumber }).first.map { String($0) } ?? ""
            return "Too many blocks: \(used) of \(budget)"
        }
        if d.contains("no support") { return "Some blocks hang in the air: give them something to stand on" }
        guard let first = detail.first else { return "This fort is not ready" }
        return first.uppercased() + detail.dropFirst().replacingOccurrences(of: "_", with: " ")
    }

    /// The smallest a grid cell is drawn (points), so it is easy to hit.
    static let minCell: CGFloat = 24

    /// The cell size for a grid area: the largest that fits, never under 24 pt (the grid then
    /// scrolls) and never over 48 pt.
    static func cellSize(for area: CGSize) -> CGFloat {
        let fit = min(area.width / CGFloat(cols), area.height / CGFloat(rows + 1))
        return min(48, max(minCell, fit.rounded(.down)))
    }
}

/// What the core said about the fort, in the app's words.
struct WorkshopCheck: Equatable, Sendable {
    var ok = false
    var used = 0
    var budget = WorkshopGrid.budget
    var cost = 0
    /// "Ready", or why not in plain words.
    var words = ""
    /// Grid cells to mark (`row * cols + col`).
    var marked: Set<Int> = []

    var status: String { "Blocks \(used)/\(budget)   Cost \(cost)   \(words)" }
}

/// Asks the core about a fort. It keeps its own Test Yard handle on its own core thread, so the
/// battle handle is never touched (core/API.md: one thread per handle).
@MainActor
final class WorkshopChecker {
    private let host: CoreHost
    private var started = false

    init(standIn: Bool) {
        host = CoreHost(bridge: CoreFactory.make(preferStandIn: standIn))
    }

    init(bridge: any CoreBridge) {
        host = CoreHost(bridge: bridge)
    }

    var isStandIn: Bool { host.bridge.isStandIn }

    func check(_ grid: WorkshopGrid) -> WorkshopCheck {
        guard !grid.isEmpty else {
            return WorkshopCheck(ok: false, used: 0, words: "Place some blocks to start a fort")
        }
        if !started {
            let setup = #"{"level":"d1","mode":"test_yard"}"#
            started = host.sync { $0.start(setup: setup, seed: 1) } == nil
        }
        // A fort must seat at least one Hob.
        let command = CoreCommand.validateBlueprint(rows: grid.glyphRows(), seats: max(1, grid.nooks)).jsonString()
        let reply = CoreReply.decode(host.sync { $0.command(command) })
        var out = WorkshopCheck()
        out.ok = reply.ok
        out.used = reply.used ?? grid.used
        out.budget = reply.budget ?? WorkshopGrid.budget
        out.cost = reply.cost ?? 0
        if reply.ok {
            out.words = "Ready"
        } else {
            out.words = WorkshopGrid.plainWords(reply.detail ?? reply.reason ?? "")
            for cell in reply.cells ?? [] {
                if let at = grid.gridCell(core: cell) { out.marked.insert(at.r * WorkshopGrid.cols + at.c) }
            }
        }
        return out
    }
}

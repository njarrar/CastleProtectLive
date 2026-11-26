import Foundation

/// A thin player of the core's own fixture files (core/fixtures, copied into
/// the bundle as `fixtures/`): `snapshot_plan.json`, `snapshot_lean.json` and
/// `snapshot_after_shot.json`. It speaks the core's JSON and decides nothing:
/// aim, picks and Fire only change which fixture plays next, so screens,
/// tests and UI tests run before the XCFramework is linked.
final class FakeCoreBridge: CoreBridge {
    let name = "Stand-in core (fixture player, no XCFramework linked)"
    let isStandIn = true
    let version = #"{"sim":"fixtures","rules":5,"tick_hz":120}"#
    /// Tests: the next command panics, and every call after it is `dead_handle` (core/API.md).
    var panicNext = false
    private var dead = false

    private let plan: [String: Any]
    private let lean: [String: Any]
    private let afterShot: [String: Any]
    private var current: [String: Any] = [:]
    private var queue: [[String: Any]] = []
    private var log: [[String: Any]] = []
    private var running = false
    private var tick = 0

    init(bundle: Bundle = .main) {
        plan = Self.fixture("snapshot_plan", bundle: bundle) ?? Self.minimalPlan
        lean = Self.fixture("snapshot_lean", bundle: bundle)
            ?? ["full": false, "phase": "resolve", "shells": [[Any]](), "events": [[String: Any]]()]
        afterShot = Self.fixture("snapshot_after_shot", bundle: bundle) ?? Self.minimalPlan
    }

    func start(setup: String, seed: UInt64) -> String? {
        guard let obj = (try? JSONSerialization.jsonObject(with: Data(setup.utf8))) as? [String: Any],
              let level = obj["level"] as? String, !level.isEmpty else {
            return "setup needs a level"
        }
        current = plan
        current["level"] = level
        if let mode = obj["mode"] as? String {
            current["mode"] = mode
            if mode == "couch", var hud = current["hud"] as? [String: Any] {
                hud["control"] = ["human", "human"]
                current["hud"] = hud
            }
        }
        queue = [current]
        log = []
        tick = 0
        running = true
        dead = false
        return nil
    }

    func command(_ json: String) -> String {
        if dead { return reply(["ok": false, "reason": "dead_handle"]) }
        if panicNext {
            panicNext = false
            dead = true
            return reply(["ok": false, "reason": "panic", "detail": "test panic"])
        }
        guard running else { return reply(["ok": false, "reason": "no_battle"]) }
        guard let obj = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any],
              let cmd = obj["cmd"] as? String else {
            return reply(["ok": false, "reason": "bad_json"])
        }
        let phase = current["phase"] as? String ?? "plan"
        switch cmd {
        case "aim":
            guard phase == "plan" else { return reply(["ok": false, "reason": "not_planning"]) }
            let (angle, power) = setAim(angle: obj["angle"] as? Int, power: obj["power"] as? Int)
            accept(obj)
            return reply(["ok": true, "angle": angle, "power": power])
        case "pick_hob", "pick_shot":
            guard phase == "plan" else { return reply(["ok": false, "reason": "not_planning"]) }
            var hud = current["hud"] as? [String: Any] ?? [:]
            var sel = hud["selected"] as? [String: Any] ?? [:]
            if let hob = obj["hob"] as? Int { sel["hob"] = hob }
            if let shot = obj["shot"] as? String { sel["shot"] = shot }
            hud["selected"] = sel
            current["hud"] = hud
            queue.append(quiet(current))
            accept(obj)
            return reply(cmd == "pick_hob" ? ["ok": true, "can_fire": true] : ["ok": true])
        case "fire", "pass":
            guard phase == "plan" else { return reply(["ok": false, "reason": "not_planning"]) }
            accept(obj)
            var flying = lean
            flying["phase"] = "resolve"
            queue.append(flying)
            current = afterShot
            queue.append(afterShot)
            return reply(["ok": true])
        case "ai_turn":
            guard phase == "plan" else { return reply(["ok": false, "reason": "not_planning"]) }
            // The fixture loop: the Rival's turn plays back to the first plan frame.
            var next = plan
            next["level"] = current["level"]
            next["mode"] = current["mode"]
            current = next
            queue.append(next)
            return reply(["ok": true, "commands": [[String: Any]]()])
        case "end_draft", "quick_pick", "pick_shell", "walk", "shove_off", "recall", "doodad":
            accept(obj)
            return reply(["ok": true])
        case "give_up":
            guard phase != "ended" else { return reply(["ok": false, "reason": "battle_over"]) }
            accept(obj)
            let loser = obj["side"] as? Int ?? 0
            var ended = current
            ended["phase"] = "ended"
            ended["awaiting"] = "none"
            ended["events"] = [["t": "win", "tick": tick, "winner": 1 - loser, "how": "give_up"] as [String: Any]]
            ended["result"] = ["winner": 1 - loser, "how": "give_up", "round": 1, "pennants": [Bool](),
                               "pennants_new": [Bool](), "buttons": 40, "score": [0, 0]] as [String: Any]
            current = ended
            queue.append(ended)
            return reply(["ok": true])
        case "set_wind":
            guard (current["mode"] as? String) == "test_yard" else { return reply(["ok": false, "reason": "test_yard_only"]) }
            var hud = current["hud"] as? [String: Any] ?? [:]
            hud["wind"] = obj["wind"] as? Int ?? 0
            current["hud"] = hud
            queue.append(quiet(current))
            accept(obj)
            return reply(["ok": true])
        case "resume":
            guard log.isEmpty else { return reply(["ok": false, "reason": "cannot_resume"]) }
            let entries = obj["log"] as? [[String: Any]] ?? []
            for (i, entry) in entries.enumerated() {
                guard let data = try? JSONSerialization.data(withJSONObject: entry) else { continue }
                let r = command(String(decoding: data, as: UTF8.self))
                if !r.contains("\"ok\":true") {
                    return reply(["ok": false, "reason": "bad_log", "index": i])
                }
            }
            queue = [current]
            return reply(["ok": true, "applied": entries.count, "hash": current["hash"] as? String ?? "0"])
        case "log":
            return reply(["ok": true, "log": log])
        case "hash":
            return reply(["ok": true, "hash": current["hash"] as? String ?? "0"])
        case "validate_blueprint":
            return reply(Self.validate(rows: obj["rows"] as? [String] ?? [], seats: obj["seats"] as? Int ?? 0))
        case "terrain_all", "lean_lines", "shimmer":
            return reply(["ok": true])
        default:
            return reply(["ok": false, "reason": "unknown_command"])
        }
    }

    func step(_ ticks: Int) -> String {
        if dead { return reply(["ok": false, "reason": "dead_handle"]) }
        tick += max(0, ticks)
        return reply(["tick": tick, "phase": current["phase"] as? String ?? "plan"])
    }

    func snapshot() -> String {
        if dead { return reply(["ok": false, "reason": "dead_handle"]) }
        guard running else { return #"{"phase":"none"}"# }
        let next = queue.isEmpty ? lean(of: current) : queue.removeFirst()
        return reply(next)
    }

    func end() {
        running = false
        queue = []
    }

    // MARK: Helpers

    /// A rough stand-in for the core's Workshop check (core/API.md, `validate_blueprint`): the
    /// grid size, a Kettle Room, enough Nooks and the 72 block budget. The real core also runs
    /// the support solver; this one does not.
    static func validate(rows: [String], seats: Int) -> [String: Any] {
        let costs: [Character: Int] = ["w": 5, "t": 15, "c": 35]
        let body = rows.dropLast()
        let used = body.reduce(0) { $0 + $1.filter { $0 != "." }.count }
        let cost = body.reduce(0) { sum, line in sum + line.reduce(0) { $0 + (costs[$1] ?? 0) } }
        var out: [String: Any] = ["cost": cost, "used": used, "budget": 72]
        let cols = rows.first?.count ?? 0
        var detail: String?
        var problem: String?
        if rows.isEmpty { detail = "no rows"; problem = "too_small" }
        else if rows.contains(where: { $0.count != cols }) { detail = "rows differ in width"; problem = "too_big" }
        else if cols > 8 || rows.count > 10 || cols < 3 || rows.count < 3 {
            detail = "grid \(cols)x\(rows.count) outside 3x3 to 8x10"
            problem = (cols < 3 || rows.count < 3) ? "too_small" : "too_big"
        } else if rows.last?.allSatisfy({ $0 == "F" }) != true { detail = "row 0 must be full Footing"; problem = "footing_row" }
        else if !body.contains(where: { $0.contains("K") }) { detail = "No Kettle Room"; problem = "no_kettle_room" }
        else if Set(body.joined().filter { $0.isNumber }).count < seats { detail = "Not enough Nooks for \(seats) Hobs"; problem = "nooks_short" }
        else if used > 72 { detail = "Block Budget \(used) over 72"; problem = "over_budget" }
        if let detail {
            out["ok"] = false
            out["reason"] = "invalid_blueprint"
            out["detail"] = detail
            if let problem { out["problem"] = problem }
            out["cells"] = [[Int]]()
        } else {
            out["ok"] = true
        }
        return out
    }

    /// The current frame again with no events and no terrain (sent after a change).
    private func quiet(_ frame: [String: Any]) -> [String: Any] {
        var f = frame
        f["events"] = [[String: Any]]()
        f["terrain"] = ["chunks": [[String: Any]]()]
        return f
    }

    /// A lean snapshot, as the core sends while nothing but shells changes.
    private func lean(of frame: [String: Any]) -> [String: Any] {
        [
            "tick": tick, "full": false,
            "phase": frame["phase"] ?? "plan", "side": frame["side"] ?? 0, "awaiting": frame["awaiting"] ?? "none",
            "terrain": ["chunks": [[String: Any]]()], "shells": [[Any]](), "events": [[String: Any]](),
        ]
    }

    private func setAim(angle: Int?, power: Int?) -> (Int, Int) {
        let hud = current["hud"] as? [String: Any] ?? [:]
        let sel = (hud["selected"] as? [String: Any])?["hob"] as? Int ?? 0
        var hobs = current["hobs"] as? [[String: Any]] ?? []
        var a = 450
        var p = 60
        if let i = hobs.firstIndex(where: { ($0["id"] as? Int) == sel }) {
            var aim = hobs[i]["aim"] as? [String: Any] ?? [:]
            a = min(1800, max(0, angle ?? (aim["angle"] as? Int ?? 450)))
            p = min(100, max(0, power ?? (aim["power"] as? Int ?? 60)))
            aim["angle"] = a
            aim["power"] = p
            hobs[i]["aim"] = aim
            current["hobs"] = hobs
            // Like the real core (core/API.md, `snapshot_aim_lean.json`): an `aim` gives a lean
            // snapshot carrying only the new aim and the preview, not a full frame.
            var frame = lean(of: current)
            frame["aim"] = ["side": hobs[i]["side"] as? Int ?? 0, "hob": sel, "angle": a, "power": p] as [String: Any]
            frame["preview"] = current["preview"] ?? [[Int]]()
            queue.append(frame)
        }
        return (a, p)
    }

    private func accept(_ obj: [String: Any]) { log.append(obj) }

    private func reply(_ obj: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys]) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }

    private static func fixture(_ name: String, bundle: Bundle) -> [String: Any]? {
        let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "fixtures")
            ?? bundle.url(forResource: name, withExtension: "json")
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// Used only when the fixtures are not in the bundle: one fort a side, one Hob each.
    private static var minimalPlan: [String: Any] {
        func block(_ c: Int, _ r: Int, _ x: Int, _ y: Int) -> [String: Any] {
            ["c": c, "r": r, "x": x, "y": y, "mat": "timber", "hp": 50, "max": 50]
        }
        func castle(_ side: Int, _ x: Int) -> [String: Any] {
            var blocks: [[String: Any]] = []
            for c in 0..<4 {
                for r in 0..<3 { blocks.append(block(c, r, x + 16 * c, 520 - 16 * (r + 1))) }
            }
            let kettle: [String: Any] = ["hp": 300, "max": 300, "box": [x + 22, 485, x + 42, 504]]
            return ["side": side, "x": x, "base_y": 520, "cols": 4, "rows": 3, "block": 16,
                    "blocks": blocks, "kettle": kettle, "steam": 100, "steam_turn": 0]
        }
        func hob(_ id: Int, _ side: Int, _ def: String, _ name: String, _ x: Int) -> [String: Any] {
            let aim: [String: Any] = ["angle": side == 0 ? 450 : 1350, "power": 60]
            return ["id": id, "side": side, "def": def, "name": name, "class": "lobber", "hp": 120, "max": 120,
                    "state": "seated", "x": x, "y": 472, "plain": "clodpot", "can_fire": true, "aim": aim]
        }
        let selected: [String: Any] = ["hob": 0, "shot": "plain"]
        let hud: [String: Any] = [
            "turn": 1, "round": 1, "round_cap": 8, "side": 0, "wind": 0, "forecast": 0,
            "steam": [100, 120], "steam_turn_left": 40, "kettle_pct": [100, 100],
            "selected": selected, "names": ["Left", "Sir Pudge"], "control": ["human", "ai"],
        ]
        let map: [String: Any] = ["w": 1600, "h": 720, "chunk": 64]
        let terrain: [String: Any] = ["chunks": [[String: Any]]()]
        return [
            "tick": 0, "phase": "plan", "side": 0, "awaiting": "human", "full": true, "level": "1-1", "mode": "campaign",
            "map": map, "terrain": terrain,
            "castles": [castle(0, 344), castle(1, 1192)],
            "hobs": [hob(0, 0, "marge", "Marge Dumpling", 376), hob(1, 1, "thumper", "Old Thumper", 1224)],
            "shells": [[Any]](), "preview": [[Int]](), "ghosts": [[String: Any]](),
            "hud": hud, "events": [[String: Any]](),
        ]
    }
}

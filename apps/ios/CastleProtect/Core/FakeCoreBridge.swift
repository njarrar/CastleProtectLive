import Foundation

/// A stand-in for the Rust core, so screens, tests and UI tests run before the
/// XCFramework exists. It speaks the same JSON as the real core.
///
/// It is not the game. Its numbers are placeholders picked to make a battle
/// look and flow right on screen; the real rules live only in core/. The app
/// uses it only when the real core is not linked or a test asks for it.
final class FakeCoreBridge: CoreBridge {
    let name = "Stand-in core (no XCFramework linked)"
    let isStandIn = true

    private var state: FakeState?
    private var carryMs = 0
    private var pendingEvents: [[String: Any]] = []

    init() {}

    // MARK: CoreBridge

    func command(_ json: Data) -> Data {
        guard let obj = (try? JSONSerialization.jsonObject(with: json)) as? [String: Any],
              let cmd = obj["cmd"] as? String else {
            return reply(false, "bad_json")
        }
        if cmd == "new_battle" {
            startBattle(obj)
            return reply(true)
        }
        guard var s = state else { return reply(false, "no_battle") }
        defer { state = s }
        switch cmd {
        case "aim":
            guard s.phase == "plan" else { return reply(false, "not_now") }
            let angle = min(1800, max(0, (obj["angle"] as? Int) ?? s.aims[s.active].angle))
            let power = min(100, max(0, (obj["power"] as? Int) ?? s.aims[s.active].power))
            s.aims[s.active] = FakeAim(angle: angle, power: power, set: true)
            return reply(true)
        case "fire":
            guard s.phase == "plan", s.humans[s.active] else { return reply(false, "not_now") }
            guard s.aims[s.active].set else { return reply(false, "no_aim") }
            launch(&s)
            return reply(true)
        case "walk":
            guard s.phase == "plan", s.humans[s.active] else { return reply(false, "not_now") }
            let dx = (obj["dx"] as? Int) ?? 0
            guard dx != 0 else { return reply(true) }
            guard s.steamTurn < 40, s.steam > 0 else { return reply(false, "out_of_steam") }
            let step = 4
            let dir = dx > 0 ? 1 : -1
            let newX = s.forts[s.active].x + Double(dir * step)
            let otherX = s.forts[1 - s.active].x
            guard newX > 120, newX < s.worldW - 120, abs(newX - otherX) > 600 else { return reply(false, "blocked") }
            s.forts[s.active].x = newX
            s.steam -= step
            s.steamTurn += step
            return reply(true)
        case "pick_hob":
            guard let id = obj["id"] as? String, s.forts[s.active].hobs.contains(where: { $0.id == id && $0.hp > 0 }) else {
                return reply(false, "bad_hob")
            }
            s.selectedHob[s.active] = id
            return reply(true)
        case "pick_shot":
            guard let id = obj["id"] as? String, let shot = s.hands[s.active].first(where: { $0.id == id }), shot.uses != 0 else {
                return reply(false, "bad_shot")
            }
            s.selectedShot[s.active] = id
            return reply(true)
        case "draft_pick":
            guard s.phase == "draft", s.draftTurn == 0 || s.humans[s.draftTurn] else { return reply(false, "not_now") }
            guard let id = obj["id"] as? String, let i = s.pool.firstIndex(where: { $0.id == id && $0.takenBy < 0 }) else {
                return reply(false, "taken")
            }
            takeDraft(&s, index: i, side: s.draftTurn)
            return reply(true)
        case "quick_pick", "end_draft":
            guard s.phase == "draft" else { return reply(cmd == "end_draft") }
            while let side = nextDrafter(s), let i = s.pool.firstIndex(where: { $0.takenBy < 0 && !$0.dud }) ?? s.pool.firstIndex(where: { $0.takenBy < 0 }) {
                takeDraft(&s, index: i, side: side)
            }
            if cmd == "end_draft" { beginPlay(&s) }
            return reply(true)
        case "ready":
            guard s.phase == "handoff" else { return reply(false, "not_now") }
            s.phase = "plan"
            s.handoffLine = ""
            return reply(true)
        case "recall":
            return reply(true)
        case "speed":
            s.speed = ((obj["x"] as? Int) ?? 1) >= 2 ? 2 : 1
            return reply(true)
        case "give_up":
            finish(&s, winner: 1 - s.active, reason: "give_up")
            return reply(true)
        case "abandon":
            state = nil
            s = FakeState.empty
            return reply(true)
        default:
            return reply(false, "unknown_cmd")
        }
    }

    func advance(milliseconds: Int) {
        guard var s = state else { return }
        carryMs += max(0, min(milliseconds, 250))
        let ticks = carryMs * 120 / 1000
        carryMs -= ticks * 1000 / 120
        for _ in 0..<(ticks * s.speed) { step(&s) }
        state = s
    }

    func snapshot() -> Data {
        guard let s = state, s.phase != "none" else {
            return Data(#"{"phase":"none"}"#.utf8)
        }
        let events = pendingEvents
        pendingEvents.removeAll()
        let obj = snapshotObject(s, events: events)
        return (try? JSONSerialization.data(withJSONObject: obj)) ?? Data("{}".utf8)
    }

    func query(_ json: Data) -> Data {
        let obj = (try? JSONSerialization.jsonObject(with: json)) as? [String: Any] ?? [:]
        switch obj["q"] as? String {
        case "campaign":
            let pennants = obj["pennants"] as? [String: Int] ?? [:]
            return encode(Self.campaignObject(pennants: pennants))
        case "maps":
            return encode(MapChoice.fallback.map { ["id": $0.id, "name": $0.name] })
        case "version":
            return encode(["sim": "stand-in", "save_schema": 1] as [String: Any])
        default:
            return encode(["ok": false, "reason": "unknown_query"] as [String: Any])
        }
    }

    func save() -> Data {
        guard let s = state, s.phase != "none", s.phase != "ended" else { return Data() }
        return (try? JSONEncoder().encode(s)) ?? Data()
    }

    func load(_ data: Data) -> Bool {
        guard let s = try? JSONDecoder().decode(FakeState.self, from: data), s.forts.count == 2 else { return false }
        state = s
        pendingEvents.removeAll()
        return true
    }

    // MARK: Battle flow

    private func startBattle(_ obj: [String: Any]) {
        let mode = obj["mode"] as? String ?? "campaign"
        let level = obj["level"] as? String ?? ""
        let seed = (obj["seed"] as? UInt64) ?? UInt64(clamping: (obj["seed"] as? Int) ?? 1)
        var s = FakeState.empty
        s.mode = mode
        s.level = level
        s.rng = seed == 0 ? 0x9E37_79B9 : seed
        s.roundCap = (obj["rounds"] as? Int) ?? 15
        if mode == "campaign", let info = Self.levels.first(where: { $0.id == level }) {
            s.roundCap = info.roundCap
        }
        let windRule = obj["wind"] as? String ?? "light"
        s.windMax = windRule == "off" ? 0 : (windRule == "full" ? 6 : 3)
        if mode == "campaign", let n = Int(level.split(separator: "-").last ?? ""), n < 4 { s.windMax = 0 }
        let names = obj["names"] as? [String] ?? []
        if mode == "duel" {
            s.humans = [true, true]
            s.names = [names.first ?? "Player 1", names.count > 1 ? names[1] : "Player 2"]
            s.seatsHandoff = (obj["seats"] as? String ?? "side_by_side") == "side_by_side"
        } else {
            s.humans = [true, false]
            s.names = ["You", Self.levels.first(where: { $0.id == level })?.rival ?? "Rival"]
        }
        s.terrain = Self.makeTerrain(seed: s.rng, samples: 241, width: s.worldW)
        let crewCount: Int
        if mode == "campaign", let n = Int(level.split(separator: "-").last ?? "") {
            crewCount = n <= 1 ? 1 : (n <= 3 ? 2 : (n <= 6 ? 3 : 4))
        } else {
            crewCount = 4
        }
        s.forts = [
            Self.makeFort(side: 0, x: 380, crew: crewCount, names: Self.crewNames),
            Self.makeFort(side: 1, x: s.worldW - 380, crew: mode == "duel" ? crewCount : max(1, min(crewCount, 3)), names: Self.rivalNames),
        ]
        s.hands = [Self.baseHand(), Self.baseHand()]
        s.selectedHob = [s.forts[0].hobs.first?.id ?? "", s.forts[1].hobs.first?.id ?? ""]
        s.selectedShot = ["plain", "plain"]
        s.wind = Int(next(&s.rng) % UInt64(s.windMax * 2 + 1)) - s.windMax
        s.forecast = Int(next(&s.rng) % UInt64(s.windMax * 2 + 1)) - s.windMax
        let wantsDraft = (obj["draft"] as? Bool) ?? true
        let levelDraft = mode != "campaign" || (Self.levels.first(where: { $0.id == level })?.hasDraft ?? false)
        if wantsDraft && levelDraft {
            s.phase = "draft"
            s.pool = Self.draftPool
            s.draftTurn = 0
        } else {
            s.phase = "draft"
            s.pool = []
            s.draftDone = true
        }
        state = s
        pendingEvents.removeAll()
    }

    private func beginPlay(_ s: inout FakeState) {
        s.draftDone = true
        for side in 0..<2 {
            for id in s.draftHands[side] {
                if let chip = Self.draftPool.first(where: { $0.id == id }) {
                    s.hands[side].append(FakeShot(id: chip.id, name: chip.name, kind: "shell", uses: 1, weight: chip.weight))
                }
            }
        }
        s.phase = "plan"
        s.active = 0
        s.round = 1
        s.turnSeq = 1
        s.thinkTicks = 0
        event(["type": "turn", "side": 0, "amount": 1])
        event(["type": "audio", "cue": "turn_yours"])
    }

    private func nextDrafter(_ s: FakeState) -> Int? {
        if s.draftHands[0].count >= 2 && s.draftHands[1].count >= 2 { return nil }
        if !s.pool.contains(where: { $0.takenBy < 0 }) { return nil }
        return s.draftHands[s.draftTurn].count < 2 ? s.draftTurn : 1 - s.draftTurn
    }

    private func takeDraft(_ s: inout FakeState, index: Int, side: Int) {
        s.pool[index].takenBy = side
        s.draftHands[side].append(s.pool[index].id)
        s.draftTurn = 1 - side
        if s.draftHands[s.draftTurn].count >= 2 { s.draftTurn = side }
        s.draftWaitTicks = 48
        event(["type": "audio", "cue": "ui_card_pick"])
    }

    private func launch(_ s: inout FakeState) {
        let side = s.active
        let aim = s.aims[side]
        let start = muzzle(s, side: side)
        let rad = Double(aim.angle) / 10.0 * .pi / 180.0
        let speed = Double(aim.power) * 12.0
        s.shell = FakeShell(x: start.0, y: start.1, vx: cos(rad) * speed, vy: sin(rad) * speed, side: side, ticks: 0)
        if let i = s.hands[side].firstIndex(where: { $0.id == s.selectedShot[side] }), s.hands[side][i].uses > 0 {
            s.hands[side][i].uses -= 1
        }
        let keepFrom = s.round - 1
        s.pins.removeAll { $0.side == side && $0.round < keepFrom }
        s.phase = "flight"
        event(["type": "fire", "side": side, "x": start.0, "y": start.1])
        event(["type": "audio", "cue": "fire_launch"])
    }

    private func muzzle(_ s: FakeState, side: Int) -> (Double, Double) {
        let fort = s.forts[side]
        let facing: Double = side == 0 ? 1 : -1
        let x = fort.x + 40 * facing
        return (x, groundAt(s, fort.x) + 60)
    }

    private func step(_ s: inout FakeState) {
        switch s.phase {
        case "draft":
            guard !s.draftDone, !s.pool.isEmpty else { return }
            if s.draftTurn == 1 && !s.humans[1] {
                if s.draftWaitTicks > 0 { s.draftWaitTicks -= 1; return }
                if let i = s.pool.firstIndex(where: { $0.takenBy < 0 && !$0.dud }) {
                    takeDraft(&s, index: i, side: 1)
                }
            }
        case "plan":
            if !s.humans[s.active] {
                s.thinkTicks += 1
                if s.thinkTicks == 1 { aiAim(&s) }
                if s.thinkTicks > 132 { launch(&s) }
            }
        case "flight":
            stepShell(&s)
        case "resolve":
            s.resolveTicks -= 1
            if s.resolveTicks <= 0 { endTurn(&s) }
        default:
            break
        }
    }

    private func stepShell(_ s: inout FakeState) {
        guard var sh = s.shell else { s.phase = "resolve"; s.resolveTicks = 30; return }
        let dt = 1.0 / 120.0
        sh.vx += Double(s.wind) * 15 * dt
        sh.vy -= 900 * dt
        sh.x += sh.vx * dt
        sh.y += sh.vy * dt
        sh.ticks += 1
        s.shell = sh
        let hitBlock = s.forts.contains { f in f.blocks.contains { b in contains(b, fortX: f.x, s, sh.x, sh.y) } }
        if sh.x < 0 || sh.x > s.worldW || sh.y <= groundAt(s, sh.x) || hitBlock || sh.ticks > 1200 {
            impact(&s, x: sh.x, y: max(sh.y, groundAt(s, sh.x)))
        }
    }

    private func contains(_ b: FakeBlock, fortX: Double, _ s: FakeState, _ x: Double, _ y: Double) -> Bool {
        let base = groundAt(s, fortX)
        let bx = fortX + b.dx, by = base + b.dy
        return x >= bx && x <= bx + 16 && y >= by && y <= by + 16
    }

    private func impact(_ s: inout FakeState, x: Double, y: Double) {
        let side = s.shell?.side ?? s.active
        s.shell = nil
        let radius = 40.0
        var damage = 0
        for f in 0..<2 {
            let base = groundAt(s, s.forts[f].x)
            var broke = 0
            for i in s.forts[f].blocks.indices {
                let b = s.forts[f].blocks[i]
                let cx = s.forts[f].x + b.dx + 8, cy = base + b.dy + 8
                if hypot(cx - x, cy - y) < radius {
                    s.forts[f].blocks[i].hp -= 25
                    damage += 25
                    if s.forts[f].blocks[i].hp <= 0 { broke += 1 }
                }
            }
            s.forts[f].blocks.removeAll { $0.hp <= 0 }
            if broke > 0 {
                event(["type": "break", "x": x, "y": y, "amount": broke])
                event(["type": "audio", "cue": "block_break"])
            }
            for i in s.forts[f].hobs.indices where s.forts[f].hobs[i].hp > 0 {
                let h = s.forts[f].hobs[i]
                if hypot(s.forts[f].x + h.dx - x, base + h.dy + 16 - y) < radius {
                    s.forts[f].hobs[i].hp = max(0, h.hp - 20)
                    damage += 20
                    if s.forts[f].hobs[i].hp == 0 {
                        event(["type": "bonk", "side": f, "x": x, "y": y])
                        event(["type": "audio", "cue": "hob_bonk"])
                        event(["type": "haptic", "cue": f == side ? "bonk_yours" : "bonk_theirs"])
                    } else {
                        event(["type": "haptic", "cue": "hob_hit"])
                    }
                }
            }
            if hypot(s.forts[f].x - x, base + 10 - y) < radius + 8 {
                s.forts[f].kettleHp = max(0, s.forts[f].kettleHp - 30)
                damage += 30
            }
        }
        event(["type": "hit", "x": x, "y": y, "amount": damage])
        event(["type": "audio", "cue": damage > 40 ? "blast_large" : "blast_small"])
        event(["type": "haptic", "cue": damage > 40 ? "blast_large" : "blast_small"])
        s.lastLine = "\(s.names[side]) hit: \(damage) damage"
        s.pins.append(FakePin(x: x, y: y, side: side, round: s.round, hob: s.selectedHob[side]))
        s.phase = "resolve"
        s.resolveTicks = 60
    }

    private func endTurn(_ s: inout FakeState) {
        for f in 0..<2 {
            if s.forts[f].kettleHp <= 0 {
                event(["type": "kettle_pop", "side": f])
                event(["type": "haptic", "cue": "kettle_pop"])
                finish(&s, winner: 1 - f, reason: "kettle_pop")
                return
            }
            if !s.forts[f].hobs.contains(where: { $0.hp > 0 }) {
                finish(&s, winner: 1 - f, reason: "clean_sweep")
                return
            }
        }
        if s.active == 1 {
            s.round += 1
            if s.round > s.roundCap {
                let hp0 = s.forts[0].kettleHp + s.forts[0].hobs.reduce(0) { $0 + $1.hp }
                let hp1 = s.forts[1].kettleHp + s.forts[1].hobs.reduce(0) { $0 + $1.hp }
                finish(&s, winner: hp0 >= hp1 ? 0 : 1, reason: "squall")
                return
            }
        }
        s.active = 1 - s.active
        s.turnSeq += 1
        s.thinkTicks = 0
        s.steamTurn = 0
        s.wind = s.forecast
        s.forecast = Int(next(&s.rng) % UInt64(s.windMax * 2 + 1)) - s.windMax
        let picked = s.selectedHob[s.active]
        let pickedAlive = s.forts[s.active].hobs.contains { $0.id == picked && $0.hp > 0 }
        if !pickedAlive {
            s.selectedHob[s.active] = s.forts[s.active].hobs.first(where: { $0.hp > 0 })?.id ?? ""
        }
        if s.mode == "duel" && s.seatsHandoff {
            s.phase = "handoff"
            s.handoffLine = s.lastLine
        } else {
            s.phase = "plan"
        }
        event(["type": "turn", "side": s.active, "amount": s.round])
        event(["type": "audio", "cue": s.humans[s.active] ? "turn_yours" : "turn_theirs"])
    }

    private func finish(_ s: inout FakeState, winner: Int, reason: String) {
        s.phase = "ended"
        s.shell = nil
        let kettlePct = s.forts[0].kettleHp * 100 / max(1, s.forts[0].kettleMax)
        var goals: [[String: Any]] = []
        if s.mode == "campaign" {
            let won = winner == 0
            goals = [
                ["label": "Win", "done": won],
                ["label": "Win by Round 5", "done": won && s.round <= 5],
                ["label": "Kettle above 50%", "done": won && kettlePct > 50],
            ]
        }
        let pennants = goals.filter { ($0["done"] as? Bool) == true }.count
        s.result = FakeResult(winner: winner, reason: reason, pennants: pennants,
                              buttons: winner == 0 ? 100 + 50 * pennants : 40, round: s.round, goals: goals.map {
                                  FakeGoal(label: $0["label"] as? String ?? "", done: $0["done"] as? Bool ?? false)
                              })
        event(["type": "end", "side": winner, "text": reason])
        event(["type": "audio", "cue": winner == 0 || s.mode == "duel" ? "win_fanfare" : "loss_sting"])
    }

    /// The stand-in Rival: tries powers in the stand-in physics and keeps the
    /// closest, then adds a little error. Placeholder only.
    private func aiAim(_ s: inout FakeState) {
        let side = s.active
        let target = s.forts[1 - side].x
        let angle = side == 1 ? 1350 : 450
        var best = 70
        var bestMiss = Double.greatestFiniteMagnitude
        for p in stride(from: 30, through: 100, by: 2) {
            let land = simulate(s, side: side, angle: angle, power: p).last?.0 ?? 0
            let miss = abs(land - target)
            if miss < bestMiss { bestMiss = miss; best = p }
        }
        let jitter = Int(next(&s.rng) % 7) - 3
        s.aims[side] = FakeAim(angle: angle, power: min(100, max(0, best + jitter)), set: true)
    }

    private func simulate(_ s: FakeState, side: Int, angle: Int, power: Int) -> [(Double, Double)] {
        var (x, y) = muzzle(s, side: side)
        let rad = Double(angle) / 10.0 * .pi / 180.0
        var vx = cos(rad) * Double(power) * 12
        var vy = sin(rad) * Double(power) * 12
        let dt = 1.0 / 120.0
        var out: [(Double, Double)] = []
        for t in 0..<1200 {
            vx += Double(s.wind) * 15 * dt
            vy -= 900 * dt
            x += vx * dt
            y += vy * dt
            if t % 6 == 0 { out.append((x, y)) }
            if x < 0 || x > s.worldW || y <= groundAt(s, x) { break }
        }
        out.append((x, y))
        return out
    }

    // MARK: Snapshot

    private func snapshotObject(_ s: FakeState, events: [[String: Any]]) -> [String: Any] {
        let side = s.active
        var o: [String: Any] = [
            "tick": s.turnSeq * 1000 + (s.shell?.ticks ?? 0),
            "phase": s.phase,
            "mode": s.mode,
            "level": s.level,
            "round": s.round,
            "round_cap": s.roundCap,
            "squall_in": s.roundCap - s.round + 1 <= 3 ? s.roundCap - s.round + 1 : -1,
            "active_side": side,
            "turn_seq": s.turnSeq,
            "wind": s.wind,
            "forecast": s.forecast,
            "names": s.names,
            "humans": s.humans,
            "world": ["w": s.worldW, "h": s.worldH],
            "terrain": s.terrain,
            "selected_hob": s.selectedHob[side],
            "selected_shot": s.selectedShot[side],
            "aim": ["angle": s.aims[side].angle, "power": s.aims[side].power, "set": s.aims[side].set] as [String: Any],
            "can_fire": s.phase == "plan" && s.humans[side] && s.aims[side].set,
            "steam": s.steam,
            "steam_turn": s.steamTurn,
            "steam_max": 100,
            "speed": s.speed,
            "events": events,
        ]
        o["forts"] = (0..<2).map { f -> [String: Any] in
            let fort = s.forts[f]
            let base = groundAt(s, fort.x)
            return [
                "side": f,
                "x": fort.x,
                "kettle_x": fort.x,
                "kettle_y": base + 2,
                "kettle_hp": fort.kettleHp,
                "kettle_max": fort.kettleMax,
                "blocks": fort.blocks.map { b -> [String: Any] in
                    ["x": fort.x + b.dx, "y": base + b.dy, "w": 16, "h": 16, "mat": b.mat, "hp": b.hp, "hp_max": b.hpMax]
                },
                "hobs": fort.hobs.map { h -> [String: Any] in
                    ["id": h.id, "name": h.name, "class": h.cls, "hp": h.hp, "hp_max": h.hpMax,
                     "x": fort.x + h.dx, "y": base + h.dy, "bonked": h.hp <= 0,
                     "state": h.hp <= 0 ? "bonked" : "ready"]
                },
            ]
        }
        o["shots"] = s.hands[side].map { shot -> [String: Any] in ["id": shot.id, "name": shot.name, "kind": shot.kind, "uses": shot.uses, "weight": shot.weight, "ready": shot.uses != 0] }
        if s.phase == "plan" && s.humans[side] && s.aims[side].set {
            let path = simulate(s, side: side, angle: s.aims[side].angle, power: s.aims[side].power)
            let keep = max(1, path.count * 3 / 10)
            o["preview"] = path.prefix(keep).flatMap { [$0.0, $0.1] }
        } else {
            o["preview"] = [Double]()
        }
        o["pins"] = s.pins.map { pin -> [String: Any] in ["x": pin.x, "y": pin.y, "side": pin.side, "round": pin.round, "hob": pin.hob] }
        if let sh = s.shell {
            let shell: [String: Any] = ["x": sh.x, "y": sh.y, "kind": "plain"]
            o["shells"] = [shell]
        } else {
            o["shells"] = [[String: Any]]()
        }
        if s.phase == "draft" && !s.pool.isEmpty {
            o["draft"] = [
                "pool": s.pool.map { c -> [String: Any] in ["id": c.id, "name": c.name, "weight": c.weight, "hint": c.hint, "best_with": c.bestWith, "dud": c.dud, "taken_by": c.takenBy] },
                "picks_each": 2,
                "turn": s.draftTurn,
                "hands": s.draftHands,
                "wish": s.pool.first(where: { $0.takenBy < 0 && !$0.dud })?.name ?? "",
                "done": s.draftDone || nextDrafter(s) == nil,
            ] as [String: Any]
        }
        if s.phase == "handoff" {
            o["handoff"] = ["line": s.handoffLine, "to_side": side] as [String: Any]
        }
        if let r = s.result {
            o["result"] = [
                "winner": r.winner, "reason": r.reason, "pennants": r.pennants, "buttons": r.buttons, "round": r.round,
                "goals": r.goals.map { g -> [String: Any] in ["label": g.label, "done": g.done] },
            ] as [String: Any]
        }
        return o
    }

    // MARK: Helpers

    private func event(_ e: [String: Any]) { pendingEvents.append(e) }

    private func reply(_ ok: Bool, _ reason: String? = nil) -> Data {
        var o: [String: Any] = ["ok": ok]
        if let reason { o["reason"] = reason }
        return encode(o)
    }

    private func encode(_ obj: Any) -> Data {
        (try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])) ?? Data("{}".utf8)
    }

    private func groundAt(_ s: FakeState, _ x: Double) -> Double {
        guard s.terrain.count > 1 else { return 200 }
        let f = min(max(x / s.worldW, 0), 1) * Double(s.terrain.count - 1)
        let i = min(max(Int(f), 0), s.terrain.count - 2)
        let t = f - Double(i)
        return s.terrain[i] * (1 - t) + s.terrain[i + 1] * t
    }

    private func next(_ rng: inout UInt64) -> UInt64 {
        rng = rng &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return rng >> 33
    }

    // MARK: Stand-in content

    static let crewNames: [(String, String, String)] = [
        ("marge", "Marge", "lobber"), ("quill", "Quill", "zinger"), ("jax", "Jax", "scatterjack"),
        ("bobbin", "Bobbin", "boinker"), ("hetty", "Hetty", "patcher"),
    ]
    static let rivalNames: [(String, String, String)] = [
        ("thumper", "Old Thumper", "lobber"), ("nan", "Nan", "scatterjack"), ("grub", "Grub", "delver"),
        ("bobbin", "Bobbin", "boinker"), ("hetty", "Hetty", "patcher"),
    ]

    static let draftPool: [FakeDraftChip] = [
        FakeDraftChip(id: "marble_sack", name: "Marble Sack", weight: 1, hint: "Splits in three at the top.", bestWith: "scatterjack"),
        FakeDraftChip(id: "mole_mail", name: "Mole Mail", weight: 1, hint: "Digs under, pops up.", bestWith: "delver"),
        FakeDraftChip(id: "nosy_goose", name: "Nosy Goose", weight: 0, hint: "Steer it once in flight.", bestWith: "zinger"),
        FakeDraftChip(id: "lid_lifter", name: "Lid Lifter", weight: 2, hint: "Big hit on a kettle.", bestWith: "lobber"),
        FakeDraftChip(id: "pepper_pot", name: "Pepper Pot", weight: 1, hint: "Lights a small fire.", bestWith: "lobber"),
        FakeDraftChip(id: "tin_whistle", name: "Tin Whistle", weight: 0, hint: "Does nothing at all.", bestWith: "", dud: true),
    ]

    static let levels: [(id: String, name: String, rival: String, habit: String, goals: [String], hasDraft: Bool, roundCap: Int)] = [
        ("1-1", "First Lump", "Sir Pudge", "Shoots wide first. Then a bit closer.", ["Win", "Land 2 hits in a row", "Win by Round 5"], false, 8),
        ("1-2", "Two Hats", "Private Tuft Edgerly", "Shoots your top Hob first.", ["Win", "Bonk a Hob with each Hob", "No Hob of yours Bonked"], false, 10),
        ("1-3", "Kettle on the Knoll", "Corporal Fernsby Clip", "Hides his crew deep.", ["Win", "Win by Kettle Pop", "Your kettle above 50%"], false, 12),
        ("1-4", "Breezy Tops", "Rival", "", ["Win", "Land 3 hits in a row", "No Hob of yours Bonked"], false, 15),
        ("1-5", "The Big One", "Rival", "", ["Win", "Bonk a Hob with a Knack", "Your kettle above 60%"], false, 15),
        ("1-6", "Roof Trouble", "Rival", "Lobs down from the Stamp Tower.", ["Win", "No Hob of yours Bonked", "Your kettle above 60%"], false, 15),
        ("1-7", "Hetty in a Jam", "Rival", "", ["Free Hetty", "Captive takes no damage", "Free her by Round 6"], false, 14),
        ("1-8", "Rummage Sale", "Sgt Posy Rakewell", "Grabs the biggest shell in the Rummage.", ["Win", "Bonk a Hob with a Trick Shell", "Use both your Trick Shells"], true, 15),
        ("1-9", "Over Loaf Hill", "Rival", "", ["Win", "Land hits from two spots", "No Hob of yours Bonked"], true, 15),
        ("1-10", "The Topiary Keep", "Marshal Trimm", "", ["Beat Marshal Trimm", "Break the Sprinkler Root by Round 4", "The hill keeps half its height"], true, 18),
    ]

    static func campaignObject(pennants: [String: Int]) -> [String: Any] {
        var out: [[String: Any]] = []
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
            out.append([
                "id": l.id, "name": l.name, "kind": l.id == "1-10" ? "grand_fort" : (l.id == "1-7" ? "rescue" : "siege"),
                "state": state, "pennants": p, "rival": l.rival, "habit": l.habit, "goals": l.goals,
                "has_draft": l.hasDraft, "round_cap": l.roundCap,
            ])
        }
        return ["region": "Puddingstone Downs", "levels": out]
    }

    static func makeTerrain(seed: UInt64, samples: Int, width: Double) -> [Double] {
        let phase = Double(seed % 628) / 100.0
        return (0..<samples).map { i in
            let x = Double(i) / Double(samples - 1) * width
            let hump = 70 * exp(-pow((x - width / 2) / 260, 2))
            return 200 + hump + 18 * sin(x / 180 + phase) + 8 * sin(x / 61)
        }
    }

    static func makeFort(side: Int, x: Double, crew: Int, names: [(String, String, String)]) -> FakeFort {
        var blocks: [FakeBlock] = []
        for row in 0..<4 {
            for col in 0..<4 {
                let mat = row == 0 ? "cobble" : (row == 3 ? "wicker" : "timber")
                let hp = mat == "cobble" ? 80 : (mat == "timber" ? 50 : 30)
                blocks.append(FakeBlock(dx: Double(col * 16 - 32), dy: Double(row * 16), mat: mat, hp: hp, hpMax: hp))
            }
        }
        // Feet positions, relative to the fort centre and the ground.
        let spots: [(Double, Double)] = [(-16, 64), (16, 64), (-16, 32), (16, 32), (0, 96)]
        let hobs = (0..<min(crew, names.count)).map { i in
            FakeHob(id: names[i].0, name: names[i].1, cls: names[i].2, hp: 60, hpMax: 60,
                    dx: spots[i].0 * (side == 0 ? 1 : -1), dy: spots[i].1)
        }
        return FakeFort(x: x, kettleHp: 300, kettleMax: 300, blocks: blocks, hobs: hobs)
    }

    static func baseHand() -> [FakeShot] {
        [FakeShot(id: "plain", name: "Plain", kind: "plain", uses: -1, weight: 0),
         FakeShot(id: "knack", name: "Knack", kind: "knack", uses: 2, weight: 1)]
    }
}

// MARK: Stand-in state (Codable so save and resume work end to end)

struct FakeAim: Codable { var angle = 450; var power = 50; var set = false }
struct FakeBlock: Codable { var dx: Double; var dy: Double; var mat: String; var hp: Int; var hpMax: Int }
struct FakeHob: Codable { var id: String; var name: String; var cls: String; var hp: Int; var hpMax: Int; var dx: Double; var dy: Double }
struct FakeFort: Codable { var x: Double; var kettleHp: Int; var kettleMax: Int; var blocks: [FakeBlock]; var hobs: [FakeHob] }
struct FakeShot: Codable { var id: String; var name: String; var kind: String; var uses: Int; var weight: Int }
struct FakeShell: Codable { var x: Double; var y: Double; var vx: Double; var vy: Double; var side: Int; var ticks: Int }
struct FakePin: Codable { var x: Double; var y: Double; var side: Int; var round: Int; var hob: String }
struct FakeGoal: Codable { var label: String; var done: Bool }
struct FakeResult: Codable { var winner: Int; var reason: String; var pennants: Int; var buttons: Int; var round: Int; var goals: [FakeGoal] }
struct FakeDraftChip: Codable {
    var id: String; var name: String; var weight: Int; var hint: String; var bestWith: String
    var dud = false; var takenBy = -1
}

struct FakeState: Codable {
    var mode = "campaign"
    var level = ""
    var phase = "none"
    var rng: UInt64 = 1
    var worldW = 2400.0
    var worldH = 720.0
    var terrain: [Double] = []
    var forts: [FakeFort] = []
    var names = ["You", "Rival"]
    var humans = [true, false]
    var seatsHandoff = true
    var active = 0
    var round = 1
    var roundCap = 15
    var turnSeq = 0
    var wind = 0
    var forecast = 0
    var windMax = 3
    var aims = [FakeAim(), FakeAim(angle: 1350, power: 50, set: false)]
    var hands: [[FakeShot]] = [[], []]
    var selectedHob = ["", ""]
    var selectedShot = ["plain", "plain"]
    var steam = 100
    var steamTurn = 0
    var speed = 1
    var shell: FakeShell?
    var pins: [FakePin] = []
    var thinkTicks = 0
    var resolveTicks = 0
    var pool: [FakeDraftChip] = []
    var draftHands: [[String]] = [[], []]
    var draftTurn = 0
    var draftWaitTicks = 0
    var draftDone = false
    var lastLine = ""
    var handoffLine = ""
    var result: FakeResult?

    static let empty = FakeState()
}

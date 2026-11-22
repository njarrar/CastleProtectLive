import Foundation

/// Turns the core's snapshots into the view model, frame by frame.
///
/// It keeps the last full snapshot (lean snapshots only carry shells, phase
/// and events), keeps the terrain grid that the core sends in dirty chunks,
/// and flips y from the core's "down" to the view's "up". It decides nothing:
/// every number comes from the core.
final class FrameAssembler {
    private let catalog: ContentCatalog
    private var lastFull: CoreSnapshot?
    private var grid: [UInt8] = []
    private var gridW = 0
    private var gridH = 0
    private var heights: [Double] = []
    private var heightsDirty = true
    private var hasTerrain = false
    private var steamMax = [0, 0]
    private var lastShotLine = ""
    private var shotDamage = 0
    private var shotSide = 0

    /// Columns between ground samples handed to the renderer.
    static let sampleStep = 8

    init(catalog: ContentCatalog) {
        self.catalog = catalog
    }

    func reset() {
        lastFull = nil
        grid = []
        gridW = 0
        gridH = 0
        heights = []
        heightsDirty = true
        hasTerrain = false
        steamMax = [0, 0]
        lastShotLine = ""
        shotDamage = 0
    }

    /// The line for the Couch Duel hand-off card: who fired, what it hit.
    var handoffLine: String { lastShotLine }

    /// Builds the view frame. `handoff` is the app's own hand-off card state (Couch Duel).
    func assemble(_ raw: CoreSnapshot, handoffTo: Int?, speed: Int) -> BattleSnapshot {
        applyTerrain(raw)
        var full = raw
        if !raw.full, let last = lastFull {
            full = last
            full.tick = raw.tick
            full.phase = raw.phase
            full.side = raw.side
            full.awaiting = raw.awaiting
            full.shells = raw.shells
            full.events = raw.events
        } else {
            lastFull = raw
        }
        noteShots(raw.events, names: full.hud.names)
        return view(full, handoffTo: handoffTo, speed: speed)
    }

    // MARK: Terrain

    private func applyTerrain(_ raw: CoreSnapshot) {
        let w = raw.full || gridW == 0 ? raw.map.w : gridW
        let h = raw.full || gridH == 0 ? raw.map.h : gridH
        if w != gridW || h != gridH {
            gridW = w
            gridH = h
            grid = [UInt8](repeating: 0, count: w * h)
            heightsDirty = true
        }
        for chunk in raw.terrain.chunks {
            guard let bytes = Data(base64Encoded: chunk.data), bytes.count >= chunk.w * chunk.h else { continue }
            bytes.withUnsafeBytes { (src: UnsafeRawBufferPointer) in
                for row in 0..<chunk.h {
                    let gy = chunk.y + row
                    guard gy >= 0, gy < gridH else { continue }
                    for col in 0..<chunk.w {
                        let gx = chunk.x + col
                        guard gx >= 0, gx < gridW else { continue }
                        grid[gy * gridW + gx] = src[row * chunk.w + col]
                    }
                }
            }
            heightsDirty = true
            hasTerrain = true
        }
    }

    /// Ground height (y up) per sample column: the first non-air cell from the top.
    private func groundHeights(fallback: CoreSnapshot) -> [Double] {
        guard heightsDirty else { return heights }
        heightsDirty = false
        guard gridW > 0, gridH > 0, hasTerrain else {
            // No terrain sent yet: a flat floor at the forts' feet, so the view is never empty.
            let base = fallback.castles.map(\.baseY).max() ?? (gridH * 3 / 4)
            heights = [Double](repeating: Double(gridH - base), count: max(2, gridW / Self.sampleStep + 1))
            heightsDirty = true
            return heights
        }
        var out: [Double] = []
        var x = 0
        while x < gridW {
            var y = 0
            while y < gridH && grid[y * gridW + x] == 0 { y += 1 }
            out.append(Double(gridH - y))
            x += Self.sampleStep
        }
        if out.count < 2 { out.append(out.first ?? 0) }
        heights = out
        return out
    }

    // MARK: Hand-off line

    private func noteShots(_ events: [CoreEvent], names: [String]) {
        for e in events {
            switch e.t {
            case "fire":
                shotSide = e.side ?? 0
                shotDamage = 0
            case "hit":
                shotDamage += e.dmg ?? 0
            case "turn_start":
                let who = shotSide < names.count ? names[shotSide] : "Player \(shotSide + 1)"
                lastShotLine = shotDamage > 0 ? "\(who) hit: \(shotDamage) damage" : "\(who) missed"
            default:
                break
            }
        }
    }

    // MARK: View model

    private func view(_ s: CoreSnapshot, handoffTo: Int?, speed: Int) -> BattleSnapshot {
        let H = Double(max(1, s.map.h))
        var v = BattleSnapshot()
        v.tick = s.tick
        switch s.phase {
        case "draft": v.phase = .draft
        case "plan": v.phase = handoffTo == nil ? .plan : .handoff
        case "resolve": v.phase = s.shells.isEmpty ? .resolve : .flight
        case "settle": v.phase = .resolve
        case "ended": v.phase = .ended
        default: v.phase = .none
        }
        v.mode = s.mode == "couch" ? "duel" : s.mode
        v.level = s.level
        let hud = s.hud
        v.round = hud.round
        v.roundCap = hud.roundCap
        v.squallIn = hud.squallWarning ?? -1
        v.squallRound = hud.squallRound
        v.activeSide = s.side
        v.turnSeq = hud.turn
        v.wind = hud.wind
        v.forecast = hud.forecast
        v.names = hud.names.count >= 2 ? hud.names : ["You", "Rival"]
        if v.mode == "campaign" || v.mode == "skirmish" { v.names[0] = "You" }
        v.humans = hud.control.count >= 2 ? hud.control.map { $0 == "human" } : [true, false]
        v.world = WorldSize(w: Double(s.map.w), h: H)
        v.terrain = groundHeights(fallback: s)
        v.speed = speed

        let shimmerKeys = s.castles.map { Set($0.shimmer.map { $0.count >= 2 ? $0[0] * 1000 + $0[1] : -1 }) }
        v.forts = s.castles.map { cs in
            let shimmer = cs.side < shimmerKeys.count ? shimmerKeys[cs.side] : []
            let blocks = cs.blocks.map { b in
                BlockView(x: Double(b.x), y: H - Double(b.y + cs.block), w: Double(cs.block), h: Double(cs.block),
                          material: b.mat, hp: b.hp, hpMax: b.max, shimmer: shimmer.contains(b.c * 1000 + b.r))
            }
            let hobs = s.hobs.filter { $0.side == cs.side }.map { h in
                HobView(id: String(h.id), def: h.def, name: h.name, cls: h.cls, hp: h.hp, hpMax: h.max,
                        x: Double(h.x), y: H - Double(h.y), bonked: h.state == "bonked", rest: h.rest,
                        state: h.state, buried: h.buried)
            }
            let k = cs.kettle.box
            let kx = k.count >= 4 ? Double(k[0] + k[2]) / 2 : Double(cs.x + cs.cols * cs.block / 2)
            let ky = k.count >= 4 ? H - Double(k[3] + 1) : H - Double(cs.baseY)
            return FortView(side: cs.side, x: Double(cs.x + cs.cols * cs.block / 2), kettleX: kx, kettleY: ky,
                            kettleHp: cs.kettle.hp, kettleMax: cs.kettle.max, blocks: blocks, hobs: hobs)
        }

        // Steam: the bar shows what is left of the most seen.
        if hud.steam.count >= 2 {
            for i in 0..<2 { steamMax[i] = max(steamMax[i], hud.steam[i]) }
        }
        let side = min(max(0, s.side), 1)
        v.steam = side < hud.steam.count ? hud.steam[side] : 0
        v.steamMax = max(1, steamMax[side])
        v.steamTurn = 40 - hud.steamTurnLeft

        // The active side's selection, shots and aim.
        let selected = s.hobs.first { $0.id == hud.selected.hob }
        v.selectedHob = selected.map { String($0.id) }
        v.selectedShot = hud.selected.shot
        if let h = selected {
            v.aim = AimView(angle: h.aim.angle, power: h.aim.power, set: true)
            v.dugIn = h.buried
            var shots = [ShotChip(id: "plain", name: catalog.shotName(h.plain), kind: "plain", art: h.plain, uses: -1,
                                  weight: CoreHandShell.cogs(catalog.shots[h.plain]?.weight ?? "L"))]
            if let knack = h.knack {
                shots.append(ShotChip(id: "knack", name: catalog.shotName(knack), kind: "knack", art: knack,
                                      uses: h.knackUses, weight: CoreHandShell.cogs(catalog.shots[knack]?.weight ?? "M"),
                                      ready: h.knackUses > 0 && h.rest == 0))
            }
            let hand = side < hud.hands.count ? hud.hands[side] : []
            for shell in hand {
                shots.append(ShotChip(id: shell.id, name: shell.dud ? "Dud" : shell.name, kind: "shell", art: shell.id,
                                      uses: 1, weight: CoreHandShell.cogs(shell.weight), best: shell.match == h.cls))
            }
            v.shots = shots
        }
        v.canFire = s.phase == "plan" && s.awaiting == "human" && (selected?.canFire ?? false) && handoffTo == nil

        var flat: [Double] = []
        flat.reserveCapacity(s.preview.count * 2)
        for p in s.preview where p.count >= 2 {
            flat.append(Double(p[0]))
            flat.append(H - Double(p[1]))
        }
        v.preview = flat
        v.pins = s.ghosts.compactMap { g in
            guard let pin = g.pin, pin.count >= 2 else { return nil }
            return PinView(x: Double(pin[0]), y: H - Double(pin[1]), side: g.side, round: g.round,
                           spent: g.recalled, hob: String(g.hob))
        }
        v.ghostCount = [s.ghosts.filter { $0.side == 0 }.count, s.ghosts.filter { $0.side == 1 }.count]
        v.shells = s.shells.map { ShellView(x: Double($0.x), y: H - Double($0.y), kind: $0.shot) }

        if let d = s.draft {
            var pool = d.pool.map { id in
                DraftChip(id: id, name: catalog.shotName(id), weight: CoreHandShell.cogs(catalog.shots[id]?.weight ?? "L"),
                          hint: catalog.shots[id]?.card ?? "")
            }
            for (pickSide, picks) in d.picks.enumerated() {
                for id in picks where !pool.contains(where: { $0.id == id }) {
                    pool.append(DraftChip(id: id, name: catalog.shotName(id), hint: catalog.shots[id]?.card ?? "", takenBy: pickSide))
                }
            }
            v.draft = DraftView(pool: pool, picksEach: d.picksEach, turn: d.next, hands: d.picks,
                                wish: d.wish.map { catalog.shotName($0) }, done: s.phase != "draft")
        }

        if let r = s.result {
            let labels = catalog.level(s.level)?.goals ?? []
            let goals = r.pennants.enumerated().map { i, done in
                GoalView(label: i < labels.count ? labels[i] : "Pennant \(i + 1)", done: done)
            }
            v.result = BattleResult(winner: r.winner, reason: r.how, pennants: r.pennants.filter { $0 }.count,
                                    buttons: 0, round: r.round, goals: goals)
        }
        if let to = handoffTo {
            v.handoff = HandoffView(line: lastShotLine, toSide: to)
        }
        v.events = s.events.compactMap { Self.event($0, mapHeight: H) }
        return v
    }

    /// The core's event in the app's words.
    static func event(_ e: CoreEvent, mapHeight H: Double) -> BattleEvent? {
        let x = Double(e.x ?? 0)
        let y = H - Double(e.y ?? 0)
        switch e.t {
        case "turn_start": return BattleEvent(type: "turn", side: e.side ?? -1, amount: e.round ?? 0)
        case "fire": return BattleEvent(type: "fire", side: e.side ?? -1)
        case "explode": return BattleEvent(type: "hit", x: x, y: y, amount: e.dmg ?? 0)
        case "hit": return BattleEvent(type: "damage", side: e.side ?? -1, amount: e.dmg ?? 0, text: e.target ?? "")
        case "break": return BattleEvent(type: "break", side: e.side ?? -1)
        case "collapse", "big_drop": return BattleEvent(type: "fall", side: e.side ?? -1)
        case "bonk": return BattleEvent(type: "bonk", side: e.side ?? -1)
        case "kettle_pop": return BattleEvent(type: "kettle_pop", side: e.side ?? -1)
        case "squall_warning": return BattleEvent(type: "squall_warn", amount: e.n ?? 0, text: e.text ?? "")
        case "squall", "squall_round": return BattleEvent(type: "squall", amount: e.n ?? 0)
        case "thump": return BattleEvent(type: "thump", side: e.side ?? -1)
        case "threaded": return BattleEvent(type: "threaded", side: e.side ?? -1)
        case "win": return BattleEvent(type: "end", side: e.winner ?? -1, text: e.how ?? "")
        default: return BattleEvent(type: e.t, side: e.side ?? -1, x: x, y: y)
        }
    }
}

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
    private var lastView: BattleSnapshot?
    /// The hand-off state the last view was built with.
    private var lastHandoff: Int?
    private var grid: TerrainGrid?
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
        lastView = nil
        lastHandoff = nil
        grid = nil
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
        if !raw.full, var merged = lastFull, var v = lastView {
            noteShots(raw.events, names: merged.hud.names)
            // Merge the lean frame into the last full one (core/API.md: keep everything else,
            // replace `aim` and `preview`), so a later rebuild starts from the newest state.
            merged.tick = raw.tick
            merged.phase = raw.phase
            merged.side = raw.side
            merged.awaiting = raw.awaiting
            merged.shells = raw.shells
            merged.events = raw.events
            merged.terrain = CoreTerrain()
            if let aim = raw.aim {
                if let i = merged.hobs.firstIndex(where: { $0.id == aim.hob && $0.side == aim.side }) {
                    merged.hobs[i].aim.angle = aim.angle
                    merged.hobs[i].aim.power = aim.power
                }
                merged.preview = raw.preview
            }
            var stored = merged
            stored.events = []
            lastFull = stored
            if raw.phase == "plan" || raw.phase == "draft" || handoffTo != lastHandoff {
                // Plan frames only come after a command (or READY on the hand-off card), so
                // rebuilding the view here is cheap and keeps the aim readout, the preview and
                // Fire in step with the core (review 2, H1 and H2).
                var rebuilt = view(merged, handoffTo: handoffTo, speed: speed)
                rebuilt.lean = true
                lastView = rebuilt
                lastHandoff = handoffTo
                return rebuilt
            }
            // Lean in flight: only shells, phase and tick move. Forts, HUD and props stay as built (H8).
            let H = Double(max(1, merged.map.h))
            v.lean = true
            v.tick = raw.tick
            v.activeSide = min(max(0, raw.side), 1)
            switch raw.phase {
            case "resolve": v.phase = raw.shells.isEmpty ? .resolve : .flight
            case "settle": v.phase = .resolve
            case "ended": v.phase = .ended
            default: v.phase = .none
            }
            v.canFire = false
            v.preview = []
            v.shells = raw.shells.map { ShellView(x: Double($0.x), y: H - Double($0.y), kind: $0.shot, rot: $0.rot) }
            v.speed = speed
            if !raw.terrain.chunks.isEmpty { v.terrain = groundHeights(fallback: merged) }
            v.ground = grid
            v.events = raw.events.compactMap { Self.event($0, mapHeight: H) }
            lastView = v
            return v
        }
        lastFull = raw
        noteShots(raw.events, names: raw.hud.names)
        let v = view(raw, handoffTo: handoffTo, speed: speed)
        lastView = v
        lastHandoff = handoffTo
        return v
    }

    // MARK: Terrain

    private func applyTerrain(_ raw: CoreSnapshot) {
        if raw.full || grid == nil {
            let w = min(raw.map.w, TerrainGrid.maxSide), h = min(raw.map.h, TerrainGrid.maxSide)
            if grid == nil || grid?.w != w || grid?.h != h || grid?.chunk != raw.map.chunk {
                grid = TerrainGrid(w: w, h: h, chunk: raw.map.chunk)
                heightsDirty = true
            }
        }
        guard let grid else { return }
        for chunk in raw.terrain.chunks where grid.apply(x: chunk.x, y: chunk.y, w: chunk.w, h: chunk.h, base64: chunk.data) {
            heightsDirty = true
        }
    }

    /// Ground height (y up) per sample column, for the camera only: the field
    /// itself is drawn from the cell grid.
    private func groundHeights(fallback: CoreSnapshot) -> [Double] {
        guard heightsDirty else { return heights }
        heightsDirty = false
        guard let grid, grid.hasData else {
            // No terrain sent yet: a flat floor at the forts' feet, so the view is never empty.
            let gh = grid?.h ?? fallback.map.h
            let base = fallback.castles.map(\.baseY).max() ?? (gh * 3 / 4)
            heights = [Double](repeating: Double(gh - base), count: max(2, (grid?.w ?? fallback.map.w) / Self.sampleStep + 1))
            heightsDirty = true
            return heights
        }
        var out: [Double] = []
        var x = 0
        while x < grid.w {
            out.append(Double(grid.surface(x)))
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
        // Clamped once here, so every later lookup by side is safe (L1).
        v.activeSide = min(max(0, s.side), 1)
        v.turnSeq = hud.turn
        v.wind = hud.wind
        v.forecast = hud.forecast
        v.names = hud.names.count >= 2 ? hud.names : ["You", "Rival"]
        if v.mode == "campaign" || v.mode == "skirmish" || v.mode == "daily" { v.names[0] = "You" }
        v.humans = hud.control.count >= 2 ? hud.control.map { $0 == "human" } : [true, false]
        // Test Yard (rules 3): side 1 is always the Dummy side and passes itself, so only side 0
        // is ever a person, whatever the setup said.
        if s.mode == "test_yard" { v.humans = [true, false] }
        v.world = WorldSize(w: Double(s.map.w), h: H)
        v.terrain = groundHeights(fallback: s)
        v.ground = grid
        v.speed = speed
        let humanActive = s.side >= 0 && s.side < v.humans.count ? v.humans[s.side] : false
        v.fatigue = hud.fatigue
        v.fatigueRound = hud.fatigueRound
        v.fatigueIn = hud.fatigueIn
        // The Rival's live aim is never shown (core/API.md, M8), nor during the hand-off card.
        let showAim = humanActive && handoffTo == nil

        let shimmerKeys = s.castles.map { Set($0.shimmer.map { $0.count >= 2 ? $0[0] * 1000 + $0[1] : -1 }) }
        v.forts = s.castles.map { cs in
            let shimmer = cs.side < shimmerKeys.count ? shimmerKeys[cs.side] : []
            let blocks = cs.blocks.map { b in
                BlockView(x: Double(b.x), y: H - Double(b.y + cs.block), w: Double(cs.block), h: Double(cs.block),
                          material: b.mat, hp: b.hp, hpMax: b.max, shimmer: shimmer.contains(b.c * 1000 + b.r),
                          battered: b.battered, root: b.root)
            }
            let hobs = s.hobs.filter { $0.side == cs.side }.map { h in
                HobView(id: String(h.id), def: h.def, name: h.name, cls: h.cls, hp: h.hp, hpMax: h.max,
                        x: Double(h.x), y: H - Double(h.y), bonked: h.state == "bonked", rest: h.rest,
                        state: h.state, buried: h.buried, canFire: h.canFire)
            }
            let k = cs.kettle.box
            let kx = k.count >= 4 ? Double(k[0] + k[2]) / 2 : Double(cs.x + cs.cols * cs.block / 2)
            let ky = k.count >= 4 ? H - Double(k[3] + 1) : H - Double(cs.baseY)
            var fort = FortView(side: cs.side, x: Double(cs.x + cs.cols * cs.block / 2), kettleX: kx, kettleY: ky,
                                kettleHp: cs.kettle.hp, kettleMax: cs.kettle.max, blocks: blocks, hobs: hobs)
            fort.originX = Double(cs.x)
            fort.baseY = H - Double(cs.baseY)
            fort.block = Double(max(1, cs.block))
            fort.cols = cs.cols
            fort.fatigue = cs.fatigue
            fort.kettleRoom = CGRectLike(core: cs.kettle.room, mapHeight: H)
            fort.kettleLid = cs.kettle.lid
            fort.rooms = cs.rooms.compactMap { r in
                guard let box = CGRectLike(core: r.box, mapHeight: H) else { return nil }
                return RoomView(id: r.id, box: box, loophole: CGRectLike(core: r.loophole, mapHeight: H),
                                intact: r.intact, flap: r.flap, lid: r.lid)
            }
            return fort
        }

        // Steam: the bar's 100% is the core's `steam_max` (v0.2), else the most seen.
        if hud.steam.count >= 2 {
            for i in 0..<2 {
                steamMax[i] = i < hud.steamMax.count && hud.steamMax[i] > 0 ? hud.steamMax[i] : max(steamMax[i], hud.steam[i])
            }
        }
        v.shoveOffCost = hud.shoveOffCost
        v.helpMarks = (0..<2).map { i in
            guard i < hud.handicap.count else { return "" }
            return (HelpLevel(rawValue: hud.handicap[i].help) ?? .none).marks
        }
        if let volley = hud.volley {
            v.volleyActions = volley.actions
            v.volleyLeft = volley.left
        }
        if let boss = hud.boss {
            v.boss = BossView(phase: boss.phase, cut: boss.cut.flatMap { CGRectLike(core: $0, mapHeight: H) },
                              jam: boss.jam, rollerDone: boss.rollerDone)
        }
        v.objective = hud.rules.objectiveTag
        v.objectiveCount = hud.rules.objectiveCount
        v.score = hud.score
        v.squall = hud.squall
        let side = min(max(0, s.side), 1)
        v.steam = side < hud.steam.count ? hud.steam[side] : 0
        v.steamMax = max(1, steamMax[side])
        v.steamTurn = max(0, 40 - hud.steamTurnLeft)
        v.doodads = side < hud.doodads.count ? hud.doodads[side] : []
        v.puffUp = side < hud.puffUp.count ? hud.puffUp[side] : false
        v.props = s.props.map { p in
            PropView(id: p.id, kind: p.kind, tag: p.tag, x: Double(p.x), y: H - Double(p.y), hp: p.hp, hpMax: p.max,
                     shot: p.shot ?? "")
        }

        // The active side's selection, shots and aim.
        let selected = s.hobs.first { $0.id == hud.selected.hob }
        v.selectedHob = selected.map { String($0.id) }
        v.selectedShot = hud.selected.shot
        if let h = selected {
            v.aim = showAim ? AimView(angle: h.aim.angle, power: h.aim.power, set: true) : AimView(set: false)
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
            // v0.2: the core says which chips `fire` would take, and why not.
            if !hud.shots.isEmpty {
                for i in shots.indices {
                    if let state = hud.shots.first(where: { $0.shot == shots[i].id }) {
                        shots[i].ready = state.ready
                        shots[i].why = state.ready ? nil : state.why
                        shots[i].text = state.ready ? nil : (state.text ?? state.why.map(BattleSession.refusalText))
                    }
                }
            }
            v.shots = shots
        }
        // Rules 3: Fire is lit only when the core says the selected shot would go (`hud.fire`).
        // An older core has no `hud.fire`: the Hob's `can_fire` decides, as before.
        let fireReady = hud.fire?.ready ?? (selected?.canFire ?? false)
        let planning = s.phase == "plan" && s.awaiting == "human" && handoffTo == nil
        v.canFire = planning && fireReady
        if planning, showAim, let fire = hud.fire, !fire.ready {
            v.fireText = fire.text ?? fire.why.map(BattleSession.refusalText)
        }

        var flat: [Double] = []
        flat.reserveCapacity(s.preview.count * 2)
        for p in s.preview where p.count >= 2 && showAim {
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
        v.shells = s.shells.map { ShellView(x: Double($0.x), y: H - Double($0.y), kind: $0.shot, rot: $0.rot) }

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
                                    buttons: r.buttons, round: r.round, goals: goals, pennantFlags: r.pennants,
                                    pennantsNew: r.pennantsNew, score: r.score, stats: r.stats, broke: r.broke)
            v.result?.bestShots = r.stats.map(\.bestShot)
            // `best_shot` is the winner's; never show a shot of the losing side as "Best shot".
            if let best = r.bestShot, best.side == r.winner {
                v.result?.bestShot = best
            } else if r.winner >= 0, r.winner < r.stats.count {
                v.result?.bestShot = r.stats[r.winner].bestShot
            }
        }
        if let to = handoffTo {
            v.handoff = HandoffView(line: lastShotLine, toSide: to)
        }
        v.events = s.events.compactMap { Self.event($0, mapHeight: H) }
        return v
    }

    /// The core's event in the app's words.
    static func event(_ e: CoreEvent, mapHeight H: Double) -> BattleEvent? {
        guard var out = plainEvent(e, mapHeight: H) else { return nil }
        out.raw = e
        if e.x != nil {
            out.x = Double(e.x ?? 0)
            out.y = H - Double(e.y ?? 0)
        }
        return out
    }

    private static func plainEvent(_ e: CoreEvent, mapHeight H: Double) -> BattleEvent? {
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
        case "fatigue_warning":
            let words = e.text.map { $0.isEmpty ? BattleSession.fatigueWarnText : $0 } ?? BattleSession.fatigueWarnText
            return BattleEvent(type: "fatigue_warn", amount: e.round ?? 0, text: words)
        case "fatigue": return BattleEvent(type: "fatigue", amount: e.round ?? 0, text: BattleSession.fatigueStartText)
        case "shot_switch": return BattleEvent(type: "shot_switch", side: e.side ?? -1, amount: e.hob ?? -1, text: e.why ?? "")
        case "thump": return BattleEvent(type: "thump", side: e.side ?? -1)
        case "threaded": return BattleEvent(type: "threaded", side: e.side ?? -1)
        case "win": return BattleEvent(type: "end", side: e.winner ?? -1, text: e.how ?? "")
        default: return BattleEvent(type: e.t, side: e.side ?? -1, x: x, y: y)
        }
    }
}

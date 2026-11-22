import XCTest
@testable import CastleProtect

// Core rules 3 and the QA playtest 1 lessons (core/API.md, "Changes for QA playtest 1";
// docs/qa/playtest-1/REPORT.md, "Core fixes" and "Web fixes"). The real-core tests run only
// when CastleCore.xcframework is linked; CI requires them to pass.

// MARK: Helpers

/// The plan fixture as a JSON object, to change a field and decode it again.
private func planObject() throws -> [String: Any] {
    let text = try fixtureText("snapshot_plan")
    return try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
}

private func json(_ object: [String: Any]) throws -> String {
    String(decoding: try JSONSerialization.data(withJSONObject: object), as: UTF8.self)
}

@MainActor
private func assemble(_ object: [String: Any]) throws -> BattleSnapshot {
    let raw = try XCTUnwrap(CoreSnapshot.decode(try json(object)))
    return FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
}

/// A rest turn as rules 3 sends it: the Knack picked, Fire grey with the core's words.
private func restingPlan(selected: String = "knack", events: [[String: Any]] = [], turn: Int? = nil) throws -> [String: Any] {
    var plan = try planObject()
    var hud = plan["hud"] as? [String: Any] ?? [:]
    let words = "Marge Dumpling needs a rest: Plain Shot only"
    var sel = hud["selected"] as? [String: Any] ?? [:]
    sel["shot"] = selected
    hud["selected"] = sel
    hud["shots"] = [
        ["shot": "plain", "id": "clodpot", "ready": true, "why": NSNull(), "text": NSNull()],
        ["shot": "knack", "id": "grand_dumpling", "ready": false, "why": "resting_plain_only", "text": words],
    ]
    hud["fire"] = selected == "knack"
        ? ["ready": false, "why": "resting_plain_only", "text": words] as [String: Any]
        : ["ready": true, "why": NSNull(), "text": NSNull()] as [String: Any]
    if let turn { hud["turn"] = turn }
    plan["hud"] = hud
    plan["events"] = events
    return plan
}

/// A core stand-in that plays the snapshots a test queues and answers commands from a closure.
final class RulesThreeBridge: CoreBridge {
    let name = "Scripted test core"
    let isStandIn = true
    let version = #"{"sim":"test","rules":3,"tick_hz":120}"#
    private let lock = NSLock()
    private var frames: [String] = []
    private var last = ""
    private(set) var commands: [String] = []
    var answer: (String) -> String = { _ in #"{"ok":true}"# }

    func queue(_ snapshot: String) {
        lock.lock(); frames.append(snapshot); lock.unlock()
    }

    func start(setup: String, seed: UInt64) -> String? { nil }

    func command(_ json: String) -> String {
        lock.lock(); commands.append(json); lock.unlock()
        if json.contains(#""cmd":"log""#) { return #"{"ok":true,"log":[]}"# }
        if json.contains(#""cmd":"hash""#) { return #"{"ok":true,"hash":"0000000000000000"}"# }
        return answer(json)
    }

    func step(_ ticks: Int) -> String { #"{"tick":1,"phase":"plan"}"# }

    func snapshot() -> String {
        lock.lock(); defer { lock.unlock() }
        if !frames.isEmpty { last = frames.removeFirst() }
        return last
    }

    func end() {}
}

// MARK: M1: Fire from hud.fire, unready chips, refused Fire

final class FireStateTests: XCTestCase {
    func testPlanFixtureCarriesRulesThreeFields() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        XCTAssertEqual(raw.hud.fire?.ready, true)
        XCTAssertNil(raw.hud.fire?.why)
        XCTAssertEqual(raw.hud.fatigueRound, 10)
        XCTAssertFalse(raw.hud.fatigue)
        XCTAssertNotNil(raw.hud.fatigueIn)
        XCTAssertFalse(raw.hud.shots.isEmpty)
    }

    @MainActor
    func testFireIsLitFromHudFireAndUnreadyChipsSayWhy() throws {
        let v = try assemble(try restingPlan())
        XCTAssertFalse(v.canFire, "hud.fire.ready false greys Fire even though the Hob can fire")
        XCTAssertEqual(v.fireText, "Marge Dumpling needs a rest: Plain Shot only")
        let knack = try XCTUnwrap(v.shots.first { $0.id == "knack" })
        XCTAssertFalse(knack.ready)
        XCTAssertEqual(knack.why, "resting_plain_only")
        XCTAssertEqual(knack.text, "Marge Dumpling needs a rest: Plain Shot only")
        XCTAssertEqual(ShotChip.shortReason(why: knack.why), "Resting")
        let plain = try XCTUnwrap(v.shots.first { $0.id == "plain" })
        XCTAssertTrue(plain.ready)
        XCTAssertNil(plain.text)
        let hud = HudState(v)
        XCTAssertFalse(hud.canFire)
        XCTAssertEqual(hud.fireText, v.fireText)
        // The plain pick lights Fire again.
        let lit = try assemble(try restingPlan(selected: "plain"))
        XCTAssertTrue(lit.canFire)
        XCTAssertNil(lit.fireText)
    }

    @MainActor
    func testAnOlderCoreWithoutHudFireStillLightsFire() throws {
        var plan = try planObject()
        var hud = plan["hud"] as? [String: Any] ?? [:]
        hud.removeValue(forKey: "fire")
        plan["hud"] = hud
        let v = try assemble(plan)
        XCTAssertTrue(v.canFire, "falls back to the Hob's can_fire")
    }

    func testRefusedFireAndPickRepliesDecode() {
        let fire = CoreReply.decode(#"{"ok":false,"reason":"resting_plain_only","detail":"Marge Dumpling needs a rest: Plain Shot only","shot":"knack","hob":0,"ready_shot":"plain"}"#)
        XCTAssertFalse(fire.ok)
        XCTAssertEqual(fire.detail, "Marge Dumpling needs a rest: Plain Shot only")
        XCTAssertEqual(fire.shot, "knack")
        XCTAssertEqual(fire.hob, 0)
        XCTAssertEqual(fire.readyShot, "plain")
        let none = CoreReply.decode(#"{"ok":false,"reason":"buried","shot":"plain","hob":0,"ready_shot":null}"#)
        XCTAssertNil(none.readyShot)
        let pick = CoreReply.decode(#"{"ok":true,"ready":false,"why":"resting_plain_only","text":"Needs a rest"}"#)
        XCTAssertEqual(pick.ready, false)
        XCTAssertEqual(pick.why, "resting_plain_only")
        XCTAssertEqual(pick.text, "Needs a rest")
    }

    /// A tap on grey Fire: nothing fires, the core's words show, and the pick moves to `ready_shot`.
    @MainActor
    func testRefusedFireShowsTheDetailAndSwitchesToTheReadyShot() throws {
        let bridge = RulesThreeBridge()
        bridge.queue(try json(try restingPlan()))
        bridge.queue(try json(try restingPlan(selected: "plain")))
        bridge.answer = { cmd in
            if cmd.contains(#""cmd":"fire""#) {
                return #"{"ok":false,"reason":"resting_plain_only","detail":"Marge Dumpling needs a rest: Plain Shot only","shot":"knack","hob":0,"ready_shot":"plain"}"#
            }
            return #"{"ok":true,"ready":true}"#
        }
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        XCTAssertTrue(session.canAct)
        XCTAssertFalse(session.hud.canFire)
        session.fire()
        XCTAssertEqual(session.banner, "Marge Dumpling needs a rest: Plain Shot only")
        XCTAssertTrue(bridge.commands.contains(#"{"cmd":"pick_shot","shot":"plain"}"#), "switched to the shot the core named")
        XCTAssertEqual(session.snapshot.selectedShot, "plain")
        XCTAssertTrue(session.hud.canFire)
    }

    func testShotSwitchEventDecodes() throws {
        let e = try JSONDecoder().decode(CoreEvent.self, from: Data(
            #"{"from":"knack","hob":0,"side":0,"t":"shot_switch","tick":505,"to":"plain","when":"turn_start","why":"resting_plain_only"}"#.utf8))
        XCTAssertEqual(e.fromShot, "knack")
        XCTAssertEqual(e.toShot, "plain")
        XCTAssertEqual(e.when, "turn_start")
        XCTAssertNil(e.from, "the walk points stay empty for a shot switch")
        let out = try XCTUnwrap(FrameAssembler.event(e, mapHeight: 720))
        XCTAssertEqual(out.type, "shot_switch")
        XCTAssertEqual(out.side, 0)
        XCTAssertEqual(out.text, "resting_plain_only")
    }

    /// The shot_switch event at a turn start queues the chip's words after the turn banner.
    @MainActor
    func testShotSwitchAtTurnStartIsAnnounced() throws {
        let bridge = RulesThreeBridge()
        let first = try restingPlan(selected: "plain")
        bridge.queue(try json(first))
        let turn = ((first["hud"] as? [String: Any])?["turn"] as? Int ?? 1) + 2
        bridge.queue(try json(try restingPlan(selected: "plain", events: [
            ["t": "turn_start", "tick": 500, "side": 0, "round": 2, "turn": turn],
            ["t": "shot_switch", "tick": 505, "side": 0, "hob": 0, "from": "knack", "to": "plain",
             "when": "turn_start", "why": "resting_plain_only"],
        ], turn: turn)))
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        game.markDirty()
        session.tick()
        XCTAssertEqual(session.banner, "Your turn")
        XCTAssertEqual(session.bannerQueue, ["Marge Dumpling needs a rest: Plain Shot only"])
    }
}

// MARK: M2: Fatigue

final class FatigueTests: XCTestCase {
    @MainActor
    func testRoundLabelCountsDownToFatigue() throws {
        var hud = HudState()
        hud.fatigueIn = 9
        XCTAssertNil(hud.fatigueText)
        hud.fatigueIn = 3
        XCTAssertEqual(hud.fatigueText, "Fatigue in 3")
        hud.fatigueIn = 1
        XCTAssertEqual(hud.fatigueText, "Fatigue in 1")
        hud.fatigueIn = nil
        hud.fatigue = true
        XCTAssertEqual(hud.fatigueText, "Fatigue")
        hud.isYard = true
        XCTAssertNil(hud.fatigueText, "no Fatigue in the Test Yard")
        XCTAssertEqual(hud.roundText, "Test Yard")
    }

    @MainActor
    func testFatigueFieldsReachTheView() throws {
        var plan = try planObject()
        var hud = plan["hud"] as? [String: Any] ?? [:]
        hud["fatigue_in"] = 1
        plan["hud"] = hud
        let v = try assemble(plan)
        XCTAssertEqual(v.fatigueIn, 1)
        XCTAssertFalse(v.fatigue)
        XCTAssertEqual(v.fatigueRound, 10)
    }

    @MainActor
    func testFatigueEventsMapToBannerEvents() throws {
        let list = try JSONDecoder().decode([CoreEvent].self, from: Data(
            #"[{"round":10,"t":"fatigue_warning","text":"Fatigue next round: hurt blocks hold less","tick":16},{"round":10,"t":"fatigue","tick":18}]"#.utf8))
        let out = list.compactMap { FrameAssembler.event($0, mapHeight: 720) }
        XCTAssertEqual(out.map(\.type), ["fatigue_warn", "fatigue"])
        XCTAssertEqual(out[0].text, "Fatigue next round: hurt blocks hold less")
    }

    /// The warning banner shows one round before Fatigue, and the turn line waits for it
    /// (QA playtest 2, N1).
    @MainActor
    func testFatigueNextRoundBannerAtTurnStart() throws {
        let bridge = RulesThreeBridge()
        let first = try planObject()
        bridge.queue(try json(first))
        var next = first
        var hud = next["hud"] as? [String: Any] ?? [:]
        let turn = (hud["turn"] as? Int ?? 1) + 2
        hud["turn"] = turn
        hud["round"] = 9
        hud["fatigue_in"] = 1
        next["hud"] = hud
        next["events"] = [["t": "turn_start", "tick": 900, "side": 0, "round": 9, "turn": turn],
                          ["t": "fatigue_warning", "tick": 900, "round": 10, "text": "Fatigue next round: hurt blocks hold less"]]
        bridge.queue(try json(next))
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        game.markDirty()
        session.tick()
        XCTAssertEqual(session.banner, "Fatigue next round: hurt blocks hold less", "Fatigue comes first")
        XCTAssertEqual(session.bannerQueue, ["Your turn"], "once a round, not twice for the event too; the turn waits")
        XCTAssertEqual(session.hud.fatigueText, "Fatigue in 1")
    }

    /// The round 10 collapse (`why: "fatigue"`) plays like any collapse.
    @MainActor
    func testFatigueCollapsePlaysLikeAnyCollapse() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let old = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        let fort = try XCTUnwrap(old.fort(0))
        let b = try XCTUnwrap(fort.blocks.first)
        let c = Int(((b.x - fort.originX) / fort.block).rounded())
        let r = Int(((b.y - fort.baseY) / fort.block).rounded())
        let list = try JSONDecoder().decode([CoreEvent].self, from: Data(
            #"[{"t":"fatigue","tick":18,"round":10},{"t":"collapse","tick":18,"side":0,"why":"fatigue","blocks":[[\#(c),\#(r),"timber"]],"falls":[[\#(c),32]]}]"#.utf8))
        let events = list.compactMap { FrameAssembler.event($0, mapHeight: 720) }
        XCTAssertEqual(events.last?.type, "fall")
        XCTAssertEqual(events.last?.raw?.why, "fatigue")
        let fx = FieldFX()
        fx.ingest(events, old: old, new: old, nowNanos: 1)
        XCTAssertEqual(fx.pieces.count, 1, "the fatigue collapse drops its block")
        XCTAssertTrue(fx.collapseShowing)
    }
}

// MARK: m1: Best shot

final class BestShotTests: XCTestCase {
    @MainActor
    func testEndedFixtureHasTheWinnersBestShot() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_ended")))
        let v = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        let result = try XCTUnwrap(v.result)
        let best = try XCTUnwrap(result.bestShot)
        XCTAssertEqual(best.side, result.winner)
        XCTAssertEqual(best.shot, "clodpot")
        XCTAssertEqual(best.hobName, "Marge Dumpling")
        XCTAssertEqual(best.dmg, 29)
        XCTAssertEqual(result.bestShots.count, 2)
        XCTAssertEqual(result.bestShot(of: 0), best)
        XCTAssertNil(result.bestShot(of: 1), "the losing side had no hit; never borrow the winner's")
        let line = BestShotLine.text(best)
        XCTAssertTrue(line.contains("Clodpot"))
        XCTAssertTrue(line.contains("Marge Dumpling"))
        XCTAssertTrue(line.contains("29 damage"))
        XCTAssertTrue(line.contains("44.0"))
    }

    /// A `best_shot` that names the losing side is never shown as the winner's.
    @MainActor
    func testBestShotNeverNamesTheLosingSide() throws {
        var ended = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(try fixtureText("snapshot_ended").utf8)) as? [String: Any])
        var result = try XCTUnwrap(ended["result"] as? [String: Any])
        let theirs: [String: Any] = ["side": 1, "hob": 2, "hob_name": "Sir Pudge", "shot": "clodpot", "shot_name": "Clodpot",
                                     "angle": 1350, "power": 70, "round": 1, "dmg": 12]
        let mine: [String: Any] = ["side": 0, "hob": 0, "hob_name": "Marge Dumpling", "shot": "clodpot", "shot_name": "Clodpot",
                                   "angle": 440, "power": 78, "round": 1, "dmg": 40]
        result["winner"] = 1
        result["best_shot"] = mine
        var stats = try XCTUnwrap(result["stats"] as? [[String: Any]])
        stats[0]["best_shot"] = mine
        stats[1]["best_shot"] = theirs
        result["stats"] = stats
        ended["result"] = result
        let v = try assemble(ended)
        let r = try XCTUnwrap(v.result)
        XCTAssertEqual(r.bestShot?.side, 1, "the winner's own best shot, from stats")
        XCTAssertEqual(r.bestShot(of: 0)?.dmg, 40)
        XCTAssertEqual(r.bestShot(of: 1)?.hobName, "Sir Pudge")
    }
}

// MARK: M6: Retry sends attempt; the Daily does not

final class RetryAttemptTests: XCTestCase {
    func testRetryKeepsTheSeedAndCountsTheTry() throws {
        let first = BattleSetup.campaign("1-2", preset: .fair, seed: 77)
        XCTAssertNil(first.coreSetup().attempt)
        XCTAssertFalse(first.coreSetup().jsonString().contains("attempt"), "a first try sends no attempt")
        let again = first.retried()
        XCTAssertEqual(again.seed, 77, "one seed per fight; the try number makes it new")
        XCTAssertEqual(again.attempt, 1)
        XCTAssertEqual(again.coreSetup().attempt, 1)
        XCTAssertTrue(again.coreSetup().jsonString().contains(#""attempt":1"#))
        XCTAssertEqual(again.retried().coreSetup().attempt, 2)
        var duel = BattleSetup(mode: .duel, map: "d1", seed: 4)
        duel.names = ["A", "B"]
        XCTAssertEqual(duel.retried().coreSetup().attempt, 1)
        let skirmish = BattleSetup(mode: .skirmish, map: "d2", seed: 4).retried()
        XCTAssertEqual(skirmish.coreSetup().attempt, 1)
    }

    func testTheDailyNeverSendsAttempt() {
        let daily = BattleSetup(mode: .daily, map: "d1", seed: 2026_11_22).retried().retried()
        XCTAssertEqual(daily.attempt, 2)
        XCTAssertTrue(daily.isDaily)
        XCTAssertEqual(daily.coreSetup().mode, "daily")
        XCTAssertNil(daily.coreSetup().attempt)
        XCTAssertFalse(daily.coreSetup().jsonString().contains("attempt"))
    }

    /// A save written before `attempt` existed still reads (then the rules check decides).
    @MainActor
    func testAnOldSaveWithoutAttemptStillDecodes() throws {
        let old = #"{"setup":{"mode":"campaign","level":"1-1","preset":"fair","seed":5,"rounds":15,"wind":"light","shells":"draft","winBy":"knockout","seats":"side_by_side","names":[],"help":[],"forts":[]},"log":"[]","rules":2}"#
        let saved = try XCTUnwrap(CoreGame.header(Data(old.utf8)))
        XCTAssertNil(saved.setup.attempt)
        XCTAssertEqual(saved.rules, 2)
    }

    /// A rules 2 save is refused with plain words, not replayed (rules 4 now).
    @MainActor
    func testARulesTwoSaveIsRefused() async throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertEqual(game.rulesVersion, 4)
        let old = #"{"setup":{"mode":"campaign","level":"1-1","preset":"fair","seed":5,"rounds":15,"wind":"light","shells":"draft","winBy":"knockout","seats":"side_by_side","names":[],"help":[],"forts":[]},"log":"[]","rules":2}"#
        let result = await game.load(Data(old.utf8))
        XCTAssertEqual(result, .rulesChanged)
        XCTAssertFalse(game.isRunning)
        let words = AppModel.rulesChangedNotice
        XCTAssertTrue(words.contains("rules changed"))
        XCTAssertFalse(words.contains("_"), "plain words, no keys")
    }
}

// MARK: M4: Test Yard

final class TestYardTests: XCTestCase {
    @MainActor
    func testTheYardTreatsOnlySideZeroAsAPerson() throws {
        var plan = try planObject()
        plan["mode"] = "test_yard"
        var hud = plan["hud"] as? [String: Any] ?? [:]
        hud["control"] = ["human", "human"]
        plan["hud"] = hud
        let v = try assemble(plan)
        XCTAssertEqual(v.humans, [true, false], "the Dummy side is never handed to the player")
        XCTAssertEqual(HudState(v).roundText, "Test Yard")
        XCTAssertNil(BattleSetup(mode: .yard, map: "d1").coreSetup().sides, "the core seats the Dummy side itself")
    }
}

// MARK: QA layout lessons (M3, M7, m3, M8)

/// The fort's whole width is inside the frame (the frame sits a little above the footing by design).
private func spans(_ frame: CGRect, _ fort: CGRect) -> Bool {
    frame.minX <= fort.minX && frame.maxX >= fort.maxX
}

final class PlanFrameTests: XCTestCase {
    @MainActor
    private func planFrame() throws -> BattleSnapshot {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        return FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
    }

    /// 1-1 in phone landscape: both forts, blocks at 8 pt or more, no marker.
    @MainActor
    func testPhoneLandscapeFramesBothFortsWhenBlocksAreBigEnough() throws {
        let snap = try planFrame()
        let layout = BattleLayout.compute(size: CGSize(width: 844, height: 390), insets: Insets(top: 0, left: 47, bottom: 21, right: 47),
                                          mode: .wide, inFlight: false, isPad: false)
        let frame = try XCTUnwrap(layout.lenses.first).frame
        let rect = Camera.worldRect(for: .both, snap: snap, frame: frame.size)
        XCTAssertEqual(rect, Camera.bothRect(snap))
        XCTAssertGreaterThanOrEqual(Camera.blockPoints(rect, in: frame.size), Camera.minBlockPoints)
        XCTAssertTrue(spans(rect, Camera.fortRect(0, snap: snap)))
        XCTAssertTrue(spans(rect, Camera.fortRect(1, snap: snap)), "the 55/45 lean never pushes a fort out")
        XCTAssertNil(Camera.rivalEdge(worldRect: rect, snap: snap))
    }

    /// Too small for 8 pt blocks: your fort and the arc, and a Rival marker on the edge.
    @MainActor
    func testASmallFrameShowsYourFortAndARivalEdgeMarker() throws {
        var snap = try planFrame()
        snap.preview = []
        let small = CGSize(width: 300, height: 160)
        XCTAssertLessThan(Camera.blockPoints(Camera.bothRect(snap), in: small), Camera.minBlockPoints)
        let rect = Camera.planRect(snap, frame: small)
        XCTAssertEqual(rect, Camera.ownPlanRect(snap))
        XCTAssertTrue(spans(rect, Camera.fortRect(0, snap: snap)))
        XCTAssertEqual(Camera.rivalEdge(worldRect: rect, snap: snap), 1, "the Rival fort is off the right edge")
        snap.activeSide = 1
        let theirs = Camera.planRect(snap, frame: small)
        XCTAssertTrue(spans(theirs, Camera.fortRect(1, snap: snap)))
        XCTAssertEqual(Camera.rivalEdge(worldRect: theirs, snap: snap), -1)
    }

    /// M7: the Fine Tune pad never covers your fort, in either layout, for either side.
    @MainActor
    func testFineTuneNeverCoversYourFort() throws {
        let base = try planFrame()
        let cases: [(CGSize, Insets, LayoutMode, LensFocus)] = [
            (CGSize(width: 390, height: 844), Insets(top: 47, left: 0, bottom: 34, right: 0), .tall, .own),
            (CGSize(width: 844, height: 390), Insets(top: 0, left: 47, bottom: 21, right: 47), .wide, .both),
        ]
        for (size, insets, mode, focus) in cases {
            for side in 0...1 {
                for leftHand in [false, true] {
                    var snap = base
                    snap.activeSide = side
                    let layout = BattleLayout.compute(size: size, insets: insets, mode: mode, inFlight: false, isPad: false,
                                                      hudSide: side, leftHand: leftHand)
                    let lens = try XCTUnwrap(layout.lenses.first { $0.focus == focus })
                    let rect = Camera.worldRect(for: focus, snap: snap, frame: lens.frame.size)
                    let fort = Camera.viewRect(of: Camera.fortRect(side, snap: snap), worldRect: rect, frame: lens.frame)
                    XCTAssertGreaterThan(layout.fineTune.width, 0)
                    XCTAssertFalse(fort.intersects(layout.fineTune), "\(mode) side \(side) leftHand \(leftHand)")
                    XCTAssertTrue(CGRect(origin: .zero, size: size).contains(layout.fineTune))
                }
            }
        }
        let flying = BattleLayout.compute(size: CGSize(width: 390, height: 844), insets: Insets(), mode: .tall, inFlight: true, isPad: false)
        XCTAssertEqual(flying.fineTune, .zero, "no pad while the lenses are joined")
    }

    @MainActor
    func testPanStaysOnTheField() {
        let rect = CGRect(x: 300, y: 0, width: 800, height: 300)
        XCTAssertEqual(Camera.panned(rect, by: 0, worldW: 1600), rect)
        XCTAssertEqual(Camera.panned(rect, by: 200, worldW: 1600).minX, 500)
        XCTAssertEqual(Camera.panned(rect, by: 5000, worldW: 1600).maxX, 1720, "stops at the field's edge plus margin")
        XCTAssertEqual(Camera.panned(rect, by: -5000, worldW: 1600).minX, -120)
    }
}

final class PanAndEdgeTests: XCTestCase {
    /// A press away from your fort pans the camera; it never aims.
    @MainActor
    func testAPressAwayFromYourFortPansTheCamera() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        let size = CGSize(width: 844, height: 390)
        session.updateViewport(size: size, insets: Insets())
        // A camera of 2 cells a point: world x = 2 * view x.
        let map = LensMap(viewport: CGRect(origin: .zero, size: size), frameCentre: CGPoint(x: 422, y: 195),
                          worldRect: CGRect(x: 0, y: 0, width: 1688, height: 780), scale: 0.5, sceneHeight: 390)
        session.lensMap = { _ in map }
        XCTAssertTrue(session.canAct)
        let aim = session.snapshot.aim
        let far = CGPoint(x: 800, y: 60)
        XCTAssertFalse(session.aimMayStart(at: far), "the sky over the Rival is not your fort")
        session.touchBegan(at: far)
        session.touchMoved(to: CGPoint(x: 700, y: 60))
        XCTAssertTrue(session.panning)
        XCTAssertEqual(session.cameraPan, 200, accuracy: 0.01, "100 pt left shows 200 cells more to the right")
        session.touchEnded(at: CGPoint(x: 700, y: 60))
        XCTAssertFalse(session.panning)
        XCTAssertEqual(session.cameraPan, 200, accuracy: 0.01, "the view stays where it was left")
        XCTAssertEqual(session.snapshot.aim, aim, "panning never changes the aim")
        XCTAssertNil(session.dragModel.overlay)
    }

    /// m3: a pull into the screen edge keeps its angle; only power follows.
    func testAPullIntoTheEdgeKeepsItsAngle() {
        let bounds = CGRect(x: 0, y: 0, width: 844, height: 390)
        var g = AimGesture(anchor: CGPoint(x: 300, y: 200), powerSpan: 156, mode: .pullBack, bounds: bounds)
        // Pull down and left along 45 degrees (pull-back aims up and right).
        var d: CGFloat = 0
        while d < 185 {
            d += 5
            _ = g.move(to: CGPoint(x: 300 - d, y: 200 + d))
        }
        XCTAssertEqual(g.angleTenths, 450)
        XCTAssertEqual(g.power, 100, "full power before the finger meets the edge")
        // The finger reaches the bottom edge and slides along it.
        _ = g.move(to: CGPoint(x: 100, y: 390))
        XCTAssertNotNil(g.edgeAngle)
        XCTAssertEqual(g.angleTenths, 450)
        _ = g.move(to: CGPoint(x: 20, y: 390))
        XCTAssertEqual(g.angleTenths, 450, "asked 45, got 45.0")
        XCTAssertEqual(g.power, 100)
        // Back off the edge: the finger leads again.
        _ = g.move(to: CGPoint(x: 200, y: 300))
        XCTAssertNil(g.edgeAngle)
        XCTAssertEqual(g.angleTenths, 450)
    }

    /// The pull for 100 is the room left toward the edge when that is shorter, never under 64 pt.
    func testPowerSpanShrinksToTheRoomLeft() {
        let bounds = CGRect(x: 0, y: 0, width: 844, height: 390)
        var near = AimGesture(anchor: CGPoint(x: 300, y: 300), powerSpan: 156, mode: .pullBack, bounds: bounds)
        _ = near.move(to: CGPoint(x: 300, y: 310))
        XCTAssertTrue(near.isDragging)
        XCTAssertEqual(near.powerSpan, 86, accuracy: 0.01, "90 pt to the bottom edge, less the edge margin")
        var tight = AimGesture(anchor: CGPoint(x: 300, y: 360), powerSpan: 156, mode: .pullBack, bounds: bounds)
        _ = tight.move(to: CGPoint(x: 300, y: 370))
        XCTAssertEqual(tight.powerSpan, AimGesture.minPowerSpan)
        var open = AimGesture(anchor: CGPoint(x: 300, y: 100), powerSpan: 156, mode: .pullBack, bounds: bounds)
        _ = open.move(to: CGPoint(x: 300, y: 110))
        XCTAssertEqual(open.powerSpan, 156, "40% of the short side when there is room")
    }
}

final class DuelLandscapeTests: XCTestCase {
    /// M8: the hand-off card is compact on a short screen, so READY is fully on screen.
    @MainActor
    func testHandOffCardFitsInPhoneLandscape() {
        let short = HandOffCard.metrics(height: 390)
        XCTAssertTrue(short.compact)
        XCTAssertLessThanOrEqual(short.estimatedHeight, 390 - 21)
        XCTAssertGreaterThanOrEqual(short.ready, 44, "READY stays a big target")
        let tall = HandOffCard.metrics(height: 844)
        XCTAssertFalse(tall.compact)
        XCTAssertLessThanOrEqual(tall.estimatedHeight, 844 - 47 - 34)
    }

    /// M8: Couch Duel setup in landscape keeps room for a player card under the header.
    @MainActor
    func testDuelSetupLeavesRoomForTheCardsInLandscape() {
        let m = DuelSetupView.metrics(size: CGSize(width: 844, height: 369))
        XCTAssertTrue(m.wide, "player cards side by side")
        XCTAssertTrue(m.compact)
        XCTAssertGreaterThanOrEqual(m.button, 44)
        XCTAssertGreaterThanOrEqual(m.cardRoom(height: 369), 250, "a player card is about 160 pt")
        let portrait = DuelSetupView.metrics(size: CGSize(width: 390, height: 763))
        XCTAssertFalse(portrait.wide)
        XCTAssertFalse(portrait.compact)
    }
}

// MARK: On the real core

final class RealCoreRulesThreeTests: XCTestCase {
    /// M1 on 1-1: the Knack, then Marge rests: the pick moves to the Plain Shot at turn start,
    /// a hand-picked Knack greys Fire with the core's words, and Fire refused switches back.
    @MainActor
    func testRestTurnOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        XCTAssertEqual(CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load()).rulesVersion, 4)
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        game.thinkMs = 0
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        XCTAssertTrue(session.canAct)
        XCTAssertTrue(session.hud.canFire)
        session.pickShot("knack")
        XCTAssertEqual(session.snapshot.selectedShot, "knack")
        XCTAssertTrue(session.hud.canFire)
        XCTAssertTrue(game.send(.aim(angle: 450, power: 70)).ok)
        session.fire()
        var switched = false
        var back = false
        for _ in 0..<4000 {
            game.advance(milliseconds: 50)
            game.waitUntilIdle()
            session.tick()
            if session.snapshot.events.contains(where: { $0.type == "shot_switch" }) { switched = true }
            if session.snapshot.phase == .plan && session.snapshot.humanTurn && session.snapshot.turnSeq > 2 { back = true; break }
            if session.snapshot.phase == .ended { break }
        }
        XCTAssertTrue(back, "the player's turn came back")
        XCTAssertTrue(switched, "shot_switch at the turn start")
        XCTAssertEqual(session.snapshot.selectedShot, "plain")
        XCTAssertTrue(session.hud.canFire, "Fire is lit for the shot that fires")
        session.pickShot("knack")
        XCTAssertEqual(session.snapshot.selectedShot, "knack", "the pick stands")
        XCTAssertFalse(session.hud.canFire)
        XCTAssertEqual(session.hud.fireText, "Marge Dumpling needs a rest: Plain Shot only")
        let knack = try XCTUnwrap(session.hud.shots.first { $0.id == "knack" })
        XCTAssertFalse(knack.ready)
        XCTAssertNotNil(knack.text)
        let turn = session.snapshot.turnSeq
        session.fire()
        XCTAssertEqual(session.snapshot.phase, .plan, "nothing was spent")
        XCTAssertEqual(session.snapshot.turnSeq, turn)
        XCTAssertTrue(session.banner?.contains("Marge") == true, "the core's detail is shown")
        XCTAssertEqual(session.snapshot.selectedShot, "plain", "switched to the shot the core named")
        XCTAssertTrue(session.hud.canFire)
    }

    /// M6: a Retry with the same seed is a new fight.
    @MainActor
    func testRetryIsANewFightOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        let first = BattleSetup.campaign("1-1", preset: .fair, seed: 5)
        XCTAssertNil(game.start(first))
        _ = try XCTUnwrap(game.frame())
        let a = try XCTUnwrap(game.stateHash())
        XCTAssertNil(game.start(first.retried()))
        _ = try XCTUnwrap(game.frame())
        let b = try XCTUnwrap(game.stateHash())
        XCTAssertNotEqual(a, b, "attempt 1 is a new fight")
        XCTAssertNil(game.start(first))
        _ = try XCTUnwrap(game.frame())
        XCTAssertEqual(game.stateHash(), a, "the same try is the same fight")
    }

    /// M2: Fatigue is announced a round ahead and starts at round 10 (a duel where both pass).
    @MainActor
    func testFatigueIsAnnouncedOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        var duel = BattleSetup(mode: .duel, map: "d1", seed: 9)
        duel.names = ["Mabel", "Otis"]
        duel.forts = ["box_1", "box_2"]
        duel.shells = .plain
        duel.seats = .oneSeat
        XCTAssertNil(game.start(duel))
        let session = BattleSession(game: game, setup: duel, title: "Couch Duel")
        session.endDraft()
        var warned = false
        var countdown = false
        var started = false
        for _ in 0..<6000 {
            if session.canAct { XCTAssertTrue(session.pass()) }
            game.advance(milliseconds: 50)
            game.waitUntilIdle()
            session.tick()
            let snap = session.snapshot
            if snap.events.contains(where: { $0.type == "fatigue" }) { started = true }
            if session.bannerQueue.contains(where: { $0.hasPrefix("Fatigue next round") })
                || session.banner?.hasPrefix("Fatigue next round") == true { warned = true }
            if snap.round == 9 && snap.fatigueIn == 1 && session.hud.fatigueText == "Fatigue in 1" { countdown = true }
            if snap.round >= 10 && snap.fatigue && snap.phase == .plan { break }
            if snap.phase == .ended { break }
        }
        XCTAssertTrue(countdown, "round 9 says Fatigue in 1")
        XCTAssertTrue(warned, "the Fatigue next round banner")
        XCTAssertTrue(started, "the fatigue event at round 10")
        XCTAssertTrue(session.snapshot.fatigue)
        XCTAssertEqual(session.hud.fatigueText, "Fatigue")
        XCTAssertNotEqual(session.snapshot.phase, .ended, "Fatigue alone never ends a fight")
    }

    /// M4: in the Test Yard the Dummy side passes itself; every turn handed over is the player's.
    @MainActor
    func testTestYardDummyPassesItselfOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        let yard = BattleSetup(mode: .yard, map: "d1", seed: 1)
        XCTAssertNil(game.start(yard))
        let session = BattleSession(game: game, setup: yard, title: "Test Yard")
        session.endDraft()
        var shots = 0
        var dummyPassed = false
        for _ in 0..<6000 where shots < 3 {
            if session.canAct {
                XCTAssertEqual(session.snapshot.activeSide, 0, "only the player's turns are handed over")
                _ = game.send(.aim(angle: 450, power: 70))
                session.fire()
                shots += 1
            }
            game.advance(milliseconds: 50)
            game.waitUntilIdle()
            session.tick()
            let snap = session.snapshot
            XCTAssertFalse(snap.humanTurn && snap.activeSide == 1, "the Dummy's turn is never the player's")
            if snap.events.contains(where: { $0.type == "pass" && $0.raw?.why == "dummy" }) { dummyPassed = true }
            XCTAssertNotEqual(snap.phase, .ended)
        }
        XCTAssertEqual(shots, 3)
        XCTAssertTrue(dummyPassed, "the Dummy side passed itself")
        XCTAssertEqual(session.snapshot.humans, [true, false])
        XCTAssertEqual(session.hud.roundText, "Test Yard")
    }

    /// m1 on the real core: a Couch Duel with one hit then Give up; the winner's best shot is its own.
    @MainActor
    func testBestShotBelongsToTheWinnerOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 3)))
        _ = try XCTUnwrap(game.frame())
        XCTAssertTrue(game.giveUp().ok)
        let end = try XCTUnwrap(game.frame())
        let result = try XCTUnwrap(end.result)
        XCTAssertEqual(result.stats.count, 2)
        XCTAssertEqual(result.bestShots.count, 2)
        if let best = result.bestShot { XCTAssertEqual(best.side, result.winner) }
        XCTAssertNil(result.bestShot(of: 0), "no shot fired, no best shot")
    }
}

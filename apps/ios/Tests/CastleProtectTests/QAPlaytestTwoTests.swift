import XCTest
@testable import CastleProtect

// Core rules 4 and the QA playtest 2 lessons (core/API.md, "Changes for QA playtest 2" and
// "Frame sizes"; docs/qa/playtest-2/REPORT.md, "Core fixes" and "8. Web fixes"). The real-core
// tests run only when CastleCore.xcframework is linked; CI requires them to pass.

// MARK: Helpers

private func planDict() throws -> [String: Any] {
    try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(try fixtureText("snapshot_plan").utf8)) as? [String: Any])
}

private func text(_ object: [String: Any]) throws -> String {
    String(decoding: try JSONSerialization.data(withJSONObject: object), as: UTF8.self)
}

@MainActor
private func build(_ object: [String: Any]) throws -> BattleSnapshot {
    let raw = try XCTUnwrap(CoreSnapshot.decode(try text(object)))
    return FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
}

/// The plan fixture with side 0's first Hob changed by `edit`, and a second side 0 Hob (id 3).
private func planWithTwoHobs(first edit: (inout [String: Any]) -> Void = { _ in },
                             second: (inout [String: Any]) -> Void = { _ in }) throws -> [String: Any] {
    var plan = try planDict()
    var hobs = try XCTUnwrap(plan["hobs"] as? [[String: Any]])
    let i = try XCTUnwrap(hobs.firstIndex { ($0["side"] as? Int) == 0 })
    var mate = hobs[i]
    mate["id"] = 3
    mate["name"] = "Quill Tansy"
    mate["def"] = "quill"
    mate["x"] = (mate["x"] as? Int ?? 375) + 32
    edit(&hobs[i])
    second(&mate)
    hobs.append(mate)
    plan["hobs"] = hobs
    return plan
}

/// A later turn of the plan: the turn counter moved on and `events` came with it.
private func nextTurn(_ plan: [String: Any], round: Int, events: [[String: Any]]) -> [String: Any] {
    var next = plan
    var hud = next["hud"] as? [String: Any] ?? [:]
    let turn = (hud["turn"] as? Int ?? 1) + 2
    hud["turn"] = turn
    hud["round"] = round
    next["hud"] = hud
    let start: [String: Any] = ["t": "turn_start", "tick": 900, "side": 0, "round": round, "turn": turn]
    next["events"] = [start] + events
    return next
}

@MainActor
private func scriptedSession(_ frames: [[String: Any]]) throws -> (BattleSession, CoreGame, RulesThreeBridge) {
    let bridge = RulesThreeBridge()
    for f in frames { bridge.queue(try text(f)) }
    let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
    let setup = BattleSetup.campaign("1-6", preset: .fair, seed: 3)
    XCTAssertNil(game.start(setup))
    let session = BattleSession(game: game, setup: setup, title: "1-6")
    return (session, game, bridge)
}

private func fatigueAt900() -> [String: Any] { ["t": "fatigue", "tick": 900, "round": 10] }

// MARK: Rules 4

final class RulesFourTests: XCTestCase {
    /// A rules 3 save does not resume: it is refused with plain words, the progress is kept.
    @MainActor
    func testARulesThreeSaveIsRefusedWithPlainWords() async throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertEqual(game.rulesVersion, 5)
        let old = #"{"setup":{"mode":"campaign","level":"1-7","preset":"fair","seed":5,"rounds":15,"wind":"light","shells":"draft","winBy":"knockout","seats":"side_by_side","names":[],"help":[],"forts":[],"attempt":1},"log":"[]","rules":3}"#
        XCTAssertEqual(CoreGame.header(Data(old.utf8))?.rules, 3)
        let result = await game.load(Data(old.utf8))
        XCTAssertEqual(result, .rulesChanged)
        XCTAssertFalse(game.isRunning, "nothing was replayed")
        let words = AppModel.rulesChangedNotice
        XCTAssertTrue(words.contains("cannot be carried on"))
        XCTAssertTrue(words.contains("progress"))
        XCTAssertFalse(words.contains("_"))
        XCTAssertFalse(words.contains("rules 3"), "no version numbers in the player's words")
    }

    @MainActor
    func testRulesFourOnTheRealCore() async throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        XCTAssertEqual(game.rulesVersion, 5)
        let old = #"{"setup":{"mode":"campaign","level":"1-1","preset":"fair","seed":5,"rounds":15,"wind":"light","shells":"draft","winBy":"knockout","seats":"side_by_side","names":[],"help":[],"forts":[]},"log":"[]","rules":3}"#
        let result = await game.load(Data(old.utf8))
        XCTAssertEqual(result, .rulesChanged)
        // A save made now carries rules 5 and comes back.
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 5)
        XCTAssertNil(game.start(setup))
        _ = try XCTUnwrap(game.frame())
        let bytes = game.save()
        XCTAssertEqual(CoreGame.header(bytes)?.rules, 5)
        let back = await game.load(bytes)
        XCTAssertEqual(back, .ok)
    }
}

// MARK: N2: Squashed is not Bonked

final class SquashedTests: XCTestCase {
    @MainActor
    private func hob(state: String, hp: Int) throws -> HobView {
        let snap = try build(try planWithTwoHobs(first: { h in
            h["state"] = state
            h["hp"] = hp
        }))
        return try XCTUnwrap(snap.fort(0)?.hobs.first { $0.id == "0" })
    }

    @MainActor
    func testASquashedHobAtOneHpIsLiveAndDrawnCrushed() throws {
        let h = try hob(state: "squashed", hp: 1)
        XCTAssertFalse(h.bonked)
        XCTAssertFalse(h.isOut, "only bonked or 0 HP is out of the fight")
        XCTAssertTrue(h.isCrushed)
        XCTAssertEqual(h.stateWords, "Squashed. Back up soon.")
        XCTAssertGreaterThan(PipRow.fill(h), 0, "a squashed live Hob keeps a visible HP sliver")
        XCTAssertLessThan(PipRow.fill(h), 1, "its pip reflects its low HP rather than full")
        XCTAssertLessThan(LensLayer.crushedScale, 1, "drawn flattened")
        let dropped = try hob(state: "dropped", hp: 1)
        XCTAssertFalse(dropped.isOut)
        XCTAssertFalse(dropped.isCrushed, "only state == squashed is drawn crushed (iOS-M9)")
    }

    @MainActor
    func testOnlyBonkedOrZeroHpIsOut() throws {
        let bonked = try hob(state: "bonked", hp: 0)
        XCTAssertTrue(bonked.isOut)
        XCTAssertFalse(bonked.isCrushed)
        XCTAssertEqual(bonked.stateWords, "Bonked")
        XCTAssertEqual(PipRow.fill(bonked), 0, "a Bonked pip is drawn hollow in grey (iOS-M9)")
        XCTAssertTrue(try hob(state: "squashed", hp: 0).isOut, "0 HP is out whatever the state")
        let hurt = try hob(state: "dropped", hp: 60)
        XCTAssertFalse(hurt.isOut)
        XCTAssertFalse(hurt.isCrushed, "a fall with HP to spare is drawn as it is")
        XCTAssertEqual(PipRow.fill(hurt), hurt.hpFraction)
        XCTAssertFalse(try hob(state: "tumbled", hp: 30).isOut)
    }

    /// A squashed Hob keeps its turn: it can be picked and the turn does not move off it.
    @MainActor
    func testASquashedHobCanStillAct() throws {
        let snap = try build(try planWithTwoHobs(first: { h in
            h["state"] = "squashed"
            h["hp"] = 1
            h["can_fire"] = true
        }))
        XCTAssertNil(BattleSession.hobToOpen(snap), "a squashed Hob that can fire keeps the pick")
        XCTAssertEqual(HudState(snap).myCrew.filter { !$0.isOut }.count, 2)
    }
}

// MARK: N1: Fatigue shown

final class FatigueShownTests: XCTestCase {
    func testBannerStyles() {
        XCTAssertEqual(BannerStyle.of(BattleSession.fatigueStartText), .fatigue, "red Fatigue!")
        XCTAssertEqual(BannerStyle.of(BattleSession.fatigueWarnText), .fatigueWarning)
        XCTAssertEqual(BannerStyle.of("Sudden Squall"), .squall)
        XCTAssertEqual(BannerStyle.of("Your turn"), .side)
        XCTAssertEqual(BattleSession.fatigueStartText, "The fort creaks. Cracked blocks let go.")
        XCTAssertEqual(BattleSession.fatigueWarnText, "The Creaks start next round. Cracked blocks hold less.")
        XCTAssertTrue(BattleSession.isFatigueBanner(BattleSession.fatigueStartText))
        XCTAssertTrue(BattleSession.isFatigueBanner(BattleSession.fatigueWarnText))
        XCTAssertFalse(BattleSession.isFatigueBanner("Your turn"))
    }

    /// Round 10: the red Fatigue banner first, "Your turn" waits, the camera holds your own fort.
    @MainActor
    func testRoundTenShowsFatigueBeforeYourTurn() throws {
        let plan = try planDict()
        let fatigue = nextTurn(plan, round: 10, events: [fatigueAt900()])
        let (session, game, _) = try scriptedSession([plan, fatigue])
        game.markDirty()
        session.tick()
        XCTAssertEqual(session.banner, BattleSession.fatigueStartText)
        XCTAssertEqual(session.bannerQueue, ["Your turn"], "the turn banner waits for Fatigue")
        XCTAssertEqual(session.cameraHome, 0, "the camera holds your own fort during the collapse")
    }

    /// Fatigue in a settle frame before the turn start: the turn banner queues behind it.
    @MainActor
    func testATurnBannerWaitsForAFatigueBannerOnScreen() throws {
        let plan = try planDict()
        var settle = plan
        let fatigueEvent: [String: Any] = ["t": "fatigue", "tick": 880, "round": 10]
        settle["events"] = [fatigueEvent]
        let turn = nextTurn(plan, round: 10, events: [])
        let (session, game, _) = try scriptedSession([plan, settle, turn])
        game.markDirty()
        session.tick()
        XCTAssertEqual(session.banner, BattleSession.fatigueStartText)
        game.markDirty()
        session.tick()
        XCTAssertEqual(session.banner, BattleSession.fatigueStartText, "Your turn does not cover it")
        XCTAssertEqual(session.bannerQueue, ["Your turn"])
    }

    /// The hold ends when the next shell flies.
    @MainActor
    func testTheNextShotEndsTheHomeHold() throws {
        let plan = try planDict()
        let fatigue = nextTurn(plan, round: 10, events: [fatigueAt900()])
        var flying = fatigue
        flying["phase"] = "resolve"
        flying["awaiting"] = "none"
        flying["events"] = [[String: Any]]()
        let shell: [Any] = [0, 600, 300, 450, "clodpot"]
        flying["shells"] = [shell]
        let (session, game, _) = try scriptedSession([plan, fatigue, flying])
        game.markDirty()
        session.tick()
        XCTAssertEqual(session.cameraHome, 0)
        game.markDirty()
        session.tick()
        XCTAssertNil(session.cameraHome, "a shot in the air: the camera follows it")
    }

    /// With the hold on, the flight lens frames your fort, not the hit, while nothing flies.
    @MainActor
    func testTheFollowLensHoldsHome() throws {
        var snap = try build(try planDict())
        snap.activeSide = 1
        let frame = CGSize(width: 780, height: 300)
        let held = Camera.worldRect(for: .follow, snap: snap, frame: frame, minBlock: 6, home: 0)
        XCTAssertEqual(held, Camera.planRect(snap, frame: frame, minBlock: 6, side: 0))
        let own = Camera.fortRect(0, snap: snap)
        XCTAssertLessThanOrEqual(held.minX, own.minX)
        XCTAssertGreaterThanOrEqual(held.maxX, own.maxX)
        let plan = Camera.worldRect(for: .both, snap: snap, frame: frame, minBlock: 6, home: 0)
        XCTAssertEqual(plan, held, "the plan lens stays home too")
        XCTAssertEqual(Camera.worldRect(for: .target, snap: snap, home: 0),
                       Camera.fortRect(1, snap: snap).insetBy(dx: -150, dy: -50).offsetBy(dx: 0, dy: 30))
    }
}

// MARK: N3: both forts in phone landscape

final class LandscapeFrameTests: XCTestCase {
    @MainActor
    func testPhonesFrameDownToSixPointBlocks() {
        let phone = BattleLayout.compute(size: CGSize(width: 844, height: 390), insets: Insets(), mode: .wide,
                                         inFlight: false, isPad: false)
        XCTAssertEqual(phone.lenses.first?.minBlock, 6)
        let pad = BattleLayout.compute(size: CGSize(width: 1180, height: 820), insets: Insets(), mode: .wide,
                                       inFlight: false, isPad: true)
        XCTAssertEqual(pad.lenses.first?.minBlock, 8)
        XCTAssertEqual(Camera.phoneMinBlockPoints, 6)
    }

    /// A frame where both forts draw at 7 pt: a phone keeps both, the 8 pt rule would not.
    @MainActor
    func testSevenPointBlocksStillFrameBothFortsOnAPhone() throws {
        let snap = try build(try planDict())
        let both = Camera.bothRect(snap)
        let unit = Camera.blockPoints(both, in: CGSize(width: 1000, height: 500))
        let k = 7 / unit
        let frame = CGSize(width: 1000 * k, height: 500 * k)
        XCTAssertEqual(Camera.blockPoints(both, in: frame), 7, accuracy: 0.01)
        XCTAssertEqual(Camera.planRect(snap, frame: frame, minBlock: 6), both)
        XCTAssertEqual(Camera.planRect(snap, frame: frame, minBlock: 8), Camera.ownPlanRect(snap))
        XCTAssertNil(Camera.rivalEdge(worldRect: both, snap: snap))
    }

    /// The marker is a one-tap peek: both forts at any zoom.
    @MainActor
    func testPeekShowsBothFortsAtAnyZoom() throws {
        let snap = try build(try planDict())
        let tiny = CGSize(width: 200, height: 90)
        XCTAssertEqual(Camera.planRect(snap, frame: tiny, minBlock: 6), Camera.ownPlanRect(snap))
        XCTAssertEqual(Camera.planRect(snap, frame: tiny, minBlock: 6, peek: true), Camera.bothRect(snap))
        XCTAssertEqual(Camera.worldRect(for: .both, snap: snap, frame: tiny, minBlock: 6, peek: true), Camera.bothRect(snap))
        XCTAssertEqual(Camera.markerText(peek: false), "Look at the Rival's fort")
        XCTAssertEqual(Camera.markerText(peek: true), "Back to my fort")
    }

    /// One tap peeks, a second comes home, and a shot comes home too.
    @MainActor
    func testPeekTogglesAndAShotBringsItHome() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-5", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-5")
        session.updateViewport(size: CGSize(width: 844, height: 390), insets: Insets())
        XCTAssertTrue(session.canPeek)
        session.toggleRivalPeek()
        XCTAssertTrue(session.rivalPeek)
        session.toggleRivalPeek()
        XCTAssertFalse(session.rivalPeek, "a second tap: back to my fort")
        session.toggleRivalPeek()
        XCTAssertTrue(session.rivalPeek)
        session.fire()
        XCTAssertFalse(session.rivalPeek, "a shot brings the camera home")
    }

    @MainActor
    func testNoPeekInPortrait() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-5", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-5")
        session.updateViewport(size: CGSize(width: 390, height: 844), insets: Insets())
        XCTAssertFalse(session.canPeek, "portrait has its own Target lens")
        session.toggleRivalPeek()
        XCTAssertFalse(session.rivalPeek)
    }
}

// MARK: Teaching the owner rule, and turn start (n1, n3)

final class OwnerRuleTeachingTests: XCTestCase {
    @MainActor
    private func makeSession() throws -> (BattleSession, RecordingBridge) {
        let bridge = RecordingBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 5)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        session.updateViewport(size: CGSize(width: 2000, height: 1000), insets: Insets())
        let map = LensMap(viewport: CGRect(x: 0, y: 0, width: 2000, height: 1000), frameCentre: .zero,
                          worldRect: .zero, scale: 1, sceneHeight: 1000)
        session.lensMap = { _ in map }
        XCTAssertTrue(session.canAct)
        return (session, bridge)
    }

    @MainActor
    private func drag(_ session: BattleSession, from a: CGPoint) {
        session.touchBegan(at: a)
        session.touchMoved(to: CGPoint(x: a.x - 60, y: a.y + 50))
        session.touchMoved(to: CGPoint(x: a.x - 120, y: a.y + 100))
        session.touchEnded(at: CGPoint(x: a.x - 120, y: a.y + 100))
    }

    /// The gold ring shows on the picked Hob until 3 aims were started from the fort.
    @MainActor
    func testTheRingShowsUntilThreeAimsFromTheFort() throws {
        let (session, _) = try makeSession()
        var counted: [Int] = []
        session.onAimStarted = { counted.append($0) }
        XCTAssertTrue(session.showOwnerRing)
        let fort = try XCTUnwrap(session.snapshot.fort(0))
        let b = try XCTUnwrap(fort.blocks.first)
        let onFort = CGPoint(x: b.x + b.w / 2, y: 1000 - (b.y + b.h / 2))
        for _ in 0..<3 {
            drag(session, from: onFort)
            session.fineTuneOpen = false
        }
        XCTAssertEqual(counted, [1, 2, 3])
        XCTAssertEqual(session.aimStarts, 3)
        XCTAssertFalse(session.showOwnerRing, "taught: the ring goes")
        drag(session, from: onFort)
        XCTAssertEqual(counted, [1, 2, 3], "no count past 3")
    }

    /// A sky drag does not count, and says where to press once per battle.
    @MainActor
    func testASkyDragNudgesOncePerBattle() throws {
        let (session, bridge) = try makeSession()
        let fort = try XCTUnwrap(session.snapshot.fort(0))
        let sky = CGPoint(x: fort.originX + Double(fort.cols) * fort.block + 300, y: 20)
        drag(session, from: sky)
        XCTAssertEqual(session.aimNudge?.text, "Drag back to aim")
        XCTAssertEqual(session.nudgeCount, 1)
        XCTAssertEqual(session.aimStarts, 0, "a sky drag is not an aim")
        XCTAssertEqual(bridge.count("aim"), 0)
        drag(session, from: sky)
        XCTAssertEqual(session.nudgeCount, 1, "once per battle")
        let at = try XCTUnwrap(session.aimNudge?.point)
        let fortTop = (fort.blocks.map { $0.y + $0.h }.max() ?? 0) + 24
        XCTAssertEqual(Double(at.x), fort.originX + Double(fort.cols) * fort.block / 2, accuracy: 0.5, "next to your fort")
        XCTAssertEqual(Double(at.y), 1000 - fortTop, accuracy: 0.5)
        let shown = AimNudge.clamped(CGPoint(x: -50, y: -50), in: CGSize(width: 390, height: 844))
        XCTAssertTrue(CGRect(x: 0, y: 0, width: 390, height: 844).contains(shown), "kept on screen")
    }

    /// A save keeps the count, and an older save without it starts at 0.
    func testTheCountIsSaved() throws {
        var data = SaveData()
        data.aimStarts = 2
        data.fort = WorkshopFort(name: "My Fort", rows: WorkshopGrid.homeRows)
        let back = try JSONDecoder().decode(SaveData.self, from: try JSONEncoder().encode(data))
        XCTAssertEqual(back.aimStarts, 2)
        XCTAssertEqual(back.fort?.rows, WorkshopGrid.homeRows)
        let old = try JSONDecoder().decode(SaveData.self, from: Data(#"{"schema":1,"counter":3}"#.utf8))
        XCTAssertEqual(old.aimStarts, 0)
        XCTAssertNil(old.fort)
    }

    /// n1: a turn opens on a Hob who can act.
    @MainActor
    func testATurnOpensOnAHobWhoCanAct() throws {
        let stuck = try build(try planWithTwoHobs(first: { $0["can_fire"] = false }))
        XCTAssertEqual(BattleSession.hobToOpen(stuck), "3", "the first crewmate who has a shot")
        let fine = try build(try planWithTwoHobs())
        XCTAssertNil(BattleSession.hobToOpen(fine))
        let dugIn = try build(try planWithTwoHobs(first: { h in
            h["can_fire"] = false
            h["buried"] = true
        }))
        XCTAssertNil(BattleSession.hobToOpen(dugIn), "dug in can act: Shove Off")
        let nobody = try build(try planWithTwoHobs(first: { $0["can_fire"] = false }, second: { $0["can_fire"] = false }))
        XCTAssertNil(BattleSession.hobToOpen(nobody), "nobody can: Fire offers Pass as before")
        var theirs = stuck
        theirs.activeSide = 1
        XCTAssertNil(BattleSession.hobToOpen(theirs), "only on the player's turn")
    }

    @MainActor
    func testTheTurnStartPicksAHobWhoCanAct() throws {
        let plan = try planWithTwoHobs()
        let stuck = nextTurn(try planWithTwoHobs(first: { $0["can_fire"] = false }), round: 2, events: [])
        let (session, game, bridge) = try scriptedSession([plan, stuck])
        game.markDirty()
        session.tick()
        XCTAssertTrue(bridge.commands.contains(#"{"cmd":"pick_hob","hob":3}"#), "picked the crewmate who can fire")
        let before = bridge.commands.count
        game.markDirty()
        session.tick()
        XCTAssertEqual(bridge.commands.filter { $0.contains("pick_hob") }.count, 1, "once a turn")
        XCTAssertGreaterThanOrEqual(bridge.commands.count, before)
    }
}

// MARK: Results: what broke you reads `by`; Double Pop explained

final class ResultWordsTests: XCTestCase {
    private func blow(_ json: String) throws -> CoreBlow {
        try JSONDecoder().decode(CoreBlow.self, from: Data(json.utf8))
    }

    func testWhatBrokeYouReadsBy() throws {
        let squall = try blow(#"{"by":"squall","hob":null,"hob_name":"The Squall","round":12,"shot":"squall","shot_name":"Squall"}"#)
        XCTAssertEqual(squall.by, "squall")
        XCTAssertFalse(squall.byHob)
        // The words come from text.json `results.blow.<by>`, not the core's own names.
        XCTAssertEqual(BrokeView.lastLine(squall), "Last blow: the Squall, Round 12")
        let hob = try blow(#"{"by":"hob","hob":0,"hob_name":"Marge Dumpling","round":9,"shot":"grand_dumpling","shot_name":"Grand Dumpling"}"#)
        XCTAssertEqual(BrokeView.lastLine(hob), "Last blow: Marge's Grand Dumpling, Round 9")
        let fatigue = try blow(#"{"by":"fatigue","hob":null,"hob_name":"Fatigue","shot":"fatigue","shot_name":"Fatigue collapse","dmg":40}"#)
        XCTAssertEqual(BrokeView.names(fatigue).main, "the Creaks")
        XCTAssertEqual(BrokeView.names(fatigue).detail, "")
        let fall = try blow(#"{"by":"ground","hob":null,"hob_name":"A fall","shot":"fall","shot_name":"Fall","round":4}"#)
        XCTAssertEqual(BrokeView.lastLine(fall), "Last blow: a fall, Round 4")
        let crock = try blow(#"{"by":"prop","hob":null,"hob_name":"A Tick-Tock Crock","shot":"tick_tock_crock","shot_name":"Tick-Tock Crock","round":6}"#)
        XCTAssertEqual(BrokeView.lastLine(crock), "Last blow: Tick-Tock Crock, Round 6")
        // Old Thumper keeps his whole short name; it is never cut at the first space.
        let thump = try blow(#"{"by":"hob","hob":1,"hob_name":"Old Thumper","round":5,"shot":"clodpot","shot_name":"Clodpot"}"#)
        XCTAssertEqual(BrokeView.lastLine(thump), "Last blow: Old Thumper's Clodpot, Round 5")
        // An older core without `by`: a Hob id still reads as a Hob's shot.
        let old = try blow(#"{"hob":2,"hob_name":"Jax Pepper","round":3,"shot":"clodpot","shot_name":"Clodpot"}"#)
        XCTAssertTrue(old.byHob)
        XCTAssertEqual(BrokeView.lastLine(old), "Last blow: Jax's Clodpot, Round 3")
    }

    @MainActor
    func testTheEndedFixtureCarriesBy() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_ended")))
        let broke = try XCTUnwrap(raw.result?.broke)
        XCTAssertEqual(broke.last?.by, "hob")
        XCTAssertTrue(broke.top.allSatisfy { !$0.by.isEmpty && !$0.hobName.isEmpty })
    }

    @MainActor
    func testDoublePopIsExplained() throws {
        func info(_ how: String, winner: Int) -> ResultInfo {
            ResultInfo(result: BattleResult(winner: winner, reason: how), setup: .campaign("1-9", preset: .fair, seed: 1),
                       title: "1-9", names: ["You", "Rival"], goals: [])
        }
        let pop = info("double_pop", winner: 0)
        // A campaign win takes the level's own title (text.md, Results).
        XCTAssertEqual(pop.headline, "Loaf Hill stays")
        XCTAssertEqual(pop.explainer, ResultInfo.doublePopNote)
        XCTAssertTrue(ResultInfo.doublePopNote.contains("Whoever had more left standing before it wins"))
        XCTAssertEqual(info("kettle_pop", winner: 0).explainer, "Kettle Pop!", "the how line sits under the level title")
        let lost = info("kettle_pop", winner: 1)
        XCTAssertEqual(lost.headline, "Kettle popped")
        XCTAssertNotEqual(lost.explainer, lost.headline, "never a cause line that says the same as the title")
        var duel = info("double_pop", winner: 1)
        duel.setup = BattleSetup(mode: .duel, map: "d1", seed: 1)
        XCTAssertNotNil(duel.explainer, "Couch Duel says it too")
    }
}

// MARK: The Workshop

final class WorkshopTests: XCTestCase {
    func testTheHomeFortRoundTrips() {
        let grid = WorkshopGrid(rows: WorkshopGrid.homeRows)
        XCTAssertEqual(grid.glyphRows(), WorkshopGrid.homeRows)
        XCTAssertEqual(grid.nooks, 3)
        // bp_home_3 in content/blueprints.json: the Kettle Room low at the back, Nook 3 high at the front.
        XCTAssertEqual(grid.cell(1, 0), .kettle)
        XCTAssertEqual(grid.cell(4, 4), .nook(3))
        XCTAssertEqual(grid.cell(0, 5), .block("w"))
    }

    func testPlaceAndRemoveBlocks() {
        var grid = WorkshopGrid()
        XCTAssertTrue(grid.isEmpty)
        XCTAssertTrue(grid.apply(.cobble, c: 2, r: 0))
        XCTAssertTrue(grid.apply(.wicker, c: 4, r: 1))
        XCTAssertFalse(grid.apply(.wicker, c: 4, r: 1), "the same block again changes nothing")
        XCTAssertEqual(grid.glyphRows(), ["..w", "c..", "FFF"], "cut to the used columns, on a full Footing")
        XCTAssertTrue(grid.apply(.erase, c: 4, r: 1))
        XCTAssertEqual(grid.cell(4, 1), .empty)
        XCTAssertFalse(grid.apply(.erase, c: 4, r: 1))
        XCTAssertFalse(grid.apply(.timber, c: 8, r: 0), "off the grid")
        // The top row is built on, the core counts 9 rows plus the Footing.
        XCTAssertTrue(grid.apply(.timber, c: 2, r: WorkshopGrid.rows - 1))
        XCTAssertEqual(grid.glyphRows().count, WorkshopGrid.rows + 1)
        XCTAssertLessThanOrEqual(grid.glyphRows().count, 10)
    }

    func testRoomsAreTwoByTwoAndNooksStayNumbered() {
        var grid = WorkshopGrid()
        XCTAssertTrue(grid.apply(.nook, c: 1, r: 1))
        XCTAssertTrue(grid.apply(.nook, c: 4, r: 1))
        XCTAssertEqual(grid.cell(2, 2), .nook(1))
        XCTAssertEqual(grid.cell(5, 2), .nook(2))
        XCTAssertFalse(grid.apply(.nook, c: 2, r: 2), "rooms never overlap")
        XCTAssertFalse(grid.apply(.timber, c: 1, r: 1), "a block never covers a room")
        XCTAssertFalse(grid.apply(.kettle, c: 7, r: 0), "a room needs 2 x 2 on the grid")
        XCTAssertTrue(grid.apply(.erase, c: 2, r: 2))
        XCTAssertEqual(grid.cell(1, 1), .empty, "erase takes the whole room")
        XCTAssertEqual(grid.cell(4, 1), .nook(1), "the next Nook moves down: 1 with no gaps")
        XCTAssertEqual(grid.nooks, 1)
        XCTAssertTrue(grid.apply(.kettle, c: 1, r: 4))
        XCTAssertTrue(grid.apply(.kettle, c: 1, r: 6))
        XCTAssertEqual(grid.cell(1, 4), .empty, "one Kettle Room")
        XCTAssertEqual(grid.cell(2, 7), .kettle)
        for (c, r) in [(0, 0), (2, 0), (6, 0), (0, 2)] { _ = grid.apply(.nook, c: c, r: r) }
        XCTAssertEqual(grid.nooks, WorkshopGrid.maxNooks)
        XCTAssertFalse(grid.apply(.nook, c: 6, r: 4), "five Nooks at most")
    }

    func testProblemCellsMapToTheGrid() {
        var grid = WorkshopGrid()
        grid.apply(.timber, c: 2, r: 0)
        grid.apply(.timber, c: 5, r: 3)
        let at = grid.gridCell(core: [3, 4])
        XCTAssertEqual(at?.c, 5)
        XCTAssertEqual(at?.r, 3)
        XCTAssertNil(grid.gridCell(core: [0, 0]), "the Footing row is not on the grid")
    }

    func testTheCoresReasonsInPlainWords() {
        XCTAssertEqual(WorkshopGrid.plainWords("grid 8x11 outside 3x3 to 8x10"), "Too big. Keep it within 8 wide and 9 tall.")
        XCTAssertEqual(WorkshopGrid.plainWords("grid 2x2 outside 3x3 to 8x10"), "Too small. Build at least 3 wide and 2 tall.")
        XCTAssertEqual(WorkshopGrid.plainWords("Block Budget 80 over 72"), "8 blocks too many.")
        XCTAssertEqual(WorkshopGrid.plainWords("Nook 2 must be walled on all four sides"), "Nook 2 needs four walls.")
        XCTAssertEqual(WorkshopGrid.plainWords("Kettle Room must be 2 x 2"), "The Kettle Room is two blocks by two.")
        XCTAssertEqual(WorkshopGrid.plainWords("3 block(s) have no support, first at column 2 row 4"), "Nothing under it")
        for d in ["grid 8x11 outside 3x3 to 8x10", "0 Nooks for 1 Hobs", "some_new_reason"] {
            let w = WorkshopGrid.plainWords(d)
            XCTAssertFalse(w.contains("_"))
            XCTAssertFalse(w.contains("8x11"))
        }
    }

    func testCellsAreAtLeastTwentyFourPoints() {
        XCTAssertEqual(WorkshopGrid.cellSize(for: CGSize(width: 150, height: 120)), 24, "small screens scroll, cells stay 24")
        XCTAssertGreaterThanOrEqual(WorkshopGrid.cellSize(for: CGSize(width: 296, height: 312)), 24, "iPhone SE portrait")
        XCTAssertGreaterThanOrEqual(WorkshopGrid.cellSize(for: CGSize(width: 464, height: 300)), 24, "phone landscape")
        XCTAssertEqual(WorkshopGrid.cellSize(for: CGSize(width: 2000, height: 2000)), 48)
        XCTAssertGreaterThanOrEqual(WorkshopGrid.minCell, 24)
    }

    /// The stand-in core answers; the editor saves only a fort it accepted.
    @MainActor
    func testTheEditorSavesOnlyAnAcceptedFort() {
        let workshop = WorkshopModel(rows: nil, checker: WorkshopChecker(bridge: FakeCoreBridge()))
        XCTAssertTrue(workshop.check.ok, workshop.check.words)
        XCTAssertEqual(workshop.check.budget, 72)
        XCTAssertEqual(workshop.check.used, WorkshopGrid(rows: WorkshopGrid.homeRows).used)
        workshop.tool = .erase
        workshop.tap(c: 1, r: 0)
        XCTAssertFalse(workshop.check.ok, "no Kettle Room")
        XCTAssertFalse(workshop.check.words.contains("_"))
        XCTAssertNil(workshop.rowsToSave())
        workshop.undo()
        XCTAssertTrue(workshop.check.ok)
        XCTAssertEqual(workshop.rowsToSave(), WorkshopGrid.homeRows)
        XCTAssertTrue(workshop.saved)
        let empty = WorkshopChecker(bridge: FakeCoreBridge()).check(WorkshopGrid())
        XCTAssertFalse(empty.ok)
        XCTAssertEqual(empty.words, "Put some blocks down.")
    }

    @MainActor
    func testWorkshopValidatesOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let checker = WorkshopChecker(standIn: false)
        XCTAssertFalse(checker.isStandIn)
        var grid = WorkshopGrid(rows: WorkshopGrid.homeRows)
        let home = checker.check(grid)
        XCTAssertTrue(home.ok, home.words)
        XCTAssertEqual(home.budget, 72)
        XCTAssertGreaterThan(home.cost, 0)
        XCTAssertEqual(home.used, grid.used)
        // A block high in the air on the top row: the grid is 8 x 10 with the Footing, so it fits,
        // but the support solver refuses it and marks the cell.
        XCTAssertTrue(grid.apply(.wicker, c: 7, r: WorkshopGrid.rows - 1))
        let hanging = checker.check(grid)
        XCTAssertFalse(hanging.ok)
        XCTAssertEqual(hanging.words, "Nothing under it", hanging.words)
        XCTAssertTrue(hanging.marked.contains((WorkshopGrid.rows - 1) * WorkshopGrid.cols + 7))
        // No Nook: the fort cannot seat a Hob.
        var bare = WorkshopGrid(rows: WorkshopGrid.homeRows)
        for n in [3, 2, 1] {
            if let at = (0..<WorkshopGrid.rows).flatMap({ r in (0..<WorkshopGrid.cols).map { (c: $0, r: r) } })
                .first(where: { bare.cell($0.c, $0.r) == .nook(n) }) {
                bare.apply(.erase, c: at.c, r: at.r)
                for (dc, dr) in [(0, 0), (1, 0), (0, 1), (1, 1)] { bare.apply(.timber, c: at.c + dc, r: at.r + dr) }
            }
        }
        XCTAssertEqual(bare.nooks, 0)
        let seatless = checker.check(bare)
        XCTAssertFalse(seatless.ok)
        XCTAssertEqual(seatless.words, "Add a Nook for each Hob.")
    }
}

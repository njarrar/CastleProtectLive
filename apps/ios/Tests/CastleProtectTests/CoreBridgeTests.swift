import XCTest
@testable import CastleProtect

private final class BundleToken {}

/// Reads a file from core/fixtures (copied into this test bundle as `fixtures/`).
func fixtureText(_ name: String) throws -> String {
    let bundle = Bundle(for: BundleToken.self)
    let url = try XCTUnwrap(
        bundle.url(forResource: name, withExtension: "json", subdirectory: "fixtures")
            ?? Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "fixtures"),
        "core/fixtures/\(name).json is not in the test bundle"
    )
    return try String(contentsOf: url, encoding: .utf8)
}

/// The wire types against the core's own fixtures (core/fixtures, core/API.md).
final class CoreProtocolTests: XCTestCase {
    func testPlanSnapshotDecodes() throws {
        let snap = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        XCTAssertEqual(snap.phase, "plan")
        XCTAssertEqual(snap.awaiting, "human")
        XCTAssertTrue(snap.full)
        XCTAssertEqual(snap.level, "1-1")
        XCTAssertEqual(snap.castles.count, 2)
        XCTAssertFalse(snap.castles[0].blocks.isEmpty)
        let marge = try XCTUnwrap(snap.hobs.first { $0.def == "marge" })
        XCTAssertEqual(marge.side, 0)
        XCTAssertEqual(marge.cls, "lobber")
        XCTAssertEqual(marge.plain, "clodpot")
        XCTAssertTrue(marge.canFire)
        XCTAssertEqual(snap.hud.roundCap, 8)
        XCTAssertEqual(snap.hud.control, ["human", "ai"])
        XCTAssertEqual(snap.hud.selected.shot, "plain")
        XCTAssertFalse(snap.preview.isEmpty)
    }

    func testLeanSnapshotDecodesCompactShells() throws {
        let snap = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_lean")))
        XCTAssertFalse(snap.full)
        XCTAssertEqual(snap.phase, "resolve")
        let shell = try XCTUnwrap(snap.shells.first)
        XCTAssertEqual(shell.shot, "clodpot")
        XCTAssertGreaterThan(shell.x, 0)
    }

    func testAfterShotEvents() throws {
        let snap = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_after_shot")))
        XCTAssertTrue(snap.events.contains { $0.t == "explode" && $0.dmg != nil && $0.x != nil })
        XCTAssertTrue(snap.events.contains { $0.t == "turn_start" })
        XCTAssertTrue(snap.ghosts.contains { $0.pin != nil })
    }

    func testCommandsMatchTheFixture() throws {
        let data = Data(try fixtureText("commands_1_1").utf8)
        let root = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let expected = try XCTUnwrap(root["commands"] as? [[String: Any]])
        let ours: [CoreCommand] = [
            .pickHob(hob: 0),
            .pickShot(shot: "plain"),
            .aim(angle: 450, power: 62),
            .leanLines(side: 1, c: 0, r: 1),
        ]
        XCTAssertEqual(expected.count, ours.count)
        for (want, cmd) in zip(expected, ours) {
            XCTAssertEqual(NSDictionary(dictionary: want), NSDictionary(dictionary: cmd.jsonObject()), cmd.name)
        }
    }

    func testCommandJSONIsStable() {
        XCTAssertEqual(CoreCommand.aim(angle: 620, power: 74).jsonString(), #"{"angle":620,"cmd":"aim","power":74}"#)
        XCTAssertEqual(CoreCommand.fire().jsonString(), #"{"cmd":"fire"}"#)
        XCTAssertEqual(CoreCommand.walk(dx: -8).jsonString(), #"{"cmd":"walk","dx":-8}"#)
        XCTAssertEqual(CoreCommand.pickShell(shell: "marble_sack").jsonString(), #"{"cmd":"pick_shell","shell":"marble_sack"}"#)
        XCTAssertEqual(CoreCommand.aiTurn().jsonString(), #"{"cmd":"ai_turn"}"#)
        XCTAssertEqual(CoreCommand.giveUp().jsonString(), #"{"cmd":"give_up"}"#)
        XCTAssertEqual(CoreCommand.giveUp(side: 1).jsonString(), #"{"cmd":"give_up","side":1}"#)
        XCTAssertEqual(CoreCommand.setWind(wind: -4).jsonString(), #"{"cmd":"set_wind","wind":-4}"#)
        XCTAssertEqual(CoreCommand.resume(log: #"[{"cmd":"pass"}]"#).jsonString(), #"{"cmd":"resume","log":[{"cmd":"pass"}]}"#)
        // Aim is clamped to the legal range before it is sent.
        XCTAssertEqual(CoreCommand.aim(angle: 2000, power: -3).jsonString(), #"{"angle":1800,"cmd":"aim","power":0}"#)
    }

    func testSetupUsesOnlySchemaKeys() throws {
        let allowedTop: Set<String> = ["level", "mode", "sides", "first_turn", "round_cap", "squall", "wind", "rummage", "puff_up",
                                       "volley", "progress"]
        let allowedSide: Set<String> = ["control", "preset", "crew", "blueprint", "rows", "doodads", "kit", "name", "steam", "aim",
                                        "help", "preview_pct", "crew_size"]
        var duel = BattleSetup(mode: .duel, map: "d1", seed: 9)
        duel.names = ["Mabel", "Otis"]
        duel.forts = ["box_1", "box_3"]
        duel.shells = .plain
        let setups = [BattleSetup.campaign("1-3", preset: .cozy, seed: 3), BattleSetup(mode: .skirmish, map: "d2", seed: 4), duel]
        for setup in setups {
            let obj = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(setup.coreSetup().jsonString().utf8)) as? [String: Any])
            XCTAssertTrue(Set(obj.keys).isSubset(of: allowedTop), "\(obj.keys)")
            XCTAssertNotNil(obj["level"] as? String)
            for side in obj["sides"] as? [[String: Any]] ?? [] {
                XCTAssertTrue(Set(side.keys).isSubset(of: allowedSide), "\(side.keys)")
            }
        }
        let couch = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(duel.coreSetup().jsonString().utf8)) as? [String: Any])
        XCTAssertEqual(couch["mode"] as? String, "couch")
        XCTAssertEqual(couch["first_turn"] as? String, "coin")
        let sides = try XCTUnwrap(couch["sides"] as? [[String: Any]])
        XCTAssertEqual(sides[1]["kit"] as? String, "kit_reed")
        XCTAssertEqual(sides[0]["name"] as? String, "Mabel")
        XCTAssertEqual((couch["rummage"] as? [String: Any])?["pool"] as? Int, 0)
    }

    func testRepliesDecodeRefusals() {
        let refused = CoreReply.decode(#"{"ok":false,"reason":"not_planning"}"#)
        XCTAssertFalse(refused.ok)
        XCTAssertEqual(refused.reason, "not_planning")
        let aimed = CoreReply.decode(#"{"ok":true,"angle":450,"power":62}"#)
        XCTAssertTrue(aimed.ok)
        XCTAssertEqual(aimed.angle, 450)
        XCTAssertFalse(CoreReply.decode("not json").ok)
    }
}

/// The view model built from core snapshots.
@MainActor
final class FrameAssemblerTests: XCTestCase {
    func testPlanFrameFlipsYAndBuildsTheHud() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let assembler = FrameAssembler(catalog: ContentCatalog.load())
        let frame = assembler.assemble(raw, handoffTo: nil, speed: 1)
        XCTAssertEqual(frame.phase, .plan)
        XCTAssertTrue(frame.humanTurn)
        XCTAssertEqual(frame.forts.count, 2)
        let rawMarge = try XCTUnwrap(raw.hobs.first { $0.def == "marge" })
        let marge = try XCTUnwrap(frame.fort(0)?.hobs.first { $0.def == "marge" })
        XCTAssertEqual(marge.y, Double(raw.map.h - rawMarge.y), accuracy: 0.001)
        XCTAssertEqual(frame.selectedHob, String(rawMarge.id))
        XCTAssertEqual(frame.shots.first?.id, "plain")
        XCTAssertTrue(frame.shots.contains { $0.id == "knack" })
        XCTAssertTrue(frame.canFire)
        XCTAssertEqual(frame.aim.angle, rawMarge.aim.angle)
        XCTAssertEqual(frame.preview.count, raw.preview.count * 2)
        XCTAssertGreaterThan(frame.terrain.count, 1)
    }

    func testLeanFrameKeepsTheLastFullOne() throws {
        let assembler = FrameAssembler(catalog: ContentCatalog.load())
        let plan = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let lean = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_lean")))
        _ = assembler.assemble(plan, handoffTo: nil, speed: 1)
        let frame = assembler.assemble(lean, handoffTo: nil, speed: 1)
        XCTAssertEqual(frame.phase, .flight)
        XCTAssertEqual(frame.forts.count, 2)
        XCTAssertEqual(frame.shells.count, lean.shells.count)
        XCTAssertFalse(frame.humanTurn)
    }

    func testHandoffTurnsPlanIntoTheCard() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let frame = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: 0, speed: 1)
        XCTAssertEqual(frame.phase, .handoff)
        XCTAssertEqual(frame.handoff?.toSide, 0)
        XCTAssertFalse(frame.canFire)
    }

    func testEventsInTheAppsWords() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_after_shot")))
        let frame = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        let blast = try XCTUnwrap(frame.events.first { $0.type == "hit" })
        XCTAssertGreaterThan(blast.amount, 0)
        XCTAssertTrue(frame.events.contains { $0.type == "turn" })
    }
}

/// The battle runner over the stand-in (fixture player), and over the real core when linked.
final class CoreGameTests: XCTestCase {
    @MainActor
    func testStandInPlaysAShotAndTheRivalTurn() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 42)))
        let first = try XCTUnwrap(game.frame())
        XCTAssertEqual(first.phase, .plan)
        XCTAssertTrue(first.humanTurn)

        let aim = game.send(.aim(angle: 455, power: 70))
        XCTAssertTrue(aim.ok)
        XCTAssertEqual(aim.angle, 455)
        _ = game.frame()
        XCTAssertEqual(game.frame()?.aim.power, 70)

        XCTAssertTrue(game.send(.fire()).ok)
        XCTAssertEqual(game.frame()?.phase, .flight)
        let after = try XCTUnwrap(game.frame())
        XCTAssertEqual(after.activeSide, 1)
        XCTAssertFalse(after.humanTurn)

        // The think pose, then ai_turn on the core queue (off the main thread).
        game.thinkMs = 100
        game.advance(milliseconds: 150)
        game.waitUntilIdle()
        XCTAssertFalse(game.isBusy)
        let back = try XCTUnwrap(game.frame())
        XCTAssertEqual(back.activeSide, 0)
        XCTAssertTrue(back.humanTurn)
    }

    @MainActor
    func testSaveAndResume() async throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 7)))
        _ = game.frame()
        XCTAssertTrue(game.send(.aim(angle: 500, power: 66)).ok)
        _ = game.frame()
        let bytes = game.save()
        XCTAssertFalse(bytes.isEmpty)

        let header = try XCTUnwrap(CoreGame.header(bytes))
        XCTAssertEqual(header.rules, game.rulesVersion)
        XCTAssertNotNil(header.hash)

        let other = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let loaded = await other.load(bytes)
        XCTAssertEqual(loaded, .ok)
        XCTAssertEqual(other.setup?.level, "1-1")
        XCTAssertNotNil(other.frame())
        let junk = await other.load(Data("nonsense".utf8))
        XCTAssertEqual(junk, .damaged)
    }

    /// H4: a save from other game rules is refused, not replayed.
    @MainActor
    func testSaveFromOtherRulesIsRefused() async throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 7)))
        _ = game.frame()
        var saved = try XCTUnwrap(CoreGame.header(game.save()))
        saved.rules = game.rulesVersion + 1
        let other = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let result = await other.load(try JSONEncoder().encode(saved))
        XCTAssertEqual(result, .rulesChanged)
        XCTAssertFalse(other.isRunning)
        saved.rules = nil
        let old = await other.load(try JSONEncoder().encode(saved))
        XCTAssertEqual(old, .rulesChanged, "a save with no rules version is from before this check")
    }

    /// H4: a replay that lands on another state hash is refused.
    @MainActor
    func testReplayWithAnotherHashIsRefused() async throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 7)))
        _ = game.frame()
        XCTAssertTrue(game.send(.aim(angle: 500, power: 66)).ok)
        var saved = try XCTUnwrap(CoreGame.header(game.save()))
        saved.hash = "0000000000000000"
        let other = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let result = await other.load(try JSONEncoder().encode(saved))
        XCTAssertEqual(result, .replayFailed("hash"))
        XCTAssertFalse(other.isRunning)
    }

    @MainActor
    func testRefusalWithoutABattle() {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertFalse(game.send(.fire()).ok)
        XCTAssertNil(game.frame())
        XCTAssertTrue(game.save().isEmpty)
    }

    @MainActor
    func testRealCoreWhenLinked() async throws {
        guard CoreFactory.realCoreLinked else {
            throw XCTSkip("CastleCore.xcframework is not linked in this build")
        }
        let bridge = CoreFactory.make(preferStandIn: false)
        XCTAssertFalse(bridge.isStandIn)
        XCTAssertTrue(bridge.version.contains("sim"))
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 42)))
        let frame = try XCTUnwrap(game.frame())
        XCTAssertEqual(frame.phase, .plan)
        XCTAssertEqual(frame.forts.count, 2)
        XCTAssertGreaterThan(frame.terrain.count, 10)
        let grid = try XCTUnwrap(frame.ground, "the real cell grid reaches the renderer (H6)")
        XCTAssertTrue(grid.hasData)
        XCTAssertTrue(grid.cells.contains { $0 != 0 })
        XCTAssertTrue(game.send(.aim(angle: 450, power: 62)).ok)
        XCTAssertTrue(game.send(.fire()).ok)
        for _ in 0..<200 {
            game.advance(milliseconds: 50)
            if game.frame()?.activeSide == 1 { break }
        }
        let bytes = game.save()
        XCTAssertFalse(bytes.isEmpty)
        let replayed = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        let result = await replayed.load(bytes)
        XCTAssertEqual(result, .ok)
        XCTAssertEqual(replayed.frame()?.turnSeq, game.frame()?.turnSeq)
        XCTAssertEqual(replayed.stateHash(), game.stateHash())
    }

    @MainActor
    func testRefusedSetupIsReported() throws {
        guard CoreFactory.realCoreLinked else {
            throw XCTSkip("CastleCore.xcframework is not linked in this build")
        }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        XCTAssertNotNil(game.start(.campaign("no-such-level", preset: .fair, seed: 1)))
    }
}

/// Region 1 data from the bundled content.
final class ContentCatalogTests: XCTestCase {
    func testRegionOneUnlocksInOrder() {
        let catalog = ContentCatalog.load()
        XCTAssertEqual(catalog.levels.first?.id, "1-1")
        XCTAssertEqual(catalog.levels.last?.id, "1-10")
        let fresh = catalog.campaign(pennants: [:])
        XCTAssertEqual(fresh.levels.first?.state, "next")
        XCTAssertTrue(fresh.levels.dropFirst().allSatisfy(\.isLocked))
        let later = catalog.campaign(pennants: ["1-1": 2, "1-2": 1])
        XCTAssertEqual(later.levels[0].state, "done")
        XCTAssertEqual(later.levels[2].state, "next")
        XCTAssertTrue(later.levels[3].isLocked)
        XCTAssertFalse(catalog.maps.isEmpty)
    }
}

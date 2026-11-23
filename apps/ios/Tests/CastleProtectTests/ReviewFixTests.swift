import XCTest
@testable import CastleProtect

// Tests for the gaps listed in docs/review/code/ios-review-1.md.

/// A bridge that serves scripted snapshots and records every command.
final class ScriptedBridge: CoreBridge {
    let name = "scripted"
    let isStandIn = true
    let version = #"{"sim":"test","rules":1,"tick_hz":120}"#
    var snapshots: [String]
    var sent: [String] = []
    var replies: [String: String] = [:]

    init(snapshots: [String]) {
        self.snapshots = snapshots
    }

    func start(setup: String, seed: UInt64) -> String? { nil }

    func command(_ json: String) -> String {
        let obj = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any]
        let cmd = obj?["cmd"] as? String ?? ""
        sent.append(cmd)
        return replies[cmd] ?? #"{"ok":true}"#
    }

    func step(_ ticks: Int) -> String { #"{"tick":0,"phase":"plan"}"# }

    func snapshot() -> String {
        snapshots.count > 1 ? snapshots.removeFirst() : (snapshots.first ?? "{}")
    }

    func end() {}
}

/// The stand-in core, with every command name recorded.
final class RecordingBridge: CoreBridge {
    let inner = FakeCoreBridge()
    var sent: [String] = []
    var name: String { inner.name }
    var isStandIn: Bool { true }
    var version: String { inner.version }

    func start(setup: String, seed: UInt64) -> String? { inner.start(setup: setup, seed: seed) }

    func command(_ json: String) -> String {
        let obj = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any]
        sent.append(obj?["cmd"] as? String ?? "")
        return inner.command(json)
    }

    func step(_ ticks: Int) -> String { inner.step(ticks) }
    func snapshot() -> String { inner.snapshot() }
    func end() { inner.end() }

    func count(_ cmd: String) -> Int { sent.filter { $0 == cmd }.count }
}

/// The plan fixture as a JSON object, changed by `edit`, back as text.
func patchedPlan(_ edit: (inout [String: Any]) -> Void) throws -> String {
    var obj = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(try fixtureText("snapshot_plan").utf8)) as? [String: Any])
    edit(&obj)
    return String(decoding: try JSONSerialization.data(withJSONObject: obj), as: UTF8.self)
}

final class SessionGuardTests: XCTestCase {
    @MainActor
    private func makeSession() throws -> (BattleSession, RecordingBridge) {
        let bridge = RecordingBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 5)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 5), title: "1-1")
        XCTAssertTrue(session.canAct)
        return (session, bridge)
    }

    /// H3: no action reaches the core while paused, on the Rival's turn or after the session stopped.
    @MainActor
    func testActionsAreGuarded() throws {
        let (session, bridge) = try makeSession()
        XCTAssertTrue(session.walk(1))
        XCTAssertEqual(bridge.count("walk"), 1)

        session.pause()
        XCTAssertFalse(session.canAct)
        XCTAssertFalse(session.walk(1))
        XCTAssertFalse(session.nudge(angle: 5, power: 0))
        session.fire()
        XCTAssertEqual(bridge.count("walk"), 1)
        XCTAssertEqual(bridge.count("fire"), 0)
        XCTAssertEqual(bridge.count("aim"), 0)
        session.resume()

        // Fire: the turn passes to the Rival. Nothing the player does reaches the core now.
        session.fire()
        XCTAssertEqual(bridge.count("fire"), 1)
        for _ in 0..<4 { session.game.markDirty(); session.tick() }
        XCTAssertFalse(session.snapshot.humanTurn)
        XCTAssertFalse(session.canAct)
        XCTAssertFalse(session.walk(-1))
        XCTAssertFalse(session.nudge(angle: 0, power: 1))
        XCTAssertFalse(session.pass())
        session.fire()
        session.pickShot("knack")
        XCTAssertEqual(bridge.count("walk"), 1)
        XCTAssertEqual(bridge.count("fire"), 1)
        XCTAssertEqual(bridge.count("pass"), 0)
        XCTAssertEqual(bridge.count("pick_shot"), 0)

        session.stop()
        XCTAssertFalse(session.canAct)
    }

    /// C1: a held key stops repeating as soon as the action is refused, and on cancel.
    @MainActor
    func testHeldWalkStopsWhenPausedOrCancelled() async throws {
        let (session, bridge) = try makeSession()
        let repeater = Repeater()
        repeater.start(delay: 0, rate: 100, fastRate: 100) { session.walk(1) }
        try await Task.sleep(nanoseconds: 80_000_000)
        XCTAssertGreaterThan(bridge.count("walk"), 0)
        session.pause()
        try await Task.sleep(nanoseconds: 60_000_000)
        let afterPause = bridge.count("walk")
        try await Task.sleep(nanoseconds: 150_000_000)
        XCTAssertEqual(bridge.count("walk"), afterPause, "no walk is sent while paused")
        XCTAssertFalse(repeater.isRunning, "the refused action ended the repeat")

        session.resume()
        repeater.start(delay: 0, rate: 100, fastRate: 100) { session.walk(1) }
        try await Task.sleep(nanoseconds: 50_000_000)
        repeater.cancel()
        let afterCancel = bridge.count("walk")
        try await Task.sleep(nanoseconds: 150_000_000)
        XCTAssertEqual(bridge.count("walk"), afterCancel, "cancel (finger up, view gone, app switch) ends it")

        // A new battle: the old session is stopped, so a stale repeat sends nothing.
        repeater.start(delay: 0, rate: 100, fastRate: 100) { session.walk(1) }
        session.stop()
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(bridge.count("walk"), afterCancel)
        XCTAssertFalse(repeater.isRunning)
    }

    /// H2: with the only Hob dug in, Fire is Shove Off, and Pass always ends the turn.
    @MainActor
    func testBuriedHobHasAWayOut() throws {
        let plan = try patchedPlan { obj in
            let hud = obj["hud"] as? [String: Any] ?? [:]
            let sel = (hud["selected"] as? [String: Any])?["hob"] as? Int ?? 0
            var hobs = obj["hobs"] as? [[String: Any]] ?? []
            for i in hobs.indices where hobs[i]["id"] as? Int == sel {
                hobs[i]["buried"] = true
                hobs[i]["can_fire"] = false
            }
            obj["hobs"] = hobs
        }
        let bridge = ScriptedBridge(snapshots: [plan])
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 1)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 1), title: "1-1")
        XCTAssertTrue(session.snapshot.dugIn)
        XCTAssertTrue(session.hud.dugIn)
        session.fire()
        XCTAssertTrue(bridge.sent.contains("shove_off"))
        XCTAssertFalse(bridge.sent.contains("fire"))
        XCTAssertTrue(session.pass())
        XCTAssertTrue(bridge.sent.contains("pass"))
    }

    /// H2: Doodads in hand show in the HUD and Fire uses the picked one.
    @MainActor
    func testDoodadIsUsedByFire() throws {
        let plan = try patchedPlan { obj in
            var hud = obj["hud"] as? [String: Any] ?? [:]
            hud["doodads"] = [["mend_bucket", "pot_lid"], [String]()]
            obj["hud"] = hud
        }
        let bridge = ScriptedBridge(snapshots: [plan])
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 1)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 1), title: "1-1")
        XCTAssertEqual(session.hud.doodads, ["mend_bucket", "pot_lid"])
        session.armDoodad("pot_lid")
        XCTAssertEqual(session.armedDoodad, "pot_lid")
        session.fire()
        XCTAssertTrue(bridge.sent.contains("doodad"))
        XCTAssertFalse(bridge.sent.contains("fire"))
        XCTAssertNil(session.armedDoodad)
    }

    /// H5: the result is handed over in the frame it arrives, before the screen change.
    @MainActor
    func testResultIsRecordedAtOnce() async throws {
        let plan = try fixtureText("snapshot_plan")
        let ended = try patchedPlan { obj in
            obj["phase"] = "ended"
            obj["awaiting"] = "none"
            obj["result"] = ["winner": 0, "how": "kettle_pop", "round": 3, "pennants": [true, false, true]] as [String: Any]
        }
        let bridge = ScriptedBridge(snapshots: [plan, ended])
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 1)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 1), title: "1-1")
        var recorded: BattleResult?
        var screenChanged = false
        session.onResult = { _, r in recorded = r }
        session.onEnded = { _, _ in screenChanged = true }
        game.markDirty()
        session.tick()
        XCTAssertEqual(recorded?.pennants, 2)
        XCTAssertEqual(recorded?.reason, "kettle_pop")
        XCTAssertFalse(screenChanged)
        // Leaving in the 1.2 s window (Pause, Map) stops the session: the result stays recorded, no late screen change.
        session.stop()
        try await Task.sleep(nanoseconds: 1_400_000_000)
        XCTAssertFalse(screenChanged)
    }

    /// M13: a dead core (phase none) stops the battle with a fault, not an empty sky.
    @MainActor
    func testDeadCoreRaisesAFault() throws {
        let bridge = ScriptedBridge(snapshots: [try fixtureText("snapshot_plan"), #"{"phase":"none"}"#])
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 1)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 1), title: "1-1")
        var fault: String?
        session.onFault = { _, why in fault = why }
        game.markDirty()
        session.tick()
        XCTAssertNotNil(fault)
        XCTAssertFalse(session.canAct)
    }

    /// H8: aim during a drag is throttled; nothing is read in Plan when nothing was sent.
    @MainActor
    func testPlanStepReadsNoFrameWhenIdle() throws {
        let (session, _) = try makeSession()
        let version = session.frameVersion
        session.tick()
        session.tick()
        XCTAssertEqual(session.frameVersion, version, "no new frame in Plan without a command")
        XCTAssertTrue(session.walk(1))
        session.tick()
        XCTAssertGreaterThan(session.frameVersion, version)
    }
}

final class DecodeTests: XCTestCase {
    /// C2: props decode and reach the view with y flipped.
    @MainActor
    func testPropsDecodeAndFlip() throws {
        let text = try patchedPlan { obj in
            obj["props"] = [
                ["id": 1, "side": 2, "kind": "cage_bar", "tag": "cage", "x": 1182, "y": 400, "hp": 50, "max": 50, "shot": NSNull()],
                ["id": 2, "side": 2, "kind": "captive", "tag": "captive", "x": 1200, "y": 400, "hp": 110, "max": 110],
                ["id": 3, "side": 1, "kind": "shell", "tag": "", "x": 900, "y": 380, "hp": 30, "max": 30, "shot": "tick_tock_crock"],
            ] as [[String: Any]]
        }
        let raw = try XCTUnwrap(CoreSnapshot.decode(text))
        XCTAssertEqual(raw.props.count, 3)
        XCTAssertEqual(raw.props[2].shot, "tick_tock_crock")
        let frame = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        XCTAssertEqual(frame.props.map(\.kind), ["cage_bar", "captive", "shell"])
        XCTAssertEqual(frame.props[0].y, Double(raw.map.h - 400), accuracy: 0.001)
        XCTAssertEqual(frame.props[1].spoken, "Captive")
    }

    /// M8: the Rival's live aim and preview are never shown.
    @MainActor
    func testRivalAimIsHidden() throws {
        let text = try patchedPlan { obj in
            var hud = obj["hud"] as? [String: Any] ?? [:]
            hud["control"] = ["ai", "human"]
            obj["hud"] = hud
            obj["awaiting"] = "ai"
        }
        let raw = try XCTUnwrap(CoreSnapshot.decode(text))
        XCTAssertFalse(raw.preview.isEmpty)
        let frame = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        XCTAssertTrue(frame.preview.isEmpty)
        XCTAssertFalse(frame.aim.set)
        XCTAssertFalse(frame.humanTurn)
    }

    /// L2, H6: bad chunks are refused; good ones land in the grid and bump their chunk.
    @MainActor
    func testTerrainGridChunks() {
        let grid = TerrainGrid(w: 128, h: 64, chunk: 64)
        XCTAssertEqual(grid.cols, 2)
        XCTAssertFalse(grid.apply(x: 0, y: 0, w: 4, h: -2, base64: ""))
        XCTAssertFalse(grid.apply(x: 0, y: 0, w: 4, h: 4, base64: Data([1, 1]).base64EncodedString()), "too few bytes")
        XCTAssertFalse(grid.hasData)
        var bytes = [UInt8](repeating: 0, count: 64 * 64)
        for y in 32..<64 { for x in 0..<64 { bytes[y * 64 + x] = 3 } }
        // A tunnel: air under rock.
        for y in 40..<44 { for x in 10..<30 { bytes[y * 64 + x] = 0 } }
        XCTAssertTrue(grid.apply(x: 64, y: 0, w: 64, h: 64, base64: Data(bytes).base64EncodedString()))
        XCTAssertTrue(grid.hasData)
        XCTAssertEqual(grid.chunkVersions, [0, 1])
        XCTAssertEqual(grid.surface(70), 32)
        XCTAssertEqual(grid.cell(64 + 20, 41), 0, "the tunnel stays air")
        XCTAssertEqual(grid.cell(64 + 20, 50), 3)
        XCTAssertNil(grid.rgba(chunkIndex: 0), "an all-air chunk has no texture")
        let img = grid.rgba(chunkIndex: 1)
        XCTAssertEqual(img?.data.count, 64 * 64 * 4)
    }

    /// A lean snapshot keeps the forts and HUD, moves shells and applies terrain chunks.
    @MainActor
    func testLeanSnapshotWithTerrainChunk() throws {
        let assembler = FrameAssembler(catalog: ContentCatalog.load())
        let plan = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let first = assembler.assemble(plan, handoffTo: nil, speed: 1)
        let chunk = Data([UInt8](repeating: 2, count: 16)).base64EncodedString()
        let leanText = #"{"tick":9,"phase":"resolve","side":0,"awaiting":"none","full":false,"terrain":{"chunks":[{"cx":0,"cy":0,"x":0,"y":0,"w":4,"h":4,"data":"\#(chunk)"}]},"shells":[[1,500,300,450,"clodpot"]],"events":[]}"#
        let lean = try XCTUnwrap(CoreSnapshot.decode(leanText))
        let version = first.ground?.version ?? 0
        let frame = assembler.assemble(lean, handoffTo: nil, speed: 1)
        XCTAssertTrue(frame.lean)
        XCTAssertEqual(frame.phase, .flight)
        XCTAssertEqual(frame.forts, first.forts)
        XCTAssertEqual(frame.shells.count, 1)
        XCTAssertGreaterThan(frame.ground?.version ?? 0, version)
        XCTAssertEqual(frame.ground?.cell(1, 1), 2)
    }

    func testHeadlineForEveryHow() {
        // Titles come from text.json `results.win.title` and `results.loss.title`.
        XCTAssertEqual(ResultInfo.headline(how: "kettle_pop", won: true), "Kettle Pop!")
        XCTAssertEqual(ResultInfo.headline(how: "rescue", won: true, captive: "Hetty"), "Hetty's out")
        XCTAssertEqual(ResultInfo.headline(how: "squall", won: false), "Blown over")
        XCTAssertEqual(ResultInfo.headline(how: "squall", won: true), "Blown Out")
        XCTAssertNotEqual(ResultInfo.headline(how: "total_hp", won: true), "Clean Sweep")
        XCTAssertEqual(ResultInfo.headline(how: "give_up", won: false), "You gave up")
        XCTAssertEqual(ResultInfo.headline(how: "captive_bonked", won: true, captive: "Hetty"), "They Bonked Hetty")
        XCTAssertEqual(ResultInfo.headline(how: "something_new", won: false), "Flattened")
    }
}

final class SaveSafetyTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("SaveSafety-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    /// M11: a file from a newer app is never written over.
    func testNewerSchemaIsKeptUntouched() throws {
        let store = SaveStore(directory: dir)
        let newer = #"{"schema":99,"counter":7,"firstRunDone":true,"progress":{"pennants":{"1-1":3}}}"#
        try Data(newer.utf8).write(to: store.fileURL)
        let data = store.load()
        XCTAssertTrue(store.isNewerSchema)
        XCTAssertEqual(data.progress.totalPennants, 0)
        try store.writeNow(SaveData())
        XCTAssertEqual(try String(contentsOf: store.fileURL, encoding: .utf8), newer)
    }

    /// M11: damaged Pennants make the file count as damaged, so the backup is read.
    func testDamagedProgressFallsBackToTheBackup() throws {
        let store = SaveStore(directory: dir)
        var good = SaveData()
        good.counter = 1
        good.progress.record(level: "1-1", pennants: 2, buttons: 0)
        try store.writeNow(good)
        try store.writeNow(good)
        let bad = #"{"schema":1,"counter":2,"progress":{"pennants":"oops"}}"#
        try Data(bad.utf8).write(to: store.fileURL)
        XCTAssertEqual(store.load().progress.pennants["1-1"], 2)
    }

    /// M11: when both files are damaged they are kept aside, and stale temp files are cleared.
    func testBothDamagedAreKeptAside() throws {
        let store = SaveStore(directory: dir)
        try Data("{ broken".utf8).write(to: store.fileURL)
        try Data("{ broken too".utf8).write(to: store.backupURL)
        let temp = dir.appendingPathComponent("save.\(UUID().uuidString).tmp")
        try Data("x".utf8).write(to: temp)
        XCTAssertEqual(store.load(), SaveData())
        XCTAssertTrue(FileManager.default.fileExists(atPath: store.damagedURL.path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: temp.path))
    }

    /// H4: the resume flag survives a round trip, so a kill mid replay is seen at launch.
    func testResumeFlagRoundTrips() throws {
        let store = SaveStore(directory: dir)
        var data = SaveData()
        data.resumeInProgress = true
        try store.writeNow(data)
        XCTAssertTrue(store.load().resumeInProgress)
    }
}

/// On the real core (skipped with the stand-in; CI requires these to pass).
final class RealCoreTests: XCTestCase {
    /// C2: level 1-7 has its cage and captive in the frame.
    @MainActor
    func testRescueLevelHasProps() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-7", preset: .fair, seed: 3)))
        let frame = try XCTUnwrap(game.frame())
        XCTAssertTrue(frame.props.contains { $0.kind == "cage_bar" })
        XCTAssertTrue(frame.props.contains { $0.kind == "captive" })
    }

    /// The arm64 static library gives the golden replay hashes.
    func testGoldenHashesMatch() throws {
        guard let lines = CoreFactory.goldenHashes() else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let bundle = Bundle(for: RealCoreTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "expected", withExtension: "txt"), "expected.txt is not in the test bundle")
        let expected = try String(contentsOf: url, encoding: .utf8)
        func table(_ text: String) -> [String: String] {
            var out: [String: String] = [:]
            for line in text.split(separator: "\n") {
                let parts = line.split(separator: " ")
                if parts.count >= 2 { out[String(parts[0])] = String(parts[1]) }
            }
            return out
        }
        let want = table(expected)
        XCTAssertFalse(want.isEmpty)
        XCTAssertEqual(table(lines), want)
    }

    /// Several turns (aim, Walk, Recall, Fire, the Rival between), save, load and compare the state hash.
    @MainActor
    func testMultiTurnReplayMatchesTheHash() async throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        game.thinkMs = 0
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 11)))
        _ = try XCTUnwrap(game.frame())

        func playUntilMyTurn() throws {
            for _ in 0..<2000 {
                game.advance(milliseconds: 100)
                game.waitUntilIdle()
                if let f = game.frame(), f.phase == .plan, f.humanTurn { return }
                if game.frame()?.phase == .ended { return }
            }
            XCTFail("the player's turn never came back")
        }

        XCTAssertTrue(game.send(.aim(angle: 450, power: 62)).ok)
        XCTAssertTrue(game.send(.fire()).ok)
        try playUntilMyTurn()
        _ = game.send(.walk(dx: 8))
        _ = game.recall()
        _ = game.send(.aim(angle: 470, power: 60))
        _ = game.send(.fire())
        try playUntilMyTurn()
        _ = game.send(.aim(angle: 440, power: 65))

        let hash = try XCTUnwrap(game.stateHash())
        let bytes = game.save()
        XCTAssertFalse(bytes.isEmpty)
        let replayed = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        let result = await replayed.load(bytes)
        XCTAssertEqual(result, .ok)
        XCTAssertEqual(replayed.stateHash(), hash)
    }
}

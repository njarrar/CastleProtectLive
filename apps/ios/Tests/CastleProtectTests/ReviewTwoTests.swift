import XCTest
@testable import CastleProtect

// Tests for the findings in docs/review/code/ios-review-2.md. The stand-in core
// now answers `aim` with a lean frame, as the real core does; the real-core
// tests below run only when CastleCore.xcframework is linked (CI requires them).

/// Records which thread each bridge call runs on.
final class ThreadRecordingBridge: CoreBridge {
    let inner = FakeCoreBridge()
    private let lock = NSLock()
    private var seen: [ObjectIdentifier] = []
    private(set) var mainThreadCalls = 0
    var name: String { inner.name }
    var isStandIn: Bool { true }
    var version: String { note(); return inner.version }

    private func note() {
        lock.lock()
        seen.append(ObjectIdentifier(Thread.current))
        if Thread.isMainThread { mainThreadCalls += 1 }
        lock.unlock()
    }

    var threads: Set<ObjectIdentifier> {
        lock.lock()
        defer { lock.unlock() }
        return Set(seen)
    }

    func start(setup: String, seed: UInt64) -> String? { note(); return inner.start(setup: setup, seed: seed) }
    func command(_ json: String) -> String { note(); return inner.command(json) }
    func step(_ ticks: Int) -> String { note(); return inner.step(ticks) }
    func snapshot() -> String { note(); return inner.snapshot() }
    func end() { note(); inner.end() }
}

/// The stand-in core with a slow `resume`, so a test can act while the replay runs.
final class SlowResumeBridge: CoreBridge {
    let inner = FakeCoreBridge()
    var name: String { inner.name }
    var isStandIn: Bool { true }
    var version: String { inner.version }
    func start(setup: String, seed: UInt64) -> String? { inner.start(setup: setup, seed: seed) }
    func command(_ json: String) -> String {
        if json.contains("\"resume\"") { Thread.sleep(forTimeInterval: 0.3) }
        return inner.command(json)
    }
    func step(_ ticks: Int) -> String { inner.step(ticks) }
    func snapshot() -> String { inner.snapshot() }
    func end() { inner.end() }
}

@MainActor
private func duelSetup(seed: UInt64) -> BattleSetup {
    var duel = BattleSetup(mode: .duel, map: "d1", seed: seed)
    duel.names = ["Mabel", "Otis"]
    duel.forts = ["box_1", "box_2"]
    duel.shells = .plain
    duel.seats = .sideBySide
    return duel
}

// MARK: H1 and H2: lean frames reach the HUD

final class LeanHudTests: XCTestCase {
    /// H1 on the stand-in: Fine Tune sends `aim`, the reply frame is lean, the readout still moves.
    @MainActor
    func testFineTuneMovesTheReadoutOnALeanFrame() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        XCTAssertTrue(session.canAct)
        let before = session.hud.aim
        XCTAssertTrue(before.set)
        XCTAssertTrue(session.nudge(angle: 5, power: 1))
        XCTAssertTrue(session.snapshot.lean, "the stand-in answers aim with a lean frame, like the real core")
        XCTAssertEqual(session.hud.aim.angle, before.angle + 5)
        XCTAssertEqual(session.hud.aim.power, before.power + 1)
        XCTAssertTrue(session.hud.canFire)
        XCTAssertTrue(session.nudge(angle: 5, power: 0))
        XCTAssertEqual(session.hud.aim.angle, before.angle + 10, "a second nudge moves it again")
    }

    /// H1 on the real core: lean `aim` snapshots move `hud.aim`.
    @MainActor
    func testLeanAimReachesTheHudOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 19)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        XCTAssertTrue(session.canAct)
        let before = session.hud.aim
        XCTAssertTrue(session.nudge(angle: 10, power: -2))
        XCTAssertTrue(session.snapshot.lean, "the real core answers aim with a lean snapshot")
        XCTAssertEqual(session.hud.aim.angle, before.angle + 10)
        XCTAssertEqual(session.hud.aim.power, before.power - 2)
        XCTAssertEqual(session.hud.aim, session.snapshot.aim)
        XCTAssertFalse(session.snapshot.preview.isEmpty, "the preview comes with the lean frame")
        XCTAssertTrue(session.hud.canFire)
    }

    /// H2: a full frame built under the hand-off card, then a lean frame after READY:
    /// the aim, the preview and Fire come back.
    @MainActor
    func testReadyRebuildsAimPreviewAndFire() throws {
        let assembler = FrameAssembler(catalog: ContentCatalog.load())
        let plan = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let card = assembler.assemble(plan, handoffTo: 0, speed: 1)
        XCTAssertEqual(card.phase, .handoff)
        XCTAssertFalse(card.aim.set)
        XCTAssertTrue(card.preview.isEmpty)
        XCTAssertFalse(card.canFire)
        let lean = try XCTUnwrap(CoreSnapshot.decode(
            #"{"tick":5,"full":false,"phase":"plan","side":0,"awaiting":"human","terrain":{"chunks":[]},"shells":[],"events":[]}"#))
        let after = assembler.assemble(lean, handoffTo: nil, speed: 1)
        XCTAssertEqual(after.phase, .plan)
        XCTAssertTrue(after.aim.set)
        XCTAssertEqual(after.aim.angle, plan.hobs.first { $0.id == plan.hud.selected.hob }?.aim.angle)
        XCTAssertFalse(after.preview.isEmpty)
        XCTAssertTrue(after.canFire)
        XCTAssertEqual(after.forts, card.forts)
        // A lean aim frame right after READY is applied (it was dropped when the old aim was "not set").
        let aimed = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_aim_lean")))
        let moved = assembler.assemble(aimed, handoffTo: nil, speed: 1)
        XCTAssertEqual(moved.aim.angle, aimed.aim?.angle)
    }

    /// H2 on the real core: a Couch Duel's second turn, READY, then aim, preview and Fire.
    @MainActor
    func testCouchDuelAfterReadyOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        let setup = duelSetup(seed: 9)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "Couch Duel")
        session.endDraft()
        XCTAssertTrue(session.canAct, "the first duel turn has no hand-off card")
        session.fire()
        var sawCard = false
        for _ in 0..<3000 {
            game.advance(milliseconds: 50)
            game.waitUntilIdle()
            session.tick()
            if session.hud.handoff != nil { sawCard = true; break }
            if session.snapshot.phase == .ended { break }
        }
        XCTAssertTrue(sawCard, "the second turn opens on the hand-off card")
        XCTAssertFalse(session.hud.canFire)
        session.ready()
        XCTAssertNil(session.hud.handoff)
        XCTAssertEqual(session.snapshot.phase, .plan)
        XCTAssertTrue(session.hud.aim.set, "the readout shows the aim after READY")
        XCTAssertTrue(session.hud.canFire, "Fire is live after READY")
        XCTAssertTrue(session.canAct)
        let before = session.hud.aim
        XCTAssertTrue(session.nudge(angle: -10, power: 1))
        XCTAssertEqual(session.hud.aim.angle, before.angle - 10)
        XCTAssertFalse(session.snapshot.preview.isEmpty, "the preview dots are drawn after READY")
    }

    /// The 2x label flips on a lean frame in flight.
    @MainActor
    func testSpeedLabelFlipsInFlight() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        session.fire()
        XCTAssertEqual(session.hud.speed, 1)
        session.speedUp()
        XCTAssertEqual(session.hud.speed, 2)
    }
}

// MARK: H3: the voice pool

final class VoicePoolTests: XCTestCase {
    private let ms: UInt64 = 1_000_000

    /// 20 one-second sounds 1 ms apart: the first 16 take free voices, then the oldest is stolen,
    /// never the newest, and never the same voice twice in a row.
    func testNoVoiceIsCutWhileOthersAreFreeAndTheOldestIsStolen() {
        var pool = VoicePool(count: 16)
        var picked: [Int] = []
        for i in 0..<20 {
            let now = UInt64(i) * ms
            let v = pool.pick(now: now)
            if i < 16 { XCTAssertTrue(pool.isFree(v, now: now), "sound \(i) found a free voice") }
            pool.start(v, now: now, seconds: 1, bus: "sfx")
            picked.append(v)
        }
        XCTAssertEqual(Set(picked.prefix(16)).count, 16)
        XCTAssertEqual(Array(picked.suffix(4)), Array(picked.prefix(4)), "the oldest voices are stolen first")
        for i in 1..<picked.count { XCTAssertNotEqual(picked[i], picked[i - 1]) }
    }

    /// After every voice was used once and its sound ended, voices read as free again
    /// (`isPlaying` would still say true), so a new sound cuts nothing.
    func testEndedVoicesAreFreeAgain() {
        var pool = VoicePool(count: 16)
        for i in 0..<16 {
            pool.start(pool.pick(now: UInt64(i) * ms), now: UInt64(i) * ms, seconds: 0.2, bus: "sfx")
        }
        let later = 1_000 * ms
        var seen = Set<Int>()
        for k in 0..<16 {
            let now = later + UInt64(k) * ms
            let v = pool.pick(now: now)
            XCTAssertTrue(pool.isFree(v, now: now))
            pool.start(v, now: now, seconds: 0.5, bus: "sfx")
            seen.insert(v)
        }
        XCTAssertEqual(seen.count, 16, "16 sounds in one burst use 16 voices")
    }

    /// The completion handler frees a voice early; a stolen voice's old handler is ignored.
    func testCompletionFreesOnlyItsOwnGeneration() {
        var pool = VoicePool(count: 2)
        let a = pool.pick(now: 0)
        let genA = pool.start(a, now: 0, seconds: 5, bus: "sfx")
        let b = pool.pick(now: 1)
        _ = pool.start(b, now: 1, seconds: 5, bus: "sfx")
        XCTAssertFalse(pool.isFree(a, now: 2))
        pool.finished(a, generation: genA)
        XCTAssertTrue(pool.isFree(a, now: 2))
        XCTAssertEqual(pool.pick(now: 3), a)
        let genA2 = pool.start(a, now: 3, seconds: 5, bus: "sfx")
        pool.finished(a, generation: genA)
        XCTAssertFalse(pool.isFree(a, now: 4), "the old handler of a stolen voice does not free the new sound")
        pool.finished(a, generation: genA2)
        XCTAssertTrue(pool.isFree(a, now: 4))
    }

    /// When every voice sounds, a kettle sound is not stolen while another can be.
    func testKettleVoiceIsKept() {
        var pool = VoicePool(count: 3)
        let k = pool.pick(now: 0)
        pool.start(k, now: 0, seconds: 10, bus: "kettle")
        pool.start(pool.pick(now: 1), now: 1, seconds: 10, bus: "sfx")
        pool.start(pool.pick(now: 2), now: 2, seconds: 10, bus: "sfx")
        XCTAssertNotEqual(pool.pick(now: 3), k)
    }
}

// MARK: M1 and M2: Carry on and the core thread

final class CoreThreadTests: XCTestCase {
    /// M2: every core call, quick or slow, runs on one thread, and never the main thread.
    @MainActor
    func testEveryCoreCallRunsOnOneThread() async throws {
        let bridge = ThreadRecordingBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        game.thinkMs = 0
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 4)))
        _ = try XCTUnwrap(game.frame())
        XCTAssertTrue(game.send(.aim(angle: 460, power: 61)).ok)
        XCTAssertTrue(game.send(.fire()).ok)
        for _ in 0..<40 {
            game.advance(milliseconds: 100)
            game.waitUntilIdle()
            _ = game.frame()
        }
        let bytes = game.save()
        XCTAssertFalse(bytes.isEmpty)
        let result = await game.load(bytes)
        XCTAssertEqual(result, .ok)
        _ = game.frame()
        XCTAssertEqual(bridge.threads.count, 1, "one thread for every call (core/API.md)")
        XCTAssertEqual(bridge.mainThreadCalls, 0)
    }

    /// M2: a refused `ai_turn` is read. After three in a row the fight stops with a notice.
    @MainActor
    func testRefusedRivalTurnRaisesAFault() throws {
        let plan = try patchedPlan { obj in
            obj["awaiting"] = "ai"
            obj["side"] = 1
        }
        let bridge = ScriptedBridge(snapshots: [plan])
        bridge.replies["ai_turn"] = #"{"ok":false,"reason":"wrong_thread"}"#
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        game.thinkMs = 0
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 4)))
        _ = game.frame()
        for _ in 0..<10 where game.fault == nil {
            game.advance(milliseconds: 20)
            game.waitUntilIdle()
            _ = game.frame()
        }
        XCTAssertEqual(game.aiRefusals, CoreGame.maxAiRefusals)
        XCTAssertNotNil(game.fault)
        XCTAssertEqual(bridge.sent.filter { $0 == "ai_turn" }.count, CoreGame.maxAiRefusals)
    }

    /// M1: a battle started while a saved fight replays wins; the stale load touches nothing.
    @MainActor
    func testLoadIsDroppedWhenAnotherBattleStarts() async throws {
        let first = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertNil(first.start(.campaign("1-1", preset: .fair, seed: 7)))
        _ = first.frame()
        XCTAssertTrue(first.send(.aim(angle: 500, power: 66)).ok)
        let bytes = first.save()
        XCTAssertFalse(bytes.isEmpty)

        let game = CoreGame(bridge: SlowResumeBridge(), catalog: ContentCatalog.load())
        let load = Task { await game.load(bytes) }
        for _ in 0..<200 where !game.isBusy { await Task.yield() }
        XCTAssertTrue(game.isBusy, "the replay runs off the main thread")
        XCTAssertNil(game.start(.campaign("1-2", preset: .fair, seed: 8)))
        let result = await load.value
        XCTAssertEqual(result, .superseded)
        XCTAssertTrue(game.isRunning)
        XCTAssertEqual(game.setup?.level, "1-2", "the new battle is kept")
    }
}

// MARK: M3 and M4: pause and loops

final class SoundHoldTests: XCTestCase {
    /// M3: the Pause card holds the sound, Resume and Give up let it go.
    @MainActor
    func testPauseCardHoldsTheSound() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 3)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        let sound = SoundEngine()
        session.onPausedChanged = { sound.setHeld($0) }
        session.pause()
        XCTAssertTrue(sound.held)
        sound.resume()
        XCTAssertTrue(sound.held, "coming back to the app does not bring sound back under the card")
        session.resume()
        XCTAssertFalse(sound.held)
        session.pause()
        XCTAssertTrue(session.giveUp())
        XCTAssertFalse(sound.held)
    }

    /// M4: starting and stopping a loop many times leaves no node behind.
    @MainActor
    func testLoopsLeaveNoNodesBehind() {
        let sound = SoundEngine()
        sound.unlocked = true
        let before = sound.attachedNodeCount
        for _ in 0..<10 {
            sound.setLoop("fly_whistle_loop", gain: 1, pitch: 2)
            sound.setLoop("fly_whistle_loop", gain: 0)
        }
        sound.setLoop("wx_wind_loop", gain: 0.5)
        sound.stopLoops()
        XCTAssertEqual(sound.loopNodeCount, 0)
        // The first loop may build the graph (mixers and the voice pool); later ones add nothing.
        let built = sound.attachedNodeCount
        for _ in 0..<10 {
            sound.setLoop("fly_whistle_loop", gain: 1)
            sound.setLoop("fly_whistle_loop", gain: 0)
        }
        XCTAssertEqual(sound.attachedNodeCount, built)
        XCTAssertGreaterThanOrEqual(built, before)
    }
}

// MARK: M6, M7, M8: collapse, idle draw, kettle pop

final class CollapseOrderTests: XCTestCase {
    @MainActor
    private func planFrame() throws -> BattleSnapshot {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        return FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
    }

    @MainActor
    private func events(_ json: String) throws -> [BattleEvent] {
        let list = try JSONDecoder().decode([CoreEvent].self, from: Data(json.utf8))
        return list.compactMap { FrameAssembler.event($0, mapHeight: 720) }
    }

    /// M6: the crush hit and the Hob's fall wait for the ghost block to land.
    @MainActor
    func testCrushAndHobDropWaitForTheLanding() throws {
        let fx = FieldFX()
        var sounds: [String] = []
        fx.onSound = { id, _, _ in sounds.append(id) }
        let old = try planFrame()
        let fort = try XCTUnwrap(old.fort(1))
        let b = try XCTUnwrap(fort.blocks.first)
        let c = Int(((b.x - fort.originX) / fort.block).rounded())
        let r = Int(((b.y - fort.baseY) / fort.block).rounded())
        let hob = try XCTUnwrap(fort.hobs.first)
        let list = try events(#"""
        [{"t":"collapse","tick":3,"side":1,"blocks":[[\#(c),\#(r),"timber"]],"falls":[[\#(c),32]]},
         {"t":"hit","tick":3,"side":1,"target":"kettle","dmg":20,"why":"crush"},
         {"t":"drop","tick":3,"side":1,"hob":\#(hob.id),"from":[900,300],"to":[900,340],"state":"tumbled","dmg":4}]
        """#)
        fx.ingest(list, old: old, new: old, nowNanos: 1)
        XCTAssertEqual(fx.pieces.count, 1)
        XCTAssertFalse(sounds.contains("ket_hit"), "the crush does not land before the block")
        XCTAssertTrue(fx.collapseShowing)
        let start = fx.hobOffset(side: 1, hob: hob.id)
        XCTAssertEqual(start.dy, 40, "the Hob is drawn where it stood, 40 cells up")
        let land = fx.landTime(fx.pieces[0])
        var t: UInt64 = 1
        while fx.now < land - 30 {
            t += 10_000_000
            _ = fx.advance(realMs: 10, nowNanos: t)
            fx.runTimers()
        }
        XCTAssertFalse(sounds.contains("ket_hit"))
        XCTAssertNotEqual(fx.hobOffset(side: 1, hob: hob.id).dy, 0, "still falling just before the landing")
        for _ in 0..<200 {
            t += 10_000_000
            _ = fx.advance(realMs: 10, nowNanos: t)
            fx.runTimers()
        }
        XCTAssertTrue(sounds.contains("ket_hit"), "the crush plays when the block lands")
        XCTAssertEqual(fx.hobOffset(side: 1, hob: hob.id).dy, 0)
        XCTAssertFalse(fx.collapseShowing)
    }

    /// M7: a Bonked Hob does not keep the field drawing every frame once its balloon lift is done.
    @MainActor
    func testBonkedHobLetsThePlanStepGoIdle() throws {
        let fx = FieldFX()
        let snap = try planFrame()
        let hob = try XCTUnwrap(snap.fort(1)?.hobs.first)
        fx.noteHob(side: 1, id: hob.id, def: hob.def)
        let list = try events(#"[{"t":"bonk","tick":3,"side":1,"hob":\#(hob.id)}]"#)
        fx.ingest(list, old: snap, new: snap, nowNanos: 1)
        XCTAssertTrue(fx.isActive)
        var t: UInt64 = 1
        for _ in 0..<120 {
            t += 50_000_000
            _ = fx.advance(realMs: 50, nowNanos: t)
            fx.runTimers()
        }
        XCTAssertFalse(fx.isActive, "the looping Bonked pose steps with the idle poses")
    }

    /// M8: the pop show reports itself until it ends, the sting waits for the pop frame,
    /// and a relit kettle (Volley Points) drops the popped art.
    @MainActor
    func testKettlePopShowAndRelight() throws {
        let fx = FieldFX()
        var popFrames = 0
        fx.onPopFrame = { popFrames += 1 }
        let snap = try planFrame()
        let list = try events(#"[{"t":"kettle_pop","tick":3,"side":1}]"#)
        fx.ingest(list, old: snap, new: snap, nowNanos: 1)
        XCTAssertTrue(fx.isPopShowing)
        let hasClip = fx.library.clip("kettle_pop") != nil
        XCTAssertEqual(fx.popFramePending, hasClip)
        var t: UInt64 = 1
        for _ in 0..<26 {
            t += 50_000_000
            _ = fx.advance(realMs: 50, nowNanos: t)
        }
        XCTAssertTrue(fx.isPopShowing, "1.3 s in, the slow motion is still running")
        if hasClip { XCTAssertEqual(popFrames, 1, "the sting starts on the pop frame") }
        let relight = try events(#"[{"t":"relight","tick":9,"side":1,"hp":150}]"#)
        fx.ingest(relight, old: snap, new: snap, nowNanos: t)
        XCTAssertNil(fx.kettlePops[1], "a relit kettle is drawn lit")
    }
}

// MARK: Owner rule (design 00, 2.3): an Aim Drag starts only on the player's own fort

final class OwnFortAimTests: XCTestCase {
    @MainActor
    private func makeSession() throws -> (BattleSession, RecordingBridge) {
        let bridge = RecordingBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        let setup = BattleSetup.campaign("1-1", preset: .fair, seed: 5)
        XCTAssertNil(game.start(setup))
        let session = BattleSession(game: game, setup: setup, title: "1-1")
        session.updateViewport(size: CGSize(width: 2000, height: 1000), insets: Insets())
        // One lens, 1 point a cell, view y down from 1000: world (x, 1000 - y).
        let map = LensMap(viewport: CGRect(x: 0, y: 0, width: 2000, height: 1000), frameCentre: .zero,
                          worldRect: .zero, scale: 1, sceneHeight: 1000)
        session.lensMap = { _ in map }
        XCTAssertTrue(session.canAct)
        return (session, bridge)
    }

    @MainActor
    private func drag(_ session: BattleSession, from a: CGPoint, by d: CGVector) {
        session.touchBegan(at: a)
        session.touchMoved(to: CGPoint(x: a.x + d.dx / 2, y: a.y + d.dy / 2))
        session.touchMoved(to: CGPoint(x: a.x + d.dx, y: a.y + d.dy))
        session.touchEnded(at: CGPoint(x: a.x + d.dx, y: a.y + d.dy))
    }

    /// A drag that starts in open sky leaves the aim as it was and sends no aim.
    @MainActor
    func testDragFromOpenSkyLeavesTheAim() throws {
        let (session, bridge) = try makeSession()
        let fort = try XCTUnwrap(session.snapshot.fort(0))
        let before = session.hud.aim
        let sky = CGPoint(x: fort.originX + Double(fort.cols) * fort.block + 300, y: 20)
        XCTAssertFalse(session.aimMayStart(at: sky))
        drag(session, from: sky, by: CGVector(dx: -150, dy: 120))
        XCTAssertEqual(session.hud.aim, before)
        XCTAssertEqual(bridge.count("aim"), 0)
        XCTAssertFalse(session.dragging)
    }

    /// The same drag started on the own fort aims.
    @MainActor
    func testDragFromTheOwnFortAims() throws {
        let (session, bridge) = try makeSession()
        let fort = try XCTUnwrap(session.snapshot.fort(0))
        let b = try XCTUnwrap(fort.blocks.first)
        let onFort = CGPoint(x: b.x + b.w / 2, y: 1000 - (b.y + b.h / 2))
        XCTAssertTrue(session.aimMayStart(at: onFort))
        // Two blocks out from the fort's edge still counts.
        XCTAssertTrue(session.aimMayStart(at: CGPoint(x: fort.originX - 30, y: onFort.y)))
        drag(session, from: onFort, by: CGVector(dx: -150, dy: 120))
        XCTAssertGreaterThan(bridge.count("aim"), 0)
    }
}

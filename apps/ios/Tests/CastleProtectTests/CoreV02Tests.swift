import XCTest
@testable import CastleProtect

// Core v0.2 alignment (core/API.md, docs/review/code/core-review-1.md, API changes 1 to 20),
// the animation and audio manifests, and the field effects.

final class CoreV02DecodeTests: XCTestCase {
    func testBossFixtureHasTheNewHudFields() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_boss_1_10")))
        XCTAssertEqual(raw.map.chunk, 64)
        XCTAssertEqual(raw.hud.boss?.phase, 1)
        XCTAssertNil(raw.hud.boss?.cut)
        XCTAssertEqual(raw.hud.steamMax, [100, 120])
        XCTAssertEqual(raw.hud.shoveOffCost, 15)
        XCTAssertEqual(raw.hud.handicap.count, 2)
        XCTAssertFalse(raw.hud.shots.isEmpty)
        XCTAssertTrue(raw.hud.shots.contains { $0.shot == "plain" && $0.ready })
        let frame = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        XCTAssertEqual(frame.boss?.phase, 1)
        XCTAssertEqual(frame.shoveOffCost, 15)
        XCTAssertEqual(frame.steamMax, 100)
        XCTAssertEqual(HudState(frame).bossPhase, 1)
        XCTAssertTrue(raw.castles.contains { $0.blocks.contains { $0.root } }, "the Sprinkler Root block")
    }

    func testEndedFixtureHasTheFullResult() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_ended")))
        let r = try XCTUnwrap(raw.result)
        XCTAssertEqual(r.how, "give_up")
        XCTAssertEqual(r.score.count, 2)
        XCTAssertEqual(r.stats.count, 2)
        XCTAssertEqual(r.broke?.side, 1)
        XCTAssertEqual(r.broke?.last?.shotName, "Clodpot")
        XCTAssertEqual(r.broke?.top.first?.dmg, 29)
        let frame = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        XCTAssertEqual(frame.result?.reason, "give_up")
        XCTAssertEqual(frame.result?.broke?.side, 1)
        XCTAssertEqual(frame.result?.stats.first?.shots, 1)
        XCTAssertEqual(frame.helpMarks, ["+", ""], "Help is shown openly")
        XCTAssertEqual(ResultInfo.headline(how: "give_up", won: true), "They gave up")
        XCTAssertEqual(ResultInfo.headline(how: "volley_points", won: true), "Won on Volley Points!")
    }

    /// API change 7: an `aim` gives a lean snapshot with the aim and preview; the HUD keeps everything else.
    func testLeanAimUpdatesAimAndPreview() throws {
        let assembler = FrameAssembler(catalog: ContentCatalog.load())
        let plan = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let first = assembler.assemble(plan, handoffTo: nil, speed: 1)
        let lean = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_aim_lean")))
        XCTAssertFalse(lean.full)
        let aim = try XCTUnwrap(lean.aim)
        let frame = assembler.assemble(lean, handoffTo: nil, speed: 1)
        XCTAssertEqual(frame.phase, .plan)
        XCTAssertTrue(frame.canFire, "a lean aim frame keeps Fire live")
        XCTAssertEqual(frame.aim.angle, aim.angle)
        XCTAssertEqual(frame.aim.power, aim.power)
        XCTAssertEqual(frame.preview.count, lean.preview.count * 2)
        XCTAssertEqual(frame.forts, first.forts)
    }

    func testCollapseEventCellsDecode() throws {
        let text = #"{"t":"collapse","tick":3,"side":1,"blocks":[[0,1,"timber"],[1,2,"cobble"]],"falls":[[0,16],[1,32]]}"#
        let e = try JSONDecoder().decode(CoreEvent.self, from: Data(text.utf8))
        XCTAssertEqual(e.blocks?.count, 2)
        XCTAssertEqual(e.blocks?[1].mat, "cobble")
        XCTAssertEqual(e.falls?[1], [1, 32])
        let big = try JSONDecoder().decode(CoreEvent.self, from: Data(#"{"t":"big_drop","tick":3,"blocks":5,"callout":true}"#.utf8))
        XCTAssertNil(big.blocks)
        XCTAssertEqual(big.blockCount, 5)
        let walk = try JSONDecoder().decode(CoreEvent.self, from: Data(#"{"t":"walk","tick":3,"side":0,"from":[300,390],"to":[340,390],"steam":10}"#.utf8))
        XCTAssertEqual(walk.from, [300, 390])
        let lid = try JSONDecoder().decode(CoreEvent.self, from: Data(#"{"t":"lid","tick":3,"side":0,"room":"kettle"}"#.utf8))
        XCTAssertEqual(lid.room, "kettle")
    }

    func testSetupCarriesHelpVolleyAndProgress() throws {
        var duel = BattleSetup(mode: .duel, map: "d1", seed: 9)
        duel.help = [.some, .lots]
        duel.winBy = .volley
        duel.rounds = 10
        let obj = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(duel.coreSetup().jsonString().utf8)) as? [String: Any])
        XCTAssertEqual(obj["volley"] as? Int, 10)
        XCTAssertNil(obj["round_cap"], "Volley Points has no round cap")
        let sides = try XCTUnwrap(obj["sides"] as? [[String: Any]])
        XCTAssertEqual(sides[0]["help"] as? String, "some")
        XCTAssertEqual(sides[0]["preview_pct"] as? Int, 60)
        XCTAssertEqual(sides[1]["help"] as? String, "lots")
        XCTAssertEqual(sides[1]["preview_pct"] as? Int, 100)

        var progress = CampaignProgress()
        progress.record(level: "1-2", flags: [true, false, true], won: true, buttons: 250)
        XCTAssertEqual(progress.pennants["1-2"], 2)
        XCTAssertEqual(progress.buttons, 250)
        progress.record(level: "1-2", flags: [false, true, false], won: true, buttons: 90)
        XCTAssertEqual(progress.flags["1-2"], [true, true, true])
        var camp = BattleSetup.campaign("1-2", preset: .fair, seed: 1)
        camp.progress = progress.coreProgress(level: "1-2")
        let c = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(camp.coreSetup().jsonString().utf8)) as? [String: Any])
        let p = try XCTUnwrap(c["progress"] as? [String: Any])
        XCTAssertEqual(p["cleared"] as? Bool, true)
        XCTAssertEqual(p["pennants"] as? [Bool], [true, true, true])
        XCTAssertNotNil(p["daily_paid"])
    }
}

final class CoreV02GameTests: XCTestCase {
    /// API change 2: a panic marks the handle dead; the app rebuilds with cp_new and resume.
    @MainActor
    func testDeadHandleIsRebuiltFromTheLog() throws {
        let bridge = FakeCoreBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 3)))
        _ = try XCTUnwrap(game.frame())
        bridge.panicNext = true
        let reply = game.send(.aim(angle: 500, power: 70))
        XCTAssertEqual(reply.reason, "recovered")
        XCTAssertEqual(game.recoveries, 1)
        XCTAssertTrue(game.recoveredNotice)
        XCTAssertNil(game.fault)
        let back = try XCTUnwrap(game.frame())
        XCTAssertEqual(back.phase, .plan)
        XCTAssertTrue(game.send(.aim(angle: 500, power: 70)).ok, "the rebuilt battle takes commands")

        bridge.panicNext = true
        XCTAssertEqual(game.send(.pass).reason, "recovered")
        bridge.panicNext = true
        XCTAssertFalse(game.send(.pass).ok)
        XCTAssertNotNil(game.fault, "after the restarts run out the fight stops with a fault")
    }

    @MainActor
    func testGiveUpEndsTheFight() throws {
        let game = CoreGame(bridge: FakeCoreBridge(), catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 3)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 3), title: "1-1")
        var recorded: BattleResult?
        session.onResult = { _, r in recorded = r }
        session.pause()
        XCTAssertTrue(session.giveUp())
        XCTAssertFalse(session.paused)
        XCTAssertEqual(recorded?.reason, "give_up")
        XCTAssertEqual(recorded?.winner, 1)
        session.stop()
    }

    /// Recovery also works when the dead handle shows up in a snapshot (a panic inside ai_turn).
    @MainActor
    func testDeadSnapshotIsRebuilt() throws {
        let bridge = FakeCoreBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 3)))
        _ = try XCTUnwrap(game.frame())
        bridge.panicNext = true
        _ = bridge.command(#"{"cmd":"hash"}"#)
        let frame = try XCTUnwrap(game.frame())
        XCTAssertEqual(frame.phase, .plan)
        XCTAssertEqual(game.recoveries, 1)
    }
}

final class AnimationTests: XCTestCase {
    func testClipTimingLoopsAndEvents() throws {
        let json = #"{"animations":{"a":{"frames":["f0","f1","f2"],"ms":[100,100,100],"loop":true,"loop_from":1,"w":10,"h":20,"anchor":[5,20],"events":{"go":1}},"b":{"frames":["g0","g1"],"ms":[50,50],"loop":false,"hold":"g_hold","w":4,"h":4,"anchor":[2,2],"events":{}}},"data":{"fort_bob":{"frame_ms":110,"dy":[1,-1,0,1,-1,0],"tilt":[0,0,0,0,0,0]}}}"#
        let lib = AnimationLibrary(data: Data(json.utf8))
        let a = try XCTUnwrap(lib.clip("a"))
        XCTAssertEqual(a.index(at: 50), 0)
        XCTAssertEqual(a.index(at: 150), 1)
        XCTAssertEqual(a.index(at: 350), 1, "the loop runs from loop_from")
        XCTAssertEqual(a.index(at: 450), 2)
        XCTAssertEqual(a.eventsFired(from: -1, to: 120), ["go"])
        XCTAssertEqual(a.eventsFired(from: 120, to: 280), [])
        XCTAssertEqual(a.eventsFired(from: 280, to: 320), ["go"], "loops fire their events again")
        XCTAssertEqual(a.frameStarts(from: 0, to: 700).count, 7, "a long step never skips a frame")
        let b = try XCTUnwrap(lib.clip("b"))
        XCTAssertEqual(b.frame(at: 60), "g1")
        XCTAssertEqual(b.frame(at: 500), "g_hold")
        XCTAssertTrue(b.finished(at: 100))
        XCTAssertEqual(b.frame(at: 10, reversed: true), "g1")
        XCTAssertEqual(lib.motion.bobDy.count, 6)
    }

    func testShippedAnimationsLoad() throws {
        let lib = AnimationLibrary.shared
        XCTAssertGreaterThanOrEqual(lib.clips.count, 200, "assets/animations.json is in the bundle")
        let fire = try XCTUnwrap(lib.clip("hob_marge_blue_fire"))
        XCTAssertEqual(fire.events["release"], 1)
        XCTAssertEqual(fire.frames.first, "hob_marge_blue_fire_2", "play order, not the number in the name")
        let aim = try XCTUnwrap(lib.clip("hob_marge_blue_aim"))
        XCTAssertEqual(aim.pickFrame(value: 0), aim.frames[0])
        XCTAssertEqual(aim.pickFrame(value: 100), aim.frames[2])
        XCTAssertNotNil(lib.clip("kettle_pop")?.events["pop"])
        XCTAssertNotNil(lib.clip("stomper_blue_walk"))
        XCTAssertGreaterThan(lib.motion.creakMs, 0)
        XCTAssertNotNil(lib.motion.wobble["wicker"])
    }

    func testShippedAudioLoads() {
        let m = SoundManifest.shared
        XCTAssertEqual(m.sounds.count, 140, "assets/audio/audio.json is in the bundle")
        XCTAssertEqual(m.shotLaunch["clodpot"], "launch_lob")
        XCTAssertEqual(m.materialSounds["cobble"]?.hit, "mat_cobble_hit")
        XCTAssertEqual(m.sounds["mus_r1_stir"]?.layer, "stir")
        XCTAssertGreaterThan(m.sounds["mus_r1_base"]?.barSeconds ?? 0, 1)
        XCTAssertEqual(m.duckDb["impact"], -6)
        XCTAssertFalse(m.subtitles.isEmpty, "bark subtitles from barks.json")
        XCTAssertNotNil(Bundle.main.url(forResource: "ui_tap", withExtension: "m4a", subdirectory: "audio/sfx"),
                        "the .m4a files are copied (not the .ogg)")
        XCTAssertNil(Bundle.main.url(forResource: "ui_tap", withExtension: "ogg", subdirectory: "audio/sfx"))
    }
}

final class FieldFXTests: XCTestCase {
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

    @MainActor
    func testCollapseCreaksDropsAndBreaks() throws {
        let fx = FieldFX()
        var sounds: [String] = []
        fx.onSound = { id, _, _ in sounds.append(id) }
        let old = try planFrame()
        let fort = try XCTUnwrap(old.fort(1))
        let b = try XCTUnwrap(fort.blocks.first)
        let c = Int(((b.x - fort.originX) / fort.block).rounded())
        let r = Int(((b.y - fort.baseY) / fort.block).rounded())
        let list = try events(#"[{"t":"collapse","tick":3,"side":1,"blocks":[[\#(c),\#(r),"timber"]],"falls":[[\#(c),32]]}]"#)
        fx.ingest(list, old: old, new: old, nowNanos: 1)
        XCTAssertEqual(fx.pieces.count, 1)
        XCTAssertEqual(sounds.first, "col_creak")
        let start = fx.pieceTransform(fx.pieces[0])
        XCTAssertEqual(start.dy, 0)
        var t: UInt64 = 1
        for _ in 0..<40 {
            t += 50_000_000
            _ = fx.advance(realMs: 50, nowNanos: t)
            fx.runTimers()
        }
        XCTAssertTrue(fx.pieces.isEmpty, "the piece landed and broke")
        XCTAssertTrue(fx.sprites.contains { $0.clip.hasPrefix("fx_rubble_") }, "rubble stays for 1.5 s")
        XCTAssertTrue(sounds.contains("col_chunk_land"))
    }

    @MainActor
    func testBigBlastHitStopsAndShakesButNeverWhileAiming() throws {
        let fx = FieldFX()
        let snap = try planFrame()
        let list = try events(#"[{"t":"explode","tick":3,"x":900,"y":300,"r":50,"dmg":80,"type":"blast"}]"#)
        let now: UInt64 = 10_000_000_000
        fx.ingest(list, old: snap, new: snap, nowNanos: now)
        XCTAssertEqual(fx.timeScale(nowNanos: now + 1_000_000), 0, "a huge blast stops the view for a moment")
        XCTAssertEqual(fx.timeScale(nowNanos: now + 200_000_000), 1)
        XCTAssertNotEqual(fx.shakeOffset(planning: false), .zero)
        XCTAssertEqual(fx.shakeOffset(planning: true), .zero, "no shake while aiming")
        XCTAssertTrue(fx.sprites.contains { $0.clip.hasPrefix("fx_impact_") || $0.clip == "fx_splash" })
        fx.shakeAmount = 0
        fx.reset()
        fx.ingest(list, old: snap, new: snap, nowNanos: now + 1_000_000_000)
        XCTAssertEqual(fx.shakeOffset(planning: false), .zero, "Reduce shake 0%")
    }

    @MainActor
    func testReduceMotionCapsHitStopAndSkipsSlowMotion() throws {
        let fx = FieldFX()
        fx.reduceMotion = true
        let snap = try planFrame()
        let list = try events(#"[{"t":"threaded","tick":3,"side":1,"nook":0,"hob":1}]"#)
        let now: UInt64 = 5_000_000_000
        fx.ingest(list, old: snap, new: snap, nowNanos: now)
        XCTAssertEqual(fx.timeScale(nowNanos: now + 100_000_000), 0, "a short hold instead of slow motion")
        XCTAssertEqual(fx.timeScale(nowNanos: now + 200_000_000), 1, "never a long slow motion")
    }

    @MainActor
    func testWalkAndKettlePopAnimate() throws {
        let fx = FieldFX()
        var sounds: [String] = []
        fx.onSound = { id, _, _ in sounds.append(id) }
        let snap = try planFrame()
        let list = try events(#"[{"t":"walk","tick":3,"side":0,"from":[300,390],"to":[340,390],"steam":10},{"t":"kettle_pop","tick":3,"side":1}]"#)
        fx.ingest(list, old: snap, new: snap, nowNanos: 1)
        XCTAssertEqual(fx.walks[0]?.dx, 40)
        XCTAssertNotNil(fx.kettlePops[1])
        var t: UInt64 = 1
        for _ in 0..<30 {
            t += 50_000_000
            _ = fx.advance(realMs: 50, nowNanos: t)
        }
        XCTAssertNil(fx.walks[0], "the walk ended")
        XCTAssertTrue(sounds.contains("cas_step"))
        XCTAssertTrue(sounds.contains("ket_pop"))
    }

    @MainActor
    func testCameraRigEasesHoldsAndCuts() {
        let rig = CameraRig()
        let a = CGRect(x: 0, y: 0, width: 100, height: 50)
        let b = CGRect(x: 400, y: 0, width: 100, height: 50)
        XCTAssertEqual(rig.update(target: a, dt: 16, cut: false, hold: false, follow: nil), a)
        let mid = rig.update(target: b, dt: 16, cut: false, hold: false, follow: nil)
        XCTAssertGreaterThan(mid.minX, 0)
        XCTAssertLessThan(mid.minX, 400, "eases, does not jump")
        XCTAssertEqual(rig.update(target: a, dt: 16, cut: false, hold: true, follow: nil), mid, "holds during an Aim Drag")
        XCTAssertEqual(rig.update(target: b, dt: 16, cut: true, hold: false, follow: nil), b, "Reduce motion cuts")
    }
}

/// On the real core (skipped with the stand-in; CI requires these to pass).
final class RealCoreV02Tests: XCTestCase {
    @MainActor
    func testGiveUpOnTheRealCore() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        XCTAssertEqual(game.rulesVersion, 4)
        var setup = BattleSetup.campaign("1-1", preset: .fair, seed: 21)
        setup.progress = CoreProgress()
        XCTAssertNil(game.start(setup))
        _ = try XCTUnwrap(game.frame())
        XCTAssertTrue(game.giveUp().ok)
        let end = try XCTUnwrap(game.frame())
        XCTAssertEqual(end.phase, .ended)
        let result = try XCTUnwrap(end.result)
        XCTAssertEqual(result.reason, "give_up")
        XCTAssertEqual(result.winner, 1)
        XCTAssertGreaterThan(result.buttons, 0, "a campaign loss pays its Buttons")
        XCTAssertEqual(result.broke?.side, 0)
    }

    @MainActor
    func testHelpVolleyAndBossSetupsStart() throws {
        guard CoreFactory.realCoreLinked else { throw XCTSkip("CastleCore.xcframework is not linked in this build") }
        let game = CoreGame(bridge: CoreFactory.make(preferStandIn: false), catalog: ContentCatalog.load())
        var duel = BattleSetup(mode: .duel, map: "d1", seed: 5)
        duel.names = ["Mabel", "Otis"]
        duel.forts = ["box_1", "box_2"]
        duel.help = [.some, .none]
        duel.winBy = .volley
        duel.rounds = 10
        duel.shells = .plain
        XCTAssertNil(game.start(duel))
        let frame = try XCTUnwrap(game.frame())
        XCTAssertEqual(frame.volleyActions, 10)
        XCTAssertEqual(frame.helpMarks.first, "+")
        XCTAssertEqual(frame.world.w > 0, true)
        XCTAssertNil(game.start(.campaign("1-10", preset: .fair, seed: 8)))
        let boss = try XCTUnwrap(game.frame())
        XCTAssertEqual(boss.boss?.phase, 1)
        // A wrong number is refused with bad_value, never clamped in silence.
        let refused = CoreReply.decode(game.host.sync { $0.command(#"{"cmd":"aim","angle":12.5}"#) })
        XCTAssertFalse(refused.ok)
    }
}

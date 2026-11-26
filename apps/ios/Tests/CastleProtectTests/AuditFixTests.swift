import XCTest
@testable import CastleProtect

/// Regression tests covering the iOS client audit fixes (C1..C2, H1..H10, M1..M14, L1..L7).
final class AuditFixTests: XCTestCase {
    // MARK: C2: SaveStore serialized writeNow

    func testSaveStoreWriteNowSerializesWithAsyncWrite() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("AuditSaveStore-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = SaveStore(directory: dir)
        for i in 1...8 {
            var d = SaveData()
            d.counter = i
            store.write(d)
        }
        var finalData = SaveData()
        finalData.counter = 99
        finalData.firstRunDone = true
        try store.writeNow(finalData)
        let loaded = store.load()
        XCTAssertEqual(loaded.counter, 99)
        XCTAssertTrue(loaded.firstRunDone)
    }

    // MARK: H1: CoreGame.recover failure ends handle and guards frame()

    @MainActor
    func testCoreGameRecoveryExhaustionEndsHandleAndStopsFrames() throws {
        let bridge = FakeCoreBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 3)))
        XCTAssertNotNil(game.frame())
        bridge.panicNext = true
        XCTAssertEqual(game.send(.pass).reason, "recovered")
        bridge.panicNext = true
        XCTAssertEqual(game.send(.pass).reason, "recovered")
        bridge.panicNext = true
        let failed = game.send(.pass)
        XCTAssertFalse(failed.ok)
        XCTAssertNotNil(game.fault)
        XCTAssertFalse(game.isRunning, "exhausted recovery ends the handle immediately")
        XCTAssertNil(game.frame(), "faulted game never returns a frame")
        XCTAssertNil(game.frameIfNeeded())
    }

    // MARK: H3 & M9: Content catalog dud, match_class, wind_presets, starter_box

    @MainActor
    func testCatalogAndFrameAssemblerDecodeDudMatchAllAndConfig() throws {
        let catalog = ContentCatalog.load()
        XCTAssertEqual(WindSetting.full.coreWind.min, 0)
        XCTAssertEqual(WindSetting.full.coreWind.max, 6)
        XCTAssertEqual(catalog.kitName("box_1"), "Oak")
        XCTAssertEqual(catalog.kitName("box_2"), "Stone Skirt")
        XCTAssertEqual(catalog.kitName("box_3"), "Reed Roof")
        XCTAssertTrue(catalog.shots["barn_raising"]?.dials.contains("puff_up") ?? false)
        XCTAssertTrue(catalog.shots["mendglob"]?.hasSelfTarget ?? false)

        var obj = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: Data(try fixtureText("snapshot_plan").utf8)) as? [String: Any]
        )
        var hud = obj["hud"] as? [String: Any] ?? [:]
        hud["hands"] = [
            [
                ["id": "mendglob", "name": "Mendglob", "uses": 1, "weight": "M", "match": "all", "dud": false],
                ["id": "dud_clod", "name": "Dud Clod", "uses": 1, "weight": "L", "match": "all", "dud": true],
            ],
            [],
        ]
        obj["hud"] = hud
        let json = String(decoding: try JSONSerialization.data(withJSONObject: obj), as: UTF8.self)
        let raw = try XCTUnwrap(CoreSnapshot.decode(json))
        let frame = FrameAssembler(catalog: catalog).assemble(raw, handoffTo: nil, speed: 1)
        let mend = try XCTUnwrap(frame.shots.first { $0.id == "mendglob" })
        XCTAssertTrue(mend.best, "match_class 'all' matches every Hob")
        XCTAssertEqual(mend.matchClass, "all")
        let dud = try XCTUnwrap(frame.shots.first { $0.id == "dud_clod" })
        XCTAssertFalse(dud.best, "a dud never shows a match bonus")
    }

    // MARK: H4: Daily progress, dailySeed, Workshop fortRows, dial/room/targets

    @MainActor
    func testDailyProgressFortRowsAndActionParams() throws {
        let seedA = CoreFactory.dailySeed(date: "2026-04-20")
        let seedB = CoreFactory.dailySeed(date: "2026-04-20")
        let seedC = CoreFactory.dailySeed(date: "2026-04-21")
        XCTAssertEqual(seedA, seedB)
        XCTAssertNotEqual(seedA, seedC)

        var daily = BattleSetup(mode: .daily, map: "d1", preset: .fair, seed: seedA)
        daily.progress = CoreProgress(cleared: false, pennants: [false, false, false], dailyPaid: true)
        daily.fortRows = WorkshopGrid.homeRows
        let dailyCore = daily.coreSetup()
        XCTAssertEqual(dailyCore.progress?.dailyPaid, true)
        XCTAssertEqual(dailyCore.sides?.first?.rows, WorkshopGrid.homeRows)

        var duel = BattleSetup(mode: .duel, map: "d1", seed: 7)
        duel.forts = ["workshop", "box_2"]
        duel.fortRows = WorkshopGrid.homeRows
        let duelCore = duel.coreSetup()
        XCTAssertEqual(duelCore.sides?[0].rows, WorkshopGrid.homeRows)
        XCTAssertEqual(duelCore.sides?[0].kit, "kit_oak")
        XCTAssertNil(duelCore.sides?[1].rows)
        XCTAssertEqual(duelCore.sides?[1].kit, "kit_stone")

        let bridge = AuditRecordingBridge()
        let game = CoreGame(bridge: bridge, catalog: ContentCatalog.load())
        XCTAssertNil(game.start(.campaign("1-1", preset: .fair, seed: 5)))
        let session = BattleSession(game: game, setup: .campaign("1-1", preset: .fair, seed: 5), title: "1-1")
        XCTAssertTrue(session.useDoodad("pot_lid", room: "nook:0"))
        XCTAssertTrue(bridge.commands.contains { $0.contains(#""doodad":"pot_lid""#) && $0.contains(#""room":"nook:0""#) })
        XCTAssertTrue(session.useDoodad("mend_bucket", targets: [[1, 0], [2, 0]]))
        XCTAssertTrue(bridge.commands.contains { $0.contains(#""doodad":"mend_bucket""#) && $0.contains(#""targets":[[1,0],[2,0]]"#) })
    }

    // MARK: H5, H6, M13: BattleLayout usePadScale, Tall stripH, Reduce Motion split flight

    func testBattleLayoutPadScaleTallStripAndReduceMotionFlight() {
        let narrow = BattleLayout.compute(size: CGSize(width: 390, height: 844),
                                          insets: Insets(top: 47, left: 0, bottom: 34, right: 0),
                                          mode: .tall, inFlight: false, isPad: false)
        XCTAssertFalse(narrow.usePadScale)
        XCTAssertGreaterThanOrEqual(narrow.topStrip.height, 68)

        let pad = BattleLayout.compute(size: CGSize(width: 1180, height: 820), insets: Insets(),
                                       mode: .wide, inFlight: false, isPad: true)
        XCTAssertTrue(pad.usePadScale)

        let rmFlight = BattleLayout.compute(size: CGSize(width: 390, height: 844),
                                            insets: Insets(top: 47, left: 0, bottom: 34, right: 0),
                                            mode: .tall, inFlight: true, isPad: false, reduceMotion: true)
        XCTAssertEqual(rmFlight.lenses.map(\.focus), [.target, .whole, .own],
                       "Reduce Motion keeps Tall lenses split during flight")
        XCTAssertEqual(rmFlight.aimRegion, .zero)
    }

    // MARK: H8: SoundEngine preserves loopWanted across mute/unmute

    @MainActor
    func testSoundEnginePreservesWantedLoopsWhileMuted() {
        let sound = SoundEngine()
        sound.unlocked = true
        sound.muted = true
        sound.setLoop("wx_wind_loop", gain: 0.6)
        XCTAssertEqual(sound.loopNodeCount, 0)
        XCTAssertEqual(sound.wantedLoopCount, 1, "loop intent survives mute")
        sound.setLoop("wx_wind_loop", gain: 0)
        XCTAssertEqual(sound.wantedLoopCount, 0)
    }

    // MARK: H10 & M14: FieldFX heldBlocks crush-only, deferred bonk, WalkAnim accumulation

    @MainActor
    func testFieldFXHoldsOnlyCrushedBlocksDefersCrushBonkAndAccumulatesWalk() throws {
        let raw = try XCTUnwrap(CoreSnapshot.decode(try fixtureText("snapshot_plan")))
        let old = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        let fort = try XCTUnwrap(old.fort(1))
        XCTAssertGreaterThanOrEqual(fort.blocks.count, 3)
        let collapsedBlock = fort.blocks[0]
        let blastedBlock = fort.blocks[1]
        let crushedBlock = fort.blocks[2]
        func cell(_ b: BlockView) -> (Int, Int) {
            (Int(((b.x - fort.originX) / fort.block).rounded()), Int(((b.y - fort.baseY) / fort.block).rounded()))
        }
        let colCell = cell(collapsedBlock)
        let blastCell = cell(blastedBlock)
        let crushCell = cell(crushedBlock)
        let hob = try XCTUnwrap(fort.hobs.first)

        var newSnap = old
        if let fi = newSnap.forts.firstIndex(where: { $0.side == 1 }) {
            func near(_ a: BlockView, _ b: BlockView) -> Bool {
                let dx: Double = abs(a.x - b.x)
                let dy: Double = abs(a.y - b.y)
                return dx < 1.0 && dy < 1.0
            }
            newSnap.forts[fi].blocks.removeAll { (b: BlockView) -> Bool in
                near(b, collapsedBlock) || near(b, blastedBlock) || near(b, crushedBlock)
            }
            if let hi = newSnap.forts[fi].hobs.firstIndex(where: { $0.id == hob.id }) {
                newSnap.forts[fi].hobs[hi].bonked = true
                newSnap.forts[fi].hobs[hi].hp = 0
            }
        }

        let json = #"""
        [
          {"t":"break","tick":3,"side":1,"c":\#(blastCell.0),"r":\#(blastCell.1),"why":"blast"},
          {"t":"collapse","tick":3,"side":1,"blocks":[[\#(colCell.0),\#(colCell.1),"timber"]],"falls":[[\#(colCell.0),32]]},
          {"t":"break","tick":3,"side":1,"c":\#(crushCell.0),"r":\#(crushCell.1),"why":"crush"},
          {"t":"hit","tick":3,"side":1,"target":"hob","hob":\#(hob.id),"dmg":99,"why":"crush"},
          {"t":"bonk","tick":3,"side":1,"hob":\#(hob.id)}
        ]
        """#
        let rawEvents = try JSONDecoder().decode([CoreEvent].self, from: Data(json.utf8))
        let events = rawEvents.compactMap { FrameAssembler.event($0, mapHeight: 720) }

        let fx = FieldFX()
        fx.ingest(events, old: old, new: newSnap, nowNanos: 1)
        let held = fx.held(side: 1)
        XCTAssertEqual(held.count, 1, "only the crush-broken block is held; the blasted block is not resurrected")
        XCTAssertEqual(held.first?.x, crushedBlock.x)
        XCTAssertTrue(fx.deferredBonks.contains("1:\(hob.id)"), "crush bonk waits for landing")

        // Walk accumulation: a second walk step during an active walk extends smoothly instead of snapping back.
        let walk1 = try JSONDecoder().decode([CoreEvent].self, from: Data(#"[{"t":"walk","tick":1,"side":0,"from":[100,300],"to":[104,300]}]"#.utf8))
            .compactMap { FrameAssembler.event($0, mapHeight: 720) }
        fx.ingest(walk1, old: old, new: old, nowNanos: 1_000_000)
        _ = fx.advance(realMs: 100, nowNanos: 101_000_000)
        let walk2 = try JSONDecoder().decode([CoreEvent].self, from: Data(#"[{"t":"walk","tick":2,"side":0,"from":[104,300],"to":[108,300]}]"#.utf8))
            .compactMap { FrameAssembler.event($0, mapHeight: 720) }
        fx.ingest(walk2, old: old, new: old, nowNanos: 101_000_000)
        let w = try XCTUnwrap(fx.walks[0])
        XCTAssertGreaterThan(w.dx, 4, "remaining displacement accumulates with the new step")
        XCTAssertGreaterThan(w.segStart, w.start)
    }

    // MARK: M1 & M2: Workshop Kettle overlap move & no-op revert

    @MainActor
    func testWorkshopKettleOverlapMoveAndNoOpRevert() {
        var grid = WorkshopGrid()
        XCTAssertTrue(grid.apply(.kettle, c: 2, r: 0))
        XCTAssertFalse(grid.apply(.kettle, c: 2, r: 0), "same kettle spot is a no-op")
        XCTAssertTrue(grid.apply(.kettle, c: 3, r: 0), "nudging the Kettle by 1 column over its own footprint succeeds")
        XCTAssertEqual(grid.cell(2, 0), .empty)
        XCTAssertEqual(grid.cell(3, 0), .kettle)
        XCTAssertEqual(grid.cell(4, 1), .kettle)

        let model = WorkshopModel(rows: nil, checker: WorkshopChecker(bridge: FakeCoreBridge()))
        XCTAssertFalse(model.canRevert)
        model.revert()
        XCTAssertFalse(model.canUndo, "reverting an unchanged fort does not pollute undo stack")
        model.tool = .timber
        XCTAssertFalse(model.tap(c: 1, r: 0), "blocked tap on Kettle returns false")
    }

    // MARK: M3, M10, M13, L4: Low-steam buried Hob, Pass/Doodad handoff, ColourSet names, Shell ID

    @MainActor
    func testHobToOpenLowSteamHandoffActionShellIdAndColourSetNames() throws {
        var obj = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: Data(try fixtureText("snapshot_plan").utf8)) as? [String: Any]
        )
        var hud = obj["hud"] as? [String: Any] ?? [:]
        hud["steam"] = [5, 100]
        hud["shove_off_cost"] = 15
        var hobs = try XCTUnwrap(obj["hobs"] as? [[String: Any]])
        let firstIdx = try XCTUnwrap(hobs.firstIndex { ($0["side"] as? Int) == 0 })
        var second = hobs[firstIdx]
        second["id"] = 3
        second["can_fire"] = true
        second["buried"] = false
        hobs[firstIdx]["can_fire"] = false
        hobs[firstIdx]["buried"] = true
        hobs.append(second)
        obj["hobs"] = hobs
        obj["hud"] = hud
        obj["shells"] = [[42, 500, 300, 450, "clodpot"]]
        let raw = try XCTUnwrap(CoreSnapshot.decode(String(decoding: try JSONSerialization.data(withJSONObject: obj), as: UTF8.self)))
        let snap = FrameAssembler(catalog: ContentCatalog.load()).assemble(raw, handoffTo: nil, speed: 1)
        XCTAssertEqual(snap.shells.first?.id, 42, "ShellView preserves core shell id")
        XCTAssertEqual(BattleSession.hobToOpen(snap), "3", "buried Hob without enough Steam switches to a crewmate who can fire")

        // Handoff line for Pass and Doodad (iOS-M10)
        var passObj = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: Data(try fixtureText("snapshot_plan").utf8)) as? [String: Any]
        )
        passObj["events"] = [
            ["t": "pass", "tick": 2, "side": 0],
            ["t": "turn_start", "tick": 3, "side": 1],
        ]
        let passRaw = try XCTUnwrap(CoreSnapshot.decode(String(decoding: try JSONSerialization.data(withJSONObject: passObj), as: UTF8.self)))
        let handoff = FrameAssembler(catalog: ContentCatalog.load()).assemble(passRaw, handoffTo: 1, speed: 1)
        XCTAssertEqual(handoff.handoff?.line, "You skipped a go")

        XCTAssertEqual(ColourSet.brickabrac.sideName(0), "Blue")
        XCTAssertEqual(ColourSet.dusk.sideName(1), "Gold")
        XCTAssertEqual(ColourSet.ink.sideName(0), "White")
    }

    // MARK: Round 2 Audit Fixes (H-I01..H-I05, M-I02, L-I04, Workshop & Award-Winning Aim)

    @MainActor
    func testFlattenerActionClipsAndSoundsFireOnSide1() throws {
        let fx = FieldFX()
        var sounds: [String] = []
        fx.onSound = { id, _, _ in sounds.append(id) }
        fx.noteHob(side: 1, id: "0", def: "clerk", cls: "lobber")
        let fireClip = try XCTUnwrap(fx.hobClip(key: "1:0", suffix: "fire"), "H-I01: flattener_clerk_fire clip must resolve")
        XCTAssertTrue(fireClip.frames.first?.hasPrefix("flattener_clerk_fire") ?? false)
        var snap = BattleSnapshot()
        snap.phase = .plan
        snap.isDuel = false
        snap.forts = [
            FortView(side: 0, x: 100, kettleX: 100, kettleY: 200, kettleHp: 100, kettleMax: 100, blocks: [], hobs: []),
            FortView(side: 1, x: 540, kettleX: 540, kettleY: 200, kettleHp: 100, kettleMax: 100, blocks: [],
                     hobs: [HobView(id: "0", def: "clerk", name: "Clerk", cls: "lobber", hp: 100, hpMax: 100, x: 540, y: 180)]),
        ]
        let rawEvents = try JSONDecoder().decode([CoreEvent].self, from: Data(#"[{"t":"hit","tick":2,"side":1,"target":"hob","hob":0,"dmg":18}]"#.utf8))
        let events = rawEvents.compactMap { FrameAssembler.event($0, mapHeight: 720) }
        fx.ingest(events, old: snap, new: snap, nowNanos: 1)
        _ = fx.advance(realMs: 40, nowNanos: 40_000_000)
        XCTAssertTrue(sounds.contains("hob_hit_boing"), "Flattener hit clip flash event must trigger hobEvent audio")
    }

    func testSafeOnScreenEdgeAssistAndBadgeTopYAndZeroGreenHeat() {
        // H-I03: anchor never leaves safe screen bounds; virtual edgeBonusPts finishes power 100.
        let bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        var g = AimGesture(anchor: CGPoint(x: 40, y: 80), powerSpan: 156, mode: .pullBack, bounds: bounds, topInset: 47)
        _ = g.move(to: CGPoint(x: 20, y: 100))
        _ = g.move(to: CGPoint(x: 4, y: 116))
        XCTAssertNotNil(g.edgeAngle, "8 pt edge margin locks angle cleanly")
        for _ in 0..<200 { _ = g.slide(points: 3) }
        XCTAssertEqual(g.power, 100, "virtual edgeBonusPts reaches full power")
        XCTAssertGreaterThanOrEqual(g.anchor.x, 24, "Cancel Halo anchor stays safely on screen")
        XCTAssertGreaterThanOrEqual(g.anchor.y, 47 + 24, "Cancel Halo anchor stays below top inset")

        // H-I02: badgeTopY respects layout in both Tall and Wide modes.
        let tall = BattleLayout.compute(size: CGSize(width: 390, height: 844),
                                        insets: Insets(top: 59, left: 0, bottom: 34, right: 0),
                                        mode: .tall, inFlight: false, isPad: false)
        XCTAssertEqual(DragBandView.badgeTopY(layout: tall, size: tall.size), tall.aimRegion.minY + 26)
        let wide = BattleLayout.compute(size: CGSize(width: 1180, height: 820),
                                        insets: Insets(top: 24, left: 0, bottom: 20, right: 0),
                                        mode: .wide, inFlight: false, isPad: true)
        XCTAssertGreaterThanOrEqual(DragBandView.badgeTopY(layout: wide, size: wide.size), wide.insets.top + 48)

        // Zero neon green across 0..100 power in aimHeatRGB, and Side 1 intuitive elevation.
        for p in stride(from: 0, through: 100, by: 5) {
            let c = LensLayer.aimHeatRGB(p)
            XCTAssertFalse(c.g > c.r && c.g > c.b, "aimHeat(\(p)) must never sweep through green")
        }
        XCTAssertEqual(HudState.displayAngleTenths(1485, side: 1), 315, "Side 1 raw 148.5° displays as 31.5° elevation")
        XCTAssertEqual(HudState.displayAngleTenths(450, side: 0), 450)
    }

    @MainActor
    func testPotLidFiltersDestroyedRoomsAndMissTextUsesExactFortBounds() throws {
        // H-I04: FortView.kettleIntact & RoomView.intact model destroyed rooms accurately.
        var snap = BattleSnapshot()
        snap.phase = .plan
        snap.activeSide = 0
        snap.humans = [true, false]
        let own = FortView(side: 0, x: 100, kettleX: 100, kettleY: 200, kettleHp: 100, kettleMax: 100,
                           blocks: [], hobs: [], originX: 60, baseY: 160, block: 16, cols: 5,
                           rooms: [
                            RoomView(id: 0, box: CGRectLike(x0: 60, y0: 176, x1: 92, y1: 208), loophole: nil, intact: false, flap: false, lid: false),
                            RoomView(id: 1, box: CGRectLike(x0: 92, y0: 176, x1: 124, y1: 208), loophole: nil, intact: true, flap: false, lid: true),
                            RoomView(id: 2, box: CGRectLike(x0: 124, y0: 176, x1: 156, y1: 208), loophole: nil, intact: true, flap: false, lid: false),
                           ],
                           kettleRoom: CGRectLike(x0: 76, y0: 192, x1: 108, y1: 224),
                           kettleIntact: false, kettleLid: false)
        let foe = FortView(side: 1, x: 540, kettleX: 540, kettleY: 200, kettleHp: 100, kettleMax: 100,
                           blocks: [], hobs: [], originX: 500, baseY: 160, block: 16, cols: 5)
        snap.forts = [own, foe]
        XCTAssertFalse(own.kettleIntact)

        // M-I02: core missBlocks preferred; fallback uses exact fort bounds [500, 580] and ignores selfHit.
        let coreMiss = PinView(x: 400, y: 160, side: 0, round: 1, hob: "0", angle: 450, power: 50, missBlocks: -4)
        XCTAssertEqual(LensLayer.missText(coreMiss, snap: snap), GameText.shared.t("hud.miss_short", ["n": 4]))
        let coreHit = PinView(x: 520, y: 160, side: 0, round: 1, hob: "0", angle: 450, power: 60, missBlocks: 0)
        XCTAssertNil(LensLayer.missText(coreHit, snap: snap))
        let selfHit = PinView(x: 100, y: 160, side: 0, round: 1, hob: "0", angle: 850, power: 10, selfHit: true)
        XCTAssertNil(LensLayer.missText(selfHit, snap: snap))
        let exactFallback = PinView(x: 495, y: 160, side: 0, round: 1, hob: "0", angle: 450, power: 55)
        XCTAssertEqual(LensLayer.missText(exactFallback, snap: snap), GameText.shared.t("hud.miss_short_one"))
    }

    func testWorkshopProblemIdCompactsNooksAndEraseAllResetsNewerFile() throws {
        XCTAssertEqual(WorkshopGrid.plainWords(problem: "no_kettle_room", detail: "arbitrary detail"),
                       GameText.shared.t("workshop.problems.no_kettle_room"))
        XCTAssertEqual(WorkshopGrid.plainWords(problem: "unsupported", detail: "arbitrary detail"),
                       GameText.shared.t("workshop.problems.nothing_under"))

        var grid = WorkshopGrid()
        _ = grid.apply(.nook, c: 1, r: 2)
        _ = grid.apply(.nook, c: 4, r: 2)
        XCTAssertEqual(grid.cell(1, 2), .nook(1))
        XCTAssertEqual(grid.cell(4, 2), .nook(2))
        _ = grid.apply(.erase, c: 1, r: 2)
        XCTAssertEqual(grid.cell(1, 2), .empty)
        XCTAssertEqual(grid.cell(4, 2), .nook(1), "remaining Nook compacts down to 1")

        // L-I04: SaveStore.eraseAll resets newerFile lock so future writes succeed.
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("AuditEraseNewer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let newer = #"{"schema":99,"counter":7,"firstRunDone":true}"#
        try Data(newer.utf8).write(to: dir.appendingPathComponent("save.json"))
        let store = SaveStore(directory: dir)
        _ = store.load()
        XCTAssertTrue(store.isNewerSchema)
        store.eraseAll()
        XCTAssertFalse(store.isNewerSchema)
        var fresh = SaveData()
        fresh.counter = 42
        try store.writeNow(fresh)
        XCTAssertEqual(store.load().counter, 42)
    }
}

private final class AuditRecordingBridge: CoreBridge, @unchecked Sendable {
    private let inner = FakeCoreBridge()
    private let lock = NSLock()
    private var log: [String] = []

    var commands: [String] {
        lock.lock()
        defer { lock.unlock() }
        return log
    }

    var name: String { "AuditRecording" }
    var isStandIn: Bool { true }
    var version: String { inner.version }
    func start(setup: String, seed: UInt64) -> String? { inner.start(setup: setup, seed: seed) }
    func command(_ json: String) -> String {
        lock.lock()
        log.append(json)
        lock.unlock()
        return inner.command(json)
    }
    func step(_ ticks: Int) -> String { inner.step(ticks) }
    func snapshot() -> String { inner.snapshot() }
    func end() { inner.end() }
}

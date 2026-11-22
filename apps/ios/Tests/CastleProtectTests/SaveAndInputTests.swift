import CoreGraphics
import XCTest
@testable import CastleProtect

final class SaveStoreTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("SaveStoreTests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    func testFreshStoreLoadsDefaults() {
        let store = SaveStore(directory: dir)
        let data = store.load()
        XCTAssertEqual(data, SaveData())
        XCTAssertFalse(data.firstRunDone)
        XCTAssertNil(data.battle)
    }

    func testRoundTrip() throws {
        let store = SaveStore(directory: dir)
        var data = SaveData()
        data.firstRunDone = true
        data.settings.music = 40
        data.settings.rotation = .stayTall
        data.settings.haptics = .light
        data.progress.record(level: "1-1", pennants: 2, buttons: 150)
        data.progress.record(level: "1-1", pennants: 1, buttons: 40)
        data.duel.names = ["Mabel", "Otis"]
        data.battle = BattleSave(core: Data([1, 2, 3, 250]), setup: .campaign("1-2", preset: .cozy, seed: 99),
                                 title: "1-2  Two Hats", round: 4, turnName: "You",
                                 savedAt: Date(timeIntervalSince1970: 1_700_000_000))
        try store.writeNow(data)

        let back = SaveStore(directory: dir).load()
        XCTAssertEqual(back, data)
        XCTAssertEqual(back.progress.pennants["1-1"], 2, "the best result is kept")
        XCTAssertEqual(back.progress.buttons, 190)
        XCTAssertEqual(back.battle?.core, Data([1, 2, 3, 250]))
        XCTAssertEqual(back.battle?.setup.seed, 99)
    }

    func testQueuedWritesLandInOrder() {
        let store = SaveStore(directory: dir)
        for i in 1...20 {
            var data = SaveData()
            data.counter = i
            store.write(data)
        }
        store.flush()
        XCTAssertEqual(store.load().counter, 20)
    }

    func testDamagedFileFallsBackToTheBackup() throws {
        let store = SaveStore(directory: dir)
        var first = SaveData()
        first.counter = 1
        first.firstRunDone = true
        try store.writeNow(first)
        var second = first
        second.counter = 2
        try store.writeNow(second)
        try Data("{ not json".utf8).write(to: store.fileURL)
        let back = store.load()
        XCTAssertEqual(back.counter, 1)
        XCTAssertTrue(back.firstRunDone)
    }

    func testOlderFileWithMissingFieldsStillLoads() throws {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let old = #"{"schema":1,"counter":5,"firstRunDone":true,"settings":{"music":10},"progress":{"pennants":{"1-1":3}}}"#
        let store = SaveStore(directory: dir)
        try Data(old.utf8).write(to: store.fileURL)
        let data = store.load()
        XCTAssertEqual(data.counter, 5)
        XCTAssertEqual(data.settings.music, 10)
        XCTAssertEqual(data.settings.sound, GameSettings().sound)
        XCTAssertEqual(data.progress.totalPennants, 3)
        XCTAssertEqual(data.duel, DuelOptions())
    }

    func testEraseAll() throws {
        let store = SaveStore(directory: dir)
        var data = SaveData()
        data.firstRunDone = true
        try store.writeNow(data)
        try store.writeNow(data)
        store.eraseAll()
        XCTAssertEqual(store.load(), SaveData())
    }
}

final class AimGestureTests: XCTestCase {
    private let span: CGFloat = 156

    func testShortTravelIsATapNotADrag() {
        var g = AimGesture(anchor: CGPoint(x: 200, y: 300), powerSpan: span, mode: .pullBack)
        XCTAssertFalse(g.move(to: CGPoint(x: 205, y: 303)))
        XCTAssertFalse(g.isDragging)
        XCTAssertTrue(g.move(to: CGPoint(x: 190, y: 310)))
        XCTAssertTrue(g.isDragging)
    }

    func testPullBackAimsAwayFromTheFinger() {
        var g = AimGesture(anchor: CGPoint(x: 200, y: 300), powerSpan: span, mode: .pullBack)
        // Pull down and left: the shot goes up and right at 45 degrees.
        _ = g.move(to: CGPoint(x: 200 - 55.15, y: 300 + 55.15))
        XCTAssertEqual(g.angleTenths, 450)
        XCTAssertEqual(g.power, 50)
    }

    func testPointModeAimsAtTheFinger() {
        var g = AimGesture(anchor: CGPoint(x: 200, y: 300), powerSpan: span, mode: .point)
        _ = g.move(to: CGPoint(x: 100, y: 300))
        XCTAssertEqual(g.angleTenths, 1800)
    }

    func testPowerStopsAtOneHundred() {
        var g = AimGesture(anchor: CGPoint(x: 200, y: 300), powerSpan: span, mode: .pullBack)
        _ = g.move(to: CGPoint(x: 200, y: 900))
        XCTAssertEqual(g.power, 100)
        XCTAssertEqual(g.angleTenths, 900)
        XCTAssertEqual(g.bandEnd.y, 300 + span, accuracy: 0.001)
    }

    func testAngleNeverGoesBelowTheGround() {
        var g = AimGesture(anchor: CGPoint(x: 200, y: 300), powerSpan: span, mode: .pullBack)
        _ = g.move(to: CGPoint(x: 150, y: 250))
        XCTAssertEqual(g.angleTenths, 0)
        _ = g.move(to: CGPoint(x: 250, y: 250))
        XCTAssertEqual(g.angleTenths, 1800)
    }

    func testAngleSnapsToHalfDegrees() {
        var g = AimGesture(anchor: .zero, powerSpan: span, mode: .point)
        _ = g.move(to: CGPoint(x: 100, y: -37))
        XCTAssertEqual(g.angleTenths % 5, 0)
    }

    func testCancelRing() {
        var g = AimGesture(anchor: CGPoint(x: 200, y: 300), powerSpan: span, mode: .pullBack)
        _ = g.move(to: CGPoint(x: 260, y: 300))
        XCTAssertFalse(g.isInCancelRing)
        _ = g.move(to: CGPoint(x: 205, y: 304))
        XCTAssertTrue(g.isDragging)
        XCTAssertTrue(g.isInCancelRing)
    }
}

final class BattleLayoutTests: XCTestCase {
    func testModeHasHysteresis() {
        XCTAssertEqual(LayoutMode.resolve(size: CGSize(width: 844, height: 390), previous: nil), .wide)
        XCTAssertEqual(LayoutMode.resolve(size: CGSize(width: 390, height: 844), previous: nil), .tall)
        let ratio120 = CGSize(width: 1200, height: 1000)
        XCTAssertEqual(LayoutMode.resolve(size: ratio120, previous: .tall), .tall, "stays Tall until over 1.25")
        XCTAssertEqual(LayoutMode.resolve(size: ratio120, previous: .wide), .wide, "stays Wide until under 1.15")
        XCTAssertEqual(LayoutMode.resolve(size: CGSize(width: 1100, height: 1000), previous: .wide), .tall)
        XCTAssertEqual(LayoutMode.resolve(size: CGSize(width: 1300, height: 1000), previous: .tall), .wide)
    }

    func testTallPhoneHasStackedLenses() {
        let insets = Insets(top: 47, left: 0, bottom: 34, right: 0)
        let l = BattleLayout.compute(size: CGSize(width: 390, height: 844), insets: insets, mode: .tall, inFlight: false, isPad: false)
        XCTAssertEqual(l.lenses.map(\.focus), [.target, .whole, .own])
        XCTAssertEqual(l.topStrip.minY, 47)
        XCTAssertEqual(l.crewRow.maxY, 844 - 34)
        XCTAssertEqual(l.aimRegion, l.lenses[2].viewport)
        XCTAssertEqual(l.powerSpan, 156, accuracy: 0.001)
        let flight = BattleLayout.compute(size: CGSize(width: 390, height: 844), insets: insets, mode: .tall, inFlight: true, isPad: false)
        XCTAssertEqual(flight.lenses.map(\.focus), [.follow, .whole])
        XCTAssertEqual(flight.aimRegion, .zero)
    }

    func testWideHasOneLensAndTheSamePowerSpanAfterATurn() {
        let wide = BattleLayout.compute(size: CGSize(width: 844, height: 390), insets: Insets(), mode: .wide, inFlight: false, isPad: false)
        let tall = BattleLayout.compute(size: CGSize(width: 390, height: 844), insets: Insets(), mode: .tall, inFlight: false, isPad: false)
        XCTAssertEqual(wide.lenses.count, 1)
        XCTAssertEqual(wide.lenses[0].focus, .both)
        XCTAssertEqual(wide.powerSpan, tall.powerSpan, accuracy: 0.001)
    }
}

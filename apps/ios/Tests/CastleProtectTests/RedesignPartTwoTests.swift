import CoreGraphics
import SpriteKit
import XCTest
@testable import CastleProtect

/// Unit tests covering Part 2 Visual & UX Redesign:
/// `--v2` trimmed/deduplicated atlas decoding, 2-pin visual cap, de-overlapped combat callouts,
/// Portrait unobstructed `walkRail` layout, Flattener mapping, Shell Inspect catalog metadata,
/// and stratified terrain pixel rendering.
final class RedesignPartTwoTests: XCTestCase {
    // MARK: --v2 Trimmed & Deduplicated Atlas Loader

    @MainActor
    func testAtlasV2IndexAliasesOverlaysAndTrimAnchorMath() throws {
        let indexJSON = #"""
        {
          "scale": 2,
          "v2": true,
          "trimmed": true,
          "dedupHobs": true,
          "pages": ["castle@2x-0.json"],
          "scarfOverlays": ["hob_scarf_blue", "hob_scarf_orange"],
          "aliases": {
            "hob_marge_blue_idle_0": "hob_marge_neutral_idle_0",
            "hob_marge_orange_idle_0": "hob_marge_neutral_idle_0"
          },
          "overlays": {
            "hob_marge_blue_idle_0": [{"sprite": "hob_scarf_blue", "dx": 0, "dy": -19.5, "rot": 0, "scale": 1.0}],
            "hob_marge_orange_idle_0": [{"sprite": "hob_scarf_orange", "dx": 0, "dy": -19.5, "rot": 4.0, "scale": 1.0}]
          }
        }
        """#
        let index = try JSONDecoder().decode(AtlasIndex.self, from: Data(indexJSON.utf8))
        XCTAssertEqual(index.v2, true)
        XCTAssertEqual(index.trimmed, true)
        XCTAssertEqual(index.dedupHobs, true)
        XCTAssertEqual(index.aliases?["hob_marge_blue_idle_0"], "hob_marge_neutral_idle_0")
        XCTAssertEqual(index.overlays?["hob_marge_orange_idle_0"]?.first?.sprite, "hob_scarf_orange")

        // Trimmed frame with per-frame scale = 1 on a @2x page (as emitted by render-sprites --v2)
        let rect = AtlasRect(x: 4, y: 8, w: 40, h: 62, trim: [16, 10, 40, 62], sourceSize: [72, 80], scale: 1)
        let entry = SpriteManifest.Entry(name: "hob_marge_neutral_idle_0", w: 72, h: 80, anchor: [36, 72])
        let tex = SKTexture(data: Data([255, 255, 255, 255]), size: CGSize(width: 1, height: 1))
        let frame = SpriteSheet.makeFrame(rect: rect, pageScale: 2, texture: tex, manifestEntry: entry)
        XCTAssertTrue(frame.isTrimmed)
        XCTAssertEqual(frame.size, CGSize(width: 72, height: 80))
        XCTAssertEqual(frame.drawSize, CGSize(width: 40, height: 62))
        XCTAssertEqual(frame.trimOffset, CGPoint(x: 16, y: 10))
        // Untrimmed feet anchor (36, 72) sits at local (20, 62) inside 40x62 -> SpriteKit unit (0.5, 0.0)
        let skAnchor = frame.spriteKitAnchor()
        XCTAssertEqual(skAnchor.x, 0.5, accuracy: 0.001)
        XCTAssertEqual(skAnchor.y, 0.0, accuracy: 0.001)

        let sheet = SpriteSheet(frames: ["hob_marge_neutral_idle_0": frame],
                                aliases: index.aliases ?? [:],
                                overlays: index.overlays ?? [:])
        XCTAssertTrue(sheet.isV2)
        XCTAssertNotNil(sheet.frame("hob_marge_blue_idle_0"))
        XCTAssertNotNil(sheet.frame("hob_marge_orange_idle_0"))
        XCTAssertEqual(sheet.overlays(for: "hob_marge_blue_idle_0").count, 1)
        XCTAssertEqual(sheet.overlays(for: "hob_marge_orange_idle_0").first?.rot, 4.0)
    }

    // MARK: 2-Pin Visual Cap & De-Overlapped Combat Callouts

    func testVisiblePinsCapsAtTwoMostRecentPerSide() {
        let pins = [
            PinView(x: 100, y: 100, side: 0, round: 1),
            PinView(x: 200, y: 100, side: 0, round: 2),
            PinView(x: 300, y: 100, side: 0, round: 3),
            PinView(x: 400, y: 100, side: 0, round: 4),
            PinView(x: 900, y: 100, side: 1, round: 1),
            PinView(x: 950, y: 100, side: 1, round: 2),
            PinView(x: 980, y: 100, side: 1, round: 3),
        ]
        let shown = LensLayer.visiblePins(pins, maxPerSide: 2)
        XCTAssertEqual(shown.count, 4)
        XCTAssertEqual(shown.filter { $0.side == 0 }.map(\.round), [3, 4])
        XCTAssertEqual(shown.filter { $0.side == 1 }.map(\.round), [2, 3])
    }

    @MainActor
    func testSimultaneousCombatCalloutsDeOverlap() {
        let fx = FieldFX()
        fx.spawnCallout("-60", x: 500, y: 200, style: .hobHit)
        fx.spawnCallout("-35", x: 502, y: 202, style: .wallBreak)
        fx.spawnCallout("Drop!", x: 500, y: 200, style: .drop)
        let resolved = fx.resolvedCallouts(minDx: 40, minDy: 24)
        XCTAssertEqual(resolved.count, 3)
        for i in 0..<resolved.count {
            for j in (i + 1)..<resolved.count {
                let dx = abs(resolved[i].x - resolved[j].x)
                let dy = abs(resolved[i].y - resolved[j].y)
                XCTAssertTrue(dx >= 40 || dy >= 24, "simultaneous callouts must separate cleanly")
            }
        }
    }

    // MARK: Portrait Unobstructed Fort & Integrated Walk Rail

    func testPortraitWalkRailSeparatesFromBottomLensAndMeetsTouchFloor() {
        let layout = BattleLayout.compute(size: CGSize(width: 390, height: 844),
                                          insets: Insets(top: 47, left: 0, bottom: 34, right: 0),
                                          mode: .tall, inFlight: false, isPad: false)
        let bottomLens = layout.lenses[2]
        XCTAssertGreaterThanOrEqual(layout.walkRail.height, 48)
        XCTAssertEqual(layout.walkRail.minY, bottomLens.viewport.maxY, accuracy: 0.5)
        XCTAssertFalse(bottomLens.viewport.intersects(layout.walkRail),
                       "Portrait Walk rail sits in the dock below the lower fort lens")
        XCTAssertEqual(BattleLayout.fineTuneKey(mode: .tall, isPad: false), 48)
        XCTAssertEqual(BattleLayout.fineTuneKey(mode: .wide, isPad: false), 48)
    }

    // MARK: Flattener Faction Mapping & Rich Shell Inspect Metadata

    func testFlattenerMappingAndRichShellInspectCatalog() {
        XCTAssertEqual(SpriteImages.flattenerArtName(def: "hedge_snipper", cls: "lobber"), "snipper")
        XCTAssertEqual(SpriteImages.flattenerArtName(def: "rake_hand", cls: "scatterjack"), "rake")
        XCTAssertEqual(SpriteImages.flattenerArtName(def: "pebble_pitcher", cls: "zinger"), "sniper")
        XCTAssertEqual(SpriteImages.flattenerArtName(def: "mower_minder", cls: "boinker"), "tamper")
        XCTAssertEqual(SpriteImages.flattenerArtName(def: "straw_stuffer", cls: "dummy"), "clerk")

        let catalog = ContentCatalog.load()
        if let mole = catalog.shots["mole_mail"] {
            XCTAssertEqual(mole.maxCells, 400)
            // Class display names come from content/classes.json: the id delver shows as Digger.
            XCTAssertEqual(mole.matchClassTitle, "Digger")
            XCTAssertEqual(mole.matchedHobArt, "grub")
            XCTAssertFalse(mole.card.isEmpty)
            // No "Best vs" table: the sentence-case Good at line comes from content/text.json.
            XCTAssertEqual(catalog.goodAt("mole_mail"), "Good at: a fort behind a hill")
        }
    }

    // MARK: Painterly Stratified Terrain Cross-Section

    @MainActor
    func testStratifiedTerrainProducesMultiToneEarth() throws {
        let grid = TerrainGrid(w: 64, h: 64, chunk: 64)
        var bytes = [UInt8](repeating: 0, count: 64 * 64)
        for y in 16..<32 { for x in 0..<64 { bytes[y * 64 + x] = 1 } } // Loam
        for y in 32..<48 { for x in 0..<64 { bytes[y * 64 + x] = 2 } } // Clay
        for y in 48..<64 { for x in 0..<64 { bytes[y * 64 + x] = 3 } } // Rock
        XCTAssertTrue(grid.apply(x: 0, y: 0, w: 64, h: 64, base64: Data(bytes).base64EncodedString()))
        let img = try XCTUnwrap(grid.rgba(chunkIndex: 0))
        XCTAssertEqual(img.data.count, 64 * 64 * 4)
        var distinctColors = Set<UInt32>()
        img.data.withUnsafeBytes { buf in
            for p in 0..<(64 * 64) where buf[p * 4 + 3] == 255 {
                let rgb = (UInt32(buf[p * 4]) << 16) | (UInt32(buf[p * 4 + 1]) << 8) | UInt32(buf[p * 4 + 2])
                distinctColors.insert(rgb)
            }
        }
        XCTAssertGreaterThan(distinctColors.count, 10, "stratified Loam/Clay/Rock should have painterly multi-tone bands")
    }
}

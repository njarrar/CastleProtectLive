import XCTest
@testable import CastleProtect

/// content/text.json: keys, placeholders, plurals, pools and the names the apps must read
/// (content/text.md), plus the bark options in assets/audio/barks.json.
final class GameTextTests: XCTestCase {
    /// The table from the app bundle; from the repo when a test host has no `content/` folder.
    private func table() throws -> GameText {
        let bundled = GameText.load()
        if !bundled.isEmpty { return bundled }
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // GameTextTests.swift
            .deletingLastPathComponent() // CastleProtectTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // ios
            .deletingLastPathComponent() // apps
        let data = try Data(contentsOf: root.appendingPathComponent("content/text.json"))
        return try XCTUnwrap(GameText.parse(data))
    }

    func testTextJsonLoadsAndFillsPlaceholders() throws {
        let text = try table()
        XCTAssertFalse(text.isEmpty, "content/text.json is in the app bundle")
        XCTAssertEqual(text.t("app.tagline"), "Keep Brickabrac lumpy.")
        XCTAssertEqual(text.t("hud.round", ["n": 3, "cap": 12]), "Round 3 of 12")
        XCTAssertEqual(text.t("banners.rival_aims", ["rival": "Pudge"]), "Pudge aims")
        XCTAssertEqual(text.t("hud.why.resting_plain_only", ["hob": "Old Thumper"]), "Old Thumper needs a rest. Plain Shot only.")
        XCTAssertEqual(text.t("results.loss.cause.kettle_pop", ["who": "Tuft", "shot": "Clodpot", "n": 4]),
                       "Tuft's Clodpot popped your kettle in Round 4.")
        // A line that needs a name we do not have is not complete.
        XCTAssertNil(text.complete("hud.why.resting_plain_only"))
        XCTAssertNotNil(text.complete("hud.why.buried"))
        // Notes for people are never loaded.
        XCTAssertFalse(text.has("_readme.what"))
        XCTAssertFalse(text.has("hud.why._note"))
        // A missing key gives the fallback, filled the same way.
        XCTAssertEqual(text.t("no.such.key", ["n": 2], or: "{n} left"), "2 left")
    }

    func testPluralsPoolsAndCoreIds() throws {
        let text = try table()
        XCTAssertEqual(text.plural("handoff.last_hit", 1, ["name": "Mabel", "dmg": 20]), "Mabel broke 1 block and did 20 damage.")
        XCTAssertEqual(text.plural("handoff.last_hit", 3, ["name": "Mabel", "dmg": 20]), "Mabel broke 3 blocks and did 20 damage.")
        XCTAssertEqual(text.plural("workshop.to_fix", 2), "2 things to fix")
        // A pool never gives the same line twice running.
        let pool = text.pool("results.loss.verdict.kettle_pop")
        XCTAssertGreaterThan(pool.count, 1)
        var last = text.pick("results.loss.verdict.kettle_pop")
        for _ in 0..<20 {
            let next = text.pick("results.loss.verdict.kettle_pop")
            XCTAssertTrue(pool.contains(next))
            XCTAssertNotEqual(next, last)
            last = next
        }
        // An id the core sends: its own line, else `default`.
        XCTAssertEqual(text.byId("results.loss.title", "kettle_pop"), "Kettle popped")
        XCTAssertEqual(text.byId("results.loss.title", "brand_new_how"), "Flattened")
    }

    @MainActor
    func testNamesComeFromContentNeverCutAtASpace() throws {
        let text = try table()
        XCTAssertEqual(text.hobShort("old_thumper"), "Old Thumper")
        XCTAssertEqual(text.hobShort("quill"), "Miss Quill")
        XCTAssertEqual(text.rivalKey(named: "Sergeant Posy Rake"), "rake")
        XCTAssertEqual(text.rivalShort("Sir Pudge"), "Pudge")
        XCTAssertEqual(text.rivalShort("Someone New"), "Someone New")
        let catalog = ContentCatalog.load()
        XCTAssertEqual(catalog.hobShort(named: "Jax Pepper"), "Jax")
        XCTAssertEqual(catalog.className("delver"), "Digger")
        XCTAssertEqual(catalog.doodadName("pot_lid"), "Pot Lid")
        // The one Couch Duel list: no Rolo, nobody who shares a name with a Hob.
        let names = text.pool("names.duel")
        XCTAssertFalse(names.isEmpty)
        XCTAssertFalse(names.contains("Rolo"))
        XCTAssertEqual(DuelSetupView.sillyNames, names)
    }

    func testEveryRefusalIdHasALine() throws {
        let text = try table()
        let ids = ["resting_plain_only", "resting", "buried", "no_knack_uses", "not_in_hand", "no_shot", "no_heavy_first_turn",
                   "no_actions_left", "already_acted", "not_planning", "hob_cannot_fire", "not_enough_steam",
                   "cannot_walk_now", "cannot_walk_there", "bad_value", "no_ghost", "bad_target", "battle_over",
                   "pin_faded", "cannot_shove_now", "not_buried", "nothing_to_mend", "no_one_to_puff_up",
                   "no_doodad", "cannot_use_now", "recovered", "panic", "something_new"]
        for id in ids {
            XCTAssertTrue(text.has(BattleSession.refusalKey(id)), id)
            let words = BattleSession.refusalText(id, hob: "Marge", shot: "Clodpot", doodad: "Pot Lid")
            XCTAssertFalse(words.isEmpty, id)
            XCTAssertFalse(GameText.hasPlaceholder(words), "\(id): \(words)")
        }
        // A name the line needs and we lack: the core's own words, else a plain line.
        XCTAssertEqual(BattleSession.refusalText("resting_plain_only", detail: "Core words"), "Core words")
        XCTAssertEqual(BattleSession.refusalText("resting_plain_only"), text.t("errors.move_failed"))
    }

    func testCampaignGoalsAndRivalsFromContent() throws {
        let catalog = ContentCatalog.load()
        let first = try XCTUnwrap(catalog.level("1-1"))
        XCTAssertEqual(first.rival, "Sir Pudge")
        XCTAssertEqual(first.goals.first, "Send Pudge home", "levels.1-1.goals.win")
        XCTAssertEqual(first.thinkMs, 1800)
        let d1 = try XCTUnwrap(catalog.level("d1"))
        XCTAssertFalse(d1.roster.isEmpty, "Skirmish maps list their named Rivals")
        let pick = try XCTUnwrap(catalog.skirmishRival(map: "d1", seed: 7))
        XCTAssertEqual(pick, d1.roster[7 % d1.roster.count], "roster[seed % count], as the core picks")
    }

    func testBarkOptionsParse() throws {
        let json = #"""
        {"events": {"picked": {"chance": 0.4}},
         "hobs": {"grub": {"barks": {
            "picked": {"sound": "bark_grub_picked", "subtitles": ["Mm."], "chance": 0.2},
            "takes_hit": {"sound": "bark_grub_takes_hit", "subtitles": ["Mmf."],
                          "with_mate": {"hetty": ["Hetty'll fix it."]}, "with_rival": ["Not {rival} again."]}}}},
         "crew": {"win": {"subtitles": ["Lumpy forever!"]}}}
        """#
        let parsed = SoundManifest.parseBarks(Data(json.utf8))
        XCTAssertEqual(parsed.lines["bark_grub_picked"]?.chance, 0.2)
        XCTAssertEqual(parsed.chance["picked"], 0.4)
        XCTAssertEqual(parsed.crewWin, ["Lumpy forever!"])
        let hit = try XCTUnwrap(parsed.lines["bark_grub_takes_hit"])
        XCTAssertEqual(hit.pool(mates: [], rival: nil), ["Mmf."])
        XCTAssertEqual(hit.pool(mates: ["hetty"], rival: nil), ["Mmf.", "Hetty'll fix it."])
        XCTAssertEqual(hit.pool(mates: [], rival: "Tuft"), ["Mmf.", "Not Tuft again."])
    }

    @MainActor
    func testIdleClipsStartAtARandomPoint() {
        let json = #"""
        {"animations": {"hob_marge_rival_idle": {"frames": ["a", "b"], "ms": [400, 400], "loop": true,
                                                 "random_start": true, "start_offset_ms": 460}}}
        """#
        let lib = AnimationLibrary(data: Data(json.utf8))
        let idle = lib.clip("hob_marge_rival_idle")
        XCTAssertEqual(idle?.randomStart, true)
        XCTAssertEqual(idle?.startOffsetMs, 460)
        XCTAssertEqual(SpriteImages.team(1, rival: true), "rival")
        XCTAssertEqual(SpriteImages.team(1, rival: false), "orange", "Couch Duel player 2 stays orange")
        XCTAssertEqual(SpriteImages.team(0, rival: true), "blue")
    }
}

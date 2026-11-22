import XCTest

/// Launches the app fresh (stand-in core, empty save) and taps Play.
final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchAndTapPlay() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        let play = app.buttons["play"]
        XCTAssertTrue(play.waitForExistence(timeout: 15), "the First Run card shows Play")
        play.tap()

        // The first fight opens with no pre-battle sheet: the Fire button is there.
        let fire = app.buttons["fire"]
        XCTAssertTrue(fire.waitForExistence(timeout: 15), "the battle opens after Play")
        XCTAssertTrue(app.buttons["pause"].exists)
    }

    @MainActor
    func testPauseCardOpensAndResumes() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()
        let play = app.buttons["play"]
        XCTAssertTrue(play.waitForExistence(timeout: 15))
        play.tap()
        let pause = app.buttons["pause"]
        XCTAssertTrue(pause.waitForExistence(timeout: 15))
        pause.tap()
        let resume = app.buttons["resume"]
        XCTAssertTrue(resume.waitForExistence(timeout: 5))
        resume.tap()
        XCTAssertTrue(app.buttons["fire"].waitForExistence(timeout: 5))
    }
}

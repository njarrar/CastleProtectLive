import Foundation

/// Runs one battle on the core, following the frame loop in core/API.md:
/// steps whole 120 Hz ticks while shells fly, calls `ai_turn` after the think
/// pose when the core is awaiting the AI, and assembles each snapshot into
/// the view model. Also saves a battle as its setup plus the core's command
/// log, and resumes by replaying that log (the core is deterministic).
///
/// The Couch Duel hand-off card is app state (the core has no Ready command):
/// it shows at each turn start in a duel with Side by side seats.
@MainActor
final class CoreGame {
    let bridge: any CoreBridge
    let catalog: ContentCatalog
    private let assembler: FrameAssembler
    private(set) var setup: BattleSetup?
    private(set) var isRunning = false
    /// Resolve speed, 1 or 2 (the 2x key).
    var speed = 1
    /// Rival turns resolve at 2x (a setting).
    var rivalFast = false
    /// The Rival's think pose before `ai_turn`, in ms (rulings C3: 0.8 to 1.5 s).
    var thinkMs = 1000
    /// True while the pre-battle sheet is up: Rummage picks run, turns wait for Fight.
    var holdTurns = false

    private var lastPhase = "none"
    private var lastAwaiting = "none"
    private var lastSide = 0
    private var humans = [true, false]
    private var carryMs = 0
    private var thinkElapsed = 0
    private var handoffTo: Int?
    private var recallIndex = 0
    private var ghostCount = [0, 0]

    init(bridge: any CoreBridge, catalog: ContentCatalog) {
        self.bridge = bridge
        self.catalog = catalog
        self.assembler = FrameAssembler(catalog: catalog)
    }

    // MARK: Battle life

    /// Starts a battle. Returns nil, or why the core refused the setup.
    func start(_ setup: BattleSetup) -> String? {
        end()
        if let error = bridge.start(setup: setup.coreSetup().jsonString(), seed: setup.seed) {
            return error
        }
        self.setup = setup
        isRunning = true
        assembler.reset()
        resetClock()
        return nil
    }

    func end() {
        if isRunning { bridge.end() }
        isRunning = false
        setup = nil
        handoffTo = nil
    }

    private func resetClock() {
        lastPhase = "none"
        lastAwaiting = "none"
        carryMs = 0
        thinkElapsed = 0
        handoffTo = nil
        recallIndex = 0
        speed = 1
        holdTurns = false
    }

    // MARK: Commands

    @discardableResult
    func send(_ command: CoreCommand) -> CoreReply {
        guard isRunning else { return CoreReply(ok: false, reason: "no_battle") }
        let reply = CoreReply.decode(bridge.command(command.jsonString()))
        if reply.ok, case .pickHob = command { recallIndex = 0 }
        return reply
    }

    /// Recall steps through the active side's ghosts: last shot, the one before, and round again.
    @discardableResult
    func recall() -> CoreReply {
        let count = lastSide < ghostCount.count ? ghostCount[lastSide] : 0
        guard count > 0 else { return CoreReply(ok: false, reason: "no_ghost") }
        let index = (count - 1 - recallIndex % count + count) % count
        recallIndex += 1
        return send(.recall(ghost: index))
    }

    /// Couch Duel: the next player tapped Ready on the hand-off card.
    func ready() {
        handoffTo = nil
    }

    // MARK: Clock

    /// Wall-clock time passed. Steps the core only in resolve and settle, and
    /// asks the AI to play once its think pose is over.
    func advance(milliseconds ms: Int) {
        guard isRunning, ms > 0 else { return }
        if lastPhase == "draft", lastAwaiting == "ai" {
            // A Rival that picks first in the Rummage picks at once.
            send(.aiTurn())
            return
        }
        guard !holdTurns else { return }
        if lastPhase == "plan", lastAwaiting == "ai", handoffTo == nil {
            thinkElapsed += ms
            if thinkElapsed >= thinkMs {
                thinkElapsed = 0
                send(.aiTurn())
            }
            return
        }
        thinkElapsed = 0
        guard lastPhase == "resolve" || lastPhase == "settle" else {
            carryMs = 0
            return
        }
        let fast = speed >= 2 || (rivalFast && !(lastSide < humans.count && humans[lastSide]))
        carryMs += min(ms, 250) * (fast ? 2 : 1)
        let ticks = carryMs * 120 / 1000
        guard ticks > 0 else { return }
        carryMs -= ticks * 1000 / 120
        _ = bridge.step(ticks)
    }

    /// The newest frame, or nil when no battle runs or the core sent nothing readable.
    func frame() -> BattleSnapshot? {
        guard isRunning, let raw = CoreSnapshot.decode(bridge.snapshot()) else { return nil }
        lastPhase = raw.phase
        lastAwaiting = raw.awaiting
        lastSide = raw.side
        if raw.full, raw.hud.control.count >= 2 { humans = raw.hud.control.map { $0 == "human" } }
        if raw.full { ghostCount = [raw.ghosts.filter { $0.side == 0 }.count, raw.ghosts.filter { $0.side == 1 }.count] }
        let duelHandoff = setup?.mode == .duel && setup?.seats == .sideBySide
        if duelHandoff, raw.events.contains(where: { $0.t == "turn_start" }),
           !raw.events.contains(where: { $0.t == "battle_start" }), raw.phase == "plan" {
            handoffTo = raw.side
        }
        return assembler.assemble(raw, handoffTo: handoffTo, speed: speed)
    }

    // MARK: Save and resume

    private struct Saved: Codable {
        var setup: BattleSetup
        /// The core's `log` reply: every accepted command, a replay.
        var log: String
        var handoffTo: Int?
    }

    /// The battle in play as bytes the app stores unread: the setup and the core's command log.
    func save() -> Data {
        guard isRunning, let setup, lastPhase != "ended" else { return Data() }
        let reply = bridge.command(CoreCommand.log.jsonString())
        guard let obj = (try? JSONSerialization.jsonObject(with: Data(reply.utf8))) as? [String: Any],
              obj["ok"] as? Bool == true, let log = obj["log"] as? [Any],
              let logData = try? JSONSerialization.data(withJSONObject: log, options: [.sortedKeys]) else { return Data() }
        let saved = Saved(setup: setup, log: String(decoding: logData, as: UTF8.self), handoffTo: handoffTo)
        return (try? JSONEncoder().encode(saved)) ?? Data()
    }

    /// Rebuilds a saved battle by replaying its log from the seed, off screen.
    /// Returns false if the bytes or the replay were refused.
    func load(_ data: Data) -> Bool {
        guard let saved = try? JSONDecoder().decode(Saved.self, from: data), start(saved.setup) == nil,
              let commands = (try? JSONSerialization.jsonObject(with: Data(saved.log.utf8))) as? [Any] else {
            end()
            return false
        }
        for item in commands {
            guard let obj = item as? [String: Any],
                  let bytes = try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys]) else { continue }
            runUntilInput()
            let reply = CoreReply.decode(bridge.command(String(decoding: bytes, as: UTF8.self)))
            if !reply.ok {
                end()
                return false
            }
        }
        runUntilInput()
        // Drop the replay's events (no sounds for the past), then ask for the whole map again.
        _ = bridge.snapshot()
        _ = bridge.command(CoreCommand.terrainAll.jsonString())
        handoffTo = saved.handoffTo
        return true
    }

    /// Steps until the core waits for input (draft, plan) or the battle is over.
    private func runUntilInput() {
        for _ in 0..<4000 {
            let reply = bridge.step(120)
            let phase = ((try? JSONSerialization.jsonObject(with: Data(reply.utf8))) as? [String: Any])?["phase"] as? String
            if phase == nil || phase == "draft" || phase == "plan" || phase == "ended" { return }
        }
    }
}

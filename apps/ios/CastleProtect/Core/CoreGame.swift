import Foundation

/// Runs one battle on the core, following the frame loop in core/API.md:
/// steps whole 120 Hz ticks while shells fly, calls `ai_turn` after the think
/// pose when the core is awaiting the AI, and assembles each snapshot into
/// the view model. Also saves a battle as its setup plus the core's command
/// log, and resumes by replaying that log (the core is deterministic).
///
/// The core handle lives on `CoreHost`'s serial queue. `ai_turn` and the
/// resume replay run there off the main thread; while they run, `isBusy` is
/// true and this class makes no other core call.
///
/// The Couch Duel hand-off card is app state (the core has no Ready command):
/// it shows at each turn start in a duel with Side by side seats.
@MainActor
final class CoreGame {
    let host: CoreHost
    var bridge: any CoreBridge { host.bridge }
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
    /// Set when the core stops answering sensibly mid battle (M13). The session shows a notice.
    private(set) var fault: String?
    /// `cp_version().rules`, stored with every save (H4).
    let rulesVersion: Int
    let simVersion: String

    private var lastPhase = "none"
    private var lastAwaiting = "none"
    private var lastSide = 0
    private var humans = [true, false]
    private var carryMs = 0
    private var thinkElapsed = 0
    private var handoffTo: Int?
    private var recallIndex = 0
    private var ghostCount = [0, 0]
    /// A command was sent, or slow work finished: the next frame must be read.
    private var dirty = true

    init(bridge: any CoreBridge, catalog: ContentCatalog) {
        let host = CoreHost(bridge: bridge)
        self.host = host
        self.catalog = catalog
        self.assembler = FrameAssembler(catalog: catalog)
        let version = host.sync { $0.version }
        let obj = (try? JSONSerialization.jsonObject(with: Data(version.utf8))) as? [String: Any]
        rulesVersion = obj?["rules"] as? Int ?? 0
        simVersion = obj?["sim"] as? String ?? ""
    }

    /// True while `ai_turn` or a replay runs on the core queue.
    var isBusy: Bool { host.isBusy }

    /// Waits for slow work on the core queue (tests).
    func waitUntilIdle() { host.waitUntilIdle() }

    // MARK: Battle life

    /// Starts a battle. Returns nil, or why the core refused the setup.
    func start(_ setup: BattleSetup) -> String? {
        end()
        let json = setup.coreSetup().jsonString()
        if let error = host.sync({ $0.start(setup: json, seed: setup.seed) }) {
            return error
        }
        self.setup = setup
        isRunning = true
        assembler.reset()
        resetClock()
        return nil
    }

    func end() {
        host.waitUntilIdle()
        if isRunning { host.sync { $0.end() } }
        isRunning = false
        setup = nil
        handoffTo = nil
        fault = nil
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
        fault = nil
        dirty = true
    }

    // MARK: Commands

    @discardableResult
    func send(_ command: CoreCommand) -> CoreReply {
        guard isRunning else { return CoreReply(ok: false, reason: "no_battle") }
        guard !isBusy else { return CoreReply(ok: false, reason: "busy") }
        let json = command.jsonString()
        let text = host.sync { $0.command(json) }
        let reply = CoreReply.decode(text)
        if reply.reason == "panic" { fault = reply.detail ?? "panic" }
        if reply.ok, case .pickHob = command { recallIndex = 0 }
        dirty = true
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
        dirty = true
    }

    /// Asks for the next frame even if nothing was sent (speed change, resize).
    func markDirty() { dirty = true }

    // MARK: Clock

    /// Wall-clock time passed. Steps the core only in resolve and settle, and
    /// asks the AI to play, off the main thread, once its think pose is over.
    func advance(milliseconds ms: Int) {
        guard isRunning, ms > 0, !isBusy else { return }
        guard !holdTurns else { return }
        if lastPhase == "plan", lastAwaiting == "ai", handoffTo == nil {
            thinkElapsed += ms
            if thinkElapsed >= thinkMs {
                thinkElapsed = 0
                dirty = true
                let json = CoreCommand.aiTurn().jsonString()
                host.background { bridge in _ = bridge.command(json) }
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
        _ = host.sync { $0.step(ticks) }
        dirty = true
    }

    /// The newest frame only when something can have changed: a command was
    /// sent, shells fly or settle, or slow work just finished. Nil otherwise,
    /// and while the core queue is busy.
    func frameIfNeeded() -> BattleSnapshot? {
        guard isRunning, !isBusy else { return nil }
        guard dirty || lastPhase == "resolve" || lastPhase == "settle" else { return nil }
        return frame()
    }

    /// The newest frame, or nil when no battle runs, the core queue is busy or
    /// the core sent nothing readable (then `fault` is set).
    func frame() -> BattleSnapshot? {
        guard isRunning, !isBusy else { return nil }
        dirty = false
        let text = host.sync { $0.snapshot() }
        guard let raw = CoreSnapshot.decode(text), raw.phase != "none" else {
            fault = "The core sent no snapshot."
            return nil
        }
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

    /// The core's state hash (16 hex digits), or nil.
    func stateHash() -> String? {
        guard isRunning, !isBusy else { return nil }
        return CoreReply.decode(host.sync { $0.command(CoreCommand.hash.jsonString()) }).hash
    }

    // MARK: Save and resume

    struct Saved: Codable, Sendable {
        var setup: BattleSetup
        /// The core's `log` reply: every accepted command, a replay.
        var log: String
        var handoffTo: Int?
        /// `cp_version()` at save time and the state hash after the last command (H4).
        var rules: Int?
        var sim: String?
        var hash: String?
    }

    enum LoadResult: Equatable, Sendable {
        case ok
        /// The save is not readable.
        case damaged
        /// The save was made under other game rules.
        case rulesChanged
        /// The core refused a command of the replay, or the replay ended elsewhere.
        case replayFailed(String)
    }

    /// The battle in play as bytes the app stores unread: the setup, the core's
    /// command log, the rules version and the state hash.
    func save() -> Data {
        guard isRunning, !isBusy, let setup, lastPhase != "ended" else { return Data() }
        let (logReply, hashReply) = host.sync { b in
            (b.command(CoreCommand.log.jsonString()), b.command(CoreCommand.hash.jsonString()))
        }
        guard let obj = (try? JSONSerialization.jsonObject(with: Data(logReply.utf8))) as? [String: Any],
              obj["ok"] as? Bool == true, let log = obj["log"] as? [Any],
              let logData = try? JSONSerialization.data(withJSONObject: log, options: [.sortedKeys]) else { return Data() }
        let saved = Saved(setup: setup, log: String(decoding: logData, as: UTF8.self), handoffTo: handoffTo,
                          rules: rulesVersion, sim: simVersion, hash: CoreReply.decode(hashReply).hash)
        return (try? JSONEncoder().encode(saved)) ?? Data()
    }

    /// Reads the save's header without replaying it.
    static func header(_ data: Data) -> Saved? {
        try? JSONDecoder().decode(Saved.self, from: data)
    }

    /// Rebuilds a saved battle by replaying its log from the seed on the core
    /// queue, off the main thread. Refuses a save made under other rules and
    /// one whose replay lands on another state hash.
    func load(_ data: Data) async -> LoadResult {
        guard let saved = Self.header(data) else { return .damaged }
        guard saved.rules == rulesVersion else { return .rulesChanged }
        guard start(saved.setup) == nil else { return .replayFailed("setup") }
        let log = saved.log
        let expected = saved.hash
        let outcome = await host.run { bridge in CoreGame.replay(bridge, log: log, expectHash: expected) }
        if let failure = outcome {
            end()
            return .replayFailed(failure)
        }
        handoffTo = saved.handoffTo
        dirty = true
        return .ok
    }

    /// Runs on the core queue. Returns nil on success, else why it failed.
    nonisolated private static func replay(_ bridge: any CoreBridge, log: String, expectHash: String?) -> String? {
        guard let commands = (try? JSONSerialization.jsonObject(with: Data(log.utf8))) as? [Any] else { return "log" }
        for item in commands {
            guard let obj = item as? [String: Any],
                  let bytes = try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys]) else { continue }
            runUntilInput(bridge)
            let reply = CoreReply.decode(bridge.command(String(decoding: bytes, as: UTF8.self)))
            if !reply.ok { return reply.reason ?? "refused" }
        }
        runUntilInput(bridge)
        if let expectHash, !expectHash.isEmpty {
            let now = CoreReply.decode(bridge.command(CoreCommand.hash.jsonString())).hash
            if now != expectHash { return "hash" }
        }
        // Drop the replay's events (no sounds for the past), then ask for the whole map again.
        _ = bridge.snapshot()
        _ = bridge.command(CoreCommand.terrainAll.jsonString())
        return nil
    }

    /// Steps until the core waits for input (draft, plan) or the battle is over.
    nonisolated private static func runUntilInput(_ bridge: any CoreBridge) {
        for _ in 0..<4000 {
            let reply = bridge.step(120)
            let phase = ((try? JSONSerialization.jsonObject(with: Data(reply.utf8))) as? [String: Any])?["phase"] as? String
            if phase == nil || phase == "draft" || phase == "plan" || phase == "ended" { return }
        }
    }
}

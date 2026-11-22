import Foundation

/// The one owner of the core handle. Every call to the bridge runs on one
/// serial queue (core/API.md: the core starts no threads; call it from one
/// thread per handle). Quick calls (a command, a snapshot) wait on the queue;
/// slow ones (`ai_turn`, the resume replay) run on it while the main thread
/// keeps drawing, and `isBusy` is true until they finish.
final class CoreHost: @unchecked Sendable {
    let bridge: any CoreBridge
    private let queue = DispatchQueue(label: "castleprotect.core", qos: .userInitiated)
    private let lock = NSLock()
    private var busyCount = 0

    init(bridge: any CoreBridge) {
        self.bridge = bridge
    }

    /// True while slow work runs on the core queue. Callers on the main thread
    /// must not make quick calls then, or they would wait for it.
    var isBusy: Bool {
        lock.lock()
        defer { lock.unlock() }
        return busyCount > 0
    }

    private func setBusy(_ on: Bool) {
        lock.lock()
        busyCount += on ? 1 : -1
        lock.unlock()
    }

    /// A quick call: runs on the core queue and waits for it.
    func sync<T>(_ work: (any CoreBridge) -> T) -> T {
        queue.sync { work(bridge) }
    }

    /// Slow work that returns nothing the caller waits for (the Rival's turn).
    func background(_ work: @escaping @Sendable (any CoreBridge) -> Void) {
        setBusy(true)
        queue.async {
            work(self.bridge)
            self.setBusy(false)
        }
    }

    /// Slow work whose result the caller awaits (the resume replay).
    func run<T: Sendable>(_ work: @escaping @Sendable (any CoreBridge) -> T) async -> T {
        setBusy(true)
        return await withCheckedContinuation { (cont: CheckedContinuation<T, Never>) in
            queue.async {
                let result = work(self.bridge)
                self.setBusy(false)
                cont.resume(returning: result)
            }
        }
    }

    /// Blocks until every queued job has finished. Tests use it after `ai_turn`.
    func waitUntilIdle() {
        queue.sync {}
    }
}

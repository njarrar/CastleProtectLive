import Foundation

/// The one thread every core call runs on (review 2, M2).
///
/// `core/API.md`: the core starts no threads; call a handle only from the
/// thread that made it (a debug build refuses another with `wrong_thread`).
/// A `DispatchQueue` is serial but not one thread: `sync` runs on the caller's
/// thread and `async` on any worker. This is one real `Thread` that runs its
/// jobs in order, so `cp_new`, every command, the Rival's turn, the resume
/// replay and the per-thread `cp_last_error(NULL)` all share it.
final class CoreThread: @unchecked Sendable {
    private let condition = NSCondition()
    private var jobs: [() -> Void] = []
    private var finishing = false
    /// Set once in `init`, before the thread starts.
    private(set) var thread: Thread?

    init() {
        let t = Thread { [self] in self.loop() }
        t.name = "castleprotect.core"
        t.qualityOfService = .userInitiated
        // 8 MB: a long replay or an `ai_turn` search must not hit the small default stack of a secondary thread.
        t.stackSize = 8 << 20
        thread = t
        t.start()
    }

    /// True when called on this thread.
    var isCurrent: Bool { Thread.current === thread }

    private func loop() {
        while true {
            condition.lock()
            while jobs.isEmpty && !finishing { condition.wait() }
            if jobs.isEmpty && finishing {
                condition.unlock()
                return
            }
            let job = jobs.removeFirst()
            condition.unlock()
            autoreleasepool { job() }
        }
    }

    /// Queues a job; jobs run one at a time, in the order they were queued.
    func enqueue(_ job: @escaping () -> Void) {
        condition.lock()
        jobs.append(job)
        condition.signal()
        condition.unlock()
    }

    /// Runs the jobs already queued, then ends the thread.
    func finish() {
        condition.lock()
        finishing = true
        condition.signal()
        condition.unlock()
    }
}

/// The one owner of the core handle. Every call to the bridge runs on one
/// `CoreThread`. Quick calls (a command, a snapshot) wait for it; slow ones
/// (`ai_turn`, the resume replay) run on it while the main thread keeps
/// drawing, and `isBusy` is true until they finish.
final class CoreHost: @unchecked Sendable {
    let bridge: any CoreBridge
    private let thread = CoreThread()
    private let lock = NSLock()
    private var busyCount = 0

    init(bridge: any CoreBridge) {
        self.bridge = bridge
    }

    deinit {
        // The handle is freed on its own thread too, then the thread ends.
        let bridge = self.bridge
        thread.enqueue { bridge.end() }
        thread.finish()
    }

    /// True on the core thread (tests).
    var isOnCoreThread: Bool { thread.isCurrent }

    /// True while slow work runs on the core thread. Callers on the main thread
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

    /// A quick call: runs on the core thread and waits for it.
    func sync<T>(_ work: @escaping (any CoreBridge) -> T) -> T {
        if thread.isCurrent { return work(bridge) }
        let done = DispatchSemaphore(value: 0)
        var result: T?
        let bridge = self.bridge
        thread.enqueue {
            result = work(bridge)
            done.signal()
        }
        done.wait()
        switch result {
        case .some(let value): return value
        case .none: preconditionFailure("the core thread did not run the call")
        }
    }

    /// Slow work that returns nothing the caller waits for (the Rival's turn).
    func background(_ work: @escaping @Sendable (any CoreBridge) -> Void) {
        setBusy(true)
        let bridge = self.bridge
        thread.enqueue {
            work(bridge)
            self.setBusy(false)
        }
    }

    /// Slow work whose result the caller awaits (the resume replay).
    func run<T: Sendable>(_ work: @escaping @Sendable (any CoreBridge) -> T) async -> T {
        setBusy(true)
        let bridge = UncheckedBox(self.bridge)
        return await withCheckedContinuation { (cont: CheckedContinuation<T, Never>) in
            thread.enqueue {
                let result = work(bridge.value)
                self.setBusy(false)
                cont.resume(returning: result)
            }
        }
    }

    /// Blocks until every queued job has finished. Tests use it after `ai_turn`.
    func waitUntilIdle() {
        sync { _ in () }
    }
}

/// A value shared between the core thread and the main thread under a lock.
final class LockedValue<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: T

    init(_ value: T) { self.value = value }

    func set(_ new: T) {
        lock.lock()
        value = new
        lock.unlock()
    }

    /// Reads the value and puts `reset` in its place.
    func take(reset: T) -> T {
        lock.lock()
        defer { lock.unlock() }
        let out = value
        value = reset
        return out
    }
}

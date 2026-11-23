import Foundation

/// The only door between the app and the game rules: the castle-ffi C ABI
/// (core/API.md) as Swift. Commands go in as JSON, snapshots come out as JSON.
///
/// Two implementations:
///  - `FFICoreBridge`: the shared Rust core, linked from `Frameworks/CastleCore.xcframework`.
///  - `FakeCoreBridge`: a thin player of the core's own fixture files
///    (core/fixtures), for tests, UI tests and builds without the XCFramework.
///
/// One handle at a time. `CoreHost` owns the bridge and makes every call on
/// its one serial queue (the core starts no threads and wants one thread per
/// handle), so nothing else may call a bridge directly.
protocol CoreBridge: AnyObject {
    /// Shown in Settings, About.
    var name: String { get }
    var isStandIn: Bool { get }
    /// `cp_version()`.
    var version: String { get }
    /// `cp_new("", setup, seed)`. Ends any battle in play. Returns nil, or the reason it failed.
    func start(setup: String, seed: UInt64) -> String?
    /// `cp_command`: one command (or a JSON array). Returns the reply JSON.
    func command(_ json: String) -> String
    /// `cp_step`: advance whole 120 Hz ticks. Returns `{"tick":n,"phase":"..."}`.
    func step(_ ticks: Int) -> String
    /// `cp_snapshot`: full or lean. Drains events and dirty terrain chunks.
    func snapshot() -> String
    /// `cp_free` the battle in play.
    func end()
}

#if !DEBUG && !canImport(CastleCoreFFI)
#error("A Release build needs the real core: run scripts/build-xcframework.sh first (Frameworks/CastleCore.xcframework).")
#endif

enum CoreFactory {
    /// The real core when it is linked, else the stand-in. Only Debug builds
    /// may choose the stand-in (UI tests, `-useStandIn`).
    static func make(preferStandIn: Bool) -> any CoreBridge {
        #if canImport(CastleCoreFFI)
        #if DEBUG
        if preferStandIn { return FakeCoreBridge() }
        #endif
        return FFICoreBridge()
        #else
        return FakeCoreBridge()
        #endif
    }

    /// The golden replay hashes from the linked core, or nil with the stand-in.
    static func goldenHashes() -> String? {
        #if canImport(CastleCoreFFI)
        return FFICoreBridge.goldenHashes()
        #else
        return nil
        #endif
    }

    /// Daily Dust-up seed for a local `yyyy-MM-dd` date from the linked core (`cp_daily_seed`),
    /// or a deterministic fallback hash when running on the Debug stand-in.
    static func dailySeed(date: String) -> UInt64 {
        #if canImport(CastleCoreFFI)
        let seed = FFICoreBridge.dailySeed(date)
        if seed != 0 { return seed }
        #endif
        var hash: UInt64 = 14_695_981_039_346_656_037
        for byte in date.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 1_099_511_628_211
        }
        return max(1, hash)
    }

    static var realCoreLinked: Bool {
        #if canImport(CastleCoreFFI)
        return true
        #else
        return false
        #endif
    }
}

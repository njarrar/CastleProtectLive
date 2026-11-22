#if canImport(CastleCoreFFI)
import CastleCoreFFI
import Foundation

/// The Rust core through the castle-ffi C ABI (core/castle-ffi/include/castle_core.h).
///
/// The build makes the `CastleCoreFFI` module from the XCFramework's header
/// (scripts/core-module.sh writes the module map), so this file only compiles
/// when the core is linked. Every string the core returns goes back through
/// `cp_free_string`.
final class FFICoreBridge: CoreBridge {
    let name = "Castle Protect core (Rust)"
    let isStandIn = false
    private var handle: OpaquePointer?

    init() {}

    deinit {
        if let handle { cp_free(handle) }
    }

    var version: String {
        Self.take(cp_version()) ?? "{}"
    }

    func start(setup: String, seed: UInt64) -> String? {
        end()
        let made: OpaquePointer? = "".withCString { content in
            setup.withCString { level in
                cp_new(content, level, seed)
            }
        }
        guard let made else {
            return Self.take(cp_last_error(nil)) ?? "cp_new failed"
        }
        handle = made
        return nil
    }

    func command(_ json: String) -> String {
        guard let handle else { return #"{"ok":false,"reason":"no_battle"}"# }
        return json.withCString { Self.take(cp_command(handle, $0)) } ?? #"{"ok":false,"reason":"null_reply"}"#
    }

    func step(_ ticks: Int) -> String {
        guard let handle, ticks > 0 else { return "{}" }
        return Self.take(cp_step(handle, Int32(clamping: ticks))) ?? "{}"
    }

    func snapshot() -> String {
        guard let handle else { return #"{"phase":"none"}"# }
        return Self.take(cp_snapshot(handle)) ?? #"{"phase":"none"}"#
    }

    func end() {
        if let handle { cp_free(handle) }
        handle = nil
    }

    /// Copies a core string and frees it.
    private static func take(_ p: UnsafeMutablePointer<CChar>?) -> String? {
        guard let p else { return nil }
        defer { cp_free_string(p) }
        return String(cString: p)
    }
}
#endif

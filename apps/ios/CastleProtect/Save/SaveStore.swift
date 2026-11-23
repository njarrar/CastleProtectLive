import Foundation

/// Reads and writes `SaveData` as JSON in Application Support.
///
/// A file from a newer schema is never written over: the store loads
/// defaults and refuses every write until the app is updated (M11). When both
/// files are damaged they are kept as `save.damaged.json` before a fresh save
/// replaces them.
///
/// Writes go to a temp file first and then replace the save in one step, so a
/// kill mid-write never leaves half a file. The previous save is kept as a
/// backup and read if the main file is damaged. Writes run on a serial
/// utility queue, off the frame path.
final class SaveStore: @unchecked Sendable {
    let directory: URL
    private let queue = DispatchQueue(label: "castleprotect.save", qos: .utility)
    private let lock = NSLock()
    private var newerFile = false

    /// True when the save on disk is from a newer app; writes are refused.
    var isNewerSchema: Bool {
        lock.lock()
        defer { lock.unlock() }
        return newerFile
    }

    var fileURL: URL { directory.appendingPathComponent("save.json") }
    var backupURL: URL { directory.appendingPathComponent("save.backup.json") }
    var damagedURL: URL { directory.appendingPathComponent("save.damaged.json") }

    /// - Parameter directory: where the files live. Defaults to
    ///   Application Support/CastleProtect, which the device backup includes.
    init(directory: URL? = nil) {
        if let directory {
            self.directory = directory
        } else {
            let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                ?? URL(fileURLWithPath: NSTemporaryDirectory())
            self.directory = base.appendingPathComponent("CastleProtect", isDirectory: true)
        }
    }

    /// The saved data, or a fresh one when there is none or both files are damaged.
    func load() -> SaveData {
        queue.sync {
            clearStaleTemps()
            let main = read(fileURL)
            let backup: (ok: SaveData?, newer: Bool) = main.ok == nil ? read(backupURL) : (ok: nil, newer: false)
            if main.newer || backup.newer {
                lock.lock()
                newerFile = true
                lock.unlock()
                return SaveData()
            }
            if let data = main.ok { return data }
            if let data = backup.ok { return data }
            // Both damaged (or missing): keep what is there for a look later.
            let fm = FileManager.default
            if fm.fileExists(atPath: fileURL.path) {
                try? fm.removeItem(at: damagedURL)
                try? fm.copyItem(at: fileURL, to: damagedURL)
            }
            return SaveData()
        }
    }

    private func clearStaleTemps() {
        let fm = FileManager.default
        guard let names = try? fm.contentsOfDirectory(atPath: directory.path) else { return }
        for name in names where name.hasPrefix("save.") && name.hasSuffix(".tmp") {
            try? fm.removeItem(at: directory.appendingPathComponent(name))
        }
    }

    /// Queues a write. Later writes always land after earlier ones.
    func write(_ data: SaveData) {
        queue.async { [self] in
            try? self.writeLocked(data)
        }
    }

    /// Waits until every queued write is on disk.
    func flush() {
        queue.sync {}
    }

    /// Writes at once, serialized through the save queue so it never races with queued writes.
    func writeNow(_ data: SaveData) throws {
        try queue.sync {
            try self.writeLocked(data)
        }
    }

    /// Performs the atomic write. Must run only on `queue`.
    private func writeLocked(_ data: SaveData) throws {
        guard !isNewerSchema else { return }
        let fm = FileManager.default
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let bytes = try encoder.encode(data)
        let temp = directory.appendingPathComponent("save.\(UUID().uuidString).tmp")
        try bytes.write(to: temp, options: [.atomic])
        if fm.fileExists(atPath: fileURL.path) {
            if fm.fileExists(atPath: backupURL.path) {
                try? fm.removeItem(at: backupURL)
            }
            try? fm.copyItem(at: fileURL, to: backupURL)
            _ = try fm.replaceItemAt(fileURL, withItemAt: temp)
        } else {
            try fm.moveItem(at: temp, to: fileURL)
        }
    }

    /// Removes every save file. Used by Reset progress and by UI tests.
    func eraseAll() {
        queue.sync {
            try? FileManager.default.removeItem(at: fileURL)
            try? FileManager.default.removeItem(at: backupURL)
        }
    }

    private func read(_ url: URL) -> (ok: SaveData?, newer: Bool) {
        guard let bytes = try? Data(contentsOf: url) else { return (nil, false) }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = try? decoder.decode(SaveData.self, from: bytes) else { return (nil, false) }
        if data.schema > SaveData.currentSchema { return (nil, true) }
        return (data, false)
    }
}

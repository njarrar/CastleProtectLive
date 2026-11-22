import Foundation

/// Reads and writes `SaveData` as JSON in Application Support.
///
/// Writes go to a temp file first and then replace the save in one step, so a
/// kill mid-write never leaves half a file. The previous save is kept as a
/// backup and read if the main file is damaged. Writes run on a serial
/// utility queue, off the frame path.
final class SaveStore: Sendable {
    let directory: URL
    private let queue = DispatchQueue(label: "castleprotect.save", qos: .utility)

    var fileURL: URL { directory.appendingPathComponent("save.json") }
    var backupURL: URL { directory.appendingPathComponent("save.backup.json") }

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
        if let data = read(fileURL) { return data }
        if let data = read(backupURL) { return data }
        return SaveData()
    }

    /// Queues a write. Later writes always land after earlier ones.
    func write(_ data: SaveData) {
        queue.async { [self] in
            try? self.writeNow(data)
        }
    }

    /// Waits until every queued write is on disk.
    func flush() {
        queue.sync {}
    }

    /// Writes at once on the calling thread. Used by tests and by `write`.
    func writeNow(_ data: SaveData) throws {
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

    private func read(_ url: URL) -> SaveData? {
        guard let bytes = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(SaveData.self, from: bytes)
    }
}

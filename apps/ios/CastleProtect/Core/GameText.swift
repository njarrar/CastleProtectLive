import Foundation

/// Every line a player reads or hears read out, from `content/text.json` (see content/text.md).
///
/// Keys are dotted paths (`results.loss.title.kettle_pop`). A string is a line, a list of
/// strings is a pool (one at random, not the same one twice running), and a key whose
/// children are `one` and `other` is a plural. Placeholders are plain words in braces
/// (`{hob}`, `{n}`). Keys that start with `_` are notes for people and are never loaded.
///
/// Read once from the bundle. Thread safe: the only mutable state is the last pick per
/// pool, kept behind a lock.
final class GameText: @unchecked Sendable {
    enum Entry: Equatable, Sendable {
        case line(String)
        case pool([String])
    }

    static let shared = GameText.load()

    private let entries: [String: Entry]
    private let lock = NSLock()
    private var lastPick: [String: Int] = [:]

    init(entries: [String: Entry]) {
        self.entries = entries
    }

    var isEmpty: Bool { entries.isEmpty }

    // MARK: Loading

    /// Reads `content/text.json` from the bundle. An empty table when it is missing: every
    /// lookup then gives its fallback.
    static func load(bundle: Bundle = .main) -> GameText {
        let url = bundle.url(forResource: "text", withExtension: "json", subdirectory: "content")
            ?? bundle.url(forResource: "text", withExtension: "json")
        guard let url, let data = try? Data(contentsOf: url) else { return GameText(entries: [:]) }
        return parse(data) ?? GameText(entries: [:])
    }

    /// Parses the JSON text of `text.json`, or nil when it is not a JSON object.
    static func parse(_ data: Data) -> GameText? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        var out: [String: Entry] = [:]
        flatten(root, prefix: "", into: &out)
        return GameText(entries: out)
    }

    private static func flatten(_ dict: [String: Any], prefix: String, into out: inout [String: Entry]) {
        for (key, value) in dict where !key.hasPrefix("_") {
            let path = prefix.isEmpty ? key : prefix + "." + key
            if let s = value as? String {
                out[path] = .line(s)
            } else if let list = value as? [Any] {
                let lines = list.compactMap { $0 as? String }
                if !lines.isEmpty { out[path] = .pool(lines) }
            } else if let child = value as? [String: Any] {
                flatten(child, prefix: path, into: &out)
            }
        }
    }

    // MARK: Lookup

    /// True when the key holds a line or a pool.
    func has(_ key: String) -> Bool { entries[key] != nil }

    /// The line at `key` with its placeholders filled. A pool gives one line at random.
    /// A missing key gives `fallback`, filled the same way.
    func t(_ key: String, _ vars: [String: any CustomStringConvertible] = [:], or fallback: String = "") -> String {
        switch entries[key] {
        case .line(let s): return Self.fill(s, vars)
        case .pool: return pick(key, vars, or: fallback)
        case nil: return Self.fill(fallback, vars)
        }
    }

    /// The line at `key`, or nil when the key is missing, the line is empty, or a
    /// placeholder in it has no value in `vars`.
    func complete(_ key: String, _ vars: [String: any CustomStringConvertible] = [:]) -> String? {
        guard has(key) else { return nil }
        let s = t(key, vars)
        if s.isEmpty || Self.hasPlaceholder(s) { return nil }
        return s
    }

    /// One line from the pool at `key`, never the same as last time when the pool has more
    /// than one. A plain line is given as it is.
    func pick(_ key: String, _ vars: [String: any CustomStringConvertible] = [:], or fallback: String = "") -> String {
        switch entries[key] {
        case .line(let s):
            return Self.fill(s, vars)
        case .pool(let lines):
            guard !lines.isEmpty else { return Self.fill(fallback, vars) }
            var i = Int.random(in: 0..<lines.count)
            lock.lock()
            if lines.count > 1, let last = lastPick[key], last == i {
                i = (i + 1 + Int.random(in: 0..<(lines.count - 1))) % lines.count
            }
            lastPick[key] = i
            lock.unlock()
            return Self.fill(lines[i], vars)
        case nil:
            return Self.fill(fallback, vars)
        }
    }

    /// The whole pool at `key` (a plain line is a pool of one), or [].
    func pool(_ key: String) -> [String] {
        switch entries[key] {
        case .line(let s): return [s]
        case .pool(let lines): return lines
        case nil: return []
        }
    }

    /// A plural: `key.one` when `n` is 1, else `key.other`. `{n}` is filled with `n`.
    func plural(_ key: String, _ n: Int, _ vars: [String: any CustomStringConvertible] = [:], or fallback: String = "") -> String {
        var all = vars
        all["n"] = n
        let sub = n == 1 && has(key + ".one") ? key + ".one" : key + ".other"
        if has(sub) { return t(sub, all) }
        return t(key, all, or: fallback)
    }

    /// The line for an id the core sends (`group.<id>`), else `group.default`, else `fallback`.
    func byId(_ group: String, _ id: String, _ vars: [String: any CustomStringConvertible] = [:], or fallback: String = "") -> String {
        let key = group + "." + id
        if has(key) { return t(key, vars) }
        return t(group + ".default", vars, or: fallback)
    }

    // MARK: Names

    /// A Hob's short name (`hobs.<id>.short`). Falls back to the content name, never cut at a space.
    func hobShort(_ id: String, name: String = "") -> String {
        if let s = complete("hobs.\(id).short") { return s }
        return name.isEmpty ? id : name
    }

    /// A Rival's key in `rivals` for a display name (the name the level file carries), or nil.
    func rivalKey(named name: String) -> String? {
        guard !name.isEmpty else { return nil }
        let suffix = ".name"
        let wanted = Entry.line(name)
        let match = entries.first { (pair: (key: String, value: Entry)) -> Bool in
            guard pair.key.hasPrefix("rivals."), pair.key.hasSuffix(suffix) else { return false }
            guard pair.value == wanted else { return false }
            return pair.key.split(separator: ".").count == 3
        }
        guard let key = match?.key else { return nil }
        return String(key.dropFirst("rivals.".count).dropLast(suffix.count))
    }

    /// A Rival's short name: `rivals.<key>.short` for that name, else the name as given.
    func rivalShort(_ name: String) -> String {
        if let key = rivalKey(named: name), let s = complete("rivals.\(key).short") { return s }
        return name
    }

    // MARK: Placeholders

    /// Swaps each `{word}` that has a value in `vars`. Others stay as they are.
    static func fill(_ s: String, _ vars: [String: any CustomStringConvertible]) -> String {
        guard !vars.isEmpty, s.contains("{") else { return s }
        var out = s
        for (k, v) in vars {
            out = out.replacingOccurrences(of: "{" + k + "}", with: v.description)
        }
        return out
    }

    /// True when the line still holds a `{word}` placeholder.
    static func hasPlaceholder(_ s: String) -> Bool {
        guard let open = s.firstIndex(of: "{") else { return false }
        return s[open...].contains("}")
    }
}

/// Shorthand for `GameText.shared.t(key, vars)`: a line from content/text.json.
func tx(_ key: String, _ vars: [String: any CustomStringConvertible] = [:]) -> String {
    GameText.shared.t(key, vars)
}

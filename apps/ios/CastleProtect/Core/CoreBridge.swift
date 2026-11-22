import Foundation

/// The only door between the app and the game rules.
///
/// The app sends commands as JSON and reads frame snapshots as JSON. It never
/// computes rules itself. Two implementations exist:
///  - `FFICoreBridge`: the shared Rust core through the castle-ffi C ABI,
///    linked from `Frameworks/CastleCore.xcframework`.
///  - `FakeCoreBridge`: a small stand-in, used by tests, by UI tests and when
///    the XCFramework is not in the build, so the screens can be built first.
///
/// Calls are made from the main actor only (the battle driver, the menus and
/// the save code all run there), so implementations need no locks.
protocol CoreBridge: AnyObject {
    /// Shown in Settings, About.
    var name: String { get }
    /// True for the stand-in, so the app can say so in About.
    var isStandIn: Bool { get }
    /// One command, for example `{"cmd":"aim","angle":620,"power":74}`.
    /// Returns `{"ok":true}` or `{"ok":false,"reason":"key"}`.
    func command(_ json: Data) -> Data
    /// Advance the sim by wall-clock milliseconds. The core steps whole 120 Hz ticks.
    func advance(milliseconds: Int)
    /// The current frame snapshot. Events in it are drained by this call.
    func snapshot() -> Data
    /// Menu data off the hot path: `{"q":"campaign"}`, `{"q":"maps"}`.
    func query(_ json: Data) -> Data
    /// The battle in play, if any, as opaque bytes the app stores unread.
    func save() -> Data
    /// Restores from `save()` output. Returns false if the bytes were refused.
    func load(_ data: Data) -> Bool
}

extension CoreBridge {
    @discardableResult
    func send(_ command: CoreCommand) -> CommandReply {
        CommandReply.decode(self.command(command.jsonData()))
    }

    func currentSnapshot() -> BattleSnapshot? {
        try? BattleSnapshot.decode(snapshot())
    }

    func campaign(pennants: [String: Int]) -> CampaignView {
        let q: [String: Any] = ["q": "campaign", "pennants": pennants]
        let data = (try? JSONSerialization.data(withJSONObject: q, options: [.sortedKeys])) ?? Data()
        let reply = query(data)
        if let view = try? JSONDecoder().decode(CampaignView.self, from: reply), !view.levels.isEmpty {
            return view
        }
        return CampaignView(region: "Puddingstone Downs", levels: [])
    }

    func maps() -> [MapChoice] {
        let reply = query(Data(#"{"q":"maps"}"#.utf8))
        if let list = try? JSONDecoder().decode([MapChoice].self, from: reply), !list.isEmpty {
            return list
        }
        return MapChoice.fallback
    }
}

struct MapChoice: Decodable, Equatable, Sendable, Identifiable, Hashable {
    var id: String
    var name: String

    init(id: String, name: String) {
        self.id = id; self.name = name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.value(.id, "")
        name = c.value(.name, "")
    }

    static let fallback: [MapChoice] = [
        MapChoice(id: "two_tumps", name: "Two Tumps"),
        MapChoice(id: "breezy_tops", name: "Breezy Tops"),
        MapChoice(id: "loaf_hill", name: "Over Loaf Hill"),
    ]

    private enum CodingKeys: String, CodingKey { case id, name }
}

enum CoreFactory {
    /// The real core when it is linked, else the stand-in.
    static func make(preferStandIn: Bool) -> any CoreBridge {
        #if canImport(CastleCoreLink)
        if !preferStandIn, let core = FFICoreBridge() {
            return core
        }
        #endif
        return FakeCoreBridge()
    }

    static var realCoreLinked: Bool {
        #if canImport(CastleCoreLink)
        return true
        #else
        return false
        #endif
    }
}

import SpriteKit
import UIKit

/// Sprite data from assets/: the @2x atlas pages (castle@2x.json lists them,
/// each page is `{image, size, scale, frames: {name: {x, y, w, h}}}`) and the
/// manifest (size and anchor per sprite, in px at @1x from the top left).
///
/// The build copies `assets/atlas`, `assets/sprites` and `assets/manifest.json`
/// into the app bundle (see project.yml). If they are missing the battle view
/// falls back to plain shapes, so the app still runs.
struct AtlasPage: Decodable {
    var image: String
    var size: Double
    var scale: Double
    var frames: [String: AtlasRect]
}

struct AtlasRect: Decodable {
    var x: Double
    var y: Double
    var w: Double
    var h: Double
}

struct AtlasIndex: Decodable {
    var scale: Double
    var pages: [String]
}

struct SpriteManifest: Decodable {
    struct Entry: Decodable {
        var name: String
        var w: Double
        var h: Double
        var anchor: [Double]
    }
    var sprites: [Entry]
}

/// The atlas pages as SpriteKit textures, with each frame's @1x size and anchor.
/// Used only on the main thread by the battle view.
@MainActor
final class SpriteSheet {
    struct Frame {
        let texture: SKTexture
        /// Size in px at @1x.
        let size: CGSize
        /// Anchor in px at @1x from the top left.
        let anchor: CGPoint
    }

    private static var cached: SpriteSheet?
    private let frames: [String: Frame]

    var isEmpty: Bool { frames.isEmpty }

    /// One sheet per process; the pages stay loaded between battles.
    static func shared() -> SpriteSheet {
        if let cached { return cached }
        let sheet = SpriteSheet(bundle: .main)
        cached = sheet
        return sheet
    }

    init(bundle: Bundle) {
        let manifest = Self.loadManifest(bundle: bundle)
        var frames: [String: Frame] = [:]
        let decoder = JSONDecoder()
        if let indexURL = Self.url(bundle, "castle@2x", "json", dir: "atlas"),
           let indexData = try? Data(contentsOf: indexURL),
           let index = try? decoder.decode(AtlasIndex.self, from: indexData) {
            for pageName in index.pages {
                let base = (pageName as NSString).deletingPathExtension
                guard let pageURL = Self.url(bundle, base, "json", dir: "atlas"),
                      let pageData = try? Data(contentsOf: pageURL),
                      let page = try? decoder.decode(AtlasPage.self, from: pageData) else { continue }
                let imageBase = (page.image as NSString).deletingPathExtension
                guard let imageURL = Self.url(bundle, imageBase, "png", dir: "atlas"),
                      let imageData = try? Data(contentsOf: imageURL),
                      let image = UIImage(data: imageData) else { continue }
                let pageTexture = SKTexture(image: image)
                pageTexture.filteringMode = .linear
                let size = max(1, page.size)
                let scale = max(1, page.scale)
                for (name, r) in page.frames {
                    // SpriteKit texture rects are unit coordinates from the bottom left.
                    let unit = CGRect(x: r.x / size, y: 1 - (r.y + r.h) / size, width: r.w / size, height: r.h / size)
                    let texture = SKTexture(rect: unit, in: pageTexture)
                    texture.filteringMode = .linear
                    let entry = manifest[name]
                    let size1x = CGSize(width: entry?.w ?? r.w / scale, height: entry?.h ?? r.h / scale)
                    let anchor: CGPoint
                    if let a = entry?.anchor, a.count >= 2 {
                        anchor = CGPoint(x: a[0], y: a[1])
                    } else {
                        anchor = CGPoint(x: size1x.width / 2, y: size1x.height / 2)
                    }
                    frames[name] = Frame(texture: texture, size: size1x, anchor: anchor)
                }
            }
        }
        self.frames = frames
    }

    func frame(_ name: String) -> Frame? { frames[name] }

    private static func loadManifest(bundle: Bundle) -> [String: SpriteManifest.Entry] {
        guard let url = bundle.url(forResource: "manifest", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let m = try? JSONDecoder().decode(SpriteManifest.self, from: data) else { return [:] }
        var out: [String: SpriteManifest.Entry] = [:]
        for e in m.sprites { out[e.name] = e }
        return out
    }

    private static func url(_ bundle: Bundle, _ name: String, _ ext: String, dir: String) -> URL? {
        bundle.url(forResource: name, withExtension: ext, subdirectory: dir)
            ?? bundle.url(forResource: name, withExtension: ext)
    }
}

/// Single sprites from assets/sprites for the SwiftUI HUD (portraits, shot
/// icons, Class icons, crests, Pennants). Loads the @2x file at scale 2.
@MainActor
enum SpriteImages {
    private static var cache: [String: UIImage] = [:]
    private static var missing: Set<String> = []

    static func image(_ name: String) -> UIImage? {
        if let img = cache[name] { return img }
        if missing.contains(name) { return nil }
        let bundle = Bundle.main
        let url = bundle.url(forResource: "\(name)@2x", withExtension: "png", subdirectory: "sprites")
            ?? bundle.url(forResource: name, withExtension: "png", subdirectory: "sprites")
        guard let url, let data = try? Data(contentsOf: url),
              let img = UIImage(data: data, scale: url.lastPathComponent.contains("@2x") ? 2 : 1) else {
            missing.insert(name)
            return nil
        }
        cache[name] = img
        return img
    }

    /// Hob art names: marge, quill, jax, grub, bobbin, hetty, thumper, nan.
    nonisolated static let hobNames = ["marge", "quill", "jax", "grub", "bobbin", "hetty", "thumper", "nan"]

    /// The art name for a Hob from its core id or name ("hob_marge", "Marge Dumpling", "Old Thumper").
    nonisolated static func hobArtName(id: String, name: String) -> String? {
        let hay = (id + " " + name).lowercased()
        return hobNames.first { hay.contains($0) }
    }

    nonisolated static func team(_ side: Int) -> String { side == 0 ? "blue" : "orange" }

    static func portrait(id: String, name: String, side: Int) -> UIImage? {
        guard let art = hobArtName(id: id, name: name) else { return nil }
        return image("portrait_\(art)_\(team(side))")
    }

    /// Tray icon for a shot chip: `icon_<id>`, else by kind.
    static func shotIcon(_ chip: ShotChip) -> UIImage? {
        let key = chip.id.replacingOccurrences(of: "shell_", with: "")
        if let img = image("icon_\(key)") { return img }
        switch chip.kind {
        case "plain": return image("icon_clodpot")
        case "doodad": return image("icon_mend_bucket")
        default: return nil
        }
    }

    static func classIcon(_ cls: String) -> UIImage? {
        image("ui_class_\(cls == "scatterjack" ? "scatter" : cls)")
    }
}

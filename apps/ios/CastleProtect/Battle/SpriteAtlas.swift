import SpriteKit
import UIKit

/// Sprite data from assets/: the @2x atlas pages (`castle@2x.json` lists them;
/// each page is `{image, size, scale, trimmed?, dedupHobs?, frames: {name: {x, y, w, h, trim?, sourceSize?, scale?}}}`)
/// and the manifest (size and anchor per sprite, in px at @1x from the top left).
///
/// Supports both legacy untrimmed atlases and Part 2 `--v2` trimmed + deduplicated
/// atlases (`aliases`, `overlays`, per-frame `trim` / `sourceSize` / `scale`).
/// If assets are missing the battle view falls back to bespoke procedural textures/shapes.
struct AtlasPage: Decodable, Sendable {
    var image: String
    var size: Double
    var scale: Double
    var trimmed: Bool?
    var dedupHobs: Bool?
    var frames: [String: AtlasRect]
}

struct AtlasRect: Decodable, Sendable {
    var x: Double
    var y: Double
    var w: Double
    var h: Double
    /// Tight alpha-bbox `[tx, ty, tw, th]` in frame-scale pixels when `--trim` / `--v2` is active.
    var trim: [Double]?
    /// Original untrimmed `[origW, origH]` in frame-scale pixels when trimmed.
    var sourceSize: [Double]?
    /// Optional per-frame pixel scale override (e.g. `1` for `--v2` character sprites on a `@2x` page).
    var scale: Double?
}

/// Overlay sprite transform in `@1x` pixels relative to the host sprite's feet anchor (y down in JSON).
struct SpriteOverlay: Decodable, Equatable, Sendable {
    var sprite: String
    var dx: Double
    var dy: Double
    var rot: Double?
    var scale: Double?
}

struct AtlasIndex: Decodable, Sendable {
    var scale: Double
    var v2: Bool?
    var trimmed: Bool?
    var dedupHobs: Bool?
    var pages: [String]
    var scarfOverlays: [String]?
    var aliases: [String: String]?
    var overlays: [String: [SpriteOverlay]]?
}

struct SpriteManifest: Decodable, Sendable {
    struct Entry: Decodable, Sendable {
        var name: String
        var w: Double
        var h: Double
        var anchor: [Double]
    }
    struct Dedup: Decodable, Sendable {
        var mode: String?
        var aliases: [String: String]?
        var overlays: [String: [SpriteOverlay]]?
    }
    var sprites: [Entry]
    var dedup: Dedup?
}

/// The atlas pages as SpriteKit textures, with each frame's `@1x` size, trim rect,
/// anchor, alias map, and `--v2` scarf/badge overlay table.
/// Used only on the main thread by the battle view.
@MainActor
final class SpriteSheet {
    struct Frame {
        let texture: SKTexture
        /// Untrimmed source size in px at `@1x`.
        let size: CGSize
        /// Drawn subrect size in px at `@1x` (trimmed bbox when trimmed, else `size`).
        let drawSize: CGSize
        /// Trim offset `(tx / fs, ty / fs)` from original untrimmed top-left in px at `@1x`.
        let trimOffset: CGPoint
        /// Untrimmed anchor in px at `@1x` from the top left.
        let anchor: CGPoint
        /// True when the atlas frame stores a tightly trimmed alpha subrect.
        let isTrimmed: Bool

        init(texture: SKTexture, size: CGSize, anchor: CGPoint,
             drawSize: CGSize? = nil, trimOffset: CGPoint = .zero, isTrimmed: Bool = false) {
            self.texture = texture
            self.size = size
            self.drawSize = drawSize ?? size
            self.trimOffset = trimOffset
            self.anchor = anchor
            self.isTrimmed = isTrimmed
        }

        /// Computes the SpriteKit `anchorPoint` (unit coordinates, origin bottom-left) for `drawSize`
        /// so the trimmed sprite aligns pixel-accurately with the original untrimmed anchor.
        func spriteKitAnchor(untrimmedAnchor: CGPoint? = nil) -> CGPoint {
            let a = untrimmedAnchor ?? anchor
            let w = max(1, drawSize.width)
            let h = max(1, drawSize.height)
            return CGPoint(x: (a.x - trimOffset.x) / w, y: 1 - (a.y - trimOffset.y) / h)
        }
    }

    private static var cached: SpriteSheet?
    private let frames: [String: Frame]
    private let aliases: [String: String]
    private let overlayTable: [String: [SpriteOverlay]]

    var isEmpty: Bool { frames.isEmpty }
    var isV2: Bool { !aliases.isEmpty || !overlayTable.isEmpty || frames.values.contains(where: \.isTrimmed) }

    /// One sheet per process; the pages stay loaded between battles.
    static func shared() -> SpriteSheet {
        if let cached { return cached }
        let sheet = SpriteSheet(bundle: .main)
        cached = sheet
        return sheet
    }

    init(frames: [String: Frame], aliases: [String: String] = [:], overlays: [String: [SpriteOverlay]] = [:]) {
        self.frames = frames
        self.aliases = aliases
        self.overlayTable = overlays
    }

    init(bundle: Bundle) {
        let (manifest, manifestDedup) = Self.loadManifest(bundle: bundle)
        var frames: [String: Frame] = [:]
        var aliases: [String: String] = manifestDedup?.aliases ?? [:]
        var overlays: [String: [SpriteOverlay]] = manifestDedup?.overlays ?? [:]
        let decoder = JSONDecoder()
        if let indexURL = Self.url(bundle, "castle@2x", "json", dir: "atlas")
                ?? Self.url(bundle, "castle@1x", "json", dir: "atlas"),
           let indexData = try? Data(contentsOf: indexURL),
           let index = try? decoder.decode(AtlasIndex.self, from: indexData) {
            if let idxAliases = index.aliases {
                for (k, v) in idxAliases { aliases[k] = v }
            }
            if let idxOverlays = index.overlays {
                for (k, v) in idxOverlays { overlays[k] = v }
            }
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
                let pageScale = max(1, page.scale)
                for (name, r) in page.frames {
                    // SpriteKit texture rects are unit coordinates from the bottom left.
                    let unit = CGRect(x: r.x / size, y: 1 - (r.y + r.h) / size, width: r.w / size, height: r.h / size)
                    let texture = SKTexture(rect: unit, in: pageTexture)
                    texture.filteringMode = .linear
                    let entry = manifest[name]
                    frames[name] = Self.makeFrame(rect: r, pageScale: pageScale, texture: texture, manifestEntry: entry)
                }
            }
        }
        self.frames = frames
        self.aliases = aliases
        self.overlayTable = overlays
    }

    /// Builds a `Frame` from an `AtlasRect` (supporting legacy untrimmed and `--v2` trimmed/scaled records).
    static func makeFrame(rect r: AtlasRect, pageScale: Double, texture: SKTexture,
                          manifestEntry entry: SpriteManifest.Entry?) -> Frame {
        let fs = max(1, r.scale ?? pageScale)
        let origW: CGFloat
        let origH: CGFloat
        if let src = r.sourceSize, src.count >= 2 {
            origW = CGFloat(src[0] / fs)
            origH = CGFloat(src[1] / fs)
        } else {
            origW = CGFloat(entry?.w ?? (r.w / fs))
            origH = CGFloat(entry?.h ?? (r.h / fs))
        }
        let size1x = CGSize(width: max(1, origW), height: max(1, origH))
        let anchor: CGPoint
        if let a = entry?.anchor, a.count >= 2 {
            anchor = CGPoint(x: a[0], y: a[1])
        } else {
            anchor = CGPoint(x: size1x.width / 2, y: size1x.height / 2)
        }
        if let trim = r.trim, trim.count >= 4 {
            let trimOffset = CGPoint(x: trim[0] / fs, y: trim[1] / fs)
            let drawSize = CGSize(width: max(1, trim[2] / fs), height: max(1, trim[3] / fs))
            return Frame(texture: texture, size: size1x, anchor: anchor,
                         drawSize: drawSize, trimOffset: trimOffset, isTrimmed: true)
        }
        let drawSize = CGSize(width: max(1, r.w / fs), height: max(1, r.h / fs))
        let untrimmedSize = entry != nil ? size1x : drawSize
        return Frame(texture: texture, size: untrimmedSize, anchor: anchor,
                     drawSize: untrimmedSize, trimOffset: .zero, isTrimmed: false)
    }

    /// Resolves a `--v2` deduplicated alias (e.g. `hob_marge_blue_idle_0` -> `hob_marge_neutral_idle_0`).
    func resolveName(_ name: String) -> String {
        aliases[name] ?? name
    }

    func frame(_ name: String) -> Frame? {
        let resolved = aliases[name] ?? name
        return frames[resolved]
    }

    /// Team scarf/balloon overlay entries for a logical sprite name when `--v2` deduplication is active.
    func overlays(for name: String) -> [SpriteOverlay] {
        overlayTable[name] ?? []
    }

    private static func loadManifest(bundle: Bundle) -> ([String: SpriteManifest.Entry], SpriteManifest.Dedup?) {
        guard let url = bundle.url(forResource: "manifest", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let m = try? JSONDecoder().decode(SpriteManifest.self, from: data) else { return ([:], nil) }
        var out: [String: SpriteManifest.Entry] = [:]
        for e in m.sprites { out[e.name] = e }
        return (out, m.dedup)
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
        let def = id.lowercased()
        if hobNames.contains(def) { return def }
        let words = (id + " " + name).lowercased().split { !$0.isLetter }.map(String.init)
        return hobNames.first { words.contains($0) }
    }

    /// Maps an enemy unit's def/class to its Flattener rig key (`snipper`, `rake`, `sniper`, `tamper`, `clerk`, `pump`, `filler`).
    nonisolated static func flattenerArtName(def: String, cls: String) -> String {
        let d = def.lowercased()
        if d.contains("snipper") { return "snipper" }
        if d.contains("rake") { return "rake" }
        if d.contains("pebble") || d.contains("sniper") { return "sniper" }
        if d.contains("mower") || d.contains("tamper") { return "tamper" }
        if d.contains("clerk") || d.contains("straw") || d.contains("dummy") { return "clerk" }
        if d.contains("pump") { return "pump" }
        if d.contains("fill") { return "filler" }
        switch cls.lowercased() {
        case "lobber": return "snipper"
        case "scatterjack": return "rake"
        case "zinger": return "sniper"
        case "delver", "boinker": return "tamper"
        case "peeper": return "clerk"
        case "sizzler": return "pump"
        case "patcher": return "filler"
        default: return "snipper"
        }
    }

    nonisolated static func team(_ side: Int) -> String { side == 0 ? "blue" : "orange" }

    /// The art team: `rival` for a Rival's Hob (the Flattener slate cap and hatched scarf),
    /// else blue or orange. Couch Duel player 2 stays orange.
    nonisolated static func team(_ side: Int, rival: Bool) -> String { rival && side == 1 ? "rival" : team(side) }

    /// A Hob portrait: `portrait_<art>_rival` for a Rival's Hob, else the side's colour, else neutral.
    static func portrait(id: String, name: String, side: Int, rival: Bool = false) -> UIImage? {
        guard let art = hobArtName(id: id, name: name) else { return nil }
        if rival && side == 1, let img = image("portrait_\(art)_rival") { return img }
        return image("portrait_\(art)_\(team(side))")
            ?? image("portrait_\(art)_neutral")
    }

    static func flattenerPortrait(def: String, cls: String) -> UIImage? {
        image("portrait_flattener_\(flattenerArtName(def: def, cls: cls))")
    }

    /// Tray icon for a shot chip: `icon_<shot id>` (with `extra_shake` / `gravel` alias handling).
    /// Returns nil when missing so `KnackFallbackIcon` renders bespoke vector artwork instead of a wrong placeholder.
    static func shotIcon(_ chip: ShotChip) -> UIImage? {
        var keys = [chip.art, chip.id]
        if chip.art == "extra_shake" || chip.id == "extra_shake" {
            keys.append("gravel_sneeze")
            keys.append("gravel")
        } else if chip.art == "gravel_sneeze" || chip.id == "gravel_sneeze" {
            keys.append("gravel")
        }
        for key in keys where !key.isEmpty {
            if let img = image("icon_\(key)") { return img }
        }
        return nil
    }

    static func classIcon(_ cls: String) -> UIImage? {
        image("ui_class_\(cls == "scatterjack" ? "scatter" : cls)")
    }
}

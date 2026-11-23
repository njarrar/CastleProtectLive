import CoreGraphics
import Foundation

/// One animation from assets/animations.json: frames in play order, a time
/// per frame, loop rules, a shared size and anchor, and named events.
/// Pure data plus timing maths; the renderer picks the sprite, the FX
/// director fires the events. Time is view time in ms (hit stop and slow
/// motion change it, the sim never sees it).
struct AnimClip: Equatable, Sendable {
    let name: String
    let frames: [String]
    let ms: [Double]
    let loop: Bool
    /// With `loop`: frames before this index play once, then the loop runs from here.
    let loopFrom: Int
    /// Size and anchor in px at @1x from the top left, shared by every frame.
    let w: Double
    let h: Double
    let anchor: CGPoint
    /// Event name to frame index.
    let events: [String: Int]
    let next: String?
    let hold: String?
    /// A pose set chosen by a value (aim: power), not a timed clip.
    let pick: String?
    /// Idle clips (assets/animations.json): start at a random point in the loop, else at
    /// `startOffsetMs`, so a crew does not breathe in step.
    var randomStart: Bool = false
    var startOffsetMs: Double = 0

    var total: Double { ms.reduce(0, +) }
    private var loopStart: Double { ms.prefix(max(0, min(loopFrom, ms.count))).reduce(0, +) }

    /// Frame index at `t` ms from the start. Play-once clips stay on the last frame.
    func index(at t: Double) -> Int {
        guard !frames.isEmpty else { return 0 }
        var time = max(0, t)
        let total = self.total
        if total <= 0 { return 0 }
        if time >= total {
            guard loop else { return frames.count - 1 }
            let start = loopStart
            let span = total - start
            time = span > 0 ? start + (time - total).truncatingRemainder(dividingBy: span) : 0
        }
        var acc = 0.0
        for (i, d) in ms.enumerated() {
            acc += d
            if time < acc { return i }
        }
        return frames.count - 1
    }

    /// The sprite at `t`; for a play-once clip past its end, the `hold` sprite if it has one.
    func frame(at t: Double, reversed: Bool = false) -> String {
        guard !frames.isEmpty else { return hold ?? name }
        if !loop, t >= total, let hold, !reversed { return hold }
        let i = index(at: t)
        return frames[reversed ? frames.count - 1 - i : i]
    }

    func finished(at t: Double) -> Bool { !loop && t >= total }

    /// Indices of every frame that starts in (t0, t1], in order (frame 0 at t0 < 0).
    /// Loops are unrolled, so a long step never skips an event.
    func frameStarts(from t0: Double, to t1: Double) -> [Int] {
        guard t1 > t0, !frames.isEmpty, total > 0 else { return [] }
        var out: [Int] = []
        var start = 0.0
        var i = 0
        var guardCount = 0
        while start <= t1 && guardCount < 400 {
            if start > t0 || (start == 0 && t0 < 0) { out.append(i) }
            start += ms[i]
            i += 1
            if i >= frames.count {
                guard loop else { break }
                i = max(0, min(loopFrom, frames.count - 1))
            }
            guardCount += 1
        }
        return out
    }

    /// Event names that fire in (t0, t1].
    func eventsFired(from t0: Double, to t1: Double) -> [String] {
        guard !events.isEmpty else { return [] }
        let starts = frameStarts(from: t0, to: t1)
        guard !starts.isEmpty else { return [] }
        var out: [String] = []
        for idx in starts {
            for (name, at) in events where at == idx { out.append(name) }
        }
        return out
    }

    /// The pose for a `pick` clip: 0, 1 or 2 for low, mid or full (power 0 to 100).
    func pickFrame(value: Int) -> String {
        guard !frames.isEmpty else { return name }
        let n = frames.count
        let i = min(n - 1, max(0, value * n / 101))
        return frames[i]
    }
}

/// A keyframe track: `[[ms, value], ...]`, straight lines between keys.
struct Track: Equatable, Sendable {
    var keys: [(Double, Double)]

    static func == (a: Track, b: Track) -> Bool {
        a.keys.count == b.keys.count && zip(a.keys, b.keys).allSatisfy { $0.0 == $1.0 && $0.1 == $1.1 }
    }

    init(_ keys: [(Double, Double)]) { self.keys = keys }

    init(json: Any?, fallback: [(Double, Double)] = [(0, 0)]) {
        var out: [(Double, Double)] = []
        for pair in json as? [Any] ?? [] {
            guard let p = pair as? [Any], p.count >= 2 else { continue }
            out.append((Self.num(p[0]), Self.num(p[1])))
        }
        keys = out.isEmpty ? fallback : out
    }

    var duration: Double { keys.last?.0 ?? 0 }

    func value(at t: Double) -> Double {
        guard let first = keys.first else { return 0 }
        if t <= first.0 { return first.1 }
        for i in 1..<keys.count where t <= keys[i].0 {
            let a = keys[i - 1], b = keys[i]
            let span = b.0 - a.0
            return span <= 0 ? b.1 : a.1 + (b.1 - a.1) * (t - a.0) / span
        }
        return keys[keys.count - 1].1
    }

    static func num(_ v: Any) -> Double {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let n = v as? NSNumber { return n.doubleValue }
        return 0
    }
}

/// Motion data with no frames (`data` in animations.json).
struct MotionData: Equatable, Sendable {
    // fort_bob
    var bobFrameMs: Double = 110
    var bobDy: [Double] = [1, -1, 0, 1, -1, 0]
    var bobTilt: [Double] = [0.5, 0.2, -0.3, -0.5, -0.2, 0.3]
    // collapse
    var creakMs: Double = 300
    var shiverX = Track([(0, 0), (50, 1), (100, -1), (150, 1), (200, -1), (250, 1), (300, 0)])
    var wobble: [String: Track] = [:]
    var leanMs: Double = 150
    var leanDeg: [String: Double] = ["wicker": 6, "timber": 5, "cobble": 3, "footing": 0]
    var leanTrack = Track([(0, 0), (100, 0.8), (150, 1)])
    var rowGapMs: Double = 40
    var swayDeg: [String: Double] = ["wicker": 4, "timber": 1.5]
    var landSquash = Track([(0, 1), (60, 0.9), (140, 1.03), (200, 1)])
    var skidPx: [String: Double] = ["cobble": 2]
    var breakMs: Double = 300
    var chunksPerBlock: [String: Int] = ["wicker": 3, "timber": 3, "cobble": 4, "footing": 2]
    var rubbleHoldMs: Double = 1500
    var dustScale: [String: Double] = ["wicker": 0.6, "timber": 0.8, "cobble": 1.2, "footing": 1]
    // turn banner
    var bannerInY = Track([(0, -64), (160, 5), (220, -2), (280, 0)])
    var bannerInOpacity = Track([(0, 0), (120, 1)])
    var bannerHoldMs: Double = 1200
    var bannerOutY = Track([(0, 0), (60, 4), (220, -64)])
    var bannerOutOpacity = Track([(0, 1), (140, 1), (220, 0)])
    var bannerFadeMs: Double = 150
    // hand-off card
    var handoffScale = Track([(0, 0.8), (120, 1.06), (200, 1)])
    var handoffOpacity = Track([(0, 0), (100, 1)])
}

/// Every animation the game plays, read once from `animations.json` in the
/// app bundle (copied from assets/ by the build).
final class AnimationLibrary: @unchecked Sendable {
    let clips: [String: AnimClip]
    let motion: MotionData

    static let shared = AnimationLibrary(bundle: .main)

    var isEmpty: Bool { clips.isEmpty }

    init(bundle: Bundle) {
        let url = bundle.url(forResource: "animations", withExtension: "json")
            ?? bundle.url(forResource: "animations", withExtension: "json", subdirectory: "assets")
        if let url, let data = try? Data(contentsOf: url) {
            let parsed = Self.parse(data)
            clips = parsed.0
            motion = parsed.1
        } else {
            clips = [:]
            motion = MotionData()
        }
    }

    init(data: Data) {
        let parsed = Self.parse(data)
        clips = parsed.0
        motion = parsed.1
    }

    func clip(_ name: String) -> AnimClip? { clips[name] }

    static func parse(_ data: Data) -> ([String: AnimClip], MotionData) {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return ([:], MotionData()) }
        var clips: [String: AnimClip] = [:]
        for (name, value) in root["animations"] as? [String: Any] ?? [:] {
            guard let a = value as? [String: Any], let frames = a["frames"] as? [String], !frames.isEmpty else { continue }
            var ms = (a["ms"] as? [Any] ?? []).map(Track.num)
            if ms.count != frames.count { ms = [Double](repeating: 100, count: frames.count) }
            let anchor = (a["anchor"] as? [Any] ?? []).map(Track.num)
            var events: [String: Int] = [:]
            for (k, v) in a["events"] as? [String: Any] ?? [:] { events[k] = Int(Track.num(v)) }
            clips[name] = AnimClip(
                name: name, frames: frames, ms: ms, loop: a["loop"] as? Bool ?? false,
                loopFrom: Int(Track.num(a["loop_from"] ?? 0)),
                w: Track.num(a["w"] ?? 16), h: Track.num(a["h"] ?? 16),
                anchor: CGPoint(x: anchor.count > 0 ? anchor[0] : 0, y: anchor.count > 1 ? anchor[1] : 0),
                events: events, next: a["next"] as? String, hold: a["hold"] as? String, pick: a["pick"] as? String,
                randomStart: a["random_start"] as? Bool ?? false, startOffsetMs: Track.num(a["start_offset_ms"] ?? 0))
        }
        var m = MotionData()
        let d = root["data"] as? [String: Any] ?? [:]
        if let bob = d["fort_bob"] as? [String: Any] {
            // Never 0: the walk divides by it (L2).
            m.bobFrameMs = max(1, Track.num(bob["frame_ms"] ?? 110))
            let dy = (bob["dy"] as? [Any] ?? []).map(Track.num)
            let tilt = (bob["tilt"] as? [Any] ?? []).map(Track.num)
            if !dy.isEmpty { m.bobDy = dy }
            if !tilt.isEmpty { m.bobTilt = tilt }
        }
        if let c = d["collapse"] as? [String: Any] {
            if let creak = c["creak"] as? [String: Any] {
                m.creakMs = Track.num(creak["ms"] ?? 300)
                m.shiverX = Track(json: creak["shiver_x"])
            }
            if let wob = c["wobble_deg"] as? [String: Any] {
                for (k, v) in wob where k != "about" { m.wobble[k] = Track(json: v) }
            }
            if let lean = c["lean"] as? [String: Any] {
                m.leanMs = Track.num(lean["ms"] ?? 150)
                for (k, v) in lean["deg"] as? [String: Any] ?? [:] { m.leanDeg[k] = Track.num(v) }
                m.leanTrack = Track(json: lean["track"], fallback: [(0, 0), (150, 1)])
            }
            if let drop = c["drop"] as? [String: Any] {
                m.rowGapMs = Track.num(drop["row_gap_ms"] ?? 40)
                for (k, v) in drop["sway_deg"] as? [String: Any] ?? [:] { m.swayDeg[k] = Track.num(v) }
            }
            if let land = c["land"] as? [String: Any] {
                m.landSquash = Track(json: land["squash_y"], fallback: [(0, 1)])
                for (k, v) in land["skid_px"] as? [String: Any] ?? [:] { m.skidPx[k] = Track.num(v) }
            }
            if let brk = c["break"] as? [String: Any] {
                m.breakMs = Track.num(brk["ms"] ?? 300)
                for (k, v) in brk["chunks_per_block"] as? [String: Any] ?? [:] { m.chunksPerBlock[k] = Int(Track.num(v)) }
                m.rubbleHoldMs = Track.num(brk["rubble_hold_ms"] ?? 1500)
                for (k, v) in brk["dust_scale"] as? [String: Any] ?? [:] { m.dustScale[k] = Track.num(v) }
            }
        }
        if let b = d["turn_banner"] as? [String: Any] {
            if let i = b["in"] as? [String: Any] {
                m.bannerInY = Track(json: i["y"])
                m.bannerInOpacity = Track(json: i["opacity"], fallback: [(0, 1)])
            }
            if let o = b["out"] as? [String: Any] {
                m.bannerOutY = Track(json: o["y"])
                m.bannerOutOpacity = Track(json: o["opacity"], fallback: [(0, 1)])
            }
            m.bannerHoldMs = Track.num(b["hold_ms"] ?? 1200)
        }
        if let h = d["hand_off_card"] as? [String: Any], let i = h["in"] as? [String: Any] {
            m.handoffScale = Track(json: i["scale"], fallback: [(0, 1)])
            m.handoffOpacity = Track(json: i["opacity"], fallback: [(0, 1)])
        }
        return (clips, m)
    }
}

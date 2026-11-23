import CoreGraphics
import Foundation

/// Safe-area insets in points, kept free of SwiftUI so layout stays a pure function.
struct Insets: Equatable, Sendable {
    var top: CGFloat = 0
    var left: CGFloat = 0
    var bottom: CGFloat = 0
    var right: CGFloat = 0
}

/// The Wide layout (landscape HUD) or the Tall layout (stacked lenses).
enum LayoutMode: String, Equatable, Sendable {
    case wide, tall

    /// Wide when the width is at least 1.2 times the height. To stop a resize
    /// from flapping, Wide turns Tall under 1.15 and Tall turns Wide over 1.25.
    static func resolve(size: CGSize, previous: LayoutMode?) -> LayoutMode {
        guard size.height > 0 else { return previous ?? .wide }
        let ratio = size.width / size.height
        switch previous {
        case .wide?: return ratio < 1.15 ? .tall : .wide
        case .tall?: return ratio > 1.25 ? .wide : .tall
        case nil: return ratio >= 1.2 ? .wide : .tall
        }
    }
}

/// What a lens keeps in frame. The camera rule is view only and never
/// touches the sim.
enum LensFocus: Equatable, Sendable {
    /// Both forts (Wide layout, Plan step).
    case both
    /// The fort being shot at (Tall layout, Top lens).
    case target
    /// The active fort (Tall layout, Bottom lens).
    case own
    /// Rides with the shell (flight).
    case follow
    /// The whole field, small (Field Strip).
    case whole
}

struct Lens: Equatable, Sendable {
    /// Where the lens draws, in view points.
    var viewport: CGRect
    /// The part of the viewport the camera frames into (the Clear Rect).
    var frame: CGRect
    var focus: LensFocus
    /// The smallest block size (points) at which the plan frame still holds both forts: 6 on a
    /// phone, 8 elsewhere (QA playtest 2, N3). Under it, your fort and a Rival marker.
    var minBlock: CGFloat = 8
}

/// Layout is a pure function of the window size, the safe areas and the
/// turn step. It is never saved and never touches the sim, so a device turn
/// keeps every bit of battle state (UX 2.6.6).
struct BattleLayout: Equatable, Sendable {
    var mode: LayoutMode
    var size: CGSize
    var insets: Insets
    var lenses: [Lens]
    /// Where an Aim Drag may start.
    var aimRegion: CGRect
    /// Tall layout zones; zero in Wide.
    var topStrip: CGRect = .zero
    var fieldStrip: CGRect = .zero
    /// Integrated Portrait Walk + Steam + Readout rail tucked cleanly inside the bottom dock
    /// so the player's lower fort and Stomper legs stay 100% unobstructed (Part 2 Plate 2).
    var walkRail: CGRect = .zero
    var tray: CGRect = .zero
    var crewRow: CGRect = .zero
    /// Where the Fine Tune pad sits: on the side away from the fort of the side the HUD
    /// shows, so it never covers your fort (QA playtest 1, M7). Zero in flight.
    var fineTune: CGRect = .zero
    /// True when the viewport is large enough for the iPad HUD scale (false in narrow Split View / Slide Over).
    var usePadScale: Bool = false

    static let empty = BattleLayout(mode: .wide, size: .zero, insets: Insets(), lenses: [], aimRegion: .zero)

    /// Power 100 is a drag of 40% of the screen's short side, in either layout.
    var powerSpan: CGFloat { max(40, min(size.width, size.height) * 0.4) }

    /// The Fine Tune pad's size for a key size (three columns: angle keys, the readout and
    /// Recall, power keys).
    static func fineTuneSize(key: CGFloat) -> CGSize {
        CGSize(width: key * 2 + 64 + 8 + 12, height: max(key * 2 + 4, 92) + 12)
    }

    /// Fine Tune key size per layout (meets the 48 pt touch target floor across phones and 56 pt on iPad).
    static func fineTuneKey(mode: LayoutMode, isPad: Bool) -> CGFloat {
        isPad ? 56 : 48
    }

    static func compute(size: CGSize, insets: Insets, mode: LayoutMode, inFlight: Bool, isPad: Bool,
                        hudSide: Int = 0, leftHand: Bool = false, reduceMotion: Bool = false,
                        largeText: Bool = false) -> BattleLayout {
        let w = size.width, h = size.height
        guard w > 0, h > 0 else { return .empty }
        let scale: CGFloat = isPad ? 1.25 : 1
        let pad = fineTuneSize(key: fineTuneKey(mode: mode, isPad: isPad))
        // Your fort is on the left for side 0 and on the right for side 1: the pad goes on the other side.
        let padRight = hudSide == 0
        switch mode {
        case .wide:
            let full = CGRect(origin: .zero, size: size)
            let top = insets.top + 36 * scale + 12
            let bottom = insets.bottom + (inFlight ? 16 : 76 * scale)
            let left = insets.left + (inFlight ? 16 : 64 * scale)
            let right = insets.right + 16
            let clear = CGRect(x: left, y: top, width: max(10, w - left - right), height: max(10, h - top - bottom))
            var layout = BattleLayout(mode: .wide, size: size, insets: insets,
                                      lenses: [Lens(viewport: full, frame: clear, focus: inFlight ? .follow : .both,
                                                    minBlock: isPad ? 8 : 6)],
                                      aimRegion: full, usePadScale: isPad)
            if !inFlight {
                // Under the top strip, away from your fort; clear of the crew column when it is on that side.
                let column: CGFloat = (padRight == leftHand) ? 48 * scale + 16 : 0
                let y = insets.top + 36 * scale + 16
                let x = padRight ? w - max(insets.right, 10) - column - pad.width : max(insets.left, 10) + column
                layout.fineTune = CGRect(x: x, y: y, width: pad.width, height: pad.height)
            }
            return layout
        case .tall:
            let stripH: CGFloat = (72 * scale * (largeText ? 1.18 : 1)).rounded()
            let fieldH: CGFloat = 32
            let crewH: CGFloat = 80 * scale
            let trayH: CGFloat = 58 * scale
            let walkRailH: CGFloat = 48 * scale
            let topStrip = CGRect(x: 0, y: insets.top, width: w, height: stripH)
            let crew = CGRect(x: 0, y: h - insets.bottom - crewH, width: w, height: crewH)
            let tray = CGRect(x: 0, y: crew.minY - trayH, width: w, height: trayH)
            let walkRail = CGRect(x: 0, y: tray.minY - walkRailH, width: w, height: walkRailH)
            if inFlight && !reduceMotion {
                let joinedBottom = h - insets.bottom - fieldH
                let joined = CGRect(x: 0, y: topStrip.maxY, width: w, height: max(10, joinedBottom - topStrip.maxY))
                let field = CGRect(x: 0, y: joined.maxY, width: w, height: fieldH)
                return BattleLayout(mode: .tall, size: size, insets: insets,
                                    lenses: [Lens(viewport: joined, frame: joined.insetBy(dx: 8, dy: 8), focus: .follow),
                                             Lens(viewport: field, frame: field.insetBy(dx: 4, dy: 2), focus: .whole)],
                                    aimRegion: .zero, topStrip: topStrip, fieldStrip: field, walkRail: .zero, tray: .zero, crewRow: .zero,
                                    usePadScale: isPad)
            }
            if inFlight {
                // Reduce Motion: keep the Tall split lenses steady during flight without joining or sweeping.
                let bottomEdge = h - insets.bottom
                let avail = max(40, bottomEdge - topStrip.maxY - fieldH)
                let topLens = CGRect(x: 0, y: topStrip.maxY, width: w, height: (avail * 0.42).rounded())
                let field = CGRect(x: 0, y: topLens.maxY, width: w, height: fieldH)
                let bottomLens = CGRect(x: 0, y: field.maxY, width: w, height: max(10, bottomEdge - field.maxY))
                return BattleLayout(mode: .tall, size: size, insets: insets,
                                    lenses: [Lens(viewport: topLens, frame: topLens.insetBy(dx: 8, dy: 8), focus: .target),
                                             Lens(viewport: field, frame: field.insetBy(dx: 4, dy: 2), focus: .whole),
                                             Lens(viewport: bottomLens, frame: bottomLens.insetBy(dx: 8, dy: 8), focus: .own)],
                                    aimRegion: .zero, topStrip: topStrip, fieldStrip: field, walkRail: .zero, tray: .zero, crewRow: .zero,
                                    usePadScale: isPad)
            }
            let avail = max(40, walkRail.minY - topStrip.maxY - fieldH)
            let topLens = CGRect(x: 0, y: topStrip.maxY, width: w, height: (avail * 0.39).rounded())
            let field = CGRect(x: 0, y: topLens.maxY, width: w, height: fieldH)
            let bottomLens = CGRect(x: 0, y: field.maxY, width: w, height: walkRail.minY - field.maxY)
            // Walk, Steam, and Readout sit inside `walkRail` in the bottom dock, so the player's
            // entire cutaway fort and Stomper legs stay 100% unobstructed inside `bottomLens`!
            let bottomFrame = bottomLens.insetBy(dx: 8, dy: 8)
            // Docked cleanly in the Bottom lens away from your fort.
            let padY = max(bottomLens.minY + 4, bottomLens.maxY - 8 - pad.height)
            let padX = padRight ? w - 8 - pad.width : 8
            return BattleLayout(mode: .tall, size: size, insets: insets,
                                lenses: [Lens(viewport: topLens, frame: topLens.insetBy(dx: 8, dy: 8), focus: .target),
                                         Lens(viewport: field, frame: field.insetBy(dx: 4, dy: 2), focus: .whole),
                                         Lens(viewport: bottomLens, frame: bottomFrame, focus: .own)],
                                aimRegion: bottomLens, topStrip: topStrip, fieldStrip: field, walkRail: walkRail,
                                tray: tray, crewRow: crew,
                                fineTune: CGRect(x: padX, y: padY, width: pad.width, height: pad.height),
                                usePadScale: isPad)
        }
    }
}

/// Turns one finger's drag into an angle and power (UX 3.1). Pure input
/// mapping: the core still judges every aim it is sent.
struct AimGesture: Equatable, Sendable {
    static let dragThreshold: CGFloat = 8
    static let cancelRadius: CGFloat = 12

    /// The shortest pull for power 100 when the screen edge is close (QA playtest 1, m3).
    static let minPowerSpan: CGFloat = 64
    /// A finger this close to the screen edge is on the edge.
    static let edgeMargin: CGFloat = 2

    private(set) var anchor: CGPoint
    private(set) var finger: CGPoint
    private(set) var isDragging = false
    /// The pull for power 100: always 40% of the short side, wherever the drag starts, so the
    /// same pull gives the same power. A finger that meets the edge first slides the anchor (slide).
    private(set) var powerSpan: CGFloat
    let mode: DragMode
    /// The screen, so a pull into its edge keeps its angle; nil means no edge rule.
    let bounds: CGRect?
    /// The angle the drag had before the finger met the edge; while on the edge only power follows.
    private(set) var edgeAngle: Int?
    private var lastAngle: Int?

    init(anchor: CGPoint, powerSpan: CGFloat, mode: DragMode, bounds: CGRect? = nil) {
        self.anchor = anchor
        self.finger = anchor
        self.powerSpan = max(1, powerSpan)
        self.mode = mode
        self.bounds = bounds
    }

    var distance: CGFloat { hypot(finger.x - anchor.x, finger.y - anchor.y) }

    /// True when the finger is back inside the cancel ring around the anchor.
    var isInCancelRing: Bool { distance <= Self.cancelRadius }

    /// True when `point` is on the screen edge.
    func isOnEdge(_ point: CGPoint) -> Bool {
        guard let b = bounds else { return false }
        let m = Self.edgeMargin
        return point.x <= b.minX + m || point.x >= b.maxX - m || point.y <= b.minY + m || point.y >= b.maxY - m
    }

    /// Room from the anchor to the screen edge along the direction toward `point`.
    func roomToEdge(toward point: CGPoint) -> CGFloat? {
        guard let b = bounds else { return nil }
        let dx = point.x - anchor.x, dy = point.y - anchor.y
        let len = hypot(dx, dy)
        guard len > 0 else { return nil }
        let ux = dx / len, uy = dy / len
        var t = CGFloat.greatestFiniteMagnitude
        if ux > 0 { t = min(t, (b.maxX - anchor.x) / ux) }
        if ux < 0 { t = min(t, (b.minX - anchor.x) / ux) }
        if uy > 0 { t = min(t, (b.maxY - anchor.y) / uy) }
        if uy < 0 { t = min(t, (b.minY - anchor.y) / uy) }
        return max(0, t - Self.edgeMargin * 2)
    }

    /// Moves the finger. Returns true on the move that turns a touch into a drag.
    mutating func move(to point: CGPoint) -> Bool {
        finger = point
        var started = false
        if !isDragging && distance >= Self.dragThreshold {
            isDragging = true
            started = true
        }
        if isOnEdge(point) && isDragging {
            // On the edge the angle keeps the direction it had; only power follows the finger.
            if edgeAngle == nil { edgeAngle = lastAngle ?? rawAngleTenths }
        } else {
            edgeAngle = nil
            lastAngle = rawAngleTenths
        }
        return started
    }

    /// Edge help (07 section 3.1 step 7): while the finger sits on the screen edge under power 100,
    /// the anchor moves `points` along the shot's direction (pull-back) or against it (point mode),
    /// so the pull keeps growing and the angle keeps its direction. Returns true when it moved.
    mutating func slide(points: CGFloat) -> Bool {
        guard isDragging, isOnEdge(finger), power < 100, let a = edgeAngle else { return false }
        let r = Double(a) / 10 * .pi / 180
        // The shot's direction on screen (y grows down).
        var ux = CGFloat(cos(r)), uy = CGFloat(-sin(r))
        if mode != .pullBack { ux = -ux; uy = -uy }
        anchor = CGPoint(x: anchor.x + ux * points, y: anchor.y + uy * points)
        return true
    }

    /// Angle in tenths of a degree, snapped to 0.5 degree, 0 right to 1800 left.
    var angleTenths: Int { edgeAngle ?? rawAngleTenths }

    /// The angle from the anchor to the finger, edge or not.
    private var rawAngleTenths: Int {
        var dx = finger.x - anchor.x
        var dy = finger.y - anchor.y
        if mode == .pullBack { dx = -dx; dy = -dy }
        // Screen y grows down; the world's angle grows up.
        var degrees = atan2(-dy, dx) * 180 / .pi
        if degrees < 0 { degrees = degrees < -90 ? 180 : 0 }
        let halfSteps = (degrees * 2).rounded()
        return min(1800, max(0, Int(halfSteps) * 5))
    }

    /// Power 0 to 100, whole numbers. Past 100 the band stops stretching.
    var power: Int {
        min(100, max(0, Int((distance / powerSpan * 100).rounded())))
    }

    /// The finger point clamped to the 100-power band, for drawing.
    var bandEnd: CGPoint {
        let d = distance
        guard d > powerSpan else { return finger }
        let k = powerSpan / d
        return CGPoint(x: anchor.x + (finger.x - anchor.x) * k, y: anchor.y + (finger.y - anchor.y) * k)
    }
}

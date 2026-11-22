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
    var tray: CGRect = .zero
    var crewRow: CGRect = .zero

    static let empty = BattleLayout(mode: .wide, size: .zero, insets: Insets(), lenses: [], aimRegion: .zero)

    /// Power 100 is a drag of 40% of the screen's short side, in either layout.
    var powerSpan: CGFloat { max(40, min(size.width, size.height) * 0.4) }

    static func compute(size: CGSize, insets: Insets, mode: LayoutMode, inFlight: Bool, isPad: Bool) -> BattleLayout {
        let w = size.width, h = size.height
        guard w > 0, h > 0 else { return .empty }
        let scale: CGFloat = isPad ? 1.25 : 1
        switch mode {
        case .wide:
            let full = CGRect(origin: .zero, size: size)
            let top = insets.top + 36 * scale + 12
            let bottom = insets.bottom + (inFlight ? 16 : 76 * scale)
            let left = insets.left + (inFlight ? 16 : 64 * scale)
            let right = insets.right + 16
            let clear = CGRect(x: left, y: top, width: max(10, w - left - right), height: max(10, h - top - bottom))
            return BattleLayout(mode: .wide, size: size, insets: insets,
                                lenses: [Lens(viewport: full, frame: clear, focus: inFlight ? .follow : .both)],
                                aimRegion: full)
        case .tall:
            let stripH: CGFloat = 56 * scale
            let fieldH: CGFloat = 32
            let crewH: CGFloat = 80 * scale
            let trayH: CGFloat = 52 * scale
            let topStrip = CGRect(x: 0, y: insets.top, width: w, height: stripH)
            let crew = CGRect(x: 0, y: h - insets.bottom - crewH, width: w, height: crewH)
            let tray = CGRect(x: 0, y: crew.minY - trayH, width: w, height: trayH)
            if inFlight {
                let joinedBottom = h - insets.bottom - fieldH
                let joined = CGRect(x: 0, y: topStrip.maxY, width: w, height: max(10, joinedBottom - topStrip.maxY))
                let field = CGRect(x: 0, y: joined.maxY, width: w, height: fieldH)
                return BattleLayout(mode: .tall, size: size, insets: insets,
                                    lenses: [Lens(viewport: joined, frame: joined.insetBy(dx: 8, dy: 8), focus: .follow),
                                             Lens(viewport: field, frame: field.insetBy(dx: 4, dy: 2), focus: .whole)],
                                    aimRegion: .zero, topStrip: topStrip, fieldStrip: field, tray: .zero, crewRow: .zero)
            }
            let avail = max(40, tray.minY - topStrip.maxY - fieldH)
            let topLens = CGRect(x: 0, y: topStrip.maxY, width: w, height: (avail * 0.39).rounded())
            let field = CGRect(x: 0, y: topLens.maxY, width: w, height: fieldH)
            let bottomLens = CGRect(x: 0, y: field.maxY, width: w, height: tray.minY - field.maxY)
            // Pause, the Walk pad and the readout float along the Bottom lens foot.
            let bottomFrame = CGRect(x: bottomLens.minX + 8, y: bottomLens.minY + 8,
                                     width: bottomLens.width - 16, height: max(10, bottomLens.height - 72))
            return BattleLayout(mode: .tall, size: size, insets: insets,
                                lenses: [Lens(viewport: topLens, frame: topLens.insetBy(dx: 8, dy: 8), focus: .target),
                                         Lens(viewport: field, frame: field.insetBy(dx: 4, dy: 2), focus: .whole),
                                         Lens(viewport: bottomLens, frame: bottomFrame, focus: .own)],
                                aimRegion: bottomLens, topStrip: topStrip, fieldStrip: field, tray: tray, crewRow: crew)
        }
    }
}

/// Turns one finger's drag into an angle and power (UX 3.1). Pure input
/// mapping: the core still judges every aim it is sent.
struct AimGesture: Equatable, Sendable {
    static let dragThreshold: CGFloat = 8
    static let cancelRadius: CGFloat = 12

    let anchor: CGPoint
    private(set) var finger: CGPoint
    private(set) var isDragging = false
    let powerSpan: CGFloat
    let mode: DragMode

    init(anchor: CGPoint, powerSpan: CGFloat, mode: DragMode) {
        self.anchor = anchor
        self.finger = anchor
        self.powerSpan = max(1, powerSpan)
        self.mode = mode
    }

    var distance: CGFloat { hypot(finger.x - anchor.x, finger.y - anchor.y) }

    /// True when the finger is back inside the cancel ring around the anchor.
    var isInCancelRing: Bool { distance <= Self.cancelRadius }

    /// Moves the finger. Returns true on the move that turns a touch into a drag.
    mutating func move(to point: CGPoint) -> Bool {
        finger = point
        if !isDragging && distance >= Self.dragThreshold {
            isDragging = true
            return true
        }
        return false
    }

    /// Angle in tenths of a degree, snapped to 0.5 degree, 0 right to 1800 left.
    var angleTenths: Int {
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

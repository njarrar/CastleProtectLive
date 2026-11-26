import SpriteKit
import UIKit

/// Holds a NotificationCenter observer token so `BattleSKView.deinit` removes it safely in Swift 6.
private final class ViewObserverBox: @unchecked Sendable {
    private let lock = NSLock()
    private var token: NSObjectProtocol?

    func set(_ t: NSObjectProtocol) {
        lock.lock()
        let old = token
        token = t
        lock.unlock()
        if let old { NotificationCenter.default.removeObserver(old) }
    }

    func remove() {
        lock.lock()
        let old = token
        token = nil
        lock.unlock()
        if let old { NotificationCenter.default.removeObserver(old) }
    }
}

/// The battle field: an SKView whose scene is updated from the latest core
/// snapshot when it changes (and five times a second for idle poses). It shares
/// `BattleSession`'s display link and pauses SpriteKit when idle (iOS-M4).
/// Drawing only: nothing here decides an outcome.
final class BattleSKView: SKView {
    var session: BattleSession {
        willSet {
            if session !== newValue { session.onDisplayTick = nil }
        }
        didSet { wireSession() }
    }
    private let battleScene: BattleScene
    private let observerBox = ViewObserverBox()
    private var lastBoundsSize: CGSize = .zero
    private var aimTouch: UITouch?
    private var drawnVersion = -1
    private var drawnLayout = BattleLayout.empty
    private var drawnColours = ColourSet.brickabrac
    private var drawnPose: UInt64 = 0
    private var drawnRingStep: UInt64 = 0
    private var idleTicks = 0

    init(session: BattleSession) {
        self.session = session
        battleScene = BattleScene(sheet: SpriteSheet.shared())
        super.init(frame: .zero)
        ignoresSiblingOrder = true
        isMultipleTouchEnabled = true
        preferredFramesPerSecond = 60
        backgroundColor = Palette.hex(0xA6DCEF)
        battleScene.scaleMode = .resizeFill
        presentScene(battleScene)
        wireSession()
        isAccessibilityElement = true
        accessibilityLabel = GameText.shared.t("hud.field")
        updateHint()
        let me = WeakRef(self)
        let token = NotificationCenter.default.addObserver(
            forName: UIAccessibility.voiceOverStatusDidChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            MainActor.assumeIsolated { me.value?.updateHint() }
        }
        observerBox.set(token)
    }

    deinit {
        observerBox.remove()
    }

    /// Connects the lens camera map and shared display-link callback to the session.
    private func wireSession() {
        let scene = WeakRef(battleScene)
        session.lensMap = { point in scene.value?.lensMap(at: point) }
        let me = WeakRef(self)
        session.onDisplayTick = { me.value?.frameTick() }
    }

    private func updateHint() {
        // A VoiceOver user cannot drag on the fort: point them at Fine Tune (M5).
        accessibilityHint = UIAccessibility.isVoiceOverRunning
            ? GameText.shared.t("a11y.field")
            : GameText.shared.t("hud.aim_hint")
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            idleTicks = 0
            isPaused = false
            frameTick()
        } else {
            isPaused = true
        }
    }

    private func frameTick() {
        guard window != nil else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        // Idle poses step at 5 Hz; the owner-ring pulse steps at 15 Hz when Reduce Motion is off.
        let pose: UInt64 = session.settings.reduceMotion ? 0 : now / 200_000_000
        let ringStep: UInt64 = (session.showOwnerRing && !session.settings.reduceMotion) ? now / 66_000_000 : 0
        let colours = session.settings.colourSet
        let busy = session.fx.isActive || session.snapshot.phase.isResolving || battleScene.cameraMoving
        let frameChanged: Bool = session.frameVersion != drawnVersion || session.layout != drawnLayout
        let lookChanged: Bool = colours != drawnColours || pose != drawnPose || ringStep != drawnRingStep
        let changed: Bool = busy || frameChanged || lookChanged
        guard changed else {
            idleTicks += 1
            if idleTicks >= 2 && !isPaused { isPaused = true }
            return
        }
        idleTicks = 0
        if isPaused { isPaused = false }
        drawnVersion = session.frameVersion
        drawnLayout = session.layout
        drawnColours = colours
        drawnPose = pose
        drawnRingStep = ringStep
        battleScene.render(snapshot: session.snapshot, layout: session.layout, fx: session.fx, colours: colours,
                           dragging: session.dragging, reduceMotion: session.settings.reduceMotion,
                           pan: session.cameraPan, panning: session.panning,
                           extras: LensExtras(home: session.cameraHome, peek: session.rivalPeek,
                                              ownerRing: session.showOwnerRing,
                                              highlightedBlocks: session.highlightedBlocks))
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != lastBoundsSize {
            if lastBoundsSize != .zero, aimTouch != nil {
                // A device turn mid-drag ends the drag as if the finger lifted; nothing fires.
                aimTouch = nil
                session.endDragKeepingAim()
            }
            lastBoundsSize = bounds.size
            battleScene.size = bounds.size
            drawnVersion = -1
            frameTick()
        }
    }

    // MARK: Touches (UX 3.1, 3.9)

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        let active = event?.allTouches?.filter { $0.phase != .ended && $0.phase != .cancelled } ?? touches
        // M-I07: Apple Pencil palm rejection: ignore resting `.direct` palm touches during a Pencil drag.
        if let current = aimTouch, current.type == .pencil {
            let otherNonDirect = active.filter { $0 !== current && $0.type != .direct }
            if !otherNonDirect.isEmpty {
                session.touchCancelled()
                aimTouch = nil
            }
            return
        }
        // Prefer an arriving Apple Pencil touch over a resting palm touch.
        if let pencil = touches.first(where: { $0.type == .pencil }) {
            let p = pencil.location(in: self)
            guard bounds.inset(by: safeAreaInsets).contains(p) else { return }
            if aimTouch != nil {
                session.touchCancelled()
                aimTouch = nil
            }
            if session.wantsBlockTap, session.handleBlockTap(at: p) {
                return
            }
            aimTouch = pencil
            session.touchBegan(at: p)
            return
        }
        if active.count >= 2 {
            // A second finger cancels the drag; lifting back to one does not start a new one.
            if aimTouch != nil {
                session.touchCancelled()
                aimTouch = nil
            }
            return
        }
        guard aimTouch == nil, let t = touches.first else { return }
        let p = t.location(in: self)
        // Touches that start inside the safe-area insets are palm and edge touches.
        guard bounds.inset(by: safeAreaInsets).contains(p) else { return }
        // Own-fort block targeting for Mendglob or Mend Bucket takes precedence over Aim Drag (iOS-H4).
        if session.wantsBlockTap, session.handleBlockTap(at: p) {
            return
        }
        aimTouch = t
        session.touchBegan(at: p)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = aimTouch, touches.contains(t) else { return }
        session.touchMoved(to: t.location(in: self))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = aimTouch, touches.contains(t) else { return }
        aimTouch = nil
        session.touchEnded(at: t.location(in: self))
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = aimTouch, touches.contains(t) else { return }
        aimTouch = nil
        session.touchCancelled()
    }
}

/// The scene: one lens layer per lens in the layout (one in Wide, three in Tall).
final class BattleScene: SKScene {
    private let sheet: SpriteSheet
    private var layers: [LensLayer] = []
    private let textures = TerrainTextures()
    private var palettes: [ColourSet: Palette] = [:]
    private var lastNanos: UInt64 = 0

    init(sheet: SpriteSheet) {
        self.sheet = sheet
        super.init(size: CGSize(width: 1, height: 1))
        anchorPoint = .zero
        backgroundColor = Palette.hex(0xA6DCEF)
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    /// The camera of the shown field lens under a view point, or nil.
    func lensMap(at point: CGPoint) -> LensMap? {
        for layer in layers where !layer.crop.isHidden {
            if let map = layer.map, map.viewport.contains(point) { return map }
        }
        return nil
    }

    /// Only shown lenses count: a rig left easing when its lens was hidden must not keep the scene at 60 fps.
    var cameraMoving: Bool { layers.contains { !$0.crop.isHidden && $0.rig.moving } }

    func render(snapshot: BattleSnapshot, layout: BattleLayout, fx: FieldFX, colours: ColourSet, dragging: Bool, reduceMotion: Bool,
                pan: Double = 0, panning: Bool = false, extras: LensExtras = LensExtras()) {
        let nanos = DispatchTime.now().uptimeNanoseconds
        let dt = lastNanos == 0 ? 16.0 : min(100, Double(nanos &- lastNanos) / 1_000_000)
        lastNanos = nanos
        let lenses = snapshot.phase == .none ? [] : layout.lenses
        while layers.count < lenses.count {
            let layer = LensLayer(sheet: sheet)
            addChild(layer.crop)
            layers.append(layer)
        }
        for (i, layer) in layers.enumerated() {
            if i < lenses.count {
                layer.crop.isHidden = false
                let palette = palettes[colours] ?? Palette(set: colours)
                palettes[colours] = palette
                layer.update(lens: lenses[i], snap: snapshot, fx: fx, palette: palette, sceneHeight: size.height,
                             textures: textures, dt: dt, dragging: dragging, reduceMotion: reduceMotion,
                             pan: pan, panning: panning, extras: extras)
            } else {
                layer.crop.isHidden = true
            }
        }
    }
}

/// One lens camera: eases toward its target frame (UX 3.5, 2.6.3), holds still
/// during an Aim Drag, follows a shell with a dead zone, and cuts instead of
/// sweeping with Reduce motion.
@MainActor
final class CameraRig {
    private(set) var rect: CGRect?
    private(set) var moving = false

    func update(target: CGRect, dt: Double, cut: Bool, hold: Bool, follow: CGPoint?) -> CGRect {
        guard var current = rect, !cut else {
            rect = target
            moving = false
            return target
        }
        if hold {
            moving = false
            return current
        }
        var goal = target
        if let shell = follow {
            // Dead zone: the middle 30% of the frame. Inside it, the centre stays.
            let dx = shell.x - current.midX, dy = shell.y - current.midY
            var cx = goal.midX, cy = goal.midY
            if abs(dx) < current.width * 0.15 { cx = current.midX }
            if abs(dy) < current.height * 0.15 { cy = current.midY }
            goal = CGRect(x: cx - goal.width / 2, y: cy - goal.height / 2, width: goal.width, height: goal.height)
        }
        let tau = follow != nil ? 120.0 : 140.0
        let k = CGFloat(1 - exp(-dt / tau))
        current = CGRect(x: current.minX + (goal.minX - current.minX) * k,
                         y: current.minY + (goal.minY - current.minY) * k,
                         width: current.width + (goal.width - current.width) * k,
                         height: current.height + (goal.height - current.height) * k)
        moving = abs(current.midX - goal.midX) > 0.5 || abs(current.midY - goal.midY) > 0.5 || abs(current.width - goal.width) > 0.5
        if !moving { current = goal }
        rect = current
        return current
    }
}

/// A block cell of a fort, for the outer contour.
private struct CellKey: Hashable {
    let c: Int
    let r: Int
}

/// One lens: a crop node over its viewport, atmospheric backdrop + parallax hills,
/// and a world node that the camera scales and moves. Nodes are pooled and reused every frame.
@MainActor
final class LensLayer {
    let crop = SKCropNode()
    let rig = CameraRig()
    /// This lens's camera at the last draw (nil for the Field Strip, which is not aimed in).
    private(set) var map: LensMap?
    private let mask = SKSpriteNode(color: .white, size: CGSize(width: 1, height: 1))
    private let backdrop = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
    private let farHills = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
    private let midHills = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
    private let world = SKNode()
    private let ground = SKShapeNode()
    private let cutLine = SKShapeNode()
    private let sheet: SpriteSheet
    private var lastTerrain: [Double] = []
    private var lastWorldW = 0.0
    /// One body node and one outer-contour shape node per fort, so a walk moves and bobs everything on it.
    private var fortNodes: [SKNode] = []
    private var fortContours: [SKShapeNode] = []
    private var fortContourKeys: [Int: Int] = [:]
    private var pools: [String: [SKSpriteNode]] = [:]
    private var used: [String: Int] = [:]
    private let terrainLayer = SKNode()
    private var terrainNodes: [Int: SKSpriteNode] = [:]
    private var terrainDrawn: [Int: Int] = [:]
    private var terrainGrid: TerrainGrid?
    private var terrainVersion = -1
    /// The gold ring on the picked Hob while the owner rule is being taught (QA playtest 2).
    private let ownerRing = SKShapeNode()
    private var lastOwnerRadius: CGFloat = -1
    /// Pooled painterly pearl trajectory beads (M-I09: cached textures, zero per-tick SKShapeNode tessellation).
    private var beamSprites: [SKSpriteNode] = []
    private struct BeamCacheKey: Equatable {
        var show: Bool
        var preview: [Double]
        var powerTier: Int
        var cppBucket: Int
    }
    private var lastBeamKey: BeamCacheKey?
    private let missBox = SKShapeNode()
    private let missLabel = SKLabelNode(fontNamed: "AvenirNext-DemiBold")
    private var lastMissKey: (text: String, cppBucket: Int)?
    private var lastMissBoxSize: CGSize = .zero

    /// World cells per @1x pixel for Hob frames (72 x 80 px at @1x), so a Hob
    /// stands about two blocks tall in its Nook. Blocks are 1 cell a pixel.
    static let hobCellsPerPixel: CGFloat = 0.5

    /// Caps persistent trajectory pins per side so Round 10 Fatigue stays readable (Part 2 Plate 2).
    nonisolated static func visiblePins(_ pins: [PinView], maxPerSide: Int = 2) -> [PinView] {
        guard maxPerSide > 0 else { return [] }
        let p0 = pins.filter { $0.side == 0 }.suffix(maxPerSide)
        let p1 = pins.filter { $0.side == 1 }.suffix(maxPerSide)
        return Array(p0) + Array(p1)
    }

    init(sheet: SpriteSheet) {
        self.sheet = sheet
        crop.maskNode = mask
        backdrop.zPosition = -10
        crop.addChild(backdrop)
        farHills.zPosition = -8
        farHills.texture = BattleArtCache.farHillsTexture
        crop.addChild(farHills)
        midHills.zPosition = -6
        midHills.texture = BattleArtCache.midHillsTexture
        crop.addChild(midHills)
        crop.addChild(world)
        ground.zPosition = 0
        world.addChild(ground)
        terrainLayer.zPosition = 0.5
        world.addChild(terrainLayer)
        cutLine.zPosition = 8
        cutLine.strokeColor = Palette.hex(0xC9363E)
        cutLine.lineWidth = 2
        cutLine.isHidden = true
        world.addChild(cutLine)
        for _ in 0..<2 {
            let n = SKNode()
            n.zPosition = 1
            let contour = SKShapeNode()
            contour.zPosition = 1.18
            contour.strokeColor = Palette.hex(0x2C221E)
            contour.fillColor = .clear
            contour.lineCap = .round
            contour.lineJoin = .round
            n.addChild(contour)
            world.addChild(n)
            fortNodes.append(n)
            fortContours.append(contour)
        }
        ownerRing.zPosition = 3.5
        ownerRing.strokeColor = Palette.hex(0xFFC23D)
        ownerRing.fillColor = .clear
        ownerRing.isHidden = true
        world.addChild(ownerRing)
        for _ in 0..<Self.pearlBeadCount {
            let n = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
            n.zPosition = 5.05
            n.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            n.isHidden = true
            world.addChild(n)
            beamSprites.append(n)
        }
        missBox.zPosition = 9
        missBox.fillColor = Palette.hex(0xFFF4DE).withAlphaComponent(0.94)
        missBox.strokeColor = Palette.hex(0x2C221E)
        missBox.isHidden = true
        missLabel.fontColor = Palette.hex(0x2C221E)
        missLabel.verticalAlignmentMode = .center
        missLabel.horizontalAlignmentMode = .center
        missBox.addChild(missLabel)
        world.addChild(missBox)
    }

    static let pearlBeadCount = 14

    /// Aim colour by power: Brickabrac blue -> dusk slate -> warm gold -> rich amber -> ember -> crimson (zero neon green).
    nonisolated static func aimHeatRGB(_ power: Int) -> (r: Double, g: Double, b: Double) {
        let p = Double(min(100, max(0, power)))
        let stops: [(p: Double, r: Double, g: Double, b: Double)] = [
            (0,   0.22, 0.45, 0.85),
            (30,  0.62, 0.56, 0.72),
            (55,  0.92, 0.74, 0.30),
            (80,  0.94, 0.54, 0.16),
            (92,  0.89, 0.32, 0.19),
            (100, 0.81, 0.19, 0.24)
        ]
        for i in 0..<(stops.count - 1) {
            let a = stops[i], b = stops[i + 1]
            if p <= b.p {
                let t = (p - a.p) / max(1, b.p - a.p)
                return (a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
            }
        }
        let last = stops[stops.count - 1]
        return (last.r, last.g, last.b)
    }

    /// Aim colour by power as `UIColor` (zero green).
    nonisolated static func aimHeat(_ power: Int) -> UIColor {
        let c = aimHeatRGB(power)
        return UIColor(red: CGFloat(c.r), green: CGFloat(c.g), blue: CGFloat(c.b), alpha: 1)
    }

    /// "3 blocks short" or "1 block long" for a shot that missed the rival fort (nil on a hit).
    /// Prefers core `pin.missBlocks` when present; otherwise uses exact `snap.fort(1 - pin.side)` bounds (M-I02).
    static func missText(_ pin: PinView, snap: BattleSnapshot) -> String? {
        if let mb = pin.missBlocks {
            guard mb != 0 else { return nil }
            let n = abs(mb)
            let key = mb < 0 ? "hud.miss_short" : "hud.miss_long"
            return n == 1 ? GameText.shared.t(key + "_one") : GameText.shared.t(key).replacingOccurrences(of: "{n}", with: String(n))
        }
        if pin.selfHit { return nil }
        guard let foeFort = snap.fort(1 - pin.side) else { return nil }
        let block = max(1.0, foeFort.block)
        let foeMinX: Double
        let foeMaxX: Double
        if foeFort.cols > 0 {
            foeMinX = foeFort.originX
            foeMaxX = foeFort.originX + Double(foeFort.cols) * block
        } else {
            let r = Camera.fortRect(1 - pin.side, snap: snap)
            foeMinX = Double(r.minX)
            foeMaxX = Double(r.maxX)
        }
        if pin.x >= foeMinX && pin.x <= foeMaxX { return nil }
        let ownMidX: Double
        if let ownFort = snap.fort(pin.side), ownFort.cols > 0 {
            ownMidX = ownFort.originX + Double(ownFort.cols) * max(1.0, ownFort.block) / 2
        } else {
            ownMidX = Double(Camera.fortRect(pin.side, snap: snap).midX)
        }
        let foeMidX = (foeMinX + foeMaxX) / 2
        let toward: Double = foeMidX >= ownMidX ? 1 : -1
        let edge = pin.x < foeMinX ? foeMinX : foeMaxX
        let n = max(1, Int((abs(pin.x - edge) / block).rounded()))
        let short = (pin.x - edge) * toward < 0
        let key = short ? "hud.miss_short" : "hud.miss_long"
        return n == 1 ? GameText.shared.t(key + "_one") : GameText.shared.t(key).replacingOccurrences(of: "{n}", with: String(n))
    }

    /// Renders core's `snap.preview` ONLY as tapering glowing cream-to-gold-to-ember pearl beads (Rule 1, M-I09).
    /// Cached by `(show, preview, powerTier, cppBucket)` so idle 5 Hz/15 Hz ticks do zero work.
    private func updateBeam(show: Bool, snap: BattleSnapshot, cellsPerPoint: Double) {
        let powerTier = snap.aim.power > 94 ? 2 : (snap.aim.power > 80 ? 1 : 0)
        let cppBucket = Int((cellsPerPoint * 100).rounded())
        let key = BeamCacheKey(show: show, preview: show ? snap.preview : [], powerTier: powerTier, cppBucket: cppBucket)
        if key == lastBeamKey { return }
        lastBeamKey = key

        let n = snap.preview.count / 2
        guard show, n >= 2 else {
            for b in beamSprites { b.isHidden = true }
            return
        }
        var cumLen: [Double] = [0]
        cumLen.reserveCapacity(n)
        var totalLen = 0.0
        for i in 1..<n {
            let dx = snap.preview[i * 2] - snap.preview[(i - 1) * 2]
            let dy = snap.preview[i * 2 + 1] - snap.preview[(i - 1) * 2 + 1]
            totalLen += hypot(dx, dy)
            cumLen.append(totalLen)
        }
        guard totalLen > 0.01 else {
            for b in beamSprites { b.isHidden = true }
            return
        }
        let spacing = max(6.0, 10.5 * cellsPerPoint)
        let beadCount = min(Self.pearlBeadCount, max(2, Int((totalLen / spacing).rounded()) + 1))
        let tex = BattleArtCache.pearlBeadTexture(tier: powerTier)
        let k = CGFloat(max(0.75, min(1.35, cellsPerPoint)))
        var seg = 0
        for idx in 0..<Self.pearlBeadCount {
            let node = beamSprites[idx]
            guard idx < beadCount else {
                node.isHidden = true
                continue
            }
            let f = beadCount > 1 ? Double(idx) / Double(beadCount - 1) : 0
            let targetDist = f * totalLen
            while seg + 1 < n - 1 && cumLen[seg + 1] < targetDist {
                seg += 1
            }
            let segStart = cumLen[seg]
            let segLen = max(0.0001, cumLen[seg + 1] - segStart)
            let t = min(1.0, max(0.0, (targetDist - segStart) / segLen))
            let x = snap.preview[seg * 2] + (snap.preview[(seg + 1) * 2] - snap.preview[seg * 2]) * t
            let y = snap.preview[seg * 2 + 1] + (snap.preview[(seg + 1) * 2 + 1] - snap.preview[seg * 2 + 1]) * t
            let diameter = (7.4 * (1 - CGFloat(f)) + 2.8) * k
            node.texture = tex
            node.color = .white
            node.colorBlendFactor = 0
            node.size = CGSize(width: diameter * 1.45, height: diameter * 1.45)
            node.position = CGPoint(x: x, y: y)
            node.alpha = CGFloat(0.96 * (1 - f * 0.40))
            node.isHidden = false
        }
    }

    /// The gold ring around the picked Hob of the side on turn, pulsing, until 3 aims were
    /// started from the fort.
    private func updateOwnerRing(show: Bool, snap: BattleSnapshot, cellsPerPoint: Double, now: Double, reduceMotion: Bool) {
        guard show, let id = snap.selectedHob,
              let hob = snap.fort(snap.activeSide)?.hobs.first(where: { $0.id == id }), !hob.isOut else {
            ownerRing.isHidden = true
            return
        }
        ownerRing.isHidden = false
        let radius = CGFloat(max(18, 26 * cellsPerPoint))
        if abs(radius - lastOwnerRadius) > 0.25 {
            lastOwnerRadius = radius
            ownerRing.path = CGPath(ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2), transform: nil)
        }
        ownerRing.lineWidth = CGFloat(max(2, 4 * cellsPerPoint))
        ownerRing.position = CGPoint(x: hob.x, y: hob.y + 18)
        let pulse = reduceMotion ? 1 : 0.85 + 0.15 * sin(now / 260)
        ownerRing.setScale(CGFloat(pulse))
        ownerRing.alpha = reduceMotion ? 1 : CGFloat(0.75 + 0.25 * sin(now / 260))
    }

    // MARK: Pools

    private func take(_ pool: String, parent: SKNode, z: CGFloat) -> SKSpriteNode {
        let i = used[pool] ?? 0
        used[pool] = i + 1
        var list = pools[pool] ?? []
        if i < list.count {
            let node = list[i]
            if node.parent !== parent {
                node.removeFromParent()
                parent.addChild(node)
            }
            node.isHidden = false
            node.zPosition = z
            node.zRotation = 0
            node.alpha = 1
            node.xScale = 1
            node.yScale = 1
            return node
        }
        let node = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
        node.zPosition = z
        parent.addChild(node)
        list.append(node)
        pools[pool] = list
        return node
    }

    private func hideUnused() {
        for (name, list) in pools {
            let n = used[name] ?? 0
            if n < list.count { for i in n..<list.count { list[i].isHidden = true } }
        }
        used = [:]
    }

    // MARK: Frame

    func update(lens: Lens, snap: BattleSnapshot, fx: FieldFX, palette: Palette, sceneHeight: CGFloat,
                textures: TerrainTextures, dt: Double, dragging: Bool, reduceMotion: Bool,
                pan: Double = 0, panning: Bool = false, extras: LensExtras = LensExtras()) {
        let small = lens.focus == .whole
        let vp = lens.viewport
        let centre = CGPoint(x: vp.midX, y: sceneHeight - vp.midY)
        mask.size = vp.size
        mask.position = centre
        backdrop.size = vp.size
        backdrop.position = centre
        if small {
            backdrop.texture = nil
            backdrop.color = palette.paper
            backdrop.colorBlendFactor = 1
            farHills.isHidden = true
            midHills.isHidden = true
        } else {
            backdrop.texture = BattleArtCache.skyTexture
            backdrop.color = .white
            backdrop.colorBlendFactor = 0
            farHills.isHidden = false
            midHills.isHidden = false
        }

        // Camera: ease toward the lens's target, then fit it into the Clear Rect.
        let peek = extras.peek && lens.focus == .both
        var target = Camera.worldRect(for: lens.focus, snap: snap, fx: fx, current: rig.rect, frame: lens.frame.size,
                                      minBlock: lens.minBlock, home: extras.home, peek: peek)
        let aimLens = lens.focus == .both || lens.focus == .own
        if aimLens && !peek { target = Camera.panned(target, by: pan, worldW: snap.world.w) }
        let follow: CGPoint? = lens.focus == .follow && !snap.shells.isEmpty && !reduceMotion
            ? CGPoint(x: snap.shells[0].x, y: snap.shells[0].y) : nil
        let worldRect = rig.update(target: target, dt: dt, cut: reduceMotion || small || (panning && aimLens),
                                   hold: dragging && !small, follow: follow)
        let scale = min(lens.frame.width / max(1, worldRect.width), lens.frame.height / max(1, worldRect.height))
        world.setScale(scale)
        let frameCentre = CGPoint(x: lens.frame.midX, y: sceneHeight - lens.frame.midY)
        // Shake moves the field only, never the HUD, and never while aiming.
        let shake = small ? .zero : fx.shakeOffset(planning: snap.phase == .plan || snap.phase == .handoff)
        world.position = CGPoint(x: frameCentre.x - worldRect.midX * scale + shake.x,
                                 y: frameCentre.y - worldRect.midY * scale + shake.y)
        map = small ? nil : LensMap(viewport: vp, frameCentre: frameCentre, worldRect: worldRect, scale: scale,
                                    sceneHeight: sceneHeight)

        // Atmospheric parallax hills tinted with ~18% sky haze so distant hills recede cleanly.
        if !small {
            let parallaxNorm = CGFloat(Double(worldRect.midX) / max(1, snap.world.w) - 0.5)
            let hillW = max(vp.width * 1.45, 520)
            let farH = max(60, vp.height * 0.42)
            let midH = max(50, vp.height * 0.32)
            let vpBottom = sceneHeight - vp.maxY
            farHills.size = CGSize(width: hillW, height: farH)
            farHills.anchorPoint = CGPoint(x: 0.5, y: 0)
            farHills.position = CGPoint(x: vp.midX - parallaxNorm * vp.width * 0.14, y: vpBottom + vp.height * 0.14)
            farHills.alpha = 0.85

            midHills.size = CGSize(width: hillW, height: midH)
            midHills.anchorPoint = CGPoint(x: 0.5, y: 0)
            midHills.position = CGPoint(x: vp.midX - parallaxNorm * vp.width * 0.28, y: vpBottom + vp.height * 0.04)
            midHills.alpha = 0.90
        }

        let cellsPerPoint = Double(1 / max(0.0001, scale))
        updateOwnerRing(show: extras.ownerRing && lens.focus != .whole && lens.focus != .target && snap.phase == .plan,
                        snap: snap, cellsPerPoint: cellsPerPoint, now: fx.now, reduceMotion: reduceMotion)
        let useArt = !small && !sheet.isEmpty
        let now = fx.now

        if !small, let grid = snap.ground, grid.hasData {
            ground.isHidden = true
            updateTerrain(grid: grid, textures: textures)
        } else {
            ground.isHidden = false
            terrainLayer.isHidden = true
            updateGround(snap: snap, palette: palette)
        }

        for fort in snap.forts {
            drawFort(fort, snap: snap, fx: fx, palette: palette, useArt: useArt, small: small,
                     reduceMotion: reduceMotion, cellsPerPoint: cellsPerPoint,
                     highlightedBlocks: extras.highlightedBlocks)
        }
        // A core with more castles than nodes must not trap the range (L1).
        if snap.forts.count < fortNodes.count {
            for i in snap.forts.count..<fortNodes.count { fortNodes[i].isHidden = true }
        }

        // Collapse ghosts: creak, lean, drop row by row, land, break (view only; shown in fallback mode too).
        if !small {
            for p in fx.pieces {
                let t = fx.pieceTransform(p)
                let node = take("piece", parent: world, z: 2.2)
                place(node, frame: useArt ? (sheet.frame("block_\(p.mat)_battered") ?? sheet.frame("block_\(p.mat)_fresh")) : nil,
                      at: CGPoint(x: p.x + p.size / 2 + t.dx, y: p.y + t.dy), scale: 1, flip: false,
                      fallback: palette.material(p.mat), fallbackSize: CGSize(width: p.size, height: p.size))
                node.anchorPoint = CGPoint(x: 0.5, y: 0)
                node.size = CGSize(width: p.size, height: p.size)
                node.zRotation = CGFloat(-t.deg * .pi / 180)
                node.yScale = CGFloat(t.squash)
                if useArt, now - p.start < fx.motion.creakMs + fx.motion.leanMs, let crack = fx.library.clip("fx_crack_\(p.mat)") {
                    let c = take("crack", parent: world, z: 2.3)
                    placeClip(c, crack.frame(at: now - p.start), crack, at: CGPoint(x: p.x + t.dx, y: p.y + p.size + t.dy),
                              cellsPerPx: 1, flip: false)
                    c.zRotation = node.zRotation
                }
            }
        }

        // Props: handcrafted 1-7 Rescue Cage + Hetty, 1-10 Big Smoothie Jr. roller + lawn sign + Topiary Shears, shell props.
        var drewLawnSign = false
        for p in snap.props where !p.broken {
            let node = take("prop", parent: world, z: 2.5)
            switch p.kind {
            case "cage_bar":
                if useArt, let frame = sheet.frame("prop_cage_bar") {
                    place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 0.9, flip: false,
                          fallback: palette.cage, fallbackSize: CGSize(width: 16, height: 48))
                } else {
                    placeTexture(node, BattleArtCache.cageBarTexture, at: CGPoint(x: p.x, y: p.y),
                                 size: CGSize(width: 14, height: 48), anchor: CGPoint(x: 0.5, y: 0))
                }
            case "captive":
                if !small {
                    let halo = take("halo", parent: world, z: 2.35)
                    placeTexture(halo, BattleArtCache.rescueHaloTexture, at: CGPoint(x: p.x, y: p.y + 18),
                                 size: CGSize(width: 44, height: 44), anchor: CGPoint(x: 0.5, y: 0.5))
                    halo.alpha = reduceMotion ? 0.6 : CGFloat(0.45 + 0.25 * sin(now / 360))
                }
                if useArt, let frame = sheet.frame("prop_rescue_cage_hetty") {
                    place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 0.65, flip: false,
                          fallback: palette.you, fallbackSize: CGSize(width: 28, height: 34))
                } else if useArt, let art = fx.library.clip("hob_hetty_blue_idle") {
                    let fname = art.frame(at: reduceMotion ? 0 : now)
                    placeClip(node, fname, art, at: CGPoint(x: p.x, y: p.y), cellsPerPx: Self.hobCellsPerPixel, flip: false)
                    drawOverlays(for: fname, parent: world, at: CGPoint(x: p.x, y: p.y),
                                 cellsPerPx: Self.hobCellsPerPixel, flip: false, z: 2.54)
                } else {
                    placeTexture(node, BattleArtCache.captiveHettyTexture, at: CGPoint(x: p.x, y: p.y),
                                 size: CGSize(width: 28, height: 34), anchor: CGPoint(x: 0.5, y: 0))
                }
            case "roller":
                if useArt, let frame = sheet.frame("prop_big_smoothie_jr") ?? sheet.frame("prop_roller") {
                    place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 0.85, flip: false,
                          fallback: palette.flattened, fallbackSize: CGSize(width: 56, height: 36))
                } else {
                    placeTexture(node, BattleArtCache.rollerTexture, at: CGPoint(x: p.x, y: p.y),
                                 size: CGSize(width: 60, height: 38), anchor: CGPoint(x: 0.5, y: 0))
                }
                if !small && !drewLawnSign {
                    drewLawnSign = true
                    let sign = take("prop_extra", parent: world, z: 2.45)
                    let signPos = CGPoint(x: p.x - 46, y: snap.groundAt(p.x - 46))
                    if useArt, let sf = sheet.frame("prop_lawn_sign") {
                        place(sign, frame: sf, at: signPos, scale: 0.75, flip: false,
                              fallback: palette.dirt, fallbackSize: CGSize(width: 30, height: 26))
                    } else {
                        placeTexture(sign, BattleArtCache.lawnSignTexture, at: signPos,
                                     size: CGSize(width: 34, height: 28), anchor: CGPoint(x: 0.5, y: 0))
                    }
                }
            case "shears":
                if useArt, let frame = sheet.frame("prop_shears") {
                    place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 0.9, flip: false,
                          fallback: palette.ink, fallbackSize: CGSize(width: 34, height: 28))
                } else {
                    placeTexture(node, BattleArtCache.shearsTexture, at: CGPoint(x: p.x, y: p.y),
                                 size: CGSize(width: 38, height: 28), anchor: CGPoint(x: 0.5, y: 0.4))
                }
            case "crock_prop":
                let frame = useArt ? (sheet.frame("prop_crock") ?? sheet.frame("shell_tick_tock_crock")) : nil
                place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 1.0, flip: false,
                      fallback: palette.kettle, fallbackSize: CGSize(width: 18, height: 18))
            case "turnip_prop":
                let frame = useArt ? (sheet.frame("prop_turnip") ?? sheet.frame("shell_old_turnip")) : nil
                place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 1.0, flip: false,
                      fallback: palette.dirt, fallbackSize: CGSize(width: 18, height: 18))
            default:
                let name = p.shot.isEmpty ? "shell_clodpot" : "shell_\(p.shot)"
                let frame = useArt ? (sheet.frame(name) ?? sheet.frame("shell_clodpot")) : nil
                place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 1.2, flip: false,
                      fallback: palette.kettle, fallbackSize: CGSize(width: 18, height: 18))
            }
            node.alpha = CGFloat(0.65 + 0.35 * p.hpFraction)
        }

        // The 1-10 cut line: shown one boss turn before the snip.
        if let cut = snap.boss?.cut, !small {
            cutLine.isHidden = false
            let rect = CGRect(x: cut.x0, y: cut.y0, width: cut.width, height: cut.height)
            cutLine.path = CGPath(rect: rect, transform: nil).copy(dashingWithPhase: CGFloat(now / 40), lengths: [6, 4])
            cutLine.lineWidth = CGFloat(max(1.5, 2 * cellsPerPoint))
        } else {
            cutLine.isHidden = true
        }

        // Painterly pearl trajectory beads from core's preview (Rule 1, M-I09).
        updateBeam(show: !small, snap: snap, cellsPerPoint: cellsPerPoint)

        // The picked Hob's last shot: circular stroked dots (M-I09), and clamped miss tag (M-I02).
        var missShown = false
        if !small, snap.phase == .plan, snap.humans.indices.contains(snap.activeSide), snap.humans[snap.activeSide],
           let id = snap.selectedHob,
           let last = snap.pins.last(where: { $0.side == snap.activeSide && $0.hob == id }) {
            let k = CGFloat(max(0.5, cellsPerPoint))
            let dotTex = BattleArtCache.lastShotDotTexture(side: last.side, color: palette.side(last.side))
            let step = max(2, last.path.count / 2 / 14) * 2
            var i = 0
            while i + 1 < last.path.count {
                let node = take("lastdot", parent: world, z: 4.5)
                placeTexture(node, dotTex, at: CGPoint(x: last.path[i], y: last.path[i + 1]),
                             size: CGSize(width: 6 * k, height: 6 * k), anchor: CGPoint(x: 0.5, y: 0.5))
                node.alpha = 0.78
                i += step
            }
            if !snap.preview.isEmpty, let text = Self.missText(last, snap: snap) {
                missShown = true
                let cppBucket = Int((cellsPerPoint * 100).rounded())
                if lastMissKey?.text != text || lastMissKey?.cppBucket != cppBucket {
                    lastMissKey = (text, cppBucket)
                    missLabel.text = text
                    missLabel.fontSize = CGFloat(13 * cellsPerPoint)
                    let size = missLabel.frame.size
                    let pad = CGFloat(6 * cellsPerPoint)
                    let box = CGRect(x: -size.width / 2 - pad, y: -size.height / 2 - pad / 2,
                                     width: size.width + pad * 2, height: size.height + pad)
                    missBox.path = CGPath(roundedRect: box, cornerWidth: pad, cornerHeight: pad, transform: nil)
                    missBox.lineWidth = CGFloat(1.5 * cellsPerPoint)
                    lastMissBoxSize = box.size
                }
                let halfW = lastMissBoxSize.width / 2 + CGFloat(8 * cellsPerPoint)
                let halfH = lastMissBoxSize.height / 2 + CGFloat(8 * cellsPerPoint)
                let minX = min(worldRect.midX, worldRect.minX + halfW)
                let maxX = max(worldRect.midX, worldRect.maxX - halfW)
                let minY = min(worldRect.midY, worldRect.minY + halfH)
                let maxY = max(worldRect.midY, worldRect.maxY - halfH)
                missBox.position = CGPoint(x: min(maxX, max(minX, CGFloat(last.x))),
                                           y: min(maxY, max(minY, CGFloat(last.y + 34 * cellsPerPoint))))
            }
        }
        missBox.isHidden = !missShown

        // Pins: capped to the 2 most recent per side so Round 10 Fatigue never turns into clutter (Plate 2).
        for pin in Self.visiblePins(snap.pins, maxPerSide: 2) {
            let node = take("pin", parent: world, z: 4)
            let pinScale = CGFloat(max(small ? 1.2 : 0.5, cellsPerPoint))
            let key = "\(pin.side):\(pin.hob):\(Int(pin.x)):\(Int(pin.y))"
            let drop = fx.library.clip(pin.side == 0 ? "fx_pin_p1_drop" : "fx_pin_p2_drop")
            if useArt, let drop, let start = fx.pinDrops[key], !reduceMotion {
                placeClip(node, drop.frame(at: now - start), drop, at: CGPoint(x: pin.x, y: pin.y), cellsPerPx: pinScale, flip: false)
            } else {
                place(node, frame: useArt ? sheet.frame(pin.side == 0 ? "fx_pin_p1" : "fx_pin_p2") : nil, at: CGPoint(x: pin.x, y: pin.y),
                      scale: pinScale, flip: false, fallback: palette.side(pin.side),
                      fallbackSize: CGSize(width: 12 * pinScale, height: 12 * pinScale))
            }
            node.alpha = pin.spent ? 0.45 : 1
        }

        // Shells in flight, turned to their flight direction.
        for sh in snap.shells {
            let node = take("shell", parent: world, z: 6)
            let name = sh.kind.isEmpty || sh.kind == "plain" ? "shell_clodpot" : "shell_\(sh.kind)"
            let shellScale = CGFloat(max(small ? 1.5 : 0.5, 0.7 * cellsPerPoint))
            place(node, frame: useArt ? (sheet.frame(name) ?? sheet.frame("shell_clodpot")) : nil, at: CGPoint(x: sh.x, y: sh.y),
                  scale: shellScale, flip: false, fallback: palette.ink,
                  fallbackSize: CGSize(width: 16 * shellScale, height: 16 * shellScale))
            node.zRotation = CGFloat(Double(sh.rot) / 10 * Double.pi / 180)
        }

        // Effects: trails, impacts, booms, chunks, rubble, dust, fizz.
        if !small {
            for s in fx.sprites {
                guard let clip = fx.library.clip(s.clip) ?? FieldFX.synthetic(s.clip) else { continue }
                let t = now - s.start
                let node = take("fx", parent: world, z: s.z)
                let (x, y) = s.position(at: now)
                let name: String
                if s.life > 0 && clip.loop { name = clip.frame(at: reduceMotion ? 0 : t) } else { name = clip.frame(at: t, reversed: s.reversed) }
                if useArt {
                    placeClip(node, name, clip, at: CGPoint(x: x, y: y), cellsPerPx: CGFloat(s.scale), flip: s.flip)
                } else {
                    place(node, frame: nil, at: CGPoint(x: x, y: y), scale: 1, flip: false, fallback: Palette.hex(0xFFF3C4),
                          fallbackSize: CGSize(width: clip.w * s.scale, height: clip.h * s.scale))
                }
                node.zRotation = CGFloat(s.spin * t / 1000 * .pi / 180)
                let length = s.life > 0 ? s.life : clip.total + s.holdFor
                if s.fadeLast > 0, length - t < s.fadeLast {
                    node.alpha = CGFloat(max(0, (length - t) / s.fadeLast))
                }
            }
        }

        // De-overlapped color-coded floating combat numbers & `Drop!` starburst callouts (Plate 2).
        if !small {
            let calloutScale = CGFloat(max(0.65, min(1.5, cellsPerPoint * 0.85)))
            for item in fx.resolvedCallouts(minDx: max(36, 38 * cellsPerPoint), minDy: max(22, 24 * cellsPerPoint)) {
                let node = take("callout", parent: world, z: 8.5)
                let tex = BattleArtCache.calloutTexture(text: item.callout.text, style: item.callout.style)
                let baseSz = tex.size()
                let pop: CGFloat = (!reduceMotion && item.progress < 0.14)
                    ? CGFloat(0.72 + (item.progress / 0.14) * 0.40)
                    : 1.0
                placeTexture(node, tex, at: CGPoint(x: item.x, y: item.y),
                             size: CGSize(width: baseSz.width * 0.5 * calloutScale * pop,
                                          height: baseSz.height * 0.5 * calloutScale * pop),
                             anchor: CGPoint(x: 0.5, y: 0.5))
                if item.progress > 0.72 {
                    node.alpha = CGFloat(max(0, 1 - (item.progress - 0.72) / 0.28))
                }
            }
        }

        // Weather: wind leaves always, the Squall in its rounds.
        if useArt {
            drawWeather(snap: snap, fx: fx, view: worldRect, reduceMotion: reduceMotion)
        }
        hideUnused()
    }

    // MARK: Forts

    private func drawFort(_ fort: FortView, snap: BattleSnapshot, fx: FieldFX, palette: Palette, useArt: Bool, small: Bool,
                          reduceMotion: Bool, cellsPerPoint: Double, highlightedBlocks: [[Int]] = []) {
        let fortIdx = min(fort.side, fortNodes.count - 1)
        let body = fortNodes[fortIdx]
        body.isHidden = false
        let now = fx.now
        // Walking: the body slides from the old spot to the new one and bobs on its legs.
        let fortWidth = max(fort.block * 3, Double(max(1, fort.cols)) * fort.block)
        let px: Double = fort.originX + fortWidth / 2
        let py: Double = fort.baseY
        var offX = 0.0
        var offY = 0.0
        var tilt = 0.0
        var walking: (t: Double, w: WalkAnim)?
        if let w = fx.walks[fort.side] {
            let t = now - w.start
            let segP = min(1, max(0, (now - w.segStart) / max(1, w.segDuration)))
            offX = -w.dx * (1 - segP)
            if !reduceMotion {
                let frame = Int(t / fx.motion.bobFrameMs) % max(1, fx.motion.bobDy.count)
                offY = -fx.motion.bobDy[frame]
                tilt = frame < fx.motion.bobTilt.count ? fx.motion.bobTilt[frame] : 0
            }
            walking = (t, w)
        }
        body.position = CGPoint(x: px + offX, y: py + offY)
        body.zRotation = CGFloat(-tilt * .pi / 180)
        func local(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x - px, y: y - py) }
        let team = SpriteImages.team(fort.side)
        let isFlattenerSide = fort.side == 1 && !snap.isDuel
        let isTopiaryBoss = fort.side == 1 && (snap.boss != nil || snap.level == "1-10")

        // Soft ground contact shadow beneath the fort (figure-ground grounding, Plate 1).
        if !small {
            let shadow = take("shadow", parent: body, z: 0.7)
            placeTexture(shadow, BattleArtCache.groundShadowTexture, at: local(px, fort.baseY - 4),
                         size: CGSize(width: fortWidth + 32, height: 16), anchor: CGPoint(x: 0.5, y: 0.5))
        }

        // 3 planted Stomper legs ALWAYS visible beneath the Footing (planted at rest, marching during walks!).
        // M-I03: scale clip to footing height (`fort.block / clip.h`) so feet plant cleanly on `fort.baseY`.
        if !small {
            let stomperClip = useArt ? fx.library.clip("stomper_\(team)_walk") : nil
            for (i, frac) in [0.18, 0.50, 0.82].enumerated() {
                let node = take("stomper", parent: body, z: 0.9)
                let legX = fort.originX + fortWidth * frac
                if let clip = stomperClip {
                    let frameName: String
                    if let walking, !reduceMotion {
                        let t = walking.t + Double(i) * 2 * fx.motion.bobFrameMs
                        frameName = clip.frame(at: t)
                    } else {
                        frameName = clip.frames.first ?? ""
                    }
                    let cellsPerPx = CGFloat(fort.block) / max(1, CGFloat(clip.h))
                    let legY = fort.baseY + Double((CGFloat(clip.h) - clip.anchor.y) * cellsPerPx)
                    placeClip(node, frameName, clip, at: local(legX, legY), cellsPerPx: cellsPerPx, flip: fort.side == 1)
                } else {
                    var stepPhase = 0.0
                    if let walking, !reduceMotion { stepPhase = sin(walking.t / 95.0 + Double(i) * 2.1) }
                    let tex = BattleArtCache.stomperTexture(side: fort.side, isFlattener: isFlattenerSide)
                    let legPos = local(legX, fort.baseY + 3)
                    placeTexture(node, tex, at: CGPoint(x: legPos.x, y: legPos.y + CGFloat(stepPhase * 3.5)),
                                 size: CGSize(width: 18, height: 22), anchor: CGPoint(x: 0.5, y: 0.88))
                    node.xScale = fort.side == 1 ? -1 : 1
                }
            }
        }

        // Boss 1-10 The Topiary Keep: sculpted clipped-hedge Topiary Peacock crest & fanned tail!
        if isTopiaryBoss && !small {
            let topY = (fort.blocks.map { $0.y + $0.h }.max() ?? (fort.baseY + 80))
            let crest = take("boss_crest", parent: body, z: 0.82)
            let crestPos = local(px + 6, topY - 12)
            if useArt, let frame = sheet.frame("prop_topiary_peacock_crest") {
                place(crest, frame: frame, at: crestPos, scale: 0.85, flip: false,
                      fallback: palette.grass, fallbackSize: CGSize(width: 136, height: 82))
            } else {
                placeTexture(crest, BattleArtCache.topiaryPeacockTexture, at: crestPos,
                             size: CGSize(width: max(124, fortWidth * 1.15), height: 78),
                             anchor: CGPoint(x: 0.5, y: 0.16))
            }
        }

        // Opaque cutaway interior backing (`#3B2D24`) + warm amber lantern glow (`#FFCE70`) for intact Nooks & Kettle Room (H-I04).
        if !small {
            for room in fort.rooms where room.intact {
                let back = take("room_back", parent: body, z: 0.86)
                placeTexture(back, BattleArtCache.nookRoomTexture, at: local(room.box.midX, room.box.midY),
                             size: CGSize(width: room.box.width + 2, height: room.box.height + 2),
                             anchor: CGPoint(x: 0.5, y: 0.5))
                let roomX0: Double = room.box.x0 - 4
                let roomX1: Double = room.box.x1 + 4
                let roomY0: Double = room.box.y0 - 4
                let roomY1: Double = room.box.y1 + 4
                let occupied = fort.hobs.contains { (h: HobView) -> Bool in
                    if h.isOut { return false }
                    let inX = h.x >= roomX0 && h.x <= roomX1
                    let inY = h.y >= roomY0 && h.y <= roomY1
                    return inX && inY
                }
                if occupied {
                    let glow = take("lantern", parent: body, z: 0.89)
                    placeTexture(glow, BattleArtCache.lanternGlowTexture, at: local(room.box.midX, room.box.midY + 4),
                                 size: CGSize(width: room.box.width * 1.15, height: room.box.height * 1.15),
                                 anchor: CGPoint(x: 0.5, y: 0.5))
                    glow.alpha = 0.72
                    // Subtle 0.18 warm window glaze over occupied cutaway Nooks.
                    let glaze = take("glaze", parent: body, z: 3.1)
                    placeTexture(glaze, BattleArtCache.windowGlazeTexture, at: local(room.box.midX, room.box.midY),
                                 size: CGSize(width: room.box.width, height: room.box.height),
                                 anchor: CGPoint(x: 0.5, y: 0.5))
                    glaze.alpha = 0.18
                }
            }
            if let kr = fort.kettleRoom, fort.kettleIntact {
                let back = take("room_back", parent: body, z: 0.86)
                placeTexture(back, BattleArtCache.nookRoomTexture, at: local(kr.midX, kr.midY),
                             size: CGSize(width: kr.width + 2, height: kr.height + 2),
                             anchor: CGPoint(x: 0.5, y: 0.5))
                if fort.kettleHp > 0 {
                    let glow = take("lantern", parent: body, z: 0.89)
                    placeTexture(glow, BattleArtCache.lanternGlowTexture, at: local(kr.midX, kr.midY),
                                 size: CGSize(width: kr.width * 1.25, height: kr.height * 1.25),
                                 anchor: CGPoint(x: 0.5, y: 0.5))
                    glow.alpha = 0.82
                }
            }
        }

        let shimmerClip = fx.library.clip("fx_shimmer")
        let pickedSet: Set<Int> = fort.side == snap.activeSide && !small
            ? Set(highlightedBlocks.compactMap { $0.count >= 2 ? $0[0] * 10_000 + $0[1] : nil })
            : []
        // Blocks a collapse crushed stay until its ghost blocks land on them (review 2, M6).
        // Exterior walls stay 100% opaque (alpha = 1.0) — zero ghosted own-fort bleed-through!
        let blocks = fort.blocks + fx.held(side: fort.side)
        for (bi, b) in blocks.enumerated() {
            let node = take("block", parent: body, z: 1)
            let ratio = Double(max(0, b.hp)) / Double(max(1, b.hpMax))
            let wear = ratio > 0.66 ? "fresh" : (ratio > 0.33 ? "scuffed" : "battered")
            let mat = FieldFX.materialKey(b.material)
            let f = useArt ? (sheet.frame("block_\(mat)_\(wear)") ?? sheet.frame("block_\(mat)_fresh")) : nil
            let c = Int(((b.x - fort.originX) / fort.block).rounded())
            let r = Int(((b.y - fort.baseY) / fort.block).rounded())
            let picked = pickedSet.contains(c * 10_000 + r)
            node.texture = f?.texture
            if f == nil {
                node.color = picked ? palette.gold : (b.root ? palette.gold : (b.battered ? palette.flattened : palette.material(b.material)))
                node.colorBlendFactor = 1
            } else if picked {
                node.color = palette.gold
                node.colorBlendFactor = 0.55
            } else if b.root || b.battered {
                node.color = b.root ? palette.gold : palette.flattened
                node.colorBlendFactor = b.root ? 0.45 : 0.35
            } else {
                node.color = .white
                node.colorBlendFactor = 0
            }
            node.anchorPoint = .zero
            node.size = CGSize(width: b.w, height: b.h)
            node.position = local(b.x, b.y)
            node.xScale = 1
            node.alpha = 1
            // Boss 1-10 Sprinkler Root weak-spot prop overlay.
            if b.root && !small {
                let rootNode = take("root", parent: body, z: 1.45)
                let rootPos = local(b.x + b.w / 2, b.y + b.h / 2)
                if useArt, let rf = sheet.frame("prop_sprinkler_root") {
                    place(rootNode, frame: rf, at: rootPos, scale: 0.45, flip: false,
                          fallback: palette.gold, fallbackSize: CGSize(width: b.w * 1.4, height: b.h * 1.4))
                } else {
                    placeTexture(rootNode, BattleArtCache.sprinklerRootTexture, at: rootPos,
                                 size: CGSize(width: b.w * 1.45, height: b.h * 1.55), anchor: CGPoint(x: 0.5, y: 0.45))
                }
                rootNode.alpha = reduceMotion ? 1 : CGFloat(0.86 + 0.14 * sin(now / 260))
            }
            // Shimmer: blocks at the end of their reach glint once every 3 s.
            if b.shimmer, useArt, let shimmerClip {
                let t = (now + Double(bi * 211)).truncatingRemainder(dividingBy: 3000)
                if reduceMotion || t < shimmerClip.total {
                    let s = take("shimmer", parent: body, z: 1.1)
                    placeClip(s, shimmerClip.frame(at: reduceMotion ? 0 : t), shimmerClip, at: local(b.x, b.y + b.h),
                              cellsPerPx: 1, flip: false)
                    s.alpha = reduceMotion ? 0.6 : 1
                }
            }
        }

        // Double-weight dark espresso outer silhouette (`3 pt` contour) around the fort exterior (Plate 1).
        if fortIdx < fortContours.count {
            let contour = fortContours[fortIdx]
            if small || blocks.isEmpty {
                contour.isHidden = true
            } else {
                contour.isHidden = false
                contour.lineWidth = CGFloat(max(2.0, 2.8 * cellsPerPoint))
                var hasher = Hasher()
                hasher.combine(blocks.count)
                for b in blocks {
                    hasher.combine(Int(((b.x - fort.originX) / fort.block).rounded()))
                    hasher.combine(Int(((b.y - fort.baseY) / fort.block).rounded()))
                }
                let hashKey = hasher.finalize()
                if fortContourKeys[fortIdx] != hashKey {
                    fortContourKeys[fortIdx] = hashKey
                    contour.path = Self.outerContourPath(blocks: blocks, fort: fort, originOffset: CGPoint(x: -px, y: -py))
                }
            }
        }

        // Team pennant flag atop the highest roof block of the fort (Plate 1).
        if !small, let roofBlock = blocks.max(by: { ($0.y + $0.h) < ($1.y + $1.h) }) {
            let flag = take("flag", parent: body, z: 2.6)
            let poleBase = local(roofBlock.x + roofBlock.w * 0.5, roofBlock.y + roofBlock.h - 1)
            let tex = BattleArtCache.fortPennantTexture(side: fort.side, color: palette.side(fort.side), isFlattener: isFlattenerSide)
            placeTexture(flag, tex, at: poleBase, size: CGSize(width: 24, height: 28), anchor: CGPoint(x: 0.25, y: 0))
            flag.xScale = fort.side == 1 ? -1 : 1
        }

        // Rooms: recessed dark arched Loopholes, Loophole Flaps and Pot Lids (H-I04 intact check, L-I03 useArt check).
        for room in fort.rooms where room.intact {
            let key = "\(fort.side):\(room.id)"
            if let hole = room.loophole, !small {
                // Dark arched Loophole embrasure along the enemy-facing wall.
                let arch = take("loophole", parent: body, z: 1.15)
                let archCenter = local(hole.midX, hole.midY)
                if useArt, let lf = sheet.frame("ui_front_loophole") {
                    place(arch, frame: lf, at: archCenter, scale: 0.55, flip: fort.side == 1,
                          fallback: palette.ink, fallbackSize: CGSize(width: max(8, hole.width), height: max(12, hole.height)))
                } else {
                    placeTexture(arch, BattleArtCache.loopholeArchTexture, at: archCenter,
                                 size: CGSize(width: max(8, hole.width + 4), height: max(12, hole.height + 4)),
                                 anchor: CGPoint(x: 0.5, y: 0.5))
                }
                if useArt {
                    let anim = fx.flaps[key]
                    if room.flap || anim != nil, let clip = fx.library.clip("loophole_flap_\(team)_close") {
                        let node = take("flap", parent: body, z: 1.2)
                        let name: String
                        if let anim {
                            let t = now - anim.start
                            name = anim.closing ? clip.frame(at: t) : (t >= clip.total ? "loophole_open" : clip.frame(at: t, reversed: true))
                        } else {
                            name = clip.hold ?? clip.frames.last ?? ""
                        }
                        placeClip(node, name, clip, at: local(hole.x0, hole.y1 + 5), cellsPerPx: 1, flip: false)
                    }
                }
            }
            if useArt {
                drawLid(key: key, on: room.lid, at: local(room.box.midX, room.box.y1), fx: fx, body: body)
            }
        }
        if let kr = fort.kettleRoom, fort.kettleIntact, useArt {
            drawLid(key: "\(fort.side):kettle", on: fort.kettleLid, at: local(kr.midX, kr.y1), fx: fx, body: body)
        }

        // Brass steam pipe linking the copper Heartkettle down toward the Footing & Stomper legs.
        if !small {
            let pipeH = max(8, fort.kettleY - fort.baseY + 4)
            let pipe = take("steam_pipe", parent: body, z: 1.6)
            placeTexture(pipe, BattleArtCache.steamPipeTexture, at: local(fort.kettleX, fort.baseY - 2),
                         size: CGSize(width: 8, height: pipeH), anchor: CGPoint(x: 0.5, y: 0))
        }

        // The kettle: its state art, the pop animation, steam when critical.
        let pct = fort.kettlePercent
        let state = fort.kettleHp <= 0 ? "popped" : (pct <= 25 ? "critical" : (pct <= 50 ? "hurt" : "full"))
        let kettle = take("kettle", parent: body, z: 2)
        let kPoint = local(fort.kettleX, fort.kettleY)
        if useArt, let pop = fx.kettlePops[fort.side], let clip = fx.library.clip("kettle_pop") {
            placeClip(kettle, clip.frame(at: now - pop.start), clip, at: kPoint, cellsPerPx: 0.75, flip: fort.side == 1)
        } else if useArt, let kFrame = sheet.frame("kettle_\(state)") {
            place(kettle, frame: kFrame, at: kPoint, scale: 0.75, flip: fort.side == 1,
                  fallback: fort.kettleHp > 0 ? palette.kettle : palette.flattened,
                  fallbackSize: CGSize(width: 24, height: 22))
        } else {
            placeTexture(kettle, BattleArtCache.copperKettleTexture(state: state), at: kPoint,
                         size: CGSize(width: 26, height: 24), anchor: CGPoint(x: 0.5, y: 0))
        }
        if useArt, state == "critical", let steam = fx.library.clip("fx_kettle_steam") {
            let s = take("steam", parent: body, z: 2.1)
            placeClip(s, steam.frame(at: reduceMotion ? 0 : now), steam, at: local(fort.kettleX, fort.kettleY + 14),
                      cellsPerPx: 0.8, flip: false)
        }

        // Hobs vs Flatteners ("Round vs Flat" faction silhouettes, Plate 3):
        // Side 1 in non-Duel battles renders rigid vertical Slate-Grey Flatteners with spirit-level
        // caps, green level bubbles, orange ties, and a SQUARE zzz Snooze Balloon when Bonked.
        for h in fort.hobs {
            let node = take("hob", parent: body, z: 3)
            let selected = h.id == snap.selectedHob && fort.side == snap.activeSide
            let aiming = snap.phase == .plan && snap.isHuman(fort.side)
            let lift = fx.bonkLift(side: fort.side, hob: Int(h.id) ?? -1)
            // A Hob that fell with a collapse rides down with its chunk (review 2, M6).
            let drop = fx.hobOffset(side: fort.side, hob: h.id)
            let at = local(h.x + drop.dx, h.y + lift + drop.dy)
            // A Rival's own Hob (a content Hob such as Marge) wears the Rival look; Neat Brigade
            // units stay Flatteners (assets bundle, play and look pass).
            let rivalHob = SpriteImages.hobArtName(id: h.def, name: "") != nil
            let bodyYScale: CGFloat = h.isCrushed ? Self.crushedScale : 1.0
            if isFlattenerSide && !rivalHob && !small {
                if useArt, let fPick = fx.flattenerSprite(side: fort.side, hob: h, selected: selected,
                                                          aiming: aiming, power: snap.aim.power, sheet: sheet) {
                    placeClip(node, fPick.0, fPick.1, at: at, cellsPerPx: Self.hobCellsPerPixel, flip: true)
                    drawOverlays(for: fPick.0, parent: body, at: at, cellsPerPx: Self.hobCellsPerPixel, flip: true, z: 3.04, yScale: bodyYScale)
                } else {
                    let fk = SpriteImages.flattenerArtName(def: h.def, cls: h.cls)
                    let poseInfo = fx.flattenerPose(side: fort.side, hob: h, selected: selected, aiming: aiming, power: snap.aim.power)
                    let tilted = poseInfo.pose == "hit" || poseInfo.pose == "tumble" || h.isOut || h.isCrushed
                    let tex = BattleArtCache.flattenerTexture(kind: fk, bonked: h.isOut, tilted: tilted)
                    let hSize: CGSize = h.isOut ? CGSize(width: 34, height: 52) : CGSize(width: 24, height: 34)
                    placeTexture(node, tex, at: at, size: hSize, anchor: CGPoint(x: 0.5, y: 0))
                    node.xScale = -1
                }
            } else if useArt, let pick = fx.hobSprite(side: fort.side, hob: h, selected: selected, aiming: aiming, power: snap.aim.power) {
                placeClip(node, pick.0, pick.1, at: at, cellsPerPx: Self.hobCellsPerPixel, flip: fort.side == 1)
                drawOverlays(for: pick.0, parent: body, at: at, cellsPerPx: Self.hobCellsPerPixel, flip: fort.side == 1, z: 3.04, yScale: bodyYScale)
            } else {
                let bonked = h.isOut
                if !small {
                    let tex = BattleArtCache.hobFallbackTexture(side: fort.side, color: palette.side(fort.side), bonked: bonked)
                    let sz: CGSize = bonked ? CGSize(width: 34, height: 50) : CGSize(width: 24, height: 30)
                    placeTexture(node, tex, at: at, size: sz, anchor: CGPoint(x: 0.5, y: 0))
                    node.xScale = fort.side == 1 ? -1 : 1
                } else {
                    place(node, frame: nil, at: at, scale: 1, flip: fort.side == 1,
                          fallback: bonked ? palette.flattened : palette.side(fort.side),
                          fallbackSize: CGSize(width: 18, height: 18))
                }
            }
            // Squashed is not Bonked (QA playtest 2, N2): drawn flattened, with three small
            // stars over its head, and still live.
            if h.isCrushed {
                node.yScale = Self.crushedScale
                if !small {
                    for i in 0..<3 {
                        let star = take("star", parent: body, z: 3.2)
                        star.texture = Self.starTexture
                        star.color = .white
                        star.colorBlendFactor = 0
                        star.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                        star.size = CGSize(width: 9, height: 9)
                        let turn = (reduceMotion ? 0 : now / 600) + Double(i) * 2.094
                        star.position = CGPoint(x: at.x + CGFloat(11 * cos(turn)), y: at.y + CGFloat(24 + 4 * sin(turn)))
                        star.zRotation = CGFloat(reduceMotion ? 0 : now / 400)
                    }
                }
            }
        }
    }

    /// Computes exposed exterior edges of a fort's blocks for the double-weight espresso silhouette contour.
    private static func outerContourPath(blocks: [BlockView], fort: FortView, originOffset: CGPoint) -> CGPath {
        var occupied = Set<CellKey>()
        occupied.reserveCapacity(blocks.count)
        for b in blocks {
            let c = Int(((b.x - fort.originX) / fort.block).rounded())
            let r = Int(((b.y - fort.baseY) / fort.block).rounded())
            occupied.insert(CellKey(c: c, r: r))
        }
        let path = CGMutablePath()
        for b in blocks {
            let c = Int(((b.x - fort.originX) / fort.block).rounded())
            let r = Int(((b.y - fort.baseY) / fort.block).rounded())
            let x0 = CGFloat(b.x) + originOffset.x
            let y0 = CGFloat(b.y) + originOffset.y
            let x1 = x0 + CGFloat(b.w)
            let y1 = y0 + CGFloat(b.h)
            if !occupied.contains(CellKey(c: c - 1, r: r)) {
                path.move(to: CGPoint(x: x0, y: y0)); path.addLine(to: CGPoint(x: x0, y: y1))
            }
            if !occupied.contains(CellKey(c: c + 1, r: r)) {
                path.move(to: CGPoint(x: x1, y: y0)); path.addLine(to: CGPoint(x: x1, y: y1))
            }
            if !occupied.contains(CellKey(c: c, r: r + 1)) {
                path.move(to: CGPoint(x: x0, y: y1)); path.addLine(to: CGPoint(x: x1, y: y1))
            }
            if !occupied.contains(CellKey(c: c, r: r - 1)) {
                path.move(to: CGPoint(x: x0, y: y0)); path.addLine(to: CGPoint(x: x1, y: y0))
            }
        }
        return path
    }

    /// How flat a squashed Hob is drawn (its height, as a share).
    static let crushedScale: CGFloat = 0.55

    /// A small gold star, drawn once.
    private static let starTexture: SKTexture = {
        let size = CGSize(width: 18, height: 18)
        let image = UIGraphicsImageRenderer(size: size).image { ctx in
            let path = UIBezierPath()
            let c = CGPoint(x: 9, y: 9)
            for k in 0..<10 {
                let r: CGFloat = k % 2 == 0 ? 8.5 : 3.6
                let a = CGFloat(k) * .pi / 5 - .pi / 2
                let p = CGPoint(x: c.x + r * cos(a), y: c.y + r * sin(a))
                if k == 0 { path.move(to: p) } else { path.addLine(to: p) }
            }
            path.close()
            UIColor(red: 1, green: 0.76, blue: 0.24, alpha: 1).setFill()
            path.fill()
            UIColor(red: 0.17, green: 0.13, blue: 0.12, alpha: 1).setStroke()
            path.lineWidth = 1.2
            path.stroke()
            _ = ctx
        }
        return SKTexture(image: image)
    }()

    private func drawLid(key: String, on: Bool, at point: CGPoint, fx: FieldFX, body: SKNode) {
        guard let clip = fx.library.clip("pot_lid_raise") else { return }
        let anim = fx.lids[key]
        guard on || anim != nil else { return }
        let node = take("lid", parent: body, z: 2.4)
        let name: String
        if let anim {
            let t = fx.now - anim.start
            if anim.raising {
                name = clip.frame(at: t)
            } else {
                guard t < clip.total else { node.isHidden = true; return }
                name = clip.frame(at: t, reversed: true)
            }
        } else {
            name = clip.hold ?? clip.frames.last ?? ""
        }
        placeClip(node, name, clip, at: point, cellsPerPx: 0.6, flip: false)
    }

    // MARK: Weather

    private func drawWeather(snap: BattleSnapshot, fx: FieldFX, view: CGRect, reduceMotion: Bool) {
        let now = reduceMotion ? 0 : fx.now
        func frac(_ v: Double) -> Double { v - floor(v) }
        let width = Double(view.width), height = Double(view.height)
        if snap.wind != 0, let leaf = fx.library.clip("fx_wind_leaf") {
            let n = min(6, abs(snap.wind))
            let speed = Double(snap.wind) * 22
            for i in 0..<n {
                let seed = Double(i) * 0.618
                let x = Double(view.minX) + frac(seed + now / 1000 * speed / max(1, width)) * width
                let y = Double(view.minY) + (0.35 + 0.5 * frac(seed * 3.7)) * height + sin(now / 400 + Double(i)) * 6
                let node = take("leaf", parent: world, z: 6.5)
                placeClip(node, leaf.frame(at: now + Double(i) * 70), leaf, at: CGPoint(x: x, y: y), cellsPerPx: 1, flip: snap.wind < 0)
            }
        }
        if snap.squallRound > 0, let squall = fx.library.clip("fx_squall") {
            let n = 4 + 2 * snap.squallRound
            let dir = snap.wind >= 0 ? 1.0 : -1.0
            for i in 0..<n {
                let seed = Double(i) * 0.381
                let x = Double(view.minX) + frac(seed + now / 1000 * 120 * dir / max(1, width)) * width
                let y = Double(view.minY) + (0.2 + 0.7 * frac(seed * 5.3)) * height
                let node = take("squall", parent: world, z: 6.6)
                placeClip(node, squall.frame(at: now + Double(i) * 45), squall, at: CGPoint(x: x, y: y), cellsPerPx: 1.6, flip: dir < 0)
                node.alpha = 0.8
            }
        }
    }

    // MARK: Terrain

    /// Draws the real cell grid: one sprite per chunk, its texture rebuilt only
    /// when that chunk changed (H6). All-air chunks have no sprite.
    private func updateTerrain(grid: TerrainGrid, textures: TerrainTextures) {
        terrainLayer.isHidden = false
        if terrainGrid !== grid {
            terrainLayer.removeAllChildren()
            terrainNodes = [:]
            terrainDrawn = [:]
            terrainGrid = grid
            terrainVersion = -1
        }
        guard grid.version != terrainVersion else { return }
        terrainVersion = grid.version
        let H = CGFloat(grid.h)
        for i in 0..<grid.chunkVersions.count {
            let v = grid.chunkVersions[i]
            guard v > 0, terrainDrawn[i] != v else { continue }
            terrainDrawn[i] = v
            let tex = textures.texture(grid: grid, index: i)
            guard let tex else {
                terrainNodes[i]?.isHidden = true
                continue
            }
            let node: SKSpriteNode
            if let n = terrainNodes[i] {
                node = n
            } else {
                node = SKSpriteNode(texture: tex)
                node.anchorPoint = .zero
                terrainLayer.addChild(node)
                terrainNodes[i] = node
            }
            let c = i % grid.cols, r = i / grid.cols
            let x0 = CGFloat(c * grid.chunk), y0 = CGFloat(r * grid.chunk)
            let size = tex.size()
            node.texture = tex
            node.size = size
            node.position = CGPoint(x: x0, y: H - y0 - size.height)
            node.isHidden = false
        }
    }

    private func updateGround(snap: BattleSnapshot, palette: Palette) {
        ground.fillColor = palette.dirt
        ground.strokeColor = palette.grass
        ground.lineWidth = 6
        guard snap.terrain != lastTerrain || snap.world.w != lastWorldW else { return }
        lastTerrain = snap.terrain
        lastWorldW = snap.world.w
        guard snap.terrain.count > 1 else {
            ground.path = nil
            return
        }
        let n = snap.terrain.count
        let step = snap.world.w / Double(n - 1)
        let path = CGMutablePath()
        path.move(to: CGPoint(x: -400, y: -600))
        path.addLine(to: CGPoint(x: -400, y: snap.terrain[0]))
        for i in 0..<n {
            path.addLine(to: CGPoint(x: Double(i) * step, y: snap.terrain[i]))
        }
        path.addLine(to: CGPoint(x: snap.world.w + 400, y: snap.terrain[n - 1]))
        path.addLine(to: CGPoint(x: snap.world.w + 400, y: -600))
        path.closeSubpath()
        ground.path = path
    }

    // MARK: Placing sprites & --v2 overlays

    private func placeTexture(_ node: SKSpriteNode, _ texture: SKTexture, at point: CGPoint, size: CGSize, anchor: CGPoint) {
        node.position = point
        node.texture = texture
        node.color = .white
        node.colorBlendFactor = 0
        node.size = size
        node.anchorPoint = anchor
        node.xScale = 1
        node.yScale = 1
    }

    /// Puts a sprite frame with its anchor at `point`. `scale` is world cells per @1x pixel.
    /// Automatically honors `--v2` tight alpha-bbox `drawSize` and `trimOffset`!
    private func place(_ node: SKSpriteNode, frame: SpriteSheet.Frame?, at point: CGPoint, scale: CGFloat, flip: Bool,
                       fallback: UIColor, fallbackSize: CGSize) {
        node.position = point
        if let frame {
            node.texture = frame.texture
            node.colorBlendFactor = 0
            node.color = .white
            node.size = CGSize(width: frame.drawSize.width * scale, height: frame.drawSize.height * scale)
            node.anchorPoint = frame.spriteKitAnchor()
        } else {
            node.texture = nil
            node.color = fallback
            node.colorBlendFactor = 1
            node.size = fallbackSize
            node.anchorPoint = CGPoint(x: 0.5, y: 0)
        }
        node.xScale = flip ? -1 : 1
    }

    /// Puts one frame of an animation with the clip's shared size and anchor at `point`.
    /// When the atlas frame is `--v2` trimmed, uses `frame.drawSize` and shifts anchor by `trimOffset`.
    private func placeClip(_ node: SKSpriteNode, _ frameName: String, _ clip: AnimClip, at point: CGPoint, cellsPerPx: CGFloat, flip: Bool) {
        node.position = point
        guard let frame = sheet.frame(frameName) else {
            node.isHidden = true
            return
        }
        node.texture = frame.texture
        node.colorBlendFactor = 0
        node.color = .white
        if frame.isTrimmed {
            node.size = CGSize(width: frame.drawSize.width * cellsPerPx, height: frame.drawSize.height * cellsPerPx)
            node.anchorPoint = frame.spriteKitAnchor(untrimmedAnchor: clip.anchor)
        } else {
            let w = CGFloat(clip.w), h = CGFloat(clip.h)
            node.size = CGSize(width: w * cellsPerPx, height: h * cellsPerPx)
            node.anchorPoint = CGPoint(x: clip.anchor.x / max(1, w), y: 1 - clip.anchor.y / max(1, h))
        }
        node.xScale = flip ? -1 : 1
    }

    /// Composites `--v2` team scarf / snooze-balloon overlays on top of a deduplicated Hob frame.
    /// M-I04: scales both vertical offset and overlay height by `yScale` when the Hob is squashed.
    private func drawOverlays(for frameName: String, parent: SKNode, at point: CGPoint,
                              cellsPerPx: CGFloat, flip: Bool, z: CGFloat, yScale: CGFloat = 1) {
        let list = sheet.overlays(for: frameName)
        guard !list.isEmpty else { return }
        let dir: CGFloat = flip ? -1 : 1
        for (idx, ov) in list.enumerated() {
            guard let ovFrame = sheet.frame(ov.sprite) else { continue }
            let ovNode = take("overlay", parent: parent, z: z + CGFloat(idx) * 0.01)
            let ovScale = CGFloat(ov.scale ?? 1) * cellsPerPx
            // Overlay dx/dy in castle@2x.json are @1x px relative to feet anchor in y-down space.
            let pos = CGPoint(x: point.x + dir * CGFloat(ov.dx) * cellsPerPx,
                              y: point.y - CGFloat(ov.dy) * cellsPerPx * yScale)
            place(ovNode, frame: ovFrame, at: pos, scale: ovScale, flip: flip, fallback: .clear, fallbackSize: .zero)
            ovNode.yScale = yScale
            if let rot = ov.rot, rot != 0 {
                ovNode.zRotation = CGFloat(-rot * .pi / 180) * dir
            }
        }
    }
}

// MARK: Pre-rendered CoreGraphics Art Cache (Cutaway Rooms, Flatteners, Boss Props, Outlined Callouts)

/// Caches crisp CoreGraphics-rendered `SKTexture`s for the Part 2 visual overhaul so
/// atmospheric backdrops, cutaway Nooks, planted Stompers, Slate-Grey Flatteners,
/// Topiary Peacock boss props, Rescue Cage, and outlined damage numbers look art-directed
/// even before regenerated PNGs are copied into the bundle.
@MainActor
private enum BattleArtCache {
    private static var flattenerCache: [String: SKTexture] = [:]
    private static var hobCache: [String: SKTexture] = [:]
    private static var kettleCache: [String: SKTexture] = [:]
    private static var stomperCache: [String: SKTexture] = [:]
    private static var pennantCache: [String: SKTexture] = [:]
    private static var calloutCache: [String: SKTexture] = [:]
    private static var pearlCache: [Int: SKTexture] = [:]
    private static var lastShotDotCache: [String: SKTexture] = [:]

    /// Cached circular painterly pearl trajectory bead texture (tier 0 cream, 1 gold, 2 ember) with espresso ink stroke.
    static func pearlBeadTexture(tier: Int) -> SKTexture {
        if let hit = pearlCache[tier] { return hit }
        let sz = CGSize(width: 32, height: 32)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let cg = ctx.cgContext
            let center = CGPoint(x: 16, y: 16)
            let haloColor: UIColor
            let fillColor: UIColor
            switch tier {
            case 2:
                haloColor = Palette.hex(0xF26430)
                fillColor = Palette.hex(0xFF914D)
            case 1:
                haloColor = Palette.hex(0xFFD66B)
                fillColor = Palette.hex(0xFFE58F)
            default:
                haloColor = Palette.hex(0xFFF3CF)
                fillColor = Palette.hex(0xFFF8E7)
            }
            let haloColors = [haloColor.withAlphaComponent(0.50).cgColor,
                              haloColor.withAlphaComponent(0.0).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: haloColors, locations: [0.35, 1.0]) {
                cg.drawRadialGradient(grad, startCenter: center, startRadius: 6,
                                      endCenter: center, endRadius: 15.5, options: [])
            }
            let bead = UIBezierPath(ovalIn: CGRect(x: 6.5, y: 6.5, width: 19, height: 19))
            fillColor.setFill()
            bead.fill()
            Palette.hex(0x2C221E).setStroke()
            bead.lineWidth = 2.6
            bead.stroke()
            let glint = UIBezierPath(ovalIn: CGRect(x: 10.5, y: 9.5, width: 5.5, height: 4.0))
            UIColor.white.withAlphaComponent(0.82).setFill()
            glint.fill()
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        pearlCache[tier] = tex
        return tex
    }

    /// Cached circular stroked dot for the picked Hob's last-shot arc (replaces unstroked squares).
    static func lastShotDotTexture(side: Int, color: UIColor) -> SKTexture {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        let key = "\(side):\(Int(r * 255)):\(Int(g * 255)):\(Int(b * 255))"
        if let hit = lastShotDotCache[key] { return hit }
        let sz = CGSize(width: 20, height: 20)
        let img = UIGraphicsImageRenderer(size: sz).image { _ in
            let dot = UIBezierPath(ovalIn: CGRect(x: 3.5, y: 3.5, width: 13, height: 13))
            color.setFill()
            dot.fill()
            Palette.hex(0x2C221E).setStroke()
            dot.lineWidth = 2.2
            dot.stroke()
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        if lastShotDotCache.count > 16 { lastShotDotCache.removeAll() }
        lastShotDotCache[key] = tex
        return tex
    }

    static let skyTexture: SKTexture = {
        let sz = CGSize(width: 16, height: 256)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let colors = [Palette.hex(0x88C8E6).cgColor, Palette.hex(0xA6DCEF).cgColor, Palette.hex(0xF5EED8).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.62, 1.0]) {
                ctx.cgContext.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: sz.height), options: [])
            }
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        return tex
    }()

    /// Distant Puddingstone Downs hills glazed with ~18% cool sky atmospheric haze.
    static let farHillsTexture: SKTexture = {
        let sz = CGSize(width: 512, height: 140)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let p = UIBezierPath()
            p.move(to: CGPoint(x: 0, y: sz.height))
            p.addLine(to: CGPoint(x: 0, y: 74))
            p.addCurve(to: CGPoint(x: 170, y: 42), controlPoint1: CGPoint(x: 55, y: 34), controlPoint2: CGPoint(x: 115, y: 66))
            p.addCurve(to: CGPoint(x: 350, y: 56), controlPoint1: CGPoint(x: 235, y: 18), controlPoint2: CGPoint(x: 290, y: 70))
            p.addCurve(to: CGPoint(x: 512, y: 48), controlPoint1: CGPoint(x: 415, y: 34), controlPoint2: CGPoint(x: 465, y: 24))
            p.addLine(to: CGPoint(x: sz.width, y: sz.height))
            p.close()
            // Cool atmospheric sky-tinted hill green (#97C0B8)
            Palette.hex(0x97C0B8).setFill()
            p.fill()
            _ = ctx
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        return tex
    }()

    static let midHillsTexture: SKTexture = {
        let sz = CGSize(width: 512, height: 120)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let p = UIBezierPath()
            p.move(to: CGPoint(x: 0, y: sz.height))
            p.addLine(to: CGPoint(x: 0, y: 62))
            p.addCurve(to: CGPoint(x: 195, y: 36), controlPoint1: CGPoint(x: 75, y: 80), controlPoint2: CGPoint(x: 130, y: 20))
            p.addCurve(to: CGPoint(x: 390, y: 44), controlPoint1: CGPoint(x: 265, y: 56), controlPoint2: CGPoint(x: 320, y: 22))
            p.addCurve(to: CGPoint(x: 512, y: 58), controlPoint1: CGPoint(x: 440, y: 58), controlPoint2: CGPoint(x: 485, y: 44))
            p.addLine(to: CGPoint(x: sz.width, y: sz.height))
            p.close()
            // Soft mid-ground sage-meadow (#84B888)
            Palette.hex(0x84B888).setFill()
            p.fill()
            _ = ctx
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        return tex
    }()

    static let groundShadowTexture: SKTexture = {
        let sz = CGSize(width: 128, height: 32)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let cg = ctx.cgContext
            let colors = [Palette.hex(0x2C221E).withAlphaComponent(0.34).cgColor,
                          Palette.hex(0x2C221E).withAlphaComponent(0.0).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                cg.saveGState()
                cg.scaleBy(x: 1, y: 0.25)
                cg.drawRadialGradient(grad, startCenter: CGPoint(x: 64, y: 64), startRadius: 4,
                                      endCenter: CGPoint(x: 64, y: 64), endRadius: 60, options: [])
                cg.restoreGState()
            }
        }
        return SKTexture(image: img)
    }()

    /// Opaque `#3B2D24` recessed cutaway timber chamber backing (eliminates tree bleed-through).
    static let nookRoomTexture: SKTexture = {
        let sz = CGSize(width: 64, height: 64)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            Palette.hex(0x3B2D24).setFill()
            ctx.fill(CGRect(origin: .zero, size: sz))
            // Subtle warm timber wainscot planks
            Palette.hex(0x4C3A2E).setStroke()
            let cg = ctx.cgContext
            cg.setLineWidth(1.2)
            for x in stride(from: 12, to: 64, by: 14) {
                cg.move(to: CGPoint(x: CGFloat(x), y: 4))
                cg.addLine(to: CGPoint(x: CGFloat(x), y: 60))
            }
            cg.strokePath()
            // Recessed inner frame shadow
            Palette.hex(0x261C17).setStroke()
            cg.setLineWidth(4)
            cg.stroke(CGRect(x: 2, y: 2, width: 60, height: 60))
        }
        return SKTexture(image: img)
    }()

    /// Warm `#FFCE70` radial lantern rim-light glow for occupied Nooks & Kettle Room.
    static let lanternGlowTexture: SKTexture = {
        let sz = CGSize(width: 64, height: 64)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let colors = [Palette.hex(0xFFCE70).withAlphaComponent(0.55).cgColor,
                          Palette.hex(0xFFCE70).withAlphaComponent(0.18).cgColor,
                          Palette.hex(0xFFCE70).withAlphaComponent(0.0).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.55, 1]) {
                ctx.cgContext.drawRadialGradient(grad, startCenter: CGPoint(x: 32, y: 28), startRadius: 2,
                                                 endCenter: CGPoint(x: 32, y: 32), endRadius: 31, options: [])
            }
        }
        return SKTexture(image: img)
    }()

    /// Subtle `0.18` warm glass specular glaze over occupied Nooks.
    static let windowGlazeTexture: SKTexture = {
        let sz = CGSize(width: 64, height: 64)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let p = UIBezierPath()
            p.move(to: CGPoint(x: 8, y: 6))
            p.addLine(to: CGPoint(x: 28, y: 6))
            p.addLine(to: CGPoint(x: 8, y: 34))
            p.close()
            UIColor.white.setFill()
            p.fill()
            let p2 = UIBezierPath()
            p2.move(to: CGPoint(x: 36, y: 6))
            p2.addLine(to: CGPoint(x: 44, y: 6))
            p2.addLine(to: CGPoint(x: 10, y: 52))
            p2.addLine(to: CGPoint(x: 6, y: 44))
            p2.close()
            p2.fill()
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    static let loopholeArchTexture: SKTexture = {
        let sz = CGSize(width: 24, height: 32)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let arch = UIBezierPath()
            arch.move(to: CGPoint(x: 4, y: 28))
            arch.addLine(to: CGPoint(x: 4, y: 12))
            arch.addArc(withCenter: CGPoint(x: 12, y: 12), radius: 8, startAngle: .pi, endAngle: 0, clockwise: true)
            arch.addLine(to: CGPoint(x: 20, y: 28))
            arch.close()
            Palette.hex(0x2C221E).setFill()
            arch.fill()
            Palette.hex(0xC88A2E).setStroke()
            arch.lineWidth = 2.2
            arch.stroke()
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    static let steamPipeTexture: SKTexture = {
        let sz = CGSize(width: 16, height: 64)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let rect = CGRect(x: 3, y: 0, width: 10, height: 64)
            Palette.hex(0xC88A2E).setFill()
            ctx.fill(rect)
            Palette.hex(0xFFE08A).setFill()
            ctx.fill(CGRect(x: 5, y: 0, width: 3, height: 64))
            Palette.hex(0x2C221E).setStroke()
            ctx.cgContext.setLineWidth(1.8)
            ctx.cgContext.stroke(rect)
            for y in [16, 44] as [CGFloat] {
                let collar = CGRect(x: 1.5, y: y, width: 13, height: 5)
                Palette.hex(0xFFC23D).setFill()
                ctx.fill(collar)
                ctx.cgContext.stroke(collar)
            }
        }
        return SKTexture(image: img)
    }()

    static func stomperTexture(side: Int, isFlattener: Bool) -> SKTexture {
        let key = "\(side)_\(isFlattener)"
        if let hit = stomperCache[key] { return hit }
        let sz = CGSize(width: 36, height: 44)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            let metal = isFlattener ? Palette.hex(0x5A6572) : Palette.hex(0x7B6B5A)
            let accent = isFlattener ? Palette.hex(0xE8730C) : Palette.hex(0xC88A2E)

            // Upper piston leg
            let leg = UIBezierPath(roundedRect: CGRect(x: 11, y: 2, width: 14, height: 24), cornerRadius: 4)
            metal.setFill(); leg.fill()
            ink.setStroke(); leg.lineWidth = 2.6; leg.stroke()

            // Brass knee joint
            let knee = UIBezierPath(ovalIn: CGRect(x: 12, y: 18, width: 12, height: 10))
            accent.setFill(); knee.fill()
            ink.setStroke(); knee.lineWidth = 2.2; knee.stroke()

            // Planted broad iron stomper boot
            let foot = UIBezierPath(roundedRect: CGRect(x: 4, y: 28, width: 28, height: 12), cornerRadius: 5)
            Palette.hex(0x463E3B).setFill(); foot.fill()
            ink.setStroke(); foot.lineWidth = 2.8; foot.stroke()

            // Rivets
            Palette.hex(0xFFE08A).setFill()
            UIBezierPath(ovalIn: CGRect(x: 9, y: 32, width: 3.5, height: 3.5)).fill()
            UIBezierPath(ovalIn: CGRect(x: 23.5, y: 32, width: 3.5, height: 3.5)).fill()
            _ = ctx
        }
        let tex = SKTexture(image: img)
        stomperCache[key] = tex
        return tex
    }

    static func copperKettleTexture(state: String) -> SKTexture {
        if let hit = kettleCache[state] { return hit }
        let sz = CGSize(width: 52, height: 48)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            let copper = state == "popped" ? Palette.hex(0x6E6A68) : Palette.hex(0xD9773A)
            let pot = UIBezierPath(ovalIn: CGRect(x: 8, y: 12, width: 36, height: 32))
            copper.setFill(); pot.fill()
            ink.setStroke(); pot.lineWidth = 3; pot.stroke()
            // Specular highlight
            Palette.hex(0xFFE08A).withAlphaComponent(0.75).setFill()
            UIBezierPath(ovalIn: CGRect(x: 14, y: 17, width: 11, height: 7)).fill()
            // Brass lid
            let lid = UIBezierPath(roundedRect: CGRect(x: 15, y: 7, width: 22, height: 8), cornerRadius: 4)
            Palette.hex(0xFFC23D).setFill(); lid.fill()
            ink.setStroke(); lid.lineWidth = 2.4; lid.stroke()
            // Glowing dial core
            let glow = state == "critical" ? Palette.hex(0xC9363E) : (state == "popped" ? Palette.hex(0x3B3338) : Palette.hex(0x4FE3C1))
            let dial = UIBezierPath(ovalIn: CGRect(x: 20, y: 22, width: 12, height: 12))
            glow.setFill(); dial.fill()
            ink.setStroke(); dial.lineWidth = 2; dial.stroke()
            _ = ctx
        }
        let tex = SKTexture(image: img)
        kettleCache[state] = tex
        return tex
    }

    static func fortPennantTexture(side: Int, color: UIColor, isFlattener: Bool) -> SKTexture {
        let key = "\(side)_\(color.description)_\(isFlattener)"
        if let hit = pennantCache[key] { return hit }
        let sz = CGSize(width: 48, height: 56)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            // Mast pole
            let mast = UIBezierPath()
            mast.move(to: CGPoint(x: 12, y: 8))
            mast.addLine(to: CGPoint(x: 12, y: 54))
            ink.setStroke(); mast.lineWidth = 3.5; mast.lineCapStyle = .round; mast.stroke()
            // Brass finial
            let finial = UIBezierPath(ovalIn: CGRect(x: 8, y: 3, width: 8, height: 8))
            Palette.hex(0xFFC23D).setFill(); finial.fill()
            ink.setStroke(); finial.lineWidth = 2; finial.stroke()
            // Swallowtail pennant
            let flag = UIBezierPath()
            flag.move(to: CGPoint(x: 12, y: 11))
            flag.addLine(to: CGPoint(x: 45, y: 18))
            flag.addLine(to: CGPoint(x: 36, y: 24))
            flag.addLine(to: CGPoint(x: 45, y: 31))
            flag.addLine(to: CGPoint(x: 12, y: 33))
            flag.close()
            let flagFill: UIColor = isFlattener ? Palette.hex(0x5A6572) : color
            flagFill.setFill(); flag.fill()
            if isFlattener {
                // Sharp orange Flattener stripe
                let stripe = UIBezierPath(rect: CGRect(x: 13, y: 19, width: 24, height: 6))
                Palette.hex(0xE8730C).setFill(); stripe.fill()
            }
            ink.setStroke(); flag.lineWidth = 2.6; flag.lineJoinStyle = .round; flag.stroke()
            _ = ctx
        }
        let tex = SKTexture(image: img)
        pennantCache[key] = tex
        return tex
    }

    /// Bespoke procedural rigid tall rectilinear Slate-Grey Flattener rig (Plate 3 "Round vs Flat").
    static func flattenerTexture(kind: String, bonked: Bool, tilted: Bool) -> SKTexture {
        let key = "\(kind)_\(bonked)_\(tilted)"
        if let hit = flattenerCache[key] { return hit }
        let sz: CGSize = bonked ? CGSize(width: 68, height: 104) : CGSize(width: 48, height: 68)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            let slate = Palette.hex(0x5A6572)
            let slateLight = Palette.hex(0x7E8A98)
            let orange = Palette.hex(0xE8730C)
            let bubble = Palette.hex(0x4ADE80)
            let baseY = sz.height - 4
            let cx = sz.width * 0.5

            // Square zzz Snooze Balloon above when Bonked (Plate 3: Square vs Round!).
            if bonked {
                let str = UIBezierPath()
                str.move(to: CGPoint(x: cx, y: baseY - 46))
                str.addLine(to: CGPoint(x: cx, y: 34))
                ink.setStroke(); str.lineWidth = 2.4; str.stroke()
                let cube = UIBezierPath(roundedRect: CGRect(x: cx - 18, y: 4, width: 36, height: 30), cornerRadius: 2)
                Palette.hex(0xC8D0DC).setFill(); cube.fill()
                ink.setStroke(); cube.lineWidth = 3; cube.stroke()
                // Angular Z glyphs
                let zPath = UIBezierPath()
                zPath.move(to: CGPoint(x: cx - 9, y: 14)); zPath.addLine(to: CGPoint(x: cx - 1, y: 14))
                zPath.addLine(to: CGPoint(x: cx - 9, y: 24)); zPath.addLine(to: CGPoint(x: cx - 1, y: 24))
                zPath.move(to: CGPoint(x: cx + 3, y: 12)); zPath.addLine(to: CGPoint(x: cx + 11, y: 12))
                zPath.addLine(to: CGPoint(x: cx + 3, y: 22)); zPath.addLine(to: CGPoint(x: cx + 11, y: 22))
                ink.setStroke(); zPath.lineWidth = 2.4; zPath.stroke()
            }

            // Straight dark uniform legs (rectilinear)
            let leftLeg = UIBezierPath(rect: CGRect(x: cx - 9, y: baseY - 12, width: 7, height: 12))
            let rightLeg = UIBezierPath(rect: CGRect(x: cx + 2, y: baseY - 12, width: 7, height: 12))
            Palette.hex(0x3D4652).setFill(); leftLeg.fill(); rightLeg.fill()
            ink.setStroke(); leftLeg.lineWidth = 2.4; leftLeg.stroke(); rightLeg.lineWidth = 2.4; rightLeg.stroke()

            // Tall rigid rectilinear Slate-Grey uniform torso (sharp shoulders!)
            let torso = UIBezierPath(roundedRect: CGRect(x: cx - 12, y: baseY - 38, width: 24, height: 27), cornerRadius: 2)
            slate.setFill(); torso.fill()
            // Pressed lapel crease
            let lapel = UIBezierPath(rect: CGRect(x: cx - 10, y: baseY - 36, width: 5, height: 23))
            slateLight.setFill(); lapel.fill()
            ink.setStroke(); torso.lineWidth = 3; torso.stroke()

            // Sharp orange tie
            let tie = UIBezierPath()
            tie.move(to: CGPoint(x: cx, y: baseY - 36))
            tie.addLine(to: CGPoint(x: cx + 3.5, y: baseY - 22))
            tie.addLine(to: CGPoint(x: cx, y: baseY - 17))
            tie.addLine(to: CGPoint(x: cx - 3.5, y: baseY - 22))
            tie.close()
            orange.setFill(); tie.fill()
            ink.setStroke(); tie.lineWidth = 1.8; tie.stroke()

            // Stark white gloves + straight tool
            let gloveL = UIBezierPath(roundedRect: CGRect(x: cx - 17, y: baseY - 27, width: 7, height: 8), cornerRadius: 2)
            let gloveR = UIBezierPath(roundedRect: CGRect(x: cx + 10, y: baseY - 27, width: 7, height: 8), cornerRadius: 2)
            UIColor.white.setFill(); gloveL.fill(); gloveR.fill()
            ink.setStroke(); gloveL.lineWidth = 2.2; gloveL.stroke(); gloveR.lineWidth = 2.2; gloveR.stroke()
            let tool = UIBezierPath(rect: CGRect(x: cx + 14, y: baseY - 40, width: 4, height: 26))
            let toolFill: UIColor = kind == "snipper" ? orange : slateLight
            toolFill.setFill(); tool.fill()
            ink.setStroke(); tool.lineWidth = 1.8; tool.stroke()

            // Blocky head
            let head = UIBezierPath(roundedRect: CGRect(x: cx - 9, y: baseY - 52, width: 18, height: 15), cornerRadius: 3)
            Palette.hex(0xEAD3C0).setFill(); head.fill()
            ink.setStroke(); head.lineWidth = 2.6; head.stroke()
            // Stern brows / X-eyes if bonked
            let eyes = UIBezierPath()
            eyes.move(to: CGPoint(x: cx - 5, y: baseY - 45)); eyes.addLine(to: CGPoint(x: cx - 1, y: baseY - 45))
            eyes.move(to: CGPoint(x: cx + 1, y: baseY - 45)); eyes.addLine(to: CGPoint(x: cx + 5, y: baseY - 45))
            ink.setStroke(); eyes.lineWidth = 2; eyes.stroke()

            // Flat spirit-level pancake cap with bright #4ADE80 green level bubble!
            ctx.cgContext.saveGState()
            let capPivot = CGPoint(x: cx, y: baseY - 54)
            ctx.cgContext.translateBy(x: capPivot.x, y: capPivot.y)
            if tilted { ctx.cgContext.rotate(by: 0.24) }
            let brim = UIBezierPath(rect: CGRect(x: -16, y: -4, width: 32, height: 5))
            slate.setFill(); brim.fill()
            ink.setStroke(); brim.lineWidth = 2.4; brim.stroke()
            let crown = UIBezierPath(rect: CGRect(x: -11, y: -11, width: 22, height: 8))
            slateLight.setFill(); crown.fill()
            ink.setStroke(); crown.lineWidth = 2.4; crown.stroke()
            // Spirit-level vial & bright green bubble
            let vial = UIBezierPath(roundedRect: CGRect(x: -7, y: -9.5, width: 14, height: 5), cornerRadius: 2)
            Palette.hex(0xE8F8EC).setFill(); vial.fill()
            let bx: CGFloat = tilted ? 2.5 : -2.5
            let bub = UIBezierPath(ovalIn: CGRect(x: bx, y: -9, width: 5, height: 4))
            bubble.setFill(); bub.fill()
            ink.setStroke(); vial.lineWidth = 1.4; vial.stroke()
            ctx.cgContext.restoreGState()
        }
        let tex = SKTexture(image: img)
        flattenerCache[key] = tex
        return tex
    }

    /// Plump round storybook Hob fallback (with round puffy Snooze Balloon when Bonked).
    static func hobFallbackTexture(side: Int, color: UIColor, bonked: Bool) -> SKTexture {
        let key = "\(side)_\(color.description)_\(bonked)"
        if let hit = hobCache[key] { return hit }
        let sz: CGSize = bonked ? CGSize(width: 68, height: 100) : CGSize(width: 48, height: 60)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            let cx = sz.width * 0.5
            let baseY = sz.height - 4
            if bonked {
                let str = UIBezierPath()
                str.move(to: CGPoint(x: cx, y: baseY - 38))
                str.addQuadCurve(to: CGPoint(x: cx, y: 34), controlPoint: CGPoint(x: cx + 6, y: (baseY - 38 + 34) / 2))
                ink.setStroke(); str.lineWidth = 2.2; str.stroke()
                let balloon = UIBezierPath(ovalIn: CGRect(x: cx - 18, y: 4, width: 36, height: 32))
                Palette.hex(0xFFF4DE).setFill(); balloon.fill()
                ink.setStroke(); balloon.lineWidth = 3; balloon.stroke()
            }
            // Round plump Hob coat
            let coat = UIBezierPath(ovalIn: CGRect(x: cx - 14, y: baseY - 32, width: 28, height: 28))
            Palette.hex(0xD8984C).setFill(); coat.fill()
            ink.setStroke(); coat.lineWidth = 3; coat.stroke()
            // Team scarf
            let scarf = UIBezierPath(roundedRect: CGRect(x: cx - 13, y: baseY - 34, width: 26, height: 7), cornerRadius: 3)
            color.setFill(); scarf.fill()
            ink.setStroke(); scarf.lineWidth = 2.2; scarf.stroke()
            // Round head + domed cap
            let head = UIBezierPath(ovalIn: CGRect(x: cx - 10, y: baseY - 49, width: 20, height: 18))
            Palette.hex(0xF6D2B2).setFill(); head.fill()
            ink.setStroke(); head.lineWidth = 2.6; head.stroke()
            let hat = UIBezierPath(ovalIn: CGRect(x: cx - 12, y: baseY - 56, width: 24, height: 11))
            color.setFill(); hat.fill()
            ink.setStroke(); hat.lineWidth = 2.4; hat.stroke()
            _ = ctx
        }
        let tex = SKTexture(image: img)
        hobCache[key] = tex
        return tex
    }

    /// 1-10 Boss sculpted clipped-hedge Topiary Peacock crest & fanned tail (Plate 1).
    static let topiaryPeacockTexture: SKTexture = {
        let sz = CGSize(width: 240, height: 150)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            let cx: CGFloat = 120, cy: CGFloat = 126
            // 7 fanned sculpted hedge tail plumes with golden eye-spots
            for i in -3...3 {
                let angle = CGFloat(i) * 0.34 - .pi / 2
                let tip = CGPoint(x: cx + cos(angle) * 96, y: cy + sin(angle) * 92)
                let plume = UIBezierPath()
                plume.move(to: CGPoint(x: cx, y: cy))
                let left = CGPoint(x: cx + cos(angle - 0.16) * 76, y: cy + sin(angle - 0.16) * 72)
                let right = CGPoint(x: cx + cos(angle + 0.16) * 76, y: cy + sin(angle + 0.16) * 72)
                plume.addQuadCurve(to: tip, controlPoint: left)
                plume.addQuadCurve(to: CGPoint(x: cx, y: cy), controlPoint: right)
                plume.close()
                let plumeFill: UIColor = i % 2 == 0 ? Palette.hex(0x2F7E36) : Palette.hex(0x3D9642)
                plumeFill.setFill()
                plume.fill()
                ink.setStroke(); plume.lineWidth = 3.2; plume.stroke()
                // Gold-ringed peacock eye-spot
                let eyeCenter = CGPoint(x: cx + cos(angle) * 70, y: cy + sin(angle) * 68)
                let outerEye = UIBezierPath(ovalIn: CGRect(x: eyeCenter.x - 10, y: eyeCenter.y - 10, width: 20, height: 20))
                Palette.hex(0xFFC23D).setFill(); outerEye.fill()
                ink.setStroke(); outerEye.lineWidth = 2; outerEye.stroke()
                let innerEye = UIBezierPath(ovalIn: CGRect(x: eyeCenter.x - 5, y: eyeCenter.y - 5, width: 10, height: 10))
                Palette.hex(0x2F6FDE).setFill(); innerEye.fill()
            }
            // Sculpted peacock neck & crowned head
            let neck = UIBezierPath(roundedRect: CGRect(x: cx - 14, y: 54, width: 28, height: 68), cornerRadius: 14)
            Palette.hex(0x266B2C).setFill(); neck.fill()
            ink.setStroke(); neck.lineWidth = 3.2; neck.stroke()
            let head = UIBezierPath(ovalIn: CGRect(x: cx - 18, y: 36, width: 36, height: 30))
            Palette.hex(0x3D9642).setFill(); head.fill()
            ink.setStroke(); head.lineWidth = 3.2; head.stroke()
            // Brass beak pointing left toward player
            let beak = UIBezierPath()
            beak.move(to: CGPoint(x: cx - 16, y: 48))
            beak.addLine(to: CGPoint(x: cx - 34, y: 53))
            beak.addLine(to: CGPoint(x: cx - 15, y: 58))
            beak.close()
            Palette.hex(0xFFC23D).setFill(); beak.fill()
            ink.setStroke(); beak.lineWidth = 2.4; beak.stroke()
            // Topiary crown sprigs
            for dx in [-8, 0, 8] as [CGFloat] {
                let dot = UIBezierPath(ovalIn: CGRect(x: cx + dx - 3.5, y: 24, width: 7, height: 7))
                Palette.hex(0xFFC23D).setFill(); dot.fill()
                ink.setStroke(); dot.lineWidth = 1.6; dot.stroke()
            }
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    /// 1-10 Boss glowing vine-wrapped Sprinkler Root emblem (Plate 3).
    static let sprinklerRootTexture: SKTexture = {
        let sz = CGSize(width: 56, height: 60)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            // Soft amber-teal glow
            Palette.hex(0x4FE3C1).withAlphaComponent(0.35).setFill()
            UIBezierPath(ovalIn: CGRect(x: 4, y: 6, width: 48, height: 48)).fill()
            // Brass sprinkler head + valve
            let body = UIBezierPath(roundedRect: CGRect(x: 16, y: 16, width: 24, height: 32), cornerRadius: 8)
            Palette.hex(0xFFC23D).setFill(); body.fill()
            ink.setStroke(); body.lineWidth = 2.8; body.stroke()
            // Emerald vines wrapping root
            let vine = UIBezierPath()
            vine.move(to: CGPoint(x: 10, y: 44))
            vine.addCurve(to: CGPoint(x: 46, y: 20), controlPoint1: CGPoint(x: 20, y: 24), controlPoint2: CGPoint(x: 34, y: 42))
            Palette.hex(0x1F6B29).setStroke(); vine.lineWidth = 5; vine.lineCapStyle = .round; vine.stroke()
            Palette.hex(0x8BD888).setStroke(); vine.lineWidth = 2; vine.stroke()
            // Top brass spray jet
            let jet = UIBezierPath(roundedRect: CGRect(x: 22, y: 6, width: 12, height: 10), cornerRadius: 3)
            Palette.hex(0xC88A2E).setFill(); jet.fill()
            ink.setStroke(); jet.lineWidth = 2.2; jet.stroke()
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    /// 1-10 Boss vintage `Big Smoothie Jr.` steam roller (Plate 1 & 3).
    static let rollerTexture: SKTexture = {
        let sz = CGSize(width: 120, height: 76)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            // Chimney stack
            let stack = UIBezierPath(roundedRect: CGRect(x: 28, y: 8, width: 12, height: 24), cornerRadius: 2)
            Palette.hex(0x3D4652).setFill(); stack.fill()
            ink.setStroke(); stack.lineWidth = 2.8; stack.stroke()
            // Boiler body
            let boiler = UIBezierPath(roundedRect: CGRect(x: 22, y: 26, width: 70, height: 26), cornerRadius: 8)
            Palette.hex(0x5A6572).setFill(); boiler.fill()
            ink.setStroke(); boiler.lineWidth = 3; boiler.stroke()
            // Brass trim band
            let band = UIBezierPath(rect: CGRect(x: 46, y: 27, width: 16, height: 24))
            Palette.hex(0xFFC23D).setFill(); band.fill()
            ink.setStroke(); band.lineWidth = 2; band.stroke()
            // Heavy front iron flattening drum
            let drum = UIBezierPath(ovalIn: CGRect(x: 6, y: 38, width: 34, height: 34))
            Palette.hex(0x7E8A98).setFill(); drum.fill()
            ink.setStroke(); drum.lineWidth = 3.2; drum.stroke()
            let hub = UIBezierPath(ovalIn: CGRect(x: 18, y: 50, width: 10, height: 10))
            Palette.hex(0xE8730C).setFill(); hub.fill()
            ink.setStroke(); hub.lineWidth = 2; hub.stroke()
            // Rear wheel
            let wheel = UIBezierPath(ovalIn: CGRect(x: 78, y: 40, width: 32, height: 32))
            Palette.hex(0x463E3B).setFill(); wheel.fill()
            ink.setStroke(); wheel.lineWidth = 3; wheel.stroke()
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    /// A sign line from `hud.signs` on two rows: broken at the space nearest the middle.
    static func signLines(_ line: String) -> String {
        let spaces = line.indices.filter { line[$0] == " " }
        guard !spaces.isEmpty else { return line }
        let middle = line.count / 2
        let best = spaces.min { a, b in
            abs(line.distance(from: line.startIndex, to: a) - middle) < abs(line.distance(from: line.startIndex, to: b) - middle)
        } ?? spaces[0]
        var out = line
        out.replaceSubrange(best...best, with: "\n")
        return out
    }

    /// 1-10 Boss lawn sign, its words from `hud.signs` (Plate 1).
    static let lawnSignTexture: SKTexture = {
        let sz = CGSize(width: 68, height: 56)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            let post = UIBezierPath(rect: CGRect(x: 30, y: 28, width: 8, height: 26))
            Palette.hex(0x7B4E29).setFill(); post.fill()
            ink.setStroke(); post.lineWidth = 2.4; post.stroke()
            let board = UIBezierPath(roundedRect: CGRect(x: 4, y: 6, width: 60, height: 26), cornerRadius: 4)
            Palette.hex(0xFFF4DE).setFill(); board.fill()
            ink.setStroke(); board.lineWidth = 2.6; board.stroke()
            let style = NSMutableParagraphStyle(); style.alignment = .center
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 7.5, weight: .heavy),
                .foregroundColor: ink,
                .paragraphStyle: style,
            ]
            NSString(string: BattleArtCache.signLines(GameText.shared.pool("hud.signs").first ?? "")).draw(in: CGRect(x: 6, y: 9, width: 56, height: 22), withAttributes: attrs)
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    /// 1-10 Boss brass-hinged orange-handled Topiary Shears (Plate 1 & 3).
    static let shearsTexture: SKTexture = {
        let sz = CGSize(width: 76, height: 56)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            // Twin steel blades
            let b1 = UIBezierPath()
            b1.move(to: CGPoint(x: 34, y: 28)); b1.addLine(to: CGPoint(x: 4, y: 12)); b1.addLine(to: CGPoint(x: 30, y: 34)); b1.close()
            let b2 = UIBezierPath()
            b2.move(to: CGPoint(x: 34, y: 28)); b2.addLine(to: CGPoint(x: 4, y: 44)); b2.addLine(to: CGPoint(x: 30, y: 22)); b2.close()
            Palette.hex(0xC8D0DC).setFill(); b1.fill(); b2.fill()
            ink.setStroke(); b1.lineWidth = 2.6; b1.stroke(); b2.lineWidth = 2.6; b2.stroke()
            // Orange handles
            let h1 = UIBezierPath(roundedRect: CGRect(x: 36, y: 10, width: 34, height: 11), cornerRadius: 5)
            let h2 = UIBezierPath(roundedRect: CGRect(x: 36, y: 35, width: 34, height: 11), cornerRadius: 5)
            Palette.hex(0xE8730C).setFill(); h1.fill(); h2.fill()
            ink.setStroke(); h1.lineWidth = 2.6; h1.stroke(); h2.lineWidth = 2.6; h2.stroke()
            // Brass pivot bolt
            let bolt = UIBezierPath(ovalIn: CGRect(x: 29, y: 21, width: 14, height: 14))
            Palette.hex(0xFFC23D).setFill(); bolt.fill()
            ink.setStroke(); bolt.lineWidth = 2.4; bolt.stroke()
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    /// 1-7 ornate wrought-iron hanging Rescue Cage bar (Plate 3).
    static let cageBarTexture: SKTexture = {
        let sz = CGSize(width: 28, height: 96)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let ink = Palette.hex(0x2C221E)
            // Brass top suspension ring
            let ring = UIBezierPath(ovalIn: CGRect(x: 8, y: 2, width: 12, height: 12))
            Palette.hex(0xFFC23D).setStroke(); ring.lineWidth = 3; ring.stroke()
            // Ornate wrought-iron vertical bars
            let barL = UIBezierPath(roundedRect: CGRect(x: 5, y: 14, width: 6, height: 78), cornerRadius: 2)
            let barR = UIBezierPath(roundedRect: CGRect(x: 17, y: 14, width: 6, height: 78), cornerRadius: 2)
            Palette.hex(0x4E5460).setFill(); barL.fill(); barR.fill()
            ink.setStroke(); barL.lineWidth = 2; barL.stroke(); barR.lineWidth = 2; barR.stroke()
            // Riveted iron crossbars
            for y in [18, 52, 84] as [CGFloat] {
                let cross = UIBezierPath(roundedRect: CGRect(x: 2, y: y, width: 24, height: 7), cornerRadius: 2)
                Palette.hex(0x3D434F).setFill(); cross.fill()
                ink.setStroke(); cross.lineWidth = 2; cross.stroke()
            }
            _ = ctx
        }
        return SKTexture(image: img)
    }()

    static let rescueHaloTexture: SKTexture = {
        let sz = CGSize(width: 64, height: 64)
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            let colors = [Palette.hex(0xFFE08A).withAlphaComponent(0.65).cgColor,
                          Palette.hex(0xFFC23D).withAlphaComponent(0.0).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                ctx.cgContext.drawRadialGradient(grad, startCenter: CGPoint(x: 32, y: 32), startRadius: 6,
                                                 endCenter: CGPoint(x: 32, y: 32), endRadius: 30, options: [])
            }
        }
        return SKTexture(image: img)
    }()

    static let captiveHettyTexture: SKTexture = {
        BattleArtCache.hobFallbackTexture(side: 0, color: Palette.hex(0x2F6FDE), bonked: false)
    }()

    /// Outlined floating combat number / `Drop!` starburst texture (Plate 2).
    static func calloutTexture(text: String, style: CalloutStyle) -> SKTexture {
        let key = "\(style)_\(text)"
        if let hit = calloutCache[key] { return hit }
        let isDrop = style == .drop
        let font = UIFont.systemFont(ofSize: isDrop ? 28 : 26, weight: .black)
        let fill: UIColor
        switch style {
        case .hobHit: fill = Palette.hex(0xFFC23D)
        case .wallBreak: fill = Palette.hex(0xFFF4DE)
        case .drop: fill = Palette.hex(0x2C221E)
        case .kettleHit: fill = Palette.hex(0xFF9E44)
        case .mend: fill = Palette.hex(0x4FE3C1)
        }
        let attrs: [NSAttributedString.Key: Any] = isDrop
            ? [.font: font, .foregroundColor: fill]
            : [.font: font, .foregroundColor: fill, .strokeColor: Palette.hex(0x2C221E), .strokeWidth: -5.5]
        let ns = NSString(string: text)
        let textSz = ns.size(withAttributes: attrs)
        let padX: CGFloat = isDrop ? 22 : 10
        let padY: CGFloat = isDrop ? 16 : 6
        let sz = CGSize(width: ceil(textSz.width + padX * 2), height: ceil(textSz.height + padY * 2))
        let img = UIGraphicsImageRenderer(size: sz).image { ctx in
            if isDrop {
                // Starburst yellow plaque behind `Drop!`
                let star = UIBezierPath()
                let cx = sz.width / 2, cy = sz.height / 2
                let rx = sz.width * 0.48, ry = sz.height * 0.48
                let points = 12
                for k in 0..<(points * 2) {
                    let frac: CGFloat = k % 2 == 0 ? 1.0 : 0.74
                    let a = CGFloat(k) * .pi / CGFloat(points)
                    let pt = CGPoint(x: cx + cos(a) * rx * frac, y: cy + sin(a) * ry * frac)
                    if k == 0 { star.move(to: pt) } else { star.addLine(to: pt) }
                }
                star.close()
                Palette.hex(0xFFE08A).setFill(); star.fill()
                Palette.hex(0x2C221E).setStroke(); star.lineWidth = 3.2; star.stroke()
            }
            ns.draw(at: CGPoint(x: (sz.width - textSz.width) / 2, y: (sz.height - textSz.height) / 2), withAttributes: attrs)
            _ = ctx
        }
        let tex = SKTexture(image: img)
        if calloutCache.count > 64 { calloutCache.removeAll() }
        calloutCache[key] = tex
        return tex
    }
}

/// One texture per terrain chunk, shared by every lens and rebuilt only when
/// the chunk's version changes.
@MainActor
final class TerrainTextures {
    private weak var grid: TerrainGrid?
    private var cache: [Int: (version: Int, texture: SKTexture?)] = [:]

    nonisolated init() {}

    func texture(grid g: TerrainGrid, index i: Int) -> SKTexture? {
        if grid !== g {
            grid = g
            cache = [:]
        }
        let v = i < g.chunkVersions.count ? g.chunkVersions[i] : 0
        if let hit = cache[i], hit.version == v { return hit.texture }
        var tex: SKTexture?
        if let img = g.rgba(chunkIndex: i) {
            let t = SKTexture(data: img.data, size: CGSize(width: img.w, height: img.h))
            t.filteringMode = .nearest
            tex = t
        }
        cache[i] = (v, tex)
        return tex
    }
}

/// What a lens needs beyond the frame: the Fatigue home hold, the Rival peek, the owner ring,
/// and any own-fort block targets picked for Mendglob or Mend Bucket.
struct LensExtras: Equatable {
    var home: Int?
    var peek = false
    var ownerRing = false
    var highlightedBlocks: [[Int]] = []
}

/// View-only camera framing: which part of the field each lens wants to show
/// (UX 3.5). The rig eases toward it. World units are cells, y up.
@MainActor
enum Camera {
    static func fortRect(_ side: Int, snap: BattleSnapshot) -> CGRect {
        let worldW = snap.world.w
        guard let f = snap.fort(side), !(f.blocks.isEmpty && f.hobs.isEmpty) else {
            let x = side == 0 ? worldW * 0.15 : worldW * 0.85
            return CGRect(x: x - 120, y: snap.groundAt(x) - 40, width: 240, height: 200)
        }
        var minX = f.x - 40, maxX = f.x + 40
        var minY = snap.groundAt(f.x), maxY = minY + 64
        for b in f.blocks {
            minX = min(minX, b.x); maxX = max(maxX, b.x + b.w)
            minY = min(minY, b.y); maxY = max(maxY, b.y + b.h)
        }
        for h in f.hobs {
            minX = min(minX, h.x - 20); maxX = max(maxX, h.x + 20)
            maxY = max(maxY, h.y + 44)
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// Blocks must draw at least this big (points) for the plan frame to hold both forts
    /// (QA playtest 1, M3); smaller, it frames your fort and the arc, with a Rival edge marker.
    static let minBlockPoints: CGFloat = 8
    /// On a phone the plan frame may go down to 6 pt blocks to hold both forts (QA playtest 2, N3).
    static let phoneMinBlockPoints: CGFloat = 6

    /// The size a 16-cell block draws at when `rect` is fitted into a frame of `frame`.
    static func blockPoints(_ rect: CGRect, in frame: CGSize) -> CGFloat {
        guard rect.width > 0, rect.height > 0 else { return 0 }
        return 16 * min(frame.width / rect.width, frame.height / rect.height)
    }

    /// The arc you can see, as a rect (null when there is none).
    private static func previewRect(_ snap: BattleSnapshot) -> CGRect {
        var r = CGRect.null
        var i = 0
        while i + 1 < snap.preview.count {
            r = r.union(CGRect(x: snap.preview[i] - 8, y: snap.preview[i + 1] - 8, width: 16, height: 16))
            i += 2
        }
        return r
    }

    /// Margins, and the 55/45 lean toward the fort being shot at. The lean widens the frame on
    /// the target side instead of sliding it, so it never pushes a fort out (QA playtest 1, M3).
    private static func framed(_ r: CGRect, activeSide: Int) -> CGRect {
        var out = r.insetBy(dx: -90, dy: -40).offsetBy(dx: 0, dy: 60)
        let lean = out.width * 0.1
        out.size.width += lean
        if activeSide != 0 { out.origin.x -= lean }
        return out
    }

    /// Both forts plus the arc you can see, leaning toward the fort `side` shoots at.
    static func bothRect(_ snap: BattleSnapshot, side: Int? = nil) -> CGRect {
        let r = fortRect(0, snap: snap).union(fortRect(1, snap: snap)).union(previewRect(snap))
        return framed(r, activeSide: side ?? snap.activeSide)
    }

    /// Your fort (the side on turn, or `side`) plus the arc you can see.
    static func ownPlanRect(_ snap: BattleSnapshot, side: Int? = nil) -> CGRect {
        let own = side ?? snap.activeSide
        let r = fortRect(own, snap: snap).union(previewRect(snap))
        return framed(r, activeSide: own)
    }

    /// The plan frame: both forts when their blocks still draw at `minBlock` points or more in a
    /// frame of `frame` (8, or 6 on a phone), else your fort and the arc. Without a frame size,
    /// and while peeking at the Rival fort, both forts at any zoom.
    static func planRect(_ snap: BattleSnapshot, frame: CGSize? = nil, minBlock: CGFloat = 8,
                         side: Int? = nil, peek: Bool = false) -> CGRect {
        let both = bothRect(snap, side: side)
        if peek { return both }
        guard let frame, frame.width > 0, frame.height > 0 else { return both }
        return blockPoints(both, in: frame) >= minBlock ? both : ownPlanRect(snap, side: side)
    }

    /// A press away from your fort pans the plan camera by `pan` cells; the frame stays within
    /// the field (with a little margin).
    static func panned(_ rect: CGRect, by pan: Double, worldW: Double) -> CGRect {
        guard pan != 0 else { return rect }
        let margin: CGFloat = 120
        let lo: CGFloat = min(rect.minX, -margin)
        let hi: CGFloat = max(rect.minX, CGFloat(worldW) + margin - rect.width)
        let x: CGFloat = min(max(rect.minX + CGFloat(pan), lo), hi)
        return CGRect(x: x, y: rect.minY, width: rect.width, height: rect.height)
    }

    /// Where `world` (cells, y up) lands in view points when `worldRect` is fitted into `frame`.
    static func viewRect(of world: CGRect, worldRect: CGRect, frame: CGRect) -> CGRect {
        let scale = min(frame.width / max(1, worldRect.width), frame.height / max(1, worldRect.height))
        let x0 = frame.midX + (world.minX - worldRect.midX) * scale
        let x1 = frame.midX + (world.maxX - worldRect.midX) * scale
        let yTop = frame.midY - (world.maxY - worldRect.midY) * scale
        let yBottom = frame.midY - (world.minY - worldRect.midY) * scale
        return CGRect(x: x0, y: yTop, width: x1 - x0, height: yBottom - yTop)
    }

    /// The marker's words: a button that peeks at both forts, then brings you back.
    static func markerText(peek: Bool) -> String { GameText.shared.t(peek ? "hud.view_mine" : "hud.view_rival") }

    /// The Rival fort edge marker: -1 when the fort being shot at is off the left of the frame,
    /// +1 off the right, nil when it is in view.
    static func rivalEdge(worldRect: CGRect, snap: BattleSnapshot) -> Int? {
        let rival = fortRect(1 - snap.activeSide, snap: snap)
        if rival.midX > worldRect.maxX { return 1 }
        if rival.midX < worldRect.minX { return -1 }
        return nil
    }

    /// `home`: while the Fatigue collapse plays and settles, the camera holds that side's fort
    /// (both forts when they fit) instead of the hit (QA playtest 2, N1). `peek`: both forts.
    static func worldRect(for focus: LensFocus, snap: BattleSnapshot, fx: FieldFX? = nil, current: CGRect? = nil,
                          frame: CGSize? = nil, minBlock: CGFloat = 8, home: Int? = nil,
                          peek: Bool = false) -> CGRect {
        let worldW = snap.world.w
        let own = home ?? snap.activeSide
        switch focus {
        case .whole:
            let low = snap.terrain.min() ?? 0
            let top = (snap.terrain.max() ?? 300) + 140
            return CGRect(x: 0, y: low - 20, width: worldW, height: max(100, top - low))
        case .both:
            return planRect(snap, frame: frame, minBlock: minBlock, side: home, peek: peek)
        case .own:
            return fortRect(own, snap: snap).insetBy(dx: -170, dy: -60).offsetBy(dx: own == 0 ? 110 : -110, dy: 40)
        case .target:
            var targetRect = fortRect(1 - own, snap: snap)
            // In Rescue stages (e.g. 1-7 Hetty in a Jam), keep Hetty's Rescue Cage visible in Portrait Top Lens until freed.
            let rescueProps = snap.props.filter { !$0.broken && ($0.kind == "cage_bar" || $0.kind == "captive") }
            for rp in rescueProps {
                targetRect = targetRect.union(CGRect(x: rp.x - 24, y: rp.y - 12, width: 48, height: 64))
            }
            return targetRect.insetBy(dx: -150, dy: -50).offsetBy(dx: 0, dy: 30)
        case .follow:
            if let home, snap.shells.isEmpty {
                return planRect(snap, frame: frame, minBlock: minBlock, side: home)
            }
            let base = fortRect(0, snap: snap).union(fortRect(1, snap: snap)).insetBy(dx: -80, dy: -40)
            if !snap.shells.isEmpty {
                // Follow the shell with lookahead along its flight, and keep the fort it heads for in view.
                let target = fortRect(1 - snap.activeSide, snap: snap)
                var r = CGRect.null
                for sh in snap.shells {
                    let a = Double(sh.rot) / 10 * .pi / 180
                    let lead = CGPoint(x: sh.x + cos(a) * 140, y: sh.y + sin(a) * 90)
                    r = r.union(CGRect(x: sh.x - 160, y: sh.y - 110, width: 320, height: 220))
                    r = r.union(CGRect(x: lead.x - 60, y: lead.y - 60, width: 120, height: 120))
                }
                r = r.union(target.insetBy(dx: -30, dy: -20))
                if fx?.reduceMotion == true { r = r.union(base) }
                return r
            }
            // Impact: hold on the hit for 0.6 s, then widen to show the settle.
            if let fx, let hit = fx.lastImpact, DispatchTime.now().uptimeNanoseconds &- hit.at < 600_000_000 {
                let size = current?.size ?? CGSize(width: 520, height: 300)
                return CGRect(x: hit.x - size.width / 2, y: hit.y - size.height / 2, width: size.width, height: size.height)
            }
            return base.offsetBy(dx: 0, dy: 60)
        }
    }
}

/// Colours from the Part 2 Brickabrac palette (`#2C221E` dark espresso ink, `#5A6572` Flattener slate).
struct Palette {
    var ink = Palette.hex(0x2C221E)
    var paper = Palette.hex(0xFFF4DE)
    var sky = Palette.hex(0xA6DCEF)
    var grass = Palette.hex(0x8BCB3A)
    var dirt = Palette.hex(0x9A6A3A)
    var kettle = Palette.hex(0xD9773A)
    var flattened = Palette.hex(0x5A6572)
    var you = Palette.hex(0x2F6FDE)
    var rival = Palette.hex(0xE8730C)
    var gold = Palette.hex(0xFFC23D)
    var cage = Palette.hex(0x4E5460)

    init(set: ColourSet) {
        switch set {
        case .brickabrac: break
        case .dusk:
            you = Palette.hex(0x1B2A6B)
            rival = Palette.hex(0xF2C200)
        case .ink:
            you = Palette.hex(0xFFFFFF)
            rival = Palette.hex(0x1A1A1A)
        }
    }

    func side(_ s: Int) -> UIColor { s == 0 ? you : rival }

    func material(_ m: String) -> UIColor {
        switch m {
        case "wicker": return Palette.hex(0xE3B565)
        case "timber": return Palette.hex(0xB9733A)
        case "cobble": return Palette.hex(0xA9A39A)
        case "brassbound": return Palette.hex(0x6B7A86)
        case "moonbrick": return Palette.hex(0xE6E9F5)
        case "footing": return Palette.hex(0x5A4A42)
        default: return Palette.hex(0xB9733A)
        }
    }

    static func hex(_ v: UInt32) -> UIColor {
        UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
                blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}

/// One lens's camera: view points (UIKit, y down) to world cells (y up) and back.
struct LensMap: Equatable {
    var viewport: CGRect
    var frameCentre: CGPoint
    var worldRect: CGRect
    var scale: CGFloat
    var sceneHeight: CGFloat

    func world(_ p: CGPoint) -> CGPoint {
        let s = max(0.0001, scale)
        return CGPoint(x: (p.x - frameCentre.x) / s + worldRect.midX,
                       y: (sceneHeight - p.y - frameCentre.y) / s + worldRect.midY)
    }

    func view(_ w: CGPoint) -> CGPoint {
        CGPoint(x: frameCentre.x + (w.x - worldRect.midX) * scale,
                y: sceneHeight - (frameCentre.y + (w.y - worldRect.midY) * scale))
    }
}

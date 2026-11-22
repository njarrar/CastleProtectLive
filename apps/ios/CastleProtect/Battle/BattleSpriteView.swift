import SpriteKit
import UIKit

/// The battle field: an SKView whose scene is updated from the latest core
/// snapshot when it changes (and four times a second for idle poses). It also
/// reads touches for the Aim Drag. The battle clock itself runs in the session.
/// Drawing only: nothing here decides an outcome.
final class BattleSKView: SKView {
    var session: BattleSession {
        didSet { wireLensMap() }
    }
    private let battleScene: BattleScene
    private var link: CADisplayLink?
    private var lastBoundsSize: CGSize = .zero
    private var aimTouch: UITouch?
    private var drawnVersion = -1
    private var drawnLayout = BattleLayout.empty
    private var drawnColours = ColourSet.brickabrac
    private var drawnPose: UInt64 = 0

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
        wireLensMap()
        isAccessibilityElement = true
        accessibilityLabel = "Battlefield"
        updateHint()
        NotificationCenter.default.addObserver(self, selector: #selector(voiceOverChanged),
                                               name: UIAccessibility.voiceOverStatusDidChangeNotification, object: nil)
    }

    @objc private func voiceOverChanged() { updateHint() }

    /// The session asks where a touch lands in the world (the own-fort rule for an Aim Drag).
    private func wireLensMap() {
        let scene = WeakRef(battleScene)
        session.lensMap = { point in scene.value?.lensMap(at: point) }
    }

    private func updateHint() {
        // A VoiceOver user cannot drag on the fort: point them at Fine Tune (M5).
        accessibilityHint = UIAccessibility.isVoiceOverRunning
            ? "Use the aim readout to open Fine Tune, then Fire."
            : "Drag on your fort to aim."
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        link?.invalidate()
        link = nil
        guard window != nil else { return }
        let l = CADisplayLink(target: self, selector: #selector(frameTick))
        l.add(to: .main, forMode: .common)
        link = l
    }

    @objc private func frameTick() {
        let now = DispatchTime.now().uptimeNanoseconds
        // Idle poses step at 5 a second (the idle frames are 400 ms; a blink is an active clip and
        // draws every frame while it plays). Effects, flight and the camera draw every frame (review 2, M7).
        let pose = now / 200_000_000
        let colours = session.settings.colourSet
        let busy = session.fx.isActive || session.snapshot.phase.isResolving || battleScene.cameraMoving
        // Draw only when something changed (H8, M1).
        guard busy || session.frameVersion != drawnVersion || session.layout != drawnLayout || colours != drawnColours
                || pose != drawnPose else { return }
        drawnVersion = session.frameVersion
        drawnLayout = session.layout
        drawnColours = colours
        drawnPose = pose
        battleScene.render(snapshot: session.snapshot, layout: session.layout, fx: session.fx, colours: colours,
                           dragging: session.dragging, reduceMotion: session.settings.reduceMotion,
                           pan: session.cameraPan, panning: session.panning)
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
        }
    }

    // MARK: Touches (UX 3.1, 3.9)

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        let active = event?.allTouches?.filter { $0.phase != .ended && $0.phase != .cancelled } ?? touches
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

    /// True while any lens camera is still easing toward its target.
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
                pan: Double = 0, panning: Bool = false) {
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
                             pan: pan, panning: panning)
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

/// One lens: a crop node over its viewport, a backdrop, and a world node that
/// the camera scales and moves. Nodes are pooled and reused every frame.
@MainActor
final class LensLayer {
    let crop = SKCropNode()
    let rig = CameraRig()
    /// This lens's camera at the last draw (nil for the Field Strip, which is not aimed in).
    private(set) var map: LensMap?
    private let mask = SKSpriteNode(color: .white, size: CGSize(width: 1, height: 1))
    private let backdrop = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
    private let world = SKNode()
    private let ground = SKShapeNode()
    private let cutLine = SKShapeNode()
    private let sheet: SpriteSheet
    private var lastTerrain: [Double] = []
    private var lastWorldW = 0.0
    /// One body node per fort, so a walk moves and bobs everything on it.
    private var fortNodes: [SKNode] = []
    private var pools: [String: [SKSpriteNode]] = [:]
    private var used: [String: Int] = [:]
    private let terrainLayer = SKNode()
    private var terrainNodes: [Int: SKSpriteNode] = [:]
    private var terrainDrawn: [Int: Int] = [:]
    private var terrainGrid: TerrainGrid?
    private var terrainVersion = -1
    /// "Rival fort" on the screen edge when the fort being shot at is out of frame (QA playtest 1, M3).
    private let marker = SKNode()
    private let markerLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private let markerArrow = SKShapeNode()
    private let markerPlate = SKShapeNode()

    /// World cells per @1x pixel for Hob frames (72 x 80 px at @1x), so a Hob
    /// stands about two blocks tall in its Nook. Blocks are 1 cell a pixel.
    static let hobCellsPerPixel: CGFloat = 0.5

    init(sheet: SpriteSheet) {
        self.sheet = sheet
        crop.maskNode = mask
        backdrop.zPosition = -10
        crop.addChild(backdrop)
        crop.addChild(world)
        ground.zPosition = 0
        world.addChild(ground)
        terrainLayer.zPosition = 0.5
        world.addChild(terrainLayer)
        cutLine.zPosition = 8
        cutLine.strokeColor = Palette.hex(0xE5484D)
        cutLine.lineWidth = 2
        cutLine.isHidden = true
        world.addChild(cutLine)
        for _ in 0..<2 {
            let n = SKNode()
            n.zPosition = 1
            world.addChild(n)
            fortNodes.append(n)
        }
        marker.zPosition = 20
        marker.isHidden = true
        markerPlate.lineWidth = 2
        markerPlate.strokeColor = Palette.hex(0x2B1E2E)
        markerPlate.fillColor = Palette.hex(0xFFF4DE)
        marker.addChild(markerPlate)
        markerLabel.text = "Rival fort"
        markerLabel.fontSize = 13
        markerLabel.fontColor = Palette.hex(0x2B1E2E)
        markerLabel.verticalAlignmentMode = .center
        marker.addChild(markerLabel)
        markerArrow.lineWidth = 2
        markerArrow.strokeColor = Palette.hex(0x2B1E2E)
        marker.addChild(markerArrow)
        crop.addChild(marker)
    }

    /// Places the Rival fort marker on the lens edge at the fort's height, or hides it.
    private func updateRivalMarker(show: Bool, snap: BattleSnapshot, worldRect: CGRect, lens: Lens,
                                   sceneHeight: CGFloat, palette: Palette) {
        guard show, let edge = Camera.rivalEdge(worldRect: worldRect, snap: snap) else {
            marker.isHidden = true
            return
        }
        marker.isHidden = false
        let rivalSide = 1 - snap.activeSide
        let fort = Camera.fortRect(rivalSide, snap: snap)
        let at = Camera.viewRect(of: fort, worldRect: worldRect, frame: lens.frame)
        let vp = lens.viewport
        let w: CGFloat = 104, h: CGFloat = 28
        let x = edge > 0 ? vp.maxX - 8 - w / 2 : vp.minX + 8 + w / 2
        let y = min(max(at.midY, lens.frame.minY + h), lens.frame.maxY - h)
        marker.position = CGPoint(x: x, y: sceneHeight - y)
        markerPlate.path = CGPath(roundedRect: CGRect(x: -w / 2, y: -h / 2, width: w, height: h),
                                  cornerWidth: 8, cornerHeight: 8, transform: nil)
        markerPlate.strokeColor = palette.side(rivalSide)
        markerLabel.position = CGPoint(x: CGFloat(-edge) * 8, y: 0)
        let tip = CGFloat(edge) * (w / 2 - 4)
        let arrow = CGMutablePath()
        arrow.move(to: CGPoint(x: tip - CGFloat(edge) * 10, y: 7))
        arrow.addLine(to: CGPoint(x: tip, y: 0))
        arrow.addLine(to: CGPoint(x: tip - CGFloat(edge) * 10, y: -7))
        markerArrow.path = arrow
        markerArrow.strokeColor = palette.side(rivalSide)
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
                pan: Double = 0, panning: Bool = false) {
        let small = lens.focus == .whole
        let vp = lens.viewport
        let centre = CGPoint(x: vp.midX, y: sceneHeight - vp.midY)
        mask.size = vp.size
        mask.position = centre
        backdrop.size = vp.size
        backdrop.position = centre
        backdrop.color = small ? palette.paper : palette.sky

        // Camera: ease toward the lens's target, then fit it into the Clear Rect.
        var target = Camera.worldRect(for: lens.focus, snap: snap, fx: fx, current: rig.rect, frame: lens.frame.size)
        let aimLens = lens.focus == .both || lens.focus == .own
        if aimLens { target = Camera.panned(target, by: pan, worldW: snap.world.w) }
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
        updateRivalMarker(show: lens.focus == .both && (snap.phase == .plan || snap.phase == .handoff),
                          snap: snap, worldRect: worldRect, lens: lens, sceneHeight: sceneHeight, palette: palette)
        let cellsPerPoint = Double(1 / max(0.0001, scale))
        let useArt = !small && !sheet.isEmpty
        let now = fx.now

        if let grid = snap.ground, grid.hasData {
            ground.isHidden = true
            updateTerrain(grid: grid, textures: textures)
        } else {
            ground.isHidden = false
            terrainLayer.isHidden = true
            updateGround(snap: snap, palette: palette)
        }

        for fort in snap.forts {
            drawFort(fort, snap: snap, fx: fx, palette: palette, useArt: useArt, small: small, reduceMotion: reduceMotion)
        }
        // A core with more castles than nodes must not trap the range (L1).
        if snap.forts.count < fortNodes.count {
            for i in snap.forts.count..<fortNodes.count { fortNodes[i].isHidden = true }
        }

        // Collapse ghosts: creak, lean, drop row by row, land, break (view only).
        if useArt {
            for p in fx.pieces {
                let t = fx.pieceTransform(p)
                let node = take("piece", parent: world, z: 2.2)
                place(node, frame: sheet.frame("block_\(p.mat)_battered") ?? sheet.frame("block_\(p.mat)_fresh"),
                      at: CGPoint(x: p.x + p.size / 2 + t.dx, y: p.y + t.dy), scale: 1, flip: false,
                      fallback: palette.material(p.mat), fallbackSize: CGSize(width: p.size, height: p.size))
                node.anchorPoint = CGPoint(x: 0.5, y: 0)
                node.size = CGSize(width: p.size, height: p.size)
                node.zRotation = CGFloat(-t.deg * .pi / 180)
                node.yScale = CGFloat(t.squash)
                if now - p.start < fx.motion.creakMs + fx.motion.leanMs, let crack = fx.library.clip("fx_crack_\(p.mat)") {
                    let c = take("crack", parent: world, z: 2.3)
                    placeClip(c, crack.frame(at: now - p.start), crack, at: CGPoint(x: p.x + t.dx, y: p.y + p.size + t.dy),
                              cellsPerPx: 1, flip: false)
                    c.zRotation = node.zRotation
                }
            }
        }

        // Props: cage bars, the captive, a Crock or a turnip, the 1-10 roller and shears hinge.
        for p in snap.props where !p.broken {
            let node = take("prop", parent: world, z: 2.5)
            switch p.kind {
            case "cage_bar":
                place(node, frame: nil, at: CGPoint(x: p.x, y: p.y), scale: 1, flip: false,
                      fallback: palette.cage, fallbackSize: CGSize(width: 4, height: 44))
            case "captive":
                let art = useArt ? fx.library.clip("hob_hetty_blue_idle") : nil
                if let art {
                    placeClip(node, art.frame(at: now), art, at: CGPoint(x: p.x, y: p.y), cellsPerPx: Self.hobCellsPerPixel, flip: false)
                } else {
                    place(node, frame: nil, at: CGPoint(x: p.x, y: p.y), scale: 1, flip: false,
                          fallback: palette.you, fallbackSize: CGSize(width: 14, height: 18))
                }
            case "roller":
                place(node, frame: nil, at: CGPoint(x: p.x, y: p.y), scale: 1, flip: false,
                      fallback: palette.flattened, fallbackSize: CGSize(width: 44, height: 26))
            case "shears":
                place(node, frame: nil, at: CGPoint(x: p.x, y: p.y), scale: 1, flip: false,
                      fallback: palette.ink, fallbackSize: CGSize(width: 14, height: 14))
                node.zRotation = .pi / 4
            default:
                let name = p.shot.isEmpty ? "shell_clodpot" : "shell_\(p.shot)"
                let frame = useArt ? (sheet.frame(name) ?? sheet.frame("shell_clodpot")) : nil
                place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 1.2, flip: false,
                      fallback: palette.kettle, fallbackSize: CGSize(width: 18, height: 18))
            }
            node.alpha = CGFloat(0.55 + 0.45 * p.hpFraction)
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

        // The preview dots, pulsing, in the active side's shape.
        if !small {
            let pulse = fx.library.clip(snap.activeSide == 0 ? "fx_ghost_dot_p1_pulse" : "fx_ghost_dot_p2_pulse")
            let dotName = snap.activeSide == 0 ? "fx_ghost_dot_p1" : "fx_ghost_dot_p2"
            var i = 0
            var n = 0
            while i + 1 < snap.preview.count {
                let node = take("dot", parent: world, z: 5)
                let at = CGPoint(x: snap.preview[i], y: snap.preview[i + 1])
                let k = CGFloat(max(0.5, 0.8 * cellsPerPoint))
                if useArt, let pulse {
                    placeClip(node, pulse.frame(at: reduceMotion ? 0 : now + Double(n) * 60), pulse, at: at, cellsPerPx: k, flip: false)
                } else {
                    place(node, frame: useArt ? sheet.frame(dotName) : nil, at: at, scale: k, flip: false, fallback: palette.paper,
                          fallbackSize: CGSize(width: 5 * cellsPerPoint, height: 5 * cellsPerPoint))
                }
                i += 2
                n += 1
            }
        }

        // Pins: yours round, the Rival's a diamond, dropped in with a stick. A spent Pin shows faded.
        for pin in snap.pins {
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

        // Weather: wind leaves always, the Squall in its rounds.
        if useArt {
            drawWeather(snap: snap, fx: fx, view: worldRect, reduceMotion: reduceMotion)
        }
        hideUnused()
    }

    // MARK: Forts

    private func drawFort(_ fort: FortView, snap: BattleSnapshot, fx: FieldFX, palette: Palette, useArt: Bool, small: Bool,
                          reduceMotion: Bool) {
        let body = fortNodes[min(fort.side, fortNodes.count - 1)]
        body.isHidden = false
        let now = fx.now
        // Walking: the body slides from the old spot to the new one and bobs on its legs.
        let px: Double = fort.originX + Double(fort.cols) * fort.block / 2
        let py: Double = fort.baseY
        var offX = 0.0
        var offY = 0.0
        var tilt = 0.0
        var walking: (t: Double, w: WalkAnim)?
        if let w = fx.walks[fort.side] {
            let t = now - w.start
            let p = min(1, max(0, t / w.duration))
            offX = -w.dx * (1 - p)
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

        // Stomper legs under the Footing while walking; the second leg 3 frames later.
        if let walking, useArt, let clip = fx.library.clip("stomper_\(team)_walk") {
            let width = Double(fort.cols) * fort.block
            for (i, fx0) in [0.25, 0.75].enumerated() {
                let node = take("stomper", parent: body, z: 0.9)
                let t = walking.t + Double(i) * 3 * fx.motion.bobFrameMs
                placeClip(node, clip.frame(at: reduceMotion ? 0 : t), clip,
                          at: local(fort.originX + width * fx0, fort.baseY + 3), cellsPerPx: 1, flip: fort.side == 1)
            }
        }

        let shimmerClip = fx.library.clip("fx_shimmer")
        // Blocks a collapse crushed stay until its ghost blocks land on them (review 2, M6).
        let blocks = fort.blocks + fx.held(side: fort.side)
        for (bi, b) in blocks.enumerated() {
            let node = take("block", parent: body, z: 1)
            let ratio = Double(max(0, b.hp)) / Double(max(1, b.hpMax))
            let wear = ratio > 0.66 ? "fresh" : (ratio > 0.33 ? "scuffed" : "battered")
            let mat = FieldFX.materialKey(b.material)
            let f = useArt ? (sheet.frame("block_\(mat)_\(wear)") ?? sheet.frame("block_\(mat)_fresh")) : nil
            node.texture = f?.texture
            if f == nil {
                node.color = b.root ? palette.gold : (b.battered ? palette.flattened : palette.material(b.material))
                node.colorBlendFactor = 1
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

        // Rooms: Loophole Flaps and Pot Lids.
        for room in fort.rooms {
            let key = "\(fort.side):\(room.id)"
            if let hole = room.loophole, useArt {
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
            drawLid(key: key, on: room.lid, at: local(room.box.midX, room.box.y1), fx: fx, body: body)
        }
        if let kr = fort.kettleRoom, useArt {
            drawLid(key: "\(fort.side):kettle", on: fort.kettleLid, at: local(kr.midX, kr.y1), fx: fx, body: body)
        }

        // The kettle: its state art, the pop animation, steam when critical.
        let pct = fort.kettlePercent
        let state = fort.kettleHp <= 0 ? "popped" : (pct <= 25 ? "critical" : (pct <= 50 ? "hurt" : "full"))
        let kettle = take("kettle", parent: body, z: 2)
        let kPoint = local(fort.kettleX, fort.kettleY)
        if useArt, let pop = fx.kettlePops[fort.side], let clip = fx.library.clip("kettle_pop") {
            placeClip(kettle, clip.frame(at: now - pop.start), clip, at: kPoint, cellsPerPx: 0.75, flip: fort.side == 1)
        } else {
            place(kettle, frame: useArt ? sheet.frame("kettle_\(state)") : nil, at: kPoint,
                  scale: 0.75, flip: fort.side == 1, fallback: fort.kettleHp > 0 ? palette.kettle : palette.flattened,
                  fallbackSize: CGSize(width: 20, height: 18))
        }
        if useArt, state == "critical", let steam = fx.library.clip("fx_kettle_steam") {
            let s = take("steam", parent: body, z: 2.1)
            placeClip(s, steam.frame(at: reduceMotion ? 0 : now), steam, at: local(fort.kettleX, fort.kettleY + 14),
                      cellsPerPx: 0.8, flip: false)
        }

        // Hobs: idle, aim pose by power, fire, hit, tumble, land, dig, cheer, Bonked with the balloon.
        for h in fort.hobs {
            let node = take("hob", parent: body, z: 3)
            let selected = h.id == snap.selectedHob && fort.side == snap.activeSide
            let aiming = snap.phase == .plan && snap.isHuman(fort.side)
            let lift = fx.bonkLift(side: fort.side, hob: Int(h.id) ?? -1)
            // A Hob that fell with a collapse rides down with its chunk (review 2, M6).
            let drop = fx.hobOffset(side: fort.side, hob: h.id)
            let at = local(h.x + drop.dx, h.y + lift + drop.dy)
            if useArt, let pick = fx.hobSprite(side: fort.side, hob: h, selected: selected, aiming: aiming, power: snap.aim.power) {
                placeClip(node, pick.0, pick.1, at: at, cellsPerPx: Self.hobCellsPerPixel, flip: fort.side == 1)
            } else {
                let bonked = h.bonked || h.hp <= 0
                place(node, frame: nil, at: at, scale: 1, flip: fort.side == 1,
                      fallback: bonked ? palette.flattened : palette.side(fort.side),
                      fallbackSize: CGSize(width: small ? 18 : 14, height: small ? 18 : 16))
            }
        }
    }

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

    // MARK: Placing sprites

    /// Puts a sprite frame with its anchor at `point`. `scale` is world cells per @1x pixel.
    private func place(_ node: SKSpriteNode, frame: SpriteSheet.Frame?, at point: CGPoint, scale: CGFloat, flip: Bool,
                       fallback: UIColor, fallbackSize: CGSize) {
        node.position = point
        if let frame {
            node.texture = frame.texture
            node.colorBlendFactor = 0
            node.color = .white
            node.size = CGSize(width: frame.size.width * scale, height: frame.size.height * scale)
            // Manifest anchors are from the top left; SpriteKit's are unit values from the bottom left.
            node.anchorPoint = CGPoint(x: frame.anchor.x / max(1, frame.size.width),
                                       y: 1 - frame.anchor.y / max(1, frame.size.height))
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
    private func placeClip(_ node: SKSpriteNode, _ frameName: String, _ clip: AnimClip, at point: CGPoint, cellsPerPx: CGFloat, flip: Bool) {
        node.position = point
        guard let frame = sheet.frame(frameName) else {
            node.isHidden = true
            return
        }
        node.texture = frame.texture
        node.colorBlendFactor = 0
        node.color = .white
        let w = CGFloat(clip.w), h = CGFloat(clip.h)
        node.size = CGSize(width: w * cellsPerPx, height: h * cellsPerPx)
        node.anchorPoint = CGPoint(x: clip.anchor.x / max(1, w), y: 1 - clip.anchor.y / max(1, h))
        node.xScale = flip ? -1 : 1
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

    /// Both forts plus the arc you can see.
    static func bothRect(_ snap: BattleSnapshot) -> CGRect {
        let r = fortRect(0, snap: snap).union(fortRect(1, snap: snap)).union(previewRect(snap))
        return framed(r, activeSide: snap.activeSide)
    }

    /// Your fort (the side on turn) plus the arc you can see.
    static func ownPlanRect(_ snap: BattleSnapshot) -> CGRect {
        let r = fortRect(snap.activeSide, snap: snap).union(previewRect(snap))
        return framed(r, activeSide: snap.activeSide)
    }

    /// The plan frame: both forts when their blocks still draw at 8 pt or more in a frame of
    /// `frame`, else your fort and the arc. Without a frame size, both forts.
    static func planRect(_ snap: BattleSnapshot, frame: CGSize? = nil) -> CGRect {
        let both = bothRect(snap)
        guard let frame, frame.width > 0, frame.height > 0 else { return both }
        return blockPoints(both, in: frame) >= minBlockPoints ? both : ownPlanRect(snap)
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

    /// The Rival fort edge marker: -1 when the fort being shot at is off the left of the frame,
    /// +1 off the right, nil when it is in view.
    static func rivalEdge(worldRect: CGRect, snap: BattleSnapshot) -> Int? {
        let rival = fortRect(1 - snap.activeSide, snap: snap)
        if rival.midX > worldRect.maxX { return 1 }
        if rival.midX < worldRect.minX { return -1 }
        return nil
    }

    static func worldRect(for focus: LensFocus, snap: BattleSnapshot, fx: FieldFX? = nil, current: CGRect? = nil,
                          frame: CGSize? = nil) -> CGRect {
        let worldW = snap.world.w
        switch focus {
        case .whole:
            let low = snap.terrain.min() ?? 0
            let top = (snap.terrain.max() ?? 300) + 140
            return CGRect(x: 0, y: low - 20, width: worldW, height: max(100, top - low))
        case .both:
            return planRect(snap, frame: frame)
        case .own:
            return fortRect(snap.activeSide, snap: snap).insetBy(dx: -170, dy: -60).offsetBy(dx: snap.activeSide == 0 ? 110 : -110, dy: 40)
        case .target:
            return fortRect(1 - snap.activeSide, snap: snap).insetBy(dx: -150, dy: -50).offsetBy(dx: 0, dy: 30)
        case .follow:
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

/// Colours from the art kit (docs/art/png/20-palette-and-style.png).
struct Palette {
    var ink = Palette.hex(0x2B1E2E)
    var paper = Palette.hex(0xFFF4DE)
    var sky = Palette.hex(0xA6DCEF)
    var grass = Palette.hex(0x8BCB3A)
    var dirt = Palette.hex(0x9A6A3A)
    var kettle = Palette.hex(0xD9773A)
    var flattened = Palette.hex(0x8A90A2)
    var you = Palette.hex(0x2F6FDE)
    var rival = Palette.hex(0xE8730C)
    var gold = Palette.hex(0xFFC23D)
    var cage = Palette.hex(0x5B5F6B)

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

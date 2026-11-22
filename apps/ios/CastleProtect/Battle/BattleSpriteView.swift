import SpriteKit
import UIKit

/// The battle field: an SKView whose scene is updated from the latest core
/// snapshot when it changes (and four times a second for idle poses). It also
/// reads touches for the Aim Drag. The battle clock itself runs in the session.
/// Drawing only: nothing here decides an outcome.
final class BattleSKView: SKView {
    var session: BattleSession
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
        isAccessibilityElement = true
        accessibilityLabel = "Battlefield"
        updateHint()
        NotificationCenter.default.addObserver(self, selector: #selector(voiceOverChanged),
                                               name: UIAccessibility.voiceOverStatusDidChangeNotification, object: nil)
    }

    @objc private func voiceOverChanged() { updateHint() }

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
        let pose = now / 250_000_000
        let colours = session.settings.colourSet
        // Draw only when something changed: a new frame, a resize, a colour set, or the idle pose step (H8, M1).
        guard session.frameVersion != drawnVersion || session.layout != drawnLayout || colours != drawnColours
                || pose != drawnPose else { return }
        drawnVersion = session.frameVersion
        drawnLayout = session.layout
        drawnColours = colours
        drawnPose = pose
        battleScene.render(snapshot: session.snapshot, layout: session.layout, effects: session.effects,
                           colours: colours, now: now)
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

    func render(snapshot: BattleSnapshot, layout: BattleLayout, effects: [BlastEffect], colours: ColourSet, now: UInt64) {
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
                layer.update(lens: lenses[i], snap: snapshot, effects: effects, palette: palette,
                             sceneHeight: size.height, now: now, textures: textures)
            } else {
                layer.crop.isHidden = true
            }
        }
    }
}

/// One lens: a crop node over its viewport, a backdrop, and a world node that
/// the camera scales and moves. Nodes are pooled and reused every frame.
@MainActor
final class LensLayer {
    let crop = SKCropNode()
    private let mask = SKSpriteNode(color: .white, size: CGSize(width: 1, height: 1))
    private let backdrop = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
    private let world = SKNode()
    private let ground = SKShapeNode()
    private let sheet: SpriteSheet
    private var lastTerrain: [Double] = []
    private var lastWorldW = 0.0
    private var blocks: [SKSpriteNode] = []
    private var kettles: [SKSpriteNode] = []
    private var hobs: [SKSpriteNode] = []
    private var marks: [SKSpriteNode] = []
    private var shells: [SKSpriteNode] = []
    private var effects: [SKSpriteNode] = []
    private var props: [SKSpriteNode] = []
    private let terrainLayer = SKNode()
    private var terrainNodes: [Int: SKSpriteNode] = [:]
    private var terrainDrawn: [Int: Int] = [:]
    private var terrainGrid: TerrainGrid?
    private var terrainVersion = -1

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
    }

    func update(lens: Lens, snap: BattleSnapshot, effects fx: [BlastEffect], palette: Palette, sceneHeight: CGFloat, now: UInt64,
                textures: TerrainTextures) {
        let small = lens.focus == .whole
        let vp = lens.viewport
        let centre = CGPoint(x: vp.midX, y: sceneHeight - vp.midY)
        mask.size = vp.size
        mask.position = centre
        backdrop.size = vp.size
        backdrop.position = centre
        backdrop.color = small ? palette.paper : palette.sky

        // Camera: fit the lens's world rect into its frame (the Clear Rect).
        let worldRect = Camera.worldRect(for: lens.focus, snap: snap)
        let scale = min(lens.frame.width / max(1, worldRect.width), lens.frame.height / max(1, worldRect.height))
        world.setScale(scale)
        let frameCentre = CGPoint(x: lens.frame.midX, y: sceneHeight - lens.frame.midY)
        world.position = CGPoint(x: frameCentre.x - worldRect.midX * scale, y: frameCentre.y - worldRect.midY * scale)
        let cellsPerPoint = Double(1 / max(0.0001, scale))
        let useArt = !small && !sheet.isEmpty

        if let grid = snap.ground, grid.hasData {
            ground.isHidden = true
            updateTerrain(grid: grid, textures: textures)
        } else {
            ground.isHidden = false
            terrainLayer.isHidden = true
            updateGround(snap: snap, palette: palette)
        }

        var bi = 0, ki = 0, hi = 0, mi = 0, si = 0, ei = 0, pi = 0
        let frameIndex = Int((now / 250_000_000) % 6)

        for fort in snap.forts {
            for b in fort.blocks {
                let node = Self.take(&blocks, bi, parent: world, z: 1)
                bi += 1
                let ratio = Double(max(0, b.hp)) / Double(max(1, b.hpMax))
                let wear = ratio > 0.66 ? "fresh" : (ratio > 0.33 ? "scuffed" : "battered")
                let f = useArt ? (sheet.frame("block_\(b.material)_\(wear)") ?? sheet.frame("block_\(b.material)_fresh")) : nil
                node.texture = f?.texture
                // Battered blocks (Fatigue) get a slate tint; the boss weak spot a gold one; shimmer a pale one (M9).
                if f == nil {
                    node.color = b.root ? palette.gold : (b.battered ? palette.flattened : palette.material(b.material))
                    node.colorBlendFactor = 1
                } else if b.root || b.battered || b.shimmer {
                    node.color = b.root ? palette.gold : (b.battered ? palette.flattened : palette.paper)
                    node.colorBlendFactor = b.root ? 0.45 : (b.battered ? 0.35 : 0.25)
                } else {
                    node.color = .white
                    node.colorBlendFactor = 0
                }
                node.anchorPoint = .zero
                node.size = CGSize(width: b.w, height: b.h)
                node.position = CGPoint(x: b.x, y: b.y)
                node.xScale = 1
                node.alpha = 1
            }

            let pct = fort.kettlePercent
            let state = fort.kettleHp <= 0 ? "popped" : (pct <= 25 ? "critical" : (pct <= 50 ? "hurt" : "full"))
            let kettle = Self.take(&kettles, ki, parent: world, z: 2)
            ki += 1
            place(kettle, frame: useArt ? sheet.frame("kettle_\(state)") : nil, at: CGPoint(x: fort.kettleX, y: fort.kettleY),
                  scale: 0.75, flip: fort.side == 1, fallback: fort.kettleHp > 0 ? palette.kettle : palette.flattened,
                  fallbackSize: CGSize(width: 20, height: 18))

            let team = SpriteImages.team(fort.side)
            for (i, h) in fort.hobs.enumerated() {
                let node = Self.take(&hobs, hi, parent: world, z: 3)
                hi += 1
                let bonked = h.bonked || h.hp <= 0
                let selected = h.id == snap.selectedHob && fort.side == snap.activeSide
                var frame: SpriteSheet.Frame?
                if useArt, let art = SpriteImages.hobArtName(id: h.def, name: h.name) {
                    let pose: String
                    let n: Int
                    if bonked {
                        pose = "bonked"; n = frameIndex % 2
                    } else if selected && snap.phase == .plan {
                        pose = "aim"; n = frameIndex % 2
                    } else if selected && snap.phase == .flight {
                        pose = "fire"; n = 1
                    } else {
                        pose = "idle"; n = (frameIndex + i) % 3
                    }
                    frame = sheet.frame("hob_\(art)_\(team)_\(pose)_\(n)") ?? sheet.frame("hob_\(art)_\(team)_idle_0")
                }
                place(node, frame: frame, at: CGPoint(x: h.x, y: h.y), scale: Self.hobCellsPerPixel, flip: fort.side == 1,
                      fallback: bonked ? palette.flattened : palette.side(fort.side),
                      fallbackSize: CGSize(width: small ? 18 : 14, height: small ? 18 : 16))
                node.alpha = selected || bonked ? 1 : 0.95
            }
        }

        // Props: cage bars, the captive, a Crock or a turnip (C2). A broken prop is not drawn.
        for p in snap.props where !p.broken {
            let node = Self.take(&props, pi, parent: world, z: 2.5)
            pi += 1
            switch p.kind {
            case "cage_bar":
                place(node, frame: nil, at: CGPoint(x: p.x, y: p.y), scale: 1, flip: false,
                      fallback: palette.cage, fallbackSize: CGSize(width: 4, height: 44))
            case "captive":
                let frame = useArt ? (sheet.frame("hob_hetty_blue_idle_0") ?? sheet.frame("hob_hetty_blue_bonked_0")) : nil
                place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: Self.hobCellsPerPixel, flip: false,
                      fallback: palette.you, fallbackSize: CGSize(width: 14, height: 18))
            default:
                let name = p.shot.isEmpty ? "shell_clodpot" : "shell_\(p.shot)"
                let frame = useArt ? (sheet.frame(name) ?? sheet.frame("shell_clodpot")) : nil
                place(node, frame: frame, at: CGPoint(x: p.x, y: p.y), scale: 1.2, flip: false,
                      fallback: palette.kettle, fallbackSize: CGSize(width: 18, height: 18))
            }
            node.alpha = CGFloat(0.55 + 0.45 * p.hpFraction)
        }

        // The 30% preview dots, in the active side's shape.
        if !small {
            let dotName = snap.activeSide == 0 ? "fx_ghost_dot_p1" : "fx_ghost_dot_p2"
            var i = 0
            while i + 1 < snap.preview.count {
                let node = Self.take(&marks, mi, parent: world, z: 5)
                mi += 1
                place(node, frame: useArt ? sheet.frame(dotName) : nil, at: CGPoint(x: snap.preview[i], y: snap.preview[i + 1]),
                      scale: max(0.5, 0.8 * cellsPerPoint), flip: false, fallback: palette.paper,
                      fallbackSize: CGSize(width: 5 * cellsPerPoint, height: 5 * cellsPerPoint))
                i += 2
            }
        }

        // Pins: yours round, the Rival's a diamond. A spent Pin shows faded.
        for pin in snap.pins {
            let node = Self.take(&marks, mi, parent: world, z: 4)
            mi += 1
            let pinScale = max(small ? 1.2 : 0.5, cellsPerPoint)
            place(node, frame: useArt ? sheet.frame(pin.side == 0 ? "fx_pin_p1" : "fx_pin_p2") : nil, at: CGPoint(x: pin.x, y: pin.y),
                  scale: pinScale, flip: false, fallback: palette.side(pin.side),
                  fallbackSize: CGSize(width: 12 * pinScale, height: 12 * pinScale))
            node.alpha = pin.spent ? 0.45 : 1
        }

        // Shells in flight.
        for sh in snap.shells {
            let node = Self.take(&shells, si, parent: world, z: 6)
            si += 1
            let name = sh.kind.isEmpty || sh.kind == "plain" ? "shell_clodpot" : "shell_\(sh.kind)"
            let shellScale = max(small ? 1.5 : 0.5, 0.7 * cellsPerPoint)
            place(node, frame: useArt ? (sheet.frame(name) ?? sheet.frame("shell_clodpot")) : nil, at: CGPoint(x: sh.x, y: sh.y),
                  scale: shellScale, flip: false, fallback: palette.ink,
                  fallbackSize: CGSize(width: 16 * shellScale, height: 16 * shellScale))
        }

        // Blast flashes, four frames over 0.4 s.
        if !small {
            for e in fx {
                let t = Double(now &- e.start) / 1e9
                guard t < 0.4 else { continue }
                let node = Self.take(&effects, ei, parent: world, z: 7)
                ei += 1
                let n = min(3, Int(t / 0.1))
                place(node, frame: useArt ? sheet.frame("fx_boom_\(e.big ? "large" : "small")_\(n)") : nil,
                      at: CGPoint(x: e.x, y: e.y), scale: e.big ? 1.6 : 1.2, flip: false,
                      fallback: Palette.hex(0xFFF3C4), fallbackSize: CGSize(width: 40, height: 40))
                node.alpha = useArt ? 1 : CGFloat(1 - t / 0.4)
            }
        }

        Self.hide(blocks, from: bi)
        Self.hide(kettles, from: ki)
        Self.hide(hobs, from: hi)
        Self.hide(marks, from: mi)
        Self.hide(shells, from: si)
        Self.hide(effects, from: ei)
        Self.hide(props, from: pi)
    }

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

    /// World cells per @1x pixel for Hob frames (72 x 80 px at @1x, bonked 72 x 116),
    /// so a Hob stands about two blocks tall in its Nook. Blocks are 1 cell a pixel.
    static let hobCellsPerPixel: CGFloat = 0.5

    /// Puts a sprite frame with its anchor at `point`. `scale` is world cells per @1x pixel.
    private func place(_ node: SKSpriteNode, frame: SpriteSheet.Frame?, at point: CGPoint, scale: CGFloat, flip: Bool,
                       fallback: UIColor, fallbackSize: CGSize) {
        node.position = point
        node.alpha = 1
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

    private static func take(_ pool: inout [SKSpriteNode], _ i: Int, parent: SKNode, z: CGFloat) -> SKSpriteNode {
        if i < pool.count {
            let node = pool[i]
            node.isHidden = false
            return node
        }
        let node = SKSpriteNode(color: .clear, size: CGSize(width: 1, height: 1))
        node.zPosition = z
        parent.addChild(node)
        pool.append(node)
        return node
    }

    private static func hide(_ pool: [SKSpriteNode], from count: Int) {
        guard count < pool.count else { return }
        for i in count..<pool.count { pool[i].isHidden = true }
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

/// View-only camera framing: which part of the field each lens shows.
/// World units are cells, y up.
enum Camera {
    static func worldRect(for focus: LensFocus, snap: BattleSnapshot) -> CGRect {
        let worldW = snap.world.w
        func fortRect(_ side: Int) -> CGRect {
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
        switch focus {
        case .whole:
            let low = snap.terrain.min() ?? 0
            let top = (snap.terrain.max() ?? 300) + 140
            return CGRect(x: 0, y: low - 20, width: worldW, height: max(100, top - low))
        case .both:
            return fortRect(0).union(fortRect(1)).insetBy(dx: -90, dy: -40).offsetBy(dx: 0, dy: 60)
        case .own:
            return fortRect(snap.activeSide).insetBy(dx: -170, dy: -60).offsetBy(dx: snap.activeSide == 0 ? 110 : -110, dy: 40)
        case .target:
            return fortRect(1 - snap.activeSide).insetBy(dx: -150, dy: -50).offsetBy(dx: 0, dy: 30)
        case .follow:
            let base = fortRect(0).union(fortRect(1)).insetBy(dx: -80, dy: -40)
            guard let sh = snap.shells.first else { return base.offsetBy(dx: 0, dy: 60) }
            return base.union(CGRect(x: sh.x - 120, y: sh.y - 120, width: 240, height: 240))
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

import CoreGraphics
import Foundation

/// A sprite effect in world space (cells, y up) that plays one clip.
struct FxSprite: Equatable {
    var clip: String
    var x: Double
    var y: Double
    /// View time (ms) when it started.
    var start: Double
    /// Cells per second, y up, and gravity in cells per second squared.
    var vx = 0.0
    var vy = 0.0
    var gravity = 0.0
    /// Degrees per second.
    var spin = 0.0
    var scale = 1.0
    var flip = false
    var z: CGFloat = 7
    /// Extra time to show the last (or hold) frame after the clip ends, in ms.
    var holdFor = 0.0
    /// Fade out over this many ms at the end of its life.
    var fadeLast = 0.0
    var reversed = false
    /// A looping clip lives this long (ms); 0 means the clip's own length.
    var life = 0.0
    /// Events already fired up to this clip time.
    var firedTo = -1.0

    func position(at now: Double) -> (Double, Double) {
        let t = max(0, now - start) / 1000
        return (x + vx * t, y + vy * t - 0.5 * gravity * t * t)
    }
}

/// One block of a collapse, shown as a ghost while it creaks, leans, drops and breaks.
/// The sim has already dropped it; this is view only (animations.json `data.collapse`).
struct CollapsePiece: Equatable {
    var side: Int
    var mat: String
    /// Lower-left corner, y up.
    var x: Double
    var y: Double
    var size: Double
    /// Cells it falls before it lands.
    var fall: Double
    var row: Int
    var start: Double
    /// +1 tips right, -1 tips left.
    var leanDir: Double
    var landed = false
    var broke = false
}

/// A fort walking (core event `walk`): the body slides from `from` to `to` on Stomper legs.
struct WalkAnim: Equatable {
    var dx: Double
    var start: Double
    var duration: Double
    /// Current slide segment start & duration so repeated held steps accumulate smoothly.
    var segStart: Double
    var segDuration: Double
    var lastStomp = -1

    init(dx: Double, start: Double, duration: Double, segStart: Double? = nil, segDuration: Double? = nil, lastStomp: Int = -1) {
        self.dx = dx
        self.start = start
        self.duration = duration
        self.segStart = segStart ?? start
        self.segDuration = segDuration ?? duration
        self.lastStomp = lastStomp
    }
}

/// A Hob that fell with a collapse (core event `drop`): drawn at `from` until its chunk
/// drops, then it falls to `to` and lands with the blocks (review 2, M6). View offsets, y up.
struct HobDrop: Equatable {
    var dx: Double
    var dy: Double
    var fallStart: Double
    var land: Double
}

/// What a Hob is doing right now, for its sprite.
struct HobAnim: Equatable {
    /// Clip suffix: fire, hit, tumble, land, dig, cheer, nextdoor, blink, bonked.
    var suffix: String
    var start: Double
    var firedTo = -1.0
}

/// Color-coded floating combat feedback style (Part 2 Plate 2).
enum CalloutStyle: Equatable, Sendable {
    /// Damage to a Hob / Flattener (amber-gold `#FFC23D`).
    case hobHit
    /// Damage to a wall block (crisp cream `#FFF4DE`).
    case wallBreak
    /// Collapse drop callout (`Drop!` starburst yellow `#FFE08A`).
    case drop
    /// Direct Heartkettle hit (warm copper-orange `#FF9E44`).
    case kettleHit
    /// Fort repair / mend (kettle teal `#4FE3C1`).
    case mend
}

/// One floating damage or drop callout in world space (cells, y up).
struct CombatCallout: Equatable, Sendable {
    var id: Int
    var text: String
    var x: Double
    var y: Double
    var start: Double
    var duration: Double = 1150
    var style: CalloutStyle
}

/// The view-time clock, hit stop, slow motion, screen shake and every effect
/// on the field: impacts, trails, collapse choreography, kettle pop, walks,
/// Pins, Flaps, the Pot Lid and Hob poses. Driven by the core's events; it
/// decides nothing about the battle (UX 07 section 6, assets/animations.json).
@MainActor
final class FieldFX {
    let library: AnimationLibrary
    /// View time in ms. Stops during hit stop, slows during slow motion.
    private(set) var now: Double = 0
    private(set) var sprites: [FxSprite] = []
    private(set) var pieces: [CollapsePiece] = []
    private(set) var walks: [Int: WalkAnim] = [:]
    private(set) var hobAnims: [String: HobAnim] = [:]
    /// Side to kettle pop start (view ms).
    private(set) var kettlePops: [Int: (start: Double, firedTo: Double)] = [:]
    /// Pins: key to drop start.
    private(set) var pinDrops: [String: Double] = [:]
    /// Rooms: key to (start, reversed) for Flaps and the Pot Lid.
    private(set) var flaps: [String: (start: Double, closing: Bool)] = [:]
    private(set) var lids: [String: (start: Double, raising: Bool)] = [:]
    /// Bonked Hobs: key to the view time they were Bonked (the balloon lift).
    private(set) var bonkedAt: [String: Double] = [:]
    /// The last impact, for the camera's 0.6 s hold (real time, ns).
    private(set) var lastImpact: (x: Double, y: Double, at: UInt64)?
    /// Hobs that fell with a collapse, until they land.
    private(set) var hobDrops: [String: HobDrop] = [:]
    /// Blocks the collapse crushes: the core has already removed them, the view keeps
    /// drawing them until the ghost blocks land on them (side to blocks and land time).
    private(set) var heldBlocks: [Int: (blocks: [BlockView], until: Double)] = [:]
    /// Hobs whose crush/fall Bonk is waiting for the ghost blocks to land.
    private(set) var deferredBonks: Set<String> = []
    /// Active floating combat numbers & `Drop!` starburst callouts (de-overlapped in `resolvedCallouts`).
    private(set) var callouts: [CombatCallout] = []
    private var nextCalloutId = 1
    /// A kettle pop was seen and its pop frame has not played yet (the win sting waits for it).
    private(set) var popFramePending = false
    /// The kettle's pop frame: the win or lose sting starts here (review 2, M8).
    var onPopFrame: (() -> Void)?

    // Settings
    var reduceMotion = false
    /// 0 to 1: Reduce shake.
    var shakeAmount = 1.0
    /// 2x resolve: hit stops halve, slow motion is skipped.
    var fast = false

    // Clock state (real time ns). `clock` is the newest real time handed in, so the
    // effects never read the wall clock themselves (tests drive it by hand).
    private var clock: UInt64 = 0
    private var hitStopUntil: UInt64 = 0
    private var lastHitStop: UInt64 = 0
    private var slowUntil: UInt64 = 0
    private var slowScale = 1.0
    private var slowAddedMs = 0.0
    private var slowThisShot = false
    private var trauma = 0.0
    private var traumaDecayMs = 250.0
    private var shakeSeed: UInt32 = 0x9E37_79B9
    private var lastTrail: [Int: Double] = [:]
    private var lastBlink: [String: Double] = [:]
    private var knownPins: Set<String> = []
    private var lastFlaps: [String: Bool] = [:]
    private var lastLids: [String: Bool] = [:]
    private var seededRooms = false
    private var lastShooter: (side: Int, def: String)?
    /// A Couch Duel: side 1 is player 2 and keeps the orange look. Otherwise side 1 is the Rival.
    private(set) var duel = false
    /// Where each Hob's idle loop starts (ms), picked once per Hob so a crew never breathes in step.
    private var idleStart: [String: Double] = [:]
    private var rng: UInt32 = 0x2545_F491

    /// A sound to play now: id, pitch shift in semitones, gain.
    var onSound: ((String, Double, Float) -> Void)?
    /// Optional spatialised sound callback: id, pitch shift, gain, world X (nil = center).
    var onSoundAt: ((String, Double, Float, Double?) -> Void)?
    /// A bark: Hob def, event (fire, takes_hit, bonked, win, hit_lands), side.
    var onBark: ((String, String, Int) -> Void)?
    /// Shot id to trail kind (blast, pierce, dig, fire, mend).
    var trailKind: (String) -> String = { _ in "blast" }

    private func emitSound(_ id: String, _ pitch: Double = 0, _ gain: Float = 1, x: Double? = nil) {
        if let onSoundAt {
            onSoundAt(id, pitch, gain, x)
        } else {
            onSound?(id, pitch, gain)
        }
    }

    init(library: AnimationLibrary = .shared) {
        self.library = library
    }

    var motion: MotionData { library.motion }

    /// True while anything is moving, so the renderer draws every frame. A Bonked Hob's
    /// looping balloon pose is not "moving" once its lift is done: it steps with the idle
    /// poses, so Plan stays idle after a Bonk (review 2, M7).
    var isActive: Bool {
        !sprites.isEmpty || !pieces.isEmpty || !walks.isEmpty || !callouts.isEmpty || trauma > 0.001
            || isPopShowing || !hobDrops.isEmpty
            || hobAnims.contains { $0.value.suffix != "bonked" }
            || bonkedAt.values.contains { now - $0 < Self.bonkLiftMs }
            || clock < slowUntil
    }

    /// The balloon lift ends 18 cells up: 0.8 s wait, then 8 cells a second.
    static let bonkLiftMs = 800.0 + 18.0 / 8.0 * 1000

    /// The kettle pop show (crack, pop, the slow motion, the sit) is still playing.
    var isPopShowing: Bool {
        let length = library.clip("kettle_pop")?.total ?? 1800
        return popFramePending || kettlePops.contains { now - $0.value.start < length } || clock < slowUntil
    }

    /// The collapse show is still playing: the ghost blocks have not all landed and broken.
    var collapseShowing: Bool { !pieces.isEmpty || !hobDrops.isEmpty }

    /// Where a Hob is drawn now relative to the core's spot (zero unless it is falling with a collapse).
    func hobOffset(side: Int, hob: String) -> (dx: Double, dy: Double) {
        guard let id = Int(hob), let d = hobDrops["\(side):\(id)"] else { return (0, 0) }
        if now >= d.land { return (0, 0) }
        if now <= d.fallStart { return (d.dx, d.dy) }
        let p = (now - d.fallStart) / max(1, d.land - d.fallStart)
        return (d.dx * (1 - p), d.dy * (1 - p * p))
    }

    /// Crushed blocks still drawn for a side.
    func held(side: Int) -> [BlockView] {
        guard let h = heldBlocks[side], now < h.until else { return [] }
        return h.blocks
    }

    func reset() {
        sprites = []
        pieces = []
        walks = [:]
        hobAnims = [:]
        kettlePops = [:]
        pinDrops = [:]
        flaps = [:]
        lids = [:]
        bonkedAt = [:]
        hobDrops = [:]
        heldBlocks = [:]
        deferredBonks = []
        callouts = []
        popFramePending = false
        timers = []
        lastImpact = nil
        trauma = 0
        hitStopUntil = 0
        slowUntil = 0
        slowAddedMs = 0
        knownPins = []
        lastFlaps = [:]
        lastLids = [:]
        seededRooms = false
        lastShooter = nil
        lastTrail = [:]
        idleStart = [:]
        hobDefs = [:]
        hobClasses = [:]
    }

    // MARK: Clock

    /// Real time passed. Returns the view time that passed (0 during hit stop).
    func advance(realMs: Double, nowNanos: UInt64) -> Double {
        clock = max(clock, nowNanos)
        var scale = 1.0
        if nowNanos < hitStopUntil {
            scale = 0
        } else if nowNanos < slowUntil {
            scale = slowScale
        }
        let dt = max(0, realMs) * scale
        let before = now
        now += dt
        if trauma > 0 {
            trauma = max(0, trauma - realMs / max(50, traumaDecayMs))
        }
        step(from: before, to: now)
        return dt
    }

    /// Time scale for the sim clock right now (0 in hit stop, < 1 in slow motion).
    func timeScale(nowNanos: UInt64) -> Double {
        if nowNanos < hitStopUntil { return 0 }
        if nowNanos < slowUntil { return slowScale }
        return 1
    }

    /// A new turn: slow motion budget and the one-per-shot rule reset.
    func newTurn() {
        slowAddedMs = 0
        slowThisShot = false
        lastShooter = nil
    }

    /// 2x during Resolve cancels slow motion for the turn.
    func cancelSlowMotion() {
        slowUntil = 0
        slowAddedMs = 1500
    }

    private func hitStop(_ ms: Double, nowNanos: UInt64) {
        guard ms > 0 else { return }
        guard nowNanos &- lastHitStop >= 250_000_000 || lastHitStop == 0 else { return }
        var d = fast ? ms / 2 : ms
        if reduceMotion { d = min(d, 50) }
        lastHitStop = nowNanos
        hitStopUntil = max(hitStopUntil, nowNanos + UInt64(d * 1_000_000))
    }

    private func slowMotion(_ scale: Double, ms: Double, nowNanos: UInt64, ending: Bool = false) {
        if reduceMotion {
            // Reduce motion: no slow motion, a 150 ms hold instead.
            hitStopUntil = max(hitStopUntil, nowNanos + 150_000_000)
            return
        }
        guard ending || (!fast && !slowThisShot) else { return }
        let added = ms * (1 - scale)
        guard ending || slowAddedMs + added <= 1500 else { return }
        slowThisShot = true
        slowAddedMs += added
        slowScale = scale
        slowUntil = max(slowUntil, nowNanos + UInt64(ms * 1_000_000))
    }

    /// Screen shake. Never during the Plan step (the renderer also checks).
    func addTrauma(_ amount: Double, decayMs: Double) {
        guard shakeAmount > 0 else { return }
        trauma = min(1, trauma + amount)
        traumaDecayMs = max(traumaDecayMs * 0.5, decayMs)
    }

    /// Offset in screen points for the field (never the HUD). Zero while aiming.
    func shakeOffset(planning: Bool) -> CGPoint {
        guard !planning, trauma > 0.001, shakeAmount > 0 else { return .zero }
        let mag = trauma * trauma * 12 * shakeAmount
        let t = now / 1000 * 30
        let nx = sin(t * 1.7 + 0.3) * 0.6 + sin(t * 3.1) * 0.4
        let ny = sin(t * 2.3 + 1.1) * 0.6 + sin(t * 2.9 + 0.7) * 0.4
        return CGPoint(x: nx * mag, y: ny * mag)
    }

    private func cosmetic() -> Double {
        // Cosmetic stream only, never the sim's.
        rng ^= rng << 13
        rng ^= rng >> 17
        rng ^= rng << 5
        return Double(rng % 10_000) / 10_000
    }

    // MARK: Per frame

    /// Fires clip events and ends finished effects between two view times.
    private func step(from t0: Double, to t1: Double) {
        guard t1 > t0 else { return }
        // Sprites: events, then drop the finished ones.
        var keep: [FxSprite] = []
        keep.reserveCapacity(sprites.count)
        for var s in sprites {
            let clip = library.clip(s.clip) ?? Self.synthetic(s.clip)
            let local0 = s.firedTo
            let local1 = t1 - s.start
            if let clip, local1 > local0 {
                for name in clip.eventsFired(from: local0, to: local1) { spriteEvent(s, name) }
                s.firedTo = local1
            }
            let length = s.life > 0 ? s.life : ((clip?.total ?? 300) + s.holdFor)
            if t1 - s.start < length { keep.append(s) }
        }
        sprites = keep

        // Collapse pieces: land and break.
        for i in pieces.indices.reversed() {
            var p = pieces[i]
            let landAt = landTime(p)
            if !p.landed && t1 >= landAt {
                p.landed = true
            }
            if !p.broke && t1 >= landAt + 200 {
                p.broke = true
                breakPiece(p)
            }
            if p.broke { pieces.remove(at: i) } else { pieces[i] = p }
        }

        // Walks: Stomper steps, then the end.
        for (side, w) in walks {
            let t = t1 - w.start
            if t >= w.duration {
                walks[side] = nil
                emitSound("cas_steam", 0, 0.7)
                continue
            }
            let frame = Int(t / motion.bobFrameMs)
            if frame != w.lastStomp {
                var next = w
                next.lastStomp = frame
                walks[side] = next
                if frame % 3 == 0 { emitSound("cas_step", 0, 1) }
            }
        }

        // Kettle pops: crack, pop, sit.
        for (side, k) in kettlePops {
            guard let clip = library.clip("kettle_pop") else { continue }
            let local1 = t1 - k.start
            if local1 > k.firedTo {
                for name in clip.eventsFired(from: k.firedTo, to: local1) {
                    switch name {
                    case "crack": emitSound("ket_crack", 0, 1)
                    case "pop":
                        emitSound("ket_pop", 0, 1)
                        emitSound("hit_sub_thud", -2, 1.0)
                        if popFramePending {
                            popFramePending = false
                            onPopFrame?()
                        }
                        let ns = clock
                        hitStop(80, nowNanos: ns)
                        addTrauma(1.0, decayMs: 600)
                        slowMotion(0.25, ms: 1200, nowNanos: ns, ending: true)
                    case "sit": emitSound("ket_sit_down", 0, 1)
                    default: break
                    }
                }
                kettlePops[side] = (k.start, local1)
            }
        }

        // Hob anims: events, then back to idle when a play-once clip ends.
        for (key, a) in hobAnims {
            guard let clip = hobClip(key: key, suffix: a.suffix) else {
                hobAnims[key] = nil
                continue
            }
            let local1 = t1 - a.start
            if local1 > a.firedTo {
                for name in clip.eventsFired(from: a.firedTo, to: local1) { hobEvent(key: key, suffix: a.suffix, name) }
                var next = a
                next.firedTo = local1
                hobAnims[key] = next
            }
            if a.suffix == "tumble", local1 > 520 {
                hobAnims[key] = HobAnim(suffix: "land", start: t1)
            } else if clip.finished(at: local1), a.suffix != "bonked" {
                hobAnims[key] = nil
            }
        }

        // Hobs that fell: the tumble starts as their chunk drops; they are done when they land.
        for (key, d) in hobDrops where t1 >= d.land {
            hobDrops[key] = nil
        }
        for (side, h) in heldBlocks where t1 >= h.until {
            heldBlocks[side] = nil
        }

        // Pin drops: the stick sound.
        for (key, start) in pinDrops where t0 - start < 70 && t1 - start >= 70 {
            _ = key
            emitSound("aim_pin_drop", 0, 1)
        }
        pinDrops = pinDrops.filter { t1 - $0.value < 400 }
        flaps = flaps.filter { t1 - $0.value.start < 400 }
        lids = lids.filter { t1 - $0.value.start < 500 }
        callouts.removeAll { t1 - $0.start >= $0.duration }
    }

    // MARK: Events from the core

    /// Turns the core's events into effects, sounds and timing. `old` is the
    /// frame before them (blocks that just fell are still in it).
    func ingest(_ events: [BattleEvent], old: BattleSnapshot, new: BattleSnapshot, nowNanos: UInt64) {
        duel = new.isDuel
        clock = max(clock, nowNanos)
        var breaks = 0
        var hobHitThisBatch = false
        for e in events where e.type == "break" { _ = e; breaks += 1 }
        for e in events where e.raw?.t == "hit" && e.raw?.target == "hob" { _ = e; hobHitThisBatch = true }
        var firstBlast = true

        // Collapses first: the ghost blocks fix when each side's chunk lands. What the landing
        // does (crush hits and breaks, crush/fall Bonks, a kettle pop from the crush, a Hob that
        // fell) waits for it.
        var landBySide: [Int: Double] = [:]
        for e in events where e.raw?.t == "collapse" {
            guard let raw = e.raw else { continue }
            let before = pieces.count
            collapse(raw, in: old, nowNanos: nowNanos)
            if let side = raw.side, pieces.count > before {
                let land = pieces[before...].map { landTime($0) }.max() ?? now
                landBySide[side] = max(landBySide[side] ?? 0, land)
            }
        }
        var crushHobs: Set<Int> = []
        if !landBySide.isEmpty {
            holdCrushedBlocks(events: events, old: old, landBySide: landBySide)
            for e in events {
                guard let raw = e.raw else { continue }
                if raw.t == "hit", raw.target == "hob", (raw.why == "crush" || raw.why == "fall"), let hob = raw.hob {
                    crushHobs.insert(hob)
                } else if raw.t == "drop", let hob = raw.hob {
                    crushHobs.insert(hob)
                }
            }
        }

        for e in events {
            guard let raw = e.raw else { continue }
            if raw.t == "collapse" { continue }
            if let land = deferUntil(raw, landBySide: landBySide, crushHobs: crushHobs), land > now {
                if raw.t == "drop" {
                    noteDrop(raw, in: new, land: land)
                    continue
                }
                if raw.t == "bonk", let hob = raw.hob {
                    let side = raw.side ?? hobSide(hob, in: new) ?? 0
                    deferredBonks.insert(Self.key(side, hob))
                }
                if raw.t == "kettle_pop", library.clip("kettle_pop") != nil { popFramePending = true }
                let event = e
                spawnTimer(after: land - now) { [weak self] in
                    self?.landed(event, old: old, new: new)
                }
                continue
            }
            switch raw.t {
            case "turn_start":
                newTurn()
            case "fire":
                if let side = raw.side, let hob = raw.hob {
                    if let def = hobDef(side: side, hob: hob, in: new) { lastShooter = (side, def) }
                    noteLaunch(side: side, hob: hob, shot: raw.shot ?? "clodpot")
                    playHob(side: side, hob: hob, "fire", in: new)
                } else if let shot = raw.shot {
                    emitSound(SoundCues.launch(shot), 0, 1, x: e.x)
                }
                if let shot = raw.shot, (shot == "tick_tock_crock" || shot == "pudding_bomb") {
                    addTrauma(0.10, decayMs: 100)
                }
            case "explode":
                let r = Double(raw.r ?? 16)
                let dmg = raw.dmg ?? 0
                let band = SoundCues.band(radius: r)
                impact(x: e.x, y: e.y, radius: r, type: raw.type ?? "blast", in: old.forts.isEmpty ? new : old, ground: new.ground)
                emitSound(raw.type == "pierce" ? "hit_pierce" : SoundCues.blast(band), 0, 1, x: e.x)
                if band == "large" || band == "huge" {
                    emitSound("hit_sub_thud", 0, band == "huge" ? 1.0 : 0.85, x: e.x)
                }
                lastImpact = (e.x, e.y, nowNanos)
                if firstBlast {
                    firstBlast = false
                    let trauma: (Double, Double)
                    switch band {
                    case "tiny": trauma = (0.10, 150)
                    case "small": trauma = (0.20, 200)
                    case "medium": trauma = (0.35, 250)
                    case "large": trauma = (0.55, 350)
                    default: trauma = (0.80, 450)
                    }
                    addTrauma(trauma.0, decayMs: trauma.1)
                    if band == "huge" {
                        hitStop(80, nowNanos: nowNanos)
                    } else if band == "large" || breaks >= 3 {
                        hitStop(50, nowNanos: nowNanos)
                    } else if (dmg >= 25 && hobHitThisBatch) || breaks >= 1 || band == "medium" {
                        hitStop(45, nowNanos: nowNanos)
                    }
                }
            case "carve":
                emitSound("hit_dig_carve", 0, 1, x: e.x)
            case "mound":
                emitSound("gnd_mound_grow", 0, 1, x: e.x)
                spawn("fx_dustcloud", x: e.x, y: e.y, scale: 0.8, z: 7)
            case "hit":
                let dmg = raw.dmg ?? e.amount
                if raw.target == "hob", let hob = raw.hob {
                    let side = hobSide(hob, in: new) ?? raw.side ?? 0
                    playHob(side: side, hob: hob, "hit", in: new)
                    if dmg > 0 {
                        let hobId: String = String(hob)
                        let hNew: HobView? = new.fort(side)?.hobs.first(where: { $0.id == hobId })
                        let h: HobView? = hNew ?? old.fort(side)?.hobs.first(where: { $0.id == hobId })
                        let cx = h?.x ?? e.x
                        let cy = (h?.y ?? e.y) + 28
                        spawnCallout("-\(dmg)", x: cx, y: cy, style: .hobHit)
                    }
                    if let def = hobDef(side: side, hob: hob, in: new) { onBark?(def, "takes_hit", side) }
                    if let shooter = lastShooter, shooter.side != side {
                        lastShooter = nil
                        onBark?(shooter.def, "hit_lands", shooter.side)
                    }
                } else if raw.target == "kettle" {
                    emitSound("ket_hit", 0, 1, x: e.x)
                    if dmg >= 20 { hitStop(45, nowNanos: nowNanos) }
                    if dmg > 0 {
                        let fort = raw.side.flatMap { new.fort($0) ?? old.fort($0) }
                        let cx = fort?.kettleX ?? e.x
                        let cy = (fort?.kettleY ?? e.y) + 24
                        spawnCallout("-\(dmg)", x: cx, y: cy, style: .kettleHit)
                    }
                    if let targetSide = raw.side, let shooter = lastShooter, shooter.side != targetSide {
                        lastShooter = nil
                        onBark?(shooter.def, "hit_lands", shooter.side)
                    }
                } else if dmg > 0, e.x != 0 || e.y != 0 {
                    spawnCallout("-\(dmg)", x: e.x, y: e.y + 14, style: .wallBreak)
                }
            case "break":
                if let side = raw.side, let c = raw.c, let r = raw.r {
                    breakBlock(side: side, c: c, r: r, in: old, why: raw.why)
                }
            case "big_drop":
                let side = raw.side ?? (e.side >= 0 ? e.side : 1)
                if let fort = new.fort(side) ?? old.fort(side) {
                    let top = (fort.blocks.map { $0.y + $0.h }.max() ?? fort.baseY + 48) + 24
                    spawnCallout(GameText.shared.t("notes.big_drop"), x: fort.x, y: top, style: .drop, duration: 1350)
                } else if e.x != 0 || e.y != 0 {
                    spawnCallout(GameText.shared.t("notes.collapse"), x: e.x, y: e.y + 24, style: .drop, duration: 1350)
                }
            case "bonk":
                applyBonk(raw, in: new, nowNanos: nowNanos)
            case "drop":
                if let hob = raw.hob {
                    let side = raw.side ?? hobSide(hob, in: new) ?? 0
                    playHob(side: side, hob: hob, "tumble", in: new)
                }
            case "climb", "puff_up":
                if let hob = raw.hob {
                    let side = raw.side ?? hobSide(hob, in: new) ?? 0
                    let key = Self.key(side, hob)
                    bonkedAt[key] = nil
                    deferredBonks.remove(key)
                    hobAnims[key] = nil
                }
            case "shove_off", "dug_out":
                if let hob = raw.hob {
                    let side = raw.side ?? hobSide(hob, in: new) ?? 0
                    playHob(side: side, hob: hob, "dig", in: new)
                }
            case "grudge", "clatter":
                if let hob = raw.hob {
                    let side = raw.side ?? hobSide(hob, in: new) ?? 0
                    playHob(side: side, hob: hob, "nextdoor", in: new)
                }
            case "kettle_pop":
                if let side = raw.side, kettlePops[side] == nil {
                    kettlePops[side] = (now, -1)
                    popFramePending = library.clip("kettle_pop") != nil
                }
            case "walk":
                if let side = raw.side, let from = raw.from, let to = raw.to, !from.isEmpty, !to.isEmpty {
                    let stepDx = Double(to[0] - from[0])
                    if let existing = walks[side], now < existing.start + existing.duration {
                        let segP = min(1, max(0, (now - existing.segStart) / max(1, existing.segDuration)))
                        let rem = existing.dx * (1 - segP)
                        let totalDx = rem + stepDx
                        let segDur = min(2000, max(220, abs(totalDx) * 14))
                        walks[side] = WalkAnim(dx: totalDx, start: existing.start,
                                               duration: (now - existing.start) + segDur,
                                               segStart: now, segDuration: segDur,
                                               lastStomp: existing.lastStomp)
                    } else {
                        let duration = min(2000, max(330, abs(stepDx) * 14))
                        walks[side] = WalkAnim(dx: stepDx, start: now, duration: duration)
                    }
                }
            case "thump", "castle_drop":
                emitSound("cas_thump", 0, 1, x: e.x)
                addTrauma(0.5, decayMs: 300)
                hitStop(50, nowNanos: nowNanos)
            case "threaded":
                emitSound("hit_threaded_zip", 0, 1, x: e.x)
                slowMotion(0.4, ms: 400, nowNanos: nowNanos)
            case "split":
                emitSound("fly_split", 0, 1, x: e.x)
            case "lid_block":
                emitSound("doo_lid_bounce", 0, 1, x: e.x)
            case "buried":
                emitSound("hob_buried_thlup", 0, 1, x: e.x)
            case "mend", "rebuild":
                emitSound(raw.t == "mend" ? "doo_mend_bucket_slosh" : "ket_patch", 0, 1, x: e.x)
                var firstCellPos: (x: Double, y: Double)?
                for cell in raw.blocks ?? [] {
                    guard let side = raw.side, let fort = new.fort(side) else { continue }
                    let o = fort.blockOrigin(c: cell.c, r: cell.r)
                    if firstCellPos == nil { firstCellPos = (o.x + fort.block / 2, o.y + fort.block + 12) }
                    spawn("fx_fizz_pop", x: o.x + fort.block / 2, y: o.y + fort.block / 2, scale: 1, z: 7)
                }
                if let pt = firstCellPos {
                    spawnCallout(GameText.shared.t(raw.t == "rebuild" ? "notes.rebuild" : "notes.mend"), x: pt.x, y: pt.y, style: .mend, duration: 1000)
                }
            case "front":
                emitSound("wx_front_chime", 0, 1)
                emitSound("wx_wind_shift", 0, 0.6)
            case "squall_warning":
                // The bell is for the Squall only (assets/audio/README.md).
                emitSound("wx_squall_bell", 0, 1)
            case "squall_round":
                if raw.n == 1 { emitSound("wx_squall_bell", 0, 1) }
            case "miss":
                emitSound("hit_miss_thud", 0, 0.5, x: e.x)
            case "win":
                if let winner = raw.winner, let fort = new.fort(winner) {
                    for h in fort.hobs where !h.bonked && h.hp > 0 {
                        if let id = Int(h.id) { playHob(side: winner, hob: id, "cheer", in: new) }
                    }
                    if let first = fort.hobs.first(where: { !$0.bonked }) { onBark?(first.def, "win", winner) }
                }
            case "boss_phase":
                emitSound("cas_boss_horn", 0, 1, x: e.x)
            case "roller":
                emitSound("doo_roller_rumble", 0, 1, x: e.x)
            case "roller_stop", "roller_done":
                emitSound("doo_roller_rumble", -3, 1, x: e.x)
            case "shears_jam":
                emitSound("doo_shears_jam", 0, 1, x: e.x)
            case "shears_open":
                emitSound("cas_thump", -3, 0.8, x: e.x)
            case "roller_move":
                emitSound("fly_roll_loop", 0, 0.7, x: e.x)
                addTrauma(0.2, decayMs: 300)
            case "shears_snip":
                emitSound("mat_timber_break", -2, 1, x: e.x)
                addTrauma(0.4, decayMs: 300)
            case "relight":
                emitSound("ket_patch", 2, 1, x: e.x)
                // Volley Points: the kettle is lit again; a second pop gets its own show (review 2, M8).
                if let side = raw.side { kettlePops[side] = nil }
            default:
                break
            }
        }
        noteBlockCracks(old: old, new: new)
        noteState(new)
    }

    private func applyBonk(_ raw: CoreEvent, in new: BattleSnapshot, nowNanos: UInt64) {
        guard let hob = raw.hob else { return }
        let side = raw.side ?? hobSide(hob, in: new) ?? 0
        let key = Self.key(side, hob)
        if let def = hobDef(side: side, hob: hob, in: new) { hobDefs[key] = def }
        if let cls = hobClass(side: side, hob: hob, in: new) { hobClasses[key] = cls }
        deferredBonks.remove(key)
        bonkedAt[key] = now
        hobAnims[key] = HobAnim(suffix: "bonked", start: now)
        let x = new.fort(side)?.hobs.first(where: { $0.id == String(hob) })?.x
        emitSound("hob_bonk", 0, 1, x: x)
        if let def = hobDef(side: side, hob: hob, in: new) { onBark?(def, "bonked", side) }
        hitStop(80, nowNanos: nowNanos)
        let standing = new.fort(side)?.hobs.filter { !$0.bonked && $0.hp > 0 }.count ?? 1
        if standing == 0 {
            slowMotion(new.isHuman(side) ? 0.5 : 0.3, ms: new.isHuman(side) ? 600 : 1000, nowNanos: nowNanos, ending: true)
        } else {
            slowMotion(0.5, ms: 400, nowNanos: nowNanos)
        }
    }

    /// Plays `col_crack` when a standing block drops down a wear tier without breaking.
    private func noteBlockCracks(old: BattleSnapshot, new: BattleSnapshot) {
        func wearTier(_ b: BlockView) -> Int {
            let ratio = Double(max(0, b.hp)) / Double(max(1, b.hpMax))
            return ratio > 0.66 ? 2 : (ratio > 0.33 ? 1 : 0)
        }
        for newFort in new.forts {
            guard let oldFort = old.fort(newFort.side) else { continue }
            var oldWear: [Int: Int] = [:]
            for b in oldFort.blocks {
                oldWear[Int(b.x.rounded()) * 10_000 + Int(b.y.rounded())] = wearTier(b)
            }
            for b in newFort.blocks {
                let key = Int(b.x.rounded()) * 10_000 + Int(b.y.rounded())
                if let prev = oldWear[key], wearTier(b) < prev {
                    emitSound("col_crack", 0, 0.8, x: b.x + b.w / 2)
                    return
                }
            }
        }
    }

    /// When an event of this batch must wait for a collapse to land, or nil to play it now.
    private func deferUntil(_ raw: CoreEvent, landBySide: [Int: Double], crushHobs: Set<Int>) -> Double? {
        guard !landBySide.isEmpty else { return nil }
        let latest = landBySide.values.max()
        switch raw.t {
        case "hit", "break":
            guard raw.why == "crush" || raw.why == "fall" else { return nil }
            return raw.side.flatMap { landBySide[$0] } ?? latest
        case "bonk":
            guard let hob = raw.hob, crushHobs.contains(hob) else { return nil }
            return raw.side.flatMap { landBySide[$0] } ?? latest
        case "drop":
            return raw.side.flatMap { landBySide[$0] } ?? latest
        case "kettle_pop":
            return raw.side.flatMap { landBySide[$0] }
        default:
            return nil
        }
    }

    /// A deferred event, once the ghost blocks have landed.
    private func landed(_ e: BattleEvent, old: BattleSnapshot, new: BattleSnapshot) {
        guard let raw = e.raw else { return }
        switch raw.t {
        case "hit":
            let dmg = raw.dmg ?? e.amount
            if raw.target == "hob", let hob = raw.hob {
                let side = hobSide(hob, in: new) ?? raw.side ?? 0
                let isOut = new.fort(side)?.hobs.first(where: { $0.id == String(hob) })?.isOut ?? false
                if dmg > 0 {
                    let hobId: String = String(hob)
                    let hNew: HobView? = new.fort(side)?.hobs.first(where: { $0.id == hobId })
                    let h: HobView? = hNew ?? old.fort(side)?.hobs.first(where: { $0.id == hobId })
                    spawnCallout("-\(dmg)", x: h?.x ?? e.x, y: (h?.y ?? e.y) + 28, style: .hobHit)
                }
                if !isOut {
                    playHob(side: side, hob: hob, "hit", in: new)
                    if let def = hobDef(side: side, hob: hob, in: new) { onBark?(def, "takes_hit", side) }
                }
            } else if raw.target == "kettle" {
                emitSound("ket_hit", 0, 1, x: e.x)
                if dmg > 0 {
                    let fort = raw.side.flatMap { new.fort($0) ?? old.fort($0) }
                    spawnCallout("-\(dmg)", x: fort?.kettleX ?? e.x, y: (fort?.kettleY ?? e.y) + 24, style: .kettleHit)
                }
            }
        case "bonk":
            applyBonk(raw, in: new, nowNanos: clock)
        case "break":
            if let side = raw.side, let c = raw.c, let r = raw.r {
                breakBlock(side: side, c: c, r: r, in: old, why: raw.why)
            }
        case "kettle_pop":
            if let side = raw.side, kettlePops[side] == nil {
                kettlePops[side] = (now, -1)
            }
        default:
            break
        }
    }

    /// A Hob that fell with the collapse: it stays at `from` until its chunk drops, then falls to `to`.
    private func noteDrop(_ raw: CoreEvent, in new: BattleSnapshot, land: Double) {
        guard let hob = raw.hob else { return }
        let side = raw.side ?? hobSide(hob, in: new) ?? 0
        let key = Self.key(side, hob)
        if let from = raw.from, let to = raw.to, from.count >= 2, to.count >= 2 {
            // Core cells are y down; the view's offsets are y up.
            let dx = Double(from[0] - to[0])
            let dy = Double(to[1] - from[1])
            let fallMs = sqrt(2 * max(1, abs(dy)) / Self.fallGravity) * 1000
            hobDrops[key] = HobDrop(dx: dx, dy: dy, fallStart: max(now, land - fallMs), land: land)
            spawnTimer(after: max(0, land - fallMs - now)) { [weak self] in
                self?.playHob(side: side, hob: hob, "tumble", in: new)
            }
        } else {
            spawnTimer(after: max(0, land - now)) { [weak self] in
                self?.playHob(side: side, hob: hob, "tumble", in: new)
            }
        }
    }

    /// Only blocks explicitly broken by a collapse (`break` with `why == "crush"`) stay drawn
    /// until the ghost blocks land; blocks destroyed by the blast disappear at once (iOS-H10).
    private func holdCrushedBlocks(events: [BattleEvent], old: BattleSnapshot, landBySide: [Int: Double]) {
        var bySide: [Int: [BlockView]] = [:]
        var seen: [Int: Set<Int>] = [:]
        for e in events {
            guard let raw = e.raw, raw.t == "break", raw.why == "crush",
                  let side = raw.side, landBySide[side] != nil,
                  let c = raw.c, let r = raw.r,
                  let fort = old.fort(side) else { continue }
            let o = fort.blockOrigin(c: c, r: r)
            let cellKey = c * 10_000 + r
            guard !(seen[side]?.contains(cellKey) ?? false) else { continue }
            if let block = fort.blocks.first(where: { abs($0.x - o.x) < 1 && abs($0.y - o.y) < 1 }) {
                seen[side, default: []].insert(cellKey)
                bySide[side, default: []].append(block)
            }
        }
        for (side, blocks) in bySide {
            guard let land = landBySide[side], !blocks.isEmpty else { continue }
            heldBlocks[side] = (blocks, land)
        }
    }

    /// Pins, Flaps and the Pot Lid change state between frames, not by event alone.
    func noteState(_ s: BattleSnapshot) {
        duel = s.isDuel
        var pins = Set<String>()
        for p in s.pins {
            let key = "\(p.side):\(p.hob):\(Int(p.x)):\(Int(p.y))"
            pins.insert(key)
            if !knownPins.contains(key), !knownPins.isEmpty || seededRooms { pinDrops[key] = now }
        }
        knownPins = pins
        for fort in s.forts {
            for h in fort.hobs {
                let hKey = "\(fort.side):\(h.id)"
                hobDefs[hKey] = h.def
                hobClasses[hKey] = h.cls
            }
            for room in fort.rooms {
                let key = "\(fort.side):\(room.id)"
                if let was = lastFlaps[key], was != room.flap, seededRooms {
                    flaps[key] = (now, room.flap)
                    if room.flap { emitSound("cas_loophole_flap", 0, 1, x: room.box.midX) } else { emitSound("cas_loophole_flap", -3, 0.8, x: room.box.midX) }
                }
                lastFlaps[key] = room.flap
                let lidKey = "\(fort.side):\(room.id)"
                if let was = lastLids[lidKey], was != room.lid, seededRooms {
                    lids[lidKey] = (now, room.lid)
                }
                lastLids[lidKey] = room.lid
            }
            let kKey = "\(fort.side):kettle"
            if let was = lastLids[kKey], was != fort.kettleLid, seededRooms {
                lids[kKey] = (now, fort.kettleLid)
                if fort.kettleLid { emitSound("doo_pot_lid_clang", 0, 1, x: fort.kettleX) }
            }
            lastLids[kKey] = fort.kettleLid
        }
        seededRooms = true
    }

    // MARK: Hobs

    static func key(_ side: Int, _ hob: Int) -> String { "\(side):\(hob)" }

    private func hobSide(_ hob: Int, in s: BattleSnapshot) -> Int? {
        for f in s.forts where f.hobs.contains(where: { $0.id == String(hob) }) { return f.side }
        return nil
    }

    private func hobDef(side: Int, hob: Int, in s: BattleSnapshot) -> String? {
        s.fort(side)?.hobs.first { $0.id == String(hob) }?.def
    }

    private func hobClass(side: Int, hob: Int, in s: BattleSnapshot) -> String? {
        s.fort(side)?.hobs.first { $0.id == String(hob) }?.cls
    }

    private var hobDefs: [String: String] = [:]
    private var hobClasses: [String: String] = [:]

    private func playHob(side: Int, hob: Int, _ suffix: String, in s: BattleSnapshot) {
        let key = Self.key(side, hob)
        if let def = hobDef(side: side, hob: hob, in: s) { hobDefs[key] = def }
        if let cls = hobClass(side: side, hob: hob, in: s) { hobClasses[key] = cls }
        if hobAnims[key]?.suffix == "bonked" && suffix != "cheer" { return }
        guard hobClip(key: key, suffix: suffix) != nil else {
            // No art for this Hob: the launch plays at once.
            if suffix == "fire" { emitSound(SoundCues.launch(pendingLaunch[key] ?? "clodpot"), 0, 1) }
            return
        }
        hobAnims[key] = HobAnim(suffix: suffix, start: now)
    }

    /// The clip for a Hob or Flattener key ("side:id") and a pose (H-I01).
    func hobClip(key: String, suffix: String) -> AnimClip? {
        guard let def = hobDefs[key] else { return nil }
        let side = key.hasPrefix("1:") ? 1 : 0
        if let art = SpriteImages.hobArtName(id: def, name: "") {
            return hobClip(art: art, side: side, suffix: suffix)
        }
        if side == 1 && !duel {
            let fk = SpriteImages.flattenerArtName(def: def, cls: hobClasses[key] ?? "")
            return library.clip("flattener_\(fk)_\(suffix)")
        }
        return nil
    }

    /// `hob_<art>_<team>_<suffix>`: blue for side 0, orange for Couch Duel player 2, and the
    /// Rival look (`rival`) for a Rival's Hob, with orange when an older atlas has no Rival clips.
    func hobClip(art: String, side: Int, suffix: String) -> AnimClip? {
        let team = SpriteImages.team(side, rival: side == 1 && !duel)
        if let clip = library.clip("hob_\(art)_\(team)_\(suffix)") { return clip }
        guard team == "rival" else { return nil }
        return library.clip("hob_\(art)_\(SpriteImages.team(side))_\(suffix)")
    }

    /// Remembers a Hob or Flattener's art and class so poses and events can play before any action.
    func noteHob(side: Int, id: String, def: String, cls: String = "") {
        let key = "\(side):\(id)"
        hobDefs[key] = def
        if !cls.isEmpty { hobClasses[key] = cls }
    }

    private var pendingLaunch: [String: String] = [:]

    private func hobEvent(key: String, suffix: String, _ name: String) {
        let side = key.hasPrefix("1:") ? 1 : 0
        switch (suffix, name) {
        case ("fire", "release"):
            emitSound(SoundCues.launch(pendingLaunch[key] ?? "clodpot"), 0, 1)
            if let def = hobDefs[key] { onBark?(def, "fire", side) }
        case ("hit", "flash"): emitSound("hob_hit_boing", 0, 1)
        case ("tumble", "fall"): emitSound("hob_tumble_roll", 0, 1)
        case ("land", "thud"), ("cheer", "land"): emitSound("hob_land_thud", 0, 1)
        case ("bonked", "inflate"): emitSound("hob_balloon_inflate", 0, 1)
        case ("bonked", "lift"): emitSound("hob_balloon_float", 0, 1)
        case ("cheer", "jump"): emitSound("hob_cheer", 0, 0.8)
        case ("dig", "clear"): emitSound("hob_shove_dig", 0, 1)
        default: break
        }
    }

    /// The shot a Hob is about to launch, so the release plays its sound.
    func noteLaunch(side: Int, hob: Int, shot: String) {
        pendingLaunch[Self.key(side, hob)] = shot
    }

    /// The sprite name for a Hob this frame.
    func hobSprite(side: Int, hob: HobView, selected: Bool, aiming: Bool, power: Int) -> (String, AnimClip)? {
        let id = Int(hob.id) ?? -1
        let key = Self.key(side, id)
        if hobDefs[key] == nil { hobDefs[key] = hob.def }
        guard let art = SpriteImages.hobArtName(id: hob.def, name: hob.name) else { return nil }
        if (hob.bonked || hob.hp <= 0) && !deferredBonks.contains(key) {
            guard let clip = hobClip(art: art, side: side, suffix: "bonked") else { return nil }
            let start = bonkedAt[key] ?? (now - 2000)
            let t = reduceMotion ? 0 : now - start
            return (clip.frame(at: t), clip)
        }
        if let a = hobAnims[key], a.suffix != "bonked", let clip = hobClip(art: art, side: side, suffix: a.suffix) {
            let t = now - a.start
            if !clip.finished(at: t) || clip.loop {
                return (clip.frame(at: reduceMotion && clip.loop ? 0 : t), clip)
            }
        }
        if selected && aiming, let clip = hobClip(art: art, side: side, suffix: "aim") {
            return (clip.pickFrame(value: power), clip)
        }
        guard let idle = hobClip(art: art, side: side, suffix: "idle") else { return nil }
        if reduceMotion { return (idle.frames[0], idle) }
        // A blink now and then, from the cosmetic stream.
        let last = lastBlink[key] ?? 0
        if now - last > 2600 + 2400 * cosmetic(), let blink = hobClip(art: art, side: side, suffix: "blink") {
            lastBlink[key] = now
            hobAnims[key] = HobAnim(suffix: "blink", start: now)
            return (blink.frame(at: 0), blink)
        }
        return (idle.frame(at: now + idlePhase(key: key, clip: idle)), idle)
    }

    /// Where a Hob's idle loop starts: a random point in the loop when the clip says
    /// `random_start`, else its `start_offset_ms`. Picked once per Hob from the cosmetic stream.
    func idlePhase(key: String, clip: AnimClip) -> Double {
        if let start = idleStart[key] { return start }
        let start = clip.randomStart ? cosmetic() * max(1, clip.total) : clip.startOffsetMs
        idleStart[key] = start
        return start
    }

    /// The balloon lift for a Bonked Hob, in cells (from the lift event on).
    func bonkLift(side: Int, hob: Int) -> Double {
        guard !reduceMotion, let start = bonkedAt[Self.key(side, hob)] else { return 0 }
        let t = now - start - 800
        return t > 0 ? min(18, t / 1000 * 8) : 0
    }

    /// Logical pose string (`idle`, `aim`, `fire`, `hit`, `tumble`, `land`, `dig`, `cheer`, `blink`, `bonked`)
    /// for a Flattener enemy unit, plus optional atlas frame when regenerated Flattener art is packed.
    func flattenerPose(side: Int, hob: HobView, selected: Bool, aiming: Bool, power: Int) -> (pose: String, timeMs: Double) {
        let id = Int(hob.id) ?? -1
        let key = Self.key(side, id)
        if hobDefs[key] == nil { hobDefs[key] = hob.def }
        if hobClasses[key] == nil { hobClasses[key] = hob.cls }
        if (hob.bonked || hob.hp <= 0) && !deferredBonks.contains(key) {
            let start = bonkedAt[key] ?? (now - 2000)
            return ("bonked", reduceMotion ? 0 : now - start)
        }
        if let a = hobAnims[key], a.suffix != "bonked" {
            let t = now - a.start
            if let clip = hobClip(key: key, suffix: a.suffix) {
                if !clip.finished(at: t) || clip.loop {
                    return (a.suffix, reduceMotion && clip.loop ? 0 : t)
                }
            } else if t < 600 {
                return (a.suffix, t)
            }
        }
        if selected && aiming { return ("aim", Double(power)) }
        if !reduceMotion {
            let last = lastBlink[key] ?? 0
            if now - last > 2600 + 2400 * cosmetic(), hobClip(key: key, suffix: "blink") != nil {
                lastBlink[key] = now
                hobAnims[key] = HobAnim(suffix: "blink", start: now)
                return ("blink", 0)
            }
        }
        let phase = Double(abs(id) * 317 % 1600)
        return ("idle", reduceMotion ? 0 : now + phase)
    }

    /// Looks up a regenerated `flattener_<fk>_<pose>` clip/frame in the atlas; returns nil
    /// when legacy atlases lack Flattener frames so the renderer draws the bespoke procedural Flattener rig.
    func flattenerSprite(side: Int, hob: HobView, selected: Bool, aiming: Bool, power: Int,
                         sheet: SpriteSheet) -> (String, AnimClip)? {
        let id = Int(hob.id) ?? -1
        let key = Self.key(side, id)
        if hobDefs[key] == nil { hobDefs[key] = hob.def }
        if hobClasses[key] == nil { hobClasses[key] = hob.cls }
        let fk = SpriteImages.flattenerArtName(def: hob.def, cls: hob.cls)
        let info = flattenerPose(side: side, hob: hob, selected: selected, aiming: aiming, power: power)
        let base = "flattener_\(fk)_"
        if let clip = hobClip(key: key, suffix: info.pose) ?? library.clip(base + info.pose) {
            let frameName = info.pose == "aim"
                ? clip.pickFrame(value: power)
                : clip.frame(at: reduceMotion && clip.loop ? 0 : info.timeMs)
            if sheet.frame(frameName) != nil { return (frameName, clip) }
        }
        let fallbackName = "flattener_\(fk)_\(info.pose)_0"
        if let f = sheet.frame(fallbackName) {
            let synth = AnimClip(name: base + info.pose, frames: [fallbackName], ms: [200], loop: true, loopFrom: 0,
                                 w: Double(f.size.width), h: Double(f.size.height), anchor: f.anchor,
                                 events: [:], next: nil, hold: nil, pick: nil)
            return (fallbackName, synth)
        }
        return nil
    }

    // MARK: Floating combat callouts (de-overlapped, Plate 2)

    func spawnCallout(_ text: String, x: Double, y: Double, style: CalloutStyle, duration: Double = 1150) {
        // Coalesce identical wallBreak numbers at the exact same cell within 80 ms so bursts stay crisp.
        if style == .wallBreak {
            let stamp: Double = now
            let same = callouts.contains { (c: CombatCallout) -> Bool in
                guard c.style == CalloutStyle.wallBreak else { return false }
                let near = abs(c.x - x) < 10.0 && abs(c.y - y) < 10.0
                return near && stamp - c.start < 80.0
            }
            if same { return }
        }
        if callouts.count >= 16 { callouts.removeFirst() }
        let id = nextCalloutId
        nextCalloutId &+= 1
        callouts.append(CombatCallout(id: id, text: text, x: x, y: y, start: now, duration: duration, style: style))
    }

    /// Returns active combat callouts with deterministic vertical + horizontal collision separation
    /// so simultaneous Round 10 Fatigue numbers never stack over each other.
    func resolvedCallouts(minDx: Double = 42, minDy: Double = 24) -> [(callout: CombatCallout, x: Double, y: Double, progress: Double)] {
        guard !callouts.isEmpty else { return [] }
        let sorted = callouts.sorted { $0.start == $1.start ? $0.id < $1.id : $0.start < $1.start }
        var placed: [(callout: CombatCallout, x: Double, y: Double, progress: Double)] = []
        placed.reserveCapacity(sorted.count)
        for c in sorted {
            let progress = min(1, max(0, (now - c.start) / max(1, c.duration)))
            var px = c.x
            var py = c.y + (reduceMotion ? 10 : progress * 28)
            var nudges = 0
            while nudges < 10 {
                guard let blocker = placed.first(where: { abs($0.x - px) < minDx && abs($0.y - py) < minDy }) else { break }
                py = blocker.y + minDy
                if nudges % 2 == 1 { px += (c.id % 2 == 0 ? 12 : -12) }
                nudges += 1
            }
            placed.append((c, px, py, progress))
        }
        return placed
    }

    // MARK: Impacts, breaks and collapse

    static func materialKey(_ mat: String) -> String {
        switch mat {
        case "wicker", "timber", "cobble", "footing": return mat
        case "brassbound", "moonbrick": return "cobble"
        case "hedge", "topiary": return "wicker"
        default: return "timber"
        }
    }

    private func impact(x: Double, y: Double, radius: Double, type: String, in s: BattleSnapshot, ground: TerrainGrid?) {
        var mat: String?
        for fort in s.forts {
            for b in fort.blocks where x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2 {
                mat = Self.materialKey(b.material)
                break
            }
            if mat != nil { break }
        }
        var water = false
        if mat == nil, let g = ground {
            let gy = g.h - Int(y)
            for dy in -3...3 where g.cell(Int(x), gy + dy) == 6 { water = true }
        }
        if water {
            spawn("fx_splash", x: x, y: y, scale: 1, z: 7)
        } else {
            spawn("fx_impact_\(mat ?? "dirt")", x: x, y: y, scale: 1, z: 7)
        }
        let size = radius >= 36 ? "large" : (radius >= 18 ? "medium" : "small")
        spawn("fx_boom_\(size)", x: x, y: y, scale: radius >= 44 ? 1.4 : 1, z: 7.5)
        if type == "mend" { spawn("fx_fizz_pop", x: x, y: y, scale: 1.2, z: 7) }
    }

    private func blockAt(side: Int, c: Int, r: Int, in s: BattleSnapshot) -> (x: Double, y: Double, size: Double, mat: String)? {
        guard let fort = s.fort(side) else { return nil }
        let o = fort.blockOrigin(c: c, r: r)
        let mat = fort.blocks.first { abs($0.x - o.x) < 1 && abs($0.y - o.y) < 1 }?.material ?? "timber"
        return (o.x, o.y, fort.block, mat)
    }

    private func breakBlock(side: Int, c: Int, r: Int, in s: BattleSnapshot, why: String?) {
        guard let b = blockAt(side: side, c: c, r: r, in: s) else { return }
        let mat = Self.materialKey(b.mat)
        let cx = b.x + b.size / 2, cy = b.y + b.size / 2
        if let brk = SoundCues.materialBreak(mat) { emitSound(brk, 0, 1, x: cx) }
        chunks(mat: mat, x: cx, y: cy, count: motion.chunksPerBlock[mat] ?? 3)
        spawn("fx_rubble_\(mat)", x: b.x, y: b.y + 4, scale: 1, z: 1.5, holdFor: motion.rubbleHoldMs, fadeLast: 300)
        addTrauma(0.10, decayMs: 150)
    }

    private func chunks(mat: String, x: Double, y: Double, count: Int) {
        for i in 0..<max(1, count) {
            let a = (Double(i) / Double(max(1, count)) - 0.5) * 2.2 + (cosmetic() - 0.5) * 0.6
            var s = FxSprite(clip: "fx_chunk_\(mat)", x: x, y: y, start: now)
            s.vx = sin(a) * (70 + 60 * cosmetic())
            s.vy = 90 + 90 * cosmetic()
            s.gravity = 600
            s.spin = (cosmetic() - 0.5) * 720
            s.life = motion.breakMs + 300
            s.fadeLast = 150
            sprites.append(s)
        }
    }

    private func collapse(_ raw: CoreEvent, in old: BattleSnapshot, nowNanos: UInt64) {
        guard let side = raw.side, let cells = raw.blocks, !cells.isEmpty, let fort = old.fort(side) else { return }
        var falls: [Int: Double] = [:]
        for f in raw.falls ?? [] where f.count >= 2 { falls[f[0]] = Double(f[1]) }
        let rows = Set(cells.map(\.r)).sorted()
        let midC = Double(fort.cols) / 2
        for cell in cells {
            let o = fort.blockOrigin(c: cell.c, r: cell.r)
            let mat = Self.materialKey(cell.mat ?? fort.blocks.first { abs($0.x - o.x) < 1 && abs($0.y - o.y) < 1 }?.material ?? "timber")
            let rowIndex = rows.firstIndex(of: cell.r) ?? 0
            pieces.append(CollapsePiece(side: side, mat: mat, x: o.x, y: o.y, size: fort.block,
                                        fall: max(8, falls[cell.c] ?? fort.block * Double(cell.r)), row: rowIndex,
                                        start: now, leanDir: Double(cell.c) < midC ? -1 : 1))
        }
        let colX = fort.originX + midC * fort.block
        emitSound("col_creak", 0, 1, x: colX)
        // The fall itself: sound at the drop, rumble and shake at the first landing.
        let n = cells.count
        let dropAt = motion.creakMs + motion.leanMs
        spawnTimer(after: dropAt) { [weak self] in self?.emitSound("col_chunk_fall", 0, 1, x: colX) }
        let firstLand = dropAt + sqrt(2 * 16 / Self.fallGravity) * 1000
        spawnTimer(after: firstLand) { [weak self] in
            guard let self else { return }
            self.emitSound("col_chunk_land", 0, Float(min(1, 0.5 + Double(n - 1) * 0.1)), x: colX)
            self.addTrauma(min(0.4, 0.05 * Double(n)), decayMs: 250)
            if n >= 3 { self.hitStop(50, nowNanos: self.clock) }
        }
        if n >= 6 { slowMotion(0.5, ms: 600, nowNanos: nowNanos) }
    }

    static let fallGravity = 900.0

    func landTime(_ p: CollapsePiece) -> Double {
        p.start + motion.creakMs + motion.leanMs + Double(p.row) * motion.rowGapMs + sqrt(2 * p.fall / Self.fallGravity) * 1000
    }

    /// Where a collapse piece is drawn now: lower-left offset, turn (degrees), vertical squash.
    func pieceTransform(_ p: CollapsePiece) -> (dx: Double, dy: Double, deg: Double, squash: Double) {
        let t = now - p.start
        let m = motion
        if t < m.creakMs {
            let shiver = reduceMotion ? 0 : m.shiverX.value(at: t)
            let wob = reduceMotion ? 0 : (m.wobble[p.mat]?.value(at: t) ?? 0)
            return (shiver, 0, wob, 1)
        }
        let lean = (m.leanDeg[p.mat] ?? 0) * p.leanDir * (reduceMotion ? 0 : 1)
        if t < m.creakMs + m.leanMs {
            return (0, 0, lean * m.leanTrack.value(at: t - m.creakMs), 1)
        }
        let dropStart = m.creakMs + m.leanMs + Double(p.row) * m.rowGapMs
        if t < dropStart { return (0, 0, lean, 1) }
        let land = landTime(p) - p.start
        if t < land {
            let s = (t - dropStart) / 1000
            let d = min(p.fall, 0.5 * Self.fallGravity * s * s)
            let sway = reduceMotion ? 0 : (m.swayDeg[p.mat] ?? 0) * sin(s * .pi / 0.2)
            return (0, -d, lean + sway, 1)
        }
        let skid = (m.skidPx[p.mat] ?? 0) * p.leanDir
        return (skid, -p.fall, 0, reduceMotion ? 1 : m.landSquash.value(at: t - land))
    }

    private func breakPiece(_ p: CollapsePiece) {
        let x = p.x + p.size / 2, y = p.y - p.fall + p.size / 2
        chunks(mat: p.mat, x: x, y: y, count: motion.chunksPerBlock[p.mat] ?? 3)
        spawn("fx_rubble_\(p.mat)", x: p.x, y: p.y - p.fall + 4, scale: 1, z: 1.5, holdFor: motion.rubbleHoldMs, fadeLast: 300)
        spawn("fx_dustcloud", x: x, y: p.y - p.fall, scale: motion.dustScale[p.mat] ?? 1, z: 7)
        if p.row == 0 {
            emitSound("col_debris_patter", 0, 0.8, x: x)
            emitSound("col_dust_settle", 0, 0.7, x: x)
        }
    }

    // MARK: Trails, Squall, wind

    /// Puffs behind each shell in flight, every 45 ms of view time.
    func trail(_ shells: [ShellView], ids: [Int]) {
        for (i, sh) in shells.enumerated() {
            let id = i < ids.count ? ids[i] : i
            let last = lastTrail[id] ?? -1000
            guard now - last >= 45 else { continue }
            lastTrail[id] = now
            let kind = trailKind(sh.kind)
            spawn("fx_trail_\(kind)", x: sh.x, y: sh.y, scale: 1, z: 5.5)
        }
        if shells.isEmpty { lastTrail = [:] }
    }

    // MARK: Sprites

    private func spawn(_ clip: String, x: Double, y: Double, scale: Double, z: CGFloat, holdFor: Double = 0, fadeLast: Double = 0) {
        guard sprites.count < 160 else { return }
        var s = FxSprite(clip: clip, x: x, y: y, start: now)
        s.scale = scale
        s.z = z
        s.holdFor = holdFor
        s.fadeLast = fadeLast
        sprites.append(s)
    }

    private func spriteEvent(_ s: FxSprite, _ name: String) {
        switch (s.clip, name) {
        case (let c, "flash") where c.hasPrefix("fx_impact_"):
            let mat = String(c.dropFirst("fx_impact_".count))
            emitSound(mat == "dirt" ? "hit_miss_thud" : (SoundCues.materialHit(mat) ?? "hit_miss_thud"), 0, mat == "dirt" ? 0.6 : 1, x: s.x)
        case ("fx_splash", "plop"): emitSound("hit_water_splash", 0, 1, x: s.x)
        case ("fx_fizz_pop", "pop"): emitSound("hit_mend_fizz", 0, 1, x: s.x)
        default: break
        }
    }

    /// Delayed one-shot callbacks in view time (they wait through hit stop).
    private var timers: [(at: Double, run: () -> Void)] = []

    private func spawnTimer(after ms: Double, _ run: @escaping () -> Void) {
        timers.append((now + ms, run))
    }

    /// Runs due timers. Called by the session after `advance`.
    func runTimers() {
        guard !timers.isEmpty else { return }
        let due = timers.filter { $0.at <= now }
        timers.removeAll { $0.at <= now }
        for t in due { t.run() }
    }

    /// Clips with no entry in animations.json, made from numbered frames.
    static func synthetic(_ name: String) -> AnimClip? {
        switch name {
        case "fx_boom_small", "fx_boom_medium", "fx_boom_large":
            let size = name.hasSuffix("large") ? 96.0 : (name.hasSuffix("medium") ? 64.0 : 40.0)
            return AnimClip(name: name, frames: (0..<4).map { "\(name)_\($0)" }, ms: [60, 70, 80, 90], loop: false, loopFrom: 0,
                            w: size, h: size, anchor: CGPoint(x: size / 2, y: size / 2), events: [:], next: nil, hold: nil, pick: nil)
        default:
            return nil
        }
    }
}

/// Which sound plays for what (assets/audio/audio.json `shot_launch`,
/// `material_sounds`, `blast_sounds`), as plain lookups.
enum SoundCues {
    static func launch(_ shot: String) -> String {
        SoundManifest.shared.shotLaunch[shot] ?? "launch_lob"
    }

    static func band(radius r: Double) -> String {
        if r <= 8 { return "tiny" }
        if r <= 18 { return "small" }
        if r <= 30 { return "medium" }
        if r <= 44 { return "large" }
        return "huge"
    }

    static func blast(_ band: String) -> String {
        SoundManifest.shared.blastSounds[band] ?? "hit_blast_medium"
    }

    static func materialHit(_ mat: String) -> String? {
        SoundManifest.shared.materialSounds[mat]?.hit
    }

    static func materialBreak(_ mat: String) -> String? {
        SoundManifest.shared.materialSounds[mat]?.brk
    }
}

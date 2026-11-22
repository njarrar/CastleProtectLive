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
    var lastStomp = -1
}

/// What a Hob is doing right now, for its sprite.
struct HobAnim: Equatable {
    /// Clip suffix: fire, hit, tumble, land, dig, cheer, nextdoor, blink, bonked.
    var suffix: String
    var start: Double
    var firedTo = -1.0
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

    // Settings
    var reduceMotion = false
    /// 0 to 1: Reduce shake.
    var shakeAmount = 1.0
    /// 2x resolve: hit stops halve, slow motion is skipped.
    var fast = false

    // Clock state (real time ns)
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
    private var rng: UInt32 = 0x2545_F491

    /// A sound to play now: id, pitch shift in semitones, gain.
    var onSound: ((String, Double, Float) -> Void)?
    /// A bark: Hob def, event (fire, takes_hit, bonked, win, hit_lands), side.
    var onBark: ((String, String, Int) -> Void)?
    /// Shot id to trail kind (blast, pierce, dig, fire, mend).
    var trailKind: (String) -> String = { _ in "blast" }

    init(library: AnimationLibrary = .shared) {
        self.library = library
    }

    var motion: MotionData { library.motion }

    /// True while anything is moving, so the renderer draws every frame.
    var isActive: Bool {
        !sprites.isEmpty || !pieces.isEmpty || !walks.isEmpty || trauma > 0.001
            || !kettlePops.filter { now - $0.value.start < 1200 }.isEmpty
            || !hobAnims.isEmpty || DispatchTime.now().uptimeNanoseconds < slowUntil
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
        lastImpact = nil
        trauma = 0
        hitStopUntil = 0
        slowUntil = 0
        slowAddedMs = 0
        knownPins = []
        lastFlaps = [:]
        lastLids = [:]
        seededRooms = false
        lastTrail = [:]
    }

    // MARK: Clock

    /// Real time passed. Returns the view time that passed (0 during hit stop).
    func advance(realMs: Double, nowNanos: UInt64) -> Double {
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

    private func random() -> Double {
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
                onSound?("cas_steam", 0, 0.7)
                continue
            }
            let frame = Int(t / motion.bobFrameMs)
            if frame != w.lastStomp {
                var next = w
                next.lastStomp = frame
                walks[side] = next
                if frame % 3 == 0 { onSound?("cas_step", 0, 1) }
            }
        }

        // Kettle pops: crack, pop, sit.
        for (side, k) in kettlePops {
            guard let clip = library.clip("kettle_pop") else { continue }
            let local1 = t1 - k.start
            if local1 > k.firedTo {
                for name in clip.eventsFired(from: k.firedTo, to: local1) {
                    switch name {
                    case "crack": onSound?("ket_crack", 0, 1)
                    case "pop":
                        onSound?("ket_pop", 0, 1)
                        let ns = DispatchTime.now().uptimeNanoseconds
                        hitStop(80, nowNanos: ns)
                        addTrauma(1.0, decayMs: 600)
                        slowMotion(0.25, ms: 1200, nowNanos: ns, ending: true)
                    case "sit": onSound?("ket_sit_down", 0, 1)
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

        // Pin drops: the stick sound.
        for (key, start) in pinDrops where t0 - start < 70 && t1 - start >= 70 {
            _ = key
            onSound?("aim_pin_drop", 0, 1)
        }
        pinDrops = pinDrops.filter { t1 - $0.value < 400 }
        flaps = flaps.filter { t1 - $0.value.start < 400 }
        lids = lids.filter { t1 - $0.value.start < 500 }
    }

    // MARK: Events from the core

    /// Turns the core's events into effects, sounds and timing. `old` is the
    /// frame before them (blocks that just fell are still in it).
    func ingest(_ events: [BattleEvent], old: BattleSnapshot, new: BattleSnapshot, nowNanos: UInt64) {
        var breaks = 0
        var hobHitThisBatch = false
        for e in events where e.type == "break" { _ = e; breaks += 1 }
        for e in events where e.raw?.t == "hit" && e.raw?.target == "hob" { _ = e; hobHitThisBatch = true }
        var firstBlast = true

        for e in events {
            guard let raw = e.raw else { continue }
            switch raw.t {
            case "turn_start":
                newTurn()
            case "fire":
                if let side = raw.side, let hob = raw.hob {
                    noteLaunch(side: side, hob: hob, shot: raw.shot ?? "clodpot")
                    playHob(side: side, hob: hob, "fire", in: new)
                } else if let shot = raw.shot {
                    onSound?(SoundCues.launch(shot), 0, 1)
                }
                if let shot = raw.shot, (shot == "tick_tock_crock" || shot == "pudding_bomb") {
                    addTrauma(0.10, decayMs: 100)
                }
            case "explode":
                let r = Double(raw.r ?? 16)
                let dmg = raw.dmg ?? 0
                let band = SoundCues.band(radius: r)
                impact(x: e.x, y: e.y, radius: r, type: raw.type ?? "blast", in: old.forts.isEmpty ? new : old, ground: new.ground)
                onSound?(raw.type == "pierce" ? "hit_pierce" : SoundCues.blast(band), 0, 1)
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
                    } else if dmg >= 30 && hobHitThisBatch {
                        hitStop(30, nowNanos: nowNanos)
                    }
                }
            case "carve":
                onSound?("hit_dig_carve", 0, 1)
            case "mound":
                onSound?("gnd_mound_grow", 0, 1)
                spawn("fx_dustcloud", x: e.x, y: e.y, scale: 0.8, z: 7)
            case "hit":
                if raw.target == "hob", let hob = raw.hob {
                    let side = hobSide(hob, in: new) ?? raw.side ?? 0
                    playHob(side: side, hob: hob, "hit", in: new)
                    if let def = hobDef(side: side, hob: hob, in: new) { onBark?(def, "takes_hit", side) }
                } else if raw.target == "kettle" {
                    onSound?("ket_hit", 0, 1)
                }
            case "break":
                if let side = raw.side, let c = raw.c, let r = raw.r {
                    breakBlock(side: side, c: c, r: r, in: old, why: raw.why)
                }
            case "collapse":
                collapse(raw, in: old, nowNanos: nowNanos)
            case "big_drop":
                break
            case "bonk":
                if let hob = raw.hob {
                    let side = raw.side ?? hobSide(hob, in: new) ?? 0
                    let key = Self.key(side, hob)
                    bonkedAt[key] = now
                    hobAnims[key] = HobAnim(suffix: "bonked", start: now)
                    onSound?("hob_bonk", 0, 1)
                    if let def = hobDef(side: side, hob: hob, in: new) { onBark?(def, "bonked", side) }
                    hitStop(80, nowNanos: nowNanos)
                    let standing = new.fort(side)?.hobs.filter { !$0.bonked && $0.hp > 0 }.count ?? 1
                    if standing == 0 {
                        slowMotion(new.isHuman(side) ? 0.5 : 0.3, ms: new.isHuman(side) ? 600 : 1000, nowNanos: nowNanos, ending: true)
                    } else {
                        slowMotion(0.5, ms: 400, nowNanos: nowNanos)
                    }
                }
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
                }
            case "walk":
                if let side = raw.side, let from = raw.from, let to = raw.to, !from.isEmpty, !to.isEmpty {
                    let dx = Double(to[0] - from[0])
                    let duration = min(2000, max(330, abs(dx) * 14))
                    walks[side] = WalkAnim(dx: dx, start: now, duration: duration)
                }
            case "thump", "castle_drop":
                onSound?("cas_thump", 0, 1)
                addTrauma(0.5, decayMs: 300)
                hitStop(50, nowNanos: nowNanos)
            case "threaded":
                onSound?("hit_pierce", 0, 1)
                slowMotion(0.4, ms: 400, nowNanos: nowNanos)
            case "split":
                onSound?("fly_split", 0, 1)
            case "lid_block":
                onSound?("doo_pot_lid_clang", 0, 1)
            case "mend", "rebuild":
                onSound?(raw.t == "mend" ? "doo_mend_bucket_slosh" : "ket_patch", 0, 1)
                for cell in raw.blocks ?? [] {
                    guard let side = raw.side, let fort = new.fort(side) else { continue }
                    let o = fort.blockOrigin(c: cell.c, r: cell.r)
                    spawn("fx_fizz_pop", x: o.x + fort.block / 2, y: o.y + fort.block / 2, scale: 1, z: 7)
                }
            case "front":
                onSound?("wx_wind_shift", 0, 1)
            case "squall_warning":
                onSound?("wx_squall_bell", 0, 1)
            case "miss":
                onSound?("hit_miss_thud", 0, 0.5)
            case "win":
                if let winner = raw.winner, let fort = new.fort(winner) {
                    for h in fort.hobs where !h.bonked && h.hp > 0 {
                        if let id = Int(h.id) { playHob(side: winner, hob: id, "cheer", in: new) }
                    }
                    if let first = fort.hobs.first(where: { !$0.bonked }) { onBark?(first.def, "win", winner) }
                }
            case "boss_phase", "roller", "shears_open", "shears_jam":
                onSound?("cas_thump", -3, 0.8)
            case "roller_move":
                onSound?("fly_roll_loop", 0, 0.7)
                addTrauma(0.2, decayMs: 300)
            case "shears_snip":
                onSound?("mat_timber_break", -2, 1)
                addTrauma(0.4, decayMs: 300)
            case "relight":
                onSound?("ket_patch", 2, 1)
            default:
                break
            }
        }
        noteState(new)
    }

    /// Pins, Flaps and the Pot Lid change state between frames, not by event alone.
    func noteState(_ s: BattleSnapshot) {
        var pins = Set<String>()
        for p in s.pins {
            let key = "\(p.side):\(p.hob):\(Int(p.x)):\(Int(p.y))"
            pins.insert(key)
            if !knownPins.contains(key), !knownPins.isEmpty || seededRooms { pinDrops[key] = now }
        }
        knownPins = pins
        for fort in s.forts {
            for room in fort.rooms {
                let key = "\(fort.side):\(room.id)"
                if let was = lastFlaps[key], was != room.flap, seededRooms {
                    flaps[key] = (now, room.flap)
                    if room.flap { onSound?("cas_loophole_flap", 0, 1) } else { onSound?("cas_loophole_flap", -3, 0.8) }
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
                if fort.kettleLid { onSound?("doo_pot_lid_clang", 0, 1) }
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

    private var hobDefs: [String: String] = [:]

    private func playHob(side: Int, hob: Int, _ suffix: String, in s: BattleSnapshot) {
        let key = Self.key(side, hob)
        if let def = hobDef(side: side, hob: hob, in: s) { hobDefs[key] = def }
        if hobAnims[key]?.suffix == "bonked" && suffix != "cheer" { return }
        guard hobClip(key: key, suffix: suffix) != nil else {
            // No art for this Hob: the launch plays at once.
            if suffix == "fire" { onSound?(SoundCues.launch(pendingLaunch[key] ?? "clodpot"), 0, 1) }
            return
        }
        hobAnims[key] = HobAnim(suffix: suffix, start: now)
    }

    /// The clip for a Hob key ("side:id") and a pose.
    func hobClip(key: String, suffix: String) -> AnimClip? {
        guard let def = hobDefs[key], let art = SpriteImages.hobArtName(id: def, name: "") else { return nil }
        let side = key.hasPrefix("1:") ? 1 : 0
        return library.clip("hob_\(art)_\(SpriteImages.team(side))_\(suffix)")
    }

    /// Remembers a Hob's art so idle poses can play before any event.
    func noteHob(side: Int, id: String, def: String) {
        hobDefs["\(side):\(id)"] = def
    }

    private var pendingLaunch: [String: String] = [:]

    private func hobEvent(key: String, suffix: String, _ name: String) {
        let side = key.hasPrefix("1:") ? 1 : 0
        switch (suffix, name) {
        case ("fire", "release"):
            onSound?(SoundCues.launch(pendingLaunch[key] ?? "clodpot"), 0, 1)
            if let def = hobDefs[key] { onBark?(def, "fire", side) }
        case ("hit", "flash"): onSound?("hob_hit_boing", 0, 1)
        case ("tumble", "fall"): onSound?("hob_tumble_roll", 0, 1)
        case ("land", "thud"), ("cheer", "land"): onSound?("hob_land_thud", 0, 1)
        case ("bonked", "inflate"): onSound?("hob_balloon_inflate", 0, 1)
        case ("bonked", "lift"): onSound?("hob_balloon_float", 0, 1)
        case ("cheer", "jump"): onSound?("hob_cheer", 0, 0.8)
        case ("dig", "clear"): onSound?("hob_shove_dig", 0, 1)
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
        let base = "hob_\(art)_\(SpriteImages.team(side))_"
        if hob.bonked || hob.hp <= 0 {
            guard let clip = library.clip(base + "bonked") else { return nil }
            let start = bonkedAt[key] ?? (now - 2000)
            let t = reduceMotion ? 0 : now - start
            return (clip.frame(at: t), clip)
        }
        if let a = hobAnims[key], a.suffix != "bonked", let clip = library.clip(base + a.suffix) {
            let t = now - a.start
            if !clip.finished(at: t) || clip.loop {
                return (clip.frame(at: reduceMotion && clip.loop ? 0 : t), clip)
            }
        }
        if selected && aiming, let clip = library.clip(base + "aim") {
            return (clip.pickFrame(value: power), clip)
        }
        guard let idle = library.clip(base + "idle") else { return nil }
        if reduceMotion { return (idle.frames[0], idle) }
        // A blink now and then, from the cosmetic stream.
        let last = lastBlink[key] ?? 0
        if now - last > 2600 + 2400 * random(), let blink = library.clip(base + "blink") {
            lastBlink[key] = now
            hobAnims[key] = HobAnim(suffix: "blink", start: now)
            return (blink.frame(at: 0), blink)
        }
        let phase = Double(abs(id) * 317 % 1600)
        return (idle.frame(at: now + phase), idle)
    }

    /// The balloon lift for a Bonked Hob, in cells (from the lift event on).
    func bonkLift(side: Int, hob: Int) -> Double {
        guard !reduceMotion, let start = bonkedAt[Self.key(side, hob)] else { return 0 }
        let t = now - start - 800
        return t > 0 ? min(18, t / 1000 * 8) : 0
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
        if let brk = SoundCues.materialBreak(mat) { onSound?(brk, 0, 1) }
        chunks(mat: mat, x: cx, y: cy, count: motion.chunksPerBlock[mat] ?? 3)
        spawn("fx_rubble_\(mat)", x: b.x, y: b.y + 4, scale: 1, z: 1.5, holdFor: motion.rubbleHoldMs, fadeLast: 300)
        addTrauma(0.10, decayMs: 150)
    }

    private func chunks(mat: String, x: Double, y: Double, count: Int) {
        for i in 0..<max(1, count) {
            let a = (Double(i) / Double(max(1, count)) - 0.5) * 2.2 + (random() - 0.5) * 0.6
            var s = FxSprite(clip: "fx_chunk_\(mat)", x: x, y: y, start: now)
            s.vx = sin(a) * (70 + 60 * random())
            s.vy = 90 + 90 * random()
            s.gravity = 600
            s.spin = (random() - 0.5) * 720
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
        onSound?("col_creak", 0, 1)
        // The fall itself: sound at the drop, rumble and shake at the first landing.
        let n = cells.count
        let dropAt = motion.creakMs + motion.leanMs
        spawnTimer(after: dropAt) { [weak self] in self?.onSound?("col_chunk_fall", 0, 1) }
        let firstLand = dropAt + sqrt(2 * 16 / Self.fallGravity) * 1000
        spawnTimer(after: firstLand) { [weak self] in
            guard let self else { return }
            self.onSound?("col_chunk_land", 0, Float(min(1, 0.5 + Double(n - 1) * 0.1)))
            self.addTrauma(min(0.4, 0.05 * Double(n)), decayMs: 250)
            if n >= 3 { self.hitStop(50, nowNanos: DispatchTime.now().uptimeNanoseconds) }
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
            onSound?("col_debris_patter", 0, 0.8)
            onSound?("col_dust_settle", 0, 0.7)
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
            onSound?(mat == "dirt" ? "hit_miss_thud" : (SoundCues.materialHit(mat) ?? "hit_miss_thud"), 0, mat == "dirt" ? 0.6 : 1)
        case ("fx_splash", "plop"): onSound?("hit_water_splash", 0, 1)
        case ("fx_fizz_pop", "pop"): onSound?("hit_mend_fizz", 0, 1)
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

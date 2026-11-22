package games.castleprotect.core

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * STAND-IN ONLY. Used when libcastle_jni.so is not packaged, so the app can be
 * built and its screens exercised before the Rust core lands. It speaks the same
 * JSON as the real core but its "rules" are toys: no support or collapse, no
 * classes, no statuses, a crude AI. Nothing here is a source of truth and none
 * of it runs when the native core is present.
 */
class FakeCore : CoreBridge {
    override val name = "stand-in core (no native library in this build)"

    private class B(var rx: Float, var ry: Float, val mat: String, var hp: Int, val hpMax: Int)
    private class H(val id: String, val name: String, val cls: String, var hp: Int, val rx: Float, val ry: Float, var angle: Int = -1, var power: Int = 60, var aimSet: Boolean = false, var lastA: Int = -1, var lastP: Int = 0)
    private class F(val side: Int, var x: Float, var baseY: Float, var kettle: Int, val blocks: MutableList<B>, val hobs: MutableList<H>, var steam: Int = 100, var hand: MutableList<String> = mutableListOf(), var knack: Int = 2)
    private class Sh(var x: Float, var y: Float, var vx: Float, var vy: Float, val kind: String, val side: Int, var age: Int = 0, val look: String = kind)
    private class P(val x: Float, val y: Float, val side: Int, val round: Int, val path: FloatArray)

    private val w = 1600f
    private val h = 600f
    private var terrain = FloatArray(201)
    private var forts = mutableListOf<F>()
    private var phase = "none"
    private var mode = ""
    private var level = ""
    private var preset = "fair"
    private var seats = "side_by_side"
    private var names = listOf("You", "Rival")
    private var humans = listOf(true, false)
    private var round = 1
    private var roundCap = 15
    private var active = 0
    private var turnSeq = 0
    private var wind = 0
    private var forecast = 0
    private var windMax = 2
    private var selHob = arrayOf("", "")
    private var selShot = "plain"
    private var steamTurn = 0
    private var shell: Sh? = null
    private val pins = mutableListOf<P>()
    private var path = ArrayList<Float>()
    private var timer = 0f
    private var acc = 0f
    private var tick = 0L
    private var speed = 1
    private var rng = Random(1)
    private val events = JSONArray()
    private var pool = mutableListOf<Array<String>>() // id, name, weight, hint, best, takenBy
    private var draftTurn = 0
    private var result: JSONObject? = null
    private var handoffLine = ""
    private var lastLine = ""
    private val pennants = IntArray(10)
    private var buttons = 0

    private val levelNames = listOf("First Lump", "Two Hats", "Kettle on the Knoll", "Breezy Tops", "The Big One", "Roof Trouble", "Hetty in a Jam", "Rummage Sale", "Over Loaf Hill", "The Topiary Keep")
    private val rivals = listOf("Sir Pudge", "Corporal Clip", "Sgt Posy Rakewell", "L/Cpl Turfwick", "Sgt Posy Rakewell", "Warden Privet Snedd", "Corporal Clip", "Sgt Posy Rakewell", "L/Cpl Turfwick", "Marshal Trimm")
    private val roster = listOf("marge" to "Lobber", "quill" to "Zinger", "jax" to "Scatterjack", "grub" to "Delver", "bobbin" to "Boinker", "hetty" to "Patcher", "old_thumper" to "Lobber", "nan" to "Patcher")
    private val shellDefs = listOf(
        arrayOf("pudding_bomb", "Pudding Bomb", "1", "Big soft blast, wide.", "Lobber"),
        arrayOf("lid_lifter", "Lid Lifter", "1", "Pops roofs off upward.", "Lobber"),
        arrayOf("marble_sack", "Marble Sack", "1", "Splits in three at the top.", "Scatterjack"),
        arrayOf("nosy_goose", "Nosy Goose", "1", "Honks toward the nearest Hob.", "Zinger"),
        arrayOf("mole_mail", "Mole Mail", "1", "Digs in, then pops.", "Delver"),
        arrayOf("old_turnip", "Old Turnip", "0", "Dud. Bounces. Smells.", "Boinker"),
    )

    private fun ev(type: String, cue: String = "", x: Float = 0f, text: String = "") {
        events.put(JSONObject().put("type", type).put("cue", cue).put("x", x.toDouble()).put("text", text))
    }

    private fun display(id: String) = id.split('_').joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

    private fun buildFort(side: Int, x: Float, crew: Int): F {
        val base = ground(x)
        // Flatten the ground under the fort.
        for (i in terrain.indices) { val cx = i * w / (terrain.size - 1); if (abs(cx - x) < 76) terrain[i] = base }
        // 8 x 6 blocks. Row 0 is Footing. Rooms are 2 x 2 blocks: the Kettle Room in the middle, one Nook per Hob.
        val rooms = listOf(1 to 1, 5 to 1, 1 to 3, 5 to 3).take(crew)
        fun inRoom(c: Int, r: Int) = (c in 3..4 && r in 1..2) || rooms.any { c in it.first..it.first + 1 && r in it.second..it.second + 1 }
        val blocks = mutableListOf<B>()
        for (col in 0 until 8) for (row in 0 until 6) {
            if (inRoom(col, row) || (row == 5 && (col == 0 || col == 7))) continue
            val mat = when (row) { 0 -> "footing"; 1, 2 -> "cobble"; 5 -> "wicker"; else -> "timber" }
            val hp = when (mat) { "footing" -> 120; "cobble" -> 80; "wicker" -> 30; else -> 50 }
            blocks.add(B((col - 4) * 16f, row * 16f, mat, hp, hp))
        }
        val off = if (side == 0) 0 else 4
        val hobs = rooms.mapIndexed { i, (c, r) ->
            val (id, cls) = roster[(i + off) % roster.size]
            H(id + side, display(id), cls, 60, (c - 3) * 16f, r * 16f) // feet on the Nook floor
        }.toMutableList()
        return F(side, x, base, 300, blocks, hobs)
    }

    private fun ground(x: Float): Float {
        val f = (x / w).coerceIn(0f, 1f) * (terrain.size - 1)
        val i = f.toInt().coerceIn(0, terrain.size - 2)
        val t = f - i
        return terrain[i] * (1 - t) + terrain[i + 1] * t
    }

    private fun newBattle(o: JSONObject) {
        mode = o.optString("mode", "campaign"); level = o.optString("level"); preset = o.optString("preset", "fair")
        seats = o.optString("seats", "side_by_side")
        rng = Random(o.optLong("seed", 7))
        val n = level.substringAfter('-', "5").toIntOrNull() ?: 5
        roundCap = if (mode == "campaign") min(15, 6 + n * 2) else o.optInt("rounds", 15)
        windMax = if (mode == "campaign") (if (n < 4) 0 else 2) else when (o.optString("wind")) { "calm" -> 0; "gusty" -> 6; else -> 3 }
        val a = rng.nextFloat() * 6f; val b = 30f + rng.nextFloat() * 50f
        for (i in terrain.indices) {
            val t = i / (terrain.size - 1f)
            terrain[i] = 130f + b * sin(t * 6.283f * 1.5f + a) + 25f * sin(t * 6.283f * 4f + a * 2)
        }
        val crew = if (mode == "campaign") min(4, max(1, (n + 1) / 2)) else 4
        forts = mutableListOf(buildFort(0, 230f, crew), buildFort(1, 1370f, crew))
        val on = o.optJSONArray("names")
        humans = if (mode == "duel") listOf(true, true) else listOf(true, false)
        names = when {
            on != null && on.length() >= 2 -> listOf(on.optString(0), on.optString(1))
            mode == "campaign" -> listOf("You", rivals[(n - 1).coerceIn(0, 9)])
            mode == "duel" -> listOf("Player 1", "Player 2")
            else -> listOf("You", "Rival")
        }
        round = 1; active = 0; turnSeq = 0; wind = if (windMax == 0) 0 else rng.nextInt(-windMax, windMax + 1)
        forecast = if (windMax == 0) 0 else rng.nextInt(-windMax, windMax + 1)
        selHob = arrayOf(forts[0].hobs[0].id, forts[1].hobs[0].id); selShot = "plain"
        pins.clear(); shell = null; result = null; steamTurn = 0; speed = 1
        val draft = o.optBoolean("draft", true) && (mode != "campaign" || n >= 8)
        pool = if (draft) shellDefs.map { arrayOf(it[0], it[1], it[2], it[3], it[4], "-1") }.toMutableList() else mutableListOf()
        draftTurn = 0
        phase = "pre"
    }

    private fun endDraft() {
        if (pool.isNotEmpty()) while (forts.any { it.hand.size < 2 }) quickPickOne()
        phase = "plan"; turnSeq++
        ev("audio", "turn"); ev("turn")
    }

    private fun quickPickOne() {
        val side = if (forts[draftTurn].hand.size < 2) draftTurn else 1 - draftTurn
        val c = pool.firstOrNull { it[5] == "-1" && it[2] != "0" } ?: pool.firstOrNull { it[5] == "-1" } ?: return
        take(c, side)
    }

    private fun take(c: Array<String>, side: Int) {
        c[5] = side.toString(); forts[side].hand.add(c[0]); draftTurn = 1 - side
        ev("audio", "pick")
    }

    private fun hob(side: Int) = forts[side].hobs.firstOrNull { it.id == selHob[side] && it.hp > 0 } ?: forts[side].hobs.firstOrNull { it.hp > 0 }

    override fun command(json: String): String {
        val o = try { JSONObject(json) } catch (e: Exception) { return no("bad_json") }
        val f = forts.getOrNull(active)
        when (o.optString("cmd")) {
            "new_battle" -> newBattle(o)
            "abandon" -> { phase = "none"; forts.clear() }
            "draft_pick" -> {
                if (phase != "pre") return no("not_in_draft")
                val c = pool.firstOrNull { it[0] == o.optString("id") && it[5] == "-1" } ?: return no("taken")
                val side = if (humans[1]) draftTurn else 0
                if (forts[side].hand.size >= 2) return no("hand_full")
                take(c, side)
                if (!humans[1] && forts[1].hand.size < 2) { val r = pool.filter { it[5] == "-1" }.maxByOrNull { it[2] }; if (r != null) take(r, 1) }
            }
            "quick_pick" -> { if (phase != "pre") return no("not_in_draft"); while (pool.any { it[5] == "-1" } && forts.any { it.hand.size < 2 }) quickPickOne() }
            "end_draft" -> { if (phase != "pre") return no("not_in_draft"); endDraft() }
            "pick_hob" -> {
                if (phase != "plan" || f == null) return no("not_your_turn")
                val hb = f.hobs.firstOrNull { it.id == o.optString("id") && it.hp > 0 } ?: return no("no_such_hob")
                selHob[active] = hb.id
            }
            "pick_shell" -> { if (phase != "plan") return no("not_your_turn"); selShot = o.optString("id", "plain") }
            "aim" -> {
                if (phase != "plan") return no("not_your_turn")
                val hb = hob(active) ?: return no("no_hob")
                hb.angle = o.optInt("angle", 450).coerceIn(0, 1800); hb.power = o.optInt("power", 50).coerceIn(0, 100); hb.aimSet = true
            }
            "recall" -> {
                if (phase != "plan") return no("not_your_turn")
                val hb = hob(active) ?: return no("no_hob")
                if (hb.lastA < 0) return no("no_ghost")
                hb.angle = hb.lastA; hb.power = hb.lastP; hb.aimSet = true
            }
            "walk" -> {
                if (phase != "plan" || f == null) return no("not_your_turn")
                val dx = o.optInt("dx").coerceIn(-4, 4)
                val cost = abs(dx)
                if (f.steam < cost || steamTurn + cost > 40) return no("out_of_steam")
                val nx = f.x + dx
                if (nx < 80 || nx > w - 80 || abs(nx - forts[1 - active].x) < 400 || abs(ground(nx - 60) - ground(nx + 60)) > 60) return no("blocked")
                f.x = nx; f.baseY = ground(nx); f.steam -= cost; steamTurn += cost
                ev("audio", "walk")
            }
            "fire" -> {
                if (phase != "plan" || f == null) return no("not_your_turn")
                val hb = hob(active) ?: return no("no_hob")
                if (!hb.aimSet) return no("no_aim")
                if (selShot == "knack") { if (f.knack <= 0) return no("no_uses"); f.knack-- } else if (selShot != "plain") { if (!f.hand.remove(selShot)) return no("no_uses") }
                hb.lastA = hb.angle; hb.lastP = hb.power
                val a = Math.toRadians(hb.angle / 10.0)
                val v = 2.2f + hb.power * 0.075f
                val look = when (selShot) { "plain", "knack" -> when (hb.cls) { "Lobber" -> "clodpot"; "Zinger" -> "hatpin"; "Scatterjack" -> "gravel"; "Delver" -> "nibbler"; "Boinker" -> "bouncebean"; else -> "mendglob" }; else -> selShot }
                shell = Sh(f.x + hb.rx, f.baseY + hb.ry + 14f, (cos(a) * v).toFloat(), (sin(a) * v).toFloat(), selShot, active, look = look)
                path = ArrayList()
                phase = "flight"; ev("audio", "fire", f.x)
            }
            "ready" -> { if (phase != "handoff") return no("not_handoff"); phase = "plan"; ev("audio", "turn"); ev("turn") }
            "speed" -> speed = o.optInt("x", 1).coerceIn(1, 2)
            else -> return no("unknown_cmd")
        }
        return """{"ok":true}"""
    }

    private fun no(r: String) = """{"ok":false,"reason":"$r"}"""

    override fun advance(ms: Int) {
        acc += ms.coerceIn(0, 100) * speed
        while (acc >= 1000f / 120f) { acc -= 1000f / 120f; step() }
    }

    private fun step() {
        tick++
        when (phase) {
            "flight" -> stepShell()
            "resolve" -> { timer -= 1f / 120f; if (timer <= 0) nextTurn() }
            "plan" -> if (!humans[active]) {
                timer += 1f / 120f
                if (timer > 1.2f) { timer = 0f; aiFire() }
            }
        }
    }

    private fun simulate(x0: Float, y0: Float, angle: Int, power: Int, maxTicks: Int, out: ArrayList<Float>?): Pair<Float, Float> {
        val a = Math.toRadians(angle / 10.0)
        val v = 2.2f + power * 0.075f
        var x = x0; var y = y0; var vx = (cos(a) * v).toFloat(); var vy = (sin(a) * v).toFloat()
        var t = 0
        while (t < maxTicks) {
            vy -= 0.045f; vx += wind * 0.0012f; x += vx; y += vy; t++
            if (out != null && t % 6 == 0) { out.add(x); out.add(y) }
            if (x < 0 || x > w || y < ground(x)) break
        }
        return x to y
    }

    private fun aiFire() {
        val f = forts[active]; val foe = forts[1 - active]
        val hb = hob(active) ?: return
        val x0 = f.x + hb.rx; val y0 = f.baseY + hb.ry + 14f
        var best = 1350 to 60; var bestD = Float.MAX_VALUE
        for (ang in 950..1700 step 50) for (p in 30..100 step 5) {
            val a = if (active == 1) ang else 1800 - ang
            val (ex, ey) = simulate(x0, y0, a, p, 2000, null)
            val d = hypot(ex - foe.x, ey - (foe.baseY + 24f))
            if (d < bestD) { bestD = d; best = a to p }
        }
        val err = when (preset) { "cozy" -> 9; "stubborn" -> 2; else -> 5 }
        hb.angle = (best.first + rng.nextInt(-err * 8, err * 8 + 1)).coerceIn(0, 1800)
        hb.power = (best.second + rng.nextInt(-err, err + 1)).coerceIn(5, 100)
        hb.aimSet = true; selShot = "plain"
        command(Cmd.FIRE)
    }

    private fun stepShell() {
        val s = shell ?: return
        s.age++; s.vy -= 0.045f; s.vx += wind * 0.0012f; s.x += s.vx; s.y += s.vy
        if (tick % 6 == 0L) { path.add(s.x); path.add(s.y) }
        var hit = s.x < 0 || s.x > w || s.y < ground(s.x)
        if (!hit) for (f in forts) {
            if (f.side == s.side && s.age < 60) continue
            if (f.blocks.any { b -> s.x >= f.x + b.rx && s.x <= f.x + b.rx + 16 && s.y >= f.baseY + b.ry && s.y <= f.baseY + b.ry + 16 }) hit = true
            if (hypot(s.x - f.x, s.y - (f.baseY + 32f)) < 9f) hit = true
        }
        if (hit) explode(s)
    }

    private fun explode(s: Sh) {
        val (r, dmg) = when (s.kind) { "plain" -> 20f to 34; "knack" -> 26f to 44; "old_turnip" -> 8f to 5; else -> 34f to 52 }
        var blocks = 0; var total = 0
        for (i in terrain.indices) {
            val cx = i * w / (terrain.size - 1)
            val d = abs(cx - s.x)
            if (d < r && s.y - terrain[i] < r) terrain[i] = min(terrain[i], max(20f, s.y - (r - d) * 0.6f))
        }
        for (f in forts) {
            val mult = if (f.side == s.side) 0.5f else 1f
            val it = f.blocks.iterator()
            while (it.hasNext()) {
                val b = it.next()
                val d = hypot(s.x - (f.x + b.rx + 8), s.y - (f.baseY + b.ry + 8))
                if (d < r + 8) { val dd = (dmg * mult * (1f - d / (r + 16))).toInt(); b.hp -= dd; total += dd; if (b.hp <= 0) { it.remove(); blocks++ } }
            }
            for (hb in f.hobs) if (hb.hp > 0) {
                val d = hypot(s.x - (f.x + hb.rx), s.y - (f.baseY + hb.ry + 14f))
                if (d < r) { val dd = (dmg * mult * (1f - d / (r + 10)) * 0.8f).toInt(); hb.hp = max(0, hb.hp - dd); total += dd; if (hb.hp == 0) ev("audio", "bonk", f.x) }
            }
            val kd = hypot(s.x - f.x, s.y - (f.baseY + 32f))
            if (kd < r + 6) { val dd = (dmg * mult * 1.6f * (1f - kd / (r + 14))).toInt(); f.kettle = max(0, f.kettle - dd); total += dd; ev("audio", "kettle", f.x) }
        }
        pins.add(P(s.x, s.y, s.side, round, path.toFloatArray()))
        while (pins.count { it.side == s.side } > 2) pins.remove(pins.first { it.side == s.side })
        ev("audio", if (blocks > 0) "break" else "thud", s.x)
        ev("blast", if (s.kind == "plain") "plain" else "big", s.x, s.y.toString())
        lastLine = if (total > 0) "${names[s.side]} hit: $blocks blocks, $total damage" else "${names[s.side]} missed"
        shell = null; phase = "resolve"; timer = 1.0f
    }

    private fun nextTurn() {
        val loser = forts.firstOrNull { it.kettle <= 0 || it.hobs.none { h -> h.hp > 0 } }
        if (loser != null) { finish(1 - loser.side, if (loser.kettle <= 0) "kettle_pop" else "clean_sweep"); return }
        if (active == 1) {
            round++
            if (round > roundCap) { for (f in forts) f.kettle = max(0, f.kettle - 40 * (round - roundCap)); ev("audio", "squall") }
            if ((round - 1) % 3 == 0) { wind = forecast; forecast = if (windMax == 0) 0 else rng.nextInt(-windMax, windMax + 1) }
            val l2 = forts.filter { it.kettle <= 0 }
            if (l2.isNotEmpty()) { finish(forts.maxByOrNull { it.kettle + it.hobs.sumOf { h -> h.hp } }!!.side, "squall"); return }
        }
        active = 1 - active; turnSeq++; steamTurn = 0; selShot = "plain"; timer = 0f
        if (hob(active)?.id != selHob[active]) selHob[active] = hob(active)?.id ?: ""
        if (mode == "duel" && seats == "side_by_side") { phase = "handoff"; handoffLine = lastLine } else { phase = "plan"; ev("audio", "turn"); ev("turn") }
    }

    private fun finish(winner: Int, reason: String) {
        phase = "ended"
        val goals = JSONArray()
        var p = 0; var btn = 0
        if (mode == "campaign") {
            val g = listOf("Win" to (winner == 0), "Lose no Hob" to (winner == 0 && forts[0].hobs.all { it.hp > 0 }), "Win by round ${roundCap - 3}" to (winner == 0 && round <= roundCap - 3))
            g.forEach { goals.put(JSONObject().put("label", it.first).put("done", it.second)) }
            p = g.count { it.second }; btn = if (winner == 0) 100 + p * 20 else 20
            val n = (level.substringAfter('-').toIntOrNull() ?: 1) - 1
            if (n in 0..9) pennants[n] = max(pennants[n], p)
            buttons += btn
        }
        result = JSONObject().put("winner", winner).put("reason", reason).put("pennants", p).put("buttons", btn).put("goals", goals)
        ev("audio", if (humans[winner]) "win" else "lose")
    }

    override fun snapshot(): String {
        val o = JSONObject()
        o.put("tick", tick).put("phase", phase).put("mode", mode).put("level", level)
        o.put("round", round).put("round_cap", roundCap)
        o.put("squall_in", if (round > roundCap) 0 else if (roundCap - round < 3) roundCap - round + 1 else -1)
        o.put("active_side", active).put("turn_seq", turnSeq).put("wind", wind).put("forecast", forecast).put("speed", speed)
        o.put("names", JSONArray(names)).put("humans", JSONArray(humans))
        o.put("world", JSONObject().put("w", w.toDouble()).put("h", h.toDouble()))
        if (forts.isNotEmpty()) {
            val t = JSONArray(); for (v in terrain) t.put(v.toDouble()); o.put("terrain", t)
            val fa = JSONArray()
            for (f in forts) {
                val ba = JSONArray()
                for (b in f.blocks) ba.put(JSONObject().put("x", (f.x + b.rx).toDouble()).put("y", (f.baseY + b.ry).toDouble()).put("w", 16).put("h", 16).put("mat", b.mat).put("hp", b.hp).put("hp_max", b.hpMax))
                val ha = JSONArray()
                for (hb in f.hobs) ha.put(JSONObject().put("id", hb.id).put("name", hb.name).put("class", hb.cls).put("hp", hb.hp).put("hp_max", 60).put("x", (f.x + hb.rx).toDouble()).put("y", (f.baseY + hb.ry).toDouble()).put("bonked", hb.hp <= 0).put("rest", 0))
                fa.put(JSONObject().put("side", f.side).put("x", f.x.toDouble()).put("kettle_x", f.x.toDouble()).put("kettle_y", (f.baseY + 32f).toDouble()).put("kettle_hp", f.kettle).put("kettle_max", 300).put("blocks", ba).put("hobs", ha))
            }
            o.put("forts", fa)
            val f = forts[active]; val hb = hob(active)
            o.put("selected_hob", hb?.id ?: "").put("selected_shot", selShot).put("steam", f.steam).put("steam_turn", steamTurn)
            val shots = JSONArray()
            shots.put(JSONObject().put("id", "plain").put("name", "Plain").put("kind", "plain").put("uses", -1).put("weight", 0))
            shots.put(JSONObject().put("id", "knack").put("name", "Knack").put("kind", "knack").put("uses", f.knack).put("weight", 0))
            for (id in f.hand) { val d = shellDefs.first { it[0] == id }; shots.put(JSONObject().put("id", id).put("name", d[1]).put("kind", "shell").put("uses", 1).put("weight", d[2].toInt()).put("best", d[4] == hb?.cls)) }
            o.put("shots", shots)
            if (hb != null) {
                o.put("aim", JSONObject().put("angle", if (hb.angle < 0) (if (active == 0) 450 else 1350) else hb.angle).put("power", hb.power).put("set", hb.aimSet))
                o.put("can_fire", phase == "plan" && hb.aimSet)
                if (phase == "plan" && hb.aimSet && humans[active]) {
                    val pts = ArrayList<Float>()
                    simulate(f.x + hb.rx, f.baseY + hb.ry + 14f, hb.angle, hb.power, 90, pts)
                    val pa = JSONArray(); for (v in pts) pa.put(v.toDouble()); o.put("preview", pa)
                }
            }
            val pa = JSONArray(); val ga = JSONArray()
            for (p in pins) {
                pa.put(JSONObject().put("x", p.x.toDouble()).put("y", p.y.toDouble()).put("side", p.side).put("round", p.round))
                if (p.side == active || !humans[p.side]) { val g = JSONArray(); for (v in p.path) g.put(v.toDouble()); ga.put(g) }
            }
            o.put("pins", pa).put("ghosts", ga)
            shell?.let { o.put("shells", JSONArray().put(JSONObject().put("x", it.x.toDouble()).put("y", it.y.toDouble()).put("kind", it.look))) }
            if (phase == "pre" && pool.isNotEmpty()) {
                val pl = JSONArray()
                for (c in pool) pl.put(JSONObject().put("id", c[0]).put("name", c[1]).put("weight", c[2].toInt()).put("hint", c[3]).put("best_with", c[4]).put("taken_by", c[5].toInt()))
                val wish = if (!humans[1]) pool.filter { it[5] == "-1" }.maxByOrNull { it[2] }?.get(0) ?: "" else ""
                o.put("draft", JSONObject().put("pool", pl).put("picks_each", 2).put("turn", draftTurn).put("wish", wish)
                    .put("hands", JSONArray().put(JSONArray(forts[0].hand)).put(JSONArray(forts[1].hand))))
            }
            if (phase == "handoff") o.put("handoff", JSONObject().put("line", handoffLine).put("to_side", active))
            result?.let { o.put("result", it) }
        }
        val e = JSONArray(); while (events.length() > 0) e.put(events.remove(0)); o.put("events", e)
        return o.toString()
    }

    override fun query(json: String): String {
        val o = try { JSONObject(json) } catch (e: Exception) { return "{}" }
        return when (o.optString("q")) {
            "campaign" -> {
                val a = JSONArray()
                var open = true
                for (i in 0 until 10) {
                    val st = if (pennants[i] > 0) "done" else if (open) "next" else "locked"
                    if (pennants[i] == 0) open = false
                    a.put(JSONObject().put("id", "1-${i + 1}").put("name", levelNames[i]).put("kind", if (i == 9) "grand_fort" else if (i == 6) "rescue" else "siege").put("state", st).put("pennants", pennants[i]))
                }
                JSONObject().put("region", "Puddingstone Downs").put("levels", a).put("pennants", pennants.sum()).put("pennants_max", 30).put("buttons", buttons).put("skirmish_open", true).toString()
            }
            "level" -> {
                val id = o.optString("id"); val n = (id.substringAfter('-').toIntOrNull() ?: 1).coerceIn(1, 10)
                val p = pennants[n - 1]
                JSONObject().put("id", id).put("name", levelNames[n - 1]).put("kind", if (n == 10) "Grand Fort" else if (n == 7) "Rescue" else "Siege")
                    .put("round_cap", min(15, 6 + n * 2)).put("wind", if (n < 4) "No wind" else "Wind 0 to 2").put("rival", rivals[n - 1]).put("rival_aim", min(5, 1 + n / 3))
                    .put("habit", if (n >= 6) "Grabs the biggest shell in the Rummage." else "")
                    .put("rival_crew", JSONArray(roster.drop(4).take(min(4, max(1, (n + 1) / 2))).map { it.second }))
                    .put("goals", JSONArray().put(JSONObject().put("label", "Win").put("done", p >= 1)).put(JSONObject().put("label", "Lose no Hob").put("done", p >= 2)).put(JSONObject().put("label", "Win early").put("done", p >= 3))).toString()
            }
            else -> "{}"
        }
    }

    // Save: progress plus the battle in play. The stand-in keeps it simple and human readable.
    override fun save(): String {
        val o = JSONObject().put("v", 1).put("buttons", buttons).put("pennants", JSONArray(pennants.toList()))
        if (forts.isNotEmpty() && phase != "none" && phase != "ended" && phase != "pre") {
            val b = JSONObject().put("mode", mode).put("level", level).put("preset", preset).put("seats", seats).put("names", JSONArray(names)).put("humans", JSONArray(humans))
                .put("round", round).put("round_cap", roundCap).put("active", active).put("turn_seq", turnSeq).put("wind", wind).put("forecast", forecast).put("wind_max", windMax)
                .put("phase", if (phase == "handoff") "handoff" else "plan").put("line", handoffLine)
                .put("terrain", JSONArray(terrain.map { it.toDouble() })).put("sel", JSONArray(selHob.toList()))
            val fa = JSONArray()
            for (f in forts) fa.put(JSONObject().put("x", f.x.toDouble()).put("base", f.baseY.toDouble()).put("kettle", f.kettle).put("steam", f.steam).put("knack", f.knack).put("hand", JSONArray(f.hand))
                .put("blocks", JSONArray(f.blocks.map { JSONObject().put("x", it.rx.toDouble()).put("y", it.ry.toDouble()).put("m", it.mat).put("hp", it.hp).put("max", it.hpMax) }))
                .put("hobs", JSONArray(f.hobs.map { JSONObject().put("id", it.id).put("n", it.name).put("c", it.cls).put("hp", it.hp).put("x", it.rx.toDouble()).put("y", it.ry.toDouble()).put("a", it.angle).put("p", it.power).put("s", it.aimSet) })))
            b.put("forts", fa)
            o.put("battle", b)
        }
        return o.toString()
    }

    override fun load(data: String): Boolean = try {
        val o = JSONObject(data)
        buttons = o.optInt("buttons")
        o.optJSONArray("pennants")?.let { for (i in 0 until min(10, it.length())) pennants[i] = it.optInt(i) }
        val b = o.optJSONObject("battle")
        if (b != null) {
            mode = b.optString("mode"); level = b.optString("level"); preset = b.optString("preset"); seats = b.optString("seats")
            names = b.getJSONArray("names").let { listOf(it.getString(0), it.getString(1)) }
            humans = b.getJSONArray("humans").let { listOf(it.getBoolean(0), it.getBoolean(1)) }
            round = b.optInt("round"); roundCap = b.optInt("round_cap"); active = b.optInt("active"); turnSeq = b.optInt("turn_seq")
            wind = b.optInt("wind"); forecast = b.optInt("forecast"); windMax = b.optInt("wind_max"); handoffLine = b.optString("line")
            val t = b.getJSONArray("terrain"); terrain = FloatArray(t.length()) { t.getDouble(it).toFloat() }
            val s = b.getJSONArray("sel"); selHob = arrayOf(s.getString(0), s.getString(1))
            val fa = b.getJSONArray("forts")
            forts = (0 until fa.length()).map { i ->
                val f = fa.getJSONObject(i)
                val ba = f.getJSONArray("blocks"); val ha = f.getJSONArray("hobs"); val hd = f.getJSONArray("hand")
                F(i, f.getDouble("x").toFloat(), f.getDouble("base").toFloat(), f.getInt("kettle"),
                    (0 until ba.length()).map { ba.getJSONObject(it) }.map { B(it.getDouble("x").toFloat(), it.getDouble("y").toFloat(), it.getString("m"), it.getInt("hp"), it.getInt("max")) }.toMutableList(),
                    (0 until ha.length()).map { ha.getJSONObject(it) }.map { H(it.getString("id"), it.getString("n"), it.getString("c"), it.getInt("hp"), it.getDouble("x").toFloat(), it.getDouble("y").toFloat(), it.getInt("a"), it.getInt("p"), it.getBoolean("s")) }.toMutableList(),
                    f.getInt("steam"), (0 until hd.length()).map { hd.getString(it) }.toMutableList(), f.getInt("knack"))
            }.toMutableList()
            pins.clear(); shell = null; result = null; steamTurn = 0; selShot = "plain"; pool.clear(); timer = 0f
            phase = b.optString("phase", "plan")
        }
        true
    } catch (e: Exception) { false }

    override fun close() {}
}

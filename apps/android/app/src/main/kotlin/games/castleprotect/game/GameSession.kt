package games.castleprotect.game

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import games.castleprotect.battle.Anims
import games.castleprotect.core.Awaiting
import games.castleprotect.core.BattleResult
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Cmd
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.Core
import games.castleprotect.core.CoreException
import games.castleprotect.core.CoreFactory
import games.castleprotect.core.CoreFault
import games.castleprotect.core.Draft
import games.castleprotect.core.Frame
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.LevelInfo
import games.castleprotect.core.LiveBattle
import games.castleprotect.core.NativeCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Progress
import games.castleprotect.core.Reply
import games.castleprotect.core.SideOpts
import games.castleprotect.core.SnapshotParser
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.pow

enum class Screen { TITLE, MAP, PRE_BATTLE, BATTLE, RESULTS, SKIRMISH, DUEL_SETUP, SETTINGS }

/** What the Compose HUD reads. Built from full snapshots only, so lean frames do not recompose. */
data class BattleUi(
    val live: Boolean = false,
    val phase: Phase = Phase.NONE,
    val side: Int = 0,
    val awaiting: Awaiting = Awaiting.NONE,
    val level: String = "",
    val mode: String = "",
    val hud: Hud = Hud(),
    val hobs: List<Hob> = emptyList(),
    val draft: Draft? = null,
    val result: BattleResult? = null,
    /** Index for the recall command (among the active side's ghosts), or -1. */
    val recallIndex: Int = -1,
) {
    val humanTurn: Boolean get() = phase == Phase.PLAN && awaiting == Awaiting.HUMAN
    val flying: Boolean get() = phase == Phase.RESOLVE || phase == Phase.SETTLE
    val selected: Hob? get() = hobs.firstOrNull { it.id == hud.selectedHob && it.side == side }
    fun hobsOf(s: Int) = hobs.filter { it.side == s }
    /** The side the close-up belongs to: the human whose turn it is, else the first human side. */
    val viewer: Int get() = if (hud.human(side)) side else if (hud.human(0)) 0 else if (hud.human(1)) 1 else 0

    companion object {
        fun of(f: Frame): BattleUi {
            var recall = -1
            var k = 0
            for (g in f.ghosts) if (g.side == f.side) { if (g.hob == f.hud.selectedHob && !g.recalled) recall = k; k++ }
            return BattleUi(true, f.phase, f.side, f.awaiting, f.level, f.mode, f.hud, f.hobs, f.draft, f.result, recall)
        }
    }
}

/** A question the player must answer before something is lost. */
class Confirm(val title: String, val text: String, val yes: String, val action: () -> Unit)

/**
 * Owns the core, the sim thread, saves and sound. It lives in a ViewModel, so a
 * turn of the device never touches it.
 *
 * Threads: every core call runs on the one sim thread ("castle-sim"). The UI posts
 * jobs to it and never waits on it, except in [onStop], which waits up to 2 s for the
 * final save. The sim thread publishes frames ([frame] for the renderer, [ui] for the
 * HUD) and posts Compose state changes to the main thread.
 */
class GameSession(app: Application) : AndroidViewModel(app) {
    val settings = Settings(app)
    val audio = Audio(app, settings)
    /** Hit stop, slow motion and shake (view only). */
    val juice = Juice({ settings.reduceMotion }, { settings.shakeScale })
    /** assets/animations.json, loaded on the sim thread at start. */
    @Volatile var anims: Anims = Anims.EMPTY
        private set
    /** Shared sprite cache for the field renderer and the HUD. Indexes itself off the main thread. */
    val sprites = games.castleprotect.battle.Sprites(app.assets)
    private val main = Handler(Looper.getMainLooper())
    private val vibrator = app.getSystemService(Vibrator::class.java)

    private val factory: CoreFactory? = try { Core.factory(app) } catch (e: Throwable) { Log.e(TAG, "core", e); null }
    val coreName: String get() = factory?.name ?: "no core"
    /** Set when this build has no game engine at all (a release without the native library). */
    val coreMissing: Boolean get() = factory == null

    private val store = SaveStore(File(app.filesDir, "save"), if (factory?.standIn == true) "castle-standin.sav" else "castle.sav")

    // ---- state published to the UI (main thread) ------------------------------

    @Volatile var frame: Frame = Frame.EMPTY
        private set
    private val _ui = MutableStateFlow(BattleUi())
    val ui: StateFlow<BattleUi> = _ui
    /** Frames with events, waiting for the field's effects (FieldFx). Cleared when a battle starts. */
    val fxFrames = ConcurrentLinkedQueue<Frame>()
    /** A Hob-speak subtitle line and when it hides (uptime ms). */
    var subtitle by mutableStateOf<Pair<String, Long>?>(null)
        private set
    private val _announce = MutableSharedFlow<String>(extraBufferCapacity = 8)
    /** Short texts for TalkBack: turn starts, shot results, the winner. */
    val announcements: SharedFlow<String> = _announce

    private val screenState = mutableStateOf(Screen.TITLE)
    /** The sim only steps a battle that is on screen, so nothing plays out behind the map. */
    @Volatile private var battleOnScreen = false
    var screen: Screen
        get() = screenState.value
        private set(v) {
            val was = screenState.value
            screenState.value = v; battleOnScreen = v == Screen.BATTLE; jobs.offer {}
            if (was != v) music(v)
        }
    private val back = ArrayDeque<Screen>()
    private val pausedState = mutableStateOf(false)
    @Volatile private var pausedFlag = false
    var paused: Boolean
        get() = pausedState.value
        set(v) { pausedState.value = v; pausedFlag = v; jobs.offer {} } // wake the sim at once
    /** A battle is in play (live in the core, or saved and ready to replay). */
    var canResume by mutableStateOf(false)
        private set
    var content by mutableStateOf(ContentInfo.EMPTY)
        private set
    var progress by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    /** Buttons earned so far (from the core's result.buttons). */
    var buttons by mutableIntStateOf(0)
        private set
    /** A note for the title screen, for example when a save could not be read. */
    var notice by mutableStateOf<String?>(null)
    var confirm by mutableStateOf<Confirm?>(null)
    /** The battle Pre-battle will start. */
    var preSpec by mutableStateOf<BattleSpec?>(null)
        private set
    /** Couch Duel, side by side: the side to hand the device to, or -1. */
    var handoffTo by mutableIntStateOf(-1)
        private set
    var handoffLine by mutableStateOf("")
        private set
    /** True while a battle is being built or replayed. */
    var loading by mutableStateOf(false)
        private set
    var lastSpec by mutableStateOf<BattleSpec?>(null)
        private set
    /** Double speed during flights, toggled by the player. */
    @Volatile var fast = false
    var fastState by mutableStateOf(false)
        private set
    @Volatile private var foreground = false

    // ---- sim thread state (touch only from the sim thread) ---------------------

    private val jobs = LinkedBlockingQueue<() -> Unit>()
    @Volatile private var running = true
    private var game: LiveBattle? = null
    private var gameSpec: BattleSpec? = null
    private var parser = SnapshotParser()
    private var save = SaveData()
    private var dirty = false
    private var lastStepAt = 0L
    private var tickAcc = 0f
    private var aiAt = 0L
    private var lastTurn = -1
    private var lastResult: BattleResult? = null
    private var shotBreaks = 0
    private var shotHits = 0
    private var shotFired = false
    private var shotDmg = 0
    private var lastSummary = ""
    private var hobsAtStart = listOf(0, 0)
    private var whistleAt = 0L
    private var windOn = -1
    private var squallOn = -1
    private var whistleSemis = Float.NaN
    private val sim = Thread({ loop() }, "castle-sim").also { it.priority = Thread.NORM_PRIORITY + 1; it.start() }

    init {
        post {
            anims = try { Anims.parse(app.assets.open("animations.json").bufferedReader().use { it.readText() }) } catch (e: Exception) { Anims.EMPTY }
            val c = ContentInfo.fromAssets(app.assets)
            val loaded = store.load()
            var msg: String? = null
            when (loaded) {
                is SaveStore.Loaded.Ok -> { save = loaded.data; if (loaded.fromBackup) msg = "Your last save could not be read, so the one before it was loaded." }
                is SaveStore.Loaded.Unreadable -> { msg = "Your save could not be read. It was kept aside (${loaded.movedTo.joinToString { it.name }}) and a fresh one started."; Log.w(TAG, "save unreadable: ${loaded.why}") }
                SaveStore.Loaded.Missing -> {}
            }
            val s = save
            if (audio.unlocked) audio.menuMusic()
            ui {
                content = c; progress = s.pennants; buttons = s.buttons; canResume = s.battle != null; notice = msg
                lastSpec = s.last?.let { BattleSpec(it.setup, it.seed, it.kind, it.level, it.seats) }
            }
        }
    }

    // ---- lifecycle -------------------------------------------------------

    fun onStart() { foreground = true; lastStepAt = 0L; audio.onStart(); post { resetLoops(); dirty = game != null } }

    /** The process may die any time after this returns, so the final save is written here, synchronously. */
    fun onStop() {
        foreground = false
        audio.onStop()
        if (screen == Screen.BATTLE && handoffTo < 0) paused = true
        val done = CountDownLatch(1)
        post { try { saveNow() } finally { done.countDown() } }
        try { done.await(2, TimeUnit.SECONDS) } catch (e: InterruptedException) { }
    }

    override fun onCleared() {
        val done = CountDownLatch(1)
        post { try { saveNow(); closeGame() } finally { done.countDown() } }
        try { done.await(3, TimeUnit.SECONDS) } catch (e: InterruptedException) { }
        running = false
        sim.interrupt()
        try { sim.join() } catch (e: InterruptedException) { }
        audio.release()
    }

    fun onTrimMemory(level: Int) { sprites.trim(level) }

    // ---- the sim thread --------------------------------------------------

    private fun post(job: () -> Unit) { jobs.offer(job) }
    private fun ui(fn: () -> Unit) { main.post(fn) }

    private fun loop() {
        while (running) {
            val f = frame
            val busy = game != null && foreground && !pausedFlag && battleOnScreen &&
                (f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE || (f.phase == Phase.PLAN && f.awaiting == Awaiting.AI))
            val job = try { jobs.poll(if (busy) FRAME_MS else 1000L, TimeUnit.MILLISECONDS) } catch (e: InterruptedException) { if (!running) return else null }
            try {
                job?.invoke()
                while (true) { val more = jobs.poll() ?: break; more() }
                tickGame()
                if (dirty) publish()
            } catch (e: Throwable) {
                // One bad step must not take the app down. Keep the last good frame.
                Log.e(TAG, "sim", e)
                dirty = false
            }
        }
    }

    private fun tickGame() {
        val g = game ?: return
        val f = frame
        val now = SystemClock.uptimeMillis()
        if (!foreground || pausedFlag || !battleOnScreen) { lastStepAt = 0L; aiAt = 0L; return }
        if (f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE) {
            if (lastStepAt == 0L) lastStepAt = now
            val speed = if (fast || (settings.rival2x && !f.hud.human(f.side))) 2 else 1
            // Hit stop and slow motion change how fast the fixed step sim is fed, never its rules.
            val view = juice.scale(now)
            audio.slowMo = view in 0.01f..0.99f
            tickAcc += (now - lastStepAt).coerceIn(0L, 100L) * 120f / 1000f * speed * view
            lastStepAt = now
            val ticks = tickAcc.toInt()
            if (ticks > 0) { tickAcc -= ticks; g.step(ticks); dirty = true; checkRebuilt() }
        } else {
            lastStepAt = 0L; tickAcc = 0f
        }
        if (f.phase == Phase.PLAN && f.awaiting == Awaiting.AI) {
            // The think pose: a short wait, then the AI plays this side's turn.
            if (aiAt == 0L) aiAt = now + AI_THINK_MS
            else if (now >= aiAt) { aiAt = 0L; g.command(Cmd.AI_TURN); dirty = true; checkRebuilt() }
        } else aiAt = 0L
    }

    /** True after a dead handle was rebuilt: the next snapshot is history, not news. */
    private var quietNext = false

    private fun checkRebuilt() {
        val g = game ?: return
        if (g.takeRebuilt()) {
            quietNext = true
            Log.w(TAG, "core handle rebuilt from the log (${g.recoveries})")
        }
        g.broken?.let { why -> battleBroken(why) }
    }

    private fun publish() {
        val g = game ?: return
        dirty = false
        val f = try {
            parser.parse(g.snapshot(), keepEvents = !quietNext)
        } catch (e: CoreFault) {
            // A panic or a dead handle: rebuild with cp_new and resume, then show the rebuilt battle.
            Log.e(TAG, "core fault ${e.reason}", e)
            if (e.dead && g.recover(e.reason)) { quietNext = true; dirty = true } else battleBroken(e.reason)
            return
        } catch (e: RuntimeException) { Log.e(TAG, "bad snapshot", e); return }
        if (quietNext) { quietNext = false; g.takeRebuilt() }
        frame = f
        react(f)
        if (f.events.isNotEmpty()) { fxFrames.add(f); while (fxFrames.size > 32) fxFrames.poll() }
        _ui.value = BattleUi.of(f)
    }

    /** The core failed on this battle again and again: it is set aside, and the player is told. */
    private fun battleBroken(why: String) {
        closeGame()
        save = save.copy(battle = null)
        store.write(save)
        ui {
            notice = "The battle hit a problem the game could not recover from ($why). It was set aside."
            canResume = false; paused = false; screen = Screen.TITLE; back.clear()
        }
    }

    private fun pan(f: Frame, x: Int): Float = if (f.mapW > 0) (x.toFloat() / f.mapW) * 2f - 1f else 0f

    private fun blockMat(f: Frame, side: Int, c: Int, r: Int): String? {
        val k = frame.castles.getOrNull(side) ?: f.castles.getOrNull(side) ?: return null
        for (b in k.blocks) if (b.c == c && b.r == r) return b.mat
        return null
    }

    private fun hobOf(f: Frame, id: Int): Hob? = f.hobs.firstOrNull { it.id == id }

    private fun react(f: Frame) {
        val now = SystemClock.uptimeMillis()
        val ending = f.events.any { it.t == "win" }
        var breaks = 0
        val m = audio.manifest
        for (e in f.events) {
            val pan = pan(f, e.x)
            for (id in Cues.forEvent(e, m) { s, c, r -> blockMat(f, s, c, r) }) audio.play(id, pan)
            when (e.t) {
                "fire" -> {
                    shotFired = true; shotBreaks = 0; shotHits = 0; shotDmg = 0
                    juice.newShot()
                    hobOf(f, e.hob)?.let { h -> audio.bark(h.def, "fire", h.side, f.hud.turn, pan(f, h.x), ::say2) }
                }
                "explode" -> {
                    val (t, d) = Juice.blastTrauma(Juice.band(e.r))
                    juice.addTrauma(t, d)
                    buzz(if (e.r > 28) 40 else 20)
                }
                "break" -> { shotBreaks++; breaks++ }
                "hit" -> {
                    shotHits++; shotDmg += e.dmg
                    if (e.target == "hob") {
                        // Hit stop by damage band (07 section 6.1); first hit only (the 250 ms rule).
                        val ms = when { e.dmg < 30 -> 0; e.dmg < 60 -> 30; e.dmg < 100 -> 50; else -> 80 }
                        if (ms > 0) juice.hitStop(ms, now, fast)
                        hobOf(f, e.hob)?.let { h ->
                            audio.bark(h.def, "takes_hit", h.side, f.hud.turn, pan(f, h.x), ::say2)
                            if (f.hud.human(h.side) && !f.hud.human(1 - h.side)) pattern(25, 60, 15)
                        }
                    }
                    if (e.target == "kettle") buzz(25)
                }
                "kettle_pop" -> {
                    juice.hitStop(80, now, fast)
                    juice.slowMo(0.25f, 1200, now, endsBattle = ending)
                    juice.addTrauma(1f, 600)
                    pattern(30, 50, 40, 50, 80)
                }
                "bonk" -> {
                    juice.hitStop(80, now, fast)
                    val h = hobOf(f, e.hob)
                    val side = h?.side ?: e.side
                    val left = f.hobs.count { it.side == side && !it.bonked }
                    when {
                        left == 0 && ending -> juice.slowMo(0.3f, 1000, now, endsBattle = true)
                        left == 0 -> juice.slowMo(0.5f, 600, now)
                        else -> juice.slowMo(0.5f, 400, now)
                    }
                    if (h != null) audio.bark(h.def, "bonked", h.side, f.hud.turn, pan(f, h.x), ::say2)
                    pattern(10, 40, 10, 40, 30)
                }
                "thump", "castle_drop" -> { juice.hitStop(50, now, fast); juice.addTrauma(0.5f, 300, upDown = true); buzz(50) }
                "threaded" -> { juice.slowMo(0.4f, 400, now); pattern(8, 60, 8) }
                "walk" -> buzz(10)
                "squall_round" -> say("Sudden Squall! Round ${e.n}.")
                "boss_phase" -> say("The Grand Fort wakes up: phase ${e.phase}.")
                "relight" -> say("A kettle relights.")
                "miss" -> if (shotFired) say("Missed. The shell left the field.")
                "turn_start" -> {
                    if (shotFired) {
                        val who = f.hud.names.getOrElse(if (e.side >= 0) 1 - e.side else 0) { "" }
                        lastSummary = if (shotHits == 0) "$who: no hits." else "$who hit: ${plural(shotBreaks, "block")}, $shotDmg damage."
                        say(lastSummary)
                        shotFired = false
                    }
                    juice.newTurn()
                    audio.play("turn_yours", semis = if (e.side == 1) -2f else 0f)
                    val name = f.hud.names.getOrElse(e.side) { "" }
                    say(if (f.hud.human(e.side) && !(f.hud.human(0) && f.hud.human(1))) "Your turn" else "$name's turn")
                }
                "win" -> {
                    val human = f.hud.human(e.winner)
                    val duel = f.hud.human(0) && f.hud.human(1)
                    audio.stopLoops()
                    audio.sting(human || duel)
                    f.hobs.firstOrNull { it.side == e.winner && !it.bonked }?.let { h -> audio.bark(h.def, "win", h.side, f.hud.turn, pan(f, h.x), ::say2) }
                    say("${f.hud.names.getOrElse(e.winner) { "" }} wins")
                    if (human) pattern(30, 50, 40, 50, 80)
                }
            }
        }
        if (breaks >= 3) juice.hitStop(50, now, fast)
        if (f.fullSeq == 1 || hobsAtStart.sum() == 0) hobsAtStart = listOf(f.hobs.count { it.side == 0 }, f.hobs.count { it.side == 1 })
        loops(f, now)
        // Couch Duel side by side: a new turn for the other player brings up the hand-off card.
        val spec = gameSpec
        if (f.hud.turn != lastTurn) {
            val first = lastTurn < 0
            lastTurn = f.hud.turn
            if (!first && f.phase == Phase.PLAN) {
                if (spec?.seats == "side_by_side" && f.hud.human(0) && f.hud.human(1)) {
                    val to = f.side
                    val line = lastSummary
                    ui { handoffTo = to; handoffLine = line; audio.play("ui_handoff_flip") }
                }
                saveNow() // autosave at every turn start
            }
        }
        if (f.result != null && lastResult == null) {
            lastResult = f.result
            onBattleEnded(f)
        }
    }

    /** Music layers, the wind bed, the Squall, the flight whistle and the kettle whistle. */
    private fun loops(f: Frame, now: Long) {
        if (f.phase == Phase.ENDED || !battleOnScreen) { if (windOn != -1) { audio.stopLoops(); windOn = -1; squallOn = -1; whistleSemis = Float.NaN }; return }
        val up = listOf(f.hobs.count { it.side == 0 && !it.bonked }, f.hobs.count { it.side == 1 && !it.bonked })
        val (stir, peril) = Cues.layers(f.hud.kettlePct, up, hobsAtStart, f.hud.squallWarning, f.hud.squallRound)
        audio.setLayers(stir, peril)
        val wind = abs(f.hud.wind)
        if (wind != windOn) { windOn = wind; audio.loop("wx_wind_loop", wind > 0, gain = wind / 10f) }
        val sq = f.hud.squallRound
        if (sq != squallOn) { squallOn = sq; audio.loop("wx_squall_loop", sq > 0, gain = 10f.pow(3f * (sq - 1) / 20f)) }
        // Arc shells whistle, pitch -7 to +7 semitones with height.
        val sh = f.shells.firstOrNull()
        if (sh != null && f.mapH > 0) {
            val semis = (((f.mapH - sh.y).toFloat() / f.mapH) * 14f - 7f).coerceIn(-7f, 7f)
            if (whistleSemis.isNaN() || abs(semis - whistleSemis) > 0.5f) { whistleSemis = semis; audio.loop("fly_whistle_loop", true, semis = semis) }
        } else if (!whistleSemis.isNaN()) { whistleSemis = Float.NaN; audio.loop("fly_whistle_loop", false) }
        // A Heartkettle at 50% or less whistles every few seconds, higher as HP falls.
        val low = f.hud.kettlePct.filter { it in 1..50 }.minOrNull()
        val k = audio.manifest["ket_whistle_loop"]
        if (low != null && k != null && now - whistleAt > ((k.durationS + k.repeatGapS) * 1000).toLong()) {
            whistleAt = now
            audio.play("ket_whistle_loop", semis = 3f * (50 - low) / 50f)
        }
    }

    /** An animation frame's sound, from the field (render thread). [x] is a world x. */
    fun animCue(anim: String, event: String, x: Float, shot: String?) {
        val id = Cues.forAnim(anim, event, audio.manifest, shot) ?: return
        // Material hits already sound from the core event.
        if (anim.startsWith("fx_impact_")) return
        val f = frame
        val pan = if (f.mapW > 0) (x / f.mapW) * 2f - 1f else 0f
        audio.play(id, pan)
    }

    /** A view beat from the field: a collapse lands (07 sections 6.1, 6.2, 6.4). */
    fun viewBeat(kind: String, n: Int, x: Float, y: Float) {
        if (kind != "collapse_land") return
        val now = SystemClock.uptimeMillis()
        juice.addTrauma(minOf(0.4f, 0.05f * n), 250)
        if (n >= 3) juice.hitStop(50, now, fast)
        if (n >= 6) juice.slowMo(0.5f, 600, now)
        buzz(12)
    }

    private fun say2(line: String) {
        if (!settings.subtitles) return
        val until = SystemClock.uptimeMillis() + maxOf(2000L, 1500L + 60L * line.length)
        ui { subtitle = line to until }
    }

    private fun plural(n: Int, w: String) = if (n == 1) "1 $w" else "$n ${w}s"
    private fun say(s: String) { _announce.tryEmit(s) }

    private fun onBattleEnded(f: Frame) {
        val r = f.result ?: return
        val spec = gameSpec
        if (spec?.kind == "campaign") {
            var bits = 0
            r.pennants.forEachIndexed { i, b -> if (b) bits = bits or (1 shl i) }
            val old = save.pennants[spec.level] ?: 0
            save = save.copy(pennants = save.pennants + (spec.level to (old or bits)))
        }
        // Buttons come from the core (result.buttons, design 5.2), never worked out here.
        save = save.copy(battle = null, buttons = save.buttons + r.buttons)
        store.write(save)
        val p = save.pennants
        val b = save.buttons
        ui { progress = p; buttons = b; canResume = false }
    }

    /** Sim thread: writes the save now (progress and, when one is in play, the battle). */
    private fun saveNow() {
        val g = game
        val spec = gameSpec
        if (g != null && spec != null && frame.phase != Phase.ENDED && frame.phase != Phase.NONE) {
            val b = SavedBattle(spec.setup, spec.seed, spec.kind, spec.level, spec.seats, g.freshLog(), coreVersion())
            save = save.copy(battle = b, last = b.copy(log = "[]"))
        }
        if (!store.write(save)) Log.w(TAG, "save not written")
    }

    private fun coreVersion(): String = if (factory?.standIn == false) runCatching { NativeCore.version() }.getOrDefault("") else "fixture"

    private fun closeGame() {
        game?.close()
        game = null
        gameSpec = null
        parser = SnapshotParser()
        frame = Frame.EMPTY
        lastTurn = -1; lastResult = null; aiAt = 0L; shotFired = false; quietNext = false
        hobsAtStart = listOf(0, 0); windOn = -1; squallOn = -1; whistleSemis = Float.NaN
        fxFrames.clear()
        audio.stopLoops()
        _ui.value = BattleUi()
    }

    /** Sim thread: starts a battle from a spec. Returns an error text, or null. */
    private fun startGame(spec: BattleSpec): String? {
        val fac = factory ?: return "This build has no game engine."
        closeGame()
        val g = try { LiveBattle.open(fac, spec.setup, spec.seed) } catch (e: CoreException) { return "The battle could not start: ${e.message}" }
        game = g; gameSpec = spec
        dirty = true
        publish()
        val b = SavedBattle(spec.setup, spec.seed, spec.kind, spec.level, spec.seats, "[]", coreVersion())
        save = save.copy(battle = b, last = b)
        store.write(save)
        return null
    }

    /** Sim thread: rebuilds a saved battle from the core's own log with `resume`. */
    private fun replay(b: SavedBattle): String? {
        val fac = factory ?: return "This build has no game engine."
        closeGame()
        // A save from another rules version can not replay (core/API.md, v0.2 change 1).
        val rules = Regex("\"rules\"\\s*:\\s*(\\d+)")
        val then = rules.find(b.core)?.groupValues?.get(1)
        val nowRules = if (fac.standIn) then else rules.find(coreVersion())?.groupValues?.get(1)
        if (then != null && nowRules != null && then != nowRules) return "The saved battle is from an older version of the rules. It was set aside."
        val g = try { LiveBattle.open(fac, b.setup, b.seed, b.log) } catch (e: Exception) {
            return "The saved battle does not fit this version of the game (${e.message}). It was set aside."
        }
        game = g
        gameSpec = BattleSpec(b.setup, b.seed, b.kind, b.level, b.seats)
        // The replay's events are history: drop them, keep the state and the whole map.
        frame = try { parser.parse(g.snapshot(), keepEvents = false) } catch (e: RuntimeException) {
            closeGame(); return "The saved battle could not be shown (${e.message}). It was set aside."
        }
        lastTurn = frame.hud.turn
        lastResult = frame.result
        hobsAtStart = listOf(frame.hobs.count { it.side == 0 }, frame.hobs.count { it.side == 1 })
        _ui.value = BattleUi.of(frame)
        return null
    }

    /** Short haptic pulses with gaps: on, off, on, ... in ms (07 section 6.5). */
    fun pattern(vararg ms: Long) {
        if (settings.haptics < 2 || vibrator == null) { if (settings.haptics == 1) buzz(ms.firstOrNull() ?: 20); return }
        val timings = LongArray(ms.size + 1); val amps = IntArray(ms.size + 1)
        for (i in ms.indices) { timings[i + 1] = ms[i]; amps[i + 1] = if (i % 2 == 0) 180 else 0 }
        try { vibrator.vibrate(VibrationEffect.createWaveform(timings, amps, -1)) } catch (e: Exception) { }
    }

    fun buzz(ms: Long) {
        if (settings.haptics == 0 || vibrator == null) return
        val amp = if (settings.haptics == 1) 60 else 160
        try { vibrator.vibrate(VibrationEffect.createOneShot(ms, amp)) } catch (e: Exception) { }
    }

    // ---- core access from the UI -------------------------------------------

    /**
     * Sends a command for the battle on screen. Refused while paused or while the
     * hand-off card is up, so nothing acts behind a card. [onReply] runs on the main thread.
     */
    fun send(cmd: String, onReply: ((Reply) -> Unit)? = null): Boolean {
        if (paused || handoffTo >= 0) return false
        post {
            val g = game ?: return@post
            val r = Reply.parse(g.command(cmd))
            dirty = true
            checkRebuilt()
            if (onReply != null) ui { onReply(r) }
        }
        return true
    }

    /** Fire: the button press sound and tap, then the Action. */
    fun fire(onReply: ((Reply) -> Unit)? = null) {
        if (send(Cmd.FIRE) { r -> if (!r.ok) audio.play("ui_denied"); onReply?.invoke(r) }) { audio.play("ui_fire_press"); buzz(15) }
    }

    /** Picks a Hob; your Hob may say something. */
    fun pickHob(h: Hob) {
        send(Cmd.pickHob(h.id))
        audio.play("turn_hob_pick")
        val f = frame
        audio.bark(h.def, "picked", h.side, f.hud.turn, pan(f, h.x), ::say2)
    }

    /** Give up (07 section 4.9): the core ends the battle (`how: "give_up"`) and pays the loss reward. */
    fun giveUp() {
        paused = false
        handoffTo = -1
        post { game?.command(Cmd.giveUp()); dirty = true; checkRebuilt() }
    }

    private var lastAimKey = ""
    private var lastAimA = 0
    private var lastAimP = 0

    /** Aim the selected Hob. Keeps what was sent, so fast Fine Tune steps build on each other (review M9). */
    fun aim(angle: Int, power: Int) {
        val u = _ui.value
        lastAimKey = "${u.hud.turn}:${u.hud.selectedHob}"; lastAimA = angle; lastAimP = power
        send(Cmd.aim(angle, power))
    }

    /** The aim to step from: the last one sent this turn for this Hob, else the core's. */
    fun aimBase(u: BattleUi): Pair<Int, Int> {
        val h = u.selected ?: return 450 to 50
        return if (lastAimKey == "${u.hud.turn}:${u.hud.selectedHob}") lastAimA to lastAimP else h.angle to h.power
    }

    fun toggleFast() { fast = !fast; fastState = fast; if (fast) juice.cancelSlow() }

    // ---- navigation ------------------------------------------------------

    fun go(to: Screen, remember: Boolean = true) {
        if (remember && screen != to) back.addLast(screen)
        screen = to
    }

    /** Returns false when there is nowhere to go back to (the activity may finish). */
    fun goBack(): Boolean {
        when (screen) {
            Screen.BATTLE -> { if (handoffTo < 0) paused = !paused; return true }
            Screen.PRE_BATTLE -> {
                // A Rummage opened here but never fought is dropped; the player already agreed to replace the old battle.
                if (_ui.value.live && _ui.value.phase == Phase.DRAFT) post { closeGame(); save = save.copy(battle = null); store.write(save); ui { canResume = false } }
            }
            Screen.RESULTS -> { screen = Screen.MAP; back.clear(); back.addLast(Screen.TITLE); return true }
            Screen.TITLE -> return false
            else -> {}
        }
        screen = back.removeLastOrNull() ?: Screen.TITLE
        return true
    }

    fun openLevel(id: String) {
        preSpec = campaignSpec(id)
        go(Screen.PRE_BATTLE)
    }

    /** A campaign battle with your Help step and what the save holds (for the core's Buttons reward). */
    fun campaignSpec(id: String, seed: Long = BattleSpec.newSeed()): BattleSpec {
        val bits = progress[id] ?: 0
        val prog = Progress(bits and 1 != 0, List(3) { bits and (1 shl it) != 0 })
        return BattleSpec.campaign(id, settings.presetKey, seed, SideOpts(settings.helpKey), prog)
    }

    fun openSpec(spec: BattleSpec) { preSpec = spec; go(Screen.PRE_BATTLE) }

    /** Replaces the Pre-battle spec in place (a Help change). */
    fun openSpecQuiet(spec: BattleSpec) { preSpec = spec }

    fun levelInfo(id: String): LevelInfo? = content.level(id)

    /** Runs [then] at once, or after the player agrees to drop the battle in play. */
    private fun replacingBattle(then: () -> Unit) {
        val draftHere = screen == Screen.PRE_BATTLE && _ui.value.live && _ui.value.phase == Phase.DRAFT
        if (canResume && !draftHere) {
            confirm = Confirm("Start a new battle?", "The battle you left will be lost.", "Start new") { canResume = false; then() }
        } else then()
    }

    /** Opens the Rummage for the Pre-battle spec (optional: Fight quick-picks it). */
    fun openRummage() {
        val spec = preSpec ?: return
        if (_ui.value.live && _ui.value.phase == Phase.DRAFT) return
        replacingBattle { begin(spec, toBattle = false) }
    }

    /** Fight: starts the battle (if the Rummage was not opened) and quick-picks what is left. */
    fun fight() {
        val spec = preSpec ?: return
        if (_ui.value.live && _ui.value.phase == Phase.DRAFT) {
            post { game?.command(Cmd.END_DRAFT); dirty = true }
            enterBattle()
            return
        }
        replacingBattle { begin(spec, toBattle = true) }
    }

    private fun begin(spec: BattleSpec, toBattle: Boolean) {
        loading = true
        lastSpec = spec
        post {
            val err = startGame(spec)
            if (err == null && toBattle && frame.phase == Phase.DRAFT) { game?.command(Cmd.END_DRAFT); dirty = true; publish() }
            ui {
                loading = false
                if (err != null) { notice = err; return@ui }
                canResume = true
                if (toBattle) enterBattle()
            }
        }
    }

    private fun enterBattle() {
        paused = false; handoffTo = -1
        back.clear(); back.addLast(Screen.TITLE); back.addLast(Screen.MAP)
        screen = Screen.BATTLE
    }

    fun rematch() {
        val spec = lastSpec ?: return
        // A campaign rematch picks up the new progress and Help; others keep their setup.
        val again = if (spec.kind == "campaign") campaignSpec(spec.level) else spec.withSeed(BattleSpec.newSeed())
        preSpec = again
        begin(again, toBattle = true)
    }

    val canRematch: Boolean get() = lastSpec != null

    /** Carry on: the live battle, or the saved one rebuilt from its log. */
    fun resume() {
        if (_ui.value.live && _ui.value.phase != Phase.ENDED) { enterBattle(); return }
        loading = true
        post {
            val b = save.battle
            val err = if (b == null) "There is no battle to carry on." else replay(b)
            if (err != null && b != null) { save = save.copy(battle = null); store.write(save) }
            val spec = gameSpec
            ui {
                loading = false
                if (err != null) { notice = err; canResume = false; screen = Screen.TITLE; return@ui }
                lastSpec = spec
                enterBattle()
            }
        }
    }

    /** Drops the battle in play without a result (a broken or unwanted save). */
    fun abandonBattle() {
        paused = false
        canResume = false
        post { closeGame(); save = save.copy(battle = null); store.write(save) }
        screen = Screen.MAP
        back.clear(); back.addLast(Screen.TITLE)
    }

    /** Leave a battle without ending it. It is saved and Carry on returns to it. */
    fun leaveBattle() {
        paused = false
        post { saveNow() }
        screen = Screen.MAP
        back.clear(); back.addLast(Screen.TITLE)
    }

    /** Couch Duel: the next player took the device. */
    fun handoffReady() { handoffTo = -1 }

    fun showResults() { screen = Screen.RESULTS }

    private fun music(to: Screen) {
        when (to) {
            Screen.BATTLE -> audio.battleMusic()
            Screen.RESULTS -> {} // the sting plays, then the map theme on the next screen
            Screen.TITLE -> if (audio.unlocked) audio.menuMusic()
            else -> audio.menuMusic(quiet = lastResult?.let { r -> r.winner >= 0 && !frame.hud.human(r.winner) } == true)
        }
        if (to != Screen.BATTLE) audio.stopLoops()
        post { resetLoops() }
    }

    /** Sim thread: the loops start again from the next frame (after a screen change or a return to the app). */
    private fun resetLoops() { windOn = -1; squallOn = -1; whistleSemis = Float.NaN }

    /** The first Play tap: sound may start (no sound before it on a first launch). */
    fun firstTap() { audio.unlock() }

    companion object {
        private const val TAG = "CastleSession"
        private const val FRAME_MS = 16L
        private const val AI_THINK_MS = 700L
    }
}

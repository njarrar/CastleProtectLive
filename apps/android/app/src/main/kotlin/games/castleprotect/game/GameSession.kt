package games.castleprotect.game

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import games.castleprotect.core.Awaiting
import games.castleprotect.core.BattleResult
import games.castleprotect.core.BattleSpec
import games.castleprotect.core.Cmd
import games.castleprotect.core.ContentInfo
import games.castleprotect.core.Core
import games.castleprotect.core.CoreException
import games.castleprotect.core.CoreFactory
import games.castleprotect.core.CoreGame
import games.castleprotect.core.Draft
import games.castleprotect.core.Frame
import games.castleprotect.core.GameEvent
import games.castleprotect.core.Hob
import games.castleprotect.core.Hud
import games.castleprotect.core.JsonReader
import games.castleprotect.core.LevelInfo
import games.castleprotect.core.NativeCore
import games.castleprotect.core.Phase
import games.castleprotect.core.Reply
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
    val sfx = Sfx(app, settings)
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
    /** Blasts waiting for the renderer. Cleared when a battle starts. */
    val fx = ConcurrentLinkedQueue<GameEvent>()
    private val _announce = MutableSharedFlow<String>(extraBufferCapacity = 8)
    /** Short texts for TalkBack: turn starts, shot results, the winner. */
    val announcements: SharedFlow<String> = _announce

    var screen by mutableStateOf(Screen.TITLE)
        private set
    private val back = ArrayDeque<Screen>()
    private val pausedState = mutableStateOf(false)
    @Volatile private var pausedFlag = false
    var paused: Boolean
        get() = pausedState.value
        set(v) { pausedState.value = v; pausedFlag = v }
    /** A battle is in play (live in the core, or saved and ready to replay). */
    var canResume by mutableStateOf(false)
        private set
    var content by mutableStateOf(ContentInfo.EMPTY)
        private set
    var progress by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    /** A note for the title screen, for example when a save could not be read. */
    var notice by mutableStateOf<String?>(null)
    var confirm by mutableStateOf<Confirm?>(null)
    /** The battle Pre-battle will start. */
    var preSpec by mutableStateOf<BattleSpec?>(null)
        private set
    /** Couch Duel, side by side: the side to hand the device to, or -1. */
    var handoffTo by mutableStateOf(-1)
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
    private var game: CoreGame? = null
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
    private val sim = Thread({ loop() }, "castle-sim").also { it.priority = Thread.NORM_PRIORITY + 1; it.start() }

    init {
        post {
            val c = ContentInfo.fromAssets(app.assets)
            val loaded = store.load()
            var msg: String? = null
            when (loaded) {
                is SaveStore.Loaded.Ok -> { save = loaded.data; if (loaded.fromBackup) msg = "Your last save could not be read, so the one before it was loaded." }
                is SaveStore.Loaded.Unreadable -> { msg = "Your save could not be read. It was kept aside (${loaded.movedTo.joinToString { it.name }}) and a fresh one started."; Log.w(TAG, "save unreadable: ${loaded.why}") }
                SaveStore.Loaded.Missing -> {}
            }
            val s = save
            ui {
                content = c; progress = s.pennants; canResume = s.battle != null; notice = msg
                lastSpec = s.last?.let { BattleSpec(it.setup, it.seed, it.kind, it.level, it.seats) }
            }
        }
    }

    // ---- lifecycle -------------------------------------------------------

    fun onStart() { foreground = true; lastStepAt = 0L; post { } }

    /** The process may die any time after this returns, so the final save is written here, synchronously. */
    fun onStop() {
        foreground = false
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
        sfx.release()
    }

    fun onTrimMemory(level: Int) { sprites.trim(level) }

    // ---- the sim thread --------------------------------------------------

    private fun post(job: () -> Unit) { jobs.offer(job) }
    private fun ui(fn: () -> Unit) { main.post(fn) }

    private fun loop() {
        while (running) {
            val f = frame
            val busy = game != null && foreground && !pausedFlag &&
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
        if (!foreground || pausedFlag) { lastStepAt = 0L; return }
        if (f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE) {
            if (lastStepAt == 0L) lastStepAt = now
            val speed = if (fast || (settings.rival2x && !f.hud.human(f.side))) 2 else 1
            tickAcc += (now - lastStepAt).coerceIn(0L, 100L) * 120f / 1000f * speed
            lastStepAt = now
            val ticks = tickAcc.toInt()
            if (ticks > 0) { tickAcc -= ticks; g.step(ticks); dirty = true }
        } else {
            lastStepAt = 0L; tickAcc = 0f
        }
        if (f.phase == Phase.PLAN && f.awaiting == Awaiting.AI) {
            // The think pose: a short wait, then the AI plays this side's turn.
            if (aiAt == 0L) aiAt = now + AI_THINK_MS
            else if (now >= aiAt) { aiAt = 0L; g.command(Cmd.AI_TURN); dirty = true }
        } else aiAt = 0L
    }

    private fun publish() {
        val g = game ?: return
        dirty = false
        val f = try { parser.parse(g.snapshot()) } catch (e: RuntimeException) { Log.e(TAG, "bad snapshot", e); return }
        frame = f
        react(f)
        _ui.value = BattleUi.of(f)
    }

    private fun react(f: Frame) {
        for (e in f.events) {
            val pan = if (f.mapW > 0) (e.x.toFloat() / f.mapW) * 2f - 1f else 0f
            when (e.t) {
                "fire" -> { sfx.play("fire", pan); shotFired = true; shotBreaks = 0; shotHits = 0 }
                "explode" -> { if (fx.size < 32) fx.add(e); sfx.play("thud", pan); buzz(15) }
                "break" -> { sfx.play("break", pan); buzz(40); shotBreaks++ }
                "hit" -> { shotHits++; if (e.target == "kettle") { sfx.play("kettle", pan); buzz(40) } }
                "kettle_pop" -> { sfx.play("kettle", pan); buzz(90) }
                "bonk" -> sfx.play("bonk", pan)
                "walk" -> sfx.play("walk", pan)
                "draft_pick" -> sfx.play("pick")
                "squall", "squall_round" -> sfx.play("squall")
                "miss" -> if (shotFired) say("Missed. The shell left the field.")
                "turn_start" -> {
                    if (shotFired) {
                        say(if (shotHits == 0) "No hits." else "Hit ${plural(shotHits, "time")}, ${plural(shotBreaks, "block")} broke.")
                        shotFired = false
                    }
                    sfx.play("turn")
                    val name = f.hud.names.getOrElse(e.side) { "" }
                    say(if (f.hud.human(e.side) && !(f.hud.human(0) && f.hud.human(1))) "Your turn" else "$name's turn")
                }
                "win" -> { val human = f.hud.human(e.winner); sfx.play(if (human) "win" else "lose"); say("${f.hud.names.getOrElse(e.winner) { "" }} wins") }
            }
        }
        // Couch Duel side by side: a new turn for the other player brings up the hand-off card.
        val spec = gameSpec
        if (f.hud.turn != lastTurn) {
            val first = lastTurn < 0
            lastTurn = f.hud.turn
            if (!first && f.phase == Phase.PLAN) {
                if (spec?.seats == "side_by_side" && f.hud.human(0) && f.hud.human(1)) {
                    val to = f.side
                    ui { handoffTo = to; handoffLine = "" }
                }
                saveNow() // autosave at every turn start
            }
        }
        if (f.result != null && lastResult == null) {
            lastResult = f.result
            onBattleEnded(f)
        }
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
        save = save.copy(battle = null)
        store.write(save)
        val p = save.pennants
        ui { progress = p; canResume = false }
    }

    private fun currentLog(g: CoreGame): String {
        val r = g.command(Cmd.LOG)
        val j = JsonReader(r.toByteArray(Charsets.UTF_8))
        j.beginObject()
        while (j.hasNext()) { if (j.nextName() == "log") return j.nextRaw() else j.skipValue() }
        return "[]"
    }

    /** Sim thread: writes the save now (progress and, when one is in play, the battle). */
    private fun saveNow() {
        val g = game
        val spec = gameSpec
        if (g != null && spec != null && frame.phase != Phase.ENDED && frame.phase != Phase.NONE) {
            val b = SavedBattle(spec.setup, spec.seed, spec.kind, spec.level, spec.seats, currentLog(g), coreVersion())
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
        lastTurn = -1; lastResult = null; aiAt = 0L; shotFired = false
        fx.clear()
        _ui.value = BattleUi()
    }

    /** Sim thread: starts a battle from a spec. Returns an error text, or null. */
    private fun startGame(spec: BattleSpec): String? {
        val fac = factory ?: return "This build has no game engine."
        closeGame()
        val g = try { fac.newGame(spec.setup, spec.seed) } catch (e: CoreException) { return "The battle could not start: ${e.message}" }
        game = g; gameSpec = spec
        dirty = true
        publish()
        val b = SavedBattle(spec.setup, spec.seed, spec.kind, spec.level, spec.seats, "[]", coreVersion())
        save = save.copy(battle = b, last = b)
        store.write(save)
        return null
    }

    /** Sim thread: rebuilds a saved battle by replaying the core's own log. */
    private fun replay(b: SavedBattle): String? {
        val fac = factory ?: return "This build has no game engine."
        closeGame()
        val g = try { fac.newGame(b.setup, b.seed) } catch (e: CoreException) { return "The saved battle could not start: ${e.message}" }
        try {
            val j = JsonReader(b.log.toByteArray(Charsets.UTF_8))
            j.beginArray()
            while (j.hasNext()) {
                val cmd = j.nextRaw()
                settle(g)
                val r = Reply.parse(g.command(cmd))
                if (!r.ok) throw CoreException("the core refused a saved command (${r.reason})")
            }
            j.endArray()
        } catch (e: Exception) {
            g.close()
            return "The saved battle does not fit this version of the game (${e.message}). It was set aside."
        }
        game = g
        gameSpec = BattleSpec(b.setup, b.seed, b.kind, b.level, b.seats)
        // The replay's events are history: drop them, keep the state and the whole map.
        frame = parser.parse(g.snapshot(), keepEvents = false)
        lastTurn = frame.hud.turn
        lastResult = frame.result
        _ui.value = BattleUi.of(frame)
        return null
    }

    /** Steps a replay through any flight, so the next command meets a Plan or Draft. */
    private fun settle(g: CoreGame) {
        var guard = 0
        while (guard++ < 50) {
            val ph = phaseOf(g.step(0))
            if (ph != "resolve" && ph != "settle") return
            g.step(2400)
        }
    }

    private fun phaseOf(stepReply: String): String {
        val j = JsonReader(stepReply.toByteArray(Charsets.UTF_8))
        j.beginObject()
        while (j.hasNext()) { if (j.nextName() == "phase") return j.nextString() else j.skipValue() }
        return ""
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
            if (onReply != null) ui { onReply(r) }
        }
        return true
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

    fun toggleFast() { fast = !fast; fastState = fast }

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
        preSpec = BattleSpec.campaign(id, settings.presetKey)
        go(Screen.PRE_BATTLE)
    }

    fun openSpec(spec: BattleSpec) { preSpec = spec; go(Screen.PRE_BATTLE) }

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
        val again = spec.withSeed(BattleSpec.newSeed())
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

    /** Give up: the battle ends here and is not kept. */
    fun quitBattle() {
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

    companion object {
        private const val TAG = "CastleSession"
        private const val FRAME_MS = 16L
        private const val AI_THINK_MS = 700L
    }
}

package games.castleprotect.game

import android.app.Application
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import games.castleprotect.core.Campaign
import games.castleprotect.core.Cmd
import games.castleprotect.core.Core
import games.castleprotect.core.CoreBridge
import games.castleprotect.core.Hud
import games.castleprotect.core.LevelInfo
import games.castleprotect.core.Phase
import games.castleprotect.core.Snapshot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.Executors

enum class Screen { TITLE, MAP, PRE_BATTLE, BATTLE, RESULTS, SKIRMISH, DUEL_SETUP, SETTINGS }

/**
 * Owns the core, the sim thread, saves and sound. It lives in a ViewModel, so a
 * turn of the device (or any other configuration change) never touches it:
 * layout is a pure function of the window, and nothing here knows the orientation.
 */
class GameSession(app: Application) : AndroidViewModel(app) {
    val settings = Settings(app)
    val sfx = Sfx(app, settings)
    /** Shared sprite cache for the field renderer and the HUD. */
    val sprites = games.castleprotect.battle.Sprites(app.assets)
    private val saves = SaveStore(app)
    private val io = Executors.newSingleThreadExecutor()
    private val lock = Any()
    private val core: CoreBridge = Core.create()
    val coreName: String get() = core.name

    @Volatile var latest: Snapshot = Snapshot.EMPTY
        private set
    /** Visual events (blasts) waiting for the renderer. */
    val fx = java.util.concurrent.ConcurrentLinkedQueue<games.castleprotect.core.GameEvent>()
    private val _hud = MutableStateFlow(Hud())
    val hud: StateFlow<Hud> = _hud

    var screen by mutableStateOf(Screen.TITLE)
        private set
    private var back = ArrayDeque<Screen>()
    var paused by mutableStateOf(false)
    var canResume by mutableStateOf(false)
        private set
    var levelInfo by mutableStateOf<LevelInfo?>(null)
        private set
    /** Bumped when menu data may have changed, so screens re-query. */
    var menuEpoch by mutableStateOf(0)
        private set
    /** Remembered so Rematch and "Same again" are one tap. */
    private var lastBattleCmd: String? = null

    @Volatile private var running = false
    @Volatile private var foreground = false
    private var thread: Thread? = null
    private var lastTurnSeq = -1
    private var lastPhase = Phase.NONE
    private val vibrator = app.getSystemService(Vibrator::class.java)

    init {
        saves.read()?.let { data ->
            synchronized(lock) {
                if (core.load(data)) {
                    val s = Snapshot.parse(core.snapshot())
                    latest = s; _hud.value = s.hud
                    canResume = s.hud.phase == Phase.PLAN || s.hud.phase == Phase.HANDOFF
                    lastTurnSeq = s.hud.turnSeq; lastPhase = s.hud.phase
                }
            }
        }
    }

    // ---- lifecycle -------------------------------------------------------

    fun onStart() {
        foreground = true
        if (thread?.isAlive == true) return
        running = true
        thread = Thread({ loop() }, "castle-sim").also { it.priority = Thread.NORM_PRIORITY + 1; it.start() }
    }

    fun onStop() {
        foreground = false
        running = false
        thread?.join(500)
        thread = null
        saveNow()
    }

    override fun onCleared() {
        running = false
        thread?.join(500)
        io.shutdown()
        sfx.release()
        synchronized(lock) { core.close() }
    }

    private fun loop() {
        var last = System.nanoTime()
        while (running) {
            val now = System.nanoTime()
            val ms = ((now - last) / 1_000_000L).toInt()
            if (ms >= 1) last += ms * 1_000_000L
            val inBattle = screen == Screen.BATTLE || screen == Screen.PRE_BATTLE
            val raw = synchronized(lock) {
                if (inBattle && !paused && ms > 0) core.advance(ms.coerceAtMost(100))
                core.snapshot()
            }
            val s = Snapshot.parse(raw)
            latest = s
            _hud.value = s.hud
            react(s)
            try { Thread.sleep(if (inBattle) 12 else 50) } catch (e: InterruptedException) { return }
        }
    }

    @Synchronized
    private fun react(s: Snapshot) {
        for (e in s.events) when (e.type) {
            "blast" -> { if (fx.size < 32) fx.add(e) }
            "audio" -> {
                val pan = if (s.worldW > 0 && e.x > 0) (e.x / s.worldW) * 2f - 1f else 0f
                sfx.play(e.cue, pan)
                if (e.cue == "break" || e.cue == "kettle") buzz(40) else if (e.cue == "thud") buzz(15)
            }
        }
        val h = s.hud
        // Autosave at every turn start, and when the hand-off card comes up, off the frame path.
        if (h.turnSeq != lastTurnSeq || (h.phase != lastPhase && (h.phase == Phase.HANDOFF || h.phase == Phase.ENDED))) {
            lastTurnSeq = h.turnSeq
            saveNow()
        }
        if (h.phase != lastPhase) {
            lastPhase = h.phase
            if (h.phase == Phase.ENDED) { canResume = false; menuEpoch++ }
        }
    }

    fun buzz(ms: Long) {
        if (settings.haptics == 0 || vibrator == null) return
        val amp = if (settings.haptics == 1) 60 else 160
        try {
            if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(ms, amp))
        } catch (e: Exception) { }
    }

    fun saveNow() {
        val data = synchronized(lock) { core.save() }
        if (!io.isShutdown) io.execute { saves.write(data) }
    }

    // ---- core access -----------------------------------------------------

    /** Sends a command. Returns true when the core accepted it. */
    fun send(cmd: String): Boolean {
        val r = synchronized(lock) { core.command(cmd) }
        return r.contains("\"ok\":true") || r.contains("\"ok\": true")
    }

    /** Reads a fresh snapshot right away, so a screen opened by a command never shows the old battle for a frame. */
    private fun refresh() {
        val s = Snapshot.parse(synchronized(lock) { core.snapshot() })
        latest = s; _hud.value = s.hud
        react(s)
    }

    fun query(q: String): String = synchronized(lock) { core.query(q) }
    fun campaign(): Campaign = Campaign.parse(query("""{"q":"campaign"}"""))

    // ---- navigation ------------------------------------------------------

    fun go(to: Screen, remember: Boolean = true) {
        if (remember && screen != to) back.addLast(screen)
        screen = to
    }

    /** Returns false when there is nowhere to go back to (the activity may finish). */
    fun goBack(): Boolean {
        when (screen) {
            Screen.BATTLE -> { paused = !paused; return true }
            Screen.PRE_BATTLE -> { send(Cmd.ABANDON) }
            Screen.RESULTS -> { screen = Screen.MAP; back.clear(); back.addLast(Screen.TITLE); return true }
            Screen.TITLE -> return false
            else -> {}
        }
        screen = back.removeLastOrNull() ?: Screen.TITLE
        return true
    }

    fun openLevel(id: String) {
        levelInfo = LevelInfo.parse(query("""{"q":"level","id":${Cmd.q(id)}}"""))
        startPre(Cmd.newBattle("campaign", level = id, preset = settings.presetKey))
    }

    fun startPre(cmd: String) {
        lastBattleCmd = cmd
        send(cmd)
        refresh()
        go(Screen.PRE_BATTLE)
    }

    /** Fight: closes the draft (the core quick-picks what is left) and starts the Muster. */
    fun fight() {
        send(Cmd.END_DRAFT)
        refresh()
        paused = false
        canResume = false
        screen = Screen.BATTLE
    }

    fun startNow(cmd: String, levelFor: String? = null) {
        if (levelFor == null) levelInfo = null
        lastBattleCmd = cmd
        send(cmd)
        send(Cmd.END_DRAFT)
        refresh()
        paused = false
        back.clear(); back.addLast(Screen.TITLE); back.addLast(Screen.MAP)
        screen = Screen.BATTLE
    }

    fun rematch() { lastBattleCmd?.let { c -> startNow(c.replace(Regex("\"seed\":-?\\d+"), "\"seed\":${System.nanoTime()}"), levelInfo?.id) } }
    val canRematch: Boolean get() = lastBattleCmd != null

    fun resume() {
        paused = false
        back.clear(); back.addLast(Screen.TITLE); back.addLast(Screen.MAP)
        screen = Screen.BATTLE
    }

    fun quitBattle() {
        send(Cmd.ABANDON)
        paused = false
        canResume = false
        saveNow()
        menuEpoch++
        screen = Screen.MAP
        back.clear(); back.addLast(Screen.TITLE)
    }

    /** Leave a battle without ending it. It stays saved and Carry on returns to it. */
    fun leaveBattle() {
        canResume = true
        screen = Screen.MAP
        back.clear(); back.addLast(Screen.TITLE)
    }

    fun showResults() { screen = Screen.RESULTS }
}

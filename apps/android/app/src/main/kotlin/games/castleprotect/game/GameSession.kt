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
import games.castleprotect.core.Text
import games.castleprotect.core.Names
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

enum class Screen { TITLE, MAP, PRE_BATTLE, BATTLE, RESULTS, SKIRMISH, DUEL_SETUP, SETTINGS, WORKSHOP }

/**
 * What the Compose HUD reads. The selected Hob's aim is left out (every Hob's angle and
 * power read 0 here; the aim is in [GameSession.aim]), so an Aim Drag step gives an equal
 * BattleUi and the HUD does not recompose (review 2 N-M9).
 */
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
            val hobs = f.hobs.map { if (it.angle == 0 && it.power == 0) it else it.copy(angle = 0, power = 0) }
            return BattleUi(true, f.phase, f.side, f.awaiting, f.level, f.mode, f.hud, hobs, f.draft, f.result, recall)
        }
    }
}

/** A question the player must answer before something is lost. */
class Confirm(val title: String, val text: String, val yes: String, val no: String, val action: () -> Unit)

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
    // The string table first: every screen reads it from its first frame (content/text.json).
    init { Text.fromAssets(app.assets) }
    val settings = Settings(app)
    /** The app's version name, for Settings, About. */
    val appVersion: String = try { app.packageManager.getPackageInfo(app.packageName, 0).versionName ?: "" } catch (e: Exception) { "" }
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
    val coreName: String get() = factory?.name ?: ""
    /** The rules version of the core in this build (from cp_version), else the one the app is built for. */
    val rulesVersion: Int get() = (if (factory?.standIn == false) runCatching { SaveCompat.rulesOf(NativeCore.version()) }.getOrNull() else null) ?: SaveCompat.RULES
    /** Set when this build has no game engine at all (a release without the native library). */
    val coreMissing: Boolean get() = factory == null

    private val store = SaveStore(File(app.filesDir, "save"), if (factory?.standIn == true) "castle-standin.sav" else "castle.sav")

    // ---- state published to the UI (main thread) ------------------------------

    @Volatile var frame: Frame = Frame.EMPTY
        private set
    private val _ui = MutableStateFlow(BattleUi())
    val ui: StateFlow<BattleUi> = _ui
    private val _aim = MutableStateFlow(AimUi())
    /** The selected Hob's aim, for the readout and the Fine Tune pad only. */
    val aimState: StateFlow<AimUi> = _aim
    /** Frames with events, waiting for the field's effects (FieldFx). Cleared when a battle starts. */
    val fxFrames = ConcurrentLinkedQueue<Frame>()
    /** A battle banner (Fatigue, a shot switched to the Plain Shot) and when it hides (uptime ms). */
    var banner by mutableStateOf<Pair<String, Long>?>(null)
        private set
    /** The banner is a warning in red (the Fatigue collapse starts). */
    var bannerDanger by mutableStateOf(false)
        private set
    /** The Creaks banners, the "Your turn" wait and the camera hold (QA playtest 2, N1). */
    val fatigue = FatigueBeat()
    /** The Rival fort peek in the Wide layout (QA playtest 2, N3). */
    val peek = RivalPeek()
    /** True while a Round 10 Fatigue collapse is shaking the view (Android-M2). */
    val fatigueShaking: Boolean get() = SystemClock.uptimeMillis() <= fatigueUntil
    /** True while collapse pieces are actively animating on screen (collapse settle wait). */
    @Volatile var collapseShowing = false
    /** Own-fort block [c, r] currently targeted for Mendglob healing, or null (Android-H5). */
    var mendTarget by mutableStateOf<Pair<Int, Int>?>(null)
        private set
    @Volatile var mendTargetCell: Pair<Int, Int>? = null
        private set
    fun pickMendTarget(cell: Pair<Int, Int>?) { mendTarget = cell; mendTargetCell = cell }
    /** Optional shot dial ("hops3" for Bobbin, "puff_up" for Hetty's Barn Raising) (Android-H5). */
    var activeDial by mutableStateOf<String?>(null)
        private set
    fun setDial(dial: String?) { activeDial = dial }
    /** The gold ring on the picked Hob teaches the owner rule until 3 aims were started from the fort. */
    @Volatile var teachRing = true
        private set
    /** The sky drag nudge was shown in this battle. */
    @Volatile private var nudged = false
    /** The core's words for a shot that can not fire (a refused Fire, a tap on grey Fire), and when they hide. */
    var fireNote by mutableStateOf<Pair<String, Long>?>(null)
        private set
    /** The Workshop fort (rows top down, Footing last), or empty for the default. */
    var fort by mutableStateOf<List<String>>(emptyList())
        private set
    /** True once initial SaveStore.load() has completed (prevents cold-launch Play race, Android-L9). */
    var storeLoaded by mutableStateOf(false)
        private set
    /** True when today's Daily Dust-up win reward was already earned (Android-M11). */
    var dailyDone by mutableStateOf(false)
        private set
    /** True while the live handle was opened for Pre-battle Rummage and has not yet entered Battle (Android-C1). */
    var draftedOnPreBattle by mutableStateOf(false)
        private set
    /** Pre-battle note when a saved Workshop fort could not fit the level's seats (Android-H6). */
    var preFortNote by mutableStateOf<String?>(null)
        private set
    /** True when the current Pre-battle spec is using the saved Workshop fort (Android-H6). */
    var preUsingCustomFort by mutableStateOf(false)
        private set
    /** Pre-battle chosen crew for levels where roster exceeds fort seats (Android-H6). */
    var preCrew by mutableStateOf<List<String>>(emptyList())
        private set
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
            if (v != Screen.BATTLE && pausedState.value) { pausedState.value = false; pausedFlag = false }
            if (was != v) {
                if (v != Screen.BATTLE) audio.setPaused(false)
                music(v)
            }
        }
    private val back = ArrayDeque<Screen>()
    private val pausedState = mutableStateOf(false)
    @Volatile private var pausedFlag = false
    var paused: Boolean
        get() = pausedState.value
        set(v) { pausedState.value = v; pausedFlag = v; audio.setPaused(v && screen == Screen.BATTLE); jobs.offer {} } // wake the sim at once
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
    private var steamVentAt = 0L
    private var windOn = -1
    private var squallOn = -1
    private var whistleSemis = Float.NaN
    private var rollOn = false
    private var zipPlayed = false
    private var lastShellId = -1
    private var lastShellRot = 0
    private var lastShooterDef = ""
    private var lastShooterSide = -1
    private var collapseHoldStart = 0L
    @Volatile private var aiThinkMs = 1000L
    private val sim = Thread({ loop() }, "castle-sim").also { it.priority = Thread.NORM_PRIORITY + 1; it.start() }

    init {
        // Headphones pulled out: the battle pauses (the sound is already silenced, 07 section 8.3).
        audio.onNoisy = { main.post { if (screen == Screen.BATTLE && handoffTo < 0) paused = true } }
        post {
            anims = try { Anims.parse(app.assets.open("animations.json").bufferedReader().use { it.readText() }) } catch (e: Exception) { Anims.EMPTY }
            val c = ContentInfo.fromAssets(app.assets)
            aiThinkMs = c.app.rivalThinkMs
            val loaded = store.load()
            var msg: String? = null
            when (loaded) {
                is SaveStore.Loaded.Ok -> { save = loaded.data; if (loaded.fromBackup) msg = Text.t("errors.save_last_unreadable") }
                is SaveStore.Loaded.Unreadable -> { msg = Text.t("errors.save_unreadable"); Log.w(TAG, "save unreadable: ${loaded.why} (${loaded.movedTo.joinToString { it.name }})") }
                SaveStore.Loaded.Missing -> {}
            }
            val s = save
            teachRing = OwnerRule.ringOn(s.aimStarts)
            val today = todayDate()
            audio.menuMusic()
            ui {
                content = c; progress = s.pennants; buttons = s.buttons; canResume = s.battle != null; notice = msg; fort = s.fort
                dailyDone = s.dailyDate == today
                lastSpec = s.last?.let { BattleSpec(it.setup, it.seed, it.kind, it.level, it.seats) }
                storeLoaded = true
            }
        }
    }

    // ---- lifecycle -------------------------------------------------------

    fun onStart() { foreground = true; audio.onStart(); post { lastStepAt = 0L; resetLoops(); dirty = game != null } }

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
        post { try { saveNow(); closeGame(); scratch?.close(); scratch = null } finally { done.countDown() } }
        try { done.await(3, TimeUnit.SECONDS) } catch (e: InterruptedException) { }
        running = false
        sim.interrupt()
        // Bounded: a long replay at this moment must not hold the main thread (review 2 N-L16).
        try { sim.join(1000) } catch (e: InterruptedException) { }
        audio.release()
    }

    fun onTrimMemory(level: Int) {
        sprites.trim(level)
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) audio.trim()
    }

    // ---- the sim thread --------------------------------------------------

    private fun post(job: () -> Unit) { jobs.offer(job) }
    private fun ui(fn: () -> Unit) { main.post(fn) }

    private fun loop() {
        while (running) {
            val f = frame
            // A snapshot still owed (after a fault in publish) is taken at once, not after a 1 s sleep.
            val busy = dirty || (game != null && foreground && !pausedFlag && battleOnScreen &&
                (f.phase == Phase.RESOLVE || f.phase == Phase.SETTLE || (f.phase == Phase.PLAN && f.awaiting == Awaiting.AI)))
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
            // Gate settle completion on active collapse choreography (capped at 2.2 s, skippable with 2x).
            if (f.phase == Phase.SETTLE && collapseShowing && !fast) {
                if (collapseHoldStart == 0L) collapseHoldStart = now
                if (now - collapseHoldStart < COLLAPSE_HOLD_MAX_MS) {
                    val view = juice.scale(now)
                    audio.slowMo = view in 0.01f..0.99f
                    lastStepAt = now
                    return
                }
            } else {
                collapseHoldStart = 0L
            }
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
            lastStepAt = 0L; tickAcc = 0f; collapseHoldStart = 0L
            audio.slowMo = juice.scale(now) in 0.01f..0.99f
        }
        if (f.phase == Phase.PLAN && f.awaiting == Awaiting.AI) {
            // The think pose: the Rival's own pause (hud.think_ms, from the level or the Skirmish roster),
            // else content/app.json rival_think_seconds; then the AI plays.
            if (aiAt == 0L) aiAt = now + thinkMs(f.hud, f.side, aiThinkMs)
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
        // The command that hit the fault was dropped: tell the player, so Fire is not a dead button.
        g.takeDropped()?.let { ui { notice = Text.t("errors.move_failed") } }
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
        } catch (e: RuntimeException) {
            // The snapshot drained its dirty terrain chunks: ask for the whole map again so no crater is lost (review 2 N-L13).
            Log.e(TAG, "bad snapshot", e)
            try { g.command(Cmd.TERRAIN_ALL) } catch (e2: RuntimeException) { }
            return
        }
        if (quietNext) { quietNext = false; g.takeRebuilt() }
        val prev = frame
        frame = f
        react(f, prev)
        if (f.events.isNotEmpty()) { fxFrames.add(f); while (fxFrames.size > 32) fxFrames.poll() }
        _ui.value = BattleUi.of(f)
        _aim.value = AimUi.of(f)
    }

    /** The core failed on this battle again and again: it is set aside, and the player is told. */
    private fun battleBroken(why: String) {
        closeGame()
        save = save.copy(battle = null)
        store.write(save)
        ui {
            Log.w(TAG, "battle broken: $why")
            notice = Text.t("errors.fight_broke")
            canResume = false; paused = false; screen = Screen.TITLE; back.clear()
        }
    }

    private fun pan(f: Frame, x: Int): Float = if (f.mapW > 0) (x.toFloat() / f.mapW) * 2f - 1f else 0f

    private fun blockMat(prev: Frame, f: Frame, side: Int, c: Int, r: Int): String? =
        BlockLookup.material(prev, f, side, c, r)

    private fun blockOf(src: Frame, side: Int, c: Int, r: Int): games.castleprotect.core.Block? {
        val k = src.castles.firstOrNull { it.side == side } ?: src.castles.getOrNull(side) ?: return null
        for (b in k.blocks) if (b.c == c && b.r == r) return b
        return null
    }

    private fun hobOf(f: Frame, id: Int): Hob? = f.hobs.firstOrNull { it.id == id }

    /** TalkBack texts of the frame being read; sent as one at its end (review 2 N-M11). */
    private val sayParts = ArrayList<String>()

    private fun react(f: Frame, prev: Frame) {
        sayParts.clear()
        try { reactEvents(f, prev) } finally {
            if (sayParts.isNotEmpty()) { _announce.tryEmit(Announce.join(sayParts)); sayParts.clear() }
        }
    }

    private fun reactEvents(f: Frame, prev: Frame) {
        val now = SystemClock.uptimeMillis()
        val ending = f.events.any { it.t == "win" }
        var breaks = 0
        val m = audio.manifest
        for (e in f.events) {
            val pan = pan(f, e.x)
            val semis = Cues.semis(e)
            for (id in Cues.forEvent(e, m) { s, c, r -> blockMat(prev, f, s, c, r) }) audio.play(id, pan, semis = semis)
            when (e.t) {
                "fire" -> {
                    fatigue.onEvent(e.t, e.why, f.hud.round, now)
                    shotFired = true; shotBreaks = 0; shotHits = 0; shotDmg = 0
                    zipPlayed = false; lastShellId = -1; lastShellRot = 0
                    juice.newShot()
                    hobOf(f, e.hob)?.let { h ->
                        lastShooterDef = h.def; lastShooterSide = h.side
                        lastShooterName = content.hobShort(h.def)
                        bark(f, h, "fire")
                        val shot = e.shot.takeIf { it.isNotEmpty() }?.let { content.shotName(it) }
                        say(if (shot != null) Text.t("a11y.fired", "hob" to lastShooterName, "shot" to shot) else Text.t("a11y.fired_plain", "hob" to lastShooterName))
                    }
                }
                "explode" -> {
                    val (t, d) = Juice.blastTrauma(Juice.band(e.r))
                    juice.addTrauma(t, d)
                    buzz(if (e.r > 28) 40 else 20)
                }
                "break" -> { shotBreaks++; breaks++ }
                "hit" -> {
                    shotHits++; shotDmg += e.dmg
                    if (e.target == "block") {
                        // col_crack when a block drops into a worse wear state (fresh -> scuffed or battered).
                        val pb = blockOf(prev, e.side, e.c, e.r)
                        val cb = blockOf(f, e.side, e.c, e.r)
                        if (pb != null && cb != null && ((pb.hp == pb.max && cb.hp < cb.max) || (!pb.battered && cb.battered))) {
                            audio.play("col_crack", pan)
                        }
                    }
                    if (e.target == "hob") {
                        // Hit stop by damage band (07 section 6.1); first hit only (the 250 ms rule).
                        val ms = when { e.dmg < 30 -> 0; e.dmg < 60 -> 30; e.dmg < 100 -> 50; else -> 80 }
                        if (ms > 0) juice.hitStop(ms, now, fast)
                        hobOf(f, e.hob)?.let { h ->
                            bark(f, h, "takes_hit")
                            if (e.dmg > 0 && lastShooterDef.isNotEmpty() && lastShooterSide >= 0 && lastShooterSide != h.side) {
                                audio.bark(lastShooterDef, "hit_lands", lastShooterSide, f.hud.turn, pan(f, h.x), ::say2, mates(f, lastShooterSide), rivalFor(f, lastShooterSide))
                            }
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
                    if (h != null) { bark(f, h, "bonked"); say(Text.t("a11y.bonked", "target" to content.hobShort(h.def))) }
                    pattern(10, 40, 10, 40, 30)
                }
                "thump", "castle_drop" -> { juice.hitStop(50, now, fast); juice.addTrauma(0.5f, 300, upDown = true); buzz(50) }
                "threaded" -> { juice.slowMo(0.4f, 400, now); pattern(8, 60, 8) }
                "walk" -> buzz(10)
                "squall_round" -> say(Text.t("banners.weather.squall_round", "n" to e.n))
                // A warning a round ahead, then a red banner as the collapse starts (QA playtest 2, N1).
                "fatigue_warning", "fatigue" -> fatigue.onEvent(e.t, e.why, f.hud.round, now)?.let { b ->
                    say(b.text); showBanner(b.text, b.ms, b.danger)
                    if (e.t == "fatigue") fatigueUntil = now + 2500
                }
                "collapse" -> if (e.why == "fatigue") { fatigue.onEvent(e.t, e.why, f.hud.round, now); fatigueUntil = now + 2500; say(Text.plural("banners.creaks.fell", e.blockCount)) }
                // At turn start (or on a Hob pick) a shot that can not fire moves to the Plain Shot (M1).
                "shot_switch" -> if (f.hud.human(e.side)) {
                    val h = hobOf(f, e.hob)
                    val from = if (e.fromShot == "knack") h?.knack else e.fromShot.takeIf { it != "plain" }
                    val t = HudText.shotSwitch(h?.let { content.hobShort(it.def) } ?: "", e.why, from?.let { content.shotName(it) } ?: "")
                    say(t); showBanner(t, 3000)
                }
                "boss_phase" -> {
                    val line = Text.opt("levels.${f.level}.phases.${e.phase}") ?: Text.t("banners.notice.boss_phase_default")
                    say(Text.t("a11y.boss_phase", "n" to e.phase)); showBanner(line, 3000)
                }
                "relight" -> say(Text.t("notes.relight"))
                "miss" -> if (shotFired) say(Text.t("a11y.missed"))
                // Test Yard: the Dummy side passes itself; its turn is not news (M4).
                "turn_start" -> if (f.hud.yard && e.side == 1) Unit else {
                    if (shotFired) {
                        val who = f.hud.names.getOrElse(if (e.side >= 0) 1 - e.side else 0) { "" }
                        // The hand-off card names the side; TalkBack names the Hob that fired.
                        lastSummary = if (shotHits == 0) Text.t("handoff.last_miss", "name" to who) else Text.plural("handoff.last_hit", shotBreaks, "name" to who, "dmg" to shotDmg)
                        val hob = lastShooterName.ifEmpty { who }
                        say(when {
                            shotHits == 0 -> Text.t("a11y.shot_missed", "hob" to hob)
                            else -> Text.plural("a11y.shot_summary", shotBreaks, "hob" to hob, "dmg" to shotDmg)
                        })
                        shotFired = false
                    }
                    juice.newTurn()
                    audio.play("turn_yours", semis = if (e.side == 1) -2f else 0f)
                    val name = f.hud.names.getOrElse(e.side) { "" }
                    say(when {
                        f.hud.human(e.side) && !(f.hud.human(0) && f.hud.human(1)) -> Text.t("a11y.round_your_turn", "n" to f.hud.round)
                        f.hud.human(e.side) -> Text.t("a11y.round_name_turn", "n" to f.hud.round, "name" to name)
                        else -> Text.t("a11y.round_rival_aims", "n" to f.hud.round, "rival" to Names.rivalShort(f.level, name))
                    })
                    // The Fatigue warning also comes from the HUD, so a resumed battle shows it too.
                    if (f.hud.human(e.side)) fatigue.onTurnStart(f.hud.fatigueIn, f.hud.round, now)?.let { b -> showBanner(b.text, b.ms, b.danger) }
                }
                "win" -> {
                    val human = f.hud.human(e.winner)
                    val duel = f.hud.human(0) && f.hud.human(1)
                    audio.stopLoops()
                    audio.sting(human || duel)
                    f.hobs.firstOrNull { it.side == e.winner && !it.bonked && audio.manifest["bark_${Cues.barkKey(it.def)}_win"] != null }?.let { h ->
                        audio.bark(h.def, "win", h.side, f.hud.turn, pan(f, h.x), ::say2, mates(f, h.side), rivalFor(f, h.side), crewLine = audio.barks.crewWin)
                    }
                    say(Text.t("a11y.wins", "name" to f.hud.names.getOrElse(e.winner) { "" }))
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
            ui { pickMendTarget(null); setDial(null) }
            if (!first && f.phase == Phase.PLAN) {
                if (spec?.seats == "side_by_side" && f.hud.human(0) && f.hud.human(1)) {
                    val to = f.side
                    val line = lastSummary
                    ui { handoffTo = to; handoffLine = line; audio.play("ui_handoff_flip") }
                }
                saveNow() // autosave at every turn start
            }
        }
        openOnAble(f)
        if (f.result != null && lastResult == null) {
            lastResult = f.result
            onBattleEnded(f)
        }
    }

    private var openedTurn = -1

    /** A turn opens on a Hob who can act (QA playtest 2, n1): once per turn, on the person's own Plan step. */
    private fun openOnAble(f: Frame) {
        if (f.phase != Phase.PLAN || f.awaiting != Awaiting.HUMAN || f.hud.turn == openedTurn) return
        openedTurn = f.hud.turn
        val id = OwnerRule.openOn(f.hobs, f.side, f.hud.selectedHob) ?: return
        val g = game ?: return
        val r = Reply.parse(g.command(Cmd.pickHob(id)))
        checkRebuilt()
        if (r.ok) dirty = true
    }

    /** An Aim Drag started on the fort: counts toward the 3 that end the gold ring (saved). Main thread. */
    fun aimStarted() {
        if (!teachRing) return
        post {
            val n = (save.aimStarts + 1).coerceAtMost(OwnerRule.TEACH)
            save = save.copy(aimStarts = n)
            teachRing = OwnerRule.ringOn(n)
            store.write(save)
        }
    }

    /** A drag that started in the sky on your turn: true (once per battle) when the nudge should show. Main thread. */
    fun skyDrag(inAimLens: Boolean): Boolean {
        val u = _ui.value
        if (!OwnerRule.nudge(u.humanTurn, u.selected != null, inAimLens, nudged)) return false
        nudged = true
        _announce.tryEmit(OwnerRule.NUDGE)
        return true
    }

    /** Music layers, the wind bed, the Squall, the flight whistle, rollers, fast zips, bounces and kettle steam. */
    private fun loops(f: Frame, now: Long) {
        if (f.phase == Phase.ENDED || !battleOnScreen) {
            if (windOn != -1 || rollOn) { audio.stopLoops(); windOn = -1; squallOn = -1; whistleSemis = Float.NaN; rollOn = false }
            return
        }
        val up = listOf(f.hobs.count { it.side == 0 && !it.bonked }, f.hobs.count { it.side == 1 && !it.bonked })
        val (stir, peril) = Cues.layers(f.hud.kettlePct, up, hobsAtStart, f.hud.squallWarning, f.hud.squallRound)
        audio.setLayers(stir, peril)
        val wind = abs(f.hud.wind)
        if (wind != windOn) { windOn = wind; audio.loop("wx_wind_loop", wind > 0, gain = wind / 10f) }
        val sq = f.hud.squallRound
        if (sq != squallOn) { squallOn = sq; audio.loop("wx_squall_loop", sq > 0, gain = 10f.pow(3f * (sq - 1) / 20f)) }
        // Arc shells whistle (-7..+7 semis with height); rollers hum on ground; bouncers hop; fast bolts zip.
        val sh = f.shells.firstOrNull()
        if (sh != null && f.mapH > 0) {
            val semis = (((f.mapH - sh.y).toFloat() / f.mapH) * 14f - 7f).coerceIn(-7f, 7f)
            if (whistleSemis.isNaN() || abs(semis - whistleSemis) > 0.5f) { whistleSemis = semis; audio.loop("fly_whistle_loop", true, semis = semis) }
            // Fast bolt / beam zip passing the middle of the field.
            if (!zipPlayed && (sh.shot == "hatpin" || sh.shot == "sunspear") && f.mapW > 0 && abs(sh.x - f.mapW / 2) < f.mapW / 8) {
                zipPlayed = true
                audio.play("fly_fast_zip", pan(f, sh.x))
            }
            // Bouncer hop cue when vertical direction flips from downward to upward.
            if (sh.shot == "bouncebean" || sh.shot == "old_turnip" || sh.shot == "rubber_radish") {
                val normPrev = ((lastShellRot % 3600) + 3600) % 3600
                val normNow = ((sh.rot % 3600) + 3600) % 3600
                if (lastShellId == sh.id && normPrev in 1801..3599 && normNow in 1..1799) {
                    audio.play("fly_bounce_hop", pan(f, sh.x))
                }
            }
            lastShellId = sh.id
            lastShellRot = sh.rot
            // Roller ground hum loop.
            val rolling = (sh.shot == "rolypoly" || sh.shot == "marble_sack") && sh.y >= f.groundAt(sh.x) - 18
            if (rolling != rollOn) { rollOn = rolling; audio.loop("fly_roll_loop", rolling) }
        } else {
            if (!whistleSemis.isNaN()) { whistleSemis = Float.NaN; audio.loop("fly_whistle_loop", false) }
            if (rollOn) { rollOn = false; audio.loop("fly_roll_loop", false) }
            lastShellId = -1
        }
        // A Heartkettle at 50% or less whistles every few seconds, higher as HP falls; <= 25% vents steam.
        val low = f.hud.kettlePct.filter { it in 1..50 }.minOrNull()
        val k = audio.manifest["ket_whistle_loop"]
        if (low != null && k != null && now - whistleAt > ((k.durationS + k.repeatGapS) * 1000).toLong()) {
            whistleAt = now
            audio.play("ket_whistle_loop", semis = 3f * (50 - low) / 50f)
        }
        if (low != null && low <= 25 && now - steamVentAt > 2400L) {
            steamVentAt = now
            audio.play("cas_steam")
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
        // Collapse choreography may land right after settle or during Round 10 Fatigue: keep full shake, stop and slow-mo (Android-M2).
        val ph = frame.phase
        if (pausedFlag || ph == Phase.ENDED) return
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

    /** A Hob's bark, with its crewmates (for `with_mate` lines) and the Rival's short name (for `with_rival`). */
    private fun bark(f: Frame, h: Hob, event: String) =
        audio.bark(h.def, event, h.side, f.hud.turn, pan(f, h.x), ::say2, mates(f, h.side), rivalFor(f, h.side))

    /** Content ids of the Hobs on [side]. */
    private fun mates(f: Frame, side: Int): Set<String> = f.hobs.filter { it.side == side }.map { it.def }.toSet()

    /** The Rival's short name when [side] faces a named Rival (the other side is the game's), else null. */
    private fun rivalFor(f: Frame, side: Int): String? {
        val other = 1 - side
        if (other !in 0..1 || f.hud.human(other) || f.hud.yard) return null
        val name = f.hud.names.getOrNull(other) ?: return null
        val key = Names.rivalKey(f.level, name)
        return if (key == "skirmish") null else Names.rivalShort(f.level, name)
    }

    private var lastShooterName = ""

    /** Until when a Fatigue collapse may shake the view (uptime ms). */
    @Volatile private var fatigueUntil = 0L

    private fun showBanner(text: String, ms: Long, danger: Boolean = false) { val until = SystemClock.uptimeMillis() + ms; ui { banner = text to until; bannerDanger = danger } }

    /** Shows the core's words for a shot that can not fire (main thread). */
    fun showFireNote(text: String) { fireNote = text to SystemClock.uptimeMillis() + 3500 }
    private fun say(s: String) { sayParts.add(s) }

    private fun onBattleEnded(f: Frame) {
        val r = f.result ?: return
        val spec = gameSpec
        if (spec?.kind == "campaign") {
            var bits = 0
            r.pennants.forEachIndexed { i, b -> if (b) bits = bits or (1 shl i) }
            val old = save.pennants[spec.level] ?: 0
            save = save.copy(pennants = save.pennants + (spec.level to (old or bits)))
        }
        val today = todayDate()
        val newDaily = if (spec?.kind == "daily" && r.winner == 0) today else save.dailyDate
        // Buttons come from the core (result.buttons, design 5.2), never worked out here.
        save = save.copy(battle = null, buttons = save.buttons + r.buttons, dailyDate = newDaily)
        lostLast = r.winner >= 0 && !f.hud.human(r.winner) && !(f.hud.human(0) && f.hud.human(1))
        store.write(save)
        val p = save.pennants
        val b = save.buttons
        val doneDaily = newDaily == today
        ui { progress = p; buttons = b; canResume = false; dailyDone = doneDaily }
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
        lastTurn = -1; lastResult = null; aiAt = 0L; shotFired = false; quietNext = false; fatigueUntil = 0L; openedTurn = -1; nudged = false
        collapseShowing = false; collapseHoldStart = 0L
        lastShooterDef = ""; lastShooterSide = -1; zipPlayed = false; lastShellId = -1; lastShellRot = 0; rollOn = false
        fatigue.reset()
        peek.reset()
        main.post { banner = null; fireNote = null; pickMendTarget(null); setDial(null); draftedOnPreBattle = false }
        hobsAtStart = listOf(0, 0); windOn = -1; squallOn = -1; whistleSemis = Float.NaN
        fxFrames.clear()
        audio.stopLoops()
        _ui.value = BattleUi()
    }

    /** Set at a battle's end when the player lost: the next map theme plays quietly, once. */
    @Volatile private var lostLast = false

    /** Hooks a new battle up: a rebuild shows Loading; its sprites and barks load before they are needed. */
    private fun attach(g: LiveBattle, f: Frame) {
        g.onRebuild = { busy -> ui { loading = busy } }
        val crew = f.hobs.map { it.def to games.castleprotect.battle.Sprites.team(it.side, f.hud.human(it.side)) }
        sprites.prefetch(games.castleprotect.battle.Sprites.battleSet(crew))
        audio.preloadBarks(crew.map { it.first }.toSet())
    }

    /** Sim thread: starts a battle from a spec. Returns an error text, or null. */
    private fun startGame(spec: BattleSpec): String? {
        val fac = factory ?: return Text.t("errors.not_installed")
        closeGame()
        val g = try { LiveBattle.open(fac, spec.setup, spec.seed) } catch (e: CoreException) { Log.w(TAG, "start", e); return Text.t("errors.fight_cannot_start") }
        game = g; gameSpec = spec
        dirty = true
        publish()
        attach(g, frame)
        val b = SavedBattle(spec.setup, spec.seed, spec.kind, spec.level, spec.seats, "[]", coreVersion())
        save = save.copy(battle = b, last = b)
        store.write(save)
        return null
    }

    /** Sim thread: rebuilds a saved battle from the core's own log with `resume`. */
    private fun replay(b: SavedBattle): String? {
        val fac = factory ?: return Text.t("errors.not_installed")
        closeGame()
        // A save from another rules version can not replay (core/API.md: rules v3, saves from v2 do not resume).
        SaveCompat.refusal(b.core, coreVersion(), fac.standIn)?.let { return it }
        val g = try { LiveBattle.open(fac, b.setup, b.seed, b.log) } catch (e: Exception) {
            Log.w(TAG, "replay", e)
            return Text.t("errors.saved_fight_damaged")
        }
        game = g
        gameSpec = BattleSpec(b.setup, b.seed, b.kind, b.level, b.seats)
        // Saved in the Rummage: the Battle screen has no Rummage, so the draft ends here (review 2 N-M13).
        g.finishDraft()
        // The replay's events are history: drop them, keep the state and the whole map.
        frame = try { parser.parse(g.snapshot(), keepEvents = false) } catch (e: RuntimeException) {
            Log.w(TAG, "replay snapshot", e)
            closeGame(); return Text.t("errors.saved_fight_cleared")
        }
        lastTurn = frame.hud.turn
        lastResult = frame.result
        hobsAtStart = listOf(frame.hobs.count { it.side == 0 }, frame.hobs.count { it.side == 1 })
        _ui.value = BattleUi.of(frame)
        _aim.value = AimUi.of(frame)
        attach(g, frame)
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

    /** Fire: the button press sound and tap, then the Action (optional dial/target for Android-H5). */
    fun fire(dial: String? = null, target: Pair<Int, Int>? = null, onReply: ((Reply) -> Unit)? = null) {
        if (send(Cmd.fire(dial, target)) { r ->
                onFireReply(r)
                if (r.ok) { pickMendTarget(null); setDial(null) }
                onReply?.invoke(r)
            }) {
            audio.play("ui_fire_press"); buzz(15)
        }
    }

    /** Pass the turn when no Hob can act and no Doodad remains (Android-C2). */
    fun pass(onReply: ((Reply) -> Unit)? = null) {
        if (send(Cmd.PASS) { r -> onReply?.invoke(r) }) { audio.play("ui_tap"); buzz(10) }
    }

    /** Use a Doodad (mend_bucket, or pot_lid with room "kettle" / "nook:N") (Android-H4). */
    fun useDoodad(id: String, room: String? = null, onReply: ((Reply) -> Unit)? = null) {
        val cmd = if (room != null) Cmd.doodadRoom(id, room) else Cmd.doodad(id)
        if (send(cmd) { r ->
                if (!r.ok && !LiveBattle.isDead(r.reason)) {
                    val name = content.shotName(id)
                    val words = when (r.reason) {
                        "nothing_to_mend" -> Text.t("hud.mend.none")
                        "bad_room" -> Text.t("hud.doodad.room_gone")
                        "room_lidded", "lidded" -> Text.t("hud.doodad.room_lidded")
                        "no_room" -> Text.t("hud.doodad.no_room")
                        "used", "already_used" -> Text.t("hud.doodad.used")
                        else -> Text.opt("hud.why.${r.reason}", "shot" to name) ?: Text.t("hud.doodad.not_now", "doodad" to name)
                    }
                    audio.play("ui_denied")
                    showFireNote(words)
                    _announce.tryEmit(words)
                } else if (r.ok) {
                    audio.play("ui_confirm")
                    buzz(15)
                }
                onReply?.invoke(r)
            }) {
            audio.play("ui_tap")
        }
    }

    /** Test Yard only: set wind directly (-10..10) (Android-M11). */
    fun setTestWind(wind: Int) {
        val w = wind.coerceIn(-10, 10)
        if (send(Cmd.setWind(w))) audio.play("ui_tap")
    }

    /**
     * A refused Fire is never ignored (QA playtest 1, M1): the core's `detail` shows by Fire, and
     * when it names a `ready_shot` the pick moves there, so the next tap fires.
     */
    private fun onFireReply(r: Reply) {
        val (words, ready) = FireLight.onRefusal(r) ?: return
        audio.play("ui_denied")
        if (LiveBattle.isDead(r.reason)) return
        showFireNote(words)
        _announce.tryEmit(words)
        if (ready != null && ready != _ui.value.hud.selectedShot) send(Cmd.pickShot(ready))
    }

    /** A tap on grey Fire: say why, fire nothing. */
    fun fireRefusedHere() {
        val words = FireLight.why(_ui.value.hud) ?: return
        audio.play("ui_denied")
        showFireNote(words)
        _announce.tryEmit(words)
    }

    /** Picks a Hob; your Hob may say something. */
    fun pickHob(h: Hob) {
        aimMemory.forget()
        pickMendTarget(null)
        setDial(null)
        send(Cmd.pickHob(h.id))
        audio.play("turn_hob_pick")
        val f = frame
        bark(f, h, "picked")
    }

    /** Give up (07 section 4.9): the core ends the battle (`how: "give_up"`) and pays the loss reward. */
    fun giveUp() {
        paused = false
        handoffTo = -1
        post {
            val g = game ?: return@post
            val r = Reply.parse(g.command(Cmd.giveUp()))
            dirty = true; checkRebuilt()
            // A refused Give up must not leave the player wondering (review 2 N-L20).
            if (!r.ok && !LiveBattle.isDead(r.reason)) ui { notice = Text.t("errors.give_up_failed") }
        }
    }

    /** Main thread only. */
    private val aimMemory = AimMemory()

    /** Aim the selected Hob. Keeps what was sent, so fast Fine Tune steps build on each other (review M9). */
    fun aim(angle: Int, power: Int) {
        val u = _ui.value
        aimMemory.sent(u.hud.turn, u.hud.selectedHob, angle, power)
        send(Cmd.aim(angle, power)) { r -> if (!r.ok) aimMemory.forget() }
    }

    /** Recall a ghost's aim (review 2 N-M4): the next Fine Tune step starts from the recalled aim. */
    fun recall(index: Int) {
        aimMemory.forget()
        if (send(Cmd.recall(index)) { aimMemory.forget() }) audio.play("aim_recall")
    }

    /** The aim to step from: the last one sent this turn for this Hob, else the core's (Android-H1). */
    fun aimBase(u: BattleUi): Pair<Int, Int> {
        if (u.selected == null) return 450 to 50
        val a = _aim.value
        val core = if (a.hob == u.hud.selectedHob) a.angle to a.power
        else frame.selectedHob?.let { it.angle to it.power } ?: (450 to 50)
        return aimMemory.base(u.hud.turn, u.hud.selectedHob, core.first, core.second)
    }

    fun toggleFast() { fast = !fast; fastState = fast; if (fast) { juice.cancelSlow(); post { collapseHoldStart = 0L } } }

    // ---- navigation ------------------------------------------------------

    fun go(to: Screen, remember: Boolean = true) {
        audio.onPlayerAction()
        if (remember && screen != to) back.addLast(screen)
        screen = to
    }

    /** Returns false when there is nowhere to go back to (the activity may finish). */
    fun goBack(): Boolean {
        when (screen) {
            Screen.BATTLE -> {
                if (handoffTo < 0 && _ui.value.phase != Phase.ENDED) {
                    paused = !paused
                    audio.play("ui_sheet_open", semis = if (paused) 0f else -4f)
                }
                return true
            }
            Screen.PRE_BATTLE -> {
                // A Rummage opened here (even after all picks finished into PLAN) but never fought is dropped cleanly (Android-C1).
                if (PreBattleDraft.dropOnBack(_ui.value.live, _ui.value.phase, draftedOnPreBattle)) {
                    draftedOnPreBattle = false
                    post { closeGame(); save = save.copy(battle = null); store.write(save); ui { canResume = false } }
                }
            }
            Screen.RESULTS -> { screen = Screen.MAP; back.clear(); back.addLast(Screen.TITLE); return true }
            Screen.TITLE -> return false
            else -> {}
        }
        screen = back.removeLastOrNull() ?: Screen.TITLE
        return true
    }

    fun openLevel(id: String) {
        val info = levelInfo(id)
        val roster = info?.playerCrew.orEmpty()
        val seats = info?.defaultSeats ?: 4
        preCrew = if (roster.size > seats) roster.take(seats) else emptyList()
        val spec = campaignSpec(id, crew = preCrew.ifEmpty { null })
        preSpec = spec
        preFortNote = null; preUsingCustomFort = false
        validatePreBattleFort(spec, preCrew.size.takeIf { it > 0 } ?: seats)
        if (screen == Screen.RESULTS) { back.clear(); back.addLast(Screen.TITLE); back.addLast(Screen.MAP); go(Screen.PRE_BATTLE, remember = false) }
        else go(Screen.PRE_BATTLE)
    }

    /** A campaign battle with your Help step, Doodads (from app.json), optional Crew/Workshop fort, and progress. */
    fun campaignSpec(
        id: String,
        seed: Long = BattleSpec.newSeed(),
        crew: List<String>? = null,
        rows: List<String>? = null,
    ): BattleSpec {
        val bits = progress[id] ?: 0
        val prog = Progress(bits and 1 != 0, List(3) { bits and (1 shl it) != 0 })
        val doodads = if (content.app.levelAtLeast(id, content.app.doodadsFrom)) content.app.campaignDoodads else null
        return BattleSpec.campaign(id, settings.presetKey, seed, SideOpts(settings.helpKey, rows = rows, crew = crew, doodads = doodads), prog)
    }

    /** Pre-battle Crew selection changed on a campaign level whose roster exceeds fort seats (Android-H6). */
    fun updatePreCrew(levelId: String, crew: List<String>) {
        if (PreBattleDraft.activeHandle(_ui.value.live, _ui.value.phase, draftedOnPreBattle)) return
        preCrew = crew
        val spec = campaignSpec(levelId, preSpec?.seed ?: BattleSpec.newSeed(), crew = crew.ifEmpty { null })
        preSpec = spec
        validatePreBattleFort(spec, crew.size.coerceIn(1, 5))
    }

    fun openSpec(spec: BattleSpec) {
        preCrew = emptyList()
        preSpec = spec
        preFortNote = null; preUsingCustomFort = false
        val seats = levelInfo(spec.level)?.defaultSeats ?: 4
        validatePreBattleFort(spec, seats)
        go(Screen.PRE_BATTLE)
    }

    /** Opens today's Daily Dust-up (Android-M11). */
    fun openDaily() {
        val date = todayDate()
        val seed = NativeCore.dailySeed(date).let { if (it != 0L) it else (date.hashCode().toLong() and 0x7FFF_FFFFL).coerceAtLeast(1L) }
        openSpec(BattleSpec.daily(seed, "d1", settings.presetKey, SideOpts(settings.helpKey), dailyDone))
    }

    /** Replaces the Pre-battle spec in place (a Help change). */
    fun openSpecQuiet(spec: BattleSpec) {
        preSpec = spec
        val seats = preCrew.size.takeIf { it > 0 } ?: (levelInfo(spec.level)?.defaultSeats ?: 4)
        validatePreBattleFort(spec, seats)
    }

    /** Validates the saved Workshop fort against [seats] and wires it into [preSpec] when it stands (Android-H6). */
    private fun validatePreBattleFort(spec: BattleSpec, seats: Int) {
        if (spec.kind == "test_yard" || fort.isEmpty()) {
            preFortNote = null; preUsingCustomFort = false
            return
        }
        val rows = fort
        checkFort(rows, seats) { ck ->
            if (preSpec?.setup != spec.setup) return@checkFort
            if (ck.ok) {
                preSpec = spec.withSide0Rows(rows)
                preUsingCustomFort = true
                preFortNote = null
            } else {
                preUsingCustomFort = false
                preFortNote = Text.t("level_card.fort_too_small")
            }
        }
    }

    fun levelInfo(id: String): LevelInfo? = content.level(id)

    /** Runs [then] at once, or after the player agrees to drop the battle in play. */
    private fun replacingBattle(then: () -> Unit) {
        val draftHere = PreBattleDraft.skipReplaceConfirm(screen == Screen.PRE_BATTLE, _ui.value.live, _ui.value.phase, draftedOnPreBattle)
        if (canResume && !draftHere) {
            confirm = Confirm(Text.t("home.new_fight.title"), Text.t("home.new_fight.body"), Text.t("home.new_fight.yes"), Text.t("home.new_fight.no")) { canResume = false; then() }
        } else then()
    }

    /** Opens the Rummage for the Pre-battle spec (optional: Fight quick-picks it). */
    fun openRummage() {
        val spec = preSpec ?: return
        if (PreBattleDraft.activeHandle(_ui.value.live, _ui.value.phase, draftedOnPreBattle)) return
        audio.play("ui_sheet_open")
        replacingBattle { begin(spec, toBattle = false) }
    }

    /** Fight: enters an already-drafted Pre-battle handle directly, or starts a new battle (Android-C1). */
    fun fight() {
        val spec = preSpec ?: return
        val u = _ui.value
        if (PreBattleDraft.fightUsesExisting(u.live, u.phase, draftedOnPreBattle)) {
            if (PreBattleDraft.needsEndDraft(u.phase)) {
                post { game?.command(Cmd.END_DRAFT); dirty = true; checkRebuilt() }
            }
            draftedOnPreBattle = false
            enterBattle()
            return
        }
        replacingBattle { begin(spec, toBattle = true) }
    }

    private fun begin(spec: BattleSpec, toBattle: Boolean) {
        loading = true
        lastSpec = spec
        settings.seenIntro = true
        post {
            val err = startGame(spec)
            if (err == null && toBattle && frame.phase == Phase.DRAFT) {
                game?.command(Cmd.END_DRAFT); dirty = true; checkRebuilt(); publish()
            }
            ui {
                loading = false
                if (err != null) { notice = err; return@ui }
                canResume = true
                draftedOnPreBattle = !toBattle
                if (toBattle) enterBattle()
            }
        }
    }

    private fun enterBattle() {
        paused = false; handoffTo = -1; draftedOnPreBattle = false
        back.clear(); back.addLast(Screen.TITLE); back.addLast(Screen.MAP)
        screen = Screen.BATTLE
    }

    fun rematch() {
        val spec = lastSpec ?: return
        // Retry: the same seed and the next try as the setup's `attempt`, so the core makes it a new fight
        // under the same rules (QA playtest 1, M6). A campaign rematch also picks up the new progress, Help, crew and fort.
        val again = if (spec.kind == "campaign") {
            campaignSpec(spec.level, spec.seed, crew = preCrew.ifEmpty { null }, rows = if (preUsingCustomFort && fort.isNotEmpty()) fort else null).withAttempt(spec.attempt + 1)
        } else spec.retry()
        preSpec = again
        begin(again, toBattle = true)
    }

    val canRematch: Boolean get() = lastSpec != null

    /** Workshop and the Test Yard open after clearing content/app.json `campaign.modes_after` (Android-L6). */
    val sideModesOpen: Boolean get() = (progress[content.app.modesAfter] ?: 0) and 1 != 0

    /** Carry on: the live battle, or the saved one rebuilt from its log. */
    fun resume() {
        if (_ui.value.live && _ui.value.phase != Phase.ENDED) { enterBattle(); return }
        loading = true
        post {
            val b = save.battle
            val err = if (b == null) Text.t("errors.no_saved_fight") else replay(b)
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

    // ---- Workshop and Test Yard -----------------------------------------------

    /** Sim thread: a battle handle for `validate_blueprint` queries only (they change nothing). */
    private var scratch: games.castleprotect.core.CoreGame? = null

    /** Asks the core whether [rows] stand with [seats] Nooks. [done] runs on the main thread (Android-M8). */
    fun checkFort(rows: List<String>, seats: Int, done: (FortCheck) -> Unit) {
        post {
            val fac = factory
            if (fac == null) { ui { done(FortCheck(false, Text.t("errors.not_installed"))) }; return@post }
            val g = scratch ?: try { fac.newGame(SCRATCH_SETUP, 1).also { scratch = it } } catch (e: CoreException) {
                Log.w(TAG, "fort check", e)
                ui { done(FortCheck(false, Text.t("workshop.problems.check_failed"))) }
                return@post
            }
            val r = try { FortCheck.parse(g.command(Cmd.validateBlueprint(rows, seats))) } catch (e: RuntimeException) { FortCheck(false, Text.t("workshop.problems.check_failed")) }
            ui { done(r) }
        }
    }

    fun saveFort(rows: List<String>) {
        fort = rows
        post { save = save.copy(fort = rows); store.write(save) }
    }

    /** The Test Yard with [rows] (or the level's fort): endless shots at a Dummy side that passes itself. */
    fun startTestYard(rows: List<String>?) {
        val seats = rows?.let { FortGrid.fromRows(it).seats() } ?: 0
        val spec = BattleSpec.testYard("d1", rows, seats)
        preSpec = spec
        replacingBattle { begin(spec, toBattle = true) }
    }

    fun leaveWorkshop() { post { scratch?.close(); scratch = null } }

    /** Couch Duel: the next player took the device. */
    fun handoffReady() { handoffTo = -1 }

    fun showResults() { paused = false; screen = Screen.RESULTS }

    private fun music(to: Screen) {
        when (to) {
            Screen.BATTLE -> audio.battleMusic()
            Screen.RESULTS -> {} // the sting plays, then the map theme on the next screen
            Screen.TITLE -> audio.menuMusic()
            else -> { val quiet = lostLast; lostLast = false; audio.menuMusic(quiet) }
        }
        if (to != Screen.BATTLE) audio.stopLoops()
        post { resetLoops() }
    }

    /** Sim thread: the loops start again from the next frame (after a screen change or a return to the app). */
    private fun resetLoops() { windOn = -1; squallOn = -1; whistleSemis = Float.NaN; rollOn = false }

    /** Any tap anywhere (MainActivity): the first one on a first launch opens the sound (review 2 N-H2). */
    fun firstTap() { if (!audio.unlocked) audio.tap() }

    private fun todayDate(): String = java.time.LocalDate.now().toString()

    companion object {
        /** The Rival's think pause in ms: `hud.think_ms[side]` when the core sent one, else app.json `rival_think_seconds`. */
        fun thinkMs(h: Hud, side: Int, fallback: Long): Long = h.thinkMs.getOrElse(side) { 0 }.takeIf { it > 0 }?.toLong() ?: fallback

        private const val TAG = "CastleSession"
        private const val FRAME_MS = 16L
        private const val COLLAPSE_HOLD_MAX_MS = 2200L
        private const val SCRATCH_SETUP = """{"level":"d1","mode":"test_yard"}"""
    }
}

package games.castleprotect

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.MotionEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.LaunchedEffect
import games.castleprotect.game.GameSession
import games.castleprotect.game.Screen
import games.castleprotect.ui.BattleScreen
import games.castleprotect.ui.CastleTheme
import games.castleprotect.ui.DuelSetupScreen
import games.castleprotect.ui.MapScreen
import games.castleprotect.ui.PreBattleScreen
import games.castleprotect.ui.ResultsScreen
import games.castleprotect.ui.SettingsScreen
import games.castleprotect.ui.SkirmishScreen
import games.castleprotect.ui.TitleScreen

/**
 * One activity. It handles orientation and size changes itself (see the manifest),
 * so a turn of the device is a relayout in one frame and never a restart. All game
 * state lives in GameSession (a ViewModel) and in the core.
 */
class MainActivity : ComponentActivity() {
    private val session: GameSession by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        volumeControlStream = android.media.AudioManager.STREAM_MUSIC
        setContent {
            // Rotation: Follow device (and the system lock), Stay wide, Stay tall.
            LaunchedEffect(session.settings.rotation) {
                requestedOrientation = when (session.settings.rotation) {
                    1 -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    2 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    else -> ActivityInfo.SCREEN_ORIENTATION_USER
                }
            }
            // Keep the screen on only while a battle is on screen and running (review L6).
            val awake = session.screen == Screen.BATTLE && !session.paused
            LaunchedEffect(awake) {
                if (awake) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            CastleTheme(session.settings.textScale) {
                BackHandler(enabled = session.screen != Screen.TITLE) { session.goBack() }
                when (session.screen) {
                    Screen.TITLE -> TitleScreen(session)
                    Screen.MAP -> MapScreen(session)
                    Screen.PRE_BATTLE -> PreBattleScreen(session)
                    Screen.BATTLE -> BattleScreen(session)
                    Screen.RESULTS -> ResultsScreen(session)
                    Screen.SKIRMISH -> SkirmishScreen(session)
                    Screen.DUEL_SETUP -> DuelSetupScreen(session)
                    Screen.SETTINGS -> SettingsScreen(session)
                    Screen.WORKSHOP -> games.castleprotect.ui.WorkshopScreen(session)
                }
                // A note (a refused start, a dropped move, a refused Give up) shows on every screen, not only the Title (review 2 N-L9).
                if (session.screen != Screen.TITLE) session.notice?.let { n -> games.castleprotect.ui.NoticeBar(n) { session.notice = null } }
                session.confirm?.let { c ->
                    AlertDialog(
                        onDismissRequest = { session.confirm = null },
                        title = { Text(c.title) },
                        text = { Text(c.text) },
                        confirmButton = { TextButton({ session.confirm = null; c.action() }) { Text(c.yes) } },
                        dismissButton = { TextButton({ session.confirm = null }) { Text(c.no) } },
                    )
                }
            }
        }
    }

    /** The first tap anywhere opens the sound on a first launch (review 2 N-H2), whichever button it lands on. */
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) session.firstTap()
        return super.dispatchTouchEvent(ev)
    }

    override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
        session.firstTap()
        return super.onKeyDown(keyCode, event)
    }

    override fun onTrimMemory(level: Int) { super.onTrimMemory(level); session.onTrimMemory(level) }

    override fun onStart() {
        super.onStart()
        session.onStart()
        // TalkBack activates buttons without a touch event: its users get sound from the start.
        if (getSystemService(android.view.accessibility.AccessibilityManager::class.java)?.isTouchExplorationEnabled == true) session.firstTap()
    }

    // Calls, alerts, app switches, lock screen: the sim stops and the battle is saved.
    override fun onStop() { session.onStop(); super.onStop() }
}

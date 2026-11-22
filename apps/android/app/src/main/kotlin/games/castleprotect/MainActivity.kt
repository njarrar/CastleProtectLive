package games.castleprotect

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
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
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
                }
            }
        }
    }

    override fun onStart() { super.onStart(); session.onStart() }

    // Calls, alerts, app switches, lock screen: the sim stops and the battle is saved.
    override fun onStop() { session.onStop(); super.onStop() }
}

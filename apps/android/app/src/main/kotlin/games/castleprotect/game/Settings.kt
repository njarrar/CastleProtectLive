package games.castleprotect.game

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.reflect.KProperty

/** Player settings. Every change applies at once and is written straight to disk. */
class Settings(ctx: Context) {
    private val sp: SharedPreferences = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var sound by int("sound", 80)
    var muteAll by bool("mute", false)
    var haptics by int("haptics", 2)            // 0 off, 1 light, 2 full
    var rotation by int("rotation", 0)          // 0 follow device, 1 stay wide, 2 stay tall
    var pointMode by bool("point_mode", false)  // false: pull-back, true: point
    var quickFire by bool("quick_fire", false)
    var leftHand by bool("left_hand", false)
    var tapOnly by bool("tap_only", false)
    var rival2x by bool("rival_2x", false)
    var preset by int("preset", 1)              // 0 cozy, 1 fair, 2 stubborn
    var reduceMotion by bool("reduce_motion", false)
    var textSize by int("text_size", 1)         // 0 small, 1 normal, 2 large
    var seenIntro by bool("seen_intro", false)

    val presetKey: String get() = listOf("cozy", "fair", "stubborn")[preset.coerceIn(0, 2)]
    val textScale: Float get() = listOf(0.9f, 1f, 1.2f)[textSize.coerceIn(0, 2)]

    private fun int(key: String, def: Int) = Pref(mutableStateOf(sp.getInt(key, def))) { sp.edit().putInt(key, it).apply() }
    private fun bool(key: String, def: Boolean) = Pref(mutableStateOf(sp.getBoolean(key, def))) { sp.edit().putBoolean(key, it).apply() }

    class Pref<T>(private val state: androidx.compose.runtime.MutableState<T>, private val write: (T) -> Unit) {
        operator fun getValue(thisRef: Any?, p: KProperty<*>): T = state.value
        operator fun setValue(thisRef: Any?, p: KProperty<*>, v: T) { state.value = v; write(v) }
    }
}

# Mac Mini Playtest Brief

Paste this into a coding agent session that runs on the Mac mini, opened in a folder on the 1 TB external drive.

## Storage rule
Keep every file, install, cache and SDK on the external drive. Do not write to internal storage.
1. Run `df -h /Volumes/*` and confirm the external drive path (call it `$EXT`). Stop and ask if the drive is missing or is exFAT.
2. Work only under `$EXT/CastleProtect`.
3. Before any big install, show free space on both drives and wait for an OK.
4. Point tool homes at the drive:
   - `export ANDROID_HOME=$EXT/android-sdk`, `export ANDROID_AVD_HOME=$EXT/android-avd`, `export ANDROID_USER_HOME=$EXT/.android`
   - `export GRADLE_USER_HOME=$EXT/.gradle`, `export npm_config_cache=$EXT/.npm`
5. iPhone apps from the App Store and anything in /Applications go to internal storage. Ask before installing those.

## Task
1. Clone https://github.com/njarrar/CastleProtect into `$EXT/CastleProtect` and check out branch `castle-protect-plan`. Read `docs/BRIEF.md` and `docs/research/`.
2. iPhone apps on Mac (Apple chip only): check the Mac App Store, "iPhone & iPad Apps", for Castle Busters (id6746328263) and Pocket Tanks (id311544087). If allowed, ask the owner to install them, then play.
3. If not allowed: install Android command line tools to `$ANDROID_HOME`, create an emulator with a Google Play image (arm64), and ask the owner to sign in to Google Play and install Castle Busters and Pocket Tanks.
4. Play each game for at least 30 minutes: several matches, every unit and weapon you can reach, menus, upgrades, shop, a loss and a win. Take 10 to 20 screenshots each.
5. Save screenshots to `docs/research/screens/played/<game>/` (under 300KB each) and write `docs/research/02e-hands-on-playtest.md`: what you did, turn flow, controls feel on touch, timing, castle and unit behavior, weapons, economy, ads and timers met, fun moments, pain points, and answers to the open questions in `docs/research/02b-castle-clashers-deep-dive.md` section 18.
6. Commit as njarrar and push to `castle-protect-plan`. Keep commit messages plain.

Style: plain short words, active voice, no em dashes.

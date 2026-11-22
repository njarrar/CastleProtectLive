# Release and builds

All builds run on GitHub Actions. A change is done when its run is green. This page says where to find each build, how to turn on GitHub Pages, and how to add signing later for TestFlight and Play internal testing.

## Workflows

| Workflow | Runner | Runs when these change | Output |
|---|---|---|---|
| `core.yml` | ubuntu | `core/`, `content/` | fmt, clippy (`-D warnings`), `cargo test` |
| `web.yml` | ubuntu | `core/`, `content/`, `assets/`, `apps/web/` | `web-dist` artifact, Pages deploy |
| `android.yml` | ubuntu | `core/`, `content/`, `assets/`, `apps/android/` | `castle-protect-debug-apk` artifact |
| `ios.yml` | macos | `core/`, `content/`, `assets/`, `apps/ios/` | `castle-protect-ios-simulator-app` artifact |
| `determinism.yml` | ubuntu, macos | `core/`, `content/`, `scripts/` | Pass or fail on golden hashes |

Each workflow also runs on any change to its own file or its scripts, and can be started by hand from the Actions tab ("Run workflow"). If a folder does not exist yet, the job skips with a notice and stays green.

Pinned versions live at the top of each workflow (`RUST_VERSION`, `NDK_VERSION`, `WASM_BINDGEN_VERSION`). A `core/rust-toolchain.toml`, if added, wins over `RUST_VERSION`. `core/Cargo.lock` wins over `WASM_BINDGEN_VERSION`, since the CLI must match the crate.

## Get a build

1. Open the repo on GitHub, then **Actions**.
2. Pick the workflow (web, android or ios) and the latest green run on your branch.
3. Scroll to **Artifacts** at the bottom of the run page and download.

Artifacts are kept for 90 days on the default setting. With the GitHub CLI: `gh run download --name castle-protect-debug-apk`.

### Android APK

Artifact `castle-protect-debug-apk` holds `app-debug.apk`. Install on a phone with USB debugging on: `adb install -r app-debug.apk`. Or copy it to the phone and open it (allow installs from that app when asked). It is signed with the debug key, so it cannot go to Play.

### iOS simulator app

Artifact `castle-protect-ios-simulator-app` holds `CastleProtect-simulator.app.zip`. It runs only in the iOS Simulator on a Mac, not on a real iPhone:

```
unzip CastleProtect-simulator.app.zip
xcrun simctl boot "iPhone 16"      # any iPhone simulator you have
open -a Simulator
xcrun simctl install booted CastleProtect.app
xcrun simctl launch booted <bundle id from project.yml>
```

Or drag the `.app` onto a running simulator window. A real device build needs signing (below).

### Web build

Artifact `web-dist` is the built `apps/web/dist`, made with base path `/CastleProtect/`. To try it locally, put it in a folder of that name and serve the parent: `mkdir -p site && cp -R dist site/CastleProtect && npx serve site`, then open `/CastleProtect/`. It must be served over HTTP, not opened as a file, because the Wasm core loads with fetch. For another host at its root, rebuild with `VITE_BASE=/ npm run build`.

When Pages is on, the live site is at `https://<owner>.github.io/CastleProtect/`, and the deploy job's run page links to it.

## Turn on GitHub Pages

1. **Settings, Pages.** Under "Build and deployment", set **Source** to **GitHub Actions**.
2. **Settings, Environments, github-pages.** Under "Deployment branches and tags", add `castle-protect-plan` (and keep `main`). By default only the default branch may deploy.
3. Push, or run `web.yml` by hand.

Pages on a **private** repo needs a paid plan (Pro, Team or Enterprise). On a free plan the deploy job fails. That job is set to `continue-on-error`, so the run stays green and the `web-dist` artifact is the fallback.

The site is served under `/CastleProtect/`. The workflow sets `VITE_BASE=/CastleProtect/` for the build, which `apps/web/vite.config.ts` reads as its `base`. Note the `web-dist` artifact is built with that base too, so to serve it at the root of another host, rebuild with `VITE_BASE=/`.

## Paths the scripts use

The web, Android and iOS apps read the core from these places. Each can be changed with an env var.

| Script | Default output | Env override |
|---|---|---|
| `scripts/build-wasm.sh` | `core/castle-wasm/pkg/` (wasm-bindgen `--target web`), which the Vite build copies to `public/core` | `WASM_OUT_DIR`, `--out`, `--target` |
| `scripts/build-android-libs.sh` | `apps/android/app/src/main/jniLibs/<abi>/libcastle_ffi.so` | `JNI_LIBS_DIR`, `ANDROID_ABIS`, `ANDROID_API` (26) |
| `scripts/build-xcframework.sh` | `apps/ios/Frameworks/CastleCore.xcframework` (Swift module `CastleCoreFFI`) | `XCFRAMEWORK_OUT`, `FFI_MODULE` |
| `scripts/setup-rust.sh` | installs the pinned toolchain plus targets | `RUST_VERSION` |

Local use is the same as CI, for example `scripts/build-wasm.sh --dev`. Android needs `ANDROID_NDK_HOME` set to NDK r27 or newer. The XCFramework needs a Mac with Xcode. Generated outputs should be in each app's `.gitignore`.

`castle-ffi` must list both `staticlib` (iOS) and `cdylib` (Android) in `crate-type`. `castle-wasm` must be a `cdylib`.

## Determinism gate

`determinism.yml` runs the golden replays on Linux x86_64, macOS arm64 and Wasm under Node, then diffs the hashes. The contract with `core/`:

- The `castle-core` test whose name contains `golden` writes one line per replay, `<replay name> <hash>`, to the file in `CASTLE_GOLDEN_OUT` when that variable is set (`scripts/run-golden.sh`).
- `castle-wasm` exports `golden_hashes()`, returning the same lines (`scripts/golden-wasm.mjs`).

Until both exist, the compare step skips with a notice.

## Signing secrets (add later)

Add secrets in **Settings, Secrets and variables, Actions**. Better: create an environment named `release` (Settings, Environments), add the secrets there, and require a reviewer, so only approved runs can sign. Never commit keys or profiles.

### Apple (TestFlight)

Needs a paid Apple Developer account and the app record in App Store Connect.

| Secret | What it is |
|---|---|
| `APPLE_TEAM_ID` | 10 character team ID (developer.apple.com, Membership) |
| `APPLE_CERTIFICATE_P12_BASE64` | Apple Distribution certificate with its private key, exported from Keychain as `.p12`, then `base64 -i cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password set when exporting the `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile for the bundle ID, `base64 -i profile.mobileprovision` |
| `KEYCHAIN_PASSWORD` | Any random string, used for a temporary keychain on the runner |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID from App Store Connect, Users and Access, Integrations, App Store Connect API |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID shown on the same page |
| `APP_STORE_CONNECT_API_KEY_P8_BASE64` | The downloaded `AuthKey_<id>.p8`, base64 encoded (App Manager role is enough) |

Then uncomment the `archive` job at the bottom of `.github/workflows/ios.yml`. It builds the XCFramework, archives a Release build, exports an IPA and uploads it to TestFlight. Set the bundle ID and `CODE_SIGN_IDENTITY` / profile name in `apps/ios/project.yml` for the Release config. fastlane `match` can replace the certificate and profile secrets later.

### Google (Play internal testing)

Needs a Play Console account and the app created there. The first upload of a new app must be done by hand in the console; after that CI can upload.

| Secret | What it is |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Upload keystore, `base64 -w0 upload.jks` (create with `keytool -genkeypair -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias, for example `upload` |
| `ANDROID_KEY_PASSWORD` | Key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | JSON key of a Google Cloud service account invited in Play Console, Users and permissions, with release rights for this app |

Use Play App Signing (Google holds the app signing key; we keep only the upload key). Then add a job to `android.yml` that decodes the keystore to `$RUNNER_TEMP`, passes the values to Gradle as properties for a `release` signing config, runs `./gradlew bundleRelease`, and uploads the `.aab` to the `internal` track with Gradle Play Publisher or fastlane `supply`.

Keep a backup of the upload keystore and its passwords outside GitHub. If it is lost, Play support has to reset the upload key.

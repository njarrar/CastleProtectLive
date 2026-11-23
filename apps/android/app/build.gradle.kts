plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Repo layout: apps/android/app -> ../../.. is the repo root.
val repoRoot = rootDir.resolve("../..").canonicalFile
val coreHeader = repoRoot.resolve("core/castle-ffi/include/castle_core.h")
val jniLibsDir = projectDir.resolve("src/main/jniLibs")

// The JNI shim (src/main/cpp/castle_jni.c) is built only when the core is really there:
// the C header exists, it declares the cp_* functions the shim calls (core/API.md), and
// libcastle_ffi.so is in jniLibs (scripts/build-android-libs.sh, run by CI).
//
// Without it a DEBUG build still assembles and runs on the fixture player (src/debug).
// A RELEASE build fails, and so does any build with -Pcastle.requireNative=true (CI sets
// it whenever it built the core), so a missing or stale core can never ship quietly.
val shimSymbols = listOf("cp_new", "cp_command", "cp_step", "cp_snapshot", "cp_last_error", "cp_version", "cp_daily_seed", "cp_free_string", "cp_free")
val coreLibAbis = listOf("arm64-v8a", "armeabi-v7a", "x86_64").filter { jniLibsDir.resolve("$it/libcastle_ffi.so").isFile }
val headerText = if (coreHeader.isFile) coreHeader.readText() else ""
val missingSymbols = shimSymbols.filter { !Regex("\\b$it\\s*\\(").containsMatchIn(headerText) }
val nativeCore = coreHeader.isFile && missingSymbols.isEmpty() && coreLibAbis.isNotEmpty()
val requireNative = providers.gradleProperty("castle.requireNative").map { it.toBoolean() }.getOrElse(false)
val nativeWhy = when {
    nativeCore -> ""
    !coreHeader.isFile -> "no core/castle-ffi/include/castle_core.h"
    missingSymbols.isNotEmpty() -> "castle_core.h lacks ${missingSymbols.joinToString()} (update src/main/cpp/castle_jni.c)"
    else -> "no libcastle_ffi.so in app/src/main/jniLibs (run scripts/build-android-libs.sh)"
}
if (!nativeCore) {
    if (requireNative) throw GradleException("Castle Protect: the native core is required (-Pcastle.requireNative) but missing: $nativeWhy")
    logger.warn("Castle Protect: building WITHOUT the native core: $nativeWhy. Debug builds use the fixture player; release builds will fail.")
}

val appIconSrc = repoRoot.resolve("assets/sprites/app_icon-192.png")

android {
    namespace = "games.castleprotect"
    compileSdk = 36

    defaultConfig {
        applicationId = "games.castleprotect"
        minSdk = 26          // Android 8
        targetSdk = 36
        versionCode = providers.gradleProperty("castle.versionCode").map { it.toInt() }.getOrElse(1)
        versionName = "0.2.0"
        // The launcher icon comes from the shared art when it is there, else from the vector in res/.
        manifestPlaceholders["appIcon"] = if (appIconSrc.isFile) "@mipmap/ic_launcher_art" else "@mipmap/ic_launcher"
        if (nativeCore) {
            ndk { abiFilters += coreLibAbis }
            externalNativeBuild {
                cmake {
                    arguments += listOf("-DCASTLE_CORE_INCLUDE=${coreHeader.parentFile.absolutePath}", "-DCASTLE_JNILIBS=${jniLibsDir.absolutePath}")
                    // 16 KB page support for the shim; the Rust libs are linked the same way by CI.
                    arguments += "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
                }
            }
        }
    }

    if (nativeCore) {
        ndkVersion = providers.gradleProperty("castle.ndkVersion").getOrElse("28.2.13676358")
        externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt"); version = "3.22.1" } }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
    sourceSets["main"].apply {
        kotlin.srcDir("src/main/kotlin")
        assets.srcDir(layout.buildDirectory.dir("generated/castleAssets"))
        res.srcDir(layout.buildDirectory.dir("generated/castleRes"))
    }
    sourceSets["debug"].apply {
        kotlin.srcDir("src/debug/kotlin")
        assets.srcDir(layout.buildDirectory.dir("generated/castleFixtures"))
    }
    sourceSets["release"].kotlin.srcDir("src/release/kotlin")
    sourceSets["test"].kotlin.srcDir("src/test/kotlin")
    testOptions { unitTests.all { it.systemProperty("castle.repoRoot", repoRoot.absolutePath); providers.gradleProperty("castle.hostJni").orNull?.let { d -> it.systemProperty("castle.hostJni", d); it.systemProperty("java.library.path", d) } } }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    // SoundPool and MediaPlayer read audio straight from the APK: keep it stored, not deflated.
    androidResources { noCompress += listOf("ogg", "m4a") }
    lint { abortOnError = true; checkReleaseBuilds = false; warningsAsErrors = false }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

// The release build must carry the real core.
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst { if (!nativeCore) throw GradleException("Castle Protect: a release build needs the native core: $nativeWhy") }
}

// Sprites and audio come from the shared assets/ folder at the repo root. They are
// copied at build time, never checked in twice. When a --v2 single-page trimmed/deduped
// atlas is present (assets/atlas/castle@2x.json with "v2": true), we pack that atlas plus
// non-atlas bg/terrain sprites; otherwise we pack the legacy individual @2x PNGs.
val atlasV2Index = repoRoot.resolve("assets/atlas/castle@2x.json")
val useV2Atlas = atlasV2Index.isFile && Regex("\"v2\"\\s*:\\s*true").containsMatchIn(atlasV2Index.readText())
val copyCastleAssets by tasks.registering(Sync::class) {
    from(repoRoot.resolve("assets")) {
        // Sprites at @2x (or --v2 atlas), the animation list, and the audio: Opus (.ogg) for
        // Android 10 and up, AAC (.m4a) for older phones that can not play Opus in Ogg.
        if (useV2Atlas) {
            include(
                "manifest.json", "animations.json",
                "atlas/castle@2x*.json", "atlas/castle@2x*.png",
                "sprites/bg_*@2x.png", "sprites/terrain_*@2x.png",
                "audio/audio.json", "audio/barks.json", "audio/**/*.ogg", "audio/**/*.m4a",
            )
        } else {
            include("manifest.json", "animations.json", "sprites/*@2x.png", "audio/audio.json", "audio/barks.json", "audio/**/*.ogg", "audio/**/*.m4a")
        }
        exclude("sprites/app_icon*")
    }
    // Every line a player reads (text.json), names and cards (shots, hobs, classes, doodads, materials),
    // levels, app.json and blueprints.json, from the shared content folder.
    from(repoRoot.resolve("content")) {
        include("levels/*.json", "text.json", "shots.json", "hobs.json", "classes.json", "doodads.json", "materials.json", "app.json", "blueprints.json")
        into("content")
    }
    into(layout.buildDirectory.dir("generated/castleAssets"))
}
// Debug only: the golden snapshots the fixture player replays.
val copyCastleFixtures by tasks.registering(Sync::class) {
    from(repoRoot.resolve("core/fixtures")) { include("*.json"); into("fixtures") }
    into(layout.buildDirectory.dir("generated/castleFixtures"))
}
val copyCastleIcon by tasks.registering(Sync::class) {
    from(appIconSrc) { rename { "ic_launcher_art.png" } }
    into(layout.buildDirectory.dir("generated/castleRes/mipmap-xxxhdpi"))
}
tasks.named("preBuild") { dependsOn(copyCastleAssets, copyCastleIcon, copyCastleFixtures) }

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.09.00")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}

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
// the C header exists, it declares the functions the shim calls, and CI has put
// libcastle_ffi.so into jniLibs with cargo-ndk. Otherwise the APK ships without native
// code and the app runs on the Kotlin stand-in core, so ./gradlew assembleDebug always works.
val shimSymbols = listOf("castle_new", "castle_free", "castle_command", "castle_advance", "castle_snapshot", "castle_query", "castle_save", "castle_load", "castle_string_free")
val coreLibAbis = listOf("arm64-v8a", "armeabi-v7a", "x86_64").filter { jniLibsDir.resolve("$it/libcastle_ffi.so").isFile }
val headerText = if (coreHeader.isFile) coreHeader.readText() else ""
val missingSymbols = shimSymbols.filter { !Regex("\\b$it\\s*\\(").containsMatchIn(headerText) }
val nativeCore = coreHeader.isFile && missingSymbols.isEmpty() && coreLibAbis.isNotEmpty()
if (!nativeCore) {
    val why = when {
        !coreHeader.isFile -> "no core/castle-ffi/include/castle_core.h"
        missingSymbols.isNotEmpty() -> "castle_core.h lacks ${missingSymbols.joinToString()} (update src/main/cpp/castle_jni.c)"
        else -> "no libcastle_ffi.so in app/src/main/jniLibs (run scripts/build-android-libs.sh)"
    }
    logger.warn("Castle Protect: building WITHOUT the native core: $why. The app will use the stand-in core.")
}

val appIconSrc = repoRoot.resolve("assets/sprites/app_icon-192.png")

android {
    namespace = "games.castleprotect"
    compileSdk = 36

    defaultConfig {
        applicationId = "games.castleprotect"
        minSdk = 26          // Android 8
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
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
        externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }
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
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    lint { abortOnError = false; checkReleaseBuilds = false }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

// Sprites and audio come from the shared assets/ folder at the repo root. They are
// copied at build time, never checked in twice. Only the @2x PNGs ship (drawn scaled),
// plus the manifest and any audio. A missing folder is fine: the renderer falls back to shapes.
val copyCastleAssets by tasks.registering(Sync::class) {
    from(repoRoot.resolve("assets")) {
        include("manifest.json", "sprites/*@2x.png", "audio/**")
        exclude("sprites/app_icon*")
    }
    into(layout.buildDirectory.dir("generated/castleAssets"))
}
val copyCastleIcon by tasks.registering(Sync::class) {
    from(appIconSrc) { rename { "ic_launcher_art.png" } }
    into(layout.buildDirectory.dir("generated/castleRes/mipmap-xxxhdpi"))
}
tasks.named("preBuild") { dependsOn(copyCastleAssets, copyCastleIcon) }

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.09.00")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.4")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}

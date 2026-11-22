# JNI shim between Kotlin (games.castleprotect.core.NativeCore) and the Rust core's C ABI.
# Built only when app/build.gradle.kts finds the header and the cargo-ndk output.
cmake_minimum_required(VERSION 3.22.1)
project(castle_jni C)

add_library(castle_ffi SHARED IMPORTED)
set_target_properties(castle_ffi PROPERTIES IMPORTED_LOCATION "${CASTLE_JNILIBS}/${ANDROID_ABI}/libcastle_ffi.so")

add_library(castle_jni SHARED castle_jni.c)
target_include_directories(castle_jni PRIVATE "${CASTLE_CORE_INCLUDE}")
target_compile_options(castle_jni PRIVATE -Wall -Wextra -Os)
target_link_libraries(castle_jni castle_ffi log)
target_link_options(castle_jni PRIVATE "-Wl,-z,max-page-size=16384")

# JNI shim between Kotlin (games.castleprotect.core.CoreJni) and the Rust core's C ABI.
# Built only when app/build.gradle.kts finds the header and the cargo-ndk output.
cmake_minimum_required(VERSION 3.22.1)
project(castle_jni C)

add_library(castle_ffi SHARED IMPORTED)
# IMPORTED_NO_SONAME: link by bare file name, so DT_NEEDED is "libcastle_ffi.so" and
# never the CI build path, whatever the Rust toolchain does about SONAME.
set_target_properties(castle_ffi PROPERTIES
    IMPORTED_LOCATION "${CASTLE_JNILIBS}/${ANDROID_ABI}/libcastle_ffi.so"
    IMPORTED_NO_SONAME ON)

add_library(castle_jni SHARED castle_jni.c)
target_include_directories(castle_jni PRIVATE "${CASTLE_CORE_INCLUDE}")
target_compile_options(castle_jni PRIVATE -Wall -Wextra -Werror -Os)
target_link_libraries(castle_jni castle_ffi)
target_link_options(castle_jni PRIVATE "-Wl,-z,max-page-size=16384")

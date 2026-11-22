/*
 * JNI shim: Kotlin NativeCore <-> the Rust core's C ABI (core/castle-ffi/include/castle_core.h).
 * No game logic lives here. Strings cross as UTF-8 JSON.
 *
 * Expected C ABI (checked by app/build.gradle.kts before this file is compiled):
 *   CastleCore* castle_new(void);
 *   void        castle_free(CastleCore*);
 *   char*       castle_command(CastleCore*, const char* json);   // reply JSON, free with castle_string_free
 *   void        castle_advance(CastleCore*, uint32_t ms);
 *   char*       castle_snapshot(CastleCore*);
 *   char*       castle_query(CastleCore*, const char* json);
 *   char*       castle_save(CastleCore*);
 *   int/bool    castle_load(CastleCore*, const char* data);
 *   void        castle_string_free(char*);
 */
#include <jni.h>
#include <stdint.h>
#include <stddef.h>
#include "castle_core.h"

#define CORE(h) ((CastleCore *)(intptr_t)(h))
#define FN(name) Java_games_castleprotect_core_NativeCore_##name
#define FNC(name) Java_games_castleprotect_core_NativeCore_00024Companion_##name

/* Rust hands back standard UTF-8; NewStringUTF wants modified UTF-8, so build the String from bytes. */
static jstring take_string(JNIEnv *env, char *s) {
    if (s == NULL) return NULL;
    size_t n = 0;
    while (s[n] != 0) n++;
    jstring out = NULL;
    jbyteArray bytes = (*env)->NewByteArray(env, (jsize)n);
    if (bytes != NULL) {
        (*env)->SetByteArrayRegion(env, bytes, 0, (jsize)n, (const jbyte *)s);
        jclass cls = (*env)->FindClass(env, "java/lang/String");
        jmethodID ctor = (*env)->GetMethodID(env, cls, "<init>", "([BLjava/lang/String;)V");
        jstring utf8 = (*env)->NewStringUTF(env, "UTF-8");
        out = (jstring)(*env)->NewObject(env, cls, ctor, bytes, utf8);
        (*env)->DeleteLocalRef(env, utf8);
        (*env)->DeleteLocalRef(env, cls);
        (*env)->DeleteLocalRef(env, bytes);
    }
    castle_string_free(s);
    return out;
}

/* Kotlin strings here are JSON or save text without embedded NULs or supplementary-plane
 * characters outside string escapes, so modified UTF-8 equals UTF-8 for them. */
#define WITH_UTF(jstr, cvar, body) \
    do { const char *cvar = (*env)->GetStringUTFChars(env, jstr, NULL); \
         if (cvar != NULL) { body; (*env)->ReleaseStringUTFChars(env, jstr, cvar); } } while (0)

JNIEXPORT jlong JNICALL FN(nativeNew)(JNIEnv *env, jclass cls) {
    (void)env; (void)cls;
    return (jlong)(intptr_t)castle_new();
}
JNIEXPORT jlong JNICALL FNC(nativeNew)(JNIEnv *env, jobject self) { return FN(nativeNew)(env, (jclass)self); }

JNIEXPORT jstring JNICALL FN(nativeVersion)(JNIEnv *env, jclass cls) {
    (void)env; (void)cls;
    return NULL;
}
JNIEXPORT jstring JNICALL FNC(nativeVersion)(JNIEnv *env, jobject self) { return FN(nativeVersion)(env, (jclass)self); }

JNIEXPORT void JNICALL FN(nativeFree)(JNIEnv *env, jobject self, jlong h) {
    (void)env; (void)self;
    if (h != 0) castle_free(CORE(h));
}

JNIEXPORT jstring JNICALL FN(nativeCommand)(JNIEnv *env, jobject self, jlong h, jstring json) {
    (void)self;
    char *r = NULL;
    WITH_UTF(json, c, r = (char *)castle_command(CORE(h), c));
    return take_string(env, r);
}

JNIEXPORT void JNICALL FN(nativeAdvance)(JNIEnv *env, jobject self, jlong h, jint ms) {
    (void)env; (void)self;
    castle_advance(CORE(h), (uint32_t)(ms < 0 ? 0 : ms));
}

JNIEXPORT jstring JNICALL FN(nativeSnapshot)(JNIEnv *env, jobject self, jlong h) {
    (void)self;
    return take_string(env, (char *)castle_snapshot(CORE(h)));
}

JNIEXPORT jstring JNICALL FN(nativeQuery)(JNIEnv *env, jobject self, jlong h, jstring json) {
    (void)self;
    char *r = NULL;
    WITH_UTF(json, c, r = (char *)castle_query(CORE(h), c));
    return take_string(env, r);
}

JNIEXPORT jstring JNICALL FN(nativeSave)(JNIEnv *env, jobject self, jlong h) {
    (void)self;
    return take_string(env, (char *)castle_save(CORE(h)));
}

JNIEXPORT jboolean JNICALL FN(nativeLoad)(JNIEnv *env, jobject self, jlong h, jstring data) {
    (void)self;
    jboolean ok = JNI_FALSE;
    WITH_UTF(data, c, ok = castle_load(CORE(h), c) ? JNI_TRUE : JNI_FALSE);
    return ok;
}

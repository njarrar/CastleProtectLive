/*
 * JNI shim: Kotlin games.castleprotect.core.CoreJni <-> the Rust core's C ABI
 * (core/castle-ffi/include/castle_core.h, documented in core/API.md).
 * No game logic lives here.
 *
 * Text crosses as byte arrays of standard UTF-8 in both directions. Kotlin sends
 * NUL terminated UTF-8 (String.toByteArray plus one 0 byte); the shim returns the
 * bytes the core wrote. jstring and GetStringUTFChars are never used, because they
 * carry modified UTF-8, which breaks characters outside the BMP.
 *
 * Every char* the core returns goes back through cp_free_string on every path.
 * Every JNI call that can fail is checked; on failure a Java exception is left
 * pending (OutOfMemoryError from the VM) and NULL or 0 is returned.
 */
#include <jni.h>
#include <stdint.h>
#include <string.h>
#include "castle_core.h"

#define GAME(h) ((CpGame *)(intptr_t)(h))
#define FN(name) Java_games_castleprotect_core_CoreJni_##name

/* Copies a core string into a new byte[] and frees it. NULL in gives NULL out. */
static jbyteArray take_bytes(JNIEnv *env, char *s) {
    if (s == NULL) return NULL;
    size_t n = strlen(s);
    jbyteArray out = NULL;
    if (n <= 0x7fffffff) {
        out = (*env)->NewByteArray(env, (jsize)n);
        if (out != NULL) {
            (*env)->SetByteArrayRegion(env, out, 0, (jsize)n, (const jbyte *)s);
            if ((*env)->ExceptionCheck(env)) {
                (*env)->DeleteLocalRef(env, out);
                out = NULL;
            }
        }
    }
    cp_free_string(s);
    return out;
}

/*
 * Gives a pointer to the NUL terminated UTF-8 in a Kotlin byte[]. The array always
 * ends in a 0 byte (NativeCore adds it); a missing one is treated as a refusal.
 * Release with release_bytes.
 */
static const char *borrow_bytes(JNIEnv *env, jbyteArray arr) {
    if (arr == NULL) return NULL;
    jsize n = (*env)->GetArrayLength(env, arr);
    if (n <= 0) return NULL;
    jbyte *p = (*env)->GetByteArrayElements(env, arr, NULL);
    if (p == NULL) return NULL;
    if (p[n - 1] != 0) {
        (*env)->ReleaseByteArrayElements(env, arr, p, JNI_ABORT);
        return NULL;
    }
    return (const char *)p;
}

static void release_bytes(JNIEnv *env, jbyteArray arr, const char *p) {
    if (p != NULL) (*env)->ReleaseByteArrayElements(env, arr, (jbyte *)p, JNI_ABORT);
}

JNIEXPORT jlong JNICALL FN(nativeNew)(JNIEnv *env, jclass cls, jbyteArray setup, jlong seed) {
    (void)cls;
    const char *s = borrow_bytes(env, setup);
    if (s == NULL) return 0;
    /* NULL content: the content built into the core. */
    CpGame *g = cp_new(NULL, s, (uint64_t)seed);
    release_bytes(env, setup, s);
    return (jlong)(intptr_t)g;
}

JNIEXPORT jbyteArray JNICALL FN(nativeVersion)(JNIEnv *env, jclass cls) {
    (void)cls;
    return take_bytes(env, cp_version());
}

JNIEXPORT jbyteArray JNICALL FN(nativeLastError)(JNIEnv *env, jclass cls, jlong h) {
    (void)cls;
    return take_bytes(env, cp_last_error(GAME(h)));
}

JNIEXPORT jbyteArray JNICALL FN(nativeCommand)(JNIEnv *env, jclass cls, jlong h, jbyteArray json) {
    (void)cls;
    if (h == 0) return NULL;
    const char *s = borrow_bytes(env, json);
    if (s == NULL) return NULL;
    char *r = cp_command(GAME(h), s);
    release_bytes(env, json, s);
    return take_bytes(env, r);
}

JNIEXPORT jbyteArray JNICALL FN(nativeStep)(JNIEnv *env, jclass cls, jlong h, jint ticks) {
    (void)cls;
    if (h == 0) return NULL;
    return take_bytes(env, cp_step(GAME(h), ticks < 0 ? 0 : (int32_t)ticks));
}

JNIEXPORT jbyteArray JNICALL FN(nativeSnapshot)(JNIEnv *env, jclass cls, jlong h) {
    (void)cls;
    if (h == 0) return NULL;
    return take_bytes(env, cp_snapshot(GAME(h)));
}

JNIEXPORT void JNICALL FN(nativeFree)(JNIEnv *env, jclass cls, jlong h) {
    (void)env; (void)cls;
    if (h != 0) cp_free(GAME(h));
}

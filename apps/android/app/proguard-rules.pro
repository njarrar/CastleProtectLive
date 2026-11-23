# JNI entry points are looked up by name (app/src/main/cpp/castle_jni.c).
-keep class games.castleprotect.core.CoreJni {
    native <methods>;
}
-keepclasseswithmembernames class games.castleprotect.core.CoreJni {
    native <methods>;
}

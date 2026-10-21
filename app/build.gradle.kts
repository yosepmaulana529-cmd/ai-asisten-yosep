plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.yosep.aiassistant"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.yosep.aiassistant"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
}

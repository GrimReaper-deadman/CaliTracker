#!/bin/bash
set -e

# Config
PROJECT_DIR="/data/data/com.termux/files/home/CaliTrackerApp"
SDK_JAR="/data/data/com.termux/files/home/android.jar"
BUILD_DIR="$PROJECT_DIR/build"
SRC_DIR="$PROJECT_DIR/app/src/main"
RES_DIR="$SRC_DIR/res"
ASSETS_DIR="$SRC_DIR/assets"
MANIFEST="$SRC_DIR/AndroidManifest.xml"
PACKAGE="com.calitracker"
KEYSTORE="/data/data/com.termux/files/home/CowboyApp/debug.keystore"
KEY_ALIAS="androiddebugkey"
KEY_PASS="android"

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/obj" "$BUILD_DIR/dex" "$BUILD_DIR/gen"

echo "1. Linking resources and assets..."
aapt2 link --manifest "$MANIFEST" -I "$SDK_JAR" \
    --java "$BUILD_DIR/gen" \
    -A "$ASSETS_DIR" \
    -o "$BUILD_DIR/app-unsigned.apk" \
    --auto-add-overlay

echo "2. Compiling Java sources..."
JAVA_FILES=$(find "$SRC_DIR/java" "$BUILD_DIR/gen" -name "*.java")
javac -source 1.8 -target 1.8 -d "$BUILD_DIR/obj" -classpath "$SDK_JAR" $JAVA_FILES

echo "3. Dexing classes..."
CLASS_FILES=$(find "$BUILD_DIR/obj" -name "*.class")
d8 --output "$BUILD_DIR/dex" $CLASS_FILES --lib "$SDK_JAR"

echo "4. Adding classes.dex to APK..."
cp "$BUILD_DIR/app-unsigned.apk" "$BUILD_DIR/app-with-dex.apk"
cd "$BUILD_DIR/dex"
zip -u "$BUILD_DIR/app-with-dex.apk" classes.dex
cd "$PROJECT_DIR"

echo "5. Signing APK..."
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KEY_PASS" --ks-key-alias "$KEY_ALIAS" \
    --out "$PROJECT_DIR/CaliTracker.apk" "$BUILD_DIR/app-with-dex.apk"

echo "Build complete! APK at $PROJECT_DIR/CaliTracker.apk"
ls -l "$PROJECT_DIR/CaliTracker.apk"

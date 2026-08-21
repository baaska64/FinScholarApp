# Widget Update Steps

When making changes to the Android widget configuration (like dimensions or initial layout in `app.json` or `FinScholarWidget.tsx`), the Android Launcher will aggressively cache the old widget size and appearance.

To ensure widget changes apply cleanly on the emulator, run the following steps to completely bypass the Expo CLI polling bugs and clear the Launcher cache:

1. **Uninstall the app via ADB to clear the Launcher cache**
   ```powershell
   & "C:\Users\baskalbo\AppData\Local\Android\Sdk\platform-tools\adb.exe" uninstall com.lalex.finscholar
   ```

2. **Run Gradle assembleDebug manually in the background**
   ```powershell
   cd android
   ./gradlew assembleDebug
   ```

3. **Install the built APK directly via ADB**
   ```powershell
   & "C:\Users\baskalbo\AppData\Local\Android\Sdk\platform-tools\adb.exe" connect 127.0.0.1:5555
   & "C:\Users\baskalbo\AppData\Local\Android\Sdk\platform-tools\adb.exe" -s 127.0.0.1:5555 install -r app\build\outputs\apk\debug\app-debug.apk
   ```

These steps ensure that any ghost emulator ADB connection issues from Expo CLI are avoided and the widget footprint is guaranteed to update.

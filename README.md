# Tower Lighting

An Android lighting-management workspace for architectural building projects. The app combines a 3D building preview and project-specific lighting scenes with an optional Bluetooth Classic connection to an HC-05 controller.

> **Repository scope:** This repository contains the Android platform project and its bundled web assets. It is not a complete Capacitor host workspace.

## Features

- **Lighting workspace:** View an interactive 3D building scene and control lighting for Tower A, Tower B, the landscape, clubhouse, crown, facade, and other scene elements.
- **Scene adjustments:** Configure lighting presets, brightness, and color.
- **Building projects:** Create and switch between projects with separate project details and lighting settings.
- **On-device preferences:** Project data, light states, brightness, colors, and presets are saved in browser storage on the device. They are not synced to an account or server.
- **Offline app shell:** Bundled web assets and a service worker support the app's offline experience.
- **Optional hardware control:** The Android app includes a native Bluetooth Classic SPP/RFCOMM plugin for a paired HC-05 module. The browser/PWA version does not control Bluetooth hardware.

## Hardware controller

The controller integration expects an **HC-05 Bluetooth Classic** module using SPP/RFCOMM at **9600 baud**. It is not Web Bluetooth or BLE.

1. Power the HC-05 and pair it with the Android device in Android Settings. Use the PIN configured on the module; `1234` or `0000` are common defaults.
2. Open the Android app and allow the **Nearby devices** permission when prompted.
3. Select the paired controller in the app's Settings and connect.
4. Send a lighting command and verify that the physical light changes.

An `OK:...` or `STATUS:...` response indicates that the controller accepted a command; it does not by itself confirm that the light changed. If the connection works but the controller does not respond, check the controller firmware, its 9600-baud setting, and the wiring. A controller already connected to another device may also be unavailable.

## Project structure

```text
.
├── app/
│   ├── build.gradle
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── assets/public/       # Bundled HTML, CSS, JavaScript, and vendor assets
│       │   ├── java/                # Android activity and Bluetooth plugin
│       │   └── res/                 # Android resources and launcher/splash assets
│       ├── androidTest/             # Instrumentation test
│       └── test/                    # Unit test
├── app/capacitor.build.gradle
└── build.gradle
```

### Main files

- `app/src/main/assets/public/index.html` — app interface and workspace pages.
- `app/src/main/assets/public/script.js` — project, lighting, and preference behavior.
- `app/src/main/assets/public/building.js` — interactive 3D building scene.
- `app/src/main/assets/public/bluetooth.js` — JavaScript bridge for the native Bluetooth plugin.
- `app/src/main/java/com/towerlightning/app/MainActivity.java` — Capacitor activity and plugin registration.
- `app/src/main/java/com/towerlightning/app/ClassicBluetoothPlugin.java` — Android Bluetooth Classic controller integration.

## Build setup

This repository currently does **not** include the Gradle wrapper, `settings.gradle`, `variables.gradle`, or the Capacitor/Cordova Android dependency modules referenced by the Gradle files. As a result, a fresh clone is not independently buildable as checked in.

To prepare a build, restore the complete Capacitor host project and its dependencies, regenerate/sync the Android platform files from that workspace, and then open the Android project in Android Studio. The Android Gradle configuration targets Java 21; install the matching JDK and Android SDK required by the restored project.

## Third-party assets

The bundled `three.module.js` and GSAP assets are in `app/src/main/assets/public/vendor/`. Refer to `THREE-LICENSE` and `GSAP-NOTICE.txt` in that directory for their respective notices.

## License

No project-level license has been added. Unless a license is provided, the project source remains under its copyright owner's usual rights; the included third-party assets remain subject to their own licenses.

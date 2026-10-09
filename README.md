<div align="center">

<img src="design/launcher-assets/logo.png" width="110" alt="Rt5">

# Rt5 · Male Android Control

**ASFR-oriented, offline control software** for a physical **T31-750 male android** — one shared web front end plus a console app, a robot-side phone app, a Wear OS watch app and a Windows desktop build, linked over a custom BLE GATT protocol **on a local link** (no cloud dependency except the optional speech engine).

[English](README.md) · [简体中文](README.zh-CN.md)

![platform](https://img.shields.io/badge/platform-Android%20%7C%20Wear%20OS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
[![release](https://img.shields.io/github/v/release/rt5r750/Rt5.MaleAndroidControl)](https://github.com/rt5r750/Rt5.MaleAndroidControl/releases)

</div>

> A fictional product, **ASFR-oriented**: a private, local control link for a physical male android. The setting and copy contain adult-oriented content; published for technical reference only.

## Demo

- **Promo film** — <https://x.com/rt5_750/status/2107868637948440956>
- **Downloads** — [Releases](https://github.com/rt5r750/Rt5.MaleAndroidControl/releases): Android console APK, robot-side phone APK, portable Windows build (`.zip`)

## Screenshots

Stills from the promo film; the console and app UIs run in English.

**One console, three screens** — desktop console, mobile console, Wear OS companion.

![One console, three screens](docs/screenshots/ends-overview.jpg)

**Console — desktop** (Windows app / wide browser): live parameters, control pads, code and log panels, parameter sheet.

![Console — desktop](docs/screenshots/console-desktop.jpg)

<img src="docs/screenshots/console-panels.jpg" width="49%" alt="Live subsystem panels">
<img src="docs/screenshots/first-run-setup.jpg" width="49%" alt="First-run setup">

**Console — mobile layout** and the **robot-side phone app** (narrow browser / Android apps).

<img src="docs/screenshots/console-mobile.jpg" width="49%" alt="Console — mobile">
<img src="docs/screenshots/slave-app.jpg" width="49%" alt="Robot-side phone app">

## Ends and layout

| Directory | What it is | Stack |
|---|---|---|
| `www/` | **Single source of truth for the shared front end** (console pages, styles, fonts, dictionaries, assets); every synced copy is generated from here | Plain HTML/CSS/JS (Tailwind pre-compiled, zero runtime CDN) |
| `master-app/` | Console app — WebView shell + BLE GATT server + external-link handling | Kotlin, compileSdk/targetSdk 34, minSdk 31 |
| `slave-app/` | Robot-side app — mode / emotion / task / connection panels, on-device speech recognition by pronunciation matching | Kotlin, minSdk 24 |
| `watch-app/` | Wear OS app — keep-alive foreground service, mode-change haptics, connection state | Kotlin, minSdk 31 |
| `win-app/` | Windows desktop build — Electron main app + C# BLE host + launcher window + splash entry | Electron 43 + Node + .NET 8 |
| `design/` | Launcher UI design and sprite assets | Plain HTML/CSS/Canvas |
| `tools/` | Build helpers: `gen-mono-narrow.py` (condensed Latin face), `web-build` (Tailwind + cache manifest) | Python / Node |
| `docs/` | Development documentation set — entry [`docs/reademe.md`](docs/reademe.md) (Chinese) | Markdown |

## Quick start

**Requirements**: JDK 17, Android SDK (platform 34 / build-tools 34), Node.js 20+, .NET 8 SDK, PowerShell 7, Python 3 (optional, only to regenerate the condensed font, needs `fonttools`).

### Shared front end `www/`

Re-run the static build after changing anything under `www/`:

```bash
cd tools/web-build
npm install
npm run build        # regenerates www/css/tailwind.css and www/cache-manifest.json
```

### Android console / robot-side / watch apps

```bash
cd master-app && ./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
cd slave-app   && ./gradlew assembleRelease
cd watch-app   && ./gradlew assembleRelease
```

`master-app` runs the `syncWww` Gradle task before building, mirroring the repository's `www/` into `app/src/main/assets/www/` (that copy is generated, never committed).

### Windows desktop build

```bash
cd win-app
npm install
npm start                    # dev run (prestart mirrors www → app/www)
npm test                     # node --test; run pwsh scripts/sync-www.ps1 first
npm run dist                 # predist: dotnet publish the BLE host + mirror www, then electron-builder
pwsh scripts/package-with-splash.ps1   # assembles runtime/ and the double-click entry exe
```

Speech synthesis and recognition need a service provider API key entered in the app settings; no key ships with the repository.

## Repository structure (tracked vs. generated)

Only source, docs and assets are tracked. Directories marked ⚙ are produced by scripts and are ignored by git — release artifacts live in [Releases](https://github.com/rt5r750/Rt5.MaleAndroidControl/releases) instead of the repository.

```
Rt5.MaleAndroidControl/
├── www/                              ✔ shared front end (only source of truth)
├── master-app/                      ✔ Kotlin sources
│   └── app/src/main/assets/www/      ⚙ mirrored by the Gradle syncWww task
│   └── app/build/                    ⚙ Gradle output
├── slave-app/  watch-app/            ✔ Kotlin sources (app/build/ is ⚙)
├── win-app/                          ✔ Electron + C# sources (app/, ble-host/*.cs, scripts/, test/)
│   ├── app/www/                      ⚙ mirrored by scripts/sync-www.ps1
│   ├── ble-host/{bin,obj,publish}/   ⚙ dotnet publish output
│   ├── {dist-new,runtime}/           ⚙ electron-builder and packaging output
│   ├── node_modules/                 ⚙ npm install
│   ├── build/icon.ico                ✔ (electron-builder resource)
│   └── huancun/                      ⚙ runtime user data, never published
├── design/                           ✔ launcher design and sprites
├── tools/                            ✔ build helpers
└── docs/                             ✔ documentation set
```

```bash
git ls-files | wc -l            # what is actually tracked
git status --ignored --short    # what stays local only
```

## Documentation

[docs/reademe.md](docs/reademe.md) (index) · [architecture](docs/architecture.md) · [BLE protocol](docs/ble-protocol.md) · [data models](docs/data-models.md) · per-end notes: [master-app](docs/master-app/reademe.md) · [slave-app](docs/slave-app/reademe.md) · [watch-app](docs/watch-app/reademe.md) · [win-app](docs/win-app/reademe.md)

The documentation set is written in Chinese; the code, comments on protocol constants and this README are the English entry points.

## License

[MIT](LICENSE)
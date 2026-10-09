# MACS · User Manual

MACS (Male Android Control System) is the control console for the T31-750 male android. This manual covers every client in the package: the **MACS** console app on Android and Windows, the **Slave** app that runs on the android's own phone, and the Wear OS watch app. It also covers the browser edition and the pairing methods that link them.

> The product is fictional. Many readouts in the console — CPU/GPU/NPU load, remaining artificial semen, storage, system version, self-check and update output — are part of the staged presentation rather than live telemetry. Sections below mark these as simulated.

## Contents

| Chapter | What it covers |
|---|---|
| 1. Clients and roles | Which app does what, and which one you need |
| 2. Installation and first launch | Installing each client, the first-run activation flow |
| 3. Language | Automatic device-language matching and manual switching |
| 4. Connecting the clients | Bluetooth, QR pairing, USB entry, app launching |
| 5. The console | Every panel, button and readout of the main interface |
| 6. Console settings | All settings groups and the configuration file |
| 7. Information panel | Device information, documents and links |
| 8. Slave app | The android's phone client in full |
| 9. Watch app | The Wear OS client |
| 10. Browser edition | Caching, offline use and app launching |
| 11. Troubleshooting | Symptom-by-symptom checks |

---

# 1. Clients and roles

| Client | Where it runs | App name | Role |
|---|---|---|---|
| Master console | Android phone/tablet (Android 12+) | **MACS** | Full control console; advertises Bluetooth so clients can connect |
| Master console | Windows 10/11 desktop | **MACS** | Same console with a desktop launcher and USB entry |
| Slave | Android phone (Android 7.0+) | **Slave** | Carried by the android: shows mode, emotion, tasks and voice messages; can push mode and voice commands back |
| Watch | Wear OS | 750 Receiver | Compact status display worn on the wrist |
| Browser edition | Any modern browser | — | The same console served over the web, with optional full offline caching |

The **Master** distributes state; the **Slave** and **Watch** receive it. The Slave can also send the selected mode back to the Master, either by hand (long-press the mode capsule) or by voice.

**Which do I need?** For control alone, the MACS console is enough. To read the android's state on a separate phone, add the Slave. The watch is optional.

---

# 2. Installation and first launch

## 2.1 First run in one sentence

Every client now opens in **English on first launch**, matches the device language automatically when it can, and walks you through a one-time setup before the main interface appears. Nothing is compulsory — each setup screen has a **Skip and keep defaults** option.

## 2.2 MACS on Android

1. Install the APK and open it. A brand film plays once.
2. When the film ends, the **activation screen** (first-run setup) appears. It is the same form described in section 2.5; on a phone it is a single scrollable page.
3. Fill in whatever you want to personalise, then tap **Get started**; or tap **Skip and keep defaults**.
4. The console opens. The setup screen does not appear again.

> The film plays to the end before the setup screen appears. Tapping the screen skips the film early.

## 2.3 MACS on Windows

1. Unpack the release archive somewhere you can write to, then run `MACS.exe`.
2. On the **first** launch the activation window opens **before the launcher**. Complete it, or close the window to skip.
3. The launcher appears. It waits for the robot's USB device — see section 4.3.
4. Click the device button to enter the console.

On later launches the activation window stays away and the launcher opens directly. To see the first-run flow again, close the app, delete the `huancun` folder next to `MACS.exe`, and start it again.

## 2.4 Slave

1. Install the APK and open it.
2. The first-run screen appears over the interface: choose **中文** or **English**, optionally enter a MiMo API key, and set the cloud-recognition switch.
3. Tap **Get started** or **Skip and keep defaults**.
4. The main interface is revealed and the screen does not return.

## 2.5 The activation form

The console's activation screen is one scrollable page with ten numbered groups. Leave any field empty to keep its default.

| # | Group | Fields |
|---|---|---|
| 1 | **Language** | `中文` / `English` |
| 2 | **Model information** | Full model name, short name, manufacturing company, master, spoken pronunciation |
| 3 | **Account** | Login password and confirmation (leave both empty to keep `admin` / `admin`) |
| 4 | **TTS voice engine** | Engine `白桦音色` / `音色设计`, MiMo API key, link to the MiMo platform |
| 5 | **Android images** | Two image files with previews |
| 6 | **Mode names** | Rename the four modes |
| 7 | **Information-panel links** | Name and URL for each link entry |
| 8 | **Status parameters** | Label and value for each status item from the third onward |
| 9 | **Operating parameters** | Remaining artificial semen, battery, storage |
| 10 | **Control-button text** | Button captions; buttons 1–10 are fixed, 11 and up are editable |

Two buttons close the screen:

- **Get started** — validates the entries (passwords match, links start with `http://` or `https://`, liquid litres ≤ total, battery 0–100, storage within range) and saves them.
- **Skip and keep defaults** — saves nothing except the fact that setup is complete.

Model information entered here or later in Settings propagates to the window title, the header, the launcher title, spoken pronunciation and the status chips. If every value is left at its Chinese or English default, the whole group follows the interface language; a single customised value makes the entire group show verbatim.

---

# 3. Language

## 3.1 How the language is chosen

Each client resolves its interface language in this order:

1. **Your own choice**, if you have switched language manually at least once. This is remembered permanently.
2. **The device language** — if the system is set to Chinese the client opens in Chinese, otherwise in English.
3. **English**, when the device language cannot be read or is not Chinese.

Automatic detection is re-evaluated on every launch and is never written to storage, so a client that matched Chinese because of the device setting will still follow the device if you later change the system language. Only a manual switch is permanent.

## 3.2 Switching by hand

| Client | Where to switch |
|---|---|
| MACS console | `ZH` / `EN` at the top right of the login and activation screens; **Settings → 语言** afterwards |
| MACS Windows launcher | Settings → **界面语言** |
| Slave | Bluetooth dialog → **Language** row; or the first-run screen |

The switch takes effect immediately and survives restarts. On the Slave it rebuilds the screen so every label updates at once.

## 3.3 Slave no longer follows the console

The Slave previously mirrored whatever language the console pushed over Bluetooth. From this version it keeps its own language: the console's setting no longer changes what the Slave displays. Set it on the Slave itself.

> The Bluetooth language characteristic still exists and is still broadcast, so older Slave builds continue to work — it is simply no longer consumed by current ones.

---

# 4. Connecting the clients

The clients talk over Bluetooth Low Energy. The Master advertises, the Slave and Watch scan and connect.

## 4.1 Bluetooth scanning

1. On the console, open the connection dialog and tap **开始连接** (Start connection). On Windows the BLE host starts advertising as well.
2. On the Slave, tap the round **B** button to open **控制面板连接** (Console connection), then **重新扫描** (Rescan). Nearby consoles appear in the list.
3. Tap a device to connect.

The Slave scans for ten seconds per attempt and retries on its own while it stays unbound. Once connected it subscribes to mode, emotion, tasks, voice, heartbeat, API key and language notifications. If the link drops, both sides retry automatically; a deliberate disconnect from either side is respected and does not trigger a reconnect loop.

## 4.2 QR pairing

Pairs the two devices without a scan list:

1. On the console's Bluetooth dialog tap the QR button. A code appears labelled **绑定二维码** — "scan this with the receiving client".
2. On the Slave tap **扫描二维码** (Scan QR code).
3. Point the camera at the code. The Slave reads the console's address and connects.

> QR generation needs the native shells (Android or Windows). In a plain browser the QR area stays empty, because there is no Bluetooth radio for the page to read.

## 4.3 USB entry on Windows

The Windows launcher recognises the robot by USB rather than Bluetooth:

1. Open the launcher's settings and add at least one rule. Each rule needs **VID**, **PID** or a **device/disk ID**; serial number and manufacturer are optional refinements. A blank field is not used for matching.
2. Plug the robot in. The launcher scans every four seconds, reports the state and lights the device button when a rule matches.
3. Click the device button to enter the console. Entry is marked as USB-based, which is what drives the "charging" indication while the device stays attached.

Removing the device stops the charging indication; reconnecting restores it. **Test mode** (the `测试模式` button, or the F2 key) simulates a successful connection so you can open the console without hardware; it applies only to the current run of the app.

## 4.4 Launching the app from a browser

The web edition offers `robotcontrol://console`, which opens the installed MACS console. The browser guide and **Settings → 拉起 App** both use it. If the app is not installed the browser detects that the page is still visible after roughly two seconds and highlights the download link instead.

---

# 5. The console

The console adapts to the screen. On a wide desktop it shows three columns; on a phone it shows a single column with pages you switch between.

## 5.1 Signing in

The desktop console shows a login card on a random wallpaper.

- **Account** and **Password** — the factory account is `admin` / `admin` unless you set something else during activation.
- **Remember account** — stores the credentials so they are filled in next time.
- **Enter the console** — plays a short transition, then the main interface loads.

On a phone-sized window and inside the Android app there is **no login screen**: the console opens straight into the interface. Log entries record this.

## 5.2 Terminal

The terminal accepts commands at the `root:~#` prompt:

| Command | Effect |
|---|---|
| `help` | Lists the available commands |
| `mode` | Shows the current mode |
| `mode test` / `recovery` / `loyalty` / `simulated-human` | Switches mode |
| `system` | Prints the specification sheet |
| `clear` | Clears the screen |
| `*` followed by text | Speaks the text and records it as a task |

The up and down arrows walk through command history. While the android is powered off the input is disabled.

## 5.3 Mode buttons

Four buttons select the operating mode; the active one is highlighted and pulses. The console starts in **NA** (no mode) after login.

| Mode | Character |
|---|---|
| 调试模式 (Test) | No self-awareness; responds to commands only |
| 恢复模式 (Recovery) | BIOS-level operation used for system repair |
| 忠诚模式 (Loyalty) | Self-aware and obedient; machine algorithms |
| 拟人模式 (Simulated human) | Behaves as a person would; simulated skin required |

Changing mode speaks the mode name and syncs the new mode to every connected client. The mode can also be changed from the mode menu in the header, or with the terminal's `mode` command.

## 5.4 Control buttons

Twelve buttons come as standard, and you can add more in Settings:

| Button | What it does |
|---|---|
| 清空所有进程 | Clears all processes, with a progress window |
| 自检 | Runs the self-check programme |
| 系统更新 | Runs the update sequence |
| 数据库更新 | Runs the database migration |
| 开机 | Powers on (available only while off) |
| 关机 | Powers off — stops speech, aborts running windows, greys out the controls |
| 重启 | Restarts: silent shutdown, pause, boot |
| 认知偏移 | Opens a dialog; the text you enter is added as a cognitive task and spoken |
| 暂停 | Pauses, holding the charts flat; the label becomes 结束暂停 |
| 停止 | Stops and zeroes the arousal chart; the label becomes 恢复 |
| 洗澡子模式 | Speaks and logs only |
| 家具模式 | Speaks and logs only |

Buttons 11 and up are yours to define; pressing one also records a task. In Simulated-human mode the function buttons are disabled, and while the android is off only 开机 and 重启 remain.

## 5.5 Emotion panel

Four gauges, each draggable or clickable anywhere along its track, from 0 to 100:

| Gauge | Colour | Default |
|---|---|---|
| 服从度 (Obedience) | Green | 100 |
| 羞耻度 (Shame) | Orange | 0 |
| 愉悦度 (Pleasure) | Pink | 100 |
| 机械度 (Robotic) | Red | 50 |

Each change speaks the value and is pushed to the connected clients. Values persist between sessions.

## 5.6 Status values

The lower panels list the android's parameters — series, generation, serial number, system and database versions, body and component serial numbers, height, weight, dimensions, gender, orientation, threshold, arousal conditions, production and activation dates. Two entries, **master** and **manufacturing company**, follow the model information you set; the rest are edited individually in Settings.

## 5.7 Operating parameters and charts

The monitoring panel shows remaining battery, remaining artificial semen, remaining storage, and memory/CPU/NPU/GPU/I/O load, with line charts for internal temperature, system load and arousal. Battery, semen and storage follow the values you set in Settings; the load figures and charts move on their own as part of the staged presentation.

When the android is switched off everything drops to N/A apart from the battery, which continues to follow its schedule.

## 5.8 Dynamic island, notifications and code view

On the Android and Windows clients a dynamic island animates when a client connects or when the android is charging. Desktop windows also show macOS-style notifications in the top-right corner for connections, disconnections, charging changes and successful mode pushes; they stack up to three and fade after five seconds.

A third panel streams the android's source code, scrolling faster as simulated CPU load rises, and a pair of images shows the android's two reference photographs. Both are configured in Settings.

## 5.9 Self-check

**自检** opens a progress window and walks through the diagnostic list — model, face, body, chassis, sex-function configuration and software subsystems — reporting elapsed time and line count. On desktop widths a file-transfer window appears during the sex-function test. When it finishes successfully it reports **总用时** (total time) and speaks the result. Closing a running window asks for confirmation first.

---

# 6. Console settings

Open Settings from the cog in the header, the Rt5 menu, the dock, or the capsule on mobile. On desktop the groups are listed down the left; on mobile you pick a group and get a back arrow.

| Group | Contents |
|---|---|
| **语言** | `中文` / `English` |
| **型号信息** | The five model-information fields |
| **网页缓存与 App** | Cache, launch and download buttons (browser edition only) |
| **账号管理** | Add and remove accounts; the last account cannot be deleted |
| **TTS 语音引擎** | Engine choice, MiMo API key with a save button, a test broadcast, and the platform link |
| **灵动岛模拟效果** | Previews for the connection island, charging island and a text notification |
| **运行参数设置** | Artificial semen, battery (automatic schedule or manual percentage) and storage |
| **控制按钮文本设置** | Rename buttons from number 11 upward, add or remove them |
| **机器人图片设置** | Load the two images, with a per-image reset to default |
| **模式名称设置** | Rename the four modes; you are asked to confirm before saving |
| **信息面板链接** | Names and URLs for the link entries, with a reset to defaults |
| **机器人状态设置** | Label and value for each status row |
| **配置导入导出** | Export or import the whole configuration |

Three buttons sit at the bottom: **改为默认设置** (reset everything to defaults), **取消** and **应用更改**. Closing the panel discards unapplied edits. Applying after changing a mode name shows a confirmation listing each old and new name; confirming saves the whole group, cancelling aborts the entire save.

The battery schedule, which is the default, runs from 1 % at 01:00 to 100 % at 07:00, showing "charging" through that window. Untick it to set a fixed percentage and choose whether charging is shown.

## 6.1 Configuration files

**导出配置** writes `robotcontrol-config-YYYYMMDD.json` containing button texts, status items, mode names, model information, links, runtime parameters, accounts, both images, emotion values, language, the TTS engine and the MiMo API key.

> The exported file contains your login password and API key in plain text, and may include the robot images. Store it accordingly.

**导入配置** reads such a file back, warns that it overwrites every personalisation and reloads the page. Invalid files are rejected.

---

# 7. Information panel

The **?** button opens the information panel in two blocks.

**About** — device model and manufacturing company (both following your model information), the robot's system name, firmware revision, and the server link status.

**Files and links** — the document list. Each row has an open-in-new-window button:

| Entry | Opens |
|---|---|
| T-series user manual (PDF) | The built-in PDF viewer, with fallback links if your browser cannot display PDFs inline |
| The demo collection | Telegram |
| The public channel | Telegram |
| The social account | X |
| The company's android logs | Pixiv |
| **App user manual** | This manual, in whichever language the console is currently using |
| Get the app (open / download) | The browser app-launch guide |

Link names and addresses are editable in Settings; the PDF entry keeps its fixed filename.

---

# 8. Slave app

The Slave is the client that travels with the android.

## 8.1 Screen layout

The fixed top area holds the Bluetooth button, the mode capsule and the voice-recognition button, with the emotion panel underneath. Below them, two scrolling columns show tasks on the left and voice messages on the right.

The **mode capsule** shows the current mode in its own colour, or **NA** in grey. **Long-press it** to open the mode menu and push a different mode to the console; if nothing is connected you are told so. This is the manual equivalent of a voice command.

## 8.2 Bluetooth button

- **Tap** to open the connection dialog.
- **Long-press** to inject sample data — a row of demo tasks, emotions and voice messages. This is a test aid, not real traffic.

The button is green when connected, red when disconnected, amber while connecting and grey before the first pairing.

## 8.3 Connection dialog

**控制面板连接** holds the connection state and address, the nearby-device list with scan controls, the QR scanner entry, and the settings the android itself needs:

- **MiMo API Key** — optional; used for high-quality speech synthesis and synced to the console when you connect.
- **Use cloud engine (MiMo ASR)** — when on, recognition may fall back to the cloud; when off, only the on-device engine runs and nothing is sent anywhere.
- **Language** — `中文` / `English`.
- **Disconnect** — drops the link and forgets the pairing.

## 8.4 Voice recognition

The round microphone button at the top right toggles recognition. It runs only while the app is in the foreground, and remembers whether it was on.

Recognition happens on the device first, matching the mode names by pronunciation so near-homophones still register, and rejecting phrases that begin with a negative such as "don't". It also follows the interface language: Chinese mode names are recognised in Chinese, English ones in English. Cloud recognition is used only as a fallback, and only when the switch is on, a key is present, and enough speech has been captured.

A recognised mode is pushed to the console exactly as a manual long-press would be.

## 8.5 Tasks and voice messages

**Tasks** are tagged by origin — cognitive, terminal, button or ordinary — and finished ones are struck through. **Voice messages** show the time and content, newest first; a system notification is posted for each new message, titled 主人指令, or 推送成功 when the message is the console acknowledging a mode you pushed.

## 8.6 Your privacy controls

Nothing leaves the device unless you allow it: the cloud switch governs speech recognition, and the API key is only used for the MiMo service.

---

# 9. Watch app

The watch shows three pages you swipe between, or scroll with the crown:

1. **Emotion** — the same four gauges as the console.
2. **Tasks** — the task list, at a glance.
3. **Voice** — the most recent voice messages.

The time and a mode capsule sit at the top, and a round Bluetooth button at the bottom right opens the connection dialog, where you can scan, disconnect, unbind, and open the **keep-alive settings** guidance. That guidance explains how to exempt the app from battery optimisation on Xiaomi, Oppo, OnePlus, realme and similar phones — worth doing, or the system will stop the connection in the background. The watch vibrates differently for each mode change.

The watch keeps its connection alive with a foreground service and reconnects automatically, including after a reboot.

---

# 10. Browser edition

The same console runs in a browser. Two things differ from the native clients.

**Caching.** A first visit offers to cache the whole console so it opens instantly and works offline. Following that link downloads every asset once. Afterwards the console runs from local storage, and if the site is updated you are offered a re-cache through a notification or a banner.

**App launching.** The browser cannot use Bluetooth; to connect to hardware you need the Android or Windows app. The guide that appears offers to open the installed app, download it, or continue in the browser.

The **Settings → 网页缓存与 App** group repeats the cache, launch and download actions at any time.

---

# 11. Troubleshooting

| Symptom | What to check |
|---|---|
| The client is in the wrong language | Change the system language, or switch manually — a manual switch is permanent and overrides detection |
| The Slave shows a different language from the console | That is intended: the Slave keeps its own language now. Set it on the Slave |
| The Slave cannot find the console | Make sure the console is advertising (open its connection dialog and start), keep the two devices within a few metres, and give the scan its ten seconds |
| QR code will not scan | Only the native shells generate usable codes; in a browser the QR area stays empty. Use scanning instead |
| The Windows launcher waits forever | Add at least one USB rule, or press F2 for test mode |
| Voice recognition does not respond | Check the microphone permission, keep the app in the foreground, and confirm the interface language matches how you are speaking |
| The watch disconnects by itself | Open the keep-alive guidance from the Bluetooth dialog and add the app to the battery-optimisation whitelist |
| A settings change had no effect | Settings are written when you press **应用更改**, not as you type |
| The console reopens the first-run screen | It reappears only if setup was never completed; complete or skip it |

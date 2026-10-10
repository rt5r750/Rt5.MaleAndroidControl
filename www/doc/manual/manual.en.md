# Master · User Manual

Master is the control console of the T31-750 male android (the Male Android Control system). This manual covers every client in the package: the **Master** console app on Android and Windows, the **Slave** app that runs on the android's own phone, and the Wear OS watch app. It also covers the browser edition and the pairing methods that link them.

> The product is fictional. Many readouts in the console — CPU/GPU/NPU load, remaining artificial semen, storage, system version, self-check and update output — are part of the staged presentation rather than live telemetry. Wording in this manual follows the English interface; where the interface itself shows a fixed term, that term is used verbatim.

## Contents

| Chapter | What it covers |
|---|---|
| 0. What this suite is for | Why in-person control needs ritual |
| 1. Clients and roles | Which app does what, and which one you need |
| 2. Installation and first launch | Installing each client, the first-run activation flow |
| 3. Language | Automatic device-language matching and manual switching |
| 4. Connecting the clients | Bluetooth, QR pairing, USB entry, app launching |
| 5. The console | Every panel, button and readout of the main interface |
| 6. Console settings | All settings groups, configuration file and Clawbot notifications |
| 7. Information panel | Device information, documents and links |
| 8. Slave app | The android's phone client in full |
| 9. Watch app | The Wear OS client |
| 10. Browser edition | Caching, offline use and app launching |
| 11. Troubleshooting | Symptom-by-symptom checks |

---

# 0. What this suite is for

Meeting your android **in person** is nothing like chatting online. Whispering an instruction across the table works, but it fades the moment it is spoken; typing it into a chat app flattens the scene entirely. What is missing is **ritual**.

So imagine this: your android is fully objectified — every parameter visible, every value yours to set, live and in your hands. When you go out together, its phone stays linked to yours over Bluetooth. On the street you don't have to lean in and whisper, and there is no chat window breaking the spell: you tap your phone, its phone lights up — **"Master's command"** — and the android receives your latest instruction the way a machine receives its programming.

Back home, set the console up in front of your computer (or plug in a USB drive and connect it directly), and it becomes what it truly is: a terminal in front of a machine that stands there, motionless, waiting to be programmed by you.

That is what this suite is for: **objectification with a protocol**. All of it, in person. The rest of this manual covers how to put it to work.

---

# 1. Clients and roles

| Client | Where it runs | App name | Role |
|---|---|---|---|
| Master console | Android phone/tablet (Android 12+) | **Master** | Full control console; advertises Bluetooth so clients can connect |
| Master console | Windows 10/11 desktop | **Master** | Same console with a desktop launcher and USB entry |
| Slave | Android phone (Android 7.0+) | **Slave** | Carried by the android: shows mode, emotion, tasks and voice messages; can push mode and voice commands back |
| Watch | Wear OS | 750 Receiver | Compact status display worn on the wrist. This client still ships its original Chinese label and is outside the language scope of this release |
| Browser edition | Any modern browser | — | The same console served over the web, with optional full offline caching |

The **Master** distributes state; the **Slave** and **Watch** receive it. The Slave can also send the selected mode back to the Master, either by hand (long-press the mode capsule) or by voice.

**Which do I need?** For control alone, the Master console is enough. To read the android's state on a separate phone, add the Slave. The watch is optional.

---

# 2. Installation and first launch

## 2.1 First run in one sentence

Every client now opens in **English on first launch**, matches the device language automatically when it can, and walks you through a one-time setup before the main interface appears. Nothing is compulsory — each setup screen has a **Skip and keep defaults** option.

## 2.2 Master on Android

1. Install the APK and open it. A brand film plays once.
2. When the film ends, the **Activation Setup** screen (first-run setup) appears. It is the same form described in section 2.5; on a phone it is a single scrollable page.
3. Fill in whatever you want to personalise, then tap **Get Started**; or tap **Skip, Keep Defaults**.
4. The console opens. The setup screen does not appear again.

> The film plays to the end before the setup screen appears. Tapping the screen skips the film early.

## 2.3 Master on Windows

1. Unpack the release archive somewhere you can write to, then run `RobotControl-Console.exe`.
2. On the **first** launch the activation window opens **before the launcher**. Complete it, or close the window to skip.
3. The launcher appears. It waits for the robot's USB device — see section 4.3.
4. Click the device button to enter the console. The launcher shows **Waiting for device** until a match is found.

On later launches the activation window stays away and the launcher opens directly. To see the first-run flow again, close the app, delete the `huancun` folder next to `RobotControl-Console.exe`, and start it again.

## 2.4 Slave

1. Install the APK and open it.
2. The first-run screen appears over the interface: choose **Chinese** or **English**, optionally enter a MiMo API key, and set the cloud-recognition switch.
3. Tap **Get Started** or **Skip, Keep Defaults**.
4. The main interface is revealed and the screen does not return.

## 2.5 The activation form

The console's activation screen holds eleven numbered groups on one page. Leave any field empty to keep its default.

The layout adapts to the screen: on a phone it is a flat full-screen list (no card frame, clear of the system status bar); on a wide desktop the container widens and the ten groups flow into two columns for higher density. **Group 1 (Language) is itself the language entry** — there is no extra switcher at the top right. Each group heading is separated by a centered banner so the blocks are easy to tell apart. Link names and status labels use **title-style inputs** (darker, bold) to distinguish them from value fields.

| # | Group | Fields |
|---|---|---|
| 1 | **Language** | `Chinese` / `English` |
| 2 | **Model Info** | Full Model, Short Name, Manufacturer, Master, TTS Reading |
| 3 | **Account Management** | Login Password and Confirm Password (leave both empty to keep `admin` / `admin`) |
| 4 | **TTS Voice Engine** | Engine `Birch Voice` / `Voice Design`, MiMo API key, link to the MiMo platform |
| 5 | **Android Image Settings** | Two image files with previews (a 9:20 image with a transparent background is recommended) |
| 6 | **Mode Name Settings** | Rename the four modes (each row carries that mode's description) |
| 7 | **Info Panel Links** | Name and URL for each link entry |
| 8 | **Android Status Settings** | Label and value for each status item from the third onward |
| 9 | **Runtime Parameters Settings** | Remaining artificial semen, battery, storage |
| 10 | **Control Button Text Settings** | Button captions; buttons 1–10 are fixed and hidden, only 11 and up are editable |
| 11 | **Notifications (Clawbot)** | A status line and an "Open Settings" button (configures Telegram / Feishu push in a large window; optional, safe to skip) |

Two buttons stay pinned at the bottom and close the screen:

- **Get Started** — validates the entries (passwords match, links start with `http://` or `https://`, liquid litres ≤ total, battery 0–100, storage within range) and saves them.
- **Skip, Keep Defaults** — saves nothing except the fact that setup is complete.

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
| Master console | `ZH` / `EN` at the top right of the login screen; on the activation screen use group 1; **Settings → Language** afterwards |
| Master Windows launcher | Settings → **Interface Language** |
| Slave | Bluetooth dialog → the language row; or the first-run screen |

The switch takes effect immediately and survives restarts. On the Slave it rebuilds the screen so every label updates at once.

## 3.3 Slave no longer follows the console

The Slave previously mirrored whatever language the console pushed over Bluetooth. From this version it keeps its own language: the console's setting no longer changes what the Slave displays. Set it on the Slave itself.

> The Bluetooth language characteristic still exists and is still broadcast, so older Slave builds continue to work — it is simply no longer consumed by current ones.

---

# 4. Connecting the clients

The clients talk over Bluetooth Low Energy. The Master advertises, the Slave and Watch scan and connect.

## 4.1 Bluetooth scanning

1. On the console, open the connection dialog and tap **Start Connection**. On Windows the BLE host starts advertising as well.
2. On the Slave, tap the round **B** button to open **Console Connection**, then **Scan Again**. Nearby consoles appear in the list.
3. Tap a device to connect.

The Slave scans for ten seconds per attempt and retries on its own while it stays unbound. Once connected it subscribes to mode, emotion, tasks, voice, heartbeat and API-key notifications. (It no longer subscribes to the console's language — see 3.3.) If the link drops, both sides retry automatically; a deliberate disconnect from either side is respected and does not trigger a reconnect loop.

## 4.2 QR pairing

Pairs the two devices without a scan list:

1. On the console's Bluetooth dialog tap the QR button. A code appears labelled **Binding QR Code** — "scan this with the receiving client".
2. On the Slave tap **Scan QR Code**.
3. Point the camera at the code. The Slave reads the console's address and connects.

> QR generation needs the native shells (Android or Windows). In a plain browser the QR area stays empty, because there is no Bluetooth radio for the page to read.

## 4.3 USB entry on Windows

The Windows launcher recognises the robot by USB rather than Bluetooth:

1. Open the launcher's settings and add at least one rule. Each rule needs **VID**, **PID** or a **device/disk ID**; serial number and manufacturer are optional refinements. A blank field is not used for matching.
2. Plug the robot in. The launcher scans every four seconds, reports the state and lights the device button when a rule matches.
3. Click the device button to enter the console. Entry is marked as USB-based, which is what drives the "charging" indication while the device stays attached.

Removing the device stops the charging indication; reconnecting restores it. **Test mode** (the `TEST MODE` button, or the F2 key) simulates a successful connection so you can open the console without hardware; it applies only to the current run of the app.

## 4.4 Launching the app from a browser

The web edition offers `robotcontrol://console`, which opens the installed Master console. The browser guide and **Settings → Launch App** both use it. If the app is not installed the browser detects that the page is still visible after roughly two seconds and highlights the download link instead.

---

# 5. The console

The console adapts to the screen. On a wide desktop it shows three columns; on a phone it shows a single column with pages you switch between.

## 5.1 Signing in

The desktop console shows a login card on a random wallpaper.

- **Account** and **Password** — the factory account is `admin` / `admin` unless you set something else during activation.
- **Remember account** — stores the credentials so they are filled in next time.
- **Enter Console** — plays a short transition, then the main interface loads.

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
| Test Mode | No self-awareness; responds to commands only |
| Recovery Mode | BIOS-level operation used for system repair |
| Loyalty Mode | Self-aware and obedient; machine algorithms |
| Simulated Human Mode | Behaves as a person would; simulated skin required |

Changing mode speaks the mode name and syncs the new mode to every connected client. The mode can also be changed from the mode menu in the header, or with the terminal's `mode` command.

## 5.4 Control buttons

Twelve buttons come as standard, and you can add more in Settings:

| Button | What it does |
|---|---|
| Clear All Processes | Clears all processes, with a progress window |
| Self-check | Runs the self-check programme |
| System Update | Runs the update sequence |
| Database Update | Runs the database migration |
| Power On | Powers on (available only while off) |
| Shut Down | Powers off — stops speech, aborts running windows, greys out the controls |
| Restart | Restarts: silent shutdown, pause, boot |
| Cognitive Offset | Opens a dialog; the text you enter is added as a cognitive task and spoken |
| Pause | Pauses, holding the charts flat; the label becomes **Resume** |
| Stop | Stops and zeroes the arousal chart; the label becomes **Restore** |
| Bath Sub-mode | Speaks and logs only |
| Furniture Mode | Speaks and logs only |

Buttons 11 and up are yours to define; pressing one also records a task. In Simulated Human Mode the function buttons are disabled, and while the android is off only Power On and Restart remain.

## 5.5 Emotion panel

Four gauges, each draggable or clickable anywhere along its track, from 0 to 100:

| Gauge | Colour | Default |
|---|---|---|
| Obedience | Green | 100 |
| Shame | Orange | 0 |
| Pleasure | Pink | 100 |
| Robotic | Red | 50 |

Each change speaks the value and is pushed to the connected clients. Values persist between sessions.

## 5.6 Status values

The lower panels list the android's parameters — series, generation, serial number, system and database versions, body and component serial numbers, height, weight, dimensions, gender, orientation, threshold, arousal conditions, production and activation dates. Two entries, **Master** and **Manufacturer**, follow the model information you set; the rest are edited individually in Settings.

## 5.7 Operating parameters and charts

The monitoring panel shows remaining battery, remaining artificial semen, remaining storage, and memory/CPU/NPU/GPU/I/O load, with line charts for internal temperature, system load and arousal. Battery, semen and storage follow the values you set in Settings; the load figures and charts move on their own as part of the staged presentation.

When the android is switched off everything drops to N/A apart from the battery, which continues to follow its schedule.

## 5.8 Dynamic island, notifications and code view

On the Android and Windows clients a dynamic island animates when a client connects or when the android is charging. Desktop windows also show macOS-style notifications in the top-right corner for connections, disconnections, charging changes and successful mode pushes; they stack up to three and fade after five seconds.

A third panel streams the android's source code, scrolling faster as simulated CPU load rises, and a pair of images shows the android's two reference photographs. Both are configured in Settings.

## 5.9 Self-check

**Self-check** opens a progress window and walks through the diagnostic list — model, face, body, chassis, sex-function configuration and software subsystems — reporting elapsed time and line count. On desktop widths a file-transfer window appears during the sex-function test. When it finishes successfully it reports the total time and speaks the result. Closing a running window asks for confirmation first.

---

## 5.10 Task Commands

The task panel lists the android's tasks, each tagged on the left by origin — cognitive (orange ◈), terminal (cyan ◇), button (mode colour ◆) or ordinary (●); finished ones are struck through with ✓. The panel header shows a count, e.g. "3 tasks (1 pending)".

Tasks produced locally — pressing button 11 or later, sending a command with `*` in the terminal, adding a cognitive offset — enter this list immediately and are synchronised to any connected Slave and watch.

## 5.11 Timer

The timer panel has **Start** and **Reset** for a countdown; it announces when the countdown finishes. The duration and running state persist for the session.

## 5.12 Debug log

The debug log records system activity in order — initialisation, login, connections, mode changes, function runs, opened files, saved settings. When something seems unresponsive, read this first: most "I clicked and nothing happened" cases leave a record here.

## 5.13 Header and system menu

In desktop menu mode the header contains:

| Element | What it does |
|---|---|
| Battery indicator | Opens the battery menu (charging state and schedule) |
| Network indicator | Opens the network/Bluetooth services menu |
| Mode indicator | Opens the mode menu to switch between the four modes |
| Bluetooth button | Opens the connection dialog (start / QR / disconnect) |
| **?** | Information panel |
| Cog | Settings panel |

Clicking the Rt5 logo at top left opens the system menu with **About**, **Restart the android...**, **Shut down the android...** and **Log out**; the About window shows the model, company, status list and CPU/GPU/NPU charts. The dock (revealed when the pointer reaches the bottom edge) manages and minimises windows; its floating-window area keeps a permanent **App User Manual** icon (a book) that opens this manual in-app.

# 6. Console settings

Open Settings from the cog in the header, the Rt5 menu, the dock, or the capsule on mobile. On desktop the groups are listed down the left; on mobile you pick a group and get a back arrow.

| Group | Contents |
|---|---|
| **Language** | `Chinese` / `English` |
| **Model Info** | The five model-information fields |
| **Web Cache & App** | Cache, launch and download buttons (browser edition only) |
| **Account Management** | Add and remove accounts; the last account cannot be deleted |
| **TTS Voice Engine** | Engine choice, MiMo API key with a save button, a test broadcast, and the platform link |
| **Dynamic Island Preview** | Previews for the connection island, charging island and a text notification |
| **Runtime Parameters Settings** | Artificial semen, battery (automatic schedule or manual percentage) and storage |
| **Control Button Text Settings** | Rename buttons from number 11 upward, add or remove them |
| **Android Image Settings** | Load the two images, with a per-image reset to default |
| **Mode Name Settings** | Rename the four modes; you are asked to confirm before saving |
| **Info Panel Links** | Names and URLs for the link entries, with a reset to defaults |
| **Android Status Settings** | Label and value for each status row |
| **Clawbot Notifications** | Push command broadcasts / data changes to Telegram & Feishu, and answer slash-command queries (see 6.2) |
| **Config Import / Export** | Export or import the whole configuration |

Three buttons sit at the bottom: **Set to Defaults** (reset everything to defaults), **Cancel** and **Apply Changes**. Closing the panel discards unapplied edits. Applying after changing a mode name shows a confirmation listing each old and new name; confirming saves the whole group, cancelling aborts the entire save.

The battery schedule, which is the default, runs from 1 % at 01:00 to 100 % at 07:00, showing "charging" through that window. Untick it to set a fixed percentage and choose whether charging is shown.

## 6.1 Configuration files

**Config Import / Export → Export** writes `robotcontrol-config-YYYYMMDD.json` containing button texts, status items, mode names, model information, links, runtime parameters, accounts, both images, emotion values, language, the TTS engine and the MiMo API key.

> The exported file contains your login password and API key in plain text, and may include the android images. Store it accordingly.

**Import** reads such a file back, warns that it overwrites every personalisation and reloads the page. Invalid files are rejected.

## 6.2 IM notifications (Clawbot)

Everything that happens in the console can be pushed live to a Telegram / Feishu chat (your Clawbot — or any bot — in the group will see it), and the chat can query android parameters with slash commands. **All traffic is plain API calls with locally generated replies — no LLM involved, 0 token cost.** If the Slave app cannot be installed (e.g. iOS devices cannot be sideloaded), use this to deliver commands to an IM app instead.

Setup guides: [Feishu custom bot](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot) · [Feishu bot overview](https://open.feishu.cn/document/client-docs/bot-v3/bot-overview) · [Telegram guide (Chinese)](https://github.com/danshui-git/shuoming/blob/master/bot.md) · [Telegram tutorial (English)](https://core.telegram.org/bots/tutorial).

**Push format (two distinct kinds)**

| Kind | When | Format |
|---|---|---|
| Command broadcast | Whatever is spoken (terminal commands, control buttons, mode switches, task completion, system notices) | `Master's Command: ` + the content |
| Data change | Real-time parameter edits (emotion sliders, task add/remove, actual changed items after saving settings, charging state switches) | `Data Change: ` + what changed |

In the Chinese interface the two prefixes appear as their Chinese equivalents (literally "Master's Command:" and "Data Change:"); content follows the interface language, and mode names use your actual settings. Blank content is never pushed. Runtime parameters themselves are never pushed (same policy as the Slave clients); only **charging state switches** (charging started/stopped) push one message. The first outbound message to each chat is preceded by a one-time binding notice (full model name + "has been successfully bound...", localized incl. English).

**Where to configure**: the "Clawbot Notifications" group in Settings; on first activation, group 11's "Open Settings" button opens the same form in a large window (optional — skipping does not block activation). Three switches: push voice broadcasts / push data changes / respond to slash commands.

**Telegram**

1. Talk to `@BotFather` on Telegram, create a bot with `/newbot`, and copy the **Bot Token** (looks like `123456789:AA...`).
2. **Send the bot a message (e.g. `/start`) in Telegram**, then press **"Auto detect Chat ID"** in the settings form — your chat id fills in automatically. You can also type the numeric chat id by hand (groups start with `-100...`, private chats are positive integers), or paste an `@username` / `t.me` link (resolved automatically). **Do not use the bot's own username** — a bot cannot receive chat messages.
3. Tick "Enable Telegram" and press "Send Test Message" to verify.

The device must reach `api.telegram.org` (a system proxy is usually needed in mainland China). Reverse queries use getUpdates long polling and need no public IP.

**Feishu (choose one)**

- **Custom bot Webhook (push only)**: group settings → Group Bots → Add Bot → Custom Bot, copy the **Webhook URL**. This mode cannot receive slash commands.
- **Custom app (bidirectional)**: create an enterprise custom app on the Feishu Open Platform → enable the bot capability → request the `im:message` scope → publish a version → add the bot to the target group; fill **App ID / App Secret / Chat ID**.

Feishu is directly reachable from mainland China with no proxy. Both platforms can be enabled at once (messages go to both; query replies return to the platform the command came from).

**Slash commands (locally parsed, 0 token)**

| Command | Returns |
|---|---|
| `/help` | Command list |
| `/query` | Full parameter summary |
| `/mode` | Current mode and mode names |
| `/emotion` | Emotion parameters |
| `/runtime` | Runtime parameters |
| `/tasks` | Task list |
| `/model` | Model info |
| `/status` | Info parameters |
| `/buttons` | Control button texts |
| `/links` | Info panel links |

Blank commands (empty message or a lone `/`) are not supported and are ignored; unknown commands get the help text. Replies follow the console language and use your actual mode names; account passwords and API keys are reported only as "set / not set", and the Bot Token / App Secret are never echoed. The push queue is rate-limited to one message per second.

> The console must keep running (page open) to answer queries. Configuration travels with "Export Config", which contains sensitive data such as the Bot Token — keep it safe.

---

# 7. Information panel

The **?** button opens the information panel in two blocks.

**About** — Device Model and Manufacturer (both following your model information), the android's Android System name, the Base Version, and the Communication status with the server.

**Files & Links** — the document list. **The App User Manual comes first** and, at desktop widths, sits side by side with the PDF manual (each taking half a row); on phone widths the list is a single column and every entry takes a full row. Each row has an open-in-new-window button:

| Entry | Opens |
|---|---|
| **App User Manual** | This manual, in whichever language the console is currently using |
| T-series male android user manual (PDF) | The built-in PDF viewer, with fallback links if your browser cannot display PDFs inline |
| T31-750 Demo Collection | Telegram |
| T31-750 Official Account | Telegram |
| T31-750 Social Accounts | X |
| Rt5 A.I. Fictional Liability Company Android Log | Pixiv |
| Get the app (open / download) | The browser app-launch guide |

Link names and addresses are editable in Settings. Two entries are fixed and cannot be renamed: the PDF keeps its filename, and the app manual follows the interface language.

---

# 8. Slave app

The Slave is the client that travels with the android.

## 8.1 Screen layout

The fixed top area holds the Bluetooth button, the mode capsule and the speech-recognition button, with the emotion panel underneath. Below them, two scrolling columns show tasks on the left and voice messages on the right.

The **mode capsule** shows the current mode in its own colour, or **NA** in grey. **Long-press it** to open the mode menu and push a different mode to the console; if nothing is connected you are told so. This is the manual equivalent of a voice command.

## 8.2 Bluetooth button

- **Tap** to open the connection dialog.
- **Long-press** to inject sample data — a row of demo tasks, emotions and voice messages. This is a test aid, not real traffic.

The button is green when connected, red when disconnected, amber while connecting and grey before the first pairing.

## 8.3 Connection dialog

**Console Connection** holds the connection state and address, the **Nearby Devices** list with scan controls, the QR scanner entry, and the settings the android itself needs:

- **MiMo API Key** — optional; used for high-quality speech synthesis. When connected to the console the two sides are aligned automatically per the sync policy in 8.7.
- **Use cloud engine (MiMo ASR)** — when on, recognition may fall back to the cloud; when off, only the on-device engine runs and nothing is sent anywhere.
- **Language** — `Chinese` / `English`.
- **Disconnect** — drops the link and forgets the pairing.

## 8.4 Speech recognition

The round microphone button at the top right toggles recognition. It runs only while the app is in the foreground, and remembers whether it was on.

Recognition happens on the device first, matching the mode names by pronunciation so near-homophones still register, and rejecting phrases that begin with a negative such as "don't". It also follows the interface language: Chinese mode names are recognised in Chinese, English ones in English. Cloud recognition is used only as a fallback, and only when the switch is on, a key is present, and enough speech has been captured.

A recognised mode is pushed to the console exactly as a manual long-press would be.

## 8.5 Tasks and voice messages

**Tasks** are tagged by origin — cognitive, terminal, button or ordinary — and finished ones are struck through. **Voice messages** show the time and content, newest first; a system notification is posted for each new message, titled **Master's command**, or **Push successful** when the message is the console acknowledging a mode you pushed.

## 8.6 Your privacy controls

Nothing leaves the device unless you allow it: the cloud switch governs speech recognition, and the API key is only used for the MiMo service.

## 8.7 API key sync

On connecting to the console, the MiMo API keys of the two sides are aligned once (the Slave side decides). A key counts as **usable** when it is well-formed (starts with `sk-`, long enough) and has no authentication-failure record — real TTS/ASR call outcomes update that record automatically.

| Slave side | Console side | Result |
|---|---|---|
| Empty / invalid | Usable | Adopt the console's key |
| Usable | Empty / invalid | Push to the console |
| Both usable and identical | — | Nothing to do |
| Both usable but different | — | Each keeps its own |
| Both empty or invalid | — | Unchanged (neither side is cleared) |

In short: **when one side is empty or invalid the valid key wins; when both are valid but different, neither overwrites the other.** The same key is never synced twice.

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

**The first visit is a forced caching flow.** A first visit opens the "get the full experience" window, and that window **cannot be closed or ignored** — you must press the cache button first, which downloads every asset once (the window re-opens itself if bypassed), and only then does the console open. Afterwards the console runs locally and works offline. Caching uses the browser's Cache Storage, so the page must be served over `http://`/`https://` and allowed to store site data. When the site is updated you are offered a re-cache through a notification or a banner.

After caching, the activation screen still appears (the browser edition has the same first-run setup), followed by the app-launch guide.

**App launching.** The browser cannot use Bluetooth; to connect to hardware you need the Android or Windows app. The guide offers **Open App**, **Download App**, **Cache page**, and a "don't ask again" checkbox; if the app is not installed, pressing Open App switches to the download prompt after about two seconds.

The **Settings → Web Cache & App** group repeats the cache, launch and download actions at any time.

---

# 11. Troubleshooting

| Symptom | What to check |
|---|---|
| The client is in the wrong language | Change the system language, or switch manually — a manual switch is permanent and overrides detection |
| The Slave shows a different language from the console | That is intended: the Slave keeps its own language now. Set it on the Slave |
| The Slave cannot find the console | Make sure the console is advertising (open its connection dialog and start), keep the two devices within a few metres, and give the scan its ten seconds |
| QR code will not scan | Only the native shells generate usable codes; in a browser the QR area stays empty. Use scanning instead |
| The Windows launcher waits forever | Add at least one USB rule, or press F2 for test mode |
| Speech recognition does not respond | Check the microphone permission, keep the app in the foreground, and confirm the interface language matches how you are speaking |
| The watch disconnects by itself | Open the keep-alive guidance from the Bluetooth dialog and add the app to the battery-optimisation whitelist |
| A settings change had no effect | Settings are written when you press **Apply Changes**, not as you type |
| The console reopens the first-run screen | It reappears only if setup was never completed; complete or skip it |

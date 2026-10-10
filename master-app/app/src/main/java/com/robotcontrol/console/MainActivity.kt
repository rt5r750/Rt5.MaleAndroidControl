package com.robotcontrol.console

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.MotionEvent
import android.view.TextureView
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebChromeClient.FileChooserParams
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.provider.Settings
import android.widget.Toast
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.robotcontrol.console.ble.BleConstants
import com.robotcontrol.console.ble.BlePermissionHelper
import com.robotcontrol.console.ble.BleScanner
import com.robotcontrol.console.ble.BondStore
import com.robotcontrol.console.ble.RobotGattServer
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.net.HttpURLConnection
import java.net.URL
import java.util.EnumMap
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var safeAreaTop: Int = 0
    private var safeAreaBottom: Int = 0
    private var imeHeightPx: Int = 0
    private var isPageLoaded: Boolean = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var connecting = false
    private var btConnectTimeoutRunnable: Runnable? = null
    private val CONNECT_TIMEOUT_MS = 10000L

    private val PREFS_NAME = "mimo_tts_prefs"
    private val PREF_KEY_MIMO_TOKEN = "mimo_tts_token"
    private val PREF_KEY_TTS_ENGINE = "tts_engine"
    private val DEFAULT_TTS_ENGINE = "voicedesign"
    private lateinit var ttsPrefs: SharedPreferences
    private val networkExecutor = Executors.newFixedThreadPool(2)

    /** API Key 清洗：去除首尾空白与成对引号（粘贴/同步时可能带入 "sk-..."） */
    private fun normalizeApiKey(key: String?): String {
        var k = (key ?: "").trim()
        if (k.length >= 2 &&
            ((k.startsWith("\"") && k.endsWith("\"")) ||
                (k.startsWith("'") && k.endsWith("'")))) {
            k = k.substring(1, k.length - 1).trim()
        }
        return k
    }

    // 原生 TTS 音频播放器（解决 WebView Blob URL 静默失败问题）
    @Volatile private var ttsMediaPlayer: MediaPlayer? = null
    private val ttsMediaPlayerLock = Any()

    // MiMo Fetch 异步结果存储（通知+拉取模式，避免 evaluateJavascript 传递大响应超 Binder 限制）
    private val mimoFetchResults = java.util.concurrent.ConcurrentHashMap<String, String>()

    // 闪屏视频相关
    private var splashVideoView: TextureView? = null
    private var splashMediaPlayer: MediaPlayer? = null
    @Volatile private var videoFirstFrameRendered = false
    @Volatile private var videoEnded = false
    @Volatile private var webReady = false
    @Volatile private var splashDismissed = false
    /** 是否已提前结束播放（触摸跳过/错误/超时）：帧仍保留在屏幕上等待页面就绪 */
    @Volatile private var skipRequested = false
    private var splashSurface: android.view.Surface? = null
    @Volatile private var splashPlayerPrepared = false
    private val splashTimeoutRunnable = Runnable {
        if (!splashDismissed) {
            android.util.Log.w(TAG, "Splash video timeout")
            endSplashPlayback("timeout")
        }
    }
    private val SPLASH_TIMEOUT_MS = 8000L
    /** 提前结束播放后等待页面就绪的上限：到点强制揭开，避免卡在最后一帧 */
    private val FORCE_REVEAL_MS = 4000L

    private val pickMedia = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            fileChooserCallback?.onReceiveValue(arrayOf(uri))
        } else {
            fileChooserCallback?.onReceiveValue(null)
        }
        fileChooserCallback = null
    }

    private val getContent = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            fileChooserCallback?.onReceiveValue(arrayOf(uri))
        } else {
            fileChooserCallback?.onReceiveValue(null)
        }
        fileChooserCallback = null
    }

    private val btPermissionLauncher: ActivityResultLauncher<Array<String>> =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            if (permissions.values.all { it }) {
                if (!BlePermissionHelper.isBluetoothEnabled(this)) {
                    enableBtLauncher.launch(BlePermissionHelper.getEnableBluetoothIntent())
                } else {
                    startBleServices()
                }
            } else {
                showToastSafely(ConsoleI18n.t("蓝牙权限被拒绝"))
            }
        }

    private val enableBtLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                startBleServices()
            } else {
                showToastSafely(ConsoleI18n.t("蓝牙未开启"))
            }
        }

    @Volatile
    private var modalOpen: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        ConsoleI18n.init(this)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        setupWebView()
        setupWindowInsets()

        // 初始化闪屏视频覆盖层（与 WebView 并行加载，遮住加载过程）
        splashVideoView = findViewById(R.id.splashVideoView)
        initSplashVideo()

        btConnectTimeoutRunnable = Runnable {
            if (connecting) {
                connecting = false
                webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_DISCONNECTED})", null)
            }
        }

        BondStore.init(this)
        ttsPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (modalOpen) {
                    webView.evaluateJavascript("closeActiveModal();", null)
                } else if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        if (!BlePermissionHelper.hasAllPermissions(this)) {
            btPermissionLauncher.launch(BlePermissionHelper.getMissingPermissions(this).toTypedArray())
        } else if (!BlePermissionHelper.isBluetoothEnabled(this)) {
            enableBtLauncher.launch(BlePermissionHelper.getEnableBluetoothIntent())
        } else {
            // 验证陈旧连接状态，防止 Activity 重建后残留的上次连接条目导致"异常连接成功"
            RobotGattServer.validateConnectedDevices()
            startBleServices()
        }

        RobotGattServer.onConnectionStateChanged = { connected, addr ->
            mainHandler.post {
                btConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                if (connected) {
                    connecting = false
                    if (addr != null) BondStore.saveBoundedClientAddress(addr)
                    showToastSafely(ConsoleI18n.t("蓝牙已连接"))
                    val addrJson = addr?.let { "\"$it\"" } ?: "null"
                    webView.evaluateJavascript("btNotifyDeviceConnected($addrJson)", null)
                } else {
                    connecting = false
                    val manualDisconnect = RobotGattServer.consumeManualDisconnect()
                    if (manualDisconnect) {
                        showToastSafely(ConsoleI18n.t("连接已手动断开"))
                        webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_MANUAL_DISCONNECTED})", null)
                    } else {
                        showToastSafely(ConsoleI18n.t("蓝牙已断开"))
                        webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_DISCONNECTED})", null)
                    }
                }
            }
        }

        /* 反向模式推送：手机端写入 Mode(7501) → 控制台切换到对应模式并提示「推送成功」 */
        RobotGattServer.onModeReceived = { ordinal ->
            mainHandler.post {
                webView.evaluateJavascript(
                    "if (typeof window.__rcOnRemoteMode === 'function') { window.__rcOnRemoteMode($ordinal); }",
                    null
                )
                showToastSafely(ConsoleI18n.t("推送成功"))
            }
        }

        RobotGattServer.onApiKeyReceived = { apiKey ->
            mainHandler.post {
                if (apiKey.isNotEmpty()) {
                    /* v1.11.0 双端同步矩阵：原生层不再无条件覆写 SharedPreferences，
                       统一交前端 _onMimoApiKeySynced 裁决（本端可用且不同 → 各用各的），
                       决定采用时前端回调 Android.setMimoApiKey 落库 */
                    val cleanKey = normalizeApiKey(apiKey)
                    val escapedKey = cleanKey.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")
                    webView.evaluateJavascript("if (typeof window._onMimoApiKeySynced === 'function') { window._onMimoApiKeySynced(\"$escapedKey\"); }", null)
                }
            }
        }

        webView.loadUrl("file:///android_asset/www/芮誊T系列仿人男性机器人控制台V1.1.html")
    }

    /**
     * 安全弹出 Toast：闪屏期间（splashDismissed == false）抑制所有 Toast，
     * 避免遮挡品牌启动动画。闪屏结束后恢复正常。
     */
    private fun showToastSafely(message: String) {
        if (!splashDismissed) return
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun setupWebView() {
        // 仅 debug 构建启用 WebView 远程调试（Release 不受影响）
        if ((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            // Android 12 WebView 默认要求用户手势才能播放媒体，设为 false 以允许静音视频自动播放
            mediaPlaybackRequiresUserGesture = false
        }

        webView.setBackgroundColor(Color.BLACK)
        webView.background = null
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        webView.addJavascriptInterface(object : Any() {
            @JavascriptInterface
            fun getSafeAreaTop(): Int = safeAreaTop

            @JavascriptInterface
            fun getSafeAreaBottom(): Int = safeAreaBottom

            @JavascriptInterface
            fun getImeHeight(): Int = imeHeightPx

            @JavascriptInterface
            fun setModalState(open: Boolean) {
                modalOpen = open
            }

            // 界面语言同步：www 设置里切换中文/English 时写入 robot_ui_lang，原生 Toast 随动；
            // 同时经 7507(UiLang) 推给已连接的 phone/watch 客户端（slave 旧版依此切换显示语言（1.10.0 起当前版 slave 语言本机决定））
            @JavascriptInterface
            fun setUiLang(lang: String?) {
                val next = lang ?: "zh"
                ConsoleI18n.setLang(this@MainActivity, next)
                RobotGattServer.sendUiLang(next)
            }

            @JavascriptInterface
            fun openExternalUrl(url: String) {
                openExternalBrowser(url)
            }

            @JavascriptInterface
            fun openPdfFile(filePath: String) {
                mainHandler.post {
                    try {
                        val uri: Uri?
                        val mimeType: String

                        when {
                            filePath.startsWith("http://") || filePath.startsWith("https://") -> {
                                uri = Uri.parse(filePath)
                                mimeType = "application/pdf"
                            }
                            filePath.startsWith("file:///android_asset/") -> {
                                val assetPath = filePath.removePrefix("file:///android_asset/")
                                uri = copyAssetPdfToCacheAndGetUri(assetPath) ?: return@post
                                mimeType = "application/pdf"
                            }
                            else -> {
                                val cleanPath = filePath.removePrefix("./")
                                val assetPath = "www/$cleanPath"
                                uri = copyAssetPdfToCacheAndGetUri(assetPath) ?: return@post
                                mimeType = "application/pdf"
                            }
                        }

                        val intent = Intent(Intent.ACTION_VIEW)
                        intent.setDataAndType(uri, mimeType)
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

                        try {
                            startActivity(intent)
                        } catch (e: ActivityNotFoundException) {
                            Toast.makeText(this@MainActivity, ConsoleI18n.t("未找到可打开PDF的应用，请安装PDF阅读器"), Toast.LENGTH_LONG).show()
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        Toast.makeText(this@MainActivity, ConsoleI18n.t("无法打开PDF: ") + e.message, Toast.LENGTH_SHORT).show()
                    }
                }
            }

            @JavascriptInterface
            fun btGetStatus(): Int {
                return when {
                    RobotGattServer.isConnected() -> BleConstants.BLE_STATUS_CONNECTED
                    connecting -> BleConstants.BLE_STATUS_CONNECTING
                    BondStore.hasClientBond() -> BleConstants.BLE_STATUS_DISCONNECTED
                    else -> BleConstants.BLE_STATUS_UNBONDED
                }
            }

            @JavascriptInterface
            fun btUnbond() {
                mainHandler.post {
                    RobotGattServer.sendDisconnectNotification()
                    RobotGattServer.setManualDisconnectReceived()
                    RobotGattServer.disconnectAllClients()
                    RobotGattServer.ensureAdvertising()
                    BondStore.clearClientBond()
                    webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_MANUAL_DISCONNECTED})", null)
                }
            }

            @JavascriptInterface
            fun btShowQr(): String {
                if (!BlePermissionHelper.hasAllPermissions(this@MainActivity)) {
                    showToastSafely(ConsoleI18n.t("缺少蓝牙权限，请重新打开控制台授权"))
                    return ""
                }
                val mac = BlePermissionHelper.getLocalMacAddress(this@MainActivity)
                val json = "{\"mac\":\"$mac\",\"name\":\"${BleConstants.CONSOLE_DEVICE_NAME}\",\"service\":\"${BleConstants.SERVICE_UUID}\",\"role\":\"console\"}"
                return generateQrCodeBase64(json)
            }

            private fun generateQrCodeBase64(content: String): String {
                try {
                    val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java)
                    hints[EncodeHintType.ERROR_CORRECTION] = ErrorCorrectionLevel.L
                    hints[EncodeHintType.MARGIN] = 2
                    val writer = QRCodeWriter()
                    val qrSize = 500
                    val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, qrSize, qrSize, hints)
                    val width = bitMatrix.width
                    val height = bitMatrix.height
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    for (x in 0 until width) {
                        for (y in 0 until height) {
                            bitmap.setPixel(x, y, if (bitMatrix.get(x, y)) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
                        }
                    }
                    val baos = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos)
                    val bytes = baos.toByteArray()
                    bitmap.recycle()
                    return "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
                } catch (e: Exception) {
                    android.util.Log.e("QR", "Generate QR error", e)
                    return ""
                }
            }

            @JavascriptInterface
            fun btStartConnect() {
                mainHandler.post {
                    if (!BlePermissionHelper.hasAllPermissions(this@MainActivity)) {
                        showToastSafely(ConsoleI18n.t("缺少蓝牙权限，请重新打开控制台授权"))
                        webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_UNBONDED})", null)
                        return@post
                    }
                    connecting = true
                    RobotGattServer.validateConnectedDevices()
                    startBleServices()
                    RobotGattServer.ensureAdvertising()
                    // server 已经在运行，直接更新 UI 状态
                    if (BondStore.hasClientBond()) {
                        webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_CONNECTING})", null)
                    }
                    btConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                    btConnectTimeoutRunnable = Runnable {
                        connecting = false
                        webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_DISCONNECTED})", null)
                    }
                    mainHandler.postDelayed(btConnectTimeoutRunnable!!, CONNECT_TIMEOUT_MS)
                }
            }

            @JavascriptInterface
            fun onDataChanged(type: String, json: String) {
                mainHandler.post {
                    try {
                        when (type) {
                            "mode" -> {
                                val ordinal = json.toIntOrNull() ?: 0
                                RobotGattServer.sendMode(ordinal)
                            }
                            "emotion" -> {
                                val parts = json.split(",")
                                if (parts.size == 4) {
                                    val o = parts[0].trim().toIntOrNull() ?: 0
                                    val s = parts[1].trim().toIntOrNull() ?: 0
                                    val p = parts[2].trim().toIntOrNull() ?: 0
                                    val m = parts[3].trim().toIntOrNull() ?: 0
                                    RobotGattServer.sendEmotion(o.coerceIn(0,100), s.coerceIn(0,100), p.coerceIn(0,100), m.coerceIn(0,100))
                                }
                            }
                            "tasks" -> {
                                RobotGattServer.sendTasks(json)
                            }
                            "voice" -> {
                                val voiceData = if (json.trim().startsWith("{")) {
                                    json
                                } else {
                                    val voiceObj = JSONObject()
                                    voiceObj.put("timestamp", System.currentTimeMillis())
                                    voiceObj.put("content", json)
                                    voiceObj.toString()
                                }
                                RobotGattServer.sendVoice(voiceData)
                            }
                            "voice-history" -> {
                                RobotGattServer.sendVoice(json)
                            }
                            // ApiKey(7506) 下发（v1.11.0）：Master Key 可用、Slave 空/不可用时推给 Slave
                            "apikey" -> {
                                RobotGattServer.sendApiKey(json)
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("BleBridge", "onDataChanged error: $type", e)
                    }
                }
            }

            @JavascriptInterface
            fun btOnPageLoaded() {
                mainHandler.post {
                    if (!BondStore.hasClientBond() && !RobotGattServer.isConnected() && !connecting) {
                        startColdStartScan()
                    }
                }
            }

            @JavascriptInterface
            fun getMimoApiKey(): String {
                var raw = ttsPrefs.getString(PREF_KEY_MIMO_TOKEN, "") ?: ""
                if (raw.isEmpty()) {
                    // 向下兼容：迁移旧版本存储键（mimo_api_key）下的值
                    raw = ttsPrefs.getString("mimo_api_key", "") ?: ""
                    if (raw.isNotEmpty()) {
                        ttsPrefs.edit().putString(PREF_KEY_MIMO_TOKEN, raw).apply()
                        ttsPrefs.edit().remove("mimo_api_key").apply()
                    }
                }
                val key = normalizeApiKey(raw)
                if (key != raw) ttsPrefs.edit().putString(PREF_KEY_MIMO_TOKEN, key).apply()
                return key
            }

            @JavascriptInterface
            fun setMimoApiKey(key: String) {
                ttsPrefs.edit().putString(PREF_KEY_MIMO_TOKEN, normalizeApiKey(key)).apply()
            }

            @JavascriptInterface
            fun getTtsEngine(): String {
                val saved = ttsPrefs.getString(PREF_KEY_TTS_ENGINE, DEFAULT_TTS_ENGINE) ?: DEFAULT_TTS_ENGINE
                // 兼容旧版本：voiceclone 引擎已移除，降级为 birch
                if (saved == "voiceclone") {
                    ttsPrefs.edit().putString(PREF_KEY_TTS_ENGINE, DEFAULT_TTS_ENGINE).apply()
                    android.util.Log.i(TAG, "Migrated legacy voiceclone engine to birch")
                    return DEFAULT_TTS_ENGINE
                }
                return saved
            }

            @JavascriptInterface
            fun setTtsEngine(engine: String) {
                ttsPrefs.edit().putString(PREF_KEY_TTS_ENGINE, engine).apply()
            }

            @JavascriptInterface
            fun mimoFetchAsync(bodyJson: String, callbackId: String) {
                networkExecutor.execute {
                    val resultStr = try {
                        val apiKey = normalizeApiKey(ttsPrefs.getString(PREF_KEY_MIMO_TOKEN, "") ?: "")
                        android.util.Log.d("MimoTTS", "mimoFetchAsync called, apiKey=${if (apiKey.isNotEmpty()) "set(${apiKey.take(8)}...)" else "empty"}, bodyLen=${bodyJson.length}")
                        val url = URL("https://api.xiaomimimo.com/v1/chat/completions")
                        val connection = url.openConnection() as HttpURLConnection
                        connection.requestMethod = "POST"
                        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                        connection.setRequestProperty("api-key", apiKey)
                        connection.doOutput = true
                        connection.doInput = true
                        connection.connectTimeout = 15000
                        connection.readTimeout = 60000
                        connection.instanceFollowRedirects = true
                        connection.useCaches = false

                        val bodyBytes = bodyJson.toByteArray(StandardCharsets.UTF_8)
                        connection.setRequestProperty("Content-Length", bodyBytes.size.toString())
                        DataOutputStream(connection.outputStream).use { os ->
                            os.write(bodyBytes)
                            os.flush()
                        }

                        val responseCode = connection.responseCode
                        android.util.Log.d("MimoTTS", "mimoFetchAsync responseCode=$responseCode")
                        val inputStream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                        
                        val respBytes = ByteArrayOutputStream().use { baos ->
                            val buffer = ByteArray(4096)
                            var bytesRead: Int
                            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                baos.write(buffer, 0, bytesRead)
                            }
                            baos.toByteArray()
                        }
                        val respStr = String(respBytes, StandardCharsets.UTF_8)
                        
                        connection.disconnect()
                        if (responseCode !in 200..299) {
                            android.util.Log.e("MimoTTS", "mimoFetchAsync HTTP error $responseCode: ${respStr.take(500)}")
                            val errMsg = respStr.replace("\"", "'").take(400)
                            "{\"error\":\"HTTP $responseCode: $errMsg\"}"
                        } else {
                            android.util.Log.d("MimoTTS", "mimoFetchAsync success, respLen=${respStr.length}")
                            respStr
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("MimoTTS", "mimoFetchAsync failed", e)
                        val errMsg = e.message?.replace("\"", "'")?.take(300) ?: "Unknown error"
                        "{\"error\":\"${e.javaClass.simpleName}: $errMsg\"}"
                    }
                    mimoFetchResults[callbackId] = resultStr
                    callMimoFetchCallback(callbackId)
                }
            }

            @JavascriptInterface
            fun getRotationVideoBgColor(): String = "29,62,29"

            @JavascriptInterface
            fun btHasClientBond(): Boolean {
                return BondStore.hasClientBond()
            }

            /**
             * 原生音频播放（异步非阻塞，通过 evaluateJavascript 回调 JS 层）。
             * 解决 WebView 中 new Audio(blobUrl).play() 在 file:// origin 下静默失败的问题。
             * 播放完成后调用 window.__ttsOnComplete(callbackId, resultJson)。
             */
            @JavascriptInterface
            fun playAudioBase64(base64Data: String, mimeType: String, callbackId: String) {
                android.util.Log.d("TtsAudio", "playAudioBase64 called, dataLen=${base64Data.length}, cbId=$callbackId")
                if (base64Data.isEmpty()) {
                    callTtsCallback(callbackId, "{\"ok\":false,\"error\":\"empty base64\"}")
                    return
                }
                networkExecutor.execute {
                    var tmpFile: File? = null
                    try {
                        val audioBytes = Base64.decode(base64Data, Base64.NO_WRAP)
                        if (audioBytes.isEmpty()) {
                            callTtsCallback(callbackId, "{\"ok\":false,\"error\":\"decoded empty\"}")
                            return@execute
                        }
                        android.util.Log.d("TtsAudio", "Decoded audio bytes: ${audioBytes.size}")

                        tmpFile = File(cacheDir, "tts_${System.currentTimeMillis()}.wav")
                        FileOutputStream(tmpFile).use { it.write(audioBytes) }
                        val filePath = tmpFile.absolutePath
                        android.util.Log.d("TtsAudio", "Temp file: $filePath")

                        mainHandler.post {
                            try {
                                synchronized(ttsMediaPlayerLock) {
                                    try { ttsMediaPlayer?.release() } catch (_: Exception) {}
                                    ttsMediaPlayer = null
                                }

                                val mp = MediaPlayer()
                                mp.setAudioAttributes(
                                    AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_MEDIA)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                                        .build()
                                )
                                mp.setDataSource(filePath)
                                mp.setOnPreparedListener {
                                    android.util.Log.d("TtsAudio", "MediaPlayer prepared, starting playback")
                                    mp.start()
                                }
                                mp.setOnCompletionListener {
                                    android.util.Log.d("TtsAudio", "Playback completed")
                                    synchronized(ttsMediaPlayerLock) {
                                        try { ttsMediaPlayer?.release() } catch (_: Exception) {}
                                        ttsMediaPlayer = null
                                    }
                                    tmpFile.delete()
                                    callTtsCallback(callbackId, "{\"ok\":true}")
                                }
                                mp.setOnErrorListener { _, what, extra ->
                                    android.util.Log.e("TtsAudio", "MediaPlayer error what=$what extra=$extra")
                                    synchronized(ttsMediaPlayerLock) {
                                        try { ttsMediaPlayer?.release() } catch (_: Exception) {}
                                        ttsMediaPlayer = null
                                    }
                                    tmpFile.delete()
                                    callTtsCallback(callbackId, "{\"ok\":false,\"error\":\"MediaPlayer error $what/$extra\"}")
                                    true
                                }
                                mp.prepareAsync()
                                synchronized(ttsMediaPlayerLock) {
                                    ttsMediaPlayer = mp
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("TtsAudio", "Failed to start MediaPlayer", e)
                                tmpFile.delete()
                                val errMsg = e.message?.replace("\"", "'")?.take(200) ?: "Exception"
                                callTtsCallback(callbackId, "{\"ok\":false,\"error\":\"$errMsg\"}")
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("TtsAudio", "playAudioBase64 bg error", e)
                        tmpFile?.delete()
                        val errMsg = e.message?.replace("\"", "'")?.take(200) ?: "Exception"
                        callTtsCallback(callbackId, "{\"ok\":false,\"error\":\"$errMsg\"}")
                    }
                }
            }

            private fun callTtsCallback(callbackId: String, resultJson: String) {
                mainHandler.post {
                    val escaped = resultJson.replace("\\", "\\\\").replace("'", "\\'")
                    val js = "if(window.__ttsOnComplete)window.__ttsOnComplete('$callbackId','$escaped')"
                    webView.evaluateJavascript(js, null)
                }
            }

            private fun callMimoFetchCallback(callbackId: String) {
                mainHandler.post {
                    val js = "if(window.__mimoFetchCallback)window.__mimoFetchCallback('$callbackId')"
                    webView.evaluateJavascript(js, null)
                }
            }

            @JavascriptInterface
            fun getMimoFetchResult(cbId: String): String {
                val result = mimoFetchResults.remove(cbId) ?: "{\"error\":\"result not found for $cbId\"}"
                android.util.Log.d("MimoTTS", "getMimoFetchResult cbId=$cbId, resultLen=${result.length}")
                return result
            }

            /** 停止当前原生音频播放，并通知所有未完成的回调。 */
            @JavascriptInterface
            fun stopAudio() {
                mainHandler.post {
                    synchronized(ttsMediaPlayerLock) {
                        try {
                            ttsMediaPlayer?.let {
                                if (it.isPlaying) it.stop()
                                it.release()
                            }
                        } catch (_: Exception) {}
                        ttsMediaPlayer = null
                    }
                }
            }
        }, "Android")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request?.isForMainFrame == false) {
                    return false
                }
                val url = request?.url?.toString() ?: return false
                return handleUrlLoading(view, url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isPageLoaded = true
                modalOpen = false
                RobotGattServer.ensureAdvertising()
                updateSafeAreaInsets()
                view?.evaluateJavascript("if (typeof notifyModalState === 'function') { notifyModalState(); }", null)
                if (!RobotGattServer.isRunning()) {
                    startBleServices()
                }
                // WebView 加载完成，通知闪屏层可以移除
                webReady = true
                checkSplashDismiss()
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback

                val acceptTypes = fileChooserParams?.acceptTypes
                val isImage = acceptTypes?.any { it.contains("image", ignoreCase = true) } == true

                return try {
                    if (isImage) {
                        pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    } else {
                        val mimeType = acceptTypes?.firstOrNull()?.takeIf { it.isNotBlank() } ?: "*/*"
                        getContent.launch(mimeType)
                    }
                    true
                } catch (e: Exception) {
                    try {
                        getContent.launch(if (isImage) "image/*" else "*/*")
                        true
                    } catch (e2: Exception) {
                        fileChooserCallback = null
                        false
                    }
                }
            }
        }
    }

    /* 外部链接（http/https）一律交给系统默认浏览器打开，控制台 WebView 不原地加载：
       设置里的 MiMo 官网链接、夸克网盘下载、Telegram 等用户主动点击的外链，
       以及 target="_blank" 的锚点（WebView 未开多窗口，默认会在本 WebView 内导航、顶掉控制台界面）。
       站内资源（file:///android_asset/、blob:、about:）与页面内锚点不受影响。 */
    private fun handleUrlLoading(view: WebView?, url: String): Boolean {
        val lower = url.lowercase(java.util.Locale.ROOT)
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            openExternalBrowser(url)
            return true
        }
        return false
    }

    private fun openExternalBrowser(url: String) {
        mainHandler.post {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (intent.resolveActivity(packageManager) != null) {
                    startActivity(intent)
                } else {
                    Toast.makeText(this, ConsoleI18n.t("未找到可打开链接的浏览器应用"), Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this, ConsoleI18n.t("无法打开链接: ") + e.message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun copyAssetPdfToCacheAndGetUri(assetPath: String): Uri? {
        return try {
            val pdfDir = File(cacheDir, "pdfs")
            if (!pdfDir.exists()) {
                pdfDir.mkdirs()
            }
            val fileName = assetPath.substringAfterLast('/')
            val cachedFile = File(pdfDir, fileName)
            if (!cachedFile.exists()) {
                assets.open(assetPath).use { input ->
                    FileOutputStream(cachedFile).use { output ->
                        input.copyTo(output)
                    }
                }
            }
            FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                cachedFile
            )
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, ConsoleI18n.t("无法准备PDF文件: ") + e.message, Toast.LENGTH_SHORT).show()
            null
        }
    }

    private fun resolveUrl(baseUrl: String?, relativeUrl: String): String {
        if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://") || relativeUrl.startsWith("file://")) {
            return relativeUrl
        }
        return try {
            if (baseUrl == null) return relativeUrl
            val cleanRelative = relativeUrl.removePrefix("./")
            val lastSlash = baseUrl.lastIndexOf('/')
            if (lastSlash != -1) {
                baseUrl.substring(0, lastSlash + 1) + cleanRelative
            } else {
                cleanRelative
            }
        } catch (e: Exception) {
            relativeUrl
        }
    }

    private fun setupWindowInsets() {
        val density = resources.displayMetrics.density
        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            safeAreaTop = (systemBars.top / density).toInt()
            safeAreaBottom = (systemBars.bottom / density).toInt()
            imeHeightPx = imeInsets.bottom
            updateSafeAreaInsets()
            insets
        }
        ViewCompat.requestApplyInsets(window.decorView)
    }

    private fun updateSafeAreaInsets() {
        if (isPageLoaded) {
            val js = "if (typeof updateSafeAreaInsets === 'function') { updateSafeAreaInsets($imeHeightPx); }"
            webView.evaluateJavascript(js, null)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            ViewCompat.requestApplyInsets(window.decorView)
        }
    }

    /**
     * 初始化闪屏视频：TextureView 覆盖在 WebView 之上，播放 Rt5Open.mp4 遮住加载过程。
     * 视频与 WebView 并行加载，两者都完成后移除视频层。
     */
    private fun initSplashVideo() {
        val textureView = splashVideoView ?: return
        textureView.visibility = View.VISIBLE
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        textureView.isOpaque = true
        videoFirstFrameRendered = false

        // 后台线程：将视频复制到缓存目录，避免 setDataSource(fd, offset, length) 的 offset 兼容性问题
        val splashCacheFile = java.io.File(cacheDir, "splash_video.mp4")
        networkExecutor.execute {
            try {
                splashCacheFile.parentFile?.mkdirs()
                assets.open("www/pic/Rt5Open.mp4").use { input ->
                    java.io.FileOutputStream(splashCacheFile).use { output ->
                        input.copyTo(output)
                    }
                }
                android.util.Log.d(TAG, "Splash video copied to cache: ${splashCacheFile.absolutePath} (${splashCacheFile.length()} bytes)")
                mainHandler.post { prepareSplashPlayer(splashCacheFile) }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to copy splash video to cache", e)
            }
        }

        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                android.util.Log.d(TAG, "Splash surface available: surf=${width}x${height}, view=${textureView.width}x${textureView.height}")
                if (splashDismissed) return
                mainHandler.removeCallbacks(splashTimeoutRunnable)
                mainHandler.postDelayed(splashTimeoutRunnable, SPLASH_TIMEOUT_MS)
                splashSurface = android.view.Surface(surface)
                // 若 MediaPlayer 已提前准备好，立即绑定 Surface 并开始播放
                if (splashMediaPlayer != null && splashPlayerPrepared) {
                    splashMediaPlayer?.setSurface(splashSurface)
                    splashMediaPlayer?.start()
                    android.util.Log.d(TAG, "Splash: surface ready, player already prepared → starting immediately")
                } else if (splashMediaPlayer != null) {
                    // MediaPlayer 存在但尚未 prepared，绑定 Surface 等待 onPrepared 中 start
                    splashMediaPlayer?.setSurface(splashSurface)
                    android.util.Log.d(TAG, "Splash: surface ready, player not yet prepared → surface set, waiting for onPrepared")
                } else {
                    android.util.Log.d(TAG, "Splash: surface ready, player not yet created → waiting for prepareSplashPlayer")
                }
            }
            override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
                android.util.Log.d(TAG, "Splash surface size changed: surf=${width}x${height}")
            }
            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean = false
            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
        }

        textureView.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_DOWN && !splashDismissed) {
                android.util.Log.d(TAG, "User touched to skip splash")
                endSplashPlayback("touch")
            }
            true
        }

        mainHandler.postDelayed(splashTimeoutRunnable, SPLASH_TIMEOUT_MS)
    }

    /**
     * 提前准备闪屏 MediaPlayer（在后台线程复制视频到缓存后调用）。
     * 使用文件路径 setDataSource，避免 asset FileDescriptor offset 兼容性问题。
     * 若 Surface 已就绪则立即绑定，否则等待 onSurfaceTextureAvailable 绑定。
     */
    private fun prepareSplashPlayer(cachedFile: java.io.File) {
        if (splashDismissed) return
        try {
            splashMediaPlayer = MediaPlayer().apply {
                setDataSource(cachedFile.absolutePath)
                // GPU 硬件级 centerCrop 缩放，避免手动 resize 导致主线程 layout thrash 引起掉帧
                setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING)
                // 若 Surface 已就绪（SurfaceTexture 先于文件复制完成到达），立即绑定
                splashSurface?.let { setSurface(it) }
                isLooping = false
                setOnPreparedListener { mp ->
                    android.util.Log.d(TAG, "Splash video prepared, duration=${mp.duration}ms, videoSize=${mp.videoWidth}x${mp.videoHeight}")
                    mainHandler.removeCallbacks(splashTimeoutRunnable)
                    if (splashDismissed) return@setOnPreparedListener
                    splashPlayerPrepared = true
                    // 若 Surface 已绑定，立即开始播放
                    if (splashSurface != null) {
                        mp.start()
                        android.util.Log.d(TAG, "Splash: onPrepared → surface already set, starting immediately")
                    }
                }
                setOnInfoListener { _, what, extra ->
                    if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START ||
                        (what == 3 && extra == 3)) {
                        android.util.Log.d(TAG, "Splash video first frame rendered")
                        videoFirstFrameRendered = true
                    }
                    false
                }
                setOnCompletionListener { _ ->
                    android.util.Log.d(TAG, "Splash video completed, waiting for WebView ready")
                    videoEnded = true
                    checkSplashDismiss()
                }
                setOnErrorListener { mp, what, extra ->
                    android.util.Log.e(TAG, "Splash MediaPlayer error: what=$what extra=$extra")
                    mp.release()
                    splashMediaPlayer = null
                    endSplashPlayback("media error")
                    true
                }
                prepareAsync()
            }
            android.util.Log.d(TAG, "Splash: prepareSplashPlayer started (surface=${if (splashSurface != null) "set" else "not yet"})")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to prepare splash player", e)
            endSplashPlayback("prepare exception")
        }
    }

    /**
     * 检查是否可以移除闪屏：视频结束且 WebView 加载完成。
     * 若视频已结束但 WebView 未加载完，停在最后一帧等待；若 WebView 先加载完，则等视频结束。
     */
    private fun checkSplashDismiss() {
        if (splashDismissed) return
        if (videoEnded && webReady) {
            android.util.Log.d(TAG, "Both video ended and web ready, dismiss splash")
            dismissSplashVideo()
        } else if (videoEnded && !webReady) {
            android.util.Log.d(TAG, "Video ended but web not ready, holding last frame")
        } else if (!videoEnded && webReady) {
            android.util.Log.d(TAG, "Web ready but video not ended, waiting for video")
        }
    }

    /**
     * 提前结束播放（触摸跳过 / 播放错误 / 超时）：**不立刻揭开**，而是停播并保留最后一帧，
     * 等 WebView 就绪后再由 checkSplashDismiss() 揭开。
     * 直接 dismiss 会在页面尚未绘制时露出黑底（实测：触摸跳过约 0.25s 时 98.9% 像素为黑），
     * 而品牌 PV 的意义正是遮住这段加载过程。
     * 强制兜底 FORCE_REVEAL_MS：页面异常时也不能一直停在最后一帧。
     */
    private fun endSplashPlayback(reason: String) {
        if (splashDismissed) return
        if (!skipRequested) {
            skipRequested = true
            android.util.Log.d(TAG, "Splash playback ended early: $reason")
        }
        try {
            splashMediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
            splashMediaPlayer = null
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Error releasing splash MediaPlayer", e)
        }
        // 停播即视为「不再有视频在播」，但帧仍在屏幕上；页面就绪后 checkSplashDismiss() 会揭开
        videoEnded = true
        checkSplashDismiss()
        // 页面迟迟不就绪时的兜底：到点无条件揭开，避免卡在最后一帧
        mainHandler.postDelayed(forceRevealRunnable, FORCE_REVEAL_MS)
    }

    private val forceRevealRunnable = Runnable {
        if (!splashDismissed) {
            android.util.Log.w(TAG, "Splash force reveal (web page still not ready)")
            dismissSplashVideo()
        }
    }

    private fun dismissSplashVideo() {
        if (splashDismissed) return
        splashDismissed = true
        mainHandler.removeCallbacks(splashTimeoutRunnable)
        mainHandler.removeCallbacks(forceRevealRunnable)
        try {
            splashMediaPlayer?.let {
                it.stop()
                it.release()
            }
            splashMediaPlayer = null
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Error releasing splash MediaPlayer", e)
        }
        splashVideoView?.let { v ->
            // 淡出动画，平滑过渡到 WebView
            v.animate()
                .alpha(0f)
                .setDuration(200)
                .withEndAction {
                    v.visibility = View.GONE
                }
                .start()
        }
        // 清理缓存视频文件
        try {
            val cacheFile = java.io.File(cacheDir, "splash_video.mp4")
            if (cacheFile.exists()) cacheFile.delete()
        } catch (_: Exception) {}
        splashSurface = null
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun startBleServices() {
        /* 连接入口统一兜底：权限缺失或 BLE 层异常只提示，不允许异常穿透导致 App 闪退 */
        if (!BlePermissionHelper.hasAllPermissions(this)) {
            showToastSafely(ConsoleI18n.t("缺少蓝牙权限，请重新打开控制台授权"))
            return
        }
        try {
            RobotGattServer.initialize(this)
            RobotGattServer.startServer(this)
            RobotGattServer.ensureAdvertising()
            if (BondStore.hasClientBond()) {
                webView.evaluateJavascript("updateBtStatus(${BleConstants.BLE_STATUS_CONNECTING})", null)
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "startBleServices failed", e)
            showToastSafely(ConsoleI18n.t("连接失败"))
        }
    }

    @Volatile
    private var coldStartScanning = false

    /**
     * 冷启动扫描附近可连接设备：先静默扫描，搜索到设备后弹窗提示用户，超时则 toast 提示连接失败。
     * 使用 Android 12+ 的 BluetoothLeScanner + ScanFilter 新接口。
     */
    private fun startColdStartScan() {
        if (coldStartScanning) return
        coldStartScanning = true

        if (!BlePermissionHelper.hasAllPermissions(this)) {
            coldStartScanning = false
            showToastSafely(ConsoleI18n.t("连接失败"))
            return
        }
        if (!BlePermissionHelper.isBluetoothEnabled(this)) {
            coldStartScanning = false
            showToastSafely(ConsoleI18n.t("连接失败"))
            return
        }

        BleScanner.initialize(this)
        val foundFlag = java.util.concurrent.atomic.AtomicBoolean(false)
        BleScanner.startScan(this, BleConstants.SCAN_DURATION_MS) { _, _ ->
            if (foundFlag.compareAndSet(false, true)) {
                mainHandler.post {
                    webView.evaluateJavascript("btShowDeviceFoundModal()", null)
                }
                BleScanner.stopScan()
            }
        }

        mainHandler.postDelayed({
            coldStartScanning = false
            if (!foundFlag.get()) {
                showToastSafely(ConsoleI18n.t("连接失败"))
            }
        }, BleConstants.SCAN_DURATION_MS + 200)
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.post {
            RobotGattServer.onConnectionStateChanged = null
            RobotGattServer.onApiKeyReceived = null
        }
        mainHandler.removeCallbacks(splashTimeoutRunnable)
        try {
            splashMediaPlayer?.release()
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Error releasing splash MediaPlayer in onDestroy", e)
        }
        splashMediaPlayer = null
        synchronized(ttsMediaPlayerLock) {
            try { ttsMediaPlayer?.release() } catch (_: Exception) {}
            ttsMediaPlayer = null
        }
    }

    companion object {
        private const val TAG = "MainActivity"
    }

}

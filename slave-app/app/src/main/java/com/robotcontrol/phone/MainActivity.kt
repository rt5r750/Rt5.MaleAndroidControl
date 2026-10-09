package com.robotcontrol.phone

import android.app.Dialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color as GfxColor
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.robotcontrol.phone.ble.BleConstants
import com.robotcontrol.phone.ble.BlePermissionHelper
import com.robotcontrol.phone.ble.BondStore
import com.robotcontrol.phone.ble.ConsoleBleClient
import com.robotcontrol.phone.data.ApiKeyStore
import com.robotcontrol.phone.data.DataStoreListener
import com.robotcontrol.phone.data.Emotion
import com.robotcontrol.phone.data.Mode
import com.robotcontrol.phone.data.PhoneDataStore
import com.robotcontrol.phone.data.Task
import com.robotcontrol.phone.data.VoiceMessage
import com.robotcontrol.phone.speech.PhoneSpeechController
import com.robotcontrol.phone.ui.EmotionPanelView
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity(), DataStoreListener {

    private lateinit var root: FrameLayout
    private lateinit var scrollView: ScrollView
    private lateinit var contentLayout: LinearLayout
    private lateinit var capsule: TextView
    private lateinit var btConsoleBtn: TextView
    private lateinit var btWatchBtn: TextView
    private lateinit var asrBtn: ImageView
    private lateinit var topFixedContainer: FrameLayout
    private lateinit var topGradientBg: View
    private lateinit var emotionPanelContainer: FrameLayout
    private lateinit var emotionPanel: EmotionPanelView
    private lateinit var tasksColumn: LinearLayout
    private lateinit var voiceColumn: LinearLayout
    private lateinit var tasksContainer: LinearLayout
    private lateinit var voiceContainer: LinearLayout
    private lateinit var tasksEmpty: TextView
    private lateinit var voiceEmpty: TextView
    private var firstRunContainer: FrameLayout? = null

    private companion object {
        const val FIRST_RUN_PREFS = "first_run_prefs"
        const val KEY_FIRST_RUN_DONE = "first_run_done"
    }

    private val voiceTimeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    private val mainHandler = Handler(Looper.getMainLooper())

    private var density = 1f
    private var consoleStatus = BleConstants.BLE_STATUS_UNBONDED
    private var bleControlDialog: Dialog? = null
    private var dialogScanRunning = false
    private var dialogDiscoveredDevices = mutableListOf<Triple<String, String, Int>>()
    private var dialogDeviceViews = mutableMapOf<String, TextView>()
    private var dialogScanTimeoutRunnable: Runnable? = null
    private var dialogConnectTargetAddr: String? = null
    private var dialogConnectTimeoutRunnable: Runnable? = null
    private var dialogButtonsLayout: LinearLayout? = null
    private var dialogDeviceListContainer: LinearLayout? = null
    private var dialogStatusDot: View? = null
    private var dialogInfoTv: TextView? = null
    private var isBleDialogShowing = false
    private var isQrConnection = false

    /** 语音识别控制器（ASR，唯一在 slave-app 端运行） */
    private var speechController: PhoneSpeechController? = null

    /** 反向推送后的「推送成功」兜底定时任务（控制端回声未到时弹一条） */
    private var reversePushWatchdog: Runnable? = null

    /** 模式菜单项：显示名 / 控制台 BLE ordinal / 胶囊同款颜色 */
    private val modeMenuItems: List<Triple<String, Int, Int>> = listOf(
        Triple("调试模式", 0, GfxColor.parseColor("#8FBC8F")),
        Triple("恢复模式", 1, GfxColor.parseColor("#FB923C")),
        Triple("忠诚模式", 2, GfxColor.parseColor("#66CCFF")),
        Triple("拟人模式", 3, GfxColor.parseColor("#F472B6"))
    )

    private val qrScanLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                val qrData = result.data?.getStringExtra(QrScanActivity.EXTRA_QR_DATA)
                if (qrData != null) handleQrResult(qrData)
            }
        }

    private val cameraPermissionLauncher: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                qrScanLauncher.launch(Intent(this, QrScanActivity::class.java))
            } else {
                Toast.makeText(this, PhoneI18n.t("相机权限被拒绝，无法扫码"), Toast.LENGTH_SHORT).show()
            }
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
                Toast.makeText(this, PhoneI18n.t("蓝牙权限被拒绝"), Toast.LENGTH_SHORT).show()
                updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_DISCONNECTED)
            }
        }

    private val enableBtLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                startBleServices()
            } else {
                Toast.makeText(this, PhoneI18n.t("蓝牙未开启"), Toast.LENGTH_SHORT).show()
            }
        }

    private val notificationPermissionLauncher: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

    /** 语音识别（录音）权限：授权后立即开启识别 */
    private val recordPermissionLauncher: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                startSpeech(showToast = true)
            } else {
                ApiKeyStore.setAsrActive(false)
                updateAsrButtonState(false)
                Toast.makeText(this, PhoneI18n.t("缺少录音权限"), Toast.LENGTH_SHORT).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        density = resources.displayMetrics.density

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = GfxColor.TRANSPARENT
        window.navigationBarColor = GfxColor.TRANSPARENT
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        window.setBackgroundDrawableResource(android.R.color.black)
        setContentView(R.layout.activity_main)

        root = findViewById(R.id.root)
        scrollView = findViewById(R.id.scrollView)
        contentLayout = findViewById(R.id.contentLayout)
        capsule = findViewById(R.id.capsule)
        btConsoleBtn = findViewById(R.id.btConsoleBtn)
        btWatchBtn = findViewById(R.id.btWatchBtn)
        asrBtn = findViewById(R.id.asrBtn)
        topFixedContainer = findViewById(R.id.topFixedContainer)
        topGradientBg = findViewById(R.id.topGradientBg)
        emotionPanelContainer = findViewById(R.id.emotionPanelContainer)
        btWatchBtn.visibility = View.GONE

        // 语言必须先初始化再构建界面：buildContent() 与首启界面都按 PhoneI18n.t()
        // 取值，若排在 init 之前会用默认语言渲染（手选语言不生效）。
        BondStore.init(this)
        ApiKeyStore.initialize(this)
        PhoneI18n.init(this)

        setupEdgeToEdgeInsets()

        buildContent()

        btConsoleBtn.text = "B"
        btConsoleBtn.setTypeface(Typeface.MONOSPACE, Typeface.BOLD)

        setupBleButton(btConsoleBtn)
        updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_UNBONDED)

        /* 长按胶囊弹出模式菜单（手动调整四大模式）→ 反向推送到控制端 */
        capsule.setOnLongClickListener {
            showModeMenuDialog()
            true
        }
        setupAsrButton()
        updateAsrButtonState(false)

        asrBtn.contentDescription = PhoneI18n.t("语音识别")

        PhoneDataStore.initialize(applicationContext)
        PhoneDataStore.setNotificationContext(this)
        PhoneDataStore.addListener(this)

        initBle()

        /* First Run（v1.10.0）：首次打开立即进入首启设置界面（覆盖主界面），
           完成/跳过后不再出现。语言默认按设备检测（默认英文）。 */
        showFirstRunIfNeeded()

        if (checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
        }

        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        /* 语音识别常态保持：上次为开启且已授权时自动恢复（低功耗：仅前台运行） */
        if (ApiKeyStore.isAsrActive() &&
            checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            startSpeech(showToast = false)
        }
    }

    private fun setupEdgeToEdgeInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val statusBarH = systemBars.top
            val navBarH = systemBars.bottom

            val topBtnLp = btConsoleBtn.layoutParams as FrameLayout.LayoutParams
            topBtnLp.topMargin = statusBarH + (8 * density).toInt()
            btConsoleBtn.layoutParams = topBtnLp

            val capLp = capsule.layoutParams as FrameLayout.LayoutParams
            capLp.topMargin = statusBarH + (8 * density).toInt()
            capsule.layoutParams = capLp

            val watchLp = btWatchBtn.layoutParams as FrameLayout.LayoutParams
            watchLp.topMargin = statusBarH + (8 * density).toInt()
            btWatchBtn.layoutParams = watchLp

            val asrLp = asrBtn.layoutParams as FrameLayout.LayoutParams
            asrLp.topMargin = statusBarH + (8 * density).toInt()
            asrBtn.layoutParams = asrLp

            val emotionLp = emotionPanelContainer.layoutParams as FrameLayout.LayoutParams
            emotionLp.topMargin = statusBarH + (8 * density).toInt()
            emotionPanelContainer.layoutParams = emotionLp

            scrollView.setPadding(0, 0, 0, 0)
            scrollView.clipToPadding = false

            contentLayout.setPadding(0, 0, 0, 0)

            insets
        }

        root.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                if (capsule.height == 0 || !::emotionPanel.isInitialized || emotionPanel.height == 0) return
                val insets = ViewCompat.getRootWindowInsets(root) ?: return
                val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
                val statusBarH = systemBars.top
                val navBarH = systemBars.bottom
                val hPadding = (24 * density).toInt()
                
                val capLp = capsule.layoutParams as FrameLayout.LayoutParams
                val capsuleBottomY = capLp.topMargin + capsule.height
                val emotionTopMargin = capsuleBottomY + (6 * density).toInt()
                
                val emotionLp = emotionPanelContainer.layoutParams as FrameLayout.LayoutParams
                emotionLp.topMargin = emotionTopMargin
                emotionPanelContainer.layoutParams = emotionLp
                
                val fixedTotalHeight = emotionTopMargin + emotionPanel.height
                val fadeDistance = (20 * density).toInt()
                val listTopGap = (4 * density).toInt()
                val contentTopPadding = fixedTotalHeight + listTopGap + fadeDistance
                
                val gradientHeight = fixedTotalHeight + fadeDistance
                val gradientDrawable = GradientDrawable(
                    GradientDrawable.Orientation.TOP_BOTTOM,
                    intArrayOf(
                        GfxColor.parseColor("#B3000000"),
                        GfxColor.parseColor("#FF000000"),
                        GfxColor.parseColor("#FF000000"),
                        GfxColor.parseColor("#FF000000"),
                        GfxColor.parseColor("#FF000000"),
                        GfxColor.parseColor("#FF000000"),
                        GfxColor.parseColor("#FF000000"),
                        GfxColor.parseColor("#80000000"),
                        GfxColor.parseColor("#00000000")
                    )
                )
                topGradientBg.background = gradientDrawable
                val gradientLp = topGradientBg.layoutParams as FrameLayout.LayoutParams
                gradientLp.height = gradientHeight
                topGradientBg.layoutParams = gradientLp
                
                contentLayout.setPadding(hPadding, contentTopPadding, hPadding, navBarH + (16 * density).toInt())
            }
        })

        ViewCompat.requestApplyInsets(root)
    }

    private fun initBle() {
        if (!BlePermissionHelper.hasAllPermissions(this)) {
            btPermissionLauncher.launch(BlePermissionHelper.getMissingPermissions(this).toTypedArray())
            return
        }
        if (!BlePermissionHelper.isBluetoothEnabled(this)) {
            enableBtLauncher.launch(BlePermissionHelper.getEnableBluetoothIntent())
            return
        }
        startBleServices()
    }

    private fun startBleServices() {
        ConsoleBleClient.initialize(this)

        ConsoleBleClient.onConnectionStateChanged = { state ->
            runOnUiThread {
                consoleStatus = state
                updateBtButtonState(btConsoleBtn, state)
                when (state) {
                    BleConstants.BLE_STATUS_CONNECTED -> {
                        val addr = ConsoleBleClient.getConnectedDeviceAddress()
                        if (!addr.isNullOrEmpty() && !BondStore.hasConsoleBond()) {
                            BondStore.saveConsoleAddress(addr)
                        }
                        dialogConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                        dialogConnectTimeoutRunnable = null
                        if (bleControlDialog?.isShowing == true) {
                            dialogConnectTargetAddr?.let { targetAddr ->
                                dialogDeviceViews[targetAddr]?.apply {
                                    text = PhoneI18n.t("已连接")
                                    setTextColor(GfxColor.parseColor("#4ade80"))
                                }
                                updateDialogDeviceStatus(targetAddr, 2)
                            }
                            val bl = dialogButtonsLayout
                            val dl = dialogDeviceListContainer
                            val sd = dialogStatusDot
                            val it = dialogInfoTv
                            if (bl != null && dl != null && sd != null && it != null) {
                                updateDialogStatusDisplay(sd, it)
                                rebuildDialogButtons(bl, dl, sd, it)
                            }
                            if (!isQrConnection) {
                                mainHandler.postDelayed({
                                    bleControlDialog?.dismiss()
                                }, 500)
                            }
                            isQrConnection = false
                        }
                        ConsoleBleClient.stopAutoScan()
                        Toast.makeText(this, PhoneI18n.t("控制面板已连接"), Toast.LENGTH_SHORT).show()
                        if (!PhoneDataStore.hasReceivedRealData) {
                            emotionPanel.showNaState()
                        }
                    }
                    BleConstants.BLE_STATUS_DISCONNECTED -> {
                        isQrConnection = false
                        dialogConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                        dialogConnectTimeoutRunnable = null
                        dialogConnectTargetAddr = null
                        if (bleControlDialog?.isShowing == true) {
                            val bl = dialogButtonsLayout
                            val dl = dialogDeviceListContainer
                            val sd = dialogStatusDot
                            val infoTv = dialogInfoTv
                            if (bl != null && dl != null && sd != null && infoTv != null) {
                                updateDialogStatusDisplay(sd, infoTv)
                                rebuildDialogButtons(bl, dl, sd, infoTv)
                            }
                        }
                        if (ConsoleBleClient.isActiveDisconnect()) {
                            // Active disconnect: server sent 0xFF or slave-app user clicked disconnect
                            Toast.makeText(this, PhoneI18n.t("连接已手动断开"), Toast.LENGTH_SHORT).show()
                        } else if (BondStore.hasConsoleBond()) {
                            // Unexpected disconnect: try to auto-reconnect
                            Toast.makeText(this, PhoneI18n.t("连接已断开，正在尝试重连..."), Toast.LENGTH_SHORT).show()
                        }
                        if (!PhoneDataStore.hasReceivedRealData) {
                            emotionPanel.showNaState()
                        }
                    }
                    BleConstants.BLE_STATUS_CONNECTING -> {
                        if (bleControlDialog?.isShowing == true) {
                            dialogConnectTargetAddr?.let { targetAddr ->
                                dialogDeviceViews[targetAddr]?.apply {
                                    text = PhoneI18n.t("连接中...")
                                    setTextColor(GfxColor.parseColor("#fbbf24"))
                                }
                                updateDialogDeviceStatus(targetAddr, 1)
                            }
                        }
                        if (!PhoneDataStore.hasReceivedRealData) {
                            emotionPanel.showNaState()
                        }
                    }
                }
            }
        }

        ConsoleBleClient.onModeReceived = { ordinal ->
            when {
                ordinal == 255 -> PhoneDataStore.setMode(Mode.NA)
                ordinal in 0..3 -> PhoneDataStore.setMode(Mode.values()[ordinal + 1])
            }
        }
        // 界面语言不再跟随控制端（v1.10.0 起取消 7507 UiLang 消费）：
        // 语言只由本机设备检测 + 用户手选决定，控制端推送不影响本端显示。
        ConsoleBleClient.onEmotionReceived = { o, s, p, m ->
            val emotion = Emotion(o.coerceIn(0, 100), s.coerceIn(0, 100), p.coerceIn(0, 100), m.coerceIn(0, 100))
            PhoneDataStore.setEmotion(emotion)
        }
        ConsoleBleClient.onTasksReceived = { json ->
            try {
                if (!json.isNullOrBlank()) {
                    val arr = JSONArray(json)
                    val tasks = mutableListOf<Task>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        val type = if (obj.has("type") && !obj.isNull("type")) {
                            try { obj.getString("type") } catch (_: Exception) { null }
                        } else null
                        val taskId = try {
                            if (obj.has("id")) {
                                try {
                                    obj.getLong("id").toString()
                                } catch (_: Exception) {
                                    obj.getString("id")
                                }
                            } else {
                                System.currentTimeMillis().toString() + "_" + i
                            }
                        } catch (e: Exception) {
                            System.currentTimeMillis().toString() + "_" + i
                        }
                        val name = PhoneI18n.t(obj.optString("name", "未知任务"))
                        tasks.add(Task(
                            taskId,
                            name,
                            obj.optString("status", "pending"),
                            type
                        ))
                    }
                    val sorted = tasks.sortedBy { it.typePriority }
                    PhoneDataStore.setTasks(sorted)
                } else {
                    android.util.Log.w("BleClient", "onTasksReceived: empty json, skipping")
                }
            } catch (e: Exception) {
                android.util.Log.e("BleClient", "Parse tasks error: json=${json?.take(200)}", e)
            }
        }
        ConsoleBleClient.onVoiceReceived = { json ->
            try {
                val obj = JSONObject(json)
                val msg = VoiceMessage(obj.getLong("timestamp"), obj.getString("content"))
                PhoneDataStore.addVoiceMessageIfNew(msg)
            } catch (e: Exception) {
                android.util.Log.e("BleClient", "Parse voice error", e)
            }
        }
        ConsoleBleClient.onVoiceHistoryReceived = { historyJson ->
            try {
                val arr = JSONArray(historyJson)
                val list = mutableListOf<VoiceMessage>()
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    list.add(VoiceMessage(
                        obj.getLong("timestamp"),
                        obj.getString("content")
                    ))
                }
                PhoneDataStore.setVoiceHistory(list)
            } catch (e: Exception) {
                android.util.Log.e("BleClient", "Parse voice history error", e)
            }
        }

        if (BondStore.hasConsoleBond()) {
            val addr = BondStore.getConsoleAddress()
            if (addr != null) {
                consoleStatus = BleConstants.BLE_STATUS_CONNECTING
                updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_CONNECTING)
                /* BLE 入口统一兜底：权限/适配器异常只回退连接状态，不允许异常穿透导致 App 闪退 */
                try {
                    ConsoleBleClient.connect(this, addr, autoConnect = true)
                    ConsoleBleClient.startAutoScan()
                } catch (e: Exception) {
                    android.util.Log.e("BleClient", "auto connect failed", e)
                    consoleStatus = BleConstants.BLE_STATUS_DISCONNECTED
                    updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_DISCONNECTED)
                }
            }
        } else {
            consoleStatus = BleConstants.BLE_STATUS_CONNECTING
            updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_CONNECTING)
            try {
                ConsoleBleClient.startAutoScan()
            } catch (e: Exception) {
                android.util.Log.e("BleClient", "startAutoScan failed", e)
                consoleStatus = BleConstants.BLE_STATUS_DISCONNECTED
                updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_DISCONNECTED)
            }
        }
    }

    private fun updateBtButtonState(btn: TextView, state: Int) {
        val bg = btn.background as GradientDrawable
        val (fillColor, strokeColor, textColor) = when (state) {
            BleConstants.BLE_STATUS_CONNECTED -> Triple(
                GfxColor.parseColor("#FF1a3a1a"),
                GfxColor.parseColor("#4ade80"),
                GfxColor.parseColor("#4ade80")
            )
            BleConstants.BLE_STATUS_DISCONNECTED -> Triple(
                GfxColor.parseColor("#FF3a1a1a"),
                GfxColor.parseColor("#ef4444"),
                GfxColor.parseColor("#ef4444")
            )
            BleConstants.BLE_STATUS_CONNECTING -> Triple(
                GfxColor.parseColor("#FF3a3018"),
                GfxColor.parseColor("#fbbf24"),
                GfxColor.parseColor("#fbbf24")
            )
            else -> Triple(
                GfxColor.BLACK,
                GfxColor.parseColor("#66888888"),
                GfxColor.WHITE
            )
        }
        bg.setColor(fillColor)
        bg.setStroke((1.5f * density).toInt(), strokeColor)
        btn.setTextColor(textColor)
        btn.invalidate()
    }

    private fun setupBleButton(btn: TextView) {
        val gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true
            override fun onSingleTapUp(e: MotionEvent): Boolean {
                showBleDialog()
                return true
            }
            override fun onLongPress(e: MotionEvent) {
                injectSampleData()
                Toast.makeText(this@MainActivity, PhoneI18n.t("已注入模拟数据"), Toast.LENGTH_SHORT).show()
            }
        })
        btn.setOnTouchListener { _, event -> gestureDetector.onTouchEvent(event) }
    }

    // ===== 模式反向推送：长按胶囊弹模式菜单 → 写入控制端 Mode(7501) =====

    /** 模式菜单（手动调整四大模式）。选中后反向推送到控制端，控制端切换并高亮对应模式按钮。 */
    private fun showModeMenuDialog() {
        val dialog = Dialog(this, R.style.BleDialogTheme)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, (8 * density).toInt(), 0, (8 * density).toInt())
        }

        val title = TextView(this).apply {
            text = PhoneI18n.t("选择模式")
            setTextColor(GfxColor.WHITE)
            textSize = 16f
            setPadding((20 * density).toInt(), (16 * density).toInt(), (20 * density).toInt(), (2 * density).toInt())
            includeFontPadding = false
        }
        container.addView(title)

        val hint = TextView(this).apply {
            text = PhoneI18n.t("长按胶囊切换模式")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 11f
            setPadding((20 * density).toInt(), 0, (20 * density).toInt(), (8 * density).toInt())
            includeFontPadding = false
        }
        container.addView(hint)

        modeMenuItems.forEach { (label, ordinal, color) ->
            val item = TextView(this).apply {
                text = PhoneI18n.t(label)
                setTextColor(color)
                textSize = 15f
                gravity = Gravity.CENTER_VERTICAL
                setPadding((20 * density).toInt(), (14 * density).toInt(), (20 * density).toInt(), (14 * density).toInt())
                background = createDialogItemBg()
                includeFontPadding = false
                setOnClickListener {
                    dialog.dismiss()
                    pushModeToConsole(ordinal, PhoneI18n.t(label))
                }
            }
            container.addView(item)
        }

        val closeItem = createDialogItem("关闭").apply {
            setOnClickListener { dialog.dismiss() }
        }
        container.addView(closeItem)

        dialog.setContentView(container)
        dialog.setCancelable(true)
        dialog.setCanceledOnTouchOutside(true)
        styleDialog(dialog)
        dialog.show()
    }

    /** 反向推送模式到控制端；成功后开启「推送成功」回声窗口（控制端回推语音时弹通知）。 */
    private fun pushModeToConsole(ordinal: Int, modeName: String) {
        if (!ConsoleBleClient.isConnected()) {
            Toast.makeText(this, PhoneI18n.t("未连接控制面板"), Toast.LENGTH_SHORT).show()
            return
        }
        if (ConsoleBleClient.writeMode(ordinal)) {
            armReversePushFeedback(modeName)
        } else {
            Toast.makeText(this, PhoneI18n.t("未连接控制面板"), Toast.LENGTH_SHORT).show()
        }
    }

    /** 控制端回声未到达时由手机端兜底弹「推送成功」，避免一次推送出现两条通知。 */
    private fun armReversePushFeedback(modeName: String) {
        PhoneDataStore.armReversePushEcho(4000L)
        reversePushWatchdog?.let { mainHandler.removeCallbacks(it) }
        val task = Runnable {
            reversePushWatchdog = null
            if (PhoneDataStore.isAwaitingReverseEcho()) {
                PhoneDataStore.notifyReversePushSuccess(modeName)
            }
        }
        reversePushWatchdog = task
        mainHandler.postDelayed(task, 4000L)
    }

    // ===== 语音识别（ASR，仅 slave-app 端；本地优先、云端兜底） =====

    private fun setupAsrButton() {
        asrBtn.setOnClickListener {
            if (speechController?.isActive == true) {
                stopSpeech()
            } else if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                startSpeech(showToast = true)
            } else {
                recordPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    /** 开启识别（常态保持）。本地识别命中四大模式读音即反向推送，本地识别不清楚才走 MiMo ASR。 */
    private fun startSpeech(showToast: Boolean) {
        val controller = speechController ?: PhoneSpeechController(
            applicationContext,
            onModeCommand = { ordinal -> runOnUiThread { onVoiceModeCommand(ordinal) } },
            onStatusMessage = { message ->
                runOnUiThread {
                    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
                    if (speechController?.isActive != true) {
                        ApiKeyStore.setAsrActive(false)
                        updateAsrButtonState(false)
                    }
                }
            }
        ).also { speechController = it }
        controller.start()
        val active = controller.isActive
        ApiKeyStore.setAsrActive(active)
        updateAsrButtonState(active)
        if (showToast && active) {
            Toast.makeText(this, PhoneI18n.t("语音识别已开启"), Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopSpeech(silent: Boolean = false) {
        speechController?.stop()
        ApiKeyStore.setAsrActive(false)
        updateAsrButtonState(false)
        if (!silent) {
            Toast.makeText(this, PhoneI18n.t("语音识别已关闭"), Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateAsrButtonState(active: Boolean) {
        if (!::asrBtn.isInitialized) return
        val bg = asrBtn.background as? GradientDrawable
        if (active) {
            bg?.setColor(GfxColor.parseColor("#FF1a3a1a"))
            bg?.setStroke((1.5f * density).toInt(), GfxColor.parseColor("#4ade80"))
            asrBtn.setColorFilter(GfxColor.parseColor("#4ade80"))
        } else {
            bg?.setColor(GfxColor.parseColor("#FF000000"))
            bg?.setStroke((1.5f * density).toInt(), GfxColor.parseColor("#33FFFFFF"))
            asrBtn.setColorFilter(GfxColor.parseColor("#888888"))
        }
        asrBtn.invalidate()
    }

    /** 语音识别命中模式读音 → 与手动模式菜单同一条反向推送链路。 */
    private fun onVoiceModeCommand(ordinal: Int) {
        val label = modeMenuItems.firstOrNull { it.second == ordinal }?.first ?: return
        pushModeToConsole(ordinal, PhoneI18n.t(label))
    }

    private fun createDialogItemBg(): StateListDrawable {
        val normalBg = GradientDrawable().apply {
            setColor(GfxColor.TRANSPARENT)
            cornerRadius = 8f * density
        }
        val pressedBg = GradientDrawable().apply {
            setColor(GfxColor.parseColor("#1AFFFFFF"))
            cornerRadius = 8f * density
        }
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), pressedBg)
            addState(intArrayOf(-android.R.attr.state_pressed), normalBg)
        }
    }

    private fun createDialogItem(text: String): TextView {
        return TextView(this).apply {
            this.text = PhoneI18n.t(text)
            setTextColor(GfxColor.WHITE)
            textSize = 15f
            gravity = Gravity.CENTER_VERTICAL
            setPadding((20 * density).toInt(), (14 * density).toInt(), (20 * density).toInt(), (14 * density).toInt())
            background = createDialogItemBg()
            includeFontPadding = false
        }
    }

    private fun styleDialog(dialog: Dialog) {
        val window = dialog.window
        @Suppress("DEPRECATION")
        window?.setBackgroundDrawable(GradientDrawable().apply {
            setColor(GfxColor.parseColor("#FF1A1A1A"))
            cornerRadius = 16f * density
            setStroke((1 * density).toInt(), GfxColor.parseColor("#1AFFFFFF"))
        })
        window?.setGravity(Gravity.CENTER)
        window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.9).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT
        )
    }

    private fun createDeviceItem(name: String, addr: String, status: Int): LinearLayout {
        val statusText = when (status) {
            1 -> PhoneI18n.t("连接中...")
            2 -> PhoneI18n.t("已连接")
            3 -> PhoneI18n.t("连接失败")
            else -> ""
        }
        val statusColor = when (status) {
            1 -> GfxColor.parseColor("#fbbf24")
            2 -> GfxColor.parseColor("#4ade80")
            3 -> GfxColor.parseColor("#ef4444")
            else -> GfxColor.parseColor("#888888")
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding((20 * density).toInt(), (12 * density).toInt(), (20 * density).toInt(), (12 * density).toInt())
            background = createDialogItemBg()
            val textContainer = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val nameTv = TextView(this@MainActivity).apply {
                text = name
                setTextColor(GfxColor.WHITE)
                textSize = 13f
                setTypeface(typeface, Typeface.BOLD)
                includeFontPadding = false
            }
            textContainer.addView(nameTv)
            val addrTv = TextView(this@MainActivity).apply {
                text = addr
                setTextColor(GfxColor.parseColor("#888888"))
                textSize = 10f
                includeFontPadding = false
                setPadding(0, (2 * density).toInt(), 0, 0)
            }
            textContainer.addView(addrTv)
            addView(textContainer)
            val statusTv = TextView(this@MainActivity).apply {
                text = statusText
                setTextColor(statusColor)
                textSize = 12f
                includeFontPadding = false
                gravity = Gravity.END or Gravity.CENTER_VERTICAL
            }
            dialogDeviceViews[addr] = statusTv
            addView(statusTv, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
        }
    }

    private fun updateDialogDeviceStatus(addr: String, status: Int) {
        val idx = dialogDiscoveredDevices.indexOfFirst { it.second == addr }
        if (idx >= 0) {
            dialogDiscoveredDevices[idx] = Triple(dialogDiscoveredDevices[idx].first, addr, status)
        }
    }

    private fun rebuildDialogButtons(buttonsLayout: LinearLayout, deviceListContainer: LinearLayout, statusDot: View, infoTv: TextView) {
        buttonsLayout.removeAllViews()
        val currentStatus = consoleStatus

        val newScanBtn = createDialogItem(PhoneI18n.t(if (dialogScanRunning) "停止扫描" else "重新扫描"))
        newScanBtn.setOnClickListener {
            if (dialogScanRunning) {
                stopDialogScan()
            } else {
                startDialogScan(deviceListContainer)
            }
        }
        buttonsLayout.addView(newScanBtn)

        val qrBtn = createDialogItem("扫描二维码")
        qrBtn.setOnClickListener {
            startQrScan()
        }
        buttonsLayout.addView(qrBtn)

        if (currentStatus == BleConstants.BLE_STATUS_CONNECTED) {
            val disconnectBtn = createDialogItem("断开")
            disconnectBtn.setOnClickListener {
                ConsoleBleClient.disconnect()
                BondStore.clearConsoleBond()
                consoleStatus = BleConstants.BLE_STATUS_UNBONDED
                updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_UNBONDED)
                updateDialogStatusDisplay(statusDot, infoTv)
                rebuildDialogButtons(buttonsLayout, deviceListContainer, statusDot, infoTv)
                Toast.makeText(this, PhoneI18n.t("已断开连接"), Toast.LENGTH_SHORT).show()
            }
            buttonsLayout.addView(disconnectBtn)
        }

        val closeBtn = createDialogItem("关闭")
        closeBtn.setOnClickListener {
            bleControlDialog?.dismiss()
        }
        buttonsLayout.addView(closeBtn)
    }

    private fun updateDialogStatusDisplay(statusDot: View, infoTv: TextView) {
        val status = consoleStatus
        val statusText = when (status) {
            BleConstants.BLE_STATUS_CONNECTED -> PhoneI18n.t("已连接")
            BleConstants.BLE_STATUS_DISCONNECTED -> {
                if (ConsoleBleClient.isActiveDisconnect()) PhoneI18n.t("连接已手动断开") else PhoneI18n.t("连接失败")
            }
            BleConstants.BLE_STATUS_CONNECTING -> PhoneI18n.t("正在连接...")
            else -> PhoneI18n.t("未绑定")
        }
        val bondedAddr = BondStore.getConsoleAddress()
        val statusColor = when (status) {
            BleConstants.BLE_STATUS_CONNECTED -> GfxColor.parseColor("#4ade80")
            BleConstants.BLE_STATUS_CONNECTING -> GfxColor.parseColor("#fbbf24")
            BleConstants.BLE_STATUS_DISCONNECTED -> GfxColor.parseColor("#ef4444")
            else -> GfxColor.parseColor("#888888")
        }
        (statusDot.background as GradientDrawable).setColor(statusColor)
        infoTv.text = buildString {
            append(statusText)
            if (!bondedAddr.isNullOrEmpty()) {
                append("\n").append(bondedAddr)
            }
        }
    }

    private fun getDialogScanBtn(): TextView? {
        return dialogButtonsLayout?.getChildAt(0) as? TextView
    }

    private fun startDialogScan(deviceListContainer: LinearLayout) {
        dialogDiscoveredDevices.clear()
        dialogDeviceViews.clear()
        deviceListContainer.removeAllViews()
        dialogScanRunning = true
        getDialogScanBtn()?.text = PhoneI18n.t("停止扫描")
        dialogScanTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        ConsoleBleClient.pauseAutoScanForDialog()
        ConsoleBleClient.startScanAndConnect(onDeviceFound = { name, addr ->
            runOnUiThread {
                if (dialogDiscoveredDevices.none { it.second == addr }) {
                    val entry = Triple(name, addr, 0)
                    dialogDiscoveredDevices.add(entry)
                    val itemView = createDeviceItem(name, addr, 0)
                    itemView.setOnClickListener {
                        if (dialogConnectTargetAddr != null) return@setOnClickListener
                        stopDialogScan()
                        getDialogScanBtn()?.text = PhoneI18n.t("重新扫描")
                        dialogConnectTargetAddr = addr
                        dialogDeviceViews[addr]?.apply {
                            text = PhoneI18n.t("连接中...")
                            setTextColor(GfxColor.parseColor("#fbbf24"))
                        }
                        updateDialogDeviceStatus(addr, 1)
                        BondStore.saveConsoleAddress(addr)
                        connectToConsole(addr)
                        dialogConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
                        val timeoutRunnable = Runnable {
                            if (bleControlDialog?.isShowing == true && dialogConnectTargetAddr == addr) {
                                dialogDeviceViews[addr]?.apply {
                                    text = PhoneI18n.t("连接失败")
                                    setTextColor(GfxColor.parseColor("#ef4444"))
                                }
                                updateDialogDeviceStatus(addr, 3)
                                dialogConnectTargetAddr = null
                                val bl = dialogButtonsLayout
                                val dl = dialogDeviceListContainer
                                val sd = dialogStatusDot
                                val itv = dialogInfoTv
                                if (bl != null && dl != null && sd != null && itv != null) {
                                    rebuildDialogButtons(bl, dl, sd, itv)
                                }
                            }
                            dialogConnectTimeoutRunnable = null
                        }
                        dialogConnectTimeoutRunnable = timeoutRunnable
                        mainHandler.postDelayed(timeoutRunnable, BleConstants.CONNECTION_TIMEOUT_MS)
                    }
                    deviceListContainer.addView(itemView)
                }
            }
        }, autoConnect = false)

        dialogScanTimeoutRunnable = Runnable {
            if (bleControlDialog?.isShowing == true) {
                stopDialogScan()
                getDialogScanBtn()?.text = PhoneI18n.t("重新扫描")
            }
        }
        mainHandler.postDelayed(dialogScanTimeoutRunnable!!, BleConstants.SCAN_DURATION_MS)
    }

    private fun stopDialogScan() {
        dialogScanRunning = false
        dialogScanTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        dialogScanTimeoutRunnable = null
        ConsoleBleClient.stopDialogScan()
        getDialogScanBtn()?.text = PhoneI18n.t("重新扫描")
    }

    private fun showBleDialog() {
        bleControlDialog?.dismiss()
        dialogDiscoveredDevices.clear()
        dialogDeviceViews.clear()
        dialogConnectTargetAddr = null
        dialogConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        dialogConnectTimeoutRunnable = null

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = (8 * density).toInt()
            setPadding(pad, pad, pad, pad)
        }

        val titleTv = TextView(this).apply {
            text = PhoneI18n.t("控制面板连接")
            setTextColor(GfxColor.WHITE)
            textSize = 17f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(
                (24 * density).toInt(),
                (20 * density).toInt(),
                (24 * density).toInt(),
                (8 * density).toInt()
            )
        }
        container.addView(titleTv)

        val infoContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding((16 * density).toInt(), (8 * density).toInt(), (16 * density).toInt(), (12 * density).toInt())
        }
        val statusDot = View(this).apply {
            val dotSize = (8 * density).toInt()
            layoutParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
                marginEnd = (10 * density).toInt()
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(GfxColor.parseColor("#888888"))
            }
        }
        infoContainer.addView(statusDot)
        val infoTv = TextView(this).apply {
            setTextColor(GfxColor.parseColor("#999999"))
            textSize = 13f
            setLineSpacing(4f * density, 1f)
            includeFontPadding = false
        }
        infoContainer.addView(infoTv)
        container.addView(infoContainer)
        updateDialogStatusDisplay(statusDot, infoTv)

        val divider1 = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (1 * density).toInt()
            ).apply {
                marginStart = (16 * density).toInt()
                marginEnd = (16 * density).toInt()
                bottomMargin = (4 * density).toInt()
            }
            setBackgroundColor(GfxColor.parseColor("#1AFFFFFF"))
        }
        container.addView(divider1)

        // API Key 输入区域
        val apiKeyLabel = TextView(this).apply {
            text = PhoneI18n.t("MiMo API Key（可选）")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 12f
            setPadding((20 * density).toInt(), (8 * density).toInt(), (20 * density).toInt(), (4 * density).toInt())
            includeFontPadding = false
        }
        container.addView(apiKeyLabel)

        val apiKeyInput = EditText(this).apply {
            val savedKey = ApiKeyStore.getApiKey() ?: ""
            setText(savedKey)
            hint = PhoneI18n.t("输入 API Key 用于语音播报")
            setTextColor(GfxColor.WHITE)
            setHintTextColor(GfxColor.parseColor("#555555"))
            textSize = 13f
            setPadding((16 * density).toInt(), (10 * density).toInt(), (16 * density).toInt(), (10 * density).toInt())
            setBackgroundColor(GfxColor.parseColor("#1A000000"))
            val inputPad = (16 * density).toInt()
            val inputLp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (44 * density).toInt()
            ).apply {
                marginStart = inputPad
                marginEnd = inputPad
                bottomMargin = (8 * density).toInt()
            }
            layoutParams = inputLp
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
        }
        container.addView(apiKeyInput)

        val apiKeyHint = TextView(this).apply {
            text = PhoneI18n.t("用于高质量机械语音合成，连接时自动同步到控制台")
            setTextColor(GfxColor.parseColor("#555555"))
            textSize = 11f
            setPadding((20 * density).toInt(), 0, (20 * density).toInt(), (4 * density).toInt())
            includeFontPadding = false
        }
        container.addView(apiKeyHint)

        /* 语音识别：是否允许调用云端 MiMo ASR（关闭后仅本地离线识别） */
        val asrCloudRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding((20 * density).toInt(), (4 * density).toInt(), (20 * density).toInt(), 0)
        }
        val asrCloudLabel = TextView(this).apply {
            text = PhoneI18n.t("识别引擎调用云端（MiMo ASR）")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 12f
            includeFontPadding = false
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val asrCloudSwitch = Switch(this).apply {
            isChecked = ApiKeyStore.isAsrCloudEnabled()
            /* Theme.Black 下框架 Switch 的 Holo 轨道/滑块尺寸塌缩不可见，显式指定 drawable */
            showText = false
            setTrackDrawable(getDrawable(R.drawable.asr_switch_track))
            setThumbDrawable(getDrawable(R.drawable.asr_switch_thumb))
            setOnCheckedChangeListener { _, checked -> ApiKeyStore.setAsrCloudEnabled(checked) }
        }
        asrCloudRow.addView(asrCloudLabel)
        asrCloudRow.addView(asrCloudSwitch)
        container.addView(asrCloudRow)

        val asrCloudHint = TextView(this).apply {
            text = PhoneI18n.t("关闭后仅使用本地离线识别")
            setTextColor(GfxColor.parseColor("#555555"))
            textSize = 11f
            setPadding((20 * density).toInt(), 0, (20 * density).toInt(), (4 * density).toInt())
            includeFontPadding = false
        }
        container.addView(asrCloudHint)

        val mimoCostHint = TextView(this).apply {
            text = PhoneI18n.t("Xiaomi MiMo TTS和ASR可能需要收费，请阅读官网相关文档。")
            setTextColor(GfxColor.parseColor("#555555"))
            textSize = 11f
            setPadding((20 * density).toInt(), 0, (20 * density).toInt(), (4 * density).toInt())
            includeFontPadding = false
        }
        container.addView(mimoCostHint)

        /* 界面语言（v1.10.0）：默认英文、随设备语言自动检测，可在此手动覆盖；
           不再跟随控制端 7507 推送。切换后 recreate 使全部文案即时生效。 */
        val langRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding((20 * density).toInt(), (4 * density).toInt(), (20 * density).toInt(), 0)
        }
        val langLabel = TextView(this).apply {
            text = PhoneI18n.t("语言")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 12f
            includeFontPadding = false
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val langSwitch = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        fun styleLangBtn(btn: TextView, active: Boolean) {
            btn.setTextColor(if (active) GfxColor.parseColor("#8FBC8F") else GfxColor.parseColor("#888888"))
            btn.setBackgroundColor(if (active) GfxColor.parseColor("#1A8FBC8F") else GfxColor.parseColor("#00000000"))
        }
        val langZhBtn = TextView(this).apply {
            text = "中文"
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding((14 * density).toInt(), (6 * density).toInt(), (14 * density).toInt(), (6 * density).toInt())
            includeFontPadding = false
        }
        val langEnBtn = TextView(this).apply {
            text = "English"
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding((14 * density).toInt(), (6 * density).toInt(), (14 * density).toInt(), (6 * density).toInt())
            includeFontPadding = false
        }
        styleLangBtn(langZhBtn, PhoneI18n.getLang() == "zh")
        styleLangBtn(langEnBtn, PhoneI18n.getLang() == "en")
        langZhBtn.setOnClickListener {
            if (PhoneI18n.getLang() != "zh") {
                PhoneI18n.setLang(this, "zh")
                bleControlDialog?.dismiss()
                recreate()
            }
        }
        langEnBtn.setOnClickListener {
            if (PhoneI18n.getLang() != "en") {
                PhoneI18n.setLang(this, "en")
                bleControlDialog?.dismiss()
                recreate()
            }
        }
        langSwitch.addView(langZhBtn)
        langSwitch.addView(langEnBtn)
        langRow.addView(langLabel)
        langRow.addView(langSwitch)
        container.addView(langRow)

        val buttonsLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        container.addView(buttonsLayout)

        val divider2 = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (1 * density).toInt()
            ).apply {
                marginStart = (16 * density).toInt()
                marginEnd = (16 * density).toInt()
                topMargin = (4 * density).toInt()
                bottomMargin = (4 * density).toInt()
            }
            setBackgroundColor(GfxColor.parseColor("#1AFFFFFF"))
        }
        container.addView(divider2)

        val nearbyLabel = TextView(this).apply {
            text = PhoneI18n.t("附近设备")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 12f
            setPadding((20 * density).toInt(), (4 * density).toInt(), (20 * density).toInt(), (4 * density).toInt())
            includeFontPadding = false
        }
        container.addView(nearbyLabel)

        val deviceListContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val maxListHeight = (resources.displayMetrics.heightPixels * 0.35).toInt()
        val scrollView = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                maxListHeight
            )
            addView(deviceListContainer)
        }
        container.addView(scrollView)

        rebuildDialogButtons(buttonsLayout, deviceListContainer, statusDot, infoTv)

        dialogButtonsLayout = buttonsLayout
        dialogDeviceListContainer = deviceListContainer
        dialogStatusDot = statusDot
        dialogInfoTv = infoTv

        val scrollWrapper = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            addView(container)
        }
        val dialog = Dialog(this, R.style.BleDialogTheme)
        dialog.setContentView(scrollWrapper)
        dialog.setCancelable(true)
        dialog.setCanceledOnTouchOutside(true)
        bleControlDialog = dialog
        styleDialog(dialog)

        dialog.setOnDismissListener {
            val key = apiKeyInput.text?.toString()?.trim().orEmpty()
            ApiKeyStore.saveApiKey(key)
            isBleDialogShowing = false
            isQrConnection = false
            stopDialogScan()
            dialogConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            dialogConnectTimeoutRunnable = null
            ConsoleBleClient.resumeAutoScanAfterDialog()
            dialogButtonsLayout = null
            dialogDeviceListContainer = null
            dialogStatusDot = null
            dialogInfoTv = null
            bleControlDialog = null
        }
        dialog.setOnCancelListener {
            val key = apiKeyInput.text?.toString()?.trim().orEmpty()
            ApiKeyStore.saveApiKey(key)
            isBleDialogShowing = false
            isQrConnection = false
            stopDialogScan()
            dialogConnectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            dialogConnectTimeoutRunnable = null
            ConsoleBleClient.resumeAutoScanAfterDialog()
            dialogButtonsLayout = null
            dialogDeviceListContainer = null
            dialogStatusDot = null
            dialogInfoTv = null
            bleControlDialog = null
        }
        dialog.show()
        isBleDialogShowing = true

        startDialogScan(deviceListContainer)
    }

    private fun startQrScan() {
        if (checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            qrScanLauncher.launch(Intent(this, QrScanActivity::class.java))
        } else {
            cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
        }
    }

    private fun startBleScan(autoConnect: Boolean) {
        showBleDialog()
    }

    /* 连接点击统一兜底：BLE 层任何异常都不得从 UI 线程抛出（Android 12 点击连接闪退防线） */
    private fun connectToConsole(address: String, autoConnect: Boolean = false) {
        try {
            ConsoleBleClient.connect(this, address, autoConnect = autoConnect)
        } catch (e: Exception) {
            android.util.Log.e("BleClient", "connect failed", e)
            consoleStatus = BleConstants.BLE_STATUS_DISCONNECTED
            updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_DISCONNECTED)
            Toast.makeText(this, PhoneI18n.t("连接失败"), Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleQrResult(qrData: String) {
        try {
            val obj = JSONObject(qrData)
            val mac = obj.optString("mac")
            val name = obj.optString("name", "")

            showBleDialog()
            isQrConnection = true

            // Always scan by name first (BLE random address may differ from BR/EDR MAC)
            var connected = false
            ConsoleBleClient.startScanAndConnect(onDeviceFound = { foundName, foundAddr ->
                if (foundName == name && !connected) {
                    connected = true
                    runOnUiThread {
                        BondStore.saveConsoleAddress(foundAddr)
                        consoleStatus = BleConstants.BLE_STATUS_CONNECTING
                        updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_CONNECTING)
                        dialogConnectTargetAddr = foundAddr
                        connectToConsole(foundAddr, autoConnect = true)
                        dialogConnectTimeoutRunnable = Runnable {
                            if (!ConsoleBleClient.isConnected()) {
                                isQrConnection = false
                                consoleStatus = BleConstants.BLE_STATUS_DISCONNECTED
                                updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_DISCONNECTED)
                                Toast.makeText(this, PhoneI18n.t("连接失败"), Toast.LENGTH_SHORT).show()
                            }
                        }.also {
                            dialogConnectTimeoutRunnable = it
                            mainHandler.postDelayed(it, BleConstants.CONNECTION_TIMEOUT_MS)
                        }
                    }
                }
            }, autoConnect = false)

            // Fallback: if scan doesn't find device, try direct MAC connection
            val isInvalidMac = mac.isEmpty() || mac == "02:00:00:00:00:00"
            if (!isInvalidMac) {
                mainHandler.postDelayed({
                    if (!connected && !ConsoleBleClient.isConnected()) {
                        connected = true
                        BondStore.saveConsoleAddress(mac)
                        consoleStatus = BleConstants.BLE_STATUS_CONNECTING
                        updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_CONNECTING)
                        connectToConsole(mac, autoConnect = true)
                        mainHandler.postDelayed({
                            if (!ConsoleBleClient.isConnected()) {
                                isQrConnection = false
                                consoleStatus = BleConstants.BLE_STATUS_DISCONNECTED
                                updateBtButtonState(btConsoleBtn, BleConstants.BLE_STATUS_DISCONNECTED)
                                Toast.makeText(this, PhoneI18n.t("连接失败"), Toast.LENGTH_SHORT).show()
                            }
                        }, BleConstants.CONNECTION_TIMEOUT_MS)
                    }
                }, BleConstants.SCAN_DURATION_MS + 1000)
            }
        } catch (e: Exception) {
            Toast.makeText(this, PhoneI18n.t("二维码格式无效"), Toast.LENGTH_SHORT).show()
        }
    }

    private fun buildContent() {
        emotionPanel = EmotionPanelView(this)
        emotionPanel.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        )
        emotionPanelContainer.addView(emotionPanel)

        val columnsLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        contentLayout.addView(columnsLayout, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        tasksColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, (8 * density).toInt(), 0)
        }
        columnsLayout.addView(tasksColumn, LinearLayout.LayoutParams(
            0,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            1f
        ))

        val divider = View(this).apply {
            setBackgroundResource(R.drawable.vertical_divider)
        }
        columnsLayout.addView(divider, LinearLayout.LayoutParams(
            (1 * density).toInt(),
            LinearLayout.LayoutParams.MATCH_PARENT
        ))

        voiceColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding((8 * density).toInt(), 0, 0, 0)
        }
        columnsLayout.addView(voiceColumn, LinearLayout.LayoutParams(
            0,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            1f
        ))

        tasksContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        tasksColumn.addView(tasksContainer)

        tasksEmpty = TextView(this).apply {
            text = PhoneI18n.t("暂无任务")
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            setPadding(0, (24 * density).toInt(), 0, (24 * density).toInt())
            includeFontPadding = false
        }
        tasksColumn.addView(tasksEmpty)

        voiceContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        voiceColumn.addView(voiceContainer)

        voiceEmpty = TextView(this).apply {
            text = PhoneI18n.t("暂无语音消息")
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            setPadding(0, (24 * density).toInt(), 0, (24 * density).toInt())
            includeFontPadding = false
        }
        voiceColumn.addView(voiceEmpty)
    }

    private fun space(px: Int): View {
        return View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                px
            )
        }
    }

    /* ===== First Run 首启设置（v1.10.0）=====
       首次打开立即进入本界面（覆盖主界面），完成/跳过后不再出现。
       内容：语言（默认英文、随设备检测、可手选）+ MiMo API Key + 云端识别开关。 */
    private fun isFirstRunDone(): Boolean =
        getSharedPreferences(FIRST_RUN_PREFS, MODE_PRIVATE).getBoolean(KEY_FIRST_RUN_DONE, false)

    private fun markFirstRunDone() {
        getSharedPreferences(FIRST_RUN_PREFS, MODE_PRIVATE).edit()
            .putBoolean(KEY_FIRST_RUN_DONE, true).apply()
    }

    private fun showFirstRunIfNeeded() {
        if (isFirstRunDone()) return
        val host = findViewById<FrameLayout>(R.id.firstRunContainer) ?: return
        firstRunContainer = host
        host.removeAllViews()
        host.addView(buildFirstRunView())
        host.visibility = View.VISIBLE
    }

    private fun dismissFirstRun() {
        markFirstRunDone()
        firstRunContainer?.let { it.visibility = View.GONE; it.removeAllViews() }
        firstRunContainer = null
    }

    private fun buildFirstRunView(): View {
        val scroll = ScrollView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            isFillViewport = true
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding((24 * density).toInt(), (32 * density).toInt(), (24 * density).toInt(), (24 * density).toInt())
        }
        scroll.addView(col)

        fun label(text: String): TextView = TextView(this).apply {
            this.text = PhoneI18n.t(text)
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 12f
            includeFontPadding = false
        }
        fun sectionTitle(text: String): TextView = TextView(this).apply {
            this.text = PhoneI18n.t(text)
            setTextColor(GfxColor.parseColor("#8FBC8F"))
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            includeFontPadding = false
        }

        // 标题
        col.addView(TextView(this).apply {
            text = "Slave"
            setTextColor(GfxColor.WHITE)
            textSize = 26f
            setTypeface(typeface, Typeface.BOLD)
            includeFontPadding = false
        })
        col.addView(space((6 * density).toInt()))
        col.addView(TextView(this).apply {
            text = PhoneI18n.t("首次启动设置")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 13f
            includeFontPadding = false
        })
        col.addView(space((24 * density).toInt()))

        // 1. 语言
        col.addView(sectionTitle("语言"))
        col.addView(space((8 * density).toInt()))
        val langRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        fun langBtn(text: String, code: String): TextView = TextView(this).apply {
            this.text = text
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding((18 * density).toInt(), (10 * density).toInt(), (18 * density).toInt(), (10 * density).toInt())
            includeFontPadding = false
            isClickable = true
            val active = PhoneI18n.getLang() == code
            setTextColor(if (active) GfxColor.parseColor("#8FBC8F") else GfxColor.parseColor("#888888"))
            setBackgroundColor(if (active) GfxColor.parseColor("#1A8FBC8F") else GfxColor.parseColor("#1AFFFFFF"))
            setOnClickListener {
                PhoneI18n.setLang(this@MainActivity, code)
                // 重建整个首启界面：文案随新语言即时切换
                firstRunContainer?.let { host ->
                    host.removeAllViews()
                    host.addView(buildFirstRunView())
                }
            }
        }
        langRow.addView(langBtn("中文", "zh"))
        langRow.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams((8 * density).toInt(), 1)
        })
        langRow.addView(langBtn("English", "en"))
        col.addView(langRow)
        col.addView(space((6 * density).toInt()))
        col.addView(label("默认按设备语言自动匹配，也可在此手动修改"))
        col.addView(space((22 * density).toInt()))

        // 2. MiMo API Key
        col.addView(sectionTitle("MiMo API Key（可选）"))
        col.addView(space((8 * density).toInt()))
        val keyInput = EditText(this).apply {
            setText(ApiKeyStore.getApiKey() ?: "")
            hint = PhoneI18n.t("输入 API Key 用于语音播报")
            setTextColor(GfxColor.WHITE)
            setHintTextColor(GfxColor.parseColor("#555555"))
            textSize = 13f
            setSingleLine(true)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            setPadding((16 * density).toInt(), (10 * density).toInt(), (16 * density).toInt(), (10 * density).toInt())
            setBackgroundColor(GfxColor.parseColor("#1A000000"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, (44 * density).toInt()
            )
        }
        col.addView(keyInput)
        col.addView(space((6 * density).toInt()))
        col.addView(label("用于高质量机械语音合成，连接时自动同步到控制台"))
        col.addView(space((18 * density).toInt()))

        // 3. 云端识别开关
        val cloudRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        cloudRow.addView(TextView(this).apply {
            text = PhoneI18n.t("识别引擎调用云端（MiMo ASR）")
            setTextColor(GfxColor.parseColor("#888888"))
            textSize = 12f
            includeFontPadding = false
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        val cloudSwitch = Switch(this).apply {
            isChecked = ApiKeyStore.isAsrCloudEnabled()
            showText = false
            setTrackDrawable(getDrawable(R.drawable.asr_switch_track))
            setThumbDrawable(getDrawable(R.drawable.asr_switch_thumb))
            setOnCheckedChangeListener { _, checked -> ApiKeyStore.setAsrCloudEnabled(checked) }
        }
        cloudRow.addView(cloudSwitch)
        col.addView(cloudRow)
        col.addView(space((6 * density).toInt()))
        col.addView(label("关闭后仅使用本地离线识别"))
        col.addView(space((26 * density).toInt()))

        // 操作按钮：开始使用（落库 API Key）/ 跳过
        val finishBtn = TextView(this).apply {
            text = PhoneI18n.t("开始使用")
            textSize = 15f
            gravity = Gravity.CENTER
            setTextColor(GfxColor.parseColor("#05100A"))
            setBackgroundColor(GfxColor.parseColor("#8FBC8F"))
            setPadding(0, (12 * density).toInt(), 0, (12 * density).toInt())
            includeFontPadding = false
            isClickable = true
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener {
                val key = keyInput.text?.toString()?.trim().orEmpty()
                if (key.isNotEmpty()) ApiKeyStore.saveApiKey(key)
                dismissFirstRun()
            }
        }
        col.addView(finishBtn)
        col.addView(space((10 * density).toInt()))
        val skipBtn = TextView(this).apply {
            text = PhoneI18n.t("跳过，保持默认")
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(GfxColor.parseColor("#888888"))
            setPadding(0, (10 * density).toInt(), 0, (10 * density).toInt())
            includeFontPadding = false
            isClickable = true
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener { dismissFirstRun() }
        }
        col.addView(skipBtn)
        return scroll
    }

    override fun onResume() {
        super.onResume()
        /* 常态保持：回到前台时若开关仍为开且已授权则继续识别（后台不识别，压低功耗） */
        if (ApiKeyStore.isAsrActive() && speechController?.isActive != true &&
            checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            startSpeech(showToast = false)
        }
    }

    override fun onPause() {
        super.onPause()
        speechController?.stop()
        updateAsrButtonState(false)
    }

    override fun onDestroy() {
        super.onDestroy()
        reversePushWatchdog?.let { mainHandler.removeCallbacks(it) }
        reversePushWatchdog = null
        speechController?.release()
        speechController = null
        ConsoleBleClient.disconnect()
        ConsoleBleClient.onConnectionStateChanged = null
        ConsoleBleClient.onModeReceived = null
        ConsoleBleClient.onEmotionReceived = null
        ConsoleBleClient.onTasksReceived = null
        ConsoleBleClient.onVoiceReceived = null
        ConsoleBleClient.onVoiceHistoryReceived = null
        PhoneDataStore.removeListener(this)
    }

    override fun onModeChanged(mode: Mode) {
        runOnUiThread {
            val fillColor: Int
            val strokeColor: Int
            val textColor: Int
            val text: String
            when (mode) {
                Mode.NA -> {
                    fillColor = GfxColor.parseColor("#FF2A2A2A")
                    strokeColor = GfxColor.parseColor("#FF666666")
                    textColor = GfxColor.parseColor("#FF888888")
                    text = "NA"
                }
                Mode.TEST -> {
                    fillColor = GfxColor.parseColor("#FF1a3a1a")
                    strokeColor = GfxColor.parseColor("#8FBC8F")
                    textColor = GfxColor.parseColor("#8FBC8F")
                    text = mode.displayName
                }
                Mode.RECOVERY -> {
                    fillColor = GfxColor.parseColor("#FF3a2a10")
                    strokeColor = GfxColor.parseColor("#FB923C")
                    textColor = GfxColor.parseColor("#FB923C")
                    text = mode.displayName
                }
                Mode.LOYALTY -> {
                    fillColor = GfxColor.parseColor("#FF0d2a3a")
                    strokeColor = GfxColor.parseColor("#66CCFF")
                    textColor = GfxColor.parseColor("#66CCFF")
                    text = mode.displayName
                }
                Mode.SIMULATED_HUMAN -> {
                    fillColor = GfxColor.parseColor("#FF3a1528")
                    strokeColor = GfxColor.parseColor("#F472B6")
                    textColor = GfxColor.parseColor("#F472B6")
                    text = mode.displayName
                }
            }
            capsule.text = PhoneI18n.t(text)
            val bg = capsule.background as GradientDrawable
            bg.setColor(fillColor)
            bg.setStroke((1.5f * density).toInt(), strokeColor)
            capsule.setTextColor(textColor)
        }
    }

    override fun onTasksChanged(tasks: List<Task>) {
        runOnUiThread {
            tasksContainer.removeAllViews()
            if (tasks.isEmpty()) {
                tasksEmpty.visibility = View.VISIBLE
                tasksContainer.visibility = View.GONE
            } else {
                tasksEmpty.visibility = View.GONE
                tasksContainer.visibility = View.VISIBLE
                val itemGap = (6 * density).toInt()
                for ((idx, task) in tasks.withIndex()) {
                    val itemView = createTaskItem(task)
                    tasksContainer.addView(itemView)
                    if (idx < tasks.size - 1) {
                        tasksContainer.addView(space(itemGap))
                    }
                }
            }
        }
    }

    private fun createTaskItem(task: Task): View {
        val cardPaddingH = (12 * density).toInt()
        val cardPaddingV = (10 * density).toInt()
        val (textCol, accentCol) = when (task.type) {
            "cognitive" -> Pair(
                GfxColor.parseColor("#FB923C"),
                GfxColor.parseColor("#FB923C")
            )
            "terminal" -> Pair(
                GfxColor.parseColor("#2DD4BF"),
                GfxColor.parseColor("#2DD4BF")
            )
            "button" -> Pair(
                GfxColor.parseColor("#94A3B8"),
                PhoneDataStore.mode.color
            )
            else -> Pair(
                Color.WHITE,
                PhoneDataStore.mode.color
            )
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.item_card_bg)
            setPadding(cardPaddingH, cardPaddingV, cardPaddingH, cardPaddingV)

            val indicator = TextView(this@MainActivity).apply {
                includeFontPadding = false
                gravity = Gravity.CENTER_VERTICAL
                if (task.isDone) {
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    setPadding(0, 0, (10 * density).toInt(), 0)
                    text = "✓"
                    setTextColor(Color.GRAY)
                    typeface = Typeface.DEFAULT_BOLD
                } else {
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    setPadding(0, 0, (10 * density).toInt(), 0)
                    text = when (task.type) {
                        "cognitive" -> "◈"
                        "terminal" -> "◇"
                        "button" -> "◆"
                        else -> "●"
                    }
                    setTextColor(accentCol)
                }
            }
            addView(indicator, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))

            val name = TextView(this@MainActivity).apply {
                text = PhoneI18n.t(task.name)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                setTextColor(if (task.isDone) Color.GRAY else textCol)
                includeFontPadding = false
                maxLines = 2
            }
            addView(name, LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            ))
        }
    }

    override fun onEmotionChanged(emotion: Emotion?) {
        runOnUiThread {
            val shouldShowNa = emotion == null || (!PhoneDataStore.hasReceivedRealData && consoleStatus != BleConstants.BLE_STATUS_CONNECTED)
            if (shouldShowNa) {
                emotionPanel.showNaState()
            } else {
                emotionPanel.setEmotion(emotion)
            }
        }
    }

    override fun onVoiceMessagesChanged(messages: List<VoiceMessage>) {
        runOnUiThread {
            voiceContainer.removeAllViews()
            if (messages.isEmpty()) {
                voiceEmpty.visibility = View.VISIBLE
                voiceContainer.visibility = View.GONE
            } else {
                voiceEmpty.visibility = View.GONE
                voiceContainer.visibility = View.VISIBLE
                val itemGap = (6 * density).toInt()
                for ((idx, msg) in messages.withIndex()) {
                    val itemView = createVoiceItem(msg)
                    voiceContainer.addView(itemView)
                    if (idx < messages.size - 1) {
                        voiceContainer.addView(space(itemGap))
                    }
                }
            }
        }
    }

    private fun createVoiceItem(msg: VoiceMessage): View {
        val cardPaddingH = (12 * density).toInt()
        val cardPaddingV = (10 * density).toInt()
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.item_card_bg)
            setPadding(cardPaddingH, cardPaddingV, cardPaddingH, cardPaddingV)

            val timeStr = voiceTimeFormat.format(Date(msg.timestamp))
            val timeTv = TextView(this@MainActivity).apply {
                text = timeStr
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                setTextColor(Color.GRAY)
                includeFontPadding = false
                setPadding(0, 0, 0, (3 * density).toInt())
            }
            addView(timeTv)

            val contentTv = TextView(this@MainActivity).apply {
                text = PhoneI18n.t(msg.content)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                setTextColor(Color.WHITE)
                includeFontPadding = false
                maxLines = 3
            }
            addView(contentTv)
        }
    }

    private fun injectSampleData() {
        val modes = Mode.values()
        val currentIdx = modes.indexOf(PhoneDataStore.mode)
        val nextMode = modes[(currentIdx + 1) % modes.size]
        PhoneDataStore.setMode(nextMode)

        val sampleTasks = listOf(
            Task("cog_1", "用户存在红色颜色偏好", "pending", "cognitive"),
            Task("cog_2", "对圆形物体有额外关注", "pending", "cognitive"),
            Task("term_1", "执行环境扫描任务", "pending", "terminal"),
            Task("term_2", "同步云端配置数据", "pending", "terminal"),
            Task("norm_1", "前往充电座充电", "pending", null),
            Task("norm_2", "等待用户语音指令", "pending", null),
            Task("norm_3", "完成系统自检流程", "pending", null),
            Task("norm_4", "检查传感器状态", "done", null),
            Task("norm_5", "更新定位地图信息", "pending", null),
            Task("norm_6", "执行第七项任务测试长列表", "pending", null),
            Task("norm_7", "第八个任务验证继续添加", "pending", null),
            Task("norm_8", "第九个任务确认完整显示", "pending", null),
            Task("norm_9", "第十项任务滚动到底部", "pending", null),
            Task("norm_10", "第十一项验证导航栏通透", "pending", null),
            Task("norm_11", "第十二项检查状态栏效果", "pending", null),
            Task("btn_1", "暂停所有任务执行", "pending", "button"),
            Task("btn_2", "恢复出厂默认设置", "pending", "button"),
        )
        PhoneDataStore.setTasks(sampleTasks)

        PhoneDataStore.setEmotion(
            Emotion(
                obedience = (60..100).random(),
                shame = (0..60).random(),
                pleasure = (30..100).random(),
                mechanical = (0..100).random()
            )
        )

        val sampleVoices = listOf(
            "系统已启动，等待指令",
            "任务执行完成，请查收",
            "检测到低电量，即将返回充电",
            "语音播报测试消息内容示例",
            "用户身份验证成功",
            "第六次语音播报测试滚动效果",
            "第七次播报，验证底部导航栏通透",
            "第八次播报，继续测试长列表",
        )
        val now = System.currentTimeMillis()
        sampleVoices.forEachIndexed { i, content ->
            PhoneDataStore.addVoiceMessageIfNew(VoiceMessage(now - (sampleVoices.size - i) * 5000, content))
        }
    }

}

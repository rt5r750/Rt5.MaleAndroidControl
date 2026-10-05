package com.robotcontrol.watch

import android.app.Activity
import android.app.AlertDialog
import android.content.DialogInterface
import android.content.pm.PackageManager
import android.graphics.Color as GfxColor
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.*
import android.widget.ArrayAdapter
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import com.robotcontrol.watch.ble.*
import com.robotcontrol.watch.data.*
import com.robotcontrol.watch.ui.*
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : Activity(), DataStoreListener {

    private lateinit var root: FrameLayout
    private lateinit var pageContainer: PageContainer
    private lateinit var emotionPage: EmotionView
    private lateinit var taskPage: TaskPageView
    private lateinit var voicePage: VoicePageView
    private lateinit var timeText: TextView
    private lateinit var capsule: TextView
    private lateinit var btBtn: TextView

    private var safePadding: Int = 0
    private var capsuleBottomY: Int = 0
    private val timeHandler = Handler(Looper.getMainLooper())
    private val mainHandler = Handler(Looper.getMainLooper())
    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    private var btStatus = BleConstants.BLE_STATUS_UNBONDED
    private var discoveredDevices = mutableListOf<Pair<String, String>>()
    private val timeRunnable = object : Runnable {
        override fun run() {
            timeText.text = timeFormat.format(Date())
            timeHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setBackgroundDrawableResource(android.R.color.black)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        setContentView(R.layout.activity_main)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
            }
        }

        root = findViewById(R.id.root)
        pageContainer = findViewById(R.id.pageContainer)
        timeText = findViewById(R.id.timeText)
        capsule = findViewById(R.id.capsule)
        btBtn = findViewById(R.id.btBtn)

        val density = resources.displayMetrics.density
        safePadding = (18 * density).toInt()

        emotionPage = EmotionView(this)
        taskPage = TaskPageView(this)
        voicePage = VoicePageView(this)

        pageContainer.addView(emotionPage)
        pageContainer.addView(taskPage)
        pageContainer.addView(voicePage)
        pageContainer.setCurrentPage(1, false)

        updateCapsule(WatchDataStore.mode)

        root.viewTreeObserver.addOnGlobalLayoutListener(object : ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                if (capsule.height == 0 || timeText.height == 0) return

                val minDimension = minOf(root.width, root.height)
                val newSafePadding = (minDimension * 0.08f).toInt().coerceAtLeast((18 * density).toInt())
                safePadding = newSafePadding

                (pageContainer.layoutParams as FrameLayout.LayoutParams).setMargins(
                    safePadding, 0, safePadding, safePadding
                )

                val capsuleLp = capsule.layoutParams as FrameLayout.LayoutParams
                val extraGap = (8 * density).toInt()
                capsuleBottomY = capsuleLp.topMargin + capsule.height + extraGap

                emotionPage.setPadding(safePadding, capsuleBottomY, safePadding, safePadding)
                taskPage.setPadding(safePadding, 0, safePadding, safePadding)
                taskPage.setContentTopPadding(capsuleBottomY)
                voicePage.setPadding(safePadding, 0, safePadding, safePadding)
                voicePage.setContentTopPadding(capsuleBottomY)

                pageContainer.requestLayout()

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                    root.viewTreeObserver.removeOnGlobalLayoutListener(this)
                } else {
                    @Suppress("DEPRECATION")
                    root.viewTreeObserver.removeGlobalOnLayoutListener(this)
                }
            }
        })

        WatchDataStore.addListener(this)

        BondStore.init(this)
        setupBleButtons()
        initBle()
    }

    private fun setupBleButtons() {
        btBtn.text = "B"
        btBtn.setOnClickListener { showBleDialog() }
    }

    private fun initBle() {
        if (!BlePermissionHelper.hasAllPermissions(this)) {
            BlePermissionHelper.requestPermissions(this)
            return
        }
        if (!BlePermissionHelper.isBluetoothEnabled(this)) {
            BlePermissionHelper.enableBluetooth(this)
            return
        }
        startBle()
    }

    /* BLE 生命周期（连接、回调接线、震动）全部由 BleKeepAliveService 前台服务承载，
       本 Activity 只负责权限引导、扫描/连接 UI 与展示；退出后连接与震动仍由服务维持 */
    private fun startBle() {
        BleKeepAliveService.start(this)

        if (BondStore.hasConsoleBond()) {
            val addr = BondStore.getConsoleAddress()
            if (addr != null) {
                btStatus = BleConstants.BLE_STATUS_CONNECTING
                updateBtButtonColor(btStatus)
                Toast.makeText(this, "正在连接...", Toast.LENGTH_SHORT).show()
                mainHandler.postDelayed({
                    if (!PhoneBleClient.isConnected()) {
                        btStatus = BleConstants.BLE_STATUS_DISCONNECTED
                        updateBtButtonColor(btStatus)
                        Toast.makeText(this, "连接失败", Toast.LENGTH_SHORT).show()
                    }
                }, BleConstants.CONNECTION_TIMEOUT_MS)
            }
        }
    }

    private fun updateBtButtonColor(state: Int) {
        val bg = btBtn.background as GradientDrawable
        val color = when (state) {
            BleConstants.BLE_STATUS_CONNECTED -> GfxColor.parseColor("#4ade80")
            BleConstants.BLE_STATUS_DISCONNECTED -> GfxColor.parseColor("#ef4444")
            BleConstants.BLE_STATUS_CONNECTING -> GfxColor.parseColor("#fbbf24")
            else -> GfxColor.parseColor("#66888888")
        }
        bg.setStroke((1.5f * resources.displayMetrics.density).toInt(), color)
        btBtn.setTextColor(color)
    }

    private fun showBleDialog() {
        val statusText = when (btStatus) {
            BleConstants.BLE_STATUS_CONNECTED -> "已连接"
            BleConstants.BLE_STATUS_DISCONNECTED -> "连接失败"
            BleConstants.BLE_STATUS_CONNECTING -> "连接中..."
            else -> "未绑定"
        }
        val addr = BondStore.getConsoleAddress() ?: ""
        val msg = "状态：$statusText" + if (addr.isNotEmpty()) "\n地址：$addr" else ""

        val buttons = mutableListOf<Pair<String, () -> Unit>>()
        if (btStatus == BleConstants.BLE_STATUS_CONNECTED) {
            buttons.add("断开" to {
                PhoneBleClient.disconnect()
                btStatus = BleConstants.BLE_STATUS_DISCONNECTED
                updateBtButtonColor(btStatus)
            })
        } else {
            buttons.add("扫描" to { startScan() })
        }
        if (BondStore.hasConsoleBond()) {
            buttons.add("解绑" to {
                PhoneBleClient.disconnect()
                BondStore.clearConsoleBond()
                btStatus = BleConstants.BLE_STATUS_UNBONDED
                updateBtButtonColor(btStatus)
                Toast.makeText(this, "已解绑", Toast.LENGTH_SHORT).show()
            })
        }
        buttons.add("保活设置" to { showKeepAliveDialog(markShown = false) })
        buttons.add("关闭" to {})

        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_NoActionBar)
            .setTitle("蓝牙连接")
            .setMessage(msg)
            .setItems(buttons.map { it.first }.toTypedArray()) { _, which -> buttons[which].second() }
            .show()
    }

    private fun startScan() {
        discoveredDevices.clear()
        val adapter = ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, mutableListOf())
        val dialog = AlertDialog.Builder(this)
            .setTitle("扫描中...")
            .setAdapter(adapter) { _, pos ->
                PhoneBleClient.stopScan()
                val (name, addr) = discoveredDevices[pos]
                BondStore.saveConsoleAddress(addr)
                btStatus = BleConstants.BLE_STATUS_CONNECTING
                updateBtButtonColor(btStatus)
                Toast.makeText(this, "连接$name...", Toast.LENGTH_SHORT).show()
                PhoneBleClient.connect(this, addr)
                mainHandler.postDelayed({
                    if (!PhoneBleClient.isConnected()) {
                        btStatus = BleConstants.BLE_STATUS_DISCONNECTED
                        updateBtButtonColor(btStatus)
                        Toast.makeText(this, "连接失败", Toast.LENGTH_SHORT).show()
                    }
                }, BleConstants.CONNECTION_TIMEOUT_MS)
            }
            .setNegativeButton("取消") { _, _ -> PhoneBleClient.stopScan() }
            .setCancelable(false)
            .create()

        PhoneBleClient.startScan { name, addr ->
            runOnUiThread {
                if (discoveredDevices.none { it.second == addr }) {
                    discoveredDevices.add(name to addr)
                    adapter.add("$name\n$addr")
                    adapter.notifyDataSetChanged()
                    dialog.setTitle("发现设备(${discoveredDevices.size})")
                }
            }
        }
        dialog.show()

        mainHandler.postDelayed({
            if (dialog.isShowing) {
                PhoneBleClient.stopScan()
                if (discoveredDevices.isEmpty()) {
                    dialog.dismiss()
                    Toast.makeText(this, "未发现设备", Toast.LENGTH_SHORT).show()
                } else {
                    dialog.getButton(DialogInterface.BUTTON_NEGATIVE)?.text = "关闭"
                }
            }
        }, BleConstants.SCAN_DURATION_MS)
    }

    override fun onRequestPermissionsResult(req: Int, perms: Array<out String>, grants: IntArray) {
        super.onRequestPermissionsResult(req, perms, grants)
        if (req == BlePermissionHelper.REQUEST_BT_PERMISSIONS) {
            if (BlePermissionHelper.hasAllPermissions(this)) {
                if (!BlePermissionHelper.isBluetoothEnabled(this)) BlePermissionHelper.enableBluetooth(this)
                else startBle()
            } else {
                Toast.makeText(this, "权限被拒", Toast.LENGTH_SHORT).show()
                updateBtButtonColor(BleConstants.BLE_STATUS_DISCONNECTED)
            }
        }
    }

    override fun onActivityResult(req: Int, res: Int, data: android.content.Intent?) {
        super.onActivityResult(req, res, data)
        if (req == BlePermissionHelper.REQUEST_ENABLE_BT) {
            if (res == RESULT_OK) startBle()
            else Toast.makeText(this, "蓝牙未开启", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        timeText.text = timeFormat.format(Date())
        timeHandler.post(timeRunnable)
    }

    override fun onPause() {
        super.onPause()
        timeHandler.removeCallbacks(timeRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        // 不再断开 BLE：连接由保活前台服务持有，Activity 销毁后接收与震动不中断
        WatchDataStore.removeListener(this)
    }

    override fun onBleStateChanged(state: Int) {
        runOnUiThread {
            btStatus = state
            updateBtButtonColor(state)
            when (state) {
                BleConstants.BLE_STATUS_CONNECTED -> {
                    Toast.makeText(this, "已连接手机", Toast.LENGTH_SHORT).show()
                    maybeShowKeepAliveHint()
                }
                BleConstants.BLE_STATUS_DISCONNECTED -> Toast.makeText(this, "连接断开", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /* ===== 保活设置引导（首连成功后弹一次，蓝牙按钮菜单可再次打开） =====
       网络调研结论：小米/OPPO 等定制系统的后台管控靠「自启动 + 省电白名单 + 后台锁定」三件套，
       手表固件上的设置项入口不固定，这里做文字指引 + 两个跳转按钮（厂商组件探测失败静默回退） */
    private var keepAliveHintShowing = false

    private fun maybeShowKeepAliveHint() {
        if (keepAliveHintShowing) return
        val prefs = getSharedPreferences("keepalive_prefs", MODE_PRIVATE)
        if (prefs.getBoolean("hint_shown", false)) return
        showKeepAliveDialog(markShown = true)
    }

    private fun showKeepAliveDialog(markShown: Boolean) {
        keepAliveHintShowing = true
        val message = when {
            android.os.Build.MANUFACTURER.contains("xiaomi", ignoreCase = true) ||
                android.os.Build.MANUFACTURER.contains("redmi", ignoreCase = true) ->
                "为保证手表 App 被杀后仍能收到控制台消息，建议在手表上设置：\n" +
                    "1. 设置 → 应用设置 → 授权管理 → 自启动：允许本应用\n" +
                    "2. 省电与电池 → 应用耗电优化：本应用设为无限制\n" +
                    "3. 最近任务中锁定本应用卡片\n" +
                    "4. 点击「电池优化白名单」允许忽略电池优化"
            android.os.Build.MANUFACTURER.contains("oppo", ignoreCase = true) ||
                android.os.Build.MANUFACTURER.contains("oneplus", ignoreCase = true) ||
                android.os.Build.MANUFACTURER.contains("realme", ignoreCase = true) ->
                "为保证手表 App 被杀后仍能收到控制台消息，建议在手表上设置：\n" +
                    "1. 设置 → 应用 → 自启动管理：允许本应用\n" +
                    "2. 设置 → 电池 → 耗电管理：允许本应用后台运行\n" +
                    "3. 点击「电池优化白名单」允许忽略电池优化"
            else ->
                "为保证手表 App 被杀后仍能收到控制台消息，建议：\n" +
                    "1. 系统设置中将本应用设为不参与电池优化/允许后台运行\n" +
                    "2. 部分手表可在最近任务中锁定本应用\n" +
                    "3. 点击「电池优化白名单」允许忽略电池优化"
        }

        val dialog = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_NoActionBar)
            .setTitle("保活设置建议")
            .setMessage(message)
            .setPositiveButton("电池优化白名单") { _, _ ->
                try {
                    startActivity(
                        android.content.Intent(
                            android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            android.net.Uri.parse("package:$packageName")
                        )
                    )
                } catch (e: Exception) {
                    try {
                        startActivity(android.content.Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    } catch (_: Exception) {
                        Toast.makeText(this, "未找到电池优化设置", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNeutralButton("应用信息") { _, _ ->
                try {
                    startActivity(
                        android.content.Intent(
                            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            android.net.Uri.parse("package:$packageName")
                        )
                    )
                } catch (_: Exception) {
                }
            }
            .setNegativeButton("知道了", null)
            .create()
        dialog.setOnDismissListener {
            keepAliveHintShowing = false
            if (markShown) {
                getSharedPreferences("keepalive_prefs", MODE_PRIVATE)
                    .edit().putBoolean("hint_shown", true).apply()
            }
        }
        dialog.show()
    }

    override fun onModeChanged(mode: Mode) {
        runOnUiThread {
            title = mode.displayName
            updateCapsule(mode)
            taskPage.setTasks(WatchDataStore.tasks)
        }
    }

    override fun onTasksChanged(tasks: List<Task>) {
        runOnUiThread {
            taskPage.setTasks(tasks)
        }
    }

    override fun onEmotionChanged(emotion: Emotion) {
        runOnUiThread {
            emotionPage.setEmotion(emotion)
        }
    }

    override fun onVoiceMessagesChanged(messages: List<VoiceMessage>) {
        runOnUiThread {
            voicePage.setVoiceMessages(messages)
        }
    }

    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        if (event.source and InputDevice.SOURCE_ROTARY_ENCODER != 0) {
            val delta = -event.getAxisValue(MotionEvent.AXIS_SCROLL) * 60
            when (pageContainer.getCurrentPage()) {
                1 -> scrollScrollViewBy(taskPage.getScrollView(), delta)
                2 -> scrollScrollViewBy(voicePage.getScrollView(), delta)
            }
            return true
        }
        return super.onGenericMotionEvent(event)
    }

    private fun scrollScrollViewBy(scrollView: android.widget.ScrollView, delta: Float) {
        scrollView.smoothScrollBy(0, delta.toInt())
    }

    private fun updateCapsule(mode: Mode) {
        capsule.text = mode.displayName
        capsule.setTextColor(mode.color)
        capsule.background = createCapsuleDrawable(mode.color)
    }

    private fun createCapsuleDrawable(strokeColor: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 100f * resources.displayMetrics.density
            setColor(android.graphics.Color.parseColor("#CC000000"))
            setStroke(1 * resources.displayMetrics.density.toInt(), strokeColor)
        }
    }
}

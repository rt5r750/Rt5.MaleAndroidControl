package com.robotcontrol.watch.ble

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import com.robotcontrol.watch.MainActivity
import com.robotcontrol.watch.R
import com.robotcontrol.watch.data.Emotion
import com.robotcontrol.watch.data.Mode
import com.robotcontrol.watch.data.Task
import com.robotcontrol.watch.data.VoiceMessage
import com.robotcontrol.watch.data.WatchDataStore
import org.json.JSONArray
import org.json.JSONObject

/* BLE 保活前台服务（connectedDevice 类型）：
   · 连接生命周期、数据回调接线（→WatchDataStore）、模式切换震动全部收拢于此，
     Activity 退出/被杀/息屏后连接与震动仍工作
   · START_STICKY + onTaskRemoved 自重启 + 开机自启（BootReceiver），被杀可恢复
   · 常驻通知展示连接状态与当前模式（IMPORTANCE_LOW，不打扰） */
class BleKeepAliveService : Service() {

    override fun onBind(intent: Intent?) = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()
        startBleInternal()
        return START_STICKY
    }

    private fun startAsForeground() {
        val notification = buildNotification(WatchDataStore.connectionState, WatchDataStore.mode)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startBleInternal() {
        if (!BlePermissionHelper.hasAllPermissions(this)) {
            // 无权限时保活服务先驻留（通知提示），用户打开 App 授权后 MainActivity 会再次拉起
            updateNotification()
            return
        }
        if (!BlePermissionHelper.isBluetoothEnabled(this)) {
            updateNotification()
            return
        }

        PhoneBleClient.initialize(this)
        wireCallbacks()

        if (PhoneBleClient.isConnected()) {
            updateNotification()
            return
        }

        if (BondStore.hasConsoleBond()) {
            val addr = BondStore.getConsoleAddress()
            if (addr != null) {
                WatchDataStore.setConnectionState(BleConstants.BLE_STATUS_CONNECTING)
                PhoneBleClient.connect(this, addr)
            }
        }
    }

    private var callbacksWired = false

    private fun wireCallbacks() {
        if (callbacksWired) return
        callbacksWired = true

        PhoneBleClient.onConnectionStateChanged = { state ->
            WatchDataStore.setConnectionState(state)
            updateNotification()
        }
        PhoneBleClient.onModeReceived = { ordinal ->
            val modes = Mode.values()
            if (ordinal in modes.indices) {
                WatchDataStore.setMode(modes[ordinal])
            }
            vibrateForMode(ordinal)
            updateNotification()
        }
        PhoneBleClient.onEmotionReceived = { o, s, p, m ->
            WatchDataStore.setEmotion(Emotion(o.coerceIn(0, 100), s.coerceIn(0, 100), p.coerceIn(0, 100), m.coerceIn(0, 100)))
        }
        PhoneBleClient.onTasksReceived = { json ->
            try {
                val arr = JSONArray(json)
                val tasks = mutableListOf<Task>()
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    tasks.add(Task(obj.getString("id"), obj.getString("name"), obj.optString("status", "pending")))
                }
                WatchDataStore.setTasks(tasks)
            } catch (e: Exception) {
                android.util.Log.e("BleKeepAlive", "Parse tasks err", e)
            }
        }
        PhoneBleClient.onVoiceReceived = { json ->
            try {
                val obj = JSONObject(json)
                WatchDataStore.addVoiceMessage(VoiceMessage(obj.getLong("timestamp"), obj.getString("content")))
            } catch (e: Exception) {
                android.util.Log.e("BleKeepAlive", "Parse voice err", e)
            }
        }
    }

    /* ===== 模式切换震动：拟人=两短、忠诚=两长、调试=一长；恢复模式未指定不震、NA 不震。
       同一序号 1s 内去重（初读+订阅推送双触发不双震） ===== */
    private var lastVibrateOrdinal: Int = -1
    private var lastVibrateAt: Long = 0

    private fun vibrateForMode(ordinal: Int) {
        val timings = when (ordinal) {
            MODE_SIMULATED_HUMAN -> longArrayOf(0, 150, 150, 150)
            MODE_LOYALTY -> longArrayOf(0, 600, 200, 600)
            MODE_TEST -> longArrayOf(0, 600)
            else -> return
        }
        val now = SystemClock.elapsedRealtime()
        if (ordinal == lastVibrateOrdinal && now - lastVibrateAt < 1000) return
        lastVibrateOrdinal = ordinal
        lastVibrateAt = now

        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        } ?: return
        if (!vibrator.hasVibrator()) return
        runCatching {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
        }
    }

    /* ===== 常驻通知 ===== */
    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.keepalive_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            channel.setShowBadge(false)
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }

    private fun updateNotification() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(WatchDataStore.connectionState, WatchDataStore.mode))
    }

    private fun buildNotification(state: Int, mode: Mode): Notification {
        val contentText = when (state) {
            BleConstants.BLE_STATUS_CONNECTED -> getString(R.string.keepalive_connected_fmt, mode.displayName)
            BleConstants.BLE_STATUS_CONNECTING -> getString(R.string.keepalive_connecting)
            BleConstants.BLE_STATUS_DISCONNECTED -> if (BondStore.hasConsoleBond()) getString(R.string.keepalive_reconnecting) else getString(R.string.keepalive_unbonded)
            else -> getString(R.string.keepalive_unbonded)
        }
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(getString(R.string.keepalive_title))
            .setContentText(contentText)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    /* 用户从最近任务划掉：1s 后自重启恢复连接（getForegroundService 自 API 26 可用） */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val restart = Intent(applicationContext, BleKeepAliveService::class.java)
        val pi = PendingIntent.getForegroundService(
            applicationContext, RESTART_REQUEST_CODE, restart,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        (getSystemService(ALARM_SERVICE) as AlarmManager).setExactAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 1000,
            pi
        )
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        super.onDestroy()
        callbacksWired = false
    }

    companion object {
        private const val CHANNEL_ID = "ble_keepalive"
        private const val NOTIFICATION_ID = 1001
        private const val RESTART_REQUEST_CODE = 1002
        private const val MODE_TEST = 0
        private const val MODE_LOYALTY = 2
        private const val MODE_SIMULATED_HUMAN = 3

        fun start(context: Context) {
            val intent = Intent(context, BleKeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}

package com.robotcontrol.phone.data

import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import androidx.core.app.NotificationCompat
import com.robotcontrol.phone.PhoneI18n
import com.robotcontrol.phone.RobotPhoneApplication
import org.json.JSONArray

interface DataStoreListener {
    fun onModeChanged(mode: Mode)
    fun onTasksChanged(tasks: List<Task>)
    fun onEmotionChanged(emotion: Emotion?)
    fun onVoiceMessagesChanged(messages: List<VoiceMessage>)
}

object PhoneDataStore {

    private const val PREFS_NAME = "phone_data_store"
    private const val KEY_LAST_MODE = "last_mode"
    private const val KEY_HAS_EMOTION = "has_emotion"
    private const val KEY_LAST_OBEDIENCE = "last_obedience"
    private const val KEY_LAST_SHAME = "last_shame"
    private const val KEY_LAST_PLEASURE = "last_pleasure"
    private const val KEY_LAST_MECHANICAL = "last_mechanical"
    private const val KEY_LAST_DATA_TIMESTAMP = "last_data_timestamp"
    private const val DATA_EXPIRY_MS = 20L * 24 * 60 * 60 * 1000

    @Volatile
    var mode: Mode = Mode.NA
        private set

    @Volatile
    var tasks: List<Task> = emptyList()
        private set

    @Volatile
    var emotion: Emotion? = null
        private set

    @Volatile
    var voiceMessages: List<VoiceMessage> = emptyList()
        private set

    @Volatile
    var hasReceivedRealData: Boolean = false
        private set

    private var lastDataTimestamp: Long = 0L

    private val listeners = mutableSetOf<DataStoreListener>()
    private var notificationContext: Context? = null
    private var prefs: SharedPreferences? = null

    /* ===== 反向推送（手机端 → 控制端）通知口径 =====
       控制端收到手机端写入的模式后会回推模式/语音（原代码行为）；此期间到达的语音通知
       标题用「推送成功」替代「主人指令」，且只弹一条（先弹的会被抑制）。 */
    @Volatile private var reverseEchoUntil: Long = 0L
    @Volatile private var suppressVoiceNotificationUntil: Long = 0L

    /** 手机端发起反向模式推送后调用：开启回声窗口，窗口内到达的语音通知标题改为「推送成功」 */
    fun armReversePushEcho(windowMs: Long = 4000L) {
        reverseEchoUntil = System.currentTimeMillis() + windowMs
    }

    /** 是否仍在等待反向推送回声（未被语音通知消费） */
    fun isAwaitingReverseEcho(): Boolean = System.currentTimeMillis() <= reverseEchoUntil

    /** 兜底：控制端回声未到时由手机端弹一条「推送成功」，并短暂抑制语音通知避免双弹 */
    fun notifyReversePushSuccess(body: String) {
        reverseEchoUntil = 0L
        suppressVoiceNotificationUntil = System.currentTimeMillis() + 4000L
        postNotification(PhoneI18n.t("推送成功"), body, System.currentTimeMillis().toInt())
    }

    fun initialize(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val sp = prefs ?: return

        val savedTimestamp = sp.getLong(KEY_LAST_DATA_TIMESTAMP, 0L)
        val now = System.currentTimeMillis()
        lastDataTimestamp = savedTimestamp

        if (savedTimestamp == 0L || now - savedTimestamp > DATA_EXPIRY_MS) {
            mode = Mode.NA
            tasks = emptyList()
            emotion = null
            hasReceivedRealData = false
            clearPersistentData(sp)
            return
        }

        val modeName = sp.getString(KEY_LAST_MODE, null)
        val restoredMode = Mode.values().firstOrNull { it.name == modeName }
        if (restoredMode != null) {
            mode = restoredMode
        }

        val hasEmotion = sp.getBoolean(KEY_HAS_EMOTION, false)
        if (hasEmotion) {
            val obedience = sp.getInt(KEY_LAST_OBEDIENCE, 100).coerceIn(0, 100)
            val shame = sp.getInt(KEY_LAST_SHAME, 0).coerceIn(0, 100)
            val pleasure = sp.getInt(KEY_LAST_PLEASURE, 100).coerceIn(0, 100)
            val mechanical = sp.getInt(KEY_LAST_MECHANICAL, 50).coerceIn(0, 100)
            emotion = Emotion(obedience, shame, pleasure, mechanical)
        } else {
            emotion = null
        }

        // Tasks are NOT persisted - always start empty, only populated from live BLE data
        tasks = emptyList()

        hasReceivedRealData = mode != Mode.NA || emotion != null
    }

    fun getLastDataTimestamp(): Long = lastDataTimestamp

    private fun persistData() {
        val sp = prefs ?: return
        val editor = sp.edit()
        editor.putString(KEY_LAST_MODE, mode.name)
        editor.putBoolean(KEY_HAS_EMOTION, emotion != null)
        emotion?.let {
            editor.putInt(KEY_LAST_OBEDIENCE, it.obedience)
            editor.putInt(KEY_LAST_SHAME, it.shame)
            editor.putInt(KEY_LAST_PLEASURE, it.pleasure)
            editor.putInt(KEY_LAST_MECHANICAL, it.mechanical)
        }
        // Tasks are NOT persisted
        lastDataTimestamp = System.currentTimeMillis()
        editor.putLong(KEY_LAST_DATA_TIMESTAMP, lastDataTimestamp)
        editor.apply()
    }

    private fun clearPersistentData(sp: SharedPreferences) {
        sp.edit().clear().apply()
    }

    fun setNotificationContext(context: Context) {
        notificationContext = context.applicationContext
    }

    fun addListener(listener: DataStoreListener) {
        listeners.add(listener)
        listener.onModeChanged(mode)
        listener.onTasksChanged(tasks)
        listener.onEmotionChanged(emotion)
        listener.onVoiceMessagesChanged(voiceMessages)
    }

    fun removeListener(listener: DataStoreListener) {
        listeners.remove(listener)
    }

    fun setMode(newMode: Mode) {
        if (mode == newMode) return
        mode = newMode
        if (newMode != Mode.NA) {
            hasReceivedRealData = true
        }
        persistData()
        listeners.forEach { it.onModeChanged(newMode) }
    }

    fun setTasks(newTasks: List<Task>) {
        tasks = newTasks.toList()
        hasReceivedRealData = true
        persistData()
        listeners.forEach { it.onTasksChanged(tasks) }
    }

    fun addTask(task: Task) {
        if (tasks.any { it.id == task.id }) return
        tasks = tasks + listOf(task)
        hasReceivedRealData = true
        persistData()
        listeners.forEach { it.onTasksChanged(tasks) }
    }

    fun updateTaskStatus(id: String, status: String) {
        tasks = tasks.map {
            if (it.id == id) it.copy(status = status) else it
        }
        persistData()
        listeners.forEach { it.onTasksChanged(tasks) }
    }

    fun setEmotion(newEmotion: Emotion) {
        emotion = newEmotion
        hasReceivedRealData = true
        persistData()
        listeners.forEach { it.onEmotionChanged(newEmotion) }
    }

    fun addVoiceMessage(message: VoiceMessage) {
        if (voiceMessages.any { it.timestamp == message.timestamp && it.content == message.content }) return
        voiceMessages = (listOf(message) + voiceMessages).distinctBy { it.timestamp }.sortedByDescending { it.timestamp }.take(100)
        listeners.forEach { it.onVoiceMessagesChanged(voiceMessages) }
        sendVoiceNotification(message)
    }

    fun addVoiceMessageIfNew(message: VoiceMessage) {
        addVoiceMessage(message)
    }

    fun setVoiceHistory(messages: List<VoiceMessage>) {
        val sorted = messages.sortedByDescending { it.timestamp }
        val existingTimestamps = voiceMessages.map { it.timestamp }.toSet()
        val newOnes = sorted.filter { it.timestamp !in existingTimestamps }
        if (newOnes.isNotEmpty()) {
            voiceMessages = (voiceMessages + newOnes).distinctBy { it.timestamp }.sortedByDescending { it.timestamp }.take(100)
            listeners.forEach { it.onVoiceMessagesChanged(voiceMessages) }
        } else if (voiceMessages.isEmpty() && sorted.isNotEmpty()) {
            voiceMessages = sorted.take(100)
            listeners.forEach { it.onVoiceMessagesChanged(voiceMessages) }
        }
    }

    fun clear() {
        mode = Mode.NA
        tasks = emptyList()
        emotion = null
        voiceMessages = emptyList()
        hasReceivedRealData = false
        lastDataTimestamp = 0L
        prefs?.let { clearPersistentData(it) }
        listeners.forEach { it.onModeChanged(mode) }
        listeners.forEach { it.onTasksChanged(tasks) }
        listeners.forEach { it.onEmotionChanged(emotion) }
        listeners.forEach { it.onVoiceMessagesChanged(voiceMessages) }
    }

    private fun sendVoiceNotification(message: VoiceMessage) {
        val now = System.currentTimeMillis()
        /* 反向推送回声窗口内：标题改「推送成功」且只弹一条；兜底条已弹时抑制回声，避免双通知 */
        if (now <= suppressVoiceNotificationUntil) return
        val title = if (now <= reverseEchoUntil) {
            reverseEchoUntil = 0L
            PhoneI18n.t("推送成功")
        } else {
            PhoneI18n.t("主人指令")
        }
        postNotification(title, message.content, message.timestamp.toInt())
    }

    private fun postNotification(title: String, content: String, id: Int) {
        val context = notificationContext ?: return
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val builder = NotificationCompat.Builder(context, RobotPhoneApplication.CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setAutoCancel(true)

        try {
            notificationManager.notify(id, builder.build())
        } catch (_: Exception) {
        }
    }
}

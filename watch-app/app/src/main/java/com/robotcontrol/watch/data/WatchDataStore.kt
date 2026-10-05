package com.robotcontrol.watch.data

import com.robotcontrol.watch.ble.BleConstants

interface DataStoreListener {
    fun onModeChanged(mode: Mode)
    fun onTasksChanged(tasks: List<Task>)
    fun onEmotionChanged(emotion: Emotion)
    fun onVoiceMessagesChanged(messages: List<VoiceMessage>)
    /** BLE 连接状态（BleConstants.BLE_STATUS_*）：UI 按钮随动，数据由保活服务驱动 */
    fun onBleStateChanged(state: Int) {}
}

object WatchDataStore {

    @Volatile
    var mode: Mode = Mode.TEST
        private set

    @Volatile
    var tasks: List<Task> = emptyList()
        private set

    @Volatile
    var emotion: Emotion = Emotion()
        private set

    @Volatile
    var voiceMessages: List<VoiceMessage> = emptyList()
        private set

    @Volatile
    var connectionState: Int = BleConstants.BLE_STATUS_UNBONDED
        private set

    private val listeners = mutableSetOf<DataStoreListener>()

    fun addListener(listener: DataStoreListener) {
        listeners.add(listener)
        listener.onModeChanged(mode)
        listener.onTasksChanged(tasks)
        listener.onEmotionChanged(emotion)
        listener.onVoiceMessagesChanged(voiceMessages)
        listener.onBleStateChanged(connectionState)
    }

    fun removeListener(listener: DataStoreListener) {
        listeners.remove(listener)
    }

    fun setMode(newMode: Mode) {
        if (mode == newMode) return
        mode = newMode
        listeners.forEach { it.onModeChanged(newMode) }
    }

    fun setConnectionState(state: Int) {
        if (connectionState == state) return
        connectionState = state
        listeners.forEach { it.onBleStateChanged(state) }
    }

    fun setTasks(newTasks: List<Task>) {
        tasks = newTasks.toList()
        listeners.forEach { it.onTasksChanged(tasks) }
    }

    fun addTask(task: Task) {
        tasks = tasks + listOf(task)
        listeners.forEach { it.onTasksChanged(tasks) }
    }

    fun updateTaskStatus(id: String, status: String) {
        tasks = tasks.map {
            if (it.id == id) it.copy(status = status) else it
        }
        listeners.forEach { it.onTasksChanged(tasks) }
    }

    fun setEmotion(newEmotion: Emotion) {
        emotion = newEmotion
        listeners.forEach { it.onEmotionChanged(newEmotion) }
    }

    fun addVoiceMessage(message: VoiceMessage) {
        voiceMessages = (listOf(message) + voiceMessages).take(20)
        listeners.forEach { it.onVoiceMessagesChanged(voiceMessages) }
    }

    fun clear() {
        setMode(Mode.TEST)
        setTasks(emptyList())
        setEmotion(Emotion())
        voiceMessages = emptyList()
        listeners.forEach { it.onVoiceMessagesChanged(voiceMessages) }
    }
}

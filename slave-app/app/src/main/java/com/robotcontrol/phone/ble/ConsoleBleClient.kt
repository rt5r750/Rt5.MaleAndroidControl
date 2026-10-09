package com.robotcontrol.phone.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.ParcelUuid
import com.robotcontrol.phone.data.ApiKeyStore
import org.json.JSONObject
import java.util.LinkedList
import java.util.Queue
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@SuppressLint("MissingPermission")
object ConsoleBleClient {

    private val CCC_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private val ENABLE_NOTIFICATION_VALUE: ByteArray = byteArrayOf(0x01, 0x00)
    private const val DESIRED_MTU = 512

    private const val AUTO_SCAN_INTERVAL_MS = 15000L
    private const val AUTO_SCAN_DURATION_MS = 8000L

    private const val CHUNK_HEADER_SIZE = 2
    private const val CHUNK_FLAG_FIRST: Byte = 0x01
    private const val CHUNK_FLAG_MIDDLE: Byte = 0x02
    private const val CHUNK_FLAG_LAST: Byte = 0x00
    private const val CHUNK_MAGIC: Byte = 0x7E

    var onConnectionStateChanged: ((state: Int) -> Unit)? = null
    var onModeReceived: ((modeOrdinal: Int) -> Unit)? = null
    var onEmotionReceived: ((obedience: Int, shame: Int, pleasure: Int, mechanical: Int) -> Unit)? = null
    var onTasksReceived: ((tasksJson: String) -> Unit)? = null
    var onVoiceReceived: ((voiceJson: String) -> Unit)? = null
    var onVoiceHistoryReceived: ((historyJson: String) -> Unit)? = null
    // 7507(UiLang) 在 v1.10.0 起不再消费：Slave 界面语言由本机检测/手选决定，不跟随控制端

    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var gatt: BluetoothGatt? = null
    private var scanning = false
    private var reconnectAttempts = 0
    private var targetAddress: String? = null
    private var servicesReady = false
    private var mtuNegotiated = false
    private var negotiatedMtu: Int = 23
    private var autoScanRunning = false
    private var pendingConnectAuto = false
    private var userDisconnected = false
    /** True if disconnect was actively initiated (0xFF from server or slave-app user button). */
    private var activeDisconnect = false
    @Volatile private var connectionState: Int = BleConstants.BLE_STATUS_DISCONNECTED
    private var connectTimeoutRunnable: Runnable? = null
    private var scanAutoConnect: Boolean = true

    private var modeCharacteristic: BluetoothGattCharacteristic? = null
    private var emotionCharacteristic: BluetoothGattCharacteristic? = null
    private var tasksCharacteristic: BluetoothGattCharacteristic? = null
    private var voiceCharacteristic: BluetoothGattCharacteristic? = null
    private var heartbeatCharacteristic: BluetoothGattCharacteristic? = null
    private var apikeyCharacteristic: BluetoothGattCharacteristic? = null

    private var bleHandlerThread: HandlerThread? = null
    private var bleHandler: Handler? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val chunkBuffers = ConcurrentHashMap<UUID, ByteArray>()
    private val readBuffers = ConcurrentHashMap<UUID, ByteArray>()

    private data class GattAction(val type: Int, val characteristic: BluetoothGattCharacteristic? = null, val descriptor: BluetoothGattDescriptor? = null, val value: ByteArray? = null, val offset: Int = 0) {
        companion object {
            const val WRITE_DESCRIPTOR = 1
            const val READ_CHAR = 2
            const val SET_NOTIFICATION = 3
            const val READ_LONG_CHAR = 4
            const val WRITE_CHAR = 5
        }
    }

    private val gattQueue: Queue<GattAction> = LinkedList()
    private var gattOperationInProgress = false
    @Volatile private var currentGattAction: GattAction? = null

    private var autoScanRunnable: Runnable? = null
    private var reconnectRunnable: Runnable? = null
    private var heartbeatRunnable: Runnable? = null
    private var heartbeatWriteRunnable: Runnable? = null
    private var heartbeatTimeoutRunnable: Runnable? = null
    private var heartbeatPending: Boolean = false
    @Volatile private var heartbeatFailures = 0
    @Volatile private var heartbeatNotifyReceived: Boolean = false
    @Volatile private var heartbeatSeq: Byte = 1
    private const val HEARTBEAT_INTERVAL_MS = 5000L
    private const val HEARTBEAT_MAX_FAILURES = 2

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            super.onScanResult(callbackType, result)
            result ?: return
            /* API 31+ 下 BluetoothDevice.name / address 需要 BLUETOOTH_CONNECT；
               扫描回调运行在 BLE 扫描线程上，权限缺失时抛 SecurityException 会直接崩进程 —— 整体收口 */
            runCatching {
                val device = result.device
                val scanRecord = result.scanRecord
                val name = scanRecord?.deviceName ?: device.name
                // 兼容 win-app（Windows GATT 外设，名称 RobotControl-Win）：扫描 Filter 已按服务 UUID 7500 过滤，
                // 这里同时接受“名称前缀匹配”或“广告含 7500 服务 UUID”的设备，避免 Windows 端设备被名称检查丢弃。
                val serviceMatch = scanRecord?.serviceUuids?.any { it.uuid == BleConstants.SERVICE_UUID } == true
                val nameMatch = name != null &&
                    (name.startsWith(BleConstants.DEVICE_NAME_PREFIX) || name == BleConstants.CONSOLE_DEVICE_NAME)
                if (nameMatch || serviceMatch) {
                    val address = device.address
                    if (autoScanRunning) {
                        stopAutoScan()
                    } else {
                        stopScanInternal()
                    }
                    mainHandler.post {
                        onDeviceFoundCallback?.invoke(name ?: "", address)
                    }
                    if (scanAutoConnect) {
                        bleHandler?.post {
                            connectInternal(device, autoConnect = false)
                        }
                    }
                }
            }.onFailure {
                android.util.Log.w("BleClient", "onScanResult ignored: ${it.message}")
            }
        }

        override fun onScanFailed(errorCode: Int) {
            super.onScanFailed(errorCode)
            scanning = false
            android.util.Log.e("BleClient", "Scan failed with error: $errorCode")
        }
    }

    private var onDeviceFoundCallback: ((name: String, address: String) -> Unit)? = null

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            super.onConnectionStateChange(gatt, status, newState)
            bleHandler?.post {
                connectTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
                connectTimeoutRunnable = null
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    android.util.Log.e("BleClient", "Connection state change error: status=$status newState=$newState")
                    connectionState = BleConstants.BLE_STATUS_DISCONNECTED
                    if (newState == BluetoothGatt.STATE_DISCONNECTED || newState == BluetoothGatt.STATE_CONNECTING) {
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                        }
                        cleanupConnection()
                        if (!userDisconnected && targetAddress != null) {
                            scheduleReconnect()
                        }
                        if (!activeDisconnect && targetAddress != null) {
                            startAutoScan()
                        }
                    }
                    return@post
                }
                when (newState) {
                    BluetoothGatt.STATE_CONNECTED -> {
                        connectionState = BleConstants.BLE_STATUS_CONNECTED
                        userDisconnected = false
                        activeDisconnect = false
                        reconnectAttempts = 0
                        servicesReady = false
                        mtuNegotiated = false
                        stopAutoScan()
                        reconnectRunnable?.let { bleHandler?.removeCallbacks(it) }
                        reconnectRunnable = null
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_CONNECTED)
                        }
                        try {
                            gatt?.requestMtu(DESIRED_MTU)
                        } catch (e: Exception) {
                            android.util.Log.e("BleClient", "requestMtu failed, proceeding", e)
                            mtuNegotiated = true
                            negotiatedMtu = 23
                            gatt?.discoverServices()
                        }
                    }
                    BluetoothGatt.STATE_DISCONNECTED -> {
                        connectionState = BleConstants.BLE_STATUS_DISCONNECTED
                        servicesReady = false
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                        }
                        cleanupConnection()
                        if (!userDisconnected && targetAddress != null) {
                            scheduleReconnect()
                        }
                        if (!activeDisconnect && targetAddress != null) {
                            startAutoScan()
                        }
                    }
                    BluetoothGatt.STATE_CONNECTING -> {
                        connectionState = BleConstants.BLE_STATUS_CONNECTING
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_CONNECTING)
                        }
                    }
                }
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt?, mtu: Int, status: Int) {
            super.onMtuChanged(gatt, mtu, status)
            bleHandler?.post {
                android.util.Log.d("BleClient", "MTU changed to: $mtu status: $status")
                mtuNegotiated = true
                negotiatedMtu = if (status == BluetoothGatt.GATT_SUCCESS) mtu else 23
                gatt?.discoverServices()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            super.onServicesDiscovered(gatt, status)
            bleHandler?.post {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    android.util.Log.e("BleClient", "Service discovery failed: $status")
                    return@post
                }
                val service = gatt?.getService(BleConstants.SERVICE_UUID)
                if (service == null) {
                    android.util.Log.e("BleClient", "Service not found!")
                    return@post
                }
                modeCharacteristic = service.getCharacteristic(BleConstants.CHAR_MODE_UUID)
                emotionCharacteristic = service.getCharacteristic(BleConstants.CHAR_EMOTION_UUID)
                tasksCharacteristic = service.getCharacteristic(BleConstants.CHAR_TASKS_UUID)
                voiceCharacteristic = service.getCharacteristic(BleConstants.CHAR_VOICE_UUID)
                heartbeatCharacteristic = service.getCharacteristic(BleConstants.CHAR_HEARTBEAT_UUID)
                apikeyCharacteristic = service.getCharacteristic(BleConstants.CHAR_APIKEY_UUID)

                android.util.Log.d("BleClient", "Services discovered, enabling notifications...")

                gattQueue.clear()
                gattOperationInProgress = false
                currentGattAction = null
                chunkBuffers.clear()
                readBuffers.clear()

                modeCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                emotionCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                tasksCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                voiceCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                heartbeatCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                apikeyCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                // 7507(UiLang) 不再订阅：v1.10.0 起界面语言不跟随控制端（特征在服务端保留供旧版客户端使用）

                enqueueGattAction(GattAction(GattAction.READ_CHAR, modeCharacteristic))
                enqueueGattAction(GattAction(GattAction.READ_CHAR, emotionCharacteristic))
                enqueueGattAction(GattAction(GattAction.READ_LONG_CHAR, voiceCharacteristic, offset = 0))

                processNextGattAction()

                bleHandler?.postDelayed({
                    if (isConnected() && tasksCharacteristic != null) {
                        android.util.Log.d("BleClient", "Delayed fallback read tasks characteristic")
                        enqueueGattAction(GattAction(GattAction.READ_CHAR, tasksCharacteristic))
                        processNextGattAction()
                    }
                }, 3000)

                bleHandler?.postDelayed({
                    if (isConnected() && voiceCharacteristic != null) {
                        enqueueGattAction(GattAction(GattAction.READ_LONG_CHAR, voiceCharacteristic, offset = 0))
                        processNextGattAction()
                    }
                }, 2000)

                // Start heartbeat write to detect zombie connections
                startHeartbeat()

                bleHandler?.postDelayed({
                    if (isConnected() && ApiKeyStore.hasApiKey()) {
                        val key = ApiKeyStore.getApiKey()
                        if (!key.isNullOrEmpty()) {
                            writeApiKey(key)
                        }
                    }
                }, 500)
            }
        }

        @Suppress("DEPRECATION")
        override fun onCharacteristicRead(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?,
            status: Int
        ) {
            super.onCharacteristicRead(gatt, characteristic, status)
            characteristic ?: return
            handleCharacteristicRead(gatt, characteristic, characteristic.value, status)
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
            status: Int
        ) {
            handleCharacteristicRead(gatt, characteristic, value, status)
        }

        private fun handleCharacteristicRead(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray?,
            status: Int
        ) {
            gattOperationInProgress = false
            if (status != BluetoothGatt.GATT_SUCCESS) {
                android.util.Log.e("BleClient", "Characteristic read failed: ${characteristic.uuid} status=$status")
                currentGattAction = null
                processNextGattAction()
                return
            }
            if (value == null) {
                android.util.Log.e("BleClient", "Characteristic read returned null value: ${characteristic.uuid}")
                currentGattAction = null
                processNextGattAction()
                return
            }

            val isLongRead = currentGattAction?.type == GattAction.READ_LONG_CHAR
            android.util.Log.d("BleClient", "handleCharacteristicRead: uuid=${characteristic.uuid}, isLongRead=$isLongRead, valueSize=${value.size}, currentActionType=${currentGattAction?.type}")

            if (isLongRead && value.size >= (negotiatedMtu - 3)) {
                val existing = readBuffers[characteristic.uuid]
                if (existing != null) {
                    readBuffers[characteristic.uuid] = existing + value
                } else {
                    readBuffers[characteristic.uuid] = value
                }
                val nextOffset = (existing?.size ?: 0) + value.size
                enqueueGattAction(GattAction(GattAction.READ_LONG_CHAR, characteristic, offset = nextOffset), front = true)
                processNextGattAction()
                return
            } else if (isLongRead) {
                val existing = readBuffers.remove(characteristic.uuid)
                val fullValue = if (existing != null) existing + value else value
                handleCharacteristicValue(characteristic.uuid, fullValue)
                currentGattAction = null
                processNextGattAction()
                return
            }

            currentGattAction = null
            processNextGattAction()
            handleCharacteristicValue(characteristic.uuid, value)
        }

        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?
        ) {
            super.onCharacteristicChanged(gatt, characteristic)
            characteristic ?: return
            val value = characteristic.value ?: return
            handleChunkedValue(characteristic.uuid, value)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            handleChunkedValue(characteristic.uuid, value)
        }

        override fun onDescriptorWrite(
            gatt: BluetoothGatt?,
            descriptor: BluetoothGattDescriptor?,
            status: Int
        ) {
            super.onDescriptorWrite(gatt, descriptor, status)
            gattOperationInProgress = false
            currentGattAction = null
            if (status != BluetoothGatt.GATT_SUCCESS) {
                android.util.Log.e("BleClient", "Descriptor write failed: ${descriptor?.uuid} status=$status")
            } else {
                android.util.Log.d("BleClient", "Descriptor write success: ${descriptor?.characteristic?.uuid}")
            }
            processNextGattAction()
        }

        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            if (characteristic.uuid == BleConstants.CHAR_HEARTBEAT_UUID) {
                heartbeatPending = false
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    heartbeatFailures++
                    android.util.Log.w("BleClient", "Heartbeat write failed, status=$status, failures=$heartbeatFailures")
                }
            }
            // 检查是否是 apikey 写入完成
            if (currentGattAction?.type == GattAction.WRITE_CHAR) {
                gattOperationInProgress = false
                currentGattAction = null
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    android.util.Log.w("BleClient", "API Key write failed, status=$status")
                } else {
                    android.util.Log.d("BleClient", "API Key written successfully")
                }
                processNextGattAction()
            }
        }
    }

    private fun handleChunkedValue(uuid: UUID, value: ByteArray) {
        if (uuid == BleConstants.CHAR_HEARTBEAT_UUID) {
            if (value.isNotEmpty() && value[0] == 0xFF.toByte()) {
                android.util.Log.w("BleClient", "Received heartbeat 0xFF disconnect signal")
                activeDisconnect = true
                userDisconnected = true
                connectionState = BleConstants.BLE_STATUS_DISCONNECTED
                mainHandler.post {
                    onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                }
                cleanupConnection()
            } else {
                heartbeatPending = false
                heartbeatFailures = 0
                heartbeatNotifyReceived = true
                scheduleHeartbeatTimeout()
            }
            return
        }
        if (value.size >= 3 && value[0] == CHUNK_MAGIC) {
            val chunkIndex = value[1].toInt() and 0xFF
            val totalChunks = value[2].toInt() and 0xFF
            val payload = value.copyOfRange(3, value.size)

            android.util.Log.d("BleClient", "Received chunk $chunkIndex/$totalChunks for $uuid, payload=${payload.size}")

            val key = uuid
            var buffer = chunkBuffers[key]
            if (buffer == null || chunkIndex == 0) {
                buffer = ByteArray(0)
            }
            buffer += payload

            if (totalChunks == 1 || chunkIndex == totalChunks - 1) {
                chunkBuffers.remove(key)
                android.util.Log.d("BleClient", "Chunked data complete for $uuid, totalSize=${buffer.size}")
                handleCharacteristicValue(uuid, buffer)
            } else {
                chunkBuffers[key] = buffer
            }
        } else {
            handleCharacteristicValue(uuid, value)
        }
    }

    private fun handleCharacteristicValue(uuid: UUID, value: ByteArray) {
        when (uuid) {
            BleConstants.CHAR_MODE_UUID -> {
                if (value.isNotEmpty()) {
                    val ordinal = value[0].toInt() and 0xFF
                    mainHandler.post { onModeReceived?.invoke(ordinal) }
                }
            }
            BleConstants.CHAR_EMOTION_UUID -> {
                if (value.size >= 4) {
                    val obedience = value[0].toInt() and 0xFF
                    val shame = value[1].toInt() and 0xFF
                    val pleasure = value[2].toInt() and 0xFF
                    val mechanical = value[3].toInt() and 0xFF
                    mainHandler.post {
                        onEmotionReceived?.invoke(obedience, shame, pleasure, mechanical)
                    }
                }
            }
            BleConstants.CHAR_TASKS_UUID -> {
                val tasksJson = String(value, Charsets.UTF_8)
                mainHandler.post {
                    onTasksReceived?.invoke(tasksJson)
                }
            }
            BleConstants.CHAR_VOICE_UUID -> {
                dispatchVoiceData(String(value, Charsets.UTF_8))
            }
            // 7507(UiLang) 已不订阅，不会走到这里（服务端特征保留供旧版客户端）
        }
    }

    private fun enqueueGattAction(action: GattAction, front: Boolean = false) {
        if (front && gattQueue is LinkedList) {
            (gattQueue as LinkedList).addFirst(action)
        } else {
            gattQueue.add(action)
        }
    }

    private fun processNextGattAction() {
        val g = gatt ?: return
        if (gattOperationInProgress) return
        val action = gattQueue.poll() ?: return
        currentGattAction = action
        gattOperationInProgress = true

        when (action.type) {
            GattAction.SET_NOTIFICATION -> {
                val char = action.characteristic
                if (char == null) {
                    gattOperationInProgress = false
                    processNextGattAction()
                    return
                }
                g.setCharacteristicNotification(char, true)
                val descriptor = char.getDescriptor(CCC_DESCRIPTOR_UUID)
                if (descriptor != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        g.writeDescriptor(descriptor, ENABLE_NOTIFICATION_VALUE)
                    } else {
                        @Suppress("DEPRECATION")
                        descriptor.value = ENABLE_NOTIFICATION_VALUE
                        @Suppress("DEPRECATION")
                        g.writeDescriptor(descriptor)
                    }
                } else {
                    android.util.Log.w("BleClient", "No CCC descriptor for ${char.uuid}")
                    gattOperationInProgress = false
                    processNextGattAction()
                }
            }
            GattAction.READ_CHAR -> {
                val char = action.characteristic
                if (char == null) {
                    gattOperationInProgress = false
                    processNextGattAction()
                    return
                }
                readBuffers.remove(char.uuid)
                g.readCharacteristic(char)
            }
            GattAction.READ_LONG_CHAR -> {
                val char = action.characteristic
                if (char == null) {
                    gattOperationInProgress = false
                    processNextGattAction()
                    return
                }
                if (action.offset > 0) {
                    try {
                        val method = BluetoothGatt::class.java.getMethod(
                            "readCharacteristic",
                            BluetoothGattCharacteristic::class.java,
                            Int::class.javaPrimitiveType
                        )
                        method.invoke(g, char, action.offset)
                    } catch (e: Exception) {
                        android.util.Log.w("BleClient", "Long read not supported, reading remaining via onCharacteristicChanged", e)
                        gattOperationInProgress = false
                        val existing = readBuffers.remove(char.uuid)
                        if (existing != null) {
                            handleCharacteristicValue(char.uuid, existing)
                        }
                        processNextGattAction()
                    }
                } else {
                    readBuffers.remove(char.uuid)
                    g.readCharacteristic(char)
                }
            }
            GattAction.WRITE_CHAR -> {
                val char = action.characteristic
                val data = action.value
                if (char == null || data == null) {
                    gattOperationInProgress = false
                    processNextGattAction()
                    return
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    g.writeCharacteristic(char, data, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
                } else {
                    @Suppress("DEPRECATION")
                    char.value = data
                    @Suppress("DEPRECATION")
                    char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                    @Suppress("DEPRECATION")
                    g.writeCharacteristic(char)
                }
            }
        }
    }

    private fun dispatchVoiceData(voiceJson: String) {
        val trimmed = voiceJson.trim()
        when {
            trimmed.startsWith("[") -> mainHandler.post { onVoiceHistoryReceived?.invoke(trimmed) }
            trimmed.startsWith("{") -> mainHandler.post { onVoiceReceived?.invoke(trimmed) }
            trimmed.isNotEmpty() -> {
                mainHandler.post {
                    try {
                        val obj = JSONObject()
                        obj.put("timestamp", System.currentTimeMillis())
                        obj.put("content", trimmed)
                        onVoiceReceived?.invoke(obj.toString())
                    } catch (_: Exception) {}
                }
            }
        }
    }

    fun startAutoScan() {
        bleHandler?.post {
            if (isConnected() || autoScanRunning) return@post
            autoScanRunning = true
            val cycle = object : Runnable {
                override fun run() {
                    if (!autoScanRunning || isConnected()) return
                    startScanAndConnect(durationMs = AUTO_SCAN_DURATION_MS)
                    autoScanRunnable = this
                    bleHandler?.postDelayed(this, AUTO_SCAN_INTERVAL_MS)
                }
            }
            autoScanRunnable = cycle
            bleHandler?.post(cycle)
        }
    }

    fun stopAutoScan() {
        bleHandler?.post {
            autoScanRunning = false
            autoScanRunnable?.let { bleHandler?.removeCallbacks(it) }
            autoScanRunnable = null
            stopScanInternal()
        }
    }

    private fun scheduleReconnect() {
        val address = targetAddress ?: return
        reconnectRunnable?.let { bleHandler?.removeCallbacks(it) }

        if (reconnectAttempts < BleConstants.RECONNECT_MAX_RETRIES) {
            reconnectAttempts++
            val delay = BleConstants.RECONNECT_INTERVAL_MS * reconnectAttempts
            android.util.Log.d("BleClient", "Scheduling reconnect attempt $reconnectAttempts in ${delay}ms (autoConnect=true)")
            val runnable = Runnable {
                if (isConnected() || userDisconnected) return@Runnable
                connectInternal(address, autoConnect = true)
            }
            reconnectRunnable = runnable
            bleHandler?.postDelayed(runnable, delay)
        } else {
            android.util.Log.d("BleClient", "Max direct reconnect attempts reached, relying on autoScan")
        }
    }

    private fun cleanupConnection() {
        stopHeartbeat()
        connectionState = BleConstants.BLE_STATUS_DISCONNECTED
        connectTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
        connectTimeoutRunnable = null
        gattQueue.clear()
        gattOperationInProgress = false
        chunkBuffers.clear()
        readBuffers.clear()
        modeCharacteristic = null
        emotionCharacteristic = null
        tasksCharacteristic = null
        voiceCharacteristic = null
        heartbeatCharacteristic = null
        apikeyCharacteristic = null
        try {
            gatt?.close()
        } catch (_: Exception) {}
        gatt = null
    }

    private fun startHeartbeat() {
        stopHeartbeat()
        heartbeatFailures = 0
        val cycle = object : Runnable {
            override fun run() {
                if (!isConnected() || gatt == null) return
                val char = heartbeatCharacteristic
                val g = gatt
                if (char != null && g != null) {
                    if (heartbeatNotifyReceived) {
                        heartbeatFailures = 0
                        heartbeatNotifyReceived = false
                    } else {
                        heartbeatFailures++
                        android.util.Log.w("BleClient", "Heartbeat notify not received since last cycle, failures=$heartbeatFailures")
                    }
                    if (heartbeatPending) {
                        heartbeatFailures++
                        android.util.Log.w("BleClient", "Heartbeat write pending from previous cycle, failures=$heartbeatFailures")
                    }
                    heartbeatPending = true
                    val data = byteArrayOf(heartbeatSeq)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        g.writeCharacteristic(char, data, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
                    } else {
                        @Suppress("DEPRECATION")
                        char.value = data
                        @Suppress("DEPRECATION")
                        g.writeCharacteristic(char)
                    }
                    heartbeatSeq = ((heartbeatSeq.toInt() + 1) and 0xFF).toByte()
                    if (heartbeatSeq == 0.toByte()) heartbeatSeq = 1
                }
                if (heartbeatFailures >= HEARTBEAT_MAX_FAILURES) {
                    android.util.Log.e("BleClient", "Heartbeat failed $HEARTBEAT_MAX_FAILURES times, forcing disconnect")
                    bleHandler?.post {
                        forceDisconnectForRecovery()
                    }
                    return
                }
                heartbeatWriteRunnable = this
                bleHandler?.postDelayed(this, HEARTBEAT_INTERVAL_MS)
            }
        }
        heartbeatWriteRunnable = cycle
        bleHandler?.postDelayed(cycle, HEARTBEAT_INTERVAL_MS)
    }

    private fun stopHeartbeat() {
        heartbeatWriteRunnable?.let { bleHandler?.removeCallbacks(it) }
        heartbeatWriteRunnable = null
        heartbeatTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
        heartbeatTimeoutRunnable = null
        heartbeatRunnable?.let { bleHandler?.removeCallbacks(it) }
        heartbeatRunnable = null
        heartbeatPending = false
        heartbeatNotifyReceived = false
        heartbeatSeq = 1
        heartbeatFailures = 0
    }

    private fun connectInternal(address: String, autoConnect: Boolean = false) {
        val adapter = bluetoothAdapter ?: return
        runCatching {
            val device = adapter.getRemoteDevice(address)
            connectInternal(device, autoConnect)
        }.onFailure {
            android.util.Log.e("BleClient", "connectInternal(address) failed", it)
        }
    }

    private fun scheduleHeartbeatTimeout() {
        heartbeatTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
        val timeoutRunnable = Runnable {
            if (!isConnected()) return@Runnable
            android.util.Log.w("BleClient", "No server heartbeat within timeout, forcing recovery")
            forceDisconnectForRecovery()
        }
        heartbeatTimeoutRunnable = timeoutRunnable
        bleHandler?.postDelayed(timeoutRunnable, HEARTBEAT_INTERVAL_MS * 3)
    }

    private fun forceDisconnectForRecovery() {
        connectionState = BleConstants.BLE_STATUS_DISCONNECTED
        mainHandler.post {
            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
        }
        cleanupConnection()
        if (!userDisconnected && targetAddress != null) {
            scheduleReconnect()
            startAutoScan()
        }
    }

    private fun connectInternal(device: BluetoothDevice, autoConnect: Boolean = false) {
        /* device.address 在 API 31+ 需要 BLUETOOTH_CONNECT，权限缺失时抛 SecurityException；
           本函数运行在 BLE 线程上，抛出即崩进程（连接弹窗点击设备闪退的候选根因）—— 先安全取址 */
        val address = runCatching { device.address }.getOrElse {
            android.util.Log.w("BleClient", "device.address unavailable, abort connect: ${it.message}")
            connectionState = BleConstants.BLE_STATUS_DISCONNECTED
            mainHandler.post {
                onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
            }
            return
        }
        targetAddress = address
        val context = appContext ?: return
        cleanupConnection()
        connectionState = BleConstants.BLE_STATUS_CONNECTING
        if (!autoConnect) {
            reconnectAttempts = 0
        }
        pendingConnectAuto = autoConnect
        bleHandler?.postDelayed({
            try {
                gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    device.connectGatt(context, autoConnect, gattCallback, BluetoothDevice.TRANSPORT_LE)
                } else {
                    device.connectGatt(context, autoConnect, gattCallback)
                }
                android.util.Log.d("BleClient", "connectGatt called autoConnect=$autoConnect to $address")
                connectTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
                val timeoutRunnable = Runnable {
                    if (connectionState == BleConstants.BLE_STATUS_CONNECTING && !isConnected()) {
                        android.util.Log.w("BleClient", "Connection timeout to $address")
                        connectionState = BleConstants.BLE_STATUS_DISCONNECTED
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                        }
                        cleanupConnection()
                        if (!userDisconnected && targetAddress != null) {
                            scheduleReconnect()
                            startAutoScan()
                        }
                    }
                    connectTimeoutRunnable = null
                }
                connectTimeoutRunnable = timeoutRunnable
                bleHandler?.postDelayed(timeoutRunnable, BleConstants.CONNECTION_TIMEOUT_MS)
            } catch (e: Exception) {
                android.util.Log.e("BleClient", "connectGatt failed", e)
                connectionState = BleConstants.BLE_STATUS_DISCONNECTED
            }
        }, 300)
    }

    private var appContext: Context? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
        if (bleHandlerThread == null) {
            bleHandlerThread = HandlerThread("BleClientThread").apply {
                start()
                bleHandler = Handler(looper)
            }
        }

        bleHandler?.post {
            if (bluetoothManager == null) {
                val manager = runCatching {
                    context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
                }.getOrNull() ?: return@post
                bluetoothManager = manager
                runCatching { bluetoothAdapter = manager.adapter }
            }
            /* 扫描器单独缓存与重试：其 getter 受 BLUETOOTH_SCAN 约束（API 31+），权限缺失会抛异常；
               失败时不写字段，补授权限后下一次 initialize() 即可拿到（若与 manager 同批提交，
               中途失败会留下残态让 null 守卫永久跳过初始化） */
            if (bluetoothLeScanner == null) {
                if (bluetoothAdapter == null) {
                    bluetoothAdapter = runCatching { bluetoothManager?.adapter }.getOrNull()
                }
                runCatching { bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner }
                    .onFailure { android.util.Log.w("BleClient", "bluetoothLeScanner unavailable: ${it.message}") }
            }
        }
    }

    fun startScanAndConnect(
        onDeviceFound: ((name: String, address: String) -> Unit)? = null,
        durationMs: Long = BleConstants.SCAN_DURATION_MS,
        autoConnect: Boolean = true
    ) {
        onDeviceFoundCallback = onDeviceFound
        scanAutoConnect = autoConnect
        bleHandler?.post {
            if (scanning) {
                stopScanInternal()
            }
            val scanner = bluetoothLeScanner ?: return@post

            val filters = listOf(
                ScanFilter.Builder()
                    .setServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
                    .build()
            )
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build()

            scanning = true
            runCatching {
                scanner.startScan(filters, settings, scanCallback)
            }.onFailure {
                android.util.Log.e("BleClient", "startScan failed", it)
                scanning = false
            }

            bleHandler?.postDelayed({
                if (!autoScanRunning) {
                    stopScanInternal()
                } else {
                    stopScanInternal()
                }
            }, durationMs)
        }
    }

    fun connect(context: Context, address: String, autoConnect: Boolean = false) {
        initialize(context)
        bleHandler?.post {
            userDisconnected = false
            activeDisconnect = false
            disconnectInternal(clearTargetAddress = false)
            targetAddress = address
            connectInternal(address, autoConnect)
        }
    }

    fun disconnect() {
        bleHandler?.post {
            userDisconnected = true
            activeDisconnect = true
            // 先发送 0xFF 通知 master-app 这是手动断开
            val g = gatt
            val service = g?.getService(BleConstants.SERVICE_UUID)
            val char = service?.getCharacteristic(BleConstants.CHAR_HEARTBEAT_UUID)
            if (g != null && char != null) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        g.writeCharacteristic(
                            char,
                            byteArrayOf(0xFF.toByte()),
                            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        char.value = byteArrayOf(0xFF.toByte())
                        @Suppress("DEPRECATION")
                        char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                        @Suppress("DEPRECATION")
                        g.writeCharacteristic(char)
                    }
                } catch (_: Exception) {
                    android.util.Log.w("BleClient", "Failed to send 0xFF disconnect signal")
                }
                // 300ms 后执行断开（给 write 足够时间）
                bleHandler?.postDelayed({
                    disconnectInternal(clearTargetAddress = true)
                    mainHandler.post {
                        onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                    }
                }, 300)
            } else {
                disconnectInternal(clearTargetAddress = true)
                mainHandler.post {
                    onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                }
            }
        }
    }

    private fun disconnectInternal(clearTargetAddress: Boolean) {
        connectionState = BleConstants.BLE_STATUS_DISCONNECTED
        connectTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
        connectTimeoutRunnable = null
        reconnectAttempts = BleConstants.RECONNECT_MAX_RETRIES + 1
        stopHeartbeat()
        stopAutoScan()
        reconnectRunnable?.let { bleHandler?.removeCallbacks(it) }
        reconnectRunnable = null
        autoScanRunning = false
        stopScanInternal()
        gattQueue.clear()
        gattOperationInProgress = false
        currentGattAction = null
        chunkBuffers.clear()
        readBuffers.clear()
        val g = gatt
        if (g != null) {
            try {
                g.disconnect()
            } catch (_: Exception) {}
            gatt = null
            bleHandler?.postDelayed({
                try { g.close() } catch (_: Exception) {}
            }, 200)
        }
        modeCharacteristic = null
        emotionCharacteristic = null
        tasksCharacteristic = null
        voiceCharacteristic = null
        heartbeatCharacteristic = null
        apikeyCharacteristic = null
        if (clearTargetAddress) {
            targetAddress = null
        }
    }

    fun isConnected(): Boolean = connectionState == BleConstants.BLE_STATUS_CONNECTED

    fun writeApiKey(key: String) {
        bleHandler?.post {
            val char = apikeyCharacteristic
            val g = gatt
            if (char != null && g != null && isConnected()) {
                val data = key.toByteArray(Charsets.UTF_8)
                enqueueGattAction(GattAction(GattAction.WRITE_CHAR, char, value = data))
                processNextGattAction()
            }
        }
    }

    /**
     * 反向模式推送：向控制端写入 Mode(7501) 的 1 字节 ordinal（仅 0..3）。
     * 控制端收到后切换到对应模式，并回推模式/语音（手机端据此提示「推送成功」）。
     * @return 是否已受理（未连接或参数非法返回 false）
     */
    fun writeMode(ordinal: Int): Boolean {
        if (ordinal !in 0..3) return false
        val handler = bleHandler ?: return false
        if (!isConnected()) return false
        handler.post {
            val char = modeCharacteristic
            val g = gatt
            if (char != null && g != null && isConnected()) {
                val data = byteArrayOf(ordinal.toByte())
                enqueueGattAction(GattAction(GattAction.WRITE_CHAR, char, value = data))
                processNextGattAction()
            }
        }
        return true
    }

    /** Returns true if the last disconnect was actively initiated (0xFF signal or manual button). */
    fun isActiveDisconnect(): Boolean = activeDisconnect

    fun getConnectedDeviceAddress(): String? {
        return if (isConnected()) targetAddress else null
    }

    fun stopScan() {
        bleHandler?.post {
            stopScanInternal()
        }
    }

    private fun stopScanInternal() {
        if (scanning) {
            runCatching {
                bluetoothLeScanner?.stopScan(scanCallback)
            }
            scanning = false
        }
    }

    private var autoScanPausedForDialog = false

    fun pauseAutoScanForDialog() {
        bleHandler?.post {
            if (autoScanRunning && !isConnected()) {
                autoScanPausedForDialog = true
                stopAutoScan()
            }
        }
    }

    fun resumeAutoScanAfterDialog() {
        bleHandler?.post {
            scanAutoConnect = true
            if (autoScanPausedForDialog && !isConnected() && targetAddress != null) {
                autoScanPausedForDialog = false
                startAutoScan()
            } else {
                autoScanPausedForDialog = false
            }
        }
    }

    fun stopDialogScan() {
        bleHandler?.post {
            stopScanInternal()
            scanAutoConnect = true
        }
    }
}

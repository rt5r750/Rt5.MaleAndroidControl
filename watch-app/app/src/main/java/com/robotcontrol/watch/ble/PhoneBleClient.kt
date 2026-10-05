package com.robotcontrol.watch.ble

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
import java.util.LinkedList
import java.util.Queue
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/* 与 phone-app ConsoleBleClient 对齐的 GATT 客户端：
   · GATT 操作串行队列（CCCD 订阅×N、初读排队，杜绝并发 writeDescriptor 互相踩踏——
     旧版连发 4 次 CCCD 只等第 1 次，Emotion/Tasks/Voice 通知订阅失败、连接后数据不动）
   · requestMtu(512) 协商 + 0x7E 分片重组（旧版无分片，长 JSON 任务/语音每片被当完整包解析失败）
   · connectGatt 指定 TRANSPORT_LE
   · 扫描回调不再因 device.name 为 null 丢设备：ScanFilter 已按服务 UUID 7500 过滤，
     名称以 scanRecord 优先（android-app 控制台的名字在 scan response，首轮可能取不到缓存名） */
@SuppressLint("MissingPermission")
object PhoneBleClient {

    private val CCC_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private val ENABLE_NOTIFICATION_VALUE: ByteArray = byteArrayOf(0x01, 0x00)
    private const val DESIRED_MTU = 512
    private const val CHUNK_MAGIC: Byte = 0x7E
    private const val CHUNK_HEADER_SIZE = 3

    var onConnectionStateChanged: ((state: Int) -> Unit)? = null
    var onModeReceived: ((Int) -> Unit)? = null
    var onEmotionReceived: ((Int, Int, Int, Int) -> Unit)? = null
    var onTasksReceived: ((String) -> Unit)? = null
    var onVoiceReceived: ((String) -> Unit)? = null

    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var gatt: BluetoothGatt? = null
    private var scanning = false
    private var reconnectAttempts = 0
    private var targetAddress: String? = null

    private var modeCharacteristic: BluetoothGattCharacteristic? = null
    private var emotionCharacteristic: BluetoothGattCharacteristic? = null
    private var tasksCharacteristic: BluetoothGattCharacteristic? = null
    private var voiceCharacteristic: BluetoothGattCharacteristic? = null

    private var bleHandlerThread: HandlerThread? = null
    private var bleHandler: Handler? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val chunkBuffers = ConcurrentHashMap<UUID, ByteArray>()

    private var onDeviceFoundCallback: ((name: String, address: String) -> Unit)? = null

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            super.onScanResult(callbackType, result)
            result ?: return
            val device = result.device
            // ScanFilter 按服务 UUID 7500 过滤，命中即可连接；名称仅用于展示（scanRecord 优先，缓存名兜底）
            val name = result.scanRecord?.deviceName ?: device.name ?: BleConstants.CONSOLE_DEVICE_NAME
            mainHandler.post {
                onDeviceFoundCallback?.invoke(name, device.address)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            super.onScanFailed(errorCode)
            scanning = false
        }
    }

    /* ===== GATT 串行操作队列 ===== */
    private data class GattAction(val type: Int, val characteristic: BluetoothGattCharacteristic? = null) {
        companion object {
            const val WRITE_DESCRIPTOR = 1
            const val READ_CHAR = 2
            const val SET_NOTIFICATION = 3
        }
    }

    private val gattQueue: Queue<GattAction> = LinkedList()
    @Volatile private var gattOperationInProgress = false

    private fun enqueueGattAction(action: GattAction) {
        gattQueue.add(action)
    }

    private fun processNextGattAction() {
        val g = gatt ?: return
        if (gattOperationInProgress) return
        val action = gattQueue.poll() ?: return
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
                    android.util.Log.w("PhoneBleClient", "No CCC descriptor for ${char.uuid}")
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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    val ok = g.readCharacteristic(char)
                    if (!ok) {
                        gattOperationInProgress = false
                        processNextGattAction()
                    }
                } else {
                    @Suppress("DEPRECATION")
                    val ok = g.readCharacteristic(char)
                    if (!ok) {
                        gattOperationInProgress = false
                        processNextGattAction()
                    }
                }
            }
            GattAction.WRITE_DESCRIPTOR -> {
                // 预留
                gattOperationInProgress = false
                processNextGattAction()
            }
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            super.onConnectionStateChange(gatt, status, newState)
            bleHandler?.post {
                when (newState) {
                    BluetoothGatt.STATE_CONNECTED -> {
                        reconnectAttempts = 0
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_CONNECTED)
                        }
                        // MTU 先协商再发现服务：长 JSON 需要 >23 的通知载荷
                        gatt?.requestMtu(DESIRED_MTU)
                    }
                    BluetoothGatt.STATE_DISCONNECTED -> {
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_DISCONNECTED)
                        }
                        cleanupConnection()
                        scheduleReconnect()
                    }
                    BluetoothGatt.STATE_CONNECTING -> {
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(BleConstants.BLE_STATUS_CONNECTING)
                        }
                    }
                }
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt?, mtu: Int, status: Int) {
            super.onMtuChanged(gatt, mtu, status)
            gatt?.discoverServices()
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            super.onServicesDiscovered(gatt, status)
            bleHandler?.post {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    return@post
                }
                val service = gatt?.getService(BleConstants.SERVICE_UUID) ?: return@post
                modeCharacteristic = service.getCharacteristic(BleConstants.CHAR_MODE_UUID)
                emotionCharacteristic = service.getCharacteristic(BleConstants.CHAR_EMOTION_UUID)
                tasksCharacteristic = service.getCharacteristic(BleConstants.CHAR_TASKS_UUID)
                voiceCharacteristic = service.getCharacteristic(BleConstants.CHAR_VOICE_UUID)

                gattQueue.clear()
                gattOperationInProgress = false
                chunkBuffers.clear()

                modeCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                emotionCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                tasksCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                voiceCharacteristic?.let { enqueueGattAction(GattAction(GattAction.SET_NOTIFICATION, it)) }
                // Initial reads to get current state（与订阅同队列串行）
                modeCharacteristic?.let { enqueueGattAction(GattAction(GattAction.READ_CHAR, it)) }
                emotionCharacteristic?.let { enqueueGattAction(GattAction(GattAction.READ_CHAR, it)) }
                tasksCharacteristic?.let { enqueueGattAction(GattAction(GattAction.READ_CHAR, it)) }
                voiceCharacteristic?.let { enqueueGattAction(GattAction(GattAction.READ_CHAR, it)) }

                processNextGattAction()
            }
        }

        override fun onDescriptorWrite(gatt: BluetoothGatt?, descriptor: BluetoothGattDescriptor?, status: Int) {
            super.onDescriptorWrite(gatt, descriptor, status)
            bleHandler?.post {
                gattOperationInProgress = false
                processNextGattAction()
            }
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?,
            status: Int
        ) {
            super.onCharacteristicRead(gatt, characteristic, status)
            bleHandler?.post {
                gattOperationInProgress = false
                if (status == BluetoothGatt.GATT_SUCCESS && characteristic != null) {
                    @Suppress("DEPRECATION")
                    dispatchValue(characteristic.uuid, characteristic.value ?: ByteArray(0))
                }
                processNextGattAction()
            }
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
            status: Int
        ) {
            bleHandler?.post {
                gattOperationInProgress = false
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    dispatchValue(characteristic.uuid, value)
                }
                processNextGattAction()
            }
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            dispatchOnBleThread(characteristic.uuid, value)
        }

        @Deprecated("Deprecated in Java")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?
        ) {
            super.onCharacteristicChanged(gatt, characteristic)
            characteristic ?: return
            dispatchOnBleThread(characteristic.uuid, characteristic.value ?: ByteArray(0))
        }

        private fun dispatchOnBleThread(uuid: UUID, value: ByteArray) {
            bleHandler?.post { dispatchValue(uuid, value) }
        }
    }

    private fun dispatchValue(uuid: UUID, value: ByteArray) {
        if (value.isEmpty()) return
        when (uuid) {
            BleConstants.CHAR_MODE_UUID -> {
                val ordinal = value[0].toInt() and 0xFF
                mainHandler.post { onModeReceived?.invoke(ordinal) }
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
            BleConstants.CHAR_TASKS_UUID -> handleChunked(uuid, value) { json ->
                mainHandler.post { onTasksReceived?.invoke(json) }
            }
            BleConstants.CHAR_VOICE_UUID -> handleChunked(uuid, value) { json ->
                mainHandler.post { onVoiceReceived?.invoke(json) }
            }
        }
    }

    /* 0x7E 分片重组：3 字节包头(magic, chunkIndex, totalChunks)，收齐后回调整包；
       非 0x7E 开头视为完整单包直传 */
    private fun handleChunked(uuid: UUID, value: ByteArray, onReady: (String) -> Unit) {
        if (value.size >= CHUNK_HEADER_SIZE && value[0] == CHUNK_MAGIC) {
            val chunkIndex = value[1].toInt() and 0xFF
            val totalChunks = value[2].toInt() and 0xFF
            val payload = value.copyOfRange(CHUNK_HEADER_SIZE, value.size)
            val key = uuid
            var buffer = chunkBuffers[key]
            if (buffer == null || chunkIndex == 0) {
                buffer = ByteArray(0)
            }
            buffer += payload
            if (chunkIndex >= totalChunks - 1) {
                chunkBuffers.remove(key)
                onReady(String(buffer, Charsets.UTF_8))
            } else {
                chunkBuffers[key] = buffer
            }
        } else {
            onReady(String(value, Charsets.UTF_8))
        }
    }

    private fun scheduleReconnect() {
        val address = targetAddress ?: return
        if (reconnectAttempts < BleConstants.RECONNECT_MAX_RETRIES) {
            reconnectAttempts++
            bleHandler?.postDelayed({
                connectInternal(address)
            }, BleConstants.RECONNECT_INTERVAL_MS)
        }
    }

    private fun cleanupConnection() {
        modeCharacteristic = null
        emotionCharacteristic = null
        tasksCharacteristic = null
        voiceCharacteristic = null
        gattQueue.clear()
        gattOperationInProgress = false
        chunkBuffers.clear()
        gatt?.close()
        gatt = null
    }

    private fun connectInternal(address: String) {
        val adapter = bluetoothAdapter ?: return
        runCatching {
            val device = adapter.getRemoteDevice(address)
            connectInternal(device)
        }
    }

    private fun connectInternal(device: BluetoothDevice) {
        targetAddress = device.address
        val context = appContext ?: return
        runCatching {
            gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        }.onFailure {
            android.util.Log.e("PhoneBleClient", "connectGatt failed", it)
        }
    }

    private var appContext: Context? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
        if (bleHandlerThread == null) {
            bleHandlerThread = HandlerThread("PhoneBleClientThread").apply {
                start()
                bleHandler = Handler(looper)
            }
        }

        bleHandler?.post {
            if (bluetoothManager == null) {
                bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
                bluetoothAdapter = bluetoothManager?.adapter
                bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
            }
        }
    }

    fun startScan(onDeviceFound: ((String, String) -> Unit)? = null) {
        onDeviceFoundCallback = onDeviceFound
        bleHandler?.post {
            if (scanning) {
                return@post
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
            runCatching { scanner.startScan(filters, settings, scanCallback) }

            bleHandler?.postDelayed({
                stopScanInternal()
            }, BleConstants.SCAN_DURATION_MS)
        }
    }

    fun connect(context: Context, address: String) {
        initialize(context)
        bleHandler?.post {
            disconnectInternal()
            targetAddress = address
            connectInternal(address)
        }
    }

    fun disconnect() {
        bleHandler?.post {
            disconnectInternal()
        }
    }

    private fun disconnectInternal() {
        reconnectAttempts = BleConstants.RECONNECT_MAX_RETRIES
        stopScanInternal()
        targetAddress = null
        // 先 disconnect 走 STATE_DISCONNECTED 回调清理；无连接时直接清理
        val current = gatt
        if (current != null) {
            try {
                current.disconnect()
            } catch (_: SecurityException) {
                cleanupConnection()
            }
        } else {
            cleanupConnection()
        }
    }

    fun isConnected(): Boolean {
        return gatt != null
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
}

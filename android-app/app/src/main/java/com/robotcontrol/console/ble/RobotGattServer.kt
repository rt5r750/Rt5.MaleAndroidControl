package com.robotcontrol.console.ble

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.ParcelUuid
import java.util.LinkedList
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.ConcurrentHashMap

@SuppressLint("MissingPermission")
object RobotGattServer {

    private val CCC_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private const val CHUNK_MAGIC: Byte = 0x7E
    private const val CHUNK_HEADER_SIZE = 3
    private const val NOTIFICATION_OVERHEAD = 3
    private const val DEFAULT_MTU = 23
    private const val MAX_CHUNK_PAYLOAD = DEFAULT_MTU - NOTIFICATION_OVERHEAD - CHUNK_HEADER_SIZE
    private const val SERVICE_ADD_TIMEOUT_MS = 5000L

    private var bluetoothManager: BluetoothManager? = null
    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var gattService: BluetoothGattService? = null
    private var appContext: Context? = null

    private var modeCharacteristic: BluetoothGattCharacteristic? = null
    private var emotionCharacteristic: BluetoothGattCharacteristic? = null
    private var tasksCharacteristic: BluetoothGattCharacteristic? = null
    private var voiceCharacteristic: BluetoothGattCharacteristic? = null
    private var heartbeatCharacteristic: BluetoothGattCharacteristic? = null
    private var apikeyCharacteristic: BluetoothGattCharacteristic? = null
    private var uiLangCharacteristic: BluetoothGattCharacteristic? = null

    private val characteristicValues = ConcurrentHashMap<UUID, ByteArray>()
    private val connectedDevices = ConcurrentHashMap<String, BluetoothDevice>()
    private val deviceMtu = ConcurrentHashMap<String, Int>()
    private val pendingNotifications = ConcurrentHashMap<String, ConcurrentLinkedQueue<Pair<BluetoothGattCharacteristic, ByteArray>>>()

    private var bleHandlerThread: HandlerThread? = null
    private var bleHandler: Handler? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var heartbeatRunnable: Runnable? = null

    private var isServerRunning = false
    private var isAdvertising = false
    private var serviceAdded = false
    @Volatile private var manualDisconnectReceived: Boolean = false
    private var serviceAddScheduled = false

    var onConnectionStateChanged: ((connected: Boolean, deviceAddress: String?) -> Unit)? = null
    var onApiKeyReceived: ((apiKey: String) -> Unit)? = null

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            super.onStartSuccess(settingsInEffect)
            isAdvertising = true
        }

        override fun onStartFailure(errorCode: Int) {
            super.onStartFailure(errorCode)
            isAdvertising = false
            bleHandler?.postDelayed({
                if (isServerRunning && !isAdvertising) {
                    startAdvertising()
                }
            }, 2000)
        }
    }

    private val gattServerCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
            super.onConnectionStateChange(device, status, newState)
            device ?: return
            val address = device.address

            bleHandler?.post {
                when (newState) {
                    BluetoothGatt.STATE_CONNECTED -> {
                        connectedDevices[address] = device
                        deviceMtu[address] = DEFAULT_MTU
                        startServerHeartbeat()
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(true, address)
                        }
                    }
                    BluetoothGatt.STATE_DISCONNECTED -> {
                        connectedDevices.remove(address)
                        deviceMtu.remove(address)
                        pendingNotifications.remove(address)?.clear()
                        if (connectedDevices.isEmpty()) {
                            stopServerHeartbeat()
                        }
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(false, null)
                        }
                        if (isServerRunning) {
                            stopAdvertising()
                            startAdvertising()
                        }
                    }
                }
            }
        }

        override fun onServiceAdded(status: Int, service: BluetoothGattService?) {
            super.onServiceAdded(status, service)
            serviceAddScheduled = false
            if (status == BluetoothGatt.GATT_SUCCESS) {
                serviceAdded = true
                bleHandler?.post { startAdvertising() }
            } else {
                bleHandler?.postDelayed({
                    if (isServerRunning && !serviceAdded) {
                        gattServer?.clearServices()
                        setupGattService()
                        gattServer?.addService(gattService)
                        scheduleServiceAddTimeout()
                    }
                }, 1000)
            }
        }

        override fun onMtuChanged(device: BluetoothDevice?, mtu: Int) {
            super.onMtuChanged(device, mtu)
            device ?: return
            deviceMtu[device.address] = mtu
            android.util.Log.d("GattServer", "MTU changed for ${device.address}: $mtu")
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice?,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic?
        ) {
            super.onCharacteristicReadRequest(device, requestId, offset, characteristic)
            characteristic ?: return
            device ?: return

            bleHandler?.post {
                val value = characteristicValues[characteristic.uuid] ?: ByteArray(0)
                val mtu = deviceMtu[device.address] ?: DEFAULT_MTU
                val maxReadSize = mtu - 1

                val responseValue = if (offset < value.size) {
                    val end = minOf(offset + maxReadSize, value.size)
                    value.copyOfRange(offset, end)
                } else {
                    ByteArray(0)
                }
                gattServer?.sendResponse(
                    device,
                    requestId,
                    BluetoothGatt.GATT_SUCCESS,
                    offset,
                    responseValue
                )
            }
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice?,
            requestId: Int,
            descriptor: BluetoothGattDescriptor?,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            super.onDescriptorWriteRequest(device, requestId, descriptor, preparedWrite, responseNeeded, offset, value)
            descriptor ?: return
            device ?: return

            bleHandler?.post {
                if (descriptor.uuid == CCC_DESCRIPTOR_UUID) {
                    if (value != null && value.size >= 2) {
                        if (value[0] == 0x01.toByte() && value[1] == 0x00.toByte()) {
                            bleHandler?.postDelayed({
                                sendCurrentValueFor(descriptor.characteristic, device)
                            }, 100)
                        }
                    }
                }
                if (responseNeeded) {
                    gattServer?.sendResponse(
                        device,
                        requestId,
                        BluetoothGatt.GATT_SUCCESS,
                        offset,
                        value
                    )
                }
            }
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice?,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic?,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value)
            characteristic ?: return
            device ?: return

            bleHandler?.post {
                if (characteristic.uuid == BleConstants.CHAR_HEARTBEAT_UUID) {
                    if (value != null && value.isNotEmpty() && value[0] == 0xFF.toByte()) {
                        manualDisconnectReceived = true
                    }
                    gattServer?.sendResponse(
                        device,
                        requestId,
                        BluetoothGatt.GATT_SUCCESS,
                        offset,
                        value
                    )
                    if (value != null) {
                        characteristicValues[BleConstants.CHAR_HEARTBEAT_UUID] = value
                        notifyCharacteristicChangedToDevice(heartbeatCharacteristic, value, device)
                    }
                } else if (characteristic.uuid == BleConstants.CHAR_APIKEY_UUID) {
                    gattServer?.sendResponse(
                        device,
                        requestId,
                        BluetoothGatt.GATT_SUCCESS,
                        offset,
                        value
                    )
                    if (value != null && value.isNotEmpty()) {
                        characteristicValues[BleConstants.CHAR_APIKEY_UUID] = value
                        val apiKey = String(value, Charsets.UTF_8)
                        notifyCharacteristicChangedToDevice(apikeyCharacteristic, value, device)
                        mainHandler.post {
                            onApiKeyReceived?.invoke(apiKey)
                        }
                    }
                } else {
                    gattServer?.sendResponse(
                        device,
                        requestId,
                        BluetoothGatt.GATT_SUCCESS,
                        offset,
                        value
                    )
                }
            }
        }
    }

    fun initialize(context: Context) {
        appContext = context.applicationContext
        if (bleHandlerThread == null) {
            bleHandlerThread = HandlerThread("BleServerThread").apply {
                start()
                bleHandler = Handler(looper)
            }
        }

        bleHandler?.post {
            if (bluetoothManager == null) {
                bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            }
        }
    }

    fun startServer(context: Context) {
        initialize(context)
        bleHandler?.post {
            if (isServerRunning) {
                ensureAdvertising()
                return@post
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    android.util.Log.w("RobotGattServer", "BLUETOOTH_CONNECT permission not granted, cannot start GATT server")
                    return@post
                }
            }

            val bluetoothAdapter = bluetoothManager?.adapter ?: return@post
            advertiser = bluetoothAdapter.bluetoothLeAdvertiser

            setupGattService()

            serviceAdded = false
            gattServer = bluetoothManager?.openGattServer(context, gattServerCallback)
            gattServer?.addService(gattService)
            isServerRunning = true
            scheduleServiceAddTimeout()
        }
    }

    private fun scheduleServiceAddTimeout() {
        serviceAddScheduled = true
        bleHandler?.postDelayed({
            if (isServerRunning && !serviceAdded && serviceAddScheduled) {
                android.util.Log.w("GattServer", "Service add timeout, retrying...")
                serviceAddScheduled = false
                gattServer?.clearServices()
                setupGattService()
                gattServer?.addService(gattService)
                scheduleServiceAddTimeout()
            }
        }, SERVICE_ADD_TIMEOUT_MS)
    }

    fun ensureAdvertising() {
        bleHandler?.post {
            val ctx = appContext ?: return@post
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ctx.checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
                    android.util.Log.w("RobotGattServer", "BLUETOOTH_ADVERTISE permission not granted, cannot start advertising")
                    return@post
                }
            }
            if (isServerRunning && !isAdvertising) {
                startAdvertising()
            }
        }
    }

    private fun setupGattService() {
        gattService = BluetoothGattService(
            BleConstants.SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY
        )

        modeCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_MODE_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        emotionCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_EMOTION_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        tasksCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_TASKS_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        voiceCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_VOICE_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        heartbeatCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_HEARTBEAT_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ or BluetoothGattCharacteristic.PERMISSION_WRITE
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        apikeyCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_APIKEY_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ or BluetoothGattCharacteristic.PERMISSION_WRITE
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        uiLangCharacteristic = BluetoothGattCharacteristic(
            BleConstants.CHAR_UI_LANG_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        ).apply {
            addDescriptor(createCccDescriptor())
        }

        gattService?.addCharacteristic(modeCharacteristic)
        gattService?.addCharacteristic(emotionCharacteristic)
        gattService?.addCharacteristic(tasksCharacteristic)
        gattService?.addCharacteristic(voiceCharacteristic)
        gattService?.addCharacteristic(heartbeatCharacteristic)
        gattService?.addCharacteristic(apikeyCharacteristic)
        gattService?.addCharacteristic(uiLangCharacteristic)

        characteristicValues[BleConstants.CHAR_MODE_UUID] = byteArrayOf(0xFF.toByte())
        characteristicValues[BleConstants.CHAR_EMOTION_UUID] = byteArrayOf(100.toByte(), 0.toByte(), 100.toByte(), 50.toByte())
        characteristicValues[BleConstants.CHAR_TASKS_UUID] = ByteArray(0)
        characteristicValues[BleConstants.CHAR_VOICE_UUID] = ByteArray(0)
        characteristicValues[BleConstants.CHAR_HEARTBEAT_UUID] = byteArrayOf(0x00.toByte())
        characteristicValues[BleConstants.CHAR_APIKEY_UUID] = ByteArray(0)
        characteristicValues[BleConstants.CHAR_UI_LANG_UUID] = byteArrayOf(uiLangToByte(lastUiLang))
    }

    private fun createCccDescriptor(): BluetoothGattDescriptor {
        return BluetoothGattDescriptor(
            CCC_DESCRIPTOR_UUID,
            BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
        )
    }

    private fun startAdvertising() {
        val advSettings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setConnectable(true)
            .setTimeout(0)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .build()

        val advData = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
            .setIncludeDeviceName(false)
            .build()

        val scanResponse = AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .build()

        runCatching {
            val bluetoothAdapter = bluetoothManager?.adapter ?: return
            bluetoothAdapter.setName(BleConstants.CONSOLE_DEVICE_NAME)
            if (isAdvertising) {
                advertiser?.stopAdvertising(advertiseCallback)
                isAdvertising = false
            }
            advertiser?.startAdvertising(advSettings, advData, scanResponse, advertiseCallback)
        }.onFailure {
            android.util.Log.e("GattServer", "startAdvertising failed", it)
            isAdvertising = false
        }
    }

    private fun stopAdvertising() {
        runCatching {
            advertiser?.stopAdvertising(advertiseCallback)
        }
        isAdvertising = false
    }

    private fun startServerHeartbeat() {
        if (heartbeatRunnable != null) return
        heartbeatRunnable = object : Runnable {
            override fun run() {
                if (connectedDevices.isNotEmpty()) {
                    val value = byteArrayOf(0x01.toByte())
                    characteristicValues[BleConstants.CHAR_HEARTBEAT_UUID] = value
                    notifyCharacteristicChanged(heartbeatCharacteristic, value)
                }
                bleHandler?.postDelayed(this, 5000)
            }
        }
        bleHandler?.post(heartbeatRunnable!!)
    }

    private fun stopServerHeartbeat() {
        heartbeatRunnable?.let {
            bleHandler?.removeCallbacks(it)
        }
        heartbeatRunnable = null
    }

    /**
     * 断开所有已连接客户端但不销毁 GATT Server。
     * 用于 btUnbond 场景：告知客户端断开后重启广播，Server 保持运行。
     */
    fun setManualDisconnectReceived() {
        manualDisconnectReceived = true
    }

    fun isManualDisconnect(): Boolean = manualDisconnectReceived

    fun consumeManualDisconnect(): Boolean {
        val result = manualDisconnectReceived
        manualDisconnectReceived = false
        return result
    }

    fun disconnectAllClients() {
        bleHandler?.post {
            val devices = connectedDevices.values.toList()
            for (device in devices) {
                try {
                    gattServer?.cancelConnection(device)
                } catch (_: SecurityException) {}
            }
            connectedDevices.clear()
            deviceMtu.clear()
            stopServerHeartbeat()
        }
    }

    fun stopServer() {
        bleHandler?.post {
            if (!isServerRunning) {
                return@post
            }

            serviceAddScheduled = false
            stopServerHeartbeat()
            stopAdvertising()

            connectedDevices.values.forEach { device ->
                gattServer?.cancelConnection(device)
            }
            connectedDevices.clear()
            deviceMtu.clear()

            gattServer?.close()
            gattServer = null
            gattService = null
            modeCharacteristic = null
            emotionCharacteristic = null
            tasksCharacteristic = null
            voiceCharacteristic = null
            heartbeatCharacteristic = null
            apikeyCharacteristic = null
            uiLangCharacteristic = null
            advertiser = null
            characteristicValues.clear()

            isServerRunning = false
            serviceAdded = false
        }
    }

    fun sendMode(modeOrdinal: Int) {
        bleHandler?.post {
            val value = byteArrayOf(modeOrdinal.toByte())
            characteristicValues[BleConstants.CHAR_MODE_UUID] = value
            notifyCharacteristicChanged(modeCharacteristic, value)
        }
    }

    fun sendEmotion(obedience: Int, shame: Int, pleasure: Int, mechanical: Int) {
        bleHandler?.post {
            val value = byteArrayOf(
                obedience.toByte(),
                shame.toByte(),
                pleasure.toByte(),
                mechanical.toByte()
            )
            characteristicValues[BleConstants.CHAR_EMOTION_UUID] = value
            notifyCharacteristicChanged(emotionCharacteristic, value)
        }
    }

    fun sendTasks(tasksJson: String) {
        bleHandler?.post {
            val value = tasksJson.toByteArray(Charsets.UTF_8)
            characteristicValues[BleConstants.CHAR_TASKS_UUID] = value
            notifyCharacteristicChanged(tasksCharacteristic, value)
        }
    }

    fun sendVoice(voiceJson: String) {
        bleHandler?.post {
            val value = voiceJson.toByteArray(Charsets.UTF_8)
            characteristicValues[BleConstants.CHAR_VOICE_UUID] = value
            notifyCharacteristicChanged(voiceCharacteristic, value)
        }
    }

    /* UiLang(7507)：0=zh、1=en、255=未设置。语言变化即推；
       订阅 CCCD 后由 sendCurrentValueFor 自动补发当前值 */
    @Volatile var lastUiLang: String = "zh"

    fun uiLangToByte(lang: String): Byte = when (lang) {
        "en" -> 0x01
        "zh" -> 0x00
        else -> 0xFF.toByte()
    }

    fun sendUiLang(lang: String) {
        lastUiLang = if (lang == "en") "en" else "zh"
        bleHandler?.post {
            val value = byteArrayOf(uiLangToByte(lang))
            characteristicValues[BleConstants.CHAR_UI_LANG_UUID] = value
            notifyCharacteristicChanged(uiLangCharacteristic, value)
        }
    }

    fun sendDisconnectNotification() {
        bleHandler?.post {
            val value = byteArrayOf(0xFF.toByte())
            characteristicValues[BleConstants.CHAR_HEARTBEAT_UUID] = value
            notifyCharacteristicChanged(heartbeatCharacteristic, value)
            stopServerHeartbeat()
        }
    }

    private fun sendCurrentValueFor(characteristic: BluetoothGattCharacteristic?, device: BluetoothDevice) {
        characteristic ?: return
        val value = characteristicValues[characteristic.uuid] ?: return
        if (value.isEmpty()) return
        bleHandler?.post {
            notifyCharacteristicChangedToDevice(characteristic, value, device)
        }
    }

    private fun notifyCharacteristicChanged(characteristic: BluetoothGattCharacteristic?, value: ByteArray) {
        characteristic ?: return
        connectedDevices.values.forEach { device ->
            notifyCharacteristicChangedToDevice(characteristic, value, device)
        }
    }

    private fun notifyCharacteristicChangedToDevice(characteristic: BluetoothGattCharacteristic?, value: ByteArray, device: BluetoothDevice) {
        characteristic ?: return
        val mtu = deviceMtu[device.address] ?: DEFAULT_MTU
        val maxPayload = mtu - NOTIFICATION_OVERHEAD

        if (value.size <= maxPayload) {
            queueNotification(device, characteristic, value)
            return
        }

        val chunkPayloadSize = maxPayload - CHUNK_HEADER_SIZE
        val totalChunks = (value.size + chunkPayloadSize - 1) / chunkPayloadSize

        android.util.Log.d("GattServer", "Sending chunked data: uuid=${characteristic.uuid}, totalSize=${value.size}, mtu=$mtu, chunkPayloadSize=$chunkPayloadSize, totalChunks=$totalChunks")

        if (totalChunks > 255) {
            android.util.Log.e("GattServer", "ERROR: totalChunks=$totalChunks exceeds 255 byte limit! Data will be corrupted.")
        }

        for (i in 0 until totalChunks) {
            val start = i * chunkPayloadSize
            val end = minOf(start + chunkPayloadSize, value.size)
            val payload = value.copyOfRange(start, end)
            val chunk = ByteArray(CHUNK_HEADER_SIZE + payload.size)
            chunk[0] = CHUNK_MAGIC
            chunk[1] = (i and 0xFF).toByte()
            chunk[2] = (totalChunks and 0xFF).toByte()
            System.arraycopy(payload, 0, chunk, CHUNK_HEADER_SIZE, payload.size)

            queueNotification(device, characteristic, chunk)
        }
    }

    private fun queueNotification(device: BluetoothDevice, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
        val queue = pendingNotifications.getOrPut(device.address) { ConcurrentLinkedQueue() }
        queue.add(Pair(characteristic, value))
        if (queue.size == 1) sendNextNotification(device)
    }

    private fun sendNextNotification(device: BluetoothDevice) {
        val address = device.address
        val queue = pendingNotifications[address] ?: return
        val item = queue.peek() ?: run {
            pendingNotifications.remove(address)
            return
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val result = gattServer?.notifyCharacteristicChanged(device, item.first, false, item.second)
                if (result == BluetoothGatt.GATT_SUCCESS) {
                    bleHandler?.postDelayed({ dequeueAndContinue(device) }, 20)
                } else {
                    bleHandler?.postDelayed({ dequeueAndContinue(device) }, 50)
                }
            } else {
                @Suppress("DEPRECATION")
                item.first.setValue(item.second)
                @Suppress("DEPRECATION")
                gattServer?.notifyCharacteristicChanged(device, item.first, false)
                bleHandler?.postDelayed({ dequeueAndContinue(device) }, 20)
            }
        } catch (e: Exception) {
            android.util.Log.e("GattServer", "notify failed for ${item.first.uuid}, size=${item.second.size}", e)
            dequeueAndContinue(device)
        }
    }

    private fun dequeueAndContinue(device: BluetoothDevice) {
        val address = device.address
        val queue = pendingNotifications[address] ?: return
        queue.poll()
        if (connectedDevices.containsKey(address)) {
            sendNextNotification(device)
        } else {
            queue.clear()
            pendingNotifications.remove(address)
        }
    }

    fun isRunning(): Boolean = isServerRunning

    fun isConnected(): Boolean = connectedDevices.isNotEmpty()

    fun isAdvertising(): Boolean = isAdvertising

    /**
     * 验证 connectedDevices 映射的实际有效性。
     * 使用 BluetoothGattServer.getConnectedDevices() 同步实际连接设备列表，
     * 移除陈旧条目，确保 isConnected() 仅在实际有设备连接时返回 true。
     * 在 Activity 重建时调用，防止残留的上次连接条目导致"异常连接成功"。
     */
    fun validateConnectedDevices() {
        bleHandler?.post {
            try {
                val gs = gattServer ?: run {
                    // GATT Server 尚未创建，清除所有陈旧条目
                    connectedDevices.clear()
                    deviceMtu.clear()
                    return@post
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (appContext?.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        return@post
                    }
                }
                val actualDevices = gs.connectedDevices
                val actualAddresses = actualDevices.map { it.address }.toSet()
                // 移除已不在实际连接列表中的陈旧条目
                connectedDevices.keys.removeAll { it !in actualAddresses }
                deviceMtu.keys.removeAll { it !in actualAddresses }
                // 添加实际已连接但不在映射中的设备
                actualDevices.forEach { device ->
                    if (!connectedDevices.containsKey(device.address)) {
                        connectedDevices[device.address] = device
                        deviceMtu[device.address] = DEFAULT_MTU
                    }
                }
                if (connectedDevices.isNotEmpty()) {
                    startServerHeartbeat()
                }
            } catch (e: SecurityException) {
                android.util.Log.w("RobotGattServer", "Permission denied validating connections", e)
            }
        }
    }
}

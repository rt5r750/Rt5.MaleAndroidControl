package com.robotcontrol.phone.ble

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
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.ParcelUuid
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@SuppressLint("MissingPermission")
object WatchGattServer {

    private val CCC_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    private var bluetoothManager: BluetoothManager? = null
    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var gattService: BluetoothGattService? = null

    private var modeCharacteristic: BluetoothGattCharacteristic? = null
    private var emotionCharacteristic: BluetoothGattCharacteristic? = null
    private var tasksCharacteristic: BluetoothGattCharacteristic? = null
    private var voiceCharacteristic: BluetoothGattCharacteristic? = null

    private val characteristicValues = ConcurrentHashMap<UUID, ByteArray>()
    private val connectedDevices = ConcurrentHashMap<String, BluetoothDevice>()

    private var bleHandlerThread: HandlerThread? = null
    private var bleHandler: Handler? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private var isServerRunning = false
    private var isAdvertising = false

    var onConnectionStateChanged: ((connected: Boolean, deviceAddress: String?) -> Unit)? = null

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            super.onStartSuccess(settingsInEffect)
            isAdvertising = true
        }

        override fun onStartFailure(errorCode: Int) {
            super.onStartFailure(errorCode)
            isAdvertising = false
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
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(true, address)
                        }
                    }
                    BluetoothGatt.STATE_DISCONNECTED -> {
                        connectedDevices.remove(address)
                        mainHandler.post {
                            onConnectionStateChanged?.invoke(false, null)
                        }
                    }
                }
            }
        }

        override fun onServiceAdded(status: Int, service: BluetoothGattService?) {
            super.onServiceAdded(status, service)
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
                val responseValue = if (offset < value.size) {
                    value.copyOfRange(offset, value.size)
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
    }

    fun initialize(context: Context) {
        if (bleHandlerThread == null) {
            bleHandlerThread = HandlerThread("BlePhoneServerThread").apply {
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
                return@post
            }

            val bluetoothAdapter = bluetoothManager?.adapter ?: return@post
            advertiser = bluetoothAdapter.bluetoothLeAdvertiser

            setupGattService()

            gattServer = bluetoothManager?.openGattServer(context, gattServerCallback)
            gattServer?.addService(gattService)

            startAdvertising()
            isServerRunning = true
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

        gattService?.addCharacteristic(modeCharacteristic)
        gattService?.addCharacteristic(emotionCharacteristic)
        gattService?.addCharacteristic(tasksCharacteristic)
        gattService?.addCharacteristic(voiceCharacteristic)

        characteristicValues[BleConstants.CHAR_MODE_UUID] = ByteArray(1) { 0 }
        characteristicValues[BleConstants.CHAR_EMOTION_UUID] = ByteArray(4) { 0 }
        characteristicValues[BleConstants.CHAR_TASKS_UUID] = ByteArray(0)
        characteristicValues[BleConstants.CHAR_VOICE_UUID] = ByteArray(0)
    }

    private fun createCccDescriptor(): BluetoothGattDescriptor {
        return BluetoothGattDescriptor(
            CCC_DESCRIPTOR_UUID,
            BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
        )
    }

    private fun startAdvertising() {
        val advSettings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setConnectable(true)
            .setTimeout(0)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .build()

        val advData = AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .addServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
            .build()

        runCatching {
            val bluetoothAdapter = bluetoothManager?.adapter ?: return
            bluetoothAdapter.setName(BleConstants.PHONE_DEVICE_NAME)
            advertiser?.startAdvertising(advSettings, advData, advertiseCallback)
        }
    }

    private fun stopAdvertising() {
        runCatching {
            advertiser?.stopAdvertising(advertiseCallback)
        }
        isAdvertising = false
    }

    fun stopServer() {
        bleHandler?.post {
            if (!isServerRunning) {
                return@post
            }

            stopAdvertising()

            connectedDevices.values.forEach { device ->
                gattServer?.cancelConnection(device)
            }
            connectedDevices.clear()

            gattServer?.close()
            gattServer = null
            gattService = null
            modeCharacteristic = null
            emotionCharacteristic = null
            tasksCharacteristic = null
            voiceCharacteristic = null
            advertiser = null
            characteristicValues.clear()

            isServerRunning = false
        }
    }

    fun updateMode(modeOrdinal: Int) {
        bleHandler?.post {
            val value = byteArrayOf(modeOrdinal.toByte())
            characteristicValues[BleConstants.CHAR_MODE_UUID] = value
            notifyCharacteristicChanged(modeCharacteristic, value)
        }
    }

    fun updateEmotion(obedience: Int, shame: Int, pleasure: Int, mechanical: Int) {
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

    fun updateTasks(tasksJson: String) {
        bleHandler?.post {
            val value = tasksJson.toByteArray(Charsets.UTF_8)
            characteristicValues[BleConstants.CHAR_TASKS_UUID] = value
            notifyCharacteristicChanged(tasksCharacteristic, value)
        }
    }

    fun updateVoice(voiceJson: String) {
        bleHandler?.post {
            val value = voiceJson.toByteArray(Charsets.UTF_8)
            characteristicValues[BleConstants.CHAR_VOICE_UUID] = value
            notifyCharacteristicChanged(voiceCharacteristic, value)
        }
    }

    private fun notifyCharacteristicChanged(characteristic: BluetoothGattCharacteristic?, value: ByteArray) {
        characteristic ?: return
        connectedDevices.values.forEach { device ->
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    gattServer?.notifyCharacteristicChanged(device, characteristic, false, value)
                } else {
                    @Suppress("DEPRECATION")
                    characteristic.value = value
                    @Suppress("DEPRECATION")
                    gattServer?.notifyCharacteristicChanged(device, characteristic, false)
                }
            }
        }
    }

    fun isRunning(): Boolean = isServerRunning

    fun isConnected(): Boolean = connectedDevices.isNotEmpty()
}

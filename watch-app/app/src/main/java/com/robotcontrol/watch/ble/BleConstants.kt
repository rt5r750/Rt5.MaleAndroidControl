package com.robotcontrol.watch.ble

import java.util.UUID

@Suppress("unused")
object BleConstants {
    val SERVICE_UUID: UUID = UUID.fromString("00007500-0000-1000-8000-00805f9b34fb")
    val CHAR_MODE_UUID: UUID = UUID.fromString("00007501-0000-1000-8000-00805f9b34fb")
    val CHAR_EMOTION_UUID: UUID = UUID.fromString("00007502-0000-1000-8000-00805f9b34fb")
    val CHAR_TASKS_UUID: UUID = UUID.fromString("00007503-0000-1000-8000-00805f9b34fb")
    val CHAR_VOICE_UUID: UUID = UUID.fromString("00007504-0000-1000-8000-00805f9b34fb")

    const val DEVICE_NAME_PREFIX = "RobotControl-"
    const val CONSOLE_DEVICE_NAME = "RobotControl-Console"
    const val PHONE_DEVICE_NAME = "RobotControl-Phone"

    const val CONNECTION_TIMEOUT_MS = 10000L
    const val RECONNECT_MAX_RETRIES = 3
    const val RECONNECT_INTERVAL_MS = 3000L
    const val SCAN_DURATION_MS = 10000L

    const val BLE_STATUS_UNBONDED = 0
    const val BLE_STATUS_CONNECTED = 1
    const val BLE_STATUS_DISCONNECTED = 2
    const val BLE_STATUS_CONNECTING = 3
}

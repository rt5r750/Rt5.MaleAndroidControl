package com.robotcontrol.watch.ble

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

@Suppress("unused")
object BlePermissionHelper {

    const val REQUEST_ENABLE_BT = 1001
    const val REQUEST_BT_PERMISSIONS = 1002

    val bluetoothAdapter: BluetoothAdapter? by lazy {
        BluetoothAdapter.getDefaultAdapter()
    }

    fun getRequiredPermissions(): Array<String> {
        /* 手表端纯 BLE 客户端（扫描+连接+订阅），不广播：
           请求 manifest 未声明的 BLUETOOTH_ADVERTISE 会被系统直接拒绝（不弹窗），
           hasAllPermissions 恒 false → BLE 永远不启动（历史版本连不上控制台的根因） */
        return arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        )
    }

    fun hasAllPermissions(context: Context): Boolean {
        return getMissingPermissions(context).isEmpty()
    }

    fun getMissingPermissions(context: Context): List<String> {
        return getRequiredPermissions().filter {
            context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
    }

    fun requestPermissions(activity: Activity) {
        val missing = getMissingPermissions(activity)
        if (missing.isNotEmpty()) {
            activity.requestPermissions(missing.toTypedArray(), REQUEST_BT_PERMISSIONS)
        }
    }

    @SuppressLint("MissingPermission")
    fun isBluetoothEnabled(context: Context): Boolean {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        return bluetoothManager.adapter?.isEnabled == true
    }

    fun getEnableBluetoothIntent(): Intent {
        return Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
    }

    @SuppressLint("MissingPermission")
    fun enableBluetooth(activity: Activity) {
        if (!isBluetoothEnabled(activity)) {
            activity.startActivityForResult(getEnableBluetoothIntent(), REQUEST_ENABLE_BT)
        }
    }
}

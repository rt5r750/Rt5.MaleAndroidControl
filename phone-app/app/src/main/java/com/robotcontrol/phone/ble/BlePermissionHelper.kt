package com.robotcontrol.phone.ble

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

@Suppress("unused")
object BlePermissionHelper {

    fun getBluetoothAdapter(context: Context): BluetoothAdapter? {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return bluetoothManager?.adapter
    }

    fun getRequiredPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE
            )
        } else {
            arrayOf(
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        }
    }

    fun hasAllPermissions(context: Context): Boolean {
        return getMissingPermissions(context).isEmpty()
    }

    fun getMissingPermissions(context: Context): List<String> {
        return getRequiredPermissions().filter {
            context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
    }

    @SuppressLint("MissingPermission")
    fun isBluetoothEnabled(context: Context): Boolean {
        return getBluetoothAdapter(context)?.isEnabled == true
    }

    fun getEnableBluetoothIntent(): Intent {
        return Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
    }
}

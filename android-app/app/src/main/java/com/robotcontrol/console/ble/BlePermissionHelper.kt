package com.robotcontrol.console.ble

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import android.util.Log

@Suppress("unused")
object BlePermissionHelper {

    private const val TAG = "BlePermissionHelper"
    /** Randomized MAC returned by Android 12+ when real MAC is unavailable */
    private const val RANDOMIZED_MAC = "02:00:00:00:00:00"

    fun getBluetoothAdapter(context: Context): BluetoothAdapter? {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return bluetoothManager?.adapter
    }

    /**
     * Get the real local Bluetooth MAC address using multiple fallback strategies.
     * Priority: 1) BluetoothAdapter.getAddress()  2) Settings.Secure  3) System properties
     * Returns empty string if all methods fail.
     */
    @SuppressLint("MissingPermission", "HardwareIds")
    fun getLocalMacAddress(context: Context): String {
        // Strategy 1: BluetoothAdapter.getAddress() (Android 13+ with BLUETOOTH_CONNECT)
        try {
            val adapter = getBluetoothAdapter(context)
            val addr = adapter?.address
            if (!addr.isNullOrEmpty() && addr != RANDOMIZED_MAC) {
                Log.d(TAG, "MAC from BluetoothAdapter: $addr")
                return addr
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "BluetoothAdapter.getAddress() SecurityException: ${e.message}")
        }

        // Strategy 2: Settings.Secure "bluetooth_address" (legacy, works on some devices)
        try {
            val settingsAddr = Settings.Secure.getString(context.contentResolver, "bluetooth_address")
            if (!settingsAddr.isNullOrEmpty() && settingsAddr != RANDOMIZED_MAC) {
                // Validate MAC format: XX:XX:XX:XX:XX:XX
                if (settingsAddr.matches(Regex("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"))) {
                    Log.d(TAG, "MAC from Settings.Secure: $settingsAddr")
                    return settingsAddr
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Settings.Secure bluetooth_address failed: ${e.message}")
        }

        // Strategy 3: System properties via reflection
        try {
            val systemProperties = Class.forName("android.os.SystemProperties")
            val getMethod = systemProperties.getMethod("get", String::class.java, String::class.java)
            val propNames = arrayOf(
                "ro.boot.btmacaddr",
                "persist.service.bdroid.bdaddr",
                "persist.bt.mac",
                "ro.bt.bdaddr_path"
            )
            for (propName in propNames) {
                val value = getMethod.invoke(null, propName, "") as String
                if (value.isNotEmpty() && value.matches(Regex("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"))) {
                    Log.d(TAG, "MAC from SystemProperties($propName): $value")
                    return value
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "SystemProperties MAC lookup failed: ${e.message}")
        }

        Log.w(TAG, "All MAC retrieval methods failed")
        return ""
    }

    fun getRequiredPermissions(): Array<String> {
        return arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
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

    @SuppressLint("MissingPermission")
    fun isBluetoothEnabled(context: Context): Boolean {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        return bluetoothManager.adapter?.isEnabled == true
    }

    fun getEnableBluetoothIntent(): Intent {
        return Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
    }
}

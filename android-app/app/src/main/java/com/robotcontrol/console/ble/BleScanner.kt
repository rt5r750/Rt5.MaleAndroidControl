package com.robotcontrol.console.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.ParcelUuid
import java.util.concurrent.CopyOnWriteArrayList

@SuppressLint("MissingPermission")
object BleScanner {

    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var scanning = false
    private val scanResults = CopyOnWriteArrayList<ScanResultInfo>()

    private var bleHandlerThread: HandlerThread? = null
    private var bleHandler: Handler? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private var scanTimeoutRunnable: Runnable? = null
    private var onDeviceFoundListener: ((name: String, address: String) -> Unit)? = null

    data class ScanResultInfo(val name: String, val address: String)

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            super.onScanResult(callbackType, result)
            result ?: return
            /* API 31+ 下 BluetoothDevice.name / address 需要 BLUETOOTH_CONNECT，
               扫描回调运行在 BLE 扫描线程上，权限缺失时抛 SecurityException 会直接崩进程 —— 整体收口 */
            runCatching {
                val device = result.device
                val name = result.scanRecord?.deviceName ?: device.name ?: return
                if (name.startsWith(BleConstants.DEVICE_NAME_PREFIX)) {
                    val addr = device.address
                    if (scanResults.none { it.address == addr }) {
                        scanResults.add(ScanResultInfo(name, addr))
                        mainHandler.post {
                            onDeviceFoundListener?.invoke(name, addr)
                        }
                    }
                }
            }.onFailure {
                android.util.Log.w("BleScanner", "onScanResult ignored: ${it.message}")
            }
        }

        override fun onScanFailed(errorCode: Int) {
            super.onScanFailed(errorCode)
            scanning = false
            android.util.Log.e("BleScanner", "Scan failed with error: $errorCode")
        }
    }

    fun initialize(context: Context) {
        if (bleHandlerThread == null) {
            bleHandlerThread = HandlerThread("BleScannerThread").apply {
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
            /* 扫描器单独缓存与重试：bluetoothLeScanner 取用受 BLUETOOTH_SCAN 约束（API 31+），
               权限缺失时会抛异常；失败不写字段，补授权限后下次 initialize() 可恢复 */
            if (bluetoothLeScanner == null) {
                if (bluetoothAdapter == null) {
                    bluetoothAdapter = runCatching { bluetoothManager?.adapter }.getOrNull()
                }
                runCatching { bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner }
                    .onFailure { android.util.Log.w("BleScanner", "bluetoothLeScanner unavailable: ${it.message}") }
            }
        }
    }

    fun startScan(context: Context, durationMs: Long = BleConstants.SCAN_DURATION_MS, onFound: ((name: String, address: String) -> Unit)? = null) {
        initialize(context)
        onDeviceFoundListener = onFound
        bleHandler?.post {
            if (scanning) {
                return@post
            }
            val scanner = bluetoothLeScanner ?: return@post
            scanResults.clear()

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
                android.util.Log.e("BleScanner", "startScan failed", it)
                scanning = false
            }

            scanTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
            val timeout = Runnable { stopScan() }
            scanTimeoutRunnable = timeout
            bleHandler?.postDelayed(timeout, durationMs)
        }
    }

    fun stopScan() {
        bleHandler?.post {
            scanTimeoutRunnable?.let { bleHandler?.removeCallbacks(it) }
            scanTimeoutRunnable = null
            if (scanning) {
                runCatching {
                    bluetoothLeScanner?.stopScan(scanCallback)
                }
                scanning = false
            }
        }
    }

    fun getScanResultsJson(): String {
        val list = scanResults.map { obj ->
            "{\"name\":\"${obj.name}\",\"address\":\"${obj.address}\"}"
        }
        return "[${list.joinToString(",")}]"
    }

    fun isScanning(): Boolean = scanning
}

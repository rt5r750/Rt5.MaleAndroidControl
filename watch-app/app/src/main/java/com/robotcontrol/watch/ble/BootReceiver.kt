package com.robotcontrol.watch.ble

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/* 开机自启：已绑定控制台时拉起保活前台服务，手表重启后自动恢复 BLE 连接。
   connectedDevice 类型在 Android 15 上仍允许从 BOOT_COMPLETED 启动。 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!BondStore.hasConsoleBond()) return
        BleKeepAliveService.start(context)
    }
}

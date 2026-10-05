package com.robotcontrol.phone

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class RobotPhoneApplication : Application() {
    companion object {
        const val CHANNEL_ID = "voice_broadcast_channel"
    }

    override fun onCreate() {
        super.onCreate()
        PhoneI18n.init(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                PhoneI18n.t("语音播报"),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = PhoneI18n.t("机器人语音播报通知")
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
}

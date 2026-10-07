package com.robotcontrol.phone.data

import android.content.Context
import android.content.SharedPreferences

object ApiKeyStore {

    private const val PREFS_NAME = "mimo_tts_prefs"
    private const val PREF_KEY_MIMO_TOKEN = "mimo_tts_token"
    private const val PREF_KEY_ASR_CLOUD = "asr_cloud_enabled"
    private const val PREF_KEY_ASR_ACTIVE = "phone_asr_active"

    private var prefs: SharedPreferences? = null

    fun initialize(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun getPrefs(): SharedPreferences {
        return prefs ?: throw IllegalStateException("ApiKeyStore not initialized, call initialize(context) first")
    }

    /** API Key 清洗：去除首尾空白与成对引号（粘贴/同步时可能带入 "sk-..."） */
    private fun normalizeApiKey(key: String?): String {
        var k = (key ?: "").trim()
        if (k.length >= 2 &&
            ((k.startsWith("\"") && k.endsWith("\"")) ||
                (k.startsWith("'") && k.endsWith("'")))) {
            k = k.substring(1, k.length - 1).trim()
        }
        return k
    }

    fun saveApiKey(key: String) {
        getPrefs().edit().putString(PREF_KEY_MIMO_TOKEN, normalizeApiKey(key)).apply()
    }

    fun getApiKey(): String? {
        val prefs = getPrefs()
        val current = normalizeApiKey(prefs.getString(PREF_KEY_MIMO_TOKEN, null))
        if (current.isNotEmpty()) return current
        // 向下兼容：迁移旧版本存储键（mimo_api_key）下的值
        return normalizeApiKey(prefs.getString("mimo_api_key", null))
    }

    fun hasApiKey(): Boolean {
        return !getApiKey().isNullOrEmpty()
    }

    fun clearApiKey() {
        val prefs = getPrefs()
        prefs.edit().remove(PREF_KEY_MIMO_TOKEN).apply()
        prefs.edit().remove("mimo_api_key").apply()
    }

    /** 语音识别是否允许调用云端（MiMo ASR）；关闭后仅使用本地离线识别。默认开启。 */
    fun isAsrCloudEnabled(): Boolean = getPrefs().getBoolean(PREF_KEY_ASR_CLOUD, true)

    fun setAsrCloudEnabled(enabled: Boolean) {
        getPrefs().edit().putBoolean(PREF_KEY_ASR_CLOUD, enabled).apply()
    }

    /** 语音识别开关是否常态保持（无权限/未连接时仍记录用户意图） */
    fun isAsrActive(): Boolean = getPrefs().getBoolean(PREF_KEY_ASR_ACTIVE, false)

    fun setAsrActive(active: Boolean) {
        getPrefs().edit().putBoolean(PREF_KEY_ASR_ACTIVE, active).apply()
    }
}

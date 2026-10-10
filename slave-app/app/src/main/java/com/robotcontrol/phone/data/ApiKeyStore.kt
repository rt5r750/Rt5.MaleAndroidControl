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

    /* ===== Key 可用性判定（v1.11.0）：格式校验 + 历史成败标志，不发探测请求 ===== */

    /** 同步决策用的 Key 状态：空 / 格式非法或有失败历史 / 格式合法但无成败记录 / 格式合法且有成功历史 */
    enum class KeyState { EMPTY, INVALID, UNKNOWN, VALID }

    /** 格式校验：清洗后必须 sk- 前缀且长度足够，否则视为无效（无法参与同步） */
    fun isWellFormed(key: String?): Boolean {
        val k = normalizeApiKey(key)
        return k.length >= 16 && k.startsWith("sk-")
    }

    fun keyState(key: String?): KeyState {
        val k = normalizeApiKey(key)
        if (k.isEmpty()) return KeyState.EMPTY
        if (!isWellFormed(k)) return KeyState.INVALID
        return when (keyHistory(k)) {
            "ok" -> KeyState.VALID
            "fail" -> KeyState.INVALID
            else -> KeyState.UNKNOWN
        }
    }

    /** 真实 TTS/ASR 调用的成败落本地标志（按 Key 哈希），供后续同步判定；
        网络类错误不改写记录——只把鉴权失败记 fail、成功记 ok */
    fun recordKeyResult(key: String?, ok: Boolean) {
        val k = normalizeApiKey(key)
        if (k.isEmpty() || !isWellFormed(k)) return
        getPrefs().edit().putString(keyHistoryName(k), if (ok) "ok" else "fail").apply()
    }

    private fun keyHistory(key: String): String? =
        getPrefs().getString(keyHistoryName(key), null)

    private fun keyHistoryName(key: String): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        val hex = md.digest(key.toByteArray(Charsets.UTF_8))
            .take(8).joinToString("") { String.format("%02x", it) }
        return "key_state_$hex"
    }

    /* ===== 双端同步裁决（v1.11.0）=====
       Slave 为唯一决策者（连接后读 7506 取 Master 侧 Key 一次裁决，杜绝互相覆盖循环）：
       · 可用 = 格式合法且无失败历史（本机按历史标志判；远端历史不可知，格式合法即视为可用，
         Master 自己知道 Key 不可用时不把 Key 写进 7506 初值、按空处理）；
       · 双方都可用且不一致 → 各用各的（不同步）；只有一方可用 → 向可用侧对齐；
       · 双方都不可用（空/格式非法/失败历史）→ 不动，绝不把无效 Key 推给对方。
       详见 docs/ble-protocol.md 7506 节。 */
    enum class SyncAction { PUSH_TO_MASTER, ADOPT_FROM_MASTER, NONE }

    /** 本机 Key 是否可参与同步：格式合法且没有鉴权失败历史（UNKNOWN/VALID 算可用） */
    fun isUsable(key: String?): Boolean = when (keyState(key)) {
        KeyState.UNKNOWN, KeyState.VALID -> true
        else -> false
    }

    fun decideSync(localKey: String?, remoteKey: String?): SyncAction {
        val local = normalizeApiKey(localKey)
        val remote = normalizeApiKey(remoteKey)
        if (local == remote) return SyncAction.NONE          // 同一 Key（含双空）无需同步
        val localUsable = isUsable(local)
        val remoteUsable = remote.isNotEmpty() && isWellFormed(remote)
        return when {
            localUsable && remoteUsable -> SyncAction.NONE   // 都可用但不一致：各用各的
            localUsable -> SyncAction.PUSH_TO_MASTER         // 远端空/不可用：本地推给 Master
            remoteUsable -> SyncAction.ADOPT_FROM_MASTER     // 本地空/不可用：采用 Master 的
            else -> SyncAction.NONE                          // 都不可用：不动
        }
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

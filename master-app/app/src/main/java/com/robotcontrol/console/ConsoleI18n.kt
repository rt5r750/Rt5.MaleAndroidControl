package com.robotcontrol.console

import android.content.Context
import java.util.Locale

/**
 * 界面语言覆盖层。
 * 语言决策（v1.10.0）：① 用户手选（SharedPreferences robot_ui_lang 且 manual=true）→
 * ② 设备语言自动检测（Locale.getDefault()，zh* → 中文）→ ③ 兜底英文。
 * 自动检测结果不落盘——每次启动重新检测，仅手选持久化。
 * 中文源字符串不改动，仅在取值时按表替换，保证中文一字不改。
 * 术语遵循 T31-750 说明书英文版。
 */
object ConsoleI18n {
    private const val PREFS = "robot_ui_lang"
    private const val KEY = "lang"
    private const val KEY_MANUAL = "lang_manual"

    @Volatile
    private var lang: String = detectDeviceLang()

    /** 设备语言检测：zh* → 中文，其余/取不到 → 英文。 */
    fun detectDeviceLang(): String {
        return try {
            if (Locale.getDefault().toLanguageTag().trim().startsWith("zh", ignoreCase = true)) "zh" else "en"
        } catch (e: Exception) {
            "en"
        }
    }

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // 仅手选值可信；无手选标记时按设备语言重新检测（自动检测结果不入库）
        val manual = prefs.getBoolean(KEY_MANUAL, false)
        val saved = prefs.getString(KEY, null)
        lang = if (manual && (saved == "en" || saved == "zh")) saved else detectDeviceLang()
    }

    fun getLang(): String = lang

    /** 用户手选语言：持久化并标记 manual，此后设备语言检测不再覆盖。 */
    fun setLang(context: Context, next: String) {
        lang = if (next == "en") "en" else "zh"
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, lang)
            .putBoolean(KEY_MANUAL, true)
            .apply()
    }

    /** 返回当前语言下的界面文案；中文原样返回，保证既有中文一字不改。 */
    fun t(zh: String?): String {
        if (zh == null) return ""
        if (lang != "en") return zh
        return DICT[zh] ?: zh
    }

    private val DICT = mapOf(
        "蓝牙权限被拒绝" to "Bluetooth permission denied",
        "蓝牙未开启" to "Bluetooth is off",
        "蓝牙已连接" to "Bluetooth connected",
        "连接已手动断开" to "Connection manually disconnected",
        "蓝牙已断开" to "Bluetooth disconnected",
        "API Key 已同步" to "API Key synced",
        "推送成功" to "Push successful",
        "未找到可打开链接的浏览器应用" to "No browser app found to open this link",
        "无法打开链接: " to "Unable to open link: ",
        "未找到可打开PDF的应用，请安装PDF阅读器" to "No PDF app found; please install a PDF reader",
        "无法打开PDF: " to "Unable to open PDF: ",
        "无法准备PDF文件: " to "Unable to prepare PDF file: ",
        "连接失败" to "Connection failed",
        "缺少蓝牙权限，请重新打开控制台授权" to "Bluetooth permission missing; reopen the console to grant it"
    )
}

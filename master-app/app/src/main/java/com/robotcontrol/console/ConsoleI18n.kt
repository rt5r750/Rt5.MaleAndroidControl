package com.robotcontrol.console

import android.content.Context

/**
 * 界面语言覆盖层（英语翻译测试）。
 * 默认中文；www 设置页切换语言后经 JS 桥 setUiLang 同步（robot_ui_lang）。
 * 中文源字符串不改动，仅在取值时按表替换，保证中文一字不改。
 * 术语遵循 T31-750 说明书英文版。
 */
object ConsoleI18n {
    private const val PREFS = "robot_ui_lang"
    private const val KEY = "lang"

    @Volatile
    private var lang: String = "zh"

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        lang = prefs.getString(KEY, "zh") ?: "zh"
        if (lang != "en") lang = "zh"
    }

    fun getLang(): String = lang

    fun setLang(context: Context, next: String) {
        lang = if (next == "en") "en" else "zh"
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, lang)
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

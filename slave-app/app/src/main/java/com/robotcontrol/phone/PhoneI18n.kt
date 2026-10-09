package com.robotcontrol.phone

import android.content.Context
import android.content.SharedPreferences
import java.util.Locale

/**
 * 界面语言覆盖层。
 * 语言决策（v1.10.0）：① 用户手选（SharedPreferences robot_ui_lang 且 manual=true）→
 * ② 设备语言自动检测（Locale.getDefault()，zh* → 中文）→ ③ 兜底英文。
 * 自动检测结果不落盘——每次启动重新检测，仅手选持久化。
 * 不再跟随控制端 BLE 7507(UiLang) 推送（v1.10.0 起取消），语言只由本机决定。
 * 中文源字符串不改动，仅在取值时按表替换。
 * 术语遵循 T31-750 说明书英文版。
 */
object PhoneI18n {
    private const val PREFS = "robot_ui_lang"
    private const val KEY = "lang"
    private const val KEY_MANUAL = "lang_manual"

    @Volatile
    private var lang: String = detectDeviceLang()

    private val DICT = mapOf(
        "调试模式" to "Test Mode",
        "暂无任务" to "No tasks",
        "服从度" to "Obedience",
        "羞耻度" to "Shame",
        "愉悦度" to "Pleasure",
        "机械度" to "Robotic",
        "测试" to "Test",
        "任务列表" to "Task List",
        "语音播报" to "Voice Broadcast",
        "暂无语音消息" to "No voice messages",
        "相机权限被拒绝，无法扫码" to "Camera permission denied; cannot scan",
        "蓝牙权限被拒绝" to "Bluetooth permission denied",
        "蓝牙未开启" to "Bluetooth is off",
        "已连接" to "Connected",
        "控制面板已连接" to "Console connected",
        "连接已手动断开" to "Disconnected manually",
        "连接已断开，正在尝试重连..." to "Disconnected; trying to reconnect...",
        "连接中..." to "Connecting...",
        "未知任务" to "Unknown task",
        "已注入模拟数据" to "Simulated data injected",
        "连接失败" to "Connection failed",
        "停止扫描" to "Stop Scan",
        "重新扫描" to "Scan Again",
        "扫描二维码" to "Scan QR Code",
        "断开" to "Disconnect",
        "已断开连接" to "Disconnected",
        "关闭" to "Close",
        "未绑定" to "Not bound",
        "控制面板连接" to "Console Connection",
        "输入 API Key 用于语音播报" to "API Key for voice broadcast",
        "用于高质量机械语音合成，连接时自动同步到控制台" to "High-quality mechanical TTS; synced to console on connect",
        "附近设备" to "Nearby Devices",
        "二维码格式无效" to "Invalid QR code",
        "无法打开相机" to "Unable to open camera",
        "未找到相机" to "Camera not found",
        "相机不支持" to "Camera not supported",
        "相机访问失败" to "Camera access failed",
        "无相机权限" to "No camera permission",
        "将二维码放入框内自动扫描" to "Place QR code inside the frame to scan",
        "请对准二维码" to "Align with the QR code",
        "语言" to "Language",
        "中文" to "Chinese",
        "英文" to "English",
        "机器人语音播报通知" to "Android voice broadcast notifications",
        "切换语言" to "Switch Language",
        "正在连接..." to "Connecting...",
        "MiMo API Key（可选）" to "MiMo API Key (optional)",
        "主人指令" to "Master's command",
        "推送成功" to "Push successful",
        "选择模式" to "Select Mode",
        "长按胶囊切换模式" to "Long-press the capsule to switch modes",
        "未连接控制面板" to "Console not connected",
        "语音识别" to "Speech Recognition",
        "语音识别已开启" to "Speech recognition on",
        "语音识别已关闭" to "Speech recognition off",
        "缺少录音权限" to "Microphone permission required",
        "本地语音识别不可用" to "On-device speech recognition unavailable",
        "识别引擎调用云端（MiMo ASR）" to "Use cloud engine (MiMo ASR)",
        "关闭后仅使用本地离线识别" to "When off, only on-device recognition is used",
        "Xiaomi MiMo TTS和ASR可能需要收费，请阅读官网相关文档。" to "Xiaomi MiMo TTS and ASR may incur charges; please read the relevant documentation on the official website.",
        "恢复模式" to "Recovery Mode",
        "忠诚模式" to "Loyalty Mode",
        "拟人模式" to "Simulated Human Mode",
        "用户存在红色颜色偏好" to "User has a red color preference",
        "对圆形物体有额外关注" to "Pay extra attention to round objects",
        "执行环境扫描任务" to "Perform environment scan task",
        "同步云端配置数据" to "Sync cloud configuration data",
        "前往充电座充电" to "Go to the charging dock to charge",
        "等待用户语音指令" to "Waiting for user voice commands",
        "完成系统自检流程" to "Complete the system self-check",
        "检查传感器状态" to "Check sensor status",
        "更新定位地图信息" to "Update positioning map data",
        "执行第七项任务测试长列表" to "Task 7: test the long list",
        "第八个任务验证继续添加" to "Task 8: verify adding more items",
        "第九个任务确认完整显示" to "Task 9: confirm full display",
        "第十项任务滚动到底部" to "Task 10: scroll to the bottom",
        "第十一项验证导航栏通透" to "Item 11: verify navigation bar transparency",
        "第十二项检查状态栏效果" to "Item 12: check status bar effect",
        "暂停所有任务执行" to "Pause all task execution",
        "恢复出厂默认设置" to "Restore factory default settings",
        "系统已启动，等待指令" to "System started, awaiting commands",
        "任务执行完成，请查收" to "Task completed, please check",
        "检测到低电量，即将返回充电" to "Low battery detected; returning to charge",
        "语音播报测试消息内容示例" to "Voice broadcast test message example",
        "第六次语音播报测试滚动效果" to "6th broadcast: test scrolling effect",
        "第七次播报，验证底部导航栏通透" to "7th broadcast: verify bottom navigation bar transparency",
        "第八次播报，继续测试长列表" to "8th broadcast: continue testing the long list",
        // First Run 首启设置（v1.10.0）
        "首次启动设置" to "First-run setup",
        "默认按设备语言自动匹配，也可在此手动修改" to "Matched to the device language by default; you can change it here",
        "开始使用" to "Get started",
        "跳过，保持默认" to "Skip and keep defaults"
    )

    /** 设备语言检测：zh* → 中文，其余/取不到 → 英文。 */
    fun detectDeviceLang(): String {
        return try {
            if (Locale.getDefault().toLanguageTag().trim().startsWith("zh", ignoreCase = true)) "zh" else "en"
        } catch (e: Exception) {
            "en"
        }
    }

    fun init(context: Context) {
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val manual = prefs.getBoolean(KEY_MANUAL, false)
        val saved = prefs.getString(KEY, null)
        lang = if (manual && (saved == "en" || saved == "zh")) saved else detectDeviceLang()
    }

    /** 是否已由用户手选过语言（供首启页/设置页回显选中态）。 */
    fun isManual(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_MANUAL, false)

    fun getLang(): String = lang

    /** 用户手选语言：持久化并标记 manual。 */
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
}

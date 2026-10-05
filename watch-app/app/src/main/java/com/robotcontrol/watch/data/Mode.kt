package com.robotcontrol.watch.data

enum class Mode(
    val displayName: String,
    val color: Int
) {
    TEST("调试模式", 0xFF8FBC8F.toInt()),
    RECOVERY("恢复模式", 0xFFFB923C.toInt()),
    LOYALTY("忠诚模式", 0xFF66CCFF.toInt()),
    SIMULATED_HUMAN("拟人模式", 0xFFF472B6.toInt())
}

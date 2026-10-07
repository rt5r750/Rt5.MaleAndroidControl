package com.robotcontrol.phone.speech

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 本地语音规则（四大模式读音 + 否定词 + 中英语言门控）的回归测试。
 * 对应需求：识别的字不完全正确、但读音对就切换；被否定词否定的（如"不可以进入调试模式"）不切换；
 * 中文设置只匹配中文、英文设置只匹配英文。
 */
class VoiceCommandMatcherTest {

    private val ordTest = VoiceCommandMatcher.ORD_TEST
    private val ordRecovery = VoiceCommandMatcher.ORD_RECOVERY
    private val ordLoyalty = VoiceCommandMatcher.ORD_LOYALTY
    private val ordSimulated = VoiceCommandMatcher.ORD_SIMULATED_HUMAN

    /* ===== 中文：标准读音 ===== */

    @Test
    fun zhStandardReadings() {
        assertEquals(ordTest, VoiceCommandMatcher.match("调试模式", "zh"))
        assertEquals(ordRecovery, VoiceCommandMatcher.match("恢复模式", "zh"))
        assertEquals(ordLoyalty, VoiceCommandMatcher.match("忠诚模式", "zh"))
        assertEquals(ordSimulated, VoiceCommandMatcher.match("拟人模式", "zh"))
    }

    @Test
    fun zhSentenceWithReading() {
        assertEquals(ordTest, VoiceCommandMatcher.match("机器人突然说进入调试模式", "zh"))
        assertEquals(ordSimulated, VoiceCommandMatcher.match("请你切换到拟人模式可以吗", "zh"))
    }

    /** 同音字：识别文本用字不完全正确也必须命中（按读音匹配） */
    @Test
    fun zhHomophoneStillMatches() {
        assertEquals(ordTest, VoiceCommandMatcher.match("调式模式", "zh"))
        assertEquals(ordLoyalty, VoiceCommandMatcher.match("中诚模式", "zh"))
        assertEquals(ordRecovery, VoiceCommandMatcher.match("回复模式", "zh"))
        assertEquals(ordSimulated, VoiceCommandMatcher.match("你人模式", "zh"))
        assertEquals(ordTest, VoiceCommandMatcher.match("测试模式", "zh"))
        assertEquals(ordTest, VoiceCommandMatcher.match("条试模式", "zh"))
    }

    /* ===== 中文：否定词 ===== */

    @Test
    fun zhNegationBlocksSwitch() {
        assertNull(VoiceCommandMatcher.match("不可以进入调试模式", "zh"))
        assertNull(VoiceCommandMatcher.match("不要切换恢复模式", "zh"))
        assertNull(VoiceCommandMatcher.match("不能进入忠诚模式", "zh"))
        assertNull(VoiceCommandMatcher.match("别进入拟人模式", "zh"))
        assertNull(VoiceCommandMatcher.match("请勿切换到调试模式", "zh"))
    }

    /** 否定词只作用于其后窗口内的关键词：否定的与肯定的是两处时仍应命中肯定处 */
    @Test
    fun zhNegationIsLocalToKeyword() {
        assertEquals(ordLoyalty, VoiceCommandMatcher.match("不可以进入调试模式，请进入忠诚模式", "zh"))
    }

    /* ===== 英文：标准读音 ===== */

    @Test
    fun enStandardReadings() {
        assertEquals(ordTest, VoiceCommandMatcher.match("switch to test mode", "en"))
        assertEquals(ordTest, VoiceCommandMatcher.match("debug mode", "en"))
        assertEquals(ordRecovery, VoiceCommandMatcher.match("recovery mode", "en"))
        assertEquals(ordLoyalty, VoiceCommandMatcher.match("loyalty mode", "en"))
        assertEquals(ordSimulated, VoiceCommandMatcher.match("simulated human mode", "en"))
    }

    @Test
    fun enNegationBlocksSwitch() {
        assertNull(VoiceCommandMatcher.match("do not enter test mode", "en"))
        assertNull(VoiceCommandMatcher.match("never switch to loyalty mode", "en"))
        assertNull(VoiceCommandMatcher.match("No, do not enter test mode.", "en"))
    }

    /** 英文否定词按词边界：含 no/not 子串的普通词（know/nothing）不得误判为否定 */
    @Test
    fun enNegationIsWordBounded() {
        assertEquals(ordTest, VoiceCommandMatcher.match("I know the test mode is fine", "en"))
        assertEquals(ordLoyalty, VoiceCommandMatcher.match("nothing here, go to loyalty mode", "en"))
    }

    /** 真实 ASR 输出常带标点与结尾句号，规则必须照常命中/排除 */
    @Test
    fun realAsrTextWithPunctuation() {
        assertEquals(ordTest, VoiceCommandMatcher.match("进入调试模式。", "zh"))
        assertEquals(ordTest, VoiceCommandMatcher.match("好的，进入调试模式。", "zh"))
        assertNull(VoiceCommandMatcher.match("不可以进入调试模式。", "zh"))
        assertEquals(ordTest, VoiceCommandMatcher.match("Please enter test mode.", "en"))
    }

    /* ===== 语言门控：中文设置只识别中文、英文设置只识别英文 ===== */

    @Test
    fun languageGating() {
        assertNull(VoiceCommandMatcher.match("test mode", "zh"))
        assertNull(VoiceCommandMatcher.match("调试模式", "en"))
        assertEquals(ordTest, VoiceCommandMatcher.match("调试模式", "zh"))
        assertEquals(ordTest, VoiceCommandMatcher.match("test mode", "en"))
    }

    /* ===== 边界 ===== */

    @Test
    fun emptyAndUnrelatedText() {
        assertNull(VoiceCommandMatcher.match(null, "zh"))
        assertNull(VoiceCommandMatcher.match("   ", "zh"))
        assertNull(VoiceCommandMatcher.match("今天天气不错", "zh"))
        assertNull(VoiceCommandMatcher.match("", "en"))
        assertNull(VoiceCommandMatcher.match("hello world", "en"))
    }

    /** 「是否含模式读音」用于云端兜底前的判断：含关键词但被否定时仍算"含" */
    @Test
    fun containsModeKeyword() {
        assertTrue(VoiceCommandMatcher.containsModeKeyword("进入调试模式", "zh"))
        assertTrue(VoiceCommandMatcher.containsModeKeyword("不可以进入调试模式", "zh"))
        assertFalse(VoiceCommandMatcher.containsModeKeyword("今天天气不错", "zh"))
        assertTrue(VoiceCommandMatcher.containsModeKeyword("test mode", "en"))
        assertFalse(VoiceCommandMatcher.containsModeKeyword("调试模式", "en"))
    }
}
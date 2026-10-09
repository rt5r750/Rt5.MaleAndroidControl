package com.robotcontrol.phone.speech

/**
 * 本地轻量语音识别规则（不联网、零成本）。
 *
 * 目标：从（本地离线/云端）识别文本里判断是否出现「四大模式的读音」，并排除被否定词否定的情况。
 *  - 按读音匹配：内置紧凑「汉字→拼音（无声调）」小表，把识别文本切成滑窗拼音串与模式关键词拼音串比较，
 *    同音字（如 调/条、试/式、恢/回、诚/成）同样命中——满足「读音对就切换」。
 *  - 否定词：关键词前若干字内出现否定词（不可以/不要/别/勿/禁止…）则判定不切换。
 *  - 语言门控：中文设置只匹配中文关键词，英文设置只匹配英文关键词。
 *
 * 返回值为控制台 BLE 模式 ordinal：0=调试(TEST)、1=恢复(RECOVERY)、2=忠诚(LOYALTY)、3=拟人(SIMULATED_HUMAN)。
 */
object VoiceCommandMatcher {

    const val ORD_TEST = 0
    const val ORD_RECOVERY = 1
    const val ORD_LOYALTY = 2
    const val ORD_SIMULATED_HUMAN = 3

    /** 关键词前多少字内出现否定词即判定为「不切换」 */
    private const val NEGATION_WINDOW_ZH = 6
    private const val NEGATION_WINDOW_EN = 20

    /* ===== 汉字 → 拼音（无声调，仅覆盖模式关键词用字与常见同音字） ===== */
    private val PINYIN: Map<Char, String> = buildMap {
        // 调 重点
        for (c in "调掉吊雕叼") put(c, "diao")
        for (c in "条挑跳") put(c, "tiao")
        // 试
        for (c in "试式事是时使世市示视") put(c, "shi")
        // 测
        for (c in "测策侧册") put(c, "ce")
        // 模
        for (c in "模磨魔摩") put(c, "mo")
        // 恢
        for (c in "恢回灰辉汇会惠") put(c, "hui")
        // 复
        for (c in "复付腹负富附服副") put(c, "fu")
        // 忠
        for (c in "忠中钟终种") put(c, "zhong")
        // 诚
        for (c in "诚成城程承乘称丞") put(c, "cheng")
        // 拟
        for (c in "拟你泥尼逆") put(c, "ni")
        // 人
        for (c in "人仁任认忍") put(c, "ren")
    }

    /* 模式关键词（拼音序列，无声调）。同一 ordinal 的多条写法按顺序匹配。 */
    private data class PinyinKeyword(val ordinal: Int, val pinyin: List<String>)

    private val ZH_KEYWORDS: List<PinyinKeyword> = listOf(
        // 调试 / 测试 模式（tiao shi 也算同音变体：diao/tiao 均为 调/条）
        PinyinKeyword(ORD_TEST, "diao shi".split(" ")),
        PinyinKeyword(ORD_TEST, "tiao shi".split(" ")),
        PinyinKeyword(ORD_TEST, "ce shi".split(" ")),
        PinyinKeyword(ORD_RECOVERY, "hui fu".split(" ")),
        PinyinKeyword(ORD_LOYALTY, "zhong cheng".split(" ")),
        PinyinKeyword(ORD_SIMULATED_HUMAN, "ni ren".split(" "))
    )

    /* 英文关键词（小写）。 */
    private val EN_KEYWORDS: List<Pair<Int, String>> = listOf(
        ORD_SIMULATED_HUMAN to "simulated human mode",
        ORD_SIMULATED_HUMAN to "simulated human",
        ORD_RECOVERY to "recovery mode",
        ORD_LOYALTY to "loyalty mode",
        ORD_TEST to "test mode",
        ORD_TEST to "debug mode",
        ORD_LOYALTY to "loyalty",
        ORD_RECOVERY to "recovery",
        ORD_SIMULATED_HUMAN to "simulated"
    )

    private val NEGATION_ZH = listOf("不可以", "不能", "不要", "不用", "无需", "禁止", "请勿", "别", "勿", "不")
    /** 英文否定词按「词边界」匹配：`no`/`not` 直接子串会比中 know/nothing/nose 等词造成误否定 */
    private val NEGATION_EN = listOf(
        Regex("\\bdon't\\b"),
        Regex("\\bdo not\\b"),
        Regex("\\bdoes not\\b"),
        Regex("\\bnot\\b"),
        Regex("\\bnever\\b"),
        Regex("\\bwithout\\b"),
        Regex("\\bno\\b"),
        Regex("\\bcancel\\b")
    )

    /**
     * 匹配识别文本中的模式读音。
     * @param text 识别出的文本
     * @param lang 界面语言：zh / en（zh 只匹配中文关键词，en 只匹配英文）
     * @return 控制台 BLE 模式 ordinal（0-3），未命中或命中但被否定时返回 null
     */
    fun match(text: String?, lang: String): Int? {
        val raw = text?.trim().orEmpty()
        if (raw.isEmpty()) return null
        return if (lang == "en") matchEnglish(raw) else matchChinese(raw)
    }

    /** 文本中是否出现任一模式读音（不论是否被否定），用于「大段文本」判断 */
    fun containsModeKeyword(text: String?, lang: String): Boolean {
        val raw = text?.trim().orEmpty()
        if (raw.isEmpty()) return false
        return if (lang == "en") {
            val lower = raw.lowercase()
            EN_KEYWORDS.any { lower.contains(it.second) }
        } else {
            val tokens = raw.map { PINYIN[it] }
            ZH_KEYWORDS.any { kw -> findOccurrences(tokens, kw.pinyin).isNotEmpty() }
        }
    }

    private fun matchChinese(text: String): Int? {
        val tokens = text.map { PINYIN[it] }
        for (kw in ZH_KEYWORDS) {
            val hits = findOccurrences(tokens, kw.pinyin)
            for (start in hits) {
                if (!isNegatedZh(text, start)) return kw.ordinal
            }
        }
        return null
    }

    private fun matchEnglish(text: String): Int? {
        val lower = text.lowercase()
        for ((ordinal, keyword) in EN_KEYWORDS) {
            var idx = lower.indexOf(keyword)
            while (idx >= 0) {
                if (!isNegatedEn(lower, idx)) return ordinal
                idx = lower.indexOf(keyword, idx + 1)
            }
        }
        return null
    }

    /** 返回关键词在拼音序列中的所有起始下标 */
    private fun findOccurrences(tokens: List<String?>, keyword: List<String>): List<Int> {
        if (keyword.isEmpty() || tokens.size < keyword.size) return emptyList()
        val result = mutableListOf<Int>()
        outer@ for (i in 0..(tokens.size - keyword.size)) {
            for (j in keyword.indices) {
                val t = tokens[i + j] ?: continue@outer
                if (t != keyword[j]) continue@outer
            }
            result.add(i)
        }
        return result
    }

    /** 关键词起始下标 start 之前的窗口内是否出现中文否定词 */
    private fun isNegatedZh(text: String, start: Int): Boolean {
        if (start <= 0) return false
        val from = (start - NEGATION_WINDOW_ZH).coerceAtLeast(0)
        val window = text.substring(from, start)
        return NEGATION_ZH.any { window.contains(it) }
    }

    /** 关键词起始下标 idx 之前的窗口内是否出现英文否定词（按词边界） */
    private fun isNegatedEn(lowerText: String, idx: Int): Boolean {
        if (idx <= 0) return false
        val from = (idx - NEGATION_WINDOW_EN).coerceAtLeast(0)
        val window = lowerText.substring(from, idx)
        return NEGATION_EN.any { it.containsMatchIn(window) }
    }
}

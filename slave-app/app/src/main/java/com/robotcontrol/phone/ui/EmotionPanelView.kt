package com.robotcontrol.phone.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import com.robotcontrol.phone.PhoneI18n
import com.robotcontrol.phone.data.Emotion

class EmotionPanelView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private data class EmotionItem(
        val label: String,
        val value: Int,
        val color: Int
    )

    private var emotion: Emotion? = null
    private var showNa: Boolean = true

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 14f * resources.displayMetrics.density
        textAlign = Paint.Align.LEFT
    }

    private val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 14f * resources.displayMetrics.density
        textAlign = Paint.Align.RIGHT
        typeface = android.graphics.Typeface.MONOSPACE
    }

    private val naPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#FF888888")
        textSize = 14f * resources.displayMetrics.density
        textAlign = Paint.Align.RIGHT
        typeface = android.graphics.Typeface.MONOSPACE
    }

    private val barBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#26FFFFFF")
        style = Paint.Style.FILL
    }

    fun showNaState() {
        showNa = true
        invalidate()
    }

    fun setEmotion(newEmotion: Emotion?) {
        emotion = newEmotion
        showNa = newEmotion == null
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val density = resources.displayMetrics.density
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val itemHeight = (20f * density).toInt()
        val gap = (10f * density).toInt()
        val totalH = paddingTop + itemHeight * 4 + gap * 3 + paddingBottom
        setMeasuredDimension(w, totalH)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val pl = paddingLeft
        val pt = paddingTop
        val pr = paddingRight
        val w = width - pl - pr
        if (w <= 0) return

        val density = resources.displayMetrics.density
        val currentEmotion = emotion
        val items = if (currentEmotion != null) {
            listOf(
                EmotionItem(PhoneI18n.t("服从度"), currentEmotion.obedience, Color.parseColor("#4ade80")),
                EmotionItem(PhoneI18n.t("羞耻度"), currentEmotion.shame, Color.parseColor("#fb923c")),
                EmotionItem(PhoneI18n.t("愉悦度"), currentEmotion.pleasure, Color.parseColor("#f472b6")),
                EmotionItem(PhoneI18n.t("机械度"), currentEmotion.mechanical, Color.parseColor("#f87171"))
            )
        } else {
            listOf(
                EmotionItem(PhoneI18n.t("服从度"), 0, Color.parseColor("#4ade80")),
                EmotionItem(PhoneI18n.t("羞耻度"), 0, Color.parseColor("#fb923c")),
                EmotionItem(PhoneI18n.t("愉悦度"), 0, Color.parseColor("#f472b6")),
                EmotionItem(PhoneI18n.t("机械度"), 0, Color.parseColor("#f87171"))
            )
        }

        val gap = 10f * density
        val barHeight = 6f * density
        val barRadius = barHeight / 2f
        val sideGap = 10f * density
        val labelWidth = textPaint.measureText(PhoneI18n.t("服从度"))
        val valueWidth = valuePaint.measureText("100")
        val barLeft = pl + labelWidth + sideGap
        val barRight = width - pr - valueWidth - sideGap
        val barTotalWidth = barRight - barLeft
        val itemHeight = 20f * density

        val shouldShowNa = showNa || emotion == null

        for ((index, item) in items.withIndex()) {
            val top = pt + index * (itemHeight + gap)
            val centerY = top + itemHeight / 2f
            val textBaseY = centerY - (textPaint.ascent() + textPaint.descent()) / 2f

            canvas.drawText(item.label, pl.toFloat(), textBaseY, textPaint)
            if (shouldShowNa) {
                canvas.drawText("NA", (width - pr).toFloat(), textBaseY, naPaint)
            } else {
                canvas.drawText(item.value.toString(), (width - pr).toFloat(), textBaseY, valuePaint)
            }

            val barTop = centerY - barHeight / 2f
            val barBottom = centerY + barHeight / 2f
            canvas.drawRoundRect(barLeft, barTop, barRight, barBottom, barRadius, barRadius, barBackgroundPaint)

            if (!shouldShowNa) {
                val progress = item.value / 100f
                val fillRight = if (progress > 0f) {
                    (barLeft + barTotalWidth * progress).coerceAtLeast(barLeft + barHeight)
                } else {
                    barLeft
                }
                val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = item.color }
                canvas.drawRoundRect(
                    barLeft, barTop,
                    fillRight,
                    barBottom, barRadius, barRadius, fillPaint
                )
            }
        }
    }
}

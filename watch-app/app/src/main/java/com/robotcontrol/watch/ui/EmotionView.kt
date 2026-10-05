package com.robotcontrol.watch.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View
import com.robotcontrol.watch.data.Emotion

class EmotionView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var emotion: Emotion = Emotion()

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 16f, resources.displayMetrics)
    }
    private val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 16f, resources.displayMetrics)
        textAlign = Paint.Align.RIGHT
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
    }
    private val barBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#33FFFFFF")
    }

    data class EmotionItem(
        val label: String,
        val value: Int,
        val color: Int
    )

    fun setEmotion(newEmotion: Emotion) {
        emotion = newEmotion
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val pl = paddingLeft
        val pt = paddingTop
        val pr = paddingRight
        val pb = paddingBottom
        val w = width - pl - pr
        val h = height - pt - pb
        if (w <= 0 || h <= 0) return

        val items = listOf(
            EmotionItem("服从度", emotion.obedience, Color.parseColor("#4ade80")),
            EmotionItem("羞耻度", emotion.shame, Color.parseColor("#fb923c")),
            EmotionItem("愉悦度", emotion.pleasure, Color.parseColor("#f472b6")),
            EmotionItem("机械度", emotion.mechanical, Color.parseColor("#f87171"))
        )

        val density = resources.displayMetrics.density
        val gap = 12f * density
        val barHeight = 10f * density
        val barRadius = barHeight / 2f
        val sideGap = 10f * density
        val labelWidth = textPaint.measureText("服从度")
        val valueWidth = valuePaint.measureText("100")
        val barLeft = pl + labelWidth + sideGap
        val barRight = pl + w - valueWidth - sideGap
        val barTotalWidth = barRight - barLeft
        val itemHeight = maxOf(textPaint.textSize, barHeight)
        val totalContentHeight = itemHeight * items.size + gap * (items.size - 1)
        val startY = pt + (h - totalContentHeight) / 2f

        for ((index, item) in items.withIndex()) {
            val top = startY + index * (itemHeight + gap)
            val centerY = top + itemHeight / 2f
            val textBaseY = centerY - (textPaint.ascent() + textPaint.descent()) / 2f

            canvas.drawText(item.label, pl.toFloat(), textBaseY, textPaint)

            val valueText = item.value.toString()
            canvas.drawText(valueText, (width - pr).toFloat(), textBaseY, valuePaint)

            val barTop = centerY - barHeight / 2f
            val barBottom = centerY + barHeight / 2f
            canvas.drawRoundRect(
                barLeft,
                barTop,
                barRight,
                barBottom,
                barRadius,
                barRadius,
                barBackgroundPaint
            )

            val progress = item.value / 100f
            val fillRight = barLeft + barTotalWidth * progress
            val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = item.color }
            canvas.drawRoundRect(
                barLeft,
                barTop,
                fillRight.coerceAtLeast(barLeft + barHeight),
                barBottom,
                barRadius,
                barRadius,
                fillPaint
            )
        }
    }
}

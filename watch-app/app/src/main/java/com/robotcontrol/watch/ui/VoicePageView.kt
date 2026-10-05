package com.robotcontrol.watch.ui

import android.content.Context
import android.graphics.Color
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.robotcontrol.watch.data.VoiceMessage
import java.text.SimpleDateFormat
import java.util.*

class VoicePageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : LinearLayout(context, attrs, defStyleAttr) {

    private val scrollView: ScrollView
    private val contentLayout: LinearLayout
    private val emptyView: TextView
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    init {
        orientation = VERTICAL
        setBackgroundColor(Color.BLACK)
        scrollView = ScrollView(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            isVerticalScrollBarEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            isFillViewport = true
        }
        contentLayout = LinearLayout(context).apply {
            orientation = VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        emptyView = TextView(context).apply {
            text = "暂无播报"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        contentLayout.addView(emptyView)
        scrollView.addView(contentLayout)
        addView(scrollView)
    }

    fun setContentTopPadding(padding: Int) {
        contentLayout.setPadding(
            contentLayout.paddingLeft,
            padding,
            contentLayout.paddingRight,
            contentLayout.paddingBottom
        )
    }

    fun setVoiceMessages(messages: List<VoiceMessage>) {
        val density = resources.displayMetrics.density

        while (contentLayout.childCount > 1) {
            contentLayout.removeViewAt(contentLayout.childCount - 1)
        }

        emptyView.visibility = if (messages.isEmpty()) VISIBLE else GONE

        if (messages.isNotEmpty()) {
            contentLayout.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
            for (message in messages) {
                val itemLayout = LinearLayout(context).apply {
                    orientation = VERTICAL
                    setPadding(
                        (4 * density).toInt(),
                        (6 * density).toInt(),
                        (4 * density).toInt(),
                        (6 * density).toInt()
                    )
                }

                val timeView = TextView(context).apply {
                    text = timeFormat.format(Date(message.timestamp))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                    setTextColor(Color.GRAY)
                }

                val contentView = TextView(context).apply {
                    text = message.content
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    setTextColor(Color.WHITE)
                }

                itemLayout.addView(timeView)
                itemLayout.addView(contentView)
                contentLayout.addView(itemLayout)
            }
        } else {
            contentLayout.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        scrollView.post {
            scrollView.scrollTo(0, 0)
        }
    }

    fun getScrollView(): ScrollView = scrollView
}

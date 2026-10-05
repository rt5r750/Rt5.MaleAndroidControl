package com.robotcontrol.watch.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.robotcontrol.watch.R
import com.robotcontrol.watch.data.Task
import com.robotcontrol.watch.data.WatchDataStore

class TaskPageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : LinearLayout(context, attrs, defStyleAttr) {

    private val scrollView: ScrollView
    private val contentLayout: LinearLayout
    private val emptyView: TextView

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
            text = context.getString(R.string.no_tasks)
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

    fun setTasks(tasks: List<Task>) {
        val density = resources.displayMetrics.density

        while (contentLayout.childCount > 1) {
            contentLayout.removeViewAt(contentLayout.childCount - 1)
        }

        emptyView.visibility = if (tasks.isEmpty()) VISIBLE else GONE

        if (tasks.isNotEmpty()) {
            contentLayout.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
            for (task in tasks) {
                val itemLayout = LinearLayout(context).apply {
                    orientation = HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(
                        (4 * density).toInt(),
                        (6 * density).toInt(),
                        (4 * density).toInt(),
                        (6 * density).toInt()
                    )
                }

                val indicator = TextView(context).apply {
                    layoutParams = LayoutParams((20 * density).toInt(), (20 * density).toInt()).apply {
                        marginEnd = (10 * density).toInt()
                    }
                    gravity = Gravity.CENTER
                    if (task.isDone) {
                        text = "✓"
                        setTextColor(Color.GRAY)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    } else {
                        text = "●"
                        setTextColor(WatchDataStore.mode.color)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                    }
                }

                val nameView = TextView(context).apply {
                    layoutParams = LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
                    text = task.name
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                    setTextColor(if (task.isDone) Color.GRAY else Color.WHITE)
                }

                itemLayout.addView(indicator)
                itemLayout.addView(nameView)
                contentLayout.addView(itemLayout)
            }
        } else {
            contentLayout.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
    }

    fun getScrollView(): ScrollView = scrollView
}

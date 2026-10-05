package com.robotcontrol.watch.ui

import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.OverScroller
import android.view.animation.LinearInterpolator
import kotlin.math.abs
import kotlin.math.roundToInt

class PageContainer @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ViewGroup(context, attrs, defStyleAttr) {

    private val scroller = OverScroller(context)
    private var currentPage: Int = 1
    private var pageOffset: Int = 0
    private var animationStartOffset: Int = 0
    private var animationFromPage: Int = 0
    private var animationToPage: Int = 0
    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 150L
        interpolator = LinearInterpolator()
    }

    var onPageChanged: ((Int) -> Unit)? = null

    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onFling(
            e1: MotionEvent?,
            e2: MotionEvent,
            velocityX: Float,
            velocityY: Float
        ): Boolean {
            val width = width
            if (width == 0) return false
            val velocityThreshold = 500
            if (velocityX < -velocityThreshold && currentPage < childCount - 1) {
                setCurrentPage(currentPage + 1, true)
                return true
            } else if (velocityX > velocityThreshold && currentPage > 0) {
                setCurrentPage(currentPage - 1, true)
                return true
            }
            return false
        }
    })

    private var downX = 0f

    init {
        animator.addUpdateListener {
            val value = it.animatedValue as Float
            val targetOffset = -currentPage * width
            pageOffset = (animationStartOffset + (targetOffset - animationStartOffset) * value).roundToInt()
            updateAlphas(value)
            requestLayout()
        }
        animator.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) {
                resetAlphas()
            }

            override fun onAnimationCancel(animation: android.animation.Animator) {
                resetAlphas()
            }
        })
    }

    fun setCurrentPage(page: Int, animate: Boolean = false) {
        val target = page.coerceIn(0, childCount - 1)
        if (target == currentPage && !animate) return
        val previousPage = currentPage
        currentPage = target
        if (width == 0) {
            pageOffset = -currentPage * width
            return
        }
        if (animate) {
            animator.cancel()
            animationFromPage = previousPage
            animationToPage = currentPage
            animationStartOffset = pageOffset
            updateAlphas(0f)
            animator.setFloatValues(0f, 1f)
            animator.start()
        } else {
            pageOffset = -currentPage * width
            resetAlphas()
            requestLayout()
        }
        onPageChanged?.invoke(currentPage)
    }

    private fun updateAlphas(fraction: Float) {
        if (childCount == 0 || animationFromPage == animationToPage) {
            resetAlphas()
            return
        }
        for (i in 0 until childCount) {
            getChildAt(i).alpha = when (i) {
                animationFromPage -> 1f - fraction
                animationToPage -> fraction
                else -> 0f
            }
        }
    }

    private fun resetAlphas() {
        for (i in 0 until childCount) {
            getChildAt(i).alpha = 1f
        }
    }

    fun getCurrentPage(): Int = currentPage

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val height = MeasureSpec.getSize(heightMeasureSpec)
        val childWidthMeasureSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
        val childHeightMeasureSpec = MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
        for (i in 0 until childCount) {
            getChildAt(i).measure(childWidthMeasureSpec, childHeightMeasureSpec)
        }
        setMeasuredDimension(width, height)
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val width = r - l
        val height = b - t
        for (i in 0 until childCount) {
            val left = pageOffset + i * width
            getChildAt(i).layout(left, 0, left + width, height)
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        pageOffset = -currentPage * w
        requestLayout()
    }

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        parent?.requestDisallowInterceptTouchEvent(true)
        when (ev.action) {
            MotionEvent.ACTION_DOWN -> {
                downX = ev.x
                animator.cancel()
                scroller.abortAnimation()
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = ev.x - downX
                if (abs(dx) > 24) {
                    return true
                }
            }
        }
        return false
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        parent?.requestDisallowInterceptTouchEvent(true)
        gestureDetector.onTouchEvent(event)
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.x
                animator.cancel()
                scroller.abortAnimation()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - downX
                val baseOffset = -currentPage * width
                pageOffset = (baseOffset + dx).toInt()
                requestLayout()
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                val width = width
                if (width == 0) return true
                val pageShift = (-pageOffset.toFloat() / width) - currentPage
                when {
                    pageShift > 0.35f && currentPage < childCount - 1 -> setCurrentPage(currentPage + 1, true)
                    pageShift < -0.35f && currentPage > 0 -> setCurrentPage(currentPage - 1, true)
                    else -> setCurrentPage(currentPage, true)
                }
            }
        }
        return true
    }

    override fun computeScroll() {
        if (scroller.computeScrollOffset()) {
            pageOffset = scroller.currX
            requestLayout()
            postInvalidateOnAnimation()
        }
    }
}

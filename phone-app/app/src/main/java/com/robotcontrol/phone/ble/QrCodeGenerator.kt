package com.robotcontrol.phone.ble

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import kotlin.math.abs

object QrCodeGenerator {

    private const val MODULE_SIZE = 25
    private const val QUIET_ZONE = 2

    fun generate(
        content: String,
        size: Int = 200,
        darkColor: Int = Color.BLACK,
        lightColor: Int = Color.WHITE
    ): Bitmap {
        val totalModules = MODULE_SIZE + QUIET_ZONE * 2
        val qrSize = (size * 0.75f).toInt()
        val textAreaHeight = size - qrSize
        val modulePixelSize = qrSize / totalModules

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(lightColor)

        val matrix = Array(MODULE_SIZE) { BooleanArray(MODULE_SIZE) }

        drawFinderPattern(matrix, 0, 0)
        drawFinderPattern(matrix, MODULE_SIZE - 7, 0)
        drawFinderPattern(matrix, 0, MODULE_SIZE - 7)

        drawTimingPatterns(matrix)

        fillDataArea(matrix, content)

        drawMatrix(canvas, matrix, modulePixelSize, darkColor, lightColor, qrSize)

        drawText(canvas, content, size, qrSize, textAreaHeight, darkColor)

        return bitmap
    }

    private fun drawFinderPattern(matrix: Array<BooleanArray>, startX: Int, startY: Int) {
        for (y in 0 until 7) {
            for (x in 0 until 7) {
                val isOuter = x == 0 || x == 6 || y == 0 || y == 6
                val isInner = x in 2..4 && y in 2..4
                matrix[startY + y][startX + x] = isOuter || isInner
            }
        }

        for (y in -1..7) {
            for (x in -1..7) {
                val px = startX + x
                val py = startY + y
                if (px in 0 until MODULE_SIZE && py in 0 until MODULE_SIZE) {
                    if (x == -1 || x == 7 || y == -1 || y == 7) {
                        matrix[py][px] = false
                    }
                }
            }
        }
    }

    private fun drawTimingPatterns(matrix: Array<BooleanArray>) {
        for (i in 8 until MODULE_SIZE - 8) {
            matrix[6][i] = i % 2 == 0
            matrix[i][6] = i % 2 == 0
        }
    }

    private fun fillDataArea(matrix: Array<BooleanArray>, content: String) {
        var seed = 0L
        for (c in content) {
            seed = seed * 31 + c.code.toLong()
        }
        seed = abs(seed)

        val random = SimpleRandom(seed)

        for (y in 0 until MODULE_SIZE) {
            for (x in 0 until MODULE_SIZE) {
                if (isFinderArea(x, y) || isTimingArea(x, y)) {
                    continue
                }
                matrix[y][x] = random.nextBoolean()
            }
        }
    }

    private fun isFinderArea(x: Int, y: Int): Boolean {
        if (x < 8 && y < 8) return true
        if (x >= MODULE_SIZE - 8 && y < 8) return true
        if (x < 8 && y >= MODULE_SIZE - 8) return true
        return false
    }

    private fun isTimingArea(x: Int, y: Int): Boolean {
        return x == 6 || y == 6
    }

    private fun drawMatrix(
        canvas: Canvas,
        matrix: Array<BooleanArray>,
        modulePixelSize: Int,
        darkColor: Int,
        lightColor: Int,
        qrSize: Int
    ) {
        val paint = Paint().apply { isAntiAlias = false }
        val offsetX = (canvas.width - qrSize) / 2f
        val offsetY = 0f

        canvas.drawRect(offsetX, offsetY, offsetX + qrSize, offsetY + qrSize, paint.apply { color = lightColor })

        paint.color = darkColor
        for (y in 0 until MODULE_SIZE) {
            for (x in 0 until MODULE_SIZE) {
                if (matrix[y][x]) {
                    val px = offsetX + (x + QUIET_ZONE) * modulePixelSize
                    val py = offsetY + (y + QUIET_ZONE) * modulePixelSize
                    canvas.drawRect(px, py, px + modulePixelSize, py + modulePixelSize, paint)
                }
            }
        }
    }

    private fun drawText(
        canvas: Canvas,
        content: String,
        size: Int,
        qrSize: Int,
        textAreaHeight: Int,
        textColor: Int
    ) {
        val paint = Paint().apply {
            color = textColor
            textAlign = Paint.Align.CENTER
            isAntiAlias = true
        }

        val displayText = if (content.length > 24) content.take(21) + "..." else content
        val textSize = textAreaHeight * 0.35f
        paint.textSize = textSize

        val y = qrSize + textAreaHeight * 0.55f
        canvas.drawText(displayText, size / 2f, y, paint)
    }

    private class SimpleRandom(private var seed: Long) {
        fun nextBoolean(): Boolean {
            seed = (seed * 1103515245 + 12345) and 0x7fffffff
            return seed % 2 == 0L
        }
    }
}

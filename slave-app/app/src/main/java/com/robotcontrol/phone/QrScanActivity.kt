package com.robotcontrol.phone

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.*
import android.hardware.camera2.*
import android.media.Image
import android.media.ImageReader
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.util.*
import java.util.Collections
import java.util.EnumSet
import kotlin.math.max

class QrScanActivity : Activity() {

    companion object {
        const val EXTRA_QR_DATA = "qr_data"
    }

    private lateinit var previewView: TextureView
    private lateinit var hintText: TextView
    private lateinit var bottomHint: TextView
    private lateinit var cancelBtn: View
    private lateinit var cancelIcon: TextView
    private lateinit var scanOverlay: ScanOverlayView

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private var reader: MultiFormatReader? = null
    private var isDecoding = false
    private var scanned = false

    private var previewSize: Size? = null
    private var sensorOrientation: Int = 90
    private var cameraId: String? = null
    private var facingFront = false

    private val surfaceTextureListener = object : TextureView.SurfaceTextureListener {
        override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
            Log.d("QrScan", "SurfaceTexture available: ${width}x${height}")
            openCamera(width, height)
        }
        override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
            configureTransform(width, height)
        }
        override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean = true
        override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
    }

    private val stateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            cameraDevice = camera
            createPreviewSession()
        }
        override fun onDisconnected(camera: CameraDevice) {
            camera.close()
            cameraDevice = null
        }
        override fun onError(camera: CameraDevice, error: Int) {
            camera.close()
            cameraDevice = null
            runOnUiThread {
                Toast.makeText(this@QrScanActivity, PhoneI18n.t("无法打开相机"), Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    private val onImageAvailableListener = ImageReader.OnImageAvailableListener { reader ->
        if (isDecoding || scanned) return@OnImageAvailableListener
        isDecoding = true
        var image: Image? = null
        try {
            image = reader.acquireLatestImage()
            if (image != null) {
                val planes = image.planes
                val yPlane = planes[0]
                val yBuffer = yPlane.buffer
                val ySize = yBuffer.remaining()
                val yData = ByteArray(ySize)
                yBuffer.get(yData)

                val width = image.width
                val height = image.height
                val rowStride = yPlane.rowStride
                val pixelStride = yPlane.pixelStride

                val cropped = cropAndRotate(yData, width, height, rowStride, pixelStride)

                val source = PlanarYUVLuminanceSource(
                    cropped.data, cropped.width, cropped.height,
                    0, 0, cropped.width, cropped.height, false
                )
                val bitmap = BinaryBitmap(HybridBinarizer(source))
                try {
                    val result = this@QrScanActivity.reader?.decodeWithState(bitmap)
                    if (result != null && result.text != null) {
                        scanned = true
                        runOnUiThread {
                            val data = Intent().apply { putExtra(EXTRA_QR_DATA, result.text) }
                            setResult(RESULT_OK, data)
                            finish()
                        }
                    }
                } catch (_: Exception) {
                } finally {
                    this@QrScanActivity.reader?.reset()
                }
            }
        } catch (e: Exception) {
            Log.e("QrScan", "decode error", e)
        } finally {
            image?.close()
            isDecoding = false
        }
    }

    private fun cropAndRotate(data: ByteArray, width: Int, height: Int, rowStride: Int, pixelStride: Int): CropResult {
        val compact = ByteArray(width * height)
        if (rowStride == width && pixelStride == 1) {
            System.arraycopy(data, 0, compact, 0, width * height)
        } else {
            var pos = 0
            for (row in 0 until height) {
                val offset = row * rowStride
                for (col in 0 until width) {
                    compact[pos++] = data[offset + col * pixelStride]
                }
            }
        }

        val displayRotation = windowManager.defaultDisplay.rotation
        val jpegRotation = getRotation(displayRotation)

        val rotated: ByteArray
        val outW: Int
        val outH: Int
        when (jpegRotation) {
            0 -> {
                rotated = compact
                outW = width
                outH = height
            }
            90 -> {
                rotated = rotateYuv90(compact, width, height)
                outW = height
                outH = width
            }
            180 -> {
                rotated = rotateYuv180(compact, width, height)
                outW = width
                outH = height
            }
            270 -> {
                rotated = rotateYuv270(compact, width, height)
                outW = height
                outH = width
            }
            else -> {
                rotated = compact
                outW = width
                outH = height
            }
        }
        return CropResult(rotated, outW, outH)
    }

    private fun getRotation(rotation: Int): Int {
        val degrees = when (rotation) {
            Surface.ROTATION_0 -> 0
            Surface.ROTATION_90 -> 90
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 270
            else -> 0
        }
        var result: Int
        if (facingFront) {
            result = (sensorOrientation + degrees) % 360
            result = (360 - result) % 360
        } else {
            result = (sensorOrientation - degrees + 360) % 360
        }
        return result
    }

    private fun rotateYuv90(data: ByteArray, width: Int, height: Int): ByteArray {
        val rotated = ByteArray(width * height)
        for (y in 0 until height) {
            for (x in 0 until width) {
                rotated[x * height + (height - 1 - y)] = data[y * width + x]
            }
        }
        return rotated
    }

    private fun rotateYuv180(data: ByteArray, width: Int, height: Int): ByteArray {
        val rotated = ByteArray(width * height)
        val total = width * height
        for (i in 0 until total) {
            rotated[total - 1 - i] = data[i]
        }
        return rotated
    }

    private fun rotateYuv270(data: ByteArray, width: Int, height: Int): ByteArray {
        val rotated = ByteArray(width * height)
        for (y in 0 until height) {
            for (x in 0 until width) {
                rotated[(width - 1 - x) * height + y] = data[y * width + x]
            }
        }
        return rotated
    }

    data class CropResult(val data: ByteArray, val width: Int, val height: Int) {
        override fun equals(other: Any?): Boolean = other is CropResult && data.contentEquals(other.data) && width == other.width && height == other.height
        override fun hashCode(): Int = data.contentHashCode()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
        window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN)

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        }

        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }

        setContentView(R.layout.activity_qr_scan)

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )

        @Suppress("DEPRECATION")
        window.decorView.setOnSystemUiVisibilityChangeListener { visibility ->
            if (visibility and View.SYSTEM_UI_FLAG_FULLSCREEN == 0) {
                Handler(mainLooper).postDelayed({ enterImmersiveMode() }, 100)
            }
        }

        previewView = findViewById(R.id.previewView)
        hintText = findViewById(R.id.hintText)
        bottomHint = findViewById(R.id.bottomHint)
        cancelBtn = findViewById(R.id.cancelBtn)
        cancelIcon = findViewById(R.id.cancelIcon)

        // 两条扫描提示写在布局里，此前只取视图未回写文案（英文模式下恒显示中文）；
        // 渲染点统一走词典，与其余界面口径一致。
        hintText.text = PhoneI18n.t("将二维码放入框内自动扫描")
        bottomHint.text = PhoneI18n.t("请对准二维码")

        // Add layout listener to call configureTransform whenever view size changes
        previewView.addOnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
            val newW = right - left
            val newH = bottom - top
            val oldW = oldRight - oldLeft
            val oldH = oldBottom - oldTop
            if (newW != oldW || newH != oldH) {
                previewView.post { configureTransform(newW, newH) }
            }
        }

        val overlayContainer = findViewById<FrameLayout>(R.id.overlayContainer)
        overlayContainer.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        scanOverlay = ScanOverlayView(this)
        overlayContainer.addView(scanOverlay, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        cancelBtn.setOnClickListener { finish() }
        cancelIcon.setOnClickListener { finish() }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            cancelBtn.elevation = 10f
            cancelIcon.elevation = 10f
        }
        cancelBtn.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        cancelIcon.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        reader = MultiFormatReader().apply {
            val hints = mapOf(
                DecodeHintType.POSSIBLE_FORMATS to EnumSet.of(BarcodeFormat.QR_CODE),
                DecodeHintType.TRY_HARDER to true
            )
            setHints(hints)
        }

        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            finish()
            return
        }
    }

    override fun onResume() {
        super.onResume()
        startBackgroundThread()
        enterImmersiveMode()
        Handler(mainLooper).postDelayed({ enterImmersiveMode() }, 100)
        Handler(mainLooper).postDelayed({ enterImmersiveMode() }, 500)
        if (previewView.isAvailable) {
            openCamera(previewView.width, previewView.height)
        } else {
            previewView.surfaceTextureListener = surfaceTextureListener
        }
    }

    override fun onPause() {
        closeCamera()
        stopBackgroundThread()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enterImmersiveMode()
            Handler(mainLooper).postDelayed({ enterImmersiveMode() }, 100)
            Handler(mainLooper).postDelayed({ enterImmersiveMode() }, 300)
        }
    }

    private fun enterImmersiveMode() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
                window.insetsController?.let { controller ->
                    controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
            }
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        } catch (e: Exception) {
            Log.e("QrScan", "enterImmersiveMode error", e)
        }
    }

    @Suppress("DEPRECATION")
    private fun configureTransform(viewWidth: Int, viewHeight: Int) {
        val ps = previewSize ?: return
        if (viewWidth == 0 || viewHeight == 0) return

        val matrix = Matrix()
        val rotation = windowManager.defaultDisplay.rotation
        val viewRect = RectF(0f, 0f, viewWidth.toFloat(), viewHeight.toFloat())
        val bufferRect = RectF(0f, 0f, ps.height.toFloat(), ps.width.toFloat())
        val centerX = viewRect.centerX()
        val centerY = viewRect.centerY()
        if (Surface.ROTATION_90 == rotation || Surface.ROTATION_270 == rotation) {
            bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY())
            matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)
            val scale = Math.max(
                viewHeight.toFloat() / ps.height.toFloat(),
                viewWidth.toFloat() / ps.width.toFloat()
            )
            matrix.postScale(scale, scale, centerX, centerY)
            matrix.postRotate((90 * (rotation - 2)).toFloat(), centerX, centerY)
        } else if (Surface.ROTATION_180 == rotation) {
            matrix.postRotate(180f, centerX, centerY)
        } else {
            // EXACT GOOGLE CODE - NO ROTATION FOR PORTRAIT ROTATION_0!
            bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY())
            matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)
            val scale = Math.max(
                viewHeight.toFloat() / ps.height.toFloat(),
                viewWidth.toFloat() / ps.width.toFloat()
            )
            matrix.postScale(scale, scale, centerX, centerY)
        }
        previewView.setTransform(matrix)
    }

    private class CompareSizesByArea : Comparator<Size> {
        override fun compare(lhs: Size, rhs: Size): Int {
            return java.lang.Long.signum(lhs.width.toLong() * lhs.height - rhs.width.toLong() * rhs.height)
        }
    }

    private fun chooseOptimalSize(choices: Array<Size>, textureViewWidth: Int, textureViewHeight: Int,
                                   maxWidth: Int, maxHeight: Int, aspectRatio: Size): Size {
        val aspectTolerance = 0.1
        val targetRatio = aspectRatio.width.toDouble() / aspectRatio.height.toDouble()
        
        val valid = choices.filter { 
            it.width <= maxWidth && it.height <= maxHeight 
        }
        
        if (valid.isEmpty()) {
            return choices.maxByOrNull { it.width.toLong() * it.height } ?: choices[0]
        }
        
        val matchingAspect = valid.filter {
            val ratio = it.width.toDouble() / it.height.toDouble()
            Math.abs(ratio - targetRatio) / targetRatio < aspectTolerance
        }
        
        val bigEnough = matchingAspect.filter {
            it.width >= textureViewWidth && it.height >= textureViewHeight
        }
        
        return when {
            bigEnough.isNotEmpty() -> Collections.max(bigEnough, CompareSizesByArea())
            matchingAspect.isNotEmpty() -> Collections.max(matchingAspect, CompareSizesByArea())
            else -> Collections.max(valid, CompareSizesByArea())
        }
    }

    @Suppress("DEPRECATION")
    private fun openCamera(width: Int, height: Int) {
        val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            cameraId = null
            var characteristics: CameraCharacteristics? = null
            for (id in manager.cameraIdList) {
                val chars = manager.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                val sOri = chars.get(CameraCharacteristics.SENSOR_ORIENTATION)
                Log.d("QrScan", "Found camera id=$id, facing=$facing, sensorOrientation=$sOri")
                if (facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id
                    characteristics = chars
                    facingFront = false
                    break
                }
            }
            if (cameraId == null) {
                for (id in manager.cameraIdList) {
                    val chars = manager.getCameraCharacteristics(id)
                    val facing = chars.get(CameraCharacteristics.LENS_FACING)
                    if (facing == CameraCharacteristics.LENS_FACING_FRONT) {
                        cameraId = id
                        characteristics = chars
                        facingFront = true
                        break
                    }
                }
            }
            if (cameraId == null && manager.cameraIdList.isNotEmpty()) {
                cameraId = manager.cameraIdList[0]
                characteristics = manager.getCameraCharacteristics(cameraId!!)
            }
            if (cameraId == null) {
                Toast.makeText(this, PhoneI18n.t("未找到相机"), Toast.LENGTH_SHORT).show()
                finish()
                return
            }

            sensorOrientation = characteristics?.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90

            val displayRotation = windowManager.defaultDisplay.rotation
            val swappedDimensions = when (displayRotation) {
                Surface.ROTATION_0, Surface.ROTATION_180 ->
                    (sensorOrientation == 90 || sensorOrientation == 270)
                Surface.ROTATION_90, Surface.ROTATION_270 ->
                    (sensorOrientation == 0 || sensorOrientation == 180)
                else -> false
            }

            val displaySize = Point()
            windowManager.defaultDisplay.getRealSize(displaySize)
            var rotatedPreviewWidth = width
            var rotatedPreviewHeight = height
            var maxPreviewWidth = displaySize.x
            var maxPreviewHeight = displaySize.y

            if (swappedDimensions) {
                rotatedPreviewWidth = height
                rotatedPreviewHeight = width
                maxPreviewWidth = displaySize.y
                maxPreviewHeight = displaySize.x
            }

            if (maxPreviewWidth > 4096) maxPreviewWidth = 4096
            if (maxPreviewHeight > 4096) maxPreviewHeight = 4096

            val map = characteristics?.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            if (map == null) {
                Toast.makeText(this, PhoneI18n.t("相机不支持"), Toast.LENGTH_SHORT).show()
                finish()
                return
            }

            val largest = Collections.max(
                listOf(*map.getOutputSizes(ImageFormat.JPEG)),
                CompareSizesByArea()
            )

            previewSize = chooseOptimalSize(
                map.getOutputSizes(SurfaceTexture::class.java),
                rotatedPreviewWidth, rotatedPreviewHeight,
                maxPreviewWidth, maxPreviewHeight, largest
            )

            Log.d("QrScan", "openCamera: cameraId=$cameraId, sensorOrientation=$sensorOrientation, " +
                "previewSize=${previewSize!!.width}x${previewSize!!.height}, swappedDimensions=$swappedDimensions, " +
                "displayRotation=$displayRotation, displaySize=${displaySize.x}x${displaySize.y}, front=$facingFront")

            imageReader?.close()
            imageReader = ImageReader.newInstance(previewSize!!.width, previewSize!!.height,
                ImageFormat.YUV_420_888, 4)
            imageReader?.setOnImageAvailableListener(onImageAvailableListener, backgroundHandler)

            configureTransform(width, height)

            manager.openCamera(cameraId!!, stateCallback, backgroundHandler)
        } catch (e: CameraAccessException) {
            e.printStackTrace()
            Toast.makeText(this, PhoneI18n.t("相机访问失败"), Toast.LENGTH_SHORT).show()
            finish()
        } catch (e: SecurityException) {
            e.printStackTrace()
            Toast.makeText(this, PhoneI18n.t("无相机权限"), Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun createPreviewSession() {
        try {
            val texture = previewView.surfaceTexture ?: return
            val ps = previewSize ?: return
            texture.setDefaultBufferSize(ps.width, ps.height)
            val previewSurface = Surface(texture)
            val readerSurface = imageReader?.surface ?: return

            val surfaces = listOf(previewSurface, readerSurface)

            val captureBuilder = cameraDevice?.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)?.apply {
                addTarget(previewSurface)
                addTarget(readerSurface)
                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON_AUTO_FLASH)
            }

            cameraDevice?.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    try {
                        captureBuilder?.build()?.let { session.setRepeatingRequest(it, null, backgroundHandler) }
                    } catch (_: Exception) {}
                    runOnUiThread {
                        configureTransform(previewView.width, previewView.height)
                    }
                }
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    Log.e("QrScan", "Capture session configure failed")
                }
            }, backgroundHandler)
        } catch (e: CameraAccessException) {
            e.printStackTrace()
        }
    }

    private fun closeCamera() {
        try {
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            imageReader?.close()
            imageReader = null
        } catch (_: Exception) {}
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
            backgroundThread = null
            backgroundHandler = null
        } catch (_: InterruptedException) {}
    }

    inner class ScanOverlayView(context: Context) : View(context) {

        private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x66FFFFFF
            style = Paint.Style.STROKE
        }
        private val cornerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFF00C3FF.toInt()
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
        }

        private var scanFrameSize = 0f
        private var scanFrameLeft = 0f
        private var scanFrameTop = 0f
        private var scanFrameRight = 0f
        private var scanFrameBottom = 0f
        private var initialized = false

        private fun updateFrameMetrics() {
            if (width <= 0 || height <= 0) return
            val density = resources.displayMetrics.density
            val minDim = minOf(width, height).toFloat()
            scanFrameSize = minDim * 0.65f
            scanFrameLeft = (width - scanFrameSize) / 2f
            scanFrameTop = (height - scanFrameSize) / 2f
            scanFrameRight = scanFrameLeft + scanFrameSize
            scanFrameBottom = scanFrameTop + scanFrameSize
            borderPaint.strokeWidth = 1f * density
            cornerPaint.strokeWidth = 4f * density
            initialized = true
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            super.onSizeChanged(w, h, oldw, oldh)
            updateFrameMetrics()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            if (!initialized) updateFrameMetrics()
            if (scanFrameSize <= 0f) return

            val w = width.toFloat()
            val h = height.toFloat()
            val density = resources.displayMetrics.density

            bgPaint.color = 0x99000000.toInt()
            bgPaint.style = Paint.Style.FILL
            val path = Path().apply {
                fillType = Path.FillType.EVEN_ODD
                addRect(0f, 0f, w, h, Path.Direction.CW)
                addRect(scanFrameLeft, scanFrameTop, scanFrameRight, scanFrameBottom, Path.Direction.CW)
            }
            canvas.drawPath(path, bgPaint)

            canvas.drawRect(scanFrameLeft, scanFrameTop, scanFrameRight, scanFrameBottom, borderPaint)

            val cornerLen = 28f * density
            val cornerGap = 2f * density

            drawCorner(canvas,
                scanFrameLeft + cornerGap, scanFrameTop + cornerGap,
                scanFrameLeft + cornerGap, scanFrameTop + cornerLen,
                scanFrameLeft + cornerGap, scanFrameTop + cornerGap,
                scanFrameLeft + cornerLen, scanFrameTop + cornerGap)
            drawCorner(canvas,
                scanFrameRight - cornerGap, scanFrameTop + cornerGap,
                scanFrameRight - cornerGap, scanFrameTop + cornerLen,
                scanFrameRight - cornerGap, scanFrameTop + cornerGap,
                scanFrameRight - cornerLen, scanFrameTop + cornerGap)
            drawCorner(canvas,
                scanFrameLeft + cornerGap, scanFrameBottom - cornerGap,
                scanFrameLeft + cornerGap, scanFrameBottom - cornerLen,
                scanFrameLeft + cornerGap, scanFrameBottom - cornerGap,
                scanFrameLeft + cornerLen, scanFrameBottom - cornerGap)
            drawCorner(canvas,
                scanFrameRight - cornerGap, scanFrameBottom - cornerGap,
                scanFrameRight - cornerGap, scanFrameBottom - cornerLen,
                scanFrameRight - cornerGap, scanFrameBottom - cornerGap,
                scanFrameRight - cornerLen, scanFrameBottom - cornerGap)
        }

        private fun drawCorner(canvas: Canvas, x1v: Float, y1v: Float, x2v: Float, y2v: Float,
                                x1h: Float, y1h: Float, x2h: Float, y2h: Float) {
            canvas.drawLine(x1v, y1v, x2v, y2v, cornerPaint)
            canvas.drawLine(x1h, y1h, x2h, y2h, cornerPaint)
        }
    }
}

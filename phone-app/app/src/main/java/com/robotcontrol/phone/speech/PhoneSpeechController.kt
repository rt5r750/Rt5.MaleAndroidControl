package com.robotcontrol.phone.speech

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import com.robotcontrol.phone.PhoneI18n
import com.robotcontrol.phone.data.ApiKeyStore
import java.io.ByteArrayOutputStream
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * phone-app 语音识别控制器（机器人端）。
 *
 * 策略（本地优先、低功耗、省钱）：
 *  1. 用 Android 原生语音识别做「本地轻量识别」（引擎逐级回退：设备端离线 → 系统识别器离线优先
 *     → 系统识别器允许联网），零 MiMo 调用成本；
 *  2. 本地识别文本先过 [VoiceCommandMatcher]（四大模式读音 + 否定词），命中即回调，不联网；
 *  3. 仅当本地识别出「大段文本」且未命中、设置里允许云端、有 API Key 时，才把这段音频交给
 *     [MimoAsrClient]（MiMo ASR）兜底复核；带最小间隔且不允许并发，避免高频请求与浪费钱；
 *  4. 三个本地引擎都不可用时：允许云端则退化为「仅云端」（AudioRecord + 能量端点切句），
 *     否则报「本地语音识别不可用」并自动关闭。
 *
 * 语言：跟随界面语言（BLE 7507 下发）——zh 只识别中文、en 只识别英文。
 */
class PhoneSpeechController(
    private val context: Context,
    private val onModeCommand: (ordinal: Int) -> Unit,
    private val onStatusMessage: (String) -> Unit
) {

    companion object {
        private const val TAG = "PhoneSpeech"
        const val SAMPLE_RATE = 16_000

        /** 环形音频缓冲上限：12 秒（16kHz 单声道 PCM16 ≈ 384KB，远低于 MiMo 10MB base64 上限） */
        private const val MAX_BUFFER_MS = 12_000

        /** 云端兜底门槛：本地识别文本长度（「大段文本」）与音频时长 */
        private const val CLOUD_MIN_CHARS = 4
        private const val CLOUD_MIN_AUDIO_MS = 1_200

        /** 云端调用最小间隔（毫秒），避免高频请求 */
        private const val CLOUD_MIN_INTERVAL_MS = 4_000L

        private const val RESTART_DELAY_MS = 300L

        /** 本地识别连续失败上限：达到即退化（不再每 300ms 无限重启，避免持续耗电） */
        private const val MAX_LOCAL_ERRORS = 3

        /** 仅云端模式的能量端点参数 */
        private const val VAD_FRAME_MS = 100
        private const val VAD_SILENCE_CUT_MS = 800
        private const val VAD_SPEECH_MIN_MS = 1_200
        private const val VAD_RMS_THRESHOLD = 700.0
    }

    @Volatile
    var isActive: Boolean = false
        private set

    private val mainHandler = Handler(Looper.getMainLooper())

    /* ===== 本地识别 ===== */
    /** 本地识别引擎（逐级回退）：设备端离线 → 系统识别器（离线优先）→ 系统识别器（允许联网） */
    private enum class LocalEngine { ON_DEVICE, SYSTEM_OFFLINE, SYSTEM_ONLINE }

    private var recognizer: SpeechRecognizer? = null
    @Volatile private var engine: LocalEngine? = null
    @Volatile private var localRecognizerAvailable = false
    @Volatile private var cloudOnlyMode = false
    private var restartScheduled = false
    /** 本地识别连续错误计数（成功识别一次即清零） */
    private var consecutiveErrors = 0

    /* ===== 音频环形缓冲（供云端兜底使用） ===== */
    private val ringLock = Any()
    private var ring = ByteArray(SAMPLE_RATE * 2 * MAX_BUFFER_MS / 1000)
    private var ringWritePos = 0
    private var ringFilled = 0
    private var audioRecord: AudioRecord? = null
    private var audioThread: Thread? = null
    @Volatile private var capturing = false

    /* ===== 云端节流 ===== */
    @Volatile private var lastCloudCallAt = 0L
    @Volatile private var cloudInFlight = false

    /* ===== 仅云端模式的 VAD 状态 ===== */
    private var vadSpeaking = false
    private var vadSilenceMs = 0
    private var vadSpeechMs = 0
    private var vadSegment: ByteArrayOutputStream? = null

    // ---------------------------------------------------------------------
    // 生命周期
    // ---------------------------------------------------------------------

    /** 开启识别（常态保持，直至 [stop]）。必须在主线程调用。 */
    fun start() {
        if (isActive) return
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            onStatusMessage(PhoneI18n.t("缺少录音权限"))
            return
        }
        isActive = true
        lastCloudCallAt = 0L
        consecutiveErrors = 0
        startAudioCapture()

        if (createLocalRecognizer()) {
            localRecognizerAvailable = true
            cloudOnlyMode = false
            startListening()
            Log.i(TAG, "local recognizer started")
        } else if (isCloudEnabled() && !apiKey().isNullOrEmpty()) {
            localRecognizerAvailable = false
            cloudOnlyMode = true
            Log.i(TAG, "no local recognizer, cloud-only mode")
        } else {
            isActive = false
            stopAudioCapture()
            onStatusMessage(PhoneI18n.t("本地语音识别不可用"))
        }
    }

    /** 关闭识别并释放资源。必须在主线程调用。 */
    fun stop() {
        if (!isActive && recognizer == null && audioRecord == null) return
        isActive = false
        cloudOnlyMode = false
        restartScheduled = false
        mainHandler.removeCallbacksAndMessages(null)
        releaseRecognizer()
        stopAudioCapture()
        resetVad()
        Log.i(TAG, "stopped")
    }

    fun release() = stop()

    // ---------------------------------------------------------------------
    // 本地识别
    // ---------------------------------------------------------------------

    /**
     * 创建本地识别器，从 [from] 指定的引擎起按顺序回退：
     *  - [LocalEngine.ON_DEVICE]（API 31+ 且设备支持）→ 失败落到系统识别器（离线优先）；
     *  - 系统识别器只需 `isRecognitionAvailable` 成立即可创建，离线/联网靠识别 Intent 的
     *    `EXTRA_PREFER_OFFLINE` 区分（见 [startListening]）。
     */
    private fun createLocalRecognizer(from: LocalEngine = LocalEngine.ON_DEVICE): Boolean {
        engine = null
        if (from == LocalEngine.ON_DEVICE && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val onDevice = try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                } else {
                    null
                }
            } catch (e: Exception) {
                Log.w(TAG, "create on-device recognizer failed: ${e.message}")
                null
            }
            if (attachRecognizer(onDevice, LocalEngine.ON_DEVICE)) return true
            return createLocalRecognizer(LocalEngine.SYSTEM_OFFLINE)
        }
        val system = try {
            if (SpeechRecognizer.isRecognitionAvailable(context)) {
                SpeechRecognizer.createSpeechRecognizer(context)
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "create system recognizer failed: ${e.message}")
            null
        }
        return attachRecognizer(system, if (from == LocalEngine.ON_DEVICE) LocalEngine.SYSTEM_OFFLINE else from)
    }

    /** 挂接识别器实例并记录引擎类型；实例为空表示该引擎不可用。 */
    private fun attachRecognizer(created: SpeechRecognizer?, kind: LocalEngine): Boolean {
        if (created == null) return false
        created.setRecognitionListener(listener)
        recognizer = created
        engine = kind
        return true
    }

    private fun releaseRecognizer() {
        runCatching { recognizer?.cancel() }
        runCatching { recognizer?.destroy() }
        recognizer = null
        engine = null
    }

    private fun startListening() {
        val r = recognizer ?: return
        if (!isActive) return
        resetRing()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (currentLang() == "en") "en-US" else "zh-CN")
            /* 离线优先：仅最后一级引擎（系统识别器允许联网）才放开，其余一律要求本地识别 */
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, engine != LocalEngine.SYSTEM_ONLINE)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L)
        }
        try {
            r.startListening(intent)
        } catch (e: Exception) {
            Log.w(TAG, "startListening failed: ${e.message}")
            scheduleRestart()
        }
    }

    private fun scheduleRestart() {
        if (!isActive || restartScheduled) return
        restartScheduled = true
        mainHandler.postDelayed({
            restartScheduled = false
            if (isActive && !cloudOnlyMode) startListening()
        }, RESTART_DELAY_MS)
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            resetRing()
        }

        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}

        override fun onError(error: Int) {
            when (error) {
                /* 录音权限被撤销：直接停并提示（继续重试没有意义） */
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                    Log.w(TAG, "recognizer error $error, stop")
                    stop()
                    onStatusMessage(PhoneI18n.t("本地语音识别不可用"))
                }
                /* 用户没说话/超时属正常态，不计入退化计数（否则安静环境会误判为不可用） */
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                    scheduleRestart()
                }
                /* 其余（含偶发的 ERROR_CLIENT 调用竞态）计入退化计数，走逐级回退而不是直接判死 */
                else -> {
                    consecutiveErrors++
                    if (consecutiveErrors >= MAX_LOCAL_ERRORS) {
                        degradeLocalRecognizer()
                    } else {
                        scheduleRestart()
                    }
                }
            }
        }

        override fun onResults(results: Bundle?) {
            /* 只有真正拿到识别结果才算"服务可用"，清零计数（onReadyForSpeech 不清零：
               能 ready 但持续报错的服务同样应被退化，不能无限 300ms 重启耗电） */
            consecutiveErrors = 0
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            handleLocalText(text)
            scheduleRestart()
        }

        override fun onPartialResults(partialResults: Bundle?) {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    /**
     * 本地识别连续失败（设备无识别服务、离线语言包缺失、服务被系统禁用等）后的逐级退化：
     * ① 设备端离线识别失败 → 回退系统识别器（离线优先）；
     * ② 系统识别器离线优先仍失败（典型：未下载离线语言包）→ 同一识别器改为允许联网；
     * ③ 联网级也失败 → 有云端条件（开关开启 + 有 API Key）时退化为「仅云端」，否则关闭识别并提示。
     * 目的：既不让「一次离线包缺失」等同于功能不可用，也不以 300ms 周期无限重启识别器（低功耗要求）。
     */
    private fun degradeLocalRecognizer() {
        Log.w(TAG, "local recognizer failed $consecutiveErrors times, engine=$engine")
        val next = when (engine) {
            LocalEngine.ON_DEVICE -> LocalEngine.SYSTEM_OFFLINE
            LocalEngine.SYSTEM_OFFLINE -> LocalEngine.SYSTEM_ONLINE
            else -> null
        }
        releaseRecognizer()
        localRecognizerAvailable = false
        restartScheduled = false
        consecutiveErrors = 0
        resetRing()
        if (next != null && createLocalRecognizer(next)) {
            localRecognizerAvailable = true
            cloudOnlyMode = false
            Log.i(TAG, "fell back to $next")
            startListening()
            return
        }
        if (isCloudEnabled() && !apiKey().isNullOrEmpty()) {
            cloudOnlyMode = true
            Log.i(TAG, "degraded to cloud-only mode")
        } else {
            stop()
            onStatusMessage(PhoneI18n.t("本地语音识别不可用"))
        }
    }

    /** 本地识别结果处理：命中即回调；否则按门槛走云端兜底。 */
    private fun handleLocalText(text: String) {
        val lang = currentLang()
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return

        val local = VoiceCommandMatcher.match(trimmed, lang)
        if (local != null) {
            Log.i(TAG, "local match ordinal=$local text=$trimmed")
            fireModeCommand(local)
            resetRing()
            return
        }

        // 云端兜底：只有「大段文本」且开关允许、有 Key、音频足够长、未并发、未超频时才发
        if (!isCloudEnabled()) return
        val key = apiKey().orEmpty()
        if (key.isEmpty()) return
        if (trimmed.length < CLOUD_MIN_CHARS) return
        val durationMs = ringDurationMs()
        if (durationMs < CLOUD_MIN_AUDIO_MS) return
        val now = System.currentTimeMillis()
        if (cloudInFlight || now - lastCloudCallAt < CLOUD_MIN_INTERVAL_MS) return

        val pcm = snapshotRing()
        resetRing()
        lastCloudCallAt = now
        cloudInFlight = true
        Log.i(TAG, "cloud fallback, textLen=${trimmed.length}, audioMs=$durationMs")
        MimoAsrClient.recognize(pcm, SAMPLE_RATE, lang, key) { result ->
            cloudInFlight = false
            result.onSuccess { cloudText ->
                val ordinal = VoiceCommandMatcher.match(cloudText, lang)
                if (ordinal != null) {
                    Log.i(TAG, "cloud match ordinal=$ordinal text=$cloudText")
                    fireModeCommand(ordinal)
                }
            }.onFailure { Log.w(TAG, "cloud asr failed: ${it.message}") }
        }
    }

    private fun fireModeCommand(ordinal: Int) {
        mainHandler.post { onModeCommand(ordinal) }
    }

    // ---------------------------------------------------------------------
    // 音频采集（环形缓冲）
    // ---------------------------------------------------------------------

    private fun startAudioCapture() {
        if (capturing) return
        val minBuf = AudioRecord.getMinBufferSize(
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuf <= 0) return
        val bufSize = maxOf(minBuf, SAMPLE_RATE / 5 * 2)
        val record = try {
            AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufSize
            )
        } catch (e: Exception) {
            Log.w(TAG, "AudioRecord create failed: ${e.message}")
            null
        } ?: return
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            return
        }
        audioRecord = record
        capturing = true
        runCatching { record.startRecording() }

        val chunkBytes = SAMPLE_RATE / 1000 * 2 * VAD_FRAME_MS // 每帧 ~100ms
        audioThread = Thread({
            val chunk = ByteArray(chunkBytes)
            while (capturing) {
                val read = try {
                    record.read(chunk, 0, chunk.size)
                } catch (e: Exception) {
                    -1
                }
                if (read > 0) {
                    appendRing(chunk, read)
                    if (cloudOnlyMode) vadFeed(chunk, read)
                }
            }
        }, "PhoneSpeechAudio").apply { isDaemon = true }
        audioThread?.start()
    }

    private fun stopAudioCapture() {
        capturing = false
        runCatching { audioRecord?.stop() }
        runCatching { audioRecord?.release() }
        audioRecord = null
        audioThread = null
        synchronized(ringLock) {
            ringWritePos = 0
            ringFilled = 0
        }
    }

    private fun appendRing(data: ByteArray, len: Int) {
        synchronized(ringLock) {
            var src = 0
            var remaining = len
            while (remaining > 0) {
                val space = ring.size - ringWritePos
                val n = minOf(space, remaining)
                System.arraycopy(data, src, ring, ringWritePos, n)
                ringWritePos = (ringWritePos + n) % ring.size
                src += n
                remaining -= n
            }
            ringFilled = minOf(ring.size, ringFilled + len)
        }
    }

    private fun resetRing() {
        synchronized(ringLock) {
            ringWritePos = 0
            ringFilled = 0
        }
    }

    private fun ringDurationMs(): Long {
        val filled = synchronized(ringLock) { ringFilled }
        return filled.toLong() * 1000 / (SAMPLE_RATE * 2)
    }

    private fun snapshotRing(): ByteArray {
        synchronized(ringLock) {
            val filled = ringFilled
            if (filled <= 0) return ByteArray(0)
            val out = ByteArray(filled)
            val start = if (filled == ring.size) ringWritePos else 0
            for (i in 0 until filled) {
                out[i] = ring[(start + i) % ring.size]
            }
            return out
        }
    }

    // ---------------------------------------------------------------------
    // 仅云端模式：能量端点切句（本地识别不可用时的退化路径）
    // ---------------------------------------------------------------------

    private fun resetVad() {
        vadSpeaking = false
        vadSilenceMs = 0
        vadSpeechMs = 0
        vadSegment = null
    }

    private fun vadFeed(data: ByteArray, len: Int) {
        val rms = rms(data, len)
        if (rms >= VAD_RMS_THRESHOLD) {
            if (!vadSpeaking) {
                vadSpeaking = true
                vadSegment = ByteArrayOutputStream()
                vadSpeechMs = 0
            }
            vadSilenceMs = 0
            vadSpeechMs += VAD_FRAME_MS
            vadSegment?.write(data, 0, len)
        } else if (vadSpeaking) {
            vadSilenceMs += VAD_FRAME_MS
            vadSegment?.write(data, 0, len)
            if (vadSilenceMs >= VAD_SILENCE_CUT_MS) {
                cutVadSegment()
            }
        }
    }

    private fun cutVadSegment() {
        val segment = vadSegment?.toByteArray() ?: ByteArray(0)
        val speechMs = vadSpeechMs
        val speakingTail = vadSpeaking
        resetVad()
        if (!speakingTail || segment.isEmpty()) return
        if (speechMs < VAD_SPEECH_MIN_MS) return
        if (!isCloudEnabled()) return
        val key = apiKey().orEmpty()
        if (key.isEmpty()) return
        val now = System.currentTimeMillis()
        if (cloudInFlight || now - lastCloudCallAt < CLOUD_MIN_INTERVAL_MS) return
        lastCloudCallAt = now
        cloudInFlight = true
        val lang = currentLang()
        MimoAsrClient.recognize(segment, SAMPLE_RATE, lang, key) { result ->
            cloudInFlight = false
            result.onSuccess { cloudText ->
                val ordinal = VoiceCommandMatcher.match(cloudText, lang)
                if (ordinal != null) fireModeCommand(ordinal)
            }.onFailure { Log.w(TAG, "cloud-only asr failed: ${it.message}") }
        }
    }

    private fun rms(data: ByteArray, len: Int): Double {
        if (len < 2) return 0.0
        var sum = 0.0
        var i = 0
        while (i + 1 < len) {
            val sample = ((data[i + 1].toInt() shl 8) or (data[i].toInt() and 0xFF)).toShort().toInt()
            sum += (sample * sample).toDouble()
            i += 2
        }
        val count = len / 2
        if (count == 0) return 0.0
        return sqrt(sum / count).let { if (abs(it) < 1e-6) 0.0 else it }
    }

    // ---------------------------------------------------------------------
    // 配置读取
    // ---------------------------------------------------------------------

    private fun currentLang(): String = if (PhoneI18n.getLang() == "en") "en" else "zh"

    private fun isCloudEnabled(): Boolean = runCatching { ApiKeyStore.isAsrCloudEnabled() }.getOrDefault(true)

    private fun apiKey(): String? = runCatching { ApiKeyStore.getApiKey() }.getOrNull()
}

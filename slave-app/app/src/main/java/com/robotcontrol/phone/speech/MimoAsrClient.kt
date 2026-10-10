package com.robotcontrol.phone.speech

import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * MiMo 语音识别（ASR）轻量客户端。
 *
 * - 与 TTS 共用同一 API Key（ApiKeyStore）。
 * - 仅在「本地识别不清楚」时由 PhoneSpeechController 触发（云端兜底），避免高频请求与浪费。
 * - 接口：POST https://api.xiaomimimo.com/v1/chat/completions
 *   body: { model: "mimo-v2.5-asr", messages:[{role:"user",content:[{type:"input_audio",
 *           input_audio:{data:"data:audio/wav;base64,..."}}]}], asr_options:{language} }
 *   响应文本：choices[0].message.content
 */
object MimoAsrClient {

    private const val TAG = "MimoAsr"
    private const val API_URL = "https://api.xiaomimimo.com/v1/chat/completions"
    private const val MODEL = "mimo-v2.5-asr"
    private const val CONNECT_TIMEOUT_MS = 15000
    private const val READ_TIMEOUT_MS = 60000

    private val executor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "MimoAsrThread").apply { isDaemon = true }
    }

    /**
     * 异步识别一段 PCM16 音频。
     * @param pcm16 单声道 PCM16 原始字节
     * @param sampleRate 采样率（Hz）
     * @param lang 语种：zh / en（其余按 auto）
     * @param apiKey MiMo API Key
     * @param callback 主线程无关的回调（调用方自行切换线程）
     */
    fun recognize(
        pcm16: ByteArray,
        sampleRate: Int,
        lang: String,
        apiKey: String,
        callback: (Result<String>) -> Unit
    ) {
        if (pcm16.isEmpty() || apiKey.isBlank()) {
            callback(Result.failure(IllegalArgumentException("empty audio or api key")))
            return
        }
        executor.execute {
            val result = runCatching { request(pcm16, sampleRate, lang, apiKey) }
            callback(result)
        }
    }

    private fun request(pcm16: ByteArray, sampleRate: Int, lang: String, apiKey: String): String {
        val wav = pcm16ToWav(pcm16, sampleRate)
        val dataUrl = "data:audio/wav;base64," + Base64.encodeToString(wav, Base64.NO_WRAP)

        val audioItem = JSONObject().apply {
            put("type", "input_audio")
            put("input_audio", JSONObject().put("data", dataUrl))
        }
        val message = JSONObject().apply {
            put("role", "user")
            put("content", JSONArray().put(audioItem))
        }
        val body = JSONObject().apply {
            put("model", MODEL)
            put("messages", JSONArray().put(message))
            put(
                "asr_options",
                JSONObject().put("language", if (lang == "en") "en" else "zh")
            )
        }

        val conn = (URL(API_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("api-key", apiKey)
        }

        try {
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            /* Key 成败标志（v1.11.0 同步判定用）：仅鉴权结果落标志
               ——401/403 记 fail，成功记 ok，网络类/服务端错误不改写 */
            if (code == 401 || code == 403) {
                com.robotcontrol.phone.data.ApiKeyStore.recordKeyResult(apiKey, false)
            }
            if (code !in 200..299) {
                Log.w(TAG, "ASR HTTP $code: ${text.take(300)}")
                throw IllegalStateException("HTTP $code")
            }
            val json = JSONObject(text)
            if (json.has("error") && !json.isNull("error")) {
                throw IllegalStateException(json.opt("error").toString().take(300))
            }
            val content = json.optJSONArray("choices")
                ?.optJSONObject(0)
                ?.optJSONObject("message")
                ?.optString("content")
                .orEmpty()
            if (content.isEmpty()) throw IllegalStateException("empty transcription")
            com.robotcontrol.phone.data.ApiKeyStore.recordKeyResult(apiKey, true)
            return content
        } finally {
            runCatching { conn.disconnect() }
        }
    }

    /** 给裸 PCM16 数据加 44 字节 WAV 头（MiMo ASR 仅接受 wav/mp3）。 */
    private fun pcm16ToWav(pcm16: ByteArray, sampleRate: Int): ByteArray {
        val channels = 1
        val bitsPerSample = 16
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataSize = pcm16.size
        val out = ByteArrayOutputStream(44 + dataSize)
        fun writeAscii(s: String) = out.write(s.toByteArray(Charsets.US_ASCII))
        fun writeIntLE(v: Int) {
            out.write(v and 0xFF)
            out.write((v shr 8) and 0xFF)
            out.write((v shr 16) and 0xFF)
            out.write((v shr 24) and 0xFF)
        }
        fun writeShortLE(v: Int) {
            out.write(v and 0xFF)
            out.write((v shr 8) and 0xFF)
        }
        writeAscii("RIFF")
        writeIntLE(36 + dataSize)
        writeAscii("WAVE")
        writeAscii("fmt ")
        writeIntLE(16)
        writeShortLE(1) // PCM
        writeShortLE(channels)
        writeIntLE(sampleRate)
        writeIntLE(byteRate)
        writeShortLE(blockAlign)
        writeShortLE(bitsPerSample)
        writeAscii("data")
        writeIntLE(dataSize)
        out.write(pcm16)
        return out.toByteArray()
    }
}

(function(global) {
    'use strict';

    var ENGINE_VOICEDESIGN = 'voicedesign';
    var ENGINE_BIRCH = 'birch';
    var API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';

    var VOICEDESIGN_PROMPT = '成熟男性30-40岁，无情感机械音，普通话标准无口音，金属感冰冷合成声线，机械冷漠的AI风格，语速缓慢均匀，音量平稳无起伏，工业机器人播报场景。';
    var STYLE_PROMPT = '无情感机械音，普通话标准无口音，金属感冰冷合成声线，机械冷漠的AI风格，语速缓慢均匀，音量平稳无起伏，工业机器人播报场景';

    // 音频缓存配置
    var CACHE_PREFIX = 'ttsCache_';
    var CACHE_MAX_ENTRIES = 15;  // 最大缓存条数

    // 异步回调注册表（用于 Native MediaPlayer 播放完成回调）
    window.__ttsCallbacks = window.__ttsCallbacks || {};
    var _ttsCbCounter = 0;

    /**
     * 由 Native 层通过 evaluateJavascript 调用，通知音频播放结果。
     * @param {string} cbId - 回调 ID
     * @param {string} resultJson - JSON 字符串，{"ok":true} 或 {"ok":false,"error":"..."}
     */
    window.__ttsOnComplete = function(cbId, resultJson) {
        var cb = window.__ttsCallbacks[cbId];
        if (!cb) return;
        try {
            var result = JSON.parse(resultJson);
            if (result.ok) {
                cb.resolve();
            } else {
                cb.reject(new Error(result.error || 'Native playback failed'));
            }
        } catch (e) {
            cb.reject(e);
        }
        delete window.__ttsCallbacks[cbId];
    };

    // 异步回调注册表（用于 Native mimoFetchAsync HTTP 请求完成回调）
    window.__mimoFetchCallbacks = window.__mimoFetchCallbacks || {};
    var _mimoCbCounter = 0;

    /**
     * 由 Native 层通过 evaluateJavascript 调用，通知 mimoFetchAsync 请求已完成。
     * 仅接收 cbId（不传 resultJson，避免 evaluateJavascript 传大响应超 Binder 1MB 限制）。
     * JS 通过同步 Android.getMimoFetchResult(cbId) 拉取完整结果（JNI 传递，无大小限制）。
     * @param {string} cbId - 回调 ID
     */
    window.__mimoFetchCallback = function(cbId) {
        var cb = window.__mimoFetchCallbacks[cbId];
        if (!cb) return;
        try {
            var resultJson = global.Android.getMimoFetchResult(cbId);
            if (!resultJson) {
                cb.reject(new Error('Empty result from getMimoFetchResult'));
                delete window.__mimoFetchCallbacks[cbId];
                return;
            }
            var data = JSON.parse(resultJson);
            if (data.error) {
                cb.reject(new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error).substring(0, 300)));
            } else if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.audio || !data.choices[0].message.audio.data) {
                cb.reject(new Error('Invalid response - no audio data'));
            } else {
                log('mimoFetchAsync callback success, audio len=' + data.choices[0].message.audio.data.length);
                cb.resolve(data);
            }
        } catch (e) {
            error('Failed to process mimoFetchAsync callback:', e.message);
            cb.reject(e);
        }
        delete window.__mimoFetchCallbacks[cbId];
    };

    var DEBUG = false;
    function log() {
        if (!DEBUG) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[MimoTTS]');
        console.log.apply(console, args);
    }
    function warn() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[MimoTTS][WARN]');
        console.warn.apply(console, args);
    }
    function error() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[MimoTTS][ERROR]');
        console.error.apply(console, args);
    }

    // 简单字符串哈希（用于生成缓存key）
    function hashString(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // API Key 清洗：去除首尾空白与成对引号（粘贴/同步时可能带入 "sk-..."）
    function normalizeApiKey(key) {
        var k = String(key || '').trim();
        if (k.length >= 2 &&
            ((k.charAt(0) === '"' && k.charAt(k.length - 1) === '"') ||
             (k.charAt(0) === "'" && k.charAt(k.length - 1) === "'"))) {
            k = k.slice(1, -1).trim();
        }
        return k;
    }

    // 生成缓存key
    function getCacheKey(engine, text) {
        return CACHE_PREFIX + engine + '_' + hashString(text);
    }

    // 清除所有TTS缓存（页面加载时调用，清理上次会话残留）
    MimoTTSClient.clearAllCache = function() {
        try {
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(CACHE_PREFIX) === 0) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
            if (keysToRemove.length > 0) {
                log('Cleared ' + keysToRemove.length + ' cached audio entries from previous session');
            }
        } catch (e) {
            warn('Failed to clear TTS cache:', e.message);
        }
    };

    // 清除最早的缓存条目（超出上限时调用）
    function evictOldestCache() {
        try {
            var entries = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(CACHE_PREFIX) === 0) {
                    var val = localStorage.getItem(key);
                    if (val) {
                        try {
                            var parsed = JSON.parse(val);
                            entries.push({ key: key, ts: parsed.ts || 0 });
                        } catch (e) {}
                    }
                }
            }
            if (entries.length >= CACHE_MAX_ENTRIES) {
                entries.sort(function(a, b) { return a.ts - b.ts; });
                var toRemove = entries.length - CACHE_MAX_ENTRIES + 1;
                for (var j = 0; j < toRemove; j++) {
                    localStorage.removeItem(entries[j].key);
                }
                log('Evicted ' + toRemove + ' oldest cache entries');
            }
        } catch (e) {
            warn('Failed to evict cache:', e.message);
        }
    }

    function MimoTTSClient(initialApiKey) {
        this.apiKey = normalizeApiKey(initialApiKey);
        this.currentEngine = ENGINE_BIRCH;
        this.isAudioPlaying = false;
        log('Client initialized, engine=' + this.currentEngine + ', key=' + (this.apiKey ? 'set' : 'empty'));
    }

    MimoTTSClient.prototype.setApiKey = function(key) {
        this.apiKey = normalizeApiKey(key);
        log('API key updated, key=' + (this.apiKey ? 'set(' + this.apiKey.substring(0, 8) + '...)' : 'empty'));
    };

    MimoTTSClient.prototype.getApiKey = function() {
        return this.apiKey;
    };

    MimoTTSClient.prototype.setEngine = function(engineId) {
        if (engineId === ENGINE_VOICEDESIGN || engineId === ENGINE_BIRCH) {
            this.currentEngine = engineId;
            log('Engine switched to: ' + engineId);
        } else {
            warn('Unknown engine: ' + engineId + ', keeping current: ' + this.currentEngine);
        }
    };

    MimoTTSClient.prototype.getEngine = function() {
        return this.currentEngine;
    };

    MimoTTSClient.prototype.getAvailableEngines = function() {
        return [
            { id: ENGINE_BIRCH, label: '白桦音色' },
            { id: ENGINE_VOICEDESIGN, label: '音色设计' }
        ];
    };

    MimoTTSClient.prototype._callMimoApi = function(body) {
        var self = this;
        if (!this.apiKey) {
            return Promise.reject(new Error('API Key is not set. Please enter MiMo API Key in settings.'));
        }

        log('Calling MiMo API, model=' + body.model + ', key=' + this.apiKey.substring(0, 8) + '...');

        var fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'api-key': this.apiKey
            },
            body: JSON.stringify(body)
        };

        // 优先使用浏览器原生 fetch（异步非阻塞）
        var directFetchPromise = fetch(API_URL, fetchOptions).then(function(response) {
            log('Direct fetch response status:', response.status);
            if (!response.ok) {
                return response.text().then(function(errText) {
                    error('HTTP error ' + response.status + ':', errText.substring(0, 500));
                    throw new Error('HTTP ' + response.status + ': ' + errText.substring(0, 300));
                });
            }
            return response.json();
        }).then(function(data) {
            if (data.error) {
                error('MiMo API error (direct):', typeof data.error === 'string' ? data.error : JSON.stringify(data.error).substring(0, 300));
                throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error).substring(0, 300));
            }
            if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.audio || !data.choices[0].message.audio.data) {
                error('Invalid response (direct):', JSON.stringify(data).substring(0, 500));
                throw new Error('Invalid response - no audio data');
            }
            log('Direct API call success, audio len=' + data.choices[0].message.audio.data.length);
            return data;
        });

        // 仅当原生 fetch 失败时，才回退到 Android.mimoFetchAsync（异步非阻塞回调模式）
        if (global.Android && typeof global.Android.mimoFetchAsync === 'function') {
            return directFetchPromise.catch(function(directErr) {
                warn('Direct fetch failed, trying Android.mimoFetchAsync:', directErr.message);
                return new Promise(function(resolve, reject) {
                    var bodyStr = JSON.stringify(body);
                    var cbId = 'mimo_' + (++_mimoCbCounter) + '_' + Date.now();
                    log('Using Android.mimoFetchAsync fallback, cbId=' + cbId + ', bodyLen=' + bodyStr.length);
                    window.__mimoFetchCallbacks[cbId] = {
                        resolve: resolve,
                        reject: reject
                    };
                    try {
                        global.Android.mimoFetchAsync(bodyStr, cbId);
                    } catch (e) {
                        error('Exception calling Android.mimoFetchAsync:', e.message);
                        delete window.__mimoFetchCallbacks[cbId];
                        reject(e);
                    }
                });
            });
        }

        log('Using direct fetch only (no Android.mimoFetchAsync available)');
        return directFetchPromise;
    };

    MimoTTSClient.prototype._playBase64Audio = function(base64Data, mimeType) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                var mime = mimeType || 'audio/wav';
                log('Playing audio, base64Len=' + base64Data.length + ', mime=' + mime);

                // 优先使用 Native MediaPlayer（异步回调，非阻塞，解决 WebView Blob URL 静默失败）
                if (global.Android && typeof global.Android.playAudioBase64 === 'function') {
                    var cbId = 'tts_' + (++_ttsCbCounter) + '_' + Date.now();
                    window.__ttsCallbacks[cbId] = {
                        resolve: function() {
                            self.isAudioPlaying = false;
                            resolve();
                        },
                        reject: function(err) {
                            self.isAudioPlaying = false;
                            reject(err);
                        }
                    };
                    self.isAudioPlaying = true;
                    log('Dispatching to native Android.playAudioBase64, cbId=' + cbId);
                    global.Android.playAudioBase64(base64Data, mime, cbId);
                    return;
                }

                // 浏览器降级路径：Blob URL + Audio 元素
                log('Using browser Audio element fallback');
                var audioBytes = atob(base64Data);
                var audioArray = new Uint8Array(audioBytes.length);
                for (var i = 0; i < audioBytes.length; i++) {
                    audioArray[i] = audioBytes.charCodeAt(i);
                }
                var audioBlob = new Blob([audioArray], { type: mime });
                var audioUrl = URL.createObjectURL(audioBlob);
                var audio = new Audio(audioUrl);
                self.isAudioPlaying = true;
                audio.onended = function() {
                    self.isAudioPlaying = false;
                    URL.revokeObjectURL(audioUrl);
                    log('Audio playback finished');
                    resolve();
                };
                audio.onerror = function(e) {
                    self.isAudioPlaying = false;
                    URL.revokeObjectURL(audioUrl);
                    error('Audio playback error');
                    reject(new Error('Audio playback error'));
                };
                var playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(function(err) {
                        self.isAudioPlaying = false;
                        URL.revokeObjectURL(audioUrl);
                        error('audio.play() rejected:', err.message);
                        reject(err);
                    });
                }
            } catch (e) {
                self.isAudioPlaying = false;
                error('Exception in _playBase64Audio:', e.message);
                reject(e);
            }
        });
    };

    // 从缓存获取音频
    MimoTTSClient.prototype._getCachedAudio = function(engine, text) {
        try {
            var key = getCacheKey(engine, text);
            var val = localStorage.getItem(key);
            if (val) {
                var parsed = JSON.parse(val);
                if (parsed && parsed.audio) {
                    log('Cache HIT, key=' + key + ', audioLen=' + parsed.audio.length);
                    return parsed;
                }
            }
        } catch (e) {
            warn('Failed to read cache:', e.message);
        }
        return null;
    };

    // 保存音频到缓存
    MimoTTSClient.prototype._setCachedAudio = function(engine, text, audioBase64, mime) {
        try {
            evictOldestCache();
            var key = getCacheKey(engine, text);
            var entry = {
                audio: audioBase64,
                mime: mime || 'audio/wav',
                ts: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(entry));
            log('Cache SET, key=' + key + ', audioLen=' + audioBase64.length);
        } catch (e) {
            // localStorage可能空间不足，清除所有缓存后重试一次
            if (e.name === 'QuotaExceededError') {
                warn('localStorage quota exceeded, clearing all TTS cache and retrying');
                MimoTTSClient.clearAllCache();
                try {
                    var key2 = getCacheKey(engine, text);
                    var entry2 = { audio: audioBase64, mime: mime || 'audio/wav', ts: Date.now() };
                    localStorage.setItem(key2, JSON.stringify(entry2));
                    log('Cache SET (after clear), key=' + key2);
                } catch (e2) {
                    warn('Cache set failed even after clear:', e2.message);
                }
            } else {
                warn('Failed to set cache:', e.message);
            }
        }
    };

    // 合成并播放（带缓存）
    MimoTTSClient.prototype._synthesizeAndPlay = function(engine, text, buildBody) {
        var self = this;
        // 1. 先查缓存
        var cached = self._getCachedAudio(engine, text);
        if (cached) {
            log('Playing cached audio (no network call)');
            return self._playBase64Audio(cached.audio, cached.mime);
        }
        // 2. 缓存未命中，调用API
        var body = buildBody();
        return self._callMimoApi(body).then(function(data) {
            var audioBase64 = data.choices[0].message.audio.data;
            // 3. 先启动播放（playAudioBase64 立即返回，不阻塞）
            var playPromise = self._playBase64Audio(audioBase64, 'audio/wav');
            // 4. 延迟写入缓存到下一个 tick，避免阻塞播放启动
            setTimeout(function() {
                self._setCachedAudio(engine, text, audioBase64, 'audio/wav');
            }, 0);
            return playPromise;
        });
    };

    MimoTTSClient.prototype.synthesizeVoiceDesign = function(text) {
        log('synthesizeVoiceDesign, text=' + text.substring(0, 30) + '...');
        var self = this;
        return self._synthesizeAndPlay(ENGINE_VOICEDESIGN, text, function() {
            return {
                model: 'mimo-v2.5-tts-voicedesign',
                messages: [
                    { role: 'user', content: VOICEDESIGN_PROMPT },
                    { role: 'assistant', content: text }
                ],
                audio: { format: 'wav' }
            };
        });
    };

    MimoTTSClient.prototype.synthesizeBirch = function(text) {
        log('synthesizeBirch (白桦), text=' + text.substring(0, 30) + '...');
        var self = this;
        return self._synthesizeAndPlay(ENGINE_BIRCH, text, function() {
            return {
                model: 'mimo-v2.5-tts',
                messages: [
                    { role: 'user', content: STYLE_PROMPT },
                    { role: 'assistant', content: text }
                ],
                audio: {
                    format: 'wav',
                    voice: '白桦'
                }
            };
        });
    };

    MimoTTSClient.prototype.speak = function(text, engine) {
        var targetEngine = engine || this.currentEngine;
        var self = this;
        var fn;
        log('speak() called, engine=' + targetEngine + ', text=' + String(text).substring(0, 40));
        if (targetEngine === ENGINE_VOICEDESIGN) {
            fn = this.synthesizeVoiceDesign;
        } else if (targetEngine === ENGINE_BIRCH) {
            fn = this.synthesizeBirch;
        } else {
            // 未知引擎，降级到白桦
            warn('Unknown engine: ' + targetEngine + ', falling back to birch');
            targetEngine = ENGINE_BIRCH;
            fn = this.synthesizeBirch;
        }
        return fn.call(this, text).catch(function(err) {
            warn('Engine ' + targetEngine + ' failed:', err.message);
            throw err;
        });
    };

    MimoTTSClient.prototype.stop = function() {
        log('stop() called');
        // 清除所有未完成的 Native 回调
        for (var key in window.__ttsCallbacks) {
            if (window.__ttsCallbacks.hasOwnProperty(key)) {
                try { window.__ttsCallbacks[key].reject(new Error('stopped')); } catch (_) {}
                delete window.__ttsCallbacks[key];
            }
        }
        try {
            if (global.Android && typeof global.Android.stopAudio === 'function') {
                global.Android.stopAudio();
            }
        } catch (e) {
            warn('stopAudio failed:', e.message);
        }
    };

    MimoTTSClient.ENGINE_VOICEDESIGN = ENGINE_VOICEDESIGN;
    MimoTTSClient.ENGINE_BIRCH = ENGINE_BIRCH;

    global.MimoTTSClient = MimoTTSClient;

})(typeof window !== 'undefined' ? window : this);

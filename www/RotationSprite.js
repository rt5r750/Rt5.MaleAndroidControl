(function (global) {
  'use strict';

  /* 精灵图配置：与 design/launcher-assets/rotation-sprites.json 一致。
     运行时优先 XHR 加载 JSON（file:// 下兼容），失败时使用内嵌兜底常量。 */
  var FALLBACK_CONFIG = {
    frameCount: 56,
    cols: 11,
    frameWidth: 216,
    frameHeight: 504,
    fps: 30,
    loop: true,
    frontFrame: 0
  };

  var STATE = {
    IDLE: 'idle',
    CONNECTING: 'connecting',
    WAIT_FRONT_AFTER_CONNECT: 'wait_front_connect',
    PAUSE_AFTER_CONNECT: 'pause_connect',
    MORPH_IN: 'morph_in',
    CONNECTED: 'connected',
    WAIT_FRONT_AFTER_DISCONNECT: 'wait_front_disconnect',
    PAUSE_AFTER_DISCONNECT: 'pause_disconnect',
    MORPH_OUT: 'morph_out'
  };

  var MORPH_MS = 500;
  var PAUSE_MS = 320;
  var CONNECTED_HOLD_MS = 600;

  var CONFIG = FALLBACK_CONFIG;
  var FRAME_MS = 1000 / CONFIG.fps;

  var modalCanvas = null;
  var islandCanvas = null;
  var huimoImg = null;
  var colorImg = null;
  var spritesReady = false;
  var imagesRequested = false;

  var currentState = STATE.IDLE;
  var currentVariant = 'huimo';
  var currentFrame = 0;
  var morphProgress = 0;
  var stateTimer = 0;
  var settleAccum = 0;
  var accumulator = 0;
  var connectedHoldMs = 0;
  var idleDrift = false;

  var modalVisible = false;
  var islandVisible = false;
  var rafId = null;
  var lastTs = 0;

  function cloneConfig(src) {
    return {
      frameCount: src.frameCount || 56,
      cols: src.cols || 11,
      frameWidth: src.frameWidth || 216,
      frameHeight: src.frameHeight || 504,
      fps: src.fps || 30,
      loop: src.loop !== false,
      frontFrame: typeof src.frontFrame === 'number' ? src.frontFrame : 0
    };
  }

  function loadConfig(cb) {
    var done = false;
    function finish(cfg) {
      if (done) return;
      done = true;
      cb(cfg);
    }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'sprites/rotation-sprites.json', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            var parsed = JSON.parse(xhr.responseText);
            if (parsed && parsed.frameCount && parsed.cols && parsed.frameWidth && parsed.frameHeight) {
              finish(cloneConfig(parsed));
              return;
            }
          } catch (e) { /* fallthrough */ }
        }
        finish(cloneConfig(FALLBACK_CONFIG));
      };
      xhr.onerror = function () { finish(cloneConfig(FALLBACK_CONFIG)); };
      xhr.send(null);
    } catch (e) {
      finish(cloneConfig(FALLBACK_CONFIG));
    }
  }

  function loadImages() {
    var urls = ['sprites/rotation-huimo-sprite.png', 'sprites/rotation-color-sprite.png'];
    var remain = urls.length;
    urls.forEach(function (url, i) {
      var img = new Image();
      img.onload = function () {
        if (i === 0) huimoImg = img;
        else colorImg = img;
        remain--;
        if (remain === 0) {
          spritesReady = true;
          ensureLoop();
        }
      };
      img.onerror = function () {
        remain--;
        if (remain === 0) {
          spritesReady = true;
          ensureLoop();
        }
      };
      img.src = url;
    });
  }

  /* 精灵图（两张 PNG 共约 7.6MB）按需加载：首次 showModal/showIsland 或 warmup() 时才拉取，
     避免弱网下首屏被大图阻塞；未就绪时 canvas 保持空白、动画自动延迟启动（绘制全有判空守卫） */
  function requestImages() {
    if (imagesRequested) return;
    imagesRequested = true;
    loadConfig(function (cfg) {
      CONFIG = cfg;
      FRAME_MS = 1000 / cfg.fps;
      loadImages();
    });
  }

  /* 登录后自适应预热：仅全量模式（window.__rcFullMode，原生壳或已完成网页缓存）
     且网络良好时后台预取；lite 首访/慢网/省流不预热，留待首次使用 */
  function warmup() {
    if (imagesRequested) return;
    if (window.__rcFullMode !== true) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      if (conn.saveData) return;
      var et = conn.effectiveType || '';
      if (et && et.indexOf('4g') === -1) return;
    }
    requestImages();
  }

  function shouldRun() {
    return spritesReady && (modalVisible || islandVisible) && !document.hidden;
  }

  function ensureLoop() {
    if (rafId === null && shouldRun()) {
      lastTs = 0;
      rafId = global.requestAnimationFrame(tick);
    }
  }

  function maybeStop() {
    if (rafId !== null && !shouldRun()) {
      global.cancelAnimationFrame(rafId);
      rafId = null;
      lastTs = 0;
    }
  }

  function transitionTo(newState) {
    var oldState = currentState;
    currentState = newState;
    stateTimer = 0;
    accumulator = 0;
    settleAccum = 0;
    if (newState !== STATE.CONNECTED) connectedHoldMs = 0;

    switch (newState) {
      case STATE.IDLE:
        currentVariant = 'huimo';
        morphProgress = 0;
        if (oldState === STATE.MORPH_OUT) {
          idleDrift = true;
        } else {
          currentFrame = CONFIG.frontFrame;
          idleDrift = false;
        }
        break;
      case STATE.CONNECTING:
        currentVariant = 'huimo';
        if (oldState === STATE.IDLE) currentFrame = CONFIG.frontFrame;
        break;
      case STATE.PAUSE_AFTER_CONNECT:
      case STATE.PAUSE_AFTER_DISCONNECT:
        currentFrame = CONFIG.frontFrame;
        break;
      case STATE.MORPH_IN:
        currentFrame = CONFIG.frontFrame;
        morphProgress = 0;
        break;
      case STATE.MORPH_OUT:
        currentFrame = CONFIG.frontFrame;
        morphProgress = 1;
        break;
      case STATE.CONNECTED:
        currentVariant = 'color';
        connectedHoldMs = CONNECTED_HOLD_MS;
        break;
    }
  }

  /* 与 win-app 启动器一致的状态机：
     IDLE → CONNECTING → WAIT_FRONT_AFTER_CONNECT → PAUSE(320ms)
     → MORPH_IN(500ms，锁正面帧) → CONNECTED(停600ms后彩色旋转)
     断连反向：CONNECTED → WAIT_FRONT_AFTER_DISCONNECT → PAUSE → MORPH_OUT → IDLE */
  function setStatus(status) {
    status = parseInt(status, 10);
    if (isNaN(status)) return;

    switch (status) {
      case 0: // 未绑定
        if (currentState === STATE.CONNECTED) {
          transitionTo(STATE.WAIT_FRONT_AFTER_DISCONNECT);
        } else if (
          currentState === STATE.CONNECTING ||
          currentState === STATE.WAIT_FRONT_AFTER_CONNECT ||
          currentState === STATE.PAUSE_AFTER_CONNECT ||
          currentState === STATE.MORPH_IN
        ) {
          transitionTo(STATE.IDLE);
        } else if (currentState !== STATE.IDLE) {
          transitionTo(STATE.IDLE);
        }
        break;
      case 1: // 已连接
        if (currentState === STATE.CONNECTED) break;
        if (currentState === STATE.CONNECTING) {
          transitionTo(STATE.WAIT_FRONT_AFTER_CONNECT);
        } else if (currentState === STATE.IDLE) {
          transitionTo(STATE.WAIT_FRONT_AFTER_CONNECT);
        } else if (
          currentState === STATE.WAIT_FRONT_AFTER_DISCONNECT ||
          currentState === STATE.PAUSE_AFTER_DISCONNECT ||
          currentState === STATE.MORPH_OUT
        ) {
          transitionTo(STATE.CONNECTED);
        }
        break;
      case 2: // 连接失败
      case 4: // 手动断开
        if (currentState === STATE.CONNECTED) {
          transitionTo(STATE.WAIT_FRONT_AFTER_DISCONNECT);
        } else if (currentState === STATE.CONNECTING) {
          transitionTo(STATE.IDLE);
        } else if (
          currentState === STATE.WAIT_FRONT_AFTER_CONNECT ||
          currentState === STATE.PAUSE_AFTER_CONNECT ||
          currentState === STATE.MORPH_IN
        ) {
          transitionTo(STATE.IDLE);
        }
        break;
      case 3: // 连接中
        if (currentState === STATE.IDLE) transitionTo(STATE.CONNECTING);
        break;
    }
    ensureLoop();
  }

  function drawImageSafe(ctx, img, srcX, srcY, fw, fh) {
    if (img) ctx.drawImage(img, srcX, srcY, fw, fh, 0, 0, fw, fh);
  }

  function drawTarget(canvas, opts) {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w <= 0 || h <= 0) return;

    var dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    var bw = Math.max(1, Math.round(w * dpr));
    var bh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);

    var fw = CONFIG.frameWidth;
    var fh = CONFIG.frameHeight;
    var srcX = (currentFrame % CONFIG.cols) * fw;
    var srcY = Math.floor(currentFrame / CONFIG.cols) * fh;

    var morphMode = null;
    if (currentState === STATE.MORPH_IN) morphMode = 'in';
    else if (currentState === STATE.MORPH_OUT) morphMode = 'out';

    ctx.save();
    ctx.scale(dpr, dpr);
    if (opts && opts.coverTop) {
      /* 灵动岛：铺满宽度 + 顶部对齐裁切，头部与躯干填满卡片，旋转依然可见 */
      var coverScale = w / fw;
      ctx.scale(coverScale, coverScale);
      if (morphMode === 'in' && morphProgress > 0) {
        ctx.globalAlpha = 1 * (1 - morphProgress);
        drawImageSafe(ctx, huimoImg, srcX, srcY, fw, fh);
        ctx.globalAlpha = 1 * morphProgress;
        drawImageSafe(ctx, colorImg, srcX, srcY, fw, fh);
      } else if (morphMode === 'out' && morphProgress < 1) {
        ctx.globalAlpha = 1 * morphProgress;
        drawImageSafe(ctx, colorImg, srcX, srcY, fw, fh);
        ctx.globalAlpha = 1 * (1 - morphProgress);
        drawImageSafe(ctx, huimoImg, srcX, srcY, fw, fh);
      } else {
        ctx.globalAlpha = 1;
        drawImageSafe(ctx, currentVariant === 'color' ? colorImg : huimoImg, srcX, srcY, fw, fh);
      }
    } else {
      var scale = Math.max(w / fw, h / fh);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-fw / 2, -fh / 2);

      if (morphMode === 'in' && morphProgress > 0) {
        ctx.globalAlpha = 1 * (1 - morphProgress);
        drawImageSafe(ctx, huimoImg, srcX, srcY, fw, fh);
        ctx.globalAlpha = 1 * morphProgress;
        drawImageSafe(ctx, colorImg, srcX, srcY, fw, fh);
      } else if (morphMode === 'out' && morphProgress < 1) {
        ctx.globalAlpha = 1 * morphProgress;
        drawImageSafe(ctx, colorImg, srcX, srcY, fw, fh);
        ctx.globalAlpha = 1 * (1 - morphProgress);
        drawImageSafe(ctx, huimoImg, srcX, srcY, fw, fh);
      } else {
        ctx.globalAlpha = 1;
        drawImageSafe(ctx, currentVariant === 'color' ? colorImg : huimoImg, srcX, srcY, fw, fh);
      }
    }
    ctx.restore();
  }

  function tick(ts) {
    rafId = null;
    if (!shouldRun()) return;
    if (!lastTs) lastTs = ts;
    var delta = ts - lastTs;
    lastTs = ts;

    accumulator += delta;
    settleAccum += delta;

    var isRotating = currentState === STATE.CONNECTING || currentState === STATE.CONNECTED;
    var isSettling =
      currentState === STATE.WAIT_FRONT_AFTER_CONNECT ||
      currentState === STATE.WAIT_FRONT_AFTER_DISCONNECT;

    if (currentState === STATE.CONNECTED && connectedHoldMs > 0) {
      connectedHoldMs -= delta;
      accumulator = 0;
      settleAccum = 0;
    } else if (isRotating && accumulator >= FRAME_MS) {
      var steps = Math.floor(accumulator / FRAME_MS);
      accumulator -= steps * FRAME_MS;
      currentFrame = (currentFrame + steps) % CONFIG.frameCount;
    } else if (isSettling) {
      if (settleAccum >= FRAME_MS) {
        var sSteps = Math.floor(settleAccum / FRAME_MS);
        settleAccum -= sSteps * FRAME_MS;
        var targetState = currentState;
        for (var s = 0; s < sSteps; s++) {
          currentFrame = (currentFrame + 1) % CONFIG.frameCount;
          if (currentFrame === CONFIG.frontFrame) {
            transitionTo(targetState === STATE.WAIT_FRONT_AFTER_CONNECT
              ? STATE.PAUSE_AFTER_CONNECT
              : STATE.PAUSE_AFTER_DISCONNECT);
            break;
          }
        }
      }
    } else if (currentState === STATE.IDLE && idleDrift) {
      if (settleAccum >= FRAME_MS) {
        var dSteps = Math.floor(settleAccum / FRAME_MS);
        settleAccum -= dSteps * FRAME_MS;
        for (var d = 0; d < dSteps; d++) {
          currentFrame = (currentFrame + 1) % CONFIG.frameCount;
          if (currentFrame === CONFIG.frontFrame) {
            idleDrift = false;
            break;
          }
        }
      }
    } else if (currentState === STATE.IDLE) {
      currentFrame = CONFIG.frontFrame;
      settleAccum = 0;
    } else {
      settleAccum = Math.min(settleAccum, FRAME_MS * 4);
    }

    switch (currentState) {
      case STATE.PAUSE_AFTER_CONNECT:
      case STATE.PAUSE_AFTER_DISCONNECT:
        stateTimer += delta;
        if (stateTimer >= PAUSE_MS) {
          transitionTo(currentState === STATE.PAUSE_AFTER_CONNECT ? STATE.MORPH_IN : STATE.MORPH_OUT);
        }
        break;
      case STATE.MORPH_IN:
        stateTimer += delta;
        morphProgress = Math.min(1, stateTimer / MORPH_MS);
        if (morphProgress >= 1) {
          currentVariant = 'color';
          morphProgress = 0;
          transitionTo(STATE.CONNECTED);
        }
        break;
      case STATE.MORPH_OUT:
        stateTimer += delta;
        morphProgress = Math.max(0, 1 - stateTimer / MORPH_MS);
        if (morphProgress <= 0) {
          currentVariant = 'huimo';
          morphProgress = 0;
          transitionTo(STATE.IDLE);
        }
        break;
    }

    drawTarget(modalVisible ? modalCanvas : null, null);
    drawTarget(islandVisible ? islandCanvas : null, { coverTop: true });

    if (shouldRun()) rafId = global.requestAnimationFrame(tick);
  }

  function showModal() {
    modalVisible = true;
    requestImages();
    ensureLoop();
  }

  function hideModal() {
    modalVisible = false;
    maybeStop();
  }

  /* 灵动岛每次显示都呈现一次“新鲜连接”：彩色正面 → 停顿600ms → 持续旋转 */
  function showIsland() {
    islandVisible = true;
    requestImages();
    currentVariant = 'color';
    currentFrame = CONFIG.frontFrame;
    morphProgress = 0;
    idleDrift = false;
    currentState = STATE.CONNECTED;
    connectedHoldMs = CONNECTED_HOLD_MS;
    ensureLoop();
  }

  function hideIsland() {
    islandVisible = false;
    maybeStop();
  }

  function init(opts) {
    modalCanvas = (opts && opts.modalCanvas) || null;
    islandCanvas = (opts && opts.islandCanvas) || null;
    /* 仅绑定画布；精灵图延迟到首次显示或 warmup() 再加载（首屏不再被 7.6MB 大图阻塞） */
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) maybeStop();
    else ensureLoop();
  });

  global.rotationSprite = {
    init: init,
    warmup: warmup,
    setStatus: setStatus,
    showModal: showModal,
    hideModal: hideModal,
    showIsland: showIsland,
    hideIsland: hideIsland,
    getState: function () { return currentState; },
    getFrame: function () { return currentFrame; },
    getVariant: function () { return currentVariant; },
    getImages: function () { return { huimo: !!huimoImg, color: !!colorImg, ready: spritesReady }; }
  };
})(window);

    /* ===== 登录卡片内系统加载动画播放器：加载动画是登录界面的一部分——
       登录成功后登录卡片下半部（表单）收缩消失、原位换入进度条，副标题切换为加载文案，
       卡片向上收缩并保持居中（背景仍为登录页背景，无全屏遮罩）。
       进度由 requestAnimationFrame 逐帧驱动（约 1.2s，卡片收缩先行且独占主线程）；
       主界面挂载推迟到进度走完、登录层开始淡出时——加载全程菜单栏不可见，
       重初始化也不再与卡片收缩/进度动画抢占主线程。
       仅 desktop-chrome 且 ≥750px 播放，Android 与移动端直接跳过。 ===== */
    /* ver-diff-test-2 */
    (function () {
        var loginModal = document.getElementById('login-modal');
        var fill = document.getElementById('boot-progress-fill');
        var subtitle = document.getElementById('login-subtitle');
        var bootTimer = null;
        var bootRaf = null;
        var SUBTITLE_DEFAULT = '请验证您的身份';
        function stopBootLoop() {
            if (bootRaf) { cancelAnimationFrame(bootRaf); bootRaf = null; }
            if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
        }
        function resetLoginBoot() {
            stopBootLoop();
            if (loginModal) loginModal.classList.remove('entering', 'revealing', 'fade-out');
            if (fill) fill.style.width = '0%';
            if (subtitle) subtitle.textContent = SUBTITLE_DEFAULT;
        }
        function playLoginBoot(lines, duration, onReady) {
            var desktop = !!(loginModal && document.documentElement.classList.contains('desktop-chrome') && window.innerWidth >= 750);
            if (!desktop || !fill || !subtitle) {
                if (loginModal) { loginModal.classList.remove('entering'); loginModal.style.display = 'none'; }
                if (onReady) onReady();
                return;
            }
            stopBootLoop();
            /* 退出登录的 revealing 卡片落下动画若仍在播（480ms 兜底前快速重登），
               必须先摘除，避免与 entering 收缩动画叠加导致二次登录动画走样 */
            loginModal.classList.remove('revealing');
            loginModal.classList.add('entering');
            /* 卡片收缩（约 500ms）后进度起步；进度走完先挂载主界面（登录层仍完整覆盖）再淡出 */
            var start = Date.now() + 500;
            (function tick() {
                var now = Date.now();
                if (now < start) { bootRaf = requestAnimationFrame(tick); return; }
                var t = Math.min(1, (now - start) / duration);
                fill.style.width = (t * 100).toFixed(1) + '%';
                var idx = Math.min(lines.length - 1, Math.floor(t * lines.length));
                /* EN 模式写入时直译，不依赖 MutationObserver，避免中文闪帧（zh 模式原文不变） */
                var line = (window.I18N && window.I18N.getLang() === 'en') ? window.I18N.t(lines[idx]) : lines[idx];
                if (subtitle.textContent !== line) subtitle.textContent = line;
                if (t < 1) { bootRaf = requestAnimationFrame(tick); return; }
                bootRaf = null;
                if (onReady) onReady();
                loginModal.classList.add('fade-out');
                bootTimer = setTimeout(function () {
                    bootTimer = null;
                    loginModal.style.display = 'none';
                    resetLoginBoot();
                }, 450);
            })();
        }
        window.playLoginBoot = playLoginBoot;
        window.resetLoginBoot = resetLoginBoot;
    })();
// 键盘 / 安全区 / IME（三端均加载以保持原执行时序，仅在 Android WebView 生效；定义全局 updateSafeAreaInsets 供原生端调用）
let _currentImeHeight = 0;
        let _isKeyboardVisible = false;
        let _keyboardScrollScheduled = false;
        let _isKeyboardScrollAnimating = false;
        let _keyboardScrollTimer = null;
        let _vvResizeDebounce = null;

        function updateSafeAreaInsets(imeHeightPx) {
            let top = 0;
            let bottom = 0;
            if (window.Android && typeof window.Android.getSafeAreaTop === 'function' && typeof window.Android.getSafeAreaBottom === 'function') {
                try {
                    top = parseInt(window.Android.getSafeAreaTop()) || 0;
                    bottom = parseInt(window.Android.getSafeAreaBottom()) || 0;
                } catch (e) {
                    top = 0;
                    bottom = 0;
                }
            }
            if (typeof imeHeightPx === 'number' && imeHeightPx >= 0) {
                _currentImeHeight = imeHeightPx;
            }
            _isKeyboardVisible = _currentImeHeight > 100;
            document.documentElement.style.setProperty('--safe-area-top', top + 'px');
            document.documentElement.style.setProperty('--safe-area-bottom', bottom + 'px');
            document.documentElement.style.setProperty('--ime-height', _currentImeHeight + 'px');
            if (_isKeyboardVisible) {
                scheduleKeyboardScroll();
            }
        }

        let _lastFocusedElement = null;
        function scheduleKeyboardScroll() {
            if (_keyboardScrollScheduled) return;
            _keyboardScrollScheduled = true;
            requestAnimationFrame(function() {
                _keyboardScrollScheduled = false;
                if (_isKeyboardScrollAnimating) return;
                performKeyboardScroll();
            });
        }

        function performKeyboardScroll() {
            if (!isSingleColumn()) return;
            const activeEl = document.activeElement;
            if (!activeEl) return;
            const tagName = activeEl.tagName;
            if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') return;

            const scroller = document.getElementById('app-container');
            if (!scroller) return;

            const vv = window.visualViewport;
            var isKeyboardUp = vv && vv.height < window.innerHeight - 50 && _currentImeHeight > 100;
            // 可见区域：视觉视口（键盘上方可见部分），所有坐标统一为布局视口坐标
            var visibleHeight = isKeyboardUp ? vv.height : window.innerHeight - _currentImeHeight;
            // adjustNothing 下视觉视口顶部就是屏幕顶部，所以 visibleTop = 0（布局视口坐标）
            // 顶栏高度（fixed，始终在屏幕顶部）
            var heroBar = document.querySelector('.mobile-hero-bar');
            var heroBarHeight = heroBar ? heroBar.offsetHeight : 0;
            // 可用空间：从顶栏底部到键盘顶部
            var availableTop = heroBarHeight;
            var availableBottom = visibleHeight;
            var availableHeight = availableBottom - availableTop;
            var margin = 12;

            var targetEl = activeEl;
            var isTerminalCard = false;
            var terminalCard = activeEl.closest ? activeEl.closest('.mobile-terminal-card') : null;
            if (terminalCard) {
                targetEl = terminalCard;
                isTerminalCard = true;
            } else {
                var parentCard = activeEl.closest ? activeEl.closest('.mobile-page > div, [class*="card"], section > div') : null;
                if (parentCard && parentCard.getBoundingClientRect) {
                    targetEl = parentCard;
                }
            }

            // getBoundingClientRect() 返回视觉视口坐标，需要转换为布局视口坐标
            // adjustNothing 下视觉视口顶部 = 屏幕顶部 = 布局视口顶部，所以 offsetTop = 0
            // 但为了健壮性，仍然加上 vv.offsetTop（一般 = 0）
            var vvOffset = (vv && isKeyboardUp) ? vv.offsetTop : 0;
            var rect = targetEl.getBoundingClientRect();
            var targetHeight = rect.height;
            // 元素在布局视口中的顶部位置
            var elementLayoutTop = rect.top + vvOffset;

            var desiredLayoutTop;

            if (isTerminalCard) {
                // 终端卡片：优先显示标题栏在顶栏下方
                if (targetHeight <= availableHeight - margin) {
                    // 空间充足：标题栏紧贴顶栏下方
                    desiredLayoutTop = availableTop + margin;
                } else {
                    // 空间不足：让终端输入区域（卡片底部）在可见区域居中
                    // 卡片的输入区域大约在卡片下半部分，让卡片底部对齐到键盘上方
                    desiredLayoutTop = availableBottom - targetHeight - margin;
                    // 确保不会让标题栏被顶栏盖住（如果标题栏能尽量显示）
                    if (desiredLayoutTop < availableTop) {
                        desiredLayoutTop = availableTop;
                    }
                }
            } else {
                // 非终端卡片：居中显示
                if (targetHeight <= availableHeight - margin * 2) {
                    desiredLayoutTop = availableTop + (availableHeight - targetHeight) / 2;
                } else {
                    desiredLayoutTop = availableBottom - targetHeight - margin;
                }
                desiredLayoutTop = Math.max(availableTop, desiredLayoutTop);
            }

            // delta 计算：元素当前布局位置 vs 期望布局位置
            var delta = elementLayoutTop - desiredLayoutTop;

            if (Math.abs(delta) < 2) return;

            var currentScroll = scroller.scrollTop;
            var targetScroll = currentScroll + delta;
            var maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            var clampedTarget = Math.max(0, Math.min(targetScroll, maxScroll));

            _isKeyboardScrollAnimating = true;
            if (_keyboardScrollTimer) clearTimeout(_keyboardScrollTimer);
            _keyboardScrollTimer = setTimeout(function() {
                _isKeyboardScrollAnimating = false;
                _keyboardScrollTimer = null;
            }, 500);

            scroller.scrollTo({
                top: clampedTarget,
                behavior: 'smooth'
            });
        }

        // 仅在 Android WebView（非 Electron 的 window.Android）执行轮询与监听；桌面/浏览器零开销
        if (window.Android && !window.consoleAPI) {
            document.addEventListener('DOMContentLoaded', function() {
                updateSafeAreaInsets();

                let retryCount = 0;
                const maxRetries = 10;
                const retryInterval = managedSetInterval(function() {
                    updateSafeAreaInsets();
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        clearInterval(retryInterval);
                    }
                }, 500);
            });

            window.addEventListener('resize', updateSafeAreaInsets);
            window.addEventListener('orientationchange', updateSafeAreaInsets);
        }

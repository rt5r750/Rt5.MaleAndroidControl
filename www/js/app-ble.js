        
        /* ===== 蓝牙连接功能 ===== */
        var _btStatus = 0;
        var _btHasConnectedOnce = false;
        var _diTimer = null;
        var _diPulseTimer = null;
        var _diCamTimer = null;
        var _diExitTimer = null;
        var _diHiding = false;
        var _btStatusMap = [
            { label:'未绑定',         cls:'state-unbonded',    sub:'点击开始连接或扫码配对' },
            { label:'已连接',         cls:'state-connected',   sub:'已连接' },
            { label:'连接失败',       cls:'state-disconnected',sub:'连接失败，请重试' },
            { label:'正在连接...',    cls:'state-connecting',  sub:'正在连接...' },
            { label:'连接已手动断开', cls:'state-disconnected',sub:'连接已手动断开' }
        ];

        /* ===== 旋转精灵图（RotationSprite.js）===== */
        function _btSpriteShow() {
            if (window.rotationSprite) window.rotationSprite.showModal();
        }
        function _btSpriteHide() {
            if (window.rotationSprite) window.rotationSprite.hideModal();
        }

        var _diPopTimer = null;
        var _diSettleTimer = null;
        var _diOutlineTimer = null;

        function showDynamicIsland(mode) {
            if (!isIslandAllowed()) return;
            var island = document.getElementById('dynamic-island');
            if (!island) return;
            if (_diTimer) { clearTimeout(_diTimer); _diTimer = null; }
            if (_diPulseTimer) { clearTimeout(_diPulseTimer); _diPulseTimer = null; }
            if (_diCamTimer) { clearTimeout(_diCamTimer); _diCamTimer = null; }
            if (_diPopTimer) { clearTimeout(_diPopTimer); _diPopTimer = null; }
            if (_diSettleTimer) { clearTimeout(_diSettleTimer); _diSettleTimer = null; }
            if (_diOutlineTimer) { clearTimeout(_diOutlineTimer); _diOutlineTimer = null; }
            if (_diExitTimer) { clearTimeout(_diExitTimer); _diExitTimer = null; }
            _diHiding = false;
            island.classList.remove('di-exiting', 'di-visible', 'di-pulse', 'di-entering', 'di-cam-anim', 'di-pop', 'di-settle', 'di-outline', 'di-shrink', 'di-cam-exit', 'di-cam-fade', 'di-charging');
            if (mode === 'charging') {
                island.classList.add('di-charging');
            }
            // win-app：灵动岛播放期间通知堆叠下移，避免遮挡动画
            if (isWinAppDesktop()) {
                var nstackShift = document.getElementById('macos-notification-stack');
                if (nstackShift) nstackShift.classList.add('stack-shifted');
            }
            void island.offsetWidth;
            // 阶段1：从摄像头打孔区以小圆点出现（呼吸绿点 + 扩散环）
            island.classList.add('di-cam-anim');
            _diCamTimer = setTimeout(function() {
                // 阶段2：圆点下移到岛位并展开为药丸
                island.classList.remove('di-cam-anim');
                island.classList.add('di-pulse');
                _diPulseTimer = setTimeout(function() {
                    island.classList.remove('di-pulse');
                    // 阶段3：卡片展开 + 机器人等比例弹性放大，半透明底色
                    island.classList.add('di-pop');
                    if (window.rotationSprite) window.rotationSprite.showIsland();
                    _diPopTimer = setTimeout(function() {
                        // 阶段4：回弹稳定，底色加深
                        island.classList.remove('di-pop');
                        island.classList.add('di-settle');
                        _diSettleTimer = setTimeout(function() {
                            // 阶段5：SVG 描边沿圆角矩形外框跑一圈
                            island.classList.remove('di-settle');
                            island.classList.add('di-outline');
                            _diOutlineTimer = setTimeout(function() {
                                // 阶段6：底色与文字完全显现，描边保留
                                island.classList.add('di-visible');
                                island.classList.remove('di-outline');
                            }, 1000);
                        }, 300);
                    }, 400);
                }, 260);
            }, 380);
            _diTimer = setTimeout(function() {
                hideDynamicIsland();
            }, 380 + 260 + 400 + 300 + 1000 + 2600);
        }

        function hideDynamicIsland() {
            var island = document.getElementById('dynamic-island');
            if (!island) return;
            if (_diHiding) return;
            _diHiding = true;
            if (_diTimer) { clearTimeout(_diTimer); _diTimer = null; }
            if (_diPulseTimer) { clearTimeout(_diPulseTimer); _diPulseTimer = null; }
            if (_diCamTimer) { clearTimeout(_diCamTimer); _diCamTimer = null; }
            if (_diPopTimer) { clearTimeout(_diPopTimer); _diPopTimer = null; }
            if (_diSettleTimer) { clearTimeout(_diSettleTimer); _diSettleTimer = null; }
            if (_diOutlineTimer) { clearTimeout(_diOutlineTimer); _diOutlineTimer = null; }
            if (_diExitTimer) { clearTimeout(_diExitTimer); _diExitTimer = null; }
            island.classList.remove('di-pulse', 'di-entering', 'di-cam-anim', 'di-pop', 'di-settle', 'di-outline', 'di-exiting', 'di-visible', 'di-charging');
            if (isWinAppDesktop()) {
                var nstackShift = document.getElementById('macos-notification-stack');
                if (nstackShift) nstackShift.classList.remove('stack-shifted');
            }
            if (window.rotationSprite) window.rotationSprite.hideIsland();
            // win-app：圆点回收到系统菜单栏（标题栏）下面，被状态栏覆盖后淡出
            island.classList.add('di-shrink', 'di-cam-exit');
            var finishExit = function() {
                island.classList.remove('di-shrink', 'di-cam-exit', 'di-cam-fade');
                _diHiding = false;
            };
            _diExitTimer = setTimeout(function() {
                island.classList.add('di-cam-fade');
                _diPulseTimer = setTimeout(finishExit, 260);
            }, 750);
            // 兜底：移动 + 淡出完成后强制复位，避免任何定时器干扰导致动画残留
            _diCamTimer = setTimeout(finishExit, 1300);
        }

        // ===== macOS 风格通知（win-app 专属：右上角状态栏下方，图标通知/文字通知两种样式） =====
        var _macosNotifySeq = 0;
        var _macosNotifyTimers = {};
        function showMacosNotification(opts) {
            var stack = document.getElementById('macos-notification-stack');
            if (!stack) return null;
            opts = opts || {};
            var isText = opts.kind === 'text';
            var el = document.createElement('div');
            el.className = 'macos-notification' + (isText ? ' macos-notification-text' : '');
            var iconHtml = isText ? '' :
                '<div class="macos-notification-icon"><i class="fa ' + (opts.icon || 'fa-bolt') + '"></i></div>';
            el.innerHTML =
                iconHtml +
                '<div class="macos-notification-body">' +
                    '<div class="macos-notification-head">' +
                        '<span class="macos-notification-app">' + (opts.appName || getModelInfo('shortName')) + '</span>' +
                        '<span class="macos-notification-time">' + (opts.time || '现在') + '</span>' +
                    '</div>' +
                    '<div class="macos-notification-title">' + (opts.title || '') + '</div>' +
                    (opts.body ? '<div class="macos-notification-msg">' + opts.body + '</div>' : '') +
                '</div>' +
                '<span class="macos-notification-clear" title="清除"><i class="fa fa-xmark"></i></span>';
            // 堆叠：旧通知向后缩小下沉，最多保留 3 条
            var existing = stack.querySelectorAll('.macos-notification');
            existing.forEach(function(n) { n.classList.add('stacked'); });
            while (stack.children.length >= 3) {
                var first = stack.firstChild;
                if (first && _macosNotifyTimers[first.__id]) {
                    clearTimeout(_macosNotifyTimers[first.__id]);
                    delete _macosNotifyTimers[first.__id];
                }
                stack.removeChild(first);
            }
            el.__id = 'n' + (++_macosNotifySeq);
            stack.appendChild(el);
            requestAnimationFrame(function() {
                requestAnimationFrame(function() { el.classList.add('macos-notification-enter'); });
            });
            var clear = function() {
                if (_macosNotifyTimers[el.__id]) {
                    clearTimeout(_macosNotifyTimers[el.__id]);
                    delete _macosNotifyTimers[el.__id];
                }
                el.classList.remove('macos-notification-enter');
                el.classList.add('macos-notification-leave');
                setTimeout(function() {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 220);
            };
            el.querySelector('.macos-notification-clear').addEventListener('click', clear);
            _macosNotifyTimers[el.__id] = setTimeout(clear, opts.duration || 5000);
            return el;
        }
        function showMacosTextNotification(title, body, duration) {
            return showMacosNotification({ kind: 'text', title: title, body: body, duration: duration });
        }

        var btConnectTimeoutTimer = null;

        function clearBtConnectTimeout() {
            if (btConnectTimeoutTimer) {
                clearTimeout(btConnectTimeoutTimer);
                btConnectTimeoutTimer = null;
            }
        }

        function updateBtStatus(status) {
            var prevStatus = _btStatus;
            _btStatus = status;
            var info = _btStatusMap[status] || _btStatusMap[0];
            var btns = document.querySelectorAll('.bt-btn');
            var subtitle = document.getElementById('bt-modal-subtitle');
            var connectBtn = document.getElementById('bt-connect-btn');
            var deviceInfo = document.getElementById('bt-device-info');
            var modal = document.getElementById('bt-modal');

            if (status === 1 || status === 2) {
                clearBtConnectTimeout();
            }

            btns.forEach(function(btn) {
                btn.classList.remove('state-unbonded','state-connected','state-disconnected','state-connecting');
                btn.classList.add(info.cls);
            });
            // win-app：连接断开/手动断开时弹出 macOS 文字通知
            if ((status === 2 || status === 4) && prevStatus === 1 && isDesktopChrome() && typeof showMacosTextNotification === 'function') {
                showMacosTextNotification('连接已断开', status === 4 ? '连接已手动断开' : '连接失败，请重试');
            }
            if (subtitle) subtitle.textContent = info.sub;
            if (connectBtn) {
                if (status === 1) {
                    connectBtn.textContent = '断开';
                    connectBtn.className = 'btn-danger';
                    connectBtn.onclick = function() { btDisconnect(); };
                    connectBtn.disabled = false;
                    connectBtn.style.opacity = '1';
                } else if (status === 3) {
                    connectBtn.textContent = '连接中';
                    connectBtn.className = 'btn-primary';
                    connectBtn.onclick = null;
                    connectBtn.disabled = true;
                    connectBtn.style.opacity = '0.7';
                } else {
                    connectBtn.textContent = (status === 2) ? '重连' : '开始连接';
                    connectBtn.className = 'btn-primary';
                    connectBtn.disabled = false;
                    connectBtn.style.opacity = '1';
                    connectBtn.onclick = function() { btStartConnect(); };
                }
            }
            if (window.rotationSprite) window.rotationSprite.setStatus(status);
        }

        function btDisconnect() {
            if (typeof Android !== 'undefined' && Android.btUnbond) {
                Android.btUnbond();
                updateBtStatus(4);
            }
        }

        function showBtModal() {
            hideDynamicIsland();
            var modal = document.getElementById('bt-modal');
            if (modal) {
                modal.classList.add('visible');
                _btSpriteShow();
                if (typeof chromeMenuOpened === 'function') chromeMenuOpened('bt-modal');
                if (typeof Android !== 'undefined' && Android.btGetStatus) {
                    try {
                        var s = Android.btGetStatus();
                        updateBtStatus(s);
                    } catch(e) {}
                }
            }
        }

        function hideBtModal() {
            clearBtConnectTimeout();
            var modal = document.getElementById('bt-modal');
            if (modal) modal.classList.remove('visible');
            _btSpriteHide();
            if (typeof chromeMenuClosed === 'function') chromeMenuClosed('bt-modal');
        }

        /* ===== 关于本机窗口（macOS About 风格：红灯关闭、黄灯最小化到程序坞、绿灯最大化；
                位置/拖动/缩放/genie 动画由桌面窗口管理器 DWM 统一管理） ===== */
        function aboutT(zh) {
            try {
                if (window.I18N && window.I18N.getLang() === 'en') return window.I18N.t(zh);
            } catch (e) { /* ignore */ }
            return zh;
        }
        function renderAboutWindow() {
            var modal = document.getElementById('about-modal');
            if (!modal) return;
            var img = document.getElementById('about-robot-img');
            if (img) {
                var saved = null;
                try { saved = storage.getRobotImage1(); } catch (e) {}
                img.src = saved || DEFAULT_IMAGES.left;
                img.onerror = function() { this.src = PLACEHOLDER_SVG_1; };
            }
            var items = resolveStatusItems(state.statusItems && state.statusItems.length ? state.statusItems : storage.getStatusItems());
            var isEn = false;
            try { isEn = !!(window.I18N && window.I18N.getLang() === 'en'); } catch (e) {}
            var sub = document.getElementById('about-sub-line');
            if (sub && items.length >= 3) {
                /* 副标题：制造公司/版本/序列号（v1.6.0 起主人/制造公司置首，按 label 定位） */
                var byLabel = function (l) { return items.find(function (it) { return it.label === l; }); };
                var company = aboutT((byLabel('制造公司') || items[1]).value);
                var gen = aboutT((byLabel('版本') || items[3]).value);
                var sn = (byLabel('序列号') || items[4]).value;
                /* EN 副标题刻意两行：公司全称不挤成一团，代际/序列号作元数据行（写入时直译） */
                if (isEn) {
                    sub.textContent = '';
                    var line1 = document.createElement('div');
                    line1.className = 'about-sub-org';
                    line1.textContent = company;
                    var line2 = document.createElement('div');
                    line2.className = 'about-sub-meta';
                    line2.textContent = gen + ' · SN ' + sn;
                    sub.appendChild(line1);
                    sub.appendChild(line2);
                } else {
                    sub.textContent = company + ' · ' + gen + ' · 序列号 ' + sn;
                }
            }
            var list = document.getElementById('about-status-list');
            if (list) {
                list.innerHTML = '';
                items.forEach(function (it) {
                    var row = document.createElement('div');
                    row.className = 'about-status-item';
                    var l = document.createElement('span');
                    l.className = 'asi-label';
                    l.textContent = aboutT(it.label);
                    var v = document.createElement('span');
                    v.className = 'asi-value';
                    v.textContent = aboutT(it.value);
                    row.appendChild(l);
                    row.appendChild(v);
                    list.appendChild(row);
                });
            }
        }

        /* ===== 关于本机右列硬件监控：CPU/GPU/NPU 任务管理器式迷你折线（canvas 自绘）+ 内存/存储实时进度条。
           打开窗口时 1s 采样（数据源 state.dynamicParams / runtimeParams），窗口不可见或页面隐藏时跳过，
           关机/重启中止期间归零；关闭窗口时停止定时器。仅桌面菜单模式启用 ===== */
        var _aboutHw = null;
        var ABOUT_HW_DEFS = [
            { key: 'cpu', color: '#8fbc8f', fill: 'rgba(143, 188, 143, 0.16)' },
            { key: 'gpu', color: '#60a5fa', fill: 'rgba(96, 165, 250, 0.16)' },
            { key: 'npu', color: '#c084fc', fill: 'rgba(192, 132, 252, 0.16)' }
        ];
        function aboutHwStart() {
            if (typeof isDesktopChrome === 'function' && !isDesktopChrome()) return;
            if (!document.getElementById('about-hw-panel')) return;
            aboutHwStop();
            _aboutHw = { timer: null, hist: { cpu: [], gpu: [], npu: [] } };
            aboutHwSample();
            _aboutHw.timer = managedSetInterval(aboutHwTick, 1000);
        }
        function aboutHwStop() {
            if (_aboutHw && _aboutHw.timer) clearInterval(_aboutHw.timer);
            _aboutHw = null;
        }
        function aboutHwTick() {
            var modal = document.getElementById('about-modal');
            if (!modal || !modal.classList.contains('visible') || document.hidden) return;
            aboutHwSample();
        }
        function aboutHwSample() {
            if (!_aboutHw) return;
            var off = !!state.poweredOff; /* 关机/重启中止期间归零 */
            /* 同值不写：每秒重写会触发 MutationObserver/拟合，造成字形抽搐 */
            var set = function (id, txt) {
                var el = document.getElementById(id);
                if (el && el.textContent !== txt) el.textContent = txt;
            };
            ABOUT_HW_DEFS.forEach(function (d) {
                var v = off ? 0 : Math.max(0, Math.min(100, state.dynamicParams[d.key] || 0));
                _aboutHw.hist[d.key].push(v);
                if (_aboutHw.hist[d.key].length > 40) _aboutHw.hist[d.key].shift();
                set('about-hw-' + d.key + '-val', Math.round(v) + '%');
            });
            var memPct = off ? 0 : Math.max(0, Math.min(100, state.dynamicParams.memory || 0));
            var memUsed = off ? 0 : (state.dynamicParams.memoryUsed != null ? state.dynamicParams.memoryUsed : Math.round(memPct * 128 / 100));
            var stoUsed = state.runtimeParams.storageUsed != null ? state.runtimeParams.storageUsed : 121;
            var stoPct = Math.max(0, Math.min(100, Math.round(stoUsed / 512 * 100)));
            set('about-hw-mem-val', Math.round(memPct) + '%');
            set('about-hw-mem-sub', aboutT('已使用 ') + memUsed + ' PB / 128 PB');
            set('about-hw-sto-val', stoPct + '%');
            set('about-hw-sto-sub', aboutT('已使用 ') + stoUsed + ' EB / 512 EB');
            var memBar = document.getElementById('about-hw-mem-bar');
            if (memBar) memBar.style.width = memPct + '%';
            var stoBar = document.getElementById('about-hw-sto-bar');
            if (stoBar) stoBar.style.width = stoPct + '%';
            ABOUT_HW_DEFS.forEach(function (d) { aboutHwDraw(d.key, d.color, d.fill); });
        }
        function aboutHwDraw(key, color, fillColor) {
            var canvas = document.getElementById('about-hw-' + key + '-chart');
            var hist = _aboutHw && _aboutHw.hist[key];
            if (!canvas || !hist) return;
            var dpr = window.devicePixelRatio || 1;
            var cw = canvas.clientWidth, ch = canvas.clientHeight;
            if (!cw || !ch) return;
            if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
                canvas.width = Math.round(cw * dpr);
                canvas.height = Math.round(ch * dpr);
            }
            var ctx = canvas.getContext('2d');
            if (!ctx) return;
            var w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            /* 细网格线（任务管理器风格） */
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            for (var i = 1; i <= 3; i++) {
                var gy = Math.round(h * i / 4) + 0.5;
                ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
            }
            var n = hist.length;
            if (n < 2) return;
            var step = w / 39; /* 固定 40 槽窗口：历史从左侧补入，最新值贴右缘 */
            var vy = function (v) { return h - (Math.min(v, 100) / 100) * (h - 2) - 1; };
            var pts = [];
            for (var j = 0; j < n; j++) pts.push([w - (n - 1 - j) * step, vy(hist[j])]);
            /* 渐变面积填充 */
            ctx.beginPath();
            ctx.moveTo(pts[0][0], h);
            for (var k = 0; k < n; k++) ctx.lineTo(pts[k][0], pts[k][1]);
            ctx.lineTo(pts[n - 1][0], h);
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
            /* 折线 */
            ctx.beginPath();
            for (var m = 0; m < n; m++) { if (m === 0) ctx.moveTo(pts[m][0], pts[m][1]); else ctx.lineTo(pts[m][0], pts[m][1]); }
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, dpr * 1.2);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
            /* 末端亮点 */
            ctx.beginPath();
            ctx.arc(pts[n - 1][0], pts[n - 1][1], Math.max(2, dpr * 1.6), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        function openAboutModal() {
            var modal = document.getElementById('about-modal');
            if (!modal || modal.classList.contains('visible')) return;
            renderAboutWindow();
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            if (window.DWM) window.DWM.open('about-modal');
            aboutHwStart();
            notifyModalState();
            appendToLogs('已打开「关于本机」');
        }

        function closeAboutModal() {
            var modal = document.getElementById('about-modal');
            if (!modal) return;
            var minimized = window.DWM && window.DWM.isMinimized('about-modal');
            if (!modal.classList.contains('visible') && !minimized) return;
            if (window.DWM) window.DWM.close('about-modal');
            aboutHwStop();
            syncBodyOverflow();
            if (typeof chromeMenuClosed === 'function') chromeMenuClosed('about-modal');
            notifyModalState();
        }

        function minimizeAboutToDock() {
            if (!window.DWM || !window.DWM.minimize('about-modal')) return;
            appendToLogs('「关于本机」已最小化到程序坞');
        }

        function restoreAboutWindow() {
            if (window.DWM) window.DWM.restore('about-modal');
        }
        window.openAboutModal = openAboutModal;
        window.closeAboutModal = closeAboutModal;
        window.minimizeAboutToDock = minimizeAboutToDock;
        window.restoreAboutWindow = restoreAboutWindow;

        /* ===== 退出登录：回退到登录界面（关闭全部窗口、暂停后台任务，账号与机器人数据保留）。
           桌面端登录层（z 高于主界面）立即显示并播放"整层淡入+卡片落下"过渡动画盖住主界面，
           主界面在登录层下方完成淡出后隐藏——消除"主界面先渐隐→裸背景→登录页再淡入"的
           两段跳变硬切感；Android 与移动端维持原瞬时切换 ---- */
        function logout() {
            var mainEl = document.getElementById('main-content');
            if (mainEl && mainEl.classList.contains('fading-out')) return;
            if (typeof hideBtModal === 'function') hideBtModal();
            if (typeof closeInfoModal === 'function') closeInfoModal();
            if (typeof closeSettings === 'function') closeSettings();
            if (typeof hideSelfCheckAlert === 'function') hideSelfCheckAlert();
            closeAboutModal();
            setManagedIntervalsPaused(true);
            document.body.classList.add('paused');
            if (typeof robotCodeActive !== 'undefined' && robotCodeActive && typeof robotCodeStop === 'function') robotCodeStop();
            var desktop = typeof isDesktopChrome === 'function' && isDesktopChrome();
            if (mainEl && desktop && mainEl.style.display === 'block') {
                mainEl.classList.add('fading-out');   // 登录层下方渐隐（被盖住，无视觉跳变）
                finishLogout(true);
                setTimeout(function () {
                    mainEl.classList.remove('fading-out');
                    mainEl.style.opacity = '';
                    mainEl.style.display = 'none';
                }, 430);
            } else {
                finishLogout(false);
            }
            appendToLogs('用户已退出登录');
        }
        function finishLogout(deferMainHide) {
            var main = document.getElementById('main-content');
            var loginModal = document.getElementById('login-modal');
            if (loginModal) {
                if (typeof window.resetLoginBoot === 'function') window.resetLoginBoot();
                loginModal.style.display = '';
                loginModal.classList.remove('fade-out', 'entering');
                /* 返回登录页过渡动画：整层淡入 + 卡片自上方轻微落下。
                   display 恢复与 revealing 之间强制重排一次，保证动画每次都从头完整播放
                   （同帧内 remove+add 不会触发动画，曾表现为"硬切回登录页"） */
                void loginModal.offsetWidth;
                loginModal.classList.add('revealing');
                setTimeout(function () { loginModal.classList.remove('revealing'); }, 480);
            }
            /* 主界面隐藏：桌面端延迟（登录层盖住后完成淡出，见 logout）；其余立即 */
            if (!deferMainHide && main) { main.classList.remove('fading-out'); main.style.opacity = ''; main.style.display = 'none'; }
            if (typeof window.updateDesktopDock === 'function') window.updateDesktopDock();
        }
        window.logout = logout;

        /* ===== 菜单栏状态菜单数据刷新（电池 / 网络 / 机器人模式；面板打开时由菜单系统调用） ===== */
        window.refreshBatteryMenu = function () {
            var rp = state.runtimeParams || {};
            var pct = rp.batteryPercentage != null ? rp.batteryPercentage : 0;
            var charging = !!rp.isCharging;
            var pctEl = document.getElementById('ns-battery-pct');
            var stateEl = document.getElementById('ns-battery-state');
            var fill = document.getElementById('ns-battery-fill');
            var src = document.getElementById('ns-battery-source');
            if (pctEl) pctEl.textContent = Math.round(pct) + '%';
            if (fill) {
                fill.setAttribute('width', String(Math.max(0, 14.3 * pct / 100)));
                fill.setAttribute('fill', charging ? '#4ade80' : (pct < 20 ? '#f87171' : 'currentColor'));
            }
            if (stateEl) stateEl.textContent = charging ? '正在充电' : '使用内置电源';
            if (src) src.textContent = charging ? '充电器（外接电源）' : '内置电源';
        };

        window.refreshNetworkMenu = function () {
            var b = document.getElementById('ns-net-broadcast');
            var c = document.getElementById('ns-net-client');
            var d = document.getElementById('ns-net-disconnect');
            var deviceInfo = document.getElementById('bt-device-info');
            var connected = !!document.querySelector('.bt-btn.state-connected');
            if (b) b.textContent = connected ? '广播中 · 已连接' : '广播中';
            if (c) c.textContent = (connected && deviceInfo && deviceInfo.textContent) ? deviceInfo.textContent : '未连接';
            if (d) d.style.display = connected ? 'flex' : 'none';
        };

        window.refreshModeMenu = function () {
            var list = document.getElementById('ns-mode-list');
            if (!list) return;
            list.innerHTML = '';
            Object.keys(MODES).forEach(function (id) {
                var row = document.createElement('div');
                /* 关机/重启中止期间模式项灰色禁用（与终端控制台一致），开机后恢复 */
                row.className = 'ns-menu-item' + (state.activeMode === id ? ' current' : '') + (state.poweredOff ? ' disabled' : '');
                row.setAttribute('data-menu-action', 'mode');
                row.setAttribute('data-mode', id);
                row.innerHTML = '<span class="ns-menu-mode-row"><i class="fa ' + MODES[id].icon + '"></i>' + getModeNameSource(id) + '</span>' +
                    '<span class="ns-item-icon">' + (state.activeMode === id ? '<i class="fa fa-check"></i>' : '') + '</span>';
                list.appendChild(row);
            });
        };

        /* 设备已连接时自动弹出（native调用） */
        function btNotifyDeviceConnected(addr) {
            var info = document.getElementById('bt-device-info');
            if (info && addr) info.textContent = addr;
            updateBtStatus(1);
            /* 连接弹窗打开时：状态在弹窗内显示，不弹灵动岛；未打开时播放灵动岛动画 */
            _btHasConnectedOnce = true;
            var btModal = document.getElementById('bt-modal');
            var btModalOpen = btModal && btModal.classList.contains('visible');
            if (btModalOpen) {
                if (window.rotationSprite) window.rotationSprite.showModal();
            } else {
                hideBtModal();
                showDynamicIsland();
                if (isDesktopChrome() && typeof showMacosNotification === 'function') {
                    showMacosNotification({ icon: 'fa-robot', title: '设备已连接', body: modelSentenceConnected(), appName: getModelInfo('shortName') });
                }
            }

            if (typeof Android !== 'undefined' && Android.onDataChanged) {
                Android.onDataChanged('voice-history', getRecentVoiceHistory());
            }
            setTimeout(function() {
                if (typeof Android !== 'undefined' && Android.onDataChanged) {
                    var modeMap = { 'test': 0, 'recovery': 1, 'loyalty': 2, 'simulated-human': 3 };
                    var modeOrdinal;
                    if (state.isNaState || !state.activeMode) {
                        modeOrdinal = 255;
                    } else {
                        modeOrdinal = modeMap[state.activeMode] !== undefined ? modeMap[state.activeMode] : 255;
                    }
                    Android.onDataChanged('mode', modeOrdinal.toString());
                    var emotions = loadEmotions();
                    Android.onDataChanged('emotion', [emotions.obedience||0, emotions.shame||0, emotions.pleasure||0, emotions.mechanical||0].join(','));
                    var tasks = loadTasks();
                    Android.onDataChanged('tasks', JSON.stringify(tasks));
                    Android.onDataChanged('voice-history', getRecentVoiceHistory());
                }
            }, 1500);
            setTimeout(function() {
                if (typeof Android !== 'undefined' && Android.onDataChanged) {
                    var tasks = loadTasks();
                    Android.onDataChanged('tasks', JSON.stringify(tasks));
                }
            }, 3000);
        }
        /* 启动时未绑定自动弹出提示（native调用） */
        function btShowDiscoverModal() {
            updateBtStatus(0);
            var modal = document.getElementById('bt-modal');
            if (modal) {
                modal.classList.add('visible');
                _btSpriteShow();
                if (typeof chromeMenuOpened === 'function') chromeMenuOpened('bt-modal');
            }
        }
        /* 冷启动扫描到附近设备后弹出提示（native调用） */
        function btShowDeviceFoundModal() {
            var modal = document.getElementById('bt-modal');
            if (modal && modal.classList.contains('visible')) return;
            updateBtStatus(0);
            var subtitle = document.getElementById('bt-modal-subtitle');
            if (subtitle) subtitle.textContent = '发现附近可连接的设备';
            if (modal) {
                modal.classList.add('visible');
                _btSpriteShow();
                if (typeof chromeMenuOpened === 'function') chromeMenuOpened('bt-modal');
            }
        }

        function btStartConnect() {
            if (typeof Android !== 'undefined' && Android.btStartConnect) {
                clearBtConnectTimeout();
                Android.btStartConnect();
                updateBtStatus(3);
                btConnectTimeoutTimer = setTimeout(function() {
                    if (_btStatus === 3) {
                        updateBtStatus(2);
                    }
                }, 10000);
            }
        }

        function btUnbond() {
            _btHasConnectedOnce = false;
            hideDynamicIsland();
            if (typeof Android !== 'undefined' && Android.btUnbond) {
                Android.btUnbond();
                updateBtStatus(0);
                var info = document.getElementById('bt-device-info');
                if (info) info.textContent = '';
                hideBtModal();
            }
        }

        function btShowQr() {
            hideBtModal();
            setTimeout(function(){ showQrModal(); }, 200);
        }

        function showQrModal() {
            var modal = document.getElementById('bt-qr-modal');
            if (modal) {
                modal.classList.add('visible');
                if (typeof Android !== 'undefined' && Android.btShowQr) {
                    try {
                        var qrData = Android.btShowQr();
                        if (qrData) drawQrCode(qrData);
                    } catch(e) { console.error('QR err', e); }
                }
            }
        }

        function hideQrModal() {
            var modal = document.getElementById('bt-qr-modal');
            if (modal) modal.classList.remove('visible');
        }

        function drawQrCode(dataUrl) {
            var img = document.getElementById('bt-qr-image');
            if (img && dataUrl) {
                img.src = dataUrl;
            }
        }

        var QRCode = (function() {
            function QRCode(size, modules) { this.size = size; this.modules = modules; }
            var ECC_L = 0;
            var ECC_CODEWORDS_PER_BLOCK = [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
            var NUM_ERROR_CORRECTION_BLOCKS = [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25, 26, 27];
            var NUM_DATA_CODEWORDS = [-1, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 647, 721, 795, 861, 932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956, 3096, 3244];

            function getNumRawDataModules(ver) {
                var result = (16 * ver + 128) * ver + 64;
                if (ver >= 2) {
                    var numAlign = Math.floor(ver / 7) + 2;
                    result -= (25 * numAlign - 10) * numAlign - 55;
                    if (ver >= 7) result -= 36;
                }
                return result;
            }

            function encodeText(text) {
                var bytes = [];
                for (var i = 0; i < text.length; i++) {
                    var c = text.charCodeAt(i);
                    if (c < 0x80) bytes.push(c);
                    else if (c < 0x800) { bytes.push(0xC0 | (c >> 6)); bytes.push(0x80 | (c & 0x3F)); }
                    else { bytes.push(0xE0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3F)); bytes.push(0x80 | (c & 0x3F)); }
                }
                return encodeBinary(bytes);
            }

            function encodeBinary(data) {
                var ver, dataUsedBits;
                for (ver = 1; ver <= 40; ver++) {
                    var dataCapacityBits = NUM_DATA_CODEWORDS[ver] * 8;
                    dataUsedBits = 4 + getCharCountBits(ver) + data.length * 8;
                    if (dataUsedBits <= dataCapacityBits) break;
                }
                if (ver > 40) throw "Data too long";

                var headerBits = [];
                appendBits(0b0100, 4, headerBits);
                appendBits(data.length, getCharCountBits(ver), headerBits);
                for (var i = 0; i < data.length; i++) appendBits(data[i], 8, headerBits);

                var dataCapacityBits = NUM_DATA_CODEWORDS[ver] * 8;
                appendBits(0, Math.min(4, dataCapacityBits - dataUsedBits), headerBits);
                appendBits(0, (8 - headerBits.length % 8) % 8, headerBits);
                for (var padByte = 0xEC; headerBits.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11) appendBits(padByte, 8, headerBits);

                var dataCodewords = [];
                for (var i = 0; i < headerBits.length; i += 8) {
                    var val = 0;
                    for (var j = 0; j < 8; j++) val = (val << 1) | headerBits[i + j];
                    dataCodewords.push(val);
                }

                var allCodewords = addEccAndInterleave(dataCodewords, ver);
                return buildImage(allCodewords, ver);
            }

            function getCharCountBits(ver) {
                return ver <= 9 ? 8 : 16;
            }

            function appendBits(val, len, bb) {
                if (len < 0 || len > 31 || val >>> len != 0) throw "Invalid val/len";
                for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
            }

            function addEccAndInterleave(data, ver) {
                var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ver];
                var blockEccLen = ECC_CODEWORDS_PER_BLOCK[ver];
                var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
                var numShortBlocks = numBlocks - rawCodewords % numBlocks;
                var shortBlockLen = Math.floor(rawCodewords / numBlocks);

                var blocks = [];
                var rsDiv = reedSolomonComputeDivisor(blockEccLen);
                for (var i = 0, k = 0; i < numBlocks; i++) {
                    var dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
                    k += dat.length;
                    var ecc = reedSolomonComputeRemainder(dat, rsDiv);
                    if (i < numShortBlocks) dat.push(0);
                    blocks.push(dat.concat(ecc));
                }

                var result = [];
                for (var i = 0; i < blocks[0].length; i++) {
                    blocks.forEach(function(block, j) {
                        if (i != shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
                    });
                }
                return result;
            }

            function reedSolomonComputeDivisor(degree) {
                var result = [];
                for (var i = 0; i < degree - 1; i++) result.push(0);
                result.push(1);
                var root = 1;
                for (var i = 0; i < degree; i++) {
                    for (var j = 0; j < result.length; j++) {
                        result[j] = reedSolomonMultiply(result[j], root);
                        if (j + 1 < result.length) result[j] ^= result[j + 1];
                    }
                    root = reedSolomonMultiply(root, 0x02);
                }
                return result;
            }

            function reedSolomonComputeRemainder(data, divisor) {
                var result = divisor.map(function() { return 0; });
                for (var b = 0; b < data.length; b++) {
                    var factor = result[0] ^ data[b];
                    result.shift();
                    result.push(0);
                    for (var i = 0; i < result.length; i++) result[i] ^= reedSolomonMultiply(divisor[i], factor);
                }
                return result;
            }

            function reedSolomonMultiply(x, y) {
                var z = 0;
                for (var i = 7; i >= 0; i--) {
                    z = (z << 1) ^ ((z >>> 7) * 0x11D);
                    z ^= ((y >>> i) & 1) * x;
                }
                return z;
            }

            function buildImage(dataCodewords, ver) {
                var size = ver * 4 + 17;
                var modules = [];
                var isFunction = [];
                for (var i = 0; i < size; i++) {
                    modules.push(new Array(size).fill(false));
                    isFunction.push(new Array(size).fill(false));
                }

                drawFunctionPatterns(modules, isFunction, ver);
                drawFormatBits(0, modules, size);
                if (ver >= 7) drawVersion(ver, modules, isFunction);
                drawCodewords(dataCodewords, modules, isFunction, size);

                applyMask(modules, isFunction, size);

                return new QRCode(size, modules);
            }

            function setFunctionModule(modules, isFunction, r, c, dark) {
                modules[r][c] = dark;
                isFunction[r][c] = true;
            }

            function drawFunctionPatterns(modules, isFunction, ver) {
                for (var i = 0; i < modules.length; i++) {
                    setFunctionModule(modules, isFunction, 6, i, i % 2 == 0);
                    setFunctionModule(modules, isFunction, i, 6, i % 2 == 0);
                }
                drawFinderPattern(modules, isFunction, 3, 3);
                drawFinderPattern(modules, isFunction, modules.length - 4, 3);
                drawFinderPattern(modules, isFunction, 3, modules.length - 4);
                var alignPositions = getAlignmentPatternPositions(ver);
                var numAlign = alignPositions.length;
                for (var i = 0; i < numAlign; i++) {
                    for (var j = 0; j < numAlign; j++) {
                        if ((i == 0 && j == 0) || (i == 0 && j == numAlign - 1) || (i == numAlign - 1 && j == 0)) continue;
                        drawAlignmentPattern(modules, isFunction, alignPositions[i], alignPositions[j]);
                    }
                }
                for (var i = 0; i < modules.length; i++) {
                    for (var j = 0; j < modules.length; j++) {
                        var c = (i == 8 && j < 9) || (j == 8 && i < 9) || (i == 8 && j >= modules.length - 8) || (j == 8 && i >= modules.length - 8);
                        if (c && !isFunction[i][j]) setFunctionModule(modules, isFunction, i, j, true);
                    }
                }
            }

            function getAlignmentPatternPositions(ver) {
                if (ver == 1) return [];
                var numAlign = Math.floor(ver / 7) + 2;
                var step = (ver == 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
                var result = [6];
                for (var pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
                return result;
            }

            function drawFinderPattern(modules, isFunction, cy, cx) {
                for (var dy = -4; dy <= 4; dy++) {
                    for (var dx = -4; dx <= 4; dx++) {
                        var dist = Math.max(Math.abs(dx), Math.abs(dy));
                        var xx = cx + dx, yy = cy + dy;
                        if (xx >= 0 && xx < modules.length && yy >= 0 && yy < modules.length) {
                            setFunctionModule(modules, isFunction, yy, xx, dist != 2 && dist != 4);
                        }
                    }
                }
            }

            function drawAlignmentPattern(modules, isFunction, cy, cx) {
                for (var dy = -2; dy <= 2; dy++) {
                    for (var dx = -2; dx <= 2; dx++) {
                        setFunctionModule(modules, isFunction, cy + dy, cx + dx, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
                    }
                }
            }

            function drawFormatBits(mask, modules, size) {
                var data = (ECC_L << 3) | mask;
                var rem = data;
                for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
                var bits = ((data << 10) | rem) ^ 0x5412;
                for (var i = 0; i <= 5; i++) modules[8][i] = getBit(bits, i);
                modules[8][7] = getBit(bits, 6);
                modules[8][8] = getBit(bits, 7);
                modules[7][8] = getBit(bits, 8);
                for (var i = 9; i < 15; i++) modules[14 - i][8] = getBit(bits, i);
                for (var i = 0; i < 8; i++) modules[size - 1 - i][8] = getBit(bits, i);
                for (var i = 8; i < 15; i++) modules[8][size - 15 + i] = getBit(bits, i);
                modules[size - 8][8] = true;
            }

            function getBit(x, i) { return ((x >>> i) & 1) != 0; }

            function drawVersion(ver, modules, isFunction) {
                var rem = ver;
                for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
                var bits = (ver << 12) | rem;
                for (var i = 0; i < 18; i++) {
                    var bit = getBit(bits, i);
                    var a = modules.length - 11 + Math.floor(i / 3);
                    var b = i % 3;
                    setFunctionModule(modules, isFunction, a, b, bit);
                    setFunctionModule(modules, isFunction, b, a, bit);
                }
            }

            function drawCodewords(data, modules, isFunction, size) {
                var i = 0;
                for (var right = size - 1; right >= 1; right -= 2) {
                    if (right == 6) right = 5;
                    for (var vert = 0; vert < size; vert++) {
                        for (var j = 0; j < 2; j++) {
                            var x = right - j;
                            var upward = ((right + 1) & 2) == 0;
                            var y = upward ? size - 1 - vert : vert;
                            if (!isFunction[y][x] && i < data.length * 8) {
                                modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                                i++;
                            }
                        }
                    }
                }
            }

            function applyMask(modules, isFunction, size) {
                var bestMask = 0;
                var minPenalty = Infinity;
                var bestModules = null;
                for (var mask = 0; mask < 8; mask++) {
                    var m = modules.map(function(row) { return row.slice(); });
                    for (var r = 0; r < size; r++) {
                        for (var c = 0; c < size; c++) {
                            if (!isFunction[r][c] && maskFunc(mask, r, c)) m[r][c] = !m[r][c];
                        }
                    }
                    drawFormatBits(mask, m, size);
                    var penalty = getPenalty(m, size);
                    if (penalty < minPenalty) {
                        minPenalty = penalty;
                        bestMask = mask;
                        bestModules = m;
                    }
                }
                for (var r = 0; r < size; r++) {
                    for (var c = 0; c < size; c++) {
                        modules[r][c] = bestModules[r][c];
                    }
                }
            }

            function maskFunc(mask, r, c) {
                switch (mask) {
                    case 0: return (r + c) % 2 == 0;
                    case 1: return r % 2 == 0;
                    case 2: return c % 3 == 0;
                    case 3: return (r + c) % 3 == 0;
                    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 == 0;
                    case 5: return (r * c) % 2 + (r * c) % 3 == 0;
                    case 6: return ((r * c) % 2 + (r * c) % 3) % 2 == 0;
                    case 7: return ((r + c) % 2 + (r * c) % 3) % 2 == 0;
                    default: return false;
                }
            }

            function getPenalty(modules, size) {
                var penalty = 0;
                for (var r = 0; r < size; r++) {
                    var runColor = false, runX = 0;
                    var runHistory = [0,0,0,0,0,0,0];
                    for (var c = 0; c < size; c++) {
                        if (modules[r][c] == runColor) {
                            runX++;
                            if (runX == 5) penalty += 3;
                            else if (runX > 5) penalty++;
                        } else {
                            runColor = modules[r][c]; runX = 1;
                            shiftAdd(runHistory, runX);
                        }
                    }
                }
                for (var c = 0; c < size; c++) {
                    for (var r = 0; r < size; r++) {
                        var sameCount = 1;
                        var dark = modules[r][c];
                        if (c + 1 < size && modules[r][c+1] == dark) sameCount++;
                        if (c - 1 >= 0 && modules[r][c-1] == dark) sameCount++;
                        if (r + 1 < size && modules[r+1][c] == dark) sameCount++;
                        if (r - 1 >= 0 && modules[r-1][c] == dark) sameCount++;
                        if (sameCount > 3) penalty += 3;
                    }
                }
                var darkCount = 0;
                for (var r = 0; r < size; r++) {
                    for (var c = 0; c < size; c++) {
                        if (modules[r][c]) darkCount++;
                    }
                }
                var total = size * size;
                var k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
                penalty += k * 10;
                return penalty;
            }

            function shiftAdd(runHistory, val) {
                for (var i = 0; i < 6; i++) runHistory[i] = runHistory[i+1];
                runHistory[6] = val;
            }

            return { encodeText: encodeText, encodeBinary: encodeBinary };
        })();

        var _lastBtMode = -1;
        var _lastBtEmotion = '';
        var _lastBtTasks = '';
        function checkBtDataChanges() {
            if (typeof Android === 'undefined' || !Android.onDataChanged) return;
            try {
            } catch(e) {}
        }

        /* ===== 第二栏高度分配：任务指令系统 / 调试日志（运行参数始终完整） =====
           缩矮：优先缩调试日志（最小1条）→ 再缩任务系统 → 之后均匀分配；
           扩高：优先扩任务系统（到3条）→ 再扩调试日志（到4条）→ 之后继续扩任务系统。 */
        var _COL2_SPLIT_MIN = {
            T1: 96,   // 任务系统：标题34 + 内边距24 + 1条任务38
            T3: 184,  // 任务系统：标题34 + 内边距24 + 3条任务(38×3+间距11)
            L1: 82,   // 调试日志：标题34 + 内容区48（1行）
            L4: 140   // 调试日志：标题34 + 内容区104（4行）
        };
        var _col2Split = { S: 0, tasks: 0, logs: 0, ready: false };
        function updateSecondColumnSplit() {
            var col = document.getElementById('triple-col-2');
            var tasksEl = document.getElementById('triple-tasks');
            var logsEl = document.getElementById('triple-logs');
            var paramsEl = document.getElementById('triple-params');
            if (!col || !tasksEl || !logsEl || !paramsEl || !col.clientHeight) return;

            var gap = 6; // 0.375rem
            var S = col.clientHeight - paramsEl.offsetHeight - gap * 2;
            if (S < 0) S = 0;

            var T1 = _COL2_SPLIT_MIN.T1, T3 = _COL2_SPLIT_MIN.T3;
            var L1 = _COL2_SPLIT_MIN.L1, L4 = _COL2_SPLIT_MIN.L4;

            var prev = _col2Split;
            var dir = !prev.ready ? 1 : (S > prev.S + 0.5 ? 1 : S < prev.S - 0.5 ? -1 : 0);
            var tasks, logs;
            if (dir < 0) {
                // 缩矮：优先缩日志（4→1），日志到最小后再缩任务，最后均匀
                logs = Math.min(L4, Math.max(L1, S - Math.max(prev.tasks, T3)));
                tasks = S - logs;
                if (logs <= L1 + 1) {
                    tasks = S - L1;
                    if (tasks < T1) {
                        var short = (T1 + L1) - S;
                        tasks = T1 - short / 2;
                        logs = L1 - short / 2;
                    }
                }
            } else {
                // 扩高/初始：先扩任务到3条，再扩日志到4条，之后继续扩任务
                if (S >= T3 + L4) { tasks = S - L4; logs = L4; }
                else if (S >= T3 + L1) { tasks = T3; logs = S - T3; }
                else if (S >= T1 + L1) { tasks = S - L1; logs = L1; }
                else {
                    var short2 = (T1 + L1) - S;
                    tasks = T1 - short2 / 2;
                    logs = L1 - short2 / 2;
                }
            }
            tasks = Math.max(0, Math.round(tasks));
            logs = Math.max(0, Math.round(logs));
            tasksEl.style.flex = '0 0 auto';
            logsEl.style.flex = '0 0 auto';
            tasksEl.style.height = tasks + 'px';
            logsEl.style.height = logs + 'px';
            _col2Split = { S: S, tasks: tasks, logs: logs, ready: true };
        }

        function initSecondColumnSplit() {
            if (typeof ResizeObserver === 'undefined') {
                window.addEventListener('resize', updateSecondColumnSplit);
                setTimeout(updateSecondColumnSplit, 300);
                setTimeout(updateSecondColumnSplit, 1200);
                return;
            }
            try {
                var col = document.getElementById('triple-col-2');
                if (col && !col.__splitObserver) {
                    col.__splitObserver = new ResizeObserver(updateSecondColumnSplit);
                    col.__splitObserver.observe(col);
                }
            } catch (e) {
                window.addEventListener('resize', updateSecondColumnSplit);
            }
            updateSecondColumnSplit();
            setTimeout(updateSecondColumnSplit, 500);
        }
        window.addEventListener('DOMContentLoaded', initSecondColumnSplit);
        setTimeout(initSecondColumnSplit, 1500);

        /* 反向模式推送（native 调用）：手机端写入 Mode(7501) → 控制台切换到对应模式并提示「推送成功」。
           模式切换复用 activateMode 原逻辑（高亮/播报/日志/回推 BLE），行为与原代码一致；
           通知：win-app/桌面浏览器用 macOS 风格通知，Android WebView 由原生 Toast 负责，此处不弹。 */
        window.__rcOnRemoteMode = function(ordinal) {
            var modeMap = ['test', 'recovery', 'loyalty', 'simulated-human'];
            var n = Number(ordinal);
            var modeId = (n >= 0 && n <= 3) ? modeMap[n] : null;
            if (!modeId || typeof MODES === 'undefined' || !MODES[modeId]) return;
            /* 幂等短路（v1.12.1）：已是该模式时不再重走 activateMode——回声/重复事件
               否则会二次播报，IM 通知推送发两遍（用户实测）；「推送成功」提示照常 */
            var already = (typeof state !== 'undefined' && state.activeMode === modeId);
            if (!already) activateMode(modeId);
            if (isDesktopChrome() && typeof showMacosNotification === 'function') {
                showMacosNotification({
                    icon: 'fa-arrow-right-arrow-left',
                    title: '推送成功',
                    body: modeDisplayName(modeId),
                    appName: getModelInfo('shortName')
                });
            }
        };

        document.addEventListener('DOMContentLoaded', function() {
            var hasBond = false;
            if (typeof Android !== 'undefined' && Android.btHasClientBond) {
                try { hasBond = Android.btHasClientBond(); } catch(e) {}
            }
            _btHasConnectedOnce = hasBond;
            if (window.rotationSprite && window.rotationSprite.init) {
                window.rotationSprite.init({
                    modalCanvas: document.getElementById('bt-canvas'),
                    islandCanvas: document.getElementById('di-canvas')
                });
            }
            updateBtStatus(0);
            updateStatusBarModeIcon();
        });
    /* ===== 桌面菜单模式交互：连接/信息/设置 + Rt5 系统菜单 + 电池/网络/模式状态菜单 → macOS NSMenu 风格下拉面板；
       桌面窗口管理器（关于本机 / 过程窗口 / PDF 阅读器浮窗：拖动/缩放/最小化/最大化）；底部自动隐藏程序坞。
       仅浏览器与 win-app（html.desktop-chrome）且 ≥750px 生效，Android WebView 与移动端不变。 ===== */
    (function () {
        var doc = document;
        /* NSMenu 菜单面板（互斥单开：点击下一个，上一个关闭）。DWM 浮窗（关于本机/过程窗口/PDF）
           不在此列——弹出的窗口永不被菜单或其他窗口顶掉 */
        var MENU_PANELS = [
            { id: 'bt-modal', openCls: 'visible', trigger: 'triple-bt-status-btn', align: 'right', close: 'hideBtModal' },
            { id: 'info-modal', openCls: 'visible', trigger: 'triple-btn-info', align: 'right', close: 'closeInfoModal' },
            { id: 'settings-modal', openCls: 'settings-modal-visible', trigger: 'triple-open-settings', align: 'right', close: 'closeSettings' },
            { id: 'logo-menu', openCls: 'visible', trigger: 'triple-logo-btn', align: 'left', close: null },
            { id: 'battery-menu', openCls: 'visible', trigger: 'triple-battery-icon', align: 'right', close: null, refresh: 'refreshBatteryMenu' },
            { id: 'network-menu', openCls: 'visible', trigger: 'triple-net-icon', align: 'right', close: null, refresh: 'refreshNetworkMenu' },
            { id: 'mode-menu', openCls: 'visible', trigger: 'triple-mode-icon', align: 'right', close: null, refresh: 'refreshModeMenu' }
        ];
        var dock = doc.getElementById('desktop-dock');
        var _dockHideTimer = null;
        var _dockRaf = null;

        function isMenuMode() {
            return doc.documentElement.classList.contains('desktop-chrome') && window.innerWidth >= 750;
        }
        function findPanel(id) {
            for (var i = 0; i < MENU_PANELS.length; i++) {
                if (MENU_PANELS[i].id === id) return MENU_PANELS[i];
            }
            return null;
        }
        function isOpen(p) {
            var el = doc.getElementById(p.id);
            return !!(el && el.classList.contains(p.openCls));
        }
        function setTriggerActive(p, on) {
            if (!p || !p.trigger) return;
            var trig = doc.getElementById(p.trigger);
            if (trig) trig.classList.toggle('menu-trigger-active', !!on);
        }
        function closePanel(p) {
            if (p.close && typeof window[p.close] === 'function') { window[p.close](); return; }
            var el = doc.getElementById(p.id);
            if (el) el.classList.remove(p.openCls);
            setTriggerActive(p, false);
            updateDockIndicators();
        }
        function positionMenuPanel(panelId) {
            var p = findPanel(panelId);
            var panel = doc.getElementById(panelId);
            if (!p || !panel) return;
            if (!p.trigger) { panel.style.right = ''; panel.style.left = ''; return; }
            var trig = doc.getElementById(p.trigger);
            if (!trig) return;
            var r = trig.getBoundingClientRect();
            var card = panel.querySelector('.ns-menu-card, .bt-modal-card, .info-modal-content, .settings-content');
            var w = card ? card.offsetWidth : 0;
            if (p.align === 'left') {
                panel.style.right = 'auto';
                var left = r.left - 4;
                var maxLeft = window.innerWidth - w - 8;
                panel.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
            } else {
                panel.style.left = 'auto';
                var right = window.innerWidth - r.right - 2;
                var maxRight = window.innerWidth - w - 8;
                if (maxRight < 8) maxRight = 8;
                panel.style.right = Math.max(8, Math.min(right, maxRight)) + 'px';
            }
        }
        function updateDockIndicators() {
            if (!dock) return;
            _dockBase = null;
            /* 主界面窗口区：登录后三栏各窗口始终处于打开状态，指示点常亮（macOS 语义） */
            var mainEl = doc.getElementById('main-content');
            var mainShown = !!(mainEl && mainEl.style.display === 'block');
            dock.querySelectorAll('.dock-item[data-action^="win-"]').forEach(function (it) {
                it.classList.toggle('window-open', mainShown);
            });
        }
        function guardBlocked(p) {
            /* 菜单语义：再次点击同一菜单栏图标 = 关闭（mousedown 已关并落下 guard，跳过本次重开） */
            if (p._toggleGuard && Date.now() - p._toggleGuard < 450) {
                p._toggleGuard = 0;
                return true;
            }
            p._toggleGuard = 0;
            return false;
        }
        function openChromePanel(p) {
            MENU_PANELS.forEach(function (other) {
                if (other.id !== p.id && isOpen(other)) closePanel(other);
            });
            var el = doc.getElementById(p.id);
            if (!el) return;
            el.classList.add(p.openCls);
            positionMenuPanel(p.id);
            setTriggerActive(p, true);
            if (p.refresh && typeof window[p.refresh] === 'function') window[p.refresh]();
            updateDockIndicators();
        }
        function toggleMenuPanel(id) {
            var p = findPanel(id);
            if (!p || !isMenuMode()) return;
            var el = doc.getElementById(id);
            if (!el) return;
            if (el.classList.contains(p.openCls)) { closePanel(p); return; }
            if (guardBlocked(p)) return;
            openChromePanel(p);
        }

        /* 打开挂点：showBtModal/openInfoModal/openSettings/openAboutModal 调用 */
        window.chromeMenuOpened = function (panelId) {
            var p = findPanel(panelId);
            if (!p || !isMenuMode()) return;
            if (guardBlocked(p)) { closePanel(p); return; }
            openChromePanel(p);
        };
        /* 关闭挂点：同步程序坞指示点并清理全部触发图标选中态 */
        window.chromeMenuClosed = function () {
            if (!isMenuMode()) return;
            MENU_PANELS.forEach(function (p) { setTriggerActive(p, false); });
            updateDockIndicators();
        };

        /* 点击面板/窗口外任意处关闭；点在触发图标上则切换开合 */
        doc.addEventListener('mousedown', function (e) {
            if (!isMenuMode()) return;
            for (var i = 0; i < MENU_PANELS.length; i++) {
                var p = MENU_PANELS[i];
                if (!isOpen(p)) continue;
                var el = doc.getElementById(p.id);
                if (el && el.contains(e.target)) return;
                var trig = p.trigger ? doc.getElementById(p.trigger) : null;
                if (trig && trig.contains(e.target)) {
                    closePanel(p);
                    p._toggleGuard = Date.now();
                    return;
                }
                closePanel(p);
                return;
            }
        }, true);

        /* Esc 关闭：优先收菜单面板；无面板时关闭当前激活（z 最高）的 DWM 浮窗——
           scope 对话框/中止对话框显示时不动作（对话框自有 Esc）；
           关闭路径复用各窗口红灯（左上角关闭按钮）完全相同的入口代码 */
        function closeDwmWindowByRedDot(id) {
            if (id === 'about-modal' && typeof window.closeAboutModal === 'function') { window.closeAboutModal(); return; }
            if (id === 'pdf-viewer-modal' && typeof closePdfViewer === 'function') { closePdfViewer(); return; }
            if (id === 'update-modal') { if (typeof updateRunning === 'undefined' || !updateRunning) closeUpdateModal(); return; }
            if (id === 'self-check-modal') { forceCloseProcessConfirm('self-check'); return; }
            if (id.indexOf('process-modal-') === 0) { forceCloseProcessConfirm(id.slice('process-modal-'.length)); return; }
            if (window.DWM) window.DWM.close(id);
        }
        doc.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || !isMenuMode()) return;
            var anyPanel = MENU_PANELS.some(function (p) { return isOpen(p); });
            if (anyPanel) {
                MENU_PANELS.forEach(function (p) { if (isOpen(p)) closePanel(p); });
                return;
            }
            if (window.DWM && typeof window.DWM.getActiveWin === 'function') {
                var dialogOpen = doc.querySelector('.self-check-alert.visible, .cognitive-modal.visible, .update-modal.visible:not(.dwm-modal)');
                if (dialogOpen) return;
                var aborted = doc.getElementById('os-aborted-modal');
                if (aborted && aborted.classList.contains('visible')) return;
                var activeId = window.DWM.getActiveWin();
                if (activeId) closeDwmWindowByRedDot(activeId);
            }
        });

        /* NSMenu 菜单项动作委托（系统菜单/状态菜单通用；点击后先收起所属菜单） */
        doc.addEventListener('click', function (e) {
            var item = e.target.closest('.ns-menu-item[data-menu-action]');
            if (!item) return;
            var panelEl = item.closest('.ns-menu');
            var p = panelEl ? findPanel(panelEl.id) : null;
            if (p) closePanel(p);
            var act = item.getAttribute('data-menu-action');
            if (act === 'about' && typeof window.openAboutModal === 'function') {
                window.openAboutModal();
            } else if (act === 'cache-console' && typeof window.openCacheConsole === 'function') {
                window.openCacheConsole();
            } else if (act === 'restart' && typeof showSelfCheckAlert === 'function' && typeof restartRobot === 'function') {
                showSelfCheckAlert('确定要重新启动机器人吗？', function () { restartRobot(); });
            } else if (act === 'shutdown' && typeof showSelfCheckAlert === 'function' && typeof shutdownRobot === 'function') {
                showSelfCheckAlert('确定要关闭机器人吗？', function () { shutdownRobot(); });
            } else if (act === 'logout' && typeof showSelfCheckAlert === 'function' && typeof window.logout === 'function') {
                const n = typeof getModelInfo === 'function' ? getModelInfo('shortName') : 'T31-750';
                const isEn = window.I18N && I18N.getLang() === 'en';
                showSelfCheckAlert(isEn ? `Log out of "${n}"?` : `确定要退出登录“${n}”吗？`, function () { window.logout(); });
            } else if (act === 'open-bt' && typeof showBtModal === 'function') {
                showBtModal();
            } else if (act === 'disconnect' && typeof btDisconnect === 'function') {
                btDisconnect();
            } else if (act === 'mode' && !state.poweredOff && typeof activateMode === 'function') {
                activateMode(item.getAttribute('data-mode'));
            }
        });

        /* 尺寸变化：重锚定打开中的面板；退出菜单模式时清除内联定位并收回程序坞 */
        window.addEventListener('resize', function () {
            if (!isMenuMode()) {
                MENU_PANELS.forEach(function (p) {
                    var el = doc.getElementById(p.id);
                    if (el) { el.style.right = ''; el.style.left = ''; }
                });
                doc.body.classList.remove('dock-open');
            } else {
                MENU_PANELS.forEach(function (p) { if (isOpen(p)) positionMenuPanel(p.id); });
            }
            updateDockVisibility();
        });

        function updateDockVisibility() {
            if (!dock) return;
            var main = doc.getElementById('main-content');
            var enabled = isMenuMode() && !!(main && main.style.display === 'block');
            doc.body.classList.toggle('dock-enabled', enabled);
            if (!enabled) {
                doc.body.classList.remove('dock-open');
                if (_dockHideTimer) { clearTimeout(_dockHideTimer); _dockHideTimer = null; }
            }
            updateDockIndicators();
        }
        window.updateDesktopDock = updateDockVisibility;

        function openDock() {
            if (_dockHideTimer) { clearTimeout(_dockHideTimer); _dockHideTimer = null; }
            doc.body.classList.add('dock-open');
        }
        function scheduleDockHide() {
            if (_dockHideTimer) clearTimeout(_dockHideTimer);
            _dockHideTimer = setTimeout(function () {
                _dockHideTimer = null;
                doc.body.classList.remove('dock-open');
                resetDockMagnify();
            }, 180);
        }
        /* 平滑缩回静止布局：目标置为静止态，rAF 循环插值过渡，收敛后清理内联样式与快照 */
        function resetDockMagnify() {
            if (!dock) return;
            if (dock.style.width === '' && !dock.querySelector('.dock-item[style]')) { _dockBase = null; return; }
            if (!_dockBase) {
                dock.style.width = '';
                dock.querySelectorAll('.dock-item').forEach(function (it) { it.style.transform = ''; });
                return;
            }
            _magResting = true;
            _dockBase.flow.forEach(function (o) { if (o.isItem) { o.ts = 1; o.tdx = 0; } });
            _dockTargetWidth = _dockBase.content + _dockPadX * 2 + _dockBorderX;
            startMagLoop();
        }

        if (dock) {
            /* 鼠标触底缘浮起；离开程序坞区域收回 */
            doc.addEventListener('mousemove', function (e) {
                if (!doc.body.classList.contains('dock-enabled')) return;
                if (_dockRaf) return;
                _dockRaf = requestAnimationFrame(function () {
                    _dockRaf = null;
                    if (e.clientY >= window.innerHeight - 8) { openDock(); return; }
                    if (doc.body.classList.contains('dock-open')) {
                        var r = dock.getBoundingClientRect();
                        var overDock = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 6;
                        var overPanel = MENU_PANELS.some(function (p) {
                            var el = doc.getElementById(p.id);
                            return !!(el && el.contains(e.target));
                        });
                        if (!overDock && !overPanel) scheduleDockHide();
                    }
                });
            });
            dock.addEventListener('mouseenter', openDock);
            dock.addEventListener('mouseleave', scheduleDockHide);
            /* 触摸放大（macOS 式）：光标所在图标放大浮起，相邻图标按距离衰减缩放并被挤动位移。
               mousemove 只记录目标，rAF 常驻循环对 scale/位移/坞宽做指数平滑插值（约 0.32/帧），
               目标变化实时跟随、静止后自停——事件间隔不再丢帧，放大连贯跟手且零持续开销。
               进坞时快照一次静止布局（子项基宽/基中心），放大期间零布局读取——
               消除「宽度过渡追赶 + flex 居中重排」造成的图标漂移 */
            var _dockPadX = 12, _dockBorderX = 2, _magRaf = null, _dockBase = null;
            var _magResting = false, _dockWidth = 0, _dockTargetWidth = 0;
            function snapshotDockBase() {
                var cs = getComputedStyle(dock);
                var gap = parseFloat(cs.columnGap) || 10;
                _dockPadX = parseFloat(cs.paddingLeft) || 12;
                _dockBorderX = (parseFloat(cs.borderLeftWidth) || 1) + (parseFloat(cs.borderRightWidth) || 1);
                var flow = [];
                Array.prototype.forEach.call(dock.children, function (el) {
                    if (getComputedStyle(el).display === 'none') return;
                    var w = el.offsetWidth;
                    flow.push({ el: el, w: w, isItem: el.classList.contains('dock-item'), c: 0, s: 1, dx: 0, ts: 1, tdx: 0 });
                });
                var content = 0;
                flow.forEach(function (o, i) {
                    if (i > 0) content += gap;
                    if (o.isItem) o.c = content + o.w / 2;
                    content += o.w;
                });
                _dockBase = { gap: gap, flow: flow, content: content };
                _dockWidth = content + _dockPadX * 2 + _dockBorderX;
                _dockTargetWidth = _dockWidth;
            }
            function computeMagTargets(clientX) {
                var flow = _dockBase.flow, R = 150, MAX = 1.42;
                /* 光标 x 换算到基内容坐标系（坞居中：left:50% + translateX(-50%)），出界时夹到坞缘避免整列突跳 */
                var layoutLeft = window.innerWidth / 2 - (_dockBase.content + _dockPadX * 2 + _dockBorderX) / 2;
                var cx = Math.max(0, Math.min(_dockBase.content, clientX - layoutLeft - _dockPadX));
                flow.forEach(function (o) {
                    if (!o.isItem) return;
                    var d = Math.abs(cx - o.c);
                    o.ts = d >= R ? 1 : 1 + (MAX - 1) * Math.pow(1 - d / R, 1.6);
                });
                /* 按缩放后宽度紧凑重排（含分隔线），得到每项目标位移与容器目标宽度 */
                var packed = 0;
                flow.forEach(function (o, i) {
                    if (i > 0) packed += _dockBase.gap;
                    var sw = o.w * o.ts;
                    if (o.isItem) o.tdx = packed + sw / 2 - o.c;
                    packed += sw;
                });
                _dockTargetWidth = packed + _dockPadX * 2 + _dockBorderX;
            }
            function magFrame() {
                _magRaf = null;
                if (!_dockBase) return;
                var settled = true;
                _dockBase.flow.forEach(function (o) {
                    if (!o.isItem) return;
                    if (Math.abs(o.ts - o.s) > 0.002 || Math.abs(o.tdx - o.dx) > 0.3) settled = false;
                    o.s += (o.ts - o.s) * 0.32;
                    o.dx += (o.tdx - o.dx) * 0.32;
                });
                if (Math.abs(_dockTargetWidth - _dockWidth) > 0.5) settled = false;
                _dockWidth += (_dockTargetWidth - _dockWidth) * 0.32;
                dock.style.width = _dockWidth.toFixed(1) + 'px';
                _dockBase.flow.forEach(function (o) {
                    if (!o.isItem) return;
                    var lift = -(o.s - 1) * 34;
                    o.el.style.transform = 'translateX(' + o.dx.toFixed(1) + 'px) translateY(' + lift.toFixed(1) + 'px) scale(' + o.s.toFixed(3) + ')';
                });
                if (settled) {
                    if (_magResting) { /* 已回到静止布局：清理内联样式与快照 */
                        dock.style.width = '';
                        _dockBase.flow.forEach(function (o) { if (o.isItem) o.el.style.transform = ''; });
                        _dockBase = null;
                    }
                    return;
                }
                _magRaf = requestAnimationFrame(magFrame);
            }
            function startMagLoop() {
                if (!_magRaf) _magRaf = requestAnimationFrame(magFrame);
            }
            dock.addEventListener('mousemove', function (e) {
                if (!_dockBase) snapshotDockBase();
                _magResting = false;
                computeMagTargets(e.clientX);
                startMagLoop();
            });
            dock.addEventListener('mouseleave', resetDockMagnify);
            /* 点击：已打开的窗口 → 高亮（macOS 语义：程序坞不关闭窗口）；未打开 → 打开并高亮；
               控制台 = 收起全部面板并高亮主界面；浮窗区图标 = genie 恢复最小化窗口 / 置顶聚焦已开窗口 */
            dock.addEventListener('click', function (e) {
                var item = e.target.closest('.dock-item');
                if (!item) return;
                if (item.classList.contains('dock-window-item')) {
                    bounceDockItem(item);
                    if (window.DWM) window.DWM.dockActivate(item.id);
                    return;
                }
                var action = item.getAttribute('data-action');
                bounceDockItem(item);
                /* 主界面窗口区图标：滚动定位并高亮对应三栏窗口 */
                if (action && action.indexOf('win-') === 0) {
                    var target = doc.getElementById('triple-' + action.slice(4));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        target.classList.remove('window-highlight');
                        void target.offsetWidth;
                        target.classList.add('window-highlight');
                        setTimeout(function () { target.classList.remove('window-highlight'); }, 1400);
                    }
                    return;
                }
                if (action === 'console') {
                    MENU_PANELS.forEach(function (p) { closePanel(p); });
                    highlightConsole();
                }
            });
        }

        function bounceDockItem(item) {
            item.classList.remove('dock-bounce');
            void item.offsetWidth;
            item.classList.add('dock-bounce');
            setTimeout(function () { item.classList.remove('dock-bounce'); }, 640);
        }
        function highlightConsole() {
            var layout = doc.querySelector('.triple-column-layout');
            if (!layout) return;
            layout.classList.remove('console-highlight');
            void layout.offsetWidth;
            layout.classList.add('console-highlight');
            setTimeout(function () { layout.classList.remove('console-highlight'); }, 1400);
        }

        /* 菜单栏新触发图标：Rt5 系统菜单 / 电池 / 网络 / 机器人模式 */
        [['triple-logo-btn', 'logo-menu'], ['triple-battery-icon', 'battery-menu'], ['triple-net-icon', 'network-menu'], ['triple-mode-icon', 'mode-menu']].forEach(function (pair) {
            var trig = doc.getElementById(pair[0]);
            if (!trig) return;
            trig.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleMenuPanel(pair[1]);
            });
        });

        /* 关于本机窗口标题栏：红灯关闭（黄灯最小化 / 绿灯最大化由桌面窗口管理器统一绑定） */
        var aboutCloseDot = doc.getElementById('about-close-dot');
        if (aboutCloseDot) aboutCloseDot.addEventListener('click', function () { if (typeof window.closeAboutModal === 'function') window.closeAboutModal(); });

        /* ===== 桌面窗口管理器（DWM）：关于本机 / 过程窗口 / PDF 阅读器统一为 macOS 式浮窗——
           标题栏任意拖动、八向拉伸缩放、黄灯最小化到程序坞 / 坞图标恢复（genie 式连贯动画）、
           绿灯最大化（菜单栏保留，双击标题栏同效）、点击置顶聚焦；窗口与遮罩一律不做背景模糊。
           仅 desktop-chrome 且 ≥750px（isMenuMode）生效，Android 与移动端路径不变。 ===== */
        window.DWM = (function () {
            var Z_MIN = 920, Z_MAX = 938, zTop = Z_MIN;
            var defs = {
                'about-modal': {
                    winSel: '.about-window', tbSel: '.about-titlebar', openCls: 'visible', dockItem: 'dock-about-window',
                    minW: 620, minH: 420, defRect: function (vw) { return { w: Math.min(900, vw - 48), h: null, estH: 680 }; }
                },
                'self-check-modal': {
                    winSel: '.self-check-content', tbSel: '.self-check-content .cp-title', openCls: 'visible', dockItem: 'dock-process-window',
                    minW: 560, minH: 360, defRect: function (vw, vh) { return { w: Math.min(1024, vw - 56), h: Math.min(Math.round(vh * 0.85), 900) }; }
                },
                'pdf-viewer-modal': {
                    winSel: '.pdf-viewer-container', tbSel: '.pdf-viewer-container .cp-title', openCls: 'pdf-viewer-visible', dockItem: 'dock-pdf-window',
                    minW: 480, minH: 340, defRect: function (vw, vh) { return { w: Math.min(920, vw - 56), h: Math.min(720, vh - 96) }; }
                },
                'update-modal': {
                    winSel: '.update-modal-content', tbSel: '.update-modal-content .cp-title', openCls: 'visible', dockItem: 'dock-process-window',
                    minW: 480, minH: 360, defRect: function (vw, vh) { return { w: Math.min(560, vw - 56), h: Math.min(620, vh - 120) }; }
                }
            };
            var recs = {};
            function headerH() {
                /* 自 body 读取：html.win-desktop 的 80px 经继承到达 body，而 win-app 全屏
                   （body.win-fullscreen）的 40px 覆盖只写在 body 上——读 documentElement
                   会在全屏下仍取 80px，拖动/最大化上界与真实菜单栏下缘错开 40px */
                var v = parseFloat(getComputedStyle(document.body).getPropertyValue('--header-total'));
                return isNaN(v) ? 40 : v;
            }
            function rec(id) { return recs[id] || null; }
            function isOpen(r) { return r.modal.classList.contains(r.d.openCls); }
            function bringToFront(r) {
                /* 登录前提层窗口（缓存控制台 z 955 > 登录层 950）不参与 920-938 浮窗焦点序——
                   窗口内任意点击都会走到这里，重写 z 会让窗口掉到登录层之下被盖住（无法操作/关闭） */
                if ((parseInt(r.modal.style.zIndex, 10) || 0) >= 950) {
                    if (typeof window.syncScopedDialogs === 'function') window.syncScopedDialogs();
                    return;
                }
                if (zTop >= Z_MAX) { /* 焦点序号用尽：按当前叠放次序重新归一化（提层窗口除外） */
                    var ordered = Object.keys(recs).map(function (k) { return recs[k]; })
                        .filter(function (o) { return o.modal.style.zIndex && (parseInt(o.modal.style.zIndex, 10) || 0) < 950; })
                        .sort(function (a, b) { return (+a.modal.style.zIndex) - (+b.modal.style.zIndex); });
                    zTop = Z_MIN - 1;
                    ordered.forEach(function (o) { o.modal.style.zIndex = ++zTop; });
                }
                r.modal.style.zIndex = ++zTop;
                /* 窗口叠放变化时同步其 scope 对话框层级与矩形（只高于所属窗口） */
                if (typeof window.syncScopedDialogs === 'function') window.syncScopedDialogs();
            }
            function defaultRect(r) {
                var vw = window.innerWidth, vh = window.innerHeight, b = r.d.defRect(vw, vh);
                var w = Math.max(r.d.minW, b.w);
                var h = b.h == null ? null : Math.max(r.d.minH, Math.min(b.h, vh - headerH() - 24));
                /* defPos：窗口类型自带默认落位（如 Male_2 图片窗口固定屏幕右侧），仍钳回可视范围 */
                if (r.d.defPos) {
                    var p = r.d.defPos(vw, vh, w, h);
                    return {
                        left: Math.max(-(w - 120), Math.min(vw - 120, p.left)),
                        top: Math.max(headerH() + 12, Math.min(p.top, vh - 60)),
                        w: w, h: h
                    };
                }
                /* 高度自适应窗口按 estH 估算，默认位置完整落在视口内且屏幕居中 */
                var top = h == null
                    ? Math.max(headerH() + 12, Math.round((vh - Math.min(b.estH || 440, vh - headerH() - 24)) / 2))
                    : Math.max(headerH() + 12, Math.round((vh - h) / 2) - 10);
                return { left: Math.round((vw - w) / 2), top: top, w: w, h: h };
            }
            function applyRect(r) {
                var s = r.winEl.style;
                s.left = r.rect.left + 'px';
                s.top = r.rect.top + 'px';
                s.width = r.rect.w + 'px';
                s.height = r.rect.h == null ? '' : r.rect.h + 'px';
                /* 窗口矩形变化时同步其上显示中的 scope 对话框（模糊/对话框始终只覆盖窗口本体） */
                if (typeof window.syncScopedDialogs === 'function') window.syncScopedDialogs();
            }
            function ensureRec(id) {
                if (recs[id]) return recs[id];
                var d = defs[id];
                var modal = d && document.getElementById(id);
                var winEl = modal && modal.querySelector(d.winSel);
                if (!winEl) return null;
                /* 桌面浮窗化：遮罩不拦截点击、窗口接管定位（样式见 .dwm-modal/.dwm-window） */
                modal.classList.add('dwm-modal');
                winEl.classList.add('dwm-window');
                var r = recs[id] = {
                    id: id, d: d, modal: modal, winEl: winEl, tbEl: winEl.querySelector(d.tbSel),
                    rect: null, minimized: false, maximized: false, restoreRect: null, chromeReady: false, anim: null
                };
                return r;
            }
            function ensureChrome(r) {
                if (r.chromeReady) return;
                r.chromeReady = true;
                ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (dir) {
                    var h = document.createElement('div');
                    h.className = 'dwm-rs dwm-rs-' + dir;
                    h.addEventListener('mousedown', function (e) { startResize(r, dir, e); });
                    r.winEl.appendChild(h);
                });
                if (r.tbEl) {
                    r.tbEl.addEventListener('mousedown', function (e) { startDrag(r, e); });
                    r.tbEl.addEventListener('dblclick', function (e) {
                        if (e.target.closest('.cp-dot, button, a, input, .pdf-viewer-toolbar')) return;
                        toggleMax(r);
                    });
                }
                /* 窗口内任意点击置顶聚焦（macOS 语义） */
                r.winEl.addEventListener('mousedown', function () { bringToFront(r); }, true);
            }
            function startDrag(r, e) {
                if (!isMenuMode() || e.button !== 0) return;
                if (e.target.closest('.cp-dot, button, a, input, .pdf-viewer-toolbar')) return;
                e.preventDefault();
                bringToFront(r);
                if (r.maximized) { /* macOS：拖动最大化窗口即还原，光标保持在标题栏上的相对位置 */
                    var w0 = r.restoreRect ? r.restoreRect.w : r.winEl.offsetWidth;
                    r.maximized = false;
                    r.winEl.classList.remove('dwm-max');
                    r.rect = { left: Math.round(e.clientX - w0 / 2), top: Math.max(headerH(), e.clientY - 19), w: w0, h: r._hAuto ? null : (r.restoreRect ? r.restoreRect.h : r.rect.h) };
                    r.restoreRect = null;
                    applyRect(r);
                }
                var sx = e.clientX, sy = e.clientY, ol = r.rect.left, ot = r.rect.top;
                function mv(ev) {
                    var vw = window.innerWidth, vh = window.innerHeight;
                    r.rect.left = Math.max(-(r.rect.w - 120), Math.min(vw - 120, ol + ev.clientX - sx));
                    r.rect.top = Math.max(headerH(), Math.min(vh - 60, ot + ev.clientY - sy));
                    applyRect(r);
                }
                function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
                document.addEventListener('mousemove', mv);
                document.addEventListener('mouseup', up);
            }
            function startResize(r, dir, e) {
                if (!isMenuMode() || e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                bringToFront(r);
                if (r.maximized) { r.maximized = false; r.restoreRect = null; r.winEl.classList.remove('dwm-max'); syncDock(r); }
                var sx = e.clientX, sy = e.clientY;
                var base = { left: r.rect.left, top: r.rect.top, w: r.winEl.offsetWidth, h: r.winEl.offsetHeight };
                function mv(ev) {
                    var dx = ev.clientX - sx, dy = ev.clientY - sy;
                    var rect = { left: base.left, top: base.top, w: base.w, h: base.h };
                    if (dir.indexOf('e') >= 0) rect.w = base.w + dx;
                    if (dir.indexOf('s') >= 0) rect.h = base.h + dy;
                    if (dir.indexOf('w') >= 0) { rect.w = base.w - dx; rect.left = base.left + dx; }
                    if (dir.indexOf('n') >= 0) { rect.h = base.h - dy; rect.top = base.top + dy; }
                    if (rect.w < r.d.minW) { if (dir.indexOf('w') >= 0) rect.left -= r.d.minW - rect.w; rect.w = r.d.minW; }
                    if (rect.h != null && rect.h < r.d.minH) { if (dir.indexOf('n') >= 0) rect.top -= r.d.minH - rect.h; rect.h = r.d.minH; }
                    var hh = headerH();
                    if (rect.top < hh) { if (rect.h != null) rect.h = Math.max(rect.h - (hh - rect.top), r.d.minH); rect.top = hh; }
                    if (rect.left > window.innerWidth - 120) rect.left = window.innerWidth - 120;
                    r.rect = rect;
                    applyRect(r);
                }
                function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
                document.addEventListener('mousemove', mv);
                document.addEventListener('mouseup', up);
            }
            function toggleMax(r) {
                if (!r || !isOpen(r)) return;
                if (!r.maximized) {
                    r._hAuto = r.rect.h == null; /* 高度自适应窗口（如关于本机）还原时恢复自适应 */
                    r.restoreRect = { left: r.rect.left, top: r.rect.top, w: r.rect.w, h: r.rect.h == null ? r.winEl.offsetHeight : r.rect.h };
                    r.rect = { left: 0, top: headerH(), w: window.innerWidth, h: window.innerHeight - headerH() };
                    r.maximized = true;
                } else {
                    var rr = r.restoreRect || defaultRect(r);
                    r.rect = { left: rr.left, top: rr.top, w: rr.w, h: r._hAuto ? null : rr.h };
                    r.restoreRect = null;
                    r.maximized = false;
                }
                /* 最大化/还原：短暂启用位置过渡得到连贯缩放动画；全屏态去圆角（.dwm-max） */
                r.winEl.classList.toggle('dwm-max', r.maximized);
                r.winEl.classList.add('dwm-anim');
                applyRect(r);
                setTimeout(function () { r.winEl.classList.remove('dwm-anim'); }, 340);
                bringToFront(r);
            }
            function genieTarget(r) {
                dockPeekShow();
                var item = document.getElementById(dockItemFor(r));
                var ir = (item && item.offsetWidth > 0) ? item.getBoundingClientRect()
                    : { left: window.innerWidth / 2 - 30, top: window.innerHeight - 40, width: 60, height: 60 };
                var wr = r.winEl.getBoundingClientRect();
                var sx = Math.max(0.05, Math.min(0.45, ir.width * 0.92 / wr.width));
                var sy = Math.max(0.04, Math.min(0.4, ir.height * 0.92 / wr.height));
                var dx = Math.round(ir.left + ir.width / 2 - (wr.left + wr.width / 2));
                var dy = Math.round(ir.top + ir.height / 2 - (wr.top + wr.height / 2));
                return 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
            }
            function stopAnim(r) { if (r.anim) { r.anim.cancel(); r.anim = null; } }
            /* genie 期间程序坞自动浮起（macOS 语义）：坞自动隐藏时图标矩形在视口外，
               不浮起会让窗口飞向屏幕外。瞬浮（禁过渡一帧）保证 genie 目标矩形按浮起静止位计算 */
            var _dockPeek = 0;
            function dockPeekShow() {
                if (!document.body.classList.contains('dock-enabled')) return;
                if (!document.body.classList.contains('dock-open')) {
                    document.body.classList.add('dock-open');
                    var dockEl = document.getElementById('desktop-dock');
                    if (dockEl) {
                        dockEl.style.transition = 'none';
                        void dockEl.offsetHeight;
                        dockEl.style.transition = '';
                    }
                }
            }
            function dockPeekBegin() { _dockPeek++; dockPeekShow(); }
            function dockPeekEnd() {
                _dockPeek = Math.max(0, _dockPeek - 1);
                if (_dockPeek === 0) setTimeout(function () {
                    if (_dockPeek === 0) document.body.classList.remove('dock-open');
                }, 660); /* 略长于图标弹跳，弹完再收 */
            }
            function dockPeekReset() {
                _dockPeek = 0;
                document.body.classList.remove('dock-open');
            }
            function playGenie(r, toDock, presetT, duration) {
                stopAnim(r);
                dockPeekBegin();
                var t = presetT || genieTarget(r);
                /* 三帧关键帧：吸入坞前 72% 行程窗口保持实体、仅贴合图标时收没；
                   从坞放大对称（开头 28% 快速显形后实体飞向窗口位）——两端全程连贯无中途渐隐。
                   帧级 easing：位移段用 genie 曲线，显形/收没段用平缓曲线 */
                var kf = toDock
                    ? [
                        { transform: 'none', opacity: 1, easing: 'cubic-bezier(0.55, 0, 0.85, 0.36)' },
                        { transform: t, opacity: 1, offset: 0.72, easing: 'ease-out' },
                        { transform: t, opacity: 0 }
                    ]
                    : [
                        { transform: t, opacity: 0, easing: 'ease-out' },
                        { transform: t, opacity: 1, offset: 0.28, easing: 'cubic-bezier(0.3, 1.25, 0.5, 1)' },
                        { transform: 'none', opacity: 1 }
                    ];
                var a = r.winEl.animate(kf, { duration: duration || (toDock ? 380 : 340), fill: 'forwards' });
                a.finished.then(function () { dockPeekEnd(); }, function () { dockPeekEnd(); });
                r.anim = a;
                return a;
            }
            /* 中止对话框宿主窗口：中止期间保持原状可见，禁用最小化（防对话框悬空） */
            function isAborted(r) {
                var m = document.getElementById('os-aborted-modal');
                return !!(m && m.classList.contains('visible') && m._abortedHost === r.winEl);
            }
            function minimize(id) {
                var r = rec(id);
                if (!r || !isMenuMode() || r.minimized || !isOpen(r)) return false;
                if (isAborted(r)) return false;
                /* genie 动画不经 applyRect，先撤 scope 到该窗口的对话框（模糊/对话框不得超出窗口） */
                if (typeof window.dismissScopedDialogsFor === 'function') window.dismissScopedDialogsFor(r.winEl);
                r.minimized = true;
                bringToFront(r);
                /* 先同步坞图标再播 genie：目标即真实图标矩形，窗口从当前位置连贯吸入程序坞 */
                syncDock(r);
                var a = playGenie(r, true);
                var done = false;
                var fin = function () {
                    if (done) return;
                    done = true;
                    /* 先禁过渡瞬时隐藏容器再取消动画：避免 fill 取消后窗口一帧回到全尺寸原位、
                       叠加 0.16s 容器淡出造成收尾闪影 */
                    r.modal.style.transition = 'none';
                    r.modal.classList.remove(r.d.openCls);
                    try { a.cancel(); } catch (e) {}
                    r.anim = null;
                    void r.modal.offsetWidth;
                    r.modal.style.transition = '';
                    if (typeof window.chromeMenuClosed === 'function') window.chromeMenuClosed(r.id);
                    if (typeof window.notifyModalState === 'function') window.notifyModalState();
                    syncDock(r);
                    var di = document.getElementById(dockItemFor(r));
                    if (di) bounceDockItem(di); /* 图标就位后再弹跳 */
                };
                a.finished.then(fin).catch(function () { r.anim = null; });
                setTimeout(fin, 440); /* 兜底：渲染卡顿/节流时保证收尾，避免窗口卡在动画态 */
                return true;
            }
            function restore(id) {
                var r = rec(id);
                if (!r || !isMenuMode()) return false;
                if (!r.minimized) { if (isOpen(r)) bringToFront(r); return false; }
                r.minimized = false;
                /* 最大化窗口保持全屏态（dwm-max 与 r.maximized 同步），仅普通窗口恢复圆角 */
                r.winEl.classList.toggle('dwm-max', r.maximized);
                /* 预置首帧为坞图标矩形：类切换当帧即处于动画起点，无全尺寸闪帧，从程序坞连贯放大到窗口 */
                var t0 = genieTarget(r);
                r.winEl.style.transform = t0;
                r.winEl.style.opacity = '0';
                r.modal.classList.add(r.d.openCls);
                document.body.style.overflow = 'hidden';
                bringToFront(r);
                var a = playGenie(r, false, t0);
                var done = false;
                var fin = function () {
                    if (done) return;
                    done = true;
                    try { a.cancel(); } catch (e) {}
                    r.anim = null;
                    r.winEl.style.transform = '';
                    r.winEl.style.opacity = '';
                };
                a.finished.then(fin).catch(function () { r.anim = null; });
                setTimeout(fin, 400);
                if (typeof window.notifyModalState === 'function') window.notifyModalState();
                syncDock(r);
                return true;
            }
            function open(id) {
                var r = ensureRec(id);
                if (!r || !isMenuMode()) return;
                var wasMin = r.minimized;
                r.minimized = false;
                if (!r.rect) {
                    r.rect = defaultRect(r);
                    /* 级联偏移：与已打开且同位的窗口错开（macOS 式层叠），多窗口并存可见 */
                    var cascade = 0;
                    Object.keys(recs).forEach(function (k) {
                        var o = recs[k];
                        if (o === r || !isOpen(o) || !o.rect) return;
                        if (Math.abs(o.rect.left - r.rect.left) < 4 && Math.abs(o.rect.top - r.rect.top) < 4) cascade++;
                    });
                    if (cascade > 0) {
                        r.rect.left = Math.min(r.rect.left + cascade * 28, window.innerWidth - 120);
                        r.rect.top = Math.min(r.rect.top + cascade * 28, window.innerHeight - 60);
                    }
                }
                applyRect(r);
                var t0 = null;
                if (wasMin) {
                    /* 预置首帧为坞图标矩形：类切换当帧即处于动画起点，无全尺寸闪帧 */
                    t0 = genieTarget(r);
                    r.winEl.style.transform = t0;
                    r.winEl.style.opacity = '0';
                } else {
                    r.winEl.style.transform = 'none';
                }
                ensureChrome(r);
                stopAnim(r);
                bringToFront(r);
                if (wasMin) {
                    var a = playGenie(r, false, t0);
                    var done = false;
                    var fin = function () {
                        if (done) return;
                        done = true;
                        try { a.cancel(); } catch (e) {}
                        r.anim = null;
                        r.winEl.style.transform = '';
                        r.winEl.style.opacity = '';
                    };
                    a.finished.then(fin).catch(function () { r.anim = null; });
                    setTimeout(fin, 400);
                }
                syncDock(r);
            }
            /* 关闭：桌面路径 genie 吸入坞图标（退出动画，窗口从当前位置连贯收入程序坞）；
               关闭即重置矩形/最大化状态——重新打开回到默认居中位，避免以旧尺寸（如全屏矩形）瞬现。
               opts.instant 立即关闭。返回 true=已按桌面浮窗处理（调用方勿重复移除 openCls），
               false=非桌面路径由调用方自行关闭 */
            function close(id, opts) {
                var r = rec(id);
                if (!r) return false;
                if (typeof window.onAbortedWindowClose === 'function') window.onAbortedWindowClose(id);
                /* genie 动画不经 applyRect，先撤 scope 到该窗口的对话框（模糊/对话框不得超出窗口） */
                if (typeof window.dismissScopedDialogsFor === 'function') window.dismissScopedDialogsFor(r.winEl);
                stopAnim(r);
                r.minimized = false;
                r.maximized = false;
                r.restoreRect = null;
                r.winEl.classList.remove('dwm-max');
                if (!isMenuMode() || !isOpen(r) || (opts && opts.instant)) {
                    r.modal.classList.remove(r.d.openCls);
                    r.rect = null;
                    syncDock(r);
                    return isMenuMode();
                }
                syncDock(r); /* 先显示坞图标，genie 目标为真实图标矩形 */
                var a = playGenie(r, true, null, 320);
                var done = false;
                var fin = function () {
                    if (done) return;
                    done = true;
                    r.modal.style.transition = 'none';
                    r.modal.classList.remove(r.d.openCls);
                    try { a.cancel(); } catch (e) {}
                    r.anim = null;
                    void r.modal.offsetWidth;
                    r.modal.style.transition = '';
                    r.rect = null;
                    if (typeof window.notifyModalState === 'function') window.notifyModalState();
                    syncDock(r);
                };
                a.finished.then(fin).catch(function () { r.anim = null; fin(); });
                setTimeout(fin, 380);
                return true;
            }
            /* 阅读器窗口的坞图标按内容区分：说明书 → dock-manual-window，PDF → dock-pdf-window
               （两者共用 pdf-viewer-modal 实例，dockItem 需按当前文件动态解析） */
            function dockItemFor(r) {
                if (r.id === 'pdf-viewer-modal' && typeof currentPdfFile !== 'undefined' && currentPdfFile && currentPdfFile.id === 'app-manual') {
                    return 'dock-manual-window';
                }
                return r.d.dockItem;
            }
            function syncDock(r) {
                /* 聚合同一坞图标的全部窗口实例：任一显示即显示图标，任一打开（非最小化）即带指示点。
                   阅读器窗口两图标（说明书/PDF）都重算：内容切换时旧图标不留残点。 */
                var candidates = (r.id === 'pdf-viewer-modal')
                    ? ['dock-manual-window', 'dock-pdf-window']
                    : [dockItemFor(r)];
                candidates.forEach(function (itemId) {
                    var item = document.getElementById(itemId);
                    if (!item) return;
                    var shown = false, open = false;
                    Object.keys(recs).forEach(function (k) {
                        var o = recs[k];
                        if (dockItemFor(o) !== itemId) return;
                        if (isOpen(o) || o.minimized) shown = true;
                        if (isOpen(o) && !o.minimized) open = true;
                    });
                    item.classList.toggle('window-shown', shown);
                    item.classList.toggle('window-open', open);
                });
            }
            function dockActivate(itemId) {
                /* 聚合同一坞图标的全部实例：优先恢复最小化窗口，否则置顶最上层的打开窗口 */
                var matches = Object.keys(recs).map(function (k) { return recs[k]; })
                    .filter(function (r) { return dockItemFor(r) === itemId; });
                var handled = matches.length > 0;
                var min = matches.filter(function (r) { return r.minimized; })[0];
                if (min) { restore(min.id); return; }
                var openRecs = matches.filter(function (r) { return isOpen(r); })
                    .sort(function (a, b) { return (+b.modal.style.zIndex || 0) - (+a.modal.style.zIndex || 0); });
                if (openRecs.length) {
                    var r = openRecs[0];
                    bringToFront(r);
                    r.winEl.classList.remove('menu-panel-highlight');
                    void r.winEl.offsetWidth;
                    r.winEl.classList.add('menu-panel-highlight');
                    setTimeout(function () { r.winEl.classList.remove('menu-panel-highlight'); }, 1400);
                    return;
                }
                /* 全部关闭：关于本机 / 说明书常驻图标直开；其余打开空实例兜底 */
                matches.forEach(function (r) {
                    if (r.id === 'about-modal' && typeof window.openAboutModal === 'function') { window.openAboutModal(); }
                    else if (r.id === 'pdf-viewer-modal' && typeof openManualViewer === 'function') { openManualViewer(); }
                    else open(r.id);
                });
                if (!handled && itemId === 'dock-about-window' && typeof window.openAboutModal === 'function') {
                    window.openAboutModal(); /* 常驻图标：从未打开过时直接打开 */
                }
                if (!handled && itemId === 'dock-manual-window' && typeof openManualViewer === 'function') {
                    openManualViewer(); /* 说明书常驻图标：直接应用内打开说明书 */
                }
            }
            /* 黄灯最小化 / 绿灯最大化（含双击标题栏）：三窗口红绿灯统一在此绑定 */
            [['about-min-dot', 'about-modal'], ['self-check-min-dot', 'self-check-modal'], ['pdf-min-dot', 'pdf-viewer-modal']].forEach(function (p) {
                var el = document.getElementById(p[0]);
                if (el) el.addEventListener('click', function (e) { e.stopPropagation(); minimize(p[1]); });
            });
            [['about-max-dot', 'about-modal'], ['self-check-max-dot', 'self-check-modal'], ['pdf-max-dot', 'pdf-viewer-modal']].forEach(function (p) {
                var el = document.getElementById(p[0]);
                if (el) el.addEventListener('click', function (e) { e.stopPropagation(); toggleMax(rec(p[1])); });
            });
            /* 视口变化：最大化窗口跟随尺寸，普通窗口收回到可视范围 */
            window.addEventListener('resize', function () {
                var vw = window.innerWidth, vh = window.innerHeight, hh = headerH();
                Object.keys(recs).forEach(function (k) {
                    var r = recs[k];
                    if (!r.modal.classList.contains(r.d.openCls) && !r.minimized) return;
                    if (r.maximized) { r.rect = { left: 0, top: hh, w: vw, h: vh - hh }; }
                    else {
                        r.rect.left = Math.max(-(r.rect.w - 120), Math.min(vw - 120, r.rect.left));
                        r.rect.top = Math.max(hh, Math.min(vh - 60, r.rect.top));
                        if (r.rect.h != null) r.rect.h = Math.min(r.rect.h, vh - hh);
                    }
                    applyRect(r);
                });
            });
            return {
                open: open, close: close, minimize: minimize, restore: restore,
                isMinimized: function (id) { var r = rec(id); return !!(r && r.minimized); },
                isOpenWin: function (id) { var r = rec(id); return !!(r && isOpen(r)); },
                /* 动态注册浮窗（过程窗口多实例 / 新窗口类型）：def 结构同 defs 表 */
                registerWin: function (id, def) {
                    if (!id || !def || defs[id]) return;
                    defs[id] = def;
                    if (typeof ensureRec === 'function') ensureRec(id);
                },
                /* 全部已注册浮窗 id（关机中止枚举用） */
                winIds: function () { return Object.keys(recs); },
                /* 当前激活（z 最高可见）浮窗 id，无则 null */
                getActiveWin: function () {
                    var top = null, topZ = -1;
                    Object.keys(recs).forEach(function (k) {
                        var r = recs[k];
                        if (!isOpen(r)) return;
                        var z = parseInt(r.modal.style.zIndex, 10) || 0;
                        if (z > topZ) { topZ = z; top = r.id; }
                    });
                    return top;
                },
                toggleMax: function (id) { toggleMax(rec(id)); },
                /* 重置窗口矩形与最大化状态：下次打开回默认屏幕居中位（开机过程窗口复用前调用） */
                resetRect: function (id) {
                    var r = rec(id);
                    if (!r) return;
                    r.rect = null;
                    r.restoreRect = null;
                    r._hAuto = false;
                    r.maximized = false;
                    r.winEl.classList.remove('dwm-max');
                },
                dockActivate: dockActivate,
                /* 取消全部浮窗进行中的 genie 动画（关机/重启中止用），并复位程序坞浮起 */
                abortAnimations: function () {
                    Object.keys(recs).forEach(function (k) { stopAnim(recs[k]); });
                    dockPeekReset();
                }
            };
        })();

        /* 初始化 */
        updateDockVisibility();
        updateDockIndicators();
    })();
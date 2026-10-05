// 毛玻璃标题栏窗口控制接线（仅 Electron 主控制台生效，Android/浏览器环境自动跳过）
  (function () {
    if (!window.consoleAPI) return;
    document.body.classList.add('win-desktop');
    var backBtn = document.getElementById('win-btn-back');
    var minBtn = document.getElementById('win-btn-min');
    var maxBtn = document.getElementById('win-btn-max');
    var closeBtn = document.getElementById('win-btn-close');
    var fullscreenBtn = document.getElementById('win-btn-fullscreen');
    var maxSvg = document.getElementById('win-max-svg');
    if (backBtn) backBtn.addEventListener('click', function () { window.consoleAPI.backToLauncher(); });
    if (minBtn) minBtn.addEventListener('click', function () { window.consoleAPI.minimizeWindow(); });
    if (closeBtn) closeBtn.addEventListener('click', function () { window.consoleAPI.closeWindow(); });
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', function () {
        if (typeof window.consoleAPI.toggleFullscreen === 'function') {
          window.consoleAPI.toggleFullscreen();
        }
      });
    }
    if (maxBtn) {
      maxBtn.addEventListener('click', function () { window.consoleAPI.toggleMaximize(); });
      var setMax = function (isMax) {
        maxBtn.title = isMax ? '还原' : '最大化';
        if (maxSvg) {
          maxSvg.innerHTML = isMax
            ? '<path d="M3.5 1.5h5v5h-5z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1.5 3.5h5v5h-5z" fill="none" stroke="currentColor" stroke-width="1"/>'
            : '<path d="M1.5 1.5h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1"/>';
        }
      };
      if (window.consoleAPI.onMaximizedChange) {
        window.consoleAPI.onMaximizedChange(setMax);
      }
    }
  })();

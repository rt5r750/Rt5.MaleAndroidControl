'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WWW_HTML = path.join(__dirname, '..', 'app', 'www', '芮誊T系列仿人男性机器人控制台V1.1.html');

test('main.js uses frameless window with custom frosted titlebar', () => {
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  // 无边框窗口 + 自绘标题栏（WCO 原生按钮在本环境无法渲染且图标状态异常）
  assert.match(mainJs, /frame:\s*false/);
  // 窗口级 Acrylic：标题栏对当前电脑桌面毛玻璃（与启动器一致）
  assert.match(mainJs, /backgroundMaterial:\s*'acrylic'/);
  assert.doesNotMatch(mainJs, /titleBarStyle/);
  assert.doesNotMatch(mainJs, /titleBarOverlay/);
  // 1.3.5 起窗口标题经主进程 i18n.t 按界面语言输出（EN 为 Connected to ...）
  assert.match(mainJs, /title:\s*i18n\.t\('已连接至T31-750型仿人男性机器人的内部系统'\)/);
  // 主窗口首帧渲染完成后再显示（ready-to-show），避免中间态/背景闪动
  assert.match(mainJs, /show:\s*false/);
  assert.match(mainJs, /ready-to-show/);
  // 全屏通过 F11 切换、Esc 退出
  assert.match(mainJs, /before-input-event/);
  assert.match(mainJs, /input\.key === 'F11'/);
  assert.match(mainJs, /input\.key === 'Escape'/);
});

test('win-app HTML contains titlebar fusion drag style', () => {
  const html = fs.readFileSync(WWW_HTML, 'utf8');
  const winCss = fs.readFileSync(path.join(__dirname, '..', 'app', 'www', 'css', 'win.css'), 'utf8');
  const fusionCss = fs.readFileSync(path.join(__dirname, '..', 'app', 'www', 'css', 'titlebar-fusion.css'), 'utf8');
  assert.match(html, /titlebar-fusion/);
  // 拖拽区样式实体在 titlebar-fusion.css（HTML 仅引用该样式表）
  assert.match(fusionCss, /-webkit-app-region:\s*drag/);
  assert.match(fusionCss, /html\.win-desktop \.triple-header-right\s*\{\s*right:\s*12px\s*!important;\s*\}/);
  assert.match(fusionCss, /\.win-ctrl-bar/);
  assert.match(fusionCss, /\.win-ctrl-btn/);
  assert.match(html, /id="win-btn-back"/);
  assert.match(html, /id="win-btn-fullscreen"/);
  assert.match(html, /id="win-btn-min"/);
  assert.match(html, /id="win-btn-max"/);
  assert.match(html, /id="win-btn-close"/);
  assert.match(html, /win-ctrl-close/);
  assert.match(html, /已连接至T31-750型仿人男性机器人的内部系统/);
  // 毛玻璃效果
  assert.match(fusionCss, /backdrop-filter:\s*blur\(2[02]px\)/);
  // 分层：保留桌面端 body 原始背景图（1.2.0 起为 Background.webp），标题栏对其模糊
  assert.match(fusionCss, /Background\.webp/);
  // 系统级 Acrylic：仅 Win 端 body 透明 + 网页背景下沉层，标题栏区域透出桌面毛玻璃
  assert.match(fusionCss, /html\.win-desktop, body\.win-desktop\s*\{\s*background:\s*transparent\s*!important/);
  assert.match(fusionCss, /html\.win-desktop #win-page-bg\s*\{/);
  assert.match(fusionCss, /top:\s*40px;/);
  assert.match(fusionCss, /z-index:\s*-1;/);
  assert.match(fusionCss, /html\.win-desktop \.login-modal,\s*html\.win-desktop \.settings-modal/);
  assert.match(fusionCss, /top:\s*40px\s*!important/);
  assert.match(winCss, /\.dynamic-island\s*\{[\s\S]*?top:\s*calc\(var\(--safe-area-top/);
  // 返回按钮与右侧按钮同款边距/动画；图标整体大一圈（12px）
  assert.match(fusionCss, /\.win-ctrl-btn svg \{\s*width:\s*12px;\s*height:\s*12px/);
  assert.match(fusionCss, /\.win-titlebar \{\s*display:\s*flex;[\s\S]*?padding:\s*0;/);
  // 全屏时隐藏标题栏（win.css），Esc / F11 退出
  assert.match(winCss, /body\.win-fullscreen \.win-titlebar\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(winCss, /body\.win-fullscreen \.triple-header-right\s*\{\s*right:\s*12px/);
  assert.doesNotMatch(html, /env\(titlebar-area-width/);
});

test('preload wires window controls overlay and sets css variable', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'app', 'preload.js'), 'utf8');
  assert.match(preload, /titlebarareachange/);
  assert.match(preload, /--win-controls-width/);
  assert.match(preload, /fullscreenchange/);
});

test('main.js wires window fullscreen events to page class', () => {
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  assert.match(mainJs, /enter-full-screen/);
  assert.match(mainJs, /leave-full-screen/);
  assert.match(mainJs, /win-fullscreen/);
});

test('main.js uses fixed app:// origin for stable localStorage', () => {
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  assert.match(mainJs, /registerSchemesAsPrivileged/);
  assert.match(mainJs, /protocol\.handle/);
  assert.match(mainJs, /APP_SCHEME/);
  assert.match(mainJs, /APP_HOST/);
  assert.match(mainJs, /loadURL.*splash\.html/);
});

test('main.js maps app://bundle host to app root so console splash can load', () => {
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  assert.match(mainJs, /bundle:\s*APP_ROOT/);
  // 启动器与主控制台 origin 必须稳定且不同：app://design 与 app://bundle
  assert.match(mainJs, /design:\s*DESIGN_ROOT/);
});

test('build icon is a valid ico containing 256px frame', async () => {
  const sourcePng = path.join(
    __dirname, '..', '..', 'android-app', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png'
  );
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  assert.ok(fs.existsSync(icoPath), 'build/icon.ico missing');
  const buf = fs.readFileSync(icoPath);
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1); // ICO type
  const count = buf.readUInt16LE(4);
  assert.ok(count >= 1);
  let has256 = false;
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    const w = buf[off] === 0 ? 256 : buf[off];
    const h = buf[off + 1] === 0 ? 256 : buf[off + 1];
    if (w === 256 && h === 256) has256 = true;
  }
  assert.ok(has256, 'ico should contain a 256x256 frame');

  // 与 Android-app launcher 图标内容一致
  const { spawnSync } = require('node:child_process');
  const py = spawnSync('python', ['-c', `
from PIL import Image
import sys
src = Image.open(sys.argv[1]).convert('RGBA').resize((256, 256), Image.LANCZOS)
ico = Image.open(sys.argv[2]).convert('RGBA')
if ico.size != (256, 256):
    sys.exit('ico largest frame is not 256: ' + str(ico.size))
print(0 if list(src.getdata()) == list(ico.getdata()) else 1)
`, sourcePng, icoPath], { encoding: 'utf8' });
  if (py.status === 0) {
    assert.equal(py.stdout.trim(), '0', 'icon.ico does not match Android launcher icon');
  } else if (/No module named ['"]?PIL/.test(py.stderr || '')) {
    // 环境未安装 Pillow 时跳过像素级对比（结构校验已通过）
    console.log('skip: Pillow unavailable, icon pixel comparison skipped');
  } else {
    assert.fail('python compare failed: ' + py.stderr);
  }
});

// 调试工具：向运行中的 Electron 页面执行表达式，等待指定毫秒后截图并输出灵动岛 DOM 状态
// 用法: node tools/cdp-frame.mjs <port> "<expression>" <delayMs> <outfile.png>
import fs from 'node:fs';

const port = process.argv[2] || '9223';
const expression = process.argv[3] || '1+1';
const delayMs = parseInt(process.argv[4] || '0', 10);
const outFile = process.argv[5] || 'frame.png';

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('芮誊') || targets.find((t) => t.type === 'page'));
if (!page) {
  console.error('未找到页面 target');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const exceptions = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || ''));
  }
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

await send('Runtime.enable');
await send('Page.enable');

async function evalJs(expression, awaitPromise = true) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (res.exceptionDetails) return 'EXCEPTION: ' + JSON.stringify(res.exceptionDetails);
  return res.result ? res.result.value : undefined;
}

const evalRes = await evalJs(expression);
console.log('EVAL', expression, '=>', evalRes);

await new Promise((r) => setTimeout(r, delayMs));

const state = await evalJs(`(() => {
  const island = document.getElementById('dynamic-island');
  const clip = document.getElementById('dynamic-island-clip');
  const stack = document.getElementById('macos-notification-stack');
  const robotWrap = island && island.querySelector('.di-robot-wrap');
  const canvas = island && island.querySelector('.di-robot-wrap canvas');
  const chargingBody = island && island.querySelector('.di-charging-body');
  const textBar = island && island.querySelector('.di-text-bar');
  const card = island && island.querySelector('.di-card');
  const r = (el) => el ? (() => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), opacity: getComputedStyle(el).opacity, display: getComputedStyle(el).display, visible: b.width > 0 && b.height > 0 }; })() : null;
  const cs = (el, prop) => el ? getComputedStyle(el)[prop] : null;
  return JSON.stringify({
    url: location.href,
    islandClass: island ? island.className : null,
    clip: r(clip),
    island: r(island),
    card: r(card),
    canvas: r(canvas),
    canvasScale: cs(canvas, 'scale'),
    canvasRotate: cs(canvas, 'rotate'),
    canvasTransform: cs(canvas, 'transform'),
    robotWrap: r(robotWrap),
    chargingBodyDisplay: cs(chargingBody, 'display'),
    chargingBody: r(chargingBody),
    textBar: r(textBar),
    stack: r(stack),
    stackClass: stack ? stack.className : null,
    notifCount: stack ? stack.children.length : null,
    winDesktop: document.body.classList.contains('win-desktop')
  });
})()`);
console.log('STATE', state);

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
console.log('SHOT', outFile, Buffer.from(shot.data, 'base64').length, 'bytes');
console.log('EXCEPTIONS', JSON.stringify(exceptions, null, 2));
ws.close();

// 调试工具：通过 Chrome DevTools Protocol 获取 Electron 页面状态并截图
// 用法: node tools/cdp-screenshot.mjs <port> <output.png> [--login]
import fs from 'node:fs';

const port = process.argv[2] || '9223';
const outFile = process.argv[3] || 'debug-main.png';
const doLogin = process.argv.includes('--login');

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
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
await new Promise((r) => setTimeout(r, 1200));

async function evalJs(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return res.result ? res.result.value : undefined;
}

if (doLogin) {
  await evalJs(`(() => {
    const u = document.getElementById('username');
    const p = document.getElementById('password');
    if (u) u.value = 'admin';
    if (p) p.value = 'T31750';
    const form = document.getElementById('login-form');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 1500));
}

const state = await evalJs(`JSON.stringify({
  w: window.innerWidth,
  h: window.innerHeight,
  triple: isCurrentlyTriple === true,
  tripleEl: !!document.querySelector('.triple-column-layout'),
  tripleVisible: (() => { const el = document.querySelector('.triple-column-layout'); return el ? getComputedStyle(el).display !== 'none' : false; })(),
  loginVisible: (() => { const el = document.getElementById('login-modal'); return el ? getComputedStyle(el).display !== 'none' : false; })(),
  hasAndroid: typeof Android !== 'undefined',
  status: document.getElementById('bt-modal-subtitle') ? document.getElementById('bt-modal-subtitle').textContent : '',
  url: location.href
})`);
console.log('STATE', state);

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
console.log('SHOT', outFile, Buffer.from(shot.data, 'base64').length, 'bytes');
console.log('EXCEPTIONS', JSON.stringify(exceptions, null, 2));
ws.close();

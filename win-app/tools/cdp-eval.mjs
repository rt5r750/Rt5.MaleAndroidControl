// 调试工具：向运行中的 Electron 页面执行 JS 表达式并打印结果
// 用法: node tools/cdp-eval.mjs <port> "<expression>"
const port = process.argv[2] || '9223';
const expression = process.argv[3] || 'location.href';

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) {
  console.error('未找到页面 target');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
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

const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
console.log(res.result ? res.result.value : JSON.stringify(res));
ws.close();

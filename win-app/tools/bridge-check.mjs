// 调试工具：端到端验证 preload 桥接（TTS 播放回调、QR、持久化、蓝牙桩）
// 用法: node tools/bridge-check.mjs <port>
const port = process.argv[2] || '9223';

function makeSilentWavBase64(seconds = 0.5) {
  const sampleRate = 8000;
  const samples = sampleRate * seconds;
  const dataSize = samples; // 8-bit mono
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf.toString('base64');
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
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

async function evalJs(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
  return res.result ? res.result.value : undefined;
}

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

const results = {};

results.safeArea = await evalJs(
  `JSON.stringify({top:Android.getSafeAreaTop(),bottom:Android.getSafeAreaBottom(),ime:Android.getImeHeight()})`
);

results.keyRoundtrip = await evalJs(`(() => {
  Android.setMimoApiKey('sk-test-123');
  return Android.getMimoApiKey();
})()`);

results.engineMigrate = await evalJs(`(() => {
  Android.setTtsEngine('voiceclone');
  return Android.getTtsEngine();
})()`);

results.qr = await evalJs(`(() => {
  const d = Android.btShowQr();
  return d ? d.slice(0, 30) + ' len=' + d.length : 'empty';
})()`);

results.btStub = await evalJs(`(() => {
  Android.btStartConnect();
  return { status: Android.btGetStatus(), bond: Android.btHasClientBond() };
})()`);
await new Promise((r) => setTimeout(r, 800));

const wav = makeSilentWavBase64();
results.audio = await evalJs(`(async () => {
  const cbId = 'tts_selftest_' + Date.now();
  window.__ttsCallbacks = window.__ttsCallbacks || {};
  window.__ttsResult = null;
  window.__ttsCallbacks[cbId] = {
    resolve: () => { window.__ttsResult = 'ok'; },
    reject: (e) => { window.__ttsResult = 'err:' + (e && e.message); }
  };
  Android.playAudioBase64(${JSON.stringify(wav)}, 'audio/wav', cbId);
  await new Promise((r) => setTimeout(r, 2000));
  return JSON.stringify(window.__ttsResult);
})()`);

console.log(JSON.stringify(results, null, 2));
ws.close();

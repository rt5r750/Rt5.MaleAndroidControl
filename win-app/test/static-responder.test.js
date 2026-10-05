'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStaticResponder } = require('../app/static-responder.js');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-responder-'));
  fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<html><title>fixture</title></html>');
  fs.writeFileSync(path.join(root, 'nested', 'app.js'), 'console.log(1);');
  fs.writeFileSync(path.join(root, 'video.mp4'), Buffer.alloc(1024, 7));
  fs.writeFileSync(path.join(root, 'secret.txt'), 'secret');
  return root;
}

test('serves root index with html content type', async () => {
  const respond = createStaticResponder(makeFixture());
  const res = await respond('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.match(await res.text(), /fixture/);
});

test('serves nested file with javascript mime', async () => {
  const respond = createStaticResponder(makeFixture());
  const res = await respond('/nested/app.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
  assert.match(await res.text(), /console\.log/);
});

test('rejects path traversal outside root', async () => {
  const respond = createStaticResponder(makeFixture());
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/nested/%2e%2e%2fsecret.txt']) {
    const res = await respond(p);
    assert.ok(res.status === 400 || res.status === 404, `expected 400/404 for ${p}, got ${res.status}`);
  }
});

test('supports byte range requests for media', async () => {
  const respond = createStaticResponder(makeFixture());
  const res = await respond('/video.mp4', 'bytes=0-9');
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 0-9/1024');
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(body.length, 10);
  assert.deepEqual([...body], Array(10).fill(7));
});

test('returns 404 for missing file', async () => {
  const respond = createStaticResponder(makeFixture());
  const res = await respond('/not-exists.png');
  assert.equal(res.status, 404);
});

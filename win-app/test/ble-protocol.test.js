'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeMessage, createLineDecoder, encodeDataValue, CHAR_NAMES } = require('../app/ble-protocol.js');

test('encodeMessage produces a single json line', () => {
  assert.equal(encodeMessage({ type: 'start' }), '{"type":"start"}\n');
  const decoded = JSON.parse(encodeMessage({ type: 'data', char: 'mode', value: 'AP8=' }).trim());
  assert.deepEqual(decoded, { type: 'data', char: 'mode', value: 'AP8=' });
});

test('createLineDecoder handles partial chunks and ignores broken lines', () => {
  const lines = [];
  const decoder = createLineDecoder((msg) => lines.push(msg));
  decoder.push('{"type":"read');
  decoder.push('y","supported":true}\n{"type":"bad json"');
  decoder.push('\n{"type":"stop"}\n');
  assert.deepEqual(lines, [
    { type: 'ready', supported: true },
    { type: 'stop' }
  ]);
});

test('createLineDecoder reset clears pending buffer', () => {
  const lines = [];
  const decoder = createLineDecoder((msg) => lines.push(msg));
  decoder.push('{"type":"partial"');
  decoder.reset();
  decoder.push('{"type":"ok"}\n');
  assert.deepEqual(lines, [{ type: 'ok' }]);
});

test('encodeDataValue maps mode ordinal to single byte', () => {
  const mode255 = encodeDataValue('mode', '255');
  assert.equal(Buffer.from(mode255, 'base64').toString('hex'), 'ff');
  const mode0 = encodeDataValue('mode', '0');
  assert.equal(Buffer.from(mode0, 'base64').toString('hex'), '00');
  const modeInvalid = encodeDataValue('mode', 'abc');
  assert.equal(Buffer.from(modeInvalid, 'base64').toString('hex'), 'ff');
});

test('encodeDataValue maps emotion to 4 clamped bytes', () => {
  const b64 = encodeDataValue('emotion', '101,-5,50,200');
  assert.deepEqual(Array.from(Buffer.from(b64, 'base64')), [100, 0, 50, 100]);
});

test('encodeDataValue encodes tasks/voice as utf8', () => {
  const tasks = encodeDataValue('tasks', JSON.stringify([{ id: 1, name: 'T31-750' }]));
  assert.equal(Buffer.from(tasks, 'base64').toString('utf8'), JSON.stringify([{ id: 1, name: 'T31-750' }]));
  const voice = encodeDataValue('voice-history', '[{"timestamp":1,"content":"你好"}]');
  assert.equal(Buffer.from(voice, 'base64').toString('utf8'), '[{"timestamp":1,"content":"你好"}]');
});

test('CHAR_NAMES maps front-end types to host char names', () => {
  assert.equal(CHAR_NAMES['mode'], 'mode');
  assert.equal(CHAR_NAMES['emotion'], 'emotion');
  assert.equal(CHAR_NAMES['tasks'], 'tasks');
  assert.equal(CHAR_NAMES['voice'], 'voice');
  assert.equal(CHAR_NAMES['voice-history'], 'voice');
  assert.equal(CHAR_NAMES['apikey'], 'apikey');
});

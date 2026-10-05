'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTtsCallbackJs, buildFetchCallbackJs } = require('../app/js-utils.js');

test('buildTtsCallbackJs escapes callback id and result json', () => {
  const js = buildTtsCallbackJs('a"b\\c', '{"ok":true}');
  assert.match(js, /window\.__ttsOnComplete\("a\\"b\\\\c", "\{\\"ok\\":true\}"\)/);
  assert.ok(!js.includes('a"b\\c'));
});

test('buildFetchCallbackJs guards missing callback function', () => {
  const js = buildFetchCallbackJs('cb_1');
  assert.match(js, /if\(window\.__mimoFetchCallback\)window\.__mimoFetchCallback\("cb_1"\)/);
});

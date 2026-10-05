'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeControlsWidth } = require('../app/titlebar-width.js');

test('computes window controls width from titlebar area rect', () => {
  // rect 是不含系统按钮的可用标题栏区域（宽 1314），窗口宽 1439 → 按钮宽 125
  assert.equal(computeControlsWidth(1439, { x: 0, width: 1314 }), 125);
});

test('returns 0 when overlay is unavailable or empty', () => {
  assert.equal(computeControlsWidth(1439, null), 0);
  assert.equal(computeControlsWidth(1439, { x: 0, width: 0 }), 0);
  assert.equal(computeControlsWidth(1439, {}), 0);
});

test('returns 0 in fullscreen', () => {
  assert.equal(computeControlsWidth(1439, { x: 0, width: 1314 }, true), 0);
});

test('never returns negative width', () => {
  assert.equal(computeControlsWidth(1000, { x: 200, width: 1314 }), 0);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveOpenPath } = require('../app/paths.js');

test('resolves relative web paths against www root', () => {
  const root = path.join('C:', 'app', 'www');
  assert.equal(
    resolveOpenPath(root, './doc/manual.pdf'),
    path.join(root, 'doc', 'manual.pdf')
  );
  assert.equal(
    resolveOpenPath(root, 'doc/manual.pdf'),
    path.join(root, 'doc', 'manual.pdf')
  );
});

test('passes http and https urls through unchanged', () => {
  const root = path.join('C:', 'app', 'www');
  assert.equal(resolveOpenPath(root, 'https://example.com/a.pdf'), 'https://example.com/a.pdf');
  assert.equal(resolveOpenPath(root, 'http://example.com/a'), 'http://example.com/a');
});

test('rejects paths escaping the www root', () => {
  const root = path.join('C:', 'app', 'www');
  assert.equal(resolveOpenPath(root, '../outside.pdf'), '');
  assert.equal(resolveOpenPath(root, 'C:\\windows\\system32\\x.pdf'), '');
});

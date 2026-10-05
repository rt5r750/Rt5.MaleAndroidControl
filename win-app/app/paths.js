'use strict';
const path = require('node:path');

/**
 * 将网页内相对路径（如 ./doc/xx.pdf）解析为 www 根目录下的绝对路径；
 * http(s) 链接原样透传；越界路径返回空字符串。
 */
function resolveOpenPath(wwwRoot, target) {
  const t = String(target || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  try {
    const abs = path.resolve(wwwRoot, t);
    const rootAbs = path.resolve(wwwRoot);
    if (abs === rootAbs || abs.startsWith(rootAbs + path.sep)) return abs;
    return '';
  } catch {
    return '';
  }
}

module.exports = { resolveOpenPath };

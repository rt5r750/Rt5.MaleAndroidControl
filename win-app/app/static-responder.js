'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

function createStaticResponder(rootDir) {
  const root = path.resolve(rootDir);

  return async (urlPath, rangeHeader) => {
    let parts;
    try {
      parts = decodeURIComponent(String(urlPath || '/')).split(/[/\\]/).filter(Boolean);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    if (parts.includes('..')) {
      return new Response('Bad Request', { status: 400 });
    }

    const rel = parts.length ? parts.join(path.sep) : 'index.html';
    // 额外纵深防御：解析后再次校验最终路径仍位于 root 内（杜绝任何形式的路径穿越）
    const abs = path.resolve(root, rel);
    const resolvedRoot = path.resolve(root);
    if (abs !== resolvedRoot && !abs.startsWith(resolvedRoot + path.sep)) {
      return new Response('Bad Request', { status: 400 });
    }
    let st;
    try {
      st = await fs.promises.stat(abs);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
    if (!st.isFile()) {
      return new Response('Not Found', { status: 404 });
    }

    const contentType = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    const stream = (start, end) => Readable.toWeb(fs.createReadStream(abs, start === undefined ? {} : { start, end }));

    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader));
      if (!m) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
      }
      let start = m[1] === '' ? undefined : parseInt(m[1], 10);
      let end = m[2] === '' ? undefined : parseInt(m[2], 10);
      if (start === undefined && end !== undefined) {
        start = Math.max(0, st.size - end);
        end = st.size - 1;
      } else if (start !== undefined) {
        end = end === undefined || end >= st.size ? st.size - 1 : end;
      }
      if (start === undefined || start > end || start >= st.size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
      }
      return new Response(stream(start, end), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${st.size}`,
          'Accept-Ranges': 'bytes'
        }
      });
    }

    return new Response(stream(), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(st.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      }
    });
  };
}

module.exports = { createStaticResponder };

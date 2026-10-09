#!/usr/bin/env node
/**
 * Manual build: www/doc/manual/manual.{en,zh-CN}.md -> matching .html
 *
 * Self-contained, no dependencies. Renders a restricted Markdown subset to a
 * styled document that matches the console look (dark green, MiSans/JetBrains
 * Mono) and works offline in every shell:
 *   - Android WebView (file:///android_asset), Electron (app://bundle), browser
 *   - also opened straight from the repository as a plain file
 *
 * Supported syntax:
 *   # / ## / ### / ####      headings (# becomes the document title)
 *   blank-line-separated paragraphs; single newlines inside collapse to a space
 *   - / *  and 1.           bullet and ordered lists (2-level indent allowed)
 *   | a | b |               tables (second line of dashes is the header rule)
 *   ```lang ... ```          fenced code blocks (escaped, not highlighted)
 *   > quote                  blockquote
 *   **bold**  `code`  [text](url)
 *   ![alt](path)             image (path kept relative to the html file)
 *   ---                      horizontal rule
 *
 * Usage: node build.mjs            (from this directory)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', '..', 'www', 'doc', 'manual');

const DOCS = [
  { src: 'manual.en.md', out: 'manual.en.html', lang: 'en', title: 'MACS · User Manual' },
  { src: 'manual.zh-CN.md', out: 'manual.zh-CN.html', lang: 'zh-CN', title: 'MACS · 使用说明书' }
];

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Inline formatting: code first (its content must not be re-scanned), then bold, links, images. */
function inline(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000C${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:/i.test(href);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${attrs}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return s;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableRule = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const isUl = (l) => /^(\s*)[-*]\s+/.test(l);
const isOl = (l) => /^(\s*)\d+[.)]\s+/.test(l);
const isHeading = (l) => /^#{1,4}\s+/.test(l);
const isFence = (l) => /^\s*```/.test(l);
const isHr = (l) => /^\s*(---|\*\*\*)\s*$/.test(l);
const isQuote = (l) => /^\s*>\s?/.test(l);

function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let h1Used = false;

  const listStack = [];   // open <ul>/<ol> tags
  const closeLists = (toDepth = 0) => {
    while (listStack.length > toDepth) out.push(`</${listStack.pop()}>`);
  };
  const indentDepth = (raw) => Math.min(1 + Math.floor(String(raw).length / 2), 2);

  const renderTable = (start) => {
    // header row + rule row + body rows
    const cells = (row) =>
      row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(lines[start]);
    i = start + 2;
    const body = [];
    while (i < lines.length && isTableRow(lines[i])) {
      body.push(cells(lines[i]));
      i++;
    }
    out.push('<div class="tbl-wrap"><table>');
    out.push('<thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>');
    out.push('<tbody>');
    for (const row of body) {
      out.push('<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
    }
    out.push('</tbody></table></div>');
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isFence(line)) {
      closeLists();
      const lang = line.replace(/^\s*```/, '').trim();
      const buf = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      out.push(`<pre${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      closeLists();
      i++;
      continue;
    }

    if (isHr(line)) {
      closeLists();
      out.push('<hr>');
      i++;
      continue;
    }

    if (isHeading(line)) {
      closeLists();
      const m = /^(#{1,4})\s+(.*)$/.exec(line);
      const level = m[1].length;
      const text = m[2].trim();
      if (level === 1 && !h1Used) {
        h1Used = true;
        out.push(`<h1>${inline(text)}</h1>`);
      } else {
        const lv = level === 1 ? 2 : level;
        out.push(`<h${lv}>${inline(text)}</h${lv}>`);
      }
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      closeLists();
      renderTable(i);
      continue;
    }

    if (isQuote(line)) {
      closeLists();
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (isUl(line) || isOl(line)) {
      const depth = indentDepth(/^(\s*)/.exec(line)[1]);
      while (listStack.length > depth) out.push(`</${listStack.pop()}>`);
      const want = isOl(line) ? 'ol' : 'ul';
      if (listStack.length === depth || listStack[listStack.length - 1] !== want) {
        // same-depth list of a different kind, or first list at this depth
        if (listStack.length === depth && listStack[depth - 1]) out.push(`</${listStack.pop()}>`);
        out.push(`<${want}>`);
        listStack.push(want);
      }
      const text = line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '');
      // continuation lines (indented) belong to the same item
      const buf = [text];
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() &&
        !isUl(lines[i + 1]) && !isOl(lines[i + 1]) && !isHeading(lines[i + 1]) &&
        !isTableRow(lines[i + 1]) && !isFence(lines[i + 1]) && !isQuote(lines[i + 1]) &&
        !isHr(lines[i + 1]) && /^\s{2,}/.test(lines[i + 1])
      ) {
        buf.push(lines[i + 1].trim());
        i++;
      }
      out.push(`<li>${inline(buf.join(' '))}</li>`);
      i++;
      continue;
    }

    // paragraph: gather until a blank line or a block starter
    closeLists();
    const buf = [line.trim()];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !isHeading(lines[i + 1]) && !isFence(lines[i + 1]) && !isHr(lines[i + 1]) &&
      !isUl(lines[i + 1]) && !isOl(lines[i + 1]) && !isQuote(lines[i + 1]) &&
      !(isTableRow(lines[i + 1]) && i + 2 < lines.length && isTableRule(lines[i + 2]))
    ) {
      buf.push(lines[i + 1].trim());
      i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
    i++;
  }
  closeLists();
  return out.join('\n');
}

const PAGE = (lang, title, body, otherHref, otherLabel) => `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  /* 与主控制台一致的深绿配色；字体栈遵循项目规范（中文 MiSans / 数字英文 JetBrains Mono）。
     本页可能经 file://（Android 资产）、app://（win-app）或直接打开仓库文件访问，
     因此字体只引用相对路径，缺失时回退系统字体，不依赖网络。 */
  @font-face { font-family: 'MiSans'; src: url('../../webfonts/MiSans-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
  @font-face { font-family: 'MiSans'; src: url('../../webfonts/MiSans-Demibold.woff2') format('woff2'); font-weight: 600; font-display: swap; }
  @font-face { font-family: 'JetBrains Mono'; src: url('../../webfonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: #05100a; color: #c0e4c0;
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', 'MiSans', monospace;
    font-size: 14px; line-height: 1.75;
    -webkit-text-size-adjust: 100%;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 28px 24px 72px; }
  .bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px;
         margin: -28px -24px 24px; padding: 12px 24px;
         background: rgba(5,16,10,0.94); border-bottom: 1px solid #24381f; backdrop-filter: blur(6px); }
  .bar-title { flex: 1; font-weight: 600; color: #8fbc8f; font-size: 13px; }
  .bar a { color: #8fbc8f; text-decoration: none; border: 1px solid #2f4a2f; border-radius: 6px;
           padding: 5px 12px; font-size: 12px; white-space: nowrap; }
  .bar a:hover { background: rgba(143,188,143,0.12); }
  h1 { font-size: 25px; line-height: 1.35; color: #eaf5ea; margin: 8px 0 20px; padding-bottom: 12px; border-bottom: 2px solid #2f4a2f; }
  h2 { font-size: 20px; color: #a8d5a8; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #24381f; }
  h3 { font-size: 16px; color: #8fbc8f; margin: 26px 0 10px; }
  h4 { font-size: 14px; color: #8fbc8f; margin: 20px 0 8px; }
  p { margin: 10px 0; }
  a { color: #9ad19a; }
  strong { color: #eaf5ea; font-weight: 600; }
  ul, ol { margin: 10px 0; padding-left: 24px; }
  li { margin: 5px 0; }
  li > ul, li > ol { margin: 5px 0; }
  code { background: #0d1a0d; border: 1px solid #24381f; border-radius: 4px; padding: 1px 5px; font-size: 0.92em; color: #a8d5a8; }
  pre { background: #0a140a; border: 1px solid #24381f; border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 14px 0; }
  pre code { background: none; border: none; padding: 0; color: #c0e4c0; font-size: 12.5px; line-height: 1.6; }
  blockquote { margin: 14px 0; padding: 10px 16px; border-left: 3px solid #4e6f4e; background: #0d1a0d; color: #9ec69e; border-radius: 0 6px 6px 0; }
  hr { border: none; border-top: 1px solid #24381f; margin: 32px 0; }
  img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #24381f; margin: 12px 0; display: block; }
  .tbl-wrap { overflow-x: auto; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; min-width: 420px; }
  th, td { border: 1px solid #24381f; padding: 8px 11px; text-align: left; vertical-align: top; }
  th { background: #0d1a0d; color: #8fbc8f; font-weight: 600; white-space: nowrap; }
  tr:nth-child(even) td { background: rgba(13,26,13,0.5); }
  @media (max-width: 600px) {
    .wrap { padding: 20px 16px 56px; }
    .bar { margin: -20px -16px 18px; padding: 10px 16px; }
    h1 { font-size: 21px; }
    h2 { font-size: 17px; }
    body { font-size: 13.5px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="bar">
    <span class="bar-title">${esc(title)}</span>
    <a href="${otherHref}">${otherLabel}</a>
  </div>
${body}
</div>
</body>
</html>
`;

let built = 0;
for (const doc of DOCS) {
  const srcPath = join(OUT_DIR, doc.src);
  if (!existsSync(srcPath)) {
    console.error(`[manual] missing source: ${srcPath}`);
    process.exitCode = 1;
    continue;
  }
  const md = readFileSync(srcPath, 'utf8');
  const other = DOCS.find((d) => d !== doc);
  const body = renderMarkdown(md);
  const html = PAGE(doc.lang, doc.title, body, other.out, doc.lang === 'en' ? '简体中文' : 'English');
  writeFileSync(join(OUT_DIR, doc.out), html, 'utf8');
  built++;
  console.log(`[manual] ${doc.src} -> ${doc.out} (${html.length} bytes)`);
}
console.log(`[manual] built ${built}/${DOCS.length}`);

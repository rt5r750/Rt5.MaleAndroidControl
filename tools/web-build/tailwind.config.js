/** RobotControl www 静态 Tailwind 构建（替代 Play CDN 运行时，与 3.4.16 同引擎）。
 *  修改 www 下任何 class/样式后必须重新执行：npm run build（tools/web-build 下）。
 *  theme.extend 与原内联 tailwind.config 逐字一致；content 覆盖 HTML 与全部 JS。 */
module.exports = {
  content: [
    '../../www/*.html',
    '../../www/*.js',
    '../../www/js/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2d4a2d',
        secondary: '#1a2f1a',
        accent: '#4e6f4e',
        highlight: '#8fbc8f',
        text: '#c0e4c0',
        error: '#ff6666',
        dark: '#0d1a0d',
        root: '#e6e6b3',
        terminal: '#000',
        terminalText: '#0f0',
        selection: '#00ff0033',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "'Courier New'", 'monospace'],
      },
    },
  },
  corePlugins: {
    preflight: true,
  },
};

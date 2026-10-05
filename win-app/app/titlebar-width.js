'use strict';

/**
 * 计算 Window Controls Overlay 系统按钮区的宽度（CSS px）。
 * getTitlebarAreaRect() 返回的是不含系统按钮的可用标题栏区域。
 */
function computeControlsWidth(innerWidth, rect, fullscreen) {
  if (fullscreen) return 0;
  if (!rect || typeof rect.width !== 'number' || rect.width <= 0) return 0;
  const x = typeof rect.x === 'number' ? rect.x : 0;
  return Math.max(0, innerWidth - x - rect.width);
}

module.exports = { computeControlsWidth };

# -*- coding: utf-8 -*-
"""由 master 图标生成 slave 图标：同配色、明暗对调（颜色互换）。

用途：master-app 与 slave-app 共用同一套 Rt5 图标构图，仅靠配色区分两端。
原实现是「深绿→深蓝的色相偏移」，两者都是深色块，缩到启动器/桌面尺寸几乎无法分辨；
现改为**明暗对调**：master = 深绿底 + 银圆 + 深绿字，slave = 银底 + 深绿圆 + 银字。

映射（按源图亮度 L 分档，带窄过渡带以保留字母/圆盘的抗锯齿边缘）：
    L <= EDGE_LO           -> SILVER   （取 master 圆盘中调，作新底色）
    EDGE_LO < L < EDGE_HI  -> SILVER -> DISC 线性过渡
    L >= EDGE_HI           -> DISC     （master 绿的同族色，略提亮以便读作绿色而非黑）

透明：源图 alpha >= ALPHA_SOLID 的像素压成不透明（master 圆盘原为 213，
      深绿底上无害，但换成银底后会露出深绿块），其余保留（圆角抗锯齿）。

用法（仓库根）：
    python tools/gen-slave-icon.py          # 生成全部 5 档 mipmap × 2 形态
    python tools/gen-slave-icon.py --check  # 只报告两端几何是否一致，不写文件
"""
import argparse
import os

import numpy as np
from PIL import Image

SILVER = np.array([207, 211, 207], np.float32)      # #cfd3cf  master 圆盘中调
DISC = np.array([22, 58, 30], np.float32)           # #163a1e  master 绿同族
EDGE_LO, EDGE_HI = 132.0, 152.0                     # 亮度分档边界（窄带保边缘）
ALPHA_SOLID = 190                                   # 圆盘不透明化阈值

DENSITIES = ('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi')
FORMS = ('ic_launcher.png', 'ic_launcher_round.png')
RES = os.path.join('app', 'src', 'main', 'res')
MASTER_ROOT = os.path.join('master-app', RES)
SLAVE_ROOT = os.path.join('slave-app', RES)


def _luminance(rgb):
    return 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]


def recolor(path):
    """读 master 图标，返回明暗对调后的 slave 图标。"""
    src = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
    lum = _luminance(src[:, :, :3])
    blend = np.clip((lum - EDGE_LO) / (EDGE_HI - EDGE_LO), 0.0, 1.0)[:, :, None]
    rgb = SILVER * (1.0 - blend) + DISC * blend
    alpha = np.where(src[:, :, 3] >= ALPHA_SOLID, 255.0, src[:, :, 3])
    return Image.fromarray(np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')


def targets():
    """产出 (源文件, 目标文件) 清单；含 slave 独有的 res 根下遗留副本。"""
    for density in DENSITIES:
        for form in FORMS:
            yield (os.path.join(MASTER_ROOT, 'mipmap-%s' % density, form),
                   os.path.join(SLAVE_ROOT, 'mipmap-%s' % density, form))
    # slave-app 的 res 根下另有两个 72px 副本（manifest 未引用，历史遗留），保持一致
    for form in FORMS:
        dst = os.path.join(SLAVE_ROOT, form)
        if os.path.exists(dst):
            yield (os.path.join(MASTER_ROOT, 'mipmap-hdpi', FORMS[0]), dst)


def check():
    """校验两端几何一致（alpha 通道在图形主体上应一致），并打印主色。"""
    from collections import Counter
    for density in DENSITIES:
        m = np.array(Image.open(os.path.join(MASTER_ROOT, 'mipmap-%s' % density, FORMS[0])).convert('RGBA'))
        s = np.array(Image.open(os.path.join(SLAVE_ROOT, 'mipmap-%s' % density, FORMS[0])).convert('RGBA'))
        if m.shape != s.shape:
            print('  %-7s 尺寸不一致 master=%s slave=%s' % (density, m.shape, s.shape))
            continue
        mc = Counter(map(tuple, m[m[:, :, 3] > 200][:, :3])).most_common(1)[0][0]
        sc = Counter(map(tuple, s[s[:, :, 3] > 200][:, :3])).most_common(1)[0][0]
        print('  %-7s %s  master主色 #%02x%02x%02x -> slave主色 #%02x%02x%02x'
              % (density, m.shape[:2], *mc, *sc))


def main():
    ap = argparse.ArgumentParser(description='Generate slave-app icons from master-app icons.')
    ap.add_argument('--check', action='store_true', help='only verify geometry, write nothing')
    args = ap.parse_args()
    if args.check:
        print('geometry / palette check:')
        check()
        return
    written = 0
    for src, dst in targets():
        recolor(src).save(dst)
        written += 1
    print('slave icons written: %d' % written)
    check()


if __name__ == '__main__':
    main()

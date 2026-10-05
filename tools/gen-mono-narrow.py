# -*- coding: utf-8 -*-
"""生成 EN 模式窄体控制台字体 MonoNarrow（JetBrains Mono 衍生，OFL）。

来源：本机已安装的可变字体 JetBrainsMono[wght].ttf（wght 轴）。
流程：wght 实例化(400/700) → ASCII+Latin 子集化 → 75% 横向压缩（轮廓与步进同缩，
等宽变窄等距不变）→ 丢弃 GPOS/GSUB/GDEF（等宽无需 kerning，避免未缩放定位残留）
与 cvt /fpgm/prep（TrueType hinting 指令按原始轮廓坐标写，缩放后小字号会渲染出
"引号状"错位伪影）→ woff2 输出到 www/webfonts/。
仅 EN 模式经 .i18n-cn-fit 启用（css/fonts.css），中文默认模式的字体栈一字不动。
重新生成：python tools/gen-mono-narrow.py
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

SRC_VF = os.path.expanduser(r"~/AppData/Local/Microsoft/Windows/Fonts/JetBrainsMono[wght].ttf")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "www", "webfonts")
S = 0.75          # 横向压缩系数（advance 0.6em → 0.45em）
FAMILY = "MonoNarrow"
SUBSET_UNI = "U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-205E"

def condense(font):
    glyf = font["glyf"]
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]
    for name in font.getGlyphOrder():
        pen = TTGlyphPen(glyph_set)
        tpen = TransformPen(pen, Transform(S, 0, 0, 1, 0, 0))
        glyph_set[name].draw(tpen)
        glyf[name] = pen.glyph()
        adv, lsb = hmtx[name]
        hmtx[name] = (int(round(adv * S)), int(round(lsb * S)))
    font["hhea"].advanceWidthMax = int(round(font["hhea"].advanceWidthMax * S))
    os2 = font["OS/2"]
    if hasattr(os2, "xAvgCharWidth"):
        os2.xAvgCharWidth = int(round(os2.xAvgCharWidth * S))
    for tag in ("GPOS", "GSUB", "GDEF", "cvt ", "fpgm", "prep"):
        if tag in font:
            del font[tag]

def make(weight, src_name):
    vf = TTFont(SRC_VF)
    font = instancer.instantiateVariableFont(vf, {"wght": weight}, inplace=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = []          # 等宽 UI 文案不需要 ligature/kern
    options.name_IDs = ["*"]
    options.notdef_outline = True
    ss = subset.Subsetter(options)
    ss.populate(unicodes=subset.parse_unicodes(SUBSET_UNI))
    ss.subset(font)
    condense(font)
    name = font["name"]
    for nid, val in ((1, FAMILY), (2, "Regular" if weight == 400 else "Bold"),
                     (4, f"{FAMILY} {'Regular' if weight == 400 else 'Bold'}"),
                     (6, f"{FAMILY}-{'Regular' if weight == 400 else 'Bold'}"),
                     (16, FAMILY), (17, "Regular" if weight == 400 else "Bold")):
        name.setName(val, nid, 3, 1, 0x409)
    font["OS/2"].usWeightClass = weight
    font.flavor = "woff2"
    out = os.path.join(OUT_DIR, f"{src_name}.woff2")
    font.save(out)
    print(out, os.path.getsize(out), "bytes")

if __name__ == "__main__":
    make(400, "MonoNarrow-Regular")
    make(700, "MonoNarrow-Bold")

"""돌린 가구 그림: art/source/turn/<시트>_<s|b>.png → public/assets/<그림 이름>_<s|b>.png

- _s: 옆모습 (앞이 왼쪽을 본다 → 오른쪽을 볼 때는 게임에서 좌우로 뒤집는다)
- _b: 뒷모습
원본 시트(home_a~e)와 같은 3×2 배치. 의자·침대는 2×2 한 장(furn2).

사용법: python3 scripts/process_turn.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "turn"
OUT = ROOT / "public" / "assets"
ALPHA_CUT = 140

# 시트 → 칸마다 (그림 이름, 돌릴 것인가)
HOME = {
    "a": ["-", "build_bookshelf", "build_fireplace", "build_wardrobe", "build_stove", "build_bathtub"],
    "b": ["-", "-", "build_toybox", "build_piano", "-", "-"],
    "c": ["build_fridge", "build_sink", "build_dining", "build_cupboard", "build_oven", "build_counter"],
    "d": ["build_desk", "build_tv", "build_armchair", "build_dresser", "build_longsofa", "-"],
    "e": ["build_washer", "build_washstand", "build_toilet", "build_vanity", "build_clock", "build_aquarium"],
}
# 두 칸짜리(가로 2칸): 옆으로 돌리면 세로 2칸이 된다 → 옆모습을 길게
LONG = {"build_bathtub": 50, "build_piano": 58, "build_dining": 54, "build_longsofa": 52}


def cut(im: Image.Image, cols: int, rows: int, c: int, r: int) -> Image.Image | None:
    cw, ch = im.width / cols, im.height / rows
    cell = im.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
    a = np.array(cell.getchannel("A")) >= ALPHA_CUT
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=6))
    if n == 0:
        return None
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    region = (lab == int(np.argmax(sizes)) + 1) & a
    ys, xs = np.nonzero(region)
    arr = np.array(cell)
    arr[..., 3] = np.where(region, arr[..., 3], 0)
    return Image.fromarray(arr).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def save(cell: Image.Image, name: str, height: int | None = None, long: int | None = None):
    f = (height / cell.height) if height else (long / max(cell.width, cell.height))
    w, h = max(1, round(cell.width * f)), max(1, round(cell.height * f))
    small = cell.resize((w, h), Image.BOX)
    arr = np.array(small)
    arr[..., 3] = np.where(arr[..., 3] >= ALPHA_CUT, 255, 0)
    arr[arr[..., 3] == 0] = 0
    Image.fromarray(arr).save(OUT / f"{name}.png")
    print(f"{name:26s} {w}x{h}")


def main():
    for sheet, names in HOME.items():
        for kind in ("s", "b"):
            p = SRC / f"{sheet}_{kind}.png"
            if not p.exists():
                print("missing", p.name)
                continue
            im = Image.open(p).convert("RGBA")
            for i, name in enumerate(names):
                if name == "-":
                    continue
                cell = cut(im, 3, 2, i % 3, i // 3)
                if cell is None:
                    print("empty", sheet, kind, name)
                    continue
                front = Image.open(OUT / f"{name}.png")
                if kind == "s":
                    save(cell, f"{name}_s", height=LONG.get(name, front.height))
                else:
                    save(cell, f"{name}_b", long=max(front.width, front.height))
    p = SRC / "furn2.png"
    if p.exists():
        im = Image.open(p).convert("RGBA")
        for i, (name, kw) in enumerate([("item_chair_s", {"height": 22}), ("item_chair_b", {"height": 22}), ("item_bed_s", {"height": 30}), ("item_bed_b", {"long": 22})]):
            cell = cut(im, 2, 2, i % 2, i // 2)
            if cell is not None:
                save(cell, name, **kw)


if __name__ == "__main__":
    main()

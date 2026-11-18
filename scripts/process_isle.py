"""섬 특산 집과 가구 그림.

art/source/isle/house_a·b.png        → public/assets/build_<집>.png
art/source/isle/furn_a·b.png         → public/assets/build_<가구>.png (앞)
art/source/isle/furn_a·b_s.png / _b  → build_<가구>_s.png (옆, 앞이 왼쪽) / _b.png (뒤)
art/source/isle/house2_*.png         → build_<집>_2f.png (2층을 올린 모습)
작업대·창고에 보이는 아이콘 item_<id>.png 도 함께 만든다.

사용법: python3 scripts/process_isle.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "isle"
OUT = ROOT / "public" / "assets"
ALPHA_CUT = 140

HOUSES = {
    "house_a.png": ["house_leaf", "house_flower", "house_tree", "house_shell", "house_rock", "house_mushroom"],
    "house_b.png": ["house_igloo", "house_tent", "house_forge", "house_cloud"],
}
# 가구: (이름, 앞모습 긴 변, 옆모습 높이)
FURN = {
    "furn_a": [("herb_shelf", 30, 30), ("petal_sofa", 46, 50), ("stump_table", 30, 28), ("shell_bed", 34, 34), ("salt_lamp", 30, 30), ("mushroom_table", 32, 30)],
    "furn_b": [("ice_bed", 36, 36), ("hourglass", 34, 34), ("lava_stove", 34, 34), ("cloud_bed", 34, 34)],
}


# 2층집(증축한 모습): 시트 → (가로 칸, 세로 칸, 이름들). 너비를 1층집과 같게 맞춘다
TALL = {
    "house2_base.png": (3, 1, ["house_red", "house_blue", "cabin"]),
    "house2_a.png": (3, 2, ["house_leaf", "house_flower", "house_tree", "house_shell", "house_rock", "house_mushroom"]),
    "house2_b.png": (3, 2, ["house_igloo", "house_tent", "house_forge", "house_cloud"]),
}


def cut(im: Image.Image, c: int, r: int, cols: int = 3, rows: int = 2):
    cw, ch = im.width / cols, im.height / rows
    cell = im.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
    a = np.array(cell.getchannel("A")) >= ALPHA_CUT
    if not a.any():
        return None
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=8))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    region = (lab == int(np.argmax(sizes)) + 1) & a
    ys, xs = np.nonzero(region)
    arr = np.array(cell)
    arr[..., 3] = np.where(region, arr[..., 3], 0)
    return Image.fromarray(arr).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def save(cell: Image.Image, name: str, long: int | None = None, height: int | None = None, width: int | None = None):
    f = (width / cell.width) if width else (height / cell.height) if height else (long / max(cell.width, cell.height))
    w, h = max(1, round(cell.width * f)), max(1, round(cell.height * f))
    arr = np.array(cell.resize((w, h), Image.BOX))
    arr[..., 3] = np.where(arr[..., 3] >= ALPHA_CUT, 255, 0)
    arr[arr[..., 3] == 0] = 0
    Image.fromarray(arr).save(OUT / f"{name}.png")
    print(f"{name:26s} {w}x{h}")


def icon(name: str):
    im = Image.open(OUT / f"build_{name}.png").convert("RGBA")
    k = min(24 / im.width, 24 / im.height, 1)
    im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).save(OUT / f"item_{name}.png")


def main():
    for sheet, names in HOUSES.items():
        im = Image.open(SRC / sheet).convert("RGBA")
        for i, name in enumerate(names):
            save(cut(im, i % 3, i // 3), f"build_{name}", long=58)
            icon(name)
    for sheet, (cols, rows, names) in TALL.items():
        im = Image.open(SRC / sheet).convert("RGBA")
        for i, name in enumerate(names):
            one = Image.open(OUT / f"build_{name}.png")
            save(cut(im, i % cols, i // cols, cols, rows), f"build_{name}_2f", width=one.width)
    for sheet, names in FURN.items():
        front = Image.open(SRC / f"{sheet}.png").convert("RGBA")
        side = Image.open(SRC / f"{sheet}_s.png").convert("RGBA")
        back = Image.open(SRC / f"{sheet}_b.png").convert("RGBA")
        for i, (name, long, sh) in enumerate(names):
            c, r = i % 3, i // 3
            save(cut(front, c, r), f"build_{name}", long=long)
            save(cut(side, c, r), f"build_{name}_s", height=sh)
            save(cut(back, c, r), f"build_{name}_b", long=long)
            icon(name)


if __name__ == "__main__":
    main()

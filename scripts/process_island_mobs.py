"""섬마다 사는 몬스터와 그 재료·요리 그림.

art/source/mon_c~f.png (3×2 몬스터)  → public/assets/mon_<id>.png
art/source/items3_a~c.png (4×4 아이콘) → public/assets/item_<id>.png

사용법: python3 scripts/process_island_mobs.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "public" / "assets"
ALPHA_CUT = 140

MONS = {
    "mon_c.png": [("sprout", 22), ("ladybug", 24), ("snail", 25), ("butterfly", 26), ("bud", 24), ("squirrel", 26)],
    "mon_d.png": [("pinebug", 26), ("stump", 28), ("conch", 26), ("jellyfish", 28), ("golem", 30), ("mole", 26)],
    "mon_e.png": [("puff", 26), ("toad", 28), ("penguin", 26), ("yeti", 30), ("scorpion", 30), ("tumble", 28)],
    "mon_f.png": [("lavaslime", 28), ("salamander", 30), ("sheep", 28), ("star", 28)],
}
ITEMS = {
    "items3_a.png": ["herb", "spot_berry", "dew", "pollen", "petal", "acorn", "resin", "sap", "conch", "sea_jelly", "rock_salt", "potato", "spore", "truffle", "smelt", "snowberry"],
    "items3_b.png": ["date", "spice", "chili", "lava_egg", "cloud_milk", "stardust", "herb_bowl", "spot_punch", "dew_fruit", "pollen_ball", "petal_ade", "roast_acorn", "pine_candy", "sap_drink", "conch_grill", "sea_pudding"],
    "items3_c.png": ["salt_fish", "baked_potato", "cream_soup", "truffle_grill", "smelt_fry", "snow_bingsu", "honey_date", "spice_fish", "chili_stew", "hot_egg", "cloud_latte", "star_candy"],
}


def cut(im: Image.Image, cols: int, rows: int, c: int, r: int, whole: bool):
    """칸 하나를 잘라 낸다. whole=False면 가장 큰 덩어리만(떨어진 반짝이·먼지는 버린다)."""
    cw, ch = im.width / cols, im.height / rows
    cell = im.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
    a = np.array(cell.getchannel("A")) >= ALPHA_CUT
    if not a.any():
        return None
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=10 if whole else 4))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    region = (lab == int(np.argmax(sizes)) + 1) & a
    ys, xs = np.nonzero(region)
    arr = np.array(cell)
    arr[..., 3] = np.where(region, arr[..., 3], 0)
    return Image.fromarray(arr).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def save(cell: Image.Image, name: str, fit: int):
    f = fit / max(cell.width, cell.height)
    w, h = max(1, round(cell.width * f)), max(1, round(cell.height * f))
    arr = np.array(cell.resize((w, h), Image.BOX))
    arr[..., 3] = np.where(arr[..., 3] >= ALPHA_CUT, 255, 0)
    arr[arr[..., 3] == 0] = 0
    Image.fromarray(arr).save(OUT / f"{name}.png")
    print(f"{name:24s} {w}x{h}")


def main():
    for sheet, names in MONS.items():
        im = Image.open(SRC / sheet).convert("RGBA")
        for i, (name, fit) in enumerate(names):
            cell = cut(im, 3, 2, i % 3, i // 3, whole=False)
            assert cell is not None, (sheet, name)
            save(cell, f"mon_{name}", fit)
    for sheet, names in ITEMS.items():
        p = SRC / sheet
        if not p.exists():
            print("missing", sheet)
            continue
        im = Image.open(p).convert("RGBA")
        for i, name in enumerate(names):
            cell = cut(im, 4, 4, i % 4, i // 4, whole=True)
            assert cell is not None, (sheet, name)
            save(cell, f"item_{name}", 22)


if __name__ == "__main__":
    main()

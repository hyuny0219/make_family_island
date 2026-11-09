"""AI 생성 시트(art/source/*.png)를 게임용 스프라이트(public/assets/*.png)로 변환한다.

- 캐릭터/오브젝트 시트: 격자 칸별로 잘라 → 반투명 번짐(halo) 제거 → 1/SCALE 축소 → 알파 이진화
- 타일 시트: 칸 중앙(테두리 제외)만 잘라 16×16으로 축소

사용법: python3 scripts/process_art.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "public" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

SCALE = 6          # 캐릭터·오브젝트 축소 배율 (원본 1024px 시트 기준)
TILE = 24
ALPHA_CUT = 140    # 이 값 미만 알파는 투명 처리 (AI 이미지의 뿌연 테두리 제거)


def clean_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= ALPHA_CUT else (0, 0, 0, 0)
    return im


def slice_grid(sheet: str, cols: int, rows: int, names: list[list[str | None]], fit: int | None = None):
    """fit: 지정하면 긴 변을 fit px에 맞춘다 (아이콘용). 아니면 1/SCALE 축소."""
    im = Image.open(SRC / sheet).convert("RGBA")
    cw, ch = im.width / cols, im.height / rows
    for r in range(rows):
        for c in range(cols):
            name = names[r][c]
            if not name:
                continue
            cell = im.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
            # 알파 기준으로 내용 영역만 남기기 — 칸 중심에 가장 가까운 큰 덩어리(이웃 칸에서 삐져나온 조각 제외)
            a = np.array(cell.getchannel("A")) >= ALPHA_CUT
            lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=6))
            if n == 0:
                print("empty cell", sheet, r, c)
                continue
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            keep = int(np.argmax(sizes)) + 1
            region = (lab == keep) & a
            ys, xs = np.nonzero(region)
            bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
            arr = np.array(cell)
            arr[..., 3] = np.where(region, arr[..., 3], 0)
            cell = Image.fromarray(arr).crop(bbox)
            f = (fit / max(cell.width, cell.height)) if fit else (1 / SCALE)
            w = max(1, round(cell.width * f))
            h = max(1, round(cell.height * f))
            small = clean_alpha(cell.resize((w, h), Image.BOX))
            small.save(OUT / f"{name}.png")
            print(f"{name:20s} {w}x{h}")


def slice_tiles():
    im = Image.open(SRC / "tiles.png").convert("RGB")
    cols = rows = 4
    cw, ch = im.width / cols, im.height / rows
    names = [
        ["grass_0", "grass_1", "grass_2", "grass_3"],
        ["sand_0", "sand_1", "sand_2", "sand_3"],
        [None, "sea_0", "sea_1", "sea_2"],
        [None, None, None, None],
    ]
    # 테두리 물결을 피하려고 칸의 가운데 60%만 사용 (바다 0번은 윗부분 거품이 있어 제외)
    tiles = []
    for r in range(rows):
        for c in range(cols):
            if not names[r][c]:
                continue
            x0, y0 = c * cw, r * ch
            m = 0.2
            box = (int(x0 + cw * m), int(y0 + ch * (m + (0.1 if r == 2 else 0))), int(x0 + cw * (1 - m)), int(y0 + ch * (1 - m)))
            t = im.crop(box).resize((TILE, TILE), Image.BOX)
            tiles.append((names[r][c], t))
    # 한 장짜리 타일셋으로 합치기 (1px extrude, margin=1, spacing=2)
    C = TILE + 2
    sheet = Image.new("RGB", (C * len(tiles), C))
    for i, (name, t) in enumerate(tiles):
        ext = t.resize((C, C), Image.NEAREST)  # 바깥 1px 채우기용 바탕
        sheet.paste(ext, (i * C, 0))
        sheet.paste(t, (i * C + 1, 1))
        print("tile", i, name)
    sheet.save(OUT / "tiles.png")


if __name__ == "__main__":
    slice_grid(
        "bears.png", 3, 4,
        [
            ["dad_front", "dad_side", "dad_back"],
            ["mom_front", "mom_side", "mom_back"],
            ["kid_front", "kid_side", "kid_back"],
            ["baby_front", "baby_side", "baby_back"],
        ],
    )
    slice_grid(
        "objects.png", 4, 3,
        [
            ["fruit_tree", "pine_tree", "sapling", "stump"],
            ["rock", "boulder", "pebbles", "ore_rock"],
            ["tent", "campfire", "bush", "flowers"],
        ],
    )
    slice_grid(
        "items.png", 4, 4,
        [
            ["item_twig", "item_log", "item_plank", "item_chair"],
            ["item_stone", "item_brick", "item_coal", "item_crystal"],
            ["item_fruit", "item_pinecone", "item_flower", "item_bouquet"],
            ["item_jelly", "item_wood_pickaxe", "item_stone_pickaxe", "item_basket"],
        ],
        fit=22,
    )
    slice_grid(
        "fishing.png", 4, 3,
        [
            ["item_fish_small", "item_fish", "item_fish_big", "item_fish_gold"],
            ["item_crab", "item_shell", "item_boot", "item_rod"],
            [None, None, "item_starfish", None],
        ],
        fit=22,
    )
    slice_grid("fishing.png", 4, 3, [[None] * 4, [None] * 4, ["sign", "chest", None, "bridge"]])
    slice_grid("boats.png", 3, 2, [["dock", "boat_frame", "boat"], ["boat_side", "crate", "lighthouse"]])
    slice_tiles()

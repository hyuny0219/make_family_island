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
    slice_grid("slime.png", 3, 2, [["slime", None, None], [None, None, None]], fit=20)
    slice_grid("slime.png", 3, 2, [[None, "slime_squash", None], [None, None, None]], fit=24)
    slice_grid("slime.png", 3, 2, [[None, None, "slime_king"], [None, None, None]], fit=28)
    slice_grid("slime.png", 3, 2, [[None, None, None], ["item_jelly_block", "item_jelly_lamp", None]], fit=22)
    # 섬 친구 (섬마다 한 마리)
    slice_grid("friends_a.png", 3, 2, [["turtle_front", "turtle_side", "turtle_back"], ["mole_front", "mole_side", "mole_back"]], fit=35)
    slice_grid("friends_b.png", 3, 2, [["frog_front", "frog_side", "frog_back"], ["camel_front", "camel_side", "camel_back"]], fit=35)
    slice_grid("friends_c.png", 3, 2, [["dragon_front", "dragon_side", "dragon_back"], ["sheep_front", "sheep_side", "sheep_back"]], fit=35)
    slice_grid("treasure_a.png", 3, 2, [["treasure_0", "treasure_1", "treasure_2"], ["treasure_3", "treasure_4", "treasure_5"]], fit=24)
    slice_grid("treasure_b.png", 3, 2, [["treasure_6", "treasure_7", "treasure_8"], ["treasure_9", None, None]], fit=24)
    slice_grid("treasure_b.png", 3, 2, [[None, None, None], [None, "chest_open", None]], fit=38)
    slice_grid("treasure_b.png", 3, 2, [[None, None, None], [None, None, "pedestal"]], fit=24)
    slice_grid("boats.png", 3, 2, [["dock", "boat_frame", "boat"], ["boat_side", "crate", "lighthouse"]])
    slice_grid(
        "items2.png", 4, 4,
        [
            ["item_sofa", "item_wall", "item_fountain", "item_flowerpot"],
            ["item_arch", "item_juice", "item_jam", "item_pie"],
            ["item_pearl", "item_necklace", "item_wreath", "item_lantern"],
            ["item_table", "item_bed", "item_fence", "item_trophy"],
        ],
        fit=22,
    )
    slice_grid(
        "residents.png", 3, 4,
        [
            ["rabbit_front", "rabbit_side", "rabbit_back"],
            ["cat_front", "cat_side", "cat_back"],
            ["fox_front", "fox_side", "fox_back"],
            ["penguin_front", "penguin_side", "penguin_back"],
        ],
    )
    slice_tiles()

    # 슬라임 색 변형 (초록 → 분홍·파랑): 초록 계열 픽셀만 색상을 돌린다
    import colorsys

    def recolor(name: str, out: str, hue: float):
        im = Image.open(OUT / f"{name}.png").convert("RGBA")
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if 0.17 < h < 0.45 and s > 0.2:
                    r2, g2, b2 = colorsys.hsv_to_rgb(hue, s * 0.8, min(1, v * 1.08))
                    px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
        im.save(OUT / f"{out}.png")

    for base in ["slime", "slime_squash"]:
        recolor(base, f"{base}_pink", 0.93)
        recolor(base, f"{base}_blue", 0.56)


    # ───────── 섬 스킨 (6~10번 섬 전용 바닥·오브젝트) ─────────
    # 바닥: 기본 타일셋의 풀/모래/바다를 색만 바꿔 만든다. (색상, 채도배율, 명도배율, 명도바닥)
    SKINS = {
        "mushroom": {"grass": (0.44, 0.80, 0.84, 0), "sand": (0.76, 0.55, 0.95, 0), "sea": (0.60, 0.85, 0.95, 0)},
        "snow": {"grass": (0.58, 0.14, 0.30, 0.70), "sand": (0.57, 0.55, 0.95, 0), "sea": (0.56, 0.75, 0.95, 0)},
        "desert": {"grass": (0.115, 0.85, 1.04, 0), "sand": (0.065, 1.35, 0.93, 0), "sea": None},
        "volcano": {"grass": (0.04, 0.45, 0.50, 0), "sand": (0.02, 0.45, 0.36, 0), "sea": (0.03, 1.15, 1.02, 0)},
        "cloud": {"grass": (0.43, 0.38, 1.06, 0), "sand": (0.93, 0.55, 1.03, 0), "sea": (0.55, 0.45, 1.12, 0)},
    }
    SKIN_OBJECTS = [["fruit_tree", "pine_tree", "bush"], ["flowers", "rock", "boulder"]]
    SKIN_FIT = {"fruit_tree": 40, "pine_tree": 40, "bush": 28, "flowers": 26, "rock": 22, "boulder": 29}
    base = Image.open(OUT / "tiles.png").convert("RGB")
    C = TILE + 2
    kinds = ["grass"] * 4 + ["sand"] * 4 + ["sea"] * 3
    colors = {}
    for skin, conf in SKINS.items():
        im = base.copy()
        px = im.load()
        for i, kind in enumerate(kinds):
            t = conf[kind]
            if not t:
                continue
            hue, sm, vm, vfloor = t
            for y in range(C):
                for x in range(i * C, (i + 1) * C):
                    r, g, b = px[x, y]
                    h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                    r2, g2, b2 = colorsys.hsv_to_rgb(hue, min(1, s_ * sm), min(1, vfloor + v * vm))
                    px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255))
        im.save(OUT / f"tiles_{skin}.png")

        def avg(i):
            a = np.array(im.crop((i * C + 1, 1, i * C + 1 + TILE, 1 + TILE))).reshape(-1, 3)
            return np.median(a, axis=0)

        gr, sa = avg(0), avg(4)
        hexc = lambda c: "#%02x%02x%02x" % tuple(int(round(v)) for v in c)
        colors[skin] = {"grass": hexc(gr), "grassLine": hexc(gr * 0.82), "sand": hexc(sa)}
        sheet = f"skin_{skin}.png"
        if (SRC / sheet).exists():
            for r_ in range(2):
                for c_ in range(3):
                    name = SKIN_OBJECTS[r_][c_]
                    grid = [[None] * 3, [None] * 3]
                    grid[r_][c_] = f"{name}_{skin}"
                    slice_grid(sheet, 3, 2, grid, fit=SKIN_FIT[name])
    import json

    gen = ROOT / "src" / "data" / "skinColors.ts"
    gen.write_text(
        "// scripts/process_art.py 가 만든 파일 — 직접 고치지 말 것\n"
        "export const SKIN_COLORS: Record<string, { grass: string; grassLine: string; sand: string }> = "
        + json.dumps(colors, indent=2) + ";\n"
    )

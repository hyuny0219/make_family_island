"""연속기 이펙트 그림 자르기: art/source/fx/<id>.png (3칸 × 2줄) → public/assets/fx/<id>_f1..3.png, <id>_g1..3.png

윗줄 = 3타 마무리(f), 아랫줄 = 내려찍기(g). 한 줄의 세 장은 칸 가운데를 기준으로 같은 크기로 잘라서
차례로 틀어도 흔들리지 않는다. 그림이 칸 밖으로 삐져나와도, 덩어리마다 가장 가까운 칸에 붙인다.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source" / "fx"
OUT = ROOT / "public" / "assets" / "fx"
SCALE = 3.4  # 원본 → 게임 크기
CUT: dict[str, int] = {}  # 이보다 옅은 얼룩은 지운다 (기본 80). 뿌연 바탕이 낀 그림은 더 세게

OUT.mkdir(parents=True, exist_ok=True)
for path in sorted(SRC.glob("*.png")):
    arr = np.array(Image.open(path).convert("RGBA"))
    arr[arr[..., 3] < CUT.get(path.stem, 80)] = 0
    H, W = arr.shape[:2]
    cw, ch = W / 3, H / 2
    lab, n = ndimage.label(ndimage.binary_dilation(arr[..., 3] > 0, iterations=5))
    cells = [[np.zeros((H, W), bool) for _ in range(3)] for _ in range(2)]
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        blob = lab[sl] == k
        if blob.sum() < 60:
            continue
        cy, cx = ndimage.center_of_mass(blob)
        r = min(1, int((sl[0].start + cy) // ch))
        c = min(2, int((sl[1].start + cx) // cw))
        cells[r][c][sl] |= blob
    for r, tag in enumerate("fg"):
        # 칸 가운데를 기준으로 세 장을 모두 담는 틀
        ext = [0, 0, 0, 0]  # 왼, 오른, 위, 아래
        for c in range(3):
            ys, xs = np.nonzero(cells[r][c] & (arr[..., 3] > 0))
            mx, my = (c + 0.5) * cw, (r + 0.5) * ch
            ext = [max(ext[0], mx - xs.min()), max(ext[1], xs.max() + 1 - mx), max(ext[2], my - ys.min()), max(ext[3], ys.max() + 1 - my)]
        for c in range(3):
            mx, my = (c + 0.5) * cw, (r + 0.5) * ch
            x0, x1, y0, y1 = int(mx - ext[0]), int(mx + ext[1]), int(my - ext[2]), int(my + ext[3])
            canvas = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
            sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
            part = arr[sy0:sy1, sx0:sx1].copy()
            part[~cells[r][c][sy0:sy1, sx0:sx1]] = 0
            canvas[sy0 - y0 : sy1 - y0, sx0 - x0 : sx1 - x0] = part
            crop = Image.fromarray(canvas)
            w, h = max(1, round(crop.width / SCALE)), max(1, round(crop.height / SCALE))
            small = np.array(crop.resize((w, h), Image.BOX))
            small[small[..., 3] < 60] = 0
            Image.fromarray(small).save(OUT / f"{path.stem}_{tag}{c + 1}.png")
        print(f"{path.stem}_{tag}: {round((ext[0] + ext[1]) / SCALE)}x{round((ext[2] + ext[3]) / SCALE)}")

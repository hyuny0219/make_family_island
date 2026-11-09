"""PWA 임시 아이콘 생성 (정식 아트 확정 전까지 사용).
사용법: python3 scripts/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# 32×32 도트로 그린 뒤 정수배 확대 → 도트 느낌 유지
S = 32
img = Image.new("RGB", (S, S), (126, 200, 227))
d = ImageDraw.Draw(img)
d.ellipse((3, 13, 28, 27), fill=(243, 224, 166))       # 모래
d.ellipse((6, 14, 25, 24), fill=(143, 209, 106))       # 풀
d.rectangle((15, 8, 16, 18), fill=(138, 90, 59))       # 줄기
d.ellipse((10, 3, 21, 11), fill=(79, 166, 74))         # 잎
d.ellipse((11, 4, 15, 7), fill=(108, 195, 95))
d.rectangle((6, 28, 9, 28), fill=(255, 255, 255))      # 물결
d.rectangle((22, 29, 25, 29), fill=(255, 255, 255))

for size in (192, 512):
    img.resize((size, size), Image.NEAREST).save(OUT / f"icon-{size}.png")
print("ok", list(OUT.iterdir()))

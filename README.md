# 🏝️ 가족 섬 만들기 (Make Family Island)

가족 넷이 함께, 또는 각자 즐기는 협동형 섬 개척 게임. 모바일 웹(PWA)으로 동작한다.

- 📄 기획서: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
- 🎮 정식 주소: https://hyuny0219.github.io/make_family_island/
- 🔍 PR 미리보기: PR마다 봇이 댓글로 링크를 달아준다 (`/pr-preview/pr-<번호>/`)

## 기술 스택
Phaser 3 · TypeScript · Vite · vite-plugin-pwa · GitHub Pages

## 개발
```bash
npm install
npm run dev      # 같은 와이파이의 폰에서 http://<PC IP>:5173 접속 가능
npm run build    # dist/ 생성
```

## 구조
```
src/
  main.ts              # Phaser 게임 설정 (세로 360×640 기준, EXPAND 스케일)
  config.ts            # 화면·타일·색상 상수
  sfx.ts               # 임시 효과음(WebAudio) + 진동
  data/islandMap.ts    # 섬 맵 생성 (M1에서 수작업 맵으로 교체 예정)
  scenes/
    BootScene.ts       # 스프라이트 로드 + 파티클 텍스처 생성
    IslandScene.ts     # 탐험 화면: 탭 이동, 오브젝트·가족 곰 상호작용
  objects/Bear.ts      # 곰 캐릭터 (플레이어/가족 NPC 공용)
  data/assets.ts       # 스프라이트 목록
    HudScene.ts        # 상단 바, 하단 탭, 시작 화면(곰 고르기), 안내/토스트
scripts/make_icons.py  # PWA 임시 아이콘 생성
scripts/process_art.py # AI 생성 시트(art/source) → 게임 스프라이트(public/assets)
```

## 처음 한 번만: GitHub Pages 켜기
Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: **gh-pages** / **(root)** → Save

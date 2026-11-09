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
  data/islands.ts      # 섬 10개 정의 (지역 수, 분위기, 배 재료)
  data/biomes.ts       # 지역 분위기별 재료·오브젝트·어종·이름
  world/generate.ts    # 섬·지역·퀘스트 자동 생성 (시드 고정)
  world/edges.ts       # 해안선 물결 조각
  state/progress.ts    # 섬·지역 해금, 배 진행 저장
  data/items.ts        # 아이템 정의
  data/merge.ts        # 머지 체인·작업대 레시피
  data/gathering.ts    # 오브젝트별 채집 규칙 (밸런스는 여기서)
  state/inventory.ts   # 가족 창고 (localStorage, M5에서 Firebase)
  util/korean.ts       # 조사(이/가) 처리
  scenes/
    BootScene.ts       # 스프라이트 로드 + 파티클 텍스처 생성
    IslandScene.ts     # 탐험 화면: 이동, 채집, 낚시, 지역 해금, 배 타기
  objects/Bear.ts      # 곰 캐릭터 (플레이어/가족 NPC 공용)
  data/assets.ts       # 스프라이트 목록
    MergeScene.ts      # 머지 보드 + 작업대
    HudScene.ts        # 상단 바, 창고, 퀘스트·배·섬 목록 팝업, 시작 화면(곰 고르기)
scripts/make_icons.py  # PWA 임시 아이콘 생성
scripts/process_art.py # AI 생성 시트(art/source) → 게임 스프라이트(public/assets)
```

## 처음 한 번만: GitHub Pages 켜기
Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: **gh-pages** / **(root)** → Save

/** 화면 논리 해상도 (세로형). Scale.FIT으로 기기 화면에 맞춰 확대된다. */
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

/** 타일 한 칸 크기(px) — 곰 캐릭터(약 36px)와 비율을 맞춘 24×24 */
export const TILE = 24;

/** 월드 카메라 배율. 24px 타일이 화면에서 36px로 보인다. */
export const WORLD_ZOOM = 1.5;

/** 섬 맵 크기 (타일 수) */
export const MAP_W = 60;
export const MAP_H = 60;

/** 캐릭터 이동 속도 (px/초, 월드 좌표) */
export const PLAYER_SPEED = 90;

export const COLORS = {
  sea: 0x7ec8e3,
  seaDeep: 0x5bb3d6,
  sand: 0xf3e0a6,
  sandDark: 0xe2c983,
  grass: 0x8fd16a,
  grassDark: 0x76bd55,
  trunk: 0x8a5a3b,
  leaf: 0x4fa64a,
  leafLight: 0x6cc35f,
  rock: 0xa7a9b5,
  rockDark: 0x80828f,
  outline: 0x2b2d42,
  white: 0xffffff,
  uiBg: 0xfff8e7,
  uiText: '#4a3b2a',
} as const;

declare global {
  const __BUILD_LABEL__: string;
}

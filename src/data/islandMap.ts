import { MAP_H, MAP_W } from '../config';

export const T_SEA = 0;
export const T_SAND = 1;
export const T_GRASS = 2;

export interface Decor {
  kind: 'tree' | 'rock';
  tx: number;
  ty: number;
}

export interface IslandMap {
  tiles: number[][];
  decor: Decor[];
  spawn: { tx: number; ty: number };
}

/** 재현 가능한 의사난수 (같은 시드 → 같은 섬) */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 시작 섬(초원)을 절차적으로 만든다.
 * M1에서 Tiled로 만든 수작업 맵으로 교체 예정.
 */
export function generateIsland(seed = 20261109): IslandMap {
  const rnd = mulberry32(seed);
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const tiles: number[][] = [];

  for (let y = 0; y < MAP_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / (MAP_W * 0.42);
      const dy = (y - cy) / (MAP_H * 0.42);
      const ang = Math.atan2(dy, dx);
      // 해안선을 울퉁불퉁하게
      const wobble = 0.08 * Math.sin(ang * 3 + 1.3) + 0.05 * Math.sin(ang * 7 + 0.4);
      const d = Math.sqrt(dx * dx + dy * dy) - wobble;
      row.push(d < 0.78 ? T_GRASS : d < 0.95 ? T_SAND : T_SEA);
    }
    tiles.push(row);
  }

  const spawn = { tx: Math.floor(cx), ty: Math.floor(cy) + 2 };
  const decor: Decor[] = [];
  const taken = new Set<string>();
  const near = (x: number, y: number) => Math.abs(x - spawn.tx) < 3 && Math.abs(y - spawn.ty) < 3;

  for (let i = 0; i < 400 && decor.length < 26; i++) {
    const tx = Math.floor(rnd() * MAP_W);
    const ty = Math.floor(rnd() * MAP_H);
    const key = `${tx},${ty}`;
    if (taken.has(key) || near(tx, ty)) continue;
    const t = tiles[ty][tx];
    if (t === T_GRASS) {
      decor.push({ kind: rnd() < 0.72 ? 'tree' : 'rock', tx, ty });
    } else if (t === T_SAND && rnd() < 0.25) {
      decor.push({ kind: 'rock', tx, ty });
    } else continue;
    // 주변 칸도 막아서 너무 붙지 않게
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) taken.add(`${tx + ox},${ty + oy}`);
  }

  return { tiles, decor, spawn };
}

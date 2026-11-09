import { MAP_H, MAP_W } from '../config';
import { TILE_IDX, type ObjectKind } from './assets';

/** 지형 종류 (이동 판정용) */
export const T_SEA = 0;
export const T_SAND = 1;
export const T_GRASS = 2;

export interface Decor {
  kind: ObjectKind;
  tx: number;
  ty: number;
}

export interface IslandMap {
  /** 지형 종류 */
  terrain: number[][];
  /** 그릴 타일 인덱스 (tiles.png) */
  tiles: number[][];
  decor: Decor[];
  spawn: { tx: number; ty: number };
  camp: { tx: number; ty: number };
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

function pick<T>(rnd: () => number, table: [T, number][]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table[0][0];
}

/**
 * 시작 섬(초원)을 절차적으로 만든다.
 * M1에서 Tiled로 만든 수작업 맵으로 교체 예정.
 */
export function generateIsland(seed = 20261109): IslandMap {
  const rnd = mulberry32(seed);
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const terrain: number[][] = [];
  const dist: number[][] = [];

  for (let y = 0; y < MAP_H; y++) {
    const row: number[] = [];
    const drow: number[] = [];
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / (MAP_W * 0.42);
      const dy = (y - cy) / (MAP_H * 0.42);
      const ang = Math.atan2(dy, dx);
      const wobble = 0.08 * Math.sin(ang * 3 + 1.3) + 0.05 * Math.sin(ang * 7 + 0.4);
      const d = Math.sqrt(dx * dx + dy * dy) - wobble;
      drow.push(d);
      row.push(d < 0.76 ? T_GRASS : d < 0.93 ? T_SAND : T_SEA);
    }
    terrain.push(row);
    dist.push(drow);
  }

  const tiles = terrain.map((row, y) =>
    row.map((t, x) => {
      if (t === T_GRASS)
        return pick<number>(rnd, [
          [TILE_IDX.grass[0], 10],
          [TILE_IDX.grass[1], 4],
          [TILE_IDX.grass[2], 2],
          [TILE_IDX.grass[3], 1],
        ]);
      if (t === T_SAND)
        return pick<number>(rnd, [
          [TILE_IDX.sand[0], 10],
          [TILE_IDX.sand[1], 2],
          [TILE_IDX.sand[2], 1],
        ]);
      const d = dist[y][x];
      return d < 1.02 ? TILE_IDX.shallow : d < 1.25 ? TILE_IDX.sea : TILE_IDX.deep;
    }),
  );

  const camp = { tx: Math.floor(cx), ty: Math.floor(cy) - 1 };
  const spawn = { tx: camp.tx, ty: camp.ty + 3 };
  const decor: Decor[] = [
    { kind: 'tent', tx: camp.tx + 1, ty: camp.ty },
    { kind: 'campfire', tx: camp.tx - 1, ty: camp.ty + 1 },
  ];
  const taken = new Set<string>();
  // 캠프 주변은 비워두기 (가족 곰들이 돌아다니는 공간)
  for (let oy = -3; oy <= 5; oy++) for (let ox = -4; ox <= 4; ox++) taken.add(`${camp.tx + ox},${camp.ty + oy}`);

  for (let i = 0; i < 600 && decor.length < 44; i++) {
    const tx = Math.floor(rnd() * MAP_W);
    const ty = Math.floor(rnd() * MAP_H);
    if (taken.has(`${tx},${ty}`)) continue;
    const t = terrain[ty][tx];
    let kind: ObjectKind | null = null;
    if (t === T_GRASS) {
      kind = pick<ObjectKind>(rnd, [
        ['fruit_tree', 7],
        ['pine_tree', 4],
        ['bush', 3],
        ['rock', 3],
        ['flowers', 4],
        ['boulder', 1],
        ['stump', 1],
        ['sapling', 2],
        ['ore_rock', 1],
      ]);
    } else if (t === T_SAND && rnd() < 0.35) {
      kind = pick<ObjectKind>(rnd, [
        ['rock', 2],
        ['pebbles', 3],
      ]);
    }
    if (!kind) continue;
    decor.push({ kind, tx, ty });
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) taken.add(`${tx + ox},${ty + oy}`);
  }

  return { terrain, tiles, decor, spawn, camp };
}

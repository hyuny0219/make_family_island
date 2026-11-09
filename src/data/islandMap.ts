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
      // 해안선: 큰 굴곡(만·곶) + 잔물결
      const wobble =
        0.1 * Math.sin(ang * 3 + 1.3) + 0.06 * Math.sin(ang * 5 + 2.1) + 0.04 * Math.sin(ang * 9 + 0.4) + 0.02 * Math.sin(ang * 17);
      const d = Math.sqrt(dx * dx + dy * dy) - wobble;
      drow.push(d);
      row.push(d < 0.85 ? T_GRASS : d < 0.96 ? T_SAND : T_SEA);
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

  // 지역별 분위기: 북쪽 숲 / 동쪽 바위 언덕 / 서쪽 꽃밭 / 남쪽·가운데 과수원
  const biome = (x: number, y: number): 'forest' | 'rocky' | 'meadow' | 'orchard' => {
    const a = Math.atan2(y - cy, x - cx); // -π..π, 0=동쪽, -π/2=북쪽
    const r = Math.hypot(x - cx, y - cy);
    if (r < 7) return 'orchard';
    if (a < -Math.PI * 0.25 && a > -Math.PI * 0.75) return 'forest';
    if (a >= -Math.PI * 0.25 && a < Math.PI * 0.2) return 'rocky';
    if (a > Math.PI * 0.75 || a < -Math.PI * 0.75) return 'meadow';
    return 'orchard';
  };
  const TABLE: Record<ReturnType<typeof biome>, [ObjectKind, number][]> = {
    forest: [['pine_tree', 10], ['fruit_tree', 2], ['bush', 3], ['stump', 2], ['sapling', 2], ['flowers', 1], ['rock', 1]],
    rocky: [['rock', 7], ['boulder', 3], ['ore_rock', 3], ['pebbles', 3], ['bush', 1], ['pine_tree', 1]],
    meadow: [['flowers', 9], ['bush', 3], ['sapling', 2], ['fruit_tree', 2], ['rock', 1]],
    orchard: [['fruit_tree', 8], ['bush', 2], ['flowers', 2], ['sapling', 2], ['rock', 1], ['stump', 1]],
  };
  const density = { forest: 0.55, rocky: 0.4, meadow: 0.4, orchard: 0.3 };

  // 격자 간격으로 후보를 훑어서 고르게 배치 (뭉치지도, 비지도 않게)
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (taken.has(`${x},${y}`)) continue;
      const t = terrain[y][x];
      let kind: ObjectKind | null = null;
      if (t === T_GRASS) {
        const b = biome(x, y);
        if (rnd() < density[b] * 0.5) kind = pick<ObjectKind>(rnd, TABLE[b]);
      } else if (t === T_SAND && rnd() < 0.06) {
        kind = pick<ObjectKind>(rnd, [
          ['rock', 2],
          ['pebbles', 3],
        ]);
      }
      if (!kind) continue;
      decor.push({ kind, tx: x, ty: y });
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) taken.add(`${x + ox},${y + oy}`);
    }
  }

  return { terrain, tiles, decor, spawn, camp };
}

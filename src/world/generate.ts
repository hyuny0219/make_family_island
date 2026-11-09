import { TILE_IDX, type ObjectKind } from '../data/assets';
import { BIOMES, BIOME_INFO, type Biome } from '../data/biomes';
import type { IslandTheme } from '../data/islands';
import type { ItemId } from '../data/items';
import { CHAINS } from '../data/merge';

export const T_SEA = 0;
export const T_SAND = 1;
export const T_GRASS = 2;

export interface Decor {
  kind: ObjectKind;
  tx: number;
  ty: number;
}

export interface RegionInfo {
  idx: number;
  name: string;
  biome: Biome;
  /** 씨앗(중심) 타일 */
  sx: number;
  sy: number;
  /** 시작 지역에서 몇 칸 떨어졌는지 (지역 그래프 기준) */
  depth: number;
  /** 이 지역을 열려면 먼저 열려 있어야 하는 지역 (-1 = 시작 지역) */
  parent: number;
  neighbors: number[];
  /** 해금 재료 */
  need: Partial<Record<ItemId, number>>;
  /** 물가(낚시 가능)가 있는지 */
  hasWater: boolean;
  /** 표지판 위치 (부모 지역과 맞닿은 땅) */
  signX: number;
  signY: number;
  story: string;
}

export interface FishingSpot {
  tx: number;
  ty: number;
  region: number;
}

export interface World {
  w: number;
  h: number;
  terrain: number[][];
  tiles: number[][];
  /** 타일마다 속한 지역 번호 */
  region: Int16Array;
  regions: RegionInfo[];
  decor: Decor[];
  fishing: FishingSpot[];
  camp: { tx: number; ty: number };
  dock: { tx: number; ty: number; dir: 1 | -1 };
}

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

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * 섬 하나를 통째로 만든다. 같은 테마(시드)면 항상 같은 섬이 나온다.
 * 1) 섬 모양 → 2) 지역 씨앗(고르게 퍼뜨리기) → 3) 타일별 지역 배정(보로노이)
 * → 4) 지역 그래프·깊이 → 5) 분위기·지형 다듬기 → 6) 오브젝트·낚시터 → 7) 퀘스트
 */
export function generateWorld(theme: IslandTheme, islandIdx: number): World {
  const rnd = mulberry32(theme.seed);
  const N = theme.regions;
  const size = Math.max(90, Math.min(140, Math.round(Math.sqrt((N * 230) / 0.55))));
  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const R = size * 0.44;

  // ── 1) 섬 모양 ──
  const ph = Array.from({ length: 5 }, () => rnd() * Math.PI * 2);
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / R;
      const dy = (y - cy) / R;
      const a = Math.atan2(dy, dx);
      const wob =
        0.1 * Math.sin(a * 3 + ph[0]) + 0.06 * Math.sin(a * 5 + ph[1]) + 0.04 * Math.sin(a * 9 + ph[2]) + 0.02 * Math.sin(a * 17 + ph[3]);
      dist[y * w + x] = Math.hypot(dx, dy) - wob;
    }
  }
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && dist[y * w + x] < 0.96;

  // ── 2) 지역 씨앗: 0번은 남쪽 해안 근처(배를 타고 도착하는 곳), 나머지는 멀리멀리 고르게 ──
  const seeds: [number, number][] = [];
  {
    let best: [number, number] = [Math.floor(cx), Math.floor(cy)];
    for (let y = Math.floor(cy); y < h; y++) {
      const x = Math.floor(cx);
      if (isLand(x, y) && dist[y * w + x] < 0.72) best = [x, y];
    }
    seeds.push(best);
  }
  const landCells: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dist[y * w + x] < 0.9) landCells.push([x, y]);
  while (seeds.length < N) {
    let bestC: [number, number] | null = null;
    let bestD = -1;
    for (let k = 0; k < 60; k++) {
      const c = landCells[Math.floor(rnd() * landCells.length)];
      let md = Infinity;
      for (const s of seeds) md = Math.min(md, (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2);
      if (md > bestD) {
        bestD = md;
        bestC = c;
      }
    }
    seeds.push(bestC!);
  }

  // ── 3) 타일별 지역 배정 (경계가 구불구불하도록 좌표를 살짝 비튼다) ──
  const region = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const qx = x + 2.2 * Math.sin(y * 0.35 + ph[4]) + 1.3 * Math.sin(y * 0.9);
      const qy = y + 2.2 * Math.sin(x * 0.31 + ph[0]) + 1.3 * Math.cos(x * 0.8);
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < N; i++) {
        const d = (seeds[i][0] - qx) ** 2 + (seeds[i][1] - qy) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      region[y * w + x] = bi;
    }
  }

  // ── 4) 지역 그래프 (땅으로 이어진 이웃만) + 깊이 ──
  const nb: Set<number>[] = Array.from({ length: N }, () => new Set<number>());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isLand(x, y)) continue;
      const a = region[y * w + x];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isLand(nx, ny)) continue;
        const b = region[ny * w + nx];
        if (a !== b) {
          nb[a].add(b);
          nb[b].add(a);
        }
      }
    }
  }
  const depth = new Array<number>(N).fill(-1);
  const parent = new Array<number>(N).fill(-1);
  depth[0] = 0;
  const q = [0];
  while (q.length) {
    const a = q.shift()!;
    // 이웃을 씨앗 거리순으로 방문해서 자연스러운 길이 되도록
    const list = [...nb[a]].sort((i, j) => (seeds[i][1] - seeds[a][1]) ** 2 + (seeds[i][0] - seeds[a][0]) ** 2 - ((seeds[j][1] - seeds[a][1]) ** 2 + (seeds[j][0] - seeds[a][0]) ** 2));
    for (const b of list) {
      if (depth[b] !== -1) continue;
      depth[b] = depth[a] + 1;
      parent[b] = a;
      q.push(b);
    }
  }
  // 혹시 끊긴 지역이 있으면 가장 가까운 지역에 붙여 둔다
  for (let i = 0; i < N; i++) {
    if (depth[i] !== -1) continue;
    let best = 0;
    let bd = Infinity;
    for (let j = 0; j < N; j++) {
      if (depth[j] === -1) continue;
      const d = (seeds[i][0] - seeds[j][0]) ** 2 + (seeds[i][1] - seeds[j][1]) ** 2;
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    depth[i] = depth[best] + 1;
    parent[i] = best;
  }

  // ── 5) 분위기 배정 (모든 분위기 최소 1개, 시작 지역은 과수원) ──
  const biome: Biome[] = new Array(N);
  biome[0] = 'orchard';
  const order = Array.from({ length: N - 1 }, (_, i) => i + 1).sort((a, b) => depth[a] - depth[b]);
  const must = BIOMES.filter((b) => b !== 'orchard');
  // 가까운 지역부터 한 번씩 다른 분위기를 깔아 초반에 재료가 골고루 나오게
  order.forEach((ri, k) => {
    biome[ri] = k < must.length ? must[k] : pick(rnd, BIOMES.map((b) => [b, theme.biomes[b] ?? 1] as [Biome, number]));
  });

  // 지형: 해안은 모래, 해변 분위기면 모래가 넓게
  const terrain: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      const d = dist[y * w + x];
      if (d >= 0.96) row.push(T_SEA);
      else if (d > 0.86 || (biome[region[y * w + x]] === 'beach' && d > 0.62)) row.push(T_SAND);
      else row.push(T_GRASS);
    }
    terrain.push(row);
  }
  // 연못 (숲·꽃밭 지역 일부)
  const ponds: [number, number][] = [];
  for (let i = 1; i < N; i++) {
    if ((biome[i] === 'meadow' || biome[i] === 'forest') && rnd() < 0.45) {
      const [px, py] = seeds[i];
      if (dist[py * w + px] > 0.7) continue;
      ponds.push([px, py]);
      for (let y = py - 4; y <= py + 4; y++) {
        for (let x = px - 4; x <= px + 4; x++) {
          if (!isLand(x, y)) continue;
          const d = Math.hypot(x - px, (y - py) * 1.2);
          if (d < 2.3) terrain[y][x] = T_SEA;
          else if (d < 3.3 && terrain[y][x] === T_GRASS) terrain[y][x] = T_SAND;
        }
      }
    }
  }

  const tiles = terrain.map((row, y) =>
    row.map((t, x) => {
      if (t === T_GRASS) return pick<number>(rnd, [[TILE_IDX.grass[0], 10], [TILE_IDX.grass[1], 4], [TILE_IDX.grass[2], 2], [TILE_IDX.grass[3], 1]]);
      if (t === T_SAND) return pick<number>(rnd, [[TILE_IDX.sand[0], 10], [TILE_IDX.sand[1], 2], [TILE_IDX.sand[2], 1]]);
      const d = dist[y * w + x];
      if (d < 0.96) return TILE_IDX.shallow; // 연못
      return d < 1.04 ? TILE_IDX.shallow : d < 1.3 ? TILE_IDX.sea : TILE_IDX.deep;
    }),
  );

  // ── 6) 캠프·선착장·오브젝트·낚시터 ──
  const camp = { tx: seeds[0][0], ty: seeds[0][1] };
  const taken = new Set<string>();
  const take = (x: number, y: number, r = 1) => {
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) taken.add(`${x + ox},${y + oy}`);
  };
  for (let oy = -3; oy <= 5; oy++) for (let ox = -5; ox <= 5; ox++) taken.add(`${camp.tx + ox},${camp.ty + oy}`);
  const decor: Decor[] = [
    { kind: 'tent', tx: camp.tx + 1, ty: camp.ty },
    { kind: 'campfire', tx: camp.tx - 1, ty: camp.ty + 1 },
  ];

  // 선착장: 캠프에서 남쪽으로 내려가 처음 만나는 바다 바로 앞 모래
  let dock = { tx: camp.tx, ty: camp.ty + 4, dir: 1 as 1 | -1 };
  for (let y = camp.ty; y < h - 1; y++) {
    if (terrain[y + 1][camp.tx] === T_SEA && dist[(y + 1) * w + camp.tx] >= 0.96) {
      dock = { tx: camp.tx, ty: y, dir: 1 };
      break;
    }
  }
  for (let oy = -2; oy <= 3; oy++) for (let ox = -4; ox <= 4; ox++) taken.add(`${dock.tx + ox},${dock.ty + oy}`);
  decor.push({ kind: 'crate', tx: dock.tx + 2, ty: dock.ty - 1 });
  if (terrain[dock.ty - 1]?.[dock.tx - 3] !== T_SEA) decor.push({ kind: 'lighthouse', tx: dock.tx - 3, ty: dock.ty - 1 });
  // 캠프 → 선착장 길도 비워두기
  for (let y = camp.ty; y <= dock.ty; y++) for (let ox = -1; ox <= 1; ox++) taken.add(`${camp.tx + ox},${y}`);
  for (const [px, py] of ponds) take(px, py, 4);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (taken.has(`${x},${y}`)) continue;
      const t = terrain[y][x];
      if (t === T_SEA) continue;
      const b = biome[region[y * w + x]];
      const info = BIOME_INFO[b];
      let kind: ObjectKind | null = null;
      if (t === T_GRASS) {
        if (rnd() < info.density) kind = pick<ObjectKind>(rnd, info.decor.filter(([k]) => k !== 'shell_pick' && k !== 'starfish_pick'));
      } else if (b === 'beach' ? rnd() < 0.12 : rnd() < 0.04) {
        kind = pick<ObjectKind>(rnd, [
          ['shell_pick', 4],
          ['starfish_pick', 2],
          ['pebbles', 3],
          ['rock', 1],
        ]);
      }
      if (!kind) continue;
      decor.push({ kind, tx: x, ty: y });
      take(x, y);
    }
  }

  // 낚시터 후보: 땅과 맞닿은 물 (지역별로 1~2곳)
  const shore: Map<number, FishingSpot[]> = new Map();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (terrain[y][x] !== T_SEA) continue;
      const touches = DIRS.some(([dx, dy]) => terrain[y + dy][x + dx] !== T_SEA);
      if (!touches) continue;
      // 바로 옆 땅의 지역에 속하게
      let r = region[y * w + x];
      for (const [dx, dy] of DIRS) if (terrain[y + dy][x + dx] !== T_SEA) r = region[(y + dy) * w + x + dx];
      if (!shore.has(r)) shore.set(r, []);
      shore.get(r)!.push({ tx: x, ty: y, region: r });
    }
  }
  const fishing: FishingSpot[] = [];
  const hasWater = new Array<boolean>(N).fill(false);
  for (const [r, list] of shore) {
    hasWater[r] = true;
    const n = Math.min(list.length, 2);
    for (let k = 0; k < n; k++) {
      const s = list[Math.floor(rnd() * list.length)];
      if (fishing.some((f) => Math.abs(f.tx - s.tx) + Math.abs(f.ty - s.ty) < 6)) continue;
      if (Math.abs(s.tx - dock.tx) < 4 && Math.abs(s.ty - dock.ty) < 4) continue;
      fishing.push(s);
    }
  }

  // ── 7) 지역 정보 + 퀘스트 ──
  const usedNames = new Set<string>();
  const regions: RegionInfo[] = [];
  for (let i = 0; i < N; i++) {
    const info = BIOME_INFO[biome[i]];
    let name = '';
    for (let k = 0; k < 20; k++) {
      name = `${info.names[0][Math.floor(rnd() * info.names[0].length)]} ${info.names[1][Math.floor(rnd() * info.names[1].length)]}`;
      if (!usedNames.has(name)) break;
    }
    if (usedNames.has(name)) name += ` ${i}`;
    usedNames.add(name);
    if (i === 0) name = '도착 캠프';

    regions.push({
      idx: i,
      name,
      biome: biome[i],
      sx: seeds[i][0],
      sy: seeds[i][1],
      depth: depth[i],
      parent: parent[i],
      neighbors: [...nb[i]],
      need: {},
      hasWater: hasWater[i],
      signX: seeds[i][0],
      signY: seeds[i][1],
      story: info.story[Math.floor(rnd() * info.story.length)],
    });
  }

  for (const r of regions) {
    if (r.idx === 0) continue;
    // 퀘스트 재료는 조상 지역(이미 열린 게 보장됨)에서만 고른다
    const pool = new Set<ItemId>();
    const fishPool = new Set<ItemId>();
    for (let a = r.parent; a !== -1; a = regions[a].parent) {
      for (const it of BIOME_INFO[regions[a].biome].items) pool.add(it);
      if (regions[a].hasWater) {
        fishPool.add('fish_small');
        if (BIOME_INFO[regions[a].biome].fish.some(([f]) => f === 'fish')) fishPool.add('fish');
      }
    }
    const cand = [...pool, ...fishPool];
    const kinds = Math.min(cand.length, r.depth <= 1 ? 2 : 3);
    const total = Math.min(60, Math.round(7 + r.depth * 2.4 + islandIdx * 3.5));
    const chosen: ItemId[] = [];
    // 바로 앞 지역 재료를 하나는 꼭 포함
    const parentItems = BIOME_INFO[regions[r.parent].biome].items;
    chosen.push(parentItems[Math.floor(rnd() * parentItems.length)]);
    while (chosen.length < kinds) {
      const c = cand[Math.floor(rnd() * cand.length)];
      if (!chosen.includes(c)) chosen.push(c);
    }
    chosen.forEach((it, k) => {
      const share = Math.max(1, Math.round((total / kinds) * (k === 0 ? 1.2 : 0.9)));
      // 물고기·희귀 재료는 개수를 줄여서
      const scale = it.startsWith('fish') || it === 'coal' || it === 'starfish' ? 0.5 : 1;
      r.need[it] = Math.max(1, Math.round(share * scale));
    });

    // 캠프에서 3칸 이상 떨어진 지역(2번 섬부터는 2칸)은 머지로 만든 물건도 필요하다
    const craftFrom = islandIdx >= 1 ? 2 : 3;
    if (r.depth >= craftFrom) {
      const stage2 = CHAINS.filter((c) => pool.has(c[0])).map((c) => c[1]);
      if (stage2.length) {
        const it = stage2[Math.floor(rnd() * stage2.length)];
        r.need[it] = 1 + Math.floor(r.depth / 4) + Math.floor(islandIdx / 3);
      }
    }
    // 아주 먼 지역은 두 번 합친 물건까지
    if (r.depth >= craftFrom + 4) {
      const stage3 = CHAINS.filter((c) => pool.has(c[0]) && c.length > 2 && !(c[1] in r.need)).map((c) => c[2]);
      if (stage3.length) {
        const it = stage3[Math.floor(rnd() * stage3.length)];
        r.need[it] = 1 + Math.floor(islandIdx / 4);
      }
    }

    // 표지판: 부모 지역과 맞닿은 이 지역 땅 중, 부모 씨앗에 가장 가까운 곳 (바로 옆 부모 땅)
    const p = regions[r.parent];
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (region[y * w + x] !== r.parent || terrain[y][x] === T_SEA) continue;
        const touches = DIRS.some(([dx, dy]) => region[(y + dy) * w + x + dx] === r.idx && terrain[y + dy][x + dx] !== T_SEA);
        if (!touches) continue;
        const d = (x - p.sx) ** 2 + (y - p.sy) ** 2 + ((x - r.sx) ** 2 + (y - r.sy) ** 2) * 0.5;
        if (d < bd && !taken.has(`${x},${y}`)) {
          bd = d;
          best = [x, y];
        }
      }
    }
    if (best) {
      r.signX = best[0];
      r.signY = best[1];
    }
  }
  // 표지판 자리에 있는 오브젝트는 치운다
  const signSet = new Set(regions.slice(1).map((r) => `${r.signX},${r.signY}`));
  const finalDecor = decor.filter((d) => !signSet.has(`${d.tx},${d.ty}`));

  return { w, h, terrain, tiles, region, regions, decor: finalDecor, fishing, camp, dock };
}

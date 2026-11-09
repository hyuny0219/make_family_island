import Phaser from 'phaser';
import { TILE } from '../config';
import { T_GRASS, T_SAND, T_SEA } from './generate';

const EDGE = { grass: '#b7e279', grassLine: '#8fc46a', sand: '#fde4b4', foam: 'rgba(243,247,247,0.9)' };
const D = 7; // 물결 최대 두께
const O = 1; // 타일 안쪽으로 1px 겹쳐 그려서, 화면 배율 반올림으로 생기는 틈을 막는다
const F = D + 1 + O; // 조각 두께
const DIRS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/**
 * 지형 경계 물결 조각 텍스처 (2종 × 4방향 × 4변형) 를 한 번 만든다.
 * 큰 렌더 텍스처 대신 작은 조각을 Blitter로 찍어서 메모리를 아낀다.
 */
export function ensureEdgeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('edges')) return;
  const tex = scene.textures.createCanvas('edges', TILE * 8, TILE * 4)!;
  const ctx = tex.getContext();
  const kinds: [string, string][] = [
    [EDGE.sand, EDGE.foam],
    [EDGE.grass, EDGE.grassLine],
  ];
  kinds.forEach(([fill, tip], k) => {
    DIRS.forEach(([dx, dy], d) => {
      for (let v = 0; v < 4; v++) {
        const idx = k * 16 + d * 4 + v;
        const ox = (idx % 8) * TILE;
        const oy = Math.floor(idx / 8) * TILE;
        for (let i = 0; i < TILE; i++) {
          const ext = 2 + Math.round(1.5 + 1.5 * Math.sin(i * 0.55 + v * 1.7)) + O;
          ctx.fillStyle = fill;
          if (dy === 1) ctx.fillRect(ox + i, oy, 1, ext);
          else if (dy === -1) ctx.fillRect(ox + i, oy + F - ext, 1, ext);
          else if (dx === 1) ctx.fillRect(ox, oy + i, ext, 1);
          else ctx.fillRect(ox + F - ext, oy + i, ext, 1);
          ctx.fillStyle = tip;
          if (dy === 1) ctx.fillRect(ox + i, oy + ext, 1, 1);
          else if (dy === -1) ctx.fillRect(ox + i, oy + F - ext - 1, 1, 1);
          else if (dx === 1) ctx.fillRect(ox + ext, oy + i, 1, 1);
          else ctx.fillRect(ox + F - ext - 1, oy + i, 1, 1);
        }
        const horiz = dx === 0;
        tex.add(`e${idx}`, 0, ox, oy, horiz ? TILE : F, horiz ? F : TILE);
      }
    });
  });
  tex.refresh();
}

/** 지형 경계에 물결 조각 찍기 */
export function drawEdges(scene: Phaser.Scene, terrain: number[][]) {
  ensureEdgeTexture(scene);
  const h = terrain.length;
  const w = terrain[0].length;
  const blit = scene.add.blitter(0, 0, 'edges').setDepth(-900);
  const rank = (t: number) => (t === T_GRASS ? 2 : t === T_SAND ? 1 : 0);
  // 모래→바다 먼저, 그 위에 풀→모래
  [T_SAND, T_GRASS].forEach((type, k) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (terrain[y][x] !== type) continue;
        DIRS.forEach(([dx, dy], d) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
          const nt = terrain[ny][nx];
          if (rank(nt) >= rank(type)) return;
          if (type === T_GRASS && nt === T_SEA) return; // 풀이 바로 물에 닿는 곳은 없도록 생성됨
          const v = (x * 7 + y * 13) % 4;
          const frame = `e${k * 16 + d * 4 + v}`;
          let px = x * TILE;
          let py = y * TILE;
          if (dy === 1) py = (y + 1) * TILE - O;
          else if (dy === -1) py = y * TILE - (F - O);
          else if (dx === 1) px = (x + 1) * TILE - O;
          else px = x * TILE - (F - O);
          blit.create(px, py, frame);
        });
      }
    }
  });
  return blit;
}

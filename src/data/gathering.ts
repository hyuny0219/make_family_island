import type { ObjectKind } from './assets';
import type { ItemId } from './items';

/** [아이템, 확률(0~1), 최소, 최대] */
export type Drop = [ItemId, number, number, number];

export interface GatherRule {
  /** 몇 번 건드리면 다 쓰는지 */
  hits: number;
  /** 건드릴 때마다 굴리는 드롭 */
  perHit: Drop[];
  /** 마지막 한 번에 추가로 주는 드롭 */
  final: Drop[];
  /** rest: 그 자리에서 쉬었다가 다시 열림 / remove: 사라졌다가 다시 생김 */
  deplete: 'rest' | 'remove';
  /** 다시 열리기까지 걸리는 시간(초) */
  regrowSec: number;
  /** 필요한 도구 (없으면 안내만) */
  needs?: ItemId;
  /** 상호작용 연출 계열 */
  feel: 'leafy' | 'stony';
}

/**
 * 오브젝트별 채집 규칙 — 밸런스 조정은 이 파일만 고치면 된다.
 * 규칙이 없는 오브젝트(텐트·모닥불·새싹)는 반응 연출만 한다.
 */
export const GATHER: Partial<Record<ObjectKind, GatherRule>> = {
  fruit_tree: { hits: 3, perHit: [['fruit', 0.55, 1, 1], ['twig', 0.4, 1, 1]], final: [], deplete: 'rest', regrowSec: 45, feel: 'leafy' },
  pine_tree: { hits: 3, perHit: [['twig', 0.55, 1, 1], ['pinecone', 0.4, 1, 1]], final: [], deplete: 'rest', regrowSec: 45, feel: 'leafy' },
  bush: { hits: 2, perHit: [['twig', 0.6, 1, 1]], final: [], deplete: 'rest', regrowSec: 30, feel: 'leafy' },
  stump: { hits: 2, perHit: [['twig', 0.7, 1, 1]], final: [], deplete: 'rest', regrowSec: 40, feel: 'stony' },
  flowers: { hits: 1, perHit: [], final: [['flower', 1, 1, 2]], deplete: 'remove', regrowSec: 40, feel: 'leafy' },
  rock: { hits: 3, perHit: [['stone', 0.3, 1, 1]], final: [['stone', 1, 2, 3], ['coal', 0.35, 1, 1]], deplete: 'remove', regrowSec: 50, feel: 'stony' },
  pebbles: { hits: 1, perHit: [], final: [['stone', 1, 1, 2]], deplete: 'remove', regrowSec: 30, feel: 'stony' },
  ore_rock: { hits: 4, perHit: [['stone', 0.25, 1, 1]], final: [['crystal', 1, 1, 1], ['coal', 0.5, 1, 1]], deplete: 'remove', regrowSec: 90, feel: 'stony' },
  boulder: { hits: 5, perHit: [['stone', 0.5, 1, 1]], final: [['stone', 1, 3, 4], ['coal', 0.5, 1, 2]], deplete: 'remove', regrowSec: 120, needs: 'stone_pickaxe', feel: 'stony' },
};

export function rollDrops(drops: Drop[], rnd: () => number = Math.random): ItemId[] {
  const out: ItemId[] = [];
  for (const [id, p, min, max] of drops) {
    if (rnd() < p) {
      const n = min + Math.floor(rnd() * (max - min + 1));
      for (let i = 0; i < n; i++) out.push(id);
    }
  }
  return out;
}

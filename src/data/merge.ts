import type { ItemId } from './items';

/** 머지 체인: 같은 것 3개 → 다음 단계 1개 (5개 이상이면 2개) */
export const CHAINS: ItemId[][] = [
  ['twig', 'log', 'plank', 'chair', 'sofa'],
  ['stone', 'brick', 'wall', 'fountain'],
  ['flower', 'bouquet', 'flowerpot', 'arch'],
  ['fruit', 'juice', 'jam', 'pie'],
  ['shell', 'pearl', 'necklace'],
  ['pinecone', 'wreath'],
  ['coal', 'lantern'],
];

export const MERGE_NEXT: Partial<Record<ItemId, ItemId>> = {};
/** 체인 안에서 몇 번째 단계인지 (0 = 기본 재료) */
export const MERGE_STAGE: Partial<Record<ItemId, number>> = {};
/** 어떤 기본 재료에서 나오는지 */
export const MERGE_BASE: Partial<Record<ItemId, ItemId>> = {};
for (const chain of CHAINS) {
  chain.forEach((id, i) => {
    MERGE_STAGE[id] = i;
    MERGE_BASE[id] = chain[0];
    if (i < chain.length - 1) MERGE_NEXT[id] = chain[i + 1];
  });
}

/** 머지 보드에 올릴 수 있는 아이템 */
export const isMergeable = (id: ItemId) => id in MERGE_STAGE;

export interface Recipe {
  id: ItemId;
  need: Partial<Record<ItemId, number>>;
  desc: string;
  /** 도구는 한 번만 만들면 됨 */
  tool?: boolean;
}

/** 작업대 레시피 — 서로 다른 재료를 모아 "만들기" */
export const RECIPES: Recipe[] = [
  { id: 'basket', need: { twig: 2, flower: 2 }, desc: '나무를 흔들면 더 많이 나와요', tool: true },
  { id: 'rod', need: { log: 1, twig: 3 }, desc: '물고기를 더 쉽게 낚아요', tool: true },
  { id: 'stone_pickaxe', need: { plank: 1, stone: 3 }, desc: '큰 바위를 캐고, 돌을 빨리 캐요', tool: true },
  { id: 'fence', need: { log: 2, twig: 2 }, desc: '섬 꾸미기에 써요' },
  { id: 'table', need: { plank: 2, log: 1 }, desc: '섬 꾸미기에 써요' },
  { id: 'bed', need: { plank: 2, bouquet: 1 }, desc: '섬 꾸미기에 써요' },
];

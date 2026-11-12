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
  ['jelly', 'jelly_block', 'jelly_lamp'],
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

/**
 * 조합 — 보드에서 서로 다른 두 가지를 겹치면 새로운 것이 된다 (순서는 상관없음).
 * use: 어디에 쓰는지 (조합 수첩에 보인다)
 */
export interface Combo {
  a: ItemId;
  b: ItemId;
  out: ItemId;
  use: string;
  /** 창고에서 '쓰기'를 누를 수 있는가 */
  usable?: boolean;
}

export const COMBOS: Combo[] = [
  { a: 'jelly', b: 'fruit', out: 'candy', use: '쓰면 왕슬라임이 찾아와요', usable: true },
  { a: 'fish', b: 'coal', out: 'grilled_fish', use: '먹으면 60초 동안 발이 빨라져요', usable: true },
  { a: 'fish_small', b: 'jelly', out: 'bait', use: '낚시할 때 저절로 써요 — 황금 물고기가 잘 물어요' },
  { a: 'twig', b: 'coal', out: 'torch', use: '꾸미기 → 광장에서 섬을 밝혀요' },
  { a: 'flower', b: 'twig', out: 'flower_crown', use: '주민에게 선물하면 호감도 +2' },
  { a: 'coal', b: 'pinecone', out: 'firework', use: '쓰면 하늘에 불꽃이 터져요', usable: true },
];

const key = (a: ItemId, b: ItemId) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const COMBO_MAP = new Map(COMBOS.map((c) => [key(c.a, c.b), c]));
export const comboOf = (a: ItemId, b: ItemId) => (a === b ? undefined : COMBO_MAP.get(key(a, b)));
/** 조합 재료가 되는 것들 */
export const COMBO_PARTS = new Set<ItemId>(COMBOS.flatMap((c) => [c.a, c.b]));
export const USABLE = new Set<ItemId>(COMBOS.filter((c) => c.usable).map((c) => c.out));
/** 이 재료와 조합되는 짝들 */
export const comboPartners = (id: ItemId) => COMBOS.flatMap((c) => (c.a === id ? [c.b] : c.b === id ? [c.a] : []));

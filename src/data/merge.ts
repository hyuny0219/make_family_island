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
  { id: 'sword', need: { plank: 2, twig: 2 }, desc: '몬스터를 2배로 세게 때려요', tool: true },
  { id: 'stone_sword', need: { sword: 1, brick: 3 }, desc: '몬스터를 3배로 세게 때려요', tool: true },
  { id: 'fence', need: { log: 2, twig: 2 }, desc: '섬 꾸미기에 써요' },
  { id: 'table', need: { plank: 2, log: 1 }, desc: '섬 꾸미기에 써요' },
  { id: 'bed', need: { plank: 2, bouquet: 1 }, desc: '섬 꾸미기에 써요' },
  // 건축물 — 만든 뒤 꾸미기에서 섬에 놓는다
  { id: 'path_dirt', need: { stone: 1 }, desc: '꾸미기 → 길에서 놓아요' },
  { id: 'path_stone', need: { stone: 2 }, desc: '꾸미기 → 길에서 놓아요' },
  { id: 'path_wood', need: { log: 1 }, desc: '꾸미기 → 길에서 놓아요' },
  { id: 'house_red', need: { plank: 3, brick: 3 }, desc: '꾸미기 → 집에서 놓아요' },
  { id: 'house_blue', need: { plank: 3, brick: 3, shell: 5 }, desc: '꾸미기 → 집에서 놓아요' },
  { id: 'cabin', need: { log: 6, plank: 2 }, desc: '꾸미기 → 집에서 놓아요' },
  { id: 'stall', need: { plank: 2, fruit: 6 }, desc: '꾸미기 → 집에서 놓아요' },
  { id: 'windmill', need: { plank: 4, brick: 4, crystal: 1 }, desc: '꾸미기 → 집에서 놓아요' },
  { id: 'well', need: { brick: 2, stone: 6 }, desc: '꾸미기 → 집에서 놓아요' },
  { id: 'hedge', need: { twig: 3, flower: 1 }, desc: '꾸미기 → 울타리에서 놓아요' },
  { id: 'gate', need: { plank: 1, flower: 2 }, desc: '꾸미기 → 울타리에서 놓아요' },
  { id: 'bench', need: { log: 2 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'lamp', need: { stone: 3, coal: 1 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'mailbox', need: { plank: 1 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'signpost', need: { twig: 4 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'statue', need: { stone: 10, crystal: 1 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'picnic', need: { plank: 2, fruit: 2 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'swing', need: { log: 3, twig: 4 }, desc: '꾸미기 → 광장에서 놓아요' },
  { id: 'flowerbed', need: { flower: 4 }, desc: '꾸미기 → 자연에서 놓아요' },
  { id: 'blossom', need: { pinecone: 3, flower: 3 }, desc: '꾸미기 → 자연에서 놓아요' },
  { id: 'pond', need: { stone: 6, shell: 3 }, desc: '꾸미기 → 자연에서 놓아요' },
  // 섬 특산 — 그 섬 몬스터의 재료로 만드는 집과 가구
  { id: 'house_leaf', need: { log: 4, herb: 6, dew: 4 }, desc: '곰돌이 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_flower', need: { plank: 4, petal: 6, pollen: 4 }, desc: '꽃향기 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_tree', need: { log: 6, acorn: 6, resin: 3 }, desc: '솔방울 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_shell', need: { brick: 3, conch: 6, shell: 6 }, desc: '조개 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_rock', need: { stone: 10, rock_salt: 5, brick: 2 }, desc: '바위 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_mushroom', need: { plank: 4, mushroom: 6, spore: 5 }, desc: '버섯 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_igloo', need: { ice: 10, snowberry: 4, brick: 2 }, desc: '눈송이 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_tent', need: { plank: 4, spice: 5, date: 4 }, desc: '모래바람 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_forge', need: { brick: 5, ember: 6, lava_egg: 3 }, desc: '불꽃 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'house_cloud', need: { cotton: 8, cloud_milk: 4, stardust: 4 }, desc: '구름 섬 특산 · 꾸미기 → 집에서 놓아요' },
  { id: 'herb_shelf', need: { plank: 1, herb: 4 }, desc: '곰돌이 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'petal_sofa', need: { plank: 2, petal: 5 }, desc: '꽃향기 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'stump_table', need: { log: 2, acorn: 3 }, desc: '솔방울 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'shell_bed', need: { plank: 2, conch: 2, sea_jelly: 3 }, desc: '조개 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'salt_lamp', need: { rock_salt: 4, coal: 1 }, desc: '바위 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'mushroom_table', need: { mushroom: 4, spore: 2 }, desc: '버섯 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'ice_bed', need: { ice: 6, snowberry: 2 }, desc: '눈송이 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'hourglass', need: { plank: 1, spice: 2, date: 2 }, desc: '모래바람 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'lava_stove', need: { stone: 4, ember: 4, chili: 2 }, desc: '불꽃 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'cloud_bed', need: { cotton: 5, stardust: 2 }, desc: '구름 섬 특산 · 집 안 꾸미기 → 가구에서 놓아요' },
  // 가구 — 만든 뒤 집 안 꾸미기에서 놓는다
  { id: 'bookshelf', need: { plank: 3 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'wardrobe', need: { plank: 4 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'stove', need: { brick: 3, coal: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'fireplace', need: { brick: 5, coal: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'bathtub', need: { stone: 6, shell: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'piano', need: { plank: 5, crystal: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'toybox', need: { plank: 2, jelly: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'fridge', need: { brick: 2, stone: 4, crystal: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'sink', need: { plank: 2, stone: 4 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'dining', need: { plank: 4, fruit: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'cupboard', need: { plank: 3, shell: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'oven', need: { brick: 3, coal: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'counter', need: { plank: 2, fruit: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'desk', need: { plank: 3, twig: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'tv', need: { plank: 2, coal: 2, crystal: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'armchair', need: { plank: 1, flower: 4 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'dresser', need: { plank: 3, flower: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'longsofa', need: { plank: 3, flower: 6 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'teatable', need: { log: 2, shell: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'washer', need: { brick: 2, stone: 4, jelly: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'washstand', need: { stone: 4, shell: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'toilet', need: { stone: 5, plank: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'vanity', need: { plank: 3, shell: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'clock', need: { plank: 3, coal: 1, crystal: 1 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'aquarium', need: { stone: 3, shell: 3, jelly: 2 }, desc: '집 안 꾸미기 → 가구에서 놓아요' },
  { id: 'rug', need: { flower: 3, twig: 3 }, desc: '집 안 꾸미기 → 실내 장식에서 놓아요' },
  { id: 'floorlamp', need: { stone: 2, coal: 1 }, desc: '집 안 꾸미기 → 실내 장식에서 놓아요' },
  { id: 'plant', need: { flower: 2, twig: 2 }, desc: '집 안 꾸미기 → 실내 장식에서 놓아요' },
  { id: 'picture', need: { plank: 1, flower: 1 }, desc: '집 안 꾸미기 → 실내 장식에서 놓아요' },
  { id: 'window', need: { plank: 2, shell: 1 }, desc: '집 안 꾸미기 → 실내 장식에서 놓아요' },
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
  { a: 'fish_small', b: 'jelly', out: 'bait', use: '낚시할 때 저절로 써요 — 황금 물고기가 잘 물어요' },
  { a: 'twig', b: 'coal', out: 'torch', use: '꾸미기 → 광장에서 섬을 밝혀요' },
  { a: 'flower', b: 'twig', out: 'flower_crown', use: '주민에게 선물하면 호감도 +2' },
  { a: 'coal', b: 'pinecone', out: 'firework', use: '쓰면 하늘에 불꽃이 터져요', usable: true },
  { a: 'ember', b: 'coal', out: 'bomb', use: '쓰면 주변 몬스터가 모두 크게 다쳐요', usable: true },
  { a: 'fish', b: 'coal', out: 'grilled_fish', use: '' },
  { a: 'fruit', b: 'flower', out: 'fruit_salad', use: '' },
  { a: 'fish_small', b: 'coal', out: 'fish_skewer', use: '' },
  { a: 'fish_big', b: 'coal', out: 'fish_steak', use: '' },
  { a: 'juice', b: 'jelly', out: 'jelly_drink', use: '' },
  { a: 'jam', b: 'pinecone', out: 'nut_cookie', use: '' },
  { a: 'crab', b: 'coal', out: 'crab_grill', use: '' },
  { a: 'shell', b: 'fish_small', out: 'clam_soup', use: '' },
  { a: 'starfish', b: 'jelly', out: 'star_jelly', use: '' },
  { a: 'pie', b: 'jelly_block', out: 'jelly_cake', use: '' },
  { a: 'crab', b: 'shell', out: 'seafood_plate', use: '' },
  // 섬 몬스터 재료 요리 (섬 번호 순)
  { a: 'herb', b: 'fruit', out: 'herb_bowl', use: '' },
  { a: 'spot_berry', b: 'flower', out: 'spot_punch', use: '' },
  { a: 'dew', b: 'fruit', out: 'dew_fruit', use: '' },
  { a: 'pollen', b: 'honey', out: 'pollen_ball', use: '' },
  { a: 'petal', b: 'fruit', out: 'petal_ade', use: '' },
  { a: 'acorn', b: 'coal', out: 'roast_acorn', use: '' },
  { a: 'resin', b: 'pinecone', out: 'pine_candy', use: '' },
  { a: 'sap', b: 'fruit', out: 'sap_drink', use: '' },
  { a: 'conch', b: 'coal', out: 'conch_grill', use: '' },
  { a: 'sea_jelly', b: 'fruit', out: 'sea_pudding', use: '' },
  { a: 'rock_salt', b: 'fish', out: 'salt_fish', use: '' },
  { a: 'potato', b: 'coal', out: 'baked_potato', use: '' },
  { a: 'spore', b: 'mushroom', out: 'cream_soup', use: '' },
  { a: 'truffle', b: 'coal', out: 'truffle_grill', use: '' },
  { a: 'smelt', b: 'coal', out: 'smelt_fry', use: '' },
  { a: 'snowberry', b: 'ice', out: 'snow_bingsu', use: '' },
  { a: 'date', b: 'honey', out: 'honey_date', use: '' },
  { a: 'spice', b: 'fish', out: 'spice_fish', use: '' },
  { a: 'chili', b: 'fish', out: 'chili_stew', use: '' },
  { a: 'lava_egg', b: 'ember', out: 'hot_egg', use: '' },
  { a: 'cloud_milk', b: 'honey', out: 'cloud_latte', use: '' },
  { a: 'stardust', b: 'cotton', out: 'star_candy', use: '' },
  { a: 'honey', b: 'fruit', out: 'honey_fruit', use: '' },
  { a: 'honey', b: 'juice', out: 'honey_tea', use: '' },
  { a: 'honey', b: 'pinecone', out: 'honey_nuts', use: '' },
  { a: 'honey', b: 'pie', out: 'honey_pie', use: '' },
  { a: 'mushroom', b: 'coal', out: 'mushroom_grill', use: '' },
  { a: 'mushroom', b: 'fish', out: 'mushroom_stew', use: '' },
  { a: 'mushroom', b: 'flower', out: 'herb_salad', use: '' },
  { a: 'berry', b: 'juice', out: 'berry_smoothie', use: '' },
  { a: 'berry', b: 'flower', out: 'berry_tea', use: '' },
  { a: 'berry', b: 'honey', out: 'berry_honey', use: '' },
  { a: 'ice', b: 'juice', out: 'sherbet', use: '' },
  { a: 'ice', b: 'fish', out: 'sashimi', use: '' },
  { a: 'ice', b: 'jelly', out: 'ice_jelly', use: '' },
  { a: 'cactus_fruit', b: 'juice', out: 'cactus_juice', use: '' },
  { a: 'cactus_fruit', b: 'flower', out: 'desert_tea', use: '' },
  { a: 'ember', b: 'fish_big', out: 'fire_grill', use: '' },
  { a: 'ember', b: 'fruit', out: 'roasted_fruit', use: '' },
  { a: 'cotton', b: 'fruit', out: 'cotton_candy', use: '' },
  { a: 'cotton', b: 'jelly', out: 'cloud_pudding', use: '' },
];

const key = (a: ItemId, b: ItemId) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const COMBO_MAP = new Map(COMBOS.map((c) => [key(c.a, c.b), c]));
export const comboOf = (a: ItemId, b: ItemId) => (a === b ? undefined : COMBO_MAP.get(key(a, b)));
/** 조합 재료가 되는 것들 */
export const COMBO_PARTS = new Set<ItemId>(COMBOS.flatMap((c) => [c.a, c.b]));
export const USABLE = new Set<ItemId>(COMBOS.filter((c) => c.usable).map((c) => c.out));
/** 이 재료와 조합되는 짝들 */
export const comboPartners = (id: ItemId) => COMBOS.flatMap((c) => (c.a === id ? [c.b] : c.b === id ? [c.a] : []));

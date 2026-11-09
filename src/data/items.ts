/** 재료·아이템 정의. 아이콘은 public/assets/item_<id>.png */
export const ITEMS = {
  twig: { name: '나뭇가지' },
  log: { name: '통나무' },
  plank: { name: '판자' },
  chair: { name: '의자' },
  stone: { name: '돌' },
  brick: { name: '벽돌' },
  coal: { name: '석탄' },
  crystal: { name: '보석 원석' },
  fruit: { name: '과일' },
  pinecone: { name: '솔방울' },
  flower: { name: '꽃' },
  bouquet: { name: '꽃다발' },
  jelly: { name: '젤리' },
  wood_pickaxe: { name: '나무 곡괭이' },
  stone_pickaxe: { name: '돌 곡괭이' },
  basket: { name: '바구니' },
  fish_small: { name: '송사리' },
  fish: { name: '붕어' },
  fish_big: { name: '큰 물고기' },
  fish_gold: { name: '황금 물고기' },
  crab: { name: '꽃게' },
  shell: { name: '조개껍데기' },
  boot: { name: '낡은 장화' },
  starfish: { name: '불가사리' },
} as const;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const itemKey = (id: ItemId) => `item_${id}`;

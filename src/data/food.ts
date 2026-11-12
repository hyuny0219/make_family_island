import type { ItemId } from './items';

/** 음식을 먹으면 걸리는 효과 */
export type BuffId = 'speed' | 'gather' | 'power' | 'shield' | 'luck' | 'regen';

export const BUFFS: Record<BuffId, { emoji: string; name: string; desc: string }> = {
  speed: { emoji: '💨', name: '빨라짐', desc: '발이 1.6배 빨라져요' },
  gather: { emoji: '🧺', name: '풍년', desc: '채집할 때 하나씩 더 나와요' },
  power: { emoji: '💪', name: '힘', desc: '몬스터를 더 세게 때려요 (+2)' },
  shield: { emoji: '🛡️', name: '튼튼', desc: '맞아도 반만 아파요' },
  luck: { emoji: '🍀', name: '행운', desc: '낚시가 빨리 물고 황금 물고기가 잘 나와요' },
  regen: { emoji: '💗', name: '재생', desc: '체력이 조금씩 차올라요' },
};

export interface Food {
  /** 회복되는 체력 (최대 100) */
  heal: number;
  buffs?: BuffId[];
  /** 효과가 이어지는 시간(초) */
  sec?: number;
}

const F = (heal: number, buffs?: BuffId[], sec?: number): Food => ({ heal, buffs, sec });

/** 먹을 수 있는 것 — 재료가 귀할수록 많이 회복되고 효과가 오래간다 */
export const FOODS: Partial<Record<ItemId, Food>> = {
  // 날것 · 머지로 만드는 것
  fruit: F(6),
  juice: F(15, ['gather'], 60),
  jam: F(20, ['power'], 60),
  pie: F(40, ['speed', 'gather'], 90),
  // 조합 요리 (어느 섬에서나)
  grilled_fish: F(25, ['speed'], 60),
  fruit_salad: F(20, ['regen'], 30),
  fish_skewer: F(15, ['power'], 45),
  fish_steak: F(50, ['shield'], 90),
  jelly_drink: F(20, ['speed'], 90),
  nut_cookie: F(25, ['gather'], 90),
  crab_grill: F(35, ['power'], 90),
  clam_soup: F(30, ['shield'], 60),
  star_jelly: F(10, ['luck'], 90),
  jelly_cake: F(100, ['speed', 'gather'], 120),
  seafood_plate: F(60, ['luck'], 90),
  // 몬스터 재료 · 섬 특산
  honey: F(12),
  honey_fruit: F(30, ['regen'], 60),
  honey_tea: F(40, ['shield'], 90),
  honey_nuts: F(25, ['gather'], 120),
  honey_pie: F(80, ['speed', 'gather', 'power'], 90),
  mushroom_grill: F(30, ['power'], 60),
  mushroom_stew: F(60, ['regen'], 60),
  herb_salad: F(25, ['gather'], 90),
  berry: F(8),
  berry_smoothie: F(30, ['speed'], 120),
  berry_tea: F(25, ['regen'], 90),
  berry_honey: F(45, ['power'], 90),
  sherbet: F(35, ['speed'], 90),
  sashimi: F(40, ['luck'], 120),
  ice_jelly: F(25, ['shield'], 90),
  cactus_fruit: F(10),
  cactus_juice: F(45, ['shield'], 120),
  desert_tea: F(30, ['regen'], 90),
  fire_grill: F(70, ['power'], 120),
  roasted_fruit: F(30, ['regen'], 90),
  cotton_candy: F(30, ['speed'], 120),
  cloud_pudding: F(50, ['luck'], 120),
};

/** 음식 설명 한 줄 (예: "체력 +25 · 💨 빨라짐 60초") */
export function foodText(id: ItemId) {
  const f = FOODS[id];
  if (!f) return '';
  const b = f.buffs?.length ? ` · ${f.buffs.map((k) => `${BUFFS[k].emoji} ${BUFFS[k].name}`).join(' ')} ${f.sec}초` : '';
  return `체력 +${f.heal}${b}`;
}

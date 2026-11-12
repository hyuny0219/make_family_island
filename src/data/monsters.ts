import type { ItemId } from './items';

export interface MonsterDef {
  id: string;
  name: string;
  hp: number;
  /** 한 번 맞으면 닳는 체력 */
  dmg: number;
  /** 쫓아오는 속도 (곰은 90) */
  speed: number;
  /** 잡으면 떨어뜨리는 것 [아이템, 가중치] */
  drops: [ItemId, number][];
  /** 떨어뜨리는 개수 */
  n: [number, number];
  /** 도망만 다니고 때리지 않는다 */
  shy?: boolean;
  /** 곰을 보면 먼저 덤빈다 (false면 맞기 전에는 가만히 있는다) */
  aggressive?: boolean;
  /** 곰을 알아채는 거리 (기본 105) */
  sight?: number;
  /** 보스: 크고, 내려찍기를 쓴다 */
  boss?: boolean;
  /** 그림 이름 (없으면 mon_<id>) */
  tex?: string;
}

export const MONSTERS: Record<string, MonsterDef> = {
  bee: { id: 'bee', name: '심술 벌', hp: 2, dmg: 6, speed: 78, drops: [['honey', 5], ['flower', 2]], n: [1, 2] },
  shroom: { id: 'shroom', name: '독버섯', hp: 4, dmg: 8, speed: 48, drops: [['mushroom', 5], ['pinecone', 2]], n: [1, 2] },
  crab: { id: 'crab', name: '집게 게', hp: 4, dmg: 10, speed: 60, drops: [['crab', 4], ['shell', 3]], n: [1, 2], aggressive: true },
  bat: { id: 'bat', name: '동굴 박쥐', hp: 3, dmg: 8, speed: 82, drops: [['berry', 5], ['coal', 2]], n: [1, 2], aggressive: true },
  snowman: { id: 'snowman', name: '심술 눈사람', hp: 6, dmg: 12, speed: 52, drops: [['ice', 5], ['coal', 1]], n: [2, 3] },
  cactus: { id: 'cactus', name: '걷는 선인장', hp: 6, dmg: 12, speed: 50, drops: [['cactus_fruit', 5], ['flower', 1]], n: [2, 3] },
  fire: { id: 'fire', name: '불꽃 정령', hp: 6, dmg: 15, speed: 70, drops: [['ember', 5], ['coal', 2]], n: [2, 3], aggressive: true },
  thunder: { id: 'thunder', name: '번개 구름', hp: 5, dmg: 15, speed: 74, drops: [['cotton', 5], ['crystal', 0.5]], n: [2, 3], aggressive: true },
  goblin: { id: 'goblin', name: '보물 도깨비', hp: 5, dmg: 0, speed: 86, drops: [['crystal', 3], ['brick', 2], ['plank', 2], ['trophy', 0.15]], n: [3, 4], shy: true },
};

/** 그 섬·지형에 사는 몬스터 (섬 전용이 먼저, 없으면 지형별) */
export const SKIN_MONSTER: Record<string, string> = { mushroom: 'shroom', snow: 'snowman', desert: 'cactus', volcano: 'fire', cloud: 'thunder' };
export const BIOME_MONSTER: Record<string, string> = { orchard: 'bee', meadow: 'bee', forest: 'shroom', beach: 'crab', rocky: 'bat' };

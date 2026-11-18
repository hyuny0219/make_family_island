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
  shroom: { id: 'shroom', name: '독버섯', hp: 5, dmg: 11, speed: 50, drops: [['mushroom', 5], ['pinecone', 2]], n: [1, 2] },
  crab: { id: 'crab', name: '집게 게', hp: 4, dmg: 9, speed: 60, drops: [['crab', 4], ['shell', 3]], n: [1, 2], aggressive: true },
  bat: { id: 'bat', name: '동굴 박쥐', hp: 4, dmg: 10, speed: 82, drops: [['berry', 5], ['coal', 2]], n: [1, 2], aggressive: true },
  snowman: { id: 'snowman', name: '심술 눈사람', hp: 6, dmg: 12, speed: 52, drops: [['ice', 5], ['coal', 1]], n: [2, 3] },
  cactus: { id: 'cactus', name: '걷는 선인장', hp: 6, dmg: 12, speed: 50, drops: [['cactus_fruit', 5], ['flower', 1]], n: [2, 3] },
  fire: { id: 'fire', name: '불꽃 정령', hp: 6, dmg: 15, speed: 70, drops: [['ember', 5], ['coal', 2]], n: [2, 3], aggressive: true },
  thunder: { id: 'thunder', name: '번개 구름', hp: 5, dmg: 15, speed: 74, drops: [['cotton', 5], ['crystal', 0.5]], n: [2, 3], aggressive: true },
  // 섬마다 따로 사는 몬스터 (섬 번호 순)
  sprout: { id: 'sprout', name: '새싹이', hp: 2, dmg: 6, speed: 58, drops: [['herb', 5], ['fruit', 2]], n: [1, 2] },
  ladybug: { id: 'ladybug', name: '무당벌레', hp: 2, dmg: 6, speed: 58, drops: [['spot_berry', 5], ['fruit', 2]], n: [1, 2] },
  snail: { id: 'snail', name: '느림보 달팽이', hp: 3, dmg: 6, speed: 40, drops: [['dew', 5], ['fruit', 2]], n: [1, 2] },
  butterfly: { id: 'butterfly', name: '팔랑 나비', hp: 3, dmg: 7, speed: 84, drops: [['pollen', 5], ['flower', 2]], n: [1, 2] },
  bud: { id: 'bud', name: '심술 꽃봉오리', hp: 3, dmg: 7, speed: 59, drops: [['petal', 5], ['flower', 2]], n: [1, 2] },
  squirrel: { id: 'squirrel', name: '도토리 다람쥐', hp: 3, dmg: 8, speed: 84, drops: [['acorn', 5], ['pinecone', 2]], n: [1, 2] },
  pinebug: { id: 'pinebug', name: '솔방울 도깨비', hp: 3, dmg: 8, speed: 60, drops: [['resin', 5], ['pinecone', 2]], n: [1, 2] },
  stump: { id: 'stump', name: '걷는 그루터기', hp: 4, dmg: 8, speed: 42, drops: [['sap', 5], ['pinecone', 2]], n: [1, 2] },
  conch: { id: 'conch', name: '소라게', hp: 4, dmg: 9, speed: 61, drops: [['conch', 5], ['shell', 2]], n: [1, 2] },
  jellyfish: { id: 'jellyfish', name: '둥실 해파리', hp: 4, dmg: 10, speed: 73, drops: [['sea_jelly', 5], ['shell', 2]], n: [1, 2], aggressive: true },
  golem: { id: 'golem', name: '꼬마 돌덩이', hp: 5, dmg: 10, speed: 44, drops: [['rock_salt', 5], ['coal', 2]], n: [1, 2] },
  mole: { id: 'mole', name: '땅굴 두더지', hp: 4, dmg: 10, speed: 62, drops: [['potato', 5], ['coal', 2]], n: [1, 2] },
  puff: { id: 'puff', name: '포자 방울', hp: 5, dmg: 11, speed: 63, drops: [['spore', 5], ['mushroom', 2]], n: [2, 3] },
  toad: { id: 'toad', name: '독 두꺼비', hp: 5, dmg: 12, speed: 75, drops: [['truffle', 5], ['mushroom', 2]], n: [2, 3], aggressive: true },
  penguin: { id: 'penguin', name: '심술 펭귄', hp: 5, dmg: 12, speed: 84, drops: [['smelt', 5], ['ice', 2]], n: [2, 3] },
  yeti: { id: 'yeti', name: '꼬마 설인', hp: 5, dmg: 13, speed: 76, drops: [['snowberry', 5], ['ice', 2]], n: [2, 3], aggressive: true },
  scorpion: { id: 'scorpion', name: '모래 전갈', hp: 6, dmg: 14, speed: 77, drops: [['date', 5], ['cactus_fruit', 2]], n: [2, 3], aggressive: true },
  tumble: { id: 'tumble', name: '데굴 덤불', hp: 6, dmg: 13, speed: 84, drops: [['spice', 5], ['cactus_fruit', 2]], n: [2, 3] },
  lavaslime: { id: 'lavaslime', name: '용암 슬라임', hp: 7, dmg: 14, speed: 48, drops: [['chili', 5], ['coal', 2]], n: [2, 3] },
  salamander: { id: 'salamander', name: '불도마뱀', hp: 6, dmg: 15, speed: 78, drops: [['lava_egg', 5], ['coal', 2]], n: [2, 3], aggressive: true },
  sheep: { id: 'sheep', name: '구름 양', hp: 7, dmg: 15, speed: 67, drops: [['cloud_milk', 5], ['crystal', 0.5]], n: [2, 3] },
  star: { id: 'star', name: '별똥별', hp: 7, dmg: 15, speed: 84, drops: [['stardust', 5], ['crystal', 0.5]], n: [2, 3] },
  goblin: { id: 'goblin', name: '보물 도깨비', hp: 5, dmg: 0, speed: 86, drops: [['crystal', 3], ['brick', 2], ['plank', 2], ['trophy', 0.15]], n: [3, 4], shy: true },
};

/** 섬마다 사는 몬스터 세 종 (섬 번호 순). 첫째가 그 섬의 대표 — 던전에서 보스가 부르는 부하이기도 하다 */
export const ISLAND_MONSTERS: string[][] = [
  ['sprout', 'ladybug', 'snail'],
  ['bee', 'butterfly', 'bud'],
  ['squirrel', 'pinebug', 'stump'],
  ['crab', 'conch', 'jellyfish'],
  ['bat', 'golem', 'mole'],
  ['shroom', 'puff', 'toad'],
  ['snowman', 'penguin', 'yeti'],
  ['cactus', 'scorpion', 'tumble'],
  ['fire', 'lavaslime', 'salamander'],
  ['thunder', 'sheep', 'star'],
];

/** 그 섬에 나올 몬스터 하나 (대표가 조금 더 자주) */
export function islandMonster(island: number, r = Math.random()) {
  const list = ISLAND_MONSTERS[island] ?? ISLAND_MONSTERS[0];
  return list[r < 0.4 ? 0 : r < 0.7 ? 1 : 2];
}

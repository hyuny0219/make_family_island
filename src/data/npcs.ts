import { ABILITIES } from './abilities';
import { ISLANDS } from './islands';
import { ITEMS, type ItemId } from './items';
import { COMBOS } from './merge';
import { ISLAND_MONSTERS, MONSTERS } from './monsters';
import { RESIDENTS } from './village';
import { withJosa } from '../util/korean';

/**
 * 섬 주민 — 섬마다 네 명이 살면서 부탁(퀘스트)을 한다. 가족이 수첩 하나를 같이 쓴다.
 *  · 이장: 심부름 · 배달 · 요리 (· 집 꾸며 주기)
 *  · 지킴이: 몬스터 퇴치 · 보스 도전 (· 변신 시험)
 *  · 탐험가: 보물찾기 · 탐험 (· 수수께끼 보물 · 밤에만 나오는 것)
 *  · 낚시꾼: 낚시 · 배달 (· 퀴즈)
 * 한 사람이 부탁을 네 번 하고(차례로), 다 끝내면 날마다 작은 부탁을 하나씩 한다.
 * 괄호 안의 특별한 부탁은 섬마다 다르게 섞여 있다 (SPECIAL).
 */
export type NpcRole = 'chief' | 'guard' | 'explorer' | 'fisher';

export interface NpcDef {
  id: string;
  name: string;
  job: string;
  role: NpcRole;
  island: number;
  /** 그림 (동물 그림을 같이 쓴다: <look>_front). 전용 그림은 로드맵에 있다 */
  look: string;
  hello: string;
}

type Reward = [ItemId, number][];
interface Base {
  /** 수첩·대화창에 보이는 한 줄 제목 */
  title: string;
  /** 주민이 하는 말 */
  ask: string;
  reward: Reward;
}

export type NpcQuest = Base &
  (
    | { kind: 'fetch'; need: Partial<Record<ItemId, number>>; /** 받은 가구를 주민 곁에 놓아 둔다 (집 꾸며 주기) */ decor?: boolean }
    | { kind: 'deliver'; to: string; what: string }
    /** 세는 부탁: 퇴치·낚시·보스·변신 시험 (stat = 가족이 함께 세는 횟수의 이름) */
    | { kind: 'count'; stat: string; n: number; goal: string }
    | { kind: 'explore'; n: number }
    /** 보물찾기. riddle이면 지도에 표시하지 않고 힌트만 준다 (가까이 가면 반짝인다) */
    | { kind: 'dig'; what: string; riddle?: boolean }
    | { kind: 'quiz'; q: string; choices: string[]; answer: number }
    /** 밤에만 나오는 것 모으기 */
    | { kind: 'night'; n: number; thing: string; color: number }
  );

/** 그 섬의 친구(동물)와 겹치지 않게 다른 동물 그림 네 가지를 고른다 */
const SPECIES = RESIDENTS.map((r) => r.id);
const look = (island: number, k: number) => SPECIES[(island + [2, 4, 6, 8][k]) % SPECIES.length];

/** [이름, 직함, 인사] × (이장, 지킴이, 탐험가, 낚시꾼) — 섬 번호 순 */
const PEOPLE: [string, string, string][][] = [
  [
    ['모모', '곰돌이 섬 이장', '어서 와요! 이 섬은 작지만 할 일이 많답니다.'],
    ['단단', '숲 지킴이', '요즘 새싹이들이 말썽이야. 좀 도와줄래?'],
    ['루루', '꼬마 탐험가', '이 섬 어딘가에 보물이 묻혀 있대요!'],
    ['퐁당', '개울 낚시꾼', '물고기는 기다릴 줄 아는 곰한테 온단다.'],
  ],
  [
    ['라라', '꽃밭 이장', '꽃향기 맡으며 쉬었다 가요~'],
    ['붕붕', '꽃밭 지킴이', '벌들이 꽃밭을 차지해 버렸어!'],
    ['포포', '향기 탐험가', '밤이 되면 꽃밭에 불빛이 떠다녀요.'],
    ['찰랑', '연못 낚시꾼', '꽃잎이 떨어진 물에는 큰 놈이 살지.'],
  ],
  [
    ['솔이', '솔숲 이장', '솔바람 소리가 참 좋지요?'],
    ['도토', '솔숲 지킴이', '다람쥐들이 도토리를 몽땅 가져갔어!'],
    ['나무', '숲길 탐험가', '오래된 지도를 주웠는데, 글씨가 수수께끼예요.'],
    ['잔잔', '숲속 낚시꾼', '숲 그늘 물가가 명당이란다.'],
  ],
  [
    ['파랑', '바닷가 이장', '파도 소리 들으며 천천히 둘러봐요.'],
    ['집게', '모래밭 지킴이', '게들이 모래성을 다 부숴 놨지 뭐야!'],
    ['진주', '바다 탐험가', '해적이 남긴 쪽지를 찾았어요!'],
    ['너울', '바다 낚시꾼', '바다는 넓고 물고기는 많지!'],
  ],
  [
    ['바우', '바위 마을 이장', '단단한 바위처럼 든든한 마을이에요.'],
    ['쿵쿵', '동굴 지킴이', '동굴에서 박쥐 떼가 쏟아져 나와!'],
    ['반짝', '광석 탐험가', '밤이 되면 바위틈에서 빛이 새어 나와요.'],
    ['여울', '계곡 낚시꾼', '바위 밑에 숨은 녀석을 노려야 해.'],
  ],
  [
    ['송이', '버섯 마을 이장', '폭신폭신한 버섯 마을에 잘 왔어요!'],
    ['포자', '버섯 지킴이', '독버섯들이 길을 막고 있어!'],
    ['이끼', '숲속 탐험가', '밤에만 빛나는 버섯이 있대요.'],
    ['방울', '늪 낚시꾼', '늪 물고기는 느긋하게 낚아야지.'],
  ],
  [
    ['눈꽃', '눈마을 이장', '추운데 여기까지 오느라 고생했어요.'],
    ['얼음', '눈밭 지킴이', '심술 눈사람들이 길에 눈을 쌓아 놨어!'],
    ['서리', '얼음 탐험가', '눈 밑에 얼어붙은 상자가 있대요.'],
    ['꽁꽁', '얼음 낚시꾼', '얼음 구멍 앞에서는 조용히 해야 해.'],
  ],
  [
    ['모래', '오아시스 이장', '뜨거운 모래바람을 뚫고 왔군요!'],
    ['가시', '사막 지킴이', '선인장들이 걸어 다닌다니까!'],
    ['별이', '사막 탐험가', '모래에 반쯤 묻힌 옛 지도를 찾았어요.'],
    ['샘물', '오아시스 낚시꾼', '사막에도 물고기가 산단다. 신기하지?'],
  ],
  [
    ['불씨', '화산 마을 이장', '발밑이 뜨거우니 조심해요!'],
    ['재롱', '화산 지킴이', '불꽃 정령들이 마을에 불을 낼 뻔했어!'],
    ['용암', '불꽃 탐험가', '식은 용암 밑에 반짝이는 게 있어요.'],
    ['보글', '온천 낚시꾼', '따뜻한 물에 사는 물고기가 제일 맛있지.'],
  ],
  [
    ['구름', '하늘 마을 이장', '구름 위까지 올라오다니 대단해요!'],
    ['번쩍', '하늘 지킴이', '번개 구름이 자꾸 심술을 부려!'],
    ['무지', '하늘 탐험가', '밤하늘에서 별똥별이 떨어졌어요!'],
    ['둥실', '구름 낚시꾼', '구름 사이 물웅덩이에도 물고기가 있단다.'],
  ],
];

const ROLES: NpcRole[] = ['chief', 'guard', 'explorer', 'fisher'];

export const NPCS: NpcDef[] = PEOPLE.flatMap((row, island) =>
  row.map(([name, job, hello], k) => ({ id: `npc${island}_${k}`, name, job, role: ROLES[k], island, look: look(island, k), hello })),
);

export const npcsOn = (island: number) => NPCS.filter((n) => n.island === island);
export const npcById = (id: string) => NPCS.find((n) => n.id === id);

/**
 * 섬마다 섞여 있는 특별한 부탁.
 * decor 집 꾸며 주기 · form 변신 시험 · riddle 수수께끼 보물 · night 밤에만 나오는 것 · quiz 퀴즈
 * (힘 합치기 · 다리 놓기 · 씨앗 키우기 · 몬스터 달래기 · 길 안내 · 숨바꼭질은 다음에 넣는다)
 */
type Special = 'decor' | 'form' | 'riddle' | 'night' | 'quiz';
const SPECIAL: Special[][] = [
  ['quiz', 'decor'],
  ['night'],
  ['riddle', 'form'],
  ['riddle', 'quiz'],
  ['form', 'night'],
  ['night'],
  ['decor', 'quiz'],
  ['riddle', 'form'],
  ['form', 'decor'],
  ['night', 'quiz'],
];
export const hasSpecial = (island: number, s: Special) => SPECIAL[island]?.includes(s) ?? false;

/** 섬마다 흔한 재료 (심부름 1) */
const BASIC: ItemId[] = ['twig', 'flower', 'pinecone', 'shell', 'stone', 'mushroom', 'ice', 'cactus_fruit', 'coal', 'cotton'];
/** 섬마다 만들어서 가져다줄 것 */
const CRAFTED: ItemId[] = ['log', 'bouquet', 'log', 'juice', 'brick', 'juice', 'plank', 'brick', 'plank', 'bouquet'];
const PARCEL = ['도시락', '꽃 편지', '솔잎 차', '조개 목걸이', '튼튼한 곡괭이', '버섯 수프', '털목도리', '시원한 물통', '부채', '무지개 사탕'];
const LOOT = ['낡은 보물 상자', '씨앗 주머니', '오래된 나무 상자', '해적의 상자', '보석 자루', '버섯 모양 상자', '얼어붙은 상자', '모래에 묻힌 항아리', '그을린 금고', '별빛 상자'];
/** 밤에만 나오는 것: [이름, 빛깔] */
const NIGHT: Record<number, [string, number]> = { 1: ['반딧불이', 0xd8ff7a], 4: ['빛나는 광석', 0x8fe3ff], 5: ['빛나는 버섯', 0x9dffd0], 9: ['별똥별 조각', 0xfff3a0] };
/** 집 꾸며 주기에 가져다줄 가구 */
const DECOR: Record<number, Partial<Record<ItemId, number>>> = { 0: { chair: 1, lantern: 1 }, 6: { lantern: 2, table: 1 }, 8: { chair: 2, flowerpot: 1 } };

const drop = (mon: string): ItemId => MONSTERS[mon].drops[0][0];
/** 그 섬 몬스터가 떨어뜨리는 것으로 만드는 음식 (없으면 null) */
function islandFood(island: number): ItemId | null {
  const drops = ISLAND_MONSTERS[island].map(drop);
  return COMBOS.find((c) => drops.includes(c.a) || drops.includes(c.b))?.out ?? null;
}

/** 퇴치 부탁이 세는 이름 */
export const statMon = (mon: string) => `m_${mon}`;
export const statForm = (ability: string) => `ab_${ability}`;
export const statFish = (island: number) => `fish_${island}`;
export const statBoss = (island: number) => `boss_${island}`;

/** 그 섬에 대한 퀴즈 하나 (k번째) */
function quiz(island: number, k: number): { q: string; choices: string[]; answer: number } {
  const mons = ISLAND_MONSTERS[island];
  if (k % 2 === 0) {
    const m = mons[(island + k) % 3];
    const choices = mons.map((x) => ITEMS[drop(x)].name);
    return { q: `${withJosa(MONSTERS[m].name, '을', '를')} 잡으면 무엇을 떨어뜨릴까요?`, choices, answer: mons.indexOf(m) };
  }
  const others = [(island + 3) % 10, (island + 6) % 10];
  const list = [island, ...others].sort((a, b) => a - b);
  return { q: `${withJosa(MONSTERS[mons[0]].name, '이', '가')} 사는 섬은 어디일까요?`, choices: list.map((i) => `${ISLANDS[i].emoji} ${ISLANDS[i].name}`), answer: list.indexOf(island) };
}

/** 그 주민의 부탁 네 가지 (차례로) */
export function npcChain(n: NpcDef): NpcQuest[] {
  const i = n.island;
  const [m0, m1, m2] = ISLAND_MONSTERS[i];
  const [chief, , explorer] = npcsOn(i);
  const tier = Math.floor(i / 3); // 0~3: 뒤 섬일수록 조금 더 많이
  const food = islandFood(i);
  const ab = ABILITIES[i];
  const isle = ISLANDS[i].name;

  if (n.role === 'chief') {
    const last: NpcQuest = hasSpecial(i, 'decor')
      ? { kind: 'fetch', title: '집 꾸며 주기', ask: '우리 집 앞이 너무 허전해요. 가구를 만들어다 주면 여기에 예쁘게 놓을게요!', need: DECOR[i], decor: true, reward: [['crystal', 3], ['brick', 2]] }
      : { kind: 'fetch', title: '잔치 준비', ask: '마을 잔치를 열 거예요! 이것만 있으면 준비 끝이에요.', need: { [drop(m0)]: 5 + tier, [CRAFTED[i]]: 2 }, reward: [['crystal', 3], ['brick', 2]] };
    return [
      { kind: 'fetch', title: '심부름', ask: '마을 일을 하려면 재료가 필요해요. 조금만 가져다줄래요?', need: { [BASIC[i]]: 8 + tier * 2 }, reward: [['plank', 2]] },
      { kind: 'deliver', title: '배달', ask: `${explorer.name}에게 ${withJosa(PARCEL[i], '을', '를')} 전해 줄래요? 탐험하느라 밥도 잘 못 챙기거든요.`, to: explorer.id, what: PARCEL[i], reward: [['crystal', 1], ['coal', 2]] },
      food
        ? { kind: 'fetch', title: '요리', ask: `${withJosa(ITEMS[food].name, '이', '가')} 먹고 싶어요! 만들기에서 재료를 합쳐 만들어다 줄래요?`, need: { [food]: 2 }, reward: [['crystal', 2]] }
        : { kind: 'fetch', title: '심부름', ask: '이것도 좀 구해다 줄래요?', need: { [drop(m1)]: 4 + tier }, reward: [['crystal', 2]] },
      last,
    ];
  }

  if (n.role === 'guard') {
    const hunt = (mon: string, c: number, ask: string, reward: Reward): NpcQuest => ({ kind: 'count', title: '몬스터 퇴치', ask, stat: statMon(mon), n: c, goal: `${MONSTERS[mon].name} 잡기`, reward });
    const boss: NpcQuest = { kind: 'count', title: '보스 도전', ask: `${isle} 던전 깊은 곳에 대장이 있어. 가족이 힘을 합쳐 물리쳐 줘!`, stat: statBoss(i), n: 1, goal: '던전 보스 물리치기', reward: [['boss_token', 2], ['crystal', 2]] };
    if (hasSpecial(i, 'form')) {
      return [
        hunt(m0, 3 + tier, `${MONSTERS[m0].name} 때문에 마을 사람들이 무서워해. 혼내 줄래?`, [['coal', 2], ['plank', 1]]),
        hunt(m1, 4 + tier, `이번엔 ${withJosa(MONSTERS[m1].name, '이야', '야')}. 밭을 엉망으로 만들었어!`, [['crystal', 1], ['brick', 1]]),
        boss,
        { kind: 'count', title: '변신 시험', ask: `보스를 이기고 얻은 ${ab.emoji} ${ab.names[0]} 변신, 얼마나 센지 보여 줘! 그 모습으로 몬스터를 잡아 봐.`, stat: statForm(ab.id), n: 6 + tier, goal: `${ab.emoji} ${ab.names[0]} 변신으로 몬스터 잡기`, reward: [['boss_token', 1], ['crystal', 2]] },
      ];
    }
    return [
      hunt(m0, 3 + tier, `${MONSTERS[m0].name} 때문에 마을 사람들이 무서워해. 혼내 줄래?`, [['coal', 2], ['plank', 1]]),
      hunt(m1, 4 + tier, `이번엔 ${withJosa(MONSTERS[m1].name, '이야', '야')}. 밭을 엉망으로 만들었어!`, [['crystal', 1], ['brick', 1]]),
      hunt(m2, 5 + tier, `${MONSTERS[m2].name}만 쫓아내면 섬이 조용해질 거야!`, [['crystal', 2]]),
      boss,
    ];
  }

  if (n.role === 'explorer') {
    const night = NIGHT[i];
    const third: NpcQuest = hasSpecial(i, 'riddle')
      ? { kind: 'dig', title: '수수께끼 보물', ask: '이 지도에는 표시가 없고 글만 적혀 있어요. 잘 읽고 찾아 줄래요? 가까이 가면 땅이 반짝일 거예요!', what: `수수께끼의 ${LOOT[i]}`, riddle: true, reward: [['crystal', 2], ['pearl', 1]] }
      : hasSpecial(i, 'night') && night
        ? { kind: 'night', title: '밤에만 나오는 것', ask: `${withJosa(night[0], '은', '는')} 밤에만 보여요. 밤이 되면 섬을 돌아다니며 모아 줄래요?`, n: 5 + tier, thing: night[0], color: night[1], reward: [['crystal', 2], ['pearl', 1]] }
        : { kind: 'fetch', title: '표본 모으기', ask: '탐험 일지에 붙일 표본이 필요해요. 몬스터가 떨어뜨리는 걸 모아 줄래요?', need: { [drop(m1)]: 4 + tier, [drop(m2)]: 3 + tier }, reward: [['plank', 3], ['crystal', 1]] };
    return [
      { kind: 'dig', title: '보물찾기', ask: `지도에 ❌ 표시를 해 뒀어요. 거기를 파면 ${withJosa(LOOT[i], '이', '가')} 나올 거예요!`, what: LOOT[i], reward: [['pearl', 1], ['crystal', 1]] },
      { kind: 'explore', title: '탐험', ask: '안개 너머가 궁금해요. 새 지역을 열어서 길을 넓혀 줄래요?', n: 3, reward: [['plank', 3]] },
      third,
      { kind: 'dig', title: '큰 보물찾기', ask: `드디어 찾았어요! 이 섬에서 가장 큰 보물이에요. ❌ 표시한 곳을 파 봐요! ${chief.name} 이장님도 기뻐할 거예요.`, what: `커다란 ${LOOT[i]}`, reward: [['crystal', 3], ['pearl', 1]] },
    ];
  }

  // 낚시꾼
  const fish = (c: number, ask: string, reward: Reward): NpcQuest => ({ kind: 'count', title: '낚시', ask, stat: statFish(i), n: c, goal: `${isle}에서 낚시 성공하기`, reward });
  const qz = (k: number): NpcQuest => ({ kind: 'quiz', title: '퀴즈', ask: '낚시는 기다림이지. 기다리는 동안 문제 하나 낼게!', ...quiz(i, k), reward: [['crystal', 1], ['coal', 1]] });
  return [
    fish(3, '물가의 반짝이는 곳에서 낚시를 해 봐. 세 마리만 낚아 볼래?', [['fish', 2]]),
    hasSpecial(i, 'quiz') ? qz(0) : { kind: 'fetch', title: '심부름', ask: '미끼로 쓸 게 필요해. 좀 구해다 줄래?', need: { [drop(m0)]: 4 + tier }, reward: [['crystal', 1], ['coal', 1]] },
    { kind: 'deliver', title: '배달', ask: `갓 잡은 생선이야. ${chief.name} 이장님께 가져다드릴래?`, to: chief.id, what: '갓 잡은 생선', reward: [['crystal', 1], ['plank', 2]] },
    fish(6 + tier, '이제 진짜 낚시꾼이 다 됐구나! 이번엔 잔뜩 낚아 보자.', [['fish_big', 1], ['crystal', 2]]),
  ];
}

/** 부탁을 다 끝낸 뒤, 날마다 하나씩 하는 작은 부탁 */
export function npcDaily(n: NpcDef, day: string): NpcQuest {
  const mons = ISLAND_MONSTERS[n.island];
  const h = [...`${day}${n.id}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const mon = mons[h % 3];
  if (n.role === 'chief') return { kind: 'fetch', title: '오늘의 심부름', ask: '오늘도 와 줬군요! 이것 좀 구해다 줄래요?', need: { [drop(mon)]: 4 }, reward: [['crystal', 1]] };
  if (n.role === 'guard') return { kind: 'count', title: '오늘의 퇴치', ask: `오늘은 ${withJosa(MONSTERS[mon].name, '이', '가')} 또 나타났어. 부탁해!`, stat: statMon(mon), n: 5, goal: `${MONSTERS[mon].name} 잡기`, reward: [['coal', 2], ['crystal', 1]] };
  if (n.role === 'explorer') return { kind: 'dig', title: '오늘의 보물', ask: '새 보물 지도를 구했어요! ❌ 표시한 곳을 파 봐요.', what: '작은 보물 주머니', reward: [['crystal', 1], ['pearl', 1]] };
  if (hasSpecial(n.island, 'quiz') && h % 2 === 0) return { kind: 'quiz', title: '오늘의 퀴즈', ask: '오늘의 문제야!', ...quiz(n.island, h % 4), reward: [['crystal', 1]] };
  return { kind: 'count', title: '오늘의 낚시', ask: '오늘도 손맛 좀 볼까?', stat: statFish(n.island), n: 4, goal: `${ISLANDS[n.island].name}에서 낚시 성공하기`, reward: [['crystal', 1], ['fish', 1]] };
}

/** 섬 주민 네 명의 부탁(16개)을 모두 끝내면 받는 선물 */
export const islandHeroReward = (island: number): Reward => [
  ['trophy', 1],
  ['crystal', 4 + Math.floor(island / 2)],
];

export const CHAIN_LEN = 4;

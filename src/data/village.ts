import type { ItemId } from './items';

/** 섬에 놓을 수 있는 물건과 마을 점수 */
export const DECOR_POINTS: Partial<Record<ItemId, number>> = {
  fence: 2,
  chair: 3,
  wall: 3,
  lantern: 3,
  jelly_block: 2,
  jelly_lamp: 5,
  wreath: 3,
  flowerpot: 4,
  table: 4,
  bed: 5,
  sofa: 6,
  fountain: 8,
  arch: 8,
  trophy: 10,
};

export const isPlaceable = (id: ItemId) => id in DECOR_POINTS;

/** 지나갈 수 없는 장식 */
export const DECOR_BLOCKING: ReadonlySet<ItemId> = new Set<ItemId>(['wall', 'fence', 'fountain']);

export interface Resident {
  id: string;
  name: string;
  /** 사는 섬 (섬마다 한 마리) */
  island: number;
  /** 이사 오려면 필요한 마을 점수 */
  score: number;
  /** 친구가 되려면 가져다줄 것 */
  need: Partial<Record<ItemId, number>>;
  hello: string;
  /** 처음 만났을 때 하는 부탁 */
  ask: string;
}

/**
 * 섬 친구 — 섬마다 한 마리씩 산다. 찾아가서 부탁을 들어주고 마을 점수가 충분하면 우리 마을(캠프)로 이사 온다.
 * 순서 = 섬 번호.
 */
export const RESIDENTS: Resident[] = [
  { id: 'rabbit', name: '토토', island: 0, score: 4, need: { fruit: 8, flower: 5 }, hello: '깡충! 여기 정말 예쁜 섬이네요!', ask: '과일이랑 꽃을 좋아해요. 가져다주면 친구 할래요!' },
  { id: 'cat', name: '나비', island: 1, score: 8, need: { fish_small: 6, bouquet: 1 }, hello: '야옹~ 낮잠 자기 딱 좋은 곳이에요.', ask: '작은 물고기랑 꽃다발이 있으면 따라갈게요.' },
  { id: 'fox', name: '여울', island: 2, score: 12, need: { pinecone: 10, log: 3 }, hello: '소문 듣고 왔어요. 멋진 마을이네요!', ask: '겨울 준비 중이에요. 솔방울이랑 통나무가 필요해요.' },
  { id: 'turtle', name: '바다', island: 3, score: 16, need: { shell: 10, starfish: 3 }, hello: '느릿느릿… 그래도 왔어요!', ask: '조개랑 불가사리를 모으고 있어요. 도와줄래요?' },
  { id: 'mole', name: '두두', island: 4, score: 20, need: { stone: 15, coal: 3 }, hello: '땅 위는 눈이 부시네요!', ask: '굴을 고치려면 돌이랑 석탄이 필요해요.' },
  { id: 'frog', name: '연두', island: 5, score: 25, need: { jelly: 8, juice: 2 }, hello: '개굴! 폴짝 뛰어왔어요!', ask: '말랑말랑 젤리랑 주스가 먹고 싶어요.' },
  { id: 'penguin', name: '펭이', island: 6, score: 30, need: { fish: 5, fish_big: 1 }, hello: '뒤뚱뒤뚱… 먼 길 왔어요. 잘 부탁해요!', ask: '배가 고파요. 물고기를 잔뜩 먹고 싶어요!' },
  { id: 'camel', name: '사하', island: 7, score: 36, need: { brick: 4, juice: 3 }, hello: '모래바람을 뚫고 왔어요.', ask: '목이 말라요. 주스랑, 쉼터 지을 벽돌이 필요해요.' },
  { id: 'dragon', name: '루비', island: 8, score: 42, need: { coal: 8, crystal: 4 }, hello: '크앙! …무섭지 않죠?', ask: '반짝이는 보석이랑 따뜻한 석탄을 좋아해요.' },
  { id: 'sheep', name: '몽실', island: 9, score: 50, need: { bouquet: 3, jelly_lamp: 1 }, hello: '메에~ 구름 위에서 내려왔어요.', ask: '꽃다발이랑 밤을 밝힐 젤리 램프가 있으면 좋겠어요.' },
];

/** 주민 부탁에 나오는 물건 (호감도가 오르면 합친 물건도 부탁한다) */
export const ORDER_BASIC: ItemId[] = ['twig', 'fruit', 'stone', 'flower', 'pinecone', 'shell', 'fish_small', 'jelly'];
export const ORDER_CRAFTED: ItemId[] = ['log', 'brick', 'bouquet', 'juice', 'fish', 'wreath', 'jelly_block'];
/** 부탁을 들어주면 받는 선물 */
export const ORDER_GIFTS: ItemId[] = ['crystal', 'coal', 'fish_big', 'starfish', 'plank', 'pearl'];

/** 호감도가 이만큼 차면 황금 트로피를 선물한다 */
export const TROPHY_HEARTS = 5;

import type { ItemId } from './items';

/** 섬에 놓을 수 있는 물건과 마을 점수 */
export const DECOR_POINTS: Partial<Record<ItemId, number>> = {
  fence: 2,
  chair: 3,
  wall: 3,
  lantern: 3,
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
  /** 이사 오는 데 필요한 마을 점수 */
  score: number;
  hello: string;
}

/** 동물 주민 — 마을 점수가 오르면 차례로 이사 온다 */
export const RESIDENTS: Resident[] = [
  { id: 'rabbit', name: '토토', score: 6, hello: '깡충! 여기 정말 예쁜 섬이네요!' },
  { id: 'cat', name: '나비', score: 16, hello: '야옹~ 낮잠 자기 딱 좋은 곳이에요.' },
  { id: 'fox', name: '여울', score: 30, hello: '소문 듣고 왔어요. 멋진 마을이네요!' },
  { id: 'penguin', name: '펭이', score: 50, hello: '뒤뚱뒤뚱… 먼 길 왔어요. 잘 부탁해요!' },
];

/** 주민 부탁에 나오는 물건 (호감도가 오르면 합친 물건도 부탁한다) */
export const ORDER_BASIC: ItemId[] = ['twig', 'fruit', 'stone', 'flower', 'pinecone', 'shell', 'fish_small'];
export const ORDER_CRAFTED: ItemId[] = ['log', 'brick', 'bouquet', 'juice', 'fish', 'wreath'];
/** 부탁을 들어주면 받는 선물 */
export const ORDER_GIFTS: ItemId[] = ['crystal', 'coal', 'fish_big', 'starfish', 'plank', 'pearl'];

/** 호감도가 이만큼 차면 황금 트로피를 선물한다 */
export const TROPHY_HEARTS = 5;

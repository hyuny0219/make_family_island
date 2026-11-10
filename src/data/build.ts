import { itemKey, type ItemId } from './items';
import { DECOR_BLOCKING, DECOR_POINTS } from './village';

export type BuildCat = 'path' | 'house' | 'fence' | 'plaza' | 'nature' | 'furniture';

export const BUILD_CATS: { id: BuildCat; label: string }[] = [
  { id: 'path', label: '길' },
  { id: 'house', label: '집' },
  { id: 'fence', label: '울타리' },
  { id: 'plaza', label: '광장' },
  { id: 'nature', label: '자연' },
  { id: 'furniture', label: '가구' },
];

/** 섬에 지을 수 있는 것 하나 */
export interface Piece {
  id: string;
  name: string;
  cat: BuildCat;
  /** 차지하는 칸 (가로 × 세로). 기준 칸은 왼쪽 아래 */
  w: number;
  h: number;
  /** 지을 때 드는 재료 — 치우면 그대로 돌려받는다 */
  cost: Partial<Record<ItemId, number>>;
  /** 마을 점수 */
  points: number;
  /** 곰이 지나갈 수 없음 */
  block: boolean;
  /** 바닥(길): 다른 것 아래에 깔리고, 위에 물건을 놓을 수 있다 */
  floor?: boolean;
  tex: string;
  scale: number;
}

const P = (id: string, name: string, cat: BuildCat, w: number, h: number, cost: Piece['cost'], points: number, block: boolean, floor = false): Piece => ({
  id, name, cat, w, h, cost, points, block, floor, tex: `build_${id}`, scale: 1,
});

/** 머지로 만든 물건을 그대로 놓는 것 (재료 = 그 물건 1개) */
const I = (id: ItemId, name: string, cat: BuildCat): Piece => ({
  id, name, cat, w: 1, h: 1, cost: { [id]: 1 }, points: DECOR_POINTS[id] ?? 1, block: DECOR_BLOCKING.has(id), tex: itemKey(id), scale: 1.5,
});

export const PIECE_LIST: Piece[] = [
  // 길
  P('path_dirt', '흙길', 'path', 1, 1, { stone: 1 }, 0, false, true),
  P('path_stone', '돌길', 'path', 1, 1, { stone: 2 }, 0, false, true),
  P('path_wood', '나무 데크', 'path', 1, 1, { log: 1 }, 0, false, true),
  // 집·건물
  P('house_red', '빨간 지붕 집', 'house', 2, 2, { plank: 3, brick: 3 }, 8, true),
  P('house_blue', '파란 지붕 집', 'house', 2, 2, { plank: 3, brick: 3, shell: 5 }, 9, true),
  P('cabin', '통나무집', 'house', 2, 2, { log: 6, plank: 2 }, 8, true),
  P('stall', '과일 가게', 'house', 2, 1, { plank: 2, fruit: 6 }, 5, true),
  P('windmill', '풍차', 'house', 2, 2, { plank: 4, brick: 4, crystal: 1 }, 10, true),
  P('well', '우물', 'house', 1, 1, { brick: 2, stone: 6 }, 4, true),
  // 울타리
  I('fence', '나무 울타리', 'fence'),
  I('wall', '돌담', 'fence'),
  P('hedge', '생울타리', 'fence', 1, 1, { twig: 3, flower: 1 }, 1, true),
  P('gate', '장미 문', 'fence', 1, 1, { plank: 1, flower: 2 }, 3, false),
  I('arch', '아치', 'fence'),
  // 광장
  P('bench', '벤치', 'plaza', 1, 1, { log: 2 }, 2, true),
  P('lamp', '가로등', 'plaza', 1, 1, { stone: 3, coal: 1 }, 3, true),
  P('mailbox', '우체통', 'plaza', 1, 1, { plank: 1 }, 2, true),
  P('signpost', '이정표', 'plaza', 1, 1, { twig: 4 }, 1, true),
  P('statue', '곰 석상', 'plaza', 1, 1, { stone: 10, crystal: 1 }, 5, true),
  P('picnic', '파라솔 식탁', 'plaza', 1, 1, { plank: 2, fruit: 2 }, 4, true),
  P('swing', '그네', 'plaza', 2, 1, { log: 3, twig: 4 }, 5, true),
  I('fountain', '분수', 'plaza'),
  I('lantern', '랜턴', 'plaza'),
  I('trophy', '황금 트로피', 'plaza'),
  // 자연
  P('flowerbed', '꽃밭', 'nature', 1, 1, { flower: 4 }, 2, false),
  P('blossom', '벚나무', 'nature', 1, 1, { pinecone: 3, flower: 3 }, 3, true),
  P('pond', '연못', 'nature', 2, 2, { stone: 6, shell: 3 }, 4, true),
  I('flowerpot', '화분', 'nature'),
  I('wreath', '꽃 화환', 'nature'),
  // 가구
  I('chair', '의자', 'furniture'),
  I('table', '탁자', 'furniture'),
  I('bed', '침대', 'furniture'),
  I('sofa', '소파', 'furniture'),
  I('jelly_block', '젤리 블록', 'furniture'),
  I('jelly_lamp', '젤리 램프', 'furniture'),
];

export const PIECES: Record<string, Piece> = Object.fromEntries(PIECE_LIST.map((p) => [p.id, p]));

/** 새로 그린 건물·소품 텍스처 (머지 물건 아이콘을 쓰는 것은 제외) */
export const BUILD_TEXTURES = PIECE_LIST.filter((p) => p.tex.startsWith('build_')).map((p) => p.tex);

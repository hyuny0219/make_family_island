import { itemKey, type ItemId } from './items';
import { DECOR_BLOCKING, DECOR_POINTS } from './village';

export type BuildCat = 'path' | 'house' | 'fence' | 'plaza' | 'nature' | 'furniture' | 'deco';

/** inside: 집 안에서만 놓는 종류 (나머지는 섬에 놓는다) */
export const BUILD_CATS: { id: BuildCat; label: string; inside?: boolean }[] = [
  { id: 'path', label: '길' },
  { id: 'house', label: '집' },
  { id: 'fence', label: '울타리' },
  { id: 'plaza', label: '광장' },
  { id: 'nature', label: '자연' },
  { id: 'furniture', label: '가구', inside: true },
  { id: 'deco', label: '실내 장식', inside: true },
];

/** 들어가서 안을 꾸밀 수 있는 집 */
export const ENTERABLE = new Set(['house_red', 'house_blue', 'cabin', 'house_leaf', 'house_flower', 'house_tree', 'house_shell', 'house_rock', 'house_mushroom', 'house_igloo', 'house_tent', 'house_forge', 'house_cloud']);
/** 밤에 주변을 밝히는 것 (그 둘레에는 몬스터가 나타나지 않는다) */
export const LIGHTS = new Set(['torch', 'lamp', 'lantern', 'jelly_lamp']);
export const houseKey = (island: number, tx: number, ty: number) => `h${island}_${tx}_${ty}`;

/** 섬에 지을 수 있는 것 하나 */
export interface Piece {
  id: string;
  name: string;
  cat: BuildCat;
  /** 차지하는 칸 (가로 × 세로). 기준 칸은 왼쪽 아래 */
  w: number;
  h: number;
  /** 놓을 때 드는 것 (만들기에서 만든 그 물건 1개) — 치우면 그대로 돌려받는다 */
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

/** 섬에 놓는 건축물 — 작업대(만들기)에서 만든 것을 놓는다 (재료 = 그 건축물 1개) */
const P = (id: ItemId, name: string, cat: BuildCat, w: number, h: number, points: number, block: boolean, floor = false): Piece => ({
  id, name, cat, w, h, cost: { [id]: 1 }, points, block, floor, tex: `build_${id}`, scale: 1,
});

/** 작업대(만들기)에서 만든 가구를 놓는 것 (재료 = 그 가구 1개, 그림은 가구 그림) */
const F = (id: ItemId, name: string, cat: BuildCat, w: number, h: number, points: number, block: boolean, floor = false): Piece => ({
  id, name, cat, w, h, cost: { [id]: 1 }, points, block, floor, tex: `build_${id}`, scale: 1,
});

/** 머지로 만든 물건을 그대로 놓는 것 (재료 = 그 물건 1개) */
const I = (id: ItemId, name: string, cat: BuildCat): Piece => ({
  id, name, cat, w: 1, h: 1, cost: { [id]: 1 }, points: DECOR_POINTS[id] ?? 1, block: DECOR_BLOCKING.has(id), tex: itemKey(id), scale: 1.5,
});

export const PIECE_LIST: Piece[] = [
  // 길
  P('path_dirt', '흙길', 'path', 1, 1, 0, false, true),
  P('path_stone', '돌길', 'path', 1, 1, 0, false, true),
  P('path_wood', '나무 데크', 'path', 1, 1, 0, false, true),
  // 집·건물
  P('house_red', '빨간 지붕 집', 'house', 2, 2, 8, true),
  // 섬 특산 집 (섬 번호 순)
  P('house_leaf', '풀잎 오두막', 'house', 2, 2, 12, true),
  P('house_flower', '꽃 지붕 집', 'house', 2, 2, 12, true),
  P('house_tree', '그루터기 집', 'house', 2, 2, 12, true),
  P('house_shell', '소라 집', 'house', 2, 2, 12, true),
  P('house_rock', '바위 굴 집', 'house', 2, 2, 12, true),
  P('house_mushroom', '버섯 집', 'house', 2, 2, 12, true),
  P('house_igloo', '이글루', 'house', 2, 2, 12, true),
  P('house_tent', '사막 천막', 'house', 2, 2, 12, true),
  P('house_forge', '용암 대장간', 'house', 2, 2, 12, true),
  P('house_cloud', '구름 집', 'house', 2, 2, 12, true),
  P('house_blue', '파란 지붕 집', 'house', 2, 2, 9, true),
  P('cabin', '통나무집', 'house', 2, 2, 8, true),
  P('stall', '과일 가게', 'house', 2, 1, 5, true),
  P('windmill', '풍차', 'house', 2, 2, 10, true),
  P('well', '우물', 'house', 1, 1, 4, true),
  // 울타리
  I('fence', '나무 울타리', 'fence'),
  I('wall', '돌담', 'fence'),
  P('hedge', '생울타리', 'fence', 1, 1, 1, true),
  P('gate', '장미 문', 'fence', 1, 1, 3, false),
  I('arch', '아치', 'fence'),
  // 광장
  P('bench', '벤치', 'plaza', 1, 1, 2, true),
  P('lamp', '가로등', 'plaza', 1, 1, 3, true),
  P('mailbox', '우체통', 'plaza', 1, 1, 2, true),
  P('signpost', '이정표', 'plaza', 1, 1, 1, true),
  P('statue', '곰 석상', 'plaza', 1, 1, 5, true),
  P('picnic', '파라솔 식탁', 'plaza', 1, 1, 4, true),
  P('swing', '그네', 'plaza', 2, 1, 5, true),
  I('fountain', '분수', 'plaza'),
  I('lantern', '랜턴', 'plaza'),
  I('torch', '횃불', 'plaza'),
  I('trophy', '황금 트로피', 'plaza'),
  // 자연
  P('flowerbed', '꽃밭', 'nature', 1, 1, 2, false),
  P('blossom', '벚나무', 'nature', 1, 1, 3, true),
  P('pond', '연못', 'nature', 2, 2, 4, true),
  I('flowerpot', '화분', 'nature'),
  I('wreath', '꽃 화환', 'nature'),
  // 가구
  I('chair', '의자', 'furniture'),
  I('table', '탁자', 'furniture'),
  I('bed', '침대', 'furniture'),
  I('sofa', '소파', 'furniture'),
  // 섬 특산 가구 (섬 번호 순)
  F('herb_shelf', '약초 선반', 'furniture', 1, 1, 6, true),
  F('petal_sofa', '꽃잎 소파', 'furniture', 2, 1, 6, true),
  F('stump_table', '그루터기 찻상', 'furniture', 1, 1, 6, true),
  F('shell_bed', '조개 침대', 'furniture', 1, 1, 6, true),
  F('salt_lamp', '돌소금 등', 'furniture', 1, 1, 6, true),
  F('mushroom_table', '버섯 탁자', 'furniture', 1, 1, 6, true),
  F('ice_bed', '얼음 침대', 'furniture', 1, 1, 6, true),
  F('hourglass', '모래시계', 'furniture', 1, 1, 6, true),
  F('lava_stove', '용암 화덕', 'furniture', 1, 1, 6, true),
  F('cloud_bed', '구름 침대', 'furniture', 1, 1, 6, true),
  F('bookshelf', '책장', 'furniture', 1, 1, 4, true),
  F('wardrobe', '옷장', 'furniture', 1, 1, 4, true),
  F('stove', '부엌 화덕', 'furniture', 1, 1, 4, true),
  F('fireplace', '벽난로', 'furniture', 1, 1, 6, true),
  F('bathtub', '욕조', 'furniture', 2, 1, 5, true),
  F('piano', '피아노', 'furniture', 2, 1, 8, true),
  F('toybox', '장난감 상자', 'furniture', 1, 1, 3, true),
  // 부엌
  F('fridge', '냉장고', 'furniture', 1, 1, 6, true),
  F('sink', '싱크대', 'furniture', 1, 1, 4, true),
  F('dining', '식탁', 'furniture', 2, 1, 5, true),
  F('cupboard', '찬장', 'furniture', 1, 1, 4, true),
  F('oven', '오븐', 'furniture', 1, 1, 5, true),
  F('counter', '조리대', 'furniture', 1, 1, 3, true),
  // 거실·공부방
  F('desk', '책상', 'furniture', 1, 1, 4, true),
  F('tv', '텔레비전', 'furniture', 1, 1, 7, true),
  F('armchair', '안락의자', 'furniture', 1, 1, 3, true),
  F('dresser', '서랍장', 'furniture', 1, 1, 4, true),
  F('longsofa', '긴 소파', 'furniture', 2, 1, 6, true),
  F('teatable', '찻상', 'furniture', 1, 1, 3, true),
  // 욕실·가전
  F('washer', '세탁기', 'furniture', 1, 1, 6, true),
  F('washstand', '세면대', 'furniture', 1, 1, 4, true),
  F('toilet', '변기', 'furniture', 1, 1, 3, true),
  F('vanity', '화장대', 'furniture', 1, 1, 5, true),
  F('clock', '괘종시계', 'furniture', 1, 1, 7, true),
  F('aquarium', '어항', 'furniture', 1, 1, 6, true),
  // 실내 장식
  F('rug', '둥근 깔개', 'deco', 2, 2, 2, false, true),
  F('floorlamp', '스탠드', 'deco', 1, 1, 3, true),
  F('plant', '큰 화분', 'deco', 1, 1, 2, true),
  F('picture', '그림 액자', 'deco', 1, 1, 2, true),
  F('window', '창문', 'deco', 1, 1, 2, true),
  I('jelly_block', '젤리 블록', 'deco'),
  I('jelly_lamp', '젤리 램프', 'deco'),
];

export const PIECES: Record<string, Piece> = Object.fromEntries(PIECE_LIST.map((p) => [p.id, p]));

/** 새로 그린 건물·소품 텍스처 (머지 물건 아이콘을 쓰는 것은 제외) */
export const BUILD_TEXTURES = PIECE_LIST.filter((p) => p.tex.startsWith('build_')).map((p) => p.tex);


/** 집 안의 생김새: 칸 수, 문이 있는 칸(맨 아랫줄), 바닥이 없는 곳([x, y, w, h]) */
export interface RoomPlan {
  cols: number;
  rows: number;
  door: number;
  holes: [number, number, number, number][];
}

/** 집 종류마다 세 가지 생김새가 있고, 집이 놓인 자리에 따라 그중 하나로 정해진다 (가족 모두 같은 모양을 본다) */
const ROOM_PLANS: Record<string, RoomPlan[]> = {
  // 빨간 지붕 집: 아담한 방
  house_red: [
    { cols: 9, rows: 7, door: 4, holes: [] },
    { cols: 9, rows: 8, door: 4, holes: [[0, 0, 3, 2]] },
    { cols: 10, rows: 6, door: 5, holes: [] },
  ],
  // 파란 지붕 집: 옆으로 넓은 방
  house_blue: [
    { cols: 11, rows: 7, door: 5, holes: [] },
    { cols: 11, rows: 8, door: 3, holes: [[7, 0, 4, 3]] },
    { cols: 11, rows: 8, door: 5, holes: [[0, 0, 2, 2], [9, 0, 2, 2]] },
  ],
  // 통나무집: 안쪽으로 깊은 방
  cabin: [
    { cols: 7, rows: 9, door: 3, holes: [] },
    { cols: 8, rows: 9, door: 5, holes: [[0, 6, 3, 3]] },
    { cols: 8, rows: 9, door: 4, holes: [[5, 0, 3, 3]] },
  ],
};

/** 섬 특산 집의 방은 기본 집 셋 가운데 하나의 생김새를 빌린다 */
const ROOM_LIKE: Record<string, string> = { house_leaf: 'house_red', house_flower: 'house_blue', house_tree: 'cabin', house_shell: 'house_red', house_rock: 'cabin', house_mushroom: 'house_red', house_igloo: 'house_red', house_tent: 'house_blue', house_forge: 'cabin', house_cloud: 'house_blue' };

export function roomPlan(id: string, tx: number, ty: number): RoomPlan {
  const list = ROOM_PLANS[id] ?? ROOM_PLANS[ROOM_LIKE[id]] ?? ROOM_PLANS.house_red;
  return list[(tx * 7 + ty * 13) % list.length];
}

// ───────────────────────── 놓는 방향 ─────────────────────────

/** 옆·뒤 그림(build_<id>_s, build_<id>_b)이 있어서 네 방향으로 돌릴 수 있는 가구 */
export const ROTATABLE = new Set<string>([
  'bookshelf', 'fireplace', 'wardrobe', 'stove', 'bathtub', 'toybox', 'piano',
  'fridge', 'sink', 'dining', 'cupboard', 'oven', 'counter',
  'desk', 'tv', 'armchair', 'dresser', 'longsofa',
  'washer', 'washstand', 'toilet', 'vanity', 'clock', 'aquarium',
  'chair', 'bed',
  'herb_shelf', 'petal_sofa', 'stump_table', 'shell_bed', 'salt_lamp', 'mushroom_table', 'ice_bed', 'hourglass', 'lava_stove', 'cloud_bed',
]);
/** 돌린 가구 그림 (옆 _s · 뒤 _b) */
export const TURN_TEXTURES = () => [...ROTATABLE].flatMap((id) => [`${PIECES[id].tex}_s`, `${PIECES[id].tex}_b`]);

export interface Turn {
  f?: 1;
  r?: 1 | 2 | 3;
}

/** 방향에 따른 차지하는 칸과 그림 */
export function oriented(piece: Piece, t: Turn = {}) {
  const r = ROTATABLE.has(piece.id) ? (t.r ?? 0) : 0;
  const side = r === 1 || r === 3;
  return {
    w: side ? piece.h : piece.w,
    h: side ? piece.w : piece.h,
    tex: r === 0 ? piece.tex : `${piece.tex}_${side ? 's' : 'b'}`,
    // 옆 그림은 앞이 왼쪽을 본다 → 오른쪽(1)을 볼 때 뒤집는다
    flip: r === 0 ? !!t.f : r === 1,
  };
}

/** 한 번 더 돌린 방향 (돌린 그림이 없는 가구는 좌우로 뒤집는다) */
export function nextTurn(piece: Piece, t: Turn = {}): Turn {
  if (ROTATABLE.has(piece.id)) {
    const r = (((t.r ?? 0) + 1) % 4) as 0 | 1 | 2 | 3;
    return r ? { r } : {};
  }
  return t.f ? {} : { f: 1 };
}

/** 꾸미기 창의 '돌리기'를 누른 횟수 → 방향 */
export function turnOf(piece: Piece, n: number): Turn {
  let t: Turn = {};
  for (let i = 0; i < n % 4; i++) t = nextTurn(piece, t);
  return t;
}

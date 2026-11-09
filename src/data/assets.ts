/** public/assets/ 의 스프라이트 목록 (scripts/process_art.py 가 생성) */

export type BearId = 'dad' | 'mom' | 'kid' | 'baby';
export type Facing = 'front' | 'side' | 'back';

export const BEARS: { id: BearId; name: string }[] = [
  { id: 'dad', name: '아빠 곰' },
  { id: 'mom', name: '엄마 곰' },
  { id: 'kid', name: '첫째 곰' },
  { id: 'baby', name: '막내 곰' },
];

export const FACINGS: Facing[] = ['front', 'side', 'back'];

export const OBJECTS = [
  'fruit_tree',
  'pine_tree',
  'sapling',
  'stump',
  'rock',
  'boulder',
  'pebbles',
  'ore_rock',
  'tent',
  'campfire',
  'bush',
  'flowers',
  'sign',
  'chest',
  'dock',
  'boat',
  'boat_frame',
  'lighthouse',
  'crate',
  'boat_side',
  // 바닥에 떨어진 줍기용 (아이템 아이콘 텍스처를 그대로 사용)
  'shell_pick',
  'starfish_pick',
] as const;

/** 텍스처 키가 이름과 다른 오브젝트 */
export const OBJECT_TEXTURE: Partial<Record<ObjectKind, string>> = {
  shell_pick: 'item_shell',
  starfish_pick: 'item_starfish',
};

/** public/assets 에서 따로 불러오지 않는 오브젝트 */
export const NO_LOAD: ReadonlySet<string> = new Set(['shell_pick', 'starfish_pick']);

export type ObjectKind = (typeof OBJECTS)[number];

/** 지나갈 수 없는 오브젝트 */
export const BLOCKING: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'fruit_tree',
  'pine_tree',
  'stump',
  'rock',
  'boulder',
  'ore_rock',
  'tent',
  'campfire',
  'bush',
  'chest',
  'lighthouse',
]);

/** 타일셋 인덱스 (tiles.png 순서) */
export const TILE_IDX = {
  grass: [0, 1, 2, 3],
  sand: [4, 5, 6, 7],
  sea: 8,
  shallow: 9,
  deep: 10,
} as const;

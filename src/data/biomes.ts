import type { ObjectKind } from './assets';
import type { ItemId } from './items';

export type Biome = 'orchard' | 'forest' | 'rocky' | 'meadow' | 'beach';

export const BIOMES: Biome[] = ['orchard', 'forest', 'rocky', 'meadow', 'beach'];

/** 지역 분위기별 정보 */
export const BIOME_INFO: Record<
  Biome,
  {
    emoji: string;
    /** 이 지역에서 구할 수 있는 재료 (퀘스트 재료 후보) */
    items: ItemId[];
    /** 오브젝트 배치 가중치 */
    decor: [ObjectKind, number][];
    /** 풀밭 위 오브젝트 밀도 (0~1) */
    density: number;
    /** 낚시로 잡히는 것 [아이템, 가중치] */
    fish: [ItemId, number][];
    /** 지역 이름 조합 */
    names: [string[], string[]];
    /** 해금 안내 문구 */
    story: string[];
  }
> = {
  orchard: {
    emoji: '🍊',
    items: ['fruit', 'twig'],
    decor: [['fruit_tree', 8], ['bush', 2], ['flowers', 2], ['sapling', 2], ['rock', 1], ['stump', 1]],
    density: 0.16,
    fish: [['fish_small', 6], ['fish', 3], ['boot', 1]],
    names: [['사과', '귤', '복숭아', '달콤', '새콤', '꿀벌', '햇살'], ['과수원', '언덕', '동산', '마당', '오솔길']],
    story: ['과일 향기가 솔솔 나는 곳이에요.', '나무마다 열매가 주렁주렁 열렸대요.'],
  },
  forest: {
    emoji: '🌲',
    items: ['twig', 'pinecone'],
    decor: [['pine_tree', 10], ['fruit_tree', 1], ['bush', 3], ['stump', 2], ['sapling', 2], ['flowers', 1], ['rock', 1]],
    density: 0.28,
    fish: [['fish', 5], ['fish_big', 3], ['fish_small', 3], ['fish_gold', 0.3]],
    names: [['솔방울', '도토리', '다람쥐', '이끼', '안개', '부엉이', '고요한'], ['숲', '숲길', '골짜기', '나무숲', '오두막길']],
    story: ['키 큰 나무들이 바람에 사각사각 노래해요.', '숲 속 친구들이 기다리고 있대요.'],
  },
  rocky: {
    emoji: '⛰️',
    items: ['stone', 'coal'],
    decor: [['rock', 7], ['boulder', 3], ['ore_rock', 3], ['pebbles', 3], ['bush', 1], ['pine_tree', 1]],
    density: 0.2,
    fish: [['fish_big', 4], ['fish', 3], ['crab', 2], ['fish_gold', 0.4]],
    names: [['돌멩이', '반짝', '두더지', '바람', '회색', '메아리', '울퉁불퉁'], ['언덕', '바위터', '고개', '절벽', '광산']],
    story: ['반짝이는 돌이 숨어 있는 곳이에요.', '단단한 바위가 데굴데굴 굴러다녀요.'],
  },
  meadow: {
    emoji: '🌼',
    items: ['flower', 'twig'],
    decor: [['flowers', 9], ['bush', 3], ['sapling', 2], ['fruit_tree', 2], ['rock', 1]],
    density: 0.2,
    fish: [['fish_small', 5], ['fish', 4], ['boot', 1]],
    names: [['데이지', '민들레', '나비', '무지개', '클로버', '꽃향기', '산들'], ['꽃밭', '들판', '풀밭', '정원', '언덕']],
    story: ['알록달록 꽃들이 활짝 피었어요.', '나비들이 팔랑팔랑 날아다녀요.'],
  },
  beach: {
    emoji: '🏖️',
    items: ['shell', 'starfish', 'stone'],
    decor: [['shell_pick', 4], ['starfish_pick', 2], ['pebbles', 3], ['rock', 2], ['bush', 1]],
    density: 0.12,
    fish: [['fish_small', 4], ['fish', 3], ['crab', 3], ['shell', 1], ['boot', 1]],
    names: [['조개', '파도', '모래', '갈매기', '소라', '노을', '물결'], ['해변', '모래톱', '물가', '곶', '바닷가']],
    story: ['파도 소리가 철썩철썩 들려요.', '모래 속에 조개가 숨어 있대요.'],
  },
};

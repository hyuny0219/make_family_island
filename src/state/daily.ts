import type { ItemId } from '../data/items';

const KEY = 'mfi.v1.daily';

/** 7일 선물 — 하루 빠져도 처음으로 돌아가지 않고 이어서 받는다 */
export const DAILY_REWARDS: [ItemId, number][] = [
  ['twig', 5],
  ['stone', 5],
  ['fruit', 5],
  ['jelly', 3],
  ['log', 2],
  ['brick', 2],
  ['crystal', 2],
];

interface DailyState {
  /** 마지막으로 받은 날 (이 기기 시간, YYYY-MM-DD) */
  last: string;
  /** 지금까지 받은 횟수 */
  count: number;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function load(): DailyState {
  try {
    return { last: '', count: 0, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DailyState>) };
  } catch {
    return { last: '', count: 0 };
  }
}

/** 매일 선물 (기기마다 따로 — 가족 모두 각자 받는다) */
export const daily = {
  /** 오늘 선물을 아직 안 받았으면 true */
  get ready() {
    return load().last !== today();
  },
  /** 이번 7일 중 이미 받은 칸 수 (오늘 받을 칸의 번호이기도 하다) */
  get index() {
    const s = load();
    // 7개를 다 받은 날에는 꽉 찬 달력을 보여 주고, 다음 날 새 달력으로 넘어간다
    if (s.count > 0 && s.count % 7 === 0 && s.last === today()) return 7;
    return s.count % 7;
  },
  /** 오늘 선물 받기. 이미 받았으면 null */
  claim(): [ItemId, number] | null {
    const s = load();
    if (s.last === today()) return null;
    const reward = DAILY_REWARDS[s.count % 7];
    try {
      localStorage.setItem(KEY, JSON.stringify({ last: today(), count: s.count + 1 }));
    } catch {
      /* noop */
    }
    return reward;
  },
};

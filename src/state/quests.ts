import Phaser from 'phaser';
import type { ItemId } from '../data/items';
import { PIECES } from '../data/build';
import { ISLANDS } from '../data/islands';
import { progress } from './progress';
import { village } from './village';

const KEY = 'mfi.v1.quests';

/** 진행도를 재는 방법: 횟수(퀘스트를 받은 뒤부터 센다) 또는 현재 상태 */
type Goal = { count: string; n: number } | { state: () => number; n: number };

export interface QuestDef {
  id: string;
  text: string;
  goal: Goal;
  reward: [ItemId, number];
  /** 어디서 하는지 알려 주는 한 줄 */
  tip?: string;
}

const regionsOpened = () => ISLANDS.reduce((s, _v, i) => s + progress.unlockedCount(i) - 1, 0);
const builtIn = (cat: string) => ISLANDS.reduce((s, _v, i) => s + village.placedOn(i).filter((p) => PIECES[p.id]?.cat === cat).length, 0);

/** 모험 퀘스트 — 하나씩 차례로. 처음 하는 사람에게 게임을 안내한다 */
export const STORY: QuestDef[] = [
  { id: 's1', text: '나뭇가지 5개 줍기', goal: { count: 'gather:twig', n: 5 }, reward: ['twig', 5], tip: '나무를 톡톡 눌러요' },
  { id: 's2', text: '머지로 새 물건 만들기', goal: { count: 'merge', n: 1 }, reward: ['log', 2], tip: '머지 탭에서 같은 것 3개를 붙여요' },
  { id: 's3', text: '표지판 퀘스트로 새 지역 열기', goal: { state: regionsOpened, n: 1 }, reward: ['stone', 10], tip: '구름 앞 표지판을 눌러요' },
  { id: 's4', text: '낚시 3번 성공하기', goal: { count: 'fish', n: 3 }, reward: ['fish', 2], tip: '물가의 반짝이는 곳을 눌러요' },
  { id: 's5', text: '슬라임 3마리 잡기', goal: { count: 'slime', n: 3 }, reward: ['jelly', 3], tip: '캠프 밖 지역에 나타나요' },
  { id: 's6', text: '마을에 길 5칸 깔기', goal: { count: 'build', n: 5 }, reward: ['stone', 10], tip: '꾸미기 탭 → 길' },
  { id: 's7', text: '집 한 채 짓기', goal: { state: () => builtIn('house'), n: 1 }, reward: ['plank', 2], tip: '꾸미기 탭 → 집' },
  { id: 's8', text: '섬 친구를 마을로 초대하기', goal: { state: () => village.joined().length, n: 1 }, reward: ['bouquet', 1], tip: '❗ 말풍선을 띄운 동물을 찾아요' },
  { id: 's9', text: '주민 부탁 들어주기', goal: { count: 'order', n: 1 }, reward: ['fruit', 10], tip: '캠프의 주민을 눌러요' },
  { id: 's10', text: '지역 10곳 열기', goal: { state: regionsOpened, n: 10 }, reward: ['brick', 3] },
  { id: 's11', text: '마을 점수 30점 만들기', goal: { state: () => village.score(), n: 30 }, reward: ['crystal', 1], tip: '집과 광장을 지어요' },
  { id: 's12', text: '섬의 보물 찾기', goal: { state: () => progress.treasureCount, n: 1 }, reward: ['crystal', 2], tip: '지역을 모두 열면 상자가 열려요' },
  { id: 's13', text: '배 만들기', goal: { state: () => ISLANDS.filter((_v, i) => progress.hasBoat(i)).length, n: 1 }, reward: ['plank', 3], tip: '바닷가 선착장으로 가요' },
  { id: 's14', text: '두 번째 섬에서 지역 5곳 열기', goal: { state: () => progress.unlockedCount(1) - 1, n: 5 }, reward: ['crystal', 2] },
  { id: 's15', text: '섬 친구 3마리와 함께 살기', goal: { state: () => village.joined().length, n: 3 }, reward: ['trophy', 1] },
  { id: 's16', text: '마을 점수 100점 만들기', goal: { state: () => village.score(), n: 100 }, reward: ['crystal', 3] },
  { id: 's17', text: '보물 3개 모으기', goal: { state: () => progress.treasureCount, n: 3 }, reward: ['crystal', 3] },
  { id: 's18', text: '섬 친구 10마리 모두 모으기', goal: { state: () => village.joined().length, n: 10 }, reward: ['trophy', 2] },
  { id: 's19', text: '보물 10개 모두 모으기', goal: { state: () => progress.treasureCount, n: 10 }, reward: ['trophy', 3] },
];

/** 오늘의 퀘스트 후보 — 날마다 3개 (가족 모두 같은 3개) */
export const DAILY_POOL: QuestDef[] = [
  { id: 'd_twig', text: '나뭇가지 15개 줍기', goal: { count: 'gather:twig', n: 15 }, reward: ['plank', 1] },
  { id: 'd_stone', text: '돌 15개 캐기', goal: { count: 'gather:stone', n: 15 }, reward: ['brick', 1] },
  { id: 'd_fruit', text: '과일 12개 따기', goal: { count: 'gather:fruit', n: 12 }, reward: ['juice', 1] },
  { id: 'd_any', text: '재료 40개 모으기', goal: { count: 'gather', n: 40 }, reward: ['crystal', 1] },
  { id: 'd_fish', text: '낚시 5번 성공하기', goal: { count: 'fish', n: 5 }, reward: ['fish_big', 1] },
  { id: 'd_slime', text: '슬라임 6마리 잡기', goal: { count: 'slime', n: 6 }, reward: ['jelly_block', 1] },
  { id: 'd_merge', text: '머지 10번 하기', goal: { count: 'merge', n: 10 }, reward: ['coal', 2] },
  { id: 'd_build', text: '마을에 5개 짓기', goal: { count: 'build', n: 5 }, reward: ['flower', 6] },
];
export const DAILY_BONUS: [ItemId, number] = ['crystal', 2];

interface Saved {
  /** 평생 횟수 */
  stats: Record<string, number>;
  /** 모험 퀘스트 번호와, 그 퀘스트를 받았을 때의 횟수 */
  story: number;
  storyBase: Record<string, number>;
  /** 오늘의 퀘스트 */
  day: string;
  daily: { id: string; base: number; claimed: boolean }[];
  bonus: boolean;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function load(): Saved {
  const empty: Saved = { stats: {}, story: 0, storyBase: {}, day: '', daily: [], bonus: false };
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>) };
  } catch {
    return empty;
  }
}

export interface QuestView {
  def: QuestDef;
  have: number;
  need: number;
  done: boolean;
  claimed: boolean;
}

/**
 * 퀘스트 수첩 (기기마다 따로 — 가족 모두 각자 깨고, 보상은 공유 창고로).
 * 이벤트: 'changed'
 */
class Quests extends Phaser.Events.EventEmitter {
  private d = load();

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.d));
    } catch {
      /* noop */
    }
  }

  /** 무언가를 했다 (예: bump('fish'), bump('gather:twig')) */
  bump(key: string, n = 1) {
    this.d.stats[key] = (this.d.stats[key] ?? 0) + n;
    this.save();
    this.emit('changed');
  }

  private stat(key: string) {
    return this.d.stats[key] ?? 0;
  }

  private rollDaily() {
    const t = today();
    if (this.d.day === t && this.d.daily.length) return;
    // 날짜로 섞어서 3개 고른다 (같은 날에는 누구나 같은 3개)
    let seed = [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pool = [...DAILY_POOL];
    const pick: QuestDef[] = [];
    while (pick.length < 3) pick.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    this.d.day = t;
    this.d.daily = pick.map((q) => ({ id: q.id, base: 'count' in q.goal ? this.stat(q.goal.count) : 0, claimed: false }));
    this.d.bonus = false;
    this.save();
  }

  private view(def: QuestDef, base: number, claimed: boolean): QuestView {
    const raw = 'count' in def.goal ? this.stat(def.goal.count) - base : def.goal.state();
    const have = Math.max(0, Math.min(raw, def.goal.n));
    return { def, have, need: def.goal.n, done: have >= def.goal.n, claimed };
  }

  /** 지금 하는 모험 퀘스트 (다 끝냈으면 null) */
  story(): QuestView | null {
    const def = STORY[this.d.story];
    if (!def) return null;
    return this.view(def, 'count' in def.goal ? (this.d.storyBase[def.goal.count] ?? 0) : 0, false);
  }

  get storyIndex() {
    return this.d.story;
  }

  daily(): QuestView[] {
    this.rollDaily();
    return this.d.daily.flatMap((s) => {
      const def = DAILY_POOL.find((q) => q.id === s.id);
      return def ? [this.view(def, s.base, s.claimed)] : [];
    });
  }

  /** 오늘의 퀘스트 3개를 모두 받았으면 보너스를 받을 수 있다 */
  bonusState(): 'locked' | 'ready' | 'claimed' {
    if (this.d.bonus) return 'claimed';
    const all = this.daily();
    return all.length > 0 && all.every((q) => q.claimed) ? 'ready' : 'locked';
  }

  /** 받을 보상이 있는가 (빨간 점) */
  get claimable() {
    return !!this.story()?.done || this.daily().some((q) => q.done && !q.claimed) || this.bonusState() === 'ready';
  }

  claimStory(): [ItemId, number] | null {
    const q = this.story();
    if (!q?.done) return null;
    this.d.story += 1;
    this.d.storyBase = { ...this.d.stats };
    this.save();
    this.emit('changed');
    return q.def.reward;
  }

  claimDaily(id: string): [ItemId, number] | null {
    const q = this.daily().find((v) => v.def.id === id);
    const s = this.d.daily.find((v) => v.id === id);
    if (!q || !s || !q.done || s.claimed) return null;
    s.claimed = true;
    this.save();
    this.emit('changed');
    return q.def.reward;
  }

  claimBonus(): [ItemId, number] | null {
    if (this.bonusState() !== 'ready') return null;
    this.d.bonus = true;
    this.save();
    this.emit('changed');
    return DAILY_BONUS;
  }
}

export const quests = new Quests();

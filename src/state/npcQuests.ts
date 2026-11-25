import Phaser from 'phaser';
import type { ItemId } from '../data/items';
import { CHAIN_LEN, NPCS, islandHeroReward, npcById, npcChain, npcDaily, npcsOn, type NpcQuest } from '../data/npcs';
import { family } from '../sync/family';
import { inventory } from './inventory';
import { progress } from './progress';
import { quests } from './quests';

const KEY = 'mfi.v1.npcq';

/** 주민 한 명의 부탁 상태 (가족 문서에도 이 모양 그대로 올린다 — 이름을 짧게) */
export interface NpcEntry {
  /** 끝낸 부탁 수 (CHAIN_LEN이면 차례 부탁은 모두 끝) */
  s: number;
  /** 지금 부탁을 받은 상태인가 */
  on: boolean;
  /** 세는 부탁·탐험: 받았을 때의 수 */
  b: number;
  /** 탐험: 채워야 하는 수 (남은 지역이 모자라면 줄어든다) */
  n?: number;
  /** 밤에만 나오는 것: 모은 수 */
  h?: number;
  /** 보물찾기: 파낼 자리 (섬 장면이 정해 준다) */
  x?: number;
  y?: number;
  /** 보물찾기: 파냈는가 */
  d?: boolean;
  /** 오늘의 부탁을 끝낸 날 */
  day?: string;
}

interface Saved {
  npc: Record<string, NpcEntry>;
  /** 가족이 함께 세는 횟수 (몬스터·낚시·보스·변신) */
  stats: Record<string, number>;
  /** 섬 영웅 선물을 받은 섬 */
  hero: number[];
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function load(): Saved {
  const empty: Saved = { npc: {}, stats: {}, hero: [] };
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>) };
  } catch {
    return empty;
  }
}

/** new: 새 부탁이 있다 · active: 하는 중 · ready: 다 해서 돌아가면 된다 · rest: 오늘은 부탁이 없다 */
export type NpcStatus = 'new' | 'active' | 'ready' | 'rest';

/**
 * 섬 주민의 부탁. 가족이 수첩 하나를 같이 쓴다:
 * 누가 받아도 모두에게 보이고, 잡은 수·낚은 수는 합쳐서 세고, 한 명이 끝내면 모두 끝난다 (보상은 공유 창고로).
 * 이 기기에 먼저 저장하고 같은 변경을 가족 문서(nq · nqs · nqh)로 보낸다.
 * 이벤트: 'changed'
 */
class NpcQuests extends Phaser.Events.EventEmitter {
  private d = load();

  private store() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.d));
    } catch {
      /* noop */
    }
  }

  private entry(id: string): NpcEntry {
    return (this.d.npc[id] ??= { s: 0, on: false, b: 0 });
  }

  /** 주민 한 명의 상태가 바뀌었다: 저장하고 가족에게 알린다 */
  private commit(id: string) {
    this.store();
    family.set(`nq.${id}`, { ...this.entry(id) });
    this.emit('changed');
  }

  /** 가족이 함께 세는 횟수 (예: m_sprout, fish_0) */
  stat(key: string) {
    return this.d.stats[key] ?? 0;
  }

  bump(key: string, n = 1) {
    this.d.stats[key] = this.stat(key) + n;
    this.store();
    family.inc(`nqs.${key}`, n);
    this.emit('changed');
  }

  /** 지금 이 주민이 하는(할) 부탁. 오늘 부탁까지 끝냈으면 null */
  quest(id: string): NpcQuest | null {
    const n = npcById(id);
    if (!n) return null;
    const e = this.entry(id);
    if (e.s < CHAIN_LEN) return npcChain(n)[e.s];
    return e.day === today() ? null : npcDaily(n, today());
  }

  /** 끝낸 차례 부탁 수 (0 ~ CHAIN_LEN) */
  step(id: string) {
    return Math.min(CHAIN_LEN, this.entry(id).s);
  }

  /** 집 꾸며 주기를 끝냈는가 (주민 곁에 가구를 놓아 보여 준다) */
  decorDone(id: string): Partial<Record<ItemId, number>> | null {
    const n = npcById(id);
    if (!n) return null;
    const chain = npcChain(n);
    const k = chain.findIndex((q) => q.kind === 'fetch' && q.decor);
    const q = chain[k];
    return k >= 0 && this.entry(id).s > k && q.kind === 'fetch' ? q.need : null;
  }

  progress(id: string): { have: number; need: number } {
    const q = this.quest(id);
    const n = npcById(id);
    const e = this.entry(id);
    if (!q || !n || !e.on) return { have: 0, need: 1 };
    const cap = (have: number, need: number) => ({ have: Math.max(0, Math.min(need, have)), need });
    if (q.kind === 'count') return cap(this.stat(q.stat) - e.b, q.n);
    if (q.kind === 'explore') return cap(progress.unlockedCount(n.island) - e.b, e.n ?? q.n);
    if (q.kind === 'night') return cap(e.h ?? 0, q.n);
    if (q.kind === 'dig') return cap(e.d ? 1 : 0, 1);
    if (q.kind === 'fetch') {
      const list = Object.entries(q.need) as [ItemId, number][];
      return cap(list.filter(([it, c]) => inventory.get(it) >= c).length, list.length);
    }
    return { have: 0, need: 1 };
  }

  status(id: string): NpcStatus {
    const q = this.quest(id);
    if (!q) return 'rest';
    if (!this.entry(id).on) return 'new';
    if (q.kind === 'deliver' || q.kind === 'quiz') return 'active'; // 배달은 받는 사람에게, 퀴즈는 대화창에서 끝낸다
    const p = this.progress(id);
    return p.have >= p.need ? 'ready' : 'active';
  }

  /** remaining = 탐험 부탁에서 아직 열 수 있는 지역 수 (섬 장면이 알려 준다) */
  accept(id: string, remaining = 99) {
    const q = this.quest(id);
    const n = npcById(id);
    const e = this.entry(id);
    if (!q || !n || e.on) return;
    e.on = true;
    e.d = false;
    e.h = 0;
    delete e.x;
    delete e.y;
    delete e.n;
    e.b = q.kind === 'count' ? this.stat(q.stat) : q.kind === 'explore' ? progress.unlockedCount(n.island) : 0;
    if (q.kind === 'explore') e.n = Math.max(0, Math.min(q.n, remaining));
    this.commit(id);
  }

  /** 보물찾기: 아직 파내지 않은 자리 (자리가 안 정해졌으면 spot 없이) */
  digging(id: string): { tx?: number; ty?: number; riddle: boolean; what: string } | null {
    const q = this.quest(id);
    const e = this.entry(id);
    if (q?.kind !== 'dig' || !e.on || e.d) return null;
    return { tx: e.x, ty: e.y, riddle: !!q.riddle, what: q.what };
  }

  setSpot(id: string, tx: number, ty: number) {
    const e = this.entry(id);
    e.x = tx;
    e.y = ty;
    this.commit(id);
  }

  setDug(id: string) {
    this.entry(id).d = true;
    this.commit(id);
  }

  /** 밤에만 나오는 것을 하나 모았다 */
  collectNight(id: string) {
    const e = this.entry(id);
    e.h = (e.h ?? 0) + 1;
    this.commit(id);
  }

  /** 밤에만 나오는 것을 모으는 중인 부탁 */
  nightQuest(id: string) {
    const q = this.quest(id);
    const e = this.entry(id);
    if (q?.kind !== 'night' || !e.on) return null;
    return { thing: q.thing, color: q.color, left: Math.max(0, q.n - (e.h ?? 0)) };
  }

  /** 이 주민에게 전해 줄 배달을 맡긴 주민들 */
  deliveriesTo(id: string): string[] {
    return NPCS.filter((n) => {
      const q = this.quest(n.id);
      return q?.kind === 'deliver' && q.to === id && this.entry(n.id).on;
    }).map((n) => n.id);
  }

  /**
   * 부탁을 끝낸다 (배달은 받는 사람 앞에서, 퀴즈는 정답을 골랐을 때 부른다). 보상을 창고에 넣고 돌려준다.
   * 섬의 차례 부탁을 모두 끝냈으면 hero에 섬 영웅 선물이 담긴다.
   */
  complete(id: string): { reward: [ItemId, number][]; hero?: [ItemId, number][] } | null {
    const n = npcById(id);
    const q = this.quest(id);
    const e = this.entry(id);
    if (!n || !q || !e.on) return null;
    if (q.kind !== 'deliver' && q.kind !== 'quiz' && this.status(id) !== 'ready') return null;
    if (q.kind === 'fetch') for (const [it, c] of Object.entries(q.need) as [ItemId, number][]) inventory.add(it, -c);
    e.on = false;
    e.d = false;
    e.h = 0;
    delete e.x;
    delete e.y;
    delete e.n;
    if (e.s < CHAIN_LEN) e.s += 1;
    else e.day = today();
    for (const [it, c] of q.reward) inventory.add(it, c);
    let hero: [ItemId, number][] | undefined;
    if (this.islandDone(n.island) >= this.islandTotal(n.island) && !this.d.hero.includes(n.island)) {
      this.d.hero.push(n.island);
      family.union('nqh', n.island);
      hero = islandHeroReward(n.island);
      for (const [it, c] of hero) inventory.add(it, c);
    }
    quests.bump('npc');
    this.commit(id);
    return { reward: q.reward, hero };
  }

  /** 그 섬에서 끝낸 차례 부탁 수 */
  islandDone(island: number) {
    return npcsOn(island).reduce((s, n) => s + this.step(n.id), 0);
  }

  islandTotal(island: number) {
    return npcsOn(island).length * CHAIN_LEN;
  }

  /** 돌아가서 끝낼 수 있는 부탁이 있는가 (빨간 점) */
  anyReady(island: number) {
    return npcsOn(island).some((n) => this.status(n.id) === 'ready');
  }

  exportDoc() {
    return { nq: { ...this.d.npc }, nqs: { ...this.d.stats }, nqh: [...this.d.hero] };
  }

  /** 가족 섬의 최신 상태로 맞추기. 달라졌으면 'changed' */
  applyRemote(r: { nq?: Record<string, NpcEntry>; nqs?: Record<string, number>; nqh?: number[] }) {
    // 이 기능이 생기기 전에 만든 가족 섬에는 칸이 없다 → 이 기기의 기록을 지우지 않고 올려 둔다
    if (!r.nq && !r.nqs && !r.nqh) {
      if (Object.keys(this.d.npc).length || Object.keys(this.d.stats).length) {
        // (칸 전체가 아니라 하나씩 올린다: 같은 묶음에 'nq'와 'nq.주민'이 함께 들어가면 올리기가 실패한다)
        for (const [id, e] of Object.entries(this.d.npc)) family.set(`nq.${id}`, { ...e });
        for (const [k, v] of Object.entries(this.d.stats)) family.set(`nqs.${k}`, v);
        for (const i of this.d.hero) family.union('nqh', i);
      }
      return;
    }
    const next: Saved = { npc: { ...(r.nq ?? {}) }, stats: { ...(r.nqs ?? {}) }, hero: [...(r.nqh ?? [])] };
    if (JSON.stringify(next) === JSON.stringify(this.d)) return;
    this.d = next;
    this.store();
    this.emit('changed');
  }
}

export const npcQuests = new NpcQuests();

import Phaser from 'phaser';
import { ITEMS, type ItemId } from '../data/items';
import { ORDER_BASIC, ORDER_CRAFTED, RESIDENTS } from '../data/village';
import { PIECES } from '../data/build';
import { family } from '../sync/family';
import { withJosa } from '../util/korean';

const KEY = 'mfi.v1.village';

export interface Placed {
  /** data/build.ts 의 Piece id */
  id: string;
  /** 기준 칸 (왼쪽 아래) */
  tx: number;
  ty: number;
  /** 좌우 뒤집기 */
  f?: 1;
}

const wire = (p: Placed): Placed => (p.f ? { id: p.id, tx: p.tx, ty: p.ty, f: 1 } : { id: p.id, tx: p.tx, ty: p.ty });

export interface Order {
  item: ItemId;
  n: number;
}

interface Saved {
  /** 섬별로 놓인 장식 */
  placed: Record<number, Placed[]>;
  /** 이사 온 주민 */
  joined: string[];
  hearts: Record<string, number>;
  orders: Record<string, Order>;
  /** 다음 부탁이 생기는 시각 (ms) */
  nextAt: Record<string, number>;
}

/**
 * 마을 상태: 장식, 마을 점수, 주민, 부탁. 이 기기에 저장 (M5에서 가족 공유).
 * 이벤트: 'changed', 'resident-joined'(id)
 */
class Village extends Phaser.Events.EventEmitter {
  private d: Saved = { placed: {}, joined: [], hearts: {}, orders: {}, nextAt: {} };

  constructor() {
    super();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.d = { ...this.d, ...(JSON.parse(raw) as Saved) };
    } catch {
      /* noop */
    }
  }

  placedOn(island: number): readonly Placed[] {
    return this.d.placed[island] ?? [];
  }

  /** 모든 섬에 놓인 장식 점수의 합 */
  score() {
    let s = 0;
    for (const list of Object.values(this.d.placed)) for (const p of list) s += PIECES[p.id]?.points ?? 0;
    return s;
  }

  place(island: number, p: Placed) {
    (this.d.placed[island] ??= []).push(p);
    family.union(`placed.${island}`, wire(p));
    this.afterChange();
  }

  remove(island: number, tx: number, ty: number, id: string) {
    const list = this.d.placed[island] ?? [];
    const i = list.findIndex((p) => p.tx === tx && p.ty === ty && p.id === id);
    if (i < 0) return null;
    const [p] = list.splice(i, 1);
    family.remove(`placed.${island}`, wire(p));
    this.afterChange();
    return p;
  }

  private afterChange() {
    this.save();
    this.emit('changed');
  }

  isJoined(id: string) {
    return this.d.joined.includes(id);
  }

  /** 섬 친구가 우리 마을로 이사 온다 (한 번 온 친구는 떠나지 않는다) */
  join(id: string) {
    const r = RESIDENTS.find((v) => v.id === id);
    if (!r || this.isJoined(id)) return;
    this.d.joined.push(id);
    family.union('joined', id);
    family.post(`🏠 ${withJosa(r.name, '이', '가')} 우리 마을로 이사 왔어요`);
    this.save();
    this.emit('changed');
    this.emit('resident-joined', id);
  }

  joined() {
    return RESIDENTS.filter((r) => this.d.joined.includes(r.id));
  }


  hearts(id: string) {
    return this.d.hearts[id] ?? 0;
  }

  /** 지금 부탁 (쉬는 중이면 null). 없으면 새로 만든다 */
  order(id: string): Order | null {
    if (Date.now() < (this.d.nextAt[id] ?? 0)) return null;
    if (!this.d.orders[id]) {
      const h = this.hearts(id);
      const crafted = h >= 2 && Math.random() < 0.5;
      const pool = (crafted ? ORDER_CRAFTED : ORDER_BASIC).filter((it) => it in ITEMS);
      const item = pool[Math.floor(Math.random() * pool.length)];
      const n = crafted ? 1 + Math.floor(h / 4) : 3 + Math.floor(Math.random() * 3) + Math.floor(h / 2);
      this.d.orders[id] = { item, n };
      this.save();
      family.set(`orders.${id}`, { item, n });
    }
    return this.d.orders[id];
  }

  /** 부탁이 다시 생길 때까지 남은 초 */
  waitSec(id: string) {
    return Math.max(0, Math.ceil(((this.d.nextAt[id] ?? 0) - Date.now()) / 1000));
  }

  /** 부탁 완료 → 호감도 +1, 잠깐 쉬었다가 다음 부탁. 새 호감도를 돌려준다 */
  completeOrder(id: string) {
    delete this.d.orders[id];
    this.d.hearts[id] = this.hearts(id) + 1;
    this.d.nextAt[id] = Date.now() + 60_000;
    family.del(`orders.${id}`);
    family.inc(`hearts.${id}`, 1);
    family.set(`nextAt.${id}`, this.d.nextAt[id]);
    this.save();
    this.emit('changed');
    return this.d.hearts[id];
  }

  /** 선물을 줘서 호감도를 올린다 */
  gift(id: string, n: number) {
    this.d.hearts[id] = this.hearts(id) + n;
    family.inc(`hearts.${id}`, n);
    this.save();
    this.emit('changed');
    return this.d.hearts[id];
  }

  exportDoc() {
    const placed: Record<string, Placed[]> = {};
    for (const [k, v] of Object.entries(this.d.placed)) placed[k] = v.map(wire);
    return { placed, joined: [...this.d.joined], hearts: { ...this.d.hearts }, orders: { ...this.d.orders }, nextAt: { ...this.d.nextAt } };
  }

  /** 가족 섬의 최신 상태로 맞추기. 달라졌으면 'changed'·'remote', 새 주민은 'resident-joined' */
  applyRemote(r: { placed?: Record<string, Placed[]>; joined?: string[]; hearts?: Record<string, number>; orders?: Record<string, Order>; nextAt?: Record<string, number> }) {
    const placed: Record<number, Placed[]> = {};
    for (const [k, v] of Object.entries(r.placed ?? {})) placed[Number(k)] = v.filter((p) => p.id in PIECES).map(wire);
    const next: Saved = { placed, joined: [...(r.joined ?? [])], hearts: { ...(r.hearts ?? {}) }, orders: { ...(r.orders ?? {}) }, nextAt: { ...(r.nextAt ?? {}) } };
    if (JSON.stringify(next) === JSON.stringify(this.d)) return;
    const before = new Set(this.d.joined);
    this.d = next;
    this.save();
    this.emit('changed');
    this.emit('remote');
    next.joined.filter((id) => !before.has(id)).forEach((id) => this.emit('resident-joined', id));
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.d));
    } catch {
      /* noop */
    }
  }
}

export const village = new Village();

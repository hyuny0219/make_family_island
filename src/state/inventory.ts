import Phaser from 'phaser';
import { ITEMS, type ItemId } from '../data/items';
import { family } from '../sync/family';

const KEY = 'mfi.v1.inventory';

interface Saved {
  counts: Partial<Record<ItemId, number>>;
  /** 처음 얻은 순서 (가방 바 표시 순서) */
  order: ItemId[];
}

/**
 * 공용 창고. 지금은 이 기기(localStorage)에만 저장하고, M5에서 Firebase로 가족과 공유한다.
 * 변경 시 'changed' 이벤트(id, 새 개수, 증감)를 낸다.
 */
class Inventory extends Phaser.Events.EventEmitter {
  private counts: Partial<Record<ItemId, number>> = {};
  private order: ItemId[] = [];

  constructor() {
    super();
    this.load();
  }

  get(id: ItemId) {
    return this.counts[id] ?? 0;
  }

  /** 개수가 1 이상인 아이템 (처음 얻은 순서) */
  owned(): { id: ItemId; count: number }[] {
    return this.order.filter((id) => this.get(id) > 0).map((id) => ({ id, count: this.get(id) }));
  }

  /** 한 번이라도 얻거나 만든 적이 있는지 (도감) */
  discovered(id: ItemId) {
    return this.order.includes(id);
  }

  /** 창고에 넣지 않고 발견만 기록 (머지 보드에서 처음 만든 것). 처음이면 true */
  discover(id: ItemId) {
    if (!(id in ITEMS) || this.order.includes(id)) return false;
    this.order.push(id);
    this.save();
    family.union('order', id);
    return true;
  }

  add(id: ItemId, n = 1) {
    if (!(id in ITEMS) || n === 0) return;
    const next = Math.max(0, this.get(id) + n);
    this.counts[id] = next;
    if (n > 0 && !this.order.includes(id)) {
      this.order.push(id);
      family.union('order', id);
    }
    family.inc(`inv.${id}`, n);
    this.save();
    this.emit('changed', id, next, n);
  }

  /** 가족 섬에 올릴 지금 상태 */
  exportDoc() {
    return { inv: { ...this.counts } as Record<string, number>, order: [...this.order] as string[] };
  }

  /** 가족 섬의 최신 상태로 맞추기 */
  applyRemote(inv: Record<string, number>, order: string[]) {
    const counts: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(inv ?? {})) if (k in ITEMS) counts[k as ItemId] = Math.max(0, v);
    const ord = (order ?? []).filter((id) => id in ITEMS) as ItemId[];
    if (JSON.stringify([counts, ord]) === JSON.stringify([this.counts, this.order])) return;
    this.counts = counts;
    this.order = ord;
    this.save();
    this.emit('changed');
  }

  /** 개발·테스트용 */
  reset() {
    this.counts = {};
    this.order = [];
    this.save();
    this.emit('changed');
  }

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Saved;
      this.counts = data.counts ?? {};
      this.order = (data.order ?? []).filter((id) => id in ITEMS);
    } catch {
      /* 저장소를 못 쓰는 환경이면 메모리로만 동작 */
    }
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ counts: this.counts, order: this.order } satisfies Saved));
    } catch {
      /* noop */
    }
  }
}

export const inventory = new Inventory();

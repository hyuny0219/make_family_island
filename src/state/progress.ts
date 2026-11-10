import Phaser from 'phaser';
import { ISLANDS } from '../data/islands';
import { family } from '../sync/family';

const KEY = 'mfi.v2.progress';

interface Saved {
  current: number;
  /** 섬별로 열린 지역 번호 */
  unlocked: Record<number, number[]>;
  /** 배를 만든 섬 (그 섬에서 다음 섬으로 갈 수 있음) */
  boats: number[];
  /** 보물을 찾은 섬 */
  treasures: number[];
}

/**
 * 섬·지역 진행 상황. 지금은 이 기기에만 저장하고 M5에서 가족 공유.
 * 이벤트: 'region-unlocked'(island, region), 'boat-built'(island), 'treasure'(island)
 */
class Progress extends Phaser.Events.EventEmitter {
  private data: Saved = { current: 0, unlocked: {}, boats: [], treasures: [] };

  constructor() {
    super();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...(JSON.parse(raw) as Saved) };
    } catch {
      /* noop */
    }
  }

  get current() {
    return this.data.current;
  }

  setCurrent(i: number) {
    this.data.current = Math.max(0, Math.min(ISLANDS.length - 1, i));
    this.save();
  }

  isUnlocked(island: number, region: number) {
    return region === 0 || (this.data.unlocked[island]?.includes(region) ?? false);
  }

  unlockedCount(island: number) {
    return 1 + (this.data.unlocked[island]?.length ?? 0);
  }

  unlock(island: number, region: number) {
    if (this.isUnlocked(island, region)) return;
    (this.data.unlocked[island] ??= []).push(region);
    this.save();
    family.union(`unlocked.${island}`, region);
    this.emit('region-unlocked', island, region);
  }

  hasBoat(island: number) {
    return this.data.boats.includes(island);
  }

  buildBoat(island: number) {
    if (this.hasBoat(island)) return;
    this.data.boats.push(island);
    this.save();
    family.union('boats', island);
    this.emit('boat-built', island);
  }

  hasTreasure(island: number) {
    return this.data.treasures.includes(island);
  }

  get treasureCount() {
    return this.data.treasures.length;
  }

  findTreasure(island: number) {
    if (this.hasTreasure(island)) return;
    this.data.treasures.push(island);
    this.save();
    family.union('treasures', island);
    this.emit('treasure', island);
  }

  /** 갈 수 있는 섬: 0번 + 배를 만든 섬의 다음 섬들 */
  canVisit(island: number) {
    return island === 0 || this.hasBoat(island - 1);
  }

  exportDoc() {
    const unlocked: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(this.data.unlocked)) unlocked[k] = [...v];
    return { unlocked, boats: [...this.data.boats], treasures: [...this.data.treasures] };
  }

  /** 가족 섬의 최신 상태로 맞추기. 달라졌으면 'remote' 이벤트 */
  applyRemote(unlocked: Record<string, number[]>, boats: number[], treasures?: number[]) {
    const u: Record<number, number[]> = {};
    for (const [k, v] of Object.entries(unlocked ?? {})) u[Number(k)] = [...v];
    const b = [...(boats ?? [])];
    const t = [...(treasures ?? [])];
    if (JSON.stringify([u, b, t]) === JSON.stringify([this.data.unlocked, this.data.boats, this.data.treasures])) return;
    this.data.treasures = t;
    this.data.unlocked = u;
    this.data.boats = b;
    // 지금 있는 섬에 더는 갈 수 없게 됐다면(다른 가족 섬에 들어감) 첫 섬으로
    if (!this.canVisit(this.data.current)) this.data.current = 0;
    this.save();
    this.emit('remote');
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* noop */
    }
  }
}

export const progress = new Progress();

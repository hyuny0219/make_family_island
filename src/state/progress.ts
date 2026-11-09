import Phaser from 'phaser';
import { ISLANDS } from '../data/islands';

const KEY = 'mfi.v2.progress';

interface Saved {
  current: number;
  /** 섬별로 열린 지역 번호 */
  unlocked: Record<number, number[]>;
  /** 배를 만든 섬 (그 섬에서 다음 섬으로 갈 수 있음) */
  boats: number[];
}

/**
 * 섬·지역 진행 상황. 지금은 이 기기에만 저장하고 M5에서 가족 공유.
 * 이벤트: 'region-unlocked'(island, region), 'boat-built'(island)
 */
class Progress extends Phaser.Events.EventEmitter {
  private data: Saved = { current: 0, unlocked: {}, boats: [] };

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
    this.emit('region-unlocked', island, region);
  }

  hasBoat(island: number) {
    return this.data.boats.includes(island);
  }

  buildBoat(island: number) {
    if (this.hasBoat(island)) return;
    this.data.boats.push(island);
    this.save();
    this.emit('boat-built', island);
  }

  /** 갈 수 있는 섬: 0번 + 배를 만든 섬의 다음 섬들 */
  canVisit(island: number) {
    return island === 0 || this.hasBoat(island - 1);
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

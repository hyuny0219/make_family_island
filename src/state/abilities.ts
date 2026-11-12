import Phaser from 'phaser';
import { ABILITIES } from '../data/abilities';

const KEY = 'mfi.v1.abilities';

interface Saved {
  /** 능력 id → 단계(1~3) */
  lv: Record<string, number>;
  /** 지금 변신 중인 능력 */
  on: string | null;
}

function load(): Saved {
  try {
    return { lv: {}, on: null, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>) };
  } catch {
    return { lv: {}, on: null };
  }
}

/**
 * 변신 능력 (기기마다 따로 — 가족 각자 보스를 잡아 모은다).
 * 이벤트: 'changed'
 */
class Abilities extends Phaser.Events.EventEmitter {
  private d = load();

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.d));
    } catch {
      /* noop */
    }
    this.emit('changed');
  }

  level(id: string) {
    return this.d.lv[id] ?? 0;
  }

  get equipped() {
    return this.d.on && this.level(this.d.on) > 0 ? this.d.on : null;
  }

  /** 지금 변신 중인 능력이 id이면 그 단계의 숫자, 아니면 0 */
  power(id: string) {
    if (this.equipped !== id) return 0;
    const a = ABILITIES.find((v) => v.id === id);
    return a ? a.n[this.level(id) - 1] : 0;
  }

  /** 보스를 처음 잡아 능력을 얻는다. 새로 얻었으면 true */
  unlock(id: string) {
    if (this.level(id) > 0) return false;
    this.d.lv[id] = 1;
    if (!this.d.on) this.d.on = id;
    this.save();
    return true;
  }

  equip(id: string | null) {
    this.d.on = id;
    this.save();
  }

  upgrade(id: string) {
    const lv = this.level(id);
    if (lv < 1 || lv >= 3) return false;
    this.d.lv[id] = lv + 1;
    this.save();
    return true;
  }
}

export const abilities = new Abilities();

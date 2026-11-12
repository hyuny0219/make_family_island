import Phaser from 'phaser';
import { FOODS, type BuffId } from '../data/food';
import type { ItemId } from '../data/items';

const KEY = 'mfi.v1.player';
export const MAX_HP = 100;

interface Saved {
  hp: number;
  /** 효과가 끝나는 시각 (ms) */
  buffs: Partial<Record<BuffId, number>>;
}

function load(): Saved {
  try {
    return { hp: MAX_HP, buffs: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>) };
  } catch {
    return { hp: MAX_HP, buffs: {} };
  }
}

/**
 * 내 곰의 체력과 음식 효과 (기기마다 따로).
 * 이벤트: 'changed', 'hurt'(amount), 'faint'
 */
class Player extends Phaser.Events.EventEmitter {
  private d = load();

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.d));
    } catch {
      /* noop */
    }
  }

  get hp() {
    return this.d.hp;
  }

  has(b: BuffId) {
    return (this.d.buffs[b] ?? 0) > Date.now();
  }

  /** 지금 걸려 있는 효과와 남은 시간(초) */
  active(): [BuffId, number][] {
    const now = Date.now();
    return (Object.entries(this.d.buffs) as [BuffId, number][]).filter(([, t]) => t > now).map(([k, t]) => [k, Math.ceil((t - now) / 1000)]);
  }

  addBuff(b: BuffId, sec: number) {
    this.d.buffs[b] = Math.max(this.d.buffs[b] ?? 0, Date.now() + sec * 1000);
    this.save();
    this.emit('changed');
  }

  heal(n: number) {
    if (this.d.hp >= MAX_HP) return;
    this.d.hp = Math.min(MAX_HP, this.d.hp + n);
    this.save();
    this.emit('changed');
  }

  /** 맞았다. 튼튼 효과가 있으면 반만 닳는다. 0이 되면 'faint' */
  hurt(n: number) {
    const dmg = Math.max(1, Math.round(this.has('shield') ? n / 2 : n));
    this.d.hp = Math.max(0, this.d.hp - dmg);
    this.save();
    this.emit('hurt', dmg);
    this.emit('changed');
    if (this.d.hp <= 0) this.emit('faint');
    return dmg;
  }

  /** 기절했다가 깨어남 / 잠자고 일어남 */
  restore(hp: number) {
    this.d.hp = Math.min(MAX_HP, Math.max(1, hp));
    this.save();
    this.emit('changed');
  }

  /** 음식을 먹는다. 먹을 수 없는 것이면 false */
  eat(id: ItemId) {
    const f = FOODS[id];
    if (!f) return false;
    this.d.hp = Math.min(MAX_HP, this.d.hp + f.heal);
    for (const b of f.buffs ?? []) this.d.buffs[b] = Math.max(this.d.buffs[b] ?? 0, Date.now() + (f.sec ?? 60) * 1000);
    this.save();
    this.emit('changed');
    return true;
  }
}

export const player = new Player();

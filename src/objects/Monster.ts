import Phaser from 'phaser';
import type { MonsterDef } from '../data/monsters';

type Walkable = (x: number, y: number) => boolean;

/**
 * 몬스터 — 곰이 가까이 오면 쫓아와서 때린다 (도깨비는 도망만 다닌다).
 * 멀리 달아나면 포기하고 제자리로 돌아간다.
 */
export class Monster {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private mark?: Phaser.GameObjects.Text;
  /** 독: 남은 시간(초)과 초당 피해 */
  poisonT = 0;
  poisonDps = 0;
  poisonAcc = 0;
  readonly def: MonsterDef;
  x: number;
  y: number;
  hp: number;
  dead = false;
  /** 태어난 뒤 지난 시간(초) */
  age = 0;
  private readonly home: { x: number; y: number };
  private cooldown = 0.6;
  private stun = 0;
  private wander: { x: number; y: number } | null = null;
  private wait = 1;
  private chasing = false;
  private bob = Math.random() * 6;

  constructor(scene: Phaser.Scene, def: MonsterDef, x: number, y: number) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.hp = def.hp;
    this.home = { x, y };
    this.sprite = scene.add.image(x, y, def.tex ?? `mon_${def.id}`).setOrigin(0.5, 1).setScale(0);
    // 먼저 덤비는 몬스터는 머리 위에 빨간 표시가 있다
    if (def.aggressive && !def.boss) this.mark = scene.add.text(x, y, '💢', { fontSize: '9px' }).setOrigin(0.5);
    this.sprite.setInteractive({ useHandCursor: true });
    (this.sprite as unknown as { monster: Monster }).monster = this;
    this.bar = scene.add.graphics().setVisible(false);
    scene.tweens.add({ targets: this.sprite, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private move(dx: number, dy: number, walkable: Walkable) {
    if (walkable(this.x + dx, this.y + dy)) {
      this.x += dx;
      this.y += dy;
    } else if (walkable(this.x + dx, this.y)) this.x += dx;
    else if (walkable(this.x, this.y + dy)) this.y += dy;
    if (Math.abs(dx) > 0.05) this.sprite.setFlipX(dx < 0);
  }

  /** 한 프레임 움직인다. 곰을 때렸으면 true */
  update(dt: number, px: number, py: number, walkable: Walkable, canSee: boolean): boolean {
    if (this.dead) return false;
    this.age += dt;
    this.bob += dt * (this.chasing ? 11 : 6);
    this.cooldown -= dt;
    let hitPlayer = false;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.stun > 0) {
      this.stun -= dt;
    } else if (this.def.shy) {
      // 도깨비: 가까이 오면 반대쪽으로 달아난다
      this.chasing = canSee && dist < 120;
      if (this.chasing) this.move((-dx / dist) * this.def.speed * dt, (-dy / dist) * this.def.speed * dt, walkable);
      else this.stroll(dt, walkable);
    } else {
      if (!this.chasing && this.def.aggressive && canSee && dist < (this.def.sight ?? (this.def.boss ? 400 : 105))) this.chasing = true;
      if (this.chasing && !this.def.boss && !this.def.sight && (!canSee || dist > 200)) this.chasing = false;
      if (this.chasing) {
        if (dist > 15) this.move((dx / dist) * this.def.speed * dt, (dy / dist) * this.def.speed * dt, walkable);
        if (dist < (this.def.boss ? 30 : 20) && this.cooldown <= 0) {
          this.cooldown = 1.3;
          hitPlayer = true;
          // 덥석! 앞으로 살짝 튀어나온다
          this.sprite.scene.tweens.add({ targets: this.sprite, scaleX: 1.25, scaleY: 0.8, duration: 80, yoyo: true });
        }
      } else {
        this.stroll(dt, walkable);
      }
    }
    const lift = Math.abs(Math.sin(this.bob)) * (this.chasing ? 5 : 3);
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - lift)).setDepth(this.y);
    this.mark?.setPosition(this.sprite.x, this.sprite.y - this.sprite.height - 4).setDepth(this.y + 1).setVisible(!this.chasing || Math.sin(this.bob) > 0);
    if (this.bar.visible) this.drawBar();
    return hitPlayer;
  }

  private stroll(dt: number, walkable: Walkable) {
    if (this.wander) {
      const dx = this.wander.x - this.x;
      const dy = this.wander.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) this.wander = null;
      else this.move((dx / d) * this.def.speed * 0.4 * dt, (dy / d) * this.def.speed * 0.4 * dt, walkable);
      return;
    }
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = 1 + Math.random() * 2.5;
    const a = Math.random() * Math.PI * 2;
    const x = this.home.x + Math.cos(a) * 40 * Math.random();
    const y = this.home.y + Math.sin(a) * 40 * Math.random();
    if (walkable(x, y)) this.wander = { x, y };
  }

  private drawBar() {
    const w = this.def.boss ? 46 : 22;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - this.sprite.height - 9);
    this.bar.clear().setDepth(99950);
    this.bar.fillStyle(0x4a3b2a, 0.8).fillRoundedRect(x - 1, y - 1, w + 2, 6, 2);
    this.bar.fillStyle(0xe8604c).fillRect(x, y, Math.max(0, (w * this.hp) / this.def.hp), 4);
  }

  /** 얼리기 */
  freeze(sec: number, tint = 0x9fd8ff) {
    this.stun = Math.max(this.stun, sec);
    this.sprite.setTint(tint);
    this.sprite.scene.time.delayedCall(sec * 1000, () => !this.dead && this.sprite.clearTint());
  }

  /** 맞았다: 깜빡이고 뒤로 밀려난다 */
  hit(dmg: number, fromX: number, fromY: number, walkable: Walkable) {
    const scene = this.sprite.scene;
    this.hp -= dmg;
    this.stun = Math.max(this.stun, this.def.boss ? 0.12 : 0.35);
    this.chasing = !this.def.shy;
    this.sprite.setTintFill(0xffffff);
    scene.time.delayedCall(80, () => !this.dead && this.sprite.clearTint());
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    if (!this.def.boss) for (let i = 0; i < 4; i++) this.move(Math.cos(a) * 5, Math.sin(a) * 5, walkable);
    this.bar.setVisible(true);
    this.drawBar();
  }

  pop() {
    this.dead = true;
    this.bar.destroy();
    this.mark?.destroy();
    this.sprite.disableInteractive();
    const s = this.sprite;
    s.scene.tweens.add({ targets: s, scaleX: 1.5, scaleY: 0, alpha: 0, duration: 200, ease: 'Cubic.easeIn', onComplete: () => s.destroy() });
  }

  destroy() {
    this.dead = true;
    this.bar.destroy();
    this.mark?.destroy();
    this.sprite.destroy();
  }
}

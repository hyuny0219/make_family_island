import Phaser from 'phaser';
import type { BearId, Facing } from '../data/assets';

/**
 * 곰 캐릭터 (플레이어/가족 NPC 공용).
 * 논리 위치(x, y)는 발 위치이고, 스프라이트는 통통 튀는 연출만큼 위로 그려진다.
 */
export class Bear {
  readonly id: BearId;
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  target: { x: number; y: number } | null = null;
  facing: Facing = 'front';
  speed: number;

  private walkT = 0;
  private hop = 0;
  private hopV = 0;

  constructor(scene: Phaser.Scene, id: BearId, x: number, y: number, speed: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.sprite = scene.add.image(x, y, `${id}_front`).setOrigin(0.5, 1);
    this.sprite.setInteractive({ useHandCursor: true });
    (this.sprite as unknown as { bear: Bear }).bear = this;
  }

  get moving() {
    return this.target !== null;
  }

  face(dir: Facing, left = false) {
    this.facing = dir;
    this.sprite.setTexture(`${this.id}_${dir}`);
    this.sprite.setFlipX(dir === 'side' && left);
  }

  /** 제자리 점프 (터치 반응) */
  jump(power = 120) {
    if (this.hop > 0.5) return;
    this.hopV = power;
  }

  /**
   * 한 프레임 이동. walkable 판정으로 막히면 축별로 미끄러지고, 완전히 막히면 멈춘다.
   * @returns 이번 프레임에 목적지에 도착했으면 true
   */
  step(dt: number, walkable: (x: number, y: number) => boolean): boolean {
    let arrived = false;
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      const s = this.speed * dt;
      if (dist <= s) {
        this.target = null;
        arrived = true;
      } else {
        const nx = this.x + (dx / dist) * s;
        const ny = this.y + (dy / dist) * s;
        if (walkable(nx, ny)) {
          this.x = nx;
          this.y = ny;
        } else if (walkable(nx, this.y)) this.x = nx;
        else if (walkable(this.x, ny)) this.y = ny;
        else {
          this.target = null;
          arrived = true;
        }
        // 방향 스프라이트
        if (Math.abs(dx) > Math.abs(dy) * 0.8) this.face('side', dx < 0);
        else this.face(dy < 0 ? 'back' : 'front');
        this.walkT += dt;
      }
    }

    // 점프 물리
    if (this.hop > 0 || this.hopV > 0) {
      this.hopV -= 900 * dt;
      this.hop = Math.max(0, this.hop + this.hopV * dt);
      if (this.hop === 0) this.hopV = 0;
    }

    // 걷기: 통통 + 찌그러짐 / 정지: 숨쉬기
    let sx = 1;
    let sy = 1;
    let bob = 0;
    if (this.target) {
      const w = Math.sin(this.walkT * 16);
      bob = Math.abs(w) * 2.5;
      sx = 1 + w * 0.05;
      sy = 1 - w * 0.05;
    } else {
      const b = Math.sin(performance.now() / 420 + this.x) * 0.025;
      sx = 1 + b;
      sy = 1 - b;
      this.walkT = 0;
    }
    this.sprite.setScale(sx, sy);
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - bob - this.hop));
    this.sprite.setDepth(this.y);
    return arrived;
  }
}

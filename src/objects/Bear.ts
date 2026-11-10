import Phaser from 'phaser';
import type { Facing } from '../data/assets';

/**
 * 곰 캐릭터 (플레이어/가족 NPC 공용).
 * 논리 위치(x, y)는 발 위치이고, 스프라이트는 통통 튀는 연출만큼 위로 그려진다.
 */
export class Bear {
  /** 가족 곰이면 BearId, 주민이면 주민 id (텍스처 이름 앞부분) */
  readonly id: string;
  /** 동물 주민이면 true */
  resident = false;
  /** 아직 친구가 되지 않은 섬 친구 (자기 지역에 서 있다) */
  wild = false;
  /** 다른 가족이 조종하는 곰이면 그 기기 id */
  remote: string | null = null;
  /** 머리 위 이름표 (다른 가족 곰) */
  label?: Phaser.GameObjects.Text;
  /** 머리 위 말풍선 */
  private bubble?: Phaser.GameObjects.Container;
  /** 마지막으로 보여 준 말풍선 시각 (같은 걸 두 번 띄우지 않게) */
  emoteAt = 0;
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  target: { x: number; y: number } | null = null;
  facing: Facing = 'front';
  speed: number;

  private walkT = 0;
  private hop = 0;
  private hopV = 0;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, speed: number) {
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
        const ox = this.x;
        const oy = this.y;
        if (walkable(nx, ny)) {
          this.x = nx;
          this.y = ny;
        } else if (walkable(nx, this.y)) this.x = nx;
        else if (walkable(this.x, ny)) this.y = ny;
        // 벽에 막혀 거의 못 움직였으면 거기서 멈춘다 (제자리 걸음 방지)
        if (Math.hypot(this.x - ox, this.y - oy) < s * 0.25) {
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
    this.label?.setPosition(this.sprite.x, this.sprite.y - this.sprite.height - 3).setDepth(this.y + 1);
    this.bubble?.setPosition(this.sprite.x, this.sprite.y - this.sprite.height - (this.label ? 14 : 4)).setDepth(99984);
    return arrived;
  }

  /** 머리 위에 이모지 말풍선을 잠깐 띄운다 */
  emote(emoji: string) {
    const scene = this.sprite.scene;
    this.bubble?.destroy();
    const g = scene.add.graphics();
    g.fillStyle(0x4a3b2a, 0.25).fillRoundedRect(-13, -25, 26, 24, 9);
    g.fillStyle(0xffffff).fillRoundedRect(-13, -27, 26, 24, 9);
    g.fillTriangle(-4, -4, 4, -4, 0, 2);
    const t = scene.add.text(0, -15, emoji, { fontSize: '14px' }).setOrigin(0.5);
    const c = scene.add.container(this.sprite.x, this.sprite.y - this.sprite.height, [g, t]).setScale(0);
    this.bubble = c;
    scene.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    scene.tweens.add({
      targets: c, scale: 0, delay: 2600, duration: 180,
      onComplete: () => {
        c.destroy();
        if (this.bubble === c) this.bubble = undefined;
      },
    });
    this.jump(100);
  }

  destroy() {
    this.bubble?.destroy();
    this.label?.destroy();
    this.sprite.destroy();
  }
}

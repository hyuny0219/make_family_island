import type { Costume } from './Costume';
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
  /** 누워서 자는 중 */
  lying = false;
  /** 다른 가족의 곰이 쓰고 있는 변신 모자 (이름, 진화 단계, 그림) */
  hat?: { id: string; lv: number; img?: Phaser.GameObjects.Image };
  /** 변신 옷 (망토·빛·손에 든 무기) */
  costume?: Costume;
  /** 다른 가족이 조종하는 곰이면 그 기기 id */
  remote: string | null = null;
  /** 머리 위 이름표 (다른 가족 곰) */
  label?: Phaser.GameObjects.Text;
  /** 머리 위 말풍선 */
  private bubble?: Phaser.GameObjects.Container;
  /** 마지막으로 보여 준 말풍선 시각 (같은 걸 두 번 띄우지 않게) */
  emoteAt = 0;
  /** 마지막으로 따라 한 동작의 시각 (다른 가족의 곰) */
  actAt = -1;
  /** 다른 가족이 낚시 중일 때의 찌 */
  bobber?: Phaser.GameObjects.Image;
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  target: { x: number; y: number } | null = null;
  facing: Facing = 'front';
  speed: number;

  private walkT = 0;
  /** 걷는 그림이 있는 곰인가 (가족 곰만 있다) */
  private readonly hasWalk: boolean;
  /** 지금 보여 주는 걸음 (0이면 서 있는 그림) */
  private walkFrame = 0;
  /** 동작 그림이 있는 곰인가 (가족 곰만 있다) */
  private readonly hasAct: boolean;
  /** 하고 있는 동작: 휘두르기(치켜들기→내려치기), 주먹, 줍기 */
  private actKind: 'swing' | 'punch' | 'pick' | null = null;
  private actT = 0;
  private actWind = 0.08;
  /** 지금 보여 주는 동작 그림 (0이면 없음. 1 치켜들기, 2 내려치기, 3 주먹, 4 줍기) */
  private actFrame = 0;
  /** 때리는 몸짓: 남은 시간과 방향 */
  private lungeT = 0;
  private lungeDir = 1;
  private hop = 0;
  private hopV = 0;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, speed: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.sprite = scene.add.image(x, y, `${id}_front`).setOrigin(0.5, 1);
    this.hasWalk = scene.textures.exists(`${id}_front_w1`);
    this.hasAct = scene.textures.exists(`${id}_front_a1`);
    this.sprite.setInteractive({ useHandCursor: true });
    (this.sprite as unknown as { bear: Bear }).bear = this;
  }

  /** 입고 있는 변신 의상 (그 의상의 그림이 있을 때만 쓴다) */
  private skin: string | null = null;

  /** 의상을 입힌다(null이면 벗는다). 여럿을 주면 그림이 있는 첫 번째 것을 입는다. 맞는 그림이 없으면 false */
  setSkin(skin: string | string[] | null) {
    const found = (Array.isArray(skin) ? skin : skin ? [skin] : []).find((k) => this.sprite.scene.textures.exists(`${this.id}_${k}_front`));
    const ok = !!found;
    const next = found ?? null;
    if (next !== this.skin) {
      this.skin = next;
      this.sprite.setTexture(this.tex(this.facing, this.actFrame ? `_a${this.actFrame}` : this.walkFrame ? `_w${this.walkFrame}` : ''));
    }
    return ok;
  }

  get skinned() {
    return this.skin !== null;
  }

  /** 지금 보여 줄 그림 이름: 의상 그림이 있으면 그것, 없는 동작은 평소 그림 */
  private tex(dir: Facing, suffix: string) {
    if (this.skin) {
      const k = `${this.id}_${this.skin}_${dir}${suffix}`;
      if (this.sprite.scene.textures.exists(k)) return k;
      const idle = `${this.id}_${this.skin}_${dir}`;
      if (this.sprite.scene.textures.exists(idle)) return idle;
    }
    return `${this.id}_${dir}${suffix}`;
  }

  get moving() {
    return this.target !== null;
  }

  face(dir: Facing, left = false) {
    this.facing = dir;
    this.sprite.setTexture(this.tex(dir, this.actFrame ? `_a${this.actFrame}` : this.walkFrame ? `_w${this.walkFrame}` : ''));
    this.sprite.setFlipX(dir === 'side' && left);
  }

  /**
   * 동작 그림을 보여 준다. 동작 그림이 없는 곰(주민 등)은 아무것도 하지 않는다.
   * @param wind 휘두르기에서 치켜드는 시간(초). 무거운 무기일수록 길다
   * @returns 동작 그림이 있어서 시작했으면 true
   */
  act(kind: 'swing' | 'punch' | 'pick', wind = 0.08) {
    if (!this.hasAct) return false;
    this.actKind = kind;
    this.actT = 0;
    this.actWind = wind;
    return true;
  }

  /** 때리는 몸짓: 상대 쪽으로 몸을 훅 내밀었다 돌아온다 */
  swing(left: boolean) {
    this.lungeT = 0.18;
    this.lungeDir = left ? -1 : 1;
  }

  /** 제자리 점프 (터치 반응) */
  jump(power = 120) {
    if (this.hop > 0.5) return;
    this.hopV = power;
  }

  /** 높이 뛰기 (점프 단추). 이미 떠 있으면 false */
  leap() {
    if (this.hop > 0.5 || this.lying) return false;
    this.hopV = 250;
    return true;
  }

  /** 발이 땅에서 충분히 떨어져 있다 (몬스터의 공격이 닿지 않는다) */
  get air() {
    return this.hop > 8;
  }

  /** 높이 뛰었을 때 발밑에 생기는 그림자 */
  private shadow?: Phaser.GameObjects.Ellipse;

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

    // 동작 그림: 걷기 시작하면 그만둔다
    if (this.actKind) {
      this.actT += dt;
      let f = 0;
      if (!this.target) {
        if (this.actKind === 'swing') f = this.actT < this.actWind ? 1 : this.actT < this.actWind + 0.2 ? 2 : 0;
        else if (this.actKind === 'punch') f = this.actT < 0.22 ? 3 : 0;
        else f = this.actT < 0.32 ? 4 : 0;
      }
      if (f !== this.actFrame) {
        this.actFrame = f;
        this.walkFrame = 0;
        this.sprite.setTexture(this.tex(this.facing, f ? `_a${f}` : ''));
      }
      if (!f) this.actKind = null;
    }

    // 걷기: 통통 + 찌그러짐 / 정지: 숨쉬기
    let sx = 1;
    let sy = 1;
    let bob = 0;
    if (this.actFrame) {
      // 동작 중에는 그림 그대로
    } else if (this.target) {
      const w = Math.sin(this.walkT * 16);
      if (this.hasWalk) {
        // 걷는 그림 두 장을 번갈아 보여 준다 (통통 튀는 건 조금만)
        const f = 1 + (Math.floor(this.walkT / 0.16) % 2);
        if (f !== this.walkFrame) {
          this.walkFrame = f;
          this.sprite.setTexture(this.tex(this.facing, `_w${f}`));
        }
        bob = Math.abs(w) * 1.2;
      } else {
        bob = Math.abs(w) * 2.5;
        sx = 1 + w * 0.05;
        sy = 1 - w * 0.05;
      }
    } else {
      if (this.walkFrame) {
        this.walkFrame = 0;
        this.sprite.setTexture(this.tex(this.facing, ''));
      }
      const b = Math.sin(performance.now() / 420 + this.x) * 0.025;
      sx = 1 + b;
      sy = 1 - b;
      this.walkT = 0;
    }
    // 때리는 몸짓
    let lunge = 0;
    if (this.lungeT > 0) {
      this.lungeT = Math.max(0, this.lungeT - dt);
      const k = Math.sin(Math.PI * (1 - this.lungeT / 0.18));
      lunge = k * 6 * this.lungeDir;
      this.sprite.setAngle(k * 14 * this.lungeDir);
    } else if (this.sprite.angle !== 0 && !this.lying) this.sprite.setAngle(0);
    this.sprite.setScale(sx, sy);
    this.sprite.setPosition(Math.round(this.x + lunge), Math.round(this.y - bob - this.hop));
    // 잘 때는 옆으로 눕는다 (발을 축으로 돌리므로 몸 길이의 절반만큼 당겨서 제자리에 눕힌다)
    if (this.lying) {
      this.sprite.setAngle(90);
      this.sprite.setPosition(Math.round(this.x - this.sprite.height / 2), Math.round(this.y - 5));
    }
    this.sprite.setDepth(this.y);
    if (this.hop > 3) {
      if (!this.shadow) this.shadow = this.sprite.scene.add.ellipse(0, 0, 18, 7, 0x000000, 0.28);
      const k = Math.max(0.55, 1 - this.hop / 90);
      this.shadow.setVisible(this.sprite.visible).setPosition(Math.round(this.x), Math.round(this.y - 1)).setScale(k).setDepth(this.y - 0.5);
    } else if (this.shadow?.visible) this.shadow.setVisible(false);
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
    this.shadow?.destroy();
    this.sprite.destroy();
  }
}

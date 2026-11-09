import Phaser from 'phaser';

/**
 * 슬라임 — 섬을 통통 돌아다니는 귀여운 몬스터.
 * 곰을 다치게 하지 않는다. 톡톡 치면 젤리를 떨어뜨리고 뿅 사라진다.
 */
export class Slime {
  readonly sprite: Phaser.GameObjects.Image;
  readonly king: boolean;
  x: number;
  y: number;
  hp: number;
  dead = false;
  /** 다음 통통 뛰기까지 남은 시간(초) */
  private wait: number;
  /** 뛰는 중이면 진행도(0~1) */
  private hopT = -1;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private readonly base: number;
  private readonly variant: string;

  constructor(scene: Phaser.Scene, x: number, y: number, king: boolean, variant: '' | '_pink' | '_blue' = '') {
    this.x = x;
    this.y = y;
    this.king = king;
    this.hp = king ? 6 : 2;
    this.base = king ? 1.15 : 1;
    this.wait = 0.5 + Math.random() * 2;
    this.variant = king ? '' : variant;
    this.sprite = scene.add.image(x, y, king ? 'slime_king' : `slime${this.variant}`).setOrigin(0.5, 1).setScale(0);
    this.sprite.setInteractive({ useHandCursor: true });
    (this.sprite as unknown as { slime: Slime }).slime = this;
    scene.tweens.add({ targets: this.sprite, scale: this.base, duration: 260, ease: 'Back.easeOut' });
  }

  private tex(name: 'slime' | 'slime_squash') {
    if (!this.king) this.sprite.setTexture(name + this.variant);
  }

  /** 맞았을 때: 납작해졌다가 반대쪽으로 통 튄다 */
  bop(fromX: number, fromY: number, walkable: (x: number, y: number) => boolean) {
    const scene = this.sprite.scene;
    this.hp -= 1;
    this.tex('slime_squash');
    this.sprite.setTintFill(0xffffff);
    scene.time.delayedCall(70, () => {
      if (this.dead) return;
      this.sprite.clearTint();
    });
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    const nx = this.x + Math.cos(a) * 26;
    const ny = this.y + Math.sin(a) * 26;
    this.startHop(walkable(nx, ny) ? nx : this.x, walkable(nx, ny) ? ny : this.y);
  }

  private startHop(x: number, y: number) {
    this.from = { x: this.x, y: this.y };
    this.to = { x, y };
    this.hopT = 0;
    if (x !== this.x) this.sprite.setFlipX(x < this.x);
  }

  update(dt: number, walkable: (x: number, y: number) => boolean) {
    if (this.dead) return;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    if (this.hopT >= 0) {
      this.hopT += dt / 0.42;
      const t = Math.min(this.hopT, 1);
      this.x = Phaser.Math.Linear(this.from.x, this.to.x, t);
      this.y = Phaser.Math.Linear(this.from.y, this.to.y, t);
      lift = Math.sin(t * Math.PI) * (this.king ? 9 : 12);
      sx = 1 - Math.sin(t * Math.PI) * 0.1;
      sy = 1 + Math.sin(t * Math.PI) * 0.14;
      if (t >= 1) {
        this.hopT = -1;
        this.wait = 0.8 + Math.random() * 2.2;
        this.tex('slime_squash');
        this.sprite.scene.time.delayedCall(130, () => !this.dead && this.tex('slime'));
      }
    } else {
      // 숨쉬듯 말랑말랑
      const b = Math.sin(performance.now() / 300 + this.x) * 0.05;
      sx = 1 + b;
      sy = 1 - b;
      this.wait -= dt;
      if (this.wait <= 0) {
        const a = Math.random() * Math.PI * 2;
        const d = 14 + Math.random() * 22;
        const nx = this.x + Math.cos(a) * d;
        const ny = this.y + Math.sin(a) * d;
        if (walkable(nx, ny)) this.startHop(nx, ny);
        else this.wait = 0.4;
      }
    }
    if (this.sprite.scale >= this.base * 0.99) this.sprite.setScale(this.base * sx, this.base * sy);
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - lift)).setDepth(this.y);
  }

  /** 뿅 하고 사라지기 */
  pop() {
    this.dead = true;
    this.sprite.disableInteractive();
    const s = this.sprite;
    s.scene.tweens.add({ targets: s, scaleX: this.base * 1.5, scaleY: 0, alpha: 0, duration: 200, ease: 'Cubic.easeIn', onComplete: () => s.destroy() });
  }

  destroy() {
    this.dead = true;
    this.sprite.destroy();
  }
}

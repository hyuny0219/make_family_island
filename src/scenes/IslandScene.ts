import Phaser from 'phaser';
import { MAP_H, MAP_W, PLAYER_SPEED, TILE, WORLD_ZOOM, COLORS } from '../config';
import { generateIsland, T_SEA, type Decor } from '../data/islandMap';
import { BEARS, BLOCKING, type BearId } from '../data/assets';
import { Bear } from '../objects/Bear';
import { sfx, buzz } from '../sfx';
import { HUD_BOTTOM_H, HUD_TOP_H } from './HudScene';

type DecorObj = Phaser.GameObjects.Image & { decor: Decor };
type Hit = { bear?: Bear; decor?: DecorObj };

const LEAFY = new Set(['fruit_tree', 'pine_tree', 'bush', 'sapling']);
const STONY = new Set(['rock', 'boulder', 'ore_rock', 'pebbles', 'stump']);

export class IslandScene extends Phaser.Scene {
  private terrain!: number[][];
  private blocked = new Set<string>();
  private bears: Bear[] = [];
  private player: Bear | null = null;
  private pending: Hit | null = null;
  private camp = { x: 0, y: 0 };
  private npcTimers = new Map<Bear, number>();
  private stepTimer = 0;
  private fx!: Record<'leaf' | 'pebble' | 'sparkle' | 'ember' | 'heart', Phaser.GameObjects.Particles.ParticleEmitter>;

  constructor() {
    super('Island');
  }

  create() {
    const map = generateIsland();
    this.terrain = map.terrain;
    this.blocked.clear();
    this.bears = [];
    this.player = null;

    // 바닥
    const tm = this.make.tilemap({ data: map.tiles, tileWidth: TILE, tileHeight: TILE });
    const ts = tm.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
    tm.createLayer(0, ts, 0, 0)!.setDepth(-1000);

    // 오브젝트
    for (const d of map.decor) {
      const img = this.add.image(d.tx * TILE + TILE / 2, d.ty * TILE + TILE - 2, d.kind).setOrigin(0.5, 1) as DecorObj;
      img.decor = d;
      img.setDepth(img.y);
      img.setInteractive({ useHandCursor: true, pixelPerfect: false });
      if (BLOCKING.has(d.kind)) {
        this.blocked.add(`${d.tx},${d.ty}`);
        if (d.kind === 'tent') this.blocked.add(`${d.tx - 1},${d.ty}`);
      }
      if (d.kind === 'campfire') this.animateCampfire(img);
    }

    // 곰 가족 — 캠프 앞에 모여 있다가, 고른 곰이 플레이어가 된다
    this.camp = { x: map.camp.tx * TILE + TILE / 2, y: (map.camp.ty + 2) * TILE + TILE / 2 };
    BEARS.forEach((b, i) => {
      const bx = this.camp.x + (i - 1.5) * 26;
      const by = this.camp.y + 30 + (i % 2) * 6;
      const bear = new Bear(this, b.id, bx, by, 45);
      this.bears.push(bear);
      this.npcTimers.set(bear, 1 + Math.random() * 3);
    });

    this.makeFx();

    const cam = this.cameras.main;
    cam.setZoom(WORLD_ZOOM);
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.centerOn(this.camp.x, this.camp.y);
    cam.setBackgroundColor(COLORS.sea);
    cam.setRoundPixels(true);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.game.events.on('choose-bear', this.choosePlayer, this);
    this.events.once('shutdown', () => this.game.events.off('choose-bear', this.choosePlayer, this));
  }

  private makeFx() {
    const base = { emitting: false } as const;
    this.fx = {
      leaf: this.add.particles(0, 0, 'leaf', { ...base, speed: { min: 25, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 110, lifespan: 750, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, scale: 1.5 }),
      pebble: this.add.particles(0, 0, 'pebble', { ...base, speed: { min: 30, max: 65 }, angle: { min: 210, max: 330 }, gravityY: 200, lifespan: 480, scale: 1.5 }),
      sparkle: this.add.particles(0, 0, 'sparkle', { ...base, speed: { min: 10, max: 30 }, lifespan: 550, scale: { start: 1.5, end: 0 } }),
      ember: this.add.particles(0, 0, 'ember', { ...base, speed: { min: 15, max: 45 }, angle: { min: 240, max: 300 }, gravityY: -40, lifespan: 700, alpha: { start: 1, end: 0 } }),
      heart: this.add.particles(0, 0, 'heart', { ...base, speed: { min: 20, max: 40 }, angle: { min: 240, max: 300 }, gravityY: -20, lifespan: 900, alpha: { start: 1, end: 0 }, scale: { start: 1.2, end: 0.6 } }),
    };
    Object.values(this.fx).forEach((e) => e.setDepth(99999));
  }

  private animateCampfire(img: Phaser.GameObjects.Image) {
    this.tweens.add({ targets: img, scaleY: 1.08, scaleX: 0.95, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => this.fx?.ember.explode(1, img.x + Phaser.Math.Between(-4, 4), img.y - 16) });
  }

  /** 시작 화면에서 고른 곰을 플레이어로 */
  private choosePlayer(id: BearId) {
    const bear = this.bears.find((b) => b.id === id)!;
    this.player = bear;
    bear.speed = PLAYER_SPEED;
    bear.target = null;
    bear.face('front');
    bear.jump(150);
    this.fx.heart.explode(4, bear.x, bear.y - 30);
    this.cameras.main.startFollow(bear.sprite, true, 0.12, 0.12, 0, 20);
  }

  private onPointerDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (!this.player) return;
    if (p.y < HUD_TOP_H || p.y > this.scale.height - HUD_BOTTOM_H) return;

    const bearHit = over.map((o) => (o as unknown as { bear?: Bear }).bear).find((b) => b && b !== this.player);
    const decorHit = over.find((o) => (o as DecorObj).decor) as DecorObj | undefined;
    const pl = this.player;

    if (bearHit) {
      // 가족 곰한테 다가가기
      const side = pl.x <= bearHit.x ? -1 : 1;
      this.walkTo(bearHit.x + side * 22, bearHit.y, { bear: bearHit });
    } else if (decorHit) {
      const d = decorHit.decor;
      const side = pl.x <= decorHit.x ? -1 : 1;
      const w = d.kind === 'tent' ? 30 : 20;
      this.walkTo(decorHit.x + side * w, d.ty * TILE + TILE - 1, { decor: decorHit });
    } else {
      this.walkTo(p.worldX, p.worldY, null);
    }
  }

  private walkTo(x: number, y: number, hit: Hit | null) {
    if (!this.player) return;
    this.player.target = { x, y };
    this.pending = hit;
    this.showTapMarker(x, y);
    sfx.tap();
    this.game.events.emit('player-moved');
  }

  private showTapMarker(x: number, y: number) {
    const ring = this.add.ellipse(x, y, 16, 8).setStrokeStyle(1.5, COLORS.white, 0.9).setDepth(-500);
    this.tweens.add({ targets: ring, scale: { from: 0.3, to: 1.5 }, alpha: { from: 1, to: 0 }, duration: 400, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  private walkable = (wx: number, wy: number) => {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return this.terrain[ty][tx] !== T_SEA && !this.blocked.has(`${tx},${ty}`);
  };

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);

    for (const bear of this.bears) {
      const arrived = bear.step(dt, this.walkable);
      if (bear === this.player) {
        if (bear.moving) {
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) {
            sfx.step();
            this.stepTimer = 0.26;
          }
        }
        if (arrived && this.pending) this.interact(this.pending);
        if (arrived) this.pending = null;
      } else {
        this.updateNpc(bear, dt);
      }
    }
  }

  /** 가족 곰: 캠프 근처를 느긋하게 돌아다니기 */
  private updateNpc(bear: Bear, dt: number) {
    if (bear.moving) return;
    const t = (this.npcTimers.get(bear) ?? 0) - dt;
    this.npcTimers.set(bear, t);
    if (t > 0) return;
    this.npcTimers.set(bear, 2 + Math.random() * 4);
    for (let i = 0; i < 8; i++) {
      const x = this.camp.x + Phaser.Math.Between(-90, 90);
      const y = this.camp.y + Phaser.Math.Between(-30, 90);
      if (this.walkable(x, y)) {
        bear.target = { x, y };
        return;
      }
    }
  }

  private interact(hit: Hit) {
    const pl = this.player!;
    buzz(15);
    if (hit.bear) {
      const other = hit.bear;
      other.target = null;
      other.face('side', other.x > pl.x);
      pl.face('side', pl.x > other.x);
      other.jump();
      pl.jump(90);
      sfx.pop();
      this.fx.heart.explode(3, (pl.x + other.x) / 2, Math.min(pl.y, other.y) - 34);
      this.npcTimers.set(other, 2.5);
      return;
    }
    const obj = hit.decor!;
    const kind = obj.decor.kind;
    pl.face('side', obj.x < pl.x);
    this.game.events.emit('decor-poked', kind);

    if (LEAFY.has(kind)) {
      sfx.rustle();
      this.tweens.add({ targets: obj, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => obj.setAngle(0) });
      this.fx.leaf.explode(7, obj.x, obj.y - obj.height * 0.6);
    } else if (STONY.has(kind)) {
      sfx.knock();
      this.tweens.add({ targets: obj, scaleX: { from: 1.15, to: 1 }, scaleY: { from: 0.85, to: 1 }, duration: 240, ease: 'Back.easeOut' });
      this.fx.pebble.explode(6, obj.x, obj.y - obj.height * 0.4);
      if (kind === 'ore_rock') this.fx.sparkle.explode(6, obj.x, obj.y - obj.height * 0.6);
    } else if (kind === 'campfire') {
      sfx.pop();
      this.fx.ember.explode(10, obj.x, obj.y - 14);
    } else {
      // 텐트, 꽃
      sfx.pop();
      this.tweens.add({ targets: obj, scaleX: { from: 1.12, to: 1 }, scaleY: { from: 0.9, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      this.fx.sparkle.explode(5, obj.x, obj.y - obj.height * 0.5);
    }
  }
}

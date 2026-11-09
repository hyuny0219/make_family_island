import Phaser from 'phaser';
import { MAP_H, MAP_W, PLAYER_SPEED, TILE, WORLD_ZOOM, COLORS } from '../config';
import { generateIsland, T_SEA, type Decor } from '../data/islandMap';
import { sfx, buzz } from '../sfx';
import { HUD_BOTTOM_H, HUD_TOP_H } from './HudScene';

type Target = { x: number; y: number; poke?: DecorObj };
type DecorObj = Phaser.GameObjects.Image & { decor: Decor };

export class IslandScene extends Phaser.Scene {
  private tiles!: number[][];
  private blocked = new Set<string>();
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private target: Target | null = null;
  private walkTime = 0;
  private stepTimer = 0;
  private leafFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pebbleFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkleFx!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Island');
  }

  create() {
    const map = generateIsland();
    this.tiles = map.tiles;

    // 바닥 타일
    const tm = this.make.tilemap({ data: map.tiles, tileWidth: TILE, tileHeight: TILE });
    const ts = tm.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
    tm.createLayer(0, ts, 0, 0)!.setDepth(-1000);

    // 장식(나무/바위)
    for (const d of map.decor) {
      const img = this.add
        .image(d.tx * TILE + TILE / 2, d.ty * TILE + TILE, d.kind)
        .setOrigin(0.5, 1) as DecorObj;
      img.decor = d;
      img.setDepth(img.y);
      img.setInteractive({ useHandCursor: true });
      this.add.image(img.x, img.y - 1, 'shadow').setDepth(img.y - 1).setScale(d.kind === 'tree' ? 1.1 : 1.2);
      this.blocked.add(`${d.tx},${d.ty}`);
    }

    // 플레이어
    const sx = map.spawn.tx * TILE + TILE / 2;
    const sy = map.spawn.ty * TILE + TILE / 2;
    this.shadow = this.add.image(sx, sy, 'shadow');
    this.player = this.add.image(sx, sy, 'player').setOrigin(0.5, 1);

    // 파티클 (손맛)
    this.leafFx = this.add.particles(0, 0, 'leaf', {
      emitting: false,
      speed: { min: 20, max: 60 },
      angle: { min: 200, max: 340 },
      gravityY: 90,
      lifespan: 700,
      rotate: { min: 0, max: 360 },
      alpha: { start: 1, end: 0 },
    }).setDepth(9999);
    this.pebbleFx = this.add.particles(0, 0, 'pebble', {
      emitting: false,
      speed: { min: 25, max: 55 },
      angle: { min: 210, max: 330 },
      gravityY: 160,
      lifespan: 450,
    }).setDepth(9999);
    this.sparkleFx = this.add.particles(0, 0, 'sparkle', {
      emitting: false,
      speed: { min: 8, max: 24 },
      lifespan: 500,
      scale: { start: 1, end: 0 },
    }).setDepth(9999);

    // 카메라
    const cam = this.cameras.main;
    cam.setZoom(WORLD_ZOOM);
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setBackgroundColor(COLORS.sea);

    this.input.on('pointerdown', this.onPointerDown, this);
  }

  private onPointerDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (!this.registry.get('started')) return;
    // HUD 영역 터치는 무시
    if (p.y < HUD_TOP_H || p.y > this.scale.height - HUD_BOTTOM_H) return;

    const hit = over.find((o) => (o as DecorObj).decor) as DecorObj | undefined;
    if (hit) {
      // 대상 옆(플레이어가 있는 쪽)으로 걸어가서 건드리기
      const side = this.player.x <= hit.x ? -1 : 1;
      const tx = hit.decor.tx * TILE + TILE / 2 + side * 13;
      const ty = hit.decor.ty * TILE + TILE - 1;
      this.setTarget(tx, ty, hit);
      return;
    }
    // 바다를 눌러도 해안선에서 자연스럽게 멈춘다 (update의 이동 판정)
    this.setTarget(p.worldX, p.worldY);
  }

  private setTarget(x: number, y: number, poke?: DecorObj) {
    this.target = { x, y, poke };
    this.showTapMarker(x, y);
    sfx.tap();
    this.game.events.emit('player-moved');
  }

  private showTapMarker(x: number, y: number) {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(1.5, COLORS.white, 0.9).setDepth(9998);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.3, to: 1.4 },
      alpha: { from: 1, to: 0 },
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private tileAt(wx: number, wy: number) {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return { tx, ty, t: T_SEA };
    return { tx, ty, t: this.tiles[ty][tx] };
  }

  private isWalkable(wx: number, wy: number) {
    const { tx, ty, t } = this.tileAt(wx, wy);
    return t !== T_SEA && !this.blocked.has(`${tx},${ty}`);
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    const pl = this.player;

    if (this.target) {
      const dx = this.target.x - pl.x;
      const dy = this.target.y - pl.y;
      const dist = Math.hypot(dx, dy);
      const step = PLAYER_SPEED * dt;

      if (dist <= step) {
        this.arrive();
      } else {
        const nx = pl.x + (dx / dist) * step;
        const ny = pl.y + (dy / dist) * step;
        // 축별로 시도해서 벽을 따라 미끄러지게
        if (this.isWalkable(nx, ny)) pl.setPosition(nx, ny);
        else if (this.isWalkable(nx, pl.y)) pl.x = nx;
        else if (this.isWalkable(pl.x, ny)) pl.y = ny;
        else this.arrive();

        if (dx !== 0) pl.setFlipX(dx < 0);
        this.walkTime += dt;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          sfx.step();
          this.stepTimer = 0.28;
        }
      }
    }

    // 걷는 동안 통통 튀는 연출 (squash & stretch)
    if (this.target) {
      const s = Math.sin(this.walkTime * 18);
      pl.setScale(1 + s * 0.06, 1 - s * 0.06);
      pl.setDisplayOrigin(6, 16 + Math.abs(s) * 1.5);
    } else {
      // 숨쉬기
      const b = Math.sin(this.time.now / 380) * 0.03;
      pl.setScale(1 + b, 1 - b);
      pl.setDisplayOrigin(6, 16);
    }
    pl.setDepth(pl.y);
    this.shadow.setPosition(pl.x, pl.y - 1).setDepth(pl.y - 1);
  }

  private arrive() {
    const poke = this.target?.poke;
    this.target = null;
    this.walkTime = 0;
    if (poke) {
      this.player.setFlipX(poke.x < this.player.x);
      this.pokeDecor(poke);
    }
  }

  /** 나무/바위 건드리기 — M1에서 채집·채광 드롭으로 확장 */
  private pokeDecor(obj: DecorObj) {
    buzz(15);
    if (obj.decor.kind === 'tree') {
      sfx.rustle();
      this.tweens.add({
        targets: obj,
        angle: { from: -7, to: 7 },
        duration: 70,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
        onComplete: () => obj.setAngle(0),
      });
      this.leafFx.explode(6, obj.x, obj.y - 14);
    } else {
      sfx.knock();
      this.tweens.add({
        targets: obj,
        scaleX: { from: 1.15, to: 1 },
        scaleY: { from: 0.85, to: 1 },
        duration: 220,
        ease: 'Back.easeOut',
      });
      this.pebbleFx.explode(5, obj.x, obj.y - 6);
    }
    this.sparkleFx.explode(3, obj.x, obj.y - 10);
    this.game.events.emit('decor-poked', obj.decor.kind);
  }
}

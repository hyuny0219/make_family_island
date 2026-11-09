import Phaser from 'phaser';
import { MAP_H, MAP_W, PLAYER_SPEED, TILE, WORLD_ZOOM, COLORS } from '../config';
import { generateIsland, T_GRASS, T_SAND, T_SEA, type Decor } from '../data/islandMap';
import { BEARS, BLOCKING, type BearId } from '../data/assets';
import { GATHER, rollDrops } from '../data/gathering';
import { ITEMS, itemKey, type ItemId } from '../data/items';
import { inventory } from '../state/inventory';
import { Bear } from '../objects/Bear';
import { sfx, buzz } from '../sfx';
import { withJosa } from '../util/korean';
import { HUD_BOTTOM_H, HUD_TOP_H } from './HudScene';

type DecorObj = Phaser.GameObjects.Image & {
  decor: Decor;
  hitsLeft: number;
  resting: boolean;
  gone: boolean;
};
type Hit = { bear?: Bear; decor?: DecorObj };

/** 해안선 다듬기 색상 (tiles.png 기준) */
const EDGE = {
  grass: 0xb7e279,
  grassLine: 0x8fc46a,
  sand: 0xfde4b4,
  foam: 0xf3f7f7,
};

export class IslandScene extends Phaser.Scene {
  private terrain!: number[][];
  private blocked = new Set<string>();
  private bears: Bear[] = [];
  private player: Bear | null = null;
  private pending: Hit | null = null;
  private camp = { x: 0, y: 0 };
  private npcTimers = new Map<Bear, number>();
  private stepTimer = 0;
  private lastHit = 0;
  private fx!: Record<'leaf' | 'pebble' | 'sparkle' | 'ember' | 'heart' | 'dust', Phaser.GameObjects.Particles.ParticleEmitter>;

  constructor() {
    super('Island');
  }

  create() {
    const map = generateIsland();
    this.terrain = map.terrain;
    this.blocked.clear();
    this.bears = [];
    this.player = null;

    // 바닥 + 경계 다듬기
    const tm = this.make.tilemap({ data: map.tiles, tileWidth: TILE, tileHeight: TILE });
    const ts = tm.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
    tm.createLayer(0, ts, 0, 0)!.setDepth(-1000);
    this.drawEdges();

    // 오브젝트
    for (const d of map.decor) {
      const img = this.add.image(d.tx * TILE + TILE / 2, d.ty * TILE + TILE - 2, d.kind).setOrigin(0.5, 1) as DecorObj;
      img.decor = d;
      img.hitsLeft = GATHER[d.kind]?.hits ?? 0;
      img.resting = false;
      img.gone = false;
      img.setDepth(img.y);
      img.setInteractive({ useHandCursor: true });
      this.setBlocked(d, true);
      if (d.kind === 'campfire') this.animateCampfire(img);
    }

    // 곰 가족 — 캠프 앞에 모여 있다가, 고른 곰이 플레이어가 된다
    this.camp = { x: map.camp.tx * TILE + TILE / 2, y: (map.camp.ty + 2) * TILE + TILE / 2 };
    BEARS.forEach((b, i) => {
      const bear = new Bear(this, b.id, this.camp.x + (i - 1.5) * 26, this.camp.y + 30 + (i % 2) * 6, 45);
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

  // ───────────────────────── 지형 ─────────────────────────

  /**
   * 타일 경계가 계단처럼 보이지 않도록, 위 지형(풀>모래>바다)을 아래 지형 쪽으로
   * 물결 모양으로 2~5px 덮어 그린다. 모래→바다 끝에는 흰 거품 선.
   */
  private drawEdges() {
    const g = this.add.graphics().setDepth(-900);
    const rank = (t: number) => (t === T_GRASS ? 2 : t === T_SAND ? 1 : 0);
    const passes: [number, number, number][] = [
      [T_SAND, EDGE.sand, EDGE.foam],
      [T_GRASS, EDGE.grass, EDGE.grassLine],
    ];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [type, fill, tip] of passes) {
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (this.terrain[y][x] !== type) continue;
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            if (rank(this.terrain[ny][nx]) >= rank(type)) continue;
            for (let i = 0; i < TILE; i++) {
              const along = dx === 0 ? x * TILE + i : y * TILE + i;
              const ext = 2 + Math.round(1.5 + 1.5 * Math.sin(along * 0.55 + (dx === 0 ? y : x) * 1.7));
              let rx: number, ry: number, rw: number, rh: number, tx: number, ty: number;
              if (dy === 1) [rx, ry, rw, rh, tx, ty] = [x * TILE + i, (y + 1) * TILE, 1, ext, x * TILE + i, (y + 1) * TILE + ext];
              else if (dy === -1) [rx, ry, rw, rh, tx, ty] = [x * TILE + i, y * TILE - ext, 1, ext, x * TILE + i, y * TILE - ext - 1];
              else if (dx === 1) [rx, ry, rw, rh, tx, ty] = [(x + 1) * TILE, y * TILE + i, ext, 1, (x + 1) * TILE + ext, y * TILE + i];
              else [rx, ry, rw, rh, tx, ty] = [x * TILE - ext, y * TILE + i, ext, 1, x * TILE - ext - 1, y * TILE + i];
              g.fillStyle(fill).fillRect(rx, ry, rw, rh);
              g.fillStyle(tip, type === T_SAND ? 0.9 : 1).fillRect(tx, ty, 1, 1);
            }
          }
        }
      }
    }
  }

  private setBlocked(d: Decor, on: boolean) {
    if (!BLOCKING.has(d.kind)) return;
    const keys = [`${d.tx},${d.ty}`];
    if (d.kind === 'tent') keys.push(`${d.tx - 1},${d.ty}`);
    for (const k of keys) on ? this.blocked.add(k) : this.blocked.delete(k);
  }

  private walkable = (wx: number, wy: number) => {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return this.terrain[ty][tx] !== T_SEA && !this.blocked.has(`${tx},${ty}`);
  };

  // ───────────────────────── 연출 ─────────────────────────

  private makeFx() {
    const base = { emitting: false } as const;
    this.fx = {
      leaf: this.add.particles(0, 0, 'leaf', { ...base, speed: { min: 25, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 110, lifespan: 750, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, scale: 1.5 }),
      pebble: this.add.particles(0, 0, 'pebble', { ...base, speed: { min: 30, max: 65 }, angle: { min: 210, max: 330 }, gravityY: 200, lifespan: 480, scale: 1.5 }),
      sparkle: this.add.particles(0, 0, 'sparkle', { ...base, speed: { min: 10, max: 30 }, lifespan: 550, scale: { start: 1.5, end: 0 } }),
      ember: this.add.particles(0, 0, 'ember', { ...base, speed: { min: 15, max: 45 }, angle: { min: 240, max: 300 }, gravityY: -40, lifespan: 700, alpha: { start: 1, end: 0 } }),
      heart: this.add.particles(0, 0, 'heart', { ...base, speed: { min: 20, max: 40 }, angle: { min: 240, max: 300 }, gravityY: -20, lifespan: 900, alpha: { start: 1, end: 0 }, scale: { start: 1.2, end: 0.6 } }),
      dust: this.add.particles(0, 0, 'pebble', { ...base, speed: { min: 20, max: 50 }, lifespan: 500, scale: { start: 3, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xd9d4c7 }),
    };
    Object.values(this.fx).forEach((e) => e.setDepth(99999));
  }

  private animateCampfire(img: Phaser.GameObjects.Image) {
    this.tweens.add({ targets: img, scaleY: 1.08, scaleX: 0.95, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => this.fx?.ember.explode(1, img.x + Phaser.Math.Between(-4, 4), img.y - 16) });
  }

  private toast(msg: string) {
    this.game.events.emit('toast', msg);
  }

  // ───────────────────────── 입력 ─────────────────────────

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
    if (!this.player || this.registry.get('modal')) return;
    if (p.y < HUD_TOP_H || p.y > this.scale.height - HUD_BOTTOM_H) return;

    const bearHit = over.map((o) => (o as unknown as { bear?: Bear }).bear).find((b) => b && b !== this.player);
    const decorHit = over.find((o) => (o as DecorObj).decor && !(o as DecorObj).gone) as DecorObj | undefined;
    const pl = this.player;

    if (bearHit) {
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

  // ───────────────────────── 루프 ─────────────────────────

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

  // ───────────────────────── 상호작용 ─────────────────────────

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
    if (obj.gone) return;
    pl.face('side', obj.x < pl.x);

    // 연타 방지
    const now = this.time.now;
    if (now - this.lastHit < 220) return;
    this.lastHit = now;

    const rule = GATHER[obj.decor.kind];
    if (!rule) return this.pokeOnly(obj);

    if (rule.needs && inventory.get(rule.needs) === 0) {
      this.wobble(obj, rule.feel);
      this.toast(`${withJosa(ITEMS[rule.needs].name, '이', '가')} 필요해요!`);
      return;
    }
    if (obj.resting) {
      this.wobble(obj, rule.feel);
      this.toast(rule.feel === 'leafy' ? '🍃 조금 쉬었다가 다시 열려요' : '조금 있다가 다시 와요');
      return;
    }

    this.hitEffect(obj, rule.feel);
    obj.hitsLeft -= 1;
    const drops = rollDrops(rule.perHit);
    // 아이들이 허탕 치지 않도록: 건드릴 때마다 최소 1개는 보장
    if (drops.length === 0 && rule.perHit.length > 0) drops.push(Phaser.Utils.Array.GetRandom(rule.perHit)[0]);
    if (obj.hitsLeft <= 0) {
      drops.push(...rollDrops(rule.final));
      this.deplete(obj, rule.deplete, rule.regrowSec);
    }
    drops.forEach((id, i) => this.time.delayedCall(i * 90, () => this.spawnDrop(id, obj)));
  }

  /** 채집 규칙이 없는 오브젝트 (텐트·모닥불·새싹) */
  private pokeOnly(obj: DecorObj) {
    const kind = obj.decor.kind;
    sfx.pop();
    if (kind === 'campfire') {
      this.fx.ember.explode(10, obj.x, obj.y - 14);
      return;
    }
    this.tweens.add({ targets: obj, scaleX: { from: 1.12, to: 1 }, scaleY: { from: 0.9, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.fx.sparkle.explode(5, obj.x, obj.y - obj.height * 0.5);
    if (kind === 'sapling') this.toast('🌱 쑥쑥 자라는 중이에요');
  }

  private hitEffect(obj: DecorObj, feel: 'leafy' | 'stony') {
    this.wobble(obj, feel);
    if (feel === 'leafy') {
      sfx.rustle();
      this.fx.leaf.explode(7, obj.x, obj.y - obj.height * 0.6);
    } else {
      sfx.knock();
      this.fx.pebble.explode(6, obj.x, obj.y - obj.height * 0.4);
      if (obj.decor.kind === 'ore_rock') this.fx.sparkle.explode(6, obj.x, obj.y - obj.height * 0.6);
    }
  }

  private wobble(obj: DecorObj, feel: 'leafy' | 'stony') {
    if (feel === 'leafy') {
      this.tweens.add({ targets: obj, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => obj.setAngle(0) });
    } else {
      this.tweens.add({ targets: obj, scaleX: { from: 1.15, to: 1 }, scaleY: { from: 0.85, to: 1 }, duration: 240, ease: 'Back.easeOut' });
    }
  }

  private deplete(obj: DecorObj, mode: 'rest' | 'remove', regrowSec: number) {
    if (mode === 'rest') {
      obj.resting = true;
      this.time.delayedCall(260, () => obj.setTint(0xc9d6c0));
    } else {
      obj.gone = true;
      obj.disableInteractive();
      this.setBlocked(obj.decor, false);
      this.time.delayedCall(120, () => {
        this.fx.dust.explode(10, obj.x, obj.y - obj.height * 0.4);
        sfx.pop();
        this.tweens.add({ targets: obj, scale: 0, alpha: 0, duration: 220, ease: 'Back.easeIn' });
      });
    }
    this.time.delayedCall(regrowSec * 1000, () => this.regrow(obj));
  }

  /** 다시 자라기. 그 자리에 누가 서 있으면 조금 뒤에 다시 시도 */
  private regrow(obj: DecorObj) {
    const d = obj.decor;
    const occupied = this.bears.some((b) => Math.floor(b.x / TILE) === d.tx && Math.floor(b.y / TILE) === d.ty);
    if (obj.gone && occupied) {
      this.time.delayedCall(3000, () => this.regrow(obj));
      return;
    }
    obj.hitsLeft = GATHER[d.kind]?.hits ?? 0;
    obj.clearTint();
    if (obj.resting) {
      obj.resting = false;
      this.fx.sparkle.explode(4, obj.x, obj.y - obj.height * 0.6);
      return;
    }
    obj.gone = false;
    this.setBlocked(d, true);
    obj.setInteractive({ useHandCursor: true });
    obj.setScale(0).setAlpha(1);
    this.tweens.add({ targets: obj, scale: 1, duration: 420, ease: 'Back.easeOut' });
    this.fx.sparkle.explode(5, obj.x, obj.y - 8);
  }

  /** 아이템이 톡 튀어나와 바닥에 떨어진 뒤 → 곰에게 빨려와 → 창고로 */
  private spawnDrop(id: ItemId, from: DecorObj) {
    const sx = from.x;
    const sy = from.y - Math.min(from.height * 0.5, 18);
    const ex = sx + Phaser.Math.Between(-22, 22);
    const ey = from.y + Phaser.Math.Between(4, 14);
    const icon = this.add.image(sx, sy, itemKey(id)).setDepth(99990).setScale(0.6);

    // 포물선 (x는 선형, y는 위로 솟았다 떨어짐)
    const peak = Math.min(sy, ey) - 26;
    const t = { v: 0 };
    this.tweens.add({
      targets: t,
      v: 1,
      duration: 420,
      ease: 'Linear',
      onUpdate: () => {
        const k = t.v;
        icon.x = sx + (ex - sx) * k;
        icon.y = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * peak + k * k * ey;
        icon.setScale(0.6 + 0.4 * k);
      },
      onComplete: () => {
        this.tweens.add({ targets: icon, y: ey - 5, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        this.time.delayedCall(380, () => this.collect(icon, id));
      },
    });
  }

  private collect(icon: Phaser.GameObjects.Image, id: ItemId) {
    const pl = this.player;
    if (!pl) return icon.destroy();
    const t = { v: 0 };
    const sx = icon.x;
    const sy = icon.y;
    this.tweens.add({
      targets: t,
      v: 1,
      duration: 260,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        icon.x = sx + (pl.x - sx) * t.v;
        icon.y = sy + (pl.y - 20 - sy) * t.v;
        icon.setScale(1 - 0.5 * t.v);
      },
      onComplete: () => {
        icon.destroy();
        sfx.pop();
        inventory.add(id, 1);
        // 화면 좌표로 변환해서 HUD에 알림 (+1 연출)
        const cam = this.cameras.main;
        this.game.events.emit('item-gained', id, (pl.x - cam.worldView.x) * cam.zoom, (pl.y - 30 - cam.worldView.y) * cam.zoom);
      },
    });
  }
}

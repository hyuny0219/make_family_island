import Phaser from 'phaser';
import { PLAYER_SPEED, TILE, WORLD_ZOOM, COLORS } from '../config';
import { BEARS, BLOCKING, OBJECT_TEXTURE, type BearId } from '../data/assets';
import { GATHER, rollDrops } from '../data/gathering';
import { ITEMS, itemKey, type ItemId } from '../data/items';
import { ISLANDS } from '../data/islands';
import { BIOME_INFO } from '../data/biomes';
import { generateWorld, T_SEA, type Decor, type FishingSpot, type RegionInfo, type World } from '../world/generate';
import { drawEdges } from '../world/edges';
import { inventory } from '../state/inventory';
import { progress } from '../state/progress';
import { village, type Placed } from '../state/village';
import { family, type Presence } from '../sync/family';
import { DECOR_BLOCKING, DECOR_POINTS, RESIDENTS } from '../data/village';
import { Bear } from '../objects/Bear';
import { Slime } from '../objects/Slime';
import { TREASURES, treasureKey } from '../data/treasures';
import { sfx, buzz } from '../sfx';
import { withJosa } from '../util/korean';
import { HUD_BOTTOM_H, HUD_TOP_H } from './HudScene';

type DecorObj = Phaser.GameObjects.Image & { decor: Decor; hitsLeft: number; resting: boolean; gone: boolean; region: number };
type SpotObj = Phaser.GameObjects.Container & { spot: FishingSpot; active: boolean };
type Hit = { bear?: Bear; decor?: DecorObj; sign?: number; spot?: SpotObj; dock?: boolean; slime?: Slime; treasure?: boolean; pedestal?: boolean };

/** 지역 분위기별 슬라임 색 (초록이 기본) */
const SLIME_KIND: Record<string, '' | '_pink' | '_blue'> = { orchard: '', forest: '', rocky: '_blue', meadow: '_pink', beach: '_blue' };
const SLIME_MAX = 6;

const CLOUD_PX = 6; // 구름은 타일당 6px 저해상도로 그려 4배 확대 (도트 느낌 + 메모리 절약)

/** 섬마다 생성 결과를 캐시 (다시 방문할 때 빠르게) */
const worldCache = new Map<number, World>();

export class IslandScene extends Phaser.Scene {
  private islandIdx = 0;
  private world!: World;
  private blocked = new Set<string>();
  private bears: Bear[] = [];
  private player: Bear | null = null;
  private pending: Hit | null = null;
  private npcTimers = new Map<Bear, number>();
  private stepTimer = 0;
  private lastHit = 0;
  private curRegion = -1;
  private decorObjs: DecorObj[] = [];
  private signs = new Map<number, Phaser.GameObjects.Container>();
  private spots: SpotObj[] = [];
  private cloudTex!: Phaser.Textures.CanvasTexture;
  private boatImg?: Phaser.GameObjects.Image;
  private placedObjs = new Map<string, Phaser.GameObjects.Image>();
  /** 장식을 놓을 수 없는 칸 (원래 있던 나무·바위, 선착장 등) */
  private occupied = new Set<string>();
  private campPx = { x: 0, y: 0 };
  /** 다른 가족이 조종하는 곰 (기기 id → 곰) */
  private remotes = new Map<string, Bear>();
  private presenceTimer = 0;
  private slimes: Slime[] = [];
  private chest?: Phaser.GameObjects.Image;
  private chestRegion = -1;
  private pedestal?: Phaser.GameObjects.Image;
  private pedestalItem?: Phaser.GameObjects.Image;
  private opening = false;
  private slimeTimer = 3;
  private slimeTip = false;
  private myEmote: { e: string; et: number } | null = null;
  private fishing: null | { spot: SpotObj; phase: 'wait' | 'bite'; t: number; bobber: Phaser.GameObjects.Image; mark?: Phaser.GameObjects.Text } = null;
  private fx!: Record<'leaf' | 'pebble' | 'sparkle' | 'ember' | 'heart' | 'dust' | 'splash' | 'puff', Phaser.GameObjects.Particles.ParticleEmitter>;

  constructor() {
    super('Island');
  }

  create() {
    this.islandIdx = progress.current;
    const theme = ISLANDS[this.islandIdx];
    if (!worldCache.has(this.islandIdx)) worldCache.set(this.islandIdx, generateWorld(theme, this.islandIdx));
    this.world = worldCache.get(this.islandIdx)!;
    const W = this.world;
    this.blocked.clear();
    this.bears = [];
    this.slimes = [];
    this.slimeTimer = 3;
    this.player = null;
    this.decorObjs = [];
    this.signs.clear();
    this.remotes.clear();
    this.spots = [];
    this.fishing = null;
    this.curRegion = -1;
    this.boatImg = undefined;

    // 바닥 + 경계
    const tm = this.make.tilemap({ data: W.tiles, tileWidth: TILE, tileHeight: TILE });
    const skin = ISLANDS[this.islandIdx].skin;
    const ts = tm.addTilesetImage('tiles', skin ? `tiles_${skin}` : 'tiles', TILE, TILE, 1, 2)!;
    tm.createLayer(0, ts, 0, 0)!.setDepth(-1000);
    drawEdges(this, W.terrain, skin);

    this.makeFx();
    this.placeTreasure();

    // 오브젝트
    for (const d of W.decor) {
      const skinned = skin ? `${d.kind}_${skin}` : '';
      const tex = skinned && this.textures.exists(skinned) ? skinned : OBJECT_TEXTURE[d.kind] ?? d.kind;
      const img = this.add.image(d.tx * TILE + TILE / 2, d.ty * TILE + TILE - 2, tex).setOrigin(0.5, 1) as DecorObj;
      img.decor = d;
      img.hitsLeft = GATHER[d.kind]?.hits ?? 0;
      img.resting = false;
      img.gone = false;
      img.region = W.region[d.ty * W.w + d.tx];
      img.setDepth(img.y);
      if (d.kind === 'shell_pick' || d.kind === 'starfish_pick') img.setOrigin(0.5, 0.8).setDepth(img.y - 20);
      img.setInteractive({ useHandCursor: true });
      this.setBlocked(d, true);
      if (d.kind === 'campfire') this.animateCampfire(img);
      if (d.kind === 'crate') img.setScale(0.75);
      this.decorObjs.push(img);
    }

    // 가족이 놓은 장식
    this.placedObjs.clear();
    this.occupied.clear();
    for (const d of W.decor) this.occupied.add(`${d.tx},${d.ty}`);
    for (let oy = 0; oy <= 2; oy++) for (let ox = -1; ox <= 2; ox++) this.occupied.add(`${W.dock.tx + ox},${W.dock.ty + oy}`);
    for (const p of village.placedOn(this.islandIdx)) this.addPlaced(p, false);

    // 선착장 + 배
    const dk = W.dock;
    const dockImg = this.add.image(dk.tx * TILE + TILE / 2, (dk.ty + 2) * TILE + 4, 'dock').setOrigin(0.5, 1).setDepth((dk.ty + 1) * TILE - 30);
    dockImg.setInteractive({ useHandCursor: true });
    (dockImg as unknown as { isDock: boolean }).isDock = true;
    if (progress.hasBoat(this.islandIdx) || this.islandIdx > 0) this.showBoat(false);

    // 표지판 · 낚시터 · 구름
    if (this.textures.exists('clouds')) this.textures.remove('clouds');
    this.cloudTex = this.textures.createCanvas('clouds', W.w * CLOUD_PX, W.h * CLOUD_PX)!;
    this.add.image(0, 0, 'clouds').setOrigin(0).setScale(TILE / CLOUD_PX).setDepth(99980);
    this.refreshRegions(false);

    // 곰 가족
    const camp = { x: W.camp.tx * TILE + TILE / 2, y: (W.camp.ty + 2) * TILE + TILE / 2 };
    BEARS.forEach((b, i) => {
      const bear = new Bear(this, b.id, camp.x + (i - 1.5) * 26, camp.y + 30 + (i % 2) * 6, 45);
      this.bears.push(bear);
      this.npcTimers.set(bear, 1 + Math.random() * 3);
    });
    this.campPx = camp;
    village.joined().forEach((r) => this.spawnResident(r.id, false));
    this.placeFriend();

    const cam = this.cameras.main;
    cam.setZoom(WORLD_ZOOM);
    cam.setBounds(0, 0, W.w * TILE, W.h * TILE);
    cam.centerOn(camp.x, camp.y);
    cam.setBackgroundColor(COLORS.sea);
    cam.setRoundPixels(true);
    cam.fadeIn(500);

    this.input.on('pointerdown', this.onPointerDown, this);
    const ge = this.game.events;
    ge.on('choose-bear', this.choosePlayer, this);
    ge.on('unlock-region', this.onUnlockRegion, this);
    ge.on('build-boat', this.onBuildBoat, this);
    ge.on('travel', this.onTravel, this);
    ge.on('go-home', this.goHome, this);
    ge.on('emote', this.onEmote, this);
    village.on('resident-joined', this.onResidentJoined, this);
    village.on('remote', this.syncPlaced, this);
    family.on('presence', this.onPresence, this);
    family.on('status', this.sendPresence, this);
    progress.on('remote', this.onRemoteProgress, this);
    progress.on('treasure', this.refreshTreasure, this);
    this.events.once('shutdown', () => {
      ge.off('choose-bear', this.choosePlayer, this);
      ge.off('unlock-region', this.onUnlockRegion, this);
      ge.off('build-boat', this.onBuildBoat, this);
      ge.off('travel', this.onTravel, this);
      ge.off('go-home', this.goHome, this);
      ge.off('emote', this.onEmote, this);
      village.off('resident-joined', this.onResidentJoined, this);
      village.off('remote', this.syncPlaced, this);
      family.off('presence', this.onPresence, this);
      family.off('status', this.sendPresence, this);
      progress.off('remote', this.onRemoteProgress, this);
      progress.off('treasure', this.refreshTreasure, this);
      this.input.off('pointerdown', this.onPointerDown, this);
    });

    ge.emit('world-ready', this.islandIdx, W.regions.length);
    // 섬을 옮겨 왔으면 고른 곰으로 바로 시작
    const chosen = this.registry.get('bear') as BearId | undefined;
    if (chosen) this.choosePlayer(chosen);
  }

  // ───────────────────────── 지역 ─────────────────────────

  private regionAt(wx: number, wy: number) {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const W = this.world;
    if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return -1;
    return W.region[ty * W.w + tx];
  }

  private unlocked(r: number) {
    return r >= 0 && progress.isUnlocked(this.islandIdx, r);
  }

  /** 열 수 있는 지역 = 잠겨 있고 부모가 열린 지역 */
  private frontier(r: number) {
    const reg = this.world.regions[r];
    return !this.unlocked(r) && reg.parent >= 0 && this.unlocked(reg.parent);
  }

  /** 구름·표지판·낚시터·오브젝트 표시를 진행 상황에 맞추기 */
  private refreshRegions(animateRegion: number | false) {
    const W = this.world;
    // 구름 (캔버스에 직접 그려서 지역을 열 때도 끊김 없이)
    const ctx = this.cloudTex.getContext();
    const P = CLOUD_PX;
    ctx.clearRect(0, 0, W.w * P, W.h * P);
    const pass = (dy: number, color: (r: number) => string, rad: number) => {
      for (let y = 0; y < W.h; y++) {
        for (let x = 0; x < W.w; x++) {
          const r = W.region[y * W.w + x];
          if (this.unlocked(r) || r === animateRegion) continue;
          const hsh = (x * 73856093) ^ (y * 19349663);
          ctx.fillStyle = color(r);
          ctx.beginPath();
          ctx.arc(x * P + P / 2, y * P + P / 2 + dy, rad + (hsh & 1), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    pass(1.5, () => '#d9e6f2', 4.5);
    pass(0, (r) => (this.frontier(r) ? '#ffffff' : '#f4f7fb'), 4);
    this.cloudTex.refresh();

    // 오브젝트: 잠긴 지역은 숨겨서 그리기 부담 줄이기
    for (const o of this.decorObjs) if (!o.gone) o.setVisible(this.unlocked(o.region));

    // 표지판 (열 수 있는 지역에만)
    for (const reg of W.regions) {
      if (reg.idx === 0) continue;
      const show = this.frontier(reg.idx);
      const has = this.signs.get(reg.idx);
      if (show && !has) this.signs.set(reg.idx, this.makeSign(reg));
      if (!show && has) {
        has.destroy();
        this.signs.delete(reg.idx);
        this.blocked.delete(`${reg.signX},${reg.signY}`);
      }
    }

    // 낚시터 (열린 지역만)
    for (const s of W.fishing) {
      if (!this.unlocked(s.region) || this.spots.some((o) => o.spot === s)) continue;
      this.spots.push(this.makeSpot(s));
    }
  }

  private makeSign(reg: RegionInfo) {
    const x = reg.signX * TILE + TILE / 2;
    const y = reg.signY * TILE + TILE - 2;
    const img = this.add.image(0, 0, 'sign').setOrigin(0.5, 1).setScale(0.8);
    const emoji = this.add.text(0, -16, BIOME_INFO[reg.biome].emoji, { fontSize: '11px' }).setOrigin(0.5);
    const bang = this.add
      .text(0, -40, '!', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#e07a5f', padding: { x: 5, y: 1 } })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [img, emoji, bang]).setDepth(99982); // 구름 위에 보이도록
    // 컨테이너 터치 영역은 (크기/2)만큼 밀린 좌표계 → 표지판 그림(발밑 위 48px)을 덮도록
    c.setSize(36, 40).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(0, -28, 36, 50), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    (c as unknown as { signRegion: number }).signRegion = reg.idx;
    this.tweens.add({ targets: bang, y: -45, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.blocked.add(`${reg.signX},${reg.signY}`);
    return c;
  }

  private onUnlockRegion(island: number, r: number) {
    if (island !== this.islandIdx) return;
    progress.unlock(island, r);
    this.refreshRegions(false);
    // 구름 걷히는 연출: 지역 타일 곳곳에서 구름 조각이 흩어진다
    const W = this.world;
    let n = 0;
    for (let y = 0; y < W.h; y += 2) {
      for (let x = 0; x < W.w; x += 2) {
        if (W.region[y * W.w + x] !== r) continue;
        if (n++ % 3 === 0) this.time.delayedCall(Math.random() * 500, () => this.fx.puff.explode(2, x * TILE + TILE / 2, y * TILE + TILE / 2));
      }
    }
    sfx.pop();
    buzz(40);
    const reg = W.regions[r];
    this.cameras.main.shake(200, 0.002);
    this.time.delayedCall(300, () => this.fx.heart.explode(8, this.player?.x ?? 0, (this.player?.y ?? 0) - 30));
    this.game.events.emit('celebrate', `${BIOME_INFO[reg.biome].emoji} ${withJosa(reg.name, '이', '가')} 열렸어요!`);
    family.post(`${BIOME_INFO[reg.biome].emoji} ${ISLANDS[island].name}의 ${withJosa(reg.name, '을', '를')} 열었어요`);
    this.game.events.emit('world-ready', this.islandIdx, W.regions.length);
  }

  // ───────────────────────── 배 ─────────────────────────

  private showBoat(anim: boolean) {
    if (this.boatImg) return;
    const dk = this.world.dock;
    const x = dk.tx * TILE + TILE / 2 + 34;
    const y = (dk.ty + 2) * TILE + 10;
    const b = this.add.image(x, y, 'boat').setOrigin(0.5, 1).setDepth(y);
    b.setInteractive({ useHandCursor: true });
    (b as unknown as { isDock: boolean }).isDock = true;
    this.tweens.add({ targets: b, y: y + 2, angle: 1.5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (anim) {
      b.setScale(0);
      this.tweens.add({ targets: b, scale: 1, duration: 600, ease: 'Back.easeOut' });
      this.fx.sparkle.explode(12, x, y - 20);
    }
    this.boatImg = b;
  }

  private onBuildBoat(island: number) {
    if (island !== this.islandIdx) return;
    progress.buildBoat(island);
    this.showBoat(true);
    sfx.pop();
    buzz(40);
    this.game.events.emit('celebrate', '⛵ 배가 완성됐어요! 다음 섬으로 떠날 수 있어요');
    family.post(`⛵ ${ISLANDS[island].name}에서 배를 완성했어요`);
  }

  private onTravel(to: number) {
    if (to === this.islandIdx) return;
    const pl = this.player;
    const cam = this.cameras.main;
    // 곰이 배에 올라타 떠나는 연출
    if (pl && this.boatImg) {
      pl.sprite.setVisible(false);
      const side = this.add.image(this.boatImg.x, this.boatImg.y, 'boat_side').setOrigin(0.5, 1).setDepth(this.boatImg.y + 1);
      const rider = this.add.image(side.x + 4, side.y - 18, `${pl.id}_side`).setOrigin(0.5, 1).setDepth(side.depth + 1).setScale(0.8);
      this.boatImg.setVisible(false);
      cam.stopFollow();
      this.tweens.add({ targets: [side, rider], x: '+=260', duration: 1600, ease: 'Sine.easeIn' });
    }
    sfx.pop();
    this.game.events.emit('sailing', to);
    this.time.delayedCall(900, () => cam.fadeOut(700, 126, 200, 227));
    cam.once('camerafadeoutcomplete', () => {
      progress.setCurrent(to);
      this.scene.restart();
    });
  }

  /**
   * 길잡이: 다음에 가 볼 곳(가장 가까운 표지판, 다 열었으면 선착장)의 화면 좌표.
   * HUD가 화면 밖일 때 화살표로 알려준다.
   */
  guide(): { x: number; y: number; kind: 'sign' | 'dock' } | null {
    const pl = this.player;
    if (!pl || this.fishing) return null;
    let best: { x: number; y: number; kind: 'sign' | 'dock' } | null = null;
    let bd = Infinity;
    for (const c of this.signs.values()) {
      const d = Math.hypot(c.x - pl.x, c.y - pl.y);
      if (d < bd) {
        bd = d;
        best = { x: c.x, y: c.y - 20, kind: 'sign' };
      }
    }
    if (!best && !progress.hasBoat(this.islandIdx) && this.islandIdx < ISLANDS.length - 1) {
      const dk = this.world.dock;
      best = { x: dk.tx * TILE + TILE / 2, y: dk.ty * TILE, kind: 'dock' };
    }
    if (!best) return null;
    const cam = this.cameras.main;
    return { x: (best.x - cam.worldView.x) * cam.zoom, y: (best.y - cam.worldView.y) * cam.zoom, kind: best.kind };
  }

  /** 캠프로 돌아가기 (길을 잃었을 때) */
  private goHome() {
    const pl = this.player;
    if (!pl) return;
    if (this.fishing) this.endFishing(false);
    const c = this.world.camp;
    this.fx.puff.explode(6, pl.x, pl.y - 14);
    pl.target = null;
    this.pending = null;
    pl.x = c.tx * TILE + TILE / 2;
    pl.y = (c.ty + 3) * TILE;
    pl.face('front');
    pl.jump(140);
    this.sendPresence();
    this.time.delayedCall(60, () => this.fx.puff.explode(6, pl.x, pl.y - 14));
    sfx.pop();
  }

  // ───────────────────────── 연출 ─────────────────────────

  private makeFx() {
    const base = { emitting: false } as const;
    this.fx = {
      leaf: this.add.particles(0, 0, 'leaf', { ...base, speed: { min: 25, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 110, lifespan: 750, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, scale: 1.5 }),
      pebble: this.add.particles(0, 0, 'pebble', { ...base, speed: { min: 30, max: 65 }, angle: { min: 210, max: 330 }, gravityY: 200, lifespan: 480, scale: 1.5 }),
      sparkle: this.add.particles(0, 0, 'sparkle', { ...base, speed: { min: 10, max: 30 }, lifespan: 550, scale: { start: 1.5, end: 0 } }),
      ember: this.add.particles(0, 0, 'ember', { ...base, speed: { min: 15, max: 45 }, angle: { min: 240, max: 300 }, gravityY: -40, lifespan: 700, alpha: { start: 1, end: 0 } }),
      heart: this.add.particles(0, 0, 'heart', { ...base, speed: { min: 20, max: 50 }, angle: { min: 230, max: 310 }, gravityY: -20, lifespan: 900, alpha: { start: 1, end: 0 }, scale: { start: 1.2, end: 0.6 } }),
      dust: this.add.particles(0, 0, 'pebble', { ...base, speed: { min: 20, max: 50 }, lifespan: 500, scale: { start: 3, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xd9d4c7 }),
      splash: this.add.particles(0, 0, 'sparkle', { ...base, speed: { min: 20, max: 60 }, angle: { min: 220, max: 320 }, gravityY: 160, lifespan: 500, tint: 0xd9f5ff, scale: 1.3 }),
      puff: this.add.particles(0, 0, 'cloudpuff', { ...base, speed: { min: 10, max: 40 }, lifespan: 900, scale: { start: 1.6, end: 0.2 }, alpha: { start: 0.95, end: 0 } }),
    };
    Object.values(this.fx).forEach((e) => e.setDepth(99990));
  }

  private animateCampfire(img: Phaser.GameObjects.Image) {
    this.tweens.add({ targets: img, scaleY: 1.08, scaleX: 0.95, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 450, loop: true, callback: () => this.fx?.ember.explode(1, img.x + Phaser.Math.Between(-4, 4), img.y - 16) });
  }

  private toast(msg: string) {
    this.game.events.emit('toast', msg);
  }

  // ───────────────────────── 입력 ─────────────────────────

  private choosePlayer(id: BearId) {
    this.registry.set('bear', id);
    family.who = BEARS.find((b) => b.id === id)?.name ?? '가족';
    const bear = this.bears.find((b) => b.id === id)!;
    this.player = bear;
    bear.speed = PLAYER_SPEED;
    bear.target = null;
    bear.face('front');
    bear.jump(150);
    this.fx.heart.explode(4, bear.x, bear.y - 30);
    this.cameras.main.startFollow(bear.sprite, true, 0.12, 0.12, 0, 20);
    this.sendPresence();
    this.onPresence(family.others);
  }

  private onPointerDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (!this.player || this.registry.get('modal')) return;
    if (p.y < HUD_TOP_H || p.y > this.scale.height - HUD_BOTTOM_H) return;
    if (this.fishing) return this.onFishingTap();
    if (this.registry.get('view') === 'build') return this.onBuildTap(p, over);

    const pl = this.player;
    type Tagged = { treasure?: boolean; pedestal?: boolean; slime?: Slime; bear?: Bear; decor?: Decor; signRegion?: number; spot?: FishingSpot; isDock?: boolean };
    const tagged = over as unknown as (Phaser.GameObjects.GameObject & Tagged)[];

    const sign = tagged.find((o) => o.signRegion !== undefined);
    if (sign) {
      const reg = this.world.regions[sign.signRegion!];
      return this.walkTo(reg.signX * TILE + TILE / 2 + (pl.x < reg.signX * TILE ? -18 : 18), reg.signY * TILE + TILE - 1, { sign: reg.idx });
    }
    const dock = tagged.find((o) => o.isDock);
    if (dock) return this.walkTo(this.world.dock.tx * TILE + TILE / 2, this.world.dock.ty * TILE + TILE / 2, { dock: true });

    // 구름 위를 누르면: 열 수 있는 지역이면 퀘스트, 아니면 안내
    const r = this.regionAt(p.worldX, p.worldY);
    if (r >= 0 && !this.unlocked(r)) {
      if (this.frontier(r)) {
        this.game.events.emit('open-quest', this.islandIdx, this.world.regions[r]);
      } else {
        this.toast('☁️ 먼저 옆 지역을 열어야 해요');
      }
      sfx.tap();
      return;
    }

    const bearHit = tagged.map((o) => o.bear).find((b) => b && b !== pl);
    const spotHit = tagged.find((o) => o.spot && (o as unknown as SpotObj).active) as unknown as SpotObj | undefined;
    const decorHit = tagged.find((o) => o.decor && !(o as unknown as DecorObj).gone && (o as unknown as DecorObj).visible) as unknown as DecorObj | undefined;

    const slimeHit = tagged.map((o) => o.slime).find((s) => s && !s.dead);
    const chest = this.chest;
    if (chest && tagged.some((o) => o.treasure)) {
      const side = pl.x <= chest.x ? -1 : 1;
      this.walkTo(chest.x + side * 24, chest.y - 1, { treasure: true });
    } else if (this.pedestal && tagged.some((o) => o.pedestal)) {
      const side = pl.x <= this.pedestal.x ? -1 : 1;
      this.walkTo(this.pedestal.x + side * 20, this.pedestal.y - 1, { pedestal: true });
    } else if (slimeHit) {
      const side = pl.x <= slimeHit.x ? -1 : 1;
      this.walkTo(slimeHit.x + side * 18, slimeHit.y, { slime: slimeHit });
    } else if (bearHit) {
      const side = pl.x <= bearHit.x ? -1 : 1;
      this.walkTo(bearHit.x + side * 22, bearHit.y, { bear: bearHit });
    } else if (spotHit) {
      const stand = this.shoreStand(spotHit.spot);
      if (stand) this.walkTo(stand.x, stand.y, { spot: spotHit });
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
    this.sendPresence();
    this.showTapMarker(x, y);
    sfx.tap();
    this.game.events.emit('player-moved');
  }

  private showTapMarker(x: number, y: number) {
    const ring = this.add.ellipse(x, y, 16, 8).setStrokeStyle(1.5, COLORS.white, 0.9).setDepth(-500);
    this.tweens.add({ targets: ring, scale: { from: 0.3, to: 1.5 }, alpha: { from: 1, to: 0 }, duration: 400, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  private setBlocked(d: Decor, on: boolean) {
    if (!BLOCKING.has(d.kind)) return;
    const keys = [`${d.tx},${d.ty}`];
    if (d.kind === 'tent') keys.push(`${d.tx - 1},${d.ty}`);
    for (const k of keys) on ? this.blocked.add(k) : this.blocked.delete(k);
  }

  private walkable = (wx: number, wy: number) => {
    const W = this.world;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return false;
    if (W.terrain[ty][tx] === T_SEA) return false;
    if (!this.unlocked(W.region[ty * W.w + tx])) return false;
    return !this.blocked.has(`${tx},${ty}`);
  };

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
            this.fx.dust.explode(1, bear.x, bear.y - 1);
            this.stepTimer = 0.26;
          }
        }
        if (arrived && this.pending) this.interact(this.pending);
        if (arrived) {
          this.pending = null;
          this.sendPresence();
        }
      } else if (!bear.remote && !bear.wild) {
        this.updateNpc(bear, dt);
      }
    }
    if (this.player) {
      const r = this.regionAt(this.player.x, this.player.y);
      if (r !== this.curRegion && r >= 0) {
        this.curRegion = r;
        this.game.events.emit('region-enter', this.world.regions[r]);
      }
    }
    if (this.fishing) this.updateFishing(dt);
    this.updateSlimes(dt);
    // 내 위치를 가끔 다시 알린다 (걷는 중엔 2초, 서 있을 땐 30초마다 — 접속 중이라는 신호)
    this.presenceTimer -= dt;
    if (this.presenceTimer <= 0 && this.player) this.sendPresence();
  }

  private updateNpc(bear: Bear, dt: number) {
    if (bear.moving) return;
    const t = (this.npcTimers.get(bear) ?? 0) - dt;
    this.npcTimers.set(bear, t);
    if (t > 0) return;
    this.npcTimers.set(bear, 2 + Math.random() * 4);
    const c = this.world.camp;
    for (let i = 0; i < 8; i++) {
      const x = c.tx * TILE + Phaser.Math.Between(-100, 100);
      const y = (c.ty + 2) * TILE + Phaser.Math.Between(-30, 90);
      if (this.walkable(x, y)) {
        bear.target = { x, y };
        return;
      }
    }
  }

  // ───────────────────────── 상호작용 ─────────────────────────

  private interact(hit: Hit) {
    const pl = this.player!;
    if (hit.sign !== undefined) {
      pl.face('back');
      return this.game.events.emit('open-quest', this.islandIdx, this.world.regions[hit.sign]);
    }
    if (hit.dock) {
      pl.face('front');
      return this.game.events.emit('open-boat', this.islandIdx);
    }
    if (hit.spot) return this.startFishing(hit.spot);
    if (hit.pedestal) return this.game.events.emit('open-treasures');
    buzz(15);
    if (hit.treasure) return this.openTreasure();
    if (hit.slime) return this.bopSlime(hit.slime);
    if (hit.bear) {
      const other = hit.bear;
      other.target = null;
      other.face('side', other.x > pl.x);
      pl.face('side', pl.x > other.x);
      if (other.wild) {
        other.jump(90);
        sfx.pop();
        this.game.events.emit('open-friend', other.id);
        return;
      }
      if (other.resident) {
        // 주민: 부탁 듣기
        other.jump(90);
        sfx.pop();
        this.npcTimers.set(other, 6);
        this.game.events.emit('open-order', other.id);
        return;
      }
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
    // 돌 곡괭이가 있으면 돌을 두 배로 빨리 캔다
    obj.hitsLeft -= rule.feel === 'stony' && inventory.get('stone_pickaxe') > 0 ? 2 : 1;
    const drops = rollDrops(rule.perHit);
    if (drops.length === 0 && rule.perHit.length > 0) drops.push(Phaser.Utils.Array.GetRandom(rule.perHit)[0]);
    // 바구니가 있으면 나무·덤불에서 하나 더
    if (rule.feel === 'leafy' && rule.perHit.length > 0 && inventory.get('basket') > 0 && Math.random() < 0.6) {
      drops.push(Phaser.Utils.Array.GetRandom(rule.perHit)[0]);
    }
    if (obj.hitsLeft <= 0) {
      drops.push(...rollDrops(rule.final));
      this.deplete(obj, rule.deplete, rule.regrowSec);
    }
    drops.forEach((id, i) => this.time.delayedCall(i * 90, () => this.spawnDrop(id, obj.x, obj.y - Math.min(obj.height * 0.5, 18), obj.y)));
  }

  // ───────────────────────── 섬 보물 ─────────────────────────

  /** 가장 깊은 지역 한가운데에 보물 상자를, 캠프 옆에 전시대를 놓는다 (섬마다 늘 같은 자리) */
  private placeTreasure() {
    const W = this.world;
    this.opening = false;
    const deep = W.regions.reduce((a, r) => (r.depth >= a.depth ? r : a), W.regions[0]);
    this.chestRegion = deep.idx;
    const best = this.freeTile(deep.idx);
    this.chest = undefined;
    if (best) {
      const img = this.add.image(best.tx * TILE + TILE / 2, best.ty * TILE + TILE - 2, 'chest').setOrigin(0.5, 1);
      img.setDepth(img.y).setInteractive({ useHandCursor: true });
      (img as unknown as { treasure: boolean }).treasure = true;
      this.blocked.add(`${best.tx},${best.ty}`);
      this.chest = img;
      // 아직 못 찾은 보물은 가끔 반짝인다
      this.time.addEvent({
        delay: 1400,
        loop: true,
        callback: () => {
          if (!progress.hasTreasure(this.islandIdx) && this.unlocked(this.chestRegion)) this.fx.sparkle.explode(2, img.x + Phaser.Math.Between(-10, 10), img.y - 14);
        },
      });
    }
    // 캠프 전시대
    const px = (W.camp.tx - 3) * TILE + TILE / 2;
    const py = W.camp.ty * TILE + TILE - 2;
    this.pedestal = this.add.image(px, py, 'pedestal').setOrigin(0.5, 1);
    this.pedestal.setDepth(py).setInteractive({ useHandCursor: true });
    (this.pedestal as unknown as { pedestal: boolean }).pedestal = true;
    this.blocked.add(`${W.camp.tx - 3},${W.camp.ty}`);
    this.pedestalItem = this.add.image(px, py - 14, treasureKey(this.islandIdx)).setOrigin(0.5, 1).setDepth(py + 1);
    this.tweens.add({ targets: this.pedestalItem, y: py - 17, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.refreshTreasure();
  }

  /** 지역 한가운데에서 가장 가까운 빈 땅 (사방이 같은 지역의 땅이라 곰이 옆에 설 수 있는 칸) */
  private freeTile(region: number): { tx: number; ty: number } | null {
    const W = this.world;
    const reg = W.regions[region];
    const taken = new Set(W.decor.map((d) => `${d.tx},${d.ty}`));
    for (const r of W.regions) taken.add(`${r.signX},${r.signY}`);
    for (const f of W.fishing) taken.add(`${f.tx},${f.ty}`);
    const inside = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < W.w && y < W.h && W.region[y * W.w + x] === region && W.terrain[y][x] !== T_SEA;
    let best: { tx: number; ty: number } | null = null;
    let bestD = Infinity;
    for (let y = 1; y < W.h - 1; y++) {
      for (let x = 1; x < W.w - 1; x++) {
        if (!inside(x, y) || taken.has(`${x},${y}`) || this.blocked.has(`${x},${y}`)) continue;
        if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) continue;
        const d = Math.hypot(x - reg.sx, y - reg.sy);
        if (d < bestD) {
          bestD = d;
          best = { tx: x, ty: y };
        }
      }
    }
    return best;
  }

  // ───────────────────────── 섬 친구 ─────────────────────────

  /** 이 섬에 사는 친구가 아직 이사 오지 않았으면, 자기 지역(섬 중간쯤)에 세워 둔다 */
  private placeFriend() {
    const r = RESIDENTS.find((v) => v.island === this.islandIdx);
    if (!r || village.isJoined(r.id)) return;
    const W = this.world;
    const maxDepth = Math.max(...W.regions.map((g) => g.depth));
    const want = Math.max(1, Math.round(maxDepth / 2));
    const home = W.regions.find((g) => g.depth === want && g.idx !== this.chestRegion) ?? W.regions.find((g) => g.depth >= 1 && g.idx !== this.chestRegion);
    const t = home && this.freeTile(home.idx);
    if (!home || !t) return;
    const b = new Bear(this, r.id, t.tx * TILE + TILE / 2, t.ty * TILE + TILE - 4, 38);
    b.wild = true;
    this.bears.push(b);
    // 가까이 가면 말을 건다
    this.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => {
        const pl = this.player;
        if (!b.wild || !pl || !this.unlocked(home.idx)) return;
        if (Math.hypot(pl.x - b.x, pl.y - b.y) < 260) b.emote('❗');
      },
    });
  }

  /** 찾았는지에 맞춰 상자와 전시대 모습을 바꾼다 */
  private refreshTreasure() {
    const found = progress.hasTreasure(this.islandIdx);
    if (this.chest && !this.opening) this.chest.setTexture(found ? 'chest_open' : 'chest');
    // 못 찾은 보물은 까만 그림자로만 보인다
    if (this.pedestalItem) {
      if (found) this.pedestalItem.clearTint().setAlpha(1);
      else this.pedestalItem.setTintFill(0x5b4a3a).setAlpha(0.35);
    }
  }

  private openTreasure() {
    const chest = this.chest;
    const pl = this.player;
    if (!chest || !pl || this.opening) return;
    pl.face('side', chest.x < pl.x);
    if (progress.hasTreasure(this.islandIdx)) {
      this.toast(`✨ ${TREASURES[this.islandIdx].name}이(가) 들어 있던 상자예요`);
      return;
    }
    this.opening = true;
    const island = this.islandIdx;
    sfx.rustle();
    this.tweens.add({
      targets: chest,
      angle: { from: -5, to: 5 },
      duration: 70,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        chest.setAngle(0).setTexture('chest_open');
        sfx.fanfare();
        buzz(60);
        this.fx.sparkle.explode(18, chest.x, chest.y - 16);
        const icon = this.add.image(chest.x, chest.y - 18, treasureKey(island)).setOrigin(0.5, 1).setDepth(99990).setScale(0);
        this.tweens.add({ targets: icon, y: chest.y - 46, scale: 1.6, duration: 600, ease: 'Back.easeOut' });
        this.tweens.add({ targets: icon, alpha: 0, scale: 0.6, delay: 2400, duration: 400, onComplete: () => icon.destroy() });
        pl.jump(140);
        this.opening = false;
        progress.findTreasure(island);
        this.game.events.emit('treasure-found', island);
      },
    });
  }

  // ───────────────────────── 사냥 (슬라임) ─────────────────────────

  /** 슬라임은 내 곰 근처의 열린 지역(캠프 제외)에 조금씩 나타난다. 기기마다 따로 보인다 */
  private updateSlimes(dt: number) {
    const pl = this.player;
    for (const s of this.slimes) s.update(dt, this.walkable);
    if (!pl) return;
    // 너무 멀어진 슬라임은 조용히 치운다
    this.slimes = this.slimes.filter((s) => {
      if (s.dead) return false;
      if (Math.hypot(s.x - pl.x, s.y - pl.y) > 620) {
        s.destroy();
        return false;
      }
      return true;
    });
    this.slimeTimer -= dt;
    if (this.slimeTimer > 0) return;
    this.slimeTimer = 5 + Math.random() * 4;
    if (this.slimes.length >= SLIME_MAX) return;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 130 + Math.random() * 220;
      const x = pl.x + Math.cos(a) * d;
      const y = pl.y + Math.sin(a) * d;
      const r = this.regionAt(x, y);
      if (r <= 0 || !this.walkable(x, y)) continue;
      if (Math.hypot(x - this.campPx.x, y - this.campPx.y) < 150) continue;
      const king = Math.random() < 0.06;
      this.slimes.push(new Slime(this, x, y, king, SLIME_KIND[this.world.regions[r].biome] ?? ''));
      this.fx.puff.explode(3, x, y - 6);
      return;
    }
  }

  private bopSlime(s: Slime) {
    const pl = this.player!;
    if (s.dead) return;
    // 슬라임이 그새 뛰어갔으면 다시 따라간다
    if (Math.hypot(s.x - pl.x, s.y - pl.y) > 34) {
      const side = pl.x <= s.x ? -1 : 1;
      return this.walkTo(s.x + side * 18, s.y, { slime: s });
    }
    const now = this.time.now;
    if (now - this.lastHit < 220) return;
    this.lastHit = now;
    pl.face('side', s.x < pl.x);
    pl.jump(70);
    sfx.boing();
    this.fx.splash.explode(6, s.x, s.y - 8);
    s.bop(pl.x, pl.y, this.walkable);
    if (s.hp > 0) {
      if (!this.slimeTip) {
        this.slimeTip = true;
        this.toast('💚 한 번 더 톡!');
      }
      return;
    }
    const n = s.king ? Phaser.Math.Between(4, 5) : Phaser.Math.Between(1, 2);
    for (let i = 0; i < n; i++) this.time.delayedCall(i * 90, () => this.spawnDrop('jelly', s.x, s.y - 10, s.y));
    this.fx.sparkle.explode(s.king ? 14 : 6, s.x, s.y - 8);
    sfx.pop();
    buzz(s.king ? 40 : 20);
    s.pop();
    if (s.king) {
      this.toast('👑 왕슬라임을 잡았어요!');
      family.post('👑 왕슬라임을 잡았어요');
    }
  }

  private pokeOnly(obj: DecorObj) {
    const kind = obj.decor.kind;
    sfx.pop();
    if (kind === 'campfire') {
      this.fx.ember.explode(10, obj.x, obj.y - 14);
      return;
    }
    if (kind === 'crate') return this.game.events.emit('open-boat', this.islandIdx);
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

  // ───────────────────────── 꾸미기 · 주민 ─────────────────────────

  // ───────────────────────── 다른 가족 곰 ─────────────────────────

  /** 내 곰 머리 위에 말풍선을 띄우고 가족에게도 보낸다 */
  private onEmote(emoji: string) {
    const pl = this.player;
    if (!pl) return;
    pl.emote(emoji);
    sfx.pop();
    this.myEmote = { e: emoji, et: Date.now() };
    this.sendPresence();
  }

  private sendPresence() {
    const pl = this.player;
    if (!pl || !family.active) return;
    this.presenceTimer = pl.moving ? 2 : 30;
    family.setPresence({ bear: pl.id, island: this.islandIdx, x: pl.x, y: pl.y, tx: pl.target?.x ?? pl.x, ty: pl.target?.y ?? pl.y, ...(this.myEmote ?? {}) });
  }

  /** 같은 섬에 있는 다른 가족의 곰을 보여 주고, 그쪽이 누른 곳으로 걸어가게 한다 */
  private onPresence(others: Record<string, Presence>) {
    if (!this.player) return; // 곰을 고르기 전에는 가족 곰이 모두 캠프에 있다
    const here = Object.entries(others).filter(([, p]) => p.island === this.islandIdx && BEARS.some((b) => b.id === p.bear));
    // 나간 가족 지우기
    for (const [dev, bear] of [...this.remotes]) {
      const p = others[dev];
      if (p && p.island === this.islandIdx && p.bear === bear.id) continue;
      this.fx.puff.explode(5, bear.x, bear.y - 14);
      bear.destroy();
      this.remotes.delete(dev);
      this.bears.splice(this.bears.indexOf(bear), 1);
    }
    for (const [dev, p] of here) {
      let bear = this.remotes.get(dev);
      if (!bear) {
        bear = new Bear(this, p.bear, p.x, p.y, PLAYER_SPEED);
        bear.remote = dev;
        bear.label = this.add
          .text(p.x, p.y, BEARS.find((b) => b.id === p.bear)?.name ?? '', { fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff', fontStyle: 'bold', stroke: '#4a3b2a', strokeThickness: 3 })
          .setOrigin(0.5, 1);
        this.remotes.set(dev, bear);
        this.bears.push(bear);
        this.fx.puff.explode(5, p.x, p.y - 14);
      }
      // 너무 멀리 어긋났으면 바로 옮기고, 아니면 목적지로 걸어가게
      if (Math.hypot(bear.x - p.x, bear.y - p.y) > 120) {
        bear.x = p.x;
        bear.y = p.y;
      }
      bear.target = Math.hypot(p.tx - bear.x, p.ty - bear.y) > 2 ? { x: p.tx, y: p.ty } : null;
      // 새 말풍선 (방금 보낸 것만 — 뒤늦게 들어와서 옛 말풍선을 보지 않게)
      if (p.e && p.et && p.et > bear.emoteAt) {
        const first = bear.emoteAt === 0;
        bear.emoteAt = p.et;
        if (!first || Date.now() - p.et < 5000) {
          bear.emote(p.e);
          sfx.pop();
        }
      }
    }
    // 다른 가족이 조종 중인 곰과 같은 곰은 캠프에서 숨긴다 (아빠 곰이 둘이 되지 않게)
    const taken = new Set(here.map(([, p]) => p.bear));
    for (const b of this.bears) {
      if (b.remote || b.resident || b.wild || b === this.player) continue;
      b.sprite.setVisible(!taken.has(b.id));
    }
  }

  /** 다른 가족이 지역을 열거나 배를 만들었을 때 화면 맞추기 */
  private onRemoteProgress() {
    if (!progress.canVisit(this.islandIdx)) {
      // 다른 가족 섬에 들어가서 이 섬에 올 수 없게 됐다 → 첫 섬에서 다시 시작
      this.scene.restart();
      return;
    }
    this.refreshRegions(false);
    this.refreshTreasure();
    if (progress.hasBoat(this.islandIdx)) this.showBoat(true);
    this.game.events.emit('world-ready', this.islandIdx, this.world.regions.length);
  }

  /** 다른 가족이 놓거나 치운 장식을 화면에 맞추기 */
  private syncPlaced() {
    const want = new Map(village.placedOn(this.islandIdx).map((p) => [`${p.tx},${p.ty}`, p]));
    for (const [key, img] of [...this.placedObjs]) {
      const cur = (img as unknown as { placed: Placed }).placed;
      if (want.get(key)?.id === cur.id) continue;
      this.placedObjs.delete(key);
      this.blocked.delete(key);
      img.destroy();
    }
    for (const [key, p] of want) if (!this.placedObjs.has(key)) this.addPlaced(p, true);
  }

  private addPlaced(p: Placed, anim: boolean) {
    const key = `${p.tx},${p.ty}`;
    const img = this.add.image(p.tx * TILE + TILE / 2, p.ty * TILE + TILE - 1, itemKey(p.id)).setOrigin(0.5, 1).setScale(1.5);
    img.setDepth(img.y);
    img.setInteractive({ useHandCursor: true });
    (img as unknown as { placed: Placed }).placed = p;
    this.placedObjs.set(key, img);
    if (DECOR_BLOCKING.has(p.id)) this.blocked.add(key);
    if (anim) {
      img.setScale(0);
      this.tweens.add({ targets: img, scale: 1.5, duration: 380, ease: 'Back.easeOut' });
      this.fx.sparkle.explode(8, img.x, img.y - 14);
    }
  }

  /** 꾸미기 모드에서 땅을 눌렀을 때: 놓인 물건이면 다시 창고로, 빈 땅이면 고른 물건 놓기 */
  private onBuildTap(p: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[]) {
    const W = this.world;
    const tx = Math.floor(p.worldX / TILE);
    const ty = Math.floor(p.worldY / TILE);
    const key = `${tx},${ty}`;
    // 그림이 아니라 "누른 칸" 기준으로 판단한다 (울타리를 나란히 놓을 때 옆 칸 물건이 집히지 않게)
    const img = this.placedObjs.get(key);
    if (img) {
      const pl = (img as unknown as { placed: Placed }).placed;
      village.remove(this.islandIdx, tx, ty);
      this.placedObjs.delete(key);
      this.blocked.delete(key);
      inventory.add(pl.id, 1);
      sfx.pop();
      img.disableInteractive();
      this.tweens.add({ targets: img, scale: 0, y: img.y - 10, duration: 200, ease: 'Back.easeIn', onComplete: () => img.destroy() });
      return;
    }
    const id = this.registry.get('buildItem') as ItemId | undefined;
    if (!id || inventory.get(id) <= 0) {
      this.toast('아래에서 놓을 물건을 먼저 골라요');
      return;
    }
    const inside = tx >= 0 && ty >= 0 && tx < W.w && ty < W.h;
    const bearHere = this.bears.some((b) => Math.floor(b.x / TILE) === tx && Math.floor((b.y - 1) / TILE) === ty);
    const ok =
      inside &&
      W.terrain[ty][tx] !== T_SEA &&
      this.unlocked(W.region[ty * W.w + tx]) &&
      !this.blocked.has(key) &&
      !this.occupied.has(key) &&
      !this.placedObjs.has(key) &&
      !bearHere;
    if (!ok) {
      buzz(20);
      this.toast('여기는 놓을 수 없어요');
      return;
    }
    const placed: Placed = { id, tx, ty };
    inventory.add(id, -1);
    this.addPlaced(placed, true);
    sfx.merge();
    buzz(20);
    const cam = this.cameras.main;
    this.game.events.emit('float', `⭐ +${DECOR_POINTS[id] ?? 0}`, (p.worldX - cam.worldView.x) * cam.zoom, (p.worldY - 30 - cam.worldView.y) * cam.zoom);
    village.place(this.islandIdx, placed); // 점수가 넘으면 'resident-joined'
  }

  private spawnResident(id: string, anim: boolean) {
    let x = this.campPx.x;
    let y = this.campPx.y + 50;
    for (let i = 0; i < 12; i++) {
      const cx = this.campPx.x + Phaser.Math.Between(-110, 110);
      const cy = this.campPx.y + Phaser.Math.Between(20, 110);
      if (this.walkable(cx, cy)) {
        x = cx;
        y = cy;
        break;
      }
    }
    const b = new Bear(this, id, x, y, 38);
    b.resident = true;
    this.bears.push(b);
    this.npcTimers.set(b, 1 + Math.random() * 4);
    if (anim) {
      this.fx.puff.explode(8, x, y - 14);
      this.fx.heart.explode(5, x, y - 30);
      b.jump(160);
    }
    return b;
  }

  private onResidentJoined(id: string) {
    const r = RESIDENTS.find((v) => v.id === id);
    if (!r) return;
    if (this.bears.some((b) => b.resident && b.id === id)) return;
    // 이 섬에 서 있던 친구라면 짐을 싸서 캠프로 간다
    const wild = this.bears.find((b) => b.wild && b.id === id);
    if (wild) {
      this.fx.heart.explode(8, wild.x, wild.y - 30);
      this.fx.puff.explode(8, wild.x, wild.y - 14);
      this.bears = this.bears.filter((b) => b !== wild);
      wild.wild = false;
      wild.destroy();
    }
    this.spawnResident(id, true);
    sfx.fanfare();
    this.game.events.emit('celebrate', `🏠 ${withJosa(r.name, '이', '가')} 우리 마을로 이사 왔어요!\n캠프에서 만나 봐요`);
  }

  // ───────────────────────── 낚시 ─────────────────────────

  private makeSpot(s: FishingSpot): SpotObj {
    const x = s.tx * TILE + TILE / 2;
    const y = s.ty * TILE + TILE / 2;
    const shadow = this.add.ellipse(0, 2, 14, 6, 0x2a6f8a, 0.45);
    const r1 = this.add.ellipse(0, 0, 10, 5).setStrokeStyle(1, 0xffffff, 0.9);
    const r2 = this.add.ellipse(0, 0, 10, 5).setStrokeStyle(1, 0xffffff, 0.9);
    const c = this.add.container(x, y, [shadow, r1, r2]).setDepth(-800) as SpotObj;
    c.spot = s;
    c.active = true;
    c.setSize(TILE * 1.4, TILE * 1.2).setInteractive({ useHandCursor: true });
    (c as unknown as { spot: FishingSpot }).spot = s;
    this.tweens.add({ targets: r1, scale: { from: 0.6, to: 2.2 }, alpha: { from: 1, to: 0 }, duration: 1400, repeat: -1 });
    this.tweens.add({ targets: r2, scale: { from: 0.6, to: 2.2 }, alpha: { from: 1, to: 0 }, duration: 1400, repeat: -1, delay: 700 });
    this.tweens.add({ targets: shadow, x: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }

  /** 낚시터 옆에 설 수 있는 땅 (플레이어와 가장 가까운) */
  private shoreStand(s: FishingSpot): { x: number; y: number } | null {
    const pl = this.player!;
    let best = null as { x: number; y: number } | null;
    let bd = Infinity;
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const x = (s.tx + ox) * TILE + TILE / 2;
        const y = (s.ty + oy) * TILE + TILE / 2;
        if (!this.walkable(x, y)) continue;
        const d = Math.hypot(x - pl.x, y - pl.y) + Math.hypot(ox, oy) * 30;
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    }
    if (!best) this.toast('여기서는 낚시하기 어려워요');
    return best;
  }

  private startFishing(spot: SpotObj) {
    if (!spot.active) return;
    const pl = this.player!;
    const sx = spot.x;
    const sy = spot.y;
    const dx = sx - pl.x;
    const dy = sy - pl.y;
    if (Math.abs(dx) > Math.abs(dy)) pl.face('side', dx < 0);
    else pl.face(dy < 0 ? 'back' : 'front');
    sfx.rustle();
    const bobber = this.add.image(pl.x, pl.y - 20, 'bobber').setDepth(-700);
    const t = { v: 0 };
    const fx = pl.x;
    const fy = pl.y - 20;
    this.tweens.add({
      targets: t,
      v: 1,
      duration: 450,
      onUpdate: () => {
        bobber.x = fx + (sx - fx) * t.v;
        bobber.y = fy + (sy - fy) * t.v - Math.sin(t.v * Math.PI) * 30;
      },
      onComplete: () => {
        this.fx.splash.explode(5, sx, sy);
        sfx.step();
        this.tweens.add({ targets: bobber, y: sy + 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
    this.fishing = { spot, phase: 'wait', t: 1.6 + Math.random() * 2.4, bobber };
    this.game.events.emit('fishing', true);
    this.toast('🎣 느낌표(!)가 뜨면 화면을 톡!');
  }

  private updateFishing(dt: number) {
    const f = this.fishing!;
    f.t -= dt;
    if (f.phase === 'wait') {
      // 가끔 톡톡 건드리는 입질
      if (Math.random() < dt * 1.2) this.tweens.add({ targets: f.bobber, y: f.bobber.y + 2, duration: 80, yoyo: true });
      if (f.t <= 0) {
        f.phase = 'bite';
        f.t = inventory.get('rod') > 0 ? 2.2 : 1.4; // 아이들도 누를 수 있게 넉넉히 (낚싯대가 있으면 더 길게)
        this.tweens.killTweensOf(f.bobber);
        this.tweens.add({ targets: f.bobber, y: f.spot.y + 4, duration: 120, yoyo: true, repeat: -1 });
        this.fx.splash.explode(8, f.spot.x, f.spot.y);
        const pl = this.player!;
        f.mark = this.add
          .text(pl.x, pl.y - 46, '!', { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold', stroke: '#e07a5f', strokeThickness: 5 })
          .setOrigin(0.5)
          .setDepth(99995);
        this.tweens.add({ targets: f.mark, scale: { from: 0.3, to: 1.2 }, duration: 160, ease: 'Back.easeOut' });
        sfx.pop();
        buzz(60);
      }
    } else if (f.t <= 0) {
      this.endFishing(false, '앗, 물고기가 도망갔어요 🐟');
    }
  }

  private onFishingTap() {
    const f = this.fishing!;
    if (f.phase === 'bite') this.endFishing(true);
    else this.endFishing(false, '너무 빨랐어요! 다시 해 봐요');
  }

  private endFishing(caught: boolean, msg?: string) {
    const f = this.fishing!;
    this.fishing = null;
    this.game.events.emit('fishing', false);
    f.mark?.destroy();
    this.tweens.killTweensOf(f.bobber);
    this.tweens.add({ targets: f.bobber, x: this.player!.x, y: this.player!.y - 20, alpha: 0, duration: 250, onComplete: () => f.bobber.destroy() });
    if (!caught) {
      if (msg) this.toast(msg);
      return;
    }
    const biome = this.world.regions[f.spot.spot.region].biome;
    const hasRod = inventory.get('rod') > 0;
    // 낚싯대가 있으면 꽝(장화)이 안 나오고 황금 물고기가 잘 나온다
    const table = BIOME_INFO[biome].fish
      .filter(([id]) => !(hasRod && id === 'boot'))
      .map(([id, w]) => [id, hasRod && id === 'fish_gold' ? w * 3 : w] as [ItemId, number]);
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let item: ItemId = table[0][0];
    for (const [id, w] of table) {
      r -= w;
      if (r <= 0) {
        item = id;
        break;
      }
    }
    this.fx.splash.explode(14, f.spot.x, f.spot.y);
    buzz(30);
    this.spawnDrop(item, f.spot.x, f.spot.y, this.player!.y + 6);
    if (item === 'fish_gold') {
      this.game.events.emit('celebrate', '✨ 황금 물고기를 낚았어요!');
      family.post('✨ 황금 물고기를 낚았어요');
    }
    else if (item === 'boot') this.toast('👢 앗, 낡은 장화예요…');
    // 낚시터는 잠깐 쉬었다가 다시 생김
    f.spot.active = false;
    this.tweens.add({ targets: f.spot, alpha: 0, duration: 400 });
    this.time.delayedCall(40000, () => {
      f.spot.active = true;
      this.tweens.add({ targets: f.spot, alpha: 1, duration: 600 });
    });
  }

  // ───────────────────────── 아이템 ─────────────────────────

  /** 아이템이 톡 튀어나와 바닥에 떨어진 뒤 → 곰에게 빨려와 → 창고로 */
  private spawnDrop(id: ItemId, sx: number, sy: number, groundY: number) {
    const ex = sx + Phaser.Math.Between(-22, 22);
    const ey = groundY + Phaser.Math.Between(4, 14);
    const icon = this.add.image(sx, sy, itemKey(id)).setDepth(99985).setScale(0.6);
    const peak = Math.min(sy, ey) - 26;
    const t = { v: 0 };
    this.tweens.add({
      targets: t,
      v: 1,
      duration: 420,
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
        const cam = this.cameras.main;
        this.game.events.emit('item-gained', id, (pl.x - cam.worldView.x) * cam.zoom, (pl.y - 30 - cam.worldView.y) * cam.zoom);
      },
    });
  }
}

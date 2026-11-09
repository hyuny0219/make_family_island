import Phaser from 'phaser';
import { COLORS } from '../config';
import { sfx, unlockAudio, buzz, refreshMusic } from '../sfx';
import { BEARS } from '../data/assets';
import { ITEMS, ITEM_IDS, itemKey, type ItemId } from '../data/items';
import { inventory } from '../state/inventory';
import { progress } from '../state/progress';
import { withJosa } from '../util/korean';
import { ISLANDS } from '../data/islands';
import { BIOME_INFO } from '../data/biomes';
import type { RegionInfo } from '../world/generate';
import { settings, setSetting, resetAll } from '../state/settings';
import { village } from '../state/village';
import { family, type FeedItem, type SyncStatus } from '../sync/family';
import { localDoc } from '../sync/bridge';
import { DECOR_POINTS, ORDER_GIFTS, RESIDENTS, TROPHY_HEARTS, isPlaceable } from '../data/village';
import type { IslandScene } from './IslandScene';

export const HUD_TOP_H = 96;
export const HUD_BOTTOM_H = 76;

const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

type View = 'explore' | 'merge' | 'build';
type Tab = { key: string; icon: string; label: string; enabled: boolean };
const TABS: Tab[] = [
  { key: 'explore', icon: '🗺️', label: '탐험', enabled: true },
  { key: 'merge', icon: '🧩', label: '머지', enabled: true },
  { key: 'build', icon: '🏝️', label: '꾸미기', enabled: true },
];

/** 화면 고정 UI: 상단 섬 이름, 하단 탭, 안내 문구, 타이틀 */
export class HudScene extends Phaser.Scene {
  private hint?: Phaser.GameObjects.Container;
  private bagCount!: Phaser.GameObjects.Text;
  private bagBtn!: Phaser.GameObjects.Container;
  private strip?: Phaser.GameObjects.Container;
  private topText!: Phaser.GameObjects.Text;
  private topBg!: Phaser.GameObjects.Graphics;
  private topBtn!: Phaser.GameObjects.Container;
  private banner?: Phaser.GameObjects.Container;
  private view: View = 'explore';
  private buildTray?: Phaser.GameObjects.Container;
  private feedBtn!: Phaser.GameObjects.Container;
  private emoteRow?: Phaser.GameObjects.Container;
  private tabNodes: { key: string; c: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; enabled: boolean }[] = [];
  private sideBtns: Phaser.GameObjects.Container[] = [];
  private arrow!: Phaser.GameObjects.Container;
  private arrowTip!: Phaser.GameObjects.Container;
  private arrowIcon!: Phaser.GameObjects.Text;
  private sail?: Phaser.GameObjects.Container;
  private slotPos = new Map<ItemId, { x: number; y: number; node: Phaser.GameObjects.Container }>();

  constructor() {
    super('Hud');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.makeTopBar(W);
    this.makeBag(W);
    this.rebuildStrip();
    this.makeTabBar(W, H);
    this.makeHint(W, H);
    this.makeSideButtons(W);
    this.makeArrow();
    this.view = 'explore';
    this.registry.set('view', 'explore');
    this.game.events.on('player-moved', this.hideHint, this);
    this.game.events.on('toast', this.toast, this);
    this.game.events.on('item-gained', this.onItemGained, this);
    const ge = this.game.events;
    const on: [string, (...a: never[]) => void][] = [
      ['world-ready', this.onWorldReady],
      ['sailing', this.onSailing],
      ['open-order', this.openOrder],
      ['float', this.onFloat],
      ['region-enter', this.onRegionEnter],
      ['open-quest', this.openQuest],
      ['open-boat', this.openBoat],
      ['celebrate', this.celebrate],
    ];
    on.forEach(([e, f]) => ge.on(e, f, this));
    inventory.on('changed', this.onInventoryChanged, this);
    village.on('changed', this.rebuildBuildTray, this);
    family.on('feed', this.onFeed, this);
    family.on('status', this.refreshFeedBtn, this);
    this.events.once('shutdown', () => {
      family.off('feed', this.onFeed, this);
      family.off('status', this.refreshFeedBtn, this);
      village.off('changed', this.rebuildBuildTray, this);
      on.forEach(([e, f]) => ge.off(e, f, this));
      this.game.events.off('player-moved', this.hideHint, this);
      this.game.events.off('toast', this.toast, this);
      this.game.events.off('item-gained', this.onItemGained, this);
      inventory.off('changed', this.onInventoryChanged, this);
    });
    this.makeTitle(W, H);
  }

  private panel(x: number, y: number, w: number, h: number, r = 14) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillRoundedRect(x, y + 3, w, h, r);
    g.fillStyle(COLORS.uiBg).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(2, 0xe8d5a9).strokeRoundedRect(x, y, w, h, r);
    return g;
  }

  /** 왼쪽 위: 지금 섬 이름 + 열린 지역 수. 누르면 섬 목록 */
  private makeTopBar(_W: number) {
    const c = this.add.container(10, 10);
    this.topBg = this.add.graphics();
    this.topText = this.add.text(14, 18, '', { fontFamily: FONT, fontSize: '14px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5);
    c.add([this.topBg, this.topText]);
    this.topBtn = c;
    c.on('pointerdown', () => {
      sfx.tap();
      this.tweens.add({ targets: c, scale: { from: 0.9, to: 1 }, duration: 240, ease: 'Back.easeOut' });
      this.openIslandList(false);
    });
    this.updateTopBar();
  }

  private updateTopBar() {
    const i = progress.current;
    const isl = ISLANDS[i];
    this.topText.setText(`${isl.emoji} ${isl.name}  ${progress.unlockedCount(i)}/${isl.regions}`);
    const w = this.topText.width + 28;
    this.topBg.clear();
    this.topBg.fillStyle(0x000000, 0.15).fillRoundedRect(0, 3, w, 36, 18);
    this.topBg.fillStyle(COLORS.uiBg).fillRoundedRect(0, 0, w, 36, 18);
    this.topBg.lineStyle(2, 0xe8d5a9).strokeRoundedRect(0, 0, w, 36, 18);
    // 컨테이너 터치 좌표는 크기/2만큼 밀려 있음 → (w/2, 18)부터 w×36
    this.topBtn.setSize(w, 36).setInteractive({ hitArea: new Phaser.Geom.Rectangle(w / 2, 18, w, 36), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
  }

  /** 새 지역에 들어서면 이름 띄우기 */
  private onRegionEnter(reg: RegionInfo) {
    if (!progress.isUnlocked(progress.current, reg.idx)) return;
    this.banner?.destroy();
    const W = this.scale.width;
    const t = this.add.text(0, 0, `${BIOME_INFO[reg.biome].emoji} ${reg.name}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#4a3b2a', strokeThickness: 5 }).setOrigin(0.5);
    const c = this.add.container(W / 2, 150, [t]).setAlpha(0).setDepth(90);
    this.banner = c;
    this.tweens.chain({ targets: c, tweens: [{ alpha: 1, y: 140, duration: 300 }, { alpha: 0, delay: 1300, duration: 400 }], onComplete: () => c.destroy() });
  }

  /** 공통 팝업 틀 */
  private modal(PW: number, PH: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.registry.set('modal', true);
    const dim = this.add.rectangle(0, 0, W, H, 0x1b4965, 0.45).setOrigin(0).setDepth(300).setInteractive();
    const box = this.add.container(W / 2, H / 2).setDepth(301);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-PW / 2, -PH / 2 + 4, PW, PH, 24);
    g.fillStyle(COLORS.uiBg).fillRoundedRect(-PW / 2, -PH / 2, PW, PH, 24);
    g.lineStyle(3, 0xe8d5a9).strokeRoundedRect(-PW / 2, -PH / 2, PW, PH, 24);
    box.add(g);
    box.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.tweens.add({ targets: [box, dim], alpha: 0, duration: 180, onComplete: () => { box.destroy(); dim.destroy(); this.registry.set('modal', false); } });
    };
    this.time.delayedCall(150, () => dim.once('pointerdown', () => { sfx.tap(); close(); }));
    return { box, close };
  }

  private button(label: string, enabled: boolean, onTap: () => void, w = 170) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2, -20 + 3, w, 40, 20);
    g.fillStyle(enabled ? 0x8bd17c : 0xd8d2c4).fillRoundedRect(-w / 2, -20, w, 40, 20);
    const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '16px', color: enabled ? '#ffffff' : '#9a917f', fontStyle: 'bold', stroke: enabled ? '#4f8f43' : '#d8d2c4', strokeThickness: enabled ? 3 : 0 }).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(w, 40).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.tweens.add({ targets: c, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      if (!enabled) {
        buzz(20);
        this.tweens.add({ targets: c, x: '+=4', duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      sfx.pop();
      buzz(20);
      onTap();
    });
    return c;
  }

  /** 필요 재료 목록 (있는 개수 / 필요 개수) — 모두 모였는지 돌려준다 */
  private needList(box: Phaser.GameObjects.Container, need: Partial<Record<ItemId, number>>, y: number, PW: number) {
    const entries = Object.entries(need) as [ItemId, number][];
    const cols = Math.min(entries.length, 3);
    const cell = Math.min(90, (PW - 32) / cols);
    let ok = true;
    entries.forEach(([id, n], i) => {
      const have = inventory.get(id);
      const enough = have >= n;
      if (!enough) ok = false;
      const cx = (i % cols - (cols - 1) / 2) * cell;
      const cy = y + Math.floor(i / cols) * 86;
      const g = this.add.graphics();
      g.fillStyle(enough ? 0xd9f2c9 : 0xfde8b0).fillRoundedRect(cx - cell / 2 + 4, cy - 34, cell - 8, 78, 12);
      const ic = this.add.image(cx, cy - 8, itemKey(id)).setScale(1.5);
      const nm = this.add.text(cx, cy + 16, ITEMS[id].name, { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText }).setOrigin(0.5);
      const ct = this.add.text(cx, cy + 32, `${Math.min(have, n)}/${n}${enough ? ' ✓' : ''}`, { fontFamily: FONT, fontSize: '12px', color: enough ? '#3f8f3a' : '#c0573f', fontStyle: 'bold' }).setOrigin(0.5);
      box.add([g, ic, nm, ct]);
    });
    return { ok, height: Math.ceil(entries.length / cols) * 86 };
  }

  private spend(need: Partial<Record<ItemId, number>>) {
    for (const [id, n] of Object.entries(need) as [ItemId, number][]) inventory.add(id, -n);
  }

  /** 지역 해금 퀘스트 */
  private openQuest(island: number, reg: RegionInfo) {
    if (this.registry.get('modal')) return;
    const PW = Math.min(330, this.scale.width - 30);
    const rows = Math.ceil(Object.keys(reg.need).length / 3);
    const PH = 230 + rows * 86;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 30, `${BIOME_INFO[reg.biome].emoji} ${reg.name}`, { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 64, `${reg.story}\n이 재료를 모으면 길이 열려요!`, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center' }).setOrigin(0.5));
    const { ok } = this.needList(box, reg.need, top + 140, PW);
    const btn = this.button(ok ? '🌈 길 열기!' : '재료가 부족해요', ok, () => {
      this.spend(reg.need);
      close();
      this.game.events.emit('unlock-region', island, reg.idx);
    });
    btn.setPosition(0, PH / 2 - 36);
    box.add(btn);
  }

  /** 선착장: 배 만들기 / 다른 섬으로 떠나기 */
  private openBoat(island: number) {
    if (this.registry.get('modal')) return;
    const isl = ISLANDS[island];
    const last = island === ISLANDS.length - 1;
    if (!progress.hasBoat(island) && !last) {
      const PW = Math.min(330, this.scale.width - 30);
      const rows = Math.ceil(Object.keys(isl.boat).length / 3);
      const PH = 240 + rows * 86;
      const { box, close } = this.modal(PW, PH);
      const top = -PH / 2;
      box.add(this.add.image(-PW / 2 + 44, top + 40, 'boat').setScale(0.9));
      box.add(this.add.text(10, top + 32, '⛵ 배 만들기', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
      box.add(this.add.text(0, top + 76, `${ISLANDS[island + 1].emoji} ${withJosa(ISLANDS[island + 1].name, "으로", "로")} 가려면\n튼튼한 배가 필요해요!`, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center' }).setOrigin(0.5));
      const { ok } = this.needList(box, isl.boat, top + 150, PW);
      const btn = this.button(ok ? '🔨 배 만들기!' : '재료가 부족해요', ok, () => {
        this.spend(isl.boat);
        close();
        this.game.events.emit('build-boat', island);
      });
      btn.setPosition(0, PH / 2 - 36);
      box.add(btn);
      return;
    }
    this.openIslandList(true);
  }

  /** 섬 목록 (선착장에서는 떠날 수 있음) */
  private openIslandList(canSail: boolean) {
    if (this.registry.get('modal')) return;
    const PW = Math.min(340, this.scale.width - 24);
    const rowH = 40;
    const PH = 90 + ISLANDS.length * rowH;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 28, canSail ? '⛵ 어디로 떠날까요?' : '🗺️ 섬 지도', { fontFamily: FONT, fontSize: '19px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    ISLANDS.forEach((isl, i) => {
      const y = top + 66 + i * rowH + rowH / 2;
      const here = i === progress.current;
      const open = progress.canVisit(i);
      const label = open ? `${isl.emoji} ${i + 1}. ${isl.name}` : `🔒 ${i + 1}. ???`;
      const sub = open ? `${progress.unlockedCount(i)}/${isl.regions}` : '';
      const g = this.add.graphics();
      g.fillStyle(here ? 0xffe39a : open ? 0xfdf0cf : 0xece6d8).fillRoundedRect(-PW / 2 + 14, y - rowH / 2 + 3, PW - 28, rowH - 6, 10);
      box.add(g);
      box.add(this.add.text(-PW / 2 + 26, y, label, { fontFamily: FONT, fontSize: '14px', color: open ? COLORS.uiText : '#a69c88', fontStyle: 'bold' }).setOrigin(0, 0.5));
      box.add(this.add.text(PW / 2 - 26, y, here ? `여기! ${sub}` : sub, { fontFamily: FONT, fontSize: '12px', color: '#8a6d4b' }).setOrigin(1, 0.5));
      if (canSail && open && !here) {
        const hit = this.add.rectangle(0, y, PW - 28, rowH - 6, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          sfx.pop();
          close();
          this.game.events.emit('travel', i);
          this.time.delayedCall(1700, () => this.updateTopBar());
        });
        box.add(hit);
      }
    });
    if (!canSail) box.add(this.add.text(0, PH / 2 - 16, '배는 캠프 아래 선착장에서 만들 수 있어요', { fontFamily: FONT, fontSize: '11px', color: '#a08a6a' }).setOrigin(0.5));
  }

  /** 큰 축하 (지역 해금, 배 완성) */
  private celebrate(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(0, 0, msg, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', fontStyle: 'bold', stroke: '#e07a5f', strokeThickness: 6, align: 'center', wordWrap: { width: W - 60 } }).setOrigin(0.5);
    const c = this.add.container(W / 2, H * 0.36, [t]).setDepth(120).setScale(0);
    this.tweens.chain({ targets: c, tweens: [{ scale: 1, duration: 380, ease: 'Back.easeOut' }, { alpha: 0, y: H * 0.33, delay: 1800, duration: 400 }], onComplete: () => c.destroy() });
    const conf = this.add.particles(W / 2, H * 0.3, 'confetti', {
      speed: { min: 120, max: 260 },
      angle: { min: 200, max: 340 },
      gravityY: 380,
      lifespan: 1600,
      rotate: { min: 0, max: 360 },
      tint: [0xff6b8a, 0xffd166, 0x8bd17c, 0x6cc3ff, 0xc39bff],
      scale: { start: 1.8, end: 1 },
      emitting: false,
    }).setDepth(119);
    conf.explode(50);
    this.time.delayedCall(2000, () => conf.destroy());
  }

  /** 오른쪽 위 창고 버튼 — 누르면 전체 목록 */
  private makeBag(W: number) {
    const w = 92;
    const c = this.add.container(W - 14 - w / 2, 28);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2, -18 + 3, w, 36, 18);
    g.fillStyle(0xffd166).fillRoundedRect(-w / 2, -18, w, 36, 18);
    g.lineStyle(2, 0xe8b84a).strokeRoundedRect(-w / 2, -18, w, 36, 18);
    const icon = this.add.image(-w / 2 + 20, 0, itemKey('basket')).setScale(1.1);
    const label = this.add.text(4, 0, '창고', { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.bagCount = this.add
      .text(w / 2 - 6, -15, '0', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#e07a5f', padding: { x: 5, y: 1 } })
      .setOrigin(0.5);
    c.add([g, icon, label, this.bagCount]);
    c.setSize(w, 36).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      sfx.tap();
      buzz(8);
      this.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      this.openStorage();
    });
    this.bagBtn = c;
    this.updateBagCount();
  }

  private updateBagCount() {
    const total = inventory.owned().reduce((s, o) => s + o.count, 0);
    this.bagCount.setText(String(total));
    this.bagCount.setVisible(total > 0);
  }

  /** 상단 아이템 줄 — 가진 재료를 아이콘+개수로 (최대 7칸, 넘치면 +N) */
  private rebuildStrip() {
    this.strip?.destroy();
    this.slotPos.clear();
    const owned = inventory.owned();
    if (owned.length === 0) return;
    const W = this.scale.width;
    const slotW = 44;
    const max = Math.floor((W - 20) / slotW);
    const shown = owned.slice(0, owned.length > max ? max - 1 : max);
    const extra = owned.length - shown.length;
    const n = shown.length + (extra > 0 ? 1 : 0);
    const totalW = n * slotW;
    const x0 = (W - totalW) / 2;
    const y = 72;
    const strip = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.uiBg, 0.92).fillRoundedRect(x0 - 6, y - 19, totalW + 12, 38, 14);
    strip.add(bg);
    shown.forEach((o, i) => {
      const cx = x0 + slotW * i + slotW / 2;
      const node = this.add.container(cx, y);
      const ic = this.add.image(0, -2, itemKey(o.id));
      const ct = this.add
        .text(13, 11, String(o.count), { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold', stroke: '#fff8e7', strokeThickness: 3 })
        .setOrigin(1, 0.5);
      node.add([ic, ct]);
      strip.add(node);
      this.slotPos.set(o.id, { x: cx, y, node });
    });
    if (extra > 0) {
      const cx = x0 + slotW * shown.length + slotW / 2;
      strip.add(this.add.text(cx, y, `+${extra}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    }
    this.strip = strip;
  }

  private onInventoryChanged(id?: ItemId, _count?: number, delta?: number) {
    this.rebuildStrip();
    this.updateBagCount();
    this.rebuildBuildTray();
    if (id && delta && delta > 0) {
      const slot = this.slotPos.get(id);
      if (slot) this.tweens.add({ targets: slot.node, scale: { from: 1.45, to: 1 }, duration: 320, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.bagBtn, scale: { from: 1.12, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
  }

  /** 곰 머리 위에 "+1 아이템" 이 떠오르기 */
  private onItemGained(id: ItemId, sx: number, sy: number) {
    const t = this.add
      .text(0, 0, `+1 ${ITEMS[id].name}`, { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#4a3b2a', strokeThickness: 4 })
      .setOrigin(0.5);
    const c = this.add.container(sx, sy, [t]).setDepth(50);
    this.tweens.add({ targets: c, y: sy - 26, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
  }

  /** 가족 창고 + 도감: 못 찾은 것은 그림자로 보인다 */
  private openStorage() {
    if (this.registry.get('modal')) return;
    const PW = Math.min(336, this.scale.width - 24);
    const cols = 6;
    const cell = (PW - 24) / cols;
    const rows = Math.ceil(ITEM_IDS.length / cols);
    const PH = 112 + rows * cell;
    const { box } = this.modal(PW, PH);
    const top = -PH / 2;
    const found = ITEM_IDS.filter((id) => inventory.discovered(id)).length;
    box.add(this.add.text(0, top + 26, '🧺 가족 창고', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 50, `📖 도감 ${found}/${ITEM_IDS.length}`, { fontFamily: FONT, fontSize: '12px', color: '#e07a5f', fontStyle: 'bold' }).setOrigin(0.5));
    const info = this.add.text(0, PH / 2 - 22, '눌러서 이름을 확인해요', { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', fontStyle: 'bold' }).setOrigin(0.5);
    box.add(info);
    ITEM_IDS.forEach((id, i) => {
      const cx = -PW / 2 + 12 + cell * (i % cols) + cell / 2;
      const cy = top + 66 + cell * Math.floor(i / cols) + cell / 2;
      const known = inventory.discovered(id);
      const count = inventory.get(id);
      const sg = this.add.graphics();
      sg.fillStyle(count > 0 ? 0xfde8b0 : 0xf3ecdb).fillRoundedRect(cx - cell / 2 + 3, cy - cell / 2 + 3, cell - 6, cell - 6, 10);
      const ic = this.add.image(cx, cy - 3, itemKey(id)).setScale(1.5);
      if (!known) ic.setTintFill(0xd5ccb8);
      else if (count === 0) ic.setAlpha(0.55);
      box.add([sg, ic]);
      if (count > 0) {
        box.add(
          this.add
            .text(cx + cell / 2 - 6, cy + cell / 2 - 10, String(count), { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold', stroke: '#fff8e7', strokeThickness: 3 })
            .setOrigin(1, 0.5),
        );
      }
      const hit = this.add.rectangle(cx, cy, cell - 4, cell - 4, 0, 0).setInteractive();
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        sfx.tap();
        info.setText(known ? `${ITEMS[id].name} · ${count}개` : '❓ 아직 못 찾았어요');
        this.tweens.add({ targets: ic, scale: { from: 1.9, to: 1.5 }, duration: 220, ease: 'Back.easeOut' });
      });
      box.add(hit);
    });
  }

  private makeTabBar(W: number, H: number) {
    const y = H - HUD_BOTTOM_H + 8;
    this.panel(10, y, W - 20, HUD_BOTTOM_H - 18, 18);
    const slotW = (W - 20) / TABS.length;
    this.tabNodes = [];

    TABS.forEach((tab, i) => {
      const cx = 10 + slotW * i + slotW / 2;
      const cy = y + (HUD_BOTTOM_H - 18) / 2;
      const c = this.add.container(cx, cy);
      const bg = this.add.graphics();
      bg.fillStyle(0xffd166).fillRoundedRect(-slotW / 2 + 8, -24, slotW - 16, 48, 14);
      const icon = this.add.text(0, -8, tab.icon, { fontSize: '22px' }).setOrigin(0.5);
      const label = this.add
        .text(0, 15, tab.label, { fontFamily: FONT, fontSize: '12px', color: COLORS.uiText, fontStyle: 'bold' })
        .setOrigin(0.5);
      c.add([bg, icon, label]);
      c.setSize(slotW - 8, 52).setInteractive();
      c.on('pointerdown', () => {
        sfx.tap();
        buzz(8);
        this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 260, ease: 'Back.easeOut' });
        if (!tab.enabled) return this.toast(`${tab.label} 탭은 곧 열려요!`);
        this.setView(tab.key as View);
      });
      this.tabNodes.push({ key: tab.key, c, bg, enabled: tab.enabled });
    });
    this.refreshTabs();
  }

  private refreshTabs() {
    for (const n of this.tabNodes) {
      n.bg.setVisible(n.key === this.view);
      n.c.setAlpha(n.enabled ? 1 : 0.45);
    }
  }

  /** 탐험 ↔ 머지 ↔ 꾸미기 화면 전환 */
  private setView(v: View) {
    if (v === this.view || this.registry.get('modal') || !this.registry.get('bear')) return;
    const was = this.view;
    this.view = v;
    this.registry.set('view', v);
    if (v === 'merge') {
      this.scene.launch('Merge');
      this.scene.setVisible(false, 'Island');
    } else if (was === 'merge') {
      this.scene.stop('Merge');
      this.scene.setVisible(true, 'Island');
    }
    this.sideBtns.forEach((b) => b.setVisible(v !== 'merge'));
    this.emoteRow?.setVisible(false);
    this.refreshFeedBtn();
    this.arrow.setVisible(false);
    this.hideHint();
    this.refreshTabs();
    this.rebuildBuildTray();
    if (v === 'build') this.toast('🏝️ 물건을 고르고 땅을 톡! 놓인 물건을 누르면 다시 창고로');
  }

  /** 꾸미기 모드: 놓을 물건 고르는 줄 + 마을 점수 */
  private rebuildBuildTray() {
    this.buildTray?.destroy();
    this.buildTray = undefined;
    if (this.view !== 'build') return;
    const W = this.scale.width;
    const H = this.scale.height;
    const h = 78;
    const top = H - HUD_BOTTOM_H - h + 2;
    const tray = this.add.container(0, 0).setDepth(30);
    this.buildTray = tray;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(10, top + 3, W - 20, h, 16);
    bg.fillStyle(COLORS.uiBg, 0.97).fillRoundedRect(10, top, W - 20, h, 16);
    bg.lineStyle(2, 0xe8d5a9).strokeRoundedRect(10, top, W - 20, h, 16);
    // 줄 전체가 터치를 받아서, 아래 섬으로 새지 않게 한다
    const block = this.add.rectangle(W / 2, top + h / 2, W - 20, h, 0, 0).setInteractive();
    tray.add([bg, block]);

    const score = village.score();
    const next = village.nextResident();
    tray.add(this.add.text(22, top + 14, `⭐ 마을 점수 ${score}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    tray.add(
      this.add
        .text(W - 22, top + 14, next ? `🏠 다음 주민까지 ${Math.max(0, next.score - score)}점` : '🏠 주민이 모두 모였어요!', { fontFamily: FONT, fontSize: '11px', color: '#e07a5f', fontStyle: 'bold' })
        .setOrigin(1, 0.5),
    );

    const items = inventory.owned().filter((o) => isPlaceable(o.id)).slice(0, 7);
    let sel = this.registry.get('buildItem') as ItemId | undefined;
    if (!sel || !items.some((o) => o.id === sel)) {
      sel = items[0]?.id;
      this.registry.set('buildItem', sel);
    }
    if (items.length === 0) {
      tray.add(this.add.text(W / 2, top + 50, '놓을 물건이 없어요. 머지 탭에서 의자·화분 등을 만들어요!', { fontFamily: FONT, fontSize: '11px', color: '#a08a6a' }).setOrigin(0.5));
      return;
    }
    const slot = 46;
    const x0 = (W - items.length * slot) / 2;
    items.forEach((o, i) => {
      const x = x0 + i * slot + slot / 2;
      const y = top + 51;
      const g = this.add.graphics();
      const on = o.id === sel;
      g.fillStyle(on ? 0xffd166 : 0xfde8b0).fillRoundedRect(x - 21, y - 21, 42, 42, 10);
      if (on) g.lineStyle(2.5, 0xe07a5f).strokeRoundedRect(x - 21, y - 21, 42, 42, 10);
      const ic = this.add.image(x, y - 2, itemKey(o.id)).setScale(1.4);
      const ct = this.add
        .text(x + 18, y + 14, String(o.count), { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold', stroke: '#fff8e7', strokeThickness: 3 })
        .setOrigin(1, 0.5);
      const hit = this.add.rectangle(x, y, 44, 44, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        sfx.tap();
        this.registry.set('buildItem', o.id);
        this.toast(`${ITEMS[o.id].name} · ⭐ ${DECOR_POINTS[o.id] ?? 0}점`);
        this.time.delayedCall(0, () => this.rebuildBuildTray());
      });
      tray.add([g, ic, ct, hit]);
    });
  }

  /** 주민의 부탁 */
  private openOrder(id: string) {
    if (this.registry.get('modal')) return;
    const r = RESIDENTS.find((v) => v.id === id);
    if (!r) return;
    const hearts = village.hearts(id);
    const order = village.order(id);
    const PW = Math.min(310, this.scale.width - 30);
    const PH = order ? 340 : 230;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.image(-PW / 2 + 48, top + 50, `${id}_front`).setScale(2));
    box.add(this.add.text(-PW / 2 + 92, top + 30, r.name, { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    const heartText = hearts === 0 ? '🤍 처음 만났어요' : `${'💗'.repeat(Math.min(hearts, 5))}${hearts > 5 ? ` ×${hearts}` : ''}`;
    box.add(this.add.text(-PW / 2 + 92, top + 56, heartText, { fontFamily: FONT, fontSize: '13px', color: '#e07a5f', fontStyle: 'bold' }).setOrigin(0, 0.5));
    if (!order) {
      box.add(
        this.add
          .text(0, top + 130, `"고마워요! 지금은 쉬는 중이에요."\n${village.waitSec(id)}초 뒤에 새 부탁이 생겨요`, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center' })
          .setOrigin(0.5),
      );
      return;
    }
    const line = hearts === 0 ? `"${r.hello}"\n"${ITEMS[order.item].name} ${order.n}개만 가져다줄래요?"` : `"${ITEMS[order.item].name} ${order.n}개만 가져다줄래요?"`;
    box.add(this.add.text(0, top + 112, line, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center', wordWrap: { width: PW - 36 } }).setOrigin(0.5));
    const { ok } = this.needList(box, { [order.item]: order.n }, top + 186, PW);
    const btn = this.button(ok ? '🎁 가져다주기' : '재료가 부족해요', ok, () => {
      this.spend({ [order.item]: order.n });
      const h = village.completeOrder(id);
      const gift = ORDER_GIFTS[Math.floor(Math.random() * ORDER_GIFTS.length)];
      const n = 1 + Math.floor(Math.random() * 2);
      inventory.add(gift, n);
      close();
      sfx.fanfare();
      if (h === TROPHY_HEARTS) {
        inventory.add('trophy', 1);
        this.celebrate(`🏆 ${r.name}의 단짝이 됐어요!\n황금 트로피를 받았어요`);
      } else {
        this.celebrate(`💗 ${r.name} 호감도 ${h}\n선물: ${ITEMS[gift].name} ×${n}`);
      }
    });
    btn.setPosition(0, PH / 2 - 36);
    box.add(btn);
  }

  /** 화면 좌표에 글자가 떠오르기 */
  private onFloat(msg: string, sx: number, sy: number) {
    const t = this.add
      .text(sx, sy, msg, { fontFamily: FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold', stroke: '#e07a5f', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: t, y: sy - 30, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ───────────────────────── 길잡이 · 옆 버튼 · 설정 ─────────────────────────

  private roundButton(x: number, y: number, emoji: string, onTap: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillCircle(0, 3, 18);
    g.fillStyle(COLORS.uiBg).fillCircle(0, 0, 18);
    g.lineStyle(2, 0xe8d5a9).strokeCircle(0, 0, 18);
    c.add([g, this.add.text(0, 0, emoji, { fontSize: '17px' }).setOrigin(0.5)]);
    c.setSize(40, 40).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      sfx.tap();
      buzz(8);
      this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 240, ease: 'Back.easeOut' });
      onTap();
    });
    this.sideBtns.push(c);
    return c;
  }

  private makeSideButtons(W: number) {
    this.sideBtns = [];
    this.roundButton(W - 30, HUD_TOP_H + 30, '🏕️', () => {
      if (!this.registry.get('bear')) return;
      this.game.events.emit('go-home');
      this.toast('🏕️ 캠프로 돌아왔어요');
    });
    this.roundButton(W - 30, HUD_TOP_H + 74, '⚙️', () => this.openSettings());
    // 말풍선: 누르면 이모지가 옆으로 펼쳐진다
    const EMOTES = ['👋', '❤️', '😆', '👍', '🙏', '❗'];
    const emoteBtn = this.roundButton(30, HUD_TOP_H + 30, '💬', () => {
      if (!this.registry.get('bear')) return;
      const open = !row.visible;
      row.setVisible(open);
      if (open) this.tweens.add({ targets: row, scaleX: { from: 0.3, to: 1 }, alpha: { from: 0, to: 1 }, duration: 160, ease: 'Back.easeOut' });
    });
    const row = this.add.container(emoteBtn.x + 26, emoteBtn.y).setVisible(false);
    const rw = EMOTES.length * 34 + 10;
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.15).fillRoundedRect(0, -15, rw, 36, 18);
    rg.fillStyle(COLORS.uiBg).fillRoundedRect(0, -18, rw, 36, 18);
    rg.lineStyle(2, 0xe8d5a9).strokeRoundedRect(0, -18, rw, 36, 18);
    row.add(rg);
    EMOTES.forEach((e, i) => {
      const t = this.add.text(22 + i * 34, 0, e, { fontSize: '19px' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        if (!row.visible || this.registry.get('modal')) return;
        buzz(8);
        this.game.events.emit('emote', e);
        row.setVisible(false);
      });
      row.add(t);
    });
    this.sideBtns.push(row as Phaser.GameObjects.Container);
    this.emoteRow = row;
    // 가족 소식판 (가족 섬에 들어가 있을 때만 보인다)
    this.feedBtn = this.roundButton(W - 30, HUD_TOP_H + 118, '📰', () => this.openFeed());
    this.sideBtns.pop();
    this.refreshFeedBtn();
  }

  /** 다음에 갈 곳을 가리키는 화살표 (목표가 화면 밖일 때만) */
  private makeArrow() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillCircle(0, 2, 15);
    g.fillStyle(0xffffff).fillCircle(0, 0, 15);
    g.lineStyle(2.5, 0xe07a5f).strokeCircle(0, 0, 15);
    this.arrowIcon = this.add.text(0, 0, '❗', { fontSize: '14px' }).setOrigin(0.5);
    const tri = this.add.graphics();
    tri.fillStyle(0xe07a5f).fillTriangle(19, -7, 19, 7, 29, 0);
    this.arrowTip = this.add.container(0, 0, [tri]);
    this.arrow = this.add.container(0, 0, [this.arrowTip, g, this.arrowIcon]).setDepth(40).setVisible(false);
    this.tweens.add({ targets: this.arrow, scale: { from: 1, to: 1.12 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  update() {
    if (this.view !== 'explore' || this.registry.get('modal') || !this.registry.get('bear')) {
      this.arrow.setVisible(false);
      return;
    }
    const isl = this.scene.get('Island') as IslandScene;
    const g = isl.scene.isActive() ? isl.guide() : null;
    if (!g) {
      this.arrow.setVisible(false);
      return;
    }
    const W = this.scale.width;
    const H = this.scale.height;
    const l = 30;
    const r = W - 30;
    const t = HUD_TOP_H + 34;
    const b = H - HUD_BOTTOM_H - 34;
    // 목표가 화면 안에 보이면 화살표는 숨긴다
    if (g.x >= 4 && g.x <= W - 4 && g.y >= HUD_TOP_H && g.y <= H - HUD_BOTTOM_H) {
      this.arrow.setVisible(false);
      return;
    }
    const cx = Phaser.Math.Clamp(g.x, l, r - 44); // 오른쪽 버튼 줄을 피해서
    const cy = Phaser.Math.Clamp(g.y, t, b);
    this.arrow.setVisible(true).setPosition(cx, cy);
    this.arrowTip.setRotation(Math.atan2(g.y - cy, g.x - cx));
    this.arrowIcon.setText(g.kind === 'dock' ? '⛵' : '❗');
  }

  private openSettings() {
    if (this.registry.get('modal')) return;
    const PW = 280;
    const PH = 372;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 30, '⚙️ 설정', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    const toggle = (y: number, name: string, key: 'sound' | 'vibrate' | 'music') => {
      const label = () => `${name}: ${settings[key] ? '켜짐' : '꺼짐'}`;
      const btn = this.button(label(), true, () => {
        setSetting(key, !settings[key]);
        refreshMusic();
        (btn.list[1] as Phaser.GameObjects.Text).setText(label());
      }, 200);
      btn.setPosition(0, y);
      box.add(btn);
    };
    const fam = this.button('👨‍👩‍👧‍👦 가족과 함께하기', true, () => {
      close();
      this.time.delayedCall(260, () => this.openFamily());
    }, 200);
    fam.setPosition(0, top + 84);
    (fam.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(0x7cc4e8).fillRoundedRect(-100, -20, 200, 40, 20);
    (fam.list[1] as Phaser.GameObjects.Text).setStroke('#4a8fb3', 3);
    box.add(fam);
    toggle(top + 140, '🎵 배경음악', 'music');
    toggle(top + 186, '🔊 효과음', 'sound');
    toggle(top + 232, '📳 진동', 'vibrate');
    let armed = false;
    const reset = this.button('처음부터 다시 하기', true, () => {
      if (!armed) {
        armed = true;
        (reset.list[1] as Phaser.GameObjects.Text).setText('정말요? 한 번 더!');
        return;
      }
      resetAll();
    }, 200);
    reset.setPosition(0, top + 298);
    (reset.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(0xe58f7b).fillRoundedRect(-100, -20, 200, 40, 20);
    box.add(reset);
    (reset.list[1] as Phaser.GameObjects.Text).setStroke('#b85c48', 3);
    box.add(this.add.text(0, PH / 2 - 26, '모은 재료와 열린 지역이 모두 지워져요', { fontFamily: FONT, fontSize: '10px', color: '#a08a6a' }).setOrigin(0.5));
    box.add(this.add.text(0, PH / 2 - 12, `v0.8 · ${__BUILD_LABEL__.slice(0, 14)}`, { fontFamily: FONT, fontSize: '9px', color: '#c4b79c' }).setOrigin(0.5));
  }

  // ───────────────────────── 가족 섬 (동기화) ─────────────────────────

  private refreshFeedBtn() {
    this.feedBtn?.setVisible(family.active && this.view !== 'merge');
  }

  private statusText(s: SyncStatus) {
    return s === 'online' ? '🟢 연결됨' : s === 'connecting' ? '🟡 연결 중…' : s === 'error' ? '🔴 연결이 불안정해요 (다시 연결되면 이어져요)' : '';
  }

  private openFamily() {
    if (this.registry.get('modal')) return;
    const PW = Math.min(310, this.scale.width - 30);
    const PH = 310;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    const text = (y: number, msg: string, size = 13, color = '#8a6d4b') =>
      box.add(this.add.text(0, y, msg, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center', fontStyle: size > 14 ? 'bold' : 'normal', wordWrap: { width: PW - 32 } }).setOrigin(0.5));
    text(top + 32, '👨‍👩‍👧‍👦 가족과 함께하기', 19, COLORS.uiText);
    if (!family.enabled) {
      text(top + 130, '아직 준비 중이에요.\n가족 섬 연결 설정이 끝나면 열려요!');
      return;
    }
    if (family.code) {
      text(top + 76, '우리 가족 코드');
      text(top + 116, `${family.code.slice(0, 3)} ${family.code.slice(3)}`, 38, '#e07a5f');
      text(top + 152, this.statusText(family.status), 12);
      text(top + 196, '다른 폰에서 ⚙️ 설정 → 가족과 함께하기 →\n코드로 들어가기에 이 숫자를 넣어요', 12);
      let armed = false;
      const leave = this.button('가족 섬에서 나가기', true, () => {
        if (!armed) {
          armed = true;
          (leave.list[1] as Phaser.GameObjects.Text).setText('정말요? 한 번 더!');
          return;
        }
        family.leave();
        close();
        this.toast('가족 섬에서 나왔어요');
        this.refreshFeedBtn();
      }, 200);
      leave.setPosition(0, PH / 2 - 40);
      (leave.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(0xd8d2c4).fillRoundedRect(-100, -20, 200, 40, 20);
      (leave.list[1] as Phaser.GameObjects.Text).setStroke('#9a917f', 3);
      box.add(leave);
      return;
    }
    text(top + 82, '가족 코드 하나로\n섬과 창고를 함께 써요', 13);
    const make = this.button('🏝️ 새 가족 섬 만들기', true, () => {
      close();
      this.toast('가족 섬을 만드는 중…');
      family
        .create(localDoc())
        .then(() => {
          this.refreshFeedBtn();
          this.celebrate('🏝️ 가족 섬이 만들어졌어요!\n코드를 가족에게 알려 줘요');
          this.time.delayedCall(2600, () => this.openFamily());
        })
        .catch(() => this.toast('연결에 실패했어요. 인터넷을 확인해 봐요'));
    }, 220);
    make.setPosition(0, top + 150);
    box.add(make);
    const join = this.button('🔑 코드로 들어가기', true, () => {
      close();
      this.time.delayedCall(260, () => this.openKeypad(''));
    }, 220);
    join.setPosition(0, top + 204);
    box.add(join);
    text(PH / 2 - 44, '새로 만들면 지금 이 폰의 섬이 가족 섬이 돼요.\n코드로 들어가면 이 폰의 섬은 가족 섬으로 바뀌어요.', 10, '#a08a6a');
  }

  /** 가족 코드 6자리 입력 */
  private openKeypad(prefill: string) {
    if (this.registry.get('modal')) return;
    const PW = 280;
    const PH = 400;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    let code = prefill.replace(/\D/g, '').slice(0, 6);
    box.add(this.add.text(0, top + 30, '🔑 가족 코드 넣기', { fontFamily: FONT, fontSize: '19px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    const show = this.add.text(0, top + 78, '', { fontFamily: FONT, fontSize: '34px', color: '#e07a5f', fontStyle: 'bold' }).setOrigin(0.5);
    box.add(show);
    const render = () => show.setText((code + '······'.slice(code.length)).replace(/(.{3})/, '$1 '));
    render();
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
    keys.forEach((k, i) => {
      const x = ((i % 3) - 1) * 76;
      const y = top + 140 + Math.floor(i / 3) * 58;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.12).fillRoundedRect(x - 32, y - 22 + 3, 64, 46, 14);
      g.fillStyle(k === '✓' ? 0x8bd17c : k === '⌫' ? 0xf1ead8 : 0xfde8b0).fillRoundedRect(x - 32, y - 22, 64, 46, 14);
      const t = this.add.text(x, y, k, { fontFamily: FONT, fontSize: '22px', color: k === '✓' ? '#ffffff' : COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5);
      const hit = this.add.rectangle(x, y, 68, 50, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        sfx.tap();
        this.tweens.add({ targets: t, scale: { from: 1.3, to: 1 }, duration: 160 });
        if (k === '⌫') code = code.slice(0, -1);
        else if (k === '✓') {
          if (code.length < 6) {
            buzz(20);
            this.tweens.add({ targets: show, x: '+=5', duration: 50, yoyo: true, repeat: 2 });
            return;
          }
          close();
          this.toast('가족 섬에 들어가는 중…');
          family
            .join(code)
            .then((ok) => {
              this.refreshFeedBtn();
              if (ok) this.celebrate('👨‍👩‍👧‍👦 가족 섬에 들어왔어요!');
              else this.time.delayedCall(300, () => this.toast('그런 가족 코드가 없어요. 숫자를 확인해 봐요'));
            })
            .catch(() => this.toast('연결에 실패했어요. 인터넷을 확인해 봐요'));
          return;
        } else if (code.length < 6) code += k;
        render();
      });
      box.add([g, t, hit]);
    });
  }

  /** 가족 소식판 */
  private openFeed() {
    if (this.registry.get('modal')) return;
    const PW = Math.min(320, this.scale.width - 24);
    const items = family.feed.slice(0, 8);
    const PH = 96 + Math.max(1, items.length) * 46;
    const { box } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 28, '📰 가족 소식', { fontFamily: FONT, fontSize: '19px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    if (items.length === 0) {
      box.add(this.add.text(0, top + 80, '아직 소식이 없어요.\n지역을 열거나 배를 만들면 올라와요!', { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center' }).setOrigin(0.5));
      return;
    }
    const ago = (t: number) => {
      const m = Math.floor((Date.now() - t) / 60000);
      return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
    };
    items.forEach((f, i) => {
      const y = top + 62 + i * 46;
      const g = this.add.graphics();
      g.fillStyle(f.dev === family.device ? 0xfdf0cf : 0xe6f4d9).fillRoundedRect(-PW / 2 + 12, y - 4, PW - 24, 40, 10);
      box.add(g);
      box.add(this.add.text(-PW / 2 + 22, y + 6, `${f.who} · ${ago(f.t)}`, { fontFamily: FONT, fontSize: '10px', color: '#a08a6a' }).setOrigin(0, 0.5));
      box.add(this.add.text(-PW / 2 + 22, y + 23, f.msg, { fontFamily: FONT, fontSize: '12px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    });
  }

  /** 다른 가족이 올린 새 소식 */
  private onFeed(f: FeedItem) {
    this.toast(`📰 ${f.who}: ${f.msg}`);
  }

  /** 다른 섬으로 가는 동안 보여 주는 화면 */
  private onSailing(to: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.time.delayedCall(1450, () => {
      const bg = this.add.rectangle(0, 0, W, H, COLORS.sea).setOrigin(0).setInteractive();
      const boat = this.add.image(W / 2, H / 2 - 30, 'boat').setScale(2);
      const t = this.add
        .text(W / 2, H / 2 + 40, `${ISLANDS[to].emoji} ${withJosa(ISLANDS[to].name, '으로', '로')} 가는 중…`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#2a6f8a', strokeThickness: 5 })
        .setOrigin(0.5);
      this.sail = this.add.container(0, 0, [bg, boat, t]).setDepth(500).setAlpha(0);
      this.tweens.add({ targets: this.sail, alpha: 1, duration: 120 });
      this.tweens.add({ targets: boat, y: '+=6', angle: 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  private onWorldReady() {
    this.updateTopBar();
    const s = this.sail;
    if (!s) return;
    this.sail = undefined;
    this.tweens.add({ targets: s, alpha: 0, delay: 500, duration: 400, onComplete: () => s.destroy() });
  }

  private makeHint(W: number, H: number) {
    const msg = '👆 땅을 톡 눌러서 이동해요';
    const t = this.add.text(0, 0, msg, { fontFamily: FONT, fontSize: '14px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5);
    const w = t.width + 28;
    const g = this.add.graphics();
    g.fillStyle(COLORS.uiBg, 0.95).fillRoundedRect(-w / 2, -17, w, 34, 17);
    this.hint = this.add.container(W / 2, H - HUD_BOTTOM_H - 34, [g, t]).setAlpha(0);
    this.tweens.add({ targets: this.hint, y: '-=4', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private hideHint() {
    if (!this.hint) return;
    const h = this.hint;
    this.hint = undefined;
    this.tweens.add({ targets: h, alpha: 0, duration: 300, onComplete: () => h.destroy() });
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const t = this.add.text(0, 0, msg, { fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const w = t.width + 28;
    const g = this.add.graphics();
    g.fillStyle(0x4a3b2a, 0.88).fillRoundedRect(-w / 2, -17, w, 34, 17);
    const c = this.add.container(W / 2, 112, [g, t]).setAlpha(0).setDepth(100);
    this.tweens.chain({
      targets: c,
      tweens: [
        { alpha: 1, y: 124, duration: 200, ease: 'Back.easeOut' },
        { alpha: 0, delay: 1100, duration: 250 },
      ],
      onComplete: () => c.destroy(),
    });
  }

  /** 시작 화면 — 가족 중 누구로 놀지 고르기. 첫 터치로 오디오 잠금 해제 */
  private makeTitle(W: number, H: number) {
    const dim = this.add.rectangle(0, 0, W, H, 0x1b4965, 0.4).setOrigin(0).setDepth(200).setInteractive();
    const PW = 300;
    const PH = 210;
    const box = this.add.container(W / 2, H * 0.44).setDepth(201);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-PW / 2, -PH / 2 + 4, PW, PH, 26);
    g.fillStyle(COLORS.uiBg).fillRoundedRect(-PW / 2, -PH / 2, PW, PH, 26);
    g.lineStyle(3, 0xe8d5a9).strokeRoundedRect(-PW / 2, -PH / 2, PW, PH, 26);
    const title = this.add
      .text(0, -PH / 2 + 36, '가족 섬 만들기', { fontFamily: FONT, fontSize: '28px', color: COLORS.uiText, fontStyle: 'bold' })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, -PH / 2 + 72, '누구로 놀까요?', { fontFamily: FONT, fontSize: '15px', color: '#e07a5f', fontStyle: 'bold' })
      .setOrigin(0.5);
    box.add([g, title, sub]);

    const slot = 66;
    BEARS.forEach((b, i) => {
      const x = (i - 1.5) * slot;
      const y = 27;
      const card = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(0xfde8b0).fillRoundedRect(-29, -42, 58, 92, 14);
      const img = this.add.image(0, 14, `${b.id}_front`).setOrigin(0.5, 1).setScale(2);
      const name = this.add
        .text(0, 32, b.name, { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold' })
        .setOrigin(0.5);
      card.add([bg, img, name]);
      card.setSize(58, 92).setInteractive({ useHandCursor: true });
      // 대기 중 살짝 들썩이기
      this.tweens.add({ targets: img, scaleY: 2.08, scaleX: 1.94, duration: 500 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      card.on('pointerup', () => {
        if (!dim.active) return;
        unlockAudio();
        sfx.pop();
        buzz(20);
        this.tweens.add({ targets: card, scale: 1.2, duration: 120, yoyo: true });
        this.game.events.emit('choose-bear', b.id);
        this.time.delayedCall(180, () => this.closeTitle(box, dim));
      });
      box.add(card);
    });

    box.setScale(0);
    this.tweens.add({ targets: box, scale: 1, duration: 600, ease: 'Back.easeOut', delay: 150 });
  }

  private closeTitle(box: Phaser.GameObjects.Container, dim: Phaser.GameObjects.Rectangle) {
    dim.disableInteractive();
    this.tweens.add({ targets: box, scale: 0, duration: 280, ease: 'Back.easeIn', onComplete: () => box.destroy() });
    this.tweens.add({
      targets: dim,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        dim.destroy();
        if (this.hint) this.tweens.add({ targets: this.hint, alpha: 1, duration: 400 });
        // 가족이 보내 준 링크(?family=123456)로 들어왔으면 코드 입력 창을 바로 띄운다
        const q = new URLSearchParams(location.search).get('family') ?? '';
        if (/^\d{6}$/.test(q) && family.enabled && !family.code) this.time.delayedCall(600, () => this.openKeypad(q));
      },
    });
  }
}

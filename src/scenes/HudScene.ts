import Phaser from 'phaser';
import { COLORS } from '../config';
import { sfx, unlockAudio, buzz } from '../sfx';
import { BEARS } from '../data/assets';
import { ITEMS, ITEM_IDS, itemKey, type ItemId } from '../data/items';
import { inventory } from '../state/inventory';
import { progress } from '../state/progress';
import { withJosa } from '../util/korean';
import { ISLANDS } from '../data/islands';
import { BIOME_INFO } from '../data/biomes';
import type { RegionInfo } from '../world/generate';
import { settings, setSetting, resetAll } from '../state/settings';
import type { IslandScene } from './IslandScene';

export const HUD_TOP_H = 96;
export const HUD_BOTTOM_H = 76;

const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

type Tab = { key: string; icon: string; label: string; enabled: boolean };
const TABS: Tab[] = [
  { key: 'explore', icon: '🗺️', label: '탐험', enabled: true },
  { key: 'merge', icon: '🧩', label: '머지', enabled: true },
  { key: 'build', icon: '🏝️', label: '꾸미기', enabled: false },
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
  private view: 'explore' | 'merge' = 'explore';
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
    this.game.events.on('player-moved', this.hideHint, this);
    this.game.events.on('toast', this.toast, this);
    this.game.events.on('item-gained', this.onItemGained, this);
    const ge = this.game.events;
    const on: [string, (...a: never[]) => void][] = [
      ['world-ready', this.onWorldReady],
      ['sailing', this.onSailing],
      ['region-enter', this.onRegionEnter],
      ['open-quest', this.openQuest],
      ['open-boat', this.openBoat],
      ['celebrate', this.celebrate],
    ];
    on.forEach(([e, f]) => ge.on(e, f, this));
    inventory.on('changed', this.onInventoryChanged, this);
    this.events.once('shutdown', () => {
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
        this.setView(tab.key as 'explore' | 'merge');
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

  /** 탐험 ↔ 머지 화면 전환 */
  private setView(v: 'explore' | 'merge') {
    if (v === this.view || this.registry.get('modal') || !this.registry.get('bear')) return;
    this.view = v;
    if (v === 'merge') {
      this.scene.launch('Merge');
      this.scene.setVisible(false, 'Island');
    } else {
      this.scene.stop('Merge');
      this.scene.setVisible(true, 'Island');
    }
    this.sideBtns.forEach((b) => b.setVisible(v === 'explore'));
    this.arrow.setVisible(false);
    this.hideHint();
    this.refreshTabs();
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
    const PH = 270;
    const { box } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 30, '⚙️ 설정', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    const toggle = (y: number, name: string, key: 'sound' | 'vibrate') => {
      const label = () => `${name}: ${settings[key] ? '켜짐' : '꺼짐'}`;
      const btn = this.button(label(), true, () => {
        setSetting(key, !settings[key]);
        (btn.list[1] as Phaser.GameObjects.Text).setText(label());
      }, 200);
      btn.setPosition(0, y);
      box.add(btn);
    };
    toggle(top + 84, '🔊 소리', 'sound');
    toggle(top + 134, '📳 진동', 'vibrate');
    let armed = false;
    const reset = this.button('처음부터 다시 하기', true, () => {
      if (!armed) {
        armed = true;
        (reset.list[1] as Phaser.GameObjects.Text).setText('정말요? 한 번 더!');
        return;
      }
      resetAll();
    }, 200);
    reset.setPosition(0, top + 196);
    (reset.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(0xe58f7b).fillRoundedRect(-100, -20, 200, 40, 20);
    box.add(reset);
    (reset.list[1] as Phaser.GameObjects.Text).setStroke('#b85c48', 3);
    box.add(this.add.text(0, PH / 2 - 26, '모은 재료와 열린 지역이 모두 지워져요', { fontFamily: FONT, fontSize: '10px', color: '#a08a6a' }).setOrigin(0.5));
    box.add(this.add.text(0, PH / 2 - 12, `v0.6 · ${__BUILD_LABEL__.slice(0, 14)}`, { fontFamily: FONT, fontSize: '9px', color: '#c4b79c' }).setOrigin(0.5));
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
      },
    });
  }
}

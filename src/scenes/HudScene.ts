import { BUFFS, FOODS, foodText } from '../data/food';
import { player, MAX_HP } from '../state/player';
import { quests, DAILY_BONUS, STORY, type QuestView } from '../state/quests';
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
import { daily, DAILY_REWARDS } from '../state/daily';
import { TREASURES, treasureKey } from '../data/treasures';
import { village } from '../state/village';
import { family, type FeedItem, type SyncStatus } from '../sync/family';
import { localDoc } from '../sync/bridge';
import { ORDER_GIFTS, RESIDENTS, TROPHY_HEARTS } from '../data/village';
import { COMBOS, USABLE } from '../data/merge';
import { BUILD_CATS, PIECES, PIECE_LIST, type BuildCat, type Piece } from '../data/build';
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
  private stripZone?: Phaser.GameObjects.Rectangle;
  private stripMask?: Phaser.GameObjects.Graphics;
  private stripScroll = 0;
  private stripArrows?: () => void;
  private questPill?: Phaser.GameObjects.Container;
  private questDot?: Phaser.GameObjects.Arc;
  private resizeTimer?: Phaser.Time.TimerEvent;
  private statusBar?: Phaser.GameObjects.Container;
  private topText!: Phaser.GameObjects.Text;
  private topBg!: Phaser.GameObjects.Graphics;
  private topBtn!: Phaser.GameObjects.Container;
  private banner?: Phaser.GameObjects.Container;
  private view: View = 'explore';
  private buildTray?: Phaser.GameObjects.Container;
  private feedBtn!: Phaser.GameObjects.Container;
  private emoteRow?: Phaser.GameObjects.Container;
  private giftBtn!: Phaser.GameObjects.Container;
  private giftDot!: Phaser.GameObjects.Arc;
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

  private laidW = 0;
  private laidH = 0;

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.laidW = W;
    this.laidH = H;

    this.makeTopBar(W);
    this.makeBag(W);
    this.rebuildStrip();
    this.makeTabBar(W, H);
    this.makeHint(W, H);
    this.makeSideButtons(W);
    this.makeArrow();
    const prevView = (this.registry.get('bear') ? this.registry.get('view') : 'explore') as View | undefined;
    this.view = 'explore';
    this.registry.set('modal', false);
    this.registry.set('view', 'explore');
    this.game.events.on('player-moved', this.hideHint, this);
    this.game.events.on('toast', this.toast, this);
    this.game.events.on('item-gained', this.onItemGained, this);
    const ge = this.game.events;
    const on: [string, (...a: never[]) => void][] = [
      ['world-ready', this.onWorldReady],
      ['open-treasures', this.openTreasures],
      ['treasure-found', this.onTreasureFound],
      ['sailing', this.onSailing],
      ['open-order', this.openOrder],
      ['open-combos', this.openCombos],
      ['open-sleep', this.openSleep],
      ['build-refresh', this.rebuildBuildTray],
      ['open-friend', this.openFriend],
      ['float', this.onFloat],
      ['region-enter', this.onRegionEnter],
      ['open-quest', this.openQuest],
      ['open-boat', this.openBoat],
      ['celebrate', this.celebrate],
    ];
    on.forEach(([e, f]) => ge.on(e, f, this));
    inventory.on('changed', this.onInventoryChanged, this);
    village.on('changed', this.rebuildBuildTray, this);
    inventory.on('changed', this.rebuildBuildTray, this);
    family.on('feed', this.onFeed, this);
    family.on('status', this.refreshFeedBtn, this);
    this.events.once('shutdown', () => {
      family.off('feed', this.onFeed, this);
      family.off('status', this.refreshFeedBtn, this);
      village.off('changed', this.rebuildBuildTray, this);
      inventory.off('changed', this.rebuildBuildTray, this);
      on.forEach(([e, f]) => ge.off(e, f, this));
      this.game.events.off('player-moved', this.hideHint, this);
      this.game.events.off('toast', this.toast, this);
      this.game.events.off('item-gained', this.onItemGained, this);
      inventory.off('changed', this.onInventoryChanged, this);
    });
    quests.on('changed', this.refreshQuestPill, this);
    player.on('changed', this.refreshStatus, this);
    player.on('hurt', this.onHurt, this);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshStatus() });
    progress.on('region-unlocked', this.refreshQuestPill, this);
    progress.on('treasure', this.refreshQuestPill, this);
    progress.on('boat-built', this.refreshQuestPill, this);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      quests.off('changed', this.refreshQuestPill, this);
      player.off('changed', this.refreshStatus, this);
      player.off('hurt', this.onHurt, this);
      progress.off('region-unlocked', this.refreshQuestPill, this);
      progress.off('treasure', this.refreshQuestPill, this);
      progress.off('boat-built', this.refreshQuestPill, this);
      this.scale.off('resize', this.onResize, this);
    });
    if (this.registry.get('bear')) {
      // 화면 크기가 바뀌어 다시 그리는 중: 곰 고르기는 건너뛰고 보던 화면으로 돌아간다
      this.updateTopBar();
      this.hideHint();
      if (daily.ready && !this.registry.get('dailyShown')) {
        this.registry.set('dailyShown', true);
        this.time.delayedCall(900, () => this.openDaily());
      }
      this.refreshQuestPill();
      if (prevView && prevView !== 'explore') this.setView(prevView);
    } else {
      this.makeTitle(W, H);
    }
  }

  private toggleFullscreen() {
    try {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    } catch {
      this.toast('이 브라우저는 전체 화면을 지원하지 않아요');
    }
  }

  /** 화면 크기가 바뀌면(주소창 숨김, 전체 화면, 회전) 버튼들을 새 크기에 맞춰 다시 놓는다 */
  private onResize() {
    this.resizeTimer?.remove();
    this.resizeTimer = this.time.delayedCall(180, () => {
      if (this.scale.width === this.laidW && this.scale.height === this.laidH) return;
      this.scene.restart();
    });
  }

  private refreshQuestPill() {
    this.refreshStatus();
    this.questPill?.destroy();
    this.questPill = undefined;
    this.questDot?.setVisible(quests.claimable);
    if (!this.registry.get('bear') || this.view !== 'explore') return;
    const q = quests.story();
    const dailyReady = quests.daily().some((d) => d.done && !d.claimed) || quests.bonusState() === 'ready';
    let label: string;
    let ready = false;
    if (q?.done) {
      label = `🎁 ${q.def.text} — 보상 받기!`;
      ready = true;
    } else if (dailyReady) {
      label = '🎁 오늘의 퀘스트 보상 받기!';
      ready = true;
    } else if (q) {
      label = `📜 ${q.def.text}  ${q.have}/${q.need}`;
    } else {
      return;
    }
    const W = this.scale.width;
    const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '11px', color: ready ? '#ffffff' : COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5);
    const w = Math.min(W - 108, t.width + 22);
    if (t.width > w - 16) t.setScale((w - 16) / t.width);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.12).fillRoundedRect(-w / 2, -11 + 2, w, 24, 12);
    g.fillStyle(ready ? 0x8bd17c : COLORS.uiBg, 0.95).fillRoundedRect(-w / 2, -12, w, 24, 12);
    if (!ready) g.lineStyle(1.5, 0xe8d5a9).strokeRoundedRect(-w / 2, -12, w, 24, 12);
    const c = this.add.container(W / 2, HUD_TOP_H + 16, [g, t]).setDepth(5);
    c.setSize(w, 30).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      sfx.tap();
      this.openQuestBook();
    });
    if (ready) this.tweens.add({ targets: c, scale: 1.05, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.questPill = c;
  }

  /** 퀘스트 수첩: 모험 퀘스트(하나씩) + 오늘의 퀘스트(3개) */
  private openQuestBook() {
    if (this.registry.get('modal') || !this.registry.get('bear')) return;
    const PW = Math.min(330, this.scale.width - 20);
    const PH = 452;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    const reopen = () => {
      close();
      this.time.delayedCall(230, () => this.openQuestBook());
    };
    const give = (r: [ItemId, number] | null) => {
      if (!r) return;
      inventory.add(r[0], r[1]);
      sfx.fanfare();
      buzz(30);
      this.toast(`🎁 ${ITEMS[r[0]].name} ×${r[1]}`);
      reopen();
    };
    const row = (y: number, q: QuestView, tag: string, onClaim: () => void, tip?: string) => {
      const x = -PW / 2 + 14;
      const w = PW - 28;
      const g = this.add.graphics();
      g.fillStyle(q.claimed ? 0xe9e3d3 : q.done ? 0xe3f4d7 : 0xfff6df).fillRoundedRect(x, y, w, 64, 14);
      if (q.done && !q.claimed) g.lineStyle(2, 0x8bd17c).strokeRoundedRect(x, y, w, 64, 14);
      box.add(g);
      box.add(this.add.text(x + 12, y + 9, tag, { fontFamily: FONT, fontSize: '9px', color: '#e07a5f', fontStyle: 'bold' }));
      box.add(this.add.text(x + 12, y + 22, q.def.text, { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }).setAlpha(q.claimed ? 0.5 : 1));
      // 진행 막대
      const bw = w - 110;
      const bar = this.add.graphics();
      bar.fillStyle(0xe8d5a9).fillRoundedRect(x + 12, y + 45, bw, 8, 4);
      const f = q.need ? q.have / q.need : 0;
      if (f > 0) bar.fillStyle(q.done ? 0x8bd17c : 0xf2a93b).fillRoundedRect(x + 12, y + 45, Math.max(8, bw * f), 8, 4);
      box.add(bar);
      box.add(this.add.text(x + 12 + bw + 6, y + 49, `${q.have}/${q.need}`, { fontFamily: FONT, fontSize: '10px', color: '#8a6d4b', fontStyle: 'bold' }).setOrigin(0, 0.5));
      if (tip && !q.done) box.add(this.add.text(x + w - 12, y + 9, `💡 ${tip}`, { fontFamily: FONT, fontSize: '9px', color: '#a08a6a' }).setOrigin(1, 0));
      // 보상 / 받기
      const rx = x + w - 34;
      if (q.claimed) {
        box.add(this.add.text(rx, y + 38, '✔ 받음', { fontFamily: FONT, fontSize: '11px', color: '#5fae52', fontStyle: 'bold' }).setOrigin(0.5));
      } else if (q.done) {
        const btn = this.button('받기', true, onClaim, 58);
        btn.setPosition(rx - 2, y + 40).setScale(0.8);
        box.add(btn);
      } else {
        box.add(this.add.image(rx - 8, y + 40, itemKey(q.def.reward[0])).setScale(1.1));
        box.add(this.add.text(rx + 6, y + 41, `×${q.def.reward[1]}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
      }
    };
    box.add(this.add.text(0, top + 28, '📜 퀘스트 수첩', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));

    // 모험 퀘스트
    const st = quests.story();
    box.add(this.add.text(-PW / 2 + 18, top + 56, `🧭 모험 퀘스트  ${Math.min(quests.storyIndex + 1, STORY.length)}/${STORY.length}`, { fontFamily: FONT, fontSize: '12px', color: '#8a6d4b', fontStyle: 'bold' }));
    if (st) row(top + 74, st, '지금 할 일', () => give(quests.claimStory()), st.def.tip);
    else box.add(this.add.text(0, top + 106, '🎉 모험 퀘스트를 모두 끝냈어요!', { fontFamily: FONT, fontSize: '13px', color: '#5fae52', fontStyle: 'bold' }).setOrigin(0.5));

    // 오늘의 퀘스트
    box.add(this.add.text(-PW / 2 + 18, top + 152, '☀️ 오늘의 퀘스트 (매일 바뀌어요)', { fontFamily: FONT, fontSize: '12px', color: '#8a6d4b', fontStyle: 'bold' }));
    quests.daily().forEach((q, i) => row(top + 170 + i * 70, q, `오늘 ${i + 1}`, () => give(quests.claimDaily(q.def.id))));
    const bs = quests.bonusState();
    const by = top + 170 + 3 * 70 + 6;
    const bg2 = this.add.graphics();
    bg2.fillStyle(bs === 'ready' ? 0xffe9a8 : 0xf3ecd9).fillRoundedRect(-PW / 2 + 14, by, PW - 28, 44, 14);
    box.add(bg2);
    box.add(this.add.text(-PW / 2 + 26, by + 22, bs === 'claimed' ? '🎁 오늘 보너스를 받았어요' : `🎁 3개 모두 끝내면 보너스: ${ITEMS[DAILY_BONUS[0]].name} ×${DAILY_BONUS[1]}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    if (bs === 'ready') {
      const btn = this.button('받기', true, () => give(quests.claimBonus()), 58);
      btn.setPosition(PW / 2 - 50, by + 22).setScale(0.8);
      box.add(btn);
    }
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
    // 작은 화면에서는 창을 줄여서 화면 밖으로 나가지 않게 한다
    const fit = Math.min(1, (H - 24) / PH, (W - 12) / PW);
    box.setScale(0.6 * fit);
    this.tweens.add({ targets: box, scale: fit, alpha: 1, duration: 260, ease: 'Back.easeOut' });
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
      const PH = 270 + rows * 86;
      const { box, close } = this.modal(PW, PH);
      const top = -PH / 2;
      box.add(this.add.image(-PW / 2 + 44, top + 40, 'boat').setScale(0.9));
      box.add(this.add.text(10, top + 32, '⛵ 배 만들기', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
      box.add(this.add.text(0, top + 76, `${ISLANDS[island + 1].emoji} ${withJosa(ISLANDS[island + 1].name, "으로", "로")} 가려면\n튼튼한 배가 필요해요!`, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center' }).setOrigin(0.5));
      const { ok: itemsOk } = this.needList(box, isl.boat, top + 150, PW);
      // 섬을 끝까지 탐험해서 얻는 보물이 있어야 뱃길을 알 수 있다 (보물은 쓰지 않고 그대로 남는다)
      const has = progress.hasTreasure(island);
      const ty = top + 150 + rows * 86 + 14;
      const tg = this.add.graphics();
      tg.fillStyle(has ? 0xe3f4d7 : 0xf3ecd9).fillRoundedRect(-PW / 2 + 16, ty - 24, PW - 32, 48, 12);
      box.add(tg);
      const ticon = this.add.image(-PW / 2 + 44, ty, treasureKey(island)).setScale(1.4);
      if (!has) ticon.setTintFill(0x5b4a3a).setAlpha(0.3);
      box.add(ticon);
      box.add(
        this.add
          .text(-PW / 2 + 68, ty, has ? `✅ 섬의 보물: ${TREASURES[island].name}\n보물이 다음 섬 뱃길을 알려 줘요` : `🔒 섬의 보물이 필요해요\n지역을 모두 열고(${progress.unlockedCount(island)}/${isl.regions}) 보물 상자를 열어요`, { fontFamily: FONT, fontSize: '11px', color: has ? '#4f8f43' : '#8a6d4b', fontStyle: 'bold', lineSpacing: 3 })
          .setOrigin(0, 0.5),
      );
      const ok = itemsOk && has;
      const btn = this.button(ok ? '🔨 배 만들기!' : !has ? '보물을 먼저 찾아요' : '재료가 부족해요', ok, () => {
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
  /** 위쪽 재료 줄 — 가진 것을 모두 보여 준다. 옆으로 밀어서 넘기고, 톡 누르면 창고가 열린다 */
  private rebuildStrip() {
    this.strip?.destroy();
    this.stripZone?.destroy();
    this.stripMask?.destroy();
    this.slotPos.clear();
    const owned = inventory.owned();
    if (owned.length === 0) return;
    const W = this.scale.width;
    const slotW = 44;
    const viewW = W - 20;
    const totalW = owned.length * slotW;
    const fits = totalW <= viewW - 12;
    const x0 = fits ? (W - totalW) / 2 : 16;
    const y = 72;
    const strip = this.add.container(0, 0);
    const bg = this.add.graphics();
    if (fits) bg.fillStyle(COLORS.uiBg, 0.92).fillRoundedRect(x0 - 6, y - 19, totalW + 12, 38, 14);
    else bg.fillStyle(COLORS.uiBg, 0.92).fillRoundedRect(10, y - 19, viewW, 38, 14);
    strip.add(bg);
    const row = this.add.container(0, 0);
    strip.add(row);
    owned.forEach((o, i) => {
      const cx = x0 + slotW * i + slotW / 2;
      const node = this.add.container(cx, y);
      const ic = this.add.image(0, -2, itemKey(o.id));
      const ct = this.add
        .text(13, 11, String(o.count), { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold', stroke: '#fff8e7', strokeThickness: 3 })
        .setOrigin(1, 0.5);
      node.add([ic, ct]);
      row.add(node);
      this.slotPos.set(o.id, { x: cx, y, node });
    });
    this.strip = strip;
    const minX = fits ? 0 : viewW - 12 - totalW;
    if (!fits) {
      // 줄 밖으로 나간 것은 가린다
      const mg = this.make.graphics({}, false);
      mg.fillStyle(0xffffff).fillRoundedRect(12, y - 19, viewW - 4, 38, 12);
      this.stripMask = mg;
      row.setMask(mg.createGeometryMask());
      this.stripScroll = Phaser.Math.Clamp(this.stripScroll, minX, 0);
      row.x = this.stripScroll;
      const more = this.add.text(W - 16, y, '›', { fontFamily: FONT, fontSize: '20px', color: '#c9a66b', fontStyle: 'bold' }).setOrigin(1, 0.55);
      const less = this.add.text(16, y, '‹', { fontFamily: FONT, fontSize: '20px', color: '#c9a66b', fontStyle: 'bold' }).setOrigin(0, 0.55);
      strip.add([more, less]);
      const arrows = () => {
        more.setVisible(row.x > minX + 4);
        less.setVisible(row.x < -4);
      };
      arrows();
      this.stripArrows = arrows;
    } else {
      this.stripScroll = 0;
      this.stripArrows = undefined;
    }
    // 밀기 / 누르기
    const zone = this.add.rectangle(W / 2, y, viewW, 40, 0, 0).setInteractive();
    this.stripZone = zone;
    let start: { px: number; rx: number; moved: boolean } | null = null;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      start = { px: p.x, rx: row.x, moved: false };
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!start || !p.isDown) return;
      if (Math.abs(p.x - start.px) > 8) start.moved = true;
      if (start.moved && !fits) {
        row.x = Phaser.Math.Clamp(start.rx + (p.x - start.px), minX, 0);
        this.stripScroll = row.x;
        this.stripArrows?.();
      }
    });
    const end = () => {
      const s0 = start;
      start = null;
      if (s0 && !s0.moved && !this.registry.get('modal') && this.registry.get('bear')) {
        sfx.tap();
        this.openStorage();
      }
    };
    zone.on('pointerup', end);
    zone.on('pointerout', () => {
      start = null;
    });
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
    const W = this.scale.width;
    const H = this.scale.height;
    const PW = Math.min(336, W - 24);
    const cols = 5;
    const cell = (PW - 28) / cols;
    const rowH = cell + 12;
    // 가진 것 → 찾아 본 것 → 아직 못 찾은 것 순서
    const rank = (id: ItemId) => (inventory.get(id) > 0 ? 0 : inventory.discovered(id) ? 1 : 2);
    const ids = [...ITEM_IDS].sort((x, y) => rank(x) - rank(y));
    const rows = Math.ceil(ids.length / cols);
    const contentH = rows * rowH;
    const headH = 64;
    const footH = 40;
    const PH = Math.min(H - 70, headH + contentH + footH);
    const viewH = PH - headH - footH;
    const { box, close: closeStorage } = this.modal(PW, PH);
    let useBtn: Phaser.GameObjects.Container | undefined;
    const fit = Math.min(1, (H - 24) / PH, (W - 12) / PW);
    const top = -PH / 2;
    const found = ITEM_IDS.filter((id) => inventory.discovered(id)).length;
    const kinds = ITEM_IDS.filter((id) => inventory.get(id) > 0).length;
    box.add(this.add.text(0, top + 24, '🧺 가족 창고', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 48, `가진 것 ${kinds}종 · 📖 도감 ${found}/${ITEM_IDS.length}`, { fontFamily: FONT, fontSize: '12px', color: '#e07a5f', fontStyle: 'bold' }).setOrigin(0.5));
    const maxScroll = Math.max(0, contentH - viewH);
    const info = this.add.text(0, PH / 2 - 20, maxScroll > 0 ? '위아래로 밀어서 더 봐요 · 눌러서 개수 확인' : '눌러서 개수를 확인해요', { fontFamily: FONT, fontSize: '12px', color: '#8a6d4b', fontStyle: 'bold' }).setOrigin(0.5);
    box.add(info);

    // 스크롤되는 목록
    const gridTop = top + headH;
    const list = this.add.container(0, gridTop);
    box.add(list);
    const icons: Phaser.GameObjects.Image[] = [];
    ids.forEach((id, i) => {
      const cx = -PW / 2 + 14 + cell * (i % cols) + cell / 2;
      const cy = rowH * Math.floor(i / cols) + rowH / 2;
      const known = inventory.discovered(id);
      const count = inventory.get(id);
      const sg = this.add.graphics();
      sg.fillStyle(count > 0 ? 0xfde8b0 : 0xf3ecdb).fillRoundedRect(cx - cell / 2 + 3, cy - rowH / 2 + 3, cell - 6, rowH - 6, 10);
      const ic = this.add.image(cx, cy - 9, itemKey(id)).setScale(1.6);
      if (!known) ic.setTintFill(0xd5ccb8);
      else if (count === 0) ic.setAlpha(0.5);
      icons.push(ic);
      const name = this.add
        .text(cx, cy + rowH / 2 - 12, known ? ITEMS[id].name : '???', { fontFamily: FONT, fontSize: '9px', color: count > 0 ? COLORS.uiText : '#b3a892', fontStyle: 'bold' })
        .setOrigin(0.5);
      if (name.width > cell - 8) name.setScale((cell - 8) / name.width);
      list.add([sg, ic, name]);
      if (count > 0) {
        list.add(
          this.add
            .text(cx + cell / 2 - 7, cy - rowH / 2 + 12, String(count), { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold', stroke: '#fff8e7', strokeThickness: 3 })
            .setOrigin(1, 0.5),
        );
      }
    });
    // 목록 밖으로 나간 줄은 가린다
    const mg = this.make.graphics({}, false);
    mg.fillStyle(0xffffff).fillRect(W / 2 - (PW / 2) * fit, H / 2 + gridTop * fit, PW * fit, viewH * fit);
    list.setMask(mg.createGeometryMask());
    box.once('destroy', () => mg.destroy());
    // 스크롤 막대
    const bar = this.add.graphics();
    box.add(bar);
    const drawBar = () => {
      bar.clear();
      if (maxScroll <= 0) return;
      const bh = Math.max(24, (viewH * viewH) / contentH);
      const by = gridTop + ((viewH - bh) * (gridTop - list.y)) / maxScroll;
      bar.fillStyle(0xe8d5a9).fillRoundedRect(PW / 2 - 9, gridTop + 2, 4, viewH - 4, 2);
      bar.fillStyle(0xc9a66b).fillRoundedRect(PW / 2 - 9, by, 4, bh, 2);
    };
    drawBar();
    // 밀면 스크롤, 톡 누르면 그 칸 정보
    const zone = this.add.rectangle(0, gridTop + viewH / 2, PW - 8, viewH, 0, 0).setInteractive();
    box.add(zone);
    let drag: { py: number; ly: number; moved: boolean } | null = null;
    zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      drag = { py: p.y, ly: list.y, moved: false };
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!drag || !p.isDown) return;
      if (Math.abs(p.y - drag.py) > 8) drag.moved = true;
      if (!drag.moved) return;
      list.y = Phaser.Math.Clamp(drag.ly + (p.y - drag.py) / fit, gridTop - maxScroll, gridTop);
      drawBar();
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = drag;
      drag = null;
      if (!d || d.moved) return;
      // 누른 칸 찾기 (창 안 좌표로 바꿔서)
      const lx = (p.x - W / 2) / fit + PW / 2 - 14;
      const ly = (p.y - H / 2) / fit - list.y;
      const col = Math.floor(lx / cell);
      const row = Math.floor(ly / rowH);
      const i = row * cols + col;
      if (col < 0 || col >= cols || row < 0 || i >= ids.length) return;
      const id = ids[i];
      const known = inventory.discovered(id);
      sfx.tap();
      info.setText(known ? `${ITEMS[id].name} · ${inventory.get(id)}개` : '❓ 아직 못 찾았어요');
      useBtn?.destroy();
      useBtn = undefined;
      if ((USABLE.has(id) || FOODS[id]) && inventory.get(id) > 0) {
        info.setX(-44);
        if (FOODS[id]) info.setText(`${ITEMS[id].name} · ${foodText(id)}`);
        useBtn = this.button(FOODS[id] ? '먹기' : '쓰기', true, () => {
          closeStorage();
          if (this.view !== 'explore') return void this.toast('탐험 화면에서 쓸 수 있어요');
          this.time.delayedCall(220, () => this.game.events.emit('use-item', id));
        }, 76);
        useBtn.setPosition(PW / 2 - 56, PH / 2 - 21).setScale(0.8);
        box.add(useBtn);
      } else {
        info.setX(0);
      }
      this.tweens.add({ targets: icons[i], scale: { from: 2.1, to: 1.6 }, duration: 220, ease: 'Back.easeOut' });
    });
    zone.on('pointerout', () => {
      drag = null;
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
    this.sideBtns.forEach((b) => b.setVisible(v === 'explore'));
    this.emoteRow?.setVisible(false);
    this.refreshFeedBtn();
    this.arrow.setVisible(false);
    this.hideHint();
    this.refreshTabs();
    this.rebuildBuildTray();
    this.refreshQuestPill();
    if (v === 'build') this.toast('🏝️ 집·길·울타리를 골라 마을을 지어 봐요');
  }

  /** 꾸미기 모드: 도구 · 종류 · 지을 것 고르기 + 마을 점수 */
  private rebuildBuildTray() {
    this.buildTray?.destroy();
    this.buildTray = undefined;
    if (this.view !== 'build') return;
    const W = this.scale.width;
    const H = this.scale.height;
    const h = 176;
    const top = H - HUD_BOTTOM_H - h + 2;
    const tray = this.add.container(0, 0).setDepth(30);
    this.buildTray = tray;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(10, top + 3, W - 20, h, 16);
    bg.fillStyle(COLORS.uiBg, 0.97).fillRoundedRect(10, top, W - 20, h, 16);
    bg.lineStyle(2, 0xe8d5a9).strokeRoundedRect(10, top, W - 20, h, 16);
    // 판 전체가 터치를 받아서, 아래 섬으로 새지 않게 한다
    const block = this.add.rectangle(W / 2, top + h / 2, W - 20, h, 0, 0).setInteractive();
    tray.add([bg, block]);
    const redraw = () => this.time.delayedCall(0, () => this.rebuildBuildTray());
    const chip = (x: number, y: number, w: number, label: string, on: boolean, onTap: () => void, size = 12) => {
      const g = this.add.graphics();
      g.fillStyle(on ? 0xffd166 : 0xfde8b0).fillRoundedRect(x, y - 13, w, 26, 13);
      if (on) g.lineStyle(2, 0xe07a5f).strokeRoundedRect(x, y - 13, w, 26, 13);
      const t = this.add.text(x + w / 2, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5);
      const hit = this.add.rectangle(x + w / 2, y, w, 30, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        sfx.tap();
        onTap();
        redraw();
      });
      tray.add([g, t, hit]);
    };

    // 1) 마을 점수
    const score = village.score();
    const next = RESIDENTS.filter((r) => !village.isJoined(r.id) && progress.canVisit(r.island)).sort((a, b) => a.score - b.score)[0] ?? null;
    tray.add(this.add.text(22, top + 15, `⭐ 마을 점수 ${score}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    tray.add(
      this.add
        .text(W - 22, top + 15, next ? (score >= next.score ? `🏠 ${next.name}: 이사 올 준비 됐어요` : `🏠 ${next.name}까지 ${next.score - score}점`) : '🏠 친구가 모두 모였어요!', { fontFamily: FONT, fontSize: '11px', color: '#e07a5f', fontStyle: 'bold' })
        .setOrigin(1, 0.5),
    );

    // 2) 도구
    const tool = (this.registry.get('buildTool') as string) ?? 'place';
    const flip = !!this.registry.get('buildFlip');
    const tw = 62;
    ([['place', '🔨 짓기'], ['move', '✋ 옮기기'], ['erase', '🧹 치우기']] as const).forEach(([id, label], i) => {
      chip(20 + i * (tw + 4), top + 42, tw, label, tool === id, () => this.registry.set('buildTool', id), 11);
    });
    chip(W - 20 - 2 * 58 - 4, top + 42, 58, flip ? '↔ 뒤집힘' : '↔ 뒤집기', flip, () => this.registry.set('buildFlip', !flip), 11);
    chip(W - 20 - 58, top + 42, 58, '🔍 멀리', false, () => this.game.events.emit('build-zoom'), 11);

    // 3) 종류
    let cat = (this.registry.get('buildCat') as BuildCat) ?? 'path';
    if (!BUILD_CATS.some((c) => c.id === cat)) cat = 'path';
    const cw = (W - 40 - 5 * 4) / 6;
    BUILD_CATS.forEach((c, i) => {
      chip(20 + i * (cw + 4), top + 72, cw, c.label, c.id === cat, () => {
        this.registry.set('buildCat', c.id);
        this.registry.set('buildPage', 0);
      }, 11);
    });

    // 4) 지을 것 (한 쪽에 6개)
    const list = PIECE_LIST.filter((p) => p.cat === cat);
    const pages = Math.ceil(list.length / 6);
    const page = Math.min((this.registry.get('buildPage') as number) ?? 0, pages - 1);
    const shown = list.slice(page * 6, page * 6 + 6);
    let sel = PIECES[this.registry.get('buildPiece') as string];
    if (!sel || sel.cat !== cat) {
      sel = shown[0];
      this.registry.set('buildPiece', sel.id);
    }
    const canPay = (p: Piece) => (Object.entries(p.cost) as [ItemId, number][]).every(([id, n]) => inventory.get(id) >= n);
    const slot = 48;
    const x0 = 22;
    shown.forEach((p, i) => {
      const x = x0 + i * slot + slot / 2;
      const y = top + 112;
      const on = p.id === sel.id;
      const ok = canPay(p);
      const g = this.add.graphics();
      g.fillStyle(on ? 0xffd166 : 0xfde8b0).fillRoundedRect(x - 22, y - 22, 44, 44, 10);
      if (on) g.lineStyle(2.5, 0xe07a5f).strokeRoundedRect(x - 22, y - 22, 44, 44, 10);
      const ic = this.add.image(x, y, p.tex);
      ic.setScale(Math.min(36 / ic.width, 36 / ic.height, 1.5)).setAlpha(ok ? 1 : 0.45);
      const hit = this.add.rectangle(x, y, 46, 46, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        sfx.tap();
        this.registry.set('buildPiece', p.id);
        this.registry.set('buildTool', 'place');
        redraw();
      });
      tray.add([g, ic, hit]);
    });
    if (pages > 1) {
      chip(W - 20 - 28, top + 112, 28, page + 1 < pages ? '▶' : '◀', false, () => this.registry.set('buildPage', (page + 1) % pages), 12);
    }

    // 5) 고른 것: 이름 · 크기 · 점수 · 재료
    const size = sel.w * sel.h > 1 ? ` · ${sel.w}×${sel.h}칸` : '';
    tray.add(this.add.text(22, top + 150, `${sel.name}${size}${sel.points ? ` · ⭐${sel.points}` : ''}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    let cx = W - 22;
    (Object.entries(sel.cost) as [ItemId, number][]).reverse().forEach(([id, n]) => {
      const have = inventory.get(id);
      const t = this.add.text(cx, top + 150, `${have}/${n}`, { fontFamily: FONT, fontSize: '12px', color: have >= n ? '#4f8f43' : '#d1495b', fontStyle: 'bold' }).setOrigin(1, 0.5);
      cx -= t.width + 3;
      const ic = this.add.image(cx - 9, top + 150, itemKey(id)).setScale(0.8);
      cx -= 26;
      tray.add([t, ic]);
    });
    tray.add(this.add.text(W / 2, top + 167, '화면을 끌어서 둘러보고, 땅을 톡 눌러 지어요 · 치우면 재료를 돌려받아요', { fontFamily: FONT, fontSize: '8px', color: '#a08a6a' }).setOrigin(0.5));
  }

  /** 주민의 부탁 */
  private openOrder(id: string) {
    if (this.registry.get('modal')) return;
    const r = RESIDENTS.find((v) => v.id === id);
    if (!r) return;
    const hearts = village.hearts(id);
    const order = village.order(id);
    const PW = Math.min(310, this.scale.width - 30);
    const crowns = inventory.get('flower_crown');
    const PH = (order ? 340 : 230) + (crowns > 0 ? 50 : 0);
    const { box, close } = this.modal(PW, PH);
    if (crowns > 0) {
      // 꽃 왕관 선물: 부탁과 상관없이 호감도 +2
      const gb = this.button(`🌼 꽃 왕관 선물하기 (+2💗) · ${crowns}개`, true, () => {
        inventory.add('flower_crown', -1);
        const h = village.gift(id, 2);
        close();
        sfx.fanfare();
        this.celebrate(`💗 ${r.name}: "우와, 예뻐요!"\n호감도 ${h}`);
      }, 240);
      gb.setPosition(0, PH / 2 - 34).setScale(0.86);
      (gb.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(0xf28fb1).fillRoundedRect(-120, -20, 240, 40, 20);
      (gb.list[1] as Phaser.GameObjects.Text).setStroke('#c25f85', 3);
      box.add(gb);
    }
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
      quests.bump('order');
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
    btn.setPosition(0, PH / 2 - 36 - (crowns > 0 ? 50 : 0));
    box.add(btn);
  }

  /**
   * 창 안에 위아래로 미는 목록을 만든다. rows(list)로 내용을 그리고, 톡 누른 곳은 onTap(목록 안 좌표)으로 알려 준다.
   */
  private scrollList(box: Phaser.GameObjects.Container, PW: number, PH: number, gridTop: number, viewH: number, contentH: number, onTap: (x: number, y: number) => void) {
    const W = this.scale.width;
    const H = this.scale.height;
    const fit = Math.min(1, (H - 24) / PH, (W - 12) / PW);
    const list = this.add.container(0, gridTop);
    box.add(list);
    const mg = this.make.graphics({}, false);
    mg.fillStyle(0xffffff).fillRect(W / 2 - (PW / 2) * fit, H / 2 + gridTop * fit, PW * fit, viewH * fit);
    list.setMask(mg.createGeometryMask());
    box.once('destroy', () => mg.destroy());
    const maxScroll = Math.max(0, contentH - viewH);
    const bar = this.add.graphics();
    box.add(bar);
    const drawBar = () => {
      bar.clear();
      if (maxScroll <= 0) return;
      const bh = Math.max(24, (viewH * viewH) / contentH);
      bar.fillStyle(0xe8d5a9).fillRoundedRect(PW / 2 - 9, gridTop + 2, 4, viewH - 4, 2);
      bar.fillStyle(0xc9a66b).fillRoundedRect(PW / 2 - 9, gridTop + ((viewH - bh) * (gridTop - list.y)) / maxScroll, 4, bh, 2);
    };
    drawBar();
    const zone = this.add.rectangle(0, gridTop + viewH / 2, PW - 8, viewH, 0, 0).setInteractive();
    box.add(zone);
    let drag: { py: number; ly: number; moved: boolean } | null = null;
    zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      drag = { py: p.y, ly: list.y, moved: false };
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!drag || !p.isDown) return;
      if (Math.abs(p.y - drag.py) > 8) drag.moved = true;
      if (!drag.moved) return;
      list.y = Phaser.Math.Clamp(drag.ly + (p.y - drag.py) / fit, gridTop - maxScroll, gridTop);
      drawBar();
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = drag;
      drag = null;
      if (d && !d.moved) onTap((p.x - W / 2) / fit, (p.y - H / 2) / fit - list.y);
    });
    zone.on('pointerout', () => {
      drag = null;
    });
    return list;
  }

  /** 조합 수첩: 보드에서 겹치면 되는 것들과 쓰임새 */
  private openCombos() {
    if (this.registry.get('modal')) return;
    const H = this.scale.height;
    const PW = Math.min(330, this.scale.width - 20);
    const rowH = 54;
    const contentH = COMBOS.length * rowH;
    const PH = Math.min(H - 70, 84 + contentH);
    const viewH = PH - 84;
    const { box } = this.modal(PW, PH);
    const top = -PH / 2;
    const made = COMBOS.filter((c) => inventory.discovered(c.out)).length;
    box.add(this.add.text(0, top + 26, `📖 조합 수첩  ${made}/${COMBOS.length}`, { fontFamily: FONT, fontSize: '19px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 50, '머지 보드에서 서로 다른 두 가지를 겹쳐요 · 밀어서 더 보기', { fontFamily: FONT, fontSize: '10px', color: '#a08a6a' }).setOrigin(0.5));
    const list = this.scrollList(box, PW, PH, top + 68, viewH, contentH, () => {});
    COMBOS.forEach((c, i) => {
      const y = i * rowH;
      const x = -PW / 2 + 14;
      const done = inventory.discovered(c.out);
      const g = this.add.graphics();
      g.fillStyle(done ? 0xfff0c9 : 0xf3ecd9).fillRoundedRect(x, y, PW - 30, rowH - 5, 12);
      list.add(g);
      // 재료를 아직 본 적 없으면 그림자로 (몬스터·다른 섬에서 나오는 것)
      const part = (id: ItemId, px: number) => {
        const im = this.add.image(px, y + 24, itemKey(id)).setScale(1.3);
        if (!inventory.discovered(id)) im.setTintFill(0xcfc4ab);
        list.add(im);
      };
      part(c.a, x + 22);
      list.add(this.add.text(x + 41, y + 24, '+', { fontFamily: FONT, fontSize: '13px', color: '#a08a6a', fontStyle: 'bold' }).setOrigin(0.5));
      part(c.b, x + 60);
      list.add(this.add.text(x + 81, y + 24, '→', { fontFamily: FONT, fontSize: '13px', color: '#a08a6a', fontStyle: 'bold' }).setOrigin(0.5));
      const out = this.add.image(x + 104, y + 24, itemKey(c.out)).setScale(1.5);
      if (!done) out.setTintFill(0xcfc4ab);
      list.add(out);
      list.add(this.add.text(x + 124, y + 8, done ? ITEMS[c.out].name : '???', { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }));
      list.add(this.add.text(x + 124, y + 27, c.use || foodText(c.out), { fontFamily: FONT, fontSize: '9px', color: '#8a6d4b', wordWrap: { width: PW - 30 - 132 } }));
    });
  }

  // ───────────────────────── 체력 · 음식 · 잠 ─────────────────────────

  /** 왼쪽 아래: 체력 막대 + 걸려 있는 음식 효과 + 도시락 버튼 (탐험 화면에서만) */
  private refreshStatus() {
    this.statusBar?.destroy();
    this.statusBar = undefined;
    if (!this.registry.get('bear') || this.view !== 'explore') return;
    const H = this.scale.height;
    const y = H - HUD_BOTTOM_H - 16;
    const c = this.add.container(12, y).setDepth(6);
    const hp = player.hp;
    const bw = 84;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.14).fillRoundedRect(0, -11, bw + 60, 26, 13);
    g.fillStyle(COLORS.uiBg, 0.95).fillRoundedRect(0, -13, bw + 60, 26, 13);
    g.fillStyle(0xe8d5a9).fillRoundedRect(24, -5, bw, 10, 5);
    const low = hp <= 30;
    if (hp > 0) g.fillStyle(low ? 0xe8604c : hp <= 60 ? 0xf2a93b : 0x8bd17c).fillRoundedRect(24, -5, Math.max(8, (bw * hp) / MAX_HP), 10, 5);
    c.add(g);
    c.add(this.add.text(13, 0, '❤️', { fontSize: '12px' }).setOrigin(0.5));
    c.add(this.add.text(24 + bw + 6, 0, String(hp), { fontFamily: FONT, fontSize: '11px', color: low ? '#d1495b' : COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    // 도시락: 가진 음식 먹기
    const foods = inventory.owned().filter((o) => FOODS[o.id]).length;
    const lb = this.add.container(bw + 82, 0);
    const lg = this.add.graphics();
    lg.fillStyle(0x000000, 0.14).fillCircle(0, 2, 15);
    lg.fillStyle(foods ? 0xffd166 : COLORS.uiBg).fillCircle(0, 0, 15);
    lb.add([lg, this.add.text(0, 0, '🍱', { fontSize: '15px' }).setOrigin(0.5)]);
    lb.setSize(34, 34).setInteractive({ useHandCursor: true });
    lb.on('pointerdown', () => {
      sfx.tap();
      this.openLunchbox();
    });
    c.add(lb);
    // 효과 아이콘 + 남은 초
    player.active().forEach(([k, sec], i) => {
      const x = bw + 112 + i * 40;
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.uiBg, 0.95).fillRoundedRect(x - 2, -11, 38, 22, 11);
      c.add(bg);
      c.add(this.add.text(x + 8, 0, BUFFS[k].emoji, { fontSize: '11px' }).setOrigin(0.5));
      c.add(this.add.text(x + 17, 0, String(sec), { fontFamily: FONT, fontSize: '10px', color: sec <= 10 ? '#d1495b' : COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    });
    if (low) this.tweens.add({ targets: c, alpha: 0.6, duration: 400, yoyo: true, repeat: -1 });
    this.statusBar = c;
  }

  /** 맞았을 때 화면 가장자리가 붉게 번쩍인다 */
  private onHurt() {
    const r = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xe8604c, 0.28).setOrigin(0).setDepth(250);
    this.tweens.add({ targets: r, alpha: 0, duration: 320, onComplete: () => r.destroy() });
  }

  /** 도시락: 가진 음식 목록에서 골라 먹는다 */
  private openLunchbox() {
    if (this.registry.get('modal') || !this.registry.get('bear')) return;
    const foods = inventory.owned().filter((o) => FOODS[o.id]).sort((a, b) => (FOODS[b.id]!.heal - FOODS[a.id]!.heal));
    const H = this.scale.height;
    const PW = Math.min(320, this.scale.width - 20);
    const rowH = 50;
    const contentH = Math.max(1, foods.length) * rowH;
    const PH = Math.min(H - 90, 96 + contentH);
    const viewH = PH - 96;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 26, '🍱 도시락', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 50, `❤️ 체력 ${player.hp}/${MAX_HP} · 음식을 눌러서 먹어요`, { fontFamily: FONT, fontSize: '11px', color: '#e07a5f', fontStyle: 'bold' }).setOrigin(0.5));
    if (foods.length === 0) {
      box.add(this.add.text(0, top + 96, '먹을 것이 없어요.\n과일을 따거나, 머지 탭에서 요리를 만들어요!', { fontFamily: FONT, fontSize: '12px', color: '#a08a6a', align: 'center' }).setOrigin(0.5));
      return;
    }
    const list = this.scrollList(box, PW, PH, top + 68, viewH, contentH, (_x, ly) => {
      const f = foods[Math.floor(ly / rowH)];
      if (!f) return;
      close();
      this.time.delayedCall(200, () => this.game.events.emit('use-item', f.id));
    });
    foods.forEach((o, i) => {
      const y = i * rowH;
      const x = -PW / 2 + 14;
      const g = this.add.graphics();
      g.fillStyle(0xfff0c9).fillRoundedRect(x, y, PW - 30, rowH - 5, 12);
      list.add(g);
      list.add(this.add.image(x + 24, y + 22, itemKey(o.id)).setScale(1.5));
      list.add(this.add.text(x + 48, y + 7, `${ITEMS[o.id].name}  ×${o.count}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.uiText, fontStyle: 'bold' }));
      list.add(this.add.text(x + 48, y + 26, foodText(o.id), { fontFamily: FONT, fontSize: '10px', color: '#8a6d4b' }));
      list.add(this.add.text(x + PW - 44, y + 22, '먹기', { fontFamily: FONT, fontSize: '12px', color: '#5fae52', fontStyle: 'bold' }).setOrigin(1, 0.5));
    });
  }

  /** 텐트·침대: 잠자기 */
  private openSleep() {
    if (this.registry.get('modal')) return;
    const PW = 280;
    const PH = 200;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 34, '💤 잠자기', { fontFamily: FONT, fontSize: '22px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 82, player.hp >= MAX_HP ? '지금은 쌩쌩해요!\n그래도 한숨 잘까요?' : `❤️ 체력 ${player.hp}/${MAX_HP}\n푹 자면 체력이 가득 차요`, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center' }).setOrigin(0.5));
    const btn = this.button('🛏️ 쿨쿨 자기', true, () => {
      close();
      this.time.delayedCall(200, () => this.game.events.emit('sleep'));
    }, 190);
    btn.setPosition(0, PH / 2 - 40);
    box.add(btn);
  }

  /** 섬 친구와 처음 만났을 때: 부탁을 들어주고 마을 점수가 되면 이사 온다 */
  private openFriend(id: string) {
    if (this.registry.get('modal')) return;
    const r = RESIDENTS.find((v) => v.id === id);
    if (!r || village.isJoined(id)) return;
    const PW = Math.min(310, this.scale.width - 30);
    const PH = 372;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.image(-PW / 2 + 48, top + 50, `${id}_front`).setScale(2));
    box.add(this.add.text(-PW / 2 + 92, top + 30, r.name, { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));
    box.add(this.add.text(-PW / 2 + 92, top + 56, `${ISLANDS[r.island].emoji} ${ISLANDS[r.island].name}에 사는 친구`, { fontFamily: FONT, fontSize: '12px', color: '#e07a5f', fontStyle: 'bold' }).setOrigin(0, 0.5));
    box.add(this.add.text(0, top + 116, `"${r.hello}"\n"${r.ask}"`, { fontFamily: FONT, fontSize: '13px', color: '#8a6d4b', align: 'center', wordWrap: { width: PW - 36 } }).setOrigin(0.5));
    const { ok } = this.needList(box, r.need, top + 196, PW);
    const score = village.score();
    const scoreOk = score >= r.score;
    box.add(
      this.add
        .text(0, top + 268, `${scoreOk ? '✅' : '⭐'} 마을 점수 ${Math.min(score, r.score)}/${r.score}${scoreOk ? '' : '  (꾸미기 탭에서 섬을 꾸며요)'}`, { fontFamily: FONT, fontSize: '12px', color: scoreOk ? '#5fae52' : '#a08a6a', fontStyle: 'bold' })
        .setOrigin(0.5),
    );
    const can = ok && scoreOk;
    const btn = this.button(can ? '🏠 우리 마을로 초대하기' : !ok ? '선물이 부족해요' : '마을 점수가 부족해요', can, () => {
      this.spend(r.need);
      close();
      village.join(id);
    }, 220);
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
    // 퀘스트 수첩 (받을 보상이 있으면 빨간 점)
    const qb = this.roundButton(30, HUD_TOP_H + 162, '📜', () => this.openQuestBook());
    this.questDot = this.add.circle(13, -13, 5, 0xe8604c).setStrokeStyle(1.5, 0xffffff).setVisible(false);
    qb.add(this.questDot);
    // 보물 도감
    this.roundButton(30, HUD_TOP_H + 118, '👑', () => {
      if (this.registry.get('bear')) this.openTreasures();
    });
    // 매일 선물 (안 받았으면 빨간 점)
    this.giftBtn = this.roundButton(30, HUD_TOP_H + 74, '🎁', () => {
      if (this.registry.get('bear')) this.openDaily();
    });
    this.giftDot = this.add.circle(13, -13, 5, 0xe8604c).setStrokeStyle(1.5, 0xffffff);
    this.giftBtn.add(this.giftDot);
    this.giftDot.setVisible(daily.ready);
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

  private onTreasureFound(island: number) {
    const t = TREASURES[island];
    const all = progress.treasureCount >= TREASURES.length;
    this.celebrate(all ? `👑 보물을 모두 모았어요!\n${t.name}` : `👑 보물 발견!\n${t.name}`);
    family.post(`👑 ${ISLANDS[island].name}의 보물 '${t.name}'을(를) 찾았어요`);
    this.time.delayedCall(2600, () => this.openTreasures());
  }

  /** 보물 도감 — 섬마다 하나씩, 모두 10개 */
  private openTreasures() {
    if (this.registry.get('modal')) return;
    const PW = 320;
    const PH = 404;
    const { box } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 30, `👑 섬의 보물  ${progress.treasureCount}/${TREASURES.length}`, { fontFamily: FONT, fontSize: '19px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 54, '섬의 지역을 모두 열면 보물 상자가 열려요', { fontFamily: FONT, fontSize: '11px', color: '#a08a6a' }).setOrigin(0.5));
    TREASURES.forEach((t, i) => {
      const found = progress.hasTreasure(i);
      const known = progress.canVisit(i);
      const x = -PW / 2 + 16 + (i % 2) * 146;
      const y = top + 74 + Math.floor(i / 2) * 64;
      const g = this.add.graphics();
      g.fillStyle(found ? 0xffe9a8 : 0xf3ecd9).fillRoundedRect(x, y, 142, 58, 12);
      if (found) g.lineStyle(2, 0xf2a93b).strokeRoundedRect(x, y, 142, 58, 12);
      box.add(g);
      const icon = this.add.image(x + 28, y + 30, treasureKey(i)).setScale(1.5);
      if (!found) icon.setTintFill(0x5b4a3a).setAlpha(0.3);
      box.add(icon);
      box.add(this.add.text(x + 54, y + 8, known ? `${ISLANDS[i].emoji} ${ISLANDS[i].name}` : '🔒 ???', { fontFamily: FONT, fontSize: '10px', color: '#a08a6a' }));
      box.add(this.add.text(x + 54, y + 20, found ? t.name : '???', { fontFamily: FONT, fontSize: '13px', color: found ? COLORS.uiText : '#b3a892', fontStyle: 'bold' }));
      if (found) box.add(this.add.text(x + 54, y + 36, t.story, { fontFamily: FONT, fontSize: '8px', color: '#8a6d4b', wordWrap: { width: 84 } }));
    });
  }

  /** 매일 선물 달력 */
  private openDaily() {
    if (this.registry.get('modal')) return;
    const PW = 300;
    const PH = 312;
    const { box, close } = this.modal(PW, PH);
    const top = -PH / 2;
    box.add(this.add.text(0, top + 30, '🎁 매일 선물', { fontFamily: FONT, fontSize: '20px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5));
    box.add(this.add.text(0, top + 54, '하루에 한 번, 가족 모두 각자 받아요', { fontFamily: FONT, fontSize: '11px', color: '#a08a6a' }).setOrigin(0.5));
    const ready = daily.ready;
    const idx = daily.index;
    const cells: Phaser.GameObjects.Container[] = [];
    DAILY_REWARDS.forEach(([id, n], i) => {
      const last = i === 6;
      const cw = last ? 128 : 60;
      const x = last ? 68 : -102 + (i % 4) * 68;
      const y = top + 112 + Math.floor(i / 4) * 84;
      const got = i < idx;
      const now = ready && i === idx;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(now ? 0xffe9a8 : got ? 0xe9e3d3 : 0xfff6df).fillRoundedRect(-cw / 2, -36, cw, 72, 12);
      g.lineStyle(now ? 3 : 2, now ? 0xf2a93b : 0xe8d5a9).strokeRoundedRect(-cw / 2, -36, cw, 72, 12);
      const day = this.add.text(0, -25, `${i + 1}일`, { fontFamily: FONT, fontSize: '10px', color: '#a08a6a', fontStyle: 'bold' }).setOrigin(0.5);
      const icon = this.add.image(0, 0, itemKey(id)).setScale(last ? 1.6 : 1.3).setAlpha(got ? 0.35 : 1);
      const num = this.add.text(0, 25, `×${n}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(got ? 0.4 : 1);
      c.add([g, day, icon, num]);
      if (got) c.add(this.add.text(0, 0, '✔', { fontSize: '22px', color: '#5fae52', fontStyle: 'bold' }).setOrigin(0.5));
      if (now) this.tweens.add({ targets: icon, y: -3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      box.add(c);
      cells.push(c);
    });
    const btn = this.button(ready ? '선물 받기' : '내일 또 만나요!', ready, () => {
      const r = daily.claim();
      if (!r) return;
      const [id, n] = r;
      inventory.add(id, n);
      sfx.fanfare();
      buzz(30);
      this.giftDot.setVisible(false);
      this.tweens.add({ targets: cells[idx], scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });
      close();
      this.time.delayedCall(240, () => this.celebrate(`🎁 ${ITEMS[id].name} ×${n}`));
    }, 200);
    btn.setPosition(0, top + PH - 38);
    box.add(btn);
  }

  private openSettings() {
    if (this.registry.get('modal')) return;
    const PW = 280;
    const PH = 432;
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
    // 전체 화면: 안드로이드·PC는 바로, 아이폰은 홈 화면에 추가해야 한다
    const standalone = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    const fsOk = this.scale.fullscreen.available;
    const fsLabel = () => (this.scale.isFullscreen ? '⛶ 전체 화면 끄기' : '⛶ 전체 화면으로 보기');
    if (standalone) {
      box.add(this.add.text(0, top + 278, '⛶ 앱으로 실행 중 (전체 화면)', { fontFamily: FONT, fontSize: '12px', color: '#5fae52', fontStyle: 'bold' }).setOrigin(0.5));
    } else if (fsOk) {
      const fs = this.button(fsLabel(), true, () => {
        setSetting('fullscreen', !this.scale.isFullscreen);
        this.toggleFullscreen();
        close();
      }, 200);
      fs.setPosition(0, top + 278);
      (fs.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(0xf2a93b).fillRoundedRect(-100, -20, 200, 40, 20);
      (fs.list[1] as Phaser.GameObjects.Text).setStroke('#b9781f', 3);
      box.add(fs);
    } else {
      box.add(this.add.text(0, top + 278, '⛶ 전체 화면: 브라우저의 공유 버튼 →\n"홈 화면에 추가"로 설치하면 돼요', { fontFamily: FONT, fontSize: '11px', color: '#8a6d4b', fontStyle: 'bold', align: 'center' }).setOrigin(0.5));
    }
    let armed = false;
    const reset = this.button('처음부터 다시 하기', true, () => {
      if (!armed) {
        armed = true;
        (reset.list[1] as Phaser.GameObjects.Text).setText('정말요? 한 번 더!');
        return;
      }
      resetAll();
    }, 200);
    reset.setPosition(0, top + 340);
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
        this.time.delayedCall(400, () => this.refreshQuestPill());
        this.time.delayedCall(180, () => this.closeTitle(box, dim));
        // 오늘 선물을 아직 안 받았으면 달력을 먼저 보여 준다
        this.time.delayedCall(1100, () => {
          if (!daily.ready || this.registry.get('dailyShown')) return;
          this.registry.set('dailyShown', true);
          this.openDaily();
        });
        // 주소창 없이 넓게: 손가락이 닿은 이 순간에만 전체 화면을 켤 수 있다 (설정에서 끌 수 있음)
        if (settings.fullscreen && this.scale.fullscreen.available && !this.scale.isFullscreen) this.toggleFullscreen();
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

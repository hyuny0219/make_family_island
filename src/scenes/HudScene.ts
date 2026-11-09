import Phaser from 'phaser';
import { COLORS } from '../config';
import { sfx, unlockAudio, buzz } from '../sfx';

export const HUD_TOP_H = 56;
export const HUD_BOTTOM_H = 76;

const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

type Tab = { key: string; icon: string; label: string; enabled: boolean };
const TABS: Tab[] = [
  { key: 'explore', icon: '🗺️', label: '탐험', enabled: true },
  { key: 'merge', icon: '🧩', label: '머지', enabled: false },
  { key: 'build', icon: '🏝️', label: '꾸미기', enabled: false },
];

/** 화면 고정 UI: 상단 섬 이름, 하단 탭, 안내 문구, 타이틀 */
export class HudScene extends Phaser.Scene {
  private hint?: Phaser.GameObjects.Container;

  constructor() {
    super('Hud');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.makeTopBar(W);
    this.makeTabBar(W, H);
    this.makeHint(W, H);
    this.add
      .text(W - 6, H - HUD_BOTTOM_H - 6, `M0 · ${__BUILD_LABEL__.slice(0, 14)}`, { fontFamily: FONT, fontSize: '10px', color: '#ffffff' })
      .setOrigin(1, 1)
      .setAlpha(0.7);

    this.game.events.on('player-moved', this.hideHint, this);
    this.makeTitle(W, H);
  }

  private panel(x: number, y: number, w: number, h: number, r = 14) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillRoundedRect(x, y + 3, w, h, r);
    g.fillStyle(COLORS.uiBg).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(2, 0xe8d5a9).strokeRoundedRect(x, y, w, h, r);
    return g;
  }

  private makeTopBar(W: number) {
    const w = 170;
    this.panel((W - w) / 2, 10, w, 36, 18);
    this.add
      .text(W / 2, 28, '🏝️ 우리 가족 섬', { fontFamily: FONT, fontSize: '16px', color: COLORS.uiText, fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  private makeTabBar(W: number, H: number) {
    const y = H - HUD_BOTTOM_H + 8;
    this.panel(10, y, W - 20, HUD_BOTTOM_H - 18, 18);
    const slotW = (W - 20) / TABS.length;

    TABS.forEach((tab, i) => {
      const cx = 10 + slotW * i + slotW / 2;
      const cy = y + (HUD_BOTTOM_H - 18) / 2;
      const c = this.add.container(cx, cy);
      if (tab.enabled) {
        const bg = this.add.graphics();
        bg.fillStyle(0xffd166).fillRoundedRect(-slotW / 2 + 8, -24, slotW - 16, 48, 14);
        c.add(bg);
      }
      const icon = this.add.text(0, -8, tab.icon, { fontSize: '22px' }).setOrigin(0.5);
      const label = this.add
        .text(0, 15, tab.label, { fontFamily: FONT, fontSize: '12px', color: COLORS.uiText, fontStyle: 'bold' })
        .setOrigin(0.5);
      c.add([icon, label]);
      c.setAlpha(tab.enabled ? 1 : 0.45);
      c.setSize(slotW - 8, 52).setInteractive();
      c.on('pointerdown', () => {
        sfx.tap();
        buzz(8);
        this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 260, ease: 'Back.easeOut' });
        if (!tab.enabled) this.toast(`${tab.label} 탭은 곧 열려요!`);
      });
    });
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
    const c = this.add.container(W / 2, 80, [g, t]).setAlpha(0).setDepth(100);
    this.tweens.chain({
      targets: c,
      tweens: [
        { alpha: 1, y: 92, duration: 200, ease: 'Back.easeOut' },
        { alpha: 0, delay: 1100, duration: 250 },
      ],
      onComplete: () => c.destroy(),
    });
  }

  /** 시작 화면 — 첫 터치로 오디오 잠금 해제 */
  private makeTitle(W: number, H: number) {
    this.registry.set('started', false);
    const dim = this.add.rectangle(0, 0, W, H, 0x1b4965, 0.45).setOrigin(0).setDepth(200).setInteractive();

    const box = this.add.container(W / 2, H * 0.42).setDepth(201);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-130, -66, 260, 140, 26);
    g.fillStyle(COLORS.uiBg).fillRoundedRect(-130, -70, 260, 140, 26);
    g.lineStyle(3, 0xe8d5a9).strokeRoundedRect(-130, -70, 260, 140, 26);
    const title = this.add
      .text(0, -26, '가족 섬 만들기', { fontFamily: FONT, fontSize: '28px', color: COLORS.uiText, fontStyle: 'bold' })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 12, '🌴 우리 가족만의 섬 🌴', { fontFamily: FONT, fontSize: '14px', color: '#8a6d4b' })
      .setOrigin(0.5);
    const tap = this.add
      .text(0, 44, '화면을 톡 눌러 시작', { fontFamily: FONT, fontSize: '14px', color: '#e07a5f', fontStyle: 'bold' })
      .setOrigin(0.5);
    box.add([g, title, sub, tap]);

    box.setScale(0);
    this.tweens.add({ targets: box, scale: 1, duration: 600, ease: 'Back.easeOut', delay: 150 });
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });

    dim.once('pointerup', () => {
      unlockAudio();
      sfx.pop();
      buzz(20);
      this.tweens.add({
        targets: box,
        scale: 0,
        duration: 280,
        ease: 'Back.easeIn',
        onComplete: () => box.destroy(),
      });
      this.tweens.add({
        targets: dim,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          dim.destroy();
          this.registry.set('started', true);
          if (this.hint) this.tweens.add({ targets: this.hint, alpha: 1, duration: 400 });
        },
      });
    });
  }
}

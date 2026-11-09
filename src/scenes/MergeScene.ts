import Phaser from 'phaser';
import { COLORS } from '../config';
import { ITEMS, itemKey, type ItemId } from '../data/items';
import { MERGE_NEXT, RECIPES, isMergeable, type Recipe } from '../data/merge';
import { BOARD_COLS, BOARD_ROWS, loadBoard, saveBoard, type Cell } from '../state/board';
import { inventory } from '../state/inventory';
import { sfx, buzz } from '../sfx';
import { HUD_BOTTOM_H, HUD_TOP_H } from './HudScene';

const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const CELL = 50;
const ICON = 2; // 아이콘 확대 배율

type Mode = 'merge' | 'craft';

/**
 * 머지 탭: 개인 머지 보드 + 작업대.
 * - 머지: 같은 것 3개가 붙으면 다음 단계 1개 (5개 이상이면 2개)
 * - 작업대: 서로 다른 재료를 모아 레시피대로 만들기
 */
export class MergeScene extends Phaser.Scene {
  private cells: Cell[] = [];
  private sprites: (Phaser.GameObjects.Image | null)[] = [];
  private x0 = 0;
  private y0 = 0;
  private busy = false;
  private mode: Mode = 'merge';
  private mergeLayer!: Phaser.GameObjects.Container;
  private craftLayer!: Phaser.GameObjects.Container;
  private tray?: Phaser.GameObjects.Container;
  private craftList?: Phaser.GameObjects.Container;
  private pills: Partial<Record<Mode, { bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }>> = {};
  private drag: null | { idx: number; sp: Phaser.GameObjects.Image; sx: number; sy: number; moved: boolean } = null;
  private spark!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Merge');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.busy = false;
    this.drag = null;
    this.mode = 'merge';

    // 배경 (아래 섬 화면으로 터치가 새지 않게 막는 역할도 한다)
    this.add.rectangle(0, 0, W, H, 0xfdf3d7).setOrigin(0).setInteractive();
    const dots = this.add.graphics();
    dots.fillStyle(0xf6e4b5, 0.8);
    for (let y = 12; y < H; y += 24) for (let x = (y / 24) % 2 ? 12 : 24; x < W; x += 24) dots.fillCircle(x, y, 2);

    this.makePills(W);

    this.mergeLayer = this.add.container(0, 0);
    this.craftLayer = this.add.container(0, 0).setVisible(false);

    // ── 머지 보드 ──
    this.x0 = (W - BOARD_COLS * CELL) / 2;
    this.y0 = HUD_TOP_H + 50;
    const bw = BOARD_COLS * CELL;
    const bh = BOARD_ROWS * CELL;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.12).fillRoundedRect(this.x0 - 8, this.y0 - 8 + 4, bw + 16, bh + 16, 18);
    g.fillStyle(0xe9c98a).fillRoundedRect(this.x0 - 8, this.y0 - 8, bw + 16, bh + 16, 18);
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        g.fillStyle((r + c) % 2 ? 0xfff6dc : 0xfdebbd).fillRoundedRect(this.x0 + c * CELL + 2, this.y0 + r * CELL + 2, CELL - 4, CELL - 4, 9);
      }
    }
    this.mergeLayer.add(g);
    this.mergeLayer.add(
      this.add
        .text(W / 2, this.y0 + bh + 20, '같은 것 3개를 붙이면 합체! · 톡 누르면 창고로', { fontFamily: FONT, fontSize: '11px', color: '#a08a6a' })
        .setOrigin(0.5),
    );

    this.cells = loadBoard();
    this.sprites = this.cells.map(() => null);
    this.cells.forEach((id, i) => id && this.put(i, id, false));

    this.spark = this.add.particles(0, 0, 'sparkle', { emitting: false, speed: { min: 30, max: 90 }, lifespan: 500, scale: { start: 2.2, end: 0 }, tint: [0xffffff, 0xffe066, 0xffb3c7] }).setDepth(60);

    this.rebuildTray();
    this.rebuildCraft();

    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    inventory.on('changed', this.onInventory, this);
    this.events.once('shutdown', () => {
      inventory.off('changed', this.onInventory, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      saveBoard(this.cells);
    });
  }

  // ───────────────────────── 위쪽 전환 버튼 ─────────────────────────

  private makePills(W: number) {
    const y = HUD_TOP_H + 16;
    const defs: [Mode, string][] = [
      ['merge', '🧩 합치기'],
      ['craft', '🔨 작업대'],
    ];
    const w = 104;
    defs.forEach(([mode, text], i) => {
      const x = W / 2 + (i - 0.5) * (w + 8);
      const bg = this.add.graphics();
      const label = this.add.text(x, y, text, { fontFamily: FONT, fontSize: '14px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0.5);
      const hit = this.add.rectangle(x, y, w, 34, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.registry.get('modal')) return;
        sfx.tap();
        this.setMode(mode);
      });
      this.pills[mode] = { bg, label };
      bg.setData('x', x - w / 2).setData('y', y - 17).setData('w', w);
    });
    this.setMode('merge');
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    (Object.keys(this.pills) as Mode[]).forEach((m) => {
      const { bg } = this.pills[m]!;
      const on = m === mode;
      const [x, y, w] = [bg.getData('x') as number, bg.getData('y') as number, bg.getData('w') as number];
      bg.clear();
      bg.fillStyle(0x000000, 0.12).fillRoundedRect(x, y + 3, w, 34, 17);
      bg.fillStyle(on ? 0xffd166 : 0xfff8e7).fillRoundedRect(x, y, w, 34, 17);
      bg.lineStyle(2, on ? 0xe8b84a : 0xe8d5a9).strokeRoundedRect(x, y, w, 34, 17);
    });
    this.mergeLayer?.setVisible(mode === 'merge');
    this.craftLayer?.setVisible(mode === 'craft');
    this.sprites.forEach((s) => s?.setVisible(mode === 'merge'));
  }

  private onInventory() {
    this.rebuildTray();
    this.rebuildCraft();
  }

  // ───────────────────────── 보드 ─────────────────────────

  private pos(idx: number) {
    return { x: this.x0 + (idx % BOARD_COLS) * CELL + CELL / 2, y: this.y0 + Math.floor(idx / BOARD_COLS) * CELL + CELL / 2 };
  }

  private cellAt(x: number, y: number) {
    const c = Math.floor((x - this.x0) / CELL);
    const r = Math.floor((y - this.y0) / CELL);
    if (c < 0 || r < 0 || c >= BOARD_COLS || r >= BOARD_ROWS) return -1;
    return r * BOARD_COLS + c;
  }

  /** 칸에 아이템 놓기 */
  private put(idx: number, id: ItemId, pop: boolean, from?: { x: number; y: number }) {
    const { x, y } = this.pos(idx);
    const sp = this.add.image(from?.x ?? x, from?.y ?? y, itemKey(id)).setScale(ICON).setDepth(10);
    sp.setInteractive({ useHandCursor: true });
    sp.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(sp, p));
    sp.setVisible(this.mode === 'merge');
    this.cells[idx] = id;
    this.sprites[idx] = sp;
    if (from) this.tweens.add({ targets: sp, x, y, duration: 180, ease: 'Cubic.easeOut' });
    if (pop) {
      sp.setScale(0);
      this.tweens.add({ targets: sp, scale: ICON, duration: 320, ease: 'Back.easeOut' });
    }
    return sp;
  }

  private neighbors(idx: number) {
    const c = idx % BOARD_COLS;
    const out: number[] = [];
    if (c > 0) out.push(idx - 1);
    if (c < BOARD_COLS - 1) out.push(idx + 1);
    if (idx >= BOARD_COLS) out.push(idx - BOARD_COLS);
    if (idx < BOARD_COLS * (BOARD_ROWS - 1)) out.push(idx + BOARD_COLS);
    return out;
  }

  /** idx와 이어진 같은 종류 묶음 (kind를 주면 idx 칸이 그 종류라고 가정) */
  private group(idx: number, kind = this.cells[idx]) {
    const seen = new Set([idx]);
    const stack = [idx];
    while (stack.length) {
      const a = stack.pop()!;
      for (const n of this.neighbors(a)) {
        if (!seen.has(n) && this.cells[n] === kind) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return [...seen];
  }

  /** 3개 이상 붙었으면 합치기 (연쇄 합체 포함) */
  private tryMerge(idx: number) {
    const kind = this.cells[idx];
    const next = kind ? MERGE_NEXT[kind] : undefined;
    const grp = kind ? this.group(idx) : [];
    if (!kind || !next || grp.length < 3) {
      this.busy = false;
      saveBoard(this.cells);
      return;
    }
    this.busy = true;
    const { x, y } = this.pos(idx);
    const two = grp.length >= 5;
    for (const gi of grp) {
      const sp = this.sprites[gi]!;
      this.sprites[gi] = null;
      this.cells[gi] = null;
      sp.disableInteractive();
      this.tweens.add({ targets: sp, x, y, scale: ICON * 0.7, duration: 170, ease: 'Cubic.easeIn', onComplete: () => sp.destroy() });
    }
    this.time.delayedCall(190, () => {
      this.put(idx, next, true);
      if (two) this.put(grp.find((gi) => gi !== idx)!, next, true);
      this.spark.explode(12, x, y);
      sfx.merge();
      buzz(25);
      if (inventory.discover(next)) {
        this.game.events.emit('celebrate', `✨ 새로운 발견!\n${ITEMS[next].name}`);
      } else {
        this.floatText(x, y - 24, two ? `${ITEMS[next].name} ×2!` : ITEMS[next].name);
      }
      this.time.delayedCall(280, () => this.tryMerge(idx));
    });
  }

  private floatText(x: number, y: number, msg: string) {
    const t = this.add
      .text(x, y, msg, { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#4a3b2a', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: t, y: y - 22, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ───────────────────────── 끌기 ─────────────────────────

  private onDown(sp: Phaser.GameObjects.Image, p: Phaser.Input.Pointer) {
    if (this.busy || this.drag || this.registry.get('modal') || this.mode !== 'merge') return;
    const idx = this.sprites.indexOf(sp);
    if (idx < 0) return;
    this.drag = { idx, sp, sx: p.x, sy: p.y, moved: false };
    sp.setDepth(50);
    this.tweens.add({ targets: sp, scale: ICON * 1.15, duration: 100 });
  }

  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    // 다른 화면 요소 위에서 손을 떼면 pointerup을 못 받을 수 있다 → 여기서 마무리
    if (!p.isDown) return this.onUp(p);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 8) d.moved = true;
    if (d.moved) d.sp.setPosition(p.x, p.y - 12);
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const { idx, sp } = d;
    const id = this.cells[idx]!;
    sp.setDepth(10);
    this.tweens.add({ targets: sp, scale: ICON, duration: 100 });

    const target = d.moved ? this.cellAt(p.x, p.y) : -1;
    // 톡 누르기 / 보드 밖으로 끌기 → 창고로
    if (!d.moved || target === -1) {
      if (d.moved && p.y > this.y0 - 20 && p.y < this.y0 + BOARD_ROWS * CELL + 20 && (p.x < this.x0 - 20 || p.x > this.x0 + BOARD_COLS * CELL + 20)) {
        return this.snapBack(idx); // 옆으로 살짝 벗어난 건 실수로 보고 되돌리기
      }
      return this.store(idx, id);
    }
    if (target === idx) return this.snapBack(idx);

    // 빈 칸이면 이동, 다른 게 있으면 자리 바꾸기
    const other = this.sprites[target];
    const otherId = this.cells[target];
    this.sprites[target] = sp;
    this.cells[target] = id;
    this.sprites[idx] = other ?? null;
    this.cells[idx] = otherId ?? null;
    const tp = this.pos(target);
    this.tweens.add({ targets: sp, x: tp.x, y: tp.y, duration: 120, ease: 'Cubic.easeOut' });
    if (other) {
      const op = this.pos(idx);
      this.tweens.add({ targets: other, x: op.x, y: op.y, duration: 160, ease: 'Cubic.easeOut' });
    }
    sfx.tap();
    this.busy = true;
    this.time.delayedCall(170, () => {
      this.tryMerge(target);
      // 자리를 바꾼 쪽도 합쳐질 수 있다
      if (other) this.time.delayedCall(520, () => !this.busy && this.cells[idx] && this.tryMerge(idx));
    });
  }

  private snapBack(idx: number) {
    const sp = this.sprites[idx];
    if (!sp) return;
    const { x, y } = this.pos(idx);
    this.tweens.add({ targets: sp, x, y, duration: 160, ease: 'Back.easeOut' });
  }

  /** 보드 → 창고 */
  private store(idx: number, id: ItemId) {
    const sp = this.sprites[idx];
    if (!sp) return;
    this.sprites[idx] = null;
    this.cells[idx] = null;
    saveBoard(this.cells);
    sp.disableInteractive();
    sfx.pop();
    this.tweens.add({
      targets: sp,
      x: this.scale.width - 60,
      y: 28,
      scale: ICON * 0.5,
      duration: 300,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        sp.destroy();
        inventory.add(id, 1);
      },
    });
  }

  // ───────────────────────── 창고에서 꺼내기 ─────────────────────────

  private rebuildTray() {
    this.tray?.destroy();
    const W = this.scale.width;
    const H = this.scale.height;
    const top = this.y0 + BOARD_ROWS * CELL + 36;
    const tray = this.add.container(0, 0);
    this.tray = tray;
    this.mergeLayer.add(tray);

    const items = inventory
      .owned()
      .filter((o) => isMergeable(o.id) && MERGE_NEXT[o.id])
      .slice(0, 12);
    const perRow = 6;
    const slot = Math.min(54, (W - 24) / perRow);
    const rows = Math.max(1, Math.ceil(items.length / perRow));
    const th = Math.min(rows * slot + 30, H - HUD_BOTTOM_H - top - 4);
    const g = this.add.graphics();
    g.fillStyle(0xfff8e7).fillRoundedRect(8, top, W - 16, th, 16);
    g.lineStyle(2, 0xe8d5a9).strokeRoundedRect(8, top, W - 16, th, 16);
    tray.add(g);
    tray.add(this.add.text(20, top + 13, '🧺 창고에서 꺼내기', { fontFamily: FONT, fontSize: '12px', color: COLORS.uiText, fontStyle: 'bold' }).setOrigin(0, 0.5));

    // 보드 정리 버튼
    const tidy = this.add
      .text(W - 20, top + 13, '모두 창고로 ▸', { fontFamily: FONT, fontSize: '12px', color: '#e07a5f', fontStyle: 'bold' })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    tidy.on('pointerdown', () => this.storeAll());
    tray.add(tidy);

    if (items.length === 0) {
      tray.add(this.add.text(W / 2, top + 26 + slot / 2, '합칠 재료가 없어요. 탐험에서 모아 와요!', { fontFamily: FONT, fontSize: '12px', color: '#a08a6a' }).setOrigin(0.5));
      return;
    }
    const x0 = (W - Math.min(items.length, perRow) * slot) / 2;
    items.forEach((o, i) => {
      const x = x0 + (i % perRow) * slot + slot / 2;
      const y = top + 26 + Math.floor(i / perRow) * slot + slot / 2;
      const bg = this.add.graphics();
      bg.fillStyle(0xfde8b0).fillRoundedRect(x - slot / 2 + 3, y - slot / 2 + 3, slot - 6, slot - 6, 10);
      const ic = this.add.image(x, y - 3, itemKey(o.id)).setScale(1.5);
      const ct = this.add
        .text(x + slot / 2 - 6, y + slot / 2 - 9, String(o.count), { fontFamily: FONT, fontSize: '11px', color: COLORS.uiText, fontStyle: 'bold', stroke: '#fff8e7', strokeThickness: 3 })
        .setOrigin(1, 0.5);
      const hit = this.add.rectangle(x, y, slot - 4, slot - 4, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.takeOut(o.id, x, y));
      tray.add([bg, ic, ct, hit]);
    });
  }

  /**
   * 놓을 빈 칸 고르기 (톡톡톡 누르면 저절로 합쳐지게):
   * 같은 것과 가장 크게 이어지는 칸 → 비슷하면 주변이 넓게 비어 있는 칸
   */
  private bestEmpty(id: ItemId) {
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i]) continue;
      const size = this.group(i, id).length;
      const free = this.neighbors(i).filter((n) => !this.cells[n]).length;
      const score = size * 10 + free;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  private takeOut(id: ItemId, fx: number, fy: number) {
    if (this.busy || this.registry.get('modal') || this.mode !== 'merge') return;
    if (inventory.get(id) <= 0) return;
    const idx = this.bestEmpty(id);
    if (idx < 0) {
      buzz(20);
      this.game.events.emit('toast', '보드가 꽉 찼어요! 합치거나 창고로 보내요');
      return;
    }
    this.busy = true;
    sfx.tap();
    this.put(idx, id, false, { x: fx, y: fy });
    inventory.add(id, -1); // → 'changed' → 트레이 다시 그림
    this.time.delayedCall(200, () => this.tryMerge(idx));
  }

  private storeAll() {
    if (this.busy || this.registry.get('modal')) return;
    let n = 0;
    this.cells.forEach((id, i) => {
      if (!id) return;
      this.time.delayedCall(n++ * 40, () => this.store(i, id));
    });
    if (n === 0) this.game.events.emit('toast', '보드가 이미 비어 있어요');
  }

  // ───────────────────────── 작업대 ─────────────────────────

  private rebuildCraft() {
    this.craftList?.destroy();
    const W = this.scale.width;
    const list = this.add.container(0, 0);
    this.craftList = list;
    this.craftLayer.add(list);
    const top = HUD_TOP_H + 44;
    const rowH = 66;
    RECIPES.forEach((r, i) => list.add(this.recipeCard(r, 10, top + i * rowH, W - 20, rowH - 6)));
  }

  private recipeCard(r: Recipe, x: number, y: number, w: number, h: number) {
    const c = this.add.container(x, y);
    const owned = inventory.get(r.id);
    const done = !!r.tool && owned > 0;
    const entries = Object.entries(r.need) as [ItemId, number][];
    const enough = entries.every(([id, n]) => inventory.get(id) >= n);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.1).fillRoundedRect(0, 3, w, h, 14);
    g.fillStyle(done ? 0xe6f4d9 : 0xfff8e7).fillRoundedRect(0, 0, w, h, 14);
    g.lineStyle(2, 0xe8d5a9).strokeRoundedRect(0, 0, w, h, 14);
    c.add(g);
    c.add(this.add.image(30, h / 2, itemKey(r.id)).setScale(1.9));
    const title = r.tool || owned === 0 ? ITEMS[r.id].name : `${ITEMS[r.id].name} (${owned}개)`;
    c.add(this.add.text(58, 9, title, { fontFamily: FONT, fontSize: '14px', color: COLORS.uiText, fontStyle: 'bold' }));
    c.add(this.add.text(58, 27, r.desc, { fontFamily: FONT, fontSize: '10px', color: '#a08a6a' }));
    // 필요 재료
    entries.forEach(([id, n], k) => {
      const nx = 66 + k * 58;
      const have = inventory.get(id);
      c.add(this.add.image(nx, h - 13, itemKey(id)).setScale(0.8));
      c.add(
        this.add
          .text(nx + 12, h - 13, `${Math.min(have, n)}/${n}`, { fontFamily: FONT, fontSize: '11px', color: have >= n ? '#3f8f3a' : '#c0573f', fontStyle: 'bold' })
          .setOrigin(0, 0.5),
      );
    });
    // 버튼
    const bw = 72;
    const bx = w - bw / 2 - 10;
    const by = h / 2;
    const can = enough && !done;
    const bg = this.add.graphics();
    bg.fillStyle(done ? 0xbfe3a8 : can ? 0x8bd17c : 0xd8d2c4).fillRoundedRect(bx - bw / 2, by - 17, bw, 34, 17);
    c.add(bg);
    c.add(
      this.add
        .text(bx, by, done ? '✓ 있어요' : '만들기', { fontFamily: FONT, fontSize: '13px', color: done ? '#3f8f3a' : can ? '#ffffff' : '#9a917f', fontStyle: 'bold' })
        .setOrigin(0.5),
    );
    if (!done) {
      const hit = this.add.rectangle(bx, by, bw, 40, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.registry.get('modal') || this.mode !== 'craft') return;
        if (!can) {
          buzz(20);
          this.game.events.emit('toast', '재료가 부족해요');
          return;
        }
        const first = !inventory.discovered(r.id);
        // 재료 차감 → 결과 지급 (changed 이벤트로 목록이 다시 그려진다)
        entries.forEach(([id, n]) => inventory.add(id, -n));
        inventory.add(r.id, 1);
        sfx.fanfare();
        buzz(40);
        this.spark.explode(16, x + 30, y + h / 2);
        this.game.events.emit('celebrate', first ? `🔨 ${ITEMS[r.id].name} 완성!\n${r.desc}` : `🔨 ${ITEMS[r.id].name} 완성!`);
      });
      c.add(hit);
    }
    return c;
  }
}

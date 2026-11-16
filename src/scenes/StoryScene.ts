import Phaser from 'phaser';
import type { CutPage } from '../data/story';
import { STORY_IMAGES } from '../data/story';
import { sfx } from '../sfx';
import { story } from '../state/story';

const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

interface StoryData {
  pages: CutPage[];
  /** 다 보면 적어 둘 이름 */
  key?: string;
  /** 게임을 켤 때 나온 오프닝이면 끝나고 섬을 시작한다 */
  boot?: boolean;
}

/**
 * 그림 이야기(오프닝·엔딩): 그림이 천천히 움직이고 아래에 자막이 한 글자씩 나온다.
 * 톡 누르면 다음 장, 오른쪽 위 단추로 건너뛴다.
 */
export class StoryScene extends Phaser.Scene {
  private pages: CutPage[] = [];
  private key?: string;
  private boot = false;
  private idx = -1;
  private img?: Phaser.GameObjects.Image;
  private caption!: Phaser.GameObjects.Text;
  private next!: Phaser.GameObjects.Text;
  private dots!: Phaser.GameObjects.Graphics;
  private full = '';
  private shown = 0;
  private typer?: Phaser.Time.TimerEvent;
  private auto?: Phaser.Time.TimerEvent;
  private done = false;
  private area = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super('Story');
  }

  init(data: StoryData) {
    this.pages = data.pages ?? [];
    this.key = data.key;
    this.boot = !!data.boot;
    this.idx = -1;
    this.done = false;
    this.img = undefined;
  }

  preload() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x1b2233);
    const wait = this.add.text(W / 2, H / 2, '📖 이야기를 펼치는 중…', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
    this.load.once('complete', () => wait.destroy());
    this.load.setPath('assets/story/');
    for (const k of STORY_IMAGES) if (!this.textures.exists(k)) this.load.image(k, `${k}.jpg`);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.registry.set('modal', true);
    this.registry.set('story', true);
    this.cameras.main.fadeIn(350, 27, 34, 51);
    const wide = W > H * 1.2;
    // 세로: 위쪽에 그림, 아래에 자막 / 가로: 화면 가득 그림, 아래쪽에 자막 띠
    const capH = wide ? 92 : 170;
    this.area = wide ? { x: 0, y: 0, w: W, h: H } : { x: 0, y: Math.max(0, (H - capH - W * 0.9) / 2), w: W, h: Math.min(H - capH, W * 0.9) };
    const mask = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(this.area.x, this.area.y, this.area.w, this.area.h);
    this.imgMask = mask.createGeometryMask();
    const band = this.add.graphics().setDepth(5);
    band.fillStyle(0x1b2233, wide ? 0.78 : 1).fillRect(0, H - capH, W, capH);
    this.caption = this.add
      .text(W / 2, H - capH + 16, '', { fontFamily: FONT, fontSize: wide ? '15px' : '16px', color: '#ffffff', align: 'center', lineSpacing: 7, wordWrap: { width: Math.min(W - 36, 560) } })
      .setOrigin(0.5, 0)
      .setDepth(6);
    this.next = this.add.text(W - 18, H - 14, '톡 ▶', { fontFamily: FONT, fontSize: '12px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(1, 1).setDepth(6).setAlpha(0);
    this.tweens.add({ targets: this.next, x: W - 13, duration: 500, yoyo: true, repeat: -1 });
    this.dots = this.add.graphics().setDepth(6);
    // 화면 어디든 누르면 다음
    const zone = this.add.zone(W / 2, H / 2, W, H).setInteractive().setDepth(1);
    zone.on('pointerdown', () => this.tap());
    // 건너뛰기
    const sk = this.add.container(W - 50, 26).setDepth(10);
    const sg = this.add.graphics();
    sg.fillStyle(0x000000, 0.45).fillRoundedRect(-38, -14, 76, 28, 14);
    sk.add([sg, this.add.text(0, 0, '건너뛰기 ⏭', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)]);
    sk.setSize(84, 40).setInteractive({ useHandCursor: true });
    sk.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.finish();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.tap());
    // 화면을 돌리면 처음 장부터 다시 짠다
    const onResize = () => {
      if (this.done) return;
      this.time.delayedCall(200, () => !this.done && this.scene.restart({ pages: this.pages, key: this.key, boot: this.boot }));
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      this.registry.set('story', false);
    });
    this.show(0);
  }

  private imgMask!: Phaser.Display.Masks.GeometryMask;

  private show(i: number) {
    if (i >= this.pages.length) return this.finish();
    this.idx = i;
    const p = this.pages[i];
    const a = this.area;
    const old = this.img;
    const tex = this.textures.get(p.img).getSourceImage();
    const cover = Math.max(a.w / tex.width, a.h / tex.height);
    const img = this.add.image(a.x + a.w / 2, a.y + a.h / 2, p.img).setMask(this.imgMask).setAlpha(0).setDepth(2);
    this.img = img;
    // 천천히 다가가거나 옆으로 흐른다 (장마다 번갈아)
    const z0 = cover * 1.04;
    const z1 = cover * 1.16;
    const slide = (tex.width * z1 - a.w) / 2;
    const dir = i % 2 ? 1 : -1;
    img.setScale(i % 3 === 2 ? z1 : z0);
    img.x += (dir * Math.min(slide, 26)) / 2;
    this.tweens.add({ targets: img, alpha: 1, duration: 500 });
    this.tweens.add({ targets: img, scale: i % 3 === 2 ? z0 : z1, x: img.x - dir * Math.min(slide, 26), duration: 9000, ease: 'Sine.easeInOut' });
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: 500, onComplete: () => old.destroy() });
    // 자막
    this.full = p.text;
    this.shown = 0;
    this.caption.setText('');
    this.next.setAlpha(0);
    this.typer?.remove();
    this.auto?.remove();
    this.typer = this.time.addEvent({
      delay: 42,
      loop: true,
      callback: () => {
        this.shown++;
        this.caption.setText(this.full.slice(0, this.shown));
        if (this.shown % 3 === 1 && this.full[this.shown - 1]?.trim()) sfx.step();
        if (this.shown >= this.full.length) this.typed();
      },
    });
    // 몇 번째 장인지 점으로
    const W = this.scale.width;
    const H = this.scale.height;
    this.dots.clear();
    const n = this.pages.length;
    for (let k = 0; k < n; k++) this.dots.fillStyle(0xffffff, k === i ? 1 : 0.35).fillCircle(W / 2 - (n - 1) * 6 + k * 12, H - 14, k === i ? 3.5 : 2.5);
  }

  private typed() {
    this.typer?.remove();
    this.typer = undefined;
    this.caption.setText(this.full);
    this.next.setAlpha(1);
    // 가만히 두어도 넘어간다
    this.auto = this.time.delayedCall(5200, () => this.show(this.idx + 1));
  }

  private tap() {
    if (this.done) return;
    if (this.typer) return this.typed();
    sfx.pop();
    this.show(this.idx + 1);
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.typer?.remove();
    this.auto?.remove();
    if (this.key) story.mark(this.key);
    this.cameras.main.fadeOut(400, 27, 34, 51);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.registry.set('modal', false);
      if (this.boot) {
        this.scene.start('Island');
        this.scene.launch('Hud');
      } else {
        this.scene.stop();
      }
    });
  }
}

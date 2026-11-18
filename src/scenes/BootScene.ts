import { WEAPON_STAGE_TEX } from '../data/weapons';
import { OPENING } from '../data/story';
import { story } from '../state/story';
import Phaser from 'phaser';
import { COLORS } from '../config';
import { BUILD_TEXTURES, ENTERABLE, TURN_TEXTURES } from '../data/build';
import { MONSTERS } from '../data/monsters';
import { ABILITIES, hatKey } from '../data/abilities';
import { SKINS, SKIN_OBJECTS } from '../data/islands';
import { BEARS, FACINGS, NO_LOAD, OBJECTS } from '../data/assets';
import { ITEM_IDS, itemKey } from '../data/items';
import { RESIDENTS } from '../data/village';

/**
 * 스프라이트 로드 + 작은 파티클 텍스처 생성.
 * 스프라이트 원본: art/source/*.png → scripts/process_art.py → public/assets/*.png
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.loadingScreen(W, H);
    // 받는 도중에 화면 크기가 바뀌면(전체 화면 전환, 회전) 그려 둔 로딩 화면이 잘리지 않게 카메라로 맞춘다
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x5bb3d6);
    const onResize = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      // 가로·세로가 뒤바뀌었으면 전체가 보이게 줄이고, 조금 달라진 정도면 빈 곳 없이 채운다
      const flipped = W > H !== w > h;
      cam.setZoom(flipped ? Math.min(w / W, h / H) : Math.max(w / W, h / H));
      cam.centerOn(W / 2, H / 2);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));

    this.load.setPath('assets/');
    this.load.spritesheet('tiles', 'tiles.png', { frameWidth: 24, frameHeight: 24, margin: 1, spacing: 2 });
    for (const b of BEARS) for (const f of FACINGS) this.load.image(`${b.id}_${f}`, `${b.id}_${f}.png`);
    // 동작 그림 네 장씩 (치켜들기, 내려치기, 주먹, 줍기)과 도구
    for (const b of BEARS) for (const f of FACINGS) for (const n of [1, 2, 3, 4]) this.load.image(`${b.id}_${f}_a${n}`, `${b.id}_${f}_a${n}.png`);
    for (const k of ['tool_axe', 'tool_pickaxe', 'fx_star', 'weapon_hammer', 'weapon_sling', 'weapon_water', 'weapon_flame', 'weapon_whip', 'weapon_pick', 'weapon_bomb', 'weapon_rang', 'weapon_mace', 'weapon_staff', 'fx_sting', ...WEAPON_STAGE_TEX]) this.load.image(k, `${k}.png`);
    // 걷는 그림 두 장씩
    for (const b of BEARS) for (const f of FACINGS) for (const w of [1, 2]) this.load.image(`${b.id}_${f}_w${w}`, `${b.id}_${f}_w${w}.png`);
    for (const r of RESIDENTS) for (const f of FACINGS) this.load.image(`${r.id}_${f}`, `${r.id}_${f}.png`);
    for (const o of OBJECTS) if (!NO_LOAD.has(o)) this.load.image(o, `${o}.png`);
    for (let i = 0; i < 10; i++) this.load.image(`treasure_${i}`, `treasure_${i}.png`);
    for (const k of ['chest_open', 'pedestal']) this.load.image(k, `${k}.png`);
    for (const k of ['play_dig', 'play_geode', 'play_ice', 'play_spring', 'play_tramp', 'play_hive', 'play_bud', 'play_log', 'play_shroom']) this.load.image(k, `${k}.png`);
    for (let i = 0; i < 10; i++) this.load.image(`boss_${i}`, `boss_${i}.png`);
    this.load.image('dungeon_gate', 'dungeon_gate.png');
    for (const ab of ABILITIES) this.load.image(hatKey(ab.id), `${hatKey(ab.id)}.png`);
    for (const k of Object.keys(MONSTERS)) this.load.image(`mon_${k}`, `mon_${k}.png`);
    this.load.image('mon_dummy', 'mon_dummy.png');
    // 연속기 이펙트 그림: 무기마다 마무리(f)·내려찍기(g) 3장씩 + 공통 칼자국·타격 별
    for (const id of ['leaf', 'bee', 'wood', 'bubble', 'rock', 'poison', 'ice', 'sand', 'fire', 'thunder', 'hit']) {
      for (const t of ['f', 'g']) for (const i of [1, 2, 3]) this.load.image(`fx_${id}_${t}${i}`, `fx/${id}_${t}${i}.png`);
    }
    for (const t of BUILD_TEXTURES) this.load.image(t, `${t}.png`);
    for (const t of TURN_TEXTURES()) this.load.image(t, `${t}.png`);
    // 2층을 올린 집의 모습
    for (const id of ENTERABLE) this.load.image(`build_${id}_2f`, `build_${id}_2f.png`);
    for (const skin of SKINS) {
      this.load.spritesheet(`tiles_${skin}`, `tiles_${skin}.png`, { frameWidth: 24, frameHeight: 24, margin: 1, spacing: 2 });
      for (const o of SKIN_OBJECTS) this.load.image(`${o}_${skin}`, `${o}_${skin}.png`);
    }
    for (const k of ['slime', 'slime_squash', 'slime_king', 'slime_pink', 'slime_squash_pink', 'slime_blue', 'slime_squash_blue']) this.load.image(k, `${k}.png`);
    for (const id of ITEM_IDS) this.load.image(itemKey(id), `${itemKey(id)}.png`);
  }

  create() {
    this.makeParticles();
    // 배가 섬에 닿으면 시작한다
    const wait = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this.sailed < 0.985) return;
        wait.remove();
        this.cameras.main.fadeOut(280, 126, 200, 227);
        this.cameras.main.once('camerafadeoutcomplete', () => this.begin());
      },
    });
  }

  private sailed = 0;

  private begin() {
    // 처음 켰을 때는 오프닝부터
    if (!story.seen('opening')) return void this.scene.start('Story', { pages: OPENING, key: 'opening', boot: true });
    this.scene.start('Island');
    this.scene.launch('Hud');
  }

  /**
   * 움직이는 로딩 화면: 곰 가족의 배가 물결을 타고 섬 쪽으로 간다 (불러온 만큼 앞으로).
   * 배와 곰 그림은 맨 먼저 불러와서, 도착하는 대로 그려 넣는다.
   */
  private loadingScreen(W: number, H: number) {
    const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
    const cy = H * 0.52;
    const x0 = W / 2 - Math.min(130, W * 0.36);
    const x1 = W / 2 + Math.min(130, W * 0.36);
    const g = this.add.graphics();
    g.fillGradientStyle(0xbfe6f5, 0xbfe6f5, 0x8fd3ee, 0x8fd3ee, 1).fillRect(0, 0, W, cy + 6);
    g.fillStyle(0x5bb3d6).fillRect(0, cy + 6, W, H - cy - 6);
    // 해와 구름
    const sun = this.add.circle(W * 0.8, H * 0.16, 22, 0xffe08a);
    this.tweens.add({ targets: sun, scale: 1.12, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const [fx, fy, sc, sp] of [[0.2, 0.2, 1, 26000], [0.62, 0.3, 0.7, 34000], [0.95, 0.12, 0.85, 30000]] as const) {
      const c = this.add.container(W * fx, H * fy).setScale(sc);
      const cg = this.add.graphics();
      cg.fillStyle(0xffffff, 0.95).fillCircle(-16, 4, 12).fillCircle(0, -2, 16).fillCircle(17, 4, 11).fillRoundedRect(-26, 4, 52, 12, 6);
      c.add(cg);
      this.tweens.add({ targets: c, x: c.x - W * 0.5, duration: sp, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
    }
    // 물결 세 줄 (서로 엇갈려 흐른다)
    const waves: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const wv = this.add.graphics().setDepth(i === 0 ? 1 : 3);
      const y = cy + i * 12;
      wv.fillStyle([0x7ec8e3, 0x6cbfe0, 0x5bb3d6][i]);
      wv.beginPath();
      wv.moveTo(-80, y + 60);
      for (let x = -80; x <= W + 80; x += 8) wv.lineTo(x, y + Math.sin((x / 40) * Math.PI) * 4);
      wv.lineTo(W + 80, y + 60);
      wv.closePath();
      wv.fillPath();
      this.tweens.add({ targets: wv, x: i % 2 ? 80 : -80, duration: 2600 + i * 700, repeat: -1, ease: 'Linear' });
      waves.push(wv);
    }
    // 도착할 섬
    const isle = this.add.graphics().setDepth(2);
    isle.fillStyle(0xf3e0a6).fillEllipse(x1 + 26, cy + 4, 74, 22);
    isle.fillStyle(0x8bd17c).fillEllipse(x1 + 26, cy - 3, 56, 18);
    isle.fillStyle(0x8a6d4b).fillRect(x1 + 30, cy - 26, 4, 20);
    isle.fillStyle(0x5fae52).fillCircle(x1 + 32, cy - 30, 11).fillCircle(x1 + 23, cy - 24, 8).fillCircle(x1 + 41, cy - 24, 8);
    // 배 (그림이 오기 전에는 종이배 모양)
    const boat = this.add.container(x0, cy + 4).setDepth(2).setScale(1.35);
    const paper = this.add.graphics();
    paper.fillStyle(0x9c6b3f).fillRoundedRect(-22, -8, 44, 12, 5);
    paper.fillStyle(0xfff6e0).fillTriangle(0, -34, 0, -10, 18, -10);
    paper.lineStyle(2, 0x8a6d4b).lineBetween(0, -36, 0, -8);
    boat.add(paper);
    this.tweens.add({ targets: boat, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const bob = this.tweens.add({ targets: boat, y: cy - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const riders = ['dad', 'mom', 'kid', 'baby'];
    this.load.setPath('assets/');
    this.load.image('boat_side', 'boat_side.png');
    for (const r of riders) this.load.image(`${r}_side`, `${r}_side.png`);
    this.load.once('filecomplete-image-boat_side', () => {
      paper.destroy();
      boat.addAt(this.add.image(0, 6, 'boat_side').setOrigin(0.5, 1).setScale(1.5), 0);
    });
    riders.forEach((r, i) => {
      this.load.once(`filecomplete-image-${r}_side`, () => {
        const b = this.add.image(-24 + i * 15, -8 - (i % 2) * 2, `${r}_side`).setOrigin(0.5, 1).setScale(0.62).setAlpha(0);
        boat.addAt(b, 0);
        this.tweens.add({ targets: b, alpha: 1, duration: 200 });
        this.tweens.add({ targets: b, y: b.y - 3, duration: 380, yoyo: true, repeat: -1, delay: i * 130, ease: 'Sine.easeInOut' });
      });
    });
    // 뱃길 점선과 글자
    const dots = this.add.graphics().setDepth(4);
    const title = this.add.text(W / 2, H * 0.3 - 8, '베어로드', { fontFamily: FONT, fontSize: '34px', color: '#ffd166', fontStyle: 'bold', stroke: '#7a4a2b', strokeThickness: 8 }).setOrigin(0.5).setDepth(5).setLetterSpacing(3);
    const korTitle = this.add.text(W / 2, H * 0.3 + 22, '열 개의 섬', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#3d8fb5', strokeThickness: 5 }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: [title, korTitle], y: '-=5', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const TIPS = ['섬으로 가는 중…', '모닥불을 피우는 중…', '물고기를 깨우는 중…', '구름을 걷어 내는 중…', '곰 가족이 준비하는 중…'];
    const tip = this.add.text(W / 2, cy + 62, TIPS[0], { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(5);
    const pct = this.add.text(W / 2, cy + 82, '0%', { fontFamily: FONT, fontSize: '11px', color: '#e6f6ff' }).setOrigin(0.5).setDepth(5);
    let n = 0;
    const tipTimer = this.time.addEvent({ delay: 1300, loop: true, callback: () => tip.setText(TIPS[++n % TIPS.length]) });
    let shown = 0;
    let want = 0;
    const draw = (_t: number, delta: number) => {
      // 이미 받아 둔 그림이라 금방 끝나도, 배가 섬에 닿는 모습은 보이게 천천히(약 2초) 간다
      shown = Math.min(want, shown + Math.min(delta, 50) / 2000);
      this.sailed = shown;
      boat.x = x0 + (x1 - 34 - x0) * shown;
      pct.setText(`${Math.round(shown * 100)}%`);
      dots.clear();
      for (let x = x0; x < x1 - 30; x += 12) dots.fillStyle(0xffffff, x < boat.x ? 0.9 : 0.35).fillCircle(x, cy + 40, x < boat.x ? 2.5 : 2);
    };
    this.load.on('progress', (p: number) => (want = p));
    // 받을 것이 없거나 다 받았으면 끝까지 간다
    this.load.once('complete', () => (want = 1));
    this.events.on('update', draw);
    this.events.once('shutdown', () => {
      this.events.off('update', draw);
      tipTimer.remove();
      bob.remove();
    });
  }

  private makeParticles() {
    const g = this.add.graphics();
    g.fillStyle(0x6cc35f).fillRect(0, 0, 3, 2);
    g.fillStyle(0x4fa64a).fillRect(1, 1, 2, 1);
    g.generateTexture('leaf', 3, 2);
    g.clear();
    g.fillStyle(COLORS.rock).fillRect(0, 0, 2, 2);
    g.generateTexture('pebble', 2, 2);
    g.clear();
    g.fillStyle(COLORS.white).fillRect(1, 0, 1, 3).fillRect(0, 1, 3, 1);
    g.generateTexture('sparkle', 3, 3);
    g.clear();
    g.fillStyle(0xffb347).fillRect(0, 0, 2, 2);
    g.generateTexture('ember', 2, 2);
    g.clear();
    // 하트 7×6
    g.fillStyle(0xff6b8a);
    g.fillRect(1, 0, 2, 1).fillRect(4, 0, 2, 1).fillRect(0, 1, 7, 2).fillRect(1, 3, 5, 1).fillRect(2, 4, 3, 1).fillRect(3, 5, 1, 1);
    g.generateTexture('heart', 7, 6);
    g.clear();
    // 낚시 찌 5×7
    g.fillStyle(0x2b2d42).fillRect(1, 0, 3, 7).fillRect(0, 1, 5, 5);
    g.fillStyle(0xff5d5d).fillRect(1, 1, 3, 3);
    g.fillStyle(0xffffff).fillRect(1, 4, 3, 2);
    g.generateTexture('bobber', 5, 7);
    g.clear();
    // 구름 조각
    g.fillStyle(0xffffff).fillCircle(6, 6, 6);
    g.generateTexture('cloudpuff', 12, 12);
    g.clear();
    // 색종이
    g.fillStyle(0xffffff).fillRect(0, 0, 4, 3);
    g.generateTexture('confetti', 4, 3);
    g.destroy();
  }
}

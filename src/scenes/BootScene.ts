import Phaser from 'phaser';
import { COLORS } from '../config';
import { BUILD_TEXTURES } from '../data/build';
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
    const bar = this.add.rectangle(W / 2 - 80, H / 2, 0, 10, 0xffffff).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 164, 14).setStrokeStyle(2, 0xffffff);
    this.load.on('progress', (p: number) => (bar.width = 160 * p));
    this.add.text(W / 2, H / 2 + 26, '🏝️ 섬을 준비하고 있어요…', { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);

    this.load.setPath('assets/');
    this.load.spritesheet('tiles', 'tiles.png', { frameWidth: 24, frameHeight: 24, margin: 1, spacing: 2 });
    for (const b of BEARS) for (const f of FACINGS) this.load.image(`${b.id}_${f}`, `${b.id}_${f}.png`);
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
    for (const t of BUILD_TEXTURES) this.load.image(t, `${t}.png`);
    for (const skin of SKINS) {
      this.load.spritesheet(`tiles_${skin}`, `tiles_${skin}.png`, { frameWidth: 24, frameHeight: 24, margin: 1, spacing: 2 });
      for (const o of SKIN_OBJECTS) this.load.image(`${o}_${skin}`, `${o}_${skin}.png`);
    }
    for (const k of ['slime', 'slime_squash', 'slime_king', 'slime_pink', 'slime_squash_pink', 'slime_blue', 'slime_squash_blue']) this.load.image(k, `${k}.png`);
    for (const id of ITEM_IDS) this.load.image(itemKey(id), `${itemKey(id)}.png`);
  }

  create() {
    this.makeParticles();
    this.scene.start('Island');
    this.scene.launch('Hud');
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

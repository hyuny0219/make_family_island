import Phaser from 'phaser';
import { COLORS, TILE } from '../config';

/**
 * 임시(플레이스홀더) 도트 텍스처를 코드로 생성한다.
 * 정식 아트가 확정되면 이 씬에서 스프라이트 시트를 load 하도록 교체한다.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeTiles();
    this.makeTree();
    this.makeRock();
    this.makePlayer();
    this.makeSmall();
    this.scene.start('Island');
    this.scene.launch('Hud');
  }

  /**
   * 타일셋: [0]바다 [1]모래 [2]풀
   * 각 타일을 1px 바깥으로 늘려(extrude) 그려서, 화면 배율이 정수가 아닐 때 생기는 타일 사이 틈(seam)을 막는다.
   * → addTilesetImage(margin=1, spacing=2)
   */
  private makeTiles() {
    const g = this.add.graphics();
    const C = TILE + 2;
    const base = [COLORS.sea, COLORS.sand, COLORS.grass];
    base.forEach((c, i) => g.fillStyle(c).fillRect(i * C, 0, C, C));
    const at = (i: number, x: number, y: number, w: number, h: number) => g.fillRect(i * C + 1 + x, 1 + y, w, h);
    // 바다 물결
    g.fillStyle(COLORS.white, 0.6);
    at(0, 3, 5, 3, 1);
    at(0, 10, 11, 3, 1);
    // 모래 알갱이
    g.fillStyle(COLORS.sandDark);
    at(1, 4, 3, 1, 1);
    at(1, 11, 9, 1, 1);
    at(1, 6, 13, 1, 1);
    // 풀잎
    g.fillStyle(COLORS.grassDark);
    at(2, 3, 4, 1, 2);
    at(2, 4, 5, 1, 1);
    at(2, 11, 10, 1, 2);
    at(2, 12, 11, 1, 1);
    g.generateTexture('tiles', C * 3, C);
    g.destroy();
  }

  private makeTree() {
    const g = this.add.graphics();
    // 그림자는 별도. 줄기
    g.fillStyle(COLORS.outline).fillRect(6, 15, 4, 9);
    g.fillStyle(COLORS.trunk).fillRect(7, 15, 2, 8);
    // 잎 (외곽선 → 본색 → 하이라이트)
    g.fillStyle(COLORS.outline).fillCircle(8, 9, 8);
    g.fillStyle(COLORS.leaf).fillCircle(8, 9, 7);
    g.fillStyle(COLORS.leafLight).fillCircle(6, 7, 3);
    g.fillStyle(0xff6b6b).fillRect(10, 11, 2, 2).fillRect(4, 12, 2, 2); // 열매
    g.generateTexture('tree', 16, 24);
    g.destroy();
  }

  private makeRock() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.outline).fillEllipse(8, 7, 16, 12);
    g.fillStyle(COLORS.rockDark).fillEllipse(8, 7, 14, 10);
    g.fillStyle(COLORS.rock).fillEllipse(7, 6, 11, 7);
    g.fillStyle(COLORS.white, 0.7).fillRect(5, 4, 2, 1);
    g.generateTexture('rock', 16, 13);
    g.destroy();
  }

  /** 12×16 기본 캐릭터 (가족 아바타 자리) */
  private makePlayer() {
    const g = this.add.graphics();
    const o = COLORS.outline;
    // 몸
    g.fillStyle(o).fillRect(2, 8, 8, 7);
    g.fillStyle(0x5aa9e6).fillRect(3, 9, 6, 5);
    // 다리
    g.fillStyle(o).fillRect(3, 14, 2, 2).fillRect(7, 14, 2, 2);
    // 머리
    g.fillStyle(o).fillRect(1, 0, 10, 9);
    g.fillStyle(0xffd9b3).fillRect(2, 1, 8, 7);
    // 머리카락
    g.fillStyle(0x6b4226).fillRect(2, 1, 8, 2).fillRect(2, 3, 1, 2);
    // 눈, 볼
    g.fillStyle(o).fillRect(4, 4, 1, 2).fillRect(7, 4, 1, 2);
    g.fillStyle(0xff9aa2).fillRect(3, 6, 1, 1).fillRect(8, 6, 1, 1);
    g.generateTexture('player', 12, 16);
    g.destroy();
  }

  private makeSmall() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillEllipse(6, 2, 12, 4);
    g.generateTexture('shadow', 12, 4);
    g.clear();
    g.fillStyle(COLORS.leafLight).fillRect(0, 0, 3, 2);
    g.fillStyle(COLORS.leaf).fillRect(1, 1, 2, 1);
    g.generateTexture('leaf', 3, 2);
    g.clear();
    g.fillStyle(COLORS.rock).fillRect(0, 0, 2, 2);
    g.generateTexture('pebble', 2, 2);
    g.clear();
    g.fillStyle(COLORS.white).fillRect(1, 0, 1, 3).fillRect(0, 1, 3, 1);
    g.generateTexture('sparkle', 3, 3);
    g.destroy();
  }
}

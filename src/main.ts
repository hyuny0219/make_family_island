import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { IslandScene } from './scenes/IslandScene';
import { HudScene } from './scenes/HudScene';
import { inventory } from './state/inventory';
import { progress } from './state/progress';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.sea,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, IslandScene, HudScene],
});

// 디버그/테스트용 핸들
Object.assign(window, { __game: game, __inv: inventory, __progress: progress });

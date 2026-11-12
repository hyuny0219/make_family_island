import { abilities } from './state/abilities';
import { player } from './state/player';
import { Monster } from './objects/Monster';
import { MONSTERS } from './data/monsters';
import { quests } from './state/quests';
import { Slime } from './objects/Slime';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { IslandScene } from './scenes/IslandScene';
import { HudScene } from './scenes/HudScene';
import { MergeScene } from './scenes/MergeScene';
import { inventory } from './state/inventory';
import { progress } from './state/progress';
import { village } from './state/village';
import { family } from './sync/family';
import './sync/bridge';

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
    fullscreenTarget: 'game',
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, IslandScene, MergeScene, HudScene],
});

// 디버그/테스트용 핸들
Object.assign(window, { __game: game, __inv: inventory, __progress: progress, __village: village, __family: family, __Slime: Slime, __quests: quests, __Monster: Monster, __MONSTERS: MONSTERS, __player: player, __abilities: abilities });

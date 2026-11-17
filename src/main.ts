import { lockOrientation } from './util/orient';
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
import { StoryScene } from './scenes/StoryScene';
import { HudScene } from './scenes/HudScene';
import { MergeScene } from './scenes/MergeScene';
import { inventory } from './state/inventory';
import { progress } from './state/progress';
import { village } from './state/village';
import { family } from './sync/family';
import './sync/bridge';

/**
 * 화면의 기준 크기. 세로 화면은 360×640, 가로 화면은 640×450을 기준으로 삼는다.
 * (가로에서도 세로 기준을 쓰면 높이 640을 좁은 화면에 욱여넣어 글자와 단추가 절반으로 작아진다)
 */
const baseSize = (): [number, number] => (window.innerWidth > window.innerHeight * 1.2 ? [640, 450] : [GAME_WIDTH, GAME_HEIGHT]);
const [baseW, baseH] = baseSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: baseW,
  height: baseH,
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
  scene: [BootScene, IslandScene, MergeScene, HudScene, StoryScene],
});

// 폰을 돌리면 기준 크기를 바꾼다 (화면을 다시 짜는 일은 HUD가 크기 변화를 보고 한다)
const typing = () => document.activeElement instanceof HTMLInputElement;
const applyBase = () => {
  // 글자를 넣는 중에는 자판 때문에 화면이 줄어든 것이니 가로·세로를 바꾸지 않는다
  if (typing()) return;
  const [w, h] = baseSize();
  const c = game.config as unknown as { width: number; height: number };
  if (c.width === w && c.height === h) return;
  c.width = w;
  c.height = h;
  game.scale.refresh();
};
window.addEventListener('resize', applyBase);
// 자판이 내려간 뒤 한 번 더 맞춘다
window.addEventListener('focusout', () => window.setTimeout(applyBase, 350));
window.addEventListener('orientationchange', () => window.setTimeout(applyBase, 200));

// 전체 화면이 되면 설정한 방향(기본: 가로)으로 돌려 잠근다. 홈 화면 앱은 켤 때 바로 해 본다
document.addEventListener('fullscreenchange', () => void lockOrientation());
void lockOrientation();

// 디버그/테스트용 핸들
Object.assign(window, { __game: game, __inv: inventory, __progress: progress, __village: village, __family: family, __Slime: Slime, __quests: quests, __Monster: Monster, __MONSTERS: MONSTERS, __player: player, __abilities: abilities });

// 새 버전이 받아지면 바로 새로 고친다. (그대로 두면 앱을 한 번 더 껐다 켜야 새 버전이 보인다)
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

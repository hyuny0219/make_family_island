/**
 * 선명한 화면.
 * Phaser는 캔버스를 논리 크기(가로 화면 640×360쯤)로만 그리고 브라우저가 늘려서 보여 주기 때문에,
 * 화소가 촘촘한 폰에서는 글자가 계단처럼 깨져 보인다.
 * 여기서는 캔버스의 실제 화소 수만 K배로 늘리고(좌표·배치는 그대로), 글자도 K배 해상도로 그린다.
 * WebGL에서만 동작하고, 설정의 '선명한 화면'을 끄면 예전처럼 그린다.
 */
import Phaser from 'phaser';
import { settings } from './state/settings';


/**
 * 배율의 위쪽 끝. 처음에는 2배(3배는 폰에 따라 너무 무겁다).
 * 그래도 느리면(아래 감시) 한 단계씩 내리고, 내린 값은 이 기기에 기억해 둔다.
 */
const CAP_KEY = 'mfi.v1.hiresCap';
let cap = 2;
try {
  const saved = Number(localStorage.getItem(CAP_KEY));
  if (saved === 1 || saved === 2) cap = saved;
} catch {
  /* noop */
}

/** 지금의 배율 (글자를 이 해상도로 그린다). 렌더러가 준비되기 전에는 화면 크기로 어림한다 */
let RES = settings.sharp ? Math.max(1, Math.min(cap, Math.round(((window.devicePixelRatio || 1) * Math.min(window.innerWidth, window.innerHeight)) / 360))) : 1;

function pick(game: Phaser.Game) {
  if (!settings.sharp) return 1;
  const css = game.scale.displaySize.width;
  const k = Math.round(((window.devicePixelRatio || 1) * css) / game.scale.width);
  return Math.max(1, Math.min(cap, k || 1));
}

export function installHiRes(game: Phaser.Game) {
  // 글자: 만들 때마다 지금 배율로
  const F = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text };
  F.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, text, style) {
    const s = RES > 1 && !(style && style.resolution) ? { ...(style ?? {}), resolution: RES } : style;
    return this.displayList.add(new Phaser.GameObjects.Text(this.scene, x, y, text, s ?? {})) as Phaser.GameObjects.Text;
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    const r = game.renderer;
    if (r.type !== Phaser.WEBGL) return;
    const R = r as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = R.gl;
    const onScreen = () => !R.currentFramebuffer;
    // 화면에 바로 그릴 때만 K배 (다른 그림판에 그릴 때는 그대로)
    const viewport = gl.viewport.bind(gl);
    const scissor = gl.scissor.bind(gl);
    gl.viewport = (x, y, w, h) => (onScreen() ? viewport(x * RES, y * RES, w * RES, h * RES) : viewport(x, y, w, h));
    gl.scissor = (x, y, w, h) => (onScreen() ? scissor(x * RES, y * RES, w * RES, h * RES) : scissor(x, y, w, h));
    // Phaser가 가위질 좌표를 뒤집을 때 쓰는 높이: 화면은 논리 높이로 계산하게 한다
    let dbh = R.height;
    Object.defineProperty(R, 'drawingBufferHeight', {
      configurable: true,
      get: () => dbh,
      set: (v: number) => {
        dbh = RES > 1 && v === gl.drawingBufferHeight ? R.height : v;
      },
    });
    const ensure = () => {
      const k = pick(game);
      const c = game.canvas;
      if (k === RES && c.width === R.width * k && c.height === R.height * k) return;
      RES = k;
      c.width = R.width * k;
      c.height = R.height * k;
      dbh = R.height;
      gl.viewport(0, 0, R.width, R.height);
      gl.scissor(0, 0, R.width, R.height);
    };
    game.events.on(Phaser.Core.Events.PRE_RENDER, ensure);
    ensure();
    // 느린 기기 감시: 3초 동안 평균이 초당 40장에 못 미치면 배율을 한 단계 내린다 (탭을 가렸다 돌아온 직후는 세지 않는다)
    let slowSince = 0;
    window.setInterval(() => {
      if (RES <= 1 || document.hidden) return void (slowSince = 0);
      const fps = game.loop.actualFps;
      if (fps > 0 && fps < 40) {
        if (!slowSince) slowSince = performance.now();
        else if (performance.now() - slowSince >= 3000) {
          cap = Math.max(1, RES - 1);
          slowSince = 0;
          try {
            localStorage.setItem(CAP_KEY, String(cap));
          } catch {
            /* noop */
          }
        }
      } else slowSince = 0;
    }, 1000);
    document.addEventListener('visibilitychange', () => (slowSince = 0));
  });
}

/** 설정이 바뀌었을 때: 다음 그림부터 적용된다 (이미 만든 글자는 화면을 다시 그릴 때 바뀐다) */
export const hiRes = () => RES;

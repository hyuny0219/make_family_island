/**
 * 선명한 화면.
 * Phaser는 캔버스를 논리 크기(가로 화면 640×360쯤)로만 그리고 브라우저가 늘려서 보여 주기 때문에,
 * 화소가 촘촘한 폰에서는 글자가 계단처럼 깨져 보인다.
 * 여기서는 캔버스의 실제 화소 수만 K배로 늘리고(좌표·배치는 그대로), 글자도 K배 해상도로 그린다.
 * WebGL에서만 동작하고, 설정의 '선명한 화면'을 끄면 예전처럼 그린다.
 */
import Phaser from 'phaser';
import { settings, setSetting } from './state/settings';

// 예전 버그(캔버스를 장면마다 새로 만들어 몹시 버벅였다) 때문에 '선명한 화면'을 껐을 수 있다 → 고친 뒤 한 번만 다시 켠다
try {
  if (!localStorage.getItem('mfi.v1.sharpFix2')) {
    localStorage.setItem('mfi.v1.sharpFix2', '1');
    if (!settings.sharp) setSetting('sharp', true);
  }
} catch {
  /* noop */
}


/**
 * 배율의 위쪽 끝. 처음에는 2배(3배는 폰에 따라 너무 무겁다).
 * 그래도 느리면(아래 감시) 한 단계씩 내리고, 내린 값은 이 기기에 기억해 둔다.
 */
// (열쇠 이름의 숫자: 예전 버그들(캔버스를 장면마다 새로 만듦, HUD 단추를 장면마다 다시 쪼개어 그림) 때문에
//  게임이 느려서 잘못 낮춰진 값을 버린다. 낮춰진 채로 두면 글자가 계단처럼 깨져 보인다)
const CAP_KEY = 'mfi.v1.hiresCap3';
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

/** 작은 글씨 키우기: 8 → 10.5, 9 → 11, 10 → 11.5, 11 → 12, 12 → 12.5 (13 이상은 그대로) */
const bigger = (px: number) => (px <= 8 ? 10.5 : px <= 12 ? 11 + (px - 9) * 0.5 : px);

export function installHiRes(game: Phaser.Game) {
  // 글자: 만들 때마다 지금 배율로
  const F = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text };
  F.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, text, style) {
    let s = RES > 1 && !(style && style.resolution) ? { ...(style ?? {}), resolution: RES } : style;
    // 작은 글씨는 읽기 어렵다 → 한꺼번에 키운다 (큰 글씨는 그대로)
    const px = s ? parseFloat(String(s.fontSize ?? '')) : NaN;
    if (px > 0 && px < 13) s = { ...s, fontSize: `${bigger(px)}px` };
    return this.displayList.add(new Phaser.GameObjects.Text(this.scene, x, y, text, s ?? {})) as Phaser.GameObjects.Text;
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    const r = game.renderer;
    if (r.type !== Phaser.WEBGL) return;
    const R = r as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = R.gl;
    // 화면에 바로 그릴 때만 K배 (다른 그림판(텍스처)에 그릴 때는 그대로).
    // Phaser는 '뷰포트를 정하고 → 그림판을 바꾸는' 순서와 그 반대 순서를 섞어 쓴다. 그래서 정하는 순간의 그림판만 보면
    // 틀릴 때가 있다(텍스처에 2배로 그려져 그림이 4분의 1만 보인다). 마지막으로 요청받은 값을 기억해 두었다가,
    // 그림판이 화면 ↔ 텍스처로 바뀔 때마다 그 그림판에 맞는 배율로 다시 정한다.
    const viewport = gl.viewport.bind(gl);
    const scissor = gl.scissor.bind(gl);
    const bindFb = gl.bindFramebuffer.bind(gl);
    let bound: WebGLFramebuffer | null = null;
    let lastV: [number, number, number, number] | null = null;
    let lastS: [number, number, number, number] | null = null;
    const k = () => (bound ? 1 : RES);
    const applyV = () => lastV && viewport(lastV[0] * k(), lastV[1] * k(), lastV[2] * k(), lastV[3] * k());
    const applyS = () => lastS && scissor(lastS[0] * k(), lastS[1] * k(), lastS[2] * k(), lastS[3] * k());
    gl.viewport = (x, y, w, h) => {
      lastV = [x, y, w, h];
      applyV();
    };
    gl.scissor = (x, y, w, h) => {
      lastS = [x, y, w, h];
      applyS();
    };
    gl.bindFramebuffer = (target, fb) => {
      bindFb(target, fb);
      if (target !== gl.FRAMEBUFFER) return;
      const was = !bound;
      bound = fb;
      if (was !== !bound && RES > 1) {
        applyV();
        applyS();
      }
    };
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
      // 게임 너비는 소수일 수 있다(예: 739.22). 캔버스 화소 수는 정수라서, 정수로 맞춰 견줘야 한다.
      // (소수 그대로 견주면 늘 '다르다'가 되어 장면마다 캔버스를 새로 만들게 되고, 그러면 몹시 버벅인다)
      const w = Math.floor(R.width) * k;
      const h = Math.floor(R.height) * k;
      if (k === RES && c.width === w && c.height === h) return;
      RES = k;
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      dbh = R.height;
      gl.viewport(0, 0, R.width, R.height);
      gl.scissor(0, 0, R.width, R.height);
    };
    game.events.on(Phaser.Core.Events.PRE_RENDER, ensure);
    ensure();
    // 느린 기기 감시: 6초 내내 초당 30장에 못 미치면 배율을 한 단계 내린다
    // (불러오는 중이라 느린 처음 15초와, 탭을 가렸다 돌아온 직후는 세지 않는다 — 한 번 내리면 글자가 깨져 보이니 신중하게)
    let slowSince = 0;
    const born = performance.now();
    window.setInterval(() => {
      if (RES <= 1 || document.hidden || performance.now() - born < 15000) return void (slowSince = 0);
      const fps = game.loop.actualFps;
      if (fps > 0 && fps < 30) {
        if (!slowSince) slowSince = performance.now();
        else if (performance.now() - slowSince >= 6000) {
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

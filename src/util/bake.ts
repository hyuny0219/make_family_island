import Phaser from 'phaser';

/**
 * 그려 놓고 바꾸지 않는 Graphics(둥근 단추·판)를 그림 한 장으로 구워 둔다.
 *
 * Graphics는 장면마다 둥근 모서리를 삼각형으로 다시 쪼개어 그린다. 단추 하나는 가볍지만
 * HUD에 서른 개쯤 쌓이면 폰에서는 한 장면에 쓸 시간(16ms)을 거의 다 먹는다.
 * 한동안 모양이 그대로면 텍스처로 구워서 그림 한 장처럼 그리고, 모양이 바뀌면 다시 직접 그린다.
 */
const S = 2; // 구울 때의 배율 (선명한 화면의 최대 배율과 같게)
const WAIT = 20; // 이만큼의 장면 동안 그대로면 굽는다
const MIN_CMD = 12; // 이보다 단순한 것은 굽지 않는다 (네모 하나쯤은 그냥 그리는 편이 싸다)
const MAX_SIDE = 900;
const MAX_LIVE = 96; // 구운 그림 수의 한도 (목록 칸처럼 수백 개가 한꺼번에 구워지지 않게)
let live = 0;

type Render = (renderer: unknown, src: unknown, camera: unknown, parent?: unknown) => void;
type G = Phaser.GameObjects.Graphics & {
  commandBuffer: number[];
  renderWebGL: Render;
  __bake?: Bake;
};
// Phaser의 타입 정의에는 없는, 물체마다 가진 그리기 함수
const PROTO = Phaser.GameObjects.Graphics.prototype as unknown as { renderWebGL: Render };
type Bake = {
  len: number; // 마지막으로 본 명령 길이
  still: number; // 그대로였던 장면 수
  dirty: boolean;
  redo: number; // 구운 뒤 다시 바뀐 횟수 (자주 바뀌는 것은 더 오래 기다린다)
  off: boolean; // 구울 수 없는 모양
  tex?: Phaser.Textures.DynamicTexture;
  key?: string;
  img?: Phaser.GameObjects.Image;
  minX: number;
  minY: number;
};

let seq = 0;

/** 명령을 훑어 그려지는 범위를 구한다. 구울 수 없는 명령이 있으면 null */
function bounds(c: number[]): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let lw = 0;
  const pt = (x: number, y: number, pad: number) => {
    if (x - pad < x0) x0 = x - pad;
    if (y - pad < y0) y0 = y - pad;
    if (x + pad > x1) x1 = x + pad;
    if (y + pad > y1) y1 = y + pad;
  };
  for (let i = 0; i < c.length; i++) {
    switch (c[i]) {
      case 1: // BEGIN_PATH
      case 2: // CLOSE_PATH
      case 8: // FILL_PATH
      case 9: // STROKE_PATH
        break;
      case 0: {
        // ARC x y r start end anticlockwise overshoot
        const r = Math.abs(c[i + 3]) + lw;
        pt(c[i + 1], c[i + 2], r);
        i += 7;
        break;
      }
      case 3: // FILL_RECT x y w h
        pt(c[i + 1], c[i + 2], 0);
        pt(c[i + 1] + c[i + 3], c[i + 2] + c[i + 4], 0);
        i += 4;
        break;
      case 4: // LINE_TO
      case 5: // MOVE_TO
        pt(c[i + 1], c[i + 2], lw);
        i += 2;
        break;
      case 6: // LINE_STYLE width color alpha
        lw = Math.max(lw, c[i + 1]);
        i += 3;
        break;
      case 7: // FILL_STYLE color alpha
        i += 2;
        break;
      case 10: // FILL_TRIANGLE
      case 11: // STROKE_TRIANGLE
        pt(c[i + 1], c[i + 2], lw);
        pt(c[i + 3], c[i + 4], lw);
        pt(c[i + 5], c[i + 6], lw);
        i += 6;
        break;
      default:
        // 저장·옮기기·돌리기·그러데이션은 굽지 않는다
        return null;
    }
  }
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !Number.isFinite(y0) || !Number.isFinite(y1)) return null;
  // 선 두께만큼 넉넉히 (나중에 정한 두께가 앞선 점에도 걸리도록)
  return { x0: Math.floor(x0 - lw) - 1, y0: Math.floor(y0 - lw) - 1, x1: Math.ceil(x1 + lw) + 1, y1: Math.ceil(y1 + lw) + 1 };
}

function drop(b: Bake, scene: Phaser.Scene) {
  if (b.img) {
    b.img.destroy();
    b.img = undefined;
  }
  if (b.key && scene.textures.exists(b.key)) {
    scene.textures.remove(b.key);
    live--;
  }
  b.tex = undefined;
  b.key = undefined;
}

function bake(g: G, b: Bake, scene: Phaser.Scene) {
  const bb = bounds(g.commandBuffer);
  const w = bb ? bb.x1 - bb.x0 : 0;
  const h = bb ? bb.y1 - bb.y0 : 0;
  if (!bb || w <= 0 || h <= 0 || w > MAX_SIDE || h > MAX_SIDE) {
    b.off = true;
    return;
  }
  const key = `__bake${seq++}`;
  const tex = scene.textures.addDynamicTexture(key, w * S, h * S);
  if (!tex) {
    b.off = true;
    return;
  }
  // 제자리·제 배율·제 투명도를 잠깐 치워 두고 텍스처에 그린다
  const keep = { x: g.x, y: g.y, sx: g.scaleX, sy: g.scaleY, a: g.alpha, sfx: g.scrollFactorX, sfy: g.scrollFactorY, v: g.visible };
  g.setScale(S).setAlpha(1).setScrollFactor(0).setVisible(true);
  const direct = g.renderWebGL;
  g.renderWebGL = b0(g);
  tex.draw(g, -bb.x0 * S, -bb.y0 * S);
  g.renderWebGL = direct;
  g.setPosition(keep.x, keep.y).setScale(keep.sx, keep.sy).setAlpha(keep.a).setScrollFactor(keep.sfx, keep.sfy).setVisible(keep.v);
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  live++;
  b.tex = tex;
  b.key = key;
  b.minX = bb.x0;
  b.minY = bb.y0;
  b.img = scene.make.image({ key, add: false }).setOrigin(0, 0);
}

/** Graphics가 본디 가진 그리기 함수 (프로토타입의 것) */
const b0 = (g: G): Render => PROTO.renderWebGL.bind(g);

/** 이 Graphics를 굽기 대상으로 삼는다 */
export function autoBake<T extends Phaser.GameObjects.Graphics>(gfx: T, scene: Phaser.Scene): T {
  const g = gfx as unknown as G;
  if (g.__bake || scene.game.renderer.type !== Phaser.WEBGL) return gfx;
  const b: Bake = { len: -1, still: 0, dirty: true, redo: 0, off: false, minX: 0, minY: 0 };
  g.__bake = b;

  const clear = g.clear;
  g.clear = function (this: G) {
    b.dirty = true;
    return clear.call(this);
  } as G['clear'];

  const direct = PROTO.renderWebGL;
  g.renderWebGL = function (this: G, renderer: unknown, src: unknown, camera: unknown, parent?: unknown) {
    const len = this.commandBuffer.length;
    if (b.dirty || len !== b.len) {
      // 모양이 바뀌었다: 구운 것은 버리고 직접 그린다
      if (b.tex) {
        drop(b, scene);
        b.redo++;
      }
      b.len = len;
      b.dirty = false;
      b.still = 0;
    } else if (!b.tex && !b.off) {
      b.still++;
    }
    const img = b.img;
    if (!b.tex || !img || this.rotation !== 0) {
      direct.call(this, renderer, src, camera, parent);
      return;
    }
    img.x = this.x + b.minX * this.scaleX;
    img.y = this.y + b.minY * this.scaleY;
    img.scaleX = this.scaleX / S;
    img.scaleY = this.scaleY / S;
    img.alpha = this.alpha;
    img.scrollFactorX = this.scrollFactorX;
    img.scrollFactorY = this.scrollFactorY;
    img.blendMode = this.blendMode;
    (img as unknown as { renderWebGL: Render }).renderWebGL(renderer, img, camera, parent);
  };

  // 굽기는 그리는 도중이 아니라 장면을 고치는 때에 한다 (한 번에 몇 개씩만)
  const step = () => {
    if (b.tex || b.off || b.dirty) return;
    if (g.commandBuffer.length < MIN_CMD) return;
    if (b.still < WAIT * (1 + Math.min(b.redo, 5) * 3)) return;
    if (live >= MAX_LIVE) return;
    if (budget(scene) <= 0) return;
    bake(g, b, scene);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step);
  g.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step);
    drop(b, scene);
  });
  return gfx;
}

// 한 장면에 굽는 수를 묶어 둔다 (한꺼번에 구우면 그 장면이 길어진다)
const left = new WeakMap<Phaser.Scene, { frame: number; n: number }>();
function budget(scene: Phaser.Scene) {
  const f = scene.game.loop.frame;
  let e = left.get(scene);
  if (!e || e.frame !== f) {
    e = { frame: f, n: 3 };
    left.set(scene, e);
  }
  return e.n--;
}

/** 이 장면에서 만드는 Graphics를 모두 굽기 대상으로 삼는다 */
export function bakeSceneGraphics(scene: Phaser.Scene) {
  const add = scene.add as Phaser.GameObjects.GameObjectFactory & { __baked?: boolean };
  if (add.__baked) return;
  add.__baked = true;
  const make = add.graphics;
  add.graphics = function (this: Phaser.GameObjects.GameObjectFactory, config?: Phaser.Types.GameObjects.Graphics.Options) {
    return autoBake(make.call(this, config), scene);
  };
}

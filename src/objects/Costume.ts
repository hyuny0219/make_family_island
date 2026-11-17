import Phaser from 'phaser';
import { COSTUME, WEAPONS } from '../data/weapons';
import type { Bear } from './Bear';

/**
 * 변신 옷: 발밑의 빛, 펄럭이는 망토, 손에 든 보스 무기.
 * 그림 한 벌로 네 곰 모두에게 맞도록 그때그때 곰 크기에 맞춰 그린다. 진화할수록 화려해진다.
 */
export class Costume {
  private cape: Phaser.GameObjects.Graphics;
  private aura: Phaser.GameObjects.Graphics;
  private held?: Phaser.GameObjects.Image;
  private t = Math.random() * 10;
  /** 무기를 휘두르는 동안에는 손에 든 그림을 잠깐 감춘다 */
  hideHeldUntil = 0;

  constructor(private scene: Phaser.Scene, readonly id: string, readonly lv: number) {
    this.aura = scene.add.graphics();
    this.cape = scene.add.graphics();
    const w = WEAPONS[id];
    if (w && scene.textures.exists(w.tex)) this.held = scene.add.image(0, 0, w.tex).setOrigin(0.5, 0.85);
  }

  update(bear: Bear, dt: number) {
    const sp = bear.sprite;
    const show = sp.visible && !bear.lying;
    // 몸에 입는 의상 그림이 있는 곰은 망토를 그리지 않는다 (의상에 다 들어 있다)
    this.cape.setVisible(show && !bear.skinned);
    this.aura.setVisible(show);
    this.held?.setVisible(show && this.scene.time.now > this.hideHeldUntil);
    if (!show) return;
    this.t += dt * (bear.moving ? 9 : 3);
    const [main, trim, glow] = COSTUME[this.id] ?? [0xffffff, 0xdddddd, 0xffffff];
    const w = sp.displayWidth;
    const h = sp.displayHeight;
    const x = sp.x;
    const y = sp.y;
    const lv = this.lv;
    // 발밑의 빛 (진화할수록 크고, 3단계는 고리가 하나 더)
    const pulse = 0.5 + Math.sin(this.t * 0.7) * 0.5;
    this.aura.clear().setDepth(y - 2);
    this.aura.fillStyle(glow, 0.16 + pulse * 0.1).fillEllipse(x, y - 1, w * (0.9 + lv * 0.18), 7 + lv * 2);
    this.aura.lineStyle(1.5, main, 0.35 + pulse * 0.3).strokeEllipse(x, y - 1, w * (0.8 + lv * 0.16 + pulse * 0.08), 6 + lv * 2);
    if (lv >= 3) this.aura.lineStyle(1, trim, 0.5 - pulse * 0.3).strokeEllipse(x, y - 1, w * (1.25 + pulse * 0.25), 12 + pulse * 3);
    // 망토: 어깨에서 발목까지. 걸으면 뒤로 날리고, 서 있으면 살랑인다
    const side = bear.facing === 'side';
    const back = bear.facing === 'back';
    const dir = sp.flipX ? -1 : 1; // 옆을 볼 때 보는 쪽
    const sway = Math.sin(this.t) * (bear.moving ? 2.2 : 0.9);
    const top = y - h * 0.6;
    const bottom = y - h * 0.1 + (bear.moving ? -1 : 0);
    const cape = this.cape.clear();
    if (bear.skinned) cape.setVisible(false);
    cape.setDepth(back ? sp.depth + 0.3 : sp.depth - 0.2);
    const poly = (pts: number[], color: number, alpha = 1) => {
      cape.fillStyle(color, alpha);
      cape.beginPath();
      cape.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) cape.lineTo(pts[i], pts[i + 1]);
      cape.closePath();
      cape.fillPath();
    };
    if (side) {
      // 등 뒤로 길게 날린다
      const bx = x - dir * w * 0.2;
      const fly = bear.moving ? w * 0.6 : w * 0.42;
      const tipX = bx - dir * (fly + Math.abs(sway));
      poly([bx, top, bx + dir * 2, top + h * 0.12, tipX + dir * 3, bottom + sway, tipX, bottom - h * 0.16 + sway, bx - dir * w * 0.18, top + h * 0.05], main);
      poly([tipX + dir * 3, bottom + sway, tipX, bottom - h * 0.16 + sway, tipX + dir * 4, bottom - h * 0.1 + sway], trim);
    } else {
      // 앞·뒤: 양옆으로 퍼지는 망토 (앞을 볼 때는 몸 뒤로 양 끝만, 뒤를 볼 때는 등을 덮는다)
      const half = w * (back ? 0.36 : 0.5) + (lv - 1) * 1.2;
      const flare = half + 3 + Math.abs(sway);
      poly([x - half * 0.7, top, x + half * 0.7, top, x + flare + sway, bottom, x - flare + sway, bottom], main);
      // 끝단 무늬
      poly([x - flare + sway, bottom, x + flare + sway, bottom, x + flare - 2 + sway, bottom - 3, x - flare + 2 + sway, bottom - 3], trim);
      if (back) {
        // 등에 박힌 표식
        cape.fillStyle(trim, 0.95).fillCircle(x + sway * 0.4, (top + bottom) / 2, 2.2 + lv * 0.4);
        if (lv >= 2) cape.lineStyle(1, glow, 0.9).strokeCircle(x + sway * 0.4, (top + bottom) / 2, 4 + lv * 0.5);
      }
    }
    // 목깃
    if (!back) {
      cape.fillStyle(trim).fillRoundedRect(x - w * 0.24, top - 1, w * 0.48, 3.5, 1.5);
      if (lv >= 2) cape.fillStyle(glow).fillCircle(x + (side ? dir * w * 0.14 : 0), top + 1, 1.6);
    }
    // 손에 든 무기
    if (this.held) {
      const hw = WEAPONS[this.id];
      const hx = side ? x + dir * w * 0.3 : x + w * 0.42;
      const bob = bear.moving ? Math.sin(this.t) * 1.2 : 0;
      this.held
        .setPosition(hx, y - h * 0.22 + bob)
        .setScale(hw.hold.scale * (0.85 + lv * 0.08))
        .setFlipX(side && dir < 0)
        .setAngle((side && dir < 0 ? -1 : 1) * (hw.hold.angle + 18))
        .setDepth(back ? sp.depth - 0.1 : sp.depth + 0.4);
    }
  }

  destroy() {
    this.cape.destroy();
    this.aura.destroy();
    this.held?.destroy();
  }
}

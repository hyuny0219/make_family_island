/**
 * 아주 작은 WebAudio 효과음 + 진동 헬퍼.
 * 정식 효과음 파일이 생기기 전까지 손맛 피드백을 담당한다.
 * 모바일 브라우저는 첫 터치 이후에만 소리를 낼 수 있으므로 unlock()을 첫 입력에서 호출한다.
 */
import { settings } from './state/settings';

let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  if (!settings.sound || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  tap: () => tone(880, 0.06, 'square', 0.04, 1320),
  rustle: () => {
    tone(320, 0.08, 'triangle', 0.08, 220);
    setTimeout(() => tone(260, 0.08, 'triangle', 0.06, 180), 50);
  },
  knock: () => tone(140, 0.1, 'square', 0.08, 90),
  pop: () => tone(520, 0.12, 'sine', 0.1, 1040),
  step: () => tone(200, 0.03, 'triangle', 0.025),
  merge: () => {
    tone(523, 0.1, 'sine', 0.1);
    setTimeout(() => tone(659, 0.1, 'sine', 0.1), 80);
    setTimeout(() => tone(784, 0.16, 'sine', 0.1), 160);
  },
  fanfare: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 110));
  },
};

/** 안드로이드에서만 동작 (iOS 사파리는 미지원 → 조용히 무시) */
export function buzz(ms = 12) {
  if (settings.vibrate && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* noop */
    }
  }
}

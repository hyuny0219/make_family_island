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
  refreshMusic();
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

// ───────────────────────── 배경음악 ─────────────────────────
// 파일 없이 WebAudio로 연주하는 잔잔한 오르골풍 반복곡 (8마디, 5음계).

const BPM = 84;
const BEAT = 60 / BPM / 2; // 8분음표 길이(초)
const N = (semi: number) => 261.63 * Math.pow(2, semi / 12); // 가온 도 기준
// 멜로디 (8분음표 단위, null = 쉼). C장조 5음계: 도0 레2 미4 솔7 라9 높은도12
const MELODY: (number | null)[] = [
  4, null, 7, null, 9, 7, 4, null, 2, null, 4, 7, 4, null, null, null,
  7, null, 9, null, 12, 9, 7, null, 9, 7, 4, 2, 0, null, null, null,
  4, null, 7, null, 9, 7, 4, null, 2, null, 4, 7, 9, null, null, null,
  12, null, 9, 7, 9, null, 7, 4, 2, null, 4, 2, 0, null, null, null,
];
// 마디마다 베이스 (도 라 파 솔)
const BASS = [-12, -15, -19, -17, -12, -15, -19, -17];
const LEN = MELODY.length;

let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let nextT = 0;
let pos = 0;

function note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.6) {
    const m = MELODY[pos];
    if (m !== null) {
      note(N(m + 12), nextT, BEAT * 2.6, 'sine', 0.5);
      note(N(m + 24), nextT, BEAT * 1.2, 'sine', 0.08); // 오르골 배음
    }
    if (pos % 8 === 0) note(N(BASS[(pos / 8) | 0]), nextT, BEAT * 7, 'triangle', 0.45);
    if (pos % 8 === 4) note(N(BASS[(pos / 8) | 0] + 7), nextT, BEAT * 3, 'triangle', 0.25);
    nextT += BEAT;
    pos = (pos + 1) % LEN;
  }
}

/** 설정·화면 상태에 맞춰 배경음악을 켜거나 끈다 */
export function refreshMusic() {
  if (!ctx) return;
  const want = settings.music && !document.hidden;
  if (want && musicTimer === null) {
    if (!musicGain) {
      musicGain = ctx.createGain();
      musicGain.connect(ctx.destination);
    }
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 1.2);
    nextT = 0;
    schedule();
    musicTimer = window.setInterval(schedule, 200);
  } else if (!want && musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
    musicGain?.gain.cancelScheduledValues(ctx.currentTime);
    musicGain?.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
  }
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshMusic);

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

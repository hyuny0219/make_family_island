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
  loadSamples();
}

// ───────────────────────── 녹음된 효과음 ─────────────────────────
// public/assets/sfx/<이름>.mp3 — 첫 터치 뒤에 뒤에서 조용히 받아 둔다. 아직 못 받았으면 합성음으로 대신한다.

/** 기본 효과음 */
const BASE_SAMPLES = ['punch', 'slash', 'heavy', 'swing', 'hit', 'finisher', 'chop', 'mine', 'pick', 'pickup', 'fish_cast', 'fish_catch', 'mon_die', 'boss_roar', 'boss_slam', 'boss_down', 'hurt', 'jump', 'land', 'slam', 'evolve'];
/** 보스 무기마다: w_(기본 공격) f_(3타 마무리) g_(내려찍기) */
const WEAPON_IDS = ['leaf', 'bee', 'wood', 'bubble', 'rock', 'poison', 'ice', 'sand', 'fire', 'thunder'];
const SAMPLES = [...BASE_SAMPLES, ...WEAPON_IDS.flatMap((id) => [`w_${id}`, `f_${id}`, `g_${id}`])];
const buffers = new Map<string, AudioBuffer>();
let samplesAsked = false;

function loadSamples() {
  if (samplesAsked || !ctx) return;
  samplesAsked = true;
  const ac = ctx;
  for (const name of SAMPLES) {
    fetch(`${import.meta.env.BASE_URL}assets/sfx/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => ac.decodeAudioData(b))
      .then((buf) => buffers.set(name, buf))
      .catch(() => {
        /* 못 받으면 합성음으로 */
      });
  }
}

const lastPlayed = new Map<string, number>();

/**
 * 녹음된 효과음을 낸다. 같은 소리가 너무 촘촘히 겹치지 않게 하고, 칠 때마다 높낮이를 살짝 바꾼다.
 * @returns 소리를 냈거나 낼 필요가 없으면 true, 아직 파일이 없으면 false (→ 합성음으로 대신)
 */
function sample(name: string, vol = 0.6, rate = 1) {
  if (!settings.sound || !ctx || ctx.state !== 'running') return true;
  const buf = buffers.get(name);
  if (!buf) return false;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < 70) return true;
  lastPlayed.set(name, now);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(ctx.destination);
  src.start();
  return true;
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
  boing: () => {
    tone(300, 0.09, 'sine', 0.1, 620);
    setTimeout(() => tone(520, 0.1, 'sine', 0.07, 300), 70);
  },
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
  /**
   * 녹음된 효과음 (없으면 합성음 fallback).
   * 이름: punch·slash·heavy·swing·hit·finisher·chop·mine·pick·pickup·fish_cast·fish_catch·mon_die·boss_roar·boss_slam·boss_down·hurt·jump·land·slam·evolve,
   * 보스 무기는 w_<id>·f_<id>·g_<id>
   */
  play: (name: string, vol = 0.6, fallback: 'tap' | 'rustle' | 'knock' | 'boing' | 'pop' | null = null, rate = 1) => {
    if (!sample(name, vol, rate) && fallback) sfx[fallback]();
  },
};

// ───────────────────────── 배경음악 ─────────────────────────
// 녹음된 곡(public/assets/music/<분위기>.mp3)을 분위기에 따라 바꿔 튼다: 낮 · 밤 · 보스전.
// 곡을 못 받았을 때만, 파일 없이 WebAudio로 연주하는 오르골풍 반복곡(8마디, 5음계)으로 대신한다.

export type MusicMood = 'day' | 'night' | 'boss';
const TRACK_VOL: Record<MusicMood, number> = { day: 0.34, night: 0.32, boss: 0.36 };
interface Track {
  el: HTMLAudioElement;
  gain: GainNode;
}
const tracks = new Map<MusicMood, Track>();
let mood: MusicMood = 'day';
/** 곡 파일을 쓸 수 없다 → 합성 음악으로 */
let fileFailed = false;

function track(m: MusicMood): Track | null {
  if (!ctx) return null;
  let t = tracks.get(m);
  if (!t) {
    const el = new Audio(`${import.meta.env.BASE_URL}assets/music/${m}.mp3`);
    el.loop = true;
    el.preload = 'auto';
    // 아이폰은 audio.volume을 못 바꾸므로 WebAudio의 gain으로 크기를 조절한다
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    try {
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    } catch {
      fileFailed = true;
      return null;
    }
    el.addEventListener('error', () => {
      fileFailed = true;
      refreshMusic();
    });
    t = { el, gain };
    tracks.set(m, t);
  }
  return t;
}

/** 분위기에 맞는 곡으로 바꾼다 (낮 · 밤 · 보스전). 부드럽게 넘어간다 */
export function setMusicMood(m: MusicMood) {
  if (m === mood) return;
  mood = m;
  refreshMusic();
}

function playTracks(want: boolean) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const cur = want && !fileFailed ? track(mood) : null;
  tracks.forEach((t, m) => {
    t.gain.gain.cancelScheduledValues(now);
    if (t === cur) {
      t.gain.gain.setTargetAtTime(TRACK_VOL[m], now, 0.5);
      if (t.el.paused) {
        void t.el.play().catch(() => {
          /* 첫 터치 전에는 못 튼다 → 다음 refreshMusic에서 다시 */
        });
      }
    } else {
      t.gain.gain.setTargetAtTime(0.0001, now, 0.25);
      if (!t.el.paused) window.setTimeout(() => tracks.get(mood) !== t || !settings.music || document.hidden ? t.el.pause() : undefined, 1200);
    }
  });
}

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
  const on = settings.music && !document.hidden;
  playTracks(on);
  // 합성 음악은 곡 파일을 못 쓸 때만
  const want = on && fileFailed;
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

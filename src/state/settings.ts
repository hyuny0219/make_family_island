const KEY = 'mfi.v1.settings';

interface Settings {
  sound: boolean;
  vibrate: boolean;
  music: boolean;
  /** 음량 0~1 */
  soundVol: number;
  musicVol: number;
  /** 조작 안내를 봤다 */
  guide: boolean;
  /** 곰을 고를 때 전체 화면으로 바꾸기 (지원하는 브라우저만) */
  fullscreen: boolean;
  /** 화면 방향: 가로가 기본 (세로는 설정에서 바꾼다) */
  landscape: boolean;
}

function load(): Settings {
  try {
    return { sound: true, vibrate: true, music: true, soundVol: 1, musicVol: 1, guide: false, fullscreen: true, landscape: true, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { sound: true, vibrate: true, music: true, soundVol: 1, musicVol: 1, guide: false, fullscreen: true, landscape: true };
  }
}

export const settings = load();

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  settings[k] = v;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* noop */
  }
}

/** 모든 진행을 지우고 처음부터 */
export function resetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('mfi.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
  location.reload();
}

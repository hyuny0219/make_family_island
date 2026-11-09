const KEY = 'mfi.v1.settings';

interface Settings {
  sound: boolean;
  vibrate: boolean;
}

function load(): Settings {
  try {
    return { sound: true, vibrate: true, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { sound: true, vibrate: true };
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

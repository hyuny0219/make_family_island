/** 이미 본 이야기(오프닝·대화)를 기기에 적어 둔다 */
const KEY = 'mfi.v1.story';

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const seen = load();

export const story = {
  seen: (k: string) => seen.has(k),
  mark(k: string) {
    if (seen.has(k)) return;
    seen.add(k);
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen]));
    } catch {
      /* noop */
    }
  },
};

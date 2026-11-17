/** 받침 유무에 따라 조사 붙이기: withJosa('돌 곡괭이', '이', '가') → '돌 곡괭이가' */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string) {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const batchim = isHangul && (last - 0xac00) % 28 !== 0;
  return word + (batchim ? withBatchim : withoutBatchim);
}

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const DOUBLE: Record<string, string> = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' };

/** 한글 한 글자를 초성·중성·종성 번호로 나눈다 (한글 음절이 아니면 null) */
function split(ch: string) {
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return null;
  return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 };
}

/**
 * 찾는 말 q가 이름 name에 들어 있는지 — 초성만 넣어도(ㅅㅌ → 사탕), 글자를 치는 도중이어도(사ㅌ, 샅 → 사탕) 찾아 준다.
 * 띄어쓰기는 무시한다.
 */
export function matchKorean(name: string, query: string) {
  const n = name.replace(/\s+/g, '');
  const q = query.replace(/\s+/g, '');
  if (!q) return true;
  if (n.includes(q)) return true;
  const one = (qc: string, i: number, last: boolean): boolean => {
    const nc = n[i];
    if (nc === undefined) return false;
    if (qc === nc) return true;
    const ns = split(nc);
    if (!ns) return false;
    // 초성 한 글자
    if (CHO.includes(qc)) return CHO[ns.cho] === qc;
    const qs = split(qc);
    if (!qs || qs.cho !== ns.cho || qs.jung !== ns.jung) return false;
    // 받침 없이 친 글자는 받침 있는 글자의 앞부분 (사 → 삭)
    if (qs.jong === 0) return last;
    if (qs.jong === ns.jong) return true;
    // 치는 도중: 받침으로 붙은 자음이 사실은 다음 글자의 초성 (샅 → 사탕)
    if (!last) return false;
    const next = split(n[i + 1] ?? '');
    if (!next) return false;
    if (ns.jong === 0) return CHO[next.cho] === JONG[qs.jong];
    // 겹받침으로 붙은 경우 (팑 → 판자)
    const pair = DOUBLE[JONG[qs.jong]];
    return !!pair && JONG[ns.jong] === pair[0] && CHO[next.cho] === pair[1];
  };
  for (let s = 0; s + q.length <= n.length; s++) {
    let ok = true;
    for (let k = 0; k < q.length && ok; k++) ok = one(q[k], s + k, k === q.length - 1);
    if (ok) return true;
  }
  return false;
}

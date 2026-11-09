/** 받침 유무에 따라 조사 붙이기: withJosa('돌 곡괭이', '이', '가') → '돌 곡괭이가' */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string) {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const batchim = isHangul && (last - 0xac00) % 28 !== 0;
  return word + (batchim ? withBatchim : withoutBatchim);
}

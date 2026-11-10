/** 섬마다 하나씩 숨어 있는 보물 (섬 번호 순서). 가장 깊은 지역의 보물 상자에 들어 있다 */
export const TREASURES: { name: string; story: string }[] = [
  { name: '황금 꿀단지', story: '아무리 먹어도 줄지 않는 달콤한 꿀' },
  { name: '무지개 꽃', story: '일곱 빛깔로 피는 단 하나의 꽃' },
  { name: '황금 솔방울', story: '천 년 된 소나무가 남긴 선물' },
  { name: '왕진주', story: '달빛을 머금은 커다란 진주' },
  { name: '별빛 보석', story: '밤하늘에서 떨어진 별 조각' },
  { name: '달빛 버섯', story: '어두운 숲을 밝혀 주는 버섯' },
  { name: '얼음 왕관', story: '절대 녹지 않는 눈의 왕관' },
  { name: '황금 모래시계', story: '시간이 천천히 흐르는 모래시계' },
  { name: '용의 알', story: '따뜻하게 두근거리는 신비한 알' },
  { name: '무지개 별', story: '구름 위에서만 뜨는 소원의 별' },
];

export const treasureKey = (island: number) => `treasure_${island}`;

import type { BearId } from './assets';

/** 그림 한 장 + 자막 (오프닝·엔딩) */
export interface CutPage {
  img: string;
  text: string;
}

/** 대화 한 줄 */
export interface TalkLine {
  who: BearId;
  text: string;
}

export const STORY_IMAGES = ['story_1', 'story_2', 'story_3', 'story_4', 'story_5', 'story_6'];

export const OPENING: CutPage[] = [
  { img: 'story_1', text: '햇살 좋은 어느 날,\n곰 가족은 작은 배를 타고 소풍을 떠났어요.' },
  { img: 'story_2', text: '그런데 갑자기 먹구름이 몰려오더니…\n"모두 꼭 붙잡아!"' },
  { img: 'story_3', text: '눈을 떠 보니 처음 보는 섬.\n배는 부서졌지만 가족은 모두 무사했어요.' },
  { img: 'story_4', text: '모래밭의 유리병에서 낡은 지도가 나왔어요.\n"열 개의 섬에 보물이 하나씩…\n모두 모으면 무지개 별이 소원을 들어준대!"' },
  { img: 'story_5', text: '"우리 같이 찾아보자!"\n곰 가족의 섬 모험이 시작됩니다.' },
];

export const ENDING: CutPage[] = [
  { img: 'story_6', text: '열 번째 보물이 빛나자\n구름 위로 무지개 별이 떠올랐어요.' },
  { img: 'story_6', text: '"소원을 말해 보렴."\n곰 가족은 서로를 바라보며 웃었어요.' },
  { img: 'story_5', text: '"집으로 돌아가는 것도 좋지만…\n이 섬들이 벌써 우리 집인걸요!"' },
  { img: 'story_6', text: '무지개 별은 열 개의 섬을 환하게 비춰 주었어요.\n가족 섬 이야기는 계속됩니다. 🌈' },
];

/** 섬에 처음 도착했을 때 */
const ISLAND_TALKS: TalkLine[][] = [
  [
    { who: 'dad', text: '휴, 다들 괜찮니? 일단 텐트부터 쳤단다.' },
    { who: 'baby', text: '배고파… 저기 나무에 열매가 있어!' },
    { who: 'mom', text: '나뭇가지랑 열매를 모아 보자. 구름에 가린 곳은 표지판에서 열 수 있대.' },
    { who: 'kid', text: '지도에 그려진 첫 번째 보물, 이 섬 어딘가에 있을 거야!' },
  ],
  [
    { who: 'kid', text: '우와, 온통 꽃밭이야! 향기 좋다~' },
    { who: 'mom', text: '꽃으로 꽃 왕관을 만들 수 있겠는걸.' },
    { who: 'dad', text: '지도에는 일곱 빛깔 꽃이 피어 있다고 적혀 있구나.' },
  ],
  [
    { who: 'dad', text: '나무가 정말 크구나. 길을 잃지 않게 붙어 다니자.' },
    { who: 'baby', text: '통나무 속에서 소리가 나! 톡톡 두드려 볼래.' },
    { who: 'kid', text: '천 년 된 소나무의 선물이 여기 있대.' },
  ],
  [
    { who: 'baby', text: '바다다! 조개 많다!' },
    { who: 'mom', text: '모래에 X 표시가 보이면 파 보렴. 뭔가 묻혀 있을지 몰라.' },
    { who: 'kid', text: '달빛을 머금은 진주… 꼭 찾고 싶어.' },
  ],
  [
    { who: 'dad', text: '바위투성이구나. 돌 검을 챙겨 두길 잘했어.' },
    { who: 'kid', text: '반짝이는 바위를 깨면 보석이 나온대!' },
    { who: 'mom', text: '밤에는 박쥐가 나오니 어두워지면 캠프로 돌아오자.' },
  ],
  [
    { who: 'baby', text: '버섯이 집만큼 커! 통통 뛰어도 돼?' },
    { who: 'mom', text: '빨간 점박이 버섯은 조심하렴. 독이 있단다.' },
    { who: 'kid', text: '어두운 숲을 밝히는 달빛 버섯이 여기 있을 거야.' },
  ],
  [
    { who: 'baby', text: '눈이다! 눈사람 만들자!' },
    { who: 'dad', text: '그 눈사람은… 움직이는구나. 조심하자.' },
    { who: 'mom', text: '얼음 구멍에서 낚시하면 큰 물고기가 잘 잡힌대.' },
  ],
  [
    { who: 'kid', text: '덥다… 모래바람 때문에 앞이 잘 안 보여.' },
    { who: 'dad', text: '물가를 따라 걷자. 선인장은 건드리지 말고.' },
    { who: 'mom', text: '시간이 천천히 흐르는 모래시계라니, 궁금하구나.' },
  ],
  [
    { who: 'baby', text: '산에서 불이 나와!' },
    { who: 'dad', text: '화산이란다. 용암 근처는 뜨거우니 길로 다니자.' },
    { who: 'kid', text: '따뜻하게 두근거리는 알… 혹시 용의 알일까?' },
  ],
  [
    { who: 'kid', text: '구름 위야! 우리가 하늘에 있어!' },
    { who: 'mom', text: '여기가 마지막 섬이구나. 정말 멀리 왔네.' },
    { who: 'dad', text: '무지개 별이 우리를 기다리고 있단다. 끝까지 함께 가자.' },
  ],
];

/** 섬의 보물을 찾았을 때 */
const TREASURE_TALKS: TalkLine[][] = [
  [
    { who: 'baby', text: '꿀단지다! 아무리 먹어도 안 줄어!' },
    { who: 'dad', text: '첫 번째 보물이구나. 이제 배를 만들어 다음 섬으로 가 보자.' },
  ],
  [
    { who: 'mom', text: '어머, 꽃잎마다 색이 다르네. 정말 곱다.' },
    { who: 'kid', text: '두 개째! 지도가 진짜였어.' },
  ],
  [
    { who: 'dad', text: '황금 솔방울이라… 오래된 숲이 준 선물이구나.' },
    { who: 'baby', text: '반짝반짝해!' },
  ],
  [
    { who: 'kid', text: '진주가 달처럼 빛나!' },
    { who: 'mom', text: '벌써 네 개째란다. 다들 잘하고 있어.' },
  ],
  [
    { who: 'kid', text: '별 조각이 진짜 하늘에서 떨어진 걸까?' },
    { who: 'dad', text: '딱 절반 모았구나. 남은 섬도 힘내 보자.' },
  ],
  [
    { who: 'baby', text: '버섯이 불 켜졌어!' },
    { who: 'mom', text: '이제 밤길도 덜 무섭겠는걸.' },
  ],
  [
    { who: 'kid', text: '왕관이 하나도 안 차가워. 신기해!' },
    { who: 'dad', text: '일곱 개. 무지개 색만큼 모았구나.' },
  ],
  [
    { who: 'mom', text: '모래가 정말 천천히 떨어지네.' },
    { who: 'kid', text: '이제 두 섬만 남았어!' },
  ],
  [
    { who: 'baby', text: '알이 콩닥콩닥해. 따뜻해…' },
    { who: 'dad', text: '소중히 데려가자. 마지막 섬이 코앞이란다.' },
  ],
  [
    { who: 'kid', text: '열 개 다 모았어! 저기 봐, 별이 떠오르고 있어!' },
    { who: 'mom', text: '모두 함께라서 여기까지 올 수 있었단다.' },
  ],
];

/** 처음 겪는 일마다 한 번씩 */
const ONCE_TALKS: Record<string, TalkLine[]> = {
  boat: [
    { who: 'dad', text: '배가 다 됐구나! 이번엔 튼튼하게 만들었단다.' },
    { who: 'kid', text: '선착장에서 언제든 지나온 섬으로 돌아갈 수도 있대.' },
  ],
  friend: [
    { who: 'mom', text: '새 친구가 생겼네! 집을 지어 주면 거기서 살 수 있단다.' },
    { who: 'baby', text: '친구야, 같이 놀자!' },
  ],
  night: [
    { who: 'mom', text: '해가 지는구나. 밤에는 몬스터가 더 많이 나온단다.' },
    { who: 'dad', text: '텐트나 침대에서 가족이 다 같이 자면 아침이 돼.' },
  ],
  dungeon: [
    { who: 'kid', text: '여기가 던전… 으스스해.' },
    { who: 'dad', text: '내 뒤에 붙으렴. 힘들면 언제든 나가도 된단다.' },
  ],
};

export function talkLines(key: string): TalkLine[] | undefined {
  const m = /^(island|treasure)_(\d+)$/.exec(key);
  if (m) return (m[1] === 'island' ? ISLAND_TALKS : TREASURE_TALKS)[Number(m[2])];
  return ONCE_TALKS[key];
}

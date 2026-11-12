import type { ItemId } from './items';
import type { MonsterDef } from './monsters';

/** 변신 능력 — 섬 보스를 잡으면 그 섬의 능력을 얻는다 (순서 = 섬 번호) */
export interface Ability {
  id: string;
  emoji: string;
  /** 단계별 이름 (1 → 2 → 3단계로 진화) */
  names: [string, string, string];
  /** 무엇을 하는지. {n}에는 단계별 숫자가 들어간다 */
  desc: string;
  /** 단계별 숫자 */
  n: [number, number, number];
  /** 변신 중에 버튼으로 쓰는 특별한 기술 */
  skill: { name: string; desc: string; cd: number; n: [number, number, number] };
}

export const ABILITIES: Ability[] = [
  { id: 'leaf', emoji: '🍃', names: ['새싹', '잎사귀', '숲의 왕'], desc: '채집할 때 {n}% 확률로 하나 더', n: [50, 75, 100], skill: { name: '덩굴 묶기', desc: '주변 몬스터를 {n}초 동안 묶고 체력을 조금 회복해요', cd: 12, n: [2.5, 3.5, 5] } },
  { id: 'bee', emoji: '🐝', names: ['꿀벌', '말벌', '여왕벌'], desc: '공격이 {n}% 빨라져요', n: [40, 70, 100], skill: { name: '벌떼 돌격', desc: '가까운 몬스터를 {n}번 연달아 쏴요', cd: 10, n: [4, 6, 9] } },
  { id: 'wood', emoji: '🪵', names: ['나무', '통나무', '거목'], desc: '받는 피해가 {n}% 줄어요', n: [25, 40, 55], skill: { name: '거목의 방패', desc: '{n}초 동안 어떤 공격도 통하지 않아요', cd: 16, n: [3, 4.5, 6] } },
  { id: 'bubble', emoji: '🫧', names: ['물방울', '거품', '파도'], desc: '{n}% 확률로 공격을 막아요', n: [30, 45, 60], skill: { name: '물대포', desc: '주변 몬스터를 멀리 밀어내고 {n}만큼 아프게 해요', cd: 10, n: [2, 4, 6] } },
  { id: 'rock', emoji: '🪨', names: ['조약돌', '바위', '산'], desc: '공격력 +{n}', n: [2, 3, 5], skill: { name: '땅 울리기', desc: '땅을 쳐서 주변 몬스터 모두에게 {n} 피해', cd: 11, n: [4, 6, 9] } },
  { id: 'poison', emoji: '🍄', names: ['포자', '독버섯', '독안개'], desc: '때린 몬스터가 3초 동안 초당 {n}씩 아파요', n: [1, 2, 3], skill: { name: '독안개', desc: '주변 몬스터 모두가 4초 동안 초당 {n}씩 아파요', cd: 12, n: [2, 3, 5] } },
  { id: 'ice', emoji: '❄️', names: ['서리', '얼음', '눈보라'], desc: '때린 몬스터가 {n}초 동안 얼어요', n: [1, 1.5, 2.5], skill: { name: '눈보라', desc: '주변 몬스터 모두를 {n}초 동안 얼려요', cd: 14, n: [3, 4, 5.5] } },
  { id: 'sand', emoji: '🌵', names: ['가시', '선인장', '모래폭풍'], desc: '곰을 때린 몬스터가 {n}만큼 아파요', n: [2, 3, 5], skill: { name: '모래폭풍', desc: '3초 동안 곰 둘레에 폭풍이 돌며 계속 {n}씩 때려요', cd: 12, n: [2, 3, 4] } },
  { id: 'fire', emoji: '🔥', names: ['불씨', '화염', '용의 불'], desc: '공격이 주변 몬스터에게도 {n}씩 튀어요', n: [1, 2, 3], skill: { name: '불기둥', desc: '주변 몬스터 모두에게 큰 불 피해 {n}', cd: 12, n: [6, 9, 13] } },
  { id: 'thunder', emoji: '⚡', names: ['찌릿', '번개', '폭풍'], desc: '1.5초마다 가까운 몬스터에게 번개 {n}', n: [1, 2, 3], skill: { name: '벼락', desc: '멀리 있는 몬스터까지 벼락을 내려 {n} 피해', cd: 12, n: [5, 7, 10] } },
];

export const hatKey = (id: string) => `hat_${id}`;
/** 강화(진화)에 드는 것: 2단계, 3단계 */
export const UPGRADE_COST: Partial<Record<ItemId, number>>[] = [
  { boss_token: 3, crystal: 2 },
  { boss_token: 8, crystal: 5 },
];

/** 섬 보스 (순서 = 섬 번호). 던전 맨 안쪽에서 기다린다 */
const B = (i: number, name: string, drop: ItemId): MonsterDef => ({
  id: `boss${i}`,
  tex: `boss_${i}`,
  name,
  hp: 24 + i * 10,
  dmg: 10 + i * 2,
  speed: 44 + i * 2,
  drops: [[drop, 4], ['crystal', 1]],
  n: [5, 6],
  aggressive: true,
  boss: true,
});

export const BOSSES: MonsterDef[] = [
  B(0, '슬라임 대왕', 'jelly'),
  B(1, '여왕벌', 'honey'),
  B(2, '나무 골렘', 'mushroom'),
  B(3, '대왕 게', 'crab'),
  B(4, '바위 골렘', 'berry'),
  B(5, '버섯 대왕', 'mushroom'),
  B(6, '설인', 'ice'),
  B(7, '선인장 대왕', 'cactus_fruit'),
  B(8, '불꽃 용', 'ember'),
  B(9, '폭풍 구름 왕', 'cotton'),
];

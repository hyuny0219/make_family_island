/**
 * 보스 무기 — 변신(보스에게서 얻은 능력)을 입으면 기본 공격이 그 보스의 무기로 바뀐다.
 * 변신이 진화하면 무기도 같이 커지고 세진다.
 */
export interface Weapon {
  /** 단계별 이름 */
  names: [string, string, string];
  desc: string;
  /** 들고 있는 그림 */
  tex: string;
  /** 닿는 거리 (맨손·검은 36) */
  reach: number;
  /** 공격력에 곱하는 값 */
  dmg: number;
  /** 공격 간격에 곱하는 값 (클수록 느리다) */
  slow: number;
  /** 손에 들었을 때 그림을 눕히는 각도와 크기 */
  hold: { angle: number; scale: number };
}

export const WEAPONS: Record<string, Weapon> = {
  leaf: { names: ['덩굴 채찍', '가시 덩굴 채찍', '숲의 채찍'], desc: '멀리까지 휘두르고, 맞은 몬스터가 잠깐 묶여요', tex: 'weapon_whip', reach: 66, dmg: 1, slow: 1, hold: { angle: 0, scale: 0.8 } },
  bee: { names: ['벌침 새총', '말벌 새총', '여왕벌 새총'], desc: '멀리서 벌침을 빠르게 쏴요', tex: 'weapon_sling', reach: 130, dmg: 0.8, slow: 0.9, hold: { angle: 0, scale: 0.85 } },
  wood: { names: ['나무 망치', '통나무 망치', '거목 망치'], desc: '느리지만 두 배로 세고, 옆의 몬스터도 함께 맞아요', tex: 'weapon_hammer', reach: 40, dmg: 2, slow: 1.9, hold: { angle: 0, scale: 0.9 } },
  bubble: { names: ['물총', '거품 물총', '파도 물총'], desc: '멀리서 물을 쏴서 몬스터를 뒤로 밀어내요', tex: 'weapon_water', reach: 110, dmg: 0.8, slow: 1, hold: { angle: 0, scale: 0.85 } },
  rock: { names: ['돌 곡괭이', '바위 곡괭이', '수정 곡괭이'], desc: '찍으면 바위 조각이 뒤쪽 몬스터까지 꿰뚫고 날아가요', tex: 'weapon_pick', reach: 44, dmg: 1.2, slow: 1.25, hold: { angle: 0, scale: 0.9 } },
  fire: { names: ['불꽃 검', '화염 검', '용의 검'], desc: '검이 불타올라 넓게 베고, 맞은 몬스터는 3초 동안 불이 붙어요', tex: 'weapon_flame', reach: 44, dmg: 1.3, slow: 1, hold: { angle: -45, scale: 0.95 } },
};

/** 변신 옷(망토)의 빛깔: [망토, 안감·무늬, 빛] */
export const COSTUME: Record<string, [number, number, number]> = {
  leaf: [0x5fae52, 0x8bd17c, 0xc9f5a6],
  bee: [0xf2b632, 0x4a3b2a, 0xffe58a],
  wood: [0x9c6b3f, 0xc9a66b, 0xe8d0a0],
  bubble: [0x4aa3df, 0x9fdcff, 0xd6f3ff],
  rock: [0x8d8d94, 0xc4c4cc, 0xe6e6ee],
  poison: [0x8e5bb8, 0xc79be8, 0xe8ccff],
  ice: [0x7fc4ee, 0xe6f7ff, 0xffffff],
  sand: [0xd9b46a, 0x6fae5a, 0xf5e2a8],
  fire: [0xe2522b, 0xffb03d, 0xffe08a],
  thunder: [0x6b55c9, 0xffe066, 0xfff6b8],
};

/** 몸에 입는 의상 그림이 있는 변신 (없는 변신은 망토를 덧그린다) */
export const BEAR_SKINS = ['leaf', 'bee', 'wood', 'bubble'].flatMap((a) => [a, `${a}2`, `${a}3`]);

/** 의상 그림의 꼬리표: 서기, 걷기 2장, 동작 4장 */
export const SKIN_FRAMES = ['', '_w1', '_w2', '_a1', '_a2', '_a3', '_a4'];

/** 단계에 맞는 의상 이름들: 그 단계 그림이 없으면 아래 단계 것을 쓴다 (예: bee3 → bee2 → bee) */
export const skinNames = (id: string, lv: number) => Array.from({ length: lv }, (_, i) => `${id}${lv - i > 1 ? lv - i : ''}`);

/** 단계에 맞는 무기 그림 (진화한 그림이 없으면 처음 그림) */
export function weaponTex(textures: { exists: (k: string) => boolean }, id: string, lv: number) {
  const base = WEAPONS[id]?.tex ?? '';
  for (let l = lv; l > 1; l--) if (textures.exists(`${base}${l}`)) return `${base}${l}`;
  return base;
}

/** 진화한 무기 그림 이름들 (불러올 때 쓴다) */
export const WEAPON_STAGE_TEX = Object.values(WEAPONS).flatMap((w) => [`${w.tex}2`, `${w.tex}3`]).concat(['fx_sting2', 'fx_sting3']);

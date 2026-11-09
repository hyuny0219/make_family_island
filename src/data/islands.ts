import type { Biome } from './biomes';
import type { ItemId } from './items';

export interface IslandTheme {
  name: string;
  emoji: string;
  /** 지역 수 (30~50) */
  regions: number;
  seed: number;
  /** 지역 분위기 가중치 — 모든 분위기가 최소 1개씩은 나온다 */
  biomes: Partial<Record<Biome, number>>;
  /** 바닥·오브젝트 색 보정 (전용 아트가 나오기 전 임시) */
  tint?: number;
  /** 다음 섬으로 가는 배 재료 */
  boat: Partial<Record<ItemId, number>>;
}

/** 배 재료 — 머지로 만든 판자가 꼭 들어간다 (i = 섬 번호) */
const boat = (i: number): Partial<Record<ItemId, number>> => ({
  plank: 3 + i,
  stone: 10 + i * 4,
  pinecone: 6 + i * 3,
  shell: 5 + i * 2,
  fish: 3 + i,
});

/** 10개의 섬. 뒤로 갈수록 지역이 많아지고 퀘스트가 어려워진다. */
export const ISLANDS: IslandTheme[] = [
  { name: '곰돌이 섬', emoji: '🐻', regions: 30, seed: 101, biomes: { orchard: 3, forest: 2, meadow: 2, rocky: 1, beach: 2 }, boat: boat(0) },
  { name: '꽃향기 섬', emoji: '🌸', regions: 32, seed: 202, biomes: { meadow: 5, orchard: 2, beach: 2, forest: 1, rocky: 1 }, boat: boat(1) },
  { name: '솔방울 섬', emoji: '🌲', regions: 34, seed: 303, biomes: { forest: 5, orchard: 1, meadow: 1, rocky: 2, beach: 1 }, boat: boat(2) },
  { name: '조개 섬', emoji: '🐚', regions: 37, seed: 404, biomes: { beach: 5, orchard: 2, meadow: 1, rocky: 1, forest: 1 }, boat: boat(3) },
  { name: '바위 섬', emoji: '⛰️', regions: 39, seed: 505, biomes: { rocky: 5, forest: 2, beach: 1, meadow: 1, orchard: 1 }, boat: boat(4) },
  { name: '버섯 섬', emoji: '🍄', regions: 41, seed: 606, biomes: { forest: 4, meadow: 3, orchard: 1, rocky: 1, beach: 1 }, tint: 0xf0e2ff, boat: boat(5) },
  { name: '눈송이 섬', emoji: '❄️', regions: 43, seed: 707, biomes: { forest: 3, rocky: 3, meadow: 1, beach: 1, orchard: 1 }, tint: 0xe6f2ff, boat: boat(6) },
  { name: '모래바람 섬', emoji: '🌵', regions: 45, seed: 808, biomes: { beach: 4, rocky: 3, orchard: 1, meadow: 1, forest: 1 }, tint: 0xfff0c8, boat: boat(7) },
  { name: '불꽃 섬', emoji: '🌋', regions: 47, seed: 909, biomes: { rocky: 5, forest: 1, beach: 1, meadow: 1, orchard: 1 }, tint: 0xffdccc, boat: boat(8) },
  { name: '구름 섬', emoji: '☁️', regions: 50, seed: 1010, biomes: { meadow: 4, orchard: 2, forest: 2, beach: 1, rocky: 1 }, tint: 0xeef6ff, boat: {} },
];

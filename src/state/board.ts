import { ITEMS, type ItemId } from '../data/items';

export const BOARD_COLS = 6;
export const BOARD_ROWS = 6;
const KEY = 'mfi.v1.board';

export type Cell = ItemId | null;

/** 개인 머지 보드 (이 기기에 저장) */
export function loadBoard(): Cell[] {
  const empty = () => new Array<Cell>(BOARD_COLS * BOARD_ROWS).fill(null);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const arr = JSON.parse(raw) as Cell[];
    if (!Array.isArray(arr) || arr.length !== BOARD_COLS * BOARD_ROWS) return empty();
    return arr.map((c) => (c && c in ITEMS ? c : null));
  } catch {
    return empty();
  }
}

export function saveBoard(cells: Cell[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cells));
  } catch {
    /* noop */
  }
}

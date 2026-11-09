import Phaser from 'phaser';
import { firebaseConfig } from '../firebaseConfig';

const LS_CODE = 'mfi.v1.family';
const LS_DEVICE = 'mfi.v1.device';

export interface FeedItem {
  /** 시각(ms) */
  t: number;
  /** 누가 (곰 이름) */
  who: string;
  msg: string;
  /** 보낸 기기 */
  dev: string;
}

/** Firestore families/{code} 문서 모양 — 가족이 함께 쓰는 모든 것 */
export interface FamilyDoc {
  inv: Record<string, number>;
  order: string[];
  unlocked: Record<string, number[]>;
  boats: number[];
  placed: Record<string, { id: string; tx: number; ty: number }[]>;
  joined: string[];
  hearts: Record<string, number>;
  orders: Record<string, { item: string; n: number }>;
  nextAt: Record<string, number>;
  feed: FeedItem[];
  createdAt?: number;
}

export type SyncStatus = 'off' | 'connecting' | 'online' | 'error';

type Op = { kind: 'inc' | 'union' | 'remove' | 'set' | 'del'; path: string; value?: unknown };
type Fs = typeof import('firebase/firestore');

function deviceId() {
  try {
    let id = localStorage.getItem(LS_DEVICE);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(LS_DEVICE, id);
    }
    return id;
  } catch {
    return 'nodevice';
  }
}

/**
 * 가족 동기화. 가족 코드(6자리)로 Firestore 문서 하나를 함께 쓴다.
 * - 저장소(창고·진행·마을)는 평소처럼 이 기기에 먼저 저장하고, 같은 변경을 여기로 보낸다 (inc/union/…)
 * - 문서가 바뀌면 'doc' 이벤트로 알려서 저장소가 최신 상태로 맞춘다
 * - Firebase 모듈은 가족에 들어가 있을 때만 불러온다
 * 이벤트: 'doc'(FamilyDoc), 'status'(SyncStatus), 'feed'(FeedItem) — 다른 기기가 올린 새 소식
 */
class FamilySync extends Phaser.Events.EventEmitter {
  readonly enabled = !!firebaseConfig;
  readonly device = deviceId();
  code: string | null = null;
  status: SyncStatus = 'off';
  /** 소식에 붙일 이름 (고른 곰) */
  who = '가족';
  feed: FeedItem[] = [];

  private fs: Fs | null = null;
  private ref: import('firebase/firestore').DocumentReference | null = null;
  private unsub: (() => void) | null = null;
  private queue: Op[] = [];
  private flushing = false;
  private timer: number | null = null;
  private seenFeed = 0;

  constructor() {
    super();
    try {
      this.code = localStorage.getItem(LS_CODE);
    } catch {
      /* noop */
    }
  }

  get active() {
    return this.enabled && !!this.code;
  }

  /** 앱 시작 시: 이미 가족에 들어가 있으면 연결 */
  async init() {
    if (this.active) await this.connect().catch(() => this.setStatus('error'));
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    this.emit('status', s);
  }

  private async load() {
    if (this.fs) return this.fs;
    const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = initializeApp(firebaseConfig!);
    // 오프라인에서도 놀 수 있게 기기에 캐시하고, 다시 연결되면 밀린 변경을 보낸다
    fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    await auth.signInAnonymously(auth.getAuth(app));
    this.fs = fs;
    return fs;
  }

  private docRef(fs: Fs, code: string) {
    return fs.doc(fs.getFirestore(), 'families', code);
  }

  /** 새 가족 섬 만들기 — 지금 이 기기의 진행을 그대로 올린다. 가족 코드를 돌려준다 */
  async create(initial: FamilyDoc) {
    if (!this.enabled) throw new Error('disabled');
    this.setStatus('connecting');
    try {
      const fs = await this.load();
      let code = '';
      for (let i = 0; i < 8; i++) {
        code = String(Math.floor(100000 + Math.random() * 900000));
        if (!(await fs.getDoc(this.docRef(fs, code))).exists()) break;
      }
      await fs.setDoc(this.docRef(fs, code), { ...initial, createdAt: Date.now() });
      this.saveCode(code);
      await this.connect();
      return code;
    } catch (e) {
      this.setStatus('error');
      throw e;
    }
  }

  /** 코드로 가족 섬에 들어가기. 없는 코드면 false */
  async join(code: string) {
    if (!this.enabled) throw new Error('disabled');
    this.setStatus('connecting');
    try {
      const fs = await this.load();
      const snap = await fs.getDoc(this.docRef(fs, code));
      if (!snap.exists()) {
        this.setStatus(this.code ? 'online' : 'off');
        return false;
      }
      this.saveCode(code);
      await this.connect();
      return true;
    } catch (e) {
      this.setStatus('error');
      throw e;
    }
  }

  /** 가족 섬에서 나가기 (이 기기의 진행은 그대로 남는다) */
  leave() {
    this.unsub?.();
    this.unsub = null;
    this.ref = null;
    this.queue = [];
    this.feed = [];
    this.code = null;
    try {
      localStorage.removeItem(LS_CODE);
    } catch {
      /* noop */
    }
    this.setStatus('off');
  }

  private saveCode(code: string) {
    this.code = code;
    try {
      localStorage.setItem(LS_CODE, code);
    } catch {
      /* noop */
    }
  }

  private async connect() {
    this.setStatus('connecting');
    const fs = await this.load();
    this.unsub?.();
    this.ref = this.docRef(fs, this.code!);
    this.seenFeed = Date.now();
    this.unsub = fs.onSnapshot(
      this.ref,
      (snap) => {
        const d = snap.data() as FamilyDoc | undefined;
        if (!d) return;
        this.setStatus('online');
        this.handleFeed(d.feed ?? []);
        this.emit('doc', d);
      },
      () => this.setStatus('error'),
    );
    void this.flush();
  }

  private handleFeed(feed: FeedItem[]) {
    this.feed = [...feed].sort((a, b) => b.t - a.t).slice(0, 30);
    for (const f of this.feed) {
      if (f.t > this.seenFeed && f.dev !== this.device) this.emit('feed', f);
    }
    this.seenFeed = Math.max(this.seenFeed, ...this.feed.map((f) => f.t));
    // 소식이 너무 쌓이면 최근 것만 남긴다
    if (feed.length > 40) this.push({ kind: 'set', path: 'feed', value: this.feed.slice(0, 20) });
  }

  // ───────── 저장소가 부르는 변경 함수 (가족에 안 들어가 있으면 아무 일도 안 한다) ─────────

  inc(path: string, n: number) {
    this.push({ kind: 'inc', path, value: n });
  }
  union(path: string, value: unknown) {
    this.push({ kind: 'union', path, value });
  }
  remove(path: string, value: unknown) {
    this.push({ kind: 'remove', path, value });
  }
  set(path: string, value: unknown) {
    this.push({ kind: 'set', path, value });
  }
  del(path: string) {
    this.push({ kind: 'del', path });
  }

  /** 가족 소식판에 한 줄 올리기 */
  post(msg: string) {
    if (!this.active) return;
    const item: FeedItem = { t: Date.now(), who: this.who, msg, dev: this.device };
    this.union('feed', item);
  }

  private push(op: Op) {
    if (!this.active) return;
    this.queue.push(op);
    // 재료 개수 변화는 잠깐 모았다가 한 번에 보내고(쓰기 횟수 절약), 그 밖의 변경은 바로 보낸다
    if (op.kind !== 'inc') {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      void this.flush();
    } else if (this.timer === null) {
      this.timer = window.setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, 400);
    }
  }

  /** 밀린 변경을 한 번에 보낸다. 같은 칸을 건드리는 변경은 순서를 지키려고 나눠 보낸다 */
  private async flush() {
    if (this.flushing || !this.fs || !this.ref) return;
    this.flushing = true;
    const fs = this.fs;
    try {
      while (this.queue.length) {
        const batch: Record<string, unknown> = {};
        const incs: Record<string, number> = {};
        while (this.queue.length) {
          const op = this.queue[0];
          if (op.kind === 'inc') {
            if (op.path in batch && !(op.path in incs)) break;
            incs[op.path] = (incs[op.path] ?? 0) + (op.value as number);
            batch[op.path] = fs.increment(incs[op.path]);
          } else {
            if (op.path in batch) break;
            batch[op.path] =
              op.kind === 'union' ? fs.arrayUnion(op.value) : op.kind === 'remove' ? fs.arrayRemove(op.value) : op.kind === 'del' ? fs.deleteField() : op.value;
          }
          this.queue.shift();
        }
        // 오프라인이면 기기 캐시에 쌓였다가 연결되면 올라간다 (await하지 않아야 오프라인에서 멈추지 않는다)
        fs.updateDoc(this.ref, batch).catch(() => this.setStatus('error'));
      }
    } finally {
      this.flushing = false;
    }
  }
}

export const family = new FamilySync();

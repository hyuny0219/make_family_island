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
  treasures?: number[];
  placed: Record<string, { id: string; tx: number; ty: number }[]>;
  joined: string[];
  hearts: Record<string, number>;
  orders: Record<string, { item: string; n: number }>;
  nextAt: Record<string, number>;
  feed: FeedItem[];
  createdAt?: number;
}

/** 다른 가족의 곰 위치 (Realtime Database presence/{code}/{device}) */
export interface Presence {
  /** 고른 곰 */
  bear: string;
  island: number;
  x: number;
  y: number;
  /** 걸어가는 목적지 (서 있으면 x,y와 같다) */
  tx: number;
  ty: number;
  /** 마지막 말풍선 이모지와 보낸 시각(ms) */
  e?: string;
  et?: number;
  /** 있는 곳: ''(섬 밖), 'd'(던전), 'h…'(집 안) — 같은 곳에 있는 가족만 서로 보인다 */
  z?: string;
  /** 그곳에 들어간 시각(ms). 가장 먼저 들어간 기기가 몬스터를 움직인다 */
  zt?: number;
  /** 보낸 시각(ms) */
  t: number;
}

/** 함께 싸우는 몬스터 한 마리 (presence/{code}/_battle/{zone}/mobs/{id}) */
export interface MobNet {
  /** 종류 (MONSTERS의 id, 보스는 'boss') */
  k: string;
  x: number;
  y: number;
  hp: number;
  /** 최대 체력 */
  mx: number;
  /** 1: 사나움, 2: 던전 부하(멀리서도 쫓아온다) */
  f?: number;
  /** 쫓는 중 */
  c?: 1;
  /** 마지막으로 문 상대(기기)와 문 횟수 */
  b?: [string, number];
}

/** 몬스터를 움직이지 않는 기기가 때린 것 (…/hits/{pushId}) */
export interface HitNet {
  m: string;
  d: number;
  by: string;
  /** 얼리는 시간(초) */
  fz?: number;
}

export type SyncStatus = 'off' | 'connecting' | 'online' | 'error';

type Op = { kind: 'inc' | 'union' | 'remove' | 'set' | 'del'; path: string; value?: unknown };
type Fs = typeof import('firebase/firestore');
type Rt = typeof import('firebase/database');

/** 이 시간(ms) 동안 소식이 없으면 나간 것으로 본다 */
const PRESENCE_STALE = 90_000;

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
  private rt: Rt | null = null;
  private presRef: import('firebase/database').DatabaseReference | null = null;
  private presUnsub: (() => void) | null = null;
  private presLast: Omit<Presence, 't'> | null = null;
  private presSentAt = 0;
  private presTimer: number | null = null;
  /** 같은 가족 섬에 접속해 있는 다른 기기들 */
  others: Record<string, Presence> = {};
  private othersKey = '';
  /** 서버 시계와 이 기기 시계의 차이(ms) — 기기마다 시계가 조금씩 달라도 순서를 똑같이 본다 */
  private timeOffset = 0;
  private batZone: string | null = null;
  private batRef: import('firebase/database').DatabaseReference | null = null;
  private batUnsubs: (() => void)[] = [];

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
    this.stopPresence();
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
    void this.startPresence().catch(() => undefined);
  }

  // ───────── 다른 가족 곰 위치 (Realtime Database) ─────────

  private async startPresence() {
    if (!firebaseConfig?.databaseURL || !this.code) return;
    const rt = (this.rt ??= await import('firebase/database'));
    this.stopPresence(false);
    const db = rt.getDatabase();
    this.presRef = rt.ref(db, `presence/${this.code}/${this.device}`);
    rt.onValue(rt.ref(db, '.info/serverTimeOffset'), (snap) => {
      this.timeOffset = Number(snap.val()) || 0;
    });
    // 앱을 닫거나 연결이 끊기면 서버가 알아서 지운다
    void rt.onDisconnect(this.presRef).remove();
    this.presUnsub = rt.onValue(rt.ref(db, `presence/${this.code}`), (snap) => {
      const all = (snap.val() ?? {}) as Record<string, Presence>;
      const now = Date.now();
      const others: Record<string, Presence> = {};
      for (const [dev, p] of Object.entries(all)) {
        // '_'로 시작하는 칸은 곰이 아니다 (함께 싸우는 몬스터 등)
        if (dev[0] !== '_' && dev !== this.device && p && now - p.t < PRESENCE_STALE) others[dev] = p;
      }
      // 몬스터 소식 때문에 자주 불리므로, 곰 위치가 바뀌었을 때만 알린다
      const key = JSON.stringify(others);
      if (key === this.othersKey) return;
      this.othersKey = key;
      this.others = others;
      this.emit('presence', others);
    });
    if (this.presLast) this.sendPresence();
    this.attachBattle();
  }

  // ───────── 함께 싸우기: 몬스터 상태 공유 (presence/{code}/_battle/{zone}) ─────────

  /** 싸움터에 들어간다 (null이면 나온다). 'mobs'(Record<string, MobNet>)와 'hit'(HitNet, key) 이벤트가 온다 */
  battleJoin(zone: string | null) {
    if (zone === this.batZone) return;
    this.batZone = zone;
    this.attachBattle();
  }

  private attachBattle() {
    this.batUnsubs.forEach((u) => u());
    this.batUnsubs = [];
    if (this.batRef && this.rt) void this.rt.onDisconnect(this.rt.child(this.batRef, 'mobs')).cancel().catch(() => undefined);
    this.batRef = null;
    if (!this.rt || !this.code || !this.batZone || !this.presRef) return;
    const rt = this.rt;
    const base = rt.ref(rt.getDatabase(), `presence/${this.code}/_battle/${this.batZone}`);
    this.batRef = base;
    this.batUnsubs.push(rt.onValue(rt.child(base, 'mobs'), (snap) => this.emit('mobs', (snap.val() ?? {}) as Record<string, MobNet>)));
    this.batUnsubs.push(rt.onChildAdded(rt.child(base, 'hits'), (snap) => this.emit('hit', snap.val() as HitNet, snap.key)));
  }

  /** (몬스터를 움직이는 기기) 몬스터 상태를 올린다. null이면 싸움터를 비운다 */
  battlePublish(mobs: Record<string, MobNet> | null) {
    if (!this.batRef || !this.rt) return;
    const ref = this.rt.child(this.batRef, 'mobs');
    if (mobs) {
      // 내가 갑자기 끊기면 서버가 지워서, 남은 가족이 이어받는다
      void this.rt.onDisconnect(ref).remove();
      void this.rt.set(ref, mobs).catch(() => undefined);
    } else {
      void this.rt.onDisconnect(ref).cancel().catch(() => undefined);
      void this.rt.remove(this.batRef).catch(() => undefined);
    }
  }

  /** (그 밖의 기기) 몬스터를 때렸다고 알린다 */
  battleHit(hit: HitNet) {
    if (!this.batRef || !this.rt) return;
    void this.rt.push(this.rt.child(this.batRef, 'hits'), hit).catch(() => undefined);
  }

  /** (몬스터를 움직이는 기기) 처리한 타격을 지운다 */
  battleAck(key: string | null) {
    if (!this.batRef || !this.rt || !key) return;
    void this.rt.remove(this.rt.child(this.batRef, `hits/${key}`)).catch(() => undefined);
  }

  private stopPresence(removeMine = true) {
    this.presUnsub?.();
    this.presUnsub = null;
    if (removeMine && this.presRef && this.rt) void this.rt.remove(this.presRef).catch(() => undefined);
    if (removeMine) this.presRef = null;
    if (this.presTimer !== null) window.clearTimeout(this.presTimer);
    this.presTimer = null;
    if (removeMine) {
      this.batUnsubs.forEach((u) => u());
      this.batUnsubs = [];
      this.batRef = null;
    }
    this.others = {};
    this.othersKey = '';
    this.emit('presence', this.others);
  }

  /** 서버 시계에 맞춘 지금 시각(ms) */
  now() {
    return Date.now() + this.timeOffset;
  }

  /** 내 곰 위치 알리기. 너무 자주 보내지 않게 0.25초에 한 번으로 묶는다 */
  setPresence(p: Omit<Presence, 't'>) {
    this.presLast = p;
    if (!this.presRef || !this.rt) return;
    const wait = 250 - (Date.now() - this.presSentAt);
    if (wait <= 0) this.sendPresence();
    else if (this.presTimer === null) {
      this.presTimer = window.setTimeout(() => {
        this.presTimer = null;
        this.sendPresence();
      }, wait);
    }
  }

  private sendPresence() {
    if (!this.presRef || !this.rt || !this.presLast) return;
    this.presSentAt = Date.now();
    const p = this.presLast;
    const r = (n: number) => Math.round(n);
    void this.rt.set(this.presRef, { bear: p.bear, island: p.island, x: r(p.x), y: r(p.y), tx: r(p.tx), ty: r(p.ty), ...(p.e ? { e: p.e, et: p.et ?? 0 } : {}), ...(p.z ? { z: p.z } : {}), zt: p.zt ?? 0, t: Date.now() }).catch(() => undefined);
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

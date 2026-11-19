/**
 * 첫 화면. 영상(없으면 그림) 위에 제목과 '시작하기' 단추만 보여 주고,
 * 단추를 눌러야 게임(코드와 그림·소리)을 받아 오기 시작한다.
 * 손가락이 닿은 그 순간에 시작하므로 소리도 바로 켤 수 있다.
 */
const root = document.getElementById('start')!;
const btn = document.getElementById('startBtn') as HTMLButtonElement;
const video = document.getElementById('startVideo') as HTMLVideoElement;

// 설정 (게임 코드를 받기 전이라 저장된 값을 직접 읽는다). 기본: 가로 화면 · 전체 화면
let saved: { landscape?: boolean; fullscreen?: boolean } = {};
try {
  saved = JSON.parse(localStorage.getItem('mfi.v1.settings') ?? '{}') as typeof saved;
} catch {
  /* noop */
}
const landscape = saved.landscape !== false;
const fullscreen = saved.fullscreen !== false;

/** 손가락이 닿은 이 순간에만 할 수 있는 것: 전체 화면으로 바꾸고 화면을 가로로 돌려 잠근다 (안드로이드. 아이폰은 지원하지 않는다) */
async function goLandscape(): Promise<boolean> {
  const lock = async () => {
    const o = screen.orientation as (ScreenOrientation & { lock?: (dir: string) => Promise<void> }) | undefined;
    if (!o?.lock) return false;
    try {
      await o.lock(landscape ? 'landscape' : 'portrait');
      return true;
    } catch {
      return false;
    }
  };
  const el = document.getElementById('game')!;
  // 화면을 돌려 잠그려면 전체 화면이어야 한다
  if (fullscreen && el.requestFullscreen && !document.fullscreenElement) {
    try {
      await el.requestFullscreen();
    } catch {
      /* 전체 화면을 못 쓰는 브라우저 */
    }
  }
  return lock();
}

// 영상: 파일이 있으면 소리 없이 되풀이해서 튼다 (없거나 못 틀면 그림이 그대로 보인다)
// 첫 화면은 폰을 든 그대로 보여 준다. 시작하기를 누르면 그때 전체 화면 + 가로로 바뀐다. (영상은 가로용 하나 — 세로에서는 가운데만 보인다)
video.src = `${import.meta.env.BASE_URL}assets/title/title_wide.mp4`;
video.addEventListener('playing', () => video.classList.add('on'));
video.addEventListener('error', () => video.remove());
void video.play().catch(() => {
  /* 자동 재생을 막아 둔 브라우저: 그림만 보인다 */
});

let started = false;
async function start() {
  if (started) return;
  started = true;
  void goLandscape();
  btn.textContent = '섬으로 가는 중…';
  btn.style.animation = 'none';
  // 화면이 가로로 다 돌아간 뒤에 게임을 만든다 (도는 중에 만들면 로딩 화면이 옛 크기로 그려져 잘린다)
  if (landscape) {
    for (let i = 0; i < 12 && window.innerWidth <= window.innerHeight; i++) await new Promise((r) => window.setTimeout(r, 100));
    await new Promise((r) => window.setTimeout(r, 120));
  }
  try {
    await import('./main');
  } catch {
    // 못 받았으면 다시 누를 수 있게
    started = false;
    btn.textContent = '▶ 다시 시도';
    return;
  }
  root.classList.add('gone');
  window.setTimeout(() => {
    video.pause();
    root.remove();
  }, 500);
}
btn.addEventListener('click', () => void start());

// 자동 테스트용: 주소에 ?autostart 가 있으면 바로 시작한다
if (new URLSearchParams(location.search).has('autostart')) void start();

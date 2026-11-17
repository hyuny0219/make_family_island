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
// 가로로 하는 게임이면 첫 화면부터 가로로 (세로로 든 폰에서는 눕혀서 보여 준다)
if (landscape) root.classList.add('land');

/** 손가락이 닿은 이 순간에만 할 수 있는 것: 전체 화면으로 바꾸고 화면을 가로로 돌려 잠근다 (안드로이드. 아이폰은 지원하지 않는다) */
function goLandscape() {
  const lock = () => {
    const o = screen.orientation as (ScreenOrientation & { lock?: (dir: string) => Promise<void> }) | undefined;
    void o?.lock?.(landscape ? 'landscape' : 'portrait').catch(() => {
      /* 지원하지 않는 기기 */
    });
  };
  const el = document.getElementById('game')!;
  if (fullscreen && el.requestFullscreen && !document.fullscreenElement) {
    void el.requestFullscreen().then(lock, lock);
  } else lock();
}

// 영상: 파일이 있으면 소리 없이 되풀이해서 튼다 (없거나 못 틀면 그림이 그대로 보인다)
const wide = landscape || window.innerWidth > window.innerHeight;
video.src = `${import.meta.env.BASE_URL}assets/title/${wide ? 'title_wide' : 'title_tall'}.mp4`;
video.addEventListener('playing', () => video.classList.add('on'));
video.addEventListener('error', () => video.remove());
void video.play().catch(() => {
  /* 자동 재생을 막아 둔 브라우저: 그림만 보인다 */
});

let started = false;
async function start() {
  if (started) return;
  started = true;
  goLandscape();
  btn.textContent = '섬으로 가는 중…';
  btn.style.animation = 'none';
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

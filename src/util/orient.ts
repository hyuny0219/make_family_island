import { settings } from '../state/settings';

/**
 * 설정대로 화면 방향(가로·세로)을 잠근다.
 * 안드로이드는 전체 화면이거나 홈 화면 앱일 때만 되고, 아이폰은 지원하지 않는다 → 안 되면 false.
 */
export async function lockOrientation(): Promise<boolean> {
  const o = screen.orientation as (ScreenOrientation & { lock?: (dir: string) => Promise<void> }) | undefined;
  if (!o?.lock) return false;
  try {
    await o.lock(settings.landscape ? 'landscape' : 'portrait');
    return true;
  } catch {
    return false;
  }
}

/** 지금 화면이 설정한 방향과 같은가 */
export function orientationOk() {
  return settings.landscape === window.innerWidth > window.innerHeight;
}

/**
 * Firebase 웹 앱 설정. 콘솔(프로젝트 설정 → 내 앱 → 웹 앱)의 firebaseConfig 값을 그대로 넣는다.
 * null이면 가족 동기화가 꺼지고, 게임은 이 기기에만 저장된다.
 * (이 값은 비밀이 아니다 — 접근 제어는 Firestore 보안 규칙이 맡는다. docs/FIREBASE.md 참고)
 */
export const firebaseConfig: Record<string, string> | null = null;

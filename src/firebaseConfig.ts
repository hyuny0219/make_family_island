/**
 * Firebase 웹 앱 설정 (콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱의 firebaseConfig).
 * null로 바꾸면 가족 동기화가 꺼지고, 게임은 이 기기에만 저장된다.
 * (이 값은 비밀이 아니다 — 접근 제어는 Firestore 보안 규칙이 맡는다. docs/FIREBASE.md 참고)
 */
export const firebaseConfig: Record<string, string> | null = {
  apiKey: 'AIzaSyDStVja9JJ6QUEVCKWmmDeaooXaJMfvU_4',
  authDomain: 'familyisland-76758.firebaseapp.com',
  projectId: 'familyisland-76758',
  storageBucket: 'familyisland-76758.firebasestorage.app',
  messagingSenderId: '219902267638',
  appId: '1:219902267638:web:ada5ce6318fff1f62a5cd7',
};

# 가족 동기화 (Firebase) 설정

가족이 각자 폰으로 **같은 섬·창고·마을**을 쓰게 해 주는 기능이다. Firebase 설정이 없으면 꺼져 있고, 게임은 각 기기에만 저장된다.

## 1. Firebase 콘솔에서 할 일 (한 번만)
1. https://console.firebase.google.com 에서 프로젝트 만들기 (무료 Spark 요금제로 충분)
2. **Firestore 데이터베이스** 만들기 — Standard 에디션, 위치 서울(asia-northeast3), 프로덕션 모드
3. **Authentication → 로그인 방법 → 익명** 사용 설정
4. **Authentication → 설정 → 승인된 도메인**에 `hyuny0219.github.io` 추가
5. **프로젝트 설정 → 내 앱 → 웹 앱 추가** → 나오는 `firebaseConfig` 값을 `src/firebaseConfig.ts`에 넣기
6. **Firestore → 규칙**에 아래를 붙여넣고 게시

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{code} {
      allow get, create, update: if request.auth != null;
    }
  }
}
```

- 익명 로그인한 앱만 접근할 수 있고, **가족 코드를 아는 사람만** 그 문서를 읽고 쓸 수 있다 (목록 조회·삭제는 막음)
- `firebaseConfig`는 비밀 값이 아니다. 접근 제어는 위 규칙이 맡는다
- 가족 코드는 숫자 6자리라, 모르는 사람이 맞히기는 어렵지만 불가능하지는 않다. 가족용 게임 수준의 보호다

## 1A. 곰 위치 공유 (Realtime Database, 선택)
같은 섬에 있는 가족의 곰이 서로 보이고 함께 걸어 다니게 하려면 Realtime Database를 켠다. 위치는 자주 바뀌어서 Firestore(하루 쓰기 2만 번 한도)가 아니라 여기로 보낸다.
1. 콘솔 → 빌드 → **Realtime Database** → 데이터베이스 만들기 (싱가포르 asia-southeast1, 잠금 모드)
2. **규칙** 탭에 아래를 붙여넣고 게시
3. 데이터 탭 위의 주소를 `src/firebaseConfig.ts`의 `databaseURL`에 넣기 (없으면 위치 공유만 꺼진다)

```
{
  "rules": {
    "presence": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

- 경로: `presence/{가족 코드}/{기기 id}` = `{ bear, island, x, y, tx, ty, t }`
- 누를 때·도착할 때·걷는 중 2초마다·서 있을 때 30초마다 보낸다(최대 0.25초에 한 번). 앱을 닫으면 서버가 지운다
- 받는 쪽은 그 곰을 목적지로 걸어가게 하고, 120px 넘게 어긋나면 바로 옮긴다. 다른 가족이 조종 중인 곰과 같은 곰은 캠프에서 숨긴다

### 함께 싸우기 (몬스터 공유)
- 규칙을 바꿀 필요 없다. 같은 `presence/{가족 코드}` 아래 `_battle/{싸움터}`를 쓴다 (싸움터: `i<섬>` = 섬 밖, `d<섬>` = 던전)
- 곰 위치에 `z`(있는 곳: 없음 = 섬 밖, `d` = 던전, `h…` = 집 안)와 `zt`(그곳에 들어간 시각)가 붙는다. 같은 곳에 있는 가족만 서로 보인다
- 그곳에 **가장 먼저 들어간 기기**가 몬스터를 움직이고, `…/mobs`에 1초에 4번 상태를 올린다 (같이 있는 가족이 있을 때만). 그 기기가 나가면 다음으로 먼저 들어온 기기가 이어받는다
- 다른 기기는 받은 대로 몬스터를 보여 주고, 때리면 `…/hits`에 올린다. 몬스터를 움직이는 기기가 체력을 깎고 지운다
- 시각은 서버 시계(`.info/serverTimeOffset`)에 맞춰서, 폰 시계가 조금 달라도 순서를 똑같이 본다

## 2. 게임에서 쓰는 법
- ⚙️ 설정 → **가족과 함께하기**
  - **새 가족 섬 만들기**: 지금 이 폰의 진행이 가족 섬이 되고, 6자리 가족 코드가 나온다
  - **코드로 들어가기**: 다른 폰에서 그 코드를 넣는다. 그 폰의 진행은 가족 섬 것으로 바뀐다
- 링크로 초대: `https://hyuny0219.github.io/make_family_island/?family=123456` 처럼 보내면 코드가 미리 채워진다
- 📰 버튼: 가족 소식판 (지역 해금, 배 완성, 새 주민, 황금 물고기)

## 3. 무엇이 공유되나
| 공유 (가족 섬 문서) | 기기마다 따로 |
|---|---|
| 창고(재료 개수), 도감 | 지금 있는 섬, 고른 곰 |
| 열린 지역, 만든 배 | 머지 보드 |
| 놓인 장식, 주민·호감도·부탁 | 소리·진동 설정 |
| 가족 소식 | |

## 4. 구조
- `src/sync/family.ts` — 연결, 코드 만들기/들어가기, 변경 보내기(`inc`/`union`/`remove`/`set`/`del`), 소식
- `src/sync/bridge.ts` — 문서가 바뀌면 저장소(`inventory`/`progress`/`village`)의 `applyRemote` 호출
- 저장소는 평소처럼 이 기기에 먼저 저장하고 같은 변경을 Firestore로 보낸다. 재료 개수는 `increment`라서 둘이 동시에 주워도 숫자가 맞는다
- 재료 개수 변화는 0.4초 모아서 한 번에 보낸다 (쓰기 횟수 절약). 오프라인이면 기기에 쌓였다가 연결되면 올라간다
- Firebase SDK는 가족 섬에 들어가 있을 때만 내려받는다

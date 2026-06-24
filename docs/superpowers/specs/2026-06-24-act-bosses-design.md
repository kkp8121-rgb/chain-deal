# 액트 구조 + 보스 12종 (Act Structure & Boss Roster) — 설계

> 최종 업데이트: 2026-06-24 · 대상 버전: v3.17 예정
> PLAN.md C-시리즈 보강. HANDOVER §7 옵션 "보스 종류 확장". 슬더슬급 액트 구조 + 보스 다양성.
> 사용자 방향: "보스 자체를 만들자(해금 아님), 슬더슬급 스테이지 + 레벨 밸런싱" → 액트(章) 구조 도입(Q1-B) + 매 안테 보스 유지 + 액트 보스 climax(Q2-A) + 보스 5→12종.

## 0. 한 줄 요약

8안테를 **3액트**로 묶고, 보스를 **5종 → 12종**으로 확장해 **액트별 티어 풀**(A1 순함 < A2 중간 < A3 가혹)에서 추출한다. 각 액트 마지막 안테(3·6·8)는 **"액트 보스"**(마퀴 보스 + tmult·연출 강화). 코어 루프(매 안테 보스)는 유지. 난이도 점프는 **숫자 벽이 아니라 보스 룰 티어**로(설계 철학).

## 1. 액트 구조

- **A1 = 안테1-3 / A2 = 안테4-6 / A3 = 안테7-8** (3+3+2).
- `actOf(ante) = ante<=3?1 : ante<=6?2 : 3`.
- **액트 전환 연출**: 안테 4·7 진입 시 배너 `⚔ ACT 2/3` + 사운드(`boom`). 목표 점수 곡선 `blindTarget`(1.5^ante) **불변** — 난이도는 보스 티어로.
- 액트-final 안테 = `[3,6,8].includes(ante)`.

## 2. 보스 배치 모델 (Q2-A 확정)

- **매 안테 보스 유지.** `BOSSES`에 `act`(1~3)·`actBoss`(bool) 필드 추가.
- `pickBoss(ante)`: `a=actOf(ante)`. 액트-final이면 `BOSSES.filter(act===a && actBoss)`, 아니면 `filter(act===a && !actBoss)`에서 시드 랜덤.
- 각 액트: **액트 보스 1종(actBoss) + 일반 3종**. 액트-final 안테(3·6·8)에 액트 보스 등장, 나머지 안테는 일반 풀.
- 액트 보스 배너: `👑 액트 보스: {name}` (일반은 기존 `{icon} 보스: {name}`).
- ⚠️ `minAnte` 필드는 **act 기반으로 대체**(제거). 기존 "안테1 순한 보스만" 의도는 A1 풀이 전부 순함으로 보존.

## 3. 보스 로스터 (12종 = 기존 5 + 신규 7)

| 액트 | id | 보스 | 룰 | 배선 | actBoss | tmult(초기) |
|---|---|---|---|---|---|---|
| A1 | red_curse | 🩸 단색의저주 | 빨강(♥♦) 기본 0 | base(기존) | | 1.0 |
| A1 | dull | 🗡 무딘칼날 | 체인 배율 −1 | mult(기존) | | 0.85 |
| A1 | tax | 👑 사치세 | 7·8 카드 기본 0 | base(신규) | ✔ | 0.85 |
| A1 | peasant | 🥖 보릿고개 | A·2·3 카드 기본 0 | base(신규) | | 0.9 |
| A2 | seal_run | 🚫 스트레이트봉인 | ±1 연속 무효 | connect(기존) | | 0.65 |
| A2 | stingy | ✋ 인색한손 | 손패 −1 | startBlind(기존) | | 0.65 |
| A2 | toll | 💸 연결세 | 체인 보너스 ×0.5 | bonus(신규) | | 0.7 |
| A2 | rust | 🦠 부식 | enh(★◆●) 전부 무효 | connect+base+mult(신규) | ✔ | 0.8 |
| A3 | seal_suit | 🔒 봉인된무늬 | ♠ 연결 불가 | connect(기존) | | 0.6 |
| A3 | frost | ❄ 냉각 | 줄 첫 2장 연결 무효 | placeCard 위치(신규) | | 0.7 |
| A3 | mono | 🎭 단일강요 | 같은숫자·연속 무효(같은 무늬만) | connect(신규) | | 0.55 |
| A3 | anchor | ⚓ 닻 | 체인 배율 최대 3 캡 | mult cap(신규) | ✔ | 0.6 |

- 액트 보스(마퀴): **A1=사치세 / A2=부식 / A3=닻**. tmult·지정은 §6 sim 캘리브로 확정(초기값 위 표).
- 모든 tmult = **초기값(캘리브 대상)**. 룰 가혹할수록 tmult↓로 목표 보정.

## 4. 코드 배선 (index.html)

### 4.1 `connect(a,b)` (line 195)
```js
function connect(a,b){
  const boss=S&&S.boss;
  if(!(boss&&boss.id==="rust") && (a.enh==="wild"||b.enh==="wild")) return true;   // 부식: 와일드 무력화
  if(boss&&boss.id==="seal_suit"){ if(a.suit===0||b.suit===0) return false; }
  const suitOk=a.suit===b.suit, rankOk=a.rank===b.rank;
  if(boss&&boss.id==="mono") return suitOk;                                        // 단일강요: 같은 무늬만
  const runOk=Math.abs(a.rank-b.rank)===1 && !(boss&&boss.id==="seal_run");
  return suitOk||rankOk||runOk;
}
```

### 4.2 `placeCard` base (line 382~386)
`const rust=S.boss&&S.boss.id==="rust";` 추가, base에 tax/peasant, gold enh에 rust 가드:
```js
  const rust=S.boss&&S.boss.id==="rust";
  let base = (S.boss&&S.boss.id==="red_curse"&&isRed(card.suit)) ? 0 : card.rank;
  if(S.boss){ if(S.boss.id==="tax"&&card.rank>=7) base=0; else if(S.boss.id==="peasant"&&card.rank<=3) base=0; }
  if(has("greed")) base+=3;
  if(card.enh==="gold" && !rust) base+=5;
  ...
```

### 4.3 `placeCard` mult/bonus (line 397~403)
mult enh에 rust 가드, anchor 캡, toll 보너스 반감:
```js
    for(let i=S.row.length-runLen;i<S.row.length;i++) if(S.row[i].enh==="mult" && !rust) mult+=1;
    if(S.boss&&S.boss.id==="dull") mult=Math.max(1,mult-1);
    mult=Math.min(mult, (S.boss&&S.boss.id==="anchor")?3:25);   // 닻: 배율 3 캡
    let sum=0; for(let i=S.row.length-runLen;i<S.row.length;i++) sum+=S.row[i].rank;
    bonus=sum*mult;
    if(has("jackpot") && runLen>=4) bonus*=2;
    if(S.boss&&S.boss.id==="toll") bonus=Math.round(bonus*0.5);   // 연결세: 보너스 반감
    gained+=bonus;
```

### 4.4 `placeCard` 연결 조건 (line 389) — 냉각(frost)
```js
  if(left && connect(card,left) && !(S.boss&&S.boss.id==="frost"&&S.row.length<=2)){   // 냉각: 줄 첫 2장 연결 무효
```

### 4.5 `BOSSES` (line 210) + `pickBoss` (line ~217)
- `BOSSES`: 12종, 각 `{id,icon,name,desc,tmult,act,actBoss}` (minAnte 제거).
- `actOf` 헬퍼 + `pickBoss(ante)` act 기반 재작성.

### 4.6 액트 전환 배너 — `advanceBlind`/`startBlind`
- `startBlind`에서 `S.blind===0 && [4,7].includes(S.ante)`면 액트 배너 출력(또는 advanceBlind에서 ante 증가 직후).

## 5. sim 동기화 (드리프트 규칙 — CLAUDE.md)

신규 7룰을 **`run-sim.cjs`·`balance-check.cjs`의 `connect()`/`gain()` 복제본**에도 배선:
- `connect(a,b,boss)`: rust(와일드 무력화)·mono(같은 무늬만) 추가.
- `gain(row,card,boss,...)`: tax/peasant(base 0)·rust(gold·mult enh 무효)·anchor(배율 3캡)·toll(보너스 ×0.5)·frost(첫 2장 무연결) 추가.
- `BOSSES` 배열에 act/actBoss/신규 7종 반영, `pickBoss` act 기반.
- `balance-check.cjs`: 현재 `minAnte<=1` 보스만 테스트 → **액트별 대표 보스 클리어율** 출력으로 확장(각 보스 변별 확인).

## 6. 밸런스 (tmult 캘리브)

- 목표 클리어율(그리디 sim): **일반 보스 55~72% / 액트 보스 ~50%**(더 빡빡). C2와 동일 — `run-sim.cjs`(풀런)·`balance-check.cjs`(보스별 단일라운드)로 측정 후 tmult 조정.
- 새 룰이 점수를 많이 깎을수록 tmult↓(목표↓)로 보정해 "억까 아님" 유지.
- 액트 전체 클리어 곡선이 무료 기준선(현 run-sim, 골드 경제 반영본) 대비 급변하지 않게 — 보스 다양성↑가 목적이지 난이도 폭증이 아님.

## 7. UI / 연출

- 액트 전환 배너(`⚔ ACT N`) + `boom`.
- 액트 보스 배너 `👑 액트 보스: {name}` (일반 보스와 시각 구분).
- 보스 미리보기/룰 표시는 기존 `banner` 인프라 재사용. 신규 비주얼 테마(배경 등) **비범위**.

## 8. 비범위 (YAGNI)

- 노드 맵·엘리트·이벤트·휴식(Q1-C) / 보스 해금(전부 기본 등장) / 액트별 풀 비주얼 테마 / 보스 고유 연출 애니메이션.

## 9. 검증 기준 (DoD)

1. `node tools/balance-check.cjs` 문법 OK + 액트별 보스 클리어율 출력(각 보스 변별).
2. `node tools/run-sim.cjs`(골드 경제 + 신규 보스 풀) 풀런 클리어율이 직전 기준선 대비 급락/급등 없음(보스 다양성 목적).
3. 12종 보스 전부 등장 가능(act 풀), 액트-final 안테에 액트 보스 등장.
4. 신규 7룰이 index.html ↔ run-sim ↔ balance-check 3곳 일관(드리프트 0) — 추출 스모크로 확인.
5. 카드 불변식·기존 부적/골드 경제 회귀 없음.

## 10. 영향 코드

- `prototype/index.html`: `connect`·`placeCard`(base/mult/bonus/연결조건)·`BOSSES`·`pickBoss`·`startBlind`/`advanceBlind`(액트 배너).
- `tools/run-sim.cjs`·`tools/balance-check.cjs`: `connect`/`gain`/`BOSSES`/`pickBoss` 동기화 + balance-check 액트별 출력.
- 문서: HANDOVER(§보스)·PLAN·CLAUDE(보스 룰/액트 + 드리프트 동기화 지점).

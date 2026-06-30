# CHAIN DEAL — 시작덱 변형 MVP "고랭크덱" 설계 (v3.28 목표)

> 작성: 2026-06-30 · 로드맵 **LONG**: 시작덱 변형 = *직교 리플레이축*(피어 로그라이크 4~15 시작덱 vs 우리 1종). 빠진 리플레이 다양성을 메움.
> 설계 결정(사용자, 브레인스토밍): ①진입 = **MVP**(변형 시스템 인프라 + 변형 1종) · ②변형 = **composition만**(룰/perk 없음, 빌드축 트레이드오프 내재) · ③MVP 변형 = **고랭크덱** · ④해금 = **시작부터 선택 가능**(게이팅 보류) · ⑤밸런스 = **`deckMult` 노브**(표준 밴드 보정, 파워크리프 방지)

---

## 0. 요약 & 목표

시작덱은 현재 `fullDeck()`(A~8 × 4무늬 = 32장 압축) **1종뿐**이라 리플레이축이 빈약하다. **변형 시스템**(런 시작 시 덱 선택) + **변형 1종(고랭크덱)**을 MVP로 추가해 turn 1부터 다른 빌드/느낌을 강제하는 직교 축을 증명한다. 검증 후 3~4종으로 확장(별도).

**MVP 원칙**: composition만 바꾼다(별도 룰 0). 빌드축 트레이드오프는 *덱 구성 자체*에 내재(고랭크덱 = 고점수·apex↑ / 저랭크·런·tax내성↓). 코어 연결-수읽기는 **보존**(4무늬 유지 — connect 결정 그대로). 단순성·압축(32장) 유지.

---

## 1. 변형 정의

### 덱 레지스트리 (데이터 구조)
변형 = `build` 함수 하나 + 메타. 확장은 항목 추가만(직교 축 골격).

```javascript
const DECKS=[
  {id:"standard", name:"표준덱",   desc:"A~8 균형 32장",                                  build:fullDeck, dmult:1.0},
  {id:"high",     name:"고랭크덱", desc:"A·2 없음·7·8 2배 — 고점수·정점 빌드, 단 사치세 보스 직격", build:highDeck, dmult:1.25},   // 시작 추정 — §3 run-sim 캘리브로 확정
];
```

### 고랭크덱 composition
무늬당 `{3,4,5,6,7,7,8,8}` (8장) × 4무늬 = **32장**. 평균 랭크 6.0(표준 4.5 대비 +1.5 ≈ 기본점수 +33%).
```javascript
function highDeck(){ const d=[]; for(let s=0;s<4;s++) for(const r of [3,4,5,6,7,7,8,8]) d.push(mkCard(s,r)); return d; }
```
- **내재 트레이드오프**: 고점수·apex/위세/거물/주춧돌 turn1부터 자연 / A·2 제거로 runts·저랭크 연료 상실·저랭크 런 감소 / **사치세(7·8 기본점수 0) 보스 직격**(7·8이 8/32 = 25%, 표준 대비 2배 타격) / 런은 3~8(6칸) 여전히 가능 → 코어 보존.

### deckMult (밸런스 보정 스칼라 — 룰 아님)
고랭크덱은 기본점수↑로 그냥 두면 더 쉬움 = 파워크리프(누구나 쉬운 덱 픽). 보스 `tmult`·`stakeMult`와 동격의 **목표 스칼라**로 보정한다(플레이어 비가시, 공정성). 표준=1.0. 고랭크=캘리브(§3).

---

## 2. 구현 (composition만 → index ↔ run-sim 2파일 미러)

### prototype/index.html
1. **DECKS 레지스트리** + **`highDeck()`** (fullDeck 근처).
2. **상태**: `S.variant`(선택 id) + `S.dmult`(해소된 스칼라). `S.deck`(카드 더미)와 이름 충돌 주의 — 변형 id는 `S.variant`.
3. **newGame**: `newGame(seed, stake, variant)` → `const v=DECKS.find(d=>d.id===variant)||DECKS[0]; S.variant=v.id; S.dmult=v.dmult; ... deck:shuffle(v.build())`. (기존 `shuffle(fullDeck())` 교체.)
4. **blindTarget**: `S.dmult` 인자 추가 → `round(blindBase(a)*stakeMult(a)*S.dmult*(b===0?1:b===1?1.4:1.6))`. (표준 dmult=1 → no-op = 기존 동작 보존.)
5. **선택 UI**: 런 시작 화면의 **stakes 선택기(◀St N▶) 패턴 재사용** — `◀ 덱이름 ▶` + desc 표시. 덱·스테이크 **독립 선택**(변형 × 사다리). 선택 시 `S.variant` 반영.
6. **영속**: `cd_meta.deck` = 마지막 선택 변형 id. `newGame` 기본값으로 로드(없으면 "standard").

### tools/run-sim.cjs
1. **DECKS·highDeck·deckMult 미러**: index와 **동일 composition·dmult 값**.
2. **runFull**: `runFull(strat, acc, stake, variant)` → 전역 `DMULT = (DECKS.find(d=>d.id===variant)||{}).dmult||1` 설정(STK 패턴), `state.deck = (DECKS.find(...)||{build:starterDeck}).build()`.
3. **blindTarget**: `*DMULT` 추가(stakeMult 옆).
4. **변형 스윕 대시보드**: 덱별(표준/고랭크) × 전략 클리어율 출력 → 고랭크 viability·밴드 확인 + deckMult 캘리브.

### tools/balance-check.cjs
- **미러 불필요**: 표준 덱(맨 덱)만 보므로 변형·deckMult **무관**(표준 dmult=1 = no-op 기준선 가드, stake0 선례와 동일). 문법 + 표준 기준선 가드 역할만.

★**드리프트 가드**: `highDeck` composition + `DECKS` dmult + blindTarget deckMult 팩터 = `index.html` ↔ `run-sim.cjs` **값·식 일치**. 선택 UI·cd_meta.deck는 index 전용.

---

## 3. 파라미터 (deckMult 캘리브)

- **목표**: 고랭크덱 클리어율을 표준 밴드(~7.6% balance, St0) 근처로. 변형 간 대략 동난이도 → "쉬운 덱 픽" 파워크리프 차단.
- **시작 추정**: 기본점수 +33% → dmult **~1.25** 가설(체인 sum↑가 mult 경유 증폭되니 1.2~1.35 범위).
- **절차**: run-sim 변형 스윕 → 고랭크(dmult=1) raw 클리어 측정 → 표준 대비 초과분만큼 dmult↑로 보정 → balance 빌드 기준 표준≈고랭크(±0.7pp) 수렴. tax/저랭크 상실이 자연 상쇄하는 정도도 실측(상쇄 크면 dmult 낮게).
- **가드**: ①표준 덱 기준선 **불변**(deckMult=1 no-op 확인) ②고랭크덱 전 전략에서 단독 지배·사망 없음(표준과 유사 분포) ③tax 보스 조건부 통과율 고랭크서 유의하게 낮음(=의도된 직격 입증, 단 클리어 가능).

---

## 4. 검증

1. **문법**: `node tools/balance-check.cjs` — index 파싱 OK + 표준 기준선 불변(변형 no-op 가드).
2. **밸런스(권위)**: `node tools/run-sim.cjs` — ①표준 기준선 7.6% 불변 ②고랭크덱 캘리브 후 표준 밴드 근처·비지배·비사망 ③tax 보스 고랭크 직격 확인.
3. **경제/해금 회귀**: `economy-check`·`unlock-check`(무관, 회귀 확인).
4. **UI 스모크**: 노드 DOM-스텁 — 덱 선택기 렌더·고랭크 선택→`newGame` 고랭크 빌드(32장·랭크분포)·정산 정상·`cd_meta.deck` 영속·콘솔에러0. (Playwright 미설치 대체.)

---

## 5. 범위

**IN**: `index.html`(DECKS·highDeck·S.variant/S.dmult·newGame 변형 인자·blindTarget deckMult·선택 UI·cd_meta.deck) · `run-sim.cjs`(DECKS·highDeck·dmult·runFull 변형 인자·blindTarget·변형 스윕) · 문서(HANDOVER/CLAUDE/PLAN).

**OUT (YAGNI)**:
- 변형 2종 이상(MVP=고랭크 1종 — 검증 후 플러시/짝수/소형 등 확장).
- 변형별 해금 게이팅(MVP=시작부터 선택; 확장 시 도입).
- 변형별 독립 스테이크 사다리(MVP=덱×스테이크 직교, 단순 곱).
- 변형 perk/룰(composition만 — B/C안 및 룰형 컷).
- 리더보드/공유 텍스트 덱 태깅(stake처럼 — 확장 시).
- balance-check/strategy-sim에 변형 이식(표준 기준선 가드만).

---

## 6. 리스크

- **파워크리프(쉬운 덱)**: deckMult로 표준 밴드 보정(§3) — 캘리브 실측 필수.
- **deckMult 상쇄 버그**: 보너스(handBonus/족보)는 `blindBase`(deckMult 무관) 기준 유지 — 목표만 deckMult로 오르고 보너스 쿠션 불변(난이도 사다리 v3.22 `blindBase` 분리 선례 준수). blindTarget에만 deckMult 적용.
- **드리프트(2파일)**: highDeck·dmult·blindTarget 팩터 index↔run-sim 미러.
- **S.deck vs S.variant 혼동**: 변형 id는 `S.variant`(카드더미 `S.deck`과 별개) — 명명 가드.
- **동시 funqa 작업**: 본 작업은 main 기반 `feature/start-deck` worktree 격리(funqa는 별 세션·feature/fun-qa). 끝에 FF 머지.
- **sim 한계**: 그리디 봇은 고랭크덱의 apex 의도배치(keystone 등)를 과소평가 가능 — deckMult는 balance 빌드 기준 캘리브(보수적).
</content>

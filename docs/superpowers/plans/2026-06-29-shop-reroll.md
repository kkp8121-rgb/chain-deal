# 상점 리롤 (희석 완화) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 골드로 상점 3오퍼를 재생성하는 에스컬레이팅 상점 리롤을 추가해 v3.24 부적 희석을 완화한다.

**Architecture:** index.html(rerollShop·버튼·openShop 리셋) ↔ run-sim.cjs(applyShop 디깅 모델) ↔ economy-check.cjs(에스컬레이팅 불변식) 3파일 동기화. `REROLL_BASE`는 3파일 일치(드리프트 가드). 검증=run-sim에서 balance가 희석(3.5%)→베이스라인(9.6%) 쪽 회복하되 미초과.

**Tech Stack:** vanilla JS 단일 HTML + node `.cjs` 시뮬. "테스트"=시뮬 실행 + 노드 DOM-스텁 스모크.

**설계 SSoT:** `docs/superpowers/specs/2026-06-29-shop-reroll-design.md`.

---

## 파일 구조

| 파일 | 책임 | 변경 |
|---|---|---|
| `prototype/index.html` | 게임 본체 | `REROLL_BASE` const · `S.shopRerolls` · `openShop` 리셋 · `rerollShop()` · `renderShop` 버튼 |
| `tools/run-sim.cjs` | 밸런스 시뮬 | `REROLL_BASE` · `applyShop` 디깅 루프 |
| `tools/economy-check.cjs` | 경제 불변식 | 에스컬레이팅 단조·골드부족 차단 테스트 |
| `HANDOVER.md` `CLAUDE.md` `docs/PLAN.md` | 문서 | v3.25 기록 |

---

## Task 1: index.html 상점 리롤 (UI + 로직)

**Files:** Modify `prototype/index.html` (L303 근처 const · openShop · renderShop · 신규 rerollShop)

- [ ] **Step 1: REROLL_BASE 상수 추가**

`prototype/index.html` L303(`const START_GOLD_PER_LV=3;`) 다음 줄에 추가:

```javascript
const REROLL_BASE=2;                   // 상점 리롤 기본 cost (에스컬레이팅: +S.shopRerolls) · run-sim·economy-check 동기화
```

- [ ] **Step 2: openShop에 리롤 카운터 리셋**

`prototype/index.html` `function openShop(){` 다음 줄(첫 줄)에 추가:

```javascript
  S.shopRerolls=0;
```

(결과: `function openShop(){\n  S.shopRerolls=0;\n  S.shopOffers = shuffle(...)...`)

- [ ] **Step 3: rerollShop() 함수 추가**

`function buyShop(i){` 바로 위에 추가:

```javascript
function rerollShop(){
  const cost=REROLL_BASE+S.shopRerolls;
  if(S.gold<cost) return;
  S.gold-=cost; S.shopRerolls++;
  S.shopOffers = shuffle(shopPool()).slice(0,3).map(o=>({...o, sold:false}));   // 보유 charm은 shopPool !has로 자동 제외
  document.getElementById("hGold").textContent=S.gold;
  try{beep(500,.05);}catch(e){}
  renderShop();
}
```

- [ ] **Step 4: renderShop에 리롤 버튼**

`prototype/index.html` renderShop의 `body.appendChild(off);`(오퍼 카드 묶음) 다음, `const skip=...`(상점 나가기) 앞에 추가:

```javascript
  const rrCost=REROLL_BASE+S.shopRerolls, canRR=S.gold>=rrCost;
  const rr=document.createElement("div"); rr.style.marginTop="10px";
  rr.innerHTML=`<button onclick="rerollShop()"${canRR?"":" disabled style='opacity:.45;cursor:not-allowed'"}>🔄 오퍼 새로고침 (💰${rrCost})</button>`;
  body.appendChild(rr);
```

- [ ] **Step 5: 문법 검증**

Run: `node tools/balance-check.cjs`
Expected: 문법 PASS (라운드 점수 규칙 무변경이라 클리어율 동일).

- [ ] **Step 6: 노드 DOM-스텁 스모크**

Create `<scratchpad>/reroll-smoke.cjs` — charm-smoke.cjs와 동일한 DOM 스텁 헤더(Proxy elStub/doc/g) 재사용 + 아래 로직:

```javascript
// (DOM 스텁 헤더는 charm-smoke.cjs L1~L40 그대로 복사)
const runner = new Function("g", "with(g){ "+code+"\n; g.__newGame=newGame; g.__openShop=openShop; g.__rerollShop=rerollShop; g.__S=()=>S; }");
runner(g);
g.__newGame();
const S=g.__S(); S.gold=100;
g.__openShop();
ok("openShop이 shopRerolls 리셋", S.shopRerolls===0);
const before=S.gold;
g.__rerollShop();
ok("리롤 후 shopRerolls=1", S.shopRerolls===1);
ok("리롤 cost=BASE(2) 차감", S.gold===before-2);
ok("리롤 후 오퍼 3장 재생성", Array.isArray(S.shopOffers) && S.shopOffers.length===3);
const g2=S.gold; g.__rerollShop();
ok("2회차 cost=3 차감", S.gold===g2-3);
// 골드 부족 차단
S.gold=0; const g3=S.gold; g.__rerollShop();
ok("골드 부족 시 no-op", S.gold===0 && S.shopRerolls===2);
```

Run: `node <scratchpad>/reroll-smoke.cjs`
Expected: 모든 ok ✓, fail 0.

- [ ] **Step 7: Commit**

```bash
git add prototype/index.html
git commit -m "feat: 상점 리롤 UI/로직 (에스컬레이팅 cost, 상점당 리셋)"
```

---

## Task 2: run-sim applyShop 디깅 모델

**Files:** Modify `tools/run-sim.cjs` (L108 근처 const · applyShop)

- [ ] **Step 1: REROLL_BASE 상수 추가**

`tools/run-sim.cjs` `const GOLD_BASE=1, GOLD_K=4;`(L108) 다음 줄에 추가:

```javascript
const REROLL_BASE=2;   // 상점 리롤 기본 cost (index.html·economy-check 동기화)
```

- [ ] **Step 2: applyShop을 디깅 모델로 교체**

`tools/run-sim.cjs` `applyShop` 함수 전체를 교체:

```javascript
function applyShop(state, strat){
  const SC=(STRATS[strat]||STRATS.balance).charm;
  const poolWanted=shopPool(state).some(o=>o.type==="charm" && SC[o.id]);   // 풀에 원하는 미보유 charm 있나(shopPool이 !owned 필터)
  let offers=shuffle(shopPool(state)).slice(0,3), rr=0;
  while(poolWanted && rr<8){
    const wantsNow=offers.some(o=>o.type==="charm" && SC[o.id]);            // 현재 오퍼에 원하는 charm 있나
    const rc=REROLL_BASE+rr;
    if(wantsNow || state.gold<rc) break;                                   // 보이거나 골드부족 → 디깅 중단
    state.gold-=rc; rr++; offers=shuffle(shopPool(state)).slice(0,3);
  }
  const mapped=offers.map(o=>({o,pr:priority(o,strat),cost:costOf(o)}));
  mapped.sort((a,b)=>b.pr-a.pr);
  for(const it of mapped){ if(state.gold>=it.cost){ state.gold-=it.cost; applyOne(state,it.o,strat); } }   // ★buy-everything 불변(discerning 실험 붕괴 교훈)
}
```

- [ ] **Step 3: 회복 측정**

Run: `node tools/run-sim.cjs`
Expected: 출력의 전략별 클리어율 — **balance가 희석값(약 3.5%)에서 회복**(목표 ~6~9%, ★베이스라인 9.6% 미초과). gem/apex/cartel/parity 신규빌드도 회복(피스 디깅↑)하되 비지배. 회복 정도를 기록(Task 4 캘리브 판정용).

- [ ] **Step 4: Commit**

```bash
git add tools/run-sim.cjs
git commit -m "feat: run-sim applyShop 상점 리롤 디깅 모델 (buy-everything 불변)"
```

---

## Task 3: economy-check 에스컬레이팅 불변식

**Files:** Modify `tools/economy-check.cjs`

- [ ] **Step 1: 에스컬레이팅 테스트 추가**

`tools/economy-check.cjs` L42(`console.log(fail ? ...`) 앞에 추가:

```javascript
// 5) 상점 리롤 에스컬레이팅 (cost = REROLL_BASE + shopRerolls) — index.html 동기화
const REROLL_BASE = 2;
const rerollCost = n => REROLL_BASE + n;
ok("리롤 1회차 = BASE(2)", rerollCost(0) === 2);
ok("리롤 2회차 = 3", rerollCost(1) === 3);
ok("리롤 단조 증가", rerollCost(0) < rerollCost(1) && rerollCost(1) < rerollCost(2));
const canReroll = (gold, n) => gold >= rerollCost(n);
ok("골드 부족 리롤 차단", canReroll(1, 0) === false && canReroll(2, 0) === true);
```

- [ ] **Step 2: 검증**

Run: `node tools/economy-check.cjs`
Expected: `✅ 전체 통과` (신규 4 assertion 포함).

- [ ] **Step 3: Commit**

```bash
git add tools/economy-check.cjs
git commit -m "test: economy-check 상점 리롤 에스컬레이팅 불변식"
```

---

## Task 4: REROLL_BASE 캘리브

**Files:** (필요 시) `prototype/index.html` · `tools/run-sim.cjs` · `tools/economy-check.cjs` 3파일 동시

- [ ] **Step 1: 회복 판정**

Task 2 Step 3의 run-sim 결과로 판정:
- balance가 **~7~9%(베이스라인 9.6% 근접, 미초과)** → BASE=2 확정, 이 Task 생략.
- balance가 여전히 낮음(<~6%, 회복 부족) → BASE를 **2→1**로 하향(리롤 싸게 = 디깅 쉬움).
- balance가 **>10%(과회복=파워 인플레)** → BASE를 **2→3**으로 상향.

- [ ] **Step 2: (조정 시) 3파일 REROLL_BASE 동시 변경**

`prototype/index.html`·`tools/run-sim.cjs`·`tools/economy-check.cjs`의 `REROLL_BASE` 값(+economy-check의 "BASE(2)" 기대값 텍스트)을 동일하게 변경.

- [ ] **Step 3: 재측정 + 전체 회귀**

Run: `node tools/run-sim.cjs` → balance 회복·미초과 재확인.
Run: `node tools/economy-check.cjs` → PASS.
Run: `node tools/unlock-check.cjs` → 26/0 (무관하나 회귀 확인).
Run: `node tools/balance-check.cjs` → 문법 PASS.

- [ ] **Step 4: (조정 시) Commit**

```bash
git add -A
git commit -m "fix: 상점 리롤 REROLL_BASE 캘리브 (run-sim 회복 가드)"
```

(조정 없으면 생략.)

---

## Task 5: 문서 갱신 + 배포

**Files:** Modify `HANDOVER.md` · `CLAUDE.md` · `docs/PLAN.md`

- [ ] **Step 1: HANDOVER.md**

§0 "다음 할 일" + §6 최상단에 v3.25 항목 추가: 상점 리롤(에스컬레이팅 골드-온리, v3.24 희석 -6pp 대응), 확정 REROLL_BASE 값, run-sim 회복 결과. §7 "▶다음" 갱신(상점 리롤 완료 → 위치맥락 보스룰 또는 색 settle 페이오프). 버전 v3.24→v3.25.

- [ ] **Step 2: CLAUDE.md**

"규칙 중복" 드리프트 섹션에 상점 리롤 동기화 지점 추가: `REROLL_BASE` 3파일(index/run-sim/economy-check) 일치, `applyShop` 디깅 모델 미러.

- [ ] **Step 3: docs/PLAN.md**

MID/후속 섹션에 "상점 리롤 ✅ (v3.25)" 항목 + "▶다음" 포인터 갱신. 헤더 버전.

- [ ] **Step 4: Commit + 배포**

```bash
git add HANDOVER.md CLAUDE.md docs/PLAN.md
git commit -m "docs: 상점 리롤 (v3.25) — HANDOVER/CLAUDE/PLAN 갱신"
git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$(gh auth token)"; }; f' push origin main
```

(push hang 시 HANDOVER §2 참조. Pages 1~2분 후 반영.)

---

## 검증 요약 (DoD)

- [ ] `node tools/run-sim.cjs`: balance 희석(3.5%)에서 회복(~7~9%, 베이스라인 9.6% 미초과) · 신규빌드 비지배 유지
- [ ] `node tools/economy-check.cjs`: 에스컬레이팅 4 assertion 포함 전체 통과
- [ ] `node tools/balance-check.cjs`: 문법 PASS
- [ ] 노드 DOM 스모크: rerollShop 차감·shopRerolls 증가·오퍼 재생성·골드부족 차단
- [ ] 3파일 REROLL_BASE 일치(드리프트 0)
- [ ] 문서 3종 갱신 + push
```

# 시작덱 변형 MVP "고랭크덱" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 런 시작 시 시작덱을 고를 수 있는 변형 시스템 + 변형 1종(고랭크덱)을 추가한다.

**Architecture:** `DECKS` 레지스트리(각 변형 = `build` 함수 + `dmult` 목표 스칼라). `newGame(seed,stake,variant)`가 변형의 `build()`로 덱 생성·`S.dmult` 설정, `blindTarget`이 `dmult`로 목표 보정(파워크리프 차단). 런 시작 화면에 덱 선택기(stakes 선택기 패턴 복제). run-sim(권위)서 먼저 구현·dmult 캘리브 후 index에 값 미러(2파일). composition만(룰 없음).

**Tech Stack:** vanilla JS 단일 파일(`prototype/index.html`) + node 시뮬(`tools/*.cjs`). 테스트 프레임워크 없음 — 검증 = run-sim/balance-check/economy-check + DOM 스모크.

**설계 SSoT:** `docs/superpowers/specs/2026-06-30-start-deck-variants-design.md`

---

## File Structure

- **Modify `tools/run-sim.cjs`** (밸런스 권위 + dmult 캘리브): `highDeckSim` 빌더 · `DECKS` 레지스트리 · `DMULT` 전역 · `runFull` variant 인자 · `blindTarget` deckMult 팩터 · 변형 스윕 대시보드.
- **Modify `prototype/index.html`** (게임): `highDeck` 빌더 · `DECKS` 레지스트리(dmult 미러) · `META_DEFAULT.deck` · `newGame` variant 인자 + `S.variant`/`S.dmult` · `blindTarget` deckMult · 덱 선택기 UI(`selDeck`/`deckStep`/`renderDeckLbl`) + newGame 호출부 배선.
- **Modify `HANDOVER.md`/`CLAUDE.md`/`docs/PLAN.md`** (문서): v3.28 항목·드리프트 지점.

**드리프트 가드:** `highDeck` composition + `DECKS` dmult + `blindTarget` deckMult 팩터 = `run-sim.cjs` ↔ `index.html` **값·식 일치**. 선택 UI·`cd_meta.deck`는 index 전용. `balance-check.cjs`는 표준 덱만(dmult=1 no-op) → 미러 불필요.

---

## Task 1: run-sim.cjs — 변형 인프라 + 고랭크덱 + 변형 스윕 (raw)

**Files:** Modify `tools/run-sim.cjs` (starterDeck L14 뒤 · blindTarget L72 · STK/runFull L187-190 · 파일 끝 대시보드)

- [ ] **Step 1: highDeckSim 빌더 + DECKS 레지스트리 추가**

`starterDeck()` (L14) **바로 뒤**에 삽입:

```javascript
function highDeckSim(){ const d=[]; for(let s=0;s<4;s++) for(const r of [3,4,5,6,7,7,8,8]) d.push({suit:s,rank:r,enh:null}); return d; }
const DECKS=[{id:"standard",build:starterDeck,dmult:1},{id:"high",build:highDeckSim,dmult:1}];   // dmult: Task 2서 high 캘리브
let DMULT=1;   // 덱 목표 스칼라 — runFull이 설정(미지정=표준=1, no-op 기준선 가드)
```

- [ ] **Step 2: blindTarget에 DMULT 팩터 추가**

L72 교체:

```javascript
const blindTarget=(a,b)=>Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6));
```

- [ ] **Step 3: runFull에 variant 인자 + DMULT/덱 빌드 설정**

L188 `function runFull(strat, acc, stake){` → variant 인자 추가, L190 `const state={deck:starterDeck(), ...}` 교체:

```javascript
function runFull(strat, acc, stake, variant){   // variant: 시작덱 id(미지정=standard)
  STK = stake|0;
  const v = DECKS.find(d=>d.id===variant) || DECKS[0];
  DMULT = v.dmult;
  const state={deck:v.build(), owned:[], bonusHand:0, gold:0};
```

(기존 `STK = stake|0;` 줄과 `const state=...` 줄을 위 블록으로 교체. 나머지 runFull 본문 불변. ★기존 무-variant 호출은 variant=undefined → DECKS[0]=standard → DMULT=1·starterDeck = 기존 동작 보존.)

- [ ] **Step 4: 변형 스윕 대시보드 추가 (파일 끝)**

파일 맨 끝에 추가:

```javascript
// ★ 시작덱 변형 스윕 — 덱별 balance 빌드 클리어율(고랭크덱 viability·dmult 캘리브용)
console.log(`\n=== 시작덱 변형: 덱별 클리어율 (밸런스 빌드, ${N} 런) ===`);
for(const v of DECKS){ let win=0; for(let i=0;i<N;i++){ if(runFull("balance",null,0,v.id).result==="win") win++; } console.log(`  ${v.id.padEnd(9)} dmult=${v.dmult}: ${(win/N*100).toFixed(1)}%`); }
```

- [ ] **Step 5: 실행 — 고랭크덱 raw 난이도 관찰**

Run: `node tools/run-sim.cjs 2>&1 | grep -A3 "시작덱 변형"` 그리고 `node tools/run-sim.cjs 2>&1 | grep "St0:"`
Expected: `standard ... : ~7.x%` · `high dmult=1: __%`(raw, 표준보다 높을 것=캘리브 대상). St0 표준 기준선 불변(~7.6%, variant 미지정 경로). 에러 0.

- [ ] **Step 6: Commit**

```bash
git add tools/run-sim.cjs
git commit -m "feat(sim): 시작덱 변형 인프라 + 고랭크덱 + 변형 스윕 (dmult 미보정)"
```

---

## Task 2: deckMult 캘리브 (고랭크덱 → 표준 밴드)

**Files:** Modify `tools/run-sim.cjs` (DECKS high dmult 1개)

목표: 고랭크덱 balance 클리어율을 **표준 ±0.7pp**로(파워크리프 차단). 가드: ①표준 불변(no-op) ②고랭크 비지배·비사망 ③tax 보스 고랭크 직격(조건부↓).

- [ ] **Step 1: raw 측정 기록**

Run: `node tools/run-sim.cjs 2>&1 | grep -A3 "시작덱 변형"`
- `standard %`(=기준 밴드)와 `high dmult=1 %`(raw)를 기록.

- [ ] **Step 2: dmult 설정·반복**

DECKS의 high `dmult:1` → 추정값으로. 시작 **1.25**. 규칙: high 클리어 > standard+0.7pp면 dmult↑(예: 1.25→1.35), < standard−0.7pp면 dmult↓(1.25→1.15). 0.05 단위 조정.

```javascript
const DECKS=[{id:"standard",build:starterDeck,dmult:1},{id:"high",build:highDeckSim,dmult:1.25}];
```

- [ ] **Step 3: 재측정 — 수렴까지 반복**

Run: `node tools/run-sim.cjs 2>&1 | grep -A3 "시작덱 변형"`
- high가 standard ±0.7pp에 들면 통과. 아니면 Step 2 dmult 조정 후 재실행(보통 1~2회).

- [ ] **Step 4: tax 직격 확인 (의도 입증)**

Run: `node tools/run-sim.cjs 2>&1 | grep -E "사치세"`
Expected: 표준 빌드 기준 사치세 조건부 통과율은 기존대로(이 대시보드는 표준 빌드라 변형 무관 — 참고용). ※고랭크 tax 직격은 설계 의도로 기록(MVP 정량 게이트 아님; raw 측정서 고랭크가 tax 안테서 더 죽는지 정성 확인 가능).

- [ ] **Step 5: 확정값 기록 + Commit**

확정 dmult 메모: `▶ high dmult=____ (high __% vs standard __%)`

```bash
git add tools/run-sim.cjs
git commit -m "balance(sim): 고랭크덱 dmult 캘리브 — 표준 밴드 보정(파워크리프 차단)"
```

---

## Task 3: index.html — 변형 인프라 미러 (DECKS·newGame·blindTarget)

**Files:** Modify `prototype/index.html` (fullDeck L204 뒤 · META_DEFAULT L284 · newGame L406-414 · blindTarget L423-424)

★Task 2 확정 dmult를 high에 사용(run-sim과 일치 — 드리프트 가드).

- [ ] **Step 1: highDeck 빌더 + DECKS 레지스트리**

`fullDeck()` (L204) **바로 뒤**에 삽입(high dmult = Task 2 확정값):

```javascript
function highDeck(){ const d=[]; for(let s=0;s<4;s++) for(const r of [3,4,5,6,7,7,8,8]) d.push(mkCard(s,r)); return d; }
const DECKS=[
  {id:"standard", name:"표준덱",   desc:"A~8 균형 32장",                                   build:fullDeck, dmult:1.0},
  {id:"high",     name:"고랭크덱", desc:"A·2 없음·7·8 2배 — 고점수·정점 빌드, 단 사치세 보스 직격", build:highDeck, dmult:1.25},
];
```

- [ ] **Step 2: META_DEFAULT에 deck 추가**

L284 교체:

```javascript
const META_DEFAULT={coins:0,retry:0,goldLv:0,rerollLv:0,maxStake:0,deck:"standard"};
```

- [ ] **Step 3: newGame variant 인자 + S.variant/S.dmult + 영속**

L406 `function newGame(seed, stake){` → L414까지를 교체:

```javascript
function newGame(seed, stake, variant){
  const daily = seed!=null;
  const useSeed = daily ? seed : Math.floor(Math.random()*2147483647);
  RNG = mulberry32(useSeed);                          // ★ S 생성 전 시드 설정 (shuffle/pickBoss가 시드 사용)
  const meta=getMeta();
  const v = DECKS.find(d=>d.id===(variant!=null?variant:meta.deck)) || DECKS[0];
  if(meta.deck!==v.id){ meta.deck=v.id; saveMeta(meta); }   // 마지막 선택 영속
  S={ante:1, blind:0, anteBoss:pickBoss(1), owned:[], over:false, busy:false, settled:false,
     bonusHand:0, rerollMax:meta.rerollLv, gold:meta.goldLv*START_GOLD_PER_LV, retry:meta.retry, seed:useSeed, daily, runBest:0,
     stake:Math.max(0,Math.min(MAX_STAKE, stake|0)),   // 난이도 사다리(0~5). 모든 티어 델타가 이 전역을 읽음(stake 0=no-op)
     variant:v.id, dmult:v.dmult,                       // 시작덱 변형(id) + 목표 스칼라
     showPreview:document.getElementById("pvToggle").checked, deck:shuffle(v.build()), discard:[]};
```

(이후 `logEvent(...)`/`startBlind()`/`renderStats()`/`}` 불변.)

- [ ] **Step 4: blindTarget에 dmult 팩터**

L423-424 교체:

```javascript
function blindTarget(ante,blind){
  return Math.round(blindBase(ante)*stakeMult(ante)*(S?S.dmult:1) * (blind===0?1 : blind===1?1.4 : 1.6));   // 하향: "긴 체인=운" 의존 줄여 안정적 수읽기로 클리어 가능하게. dmult=시작덱 보정(표준 1=no-op).
}
```

- [ ] **Step 5: 문법 검증**

Run: `node tools/balance-check.cjs 2>&1 | head -1`
Expected: `✅ index.html 인라인 JS 문법 OK` (표준 dmult=1 → 기준선 불변).

- [ ] **Step 6: Commit**

```bash
git add prototype/index.html
git commit -m "feat: 시작덱 변형 인프라 — DECKS/highDeck/newGame variant/blindTarget dmult (run-sim 미러)"
```

---

## Task 4: index.html — 덱 선택기 UI + 배선

**Files:** Modify `prototype/index.html` (선택기 HTML L182 근처 · newGame 호출부 L184 · 선택 JS L891 근처 · 초기화 L913)

- [ ] **Step 1: 덱 선택기 HTML 추가**

L182 stakes 선택기 `<div class="controls" ...>난이도 ...</div>` **바로 뒤**(L183 stakeDesc 뒤)에 삽입:

```html
  <div class="controls" style="align-items:center;gap:6px">시작덱 <button onclick="deckStep(-1)">◀</button> <b id="deckLbl" style="min-width:150px;display:inline-block;text-align:center">표준덱</b> <button onclick="deckStep(1)">▶</button></div>
  <div id="deckDesc" style="text-align:center;font-size:11px;color:#8a93b6;margin-top:1px">A~8 균형 32장</div>
```

- [ ] **Step 2: newGame 호출부에 selDeck 전달**

L184 교체:

```html
  <div class="controls"><button onclick="newGame(null,selStake,selDeck)">새 게임</button> <button onclick="newGame(dailySeed(),selStake,selDeck)">🗓 데일리</button> <button onclick="openBoard()">🏆 리더보드</button> <button onclick="openDrawer('charms')">🧿 부적</button> <button onclick="openDrawer('meta')">🪙 상점</button></div>
```

- [ ] **Step 3: 선택기 JS (selDeck/deckStep/renderDeckLbl)**

`let selStake=0;` (L891) **바로 뒤**에 삽입:

```javascript
let selDeck="standard";
function deckStep(d){ const i=DECKS.findIndex(x=>x.id===selDeck); selDeck=DECKS[(i+d+DECKS.length)%DECKS.length].id; try{beep(selDeck!=="standard"?520:420,.04);}catch(e){} renderDeckLbl(); }
function renderDeckLbl(){ const v=DECKS.find(x=>x.id===selDeck)||DECKS[0]; const el=document.getElementById("deckLbl"); if(el) el.textContent=v.name; const dd=document.getElementById("deckDesc"); if(dd) dd.textContent=v.desc; }
```

- [ ] **Step 4: 초기화 — 마지막 선택 덱 로드 + 라벨 렌더**

L913 `newGame();` (초기 호출) **바로 뒤**에 삽입:

```javascript
selDeck=getMeta().deck||"standard"; renderDeckLbl();
```

- [ ] **Step 5: 문법 + 스모크**

Run: `node tools/balance-check.cjs 2>&1 | head -1`
Expected: `✅ index.html 인라인 JS 문법 OK`

(브라우저 수동 1회: 시작덱 ◀▶로 고랭크덱 선택→새 게임→줄에 A·2 없고 7·8 빈번·정산 정상·새로고침 후 고랭크덱 유지·콘솔에러0.)

- [ ] **Step 6: Commit**

```bash
git add prototype/index.html
git commit -m "feat: 시작덱 선택기 UI (stakes 패턴 복제) + selDeck 배선 + 영속 로드"
```

---

## Task 5: 최종 검증

**Files:** 없음(검증만). 임시 스크립트는 스크래치패드.

- [ ] **Step 1: 고랭크덱 빌더 단위 검증**

```bash
cat > "$TMPDIR/hd.cjs" <<'JS'
function highDeck(){ const d=[]; for(let s=0;s<4;s++) for(const r of [3,4,5,6,7,7,8,8]) d.push({suit:s,rank:r,enh:null}); return d; }
const d=highDeck(); const ranks=d.map(c=>c.rank);
console.log("장수:", d.length, "expect 32");
console.log("A·2 없음:", !ranks.includes(1)&&!ranks.includes(2), "expect true");
console.log("7 개수:", ranks.filter(r=>r===7).length, "expect 8 (무늬당2×4)");
console.log("8 개수:", ranks.filter(r=>r===8).length, "expect 8");
console.log("평균랭크:", (ranks.reduce((a,b)=>a+b,0)/32).toFixed(1), "expect 6.0");
JS
node "$TMPDIR/hd.cjs"
```
Expected: 장수 32 · A·2 없음 true · 7=8 · 8=8 · 평균 6.0.

- [ ] **Step 2: 전체 회귀 스위트**

Run:
```bash
node tools/balance-check.cjs 2>&1 | head -1
node tools/economy-check.cjs 2>&1 | tail -1
node tools/unlock-check.cjs 2>&1 | tail -1
node tools/run-sim.cjs 2>&1 | grep -E "시작덱 변형|standard |high |St0:"
```
Expected: balance-check 문법 OK · economy 통과 · unlock 28/0(불변) · standard 표준 밴드·high 표준±0.7pp(캘리브 완료)·St0 7.6% 불변.

- [ ] **Step 3: 검증 통과 시 다음 Task로** (커밋 없음)

---

## Task 6: 문서 동기화

**Files:** Modify `HANDOVER.md`(§6 v3.28 + 헤더 버전·로드맵) · `CLAUDE.md`(드리프트: 변형 시스템·deckMult·2파일 미러) · `docs/PLAN.md`(로드맵 LONG 진행)

- [ ] **Step 1: HANDOVER §6에 v3.28 항목 추가**

§6 헤더 버전 `(v3.27 …)` → `(v3.28 …)`, 헤더 버전줄 v3.27→v3.28, §6 최상단(투톤 항목 앞)에 추가:

```markdown
- ✅ **시작덱 변형 MVP "고랭크덱" (v3.28, LONG 착수)**: 리플레이 직교축(피어 4-15 시작덱 vs 우리 1종) 메움. **변형 시스템**(`DECKS` 레지스트리 = `build`함수+`dmult`, 런시작 덱 선택기=stakes 패턴 복제, `cd_meta.deck` 영속) + **변형 1종 고랭크덱**(무늬당 {3,4,5,6,7,7,8,8}=32장, 평균랭크 6.0). ★composition만(룰 0) — 빌드축 트레이드오프 내재(고점수·apex↑ / A·2·runts·tax내성↓, 사치세 7·8=0 직격 25%). 코어 연결 보존(4무늬). ★**파워크리프 차단 = `deckMult`**(보스 tmult·stakeMult 동격 목표 스칼라, 플레이어 비가시): 고랭크 기본점수 +33%→그냥두면 쉬움→dmult __로 표준 밴드(~7.6%) 보정. ★`blindTarget`에만 dmult(보너스는 `blindBase` 기준 불변=상쇄버그 차단, v3.22 선례). 해금=시작부터 선택(MVP·게이팅 보류). 드리프트: highDeck·dmult·blindTarget팩터 `index.html`↔`run-sim.cjs` 2파일 미러(balance-check 표준 dmult=1 no-op 가드). ★`S.variant`(id)≠`S.deck`(카드더미) 명명 가드. ★동시 funqa와 분리·main 기반 worktree 추출·FF 머지. 설계 `docs/superpowers/specs/2026-06-30-start-deck-variants-design.md`·계획 `…/plans/2026-06-30-start-deck-variants.md`.
```

(dmult __ = Task 2 확정값. 헤더/로드맵의 "다음=시작덱 변형"을 "✅시작덱 변형 MVP(v3.28) → 다음=변형 확장 3-4종 또는 Steam 포트"로 갱신.)

- [ ] **Step 2: CLAUDE.md 드리프트 지점**

"## ⚠️ 규칙 중복" 섹션에 한 항목 추가: 시작덱 변형 동기화 지점 — `highDeck`·`DECKS` dmult·`blindTarget` deckMult 팩터 = index↔run-sim 미러, balance-check는 표준 dmult=1 no-op 가드.

- [ ] **Step 3: docs/PLAN.md 로드맵**

LONG "시작덱 변형 3-4종"을 "✅MVP 고랭크덱(v3.28) — 변형 시스템+1종, 확장 대기"로 갱신.

- [ ] **Step 4: 최종 Commit**

```bash
git add HANDOVER.md CLAUDE.md docs/PLAN.md
git commit -m "docs: 시작덱 변형 MVP 고랭크덱 (v3.28) — HANDOVER/CLAUDE/PLAN"
```

---

## Self-Review

**Spec coverage:**
- §1 변형 정의(DECKS·고랭크덱·deckMult) → Task 1·3
- §2 구현(index newGame/blindTarget/UI ↔ run-sim 미러/스윕) → Task 1·3·4
- §3 deckMult 캘리브 → Task 2
- §4 검증(balance-check/run-sim/economy/DOM) → Task 5
- §5 범위(IN 전부 task, OUT 미구현 유지) → ✓
- §6 리스크(파워크리프→Task2 / 상쇄버그→Task3 blindTarget만 dmult / 드리프트→Task1·3 값일치 / S.deck혼동→Task3 S.variant / sim한계→Task2 balance기준) → ✓
- 문서 → Task 6

**Placeholder scan:** high dmult은 "Task 2 확정값"(캘리브 산출물 — 시작값 1.25 코드 제시 + 조정규칙). 그 외 모든 step 실제 코드/명령/기대출력.

**Type/이름 일관성:** `DECKS`/`highDeck(Sim)`/`dmult`/`DMULT`/`S.variant`/`S.dmult`/`selDeck`/`deckStep`/`renderDeckLbl` 전 task 통일. runFull variant 인자 ↔ 스윕 `v.id` 일치. newGame(seed,stake,variant) ↔ 호출부 `newGame(...,selStake,selDeck)` 일치. blindTarget dmult 팩터 index(`S.dmult`)·run-sim(`DMULT`) 의미 동일.

이슈 없음.

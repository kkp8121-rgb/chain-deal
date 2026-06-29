# 위치-맥락 보스룰 내리막(seal_climb) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `seal_run` 보스를 `seal_climb`(내리막 — 오름 ±1 연결 봉인)로 교체해 spatial 빌드에 보스 counterplay를 추가한다.

**Architecture:** `connect()`는 대칭(bridge 양방향 호출)이라 방향 룰은 connect서 빼고 placeCard/gain 체인 판정에만 `climbSealed` 적용. BOSSES·connect·룰을 `index.html` ↔ `run-sim.cjs` ↔ `balance-check.cjs` **3파일 1커밋 동시**(드리프트 0). tmult 캘리브로 balance 기준선 불변.

**Tech Stack:** vanilla JS 단일 HTML + node `.cjs` 시뮬. "테스트"=시뮬 실행 + 노드 DOM-스텁 스모크.

**설계 SSoT:** `docs/superpowers/specs/2026-06-29-position-boss-rule-design.md`.

---

## 파일 구조

| 파일 | 변경 |
|---|---|
| `prototype/index.html` | BOSSES(seal_run→seal_climb) · connect(seal_run 제거) · climbSealed 헬퍼 · placeCard 연결판정+runLen |
| `tools/run-sim.cjs` | BOSSES · connect · climbSealedSim · gain 연결판정+rl · BOSS_KO |
| `tools/balance-check.cjs` | BOSSES · connect · climbSealedBC · gain 연결판정+rl |
| `HANDOVER.md` `CLAUDE.md` `docs/PLAN.md` | v3.26 기록 |

---

## Task 1: seal_climb 룰 (3파일 동시)

**Files:** Modify `prototype/index.html` · `tools/run-sim.cjs` · `tools/balance-check.cjs` (드리프트 0 위해 1커밋)

- [ ] **Step 1: index.html — BOSSES seal_run → seal_climb**

`prototype/index.html` L236을 교체:
```javascript
  {id:"seal_climb",icon:"⤵", name:"내리막",           desc:"오르막(↑) ±1 연결 무효 — 내림·같은무늬·같은숫자만", tmult:0.72, act:2, actBoss:false},
```

- [ ] **Step 2: index.html — connect()에서 seal_run 제거**

`prototype/index.html` L220을 교체:
```javascript
  const runOk=Math.abs(a.rank-b.rank)===1;                                       // ±1 (방향 봉인은 placeCard climbSealed에서)
```

- [ ] **Step 3: index.html — climbSealed 헬퍼 추가**

`function cardSealed(c){...}`(L223) 다음 줄에 추가:
```javascript
function climbSealed(right,left){ return S.boss && S.boss.id==="seal_climb" && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1; }   // 내리막: 오름 +1(다른무늬·비와일드) 체인 봉인
```

- [ ] **Step 4: index.html — placeCard 연결판정 + runLen 루프**

L461 연결판정: `connect(card,left)` 다음에 `&& !climbSealed(card,left)` 추가 →
```javascript
  if(left && connect(card,left) && !climbSealed(card,left) && !(S.boss&&S.boss.id==="frost"&&S.row.length<=2)){   // 냉각: 줄 첫 2장 연결 무효
```

L463 runLen 루프의 `if(connect(S.row[i],S.row[i-1])) runLen++;`를 교체 →
```javascript
    runLen=1; for(let i=S.row.length-1;i>0;i--){ if(connect(S.row[i],S.row[i-1]) && !climbSealed(S.row[i],S.row[i-1])) runLen++; else break; }
```

- [ ] **Step 5: run-sim.cjs — BOSSES + connect + climbSealedSim**

`tools/run-sim.cjs` L89의 `{id:"seal_run",tmult:.58,act:2,actBoss:false}`를 `{id:"seal_climb",tmult:.72,act:2,actBoss:false}`로 교체 (해당 객체만).

L33 connect: `const run=Math.abs(a.rank-b.rank)===1&&boss!=="seal_run";` → `const run=Math.abs(a.rank-b.rank)===1;`

`function gain(row, card, boss, owned, deckSize){`(L17) 바로 위에 추가:
```javascript
function climbSealedSim(right,left,boss){ return boss==="seal_climb" && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1; }
```

- [ ] **Step 6: run-sim.cjs — gain 연결판정 + rl 루프 + BOSS_KO**

gain L28 `if(left&&connect(card,left,boss) && !(boss==="frost"&&row.length<=2)){` → `connect(card,left,boss)` 다음에 `&& !climbSealedSim(card,left,boss)` 추가.

gain L30 `for(let i=row.length-1;i>0;i--){ if(connect(row[i],row[i-1],boss)) rl++; else break; }` → `if(connect(row[i],row[i-1],boss) && !climbSealedSim(row[i],row[i-1],boss)) rl++; else break;`

BOSS_KO(L184): `seal_run:"스트봉인"` → `seal_climb:"내리막"`.

- [ ] **Step 7: balance-check.cjs — BOSSES + connect + climbSealedBC**

`tools/balance-check.cjs` L107을 교체:
```javascript
  { id: "seal_climb", name: "⤵ 내리막", tmult: 0.72, hand: 3, act: 2, actBoss: false },
```

L33 connect: `const run = Math.abs(a.rank - b.rank) === 1 && boss !== "seal_run";` → `const run = Math.abs(a.rank - b.rank) === 1;`

`function gain(row, card, boss) {`(L36) 바로 위에 추가:
```javascript
function climbSealedBC(right, left, boss) { return boss === "seal_climb" && right.enh !== "wild" && left.enh !== "wild" && right.suit !== left.suit && right.rank - left.rank === 1; }
```

- [ ] **Step 8: balance-check.cjs — gain 연결판정 + rl 루프**

gain L42 `if (left && connect(card, left, boss) && !(boss === "frost" && row.length <= 2)) {` → `connect(card, left, boss)` 다음에 `&& !climbSealedBC(card, left, boss)` 추가.

gain L43 `for (let i = row.length - 1; i > 0; i--) { if (connect(row[i], row[i - 1], boss)) rl++; else break; }` → `if (connect(row[i], row[i - 1], boss) && !climbSealedBC(row[i], row[i - 1], boss)) rl++; else break;`

- [ ] **Step 9: 문법 + 룰 정확성 스모크**

Run: `node tools/balance-check.cjs`
Expected: 문법 PASS + 출력에 "⤵ 내리막" 보스 게이지 등장(seal_run 없음).

Create `<scratchpad>/climb-smoke.cjs` — charm-smoke.cjs DOM 스텁 헤더 재사용 + 아래:
```javascript
const runner=new Function("g","with(g){ "+code+"\n; g.__newGame=newGame; g.__climbSealed=climbSealed; g.__connect=connect; g.__BOSSES=BOSSES; g.__S=()=>S; }");
runner(g); g.__newGame(); const S=g.__S();
const card=(suit,rank,enh=null)=>({suit,rank,enh});
S.boss=g.__BOSSES.find(b=>b.id==="seal_climb");
ok("seal_climb 보스 존재(seal_run 대체)", !!S.boss && !g.__BOSSES.some(b=>b.id==="seal_run"));
ok("오름+1 다른무늬 봉인", g.__climbSealed(card(0,3),card(1,2))===true);     // 우3 좌2 오름, 다른무늬
ok("내림 -1 미봉인", g.__climbSealed(card(0,2),card(1,3))===false);          // 우2 좌3 내림
ok("오름+1 같은무늬 미봉인", g.__climbSealed(card(0,3),card(0,2))===false);  // 무늬 같음→연결 유지
ok("와일드 미봉인", g.__climbSealed(card(0,3,"wild"),card(1,2))===false);
ok("connect는 ±1 항상 허용(방향 룰 분리)", g.__connect(card(0,3),card(1,2))===true);  // connect 대칭 보존
```
Run: `node <scratchpad>/climb-smoke.cjs`
Expected: 모든 ok ✓.

- [ ] **Step 10: 드리프트 가드 + Commit**

3파일 seal_climb tmult 일치 확인:
Run: `grep -h "seal_climb" prototype/index.html tools/run-sim.cjs tools/balance-check.cjs | grep -oE "0\.[0-9]+"` → 전부 `0.72`.

```bash
git add prototype/index.html tools/run-sim.cjs tools/balance-check.cjs
git commit -m "feat: 위치-맥락 보스룰 내리막(seal_climb) — seal_run 교체, 3파일 동시"
```

---

## Task 2: tmult 캘리브

**Files:** (조정 시) `prototype/index.html` · `tools/run-sim.cjs` · `tools/balance-check.cjs` 3파일 동시

- [ ] **Step 1: 보스 게이지 + 전체 밸런스 측정**

Run: `node tools/balance-check.cjs`
Expected: "⤵ 내리막" 클리어율이 다른 Act2 보스 밴드(seal_run 자리 ~비슷) 확인.

Run: `node tools/run-sim.cjs`
Expected: balance 전체 클리어율 **기준선 ~9.x%(±0.5pp) 불변**(seal_climb 교체로 안 흔들림) + 하단 조건부 통과율의 "내리막" 보스가 건강 밴드(다른 보스대 내). 스테이크 스윕 단조 유지.

- [ ] **Step 2: 판정 + (필요 시) tmult 조정**

- balance 기준선 ~9.x% 유지 + 내리막 조건부 통과율 건강 → tmult=0.72 확정, Step 3 생략.
- 기준선 상승(>+0.5pp) 또는 내리막이 너무 쉬움 → tmult **0.72→0.65** 하향(목표↑=더 어렵게).
- 기준선 하락 또는 내리막 너무 어려움 → tmult **0.72→0.78** 상향.

조정 시 `prototype/index.html`·`tools/run-sim.cjs`·`tools/balance-check.cjs`의 seal_climb tmult 3곳 동일 변경.

- [ ] **Step 3: 재측정 + 회귀**

Run: `node tools/run-sim.cjs` → 기준선·조건부 재확인.
Run: `node tools/balance-check.cjs` → 문법·게이지.
Run: `node tools/economy-check.cjs` → PASS(무관 회귀).
Run: `node tools/unlock-check.cjs` → 26/0(무관 회귀).

- [ ] **Step 4: (조정 시) Commit**

```bash
git add -A
git commit -m "fix: 내리막 seal_climb tmult 캘리브 (run-sim 기준선 가드)"
```

(조정 없으면 생략.)

---

## Task 3: 문서 + 배포

**Files:** Modify `HANDOVER.md` · `CLAUDE.md` · `docs/PLAN.md`

- [ ] **Step 1: HANDOVER.md**

§0 다음 할 일 + §5 보스 표(seal_run→내리막) + §6 최상단 v3.26 항목(내리막 seal_run 교체, climbSealed connect-대칭 보존, 3파일 동기화, 확정 tmult). §7 ▶다음 갱신(보스룰 완료 → 색 settle 페이오프 또는 시작덱 변형). 버전 v3.25→v3.26.

- [ ] **Step 2: CLAUDE.md**

§5 보스 표·보스 동기화 섹션: seal_run→seal_climb, ★connect 대칭성 보존(방향 룰 placeCard/gain만), 3파일 동기화 지점.

- [ ] **Step 3: docs/PLAN.md**

MID/후속 섹션 "위치-맥락 보스룰 ✅ (v3.26)" + "▶다음" 갱신. 헤더 버전.

- [ ] **Step 4: Commit + 배포**

```bash
git add HANDOVER.md CLAUDE.md docs/PLAN.md
git commit -m "docs: 위치-맥락 보스룰 내리막 (v3.26) — HANDOVER/CLAUDE/PLAN"
git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$(gh auth token)"; }; f' push origin main
```

(push hang 시 HANDOVER §2.)

---

## 검증 요약 (DoD)

- [ ] `node tools/run-sim.cjs`: balance 기준선 ~9.x%(±0.5pp) 불변 · 내리막 조건부 통과율 건강 밴드 · 스테이크 단조
- [ ] `node tools/balance-check.cjs`: 문법 PASS · "⤵ 내리막" 게이지(seal_run 소멸)
- [ ] 노드 DOM 스모크: 오름+1 다른무늬 봉인 · 내림/같은무늬/와일드 미봉인 · connect 대칭 보존
- [ ] `economy-check`·`unlock-check` 회귀 PASS
- [ ] 3파일 seal_climb tmult 일치(드리프트 0)
- [ ] 문서 3종 갱신 + push
```

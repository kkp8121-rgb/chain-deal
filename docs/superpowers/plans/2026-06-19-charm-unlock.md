# 부적 해금 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** B1 신규 아키타입 부적 5종(흑심·중개상·쌍둥이·정련가·잔챙이)을 업적 기반으로 해금되는 메타 콘텐츠로 전환하고, 컬렉션 드로어·해금 알림을 추가한다.

**Architecture:** 해금 상태는 `localStorage["cd_unlocked"]` 에 부적 id 배열로 영속. 순수 조건 함수 `UNLOCKS[id].cond(stats,row)` 를 `settle()` 정산 직후 1회 평가 → 새 상태 변수 0개. 상점은 잠긴 부적을 풀에서 제외하고, 컬렉션 드로어가 기존 `openDrawer` 패턴으로 잠금/해금을 표시. 라운드 점수 규칙 불변(메타층).

**Tech Stack:** 단일 파일 vanilla JS(`prototype/index.html`), node 검증 스크립트(`tools/*.cjs`). 빌드·프레임워크 없음.

**Spec:** `docs/superpowers/specs/2026-06-19-charm-unlock-design.md`

---

## 파일 구조

- **Modify** `prototype/index.html`
  - 신규 블록: 부적 해금 코어(상수 `STARTER_CHARMS`/`UNLOCKS` + 함수 `maxRankCount`/`pairGroups`/`getUnlocked`/`saveUnlocked`/`isUnlocked`/`checkUnlocks`/`charmsHTML`) — `const has=…`(L273) 직후 삽입.
  - 수정: `shopPool()` 부적 필터(L408), `settle()` 알림(L390 직후), `openDrawer()` 분기(L602), 컨트롤 버튼(L161), tally HTML(L634 부근), 시작 시 grandfather 호출(L620 `newGame();` 직전).
- **Create** `tools/unlock-check.cjs` — 해금 조건 로직 node 검증(repo의 기존 `*.cjs` 복제 패턴 따름).
- **Modify** `HANDOVER.md`, `docs/PLAN.md` — 구현 상태 기록(repo 문화).

> ⚠️ repo 관례: `tools/*.cjs` 는 index.html 로직을 **수동 복제**한다. `unlock-check.cjs` 도 동일 — UNLOCKS 조건을 바꾸면 양쪽을 함께 맞출 것(파일 상단 경고 주석 포함).

---

## Task 1: 해금 조건 로직 + node 검증 (TDD)

**Files:**
- Create: `tools/unlock-check.cjs`
- Modify: `prototype/index.html` (insert after `const has=id=>S.owned.includes(id);` — L273)

- [ ] **Step 1: 실패하는 테스트 작성** — `tools/unlock-check.cjs`

```js
// CHAIN DEAL 부적 해금 조건 검증  ·  실행: node tools/unlock-check.cjs
// ⚠️ index.html 의 STARTER_CHARMS / UNLOCKS / checkUnlocks 로직을 "복제"한 것.
//    index.html 에서 조건을 바꾸면 이 파일도 같이 맞출 것.

// ----- index.html 복제 (해금 코어) -----
let STORE = {};                                  // 가짜 localStorage
const STARTER_CHARMS = ["greed","pyro","suited","runner","jackpot"];
function maxRankCount(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let m=0; for(const k in rc) if(rc[k]>m) m=rc[k]; return m; }
function pairGroups(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let g=0; for(const k in rc) if(rc[k]>=2) g++; return g; }
const UNLOCKS = {
  noir:     {cond:(st,row)=> (st.bestAnte||0)>=4,              hint:"안테 4 도달"},
  compactor:{cond:(st,row)=> (st.wins||0)>=1,                  hint:"런 1회 클리어"},
  broker:   {cond:(st,row)=> maxRankCount(row)>=3,             hint:"한 줄에 같은 숫자 3장"},
  twins:    {cond:(st,row)=> pairGroups(row)>=2,               hint:"한 줄에 같은 숫자 2장 그룹 2개"},
  runts:    {cond:(st,row)=> row.filter(c=>c.rank<=3).length>=4, hint:"한 줄에 A·2·3 4장"},
};
function getUnlocked(){ try{ const a=JSON.parse(STORE["cd_unlocked"]); if(Array.isArray(a)) return a; }catch(e){} return STARTER_CHARMS.slice(); }
function saveUnlocked(a){ STORE["cd_unlocked"]=JSON.stringify(a); }
function isUnlocked(id){ return STARTER_CHARMS.includes(id) || getUnlocked().includes(id); }
function checkUnlocks(st,row){ const cur=getUnlocked(), fresh=[]; for(const id in UNLOCKS){ if(!cur.includes(id) && UNLOCKS[id].cond(st,row||[])){ cur.push(id); fresh.push(id); } } if(fresh.length) saveUnlocked(cur); return fresh; }

// ----- 테스트 -----
let pass=0, fail=0;
function eq(name, got, want){ const ok=JSON.stringify(got)===JSON.stringify(want); if(ok){pass++;} else {fail++; console.log(`  ❌ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);} }
const card=(suit,rank,enh=null)=>({suit,rank,enh});
const reset=()=>{ STORE={}; };

// 시작 부적은 항상 해금
reset(); eq("starter greed 해금", isUnlocked("greed"), true);
reset(); eq("noir 기본 잠김", isUnlocked("noir"), false);

// 등급: noir(안테4), compactor(승1)
reset(); eq("noir@안테3 잠김", checkUnlocks({bestAnte:3,wins:0},[]), []);
reset(); eq("noir@안테4 해금", checkUnlocks({bestAnte:4,wins:0},[]), ["noir"]);
reset(); eq("compactor@승1 해금", checkUnlocks({wins:1},[]), ["compactor"]);

// 도전과제: broker(같은숫자3), twins(2그룹), runts(저랭크4)
const trips=[card(0,5),card(1,5),card(2,5),card(3,2),card(0,8)];
reset(); eq("broker 트리플 해금", checkUnlocks({},trips).includes("broker"), true);
const twoPair=[card(0,5),card(1,5),card(2,7),card(3,7),card(0,2)];
reset(); eq("twins 투페어 해금", checkUnlocks({},twoPair), ["twins"]);
reset(); eq("broker 투페어선 안열림", checkUnlocks({},twoPair).includes("broker"), false);
const lows=[card(0,1),card(1,2),card(2,3),card(3,1),card(0,8)];
reset(); eq("runts 저랭크4 해금", checkUnlocks({},lows), ["runts"]);
const highs=[card(0,5),card(1,6),card(2,7),card(3,8),card(0,4)];
reset(); eq("runts 고랭크 안열림", checkUnlocks({},highs).includes("runts"), false);

// 소급(grandfather): 빈 store + 기존 stats → 등급만 자동 해금, 줄 조건은 그대로 잠김
reset(); const g=checkUnlocks({bestAnte:5,wins:1},[]);
eq("grandfather noir+compactor", g.sort(), ["compactor","noir"]);
eq("grandfather broker 잠김", isUnlocked("broker"), false);

// 중복 해금 안 함
reset(); checkUnlocks({wins:1},[]); eq("재호출 시 빈 배열", checkUnlocks({wins:1},[]), []);

console.log(`\n${fail===0?"✅":"❌"} 부적 해금: ${pass} pass / ${fail} fail`);
process.exit(fail===0?0:1);
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node tools/unlock-check.cjs`
Expected: FAIL — 아직 index.html 에 코어가 없음(이 단계에선 cjs 자체는 통과하나, Step 3에서 index.html 동기화를 검증). *주: cjs는 자기복제라 단독 통과하므로, 실제 RED는 "index.html에 코어 부재"다 → Step 3 후 index.html 수동 동기화 + browser 확인이 GREEN 게이트.*

- [ ] **Step 3: index.html 에 해금 코어 삽입** — `const has=id=>S.owned.includes(id);` (L273) 바로 다음 줄에 추가

```js

/* ---------- 부적 해금 (메타: localStorage cd_unlocked) ---------- */
// 시작 5종(코어)은 항상 해금. B1 신규 5종은 업적/도전과제로 해금. 라운드 점수 규칙엔 영향 0(메타층).
const STARTER_CHARMS=["greed","pyro","suited","runner","jackpot"];
function maxRankCount(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let m=0; for(const k in rc) if(rc[k]>m) m=rc[k]; return m; }
function pairGroups(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let g=0; for(const k in rc) if(rc[k]>=2) g++; return g; }
// 각 잠금 부적의 해금 조건 cond(stats,row)→bool + 컬렉션 힌트. 전부 settle 시점 판정(런중 추적 0).
const UNLOCKS={
  noir:     {cond:(st,row)=> (st.bestAnte||0)>=4,                hint:"안테 4 도달"},
  compactor:{cond:(st,row)=> (st.wins||0)>=1,                    hint:"런 1회 클리어"},
  broker:   {cond:(st,row)=> maxRankCount(row)>=3,               hint:"한 줄에 같은 숫자 3장"},
  twins:    {cond:(st,row)=> pairGroups(row)>=2,                 hint:"한 줄에 같은 숫자 2장 그룹 2개"},
  runts:    {cond:(st,row)=> row.filter(c=>c.rank<=3).length>=4, hint:"한 줄에 A·2·3 저랭크 4장"},
};
function getUnlocked(){ try{ const a=JSON.parse(localStorage.getItem("cd_unlocked")); if(Array.isArray(a)) return a; }catch(e){} return STARTER_CHARMS.slice(); }
function saveUnlocked(a){ try{ localStorage.setItem("cd_unlocked",JSON.stringify(a)); }catch(e){} }
function isUnlocked(id){ return STARTER_CHARMS.includes(id) || getUnlocked().includes(id); }
// settle 직후 호출: stats/row로 새로 충족된 잠금 부적을 cd_unlocked에 추가, 새로 해금된 id 배열 반환
function checkUnlocks(st,row){ const cur=getUnlocked(), fresh=[]; for(const id in UNLOCKS){ if(!cur.includes(id) && UNLOCKS[id].cond(st,row||[])){ cur.push(id); fresh.push(id); } } if(fresh.length) saveUnlocked(cur); return fresh; }
function charmsHTML(){
  let h=`<h3>🧿 부적 컬렉션</h3><p class="drawerSub">플레이로 해금되는 부적 — 잠긴 건 조건을 채우면 열립니다.</p>`;
  for(const c of CHARMS){
    if(isUnlocked(c.id)) h+=`<div class="hrow"><span><b class="hname">${c.name}</b><br><span class="hdesc">${c.desc}</span></span><span class="hbig">✓ 해금</span></div>`;
    else h+=`<div class="hrow" style="opacity:.55"><span><b class="hname">🔒 ？？？</b><br><span class="hdesc">해금 조건: ${UNLOCKS[c.id].hint}</span></span><span class="hsmall">잠김</span></div>`;
  }
  const n=CHARMS.filter(c=>isUnlocked(c.id)).length;
  h+=`<p class="drawerNote">🧿 해금 ${n} / ${CHARMS.length}</p>`;
  return h;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node tools/unlock-check.cjs`
Expected: `✅ 부적 해금: 13 pass / 0 fail`

- [ ] **Step 5: 커밋** (※ 본 repo는 main 직접 커밋 금지 — 브랜치/PR 정책 따를 것. 사용자 "깃 넘어가고" 지시 시 커밋 생략)

```bash
git add tools/unlock-check.cjs prototype/index.html
git commit -m "feat: 부적 해금 코어 + 조건 검증 (C3)"
```

---

## Task 2: 시작 grandfather + 상점 게이팅

**Files:**
- Modify: `prototype/index.html` (L408 shopPool 필터, L620 newGame 직전)

- [ ] **Step 1: 상점 풀에서 잠긴 부적 제외** — L408 교체

기존:
```js
  CHARMS.filter(c=>!has(c.id)).forEach(c=>pool.push({type:"charm",charm:c,name:c.name,desc:c.desc}));
```
변경:
```js
  CHARMS.filter(c=>!has(c.id) && isUnlocked(c.id)).forEach(c=>pool.push({type:"charm",charm:c,name:c.name,desc:c.desc}));
```

- [ ] **Step 2: 시작 시 등급 부적 소급 해금** — L620 `newGame();` 바로 앞에 추가

```js
checkUnlocks(getStats(), []);   // 기존 플레이어 소급: bestAnte/wins 기반 등급 부적(흑심·정련가) 자동 해금
```

- [ ] **Step 3: 브라우저 스모크 — 신규 플레이어 게이팅**

`prototype/index.html` 을 새 프로필(또는 콘솔 `localStorage.clear()` 후 새로고침)로 연다. 상점을 여러 번 띄워 **흑심·중개상·쌍둥이·정련가·잔챙이가 부적으로 등장하지 않음** 확인(시작 5종만 등장). 콘솔 `localStorage.getItem("cd_unlocked")` = `["greed","pyro","suited","runner","jackpot"]`.

- [ ] **Step 4: 브라우저 스모크 — 소급**

콘솔에서 `localStorage.setItem("cd_stats", JSON.stringify({bestAnte:5,wins:1,plays:3}))` 후 새로고침. `localStorage.getItem("cd_unlocked")` 에 `noir`·`compactor` 포함 확인.

- [ ] **Step 5: 커밋** (Task 1 Step 5 주의 동일)

```bash
git add prototype/index.html
git commit -m "feat: 상점 부적 게이팅 + 시작 소급 해금 (C3)"
```

---

## Task 3: settle() 해금 판정 + 정산 표 알림

**Files:**
- Modify: `prototype/index.html` (tally HTML L634 부근, settle L390 직후)

- [ ] **Step 1: 정산 표에 해금 알림 줄 추가** — tally 의 `tHandRow`(L634) 다음 줄에 추가

기존(L634):
```html
    <div class="tallyRow hand" id="tHandRow"><span id="tHand">🎴</span><b id="tBonus">+0</b></div>
```
다음 줄에 삽입:
```html
    <div class="tallyRow hand" id="tUnlockRow" style="display:none"><span id="tUnlock"></span></div>
```

- [ ] **Step 2: settle 에서 해금 판정 + 알림** — `saveStats(stx);`(L390) 바로 다음에 추가

```js
  const freshUnlocks=checkUnlocks(stx, S.row);   // 갱신된 stats + 이번 줄로 판정 (S.row는 아직 8장 보유)
  const ur=document.getElementById("tUnlockRow");
  if(freshUnlocks.length){ ur.style.display="flex";
    document.getElementById("tUnlock").innerHTML=`🔓 새 부적 해금: <b>${freshUnlocks.map(id=>CHARMS.find(c=>c.id===id).name).join(", ")}</b>`;
    setTimeout(()=>{ beep(720,.07); setTimeout(()=>beep(960,.09),90); },220);
  } else ur.style.display="none";
```

> 주: `S.row` 는 settle 안에서 `S.discard.push(...S.row)` 후에도 재할당되지 않아 8장 참조 유지 → 줄 조건(broker/twins/runts) 판정 가능. 다음 `startBlind()` 에서 `S.row=[]`.

- [ ] **Step 3: 브라우저 검증 — 도전과제 해금**

새 프로필로 게임 시작. 같은 숫자 3장을 한 줄에 만들어 정산 → 정산 표에 `🔓 새 부적 해금: 중개상` + 상승음 확인. 이후 상점에 중개상 등장 확인.

- [ ] **Step 4: 회귀 — 해금 없을 때**

해금 조건 미충족 라운드 정산 시 `#tUnlockRow` 숨김(표시 안 됨) 확인.

- [ ] **Step 5: 커밋**

```bash
git add prototype/index.html
git commit -m "feat: 정산 시 부적 해금 판정 + 알림 (C3)"
```

---

## Task 4: 컬렉션 드로어 + 진입 버튼

**Files:**
- Modify: `prototype/index.html` (openDrawer L602, 컨트롤 L161)

- [ ] **Step 1: openDrawer 에 charms 분기 추가** — L602 교체

기존:
```js
function openDrawer(type){ document.getElementById("drawerBody").innerHTML=type==="rules"?RULES_HTML:type==="stats"?statsHTML():type==="deck"?deckHTML():HANDS_HTML; document.getElementById("drawerBd").classList.add("show"); document.getElementById("drawer").classList.add("show"); try{beep(560,.05);}catch(e){} }
```
변경:
```js
function openDrawer(type){ document.getElementById("drawerBody").innerHTML=type==="rules"?RULES_HTML:type==="stats"?statsHTML():type==="deck"?deckHTML():type==="charms"?charmsHTML():HANDS_HTML; document.getElementById("drawerBd").classList.add("show"); document.getElementById("drawer").classList.add("show"); try{beep(560,.05);}catch(e){} }
```

- [ ] **Step 2: 진입 버튼 추가** — 컨트롤 행(L161)의 리더보드 버튼 뒤에 추가

기존:
```html
  <div class="controls"><button onclick="newGame()">새 게임</button> <button onclick="newGame(dailySeed())">🗓 데일리</button> <button onclick="openBoard()">🏆 리더보드</button></div>
```
변경:
```html
  <div class="controls"><button onclick="newGame()">새 게임</button> <button onclick="newGame(dailySeed())">🗓 데일리</button> <button onclick="openBoard()">🏆 리더보드</button> <button onclick="openDrawer('charms')">🧿 부적</button></div>
```

- [ ] **Step 3: 브라우저 검증 — 컬렉션 표시**

🧿 부적 버튼 클릭 → 드로어에 10종 표시. 신규 프로필: 시작 5종 "✓ 해금" / 잠금 5종 "🔒 ？？？ + 해금 조건 힌트 + 잠김". 하단 "🧿 해금 5 / 10". 백드롭 터치=닫힘.

- [ ] **Step 4: 커밋**

```bash
git add prototype/index.html
git commit -m "feat: 부적 컬렉션 드로어 + 진입 버튼 (C3)"
```

---

## Task 5: 통합 검증 (밸런스 불변 + 전체 흐름)

**Files:** (검증만 — 코드 변경 없음)

- [ ] **Step 1: 문법 + 밸런스 회귀**

Run: `node tools/balance-check.cjs`
Expected: `✅ index.html 인라인 JS 문법 OK` + 그리디 클리어율이 변경 전과 동일(작은~90% / 큰~81% / 보스~70-72%). 해금은 메타층이라 **수치 불변이어야 함** — 달라지면 라운드 로직을 잘못 건드린 것.

- [ ] **Step 2: 해금 조건 회귀**

Run: `node tools/unlock-check.cjs`
Expected: `✅ 부적 해금: 13 pass / 0 fail`

- [ ] **Step 3: E2E 스모크 (브라우저)**

신규 프로필 1런: (1) 상점에 잠긴 부적 안 뜸 → (2) 트리플 만들어 중개상 해금 알림 → (3) 이후 상점에 중개상 등장 → (4) 🧿 컬렉션에 중개상 ✓ 표시 → (5) `node tools/balance-check.cjs` 재확인. 5개 모두 PASS.

---

## Task 6: 문서 갱신 (repo 문화)

**Files:**
- Modify: `HANDOVER.md` (§6 구현 상태, §9 파일맵, 버전 v3.15), `docs/PLAN.md` (C3 항목)

- [ ] **Step 1: HANDOVER 갱신** — §6 구현 상태 목록에 추가, 헤더 버전 v3.15, `tools/unlock-check.cjs` 를 파일맵/검증에 명시. §4 "규칙 중복" 목록에 unlock-check 추가.

```markdown
- ✅ **부적 해금 (C3, v3.15)**: B1 신규 5종(흑심·중개상·쌍둥이·정련가·잔챙이)을 업적 해금화. 등급(흑심=안테4·정련가=첫클리어) + 도전과제(중개상=트리플·쌍둥이=투페어·잔챙이=저랭크4장). `cd_unlocked` localStorage, 시작 시 cd_stats 소급. 상점 게이팅 + 🧿 컬렉션 드로어(실루엣+힌트) + 정산 표 해금 알림. 메타층이라 밸런스 불변. 조건 검증 `node tools/unlock-check.cjs`.
```

- [ ] **Step 2: PLAN.md 갱신** — C3 항목을 `[ ]`→`[x]`(부적 해금 단계), 진행 순서 메모

```markdown
- [x] **C3 (부적 해금)** ✅ (v3.15) — B1 신규 5종 업적 해금 + 컬렉션 드로어 + 정산 알림. 보스/카드효과/시작덱 해금은 차기.
```

- [ ] **Step 3: 커밋**

```bash
git add HANDOVER.md docs/PLAN.md
git commit -m "docs: 부적 해금(C3) 구현 반영 (v3.15)"
```

---

## 검증 기준 (Definition of Done)

1. `node tools/balance-check.cjs` 문법 OK + 그리디 클리어율 불변.
2. `node tools/unlock-check.cjs` 13 pass / 0 fail.
3. 신규 프로필: 시작 5종만 상점 / 컬렉션에 잠금 5종 실루엣+힌트.
4. 각 해금 조건 충족 → cd_unlocked 추가 → 이후 상점 등장 + 정산 알림.
5. 기존 플레이어(bestAnte≥4, wins≥1): 로드 시 흑심·정련가 자동 소급.

# 부적 시너지 확장 10종 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CHAIN DEAL에 시너지 부적 10종(4클러스터)을 추가해 13→23종으로 확장한다.

**Architecture:** 전부 가산·바운드(곱셈 0), connect 시그니처 무변경. 각 클러스터를 `index.html`(게임) ↔ `run-sim.cjs`(밸런스 시뮬) ↔ `unlock-check.cjs`(해금 검증) **3파일 동시 커밋**으로 구현해 드리프트를 원천 차단한다. 검증은 `run-sim.cjs` 단독 권위(balance St0 9.4% 불변 + 전용빌드 비지배).

**Tech Stack:** vanilla JS 단일 HTML + node `.cjs` 시뮬(프레임워크 없음). "테스트" = 시뮬 실행(`node tools/*.cjs`) + Playwright 스모크.

**설계 SSoT:** `docs/superpowers/specs/2026-06-29-charm-synergy-expansion-design.md` (전 부적 공식·삽입 L번호·balance note).

---

## 파일 구조

| 파일 | 책임 | 변경 |
|---|---|---|
| `prototype/index.html` | 게임 본체 | CHARMS 10정의(+cost) · placeCard 3훅 · settle 7훅 · UNLOCKS 10 · shopPool cost분기 · bridge desc정정 |
| `tools/run-sim.cjs` | 밸런스 시뮬(권위) | gain 3훅 · handBonus 7훅 · CHARMS 10 · CHARM_COST · STRATS 4프로필 |
| `tools/unlock-check.cjs` | 해금 조건 검증 | UNLOCKS 10 미러 + evalHand/connect/hasRun5 복사 + 신규 assertion |
| `HANDOVER.md` `CLAUDE.md` `docs/PLAN.md` | 문서 SSoT | 부적 13→23, 드리프트 표기, 항목 체크 |

**클러스터별 커밋 단위**(드리프트 가드): Gem → Apex → Cartel → Parity 순. 각 커밋은 index+run-sim+unlock-check를 함께 수정해 3파일이 항상 일치.

---

## Task 1: cost 필드 인프라

**Files:**
- Modify: `prototype/index.html:552` (shopPool charm cost)
- Modify: `tools/run-sim.cjs:110` (costOf) + 새 CHARM_COST 맵 + L168~169 (전략 루프 STRATS 기반화)

- [ ] **Step 1: index.html shopPool charm cost를 per-charm으로**

`prototype/index.html` L552를 다음으로 교체:

```javascript
  CHARMS.filter(c=>!has(c.id) && isUnlocked(c.id)).forEach(c=>pool.push({type:"charm",charm:c,name:c.name,desc:c.desc,cost:(c.cost||8)}));
```

(기존 `cost:8` → `cost:(c.cost||8)`. cost 필드 없는 기존 13종은 8 유지 = 무변경.)

- [ ] **Step 2: run-sim.cjs에 CHARM_COST 맵 + costOf 분기**

`tools/run-sim.cjs` L110 위(L107 `// ---------- 골드 경제` 아래, L108 앞)에 추가:

```javascript
const CHARM_COST={lapidary:5,prism:5,highmult:5,echo:3};   // 콤보 인에이블러 저가(나머지 8). index.html CHARMS cost 필드와 동기화.
```

그리고 L110 `costOf`의 charm 분기를 교체:

```javascript
function costOf(o){ if(o.type==="charm") return CHARM_COST[o.id]||8; if(o.type==="enh") return o.enh==="wild"?8:5; if(o.type==="hand") return 8; if(o.type==="thin"||o.type==="add") return 3; return 5; }
```

- [ ] **Step 3: run-sim 전략 루프를 STRATS 기반으로 (신규 빌드 자동 순회)**

★현재 `tools/run-sim.cjs` L169는 하드코딩 배열을 순회 → STRATS에 프로필 추가만으론 안 돌아감. L168~169를 교체:

```javascript
const STRAT_KO={balance:"밸런스 빌드",flush:"플러시 빌드",black:"흑심(검정/2색) 빌드",jokbo:"족보(중개상+쌍둥이) 빌드",compact:"압축(정련가+잔챙이) 빌드",spatial:"위치-맥락(다리+계단+주춧돌) 빌드",gem:"보석세공(enh 스태킹) 빌드",apex:"정점(고랭크 7·8) 빌드",cartel:"같은수 카르텔 빌드",parity:"홀짝 패리티 빌드"};
for(const strat of Object.keys(STRATS)){
```

(라벨 4종 미리 추가 — 해당 STRATS 프로필은 이후 클러스터 Task에서 생성되며, 그 전엔 Object.keys에 없어 무영향. 이후 각 클러스터가 STRATS에 추가되면 자동 순회·출력.)

- [ ] **Step 4: 문법·경제 불변 검증**

Run: `node tools/balance-check.cjs`
Expected: 문법 PASS, 클리어율 기존과 동일(신규 부적 0개라 무영향).

Run: `node tools/economy-check.cjs`
Expected: 모든 불변식 PASS(골드 공식 무관).

- [ ] **Step 5: Commit**

```bash
git add prototype/index.html tools/run-sim.cjs
git commit -m "feat: 부적 cost 차등 인프라 + run-sim 전략 루프 STRATS 기반화"
```

---

## Task 2: Gem 클러스터 (lapidary · prism · jewelbox) — enh 스태킹

**Files:**
- Modify: `prototype/index.html` (CHARMS 322 근처 · placeCard 433 · settle 482 · UNLOCKS 343)
- Modify: `tools/run-sim.cjs` (gain 23 · handBonus 74 · CHARMS 100 · STRATS 120)
- Modify: `tools/unlock-check.cjs` (UNLOCKS 16)

- [ ] **Step 1: index.html — CHARMS 정의 3종 추가**

`prototype/index.html` L321(keystone 줄) 다음, L322(`];`) 앞에 추가:

```javascript
  {id:"lapidary", name:"세공사", desc:"강화 카드(★●◆)를 깔면 기본 점수 +3 (부식 보스 중엔 무효)", cost:5},
  {id:"prism",    name:"프리즘", desc:"줄에 와일드·황금·배율석이 모두 있으면 정산 보너스 +12% (부식 보스 중엔 무효)", cost:5},
  {id:"jewelbox", name:"보석함", desc:"정산 시 줄에 깔린 강화 카드(★●◆) 1장마다 보너스 +2.5% (최대 6장)"},
```

- [ ] **Step 2: index.html — placeCard에 lapidary base 훅**

`prototype/index.html` L433(`if(card.enh==="gold" && !rust) base+=5;`) 다음 줄에 추가:

```javascript
  if(has("lapidary") && card.enh && !rust) base+=3;   // 강화카드 한정 +3 (greed/runts 선례, ×엔진 미경유)
```

- [ ] **Step 3: index.html — settle에 prism·jewelbox 훅**

`prototype/index.html` L482(keystone 줄) 다음, L483(`S.score+=hb;`) 앞에 추가:

```javascript
  if(has("prism")){ let w=0,g=0,m=0; for(const c of S.row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } if(w&&g&&m && !(S.boss&&S.boss.id==="rust")) hb+=Math.round(blindBase(S.ante)*.12); }   // 프리즘: enh 3종 동시(부식 무효)
  if(has("jewelbox")){ let e=0; for(const c of S.row) if(c.enh) e++; hb+=Math.round(blindBase(S.ante)*.025*Math.min(e,6)); }   // 보석함: enh 1장당 +2.5%, 최대6
```

- [ ] **Step 4: index.html — UNLOCKS 3종 추가**

`prototype/index.html` L343(keystone UNLOCKS 줄) 다음, L344(`};`) 앞에 추가:

```javascript
  lapidary: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:"한 줄에 강화 카드 3장"},
  jewelbox: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:"한 줄에 강화 카드 3장"},
  prism:    {cond:(st,row)=>{ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } return !!(w&&g&&m); }, hint:"한 줄에 와일드·황금·배율석 동시"},
```

- [ ] **Step 5: run-sim.cjs — gain(lapidary) + handBonus(prism·jewelbox) + CHARMS + gem STRAT**

`tools/run-sim.cjs` L23(`if(card.enh==="gold" && !rust) base+=5;`) 다음에 추가:

```javascript
  if(owned.includes("lapidary")&&card.enh&&!rust) base+=3;
```

L74(keystone handBonus 줄) 다음, L75(`return hb;`) 앞에 추가:

```javascript
  if(owned&&owned.includes("prism")){ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } if(w&&g&&m&&boss!=="rust") hb+=Math.round(blindBase(ante)*.12); }
  if(owned&&owned.includes("jewelbox")){ let e=0; for(const c of row) if(c.enh) e++; hb+=Math.round(blindBase(ante)*.025*Math.min(e,6)); }
```

L100 `CHARMS` 배열 끝에 3종 추가(`...,"keystone","lapidary","prism","jewelbox"]`):

```javascript
const CHARMS=["greed","pyro","suited","runner","jackpot","noir","broker","twins","compactor","runts","bridge","stair","keystone","lapidary","prism","jewelbox"];
```

L119(spatial STRAT 줄) 다음, L120(`};`) 앞에 gem 프로필 추가:

```javascript
  gem:    { charm:{jewelbox:10,lapidary:8,prism:7,greed:5,suited:4}, enh:{wild:8,gold:7,mult:7}, item:{thin:5,hand:5,add:2,copy:2,reroll:1} },   // enh 스태킹(강화카드 떡칠)
```

- [ ] **Step 6: unlock-check.cjs — UNLOCKS 3종 미러 + assertion**

`tools/unlock-check.cjs` L15(runts UNLOCKS 줄) 다음, L16(`};`) 앞에 추가:

```javascript
  lapidary: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:"한 줄에 강화 카드 3장"},
  jewelbox: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:"한 줄에 강화 카드 3장"},
  prism:    {cond:(st,row)=>{ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } return !!(w&&g&&m); }, hint:"한 줄에 와일드·황금·배율석 동시"},
```

L54(`// 중복 해금` 주석) 앞에 assertion 추가:

```javascript
// Gem 클러스터
const enh3=[card(0,5,"wild"),card(1,6,"gold"),card(2,7,"mult"),card(3,2),card(0,3)];
reset(); eq("lapidary enh3 해금", checkUnlocks({},enh3).includes("lapidary"), true);
reset(); eq("prism 3종동시 해금", checkUnlocks({},enh3).includes("prism"), true);
const enh2=[card(0,5,"wild"),card(1,6,"wild"),card(2,7,"gold"),card(3,2),card(0,3)];
reset(); eq("prism 2종선 안열림", checkUnlocks({},enh2).includes("prism"), false);
```

- [ ] **Step 7: 문법 + 밸런스 + 해금 검증**

Run: `node tools/balance-check.cjs`
Expected: 문법 PASS.

Run: `node tools/run-sim.cjs`
Expected: 출력의 **balance(St0) 클리어율 ~9.4%(±0.5pp 이내 유지)**, **gem 전략 클리어율이 balance 이하(비지배, 대략 3~9% 밴드)**. 9.4%를 크게(>+0.5pp) 넘기면 jewelbox per-unit(.025) 또는 prism(.12) 하향.

Run: `node tools/unlock-check.cjs`
Expected: `✅ ... pass / 0 fail` (신규 3 assertion 포함).

- [ ] **Step 8: Commit**

```bash
git add prototype/index.html tools/run-sim.cjs tools/unlock-check.cjs
git commit -m "feat: Gem 클러스터 부적 3종 (세공사·프리즘·보석함, enh 스태킹)"
```

---

## Task 3: Apex 클러스터 (highmult · magnate) — 고랭크 7·8

**Files:** index.html(CHARMS·placeCard·settle·UNLOCKS) · run-sim.cjs(gain·handBonus·CHARMS·STRATS) · unlock-check.cjs(UNLOCKS·assertion)

- [ ] **Step 1: index.html — CHARMS 정의 2종 추가**

CHARMS 배열의 jewelbox 줄(Task2 추가분) 다음에:

```javascript
  {id:"highmult", name:"위세", desc:"7·8 고카드로 연결하면 배율 +1", cost:5},
  {id:"magnate",  name:"거물", desc:"정산 시 줄의 7·8 고카드 1장마다 보너스 +3% (최대 5장)"},
```

- [ ] **Step 2: index.html — placeCard connect 블록에 highmult mult 훅**

`prototype/index.html` L445(`if(has("runner") && byRun) mult+=1;`) 다음에 추가:

```javascript
    if(has("highmult") && card.rank>=7) mult+=1;   // 고카드(7·8) 연결 배율 +1 (25캡 종속)
```

- [ ] **Step 3: index.html — settle에 magnate 훅**

settle의 jewelbox 줄(Task2) 다음에:

```javascript
  if(has("magnate")){ let h=0; for(const c of S.row) if(c.enh!=="wild"&&c.rank>=7) h++; hb+=Math.round(blindBase(S.ante)*.03*Math.min(h,5)); }   // 거물: 7·8 카드 1장당 +3%, 최대5
```

- [ ] **Step 4: index.html — UNLOCKS 2종 추가**

UNLOCKS의 prism 줄(Task2) 다음에:

```javascript
  highmult: {cond:(st,row)=> row.filter(c=>c.rank===8).length>=3, hint:"한 줄에 8 카드 3장"},
  magnate:  {cond:(st,row)=> row.filter(c=>c.rank>=7).length>=5, hint:"한 줄에 7·8 카드 5장"},
```

- [ ] **Step 5: run-sim.cjs — gain(highmult) + handBonus(magnate) + CHARMS + apex STRAT**

L35(`if(owned.includes("runner")&&byRun) mult+=1;`) 다음에:

```javascript
    if(owned.includes("highmult")&&card.rank>=7) mult+=1;
```

handBonus의 jewelbox 줄(Task2) 다음에:

```javascript
  if(owned&&owned.includes("magnate")){ let h=0; for(const c of row) if(c.enh!=="wild"&&c.rank>=7) h++; hb+=Math.round(blindBase(ante)*.03*Math.min(h,5)); }
```

CHARMS 배열 끝에 `,"highmult","magnate"` 추가.

STRATS의 gem 줄(Task2) 다음에 apex 프로필:

```javascript
  apex:   { charm:{magnate:10,highmult:9,greed:5,jackpot:5,keystone:4}, enh:{mult:4,gold:3,wild:3}, item:{add:9,thin:4,copy:6,hand:5,reroll:1} },   // 고랭크 7·8(add로 7~8 카드 매입)
```

- [ ] **Step 6: unlock-check.cjs — UNLOCKS 2종 미러 + assertion**

UNLOCKS의 prism 줄(Task2) 다음에:

```javascript
  highmult: {cond:(st,row)=> row.filter(c=>c.rank===8).length>=3, hint:"한 줄에 8 카드 3장"},
  magnate:  {cond:(st,row)=> row.filter(c=>c.rank>=7).length>=5, hint:"한 줄에 7·8 카드 5장"},
```

Gem assertion 다음에:

```javascript
// Apex 클러스터
const hi8=[card(0,8),card(1,8),card(2,8),card(3,7),card(0,2)];
reset(); eq("highmult 8×3 해금", checkUnlocks({},hi8).includes("highmult"), true);
const hi5=[card(0,8),card(1,7),card(2,8),card(3,7),card(0,7),card(1,2),card(2,3),card(3,4)];
reset(); eq("magnate 7·8×5 해금", checkUnlocks({},hi5).includes("magnate"), true);
reset(); eq("magnate 4장선 안열림", checkUnlocks({},hi8).includes("magnate"), false);
```

- [ ] **Step 7: 검증**

Run: `node tools/balance-check.cjs` → 문법 PASS.
Run: `node tools/run-sim.cjs` → balance ~9.4% 유지, **apex 전략 비지배**(≤9.4%). 초과 시 highmult는 `rank===8`로 좁히지 말 것(apex 死화) — magnate .03→.025 또는 cap 5→4 우선.
Run: `node tools/unlock-check.cjs` → 0 fail.

- [ ] **Step 8: Commit**

```bash
git add prototype/index.html tools/run-sim.cjs tools/unlock-check.cjs
git commit -m "feat: Apex 클러스터 부적 2종 (위세·거물, 고랭크 7·8)"
```

---

## Task 4: Cartel 클러스터 (echo · loaded · climax) — 족보↔체인 브릿지

**Files:** index.html(CHARMS·placeCard·settle·UNLOCKS) · run-sim.cjs(gain·handBonus·CHARMS·STRATS) · unlock-check.cjs(헬퍼 복사·UNLOCKS·assertion)

- [ ] **Step 1: index.html — CHARMS 정의 3종 추가**

CHARMS 배열의 magnate 줄(Task3) 다음에:

```javascript
  {id:"echo",   name:"메아리", desc:"같은 숫자로 연결하면 배율 +1", cost:3},
  {id:"loaded", name:"사기패", desc:"정산 시 포카드면 보너스 +10%, 파이브카드(같은숫자 5장)면 +30%"},
  {id:"climax", name:"절정",   desc:"풀하우스 이상 족보를 만든 라운드, 줄의 최장 연결이 6칸부터 길수록 정산 보너스 추가 (최대 8연결)"},
```

- [ ] **Step 2: index.html — placeCard connect 블록에 echo mult 훅**

`prototype/index.html` L445(runner) 다음, highmult(Task3) 옆에 추가:

```javascript
    if(has("echo") && card.rank===left.rank) mult+=1;   // 같은 숫자 연결 배율 +1 (left는 connect 블록서 보장)
```

- [ ] **Step 3: index.html — settle에 loaded·climax 훅**

settle의 magnate 줄(Task3) 다음에:

```javascript
  if(has("loaded")){ if(hk==="fourKind") hb+=Math.round(blindBase(S.ante)*.10); else if(hk==="fiveKind") hb+=Math.round(blindBase(S.ante)*.30); }   // 사기패: 불법패 보상(hk 재사용)
  if(has("climax") && ["fullHouse","fourKind","straightFlush","fiveKind"].includes(hk)){ let L=1,cur=1; for(let i=1;i<S.row.length;i++){ if(connect(S.row[i],S.row[i-1])){ cur++; if(cur>L)L=cur; } else cur=1; } hb+=Math.round(blindBase(S.ante)*.03*Math.max(0,Math.min(L,8)-5)); }   // 절정: 풀하우스+ & 6연결부터(L-5)
```

- [ ] **Step 4: index.html — UNLOCKS 3종 추가**

UNLOCKS의 magnate 줄(Task3) 다음에:

```javascript
  echo:   {cond:(st,row)=> maxRankCount(row)>=4, hint:"한 줄에 같은 숫자 4장"},
  loaded: {cond:(st,row)=> evalHand(row)==="fiveKind", hint:"파이브 카드(같은숫자 5장) 완성"},
  climax: {cond:(st,row)=>{ if(row.length<8) return false; if(!["fullHouse","fourKind","straightFlush","fiveKind"].includes(evalHand(row))) return false; let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1])){ cur++; if(cur>L)L=cur; } else cur=1; } return L>=8; }, hint:"8칸 전부 연결 + 풀하우스↑ 동시"},
```

- [ ] **Step 5: run-sim.cjs — gain(echo) + handBonus(loaded·climax) + CHARMS + cartel STRAT**

L35(runner) 다음, highmult(Task3) 옆에:

```javascript
    if(owned.includes("echo")&&card.rank===left.rank) mult+=1;
```

handBonus의 magnate 줄(Task3) 다음에(`hk`는 L68서 산출됨):

```javascript
  if(owned&&owned.includes("loaded")){ if(hk==="fourKind") hb+=Math.round(blindBase(ante)*.10); else if(hk==="fiveKind") hb+=Math.round(blindBase(ante)*.30); }
  if(owned&&owned.includes("climax") && ["fullHouse","fourKind","straightFlush","fiveKind"].includes(hk)){ let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1],boss)){ cur++; if(cur>L)L=cur; } else cur=1; } hb+=Math.round(blindBase(ante)*.03*Math.max(0,Math.min(L,8)-5)); }
```

CHARMS 배열 끝에 `,"echo","loaded","climax"` 추가.

STRATS의 apex 줄(Task3) 다음에 cartel 프로필:

```javascript
  cartel: { charm:{loaded:10,echo:9,twins:8,broker:7,climax:6,jackpot:4}, enh:{wild:3,mult:3,gold:2}, item:{copy:9,thin:6,hand:5,add:1,reroll:1} },   // 같은수(copy로 동일 랭크 복제)
```

- [ ] **Step 6: unlock-check.cjs — evalHand/connect 헬퍼 복사 + UNLOCKS 3종 + assertion**

`tools/unlock-check.cjs` L9(`pairGroups` 함수) 다음에 run-sim.cjs L14·L50~L65의 `connect`/`hasRun5`/`evalHand`를 복사(boss 인자 생략 호출 가능):

```javascript
function connect(a,b){ if(a.enh==="wild"||b.enh==="wild") return true; const run=Math.abs(a.rank-b.rank)===1; return a.suit===b.suit||a.rank===b.rank||run; }
function hasRun5(r){ const s=new Set(r); for(let lo=1;lo<=4;lo++){ let ok=1; for(let k=0;k<5;k++) if(!s.has(lo+k)){ok=0;break;} if(ok) return true; } return false; }
function evalHand(cards){
  const rc={},sc={}; for(const c of cards){ if(c.enh==="wild") continue; rc[c.rank]=(rc[c.rank]||0)+1; sc[c.suit]=(sc[c.suit]||0)+1; }
  const counts=Object.values(rc).sort((a,b)=>b-a); const mr=counts[0]||0;
  const flush=Object.values(sc).some(n=>n>=5); const full=mr>=3&&counts[1]>=2;
  const sf=flush&&hasRun5(cards.filter(c=>c.enh!=="wild").map(c=>c.rank));
  if(mr>=5) return"fiveKind"; if(sf) return"straightFlush"; if(mr>=4) return"fourKind"; if(full) return"fullHouse";
  if(flush) return"flush"; if(hasRun5(cards.filter(c=>c.enh!=="wild").map(c=>c.rank))) return"straight";
  if(mr>=3) return"trips"; if(counts.filter(n=>n>=2).length>=2) return"twoPair"; if(mr>=2) return"pair"; return"highCard";
}
```

> ⚠️ **복사 후 `node -e`로 run-sim.cjs의 evalHand와 동일 출력인지 1회 대조**(아래 Step 7). 불일치 시 run-sim L51~L66 원문을 그대로 복사.

UNLOCKS의 magnate 줄(Task3) 다음에:

```javascript
  echo:   {cond:(st,row)=> maxRankCount(row)>=4, hint:"한 줄에 같은 숫자 4장"},
  loaded: {cond:(st,row)=> evalHand(row)==="fiveKind", hint:"파이브 카드 완성"},
  climax: {cond:(st,row)=>{ if(row.length<8) return false; if(!["fullHouse","fourKind","straightFlush","fiveKind"].includes(evalHand(row))) return false; let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1])){ cur++; if(cur>L)L=cur; } else cur=1; } return L>=8; }, hint:"8칸 전부 연결 + 풀하우스↑"},
```

Apex assertion 다음에:

```javascript
// Cartel 클러스터
const rank4=[card(0,5),card(1,5),card(2,5),card(3,5),card(0,2)];
reset(); eq("echo 같은수4 해금", checkUnlocks({},rank4).includes("echo"), true);
const five=[card(0,5),card(1,5),card(2,5),card(3,5),card(0,5),card(1,2),card(2,3),card(3,4)];
reset(); eq("loaded 파이브카드 해금", checkUnlocks({},five).includes("loaded"), true);
reset(); eq("loaded 포카드선 안열림", checkUnlocks({},[card(0,5),card(1,5),card(2,5),card(3,5),card(0,2),card(1,3),card(2,4),card(3,6)]).includes("loaded"), false);
// climax: 8칸 전부 연결(±1 런) + 풀하우스
const fullChain=[card(0,1),card(0,2),card(1,2),card(1,3),card(2,3),card(2,4),card(3,4),card(0,4)];   // 1-2-2-3-3-4-4-4: 풀하우스(4×3,3×2,2×2)+전연결
reset(); eq("climax 전연결+풀하우스 해금", checkUnlocks({},fullChain).includes("climax"), true);
```

- [ ] **Step 7: evalHand 대조 + 검증**

Run: `node -e "const a=require('./tools/unlock-check.cjs')" 2>&1 | head -1`
(unlock-check은 실행 시 자동 테스트 — 아래로 충분, 이 스텝은 생략 가능)

Run: `node tools/balance-check.cjs` → 문법 PASS.
Run: `node tools/run-sim.cjs` → balance ~9.4% 유지, **cartel 전략 비지배**. fiveKind 분기(.30)는 sim 미검증(random copy) — 출력 무관, 정상.
Run: `node tools/unlock-check.cjs` → 0 fail(신규 4 assertion 포함). climax assertion이 fail이면 fullChain이 evalHand상 풀하우스+8연결인지 재확인.

- [ ] **Step 8: Commit**

```bash
git add prototype/index.html tools/run-sim.cjs tools/unlock-check.cjs
git commit -m "feat: Cartel 클러스터 부적 3종 (메아리·사기패·절정, 족보↔체인 브릿지)"
```

---

## Task 5: Parity 클러스터 (evenodd · paritybet) — 홀짝

**Files:** index.html(CHARMS·settle·UNLOCKS) · run-sim.cjs(handBonus·CHARMS·STRATS) · unlock-check.cjs(UNLOCKS·assertion)

- [ ] **Step 1: index.html — CHARMS 정의 2종 추가**

CHARMS 배열의 climax 줄(Task4) 다음에:

```javascript
  {id:"evenodd",   name:"홀짝 정렬", desc:"정산 시 줄이 짝수 또는 홀수 한쪽으로 6장부터 치우칠수록 보너스 (초과분마다 +4%)"},
  {id:"paritybet", name:"패리티 도박", desc:"줄 전체가 짝수만 또는 홀수만이면 정산 보너스 +30% (와일드는 자유)"},
```

- [ ] **Step 2: index.html — settle에 evenodd·paritybet 훅**

settle의 climax 줄(Task4) 다음에:

```javascript
  if(has("evenodd")){ let ev=0,od=0; for(const c of S.row) if(c.enh!=="wild")(c.rank%2?od++:ev++); hb+=Math.round(blindBase(S.ante)*.04*Math.max(0,Math.max(ev,od)-5)); }   // 홀짝 정렬: 6장+부터 초과분당 +4%
  if(has("paritybet")){ const nw=S.row.filter(c=>c.enh!=="wild"); if(S.row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1))) hb+=Math.round(blindBase(S.ante)*.30); }   // 패리티 도박: 전원 동일 패리티 +30%(스파이스)
```

- [ ] **Step 3: index.html — UNLOCKS 2종 추가**

UNLOCKS의 climax 줄(Task4) 다음에:

```javascript
  evenodd:   {cond:(st,row)=>{ let ev=0,od=0; for(const c of row) if(c.enh!=="wild")(c.rank%2?od++:ev++); return Math.max(ev,od)>=6; }, hint:"한 줄에 같은 홀짝 6장"},
  paritybet: {cond:(st,row)=>{ const nw=row.filter(c=>c.enh!=="wild"); return row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1)); }, hint:"줄 전체 짝수만 또는 홀수만"},
```

- [ ] **Step 4: run-sim.cjs — handBonus(evenodd·paritybet) + CHARMS + parity STRAT**

handBonus의 climax 줄(Task4) 다음에:

```javascript
  if(owned&&owned.includes("evenodd")){ let ev=0,od=0; for(const c of row) if(c.enh!=="wild")(c.rank%2?od++:ev++); hb+=Math.round(blindBase(ante)*.04*Math.max(0,Math.max(ev,od)-5)); }
  if(owned&&owned.includes("paritybet")){ const nw=row.filter(c=>c.enh!=="wild"); if(row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1))) hb+=Math.round(blindBase(ante)*.30); }
```

CHARMS 배열 끝에 `,"evenodd","paritybet"` 추가(최종 23종).

STRATS의 cartel 줄(Task4) 다음에 parity 프로필:

```javascript
  parity: { charm:{paritybet:10,evenodd:9,greed:5,twins:5,suited:4}, enh:{wild:6,mult:3,gold:3}, item:{thin:8,hand:5,add:3,copy:3,reroll:1} },   // 홀짝(thin으로 한쪽 패리티 정제 — 도구상 어려움=의도된 직교)
```

- [ ] **Step 5: unlock-check.cjs — UNLOCKS 2종 미러 + assertion**

UNLOCKS의 climax 줄(Task4) 다음에:

```javascript
  evenodd:   {cond:(st,row)=>{ let ev=0,od=0; for(const c of row) if(c.enh!=="wild")(c.rank%2?od++:ev++); return Math.max(ev,od)>=6; }, hint:"한 줄에 같은 홀짝 6장"},
  paritybet: {cond:(st,row)=>{ const nw=row.filter(c=>c.enh!=="wild"); return row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1)); }, hint:"줄 전체 짝수만/홀수만"},
```

Cartel assertion 다음에:

```javascript
// Parity 클러스터
const ev6=[card(0,2),card(1,4),card(2,6),card(3,8),card(0,2),card(1,4),card(2,3),card(3,5)];   // 짝6
reset(); eq("evenodd 짝6 해금", checkUnlocks({},ev6).includes("evenodd"), true);
const allOdd=[card(0,1),card(1,3),card(2,5),card(3,7),card(0,1),card(1,3),card(2,5),card(3,7)];   // 전홀
reset(); eq("paritybet 전홀 해금", checkUnlocks({},allOdd).includes("paritybet"), true);
reset(); eq("paritybet 혼합선 안열림", checkUnlocks({},ev6).includes("paritybet"), false);
```

- [ ] **Step 6: 검증 + paritybet 머지 게이트**

Run: `node tools/balance-check.cjs` → 문법 PASS.
Run: `node tools/run-sim.cjs` →
  - balance ~9.4% 유지(±0.5pp).
  - **parity 전략 비지배** = spatial(~3.4%) 밴드 이하면 정상(achieving parity is hard). balance 근접·초과 시 **paritybet `.30→.25` 폴백**, 그래도 지배면 `if(hk!=="flush"&&hk!=="straightFlush")` 가드(flush co-stack 차단) — index.html·run-sim 양쪽 동일 수정.
Run: `node tools/unlock-check.cjs` → 0 fail.

- [ ] **Step 7: Commit**

```bash
git add prototype/index.html tools/run-sim.cjs tools/unlock-check.cjs
git commit -m "feat: Parity 클러스터 부적 2종 (홀짝 정렬·패리티 도박) — 부적 23종 완성"
```

---

## Task 6: 전체 검증 스윕 (10종 동시)

**Files:** (검증만 — 코드 변경 시 해당 파일)

- [ ] **Step 1: 전체 run-sim 스윕**

Run: `node tools/run-sim.cjs`
Expected:
- **balance St0 9.4%(±0.5pp)** — 신규 10종 풀 투입 후에도 비특화 인플레 없음. 초과 시 가장 인플레 기여 큰 settle 부적부터 하향(spec §6 게이트).
- **gem/apex/cartel/parity 4 전략 전부 비지배**(balance 9.4% 이하, 단독 캐리 없음).
- 조건부 클리어율 곡선·스테이크 스윕(St0 9.4→St5 0.6 단조)이 v3.23과 동일 형태 유지.

- [ ] **Step 2: 해금·경제 회귀**

Run: `node tools/unlock-check.cjs` → 모든 assertion 0 fail(13 기존 + 11 신규).
Run: `node tools/economy-check.cjs` → 모든 불변식 PASS.

- [ ] **Step 3: 드리프트 가드 — 3파일 부적 목록 일치 확인**

`prototype/index.html` CHARMS(23) ↔ `tools/run-sim.cjs` CHARMS(23) ↔ 신규 부적이 양쪽 gain/handBonus에 모두 배선됐는지 육안 대조. (settle 7 + per-card 3 = 10 신규 훅이 2파일에 동일.)

- [ ] **Step 4: 튜닝 발생 시 Commit**

```bash
git add -A
git commit -m "fix: 부적 10종 합산 밸런스 캘리브 (run-sim 9.4% 가드)"
```

(튜닝 없으면 이 스텝 생략.)

---

## Task 7: bridge 설명문 드리프트 정정

**Files:** Modify `prototype/index.html:319`

- [ ] **Step 1: bridge desc를 실제 코드값으로 정정**

`prototype/index.html` L319를 교체:

```javascript
  {id:"bridge",   name:"다리",   desc:"양옆 모두와 연결되는 카드(징검다리)마다 정산 보너스 +3% (최대 3장)"},
```

(기존 `+5% (최대 4장)` → 실제 코드 L480 `.03*min(n,3)`와 일치. 점수 로직 무변경 = 검증 불필요.)

- [ ] **Step 2: 문법 확인 + Commit**

Run: `node tools/balance-check.cjs` → 문법 PASS.

```bash
git add prototype/index.html
git commit -m "fix: bridge 부적 설명문 드리프트 정정 (+5%/4장 → +3%/3장)"
```

---

## Task 8: Playwright UI 스모크

**Files:** Create `<scratchpad>/charm-expansion-smoke.cjs` (커밋 안 함)

- [ ] **Step 1: 스모크 스크립트 작성**

스크래치패드에 Playwright 스크립트 작성: `file://` 로 `prototype/index.html` 로드 → ① 콘솔에러 0 ② 부팅 정상 ③ `localStorage.cd_unlocked`에 신규 부적 id 강제 주입 후 `newGame()` → 상점 강제 오픈(또는 openShop 호출) → 신규 부적이 **cost(3/5/8)와 함께** 렌더되는지 ④ 신규 부적 보유 상태로 한 라운드 정산 → 정산 표 보너스 합산·콘솔에러0 ⑤ 컬렉션 드로어(`charmsHTML`)에 23종 표시·잠금 부적 silhouette.

- [ ] **Step 2: 실행**

Run: `node <scratchpad>/charm-expansion-smoke.cjs`
Expected: 모든 체크 ✓, 콘솔에러 0, 신규 부적 cost 표시 확인.

- [ ] **Step 3: (실패 시) 수정 후 해당 Task 재방문**

UI 깨짐(예: cost 미표시 — shopPool/renderShop 확인) 발견 시 index.html 수정 + 해당 클러스터 Task 재검증.

---

## Task 9: 문서 갱신

**Files:** Modify `HANDOVER.md` · `CLAUDE.md` · `docs/PLAN.md`

- [ ] **Step 1: HANDOVER.md**

§0 30초 요약의 "다음 할 일" + §6 최상단에 v3.24 항목 추가: 부적 13→**23종**, 4클러스터(보석세공·정점·같은수카르텔·홀짝패리티), 컷 목록, ★fiveKind=0.30 sim 미검증·상점 희석(후속) 노트. §7 🧭 로드맵의 "▶다음" 갱신(부적 확장 완료 → 위치맥락 보스룰 또는 색 settle 페이오프).

- [ ] **Step 2: CLAUDE.md**

"규칙 중복" 섹션의 드리프트 상태 갱신: run-sim 부적 **13→23종** 동기화, balance-check/strategy-sim/hand-frequency는 여전히 구13부적(신규 검증 무효, run-sim 단독). cost 차등(CHARM_COST) 동기화 지점 추가. unlock-check.cjs에 evalHand/connect 복사됨 명시.

- [ ] **Step 3: docs/PLAN.md**

MID 섹션에 "부적 시너지 확장 10종 ✅ (v3.24)" 항목 + 클러스터·검증 요약 추가. "▶다음" 포인터 갱신.

- [ ] **Step 4: Commit**

```bash
git add HANDOVER.md CLAUDE.md docs/PLAN.md
git commit -m "docs: 부적 시너지 확장 23종 (v3.24) — HANDOVER/CLAUDE/PLAN 갱신"
```

- [ ] **Step 5: 배포(선택)**

```bash
git push origin main
```

(push hang 시 HANDOVER §2 gh 토큰 인라인 helper 우회. GitHub Pages 1~2분 후 자동 반영.)

---

## 검증 요약 (DoD)

- [ ] `node tools/run-sim.cjs`: balance St0 9.4%(±0.5pp) 불변 · gem/apex/cartel/parity 4전략 비지배 · 스테이크 스윕 단조 유지
- [ ] `node tools/unlock-check.cjs`: 0 fail (신규 11 assertion 포함)
- [ ] `node tools/economy-check.cjs`: 불변식 PASS
- [ ] `node tools/balance-check.cjs`: 문법 PASS
- [ ] Playwright 스모크: 부팅·상점 cost 표시·정산 합산·컬렉션 23종·콘솔에러0
- [ ] 3파일(index/run-sim/unlock-check) 부적 목록·훅 일치(드리프트 0)
- [ ] 문서 3종 갱신
```

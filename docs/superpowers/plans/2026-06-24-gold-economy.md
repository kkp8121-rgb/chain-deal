# 골드 경제 + 아웃게임 메타 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료 인게임 상점을 골드 유료 상점으로 바꾸고(초과율 환전 → 가격티어 스킬 구매), 런 종료 시 남은 골드의 1/10을 아웃게임 메타 화폐로 반출해 재도전권·시작골드·시작리롤을 사게 한다.

**Architecture:** 단일 파일 `prototype/index.html`에 골드(`S.gold`)·메타(`localStorage.cd_meta`) 상태 추가. `settle()`이 통과 시 골드 환전, 런 종료 시 스필오버. `openShop`/`chooseShop`을 멀티구매 유료 상점으로 리팩터. 재도전권 = 패배 정산 표 버튼 → 카드 전량 회수 + `startBlind()` 재시도. sim은 `run-sim.cjs`에만 골드 경제 이식(balance-check은 문법+단일라운드 기준선 가드 유지).

**Tech Stack:** Vanilla JS (인라인), localStorage, node `.cjs` 시뮬(검증), 빌드/프레임워크 없음.

**스펙:** `docs/superpowers/specs/2026-06-24-gold-economy-design.md` (A안 채택: `gold += floor(BASE + max(0,score/target−1)*K)`).

**파라미터 초기값(캘리브 대상):** `GOLD_BASE=2, GOLD_K=10`, 시작골드=`goldLv*3`, 가격티어 상8/중5/하3, 메타가격 재도전권3·시작골드[5,8,12]·시작리롤[6,10], 스필오버 ×0.1.

---

### Task 0: run-sim 기준선 캡처 (변경 전)

골드 경제가 클리어율을 얼마나 떨어뜨리는지 비교 기준 확보. **코드 변경 없음.**

- [ ] **Step 1:** `node tools/run-sim.cjs` 실행, 5전략 클리어율을 메모(예: balance ~X%, flush ~Y% …). 이 수치가 §Task 11 캘리브 목표.
- [ ] (커밋 없음 — 측정만)

---

### Task 1: 메타 영속성 — getMeta/saveMeta

**Files:** Modify `prototype/index.html` (getStats/saveStats 직후, ~line 245)

- [ ] **Step 1:** `saveStats` 다음 줄에 추가:

```js
/* ---------- 아웃게임 메타 (localStorage cd_meta) ---------- */
const META_DEFAULT={coins:0,retry:0,goldLv:0,rerollLv:0};
function getMeta(){ try{ const m=JSON.parse(localStorage.getItem("cd_meta")); if(m&&typeof m==="object") return Object.assign({},META_DEFAULT,m); }catch(e){} return {...META_DEFAULT}; }
function saveMeta(m){ try{ localStorage.setItem("cd_meta",JSON.stringify(m)); }catch(e){} }
```

- [ ] **Step 2:** `node tools/balance-check.cjs` → "✅ 문법 OK" 확인.
- [ ] **Step 3:** Commit: `git add -A && git commit -m "feat: 메타 영속성 getMeta/saveMeta (골드 경제 1/9)"`

---

### Task 2: 경제 상수 + 순수 함수

**Files:** Modify `prototype/index.html` (`const SLOTS=8, ANTES=8;` 직후, ~line 259)

- [ ] **Step 1:** 추가:

```js
/* ---------- 골드 경제 파라미터 (캘리브 대상 · run-sim.cjs와 동기화 필수) ---------- */
const GOLD_BASE=2, GOLD_K=10;          // 통과 환전: floor(BASE + 초과율*K)
const START_GOLD_PER_LV=3;             // 시작 골드 = goldLv * 3
const META_PRICE={ retry:3, gold:[5,8,12], reroll:[6,10] };
function goldEarned(score,target){ return Math.floor(GOLD_BASE + Math.max(0, score/target - 1)*GOLD_K); }
function spillover(gold){ return Math.floor(gold*0.1); }
```

- [ ] **Step 2:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 3:** Commit: `... -m "feat: 골드 경제 상수+환전/스필오버 함수 (2/9)"`

---

### Task 3: newGame — 시작 골드/리롤/재도전권 로드

**Files:** Modify `prototype/index.html:304-310` (`newGame`)

- [ ] **Step 1:** `newGame` 안 `RNG=...` 다음에 `const meta=getMeta();` 추가하고, `S={...}` 객체에서 `rerollMax:0` → `rerollMax:meta.rerollLv` 로 바꾸고 `gold`·`retry` 필드 추가:

```js
function newGame(seed){
  const daily = seed!=null;
  const useSeed = daily ? seed : Math.floor(Math.random()*2147483647);
  RNG = mulberry32(useSeed);
  const meta=getMeta();
  S={ante:1, blind:0, anteBoss:pickBoss(1), owned:[], over:false, busy:false, settled:false,
     bonusHand:0, rerollMax:meta.rerollLv, gold:meta.goldLv*START_GOLD_PER_LV, retry:meta.retry,
     seed:useSeed, daily, runBest:0,
     showPreview:document.getElementById("pvToggle").checked, deck:shuffle(fullDeck()), discard:[]};
  logEvent("run_start",{seed:useSeed, daily:daily?1:0});
  startBlind();
  renderStats();
}
```

- [ ] **Step 2:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 3:** Commit: `... -m "feat: newGame 시작 골드/리롤/재도전권 로드 (3/9)"`

---

### Task 4: render — 골드 칩 표시

**Files:** Modify `prototype/index.html:145` (HUD) + `render()` (~line 514)

- [ ] **Step 1:** HUD 안테 chip 다음(line 145 뒤)에 골드 chip 추가:

```html
    <div class="chip">안테 <b id="hAnte">1</b>/8</div>
    <div class="chip" id="goldChip">💰 <b id="hGold">0</b></div>
```

- [ ] **Step 2:** `render()` 안 `document.getElementById("hAnte").textContent=S.ante;` 다음 줄에 추가:

```js
  { const gc=document.getElementById("hGold"); if(gc) gc.textContent=S.gold; }
```

- [ ] **Step 3:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 4:** Commit: `... -m "feat: HUD 골드 칩 표시 (4/9)"`

---

### Task 5: settle — 통과 시 골드 환전 + cashOut/victory 스필오버

**Files:** Modify `prototype/index.html` `settle()` (377-430), `victory()` (431-439)

- [ ] **Step 1:** `settle()` 통과 분기(`if(pass){` 바로 안, line 396 `res.textContent...` 위)에 골드 환전 추가:

```js
  if(pass){
    S.gold += goldEarned(S.score, S.target);
    document.getElementById("hGold").textContent=S.gold;
    res.textContent = wasBoss ? `${S.anteBoss.icon} 보스 격파!` : "✦ 통과!"; res.className="tallyResult pass";
```

- [ ] **Step 2:** `tallyNext`/`victory` 위(line 375 부근)에 `cashOut` 추가:

```js
function cashOut(){ if(!S) return; const meta=getMeta(); meta.retry=S.retry; meta.coins += spillover(S.gold); saveMeta(meta); }
```

- [ ] **Step 3:** `settle()` 패배 분기에서 `_tallyNext=newGame;` 를 cashOut 래핑으로 변경 (line 406):

```js
    btn.textContent="새 게임 (런 다시)"; _tallyNext=()=>{ cashOut(); newGame(); };
```

- [ ] **Step 4:** `victory()` 첫 줄(`logEvent` 위)에 `cashOut();` 추가:

```js
function victory(){
  cashOut();
  logEvent("win",{ante:S.ante,score:S.score});
```

- [ ] **Step 5:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 6:** Commit: `... -m "feat: settle 골드 환전 + 런종료 스필오버 cashOut (5/9)"`

---

### Task 6: 재도전권 — 정산 표 버튼 + useRetry

**Files:** Modify `prototype/index.html` tally HTML (678), `settle()` 양 분기, 신규 `useRetry`

- [ ] **Step 1:** tally의 `tBtn` 버튼(line 678) **앞**에 재도전 버튼 추가:

```html
    <button class="tallyBtn" id="tRetry" style="display:none;background:#7a4dd1" onclick="useRetry()">🎟 재도전권 사용</button>
    <button class="tallyBtn" id="tBtn" onclick="tallyNext()">다음</button>
```

- [ ] **Step 2:** `settle()` 통과 분기 끝(else 직전, `_tallyNext=openShop;` 처리부 근처)과 패배 분기에 tRetry 토글. 가장 단순히 — settle 끝부분 `document.getElementById("tally").classList.add("show");` **앞**(line 428)에 공통 토글 추가:

```js
  { const rt=document.getElementById("tRetry");
    if(!pass && S.retry>0){ rt.style.display="block"; rt.textContent=`🎟 재도전권 사용 (재시도) · 보유 ${S.retry}`; }
    else rt.style.display="none"; }
  document.getElementById("tally").classList.add("show");
```

- [ ] **Step 3:** `tallyNext` 함수(line 376) 다음에 `useRetry` 추가:

```js
function useRetry(){
  if(!S || S.retry<=0) return;
  S.retry--;
  document.getElementById("tally").classList.remove("show");
  S.deck = shuffle(S.deck.concat(S.discard)); S.discard=[];   // ★카드 불변식: row/hand는 settle에서 이미 회수됨 → deck+discard 전량 회수
  S.over=false; S.settled=false;
  beep(420,.06,"square");
  startBlind();   // 같은 ante/blind 재시작 (target·boss 동일 재산출)
}
```

- [ ] **Step 4:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 5:** Commit: `... -m "feat: 재도전권 사용 버튼+useRetry (카드 불변식 유지) (6/9)"`

---

### Task 7: 인게임 상점 유료화 (멀티구매)

**Files:** Modify `prototype/index.html` `shopPool` (442-453), `openShop` (455-468), `chooseShop`(469-475)→`buyShop`, `pickDeckCard`(476-484)·`pickSuitToAdd`(486-494) 말미 `advanceBlind()`→`renderShop()`, `advanceBlind`(495)

- [ ] **Step 1:** `shopPool()` 각 품목에 `cost` 부여(상8/중5/하3):

```js
function shopPool(){
  const pool=[];
  CHARMS.filter(c=>!has(c.id) && isUnlocked(c.id)).forEach(c=>pool.push({type:"charm",charm:c,name:c.name,desc:c.desc,cost:8}));
  pool.push({type:"thin", name:"덱 압축 ✂", desc:"덱에서 카드 1장 영구 제거 (체인 확률↑)", cost:3});
  pool.push({type:"copy", name:"카드 복제 ⧉", desc:"덱 카드 1장을 복사해 추가 (같은 숫자·무늬 빌드 / 🃏파이브 카드)", cost:5});
  pool.push({type:"enh", enh:"wild", name:"와일드 부여 ★", desc:"덱 카드 1장을 '와일드'로 (무엇과도 연결)", cost:8});
  pool.push({type:"enh", enh:"mult", name:"배율석 부여 ◆", desc:"덱 카드 1장에 '체인 배율 +1'", cost:5});
  pool.push({type:"enh", enh:"gold", name:"황금 부여 ●", desc:"덱 카드 1장에 '기본 점수 +5'", cost:5});
  pool.push({type:"add", name:"카드 추가 +", desc:"고른 무늬의 강한 카드(7~8) 추가", cost:3});
  pool.push({type:"hand", name:"손패 확장 +1", desc:"매 블라인드 손패 1장 증가 (영구 성장)", cost:8});
  pool.push({type:"reroll", name:"리롤 +1", desc:"블라인드마다 손패 리롤 횟수 +1 (영구)", cost:5});
  return pool;
}
```

- [ ] **Step 2:** `openShop`/`chooseShop` 를 멀티구매 구조로 교체:

```js
function openShop(){
  S.shopOffers = shuffle(shopPool()).slice(0,3).map(o=>({...o, sold:false}));
  document.getElementById("shopTitle").textContent=`안테 ${S.ante} · ${BLINDNAME[S.blind]} 통과! (덱 ${S.deck.length+S.discard.length}장)`;
  renderShop();
  document.getElementById("shop").classList.add("show");
}
function renderShop(){
  const body=document.getElementById("shopBody"); body.innerHTML="";
  const g=document.createElement("div"); g.className="shopGold"; g.innerHTML=`💰 골드 <b>${S.gold}</b>`; body.appendChild(g);
  const off=document.createElement("div"); off.className="offer";
  S.shopOffers.forEach((p,i)=>{ const afford=!p.sold && S.gold>=p.cost;
    const d=document.createElement("div"); d.className="ocard"+(p.sold?" sold":afford?"":" cantafford");
    d.innerHTML=`<div class="on">${p.name}</div><div class="od">${p.desc}</div><div class="ocost">${p.sold?"✓ 구매함":"💰 "+p.cost}</div>`;
    if(afford) d.onclick=()=>buyShop(i);
    off.appendChild(d); });
  body.appendChild(off);
  const skip=document.createElement("div"); skip.style.marginTop="14px";
  skip.innerHTML=`<button onclick="advanceBlind()">상점 나가기 → (골드 ${S.gold} 보유)</button>`;
  body.appendChild(skip);
}
function buyShop(i){
  const p=S.shopOffers[i]; if(!p || p.sold || S.gold<p.cost) return;
  S.gold-=p.cost; p.sold=true; document.getElementById("hGold").textContent=S.gold; beep(540,.05);
  if(p.type==="charm"){ S.owned.push(p.charm.id); renderShop(); }
  else if(p.type==="hand"){ S.bonusHand++; renderShop(); }
  else if(p.type==="reroll"){ S.rerollMax++; renderShop(); }
  else if(p.type==="add"){ pickSuitToAdd(); }
  else pickDeckCard(p);   // thin/copy/enh
}
```

- [ ] **Step 3:** `pickDeckCard` 의 카드 클릭 핸들러 끝 `advanceBlind()` → `renderShop()` (line 482):

```js
  refs.forEach(c=>{ const el=cardEl(c); el.onclick=()=>{ if(p.type==="thin") removeCard(c); else if(p.type==="copy") S.deck.push({suit:c.suit,rank:c.rank,enh:c.enh}); else c.enh=p.enh; renderShop(); }; grid.appendChild(el); });
```

- [ ] **Step 4:** `pickSuitToAdd` 의 무늬 클릭 핸들러 끝 `advanceBlind()` → `renderShop()` (line 492):

```js
    d.onclick=()=>{ S.deck.push(mkCard(su.k,7+ri(2))); shuffle(S.deck); renderShop(); }; grid.appendChild(d);
```

- [ ] **Step 5:** `advanceBlind` 첫 줄에 `S.shopOffers=null;` 추가(정리):

```js
function advanceBlind(){
  S.shopOffers=null;
  document.getElementById("shop").classList.remove("show");
```

- [ ] **Step 6:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 7:** Commit: `... -m "feat: 인게임 상점 골드 유료화 (멀티구매) (7/9)"`

---

### Task 8: 메타 상점 드로어 + CSS + 버튼

**Files:** Modify `prototype/index.html` `openDrawer`(638), 신규 `metaHTML`/`buyMeta`, controls(161), `<style>`

- [ ] **Step 1:** `charmsHTML` 다음에 `metaHTML`/`buyMeta` 추가:

```js
function metaHTML(){
  const m=getMeta();
  const gN = m.goldLv<3 ? META_PRICE.gold[m.goldLv] : null;
  const rN = m.rerollLv<2 ? META_PRICE.reroll[m.rerollLv] : null;
  const btn=(on,price)=> on!=null ? `<button onclick="buyMeta('${price.k}')" ${m.coins<price.v?"disabled":""}>🪙 ${price.v}</button>` : `<span class="hsmall">최대</span>`;
  return `<h3>🪙 아웃게임 상점</h3><p class="drawerSub">런에서 남기고 안 쓴 골드의 1/10이 메타 코인으로 쌓입니다. 비싼 강스킬을 살지, 비축해서 메타에 투자할지.</p>
  <div class="hrow"><span><b class="hname">🪙 보유 코인</b></span><b class="hbig">${m.coins}</b></div>
  <div class="hrow"><span><b class="hname">🎟 재도전권</b><br><span class="hdesc">블라인드 실패 시 그 라운드 재시도 (보유 ${m.retry}/3)</span></span>${ m.retry<3 ? `<button onclick="buyMeta('retry')" ${m.coins<META_PRICE.retry?"disabled":""}>🪙 ${META_PRICE.retry}</button>` : `<span class="hsmall">최대</span>` }</div>
  <div class="hrow"><span><b class="hname">💰 시작 골드</b><br><span class="hdesc">런 시작 골드 +${m.goldLv*3} (Lv${m.goldLv}/3)</span></span>${ gN!=null ? `<button onclick="buyMeta('gold')" ${m.coins<gN?"disabled":""}>🪙 ${gN}</button>` : `<span class="hsmall">최대</span>` }</div>
  <div class="hrow"><span><b class="hname">🔄 시작 리롤</b><br><span class="hdesc">런 시작 손패 리롤 +${m.rerollLv} (Lv${m.rerollLv}/2)</span></span>${ rN!=null ? `<button onclick="buyMeta('reroll')" ${m.coins<rN?"disabled":""}>🪙 ${rN}</button>` : `<span class="hsmall">최대</span>` }</div>
  <p class="drawerNote">💡 영구 부스트(골드·리롤)는 다음 런부터 적용됩니다.</p>`;
}
function buyMeta(kind){
  const m=getMeta();
  if(kind==="retry"){ if(m.retry>=3||m.coins<META_PRICE.retry) return; m.coins-=META_PRICE.retry; m.retry++; if(S) S.retry=(S.retry||0)+1; }
  else if(kind==="gold"){ if(m.goldLv>=3) return; const c=META_PRICE.gold[m.goldLv]; if(m.coins<c) return; m.coins-=c; m.goldLv++; }
  else if(kind==="reroll"){ if(m.rerollLv>=2) return; const c=META_PRICE.reroll[m.rerollLv]; if(m.coins<c) return; m.coins-=c; m.rerollLv++; }
  else return;
  saveMeta(m); try{beep(660,.06);}catch(e){}; openDrawer('meta');
}
```

- [ ] **Step 2:** `openDrawer`(line 638)에 meta 분기 추가:

```js
function openDrawer(type){ document.getElementById("drawerBody").innerHTML=type==="rules"?RULES_HTML:type==="stats"?statsHTML():type==="deck"?deckHTML():type==="charms"?charmsHTML():type==="meta"?metaHTML():HANDS_HTML; document.getElementById("drawerBd").classList.add("show"); document.getElementById("drawer").classList.add("show"); try{beep(560,.05);}catch(e){} }
```

- [ ] **Step 3:** controls(line 161)에 메타 상점 버튼 추가:

```html
  <div class="controls"><button onclick="newGame()">새 게임</button> <button onclick="newGame(dailySeed())">🗓 데일리</button> <button onclick="openBoard()">🏆 리더보드</button> <button onclick="openDrawer('charms')">🧿 부적</button> <button onclick="openDrawer('meta')">🪙 상점</button></div>
```

- [ ] **Step 4:** `<style>`에 상점 CSS 추가(`.ocard` 규칙 근처 — grep `\.ocard` 로 위치 확인 후 그 블록 뒤에 삽입):

```css
.ocard .ocost{margin-top:6px;color:var(--gold);font-weight:700;font-size:13px}
.ocard.sold{opacity:.38;pointer-events:none} .ocard.cantafford{opacity:.5}
.shopGold{text-align:center;color:var(--gold);font-size:15px;margin-bottom:10px}
```

- [ ] **Step 5:** `node tools/balance-check.cjs` → 문법 OK.
- [ ] **Step 6:** Commit: `... -m "feat: 메타 상점 드로어+buyMeta+버튼+CSS (8/9)"`

---

### Task 9: economy-check.cjs — 단위 검증

**Files:** Create `tools/economy-check.cjs`

- [ ] **Step 1:** 작성 (환전 공식·스필오버·재도전 카드 불변식 모델 검증):

```js
// CHAIN DEAL 골드 경제 단위 검증 · 실행: node tools/economy-check.cjs
// ⚠️ index.html 의 goldEarned/spillover/재도전 회수 로직을 복제 검증 (드리프트 시 동기화).
let fail=0; const ok=(n,c)=>{ console.log((c?"✅":"❌")+" "+n); if(!c) fail++; };

const GOLD_BASE=2, GOLD_K=10;
const goldEarned=(s,t)=>Math.floor(GOLD_BASE + Math.max(0, s/t - 1)*GOLD_K);
const spillover=g=>Math.floor(g*0.1);

// 1) 환전 공식
ok("간당간당(목표=점수) → BASE", goldEarned(150,150)===2);
ok("50% 초과 → 7", goldEarned(225,150)===7);
ok("100% 초과 → 12", goldEarned(300,150)===12);
ok("미달도 음수 안 됨(클램프)", goldEarned(100,150)===2);

// 2) 스필오버 1/10 내림
ok("스필오버 23골드 → 2", spillover(23)===2);
ok("스필오버 9골드 → 0", spillover(9)===0);

// 3) 재도전 카드 불변식: row/hand는 settle에서 회수됨 → deck+discard 전량 회수 시 총량 보존
function retryRecollect(piles){ // {deck,discard,row,hand} (row/hand 빈 상태 가정)
  const total=piles.deck.length+piles.discard.length+piles.row.length+piles.hand.length;
  const deck=piles.deck.concat(piles.discard); const discard=[];
  return { total, after: deck.length+discard.length+piles.row.length+piles.hand.length };
}
{ const r=retryRecollect({deck:Array(18).fill(0),discard:Array(14).fill(0),row:[],hand:[]});
  ok("재도전 회수 후 카드 총량 보존(32)", r.total===32 && r.after===32); }

console.log(fail?`\n❌ ${fail} 실패`:"\n✅ 전체 통과");
process.exit(fail?1:0);
```

- [ ] **Step 2:** Run: `node tools/economy-check.cjs` → Expected: `✅ 전체 통과`.
- [ ] **Step 3:** Commit: `... -m "test: economy-check.cjs 골드 환전/스필오버/재도전 불변식 (9/9)"`

---

### Task 10: run-sim.cjs 골드 경제 이식

**Files:** Modify `tools/run-sim.cjs` (상수, `runFull`, `applyShop`)

- [ ] **Step 1:** 상수 추가(상단 STRATS 위):

```js
const GOLD_BASE=2, GOLD_K=10;
const goldEarned=(s,t)=>Math.floor(GOLD_BASE + Math.max(0, s/t - 1)*GOLD_K);
function costOf(o){ if(o.type==="charm") return 8; if(o.type==="enh") return o.enh==="wild"?8:5; if(o.type==="hand") return 8; if(o.type==="thin"||o.type==="add") return 3; return 5; } // copy/mult/gold/reroll=5
```

- [ ] **Step 2:** 기존 `applyShop` 의 품목 적용부를 `applyOne` 으로 분리 + 멀티구매로 교체:

```js
function applyOne(state, o, strat){
  const d=state.deck;
  if(o.type==="charm") state.owned.push(o.id);
  else if(o.type==="hand") state.bonusHand++;
  else if(o.type==="reroll") {}
  else if(o.type==="thin") { if(d.length>20) d.splice(ri(d.length),1); }
  else if(o.type==="copy") { if(d.length<60){ const c=d[ri(d.length)]; d.push({suit:c.suit,rank:c.rank,enh:c.enh}); } }
  else if(o.type==="add") { const suit=strat==="flush"?1:strat==="black"?(ri(2)?0:3):ri(4); d.push({suit,rank:7+ri(2),enh:null}); }
  else if(o.type==="enh") { let idx=ri(d.length); if(strat==="flush"){ const c=d.findIndex(x=>x.suit===1&&!x.enh); if(c>=0) idx=c; } d[idx]={...d[idx],enh:o.enh}; }
}
function applyShop(state, strat){
  const offers=shuffle(shopPool(state)).slice(0,3).map(o=>({o,pr:priority(o,strat),cost:costOf(o)}));
  offers.sort((a,b)=>b.pr-a.pr);                       // 우선순위 높은 것부터
  for(const it of offers){ if(state.gold>=it.cost){ state.gold-=it.cost; applyOne(state,it.o,strat); } }   // 살 수 있는 만큼 구매
}
```

- [ ] **Step 3:** `runFull` 에 골드 상태+환전 추가:

```js
function runFull(strat){
  const state={deck:starterDeck(), owned:[], bonusHand:0, gold:0};
  for(let ante=1;ante<=8;ante++){
    for(let blind=0;blind<=2;blind++){
      const boss=blind===2?pickBoss(ante):null;
      let target=blindTarget(ante,blind); if(boss) target=Math.round(target*boss.tmult);
      const handN=(boss&&boss.id==="stingy"?2:3)+state.bonusHand;
      const sc=playRound(state.deck, state.owned, boss?boss.id:null, handN, ante);
      if(sc<target) return {result:"death", ante, blind};
      state.gold += goldEarned(sc, target);            // 통과 환전
      if(ante===8&&blind===2) return {result:"win"};
      applyShop(state, strat);
    }
  }
  return {result:"win"};
}
```

- [ ] **Step 4:** Run: `node tools/run-sim.cjs` → 5전략 출력. (수치는 Task 11에서 평가)
- [ ] **Step 5:** Commit: `... -m "feat: run-sim 골드 경제 이식(환전+멀티구매) (sim)"`

---

### Task 11: 캘리브레이션 — 기준선 보존

**Files:** Modify `prototype/index.html`(GOLD_BASE/GOLD_K + shopPool cost), `tools/run-sim.cjs`(GOLD_BASE/GOLD_K + costOf) **동기화 필수**

- [ ] **Step 1:** Task 10 결과를 Task 0 기준선과 비교. 목표: 각 전략 클리어율이 **무료 기준선 대비 −10%p 이내**(과도하게 어려워지지 않음), balance 전략이 대략 "잘하면 깸" 영역 유지.
- [ ] **Step 2:** 너무 어려우면(골드 부족) `GOLD_BASE` ↑ 또는 가격 ↓; 너무 쉬우면(다 사버림) `GOLD_K`↓·`GOLD_BASE`↓ 또는 가격↑. **index.html과 run-sim.cjs 양쪽 동일하게** 조정.
- [ ] **Step 3:** `node tools/run-sim.cjs` 재실행해 수렴 확인. `node tools/economy-check.cjs` 의 기대값(50%초과=7 등)이 바뀌면 그 테스트도 같이 갱신.
- [ ] **Step 4:** `node tools/balance-check.cjs` → 문법 OK + 단일라운드 기준선(작은~90/큰~80/보스55~72) **불변** 확인(골드 무관해야 정상).
- [ ] **Step 5:** Commit: `... -m "balance: 골드 경제 캘리브 — 기준선 보존 (BASE/K/가격 확정)"`

---

### Task 12: 문서 갱신

**Files:** Modify `HANDOVER.md`, `docs/PLAN.md`, `CLAUDE.md`

- [ ] **Step 1:** `HANDOVER.md`: 버전 → v3.16, §7 🥉 아래에 "✅ 골드 경제 구현(v3.16)" 한 줄 + 확정 파라미터(BASE/K/가격/스필오버) 기록. "다음 할 일" 갱신.
- [ ] **Step 2:** `docs/PLAN.md`: 헤더 vX.16, **C2** 를 `[x]` 로 + 한 줄 요약(골드 유료상점·스필오버·메타3종).
- [ ] **Step 3:** `CLAUDE.md`: "점수 공식 / 파라미터" 절에 골드 경제(환전·시작골드·메타) 추가, "규칙 중복 드리프트" 절에 **economy-check.cjs + run-sim 골드 동기화** 추가(balance-check은 골드 무관 명시).
- [ ] **Step 4:** Commit: `... -m "docs: 골드 경제 v3.16 — HANDOVER/PLAN/CLAUDE 갱신"`

---

### Task 13: 최종 검증 + 배포

- [ ] **Step 1:** `node tools/balance-check.cjs` (문법+기준선) / `node tools/economy-check.cjs` (단위) / `node tools/run-sim.cjs` (경제) 셋 다 통과.
- [ ] **Step 2:** 브라우저로 `prototype/index.html` 열어 스모크: 빈 localStorage → 골드 0 시작, 블라인드 통과 시 골드 증가, 상점 유료 구매(골드 차감/품절), 패배 시 재도전권 0이라 버튼 없음, 런 종료 후 🪙 상점에 코인 적립 확인. (수동 1분)
- [ ] **Step 3:** `git push origin main` → GitHub Pages 자동 배포. (hang 시 HANDOVER §2 gh 토큰 helper)
- [ ] **Step 4:** `gh api repos/kkp8121-rgb/chain-deal/pages/builds/latest` 로 배포 빌드 확인.

---

## Self-Review (스펙 대조)

- **스펙 §3 환전(A안)** → Task 2(goldEarned)·5(통과 환전). ✅
- **§4 유료 상점+티어** → Task 7(shopPool cost+멀티구매). ✅
- **§5 스필오버+메타 상점+재도전** → Task 5(cashOut)·6(useRetry)·8(metaHTML/buyMeta). ✅
- **§6 데이터** → Task 1(getMeta/saveMeta)·3(newGame). ✅
- **§8 DoD/sim** → Task 9(economy-check)·10(run-sim)·11(캘리브)·13(검증). ✅
- **정정**: 스펙 §8.1 "balance-check 골드 게이팅" → balance-check은 단일라운드라 골드 무관. 골드 모델은 run-sim 전용, balance-check은 문법+기준선 가드 유지(Task 11.4, 12.3에 명시).
- **타입 일관성**: `META_PRICE.gold[]`/`reroll[]` 인덱스 = 현재 Lv(0-base), `goldEarned(score,target)`·`spillover(gold)` 시그니처 index.html↔run-sim↔economy-check 동일. `S.gold`/`S.retry`/`S.shopOffers` 신규 필드 명명 일관.
- **플레이스홀더 스캔**: 없음(모든 수치는 캘리브 초기값으로 명시, Task 11에서 확정).

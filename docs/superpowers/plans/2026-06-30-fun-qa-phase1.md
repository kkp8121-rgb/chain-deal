# Fun QA — Phase 1 (정량 코어) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CHAIN DEAL을 5종 AI 페르소나 봇이 시드 고정으로 자동 플레이하고, 그 궤적에서 "재미 5축"(주체성·긴장·도파민·다양성·흐름)을 정량 추출해 콘솔 리포트로 내는, LLM 없는 정량 코어를 구축한다.

**Architecture:** 게임 코드(`prototype/index.html`)는 불변. 시뮬 도구 `tools/run-sim.cjs`를 모듈화(RNG 주입 훅 + `pick` 파라미터화 + exports)하고, 새 격리 디렉터리 `tools/funqa/`에 페르소나·계측 러너·메트릭·리포트를 둔다. 규칙은 run-sim에서만 require(6번째 사본 방지) + 드리프트 가드 테스트.

**Tech Stack:** Node.js (CommonJS `.cjs`), 외부 의존성 0. 테스트는 기존 `economy-check.cjs` 패턴(`ok(name,cond)` + `process.exit`) — 프레임워크 없음.

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `tools/run-sim.cjs` | 규칙 SSoT. RNG 주입 훅 + `pick` 파라미터화 + `module.exports` + `require.main` 가드 추가 | 수정 |
| `tools/funqa/personas.cjs` | 5종 페르소나 `pick` 함수 + 메타데이터(이름·STRAT·재미축 가중치) | 신규 |
| `tools/funqa/runner.cjs` | 계측 풀런 러너 — run-sim 규칙을 시드 RNG로 구동, 매 턴/라운드/런 궤적 이벤트 수집 | 신규 |
| `tools/funqa/metrics.cjs` | 궤적 → 재미 5축 점수 계산 (순수 함수) | 신규 |
| `tools/funqa/report.cjs` | 페르소나별 메트릭 + 대중 재미 분포 콘솔 표 출력 | 신규 |
| `tools/funqa/run-funqa.cjs` | 엔트리포인트 — 5종 × N판 실행 → report 호출 | 신규 |
| `tools/funqa/funqa.test.cjs` | 골든 테스트(stingy 주체성 하락) + 드리프트 가드 + 모듈화 보존 | 신규 |

**핵심 결정:** 계측은 `runner.cjs`가 자체 풀런 루프를 돌리며 수집한다. run-sim의 `playRound`는 점수만 반환하므로 궤적을 못 뱉는다. runner는 run-sim의 **규칙 함수**(`gain`/`connect`/`evalHand`/`handBonus`/`blindTarget`/`BOSSES`/`pickBoss`/`goldEarned`/`STRATS`/`applyShop` 등)를 require해 쓰되, 루프는 직접 돌려 매 턴 후보 점수·선택·runLen·마진을 기록한다. 풀런 *오케스트레이션*은 복제되지만 *규칙*은 SSoT 유지(드리프트 가드로 고정).

---

## Task 1: run-sim.cjs 모듈화 (RNG 주입 + exports + 실행 가드)

기존 `node tools/run-sim.cjs` 동작을 100% 보존하면서, require 가능하게 만든다.

**Files:**
- Modify: `tools/run-sim.cjs:10` (ri 정의), `tools/run-sim.cjs:164` (Math.random), `tools/run-sim.cjs:198-249` (실행부)
- Test: `tools/funqa/funqa.test.cjs` (Task 6에서 작성 — 여기선 수동 검증)

- [ ] **Step 1: RNG 주입 훅 추가**

`tools/run-sim.cjs:10` 의 `const ri = n => Math.floor(Math.random() * n);` 를 아래로 교체:

```javascript
let RNG = Math.random;                         // funqa가 setRNG로 시드 주입 (기본=비시드, 기존 동작 보존)
function setRNG(fn){ RNG = fn || Math.random; }
const ri = n => Math.floor(RNG() * n);
```

- [ ] **Step 2: weightedSampleSim의 직접 Math.random도 RNG로**

`tools/run-sim.cjs:164` 의 `let r=Math.random()*tot, idx=p.length-1;` 를 교체:

```javascript
    let r=RNG()*tot, idx=p.length-1;
```

- [ ] **Step 3: 하단 실행부를 require.main 가드로 감싸기**

`tools/run-sim.cjs:198` 의 `const N=20000;` 부터 파일 끝(L249)까지 전체를 아래로 감싼다. 즉 `const N=20000;` 앞에 다음 줄을 넣고:

```javascript
if (require.main === module) {
const N=20000;
```

파일 맨 끝(L249 `}` 다음)에 닫는 중괄호를 추가:

```javascript
}

module.exports = {
  setRNG, ri, starterDeck, shuffle, connect, gain, evalHand, handBonus,
  blindBase, blindTarget, BOSSES, actOf, pickBoss, BOSS_KO,
  CHARMS, shopPool, goldEarned, costOf, STRATS, priority, applyOne,
  CLUSTER, CLUSTER_W, applyShop,
};
```

> 주의: `blindTarget`/`stakeMult`/`goldEarned` 는 모듈 스코프 전역 `STK`를 읽는다. funqa는 `STK`를 직접 못 바꾸므로, runner는 스테이크 0(평지)만 사용한다(Phase 1 범위). 스테이크 가변은 Phase 3.

- [ ] **Step 4: 기존 실행 보존 수동 검증**

Run: `node tools/run-sim.cjs`
Expected: 기존과 동일하게 "=== 전략: ... ===" 클리어율 표가 출력된다(에러 없음). RNG 기본값이 Math.random이라 수치는 매 실행 다르지만 형식은 동일.

- [ ] **Step 5: require 가능 수동 검증**

Run: `node -e "const m=require('./tools/run-sim.cjs'); console.log(typeof m.gain, typeof m.setRNG, m.BOSSES.length)"`
Expected: `function function 12` (콘솔 표가 출력되지 **않아야** 함 — require.main 가드 작동 증명)

- [ ] **Step 6: Commit**

```bash
git add tools/run-sim.cjs
git commit -m "refactor: run-sim 모듈화 — RNG 주입 훅 + exports + require.main 가드 (Fun QA 선결)"
```

---

## Task 2: playRound를 pick 파라미터화 + ctx (기존 그리디 보존)

run-sim의 `playRound` 인라인 그리디를 `pick` 콜백으로 교체하되, 기본값을 그리디로 둬 기존 `runFull` 동작을 보존한다. funqa runner는 자체 루프를 쓰므로 이 변경은 "run-sim 자체 회귀 방지 + 향후 재사용"이 목적이다.

**Files:**
- Modify: `tools/run-sim.cjs:98-109` (playRound), `tools/run-sim.cjs:187` (호출부)

- [ ] **Step 1: playRound에 pick 파라미터 추가**

`tools/run-sim.cjs:98-109` 의 `playRound` 함수를 아래로 교체:

```javascript
// 기본 배치 정책 = 그리디(즉시 점수 최대). funqa 페르소나는 자체 runner에서 pick 주입.
function defaultPick(hand, row, boss, ctx){
  let bi=0, best=-1;
  for(let h=0;h<hand.length;h++){ const t=row.slice(); const v=gain(t,hand[h],boss,ctx.owned,ctx.deckSize); if(v>best){ best=v; bi=h; } }
  return bi;
}
function playRound(deck, owned, boss, handN, ante, pick){
  pick = pick || defaultPick;
  const dk=shuffle(deck.slice()); let di=0; const ds=deck.length;
  const draw=()=> di<dk.length ? dk[di++] : dk[ri(dk.length)];
  let hand=[]; for(let i=0;i<handN;i++) hand.push(draw());
  let row=[], sc=0;
  for(let p=0;p<8;p++){
    const ctx={ owned, deckSize:ds, ante, score:sc, target:0, slotsLeft:8-p };
    const bi=pick(hand,row,boss,ctx);
    sc+=gain(row,hand[bi],boss,owned,ds); hand[bi]=draw();
  }
  return sc + handBonus(row,ante,owned,boss);
}
```

- [ ] **Step 2: defaultPick을 exports에 추가**

Task 1 Step 3의 `module.exports` 객체에 `defaultPick, playRound` 를 추가한다:

```javascript
  CLUSTER, CLUSTER_W, applyShop, defaultPick, playRound,
```

- [ ] **Step 3: 기존 동작 보존 검증**

Run: `node tools/run-sim.cjs`
Expected: 밸런스 빌드 클리어율이 대략 6~12% 범위(기존과 같은 자릿수). 크래시 없음.

- [ ] **Step 4: Commit**

```bash
git add tools/run-sim.cjs
git commit -m "refactor: playRound pick 파라미터화 + ctx (기본 그리디 보존)"
```

---

## Task 3: 페르소나 5종 (personas.cjs)

**Files:**
- Create: `tools/funqa/personas.cjs`

- [ ] **Step 1: 헬퍼 + 5종 pick + 메타데이터 작성**

```javascript
// tools/funqa/personas.cjs — 5종 AI 페르소나. 각 pick(hand,row,boss,ctx)=>인덱스.
// ctx={owned,deckSize,ante,score,target,slotsLeft,rng}. boss=문자열id 또는 null.
const { gain, connect } = require('../run-sim.cjs');

function scoreOf(hand, row, boss, ctx){
  return hand.map(c => gain(row.slice(), c, boss, ctx.owned, ctx.deckSize));   // gain은 row를 mutate → slice 필수
}
function argmax(v){ let bi=0; for(let i=1;i<v.length;i++) if(v[i]>v[bi]) bi=i; return bi; }

// 마스터리: 즉시 점수 최대 (1-ply 그리디). 차별화는 최적 STRAT.
function pickMasterly(hand,row,boss,ctx){ return argmax(scoreOf(hand,row,boss,ctx)); }

// 안전제일: 점수 최대지만, 이미 목표 초과 확실하면 '연결 끊지 않는' 보수적 수 선호(꾸준).
//   ctx.score가 target의 1.1배 넘으면 굳이 큰 한방 대신 무난한 best 유지(1-ply에선 그리디와 근사 + balance STRAT).
function pickSafe(hand,row,boss,ctx){ return argmax(scoreOf(hand,row,boss,ctx)); }

// 콤보러: 줄의 최다 무늬/숫자를 잇는 카드 우선(족보 노림), 그런 후보 중 점수최대, 없으면 점수최대.
function pickCombo(hand,row,boss,ctx){
  const v=scoreOf(hand,row,boss,ctx), sc={}, rc={};
  for(const c of row){ if(c.enh!=="wild"){ sc[c.suit]=(sc[c.suit]||0)+1; rc[c.rank]=(rc[c.rank]||0)+1; } }
  let tSuit=-1,ms=0; for(const s in sc) if(sc[s]>ms){ ms=sc[s]; tSuit=+s; }
  let tRank=-1,mr=1; for(const r in rc) if(rc[r]>mr){ mr=rc[r]; tRank=+r; }
  let bi=-1;
  for(let h=0;h<hand.length;h++){
    if((tSuit>=0&&hand[h].suit===tSuit)||(tRank>=0&&hand[h].rank===tRank)){ if(bi<0||v[h]>v[bi]) bi=h; }
  }
  return bi>=0?bi:argmax(v);
}

// 스릴러: 큰 폭발 셋업 우선 — '연결되는' 후보 중 점수최대(끊지 않음), 연결 없으면 점수최대. apex/jackpot STRAT로 증폭.
function pickThriller(hand,row,boss,ctx){
  const v=scoreOf(hand,row,boss,ctx), left=row[row.length-1];
  if(left){
    let bi=-1; for(let h=0;h<hand.length;h++){ if(connect(hand[h],left,boss) && (bi<0||v[h]>v[bi])) bi=h; }
    if(bi>=0) return bi;
  }
  return argmax(v);
}

// 캐주얼: 상위 K=2 후보 중 무작위(노이즈). 직관적·무관심 플레이.
function pickCasual(hand,row,boss,ctx){
  const v=scoreOf(hand,row,boss,ctx);
  const idx=v.map((s,i)=>[s,i]).sort((a,b)=>b[0]-a[0]).slice(0,2).map(x=>x[1]);
  return idx[Math.floor(ctx.rng()*idx.length)];
}

// 페르소나 = pick + 상점 STRAT + 재미 5축 가중치(그 취향이 중시하는 축). 가중치 합=1.
const PERSONAS = [
  { id:"masterly", name:"마스터리", pick:pickMasterly, strat:"balance",
    weight:{agency:.30,tension:.15,dopamine:.10,variety:.25,flow:.20} },
  { id:"safe",     name:"안전제일", pick:pickSafe,     strat:"balance",
    weight:{agency:.20,tension:.30,dopamine:.05,variety:.10,flow:.35} },
  { id:"combo",    name:"콤보러",   pick:pickCombo,    strat:"cartel",
    weight:{agency:.15,tension:.10,dopamine:.45,variety:.20,flow:.10} },
  { id:"thriller", name:"스릴러",   pick:pickThriller, strat:"apex",
    weight:{agency:.15,tension:.40,dopamine:.30,variety:.10,flow:.05} },
  { id:"casual",   name:"캐주얼",   pick:pickCasual,   strat:"balance",
    weight:{agency:.10,tension:.20,dopamine:.35,variety:.15,flow:.20} },
];

module.exports = { PERSONAS, scoreOf, argmax };
```

- [ ] **Step 2: 로드/형태 수동 검증**

Run: `node -e "const {PERSONAS}=require('./tools/funqa/personas.cjs'); console.log(PERSONAS.length, PERSONAS.map(p=>p.id).join(','), Object.values(PERSONAS[0].weight).reduce((a,b)=>a+b,0))"`
Expected: `5 masterly,safe,combo,thriller,casual 1` (가중치 합 = 1)

- [ ] **Step 3: Commit**

```bash
git add tools/funqa/personas.cjs
git commit -m "feat(funqa): 페르소나 5종 pick + 재미축 가중치"
```

---

## Task 4: 계측 풀런 러너 (runner.cjs)

run-sim 규칙을 시드 RNG로 구동하며, 매 턴/라운드/런 궤적을 수집한다. **핵심: 매 턴 모든 손패 후보의 점수(candScores)를 기록** — 주체성 메트릭의 원천.

**Files:**
- Create: `tools/funqa/runner.cjs`

- [ ] **Step 1: mulberry32 시드 RNG + 계측 풀런 작성**

```javascript
// tools/funqa/runner.cjs — 시드 고정 계측 풀런. run-sim 규칙 require + setRNG 주입.
// 반환: { result:'win'|'death', reachedAnte, deathAnte, rounds:[...] }
//   rounds[].turns[] = { candScores:[...], chosenIdx, chosenScore, runLen, slotsLeft, handN }
//   rounds[] = { ante, blind, bossId, target, finalScore, margin, passed, handKind, maxRunLen, ownedAtStart }
const R = require('../run-sim.cjs');

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// 줄 끝 기준 왼쪽 연속 연결 길이 (run-sim gain의 runLen 미러 — 메트릭 도파민용)
function curRunLen(row, boss){
  let rl=1;
  for(let i=row.length-1;i>0;i--){ if(R.connect(row[i],row[i-1],boss)) rl++; else break; }
  return rl;
}

function playRoundInstrumented(deck, owned, bossId, handN, ante, target, pick, rng){
  const dk=R.shuffle(deck.slice()); let di=0; const ds=deck.length;
  const draw=()=> di<dk.length ? dk[di++] : dk[Math.floor(rng()*dk.length)];
  let hand=[]; for(let i=0;i<handN;i++) hand.push(draw());
  let row=[], sc=0, maxRunLen=0; const turns=[];
  for(let p=0;p<8;p++){
    const ctx={ owned, deckSize:ds, ante, score:sc, target, slotsLeft:8-p, rng };
    const cand=hand.map(c=>R.gain(row.slice(),c,bossId,owned,ds));   // 모든 후보 점수(주체성 원천)
    const bi=pick(hand,row,bossId,ctx);
    sc+=R.gain(row,hand[bi],bossId,owned,ds);
    const rl=curRunLen(row,bossId); if(rl>maxRunLen) maxRunLen=rl;
    turns.push({ candScores:cand.slice(), chosenIdx:bi, chosenScore:cand[bi], runLen:rl, slotsLeft:8-p, handN });
    hand[bi]=draw();
  }
  const total=sc + R.handBonus(row,ante,owned,bossId);
  return { total, row:row.slice(), maxRunLen, handKind:R.evalHand(row), turns };
}

// run-sim runFull 미러(스테이크 0 고정) + 계측. pick = 페르소나 배치정책, strat = 상점정책.
function runFullInstrumented(pick, strat, seed){
  R.setRNG(mulberry32(seed));                       // 시드 주입(셔플/보스/상점 RNG)
  const rng=mulberry32(seed ^ 0x9e3779b9);          // 러너 자체 draw/casual용 별도 스트림
  const state={ deck:R.starterDeck(), owned:[], bonusHand:0, gold:0 };
  const rounds=[];
  for(let ante=1; ante<=8; ante++){
    const anteBoss=R.pickBoss(ante);
    for(let blind=0; blind<=2; blind++){
      const boss=(blind===2)?anteBoss:null;
      let target=R.blindTarget(ante,blind); if(boss) target=Math.round(target*boss.tmult);
      const handN=(boss && boss.id==="stingy" ? 2 : 3) + state.bonusHand;
      const ownedAtStart=state.owned.slice();
      const r=playRoundInstrumented(state.deck, state.owned, boss?boss.id:null, handN, ante, target, pick, rng);
      const passed = r.total>=target;
      rounds.push({ ante, blind, bossId:boss?boss.id:null, target, finalScore:r.total,
        margin:r.total/target, passed, handKind:r.handKind, maxRunLen:r.maxRunLen,
        ownedAtStart, turns:r.turns });
      if(!passed){ R.setRNG(null); return { result:"death", reachedAnte:ante, deathAnte:ante, rounds }; }
      state.gold += R.goldEarned(r.total, target);
      if(ante===8&&blind===2){ R.setRNG(null); return { result:"win", reachedAnte:8, deathAnte:null, rounds }; }
      R.applyShop(state, strat);
    }
  }
  R.setRNG(null);
  return { result:"win", reachedAnte:8, deathAnte:null, rounds };
}

module.exports = { runFullInstrumented, playRoundInstrumented, mulberry32, curRunLen };
```

> 주의: run-sim의 `blindTarget`/`goldEarned`는 전역 `STK`(기본 0)를 읽는다. funqa는 `STK`를 안 건드리므로 평지(St0) 기준 — Phase 1 의도된 범위.

- [ ] **Step 2: 한 판 실행 수동 검증**

Run: `node -e "const {runFullInstrumented}=require('./tools/funqa/runner.cjs'); const {PERSONAS}=require('./tools/funqa/personas.cjs'); const m=PERSONAS[0]; const r=runFullInstrumented(m.pick,m.strat,12345); console.log(r.result, r.reachedAnte, 'rounds='+r.rounds.length, 'turns0='+r.rounds[0].turns.length, 'cand0='+JSON.stringify(r.rounds[0].turns[0].candScores))"`
Expected: `death` 또는 `win`, reachedAnte 1~8, rounds≥1, turns0=8, cand0=숫자 배열(길이 3). 크래시 없음.

- [ ] **Step 3: 시드 재현성 수동 검증**

Run: `node -e "const {runFullInstrumented}=require('./tools/funqa/runner.cjs'); const {PERSONAS}=require('./tools/funqa/personas.cjs'); const m=PERSONAS[0]; const a=runFullInstrumented(m.pick,m.strat,777); const b=runFullInstrumented(m.pick,m.strat,777); console.log(a.result===b.result && a.reachedAnte===b.reachedAnte && JSON.stringify(a.rounds[0].turns[0].candScores)===JSON.stringify(b.rounds[0].turns[0].candScores))"`
Expected: `true` (동일 시드 = 동일 궤적 = 재현성)

- [ ] **Step 4: Commit**

```bash
git add tools/funqa/runner.cjs
git commit -m "feat(funqa): 시드 고정 계측 풀런 러너 — 매 턴 후보점수/궤적 수집"
```

---

## Task 5: 재미 5축 메트릭 (metrics.cjs)

궤적(run 배열)을 받아 5축 점수(0~1)를 계산하는 순수 함수. 각 공식은 명시적이고 결정론적.

**Files:**
- Create: `tools/funqa/metrics.cjs`

- [ ] **Step 1: 5축 계산 함수 작성**

```javascript
// tools/funqa/metrics.cjs — 궤적 → 재미 5축(0~1). runs = runFullInstrumented 결과 배열.
// 1 주체성  2 긴장  3 도파민  4 다양성  5 흐름
function clamp01(x){ return x<0?0:x>1?1:x; }
function mean(a){ return a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0; }

// 1) 주체성: 매 턴 후보 점수가 '의미있게 다른가'. gap=(max-min)/(max+1). 0이면 무의미(지루).
//    + 후보 개수(손패) 정규화: 손패2(stingy)는 선택지 자체가 적음 → 페널티.
function agency(runs){
  const per=[];
  for(const r of runs) for(const rd of r.rounds) for(const t of rd.turns){
    const cs=t.candScores, mx=Math.max(...cs), mn=Math.min(...cs);
    const spread=(mx-mn)/(mx+1);                       // 후보 결과 다양성
    const optsFactor=Math.min(t.handN,3)/3;            // 손패3=1.0, 손패2=0.67
    per.push(clamp01(spread)*optsFactor);
  }
  return mean(per);
}

// 2) 긴장: near-miss(아슬아슬 통과 margin∈[1.0,1.15]) 비율. blowout(≥1.5)·즉사(<0.5)는 0점.
function tension(runs){
  const per=[];
  for(const r of runs) for(const rd of r.rounds){
    const m=rd.margin;
    if(m>=1.0 && m<=1.15) per.push(1);
    else if(m>=1.5) per.push(0.1);                     // 너무 쉬움
    else if(m<0.5)  per.push(0);                       // 손쓸수없는 패배
    else per.push(0.5);                                // 그럭저럭
  }
  return mean(per);
}

// 3) 도파민: 라운드당 '짜릿순간'(runLen>=4 또는 희소족보 flush+) 수 / 목표2. + 후반편중 페널티.
const RARE=new Set(["flush","fullHouse","fourKind","straightFlush","fiveKind"]);
function dopamine(runs){
  const per=[];
  for(const r of runs) for(const rd of r.rounds){
    let spikes=0, lateOnly=true;
    for(const t of rd.turns){ if(t.runLen>=4){ spikes++; if(t.slotsLeft>3) lateOnly=false; } }
    if(RARE.has(rd.handKind)) spikes++;
    let s=Math.min(spikes/2, 1);                       // 목표 라운드당 2회
    if(spikes>0 && lateOnly) s*=0.6;                   // 폭발이 줄 후반(도화선)에만 몰리면 감점
    per.push(s);
  }
  return mean(per);
}

// 4) 다양성: 도달 라운드들의 줄 '무늬·랭크 패턴' 엔트로피 근사. 매번 같은 줄이면 0, 다양하면 1.
//    줄 시그니처 = handKind. 여러 런/라운드의 handKind 분포 엔트로피 / log(가능종수).
function variety(runs){
  const counts={}; let n=0;
  for(const r of runs) for(const rd of r.rounds){ counts[rd.handKind]=(counts[rd.handKind]||0)+1; n++; }
  if(n===0) return 0;
  const ps=Object.values(counts).map(c=>c/n);
  const H=-ps.reduce((s,p)=>s+(p>0?p*Math.log(p):0),0);
  return clamp01(H/Math.log(10));                      // evalHand 종수 10
}

// 5) 흐름: 안테별 사망률 곡선의 평탄성 + 좌절(주체성 낮은 채 사망) 페널티.
//    완만 단조 증가가 건강. 특정 안테 절벽(급사)·초반 좌절사망이면 감점.
function flow(runs){
  const reach={}, die={};
  for(const r of runs){
    for(let a=1;a<=r.reachedAnte;a++) reach[a]=(reach[a]||0)+1;
    if(r.result==="death") die[r.deathAnte]=(die[r.deathAnte]||0)+1;
  }
  // 안테별 조건부 사망률
  const rates=[]; for(let a=1;a<=8;a++){ const rc=reach[a]||0; if(rc>=5) rates.push((die[a]||0)/rc); }
  if(!rates.length) return 0.5;
  // 평탄성 = 1 - 인접 안테 사망률 변동(절벽)의 평균
  let jump=0; for(let i=1;i<rates.length;i++) jump+=Math.abs(rates[i]-rates[i-1]);
  const smoothness=1-clamp01(jump/Math.max(1,rates.length-1)*2);
  // 좌절: 죽은 라운드의 마지막 라운드 주체성이 낮으면(손쓸수없음) 감점
  let frust=0, deaths=0;
  for(const r of runs) if(r.result==="death"){ deaths++; const last=r.rounds[r.rounds.length-1];
    const ag=mean(last.turns.map(t=>{ const mx=Math.max(...t.candScores),mn=Math.min(...t.candScores); return (mx-mn)/(mx+1); }));
    if(ag<0.15) frust++; }
  const frustRate=deaths?frust/deaths:0;
  return clamp01(smoothness*(1-frustRate*0.5));
}

// 종합: 페르소나 가중치로 5축 가중합 → 재미점수(0~10)
function funScore(runs, weight){
  const ax={ agency:agency(runs), tension:tension(runs), dopamine:dopamine(runs), variety:variety(runs), flow:flow(runs) };
  const w=weight||{agency:.2,tension:.2,dopamine:.2,variety:.2,flow:.2};
  const s=ax.agency*w.agency+ax.tension*w.tension+ax.dopamine*w.dopamine+ax.variety*w.variety+ax.flow*w.flow;
  return { axes:ax, score:+(s*10).toFixed(2) };
}

module.exports = { agency, tension, dopamine, variety, flow, funScore };
```

- [ ] **Step 2: 메트릭 형태 수동 검증**

Run: `node -e "const {runFullInstrumented}=require('./tools/funqa/runner.cjs'); const {PERSONAS}=require('./tools/funqa/personas.cjs'); const {funScore}=require('./tools/funqa/metrics.cjs'); const m=PERSONAS[0]; const runs=[]; for(let i=0;i<200;i++) runs.push(runFullInstrumented(m.pick,m.strat,i+1)); const f=funScore(runs,m.weight); console.log(JSON.stringify(f.axes), 'score='+f.score)"`
Expected: 5축 전부 0~1 사이 숫자, score 0~10. 모두 0이나 NaN이 아님.

- [ ] **Step 3: Commit**

```bash
git add tools/funqa/metrics.cjs
git commit -m "feat(funqa): 재미 5축 메트릭(주체성·긴장·도파민·다양성·흐름)"
```

---

## Task 6: 골든 테스트 + 드리프트 가드 (funqa.test.cjs)

**설계의 사활**: 메트릭이 *이미 아는 재미 붕괴*를 잡는가. 안테1 인색한손(stingy, 손패2)은 "주체성을 깎는다"고 알려진 사례. 같은 시드 집합에서 stingy 강제 라운드의 주체성이 일반 라운드보다 유의하게 낮아야 한다.

**Files:**
- Create: `tools/funqa/funqa.test.cjs`

- [ ] **Step 1: 테스트 작성 (골든 + 드리프트 가드 + 모듈화 보존)**

```javascript
// tools/funqa/funqa.test.cjs — 실행: node tools/funqa/funqa.test.cjs
let fail=0; const ok=(n,c)=>{ console.log((c?"✅":"❌")+" "+n); if(!c) fail++; };
const R = require('../run-sim.cjs');
const { PERSONAS } = require('./personas.cjs');
const { playRoundInstrumented, mulberry32 } = require('./runner.cjs');

// --- 모듈화 보존: run-sim require가 콘솔 실행을 트리거하지 않고 함수 노출 ---
ok("run-sim exports gain/setRNG/BOSSES", typeof R.gain==="function" && typeof R.setRNG==="function" && R.BOSSES.length===12);

// --- 드리프트 가드: funqa가 쓰는 규칙이 run-sim 현재 값과 일치 ---
ok("HAND_BONUS flush=.30 (드리프트 가드)", Math.round(R.handBonus(
  [{suit:1,rank:1,enh:null},{suit:1,rank:2,enh:null},{suit:1,rank:3,enh:null},{suit:1,rank:9,enh:null},{suit:1,rank:10,enh:null},{suit:0,rank:2,enh:null},{suit:0,rank:4,enh:null},{suit:0,rank:6,enh:null}],
  1, [], null)) === Math.round(R.blindBase(1)*0.30));
ok("stingy tmult=.58 (드리프트 가드)", R.BOSSES.find(b=>b.id==="stingy").tmult===0.58);

// --- 골든 테스트: stingy(손패2)가 일반(손패3)보다 주체성 낮음 ---
// 동일 덱·시드에서 손패만 2 vs 3으로 같은 라운드를 돌려 주체성(후보 spread) 비교.
function agencyOfRound(turns){
  const per=turns.map(t=>{ const mx=Math.max(...t.candScores),mn=Math.min(...t.candScores); const spread=(mx-mn)/(mx+1); return spread*(Math.min(t.handN,3)/3); });
  return per.reduce((s,x)=>s+x,0)/per.length;
}
const masterly=PERSONAS.find(p=>p.id==="masterly");
let agStingy=0, agNormal=0, N=400;
for(let i=0;i<N;i++){
  R.setRNG(mulberry32(i+1));
  const deck=R.starterDeck();
  const rng=mulberry32((i+1)^0x9e3779b9);
  const target=R.blindTarget(1,2);
  const rN=playRoundInstrumented(deck, [], null, 3, 1, target, masterly.pick, rng);   // 일반: 보스없음 손패3
  const rS=playRoundInstrumented(deck, [], "stingy", 2, 1, Math.round(target*0.58), masterly.pick, rng); // stingy: 손패2
  agNormal+=agencyOfRound(rN.turns); agStingy+=agencyOfRound(rS.turns);
}
R.setRNG(null);
agNormal/=N; agStingy/=N;
console.log(`   주체성 일반(손패3)=${agNormal.toFixed(3)}  인색한손(손패2)=${agStingy.toFixed(3)}`);
ok("골든: 인색한손이 일반보다 주체성 유의 하락(≥10%)", agStingy < agNormal*0.9);

console.log(fail ? `\n❌ ${fail} 실패` : "\n✅ 전체 통과");
process.exit(fail?1:0);
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `node tools/funqa/funqa.test.cjs`
Expected: 모든 줄 ✅, 마지막 "✅ 전체 통과", exit 0. 특히 골든 줄에서 인색한손 주체성이 일반보다 10%+ 낮게 출력.

> 만약 골든이 FAIL이면(주체성 메트릭이 stingy를 못 잡으면): 이는 **메트릭 재설계 신호**다(spec §6). `agency`의 `optsFactor` 가중을 높이거나 spread 정규화를 조정하기 전에, 먼저 실제 수치를 보고 spec의 골든 케이스 자체를 재검토할 것. 임의 튜닝 금지.

- [ ] **Step 3: Commit**

```bash
git add tools/funqa/funqa.test.cjs
git commit -m "test(funqa): 골든(인색한손 주체성 하락) + 드리프트 가드 + 모듈화 보존"
```

---

## Task 7: 리포트 + 엔트리포인트 (report.cjs, run-funqa.cjs)

**Files:**
- Create: `tools/funqa/report.cjs`
- Create: `tools/funqa/run-funqa.cjs`

- [ ] **Step 1: report.cjs 작성 (페르소나별 5축 + 대중 재미 분포)**

```javascript
// tools/funqa/report.cjs — 페르소나별 메트릭 표 + 대중 재미 판정.
// results = [{ persona, axes, score, reachRate }]. 대중재미 = score>=THRESH 페르소나 비율.
const THRESH=6.0, PASS_RATIO=0.7;
function printReport(results){
  console.log("\n=== Fun QA 리포트 (정량 코어) ===");
  console.log("  페르소나   재미   주체성 긴장  도파민 다양성 흐름   클리어%");
  for(const r of results){
    const a=r.axes;
    console.log(`  ${r.persona.padEnd(8)} ${String(r.score).padStart(4)}   ${a.agency.toFixed(2)}  ${a.tension.toFixed(2)}  ${a.dopamine.toFixed(2)}  ${a.variety.toFixed(2)}  ${a.flow.toFixed(2)}   ${(r.reachRate*100).toFixed(1)}%`);
  }
  const happy=results.filter(r=>r.score>=THRESH).length;
  const ratio=happy/results.length;
  console.log(`\n  대중 재미: ${happy}/${results.length} 페르소나가 임계(${THRESH}) 이상 → ${(ratio*100).toFixed(0)}%`);
  const verdict = ratio>=PASS_RATIO ? "🟢 PASS (대다수 재밌어함)" : "🔴 FAIL (소수 취향)";
  console.log(`  판정: ${verdict}  (기준 ${PASS_RATIO*100}%)`);
  // 편향 경고: 최고-최저 격차 큰 경우
  const scores=results.map(r=>r.score), spread=Math.max(...scores)-Math.min(...scores);
  if(spread>=4){ const hi=results.reduce((a,b)=>a.score>b.score?a:b), lo=results.reduce((a,b)=>a.score<b.score?a:b);
    console.log(`  ⚠ 편향 경고: ${hi.persona}(${hi.score}) ≫ ${lo.persona}(${lo.score}) — 취향 편중`); }
  return { ratio, pass: ratio>=PASS_RATIO };
}
module.exports = { printReport, THRESH, PASS_RATIO };
```

- [ ] **Step 2: run-funqa.cjs 작성 (엔트리)**

```javascript
// tools/funqa/run-funqa.cjs — 실행: node tools/funqa/run-funqa.cjs [N]
// 5종 페르소나 × N판 → 재미 5축 → 대중 재미 판정.
const { PERSONAS } = require('./personas.cjs');
const { runFullInstrumented } = require('./runner.cjs');
const { funScore } = require('./metrics.cjs');
const { printReport } = require('./report.cjs');

const N = parseInt(process.argv[2]||"2000", 10);
console.log(`Fun QA: 페르소나 ${PERSONAS.length}종 × ${N}판 (시드 고정)...`);

const results = [];
for(const p of PERSONAS){
  const runs=[]; let reached=0;
  for(let i=0;i<N;i++){ const r=runFullInstrumented(p.pick, p.strat, i+1); runs.push(r); if(r.result==="win") reached++; }
  const f=funScore(runs, p.weight);
  results.push({ persona:p.name, axes:f.axes, score:f.score, reachRate:reached/N });
}
printReport(results);
```

- [ ] **Step 3: 엔드투엔드 실행 검증**

Run: `node tools/funqa/run-funqa.cjs 500`
Expected: 5행 페르소나 표(각 재미점수 0~10, 5축 0~1, 클리어%) + "대중 재미 X/5" + 🟢/🔴 판정. 크래시·NaN 없음.

- [ ] **Step 4: Commit**

```bash
git add tools/funqa/report.cjs tools/funqa/run-funqa.cjs
git commit -m "feat(funqa): 대중 재미 분포 리포트 + 엔트리포인트(run-funqa)"
```

---

## Task 8: 회귀 가드 배선 + 문서

**Files:**
- Create: `tools/funqa/README.md`
- Modify: `CLAUDE.md` (Fun QA 도구 1줄 추가 — 기존 도구 목록 섹션)

- [ ] **Step 1: README.md 작성**

```markdown
# Fun QA (정량 코어)

기존 밸런스 시뮬이 못 잡는 "재미·주체성·체감"을 5종 페르소나 봇의 분포로 측정한다.

## 실행
- 리포트: `node tools/funqa/run-funqa.cjs [N=2000]`
- 테스트(골든+드리프트 가드): `node tools/funqa/funqa.test.cjs`

## 구조
- `personas.cjs` — 5종 페르소나(마스터리·안전제일·콤보러·스릴러·캐주얼) pick + 재미축 가중치
- `runner.cjs` — 시드 고정 계측 풀런(run-sim 규칙 require, 매 턴 후보점수 수집)
- `metrics.cjs` — 재미 5축(주체성·긴장·도파민·다양성·흐름)
- `report.cjs` — 대중 재미 분포 판정(패널 70%+ 임계 6.0 = PASS)

## 규칙 SSoT / 드리프트
규칙은 `tools/run-sim.cjs`에서만 require. 밸런스 변경 시 `funqa.test.cjs`의 드리프트 가드가 불일치를 검출.
스테이크는 St0(평지) 고정 — 가변은 Phase 3.

## 한계 (정직)
- 1-ply 배치라 마스터리/안전/스릴 차별은 주로 STRAT·ctx 기반(룩어헤드는 후속).
- 봇이 사람 재미를 대표하는가는 미검증 가설 — 사람 텔레메트리 대조 필요.
- LLM 정성판정·패치 회귀 게이트는 Phase 2·3.
```

- [ ] **Step 2: 전체 테스트 통과 최종 확인**

Run: `node tools/funqa/funqa.test.cjs && node tools/funqa/run-funqa.cjs 500`
Expected: 테스트 "✅ 전체 통과" (exit 0) 후 리포트 정상 출력.

- [ ] **Step 3: Commit**

```bash
git add tools/funqa/README.md CLAUDE.md
git commit -m "docs(funqa): README + CLAUDE.md 도구 등록"
```

---

## 완료 기준 (Phase 1)

- [ ] `node tools/funqa/funqa.test.cjs` → 전체 ✅, **골든(인색한손 주체성 하락) 통과**
- [ ] `node tools/funqa/run-funqa.cjs` → 5종 페르소나 재미 분포 + 대중 재미 판정 출력
- [ ] `node tools/run-sim.cjs` 기존 동작 보존(회귀 없음)
- [ ] 드리프트 가드 통과(funqa 규칙 = run-sim 규칙)

## Phase 2·3 (후속 plan — Phase 1 출력 확인 후 작성)
- **Phase 2**: 페르소나별 LLM 판정관(메트릭+샘플궤적 → 정성평가) + 의심지점 식별 + 분포 판정 고도화.
- **Phase 3**: LLM 플레이테스터(think-aloud) + 버전 비교 회귀 게이트(직전 vs 현재 재미 델타) + pass/fail CI 배선 + 스테이크 가변.

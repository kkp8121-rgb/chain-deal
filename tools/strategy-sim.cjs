// CHAIN DEAL 전략 시뮬 (족보 밸런싱용)  ·  실행: node tools/strategy-sim.cjs
//
// 목적: "족보를 노리는 플레이"가 그리디(즉시 점수 최대) 대비 유효한 선택지인지 측정.
//   그리디는 족보를 안 노리므로 변별력이 안 보임(balance-check가 그걸 보여줌).
//   여기서 '노리는 봇'(플러시봇=한 무늬 올인 / 랭크봇=같은 숫자 집중)의
//   체인점수+족보보너스 클리어율을 그리디와 비교 → 계수 정밀화.
//
// 판정 기준(아슬아슬 + 두 전략축):
//   - 노리는 봇이 그리디와 '비슷하거나 약간 높은' 클리어율 = 유효한 대안 전략(이상적)
//   - 너무 높으면 = 계수 과함(밸런스 붕괴) / 너무 낮으면 = 노릴 가치 없음(계수 부족)

// ★Phase 0 Step 4b: connect는 더 이상 여기서 재정의하지 않고 src/rules/connect.cjs 를 require한다
//   (grep=1 대상). 이 파일은 boss 인자가 항상 null로만 호출돼(아래 compare() 호출부 전부 null 고정) 원래
//   local connect의 rust/mono 미지원과 src connect의 완전판이 이 파일 안에서는 관측적으로 동일 — 무변경.
//   evalHand/hasRun5도 src/rules/hands.cjs를 require(drop-in, 반환은 문자열로 동일). flushBuildDeck()가
//   특정 랭크를 5장까지 중복시켜(랭크봇이 노리는 패턴) fiveKind 분기가 실제로 도달 가능해짐 — HAND_BONUS에
//   이미 fiveKind 계수(.95)가 있어 해당 표본이 교정된 값으로 채점된다(숫자 변화는 정상, CLAUDE.md 참조).
const { connect } = require("../src/rules/connect.cjs");
const ri = n => Math.floor(Math.random() * n);
const isRed = s => s === 1 || s === 2;
function starterDeck(){ const d=[]; for(let s=0;s<4;s++) for(let r=1;r<=8;r++) d.push({suit:s,rank:r,enh:null}); return d; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function gain(row, card, boss){
  row.push(card);
  let base=(boss==="red_curse"&&isRed(card.suit))?0:card.rank, g=base, rl=1;
  const left=row[row.length-2];
  if(left&&connect(card,left,boss)){
    for(let i=row.length-1;i>0;i--){ if(connect(row[i],row[i-1],boss)) rl++; else break; }
    let mult=rl-1; if(boss==="dull") mult=Math.max(1,mult-1); mult=Math.min(mult,25);
    let sum=0; for(let i=row.length-rl;i<row.length;i++) sum+=row[i].rank;
    g+=sum*mult;
  }
  return g;
}

/* 족보 — 밸런싱 실험용 상향 계수(희소족보 ↑, 흔한족보 유지). content/hands.cjs와 동일 9키(+fiveKind). */
const { HAND_BONUS } = require("../src/content/hands.cjs");
const { evalHand, hasRun5 } = require("../src/rules/hands.cjs");
const { blindBase } = require("../src/rules/blinds.cjs");
const blindTarget = (ante,blind) => Math.round(blindBase(ante)*(blind===0?1:blind===1?1.4:1.6));
const handBonus = (row,ante) => Math.round(blindBase(ante)*(HAND_BONUS[evalHand(row)]||0));

// 플러시 빌드 덱(추정 모델): ♥(suit1) 편중 + 압축. 실제 게임 덱빌딩(같은무늬 추가/타무늬 압축)의 근사.
function flushBuildDeck(){ const d=[];
  for(let r=1;r<=8;r++) d.push({suit:1,rank:r,enh:null});            // ♥ A-8
  for(let r=1;r<=4;r++) d.push({suit:1,rank:r+4,enh:null});         // ♥ 5-8 추가(중복)
  for(const s of [0,2,3]) for(let r=2;r<=5;r++) d.push({suit:s,rank:r,enh:null}); // 타무늬 4장씩
  return d;   // ♥12 / 24장 = 50%
}

/* ---------- 봇들 ---------- */
// 공통 라운드 러너: pick(hand, row, boss) → 선택 인덱스
function runRound(boss, handN, pick, deckFn){
  let dk=shuffle((deckFn||starterDeck)()), disc=[], row=[], sc=0;
  const draw=()=>{ if(!dk.length){ dk=shuffle(disc); disc=[]; } return dk.pop(); };
  let hand=Array.from({length:handN}, draw);
  for(let p=0;p<8;p++){ const h=pick(hand,row,boss); sc+=gain(row,hand[h],boss); hand[h]=draw(); }
  return { sc, row };
}
const scoreOf = (hand,row,boss) => hand.map(c=>gain(row.slice(),c,boss));
// 그리디: 즉시 점수 최대
function pickGreedy(hand,row,boss){ const v=scoreOf(hand,row,boss); let bi=0; for(let h=1;h<hand.length;h++) if(v[h]>v[bi]) bi=h; return bi; }
// 플러시봇: 줄에 가장 많은 무늬를 목표로, 그 무늬 우선(여럿이면 점수최대), 없으면 점수최대
function pickFlush(hand,row,boss){
  const sc={}; for(const c of row) sc[c.suit]=(sc[c.suit]||0)+1;
  let tgt=0,mx=-1; for(let s=0;s<4;s++) if((sc[s]||0)>mx){ mx=sc[s]||0; tgt=s; }
  if(mx<=0){ // 줄이 비었으면 손패에서 가장 흔한 무늬
    const hs={}; for(const c of hand) hs[c.suit]=(hs[c.suit]||0)+1;
    mx=-1; for(let s=0;s<4;s++) if((hs[s]||0)>mx){ mx=hs[s]||0; tgt=s; }
  }
  const v=scoreOf(hand,row,boss);
  let bi=-1; for(let h=0;h<hand.length;h++) if(hand[h].suit===tgt && (bi<0||v[h]>v[bi])) bi=h;
  if(bi<0){ bi=0; for(let h=1;h<hand.length;h++) if(v[h]>v[bi]) bi=h; }
  return bi;
}
// 랭크봇: 줄에 가장 많은 숫자를 목표로 같은 숫자 우선(풀하우스/포카드 노림), 없으면 점수최대
function pickRank(hand,row,boss){
  const rc={}; for(const c of row) rc[c.rank]=(rc[c.rank]||0)+1;
  let tgt=-1,mx=1; for(const r in rc) if(rc[r]>mx){ mx=rc[r]; tgt=+r; }
  const v=scoreOf(hand,row,boss);
  if(tgt>=0){ let bi=-1; for(let h=0;h<hand.length;h++) if(hand[h].rank===tgt && (bi<0||v[h]>v[bi])) bi=h; if(bi>=0) return bi; }
  let bi=0; for(let h=1;h<hand.length;h++) if(v[h]>v[bi]) bi=h; return bi;
}

function stats(boss, handN, pick, ante, target, deckFn, N=20000){
  let pass=0, sum=0, fl=0, hi=0; // 통과수, 점수합, 플러시이상, 포카드이상
  for(let i=0;i<N;i++){
    const r=runRound(boss,handN,pick,deckFn);
    const total=r.sc+handBonus(r.row,ante);
    if(total>=target) pass++;
    sum+=total;
    const e=evalHand(r.row);
    if(e==="flush"||e==="straightFlush"||e==="fourKind") hi++;
    if(["flush","fullHouse","fourKind","straightFlush"].includes(e)) fl++;
  }
  return { clear:(pass/N*100).toFixed(0), avg:Math.round(sum/N), flushPlus:(fl/N*100).toFixed(1), rare:(hi/N*100).toFixed(1) };
}

const BOTS = [["그리디",pickGreedy],["플러시봇",pickFlush],["랭크봇",pickRank]];
function compare(title, boss, handN, ante, target, deckFn){
  console.log(`\n=== ${title} (목표 ${target}, 손패${handN}${deckFn?", 플러시빌드덱":""}) ===`);
  console.log("  봇        클리어   평균점수   희소족보%  플러시+풀+포%");
  for(const [name,pick] of BOTS){
    const s=stats(boss,handN,pick,ante,target,deckFn);
    console.log(`  ${name.padEnd(8)} ${(s.clear+"%").padStart(5)}  ${String(s.avg).padStart(8)}   ${(s.rare+"%").padStart(7)}    ${(s.flushPlus+"%").padStart(7)}`);
  }
}

console.log("\n##### 맨 스타터덱 (빌드 안 함) #####");
compare("안테1 큰 블라인드", null, 3, 1, blindTarget(1,1));
compare("안테4 큰 블라인드", null, 3, 4, blindTarget(4,1));
console.log("\n##### 플러시 빌드덱 (♥ 편중 압축) — 플러시봇이 '빌드 후' 그리디 능가하는지 #####");
compare("안테1 큰 블라인드", null, 3, 1, blindTarget(1,1), flushBuildDeck);
compare("안테4 큰 블라인드", null, 3, 4, blindTarget(4,1), flushBuildDeck);

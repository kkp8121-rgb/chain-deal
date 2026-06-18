// CHAIN DEAL 전체 런 시뮬 (밸런싱 2차)  ·  실행: node tools/run-sim.cjs
//
// 1차(balance-check/strategy-sim)는 "단일 라운드 맨덱"만 봤다. 이건 실제 런에 가깝게:
//   안테1~8 연속 + 매 블라인드 통과 후 상점 덱빌딩(누적) + 보스 + 족보 보너스까지.
//   → "실제로 몇 안테까지 가나 / 어디서 죽나 / 빌드 전략별 차이"를 측정.
//
// ⚠️ index.html 규칙 복제. 근사: 영구덱은 매 라운드 전체 셔플(draw/discard 순서는 단순화),
//    상점 thin은 랜덤 제거(실제론 약한 카드). 덱 '구성' 효과는 잡지만 draw 순서 정밀도는 낮음.

const ri = n => Math.floor(Math.random() * n);
const isRed = s => s === 1 || s === 2;
function starterDeck(){ const d=[]; for(let s=0;s<4;s++) for(let r=1;r<=8;r++) d.push({suit:s,rank:r,enh:null}); return d; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function connect(a,b,boss){ if(a.enh==="wild"||b.enh==="wild") return true; if(boss==="seal_suit"&&(a.suit===0||b.suit===0)) return false; const run=Math.abs(a.rank-b.rank)===1&&boss!=="seal_run"; return a.suit===b.suit||a.rank===b.rank||run; }

// index.html placeCard 점수 규칙 (부적 owned 반영)
function gain(row, card, boss, owned){
  row.push(card);
  let base=(boss==="red_curse"&&isRed(card.suit))?0:card.rank;
  if(owned.includes("greed")) base+=3;
  if(card.enh==="gold") base+=5;
  let g=base, rl=1;
  const left=row[row.length-2];
  if(left&&connect(card,left,boss)){
    const byIcon=card.suit===left.suit, byRun=Math.abs(card.rank-left.rank)===1;
    for(let i=row.length-1;i>0;i--){ if(connect(row[i],row[i-1],boss)) rl++; else break; }
    let mult=rl-1;
    if(owned.includes("pyro")&&isRed(card.suit)) mult+=2;
    if(owned.includes("suited")&&byIcon) mult+=1;
    if(owned.includes("runner")&&byRun) mult+=1;
    for(let i=row.length-rl;i<row.length;i++) if(row[i].enh==="mult") mult+=1;
    if(boss==="dull") mult=Math.max(1,mult-1);
    mult=Math.min(mult,25);
    let sum=0; for(let i=row.length-rl;i<row.length;i++) sum+=row[i].rank;
    let bonus=sum*mult;
    if(owned.includes("jackpot")&&rl>=4) bonus*=2;
    g+=bonus;
  }
  return g;
}

// 족보 (index.html 동일)
const HAND_BONUS={highCard:0,pair:0,twoPair:.02,trips:.05,straight:.03,flush:.30,fullHouse:.08,fourKind:.50,straightFlush:.75};
function hasRun5(r){ const s=new Set(r); for(let lo=1;lo<=4;lo++){ let ok=1; for(let k=0;k<5;k++) if(!s.has(lo+k)){ok=0;break;} if(ok) return true; } return false; }
function evalHand(cards){
  const rc={},bs={}; for(const c of cards){ if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; (bs[c.suit]=bs[c.suit]||[]).push(c.rank); }
  const cnt=Object.values(rc).sort((a,b)=>b-a), mr=cnt[0]||0;
  const pairs=cnt.filter(x=>x>=2).length, trips=cnt.filter(x=>x>=3).length;
  const mx=Math.max(...Object.values(bs).map(a=>a.length));
  const fl=mx>=5, st=hasRun5(Object.keys(rc).map(Number));
  let sf=false; for(const s in bs){ if(bs[s].length>=5&&hasRun5(bs[s])){ sf=true; break; } }
  const full=trips>=1&&(pairs>=2||trips>=2);
  if(sf) return"straightFlush"; if(mr>=4) return"fourKind"; if(full) return"fullHouse";
  if(fl) return"flush"; if(st) return"straight"; if(mr>=3) return"trips";
  if(pairs>=2) return"twoPair"; if(pairs>=1) return"pair"; return"highCard";
}
const blindBase=a=>150*Math.pow(1.5,a-1);
const blindTarget=(a,b)=>Math.round(blindBase(a)*(b===0?1:b===1?1.4:1.6));
const handBonus=(row,ante)=>Math.round(blindBase(ante)*(HAND_BONUS[evalHand(row)]||0));
const BOSSES=[{id:"seal_run",tmult:.65,minAnte:2},{id:"red_curse",tmult:1,minAnte:1},{id:"stingy",tmult:.65,minAnte:2},{id:"dull",tmult:.85,minAnte:1},{id:"seal_suit",tmult:.6,minAnte:2}];
const pickBoss=ante=>{ const p=BOSSES.filter(b=>b.minAnte<=ante); return p[ri(p.length)]; };

// 한 라운드 그리디 (영구덱 근사: 전체 셔플) → 체인점수 + 족보보너스
function playRound(deck, owned, boss, handN, ante){
  const dk=shuffle(deck.slice()); let di=0;
  const draw=()=> di<dk.length ? dk[di++] : dk[ri(dk.length)];
  let hand=[]; for(let i=0;i<handN;i++) hand.push(draw());
  let row=[], sc=0;
  for(let p=0;p<8;p++){
    let bi=0,best=-1;
    for(let h=0;h<handN;h++){ const t=row.slice(); const v=gain(t,hand[h],boss,owned); if(v>best){ best=v; bi=h; } }
    sc+=gain(row,hand[bi],boss,owned); hand[bi]=draw();
  }
  return sc + handBonus(row,ante);
}

// 상점: 3택1 (전략 우선순위로 선택)
const CHARMS=["greed","pyro","suited","runner","jackpot"];
function shopPool(state){
  const pool=[];
  CHARMS.filter(c=>!state.owned.includes(c)).forEach(c=>pool.push({type:"charm",id:c}));
  pool.push({type:"thin"},{type:"enh",enh:"wild"},{type:"enh",enh:"mult"},{type:"enh",enh:"gold"},{type:"add"},{type:"hand"},{type:"reroll"});
  return pool;
}
function priority(o, strat){
  if(strat==="flush"){
    if(o.type==="charm") return {suited:10,greed:6,runner:4,pyro:4,jackpot:3}[o.id]||2;
    if(o.type==="enh") return {wild:8,mult:5,gold:3}[o.enh]||2;
    return {add:7,hand:6,thin:5,reroll:1}[o.type]||1;
  }
  if(o.type==="charm") return {greed:10,suited:7,runner:6,pyro:6,jackpot:5}[o.id]||3;
  if(o.type==="enh") return {mult:5,wild:4,gold:3}[o.enh]||3;
  return {hand:8,thin:6,add:4,reroll:2}[o.type]||2;
}
function applyShop(state, strat){
  const pick=shuffle(shopPool(state)).slice(0,3);
  let best=pick[0], bp=-1;
  for(const o of pick){ const pr=priority(o,strat); if(pr>bp){ bp=pr; best=o; } }
  const o=best, d=state.deck;
  if(o.type==="charm") state.owned.push(o.id);
  else if(o.type==="hand") state.bonusHand++;
  else if(o.type==="reroll") {}
  else if(o.type==="thin") { if(d.length>20) d.splice(ri(d.length),1); }
  else if(o.type==="add") { const suit=strat==="flush"?1:ri(4); d.push({suit,rank:7+ri(2),enh:null}); }
  else if(o.type==="enh") { let idx=ri(d.length); if(strat==="flush"){ const c=d.findIndex(x=>x.suit===1&&!x.enh); if(c>=0) idx=c; } d[idx]={...d[idx],enh:o.enh}; }
}

function runFull(strat){
  const state={deck:starterDeck(), owned:[], bonusHand:0};
  for(let ante=1;ante<=8;ante++){
    for(let blind=0;blind<=2;blind++){
      const boss=blind===2?pickBoss(ante):null;
      let target=blindTarget(ante,blind); if(boss) target=Math.round(target*boss.tmult);
      const handN=(boss&&boss.id==="stingy"?2:3)+state.bonusHand;
      const sc=playRound(state.deck, state.owned, boss?boss.id:null, handN, ante);
      if(sc<target) return {result:"death", ante, blind};
      if(ante===8&&blind===2) return {result:"win"};
      applyShop(state, strat);
    }
  }
  return {result:"win"};
}

const N=20000;
const BL=["작은","큰","보스"];
for(const strat of ["balance","flush"]){
  let win=0; const death={};
  for(let i=0;i<N;i++){ const r=runFull(strat); if(r.result==="win") win++; else { const k=`안테${r.ante} ${BL[r.blind]}`; death[k]=(death[k]||0)+1; } }
  console.log(`\n=== 전략: ${strat==="balance"?"밸런스 빌드":"플러시 빌드"} (${N} 런) ===`);
  console.log(`  🏆 클리어(안테8 보스 격파): ${(win/N*100).toFixed(1)}%`);
  console.log(`  💀 사망 지점 분포(상위):`);
  Object.entries(death).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v])=>console.log(`    ${k}: ${(v/N*100).toFixed(1)}%`));
}

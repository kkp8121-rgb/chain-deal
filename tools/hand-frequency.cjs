// CHAIN DEAL 족보 빈도 탐색  ·  실행: node tools/hand-frequency.cjs
//
// 목적: 8장 줄에서 각 포커 족보가 자연 발생하는 빈도를 측정.
//   - 페어류가 얼마나 흔한지(→ 가산 0점 정당성)
//   - 스트레이트가 얼마나 드문지(체인 ±1과 겹치지만 조합 난이도가 달라 별도 보상 가치 검증)
//   그리디(즉시 점수 최대) 플레이 = 족보를 일부러 노리지 않는 기준선. 실제 "노리는" 플레이는 더 자주 뜸.

const ri = n => Math.floor(Math.random() * n);
function starterDeck(){ const d=[]; for(let s=0;s<4;s++) for(let r=1;r<=8;r++) d.push({suit:s,rank:r,enh:null}); return d; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function connect(a,b){ if(a.enh==="wild"||b.enh==="wild") return true; return a.suit===b.suit||a.rank===b.rank||Math.abs(a.rank-b.rank)===1; }

// index.html placeCard 점수 규칙(보스/부적 없는 맨 덱)
function gain(row, card){
  row.push(card);
  let g = card.rank;
  const left = row[row.length-2];
  if(left && connect(card,left)){
    let rl=1; for(let i=row.length-1;i>0;i--){ if(connect(row[i],row[i-1])) rl++; else break; }
    let mult=Math.min(rl-1,25);
    let sum=0; for(let i=row.length-rl;i<row.length;i++) sum+=row[i].rank;
    g += sum*mult;
  }
  return g;
}
// 그리디: 매 수 즉시 점수 최대 카드 선택 → 완성된 8장 줄(row) 반환
function playRow(handN){
  let dk=shuffle(starterDeck()), disc=[], row=[];
  const draw=()=>{ if(!dk.length){ dk=shuffle(disc); disc=[]; } return dk.pop(); };
  let hand=Array.from({length:handN}, draw);
  for(let p=0;p<8;p++){
    let bi=0,best=-1;
    for(let h=0;h<handN;h++){ const t=row.slice(); const v=gain(t,hand[h]); if(v>best){ best=v; bi=h; } }
    gain(row, hand[bi]); hand[bi]=draw();
  }
  return row;
}

// 5연속(서로 다른 랭크) 존재? (A=1 ~ 8, 윈도우 [1-5][2-6][3-7][4-8])
function hasRun5(ranks){ const s=new Set(ranks); for(let lo=1;lo<=4;lo++){ let ok=true; for(let k=0;k<5;k++) if(!s.has(lo+k)){ ok=false; break; } if(ok) return true; } return false; }

// 8장 → {best 족보, hasStraight, hasFlush}
function evalHand(cards){
  const rc={}, bySuit={};
  for(const c of cards){ rc[c.rank]=(rc[c.rank]||0)+1; (bySuit[c.suit]=bySuit[c.suit]||[]).push(c.rank); }
  const counts=Object.values(rc).sort((a,b)=>b-a);
  const maxRank=counts[0];
  const pairs=counts.filter(x=>x>=2).length;   // 트리플도 포함
  const trips=counts.filter(x=>x>=3).length;
  const maxSuit=Math.max(...Object.values(bySuit).map(a=>a.length));
  const flush=maxSuit>=5;
  const straight=hasRun5(Object.keys(rc).map(Number));
  let sflush=false; for(const s in bySuit){ if(bySuit[s].length>=5 && hasRun5(bySuit[s])){ sflush=true; break; } }
  const full = trips>=1 && (pairs>=2 || trips>=2);
  let best;
  if(sflush) best="straightFlush";
  else if(maxRank>=4) best="fourKind";
  else if(full) best="fullHouse";
  else if(flush) best="flush";
  else if(straight) best="straight";
  else if(maxRank>=3) best="trips";
  else if(pairs>=2) best="twoPair";
  else if(pairs>=1) best="pair";
  else best="highCard";
  return { best, hasStraight:straight, hasFlush:flush };
}

const N = 50000;
const order = ["highCard","pair","twoPair","trips","straight","flush","fullHouse","fourKind","straightFlush"];
const label = { highCard:"하이카드", pair:"페어", twoPair:"투페어", trips:"트리플", straight:"스트레이트", flush:"플러시", fullHouse:"풀하우스", fourKind:"포카드", straightFlush:"스트레이트플러시" };
const freq = {}; let stExist=0, flExist=0;
for(let i=0;i<N;i++){ const e=evalHand(playRow(3)); freq[e.best]=(freq[e.best]||0)+1; if(e.hasStraight) stExist++; if(e.hasFlush) flExist++; }

console.log(`=== 8장 줄 '최고 족보' 분포 (그리디 ${N}판, 손패3, 맨덱) ===`);
for(const k of order){ const pct=((freq[k]||0)/N*100); console.log(`  ${label[k].padEnd(9)} ${pct.toFixed(2).padStart(6)}%`); }
console.log(`\n=== 존재 비율 (최고가 아니어도 8장 안에 포함) ===`);
console.log(`  스트레이트 존재: ${(stExist/N*100).toFixed(2)}%   ← 체인과 겹쳐도 '연속 5개 다른 숫자'는 세팅 난이도 별개`);
console.log(`  플러시 존재   : ${(flExist/N*100).toFixed(2)}%`);

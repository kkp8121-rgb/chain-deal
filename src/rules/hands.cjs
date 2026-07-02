"use strict";
// 순수 규칙(Phase 0 Step 2): 전역 S/document/localStorage 미접근. 8장 줄 텍사스 서열 족보 판정.
function hasRun5(r){ const s=new Set(r); for(let lo=1;lo<=4;lo++){ let ok=1; for(let k=0;k<5;k++) if(!s.has(lo+k)){ ok=0; break; } if(ok) return true; } return false; }
function evalHand(cards){
  const rc={}, bs={};
  for(const c of cards){ if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; (bs[c.suit]=bs[c.suit]||[]).push(c.rank); }
  const cnt=Object.values(rc).sort((a,b)=>b-a), mr=cnt[0]||0;
  const pairs=cnt.filter(x=>x>=2).length, trips=cnt.filter(x=>x>=3).length;
  const mxSuit=Math.max(...Object.values(bs).map(a=>a.length));
  const flush=mxSuit>=5, straight=hasRun5(Object.keys(rc).map(Number));
  let sf=false; for(const s in bs){ if(bs[s].length>=5&&hasRun5(bs[s])){ sf=true; break; } }
  const full=trips>=1&&(pairs>=2||trips>=2);
  if(mr>=5) return"fiveKind"; if(sf) return"straightFlush"; if(mr>=4) return"fourKind"; if(full) return"fullHouse";
  if(flush) return"flush"; if(straight) return"straight"; if(mr>=3) return"trips";
  if(pairs>=2) return"twoPair"; if(pairs>=1) return"pair"; return"highCard";
}
module.exports = { evalHand, hasRun5 };

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

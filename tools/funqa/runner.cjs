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

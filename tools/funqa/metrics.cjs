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

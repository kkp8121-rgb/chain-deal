// CHAIN DEAL 전체 런 시뮬 (밸런싱 2차)  ·  실행: node tools/run-sim.cjs
//
// 1차(balance-check/strategy-sim)는 "단일 라운드 맨덱"만 봤다. 이건 실제 런에 가깝게:
//   안테1~8 연속 + 매 블라인드 통과 후 상점 덱빌딩(누적) + 보스 + 족보 보너스까지.
//   → "실제로 몇 안테까지 가나 / 어디서 죽나 / 빌드 전략별 차이"를 측정.
//
// ⚠️ index.html 규칙 복제. 근사: 영구덱은 매 라운드 전체 셔플(draw/discard 순서는 단순화),
//    상점 thin은 랜덤 제거(실제론 약한 카드). 덱 '구성' 효과는 잡지만 draw 순서 정밀도는 낮음.

let RNG = Math.random;                         // funqa가 setRNG로 시드 주입 (기본=비시드, 기존 동작 보존)
function setRNG(fn){ RNG = fn || Math.random; }
const ri = n => Math.floor(RNG() * n);
const isRed = s => s === 1 || s === 2;
function starterDeck(){ const d=[]; for(let s=0;s<4;s++) for(let r=1;r<=8;r++) d.push({suit:s,rank:r,enh:null}); return d; }
function highDeckSim(){ const d=[]; for(let s=0;s<4;s++) for(const r of [3,4,5,6,7,7,8,8]) d.push({suit:s,rank:r,enh:null}); return d; }
const DECKS=[{id:"standard",build:starterDeck,dmult:1},{id:"high",build:highDeckSim,dmult:1}];   // dmult: Task 2서 high 캘리브
let DMULT=1;   // 덱 목표 스칼라 — runFull이 설정(미지정=표준=1, no-op 기준선 가드)
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function connect(a,b,boss){ if(boss!=="rust"&&(a.enh==="wild"||b.enh==="wild")) return true; if(boss==="seal_suit"&&(a.suit===0||b.suit===0)) return false; if(boss==="mono") return a.suit===b.suit; const run=Math.abs(a.rank-b.rank)===1; return a.suit===b.suit||a.rank===b.rank||run; }

// index.html placeCard 점수 규칙 (부적 owned 반영)
function climbSealedSim(right,left,boss){ return boss==="seal_climb" && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1; }   // 내리막: 오름 +1 체인 봉인
function gain(row, card, boss, owned, deckSize){
  row.push(card);
  const rust=boss==="rust";
  let base=(boss==="red_curse"&&isRed(card.suit))?0:card.rank;
  if(boss==="tax"&&card.rank>=7) base=0; else if(boss==="peasant"&&card.rank<=3) base=0;   // 사치세/보릿고개
  if(owned.includes("greed")) base+=3;
  if(card.enh==="gold" && !rust) base+=5;
  if(owned.includes("lapidary")&&card.enh&&!rust) base+=3;
  if(owned.includes("compactor")) base+=Math.min(8, Math.max(0, 32-(deckSize||32)));
  if(owned.includes("runts")&&card.rank<=3) base+=4;
  let g=base, rl=1;
  const left=row[row.length-2];
  if(left&&connect(card,left,boss) && !climbSealedSim(card,left,boss) && !(boss==="frost"&&row.length<=2)){   // 냉각: 줄 첫 2장 무연결 / 내리막: 오름 ±1 봉인
    const byIcon=card.suit===left.suit, byRun=Math.abs(card.rank-left.rank)===1;
    for(let i=row.length-1;i>0;i--){ if(connect(row[i],row[i-1],boss) && !climbSealedSim(row[i],row[i-1],boss)) rl++; else break; }
    let mult=rl-1;
    if(owned.includes("pyro")&&isRed(card.suit)) mult+=2;
    if(owned.includes("noir")&&!isRed(card.suit)) mult+=2;
    if(owned.includes("suited")&&byIcon) mult+=1;
    if(owned.includes("runner")&&byRun) mult+=1;
    if(owned.includes("highmult")&&card.rank>=7) mult+=1;
    if(owned.includes("echo")&&card.rank===left.rank) mult+=1;
    for(let i=row.length-rl;i<row.length;i++) if(row[i].enh==="mult" && !rust) mult+=1;
    if(boss==="dull") mult=Math.max(1,mult-1);
    mult=Math.min(mult, boss==="anchor"?3:25);   // 닻: 배율 3 캡 (캡 레버는 밸런스빌드에 무효라 사다리서 제외)
    let sum=0; for(let i=row.length-rl;i<row.length;i++) sum+=row[i].rank;
    let bonus=sum*mult;
    if(owned.includes("jackpot")&&rl>=4) bonus*=2;
    if(boss==="toll") bonus=Math.round(bonus*0.5);   // 연결세: 보너스 반감
    g+=bonus;
  }
  return g;
}

// 족보 (index.html 동일)
const HAND_BONUS={highCard:0,pair:0,twoPair:.02,trips:.05,straight:.03,flush:.30,fullHouse:.08,fourKind:.50,straightFlush:.75,fiveKind:.95};
function hasRun5(r){ const s=new Set(r); for(let lo=1;lo<=4;lo++){ let ok=1; for(let k=0;k<5;k++) if(!s.has(lo+k)){ok=0;break;} if(ok) return true; } return false; }
function evalHand(cards){
  const rc={},bs={}; for(const c of cards){ if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; (bs[c.suit]=bs[c.suit]||[]).push(c.rank); }
  const cnt=Object.values(rc).sort((a,b)=>b-a), mr=cnt[0]||0;
  const pairs=cnt.filter(x=>x>=2).length, trips=cnt.filter(x=>x>=3).length;
  const mx=Math.max(...Object.values(bs).map(a=>a.length));
  const fl=mx>=5, st=hasRun5(Object.keys(rc).map(Number));
  let sf=false; for(const s in bs){ if(bs[s].length>=5&&hasRun5(bs[s])){ sf=true; break; } }
  const full=trips>=1&&(pairs>=2||trips>=2);
  if(mr>=5) return"fiveKind"; if(sf) return"straightFlush"; if(mr>=4) return"fourKind"; if(full) return"fullHouse";
  if(fl) return"flush"; if(st) return"straight"; if(mr>=3) return"trips";
  if(pairs>=2) return"twoPair"; if(pairs>=1) return"pair"; return"highCard";
}
const blindBase=a=>150*Math.pow(1.5,a-1);
const STK_T=[0,.03,.03,.04,.04,.06], STK_AC=[0,0,0,.008,.008,.014];   // 6스테이크(St0~5) per-stake 목표 가산(평면, 안테비례) — index.html 미러
const stakeMult=a=>1+STK_T[STK]+STK_AC[STK]*(a-1);   // 난이도 사다리 목표 스칼라 — index.html 미러
const blindTarget=(a,b)=>Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6));
function handBonus(row, ante, owned, boss){
  const hk=evalHand(row); let hb=Math.round(blindBase(ante)*(HAND_BONUS[hk]||0));
  if(owned&&owned.includes("broker")){ const BR={pair:.05,twoPair:.08,trips:.12}; if(BR[hk]) hb=Math.round(blindBase(ante)*BR[hk]); }
  if(owned&&owned.includes("twins")){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let g=0; for(const k in rc) if(rc[k]>=2) g++; hb+=Math.round(blindBase(ante)*.03*Math.min(g,4)); }
  // 위치-맥락 부적 (index.html settle 미러)
  if(owned&&owned.includes("bridge")){ let n=0; for(let i=1;i<=6&&i+1<row.length;i++){ if(connect(row[i],row[i-1],boss)&&connect(row[i],row[i+1],boss)) n++; } hb+=Math.round(blindBase(ante)*.03*Math.min(n,3)); }
  if(owned&&owned.includes("stair")){ let mx=1,cur=1; for(let i=1;i<row.length;i++){ if(row[i].enh!=="wild"&&row[i-1].enh!=="wild"&&row[i].rank>row[i-1].rank){cur++;if(cur>mx)mx=cur;}else cur=1;} hb+=Math.round(blindBase(ante)*.04*Math.max(0,Math.min(mx,6)-2)); }
  if(owned&&owned.includes("keystone")){ const rv=c=>c&&c.enh!=="wild"?c.rank:0; hb+=Math.round(blindBase(ante)*.18*Math.max(0,((rv(row[0])+rv(row[3])+rv(row[7]))-12)/12)); }
  if(owned&&owned.includes("prism")){ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } if(w&&g&&m&&boss!=="rust") hb+=Math.round(blindBase(ante)*.12); }
  if(owned&&owned.includes("jewelbox")){ let e=0; for(const c of row) if(c.enh) e++; hb+=Math.round(blindBase(ante)*.025*Math.min(e,6)); }
  if(owned&&owned.includes("magnate")){ let h=0; for(const c of row) if(c.enh!=="wild"&&c.rank>=7) h++; hb+=Math.round(blindBase(ante)*.03*Math.min(h,5)); }
  if(owned&&owned.includes("loaded")){ if(hk==="fourKind") hb+=Math.round(blindBase(ante)*.10); else if(hk==="fiveKind") hb+=Math.round(blindBase(ante)*.30); }
  if(owned&&owned.includes("climax") && ["fullHouse","fourKind","straightFlush","fiveKind"].includes(hk)){ let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1],boss)){ cur++; if(cur>L)L=cur; } else cur=1; } hb+=Math.round(blindBase(ante)*.03*Math.max(0,Math.min(L,8)-5)); }
  if(owned&&owned.includes("evenodd")){ let ev=0,od=0; for(const c of row) if(c.enh!=="wild")(c.rank%2?od++:ev++); hb+=Math.round(blindBase(ante)*.04*Math.max(0,Math.max(ev,od)-5)); }
  if(owned&&owned.includes("paritybet")){ const nw=row.filter(c=>c.enh!=="wild"); if(row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1))) hb+=Math.round(blindBase(ante)*.30); }
  if(owned&&owned.includes("twotone")){ let h=0,d=0,s=0,c=0; for(const x of row){ if(x.enh==="wild")continue; if(x.suit===1)h++; else if(x.suit===2)d++; else if(x.suit===0)s++; else c++; } const red=h+d,black=s+c,dom=Math.max(red,black); const bothSuits=red>=black?(h>0&&d>0):(s>0&&c>0); if(bothSuits) hb+=Math.round(blindBase(ante)*0.04*Math.max(0,Math.min(dom,8)-4)); }   // 투톤: 두 무늬 섞은 단색 치우침(순수 플러시 제외)
  return hb;
}
const BOSSES=[
  {id:"red_curse",tmult:1.0,act:1,actBoss:false},{id:"dull",tmult:.85,act:1,actBoss:false},{id:"peasant",tmult:.82,act:1,actBoss:false},{id:"tax",tmult:.8,act:1,actBoss:true},
  {id:"seal_climb",tmult:.72,act:2,actBoss:false},{id:"stingy",tmult:.58,act:2,actBoss:false},{id:"toll",tmult:.54,act:2,actBoss:false},{id:"rust",tmult:.6,act:2,actBoss:true},
  {id:"seal_suit",tmult:.47,act:3,actBoss:false},{id:"frost",tmult:.48,act:3,actBoss:false},{id:"mono",tmult:.4,act:3,actBoss:false},{id:"anchor",tmult:.44,act:3,actBoss:true},
];
const actOf=ante=> ante<=3?1 : ante<=6?2 : 3;
function pickBoss(ante){ const a=actOf(ante), fin=(ante===3||ante===6||ante===8); let pool=BOSSES.filter(b=>b.act===a&&b.actBoss===fin); if(!pool.length) pool=BOSSES.filter(b=>b.act===a); return pool[ri(pool.length)]; }
const BOSS_KO={red_curse:"단색저주",dull:"무딘칼날",peasant:"보릿고개",tax:"👑사치세",seal_climb:"내리막",stingy:"인색한손",toll:"연결세",rust:"👑부식",seal_suit:"무늬봉인",frost:"냉각",mono:"단일강요",anchor:"👑닻"};

// 한 라운드 시뮬 (영구덱 근사: 전체 셔플) → 체인점수 + 족보보너스. pick=배치 정책 콜백(기본=그리디)
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

// 상점: 3택1 (전략 우선순위로 선택)
const CHARMS=["greed","pyro","suited","runner","jackpot","noir","broker","twins","compactor","runts","bridge","stair","keystone","lapidary","prism","jewelbox","highmult","magnate","echo","loaded","climax","evenodd","paritybet","twotone"];
function shopPool(state){
  const pool=[];
  CHARMS.filter(c=>!state.owned.includes(c)).forEach(c=>pool.push({type:"charm",id:c}));
  pool.push({type:"thin"},{type:"copy"},{type:"enh",enh:"wild"},{type:"enh",enh:"mult"},{type:"enh",enh:"gold"},{type:"add"},{type:"hand"},{type:"reroll"});
  return pool;
}
// ---------- 골드 경제 (index.html과 동기화 필수) ----------
const GOLD_BASE=1, GOLD_K=4;
const goldEarned=(s,t)=>Math.floor((STK>=2?0:GOLD_BASE) + Math.max(0, s/t - 1)*GOLD_K);   // St2: 통과 골드 바닥 제거
const CHARM_COST={lapidary:5,prism:5,highmult:5,echo:3};   // 콤보 인에이블러 저가(나머지 8). index.html CHARMS cost 필드와 동기화.
function costOf(o){ if(o.type==="charm") return CHARM_COST[o.id]||8; if(o.type==="enh") return o.enh==="wild"?8:5; if(o.type==="hand") return 8; if(o.type==="thin"||o.type==="add") return 3; return 5; } // copy/mult/gold/reroll=5

// 전략별 픽 우선순위 (charm / enh / item). 없으면 기본값.
const STRATS={
  balance:{ charm:{greed:10,suited:7,runner:6,pyro:6,jackpot:5,noir:5,broker:4,compactor:4,twins:3,runts:3}, enh:{mult:5,wild:4,gold:3}, item:{hand:8,thin:6,add:4,copy:3,reroll:2} },
  flush:  { charm:{suited:10,greed:6,runner:4,pyro:4,jackpot:3,noir:2}, enh:{wild:8,mult:5,gold:3}, item:{add:7,hand:6,thin:5,copy:2,reroll:1} },
  black:  { charm:{noir:10,greed:6,suited:6,jackpot:4,runner:3}, enh:{mult:5,wild:4,gold:3}, item:{hand:7,add:6,thin:5,copy:2,reroll:1} },
  jokbo:  { charm:{broker:10,twins:9,greed:4,jackpot:3,suited:3}, enh:{mult:3,gold:3,wild:2}, item:{thin:8,copy:7,hand:6,add:2,reroll:1} },
  compact:{ charm:{compactor:10,runts:9,greed:5,suited:4,runner:4}, enh:{gold:4,mult:4,wild:2}, item:{thin:9,hand:5,add:1,copy:1,reroll:1} },
  spatial:{ charm:{bridge:10,stair:7,keystone:6,suited:6,runner:6,greed:4}, enh:{wild:5,mult:3,gold:2}, item:{thin:6,hand:6,add:4,copy:3,reroll:2} },   // 위치-맥락 빌드(연결 밀도+오름+자리값)
  gem:    { charm:{jewelbox:10,lapidary:8,prism:7,greed:5,suited:4}, enh:{wild:8,gold:7,mult:7}, item:{thin:5,hand:5,add:2,copy:2,reroll:1} },   // enh 스태킹(강화카드 떡칠)
  apex:   { charm:{magnate:10,highmult:9,greed:5,jackpot:5,keystone:4}, enh:{mult:4,gold:3,wild:3}, item:{add:9,thin:4,copy:6,hand:5,reroll:1} },   // 고랭크 7·8(add로 7~8 카드 매입)
  cartel: { charm:{loaded:10,echo:9,twins:8,broker:7,climax:6,jackpot:4}, enh:{wild:3,mult:3,gold:2}, item:{copy:9,thin:6,hand:5,add:1,reroll:1} },   // 같은수(copy로 동일 랭크 복제)
  parity: { charm:{paritybet:10,evenodd:9,greed:5,twins:5,suited:4}, enh:{wild:6,mult:3,gold:3}, item:{thin:8,hand:5,add:3,copy:3,reroll:1} },   // 홀짝(thin으로 한쪽 패리티 정제 — 도구상 어려움=의도된 직교)
  color:  { charm:{twotone:10,pyro:9,greed:5,suited:4,jackpot:4}, enh:{wild:3,mult:4,gold:3}, item:{add:8,thin:5,hand:5,copy:3,reroll:1} },   // 색(투톤+발화) 빌드 — 대표 빨강 경로
};
function priority(o, strat){
  const S=STRATS[strat]||STRATS.balance;
  if(o.type==="charm") return S.charm[o.id]||2;
  if(o.type==="enh") return S.enh[o.enh]||2;
  return S.item[o.type]||1;
}
function applyOne(state, o, strat){
  const d=state.deck;
  if(o.type==="charm") state.owned.push(o.id);
  else if(o.type==="hand") state.bonusHand++;
  else if(o.type==="reroll") {}
  else if(o.type==="thin") { if(d.length>20) d.splice(ri(d.length),1); }
  else if(o.type==="copy") { if(d.length<60){ const c=d[ri(d.length)]; d.push({suit:c.suit,rank:c.rank,enh:c.enh}); } }
  else if(o.type==="add") { const suit=strat==="flush"?1:strat==="black"?(ri(2)?0:3):strat==="color"?(ri(2)?1:2):ri(4); d.push({suit,rank:7+ri(2),enh:null}); }
  else if(o.type==="enh") { let idx=ri(d.length); if(strat==="flush"){ const c=d.findIndex(x=>x.suit===1&&!x.enh); if(c>=0) idx=c; } d[idx]={...d[idx],enh:o.enh}; }
}
// 유료 상점: 3장 제시 → 우선순위 높은 것부터 살 수 있는 만큼 구매(골드 차감)
// 가중 오퍼 (index.html 미러): 미투자 클러스터 부적을 CLUSTER_W로 감량 → 희석 완화
const CLUSTER={lapidary:"gem",prism:"gem",jewelbox:"gem",highmult:"apex",magnate:"apex",echo:"cartel",loaded:"cartel",climax:"cartel",evenodd:"parity",paritybet:"parity"};
const CLUSTER_W=0.15;   // index.html 동기화 (캘리브: balance 3.5%→7.3% 회복, 베이스라인 9.6% 미초과)
function ownsClusterSim(owned, cl){ for(const id of owned) if(CLUSTER[id]===cl) return true; return false; }
function offerWeightSim(o, owned){ if(o.type!=="charm") return 1; const cl=CLUSTER[o.id]; if(!cl) return 1; return ownsClusterSim(owned,cl)?1:CLUSTER_W; }
function weightedSampleSim(pool, owned, n){
  const p=pool.slice(), out=[];
  for(let k=0;k<n && p.length;k++){
    let tot=0; for(const o of p) tot+=offerWeightSim(o,owned);
    let r=RNG()*tot, idx=p.length-1;
    for(let i=0;i<p.length;i++){ r-=offerWeightSim(p[i],owned); if(r<=0){ idx=i; break; } }
    out.push(p[idx]); p.splice(idx,1);
  }
  return out;
}
function applyShop(state, strat){
  const offers=weightedSampleSim(shopPool(state), state.owned, 3).map(o=>({o,pr:priority(o,strat),cost:costOf(o)}));   // 가중 샘플(희석 fix)
  offers.sort((a,b)=>b.pr-a.pr);
  for(const it of offers){ if(state.gold>=it.cost){ state.gold-=it.cost; applyOne(state,it.o,strat); } }
}

let STK=0;   // 난이도 사다리 스테이크 — runFull이 설정, 티어 델타가 읽음(stake 0=no-op, 기준선 불변)
function runFull(strat, acc, stake, variant){   // variant: 시작덱 id(미지정=standard)
  STK = stake|0;
  const v = DECKS.find(d=>d.id===variant) || DECKS[0];
  DMULT = v.dmult;
  const state={deck:v.build(), owned:[], bonusHand:0, gold:0};
  for(let ante=1;ante<=8;ante++){
    const anteBoss=pickBoss(ante);   // 한 번 뽑아 보스+(St6)큰블라인드 공유 = index.html S.anteBoss 미러
    for(let blind=0;blind<=2;blind++){
      const boss=(blind===2 || (STK>=6 && blind===1 && ante>=2)) ? anteBoss : null;   // 보스 룰이 큰 블라인드에도(>=6: 6스테이크 래더선 비활성, 향후 확장용)
      let target=blindTarget(ante,blind); if(boss && blind===2) target=Math.round(target*boss.tmult);   // tmult는 진짜 보스블라인드만
      const handN=(boss && (boss.id==="stingy" || (STK>=4 && blind===2)) ? 2 : 3)+state.bonusHand;   // St4: 보스전 손패 3→2
      if(acc){ const k=`${ante}-${blind}`; acc.reach[k]=(acc.reach[k]||0)+1; if(boss) acc.bReach[boss.id]=(acc.bReach[boss.id]||0)+1; }
      const sc=playRound(state.deck, state.owned, boss?boss.id:null, handN, ante);
      if(sc<target) return {result:"death", ante, blind};
      if(acc){ const k=`${ante}-${blind}`; acc.pass[k]=(acc.pass[k]||0)+1; if(boss) acc.bPass[boss.id]=(acc.bPass[boss.id]||0)+1; }
      state.gold += goldEarned(sc, target);          // 통과 환전 (초과율 기반)
      if(ante===8&&blind===2) return {result:"win"};
      applyShop(state, strat);
    }
  }
  return {result:"win"};
}

if (require.main === module) {
const N=20000;
const BL=["작은","큰","보스"];
const STRAT_KO={balance:"밸런스 빌드",flush:"플러시 빌드",black:"흑심(검정/2색) 빌드",jokbo:"족보(중개상+쌍둥이) 빌드",compact:"압축(정련가+잔챙이) 빌드",spatial:"위치-맥락(다리+계단+주춧돌) 빌드",gem:"보석세공(enh 스태킹) 빌드",apex:"정점(고랭크 7·8) 빌드",cartel:"같은수 카르텔 빌드",parity:"홀짝 패리티 빌드",color:"색(투톤) 빌드"};
for(const strat of Object.keys(STRATS)){
  let win=0; const death={};
  for(let i=0;i<N;i++){ const r=runFull(strat); if(r.result==="win") win++; else { const k=`안테${r.ante} ${BL[r.blind]}`; death[k]=(death[k]||0)+1; } }
  console.log(`\n=== 전략: ${STRAT_KO[strat]} (${N} 런) ===`);
  console.log(`  🏆 클리어(안테8 보스 격파): ${(win/N*100).toFixed(1)}%`);
  console.log(`  💀 사망 지점 분포(상위):`);
  Object.entries(death).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v])=>console.log(`    ${k}: ${(v/N*100).toFixed(1)}%`));
}

// ★ 조건부 클리어율 (도달자 중 통과%) — 위 '사망 지점 분포'는 사망'비중'이라 생존자 편향에 오염
//   (모두 안테1을 지나므로 사망비중이 초반에 쏠림 = 초반이 어려워서가 아님). 진짜 난이도 곡선·
//   보스 벽은 '도달자 중 통과율'로 봐야 한다(밸런싱 권위 지표). 대표=밸런스 빌드.
{
  const acc={reach:{},pass:{},bReach:{},bPass:{}};
  for(let i=0;i<N;i++) runFull("balance", acc);
  console.log(`\n=== [밸런스 빌드] 조건부 클리어율 (도달자 중 통과%) · ${N} 런 ===`);
  console.log(`  난이도는 24블라인드 게이트 길이의 곱연산(≈0.9^24). 평탄=건강. 🔴<60 🟡<75 🟢≥75`);
  for(let a=1;a<=8;a++){ let line=`  안테${a}: `;
    for(let b=0;b<=2;b++){ const k=`${a}-${b}`, r=acc.reach[k]||0, p=acc.pass[k]||0; if(!r){ continue; }
      const c=p/r*100, bar=c<60?"🔴":c<75?"🟡":"🟢"; line+=`${BL[b]} ${bar}${c.toFixed(0)}%  `; }
    console.log(line); }
  console.log(`  --- 보스별 조건부 통과율(도달자 중) ---`);
  BOSSES.forEach(bo=>{ const r=acc.bReach[bo.id]||0, p=acc.bPass[bo.id]||0; if(r<200) return;   // 표본 부족 보스(act3 도달 적음)는 노이즈라 생략
    const c=p/r*100, bar=c<60?"🔴":c<75?"🟡":"🟢"; console.log(`  ${bar} ${(BOSS_KO[bo.id]||bo.id).padEnd(8)} act${bo.act}${bo.actBoss?"-fin":"   "} t=${bo.tmult}  도달 ${String(r).padStart(6)}  통과 ${c.toFixed(0)}%`); });
}

// ★ 내리막(seal_climb) 표적 검증 — 위치-맥락(stair/오름) 빌드 vs 밸런스 빌드 보스별 조건부 통과율.
//   내리막은 '다른무늬 오름 ±1' 체인을 봉인 → 다리+계단+오름 빌드(spatial)를 표적. 밸런스는 오름 의존이 적어
//   bite가 약함(=기준선 불변의 이유, 90% 🟢). 두 빌드 모두 같은 보스 집합을 만나므로 seal_climb '델타'(밸−stair)가
//   다른 보스 델타보다 두드러지면 = 봉인 룰이 의도대로 stair 빌드에 표적 적중(설계 "bite는 stair에 집중" 입증).
{
  const aB={reach:{},pass:{},bReach:{},bPass:{}}, aS={reach:{},pass:{},bReach:{},bPass:{}};
  for(let i=0;i<N;i++){ runFull("balance", aB); runFull("spatial", aS); }
  console.log(`\n=== 내리막(seal_climb) 표적 검증: 밸런스 vs 위치-맥락(stair) 빌드 보스별 조건부 통과율 (${N} 런) ===`);
  console.log(`  델타 = 밸런스통과% − stair통과%. ⤵내리막 델타가 클수록 stair 빌드에 표적 적중. (도달<200 보스 생략)`);
  console.log(`  보스          밸런스   stair    델타`);
  BOSSES.forEach(bo=>{
    const rB=aB.bReach[bo.id]||0,pB=aB.bPass[bo.id]||0, rS=aS.bReach[bo.id]||0,pS=aS.bPass[bo.id]||0;
    if(rB<200||rS<200) return;
    const cB=pB/rB*100, cS=pS/rS*100, d=cB-cS, mk=bo.id==="seal_climb"?"⤵ ":"  ";
    console.log(`  ${mk}${(BOSS_KO[bo.id]||bo.id).padEnd(8)} ${cB.toFixed(0).padStart(4)}%  ${cS.toFixed(0).padStart(4)}%   ${(d>=0?"+":"")}${d.toFixed(0)}pp`);
  });
}

// ★ 난이도 사다리(Stakes) 캘리브 대시보드 — 스테이크별 전체 클리어율(밸런스 빌드). St0=기준선(델타 no-op 가드).
console.log(`\n=== 난이도 사다리: 스테이크별 클리어율 (밸런스, ${N} 런) ===`);
{ const targets=["~9%","~6.5%","~4.3%","~3%","~1.8%","~0.9%"];
  for(let stk=0;stk<=5;stk++){ let win=0; for(let i=0;i<N;i++){ if(runFull("balance",null,stk).result==="win") win++; }
    console.log(`  St${stk}: ${(win/N*100).toFixed(1).padStart(4)}%   (목표 ${targets[stk]})`); } }

// ★ 시작덱 변형 스윕 — 덱별 balance 빌드 클리어율(고랭크덱 viability·dmult 캘리브용)
console.log(`\n=== 시작덱 변형: 덱별 클리어율 (밸런스 빌드, ${N} 런) ===`);
for(const v of DECKS){ let win=0; for(let i=0;i<N;i++){ if(runFull("balance",null,0,v.id).result==="win") win++; } console.log(`  ${v.id.padEnd(9)} dmult=${v.dmult}: ${(win/N*100).toFixed(1)}%`); }
}

module.exports = {
  setRNG, ri, starterDeck, shuffle, connect, gain, evalHand, handBonus,
  blindBase, blindTarget, BOSSES, actOf, pickBoss, BOSS_KO,
  CHARMS, shopPool, goldEarned, costOf, STRATS, priority, applyOne,
  CLUSTER, CLUSTER_W, applyShop, defaultPick, playRound,
};

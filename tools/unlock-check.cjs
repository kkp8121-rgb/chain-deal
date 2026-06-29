// CHAIN DEAL 부적 해금 조건 검증  ·  실행: node tools/unlock-check.cjs
// ⚠️ index.html 의 STARTER_CHARMS / UNLOCKS / checkUnlocks 로직을 "복제"한 것.
//    index.html 에서 조건을 바꾸면 이 파일도 같이 맞출 것. (repo의 tools/*.cjs 복제 관례)

// ----- index.html 복제 (해금 코어) -----
let STORE = {};                                  // 가짜 localStorage
const STARTER_CHARMS = ["greed","pyro","suited","runner","jackpot"];
function maxRankCount(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let m=0; for(const k in rc) if(rc[k]>m) m=rc[k]; return m; }
function pairGroups(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let g=0; for(const k in rc) if(rc[k]>=2) g++; return g; }
// ↓ run-sim.cjs L14·L52~L64 verbatim 복사 (loaded/climax 해금 cond용 — evalHand/connect 필요). run-sim 변경 시 동기화.
function connect(a,b,boss){ if(boss!=="rust"&&(a.enh==="wild"||b.enh==="wild")) return true; if(boss==="seal_suit"&&(a.suit===0||b.suit===0)) return false; if(boss==="mono") return a.suit===b.suit; const run=Math.abs(a.rank-b.rank)===1&&boss!=="seal_run"; return a.suit===b.suit||a.rank===b.rank||run; }
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
const UNLOCKS = {
  noir:     {cond:(st,row)=> (st.bestAnte||0)>=4,               hint:"안테 4 도달"},
  compactor:{cond:(st,row)=> (st.wins||0)>=1,                   hint:"런 1회 클리어"},
  broker:   {cond:(st,row)=> maxRankCount(row)>=3,              hint:"한 줄에 같은 숫자 3장"},
  twins:    {cond:(st,row)=> pairGroups(row)>=2,                hint:"한 줄에 같은 숫자 2장 그룹 2개"},
  runts:    {cond:(st,row)=> row.filter(c=>c.rank<=3).length>=4, hint:"한 줄에 A·2·3 4장"},
  lapidary: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:"한 줄에 강화 카드 3장"},
  jewelbox: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:"한 줄에 강화 카드 3장"},
  prism:    {cond:(st,row)=>{ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } return !!(w&&g&&m); }, hint:"한 줄에 와일드·황금·배율석 동시"},
  highmult: {cond:(st,row)=> row.filter(c=>c.rank===8).length>=3, hint:"한 줄에 8 카드 3장"},
  magnate:  {cond:(st,row)=> row.filter(c=>c.rank>=7).length>=5, hint:"한 줄에 7·8 카드 5장"},
  echo:   {cond:(st,row)=> maxRankCount(row)>=4, hint:"한 줄에 같은 숫자 4장"},
  loaded: {cond:(st,row)=> evalHand(row)==="fiveKind", hint:"파이브 카드 완성"},
  climax: {cond:(st,row)=>{ if(row.length<8) return false; if(!["fullHouse","fourKind","straightFlush","fiveKind"].includes(evalHand(row))) return false; let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1])){ cur++; if(cur>L)L=cur; } else cur=1; } return L>=8; }, hint:"8칸 전부 연결 + 풀하우스↑"},
  evenodd:   {cond:(st,row)=>{ let ev=0,od=0; for(const c of row) if(c.enh!=="wild")(c.rank%2?od++:ev++); return Math.max(ev,od)>=6; }, hint:"한 줄에 같은 홀짝 6장"},
  paritybet: {cond:(st,row)=>{ const nw=row.filter(c=>c.enh!=="wild"); return row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1)); }, hint:"줄 전체 짝수만/홀수만"},
};
function getUnlocked(){ try{ const a=JSON.parse(STORE["cd_unlocked"]); if(Array.isArray(a)) return a; }catch(e){} return STARTER_CHARMS.slice(); }
function saveUnlocked(a){ STORE["cd_unlocked"]=JSON.stringify(a); }
function isUnlocked(id){ return STARTER_CHARMS.includes(id) || getUnlocked().includes(id); }
function checkUnlocks(st,row){ const cur=getUnlocked(), fresh=[]; for(const id in UNLOCKS){ if(!cur.includes(id) && UNLOCKS[id].cond(st,row||[])){ cur.push(id); fresh.push(id); } } if(fresh.length) saveUnlocked(cur); return fresh; }

// ----- 테스트 -----
let pass=0, fail=0;
function eq(name, got, want){ const ok=JSON.stringify(got)===JSON.stringify(want); if(ok){pass++;} else {fail++; console.log(`  ❌ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);} }
const card=(suit,rank,enh=null)=>({suit,rank,enh});
const reset=()=>{ STORE={}; };

// 시작 부적은 항상 해금
reset(); eq("starter greed 해금", isUnlocked("greed"), true);
reset(); eq("noir 기본 잠김", isUnlocked("noir"), false);

// 등급: noir(안테4), compactor(승1)
reset(); eq("noir@안테3 잠김", checkUnlocks({bestAnte:3,wins:0},[]), []);
reset(); eq("noir@안테4 해금", checkUnlocks({bestAnte:4,wins:0},[]), ["noir"]);
reset(); eq("compactor@승1 해금", checkUnlocks({wins:1},[]), ["compactor"]);

// 도전과제: broker(같은숫자3), twins(2그룹), runts(저랭크4)
const trips=[card(0,5),card(1,5),card(2,5),card(3,2),card(0,8)];
reset(); eq("broker 트리플 해금", checkUnlocks({},trips).includes("broker"), true);
const twoPair=[card(0,5),card(1,5),card(2,7),card(3,7),card(0,2)];
reset(); eq("twins 투페어 해금", checkUnlocks({},twoPair), ["twins"]);
reset(); eq("broker 투페어선 안열림", checkUnlocks({},twoPair).includes("broker"), false);
const lows=[card(0,1),card(1,2),card(2,3),card(3,1),card(0,8)];
reset(); eq("runts 저랭크4 해금", checkUnlocks({},lows), ["runts"]);
const highs=[card(0,5),card(1,6),card(2,7),card(3,8),card(0,4)];
reset(); eq("runts 고랭크 안열림", checkUnlocks({},highs).includes("runts"), false);

// 소급(grandfather): 빈 store + 기존 stats → 등급만 자동 해금, 줄 조건은 그대로 잠김
reset(); const g=checkUnlocks({bestAnte:5,wins:1},[]);
eq("grandfather noir+compactor", g.slice().sort(), ["compactor","noir"]);
eq("grandfather broker 잠김", isUnlocked("broker"), false);

// Gem 클러스터
const enh3=[card(0,5,"wild"),card(1,6,"gold"),card(2,7,"mult"),card(3,2),card(0,3)];
reset(); eq("lapidary enh3 해금", checkUnlocks({},enh3).includes("lapidary"), true);
reset(); eq("prism 3종동시 해금", checkUnlocks({},enh3).includes("prism"), true);
const enh2=[card(0,5,"wild"),card(1,6,"wild"),card(2,7,"gold"),card(3,2),card(0,3)];
reset(); eq("prism 2종선 안열림", checkUnlocks({},enh2).includes("prism"), false);

// Apex 클러스터
const hi8=[card(0,8),card(1,8),card(2,8),card(3,7),card(0,2)];
reset(); eq("highmult 8×3 해금", checkUnlocks({},hi8).includes("highmult"), true);
const hi5=[card(0,8),card(1,7),card(2,8),card(3,7),card(0,7),card(1,2),card(2,3),card(3,4)];
reset(); eq("magnate 7·8×5 해금", checkUnlocks({},hi5).includes("magnate"), true);
reset(); eq("magnate 4장선 안열림", checkUnlocks({},hi8).includes("magnate"), false);

// Cartel 클러스터
const rank4=[card(0,5),card(1,5),card(2,5),card(3,5),card(0,2)];
reset(); eq("echo 같은수4 해금", checkUnlocks({},rank4).includes("echo"), true);
const five=[card(0,5),card(1,5),card(2,5),card(3,5),card(0,5),card(1,2),card(2,3),card(3,4)];
reset(); eq("loaded 파이브카드 해금", checkUnlocks({},five).includes("loaded"), true);
reset(); eq("loaded 포카드선 안열림", checkUnlocks({},[card(0,5),card(1,5),card(2,5),card(3,5),card(0,2),card(1,3),card(2,4),card(3,6)]).includes("loaded"), false);
const fullChain=[card(0,1),card(0,2),card(1,2),card(1,3),card(2,3),card(2,4),card(3,4),card(0,4)];   // 1-2-2-3-3-4-4-4: 풀하우스+전연결
reset(); eq("climax 전연결+풀하우스 해금", checkUnlocks({},fullChain).includes("climax"), true);

// Parity 클러스터
const ev6=[card(0,2),card(1,4),card(2,6),card(3,8),card(0,2),card(1,4),card(2,3),card(3,5)];   // 짝6
reset(); eq("evenodd 짝6 해금", checkUnlocks({},ev6).includes("evenodd"), true);
const allOdd=[card(0,1),card(1,3),card(2,5),card(3,7),card(0,1),card(1,3),card(2,5),card(3,7)];   // 전홀
reset(); eq("paritybet 전홀 해금", checkUnlocks({},allOdd).includes("paritybet"), true);
reset(); eq("paritybet 혼합선 안열림", checkUnlocks({},ev6).includes("paritybet"), false);

// 중복 해금 안 함
reset(); checkUnlocks({wins:1},[]); eq("재호출 시 빈 배열", checkUnlocks({wins:1},[]), []);

console.log(`\n${fail===0?"✅":"❌"} 부적 해금: ${pass} pass / ${fail} fail`);
process.exit(fail===0?0:1);

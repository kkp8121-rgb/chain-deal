// CHAIN DEAL 부적 해금 조건 검증  ·  실행: node tools/unlock-check.cjs
// ⚠️ index.html 의 STARTER_CHARMS / UNLOCKS / checkUnlocks 로직을 "복제"한 것.
//    index.html 에서 조건을 바꾸면 이 파일도 같이 맞출 것. (repo의 tools/*.cjs 복제 관례)

// ----- index.html 복제 (해금 코어) -----
let STORE = {};                                  // 가짜 localStorage
const STARTER_CHARMS = ["greed","pyro","suited","runner","jackpot"];
function maxRankCount(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let m=0; for(const k in rc) if(rc[k]>m) m=rc[k]; return m; }
function pairGroups(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let g=0; for(const k in rc) if(rc[k]>=2) g++; return g; }
const UNLOCKS = {
  noir:     {cond:(st,row)=> (st.bestAnte||0)>=4,               hint:"안테 4 도달"},
  compactor:{cond:(st,row)=> (st.wins||0)>=1,                   hint:"런 1회 클리어"},
  broker:   {cond:(st,row)=> maxRankCount(row)>=3,              hint:"한 줄에 같은 숫자 3장"},
  twins:    {cond:(st,row)=> pairGroups(row)>=2,                hint:"한 줄에 같은 숫자 2장 그룹 2개"},
  runts:    {cond:(st,row)=> row.filter(c=>c.rank<=3).length>=4, hint:"한 줄에 A·2·3 4장"},
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

// 중복 해금 안 함
reset(); checkUnlocks({wins:1},[]); eq("재호출 시 빈 배열", checkUnlocks({wins:1},[]), []);

console.log(`\n${fail===0?"✅":"❌"} 부적 해금: ${pass} pass / ${fail} fail`);
process.exit(fail===0?0:1);

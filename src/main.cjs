"use strict";
/* ---------- i18n (Step 1b) — 반드시 첫 require: 아래 모든 content 파일이 t()를 재require 없이 공유 ---------- */
const { t } = require('./content/locale/i18n.cjs');
/* ---------- 트럼프 카드 ---------- */
const SUITS=[{k:0,g:"♠",red:false},{k:1,g:"♥",red:true},{k:2,g:"♦",red:true},{k:3,g:"♣",red:false}];
const RANKSTR=["","A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const rankStr=r=>RANKSTR[r], suitG=s=>SUITS[s].g, isRed=s=>SUITS[s].red;
const { registerScreen, showScreen, currentScreen } = require('./ui/router.cjs');
const { registerScreens, openPause, closePause, quitToMenu, mountSettings, mountSummary } = require('./ui/screens.cjs');
const { mkCard, fullDeck, highDeck, DECKS } = require('./content/decks.cjs');
/* ---------- 시드 RNG (데일리 시드 = 결정론적 판) ---------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
let RNG=Math.random;                                  // newGame에서 시드 RNG로 교체
const rng=()=>RNG();
function dailySeed(){ const d=new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); }  // YYYYMMDD
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const ri=n=>Math.floor(rng()*n);

// 연결: 같은 무늬 OR 같은 숫자 OR ±1 연속 (와일드 무조건). 보스 규칙이 일부를 봉인.
// ★Phase 0 Step 2: connect/climbSealed는 순수함수로 src/rules/connect.cjs 로 이동(boss=id문자열|null, 전역 S 미접근).
// 호출부는 전부 bossId()로 S.boss(객체)→id 변환해 넘긴다(placeCard/render 프리뷰/bridgeCount/climax 해금 — 누락 시 조용한 버그).
const { connect, climbSealed } = require('./rules/connect.cjs');
function cardSealed(c){ return S&&S.boss&&S.boss.id==="seal_suit"&&c.suit===0; }
function bossId(){ return (S&&S.boss) ? S.boss.id : null; }

/* ---------- 보스 블라인드 ---------- */
// tmult = 보스마다 룰 가혹도가 달라 목표치를 보정 (점수 깎는 보스일수록 목표↓ → 균형)
// minAnte = 이 보스가 등장 가능한 최소 안테. 도구(상점/부적/스킬) 없는 안테1엔 가혹한 보스 차단.
//   인색한손(손패3→2=수읽기 선택지 삭제)·봉인무늬·스트레이트봉인을 안테2부터(플레이테스트 합의).
//   안테1 풀 = 단색의저주·무딘칼날 (둘 다 손패3 유지, 점수만 깎는 순한 보스 = 워밍업).
// 액트 티어 풀: A1(순함) < A2(중간) < A3(가혹). 각 액트 = 일반 3 + 액트보스 1(actBoss). 액트-final 안테(3·6·8)에 액트보스.
const { BOSSES } = require('./content/bosses.cjs');
const actOf=ante=> ante<=3?1 : ante<=6?2 : 3;
function pickBoss(ante){ const a=actOf(ante), fin=(ante===3||ante===6||ante===8);
  let pool=BOSSES.filter(b=>b.act===a && b.actBoss===fin);
  if(!pool.length) pool=BOSSES.filter(b=>b.act===a);
  return pool[ri(pool.length)]; }

/* ---------- 포커 족보 보너스 (텍사스 서열 라벨 + 빈도보정 가산) ---------- */
// 8장 줄 전체로 '가장 높은 족보 1개' 판정 → 최종 정산에서 가산(곱 아님 = 아슬아슬 보존).
// 계수: 흔한 족보(투페어33%·풀하우스29%·스트레이트24%)는 소액 / 희소(플러시5%·포카드2.5%·스트플0.8%)는 큰 가산.
// 보너스 = round(blindTarget(ante,0) * 계수). 밸런싱 단계에서 노리는봇 시뮬로 정밀 조정 예정.
const { HAND_BONUS } = require('./content/hands.cjs');
const HAND_LABEL={highCard:t('hand.highCard'),pair:t('hand.pair'),twoPair:t('hand.twoPair'),trips:t('hand.trips'),straight:t('hand.straight'),flush:t('hand.flush'),fullHouse:t('hand.fullHouse'),fourKind:t('hand.fourKind'),straightFlush:t('hand.straightFlush'),fiveKind:t('hand.fiveKind')};
// hasRun5는 evalHand 내부에서만 쓰여 미구조분해(hands.cjs가 export는 함)
const { evalHand } = require('./rules/hands.cjs');
// ★Phase 0 Step 4a: 실제 계산(blindBase×HAND_BONUS[hk])은 순수함수 scoreHandBase(rules/scoring.cjs)로 이전됨 —
// 여기선 S.ante를 읽어 ctx를 구성해 넘기는 얇은 래퍼만 유지(render 미리보기·settle 양쪽에서 그대로 재사용).
function handBonus(row){ return scoreHandBase(evalHand(row), {blindBase:blindBase(S.ante), HAND_BONUS}); }   // ★blindBase(스테이크 무관) — 사다리서 목표만 오르고 족보 보너스 쿠션은 안 오르게

/* ---------- 익명 플레이로그 (Google Sheets + Apps Script) ---------- */
// LOG_URL 을 Apps Script 웹앱 URL로 채우면 전송 시작(비우면 no-op). 익명 ID(localStorage)만 보냄 — 개인정보 X.
const LOG_URL="https://script.google.com/macros/s/AKfycbxfieuO3Mtf6YszQrNfhb7Ss8jy9ZhqH9JfAiggFM1QsyAYSl1Zuxp3UBcxcbpc0Er-/exec";
function pid(){ let id=localStorage.getItem("cd_pid"); if(!id){ id="p"+Math.random().toString(36).slice(2,9); localStorage.setItem("cd_pid",id); } return id; }
function logEvent(type,data){ if(!LOG_URL) return; try{ fetch(LOG_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({pid:pid(),type,...(data||{}),t:Date.now()})}); }catch(e){} }

/* ---------- 최고 기록 / 통계 (localStorage, 리텐션) ---------- */
function getStats(){ try{ return JSON.parse(localStorage.getItem("cd_stats"))||{}; }catch(e){ return {}; } }
function saveStats(s){ try{ localStorage.setItem("cd_stats",JSON.stringify(s)); }catch(e){} }
/* ---------- 아웃게임 메타 (localStorage cd_meta) ---------- */
const META_DEFAULT={coins:0,retry:0,goldLv:0,rerollLv:0,maxStake:0,deck:"standard"};   // maxStake=해금된 최고 난이도 사다리(클리어로 N→N+1)
function getMeta(){ try{ const m=JSON.parse(localStorage.getItem("cd_meta")); if(m&&typeof m==="object") return Object.assign({},META_DEFAULT,m); }catch(e){} return {...META_DEFAULT}; }
function saveMeta(m){ try{ localStorage.setItem("cd_meta",JSON.stringify(m)); }catch(e){} }
function renderStats(){ const s=getStats(), el=document.getElementById("stats"); if(!el) return;
  const daily = (S&&S.daily) ? `<span style="color:var(--gold)">🗓 ${t('ui.daily')} #${S.seed}</span> · ` : "";
  el.innerHTML=`${daily}🏆 ${t('ui.best')} <b>${s.bestAnte?`${t('ui.ante')} ${s.bestAnte}`:"—"}</b> · ${s.plays||0}${t('ui.playsSuffix')} <b>${s.wins||0}${t('ui.winsSuffix')}</b> · ${t('ui.bestScore')} <b>${(s.bestScore||0).toLocaleString()}</b> <span style="color:#9b6fd4">›</span>`; }
function statsHTML(){ const s=getStats(), wr=s.plays?Math.round((s.wins||0)/s.plays*100):0;
  return `<h3>🏆 ${t('ui.stats.title')}</h3>
  <div class="hrow"><span>${t('ui.stats.bestReach')}</span><b class="hname">${s.bestAnte?`${t('ui.ante')} ${s.bestAnte}`:"—"}</b></div>
  <div class="hrow"><span>${t('ui.stats.bestScoreRound')}</span><b class="hname">${(s.bestScore||0).toLocaleString()}</b></div>
  <div class="hrow"><span>${t('ui.stats.playsWins')}</span><b class="hname">${s.plays||0}${t('ui.playsSuffix')} / ${s.wins||0}${t('ui.winsSuffix')}</b></div>
  <div class="hrow"><span>${t('ui.stats.winRate')}</span><b class="hname">${wr}%</b></div>
  <p class="drawerNote">💡 ${t('ui.stats.note')}</p>`; }
const BLINDNAME=[t('ui.blind.small'),t('ui.blind.big'),t('ui.blind.boss')];

/* ---------- 상태 ---------- */
const { SLOTS, ANTES, MAX_STAKE, GOLD_BASE, GOLD_K, START_GOLD_PER_LV, REROLL_BASE, CLUSTER_W, META_PRICE, STAKE_T, STAKE_AC } = require('./content/tuning.cjs');
const STAKE_NAMES=[t('ui.stake.name.0'),t('ui.stake.name.1'),t('ui.stake.name.2'),t('ui.stake.name.3'),t('ui.stake.name.4'),t('ui.stake.name.5')], STAKE_DESC=[t('ui.stake.desc.0'),t('ui.stake.desc.1'),t('ui.stake.desc.2'),t('ui.stake.desc.3'),t('ui.stake.desc.4'),t('ui.stake.desc.5')];   // 각 티어 시그니처 규칙(누적)
function goldEarned(score,target){ const gb=(S&&S.stake>=2)?0:GOLD_BASE; return Math.floor(gb + Math.max(0, score/target - 1)*GOLD_K); }   // St2: 통과 골드 바닥 제거(초과분만)
const { spillover } = require('./rules/economy.cjs');
let S=null;
let MUTED = false; try{ MUTED = localStorage.getItem("cd_muted")==="1"; }catch(e){}
const { CHARMS } = require('./content/charms.cjs');
const has=id=>S.owned.includes(id);

/* ---------- 부적 해금 (메타: localStorage cd_unlocked) ---------- */
// 시작 5종(코어)은 항상 해금. B1 신규 5종은 업적/도전과제로 해금. 라운드 점수 규칙엔 영향 0(메타층).
const STARTER_CHARMS=["greed","pyro","suited","runner","jackpot"];
function maxRankCount(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let m=0; for(const k in rc) if(rc[k]>m) m=rc[k]; return m; }
function pairGroups(row){ const rc={}; for(const c of row) if(c.enh!=="wild") rc[c.rank]=(rc[c.rank]||0)+1; let g=0; for(const k in rc) if(rc[k]>=2) g++; return g; }
// 위치-맥락 부적 메트릭 (정산·해금 공용, ★run-sim handBonus 미러 — 드리프트 주의)
function bridgeCount(row){ const b=bossId(); let n=0; for(let i=1;i<=6 && i+1<row.length;i++){ if(connect(row[i],row[i-1],b) && connect(row[i],row[i+1],b)) n++; } return n; }   // 양옆 모두 연결되는 내부 카드(다리). bossId()로 보스 봉인에 적응
function maxAscLen(row){ let mx=1,cur=1; for(let i=1;i<row.length;i++){ if(row[i].enh!=="wild"&&row[i-1].enh!=="wild"&&row[i].rank>row[i-1].rank){ cur++; if(cur>mx)mx=cur; } else cur=1; } return mx; }   // 최장 오름차순 연속(엄격>, 와일드서 끊김)
function edgeVal(row){ const r=c=>c&&c.enh!=="wild"?c.rank:0; return r(row[0])+r(row[3])+r(row[7]); }   // 0·3·7 칸 숫자 합(와일드=0)
// 각 잠금 부적의 해금 조건 cond(stats,row)→bool + 컬렉션 힌트. 전부 settle 시점 판정(런중 추적 0).
const UNLOCKS={
  noir:     {cond:(st,row)=> (st.bestAnte||0)>=4,                hint:t('unlock.noir.hint')},
  compactor:{cond:(st,row)=> (st.wins||0)>=1,                    hint:t('unlock.compactor.hint')},
  broker:   {cond:(st,row)=> maxRankCount(row)>=3,               hint:t('unlock.broker.hint')},
  twins:    {cond:(st,row)=> pairGroups(row)>=2,                 hint:t('unlock.twins.hint')},
  runts:    {cond:(st,row)=> row.filter(c=>c.rank<=3).length>=4, hint:t('unlock.runts.hint')},
  bridge:   {cond:(st,row)=> bridgeCount(row)>=3,                hint:t('unlock.bridge.hint')},
  stair:    {cond:(st,row)=> maxAscLen(row)>=5,                  hint:t('unlock.stair.hint')},
  keystone: {cond:(st,row)=> row.length>=8 && row[0].rank>=7 && row[3].rank>=7 && row[7].rank>=7, hint:t('unlock.keystone.hint')},
  lapidary: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:t('unlock.lapidary.hint')},
  jewelbox: {cond:(st,row)=> row.filter(c=>c.enh).length>=3, hint:t('unlock.jewelbox.hint')},
  prism:    {cond:(st,row)=>{ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } return !!(w&&g&&m); }, hint:t('unlock.prism.hint')},
  highmult: {cond:(st,row)=> row.filter(c=>c.rank===8).length>=3, hint:t('unlock.highmult.hint')},
  magnate:  {cond:(st,row)=> row.filter(c=>c.rank>=7).length>=5, hint:t('unlock.magnate.hint')},
  echo:   {cond:(st,row)=> maxRankCount(row)>=4, hint:t('unlock.echo.hint')},
  loaded: {cond:(st,row)=> evalHand(row)==="fiveKind", hint:t('unlock.loaded.hint')},
  climax: {cond:(st,row)=>{ if(row.length<8) return false; if(!["fullHouse","fourKind","straightFlush","fiveKind"].includes(evalHand(row))) return false; const b=bossId(); let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1],b)){ cur++; if(cur>L)L=cur; } else cur=1; } return L>=8; }, hint:t('unlock.climax.hint')},
  twotone:  {cond:(st,row)=>{ let r=0,b=0; for(const c of row) if(c.enh!=="wild"){ if(c.suit===1||c.suit===2)r++; else b++; } return Math.max(r,b)>=6; }, hint:t('unlock.twotone.hint')},
};
function getUnlocked(){ try{ const a=JSON.parse(localStorage.getItem("cd_unlocked")); if(Array.isArray(a)) return a; }catch(e){} return STARTER_CHARMS.slice(); }
function saveUnlocked(a){ try{ localStorage.setItem("cd_unlocked",JSON.stringify(a)); }catch(e){} }
function isUnlocked(id){ return STARTER_CHARMS.includes(id) || getUnlocked().includes(id); }
// settle 직후 호출: stats/row로 새로 충족된 잠금 부적을 cd_unlocked에 추가, 새로 해금된 id 배열 반환
function checkUnlocks(st,row){ const cur=getUnlocked(), fresh=[]; for(const id in UNLOCKS){ if(!cur.includes(id) && UNLOCKS[id].cond(st,row||[])){ cur.push(id); fresh.push(id); } } if(fresh.length) saveUnlocked(cur); return fresh; }
function charmsHTML(){
  let h=`<h3>🧿 ${t('ui.charms.title')}</h3><p class="drawerSub">${t('ui.charms.sub')}</p>`;
  for(const c of CHARMS){
    if(isUnlocked(c.id)) h+=`<div class="hrow"><span>${artEmblemHTML(c,false,20)}<b class="hname">${c.name}</b><br><span class="hdesc">${c.desc}</span></span><span class="hbig">✓ ${t('ui.charms.unlocked')}</span></div>`;
    else h+=`<div class="hrow" style="opacity:.55"><span>${artEmblemHTML(c,true,20)}<b class="hname">🔒 ？？？</b><br><span class="hdesc">${t('ui.charms.lockedCond')} ${(UNLOCKS[c.id]||{}).hint||t('ui.charms.private')}</span></span><span class="hsmall">${t('ui.charms.lockedTag')}</span></div>`;   // ★불변식: 시작 부적 아닌 모든 부적은 UNLOCKS 항목 필요(없으면 영구 잠김)
  }
  const n=CHARMS.filter(c=>isUnlocked(c.id)).length;
  h+=`<p class="drawerNote">🧿 ${t('ui.charms.unlocked')} ${n} / ${CHARMS.length}</p>`;
  return h;
}
/* ---------- 아웃게임 메타 상점 (드로어 'meta') ---------- */
function metaHTML(){
  const m=getMeta();
  const gN = m.goldLv<3 ? META_PRICE.gold[m.goldLv] : null;
  const rN = m.rerollLv<2 ? META_PRICE.reroll[m.rerollLv] : null;
  return `<h3>🪙 ${t('ui.meta.title')}</h3><p class="drawerSub">${t('ui.meta.sub')}</p>
  <div class="hrow"><span><b class="hname">🪙 ${t('ui.meta.coins')}</b></span><b class="hbig">${m.coins}</b></div>
  <div class="hrow"><span><b class="hname">🎟 ${t('ui.meta.retryTitle')}</b><br><span class="hdesc">${t('ui.meta.retryDesc').replace('{n}',m.retry)}</span></span>${ m.retry<3 ? `<button onclick="buyMeta('retry')" ${m.coins<META_PRICE.retry?"disabled":""}>🪙 ${META_PRICE.retry}</button>` : `<span class="hsmall">${t('ui.meta.max')}</span>` }</div>
  <div class="hrow"><span><b class="hname">💰 ${t('ui.meta.goldTitle')}</b><br><span class="hdesc">${t('ui.meta.goldDesc').replace('{g}',m.goldLv*3).replace('{lv}',m.goldLv)}</span></span>${ gN!=null ? `<button onclick="buyMeta('gold')" ${m.coins<gN?"disabled":""}>🪙 ${gN}</button>` : `<span class="hsmall">${t('ui.meta.max')}</span>` }</div>
  <div class="hrow"><span><b class="hname">🔄 ${t('ui.meta.rerollTitle')}</b><br><span class="hdesc">${t('ui.meta.rerollDesc').replace('{r}',m.rerollLv).replace('{lv}',m.rerollLv)}</span></span>${ rN!=null ? `<button onclick="buyMeta('reroll')" ${m.coins<rN?"disabled":""}>🪙 ${rN}</button>` : `<span class="hsmall">${t('ui.meta.max')}</span>` }</div>
  <p class="drawerNote">💡 ${t('ui.meta.note')}</p>`;
}
function buyMeta(kind){
  const m=getMeta();
  if(kind==="retry"){ if(m.retry>=3||m.coins<META_PRICE.retry) return; m.coins-=META_PRICE.retry; m.retry++; if(S) S.retry=(S.retry||0)+1; }
  else if(kind==="gold"){ if(m.goldLv>=3) return; const c=META_PRICE.gold[m.goldLv]; if(m.coins<c) return; m.coins-=c; m.goldLv++; }
  else if(kind==="reroll"){ if(m.rerollLv>=2) return; const c=META_PRICE.reroll[m.rerollLv]; if(m.coins<c) return; m.coins-=c; m.rerollLv++; }
  else return;
  saveMeta(m); try{beep(660,.06);}catch(e){} openDrawer('meta');
}

function newGame(seed, stake, variant){
  showScreen('run');
  const daily = seed!=null;
  const useSeed = daily ? seed : Math.floor(Math.random()*2147483647);
  RNG = mulberry32(useSeed);                          // ★ S 생성 전 시드 설정 (shuffle/pickBoss가 시드 사용)
  const meta=getMeta();
  const v = DECKS.find(d=>d.id===(variant!=null?variant:meta.deck)) || DECKS[0];
  if(meta.deck!==v.id){ meta.deck=v.id; saveMeta(meta); }   // 마지막 선택 영속
  S={ante:1, blind:0, anteBoss:pickBoss(1), owned:[], over:false, busy:false, settled:false,
     bonusHand:0, rerollMax:meta.rerollLv, gold:meta.goldLv*START_GOLD_PER_LV, retry:meta.retry, seed:useSeed, daily, runBest:0,
     stake:Math.max(0,Math.min(MAX_STAKE, stake|0)),   // 난이도 사다리(0~5). 모든 티어 델타가 이 전역을 읽음(stake 0=no-op)
     variant:v.id, dmult:v.dmult,                       // 시작덱 변형(id) + 목표 스칼라
     showPreview:document.getElementById("pvToggle").checked, deck:shuffle(v.build()), discard:[]};
  logEvent("run_start",{seed:useSeed, daily:daily?1:0, stake:S.stake});
  startBlind();
  renderStats();
}
// 블라인드 목표: 안테 기본 × (작은1 / 큰1.5 / 보스2.2)
const { blindBase, sparkComp } = require('./rules/blinds.cjs');
function stakeMult(ante){ const st=S?S.stake:0; return 1+STAKE_T[st]+STAKE_AC[st]*(ante-1); }   // st0→1(no-op)
function blindTarget(ante,blind){
  return Math.round(blindBase(ante)*sparkComp(ante)*stakeMult(ante)*(S?S.dmult:1) * (blind===0?1 : blind===1?1.4 : 1.6));   // sparkComp=불씨덱 front-loaded 보정. dmult=시작덱 보정(표준 1=no-op).
}
function draw(){ if(S.deck.length===0){ S.deck=shuffle(S.discard); S.discard=[]; } return S.deck.length? S.deck.pop() : mkCard(ri(4),1+ri(8)); }  // fallback도 게임 범위(A~8). 손패 회수 수정 후엔 거의 호출 안 됨
function startBlind(){
  S.boss = (S.blind===2 || (S.stake>=6 && S.blind===1 && S.ante>=2)) ? S.anteBoss : null;   // St6: 보스 룰이 큰 블라인드에도(안테1 면제·tmult 제외)
  const baseHand = (S.boss && (S.boss.id==="stingy" || (S.stake>=4 && S.blind===2))) ? 2 : 3;   // St4: 보스전 손패 3→2. 기본 3택1.
  S.handSize = baseHand + S.bonusHand;                          // 손패 확장 스킬로 성장
  S.row=[]; S.score=0; S.settled=false; S.busy=false; S.over=false;   // ★ S.score=0 (NaN 버그 수정)
  S.rerolls=S.rerollMax;
  S.target=blindTarget(S.ante,S.blind);
  if(S.boss && S.blind===2) S.target=Math.round(S.target*S.boss.tmult);   // tmult는 진짜 보스 블라인드만(St6 큰블라인드는 룰만, 목표 경감 없음)
  S.hand=Array.from({length:S.handSize}, draw);
  if(S.blind===0 && (S.ante===4||S.ante===7)){ banner(`⚔ ACT ${actOf(S.ante)} ${t('ui.banner.actEnterSuffix')}`, "var(--gold)"); try{boom(150);}catch(e){} }
  else banner(S.boss? `${S.boss.actBoss?"👑 "+t('ui.boss.actBoss'):S.boss.icon+" "+t('ui.boss.bossSuffix')}: ${S.boss.name} — ${S.boss.desc}` : "", S.boss?"#ff9a9a":"");
  render();
}
function togglePreview(){ if(S){ S.showPreview=document.getElementById("pvToggle").checked; render(); } }
function rerollHand(){   // 손패 전체를 새로 뽑음 (리롤 스킬로 획득한 횟수만큼)
  if(!S||S.over||S.busy||S.settled||S.rerolls<=0) return;
  S.discard.push(...S.hand);
  S.hand=Array.from({length:S.handSize}, draw);
  S.rerolls--; render(); beep(280,.06,"square");
}

/* ---------- 점수 엔진 (Phase 0 Step 3a placeCard훅 + 3b settle훅 + 4a scoreCard/scoreHandBase 전체경로 추출) ---------- */
// placeCard/settle이 각각 순수 ctx를 구성해 rules/scoring.cjs에 넘긴다(엔진은 S/document 미접근).
// ownedHooks = 보유 부적(has)만 CHARMS에서 걸러 hooks 필드만 넘김 — scoring.cjs가 content/charms.cjs를
// 직접 require하면 build.mjs 텍스트 스플라이스가 CHARMS를 중복 선언해 파싱이 깨지므로 여기서 필터링해 전달.
// ★Step 4a: connect/climbSealed 연결판정·chain rank합·boss base/mult/cap 효과·enh(gold/mult-enh)까지
// scoreCard(rules/scoring.cjs)로 이전 — placeCard는 이제 push+draw 후 scoreCard 1회 호출로 축소.
const { scoreCard, scoreHandBase, scoreSettle } = require('./rules/scoring.cjs');
const { ART_PAL, ART_C, ART_ACCENT, artDrawCardFace, artFaceHTML, artHydrate, artEmblemHTML, artContactSheet, artSheetLoad, artSheetReady } = require('./art/art.cjs');
const { rStageInit, rActive, rStageResize } = require('./render/render.cjs');
function scoreCtx(){ return { has, boss:id=>!!(S.boss&&S.boss.id===id), isRed, liveDeckCount:S.deck.length+S.discard.length+S.hand.length+S.row.length,
  connect:(a,b)=>connect(a,b,bossId()), climbSealed:(a,b)=>climbSealed(a,b,bossId()),
  ownedHooks: CHARMS.filter(c=>c.hooks && has(c.id)).map(c=>c.hooks) }; }
// settle 전용 ctx(정산 1회 구성) — blindBase(S.ante)를 1회 계산해 넘김(원본도 매 줄 같은 값을 반복 호출했을 뿐,
// ante는 정산 중 안 바뀜). connect는 현재 보스로 바인딩(climax 전용). bridgeCount/maxAscLen/edgeVal은
// main.cjs 원본 함수 재사용(위치-맥락 헬퍼, UNLOCKS와 공용 — 중복 구현 금지).
function settleCtx(){ return { has, boss:id=>!!(S.boss&&S.boss.id===id), connect:(a,b)=>connect(a,b,bossId()), blindBase:blindBase(S.ante),
  bridgeCount, maxAscLen, edgeVal,
  ownedHooks: CHARMS.filter(c=>c.hooks && has(c.id)).map(c=>c.hooks) }; }

/* ---------- 핵심 로직 ---------- */
function placeCard(hi){
  if(S.over||S.busy||S.settled||S.row.length>=SLOTS) return;
  const card=S.hand[hi]; const left=S.row[S.row.length-1];
  S.row.push(card); S.hand[hi]=draw();

  const { gained, base, runLen, bonus } = scoreCard(S.row, card, left, scoreCtx());   // 전체 per-card 점수 경로(rules/scoring.cjs, Step 4a)
  S.score+=gained; render();
  juicePlace(S.row.length-1, base, runLen, bonus, gained);
  if(S.row.length>=SLOTS){ S.busy=true; setTimeout(settle,700); }
}

let _tallyNext=null;
function tallyNext(){ document.getElementById("tally").classList.remove("show"); const f=_tallyNext; _tallyNext=null; if(f) f(); }
// 런 종료(패배 확정/최종 승리) 시 1회: 남은 골드의 1/10을 메타 코인으로 반출 + 남은 재도전권 영속화
function cashOut(){ if(!S) return; const meta=getMeta(); meta.retry=S.retry; meta.coins += spillover(S.gold); saveMeta(meta); }
// 재도전권: 패배 정산에서 같은 덱·보스로 그 블라인드 재시작 (★카드 불변식: row/hand는 settle서 이미 회수됨 → deck+discard 전량 회수)
function useRetry(){
  if(!S || S.retry<=0) return;
  S.retry--;
  document.getElementById("tally").classList.remove("show");
  S.deck = shuffle(S.deck.concat(S.discard)); S.discard=[];
  S.over=false; S.settled=false;
  try{beep(420,.06,"square");}catch(e){}
  startBlind();
}
function settle(){
  if(S.settled) return; S.settled=true;
  const chain=S.score;                               // 족보 보너스 전 = 체인 점수
  const hk=evalHand(S.row); let hb=handBonus(S.row); // 족보 판정·보너스 (discard 전)
  hb = scoreSettle(hb, hk, S.row, settleCtx());       // broker(override)/twins/bridge/stair/keystone/prism/jewelbox/magnate/loaded/climax/twotone (부적 훅, content/charms.cjs 선언)
  S.score+=hb;                                       // 최종 = 체인 + 족보 보너스
  S.discard.push(...S.row);
  S.discard.push(...S.hand);                          // ★ 버그 수정: 손패도 덱으로 회수 (안 하면 매 라운드 3장 유실 → 덱 고갈 → fallback 카드 양산)
  const pass=S.score>=S.target, wasBoss=(S.blind===2);
  // 정산 표 채우기
  document.getElementById("tChain").textContent=chain.toLocaleString();
  const hr=document.getElementById("tHandRow");
  if(hb>0){ hr.style.display="flex"; document.getElementById("tHand").textContent=`🎴 ${HAND_LABEL[hk]}`; document.getElementById("tBonus").textContent=`+${hb.toLocaleString()}`; }
  else hr.style.display="none";
  document.getElementById("tFinal").textContent=S.score.toLocaleString();
  document.getElementById("tTarget").textContent=`${t('ui.target')} ${S.target.toLocaleString()}`;
  const res=document.getElementById("tResult"), btn=document.getElementById("tBtn");
  if(pass){
    S.gold += goldEarned(S.score, S.target);                 // 통과 시 초과율 환전
    document.getElementById("hGold").textContent=S.gold;
    res.textContent = wasBoss ? `${S.anteBoss.icon} ${t('ui.tally.bossDefeated')}` : "✦ "+t('ui.tally.pass'); res.className="tallyResult pass";
    logEvent("clear",{ante:S.ante,blind:S.blind,score:S.score,target:S.target,hand:HAND_LABEL[hk]});
    if(wasBoss && S.ante>=ANTES){ btn.textContent="🏆 "+t('ui.tally.victory'); _tallyNext=victory; }
    else { btn.textContent=t('ui.tally.nextShop'); _tallyNext=openShop; }
  } else {
    S.over=true;
    res.textContent="💀 "+t('ui.tally.fail'); res.className="tallyResult fail";
    logEvent("death",{ante:S.ante,blind:S.blind,score:S.score,target:S.target,hand:HAND_LABEL[hk]});
    btn.textContent=t('ui.tally.newGame'); _tallyNext=()=>{ cashOut(); showScreen('summary', { win:false }); };
  }
  // 최고 기록 / 통계 갱신 (리텐션)
  const stx=getStats();
  stx.bestScore=Math.max(stx.bestScore||0, S.score);
  S.runBest=Math.max(S.runBest||0, S.score);        // 이번 런 최고 라운드 점수 (리더보드용)
  let newRec=false;
  if(!pass || (wasBoss && S.ante>=ANTES)){          // 런 종료(패배 또는 최종 승리) 시 집계
    stx.plays=(stx.plays||0)+1;
    if(pass) stx.wins=(stx.wins||0)+1;
    if(S.ante>(stx.bestAnte||0)){ stx.bestAnte=S.ante; newRec=true; }
    submitScore(S.runBest);                         // ★ 런 종료 시 리더보드 제출
    S.lastResult={daily:!!S.daily, seed:S.seed, ante:S.ante, best:S.runBest, won:pass, stake:S.stake||0};   // 공유용 스냅샷
  }
  saveStats(stx);
  // stx.bestAnte는 런 종료시에만 갱신되므로, '현재 도달 안테'를 즉시 반영해 noir 해금 지연 방지(저장 stats·newRec엔 영향 X)
  const freshUnlocks=checkUnlocks({...stx, bestAnte:Math.max(stx.bestAnte||0, S.ante)}, S.row);   // + 이번 줄(S.row 8장)로 도전과제 판정
  const ur=document.getElementById("tUnlockRow");
  if(freshUnlocks.length){ ur.style.display="flex";
    document.getElementById("tUnlock").innerHTML=`🔓 ${t('ui.tally.newUnlock')} <b>${freshUnlocks.map(id=>CHARMS.find(c=>c.id===id).name).join(", ")}</b>`;
    setTimeout(()=>{ beep(720,.07); setTimeout(()=>beep(960,.09),90); },220);
  } else ur.style.display="none";
  document.getElementById("tRecord").style.display = newRec ? "block" : "none";
  { const rt=document.getElementById("tRetry");
    if(!pass && S.retry>0){ rt.style.display="block"; rt.textContent=`🎟 ${t('ui.tally.useRetry')} ${S.retry}`; }
    else rt.style.display="none"; }
  document.getElementById("tShare").style.display = (!pass || (wasBoss && S.ante>=ANTES)) ? "block" : "none";   // 런 종료(승/패)에만 공유
  render(); renderStats();
  revealTally(chain, hb, S.score, S.target, pass, wasBoss);
}
function victory(){
  cashOut();
  { const m=getMeta(); const nx=Math.min(MAX_STAKE,(S.stake||0)+1); if(nx>m.maxStake){ m.maxStake=nx; saveMeta(m);   // 스테이크 N 클리어 → N+1 해금
      setTimeout(()=>{ banner(`🔓 ${t('ui.victory.unlockPrefix')} St${nx} ${STAKE_NAMES[nx]} ${t('ui.victory.unlockSuffix')} (${STAKE_DESC[nx]})`, "var(--gold)"); try{beep(720,.08); setTimeout(()=>beep(960,.1),100);}catch(e){} }, 1500); } }
  logEvent("win",{ante:S.ante,score:S.score,stake:S.stake});
  S.over=true; S.score=0;
  banner(t('ui.victory.banner'),"var(--gold)");
  flash("#ffd15c"); boom(200); setTimeout(()=>{flash("#ffffff22");boom(150);},250);
  // 화면 가득 축포
  for(let k=0;k<4;k++) setTimeout(()=>sparkBurst(document.getElementById("table"),34,"#ffd15c"),k*180);
  showScreen('summary', { win:true });
}

/* ---------- 덱빌딩 상점 (블라인드마다) ---------- */
function ownsCluster(cl){ for(const c of CHARMS) if(c.cluster===cl && has(c.id)) return true; return false; }
function offerWeight(o){ if(o.type!=="charm" || !o.charm.cluster) return 1; return ownsCluster(o.charm.cluster) ? 1 : CLUSTER_W; }   // 미투자 클러스터 charm만 감량
function weightedSample(pool, n){   // 가중 비복원 샘플 (rng=시드 RNG → 데일리 결정론 유지)
  const p=pool.slice(), out=[];
  for(let k=0;k<n && p.length;k++){
    let tot=0; for(const o of p) tot+=offerWeight(o);
    let r=rng()*tot, idx=p.length-1;
    for(let i=0;i<p.length;i++){ r-=offerWeight(p[i]); if(r<=0){ idx=i; break; } }
    out.push(p[idx]); p.splice(idx,1);
  }
  return out;
}
function shopPool(){
  const pool=[];
  CHARMS.filter(c=>!has(c.id) && isUnlocked(c.id)).forEach(c=>pool.push({type:"charm",charm:c,name:c.name,desc:c.desc,cost:(c.cost||8)}));
  pool.push({type:"thin", name:t('ui.shop.thin.name'), desc:t('ui.shop.thin.desc'), cost:3});
  pool.push({type:"copy", name:t('ui.shop.copy.name'), desc:t('ui.shop.copy.desc'), cost:5});
  pool.push({type:"enh", enh:"wild", name:t('ui.shop.enhWild.name'), desc:t('ui.shop.enhWild.desc'), cost:8});
  pool.push({type:"enh", enh:"mult", name:t('ui.shop.enhMult.name'), desc:t('ui.shop.enhMult.desc'), cost:5});
  pool.push({type:"enh", enh:"gold", name:t('ui.shop.enhGold.name'), desc:t('ui.shop.enhGold.desc'), cost:5});
  pool.push({type:"add", name:t('ui.shop.add.name'), desc:t('ui.shop.add.desc'), cost:3});
  pool.push({type:"hand", name:t('ui.shop.hand.name'), desc:t('ui.shop.hand.desc'), cost:8});
  pool.push({type:"reroll", name:t('ui.shop.reroll.name'), desc:t('ui.shop.reroll.desc'), cost:5});
  return pool;
}
function openShop(){
  S.shopRerolls=0;
  S.shopOffers = weightedSample(shopPool(),3).map(o=>({...o, sold:false}));
  document.getElementById("shopTitle").textContent=`${t('ui.ante')} ${S.ante} · ${BLINDNAME[S.blind]} ${t('ui.shop.cleared')} (${t('ui.shop.deckLabel')} ${S.deck.length+S.discard.length}${t('ui.count.jang')})`;
  renderShop();
  document.getElementById("shop").classList.add("show");
}
function renderShop(){
  const body=document.getElementById("shopBody"); body.innerHTML="";
  const g=document.createElement("div"); g.className="shopGold"; g.innerHTML=`💰 ${t('ui.gold')} <b>${S.gold}</b>`; body.appendChild(g);
  const off=document.createElement("div"); off.className="offer";
  S.shopOffers.forEach((p,i)=>{ const afford=!p.sold && S.gold>=p.cost;
    const d=document.createElement("div"); d.className="ocard"+(p.sold?" sold":afford?"":" cantafford");
    d.innerHTML=`${p.type==="charm"?artEmblemHTML(p.charm,false,24):""}<div class="on">${p.name}</div><div class="od">${p.desc}</div><div class="ocost">${p.sold?"✓ "+t('ui.shop.purchased'):"💰 "+p.cost}</div>`;
    if(afford) d.onclick=()=>buyShop(i);
    off.appendChild(d); });
  body.appendChild(off);
  artHydrate(body);
  const rrCost=REROLL_BASE+S.shopRerolls, canRR=S.gold>=rrCost;
  const rr=document.createElement("div"); rr.style.marginTop="10px";
  rr.innerHTML=`<button onclick="rerollShop()"${canRR?"":" disabled style='opacity:.45;cursor:not-allowed'"}>🔄 ${t('ui.shop.rerollOffers')} (💰${rrCost})</button>`;
  body.appendChild(rr);
  const skip=document.createElement("div"); skip.style.marginTop="14px";
  skip.innerHTML=`<button onclick="advanceBlind()">${t('ui.shop.leave')} → (${t('ui.gold')} ${S.gold} ${t('ui.shop.have')})</button>`;
  body.appendChild(skip);
}
function rerollShop(){
  const cost=REROLL_BASE+S.shopRerolls;
  if(S.gold<cost) return;
  S.gold-=cost; S.shopRerolls++;
  S.shopOffers = weightedSample(shopPool(),3).map(o=>({...o, sold:false}));   // 보유 charm은 shopPool !has로 자동 제외 · 가중 샘플
  document.getElementById("hGold").textContent=S.gold;
  try{beep(500,.05);}catch(e){}
  renderShop();
}
function buyShop(i){
  const p=S.shopOffers[i]; if(!p || p.sold || S.gold<p.cost) return;
  S.gold-=p.cost; p.sold=true; document.getElementById("hGold").textContent=S.gold; try{beep(540,.05);}catch(e){}
  if(p.type==="charm"){ S.owned.push(p.charm.id); renderShop(); }
  else if(p.type==="hand"){ S.bonusHand++; renderShop(); }
  else if(p.type==="reroll"){ S.rerollMax++; renderShop(); }
  else if(p.type==="add"){ pickSuitToAdd(); }
  else pickDeckCard(p);   // thin/copy/enh → 카드 선택 후 renderShop 복귀
}
function pickDeckCard(p){
  const body=document.getElementById("shopBody");
  body.innerHTML=`<div style="font-size:13px;color:#aab3d6">${p.type==="thin"?t('ui.pick.remove'):p.type==="copy"?t('ui.pick.copy'):t('ui.pick.enh')} ${t('ui.pick.cardSuffix')}</div>`;
  const grid=document.createElement("div"); grid.className="deckgrid";
  const refs=[...S.deck, ...S.discard];
  refs.sort((a,b)=> a.suit-b.suit || a.rank-b.rank);
  refs.forEach(c=>{ const el=cardEl(c); el.onclick=()=>{ if(p.type==="thin") removeCard(c); else if(p.type==="copy") S.deck.push({suit:c.suit,rank:c.rank,enh:c.enh}); else c.enh=p.enh; renderShop(); }; grid.appendChild(el); });
  body.appendChild(grid);
}
function removeCard(card){ let i=S.deck.indexOf(card); if(i>=0){S.deck.splice(i,1);return;} i=S.discard.indexOf(card); if(i>=0) S.discard.splice(i,1); }
function pickSuitToAdd(){
  const body=document.getElementById("shopBody");
  body.innerHTML=`<div style="font-size:13px;color:#aab3d6">${t('ui.pick.suit')}</div>`;
  const grid=document.createElement("div"); grid.className="offer";
  SUITS.forEach(su=>{ const d=document.createElement("div"); d.className="ocard"; d.style.minWidth="80px";
    d.innerHTML=artFaceHTML({suit:su.k,rank:8,enh:null},"suitpick");
    d.onclick=()=>{ S.deck.push(mkCard(su.k,7+ri(2))); shuffle(S.deck); renderShop(); }; grid.appendChild(d); });
  body.appendChild(grid);
  artHydrate(grid);
}
function advanceBlind(){
  S.shopOffers=null;
  document.getElementById("shop").classList.remove("show");
  if(S.blind<2){ S.blind++; }
  else { S.ante++; S.blind=0; S.anteBoss=pickBoss(S.ante); }
  startBlind();
}

/* ---------- 렌더 ---------- */
function cardEl(card){
  const el=document.createElement("div"); el.className="pcard "+(isRed(card.suit)?"red":"black")+(cardSealed(card)?" sealed":"");
  el.appendChild(artDrawCardFace(card));   // 절차적 픽셀 페이스(v-art M1) — 표시 전용, 로직 무접촉
  return el;
}
let cellEls=[];
function render(){
  if(!S) return;
  document.getElementById("hAnte").textContent=S.ante;
  { const sc=document.getElementById("stakeChip"); if(sc){ if(S.stake>0){ sc.style.display=""; document.getElementById("hStake").textContent=S.stake; } else sc.style.display="none"; } }
  renderStakeLbl();
  { const gc=document.getElementById("hGold"); if(gc) gc.textContent=S.gold; }
  const pct=Math.min(100,Math.round(S.score/S.target*100));
  document.getElementById("fill").style.width=pct+"%";
  document.getElementById("barlbl").textContent=`${S.score} / ${S.target}`;
  document.getElementById("deckinfo").innerHTML=`${t('ui.deckinfo.deck')} ${S.deck.length}${t('ui.count.jang')} · ${t('ui.deckinfo.discard')} ${S.discard.length}${t('ui.count.jang')} <span style="color:#9b6fd4;text-decoration:underline">${t('ui.deckinfo.viewDeck')}</span>`;
  // 안테 진행 점
  const ad=document.getElementById("antedots"); ad.innerHTML="";
  for(let a=1;a<=ANTES;a++){ const d=document.createElement("span"); d.className="adot"+(a<S.ante?" done":a===S.ante?" cur":""); ad.appendChild(d); }
  // 블라인드 정보
  const bi=document.getElementById("blindinfo");
  if(S.blind===2 && S.boss){ bi.className="blindinfo boss"; bi.innerHTML=`👑 ${t('ui.boss.label')} <b>${S.boss.icon} ${S.boss.name}</b> — ${S.boss.desc}`; }
  else { bi.className="blindinfo"; bi.innerHTML=`${t('ui.ante')} ${S.ante} · ${BLINDNAME[S.blind]} &nbsp;·&nbsp; <span style="color:#8a93b6">${t('ui.nextBoss')}</span> ${S.anteBoss.icon} ${S.anteBoss.name}`; }
  // 족보 보너스 미리보기 (체인이 메인, 족보는 보조) + 터치=족보표 안내
  const hbEl=document.getElementById("handbonus");
  const hint=` <span class="hbhint">👆 ${t('ui.handTable')}</span>`;
  if(S.row.length===0){ hbEl.innerHTML=`<span class="hbdim">🎴 ${t('ui.handBonus.label')} — ${t('ui.handBonus.empty')}</span>`+hint; }
  else { const hk=evalHand(S.row), hb=handBonus(S.row);
    if(hb>0) hbEl.innerHTML=`🎴 <span class="hblbl">${t('ui.handBonus.label')}</span> <span class="hbname">${HAND_LABEL[hk]}</span> <span class="hbplus">+${hb}</span> <span class="hbdim">${t('ui.handBonus.addedToChain')}</span>`+hint;
    else hbEl.innerHTML=`<span class="hbdim">🎴 ${t('ui.handBonus.label')} — ${t('ui.handBonus.currentPrefix')} ${HAND_LABEL[hk]}, ${t('ui.handBonus.none')}</span>`+hint; }

  const row=document.getElementById("row"); row.innerHTML=""; cellEls=[];
  for(let i=0;i<SLOTS;i++){
    if(i<S.row.length){ const el=cardEl(S.row[i]); row.appendChild(el); cellEls[i]=el; }
    else { const e=document.createElement("div"); e.className="pcard empty"; row.appendChild(e); }
  }
  const hand=document.getElementById("hand"); hand.innerHTML="";
  const last=S.row[S.row.length-1], bIdRow=bossId();
  S.hand.forEach((c,i)=>{
    const w=document.createElement("div"); w.className="hcard"; let zap="";
    if(S.showPreview && last && connect(c,last,bIdRow) && !climbSealed(c,last,bIdRow) && !(S.boss&&S.boss.id==="frost"&&S.row.length<=1)){   // 내리막/냉각: 봉인·줄첫2장 예고 미러(placeCard 동기화)
      let er=1; for(let j=S.row.length-1;j>0;j--){ if(connect(S.row[j],S.row[j-1],bIdRow) && !climbSealed(S.row[j],S.row[j-1],bIdRow)) er++; else break; }
      w.classList.add("willchain"); zap=`<div class="zap">⚡×${er+1}</div>`;
    }
    w.appendChild(cardEl(c)); w.insertAdjacentHTML("beforeend",zap);
    w.onclick=()=>placeCard(i); hand.appendChild(w);
  });
  document.getElementById("charms").innerHTML=S.owned.map(id=>{const c=CHARMS.find(x=>x.id===id); return `<span class="ctag">${artEmblemHTML(c,false,18)}${c.name}</span>`;}).join("");
  artHydrate(document.getElementById("charms"));
  const rbox=document.getElementById("rerollBox");
  if(rbox){ rbox.style.display=S.rerollMax>0?"flex":"none";
    document.getElementById("rrc").textContent="("+S.rerolls+")";
    document.getElementById("btnReroll").disabled=(S.rerolls<=0)||S.over||S.busy||S.settled; }
}

/* ---------- 연출 ---------- */
function juicePlace(idx, base, runLen, bonus, gained){
  const cell=cellEls[idx]; if(cell) cell.classList.add("place");
  popup(cell,"+"+base,"#bcd",0); beep(330,.07);
  if(runLen>=2){
    for(let k=0;k<runLen;k++){ const ci=idx-k;
      setTimeout(()=>{ const c=cellEls[ci]; if(c){ c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash"); } beep(420+k*90,.08); }, k*70); }
    const big=runLen>=4||gained>=100;
    setTimeout(()=>{
      popup(cellEls[idx],"CHAIN ×"+runLen,"#ffd15c",-34,runLen>=5);
      popup(cellEls[idx],"+"+bonus,"#fff",-62,big);
      sparkBurst(cellEls[idx],Math.min(5+runLen*4,34),runLen>=4?"#ffd15c":"#9b6fd4");
      shake(); if(big){ flash("#ffd15c22"); boom(90); } if(runLen>=5) flash("#ffffff18");
    }, runLen*70);
  }
}
function popup(anchor,text,color,dy,big){ const t=document.getElementById("table");
  const p=document.createElement("div"); p.className="pop"; p.textContent=text; p.style.color=color;
  p.style.fontSize=(big?38:18)+"px"; if(big)p.style.textShadow="0 0 18px "+color;
  const tr=t.getBoundingClientRect(), ar=anchor?anchor.getBoundingClientRect():tr;
  p.style.left=(ar.left-tr.left+(anchor?ar.width/2:tr.width/2)-10)+"px"; p.style.top=(ar.top-tr.top+(dy||0)+6)+"px"; t.appendChild(p);
  requestAnimationFrame(()=>{ p.style.top=(parseFloat(p.style.top)-46)+"px"; p.style.opacity="0"; }); setTimeout(()=>p.remove(),760);
}
function sparkBurst(anchor,n,color){ if(!anchor)return; const t=document.getElementById("table");
  const tr=t.getBoundingClientRect(), ar=anchor.getBoundingClientRect(); const cx=ar.left-tr.left+ar.width/2, cy=ar.top-tr.top+ar.height/2;
  for(let i=0;i<n;i++){ const s=document.createElement("div"); s.className="spark"; s.style.background=color; s.style.boxShadow="0 0 8px "+color;
    s.style.left=cx+"px"; s.style.top=cy+"px"; s.style.transition="all .6s cubic-bezier(.2,.8,.2,1)"; t.appendChild(s);
    const a=Math.random()*6.283,dist=28+Math.random()*60,dx=Math.cos(a)*dist,dy=Math.sin(a)*dist-16;
    requestAnimationFrame(()=>{ s.style.transform=`translate(${dx}px,${dy}px) scale(.3)`; s.style.opacity="0"; }); setTimeout(()=>s.remove(),620);} }
function shake(){ const t=document.getElementById("table"); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); }
function flash(col){ const f=document.createElement("div"); f.style.cssText=`position:fixed;inset:0;background:${col};pointer-events:none;z-index:40;transition:opacity .4s;opacity:.7`;
  document.body.appendChild(f); requestAnimationFrame(()=>f.style.opacity="0"); setTimeout(()=>f.remove(),420); }
function banner(m,c){ const b=document.getElementById("banner"); b.textContent=m||""; b.style.color=c||"#e6ebff"; }
let AC=null; function ac(){ if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}} return AC; }
let _toastT=null;
function toast(msg){ let el=document.getElementById("_toast"); if(!el){ el=document.createElement("div"); el.id="_toast"; el.className="toast"; document.body.appendChild(el); } el.textContent=msg; el.classList.add("show"); clearTimeout(_toastT); _toastT=setTimeout(()=>el.classList.remove("show"),1400); }
function beep(f,d,type){ if(MUTED)return; const a=ac(); if(!a)return; const o=a.createOscillator(),g=a.createGain(); o.type=type||"triangle"; o.frequency.value=f;
  g.gain.setValueAtTime(.0001,a.currentTime); g.gain.exponentialRampToValueAtTime(.18,a.currentTime+.01); g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+d+.02); }
function boom(f){ if(MUTED)return; const a=ac(); if(!a)return; const o=a.createOscillator(),g=a.createGain(); o.type="sine";
  o.frequency.setValueAtTime(f,a.currentTime); o.frequency.exponentialRampToValueAtTime(f*.5,a.currentTime+.3);
  g.gain.setValueAtTime(.3,a.currentTime); g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.4); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+.42); }

/* ---------- 정산 순차 연출 (v3.18 Top Rec) — 표시 타이밍만; 점수 계산은 settle서 이미 끝남(★불변식 무손상) ---------- */
function fxFast(){ const c=document.getElementById("fxToggle"); return !!(c && c.checked); }
function bump(el){ if(!el)return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
let _revealTok=0, _revealEnd=null, _climaxed=false;
function countNum(el, from, to, dur, tok, crossCb, crossVal, done){   // 숫자 0→to ease-out, 목표 교차 시 1회 콜백. render() 안 부름(오버레이 텍스트만).
  if(!el){ if(done)done(); return; }
  const t0=performance.now(); let crossed=false;
  (function step(now){
    if(tok!==_revealTok) return;                                       // 스킵/다음 정산이 무효화
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    const v=Math.round(from+(to-from)*e); el.textContent=v.toLocaleString();
    if(!crossed && crossCb && crossVal!=null && v>=crossVal){ crossed=true; crossCb(); }
    if(p<1) requestAnimationFrame(step); else { el.textContent=to.toLocaleString(); if(done)done(); }
  })(performance.now());
}
function revealTally(chain, hb, finalScore, target, pass, wasBoss){
  const ov=document.getElementById("tally"); ov.classList.add("show");
  const card=ov.querySelector(".tallyCard");
  const elC=document.getElementById("tChain"), elB=document.getElementById("tBonus"), elF=document.getElementById("tFinal");
  const tok=++_revealTok; _climaxed=false;
  const climax=()=>{ if(_climaxed)return; _climaxed=true; if(pass){ flash("#ffd15c"); boom(wasBoss?170:130); shake(); } bump(elF); };
  const finish=()=>{ card.classList.remove("revealing"); _revealEnd=null; elC.textContent=chain.toLocaleString(); elF.textContent=finalScore.toLocaleString(); };
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(fxFast() || reduce){                                              // ⏩ 빠른 연출 / 모션 축소 → 즉시(구 동작과 동치)
    elC.textContent=chain.toLocaleString(); elF.textContent=finalScore.toLocaleString();
    if(pass){ flash("#ffd15c"); boom(wasBoss?170:130); } else boom(70); return;
  }
  card.classList.add("revealing"); elC.textContent="0"; elF.textContent="0";
  _revealEnd=()=>{ if(pass) climax(); else boom(70); finish(); };       // 오버레이 클릭=스킵 시 즉시 마무리
  for(let k=0;k<5;k++) setTimeout(()=>{ if(tok===_revealTok) try{beep(300+k*80,.05);}catch(e){} }, k*120);  // 음정 상승(도-레-미-파-솔)
  countNum(elC,0,chain,640,tok, null,null, ()=>{ bump(elC);
    if(hb>0){ try{beep(660,.07);}catch(e){} bump(elB); }              // 족보 보너스 등장
    setTimeout(()=>{ countNum(elF,0,finalScore,760,tok, pass?climax:null, pass?target:null, ()=>{
      if(pass) climax(); else { boom(70); bump(elF); } finish();        // 목표 돌파=클라이맥스(경계 누락 안전망) / 미달=둔탁
    }); }, hb>0?260:120);
  });
}
function skipReveal(){ if(_revealEnd){ _revealTok++; const f=_revealEnd; _revealEnd=null; f(); } }

/* ---------- 룰 / 족보 드로어 (터치 → 펼침, 백드롭 터치 → 닫힘) ---------- */
const mc=(r,s)=>`<span class="mcard${s==="♥"||s==="♦"?" red":""}">${r}${s}</span>`;
const HANDS_HTML=t('ui.drawer.hands');
function rulesHTML(){ return `
  <h3>🃏 CHAIN DEAL — ${t('ui.rules.h3')}</h3>
  <p class="rtext">${t('ui.rules.p1')}</p>
  <div class="seg">${t('ui.rules.seg1')}</div>
  <div class="rrow"><div class="rlabel">${t('ui.rules.rule1.label')}</div>${mc("5","♠")}${mc("8","♠")} ${t('ui.rules.rule1.text')}</div>
  <div class="rrow"><div class="rlabel">${t('ui.rules.rule2.label')}</div>${mc("7","♥")}${mc("7","♦")} ${t('ui.rules.rule2.text')}</div>
  <div class="rrow"><div class="rlabel">${t('ui.rules.rule3.label')}</div>${mc("4","♣")}${mc("5","♠")} ${t('ui.rules.rule3.text')}</div>
  <p class="rtext">${t('ui.rules.p2a')} ${mc("3","♠")}${mc("4","♠")}${mc("5","♠")}${mc("6","♠")} ${t('ui.rules.p2b')}</p>
  <p class="rtext">${t('ui.rules.p3')}</p>
  <div class="seg">${t('ui.rules.seg2')}</div>
  <p class="rtext">${t('ui.rules.p4')}</p>
  <div class="seg">${t('ui.rules.seg3')}</div>
  <p class="rtext">${t('ui.rules.p5')}</p>`; }
function mcEnh(c){ const e=c.enh==="wild"?"★":c.enh==="mult"?"◆":c.enh==="gold"?"●":""; return `<span class="mcard${isRed(c.suit)?" red":""}">${rankStr(c.rank)}${suitG(c.suit)}<span style="color:#9b6fd4;font-size:10px">${e}</span></span>`; }
function deckHTML(){
  const all=[...S.deck,...S.discard,...S.hand,...S.row];
  all.sort((a,b)=> a.suit-b.suit || a.rank-b.rank);
  let h=`<h3>🃏 ${t('ui.deck.title')} (${all.length}${t('ui.count.jang')})</h3><p class="drawerSub">${t('ui.deck.sub')}</p>`;
  for(let s=0;s<4;s++){ const cs=all.filter(c=>c.suit===s); if(!cs.length) continue;
    h+=`<div class="seg">${suitG(s)} ${cs.length}${t('ui.count.jang')}</div><div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">${cs.map(c=>artFaceHTML(c,"mini")).join("")}</div>`; }
  const rc={}; all.forEach(c=>rc[c.rank]=(rc[c.rank]||0)+1);
  const dup=Object.entries(rc).filter(([r,n])=>n>=3).map(([r,n])=>`${rankStr(+r)}×${n}`);
  h+= dup.length ? `<p class="drawerNote">💡 ${t('ui.deck.dupPrefix')} ${dup.join(", ")} ${t('ui.deck.dupSuffix')}</p>` : `<p class="drawerNote">${t('ui.deck.noDup')}</p>`;
  return h;
}
function openDrawer(type){ document.getElementById("drawerBody").innerHTML=type==="rules"?rulesHTML():type==="stats"?statsHTML():type==="deck"?deckHTML():type==="charms"?charmsHTML():type==="meta"?metaHTML():HANDS_HTML; artHydrate(document.getElementById("drawerBody")); document.getElementById("drawerBd").classList.add("show"); document.getElementById("drawer").classList.add("show"); try{beep(560,.05);}catch(e){} }
function closeDrawer(){ document.getElementById("drawerBd").classList.remove("show"); document.getElementById("drawer").classList.remove("show"); }

/* ---------- 결과 공유 (v3.21) — 모바일=navigator.share 시트 / 데스크탑=클립보드. 데일리=같은 보드 경쟁 공유(스포일러 없음) ---------- */
function shareText(r){
  const url="https://kkp8121-rgb.github.io/chain-deal/";
  let strip="";
  for(let a=1;a<=ANTES;a++){
    if(r.won) strip += (a===ANTES?"👑":"🟩");      // 승리=전부 클리어
    else if(a<r.ante) strip += "🟩";               // 통과한 안테
    else if(a===r.ante) strip += "🟥";             // 죽은 안테
    else strip += "⬜";                            // 미도달
  }
  const sd=""+r.seed, tag = (r.daily ? `${t('ui.share.daily')} ${sd.slice(4,6)}/${sd.slice(6,8)}` : t('ui.share.free')) + (r.stake ? ` · St${r.stake} ${STAKE_NAMES[r.stake]}` : "");
  const head = r.won ? `🏆 ${t('ui.ante')} ${ANTES} ${t('ui.share.cleared')}` : `${t('ui.ante')} ${r.ante}/${ANTES} 💀`;
  return `CHAIN DEAL 🔗 ${tag}\n${head} · ${t('ui.best')} ${r.best.toLocaleString()}\n${strip}\n${url}`;
}
function shareResult(btn){
  if(!S || !S.lastResult) return;
  const txt = shareText(S.lastResult);
  try{beep(620,.06);}catch(e){}
  if(navigator.share){ navigator.share({text:txt}).catch(()=>{}); return; }   // 모바일 네이티브 공유 시트
  const done=()=>{ if(btn){ const o=btn.textContent; btn.textContent="✓ "+t('ui.share.copied'); setTimeout(()=>{ btn.textContent=o; },1400); } };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(()=>fallbackCopy(txt,done));
  else fallbackCopy(txt,done);
}
function fallbackCopy(txt,done){
  try{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.cssText="position:fixed;opacity:0;top:0;left:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); if(done)done(); }
  catch(e){ toast(t('ui.toast.copied')); }
}

/* ---------- 난이도 사다리 선택 UI (v3.22) ---------- */
let selStake=0;
let selDeck="standard";
function deckStep(d){ const i=DECKS.findIndex(x=>x.id===selDeck); selDeck=DECKS[(i+d+DECKS.length)%DECKS.length].id; try{beep(selDeck!=="standard"?520:420,.04);}catch(e){} renderDeckLbl(); }
function renderDeckLbl(){ const v=DECKS.find(x=>x.id===selDeck)||DECKS[0]; const el=document.getElementById("deckLbl"); if(el) el.textContent=v.name; const dd=document.getElementById("deckDesc"); if(dd) dd.textContent=v.desc; }
function stakeStep(d){ const mx=getMeta().maxStake; selStake=Math.max(0,Math.min(mx, selStake+d)); try{beep(selStake>0?520:420,.04);}catch(e){} renderStakeLbl(); }
function renderStakeLbl(){ const el=document.getElementById("stakeLbl"); if(!el) return; const mx=getMeta().maxStake; if(selStake>mx) selStake=mx;
  el.innerHTML=`St${selStake} <span style="color:${selStake>0?'#ffd15c':'#cdd6f5'}">${STAKE_NAMES[selStake]}</span>`;
  const d=document.getElementById("stakeDesc"); if(d) d.textContent = STAKE_DESC[selStake] + (selStake>=mx ? (mx<MAX_STAKE?"  ·  "+t('ui.stake.nextUnlock'):"  ·  "+t('ui.stake.maxDifficulty')) : ""); }

/* ---------- 리더보드 (A2) — 데일리 + 전체 ---------- */
function nickOr(){ return localStorage.getItem("cd_nick")||t('ui.anon'); }
function setNick(n){ const v=((n||"").trim()).slice(0,12); if(v) localStorage.setItem("cd_nick",v); return nickOr(); }
function submitScore(score){ if(!LOG_URL) return; try{ fetch(LOG_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({type:"score",nick:nickOr(),score:score||0,seed:S.seed,ante:S.ante,daily:S.daily?1:0,stake:S.stake||0})}); }catch(e){} }
function jsonp(action,seed,cb){ const fn="cb_"+Math.floor(Math.random()*1e9); const s=document.createElement("script"); window[fn]=d=>{ cb(d); delete window[fn]; s.remove(); }; s.onerror=()=>{ cb(null); s.remove(); }; s.src=`${LOG_URL}?action=${action}&seed=${seed||""}&callback=${fn}`; document.body.appendChild(s); }
function boardRows(arr){ if(!arr) return `<p class="hbdim" style="padding:6px 0">${t('ui.board.loadFail')}</p>`; if(!arr.length) return `<p class="hbdim" style="padding:6px 0">${t('ui.board.empty')}</p>`;
  return arr.map((r,i)=>`<div class="hrow"><span><b style="color:${i<3?'var(--gold)':'#cdd6f5'}">${i+1}. ${r.nick}</b></span><span class="hname">${(r.score||0).toLocaleString()} <span class="hbdim">${t('ui.ante')}${r.ante||"-"}</span></span></div>`).join(""); }
function openBoard(){
  const sd=(S&&S.daily)?S.seed:dailySeed();
  document.getElementById("drawerBody").innerHTML=`<h3>🏆 ${t('ui.board.title')}</h3><p class="drawerSub">${t('ui.board.nick')} <b>${nickOr()}</b> <span style="color:#9b6fd4;cursor:pointer;text-decoration:underline" onclick="closeDrawer();showScreen('settings')">${t('ui.board.change')}</span></p><div id="bdDaily"><div class="seg">🗓 ${t('ui.board.todayDaily')} (#${sd})</div><p class="hbdim">${t('ui.board.loading')}</p></div><div id="bdAll" style="margin-top:14px"><div class="seg">👑 ${t('ui.board.allTimeBest')}</div><p class="hbdim">${t('ui.board.loading')}</p></div>`;
  document.getElementById("drawerBd").classList.add("show"); document.getElementById("drawer").classList.add("show"); try{beep(560,.05);}catch(e){}
  jsonp("daily", sd, d=>{ const el=document.getElementById("bdDaily"); if(el) el.innerHTML=`<div class="seg">🗓 ${t('ui.board.todayDaily')} (#${sd})</div>${boardRows(d)}`; });
  jsonp("alltime","", d=>{ const el=document.getElementById("bdAll"); if(el) el.innerHTML=`<div class="seg">👑 ${t('ui.board.allTimeBest')}</div>${boardRows(d)}`; });
}

artSheetLoad();   // AI 카드 시트 비동기 로드(spec §4 v3) — 브라우저 전용. 성공 시 faceCache 무효화, 실패 시 절차 폴백. 양쪽 부트 분기 공통 선행.
if(/[?&]art=sheet(&|$)/.test(location.search)){ document.addEventListener("DOMContentLoaded",()=>artSheetReady(()=>artContactSheet(document.body))); }   // 컨택트 시트 모드(spec §6.8) — jsonp·해금소급·화면등록 전부 스킵(네트워크 발화 0). 시트 로드 완료(성공/실패 무관) 후 렌더 — 실패 시 폴백 카드로. ★DOMContentLoaded 이후 렌더: 이 <script>는 셸 마크업(드로어·탤리) 앞이라, 동기 실행하면 body를 비워도 파서가 그 마크업을 시트 뒤에 덧붙인다
else {
  artSheetReady(()=>{ if(typeof S!=="undefined"&&S) render(); });   // 시트 로드 완료 시 화면 갱신(로드 전 렌더된 폴백 카드 → 시트 카드로 재페인트)
  checkUnlocks(getStats(), []);   // 기존 플레이어 소급: bestAnte/wins 기반 등급 부적(흑심·정련가) 자동 해금
  registerScreen('title',    { el: document.getElementById('scrTitle') });
  registerScreen('run',      { el: document.getElementById('scrRun') });
  registerScreen('settings', { el: document.getElementById('scrSettings'), mount: mountSettings });
  registerScreen('summary',  { el: document.getElementById('scrSummary'), mount: mountSummary });
  registerScreens({ showScreen, currentScreen });
  rStageInit(document.getElementById('stage'), ()=>{});   // M2 스캐폴드: Pixi 스테이지 마운트/폴백 배선(캔버스는 CSS로 항상 숨김 — 표시·rSync는 다음 태스크). 시트모드 분기에선 호출 안 함
  showScreen('title');
  selDeck=getMeta().deck||"standard"; renderDeckLbl();
}

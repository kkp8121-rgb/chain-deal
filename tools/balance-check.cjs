// CHAIN DEAL 밸런스 검증 도구  ·  실행: node tools/balance-check.cjs
//
// 세 가지를 한다:
//   (1) prototype/index.html 인라인 스크립트 문법 검사 (new Function 파싱)
//   (2) 그리디(잘하는 플레이) 시뮬로 블라인드별 클리어율 측정
//   (3) 포커 족보 보너스(텍사스 서열 라벨 + 빈도보정 가산)의 변별력 측정 (보너스 유무 비교)
//
// ⚠️ 아래 점수/연결/족보 규칙은 index.html 의 로직을 "복제"한 것이다.
//    index.html 의 connect()/placeCard()/blindTarget()/BOSSES/evalHand()/HAND_BONUS 를 바꾸면 이 파일도 같이 맞출 것.
//    목표 클리어율: 작은~90% / 큰~80% / 보스 55~72% (잘하면 깸, 운으로 가끔 억까).

const fs = require("fs");
const path = require("path");

/* ---------- (1) 문법 검사 ---------- */
const htmlPath = path.join(__dirname, "..", "prototype", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/);
if (!m) { console.log("❌ 인라인 스크립트를 찾지 못함"); process.exit(1); }
try { new Function("window", "document", '"use strict";' + m[1]); console.log("✅ index.html 인라인 JS 문법 OK\n"); }
catch (e) { console.log("❌ 문법 오류:", e.message); process.exit(1); }

/* ---------- (2) 밸런스 시뮬 (index.html 규칙 복제) ---------- */
const ri = n => Math.floor(Math.random() * n);
const isRed = s => s === 1 || s === 2;           // ♥♦
function starterDeck() { const d = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 8; r++) d.push({ suit: s, rank: r, enh: null }); return d; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function connect(a, b, boss) {
  if (a.enh === "wild" || b.enh === "wild") return true;
  if (boss === "seal_suit" && (a.suit === 0 || b.suit === 0)) return false;
  const run = Math.abs(a.rank - b.rank) === 1 && boss !== "seal_run";
  return a.suit === b.suit || a.rank === b.rank || run;
}
function gain(row, card, boss) {
  row.push(card);
  let base = (boss === "red_curse" && isRed(card.suit)) ? 0 : card.rank;
  let g = base, rl = 1;
  const left = row[row.length - 2];
  if (left && connect(card, left, boss)) {
    for (let i = row.length - 1; i > 0; i--) { if (connect(row[i], row[i - 1], boss)) rl++; else break; }
    let mult = rl - 1;
    if (boss === "dull") mult = Math.max(1, mult - 1);
    mult = Math.min(mult, 25);
    let sum = 0; for (let i = row.length - rl; i < row.length; i++) sum += row[i].rank;
    g += sum * mult;
  }
  return g;
}

/* ---------- 포커 족보 (텍사스 서열 라벨 + 빈도보정 가산) ---------- */
// 빈도(그리디 8장): 투페어33%·풀하우스29%·스트레이트24%(흔함) / 플러시5%·포카드2.5%·스트플0.8%(희소)
// 계수: 흔한 족보=소액(아슬아슬 보존), 희소 족보=큰 가산(노리는 보람). 보너스 = round(blindBase(ante) * 계수)
const HAND_BONUS = { highCard:0, pair:0, twoPair:0.02, trips:0.05, straight:0.03, flush:0.30, fullHouse:0.08, fourKind:0.50, straightFlush:0.75 };
const HAND_KO = { highCard:"하이카드", pair:"페어", twoPair:"투페어", trips:"트리플", straight:"스트레이트", flush:"플러시", fullHouse:"풀하우스", fourKind:"포카드", straightFlush:"스트레이트플러시" };
function hasRun5(ranks){ const s=new Set(ranks); for(let lo=1;lo<=4;lo++){ let ok=true; for(let k=0;k<5;k++) if(!s.has(lo+k)){ ok=false; break; } if(ok) return true; } return false; }
function evalHand(cards){
  const rc={}, bySuit={};
  for(const c of cards){ const r = c.enh==="wild" ? null : c.rank; if(r!=null) rc[r]=(rc[r]||0)+1; (bySuit[c.suit]=bySuit[c.suit]||[]).push(c.rank); }
  const counts=Object.values(rc).sort((a,b)=>b-a);
  const maxRank=counts[0]||0;
  const pairs=counts.filter(x=>x>=2).length, trips=counts.filter(x=>x>=3).length;
  const maxSuit=Math.max(...Object.values(bySuit).map(a=>a.length));
  const flush=maxSuit>=5, straight=hasRun5(Object.keys(rc).map(Number));
  let sflush=false; for(const s in bySuit){ if(bySuit[s].length>=5 && hasRun5(bySuit[s])){ sflush=true; break; } }
  const full = trips>=1 && (pairs>=2 || trips>=2);
  if(sflush) return "straightFlush";
  if(maxRank>=4) return "fourKind";
  if(full) return "fullHouse";
  if(flush) return "flush";
  if(straight) return "straight";
  if(maxRank>=3) return "trips";
  if(pairs>=2) return "twoPair";
  if(pairs>=1) return "pair";
  return "highCard";
}
const blindBase = ante => 150 * Math.pow(1.5, ante - 1);
const handBonus = (row, ante) => Math.round(blindBase(ante) * (HAND_BONUS[evalHand(row)] || 0));

// 그리디: 매 수 즉시 점수 최대 카드 선택 → {sc, row}
function playRound(boss, handN) {
  let dk = shuffle(starterDeck()), disc = [], row = [], sc = 0;
  const draw = () => { if (!dk.length) { dk = shuffle(disc); disc = []; } return dk.pop(); };
  let hand = Array.from({ length: handN }, draw);
  for (let p = 0; p < 8; p++) {
    let bi = 0, best = -1;
    for (let h = 0; h < handN; h++) { const t = row.slice(); const v = gain(t, hand[h], boss); if (v > best) { best = v; bi = h; } }
    sc += gain(row, hand[bi], boss); hand[bi] = draw();
  }
  return { sc, row };
}
function clearRate(boss, handN, target, ante, useBonus, N = 5000) {
  let c = 0; for (let i = 0; i < N; i++) { const r = playRound(boss, handN); const s = r.sc + (useBonus ? handBonus(r.row, ante) : 0); if (s >= target) c++; }
  return (c / N * 100).toFixed(0);
}

const blindTarget = (ante, blind) => Math.round(blindBase(ante) * (blind === 0 ? 1 : blind === 1 ? 1.4 : 1.6));
const BOSSES = [
  { id: "seal_run", name: "🚫 스트레이트봉인", tmult: 0.65, hand: 3, minAnte: 2 },
  { id: "red_curse", name: "🩸 단색의저주", tmult: 1.0, hand: 3, minAnte: 1 },
  { id: "stingy", name: "✋ 인색한손", tmult: 0.65, hand: 2, minAnte: 2 },
  { id: "dull", name: "🗡 무딘칼날", tmult: 0.85, hand: 3, minAnte: 1 },
  { id: "seal_suit", name: "🔒 봉인된무늬", tmult: 0.6, hand: 3, minAnte: 2 },
];

console.log("=== 안테 1 클리어율 (그리디, 맨 덱 / 족보보너스 없음 → 있음) ===");
console.log(`  작은 블라인드 (${blindTarget(1,0)}): ${clearRate(null,3,blindTarget(1,0),1,false)}% → ${clearRate(null,3,blindTarget(1,0),1,true)}%`);
console.log(`  큰 블라인드 (${blindTarget(1,1)}): ${clearRate(null,3,blindTarget(1,1),1,false)}% → ${clearRate(null,3,blindTarget(1,1),1,true)}%`);
for (const b of BOSSES.filter(b => b.minAnte <= 1)) {
  const t = Math.round(blindTarget(1, 2) * b.tmult);
  console.log(`  보스 ${b.name} (${t}, 손패${b.hand}): ${clearRate(b.id,b.hand,t,1,false)}% → ${clearRate(b.id,b.hand,t,1,true)}%`);
}

console.log("\n=== 족보 보너스 변별력 (안테4 큰블라인드 기준, 보너스 없음 → 있음) ===");
{ const t = blindTarget(4, 1);
  console.log(`  큰 블라인드 (${t}): ${clearRate(null,3,t,4,false)}% → ${clearRate(null,3,t,4,true)}%`); }

console.log("\n=== 족보별 보너스 크기 (가산, 안테별) ===");
const order = ["pair","twoPair","trips","straight","flush","fullHouse","fourKind","straightFlush"];
process.stdout.write("  족보".padEnd(12)); for(const a of [1,4,8]) process.stdout.write(`안테${a}`.padStart(8)); console.log("   계수");
for (const k of order) { process.stdout.write(("  "+HAND_KO[k]).padEnd(13)); for(const a of [1,4,8]) process.stdout.write(String(Math.round(blindBase(a)*HAND_BONUS[k])).padStart(8)); console.log(`   ×${HAND_BONUS[k]}`); }

console.log("\n=== 안테별 작은블라인드 목표 (성장 곡선) ===");
for (const a of [1, 2, 3, 4, 6, 8]) console.log(`  안테${a}: ${blindTarget(a,0)} / ${blindTarget(a,1)} / 보스기준 ${blindTarget(a,2)}`);

// CHAIN DEAL 밸런스 검증 도구  ·  실행: node tools/balance-check.cjs
//
// 두 가지를 한다:
//   (1) prototype/index.html 인라인 스크립트 문법 검사 (new Function 파싱)
//   (2) 그리디(잘하는 플레이) 시뮬레이션으로 블라인드별 클리어율 측정
//
// ⚠️ 아래 점수/연결 규칙은 index.html 의 로직을 "복제"한 것이다.
//    index.html 의 connect()/placeCard()/blindTarget()/BOSSES 를 바꾸면 이 파일도 같이 맞출 것.
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
// 그리디: 매 수마다 손패 중 즉시 점수 최대 카드 선택 (= 잘하는 플레이의 근사)
function playRound(boss, handN) {
  let dk = shuffle(starterDeck()), disc = [], row = [], sc = 0;
  const draw = () => { if (!dk.length) { dk = shuffle(disc); disc = []; } return dk.pop(); };
  let hand = Array.from({ length: handN }, draw);
  for (let p = 0; p < 8; p++) {
    let bi = 0, best = -1;
    for (let h = 0; h < handN; h++) { const t = row.slice(); const v = gain(t, hand[h], boss); if (v > best) { best = v; bi = h; } }
    sc += gain(row, hand[bi], boss); hand[bi] = draw();
  }
  return sc;
}
function clearRate(boss, handN, target, N = 5000) {
  let c = 0; for (let i = 0; i < N; i++) if (playRound(boss, handN) >= target) c++;
  return (c / N * 100).toFixed(0);
}

// index.html 의 blindTarget + BOSSES.tmult 와 동일하게 유지
const blindBase = ante => 150 * Math.pow(1.5, ante - 1);
const blindTarget = (ante, blind) => Math.round(blindBase(ante) * (blind === 0 ? 1 : blind === 1 ? 1.4 : 1.6));
const BOSSES = [
  { id: "seal_run", name: "🚫 스트레이트봉인", tmult: 0.65, hand: 3 },
  { id: "red_curse", name: "🩸 단색의저주", tmult: 1.0, hand: 3 },
  { id: "stingy", name: "✋ 인색한손", tmult: 0.65, hand: 2 },
  { id: "dull", name: "🗡 무딘칼날", tmult: 0.85, hand: 3 },
  { id: "seal_suit", name: "🔒 봉인된무늬", tmult: 0.6, hand: 3 },
];

console.log("=== 안테 1 클리어율 (그리디, 맨 덱 기준 — 실제론 상점 거쳐 더 높음) ===");
console.log(`  작은 블라인드 (${blindTarget(1,0)}): ${clearRate(null,3,blindTarget(1,0))}%`);
console.log(`  큰 블라인드 (${blindTarget(1,1)}): ${clearRate(null,3,blindTarget(1,1))}%`);
for (const b of BOSSES) {
  const t = Math.round(blindTarget(1, 2) * b.tmult);
  console.log(`  보스 ${b.name} (${t}, 손패${b.hand}): ${clearRate(b.id, b.hand, t)}%`);
}
console.log("\n=== 안테별 작은블라인드 목표 (성장 곡선) ===");
for (const a of [1, 2, 3, 4, 6, 8]) console.log(`  안테${a}: ${blindTarget(a,0)} / ${blindTarget(a,1)} / 보스기준 ${blindTarget(a,2)}`);

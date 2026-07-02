const SLOTS=8, ANTES=8, MAX_STAKE=5;   // 난이도 사다리: 0(평지)~5. run-sim STK_T/STK_AC와 길이 일치
/* ---------- 골드 경제 파라미터 (캘리브 대상 · run-sim.cjs와 동기화 필수) ---------- */
const GOLD_BASE=1, GOLD_K=4;           // 통과 환전: floor(BASE + 초과율*K) · run-sim 캘리브(balance 8.9%≈기준선 8.6%)
const START_GOLD_PER_LV=3;             // 시작 골드 = goldLv * 3
const REROLL_BASE=2;                   // 상점 리롤 기본 cost (에스컬레이팅: +S.shopRerolls) · run-sim·economy-check 동기화
const CLUSTER_W=0.15;                   // 미투자 클러스터 부적 오퍼 가중(희석 완화 — 투자 시 1.0) · run-sim 동기화 (캘리브: balance 7.3% 회복)
const META_PRICE={ retry:3, gold:[5,8,12], reroll:[6,10] };
const STAKE_T=[0,.03,.03,.04,.04,.06], STAKE_AC=[0,0,0,.008,.008,.014];   // 난이도 사다리 목표 가산(평면/안테비례) — ★run-sim STK_T/STK_AC 미러(드리프트 동기화)
module.exports = { SLOTS, ANTES, MAX_STAKE, GOLD_BASE, GOLD_K, START_GOLD_PER_LV, REROLL_BASE, CLUSTER_W, META_PRICE, STAKE_T, STAKE_AC };

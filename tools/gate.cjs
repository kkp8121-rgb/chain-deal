// tools/gate.cjs — C1 회귀 게이트 코어 (G0~G7 + content-ledger). 실행:
//   node tools/gate.cjs [--fast|--full]              게이트 스코어카드(GREEN/RED + RESULT_JSON), red 있으면 exit 1
//   node tools/gate.cjs --snapshot [--fast|--full]    tools/gate-baseline.json(content-ledger) 재생성, exit 0
//
// 밴드 스펙 SSoT: docs/production-roadmap.md §3(gate 표) + docs/superpowers/specs/2026-07-02-chaindeal-master-spec.md §7.
//
// two-tier: --fast(N=2000, 이너루프용, 초 단위) / --full(N=20000, pre-commit용, 분 단위) — 인자 없으면 --fast.
//
// ★규칙은 재정의하지 않는다 — tools/run-sim.cjs(G0 이후 전 게이트의 유일한 규칙 소스, src/ 어댑터)와
//   tools/economy-check.cjs(G5)·tools/funqa/*(G6/G7)만 호출한다. gate.cjs 자신은 오케스트레이션(어떤 시뮬을
//   몇 번 돌려 무슨 밴드로 판정할지)만 담당 — CLAUDE.md "규칙 중복 금지" 원칙을 gate 레벨에서도 지킨다.
//
// ★게이트 = ledger 기준선 앵커링(2026-07-02 재설계): 절대 밴드로 baseline을 red하지 않는다. v3.29를
//   `tools/gate-baseline.json`(content-ledger)에 스냅샷해 두고, G2.5/G3는 그 스냅샷 ± 허용오차로 "드리프트/
//   신규-이상치"만 검출한다(jackpot의 극단적 forced-inclusion EV·frost의 98%대 cond-pass처럼 baseline 자체가
//   극값인 항목을 매 실행 다시 "이상치"로 red하는 구조적 오탐을 없앤다 — 그 항목들은 ledger에 기록·수용되고,
//   대신 리포트에 명시 플래그된다). 마일스톤마다 `--snapshot`으로 ledger를 갱신하는 것이 "의도된 콘텐츠 변경"과
//   "회귀"를 구분하는 유일한 방법(무변경 코드 = ledger 재현 = 항상 GREEN이 구조적으로 성립).
"use strict";
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { mulberry32 } = require("./funqa/runner.cjs");

const ROOT = path.join(__dirname, "..");
const ARGV = process.argv.slice(2);
const FAST = !ARGV.includes("--full");   // 명시적으로 --full 안 주면 안전하게 fast 기본값
const SNAPSHOT = ARGV.includes("--snapshot");
const N = FAST ? 2000 : 20000;
const N1 = FAST ? 500 : 3000;             // G1(구조 어서션)은 통계 목적이 아니라 표본 하나만 걸려도 fail이라 더 적은 N으로 충분
const EV_N = FAST ? N : Math.round(N / 2); // G3 forced-inclusion은 24부적×2회(강제+베이스라인 재사용) — --full 런타임 절반화(그래도 표준오차 <0.5pp)
const BOSS_MIN_REACH = FAST ? 20 : 200;    // act3 보스 표본 하한 — run-sim.cjs CLI 자체 컨벤션(200) 축소비례
const N_FUN = FAST ? 800 : 2000;           // G6/G7(funqa persona) 뱅크당 N — --full=master-spec §10 고정 프로토콜(N=2000).
                                            // ★500 미만(예 300)은 safe 페르소나가 6.0 임계 바로 위(~6.1~6.4)라 표집노이즈로
                                            //   가끔 6.0 밑으로 떨어져 대중재미가 80%→60%로 튐(실측 확인) — 500부터 안정.
                                            // ★G6은 ledger(N=2000 protocol)와 fast(적은 N) 표본을 직접 비교(drop≤0.2)하므로
                                            //   casual(무작위 top-2 픽 — 다른 페르소나보다 변동성 큼)이 500에선 드리프트
                                            //   허용치를 노이즈만으로 넘길 수 있음(실측: N=500서 −0.38) — 800에서 안정(<0.2).

const LEDGER_PATH = path.join(ROOT, "tools", "gate-baseline.json");
// ★결정1(RNG 시딩): 단일-run 게이트(G1~G5)는 이 고정 primary seed로 R.setRNG를 감싸 결정론 확보(값 자체는
//   임의 상수 — 재현성만 중요). G6/G7(funqa)은 자체적으로 이미 결정론(runFullInstrumented가 매 런마다
//   mulberry32(seed) 재주입, master-spec §10 고정 3뱅크 컨벤션 그대로 재사용).
const PRIMARY_SEED = 42;
const FUN_BANKS = [50000, 70000, 90000];   // master-spec §10 고정 3뱅크(verify-3bank.cjs와 동일 컨벤션)

const results = [];   // {gate, status:'GREEN'|'RED'|'SKIP', detail, band}
function record(gate, status, detail, band) { results.push({ gate, status, detail, band }); }
function pass(gate, ok, detail, band) { record(gate, ok ? "GREEN" : "RED", detail, band); }

// R.setRNG(mulberry32(seed))로 감싸 fn()을 실행하고 항상 원상복구(Math.random)한다 — 결정론 + CRN(common
// random numbers: 같은 seed로 서로 다른 전략/부적을 비교하면 순수 델타만 남아 노이즈가 크게 줄어든다).
function seeded(R, seed, fn) {
  R.setRNG(mulberry32(seed));
  try { return fn(); } finally { R.setRNG(null); }
}

// ============================================================ ledger (content-ledger) ============================================================
function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")); }
  catch (e) { throw new Error(`gate-baseline.json 파싱 실패(손상됨?) — 재생성: node tools/gate.cjs --snapshot : ${e.message}`); }
}

// 부적 EV / 보스 cond-pass / per-blind cond 앵커 허용오차. ★절대 하한 + 상대오차 중 큰 쪽(작은 EV 부적도
// 여유 있게, jackpot처럼 큰 EV는 비례해서). --fast(표본 적음)·--full(표본 많음) 양쪽 다 같은 ledger 1개에
// anchor하므로 두 tier의 표집오차를 모두 흡수할 만큼 넉넉히 잡는다(자기 자신과 비교하는 --full 재현은
// CRN 결정론으로 오차 0에 가까움 — 실제 여유는 --fast 쪽 표집노이즈가 요구).
const CHARM_TOL_ABS = 0.025, CHARM_TOL_REL = 0.25;
function charmTol(ledgerVal) { return Math.max(CHARM_TOL_ABS, Math.abs(ledgerVal) * CHARM_TOL_REL); }
const BOSS_TOL = 0.08;     // 8pp — act3 보스는 도달 표본이 fast에서 특히 적음(bossMinReach=20)
const NEW_ITEM_Z = 2.5;    // ledger에 없는 신규 부적(향후 C2+) — ledger 기존 분포 대비 z-outlier 판정

// ============================================================ G0 — build+inline+syntax+idempotency ============================================================
function runG0() {
  const OUT = path.join(ROOT, "prototype", "index.html");
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;

  const build1 = spawnSync("node", ["build.mjs"], { cwd: ROOT, encoding: "utf8" });
  const buildOk = build1.status === 0;
  const after1 = buildOk && fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;

  // ★결정6: 덮어쓰기 前 on-disk 버전과 재빌드본을 비교(손편집/stale 탐지) — 이전엔 비교 없이 조용히 덮어써서
  //   "누가 prototype/index.html을 src/ 밖에서 직접 손편집했는지" 신호가 전혀 없었다. git HEAD 대비 비교는
  //   정상 개발 워크플로우(src 미커밋 변경 중)에서도 상시 diff가 나 노이즈이므로, 여기선 "gate 시작 시점의
  //   on-disk 상태"를 기준으로 삼는다(CI 클린 체크아웃에선 이게 곧 HEAD와 동일). 차이 자체는 정보성(빌드는
  //   항상 최신으로 재생성하는 게 맞는 동작이라 red는 아님) — 사람이 "의도된 src 변경 때문인지 손편집
  //   드리프트인지"를 판단하도록 표면화만 한다.
  const staleBytes = before !== null && after1 !== null ? Math.abs(before.length - after1.length) : null;
  const staleDetected = before !== null && after1 !== null && before !== after1;

  // 재빌드 결정성(idempotent) — 같은 src 상태에서 두 번 빌드하면 바이트 동일해야 함(다르면 build.mjs 자체
  // 버그, 진짜 red). 이건 baseline-anchor가 아니라 순수 구조적 불변식.
  const build2 = buildOk ? spawnSync("node", ["build.mjs"], { cwd: ROOT, encoding: "utf8" }) : null;
  const after2 = buildOk && build2 && build2.status === 0 && fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  const idempotentOk = buildOk && !!build2 && build2.status === 0 && after1 === after2;

  const bal = spawnSync("node", ["tools/balance-check.cjs"], { cwd: ROOT, encoding: "utf8" });
  const syntaxOk = bal.status === 0 && /인라인 JS 문법 OK/.test(bal.stdout || "");

  const ok = buildOk && syntaxOk && idempotentOk;
  pass("G0", ok,
    `build.mjs=${buildOk ? "OK" : "FAIL(exit " + build1.status + ")"}  syntax(balance-check)=${syntaxOk ? "OK" : "FAIL"}  ` +
    `idempotent(재빌드 2회 바이트동일)=${idempotentOk ? "OK" : "FAIL(build.mjs 비결정적?)"}  ` +
    `stale/손편집(gate 시작시 on-disk ≠ 재빌드본)=${before === null ? "N/A(파일없음)" : (staleDetected ? `감지(${staleBytes}자 차, 정보성 — src 변경 미반영이었을 가능성, red 아님)` : "없음(동기화됨)")}`,
    "node build.mjs 성공 + 인라인 JS 문법(new Function) 파싱 성공 + 재빌드 결정성(idempotent, 구조적 하드게이트). 손편집/stale 탐지는 정보성(빌드가 항상 최신으로 덮어씀 — red 아님).");
  if (!buildOk) console.error("  [G0] build.mjs stderr:\n" + (build1.stderr || "").slice(0, 1000));
  if (!syntaxOk) console.error("  [G0] balance-check stdout(tail):\n" + (bal.stdout || "").slice(-500));
}

// ============================================================ G1 — card-conservation + mult-cap + additive hooks (결정5 견고화) ============================================================
// (a) gate 시작 시 scoreCard가 mult/rawMult 숫자 필드를 반환하는지 assert(throw) — silent no-op 회귀 차단.
//   리팩터 실수로 필드가 사라지면 아래 (b) 캡 계측이 `undefined > 25`류로 조용히 항상 통과해버려 캡 위반을
//   영원히 못 잡는다. 여기서 즉시 크게(throw) 실패시켜 그 가능성을 원천 차단한다.
function assertScoreCardReturnsMult() {
  const { scoreCard } = require(path.join(ROOT, "src", "rules", "scoring.cjs"));
  const a = { suit: 0, rank: 3, enh: null }, b = { suit: 0, rank: 4, enh: null };
  const ctx = { boss: () => false, isRed: () => false, connect: () => true, climbSealed: () => false, ownedHooks: [] };
  const r = scoreCard([a, b], b, a, ctx);
  if (typeof r.mult !== "number" || typeof r.rawMult !== "number") {
    throw new Error(
      `G1 어서션 실패: scoreCard()가 숫자 mult/rawMult 필드를 반환하지 않음(silent no-op 회귀 위험 — ` +
      `mult-cap 계측이 항상 통과하게 됨). 실제 반환값: ${JSON.stringify(r)}`
    );
  }
}

function runG1(R) {
  assertScoreCardReturnsMult();

  // (a) 정적: 부적 hooks 키가 알려진 집합만 사용 + chainMul(유일한 곱연산 훅)은 문서화된 예외만 (결정5d: 유지)
  if (typeof global.t !== "function") global.t = require(path.join(ROOT, "src", "content", "locale", "i18n.cjs")).t;
  const { CHARMS } = require(path.join(ROOT, "src", "content", "charms.cjs"));
  const ALLOWED_HOOKS = new Set(["base", "mult", "chainMul", "settle", "settleOverride"]);
  const KNOWN_MULTIPLICATIVE = new Set(["jackpot"]);   // CLAUDE.md/scoring.cjs 문서화: chainMul=bonus*N, 유일한 곱연산 예외
  const unknownKeys = [];
  const chainMulUsers = [];
  for (const c of CHARMS) {
    if (!c.hooks) continue;
    for (const k of Object.keys(c.hooks)) if (!ALLOWED_HOOKS.has(k)) unknownKeys.push(`${c.id}.${k}`);
    if (c.hooks.chainMul) chainMulUsers.push(c.id);
  }
  const chainMulOk = chainMulUsers.length === KNOWN_MULTIPLICATIVE.size && chainMulUsers.every(id => KNOWN_MULTIPLICATIVE.has(id));
  const hooksOk = unknownKeys.length === 0 && chainMulOk;

  // (b) 동적: mult 캡(25, 닻 보스는 3)이 "실제로 적용"되는지 — 클램프 前 rawMult로 기대 캡을 재계산해 mult와
  //   비교(결정5b). 이전엔 scoreCard가 반환하는 mult가 이미 클램프 後 값이라 `mult>25`는 캡 상수를 26으로
  //   올려도 실제 플레이서 raw가 26↑을 잘 안 찍으면 절대 안 걸리는 통계적 무력화(=사실상 상시통과) 문제가
  //   있었다 — raw를 직접 확보해 "적용된 mult === min(raw, 기대캡)"을 매 카드 단정적으로 검사.
  let maxMult = 0, maxRawMult = 0, capViolations = 0, cardsScored = 0;
  const capSamples = [];
  R.setCardHook((r, boss) => {
    cardsScored++;
    if (r.mult > maxMult) maxMult = r.mult;
    if (r.rawMult > maxRawMult) maxRawMult = r.rawMult;
    const expectedCap = boss === "anchor" ? 3 : 25;
    const expected = Math.min(r.rawMult, expectedCap);
    if (r.mult !== expected) { capViolations++; if (capSamples.length < 3) capSamples.push({ boss, rawMult: r.rawMult, mult: r.mult, expectedCap }); }
  });
  seeded(R, PRIMARY_SEED, () => { for (let i = 0; i < N1; i++) R.runFull("balance", null, 0); });
  R.setCardHook(null);
  const capOk = capViolations === 0;

  // (c) 동적: 카드보존(4더미) 불변식을 풀런 진행 중 실효 검사(결정5c). 라운드 단계: 영구덱 크기 불변 +
  //   카드더미 소진(draw() fallback 발동, HANDOVER §3.2 손패회수류 버그의 재발 신호) 0회. 상점 단계: 델타
  //   [-1,+2] 범위(offer 구성상 thin(-1)/copy(+1)/add(+1) 각 최대 1개).
  const pileViolations = [];
  seeded(R, PRIMARY_SEED, () => {
    for (let i = 0; i < N1; i++) {
      R.runFull("balance", null, 0, undefined, {
        onStep(info) {
          if (info.phase === "round") {
            if (info.deckBefore !== info.deckAfter) pileViolations.push({ ...info, reason: "round mutated deck" });
            if (info.exhausted > 0) pileViolations.push({ ...info, reason: `round exhausted deck ${info.exhausted}x(draw fallback 발동 — 카드더미 소진 회귀 의심)` });
          }
          if (info.phase === "shop") {
            const d = info.deckAfter - info.deckBefore;
            if (d < -1 || d > 2) pileViolations.push({ ...info, delta: d, reason: "shop delta out of [-1,+2]" });
          }
        },
      });
    }
  });
  const pileOk = pileViolations.length === 0;

  const ok = hooksOk && capOk && pileOk;
  pass("G1", ok,
    `hooks=${hooksOk ? "OK" : "FAIL(unknown:" + unknownKeys.join(",") + " chainMul사용자:" + chainMulUsers.join(",") + ")"}; ` +
    `mult-cap(raw계측, 표본 ${cardsScored}장, maxRaw=${maxRawMult} maxApplied=${maxMult}/25)=${capOk ? "OK" : "FAIL(" + capViolations + "건, 예: " + JSON.stringify(capSamples[0]) + ")"}; ` +
    `pile(${N1}런, 소진계측 포함)=${pileOk ? "OK" : "FAIL(" + pileViolations.length + "건, 예: " + JSON.stringify(pileViolations[0]) + ")"}`,
    "부적 hooks 키⊆{base,mult,chainMul,settle,settleOverride} & chainMul=jackpot만; 적용mult===min(rawMult,기대캡25/닻3)(raw계측, 결정5b); " +
    "라운드 중 덱 크기 불변+소진(exhausted) 0회 + 상점 1회당 델타∈[-1,+2](결정5c)");
}

// ============================================================ G2 / G2.5 / G3 / G4 — balance/St0/standard 1회 시뮬 재사용 ============================================================
function runG2_to_G4(R, ledger) {
  const STRAT_IDS = Object.keys(R.STRATS);
  const stratResults = {};
  // ★CRN(common random numbers): 전략마다 같은 PRIMARY_SEED로 리셋 — 11전략이 같은 보스뽑기/셔플/상점RNG
  // 시퀀스를 공유해 "전략 차이"만 남기고 시드간 노이즈를 제거(G2 스프레드 판정 안정화).
  for (const s of STRAT_IDS) stratResults[s] = seeded(R, PRIMARY_SEED, () => R.simulateStrat(s, { N, stake: 0, variant: "standard", bossMinReach: BOSS_MIN_REACH }));
  const bal = stratResults.balance;   // G2.5/G3(boss)/G4가 공유 재사용(1회 시뮬로 충분 — 중복 시뮬 방지)

  // ---------------- G2: 빌드 다양성 스프레드 ----------------
  {
    const rates = STRAT_IDS.map(s => stratResults[s].clearRate);
    const sorted = rates.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const overCap = STRAT_IDS.filter(s => stratResults[s].clearRate > median * 2);
    const underFloor = STRAT_IDS.filter(s => stratResults[s].clearRate < median * 0.3);
    const ok = overCap.length === 0 && underFloor.length === 0;
    const detail = STRAT_IDS.map(s => `${s}=${(stratResults[s].clearRate * 100).toFixed(1)}%`).join(" ");
    pass("G2", ok,
      `median=${(median * 100).toFixed(1)}%  ${detail}` +
      (overCap.length ? `  [>2×median: ${overCap.join(",")}]` : "") +
      (underFloor.length ? `  [<0.3×median: ${underFloor.join(",")}]` : ""),
      "11전략 클리어율: no strat>2×median, none<0.3×median");
  }

  // ---------------- G2.5: baseline-clear 밴드(★결정2: ledger 앵커링 — 희석+인플레 하드게이트) ----------------
  {
    const HARD_FLOOR = 0.075, RATCHET = 0.01, INFLATE = 0.02;
    const clear = bal.clearRate;
    let floor, ceil, bandDesc;
    if (ledger) {
      floor = Math.max(HARD_FLOOR, ledger.st0Clear - RATCHET);
      ceil = ledger.st0Clear + INFLATE;
      bandDesc = `floor=max(7.5%, ledger${(ledger.st0Clear * 100).toFixed(2)}%−1.0pp래칫)=${(floor * 100).toFixed(2)}% & ≤ledger+2pp=${(ceil * 100).toFixed(2)}% [ledger=${ledger.version}@${ledger.generatedAt}]`;
    } else {
      floor = HARD_FLOOR; ceil = 0.085 + INFLATE;
      bandDesc = `[⚠ledger 없음 — 레거시 폴백] floor≥7.5% & ≤8.5%+2pp=10.5% ("node tools/gate.cjs --snapshot" 먼저 실행 권장)`;
    }
    const ok = clear >= floor && clear <= ceil;
    pass("G2.5", ok, `St0 balance clear=${(clear * 100).toFixed(2)}% (N=${N})${ledger ? "" : " ⚠ledger-missing"}`, bandDesc);
  }

  // ---------------- G3: 부적 EV / 보스 cond-pass / deck parity — ★결정2·3: ledger 앵커 드리프트 검출 ----------------
  {
    const charmIds = R.CHARMS.map(c => c.id);
    const baseline = bal.clearRate;
    const deltas = {};
    for (const id of charmIds) {
      const r = seeded(R, PRIMARY_SEED, () => R.simulateStrat("balance", { N: EV_N, stake: 0, variant: "standard", forceOwned: [id] }));
      deltas[id] = r.clearRate - baseline;
    }

    let evDrift = [], evNew = [];
    if (ledger && ledger.charmEV) {
      const knownVals = Object.values(ledger.charmEV);
      const mean = knownVals.reduce((a, b) => a + b, 0) / (knownVals.length || 1);
      const sd = Math.sqrt(knownVals.reduce((a, b) => a + (b - mean) ** 2, 0) / (knownVals.length || 1)) || 1e-9;
      for (const id in deltas) {
        if (ledger.charmEV[id] != null) {
          const tol = charmTol(ledger.charmEV[id]);
          if (Math.abs(deltas[id] - ledger.charmEV[id]) > tol) evDrift.push(`${id}:${(ledger.charmEV[id] * 100).toFixed(1)}→${(deltas[id] * 100).toFixed(1)}pp(허용±${(tol * 100).toFixed(1)})`);
        } else {
          const z = (deltas[id] - mean) / sd;
          if (Math.abs(z) > NEW_ITEM_Z) evNew.push(`${id}(신규,z=${z.toFixed(2)})`);
        }
      }
    }
    const evOk = ledger ? (evDrift.length === 0 && evNew.length === 0) : true;   // ledger 없으면 정보성만(레거시 z-score는 jackpot을 구조적으로 상시-red시켜 폐기 — 결정2)

    let bossDrift = [];
    if (ledger && ledger.bossCond) {
      for (const id in bal.bossCond) {
        if (ledger.bossCond[id] == null) continue;
        if (Math.abs(bal.bossCond[id] - ledger.bossCond[id]) > BOSS_TOL) bossDrift.push(`${id}:${(ledger.bossCond[id] * 100).toFixed(0)}→${(bal.bossCond[id] * 100).toFixed(0)}%`);
      }
    }
    const bossOk = ledger ? bossDrift.length === 0 : true;

    const highR = seeded(R, PRIMARY_SEED, () => R.simulateStrat("balance", { N, stake: 0, variant: "high", bossMinReach: BOSS_MIN_REACH }));
    const PARITY_TOL = 0.03;   // 3pp — v3.29 관측(표준8.5%/high7.9%, Δ≈0.6pp) 대비 여유를 둔 내부 기준(roadmap엔 정확한 pp 수치 없음, "근접"만 명시)
    const parityDelta = Math.abs(bal.clearRate - highR.clearRate);
    const parityOk = parityDelta <= PARITY_TOL;

    const jackpotNote = ledger && ledger.charmEV && ledger.charmEV.jackpot != null
      ? ` | ★jackpot ΔEV=+${(deltas.jackpot * 100).toFixed(1)}pp(ledger baseline +${(ledger.charmEV.jackpot * 100).toFixed(1)}pp, 24종 유일 복리형 chainMul×2 — 수용됨, C2 밸런스 리뷰 대상)`
      : "";

    const ok = evOk && bossOk && parityOk;
    pass("G3", ok,
      `EV drift(ledger-anchor, N=${EV_N}/부적, 허용=max(2.5pp,25%))=${evDrift.length}${evDrift.length ? "(" + evDrift.join(",") + ")" : ""}${evNew.length ? " 신규-이상치=" + evNew.join(",") : ""}; ` +
      `boss cond-pass drift(ledger-anchor, 허용±${(BOSS_TOL * 100).toFixed(0)}pp)=${bossDrift.length}${bossDrift.length ? "(" + bossDrift.join(",") + ")" : ""}; ` +
      `deck parity std=${(bal.clearRate * 100).toFixed(1)}% high=${(highR.clearRate * 100).toFixed(1)}% Δ=${(parityDelta * 100).toFixed(2)}pp` +
      jackpotNote + (ledger ? "" : " ⚠ledger-missing(정보성만 판정)"),
      "부적 EV·보스 cond-pass = ledger baseline ± 허용오차(드리프트 검출, 결정2) — 절대밴드/풀 상대 z-score 아님(jackpot·frost 등 baseline 자체 극값은 ledger에 기록·수용); " +
      "신규(ledger 미기록) 부적만 기존 분포 대비 |z|>2.5 판정; deck parity Δ≤3pp(내부 기준)");
  }

  // ---------------- G4: 조건부 클리어 flatness ----------------
  {
    // ★밴드 해석 주의(selfTest/deviations 참고): roadmap 원문은 "per-blind 85~97%, ≤1 wall"이라 쓰고
    //   "(현재 유일 벽=안테8 큰/닻 ~74~77% 허용)"이라 인용한다. 그런데 v3.29 실측(아래)은 안테5-큰(~84%)·
    //   안테6-큰(~82~83%)도 85% 밑으로 내려간다 — floor를 문자 그대로 85%로 두면 "벽"이 3개(안테5/6/8)가 되어
    //   "유일 벽=안테8" 인용과 모순된다. → 85~97%는 "건강 목표" 서술이고 실제 강제(hard) 벽 판정 하한은 더 낮다고
    //   해석해 WALL_FLOOR=80%로 캘리브(안테5·6은 82~84%로 이 밑에 안 걸리고, 안테8만 76~78%로 걸려 "유일 벽=
    //   안테8"을 재현). 이는 밴드 원문의 불명확함을 gate가 통과하도록 조용히 늘린 것이 아니라, roadmap이 직접
    //   인용한 실측 예시(안테8만)를 재현하는 유일한 해석이라 채택 — 그래도 사람 확인이 필요한 해석 결정이므로
    //   selfTest에 명시적으로 표기한다. (★결정4: 이 해석은 이미 "baseline-anchored"다 — roadmap이 인용한
    //   v3.29 실측 자체가 캘리브 근거라 별도 ledger-diff 메커니즘을 추가하지 않는다. wall/cliff는 baseline 값이
    //   아니라 *구조*(벽 개수·낙폭)를 보는 절대 정책 임계라 milestone별 재캘리브 없이도 유효.)
    const WALL_FLOOR = 0.80, CEIL = 0.97;
    const cond = bal.perBlindCond;
    const wallAntes = new Set();
    const ceilViolations = [];
    for (let a = 1; a <= 8; a++) {
      for (let b = 0; b <= 2; b++) {
        const r = cond[`${a}-${b}`];
        if (r == null) continue;
        if (r < WALL_FLOOR) wallAntes.add(a);
        if (r > CEIL) ceilViolations.push(`${a}-${b}:${(r * 100).toFixed(0)}%`);
      }
    }
    const wallOk = wallAntes.size <= 1;
    const cliffs = [];
    for (let a = 1; a <= 8; a++) {
      if (wallAntes.has(a)) continue;   // 이미 허용된 벽 안테는 그 낙폭을 별도 위반으로 중복 집계하지 않음
      const s = cond[`${a}-0`], b = cond[`${a}-1`], bo = cond[`${a}-2`];
      if (s != null && b != null && (s - b) * 100 > 15) cliffs.push(`안테${a} 작은→큰 -${((s - b) * 100).toFixed(0)}pp`);
      if (b != null && bo != null && (b - bo) * 100 > 15) cliffs.push(`안테${a} 큰→보스 -${((b - bo) * 100).toFixed(0)}pp`);
    }
    const cliffOk = cliffs.length === 0;
    const ok = wallOk && cliffOk && ceilViolations.length === 0;
    const gridDetail = [];
    for (let a = 1; a <= 8; a++) {
      const s = cond[`${a}-0`], b = cond[`${a}-1`], bo = cond[`${a}-2`];
      gridDetail.push(`안테${a}(${s != null ? (s * 100).toFixed(0) : "-"}/${b != null ? (b * 100).toFixed(0) : "-"}/${bo != null ? (bo * 100).toFixed(0) : "-"})`);
    }
    pass("G4", ok,
      `[작은/큰/보스%] ${gridDetail.join(" ")}  |  wall(<80%, 안테그룹)=${[...wallAntes].join(",") || "none"}(${wallAntes.size}/≤1)  ` +
      `cliff(>15pp,안테내)=${cliffs.join("; ") || "none"}  ceil-viol(>97%)=${ceilViolations.join(",") || "none"}`,
      "per-blind 목표 85~97%(건강 서술, red 아님); wall(<80%, v3.29 baseline-anchored 캘리브) ≤1개 안테(결정4); 안테내 낙폭>15pp 없음(벽 안테 제외); >97% 없음");
  }
  return bal;
}

// ============================================================ G5 — economy invariants ============================================================
function runG5() {
  const eco = spawnSync("node", ["tools/economy-check.cjs"], { cwd: ROOT, encoding: "utf8" });
  const ok = eco.status === 0;
  pass("G5", ok, ok ? "economy-check.cjs 전체 통과" : `실패(exit ${eco.status}): ${(eco.stdout || "").slice(-400)}`,
    "economy-check.cjs exit 0 (에스컬레이팅 리롤 · spillover=floor(g*.1) · monotonic gold 등 경제 불변식)");
}

// ============================================================ G6 / G7 — fun-axis 비회귀 + 3뱅크 강건성 (Stage B) ============================================================
// funqa 인프라(tools/funqa/personas.cjs·runner.cjs·metrics.cjs)를 직접 호출 — verify-3bank.cjs와 동일 원료
// (PERSONAS/runFullInstrumented/funScore)를 쓰되, "몇 뱅크를 무슨 임계로 판정할지"는 gate 전용 오케스트레이션
// 이라 별도 함수로 재구성한다(알고리즘 자체의 재정의는 아님 — CLAUDE.md 규칙중복 금지는 rules/content가 대상).
function computePersonaFun(bankSeed, n) {
  const { PERSONAS } = require(path.join(ROOT, "tools", "funqa", "personas.cjs"));
  const { runFullInstrumented } = require(path.join(ROOT, "tools", "funqa", "runner.cjs"));
  const { funScore } = require(path.join(ROOT, "tools", "funqa", "metrics.cjs"));
  const out = {};
  for (const p of PERSONAS) {
    const runs = [];
    for (let i = 0; i < n; i++) runs.push(runFullInstrumented(p.pick, p.strat, bankSeed + i + 1));
    const f = funScore(runs, p.weight);
    out[p.id] = { name: p.name, score: f.score, axes: f.axes };
  }
  return out;
}
function massAppeal(funByPersona) {
  const scores = Object.values(funByPersona).map(x => x.score);
  const happy = scores.filter(s => s >= 6.0).length;
  return happy / scores.length;
}

function runG6_G7(R, ledger) {
  // ★G3(high덱 parity 체크)가 module-level DMULT를 1.29로 남겨두면 funqa(runFullInstrumented가 R.blindTarget을
  //   runFull 경유 없이 직접 호출)가 그 잔류값을 그대로 읽어 오염된다(실측 확인) — orchestration 경계에서 명시 리셋.
  R.resetSimState();
  const banksFun = FUN_BANKS.map(seed => computePersonaFun(seed, N_FUN));
  const appeals = banksFun.map(massAppeal);

  // ---------------- G6: 페르소나 fun 비회귀(1뱅크=대표, ledger 대비) + 대중재미≥70% ----------------
  {
    const fun0 = banksFun[0];
    const appeal0 = appeals[0];
    const drops = [];
    if (ledger && ledger.personaFun) {
      for (const id in fun0) {
        const base = ledger.personaFun[id] && ledger.personaFun[id].bankScores ? ledger.personaFun[id].bankScores[0] : null;
        if (base == null) continue;
        const drop = base - fun0[id].score;
        if (drop > 0.2) drops.push(`${fun0[id].name}:${base.toFixed(2)}→${fun0[id].score.toFixed(2)}(−${drop.toFixed(2)})`);
      }
    }
    const ok = drops.length === 0 && appeal0 >= 0.7;
    const detail = `bank=${FUN_BANKS[0]} N=${N_FUN}: ${Object.values(fun0).map(f => `${f.name}=${f.score.toFixed(2)}`).join(" ")} | 대중재미=${(appeal0 * 100).toFixed(0)}% | ` +
      `하락(>0.2 vs ledger)=${drops.join(", ") || "none"}${ledger && ledger.personaFun ? "" : " ⚠ledger-missing(대중재미만 판정)"}`;
    pass("G6", ok, detail, "persona fun ≥ ledger−0.2(전 페르소나, 결정2) & 대중재미≥70%(bank[0]=" + FUN_BANKS[0] + ", master-spec §10 SSoT 재QA 게이트)");
  }

  // ---------------- G7: 3시드뱅크 강건성(최저뱅크 기준, 절대 판정 — ledger 무관) ----------------
  {
    const detail = FUN_BANKS.map((seed, i) => `b${seed}=${(appeals[i] * 100).toFixed(0)}%`).join(" ");
    const minAppeal = Math.min(...appeals);
    const ok = minAppeal >= 0.7;
    pass("G7", ok, `${detail}  |  최저뱅크=${(minAppeal * 100).toFixed(0)}% (N=${N_FUN}/뱅크)`,
      "min-bank mass-appeal≥70% (뱅크 " + FUN_BANKS.join("/") + ", master-spec §10 고정 3뱅크)");
  }

  return banksFun;
}

// ============================================================ --snapshot: content-ledger 재생성 ============================================================
function runSnapshot() {
  const R = require("./run-sim.cjs");
  console.log(`content-ledger 스냅샷 생성 중 (tier=${FAST ? "fast" : "full"}, N=${N}, evN=${EV_N}, funN=${N_FUN}, seed=${PRIMARY_SEED})...`);

  const STRAT_IDS = Object.keys(R.STRATS);
  const buildDiversity = {};
  let bal;
  for (const s of STRAT_IDS) {
    const r = seeded(R, PRIMARY_SEED, () => R.simulateStrat(s, { N, stake: 0, variant: "standard", bossMinReach: BOSS_MIN_REACH }));
    buildDiversity[s] = r.clearRate;
    if (s === "balance") bal = r;
  }

  const charmIds = R.CHARMS.map(c => c.id);
  const charmEV = {};
  for (const id of charmIds) {
    const r = seeded(R, PRIMARY_SEED, () => R.simulateStrat("balance", { N: EV_N, stake: 0, variant: "standard", forceOwned: [id] }));
    charmEV[id] = +(r.clearRate - bal.clearRate).toFixed(4);
  }

  const highR = seeded(R, PRIMARY_SEED, () => R.simulateStrat("balance", { N, stake: 0, variant: "high", bossMinReach: BOSS_MIN_REACH }));
  R.resetSimState();   // ★high덱 parity 체크 뒤 잔류 DMULT가 아래 funqa 계측을 오염시키는 것을 방지(gate.cjs G6/G7과 동일 이유)

  const personaFun = {};
  const banksFun = FUN_BANKS.map(seed => computePersonaFun(seed, N_FUN));
  for (const id in banksFun[0]) {
    personaFun[id] = {
      name: banksFun[0][id].name,
      bankScores: banksFun.map(b => b[id].score),
      axes: banksFun[0][id].axes,
    };
  }

  const jackpotPP = (charmEV.jackpot * 100).toFixed(1);
  const bossCondPct = id => bal.bossCond[id] != null ? (bal.bossCond[id] * 100).toFixed(0) + "%" : "N/A(표본부족)";
  const ledger = {
    version: "v3.29",
    generatedAt: new Date().toISOString(),
    seed: PRIMARY_SEED,
    tier: FAST ? "fast" : "full",
    N, evN: EV_N, bossMinReach: BOSS_MIN_REACH, funN: N_FUN, funBanks: FUN_BANKS,
    st0Clear: bal.clearRate,
    buildDiversity,
    perBlindCond: bal.perBlindCond,
    bossCond: bal.bossCond,
    charmEV,
    deckParity: { standard: bal.clearRate, high: highR.clearRate },
    personaFun,
    notes: [
      `jackpot: forced-inclusion ΔclearRate=+${jackpotPP}pp (baseline ${(bal.clearRate * 100).toFixed(1)}%→${((bal.clearRate + charmEV.jackpot) * 100).toFixed(1)}%) — ` +
      `24종 중 유일 복리형(chainMul×2, runLen≥4). C2 밸런스 리뷰 대상으로 기록·수용(G3는 이 값을 anchor로 삼아 red 아님).`,
      `frost: boss cond-pass=${bossCondPct("frost")} — 밴드 상한(구 z-score 절대밴드 98%) 근접/초과가 관측된 baseline. G3는 anchor로 수용(red 아님).`,
    ],
  };
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
  console.log(`기록됨: ${path.relative(ROOT, LEDGER_PATH)}`);
  console.log(`  St0 clear=${(ledger.st0Clear * 100).toFixed(2)}%  jackpot ΔEV=+${jackpotPP}pp  frost cond-pass=${bossCondPct("frost")}  ` +
    `대중재미(bank0)=${(massAppeal(banksFun[0]) * 100).toFixed(0)}%`);
}

// ============================================================ 출력 ============================================================
function printScorecard(ledger) {
  const tierLabel = FAST ? `--fast (N=${N})` : `--full (N=${N})`;
  console.log(`\n${"=".repeat(70)}\ngate.cjs 스코어카드 — ${tierLabel}${ledger ? `  [ledger: ${ledger.version}@${ledger.generatedAt}]` : "  [⚠ledger 없음]"}\n${"=".repeat(70)}`);
  for (const r of results) {
    const icon = r.status === "GREEN" ? "🟢" : r.status === "RED" ? "🔴" : "⏭️ ";
    console.log(`\n${icon} ${r.gate.padEnd(5)} ${r.status}`);
    console.log(`   밴드: ${r.band}`);
    console.log(`   실측: ${r.detail}`);
  }
  const reds = results.filter(r => r.status === "RED");
  const greens = results.filter(r => r.status === "GREEN");
  const skips = results.filter(r => r.status === "SKIP");
  console.log(`\n${"=".repeat(70)}`);
  console.log(reds.length
    ? `❌ RED ${reds.length}건: ${reds.map(r => r.gate).join(", ")}  (GREEN ${greens.length} / SKIP ${skips.length})`
    : `✅ 전체 GREEN (${greens.length}개, SKIP ${skips.length}개 제외)`);
  console.log(`\nRESULT_JSON:${JSON.stringify({ tier: FAST ? "fast" : "full", N, seed: PRIMARY_SEED, ledger: ledger ? { version: ledger.version, generatedAt: ledger.generatedAt } : null, results })}`);
}

// ============================================================ 실행 ============================================================
function main() {
  if (SNAPSHOT) { runSnapshot(); return; }

  runG0();
  const R = require("./run-sim.cjs");
  const ledger = loadLedger();
  runG1(R);
  runG2_to_G4(R, ledger);
  runG5();
  runG6_G7(R, ledger);
  printScorecard(ledger);
  const anyRed = results.some(r => r.status === "RED");
  process.exit(anyRed ? 1 : 0);
}

main();

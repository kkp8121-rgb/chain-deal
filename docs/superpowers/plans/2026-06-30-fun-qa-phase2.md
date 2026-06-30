# Fun QA — Phase 2 (LLM 재미 판정관) Implementation Plan

> **For agentic workers:** 작은 단위(3 태스크) — inline 구현. Steps use checkbox 추적.

**Goal:** Phase 1 메트릭+대표 궤적을 마크다운 판정 팩으로 묶고, Claude Code 세션이 페르소나별 재미를 정성 판정하는 프로토콜을 구축한다.

**Architecture:** `tools/funqa/judge-pack.cjs`(생성기) + `JUDGING.md`(프로토콜). 외부 API·의존성 0 — Claude Code 개발 세션이 판정자. 선행 = Phase 1(main 머지 완료).

**Tech Stack:** Node.js `.cjs`, 의존성 0. run-sim/runner/metrics/personas require.

---

## Task 1: judge-pack.cjs (판정 팩 생성기)

**Files:** Create `tools/funqa/judge-pack.cjs`

- [ ] **Step 1: 구현** — 5종 페르소나 × N판 → 각 페르소나에서 대표 궤적 3종(전형적 승리·전형적 패배·near-miss) 선별 → 안테별 1줄 내러티브 마크다운 생성.
  - 궤적 선별: 승리=클리어 판 중 마지막 마진 중앙값(없으면 최고 도달), 패배=최빈 deathAnte, near-miss=margin 1.0~1.15 라운드 최다 판.
  - 라운드 1줄 = `안테N {작은/큰/보스(KO)}: 클리어/실패 (마진, 최대체인, 족보 / 점수·목표)`.
  - 헤더에 Phase 1 정량 표(재미점수·클리어%) + 판정 지침(정량에 휘둘리지 말 것).
- [ ] **Step 2: 검증** — `node tools/funqa/judge-pack.cjs 300 > /tmp/pack.md` 후: 5종 페르소나 섹션, 각 3궤적, NaN/`undefined`/빈 궤적 없음, 마크다운 구조 정상.
- [ ] **Step 3: Commit** — `feat(funqa): 판정 팩 생성기(judge-pack)`

## Task 2: JUDGING.md (판정 프로토콜)

**Files:** Create `tools/funqa/JUDGING.md`

- [ ] **Step 1: 작성** — 판정 절차(팩 생성 → Claude Code 판정 → 종합), 판정 기준(취향 렌즈, 정량 비휘둘림), 출력 형태(페르소나별 0~10+이유+의심지점, 종합 대중재미).
- [ ] **Step 2: Commit** — `docs(funqa): 판정 프로토콜 JUDGING.md`

## Task 3: 시범 판정 (Phase 2 검증)

- [ ] **Step 1** — `node tools/funqa/judge-pack.cjs > funqa-judge-pack.md` 생성.
- [ ] **Step 2** — Claude Code(이 세션)가 팩을 읽고 5종 페르소나 정성 판정 + 종합. 핵심: "마스터리·안전·스릴 5축 수렴 = 실질적으로 같은 플레이인가"를 짚는지.
- [ ] **Step 3** — 판정 결과를 `funqa-judgment.md`로 저장(Phase 3 회귀 기준선). gitignore 여부 결정(생성물).
- [ ] **Step 4: Commit** — `docs(funqa): Phase 2 시범 판정 결과`

## 완료 기준
- judge-pack.cjs가 5종×3궤적 마크다운 정상 생성.
- Claude Code 시범 판정 1회 성공 — 페르소나별 점수+이유+의심지점.
- LLM이 정량(5축 수렴)이 못 잡은 "페르소나 차별 부족"을 정성으로 짚음.

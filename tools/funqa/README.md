# Fun QA

기존 밸런스 시뮬이 못 잡는 "재미·주체성·체감"을 5종 페르소나 봇의 분포로 측정하고, Claude Code 세션이 정성 판정한다.
**워크플로**: 게임 변경 브랜치 → Fun QA 보고서 → 개발 세션이 읽고 보완 → 회귀로 효과 확인 → 반복.

## 실행

**Phase 1 — 정량 (자동, LLM 없음)**
- 리포트: `node tools/funqa/run-funqa.cjs [N=2000]` — 5종 페르소나 재미 5축 + 대중재미 분포(70% 임계)
- 테스트: `node tools/funqa/funqa.test.cjs` — 골든(인색한손 주체성↓) + 드리프트 가드

**Phase 2 — 정성 (Claude Code 판정)**
- 판정 팩: `node tools/funqa/judge-pack.cjs [N] > funqa-judge-pack.md`
- Claude Code에 "이 팩 읽고 재미 판정해줘" → 페르소나별 0~10 + 이유 + **보완 제안** (절차: `JUDGING.md`)

**Phase 3 — 회귀 (보완 효과 측정)**
- 보완 전: `node tools/funqa/regress.cjs --save` (기준선 저장)
- 보완 후: `node tools/funqa/regress.cjs` — 페르소나별 재미 Δ + 클리어% Δ, 재미 하락(Δ≤-0.3) 시 exit 1

## 구조
- `personas.cjs` — 5종 페르소나(마스터리 **2-ply 룩어헤드**·안전·콤보·스릴·캐주얼) + 재미축 가중치
- `runner.cjs` — 시드 고정 계측 풀런(run-sim 규칙 require, 매 턴 후보점수 수집)
- `metrics.cjs` — 재미 5축(주체성·긴장·도파민·다양성·흐름)
- `report.cjs` — 대중재미 분포 판정
- `judge-pack.cjs` — 정성 판정 팩 생성(대표 궤적: 승리/벽/near-miss)
- `JUDGING.md` — 판정 프로토콜 + 보완 제안 + 회귀 절차
- `regress.cjs` — 보완 전후 재미 회귀 게이트
- `judgment-YYYY-MM-DD.md` — 판정 결과(Phase 3 회귀 기준선)

## 규칙 SSoT / 드리프트
규칙은 `run-sim.cjs`에서만 require. 밸런스 변경 시 `funqa.test.cjs` 드리프트 가드가 불일치 검출. 스테이크 St0(평지) 고정.

## 한계 (정직)
- **봇 ≠ 사람**: 그리디 봇은 낙승/양극화 → 사람 텔레메트리(`logEvent` 시트) 대조 미완. 가장 근본적 미검증.
- **페르소나 차별**: 마스터리 2-ply로 일부 해소(클리어 7.6→12%), 안전·스릴은 아직 수렴 경향.
- **미구현**: LLM 플레이테스터(think-aloud, 의심지점 직접 재생), 스테이크 가변.

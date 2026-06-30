# Fun QA (정량 코어)

기존 밸런스 시뮬이 못 잡는 "재미·주체성·체감"을 5종 페르소나 봇의 분포로 측정한다.

## 실행
- 리포트: `node tools/funqa/run-funqa.cjs [N=2000]`
- 테스트(골든+드리프트 가드): `node tools/funqa/funqa.test.cjs`

## 구조
- `personas.cjs` — 5종 페르소나(마스터리·안전제일·콤보러·스릴러·캐주얼) pick + 재미축 가중치
- `runner.cjs` — 시드 고정 계측 풀런(run-sim 규칙 require, 매 턴 후보점수 수집)
- `metrics.cjs` — 재미 5축(주체성·긴장·도파민·다양성·흐름)
- `report.cjs` — 대중 재미 분포 판정(패널 70%+ 임계 6.0 = PASS)

## 규칙 SSoT / 드리프트
규칙은 `tools/run-sim.cjs`에서만 require. 밸런스 변경 시 `funqa.test.cjs`의 드리프트 가드가 불일치를 검출.
스테이크는 St0(평지) 고정 — 가변은 Phase 3.

## 한계 (정직)
- 1-ply 배치라 마스터리/안전/스릴 차별은 주로 STRAT·ctx 기반(룩어헤드는 후속). 첫 실행에서 세 페르소나의 5축이 수렴함을 확인.
- 봇이 사람 재미를 대표하는가는 미검증 가설 — 사람 텔레메트리 대조 필요.
- LLM 정성판정·패치 회귀 게이트는 Phase 2·3.

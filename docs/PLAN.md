# CHAIN DEAL — 개발 플랜 (체크리스트)

> 진행하며 `[ ]` → `[x]`로 체크. 상세 인수인계는 `../HANDOVER.md`, 디자인 근거는 `roguelite_idea_formula.html`.
> 최종 업데이트: 2026-07-01 (v3.29 기준)

---

## ✅ 완료 (v3.10까지)

- [x] 코어: 트럼프 체인(같은무늬/숫자/±1) + 안테 8 + 보스 5종 + 덱빌딩 상점
- [x] 포커 족보 보너스 — 텍사스 서열 라벨 + 빈도보정 *가산* (체인 메인 / 족보 보너스)
- [x] 인게임 족보 미리보기 + 룰/족보 **드로어**(터치로 펼침)
- [x] **정산 표** 명료화 (체인 + 족보 = 최종 / 목표)
- [x] 리텐션 — **최고 기록·통계**(localStorage, 신기록 축하)
- [x] **데일리 시드** — mulberry32 시드 RNG, 🗓 데일리 챌린지(같은 날 같은 판)
- [x] **손패 회수 버그 수정** (치명적 — 덱 고갈/카드 양산)
- [x] 플레이로그(게임→Apps Script→구글시트) + Giscus 댓글
- [x] 문서 실명 익명화 (BHS/KSW/TR)
- [x] GitHub Pages 배포 (https://kkp8121-rgb.github.io/chain-deal/)

---

## ☐ A. 즉시 (기능 완성)

- [x] **A1. 덱 뷰어** ✅ (v3.11) — `deckinfo` 클릭 → 드로어로 덱 전체 무늬별 + enh + 같은숫자 알림
  - 근거: 빌드의 *전제*(플러시 노리려면 ♥ 몇 장인지 봐야) + 버그 재발 감시. 슬더슬도 덱 상시 열람. (태령 요청)
- [x] **A2. 리더보드 (2종)** ✅ (v3.13) — 데일리+전체 top10, JSONP, 닉네임. 재배포·작동 확인 완료(새 URL 교체)
- [ ] **A3. 커밋 히스토리 실명 익명화** — 과거 커밋 2건 본문 실명 → force push (⚠️ 비가역, 확인 후)

---

## ☐ B. 디자인 확장 — 원패턴 방지 / 빌드 다양화 (웹서치 검증)

> 검증 결론: 우리는 **압축형(슬더슬) + 보너스 족보(발라트로)** 하이브리드.
> → 압축 유지 / 무작정 카드 추가 ❌(비대화) / 다양성은 **부적·유물·발칙 족보**로.

- [x] **B1. 빌드 다양화** ✅ (v3.14) — 부적 **5종 → 10종**, 새 아키타입 4개
  - 신규: 흑심(noir, 검정 연결 배율+2·pyro 거울/2색) · 중개상(broker, 페어·투페어·트리플 족보 보너스↑) · 쌍둥이(twins, 겹치는 그룹마다 +3%) · 정련가(compactor, 덱 압축할수록 base↑) · 잔챙이(runts, A·2·3 base+4)
  - 빈 축이던 **족보 빌더**(broker/twins) + **검정/2색**(noir) + **덱 압축 페이오프**(compactor/runts) 개방
  - 검증: run-sim 5빌드 — 폭주 없음(전부 ≤밸런스 9%), noir 색빌드 성립(3.5%>플러시 0.8%), 족보·압축은 설계대로 보조. 상점 희석 −0.9%p(미미)
  - 컷(보류): ledger/interest(곱셈), mono/bounty/allin(스택·서브시스템), 포지션 3종(다음 확장)
  - 근거: 발라트로 "1~2 전략 올인". 현재 빌드 경로 적음 → 물림 방지
- [x] **B2. 발칙 족보/아이템 (★②규칙 파괴)** ✅ (v3.13) — 🃏파이브 카드(같은 숫자 5장) + 카드 복제 상점. 트럼프 룰을 깨는 발칙 요소
  - 예: "같은 카드 몰빵 덱"(버그가 우연히 보여준 재미), "한 무늬로 변환", "같은 카드 5장 = 새 족보"(발라트로 플러시 파이브)
  - 근거: `roguelite_idea_formula`의 ②(규칙 파괴)가 우리 게임에 가장 부족. 가장 큰 재미 레버
- [ ] **B3. (원칙) 카드 추가 = 의도적 빌드만** — 무작정 추가는 덱 비대화로 연결률↓ (배현성 통찰)
- [x] **B4. 액트 구조 + 보스 12종** ✅ (v3.17) — 8안테→3액트(3+3+2), 보스 5→12종(액트별 티어 풀 + 액트-final 안테 액트 보스). 신규 7룰(사치세/보릿고개/연결세/부식/냉각/단일강요/닻). tmult 캘리브로 balance 9.3% 기준선 복원, 3파일 드리프트 0. 검증 `node tools/run-sim.cjs`·`balance-check.cjs`
- [x] **B5. 정산 순차 연출 + 빠른연출 토글** ✅ (v3.18, 로드맵 NEAR Top Rec) — `settle()` 정산을 왼→오 **카운트업**(체인→족보보너스→최종, 음정상승·bump, 목표돌파 순간 클라이맥스)으로. ⏩토글(기본 OFF)+클릭 스킵+`prefers-reduced-motion`. **연출은 순수 표시**(점수계산 무손상, `render()` 미호출, `.cjs` 동기화 불필요). ★정정: CHAIN DEAL은 배치 때마다 즉시 누적이라 "한 번 번쩍"은 정산 오버레이뿐. 검증 `balance-check`(불변) + **Playwright 실Chromium 스모크**. 상세 HANDOVER §6·§7🧭

- [x] **B6. 원탭 결과 공유** ✅ (v3.21) — 런 종료 정산 📋공유 버튼: 모바일 navigator.share / 데스크탑 클립보드. Wordle식 스포일러-프리(안테 이모지 스트립 🟩🟥⬜👑 + 데일리 날짜 + 최고점 + URL). 자기홍보 대신 공유성=무료게임 확산. 검증 Playwright. 상세 HANDOVER §6

- [x] **B7. 난이도 사다리 (Stakes)** ✅ (v3.22, 로드맵 MID 1번) — 6스테이크(St0 평지~St5 심연), 클리어로 해금(`cd_meta.maxStake`). `S.stake` 전역 델타(stake0=no-op): 목표 스칼라(STAKE_T/AC)·통과골드 바닥0·후반가속·보스전 손패2. UI 선택기+HUD 배지+해금 배너+공유/리더보드 동봉. 캘리브 run-sim 8.9→0.6 단조. ★교훈: 게이트 곱연산→6티어가 정직, 캡·보스룰큰 레버 제외/보류. 검증 run-sim 스윕·Playwright·economy-check. 설계 `docs/superpowers/specs/2026-06-25-difficulty-ladder-design.md`, 상세 HANDOVER §6

- [x] **B8. 위치-맥락 부적 3종** ✅ (v3.23, 로드맵 MID 2번) — 다리(양옆연결)·오름계단(최장 오름차순)·주춧돌(0·3·7칸 자리값 평균초과분). 정산 가산·blindBase·바운드. 카드추가 0. 캘리브: 밸런스 9.4%(기준선 복귀)·spatial 3.4%(비지배). 메트릭 index↔run-sim 미러. 검증 run-sim 6빌드·unlock-check·Playwright. 상세 HANDOVER §6
- [x] **B9. 부적 시너지 확장 10종** ✅ (v3.24, 로드맵 MID — 부적 13→23종) — 4클러스터(보석세공 enh스태킹·정점 고랭크7·8·같은수카르텔 족보↔체인·홀짝패리티). 전부 가산·바운드, connect 시그니처 무변경(2파일 미러). cost 차등 도입. 5렌즈 생성→적대적 밸런스 심사(27 agents)→합성. 컷: scout(41%인플레)·mono(보스id)·색계열5종. ★**희석 발견**: 23종 풀이 sim balance 9.6→3.5%(인플레 아님 — 완성형 베테랑 최악케이스, 신규 전부 비지배 gem1.3/apex2.7/cartel1.9/parity1.1%). **상점 희석 메커니즘이 최우선 후속**. 검증 run-sim 무인플레·unlock-check 26/0·노드 DOM 스모크 9/0(Playwright 미설치 대체). 설계 `docs/superpowers/specs/2026-06-29-charm-synergy-expansion-design.md`·계획 `…/plans/2026-06-29-charm-synergy-expansion.md`. 상세 HANDOVER §6
- [x] **B10. 상점 희석 완화** ✅ (v3.25, B9 희석 직접 후속) — ①상점 리롤(에스컬레이팅 골드, 주체성 도구) ②**가중 오퍼**(cluster 태그·미투자 클러스터 0.15 가중=실제 fix). ★발견: 리롤은 sim서 희석 못 고침(다부적 스태킹 경제선 선택성=손해)→주체성으로만 유지·sim 미모델. 가중이 fix(balance 3.5→7.6% 회복, 베이스라인 9.6% 미초과). W 캘리브로 0.15 확정(저W가 교차클러스터 희석까지↓). 검증 run-sim 회복·노드 스모크(리롤 8/0·가중 10/0)·economy/unlock. 설계 `…/specs/2026-06-29-shop-reroll-design.md`. 상세 HANDOVER §6
- [x] **B11. 위치-맥락 보스룰 내리막** ✅ (v3.26, seal_run 교체) — 오름차순 ±1 연결 봉인(내림·같은무늬/숫자·와일드 정상). 보스 추가 금지 준수(12종 유지). ★connect 대칭성 보존 위해 climbSealed를 connect서 빼고 placeCard/gain 체인 판정에만(bridge 무영향). 3파일 동기화. tmult 0.72 캘리브(balance 7.5%≈기준선 불변, 내리막 조건부 90% 건강). stair/오름 빌드 타겟 counterplay. 검증 balance-check 게이지·run-sim·DOM 스모크 13/0. 설계 `…/specs/2026-06-29-position-boss-rule-design.md`. 상세 HANDOVER §6

> **📍 중장기 로드맵(웹리서치 2026-06-25) = HANDOVER §7 🧭.** ✅**NEAR(폴리시)**(v3.18~21) + ✅**MID 1 난이도 사다리(v3.22)** + ✅**MID 2 위치-맥락 부적(v3.23)** + ✅**MID 3 부적 시너지 확장 23종(v3.24)** + ✅**MID 4 상점 희석 완화(v3.25)** + ✅**MID 5 위치-맥락 보스룰 내리막(v3.26)** + ✅**색 settle 페이오프 투톤(v3.27, 부적 24종)** + ✅**시작덱 변형 MVP 고랭크덱(v3.28)** + ✅**불씨덱 캐주얼 도파민 수정(v3.29, 재미QA 대응 — 대중재미 60→80% PASS)**. **▶다음 = 상업화 로드맵 C2(부적 24→50)** — 근거 `docs/production-roadmap.md`. (~~스릴러 블로커~~ = 봇/메트릭 아티팩트로 **기각·종료**, memory `thriller-artifact-verdict`.)

> **📌 C2 pre-step 트라이애그 결과 (2026-07-10, 시드측정 확정) — 계수버프 ≠ 레버:** 로드맵/master-spec §65가 C2 선행으로 지정한 "약빌드 v3.29 재측정 → 버프-또는-컷" 수행. **재측정**: 함정빌드 4종 = parity 1.47%·spatial 1.85%·gem 2.00%·compact 2.66% (vs healthy black 7.81/apex 6.86/color 6.96/flush 5.74%; balance 8.45%). ★pre-v3.29 3종(parity/position/gem)보다 **악화 + compact 신규 합류**(불씨 와일드가 비-와일드속성 빌드를 눌러 로드맵 경고 확증). **버프-또는-컷 판정 = 둘 다 아님**: 앵커부적 계수상향은 시드고정 페어드측정(seed42·N=20000)서 **함정빌드(+0.25~0.64pp)보다 healthy 빌드를 더 키움**(balance +1.41·black +2.07) → 절대격차 확대(6.98→7.77pp), threshold-게이팅도 leak 불가(병인=buy-everything filler-buy, 부적 트리거가 어떤 강한 줄에서도 우발발생). **∴ 함정빌드 약점 = 계수 아닌 전략 비효율.** ★**후속 PoC로 build-exclusive 시너지도 검증 → settle-gimmick엔 무효**: evenodd를 paritybet 동시보유 시 증폭(build-exclusive)해 run별재시드 페어드측정 → **parity +0.14pp만**(1.77→1.91, 여전히 최하위·타빌드 드리프트와 구분불가). **근본원인 = 구조적 안티시너지**: parity의 one-parity 줄은 랭크 ±2씩 → **±1 연결(3연결타입 중 1개)을 자진 포기**하고 약한 settle과 맞바꿈=self-sabotage. **정제된 per-cluster 판정** → (parity) settle 아닌 **mult-복원 메커니즘** 또는 **CUT** · (spatial) 그리디봇 배치 미모델=**sim 아티팩트, committed-placement 모델 선행** · (gem/compact) **체인-시너지 신규부적**(settle 적재 금지). ★**C2 대원칙 = 함정클러스터 fix는 mult엔진에 기여(체인-시너지)해야지 settle 보너스 적재는 leak+무스케일.** 상세 memory `balance-calibration` §8. 두 실험 모두 revert·게이트 9/9 GREEN 복원. **+게이트 표면화 C2 리뷰대상**: jackpot=24종 유일 복리형(chainMul×2, ΔEV +45pp) — 80종 확장 시 재검토.

---

## ☐ C. 나중

- [ ] **C1. 밸런싱 3차** — 사람 로그 데이터(death 안테별 피벗)로 실측 밸런싱
- [x] **C2. 아웃게임 경제** ✅ (v3.16) — 무료 상점 → **골드 유료 상점**(통과 초과율 환전 `floor(1+(점수/목표−1)*4)`, 가격 상8/중5/하3 멀티구매). 런 종료 시 **남은 골드 1/10** → 메타 코인. 메타 상점: 재도전권(캡3)/시작골드+N(Lv3)/시작리롤+1(Lv2). 캘리브 balance 8.8%≈기준선. 검증 `node tools/economy-check.cjs`
- [~] **C3. 해금/컬렉션** — 플레이로 새 부적·보스 해금
  - [x] **C3-부적** ✅ (v3.15) — B1 신규 5종 업적 해금(등급+도전과제) + 🧿 컬렉션 드로어 + 정산 알림 + cd_stats 소급. 검증 `node tools/unlock-check.cjs`
  - [ ] **C3-보스/카드효과/시작덱** — 차기 (이번엔 부적만)
- [x] **C4. 모바일 반응형** ✅ (v3.19~v3.20)
  - [x] **C4-베이스라인** ✅ (v3.19) — 제로뎁: viewport-fit=cover + 전역 touch-action:manipulation(300ms 탭딜레이 제거) + safe-area(body+고정 오버레이) + overscroll-behavior:contain + 82dvh + :active 피드백. 게임로직 0 변경. 적대적 리뷰(2렌즈)가 헤드리스 못 잡는 오버레이 safe-area 갭 발견. 검증 Playwright 4뷰포트. 상세 HANDOVER §6
  - [x] **C4-세로(portrait) 레이아웃** ✅ (v3.20) — 8칸 보드 한 줄 scale-to-fit(`.row nowrap` + `.row .pcard{flex:0 1 50px; aspect-ratio:50/72}`, board만 스코프). 넓은 화면 50px 고정(데스크탑 무변)·좁은 폰 비율 축소(360→34/320→29). CSS-only. 검증 Playwright 5폭 + 320px 시각확인. 상세 HANDOVER §6

---

## 진행 순서 (제안)
**A1 덱 뷰어 → A2 리더보드 → B2 발칙 족보 → B1 부적 확장 → A3 커밋 익명화 → C 시리즈**

(B2 발칙 족보를 B1보다 먼저: 게임의 가장 부족한 ②를 메우는 게 임팩트 큼)

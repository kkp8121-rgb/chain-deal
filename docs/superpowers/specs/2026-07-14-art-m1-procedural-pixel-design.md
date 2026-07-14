# CHAIN DEAL — 아트 마일스톤 M1: 절차적 픽셀 아트 (A0+A1 일부, 카드/부적 적용) 설계

> 작성: 2026-07-14 · 상태: **설계(구현 전)** · 상위 SSoT: `docs/production-roadmap.md` §4(ART TRACK) + memory `engine-renderer-decision`
> 방향 결정(본 spec §0): **때깔 마일스톤 가동(M1→M2→M3) + C2/밸런스 완전 동결.**
> ★3렌즈 적대적 검수(2026-07-14, 16건: CRITICAL 1·MAJOR 5·MINOR 10) 반영 개정판 — 주요 반영: concat star-토폴로지 규율, (shape,accent) 유니크 재매핑, 코너=랭크 글리프 전용, CVD 수용기준 현실화, deco 보류.

---

## 0. 방향 결정 (2026-07-14 논의 확정)

**늪 진단**: v3.22~v3.29~C2 트라이애그까지 약 3주가 전부 sim 캘리브 모양의 작업이었고, C2 트라이애그(07-10)는 "sim은 build-specific 콘텐츠를 구조적으로 평가 불가"를 확정하며 레버 5종 전부 기각 — 진행 엔진(sim 루프)이 이 마일스톤에서 소진됐다. 플레이어가 보는 게임 모습은 그동안 거의 불변.

**결정** (사용자 확정):
1. **다음 국면 = "때깔"** — 아트·juice·셸. 로드맵 §4 아트 트랙은 원래 C2~C9와 병렬 트랙이며 C2 의존성 없음.
2. **하위 마일스톤 분해 (접근 1 승인)**: **M1 = 로드맵 A0(생성기+팔레트+스키마) + A1 일부(카드/핍/enh 시스템 + 컨택트시트 구분성, 단 22종 스케일) + 현 DOM 게임 적용**(본 spec, 공수 ~1.5–2.5주 상당) → **M2 = 보드 PixiJS 스왑 + 발라트로급 juice**(별도 spec, memory `engine-renderer-decision`의 8~13주 트랙 시작) → **M3 = GPT 배경 + UI 킷 + 셸 폴리시 통합**(별도 spec). A0를 먼저 하는 근거 = "절차적 아이콘이 param→그리기로 재저작되는 시점이 WebGL 타깃의 최저 증분 지점"(렌더러 결정 memory) — M2에서 카드를 두 번 만들지 않는다.
3. **C2/밸런스 = 완전 동결**: `2026-07-10-c2-charm-expansion-design.md`의 기본값(**parity CUT 완료 + gem/compact/spatial spice 수용 + healthy 집중**)을 확정 기록으로 남기고, C2 재개는 아트 국면 이후. 그동안 `gate.cjs`(pre-commit --fast)가 회귀만 지킨다. 아트 작업의 **철칙 = rules/content 수치·훅 무손상**(gate 9/9 GREEN 불변).

---

## 1. M1 범위

**In**: 마스터 16색 팔레트 + 색약(CVD) 검증 · 픽셀 드로잉 프리미티브 · **32장 카드 페이스**(핍 배치·코너 랭크·enh 오버레이) 절차적 렌더 · **부적 엠블럼 22종**((shape,accent) 유니크 어휘, 80종 확장 여유) · 게임 내 표시 지점 교체(줄/손패/덱 카드픽커/무늬픽커/덱뷰어/부적 태그/상점 오퍼/컬렉션) · innerHTML 표면용 **하이드레이션 API** · 컨택트 시트(`?art=sheet`) + CVD 시뮬.

**Out (명시적 제외)**: 보스 시질(A2/M3) · 배경/UI 킷(M3) · WebGL/PixiJS(M2) · 카드 뒷면(덱은 카운트 표시뿐) · **`mc()` 룰 설명용 인라인 미니카드 = 텍스트 유지**(산문 가독성; ★단 덱뷰어의 `mcEnh`는 In — §6.5에서 canvas 전환. 같은 `.mcard` 계열이지만 정책 분리: 룰 산문=텍스트 / 덱 실카드=픽셀) · deco 차원(§5 — 80종 확장 시 도입, YAGNI) · 트레일러/스토어 에셋 · 신규 런타임 의존성(0 유지).

---

## 2. 아키텍처 — `src/art/` 모듈

```
src/art/
  palette.cjs   ART_PAL(마스터 16색) + 시맨틱 별칭 + ART_ACCENT(클러스터/부적 액센트 맵)
  pixel.cjs     프리미티브: artCanvas(w,h), 픽셀/사각형/스탬프, 문자열 비트맵 스프라이트 디코더, 3×5 픽셀 랭크 글리프(A·2~8)
  sprites.cjs   무늬 핍 비트맵(♠♥♦♣ 9×9/7×7/5×5) + enh 배지(★●◆ 픽셀판) + 엠블럼 shape/symbol 비트맵 어휘
  cards.cjs     artDrawCardFace({suit,rank,enh}) → 25×36 canvas (faceCache로 유니크 조합 1회 렌더)
  charmart.cjs  artDrawCharmEmblem(art, cluster, locked) → 16×16 canvas
  sheet.cjs     artContactSheet(root) — ?art=sheet 진입 시 전체 그리드 + CVD 3종 시뮬 렌더
  art.cjs       파사드 + artHydrate(root) — innerHTML 표면의 canvas[data-*] 스캔 페인트
```

**raw-concat 제약 준수 (CRITICAL — 검수 반영)**:
- **star 토폴로지 강제**: art/ leaf 모듈은 **서로 require하지 않는다**(공유 의존 다이아몬드 금지 — build.mjs 리졸버는 순환만 검출하고 중복 인라인은 dedup하지 않아, leaf 간 require는 top-level 중복 선언 → 브라우저 SyntaxError가 되며 §7의 어떤 노드 게이트도 못 잡는다). **`art.cjs`만이 palette→pixel→sprites→cards→charmart→sheet 의존성 순서로 각 leaf를 정확히 1회 require**하고, leaf는 앞서 인라인된 심볼을 concat 스코프 전역으로 참조한다(현 `src/ui/` 패턴과 동일). `main.cjs`는 `./art/art.cjs` 하나만 require.
- **art/는 브라우저 전용** — Node에서 leaf 단독 require 시 concat 전역이 없어 실패(의도됨). 어떤 tools/*.cjs도 art/를 require하지 않는다(sim 무관).
- require/module.exports는 build.mjs 정규식 형식(한 줄 destructuring, 후행 주석 금지) 엄수.
- concat 후 전역 이름 충돌 방지: art/ 모듈 최상위 식별자는 전부 **`art`/`ART_` 접두**.
- `build.mjs` 표적 보강 2건: ①ART_DIR 파싱 게이트(listCjsFilesRecursive(src/art)) ②**리졸버에 seen-set 중복 require 검출(중복 시 throw)** — "같은 모듈 두 곳 require 금지" 규칙을 조용한 붕괴에서 빌드 실패로 승격.

**데이터 스키마**: 각 부적 레코드에 `art:{shape,symbol,accent}` 필드 추가(`src/content/charms.cjs`). accent는 **전 부적 명시**(§5 매핑 표가 SSoT — cluster 유도 아님, 클러스터 색 예약 규칙은 §3). deco는 M1 보류(§1 Out). **sim에는 불활성 데이터**(run-sim이 hooks만 소비) — 게이트 무영향.

**공개 API** (전부 param→canvas 순수 함수): `artDrawCardFace(card)` · `artDrawCharmEmblem(art,locked)` · `artHydrate(root)`(`canvas[data-cface]`/`canvas[data-emblem]` 스캔 페인트 — innerHTML로 만드는 표면 공용) · `artContactSheet(root)`.

## 3. 마스터 16색 팔레트 (`ART_PAL`)

| # | 슬롯 | 초안 hex | 용도 |
|---|---|---|---|
| 1 | paper | `#f2ead8` | 카드 바탕 |
| 2 | paper-shade | `#cfc5ac` | 카드 음영/테두리 안쪽 |
| 3 | ink | `#20222b` | 흑 무늬(♠♣)·윤곽 |
| 4 | ink-soft | `#4a4f5e` | 보조 윤곽·잠금 실루엣 |
| 5 | red | `#d84b40` | 적 무늬(♥♦) |
| 6 | red-deep | `#8e2f28` | 적 음영 |
| 7 | gold | `#e8b03c` | gold enh·**apex 전용 액센트** |
| 8 | bronze | `#96601e` | gold 음영·액센트 |
| 9 | green | `#58c85c` | wild enh (기존 #5ad15a 근사) |
| 10 | purple | `#9b6fd4` | mult enh (기존 값 유지) |
| 11 | cyan | `#46c0d8` | **gem 전용 액센트** |
| 12 | orange | `#e07830` | **cartel 전용 액센트** |
| 13 | navy | `#10142a` | 엠블럼 배경(게임 bg 계열) |
| 14 | slate | `#35406e` | UI 보더·엠블럼 테두리 |
| 15 | white | `#ffffff` | 하이라이트·액센트 |
| 16 | steel | `#6f8fd2` | 액센트 |

**클러스터 색 예약 (검수 반영)**: cyan=gem · gold=apex · orange=cartel은 **클러스터 부적 전용** — 무클러스터 부적 액센트로 재사용 금지(accent→클러스터 역매핑 = 게임플레이 가독성, 로드맵 §4). 무클러스터 부적은 red/green/steel/bronze/white에서 배정(§5 표 — purple은 mult enh 전용으로 액센트 미사용. ★ink는 Task 6 시각 검수에서 navy 바탕 대비 부족으로 액센트 사용 제외 — noir→white, compactor→bronze 재배정, 2026-07-14).

**CVD 수용기준 (검수 반영 — 실사용 범위로 재정의)**: sheet.cjs 내장 deuteranopia/protanopia/tritanopia 시뮬(Viénot/Brettel 근사 행렬) 하에서 —
1. **(필수) 카드 가독성**: paper 대비 ink·red 대비비 유지(랭크/핍 판독).
2. **(필수) 클러스터 3색 상호 구분**: cyan↔gold↔orange — cyan은 자명하고, gold↔orange는 적록 CVD서 색상 수렴하므로 **휘도 차(ΔL)로 구분 확보하도록 hex 캘리브**(구현 시 조정, §8 잔여 리스크).
3. **(비요구) 무클러스터 액센트 상호 구분**: 장식적 신호 — 부적 판별의 1차 채널은 (shape,accent) 유니크 조합 + symbol(§5)이며, CVD 하 색 수렴 시에도 shape가 판별을 보장한다. 무늬 식별도 색이 아니라 형태(♠♥♦♣ 실루엣)가 1차 채널.

## 4. 카드 페이스 (`artDrawCardFace`)

> ★★**v3 AI-생성 페이스 개정 (2026-07-14 사용자 리뷰 2차 반영 — v2도 "너무 못생김" 판정)**: 중앙 핍 필드의 **절차 생성 포기 → AI 이미지 생성 파이프라인**으로 전환. 이는 로드맵 §4의 "cards=procedural, GPT 0" 결정에 대한 **사용자 지시 개정**(2026-07-14). 구조:
> - **생성**: Gemini 이미지 모델(gemini-3-pro-image-preview, REST — ★Codex/GPT imagegen은 403 권한거부로 차단 확인, 공급자 교체 가능 설계) + **스타일 앵커 레퍼런스 체이닝**(승인된 앵커 이미지를 매 생성의 참조로 첨부 → 32장 일관성) + **프롬프트에 코너 여백 강제**(코너 마크는 AI가 상습 오염 — 실측 2/2) + **카드당 판정 에이전트 루프**(핍 개수 실측·무늬 형태·코너 여백·스타일 일치 검수, 불합격 시 교정 프롬프트 재생성 ≤3회).
> - **정규화**: 헤드리스 브라우저 canvas로 **142×190 리사이즈 + ART_PAL 16색 최근접 스냅**(G>R>B 가중) → 카드 간 팔레트·해상도 통일 → **8열(rank)×4행(suit) 스프라이트 시트 `prototype/assets/cards.png`**(로드맵 §4가 GPT 아트용 assets/ 정적 서빙 허용 — 단일파일 원칙의 명시적 예외 확장).
> - **런타임 합성**: `artDrawCardFace` = 시트 크롭(142×190) + **코너 오버레이(코드)**: 기존 v2 글리프 9×11·미니핍 9×9·enh 프레임/배지를 71×95 그리드에 스탬프 후 2× nearest 업스케일로 합성(`imageSmoothingEnabled=false`) — 개수·글리프 정확성은 코드가 보장, 그림은 AI가 담당. faceCache·artFaceHTML(142×190)·artHydrate 구조 유지. **시트 비동기 로드**: onload 전 = v2 절차 렌더 폴백(성능·오프라인 열화 안전), onload 시 faceCache 무효화+재렌더 훅(`artSheetReady`).
> - **재생성 가능성**: 생성 스크립트·프롬프트 = `tools/artgen/`에 반입(프롬프트가 소스 — 아트 재생성은 스크립트 재실행).
> 아래 v2 서술 중 중앙 핍 좌표·3톤 비트맵은 **폴백 경로로 강등**(삭제 아님), 코너·enh·표시 크기 서술은 유효.: 초판 25×36은 발라트로(스프라이트 71×95) 대비 작화 면적 1/8이라 "픽셀 수준이 너무 낮다" 판정 → **논리 해상도 71×95로 재저작 + 표시 상향**(줄 50→71px·손패 62→88px·미니 26→36px·덱픽커 42→48px·suitpick 71px, 종횡비 25:36→**71:95** 전 컨테이너 통일). 디테일 사양: 코너 = 9×11 랭크 글리프 + **9×9 미니 무늬 핍 복원**(공간 확보로 초판의 "코너=글리프만" 제약 해제) · 중앙 핍 = 3톤 셰이딩(기본색+진음영+명부 하이라이트, 적=red/red-deep/white·흑=ink/soft 하이라이트) 대형25×25(A)/중형15×15(2~3)/소형13×13(4~8) · 이중 보더+종이 질감 여지 · enh 배지 13×13(11×11 아이콘). 모바일 축소(nearest 다운스케일) 생존을 위해 **의미 있는 형태는 ≥2px 굵기** 규칙. 아래 초판 서술 중 좌표·크기는 v2로 대체(핍 배치 패턴·faceCache·pixelated·캐시 키 구조는 유지), 상세 좌표 SSoT = `src/art/cards.cjs`의 v2 레이아웃 상수.

- **논리 해상도 25×36** 고정. 표시는 CSS `image-rendering:pixelated` 스케일. **컨테이너 종횡비 25:36 통일(검수 반영)**: `.row .pcard`(50×72=정확히 2×)는 기존 그대로, `.hcard .pcard`(62×88)·덱픽커(42×60)는 `aspect-ratio:25/36`로 통일(각 ~1px 델타 — 종횡비 불일치로 인한 픽셀 비균일 신축 제거). 균일 비정수 배율은 수용(발라트로 동일).
- **구성 (검수 반영 — 픽셀 예산 재검산)**: paper 바탕 + 1px 보더(ink-soft) + **코너 tl/br = 3×5 랭크 글리프만**(180° 대칭 배치. ★미니 무늬 핍 제거 — 5×5에서 ♠/♣ 구분 불가 + 예산 확보. 무늬는 중앙 핍+색이 전달) + **중앙 핍 영역 x∈[6,18]·y∈[6,28] (코너 침범 금지)**: rank 1(A)=대형 단핍 9×9 · rank 2~4=7×7 단열/2열 · rank 5~8=5×5 2열, **핍 간격 ≥1px 보장**(8=2열×4행: 5×4+3gap=23 ≤ y예산 23 ✓).
- **enh 오버레이**: wild=green 프레임 틱+★배지 / gold=gold 코너 장식+●배지 / mult=purple 프레임 틱+◆배지 — 배지는 우상단 고정(기존 `.enh` DOM 자리와 동일 → 플레이어 학습 보존. ★전환 후 `.enh` DOM 자체는 cardEl이 더 이상 생성하지 않음). sealed는 기존 컨테이너 CSS 필터 그대로(canvas 무관).
- **faceCache**: `Map` 키 `suit:rank:enh` — 유니크 조합(32×4 enh 상태 ≤128) 1회 렌더 후 `drawImage` 복제.

## 5. 부적 엠블럼 (`artDrawCharmEmblem`)

- **논리 16×16**, navy 바탕 + slate 보더 + accent 적용. 유효 심볼 영역 ~10×10.
- **구분성 1차 규칙 (검수 반영)**: **(shape,accent) 조합은 22종 전부 유니크** — symbol이 뭉개지는 최소 표시 크기에서도 틀+색만으로 오인 쌍이 없다. shape 5종(shield/coin/banner/plate/diamond) × accent 8색(§3 예약 규칙 준수, ink 제외) → 40조합, 80종 확장 시 shape 어휘 +2~3종 추가로 대응(조합 유여 확보, deco는 그때 도입).
- **22종 매핑 (SSoT — 구현 시 픽셀 가독성 재량 조정 허용, 단 (shape,accent) 유니크 불변)**:

| id | shape | symbol | accent | | id | shape | symbol | accent |
|---|---|---|---|---|---|---|---|---|
| greed | coin | 동전더미 | bronze | | bridge | plate | 아치 | steel |
| pyro | shield | 불꽃 | red | | stair | shield | 계단 | steel |
| suited | banner | 동일핍 2 | steel | | keystone | diamond | 쐐기돌 | steel |
| runner | banner | 오름화살 | green | | lapidary | gem※ | 정+보석 | cyan |
| jackpot | coin | 별폭발 | white | | prism | diamond | 프리즘 삼각 | cyan |
| noir | diamond | 스페이드 달 | white | | jewelbox | plate | 보석함 | cyan |
| broker | coin | 저울 | steel | | highmult | shield | 산정상 | gold |
| twins | plate | 쌍점 II | white | | magnate | coin | 금괴 | gold |
| compactor | plate | 압착기 | bronze | | echo | banner | 음파 겹원 | orange |
| runts | shield | 새싹 | green | | loaded | diamond | 주사위 | orange |
| twotone | diamond | 반반원 | red | | climax | shield | 번개 | orange |

※ lapidary의 gem = 보석컷 육각 틀(shape 5종 외 gem 클러스터 시그니처 틀 1종 — 어휘 총 6틀).

- **locked 모드**: 컬렉션 드로어의 미해금 부적은 ink-soft 단색 실루엣 — 스포일러 방지 유지.
- 동형 위험이 가장 큰 steel 5종(suited/broker/bridge/stair/keystone)은 shape가 전부 다름(banner/coin/plate/shield/diamond) — 컨택트 시트 인간 패스에서 중점 확인(로드맵 "0 confusable pairs").

## 6. 통합 지점 (main.cjs — 전부 표시 전용, 로직 무변경)

1. **`cardEl(card)`** (L407): innerHTML 텍스트 마크업 → `<canvas class="cface">`(faceCache drawImage, DOM 직접 생성이라 하이드레이션 불요). 컨테이너 `.pcard` 클래스 로직(red/black/sealed/empty/willchain/place/flash 애니)은 **전부 보존** — juice·호버 규칙(호버 시 render() 금지) 무접촉. **자동 반영 = cardEl 경유분만**: 줄/손패/덱픽커(`pickDeckCard`).
2. **무늬픽커 `pickSuitToAdd`** (L389, 검수 반영 — cardEl 미경유): 텍스트 `su.g` 글리프 → 무늬 핍 canvas(`data-cface` 하이드레이션 or 직접 draw).
3. **HUD 부적 태그** (L457 `.ctag`, innerHTML): 엠블럼 `canvas[data-emblem]`(표시 ~18px) + 이름 → `artHydrate`.
4. **상점 오퍼** (`renderShop`, innerHTML): `p.type==="charm"`일 때 이름 옆 엠블럼(표시 ~24px) → `artHydrate`.
5. **컬렉션 드로어** (`charmsHTML`, innerHTML): 해금=엠블럼 / 미해금=locked 실루엣 → `openDrawer` 주입 후 `artHydrate`.
6. **덱 뷰어** (`deckHTML` L568, 검수 반영 — 확정: `mcEnh` 문자열 미니카드 사용, cardEl 미경유): `mcEnh` 산출을 미니 `canvas[data-cface]`(~26×37 표시)로 전환 → `artHydrate`. ★`mc()`(룰 산문)는 텍스트 유지 — `.mcard` 두 산출부의 정책 분리(§1).
7. **CSS** (`src/styles.css`): `.pcard canvas{width:100%;height:100%;display:block;image-rendering:pixelated;border-radius:inherit}` + 엠블럼 인라인 정렬 + §4의 aspect-ratio 통일. **사전 존재 `.pcard` 텍스트 셀렉터(.corner/.center/.enh 등)는 이번 커밋에서 존치**(검수 반영 — 외과적 변경 원칙: 전환으로 dead화되는 기존 규칙 삭제는 별도 정리 커밋에서, 본 spec은 언급만).
8. **컨택트 시트 (검수 반영 — 부트 초반 분기)**: main.cjs 부트 꼬리(L626~637: jsonp 리더보드 ×2 → checkUnlocks → registerScreen×4 → showScreen('title'))를 `art=sheet` 가드로 분기 — 시트 모드면 **jsonp·해금소급·화면등록 전부 스킵**하고 `artContactSheet(document.body)`만 실행(§7.4 "콘솔 에러 0" 조건과 정합: 시트 모드 네트워크 발화 0). 배포 페이지에서도 `?art=sheet`로 검수 가능(런타임 동봉 비용 ~1–3KB 수용 — 의도된 트레이드오프).

## 7. 검증 프로토콜

1. `node build.mjs` — esbuild 파싱 게이트(신규 art/ 포함) + **중복 require 검출 가드**(§2) + 산출물 생성.
2. `node tools/balance-check.cjs` — **빌드 산출물 인라인 JS를 `new Function()` 재파싱**(concat 결과의 중복 선언·문법 붕괴를 노드에서 잡는 1차 게이트) + 단일라운드 기준선 **불변**(아트=표시 전용의 실측 증명).
3. `npm run gate`(--fast) — 9밴드 GREEN **불변**(charms.cjs `art` 필드는 sim 불활성 — RED면 설계 위반 신호). 기준선 실측(2026-07-14): 9/9 GREEN.
4. **시각 스모크 (concat 중복선언 회귀 게이트 겸함, 검수 반영)**: 헤드리스 브라우저로 빌드 페이지 로드 — **콘솔 에러 0**(중복 const 등 즉사 검출) + 타이틀→런 진입 스크린샷(카드/부적 렌더) + `?art=sheet` 스크린샷(구분성 자체 검토) → **인간 최종 패스**(사용자 리뷰 = 컨택트 시트 + 실플레이).
5. 커밋 전 `prototype/index.html` 재빌드 동봉(Pages는 커밋된 산출물 서빙).

## 8. 리스크 & 잔여 수용

- **이름 충돌(concat)** → `art`/`ART_` 접두 + star 토폴로지 + build 중복검출 + 브라우저 스모크(§7.4).
- **gold↔orange CVD 수렴**(검수 지적) → 휘도 차 캘리브 시도(§3.2). 캘리브로도 불충분하면 **수용**: apex↔cartel 오인의 게임플레이 임팩트는 낮고(가중오퍼 참고 정보), 부적 판별 1차 채널은 shape 유니크가 보장.
- **비정수 스케일** → pixelated + 종횡비 25:36 통일(§4)로 왜곡 제거, 잔여는 균일 배율(무해). 모바일 29px 코너 글리프 가독성은 시트/스크린샷으로 확인, 필요 시 글리프 확대.
- **엠블럼 동질화**(로드맵 명시 리스크) → (shape,accent) 유니크 규칙(§5) = 구조적 예방 + 컨택트 시트 인간 패스 = 탐지.
- **성능** → faceCache 1회 렌더 + drawImage 복제(≤128 캔버스, 각 25×36 — 무시 가능). 호버-재렌더 금지 규칙 무접촉.
- **게이트 오염** → 아트 커밋에 rules/tuning 수치 변경 절대 금지(gate --fast가 pre-commit 자동 검출).

## 9. M2/M3 인터페이스 예고

`artDrawCardFace`/`artDrawCharmEmblem`은 **param→canvas 순수 함수** — M2 PixiJS 스왑 시 `Texture.from(canvas)`로 무수정 재사용(렌더러 결정 memory의 "최저 증분" 실현). M3 UI 킷은 ART_PAL 팔레트를 공유해 일관성 구조 보장.

---

## 크로스링크

- 방향 논의: 본 spec §0 (2026-07-14 세션) · C2 동결 기본값: `2026-07-10-c2-charm-expansion-design.md` §1
- 상위: `docs/production-roadmap.md` §4 A0/A1 + 렌더러 결정 memory `engine-renderer-decision`
- 적대 검수: 3렌즈(제약정합/스코프/실행가능성) 워크플로 2026-07-14 — 16건 전건 반영 또는 §8 수용 명시
- 후속: M2(PixiJS 보드+juice) spec · M3(배경/UI킷/셸) spec — 각자 차례에 작성

# tools/artgen — 카드 시트 AI 생성 파이프라인 (spec §4 v3)

`prototype/assets/cards.png`(8열 rank1..8 × 4행 suit0..3, 셀 142×190 = 1136×760)를 **재생성**하는 파이프라인. 아트 재생성 = 이 스크립트 재실행. 프롬프트가 소스다.

> ★런타임 합성은 코드가 담당: 시트는 **중앙 핍 필드(그림)만** 제공하고, 코너 랭크 글리프·미니핍·enh 오버레이는 `src/art/cards.cjs`가 그린다 → **코너는 의도적으로 빈 종이로 생성**한다(개수·글리프 정확성은 코드가 보장).

## 인증

- `GEMINI_API_KEY`는 **env로만** 주입한다(하드코딩·커밋 금지). 예: `GEMINI_API_KEY=… node tools/artgen/gen-image.mjs …`

## 단계

1. **생성 (`gen-image.mjs`)** — `gemini-3-pro-image-preview`(REST, `generativeLanguage v1beta`)로 카드 1장씩 생성.
   - `usage: node gen-image.mjs <out.png> <model> <aspect|-> <refImage|-> "<prompt>"`
   - **스타일 앵커 레퍼런스 체이닝**: 승인된 앵커 이미지를 매 생성의 `refImage`로 첨부 → 32장 스타일 일관성.
   - **프롬프트에 코너 여백 강제**: AI는 코너 마크를 상습 오염시킨다(실측) → "코너는 빈 종이" 명시.
   - **핍 개수 판정 루프**: 생성물의 핍 개수·무늬 형태·코너 여백·스타일 일치를 검수, 불합격 시 교정 프롬프트로 ≤3회 재생성.
   - ★**같은 랭크 교차무늬 레퍼런스**(예: 5♠ 만들 때 5♥ 첨부)가 핍 개수 오류 교정에 특히 효과적.
   - Codex/GPT imagegen은 403 권한거부로 차단 확인됨 → 공급자 교체 가능 설계(`gen-image.mjs`의 URL/파서만 교체).

2. **양자화 (`quant.html` + `quant-drive.mjs`)** — 헤드리스 브라우저로 실행.
   - `quant.html`: `ART_PAL` 16색(=`src/art/palette.cjs`, 드리프트 시 이 하네스만 갱신) 최근접 스냅 + 142×190 다운스케일(`window.quantize(dataUrl,key,142,190)`, G>R>B 눈 민감도 가중).
   - `quant-drive.mjs`: 카드 1장을 `quant.html`에 주입할 eval JS 생성 — `usage: node quant-drive.mjs <in-image> <key "s-r"> <142> <190> <out-evaljs>`.
   - 32장 전부 quantize 후 `window.assembleSheet(142,190)` 호출 → 8열×4행 시트 dataURL 반환.

3. **조립** — `assembleSheet` 결과 PNG를 `prototype/assets/cards.png`로 저장(단일파일 원칙의 명시적 assets/ 예외 — 로드맵 §4).

## 검증

- 시트 교체 후 `node build.mjs` → 브라우저에서 `?art=sheet` 컨택트 시트로 32장 육안 확인(핍 개수·코너 오버레이 정합·스타일 일치). 밸런스 무관(아트=표시 전용) — `node tools/balance-check.cjs`/`npm run gate:fast`는 불변.

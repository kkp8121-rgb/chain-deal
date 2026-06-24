# 액트 구조 + 보스 12종 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** 8안테를 3액트로 묶고 보스를 5→12종으로 확장(액트별 티어 풀 + 액트 보스), tmult를 sim으로 캘리브.

**Architecture:** `index.html`의 `connect()`/`placeCard`에 신규 7룰 배선 + `BOSSES`(act/actBoss 필드)·`pickBoss`(act 기반) 교체 + 액트 배너. sim 2종(`run-sim`/`balance-check`)에 동일 룰·BOSSES 동기화 후 tmult 캘리브.

**Tech Stack:** Vanilla JS 인라인, node `.cjs` 시뮬, 빌드 없음.

**스펙:** `docs/superpowers/specs/2026-06-24-act-bosses-design.md` (코드 블록은 §4, 로스터는 §3).

---

### Task 0: run-sim 기준선 캡처 (변경 전, 골드 경제 반영본)
- [ ] `node tools/run-sim.cjs` 5전략 클리어율 메모 (현재 balance ~8.8%). Task 9 비교 기준.

### Task 1: index.html `connect()` — rust + mono (스펙 §4.1)
- [ ] connect() 교체(부식 와일드 무력화 + 단일강요 같은무늬만). `node tools/balance-check.cjs` 문법 OK.

### Task 2: index.html `placeCard` base — tax/peasant/rust (스펙 §4.2)
- [ ] `const rust=...` + tax/peasant base 0 + gold enh rust 가드. 문법 OK.

### Task 3: index.html `placeCard` mult/bonus — rust/anchor/toll (스펙 §4.3)
- [ ] mult enh rust 가드 + anchor 배율 3캡 + toll 보너스 반감. 문법 OK.

### Task 4: index.html `placeCard` 연결조건 — frost (스펙 §4.4)
- [ ] connect 조건에 `&& !(boss frost && row.length<=2)`. 문법 OK.

### Task 5: index.html `BOSSES`(12) + `actOf` + `pickBoss` (스펙 §3, §4.5)
- [ ] `BOSSES` 12종 교체(각 `{id,icon,name,desc,tmult,act,actBoss}`, minAnte 제거):

```js
const BOSSES=[
  {id:"red_curse",icon:"🩸",name:"단색의 저주",  desc:"빨강(♥♦) 카드 기본 점수 0", tmult:1.0, act:1,actBoss:false},
  {id:"dull",     icon:"🗡",name:"무딘 칼날",     desc:"체인 배율 -1",            tmult:0.85,act:1,actBoss:false},
  {id:"peasant",  icon:"🥖",name:"보릿고개",     desc:"A·2·3 카드 기본 점수 0",  tmult:0.9, act:1,actBoss:false},
  {id:"tax",      icon:"👑",name:"사치세",       desc:"7·8 카드 기본 점수 0",    tmult:0.85,act:1,actBoss:true},
  {id:"seal_run", icon:"🚫",name:"스트레이트 봉인",desc:"연속 숫자(±1) 연결 무효", tmult:0.65,act:2,actBoss:false},
  {id:"stingy",   icon:"✋",name:"인색한 손",     desc:"손패가 1장 줄어듦",        tmult:0.65,act:2,actBoss:false},
  {id:"toll",     icon:"💸",name:"연결세",       desc:"체인 보너스 절반",         tmult:0.7, act:2,actBoss:false},
  {id:"rust",     icon:"🦠",name:"부식",         desc:"enh(★◆●) 효과 전부 무효", tmult:0.8, act:2,actBoss:true},
  {id:"seal_suit",icon:"🔒",name:"봉인된 무늬",  desc:"♠ 카드는 연결 불가",       tmult:0.6, act:3,actBoss:false},
  {id:"frost",    icon:"❄",name:"냉각",          desc:"줄 첫 2장 연결 무효",      tmult:0.7, act:3,actBoss:false},
  {id:"mono",     icon:"🎭",name:"단일강요",     desc:"같은 숫자·연속 무효(같은 무늬만)",tmult:0.55,act:3,actBoss:false},
  {id:"anchor",   icon:"⚓",name:"닻",           desc:"체인 배율 최대 3",         tmult:0.6, act:3,actBoss:true},
];
const actOf=ante=> ante<=3?1 : ante<=6?2 : 3;
function pickBoss(ante){ const a=actOf(ante), fin=(ante===3||ante===6||ante===8);
  let pool=BOSSES.filter(b=>b.act===a && b.actBoss===fin);
  if(!pool.length) pool=BOSSES.filter(b=>b.act===a);
  return pool[Math.floor(rng()*pool.length)]; }
```
- [ ] 기존 `const BOSSES=[...]`(5종)·`function pickBoss`(minAnte) 제거·교체. 문법 OK.

### Task 6: 액트 전환 + 액트 보스 배너 (스펙 §4.6, §7)
- [ ] `startBlind`에서 보스 배너를 액트 보스 구분 + 액트 진입 배너:

```js
  if(S.boss) S.target=Math.round(S.target*S.boss.tmult);
  if(S.blind===0 && (S.ante===4||S.ante===7)){ banner(`⚔ ACT ${actOf(S.ante)} 진입`, "var(--gold)"); try{boom(150);}catch(e){} }
  else banner(S.boss? `${S.boss.actBoss?"👑 액트 보스":S.boss.icon+" 보스"}: ${S.boss.name} — ${S.boss.desc}` : "", S.boss?"#ff9a9a":"");
```
(기존 `banner(S.boss? ... )` 한 줄 교체. 액트 배너는 보스 안테(blind 0=작은이라 보스 아님)와 안 겹침.)
- [ ] 문법 OK + `node tools/balance-check.cjs` 기준선 확인.

### Task 7: run-sim.cjs 동기화 (스펙 §5)
- [ ] `connect(a,b,boss)`에 rust(와일드 무력화)·mono(같은무늬만) 추가.
- [ ] `gain(row,card,boss,owned,deckSize)`에 tax/peasant(base 0)·rust(gold·mult enh 무효)·anchor(3캡)·toll(보너스 반감)·frost(첫2장 무연결) 추가.
- [ ] `BOSSES` 12종(act/actBoss)·`pickBoss` act 기반으로 교체.
- [ ] `node tools/run-sim.cjs` 실행 OK.

### Task 8: balance-check.cjs 동기화 + 액트별 출력 (스펙 §5)
- [ ] `connect`/`gain`/`BOSSES`에 동일 룰 반영. 보스 테스트를 `minAnte<=1` → **액트별 대표 보스 클리어율**(각 보스 tmult 기준 단일라운드)로 확장.
- [ ] `node tools/balance-check.cjs` 문법 OK + 보스별 클리어율 출력.

### Task 9: tmult 캘리브 (스펙 §6)
- [ ] `run-sim`(풀런) + `balance-check`(보스별) 측정. 목표: 일반 보스 단일라운드 55~72%, 액트 보스 ~50%, 풀런 클리어율이 Task 0 기준선 대비 급변 없음.
- [ ] 벗어난 보스 `tmult` 조정(index.html·run-sim·balance-check **3곳 동기화**). 수렴까지 반복.

### Task 10: 문서 갱신
- [ ] HANDOVER(§6에 v3.17 보스/액트, 헤더), PLAN(헤더 v3.17 + 보스 확장 항목), CLAUDE(보스 룰 12종/액트 + 드리프트 동기화 지점에 신규 룰).

### Task 11: 최종 검증 + 배포
- [ ] balance-check / run-sim 통과 + 신규 룰 3곳 일관(추출 스모크).
- [ ] 브라우저 스모크(보스별 룰 동작, 액트 배너, 액트 보스 배너) — 수동.
- [ ] `git push origin main` + Pages 빌드 확인.

---

## Self-Review (스펙 대조)
- §1 액트구조 → T5(actOf)·T6(배너). §2 배치모델 → T5(pickBoss). §3 로스터 → T5(BOSSES). §4 배선 → T1~4,6. §5 sim → T7,8. §6 캘리브 → T9. §9 DoD → T8,9,11. ✅
- 신규 7룰 모두 sim 레버 표현 가능(connect/base/mult/bonus/위치) — T7,8에 반영.
- 타입 일관: 보스 id 문자열이 index.html↔sim 동일, `BOSSES` 필드 `{act,actBoss}` 3파일 공통.
- 플레이스홀더: tmult는 캘리브 초기값(T9 확정), placeholder 아님.

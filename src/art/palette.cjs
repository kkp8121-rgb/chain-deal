// ART_PAL — 마스터 16색 (spec §3). 인덱스 0 = 투명. hex는 CVD 캘리브 대상(§3 수용기준).
// ★art/ 모듈 공통 규약: 최상위 식별자는 art/ART_ 접두(concat 전역 충돌 방지),
//   leaf 간 require 금지 — art.cjs 파사드만 의존 순서로 1회 require (spec §2 star 토폴로지).
const ART_PAL=["","#f2ead8","#cfc5ac","#20222b","#4a4f5e","#d84b40","#8e2f28","#e8b03c","#96601e","#58c85c","#9b6fd4","#46c0d8","#e07830","#10142a","#35406e","#ffffff","#6f8fd2"];
const ART_C={paper:1,shade:2,ink:3,soft:4,red:5,redDeep:6,gold:7,bronze:8,green:9,purple:10,cyan:11,orange:12,navy:13,slate:14,white:15,steel:16};
// 클러스터 색 예약(spec §3): cyan=gem·gold=apex·orange=cartel 전용. 무클러스터 부적 재사용 금지.
const ART_ACCENT={gem:ART_C.cyan,apex:ART_C.gold,cartel:ART_C.orange};
module.exports = { ART_PAL, ART_C, ART_ACCENT };

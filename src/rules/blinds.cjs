"use strict";
// 순수 규칙(Phase 0 Step 2): 전역 S/document/localStorage 미접근.
// 블라인드 목표: 안테 기본 × (작은1 / 큰1.5 / 보스2.2)
function blindBase(ante){ return 150*Math.pow(1.5, ante-1); }   // 스테이크 무관 기준값(족보 보너스 기준). 불씨덱 보정은 sparkComp로만 — charm 불변
function sparkComp(ante){ return 1.0+0.34*(8-ante)/7; }   // v3.29 불씨덱 front-loaded 보정(target 전용): 초반 강(a1=1.34)→후반 무(a8=1.00) — flatness 보존. run-sim 미러
module.exports = { blindBase, sparkComp };

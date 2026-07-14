// src/render/render.cjs — M2 렌더층 파사드 (spec §2). ★star 토폴로지: 이 파일만 render/ leaf를 require.
// leaf는 서로 require 금지(빌드 리졸버가 중복 인라인을 throw). main.cjs는 이 파일 하나만 require(★art.cjs require 아래 —
// concat 인라인 순서 제약: render/는 art/ 전역에 의존하는 상위 레이어. 다음 태스크의 cardsprite가 artDrawCardFace를 전역 참조).
const { rStageInit, rActive, rStage, rStageResize, R_W, R_H } = require('./stage.cjs');
module.exports = { rStageInit, rActive, rStage, rStageResize, R_W, R_H };

// src/render/render.cjs — M2 렌더층 파사드 (spec §2). ★star 토폴로지: 이 파일만 render/ leaf를 require.
// leaf는 서로 require 금지(빌드 리졸버가 중복 인라인을 throw). concat 인라인 순서 = spring→stage→cardsprite→board
// (board는 앞 세 leaf + art/main 전역에 의존하는 상위 레이어). main.cjs는 이 파일 하나만 require(★art.cjs require 아래).
const { rSpringStep, rSpringMake, rReduced, R_TUNE } = require('./spring.cjs');
const { rStageInit, rActive, rStage, rStageResize, R_W, R_H } = require('./stage.cjs');
const { rCardTexture } = require('./cardsprite.cjs');
const { rSync } = require('./board.cjs');
module.exports = { rStageInit, rActive, rStage, rStageResize, rSync, rCardTexture, R_W, R_H };

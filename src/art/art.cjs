// src/art/art.cjs — 아트 파사드 (spec §2). ★star 토폴로지: 이 파일만 art/ leaf를
// 의존 순서(palette→pixel→sprites→cards→charmart→sheet)로 정확히 1회 require.
// leaf는 서로 require 금지(빌드 리졸버가 중복 인라인을 throw). main.cjs는 이 파일 하나만 require.
const { ART_PAL, ART_C, ART_ACCENT } = require('./palette.cjs');
const { artGrid, artSet, artRect, artFrame, artStamp, artStamp180, artPaint } = require('./pixel.cjs');
const { ART_GLYPH, ART_PIP, ART_BADGE } = require('./sprites.cjs');
module.exports = { ART_PAL, ART_C, ART_ACCENT, artGrid, artSet, artRect, artFrame, artStamp, artStamp180, artPaint, ART_GLYPH, ART_PIP, ART_BADGE };

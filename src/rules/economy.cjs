"use strict";
// 순수 규칙(Phase 0 Step 2): 전역 S/document/localStorage 미접근.
function spillover(gold){ return Math.floor(gold*0.1); }
module.exports = { spillover };

// src/render/cardsprite.cjs — 카드 텍스처 캐시(spec §4). artDrawCardFace(card) canvas(142×190) → PIXI.Texture.
// 시각키(suit:rank:enh:세대) 캐시 — 상점 enh in-place mutate·시트 비동기 로드 두 벡터를 세대 카운터로 커버.
// ★art/의 심볼(artDrawCardFace·artFaceGrid·artOverlayGrid·artPaint·ART_PAL·artSheetOK)은 재-require하지 않고
//   concat 전역 참조(중복 require 가드 — spec §2). rGen=board.cjs 시트 세대 카운터(전역).
// ★file:// taint 가드(2026-07-14 헤드리스 실측 — spec §7 "taint 무관" 정정): file://에서 시트 이미지(assets/cards.png)를
//   drawImage한 canvas는 origin-taint되어 WebGL texImage2D가 SecurityError를 던지고, PIXI ticker의 RAF 재장전이
//   그 throw로 끊겨 씬 전체가 동결된다(DOM 표시 경로는 무관 — 픽셀 read가 없어서). → 세대당 1회 getImageData 프로브로
//   taint를 감지하고, tainted면 절차 페이스(artFaceGrid+artOverlayGrid, 이미지 무접촉=clean)로 텍스처를 만든다.
//   http(s)(Pages)는 same-origin이라 시트 텍스처 정상. file:// Pixi 경로만 절차 아트로 표시(수용 — 오프라인 한정).
const rTexCache = new Map();
let rProbeGen = -1, rSheetTaint = false;
function rSheetSafe(){
  if(rProbeGen!==rGen){ rProbeGen=rGen; rSheetTaint=false;
    if(artSheetOK){ try{ artDrawCardFace({suit:0,rank:1,enh:null}).getContext("2d").getImageData(0,0,1,1); }catch(e){ rSheetTaint=true; } } }
  return !rSheetTaint;
}
// 절차 페이스(untainted) — art/cards.cjs artFaceCanvas의 폴백 브랜치와 동일 식(시트 브랜치만 생략). 이미지 무접촉=WebGL 업로드 안전.
function rCleanFace(card){
  const cv=document.createElement("canvas"); cv.width=142; cv.height=190;
  const cx=cv.getContext("2d"); cx.imageSmoothingEnabled=false;
  cx.drawImage(artPaint(artFaceGrid(card.suit,card.rank),ART_PAL),0,0,71,95,0,0,142,190);
  cx.drawImage(artPaint(artOverlayGrid(card.suit,card.rank,card.enh||null),ART_PAL),0,0,71,95,0,0,142,190);
  return cv;
}
function rCardTexture(card){
  const vk = card.suit+":"+card.rank+":"+(card.enh||"")+":"+rGen;
  let tx = rTexCache.get(vk);
  if(!tx){ tx = PIXI.Texture.from(rSheetSafe() ? artDrawCardFace(card) : rCleanFace(card)); rTexCache.set(vk, tx); }
  return tx;
}
module.exports = { rCardTexture };

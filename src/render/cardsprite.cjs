// src/render/cardsprite.cjs — 카드 텍스처 캐시(spec §4). artDrawCardFace(card) canvas(142×190) → PIXI.Texture.
// 시각키(suit:rank:enh:세대) 캐시 — 상점 enh in-place mutate·시트 비동기 로드 두 벡터를 세대 카운터로 커버.
// ★art/의 artDrawCardFace를 재-require하지 않고 concat 전역 참조(중복 require 가드 — spec §2). rGen=board.cjs 시트 세대 카운터(전역).
const rTexCache = new Map();
function rCardTexture(card){
  const vk = card.suit+":"+card.rank+":"+(card.enh||"")+":"+rGen;
  let tx = rTexCache.get(vk);
  if(!tx){ tx = PIXI.Texture.from(artDrawCardFace(card)); rTexCache.set(vk, tx); }
  return tx;
}
module.exports = { rCardTexture };

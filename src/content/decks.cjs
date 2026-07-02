function mkCard(s,r){ return {suit:s, rank:r, enh:null}; }
// 시작 덱 = A~8 (32장). 풀 52장은 3택1에 카드풀이 너무 커서 체인이 안 됨 → 압축. 높은 카드는 상점 성장.
function fullDeck(){ const d=[]; for(let s=0;s<4;s++) for(let r=1;r<=8;r++) d.push(mkCard(s,r)); const ord=d.map((c,i)=>[c.rank,i]).sort((a,b)=>a[0]-b[0]); for(let k=0;k<4;k++) d[ord[k][1]].enh="wild"; return d; }   // 불씨덱(v3.29): 최저랭크 4장 wild(연결밀도↑=캐주얼 도파민). sparkComp 보정과 세트 — run-sim starterDeck 미러
function highDeck(){ const d=[]; for(let s=0;s<4;s++) for(const r of [3,4,5,6,7,7,8,8]) d.push(mkCard(s,r)); return d; }
// t()는 main.cjs 최상단의 i18n require에서 공유(재require 금지 — src/content/locale/i18n.cjs 헤더 주석 참조)
const DECKS=[
  {id:"standard", name:t('deck.standard.name'),   desc:t('deck.standard.desc'),                                   build:fullDeck, dmult:1.0},
  {id:"high",     name:t('deck.high.name'), desc:t('deck.high.desc'), build:highDeck, dmult:1.29},
];
module.exports = { mkCard, fullDeck, highDeck, DECKS };

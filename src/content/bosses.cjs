// t()는 main.cjs 최상단의 i18n require에서 공유(재require 금지 — src/content/locale/i18n.cjs 헤더 주석 참조)
const BOSSES=[
  {id:"red_curse",icon:"🩸", name:t('boss.red_curse.name'),     desc:t('boss.red_curse.desc'), tmult:1.0,  act:1, actBoss:false},
  {id:"dull",     icon:"🗡", name:t('boss.dull.name'),       desc:t('boss.dull.desc'),              tmult:0.85, act:1, actBoss:false},
  {id:"peasant",  icon:"🥖", name:t('boss.peasant.name'),        desc:t('boss.peasant.desc'),    tmult:0.82, act:1, actBoss:false},
  {id:"tax",      icon:"👑", name:t('boss.tax.name'),          desc:t('boss.tax.desc'),      tmult:0.8,  act:1, actBoss:true},
  {id:"seal_climb",icon:"⤵", name:t('boss.seal_climb.name'),           desc:t('boss.seal_climb.desc'), tmult:0.72, act:2, actBoss:false},
  {id:"stingy",   icon:"✋", name:t('boss.stingy.name'),       desc:t('boss.stingy.desc'),         tmult:0.58, act:2, actBoss:false},
  {id:"toll",     icon:"💸", name:t('boss.toll.name'),          desc:t('boss.toll.desc'),          tmult:0.54, act:2, actBoss:false},
  {id:"rust",     icon:"🦠", name:t('boss.rust.name'),            desc:t('boss.rust.desc'),   tmult:0.6,  act:2, actBoss:true},
  {id:"seal_suit",icon:"🔒", name:t('boss.seal_suit.name'),     desc:t('boss.seal_suit.desc'),        tmult:0.47, act:3, actBoss:false},
  {id:"frost",    icon:"❄",  name:t('boss.frost.name'),            desc:t('boss.frost.desc'),       tmult:0.48, act:3, actBoss:false},
  {id:"mono",     icon:"🎭", name:t('boss.mono.name'),        desc:t('boss.mono.desc'), tmult:0.4,  act:3, actBoss:false},
  {id:"anchor",   icon:"⚓", name:t('boss.anchor.name'),              desc:t('boss.anchor.desc'),          tmult:0.44, act:3, actBoss:true},
];
module.exports = { BOSSES };

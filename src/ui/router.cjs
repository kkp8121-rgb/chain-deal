// src/ui/router.cjs — 앱 셸 화면 라우터. build.mjs가 main.cjs의 require로 인라인(전역 스코프).
// 화면 def = { el, mount?(el,ctx), unmount?() }. .wrap 안의 .screen 섹션을 토글.
const _SCREENS = {};
let _CUR = null;
function registerScreen(id, def){ _SCREENS[id] = def; }
function showScreen(id, ctx){
  const next = _SCREENS[id];
  if(!next) return;
  if(_CUR && _CUR !== id){
    const prev = _SCREENS[_CUR];
    if(prev){ if(prev.el) prev.el.classList.remove("active"); if(prev.unmount) prev.unmount(); }
  }
  if(next.el) next.el.classList.add("active");
  if(next.mount) next.mount(next.el, ctx);
  _CUR = id;
}
function currentScreen(){ return _CUR; }
module.exports = { registerScreen, showScreen, currentScreen };

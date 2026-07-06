// src/ui/screens.cjs — 앱 셸 화면 mount(Settings/Summary) + Pause. build.mjs가 main.cjs require로 인라인.
// main.cjs 전역(t/S/getStats/newGame/shareResult/showScreen/setNick/nickOr/beep) 런타임 사용.
let _router = null;
function registerScreens(router){ _router = router; }

function _byId(id){ return document.getElementById(id); }

function openPause(){ _byId("pause").classList.add("show"); try{beep(500,.04);}catch(e){} }
function closePause(){ _byId("pause").classList.remove("show"); }
function quitToMenu(){ closePause(); if(typeof S!=="undefined" && S) S.over=true; showScreen("title"); try{beep(360,.05);}catch(e){} }

function mountSettings(el){
  el.innerHTML = "";
  const card = document.createElement("div"); card.className="settingsCard";
  card.innerHTML =
    `<h2 style="color:var(--gold);text-align:center;margin:.1em 0 .6em">${t('ui.settings.title')}</h2>`+
    `<div class="setRow"><label>${t('ui.settings.mute')}</label><input type="checkbox" id="setMute"></div>`+
    `<div class="setRow"><label>${t('ui.settings.nick')}</label><input type="text" id="setNickInput" maxlength="12" placeholder="${t('ui.settings.nickPlaceholder')}"></div>`+
    `<button class="closeBtn" style="width:100%;margin-top:16px" onclick="showScreen('title')">${t('ui.settings.back')}</button>`;
  el.appendChild(card);
  const mute = _byId("setMute");
  try{ mute.checked = localStorage.getItem("cd_muted")==="1"; }catch(e){}
  mute.onchange = ()=>{ MUTED = mute.checked; try{ localStorage.setItem("cd_muted", MUTED?"1":"0"); }catch(e){} };
  const nick = _byId("setNickInput");
  const cur = nickOr(); if(cur!==t('ui.anon')) nick.value = cur;
  nick.onchange = ()=>{ setNick(nick.value); };
}

function mountSummary(el, ctx){
  el.innerHTML = "";
  const win = !!(ctx && ctx.win);
  const r = (typeof S!=="undefined" && S && S.lastResult) ? S.lastResult : { ante:1, best:0 };
  const card = document.createElement("div"); card.className="summaryCard";
  card.innerHTML =
    `<div class="summaryResult ${win?'win':'lose'}">${win?t('ui.summary.win'):t('ui.summary.lose')}</div>`+
    `<div class="setRow"><label>${t('ui.summary.reachedAnte')}</label><b>${r.ante||1} / 8</b></div>`+
    `<div class="setRow"><label>${t('ui.summary.bestScore')}</label><b>${(r.best||0).toLocaleString()}</b></div>`+
    `<button class="tallyBtn" style="background:#2d7d46;margin-top:14px" onclick="shareResult(this)">📋 ${t('ui.tally.shareBtn')}</button>`+
    `<div class="controls" style="margin-top:10px">`+
      `<button onclick="showScreen('title')">▶ ${t('ui.summary.newRun')}</button>`+
      `<button onclick="showScreen('title')">🏠 ${t('ui.summary.menu')}</button>`+
    `</div>`;
  el.appendChild(card);
  if(win){ try{ if(typeof flash==="function"){ flash("#ffd15c"); } }catch(e){} }
}

module.exports = { registerScreens, openPause, closePause, quitToMenu, mountSettings, mountSummary };

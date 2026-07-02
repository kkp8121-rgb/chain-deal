// 얇은 로케일 룩업. 기본 로케일 = ko (기존 렌더와 byte-identical).
// ★단일 require 지점: main.cjs만 이 파일을 require한다. content/*.cjs(charms/bosses/decks)는
//   t()를 별도 require 없이 그대로 참조한다 — build.mjs의 resolveRequires가 전부 평면(flat)
//   concat이라(모듈 스코프 없음) content 파일이 다시 require('../locale/i18n.cjs')를 하면
//   이 파일이 두 번 인라인되어 `const KO=...` 중복 선언 SyntaxError가 난다. t는 main.cjs 최상단의
//   이 require 한 줄로만 스코프에 들어오고, 그 뒤에 inline되는 모든 content 파일이 공유한다.
const { KO } = require('./ko.cjs');
const { EN } = require('./en.cjs');
const LOCALES = { ko: KO, en: EN };
let CUR_LOCALE = "ko";
function setLocale(loc){ if(LOCALES[loc]) CUR_LOCALE = loc; }
function t(key){ const tbl=LOCALES[CUR_LOCALE]||LOCALES.ko; const v=tbl[key]; if(v!=null) return v; const kv=LOCALES.ko[key]; return kv!=null ? kv : key; }
module.exports = { t, setLocale };

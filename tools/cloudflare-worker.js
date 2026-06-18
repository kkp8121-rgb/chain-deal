// CHAIN DEAL 플레이로그 프록시 — Cloudflare Worker (무료)
//
// 역할: 게임(브라우저) → [이 Worker] → 비공개 Apps Script → 구글 시트
//   · Origin 검증으로 "우리 사이트(브라우저)에서 온 요청"만 통과 → 타인 쓰기 차단
//     (브라우저는 Origin 헤더를 JS로 위조할 수 없음 = forbidden header)
//   · 시트 쓰기 권한(Apps Script URL)은 환경변수 SHEET_URL(secret)에 숨겨 클라이언트에 노출 안 함
//
// ===== 배포 (Cloudflare 대시보드, 약 5분) =====
// 0) 먼저 Apps Script 웹앱 URL을 준비 (tools/playlog-appsscript.gs 참고)
// 1) dash.cloudflare.com → 좌측 [Workers & Pages] → [Create] → [Create Worker]
//      이름 예: chaindeal-log → [Deploy] (기본 코드로 일단 배포)
// 2) [Edit code] → 아래 코드 전체 붙여넣기 → [Deploy]
// 3) Worker [Settings] → [Variables and Secrets] → [Add]
//      · Type: Secret(또는 Encrypt 체크)   · Name: SHEET_URL
//      · Value: Apps Script 웹앱 URL (https://script.google.com/macros/s/.../exec)
//      → [Deploy]/[Save]
// 4) Worker URL 복사 (https://chaindeal-log.<your-subdomain>.workers.dev)
// 5) 그 URL을 포지(Forge)에게 주면 게임의 LOG_URL 에 넣고 재배포합니다.

const ALLOWED_ORIGINS = ["https://kkp8121-rgb.github.io"];
const ALLOWED_TYPES = ["run_start", "clear", "death", "win"];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // CORS preflight 대비
    if (request.method === "OPTIONS") return cors(origin, new Response(null, { status: 204 }));
    if (request.method !== "POST") return cors(origin, new Response("only POST", { status: 405 }));

    // 출처 검증: 우리 사이트(브라우저)에서 온 요청만. 브라우저는 Origin 위조 불가.
    if (!ALLOWED_ORIGINS.includes(origin)) return cors(origin, new Response("forbidden origin", { status: 403 }));

    // body 검증: JSON + 허용된 이벤트 타입만 (쓰레기/스팸 1차 차단)
    let body, d;
    try { body = await request.text(); d = JSON.parse(body); }
    catch { return cors(origin, new Response("bad json", { status: 400 })); }
    if (!ALLOWED_TYPES.includes(d.type)) return cors(origin, new Response("bad type", { status: 400 }));

    // 비공개 Apps Script 로 전달 (URL은 env secret — 클라이언트엔 절대 노출 안 됨)
    if (!env.SHEET_URL) return cors(origin, new Response("no SHEET_URL", { status: 500 }));
    try {
      await fetch(env.SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    } catch (e) {
      return cors(origin, new Response("upstream error", { status: 502 }));
    }
    return cors(origin, new Response("ok", { status: 200 }));
  },
};

function cors(origin, res) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  res.headers.set("Access-Control-Allow-Origin", ok ? origin : "null");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

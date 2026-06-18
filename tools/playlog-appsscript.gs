// CHAIN DEAL 플레이로그 + 리더보드 — Google Apps Script (무료)
//
// ===== 재배포 (리더보드 추가 — URL 유지하며 갱신) =====
// 1) 시트 → [확장 프로그램] → [Apps Script] → 기존 코드 전부 지우고 이 내용 붙여넣기 → 저장
// 2) [배포] → [배포 관리] → 기존 배포 옆 [✏️ 편집] → 버전 "새 버전" → [배포]
//      ★ "새 배포"가 아니라 "배포 관리 → 편집"으로 해야 URL이 그대로 유지됩니다.
// 3) URL 그대로면 게임 수정 불필요. (혹시 URL이 바뀌면 새 URL을 포지에게)
//
// 시트 탭: 'logs'(플레이로그) + 'scores'(리더보드) 자동 생성.

var BLIND_LABEL = ['작은', '큰', '보스'];

// ---- 쓰기: 플레이로그 + 리더보드 점수 ----
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (d.type === 'score') {                          // 리더보드 점수 제출
      var sc = ss.getSheetByName('scores') || ss.insertSheet('scores');
      if (sc.getLastRow() === 0) sc.appendRow(['시각', '닉', '점수', '시드', '안테', '데일리']);
      sc.appendRow([new Date(), String(d.nick || '익명').slice(0, 12), Number(d.score) || 0, String(d.seed || ''), d.ante || '', d.daily ? 1 : 0]);
      return ContentService.createTextOutput('ok');
    }

    var sh = ss.getSheetByName('logs') || ss.insertSheet('logs');
    if (sh.getLastRow() === 0) sh.appendRow(['시각', '플레이어', '이벤트', '안테', '블라인드', '점수', '목표', '족보']);
    var blind = (d.blind === '' || d.blind == null) ? '' : (BLIND_LABEL[d.blind] || d.blind);
    sh.appendRow([new Date(), d.pid || '', d.type || '', d.ante || '', blind, d.score || '', d.target || '', d.hand || '']);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('err: ' + err);
  }
}

// ---- 읽기: 리더보드 top10 (JSONP — CORS 우회) ----
// action=daily&seed=YYYYMMDD  또는  action=alltime
function doGet(e) {
  var p = e.parameter, cb = p.callback || '';
  var sc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('scores');
  var out = [];
  if (sc && sc.getLastRow() > 1) {
    var rows = sc.getDataRange().getValues(); rows.shift();   // [시각,닉,점수,시드,안테,데일리]
    var filt = (p.action === 'daily' && p.seed)
      ? rows.filter(function (r) { return String(r[3]) === String(p.seed); })
      : rows;
    filt.sort(function (a, b) { return (Number(b[2]) || 0) - (Number(a[2]) || 0); });
    // 닉 중복 시 최고점만 (선택)
    var seen = {}, dedup = [];
    filt.forEach(function (r) { var k = r[1]; if (!seen[k]) { seen[k] = 1; dedup.push(r); } });
    out = dedup.slice(0, 10).map(function (r) { return { nick: r[1], score: Number(r[2]) || 0, ante: r[4] }; });
  }
  var json = JSON.stringify(out);
  var body = cb ? (cb + '(' + json + ')') : json;
  return ContentService.createTextOutput(body)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

// (선택) 배포 전 테스트
function _selfTest() {
  doPost({ postData: { contents: JSON.stringify({ type: 'score', nick: 'TEST', score: 1234, seed: '20260618', ante: 5, daily: 1 }) } });
  Logger.log(doGet({ parameter: { action: 'alltime' } }).getContent());
}

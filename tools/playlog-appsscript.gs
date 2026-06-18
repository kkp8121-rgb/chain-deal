// CHAIN DEAL 플레이로그 수집 — Google Apps Script (무료, 신용카드 불필요, 일시정지 없음)
//
// ===== 설치 (약 5분) =====
// 1) https://sheets.new 로 새 구글 시트 생성 (이름 자유, 예: "CHAIN DEAL 로그")
// 2) 시트 상단 메뉴 [확장 프로그램] → [Apps Script]
// 3) 편집기의 기본 코드 전부 지우고 이 파일 내용을 붙여넣기 → 저장(💾)
// 4) [배포] → [새 배포] → 톱니바퀴에서 유형 [웹 앱] 선택
//      · 설명: 아무거나   · 실행: "나(본인)"   · 액세스 권한: "모든 사용자(Anyone)"
//      · [배포] 클릭 → 권한 검토/승인(본인 구글 계정으로)
// 5) 표시되는 "웹 앱 URL"  (https://script.google.com/macros/s/AKfy.../exec) 복사
// 6) 그 URL을 포지(Forge)에게 주면 게임의 LOG_URL 에 넣고 재배포합니다.
//      (직접 하려면 prototype/index.html 의  const LOG_URL="";  의 "" 안에 붙여넣고 push)
//
// 결과: 게임에서 런 시작 / 통과 / 사망 / 승리가 시트 'logs' 탭에 행으로 쌓입니다.
//       → 구글 시트에서 피벗·차트로 "어느 안테에서 가장 많이 죽나" 등을 바로 분석.

var BLIND_LABEL = ['작은', '큰', '보스'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('logs') || ss.insertSheet('logs');
    if (sh.getLastRow() === 0) {
      sh.appendRow(['시각', '플레이어', '이벤트', '안테', '블라인드', '점수', '목표', '족보']);
    }
    var blind = (d.blind === '' || d.blind == null) ? '' : (BLIND_LABEL[d.blind] || d.blind);
    sh.appendRow([new Date(), d.pid || '', d.type || '', d.ante || '', blind, d.score || '', d.target || '', d.hand || '']);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('err: ' + err);
  }
}

// (선택) 배포 전 테스트: 편집기에서 이 함수를 실행 → 시트에 테스트 행 1개가 생기면 정상.
function _selfTest() {
  doPost({ postData: { contents: JSON.stringify({ pid: 'test', type: 'run_start', ante: 1, blind: 0, score: 0, target: 150, hand: '' }) } });
}

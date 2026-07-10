// 初回セットアップ用スクリプト。
// GASエディタから setupSheets() を1回だけ手動実行。
// 実行後、teamsシートにチームトークンが自動発行される。

function setupSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // teams
  let teams = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
  if (!teams) teams = ss.insertSheet(CONFIG.SHEETS.TEAMS);
  teams.clear();
  teams.appendRow(['team_id', 'name', 'token', 'leader_email']);

  // members
  let members = ss.getSheetByName(CONFIG.SHEETS.MEMBERS);
  if (!members) members = ss.insertSheet(CONFIG.SHEETS.MEMBERS);
  members.clear();
  members.appendRow(['member_id', 'name', 'team_id', 'withdrew_week']);

  // scores
  let scores = ss.getSheetByName(CONFIG.SHEETS.SCORES);
  if (!scores) scores = ss.insertSheet(CONFIG.SHEETS.SCORES);
  scores.clear();
  scores.appendRow(['id', 'timestamp', 'team_id', 'member_id', 'activity', 'count', 'points', 'week']);

  // settings
  let settings = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!settings) settings = ss.insertSheet(CONFIG.SHEETS.SETTINGS);
  settings.clear();
  settings.appendRow(['key', 'value']);
  settings.appendRow(['game_start', CONFIG.GAME_START]);
  settings.appendRow(['game_end',   CONFIG.WEEK_ENDS[CONFIG.WEEK_ENDS.length - 1]]);

  // INITIAL_TEAMS からチーム・メンバーを流し込む
  INITIAL_TEAMS.forEach((t, ti) => {
    const team_id = 't' + String(ti + 1).padStart(2, '0');
    const token = _generateToken();
    teams.appendRow([team_id, t.name, token, '']);
    t.members.forEach((mname, mi) => {
      const member_id = team_id + '_m' + String(mi + 1).padStart(2, '0');
      members.appendRow([member_id, mname, team_id, '']);
    });
  });

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了\n\n' +
    '・teamsシートにチームトークンが発行されました\n' +
    '・各チームリーダーに token をURL付きで配布してください\n\n' +
    '入力URL例: <YOUR_GITHUB_PAGES_URL>/input/?team=<token>'
  );
}

/**
 * チームトークンをリーダー配布用に一括出力（コンソール出力）
 */
function listTokens() {
  const teams = readTeams();
  teams.forEach(t => {
    Logger.log(t.name + ' → token: ' + t.token);
  });
}

/**
 * 全スコアをリセットする（テスト用）— 本番前の動作確認後に実行
 */
function resetScores() {
  const sh = _sheet(CONFIG.SHEETS.SCORES);
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  Logger.log('scores を削除しました');
}

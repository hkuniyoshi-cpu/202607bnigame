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

/**
 * 「スコア集計」シートを17チーム分のチーム1形式で自動生成する。
 * 実行するたびにクリアして再構築。SUMIFで自動更新される。
 *
 * レイアウト（6チーム × 3行）:
 *  [チーム名(A-C結合)]  [gap D]  [チーム名(E-G結合)]  [gap H]  ...
 *  [名前 | 個人 | チーム]
 *  [メンバー1 | =SUMIF | =SUMIF]
 *  [メンバー2 | =SUMIF | (空)]
 *  ...
 *  [合計 | =SUM | チーム平均]
 */
function rebuildSummary() {
  const SHEET_NAME = 'スコア集計';
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (sh) {
    // 既存のマージを全解除してからクリア
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    sh.clear();
  } else {
    sh = ss.insertSheet(SHEET_NAME);
  }

  const teams = readTeams();
  const membersByTeam = membersGroupedByTeam();

  const TEAMS_PER_ROW  = 6;
  const COLS_PER_TEAM  = 4; // A,B,C + 1 gap
  const ROWS_PER_BLOCK = 10; // header + subheader + 6 member rows + 合計 + gap
  const HEADER_COLORS = [
    '#4285F4','#EA4335','#34A853','#FBBC04','#9C27B0','#00ACC1',
    '#F4511E','#7CB342','#5C6BC0','#26A69A','#EF5350','#78909C',
    '#8E24AA','#43A047','#E53935','#FDD835','#3949AB',
  ];

  // タイトル行
  sh.getRange(1, 1).setValue('BNI TOP チャプターゲーム — スコア集計（自動更新）')
    .setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue('※ scoresシートの入力が全自動でここに反映されます。')
    .setFontColor('#666').setFontSize(10);

  const START_ROW_OFFSET = 4; // タイトルの下

  teams.forEach((team, idx) => {
    const teamRow = Math.floor(idx / TEAMS_PER_ROW);
    const teamCol = idx % TEAMS_PER_ROW;
    const startRow = START_ROW_OFFSET + teamRow * ROWS_PER_BLOCK;
    const startCol = 1 + teamCol * COLS_PER_TEAM;

    const memberList = membersByTeam[String(team.team_id)] || [];
    const memberCount = memberList.length;

    // 1) チーム名ヘッダー（A-C結合）
    sh.getRange(startRow, startCol, 1, 3)
      .merge()
      .setValue(team.name)
      .setBackground(HEADER_COLORS[idx % HEADER_COLORS.length])
      .setFontColor('white')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // 2) サブヘッダー
    sh.getRange(startRow + 1, startCol).setValue('名前');
    sh.getRange(startRow + 1, startCol + 1).setValue('個人');
    sh.getRange(startRow + 1, startCol + 2).setValue('チーム');
    sh.getRange(startRow + 1, startCol, 1, 3)
      .setBackground('#F1F3F4').setFontWeight('bold').setHorizontalAlignment('center');

    // 3) メンバー行（最大5行、途中退場者含む）
    memberList.forEach((m, mi) => {
      const row = startRow + 2 + mi;
      const mid = m.member_id;
      sh.getRange(row, startCol).setValue(m.name);
      sh.getRange(row, startCol + 1)
        .setFormula(`=IFERROR(SUMIFS(scores!G:G, scores!D:D, "${mid}"),0)`);
    });

    // 4) チーム合計を1メンバー目の C 列に表示（結合はしない、単セル）
    if (memberCount > 0) {
      sh.getRange(startRow + 2, startCol + 2)
        .setFormula(`=IFERROR(SUMIFS(scores!G:G, scores!C:C, "${team.team_id}"),0)`);
    }

    // 5) 合計行
    const totalRow = startRow + 2 + Math.max(5, memberCount) + 1; // 5メンバー分＋空1行の下
    sh.getRange(totalRow, startCol).setValue('合計').setFontWeight('bold').setBackground('#F1F3F4');
    if (memberCount > 0) {
      const memberRange = sh.getRange(startRow + 2, startCol + 1, memberCount, 1).getA1Notation();
      sh.getRange(totalRow, startCol + 1).setFormula(`=SUM(${memberRange})`).setFontWeight('bold');
      // チーム欄には平均点（4/5名調整済み）
      sh.getRange(totalRow, startCol + 2)
        .setFormula(`=IFERROR(SUM(${memberRange})/${memberCount},0)`)
        .setFontWeight('bold')
        .setBackground('#FFF9C4');
    }

    // 6) セル枠線
    sh.getRange(startRow, startCol, ROWS_PER_BLOCK - 1, 3).setBorder(true, true, true, true, true, true);
  });

  // 7) 列幅調整
  const maxCols = TEAMS_PER_ROW * COLS_PER_TEAM;
  for (let c = 1; c <= maxCols; c++) {
    const mod = (c - 1) % COLS_PER_TEAM;
    if (mod === 3) sh.setColumnWidth(c, 20);        // gap
    else if (mod === 0) sh.setColumnWidth(c, 110);  // 名前
    else sh.setColumnWidth(c, 65);                  // 個人・チーム
  }

  SpreadsheetApp.getUi().alert('✅ スコア集計シートを更新しました\n\n・シート「スコア集計」を確認してください\n・scoresシートの入力は全自動で反映されます');
}

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
 * 「スコア集計」シートを17チーム分のチーム1形式（週別対応）で自動生成する。
 * 実行するたびにクリアして再構築。SUMIFSで自動更新される。
 *
 * レイアウト（3チーム × 6行、各ブロック7列幅）:
 *  [チーム名（A-Gマージ）]
 *  [名前 | 第1週 | 第2週 | 第3週 | 第4週 | 個人合計 | チーム]
 *  [メンバー1 | =SUMIFS(w1) | =SUMIFS(w2) | ... | =SUM | =SUMIFS(team,all) ]
 *  [メンバー2〜5 | ... ]
 *  [合計 | =SUM(w1) | =SUM(w2) | =SUM(w3) | =SUM(w4) | =SUM | =平均 ]
 */
function rebuildSummary() {
  const SHEET_NAME = 'スコア集計';
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (sh) {
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    sh.clear();
  } else {
    sh = ss.insertSheet(SHEET_NAME);
  }

  const teams = readTeams();
  const membersByTeam = membersGroupedByTeam();

  const TEAMS_PER_ROW  = 3;
  const COLS_PER_TEAM  = 8; // 7列 + 1 gap
  const BLOCK_WIDTH    = 7;
  const MAX_MEMBERS    = 5;
  const ROWS_PER_BLOCK = 1 /* header */ + 1 /* subheader */ + MAX_MEMBERS + 1 /* 合計 */ + 1 /* gap */;
  const HEADER_COLORS = [
    '#4285F4','#EA4335','#34A853','#FBBC04','#9C27B0','#00ACC1',
    '#F4511E','#7CB342','#5C6BC0','#26A69A','#EF5350','#78909C',
    '#8E24AA','#43A047','#E53935','#FDD835','#3949AB',
  ];
  const SUBHEADERS = ['名前', '第1週', '第2週', '第3週', '第4週', '個人合計', 'チーム'];

  // タイトル行
  sh.getRange(1, 1).setValue('BNI TOP チャプターゲーム — スコア集計（週別・自動更新）')
    .setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue('※ scoresシートの入力が全自動でここに反映されます。')
    .setFontColor('#666').setFontSize(10);
  sh.getRange(3, 1).setValue('※ チーム欄には「参加人数で割った平均点」を表示（4名/5名チームの公平化のため）')
    .setFontColor('#666').setFontSize(10);

  const START_ROW_OFFSET = 5;

  teams.forEach((team, idx) => {
    const teamRow = Math.floor(idx / TEAMS_PER_ROW);
    const teamCol = idx % TEAMS_PER_ROW;
    const startRow = START_ROW_OFFSET + teamRow * ROWS_PER_BLOCK;
    const startCol = 1 + teamCol * COLS_PER_TEAM;

    const memberList = membersByTeam[String(team.team_id)] || [];
    const memberCount = memberList.length;

    // 1) チーム名ヘッダー（7列マージ）
    sh.getRange(startRow, startCol, 1, BLOCK_WIDTH)
      .merge()
      .setValue(team.name)
      .setBackground(HEADER_COLORS[idx % HEADER_COLORS.length])
      .setFontColor('white')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center');

    // 2) サブヘッダー
    SUBHEADERS.forEach((label, i) => {
      sh.getRange(startRow + 1, startCol + i).setValue(label);
    });
    sh.getRange(startRow + 1, startCol, 1, BLOCK_WIDTH)
      .setBackground('#F1F3F4').setFontWeight('bold').setHorizontalAlignment('center')
      .setFontSize(10);

    // 3) メンバー行
    memberList.forEach((m, mi) => {
      const row = startRow + 2 + mi;
      const mid = m.member_id;
      sh.getRange(row, startCol).setValue(m.name);
      // 第1〜4週の SUMIFS
      for (let w = 1; w <= 4; w++) {
        sh.getRange(row, startCol + w)
          .setFormula(`=IFERROR(SUMIFS(scores!G:G, scores!D:D, "${mid}", scores!H:H, ${w}),0)`);
      }
      // 個人合計 = 各週の SUM
      const wRange = sh.getRange(row, startCol + 1, 1, 4).getA1Notation();
      sh.getRange(row, startCol + 5).setFormula(`=SUM(${wRange})`)
        .setFontWeight('bold').setBackground('#E8F0FE');
    });

    // 4) チーム合計（1メンバー目の行にのみ表示）
    if (memberCount > 0) {
      sh.getRange(startRow + 2, startCol + 6)
        .setFormula(`=IFERROR(SUMIFS(scores!G:G, scores!C:C, "${team.team_id}"),0)`)
        .setFontWeight('bold');
    }

    // 5) 合計行
    const totalRow = startRow + 2 + MAX_MEMBERS;
    sh.getRange(totalRow, startCol).setValue('合計').setFontWeight('bold').setBackground('#F1F3F4');
    if (memberCount > 0) {
      // 各週の SUM
      for (let w = 0; w < 4; w++) {
        const colWeek = startCol + 1 + w;
        const range = sh.getRange(startRow + 2, colWeek, memberCount, 1).getA1Notation();
        sh.getRange(totalRow, colWeek).setFormula(`=SUM(${range})`)
          .setFontWeight('bold').setBackground('#F1F3F4');
      }
      // 個人合計 SUM
      const totalRange = sh.getRange(startRow + 2, startCol + 5, memberCount, 1).getA1Notation();
      sh.getRange(totalRow, startCol + 5).setFormula(`=SUM(${totalRange})`)
        .setFontWeight('bold').setBackground('#E8F0FE');
      // チーム平均（人数で割った公平化スコア）
      sh.getRange(totalRow, startCol + 6)
        .setFormula(`=IFERROR(SUM(${totalRange})/${memberCount},0)`)
        .setFontWeight('bold').setBackground('#FFF9C4')
        .setNumberFormat('0.00');
    }

    // 6) セル枠線
    sh.getRange(startRow, startCol, ROWS_PER_BLOCK - 1, BLOCK_WIDTH)
      .setBorder(true, true, true, true, true, true);
  });

  // 7) 列幅調整
  const maxCols = TEAMS_PER_ROW * COLS_PER_TEAM;
  for (let c = 1; c <= maxCols; c++) {
    const mod = (c - 1) % COLS_PER_TEAM;
    if (mod === 7)      sh.setColumnWidth(c, 20);   // gap
    else if (mod === 0) sh.setColumnWidth(c, 100);  // 名前
    else if (mod === 5) sh.setColumnWidth(c, 65);   // 個人合計
    else if (mod === 6) sh.setColumnWidth(c, 65);   // チーム
    else                sh.setColumnWidth(c, 50);   // 第1〜4週
  }

  SpreadsheetApp.getUi().alert('✅ スコア集計シート（週別対応）を更新しました\n\n・シート「スコア集計」を確認してください\n・第1〜4週の内訳と個人合計・チーム平均が表示されます\n・scoresシートの入力は全自動で反映されます');
}

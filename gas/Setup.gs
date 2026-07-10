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

// ── 管理者入力シート ─────────────────────────────────────
// 管理者側で入力する4項目（欠席・遅刻/早退・推薦の言葉・ビジター招待）用の
// 氏名ベースの簡易入力シートを作成する。
// 実行フロー：
//   1) setupAdminSheet() を初回に1度だけ実行 → 「管理者入力」シートが作られる
//   2) シートに直接タイプ（週・チーム名・メンバー名・活動・件数）
//   3) syncAdminEntries() を実行 → scoresシートに反映＆「反映済み ✓」印

const ADMIN_SHEET_NAME = '管理者入力';
const ADMIN_ACTIVITY_MAP = {
  '欠席':         'absent',
  '遅刻・早退':   'late',
  '推薦の言葉':   'testimonial',
  'ビジター招待': 'visitor',
};

function setupAdminSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(ADMIN_SHEET_NAME);
  if (sh) sh.clear();
  else sh = ss.insertSheet(ADMIN_SHEET_NAME);

  // タイトル・注意書き
  sh.getRange(1, 1).setValue('BNI TOP チャプターゲーム — 管理者入力').setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue('※ このシートに入力後、GASメニューから「syncAdminEntries」を実行するとscoresシートへ反映されます。')
    .setFontColor('#666').setFontSize(10);
  sh.getRange(3, 1).setValue('※ 反映済みの行はG列に✓と時刻が入ります。再度実行しても二重反映されません。')
    .setFontColor('#666').setFontSize(10);

  // ヘッダー
  const headerRow = 5;
  const headers = ['週', 'チーム名', 'メンバー名', '活動', '件数', '反映済み', '反映時刻'];
  sh.getRange(headerRow, 1, 1, headers.length).setValues([headers])
    .setBackground('#4285F4').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');

  // 空行を50行分準備（データ検証をかけるため）
  const DATA_ROWS = 50;
  const startRow = headerRow + 1;

  // 週: 1-4
  const weekRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '2', '3', '4'], true)
    .setAllowInvalid(false).build();
  sh.getRange(startRow, 1, DATA_ROWS, 1).setDataValidation(weekRule);

  // チーム名: teamsシートから
  const teamRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(CONFIG.SHEETS.TEAMS).getRange('B2:B'), true)
    .setAllowInvalid(false).build();
  sh.getRange(startRow, 2, DATA_ROWS, 1).setDataValidation(teamRule);

  // メンバー名: membersシートから
  const memberRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(CONFIG.SHEETS.MEMBERS).getRange('B2:B'), true)
    .setAllowInvalid(false).build();
  sh.getRange(startRow, 3, DATA_ROWS, 1).setDataValidation(memberRule);

  // 活動: 4項目のみ
  const actRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(ADMIN_ACTIVITY_MAP), true)
    .setAllowInvalid(false).build();
  sh.getRange(startRow, 4, DATA_ROWS, 1).setDataValidation(actRule);

  // 件数: デフォルト1
  sh.getRange(startRow, 5, DATA_ROWS, 1).setValue(1);

  // 反映済み・反映時刻の背景を薄く
  sh.getRange(startRow, 6, DATA_ROWS, 2).setBackground('#F8F9FA');

  // 列幅
  sh.setColumnWidth(1, 50);   // 週
  sh.setColumnWidth(2, 130);  // チーム名
  sh.setColumnWidth(3, 130);  // メンバー名
  sh.setColumnWidth(4, 120);  // 活動
  sh.setColumnWidth(5, 60);   // 件数
  sh.setColumnWidth(6, 80);   // 反映済み
  sh.setColumnWidth(7, 140);  // 反映時刻

  // 参考: 活動と点数のリファレンス
  sh.getRange(startRow, 9).setValue('参考：活動と点数');
  sh.getRange(startRow, 9).setFontWeight('bold').setFontColor('#666');
  [
    ['欠席',         '-10P'],
    ['遅刻・早退',   '-5P'],
    ['推薦の言葉',   '+2P（チーム週上限3件）'],
    ['ビジター招待', '+3P'],
  ].forEach((row, i) => {
    sh.getRange(startRow + 1 + i, 9, 1, 2).setValues([row]).setFontColor('#666').setFontSize(10);
  });

  SpreadsheetApp.getUi().alert(
    '✅ 管理者入力シートを作成しました\n\n' +
    '使い方：\n' +
    '1. 週・チーム名・メンバー名・活動・件数を入力\n' +
    '2. GASエディタで syncAdminEntries を実行\n' +
    '3. scoresシートに自動反映＆「反映済み✓」がつく'
  );
}

function syncAdminEntries() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const admin = ss.getSheetByName(ADMIN_SHEET_NAME);
  if (!admin) {
    SpreadsheetApp.getUi().alert('管理者入力シートが見つかりません。先に setupAdminSheet() を実行してください。');
    return;
  }

  const teams = readTeams();
  const members = readMembers();
  const teamByName = {};
  teams.forEach(t => { teamByName[String(t.name)] = String(t.team_id); });
  const memberByName = {};
  members.forEach(m => {
    memberByName[String(m.name)] = { id: String(m.member_id), team_id: String(m.team_id) };
  });

  const HEADER_ROW = 5;
  const data = admin.getRange(HEADER_ROW + 1, 1, admin.getLastRow() - HEADER_ROW, 7).getValues();

  let successCount = 0;
  const errors = [];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    data.forEach((row, i) => {
      const [week, teamName, memberName, activityLabel, count, done] = row;
      if (done) return; // 反映済みスキップ
      if (!week || !teamName || !memberName || !activityLabel || !count) return; // 空行スキップ

      const rowIndex = HEADER_ROW + 1 + i;
      const activity = ADMIN_ACTIVITY_MAP[activityLabel];
      if (!activity) { errors.push(`行${rowIndex}: 活動が不正 (${activityLabel})`); return; }

      const teamId = teamByName[String(teamName)];
      if (!teamId) { errors.push(`行${rowIndex}: チーム名が不正 (${teamName})`); return; }

      const mInfo = memberByName[String(memberName)];
      if (!mInfo) { errors.push(`行${rowIndex}: メンバー名が不正 (${memberName})`); return; }
      if (mInfo.team_id !== teamId) {
        errors.push(`行${rowIndex}: メンバー「${memberName}」は「${teamName}」に所属していません`);
        return;
      }

      const w = Number(week);
      if (!(w >= 1 && w <= 4)) { errors.push(`行${rowIndex}: 週が不正 (${week})`); return; }

      const c = Math.max(1, Number(count) || 1);
      const points = _computePoints(activity, c);

      appendScore({
        id: _uuid(),
        timestamp: new Date().toISOString(),
        team_id: teamId,
        member_id: mInfo.id,
        activity: activity,
        count: c,
        points: points,
        week: w,
      });

      admin.getRange(rowIndex, 6).setValue('✓').setFontColor('#0a7f2a').setFontWeight('bold').setHorizontalAlignment('center');
      admin.getRange(rowIndex, 7).setValue(new Date()).setNumberFormat('yyyy-MM-dd HH:mm');
      successCount++;
    });
  } finally {
    lock.releaseLock();
  }

  let msg = `✅ ${successCount}件をscoresシートに反映しました`;
  if (errors.length) {
    msg += '\n\n⚠ エラー:\n' + errors.join('\n');
  }
  SpreadsheetApp.getUi().alert(msg);
}

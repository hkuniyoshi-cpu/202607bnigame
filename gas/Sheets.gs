// スプレッドシート I/O 層

function _ss() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function _sheet(name) {
  const s = _ss().getSheetByName(name);
  if (!s) throw new Error('Sheet not found: ' + name);
  return s;
}

// ── ヘッダー付き行を JSON 化 ────────────────────────
function _rowsAsObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

// ── 読み取り ─────────────────────────────────────────
function readTeams() {
  return _rowsAsObjects(_sheet(CONFIG.SHEETS.TEAMS));
}

function readMembers() {
  return _rowsAsObjects(_sheet(CONFIG.SHEETS.MEMBERS));
}

function readScores() {
  return _rowsAsObjects(_sheet(CONFIG.SHEETS.SCORES))
    .map(r => ({
      id: String(r.id),
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
      team_id: String(r.team_id),
      member_id: String(r.member_id),
      activity: String(r.activity),
      count: Number(r.count),
      points: Number(r.points),
      week: Number(r.week),
    }));
}

// ── 書き込み ────────────────────────────────────────
// 活動キー → 表示名（scoresシートの見やすさ用）
const _ACTIVITY_LABEL_FORMULA =
  '=IF(E{ROW}="","",IFS(' +
  'E{ROW}="key_skills","キースキルズ",' +
  'E{ROW}="mindset","マインドセット",' +
  'E{ROW}="training_other","ネットワーキング/ディベロップ",' +
  'E{ROW}="ms_addon","MSアドオン受講",' +
  'E{ROW}="pt_ws_first","パワーチームWS 前半",' +
  'E{ROW}="pt_ws_second","パワーチームWS 後半",' +
  'E{ROW}="one_to_one","1to1",' +
  'E{ROW}="visitor","ビジター招待",' +
  'E{ROW}="testimonial","推薦の言葉",' +
  'E{ROW}="absent","欠席",' +
  'E{ROW}="late","遅刻・早退",' +
  'TRUE,E{ROW}))';

function appendScore(entry) {
  const sh = _sheet(CONFIG.SHEETS.SCORES);
  // タイムスタンプは Date オブジェクトで書き込む（Sheetsで日時フォーマット可能に）
  const ts = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp || Date.now());
  sh.appendRow([
    entry.id,
    ts,
    entry.team_id,
    entry.member_id,
    entry.activity,
    entry.count,
    entry.points,
    entry.week,
  ]);
  const row = sh.getLastRow();
  // タイムスタンプ列を「yyyy-mm-dd HH:mm」に整形
  sh.getRange(row, 2).setNumberFormat('yyyy-mm-dd HH:mm');
  // 見やすい列（I: チーム名, J: メンバー名, K: 活動名）を VLOOKUP で埋める
  sh.getRange(row, 9).setFormula(`=IFERROR(VLOOKUP(C${row},teams!A:B,2,FALSE),"")`);
  sh.getRange(row, 10).setFormula(`=IFERROR(VLOOKUP(D${row},members!A:B,2,FALSE),"")`);
  sh.getRange(row, 11).setFormula(_ACTIVITY_LABEL_FORMULA.replace(/\{ROW\}/g, row));
}

function deleteScoreById(scoreId, teamId) {
  const sh = _sheet(CONFIG.SHEETS.SCORES);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(scoreId)) {
      // team_idも一致することを確認（改ざん防止）
      if (String(values[i][2]) !== String(teamId)) return false;
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// 管理者用: team_id 検証なしで id 一致行を削除
function deleteScoreByIdAny(scoreId) {
  const sh = _sheet(CONFIG.SHEETS.SCORES);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(scoreId)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ── UUID (簡易) ─────────────────────────────────────
function _uuid() {
  return Utilities.getUuid();
}

// ── membersByTeam ヘルパー ─────────────────────────
function membersGroupedByTeam() {
  const members = readMembers();
  const byTeam = {};
  members.forEach(m => {
    const t = String(m.team_id);
    if (!byTeam[t]) byTeam[t] = [];
    byTeam[t].push({ member_id: String(m.member_id), name: String(m.name) });
  });
  return byTeam;
}

function withdrawalsList() {
  return readMembers()
    .filter(m => m.withdrew_week && Number(m.withdrew_week) > 0)
    .map(m => ({ member_id: String(m.member_id), withdrew_week: Number(m.withdrew_week) }));
}

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
function appendScore(entry) {
  const sh = _sheet(CONFIG.SHEETS.SCORES);
  sh.appendRow([
    entry.id,
    entry.timestamp,
    entry.team_id,
    entry.member_id,
    entry.activity,
    entry.count,
    entry.points,
    entry.week,
  ]);
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

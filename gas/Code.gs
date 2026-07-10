// Web App エンドポイント。doGet/doPost が clients から呼ばれる。
// レスポンスは全て JSON。CORS は GAS が自動でつける (`*`)。

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet: 読み取り系 ─────────────────────────────
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'progress';

    if (action === 'progress') {
      return _json(getProgress_());
    }
    if (action === 'team') {
      const token = e.parameter.token;
      return _json(getTeamView_(token));
    }
    if (action === 'activities') {
      return _json({ ok: true, activities: CONFIG.ACTIVITIES });
    }
    return _json({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}

// ── doPost: 書き込み系 ───────────────────────────
function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      return _json({ ok: false, error: 'invalid JSON body' });
    }
    if (body.action === 'submit') return _json(submitScore_(body));
    if (body.action === 'delete') return _json(deleteScore_(body));
    return _json({ ok: false, error: 'unknown action: ' + body.action });
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}

// ── 進捗ページ用データ ─────────────────────────
function getProgress_() {
  const teams = readTeams();
  const members = readMembers();
  const scores = readScores();

  const membersByTeam = membersGroupedByTeam();
  const withdrawals = withdrawalsList();

  const weekly = _aggregateWeekly(scores, membersByTeam, withdrawals);
  const teamCumulative = _cumulativeAverages(weekly);

  // 個人ビュー用の累積
  const memberIds = members.map(m => String(m.member_id));
  const memberCum = _memberCumulative(scores, memberIds);

  const teamOut = teams.map(t => ({
    team_id: String(t.team_id),
    name: String(t.name),
    memberCount: (membersByTeam[t.team_id] || []).length,
    cumulative: teamCumulative[String(t.team_id)] || [0, 0, 0, 0, 0],
    weekly: {
      1: weekly[t.team_id] && weekly[t.team_id][1] ? weekly[t.team_id][1].teamAverage : 0,
      2: weekly[t.team_id] && weekly[t.team_id][2] ? weekly[t.team_id][2].teamAverage : 0,
      3: weekly[t.team_id] && weekly[t.team_id][3] ? weekly[t.team_id][3].teamAverage : 0,
      4: weekly[t.team_id] && weekly[t.team_id][4] ? weekly[t.team_id][4].teamAverage : 0,
    },
  }));

  const memberOut = members.map(m => {
    const t = teams.find(x => String(x.team_id) === String(m.team_id));
    return {
      member_id: String(m.member_id),
      name: String(m.name),
      team_id: String(m.team_id),
      team_name: t ? String(t.name) : '',
      cumulative: memberCum[String(m.member_id)] || [0, 0, 0, 0, 0],
    };
  });

  return {
    ok: true,
    now: new Date().toISOString(),
    game_start: CONFIG.GAME_START,
    week_ends: CONFIG.WEEK_ENDS,
    teams: teamOut,
    members: memberOut,
  };
}

// ── チーム画面用データ ─────────────────────────
function getTeamView_(token) {
  const teams = readTeams();
  const teamId = _verifyToken(teams.map(t => ({ team_id: t.team_id, token: t.token })), token);
  if (!teamId) return { ok: false, error: 'invalid_token' };

  const team = teams.find(t => String(t.team_id) === String(teamId));
  const members = readMembers().filter(m => String(m.team_id) === String(teamId));
  const scores = readScores().filter(s => String(s.team_id) === String(teamId));

  // 現在の週
  const currentWeek = _weekOf(new Date());

  // 週別の暫定スコア
  const membersByTeam = {};
  membersByTeam[teamId] = members.map(m => ({ member_id: String(m.member_id), name: String(m.name) }));
  const withdrawals = withdrawalsList().filter(w =>
    members.find(m => String(m.member_id) === String(w.member_id))
  );
  const weekly = _aggregateWeekly(scores, membersByTeam, withdrawals);

  return {
    ok: true,
    team: {
      team_id: String(team.team_id),
      name:    String(team.name),
    },
    members: members.map(m => ({
      member_id: String(m.member_id),
      name:      String(m.name),
      withdrew_week: m.withdrew_week ? Number(m.withdrew_week) : null,
    })),
    scores: scores.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      member_id: s.member_id,
      activity: s.activity,
      count: s.count,
      points: s.points,
      week: s.week,
    })),
    weekly: weekly[teamId] || {},
    current_week: currentWeek,
    activities: CONFIG.ACTIVITIES,
  };
}

// ── スコア送信 ─────────────────────────────────
function submitScore_(body) {
  const teams = readTeams();
  const teamId = _verifyToken(teams.map(t => ({ team_id: t.team_id, token: t.token })), body.token);
  if (!teamId) return { ok: false, error: 'invalid_token' };

  const activity = body.activity;
  if (!CONFIG.ACTIVITIES[activity]) return { ok: false, error: 'invalid_activity' };

  const member_id = String(body.member_id || '');
  const members = readMembers().filter(m => String(m.team_id) === String(teamId));
  if (!members.find(m => String(m.member_id) === member_id)) {
    return { ok: false, error: 'invalid_member' };
  }

  const count = Math.max(1, Math.min(Number(body.count) || 1, 20));
  const now = new Date();

  // 対象週の入力可否チェック（過去週=期限切れ／未来週=まだ入力不可）
  const target = Number(body.target_week) || _weekOf(now);
  const gate = _validateInputWeek(now, target);
  if (!gate.ok) return { ok: false, error: gate.error, current: gate.current };
  const week = gate.week;

  const points = _computePoints(activity, count);
  const entry = {
    id: _uuid(),
    timestamp: now.toISOString(),
    team_id: teamId,
    member_id: member_id,
    activity: activity,
    count: count,
    points: points,
    week: week,
  };

  // LockService で同時書き込みを直列化
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendScore(entry);
  } finally {
    lock.releaseLock();
  }

  return { ok: true, entry: entry };
}

// ── スコア削除 ─────────────────────────────────
function deleteScore_(body) {
  const teams = readTeams();
  const teamId = _verifyToken(teams.map(t => ({ team_id: t.team_id, token: t.token })), body.token);
  if (!teamId) return { ok: false, error: 'invalid_token' };

  const scoreId = String(body.score_id || '');
  if (!scoreId) return { ok: false, error: 'missing_score_id' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ok = deleteScoreById(scoreId, teamId);
    return ok ? { ok: true } : { ok: false, error: 'not_found_or_forbidden' };
  } finally {
    lock.releaseLock();
  }
}

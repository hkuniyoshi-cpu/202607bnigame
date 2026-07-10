// src/logic.js と同じ純粋ロジック。GASにコピーしたもの。
// 更新するときは src/logic.js を変更 → node --test で確認 → こちらに反映。

function _weekOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const start = new Date(CONFIG.GAME_START);
  if (d < start) return 0;
  for (let i = 0; i < CONFIG.WEEK_ENDS.length; i++) {
    if (d <= new Date(CONFIG.WEEK_ENDS[i])) return i + 1;
  }
  return 0;
}

function _validateInputWeek(now, targetWeek) {
  const current = _weekOf(now);
  if (current === 0) return { ok: false, error: 'out_of_game_period' };
  const t = Number(targetWeek);
  if (!(t >= 1 && t <= 4)) return { ok: false, error: 'invalid_week' };
  if (t < current) return { ok: false, error: 'week_closed', current: current };
  if (t > current) return { ok: false, error: 'week_not_open_yet', current: current };
  return { ok: true, week: current };
}

function _computePoints(activity, count) {
  const def = CONFIG.ACTIVITIES[activity];
  if (!def) return 0;
  const n = Number(count) || 0;
  const raw = def.points * n;
  return def.sign === '-' ? -raw : raw;
}

function _aggregateWeekly(scores, membersByTeam, withdrawals) {
  const withdrawMap = {};
  (withdrawals || []).forEach(w => {
    if (w.withdrew_week) withdrawMap[w.member_id] = w.withdrew_week;
  });

  const result = {};
  Object.keys(membersByTeam).forEach(team_id => {
    result[team_id] = {};
    for (let w = 1; w <= 4; w++) {
      const activeMembers = membersByTeam[team_id].filter(m => {
        const wk = withdrawMap[m.member_id];
        return !wk || wk > w;
      });
      const memberScores = {};
      activeMembers.forEach(m => { memberScores[m.member_id] = 0; });
      result[team_id][w] = {
        activeMemberCount: activeMembers.length,
        memberScores: memberScores,
        testimonialCount: 0,
        teamRawTotal: 0,
        teamAverage: 0,
      };
    }
  });

  scores.forEach(s => {
    const w = s.week || _weekOf(s.timestamp);
    if (w < 1 || w > 4) return;
    const bucket = result[s.team_id] && result[s.team_id][w];
    if (!bucket) return;
    if (!(s.member_id in bucket.memberScores)) return;

    if (s.activity === 'testimonial') {
      const cap = CONFIG.ACTIVITIES.testimonial.teamWeeklyCap;
      const remaining = Math.max(0, cap - bucket.testimonialCount);
      const applied = Math.min(remaining, s.count || 0);
      const pts = _computePoints('testimonial', applied);
      bucket.memberScores[s.member_id] += pts;
      bucket.testimonialCount += applied;
    } else {
      bucket.memberScores[s.member_id] += (s.points != null ? s.points : _computePoints(s.activity, s.count));
    }
  });

  Object.keys(result).forEach(team_id => {
    for (let w = 1; w <= 4; w++) {
      const b = result[team_id][w];
      b.teamRawTotal = Object.values(b.memberScores).reduce((a, c) => a + c, 0);
      b.teamAverage = b.activeMemberCount > 0
        ? parseFloat((b.teamRawTotal / b.activeMemberCount).toFixed(2))
        : 0;
    }
  });
  return result;
}

function _cumulativeAverages(weeklyAgg) {
  const out = {};
  Object.keys(weeklyAgg).forEach(team_id => {
    const arr = [0];
    let acc = 0;
    for (let w = 1; w <= 4; w++) {
      acc += weeklyAgg[team_id][w].teamAverage;
      arr.push(parseFloat(acc.toFixed(2)));
    }
    out[team_id] = arr;
  });
  return out;
}

function _memberCumulative(scores, memberIds) {
  const out = {};
  memberIds.forEach(id => { out[id] = [0, 0, 0, 0, 0]; });
  scores.forEach(s => {
    const w = s.week || _weekOf(s.timestamp);
    if (w < 1 || w > 4) return;
    if (!out[s.member_id]) return;
    const pts = s.points != null ? s.points : _computePoints(s.activity, s.count);
    for (let i = w; i <= 4; i++) out[s.member_id][i] += pts;
  });
  Object.keys(out).forEach(id => {
    out[id] = out[id].map(v => parseFloat(v.toFixed(2)));
  });
  return out;
}

function _verifyToken(teams, token) {
  if (!token || typeof token !== 'string') return null;
  const found = teams.find(t => t.token === token);
  return found ? found.team_id : null;
}

function _generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

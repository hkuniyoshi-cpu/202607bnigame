// BNI Game — 純粋な計算ロジック。GAS/Node双方で利用。
// このファイルは副作用ゼロ。I/OはSheets.gsが担当。

// ── 定数 ────────────────────────────────────────────────
const GAME_START = new Date('2026-07-13T00:00:00+09:00');
const WEEK_ENDS = [
  new Date('2026-07-19T23:59:59+09:00'), // 第1週
  new Date('2026-07-26T23:59:59+09:00'), // 第2週
  new Date('2026-08-02T23:59:59+09:00'), // 第3週
  new Date('2026-08-12T23:59:59+09:00'), // 第4週（8/12までに延長）
];

const ACTIVITIES = {
  key_skills:      { label: 'キースキルズトレーニング',                    points:  1, sign: '+' },
  mindset:         { label: 'マインドセットトレーニング',                  points:  1, sign: '+' },
  training_other:  { label: 'その他BNIトレーニング（ネットワーキング/ディベロップ等）', points:  1, sign: '+' },
  ms_addon:        { label: 'MSアドオン受講',                              points:  2, sign: '+' },
  pt_ws_first:     { label: 'パワーチームWS 前半（ターゲットマーケット）',  points:  5, sign: '+' },
  pt_ws_second:    { label: 'パワーチームWS 後半（パワーチーム構築）',      points: 10, sign: '+' },
  one_to_one:      { label: '1to1（30分以上）',                            points:  1, sign: '+' },
  visitor:         { label: 'ビジター招待',                                points:  3, sign: '+' },
  testimonial:     { label: '推薦の言葉',                                  points:  2, sign: '+', teamWeeklyCap: 3 },
  absent:          { label: '欠席',                                        points: 10, sign: '-' },
  late:            { label: '遅刻・早退',                                  points:  5, sign: '-' },
};

// ── 日付ヘルパー ─────────────────────────────────────
/** ISO文字列 or Date → 何週目 (1〜4)、期間外は 0 */
function weekOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (d < GAME_START) return 0;
  for (let i = 0; i < WEEK_ENDS.length; i++) {
    if (d <= WEEK_ENDS[i]) return i + 1;
  }
  return 0;
}

/**
 * 対象週の入力可否を判定する。
 * ・過去週 → week_closed（入力期限が過ぎています）
 * ・未来週 → week_not_open_yet
 * ・現在の週 → ok
 * ・期間外 → out_of_game_period
 */
function validateInputWeek(now, targetWeek) {
  const current = weekOf(now);
  if (current === 0) return { ok: false, error: 'out_of_game_period' };
  const t = Number(targetWeek);
  if (!(t >= 1 && t <= 4)) return { ok: false, error: 'invalid_week' };
  if (t < current) return { ok: false, error: 'week_closed', current: current };
  if (t > current) return { ok: false, error: 'week_not_open_yet', current: current };
  return { ok: true, week: current };
}

/** 1件のスコア記録 → 実際の獲得点（活動種別×件数、符号込み） */
function computePoints(activity, count) {
  const def = ACTIVITIES[activity];
  if (!def) return 0;
  const n = Number(count) || 0;
  const raw = def.points * n;
  return def.sign === '-' ? -raw : raw;
}

// ── 集計 ────────────────────────────────────────────
/**
 * 全スコア記録から、チーム週次の集計を作る。
 * scores: Array<{team_id, member_id, activity, count, points, week}>
 * withdrawals: Array<{member_id, withdrew_week}> — その週の人数から除外
 *
 * 返却: {
 *   [team_id]: {
 *     [week]: {
 *       activeMemberCount: number,     // その週参加していた人数
 *       memberScores: {[member_id]: number},
 *       teamRawTotal: number,          // テスティモニアル上限適用後
 *       teamAverage: number,           // teamRawTotal / activeMemberCount
 *     }
 *   }
 * }
 */
function aggregateWeekly(scores, membersByTeam, withdrawals) {
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
        return !wk || wk > w; // wk週で退場 → w < wk は在籍
      });
      result[team_id][w] = {
        activeMemberCount: activeMembers.length,
        memberScores: Object.fromEntries(activeMembers.map(m => [m.member_id, 0])),
        testimonialCount: 0,
        teamRawTotal: 0,
        teamAverage: 0,
      };
    }
  });

  // 各スコアを反映（テスティモニアル上限は反映時にカウント）
  scores.forEach(s => {
    const w = s.week || weekOf(s.timestamp);
    if (w < 1 || w > 4) return;
    const bucket = result[s.team_id] && result[s.team_id][w];
    if (!bucket) return;
    if (!(s.member_id in bucket.memberScores)) return; // 退場済み等

    if (s.activity === 'testimonial') {
      const cap = ACTIVITIES.testimonial.teamWeeklyCap;
      const remaining = Math.max(0, cap - bucket.testimonialCount);
      const applied = Math.min(remaining, s.count || 0);
      const pts = computePoints('testimonial', applied);
      bucket.memberScores[s.member_id] += pts;
      bucket.testimonialCount += applied;
    } else {
      bucket.memberScores[s.member_id] += (s.points != null ? s.points : computePoints(s.activity, s.count));
    }
  });

  // 平均計算
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

/**
 * 週次集計 → 累積平均の推移
 * 返却: {[team_id]: [0, w1平均の累積, w1+w2累積, ...]}
 * ※ 累積平均 = 各週の平均を足していく（週ごとに人数が違う可能性があるため単純合算）
 */
function cumulativeAverages(weeklyAgg) {
  const out = {};
  Object.keys(weeklyAgg).forEach(team_id => {
    const arr = [0]; // 開始日は0
    let acc = 0;
    for (let w = 1; w <= 4; w++) {
      acc += weeklyAgg[team_id][w].teamAverage;
      arr.push(parseFloat(acc.toFixed(2)));
    }
    out[team_id] = arr;
  });
  return out;
}

/**
 * 個人スコアの累積推移
 * 返却: {[member_id]: [0, w1累積, w2累積, w3累積, w4累積]}
 */
function memberCumulative(scores, memberIds) {
  const out = {};
  memberIds.forEach(id => { out[id] = [0, 0, 0, 0, 0]; });

  scores.forEach(s => {
    const w = s.week || weekOf(s.timestamp);
    if (w < 1 || w > 4) return;
    if (!out[s.member_id]) return;
    const pts = s.points != null ? s.points : computePoints(s.activity, s.count);
    for (let i = w; i <= 4; i++) out[s.member_id][i] += pts;
  });

  // 小数点2桁
  Object.keys(out).forEach(id => {
    out[id] = out[id].map(v => parseFloat(v.toFixed(2)));
  });
  return out;
}

/**
 * チームトークン → team_id を返す。無効なら null。
 * teams: Array<{team_id, token}>
 */
function verifyToken(teams, token) {
  if (!token || typeof token !== 'string') return null;
  const found = teams.find(t => t.token === token);
  return found ? found.team_id : null;
}

/** 6桁のランダムトークン（大文字英数、視認性の低い文字は除外） */
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // I,O,0,1除外
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ── エクスポート ─────────────────────────────────────
const API = {
  GAME_START,
  WEEK_ENDS,
  ACTIVITIES,
  weekOf,
  validateInputWeek,
  computePoints,
  aggregateWeekly,
  cumulativeAverages,
  memberCumulative,
  verifyToken,
  generateToken,
};

// Node.js 用（GASでは条件式が falsy になり無害）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/logic.js');

// ── weekOf ─────────────────────────────────────────────
test('weekOf: 開始日 7/13 は第1週', () => {
  assert.equal(L.weekOf('2026-07-13T10:00:00+09:00'), 1);
});
test('weekOf: 7/19 23:59 は第1週', () => {
  assert.equal(L.weekOf('2026-07-19T23:59:00+09:00'), 1);
});
test('weekOf: 7/20 00:00 は第2週', () => {
  assert.equal(L.weekOf('2026-07-20T00:00:00+09:00'), 2);
});
test('weekOf: 8/9 は第4週', () => {
  assert.equal(L.weekOf('2026-08-09T20:00:00+09:00'), 4);
});
test('weekOf: 8/12 23:59（延長最終日）は第4週', () => {
  assert.equal(L.weekOf('2026-08-12T23:59:00+09:00'), 4);
});
test('weekOf: 期間外は 0', () => {
  assert.equal(L.weekOf('2026-07-12T10:00:00+09:00'), 0);
  assert.equal(L.weekOf('2026-08-13T00:00:00+09:00'), 0);
});

// ── validateInputWeek ──────────────────────────────────
test('validateInputWeek: 現在週の入力はOK', () => {
  const now = new Date('2026-07-22T10:00:00+09:00'); // 第2週
  assert.deepEqual(L.validateInputWeek(now, 2), { ok: true, week: 2 });
});
test('validateInputWeek: 過去週は week_closed', () => {
  const now = new Date('2026-07-22T10:00:00+09:00'); // 第2週
  const r = L.validateInputWeek(now, 1);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'week_closed');
  assert.equal(r.current, 2);
});
test('validateInputWeek: 未来週は week_not_open_yet', () => {
  const now = new Date('2026-07-22T10:00:00+09:00'); // 第2週
  const r = L.validateInputWeek(now, 3);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'week_not_open_yet');
});
test('validateInputWeek: ゲーム期間外は out_of_game_period', () => {
  assert.equal(L.validateInputWeek(new Date('2026-07-10'), 1).error, 'out_of_game_period');
  assert.equal(L.validateInputWeek(new Date('2026-08-13'), 4).error, 'out_of_game_period');
});
test('validateInputWeek: 無効な週番号は invalid_week', () => {
  const now = new Date('2026-07-22T10:00:00+09:00');
  assert.equal(L.validateInputWeek(now, 0).error, 'invalid_week');
  assert.equal(L.validateInputWeek(now, 5).error, 'invalid_week');
});

// ── computePoints ──────────────────────────────────────
test('computePoints: プラス種別', () => {
  assert.equal(L.computePoints('visitor', 2), 6);       // +3 × 2
  assert.equal(L.computePoints('pt_ws_second', 1), 10); // +10
  assert.equal(L.computePoints('one_to_one', 3), 3);    // +1 × 3
});
test('computePoints: マイナス種別は負', () => {
  assert.equal(L.computePoints('absent', 1), -10);
  assert.equal(L.computePoints('late', 2), -10);
});
test('computePoints: 未知種別は 0', () => {
  assert.equal(L.computePoints('nope', 5), 0);
});

// ── aggregateWeekly ────────────────────────────────────
test('aggregateWeekly: 単純ケース（3人×2週）', () => {
  const membersByTeam = {
    t01: [
      { member_id: 'm1' }, { member_id: 'm2' }, { member_id: 'm3' },
    ],
  };
  const scores = [
    { team_id: 't01', member_id: 'm1', activity: 'visitor',  count: 1, week: 1 }, // +3
    { team_id: 't01', member_id: 'm2', activity: 'absent',   count: 1, week: 1 }, // -10
    { team_id: 't01', member_id: 'm3', activity: 'mindset',  count: 2, week: 2 }, // +2
  ];
  const agg = L.aggregateWeekly(scores, membersByTeam, []);
  assert.equal(agg.t01[1].activeMemberCount, 3);
  assert.equal(agg.t01[1].teamRawTotal, -7);
  assert.equal(agg.t01[1].teamAverage, parseFloat((-7/3).toFixed(2)));
  assert.equal(agg.t01[2].teamRawTotal, 2);
  assert.equal(agg.t01[2].teamAverage, parseFloat((2/3).toFixed(2)));
});

test('aggregateWeekly: 途中退場 → その週から人数減', () => {
  const membersByTeam = {
    t01: [
      { member_id: 'm1' }, { member_id: 'm2' }, { member_id: 'm3' },
    ],
  };
  const withdrawals = [{ member_id: 'm3', withdrew_week: 3 }];
  const scores = [
    { team_id: 't01', member_id: 'm1', activity: 'visitor', count: 1, week: 3 }, // +3
  ];
  const agg = L.aggregateWeekly(scores, membersByTeam, withdrawals);
  // m3は第3週で退場 → 第3週の参加者は2人
  assert.equal(agg.t01[3].activeMemberCount, 2);
  assert.equal(agg.t01[3].teamRawTotal, 3);
  assert.equal(agg.t01[3].teamAverage, 1.5);
  // 第2週はまだ在籍
  assert.equal(agg.t01[2].activeMemberCount, 3);
});

test('aggregateWeekly: 推薦の言葉は週上限3', () => {
  const membersByTeam = { t01: [{member_id:'m1'},{member_id:'m2'}] };
  const scores = [
    { team_id: 't01', member_id: 'm1', activity: 'testimonial', count: 2, week: 1 },
    { team_id: 't01', member_id: 'm2', activity: 'testimonial', count: 3, week: 1 },
  ];
  const agg = L.aggregateWeekly(scores, membersByTeam, []);
  // m1が2件加点、m2は残り1件のみ加点（合計3件で打ち切り）
  assert.equal(agg.t01[1].testimonialCount, 3);
  assert.equal(agg.t01[1].memberScores.m1, 4); // 2件×2P
  assert.equal(agg.t01[1].memberScores.m2, 2); // 1件×2P
  assert.equal(agg.t01[1].teamRawTotal, 6);
});

test('aggregateWeekly: 期間外のスコアは無視', () => {
  const membersByTeam = { t01: [{member_id:'m1'}] };
  const scores = [
    { team_id: 't01', member_id: 'm1', activity: 'visitor', count: 1, week: 0 },
    { team_id: 't01', member_id: 'm1', activity: 'visitor', count: 1, week: 5 },
  ];
  const agg = L.aggregateWeekly(scores, membersByTeam, []);
  assert.equal(agg.t01[1].teamRawTotal, 0);
});

// ── cumulativeAverages ────────────────────────────────
test('cumulativeAverages: 各週の平均を累積', () => {
  const weekly = {
    t01: {
      1: { teamAverage: 1 },
      2: { teamAverage: 2 },
      3: { teamAverage: 3 },
      4: { teamAverage: 0.5 },
    }
  };
  assert.deepEqual(L.cumulativeAverages(weekly).t01, [0, 1, 3, 6, 6.5]);
});

// ── memberCumulative ──────────────────────────────────
test('memberCumulative: 週次スコアを累積', () => {
  const scores = [
    { member_id: 'm1', activity: 'visitor', count: 1, week: 1 }, // +3
    { member_id: 'm1', activity: 'absent',  count: 1, week: 3 }, // -10
  ];
  const out = L.memberCumulative(scores, ['m1']);
  assert.deepEqual(out.m1, [0, 3, 3, -7, -7]);
});

// ── verifyToken ───────────────────────────────────────
test('verifyToken: 有効/無効', () => {
  const teams = [{ team_id: 't01', token: 'ABC123' }, { team_id: 't02', token: 'DEF456' }];
  assert.equal(L.verifyToken(teams, 'ABC123'), 't01');
  assert.equal(L.verifyToken(teams, 'DEF456'), 't02');
  assert.equal(L.verifyToken(teams, 'nope'), null);
  assert.equal(L.verifyToken(teams, ''), null);
  assert.equal(L.verifyToken(teams, null), null);
});

// ── generateToken ──────────────────────────────────────
test('generateToken: 6文字・視認性低い文字を含まない', () => {
  for (let i = 0; i < 100; i++) {
    const t = L.generateToken();
    assert.equal(t.length, 6);
    assert.doesNotMatch(t, /[IO01]/);
    assert.match(t, /^[A-HJ-NP-Z2-9]{6}$/);
  }
});

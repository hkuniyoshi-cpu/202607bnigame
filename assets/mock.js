// GAS URL 未設定時のモック API。開発/デモ用。
// 本番デプロイ時は index.html/input.html から <script src="mock.js"> を外す、
// または config.js の GAS_API_URL を実URLに差し替える。

(function () {
  const cfg = window.BNI_CONFIG || {};
  if (!/PASTE_DEPLOYMENT_ID/.test(cfg.GAS_API_URL || '')) return; // 実URLが入っていれば何もしない

  console.warn('[BNI] Mock mode enabled — GAS_API_URL is not configured.');

  const TEAMS_DEF = [
    { name: 'チーム1',      members: ['西平 泰士','玉城 一朗','比嘉 基','宮城 卓朗','上原 繁猛'] },
    { name: '知念工務店',   members: ['松田 謙','金城 孝文','知念 直明','塩川 健勇'] },
    { name: 'チーム3',      members: ['宮里 判','中村 利枝','座間味 亮','八巻 徳幸'] },
    { name: 'チーム4',      members: ['安慶名 紀昭','新川 浩司','島袋 麗央','諸見里 杉子'] },
    { name: 'チーム5',      members: ['高橋 利佑一','金城 杉志郎','與那嶺 新','角江 明彦','中尾 善弘'] },
    { name: 'チーム6',      members: ['宮本 達矢','奥平 雄太','平 大治郎','東恩納 洋','洲鎌 晃'] },
    { name: 'ギネス',       members: ['當真 嗣剛','金 学辰','小波津 啓史','崎原 光明','カヲル'] },
    { name: 'KKKパンダ',    members: ['Belle ベル','稲福 剛治','伊志嶺 周','棚原 憲勇','宮國 桂光'] },
    { name: '縁結サマーズ', members: ['比嘉 太一','上門 春菜','Nika ニカ','比嘉 美奈子','尾辻 克敏'] },
    { name: 'ザハーレム',   members: ['亀井 奈紀沙','白坂 剛士','上原 み和','浜元 新菜','前川 麻里奈'] },
    { name: 'ついちゃんズ', members: ['小出 一登','山田 カール和彦','後小橋川 梨帆','上江洲 俊介','中村 淳男'] },
    { name: '無遅刻無欠席', members: ['小橋川 牧','湯川 具人','伊集 朝和','辻野 幸太郎','謝花 斉'] },
    { name: 'チーム13',     members: ['湧川 洋邦','金城 智史','南 竜二','宮城 卓也','又吉 亮太'] },
    { name: '女子入れろ',   members: ['唐沢 達雄','伊仲 道千丞','島袋 利信','柴田 博人','中里 迅志'] },
    { name: '美幸爆破家',   members: ['金城 恵輔','譜久村 美幸','安次富 義人','砂川 奨太','玉城 判'] },
    { name: 'お月様S',      members: ['藤木 彰','月乃 美椅浬','奥原 君代','大城 卓実','慶田盛 克磨'] },
    { name: 'ピオミキヤ',   members: ['近藤 彩加','宮城 達','大城 知也','金城 学','山川 宗克'] },
  ];

  const MOCK_TOKEN = 'DEMO01'; // ?team=DEMO01 でチーム1にアクセス

  const ACTIVITIES = {
    key_skills:      { label: 'キースキルズトレーニング',                    points:  1, sign: '+' },
    mindset:         { label: 'マインドセットトレーニング',                  points:  1, sign: '+' },
    training_other:  { label: 'その他BNIトレーニング（ネットワーキング/CD等）', points:  1, sign: '+' },
    ms_addon:        { label: 'MSアドオン受講',                              points:  2, sign: '+' },
    pt_ws_first:     { label: 'パワーチームWS 前半（ターゲットマーケット）',  points:  5, sign: '+' },
    pt_ws_second:    { label: 'パワーチームWS 後半（パワーチーム構築）',      points: 10, sign: '+' },
    one_to_one:      { label: '1to1（30分以上）',                            points:  1, sign: '+' },
    visitor:         { label: 'ビジター招待',                                points:  3, sign: '+' },
    testimonial:     { label: '推薦の言葉',                                  points:  2, sign: '+', teamWeeklyCap: 3 },
    absent:          { label: '欠席',                                        points: 10, sign: '-' },
    late:            { label: '遅刻・早退',                                  points:  5, sign: '-' },
  };

  function mkRand(seed) { let s = seed; return () => { s=(s*9301+49297)%233280; return s/233280; }; }

  // シードあり乱数で「それっぽい」データ生成
  function generateProgress() {
    const teams = TEAMS_DEF.map((t, i) => {
      const r = mkRand(i * 17 + 5);
      const bias = i < 3 ? 2.5 : i < 7 ? 1.2 : i < 12 ? 0.2 : -0.3;
      const cumulative = [0];
      const weekly = {};
      for (let w = 1; w <= 4; w++) {
        const avg = parseFloat(((r() - 0.28) * 4.5 + bias).toFixed(2));
        weekly[w] = avg;
        cumulative.push(parseFloat((cumulative[cumulative.length-1] + avg).toFixed(2)));
      }
      return {
        team_id: 't' + String(i+1).padStart(2, '0'),
        name: t.name,
        memberCount: t.members.length,
        cumulative,
        weekly,
      };
    });

    const members = [];
    TEAMS_DEF.forEach((t, ti) => {
      t.members.forEach((mname, mi) => {
        const idx = members.length;
        const r = mkRand(idx * 23 + 3);
        const bias = idx < 5 ? 3.0 : idx < 15 ? 1.2 : 0.1;
        const cumulative = [0];
        for (let w = 1; w <= 4; w++) {
          const inc = (r() - 0.22) * 5.5 + bias;
          cumulative.push(parseFloat((cumulative[cumulative.length-1] + inc).toFixed(2)));
        }
        members.push({
          member_id: 't' + String(ti+1).padStart(2,'0') + '_m' + String(mi+1).padStart(2,'0'),
          name: mname,
          team_id: 't' + String(ti+1).padStart(2,'0'),
          team_name: t.name,
          cumulative,
        });
      });
    });

    return {
      ok: true,
      now: new Date().toISOString(),
      teams,
      members,
    };
  }

  // 入力ページ用モック
  const mockScoresStore = {}; // team_id -> [scores]
  const mockCurrentWeek = 4;

  function generateTeamView(token) {
    if (token !== MOCK_TOKEN) return { ok: false, error: 'invalid_token' };
    const t = TEAMS_DEF[0]; // チーム1
    const team_id = 't01';
    const members = t.members.map((n, i) => ({
      member_id: team_id + '_m' + String(i+1).padStart(2,'0'),
      name: n,
      withdrew_week: null,
    }));

    // 既存モックスコア（初回のみ生成）
    if (!mockScoresStore[team_id]) {
      mockScoresStore[team_id] = [
        { id: 'x1', timestamp: '2026-07-15T10:00:00Z', member_id: members[0].member_id, activity: 'key_skills',  count: 1, points:  1, week: 1 },
        { id: 'x2', timestamp: '2026-07-17T10:00:00Z', member_id: members[1].member_id, activity: 'visitor',     count: 2, points:  6, week: 1 },
        { id: 'x3', timestamp: '2026-07-22T10:00:00Z', member_id: members[2].member_id, activity: 'testimonial', count: 2, points:  4, week: 2 },
        { id: 'x4', timestamp: '2026-07-29T10:00:00Z', member_id: members[0].member_id, activity: 'absent',      count: 1, points:-10, week: 3 },
      ];
    }

    // 週次の平均を仮計算
    const weekly = {};
    for (let w = 1; w <= 4; w++) {
      const wkScores = mockScoresStore[team_id].filter(s => s.week === w);
      const total = wkScores.reduce((a, c) => a + c.points, 0);
      weekly[w] = {
        activeMemberCount: members.length,
        teamRawTotal: total,
        teamAverage: parseFloat((total / members.length).toFixed(2)),
      };
    }

    return {
      ok: true,
      team: { team_id, name: t.name },
      members,
      scores: mockScoresStore[team_id],
      weekly,
      current_week: mockCurrentWeek,
      activities: ACTIVITIES,
    };
  }

  function submitScore(body) {
    if (body.token !== MOCK_TOKEN) return { ok: false, error: 'invalid_token' };
    const activity = ACTIVITIES[body.activity];
    if (!activity) return { ok: false, error: 'invalid_activity' };
    const raw = activity.points * body.count;
    const points = activity.sign === '-' ? -raw : raw;
    const entry = {
      id: 'mock_' + Date.now(),
      timestamp: new Date().toISOString(),
      team_id: 't01',
      member_id: body.member_id,
      activity: body.activity,
      count: body.count,
      points,
      week: mockCurrentWeek,
    };
    (mockScoresStore.t01 || (mockScoresStore.t01 = [])).push(entry);
    return { ok: true, entry };
  }

  function deleteScore(body) {
    if (body.token !== MOCK_TOKEN) return { ok: false, error: 'invalid_token' };
    const arr = mockScoresStore.t01 || [];
    const i = arr.findIndex(s => s.id === body.score_id);
    if (i < 0) return { ok: false, error: 'not_found' };
    arr.splice(i, 1);
    return { ok: true };
  }

  // BNI_API を差し替え
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  window.BNI_API = {
    fetchProgress: async () => { await delay(200); return generateProgress(); },
    fetchTeam:     async (token) => { await delay(200); return generateTeamView(token); },
    submit:        async (body)  => { await delay(150); return submitScore(body); },
    deleteScore:   async (body)  => { await delay(150); return deleteScore(body); },
  };

  // モック表示バッジ
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:20px;right:20px;background:#ffc107;color:#000;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:1px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.4)';
    badge.textContent = 'MOCK MODE (GAS未接続)';
    document.body.appendChild(badge);
  });
})();

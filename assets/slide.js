// 順位表スライドページ（PowerPoint貼付用）
(function () {
  const ADMIN_KEY = 'kuniyoshi2026'; // 管理者鍵。URL: /slide/?k=<KEY>
  const params = new URLSearchParams(location.search);
  const providedKey = params.get('k');

  if (providedKey !== ADMIN_KEY) {
    document.body.innerHTML = `
      <div class="access-denied">
        <div>
          <h2 style="color:#f87171;margin-bottom:12px">🔒 アクセス制限</h2>
          <p>この画面は管理者用です。URLに認証キーを付けてアクセスしてください。</p>
        </div>
      </div>`;
    return;
  }

  let data = null;
  let view = 'team'; // 'team' or 'member'

  async function load() {
    try {
      data = await BNI_API.fetchProgress();
      if (!data.ok) throw new Error(data.error);
      render();
    } catch (e) {
      document.getElementById('slidePodium').innerHTML = '<div style="color:#f87171;padding:20px">データ取得失敗: ' + e.message + '</div>';
    }
  }

  function currentWeek() {
    const now = new Date();
    const START = new Date('2026-07-13T00:00:00+09:00');
    const ENDS = [
      new Date('2026-07-19T23:59:59+09:00'),
      new Date('2026-07-26T23:59:59+09:00'),
      new Date('2026-08-02T23:59:59+09:00'),
      new Date('2026-08-12T23:59:59+09:00'),
    ];
    if (now < START) return 0;
    for (let i = 0; i < ENDS.length; i++) if (now <= ENDS[i]) return i + 1;
    return 4;
  }

  function render() {
    const cw = currentWeek();
    document.getElementById('slideWeek').textContent =
      cw === 0 ? '開始前' : cw === 4 ? '第4週（最終週）' : `第${cw}週`;

    const now = new Date();
    document.getElementById('slideUpdated').textContent =
      `更新: ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    document.getElementById('slideView').textContent =
      view === 'team' ? '📊 チーム順位' : '👤 個人順位';

    if (view === 'team') {
      renderTeams();
    } else {
      renderMembers();
    }
  }

  function renderTeams() {
    const sorted = [...data.teams].sort((a,b) =>
      b.cumulative[b.cumulative.length-1] - a.cumulative[a.cumulative.length-1]
    );

    // TOP 5 は表彰台エリア
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);

    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    document.getElementById('slidePodium').innerHTML = top5.map((t, i) => {
      const cls = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'pn';
      const score = t.cumulative[t.cumulative.length-1].toFixed(1);
      return `
        <div class="podium-item ${cls}">
          <div class="p-medal">${medals[i]}</div>
          <div class="p-info">
            <div class="p-name">${t.name}</div>
            <div class="p-sub">${t.memberCount}名 ・ 平均点</div>
          </div>
          <div class="p-score">${score}<small>pt</small></div>
        </div>
      `;
    }).join('');

    document.getElementById('slideRest').innerHTML =
      '<div class="rest-title">RANK 6 — ' + (5 + rest.length) + '</div>' +
      rest.map((t, i) => {
        const rank = i + 6;
        const score = t.cumulative[t.cumulative.length-1].toFixed(1);
        return `
          <div class="rest-item">
            <div class="rest-rank">${rank}</div>
            <div class="rest-name">${t.name} <span style="opacity:.5;font-weight:400">(${t.memberCount}名)</span></div>
            <div class="rest-score">${score}<small style="opacity:.5;font-size:10px">pt</small></div>
          </div>
        `;
      }).join('');
  }

  function renderMembers() {
    const sorted = [...data.members].sort((a,b) =>
      b.cumulative[b.cumulative.length-1] - a.cumulative[a.cumulative.length-1]
    );

    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5, 20); // 6-20位まで

    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    document.getElementById('slidePodium').innerHTML = top5.map((m, i) => {
      const cls = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'pn';
      const score = m.cumulative[m.cumulative.length-1].toFixed(1);
      return `
        <div class="podium-item ${cls}">
          <div class="p-medal">${medals[i]}</div>
          <div class="p-info">
            <div class="p-name">${m.name}</div>
            <div class="p-sub">${m.team_name}</div>
          </div>
          <div class="p-score">${score}<small>pt</small></div>
        </div>
      `;
    }).join('');

    const lastRank = 5 + rest.length;
    document.getElementById('slideRest').innerHTML =
      `<div class="rest-title">個人 RANK 6 — ${lastRank}</div>` +
      rest.map((m, i) => {
        const rank = i + 6;
        const score = m.cumulative[m.cumulative.length-1].toFixed(1);
        return `
          <div class="rest-item">
            <div class="rest-rank">${rank}</div>
            <div class="rest-name">${m.name} <span style="opacity:.5;font-weight:400">(${m.team_name})</span></div>
            <div class="rest-score">${score}<small style="opacity:.5;font-size:10px">pt</small></div>
          </div>
        `;
      }).join('');
  }

  window.reload = load;
  window.toggleView = function() {
    view = view === 'team' ? 'member' : 'team';
    render();
  };

  // ── 管理パネル自動フェード ──
  // マウス動作で表示、3秒無操作で消える → スクリーンショットに映らない
  let hideTimer;
  function showPanel() {
    document.body.classList.add('panel-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      document.body.classList.remove('panel-visible');
    }, 3000);
  }
  window.addEventListener('mousemove', showPanel);
  window.addEventListener('touchstart', showPanel);
  window.addEventListener('keydown', (e) => {
    // 'h' で強制非表示、't' でview切替、'r' でリロード
    if (e.key === 'h' || e.key === 'H') {
      document.body.classList.remove('panel-visible');
      clearTimeout(hideTimer);
    } else if (e.key === 't' || e.key === 'T') {
      window.toggleView();
    } else if (e.key === 'r' || e.key === 'R') {
      window.reload();
    }
  });

  load();
  // 60秒ごとに自動更新
  setInterval(load, 60000);
})();

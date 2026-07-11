// 進捗ページのメインロジック。
(function () {
  // ── 表彰式サスペンス（最終週モザイク）設定 ──
  // 8/2（第3週締切後）以降、自動で最終週の値を隠す
  // バイパス: URLに ?admin=<KEY> を付けると管理者だけ実数値を見れる
  // テスト表示: URLに ?suspense=1 を付けると即座に有効化
  const ADMIN_REVEAL_KEY = 'kuniyoshi2026';
  const SUSPENSE_AUTO_FROM = new Date('2026-08-02T00:00:00+09:00');
  const _q = new URLSearchParams(location.search);
  const isRevealed = _q.get('admin') === ADMIN_REVEAL_KEY;
  const dateBased = new Date() >= SUSPENSE_AUTO_FROM;
  const suspenseFromUrl = _q.get('suspense') === '1';
  const suspenseActive = (dateBased || suspenseFromUrl) && !isRevealed;
  window.__SUSPENSE__ = suspenseActive;

  const DATE_POINTS = [
    new Date('2026-07-13T00:00:00+09:00'),
    new Date('2026-07-19T23:59:59+09:00'),
    new Date('2026-07-26T23:59:59+09:00'),
    new Date('2026-08-02T23:59:59+09:00'),
    new Date('2026-08-12T23:59:59+09:00'), // 8/12まで延長
  ];
  const END = DATE_POINTS[DATE_POINTS.length - 1];
  const START = DATE_POINTS[0];

  const TOP5_COLORS = ['#FF3B30', '#007AFF', '#34C759', '#FF9500', '#AF52DE'];
  const GRAY = '#3a3a50';

  const labels = DATE_POINTS.map(d => `${d.getMonth()+1}/${d.getDate()}`);

  let currentView = 'team';
  let showAll = false;
  let chart = null;
  let cachedData = null;

  // ── データ取得 ─────────────────────────────
  const LOADER_START = Date.now();
  const LOADER_MIN_MS = 700; // 最低表示時間（見せてすぐ消える見た目のちらつき防止）
  let loaderHidden = false;

  async function load() {
    try {
      const data = await BNI_API.fetchProgress();
      if (!data.ok) throw new Error(data.error || 'API error');
      cachedData = data;
      render();
      hideLoading();
    } catch (e) {
      showError('データ取得に失敗しました: ' + e.message);
      hideLoading();
    }
  }

  function renderSuspenseBanner() {
    let banner = document.getElementById('suspenseBanner');
    const chartWrap = document.querySelector('.chart-wrap');
    let mask = chartWrap && chartWrap.querySelector('.chart-suspense-mask');

    if (!suspenseActive) {
      if (banner) banner.remove();
      if (mask) mask.remove();
      document.body.classList.remove('suspense');
      return;
    }
    document.body.classList.add('suspense');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'suspenseBanner';
      banner.className = 'suspense-banner';
      banner.innerHTML = '🎉 <strong>最終順位は表彰式で発表！</strong> — お楽しみに';
      const errBox = document.getElementById('errorBox');
      errBox.parentNode.insertBefore(banner, errBox.nextSibling);
    }
    // 最終週セグメント（8/2〜8/12）を覆うマスクを追加
    if (chartWrap && !mask) {
      mask = document.createElement('div');
      mask.className = 'chart-suspense-mask';
      mask.innerHTML = '<div class="sm-icon">🎉</div><div class="sm-text">最終結果は<br>表彰式で発表</div>';
      chartWrap.appendChild(mask);
    }
  }

  function hideLoading() {
    if (loaderHidden) return;
    loaderHidden = true;
    const el = document.getElementById('loadingOverlay');
    if (!el) return;
    const elapsed = Date.now() - LOADER_START;
    const wait = Math.max(0, LOADER_MIN_MS - elapsed);
    setTimeout(() => {
      el.classList.add('hidden');
      // フェード完了と同時に display:none にする
      setTimeout(() => { el.style.display = 'none'; }, 350);
    }, wait);
  }

  function showError(msg) {
    const el = document.getElementById('errorBox');
    el.textContent = msg;
    el.style.display = 'block';
  }

  // ── ヘッダー描画 ─────────────────────────
  function renderHeader() {
    const now = new Date();
    const total = END - START;
    const elapsed = Math.max(0, Math.min(total, now - START));
    const pct = Math.round(elapsed / total * 100);
    const daysLeft = Math.max(0, Math.ceil((END - now) / 86400000));

    const currentWeek = (() => {
      for (let i = 0; i < 4; i++) {
        if (now <= DATE_POINTS[i + 1]) return i + 1;
      }
      return 4;
    })();

    document.getElementById('daysLeft').textContent = daysLeft;
    document.getElementById('weekNum').textContent = currentWeek;
    document.getElementById('pctLabel').textContent = pct + '%';
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('teamCount').textContent = cachedData.teams.length;
    document.getElementById('memberCount').textContent = cachedData.members.length;
    document.getElementById('progressLabel').textContent =
      `ゲーム進捗（第${currentWeek}週 / 全4週）`;
  }

  // ── データセット構築 ─────────────────────
  function buildTeamDatasets() {
    const teams = [...cachedData.teams].sort((a, b) =>
      b.cumulative[b.cumulative.length - 1] - a.cumulative[a.cumulative.length - 1]
    );
    return teams.map((t, rank) => ({
      label: t.name,
      memberCount: t.memberCount,
      data: t.cumulative,
      borderColor:      rank < 5 ? TOP5_COLORS[rank] : GRAY,
      backgroundColor:  rank < 5 ? TOP5_COLORS[rank] + '20' : GRAY + '10',
      borderWidth:      rank < 5 ? 3.5 : 1,
      pointRadius:      rank < 5 ? 6 : 2,
      pointHoverRadius: rank < 5 ? 9 : 4,
      pointBorderWidth: rank < 5 ? 2 : 0,
      pointBorderColor: '#09090f',
      tension: 0.4,
      fill: false,
      order: rank < 5 ? 5 - rank : 0,
      _rank: rank,
    }));
  }

  function buildMemberDatasets() {
    const members = [...cachedData.members].sort((a, b) =>
      b.cumulative[b.cumulative.length - 1] - a.cumulative[a.cumulative.length - 1]
    );
    return members.map((m, rank) => ({
      label: m.name,
      team: m.team_name,
      data: m.cumulative,
      borderColor:      rank < 5 ? TOP5_COLORS[rank] : GRAY,
      backgroundColor:  rank < 5 ? TOP5_COLORS[rank] + '20' : GRAY + '10',
      borderWidth:      rank < 5 ? 3.5 : 1,
      pointRadius:      rank < 5 ? 6 : 2,
      pointHoverRadius: rank < 5 ? 9 : 4,
      pointBorderWidth: rank < 5 ? 2 : 0,
      pointBorderColor: '#09090f',
      tension: 0.4,
      fill: false,
      order: rank < 5 ? 5 - rank : 0,
      _rank: rank,
    }));
  }

  function getDatasets() {
    const src = currentView === 'team' ? buildTeamDatasets() : buildMemberDatasets();
    if (showAll) return src;
    return src.map(d => ({
      ...d,
      borderColor: d._rank < 5 ? d.borderColor : GRAY + '55',
      pointRadius: d._rank < 5 ? d.pointRadius : 0,
    }));
  }

  // ── アニメーション ────────────────────────
  function buildAnim() {
    const DUR = 1600;
    const dl = DUR / labels.length;
    const prevY = (ctx) => {
      if (ctx.index === 0) return ctx.chart.scales.y.getPixelForValue(0);
      const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex);
      const prev = meta && meta.data && meta.data[ctx.index - 1];
      if (!prev || typeof prev.getProps !== 'function') {
        return ctx.chart.scales.y.getPixelForValue(0);
      }
      return prev.getProps(['y'], true).y;
    };
    return {
      x: {
        type: 'number', easing: 'easeInOutQuart', duration: dl, from: NaN,
        delay(ctx) { if (ctx.type !== 'data' || ctx.xStarted) return 0; ctx.xStarted = true; return ctx.index * dl; }
      },
      y: {
        type: 'number', easing: 'easeInOutQuart', duration: dl, from: prevY,
        delay(ctx) { if (ctx.type !== 'data' || ctx.yStarted) return 0; ctx.yStarted = true; return ctx.index * dl; }
      }
    };
  }

  // ── チャート ────────────────────────────
  function createChart(datasets) {
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('mainChart'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animations: buildAnim(),
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8,8,12,.96)',
            borderColor: 'rgba(255,255,255,.08)', borderWidth: 1,
            titleColor: 'rgba(255,255,255,.9)',
            bodyColor: 'rgba(255,255,255,.65)',
            padding: 12,
            filter: item => {
              const d = datasets[item.datasetIndex];
              return showAll || d._rank < 5;
            },
            callbacks: {
              title: ctx => {
                const d = DATE_POINTS[ctx[0].dataIndex];
                const wLabels = ['開始日', '第1週締め', '第2週締め', '第3週締め', '第4週締め（最終日）'];
                return `${d.getMonth()+1}/${d.getDate()} — ${wLabels[ctx[0].dataIndex]}`;
              },
              label: ctx => `  ${ctx.dataset.label}：${ctx.parsed.y.toFixed(1)} pt`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,.04)', drawBorder: false },
            ticks: { color: 'rgba(255,255,255,.5)', font: { size: 12, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,.06)', drawBorder: false },
            ticks: { color: 'rgba(255,255,255,.4)', font: { size: 11 }, callback: v => v + 'pt' },
            title: { display: true, text: '累積スコア（平均）', color: 'rgba(255,255,255,.25)', font: { size: 11 } }
          }
        }
      }
    });
  }

  function renderRanking(datasets) {
    const isTeam = currentView === 'team';
    const sorted = [...datasets].sort((a, b) =>
      b.data[b.data.length - 1] - a.data[a.data.length - 1]
    );
    document.getElementById('rankingList').innerHTML = sorted.map((d, i) => {
      const scoreVal = d.data[d.data.length-1].toFixed(1);
      const scoreDisplay = suspenseActive
        ? `<span class="rank-masked">${scoreVal}</span><span>pt</span>`
        : `${scoreVal}<span>pt</span>`;
      const rankDisplay = suspenseActive
        ? `<span class="rank-masked-num">${i+1}</span>`
        : (i+1);
      return `
      <div class="rank-item ${i===0?'r1':i===1?'r2':i===2?'r3':''}">
        <div class="rnum ${i===0?'g':i===1?'s':i===2?'b':''}">${rankDisplay}</div>
        <div class="rdot" style="background:${d._rank<5?d.borderColor:GRAY}"></div>
        <div class="rinfo">
          <div class="rname">${d.label}</div>
          <div class="rsub">${isTeam ? d.memberCount+'名・平均点' : d.team}</div>
        </div>
        <div class="rscore">${scoreDisplay}</div>
      </div>
    `;
    }).join('');
  }

  function renderLegend(datasets) {
    const top5 = [...datasets].sort((a, b) =>
      b.data[b.data.length - 1] - a.data[a.data.length - 1]
    ).slice(0, 5);
    const others = datasets.length - 5;
    document.getElementById('customLegend').innerHTML =
      `<span style="font-size:11px;color:rgba(255,255,255,.25);margin-right:8px;">TOP5:</span>` +
      top5.map(d => `
        <div class="leg-item">
          <div class="leg-dot" style="background:${d.borderColor}"></div>
          <span>${d.label}</span>
        </div>
      `).join('') +
      (showAll ? '' : `<span style="font-size:11px;color:rgba(255,255,255,.2);margin-left:4px;">+ 他${others}${currentView==='team'?'チーム':'名'}（薄表示）</span>`);
  }

  function render() {
    renderHeader();
    renderSuspenseBanner();
    const ds = currentView === 'team' ? buildTeamDatasets() : buildMemberDatasets();
    createChart(getDatasets());
    renderRanking(ds);
    renderLegend(ds);
    const label = currentView === 'team'
      ? `現在の順位（${cachedData.teams.length}チーム）`
      : `個人ランキング（${cachedData.members.length}名）`;
    document.getElementById('rankLabel').textContent = label;
  }

  // ── UI 操作 ───────────────────────────────
  window.switchView = function(view, btn) {
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = view;
    const isTeam = view === 'team';
    document.getElementById('chartTitle').textContent = isTeam ? 'チームスコア推移（平均点）' : '個人スコア推移';
    document.getElementById('chartSub').textContent = isTeam ? '毎週日曜23:59時点での累積平均スコア' : 'メンバー別の累積スコア推移';
    render();
  };

  window.toggleFilter = function() {
    showAll = !showAll;
    const btn = document.getElementById('filterBtn');
    if (showAll) {
      btn.textContent = '全' + (currentView === 'team' ? 'チーム' : 'メンバー') + '表示中';
      btn.classList.remove('active-filter');
    } else {
      btn.textContent = 'TOP5 強調表示中';
      btn.classList.add('active-filter');
    }
    render();
  };

  window.reloadChart = function() {
    load();
  };

  // ── 初期化 & 自動更新 ───────────────────
  load();
  setInterval(load, window.BNI_CONFIG.REFRESH_INTERVAL_MS);
})();

// 入力ページのロジック
(function () {
  const params = new URLSearchParams(location.search);
  const TOKEN = params.get('team');

  let state = null;      // 現在のチームデータ
  let currentTab = null; // 履歴で表示中の週

  if (!TOKEN) {
    showInvalidToken('team パラメータが指定されていません。リーダーに配布されたURLからアクセスしてください。');
    return;
  }

  // ── 初期化 ─────────────────────────────
  async function load() {
    try {
      const data = await BNI_API.fetchTeam(TOKEN);
      if (!data.ok) {
        if (data.error === 'invalid_token') {
          showInvalidToken('チームトークンが無効です。リーダーに確認してください。');
          return;
        }
        throw new Error(data.error);
      }
      state = data;
      currentTab = data.current_week || 1;
      render();
    } catch (e) {
      showError('データ取得に失敗しました: ' + e.message);
    }
  }

  function showInvalidToken(msg) {
    document.body.innerHTML = `
      <div class="invalid-token">
        <h2>⚠ アクセスできません</h2>
        <p>${msg}</p>
      </div>
    `;
  }

  function showError(msg) {
    const el = document.getElementById('errorBox');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  // ── 描画 ───────────────────────────────
  function render() {
    document.getElementById('teamName').textContent = state.team.name;
    document.getElementById('teamSub').textContent =
      `${state.members.length}名｜チームリーダー入力画面｜現在: 第${state.current_week || '?'}週`;

    renderWeekBanner();
    renderScoreCards();
    renderMemberOptions();
    renderActivityGrid();
    renderHistory();
  }

  // 週の期限表示（何週目か・締切日）
  const WEEK_ENDS_DISPLAY = ['7/19（日）', '7/26（日）', '8/2（日）', '8/12（水）'];

  function renderWeekBanner() {
    const el = document.getElementById('weekBanner');
    if (!el) return;
    const cw = state.current_week;
    if (!cw || cw < 1 || cw > 4) {
      el.className = 'week-banner closed';
      el.innerHTML = `
        <div class="wb-icon">⛔</div>
        <div class="wb-body">
          <div class="wb-title">ゲーム期間外です</div>
          <div class="wb-sub">現在は入力できません（期間: 7/13〜8/12）</div>
        </div>`;
      return;
    }
    el.className = 'week-banner open';
    el.innerHTML = `
      <div class="wb-icon">📝</div>
      <div class="wb-body">
        <div class="wb-title">現在受付中：第${cw}週</div>
        <div class="wb-sub">この入力は<strong style="color:#fff">第${cw}週の記録</strong>として保存されます｜締切: ${WEEK_ENDS_DISPLAY[cw-1]} 23:59</div>
      </div>`;
  }

  const WEEK_DATES = ['7/13〜7/19', '7/20〜7/26', '7/27〜8/2', '8/3〜8/12'];

  function renderScoreCards() {
    const wrap = document.getElementById('scoreCards');
    const cw = state.current_week || 0;
    let html = '';
    for (let w = 1; w <= 4; w++) {
      const bucket = state.weekly && state.weekly[w];
      const val = bucket ? bucket.teamAverage : 0;
      const count = bucket ? bucket.activeMemberCount : state.members.length;
      const sign = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
      let statusClass = 'future';
      let statusLabel = '予定';
      if (cw > 0) {
        if (w < cw)      { statusClass = 'past';    statusLabel = '締切済'; }
        else if (w === cw) { statusClass = 'current'; statusLabel = '📝 受付中'; }
      } else if (cw === 0) {
        statusClass = 'future';
        statusLabel = '予定';
      }
      html += `
        <div class="score-card sc-card ${statusClass}">
          <div class="sc-badge">${statusLabel}</div>
          <div class="sc-week">第${w}週<span class="sc-dates">${WEEK_DATES[w-1]}</span></div>
          <div class="sc-value ${sign}">${val > 0 ? '+' : ''}${val.toFixed(1)}<small style="font-size:12px">pt</small></div>
          <div class="sc-members">${count}名参加</div>
        </div>
      `;
    }
    wrap.innerHTML = html;
  }

  function renderMemberOptions() {
    const sel = document.getElementById('memberSelect');
    sel.innerHTML = '<option value="">選択してください</option>' +
      state.members.map(m =>
        `<option value="${m.member_id}"${m.withdrew_week ? ' disabled' : ''}>${m.name}${m.withdrew_week ? '（退場）' : ''}</option>`
      ).join('');
  }

  // 管理者側で集計する項目はチームリーダーの入力プルダウンから除外
  const LEADER_INPUT_EXCLUDED = ['absent', 'late', 'testimonial', 'visitor'];

  function renderActivityGrid() {
    const grid = document.getElementById('activityGrid');
    if (!grid) return;
    const memberId = document.getElementById('memberSelect').value;
    const currentWeek = state.current_week;
    const disabled = !memberId || !currentWeek || currentWeek < 1;

    const keys = Object.keys(state.activities).filter(k => !LEADER_INPUT_EXCLUDED.includes(k));
    grid.innerHTML = keys.map(key => {
      const a = state.activities[key];
      const points = (a.sign === '-' ? -a.points : a.points);
      const sign = points >= 0 ? '+' : '';
      const cls = points >= 0 ? 'positive' : 'negative';
      const weekCount = disabled ? 0 : state.scores.filter(s =>
        String(s.member_id) === String(memberId) &&
        s.activity === key &&
        Number(s.week) === Number(currentWeek)
      ).reduce((acc, s) => acc + Number(s.count || 0), 0);

      return `
        <button class="activity-tile ${cls}${weekCount > 0 ? ' has-count' : ''}"
                data-activity="${key}"
                onclick="tapActivity('${key}')"
                ${disabled ? 'disabled' : ''}>
          ${weekCount > 0 ? `<div class="tile-count-badge">今週 ${weekCount}件</div>` : ''}
          <div class="tile-name">${a.label}</div>
          <div class="tile-points">${sign}${points}<small>P</small></div>
          <div class="tile-cta">＋ タップで加算</div>
        </button>
      `;
    }).join('');

    const hint = document.getElementById('tapHint');
    if (hint) hint.style.display = disabled ? 'none' : 'block';
  }

  window.onMemberChange = function() {
    renderActivityGrid();
  };

  function renderHistory() {
    // 週タブ（過去週には「締」マーカー、現在週は緑枠）
    const cw = state.current_week || 0;
    const tabs = document.getElementById('weekTabs');
    tabs.innerHTML = [1,2,3,4].map(w => {
      const past = cw > 0 && w < cw;
      const isCurrent = w === cw;
      const cls = `wtab ${w === currentTab ? 'active' : ''} ${past ? 'past' : ''} ${isCurrent ? 'current' : ''}`;
      return `<button class="${cls}" onclick="switchWeekTab(${w})">第${w}週</button>`;
    }).join('');

    const list = document.getElementById('historyList');
    const filtered = state.scores.filter(s => s.week === currentTab);

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-history">この週の入力はまだありません</div>';
      return;
    }

    // 新しい順
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    list.innerHTML = filtered.map(s => {
      const m = state.members.find(mm => String(mm.member_id) === String(s.member_id));
      const a = state.activities[s.activity];
      return `
        <div class="hist-item">
          <div class="hist-member">${m ? m.name : '?'}</div>
          <div class="hist-act">${a ? a.label : s.activity}</div>
          <div class="hist-count">×${s.count}</div>
          <div class="hist-pts ${s.points >= 0 ? 'p' : 'n'}">${s.points > 0 ? '+' : ''}${s.points}P</div>
          <button class="hist-del" onclick="deleteScore('${s.id}')">削除</button>
        </div>
      `;
    }).join('');
  }

  // ── タップで即記録 ────────────────────
  let tapInFlight = false;
  async function tapActivity(activity) {
    if (tapInFlight) return;
    const memberId = document.getElementById('memberSelect').value;
    if (!memberId) { toast('メンバーを選択してください', 'error'); return; }
    if (!state.current_week || state.current_week < 1) {
      toast('現在は入力できません', 'error'); return;
    }
    const a = state.activities[activity];
    if (!a) return;

    const tile = document.querySelector(`.activity-tile[data-activity="${activity}"]`);
    if (tile) tile.classList.add('submitting');
    tapInFlight = true;

    try {
      const res = await BNI_API.submit({
        token: TOKEN,
        member_id: memberId,
        activity: activity,
        count: 1,
        target_week: state.current_week,
      });
      if (!res.ok) throw new Error(translateError(res.error));
      const points = a.sign === '-' ? -a.points : a.points;
      toast(`✓ ${a.label} ${points >= 0 ? '+' : ''}${points}P`, 'success');
      await load();
    } catch (e) {
      toast('送信失敗: ' + e.message, 'error');
    } finally {
      if (tile) tile.classList.remove('submitting');
      tapInFlight = false;
    }
  }

  // ── 削除 ───────────────────────────────
  async function deleteScore(scoreId) {
    if (!confirm('この記録を削除しますか？')) return;
    try {
      const res = await BNI_API.deleteScore({ token: TOKEN, score_id: scoreId });
      if (!res.ok) throw new Error(res.error || 'delete failed');
      toast('✓ 削除しました', 'success');
      await load();
    } catch (e) {
      toast('削除失敗: ' + e.message, 'error');
    }
  }

  // ── エラーメッセージ日本語化 ─────────
  function translateError(code) {
    switch (code) {
      case 'week_closed':        return '入力期限が過ぎています';
      case 'week_not_open_yet':  return 'まだ入力できません（次週の開始をお待ちください）';
      case 'out_of_game_period': return 'ゲーム期間外です（7/13〜8/12）';
      case 'invalid_week':       return '対象週が不正です';
      case 'invalid_token':      return 'トークンが無効です';
      case 'invalid_activity':   return '活動区分が不正です';
      case 'invalid_member':     return 'メンバーが不正です';
      default:                   return code || '送信に失敗しました';
    }
  }

  // ── トースト ──────────────────────────
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind === 'error' ? 'error' : 'success');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ── expose to inline handlers ────────
  window.switchWeekTab = function(w) { currentTab = w; renderHistory(); };
  window.deleteScore  = deleteScore;
  window.tapActivity  = tapActivity;

  load();
})();

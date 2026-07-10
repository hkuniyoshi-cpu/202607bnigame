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

    renderScoreCards();
    renderMemberOptions();
    renderActivityOptions();
    renderHistory();
    updatePreview();
  }

  function renderScoreCards() {
    const wrap = document.getElementById('scoreCards');
    let html = '';
    for (let w = 1; w <= 4; w++) {
      const bucket = state.weekly && state.weekly[w];
      const val = bucket ? bucket.teamAverage : 0;
      const count = bucket ? bucket.activeMemberCount : state.members.length;
      const isCurrent = w === state.current_week;
      const sign = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
      html += `
        <div class="score-card sc-card ${isCurrent ? 'current' : ''}">
          <div class="sc-week">第${w}週</div>
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
  const LEADER_INPUT_EXCLUDED = ['absent', 'late', 'testimonial'];

  function renderActivityOptions() {
    const sel = document.getElementById('activitySelect');
    sel.innerHTML = '<option value="">選択してください</option>' +
      Object.keys(state.activities)
        .filter(key => !LEADER_INPUT_EXCLUDED.includes(key))
        .map(key => {
          const a = state.activities[key];
          const sign = a.sign === '-' ? '−' : '+';
          return `<option value="${key}">${a.label}（${sign}${a.points}P）</option>`;
        }).join('');
  }

  function renderHistory() {
    // 週タブ
    const tabs = document.getElementById('weekTabs');
    tabs.innerHTML = [1,2,3,4].map(w =>
      `<button class="wtab ${w === currentTab ? 'active' : ''}" onclick="switchWeekTab(${w})">第${w}週</button>`
    ).join('');

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

  // ── ライブプレビュー ──────────────────
  function updatePreview() {
    const activity = document.getElementById('activitySelect').value;
    const count    = parseInt(document.getElementById('countInput').value, 10) || 0;
    const preview  = document.getElementById('preview');

    if (!activity || count <= 0) {
      preview.classList.remove('show');
      return;
    }
    const a = state.activities[activity];
    const raw = a.points * count;
    const pts = a.sign === '-' ? -raw : raw;
    preview.textContent = `→ 加算予定: ${pts > 0 ? '+' : ''}${pts} P`;
    preview.classList.toggle('negative', pts < 0);
    preview.classList.add('show');
  }

  // ── 送信 ───────────────────────────────
  async function submit() {
    const member_id = document.getElementById('memberSelect').value;
    const activity  = document.getElementById('activitySelect').value;
    const count     = parseInt(document.getElementById('countInput').value, 10) || 0;

    if (!member_id || !activity || count <= 0) {
      toast('メンバー・活動・件数を全て入力してください', 'error');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中...';

    try {
      const res = await BNI_API.submit({ token: TOKEN, member_id, activity, count });
      if (!res.ok) throw new Error(res.error || 'submit failed');
      toast('✓ 記録しました', 'success');
      // フォームリセット
      document.getElementById('memberSelect').value = '';
      document.getElementById('activitySelect').value = '';
      document.getElementById('countInput').value = 1;
      updatePreview();
      await load();
    } catch (e) {
      toast('送信失敗: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '記録する';
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
  window.submitForm   = submit;
  window.updatePreview = updatePreview;

  load();
})();

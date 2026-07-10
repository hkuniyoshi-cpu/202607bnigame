// GAS Web App クライアント。fetch のラッパー。
(function () {
  const API = window.BNI_CONFIG.GAS_API_URL;

  async function getJSON(params) {
    const url = new URL(API);
    Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function postJSON(body) {
    // GAS Web App は Content-Type: application/json だと preflight で失敗するので
    // text/plain で送る。GAS 側は e.postData.contents を JSON.parse する。
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  window.BNI_API = {
    fetchProgress: ()          => getJSON({ action: 'progress' }),
    fetchTeam:     (token)     => getJSON({ action: 'team', token: token }),
    submit:        (body)      => postJSON(Object.assign({ action: 'submit' }, body)),
    deleteScore:   (body)      => postJSON(Object.assign({ action: 'delete' }, body)),
  };
})();

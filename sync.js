/* The Big Picture Library — cross-device highlight sync
   Single-user design: highlights live in a secret GitHub gist.
   Each device needs a one-time paste of a classic GitHub token ("gist" scope).
   On page load: pull gist → merge with local → write back local.
   On any change: debounced pull-merge-push. Deletions sync via tombstones. */
(function () {
  const HKEY = 'bpl-highlights';
  const TKEY = 'bpl-tombstones';
  const CKEY = 'bpl-sync';
  const LKEY = 'bpl-sync-last';
  const FILE = 'bpl-highlights.json';
  const API = 'https://api.github.com';

  const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const localDoc = () => ({ highlights: j(HKEY, []), tombstones: j(TKEY, {}) });
  const writeLocal = (doc) => {
    localStorage.setItem(HKEY, JSON.stringify(doc.highlights));
    localStorage.setItem(TKEY, JSON.stringify(doc.tombstones));
  };
  const cfg = () => j(CKEY, null);

  function mergeDocs(a, b) {
    const tombstones = { ...(a.tombstones || {}) };
    for (const [id, ts] of Object.entries(b.tombstones || {}))
      tombstones[id] = Math.max(ts, tombstones[id] || 0);
    const map = new Map();
    for (const h of [...(a.highlights || []), ...(b.highlights || [])]) {
      const prev = map.get(h.id);
      if (!prev || (h.mts || h.ts) > (prev.mts || prev.ts)) map.set(h.id, h);
    }
    for (const id of Object.keys(tombstones)) map.delete(id);
    return { highlights: [...map.values()].sort((x, y) => x.ts - y.ts), tombstones };
  }

  async function api(path, opts = {}) {
    const c = cfg();
    const res = await fetch(API + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + (opts.token || (c && c.token)),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    if (!res.ok) throw new Error('GitHub ' + res.status);
    return res.json();
  }

  async function fetchRemote() {
    const c = cfg();
    const gist = await api('/gists/' + c.gistId);
    const f = gist.files && gist.files[FILE];
    if (!f) return { highlights: [], tombstones: {} };
    const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    try { return JSON.parse(text) || { highlights: [], tombstones: {} }; }
    catch { return { highlights: [], tombstones: {} }; }
  }

  async function patchRemote(doc) {
    const c = cfg();
    await api('/gists/' + c.gistId, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(doc) } } })
    });
    localStorage.setItem(LKEY, String(Date.now()));
  }

  let syncing = false, queued = false;
  async function syncNow() {
    if (!cfg()) return;
    if (syncing) { queued = true; return; }
    syncing = true;
    try {
      const merged = mergeDocs(localDoc(), await fetchRemote());
      writeLocal(merged);
      await patchRemote(merged);
    } catch (e) { /* offline or token revoked — retry on next change/load */ }
    syncing = false;
    if (queued) { queued = false; syncNow(); }
  }

  let pushTimer;
  function push() {
    if (!cfg()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, 1200);
  }

  /* one-time device setup: find this user's sync gist by filename, or create it */
  async function setup(token) {
    token = token.trim();
    const gists = await api('/gists?per_page=100', { token });
    let gist = gists.find(g => g.files && g.files[FILE]);
    if (!gist) {
      gist = await api('/gists', {
        method: 'POST', token,
        body: JSON.stringify({
          description: 'Big Picture Library — highlight sync',
          public: false,
          files: { [FILE]: { content: JSON.stringify(localDoc()) } }
        })
      });
    }
    localStorage.setItem(CKEY, JSON.stringify({ token, gistId: gist.id }));
    await syncNow();
  }

  function disconnect() {
    localStorage.removeItem(CKEY);
    localStorage.removeItem(LKEY);
  }

  /* initial pull: resolves once local storage reflects the merged state
     (or promptly if unconfigured/offline) — highlighter waits on this */
  const ready = (async () => {
    if (!cfg()) return;
    try {
      const merged = mergeDocs(localDoc(), await Promise.race([
        fetchRemote(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]));
      writeLocal(merged);
      localStorage.setItem(LKEY, String(Date.now()));
    } catch (e) { /* proceed with local copy */ }
  })();

  window.bplSync = {
    ready, push, setup, disconnect,
    enabled: () => !!cfg(),
    lastSync: () => Number(localStorage.getItem(LKEY)) || null,
    tomb(id) {
      const t = j(TKEY, {});
      t[id] = Date.now();
      localStorage.setItem(TKEY, JSON.stringify(t));
    }
  };
})();

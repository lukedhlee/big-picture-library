/* The Big Picture Library — highlighter + margin notes
   Select text in an article → highlight it, optionally with a note.
   Notes render as marginalia in the right rail (wide screens) and in the
   click popover. Persists in localStorage, re-anchored by text + context. */
(function () {
  const article = document.querySelector('article');
  if (!article) return;
  const wrap = document.querySelector('.article-wrap') || document.body;

  const KEY = 'bpl-highlights';
  const rel = (location.pathname.split('/big-picture-library/')[1] || location.pathname.split('/').pop());
  const pageTitle = document.title.replace(/\s*—\s*The Big Picture Library\s*$/, '');

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = (items) => {
    localStorage.setItem(KEY, JSON.stringify(items));
    if (window.bplSync) window.bplSync.push();
  };
  const tomb = (id) => { if (window.bplSync) window.bplSync.tomb(id); };

  /* ---------- anchoring ---------- */

  function offsetsOf(range) {
    const pre = range.cloneRange();
    pre.selectNodeContents(article);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    return [start, start + range.toString().length];
  }

  function findStart(text, prefix, suffix) {
    const full = article.textContent;
    let best = -1, bestScore = -1, i = full.indexOf(text);
    while (i !== -1) {
      let score = 0;
      if (prefix && full.slice(Math.max(0, i - prefix.length), i) === prefix) score += 2;
      if (suffix && full.slice(i + text.length, i + text.length + suffix.length) === suffix) score += 2;
      if (score > bestScore) { bestScore = score; best = i; }
      i = full.indexOf(text, i + 1);
    }
    return best;
  }

  function rangeFromOffsets(start, end) {
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let pos = 0, n, started = false;
    while ((n = walker.nextNode())) {
      const next = pos + n.textContent.length;
      if (!started && start >= pos && start < next) { range.setStart(n, start - pos); started = true; }
      if (started && end > pos && end <= next) { range.setEnd(n, end - pos); return range; }
      pos = next;
    }
    return null;
  }

  function wrapRange(range, id) {
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (range.intersectsNode(n) && n.textContent.length) nodes.push(n);
    }
    for (const node of nodes) {
      const s = (node === range.startContainer) ? range.startOffset : 0;
      const e = (node === range.endContainer) ? range.endOffset : node.textContent.length;
      if (e <= s) continue;
      let mid = node;
      if (s > 0) mid = node.splitText(s);
      if (e - s < mid.textContent.length) mid.splitText(e - s);
      const mark = document.createElement('mark');
      mark.className = 'hl';
      mark.dataset.hlId = id;
      mid.parentNode.replaceChild(mark, mid);
      mark.appendChild(mid);
    }
  }

  function unwrap(id) {
    document.querySelectorAll(`mark.hl[data-hl-id="${id}"]`).forEach(m => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }

  function setNoted(id, note) {
    const marks = [...document.querySelectorAll(`mark.hl[data-hl-id="${id}"]`)];
    marks.forEach((m, i) => {
      m.classList.toggle('hl-noted', !!note);
      /* a highlight spanning italics/links is several mark fragments —
         only the last one carries the ✎ pencil */
      m.classList.toggle('hl-note-anchor', !!note && i === marks.length - 1);
    });
  }

  /* ---------- margin notes (right rail) ---------- */

  function renderMarginNotes() {
    wrap.querySelectorAll('.margin-note').forEach(el => el.remove());
    const wrapRect = wrap.getBoundingClientRect();
    const artRect = article.getBoundingClientRect();
    const avail = wrapRect.right - artRect.right - 36;
    if (avail < 140) return;  /* no rail on narrow screens — popover still shows notes */
    const width = Math.min(avail, 240);

    const noted = load().filter(h => h.rel === rel && h.note);
    const entries = [];
    for (const h of noted) {
      const mark = document.querySelector(`mark.hl[data-hl-id="${h.id}"]`);
      if (!mark) continue;
      entries.push({ h, top: mark.getBoundingClientRect().top - wrapRect.top });
    }
    entries.sort((a, b) => a.top - b.top);

    let lastBottom = -Infinity;
    for (const { h, top } of entries) {
      const el = document.createElement('div');
      el.className = 'margin-note';
      el.textContent = h.note;
      el.style.left = (artRect.right - wrapRect.left + 28) + 'px';
      el.style.width = width + 'px';
      const y = Math.max(top, lastBottom + 10);
      el.style.top = y + 'px';
      el.onclick = (e) => {
        e.stopPropagation();
        const mark = document.querySelector(`mark.hl[data-hl-id="${h.id}"]`);
        if (!mark) return;
        const r = mark.getBoundingClientRect();
        openEditor(h.id, r.left + r.width / 2 + scrollX, r.bottom + scrollY);
      };
      wrap.appendChild(el);
      lastBottom = y + el.offsetHeight;
    }
  }

  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderMarginNotes, 150); });

  /* ---------- floating toolbar ---------- */

  const bar = document.createElement('div');
  bar.className = 'hl-toolbar';
  document.body.appendChild(bar);

  function showBar(x, y, actions, noteText, below) {
    bar.innerHTML = '';
    if (noteText) {
      const note = document.createElement('div');
      note.className = 'hl-tb-note';
      note.textContent = noteText;
      bar.appendChild(note);
    }
    const row = document.createElement('div');
    row.className = 'hl-tb-row';
    for (const a of actions) {
      const b = document.createElement('span');
      b.className = 'hl-tb-btn';
      b.textContent = a.label;
      b.onclick = (e) => { e.stopPropagation(); hideBar(); a.fn(); };
      /* iOS: act on touchend directly — the synthetic click can get
         swallowed while a text selection is active */
      b.addEventListener('touchend', (e) => {
        e.preventDefault(); e.stopPropagation(); hideBar(); a.fn();
      });
      row.appendChild(b);
    }
    bar.appendChild(row);
    bar.style.display = 'block';
    const w = bar.offsetWidth;
    bar.style.left = Math.max(8, Math.min(x - w / 2, scrollX + innerWidth - w - 8)) + 'px';
    bar.style.top = Math.max(8, below ? y + 12 : y - bar.offsetHeight - 10) + 'px';
  }
  function hideBar() { bar.style.display = 'none'; }

  /* ---------- note editor ---------- */

  const editor = document.createElement('div');
  editor.className = 'hl-note-editor';
  editor.innerHTML =
    '<div class="hl-ne-label">Your note</div>' +
    '<textarea placeholder="Why did this sentence stop you?"></textarea>' +
    '<div class="hl-ne-row">' +
    '<span class="hl-btn hl-btn-small" data-act="save">Save</span>' +
    '<span class="hl-btn hl-btn-small" data-act="cancel">Cancel</span>' +
    '<span class="hl-btn hl-btn-small hl-btn-danger" data-act="delnote">Delete note</span>' +
    '</div>';
  editor.style.display = 'none';
  document.body.appendChild(editor);
  const ta = editor.querySelector('textarea');
  let editorId = null;

  function openEditor(id, x, y) {
    const item = load().find(h => h.id === id);
    if (!item) return;
    editorId = id;
    ta.value = item.note || '';
    editor.querySelector('[data-act="delnote"]').style.display = item.note ? '' : 'none';
    editor.style.display = 'block';
    const w = editor.offsetWidth;
    editor.style.left = Math.max(8, Math.min(x - w / 2, scrollX + innerWidth - w - 8)) + 'px';
    editor.style.top = (y + 14) + 'px';
    ta.focus();
  }
  function closeEditor() { editor.style.display = 'none'; editorId = null; }

  ['mousedown', 'mouseup', 'click'].forEach(ev =>
    editor.addEventListener(ev, e => e.stopPropagation()));

  editor.querySelector('[data-act="save"]').onclick = () => {
    const items = load();
    const it = items.find(h => h.id === editorId);
    if (it) { it.note = ta.value.trim(); it.mts = Date.now(); save(items); setNoted(it.id, it.note); renderMarginNotes(); }
    closeEditor();
  };
  editor.querySelector('[data-act="cancel"]').onclick = closeEditor;
  editor.querySelector('[data-act="delnote"]').onclick = () => {
    const items = load();
    const it = items.find(h => h.id === editorId);
    if (it) { it.note = ''; it.mts = Date.now(); save(items); setNoted(it.id, ''); renderMarginNotes(); }
    closeEditor();
  };

  /* ---------- create / interact ---------- */

  function createHighlight(range) {
    const [start, end] = offsetsOf(range);
    const full = article.textContent;
    const item = {
      id: 'hl-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      rel, title: pageTitle,
      text: full.slice(start, end),
      prefix: full.slice(Math.max(0, start - 40), start),
      suffix: full.slice(end, end + 40),
      note: '',
      ts: Date.now()
    };
    wrapRange(range, item.id);
    save(load().concat(item));
    return item;
  }

  function offerHighlight(below) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!article.contains(range.commonAncestorContainer)) return;
    const text = range.toString();
    if (!text.trim() || text.length > 2000) return;
    const stored = range.cloneRange();
    const r = range.getBoundingClientRect();
    const x = r.left + r.width / 2 + scrollX, yTop = r.top + scrollY, yBot = r.bottom + scrollY;
    showBar(x, below ? yBot : yTop, [
      { label: '✦ Highlight', fn: () => { createHighlight(stored); sel.removeAllRanges(); } },
      { label: '✎ Highlight + note', fn: () => {
          const item = createHighlight(stored);
          sel.removeAllRanges();
          openEditor(item.id, x, yBot);
        } }
    ], null, below);
  }

  document.addEventListener('mouseup', (e) => {
    if (bar.contains(e.target) || editor.contains(e.target)) return;
    setTimeout(() => offerHighlight(false), 0);
  });

  /* touch devices: selection happens via handles, not mouse events —
     watch the selection itself and offer the bar below it (the native
     iOS callout sits above) */
  if ('ontouchstart' in window) {
    let selTimer;
    document.addEventListener('selectionchange', () => {
      clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) { return; }
        offerHighlight(true);
      }, 350);
    });
  }

  document.addEventListener('click', (e) => {
    if (bar.contains(e.target) || editor.contains(e.target)) return;
    const mark = e.target.closest && e.target.closest('mark.hl');
    if (!mark) return;
    const id = mark.dataset.hlId;
    const item = load().find(h => h.id === id);
    const r = mark.getBoundingClientRect();
    const x = r.left + r.width / 2 + scrollX, yTop = r.top + scrollY, yBot = r.bottom + scrollY;
    showBar(x, yTop, [
      { label: (item && item.note) ? '✎ Edit note' : '✎ Add note', fn: () => openEditor(id, x, yBot) },
      { label: '✕ Remove', fn: () => { unwrap(id); tomb(id); save(load().filter(h => h.id !== id)); renderMarginNotes(); } }
    ], item && item.note);
  });

  ['mousedown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, (e) => {
      if (!bar.contains(e.target)) hideBar();
      if (!editor.contains(e.target)) closeEditor();
    }));

  /* ---------- restore on load (after the sync pull, if configured) ---------- */

  function restore() {
    load().filter(h => h.rel === rel).forEach(h => {
      const start = findStart(h.text, h.prefix, h.suffix);
      if (start === -1) return;
      const range = rangeFromOffsets(start, start + h.text.length);
      if (range) { wrapRange(range, h.id); if (h.note) setNoted(h.id, h.note); }
    });
    renderMarginNotes();
  }
  if (window.bplSync) window.bplSync.ready.then(restore, restore);
  else restore();
  /* reposition after fonts load (layout shifts) */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderMarginNotes);
  addEventListener('load', renderMarginNotes);
})();

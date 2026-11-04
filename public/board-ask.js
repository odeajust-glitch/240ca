// Agreements tab (owner, 2026-11-03: "make it so its an integrated part of
// the site instead of having it look like the old site"): the collective
// agreement search, moved here from Render (public/index.html there), in
// the board page's own look. Asks the Worker (/api/sources, /api/ask, an
// NDJSON stream: citations, answer chunks, escalating, done, error). Built
// once and kept, so switching tabs doesn't lose an answer.
(function (root) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let box = null;
  let sources = [];
  let names = {};
  let last = null;

  function build() {
    box = document.createElement('div');
    box.className = 'askpage';
    box.innerHTML = `<div class="thead"><div class="when">Agreements</div></div>
      <section class="sheet askq">
        <label for="askq" class="asklbl">Ask a question about the collective agreements, the rules or CROA awards</label>
        <div class="askrow"><textarea id="askq" maxlength="500" rows="2" placeholder="e.g. How long can I be held at the away-from-home terminal?"></textarea><button type="button" id="askgo" class="askbtn">Ask</button></div>
        <p class="asktip"><b>Tip:</b> you get better answers when you pick just the agreement you need under <button type="button" class="linkbtn askpick">Documents to search</button> (for example only the Conductors agreement 4.16), instead of searching everything.</p>
        <p class="muted askhint">Answers come only from the documents below, with the page for every point. A search aid, not legal advice: for a grievance or claim, confirm with your Local Chairperson.</p>
        <p class="muted askhint">Questions and answers are kept for 60 days to check the answers are right. Don't include names or personal details.</p>
      </section>
      <div class="askload" hidden><span class="askspin"></span> Searching the documents…</div>
      <section class="sheet askans" hidden><div class="askanswer"></div><button type="button" class="askdeep" hidden>Try a deeper search</button></section>
      <section class="sheet askcites" hidden><header><h2>Where it comes from</h2><span class="meta">tap one for the full passage</span></header><ul class="askcitelist"></ul></section>
      <details class="refsec asksrc"><summary>Documents to search <span class="muted askcount"></span></summary>
        <div class="askbtns"><button type="button" data-pick="all">All</button><button type="button" data-pick="none">None</button><button type="button" data-pick="conductor">Conductor</button><button type="button" data-pick="engineer">Engineer</button></div>
        <div class="asklist">Loading…</div>
        <div class="askdates" hidden><span>CROA awards from</span> <input type="date" class="askfrom"> <span>to</span> <input type="date" class="askto"></div>
      </details>`;
    const $ = (s) => box.querySelector(s);
    $('#askgo').onclick = ask;
    $('#askq').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } };
    $('.askdeep').onclick = deeper;
    // The tip's link opens the document list and brings it into view.
    $('.askpick').onclick = () => { const d = $('.asksrc'); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    box.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => pick(b.dataset.pick); });
    loadSources();
  }

  async function loadSources() {
    const list = box.querySelector('.asklist');
    try {
      const r = await fetch('api/sources', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      sources = (await r.json()).sources || [];
    } catch (e) {
      list.textContent = 'The document list isn\'t available right now.';
      return;
    }
    names = Object.fromEntries(sources.map((s) => [s.id, s.name]));
    const item = (s) => `<label class="askitem" id="ai-${esc(s.id)}"><input type="checkbox" value="${esc(s.id)}"${s.manualOnly ? '' : ' checked'}> <span>${esc(s.name)}</span></label>`;
    const manual = sources.filter((s) => s.manualOnly);
    list.innerHTML = sources.filter((s) => !s.manualOnly).map(item).join('')
      + (manual.length ? `<h4>Western Canada (pick by hand)</h4>${manual.map(item).join('')}` : '');
    list.querySelectorAll('input').forEach((i) => { i.onchange = refresh; });
    refresh();
  }
  const checked = () => [...box.querySelectorAll('.asklist input:checked')].map((i) => i.value);
  // Two that can't be searched together (4.3 with 4.16): one blocks the other.
  function refresh() {
    const on = new Set(checked());
    for (const s of sources) {
      const blockers = sources.filter((o) => o.id !== s.id && on.has(o.id) && ((s.conflictsWith || []).includes(o.id) || (o.conflictsWith || []).includes(s.id)));
      const i = box.querySelector(`#ai-${CSS.escape(s.id)} input`);
      if (!i) continue;
      i.disabled = blockers.length > 0 && !i.checked;
      i.parentNode.classList.toggle('off', i.disabled);
      i.parentNode.title = i.disabled ? `Untick ${blockers.map((b) => b.name).join(' and ')} to use this one.` : '';
    }
    box.querySelector('.askdates').hidden = !on.has('croa');
    const n = on.size;
    box.querySelector('.askcount').textContent = `(${n} of ${sources.length})`;
  }
  function pick(what) {
    box.querySelectorAll('.asklist input').forEach((i) => {
      const s = sources.find((x) => x.id === i.value) || {};
      i.checked = what === 'all' ? !s.manualOnly : what === 'none' ? false : !s.manualOnly && (s.crafts || []).includes(what);
    });
    refresh();
  }

  function cites(list) {
    const ul = box.querySelector('.askcitelist');
    const android = /Android/i.test(navigator.userAgent);
    ul.innerHTML = list.map((c, i) => {
      const where = /^\d+$/.test(String(c.page)) ? `page ${c.page}` : c.page;
      const more = c.fullText && c.fullText.length > c.snippet.length;
      // Android's PDF viewer drops #page=, so agreement PDFs open in ours there.
      const href = c.url ? (android && c.url.startsWith('/docs/') ? `viewer.html?doc=${encodeURIComponent(c.source)}&page=${encodeURIComponent(c.page)}` : c.url.replace(/^\//, '')) : '';
      return `<li data-i="${i}"><div class="askcl"><b>[${i + 1}]</b> ${esc(names[c.source] || c.source)} · ${esc(where)}</div>
        <div class="asktx">${esc(c.snippet)}${more ? '…' : ''}</div>
        <div class="askln">${more ? '<button type="button" class="askmore">Show more</button>' : ''}${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${c.source === 'croa' ? 'Open the award ↗' : `Open at page ${esc(c.page)} ↗`}</a>` : ''}</div></li>`;
    }).join('');
    ul.querySelectorAll('.askmore').forEach((b) => {
      b.onclick = () => {
        const li = b.closest('li');
        const c = list[+li.dataset.i];
        const open = b.textContent === 'Show more';
        li.querySelector('.asktx').textContent = open ? c.fullText : `${c.snippet}…`;
        b.textContent = open ? 'Show less' : 'Show more';
      };
    });
    box.querySelector('.askcites').hidden = !list.length;
  }

  async function stream(q, { tier, append, waiting }) {
    const ans = box.querySelector('.askanswer');
    const deep = box.querySelector('.askdeep');
    deep.hidden = true;
    if (!append) { ans.innerHTML = ''; box.querySelector('.askcites').hidden = true; }
    let note = waiting ? addNote(waiting) : null;
    let run = null;
    const text = (t) => {
      if (!run) { run = document.createElement('span'); ans.appendChild(run); }
      run.textContent += t;
    };
    try {
      // The owner key (board.html OwnerKey) gets the owner's questions answered by Claude Opus.
      const owner = typeof OwnerKey !== 'undefined' ? OwnerKey.headers() : {};
      const r = await fetch('api/ask', { method: 'POST', headers: { 'content-type': 'application/json', ...owner }, body: JSON.stringify({ ...q, tier }) });
      if (!r.ok) {
        const msg = r.status === 429 ? await r.text() : ((await r.json().catch(() => ({}))).error || 'Something went wrong.');
        error(msg);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          let e;
          try { e = JSON.parse(line); } catch (x) { continue; }
          if (e.type === 'citations') cites(e.citations || []);
          else if (e.type === 'chunk') {
            if (note) { note.className = 'askdiv'; note.textContent = 'Deeper search' + (note.dataset.label ? ` · ${note.dataset.label}` : ''); note = null; }
            box.querySelector('.askload').hidden = true;
            box.querySelector('.askans').hidden = false;
            text(e.text);
          } else if (e.type === 'model') {
            // Which model writes the answer that follows (Claude Opus, or Kimi if Opus is unavailable).
            if (note) note.dataset.label = e.label;
            else { const d = document.createElement('div'); d.className = 'askdiv'; d.textContent = e.label; ans.appendChild(d); box.querySelector('.askans').hidden = false; run = null; }
          } else if (e.type === 'fallback') {
            // Claude (or the chosen Kimi) didn't answer: say so; the reason only on the owner's phone.
            const owner = typeof OwnerKey !== 'undefined' && OwnerKey.has();
            const d = document.createElement('div'); d.className = 'muted askfall';
            d.textContent = `${e.from} wasn't available, so another model answered.${owner && e.reason ? ` (${e.reason})` : ''}`;
            ans.appendChild(d); run = null;
            // Its heading (already shown) is replaced by the one that answers.
            const prev = d.previousElementSibling;
            if (prev && prev.classList.contains('askdiv') && prev.textContent === e.from) prev.remove();
          } else if (e.type === 'escalating') {
            run = null;
            note = addNote('That didn\'t find it: searching more thoroughly, this takes a bit longer…');
          } else if (e.type === 'done') { if (e.canEscalate) deep.hidden = false; }
          else if (e.type === 'error') { if (note) { note.remove(); note = null; } run = null; error(e.error); }
        }
      }
    } catch (err) {
      if (note) note.remove();
      error(`No connection (${err.message || err}).`);
    }
  }
  function addNote(t) {
    const n = document.createElement('div');
    n.className = 'asknote';
    n.innerHTML = `<span class="askspin"></span> ${esc(t)}`;
    box.querySelector('.askanswer').appendChild(n);
    box.querySelector('.askans').hidden = false;
    return n;
  }
  function error(t) {
    const n = document.createElement('div');
    n.className = 'askerr';
    n.textContent = t;
    box.querySelector('.askanswer').appendChild(n);
    box.querySelector('.askans').hidden = false;
    box.querySelector('.askload').hidden = true;
  }

  async function ask() {
    const question = box.querySelector('#askq').value.trim();
    if (!question) return;
    const src = checked();
    if (!src.length) { box.querySelector('.askanswer').innerHTML = ''; error('Pick at least one document to search (Documents to search, below).'); return; }
    last = { question, sources: src, dateFrom: box.querySelector('.askfrom').value || null, dateTo: box.querySelector('.askto').value || null };
    const go = box.querySelector('#askgo');
    go.disabled = true;
    box.querySelector('.askload').hidden = false;
    box.querySelector('.askans').hidden = true;
    try { await stream(last, { tier: 'fast' }); } finally { go.disabled = false; box.querySelector('.askload').hidden = true; }
  }
  async function deeper() {
    if (!last) return;
    const b = box.querySelector('.askdeep');
    b.disabled = true;
    try { await stream(last, { tier: 'slow', append: true, waiting: 'Searching more thoroughly, this takes a bit longer…' }); } finally { b.disabled = false; }
  }

  root.BoardAsk = {
    render(view) {
      if (!box) build();
      view.innerHTML = '';
      view.appendChild(box);
    },
  };
})(window);

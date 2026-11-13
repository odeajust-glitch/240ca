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
  let citesNow = []; // the passages of the answer being written (the last citations event)

  // --- Answer tools, reviewed with the owner 2026-11-12 evening ("Go with your pick: 3, 2, 1, 4 and 5"). TEST
  // SITE ONLY: used when board.html passes preview (PREVIEW). Pure functions, so the tests can run them.
  // 3. The answer as the model writes it, drawn as HTML. In his Search Review (4 to 12 Nov) every answer had
  // Markdown marks the tab showed as typed characters: **bold** (25 of 28), *italics* (9), # headings (7), - or *
  // bullets (22, some indented), a > quote, a --- line, and [n] for the passages (237; [1][2] and [1, 2] too).
  // Everything is escaped first; only those marks become tags. A [n] up to the passage count is a button that
  // opens that passage under the paragraph. n: how many passages the answer was written from.
  function answerHtml(raw, n) {
    const ref = (d) => (+d >= 1 && +d <= n ? `<button type="button" class="askref" data-ref="${d}">${d}</button>` : d);
    const inline = (s) => esc(s)
      .replace(/\*\*((?:[^*\n]|\*[^*\n]+\*)+?)\*\*/g, '<b>$1</b>') // bold, an *italic* word inside it too
      .replace(/(^|[\s(>])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?<]|$)/g, '$1<i>$2</i>')
      .replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g, (m, inner) => `[${inner.replace(/\d+/g, ref)}]`);
    const out = [];
    let para = [];
    let list = null; // { tag, start, items: [{ text, sub }] }
    let quote = [];
    const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<${list.tag}${list.start > 1 ? ` start="${list.start}"` : ''}>${list.items.map((x) => `<li${x.sub ? ' class="sub"' : ''}>${inline(x.text)}</li>`).join('')}</${list.tag}>`); list = null; };
    const flushQuote = () => { if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); quote = []; };
    const flush = () => { flushPara(); flushList(); flushQuote(); };
    for (const line of String(raw).replace(/\r/g, '').split('\n')) {
      const t = line.trim();
      let m;
      if (!t) { flush(); continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); continue; } // a dividing line: the gap is enough
      if ((m = /^#{1,6}\s+(.*?)\s*#*$/.exec(t))) { flush(); out.push(`<h4>${inline(m[1])}</h4>`); continue; }
      if ((m = /^>\s?(.*)$/.exec(t))) { flushPara(); flushList(); quote.push(m[1]); continue; }
      if ((m = /^[-*•]\s+(.*)$/.exec(t))) {
        flushPara(); flushQuote();
        const sub = /^\s{2,}/.test(line) && !!list;
        if (!list || (list.tag !== 'ul' && !sub)) { flushList(); list = { tag: 'ul', start: 1, items: [] }; }
        list.items.push({ text: m[1], sub });
        continue;
      }
      if ((m = /^(\d+)[.)]\s+(.*)$/.exec(t))) {
        flushPara(); flushQuote();
        if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', start: +m[1], items: [] }; }
        list.items.push({ text: m[2], sub: false });
        continue;
      }
      if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1].text += ` ${t}`; continue; } // a list item's next line
      flushList(); flushQuote();
      para.push(t);
    }
    flush();
    return out.join('');
  }
  // 4. An answer that says it could not find it. The Worker asks for a deeper search on "could not find" by
  // itself; this is the last answer's own words (and the Worker's "No matching passages were found").
  const notFound = (text) => /could not find|couldn['’]t find|could not locate|unable to find|not able to find|no matching passages|do(?:es)? not contain/i.test(String(text || ''));
  // 5. The answer as plain text, for copying: the marks taken off, the bullets kept as "- ".
  const plainText = (raw) => String(raw || '').replace(/\r/g, '')
    .replace(/\*\*((?:[^*\n]|\*[^*\n]+\*)+?)\*\*/g, '$1').replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/gm, '$1$2')
    .replace(/^[ \t]*#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/gm, '$1').replace(/^[ \t]*(-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '').replace(/^([ \t]*)[*•][ \t]+/gm, '$1- ')
    .replace(/\n{3,}/g, '\n\n').trim();
  // The passage numbers an answer uses, in order, each once (up to n).
  const refsIn = (raw, n) => [...new Set([...String(raw || '').matchAll(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g)].flatMap((m) => m[1].match(/\d+/g).map(Number)))].filter((x) => x >= 1 && x <= n);
  // 1. The box promises "the rules or CROA awards", but a craft's everyday set leaves them out. A question that
  // names one of these documents, while it isn't searched, gets a line offering to add it.
  const MENTIONS = [
    ['cror', /\bCROR\b|\brules?\s+\d{1,3}\b|\boperating rules?\b/i, 'The CROR isn’t being searched.'],
    ['goi', /\bGOIs?\b|general operating instructions?/i, 'The GOI isn’t being searched.'],
    ['dangerous_goods', /dangerous goods|\bTDG\b|placard|hazardous material/i, 'Dangerous goods isn’t being searched.'],
    ['disciplinary_grid', /disciplin|demerit|suspension/i, 'The discipline grid isn’t being searched.'],
    ['croa', /\bCROA\b|arbitrat/i, 'CROA awards aren’t being searched.'],
    ['le_operating_manual', /operating manual|\b8960\b/i, 'The engineer operating manual isn’t being searched.'],
  ];
  const mentioned = (question) => MENTIONS.filter(([, rx]) => rx.test(String(question || ''))).map(([id]) => id);
  // --- end of the answer tools ---

  function build() {
    box = document.createElement('div');
    box.className = 'askpage';
    box.innerHTML = `<div class="thead"><div class="when">Agreements</div></div>
      <section class="sheet askq">
        <label for="askq" class="asklbl">Ask a question about the collective agreements, the rules or CROA awards</label>
        <div class="askrow"><textarea id="askq" maxlength="500" rows="2" placeholder="e.g. How long can I be held at the away-from-home terminal?"></textarea><button type="button" id="askgo" class="askbtn">Ask</button></div>
        <div class="askpicker" hidden>
          <div class="askcraft" role="group" aria-label="Your craft"><span class="asklbl2">I am a</span><button type="button" data-craft="conductor" aria-pressed="false">Conductor</button><button type="button" data-craft="engineer" aria-pressed="false">Engineer</button></div>
          <div class="askchipset"><span class="asklbl2">Searching</span><span class="askchips askon"></span></div>
          <details class="askmoredocs"><summary>Add more documents <span class="muted askmorecount"></span></summary><div class="askchips askoff"></div><p class="muted askhint">Tap one to add it. Tap a document under Searching to take it out.</p></details>
        </div>
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
    // The test site's answer tools (inert elsewhere: nothing they look for is drawn there).
    $('#askq').addEventListener('input', () => { if (preview) paintMentions(); });
    $('.askanswer').addEventListener('click', (e) => { const b = e.target.closest('.askref'); if (b) showPassage(b); });
    $('.askdeep').onclick = deeper;
    // The tip's link opens the document list and brings it into view.
    $('.askpick').onclick = () => { const d = $('.asksrc'); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    box.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => pick(b.dataset.pick); });
    box.querySelectorAll('[data-craft]').forEach((b) => { b.onclick = () => setCraft(b.dataset.craft); });
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
    if (simple) setCraft(savedCraft(), true); else refresh();
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
    paintChips();
    if (preview) paintMentions();
  }

  // --- The simpler picker (owner, 2026-11-11: "Could have it auto select a few
  // of the more commonly used ones, then you can add in more if needed. And
  // also have a conductor/engineer button"). On both sites. A craft button
  // picks that craft's everyday documents: its agreement, the addenda or the
  // mileage guidelines, its Sarnia crew calling document and the duty and
  // rest rules. Everything else (the operating rules, dangerous goods, the
  // discipline grid, the engineers' operating manual, CROA awards, Western
  // Canada) is under "Add more documents". The tick boxes below stay the one
  // record of what is searched; the chips only show and change them. The
  // craft is remembered on this phone.
  const COMMON = {
    conductor: ['conductors', 'conductors_addendum', 'crew_calling_cty', 'rest_rules'],
    engineer: ['engineers', 'mileage_guidelines', 'crew_calling', 'rest_rules'],
  };
  const SHORT = { conductors: 'Conductors 4.16', conductors_addendum: '4.16 addenda', crew_calling_cty: 'Crew calling (conductors)', rest_rules: 'Duty & rest rules', engineers: 'Engineers 1.1', mileage_guidelines: 'Mileage guidelines', crew_calling: 'Crew calling (engineers)',
    cror: 'CROR', goi: 'GOI', dangerous_goods: 'Dangerous goods', disciplinary_grid: 'Discipline grid', le_operating_manual: 'Engineer operating manual', croa: 'CROA awards', agreement_4_3: 'Conductors 4.3 (West)', agreement_1_2: 'Engineers 1.2 (West)' };
  const CRAFT_KEY = 'askCraft';
  let simple = false;
  const savedCraft = () => { try { const c = localStorage.getItem(CRAFT_KEY); return COMMON[c] ? c : ''; } catch (e) { return ''; } };
  function paintChips() {
    if (!box || !simple || !sources.length) return;
    const on = new Set(checked());
    const chip = (s) => { const i = box.querySelector(`#ai-${CSS.escape(s.id)} input`); const off = i && i.disabled; return `<button type="button" class="askchip${on.has(s.id) ? ' on' : ''}" data-doc="${esc(s.id)}"${off ? ' disabled' : ''} title="${esc(s.name)}">${on.has(s.id) ? '✓ ' : '+ '}${esc(SHORT[s.id] || s.name)}</button>`; };
    box.querySelector('.askon').innerHTML = sources.filter((s) => on.has(s.id)).map(chip).join('') || '<span class="muted">nothing picked yet</span>';
    const rest = sources.filter((s) => !on.has(s.id));
    box.querySelector('.askoff').innerHTML = rest.map(chip).join('') || '<span class="muted">everything is being searched</span>';
    box.querySelector('.askmorecount').textContent = `(${rest.length})`;
    box.querySelectorAll('.askchip').forEach((b) => { b.onclick = () => { const i = box.querySelector(`#ai-${CSS.escape(b.dataset.doc)} input`); if (!i || i.disabled) return; i.checked = !i.checked; refresh(); }; });
    const craft = savedCraft();
    box.querySelectorAll('[data-craft]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.craft === craft)));
  }
  // The craft's everyday documents, or both crafts' until one is picked.
  function setCraft(craft, keep) {
    if (craft && !keep) { try { localStorage.setItem(CRAFT_KEY, craft); } catch (e) { /* not kept */ } }
    const want = new Set(craft ? COMMON[craft] : [...COMMON.conductor, ...COMMON.engineer]);
    box.querySelectorAll('.asklist input').forEach((i) => { i.checked = want.has(i.value); });
    refresh();
    paintExamples();
  }
  function setSimple(on) {
    if (!box || simple === !!on) return;
    simple = !!on;
    box.querySelector('.askpicker').hidden = !simple;
    box.querySelector('.asktip').hidden = simple;
    box.querySelector('.asksrc > summary').firstChild.textContent = simple ? 'All documents, as a list ' : 'Documents to search ';
    // The CROA date boxes sit with the chips, so they show when CROA is added there.
    (simple ? box.querySelector('.askpicker') : box.querySelector('.asksrc')).appendChild(box.querySelector('.askdates'));
    if (!sources.length) return;
    if (simple) setCraft(savedCraft(), true); else pick('all');
  }
  // --- Example questions and how to ask (owner, 2026-11-12 evening: "add some sample questions and
  // explanations ... example of good questions to ask, and the type of questions to ask. Explain how AI can be
  // more useful than a normal search engine and its limitations"; then, shown a picture: "Push these changes
  // to the test site"). Test site only: board.html passes opts.preview = PREVIEW. Each example was run
  // through the site's own search over the agreements (top 9, that craft's documents) and finds the part it
  // is about (test/board/ask-examples.test.js). A tap fills the box and never sends: the member presses Ask.
  const EXAMPLES = {
    conductor: [
      'What am I paid when I am held at the away-from-home terminal more than 14 hours?',
      'What is a runaround and how is it paid?',
      'What am I paid if I am called and then cancelled?',
      'When can I book rest, and how much rest can I book?',
      'How am I paid if I work on a general holiday?',
      'How are trains assigned to the A pool and B pool in Sarnia?',
    ],
    engineer: [
      'How long can a locomotive engineer be held at the away-from-home terminal?',
      'How is an engineer paid for deadheading?',
      'When can an engineer book rest, and how much rest?',
      'How are engineers called off the spare board?',
      'What is the most mileage an engineer can run in a month?',
      'How much bereavement leave does an engineer get?',
    ],
  };
  // The two results quoted were run through the site's own search on 2026-11-12 (top 9 passages).
  const HOW = `<details class="refsec askhow"><summary>How to ask a good question</summary><div class="askhowb">
    <p><b>Use the agreement's own words.</b> The search finds passages by the words in your question, then the AI reads them. "How long can they keep me in Toronto?" found nothing useful. "Held at the away-from-home terminal more than 14 hours" found Article 18.6 first.</p>
    <ul><li><b>One question at a time.</b> Each question starts fresh: it doesn't remember the last one.</li>
    <li><b>Pick Conductor or Engineer</b> so it searches your agreement. For the CROR, GOI, dangerous goods or the discipline grid, add that document first (Add more documents).</li>
    <li><b>Name the article if you know it:</b> "What does Article 18.6 say?"</li>
    <li><b>No good answer?</b> Tap "Try a deeper search", or ask again in the agreement's words.</li></ul>
    <p><b>Good for:</b> pay (held away, deadheading, runarounds, called and cancelled, general holidays), time off (vacation, personal leave days, bereavement), booking rest and the duty and rest rules, crew calling at Sarnia, and what an article says.</p>
    <p><b>Not for:</b> your own pay or trips ("Was I paid right yesterday?"). It can't see your time slips, CATS or your seniority. No names or personal details.</p></div></details>`;
  const WHY = `<details class="refsec askhow"><summary>What it does better than a search engine, and its limits</summary><div class="askhowb">
    <p><b>Better than a search engine:</b></p>
    <ul><li>You ask in a sentence and get an answer in plain words, not a list of links to read through.</li>
    <li>It works only from our agreements and rules, not the internet, so it isn't quoting another railway or another union's contract.</li>
    <li>It puts several articles together and gives the page for every point, with a link to that page.</li>
    <li>It's told to say when the documents don't answer the question, not to guess.</li></ul>
    <p><b>Its limits:</b></p>
    <ul><li>It reads only the passages the search found (about 9 a question, 24 in a deeper search), picked by matching words. If your words aren't the agreement's, it can miss the right article.</li>
    <li>It can misread, mix up two articles or leave out an exception. Open the page and read it before you rely on it.</li>
    <li>It only knows the versions on this site (Conductors 4.16 revised July 2020, Engineers 1.1 2018, and the other documents listed). Anything agreed since may not be in them.</li>
    <li>Agreements 4.3 and 1.2 are for Western Canada, not Sarnia.</li>
    <li>It's a search aid, not legal advice. For a grievance or claim, confirm with your Local Chairperson.</li></ul></div></details>`;
  // The test site's pieces: added when preview turns on and taken away when it turns off, so a member's tab is
  // drawn exactly as before.
  let preview = false;
  function setPreview(on) {
    if (!box) return;
    if (preview !== !!on) {
      preview = !!on;
      if (preview) {
        box.querySelector('.askrow').insertAdjacentHTML('afterend', '<div class="asksugg" hidden></div><div class="asktry"><span class="asklbl2">Try one: it fills the box, then tap Ask</span><ul></ul></div>');
        box.querySelector('.asksrc').insertAdjacentHTML('beforebegin', HOW + WHY);
        box.querySelector('.askdeep').insertAdjacentHTML('afterend', '<button type="button" class="askcopy" hidden>Copy answer</button>');
        box.querySelector('.askcopy').onclick = (e) => copyAnswer(e.currentTarget);
      } else box.querySelectorAll('.asksugg, .asktry, .askhow, .askcopy').forEach((x) => x.remove());
    }
    // 2. With the craft buttons, the documents searched are the chips above this note, not a list below it.
    // (Three notes share the class: this is the one that says where the answers come from.)
    const hint = [...box.querySelectorAll('.askhint')].find((p) => /the documents (?:picked above|below)/.test(p.textContent));
    if (hint) hint.textContent = hint.textContent.replace(/the documents (?:picked above|below)/, preview && simple ? 'the documents picked above' : 'the documents below');
    paintExamples();
    paintMentions();
  }
  // Fill the question box (an example, or one offered after "couldn't find it"). Never sends: the member taps Ask.
  function fillBox(q) {
    const t = box.querySelector('#askq');
    t.value = q;
    t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    paintMentions();
  }
  const exampleList = (qs) => `<ul>${qs.map((q) => `<li><button type="button">${esc(q)}</button></li>`).join('')}</ul>`;
  const wireFill = (el) => el.querySelectorAll('li > button').forEach((b) => { b.onclick = () => fillBox(b.textContent); });
  // Six for the craft picked; three of each until one is picked.
  function paintExamples() {
    const ul = box && box.querySelector('.asktry ul');
    if (!ul) return;
    const craft = savedCraft();
    const list = craft ? EXAMPLES[craft] : [...EXAMPLES.conductor.slice(0, 3), ...EXAMPLES.engineer.slice(0, 3)];
    ul.outerHTML = exampleList(list);
    wireFill(box.querySelector('.asktry'));
  }
  // 1. A document the question names that the search leaves out: a line offering to add it.
  function paintMentions() {
    const el = box && box.querySelector('.asksugg');
    if (!el) return;
    const offer = mentioned(box.querySelector('#askq').value).filter((id) => {
      const i = box.querySelector(`#ai-${CSS.escape(id)} input`);
      return i && !i.checked && !i.disabled;
    });
    el.hidden = !offer.length;
    el.innerHTML = offer.map((id) => `<div>${esc(MENTIONS.find((x) => x[0] === id)[2])} <button type="button" class="askchip" data-add="${esc(id)}">+ Add ${esc(SHORT[id] || names[id] || id)}</button></div>`).join('');
    el.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => { const i = box.querySelector(`#ai-${CSS.escape(b.dataset.add)} input`); if (i && !i.disabled) { i.checked = true; refresh(); } }; });
  }
  // 3. A [n] in the answer: that passage under its paragraph, with the link to its page. Tap again to close.
  function showPassage(b) {
    const run = b.closest('.askmd');
    const k = +b.dataset.ref;
    const c = run && (run._cites || [])[k - 1];
    if (!c) return;
    const block = b.closest('li, p, h4, blockquote') || b;
    const inside = block.tagName === 'LI';
    const next = block.nextElementSibling;
    const open = inside ? block.querySelector(':scope > .askpass') : (next && next.classList.contains('askpass') ? next : null);
    const same = open && open.dataset.ref === String(k);
    if (open) open.remove();
    if (same) return;
    const href = citeHref(c);
    block.insertAdjacentHTML(inside ? 'beforeend' : 'afterend', `<div class="askpass" data-ref="${k}"><div class="askcl"><b>[${k}]</b> ${esc(names[c.source] || c.source)} · ${esc(citeWhere(c))}</div><div class="asktx">${esc(c.fullText || c.snippet)}</div>${href ? `<div class="askln"><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${c.source === 'croa' ? 'Open the award ↗' : `Open at page ${esc(c.page)} ↗`}</a></div>` : ''}</div>`);
  }
  // 4. After an answer that could not find it: the wording tip, and three examples to start from.
  function notFoundBox() {
    const craft = savedCraft();
    const list = craft ? EXAMPLES[craft].slice(0, 3) : [EXAMPLES.conductor[0], EXAMPLES.engineer[0], EXAMPLES.conductor[1]];
    return `<div class="asknf"><b>Didn’t find it?</b> The search goes by the words in your question. Try the agreement’s own words (“held at the away-from-home terminal”, not “kept in Toronto”)${craft ? '' : ', pick Conductor or Engineer'}, or start from one of these:${exampleList(list)}</div>`;
  }
  // When an answer is finished (test site): Copy answer, and the "Didn't find it?" box if it couldn't.
  function answerDone(ans) {
    const runs = ans.querySelectorAll('.askmd');
    const run = runs[runs.length - 1];
    if (!run || !run._raw.trim()) return;
    const copy = box.querySelector('.askcopy');
    if (copy) copy.hidden = notFound(run._raw); // nothing to copy from "couldn't find it"
    if (notFound(run._raw) && !ans.querySelector('.asknf')) { ans.insertAdjacentHTML('beforeend', notFoundBox()); wireFill(ans.querySelector('.asknf')); }
  }
  // 5. The last answer with the pages it cites, as text to paste to a Local Chairperson or a coworker.
  async function copyAnswer(b) {
    const runs = box.querySelectorAll('.askanswer .askmd');
    const run = runs[runs.length - 1];
    if (!run || !last) return;
    const list = run._cites || [];
    const used = refsIn(run._raw, list.length);
    const text = [`Question: ${last.question}`, '', plainText(run._raw),
      ...(used.length ? ['', 'Where it comes from:', ...used.map((k) => `[${k}] ${names[list[k - 1].source] || list[k - 1].source}, ${citeWhere(list[k - 1])}`)] : []),
      '', 'From the Sarnia board site’s agreement search. A search aid, not legal advice: confirm with your Local Chairperson.'].join('\n');
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
      t.remove();
    }
    b.textContent = ok ? '✓ Copied' : 'Could not copy';
    setTimeout(() => { b.textContent = 'Copy answer'; }, 2500);
  }
  function pick(what) {
    box.querySelectorAll('.asklist input').forEach((i) => {
      const s = sources.find((x) => x.id === i.value) || {};
      i.checked = what === 'all' ? !s.manualOnly : what === 'none' ? false : !s.manualOnly && (s.crafts || []).includes(what);
    });
    refresh();
  }

  const citeWhere = (c) => (/^\d+$/.test(String(c.page)) ? `page ${c.page}` : c.page);
  // Android's PDF viewer drops #page=, so agreement PDFs open in ours there.
  const citeHref = (c) => (c.url ? (/Android/i.test(navigator.userAgent) && c.url.startsWith('/docs/') ? `viewer.html?doc=${encodeURIComponent(c.source)}&page=${encodeURIComponent(c.page)}` : c.url.replace(/^\//, '')) : '');
  function cites(list) {
    citesNow = list;
    const ul = box.querySelector('.askcitelist');
    ul.innerHTML = list.map((c, i) => {
      const where = citeWhere(c);
      const more = c.fullText && c.fullText.length > c.snippet.length;
      const href = citeHref(c);
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
    const copy = box.querySelector('.askcopy');
    // The test site draws the answer with its formatting, and its [n] open the passages (answerHtml).
    const md = preview;
    deep.hidden = true;
    if (copy) copy.hidden = true;
    if (!append) { ans.innerHTML = ''; box.querySelector('.askcites').hidden = true; }
    let note = waiting ? addNote(waiting) : null;
    let run = null;
    const text = (t) => {
      if (!run) {
        run = document.createElement(md ? 'div' : 'span');
        if (md) { run.className = 'askmd'; run._raw = ''; run._cites = citesNow; }
        ans.appendChild(run);
      }
      if (md) { run._raw += t; run.innerHTML = answerHtml(run._raw, run._cites.length); } else run.textContent += t;
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
          } else if (e.type === 'done') { if (e.canEscalate) deep.hidden = false; if (md) answerDone(ans); }
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
    if (!src.length) { box.querySelector('.askanswer').innerHTML = ''; error(simple ? 'Pick at least one document to search: tap Conductor or Engineer, or add one.' : 'Pick at least one document to search (Documents to search, below).'); return; }
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
    // opts.simple: the craft buttons and document chips. opts.preview: the test site's pieces (the example
    // questions, the two explanations, the answer tools).
    render(view, opts) {
      if (!box) build();
      setSimple(!!(opts && opts.simple));
      setPreview(!!(opts && opts.preview));
      view.innerHTML = '';
      view.appendChild(box);
    },
  };
})(window);

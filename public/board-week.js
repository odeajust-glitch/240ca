// "My week" (owner, 2026-11-03: weekly summary, a page and a Sunday alert):
// one week (Sunday to Saturday) for a turn or a person, from what the site
// already keeps: the trains and yard jobs worked (Turn History), time on
// duty and holds (trains.json), rests and goes-spare, the sleep tracker, and
// what touched them (runaround log, stale trains, CATS option 5 errors, out
// of sequence). Shared by the page (window.BoardWeek) and the laptop's
// Sunday alert (scripts/board-auto.js), so both say the same thing.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./board-trains') : root.BoardTrains;
  const A = node ? require('./board-analytics') : root.BoardAnalytics;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // The Sunday-to-Saturday week a day is in: { from, to } (YYYY-MM-DD).
  function weekOf(day) {
    const d = new Date(`${day}T12:00:00Z`);
    const sun = new Date(d.getTime() - d.getUTCDay() * 864e5);
    return { from: iso(sun), to: iso(new Date(sun.getTime() + 6 * 864e5)) };
  }
  // The full week before the one a day is in.
  const weekBefore = (day) => weekOf(iso(new Date(Date.parse(`${weekOf(day).from}T12:00:00Z`) - 864e5)));
  const label = (w) => {
    const [a, b] = [w.from, w.to].map((x) => ({ m: MONTHS[+x.slice(5, 7) - 1], d: +x.slice(8, 10) }));
    return a.m === b.m ? `${a.m} ${a.d}–${b.d}` : `${a.m} ${a.d} – ${b.m} ${b.d}`;
  };

  // A person's record over their turns (people.json stretches): each turn's
  // history while they were on it (as Turn History's person search).
  function personRec(stretches, all) {
    const within = (t, e) => t && t >= e.from && t <= e.to;
    const rec = { changes: [], orders: [], rests: [], spares: [] };
    for (const e of stretches || []) {
      const r = all[e.turn];
      if (!r) continue;
      const tag = (x) => ({ ...x, turn: e.turn });
      rec.changes.push(...r.changes.filter((c) => within(c.taken, e)).map(tag));
      rec.orders.push(...r.orders.filter((o) => within(o.first, e) || within(o.last, e) || within(o.onDutySeen, e)).map(tag));
      rec.rests.push(...r.rests.filter((x) => within(x.seen, e)).map(tag));
      rec.spares.push(...r.spares.filter((x) => within(x.seen, e) || within(x.last, e)).map(tag));
    }
    const by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
    rec.changes.sort(by('taken'));
    rec.orders.sort(by('first'));
    rec.rests.sort(by('seen'));
    rec.spares.sort(by('seen'));
    rec.changes = rec.changes.map((c) => ({ ...c, text: `${c.turn}: ${c.text}` }));
    rec.orders = rec.orders.filter((o, i, a) => a.findIndex((x) => x.train === o.train) === i).map((o) => ({ ...o, train: `${o.train} (${o.turn})` }));
    rec.rests = rec.rests.map((x) => ({ ...x, where: [x.turn, x.where].filter(Boolean).join(', ') }));
    rec.spares = rec.spares.map((x) => ({ ...x, text: `${x.turn}: ${x.text}` }));
    return rec;
  }

  // The week for one turn or person. rec: Turn History's record (turns.json
  // entry, or personRec); turns: the turn ids that count as them (one turn,
  // or every turn a person was on that week); trains: trains.json rows;
  // lists: analytics.json (+ archive) sleep, runLog, stale, catsErrors,
  // runarounds; week: { from, to }.
  function weekSummary({ rec, turns = [], trains = [], sleep = [], runLog = [], stale = [], catsErrors = [], runarounds = [], week }) {
    const inWeek = (st) => !!st && st.slice(0, 10) >= week.from && st.slice(0, 10) <= week.to;
    const mine = new Set(turns.map((t) => String(t).replace(/-(CO|EN)$/, '')));
    const isMine = (t) => !!t && (mine.has(t) || mine.has(String(t).replace(/-(CO|EN)$/, '')));
    const work = ((rec && rec.orders) || []).filter((o) => o.onDuty && !o.workedBy)
      .map((o) => ({ train: o.train, at: T.resolve(o.onDutyAt, o.onDutySeen) || o.onDutySeen, crew: o.crew || '', station: o.station || '', job: o.job || '', yard: !!o.yard, turn: o.turn || '' }))
      .filter((o) => inWeek(o.at));
    const runs = A.workRuns(work, trains, turns[0] || '').sort((a, b) => (a.at < b.at ? -1 : 1));
    const roads = runs.filter((r) => !r.yard);
    const onDutyMin = roads.reduce((n, r) => n + (r.timeOnDuty || 0), 0);
    const rests = ((rec && rec.rests) || []).filter((x) => inWeek(x.seen));
    const spares = ((rec && rec.spares) || []).filter((x) => inWeek(x.seen));
    const calls = sleep.filter((z) => isMine(z.turn) && inWeek(z.onDuty) && !z.takenOff && z.off != null);
    const band = { ok: 0, warn: 0, bad: 0 };
    for (const z of calls) band[A.sleepBand(z.off)]++;
    const passed = runLog.filter((r) => isMine(r.passed) && r.result !== 'explained' && inWeek(r.seen));
    const staleHere = stale.filter((r) => inWeek(r.from) && String(r.crew || '').split(' + ').some(isMine));
    const cats = catsErrors.filter((r) => isMine(r.wouldCall) && inWeek(r.first));
    const seq = runarounds.filter((r) => isMine(r.turn) && !r.fixed && inWeek(r.taken));
    return {
      week, label: label(week), runs,
      trips: roads.length, yard: runs.length - roads.length,
      toronto: roads.filter((r) => r.timeOnDuty != null).length,
      onDutyMin, held14: roads.filter((r) => (r.heldMin || 0) >= 14 * 60).length,
      rests, spares,
      calls: { n: calls.length, ...band, worst: calls.reduce((m, z) => (Math.abs(z.off) > Math.abs(m) ? z.off : m), 0), list: calls },
      runarounds: passed, stale: staleHere, cats, outOfSeq: seq,
    };
  }

  // A person's week from the site's files (the Sunday alert): their turns
  // that week from people.json stretches. data: { people, turns, trains,
  // analytics } as the site publishes them; h: the person's hash.
  function personWeek(h, data, week) {
    const stretches = (((data.people || {})[h]) || []).filter((e) => e.to.slice(0, 10) >= week.from && e.from.slice(0, 10) <= week.to);
    const f = data.analytics || {};
    return weekSummary({ rec: personRec(stretches, data.turns || {}), turns: [...new Set(stretches.map((e) => e.turn))], trains: data.trains || [],
      sleep: f.sleep || [], runLog: f.runLog || [], stale: f.stale || [], catsErrors: f.catsErrors || [], runarounds: f.runarounds || [], week });
  }

  const hm = (m) => `${Math.floor(m / 60)} h${m % 60 ? ` ${pad(m % 60)} m` : ''}`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  // The Sunday alert's text: short, the parts with something in them.
  function weekText(s) {
    const bits = [];
    bits.push(s.trips || s.yard ? `${plural(s.trips, 'trip')}${s.yard ? ` + ${plural(s.yard, 'yard job')}` : ''}${s.onDutyMin ? `, ${hm(s.onDutyMin)} on duty to Toronto` : ''}` : 'no trips worked');
    if (s.held14) bits.push(`${s.held14} held 14 h+ in Toronto`);
    if (s.rests.length) bits.push(plural(s.rests.length, 'rest/hold', 'rests/holds'));
    if (s.calls.n) bits.push(`calls vs the one you slept on: ${s.calls.ok} within 30 min${s.calls.warn ? `, ${s.calls.warn} within 1 h` : ''}${s.calls.bad ? `, ${s.calls.bad} over 1 h` : ''}`);
    const flags = [];
    if (s.runarounds.length) flags.push(plural(s.runarounds.length, 'possible runaround'));
    if (s.stale.length) flags.push(`${plural(s.stale.length, 'train')} left stale`);
    if (s.cats.length) flags.push(plural(s.cats.length, 'CATS option 5 error'));
    if (flags.length) bits.push(flags.join(', '));
    return `Week of ${s.label}: ${bits.join('; ')}.`;
  }

  const api = { weekOf, weekBefore, label, personRec, weekSummary, personWeek, weekText };
  if (node) module.exports = api;
  else root.BoardWeek = api;
})(this);

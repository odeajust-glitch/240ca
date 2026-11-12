// My stats (owner, 2026-11-11: "very detailed statistics, trends … only
// available to the person who owns the account. They can see theirs and no
// one else's"). One person's own work, from what the site already keeps:
//   build()  the laptop: that person's record (their trips with off duty and
//            how the call moved, rests, resets, board places, what touched
//            them), small and with nothing that changes every check, so its
//            file only goes up when something happened
//   merge()  the laptop: the record kept from earlier builds joined to this
//            one, so the page reaches back past the days the site keeps
//   stats()  the page: every number, for the dates picked
//   html()   the page: the tab itself
// The laptop writes each record to accounts/stats/<hash>.json, which the
// Worker never serves as a file: GET /auth/stats hands a signed-in member
// the one for the name code on their own account, nobody else's
// (lib/board/mystats.js, cloudflare/board-worker.js, docs ACCOUNTS.md).
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./board-trains') : root.BoardTrains;
  const BT = node ? require('./board-turns') : root.BoardTurns;

  const V = 1;
  const DAY = 1440;
  const pad = (n) => String(n).padStart(2, '0');
  const min = (s) => T.toMin(s);
  const dayOf = (s) => String(s || '').slice(0, 10);
  const dayNum = (d) => Date.parse(`${d}T00:00:00Z`) / 864e5;
  const dayStr = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
  const by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  const TRAINEE = /^([A-Z][A-Z0-9]\d{2})-(TT|ET)$/;
  const baseOf = (t) => String(t || '').replace(/-(CO|EN)$/, '');
  const craftOf = (t) => (/-(CO|EN)$/.exec(String(t || '')) || [])[1] || '';

  // --- The laptop: one person's record ---------------------------------------

  // Turn History's person search (public/board.html personHistory), kept the
  // same so this page and that one never disagree about what someone worked:
  // each turn's history only while they were on it; a trainee's slot rides
  // the turn's trains; on 501/502 only their craft; a train worked while
  // filling in on another turn comes from their own turn's record.
  function personRecord(stretches, all, myCraft = null) {
    const within = (t, e) => t && t >= e.from && t <= e.to;
    const rec = { changes: [], orders: [], rests: [], spares: [] };
    for (const e of stretches.filter((x) => TRAINEE.test(x.turn))) {
      const [, base, kind] = TRAINEE.exec(e.turn);
      const r = all[base];
      if (!r) continue;
      rec.orders.push(...r.orders.filter((o) => (o.onDuty ? within(o.onDutySeen, e) : within(o.first, e) || within(o.last, e)) && !o.workedBy)
        .map((x) => ({ ...x, turn: base, trainee: kind, base })));
    }
    for (const e of stretches) {
      if (TRAINEE.test(e.turn)) continue;
      const r = all[e.turn];
      if (!r) continue;
      const tag = (x) => ({ ...x, turn: e.turn, own: !!e.own });
      rec.changes.push(...r.changes.filter((c) => within(c.taken, e)).map(tag));
      const theirs = (o) => (o.onDuty ? within(o.onDutySeen, e) : within(o.first, e) || within(o.last, e));
      const newest = !stretches.some((x) => x.turn === e.turn && x.to > e.to);
      const craft = e.craft || (newest && BT.SHARED.test(e.turn) && myCraft ? myCraft(e.turn) : '');
      rec.orders.push(...r.orders.filter((o) => theirs(o) && !(craft && e.own && o.coveredCraft === craft)).map((o) => ({ ...tag(o), ...(craft ? { craft } : {}) })));
      rec.rests.push(...r.rests.filter((x) => within(x.seen, e) && (!craft || !x.craft || x.craft === craft)).map(tag));
      rec.spares.push(...r.spares.filter((x) => within(x.seen, e) || within(x.last, e)).map(tag));
    }
    const ownTurns = [...new Set(stretches.filter((e) => e.own).map((e) => e.turn))];
    for (const e of stretches.filter((x) => !x.own)) {
      for (const t of ownTurns) {
        const r = all[t];
        if (!r) continue;
        rec.orders.push(...r.orders.filter((o) => o.job === e.turn && (o.onDuty ? within(o.onDutySeen, e) : within(o.first, e) || within(o.last, e))).map((x) => ({ ...x, turn: t })));
      }
    }
    rec.changes.sort(by('taken'));
    rec.orders.sort(by('first'));
    rec.rests.sort(by('seen'));
    rec.spares.sort(by('seen'));
    // One row per train; the copy they worked (not "worked by" someone else) wins.
    rec.orders = rec.orders.filter((o, i, a) => a.findIndex((x) => x.train === o.train && (!x.workedBy || a.every((y) => y.train !== o.train || y.workedBy))) === i);
    return rec;
  }

  // Their turns as whole days, so the record doesn't change every check:
  // [{ turn, own, craft?, from, to }] (YYYY-MM-DD), a day's gap or less joined.
  function daySpans(stretches) {
    const out = [];
    for (const e of [...stretches].sort(by('from'))) {
      const span = { turn: e.turn, own: !!e.own, ...(e.craft ? { craft: e.craft } : {}), from: dayOf(e.from), to: dayOf(e.to) };
      const last = [...out].reverse().find((x) => x.turn === span.turn && x.own === span.own);
      if (last && dayNum(span.from) - dayNum(last.to) <= 1) { if (span.to > last.to) last.to = span.to; if (span.craft) last.craft = span.craft; } else out.push(span);
    }
    return out;
  }

  // stretches: people.json's for this person. turns: turns.json. trains:
  // trains.json rows. offs: resets.json offs. resets / due: theirs from the
  // reset tracker. sleep, runLog, stale: analytics.json. craftNow(turn): their
  // craft on a 501/502 turn in the newest check ('' = not known).
  function build({ stretches = [], turns = {}, trains = [], offs = {}, resets = [], due = null, sleep = [], runLog = [], stale = [], craftNow = null } = {}) {
    const rec = personRecord(stretches, turns, craftNow);
    const byId = new Map();
    for (const r of trains) { const l = byId.get(r.id); if (l) l.push(r); else byId.set(r.id, [r]); }
    const spanAt = (turn, at) => stretches.find((e) => e.turn === baseOf(turn) && at >= e.from && at <= e.to && (!e.craft || !craftOf(turn) || craftOf(turn) === e.craft));
    const trips = rec.orders.filter((o) => o.onDuty && !o.workedBy).map((o) => {
      const at = T.resolve(o.onDutyAt, o.onDutySeen) || o.onDutySeen;
      const row = (byId.get(o.train) || []).find((r) => r.onDuty && Math.abs(min(r.onDuty) - min(at)) <= DAY) || null;
      const off = offs[o.train];
      const offOk = off && off.off && min(off.off) > min(at) && min(off.off) - min(at) <= 16 * 60 && Math.abs(min(off.on) - min(at)) <= 60;
      // Who they worked with: the crew less their own place on it.
      const shared = BT.SHARED.test(o.turn);
      const mates = String(o.crew || '').split(' · ').filter(Boolean).filter((c) => {
        const [cc, t] = [c.split(' ')[0], c.split(' ').pop()];
        if (o.trainee) return true;
        if (shared && t === o.turn) return o.craft ? (o.craft === 'CO' ? cc !== 'CO' : cc === 'CO') && cc !== 'TT' && cc !== 'ET' : false;
        return t !== o.turn && t !== o.job;
      });
      const z = sleep.filter((x) => x.train === o.train && !x.takenOff && x.off != null && baseOf(x.turn) === o.turn && (!craftOf(x.turn) || !o.craft || craftOf(x.turn) === o.craft))
        .sort((a, b) => Math.abs(min(a.onDuty) - min(at)) - Math.abs(min(b.onDuty) - min(at)))[0];
      return {
        id: o.train, at, turn: o.turn,
        ...(o.craft ? { craft: o.craft } : {}), ...(o.station ? { st: o.station } : {}), ...(o.job ? { job: o.job } : {}),
        ...(o.yard ? { yard: true } : {}), ...(o.trainee ? { tt: o.trainee } : {}), ...(row && row.deadhead ? { dh: true } : {}),
        ...(offOk ? { off: off.off, ...(/^(call board|yard)$/.test(off.how) ? { est: true } : {}) } : {}),
        ...(mates.length ? { with: mates } : {}),
        ...(row && row.firstPlan ? { plan: row.firstPlan, pc: row.planChanges || 0 } : {}),
        ...(row && row.firstOrder ? { ord: row.firstOrder, oc: row.orderChanges || 0 } : {}),
        ...(row && row.firstSeen ? { seen: row.firstSeen } : {}),
        ...(z ? { call: { exp: z.expected, first: z.firstCall, got: z.call, off: z.off, n: (z.shifts || []).length, ...(z.short ? { short: true } : {}) } } : {}),
      };
    }).filter((t) => t.at).sort(by('at'));

    // Their place on their own board, each time it moved: [stamp, place, board].
    // 999 = out working. From the turn's own changes ("Chain Gang (SR) position 002: available").
    const pos = [];
    for (const c of rec.changes) {
      if (!c.own) continue;
      let m = null;
      for (const part of String(c.text).split(' · ')) { m = /^(.+?) position (\d{3}):/.exec(part); if (m) break; }
      if (!m) continue;
      const last = pos[pos.length - 1];
      if (!last || last[1] !== +m[2] || last[2] !== m[1]) pos.push([c.taken, +m[2], m[1]]);
    }

    const rests = rec.rests.map((x) => ({ seen: x.seen, kind: x.kind, until: T.resolve(x.until, x.seen) || '', ...(x.where ? { where: x.where } : {}), turn: x.turn }))
      .filter((x, i, a) => a.findIndex((y) => y.kind === x.kind && y.until === x.until) === i);
    const spares = rec.spares.map((x) => ({ seen: x.seen, turn: x.turn, text: String(x.text || '').slice(0, 120) }))
      .filter((x, i, a) => a.findIndex((y) => y.seen === x.seen && y.text === x.text) === i);
    const passed = runLog.filter((r) => r.passed && r.seen && spanAt(r.craft === 'CO' || r.craft === 'EN' ? `${baseOf(r.passed)}-${r.craft}` : r.passed, r.seen))
      .map((r) => ({ seen: r.seen, train: r.train, went: r.went || '', result: r.result || '', ...(r.reason ? { reason: r.reason } : {}), ...(r.where ? { where: r.where } : {}) }))
      .filter((x, i, a) => a.findIndex((y) => y.seen === x.seen && y.train === x.train) === i);
    // Trains they were lined up for that sat past their call still only planned (ended ones: a running one grows each check).
    const staleOut = stale.filter((r) => r.from && r.end && r.end !== 'stale' && String(r.crew || '').split(' + ').some((t) => spanAt(t, r.from)))
      .map((r) => ({ from: r.from, train: r.train || r.id || '', min: r.minutes || 0 }));
    const span = stretches.reduce((a, e) => ({ from: !a.from || e.from < a.from ? e.from : a.from, to: !a.to || e.to > a.to ? e.to : a.to }), { from: '', to: '' });
    return {
      v: V, from: dayOf(span.from), to: dayOf(span.to), turns: daySpans(stretches), trips, rests, spares, pos,
      resets: (resets || []).map((x) => ({ at: x.at, kind: x.kind, ...(x.possible ? { possible: true } : {}) })).sort(by('at')),
      due: due || null, passed: passed.sort(by('seen')), stale: staleOut.sort(by('from')),
    };
  }

  // What was kept from earlier builds joined to this one. since: the first
  // day this build covers (YYYY-MM-DD): everything from then on is the
  // build's, everything before stays as it was kept. keepDays: how far back.
  const LISTS = { trips: (x) => x.at, rests: (x) => x.seen, spares: (x) => x.seen, pos: (x) => x[0], resets: (x) => x.at, passed: (x) => x.seen, stale: (x) => x.from };
  function merge(old, fresh, since, { keepDays = 400 } = {}) {
    if (!old || old.v !== V) return fresh || null;
    const f = fresh || { v: V, from: '', to: old.to, turns: [], trips: [], rests: [], spares: [], pos: [], resets: [], due: old.due || null, passed: [], stale: [] };
    const newest = f.to || old.to || since;
    const cut = dayStr(dayNum(newest) - keepDays);
    const out = { v: V, from: '', to: f.to > old.to ? f.to : old.to };
    for (const [k, stamp] of Object.entries(LISTS)) {
      out[k] = [...(old[k] || []).filter((x) => dayOf(stamp(x)) < since && dayOf(stamp(x)) >= cut), ...(f[k] || [])].sort((a, b) => (stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0));
    }
    const dayBefore = dayStr(dayNum(since) - 1);
    const kept = (old.turns || []).filter((x) => x.from < since && x.to >= cut).map((x) => ({ ...x, to: x.to >= since ? dayBefore : x.to }));
    out.turns = [];
    for (const x of [...kept, ...(f.turns || [])]) {
      const last = [...out.turns].reverse().find((y) => y.turn === x.turn && y.own === x.own);
      if (last && dayNum(x.from) - dayNum(last.to) <= 1) { if (x.to > last.to) last.to = x.to; if (x.craft) last.craft = x.craft; } else out.turns.push({ ...x });
    }
    out.from = out.turns.reduce((m, x) => (!m || x.from < m ? x.from : m), '') || f.from || old.from;
    out.due = fresh ? f.due : null;
    return { v: out.v, from: out.from, to: out.to, turns: out.turns, trips: out.trips, rests: out.rests, spares: out.spares, pos: out.pos, resets: out.resets, due: out.due, passed: out.passed, stale: out.stale };
  }

  // --- The page: the numbers -------------------------------------------------

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sum = (a) => a.reduce((n, x) => n + x, 0);
  const avg = (a) => (a.length ? Math.round(sum(a) / a.length) : null);
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
  const top = (xs, n = 6) => { const c = new Map(); for (const x of xs.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n); };
  const HOME = /^SARNIA$/i;
  const numberOf = (id) => { if (/^DH/.test(String(id))) return 'Deadhead'; const m = /^([A-Z]+)(\d{3})/.exec(String(id)); return m ? m[2] : String(id).split(' ')[0]; };
  // Minutes of [a, b) inside the window [lo, hi) of each day.
  const overlap = (a, b, lo, hi) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));

  // range: { from, to } days (inclusive), either end open.
  function stats(rec, range = {}) {
    const lo = range.from || '';
    const hi = range.to || '';
    const inR = (stamp) => { const d = dayOf(stamp); return !!d && (!lo || d >= lo) && (!hi || d <= hi); };
    const all = ((rec && rec.trips) || []).map((t) => ({ ...t, on: min(t.at), offMin: t.off ? min(t.off) : null })).filter((t) => t.on != null).sort((a, b) => a.on - b.on);
    const known = all.filter((t) => t.offMin != null).map((t) => t.offMin - t.on);
    const typical = median(known) || 8 * 60;
    // A trip with no off duty read yet: its length is taken as the usual one, and counted as estimated.
    for (const t of all) { t.dur = t.offMin != null ? t.offMin - t.on : typical; t.end = t.on + t.dur; t.durEst = t.offMin == null || !!t.est; t.away = !t.yard && !!t.st && !HOME.test(t.st); t.kind = t.yard ? 'yard' : t.away ? 'home' : 'out'; }
    // What follows each trip: time held away (out, then a trip home) or time at home.
    for (let i = 0; i < all.length; i++) {
      const a = all[i]; const b = all[i + 1];
      a.next = b && b.on - a.on < 6 * DAY ? { gap: b.on - a.end, onOn: b.on - a.on, held: a.kind === 'out' && b.kind === 'home' } : null;
    }
    const trips = all.filter((t) => inR(t.at));
    const road = trips.filter((t) => !t.yard);
    const first = trips[0]; const last = trips[trips.length - 1];

    // Round trips: out of Sarnia, then the next trip home.
    const tours = [];
    for (let i = 0; i < trips.length; i++) {
      const a = trips[i];
      if (a.kind !== 'out') continue;
      const b = a.next && a.next.held ? all[all.indexOf(a) + 1] : null;
      const after = b ? b.next : null;
      tours.push({ out: a, back: b, held: b ? b.on - a.end : null, away: b ? b.end - a.on : null, homeAfter: b && after && !after.held ? after.gap : null, place: b && b.st ? b.st : '' });
    }
    const done = tours.filter((x) => x.back);
    const heldBy = {};
    for (const x of done) { const k = x.place || 'away'; (heldBy[k] || (heldBy[k] = [])).push(x.held); }
    const homeGaps = trips.filter((t) => t.next && !t.next.held && t.kind !== 'out').map((t) => t.next.gap).filter((g) => g > 0);

    // Hours of the day.
    const hours = { out: Array(24).fill(0), home: Array(24).fill(0), yard: Array(24).fill(0), calls: Array(24).fill(0) };
    for (const t of trips) { hours[t.kind][Math.floor((((t.on % DAY) + DAY) % DAY) / 60)]++; hours.calls[Math.floor(((((t.on - 120) % DAY) + DAY) % DAY) / 60)]++; }
    const nightCalls = trips.filter((t) => { const c = (((t.on - 120) % DAY) + DAY) % DAY; return c >= 23 * 60 || c < 6 * 60; }).length;

    // The calendar: each day from the first to the last in the dates picked.
    const spans = (rec && rec.turns) || [];
    const startDay = [lo, rec && rec.from].filter(Boolean).map(dayNum);
    const start = startDay.length ? Math.max(...startDay) : (first ? dayNum(dayOf(first.at)) : null);
    const endDay = [hi, rec && rec.to].filter(Boolean).map(dayNum);
    const stop = endDay.length ? Math.min(...endDay) : (last ? dayNum(dayOf(T.fromMin(last.end))) : null);
    const days = [];
    if (start != null && stop != null) {
      for (let d = start; d <= stop; d++) {
        const a = d * DAY; const date = dayStr(d);
        let duty = 0; let night = 0; let starts = 0;
        for (const t of all) { duty += overlap(t.on, t.end, a, a + DAY); night += overlap(t.on, t.end, a, a + 360); if (Math.floor(t.on / DAY) === d) starts++; }
        days.push({ date, wd: new Date(d * 864e5).getUTCDay(), duty, night, starts, seen: spans.some((x) => x.from <= date && x.to >= date) });
      }
    }
    const worked = days.filter((x) => x.duty > 0);
    const weekdays = WEEKDAYS.map((name, i) => { const ds = days.filter((x) => x.wd === i); return { name, days: ds.length, worked: ds.filter((x) => x.duty > 0).length, duty: sum(ds.map((x) => x.duty)), starts: sum(ds.map((x) => x.starts)), nights: ds.filter((x) => x.night > 0).length }; });
    let run = 0; let clear = 0; let maxRun = 0; let maxClear = 0;
    for (const x of days) { if (x.duty > 0) { run++; clear = 0; } else { clear++; run = 0; } maxRun = Math.max(maxRun, run); maxClear = Math.max(maxClear, clear); }
    const weekends = [];
    for (let i = 0; i < days.length - 1; i++) if (days[i].wd === 6 && days[i + 1].wd === 0) weekends.push(days[i].duty === 0 && days[i + 1].duty === 0);

    // Weeks, Sunday to Saturday, and months.
    const group = (keyOf) => {
      const m = new Map();
      for (const x of days) { const k = keyOf(x); const g = m.get(k) || { key: k, days: 0, worked: 0, duty: 0, nights: 0, trips: 0, misses: [] }; g.days++; if (x.duty > 0) g.worked++; g.duty += x.duty; if (x.night > 0) g.nights++; g.trips += x.starts; m.set(k, g); }
      for (const t of trips) { const g = m.get(keyOf({ date: dayOf(t.at), wd: new Date(dayNum(dayOf(t.at)) * 864e5).getUTCDay() })); if (g && t.call) g.misses.push(Math.abs(t.call.off)); }
      return [...m.values()].map((g) => ({ ...g, miss: median(g.misses), misses: undefined }));
    };
    const weeks = group((x) => dayStr(dayNum(x.date) - x.wd)).map((w) => ({ ...w, partial: w.days < 7 }));
    const months = group((x) => x.date.slice(0, 7));
    // The most on duty in any 7 days in a row.
    let most7 = 0; let most7At = '';
    for (const s of trips) { const tot = sum(all.map((t) => overlap(t.on, t.end, s.on, s.on + 7 * DAY))); if (tot > most7) { most7 = tot; most7At = s.at; } }

    // Where the time went, from the first trip on duty to the last off.
    const dutyMin = sum(trips.map((t) => t.dur));
    const heldMin = sum(done.map((x) => x.held).filter((x) => x > 0));
    const spanMin = first ? last.end - first.on : 0;
    const split = { span: spanMin, duty: dutyMin, held: heldMin, home: Math.max(0, spanMin - dutyMin - heldMin) };

    // Calls: the one they went to sleep on against the one they got.
    const calls = trips.filter((t) => t.call && t.call.off != null).map((t) => ({ id: t.id, at: t.at, turn: t.turn, ...t.call }));
    const abs = calls.map((z) => Math.abs(z.off));
    const callStats = {
      n: calls.length, ok: abs.filter((x) => x <= 30).length, warn: abs.filter((x) => x > 30 && x <= 60).length, bad: abs.filter((x) => x > 60).length,
      later: calls.filter((z) => z.off > 0).length, earlier: calls.filter((z) => z.off < 0).length, exact: calls.filter((z) => z.off === 0).length,
      median: median(abs), changes: sum(calls.map((z) => z.n || 0)), short: calls.filter((z) => z.short).length,
      worst: calls.reduce((m, z) => (!m || Math.abs(z.off) > Math.abs(m.off) ? z : m), null), list: calls,
    };
    // The line-up: the first time planned and the first time ordered against on duty.
    const planOff = road.filter((t) => t.plan).map((t) => t.on - min(t.plan));
    const ordOff = road.filter((t) => t.ord).map((t) => t.on - min(t.ord));
    const lead = road.filter((t) => t.seen).map((t) => t.on - min(t.seen)).filter((x) => x > 0);
    const lineup = {
      plan: { n: planOff.length, median: median(planOff.map(Math.abs)), late: planOff.filter((x) => x > 15).length, early: planOff.filter((x) => x < -15).length, worst: planOff.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0), changes: sum(road.map((t) => t.pc || 0)) },
      order: { n: ordOff.length, median: median(ordOff.map(Math.abs)), changed: road.filter((t) => t.oc > 0).length },
      lead: { n: lead.length, median: median(lead), least: lead.length ? Math.min(...lead) : null },
    };

    // Rest: how soon after it ended the call came, and how long was booked at home.
    const restsAll = ((rec && rec.rests) || []).map((r) => ({ ...r, s: min(r.seen), u: min(r.until) })).filter((r) => r.s != null);
    const afterRest = { away: [], home: [] };
    for (const t of road) {
      const call = t.on - 120;
      const r = restsAll.filter((x) => x.u != null && /rest/i.test(x.kind) && x.s < call && call - x.u < 3 * DAY && x.u <= call + 120).sort((a, b) => b.s - a.s)[0];
      if (r) afterRest[t.kind === 'home' ? 'away' : 'home'].push(Math.max(0, call - r.u));
    }
    const booked = [];
    for (const t of trips.filter((x) => x.kind !== 'out' && x.offMin != null)) {
      const r = restsAll.find((x) => x.u != null && /rest/i.test(x.kind) && x.s >= t.offMin - 60 && x.s <= t.offMin + 360 && x.u > t.offMin);
      if (r) booked.push(r.u - t.offMin);
    }
    const restsIn = restsAll.filter((r) => inR(r.seen));
    const rest = {
      n: restsIn.filter((r) => /rest/i.test(r.kind)).length, holds: restsIn.filter((r) => /hold/i.test(r.kind)).length,
      afterAway: { n: afterRest.away.length, median: median(afterRest.away), least: afterRest.away.length ? Math.min(...afterRest.away) : null, most: afterRest.away.length ? Math.max(...afterRest.away) : null },
      afterHome: { n: afterRest.home.length, median: median(afterRest.home), least: afterRest.home.length ? Math.min(...afterRest.home) : null, most: afterRest.home.length ? Math.max(...afterRest.home) : null },
      booked: { n: booked.length, short: booked.filter((x) => x < 16 * 60).length, long: booked.filter((x) => x >= 16 * 60).length },
    };

    // Their place on the board: where they came home to, how fast it moved, how long first out.
    const posAll = ((rec && rec.pos) || []).map((p) => ({ t: min(p[0]), place: p[1], board: p[2] })).filter((p) => p.t != null);
    const climbs = [];
    for (const t of road.filter((x) => x.kind === 'out')) {
      const i = all.indexOf(t);
      const prev = all[i - 1];
      const call = t.on - 120;
      const since = prev ? prev.end - 60 : call - 4 * DAY;
      const near = posAll.filter((p) => p.t >= since && p.t <= call && p.place < 900);
      // Only the board they were called from (a move to another turn starts afresh).
      const seen = near.filter((p) => p.board === near[near.length - 1].board);
      if (seen.length < 2) continue;
      const arrived = seen[0]; const atCall = seen[seen.length - 1];
      const firstOut = seen.find((p) => p.place === 1);
      climbs.push({ id: t.id, at: t.at, board: arrived.board, from: arrived.place, to: atCall.place, wait: call - arrived.t, firstOut: firstOut ? call - firstOut.t : null });
    }
    const perPlace = climbs.filter((c) => c.from > c.to).map((c) => c.wait / (c.from - c.to));
    const board = { n: climbs.length, from: median(climbs.map((c) => c.from)), wait: median(climbs.map((c) => c.wait)), perPlace: median(perPlace.map(Math.round)), firstOut: climbs.filter((c) => c.firstOut != null).map((c) => c.firstOut), list: climbs };

    // Resets.
    const resetsAll = ((rec && rec.resets) || []).filter((x) => !x.possible).map((x) => ({ ...x, m: min(x.at) }));
    const resets = resetsAll.filter((x) => inR(x.at)).map((x) => {
      const before = resetsAll.filter((y) => y.m < x.m).pop();
      const between = all.filter((t) => t.on < x.m && (!before || t.on >= before.m));
      return { at: x.at, kind: x.kind, since: before ? x.m - before.m : null, trips: before ? between.length : null, duty: before ? sum(between.map((t) => t.dur)) : null };
    });
    const lastReset = resetsAll[resetsAll.length - 1];
    const sinceReset = lastReset ? all.filter((t) => t.on >= lastReset.m) : [];

    // Each turn they held, side by side.
    const turnKey = (t) => (t.craft ? `${t.turn} ${t.craft === 'CO' ? 'conductor' : 'engineer'}` : t.turn) + (t.tt ? ` (${t.tt} trainee)` : '');
    const byTurn = [...new Set(trips.map(turnKey))].map((k) => {
      const ts = trips.filter((t) => turnKey(t) === k);
      const mine = done.filter((x) => turnKey(x.out) === k);
      const cs = ts.filter((t) => t.call && t.call.off != null);
      return { turn: k, trips: ts.length, from: ts[0].at, to: ts[ts.length - 1].at, out: ts.filter((t) => t.kind === 'out').map((t) => t.at.slice(11)), home: ts.filter((t) => t.kind === 'home').map((t) => t.at.slice(11)),
        duty: avg(ts.map((t) => t.dur)), away: avg(mine.map((x) => x.away)), held: avg(mine.map((x) => x.held)), miss: median(cs.map((t) => Math.abs(t.call.off))), changes: sum(cs.map((t) => t.call.n || 0)), calls: cs.length };
    });

    const passed = ((rec && rec.passed) || []).filter((x) => inR(x.seen));
    const staleIn = ((rec && rec.stale) || []).filter((x) => inR(x.from));
    const sparesIn = ((rec && rec.spares) || []).filter((x) => inR(x.seen));
    return {
      range: { from: days.length ? days[0].date : '', to: days.length ? days[days.length - 1].date : '' },
      trips, tours, done: done.length, road: road.length, yard: trips.length - road.length,
      duty: { total: dutyMin, n: trips.length, est: trips.filter((t) => t.durEst).length, avg: avg(trips.map((t) => t.dur)), max: trips.reduce((m, t) => (!m || t.dur > m.dur ? t : m), null), min: trips.reduce((m, t) => (!m || t.dur < m.dur ? t : m), null),
        out: avg(trips.filter((t) => t.kind === 'out').map((t) => t.dur)), home: avg(trips.filter((t) => t.kind === 'home').map((t) => t.dur)), yardAvg: avg(trips.filter((t) => t.kind === 'yard').map((t) => t.dur)) },
      away: { n: done.length, avg: avg(done.map((x) => x.away)), max: done.length ? Math.max(...done.map((x) => x.away)) : null },
      held: { n: done.length, avg: avg(done.map((x) => x.held)), max: done.length ? Math.max(...done.map((x) => x.held)) : null, over14: done.filter((x) => x.held >= T.HELD_LIMIT).length,
        places: Object.entries(heldBy).map(([place, l]) => ({ place, n: l.length, avg: avg(l), max: Math.max(...l) })) },
      home: { n: homeGaps.length, avg: avg(homeGaps), min: homeGaps.length ? Math.min(...homeGaps) : null, max: homeGaps.length ? Math.max(...homeGaps) : null },
      between: { n: trips.filter((t) => t.next).length, avg: avg(trips.filter((t) => t.next).map((t) => t.next.onOn)) },
      perTour: done.length > 1 ? Math.round((done[done.length - 1].out.on - done[0].out.on) / (done.length - 1)) : null,
      hours, nightCalls, nightTrips: trips.filter((t) => { for (let d = Math.floor(t.on / DAY); d * DAY < t.end; d++) if (overlap(t.on, t.end, d * DAY, d * DAY + 360) > 0) return true; return false; }).length,
      days, worked: worked.length, clearDays: days.length - worked.length, unseen: days.filter((x) => !x.seen && !x.duty).length, nights: days.filter((x) => x.night > 0).length,
      weekdays, maxRun, maxClear, weekends: { n: weekends.length, clear: weekends.filter(Boolean).length },
      weeks, months, most7: { min: most7, at: most7At }, split, calls: callStats, lineup, rest, board,
      resets, due: (rec && rec.due) || null, sinceReset: lastReset ? { at: lastReset.at, trips: sinceReset.length, duty: sum(sinceReset.map((t) => t.dur)) } : null,
      byTurn, partners: top(trips.flatMap((t) => t.with || [])), numbers: top(road.map((t) => numberOf(t.id)), 8),
      turns: spans.filter((x) => (!lo || x.to >= lo) && (!hi || x.from <= hi)),
      flags: { passed, likely: passed.filter((x) => x.result === 'likely').length, possible: passed.filter((x) => x.result === 'possible').length, explained: passed.filter((x) => x.result === 'explained').length,
        stale: staleIn, staleWorst: staleIn.reduce((m, x) => (!m || x.min > m.min ? x : m), null), spares: sparesIn.length },
    };
  }

  // --- The page: the tab -----------------------------------------------------

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hm = (m) => (m == null ? '—' : `${m < 0 ? '−' : ''}${Math.floor(Math.abs(m) / 60)} h ${pad(Math.round(Math.abs(m)) % 60)}`);
  const hrs = (m) => (m == null ? '—' : `${Math.round(m / 6) / 10} h`);
  const off = (m) => (m === 0 ? 'on the minute' : `${hm(Math.abs(m))} ${m > 0 ? 'late' : 'early'}`);
  const dm = (stamp) => { const d = dayOf(stamp); return d ? `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}` : '—'; };
  const dt = (stamp) => (stamp ? `${dm(stamp)} ${String(stamp).slice(11)}` : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const title = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');
  const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;

  const RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'Everything kept']];
  function rangeOf(key, rec) {
    if (!rec || key === 'all' || !rec.to) return {};
    return { from: dayStr(dayNum(rec.to) - (+key - 1)), to: rec.to };
  }

  // Marks carry data-tip: wire() shows it beside the pointer or on focus.
  const tip = (text) => ` data-tip="${esc(text)}" tabindex="0"`;

  // Trips going on duty in each hour: going out and coming home stacked (yard jobs too when there are any).
  function hoursChart(s) {
    const W = 420; const H = 170; const L = 14; const B = 22; const TOP = 16;
    const kinds = [['out', 'Going out'], ['home', 'Coming home'], ['yard', 'Yard job']].filter(([k]) => sum(s.hours[k]) > 0);
    const tot = (h) => sum(kinds.map(([k]) => s.hours[k][h]));
    const max = Math.max(1, ...Array.from({ length: 24 }, (_, h) => tot(h)));
    const cw = (W - L) / 24; const unit = (H - B - TOP) / max;
    let bars = '';
    for (let h = 0; h < 24; h++) {
      let y = H - B;
      for (const [k, label] of kinds) {
        const n = s.hours[k][h];
        if (!n) continue;
        const hgt = n * unit;
        y -= hgt;
        bars += `<rect class="ms-k-${k}" x="${(L + h * cw + 2).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${(cw - 4).toFixed(1)}" height="${Math.max(1, hgt - 2).toFixed(1)}" rx="3"${tip(`${pad(h)}00 to ${pad(h)}59 · ${label.toLowerCase()}: ${n}`)}></rect>`;
      }
      if (tot(h)) bars += `<text class="ms-val" x="${(L + h * cw + cw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${tot(h)}</text>`;
    }
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => `<text class="ms-tick" x="${(L + h * cw + cw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${pad(h)}00</text>`).join('');
    const night = `<rect class="ms-night" x="${L}" y="${TOP - 12}" width="${(6 * cw).toFixed(1)}" height="${H - B - TOP + 12}"></rect>`;
    return `<div class="ms-legend">${kinds.map(([k, l]) => `<span><i class="ms-k-${k}"></i>${l}</span>`).join('')}</div>
      <svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trips going on duty in each hour of the day">${night}<line class="ms-axis" x1="${L}" y1="${H - B}" x2="${W}" y2="${H - B}"></line>${bars}${ticks}</svg>`;
  }

  // One bar per item; text labels above and below.
  function barChart(items, { label, value, text, sub, aria, cls = () => '' }) {
    const W = 420; const H = 170; const B = 38; const TOP = 18;
    const max = Math.max(1, ...items.map(value));
    const cw = W / items.length;
    const bw = Math.min(44, cw - 8);
    const body = items.map((it, i) => {
      const v = value(it);
      const hgt = (v / max) * (H - B - TOP);
      const x = i * cw + (cw - bw) / 2;
      return `${v > 0 ? `<rect class="ms-bar ${cls(it)}" x="${x.toFixed(1)}" y="${(H - B - hgt).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, hgt).toFixed(1)}" rx="4"${tip(`${label(it)}: ${text(it)}${sub ? ` · ${sub(it)}` : ''}`)}></rect>` : ''}
        <text class="ms-val" x="${(i * cw + cw / 2).toFixed(1)}" y="${(H - B - hgt - 5).toFixed(1)}" text-anchor="middle">${v > 0 ? esc(text(it)) : ''}</text>
        <text class="ms-tick ms-strong" x="${(i * cw + cw / 2).toFixed(1)}" y="${H - B + 15}" text-anchor="middle">${esc(label(it))}</text>
        ${sub ? `<text class="ms-tick" x="${(i * cw + cw / 2).toFixed(1)}" y="${H - B + 30}" text-anchor="middle">${esc(sub(it))}</text>` : ''}`;
    }).join('');
    return `<svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}"><line class="ms-axis" x1="0" y1="${H - B}" x2="${W}" y2="${H - B}"></line>${body}</svg>`;
  }

  // The calendar: a square a day, darker the more hours on duty.
  const shade = (m) => (m <= 0 ? 0 : m < 4 * 60 ? 1 : m < 8 * 60 ? 2 : m < 12 * 60 ? 3 : 4);
  function calendar(s) {
    if (!s.days.length) return '';
    const cells = [];
    for (let i = 0; i < s.days[0].wd; i++) cells.push('<i class="ms-day ms-pad"></i>');
    for (const d of s.days) {
      const what = d.duty ? `${hm(d.duty)} on duty${d.night ? `, ${hm(d.night)} of it between midnight and 0600` : ''}` : d.seen ? 'no duty' : 'not on a board that day';
      cells.push(`<i class="ms-day ms-s${shade(d.duty)}${!d.seen && !d.duty ? ' ms-unseen' : ''}"${tip(`${WEEKDAYS[d.wd]} ${dm(d.date)}: ${what}`)}><b>${+d.date.slice(8, 10)}</b>${d.duty ? `<span>${Math.round(d.duty / 60)}h</span>` : ''}</i>`);
    }
    return `<div class="ms-cal" role="img" aria-label="Hours on duty each day"><div class="ms-calhead">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div><div class="ms-calgrid">${cells.join('')}</div></div>
      <div class="ms-legend"><span><i class="ms-day ms-s0"></i>No duty</span><span><i class="ms-day ms-s1"></i>Under 4 h</span><span><i class="ms-day ms-s2"></i>4 to 8 h</span><span><i class="ms-day ms-s3"></i>8 to 12 h</span><span><i class="ms-day ms-s4"></i>12 h or more</span>${s.unseen ? '<span><i class="ms-day ms-s0 ms-unseen"></i>Not on a board</span>' : ''}</div>`;
  }

  // One bar split into parts, each with its label underneath.
  function splitBar(parts, aria) {
    const total = sum(parts.map((p) => p.v));
    if (!total) return '';
    return `<div class="ms-split" role="img" aria-label="${esc(aria)}">${parts.filter((p) => p.v > 0).map((p) => `<i class="${p.cls}" style="flex:${p.v}"${tip(`${p.label}: ${p.text} (${pct(p.v, total)}%)`)}></i>`).join('')}</div>
      <div class="ms-legend">${parts.map((p) => `<span><i class="${p.cls}"></i>${esc(p.label)} <b>${esc(p.text)}</b>${p.v ? ` · ${pct(p.v, total)}%` : ''}</span>`).join('')}</div>`;
  }

  const fact = (label, value, note = '') => `<div class="ms-fact"><dt>${label}</dt><dd>${value}${note ? `<small>${note}</small>` : ''}</dd></div>`;
  const section = (id, heading, body, note = '') => (body ? `<section class="ms-sec" id="ms-${id}"><h3>${heading}</h3>${note ? `<p class="ms-note">${note}</p>` : ''}${body}</section>` : '');
  const table = (head, rows) => `<div class="ms-scroll"><table class="ms-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  // The whole tab. opts: { range: '30' | '90' | 'all', code }.
  function html(rec, opts = {}) {
    const key = RANGES.some(([k]) => k === opts.range) ? opts.range : 'all';
    const s = stats(rec, rangeOf(key, rec));
    const picker = `<div class="ms-ranges" role="group" aria-label="Dates">${RANGES.map(([k, l]) => `<button type="button" data-ms-range="${k}" aria-pressed="${k === key}">${l}</button>`).join('')}</div>`;
    const head = `<header class="ms-head"><div><h2>My stats${opts.code ? ` <span class="ms-code">${esc(opts.code)}</span>` : ''}</h2>
      <p class="ms-note">${s.days.length ? `${esc(dm(s.range.from))} to ${esc(dm(s.range.to))} · ${plural(s.days.length, 'day')} · only you can open this page` : 'Only you can open this page'}</p></div>${picker}</header>`;
    if (!s.trips.length) return `<div class="ms">${head}<p class="ms-empty">No trips in the saved checks for these dates. They show here once your name is on a board and a train you work goes on duty.</p></div>`;
    const c = s.calls;
    const tiles = `<div class="ms-tiles">
      <div class="ms-tile"><b>${s.trips.length}</b><span>${s.trips.length === 1 ? 'trip' : 'trips'} on duty</span><small>${s.done ? `${plural(s.done, 'round trip')}${s.perTour ? `, one every ${(s.perTour / DAY).toFixed(1)} days` : ''}` : ''}${s.yard ? `${s.done ? ' · ' : ''}${plural(s.yard, 'yard job')}` : ''}</small></div>
      <div class="ms-tile"><b>${hrs(s.duty.total)}</b><span>on duty</span><small>${hm(s.duty.avg)} a trip${s.duty.est ? ` · ${s.duty.est} estimated` : ''}</small></div>
      <div class="ms-tile"><b>${s.worked}<i> of ${s.days.length}</i></b><span>days with duty</span><small>${plural(s.clearDays, 'clear day')} · ${plural(s.nights, 'night')} worked</small></div>
      <div class="ms-tile"><b>${c.n ? `${c.ok}<i> of ${c.n}</i>` : '—'}</b><span>calls within 30 min</span><small>${c.n ? `of the one you slept on · usual miss ${hm(c.median)}` : 'no calls measured yet'}</small></div></div>`;

    const time = section('time', 'Where the time went', splitBar([
      { cls: 'ms-k-out', label: 'On duty', text: hrs(s.split.duty), v: s.split.duty },
      { cls: 'ms-k-home', label: 'Held away from home', text: hrs(s.split.held), v: s.split.held },
      { cls: 'ms-k-rest', label: 'At home', text: hrs(s.split.home), v: s.split.home },
    ], 'Share of the time on duty, held away and at home'), `From your first trip on duty to your last off, ${hm(s.split.span)} in all.`);

    const hours = section('hours', 'When you go on duty', hoursChart(s) + `<dl class="ms-facts">
      ${fact('Trips into the night hours', `${s.nightTrips} of ${s.trips.length}`, 'on duty at some point between midnight and 0600')}
      ${fact('Calls between 2300 and 0600', `${s.nightCalls} of ${s.trips.length}`, 'the call taken as 2 h before on duty')}
      ${fact('Busiest hour for the call', (() => { const m = Math.max(...s.hours.calls); const h = s.hours.calls.indexOf(m); return `${pad(h)}00 to ${pad(h)}59`; })(), `${plural(Math.max(...s.hours.calls), 'call')}`)}</dl>`,
    'Each bar is the hour a trip went on duty. The shaded hours are midnight to 0600.');

    const week = section('weekdays', 'Days of the week', barChart(s.weekdays, { label: (w) => w.name, value: (w) => w.duty, text: (w) => hrs(w.duty), sub: (w) => `${w.worked} of ${w.days}`, aria: 'Hours on duty by day of the week' }) + `<dl class="ms-facts">
      ${fact('Longest run of days with duty', plural(s.maxRun, 'day'))}
      ${fact('Longest run of clear days', plural(s.maxClear, 'day'))}
      ${s.weekends.n ? fact('Weekends fully clear', `${s.weekends.clear} of ${s.weekends.n}`, 'Saturday and Sunday both with no duty') : ''}
      ${fact('Trips started', s.weekdays.map((w) => `${w.name} ${w.starts}`).join(' · '))}</dl>`,
    'Hours on duty that fell on each day. Under each: how many of those days had any duty.');

    const cal = section('calendar', 'Calendar', calendar(s));

    const wk = s.weeks.filter((w) => !(w.partial && !w.duty));
    const weeks = wk.length > 1 ? section('weeks', 'Week by week', barChart(wk.slice(-8), { label: (w) => dm(w.key), value: (w) => w.duty, text: (w) => hrs(w.duty), sub: (w) => plural(w.trips, 'trip'), aria: 'Hours on duty each week', cls: (w) => (w.partial ? 'ms-part' : '') })
      + table(['Week of', 'Trips', 'On duty', 'Days worked', 'Nights', 'Usual call miss'], wk.slice(-26).reverse().map((w) => [esc(dm(w.key)) + (w.partial ? ' <small>part week</small>' : ''), w.trips, hm(w.duty), `${w.worked} of ${w.days}`, w.nights, w.miss == null ? '—' : hm(w.miss)]))
      + `<dl class="ms-facts">${fact('Most on duty in any 7 days', hm(s.most7.min), `starting ${esc(dt(s.most7.at))}`)}</dl>`,
    'Weeks run Sunday to Saturday. A part week is lighter in colour.') : '';

    const months = s.months.length > 1 ? section('months', 'Month by month', table(['Month', 'Trips', 'On duty', 'Days worked', 'Nights', 'Usual call miss'],
      s.months.slice().reverse().map((m) => [`${MONTHS[+m.key.slice(5, 7) - 1]} ${m.key.slice(0, 4)}`, m.trips, hm(m.duty), `${m.worked} of ${m.days}`, m.nights, m.miss == null ? '—' : hm(m.miss)]))) : '';

    const tours = s.tours.length ? section('tours', 'Every round trip', table(['Out', 'On duty out', 'Held away', 'Home', 'On duty home', 'Total away', 'Home before next'],
      s.tours.slice().reverse().map((x) => [`<b>${esc(x.out.id)}</b><small>${esc(dt(x.out.at))}</small>`, `${x.out.durEst ? '~' : ''}${hm(x.out.dur)}`, x.back ? hm(x.held) : '—',
        x.back ? `<b>${esc(x.back.id)}</b><small>${esc(dt(x.back.at))}${x.place ? ` · ${esc(title(x.place))}` : ''}</small>` : '<small>no trip home seen</small>', x.back ? `${x.back.durEst ? '~' : ''}${hm(x.back.dur)}` : '—', x.back ? hm(x.away) : '—', x.homeAfter == null ? '—' : hm(x.homeAfter)]))
      + `<dl class="ms-facts">
      ${fact('Away from home a round trip', hm(s.away.avg), s.away.max != null ? `longest ${hm(s.away.max)}` : '')}
      ${s.held.places.map((p) => fact(`Held at ${esc(title(p.place))}`, hm(p.avg), `${plural(p.n, 'stay')} · longest ${hm(p.max)}`)).join('')}
      ${fact('Held 14 h or more', `${s.held.over14} of ${s.held.n}`)}
      ${fact('At home between trips', hm(s.home.avg), s.home.n ? `shortest ${hm(s.home.min)} · longest ${hm(s.home.max)}` : '')}
      ${fact('Longest trip on duty', s.duty.max ? hm(s.duty.max.dur) : '—', s.duty.max ? `${esc(s.duty.max.id)}, ${esc(dm(s.duty.max.at))}` : '')}
      ${fact('Shortest', s.duty.min ? hm(s.duty.min.dur) : '—', s.duty.min ? `${esc(s.duty.min.id)}, ${esc(dm(s.duty.min.at))}` : '')}</dl>`,
    'A round trip is a trip out of Sarnia and the next trip home. ~ marks an off duty time that is an estimate.') : '';

    const callSec = c.n ? section('calls', 'How much the call moved', splitBar([
      { cls: 'ms-ok', label: 'Within 30 min', text: String(c.ok), v: c.ok },
      { cls: 'ms-warn', label: '30 min to 1 h', text: String(c.warn), v: c.warn },
      { cls: 'ms-bad', label: 'Over 1 h', text: String(c.bad), v: c.bad },
    ], 'Calls by how far they landed from the one you slept on') + `<dl class="ms-facts">
      ${fact('Came later than expected', `${c.later} of ${c.n}`, `${c.earlier} earlier · ${c.exact} on the minute`)}
      ${fact('Times the expected call changed', String(c.changes), `${(c.changes / c.n).toFixed(1)} a trip, after you would have gone to sleep`)}
      ${c.worst ? fact('Furthest off', off(c.worst.off), `${esc(c.worst.id)}, ${esc(dm(c.worst.at))}`) : ''}
      ${c.short ? fact('Short notice', `${c.short} of ${c.n}`, 'the call first showed with under 8 h to go') : ''}</dl>`
      + table(['Train', 'On duty', 'Call you slept on', 'Call you got', 'Off by', 'Changes'], c.list.slice().reverse().map((z) => [`<b>${esc(z.id)}</b>`, esc(dt(z.at)), esc(dt(z.exp)), esc(dt(z.got)), `<span class="ms-pill ${Math.abs(z.off) <= 30 ? 'ms-ok' : Math.abs(z.off) <= 60 ? 'ms-warn' : 'ms-bad'}">${esc(off(z.off))}</span>`, z.n || 0])),
    'The call the board was showing 8 hours before (when you would go to sleep) against the call you actually got.') : '';

    const l = s.lineup;
    const lineSec = l.plan.n || l.order.n ? section('lineup', 'How far to trust the line-up', `<dl class="ms-facts">
      ${l.order.n ? fact('Order time changed after ordering', `${l.order.changed} of ${l.order.n}`, `on duty usually ${hm(l.order.median)} from the first order time`) : ''}
      ${l.plan.n ? fact('First planned time against on duty', `usually ${hm(l.plan.median)} off`, `${l.plan.late} went later · ${l.plan.early} earlier · furthest ${off(l.plan.worst)}`) : ''}
      ${l.plan.n ? fact('Plan changes on your trains', String(l.plan.changes)) : ''}
      ${l.lead.n ? fact('First on the line-up', `usually ${hm(l.lead.median)} ahead`, `least warning ${hm(l.lead.least)}`) : ''}</dl>`) : '';

    const r = s.rest; const b = s.board;
    const restSec = section('rest', 'Rest and your place on the board', `<dl class="ms-facts">
      ${r.afterAway.n ? fact('Away from home: call after rest ended', `usually ${hm(r.afterAway.median)}`, `soonest ${hm(r.afterAway.least)} · longest ${hm(r.afterAway.most)} · ${plural(r.afterAway.n, 'trip')}`) : ''}
      ${r.afterHome.n ? fact('At home: call after rest ended', `usually ${hm(r.afterHome.median)}`, `soonest ${hm(r.afterHome.least)} · longest ${hm(r.afterHome.most)} · ${plural(r.afterHome.n, 'trip')}`) : ''}
      ${r.booked.n ? fact('Rest booked coming home', `${r.booked.short} short · ${r.booked.long} long`, 'short is under 16 h (10 h), long is 16 h or more (24 h)') : ''}
      ${fact('Rests and hold turns on the board', `${r.n} · ${r.holds}`)}
      ${b.n ? fact('Place on the board coming home', `usually ${nth(b.from)}`, `${plural(b.n, 'time')} measured`) : ''}
      ${b.perPlace ? fact('Time to move up one place', `about ${hm(b.perPlace)}`) : ''}
      ${b.wait != null && b.n ? fact('Home on the board to the next call', `usually ${hm(b.wait)}`) : ''}
      ${b.firstOut.length ? fact('First out before the call', `usually ${hm(median(b.firstOut))}`, `longest ${hm(Math.max(...b.firstOut))}`) : ''}</dl>`);

    const resetSec = s.resets.length || s.due ? section('resets', 'Resets', `${s.resets.length ? table(['Reset', 'How', 'Since the one before', 'Trips before it', 'On duty before it'], s.resets.slice().reverse().map((x) => [esc(dt(x.at)), x.kind === 'manual' ? 'put on a reset' : '32 h off, two nights', x.since == null ? '—' : `${(x.since / DAY).toFixed(1)} days`, x.trips == null ? '—' : x.trips, x.duty == null ? '—' : hm(x.duty)])) : ''}
      <dl class="ms-facts">${s.due && s.due.dueText ? fact('Next reset needed by', esc(s.due.dueText), s.due.level === 'red' ? 'within 24 h' : s.due.level === 'yellow' ? 'within 2 days' : '') : ''}
      ${s.sinceReset ? fact('Since your last reset', `${plural(s.sinceReset.trips, 'trip')} · ${hm(s.sinceReset.duty)} on duty`, `reset ${esc(dt(s.sinceReset.at))}`) : ''}</dl>`) : '';

    const turnSec = s.byTurn.length ? section('turns', s.byTurn.length > 1 ? 'Your turns, side by side' : 'Your turn', table(['Turn', 'Trips', 'On duty going out', 'On duty coming home', 'A trip', 'Total away', 'Usual call miss', 'Call changes'],
      s.byTurn.map((t) => [`<b>${esc(t.turn)}</b><small>${esc(dm(t.from))} to ${esc(dm(t.to))}</small>`, t.trips, esc(t.out.join(' ')) || '—', esc(t.home.join(' ')) || '—', hm(t.duty), hm(t.away), t.miss == null ? '—' : hm(t.miss), t.calls ? t.changes : '—']))) : '';

    const people = s.partners.length || s.numbers.length ? section('with', 'Worked with, and on what', `<dl class="ms-facts">
      ${s.partners.length ? fact('Worked with most', s.partners.map(([p, n]) => `${esc(p)} <small class="ms-inline">× ${n}</small>`).join(' · ')) : ''}
      ${s.numbers.length ? fact('Trains by number', s.numbers.map(([p, n]) => `${esc(p)} <small class="ms-inline">× ${n}</small>`).join(' · ')) : ''}</dl>`) : '';

    const f = s.flags;
    const flagSec = f.passed.length || f.stale.length || f.spares ? section('flags', 'Things on the record', `<dl class="ms-facts">
      ${f.passed.length ? fact('Times someone else went', String(f.passed.length), `${f.likely} marked likely runaround · ${f.possible} possible · ${f.explained} explained`) : ''}
      ${f.stale.length ? fact('Your trains left stale', String(f.stale.length), f.staleWorst ? `longest ${f.staleWorst.min} min past the call still only planned (${esc(f.staleWorst.train)})` : '') : ''}
      ${f.spares ? fact('Goes-spare notes on your turn', String(f.spares)) : ''}</dl>
      ${f.passed.filter((x) => x.result !== 'explained').length ? table(['Seen', 'Train', 'Who went', 'Marked'], f.passed.filter((x) => x.result !== 'explained').reverse().map((x) => [esc(dt(x.seen)), `<b>${esc(x.train)}</b>`, esc(x.went || '?'), esc(x.result)])) : ''}`) : '';

    const foot = `<p class="ms-foot">Worked out from the saved board checks, never from a time sheet. Off duty comes from the rest times CATS showed; a yard job is taken as 8 h (12 h for YSBY). A day you were booked off, on vacation or not on any board looks the same here: no duty. Pay, miles and claims are not tracked.</p>`;
    return `<div class="ms">${head}${tiles}${time}${hours}${week}${cal}${weeks}${months}${tours}${callSec}${lineSec}${restSec}${resetSec}${turnSec}${people}${flagSec}${foot}</div>`;
  }

  // The tab's own styles, in the page's colours (public/board.html tokens).
  const CSS = `
  .ms { display: grid; gap: 22px; padding: 4px 0 28px; color: var(--ink); font-family: var(--body); }
  .ms h2 { margin: 0; font: 600 26px/1.1 var(--display); letter-spacing: .01em; }
  .ms h3 { margin: 0 0 4px; font: 600 19px/1.2 var(--display); letter-spacing: .02em; text-wrap: balance; }
  .ms-code { font: 500 14px var(--mono); color: var(--soft); margin-left: 6px; }
  .ms-head { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: flex-end; justify-content: space-between; }
  .ms-note { margin: 2px 0 10px; color: var(--soft); font-size: 13.5px; max-width: 65ch; }
  .ms-empty { color: var(--soft); padding: 18px 0; }
  .ms-ranges { display: flex; flex-wrap: wrap; gap: 6px; }
  .ms-ranges button { font: 500 13.5px var(--body); padding: 7px 12px; border: 1px solid var(--rule); border-radius: 999px; background: var(--sheet); color: var(--ink); cursor: pointer; }
  .ms-ranges button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .ms-ranges button:focus-visible, .ms [data-tip]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .ms-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .ms-tile { background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 12px 14px; display: grid; gap: 2px; min-width: 0; }
  .ms-tile b { font: 600 32px/1 var(--display); font-variant-numeric: tabular-nums; }
  .ms-tile b i { font: 500 16px var(--display); color: var(--soft); font-style: normal; }
  .ms-tile span { font-size: 13.5px; }
  .ms-tile small { color: var(--soft); font-size: 12.5px; }
  .ms-sec { background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 14px 16px 16px; min-width: 0; }
  .ms-chart { display: block; width: 100%; height: auto; max-width: 560px; }
  .ms-chart text { font-family: var(--body); fill: var(--soft); }
  .ms-tick { font-size: 11px; }
  .ms-strong { fill: var(--ink) !important; font-weight: 600; font-size: 12px; }
  .ms-val { font-size: 11.5px; fill: var(--ink) !important; font-variant-numeric: tabular-nums; }
  .ms-axis { stroke: var(--rule); stroke-width: 1; }
  .ms-night { fill: var(--plan-tint); opacity: .55; }
  .ms-bar { fill: var(--accent); }
  .ms-bar.ms-part { fill: color-mix(in srgb, var(--accent) 45%, var(--sheet)); }
  rect.ms-k-out { fill: var(--accent); } rect.ms-k-home { fill: var(--amber); } rect.ms-k-yard { fill: var(--poolB); }
  i.ms-k-out { background: var(--accent); } i.ms-k-home { background: var(--amber); } i.ms-k-yard { background: var(--poolB); }
  i.ms-k-rest { background: var(--plan-tint); box-shadow: inset 0 0 0 1px var(--rule); }
  i.ms-ok { background: var(--go); } i.ms-warn { background: var(--amber); } i.ms-bad { background: var(--stop); }
  .ms-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 8px 0 6px; font-size: 13px; color: var(--soft); }
  .ms-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .ms-legend b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .ms-legend i { width: 12px; height: 12px; border-radius: 3px; flex: none; }
  .ms-split { display: flex; gap: 2px; height: 26px; max-width: 560px; }
  .ms-split i { min-width: 3px; border-radius: 4px; }
  .ms-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 18px; margin: 12px 0 0; }
  .ms-fact { min-width: 0; border-top: 1px solid var(--rule-soft); padding-top: 8px; }
  .ms-fact dt { color: var(--soft); font-size: 12.5px; }
  .ms-fact dd { margin: 2px 0 0; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .ms-fact dd small { display: block; font-weight: 400; color: var(--soft); font-size: 12.5px; }
  .ms-fact dd small.ms-inline { display: inline; }
  .ms-scroll { overflow-x: auto; margin-top: 10px; }
  .ms-table { border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .ms-table th { text-align: left; font-weight: 500; color: var(--soft); font-size: 12px; padding: 6px 12px 6px 0; border-bottom: 1px solid var(--rule); white-space: nowrap; }
  .ms-table td { padding: 7px 12px 7px 0; border-bottom: 1px solid var(--rule-soft); vertical-align: top; white-space: nowrap; }
  .ms-table td small { display: block; color: var(--soft); font-size: 12px; }
  .ms-table b { font-family: var(--mono); font-weight: 500; }
  .ms-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12.5px; }
  .ms-pill.ms-ok { background: var(--go-tint); color: var(--go); } .ms-pill.ms-warn { background: var(--amber-tint); color: var(--amber); } .ms-pill.ms-bad { background: var(--stop-tint); color: var(--stop); }
  .ms-cal { max-width: 430px; }
  .ms-calhead, .ms-calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .ms-calhead span { font-size: 11.5px; color: var(--soft); text-align: center; padding-bottom: 3px; }
  .ms-day { aspect-ratio: 1; border-radius: 5px; display: grid; align-content: center; justify-items: center; font-style: normal; line-height: 1.05; min-width: 0; }
  .ms-day b { font: 500 12px var(--body); } .ms-day span { font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .ms-pad { visibility: hidden; }
  .ms-s0 { background: var(--plan-tint); color: var(--soft); }
  .ms-s1 { background: color-mix(in srgb, var(--accent) 22%, var(--sheet)); color: var(--ink); }
  .ms-s2 { background: color-mix(in srgb, var(--accent) 45%, var(--sheet)); color: var(--ink); }
  .ms-s3 { background: color-mix(in srgb, var(--accent) 72%, var(--sheet)); color: var(--accent-ink); }
  .ms-s4 { background: var(--accent); color: var(--accent-ink); }
  .ms-unseen { background: repeating-linear-gradient(135deg, var(--plan-tint) 0 4px, var(--sheet) 4px 8px); box-shadow: inset 0 0 0 1px var(--rule-soft); }
  .ms-legend .ms-day { width: 14px; height: 14px; aspect-ratio: auto; }
  .ms-foot { color: var(--soft); font-size: 12.5px; max-width: 70ch; margin: 0; }
  .ms-tip { position: fixed; z-index: 50; pointer-events: none; background: var(--ink); color: var(--sheet); font: 500 12.5px var(--body); padding: 5px 9px; border-radius: 6px; max-width: 260px; }
  @media (max-width: 520px) { .ms-sec { padding: 12px 12px 14px; } .ms-tile b { font-size: 27px; } }
  `;

  // Range buttons and the value beside the pointer. onRange(key) redraws.
  function wire(box, onRange) {
    let el = null;
    const hide = () => { if (el) { el.remove(); el = null; } };
    box.querySelectorAll('[data-ms-range]').forEach((b) => { b.onclick = () => { hide(); onRange(b.dataset.msRange); }; });
    const show = (target, x, y) => {
      if (!el) { el = document.createElement('div'); el.className = 'ms-tip'; document.body.appendChild(el); }
      el.textContent = target.dataset.tip;
      const w = el.offsetWidth; const h = el.offsetHeight;
      el.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, x - w / 2))}px`;
      el.style.top = `${y - h - 12 < 6 ? y + 16 : y - h - 12}px`;
    };
    box.addEventListener('pointermove', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) show(t, e.clientX, e.clientY); else hide(); });
    box.addEventListener('pointerleave', hide);
    box.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { const r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.top); } });
    box.addEventListener('focusout', hide);
  }

  const api = { V, personRecord, daySpans, build, merge, stats, html, wire, rangeOf, CSS, RANGES };
  if (node) module.exports = api;
  else root.BoardMyStats = api;
})(this);

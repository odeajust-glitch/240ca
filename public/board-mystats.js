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

  // One number, two turns (501/502) and trainee slots have their own keys, as
  // in the reset tracker (lib/board/resets.js keyOf): S501-CO, S303-ET.
  const keyOf = (turn, craft) => (/^(TT|ET)$/.test(craft || '') ? `${turn}-${craft}` : BT.SHARED.test(turn) && craft ? `${turn}-${craft === 'CO' ? 'CO' : 'EN'}` : turn);
  const baseKey = (k) => String(k || '').replace(/-(CO|EN|TT|ET)$/, '');
  // A yard job's id (YBHS01, YMXS02), as on the Call Board's yard list.
  const YARD = /^Y[A-Z]{3}\d{2}$/;
  const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * 60 : 8 * 60);
  // When a yard shift ended, from when its job left the Call Board (owner, 2026-11-13: real shift ends and overtime
  // for yard workers; the test site's pieces): halfway between the last check that listed the run and the first
  // that did not (the checks are about 8 minutes apart). null, not trusted: not seen leaving (still on, or no check
  // within 30 min after the last), the checks missed its start, or a length out of reason (under 2 h, or over the
  // job's own length + 4 h: a few jobs stay listed for days). run: lib/board/mystats.js collectYard's.
  function boardEnd(run, on, job) {
    if (!run || run.gone == null || run.last == null || run.gone - run.last > 30 || run.first > on + 30) return null;
    const end = Math.round((run.last + run.gone) / 2);
    const len = end - on;
    return len >= 120 && len <= yardMinutes(job) + 240 ? end : null;
  }
  // "EN S304 · ET S303 · CO SB04" → [{ cc: 'EN', turn: 'S304' }, …]
  const crewParts = (crew) => String(crew || '').split(' · ').filter(Boolean).map((c) => { const w = c.trim().split(/\s+/); return { cc: w[0], turn: w[w.length - 1] }; });
  // Whether a crew line puts this turn on the train in that place: a trainee
  // slot only on its own TT / ET line, the turn's holder only on a line that
  // is not a trainee's. (Found 2026-11-11: "EN S304 · ET S303 · CO SB04" gave
  // S303's engineer a train only S303's trainee rode.) No crew read: nothing
  // to go on, so yes.
  function onCrew(crew, turn, trainee = '') {
    const parts = crewParts(crew);
    if (!parts.length) return true;
    return parts.some((x) => x.turn === turn && (trainee ? x.cc === trainee : !/^(TT|ET)$/.test(x.cc)));
  }

  // Turn History's person search (public/board.html personHistory): each
  // turn's history only while they were on it; a trainee's slot rides the
  // turn's trains; on 501/502 only their craft; a train worked while filling
  // in on another turn comes from their own turn's record. A test holds the
  // two equal on ordinary turns.
  // strict (My stats, 2026-11-11, after checking 168 people's records against
  // the names read off the Call Board): also
  //   - a make-up turn (MU01…) is a placeholder several crews use at once, so
  //     being seen on one gives no train by the turn alone;
  //   - a train kept on a turn's record as "working another job" belongs to
  //     whoever was seen on that job, not to whoever holds the turn;
  //   - the crew line must have the turn in their own place (onCrew);
  //   - their craft on 501/502 is the one seen on any of their stretches.
  function personRecord(stretches, all, myCraft = null, { strict = false, anyCraft = '' } = {}) {
    const within = (t, e) => t && t >= e.from && t <= e.to;
    // On the turn when the train went on duty. Turn History goes by when the
    // turn was first seen on it (about the call); strict goes by the on-duty
    // time itself, three hours' grace before the stretch and one after (a
    // stretch breaks where the names went unread for 45 minutes).
    const onDutyIn = (o, e) => {
      if (!strict) return within(o.onDutySeen, e);
      const on = min(T.resolve(o.onDutyAt, o.onDutySeen) || o.onDutySeen);
      return on != null && on >= min(e.from) - 180 && on <= min(e.to) + 60;
    };
    const rec = { changes: [], orders: [], rests: [], spares: [] };
    for (const e of stretches.filter((x) => TRAINEE.test(x.turn))) {
      const [, base, kind] = TRAINEE.exec(e.turn);
      const r = all[base];
      if (!r) continue;
      rec.orders.push(...r.orders.filter((o) => (o.onDuty ? onDutyIn(o, e) : within(o.first, e) || within(o.last, e)) && !o.workedBy && (!strict || onCrew(o.crew, base, kind)))
        .map((x) => ({ ...x, turn: base, trainee: kind, base })));
    }
    for (const e of stretches) {
      if (TRAINEE.test(e.turn)) continue;
      const r = all[e.turn];
      if (!r) continue;
      const tag = (x) => ({ ...x, turn: e.turn, own: !!e.own });
      rec.changes.push(...r.changes.filter((c) => within(c.taken, e)).map(tag));
      const theirs = (o) => (o.onDuty ? onDutyIn(o, e) : within(o.first, e) || within(o.last, e));
      const newest = !stretches.some((x) => x.turn === e.turn && x.to > e.to);
      const craft = e.craft || (BT.SHARED.test(e.turn) ? (newest && myCraft ? myCraft(e.turn) : '') || (strict ? anyCraft : '') : '');
      const placeholder = strict && BT.PLACEHOLDER.test(e.turn);
      if (!placeholder) {
        rec.orders.push(...r.orders.filter((o) => theirs(o) && !(craft && e.own && o.coveredCraft === craft)
          && (!strict || ((!o.job || o.job === e.turn) && (o.yard || !o.onDuty || onCrew(o.crew, e.turn)) && (!craft || !o.onDuty || !o.crew || BT.crewHasCraft(o.crew, e.turn, craft)))))
          .map((o) => ({ ...tag(o), ...(craft ? { craft } : {}) })));
      }
      rec.rests.push(...r.rests.filter((x) => within(x.seen, e) && (!craft || !x.craft || x.craft === craft)).map(tag));
      rec.spares.push(...r.spares.filter((x) => within(x.seen, e) || within(x.last, e)).map(tag));
    }
    const ownTurns = [...new Set(stretches.filter((e) => e.own).map((e) => e.turn))];
    for (const e of stretches.filter((x) => !x.own)) {
      for (const t of ownTurns) {
        const r = all[t];
        if (!r) continue;
        rec.orders.push(...r.orders.filter((o) => o.job === e.turn && (o.onDuty ? onDutyIn(o, e) : within(o.first, e) || within(o.last, e))).map((x) => ({ ...x, turn: t, own: true })));
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
  // tracker: what the reset tracker read (lib/board/mystats.js trackerOf):
  //   named      their trips by name: a train whose crew lines had their name
  //              (from 2026-11-03), a yard job they were on duty on
  //              [{ train, on, first, last, job, yard, sure }] (minutes)
  //   turnTrips  every turn's trains as the Call Board listed them, with the
  //              on-duty time last shown and when the turn was last on it
  //   taken(train, on, keys)  someone else's name was on that job on that train
  //   offOf(trip, ownKey)     when that trip ended, as the reset tracker works it out
  //   yardFrom   the first check that knew who was on duty on a yard job by name
  // What they worked (checked 2026-11-11 against the names for 168 people):
  //   1. a train their name was on is theirs, at the on-duty time last shown;
  //   2. a train their turn was on (Turn History's way, strict) is theirs
  //      unless someone else's name was on that job, or the turn was off the
  //      train again before it went on duty;
  //   3. a yard shift only by name: a yard job's history keeps one line per
  //      job, not one per day, so the turn's record cannot say. Seen on the
  //      job for a shift's length, or marked on duty by the checker. Listed on
  //      a yard job day after day (its own crew in the crews in town, or TEMP
  //      on it) says whose job it is, not who came in: those days go in `unk`
  //      and the page leaves them out of its counts;
  //   4. the same duty under two train numbers (renumbered while the crew was
  //      on it) is one trip.
  function build({ stretches = [], turns = {}, trains = [], offs = {}, resets: resetsIn = [], due: dueIn = null, sleep = [], runLog = [], stale = [], craftNow = null, tracker = null, yardCraft = null } = {}) {
    let resets = resetsIn; let due = dueIn;
    const anyCraft = (stretches.find((e) => e.craft && BT.SHARED.test(e.turn)) || {}).craft || '';
    const rec = personRecord(stretches, turns, craftNow, { strict: true, anyCraft });
    const byId = new Map();
    for (const r of trains) { const l = byId.get(r.id); if (l) l.push(r); else byId.set(r.id, [r]); }
    const rowOf = (id, on) => (byId.get(id) || []).find((r) => r.onDuty && Math.abs(min(r.onDuty) - on) <= DAY) || null;
    const spanAt = (turn, at) => stretches.find((e) => e.turn === baseOf(turn) && at >= e.from && at <= e.to && (!e.craft || !craftOf(turn) || craftOf(turn) === e.craft));
    // Their own turn then: the latest own stretch begun by then, if they were still on it within two days.
    const ownAt = (m) => {
      let best = null;
      for (const e of stretches) { if (!e.own) continue; const f = min(e.from); if (f == null || f > m + 60) continue; if (!best || f > best.f) best = { f, e }; }
      return best && min(best.e.to) >= m - 2 * DAY ? best.e : null;
    };
    const ownKeyAt = (m) => { const e = ownAt(m); return e ? keyOf(e.turn, e.craft) : null; };

    // The call the sleep tracker kept for that train on that turn, within a day
    // of that on-duty time (a train's on-duty time moves; its name has its day
    // in it). A yard job has the same name every day, so only within 3 hours
    // (found 2026-11-12: a shift given the call for the day before's).
    const callOf = (train, turn, cc, on) => sleep.filter((x) => x.train === train && !x.takenOff && x.off != null && baseOf(x.turn) === turn && (!craftOf(x.turn) || !cc || craftOf(x.turn) === cc) && Math.abs(min(x.onDuty) - on) <= (YARD.test(train) ? 180 : DAY))
      .sort((x, y) => Math.abs(min(x.onDuty) - on) - Math.abs(min(y.onDuty) - on))[0];
    const callFields = (z) => (z ? { call: { exp: z.expected, first: z.firstCall, got: z.call, off: z.off, n: (z.shifts || []).length, ...(z.short ? { short: true } : {}) } } : {});
    // One trip from a turn's order line (or a stand-in for one), at the on-duty time settled on.
    const tripOf = (o, on, tracked, named) => {
      const at = T.fromMin(on);
      const row = rowOf(o.train, on);
      let off = null; let est = false;
      if (tracked && tracker && tracker.offOf) {
        const r = tracker.offOf({ train: tracked.train, on, last: tracked.last, job: tracked.job }, ownKeyAt(on));
        if (r && r.off > on) { off = r.off; est = /^(call board|yard)$/.test(r.how); }
      } else if (!tracker) {
        const x = offs[o.train];
        if (x && x.off && min(x.off) > on && min(x.off) - on <= 16 * 60 && Math.abs(min(x.on) - on) <= 60) { off = min(x.off); est = /^(call board|yard)$/.test(x.how); }
      }
      // Who they worked with: the crew less their own place on it.
      const shared = BT.SHARED.test(o.turn);
      const mates = crewParts(o.crew).filter((c) => {
        if (o.trainee) return true;
        if (shared && c.turn === o.turn) return o.craft ? (o.craft === 'CO' ? c.cc !== 'CO' : c.cc === 'CO') && !/^(TT|ET)$/.test(c.cc) : false;
        return c.turn !== o.turn && c.turn !== o.job;
      }).map((c) => `${c.cc} ${c.turn}`);
      // The call: their own craft's (a trainee's is the conductor's for TT, the engineer's for ET).
      const z = callOf(o.train, o.turn, o.trainee ? (o.trainee === 'TT' ? 'CO' : 'EN') : o.craft || '', on);
      return {
        on, last: tracked ? tracked.last : 0, key: tracked ? tracked.job : keyOf(o.turn, o.trainee || o.craft || ''),
        id: o.train, at, turn: o.turn,
        ...(o.craft ? { craft: o.craft } : {}), ...(o.station ? { st: o.station } : {}), ...(o.job && o.job !== o.turn ? { job: o.job } : {}),
        ...(o.yard ? { yard: true } : {}), ...(o.trainee ? { tt: o.trainee } : {}), ...(row && row.deadhead ? { dh: true } : {}),
        ...(off != null ? { off: T.fromMin(off), ...(est ? { est: true } : {}) } : {}),
        ...(mates.length ? { with: mates } : {}),
        ...(row && row.firstPlan ? { plan: row.firstPlan, pc: row.planChanges || 0 } : {}),
        ...(row && row.firstOrder ? { ord: row.firstOrder, oc: row.orderChanges || 0 } : {}),
        ...(row && row.firstSeen ? { seen: row.firstSeen } : {}),
        ...callFields(z),
        ...(named ? { nm: 1 } : {}),
      };
    };

    // By the turn (Turn History's way). A yard job's line is one for all its days: left to the names.
    const cands = rec.orders.filter((o) => o.onDuty && !o.workedBy && !(tracker && o.yard)).map((o) => {
      const at = T.resolve(o.onDutyAt, o.onDutySeen) || o.onDutySeen;
      const line = /working (\S+) \((\w+)\)/.exec(o.onDuty || '');
      const both = (t) => [`${t}-CO`, `${t}-EN`];
      const keys = o.job && o.job !== o.turn ? (BT.SHARED.test(o.job) && !line ? both(o.job) : [keyOf(o.job, line ? line[2] : '')])
        : o.trainee ? [`${o.turn}-${o.trainee}`] : BT.SHARED.test(o.turn) ? (o.craft ? [keyOf(o.turn, o.craft)] : both(o.turn)) : [o.turn];
      return { o, on: min(at), keys };
    }).filter((c) => c.on != null);

    let list = [];
    let coming = []; // called for, not on duty yet: no trip, but the reset clock counts it
    const unk = [];
    if (!tracker) list = cands.map((c) => tripOf(c.o, c.on, null, false));
    else {
      // Their name on a train: one trip a train, at the on-duty time last shown.
      const groups = [];
      for (const t of (tracker.named || []).filter((x) => !x.yard).sort((x, y) => x.last - y.last)) {
        const g = groups.find((x) => x.train === t.train && Math.abs(x.on - t.on) <= DAY);
        if (g) Object.assign(g, { on: t.on, job: t.job, first: Math.min(g.first, t.first), last: Math.max(g.last, t.last) }); else groups.push({ ...t });
      }
      const turnTrip = (keys, id, on) => {
        let best = null;
        for (const k of keys) for (const e of Object.values((tracker.turnTrips || {})[k] || {})) if (e.train === id && Math.abs(e.on - on) <= DAY && (!best || e.last > best.last)) best = e;
        return best;
      };
      // Called for a train is not working it (found 2026-11-11: an engineer on
      // a train's crew lines for one check, another in his place ten minutes
      // later; a conductor called, then a spare on the job by on duty). Still
      // on it when it went on duty: seen there at or after that time. Seen
      // only before: not theirs if someone else's name took the job or the
      // turn's own line left the train; if the line stayed and no one else
      // was named, the name just wasn't read (kept). The same for a trainee:
      // of 56 trainee lines read, 50 stayed on the train for the whole trip
      // and the 6 that went within a check or two were each followed by the
      // trainee on a different train.
      const stayed = (e, keys) => {
        if (e.last >= e.on - 5) return true;
        if (tracker.taken && tracker.taken(e.train, e.on, keys)) return false;
        const tt = turnTrip(keys, e.train, e.on);
        return !!tt && tt.last >= tt.on - 5;
      };
      coming = tracker.now == null ? [] : groups.filter((g) => g.on > tracker.now && g.last >= tracker.now - 10);
      const used = new Set();
      for (const c of cands) {
        const g = groups.find((x) => x.train === c.o.train && Math.abs(x.on - c.on) <= DAY);
        if (g) { used.add(g); if (stayed(g, [g.job])) list.push(tripOf(c.o, g.on, g, true)); continue; }
        if (tracker.taken && tracker.taken(c.o.train, c.on, c.keys)) continue; // someone else's name was on that job
        const tt = turnTrip(c.keys, c.o.train, c.on);
        if (tt) { if (tt.last >= tt.on - 5) list.push(tripOf(c.o, tt.on, tt, false)); continue; } // off the train again before it went on duty: not worked
        if (min(c.o.last) == null || min(c.o.last) >= c.on - 5) list.push(tripOf(c.o, c.on, null, false));
      }
      // Named on a train their turn's record doesn't give them: the details from the job's own line.
      for (const g of groups) {
        if (used.has(g) || !stayed(g, [g.job])) continue;
        const base = baseKey(g.job); const tail = (/-(CO|EN|TT|ET)$/.exec(g.job) || [])[1] || '';
        const src = ((turns[base] || {}).orders || []).find((o) => o.train === g.train && o.onDuty && Math.abs(min(T.resolve(o.onDutyAt, o.onDutySeen) || o.onDutySeen) - g.on) <= DAY);
        const own = ownAt(g.on); const trainee = /^(TT|ET)$/.test(tail) ? tail : '';
        const mine = !trainee && own && !TRAINEE.test(own.turn) ? own.turn : base;
        list.push(tripOf({ train: g.train, turn: mine, craft: /^(CO|EN)$/.test(tail) ? tail : '', trainee, job: mine !== base ? base : '',
          station: src ? src.station : (rowOf(g.train, g.on) || {}).station || '', crew: src ? src.crew : '' }, g.on, g, true));
      }
      // Yard shifts. A yard job is on the Call Board from about two hours
      // before it goes on duty until a while after it ends, its crew by name
      // under it. Since 2026-11-03 the crews in town also list each yard job's
      // own people (and anyone TEMP on it) all day, every day: that says whose
      // job it is, not who came in. So a name counts for a run when it was on
      // the job only while the job was on the Call Board (or the checker
      // marked it on duty); someone seen on the job at other hours as well is
      // on its list in town, and their days are known only from the job's own
      // crew lines showing a turn of theirs beside a craft.
      const yard = tracker.yard || null;
      const runsOf = (job) => Object.values(((yard || {}).runs || {})[job] || {}).sort((x, y) => x.first - y.first);
      // Some of [from, to] is outside every time the job was on the Call Board (an hour's slack).
      const offBoard = (job, from, to) => {
        let at = from;
        for (const r of runsOf(job)) { if (r.last + 60 < at) continue; if (r.first - 60 > at) break; at = Math.max(at, r.last + 60); if (at >= to) break; }
        return at < to;
      };
      const inTown = (e) => !!e.own || (yard ? offBoard(e.turn, min(e.from), min(e.to)) : min(e.to) - min(e.from) > 20 * 60);
      // A shift is taken as 8 h (12 h on a YSBY job). Off the job's crew lines
      // while the job was still on the Call Board: gone within the first hour
      // = someone took their place at the start (not worked: null); later =
      // they left then.
      // cb: when the shift ended by the Call Board (boardEnd), kept beside the 8 / 12 h the rest of the site
      // goes by; cc: the craft they worked it as, when read; yw: the turns on its crew lines besides their own
      // (spares filling in). The three are for the test site's yard pieces (owner, 2026-11-13).
      const yardTrip = (job, on, last, own, cc = '') => {
        const run = (((yard || {}).runs || {})[job] || {})[on];
        const full = on + yardMinutes(job);
        const early = !!run && run.last - last > 45 && last < full - 30;
        if (early && last < on + 60) return null;
        const mine = own && !TRAINEE.test(own.turn) ? own.turn : job;
        const cb = early ? null : boardEnd(run, on, job);
        const yw = run && run.crew ? run.crew.filter((x) => x.split(' ').pop() !== mine) : [];
        return { on, last, key: job, id: job, at: T.fromMin(on), turn: mine, st: 'SARNIA', ...(mine !== job ? { job } : {}), yard: true, off: T.fromMin(early ? last : full), est: true, ...callFields(callOf(job, mine, '', on)), nm: 1,
          ...(cb != null ? { cb: T.fromMin(cb) } : {}), ...(cc ? { cc } : {}), ...(yw.length ? { yw } : {}) };
      };
      const addYard = (t) => { if (t) list.push(t); };
      for (const y of (tracker.named || []).filter((x) => x.yard)) {
        if (y.last < y.on - 5) continue;
        const cover = stretches.filter((e) => e.turn === y.train && min(e.from) <= y.last + 5 && min(e.to) >= y.first - 5);
        if (!y.sure && (!cover.length || cover.some(inTown))) continue;
        addYard(yardTrip(y.train, y.on, y.last, ownAt(y.on), y.cc || ''));
      }
      // The job's own crew lines showing their turn (a spare's own turn beside the craft they filled).
      const lastOwn = (m) => { let best = null; for (const e of stretches) { if (!e.own || YARD.test(e.turn) || TRAINEE.test(e.turn)) continue; const f = min(e.from); if (f != null && f <= m + 60 && (!best || f > best.f)) best = { f, e }; } return best ? best.e : null; };
      const proven = new Set(); // yard jobs their turn was read on
      for (const turn of new Set(stretches.filter((e) => e.own && !YARD.test(e.turn) && !TRAINEE.test(e.turn)).map((e) => e.turn))) {
        for (const r of Object.values(((yard || {}).byTurn || {})[turn] || {})) {
          const own = lastOwn(r.on);
          // Only for someone also named on that job then (its crew lines or its list in town): a turn on a yard job's lines can be a stale one, held by someone else by now.
          const named = stretches.some((e) => e.turn === r.job && min(e.from) <= r.last + 60 && min(e.to) >= r.first - 60);
          if (r.last < r.on - 5 || !named || !own || own.turn !== turn || (tracker.heldByOther && tracker.heldByOther(turn, r.on))) continue;
          proven.add(r.job);
          if (!list.some((t) => t.yard && t.id === r.job && Math.abs(t.on - r.on) <= 60)) addYard(yardTrip(r.job, r.on, r.last, own, r.cc || ''));
        }
      }
      // On a yard job's list with nothing to say which days they came in.
      for (const e of stretches) {
        if (!YARD.test(e.turn) || !inTown(e)) continue;
        const to = tracker.yardFrom != null && T.fromMin(tracker.yardFrom) < e.to ? T.fromMin(tracker.yardFrom) : e.to;
        if (to <= e.from || (!e.own && proven.has(e.turn))) continue;
        const span = { job: e.turn, from: dayOf(e.from), to: dayOf(to) };
        const was = unk.find((x) => x.job === span.job && dayNum(span.from) - dayNum(x.to) <= 1 && dayNum(x.from) - dayNum(span.to) <= 1);
        if (was) { if (span.from < was.from) was.from = span.from; if (span.to > was.to) was.to = span.to; } else unk.push(span);
      }
    }

    // The same duty under two train numbers: one trip, under the number seen last.
    list.sort((a, b) => a.on - b.on || a.last - b.last);
    const merged = [];
    for (const t of list) {
      const prev = merged[merged.length - 1];
      if (prev && !prev.yard && !t.yard && Math.abs(t.on - prev.on) <= 30) {
        const [keep, drop] = t.last >= prev.last ? [t, prev] : [prev, t];
        const aka = [...new Set([...(prev.aka || []), ...(t.aka || []), drop.id])].filter((x) => x !== keep.id);
        merged[merged.length - 1] = { ...drop, ...keep, ...(aka.length ? { aka } : {}) };
      } else if (prev && prev.yard && t.yard && t.on < min(prev.off)) {
        // Moved from one yard job to another in the same shift: one shift, from the first to the end of the second.
        const aka = [...new Set([...(prev.aka || []), t.id])].filter((x) => x !== prev.id);
        merged[merged.length - 1] = { ...prev, off: t.off > prev.off ? t.off : prev.off, last: Math.max(prev.last, t.last), ...(aka.length ? { aka } : {}), ...(t.cb && (!prev.cb || t.cb > prev.cb) ? { cb: t.cb } : {}) };
      } else merged.push(t);
    }
    // Nobody is on two trains at once: a trip read off the turn gives way to one read by name; otherwise the earlier one ended when the next began.
    for (let i = 0; i < merged.length - 1;) {
      const a = merged[i]; const b = merged[i + 1];
      const end = a.off ? min(a.off) : null;
      if (end == null || end <= b.on) { i++; continue; }
      if (a.nm && !b.nm) merged.splice(i + 1, 1);
      else if (b.nm && !a.nm) { merged.splice(i, 1); if (i > 0) i--; } else { merged[i] = { ...a, off: T.fromMin(b.on), est: true, ...(a.cb && min(a.cb) > b.on ? { cb: T.fromMin(b.on) } : {}) }; i++; }
    }
    // A shift's end by the Call Board never runs into the next trip.
    for (let i = 0; i < merged.length - 1; i++) if (merged[i].cb && min(merged[i].cb) > merged[i + 1].on) merged[i] = { ...merged[i], cb: T.fromMin(merged[i + 1].on) };
    const trips = merged.map(({ on, last, key, ...t }) => t);

    // Days off on a turn of their own, said only where the board says why (owner, 2026-11-13: the yard workers'
    // calendar; the test site's pieces): booked off (Train Service 4's days off lines for their turn and craft),
    // their own yard job went spare for their craft (the vacancy list; craft not read: only when two crafts went
    // spare), or their own yard job did not go on duty that day while the checks were running. A day they went on
    // duty, or one a yard job's list could not say who came in (unk), never.
    const yoff = [];
    const Y = tracker && tracker.yard;
    if (Y) {
      const worked = new Set(merged.map((t) => dayOf(t.at)));
      const covered = (a, b) => (Y.cover || []).some(([x, y]) => x <= a && y >= b);
      const unkDay = (job, d) => unk.some((u) => u.job === job && u.from <= d && u.to >= d);
      const craftOn = (job) => { const t = [...merged].reverse().find((x) => x.yard && x.id === job && x.cc); return t ? t.cc : (yardCraft && yardCraft(job)) || ''; };
      const trainee = (c) => /^(TT|ET)$/.test(c || '');
      const books = Object.values(Y.booked || {});
      const told = new Set();
      for (const e of stretches) {
        if (!e.own || TRAINEE.test(e.turn)) continue;
        const job = YARD.test(e.turn);
        const cc = job ? craftOn(e.turn) : e.craft || '';
        const mineLine = (c) => (job ? (cc ? c === cc : false) : !trainee(c) && (!e.craft || !c || (c === 'CO') === (e.craft === 'CO')));
        const runs = job ? Object.values((Y.runs || {})[e.turn] || {}) : [];
        const usual = (() => { const c = new Map(); for (const r of runs) { const m = ((r.on % DAY) + DAY) % DAY; c.set(m, (c.get(m) || 0) + 1); } let best = null; for (const [m, k] of c) if (best == null || k > c.get(best)) best = m; return best; })();
        const spares = job ? (Y.spare || {})[e.turn] || {} : {};
        for (let n = dayNum(dayOf(e.from)); n <= dayNum(dayOf(e.to)); n++) {
          const d = dayStr(n); const a = n * DAY;
          if (worked.has(d) || told.has(d) || (job && unkDay(e.turn, d))) continue;
          let why = '';
          if (books.some((b) => b.turn === e.turn && mineLine(b.craft) && overlap(b.from, b.until, a, a + DAY) >= 12 * 60)) why = 'booked';
          else if (job) {
            const sp = Object.entries(spares).filter(([on]) => Math.floor(+on / DAY) === n).flatMap(([, l]) => l);
            if (cc ? sp.includes(cc) : sp.filter((c) => !trainee(c)).length >= 2) why = 'spare';
            else if (usual != null && !runs.some((r) => Math.floor(r.on / DAY) === n) && covered(a + usual - 120, a + usual + 60)) why = 'norun';
          }
          if (!why) continue;
          told.add(d);
          yoff.push({ d, why, job: e.turn, ...(cc && job ? { cc } : {}) });
        }
      }
      yoff.sort(by('d'));
    }
    // Resets worked out from these trips, by the reset tracker's own rules, so
    // the page's resets follow from the trips it shows.
    const span = stretches.reduce((a, e) => ({ from: !a.from || e.from < a.from ? e.from : a.from, to: !a.to || e.to > a.to ? e.to : a.to }), { from: '', to: '' });
    const own = tracker && tracker.resetsOf ? tracker.resetsOf([...merged, ...coming.map((g) => ({ id: g.train, on: g.on, last: g.last, key: g.job }))]
      .map((t) => ({ train: t.id, on: t.on, last: t.last || t.on, job: t.key || t.turn, ...(t.yard ? { yard: true } : {}) }))) : null;
    if (own) {
      // A reset worked out from time off is only said where the checks can
      // stand behind the 32 hours before it: not before they had the person
      // in them that long, and not around days on a yard job's list that say
      // nothing of who came in. (Put on a reset by the company: read off the
      // board, kept.)
      const seenFrom = min(span.from);
      const blind = (m) => unk.some((u) => m >= dayNum(u.from) * DAY && m <= (dayNum(u.to) + 2) * DAY);
      resets = own.resets.filter((x) => x.kind !== 'natural' || (min(x.at) - 32 * 60 >= seenFrom && !blind(min(x.at))));
      due = unk.some((u) => dayNum(u.to) >= dayNum(dayOf(span.to)) - 1) ? null : own.due;
    }

    // Their place on their own board, each time it moved: [stamp, place, board].
    // 999 = out working. From the turn's own changes ("Chain Gang (SR) position 002: available").
    const pos = [];
    for (const c of rec.changes) {
      if (!c.own) continue;
      let m = null;
      for (const part of String(c.text).split(' · ')) {
        const x = /^(.+?) position (\d{3})(?: \((\w+)\))?:/.exec(part);
        // One number, two turns (501/502): the line for their own craft.
        if (x && (!x[3] || !anyCraft || (anyCraft === 'CO' ? x[3] === 'CO' : x[3] !== 'CO'))) { m = x; break; }
      }
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
    return {
      v: V, from: trips.length && dayOf(trips[0].at) < dayOf(span.from) ? dayOf(trips[0].at) : dayOf(span.from), to: dayOf(span.to), turns: daySpans(stretches), trips, rests, spares, pos,
      resets: (resets || []).map((x) => ({ at: x.at, kind: x.kind, ...(x.possible ? { possible: true } : {}) })).sort(by('at')),
      due: due || null, passed: passed.sort(by('seen')), stale: staleOut.sort(by('from')),
      ...(unk.length ? { unk: unk.sort(by('from')) } : {}),
      ...(yoff.length ? { yoff } : {}),
    };
  }

  // What was kept from earlier builds joined to this one. since: the first
  // day this build covers (YYYY-MM-DD): everything from then on is the
  // build's, everything before stays as it was kept. keepDays: how far back.
  const LISTS = { trips: (x) => x.at, rests: (x) => x.seen, spares: (x) => x.seen, pos: (x) => x[0], resets: (x) => x.at, passed: (x) => x.seen, stale: (x) => x.from, yoff: (x) => x.d };
  function merge(old, fresh, since, { keepDays = 400 } = {}) {
    if (!old || old.v !== V) return fresh || null;
    const f = fresh || { v: V, from: '', to: old.to, turns: [], trips: [], rests: [], spares: [], pos: [], resets: [], due: old.due || null, passed: [], stale: [] };
    const newest = f.to || old.to || since;
    const cut = dayStr(dayNum(newest) - keepDays);
    const out = { v: V, from: '', to: f.to > old.to ? f.to : old.to };
    // Something from the evening before the build's first day can be in both
    // (a train on duty at 2200 is still on the Call Board after midnight): once.
    // A trip: the build's word (it is still being followed), with what the kept
    // one knew that the build no longer sees (its first plan, its call).
    const sameTrip = (a, b) => a.id === b.id && Math.abs(min(a.at) - min(b.at)) <= 180;
    for (const [k, stamp] of Object.entries(LISTS)) {
      const before = (old[k] || []).filter((x) => dayOf(stamp(x)) < since && dayOf(stamp(x)) >= cut);
      let fresh = f[k] || [];
      const early = fresh.filter((x) => dayOf(stamp(x)) < since);
      let kept = before;
      if (early.length && k === 'trips') {
        fresh = fresh.map((x) => { const was = early.includes(x) && before.find((y) => sameTrip(x, y)); if (!was) return x; const { est, ...rest } = was; return { ...(x.off ? rest : was), ...x }; });
        kept = before.filter((y) => !early.some((x) => sameTrip(x, y)));
      } else if (early.length) { const have = new Set(early.map((x) => JSON.stringify(x))); kept = before.filter((y) => !have.has(JSON.stringify(y))); }
      out[k] = [...kept, ...fresh].sort((a, b) => (stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0));
    }
    const dayBefore = dayStr(dayNum(since) - 1);
    const kept = (old.turns || []).filter((x) => x.from < since && x.to >= cut).map((x) => ({ ...x, to: x.to >= since ? dayBefore : x.to }));
    out.turns = [];
    for (const x of [...kept, ...(f.turns || [])]) {
      const last = [...out.turns].reverse().find((y) => y.turn === x.turn && y.own === x.own);
      if (last && dayNum(x.from) - dayNum(last.to) <= 1) { if (x.to > last.to) last.to = x.to; if (x.craft) last.craft = x.craft; } else out.turns.push({ ...x });
    }
    out.from = out.turns.reduce((m, x) => (!m || x.from < m ? x.from : m), '') || f.from || old.from;
    if (out.trips.length && dayOf(out.trips[0].at) < out.from) out.from = dayOf(out.trips[0].at);
    out.due = fresh ? f.due : null;
    // Days on a yard job's list with no word on who came in: as kept before the build's first day, then the build's.
    const unk = [...(old.unk || []).filter((x) => x.from < since && x.to >= cut).map((x) => ({ ...x, to: x.to >= since ? dayBefore : x.to })), ...(f.unk || [])];
    return { v: out.v, from: out.from, to: out.to, turns: out.turns, trips: out.trips, rests: out.rests, spares: out.spares, pos: out.pos, resets: out.resets, due: out.due, passed: out.passed, stale: out.stale, ...(unk.length ? { unk } : {}), ...(out.yoff.length ? { yoff: out.yoff } : {}) };
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

  // The Duty and Rest Period Rules for Railway Operating Employees (Transport
  // Canada; data/rest_rules.pdf), the limits the page sets its figures beside:
  // 7.1 a duty period is at most 12 h; 8.1 at least 12 h rest at the home
  // terminal, 8.3 at least 10 h away from it, 8.4 with 8 h undisturbed in each;
  // 9.1 at most 60 h on duty in any 7 days in a row, 9.2 at most 192 h in any 28.
  const RULES = { duty: 12 * 60, restHome: 12 * 60, restAway: 10 * 60, quiet: 8 * 60, week: 60 * 60, month: 192 * 60 };

  // The pools people are compared within (the names the Analytics tab uses).
  const POOLS = [[/^SR\d/, 'SR', 'Chain Gang (SR)'], [/^SA\d/, 'SA', 'A pool (SA)'], [/^SB\d/, 'SB', 'B pool (SB)'], [/^SD\d/, 'SD', 'Drags (SD)'], [/^S1\d/, 'S1', '1st Manifest (S1)'],
    [/^S3\d/, 'S3', '3rd Manifest (S3)'], [/^S5\d/, 'S5', '501/502'], [/^B\d/, 'B', 'Conductor spareboard'], [/^EN\d/, 'EN', 'Engineer spareboard'], [/^(Y[A-Z]{3}|XSAS)\d/, 'YD', 'Yard jobs']];
  const poolOf = (turn) => { if (!turn || TRAINEE.test(turn)) return null; const p = POOLS.find(([re]) => re.test(turn)); return p ? { key: p[1], name: p[2] } : null; };
  // A pool too small to compare within without giving someone's figures away
  // (501/502 is four people at most) is set beside a wider group instead.
  const WIDE = { ROAD: ['every road pool together', ['SR', 'SA', 'SB', 'SD', 'S1', 'S3', 'S5'], 'the Chain Gang, the A and B pools, the Drags, both manifests and 501/502'], SPARE: ['both spareboards together', ['B', 'EN'], 'the conductor and engineer spareboards'] };
  const wideOf = (key) => (Object.entries(WIDE).find(([, w]) => w[1].includes(key)) || [null])[0];

  // range: { from, to } days (inclusive), either end open.
  function stats(rec, range = {}) {
    const lo = range.from || '';
    const hi = range.to || '';
    const inR = (stamp) => { const d = dayOf(stamp); return !!d && (!lo || d >= lo) && (!hi || d <= hi); };
    const all = ((rec && rec.trips) || []).map((t) => ({ ...t, on: min(t.at), offMin: t.off ? min(t.off) : null })).filter((t) => t.on != null).sort((a, b) => a.on - b.on);
    const known = all.filter((t) => t.offMin != null && !t.yard).map((t) => t.offMin - t.on);
    const typical = median(known) || 8 * 60;
    // A trip with no off duty read yet: its length is taken as the usual one (a yard job's as its 8 or 12 h), and counted as estimated.
    for (const t of all) {
      t.dur = t.offMin != null ? t.offMin - t.on : t.yard ? yardMinutes(t.id) : typical; t.end = t.on + t.dur; t.durEst = t.offMin == null || !!t.est;
      t.away = !t.yard && !!t.st && !HOME.test(t.st); t.kind = t.yard ? 'yard' : t.away ? 'home' : 'out';
      t.callAt = t.call && min(t.call.got) != null ? min(t.call.got) : t.on - 120;
    }
    // What follows each trip: time held away (out, then a trip home within a day and a half) or time at home.
    for (let i = 0; i < all.length; i++) {
      const a = all[i]; const b = all[i + 1];
      a.prev = all[i - 1] || null;
      a.next = b && b.on - a.on < 6 * DAY ? { gap: b.on - a.end, onOn: b.on - a.on, held: a.kind === 'out' && b.kind === 'home' && b.on - a.end <= 36 * 60 } : null;
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

    // Hours of the day (the call: the one read, else 2 h before on duty).
    const hours = { out: Array(24).fill(0), home: Array(24).fill(0), yard: Array(24).fill(0), calls: Array(24).fill(0) };
    const hourOf = (m) => Math.floor((((m % DAY) + DAY) % DAY) / 60);
    for (const t of trips) { hours[t.kind][hourOf(t.on)]++; if (!t.yard) hours.calls[hourOf(t.callAt)]++; }
    const nightCalls = road.filter((t) => { const c = ((t.callAt % DAY) + DAY) % DAY; return c >= 23 * 60 || c < 6 * 60; }).length;

    // The calendar: each day from the first to the last in the dates picked.
    // unk: on a yard job's list that day with no word on whether they came in
    // (build): left out of every count of days.
    const spans = (rec && rec.turns) || [];
    const unkSpans = ((rec && rec.unk) || []);
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
        const job = duty ? null : unkSpans.find((u) => u.from <= date && u.to >= date);
        days.push({ date, wd: new Date(d * 864e5).getUTCDay(), duty, night, starts, seen: spans.some((x) => x.from <= date && x.to >= date), ...(job ? { unk: job.job } : {}) });
      }
    }
    const told = days.filter((x) => !x.unk); // the days the board can speak for
    const worked = days.filter((x) => x.duty > 0);
    const weekdays = WEEKDAYS.map((name, i) => { const ds = told.filter((x) => x.wd === i); return { name, days: ds.length, worked: ds.filter((x) => x.duty > 0).length, duty: sum(ds.map((x) => x.duty)), starts: sum(ds.map((x) => x.starts)), nights: ds.filter((x) => x.night > 0).length }; });
    let run = 0; let clear = 0; let maxRun = 0; let maxClear = 0;
    for (const x of days) { if (x.unk) { run = 0; clear = 0; } else if (x.duty > 0) { run++; clear = 0; } else { clear++; run = 0; } maxRun = Math.max(maxRun, run); maxClear = Math.max(maxClear, clear); }
    const weekends = [];
    for (let i = 0; i < days.length - 1; i++) if (days[i].wd === 6 && days[i + 1].wd === 0 && !days[i].unk && !days[i + 1].unk) weekends.push(days[i].duty === 0 && days[i + 1].duty === 0);

    // Weeks, Sunday to Saturday, and months.
    const group = (keyOf) => {
      const m = new Map();
      for (const x of days) { const k = keyOf(x); const g = m.get(k) || { key: k, days: 0, worked: 0, duty: 0, nights: 0, trips: 0, unk: 0, misses: [] }; if (x.unk) g.unk++; else g.days++; if (x.duty > 0) g.worked++; g.duty += x.duty; if (x.night > 0) g.nights++; g.trips += x.starts; m.set(k, g); }
      for (const t of trips) { const g = m.get(keyOf({ date: dayOf(t.at), wd: new Date(dayNum(dayOf(t.at)) * 864e5).getUTCDay() })); if (g && t.call) g.misses.push(Math.abs(t.call.off)); }
      return [...m.values()].map((g) => ({ ...g, miss: median(g.misses), misses: undefined }));
    };
    const weeks = group((x) => dayStr(dayNum(x.date) - x.wd)).map((w) => ({ ...w, partial: w.days + w.unk < 7 }));
    const months = group((x) => x.date.slice(0, 7));
    // The most on duty in any 7 days in a row (and any 28, once there are 28):
    // the best window starts as a trip goes on duty or ends as one goes off.
    const most = (len) => {
      let best = 0; let from = null;
      for (const a of [...trips.map((t) => t.on), ...trips.map((t) => t.end - len)]) { const tot = sum(all.map((t) => overlap(t.on, t.end, a, a + len))); if (tot > best) { best = tot; from = a; } }
      return { min: best, at: from == null ? '' : T.fromMin(from) };
    };
    const most7 = most(7 * DAY);
    const most28 = days.length >= 28 ? most(28 * DAY) : null;
    // On duty in the 7 days ending with each day (from the 7th day on).
    const roll = days.map((x, i) => (i < 6 ? null : { date: x.date, min: sum(days.slice(i - 6, i + 1).map((y) => y.duty)), unk: days.slice(i - 6, i + 1).some((y) => y.unk) })).filter(Boolean);

    // Where the time went, from the first trip on duty to the last off. After
    // a trip out with no trip home seen, where they were is not known.
    const dutyMin = sum(trips.map((t) => t.dur));
    const heldMin = sum(done.map((x) => x.held).filter((x) => x > 0));
    const lostMin = sum(trips.filter((t) => t.kind === 'out' && t.next && !t.next.held && t !== last).map((t) => Math.max(0, t.next.gap)));
    const spanMin = first ? last.end - first.on : 0;
    const split = { span: spanMin, duty: dutyMin, held: heldMin, lost: lostMin, home: Math.max(0, spanMin - dutyMin - heldMin - lostMin) };

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
    const planned = road.filter((t) => t.plan).map((t) => ({ id: t.id, at: t.at, off: t.on - min(t.plan), n: t.pc || 0 }));
    const planOff = planned.map((x) => x.off);
    const ordOff = road.filter((t) => t.ord).map((t) => t.on - min(t.ord));
    const lead = road.filter((t) => t.seen).map((t) => t.on - min(t.seen)).filter((x) => x > 0);
    const lineup = {
      plan: { n: planOff.length, median: median(planOff.map(Math.abs)), late: planOff.filter((x) => x > 15).length, early: planOff.filter((x) => x < -15).length, worst: planOff.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0), changes: sum(road.map((t) => t.pc || 0)), list: planned },
      order: { n: ordOff.length, median: median(ordOff.map(Math.abs)), changed: road.filter((t) => t.oc > 0).length },
      lead: { n: lead.length, median: median(lead), least: lead.length ? Math.min(...lead) : null },
    };

    // Rest: how soon after it ended the call came, and how long was booked at home.
    const restsAll = ((rec && rec.rests) || []).map((r) => ({ ...r, s: min(r.seen), u: min(r.until) })).filter((r) => r.s != null);
    const afterRest = { away: [], home: [] };
    for (const t of road) {
      const call = t.callAt;
      const r = restsAll.filter((x) => x.u != null && /rest/i.test(x.kind) && x.s < call && call - x.u < 3 * DAY && x.u <= call + 120).sort((a, b) => b.s - a.s)[0];
      if (r) afterRest[t.kind === 'home' ? 'away' : 'home'].push(Math.max(0, call - r.u));
    }
    const booked = [];
    for (const t of trips.filter((x) => x.kind !== 'out' && x.offMin != null)) {
      const r = restsAll.find((x) => x.u != null && /rest/i.test(x.kind) && x.s >= t.offMin - 60 && x.s <= t.offMin + 360 && x.u > t.offMin);
      if (r) booked.push(r.u - t.offMin);
    }
    const restsIn = restsAll.filter((r) => inR(r.seen));
    // On duty before the rest the board was showing was up. The latest word on
    // rest read since the trip before ended; a rest in the Toronto bunkhouse
    // only against a trip out of Toronto (anything else is another crew's line).
    const early = { n: 0, list: [] };
    for (const t of trips) {
      const since = t.prev ? t.prev.end - 60 : -Infinity;
      const r = restsAll.filter((x) => x.u != null && /rest/i.test(x.kind) && x.s < t.on && x.s >= since && t.on - x.s < 3 * DAY && (!/toronto/i.test(x.where || '') || /^TORONTO$/i.test(t.st || ''))).sort((a, b) => b.s - a.s)[0];
      if (!r) continue;
      early.n++;
      if (r.u > t.on + 1) early.list.push({ id: t.id, at: t.at, until: r.until, by: r.u - t.on });
    }
    const rest = {
      list: restsIn.filter((r) => r.u != null && /rest/i.test(r.kind) && r.u > r.s).map((r) => { const after = all.filter((t) => t.end >= r.s - 6 * 60 && t.end <= r.s + 30).pop(); return { from: after ? after.end : r.s, to: r.u, until: r.until, where: r.where || '' }; }).filter((r) => r.to > r.from),
      n: restsIn.filter((r) => /rest/i.test(r.kind)).length, holds: restsIn.filter((r) => /hold/i.test(r.kind)).length,
      afterAway: { n: afterRest.away.length, median: median(afterRest.away), least: afterRest.away.length ? Math.min(...afterRest.away) : null, most: afterRest.away.length ? Math.max(...afterRest.away) : null },
      afterHome: { n: afterRest.home.length, median: median(afterRest.home), least: afterRest.home.length ? Math.min(...afterRest.home) : null, most: afterRest.home.length ? Math.max(...afterRest.home) : null },
      booked: { n: booked.length, short: booked.filter((x) => x < 16 * 60).length, long: booked.filter((x) => x >= 16 * 60).length },
    };

    // Time off before each trip, beside the rest rules: from going off duty to
    // going on again (the rest period), and to the call (the undisturbed part).
    // At home after a trip home or a yard job; away after a trip out. After a
    // trip out with no trip home seen, where the rest was is not known.
    const offs = [];
    for (const t of trips) {
      const p = t.prev;
      if (!p || t.on - p.end > 6 * DAY || t.on <= p.end) continue;
      const where = p.kind === 'out' ? (t.kind === 'home' && t.on - p.end <= 36 * 60 ? 'away' : null) : 'home';
      if (!where) continue;
      offs.push({ id: t.id, at: t.at, after: p.id, where, gap: t.on - p.end, quiet: t.callAt - p.end, est: p.durEst, callRead: !!(t.call && min(t.call.got) != null) });
    }
    // underEst / quietEst: how many of those rest on an off duty time that is an estimate (a yard shift's 8 or 12 h above all).
    const side = (w, need) => { const l = offs.filter((o) => o.where === w); return { n: l.length, least: l.reduce((m, o) => (!m || o.gap < m.gap ? o : m), null), under: l.filter((o) => o.gap < need).length, underEst: l.filter((o) => o.gap < need && o.est).length, median: median(l.map((o) => o.gap)) }; };
    const rules = {
      longest: trips.reduce((m, t) => (!m || t.dur > m.dur ? t : m), null), over: trips.filter((t) => t.dur > RULES.duty).length,
      home: side('home', RULES.restHome), away: side('away', RULES.restAway), quiet: offs.filter((o) => o.quiet < RULES.quiet).length, quietEst: offs.filter((o) => o.quiet < RULES.quiet && (o.est || !o.callRead)).length,
      week: most7, month: most28, offs, early,
    };

    // Their place on the board: where they came home to, how fast it moved, how long first out.
    const posAll = ((rec && rec.pos) || []).map((p) => ({ t: min(p[0]), place: p[1], board: p[2] })).filter((p) => p.t != null);
    const climbs = [];
    for (const t of road.filter((x) => x.kind === 'out')) {
      const prev = t.prev;
      const call = t.callAt;
      // Since they were last out working (or the trip before ended), four days back at most.
      const out = posAll.filter((p) => p.place >= 900 && p.t <= call - 90).pop(); // (the board shows this call's own "out working" about when it comes)
      const since = Math.max(prev ? prev.end - 60 : -Infinity, out ? out.t : -Infinity, call - 4 * DAY);
      const near = posAll.filter((p) => p.t >= since && p.t <= call && p.place < 900);
      // Only the board they were called from (a move to another turn starts afresh).
      const seen = near.filter((p) => p.board === near[near.length - 1].board);
      if (seen.length < 2) continue;
      const arrived = seen[0]; const atCall = seen[seen.length - 1];
      if (arrived.place < atCall.place) continue; // put back down the board: not a climb
      const firstOut = seen.find((p) => p.place === 1);
      climbs.push({ id: t.id, at: t.at, board: arrived.board, from: arrived.place, to: atCall.place, wait: call - arrived.t, firstOut: firstOut ? call - firstOut.t : null });
    }
    const perPlace = climbs.filter((c) => c.from > c.to).map((c) => c.wait / (c.from - c.to));
    const posIn = posAll.filter((p) => (!lo || dayOf(T.fromMin(p.t)) >= lo) && (!hi || dayOf(T.fromMin(p.t)) <= hi));
    const board = { n: climbs.length, from: median(climbs.map((c) => c.from)), wait: median(climbs.map((c) => c.wait)), perPlace: median(perPlace.map(Math.round)), firstOut: climbs.filter((c) => c.firstOut != null).map((c) => c.firstOut), list: climbs, series: posIn };

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
      return { turn: k, trips: ts.length, yard: ts.filter((t) => t.yard).length, from: ts[0].at, to: ts[ts.length - 1].at, marks: ts.map((t) => ({ m: ((t.on % DAY) + DAY) % DAY, kind: t.kind, id: t.id, at: t.at })), out: ts.filter((t) => t.kind === 'out').map((t) => t.at.slice(11)), home: ts.filter((t) => t.kind === 'home').map((t) => t.at.slice(11)),
        duty: avg(ts.map((t) => t.dur)), away: avg(mine.map((x) => x.away)), held: avg(mine.map((x) => x.held)), miss: median(cs.map((t) => Math.abs(t.call.off))), changes: sum(cs.map((t) => t.call.n || 0)), calls: cs.length };
    });

    const passed = ((rec && rec.passed) || []).filter((x) => inR(x.seen));
    const staleIn = ((rec && rec.stale) || []).filter((x) => inR(x.from));
    const sparesIn = ((rec && rec.spares) || []).filter((x) => inR(x.seen));
    // Their own trains that went to the spareboard (once a train), apart from the other goes-spare notes.
    const spareTrains = [...new Set(sparesIn.map((x) => (/^its train (\S+ \d+) goes spare/.exec(x.text) || [])[1]).filter(Boolean))];
    const unkDays = days.filter((x) => x.unk);
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
      days, told: told.length, worked: worked.length, clearDays: told.length - worked.length, unseen: told.filter((x) => !x.seen && !x.duty).length, nights: days.filter((x) => x.night > 0).length,
      unknown: { days: unkDays.length, jobs: [...new Set(unkDays.map((x) => x.unk))], from: unkDays.length ? unkDays[0].date : '', to: unkDays.length ? unkDays[unkDays.length - 1].date : '' },
      weekdays, maxRun, maxClear, weekends: { n: weekends.length, clear: weekends.filter(Boolean).length },
      weeks, months, most7, most28, roll, split, calls: callStats, lineup, rest, rules, board,
      resets, due: (rec && rec.due) || null, sinceReset: lastReset ? { at: lastReset.at, trips: sinceReset.length, duty: sum(sinceReset.map((t) => t.dur)) } : null,
      byTurn, partners: top(trips.flatMap((t) => t.with || [])), numbers: top(road.map((t) => numberOf(t.id)), 8), jobs: top(trips.filter((t) => t.job).map((t) => t.job), 8),
      turns: spans.filter((x) => (!lo || x.to >= lo) && (!hi || x.from <= hi)),
      flags: { passed, likely: passed.filter((x) => x.result === 'likely').length, possible: passed.filter((x) => x.result === 'possible').length, explained: passed.filter((x) => x.result === 'explained').length,
        stale: staleIn, staleWorst: staleIn.reduce((m, x) => (!m || x.min > m.min ? x : m), null), spares: sparesIn.length, spareTrains },
    };
  }

  // One person's figures for setting beside their pool's: over the window
  // (days), on the pool they are on at the end of it, for the unbroken run of
  // days they have been on it. Rates are per 7 days. null: not on a pool, on
  // it under 10 days, under 3 trips, or days in the window the board cannot
  // speak for. The laptop works these out for everyone and publishes only
  // each pool's average and middle half (lib/board/mystats.js pools); the page
  // works out the member's own from their own record with this same function.
  const POOL_FIGURES = [['trips', 'Trips a week', 'n'], ['hours', 'Hours on duty a week', 'h'], ['worked', 'Days with duty a week', 'n'], ['nights', 'Nights worked a week', 'n'],
    ['trip', 'On duty a trip', 'm'], ['away', 'Away from home a round trip', 'm'], ['held', 'Held away a stay', 'm'], ['home', 'At home between trips', 'm'], ['miss', 'Usual call miss', 'm'], ['ok', 'Calls within 30 min', '%']];
  function poolFigures(rec, win) {
    if (!rec || !rec.turns || !win || !win.to) return null;
    const own = rec.turns.filter((x) => x.own && poolOf(x.turn) && x.from <= win.to && x.to >= win.from).sort(by('from'));
    const latest = own[own.length - 1];
    const pool = latest ? poolOf(latest.turn) : null;
    if (!pool || dayNum(win.to) - dayNum(latest.to) > 3) return null; // not on a board lately
    // Back from the newest day on this pool while the days join up.
    let from = latest.from;
    for (let i = own.length - 2; i >= 0; i--) { if (poolOf(own[i].turn).key !== pool.key || dayNum(from) - dayNum(own[i].to) > 1) break; if (own[i].from < from) from = own[i].from; }
    if (from < win.from) from = win.from;
    const to = latest.to < win.to ? latest.to : win.to;
    const s = stats(rec, { from, to });
    const n = s.days.length;
    if (n < 10 || s.trips.length < 3 || s.unknown.days) return null;
    const per = (x) => (x / n) * 7;
    return { pool: pool.key, name: pool.name, from, to, days: n,
      v: { trips: per(s.trips.length), hours: per(s.duty.total) / 60, worked: per(s.worked), nights: per(s.nights), trip: s.duty.avg, away: s.away.avg, held: s.held.avg, home: s.home.avg,
        miss: s.calls.n >= 3 ? s.calls.median : null, ok: s.calls.n >= 3 ? (100 * s.calls.ok) / s.calls.n : null } };
  }
  // Each pool's average and middle half from everyone's figures: never one
  // person's own number. A figure needs `least` people (5) to be given at all;
  // rates go to one decimal, times to five minutes. Each end of the middle
  // half is the midpoint between two neighbouring people's figures (a quarter
  // of the pool, rounded down, left outside at each end), so neither end is
  // anyone's own figure either: a plain quartile of five people is exactly
  // the second-lowest person's number.
  function poolSummary(figures, { least = 5 } = {}) {
    const out = {};
    const edge = (s, low) => { const k = Math.max(1, Math.floor(s.length / 4)); return low ? (s[k - 1] + s[k]) / 2 : (s[s.length - k] + s[s.length - k - 1]) / 2; };
    for (const key of new Set(figures.filter(Boolean).map((f) => f.pool))) {
      const mine = figures.filter((f) => f && f.pool === key);
      const m = {};
      for (const [k, , unit] of POOL_FIGURES) {
        const vals = mine.map((f) => f.v[k]).filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
        if (vals.length < least) continue;
        const r = (x) => (unit === 'm' ? Math.round(x / 5) * 5 : Math.round(x * 10) / 10);
        m[k] = { n: vals.length, avg: r(sum(vals) / vals.length), q1: r(edge(vals, true)), q3: r(edge(vals, false)) };
      }
      if (Object.keys(m).length) out[key] = { name: mine[0].name, people: mine.length, m };
    }
    // The wider groups, for people whose own pool is too small to give. A
    // figure is given only if the people in it who are NOT in a pool already
    // given above number none or at least `least`: otherwise taking the given
    // pools away from the group would leave a handful of people's figures.
    for (const [wk, [name, keys]] of Object.entries(WIDE)) {
      const mine = figures.filter((f) => f && keys.includes(f.pool));
      const m = {};
      for (const [k, , unit] of POOL_FIGURES) {
        const has = (f) => f.v[k] != null && Number.isFinite(f.v[k]);
        const vals = mine.filter(has).map((f) => f.v[k]).sort((a, b) => a - b);
        const rest = mine.filter((f) => has(f) && !(out[f.pool] && out[f.pool].m[k])).length;
        if (vals.length < least || (rest > 0 && rest < least)) continue;
        const r = (x) => (unit === 'm' ? Math.round(x / 5) * 5 : Math.round(x * 10) / 10);
        m[k] = { n: vals.length, avg: r(sum(vals) / vals.length), q1: r(edge(vals, true)), q3: r(edge(vals, false)) };
      }
      if (Object.keys(m).length) out[wk] = { name, people: mine.length, wide: true, m };
    }
    return out;
  }

  // --- The test site's yard pieces (owner, 2026-11-13) ----------------------
  // "Review my stats tab for someone working just yard jobs", then, shown eight
  // additions: "Let's do that. Push to the test site." The page asks for them
  // with opts.yard (board.html: PREVIEW, board-test with the owner key); the
  // record carries what they need beside what the rest of the site goes by
  // (a yard shift's cb, cc, yw; the record's yoff), so without opts.yard every
  // page is drawn exactly as before.

  // The record with each yard shift ending when its job left the Call Board, where that was seen (build: cb).
  function yardView(rec) {
    if (!rec || !Array.isArray(rec.trips) || !rec.trips.some((t) => t.yard && t.cb)) return rec;
    return { ...rec, trips: rec.trips.map((t) => (t.yard && t.cb ? { ...t, off: t.cb, est: true, rb: 1 } : t)) };
  }
  // A yard worker beside the yard: per 7 days, over the window, for the unbroken run of days they have been on
  // yard jobs or the yard spareboard (the YD group) since any day the board could not say who came in. null:
  // under 10 days, under 3 shifts, or not on the yard lately. Rounded and summed up like the pools (yardSummary).
  const YARD_FIGURES = [['shifts', 'Shifts a week', 'n'], ['hours', 'Hours on duty a week', 'h'], ['worked', 'Days with duty a week', 'n'], ['nights', 'Nights worked a week', 'n'],
    ['shift', 'On duty a shift', 'm'], ['over', 'Time past a shift\'s length a week', 'm'], ['overShare', 'Shifts 15 min or more over', '%']];
  function yardWindow(rec, win) {
    if (!rec || !rec.turns || !win || !win.to) return null;
    const own = rec.turns.filter((x) => x.own && x.from <= win.to && x.to >= win.from && (poolOf(x.turn) || {}).key === 'YD').sort(by('from'));
    const latest = own[own.length - 1];
    if (!latest || dayNum(win.to) - dayNum(latest.to) > 3) return null;
    let from = latest.from;
    for (let i = own.length - 2; i >= 0; i--) { if (dayNum(from) - dayNum(own[i].to) > 1) break; if (own[i].from < from) from = own[i].from; }
    const lastUnk = ((rec.unk || []).map((u) => u.to).sort().pop()) || '';
    if (lastUnk && lastUnk >= from) from = dayStr(dayNum(lastUnk) + 1);
    if (from < win.from) from = win.from;
    const to = latest.to < win.to ? latest.to : win.to;
    return { from, to };
  }
  function yardFigures(rec, win, lenOf = yardMinutes) {
    const w = yardWindow(rec, win);
    if (!w || w.to < w.from) return null;
    const s = stats(yardView(rec), w);
    const n = s.days.length;
    if (n < 10 || s.trips.length < 3 || s.unknown.days) return null;
    const per = (x) => (x / n) * 7;
    const timed = s.trips.filter((t) => t.yard && t.rb);
    const past = (t) => Math.max(0, t.dur - lenOf(t.id));
    return { pool: 'YD', from: w.from, to: w.to, days: n,
      v: { shifts: per(s.trips.length), hours: per(s.duty.total) / 60, worked: per(s.worked), nights: per(s.nights), shift: s.duty.avg,
        over: per(sum(timed.map(past))), overShare: timed.length >= 3 ? (100 * timed.filter((t) => past(t) >= 15).length) / timed.length : null } };
  }
  // The yard workers' average and middle half: as poolSummary, at least `least` people for a figure, each end
  // of the band halfway between two people's figures, rates to one decimal, times to five minutes.
  function yardSummary(figures, { least = 5 } = {}) {
    const mine = figures.filter((f) => f && f.pool === 'YD');
    const edge = (v, low) => { const k = Math.max(1, Math.floor(v.length / 4)); return low ? (v[k - 1] + v[k]) / 2 : (v[v.length - k] + v[v.length - k - 1]) / 2; };
    const m = {};
    for (const [k, , unit] of YARD_FIGURES) {
      const vals = mine.map((f) => f.v[k]).filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
      if (vals.length < least) continue;
      const r = (x) => (unit === 'm' ? Math.round(x / 5) * 5 : Math.round(x * 10) / 10);
      m[k] = { n: vals.length, avg: r(sum(vals) / vals.length), q1: r(edge(vals, true)), q3: r(edge(vals, false)) };
    }
    return Object.keys(m).length ? { name: 'yard workers', people: mine.length, m } : null;
  }
  // A yard job's own length: 12 h where its runs usually go 10 h or more by the Call Board, else 8 h (found
  // 2026-11-13: YSBY06, a YSBY job, runs 8 h; the 8 / 12 h rule had it ending early 15 times in 16). With fewer
  // than 3 runs timed, the rule (yardMinutes). lengths: { job: minutes } (yardjobs.json `length`).
  const lengthOf = (lengths) => (job) => (lengths && lengths[job]) || yardMinutes(job);
  const lengthFrom = (job, ends) => { if (ends.length < 3) return yardMinutes(job); const v = [...ends].sort((a, b) => a - b); const mid = v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; return mid >= 600 ? 12 * 60 : 8 * 60; };
  // What the yard pieces say, from the figures already worked out (s: stats(yardView(rec), …)).
  function yardFacts(rec, s, lenOf = yardMinutes) {
    const yardTrips = s.trips.filter((t) => t.yard);
    const timed = yardTrips.filter((t) => t.rb);
    const past = (t) => t.dur - lenOf(t.id);
    const over = timed.filter((t) => past(t) >= 15);
    const early = timed.filter((t) => past(t) <= -30);
    const lo = s.range.from; const hi = s.range.to;
    const inR = (d) => (!lo || d >= lo) && (!hi || d <= hi);
    const offs = ((rec && rec.yoff) || []).filter((x) => inR(x.d));
    // Their own yard jobs in the dates picked: the craft last read on it, the usual on-duty time, the shifts on it.
    const own = [...new Set(((rec && rec.turns) || []).filter((x) => x.own && YARD.test(x.turn) && (!lo || x.to >= lo) && (!hi || x.from <= hi)).map((x) => x.turn))].map((job) => {
      const on = yardTrips.filter((t) => t.id === job);
      const c = new Map(); for (const t of on) c.set(t.at.slice(11), (c.get(t.at.slice(11)) || 0) + 1);
      let start = ''; for (const [k, n] of c) if (!start || n > c.get(start)) start = k;
      const cc = ([...((rec && rec.trips) || [])].reverse().find((t) => t.yard && t.id === job && t.cc) || {}).cc || ([...offs].reverse().find((x) => x.job === job && x.cc) || {}).cc || '';
      const tm = on.filter((t) => t.rb).map((t) => t.dur);
      return { job, cc, start, n: on.length, timed: tm.length, median: median(tm) };
    });
    const ownJobs = new Set(own.map((x) => x.job));
    return { timed: timed.length, untimed: yardTrips.length - timed.length, over: { n: over.length, total: sum(over.map(past)), worst: over.reduce((m, t) => (!m || past(t) > past(m) ? t : m), null) },
      early: { n: early.length, worst: early.reduce((m, t) => (!m || past(t) < past(m) ? t : m), null) }, timedList: timed, past, own,
      elsewhere: yardTrips.filter((t) => !ownJobs.has(t.id)).length, offs, offBy: { booked: offs.filter((x) => x.why === 'booked').length, spare: offs.filter((x) => x.why === 'spare').length, norun: offs.filter((x) => x.why === 'norun').length },
      crew: top(yardTrips.flatMap((t) => t.yw || [])) };
  }

  // --- The page: the tab -----------------------------------------------------

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hm = (m) => (m == null ? '—' : `${m < 0 ? '−' : ''}${Math.floor(Math.abs(Math.round(m)) / 60)} h ${pad(Math.abs(Math.round(m)) % 60)}`);
  const hrs = (m) => (m == null ? '—' : `${Math.round(m / 6) / 10} h`);
  const off = (m) => (m === 0 ? 'on the minute' : `${hm(Math.abs(m))} ${m > 0 ? 'late' : 'early'}`);
  const dm = (stamp) => { const d = dayOf(stamp); return d ? `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}` : '—'; };
  const dt = (stamp) => (stamp ? `${dm(stamp)} ${String(stamp).slice(11)}` : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const title = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');
  const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');

  const RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'Everything kept']];
  function rangeOf(key, rec) {
    if (!rec || key === 'all' || !rec.to) return {};
    return { from: dayStr(dayNum(rec.to) - (+key - 1)), to: rec.to };
  }

  // Marks carry data-tip: wire() shows it beside the pointer or on focus.
  const tip = (text) => ` data-tip="${esc(text)}" tabindex="0"`;
  // Every drawing is 360 units wide, so on a phone a unit is about a pixel and the lettering stays its size.
  const W = 360;

  // Trips going on duty in each hour: going out and coming home stacked (yard jobs too when there are any).
  function hoursChart(s) {
    const H = 170; const L = 12; const B = 22; const TOP = 16;
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
    const H = 168; const B = 38; const TOP = 18;
    const max = Math.max(1, ...items.map(value));
    const cw = W / items.length;
    const bw = Math.min(40, cw - 8);
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
  // offs (the test site's yard pieces): the days off the board gave a reason for (record yoff), by day.
  const OFF_WHY = { booked: 'booked off (Train Service 4\'s days off)', spare: 'your job went spare', norun: 'your job did not go on duty' };
  function calendar(s, offs = null) {
    if (!s.days.length) return '';
    const cells = [];
    let offN = 0;
    for (let i = 0; i < s.days[0].wd; i++) cells.push('<i class="ms-day ms-pad"></i>');
    for (const d of s.days) {
      const o = offs && !d.duty && !d.unk ? offs.get(d.date) : null;
      if (o) offN++;
      const why = o ? `off: ${o.why === 'spare' ? `your job ${o.job} went spare for ${o.cc || 'its crew'} (the vacancy list)` : o.why === 'norun' ? `your job ${o.job} did not go on duty` : OFF_WHY.booked}` : '';
      const what = d.unk ? `on yard job ${d.unk}: the checks did not record who came in` : d.duty ? `${hm(d.duty)} on duty${d.night ? `, ${hm(d.night)} of it between midnight and 0600` : ''}` : o ? why : d.seen ? 'no duty' : 'not on a board that day';
      cells.push(`<i class="ms-day ms-s${shade(d.duty)}${d.unk ? ' ms-unkday' : o ? ' ms-offday' : !d.seen && !d.duty ? ' ms-unseen' : ''}"${tip(`${WEEKDAYS[d.wd]} ${dm(d.date)}: ${what}`)}><b>${+d.date.slice(8, 10)}</b>${d.duty ? `<span>${Math.round(d.duty / 60)}h</span>` : d.unk ? '<span>?</span>' : o ? '<span>off</span>' : ''}</i>`);
    }
    return `<div class="ms-cal" role="img" aria-label="Hours on duty each day"><div class="ms-calhead">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div><div class="ms-calgrid">${cells.join('')}</div></div>
      <div class="ms-legend"><span><i class="ms-day ms-s0"></i>No duty</span><span><i class="ms-day ms-s1"></i>Under 4 h</span><span><i class="ms-day ms-s2"></i>4 to 8 h</span><span><i class="ms-day ms-s3"></i>8 to 12 h</span><span><i class="ms-day ms-s4"></i>12 h or more</span>${offN ? '<span><i class="ms-day ms-s0 ms-offday"></i>Off, with the board\'s reason</span>' : ''}${s.unseen ? '<span><i class="ms-day ms-s0 ms-unseen"></i>Not on a board</span>' : ''}${s.unknown.days ? '<span><i class="ms-day ms-s0 ms-unkday"></i>Yard job, not recorded</span>' : ''}</div>`;
  }

  // One bar split into parts, each with its label underneath.
  function splitBar(parts, aria) {
    const total = sum(parts.map((p) => p.v));
    if (!total) return '';
    return `<div class="ms-split" role="img" aria-label="${esc(aria)}">${parts.filter((p) => p.v > 0).map((p) => `<i class="${p.cls}" style="flex:${p.v}"${tip(`${p.label}: ${p.text} (${pct(p.v, total)}%)`)}></i>`).join('')}</div>
      <div class="ms-legend">${parts.filter((p) => p.v > 0 || !p.hide).map((p) => `<span><i class="${p.cls}"></i>${esc(p.label)} <b>${esc(p.text)}</b>${p.v ? ` · ${pct(p.v, total)}%` : ''}</span>`).join('')}</div>`;
  }

  // The days hour by hour: a row a day, midnight to midnight, a block where they were on duty.
  const DIARY_DAYS = 42;
  function diary(s) {
    const days = s.days.slice(-DIARY_DAYS);
    if (!days.length) return '';
    const L = 44; const R = 2; const rowH = 14; const gap = 4; const top = 16;
    const H = top + days.length * (rowH + gap);
    const d0 = dayNum(days[0].date);
    const x = (m) => L + (m / DAY) * (W - L - R);
    const yOf = (i) => top + i * (rowH + gap);
    // One stretch of time across the rows it falls on.
    const across = (from, to, cls, text, inset = 0, foot = 0) => {
      let out = '';
      for (let i = 0; i < days.length; i++) {
        const a = (d0 + i) * DAY; const lo = Math.max(from, a); const hi = Math.min(to, a + DAY);
        if (hi <= lo) continue;
        out += `<rect class="${cls}" x="${x(lo - a).toFixed(1)}" y="${foot ? yOf(i) + rowH - foot : yOf(i) + inset}" width="${Math.max(1.5, x(hi - a) - x(lo - a)).toFixed(1)}" height="${foot || rowH - 2 * inset}" rx="${foot ? 0 : inset ? 1.5 : 3}"${text ? tip(text) : ''}></rect>`;
      }
      return out;
    };
    const at = (m, cls, text) => { const i = Math.floor(m / DAY) - d0; return i < 0 || i >= days.length ? '' : `<rect class="${cls}" x="${(x(m - (d0 + i) * DAY) - 1).toFixed(1)}" y="${yOf(i) - 2}" width="2" height="${rowH + 4}"${tip(text)}></rect>`; };
    let g = '';
    for (const h of [0, 6, 12, 18]) g += `<text class="ms-tick" x="${(x(h * 60) + 1).toFixed(1)}" y="10">${pad(h)}00</text>`;
    days.forEach((d, i) => {
      g += `<rect class="ms-track${d.unk ? ' ms-unkrow' : ''}" x="${L}" y="${yOf(i)}" width="${W - L - R}" height="${rowH}" rx="3"${d.unk ? tip(`${WEEKDAYS[d.wd]} ${dm(d.date)}: on yard job ${d.unk}, the checks did not record who came in`) : ''}></rect>`;
      g += `<text class="ms-tick${d.wd === 0 || d.wd === 6 ? ' ms-strong' : ''}" x="0" y="${yOf(i) + 11}">${WEEKDAYS[d.wd].slice(0, 2)} ${+d.date.slice(8, 10)}</text>`;
    });
    for (const h of [6, 12, 18]) g += `<line class="ms-grid" x1="${x(h * 60).toFixed(1)}" y1="${top - 2}" x2="${x(h * 60).toFixed(1)}" y2="${H - gap}"></line>`;
    for (const tr of s.tours) if (tr.back) g += across(tr.out.end, tr.back.on, 'ms-heldband', `Held at ${title(tr.place) || 'the away terminal'} ${hm(tr.held)}, ${dt(T.fromMin(tr.out.end))} to ${dt(tr.back.at)}`, 4);
    for (const r of s.rest.list) g += across(r.from, r.to, 'ms-restband', `Rest booked until ${dt(r.until)}${r.where ? ` (${r.where})` : ''}`, 0, 3);
    for (const t of s.trips) {
      g += across(t.on, t.end, `ms-k-${t.kind}`, `${t.id}${t.job ? ` (working ${t.job})` : ''}: on duty ${dt(t.at)}, off ${t.durEst ? '~' : ''}${dt(T.fromMin(t.end))} (${hm(t.dur)})`);
      if (!t.yard) g += at(t.callAt, 'ms-calltick', `Call for ${t.id}: ${dt(T.fromMin(t.callAt))}`);
    }
    for (const r of s.resets) g += at(min(r.at), 'ms-resetmark', `Reset ${dt(r.at)}`);
    const kinds = [['out', 'Going out'], ['home', 'Coming home'], ['yard', 'Yard job']].filter(([k]) => s.trips.some((t) => t.kind === k));
    return `<div class="ms-legend">${kinds.map(([k, l]) => `<span><i class="ms-k-${k}"></i>${l}</span>`).join('')}${s.done ? '<span><i class="ms-heldband"></i>Held away</span>' : ''}${s.rest.list.length ? '<span><i class="ms-restband"></i>Rest booked</span>' : ''}${s.road ? '<span><i class="ms-calltick"></i>The call</span>' : ''}${s.resets.length ? '<span><i class="ms-resetmark"></i>Reset</span>' : ''}${s.unknown.days ? '<span><i class="ms-unkrow"></i>Yard job, not recorded</span>' : ''}</div>
      <svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Each day from midnight to midnight, with a block where you were on duty">${g}</svg>`;
  }

  // Each round trip as one bar: on duty out, held away, on duty home.
  function tourChart(s) {
    const list = s.tours.filter((x) => x.back).slice(-10).reverse();
    if (!list.length) return '';
    const R = 66; const rowH = 36;
    const maxM = Math.max(24 * 60, ...list.map((x) => x.away));
    const x = (m) => (m / maxM) * (W - R);
    const seg = (from, len, y, cls, text) => `<rect class="${cls}" x="${(x(from) + 1).toFixed(1)}" y="${y}" width="${Math.max(2, x(len) - 2).toFixed(1)}" height="13" rx="3"${tip(text)}></rect>`;
    const body = list.map((t, i) => {
      const y = i * rowH;
      const a = t.out.dur; const b = Math.max(0, t.held); const c = t.back.dur;
      return `<text class="ms-tick ms-strong" x="0" y="${y + 12}">${esc(dm(t.out.at))} · ${esc(t.out.id)} → ${esc(t.back.id)}</text>
        ${seg(0, a, y + 17, 'ms-k-out', `On duty out ${hm(a)}`)}${seg(a, b, y + 17, b >= T.HELD_LIMIT ? 'ms-held14' : 'ms-heldband', `Held at ${title(t.place) || 'the away terminal'} ${hm(b)}`)}${seg(a + b, c, y + 17, 'ms-k-home', `On duty home ${hm(c)}`)}
        <text class="ms-val" x="${(x(a + b + c) + 4).toFixed(1)}" y="${y + 28}">${esc(hm(t.away))}</text>`;
    }).join('');
    return `<div class="ms-legend"><span><i class="ms-k-out"></i>On duty out</span><span><i class="ms-heldband"></i>Held away</span>${list.some((t) => t.held >= T.HELD_LIMIT) ? '<span><i class="ms-held14"></i>Held 14 h or more</span>' : ''}<span><i class="ms-k-home"></i>On duty home</span></div>
      <svg class="ms-chart" viewBox="0 0 ${W} ${list.length * rowH}" role="img" aria-label="Each round trip: time on duty out, held away and on duty home">${body}</svg>`;
  }

  // How far something landed from where it was expected: a bar each, earlier to the left, later to the right.
  function divergeChart(rows, { limit = 180, band = 30, aria, sign = ['early', 'late'] }) {
    if (!rows.length) return '';
    const L = 72; const R = 100; const rowH = 17; const top = 20;
    const mid = L + (W - L - R) / 2; const half = (W - L - R) / 2;
    const x = (v) => mid + (Math.max(-limit, Math.min(limit, v)) / limit) * half;
    const H = top + rows.length * rowH + 2;
    const cls = (v) => (Math.abs(v) <= band ? 'ms-ok' : Math.abs(v) <= 2 * band ? 'ms-warn' : 'ms-bad');
    const body = rows.map((r, i) => {
      const y = top + i * rowH;
      const a = Math.min(mid, x(r.v)); const w = Math.max(2, Math.abs(x(r.v) - mid));
      return `<text class="ms-tick ms-mono" x="0" y="${y + 11}">${esc(r.label)}</text>
        <rect class="${cls(r.v)}" x="${a.toFixed(1)}" y="${y + 2}" width="${w.toFixed(1)}" height="11" rx="3"${tip(r.tip)}></rect>
        <text class="ms-val" x="${W}" y="${y + 11}" text-anchor="end">${r.v === 0 ? 'on time' : `${esc(hm(Math.abs(r.v)))} ${r.v > 0 ? sign[1] : sign[0]}`}${Math.abs(r.v) > limit ? ' ›' : ''}</text>`;
    }).join('');
    return `<svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">
      <rect class="ms-band" x="${x(-band).toFixed(1)}" y="${top - 4}" width="${(x(band) - x(-band)).toFixed(1)}" height="${H - top + 2}"></rect>
      <text class="ms-tick" x="${(mid - 5).toFixed(1)}" y="11" text-anchor="end">← ${sign[0] === 'early' ? 'earlier' : sign[0]}</text><text class="ms-tick" x="${(mid + 5).toFixed(1)}" y="11">${sign[1] === 'late' ? 'later' : sign[1]} →</text>
      <line class="ms-axis" x1="${mid.toFixed(1)}" y1="${top - 4}" x2="${mid.toFixed(1)}" y2="${H}"></line>${body}</svg>`;
  }

  // The boards they were on in turn, for the place-on-board drawing: a stay of
  // half a day or more each (a few minutes on another list, as when a turn
  // changes hands, is not a move), the same board twice running joined.
  function boardStays(pts) {
    if (!pts.length) return [];
    const t1 = pts[pts.length - 1].t;
    const stays = [];
    pts.forEach((p, i) => { const last = stays[stays.length - 1]; const to = (pts[i + 1] || { t: t1 }).t; if (last && last.board === p.board) last.to = to; else stays.push({ board: p.board, from: p.t, to }); });
    const long = [];
    const keep = stays.some((x) => x.to - x.from >= 12 * 60) ? stays.filter((x) => x.to - x.from >= 12 * 60) : [stays.reduce((m, x) => (x.to - x.from > m.to - m.from ? x : m), stays[0])];
    for (const st of keep) { const last = long[long.length - 1]; if (last && last.board === st.board) last.to = st.to; else long.push({ ...st }); }
    return long;
  }
  // "on the Chain Gang (SR)", or "Chain Gang (SR) to 3 Nov, then 501/502 (S5)".
  const boardWords = (stays) => (!stays.length ? '' : stays.length === 1 ? `: the ${stays[0].board}` : stays.length <= 3 ? `: ${stays.map((x, i) => (i < stays.length - 1 ? `${x.board} to ${dm(T.fromMin(x.to))}` : x.board)).join(', then ')}` : `, ${stays.length} stays on ${new Set(stays.map((x) => x.board)).size} boards`);

  // Their place on their board over time: up is nearer first out; shaded while out working.
  function boardChart(s) {
    const pts = s.board.series;
    const home = pts.filter((p) => p.place < 900);
    if (home.length < 3) return '';
    const t0 = pts[0].t; const t1 = pts[pts.length - 1].t;
    if (t1 - t0 < 12 * 60) return '';
    const maxP = Math.max(2, ...home.map((p) => p.place));
    const H = 158; const L = 24; const R = 6; const top = 22; const B = 20;
    const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const y = (p) => top + ((p - 1) / (maxP - 1)) * (H - top - B);
    let d = ''; let outs = ''; let marks = ''; let pen = null; let boardNow = '';
    // An upright line where they moved to another board; its name where the stay is wide enough to hold it.
    boardStays(pts).forEach((st, i) => {
      const room = x(st.to) - x(st.from); const need = st.board.length * 6.8 + 8;
      if (i) marks += `<line class="ms-grid" x1="${x(st.from).toFixed(1)}" y1="2" x2="${x(st.from).toFixed(1)}" y2="${H - B}"></line>`;
      if (room >= need) marks += `<text class="ms-tick" x="${(i ? x(st.from) + 4 : L).toFixed(1)}" y="12">${esc(st.board)}</text>`;
    });
    pts.forEach((p, i) => {
      const next = pts[i + 1];
      if (p.place >= 900) {
        if (pen) d += ` H${x(p.t).toFixed(1)}`;
        pen = null;
        if (next) outs += `<rect class="ms-outband" x="${x(p.t).toFixed(1)}" y="${top - 4}" width="${Math.max(1, x(next.t) - x(p.t)).toFixed(1)}" height="${H - top - B + 8}"${tip(`Out working from ${dt(T.fromMin(p.t))}`)}></rect>`;
        return;
      }
      if (p.board !== boardNow) { boardNow = p.board; pen = null; }
      d += pen ? ` H${x(p.t).toFixed(1)} V${y(p.place).toFixed(1)}` : ` M${x(p.t).toFixed(1)} ${y(p.place).toFixed(1)}`;
      pen = p;
      if (!next) d += ` H${x(t1).toFixed(1)}`;
    });
    const dots = home.filter((p) => p.place === 1).map((p) => `<circle class="ms-dot" cx="${x(p.t).toFixed(1)}" cy="${y(1).toFixed(1)}" r="3"${tip(`First out, ${dt(T.fromMin(p.t))}`)}></circle>`).join('');
    return `<svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your place on the board over time; up is nearer first out">${outs}
      <text class="ms-tick" x="0" y="${(y(1) + 4).toFixed(1)}">1st</text><text class="ms-tick" x="0" y="${(y(maxP) + 4).toFixed(1)}">${nth(maxP)}</text>
      <line class="ms-grid" x1="${L}" y1="${y(1).toFixed(1)}" x2="${W - R}" y2="${y(1).toFixed(1)}"></line>
      ${marks}<path class="ms-line" d="${d.trim()}"></path>${dots}
      <text class="ms-tick" x="${L}" y="${H - 5}">${esc(dm(T.fromMin(t0)))}</text><text class="ms-tick" x="${W - R}" y="${H - 5}" text-anchor="end">${esc(dm(T.fromMin(t1)))}</text></svg>
      <div class="ms-legend"><span><i class="ms-linekey"></i>Your place (up is nearer first out)</span><span><i class="ms-outband"></i>Out working</span><span><i class="ms-dotkey"></i>First out</span></div>`;
  }

  // When each turn they held went on duty, along the day: a mark a trip.
  function turnChart(s, word = 'trip') {
    const rows = s.byTurn.filter((t) => t.marks.length);
    if (sum(rows.map((t) => t.marks.length)) < 3) return '';
    const L = 6; const R = 6; const rowH = 46; const B = 16;
    const H = rows.length * rowH + B;
    const x = (m) => L + (m / DAY) * (W - L - R);
    const body = rows.map((t, i) => {
      const y = i * rowH + 36; // the line the marks sit on
      const seen = {}; // marks in the same half hour stack upwards
      const marks = [...t.marks].sort((a, b) => a.m - b.m).map((k) => {
        const slot = Math.floor(k.m / 30); const up = Math.min(2, seen[slot] || 0); seen[slot] = (seen[slot] || 0) + 1;
        const cx = x(k.m).toFixed(1); const cy = y - 6 - up * 9;
        const say = tip(`${k.id}: on duty ${dt(k.at)}`);
        return k.kind === 'out' ? `<circle class="ms-m-out" cx="${cx}" cy="${cy}" r="4"${say}></circle>` : k.kind === 'home' ? `<circle class="ms-m-home" cx="${cx}" cy="${cy}" r="3.5"${say}></circle>` : `<rect class="ms-m-yard" x="${(x(k.m) - 3.5).toFixed(1)}" y="${cy - 3.5}" width="7" height="7"${say}></rect>`;
      }).join('');
      return `<text class="ms-tick ms-strong" x="${L}" y="${i * rowH + 11}">${esc(t.turn)} · ${plural(t.marks.length, word)}</text>
        <rect class="ms-night" x="${L}" y="${y - 22}" width="${(x(360) - L).toFixed(1)}" height="22"></rect><line class="ms-axis" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"></line>${marks}`;
    }).join('');
    const ticks = [0, 6, 12, 18, 24].map((h) => `<text class="ms-tick" x="${x(h * 60).toFixed(1)}" y="${H - 4}" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${h === 24 ? '2400' : `${pad(h)}00`}</text>`).join('');
    const kinds = [['out', 'Going out'], ['home', 'Coming home'], ['yard', 'Yard job']].filter(([k]) => rows.some((t) => t.marks.some((mk) => mk.kind === k)));
    return `<div class="ms-legend">${kinds.map(([k, l]) => `<span><i class="ms-m-${k}"></i>${l}</span>`).join('')}</div>
      <svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="When each turn went on duty, by time of day">${body}${ticks}</svg>`;
  }

  // On duty in the 7 days ending with each day, beside the 60 h the rules allow.
  function rollChart(s) {
    const pts = s.roll;
    if (pts.length < 2) return '';
    const H = 150; const L = 30; const R = 8; const top = 10; const B = 20;
    const maxV = Math.max(RULES.week, ...pts.map((p) => p.min)) * 1.08;
    const x = (i) => L + (i / (pts.length - 1)) * (W - L - R);
    const y = (v) => H - B - (v / maxV) * (H - top - B);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.min).toFixed(1)}`).join(' ');
    const end = pts[pts.length - 1];
    const peak = pts.reduce((m, p) => (p.min > m.min ? p : m), pts[0]);
    return `<svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hours on duty in the 7 days ending with each day, beside the 60 hour limit">
      <line class="ms-grid" x1="${L}" y1="${y(RULES.week / 2).toFixed(1)}" x2="${W - R}" y2="${y(RULES.week / 2).toFixed(1)}"></line>
      <line class="ms-limit" x1="${L}" y1="${y(RULES.week).toFixed(1)}" x2="${W - R}" y2="${y(RULES.week).toFixed(1)}"></line>
      <text class="ms-tick" x="0" y="${(y(RULES.week) + 4).toFixed(1)}">60 h</text><text class="ms-tick" x="0" y="${(y(RULES.week / 2) + 4).toFixed(1)}">30 h</text><text class="ms-tick" x="0" y="${(y(0) + 4).toFixed(1)}">0</text>
      <path class="ms-area" d="${line} L${x(pts.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z"></path><path class="ms-line" d="${line}"></path>
      ${pts.map((p, i) => `<circle class="ms-hit" cx="${x(i).toFixed(1)}" cy="${y(p.min).toFixed(1)}" r="7"${tip(`7 days to ${dm(p.date)}: ${hm(p.min)} on duty${p.unk ? ' (some yard days not recorded)' : ''}`)}></circle>`).join('')}
      <circle class="ms-dot" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(end.min).toFixed(1)}" r="3.5"></circle>
      <text class="ms-val" x="${W - R}" y="${(y(end.min) - 9 < top + 8 || Math.abs(y(end.min) - 9 - y(RULES.week)) < 9 ? y(end.min) + 17 : y(end.min) - 9).toFixed(1)}" text-anchor="end">${esc(hrs(end.min))}</text>
      <text class="ms-tick" x="${L}" y="${H - 5}">${esc(dm(pts[0].date))}</text><text class="ms-tick" x="${W - R}" y="${H - 5}" text-anchor="end">${esc(dm(end.date))}</text></svg>
      <dl class="ms-facts">${fact('Highest on the drawing', hm(peak.min), `the 7 whole days to ${esc(dm(peak.date))}${s.most7.min > peak.min ? ` · counted to the minute, not by whole days, the most is ${hm(s.most7.min)} (above)` : ''}`)}${fact('Now', hm(end.min), `the 7 days to ${esc(dm(end.date))}`)}</dl>`;
  }

  // Each time off before a trip as a dot along the hours, beside the least the rules allow.
  function restDots(s) {
    const rows = [['home', 'At home', RULES.restHome], ['away', 'Away', RULES.restAway]].filter(([k]) => s.rules[k].n);
    if (!rows.length) return '';
    const L = 52; const R = 10; const cap = 48 * 60; const rowH = 34; const top = 6;
    const H = top + rows.length * rowH + 18;
    const x = (m) => L + (Math.min(m, cap) / cap) * (W - L - R);
    const body = rows.map(([k, label, need], i) => {
      const y = top + i * rowH + 16;
      const dots = s.rules.offs.filter((o) => o.where === k).map((o) => `<circle class="${o.gap < need ? 'ms-dotbad' : 'ms-dot'}${o.est ? ' ms-dotest' : ''}" cx="${x(o.gap).toFixed(1)}" cy="${y}" r="4.5"${tip(`${o.est ? '~' : ''}${hm(o.gap)} off before ${o.id} (${dm(o.at)}), after ${o.after}${o.est ? '; the off duty time is an estimate' : ''}`)}></circle>`).join('');
      return `<text class="ms-tick ms-strong" x="0" y="${y + 4}">${label}</text><line class="ms-axis" x1="${L}" y1="${y}" x2="${W - R}" y2="${y}"></line>
        <line class="ms-limit" x1="${x(need).toFixed(1)}" y1="${y - 12}" x2="${x(need).toFixed(1)}" y2="${y + 12}"></line><text class="ms-tick" x="${(x(need) + 3).toFixed(1)}" y="${y - 6}">${need / 60} h</text>${dots}`;
    }).join('');
    const ticks = [0, 12, 24, 36, 48].map((h) => `<text class="ms-tick" x="${x(h * 60).toFixed(1)}" y="${H - 4}" text-anchor="${h === 0 ? 'start' : h === 48 ? 'end' : 'middle'}">${h === 48 ? '48 h+' : `${h} h`}</text>`).join('');
    return `<svg class="ms-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Time off before each trip, at home and away, beside the least the rest rules allow">${body}${ticks}</svg>${s.rules.offs.some((o) => o.est) ? '<div class="ms-legend"><span><i class="ms-dotkey"></i>Off duty time read</span><span><i class="ms-dotkey ms-dotest"></i>Off duty time estimated</span></div>' : ''}`;
  }

  // The member's figure beside the pool's: a band for the middle half of the pool, a tick for its average, a dot for them.
  function poolRows(mine, pool, defs = POOL_FIGURES, words = null) {
    const avgWord = words ? words[0] : pool.wide ? 'average' : 'pool average'; const bandWord = words ? words[1] : pool.wide ? 'The middle half of them' : 'The middle half of the pool';
    const show = (v, unit) => (unit === 'm' ? hm(v) : unit === '%' ? `${Math.round(v)}%` : unit === 'h' ? `${f1(v)} h` : f1(v));
    return defs.map(([k, label, unit]) => {
      const p = pool.m[k]; const v = mine.v[k];
      if (!p || v == null) return '';
      const lo = Math.min(p.q1, p.avg, v); const hi = Math.max(p.q3, p.avg, v);
      const padd = (hi - lo || 1) * 0.25;
      const a = Math.max(0, lo - padd); const b = hi + padd;
      const at = (x) => (((x - a) / (b - a)) * 100).toFixed(1);
      return `<div class="ms-pool"><div class="ms-poolhead"><b>${label}</b><span>You <b>${esc(show(v, unit))}</b> · ${avgWord} ${esc(show(p.avg, unit))}</span></div>
        <div class="ms-pooltrack" role="img" aria-label="${esc(`${label}: you ${show(v, unit)}, ${avgWord} ${show(p.avg, unit)}, ${bandWord.toLowerCase()} ${show(p.q1, unit)} to ${show(p.q3, unit)}`)}"${tip(`${bandWord}: ${show(p.q1, unit)} to ${show(p.q3, unit)} · ${p.n} people`)}>
          <i class="ms-poolband" style="left:${at(p.q1)}%;width:${Math.max(1, at(p.q3) - at(p.q1)).toFixed(1)}%"></i><i class="ms-poolavg" style="left:${at(p.avg)}%"></i><i class="ms-poolyou" style="left:${at(v)}%"></i></div>
        <small>${bandWord}: ${esc(show(p.q1, unit))} to ${esc(show(p.q3, unit))}</small></div>`;
    }).join('');
  }

  const fact = (label, value, note = '') => `<div class="ms-fact"><dt>${label}</dt><dd>${value}${note ? `<small>${note}</small>` : ''}</dd></div>`;
  const section = (id, heading, body, note = '') => (body ? `<section class="ms-sec" id="ms-${id}"><h3>${heading}</h3>${note ? `<p class="ms-note">${note}</p>` : ''}${body}</section>` : '');
  const table = (head, rows) => `<div class="ms-scroll"><table class="ms-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const pic = (caption, body) => (body ? `<figure class="ms-fig">${body}<figcaption>${caption}</figcaption></figure>` : '');
  const also = (t) => (t.aka && t.aka.length ? `<small>also shown as ${t.aka.map(esc).join(', ')}</small>` : '');

  // Every trip in the dates picked, oldest first, for the log and the spreadsheet.
  function logRows(s) {
    return s.trips.map((t) => {
      const p = t.prev;
      const gap = p && t.on > p.end && t.on - p.end <= 6 * DAY ? t.on - p.end : null;
      return { at: t.at, id: t.id, aka: t.aka || [], from: t.yard ? 'yard' : t.st || '', turn: t.turn + (t.craft ? ` ${t.craft}` : '') + (t.tt ? ` ${t.tt}` : ''), job: t.job || '', off: T.fromMin(t.end), est: !!t.durEst, dur: t.dur, gap,
        call: t.call || null, named: !!t.nm };
    });
  }
  // The same as a spreadsheet (comma-separated, one line a trip).
  // opts.yard (the test site's yard pieces): yard shifts end when their job left the Call Board.
  function csv(rec, rangeKey = 'all', opts = {}) {
    const rv = opts.yard ? yardView(rec) : rec;
    const s = stats(rv, rangeOf(rangeKey, rv));
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const clock = (m) => (m == null ? '' : `${Math.floor(m / 60)}:${pad(Math.round(m) % 60)}`);
    const head = ['On duty', 'Train or job', 'Also shown as', 'From', 'Turn', 'Working (job)', 'Off duty', 'Off duty estimated', 'On duty for (h:mm)', 'Time off before (h:mm)', 'Call you slept on', 'Call you got', 'Call off by (min)', 'Name read on it'];
    const lines = logRows(s).map((r) => [r.at, r.id, r.aka.join(' '), r.from, r.turn, r.job, r.off, r.est ? 'yes' : '', clock(r.dur), clock(r.gap), r.call ? r.call.exp : '', r.call ? r.call.got : '', r.call ? r.call.off : '', r.named ? 'yes' : ''].map(q).join(','));
    return [head.map(q).join(','), ...lines].join('\r\n');
  }

  // The whole tab. opts: { range: '30' | '90' | 'all', code, more, pools, now }.
  //   more   the newer sections and drawings (2026-11-11): the days hour by
  //          hour, the round trips drawn, the call and plan drawings, the place
  //          on the board, duty and rest beside the rules, the pool, the log
  //   pools  data/pools.json: { from, to, pools } (lib/board/mystats.js)
  //   now    the newest check's stamp, for how far through the 7 days they are
  function html(rec, opts = {}) {
    const key = RANGES.some(([k]) => k === opts.range) ? opts.range : 'all';
    const more = !!opts.more;
    // opts.yard (the test site's yard pieces): yard shifts end when their job left the Call Board (yardView), and
    // someone with only yard shifts in the dates picked reads "shift" for "trip", without the road-only rows.
    const Y = !!opts.yard;
    const rv = Y ? yardView(rec) : rec;
    const s = stats(rv, rangeOf(key, rv));
    const yardOnly = Y && s.yard > 0 && s.road === 0;
    const w = yardOnly ? { one: 'shift', many: 'shifts', Many: 'Shifts', job: 'Job' } : { one: 'trip', many: 'trips', Many: 'Trips', job: 'Train or job' };
    const lenOf = lengthOf(Y && opts.yardJobs && Array.isArray(opts.yardJobs.jobs) ? Object.fromEntries(opts.yardJobs.jobs.map((j) => [j.job, j.length])) : null);
    const yf = Y ? yardFacts(rv, s, lenOf) : null;
    const picker = `<div class="ms-ranges" role="group" aria-label="Dates">${RANGES.map(([k, l]) => `<button type="button" data-ms-range="${k}" aria-pressed="${k === key}">${l}</button>`).join('')}</div>`;
    const head = `<header class="ms-head"><div><h2>My stats${opts.code ? ` <span class="ms-code">${esc(opts.code)}</span>` : ''}</h2>
      <p class="ms-note">${s.days.length ? `${esc(dm(s.range.from))} to ${esc(dm(s.range.to))} · ${plural(s.days.length, 'day')} · ${opts.other ? 'opened with the owner key' : 'only you can open this page'}` : opts.other ? 'Opened with the owner key' : 'Only you can open this page'}</p></div>${picker}</header>`;
    // A yard job's own crew: until the checker marked who was on duty, the board could not say which days they came in.
    const u = s.unknown;
    const unknown = u.days ? `<p class="ms-warnnote"><b>${plural(u.days, 'day')} left out: ${esc(dm(u.from))} to ${esc(dm(u.to))}, on yard job ${u.jobs.map(esc).join(', ')}.</b> For those days the checks recorded whose job it was but not who came in to work it, so they are not counted as worked or as off anywhere on this page. Yard shifts are recorded from the day the board checker was updated.</p>` : '';
    const defs = '<svg class="ms-defs" aria-hidden="true" focusable="false"><defs><pattern id="ms-hatch" width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="ms-hatch-a" width="5.5" height="5.5"></rect><rect class="ms-hatch-b" width="2" height="5.5"></rect></pattern></defs></svg>';
    if (!s.trips.length) return `<div class="ms">${head}${unknown}<p class="ms-empty">No trips in the saved checks for these dates. They show here once your name is on a board and a train or yard job you work goes on duty.</p></div>`;
    const c = s.calls;
    const tiles = `<div class="ms-tiles">
      <div class="ms-tile"><b>${s.trips.length}</b><span>${s.trips.length === 1 ? w.one : w.many} on duty</span><small>${s.done ? `${plural(s.done, 'round trip')}${s.perTour ? `, one every ${(s.perTour / DAY).toFixed(1)} days` : ''}` : ''}${s.yard && !yardOnly ? `${s.done ? ' · ' : ''}${plural(s.yard, 'yard shift')}` : ''}${yardOnly && yf.own.length ? `${plural(s.trips.length - yf.elsewhere, 'shift')} on your own job` : ''}</small></div>
      <div class="ms-tile"><b>${hrs(s.duty.total)}</b><span>on duty</span><small>${hm(s.duty.avg)} a ${w.one}${Y && s.yard ? ` · ${yf.timed} of ${s.yard} yard ended by the Call Board` : s.duty.est ? ` · ${s.duty.est} estimated` : ''}</small></div>
      <div class="ms-tile"><b>${s.worked}<i> of ${s.told}</i></b><span>days with duty</span><small>${plural(s.clearDays, 'clear day')} · ${plural(s.nights, 'night')} worked${u.days ? ` · ${u.days} not recorded` : ''}</small></div>
      ${yardOnly && !c.n ? `<div class="ms-tile"><b>${yf.timed ? `${yf.over.n}<i> of ${yf.timed}</i>` : '—'}</b><span>shifts 15 min or more over</span><small>${yf.timed ? `${hm(yf.over.total)} past their length in all` : 'no Call Board ends seen yet'}</small></div>` : `<div class="ms-tile"><b>${c.n ? `${c.ok}<i> of ${c.n}</i>` : '—'}</b><span>calls within 30 min</span><small>${c.n ? `of the one you slept on · usual miss ${hm(c.median)}` : 'no calls measured yet'}</small></div>`}</div>`;

    const time = section('time', 'Where the time went', splitBar([
      { cls: 'ms-k-out', label: 'On duty', text: hrs(s.split.duty), v: s.split.duty },
      { cls: 'ms-k-home', label: 'Held away from home', text: hrs(s.split.held), v: s.split.held, ...(yardOnly ? { hide: true } : {}) },
      { cls: 'ms-k-rest', label: 'At home', text: hrs(s.split.home), v: s.split.home },
      { cls: 'ms-k-lost', label: 'Not known (out, no trip home seen)', text: hrs(s.split.lost), v: s.split.lost, hide: true },
    ], 'Share of the time on duty, held away and at home'), `From your first ${w.one} on duty to your last off, ${hm(s.split.span)} in all.`);

    const days = more ? section('diary', 'Your days, hour by hour', pic(`Each row is a day, midnight on the left to midnight on the right. A block is time on duty${s.done ? '; the pale band is time held away between a trip out and the trip home' : ''}${s.rest.list.length ? '; the line along the bottom of a row is rest booked after a trip, as the board showed it' : ''}${s.road ? '; the upright mark is the call' : ''}.${s.days.length > DIARY_DAYS ? ` The last ${DIARY_DAYS} days of the dates picked.` : ''}`, diary(s))) : '';

    const hours = section('hours', 'When you go on duty', hoursChart(s) + `<dl class="ms-facts">
      ${fact(`${w.Many} into the night hours`, `${s.nightTrips} of ${s.trips.length}`, 'on duty at some point between midnight and 0600')}
      ${s.road ? fact('Calls between 2300 and 0600', `${s.nightCalls} of ${s.road}`, 'trains only; the call as read, else 2 h before on duty') : ''}
      ${s.road ? fact('Busiest hour for the call', (() => { const m = Math.max(...s.hours.calls); const h = s.hours.calls.indexOf(m); return `${pad(h)}00 to ${pad(h)}59`; })(), `${plural(Math.max(...s.hours.calls), 'call')}`) : ''}</dl>`,
    `Each bar is the hour a ${w.one} went on duty. The shaded hours are midnight to 0600.`);

    const week = section('weekdays', 'Days of the week', barChart(s.weekdays, { label: (w) => w.name, value: (w) => w.duty, text: (w) => hrs(w.duty), sub: (w) => `${w.worked} of ${w.days}`, aria: 'Hours on duty by day of the week' }) + `<dl class="ms-facts">
      ${fact('Longest run of days with duty', plural(s.maxRun, 'day'))}
      ${fact('Longest run of clear days', plural(s.maxClear, 'day'))}
      ${s.weekends.n ? fact('Weekends fully clear', `${s.weekends.clear} of ${s.weekends.n}`, 'Saturday and Sunday both with no duty') : ''}
      ${fact(`${w.Many} started`, s.weekdays.map((x) => `${x.name} ${x.starts}`).join(' · '))}</dl>`,
    'Hours on duty that fell on each day. Under each: how many of those days had any duty.');

    const cal = section('calendar', 'Calendar', calendar(s, Y && yf.offs.length ? new Map(yf.offs.map((x) => [x.d, x])) : null));

    const wk = s.weeks.filter((x) => !(x.partial && !x.duty));
    const noMiss = yardOnly && !c.n; // no call measured: no "usual call miss" column
    const weeks = wk.length > 1 ? section('weeks', 'Week by week', barChart(wk.slice(-8), { label: (x) => dm(x.key), value: (x) => x.duty, text: (x) => hrs(x.duty), sub: (x) => plural(x.trips, w.one), aria: 'Hours on duty each week', cls: (x) => (x.partial ? 'ms-part' : '') })
      + table(['Week of', w.Many, 'On duty', 'Days worked', 'Nights', ...(noMiss ? [] : ['Usual call miss'])], wk.slice(-26).reverse().map((x) => [esc(dm(x.key)) + (x.partial ? ' <small>part week</small>' : ''), x.trips, hm(x.duty), `${x.worked} of ${x.days}${x.unk ? ` <small>${x.unk} not recorded</small>` : ''}`, x.nights, ...(noMiss ? [] : [x.miss == null ? '—' : hm(x.miss)])]))
      + `<dl class="ms-facts">${fact('Most on duty in any 7 days', hm(s.most7.min), `starting ${esc(dt(s.most7.at))}`)}</dl>`
      + (more && s.roll.length >= 2 ? pic('Hours on duty in the 7 days ending with each day. The dashed line is 60 hours, the most the rest rules allow in any 7 days in a row.', rollChart(s)) : ''),
    'Weeks run Sunday to Saturday. A part week is drawn fainter.') : '';

    const months = s.months.length > 1 ? section('months', 'Month by month', table(['Month', w.Many, 'On duty', 'Days worked', 'Nights', ...(noMiss ? [] : ['Usual call miss'])],
      s.months.slice().reverse().map((m) => [`${MONTHS[+m.key.slice(5, 7) - 1]} ${m.key.slice(0, 4)}`, m.trips, hm(m.duty), `${m.worked} of ${m.days}`, m.nights, ...(noMiss ? [] : [m.miss == null ? '—' : hm(m.miss)])]))) : '';

    const tours = s.tours.length ? section('tours', 'Every round trip', (more ? pic('Each bar is one round trip, newest first: on duty going out, held away, on duty coming home. The figure at the end is the whole time away.', tourChart(s)) : '')
      + table(['Out', 'On duty out', 'Held away', 'Home', 'On duty home', 'Total away', 'Home before next'],
        s.tours.slice().reverse().map((x) => [`<b>${esc(x.out.id)}</b><small>${esc(dt(x.out.at))}</small>${also(x.out)}`, `${x.out.durEst ? '~' : ''}${hm(x.out.dur)}`, x.back ? hm(x.held) : '—',
          x.back ? `<b>${esc(x.back.id)}</b><small>${esc(dt(x.back.at))}${x.place ? ` · ${esc(title(x.place))}` : ''}</small>${also(x.back)}` : '<small>no trip home seen</small>', x.back ? `${x.back.durEst ? '~' : ''}${hm(x.back.dur)}` : '—', x.back ? hm(x.away) : '—', x.homeAfter == null ? '—' : hm(x.homeAfter)]))
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
      + (more ? pic('Each bar is one call, newest first: how far the call you got landed from the one you slept on. The shaded strip is 30 minutes either way. Bars stop at 3 hours; the figure beside each is the full amount.',
        divergeChart(c.list.slice(-20).reverse().map((z) => ({ label: z.id, v: z.off, tip: `${z.id}, on duty ${dt(z.at)}: slept on ${dt(z.exp)}, got ${dt(z.got)}` })), { aria: 'How far each call landed from the one slept on' })) : '')
      + table(['Train', 'On duty', 'Call you slept on', 'Call you got', 'Off by', 'Changes'], c.list.slice().reverse().map((z) => [`<b>${esc(z.id)}</b>`, esc(dt(z.at)), esc(dt(z.exp)), esc(dt(z.got)), `<span class="ms-pill ${Math.abs(z.off) <= 30 ? 'ms-ok' : Math.abs(z.off) <= 60 ? 'ms-warn' : 'ms-bad'}">${esc(off(z.off))}</span>`, z.n || 0])),
    'The call the board was showing 8 hours before (when you would go to sleep) against the call you actually got.') : '';

    const l = s.lineup;
    const lineSec = l.plan.n || l.order.n ? section('lineup', 'How far to trust the line-up', `<dl class="ms-facts">
      ${l.order.n ? fact('Order time changed after ordering', `${l.order.changed} of ${l.order.n}`, `on duty usually ${hm(l.order.median)} from the first order time`) : ''}
      ${l.plan.n ? fact('First planned time against on duty', `usually ${hm(l.plan.median)} off`, `${l.plan.late} went later · ${l.plan.early} earlier · furthest ${off(l.plan.worst)}`) : ''}
      ${l.plan.n ? fact('Plan changes on your trains', String(l.plan.changes)) : ''}
      ${l.lead.n ? fact('Your train first on the line-up', `usually ${hm(l.lead.median)} ahead`, `least warning ${hm(l.lead.least)}`) : ''}</dl>`
      + (more && l.plan.n ? pic('Each bar is one train, newest first: how far it went on duty from the first time the line-up planned it for. The shaded strip is 30 minutes either way. Bars stop at 3 hours.',
        divergeChart(l.plan.list.slice(-20).reverse().map((z) => ({ label: z.id, v: z.off, tip: `${z.id}, on duty ${dt(z.at)}: ${z.n} plan ${z.n === 1 ? 'change' : 'changes'}` })), { aria: 'How far each train went on duty from its first planned time' })) : '')) : '';

    const r = s.rest; const b = s.board;
    const restFacts = `
      ${r.afterAway.n ? fact('Away from home: call after rest ended', `usually ${hm(r.afterAway.median)}`, `soonest ${hm(r.afterAway.least)} · longest ${hm(r.afterAway.most)} · ${plural(r.afterAway.n, 'trip')}`) : ''}
      ${r.afterHome.n ? fact('At home: call after rest ended', `usually ${hm(r.afterHome.median)}`, `soonest ${hm(r.afterHome.least)} · longest ${hm(r.afterHome.most)} · ${plural(r.afterHome.n, 'trip')}`) : ''}
      ${r.booked.n ? fact('Rest booked coming home', `${r.booked.short} short · ${r.booked.long} long`, 'short is under 16 h (10 h), long is 16 h or more (24 h)') : ''}
      ${r.n || r.holds ? fact('Rests and hold turns on the board', `${r.n} · ${r.holds}`) : ''}
      ${b.n ? fact('Place on the board coming home', `usually ${nth(b.from)}`, `${plural(b.n, 'time')} measured`) : ''}
      ${b.perPlace ? fact('Time to move up one place', `about ${hm(b.perPlace)}`) : ''}
      ${b.wait != null && b.n ? fact('Home on the board to the next call', `usually ${hm(b.wait)}`) : ''}
      ${b.firstOut.length ? fact('First out before the call', `usually ${hm(median(b.firstOut))}`, `longest ${hm(Math.max(...b.firstOut))}`) : ''}`.trim();
    const stays = more ? boardStays(b.series) : [];
    const restPic = more ? pic(`Your place on your board over the dates picked${esc(boardWords(stays))}. The line climbs as you move up; the top is first out. The shaded stretches are when you were out working.${stays.length > 1 ? ' An upright line is a move to another board.' : ''}`, boardChart(s)) : '';
    const restSec = restFacts || restPic ? section('rest', 'Rest and your place on the board', (restFacts ? `<dl class="ms-facts">${restFacts}</dl>` : '') + restPic) : '';

    // Duty and rest beside the rules (for a rest complaint or a grievance).
    const ru = s.rules;
    const least = (x, need) => (x.least ? `${x.least.est ? '~' : ''}${hm(x.least.gap)}${x.least.gap < need ? ' <span class="ms-pill ms-bad">under</span>' : ''}` : '—');
    const estNote = (n) => (n ? ` (${n} after an off duty time that is an estimate)` : '');
    const rulesSec = more ? section('rules', 'Duty and rest beside the rules', `<dl class="ms-facts">
      ${fact('Longest time on duty', ru.longest ? `${ru.longest.durEst ? '~' : ''}${hm(ru.longest.dur)}` : '—', `the limit is 12 h · ${plural(ru.over, w.one)} over${ru.longest ? ` · ${esc(ru.longest.id)}, ${esc(dm(ru.longest.at))}` : ''}`)}
      ${ru.home.n ? fact('Shortest time off at home', least(ru.home, RULES.restHome), `the least is 12 h · ${ru.home.under} of ${ru.home.n} under${estNote(ru.home.underEst)}${ru.home.least ? ` · before ${esc(ru.home.least.id)}, ${esc(dm(ru.home.least.at))}` : ''}`) : ''}
      ${ru.away.n ? fact('Shortest time off away from home', least(ru.away, RULES.restAway), `the least is 10 h · ${ru.away.under} of ${ru.away.n} under${estNote(ru.away.underEst)}${ru.away.least ? ` · before ${esc(ru.away.least.id)}, ${esc(dm(ru.away.least.at))}` : ''}`) : ''}
      ${ru.home.n + ru.away.n && !noMiss ? fact('Called under 8 h after going off duty', `${ru.quiet} of ${ru.home.n + ru.away.n}`, `8 h of each rest are to be undisturbed · the call as read, else taken as 2 h before on duty${ru.quietEst ? ` · ${ru.quietEst} of the ${ru.quiet} on an estimated off duty time or call` : ''}`) : ''}
      ${ru.early.n ? fact('On duty before the booked rest was up', `${ru.early.list.length} of ${ru.early.n}${ru.early.list.length ? ' <span class="ms-pill ms-bad">check</span>' : ''}`, ru.early.list.length ? ru.early.list.slice(-3).map((e) => `${esc(e.id)}, on duty ${esc(dt(e.at))}, rest shown until ${esc(dt(e.until))} (${hm(e.by)} early)`).join(' · ') : 'against the last rest the board showed before each trip') : ''}
      ${fact('Most on duty in any 7 days', hm(ru.week.min), `the limit is 60 h${ru.week.at ? ` · from ${esc(dt(ru.week.at))}` : ''}`)}
      ${ru.month ? fact('Most on duty in any 28 days', hm(ru.month.min), `the limit is 192 h · from ${esc(dt(ru.month.at))}`) : fact('Most on duty in any 28 days', 'not yet', 'needs 28 days of saved checks')}
      ${yardOnly ? '' : fact('Held away 14 h or more', `${s.held.over14} of ${s.held.n}`, 'Article 18.6(b); the claim form is on that tab')}</dl>`
      + pic(`Each dot is the time off before one ${w.one}, from going off duty to going on again. The dashed mark is the least the rules allow: 12 hours at home, 10 hours away. A dot left of it is under. 48 h+ gathers the longer ones.${ru.offs.some((o) => o.est) ? (Y ? ' A ring instead of a dot: the off duty time before it is an estimate (a yard shift ends when its job left the Call Board, or is taken as 8 h, 12 h on a YSBY job, where that was not seen), so the gap is too.' : ' A ring instead of a dot: the off duty time before it is an estimate (a yard shift is taken as 8 h, 12 h on a YSBY job), so the gap is too.') : ''}`, restDots(s))
      + '<p class="ms-foot">From the Duty and Rest Period Rules for Railway Operating Employees (7.1, 8.1, 8.3, 8.4, 9.1, 9.2). These are the board\'s times, not your time sheet: an off duty time marked ~ is an estimate, and the rules count some things the board cannot see (deadheading after a trip, waiting for a re-crew, an emergency). A figure near a limit is a reason to check your own records, not proof by itself.</p>',
    'Your own times set beside the limits in the rest rules.') : '';

    // How far through the 7 days before the next reset is needed.
    const clock = (() => {
      if (!more || !s.due || !s.due.dueText || !opts.now) return '';
      const due = min(T.resolve(s.due.dueText, opts.now)); const now = min(opts.now);
      if (due == null || now == null) return '';
      const left = due - now; const gone = Math.max(0, Math.min(1, 1 - left / (7 * DAY)));
      return `<div class="ms-clock" role="img" aria-label="${esc(left >= 0 ? `${hm(left)} left before a reset is needed` : 'A reset is overdue')}"><i class="${left < DAY ? 'ms-bad' : left < 2 * DAY ? 'ms-warn' : 'ms-k-out'}" style="width:${(gone * 100).toFixed(1)}%"></i></div>
        <p class="ms-note">${left >= 0 ? `${left >= DAY ? `${Math.floor(left / DAY)} ${Math.floor(left / DAY) === 1 ? 'day' : 'days'} ${Math.floor((left % DAY) / 60)} h` : hm(left)} left of the 7 days, as of the ${esc(dt(opts.now))} check.` : `Past the 7 days as of the ${esc(dt(opts.now))} check.`}</p>`;
    })();
    const resetSec = s.resets.length || s.due ? section('resets', 'Resets', `${s.resets.length ? table(['Reset', 'How', 'Since the one before', `${w.Many} before it`, 'On duty before it'], s.resets.slice().reverse().map((x) => [esc(dt(x.at)), x.kind === 'manual' ? 'put on a reset' : '32 h off, two nights', x.since == null ? '—' : `${(x.since / DAY).toFixed(1)} days`, x.trips == null ? '—' : x.trips, x.duty == null ? '—' : hm(x.duty)])) : ''}
      <dl class="ms-facts">${s.due && s.due.dueText ? fact('Next reset needed by', esc(s.due.dueText), s.due.level === 'red' ? 'within 24 h' : s.due.level === 'yellow' ? 'within 2 days' : '') : ''}
      ${s.sinceReset ? fact('Since your last reset', `${plural(s.sinceReset.trips, w.one)} · ${hm(s.sinceReset.duty)} on duty`, `reset ${esc(dt(s.sinceReset.at))}`) : ''}</dl>${clock}`,
    u.days ? 'Worked out from the trips on this page. Around the yard days that were not recorded, a reset cannot be told and none is shown.' : '') : '';

    // The member beside their pool: averages and the middle half only, never anyone's own figure.
    const poolSec = (() => {
      if (!more || !opts.pools || !opts.pools.pools) return '';
      if (Y && (yardOnly || yardWindow(rec, opts.pools))) return yardSec();
      const mine = poolFigures(rec, opts.pools);
      const name = (mine && mine.name) || '';
      const pool = mine ? opts.pools.pools[mine.pool] : null;
      const note = `The ${esc(dm(opts.pools.from))} to ${esc(dm(opts.pools.to))} checks. Only the pool's average and the middle half of the pool are ever shown: never another person's own figures.`;
      if (!mine) return section('pool', 'You and your pool', '<p class="ms-note">Not enough to compare yet: this needs 10 days in a row on one pool with at least 3 trips, and no yard days the checks did not record.</p>', note);
      const few = 'Too few people in this pool have enough saved to compare without giving away someone\'s own figures (it takes 5).';
      if (!pool) {
        // Their own pool cannot be given: the wider group it belongs to, if that can.
        const wk = wideOf(mine.pool); const wide = wk ? opts.pools.pools[wk] : null;
        const rows = wide ? poolRows(mine, wide) : '';
        if (!rows) return section('pool', `You and the ${esc(name)}`, `<p class="ms-note">${few}</p>`, note);
        return section('pool', `You and ${esc(wide.name)}`, `<p class="ms-note">${few} So yours are set beside ${esc(wide.name)} instead: ${esc(WIDE[wk][2])}.</p>
          <div class="ms-legend"><span><i class="ms-poolyou"></i>You</span><span><i class="ms-poolavg"></i>Average</span><span><i class="ms-poolband"></i>The middle half of them</span></div>${rows}`,
        `${note} Yours are for ${esc(dm(mine.from))} to ${esc(dm(mine.to))}, your days on the ${esc(name)}. ${wide.people} people had enough saved to count.`);
      }
      const rows = poolRows(mine, pool);
      return rows ? section('pool', `You and the ${esc(name)}`, `<div class="ms-legend"><span><i class="ms-poolyou"></i>You</span><span><i class="ms-poolavg"></i>Pool average</span><span><i class="ms-poolband"></i>The middle half of the pool</span></div>${rows}`,
        `${note} Yours are for ${esc(dm(mine.from))} to ${esc(dm(mine.to))}, your days on this pool. ${pool.people} people in the pool had enough saved to count.`) : '';
    })();

    const turnSec = s.byTurn.length ? section('turns', yardOnly ? (new Set(s.trips.map((t) => t.id)).size > 1 ? 'Your jobs, side by side' : 'Your job') : s.byTurn.length > 1 ? 'Your turns, side by side' : 'Your turn', (more ? pic(`Each mark is one ${w.one} going on duty, by the time of day, for each turn you held. The shaded hours are midnight to 0600. Marks in the same half hour are stacked.`, turnChart(s, w.one)) : '') + (yardOnly ? yardTurnTable() : table(['Turn', 'Trips', 'On duty going out', 'On duty coming home', 'A trip', 'Total away', 'Usual call miss', 'Call changes'],
      s.byTurn.map((t) => [`<b>${esc(t.turn)}</b><small>${esc(dm(t.from))} to ${esc(dm(t.to))}</small>`, `${t.trips}${t.yard ? `<small>${plural(t.yard, 'yard shift')}</small>` : ''}`, esc(t.out.join(' ')) || '—', esc(t.home.join(' ')) || '—', hm(t.duty), hm(t.away), t.miss == null ? '—' : hm(t.miss), t.calls ? t.changes : '—'])))) : '';

    const people = s.partners.length || s.numbers.length || (more && s.jobs.length) || (Y && yf.crew.length) ? section('with', 'Worked with, and on what', `<dl class="ms-facts">
      ${s.partners.length ? fact('Worked with most', s.partners.map(([p, n]) => `${esc(p)} <small class="ms-inline">× ${n}</small>`).join(' · ')) : ''}${Y && yf.crew.length ? fact('Spares on your yard crews', yf.crew.map(([p, n]) => `${esc(p)} <small class="ms-inline">× ${n}</small>`).join(' · '), 'a turn shown beside a craft on the job\'s crew lines; a job\'s own crew shows no turn') : ''}
      ${s.numbers.length ? fact('Trains by number', s.numbers.map(([p, n]) => `${esc(p)} <small class="ms-inline">× ${n}</small>`).join(' · ')) : ''}
      ${more && s.jobs.length ? fact('Jobs filled in on', s.jobs.map(([p, n]) => `${esc(p)} <small class="ms-inline">× ${n}</small>`).join(' · '), 'another turn\'s train, or a yard job') : ''}</dl>`) : '';

    const f = s.flags;
    const flagSec = f.passed.length || f.stale.length || (Y && yf.own.length ? yf.offBy.spare : f.spares) ? section('flags', 'Things on the record', `<dl class="ms-facts">
      ${f.passed.length ? fact('Times someone else went', String(f.passed.length), `${f.likely} marked likely runaround · ${f.possible} possible · ${f.explained} explained`) : ''}
      ${f.stale.length ? fact('Your trains left stale', String(f.stale.length), f.staleWorst ? `longest ${f.staleWorst.min} min past the call still only planned (${esc(f.staleWorst.train)})` : '') : ''}
      ${f.spareTrains.length ? fact('Your trains that went to the spareboard', String(f.spareTrains.length), esc(f.spareTrains.slice(-6).join(', '))) : ''}
      ${Y && yf.own.length ? (yf.offBy.spare ? fact('Days your job went spare for your craft', String(yf.offBy.spare), 'and you did not work: the vacancy list') : '') : f.spares ? fact('Goes-spare notes on your turn', String(f.spares)) : ''}</dl>
      ${f.passed.filter((x) => x.result !== 'explained').length ? table(['Seen', 'Train', 'Who went', 'Marked'], f.passed.filter((x) => x.result !== 'explained').reverse().map((x) => [esc(dt(x.seen)), `<b>${esc(x.train)}</b>`, esc(x.went || '?'), esc(x.result)])) : ''}`) : '';

    // Every trip, newest first: the duty and rest log.
    const log = more ? section('log', `Every ${w.one}`, table(['On duty', w.job, 'Off duty', 'On duty for', 'Time off before', 'Call'],
      logRows(s).reverse().map((x) => [esc(dt(x.at)), `<b>${esc(x.id)}</b><small>${esc(x.from === 'yard' ? 'yard' : title(x.from))}${x.job && x.job !== x.id ? ` · working ${esc(x.job)}` : ''} · ${esc(x.turn)}</small>${x.aka.length ? `<small>also shown as ${x.aka.map(esc).join(', ')}</small>` : ''}`,
        `${x.est ? '~' : ''}${esc(dt(x.off))}`, `${x.est ? '~' : ''}${hm(x.dur)}`, x.gap == null ? '—' : hm(x.gap), x.call ? `<span class="ms-pill ${Math.abs(x.call.off) <= 30 ? 'ms-ok' : Math.abs(x.call.off) <= 60 ? 'ms-warn' : 'ms-bad'}">${esc(off(x.call.off))}</span>` : '—']))
      + `<p><button type="button" class="ms-btn" data-ms-csv>⬇ Spreadsheet of these ${w.many}</button></p>`,
    Y ? 'Every train and yard shift in the dates picked, newest first. ~ marks an off duty time that is an estimate: a yard shift\'s is when its job left the Call Board (good to about 5 minutes), or 8 h (12 h on a YSBY job) where that was not seen.'
      : 'Every train and yard shift in the dates picked, newest first. ~ marks an off duty time that is an estimate (a yard shift is taken as 8 h, 12 h on a YSBY job).') : '';

    // The test site's yard pieces (opts.yard).
    // You and the yard: in place of the pool for someone on yard jobs or the yard spareboard.
    function yardSec() {
      const note = `The ${esc(dm(opts.pools.from))} to ${esc(dm(opts.pools.to))} checks. Only the yard workers' average and the middle half of them are ever shown: never another person's own figures. Shift lengths are by when the job left the Call Board.`;
      const mine = yardFigures(rec, opts.pools, lenOf);
      if (!mine) {
        const win = yardWindow(rec, opts.pools);
        const ready = win ? dayStr(dayNum(win.from) + 9) : '';
        return section('pool', 'You and the yard', `<p class="ms-note">Not enough to compare yet: this needs 10 days in a row on yard jobs or the yard spareboard with at least 3 shifts, after any days the checks did not record${ready && ready > (opts.pools.to || '') ? ` (yours: from about ${esc(dm(ready))})` : ''}.</p>`, note);
      }
      const yd = opts.pools.yard;
      const rows = yd ? poolRows(mine, yd, YARD_FIGURES, ['yard average', 'The middle half of the yard workers']) : '';
      if (!rows) return section('pool', 'You and the yard', '<p class="ms-note">Too few yard workers have enough saved to compare without giving away someone\'s own figures (it takes 5).</p>', note);
      return section('pool', 'You and the yard', `<div class="ms-legend"><span><i class="ms-poolyou"></i>You</span><span><i class="ms-poolavg"></i>Yard average</span><span><i class="ms-poolband"></i>The middle half of the yard workers</span></div>${rows}`,
        `${note} Yours are for ${esc(dm(mine.from))} to ${esc(dm(mine.to))}. ${yd.people} yard workers had enough saved to count.`);
    }
    // Your turn(s), for someone with only yard shifts: a row a job.
    function yardTurnTable() {
      const byJob = new Map();
      for (const t of s.trips) (byJob.get(t.id) || byJob.set(t.id, []).get(t.id)).push(t);
      const ownJobs = new Set(yf.own.map((x) => x.job));
      const rows = [...byJob.entries()].sort((a, b) => (ownJobs.has(b[0]) - ownJobs.has(a[0])) || b[1].length - a[1].length).map(([job, ts]) => {
        const cnt = new Map(); for (const t of ts) cnt.set(t.at.slice(11), (cnt.get(t.at.slice(11)) || 0) + 1);
        let start = ''; for (const [k, n] of cnt) if (!start || n > cnt.get(start)) start = k;
        const timed = ts.filter((t) => t.rb);
        const nights = ts.filter((t) => { for (let d = Math.floor(t.on / DAY); d * DAY < t.end; d++) if (overlap(t.on, t.end, d * DAY, d * DAY + 360) > 0) return true; return false; }).length;
        return [`<b>${esc(job)}</b><small>${ownJobs.has(job) ? 'your own job' : 'filling in'} · ${esc(dm(ts[0].at))} to ${esc(dm(ts[ts.length - 1].at))}</small>`, ts.length, esc(start), `~${hm(avg(ts.map((t) => t.dur)))}`, timed.length ? `${timed.filter((t) => yf.past(t) >= 15).length} of ${timed.length}` : '—', nights];
      });
      return table(['Job', 'Shifts', 'Usual start', 'A shift', 'Ran 15 min+ over', 'Nights'], rows);
    }
    const yardJobSec = Y && (yf.own.length || s.yard) ? section('yardjob', yf.own.length > 1 ? 'Your yard jobs' : yf.own.length ? 'Your yard job' : 'Your yard shifts', `<dl class="ms-facts">
      ${yf.own.map((j) => fact(`${esc(j.job)}${j.cc ? ` · ${esc(j.cc)}` : ''}`, j.n ? plural(j.n, 'shift') : 'no shifts in these dates', [j.start ? `usually on duty ${esc(j.start)}` : '', j.median != null ? `usually ~${hm(j.median)} by the Call Board` : ''].filter(Boolean).join(' · '))).join('')}
      ${s.yard ? fact('Shifts on jobs not your own', String(yf.elsewhere), yf.own.length ? 'filling in' : 'you held no yard job of your own in these dates') : ''}
      ${yf.offs.length ? fact('Days off the board gave a reason for', String(yf.offs.length), [yf.offBy.booked ? `${yf.offBy.booked} booked off` : '', yf.offBy.spare ? `${yf.offBy.spare} your job went spare for your craft` : '', yf.offBy.norun ? `${yf.offBy.norun} your job did not go on duty` : ''].filter(Boolean).join(' · ')) : ''}
      ${s.yard ? fact('Shifts timed by the Call Board', `${yf.timed} of ${s.yard}`, yf.untimed ? `${yf.untimed} taken as 8 h (12 h on a YSBY job): no end seen` : 'every one') : ''}</dl>`,
    'From your name on the job\'s crew lines. A shift ends when its job left the Call Board, which the checks look at about every 8 minutes.') : '';
    const overSec = Y && yf.timed ? section('overtime', 'Yard shifts that ran over, and early finishes', `<dl class="ms-facts">
      ${fact('Ran 15 min or more past its length', `${yf.over.n} of ${yf.timed}`, yf.over.n ? `${hm(yf.over.total)} past in all · most ${hm(yf.past(yf.over.worst))} (${esc(yf.over.worst.id)}, ${esc(dm(yf.over.worst.at))})` : '')}
      ${fact('Ended 30 min or more early', `${yf.early.n} of ${yf.timed}`, yf.early.n ? `most ${hm(-yf.past(yf.early.worst))} early (${esc(yf.early.worst.id)}, ${esc(dm(yf.early.worst.at))})` : '')}
      ${yf.untimed ? fact('Not timed', String(yf.untimed), 'no end seen on the Call Board (still on, a gap in the checks, or listed far too long): taken as 8 h, 12 h on a YSBY job') : ''}</dl>`
      + (more ? pic('Each bar is one shift, newest first: how far it ended from its job\'s own length (8 h, or 12 h for a job that usually runs 12). The shaded strip is 15 minutes either way. Bars stop at 3 hours.',
        divergeChart(yf.timedList.slice(-20).reverse().map((t) => ({ label: dm(t.at), v: yf.past(t), tip: `${t.id}, on duty ${dt(t.at)}, off ~${dt(T.fromMin(t.end))}: ~${hm(t.dur)}` })), { band: 15, aria: 'How far each yard shift ended from its own length', sign: ['early', 'over'] })) : ''),
    'By when the job left the Call Board, which the checks look at about every 8 minutes: good to about 5 minutes. The board\'s times, not your time sheet.') : '';
    const jobsSec = (() => {
      const yj = opts.yardJobs;
      if (!Y || !more || !yj || !Array.isArray(yj.jobs) || !yj.jobs.length || !(s.yard || yf.own.length)) return '';
      const mineJ = new Set([...yf.own.map((x) => x.job), ...s.trips.filter((t) => t.yard).map((t) => t.id)]);
      const head = ['Job', 'On duty', 'Usual length', 'Ran 15 min+ over', 'Ended 30 min+ early', 'Longest'];
      const row = (j) => [`<b>${esc(j.job)}</b><small>${mineJ.has(j.job) ? 'you worked it · ' : ''}${j.length === 480 ? 'an 8 h job' : `a ${f1(j.length / 60)} h job`}</small>`, esc(j.start), j.median == null ? '—' : `~${hm(j.median)}<small>${j.timed} of ${plural(j.runs, 'run')} timed</small>`, j.timed ? `${j.over} of ${j.timed}` : '—', j.timed ? `${j.early} of ${j.timed}` : '—', j.longest == null ? '—' : `~${hm(j.longest)}`];
      const mineList = yj.jobs.filter((j) => mineJ.has(j.job)); const rest = yj.jobs.filter((j) => !mineJ.has(j.job));
      return section('yardjobs', 'How each yard job runs', (mineList.length ? table(head, mineList.map(row)) : '')
        + (rest.length ? `<details class="ms-more"><summary>${mineList.length ? `Every other yard job (${rest.length})` : `Every yard job (${rest.length})`}</summary>${table(head, rest.map(row))}</details>` : ''),
      `The ${esc(dm(yj.from))} to ${esc(dm(yj.to))} checks: each job's own runs, by when it left the Call Board, never anyone's own figures. A job's length is 12 h where its runs usually go 10 h or more, else 8 h.`);
    })();

    const foot = Y ? `<p class="ms-foot">Worked out from the saved board checks, never from a time sheet. A ${w.one} is yours when your name was read on its crew (from 3 November), or, before names were read, when your turn was on it. Off duty comes from the rest times CATS showed; a yard shift ends when its job left the Call Board, or is taken as 8 h (12 h for YSBY) where that was not seen. A day off shows the board's reason where it gave one (booked off, your job went spare for your craft, your job did not go on duty); any other day with no duty is just that. Pay, miles and claims are not tracked.</p>`
      : `<p class="ms-foot">Worked out from the saved board checks, never from a time sheet. A trip is yours when your name was read on its crew (from 3 November), or, before names were read, when your turn was on it. Off duty comes from the rest times CATS showed; a yard shift is taken as 8 h (12 h for YSBY). A day you were booked off, on vacation or not on any board looks the same here: no duty. Pay, miles and claims are not tracked.</p>`;
    const look = opts.other ? `<p class="ms-warnnote"><b>${esc(opts.code)}'s page, opened with the owner key.</b> Their own record, drawn with the test site's pieces. Only the owner key can open another code's page.</p>` : '';
    return `<div class="ms">${defs}${head}${look}${unknown}${tiles}${yardJobSec}${time}${days}${hours}${week}${cal}${weeks}${months}${tours}${callSec}${lineSec}${restSec}${rulesSec}${overSec}${resetSec}${poolSec}${turnSec}${jobsSec}${people}${flagSec}${log}${foot}</div>`;
  }

  // The tab's own styles, in the page's colours (public/board.html tokens).
  const CSS = `
  .ms { display: grid; gap: 22px; padding: 4px 0 28px; color: var(--ink); font-family: var(--body);
    /* The pale fill behind things (night hours, tracks, the 30 minute strip): a
       tenth of the style's own ink in its sheet, so it shows in every page style
       (two of them set the page's pale tint to nothing) and the style's soft ink
       still reads on it. Outlines, not shadows: two styles switch shadows off.
       A phone too old for color-mix (iOS 15 and before) gets the plain
       colours here; the mixed ones are in the @supports block at the end. */
    --ms-pale: var(--plan-tint); }
  .ms h2 { margin: 0; font: 600 26px/1.1 var(--display); letter-spacing: .01em; }
  .ms h3 { margin: 0 0 4px; font: 600 19px/1.2 var(--display); letter-spacing: .02em; text-wrap: balance; }
  .ms-code { font: 500 14px var(--mono); color: var(--soft); margin-left: 6px; }
  .ms-head { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: flex-end; justify-content: space-between; background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 12px 14px; }
  .ms-head .ms-note { margin-bottom: 0; }
  .ms-note { margin: 2px 0 10px; color: var(--soft); font-size: 13.5px; max-width: 65ch; }
  .ms-warnnote { margin: 0; padding: 10px 14px; background: var(--amber-tint); border: 1px solid var(--rule); border-radius: 10px; font-size: 13.5px; max-width: 75ch; }
  .ms-empty { color: var(--soft); margin: 0; padding: 16px 14px; background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; }
  .ms-ranges { display: flex; flex-wrap: wrap; gap: 6px; }
  .ms-ranges button, .ms-btn { font: 500 13.5px var(--body); padding: 7px 12px; border: 1px solid var(--rule); border-radius: 999px; background: var(--sheet); color: var(--ink); cursor: pointer; }
  .ms-ranges button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .ms-ranges button:focus-visible, .ms-btn:focus-visible, .ms [data-tip]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .ms-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .ms-tile { background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 12px 14px; display: grid; gap: 2px; min-width: 0; align-content: start; }
  .ms-tile b { font: 600 32px/1 var(--display); font-variant-numeric: tabular-nums; }
  .ms-tile b i { font: 500 .52em var(--display); color: var(--soft); font-style: normal; }
  .ms-tile span { font-size: 13.5px; }
  .ms-tile small { color: var(--soft); font-size: 12.5px; }
  .ms-sec { background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; padding: 14px 16px 16px; min-width: 0; }
  .ms-fig { margin: 12px 0 0; }
  .ms-fig figcaption { color: var(--soft); font-size: 12.5px; max-width: 60ch; margin-top: 6px; }
  .ms-chart { display: block; width: 100%; height: auto; max-width: 520px; }
  .ms-chart text { font-family: var(--body); fill: var(--soft); }
  .ms-tick { font-size: 11px; }
  .ms-strong { fill: var(--ink) !important; font-weight: 600; }
  .ms-mono { font-family: var(--mono) !important; fill: var(--ink) !important; font-size: 10.5px; }
  .ms-val { font-size: 11px; fill: var(--ink) !important; font-variant-numeric: tabular-nums; }
  .ms-axis { stroke: var(--rule); stroke-width: 1; }
  .ms-grid { stroke: var(--rule-soft); stroke-width: 1; }
  .ms-limit { stroke: var(--stop); stroke-width: 1.5; stroke-dasharray: 5 4; }
  .ms-night { fill: var(--ms-pale); opacity: .8; }
  .ms-band { fill: var(--ms-pale); }
  .ms-bar { fill: var(--accent); }
  .ms-bar.ms-part { fill: var(--accent); opacity: .45; }
  .ms-track { fill: var(--ms-pale); opacity: .6; }
  .ms-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .ms-area { fill: var(--accent); opacity: .14; }
  .ms-hit { fill: transparent; }
  circle.ms-dot { fill: var(--accent); stroke: var(--sheet); stroke-width: 2; }
  /* A mark a trip: a filled dot going out, a ring coming home, a square a yard shift (shape, not only colour). */
  circle.ms-m-out { fill: var(--accent); } circle.ms-m-home { fill: var(--sheet); stroke: var(--amber); stroke-width: 2.5; } rect.ms-m-yard { fill: var(--sheet); stroke: var(--poolB); stroke-width: 2; }
  i.ms-m-out { background: var(--accent); border-radius: 50% !important; } i.ms-m-home { background: var(--sheet); outline: 3px solid var(--amber); outline-offset: -3px; border-radius: 50% !important; }
  i.ms-m-yard { background: var(--sheet); outline: 2px solid var(--poolB); outline-offset: -2px; border-radius: 0 !important; }
  circle.ms-dotbad { fill: var(--stop); stroke: var(--sheet); stroke-width: 2; }
  circle.ms-dot.ms-dotest { fill: var(--sheet); stroke: var(--accent); stroke-width: 2.5; } circle.ms-dotbad.ms-dotest { fill: var(--sheet); stroke: var(--stop); stroke-width: 2.5; }
  i.ms-dotkey.ms-dotest { background: var(--sheet); outline: 2.5px solid var(--accent); outline-offset: -2.5px; }
  /* Going out, coming home and yard jobs differ in texture as well as colour:
     solid, striped, hollow. In eight page styles the accent and the amber are
     the same or nearly, and in ten the accent and the yard colour are. */
  .ms-defs { position: absolute; width: 0; height: 0; overflow: hidden; }
  .ms-hatch-a { fill: var(--amber); } .ms-hatch-b { fill: var(--sheet); opacity: .55; }
  rect.ms-k-out { fill: var(--accent); } rect.ms-k-home { fill: url(#ms-hatch) var(--amber); }
  rect.ms-k-yard { fill: var(--sheet); stroke: var(--poolB); stroke-width: 2; }
  rect.ms-ok { fill: var(--go); } rect.ms-warn { fill: var(--amber); } rect.ms-bad { fill: var(--stop); }
  rect.ms-heldband { fill: var(--amber-tint); stroke: var(--amber); stroke-width: 1; } rect.ms-held14 { fill: var(--stop-tint); stroke: var(--stop); stroke-width: 2.5; }
  rect.ms-outband { fill: var(--ms-pale); }
  rect.ms-calltick { fill: var(--ink); } rect.ms-resetmark { fill: var(--go); } rect.ms-restband { fill: var(--go); }
  rect.ms-unkrow { fill: none; stroke: var(--soft); stroke-width: 1; stroke-dasharray: 3 3; opacity: 1; }
  i.ms-k-out { background: var(--accent); }
  i.ms-k-home { background: repeating-linear-gradient(135deg, var(--amber) 0 3.5px, var(--sheet) 3.5px 5.5px); }
  i.ms-k-yard { background: var(--sheet); outline: 2px solid var(--poolB); outline-offset: -2px; }
  i.ms-k-rest { background: var(--ms-pale); outline: 1px solid var(--rule); outline-offset: -1px; }
  i.ms-k-lost { background: repeating-linear-gradient(135deg, var(--ms-pale) 0 4px, var(--sheet) 4px 8px); outline: 1px solid var(--rule); outline-offset: -1px; }
  i.ms-ok { background: var(--go); } i.ms-warn { background: var(--amber); } i.ms-bad { background: var(--stop); }
  i.ms-heldband { background: var(--amber-tint); outline: 1px solid var(--amber); outline-offset: -1px; } i.ms-held14 { background: var(--stop-tint); outline: 1px solid var(--stop); outline-offset: -1px; }
  i.ms-outband { background: var(--ms-pale); outline: 1px solid var(--rule); outline-offset: -1px; }
  i.ms-calltick { background: var(--ink); width: 3px !important; border-radius: 0 !important; } i.ms-resetmark { background: var(--go); width: 3px !important; border-radius: 0 !important; }
  i.ms-unkrow { background: none; outline: 1px dashed var(--soft); outline-offset: -1px; }
  i.ms-restband { background: var(--go); height: 4px !important; width: 14px !important; border-radius: 0 !important; }
  i.ms-linekey { background: var(--accent); height: 3px !important; width: 16px !important; border-radius: 2px !important; }
  i.ms-dotkey { background: var(--accent); border-radius: 50% !important; width: 9px !important; height: 9px !important; }
  .ms-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 8px 0 6px; font-size: 13px; color: var(--soft); }
  .ms-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .ms-legend b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .ms-legend i { width: 12px; height: 12px; border-radius: 3px; flex: none; }
  .ms-split { display: flex; gap: 2px; height: 26px; max-width: 520px; }
  .ms-split i { min-width: 3px; border-radius: 4px; }
  .ms-clock { height: 12px; max-width: 520px; background: var(--ms-pale); border-radius: 6px; overflow: hidden; margin-top: 12px; }
  .ms-clock i { display: block; height: 100%; border-radius: 6px; }
  .ms-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 18px; margin: 12px 0 0; }
  .ms-fact { min-width: 0; border-top: 1px solid var(--rule-soft); padding-top: 8px; }
  .ms-fact dt { color: var(--soft); font-size: 12.5px; }
  .ms-fact dd { margin: 2px 0 0; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .ms-fact dd small { display: block; font-weight: 400; color: var(--soft); font-size: 12.5px; }
  .ms-fact dd small.ms-inline { display: inline; }
  /* A table wider than the phone scrolls sideways in its own box: a soft dark
     edge shows on whichever side has more to see (the two sheet-coloured
     strips ride with the table and cover the edge once that end is reached). */
  .ms-scroll { overflow-x: auto; margin-top: 10px; }
  .ms-table { border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .ms-table th { text-align: left; font-weight: 500; color: var(--soft); font-size: 12px; padding: 6px 12px 6px 0; border-bottom: 1px solid var(--rule); white-space: nowrap; }
  .ms-table td { padding: 7px 12px 7px 0; border-bottom: 1px solid var(--rule-soft); vertical-align: top; white-space: nowrap; }
  .ms-table td small { display: block; color: var(--soft); font-size: 12px; }
  .ms-table b { font-family: var(--mono); font-weight: 500; }
  .ms-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12.5px; font-weight: 500; }
  .ms-pill.ms-ok { background: var(--go-tint); color: var(--go); } .ms-pill.ms-warn { background: var(--amber-tint); color: var(--amber); } .ms-pill.ms-bad { background: var(--stop-tint); color: var(--stop); }
  .ms-cal { max-width: 430px; }
  .ms-calhead, .ms-calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .ms-calhead span { font-size: 11.5px; color: var(--soft); text-align: center; padding-bottom: 3px; }
  .ms-day { aspect-ratio: 1; border-radius: 5px; display: grid; align-content: center; justify-items: center; font-style: normal; line-height: 1.05; min-width: 0; }
  .ms-day b { font: 500 12px var(--body); } .ms-day span { font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .ms-pad { visibility: hidden; }
  /* The day numbers have to read on every fill in every page style: the
     style's ink on its sheet with up to a quarter of the accent in it, its
     accent ink on the accent with at most 15% sheet. Measured over all the
     styles (November 2026): 3.2 to 1 at worst; the half-and-half fills the
     calendar used before fell to 2 to 1 in the white-on-dark ones. */
  .ms-s0 { background: none; outline: 1px solid var(--rule); outline-offset: -1px; color: var(--soft); }
  .ms-s1 { background: none; outline: 2px solid var(--accent); outline-offset: -2px; color: var(--ink); }
  .ms-s2 { background: none; outline: 4px solid var(--accent); outline-offset: -4px; color: var(--ink); }
  .ms-s3 { background: var(--accent); color: var(--accent-ink); }
  .ms-s4 { background: var(--accent); color: var(--accent-ink); outline: 2px solid var(--ink); outline-offset: -2px; }
  .ms-unseen { background: repeating-linear-gradient(135deg, var(--ms-pale) 0 4px, var(--sheet) 4px 8px); outline: 1px solid var(--rule-soft); outline-offset: -1px; }
  .ms-unkday { background: none; outline: 1px dashed var(--soft); outline-offset: -1px; color: var(--soft); }
  /* A day off the board gave a reason for (the test site's yard pieces): a solid ring, the reason in its tip. */
  .ms-offday { outline: 2px solid var(--soft); outline-offset: -2px; } .ms-offday span { font-style: italic; }
  .ms-more > summary { padding: 10px 0 4px; font-weight: 600; cursor: pointer; }
  .ms-legend .ms-day { width: 14px; height: 14px; aspect-ratio: auto; }
  .ms-pool { margin-top: 14px; max-width: 520px; }
  .ms-poolhead { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; font-size: 13.5px; }
  .ms-poolhead span { color: var(--soft); font-variant-numeric: tabular-nums; } .ms-poolhead span b { color: var(--ink); }
  .ms-pooltrack { position: relative; height: 18px; margin: 5px 0 3px; background: var(--ms-pale); border-radius: 9px; }
  .ms-pooltrack i { position: absolute; top: 0; height: 100%; }
  i.ms-poolband { background: var(--accent); opacity: .35; border-radius: 9px; }
  i.ms-poolavg { width: 2px; background: var(--ink); margin-left: -1px; }
  i.ms-poolyou { width: 14px; height: 14px !important; top: 2px !important; margin-left: -7px; border-radius: 50%; background: var(--amber); outline: 2px solid var(--sheet); }
  .ms-legend i.ms-poolyou { position: static; margin: 0; outline: 0; width: 12px; height: 12px !important; border-radius: 50%; }
  .ms-legend i.ms-poolavg { width: 3px; border-radius: 0; margin: 0; } .ms-legend i.ms-poolband { border-radius: 3px; }
  .ms-pool small { color: var(--soft); font-size: 12.5px; }
  .ms-foot { color: var(--soft); font-size: 12.5px; max-width: 70ch; margin: 10px 0 0; }
  .ms > .ms-foot { margin: 0; max-width: none; padding: 10px 14px; background: var(--sheet); border: 1px solid var(--rule-soft); border-radius: 10px; }
  .ms-tip { position: fixed; z-index: 50; pointer-events: none; background: var(--ink); color: var(--sheet); font: 500 12.5px var(--body); padding: 5px 9px; border-radius: 6px; max-width: 260px; }
  @media (max-width: 520px) { .ms-sec { padding: 12px 12px 14px; } .ms-tile b { font-size: 27px; } }
  @supports (color: color-mix(in srgb, red 50%, blue)) {
    .ms { --ms-pale: color-mix(in srgb, var(--ink) 10%, var(--sheet)); }
    .ms-bar.ms-part { fill: color-mix(in srgb, var(--accent) 45%, var(--sheet)); opacity: 1; }
    rect.ms-k-yard { fill: color-mix(in srgb, var(--poolB) 30%, var(--sheet)); }
    i.ms-k-home { background: repeating-linear-gradient(135deg, var(--amber) 0 3.5px, color-mix(in srgb, var(--amber) 45%, var(--sheet)) 3.5px 5.5px); }
    i.ms-k-yard { background: color-mix(in srgb, var(--poolB) 30%, var(--sheet)); }
    .ms-s1 { background: color-mix(in srgb, var(--accent) 12%, var(--sheet)); outline: 0; }
    .ms-s2 { background: color-mix(in srgb, var(--accent) 25%, var(--sheet)); outline: 0; }
    .ms-s3 { background: color-mix(in srgb, var(--accent) 85%, var(--sheet)); }
    i.ms-poolband { background: color-mix(in srgb, var(--accent) 35%, var(--sheet)); opacity: 1; }
    .ms-scroll { background: linear-gradient(to right, var(--sheet) 40%, transparent) left center / 28px 100% no-repeat local, linear-gradient(to left, var(--sheet) 40%, transparent) right center / 28px 100% no-repeat local,
      linear-gradient(to right, color-mix(in srgb, var(--ink) 22%, transparent), transparent) left center / 12px 100% no-repeat scroll, linear-gradient(to left, color-mix(in srgb, var(--ink) 22%, transparent), transparent) right center / 12px 100% no-repeat scroll; }
  }
  `;

  // Range buttons, the spreadsheet button and the value beside the pointer.
  // onRange(key) redraws; onCsv() hands over the spreadsheet.
  let refit = null;
  function wire(box, onRange, onCsv) {
    // The big figures are set in each page style's display face, and some of
    // those are twice as wide as the usual one: any figure that has wrapped
    // onto a second line is made smaller until it sits on one.
    const fit = () => box.querySelectorAll('.ms-tile b').forEach((b) => {
      b.style.fontSize = '';
      let size = parseFloat(getComputedStyle(b).fontSize);
      const lines = () => b.getBoundingClientRect().height / (parseFloat(getComputedStyle(b).fontSize) || 1);
      while (size > 14 && lines() > 1.45) { size -= 1; b.style.fontSize = `${size}px`; }
    });
    try {
      fit();
      if (!refit && typeof window !== 'undefined') { window.addEventListener('resize', () => { if (refit) refit(); }); if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (refit) refit(); }); }
      refit = fit;
    } catch (e) { /* the figures wrap, as before */ }
    let el = null;
    const hide = () => { if (el) { el.remove(); el = null; } };
    box.querySelectorAll('[data-ms-range]').forEach((b) => { b.onclick = () => { hide(); onRange(b.dataset.msRange); }; });
    box.querySelectorAll('[data-ms-csv]').forEach((b) => { b.hidden = !onCsv; b.onclick = () => { if (onCsv) onCsv(); }; });
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

  const api = { V, personRecord, daySpans, build, merge, stats, html, wire, csv, rangeOf, poolOf, poolFigures, poolSummary, POOL_FIGURES, RULES, CSS, RANGES,
    boardEnd, yardLength: yardMinutes, lengthFrom, lengthOf, yardView, yardFigures, yardSummary, YARD_FIGURES };
  if (node) module.exports = api;
  else root.BoardMyStats = api;
})(this);

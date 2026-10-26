// Daily order summary (owner, 2026-10-16): follows each line-up train
// (Sarnia's, and since 2026-10-17 Mac yard's westbound ones)
// from the first check it showed up in, through every change to its planned
// and ordered time, to its on-duty time on the Call Board (option 6), and
// says how far the first plan and the first order were from that.
//
// A train is its ID as CATS shows it, symbol + origin day ("M30241 15"),
// which only repeats once a month; the origin day is pinned to the nearest
// real date so next month's M30241 15 is a different train.
//
// Shared by the page (window.BoardTrains) and the site builder.
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  // "2026-10-15 0815" ⇄ minutes since the epoch (zone-free, like lib/board/time.js).
  function toMin(stamp) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(stamp || '');
    return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null;
  }
  function fromMin(min) {
    const d = new Date(min * 60000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  }
  // A bare day-of-month, as the nearest real date to `ref` (last, this or next month).
  function nearestDate(day, hhmm, ref) {
    const r = new Date(toMin(ref) * 60000);
    const cands = [-1, 0, 1].map((dm) => Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + dm, +day, +hhmm.slice(0, 2), +hhmm.slice(2)) / 60000)
      // Date.UTC rolls 31 into the next month; only keep real dates.
      .filter((m) => new Date(m * 60000).getUTCDate() === +day);
    const refMin = toMin(ref);
    return fromMin(cands.reduce((best, c) => (Math.abs(c - refMin) < Math.abs(best - refMin) ? c : best)));
  }
  // "15th 1100" as seen in the check taken at `ref` → "2026-10-15 1100".
  function resolve(shown, ref) {
    const m = /^(\d{1,2})\w*\s+(\d{4})$/.exec(shown || '');
    return m ? nearestDate(m[1], m[2], ref) : null;
  }
  // "M30241 15" first seen at `ref` → its key with the month pinned.
  function trainKey(train, ref) {
    const [symbol, od] = train.split(' ');
    const date = nearestDate(od, '1200', ref).slice(0, 7);
    return `${symbol} ${od} ${date}`;
  }

  // Feeds snapshots (oldest first) into `state`; call it again with more
  // snapshots to carry on (the builder does, one day at a time).
  // Which line-up a train came from, and whether that screen was read in a
  // check (a skipped screen mustn't make its trains look gone).
  const SOURCES = [['sarnia', 'lineup'], ['mac', 'macLineup']];
  const wasRead = (s, field) => (s.screens ? s.screens.includes(field) : (s[field] || []).length > 0);
  const REST_MIN = 480; // bunkhouse rest is always 8 h after off duty (owner)
  // No Toronto off-duty time for L501/L502 (S5) or trains that start in
  // Toronto (owner, 2026-10-17).
  // A train starts in Toronto when it's on Mac yard's line-up, or its
  // manifest number's third digit is odd (M399, A425; same rule as engine.js).
  const torontoStart = (id) => { const m = /^([A-Z]+)\d\d(\d)/.exec(id); return !!m && !/^DH/.test(m[1]) && +m[2] % 2 === 1; };
  const noOffDuty = (r) => r.from === 'mac' || /^L50[12]/.test(r.id) || torontoStart(r.id);
  const crewHas = (crew, turn) => new RegExp(`(^|[^A-Z0-9])${turn}([^A-Z0-9]|$)`).test(crew || '');

  // Feeds snapshots (oldest first) into `state`; call it again with more
  // snapshots to carry on (the builder does, one day at a time).
  function track(snapshots, state = { trains: {} }) {
    for (const s of snapshots) {
      state.lastTaken = s.taken;
      const seenNow = new Set();
      // Rested crews in the Mac bunkhouse right now (only counts if read).
      const avail = wasRead(s, 'bunkhouse') ? (s.bunkhouse || []).filter((c) => c.ready).length : null;
      for (const [from, field] of SOURCES) {
        for (const t of s[field] || []) {
          const key = trainKey(t.train, s.taken);
          seenNow.add(key);
          const at = resolve(t.order, s.taken);
          let r = state.trains[key];
          if (!r) {
            r = state.trains[key] = { id: t.train, from, month: key.slice(-7), firstSeen: s.taken, firstPlan: null, firstOrder: null,
              orderedSeen: null, plan: null, order: null, planChanges: 0, orderChanges: 0, onDuty: null, crew: '', deadhead: !!t.deadhead,
              offDuty: null, events: [] };
            r.events.push({ taken: s.taken, kind: 'seen', at, status: t.status, from });
            if (t.status === 'PLN') r.firstPlan = r.plan = at;
          } else if (r.gone) {
            r.events.push({ taken: s.taken, kind: 'back', at, status: t.status });
            delete r.gone;
          }
          if (from === 'mac') r.avail = avail;
          // The crew the site predicted, last seen before it went on duty
          // (owner, 2026-10-22: how often the prediction was right).
          if (t.pred && !r.onDuty) {
            r.predicted = { ...t.pred, taken: s.taken };
            // Each change of prediction, to see how early it was right (owner, 2026-10-26).
            const last = (r.predLog ||= [])[r.predLog.length - 1];
            if (!last || last.co !== t.pred.co || last.en !== t.pred.en) r.predLog.push({ taken: s.taken, co: t.pred.co, en: t.pred.en });
          }
          if (t.status === 'ORD') {
            if (!r.firstOrder) {
              r.firstOrder = r.order = at;
              r.orderedSeen = s.taken;
              if (r.events.length > 1 || r.events[0].status !== 'ORD') r.events.push({ taken: s.taken, kind: 'ordered', at });
            } else if (at !== r.order) {
              r.events.push({ taken: s.taken, kind: 'orderChange', at, from: r.order });
              r.order = at;
              r.orderChanges++;
            }
          } else if (!r.firstOrder && at !== r.plan) {
            if (r.plan) {
              r.events.push({ taken: s.taken, kind: 'planChange', at, from: r.plan });
              r.planChanges++;
            }
            r.plan = at;
          }
        }
      }
      // The Call Board: the actual on-duty time.
      for (const t of s.onDuty || []) {
        // Every crew that goes on duty in Toronto, line-up train or not: the
        // trip home for the 14-hour check.
        if (/TORONTO/.test(t.station || '')) {
          const at = resolve(t.onDuty, s.taken);
          if (at) (state.toronto ||= {})[`${t.train} ${at}`] = { id: t.train, onDuty: at, crew: t.crew };
        }
        const key = trainKey(t.train, s.taken);
        const r = state.trains[key];
        if (!r) continue; // never on a line-up in the saved checks
        const at = resolve(t.onDuty, s.taken);
        if (r.onDuty === at) continue;
        r.events.push({ taken: s.taken, kind: r.onDuty ? 'onDutyChange' : 'onDuty', at, from: r.onDuty, station: t.station, crew: t.crew });
        r.onDuty = at;
        r.crew = t.crew;
        r.station = t.station;
      }
      // Conductors in the bunkhouse at the latest read, for "still held".
      if (wasRead(s, 'bunkhouse')) state.inBunkhouse = (s.bunkhouse || []).map((c) => c.co).filter(Boolean);
      // A Sarnia crew in the Mac bunkhouse: off duty = REST − 8 h. Their
      // train is the latest one they went on duty on before that.
      for (const c of s.bunkhouse || []) {
        if (!c.rested || !c.en || !c.co) continue;
        const offAt = fromMin(toMin(resolve(c.rested, s.taken)) - REST_MIN);
        const mine = Object.values(state.trains).filter((r) => !noOffDuty(r) && r.onDuty && !r.offDuty
          && crewHas(r.crew, c.en) && crewHas(r.crew, c.co) && r.onDuty < offAt && toMin(offAt) - toMin(r.onDuty) <= 24 * 60);
        const r = mine.sort((a, b) => (a.onDuty < b.onDuty ? 1 : -1))[0];
        if (!r) continue;
        r.offDuty = offAt;
        r.events.push({ taken: s.taken, kind: 'offDuty', at: offAt, crew: `${c.en} + ${c.co}` });
      }
      // Gone from the line-up without reaching the Call Board: note it once.
      for (const [key, r] of Object.entries(state.trains)) {
        if (seenNow.has(key) || r.onDuty || r.gone) continue;
        if (!wasRead(s, r.from === 'mac' ? 'macLineup' : 'lineup')) continue;
        if (r.events[r.events.length - 1].taken < s.taken) {
          r.gone = s.taken;
          // Crews available when it disappeared; the last sighting's if the
          // bunkhouse wasn't read this time.
          if (r.from === 'mac' && avail != null) r.avail = avail;
          r.events.push({ taken: s.taken, kind: 'gone' });
        }
      }
    }
    return state;
  }

  // Minutes late (+) or early (−); null when either end is unknown.
  const off = (from, to) => (from && to ? toMin(to) - toMin(from) : null);

  // The finished list, one row per train, newest first, each with the day it
  // belongs to: its on-duty date, or (not on duty yet) its latest order/plan.
  // Mac yard trains that left the line-up and never reached the Call Board
  // within FLAG_WAIT (owner, 2026-10-17): no rested crew in the bunkhouse →
  // a non-Sarnia crew took it; rested crews there → maybe that, or cancelled.
  const FLAG_WAIT = 30;
  // A deadhead (either line-up) that leaves it and never reaches the Call
  // Board is its own flag, counted on the Order summary (owner, 2026-10-25).
  function flagOf(r, lastTaken) {
    if (!r.gone || r.onDuty || off(r.gone, lastTaken) < FLAG_WAIT) return null;
    if (r.deadhead) return 'deadhead';
    if (r.from !== 'mac') return null;
    return r.avail === 0 ? 'nonSarnia' : 'possible';
  }

  // 14-hour rule (Article 18.6(b)): from off duty in Toronto to the
  // conductor's next on-duty time there (the trip home). No trip home yet and
  // the conductor still in the bunkhouse: held so far, as of the last check.
  const HELD_LIMIT = 14 * 60;
  const HOME_WITHIN = 72 * 60; // a trip home later than this isn't the same stay
  const turnOf = (crew, craft) => { const m = new RegExp(`(?:^|· )${craft} (\\S+)`).exec(crew || ''); return m ? m[1] : null; };
  function heldOf(r, state) {
    if (!r.offDuty || noOffDuty(r)) return {};
    const co = turnOf(r.crew, 'CO');
    if (!co) return {};
    const back = Object.values(state.toronto || {})
      .filter((t) => t.onDuty > r.offDuty && off(r.offDuty, t.onDuty) <= HOME_WITHIN && crewHas(t.crew, co))
      .sort((a, b) => (a.onDuty < b.onDuty ? -1 : 1))[0] || null;
    if (back) return { co, en: turnOf(r.crew, 'EN'), back, heldMin: off(r.offDuty, back.onDuty) };
    if ((state.inBunkhouse || []).includes(co) && off(r.offDuty, state.lastTaken) <= HOME_WITHIN) {
      return { co, en: turnOf(r.crew, 'EN'), back: null, heldMin: off(r.offDuty, state.lastTaken), stillHeld: true };
    }
    return { co, en: turnOf(r.crew, 'EN') };
  }

  // Predicted vs actual crew, once it's on duty: { co, en } each true/false
  // (null when that one wasn't predicted or isn't shown on the Call Board).
  const crewTurn = (crew, crafts) => { const m = new RegExp(`(?:^|· )(?:${crafts}) ([A-Z0-9]+)`).exec(crew || ''); return m ? m[1] : null; };
  function predHit(r) {
    if (!r.onDuty || !r.predicted || !r.crew) return null;
    const actual = { co: crewTurn(r.crew, 'CO'), en: crewTurn(r.crew, 'EN|LE') };
    const hit = (k) => (r.predicted[k] && actual[k] ? r.predicted[k] === actual[k] : null);
    // Right since: the first check of the last unbroken run of right predictions.
    const since = (k) => {
      if (!hit(k)) return null;
      const log = r.predLog || [];
      let i = log.length;
      while (i > 0 && log[i - 1][k] === actual[k]) i--;
      return i < log.length ? log[i].taken : r.predicted.taken;
    };
    const lead = (k) => (since(k) ? off(since(k), r.onDuty) : null);
    return { co: hit('co'), en: hit('en'), actual, coLead: lead('co'), enLead: lead('en') };
  }

  function summarize(state) {
    return Object.values(state.trains).map((r) => {
      const due = r.onDuty || r.order || r.plan;
      return { ...r, from: r.from || 'sarnia', day: due ? due.slice(0, 10) : r.firstSeen.slice(0, 10), offPlan: off(r.firstPlan, r.onDuty), offOrder: off(r.firstOrder, r.onDuty),
        leadMin: off(r.firstSeen, r.onDuty || r.order || r.plan), timeOnDuty: off(r.onDuty, r.offDuty), noOffDuty: noOffDuty(r), flag: flagOf(r, state.lastTaken),
        predHit: predHit(r),
        ...heldOf(r, state) };
    }).sort((a, b) => (toMin(b.onDuty || b.order || b.plan || b.firstSeen) - toMin(a.onDuty || a.order || a.plan || a.firstSeen)));
  }

  const api = { predHit, track, summarize, resolve, trainKey, toMin, off, FLAG_WAIT, HELD_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardTrains = api;
})(this);

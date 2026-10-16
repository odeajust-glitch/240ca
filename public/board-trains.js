// Daily order summary (owner, 2026-10-16): follows each Sarnia line-up train
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
  function track(snapshots, state = { trains: {} }) {
    for (const s of snapshots) {
      const seenNow = new Set();
      for (const t of s.lineup || []) {
        const key = trainKey(t.train, s.taken);
        seenNow.add(key);
        const at = resolve(t.order, s.taken);
        let r = state.trains[key];
        if (!r) {
          r = state.trains[key] = { id: t.train, month: key.slice(-7), firstSeen: s.taken, firstPlan: null, firstOrder: null,
            orderedSeen: null, plan: null, order: null, planChanges: 0, orderChanges: 0, onDuty: null, crew: '', deadhead: !!t.deadhead, events: [] };
          r.events.push({ taken: s.taken, kind: 'seen', at, status: t.status });
          if (t.status === 'PLN') r.firstPlan = r.plan = at;
        } else if (r.gone) {
          r.events.push({ taken: s.taken, kind: 'back', at, status: t.status });
          delete r.gone;
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
      // The Call Board: the actual on-duty time.
      for (const t of s.onDuty || []) {
        const key = trainKey(t.train, s.taken);
        const r = state.trains[key];
        if (!r) continue; // never on the Sarnia line-up in the saved checks
        const at = resolve(t.onDuty, s.taken);
        if (r.onDuty === at) continue;
        r.events.push({ taken: s.taken, kind: r.onDuty ? 'onDutyChange' : 'onDuty', at, from: r.onDuty, station: t.station, crew: t.crew });
        r.onDuty = at;
        r.crew = t.crew;
        r.station = t.station;
      }
      // Gone from the line-up without reaching the Call Board: note it once.
      for (const [key, r] of Object.entries(state.trains)) {
        if (seenNow.has(key) || r.onDuty || r.gone) continue;
        if (r.events[r.events.length - 1].taken < s.taken) {
          r.gone = s.taken;
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
  function summarize(state) {
    return Object.values(state.trains).map((r) => {
      const due = r.onDuty || r.order || r.plan;
      return { ...r, day: due ? due.slice(0, 10) : r.firstSeen.slice(0, 10), offPlan: off(r.firstPlan, r.onDuty), offOrder: off(r.firstOrder, r.onDuty),
        leadMin: off(r.firstSeen, r.onDuty || r.order || r.plan) };
    }).sort((a, b) => (toMin(b.onDuty || b.order || b.plan || b.firstSeen) - toMin(a.onDuty || a.order || a.plan || a.firstSeen)));
  }

  const api = { track, summarize, resolve, trainKey, toMin, off };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardTrains = api;
})(this);

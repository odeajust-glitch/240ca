// Where one turn (SR03, SA07, SD11…) shows up in a line-up snapshot, and how
// that changed over time. Shared by the page (window.BoardTurns) and the site
// builder (lib/board/site.js), so both read a snapshot the same way.
(function (root) {
  // Turn ids as they appear in "Chain Gang: SR04 (goes spare…) + SD11" etc.
  const turnIn = (text, turn) => new RegExp(`(^|[^A-Z0-9])${turn}([^A-Z0-9]|$)`).test(text || '');

  // Everything one snapshot says about a turn, in board order.
  function facts(s, turn) {
    turn = String(turn || '').trim().toUpperCase();
    const out = [];
    if (!turn) return out;
    for (const p of s.pools || []) {
      for (const t of p.turns) {
        if (t.turn === turn) out.push({ kind: 'pool', pool: p.name, pos: t.pos, status: t.status, text: `${shortPool(p.name)} position ${t.pos}: ${t.status}` });
      }
    }
    if ((s.away || []).includes(turn)) out.push({ kind: 'away', text: 'In Toronto (away from Sarnia)' });
    for (const r of s.returning || []) {
      if (r.split(' ')[0] === turn) out.push({ kind: 'returning', text: `Coming home on ${r.slice(turn.length).trim().replace(/^\(|\)$/g, '')}` });
    }
    for (const t of s.lineup || []) {
      if (turnIn(t.rules, turn)) out.push({ kind: 'lineup', train: t.train, order: t.order, text: `Projected for ${t.train} (${t.status} ${t.order}): ${t.rules}` });
    }
    for (const t of s.onDuty || []) {
      if (turnIn(t.crew, turn)) out.push({ kind: 'onDuty', train: t.train, text: `On duty on ${t.train} at ${title(t.station)}, ${t.onDuty}` });
    }
    // Yard jobs (owner, 2026-10-24), taken as 8 h: a crew on one, or the job itself.
    for (const j of s.yardJobs || []) {
      if (j.job !== turn && !turnIn(j.crew, turn)) continue;
      out.push({ kind: 'onDuty', train: j.job, text: `On duty on ${j.job} yard at ${title(j.station)}, ${j.onDuty || 'time not shown'}${j.off ? ` (off ~${j.off}, 8 h assumed)` : ''}${j.job === turn && j.crew ? `: ${j.crew}` : ''}` });
    }
    // On the vacancy list (option 5): the job goes spare.
    for (const v of s.vacancies || []) {
      if (v.turn !== turn) continue;
      out.push({ kind: 'spareJob', train: v.train, text: `Job ${v.train} (${v.pool} ${v.cc}, ${v.status === 'ORDERED' ? 'ordered' : 'planned'} ${v.at}) is on the vacancy list: goes spare${v.returns ? `, returns ${v.returns}` : ''}` });
    }
    // Toronto: in the Mac bunkhouse, and the train it's predicted to take home.
    for (const c of s.bunkhouse || []) {
      if (c.en !== turn && c.co !== turn) continue;
      const mate = c.en === turn ? c.co : c.en;
      out.push({ kind: 'bunkhouse', text: `In the Toronto bunkhouse, position ${c.pos}${mate ? ` (with ${mate})` : ''}${c.offDuty ? `, off duty ${c.offDuty}` : ''}, ${c.ready ? 'rested' : `rest until ${c.rested}`}` });
      const t = (s.macLineup || []).find((x) => x.crewPos === c.pos);
      out.push(t ? { kind: 'homeTrain', train: t.train, text: `Predicted home on ${t.train} (${t.status} ${t.order})` }
        : { kind: 'homeTrain', text: 'No train on the Toronto line-up for it yet' });
    }
    // On the way to Toronto (estimate, owner 2026-10-22) and the train home it's guessed for.
    for (const c of s.onTheWay || []) {
      if (c.en !== turn && c.co !== turn) continue;
      const t = (s.macLineup || []).find((x) => x.crewExpected && x.crew === c.crew);
      out.push({ kind: 'homeTrain', text: `On the way to Toronto on ${c.train}: in Toronto ~${c.offDuty}, rested ~${c.rested} (estimate)${t ? `; predicted home on ${t.train} (${t.status} ${t.order})` : '; no Toronto train for it yet'}` });
    }
    for (const t of s.sequence || []) {
      if (t.turn === turn) out.push({ kind: 'sequence', train: t.train, text: `Called on ${t.train} (order ${t.order}, ${t.actual && t.actual !== t.expected && t.actual !== 'MU' ? `should have been ${t.expected}` : 'matches the sequence'})` });
    }
    return out;
  }

  // One line for the history: what changed is what the reader looks for.
  function summary(s, turn) {
    const f = facts(s, turn);
    return f.length ? f.map((x) => x.text).join(' · ') : 'Not on any screen in this check';
  }

  // Every turn named anywhere in a snapshot, sorted (SA, SB, SD, SR…).
  function turnsIn(s) {
    const set = new Set();
    for (const p of s.pools || []) for (const t of p.turns) set.add(t.turn);
    for (const t of s.away || []) set.add(t);
    for (const r of s.returning || []) set.add(r.split(' ')[0]);
    for (const c of s.bunkhouse || []) { if (c.en) set.add(c.en); if (c.co) set.add(c.co); }
    for (const t of s.onDuty || []) for (const m of (t.crew || '').matchAll(/\b([A-Z][A-Z0-9]{1,4}\d{2})\b/g)) set.add(m[1]);
    // Yard jobs and their crews, and the jobs going spare (owner, 2026-10-24).
    for (const j of s.yardJobs || []) { set.add(j.job); for (const m of (j.crew || '').matchAll(/\b([A-Z][A-Z0-9]{1,4}\d{2})\b/g)) set.add(m[1]); }
    for (const v of s.vacancies || []) set.add(v.turn);
    return [...set].filter((t) => /^[A-Z][A-Z0-9]{1,4}\d{2}$/.test(t || '')).sort();
  }

  // "2026-10-15 0815" → minutes, to measure how long something lasted.
  const minOf = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(t || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null; };
  // A change that lasted less than this before the next one is left out of
  // the history (owner, 2026-10-17), unless it's an order, rest or spare.
  const KEEP_MIN = 30;

  // Each turn's history across snapshots (oldest first), carried across days
  // through `into` by the builder:
  //   changes: what the board said, each time it changed
  //   orders:  trains it was projected for, called on, went on duty on
  //   rests:   each rest (or hold) period, with when it was first seen
  //   spares:  each time it went spare (**, B0, or its train going spare)
  function history(snapshots, into = {}) {
    const last = into.__last || (into.__last = {});
    const rec = (turn) => into[turn] || (into[turn] = { changes: [], orders: [], rests: [], spares: [] });
    for (const s of snapshots) {
      const seen = new Set(turnsIn(s));
      for (const turn of new Set([...seen, ...Object.keys(last)])) {
        const f = seen.has(turn) ? facts(s, turn) : [];
        const text = f.length ? f.map((x) => x.text).join(' · ') : 'Not on any screen in this check';
        if (!seen.has(turn) && last[turn] === undefined) continue;
        const r = rec(turn);
        if (last[turn] !== text) {
          r.changes.push({ taken: s.taken, text, key: f.some((x) => x.kind === 'onDuty' || x.kind === 'sequence' || x.kind === 'spareJob' || /goes spare|rest until|hold turn/.test(x.text)) });
          last[turn] = text;
        }
        for (const x of f) {
          if (x.kind === 'lineup' || x.kind === 'homeTrain' && x.train || x.kind === 'onDuty' || x.kind === 'sequence') {
            let o = r.orders.find((y) => y.train === x.train);
            if (!o) r.orders.push(o = { train: x.train, first: s.taken });
            o.last = s.taken;
            if (x.kind === 'lineup') o.projected = x.text.replace(/^Projected for \S+ \S+ /, '');
            if (x.kind === 'homeTrain') o.projected = x.text.replace(/^Predicted home on \S+ \S+ /, 'home from Toronto ');
            if (x.kind === 'onDuty' && !o.onDuty) { o.onDuty = x.text.replace(/^On duty on \S+ \S+ /, ''); o.onDutySeen = s.taken; }
            if (x.kind === 'sequence') o.called = x.text.replace(/^Called on \S+ \S+ /, '');
          }
          const rest = /(rest until|hold turn until) (\S+ \d{4})/.exec(x.text);
          if (rest) {
            const kind = rest[1] === 'rest until' ? 'Rest' : 'Hold turn';
            if (!r.rests.some((y) => y.until === rest[2] && y.kind === kind)) r.rests.push({ kind, until: rest[2], seen: s.taken, where: x.kind === 'bunkhouse' ? 'Toronto bunkhouse' : (x.pool || '').replace(/ ·.*/, '') });
          }
          const spare = x.kind === 'pool' && /goes spare|B0/.test(x.status) ? x.status
            : x.kind === 'lineup' && /goes spare/.test(x.text) ? `its train ${x.train} goes spare to the spareboard`
              : x.kind === 'spareJob' ? `job ${x.train} on the vacancy list` : null;
          if (spare) {
            // Still going on from the last check: stretch it, don't repeat it.
            const prev = r.spares.find((y) => y.text === spare && (y.last === r.lastTaken || y.last === s.taken));
            if (prev) prev.last = s.taken;
            else r.spares.push({ text: spare, seen: s.taken, last: s.taken });
          }
        }
        r.lastTaken = s.taken;
      }
    }
    return into;
  }

  // The finished history for the page: short-lived changes (under KEEP_MIN
  // before the next) dropped unless they're key; working fields removed.
  function finish(into) {
    const out = {};
    for (const [turn, r] of Object.entries(into)) {
      if (turn === '__last') continue;
      const changes = r.changes.filter((c, i) => {
        const next = r.changes[i + 1];
        return !next || c.key || minOf(next.taken) - minOf(c.taken) >= KEEP_MIN;
      }).map(({ taken, text }) => ({ taken, text }));
      out[turn] = { changes, orders: r.orders, rests: r.rests, spares: r.spares };
    }
    return out;
  }

  function shortPool(name) {
    return name.replace(' · conductors', '').replace(' · engineers', '');
  }
  function title(s) {
    return s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
  }

  const api = { facts, summary, turnsIn, history, finish, turnIn, KEEP_MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardTurns = api;
})(this);

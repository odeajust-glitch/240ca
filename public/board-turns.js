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
    // Toronto: in the Mac bunkhouse, and the train it's predicted to take home.
    for (const c of s.bunkhouse || []) {
      if (c.en !== turn && c.co !== turn) continue;
      const mate = c.en === turn ? c.co : c.en;
      out.push({ kind: 'bunkhouse', text: `In the Toronto bunkhouse, position ${c.pos}${mate ? ` (with ${mate})` : ''}${c.offDuty ? `, off duty ${c.offDuty}` : ''}, ${c.ready ? 'rested' : `rest until ${c.rested}`}` });
      const t = (s.macLineup || []).find((x) => x.crewPos === c.pos);
      out.push(t ? { kind: 'homeTrain', train: t.train, text: `Predicted home on ${t.train} (${t.status} ${t.order})` }
        : { kind: 'homeTrain', text: 'No train on the Toronto line-up for it yet' });
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
    for (const t of s.onDuty || []) for (const m of (t.crew || '').matchAll(/\b([A-Z]{1,2}\d{2,3})\b/g)) set.add(m[1]);
    return [...set].filter((t) => /^[A-Z]{1,2}\d{2,3}$/.test(t)).sort();
  }

  // History of every turn across snapshots (oldest first): an entry each time
  // what the board says about the turn changes. `into` lets the builder carry
  // it across days.
  function history(snapshots, into = {}) {
    const last = into.__last || (into.__last = {});
    for (const s of snapshots) {
      const seen = new Set(turnsIn(s));
      for (const turn of new Set([...seen, ...Object.keys(last)])) {
        const text = seen.has(turn) ? summary(s, turn) : 'Not on any screen in this check';
        if (last[turn] === text) continue;
        if (!seen.has(turn) && last[turn] === undefined) continue;
        (into[turn] || (into[turn] = [])).push({ taken: s.taken, text });
        last[turn] = text;
      }
    }
    return into;
  }

  function shortPool(name) {
    return name.replace(' · conductors', '').replace(' · engineers', '');
  }
  function title(s) {
    return s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
  }

  const api = { facts, summary, turnsIn, history, turnIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardTurns = api;
})(this);

// What the owner sees after each check (2026-10-15): when they go, the
// Chain Gang board, the line-up with who's projected on each train, and what
// changed since the previous check.
const { fmt } = require('./time');

const pad = (s, n) => String(s).padEnd(n);

// One Chain Gang turn's status in plain words. Times already past are left
// out (an expired ** or rest no longer matters).
function gangStatus(t, now) {
  const live = (m) => m != null && m > now;
  const bits = [];
  if (t.working) bits.push(`out working${t.workingOn ? ` on ${t.workingOn}` : ''}`);
  else if (t.st === 'B0') bits.push('B0: working another job, goes spare if called');
  if (t.rn === 'HT') bits.push(live(t.statusUntil) ? `hold turn until ${fmt(t.statusUntil)}` : 'hold turn');
  else if (t.st === '**' || t.rn === '**') {
    // RETN: when they're due back. Still ** after it = still goes spare.
    bits.push(`** goes spare${t.statusUntil != null ? `, return ${fmt(t.statusUntil)}` : ''}`);
  }
  if (live(t.restUntil)) bits.push(`rest until ${fmt(t.restUntil)}`);
  return bits.join('; ') || 'available';
}

function goesTo(p) {
  const spare = p.spare ? ' (goes spare → spareboard)' : '';
  if (p.pool === 'S5') return 'S5 (L502/L501, not ours)';
  if (p.pool === 'A' || p.pool === 'B') return `${p.pool} pool${p.turn ? `: ${p.turn}${spare}` : ''}`;
  const eng = p.engineer ? ` + ${p.engineer}${p.engineerSpare ? ' (goes spare)' : ''}` : '';
  return p.turn ? `Chain Gang: ${p.turn}${spare}${eng}` : `spareboard (no Chain Gang turn free)${eng}`;
}

function chainGangLines(result, me) {
  const g = result.chainGang;
  if (!g || !g.home.length) return [];
  const out = ['', 'CHAIN GANG BOARD (Sarnia, conductors)'];
  for (const t of g.home) {
    const you = t.turn === me ? '   ← YOU' : '';
    out.push(`  ${pad(String(t.pos).padStart(3, '0'), 4)} ${pad(t.turn, 5)} ${gangStatus(t, result.now)}${you}`);
  }
  if (g.returning.length) out.push(`  Coming home: ${g.returning.map((r) => `${r.turn} (${r.train})`).join(', ')}`);
  if (g.away.length) out.push(`  In Toronto: ${g.away.map((t) => t.turn).join(', ')}`);
  if (g.sd && g.sd.length) {
    out.push('', 'SD BOARD (Sarnia, engineers, option 27)');
    for (const t of g.sd) out.push(`  ${pad(String(t.pos).padStart(3, '0'), 4)} ${pad(t.turn, 5)} ${gangStatus(t, result.now)}`);
  }
  return out;
}

function lineupLines(result, me) {
  if (!result.predictions.length) return [];
  const out = ['', "TRAIN LINE-UP (41) and who's projected to work each"];
  for (const p of result.predictions) {
    const train = `${p.symbol} ${p.originDay}${p.deadhead ? ' DH' : ''}`;
    // Call time without its day unless it falls on the day before.
    const call = fmt(p.call).split(' ')[0] === fmt(p.order).split(' ')[0] ? fmt(p.call).split(' ')[1] : fmt(p.call);
    const you = p.turn && p.turn === me ? '   ← YOU' : '';
    out.push(`  ${pad(fmt(p.order), 10)} ${p.status}  ${pad(train, 13)} call ~${call}  ${goesTo(p)}${you}`);
  }
  return out;
}

// What's worth comparing from one check to the next.
function snapshot(result, meLines) {
  const now = result.now;
  return {
    asOf: now,
    me: meLines,
    gang: [...((result.chainGang && result.chainGang.home) || []), ...((result.chainGang && result.chainGang.sd) || [])]
      .map((t) => ({ turn: t.turn, pos: t.pos, status: gangStatus(t, now) })),
    trains: result.predictions.map((p) => ({ train: `${p.symbol} ${p.originDay}`, order: p.order, status: p.status, goesTo: goesTo(p) })),
  };
}

function changeLines(prev, cur) {
  if (!prev) return ['', 'CHANGES: none to show (this is the first check saved).'];
  const out = [];
  if (prev.me.join('\n') !== cur.me.join('\n')) {
    out.push('  Your answer changed. It was:', ...prev.me.map((l) => `      ${l.trim()}`));
  }
  const before = new Map(prev.trains.map((t) => [t.train, t]));
  const after = new Map(cur.trains.map((t) => [t.train, t]));
  for (const t of cur.trains) {
    const o = before.get(t.train);
    if (!o) { out.push(`  + ${t.train} new on the line-up (${t.status} ${fmt(t.order)}) → ${t.goesTo}`); continue; }
    if (o.order !== t.order) out.push(`  ~ ${t.train} time ${fmt(o.order)} → ${fmt(t.order)}`);
    if (o.status !== t.status) out.push(`  ~ ${t.train} ${o.status} → ${t.status}`);
    if (o.goesTo !== t.goesTo) out.push(`  ~ ${t.train} crew ${o.goesTo} → ${t.goesTo}`);
  }
  for (const o of prev.trains) {
    if (!after.has(o.train)) out.push(`  - ${o.train} off the line-up (on duty, gone, or cancelled)`);
  }
  const gBefore = new Map(prev.gang.map((t) => [t.turn, t]));
  const gAfter = new Map(cur.gang.map((t) => [t.turn, t]));
  for (const t of cur.gang) {
    const o = gBefore.get(t.turn);
    if (!o) { out.push(`  + ${t.turn} now on the Sarnia board at ${String(t.pos).padStart(3, '0')}`); continue; }
    if (o.pos !== t.pos) out.push(`  ~ ${t.turn} position ${String(o.pos).padStart(3, '0')} → ${String(t.pos).padStart(3, '0')}`);
    if (o.status !== t.status) out.push(`  ~ ${t.turn} ${o.status} → ${t.status}`);
  }
  for (const o of prev.gang) {
    if (!gAfter.has(o.turn)) out.push(`  - ${o.turn} off the Sarnia board`);
  }
  const head = `CHANGES since the last check (${fmt(prev.asOf)})`;
  return ['', out.length ? `${head}:` : `${head}: none.`, ...out];
}

module.exports = { gangStatus, goesTo, chainGangLines, lineupLines, snapshot, changeLines };

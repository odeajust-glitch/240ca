// Plain-text report in the owner's terms: 24 h times, "14th 2330", turn ids.
const { fmt } = require('./time');

// "When do I go to work?", in plain words, first thing in the report.
function describeMe(m) {
  const head = `WHEN YOU GO (${m.turn}):`;
  if (m.notFound) return [`${head} not in the Sarnia Chain Gang line or coming home. Working, away, or off?`];
  if (m.train) {
    const est = m.status === 'ORD' ? 'ordered' : 'planned, so times are estimates';
    return [
      `${head} ${m.train}${m.deadhead ? ' (deadhead)' : ''}: called ~${fmt(m.call)}, on duty ${fmt(m.onDuty)} (${est}).`,
    ];
  }
  const firm = m.ahead.filter((a) => !a.until);
  const later = m.ahead.filter((a) => a.until);
  const n = firm.length + 1;
  const ord = (k) => `${k}${({ 1: 'st', 2: 'nd', 3: 'rd' })[k] || 'th'}`;
  const lines = [];
  const end = m.lineupEnd != null ? ` (the line-up only runs to ${fmt(m.lineupEnd)})` : '';
  const aheadNote = firm.length
    ? ` Ahead of you: ${firm.map((a) => a.turn + (a.spare ? ' (goes spare)' : '') + (a.returning ? ' (coming home)' : '')).join(', ')}.`
    : '';
  lines.push(`${head} not on the line-up yet${end}.${aheadNote}`);
  if (!later.length) {
    lines.push(`  You get the ${ord(n)} Chain Gang train or deadhead after that.`);
  } else {
    // Each turn on rest/hold rejoins ahead of you once its time is up.
    const steps = [...later].sort((x, y) => x.until - y.until);
    lines.push(`  You get the ${ord(n)} Chain Gang train or deadhead after that if it's called before ${fmt(steps[0].until)} (${steps[0].turn} on ${steps[0].why}).`);
    steps.forEach((st, i) => {
      const upTo = steps[i + 1] ? ` and before ${fmt(steps[i + 1].until)}` : '';
      lines.push(`  Called after ${fmt(st.until)}${upTo}: the ${ord(n + i + 1)} one (${st.turn} back in line ahead of you).`);
    });
  }
  if (m.myRestUntil) lines.push(`  Your own rest is up at ${fmt(m.myRestUntil)}; you can't be called before then.`);
  return lines;
}

function formatReport(result, seen = {}) {
  const out = [];
  out.push(`Board check as of ${fmt(result.now)}`);
  if (seen.callBoardPages === 0) out.push('  (no Call Board pages in this run)');
  if (seen.chainGang === false) out.push('  (no Chain Gang screen in this run: turn predictions need screen 23)');
  if (seen.lineup === false) out.push('  (no Train Line-up in this run: predictions need screen 41)');
  if (seen.aPool === false || seen.bPool === false) out.push('  (add screens 19 (A) and 21 (B) with CO to see which A/B turn gets each train)');

  if (result.me) {
    out.push('', ...describeMe(result.me));
  }

  if (result.flags.length) {
    out.push('', 'POSSIBLE PROBLEMS (for you to judge):');
    for (const f of result.flags) out.push(`  ! ${f.text}`);
  } else {
    out.push('', 'No problems found.');
  }

  if (result.today.length) {
    out.push('', 'Already on duty out of Sarnia (order time = on duty + prep):');
    for (const t of result.today) {
      const ok = !t.actual || t.actual === t.expected || t.actual === 'MU' ? '' : '  ← mismatch';
      out.push(`  ${fmt(t.order)}  ${t.symbol} ${t.originDay}  ${t.turn || '-'}  (sequence says ${t.expected})${ok}`);
    }
  }

  if (result.predictions.length) {
    out.push('', 'Coming up (Train Line-up):');
    for (const p of result.predictions) {
      const turnTxt = p.turn ? `${p.turn}${p.spare ? ' (spare)' : ''}` : null;
      const who = p.pool === 'SR' ? (turnTxt || 'spareboard') : p.pool === 'A' || p.pool === 'B' ? `${p.pool}${turnTxt ? `: ${turnTxt}` : ''}` : p.pool;
      const cats = p.catsPool ? `  [CATS: ${p.catsPool}]` : '';
      out.push(`  ${fmt(p.order)}  ${p.status}  ${p.symbol} ${p.originDay}  →  ${who}${cats}`);
      out.push(`      ${p.reason}`);
    }
  }

  if (result.notes.length) {
    out.push('', 'Notes:');
    for (const n of result.notes) out.push(`  - ${n}`);
  }
  return out.join('\n');
}

module.exports = { formatReport };

// Plain-text report in the owner's terms: 24 h times, "14th 2330", turn ids.
const { fmt } = require('./time');

function formatReport(result, seen = {}) {
  const out = [];
  out.push(`Board check as of ${fmt(result.now)}`);
  if (seen.callBoardPages === 0) out.push('  (no Call Board pages in this run)');
  if (seen.chainGang === false) out.push('  (no Chain Gang screen in this run: turn predictions need screen 23)');
  if (seen.lineup === false) out.push('  (no Train Line-up in this run: predictions need screen 41)');

  if (result.me) {
    out.push('');
    const m = result.me;
    if (m.train) out.push(`YOU (${m.turn}): predicted on ${m.train}, ordered ${fmt(m.order)} (${m.status === 'ORD' ? 'ordered' : 'planned, estimate'}).`);
    else if (m.notFound) out.push(`YOU (${m.turn}): not in the Sarnia Chain Gang line or coming home. Working, away, or off?`);
    else out.push(`YOU (${m.turn}): not reached within the line-up. Ahead of you after it: ${m.aheadAfterLineup.join(', ') || 'nobody'}.`);
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
      const who = p.pool === 'SR' ? (p.turn ? `${p.turn}${p.spare ? ' (spare)' : ''}` : 'spareboard') : p.pool;
      out.push(`  ${fmt(p.order)}  ${p.status}  ${p.symbol} ${p.originDay}  →  ${who}`);
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

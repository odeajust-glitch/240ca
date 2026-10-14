// Turns the probe's masked `screenGrid` lines ("top | left:text | left:text")
// back into rows of positioned cells. Splitting only on " | " followed by a
// position keeps a literal "|" inside screen text intact.
function parseGrid(lines) {
  return lines.map((line) => {
    const [top, ...rest] = line.split(/ \| (?=\d+:)/);
    const cells = rest.map((c) => {
      const i = c.indexOf(':');
      return { left: Number(c.slice(0, i)), text: c.slice(i + 1).trim() };
    });
    return { top: Number(top), cells, text: cells.map((c) => c.text).join(' ') };
  });
}

// Screen text as one string, for recognising which screen this is.
function gridText(rows) {
  return rows.map((r) => r.text).join('\n');
}

module.exports = { parseGrid, gridText };

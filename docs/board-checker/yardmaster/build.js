// Builds the Yardmaster Call Order page from its template (owner, 2026-11-13).
//   node docs/board-checker/yardmaster/build.js site
//       -> public/ym.html: the board's test-site page. No names in it: it fetches
//          data/ym-list.json (published by the laptop, names locked like the crew names)
//          and loads board-ym.js (the logic) and board-names.js (the unlocking).
//   node docs/board-checker/yardmaster/build.js artifact <people.json> <out.html>
//       -> the owner's Claude page, the list with names embedded. NEVER commit its output
//          or people.json: this repository is public.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const TEMPLATE = path.join(__dirname, 'call-order-page.template.html');
const LOGIC = path.join(ROOT, 'public', 'board-ym.js');
const SITE_OUT = path.join(ROOT, 'public', 'ym.html');

function site(template = fs.readFileSync(TEMPLATE, 'utf8')) {
  let t = template
    .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n/, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n/, '') // no outside fonts on the board
    .replace('/*__PEOPLE__*/', 'null')
    .replace('/*__CONFIG__*/', '{"mode":"site"}')
    .replace('<script>/*__LOGIC__*/</script>', '<script src="board-names.js"></script>\n<script src="board-ym.js"></script>');
  const cut = t.indexOf('</style>') + '</style>'.length;
  const head = t.slice(0, cut);
  const body = t.slice(cut).replace(/^\n+/, '');
  return '<!doctype html>\n<!-- Built by docs/board-checker/yardmaster/build.js from call-order-page.template.html: edit those, not this file. -->\n'
    + '<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="robots" content="noindex, nofollow">\n'
    + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    + `${head}\n</head>\n<body>\n${body}</body>\n</html>\n`;
}

function artifact(people, template = fs.readFileSync(TEMPLATE, 'utf8'), logic = fs.readFileSync(LOGIC, 'utf8')) {
  const data = JSON.stringify(people);
  if (/<\/script/i.test(data + logic)) throw new Error('a closing script tag inside the data or the logic');
  return template.replace('/*__PEOPLE__*/', () => data).replace('/*__CONFIG__*/', '{"mode":"artifact"}').replace('/*__LOGIC__*/', () => logic);
}

module.exports = { site, artifact, SITE_OUT };

if (require.main === module) {
  const [what, from, to] = process.argv.slice(2);
  if (what === 'site') { fs.writeFileSync(SITE_OUT, site()); console.log(`wrote ${path.relative(ROOT, SITE_OUT)}`); }
  else if (what === 'artifact' && from && to) { fs.writeFileSync(to, artifact(JSON.parse(fs.readFileSync(from, 'utf8')))); console.log(`wrote ${to}`); }
  else { console.log('node docs/board-checker/yardmaster/build.js site | artifact <people.json> <out.html>'); process.exitCode = 1; }
}

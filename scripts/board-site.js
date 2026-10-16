// Builds the line-up snapshot website from the saved board checks and,
// with --deploy, publishes it to Netlify. board-auto.js does this by itself
// when NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are in .env; run this to
// publish by hand or to test the settings.
//
//   node scripts/board-site.js            build into BoardChecker\site
//   node scripts/board-site.js --deploy   build and publish
//
// Reads history\ in the data folder (or --history DIR); never touches CATS.
const { DATA_DIR, HISTORY_DIR } = require('../lib/board/paths');
const path = require('path');
const { buildSite, deploySite, siteSettings } = require('../lib/board/site');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const outDir = arg('--out') || path.join(DATA_DIR, 'site');
  const { token, siteId, days } = siteSettings();
  const built = buildSite({ historyDir: arg('--history') || HISTORY_DIR, outDir, days });
  console.log(`Built ${built.snapshots} snapshots over ${built.days} days in ${outDir}${built.latest ? ` (latest ${built.latest})` : ''}.`);
  for (const s of built.skipped) console.log(`  Skipped ${s}`);
  if (!process.argv.includes('--deploy')) return;

  if (!token || !siteId) {
    console.error('To publish, put NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID in BoardChecker\\.env.');
    process.exit(1);
  }
  const sent = await deploySite({ dir: outDir, siteId, token });
  if (!sent.ok) {
    console.error(`Not published: ${sent.message}`);
    process.exit(1);
  }
  console.log(`Published (${sent.uploaded} files uploaded)${sent.url ? `: ${sent.url}` : ''}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

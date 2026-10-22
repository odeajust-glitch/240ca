// Builds the line-up snapshot website from the saved board checks and,
// with --deploy, publishes it (Cloudflare R2 when the R2_ settings are in
// .env, else Netlify). board-auto.js does this by itself; run this to
// publish by hand or to test the settings.
//
//   node scripts/board-site.js            build into BoardChecker\site
//   node scripts/board-site.js --deploy   build and publish
//
// Reads history\ in the data folder (or --history DIR); never touches CATS.
const { DATA_DIR, HISTORY_DIR, NAMES_FILE } = require('../lib/board/paths');
const path = require('path');
const { buildSite, publishSiteDir, siteSettings } = require('../lib/board/site');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const outDir = arg('--out') || path.join(DATA_DIR, 'site');
  const settings = siteSettings();
  const { days } = settings;
  const built = buildSite({ historyDir: arg('--history') || HISTORY_DIR, outDir, days, names: { file: NAMES_FILE, key: settings.namesKey } });
  console.log(`Built ${built.snapshots} snapshots over ${built.days} days in ${outDir}${built.latest ? ` (latest ${built.latest})` : ''}.`);
  for (const s of built.skipped) console.log(`  Skipped ${s}`);
  if (!process.argv.includes('--deploy')) return;

  if (settings.r2Missing.length) {
    console.error(`Cloudflare settings incomplete in BoardChecker\\.env: ${settings.r2Missing.join(', ')} missing or empty. Not published.`);
    process.exit(1);
  }
  const sent = await publishSiteDir(outDir, settings);
  if (!sent) {
    console.error('To publish, put R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (Cloudflare) in BoardChecker\\.env.');
    process.exit(1);
  }
  if (!sent.ok) {
    console.error(`Not published (${sent.where}): ${sent.message}`);
    process.exit(1);
  }
  console.log(`Published to ${sent.where} (${sent.uploaded} files uploaded${sent.removed ? `, ${sent.removed} removed` : ''})${sent.url ? `: ${sent.url}` : ''}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

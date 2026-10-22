// Sarnia road rules as taught by the owner (docs/board-checker/BOARD-CHECK.md).
// Turn counts only change by a union-meeting vote, so they live here rather
// than being scattered through the engine.
module.exports = {
  aTurnsPerDay: 3,
  bTurnsPerDay: 2,
  // The road day starts with trains ordered after 0459.
  dayStartMinutes: 5 * 60,
  // On duty = order time - prep. Deadheads have no prep.
  prepMinutes: { train: 15, deadhead: 0 },
  // Crews are called 2 h before going on duty; nobody can be called on rest.
  callLeadMinutes: 120,
  // L502 out of Sarnia / L501 back is crewed by S5 and never counts.
  excludedTrainPrefixes: ['L502', 'L501'],
  homeStation: 'SARNIA',
  // `**` = the turn goes spare for as long as CATS shows it (owner,
  // 2026-10-15, superseding "until"): the time beside it is the RETN column,
  // when they're due back, and doesn't end the `**`. No day shown = today.
  starsHaveExpiry: false,
  // Train Service options for the engineer boards that go with A (S1) and
  // B (S3) trains (owner, 2026-10-16). SD is 27.
  poolOptions: { S1: 25, S3: 26 },
  // The snapshot website (Cloudflare, owner 2026-10-22). Turn alerts name it
  // to the push services as their sender; BOARD_SITE_URL overrides.
  siteUrl: 'https://board.sarniaboard.workers.dev',
};

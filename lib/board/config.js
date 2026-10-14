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
  // Open question: is the time beside `**` an "until" time? Until the owner
  // says so, a `**` mark makes the turn go spare whatever the time.
  starsHaveExpiry: false,
};

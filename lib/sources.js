const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// `crafts` drives the "Conductor"/"Engineer" quick-select buttons in the
// frontend — sources tagged with both apply regardless of craft (general
// operating rules, case law, etc).
//
// `manualOnly` sources are never searched by default and are skipped by the
// All / craft buttons — the user has to tick them. `conflictsWith` lists
// sources that can't be searched alongside this one (enforced both ways, in
// the UI and in /api/ask).
const SOURCES = [
  {
    id: 'conductors',
    name: 'Conductors Agreement 4.16 (Revised July 2020)',
    filePath: path.join(DATA_DIR, 'conductors.pdf'),
    crafts: ['conductor'],
  },
  {
    id: 'conductors_addendum',
    name: 'Conductors Agreement 4.16 — Addenda',
    filePath: path.join(DATA_DIR, 'conductors_addendum.pdf'),
    crafts: ['conductor'],
  },
  {
    // Western Canada (Prairie & Mountain Regions) — not a Division 240
    // agreement, so it's opt-in and can't be mixed with 4.16.
    id: 'agreement_4_3',
    name: 'Conductors Agreement 4.3 — Prairie & Mountain Regions (Revised July 2020)',
    filePath: path.join(DATA_DIR, 'agreement_4_3.pdf'),
    crafts: [],
    manualOnly: true,
    conflictsWith: ['conductors', 'conductors_addendum'],
  },
  {
    id: 'engineers',
    name: 'Engineers Agreement 1.1 (2018)',
    filePath: path.join(DATA_DIR, 'engineers.pdf'),
    crafts: ['engineer'],
  },
  {
    // Western Canada LE agreement — not Division 240, so opt-in and can't
    // be mixed with 1.1.
    id: 'agreement_1_2',
    name: 'Engineers Agreement 1.2 — Prairie & Mountain Regions (Revised November 2018)',
    filePath: path.join(DATA_DIR, 'agreement_1_2.pdf'),
    crafts: [],
    manualOnly: true,
    conflictsWith: ['engineers'],
  },
  {
    id: 'mileage_guidelines',
    name: 'Engineer Mileage Committee Operating Guidelines (2010)',
    filePath: path.join(DATA_DIR, 'mileage_guidelines.txt'),
    crafts: ['engineer'],
  },
  {
    id: 'rest_rules',
    name: 'Duty & Rest Period Rules (Transport Canada)',
    filePath: path.join(DATA_DIR, 'rest_rules.pdf'),
    crafts: ['conductor', 'engineer'],
  },
  {
    id: 'crew_calling',
    name: 'Crew Calling Manual — TCRC Sarnia, Locomotive Engineers (July 2012)',
    filePath: path.join(DATA_DIR, 'crew_calling_manual.pdf'),
    crafts: ['engineer'],
  },
  {
    id: 'crew_calling_cty',
    name: 'Crew Calling Procedures — TCRC-CTY Sarnia (Conductors/Trainmen/Yardhelpers)',
    filePath: path.join(DATA_DIR, 'crew_calling_cty.pdf'),
    crafts: ['conductor'],
  },
  {
    id: 'cror',
    name: 'Canadian Rail Operating Rules (CROR) — CN (Oct 2021)',
    filePath: path.join(DATA_DIR, 'cror.pdf'),
    crafts: ['conductor', 'engineer'],
  },
  {
    id: 'dangerous_goods',
    name: 'Transportation of Dangerous Goods — CN (May 2023)',
    filePath: path.join(DATA_DIR, 'dangerous_goods.pdf'),
    crafts: ['conductor', 'engineer'],
  },
  {
    id: 'goi',
    name: 'General Operating Instructions (GOI) — CN (May 2023)',
    filePath: path.join(DATA_DIR, 'goi.pdf'),
    crafts: ['conductor', 'engineer'],
  },
  {
    id: 'disciplinary_grid',
    name: 'Discipline Policy Summary Grid — CN (Aug 2025)',
    filePath: path.join(DATA_DIR, 'disciplinary_grid.pdf'),
    crafts: ['conductor', 'engineer'],
  },
  {
    id: 'le_operating_manual',
    name: 'Locomotive Engineer Operating Manual 8960 — CN (May 2024)',
    filePath: path.join(DATA_DIR, 'le_operating_manual.pdf'),
    crafts: ['engineer'],
  },
  {
    id: 'croa',
    name: 'CROA Arbitration Awards (1997–2025)',
    dynamic: true, // indexed as a batch of case PDFs, not a single file — see server.js
    crafts: ['conductor', 'engineer'],
  },
];

const SOURCE_NAMES = Object.fromEntries(SOURCES.map((s) => [s.id, s.name]));
const ALL_SOURCE_IDS = SOURCES.map((s) => s.id);
const DEFAULT_SOURCE_IDS = SOURCES.filter((s) => !s.manualOnly).map((s) => s.id);

// Returns [a, b] for the first pair of selected ids that conflict, or null.
function findConflict(ids) {
  for (const s of SOURCES) {
    if (!ids.includes(s.id)) continue;
    const other = (s.conflictsWith || []).find((id) => ids.includes(id));
    if (other) return [s.id, other];
  }
  return null;
}

module.exports = { SOURCES, SOURCE_NAMES, ALL_SOURCE_IDS, DEFAULT_SOURCE_IDS, findConflict };

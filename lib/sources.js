const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const SOURCES = [
  {
    id: 'conductors',
    name: 'Conductors Agreement',
    filePath: path.join(DATA_DIR, 'conductors.pdf'),
  },
  {
    id: 'conductors_addendum',
    name: 'Conductors Agreement Addenda',
    filePath: path.join(DATA_DIR, 'conductors_addendum.pdf'),
  },
  {
    id: 'engineers',
    name: 'Engineers Agreement',
    filePath: path.join(DATA_DIR, 'engineers.pdf'),
  },
  {
    id: 'mileage_guidelines',
    name: 'Engineer Mileage Committee Operating Guidelines',
    filePath: path.join(DATA_DIR, 'mileage_guidelines.txt'),
  },
  {
    id: 'rest_rules',
    name: 'Duty & Rest Period Rules (Transport Canada)',
    filePath: path.join(DATA_DIR, 'rest_rules.pdf'),
  },
  {
    id: 'crew_calling',
    name: 'Crew Calling Manual (TCRC Sarnia)',
    filePath: path.join(DATA_DIR, 'crew_calling_manual.pdf'),
  },
  {
    id: 'croa',
    name: 'CROA Arbitration Awards (last 5 years)',
    dynamic: true, // indexed as a batch of case PDFs, not a single file — see server.js
  },
];

const SOURCE_NAMES = Object.fromEntries(SOURCES.map((s) => [s.id, s.name]));
const ALL_SOURCE_IDS = SOURCES.map((s) => s.id);

module.exports = { SOURCES, SOURCE_NAMES, ALL_SOURCE_IDS };

const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const PAGE_BREAK = /-- (\d+) of \d+ --/g;
const CHUNK_SIZE = 1100;
const CHUNK_OVERLAP = 150;

function splitIntoPages(text) {
  const pages = [];
  let lastIndex = 0;
  let lastPageNum = 1;
  let m;
  PAGE_BREAK.lastIndex = 0;
  while ((m = PAGE_BREAK.exec(text)) !== null) {
    const segment = text.slice(lastIndex, m.index);
    pages.push({ page: lastPageNum, text: segment });
    lastPageNum = parseInt(m[1], 10) + 1;
    lastIndex = PAGE_BREAK.lastIndex;
  }
  pages.push({ page: lastPageNum, text: text.slice(lastIndex) });
  return pages;
}

function chunkPageText(pageText) {
  const clean = pageText.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function indexPdf(filePath, sourceLabel) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  const pages = splitIntoPages(result.text);

  const chunks = [];
  for (const { page, text } of pages) {
    for (const chunkText of chunkPageText(text)) {
      if (chunkText.length < 20) continue;
      chunks.push({
        id: `${sourceLabel}-p${page}-${chunks.length}`,
        source: sourceLabel,
        page,
        text: chunkText,
      });
    }
  }
  return chunks;
}

function indexText(filePath, sourceLabel) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const chunks = [];
  for (const chunkText of chunkPageText(text)) {
    if (chunkText.length < 20) continue;
    chunks.push({
      id: `${sourceLabel}-p1-${chunks.length}`,
      source: sourceLabel,
      page: 1,
      text: chunkText,
    });
  }
  return chunks;
}

async function buildIndex(sources) {
  let all = [];
  for (const { filePath, label } of sources) {
    const chunks = filePath.toLowerCase().endsWith('.txt')
      ? indexText(filePath, label)
      : await indexPdf(filePath, label);
    all = all.concat(chunks);
  }
  return all;
}

// Indexes a batch of standalone case PDFs (e.g. CROA awards) under one
// shared source id, tagging each chunk with its own case label instead
// of a numeric page (each file is a self-contained decision, not a page
// range within one larger document).
async function indexCaseBatch(cases, sourceLabel) {
  const chunks = [];
  for (const { filePath, caseLabel, date } of cases) {
    const buf = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const text = result.text.replace(/-- \d+ of \d+ --/g, ' ');
    for (const chunkText of chunkPageText(text)) {
      if (chunkText.length < 20) continue;
      chunks.push({
        id: `${sourceLabel}-${caseLabel}-${chunks.length}`,
        source: sourceLabel,
        page: caseLabel,
        date,
        text: chunkText,
      });
    }
  }
  return chunks;
}

module.exports = { buildIndex, indexPdf, indexText, indexCaseBatch };

const STOPWORDS = new Set([
  'the','a','an','and','or','of','to','in','on','for','is','are','be','was',
  'were','will','shall','with','as','by','at','from','that','this','it','its',
  'or','if','not','no','than','then','do','does','did','i','you','he','she',
  'they','we','what','when','where','why','how','can','could','would','should',
]);

// Collapse "article 18" / "paragraph 18" / "section 18" (and variants
// like "ARTICLE 18" or "art. 18") into a single compound token "article18"
// before tokenizing — otherwise "article" and "18" each carry near-zero
// IDF in a collective-agreement corpus (both appear on almost every page),
// making article-specific queries score essentially random results.
// Applied identically at index time and query time so they always match.
function compoundArticleRefs(text) {
  return text
    .replace(/\b(article|art\.?|paragraph|para\.?|section|sec\.?)\s+(\d+(?:\.\d+)*)/gi,
      (_, word, num) => `article${num.replace(/\./g, '_')}`);
}

function tokenize(text) {
  return compoundArticleRefs(text)
    .toLowerCase()
    .match(/[a-z0-9_.]+/g)
    ?.filter((t) => t.length > 1 && !STOPWORDS.has(t)) ?? [];
}

const K1 = 1.5;
const B = 0.75;

class SearchIndex {
  constructor(chunks) {
    this.chunks = chunks;
    this.N = chunks.length;
    this.docLengths = new Array(this.N);

    // Inverted index: token -> flat postings list [docId, tf, docId, tf, ...].
    // A query only needs to score documents that actually contain one of its
    // terms, so we walk these postings instead of scanning all chunks. The
    // term frequency is baked in here once, which also removes the per-query
    // token recount the old per-doc score() did on every search. The doc's
    // tokens themselves are not retained after this loop — postings + lengths
    // are everything BM25 needs — which keeps the resident index small enough
    // for the 512 MB instance.
    this.postings = new Map();

    let totalLength = 0;
    for (let i = 0; i < this.N; i++) {
      const tokens = tokenize(chunks[i].text);
      this.docLengths[i] = tokens.length;
      totalLength += tokens.length;

      const counts = new Map();
      for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
      for (const [t, tf] of counts) {
        let list = this.postings.get(t);
        if (!list) {
          list = [];
          this.postings.set(t, list);
        }
        list.push(i, tf);
      }
    }
    this.avgLength = totalLength / (this.N || 1);
  }

  search(query, { topK = 8, sources = null, dateFrom = null, dateTo = null } = {}) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Collapse repeated query terms; a term appearing twice in the question
    // contributes twice, identical to the old loop summing each occurrence.
    const queryFreq = new Map();
    for (const t of queryTokens) queryFreq.set(t, (queryFreq.get(t) || 0) + 1);

    // BM25, accumulated per candidate document across the query's terms.
    const scores = new Map();
    for (const [q, qtf] of queryFreq) {
      const list = this.postings.get(q);
      if (!list) continue;
      const df = list.length / 2; // postings hold [docId, tf] pairs
      const idf = Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
      for (let p = 0; p < list.length; p += 2) {
        const docIndex = list[p];
        const tf = list[p + 1];
        const len = this.docLengths[docIndex];
        const denom = tf + K1 * (1 - B + B * (len / this.avgLength));
        const contribution = qtf * idf * ((tf * (K1 + 1)) / denom);
        scores.set(docIndex, (scores.get(docIndex) || 0) + contribution);
      }
    }

    const results = [];
    for (const [docIndex, score] of scores) {
      if (score <= 0) continue;
      const chunk = this.chunks[docIndex];
      if (sources && !sources.includes(chunk.source)) continue;
      // Date range only constrains chunks that actually carry a date
      // (e.g. CROA cases) — other sources are unaffected.
      if (chunk.date) {
        if (dateFrom && chunk.date < dateFrom) continue;
        if (dateTo && chunk.date > dateTo) continue;
      }
      results.push({ chunk, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map((r) => r.chunk);
  }
}

module.exports = { SearchIndex, tokenize };

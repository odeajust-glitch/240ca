const STOPWORDS = new Set([
  'the','a','an','and','or','of','to','in','on','for','is','are','be','was',
  'were','will','shall','with','as','by','at','from','that','this','it','its',
  'or','if','not','no','than','then','do','does','did','i','you','he','she',
  'they','we','what','when','where','why','how','can','could','would','should',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .match(/[a-z0-9.]+/g)
    ?.filter((t) => t.length > 1 && !STOPWORDS.has(t)) ?? [];
}

class SearchIndex {
  constructor(chunks) {
    this.chunks = chunks;
    this.docFreq = new Map();
    this.docTokens = chunks.map((c) => tokenize(c.text));
    this.docLengths = this.docTokens.map((t) => t.length);
    this.avgLength =
      this.docLengths.reduce((a, b) => a + b, 0) / (this.docLengths.length || 1);

    for (const tokens of this.docTokens) {
      const seen = new Set();
      for (const t of tokens) {
        if (seen.has(t)) continue;
        seen.add(t);
        this.docFreq.set(t, (this.docFreq.get(t) || 0) + 1);
      }
    }
    this.N = chunks.length;
  }

  // BM25 scoring
  score(queryTokens, docIndex) {
    const k1 = 1.5;
    const b = 0.75;
    const tokens = this.docTokens[docIndex];
    const len = this.docLengths[docIndex];
    const counts = new Map();
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);

    let score = 0;
    for (const q of queryTokens) {
      const df = this.docFreq.get(q) || 0;
      if (df === 0) continue;
      const idf = Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
      const tf = counts.get(q) || 0;
      if (tf === 0) continue;
      const denom = tf + k1 * (1 - b + b * (len / this.avgLength));
      score += idf * ((tf * (k1 + 1)) / denom);
    }
    return score;
  }

  search(query, { topK = 8, sources = null, dateFrom = null, dateTo = null } = {}) {
    const queryTokens = tokenize(query);
    const results = [];
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (sources && !sources.includes(chunk.source)) continue;
      // Date range only constrains chunks that actually carry a date
      // (e.g. CROA cases) — other sources are unaffected.
      if (chunk.date) {
        if (dateFrom && chunk.date < dateFrom) continue;
        if (dateTo && chunk.date > dateTo) continue;
      }
      const score = this.score(queryTokens, i);
      if (score > 0) results.push({ chunk, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map((r) => r.chunk);
  }
}

module.exports = { SearchIndex, tokenize };

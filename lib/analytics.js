// Usage counting for a public tool used by union members: we want to know
// how many people use the site without building a record of who asked what.
//
// What is stored: a per-day question count and a per-day set of opaque
// visitor hashes. What is NOT stored: raw IPs, question text, user agents.
//
// The hash is sha256(salt + date + ip), so it is one-way AND re-salted by
// the date — the same person on two different days produces two unrelated
// hashes. That is enough to count "unique visitors today" but not enough to
// follow anyone across days, which is the property we actually want.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// On Render this points at the persistent disk mount; locally it falls back
// to a gitignored folder in the project. Without the disk, a deploy would
// silently reset the counts.
const DIR = process.env.ANALYTICS_DIR || path.join(__dirname, '..', 'analytics');
const FILE = path.join(DIR, 'usage.json');

const RETENTION_DAYS = 365;
const SAVE_DEBOUNCE_MS = 5000;

function today() {
  // Fixed to a single zone so a day doesn't roll over at a surprising hour
  // or shift when Render's host timezone differs from local.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

class Analytics {
  constructor() {
    this.data = { salt: null, firstSeen: null, days: {} };
    this.saveTimer = null;
    this.load();
  }

  load() {
    try {
      this.data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      // Missing or corrupt file — start fresh rather than crash the server.
    }
    // The salt lives with the data: rotating it would orphan existing
    // hashes, and it only ever needs to be secret from whoever reads the file.
    if (!this.data.salt) this.data.salt = crypto.randomBytes(32).toString('hex');
    if (!this.data.days) this.data.days = {};
    if (!this.data.firstSeen) this.data.firstSeen = today();
  }

  visitorHash(ip, date) {
    return crypto
      .createHash('sha256')
      .update(`${this.data.salt}:${date}:${ip}`)
      .digest('hex')
      .slice(0, 16); // 64 bits — collision risk is negligible at this scale
  }

  recordQuestion(ip) {
    const date = today();
    const day = (this.data.days[date] ||= { questions: 0, visitors: [] });
    day.questions += 1;

    const hash = this.visitorHash(ip || 'unknown', date);
    if (!day.visitors.includes(hash)) day.visitors.push(hash);

    this.prune();
    this.scheduleSave();
  }

  prune() {
    const dates = Object.keys(this.data.days).sort();
    for (const date of dates.slice(0, Math.max(0, dates.length - RETENTION_DAYS))) {
      delete this.data.days[date];
    }
  }

  // Questions arrive in bursts; writing on every one would mean a disk write
  // per keystroke-triggered request. Debounce, and flush on shutdown.
  scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, SAVE_DEBOUNCE_MS);
    this.saveTimer.unref();
  }

  save() {
    try {
      fs.mkdirSync(DIR, { recursive: true });
      // Write-then-rename so a crash mid-write can't leave a truncated file
      // that fails to parse on the next boot.
      const tmp = `${FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, FILE);
    } catch (err) {
      console.error('Failed to save analytics:', err.message);
    }
  }

  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.save();
  }

  summary() {
    const dates = Object.keys(this.data.days).sort();
    const byDay = dates.map((date) => ({
      date,
      questions: this.data.days[date].questions,
      visitors: this.data.days[date].visitors.length,
    }));

    const sinceDays = (n) => {
      const recent = byDay.slice(-n);
      return {
        questions: recent.reduce((sum, d) => sum + d.questions, 0),
        // Visitor hashes are re-salted daily by design, so a multi-day
        // "unique visitors" number is not computable — this is the sum of
        // daily uniques, which double-counts anyone who returns. Named
        // "visits" rather than "visitors" to keep that honest.
        visits: recent.reduce((sum, d) => sum + d.visitors, 0),
      };
    };

    return {
      firstSeen: this.data.firstSeen,
      totalQuestions: byDay.reduce((sum, d) => sum + d.questions, 0),
      today: byDay.length && byDay[byDay.length - 1].date === today()
        ? byDay[byDay.length - 1]
        : { date: today(), questions: 0, visitors: 0 },
      last7: sinceDays(7),
      last30: sinceDays(30),
      byDay,
    };
  }
}

module.exports = { Analytics };

// Minimal per-IP sliding-window rate limiter. Every /api/ask call costs
// real Kimi tokens on a public URL, so this is cost protection, not
// traffic engineering — a tiny in-memory log per IP is plenty for a
// single-instance deploy and avoids a dependency.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip -> timestamps of requests within the window

  // Sweep idle IPs so the map doesn't grow forever on a long-lived process.
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length === 0) hits.delete(ip);
      else hits.set(ip, live);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const times = (hits.get(req.ip) || []).filter((t) => t > cutoff);
    if (times.length >= max) {
      return res.status(429).json({ error: message });
    }
    times.push(now);
    hits.set(req.ip, times);
    next();
  };
}

module.exports = { rateLimit };

"""A hidden account mark for screenshots: the feasibility test of 12 Nov 2026 (see README.md here).
NOT USED BY THE SITE OR THE LAPTOP. Kept so a later build, or a session asked to trace a screenshot,
starts from what was tested. Python 3 with numpy and Pillow; run with -I on a picture someone sent.

The mark is a tile of 8 x 8 cells repeated over the whole screen. Each cell is either "marked" (a
faint shade, `amp` levels out of 255: darker on a light page, lighter on a dark one) or not.
24 cells are a fixed sync pattern (to find the tile and its polarity); the other 40 carry a 20-bit
number as 20 pairs (marked, unmarked) or (unmarked, marked), so each bit is read as a difference.

Decoding knows nothing about the scale or crop: it finds the repeat (the tile's size in pixels)
from the image, folds the whole image onto one tile (averaging every copy), finds the sync, and
reads the bits. Flat pixels only (backgrounds and card fills): text and edges are left out.
"""
import io
import numpy as np
from PIL import Image

N = 8                      # cells per side
CELLS = N * N
NSYNC = 24
NBITS = 20
# The layout, fixed for good (it must never change once marks are out). Drawn once from
# numpy.random.default_rng(240): a permutation of the 64 cells (24 sync, then 20 pairs) and the sync signs.
# The page (public/board.html, ShotMark) carries the same numbers; test/board/shotmark.test.js checks they agree.
SYNC_POS = np.array([54, 19, 12, 40, 37, 5, 34, 18, 14, 58, 27, 23, 52, 30, 8, 31, 51, 28, 63, 9, 46, 4, 41, 17])
SYNC_VAL = np.array([-1, -1, -1, -1, -1, 1, -1, -1, 1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1])
PAIRS = np.array([[44, 48], [2, 0], [3, 42], [55, 33], [38, 49], [35, 43], [25, 57], [6, 62], [15, 39], [16, 10], [13, 47], [56, 24], [20, 60], [29, 53], [59, 32], [50, 1], [36, 22], [26, 61], [7, 11], [21, 45]])


def cells_for(mark):
    v = np.zeros(CELLS, int)
    v[SYNC_POS] = SYNC_VAL
    for k in range(NBITS):
        a, c = PAIRS[k]
        v[a], v[c] = (1, -1) if (mark >> k) & 1 else (-1, 1)
    return v.reshape(N, N)     # +1 = marked


def tile_png(mark, amp, light=True, tint='grey'):
    """tint 'grey': darker on a light page, lighter on a dark one. tint 'blue': less blue on a light page
    (a yellow wash), more blue on a dark one; brightness barely moves, which the eye is far less able to see."""
    v = cells_for(mark)
    rgba = np.zeros((N, N, 4), np.uint8)
    if tint == 'blue':
        rgba[..., :3] = (255, 255, 0) if light else (0, 0, 255)
    else:
        rgba[..., :3] = 0 if light else 255
    # The setting chosen on 12 Nov: tint 'grey', amp 1 on a light page and 2 on a dark one (a browser
    # rounds a faint white wash down on a dark page: alpha 2 shows as about 1 level), hard-edged cells
    # (CSS image-rendering: pixelated); soft edges and the blue tint both read back worse.
    rgba[..., 3] = np.where(v > 0, amp, 0)
    buf = io.BytesIO()
    Image.fromarray(rgba, 'RGBA').save(buf, 'PNG')
    return buf.getvalue()


# ----------------------------------------------------------------------------------------------
def lum(img):
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def _boxsum(a, r):
    """Sum over a (2r+1) x (2r+1) window, windows clipped at the edges."""
    H, W = a.shape
    c = np.zeros((H + 1, W + 1), np.float64)
    c[1:, 1:] = np.cumsum(np.cumsum(a, 0), 1)
    y0 = np.clip(np.arange(H) - r, 0, H); y1 = np.clip(np.arange(H) + r + 1, 0, H)
    x0 = np.clip(np.arange(W) - r, 0, W); x1 = np.clip(np.arange(W) + r + 1, 0, W)
    return c[y1][:, x1] - c[y0][:, x1] - c[y1][:, x0] + c[y0][:, x0]


def _range3(Y):
    """max - min over each pixel's 3 x 3 neighbourhood."""
    p = np.pad(Y, 1, mode='edge')
    H, W = Y.shape
    mx = np.full_like(Y, -1e9); mn = np.full_like(Y, 1e9)
    for dy in range(3):
        for dx in range(3):
            s = p[dy:dy + H, dx:dx + W]
            mx = np.maximum(mx, s); mn = np.minimum(mn, s)
    return mx - mn


def _autocorr(D, axis):
    n = D.shape[axis]
    nfft = 1 << (2 * n - 1).bit_length()
    F = np.fft.rfft(D, nfft, axis=axis)
    ac = np.fft.irfft((F * np.conj(F)).sum(axis=1 - axis), nfft)[:n]
    return ac / max(ac[0], 1e-9)


def find_period(Y, flat, pmin, pmax, G=4.0):
    Dx = np.diff(Y, axis=1); mx = flat[:, 1:] & flat[:, :-1] & (np.abs(Dx) <= G)
    Dy = np.diff(Y, axis=0); my = flat[1:, :] & flat[:-1, :] & (np.abs(Dy) <= G)
    ax = _autocorr(np.where(mx, Dx, 0).astype(np.float64), 1)
    ay = _autocorr(np.where(my, Dy, 0).astype(np.float64), 0)
    n = min(len(ax), len(ay))
    ac = ax[:n] + ay[:n]
    hi = min(pmax, n - 2)
    if hi <= pmin:
        return None, 0.0
    lags = np.arange(pmin, hi + 1)
    seg = ac[pmin:hi + 1]
    i = int(np.argmax(seg)); L = int(lags[i])
    # prefer the fundamental if half the lag is nearly as strong
    half = L / 2
    if half >= pmin:
        h = int(round(half))
        if ac[h] >= 0.6 * ac[L]:
            L = h
    # sub-pixel peak
    if 1 <= L < n - 1:
        a, b, c = ac[L - 1], ac[L], ac[L + 1]
        d = a - 2 * b + c
        off = 0.5 * (a - c) / d if d < 0 else 0.0
    else:
        off = 0.0
    # how much the peak stands out from the rest of the searched lags
    rest = np.delete(seg, slice(max(0, i - 3), i + 4))
    z = (ac[L] - rest.mean()) / (rest.std() + 1e-12)
    return L + off, float(z)


def fold(r, w, P, B):
    H, W = r.shape
    by = np.floor(np.mod(np.arange(H), P) * B / P).astype(int) % B
    bx = np.floor(np.mod(np.arange(W), P) * B / P).astype(int) % B
    idx = (by[:, None] * B + bx[None, :]).ravel()
    S = np.bincount(idx, weights=(r * w).ravel(), minlength=B * B)
    Wt = np.bincount(idx, weights=w.ravel(), minlength=B * B)
    return (S / np.maximum(Wt, 1e-9)).reshape(B, B), Wt.reshape(B, B)


def _cell_views(T, sub):
    """Every way the folded tile can line up with the cells: 16 sub-bin phases x 64 cyclic shifts.
    Returns a (1024, 64) matrix of cell values (centre sub-bins of each cell only)."""
    rows = []
    lo, hi = max(1, sub // 4), max(2, sub - sub // 4)
    for oy in range(sub):
        for ox in range(sub):
            Tr = np.roll(np.roll(T, -oy, 0), -ox, 1)
            C = Tr.reshape(N, sub, N, sub)[:, lo:hi, :, lo:hi].mean(axis=(1, 3))
            for sy in range(N):
                for sx in range(N):
                    rows.append(np.roll(np.roll(C, -sy, 0), -sx, 1).ravel())
    return np.array(rows)


def _template(mark):
    return cells_for(mark).ravel().astype(float)


def _energy(r, w, P, B):
    T, Wt = fold(r, w, P, B)
    T = T - (T * Wt).sum() / max(Wt.sum(), 1e-9)
    return float((Wt * T * T).sum() / max(Wt.sum(), 1e-9)), T


def residual(Y, flat, P):
    """Each flat pixel against the mean of its own fill colour around it (about 7 x 7 cells), so the mark
    stands out by about half its strength in every cell, whatever its neighbours. Fills are the peaks of the
    flat pixels' values; each pixel goes to its nearest peak within 3 levels, so two fills a few levels
    apart are never mixed (12 Nov: mixing two fills 7 levels apart drowned the mark)."""
    v = Y[flat]
    hist = np.bincount(np.clip(np.round(v), 0, 255).astype(int), minlength=256).astype(float)
    sm = np.convolve(hist, np.ones(3), 'same')
    peaks = [L for L in range(256) if sm[L] >= 0.01 * len(v) and all(sm[L] >= sm[min(255, max(0, L + d))] for d in (-2, -1, 1, 2))]
    peaks.sort(key=lambda L: -sm[L])
    levels = []
    for L in peaks:
        if len(levels) >= 12:
            break
        if all(abs(L - x) >= 3 for x in levels):
            levels.append(int(L))
    lut = np.full(256, -1)
    for val in range(256):
        d = [abs(val - L) for L in levels]
        if d and min(d) <= 3:
            lut[val] = int(np.argmin(d))
    idx = np.where(flat, lut[np.clip(np.round(Y), 0, 255).astype(int)], -1)
    R = max(3, int(round(3 * P / N)))
    r = np.zeros_like(Y, dtype=np.float32)
    w = np.zeros_like(Y, dtype=np.float32)
    for j in range(len(levels)):
        mk = idx == j
        m = mk.astype(np.float32)
        cnt = _boxsum(m, R)
        ref = _boxsum(Y * m, R) / np.maximum(cnt, 1)
        ok = mk & (cnt >= 0.25 * (2 * R + 1) ** 2)
        r[ok] = (Y - ref)[ok]
        w[ok] = 1.0
    w[np.abs(r) > 6] = 0
    return r, w


def opp(img):
    """Blue against red and green (the blue/yellow tint tried on 12 Nov; not used by the page)."""
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    return a[..., 2] - 0.5 * (a[..., 0] + a[..., 1])


def decode(img, candidates=None, pmin=24, pmax=420, sub=4, channel='auto'):
    if channel == 'auto':
        best = None
        for ch in ('grey', 'blue'):
            r = decode(img, candidates, pmin, pmax, sub, ch)
            key = (bool(r.get('found')), r.get('energy_ratio', 0) or 0)
            if best is None or key > best[0]:
                best = (key, r)
            if r.get('found'):
                break
        return best[1]
    Y = opp(img) if channel == 'blue' else lum(img)
    flat = _range3(Y) <= 5
    P0, pz = find_period(Y, flat, pmin, pmax)
    out = {'channel': channel, 'size': img.size, 'flat_share': round(float(flat.mean()), 2), 'period_z': round(pz, 1)}
    if P0 is None:
        out.update(found=False, why='image too small'); return out
    r, w = residual(Y, flat, P0)
    B = N * sub
    ys, xs = np.nonzero(w)
    vals = r[ys, xs].astype(np.float64)
    if len(vals) > 700000:
        pick = np.random.default_rng(0).choice(len(vals), 700000, replace=False)
        sy, sx, sv = ys[pick], xs[pick], vals[pick]
    else:
        sy, sx, sv = ys, xs, vals
    def en_of(Pt, yy, xx, vv):
        by = np.floor(np.mod(yy, Pt) * B / Pt).astype(int) % B
        bx = np.floor(np.mod(xx, Pt) * B / Pt).astype(int) % B
        idx = by * B + bx
        S = np.bincount(idx, weights=vv, minlength=B * B); C = np.bincount(idx, minlength=B * B)
        Tm = S / np.maximum(C, 1); mu = S.sum() / max(C.sum(), 1)
        return float((C * (Tm - mu) ** 2).sum() / max(C.sum(), 1)), (Tm - mu).reshape(B, B)
    # the exact period: the one that folds the most energy onto one tile (coarse, then fine)
    coarse = P0 * (1 + np.linspace(-0.02, 0.02, 41))
    k = int(np.argmax([en_of(Pt, sy, sx, sv)[0] for Pt in coarse]))
    fine = coarse[k] * (1 + np.linspace(-0.0012, 0.0012, 13))
    k = int(np.argmax([en_of(Pt, sy, sx, sv)[0] for Pt in fine]))
    P = float(fine[k])
    eP, T = en_of(P, ys, xs, vals)
    null = np.median([en_of(P * f, sy, sx, sv)[0] for f in (0.79, 0.83, 0.87, 1.17, 1.23, 1.29)])
    A = _cell_views(T, sub)                                  # 1024 x 64
    # the free read (no list): the alignment where the sync cells agree best
    sync = A[:, SYNC_POS] @ SYNC_VAL
    i = int(np.argmax(np.abs(sync)))
    cells = np.sign(sync[i]) * A[i]
    diffs = np.array([cells[a] - cells[b] for a, b in PAIRS])
    mark = int(sum(int(d > 0) << k for k, d in enumerate(diffs)))
    out.update(period=round(P, 2), energy_ratio=round(eP / max(null, 1e-12), 1), read=mark,
               amp_est=round(2 * float(np.mean(cells[SYNC_POS] * SYNC_VAL)), 2))
    if candidates is not None:
        tm = np.array([_template(c) for c in candidates]).T       # 64 x K
        S = A @ tm                                               # 1024 x K
        absS = np.abs(S)
        best_al = absS.argmax(axis=0)
        top = absS[best_al, np.arange(len(candidates))]
        norm = np.abs(A[best_al]).sum(axis=1)
        frac = top / np.maximum(norm, 1e-9)                      # 1.0 = every cell agrees with that member's pattern
        order = np.argsort(-frac)
        b, s2 = order[0], order[1] if len(order) > 1 else order[0]
        # how far the best stands out against every other alignment of the same pattern
        col = np.sort(absS[:, b])[:-sub * sub]
        z = (top[b] - col.mean()) / (col.std() + 1e-12)
        # The 20 number bits only, read at that member's best alignment: every member shares the sync
        # cells, so on the whole tile a stranger already agrees about 4 cells in 10.
        def bits_agree(j):
            al = best_al[j]; cv = np.sign(S[al, j]) * A[al]
            d = np.array([cv[a] - cv[c] for a, c in PAIRS])
            sg = np.array([1 if (candidates[j] >> k) & 1 else -1 for k in range(NBITS)])
            return float(np.dot(d, sg) / (np.abs(d).sum() + 1e-12))
        ab, an = bits_agree(b), max(bits_agree(j) for j in order[1:6]) if len(order) > 1 else -1.0
        out.update(best=int(candidates[b]), agree=round(float(frac[b]), 2), next_agree=round(float(frac[s2]), 2), z=round(float(z), 1),
                   bits=round(ab, 2), next_bits=round(an, 2))
        out['found'] = bool(out['energy_ratio'] >= 3 and z >= 6 and ab >= 0.8 and ab - an >= 0.35)
    return out


def mark_of(account_id):
    """A trial only: 20 bits from an account id (the Worker's id, or 'owner'). A build for members would
    take the number from a secret on the Worker instead, so nobody could work out another member's."""
    import hashlib
    return int.from_bytes(hashlib.sha256(('mark:' + account_id).encode()).digest()[:3], 'big') >> 4


if __name__ == '__main__':
    import sys, json
    if len(sys.argv) < 2:
        sys.exit('usage: python3 -I wm.py <picture> [account ids, comma separated]')
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else []
    cands = [mark_of(i) for i in ids] if ids else None
    if cands and len(cands) == 1:
        cands.append(cands[0] ^ 0xFFFFF)        # matching needs a second pattern to compare against
    r = decode(Image.open(sys.argv[1]).convert('RGB'), candidates=cands)
    if ids and r.get('best') is not None:
        r['account'] = ids[[mark_of(i) for i in ids].index(r['best'])] if r['best'] in [mark_of(i) for i in ids] else None
    print(json.dumps(r, default=str, indent=1))

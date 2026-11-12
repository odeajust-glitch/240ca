# The sharing treatments the 12 Nov test put each screenshot through (see README.md). Not used by the site.
import sys, os, io, json, glob, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageFilter
from multiprocessing import Pool
import wm

MARK = 0x5A3C7
CANDS = [MARK] + [int(x) for x in np.random.default_rng(7).integers(0, 1 << 20, 80)]   # a member list of 81


def jpeg(im, q):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, subsampling=2); b.seek(0); return Image.open(b).convert('RGB')
def resize_max(im, m):
    w, h = im.size; s = m / max(w, h)
    return im.resize((round(w * s), round(h * s)), Image.LANCZOS) if s < 1 else im
def resize_w(im, W):
    w, h = im.size; return im.resize((W, round(h * W / w)), Image.LANCZOS)
def crop_c(im, cw, ch, oy=0.45):
    w, h = im.size; x = (w - cw) // 2 + 37; y = int((h - ch) * oy) + 11
    return im.crop((x, y, x + cw, y + ch))
def photo(im):
    """A rough stand-in for a photo of the screen with another phone: tilt, focus blur, exposure,
    vignetting, sensor noise, a smaller picture, JPEG. Real moire and glare are not modelled."""
    rng = np.random.default_rng(3)
    w, h = im.size; d = 0.03
    quad = (w * d, h * d * 0.5, w * d * 0.3, h * (1 - d), w * (1 - d * 0.2), h * (1 - d * 0.6), w * (1 - d), 0)
    im2 = im.transform((w, h), Image.QUAD, quad, Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.6))
    a = np.asarray(im2).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    vig = 1 - 0.15 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a = 255 * ((a / 255) ** 1.15) * 0.92 * vig[..., None] + rng.normal(0, 3.5, a.shape)
    im3 = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((w * 3 // 4, h * 3 // 4), Image.BILINEAR)
    return jpeg(im3, 85)

VARIANTS = {
    'as taken (PNG)': lambda im: im,
    'emailed (JPEG 90)': lambda im: jpeg(im, 90),
    'Messenger/WhatsApp (1600 px, JPEG 75)': lambda im: jpeg(resize_max(im, 1600), 75),
    'text message (640 px wide, JPEG 60)': lambda im: jpeg(resize_w(im, 640), 60),
    'squashed (480 px wide, JPEG 50)': lambda im: jpeg(resize_w(im, 480), 50),
    'cropped to one box (900x700, JPEG 75)': lambda im: jpeg(crop_c(im, 900, 700), 75),
    'small crop (450x450, JPEG 75)': lambda im: jpeg(crop_c(im, 450, 450), 75),
    'photo of the screen (rough stand-in)': photo,
}

def job(args):
    path, vname = args
    im = Image.open(path).convert('RGB')
    t = time.time()
    r = wm.decode(VARIANTS[vname](im), candidates=CANDS)
    base = os.path.basename(path)[:-4]
    kind = base.rsplit('-', 1)[1]
    ok = None
    if kind != 'none':
        ok = bool(r.get('found') and r.get('best') == MARK)
        wrong = bool(r.get('found') and r.get('best') != MARK)
    else:
        wrong = bool(r.get('found'))          # an unmarked screen said to carry a mark
    return {'shot': base, 'variant': vname, 'kind': kind, 'ok': ok, 'wrong': wrong, 'secs': round(time.time() - t, 1), **{k: (float(v) if isinstance(v, (np.floating,)) else v) for k, v in r.items() if k != 'size'}}

if __name__ == '__main__':
    shots = sorted(glob.glob(os.path.join(sys.argv[1], '*.png')))
    shots = [s for s in shots if not s.endswith('-visible.png')]
    jobs = [(s, v) for s in shots for v in VARIANTS]
    with Pool(int(sys.argv[2]) if len(sys.argv) > 2 else 4) as pool:
        res = pool.map(job, jobs, chunksize=1)
    json.dump(res, open(sys.argv[3], 'w'), indent=0, default=str)
    print(len(res), 'decodes')

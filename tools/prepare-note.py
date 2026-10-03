"""Turns the photo of the handwritten about note into ink-only line images.

    python3 tools/prepare-note.py   # reads note-src/note-photo.png (kept out of git)

The photo's uneven lighting is flattened (divided by a heavy blur of the paper with the ink closed
out), ink darkness becomes alpha (keeping the pen's own edges and pressure), and each line kept is
cut out by its glyphs' connected components, so neighbouring lines' descenders don't come along.
Each line is straightened by fitting its ink, then all are scaled alike and written as
transparent PNGs (src/about/line-N.png) with their layout (src/about/note.json). The crossed-out
attempts in the photo are simply not among the kept lines.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path("note-src/note-photo.png")
OUT = Path("src/about")
SCALE = 2.016  # the boxes below were read off a 2000 px wide preview of the 4032 px photo
# (text, crop box x0 x1 y0 y1, core band y0 y1, paragraph gap before, in lines) — preview px
LINES = [
    ("Thank you for visiting.", (160, 1010, 80, 190), (100, 168), 0),
    ("Sometimes I make things. Some", (165, 1240, 175, 280), (192, 258), 0),
    ("of them can be seen here.", (165, 1110, 268, 340), (280, 326), 0),
    ("You can reach me on", (165, 915, 355, 445), (372, 432), 0),
    ("nic@mcnoose.com", (170, 745, 825, 900), (842, 888), 0),
    ("-Nic", (140, 330, 1345, 1420), (1358, 1408), 1),
]
TARGET_W = 760  # output px for the widest line
INK_LO, INK_HI = 0.86, 0.5  # flattened paper ≈ 1; darker than INK_LO starts to be ink, INK_HI is solid


def ink_alpha(gray: np.ndarray) -> np.ndarray:
    small = gray[::8, ::8]
    paper = ndimage.grey_closing(small, size=(9, 9))  # close out the ink strokes
    paper = ndimage.gaussian_filter(paper, 6)
    paper = np.kron(paper, np.ones((8, 8)))[: gray.shape[0], : gray.shape[1]]
    flat = gray / np.maximum(paper, 1e-3)
    return np.clip((INK_LO - flat) / (INK_LO - INK_HI), 0, 1)


def line_ink(alpha: np.ndarray, box, band) -> tuple[np.ndarray, int, int]:
    x0, x1, y0, y1 = (int(v * SCALE) for v in box)
    b0, b1 = (v * SCALE - y0 for v in band)
    crop = alpha[y0:y1, x0:x1].copy()
    labels, n = ndimage.label(crop > 0.12, structure=np.ones((3, 3)))
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        mask = labels[sl] == i
        if mask.sum() < 40:
            continue  # specks
        cy = sl[0].start + np.average(np.nonzero(mask)[0])
        keep[i] = b0 <= cy <= b1  # glyphs belonging to this line
    grown = ndimage.binary_dilation(keep[labels], iterations=3)  # keep each stroke's soft edge
    return crop * grown, x0, y0


def straighten(ink: np.ndarray) -> tuple[np.ndarray, float]:
    ys, xs = np.nonzero(ink > 0.5)
    w = ink[ys, xs]
    # Fit the ink's lower half (baseline region) per column bucket: robust to ascenders.
    buckets = np.linspace(xs.min(), xs.max(), 24)
    pts = []
    for a, b in zip(buckets[:-1], buckets[1:]):
        m = (xs >= a) & (xs < b)
        if m.sum() > 30:
            pts.append(((a + b) / 2, np.percentile(ys[m], 80)))
    if len(pts) < 8 or xs.max() - xs.min() < 600:
        return ink, 0.0  # too short to read a baseline from (a tall capital against a dash fools it)
    px, py = np.array(pts).T
    slope = np.polyfit(px, py, 1)[0]
    angle = np.degrees(np.arctan(slope))
    if abs(angle) < 0.4 or abs(angle) > 4:
        return ink, 0.0 if abs(angle) > 4 else angle
    return np.clip(ndimage.rotate(ink, angle, reshape=True, order=1), 0, 1), angle


def trim(ink: np.ndarray) -> tuple[np.ndarray, int]:
    ys, xs = np.nonzero(ink > 0.03)
    return ink[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], xs.min()


def baseline(ink: np.ndarray) -> float:
    rows = ink.sum(axis=1)
    cum = np.cumsum(rows) / rows.sum()
    return float(np.searchsorted(cum, 0.82))  # most ink sits above the baseline; descenders are few


def main():
    gray = np.asarray(Image.open(SRC).convert("L"), dtype=np.float32) / 255
    alpha = ink_alpha(gray)
    cut = []
    for text, box, band, gap in LINES:
        ink, x0, _ = line_ink(alpha, box, band)
        ink, angle = straighten(ink)
        ink, left = trim(ink)
        cut.append((text, ink, x0 + left, gap, angle))
    widest = max(i.shape[1] for _, i, _, _, _ in cut)
    k = TARGET_W / widest
    left0 = min(x for _, _, x, _, _ in cut)
    OUT.mkdir(parents=True, exist_ok=True)
    meta = []
    for n, (text, ink, x, gap, angle) in enumerate(cut, start=1):
        h, w = ink.shape
        img = Image.fromarray((ink * 255).astype(np.uint8)).resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        la = Image.merge("LA", (Image.new("L", img.size, 0), img))
        la.save(OUT / f"line-{n}.png", optimize=True)
        meta.append({"text": text, "file": f"line-{n}.png", "x": round((x - left0) * k), "w": img.size[0], "h": img.size[1], "baseline": round(baseline(ink) * k), "gapBefore": gap})
        print(f"line {n}: {text!r} straightened {angle:+.2f}°, {img.size}")
    (OUT / "note.json").write_text(json.dumps({"lines": meta}, indent=2) + "\n")


if __name__ == "__main__":
    main()

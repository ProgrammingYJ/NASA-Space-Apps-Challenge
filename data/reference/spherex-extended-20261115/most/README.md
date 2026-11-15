# DEV-025 official Solar SPHEREx coverage and bounded acquisitions

This folder records metadata research and eight explicitly authorized native archive cutouts. It is not a detection, flux or motion result. App code, `datasets.json`, observation registry and old comparisons were not edited by this acquisition task.

## Official interfaces checked

- [IRSA MOST program interface](https://irsa.ipac.caltech.edu/applications/MOST/MOSTProgramInterface.html)
- [IRSA MOST instructions and output columns](https://irsa.ipac.caltech.edu/applications/MOST/instructions.html)
- [IRSA SPHEREx data products and calibration documentation](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/)

The live queries use MOST `catalog=spherex`, `input_type=naifid_input`, explicit body NAIF IDs, bounded calendar-month UT ranges, and `output_mode=Brief`. Default TLS validation was used. Raw response bodies, exact URL/parameters, retrieval time, bytes and SHA256 are in `.response.txt` / `.source.json`; `.parsed.json` retains all returned rows. The existing Node MOST parser was reused for independent format compatibility. No archive-wide or TNO fan-out was run.

## Actual bounded query results

| Body | NAIF | Query interval | Matched spectral-image rows | Detectors represented |
| --- | --- | --- | --- | --- |
| Uranus | 799 | 2026-08-01 through 2026-08-31 | 134 | D1–D6 |
| Neptune | 899 | 2025-06-01 through 2025-06-30 | 66 | D1–D6 |
| Jupiter | 599 | 2026-04-01 through 2026-04-30 | 40 | D1,D2,D4,D5 |
| Saturn | 699 | 2025-06-01 through 2025-06-30 | 64 | D1–D6 |
| Mars | 499 | 2026-09-01 through 2026-09-30 | 0 | Successful empty table |
| Mars | 499 | 2025-05-01 through 2025-05-31 | 0 | Successful empty table |

These counts are returned image-product overlaps, including different detectors and closely spaced exposures; they are not counts of independent source detections. Empty Mars tables describe those indexed windows only. Earth, Mercury and Venus were not queried in this bounded acquisition task; no visibility/impossibility conclusion is made for them.

MOST coordinates are predictions with an observer convention not independently established here. They were used only as temporary crop-request centers. Their values and the original raw response hashes are preserved. Returned `vmag=99.00` values were not adopted as validated magnitudes or converted into SPHEREx infrared brightness.

## Acquired originals

Exactly eight native IBE cutouts were acquired, using explicit 0.12deg requests and a hard cap of10000000 bytes each. Each target has two distinct observation dates in the same detector. Total actual FITS bytes are32699520, within the two authorized40MB batches. No full-frame FITS were downloaded.

Raw FITS: `data/raw/spherex-extended-20261115/`.

Original DataLink XML, source receipts and full header dumps: `data/reference/spherex-extended-20261115/`.

The authoritative acquisition summary is `acquired-eight-header-summary.json`, SHA256 `aab0f35a25ef4fd9c45ff5226a4722a0ed666a63b0b5a377f3dfad882c1e5a92`. It contains each raw SHA, actual bytes, original/cutout URLs, FITS DATE-AVG/TIMESYS/OBSID/DETECTOR/VERSION, source array shape, EPSF rows and exact DataLink spectral-calibration row. All eight are VERSION7.0.5 and UTC; Jupiter D1 has EPSF441 rows, the D3 inputs451. Neptune first cutout is71x72; the other seven are70x70. These native dimensions are preserved.

All eight DataLink responses explicitly identify v5 `cal-swcs-v5-2026-191` products: D1 for Jupiter, D3 for Saturn/Uranus/Neptune. Their calibration URLs refer to the official DR1 archive. Root integration must pin the actual existing calibration file bytes/hash and acquire precise SPHEREx-observer ephemerides at each actual FITS DATE-AVG before registering final markers. The response direction or a visible peak is not a measured centroid.

## Quality observations at temporary crop-reference positions

`crop-reference-quality.json` is an actual native r<=3-pixel inspection at the temporary MOST crop-reference points. It does not use the final SPHEREx-observer predictions. Its SHA256 is `6add3482f84e237b3708d3208ccf3888d2850749a3d971c3035ac715668c3860`.

Both Jupiter reference windows have entirely nonfinite IMAGE values and OVERFLOW/SUR_ERROR/CROSSTALK/SOURCE/BLOOM flags. Saturn includes partial or complete nonfinite reference windows and many flags. These are useful quality-diagnostic inputs; do not fill the missing samples or claim good photometry. Neptune reference windows have finite IMAGE values but one contains defect/processing flags. Uranus is finite with reviewable OUTLIER pixels. Counts must be recomputed at the final adopted prediction and remain separate from source association or measured motion.

No PSF fitting, photometric normalization, response matching, registration, centroiding, difference measurement or motion validation was run. Native IMAGE/FLAGS/VARIANCE/ZODI and original WCS/PSF metadata remain unchanged.

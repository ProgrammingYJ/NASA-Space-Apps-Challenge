---
name: spherex-data-contract
description: Inspect or implement SPHEREx archive inputs, FITS readers, calibration references and provenance manifests for this Planet X project. Use for observation ingestion or release changes, not to infer a discovery or create a new survey.
---

# SPHEREx data contract

Read the relevant data/science sections of [AGENTS.md](../../../AGENTS.md), [FSD.md](../../../FSD.md), [data inventory](../../../docs/data_inventory.md) and the selected records in [datasets.json](../../../data/manifests/datasets.json). Update the single FSD when its input/processing contract changes. Start with existing local inputs; do not redownload the full archive.

## Work

1. Identify the exact observation/release/detector and intended use. Verify the selected local file's actual bytes/SHA against its manifest. Keep original FITS immutable; derived products get separate paths and versions.
2. Inspect actual HDUs, dimensions, units, primary/SIP and alternate WCS, pixel origin, DATE-AVG/TIMESYS, declared flag definitions, EPSF structure and DataLink calibration. Distinguish DATE generation time from exposure time.
3. For DR1/QR3, read EPSF as a table with its actual zone/row count, not a fixed QR2 cube or hardcoded441rows. Link spectral calibration by its actual DataLink/release. Do not reuse oldQR2 quality counts or SWCSv4 for a newDR1 input.
4. Preserve IMAGE/VARIANCE/FLAGS/ZODI and declared-versus-undeclared bits. Keep SOURCE informational, OUTLIER reviewable and purpose-specific mask policies distinct. Finite values or no selected bad bit do not establish source measurement quality.
5. Emit/update a versioned application input manifest that links sourceURL/fileSHA/release/observation/calibration → transformation/settings → function/result. Include original coordinates/epoch, observer, time scale, wavelength method, units and WCS origin. Use relative paths for public project metadata.
6. Bound remote queries/downloads, validate archive URLs and use normal TLS verification. Record no-data separately from network/schema/quality failures. Do not silently select a replacement target.

## Result

Return selected input IDs and hashes, inspected schema/calibration, actual checks, what the application now uses, and remaining limits. Keep historical acquisition validation separate from a newly executed application test. Never represent stored template values as freshly measured centroids, fluxes or motion.


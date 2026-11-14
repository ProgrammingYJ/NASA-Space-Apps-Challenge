---
name: astrometry-motion-qa
description: Validate coordinate, time, WCS, image registration and motion claims using actual observations and independent references in this project. Use when changing astrometry or movement logic, not for generic UI styling or planet existence probabilities.
---

# Astrometry and motion QA

Use [AGENTS science contracts](../../../AGENTS.md), the single [FSD.md](../../../FSD.md), and the relevant original records. Update the FSD when the calculation/validation contract changes. The internal plan's check sheets are reference calculations with stated omissions, not a replacement for independent measurement.

## Inputs and checks

- Record source coordinates/frame/epoch, pm_ra_cosdec convention, distance/RV availability and uncertainty, observation DATE-AVG/time scale/observer, primary WCS/SIP, detector/wavelength and raw/calibration hashes.
- Check world↔pixel round trip, RA wrap, coordinate units, NumPy[y,x] versus(x,y), origin0/1 and cutout-to-native offsets on the actual input. A round trip alone checks internal consistency, not absolute astrometric truth.
- Separate proper motion, observer parallax, registration shifts, chromatic/PSF/blend terms and any missing covariance. Do not double-apply cosδ or treat missing radial velocity as a verified zero.
- For known solar-system objects, compare predictions against an independent ephemeris with the same observer/time/frame. Keep light-time conventions and spacecraft ephemeris limits explicit. Requery if actual observation time/convention changes.
- Count flags on a clearly defined native pixel window. State fractional/rounded center, radius/shape, included and clipped pixels, bit overlap and declared definitions. Do not interpolate integer FLAGS or classify all SOURCE pixels as bad.

## If making a motion claim

Use suitable reference-star registration and actual target position/error estimation; check both target positions in both epochs with coverage/sensitivity/blending conditions. Test the stated stationary/parallax-only null separately from agreement with a predicted vector. Account for registration/centroid/chromatic terms without double counting. Set acceptance criteria from validated uncertainties and controls, not from a preferred outcome or a nominal pixel budget.

A prediction near a bright pixel, a SOURCE mask shift, or a two-frame blink is insufficient for a validated motion claim. Missing coverage/poor quality is not a physical non-detection. If these steps are not executed, report the actual prediction/quality check and unresolved status.

## Result

Record input/version IDs, independent reference, expected and computed values, uncertainty/acceptance basis, actual test outcome and limits in the work log/E2 evidence. When a change fails, retain the raw evidence and narrow the cause before modifying a scientific threshold.


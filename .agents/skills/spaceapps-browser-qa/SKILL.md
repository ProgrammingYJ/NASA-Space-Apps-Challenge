---
name: spaceapps-browser-qa
description: Exercise the implemented Planet X observation workflow in a real browser, including selection synchronization, quality states, five-language UI and evidence restoration. Use after a runnable slice changes; it does not require unimplemented later phases to exist.
---

# Browser workflow QA

Read the implemented slice, [FSD.md](../../../FSD.md), and [design contract](../../../docs/design_references.md). Keep the FSD's implementation/verification status current with actual results. Use an available browser tool or the project's actual Playwright tests. A successful build or a screenshot alone is not proof of a working interaction. Record a blocked browser run honestly.

## Select the right scope

- Early slice: ε Indi B actual frame/metadata → purpose-specific quality → evidence save/export → new-session restore. Inspect the official5 target routes/statuses as implemented.
- Once the relevant stages exist: 3D → Pluto → real exposures → individual hypothetical path → separate literature density → evidence save/restore.
- Exercise only implemented stages and list later stages as not implemented. Do not make3D or advanced inference a new prerequisite for the first observation slice.

## Exercise

1. Record URL/build, browser/viewport, data/version IDs and starting input. Define expected behavior from the contract before clicking.
2. Select object/coordinate, actual exposure date/wavelength and frame. Check that all panels/graph points use the same object/observation IDs and metadata. Model time/free camera must remain distinguishable from acquisition time/observer.
3. Change selections quickly to inspect stale responses, empty observations, quality exclusions and archive errors. Check pause/resume/blink/zoom and only the quantitative features actually implemented. Display contrast changes must not modify scientific values.
4. For a completed hypothesis slice, change one scenario parameter and verify that its path updates while the independent literature layer keeps its declared conditions/epoch. Inspect units/legend and absence of invented existence percentages.
5. Save with raw IDs/SHA/settings/model/mask/version/assessment. Start a clean session, restore and compare the scientific state and result IDs. Different versions must be explicit rather than silently replaced.
6. Switch ko/en/ja/zh-Hant/fr across input, status, condition, error and verification states. Check missing keys, Traditional Chinese fallback, meaning/units, overflow and keyboard/visible focus. Do not claim native-language review without reviewers.

## Evidence

For each relevant step write input, expected, actual, pass/fail/not-run and evidence location, including useful screenshots/console/network findings. Stop the transient browser test/service cleanly when appropriate. Re-run changed paths after fixes; do not expand into repeated full suites without a new failure or concern. No production upload, external message or account change is authorized by this skill.


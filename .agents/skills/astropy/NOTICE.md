# Upstream source and local integration — astropy

This is a project-local copy installed with the official Codex skill-installer helper. It does not connect external services, grant authority to message others or deploy, or verify any application/scientific result.

- Repository: https://github.com/K-Dense-AI/scientific-agent-skills
- Fixed commit: `2d2065fb4520fa3f3f2bcf61cff26ec8b7eba4b5`
- Original directory: `skills/astropy`
- Original SKILL.md: https://github.com/K-Dense-AI/scientific-agent-skills/blob/2d2065fb4520fa3f3f2bcf61cff26ec8b7eba4b5/skills/astropy/SKILL.md
- Original SKILL.md SHA256: `2f9d43ae65766a9715112e3b56cb83fb9c12e4e8b6356c0c4c22131c6cfa536f`
- Repository license text preserved verbatim in `LICENSE.upstream-repository.md`.
- Original copyright/attribution/license text is retained. No missing copyright holder or year has been inferred.

## Local modifications

- Move unsupported top-level metadata fields under metadata, preserving values.
- Add a prominent local-modification notice and link to provenance; user authorization and AGENTS.md take precedence.

## License declarations and review evidence

- The upstream repository license is MIT and contains the original `Copyright (c) 2025 K-Dense Inc.` notice. Its full text is retained verbatim.
- The original skill frontmatter separately declares `license: BSD-3-Clause license`; this declaration is preserved without replacing it with the repository license. No separate BSD license/copyright file exists in the selected upstream skill directory at the fixed commit. These two source declarations are recorded separately rather than represented as a new single license determination.
- Upstream version/review/execution claims belong to the upstream author. No Astropy package, scientific workflow, recipe or upstream test was executed during this installation.
- The upstream test mentioned by references/review.md is archived unchanged at references/upstream-tests/test_workflows.py; its original repository-relative code paths are unchanged and it is not an installed runnable test contract.

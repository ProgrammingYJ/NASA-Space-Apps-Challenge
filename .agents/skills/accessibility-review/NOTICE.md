# Upstream source and local integration — accessibility-review

This is a project-local copy installed with the official Codex skill-installer helper. It does not connect external services, grant authority to message others or deploy, or verify any application/scientific result.

- Repository: https://github.com/anthropics/knowledge-work-plugins
- Fixed commit: `e91a134584eb798bac7fb0379358006a2b63b965`
- Original directory: `design/skills/accessibility-review`
- Original SKILL.md: https://github.com/anthropics/knowledge-work-plugins/blob/e91a134584eb798bac7fb0379358006a2b63b965/design/skills/accessibility-review/SKILL.md
- Original SKILL.md SHA256: `ef42982af0d51238dda2ab16d08626712891bdd41864876c32d1e7b13fb3124f`
- Repository license text preserved verbatim in `LICENSE`.
- Original copyright/attribution/license text is retained. No missing copyright holder or year has been inferred.

## Local modifications

- Move unsupported top-level metadata fields under metadata, preserving values.
- Repair flat-install connector link from ../../CONNECTORS.md to references/CONNECTORS.md; copy plugin connector reference unchanged.
- Correct SC 2.5.5 to explicit optional Level AAA; retain 44x44 threshold and link the exceptions.
- Add a prominent local-modification notice and link to provenance; user authorization and AGENTS.md take precedence.
- references/CONNECTORS.md is the original plugin reference; names in its table describe upstream plugin examples and are not assertions that those connectors are installed here.

SC 2.5.5's Level AAA and exception wording was checked against the [W3C explanation](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html); this does not claim that a page has passed an accessibility audit.

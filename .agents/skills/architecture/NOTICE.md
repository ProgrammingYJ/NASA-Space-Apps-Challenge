# Upstream source and local integration — architecture

This is a project-local copy installed with the official Codex skill-installer helper. It does not connect external services, grant authority to message others or deploy, or verify any application/scientific result.

- Repository: https://github.com/anthropics/knowledge-work-plugins
- Fixed commit: `e91a134584eb798bac7fb0379358006a2b63b965`
- Original directory: `engineering/skills/architecture`
- Original SKILL.md: https://github.com/anthropics/knowledge-work-plugins/blob/e91a134584eb798bac7fb0379358006a2b63b965/engineering/skills/architecture/SKILL.md
- Original SKILL.md SHA256: `de7db3170a3ae1a894c70ef6cb555fe15618ed9b9674d20895eda3d2a0a5f9a2`
- Repository license text preserved verbatim in `LICENSE`.
- Original copyright/attribution/license text is retained. No missing copyright holder or year has been inferred.

## Local modifications

- Move unsupported top-level metadata fields under metadata, preserving values.
- Repair flat-install connector link from ../../CONNECTORS.md to references/CONNECTORS.md; copy plugin connector reference unchanged.
- Add a prominent local-modification notice and link to provenance; user authorization and AGENTS.md take precedence.
- references/CONNECTORS.md is the original plugin reference; names in its table describe upstream plugin examples and are not assertions that those connectors are installed here.

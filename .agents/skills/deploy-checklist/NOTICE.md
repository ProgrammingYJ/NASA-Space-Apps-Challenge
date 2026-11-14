# Upstream source and local integration — deploy-checklist

This is a project-local copy installed with the official Codex skill-installer helper. It does not connect external services, grant authority to message others or deploy, or verify any application/scientific result.

- Repository: https://github.com/anthropics/knowledge-work-plugins
- Fixed commit: `e91a134584eb798bac7fb0379358006a2b63b965`
- Original directory: `engineering/skills/deploy-checklist`
- Original SKILL.md: https://github.com/anthropics/knowledge-work-plugins/blob/e91a134584eb798bac7fb0379358006a2b63b965/engineering/skills/deploy-checklist/SKILL.md
- Original SKILL.md SHA256: `85ca53dc471970e3e12c36ec814ebf5f6cb9419016c55adb05ff34789bae3be9`
- Repository license text preserved verbatim in `LICENSE`.
- Original copyright/attribution/license text is retained. No missing copyright holder or year has been inferred.

## Local modifications

- Move unsupported top-level metadata fields under metadata, preserving values.
- Repair flat-install connector link from ../../CONNECTORS.md to references/CONNECTORS.md; copy plugin connector reference unchanged.
- Add a prominent local-modification notice and link to provenance; user authorization and AGENTS.md take precedence.
- references/CONNECTORS.md is the original plugin reference; names in its table describe upstream plugin examples and are not assertions that those connectors are installed here.

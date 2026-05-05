# Sub-Agents (reserved for v2)

This folder is intentionally empty in v1.

In v2 we may add custom Claude Code sub-agents here — for example:

- **`brand-researcher.md`** — a focused sub-agent invoked in parallel to scrape multiple sources (FB + IG + website) simultaneously instead of cascading sequentially.
- **`canva-editor.md`** — a sub-agent dedicated to Canva editing-transactions, isolating retries and error handling for the responsive-page logo-insertion edge case.
- **`copy-translator.md`** — sub-agent for translating headlines between Hebrew and English when bilingual brands request both versions.

For now, the `/banner-create` workflow is sequential and runs entirely in the main session. See `CLAUDE.md` for the orchestration logic and `.claude/skills/` for the per-skill instructions.

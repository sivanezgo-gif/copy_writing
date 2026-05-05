---
description: Generate a banner (310×600) and header (1366×200) for a new EzGo customer via the Canva MCP. Pass the customer URL as the argument.
argument-hint: "<customer-url>"
---

Start the Banner & Header Generation workflow for the customer at: **$ARGUMENTS**

Read `CLAUDE.md` first for shared rules (initialization, error handling, Hebrew UI strings, default decisions). Then execute the four skills in order, halting at every approval checkpoint:

1. **Initialization** (per CLAUDE.md → "Initialization") — verify Python deps; generate session ID `YYYYMMDD-business-slug`; create `.claude/state/[session-id]/`. Handle folder collisions.
2. **SKILL 1 — Brand Intelligence** → `.claude/skills/brand-intelligence/SKILL.md`. Cascade website → Facebook → Instagram → manual. Write `brand_profile.json`. Get user approval.
3. **SKILL 2 — Logo Resolution** → `.claude/skills/logo-resolution/SKILL.md`. Branch A (use existing) or Branch B (generate 3 via `.claude/skills/logo-resolution/logo.prompt.md`). Upload to Canva; record `canva_asset_id`.
4. **SKILL 3 — Copywriting** → `.claude/skills/copywriting/SKILL.md`. Generate 3 styles. User picks 1. Write `chosen_copy.json`.
5. **SKILL 4 — Canva Design** → `.claude/skills/canva-design/SKILL.md`. Use `banner.prompt.md` and `header.prompt.md` co-located in the skill folder. 3 banners → user picks 1 → insert logo → 3 headers → user picks 1 → apply RTL `find-and-replace-text` for Hebrew.
6. **Delivery** — present both Canva URLs in Hebrew with the `Share → Download → PNG` instruction (use the "Final delivery" string from `CLAUDE.md` → "Hebrew UI Strings").

If `$ARGUMENTS` is empty, ask the user for the customer URL before proceeding.

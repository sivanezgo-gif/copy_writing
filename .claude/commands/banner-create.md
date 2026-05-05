---
description: Generate a banner (310×600) and header (1366×200) for a new EzGo customer via the Canva MCP. Pass the customer URL as the argument.
argument-hint: "<customer-url>"
---

Start the Banner & Header Generation workflow defined in `CLAUDE.md` for the customer at: **$ARGUMENTS**

Execute the skills in order, halting at every approval checkpoint:

1. **Initialization** — verify Python deps are installed (`pip install --break-system-packages Pillow colorthief beautifulsoup4 lxml cairosvg`); generate the session ID `YYYYMMDD-business-slug`; create `.claude/state/[session-id]/`. If a folder with the same slug already exists, ask the user whether to overwrite or pick a new slug.
2. **SKILL 1 — Brand Intelligence** — cascade: website → Facebook → Instagram → manual interview. Write `brand_profile.json`. Get user approval.
3. **SKILL 2 — Logo Resolution** — Branch A (use existing) or Branch B (generate 3 variants). Upload chosen logo to Canva via `upload-asset-from-url`; record `canva_asset_id`.
4. **SKILL 3 — Copywriting** — generate 3 styles (direct / emotional / adventurous). User picks 1. Write `chosen_copy.json`.
5. **SKILL 4 — Canva Design** — generate 3 banner variants → user picks 1 → insert logo (if available) → generate 3 header variants → user picks 1 → apply RTL `find-and-replace-text` for Hebrew.
6. **Delivery** — present both Canva design URLs in Hebrew with the `Share → Download → PNG` instruction.

All Hebrew UI strings to use are listed in the **Hebrew UI Strings** section of `CLAUDE.md`. All error-handling rules are in the **Error Handling** section.

If `$ARGUMENTS` is empty, ask the user for the customer URL before proceeding.

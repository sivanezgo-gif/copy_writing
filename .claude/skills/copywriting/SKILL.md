---
name: copywriting
description: Generates 3 stylistically distinct headlines (direct / emotional / adventurous) in the brand's language, presents them to the user, and writes the chosen one to chosen_copy.json. Used by SKILL 3 of the /banner-create workflow. Output conforms to docs/schemas/chosen_copy.schema.json.
---

# SKILL 3 — Copywriting

**Goal:** Produce `chosen_copy.json` matching `docs/schemas/chosen_copy.schema.json`.

## Input

- `.claude/state/[session-id]/brand_profile.json` (from SKILL 1) — for `business_name`, `business_type`, `language`, `tone`, `target_audience`.

## Steps

1. **Generate 3 headlines** in 3 distinct styles (always exactly 3, in this order):
   - **Direct** — short, action-oriented (e.g., "הזמינו חוויה ימית" / "Book your stay")
   - **Emotional** — sensory, evocative (e.g., "הים מחכה לכם" / "Where memories begin")
   - **Adventurous** — bold, motion (e.g., "Set Sail. Discover. Repeat.")
   - Each: 4–8 words, minimal punctuation, in `brand_profile.language`.
2. ✋ **Approval checkpoint.** Use `AskUserQuestion` with the 3 variants as options + a 4th option `"הצג 3 חדשות"` to regenerate. Title: `"בחרי כותרת:"`.
3. On selection, write `chosen_copy.json`:
   ```json
   {
     "schema_version": "1.0",
     "session_id": "...",
     "headline": "<chosen text>",
     "language": "he | en",
     "direction": "rtl | ltr",
     "style": "direct | emotional | adventurous",
     "rejected_alternatives": ["<other 1>", "<other 2>"]
   }
   ```
4. `direction` is derived: `he` → `rtl`, `en` → `ltr`. SKILL 4 needs this for the placeholder strategy.

## Regeneration policy

If the user picks `"הצג 3 חדשות"`, generate 3 fresh variants. Up to 3 cycles total before suggesting the user revisit `tone` / `target_audience` in `brand_profile.json`.

## Tools

- `Read` — `brand_profile.json`.
- `Write` — `chosen_copy.json`.
- `AskUserQuestion` — selection and regenerate.

## Hand-off

SKILL 4 reads `chosen_copy.json` to drive the banner/header prompt construction. The `direction` field controls whether the RTL placeholder strategy is applied.

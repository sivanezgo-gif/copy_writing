---
name: logo-resolution
description: Resolves the customer's logo for use in the banner. Either uploads an existing logo found in SKILL 1 to Canva (Branch A), or generates 3 new logo variants via Canva generate-design and lets the user pick (Branch B). Used by SKILL 2 of the /banner-create workflow. Records canva_asset_id in brand_profile.json.
---

# SKILL 2 — Logo Resolution

**Goal:** Have a logo (or an explicit "no logo" decision) uploaded to Canva, with `canva_asset_id` recorded in `brand_profile.json`.

## Branch decision

Read `brand_profile.logo`. **Branch A** if `found == true` AND quality threshold met. **Branch B** otherwise.

## Quality threshold (Branch A eligibility)

A logo is **usable** if all are true:
- Format is SVG, PNG, or JPG (convert WebP → PNG via Pillow first; SVG can also be converted via cairosvg if needed but Canva accepts SVG directly).
- For raster: shorter side ≥ 200 px.
- For PNG: alpha channel present, OR background is solid white (verify by checking corner pixels with Pillow).

If between 100–200 px or no alpha → **borderline**. Ask the user:
> "מצאתי לוגו [size]px [format]. רוצה להשתמש בו או שאיצור חדש?"

Options: `[להשתמש בקיים / לייצר חדש / להציג תצוגה מקדימה]`.

## Branch A — Use existing

1. Call Canva `upload-asset-from-url` with the logo's local file path or original URL.
2. Store the returned `asset_id` in `brand_profile.json` under `logo.canva_asset_id`. Set `logo.fallback_used = false`, `logo.generated = false`.
3. Done. Proceed to SKILL 3.

## Branch B — Generate new

1. Read the three prompt variants from `.claude/skills/logo-resolution/logo.prompt.md` and substitute variables from `brand_profile`.
2. Call Canva `generate-design` three times **in parallel** with `design_type: 'logo'`, one per variant.
3. ✋ **Approval checkpoint.** Present the 3 candidates with their preview URLs. Use `AskUserQuestion` with options:
   - `בחירת V1 (מינימליסטי)`
   - `בחירת V2 (אמבלם)`
   - `בחירת V3 (טיפוגרפי)`
   - `נסה שוב 3 חדשים` (regenerate; max 3 cycles total)
   - `ללא לוגו`
4. **If user picks a variant:** call Canva `create-design-from-candidate`, then download the rendered logo to `.claude/state/[session-id]/logo.png`, then `upload-asset-from-url` to register it as an asset, store `canva_asset_id`. Set `logo.generated = true`.
5. **If user picks "ללא לוגו" (or rejects all 3 cycles):** set `logo.skipped = true` in `brand_profile.json`. Tell the user:
   > "ממשיכים בלי לוגו. הבאנר יתבסס על טקסט ורקע בלבד. תמיד אפשר להוסיף לוגו ידנית בקאנבה אחר כך."
6. Update `brand_profile.json` and proceed.

## Tools

- Canva MCP: `upload-asset-from-url`, `generate-design`, `create-design-from-candidate`.
- `Bash` — Pillow conversion (WebP→PNG), corner-pixel check for transparency.
- `Edit` — patching `brand_profile.json` with the new `logo.canva_asset_id` / flags.
- `AskUserQuestion` — borderline-quality and Branch B selection.

## Hand-off

`brand_profile.json` now has either a valid `logo.canva_asset_id` or `logo.skipped == true`. SKILL 3 doesn't read these — they only matter for SKILL 4's logo-insertion step.

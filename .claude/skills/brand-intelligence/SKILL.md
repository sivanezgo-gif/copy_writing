---
name: brand-intelligence
description: Extracts a complete brand profile (name, colors, logo, tone, language) from a customer URL. Cascades through customer website → Facebook → Instagram → manual interview. Used by SKILL 1 of the /banner-create workflow. Writes brand_profile.json conforming to docs/schemas/brand_profile.schema.json.
---

# SKILL 1 — Brand Intelligence

**Goal:** Produce a complete `brand_profile.json` matching `docs/schemas/brand_profile.schema.json`.

**Input:** The URL passed to `/banner-create`.

**Output:** `.claude/state/[session-id]/brand_profile.json` + optionally `logo.png` if a logo was extracted.

## Cascade Order

Try sources in this order; stop at the first that yields **enough data** (business name + at least one of [colors, logo, tone]):

1. **Customer website** (`WebFetch` on the input URL)
2. **Facebook** (`WebSearch` for `"<business name>" facebook`, then `WebFetch` the FB page)
3. **Instagram** (same pattern)
4. **Manual interview** with the user via `AskUserQuestion`

## Step-by-step

1. **Fetch the website.** Use `WebFetch`. On 403/429/503/Cloudflare challenge, do NOT retry — move directly to Facebook. On 5xx or timeout, retry once after 5–10s, then move on.
2. **Parse HTML** via a short Python snippet using BeautifulSoup. Extract:
   - `<title>` and OG title → candidate business name
   - `<meta property="og:image">` → OG image URL
   - `<link rel="icon">`, `<link rel="apple-touch-icon">`, and any `<img>` whose src contains "logo" → logo candidates
   - `<html lang="...">` → language hint
   - `<meta name="theme-color">` → candidate primary color
   - First few `font-family` declarations from inline style or first stylesheet → fonts
3. **Validate logo candidates' domain** matches the input URL's domain (avoid picking competitors' logos). Pick the largest non-favicon if multiple.
4. **Download the OG image and the chosen logo** to `.claude/state/[session-id]/`. Convert WebP → PNG via Pillow if needed.
5. **Extract colors** with colorthief (5-color palette from OG image; separately from logo if available). Cross-reference: if logo colors and OG image colors share a hue, that's the primary. If only OG image is available and the dominant color matches a "generic background" (sky blue, ocean blue, generic green, sand), flag `colors.needs_user_confirmation = true` and ask the user (default per CLAUDE.md → Default Decisions Q1: option (a)).
6. **Determine language**: Hebrew text in title/h1 → `language: "he"`, `direction: "rtl"`. Otherwise `"en"` / `"ltr"`. If unclear, ask.
7. **Infer tone** from copywriting on the page (one short phrase, free-form). If nothing distinctive, leave `null`.
8. **If website failed or returned partial data** (missing colors AND tone), continue to Facebook → Instagram.
9. **Manual interview fallback** — only ask for the gaps. Use `AskUserQuestion` per missing field. Do not re-ask anything already extracted.
10. **Build `background_proposal`** based on what you have: image-style description if you saw rich photography, gradient if only colors are confident, solid as last resort.
11. **Write `brand_profile.json`** conforming to `docs/schemas/brand_profile.schema.json`. Required fields must always be present (use `null` for missing optional fields, never omit keys).
12. ✋ **Approval checkpoint.** Present a Hebrew summary:
    > "מצאתי:
    > • שם עסק: [name]
    > • צבע ראשי: [hex]
    > • לוגו: [פורמט / לא נמצא]
    > • טון: [tone]
    > • שפה: [he/en]
    > מאשרת להמשיך לשלב הלוגו?"

    Use `AskUserQuestion` with options `[לאשר ולהמשיך / לתקן / לבטל]`. If "לתקן", ask which field, update `brand_profile.json`, re-confirm.

## Tools

- `WebFetch`, `WebSearch` — primary research.
- `Bash` — running BeautifulSoup/colorthief Python snippets, downloading images.
- `Write` — persisting `brand_profile.json`.
- `AskUserQuestion` — gap-filling and final approval.

## Error Handling

See `CLAUDE.md` → **Error Handling** table for `WebFetch` retry policy and `colorthief` fallback. The cascade itself IS the error policy: if a source fails, the next one is tried.

## Hand-off

On approval, the next step is SKILL 2 (`logo-resolution`). The `brand_profile.json` is the only artifact passed forward; SKILL 2 reads `brand_profile.logo` to decide between Branch A (use existing) and Branch B (generate).

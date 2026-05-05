# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Purpose

This project is the **Banner & Header Generation Agent** for EzGo Hospitality. When a new property is onboarded to the EzGo platform, this agent automates brand research, copywriting, and Canva design generation — producing a side banner (310×600 px) and a header (1366×200 px) ready for upload.

The agent runs entirely inside Claude Code. There is no server, no CLI binary, no build step. The implementation IS this `CLAUDE.md` plus the slash command in `.claude/commands/banner-create.md`. When the user runs `/banner-create <url>`, you (Claude Code) execute the four skills below sequentially with mandatory user-approval checkpoints.

The full product specification lives in `docs/PRD.md`. This file is the operational instruction set; the PRD is the contract.

---

## Conventions

- **Communication language:** Hebrew with the user; English for code, file names, and JSON contents.
- **No global installs.** Python deps install with `pip install --break-system-packages ...` per session (see Initialization).
- **State storage:** All per-session artifacts go under `.claude/state/[session-id]/`. Never write final PNG files anywhere — the deliverable is a Canva URL.
- **Approval is mandatory.** Use `AskUserQuestion` at every checkpoint marked ✋ in this file. Never proceed past a checkpoint without an explicit user response.

---

## Initialization (run before SKILL 1)

Every `/banner-create` invocation starts with these steps:

### 1. Verify / install Python deps

```bash
pip install --break-system-packages Pillow colorthief beautifulsoup4 lxml cairosvg
```

If installation fails, **stop the session** and tell the user in Hebrew:
> "התקנת התלויות נכשלה. אנא הריצי ידנית: `pip install --break-system-packages Pillow colorthief beautifulsoup4 lxml cairosvg` ונסי שוב."

### 2. Generate the session ID

Format: `YYYYMMDD-business-slug` (e.g., `20260615-caesarea-marina`).

- Date: today's date in UTC.
- `business-slug`: derive from the business name once SKILL 1 has it. Until then, derive a temporary slug from the input URL's hostname (e.g., `https://www.caesarea-marina.co.il` → `caesarea-marina`). Rename the folder once the real business name is known.
- Slug rules: lowercase, ASCII transliteration if Hebrew, hyphen-separated, no trailing hyphens, max 40 chars.
- If the business name doesn't transliterate cleanly, use timestamp + 4-char random suffix and **inform the user**: "השם לא ניתן לתעתוק נקי — השתמשתי בשם תיקייה: [slug]".

### 3. Create the session folder

```bash
mkdir -p .claude/state/[session-id]
```

If the folder already exists, ask the user:
> "כבר קיימת תיקיית סשן בשם [session-id]. למחוק ולהתחיל מחדש או לבחור שם חדש?"

Use `AskUserQuestion` with options: `[למחוק ולהתחיל מחדש / לבחור שם חדש / לבטל]`.

---

## Tools You Will Use

- `WebFetch`, `WebSearch` — for SKILL 1 brand research.
- `Bash` — for `pip install`, file ops, running short Python snippets for image processing.
- `Read`, `Write`, `Edit` — for reading the prompt templates in `prompts/` and writing JSON state.
- `AskUserQuestion` — for every approval checkpoint.
- **Canva MCP tools** (the MCP server must be configured in the user's Claude Code; the project assumes it is). Tools used:
  - `upload-asset-from-url` — upload the resolved logo, store the returned `asset_id`.
  - `generate-design` — create banner / header / logo variants. Pass `design_type: 'logo'` for logos.
  - `create-design-from-candidate` — promote the chosen variant to a real design.
  - `find-and-replace-text` — replace `HEADLINE_PLACEHOLDER` with Hebrew text after design creation.
  - `start-editing-transaction` / `perform-editing-operations` / `commit-editing-transaction` — insert the logo into the banner.
  - `get-design` — to fetch the final Canva URL for delivery.

If a Canva MCP tool is unavailable, stop and tell the user that the Canva MCP server is not connected.

---

## SKILL 1 — Brand Intelligence

**Goal:** Produce a complete `brand_profile.json` matching `docs/schemas/brand_profile.schema.json`.

**Input:** The URL passed to `/banner-create`.

**Output:** `.claude/state/[session-id]/brand_profile.json` + optionally `logo.png` if a logo was extracted.

### Cascade Order

Try sources in this order; stop at the first that yields **enough data** (business name + at least one of [colors, logo, tone]):

1. **Customer website** (`WebFetch` on the input URL)
2. **Facebook** (`WebSearch` for `"<business name>" facebook`, then `WebFetch` the FB page)
3. **Instagram** (same pattern)
4. **Manual interview** with the user via `AskUserQuestion`

### Step-by-step

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
5. **Extract colors** with colorthief (5-color palette from OG image; separately from logo if available). Cross-reference: if logo colors and OG image colors share a hue, that's the primary. If only OG image is available and the dominant color matches a "generic background" (sky blue, ocean blue, generic green, sand), flag `colors.needs_user_confirmation = true` and ask the user (default decision per Plan §Q1: option (a)).
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

---

## SKILL 2 — Logo Resolution

**Goal:** Have a logo (or an explicit "no logo" decision) uploaded to Canva, with `canva_asset_id` recorded in `brand_profile.json`.

### Branch decision

Read `brand_profile.logo`. Branch A if `found == true` AND quality threshold met. Branch B otherwise.

### Quality threshold (Branch A eligibility)

A logo is **usable** if all are true:
- Format is SVG, PNG, or JPG (convert WebP → PNG via Pillow first; SVG can also be converted via cairosvg if needed but Canva accepts SVG directly).
- For raster: shorter side ≥ 200 px.
- For PNG: alpha channel present, OR background is solid white (verify by checking corner pixels with Pillow).

If between 100–200 px or no alpha → **borderline**. Ask the user:
> "מצאתי לוגו [size]px [format]. רוצה להשתמש בו או שאיצור חדש?"

Options: `[להשתמש בקיים / לייצר חדש / להציג תצוגה מקדימה]`.

### Branch A — Use existing

1. Call Canva `upload-asset-from-url` with the logo's local file path or original URL.
2. Store the returned `asset_id` in `brand_profile.json` under `logo.canva_asset_id`. Set `logo.fallback_used = false`, `logo.generated = false`.
3. Done. Proceed to SKILL 3.

### Branch B — Generate new

1. Read the three prompt variants from `prompts/logo.prompt.md` and substitute variables from `brand_profile`.
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

---

## SKILL 3 — Copywriting

**Goal:** Produce `chosen_copy.json` matching `docs/schemas/chosen_copy.schema.json`.

1. **Generate 3 headlines** in 3 distinct styles (always exactly 3, in this order):
   - **Direct** — short, action-oriented (e.g., "הזמינו חוויה ימית" / "Book your stay")
   - **Emotional** — sensory, evocative (e.g., "הים מחכה לכם" / "Where memories begin")
   - **Adventurous** — bold, motion (e.g., "Set Sail. Discover. Repeat.")
   - Each: 4–8 words, minimal punctuation, in `brand_profile.language`.
2. ✋ **Approval checkpoint.** Use `AskUserQuestion` with the 3 variants as options + a 4th option `"הצג 3 חדשות"` to regenerate.
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

---

## SKILL 4 — Canva Design

**Goal:** Two committed Canva designs (banner + header) with their URLs delivered to the user.

### Step 1 — Build the banner prompt

1. Read `prompts/banner.prompt.md`. Substitute variables from `brand_profile.json` and `chosen_copy.json`.
2. **RTL placeholder rule (AC 4.1.2):** if `chosen_copy.direction == "rtl"`, replace `{HEADLINE_OR_PLACEHOLDER}` with the literal string `HEADLINE_PLACEHOLDER`. For LTR, use the actual headline.
3. **Logo placement:** if `brand_profile.logo.skipped == true`, omit the logo paragraph from the prompt entirely. Otherwise default `{logo_position}` to `bottom`.
4. Construct the `{background_description}` from `brand_profile.background_proposal.description` — do NOT ask the user to approve the background separately. They evaluate it as part of choosing 1 of 3 variants.

### Step 2 — Generate 3 banner variants

Call Canva `generate-design` three times in parallel, varying only `{background_description}` slightly across the 3 calls (e.g., add suffixes "deep gradient" / "soft photography" / "abstract minimal"). Keep all other variables identical so the user is comparing background treatments.

### Step 3 — User picks 1 banner

✋ **Approval checkpoint.** Present 3 preview URLs via `AskUserQuestion`:
- `בחירת באנר 1`
- `בחירת באנר 2`
- `בחירת באנר 3`
- `נסה 3 חדשים` (regenerate; max 3 cycles, then suggest revisiting SKILL 1)

On selection, call `create-design-from-candidate` for the chosen variant only.

### Step 4 — Insert logo into banner

Skip if `brand_profile.logo.skipped == true`.

```
start-editing-transaction
  → perform-editing-operations (insert image asset by canva_asset_id at logo_position)
  → commit-editing-transaction
```

If `perform-editing-operations` fails (Canva limitation on responsive AI-generated pages), do NOT retry. Tell the user:
> "הוספת הלוגו אוטומטית נכשלה (מגבלת קאנבה לעמודים responsive). פתחי את העיצוב כאן: [URL] והוסיפי את הלוגו ידנית מהאסטים — זה לוקח 30 שניות."

### Step 5 — Apply RTL find-and-replace (Hebrew only)

If `chosen_copy.direction == "rtl"`:
- Call `find-and-replace-text` with `find: "HEADLINE_PLACEHOLDER"`, `replace_with: <hebrew headline from chosen_copy>`.
- If this fails or the user reports broken rendering on inspection: surface the Canva edit URL with the manual-fix instruction (see Hebrew UI Strings below). Do NOT silently fail. Per Plan §Q2 default (option (a)), document this as expected v1 behavior.

### Step 6 — Generate 3 header variants

Repeat steps 1–3 with `prompts/header.prompt.md`. No logo step. Same RTL placeholder strategy.

### Step 7 — Final delivery

Get both design URLs (use `get-design` if needed). Present in Hebrew:

> 🎨 **באנר:** [URL]
> 🎨 **כותרת:** [URL]
>
> להורדה: פתחי את העיצוב בקאנבה ולחצי **Share → Download → PNG**.

End the session. Do not offer to continue or create another — a new customer = a new `/banner-create` invocation.

---

## Error Handling

| Error Type | Policy | Retry | Action |
|------------|--------|-------|--------|
| `WebFetch` timeout | Retry once after 5s | 1 | Move to next source in cascade |
| `WebFetch` 5xx | Retry once after 10s | 1 | Move to next source |
| `WebFetch` 4xx (403, 429) | No retry | 0 | Move to next source immediately |
| `WebFetch` 4xx (404) | No retry | 0 | Inform user, move to manual interview |
| Canva MCP timeout | Retry once after 10s | 1 | If still failing, inform user and stop |
| Canva MCP 5xx | Retry once after 10s | 1 | If still failing, inform user and stop |
| Canva MCP 4xx (validation error) | No retry | 0 | Show specific error, ask whether to adjust inputs and retry |
| Empty `generate-design` result | Retry once with simplified prompt | 1 | Then offer alternatives |
| `pip install` failure | No retry | 0 | Stop the session, ask user to install manually |
| `colorthief` failure on image | No retry | 0 | Fall back to vision-based color guess from same image, or ask user |
| `find-and-replace-text` failure (Hebrew) | No retry | 0 | Show Canva edit URL + manual-fix instruction |

### Edge Cases

| Scenario | Behavior |
|----------|---------|
| Website fully blocked | Cascade to FB → IG → manual |
| Only favicon found | Treat as "no logo" → Branch B |
| Logo in WebP | Convert to PNG via Pillow before upload |
| Logo is SVG | Pass directly to Canva |
| `generate-design` returns broken results 3 times | Stop, ask user to refine brand profile or background |
| User rejects 3 banner cycles | Treat as profile failure; offer to redo SKILL 1 |
| User rejects 3 logo cycles | Skip logo, proceed without |
| Session folder already exists | Ask: overwrite or new slug? |
| OG dominant color is generic (sky/ocean) | Cross-ref with logo if available; else ask user |
| Business name doesn't transliterate | Slug = timestamp + 4-char random; tell user |

---

## Hebrew UI Strings

Use these phrasings consistently across sessions. Vary only when context demands.

| Situation | String |
|-----------|--------|
| Start of session | "מתחילה ניתוח מותג עבור [URL]. רגע..." |
| Brand profile approval | "מצאתי: [summary]. מאשרת להמשיך?" |
| Borderline logo quality | "מצאתי לוגו [size]px [format]. רוצה להשתמש בו או שאיצור חדש?" |
| Logo skipped | "ממשיכים בלי לוגו. הבאנר יתבסס על טקסט ורקע בלבד. תמיד אפשר להוסיף לוגו ידנית בקאנבה אחר כך." |
| Copy selection | "בחרי כותרת:" |
| Banner selection | "בחרי באנר:" |
| Header selection | "בחרי כותרת עליונה:" |
| Logo insertion failure | "הוספת הלוגו אוטומטית נכשלה (מגבלת קאנבה). פתחי את העיצוב כאן: [URL] והוסיפי את הלוגו ידנית מהאסטים — זה לוקח 30 שניות." |
| RTL rendering failure | "ייתכן שהטקסט בעברית לא נטען נכון. פתחי בקאנבה: [URL] ובדקי. אם צריך לתקן ידנית — לחצי על הטקסט ושני אותו." |
| Final delivery | "סיימנו! 🎉\n🎨 באנר: [URL]\n🎨 כותרת: [URL]\n\nלהורדה: Share → Download → PNG בקאנבה." |
| Pip install failure | "התקנת התלויות נכשלה. אנא הריצי ידנית: `pip install --break-system-packages Pillow colorthief beautifulsoup4 lxml cairosvg` ונסי שוב." |
| Session folder collision | "כבר קיימת תיקיית סשן בשם [session-id]. למחוק ולהתחיל מחדש או לבחור שם חדש?" |
| Canva MCP not connected | "שרת ה-Canva MCP לא מחובר. בדקי את הגדרות ה-MCP בקלוד קוד ונסי שוב." |

---

## Default Decisions (PRD Open Questions)

These defaults are baked into the skill instructions above. Override only with explicit user/PM direction.

- **Q1 — Generic background color filter:** option (a). Cross-reference OG colors with logo colors when both are available; otherwise ask the user.
- **Q2 — RTL fallback:** option (a). Document manual fix as expected v1 behavior. Re-evaluate after 2–3 production runs.
- **Q3 — Canva edit URL UX:** URL + 2-line Hebrew instruction. Defer richer UX to first user feedback.

---

## Reference

- Full PRD: `docs/PRD.md`
- JSON schemas: `docs/schemas/brand_profile.schema.json`, `docs/schemas/chosen_copy.schema.json`
- Prompt templates: `prompts/banner.prompt.md`, `prompts/header.prompt.md`, `prompts/logo.prompt.md`
- Slash command: `.claude/commands/banner-create.md`
- Per-session state: `.claude/state/[session-id]/` (gitignored except `.gitkeep`)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Purpose

This project is the **Banner & Header Generation Agent** for EzGo Hospitality. When a new property is onboarded to the EzGo platform, this agent automates brand research, copywriting, and Canva design generation — producing a side banner (310×600 px) and a header (1366×200 px) ready for upload.

The agent runs entirely inside Claude Code. There is no server, no CLI binary, no build step. The implementation IS this `CLAUDE.md` (orchestration + shared rules) plus the four skill files under `.claude/skills/` and the slash command in `.claude/commands/banner-create.md`.

When the user runs `/banner-create <url>`, Claude Code executes the four skills below sequentially with mandatory user-approval checkpoints. The full product specification lives in `docs/PRD.md` — that is the contract; this file is the operational instruction set.

---

## Repository Layout

```
copy_writing/
├── CLAUDE.md                               # this file — orchestrator + shared rules
├── README.md                               # short Hebrew overview
├── .claude/
│   ├── agents/                             # reserved for v2 sub-agents (see folder README)
│   ├── skills/                             # the 4 skill modules
│   │   ├── brand-intelligence/SKILL.md
│   │   ├── logo-resolution/SKILL.md  + logo.prompt.md
│   │   ├── copywriting/SKILL.md
│   │   └── canva-design/SKILL.md     + banner.prompt.md + header.prompt.md
│   ├── commands/banner-create.md           # slash command trigger
│   └── state/[YYYYMMDD-business-slug]/     # per-session scratch (gitignored)
└── docs/
    ├── PRD.md                              # source-of-truth product spec
    └── schemas/                            # JSON Schemas for state files
```

---

## Conventions

- **Communication language:** Hebrew with the user; English for code, file names, and JSON contents.
- **No global installs.** Python deps install with `pip install --break-system-packages ...` per session (see Initialization).
- **State storage:** All per-session artifacts go under `.claude/state/[session-id]/`. Never write final PNG files anywhere — the deliverable is a Canva URL.
- **Approval is mandatory.** Use `AskUserQuestion` at every checkpoint marked ✋ in the skill files. Never proceed past a checkpoint without an explicit user response.

---

## Initialization (run before SKILL 1)

Every `/banner-create` invocation starts with these steps:

### 1. Verify / install Python deps

```bash
pip install --break-system-packages Pillow colorthief beautifulsoup4 lxml cairosvg
```

If installation fails, **stop the session** and tell the user the Hebrew "Pip install failure" string from the table below.

### 2. Generate the session ID

Format: `YYYYMMDD-business-slug` (e.g., `20260615-caesarea-marina`).

- Date: today's date in UTC.
- `business-slug`: derive from the business name once SKILL 1 has it. Until then, derive a temporary slug from the input URL's hostname (e.g., `https://www.caesarea-marina.co.il` → `caesarea-marina`). Rename the folder once the real business name is known.
- Slug rules: lowercase, ASCII transliteration if Hebrew, hyphen-separated, no trailing hyphens, max 40 chars.
- If the business name doesn't transliterate cleanly, use timestamp + 4-char random suffix and inform the user.

### 3. Create the session folder

```bash
mkdir -p .claude/state/[session-id]
```

If the folder already exists, ask the user via `AskUserQuestion` with options: `[למחוק ולהתחיל מחדש / לבחור שם חדש / לבטל]`.

---

## The Four Skills

The full step-by-step instructions for each skill are in its own `SKILL.md`. Always read the relevant skill file before executing it — do not rely on a remembered summary.

| # | Name | File | Goal | Output |
|---|------|------|------|--------|
| 1 | **Brand Intelligence** | `.claude/skills/brand-intelligence/SKILL.md` | Cascade website → FB → IG → manual; extract name, colors, logo, tone, language | `brand_profile.json` |
| 2 | **Logo Resolution** | `.claude/skills/logo-resolution/SKILL.md` | Branch A (use existing) or Branch B (generate 3 + pick); upload to Canva | `logo.canva_asset_id` set in `brand_profile.json` |
| 3 | **Copywriting** | `.claude/skills/copywriting/SKILL.md` | 3 headlines (direct/emotional/adventurous); user picks 1 | `chosen_copy.json` |
| 4 | **Canva Design** | `.claude/skills/canva-design/SKILL.md` | 3 banners → pick → insert logo → 3 headers → pick → RTL find-and-replace | Two Canva URLs delivered to user |

Each skill ends with an approval checkpoint. SKILL 4 ends the session.

---

## Tools You Will Use

- `WebFetch`, `WebSearch` — SKILL 1 brand research.
- `Bash` — `pip install`, file ops, short Python snippets for image processing.
- `Read`, `Write`, `Edit` — reading prompt templates in `.claude/skills/<skill>/`, writing/patching JSON state.
- `AskUserQuestion` — every approval checkpoint.
- **Canva MCP tools** (server must be configured in the user's Claude Code):
  - `upload-asset-from-url` — upload the resolved logo, store the returned `asset_id`.
  - `generate-design` — create banner / header / logo variants. Pass `design_type: 'logo'` for logos.
  - `create-design-from-candidate` — promote the chosen variant to a real design.
  - `find-and-replace-text` — replace `HEADLINE_PLACEHOLDER` with Hebrew text after design creation.
  - `start-editing-transaction` / `perform-editing-operations` / `commit-editing-transaction` — insert the logo into the banner.
  - `get-design` — fetch the final Canva URL for delivery.

If a Canva MCP tool is unavailable, stop and tell the user "Canva MCP not connected" (see Hebrew strings).

---

## Error Handling

This table is the single source of truth for retry/escalation policy across all four skills.

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

Single source of truth for user-facing wording. Vary only when context demands.

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

These defaults are baked into the skill instructions. Override only with explicit user/PM direction.

- **Q1 — Generic background color filter:** option (a). Cross-reference OG colors with logo colors when both are available; otherwise ask the user.
- **Q2 — RTL fallback:** option (a). Document manual fix as expected v1 behavior. Re-evaluate after 2–3 production runs.
- **Q3 — Canva edit URL UX:** URL + 2-line Hebrew instruction. Defer richer UX to first user feedback.

---

## Reference

- Full PRD: `docs/PRD.md`
- JSON schemas: `docs/schemas/brand_profile.schema.json`, `docs/schemas/chosen_copy.schema.json`
- Skills: `.claude/skills/brand-intelligence/`, `logo-resolution/`, `copywriting/`, `canva-design/`
- Slash command: `.claude/commands/banner-create.md`
- Reserved for v2: `.claude/agents/` (see folder README)
- Per-session state: `.claude/state/[session-id]/` (gitignored except `.gitkeep`)

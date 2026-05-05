---
name: canva-design
description: Generates the final Canva designs — 3 banner variants (310x600, with logo) and 3 header variants (1366x200, no logo). Inserts the logo into the chosen banner via Canva editing transactions. Applies RTL find-and-replace for Hebrew. Used by SKILL 4 of the /banner-create workflow. Returns two Canva URLs to the user.
---

# SKILL 4 — Canva Design

**Goal:** Two committed Canva designs (banner + header) with their URLs delivered to the user.

## Input

- `.claude/state/[session-id]/brand_profile.json` (SKILL 1)
- `.claude/state/[session-id]/chosen_copy.json` (SKILL 3)
- `brand_profile.logo.canva_asset_id` (SKILL 2) — may be `null` if `logo.skipped == true`.

## Step 1 — Build the banner prompt

1. Read `.claude/skills/canva-design/banner.prompt.md`. Substitute variables from `brand_profile.json` and `chosen_copy.json`.
2. **RTL placeholder rule (PRD AC 4.1.2):** if `chosen_copy.direction == "rtl"`, replace `{HEADLINE_OR_PLACEHOLDER}` with the literal string `HEADLINE_PLACEHOLDER`. For LTR, use the actual headline.
3. **Logo placement:** if `brand_profile.logo.skipped == true`, omit the logo paragraph from the prompt entirely. Otherwise default `{logo_position}` to `bottom`.
4. Construct `{background_description}` from `brand_profile.background_proposal.description` — do NOT ask the user to approve the background separately. They evaluate it as part of choosing 1 of 3 variants.

## Step 2 — Generate 3 banner variants

Call Canva `generate-design` three times in parallel, varying only `{background_description}` slightly across the 3 calls (e.g., add suffixes "deep gradient" / "soft photography" / "abstract minimal"). Keep all other variables identical so the user is comparing background treatments.

## Step 3 — User picks 1 banner

✋ **Approval checkpoint.** Present 3 preview URLs via `AskUserQuestion` (title: `"בחרי באנר:"`):
- `בחירת באנר 1`
- `בחירת באנר 2`
- `בחירת באנר 3`
- `נסה 3 חדשים` (regenerate; max 3 cycles, then suggest revisiting SKILL 1)

On selection, call `create-design-from-candidate` for the chosen variant only.

## Step 4 — Insert logo into banner

Skip if `brand_profile.logo.skipped == true`.

```
start-editing-transaction
  → perform-editing-operations (insert image asset by canva_asset_id at logo_position)
  → commit-editing-transaction
```

If `perform-editing-operations` fails (Canva limitation on responsive AI-generated pages), do NOT retry. Tell the user:
> "הוספת הלוגו אוטומטית נכשלה (מגבלת קאנבה לעמודים responsive). פתחי את העיצוב כאן: [URL] והוסיפי את הלוגו ידנית מהאסטים — זה לוקח 30 שניות."

## Step 5 — Apply RTL find-and-replace (Hebrew only)

If `chosen_copy.direction == "rtl"`:
- Call `find-and-replace-text` with `find: "HEADLINE_PLACEHOLDER"`, `replace_with: <hebrew headline from chosen_copy>`.
- If this fails or the user reports broken rendering on inspection: surface the Canva edit URL with the manual-fix instruction (see Hebrew UI Strings in `CLAUDE.md`). Do NOT silently fail. Per Default Decisions Q2 (option (a)), document this as expected v1 behavior.

## Step 6 — Generate 3 header variants

Repeat steps 1–3 with `.claude/skills/canva-design/header.prompt.md`. No logo step. Same RTL placeholder strategy. Title for the AskUserQuestion: `"בחרי כותרת עליונה:"`.

## Step 7 — Final delivery

Get both design URLs (use `get-design` if needed). Present in Hebrew:

> 🎨 **באנר:** [URL]
> 🎨 **כותרת:** [URL]
>
> להורדה: פתחי את העיצוב בקאנבה ולחצי **Share → Download → PNG**.

End the session. Do not offer to continue or create another — a new customer = a new `/banner-create` invocation.

## Tools

- Canva MCP: `generate-design`, `create-design-from-candidate`, `start-editing-transaction`, `perform-editing-operations`, `commit-editing-transaction`, `find-and-replace-text`, `get-design`.
- `Read` — `brand_profile.json`, `chosen_copy.json`, the two prompt templates.
- `AskUserQuestion` — banner selection, header selection.

## Co-located prompt files

- `banner.prompt.md` — banner template (310×600).
- `header.prompt.md` — header template (1366×200).

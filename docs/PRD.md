# PRD — Banner & Header Generation Agent
**EzGo Hospitality · Claude Code Agent**
Version 2.0 | May 2026

---

## 1. Overview

### Problem
Every new property added to the EzGo platform requires manual design of a side banner and header in Canva. The process — brand research, copywriting, design, PNG export, manual upload — currently takes 30–60 minutes per customer and depends entirely on the operations manager's manual work.

### Solution
A Claude Code agent running in VS Code that automates brand research, copywriting, and design generation through the Canva MCP. The agent operates with mandatory human approval checkpoints before every irreversible step.

### In Scope (v1)
- Automated brand research with manual interview fallback
- Logo resolution (extracted from web or generated)
- Copywriting in 3 stylistic variants
- Banner (310×600) + header (1366×200) generation in Canva
- Design URL handoff to user (downloads happen inside Canva)

### Out of Scope (v1)
- Auto-upload to EzGo platform (user uploads manually from Canva)
- Cross-customer memory or brand profile reuse
- HelpDesk integration
- Edit cycles after final export (user continues manually in Canva)
- Local persistent storage of final PNGs (only design URL is preserved)
- SLA / time targets (quality > speed)

---

## 2. Users & Context

### Actors

| Actor | Role | Responsibilities |
|-------|------|-----------------|
| **Operations Manager** | Primary user | Initiates the workflow, approves checkpoints, performs final design touches in Canva if needed |
| **Product Manager** | Decision-maker | Makes brand-related decisions when fallbacks/conflicts arise (e.g., color choice, when to use generated logo) |

### Environment
- **Platform:** Claude Code in VS Code
- **Interface language:** Hebrew (UI prompts to user); English for internal data/code
- **Trigger:** New customer onboarding to the EzGo platform
- **Frequency:** Per-customer (sporadic, on-demand)

### Trust Boundary
- User input (URL, manual interview answers): **trusted**
- Fetched web content (HTML, images): **untrusted in the security sense**, but no automated mitigations are required in v1 (single internal user, low risk surface)
- Note for future: if the agent expands to external/unauthenticated users, fetched content must be sanitized before being interpolated into prompts

---

## 3. Output Specification

| Asset | Dimensions | Logo | Text language |
|-------|-----------|------|---------------|
| Side banner | 310 × 600 px (portrait) | ✅ included | Hebrew or English (per brand) |
| Header | 1366 × 200 px (landscape) | ❌ excluded | Hebrew or English (per brand) |

**Format:** PNG
**Quantity:** Always two files together (one banner + one header)
**Variations:** 3 variants per asset, user selects 1 of 3 before final commit
**Final delivery:** Canva design URL (user downloads PNG from Canva interface)

---

## 4. Architecture

### Implementation Pattern
The agent is implemented as a **single CLAUDE.md file** in the project root, structured into 4 logical skill sections, with **slash commands** as triggers for the workflow. This is the simplest pattern that fits Claude Code's capabilities and the workflow's linear nature.

### File Structure
```
project-root/
├── CLAUDE.md                          # Main agent instructions, 4 skill sections
├── .claude/
│   ├── commands/
│   │   ├── banner-create.md           # Slash command: /banner-create [url]
│   │   └── banner-resume.md           # (v2) Resume an interrupted session
│   └── state/
│       └── [YYYYMMDD-business-slug]/  # Per-session working directory
│           ├── brand_profile.json
│           ├── chosen_copy.json
│           ├── logo.png               # Resolved logo (downloaded or generated)
│           └── session.log            # Optional: human-readable trace
└── docs/
    └── PRD.md                         # This file
```

### Session Model
- **One session per customer.** No memory carries over between sessions.
- Session ID format: `YYYYMMDD-business-slug` (e.g., `20260615-caesarea-marina`).
- The `business-slug` is derived from the business name: lowercase, ASCII transliteration if Hebrew, hyphen-separated.
- If a session folder with the same ID already exists, the agent **prompts the user** before overwriting.
- No automatic cleanup — session folders remain on disk until manually deleted by the user.

### State Flow Between Skills
```
SKILL 1 → writes:    .claude/state/[session-id]/brand_profile.json
                     .claude/state/[session-id]/logo.png (if extracted)

SKILL 2 → reads:     brand_profile.json
       → writes:     logo_asset_id (in brand_profile.json under "logo.canva_asset_id")
                     logo.png (if newly generated)

SKILL 3 → reads:     brand_profile.json
       → writes:     chosen_copy.json

SKILL 4 → reads:     brand_profile.json, chosen_copy.json
       → writes:     final design URLs (returned to user, not persisted)
```

### User Approval Mechanism
All approval checkpoints use Claude Code's **AskUserQuestion** tool when available. Fallback: plain prompt in the chat with numbered options (1/2/3) and waiting for user input.

---

## 5. Implementation Dependencies

### Python Libraries (installed at session start)
```bash
pip install --break-system-packages \
  Pillow \
  colorthief \
  beautifulsoup4 \
  lxml \
  cairosvg
```

| Library | Purpose | Used in |
|---------|---------|---------|
| `Pillow` | Image processing, format conversion (WebP→PNG, etc.) | SKILL 1, SKILL 2 |
| `colorthief` | Extract dominant color palette from OG image / logo | SKILL 1 |
| `beautifulsoup4` + `lxml` | Parse HTML for OG tags, logos, fonts, language | SKILL 1 |
| `cairosvg` | Convert SVG logos to PNG when needed | SKILL 2 |

### Tool Availability
- `web_fetch` + `web_search` — provided by Claude Code
- Canva MCP tools — provided via configured MCP server
- `bash_tool` — for installing libraries, running Python scripts, file ops

### Tools NOT Available (explicit non-dependencies)
- ❌ Browser automation (Playwright, Selenium)
- ❌ Screenshot capture
- ❌ Direct EzGo API access

### Initialization Behavior
The agent runs the `pip install` command at the start of every session. If installation fails, the agent reports the error and stops — the workflow cannot proceed without these libraries.

---

## 6. Functional Requirements

The system is organized as one Epic with four Features. Each Feature corresponds to one Skill section in `CLAUDE.md`.

---

### 🎯 EPIC 1 — Automated Banner & Header Generation

**Goal:** Reduce per-customer banner production time and effort while maintaining design quality and brand fidelity.

**Stakeholders:** Operations Manager (primary), Product Manager (decisions)

---

### 📦 Feature 1 — Brand Intelligence (SKILL 1)

**Story 1.1 — Automated brand research from URL**
*Size: L*
*Priority: Must-have*

**As an** operations manager
**I want** the agent to extract brand information automatically from the customer's website
**So that** I don't have to manually research and document each new brand

**Acceptance Criteria:**

- **AC 1.1.1 — Successful website extraction**
  - **Given** the user provides a working customer URL
  - **When** SKILL 1 executes
  - **Then** the agent fetches the HTML, parses it with BeautifulSoup, extracts: OG image URL, logo candidates, language attribute, theme-color meta tag, font-family declarations
  - **And** writes a complete `brand_profile.json` with `research_sources: ["website"]`

- **AC 1.1.2 — Cloudflare/blocked website handling**
  - **Given** the website returns 403, 429, 503, or a Cloudflare challenge
  - **When** SKILL 1 attempts to fetch it
  - **Then** the agent moves to Facebook search within the same skill execution
  - **And** does NOT retry the original URL more than once

- **AC 1.1.3 — Color extraction from OG image**
  - **Given** an OG image URL is found
  - **When** the agent downloads it and runs colorthief
  - **Then** it extracts a 5-color palette
  - **And** flags any color that matches a "generic background" pattern (sky blue, ocean blue, generic green) — see Open Question Q1
  - **And** cross-references with logo colors (if logo is available) to identify the true brand color

- **AC 1.1.4 — Manual interview fallback**
  - **Given** all automated sources failed OR returned partial data (e.g., logo found but no colors)
  - **When** the agent reaches the gap-filling phase
  - **Then** it asks the user only the missing fields (does not re-ask what was already extracted)
  - **And** uses AskUserQuestion for each gap

- **AC 1.1.5 — Output schema validation**
  - **Given** SKILL 1 has completed (any path)
  - **When** writing `brand_profile.json`
  - **Then** the file conforms to the schema in §11.1
  - **And** contains all required fields, with `null` or empty values explicitly marked rather than missing keys

**Story 1.2 — Cascading source fallback**
*Size: M*
*Priority: Must-have*

**As an** operations manager
**I want** the agent to try multiple data sources in a defined order
**So that** brands without strong websites still get researched

**Acceptance Criteria:**

- **AC 1.2.1 — Source order**
  - The agent tries sources in this order: (1) customer website, (2) Facebook search + fetch, (3) Instagram search + fetch, (4) manual interview
  - Stops at the first source that yields **enough data** (defined as: business name + at least one of [colors, logo, tone])
  - Always presents the consolidated result to the user for approval before proceeding

- **AC 1.2.2 — Hybrid extraction**
  - **Given** the website yields partial data (e.g., logo only)
  - **When** the agent decides whether to continue to Facebook
  - **Then** it continues if any of [colors, tone] are missing
  - **And** merges results from multiple sources into one `brand_profile.json`, recording all sources used

- **AC 1.2.3 — User approval of brand profile**
  - **Given** SKILL 1 has produced a `brand_profile.json`
  - **When** moving to SKILL 2
  - **Then** the agent first presents a Hebrew-language summary to the user (e.g., "מצאתי: שם עסק X, צבע ראשי #0A4C8B, לוגו SVG, טון משפחתי")
  - **And** asks for approval or correction via AskUserQuestion
  - **And** if the user requests corrections, updates `brand_profile.json` and re-confirms

---

### 📦 Feature 2 — Logo Resolution (SKILL 2)

**Story 2.1 — Use existing logo when quality is sufficient**
*Size: S*
*Priority: Must-have*

**As an** operations manager
**I want** the agent to use the customer's actual logo when available
**So that** the banner reflects authentic brand identity

**Acceptance Criteria:**

- **AC 2.1.1 — Quality threshold**
  - A logo is considered "usable" if **all** of these are true:
    - Format is SVG, PNG, or JPG (WebP must be converted to PNG via Pillow first)
    - For raster formats: minimum dimension ≥ 200px on the shorter side
    - For PNG: alpha channel is present and the logo has transparent background (or the agent can verify the background is solid white)
  - SVG is always considered usable (no minimum size needed)

- **AC 2.1.2 — Borderline quality user prompt**
  - **Given** the found logo is between 100–200px (PNG) or has no alpha channel
  - **When** the agent evaluates it
  - **Then** the agent asks: "מצאתי לוגו [size]px [format]. רוצה להשתמש בו או שאיצור חדש?" with options [use existing / generate new / show me preview first]

- **AC 2.1.3 — Upload to Canva**
  - **Given** a usable logo file
  - **When** uploading to Canva
  - **Then** the agent uses the Canva MCP `upload-asset-from-url` tool
  - **And** stores the returned `asset_id` in `brand_profile.json` under `logo.canva_asset_id`
  - **And** retains a local copy at `.claude/state/[session-id]/logo.png` for reference

**Story 2.2 — Generate logo when quality is insufficient**
*Size: M*
*Priority: Must-have*

**As an** operations manager
**I want** the agent to generate a logo when the existing one is low quality or missing
**So that** the banner still has a professional logo placement

**Acceptance Criteria:**

- **AC 2.2.1 — Logo generation flow**
  - **Given** no usable logo was found OR the user rejected the existing one
  - **When** SKILL 2 enters generation mode
  - **Then** the agent calls Canva `generate-design` with `design_type: 'logo'` three times, each with a different prompt variation:
    - Variant 1: minimalist, geometric
    - Variant 2: emblem/badge style
    - Variant 3: typography-focused / wordmark
  - **And** presents the 3 candidates to the user via AskUserQuestion + design previews

- **AC 2.2.2 — Rejection of all generated options**
  - **Given** the user rejects all 3 generated logos
  - **When** the agent encounters this state
  - **Then** the agent proceeds **without a logo**
  - **And** notifies the user: "ממשיכים בלי לוגו. הבאנר יתבסס על טקסט ורקע בלבד. תמיד אפשר להוסיף לוגו ידנית בקאנבה אחר כך."
  - **And** sets `brand_profile.logo.skipped: true` for SKILL 4 to know to skip the logo insertion step

- **AC 2.2.3 — Logo prompt structure**
  - The generation prompt must include: business_name, business_type, primary color, secondary color, tone keywords
  - Prompt template documented in §11.3

---

### 📦 Feature 3 — Copywriting (SKILL 3)

**Story 3.1 — Generate 3 stylistic copy variants**
*Size: S*
*Priority: Must-have*

**As an** operations manager
**I want** to choose from 3 distinctly styled headlines
**So that** I can match the headline to the brand's voice

**Acceptance Criteria:**

- **AC 3.1.1 — Three required styles**
  - The agent always generates exactly 3 variants in 3 distinct styles:
    - **Direct** — short, factual, action-oriented (e.g., "הזמינו חוויה ימית")
    - **Emotional** — evocative, sensory (e.g., "הים מחכה לכם")
    - **Adventurous** — bold, motion-focused (e.g., "Set Sail. Discover. Repeat.")
  - Each variant: 4–8 words, no punctuation other than minimal commas
  - Each variant respects `brand_profile.language` (Hebrew or English)

- **AC 3.1.2 — Selection mechanism**
  - **Given** 3 variants are generated
  - **When** presenting to the user
  - **Then** the agent uses AskUserQuestion with the 3 variants as options
  - **And** includes a 4th option: "הצג 3 חדשות" to regenerate
  - **And** writes the chosen variant to `chosen_copy.json` per schema in §11.2

- **AC 3.1.3 — Direction inference**
  - The agent automatically infers `direction: rtl` for Hebrew, `ltr` for English
  - This value is later used by SKILL 4 to apply the placeholder-and-replace strategy correctly

---

### 📦 Feature 4 — Canva Design (SKILL 4)

**Story 4.1 — Generate banner with logo**
*Size: L*
*Priority: Must-have*

**As an** operations manager
**I want** the agent to produce 3 banner variants and let me pick one
**So that** I get creative variety without sacrificing control

**Acceptance Criteria:**

- **AC 4.1.1 — Background description in prompt (no separate approval step)**
  - **Given** SKILL 4 begins
  - **When** building the banner prompt
  - **Then** the agent constructs a background description in-prompt based on `brand_profile` (e.g., "deep blue gradient" or "ocean photography")
  - **And** does NOT ask for user approval of the background separately — the user evaluates the background as part of choosing 1 of 3 final banner variants

- **AC 4.1.2 — RTL placeholder strategy (Hebrew)**
  - **Given** `chosen_copy.direction == "rtl"` (Hebrew)
  - **When** generating the banner via Canva `generate-design`
  - **Then** the prompt uses an English placeholder text (e.g., `"HEADLINE_PLACEHOLDER"`)
  - **And** after the design is created, the agent calls `find-and-replace-text` to substitute the placeholder with the actual Hebrew headline
  - **Risk:** This strategy is **unverified in production**. If `find-and-replace-text` fails on responsive pages or rendering breaks, the agent must inform the user and offer manual editing in Canva. See Risks §13.

- **AC 4.1.3 — Three banner variants**
  - The agent generates 3 banner variants in parallel (3 calls to `generate-design`)
  - Presents all 3 previews to the user via AskUserQuestion
  - On selection, calls `create-design-from-candidate` for the chosen variant only
  - If the user rejects all 3, generates 3 new ones with adjusted prompt (more context, different tone phrasing); maximum 3 regeneration cycles before falling back to manual interview to refine the brand profile

- **AC 4.1.4 — Logo insertion**
  - **Given** the banner design is created AND `brand_profile.logo.skipped != true`
  - **When** inserting the logo
  - **Then** the agent runs an editing transaction: `start-editing-transaction` → `perform-editing-operations` (insert image asset by `logo_asset_id`) → `commit-editing-transaction`
  - **And** if `perform-editing-operations` fails because the page is responsive (Canva limitation), the agent informs the user and provides a Canva edit URL with instruction: "פתחי את העיצוב בקאנבה והוסיפי את הלוגו ידנית מהאסטים — זה לוקח 30 שניות"

**Story 4.2 — Generate header without logo**
*Size: M*
*Priority: Must-have*

**As an** operations manager
**I want** a matching header design that complements the banner
**So that** the banner+header pair looks coherent

**Acceptance Criteria:**

- **AC 4.2.1 — Header generation**
  - Same flow as banner (3 variants, user picks 1) but with the header prompt template (§11.3)
  - No logo insertion step
  - Uses the same RTL placeholder strategy as the banner (AC 4.1.2)

- **AC 4.2.2 — Visual coherence with banner**
  - The header prompt must include: same primary/secondary colors as banner, same tone keywords, same headline
  - Note: The agent does not enforce visual matching algorithmically — it relies on prompt consistency. If the user finds the header doesn't match, they regenerate.

**Story 4.3 — Final delivery**
*Size: S*
*Priority: Must-have*

**As an** operations manager
**I want** clear handoff with both Canva URLs
**So that** I can download and proceed with upload to EzGo

**Acceptance Criteria:**

- **AC 4.3.1 — Final output**
  - **Given** both designs are committed
  - **When** SKILL 4 completes
  - **Then** the agent presents a summary message in Hebrew with:
    - 🎨 Banner design URL (clickable Canva link)
    - 🎨 Header design URL (clickable Canva link)
    - Brief explanation: "להורדה: פתחי את העיצוב בקאנבה ולחצי Share → Download → PNG"
  - **And** does NOT export or save PNG files locally
  - **And** does NOT delete the session folder (user retains state for reference)

- **AC 4.3.2 — No automatic resume**
  - The agent does not offer to "continue editing" or "create another." After delivery, the conversation ends. The user starts a new session via slash command for the next customer.

---

## 7. User Flow (End-to-End)

```
👤 User: /banner-create https://example.com

🤖 [Init]
   ├─ Verify Python deps (pip install if missing)
   ├─ Generate session ID: 20260615-example-com
   └─ Create .claude/state/[session-id]/

🤖 SKILL 1 — Brand Intelligence
   ├─ Try website → Facebook → Instagram → manual (cascade)
   ├─ Extract: name, colors, logo, fonts, tone, language
   ├─ Write brand_profile.json
   └─ ✋ AskUserQuestion: "מצאתי X, Y, Z. לאשר?"

🤖 SKILL 2 — Logo Resolution
   ├─ Branch A: usable logo found
   │  └─ Upload to Canva, store asset_id
   ├─ Branch B: no usable logo
   │  ├─ Generate 3 variants
   │  ├─ ✋ User picks 1 of 3 (or rejects all → no logo)
   │  └─ Upload chosen to Canva
   └─ Update brand_profile.json with logo.canva_asset_id

🤖 SKILL 3 — Copywriting
   ├─ Generate 3 headlines (direct / emotional / adventurous)
   ├─ ✋ User picks 1 (or "regenerate")
   └─ Write chosen_copy.json

🤖 SKILL 4 — Canva Design
   ├─ Generate 3 banner variants (with logo if available)
   ├─ ✋ User picks 1 banner
   ├─ Generate 3 header variants
   ├─ ✋ User picks 1 header
   ├─ Insert logo into banner (if applicable)
   └─ Apply RTL find-and-replace if Hebrew

✅ Delivery
   📎 Banner design URL
   📎 Header design URL
   💬 "להורדה: פתחי בקאנבה → Share → Download → PNG"
```

---

## 8. Edge Cases & Error Handling

### Error Handling Policy

| Error Type | Policy | Retry | Action |
|------------|--------|-------|--------|
| `web_fetch` timeout | Retry once with backoff (5s) | 1 | Then move to next source in cascade |
| `web_fetch` 5xx | Retry once after 10s | 1 | Then move to next source |
| `web_fetch` 4xx (403, 429) | No retry | 0 | Move to next source immediately |
| `web_fetch` 4xx (404) | No retry | 0 | Inform user, move to manual interview |
| Canva MCP timeout | Retry once after 10s | 1 | If still failing, inform user and stop |
| Canva MCP 5xx | Retry once after 10s | 1 | If still failing, inform user and stop |
| Canva MCP 4xx (validation error) | No retry | 0 | Inform user with the specific error message; ask whether to adjust inputs and retry |
| Empty `generate-design` result | Retry once with simplified prompt | 1 | Then offer alternatives |
| `pip install` failure | No retry | 0 | Stop the session, ask user to install manually |
| `colorthief` failure on image | No retry | 0 | Fall back to LLM vision-based color guess from the same image, or ask user |
| `find-and-replace-text` failure (Hebrew) | No retry | 0 | Inform user, provide Canva edit URL, suggest manual fix |

### Edge Case Handling Table

| Scenario | Behavior |
|----------|---------|
| Website fully blocked | Cascade to Facebook → Instagram → manual interview |
| Only favicon found | Treat as "no logo" → Branch B |
| Logo in WebP format | Convert to PNG via Pillow before upload |
| Logo is SVG | Pass directly to Canva (Canva accepts SVG) |
| Hebrew text doesn't render correctly in Canva after find-and-replace | Show user the Canva URL with instruction to fix manually |
| `generate-design` returns visually broken results 3 times | Stop, ask user to refine the brand profile or background description |
| User rejects all 3 banner variants 3 times in a row | Treat as failure of the brand profile; offer to redo SKILL 1 |
| User rejects all 3 logo variants | Skip logo, proceed without |
| Session folder already exists for this slug | Ask user: overwrite, or pick a new slug? |
| OG image dominant color is generic (sky/ocean) | See Open Question Q1 |
| Business name contains characters that don't transliterate cleanly | Slug becomes timestamp-only with random suffix; agent informs user of the chosen slug |

---

## 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **RTL/Hebrew rendering broken in Canva** — `find-and-replace-text` strategy is unproven; may produce mangled text on responsive pages | 🔴 High | (1) Inform user upfront that manual fix may be needed. (2) Always show Canva edit URL in the final message. (3) Track this in user feedback. (4) v2 candidate: switch to text-as-image (render Hebrew text to PNG and upload as image asset). |
| **Color extraction picks generic background color** — OG images of beaches/landscapes give blue/green as dominant, not the actual brand color | 🟡 Medium | Cross-reference with logo colors when both available. Flag suspicious results to user for confirmation. See Open Question Q1. |
| **`generate-design` is non-deterministic / inconsistent quality** | 🟡 Medium | Always generate 3 variants. Up to 3 regeneration cycles. Manual interview fallback to refine prompt. |
| **Found logo violates copyright** (e.g., agent picks competitor's logo from a wrong site) | 🟢 Low | User must approve logo before use. Domain validation: extracted logo URL's domain should match the input URL's domain. |
| **Canva stock imagery irrelevant to brand** | 🟡 Medium | Background description is in the prompt; user evaluates as part of choosing 1 of 3 variants. |
| **Pip install fails in restricted environment** | 🟡 Medium | Document manual install path in CLAUDE.md. Stop the session early if deps missing. |
| **`perform-editing-operations` fails on AI-generated responsive pages** | 🟡 Medium | Documented Canva limitation. Fall back to manual logo insertion via Canva URL. |
| **`brand_profile.json` schema drift between v1 and v2** | 🟢 Low | Include explicit `schema_version` field. v2 must handle migration. |

---

## 10. Open Questions (TBD)

These need product/design decisions before or during implementation:

**Q1 — Generic background color filter**
When the OG image's dominant color is generic (sky blue, ocean blue, generic green) — is this the brand color or just the photo's background? Three options:
- (a) Cross-reference with logo colors (preferred when both available)
- (b) Maintain a hardcoded list of "generic" colors and skip them
- (c) Always present the extracted color to user for confirmation

Decision needed before SKILL 1 implementation begins.

**Q2 — RTL placeholder strategy validation**
The placeholder-and-replace approach for Hebrew text is unverified. What's the fallback if it fails reproducibly?
- (a) Document manual fix as expected behavior
- (b) v1.5 patch: render Hebrew as image and insert as asset
- (c) English-only banners in v1, Hebrew in v2

Decision needed if first 2-3 production runs show RTL issues.

**Q3 — Canva edit URL UX**
When the agent recommends manual editing in Canva, what level of guidance is expected? Just the URL? Step-by-step instructions in Hebrew? A short video link?

Decision can be deferred to first user feedback session.

---

## 11. Data Models & Templates

### 11.1 `brand_profile.json` Schema

```json
{
  "schema_version": "1.0",
  "session_id": "20260615-caesarea-marina",
  "business_name": "string (required)",
  "business_slug": "string (required, lowercase-hyphenated)",
  "business_type": "string | null (e.g., 'marine attraction')",
  "language": "he | en | other (required)",
  "direction": "rtl | ltr (required, derived from language)",
  "colors": {
    "primary": "#hex (required)",
    "secondary": "#hex | null",
    "background_suggestion": "#hex | null",
    "extraction_method": "colorthief_og | colorthief_logo | meta_theme | manual",
    "needs_user_confirmation": "boolean (true if generic background detected)"
  },
  "fonts": ["array of font-family names | empty"],
  "tone": "string (free-form, e.g., 'adventurous-family-friendly') | null",
  "target_audience": "string | null",
  "logo": {
    "found": "boolean",
    "source_url": "string | null (original URL where logo was found)",
    "local_path": "string | null (.claude/state/[id]/logo.png)",
    "format": "svg | png | jpg | null",
    "dimensions": [120, 120],
    "fallback_used": "boolean (true if favicon was used)",
    "generated": "boolean (true if created via generate-design)",
    "skipped": "boolean (true if user rejected all options)",
    "canva_asset_id": "string | null (set by SKILL 2)"
  },
  "research_sources": ["website", "facebook", "instagram", "manual"],
  "background_proposal": {
    "type": "image | gradient | solid",
    "description": "string (used in SKILL 4 prompt)"
  }
}
```

### 11.2 `chosen_copy.json` Schema

```json
{
  "schema_version": "1.0",
  "session_id": "20260615-caesarea-marina",
  "headline": "string (required, 4-8 words)",
  "language": "he | en (required)",
  "direction": "rtl | ltr (required)",
  "style": "direct | emotional | adventurous (required)",
  "rejected_alternatives": ["array of strings (the 2 not chosen)"]
}
```

### 11.3 Canva Prompt Templates

**Banner prompt:**
```
Create a vertical side banner for a hospitality booking platform.
Dimensions: 310x600 pixels (tall/portrait format)
Business: {business_name} — {business_type}
Headline text: "{HEADLINE_OR_PLACEHOLDER}" in {direction}
Brand colors: primary {primary_hex}, secondary {secondary_hex}
Background: {background_description}
Logo: a logo will be added separately at the {top|bottom} of the design
Style: {tone}
Keep design clean, minimal text, premium hospitality feel.
Leave clear empty space for logo at {top|bottom}.
```

**Header prompt:**
```
Create a wide horizontal header banner for a hospitality booking platform.
Dimensions: 1366x200 pixels (very wide, short header)
Business: {business_name} — {business_type}
Headline text: "{HEADLINE_OR_PLACEHOLDER}" in {direction}
Brand colors: primary {primary_hex}, secondary {secondary_hex}
Background: {background_description}
NO logo — text and visual elements only.
Style: {tone}
Keep it wide and elegant, suitable for a web page header.
```

**Logo generation prompt (3 variants):**
```
[V1] Minimalist geometric logo for {business_name}, {business_type},
     using colors {primary_hex} and {secondary_hex}, clean vector style,
     suitable for hospitality platform banner. Transparent background.

[V2] Emblem-style badge logo for {business_name}, {business_type},
     incorporating themes of {tone}, colors {primary_hex} and {secondary_hex},
     clean vector. Transparent background.

[V3] Wordmark/typography logo for {business_name}, modern sans-serif,
     primary color {primary_hex}, accent {secondary_hex}.
     Transparent background.
```

**RTL placeholder convention:**
- For Hebrew designs, replace `{HEADLINE_OR_PLACEHOLDER}` with the literal string `HEADLINE_PLACEHOLDER`.
- After design creation, call Canva `find-and-replace-text` with `find: "HEADLINE_PLACEHOLDER"`, `replace_with: actual_hebrew_headline`.

---

## 12. Roadmap (v2 candidates)

- Persist `brand_profile.json` to Airtable for cross-session reuse
- Auto-upload to EzGo via internal File Upload API (when built)
- Additional output formats (social media variants, email headers)
- Industry-specific prompt templates (marine, mountain, urban, food)
- Hebrew-as-image fallback for RTL rendering
- Resume capability for interrupted sessions
- Audit log of decisions made by user (for training future improvements)
- Brand kit integration: store palettes/logos as Canva brand kits per customer

---

## 13. Definition of Done (v1)

A v1 release is considered complete when **all** of the following are true:

1. ✅ All Acceptance Criteria in §6 pass for at least 3 real customer runs (one Hebrew-only, one English-only, one bilingual brand)
2. ✅ The agent successfully runs through Skills 1–4 without unhandled errors on a happy path
3. ✅ The cascading fallback (website → FB → IG → manual) executes correctly when sources are blocked
4. ✅ At least one variant of each asset (banner + header) is approved by the user without manual intervention in Canva
5. ✅ Hebrew RTL is either working OR Open Question Q2 has been resolved with a documented decision
6. ✅ All Python dependencies install cleanly on a fresh Claude Code environment
7. ✅ `CLAUDE.md` is complete and self-contained — a fresh Claude Code session can run the full workflow with no other context

---

*This PRD was derived from a structured interview, May 2026. It supersedes v1.0.*

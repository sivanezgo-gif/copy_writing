# Logo Generation Prompts

Used by SKILL 2 (Branch B) with the Canva MCP `generate-design` tool, `design_type: 'logo'`.

## Variables

- `{business_name}`, `{business_type}`, `{primary_hex}`, `{secondary_hex}`, `{tone}` — from `brand_profile.json`

## Three Variant Templates

### V1 — Minimalist Geometric

```
Minimalist geometric logo for {business_name}, {business_type},
using colors {primary_hex} and {secondary_hex}, clean vector style,
suitable for hospitality platform banner. Transparent background.
```

### V2 — Emblem / Badge

```
Emblem-style badge logo for {business_name}, {business_type},
incorporating themes of {tone}, colors {primary_hex} and {secondary_hex},
clean vector. Transparent background.
```

### V3 — Wordmark / Typography

```
Wordmark/typography logo for {business_name}, modern sans-serif,
primary color {primary_hex}, accent {secondary_hex}.
Transparent background.
```

## Selection

Generate all 3 in parallel. Present previews to user via AskUserQuestion. Options:

1. בחירת V1
2. בחירת V2
3. בחירת V3
4. ללא לוגו (skip — sets `brand_profile.logo.skipped = true`)
5. נסה שוב 3 חדשים (regenerate; max 3 cycles)

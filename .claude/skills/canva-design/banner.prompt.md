# Banner Prompt Template

Used by SKILL 4 with the Canva MCP `generate-design` tool.

## Variables

- `{business_name}` — from `brand_profile.business_name`
- `{business_type}` — from `brand_profile.business_type` (if null, omit the line)
- `{HEADLINE_OR_PLACEHOLDER}` — actual text for `direction == "ltr"`, the literal `HEADLINE_PLACEHOLDER` for `direction == "rtl"` (Hebrew)
- `{direction}` — `"rtl"` or `"ltr"`
- `{primary_hex}` — `brand_profile.colors.primary`
- `{secondary_hex}` — `brand_profile.colors.secondary` (or duplicate primary if null)
- `{background_description}` — `brand_profile.background_proposal.description`
- `{tone}` — `brand_profile.tone` (default: `"premium hospitality"`)
- `{logo_position}` — `"top"` or `"bottom"` (default: `"bottom"`); omit the logo paragraph entirely if `brand_profile.logo.skipped == true`

## Template

```
Create a vertical side banner for a hospitality booking platform.
Dimensions: 310x600 pixels (tall/portrait format)
Business: {business_name} — {business_type}
Headline text: "{HEADLINE_OR_PLACEHOLDER}" in {direction}
Brand colors: primary {primary_hex}, secondary {secondary_hex}
Background: {background_description}
Logo: a logo will be added separately at the {logo_position} of the design
Style: {tone}
Keep design clean, minimal text, premium hospitality feel.
Leave clear empty space for logo at {logo_position}.
```

## Variant Strategy

Generate exactly **3 variants in parallel** by varying only `{background_description}` slightly (e.g., "deep gradient" / "soft photography" / "abstract minimal"). Keep all other variables identical so the user is comparing background treatments, not three unrelated designs.

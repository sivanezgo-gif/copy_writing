# Header Prompt Template

Used by SKILL 4 with the Canva MCP `generate-design` tool. Same variable conventions as `banner.prompt.md`.

## Template

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

## Coherence Rule

The header **must** reuse: same `primary_hex`, same `secondary_hex`, same `tone`, same `headline` as the banner the user just approved. Visual matching is enforced via prompt consistency only — no algorithmic check.

## Variant Strategy

Same as banner: 3 variants, varying only `{background_description}` subtly.

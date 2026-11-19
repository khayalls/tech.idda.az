# tech.idda.az — Technopark residency

Single-page site for Technopark residency (IDDA). Next.js 16 (App Router) · Tailwind CSS 4 · Geist.

```bash
npm install
npm run dev      # http://localhost:3000  (EN)  ·  /az  (AZ)
npm run build
```

## Design system

One source of truth: [`design/tokens.json`](design/tokens.json). It feeds both the Figma variables
(collections **Primitives**, **Color**, **Spacing**, **Layout** + text styles) and the code
(`npm run tokens` → `src/styles/tokens.css`, runs automatically before `dev`/`build`).
The Figma **Foundations** page documents the same values.

| | Rule |
|---|---|
| **Type** | Geist Regular/Medium. Major Third scale: `16 × 1.25ⁿ`, rounded to a 4px grid → 12 · 14 · 16 · 18 · 20 · 24 · 32 · 40 · 48 · 60 · 76 · 96. Tracking `−3% × clamp((size−16)/80, 0, 1)`. Line heights on a 4px baseline. Sizes are fluid between mobile (375) and desktop (1440); large roles step down on mobile (`typeMobile`). |
| **Space** | 4px base, 8pt rhythm. Only `4 × {1,2,3,4,6,8,10,12,16,20,24,32,40}` — in Tailwind that is `p-1 … p-40` (`--spacing: 4px`). |
| **Layout** | Desktop ≥1280: 12 col · margin 80 · gutter 32 · section 160. Tablet ≥768: 8 · 40 · 24 · 128. Mobile: 4 · 20 · 16 · 96. Max width 1440. Utilities: `container-page`, `section-y`, `grid-page`. |
| **Colour** | OKLCH ramps with equal lightness steps, anchored on brand colours: `blue-700 #2457B0`, `blue-950 #0A1A4D`, `cyan-400 #66ADC9`; neutral `50 #F5F5F5 → 950 #121212`. Components use semantic roles only (`bg-page`, `text-primary`, `text-secondary`, `text-on-dark`, `bg-btn-primary`, …). Text pairs meet WCAG AA. |
| **Gradient** | `gradient/brand` (cyan-400 → blue-700 → blue-950) is for dot art only — never on text. |
| **Dot art** | Circles on a shared grid. Hero pitch 6.6, display pitch 10.4 (≈ 6.6 × 1.25²). Rendered on canvas from data, never as DOM nodes. |
| **Motion** | `ease-out` = `cubic-bezier(0.22, 1, 0.36, 1)`; reveals rise 16px over 800ms. `prefers-reduced-motion` is respected everywhere. |

## Structure

```
design/tokens.json            design tokens (source of truth)
scripts/build-tokens.mjs      tokens.json → src/styles/tokens.css
content/legacy/{en,az}.json   copy scraped from the current tech.idda.az (reference)
public/dots/*.json            dot-art data exported from Figma
src/i18n/                     locales (en default at /, az at /az) and dictionaries
src/proxy.ts                  locale routing (/ → en, /en/* → /*)
src/components/dots/          DotCanvas — canvas renderer (reveal, pointer, DPR, offscreen pause)
src/components/sections/      page sections, built one at a time
```

### Dot data

`public/dots/<name>.json` = `{ v, space: [w, h], scale, count, dots: [cx, cy, d, a%, …] }`, all values ×`scale`,
in the coordinate space of the Figma frame (hero: 1440×900). Several layers sharing a space can be drawn
in one `<DotCanvas sources=[…] />`.

---
description: "Tufte-aligned analytical visualization: data-ink, lie factor, chartjunk, comparisons, tables/charts, dashboards"
globs:
  - "**/*chart*.{ts,tsx,js,jsx,py,r,swift}"
  - "**/*plot*.{ts,tsx,js,jsx,py,r}"
  - "**/*dashboard*/**"
  - "**/*analytics*/**"
  - "**/*visualization*/**"
  - "**/notebooks/**/*"
  - "**/reports/**/*"
alwaysApply: false
---

# Tufte Analytical Visualization

## Persona: Analytical Display Auditor

- **Role:** Auditor of charts, tables, dashboards, and evidence displays. **Philosophy:** Honesty of evidence over decoration; the reader's reasoning beats the designer's aesthetic.
- **Traits:** Comparison-first ("compared to what?"), allergic to lie factor and chartjunk, demands source/units/period on every display

**Source:** Edward R. Tufte — [Books](https://www.edwardtufte.com/books/). Core: *The Visual Display of Quantitative Information* (VDQI), *Envisioning Information* (EI), *Visual Explanations* (VE), *Beautiful Evidence* (BE), *Seeing with Fresh Eyes*. Related: *The Cognitive Style of PowerPoint*.

**Scope:** Analytical/evidence surfaces (dashboards, BI, notebooks, admin analytics, data reports). **Not** marketing heroes or brand campaigns — brand/marketing rules win there. Interactive a11y requirements (labels, alt text, contrast, keyboard) win over "erase all non-data-ink."

**Caveat:** Embellishment can sometimes aid recall (Bateman et al.; Cairo). That never excuses misleading scales, dual axes that invent correlation, or missing sources.

---

## Top 10 CRITICAL (Quick Reference)

1. **Show the data.** Every element must serve understanding; remove the rest.
2. **Bars start at zero; lines need honest labels.** Never truncate bar/column/area y without a labeled break.
3. **No dual y-axes** for implied relationships. Prefer two panels or index=100.
4. **No 3D** for quantitative charts (bars, pies, surfaces).
5. **Pie/donut ≤ 4 slices** (prefer ≤ 3); otherwise sorted horizontal bar or dot plot.
6. **Direct labels over remote legends.**
7. **Small multiples** for many similar series — same scale, same encoding.
8. **Sparklines are typographic** — inline, ~1em, no axes/grid.
9. **Annotate the answer** next to the data that proves it.
10. **Source, units, period, definition** on every chart — mandatory.

---

## Core Principles (High Agent Applicability)

| Principle | Definition | Origin |
|---|---|---|
| Data-ink ratio | Maximize (data-ink) / (total ink); erase non-data and redundant data-ink | VDQI Ch. 4 |
| Chartjunk | No vibrating grids, ducks, decorative containers, shading for its own sake | VDQI Ch. 5 |
| Lie factor | (effect in graphic) / (effect in data) ≈ 0.95–1.05 | VDQI Ch. 2 |
| Encoding accuracy | Position/length ≫ angle/area ≫ volume/color saturation | VDQI; Cleveland & McGill |
| Analytical design | Comparisons, causation/mechanism, multivariate context, integrated evidence | VE Ch. 4 |
| Small multiples | Repeat one design across panels; vary one variable | EI Ch. 5 |
| Sparklines | Word-sized intense graphics in text | BE |
| Compared to what? | Every quantity needs a baseline, prior, target, or sibling | BE; VDQI |
| Direct labels | Words/numbers live with the marks | VDQI; EI |
| Argument-driven | If you cannot state the question, do not build the chart | VE Ch. 4 |

---

## 1. Graphical Integrity (CRIT)

### 1.1 Truncated bar/column/area axis

**CRITICAL:** Bar, column, and area charts use a zero baseline unless a break is explicitly labeled.

❌ Bad: `yAxis: { min: 8200 }` so a 2% change looks like a cliff
✅ Good: `yAxis: { min: 0 }` for bars; use a labeled slope/dot panel if small absolute deltas matter
⚠️ Why: Inflates lie factor; readers misjudge magnitude
🔧 Fix: Force zero min for bar/column/area; never silent truncation
📍 See: VDQI Ch. 2

**Detect:** `min` / `domain` / `scale.min` > 0 on bar/column/area; missing break annotation

---

### 1.2 Dual y-axis implied correlation

**CRITICAL:** Do not overlay two independent scales to suggest a relationship.

❌ Bad: Revenue on left axis, NPS on right, scales chosen to "prove" linkage
✅ Good: Small multiples with shared x; or scatter if the relationship is the claim; or index both to 100
⚠️ Why: Author can invent any visual correlation by picking scales
🔧 Fix: Split panels or normalize; refuse dual-axis by default
📍 See: VE Ch. 4; VDQI integrity

**Detect:** Two `yAxis` configs / `secondaryYAxis` / series assigned to left vs right axes

---

### 1.3 3D and perspective encodings

**CRITICAL:** No 3D bars, pies, or decorative surfaces for quantitative evidence.

❌ Bad: Exploded 3D pie, isometric bars, depth shadows as "style"
✅ Good: Flat 2D bars/lines; heatmap/contour when two spatial dimensions are real data
⚠️ Why: Perspective foreshortening and occlusion distort magnitudes
🔧 Fix: Disable `enable3D` / `projection: '3D'` / perspective transforms on marks
📍 See: VDQI Ch. 2

**Detect:** `enable3D`, `viewType: '3d'`, `effect3d`, `rotateY` / `rotate3d` on chart marks

---

### 1.4 Cherry-picked time windows

**CRITICAL:** Do not silently crop a series to dramatize a story.

❌ Bad: Start series at a trough with no full-range context
✅ Good: Show full relevant span, or bracketed window plus adjacent full-range companion
⚠️ Why: Shape and magnitude of change become untrustworthy
🔧 Fix: Require wider context when windowing; never change scale mid-axis without label
📍 See: VDQI Ch. 2; VE Challenger lessons

**Detect:** Aggressive `x.min`/`x.max` on time series with no sibling full-range chart or caveat

---

### 1.5 Missing source, units, period, definition

**CRITICAL:** Every analytical chart carries claim, units, scope, period, and source.

❌ Bad: Title "Q3 Performance" with no units, definition, or source
✅ Good: "Q3 2024 revenue (USD, GAAP) +8% YoY vs plan. Source: 10-Q p. 4."
⚠️ Why: Unsourced numbers are decoration, not evidence
🔧 Fix: Require caption/source/units props or equivalent figcaption
📍 See: VDQI Ch. 1; BE

**Detect:** Chart with title only; no `source`/`units`/`period`/`caption`

---

## 2. Data-Ink and Chartjunk (CRIT)

### 2.1 Decorative chrome and chartjunk containers

**CRITICAL:** Strip non-data ink that competes with marks.

❌ Bad: Drop shadows, gradient fills, heavy borders, vibrating dotted grids, rainbow bars for one series
✅ Good: Light/no border, muted background, minimal ticks; color encodes one variable
⚠️ Why: Chrome raises cognitive load and lowers data-ink ratio
🔧 Fix: Theme: no box-shadow on plot, grid opacity ≤ 0.15 or none, single accent
📍 See: VDQI Ch. 4–5

**Detect:** `box-shadow` / gradient fills on chart frame; `gridLineDashStyle: 'Dot'`; multi-hue palette for one series

---

### 2.2 Excel/default library chrome

**CRITICAL:** Do not ship stock chart defaults for evidence displays.

❌ Bad: Thick plot border, loud default palette, full grid behind every mark
✅ Good: Sorted categories, gray axes, sparse ticks, direct labels, one accent
⚠️ Why: Defaults optimize novelty, not comparison
🔧 Fix: Apply a minimal evidence theme; sort and label in place
📍 See: VDQI; theme_tufte pattern

**Detect:** Unmodified library defaults; heavy `chartArea.border` + auto multi-color series

---

## 3. Encoding Choice (CRIT)

### 3.1 Pie/donut overuse

**CRITICAL:** Prefer length/position encodings; pies only for few, unequal part-to-whole slices.

❌ Bad: 8–12 slice pie/donut; many near-equal wedges; tiny "Other" crumbs
✅ Good: Sorted horizontal bar or Cleveland dot plot; collapse tiny slices; pie only when ≤ 4 slices and sum is meaningful
⚠️ Why: Angle/area are weak encodings; many slices are unreadable
🔧 Fix: Default bar over pie; allow pie only when slice count ≤ 4 (prefer ≤ 3)
📍 See: VDQI Ch. 2; Cleveland & McGill

**Detect:** `pie`/`donut` with > 4 categories, or many slices with deltas < ~5%

---

### 3.2 Rainbow / color-only magnitude

**CRITICAL:** Ordered data uses sequential/diverging palettes; never encode by hue alone.

❌ Bad: Rainbow/jet heatmap for continuous values; red/green up-down with no labels
✅ Good: Viridis/cividis (or similar sequential); diverging for signed; pair color with label/sign/shape
⚠️ Why: Rainbow invents false boundaries; hue-only fails colorblind readers
🔧 Fix: Sequential/diverging by data type; always dual-encode
📍 See: EI Ch. 4

**Detect:** `rainbow`/`jet`/`interpolateHsl` on continuous scales; color-only category encoding

---

### 3.3 Remote legends instead of direct labels

**CRITICAL:** Prefer labels on marks; legends only when unavoidable.

❌ Bad: Color legend top-right while series marks are far away
✅ Good: End-of-line / beside-bar labels; co-locate legend with marks if needed
⚠️ Why: Eye travel between legend and data causes misreads
🔧 Fix: `directLabels` / annotate series; legends as fallback for many overlapping series
📍 See: EI; BE

**Detect:** `legend: true` with no direct labels on multi-series charts

---

### 3.4 Stacked marks without segment labels

**CRITICAL:** Stacked bars/areas need readable segment identity and values.

❌ Bad: Wide stack with only a total label
✅ Good: In-place segment labels or small-multiples breakdown when segments > 3
⚠️ Why: Unlabeled stacks are decorative area
🔧 Fix: Label segments; switch to small multiples when ranking matters more than composition
📍 See: VDQI Ch. 4

**Detect:** Stacked series with no per-segment labels and distant/missing legend

---

## 4. Comparison and Density (CRIT)

### 4.1 KPI without comparison

**CRITICAL:** A lone big number is not an analytical display.

❌ Bad: Card showing only "Revenue: $4.2M"
✅ Good: Value + delta vs prior/plan/target + optional sparkline
⚠️ Why: Magnitudes need "compared to what?"
🔧 Fix: Require at least one comparator per KPI
📍 See: BE; VDQI

**Detect:** Metric card with value+label only — no delta, previous, target, or sparkline

---

### 4.2 Dashboard of bare KPI tiles

**CRITICAL:** Do not replace analysis with a wall of uncompared numbers.

❌ Bad: 12 identical KPI cards, current period only
✅ Good: Small-multiples sparkline grid, dense comparison table, or few focused charts
⚠️ Why: KPI wallpaper has low data density and weak comparison
🔧 Fix: Apply data-ink test per tile; merge into multiples or a table
📍 See: BE; Few (dashboard design complements Tufte)

**Detect:** ≥ ~8 KPI cards on one view with no per-card comparator/sparkline

---

### 4.3 Fragmented panels instead of small multiples

**CRITICAL:** Related series with the same encoding share one small-multiples grid.

❌ Bad: Sixteen one-off charts with inconsistent scales
✅ Good: Same scale, same marks, panel labels vary; eye compares across frames
⚠️ Why: Inconsistent axes block comparison
🔧 Fix: Shared scales; grid layout when ≥ ~6 related series
📍 See: EI Ch. 5

**Detect:** Many sibling charts of identical encoding with mismatched axes

---

## 5. Narrative and Slides (CRIT)

### 5.1 PowerPoint outline as evidence

**CRITICAL:** Analytical decks are sequences of displays, not bullet outlines.

❌ Bad: Slide of 8+ bullets with data only in an appendix
✅ Good: One focused chart/table/diagram per slide; prose in a handout
⚠️ Why: Fragmented bullets destroy narrative and hide evidence
🔧 Fix: Put the graphic on the slide; move outline prose to documents
📍 See: *Cognitive Style of PowerPoint*

**Detect:** Slide/body with many bullets and no chart/table/diagram

---

### 5.2 Answer not annotated on the graphic

**CRITICAL:** Put the conclusion next to the data that supports it.

❌ Bad: Reader must hunt title, legend, and footnote to reconstruct the claim
✅ Good: Short claim as title; annotation at the decisive mark; source line
⚠️ Why: Separating claim from evidence wastes attention
🔧 Fix: Annotate the answer on-chart; integrate text with marks
📍 See: VE; BE links and causal explanation

**Detect:** Chart with vague title and no on-mark annotation for the highlighted finding

---

## 6. Contextual / Digital Practices

### 6.1 Animation as decoration (NC)

❌ Bad: Bounce-in bars, draw-on every load, perpetual shimmer
✅ Good: Static analytical render; brief transition only on explicit state change; honor `prefers-reduced-motion`
⚠️ Why: Motion competes with shape of data
🔧 Fix: Default `animation: false`; allow only on filter/selection change
📍 See: PowerPoint essay; VE

**Detect:** Default `animationDuration > 0`; autoplay chart intro

---

### 6.2 Fake sparklines (NC)

❌ Bad: Tiny chart with axes/grid labeled "sparkline"
✅ Good: Word-sized line/win-loss, no axes, inline with text, enough points for shape
⚠️ Why: Axes burn the tiny canvas; sparkline value is shape-in-context
🔧 Fix: Strip axes/labels; embed in sentence or table cell
📍 See: BE sparklines

**Detect:** Component named sparkline that still draws axes or heavy chrome

---

### 6.3 Missing data hidden as continuous line (NC)

❌ Bad: Gap in series drawn as continuous path with no mark
✅ Good: Dashed gap, shaded "no data" band, or explicit break label
⚠️ Why: Readers confuse missing evidence with zero or smooth trend
🔧 Fix: Annotate null ranges
📍 See: VE visual confusions

**Detect:** Continuous line over `null`/`undefined` segments without gap styling

---

### 6.4 Tooltips replacing labels (NC — mobile compromise)

❌ Bad: Desktop analytical chart with values only in hover tooltips
✅ Good: Persistent direct labels for key marks; tooltips as enrichment; printable static variant for archives
⚠️ Why: Hover is not available on print/share and fails many a11y paths
🔧 Fix: Dual-encode: labels + optional tooltip
📍 See: Digital adaptation of VDQI labeling

**Detect:** Interactive chart with no static value labels and tooltip-only readout

---

## Positive Design Checklist

### Pre-build

1. What one-sentence question does this chart answer?
2. Compared to what? (prior, plan, target, sibling, distribution)
3. Units and definition explicit?
4. Best encoding for the data type? (position/length first)
5. Table better if N is small and exact values matter?

### Encoding defaults

- **1 value** → number + comparator + optional sparkline
- **Few categories, one measure** → sorted horizontal bar
- **Part-to-whole, few parts** → bar or (≤4) pie; else treemap/bar
- **Time, one series** → line with end labels
- **Time, many series** → small multiples (preferred) or direct-labeled lines
- **Two quantitatives** → scatter
- **Exact lookup** → table

### Minimum labeling

Title = claim · subtitle = frame · axes with units · source/date/caveats · annotate the decisive point · bars at zero

---

## Digital Adaptations

- **Keep:** data-ink, lie factor, small multiples, sparklines, integrity of scales.
- **Adapt:** screen type size/contrast (WCAG AA); dark mode remaps sequential palettes deliberately; brushing/linking OK as digital enhancement.
- **Performance:** aggregate/downsample server-side; avoid shipping huge series for decoration (prefer ≤ ~5k client points per series unless justified).
- **A11y:** never color-only; alt text + data summary/table; keyboard for interactive controls; `prefers-reduced-motion`.

---

## Conflict Resolution

| Conflict | Resolution |
|---|---|
| Brand / marketing density | Marketing rules win on marketing surfaces; this rule wins on analytics globs |
| A11y vs minimal ink | Keep required labels, alt text, contrast, keyboard; strip decorative chrome only |
| Performance | Aggregate/downsample before render; do not fetch huge series for pretty charts |
| documentation-policy | No unsolicited viz design-system docs; brief source/units comment on chart code is OK |

---

## Worked Examples

### E1. 3D pie → sorted bar

❌ `<Pie3D data={salesByRegion} explode shadow />`
✅ Sorted horizontal bar, muted fill, one accent on top category, end labels
Why: Length encoding; no perspective distortion

### E2. Bare KPIs → compared multiples

❌ Twelve `<Card value={n} label={...} />`
✅ Grid: value + Δ vs prior + sparkline per metric
Why: Comparison is the point of dashboards

### E3. Truncated bars

❌ `yAxis: { min: 8200, max: 9000 }`
✅ `yAxis: { min: 0 }`; optional side slope chart for small deltas
Why: Lie factor near 1.0

### E4. Dual axis → panels

❌ Revenue bars + NPS line on second axis
✅ Two panels, shared x; or scatter if relationship is the claim
Why: Dual scales invent correlation

### E5. Legend → direct labels

❌ Stacked/area series with remote color legend
✅ Label each series at the mark; drop legend if readable
Why: Fewer saccades, fewer mix-ups

### E6. Title-only → evidence caption

❌ Title `"Q3 Performance"`
✅ Claim + units + period + comparison + source in caption/figcaption
Why: Chart without provenance is decoration

---

## Sources (minimal)

- [Edward Tufte books](https://www.edwardtufte.com/books/) — VDQI, EI, VE, BE, *Seeing with Fresh Eyes*
- *The Cognitive Style of PowerPoint* — slide/outline critique
- Online slogans like "Tufte says never use pie charts" are **overstated**; prefer conditional defaults above
- Complements (secondary): Cleveland & McGill (encoding accuracy); Few (dashboards); Cairo; Munzner

# README-MERGE — Pipeline Tracker module

## What this is

Business name: **VA Distribution Performance** dashboard (brand-onboarding
pipeline tracker: Potential deal → Verbal Agreement & Onboarding → Go Live).
Your team may also know it as "Deal Tracker" / "Lead Funnel" / "BD Tracker" —
same thing. Suggested tab label in the host app: **"VA Distribution
Performance"** (or shorten to "Pipeline" if space is tight).

The technical names used throughout the code (`#pipeline-root`, `pl-`
prefix, `window.PipelineTracker`, the `pipeline.*` filenames) are a fixed
namespace contract, independent of whatever business name you use for the
tab — don't rename those.

## Files in this package

```
pipeline-tracker-module/
├── pipeline.body.html   # markup only, wrapped in <div id="pipeline-root">
├── pipeline.css         # all CSS, scoped under #pipeline-root, pl- classes
├── pipeline.js          # vanilla JS IIFE, exposes window.PipelineTracker
├── data/
│   ├── pipeline.json           # the actual dataset (deals + validation lists)
│   ├── Copy_of_validation.xlsx # original source workbook (reference only)
│   └── validation.xlsx         # original validation/enum workbook (reference only)
├── assets/              # empty — no images/icons used by this dashboard
├── standalone.html      # everything inlined, for local browser testing only
├── SCHEMA.md
└── README-MERGE.md      # this file
```

## How to embed

1. **Add the two peer libraries to the host page** (see "External libraries"
   below) — either as `<script src>` tags in the page that will render this
   tab, or via whatever script-loading mechanism the host app already uses.
   Do this once per page, not per mount.
2. **Load `pipeline.css`** into the host page (e.g. `import './pipeline.css'`
   if the host's bundler supports raw CSS imports, or a `<link rel="stylesheet">`
   if served statically). Every rule is scoped under `#pipeline-root`, so it
   is safe to load alongside the host's own Tailwind/CSS — it cannot affect
   anything outside `#pipeline-root`.
3. **Render `pipeline.body.html`'s contents** into the new tab via
   `dangerouslySetInnerHTML`, e.g.:
   ```jsx
   import pipelineBodyHtml from './pipeline.body.html?raw'; // adjust to your bundler's raw-import syntax
   <div ref={containerRef} dangerouslySetInnerHTML={{ __html: pipelineBodyHtml }} />
   ```
4. **Load `pipeline.js`** (plain `<script src="pipeline.js">` — it is not an
   ES module and exports nothing via `import`/`export`).
5. **Call mount when the tab becomes active:**
   ```js
   fetch('/path/to/data/pipeline.json')
     .then(r => r.json())
     .then(data => window.PipelineTracker.mount(containerRef.current, data));
   ```
6. **Call `window.PipelineTracker.unmount()`** when the tab is closed/hidden
   in a way that should stop background work (chart instances, listeners).
   Safe to call `mount()` again afterward — it's idempotent.
7. To push new data without a full remount (e.g. polling, websocket update):
   `window.PipelineTracker.setData(newData)`.

`data` passed to `mount`/`setData` must match the shape documented in
`SCHEMA.md` (`{ deals: [...], validationLists: {...} }`).

## External libraries

| Library | Version | CDN URL | Used for |
|---|---|---|---|
| ECharts | 5.5.0 | `https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js` | Both charts (Confirmed vs Pipeline NMV; Brand Count by Stage). |
| ExcelJS | 4.4.0 | `https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js` | The "Export Excel" button (styled multi-sheet `.xlsx` export). |

**Neither library is vendored or loaded by `pipeline.js` itself** — the host
page must load them (see step 1 above). This is intentional:
`pipeline.js` never touches `document.head`, so it cannot inject `<script>`
tags itself, and doing so would risk clashing with any versions the host app
already vendors. `pipeline.js` reads `window.echarts` / `window.ExcelJS` at
`mount()` time and degrades gracefully if either is missing:
- No `echarts` → both charts are skipped (`console.warn`), rest of the
  dashboard (KPIs, tables, filters, export) still works.
- No `ExcelJS` → the Export button is disabled with an explanatory `title`
  attribute; clicking it (if somehow still enabled) shows an `alert()`
  instead of throwing.

**⚠️ If your app already vendors SheetJS (`xlsx`) or PptxGenJS at a locked
version:** this module does not use either of those two libraries at all
(it uses ExcelJS, a different library, for the export feature), so there is
no version conflict to worry about there. It does use ECharts and ExcelJS as
listed above — if your app *also* already vendors either of those at a
locked version, point `pipeline.js` at the existing global instead of adding
a second `<script src>` for it (both libraries expose a single global —
`echarts` and `ExcelJS` respectively — so as long as one instance of each is
loaded before `mount()` is called, it doesn't matter who loaded it).

No Google Fonts or any other webfont is loaded — `pipeline.css` uses a
system font stack only (`"Segoe UI", "Aptos Narrow", Arial, sans-serif`).

## Global surface

- **`window.PipelineTracker`** — the only global this module creates.
  Shape: `{ mount(el, data), unmount(), setData(data), toBrandKey(str) }`.
- Everything else (the `deals` array, chart instances, filter state, all
  helper functions) lives inside a single IIFE closure and is not reachable
  from outside `pipeline.js`.

## `document`/`window` listeners this module adds

| Target | Event | Added in | Removed in |
|---|---|---|---|
| Each filter `<select>`/`<input>` inside `#pipeline-root` (8 filters + search + 2 time-picker inputs + time-mode select) | `change` / `input` | `mount()` | `unmount()` (and internally at the start of every `mount()` call, so re-mounting never double-binds) |
| Reset button (`#pl-f-reset`) | `click` | `mount()` | `unmount()` |
| Export button (`#pl-f-export`) | `click` | `mount()` | `unmount()` |
| `window` | `resize` (resizes both ECharts instances) | `mount()`, only if ECharts initialized successfully | `unmount()` |

No listeners are ever added to `document` itself, and no listener survives
an `unmount()` call. `unmount()` does **not** clear `rootEl`'s innerHTML —
it only tears down JS-side resources (listeners, chart instances). DOM
content lifecycle (re-injecting `pipeline.body.html` on next mount, if
needed) is left to the host app, since the host controls when/how
`dangerouslySetInnerHTML` re-runs.

## `localStorage` keys

None. This module does not read or write `localStorage` at all.

## Things to watch out for when embedding

- **Export file download:** the Export button builds an `.xlsx` in-memory
  and triggers a download via a detached `<a>` element's `.click()` — it
  never appends anything to `document.body`. This works in current
  Chrome/Firefox/Edge/Safari without the element being in the DOM. If your
  app runs inside a sandboxed iframe with restrictive `allow-downloads`
  policies, downloads may be blocked by the browser regardless of this
  module's implementation — that's a host-page/iframe policy question, not
  something `pipeline.js` can control.
- **No upload/print/iframe features** exist in this dashboard — nothing
  else to flag there.
- **Chart resize:** relies on the single `window resize` listener described
  above. If the host app's tab-switching mechanism hides the container with
  `display:none` rather than unmounting, ECharts may render at 0×0 the first
  time the tab becomes visible again — call `chart.resize()` (or
  `PipelineTracker.mount()` again) right after making the tab visible if you
  see that.
- **CSS is intentionally opinionated** (card backgrounds, its own color
  palette, `#pipeline-root`'s own `background`/`font-family`) — because it
  was originally a full standalone dashboard, not designed against your
  Tailwind theme. It won't leak out, but visually it will look like its own
  card-based UI rather than inheriting your app's exact look. Restyling it
  to match your design system would mean editing `pipeline.css` values
  directly (all under the `#pipeline-root { --pl-*: ... }` custom properties
  at the top of the file, plus the per-section color rules) — not a "just
  add a class" change.

## Known-unfinished / hardcoded items (be aware before wiring real data)

- **Win-rate badges** ("100%", ">80%", "40–60%") on each table header are
  **static text**, not computed from `deals`. There is no historical
  win/loss dataset in the source workbook to compute them from. If you want
  these live, you'll need a new data source (won/lost deal history) —
  out of scope for this refactor.
- **No live Excel/CSV parser.** `data/pipeline.json` is a manual, one-time
  transcription of the source workbook. The original `.xlsx` files are
  included under `data/` for reference, but there is no `parseExcel()`
  function anywhere in this package — see Deviation #1 below.
- **`stage` is trusted as-is**, not derived from `status`/`leadStage`. See
  SCHEMA.md › "Pipeline stages" for the mapping that's assumed to already be
  correct in the source data.
- **`cat` casing is inconsistent** between deal rows (e.g. `"Health"`) and
  the validation list (e.g. `"HEALTH"`) in the original workbook — the
  filter compares case-insensitively to route around this, but the
  underlying data itself hasn't been normalized.
- **Data owner / update cadence unconfirmed** — see SCHEMA.md's last
  section. Needs a conversation with whoever owns the source workbook
  before this is wired to a live feed.

## Deviations from the requested constraints

1. **"Nếu dashboard đang đọc từ Excel/CSV, xuất luôn file gốc vào `data/` và
   giữ lại hàm parse."** — The original dashboard never had a live
   Excel-parsing function; its data was manually transcribed into JS during
   the build process, before this refactor. There is nothing to "keep" —
   there was no parser. I've included both source `.xlsx` files under
   `data/` for reference/audit, and transcribed the same values into
   `data/pipeline.json`, but writing a *new* Excel→JSON parser was not part
   of the original dashboard's logic and wasn't added here, per the
   instruction not to add features. Flag this with whoever owns the
   real data pipeline if a live parser is actually needed.
2. **CSS selector strictness** — the constraint's examples of forbidden
   "bare element" selectors are `h1 {}`, `table {}`, `button {}` (i.e. an
   element type as the *entire* selector, which would style that element
   site-wide). To stay unambiguously inside that rule, every element that
   needed type-specific styling (the `<h1>` title, the 3 `<table>`s, every
   `<th>`, every `<select>`/`<input>`/`<button>`) was given an explicit
   `pl-` class (`pl-title`, `pl-table`, `pl-th`, `pl-select`, `pl-input`,
   `pl-btn`) instead of ever being targeted by tag name — so there are
   genuinely zero element-type selectors anywhere in `pipeline.css`, nested
   or not.

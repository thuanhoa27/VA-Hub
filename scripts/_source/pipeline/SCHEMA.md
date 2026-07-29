# SCHEMA — Pipeline Tracker data contract

This document describes the shape of the `data` object passed into
`PipelineTracker.mount(rootEl, data)` and `PipelineTracker.setData(data)`,
and the formulas behind every metric currently shown on the dashboard.

Business name of this dashboard: **VA Distribution Performance** (internally
tracked as a brand-onboarding pipeline: Potential → Verbal Agreement /
Onboarding → Go Live). See README-MERGE.md for the display name to use in
the host app's tab.

## Top-level data object

```js
{
  deals: [ /* array of Deal, see below */ ],
  validationLists: { /* dropdown/enum lists, see below */ }
}
```

Both keys are optional at runtime (missing `deals` renders an empty
dashboard; missing `validationLists` renders filter dropdowns with only the
"All" option) but a real integration should always supply both.

## Deal record — field dictionary

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `stage` | string enum | yes | Pipeline stage bucket. One of `"Go Live"`, `"Verbal"`, `"Potential"`. Drives which of the 3 tables the row appears in. | `"Go Live"` |
| `no` | number | yes | Row number *within its stage table* (not a global unique id — resets per stage, matches the "No." column shown in the original workbook). | `1` |
| `brand` | string | yes | **This is the brand name field.** Free text, as entered by the business team. | `"Hector"` |
| `brand_key` | string | derived | `brand`, lowercased, Vietnamese diacritics stripped, non `[a-z0-9]` characters removed. Auto-computed by `pipeline.js` (`normalizeDeals()`/`toBrandKey()`) if not supplied, so the host app can also compute it independently for joins against its own brand records. | `"hector"` |
| `tier` | string enum | yes | See `validationLists.tier`. | `"Tier 2"` |
| `model` | string enum | yes | Commercial model. See `validationLists.model`. | `"Consignment"` |
| `cd` | string enum | yes | Commercial Deal owner (the salesperson who owns the deal). See `validationLists.cd`. | `"Thao Pham"` |
| `elephant` | string enum | yes | `"YES"` / `"NO"` — whether this is a flagged high-priority ("elephant") deal. | `"NO"` |
| `cat` | string enum | yes | Product/brand category. See `validationLists.cat`. Casing is inconsistent between the deal rows (e.g. `"Health"`) and the validation list (e.g. `"HEALTH"`) in the source workbook — filtering is done case-insensitively to compensate; this is flagged as a data-quality item in the README. | `"Health"` |
| `va` | string enum | yes | VA (account manager) name. See `validationLists.vaName`. | `"Quyen Ngo"` |
| `channel` | string | yes | Platform/channel. Can combine more than one atomic value from `validationLists.channel` in a single cell (e.g. `"SHP & TTS"` combines `"SHP"` and `"TTS"`) — the channel filter matches by substring for this reason. | `"ECOM & TTS"` |
| `status` | string enum | yes | Granular deal status. See `validationLists.status`. Drives the colored status pill and the status filter. | `"Lived"` |
| `month` | number (1-12) | yes | Business "Lived Month" (Go Live table) or "Lived Month based on BP" (Verbal/Potential tables) — a *planning* month, present even when the exact date is unknown ("TBU"). Used for the Month time-filter and for chart 1's month buckets. | `6` |
| `date` | string | yes | Free-text date as shown in the table (`"6/30/2026"`) or the literal string `"TBU"` ("to be updated") when not yet known. | `"6/30/2026"` |
| `dateISO` | string (`YYYY-MM-DD`) or `null` | yes | Machine-parseable version of `date`; `null` when `date === "TBU"`. Used for the Day/Week time filters — rows with `dateISO: null` cannot appear in Day/Week view (there is no calendar day to place them on). | `"2026-06-30"` |
| `usd` | number | yes | NMV (Net Merchandise Value) in USD for this deal. Column label varies by table: "NMV 2026 (USD)" for Go Live/Verbal, "NMV live→EO26 (USD)" for Potential. | `567148` |
| `vnd` | number | yes | Same NMV, in VND. This is the primary currency for the KPI cards (labelled "BIL" = billion VND). | `15114490073` |

## `validationLists` — enum dictionary

These are the standardized dropdown/data-validation lists (sourced from the
business's `validation.xlsx` reference sheet). Every list is the **full**
set of valid values, not just the values currently used by `deals` — filter
dropdowns show every option so they behave like the original Excel
validation dropdowns.

| Key | Values |
|---|---|
| `tier` | Tier 0, Tier 1, Tier 2 |
| `model` | Consignment, Outright, Service |
| `cd` | Duy Tran, Thao Vu, Ngoc Pham, Nhung Nguyen, Thao Pham |
| `elephant` | YES, NO |
| `cat` | BEAUTY, EL, F&B, FASHION, FMCG, MOM & BABIES, HEALTH |
| `vaName` | Anh Nguyen, Quyen Ngo, Hue Phan, Thai Dinh, Tu Nguyen, Minh Do, Trang Nguyen, Under Commercial, Business Expansion |
| `channel` | ECOM & TTS, SHP, TTS, ECOM, D2C |
| `pendingParty` | Brand, LS Team, AFF/INF Team, Media Team, Short Video Team, VA Service, VA Distribution, Legal Team, Fin/ Ops Team, High level |
| `country` | Korea, China, Thailand, Others |
| `leadSource` | Top100, HL - Fanpage, HL - Inquiry (brand send mail), HL - Referral new client only, HL - Hotline |
| `leadStage` | 1. Not Started → 10. Lived (full 10-step list below) |
| `status` | 1st Meeting/ Contact, Brand Briefing, Processing Quotation/ Proposal, Sent Quotation/ Proposal, Negotiation, Verbally Agreement, Onboarding, Lived, Delay, Rejected |
| `contractStatus` | Drafting Docs, Pending review by OP, Pending review by Brand, In signing process by OP, In signing process by Brand, Contract signed, Cancel/ Delay |

`pendingParty`, `country`, `leadSource`, `leadStage`, and `contractStatus`
are part of the validation reference but **do not currently have a
corresponding column on the Deal record** (see README-MERGE.md ›
Deviations) — they're included here for completeness / future use, not
because the dashboard reads them today.

## Pipeline stages — definitions & transition conditions

The dashboard groups deals into 3 stage buckets. The underlying business
process (per `validationLists.leadStage`) is actually a finer 10-step
funnel; the 3 buckets used by `deals[].stage` map onto it like this:

| `stage` bucket | Corresponds to `leadStage` steps | Typical `status` values seen in this bucket |
|---|---|---|
| `"Potential"` | 1–6 (Not Started → Negotiation) | Negotiation |
| `"Verbal"` | 7–9 (Verbally Agreement → Onboarding) | Verbally Agreement, Onboarding |
| `"Go Live"` | 10 (Lived) | Lived |

**Transition condition (as implemented):** a deal's `stage` bucket is
whatever the business currently records it as in the source sheet — this
module does not compute the bucket from `status`/`leadStage` itself, it
trusts the `stage` field as given. If you want the bucket auto-derived from
`status` instead of trusted as-is, that's a schema change, not something
`pipeline.js` currently does (flagged in README › Deviations).

## Metric formulas (exactly as implemented in `pipeline.js`)

All formulas operate on `filtered` = the deals currently matching the
active filter/search/time-view selection (defaults to **all** deals when no
filter is applied).

| Metric (KPI card / chart) | Formula |
|---|---|
| Total NMV FC 2026 | `SUM(filtered[].vnd)` across all 3 stages |
| Total NMV FC 2026 (USD) | `SUM(filtered[].usd)` across all 3 stages |
| Total NMV Go Live YTD 2026 | `SUM(filtered[].vnd)` where `stage === "Go Live"` |
| Total Brand Golive YTD 2026 | `COUNT(filtered[])` where `stage === "Go Live"` |
| Total Brand Verbal YTD 2026 | `COUNT(filtered[])` where `stage === "Verbal"` |
| Total Brand Potential | `COUNT(filtered[])` where `stage === "Potential"` |
| Chart 1 — Confirmed NMV (VND), per month | `SUM(vnd)/1,000,000` grouped by `month`, where `stage === "Go Live"` |
| Chart 1 — Pipeline NMV (VND), per month | `SUM(vnd)/1,000,000` grouped by `month`, where `stage !== "Go Live"` (i.e. Verbal + Potential) |
| Chart 1 — Confirmed/Pipeline NMV (USD), per month | Same as above but `SUM(usd)/1,000` |
| Chart 2 — Brand Count by stage | `COUNT(filtered[])` grouped by `stage`, one bar per stage |
| Win-rate badges ("100%", ">80%", "40–60%") shown on each table header | **Static text, not computed from `deals`.** These are labels the business team typed directly into the original sheet's section headers — there is no historical win/loss data in this dataset to compute them from. Flagged in README › Deviations. |

### Time-view filters (Day / Week / Month)

- **Month view** filters on `deals[].month` directly (the *planning* month),
  so it still matches rows where `dateISO` is `null` ("TBU").
- **Day / Week view** filters on `deals[].dateISO`. Rows with `dateISO: null`
  are excluded from Day/Week view — there is no confirmed calendar date to
  place them on yet.
- Week view computes Monday–Sunday of the selected date's week and includes
  any deal whose `dateISO` falls in that range.

## Data source, ownership, update cadence

- **Current source:** manually maintained Excel workbook (`Copy_of_validation.xlsx`,
  sheet "Sheet3") plus a separate validation/reference workbook
  (`validation.xlsx`) that supplies the dropdown enum lists. Both are
  included under `data/` for reference.
- **Parser:** none exists yet. `data/pipeline.json` is a one-time manual
  transcription of the workbook's visible values, not the output of an
  automated Excel→JSON parser. See README-MERGE.md › Deviations for what
  this means for anyone wiring up live data.
- **Owner / update frequency:** not established with the business owner as
  part of this refactor — needs to be confirmed with the Commercial/BD team
  who maintains the source workbook before this becomes a live-data
  integration. Flagged as an open item in README-MERGE.md.

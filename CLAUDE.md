# CLAUDE.md — sovereign-sheets

Guidance for Claude Code working in this plugin repository.

## What this is

**Sheets** — a lightweight, self-hostable spreadsheet: a single-user workbook
with multiple sheet tabs, standard formulas, and one custom function,
`FINANCE(base, quote)`, for currency conversion (the GOOGLEFINANCE
equivalent). A `type: sovereign` Sovereign plugin, open source (AGPLv3).

**Status: planning only.** No `manifest.json`, `app/`, or database schema
exists yet — this repo currently holds only planning docs. Do not assume any
scaffold is in place; check before referencing a file path.

Spec: [SPEC.md](SPEC.md) · Build order: [ROADMAP.md](ROADMAP.md)

## Identity (planned — not yet built)

| Property     | Value                          |
| ------------- | ------------------------------ |
| Plugin ID     | `fs.sovereign.sheets`          |
| Route prefix  | `/sheets`                      |
| Database      | `isolated` — own SQLite file, no slug-prefix required |
| Permissions   | `auth:session`, `db:readWrite`, `data:export`, `activity:write` |
| Min platform  | `0.42.0`                       |

## MVP scope discipline

The long-term ambition is a real Google Sheets alternative. **The MVP is
deliberately narrow** — single-user, single-workbook-per-doc, no real-time
collaboration, no charts/pivot tables/conditional formatting, CSV export only
(no import). Don't let "make it feel like Google Sheets" pull scope back in
during implementation; SPEC.md's "Post-MVP" section is where deferred
features are tracked, not silently reintroduced into an MVP task.

## `FINANCE()` is currency conversion only

`FINANCE(base, quote)` — e.g. `FINANCE("USD","EUR")` — returns an exchange
rate. **It is not a stock/ticker quote function in MVP.** Do not build
GOOGLEFINANCE-style security-price support (`"price"`, `"high"`, `"volume"`,
tickers) without an explicit scope change — that's tracked as post-MVP in
SPEC.md and needs its own provider/admin-config design (a keyed provider like
Alpha Vantage, unlike Frankfurter, would reintroduce the admin-secrets
workstream this MVP deliberately avoids).

Provider is [Frankfurter](https://api.frankfurter.dev) — free, **no API key**.
This is why there's no admin settings page, no `sdk.secrets` usage, and no
capability-gated Console-style config form anywhere in this plugin's MVP
scope. If a future task swaps in a keyed provider, that reintroduces the
`sdk.secrets`/Console-settings pattern used elsewhere in the platform (see
`plugins/console/app/settings/SmtpSettingsForm.tsx` and `actions.ts` in the
platform monorepo for that pattern's reference implementation) — don't build
it preemptively.

## Data model direction

Cell data is stored as a **JSON blob per sheet** (`sheets.cells_json`), not
normalized per-cell rows. This is a deliberate MVP simplification given
single-user/no-concurrent-writer scope — see SPEC.md's "Data model" section
for the reasoning. Do not "improve" this into a per-cell table without a
scope discussion; that's real added complexity (diffing on every autosave,
row upserts per paste/fill-down) that only pays off once real-time
collaboration is in scope.

The one normalized table beyond `workbooks`/`sheets` is `finance_rate_cache`,
keyed on `(base, quote)`, **instance-wide** — not tenant/user-scoped. Exchange
rates are public data, same rationale as the Ledger plugin's untenanted
`ledger_fx_rates` cache (`plugins/sovereign-ledger.local` in the platform
monorepo).

## SDK-only rule (applies once code exists)

**Never import from `@sovereignfs/db` directly.** All database access goes
through `sdk.db`. This is enforced by the platform's ESLint SDK boundary rule.

```ts
// correct
import { getSdk } from '@sovereignfs/sdk';
const sdk = getSdk();
const db = await sdk.db();

// wrong — breaks the plugin/platform boundary
import { getPlatformDb } from '@sovereignfs/db';
```

## Open question: formula engine license

HyperFormula (the leading formula-engine candidate) ships its free tier under
**GPLv3**. This plugin is licensed AGPL-3.0-or-later, and the user has
confirmed that's fine for *this plugin's own* distribution — but whether a
GPLv3 dependency in one `type: sovereign` plugin imposes any obligation on
the core Sovereign platform or on other plugins with different licenses is
flagged in SPEC.md as needing real confirmation, not just this plan's
reasoning, before task 3 (formula engine integration) starts. Don't add
`hyperformula` as a dependency without that being resolved.

## Versioning

Once implementation starts, this plugin follows its own semver, independent
of the platform version:

- `fix/` → patch (0.0.x)
- `feat/` → minor (0.x.0)
- Breaking change → major (x.0.0)

Current version: **0.1.0** (unreleased — planning stage)

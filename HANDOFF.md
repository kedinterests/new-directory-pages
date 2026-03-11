# Migration Handoff — Resume Here Tomorrow

**Date:** March 11, 2025  
**Status:** Pages loading, data flow working. Styling not yet applied.

---

## What We've Done (Completed)

### 1. Master Spreadsheet
- **"MRF Directory Master"** created
- **ID:** `1KHAw1w5_1ykLpsIsSiICHyCUnaf1yLYYBqTYfvrXwrw`
- **Tabs:** Companies, Sites, Ads, Counties Reference

### 2. Source Sheet Access
- All 78 county sheets in folder **"MRF-County Directory"** (or similar)
- Folder shared with service account: `cursor@mrf-county-directories.iam.gserviceaccount.com` (Editor)
- All 77 sheets now accessible (one excluded: mineral-services-directory)

### 3. Migration Script (`scripts/migrate-companies.js`)
- Reads from all 77 county sheets
- Deduplicates companies by normalized name
- Merges counties from every sheet where each company appears
- Clears Companies tab, then writes header + deduplicated rows
- Counties column = comma-separated slugs (e.g. `reeves-county-texas, ward-county-texas`)
- Rate limiting: 1 second delay between API calls (avoids quota errors)
- `--list-failed` flag: checks which sheets are inaccessible (with progress output)

**Run migration:**
```bash
node scripts/migrate-companies.js 1KHAw1w5_1ykLpsIsSiICHyCUnaf1yLYYBqTYfvrXwrw
```

### 4. Counties Reference & Validation
- **add-counties-reference.js** populates Counties Reference sheet from Sites tab
- Companies counties column: **no data validation** (plain text, comma-separated) — validation was cleared
- Ads counties column: single-select dropdown from Counties Reference

### 5. Multi-Select Counties Sidebar (Apps Script)
- **Directory** menu in Google Sheets
- **Select counties (multi-select)** opens sidebar
- Sidebar: searchable list of ~700 counties, states, `*`; checkboxes; Apply button
- Writes comma-separated values to the active cell (Companies column J only)
- **Files:** `scripts/AppsScript-Code.js`, `scripts/CountiesSidebar.html`
- User confirmed: menu appears, sidebar works

### 6. Data Flow (Verified)
- Apps Script `expandCounties()`: expands `*`, `state:XX`; leaves comma-separated as-is
- `functions/refresh.js`: splits `row.counties` on comma, trims, lowercases, filters by slug
- County pages read from KV; companies filtered correctly by comma-separated counties

### 7. Other Scripts
- `scripts/setup-master-sheet.js` — creates tabs/headers
- `scripts/populate-sites.js` — fills Sites from Counties List or sites.json (695 sites)
- `scripts/add-counties-reference.js` — Counties Reference + validation (Companies cleared, Ads applied)

### 8. Cloudflare Pages + Refresh
- Apps Script deployed as **public** web app (Who has access: Anyone)
- Public URL: `https://script.google.com/macros/s/AKfycbyNw8dj3BQacyiVEg7ZdcBILTyeRWa2acl0sdNfOQ49JIyttGMqqnilCJmlBa9aa38/exec`
- Cloudflare Pages project `directory-mineralrightsforum` via Wrangler
- KV populated via refresh endpoint (batch KV writes to avoid function timeout)
- Pages loading at `directory.mineralrightsforum.pages.dev` and custom domain

---

## Current State

- **Companies tab:** ~22 unique companies (deduplicated), counties populated from migration
- **Sites tab:** 695 sites populated
- **Ads tab:** structure ready
- **Counties Reference:** populated from Sites
- **Apps Script:** doGet (JSON API) + onOpen (Directory menu) + CountiesSidebar
- **Domain:** `directory.mineralrightsforum.com` (all references updated from directories.mineralrightsforum.com)

---

## What Needs to Be Done Next

### Immediate Next Steps

1. **Fix styling** — pages load but have no real styling yet (next session)

### Optional / Later

- **Re-run migration** if more companies need to be pulled from source sheets
- **22 companies** seems low — consider checking if source sheets use different header names (e.g. "Company Name" vs "Name"); script only maps columns that normalize to `name`
- **Scheduled refresh** — cron or time-driven trigger to keep KV in sync

---

## Key Paths & IDs

| Item | Value |
|------|-------|
| Master spreadsheet ID | `1KHAw1w5_1ykLpsIsSiICHyCUnaf1yLYYBqTYfvrXwrw` |
| Service account | `cursor@mrf-county-directories.iam.gserviceaccount.com` |
| Credentials | `google-credentials.json` (in .gitignore) |
| sites.json | 78 entries with `sheet.url` (sheetId in query param) |
| MASTER_SHEET_URL, REFRESH_KEY | Set in Cloudflare dashboard (Settings → Environment variables). Do not add to wrangler.toml — causes "Binding name already in use" on deploy. |

---

## Reference Docs

- `migrate-to-single-spreadsheet.md` — full migration plan
- `MIGRATION-STEP-BY-STEP.md` — checklist (includes multi-select setup)

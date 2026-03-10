# Migration Handoff — Resume Here Tomorrow

**Date:** March 10, 2025  
**Status:** Migration in progress. Master spreadsheet set up, companies migrated, multi-select counties working.

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

### Immediate Next Steps (in order)

1. **Deploy Apps Script as web app**
   - Extensions → Apps Script → Deploy → New deployment
   - Type: Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy the deployment URL

2. **Configure Cloudflare env vars**
   - `MASTER_SHEET_URL` = Apps Script deployment URL
   - `REFRESH_KEY` = secret key for refresh endpoint
   - `DIRECTORIES_KV` = KV namespace (should already exist)

3. **Run refresh**
   - POST to refresh endpoint with `X-Refresh-Key` header
   - Or trigger via cron/Cloudflare Worker

4. **Verify**
   - Visit `https://directory.mineralrightsforum.com/`
   - Visit a county page (e.g. `/reeves-county-texas`)
   - Confirm companies and ads display correctly

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

---

## Reference Docs

- `migrate-to-single-spreadsheet.md` — full migration plan
- `MIGRATION-STEP-BY-STEP.md` — checklist (includes multi-select setup)

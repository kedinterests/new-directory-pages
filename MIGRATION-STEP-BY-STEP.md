# Migration Step-by-Step Checklist

This document is a sequential, actionable checklist for executing the migration described in [migrate-to-single-spreadsheet.md](migrate-to-single-spreadsheet.md). Follow the steps in order. Each step references the relevant section in the migration plan.

---

## Prerequisites

- [ ] Access to all 78 existing Google Sheets (or CSV exports)
- [ ] Access to `sites.json` in the repo
- [ ] Access to [Comprehensive Counties List](https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY/edit) (column B has county URLs)
- [ ] Cloudflare Pages project with `DIRECTORIES_KV` and `REFRESH_KEY` configured
- [ ] Node.js 18+ (if using migration script)

---

## Phase 1: Backup and Preparation

### Step 1.1: Create Backup

**Ref**: [Step 0: Backup Before Migration](migrate-to-single-spreadsheet.md#step-0-backup-before-migration)

- [ ] Create git branch: `git checkout -b backup-pre-migration`
- [ ] Commit current state: `git add -A && git commit -m "Backup before single-spreadsheet migration"`
- [ ] Copy `sites.json` to `sites.json.backup`
- [ ] (Optional) Export each of the 78 sheets to CSV or make copies in Google Drive

---

## Phase 2: Master Spreadsheet Setup

### Step 2.1: Create Master Google Sheet

**Ref**: [Step 1: Create the Master Google Sheet](migrate-to-single-spreadsheet.md#step-1-create-the-master-google-sheet)

- [ ] Create new Google Sheet (e.g. "MRF Directory Master")
- [ ] Rename first tab to **Companies**
- [ ] Add header row: `name | category | description_short | plan | website_url | logo_url | contact_email | contact_phone | hidden | counties`
- [ ] Create second tab **Sites**
- [ ] Add header row: `slug | state | division_type | division_name | page_title | return_url | directory_intro | seo_title | seo_description | category_order | theme`
- [ ] Create third tab **Ads**
- [ ] Add header row: `image_url | link | category | counties | priority | active`

### Step 2.1a: Set Up Google Sheets API Credentials (Option A only)

**Ref**: [Step 2: Build and Run the Migration Script](migrate-to-single-spreadsheet.md#step-2-build-and-run-the-migration-script)

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/), create or select a project
- [ ] Enable **Google Sheets API** (APIs & Services → Library)
- [ ] Create **Service Account** (APIs & Services → Credentials → Create Credentials → Service Account)
- [ ] Download the JSON key file; save as `google-credentials.json` (or similar)
- [ ] Add `google-credentials.json` to `.gitignore`
- [ ] Share the master sheet and all 78 source sheets with the service account email (Editor access)
- [ ] Set `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json` (or pass path to script)

### Step 2.2: Run Migration Script

**Ref**: [Step 2: Build and Run the Migration Script](migrate-to-single-spreadsheet.md#step-2-build-and-run-the-migration-script)

- [ ] Extract sheet IDs from `sites.json` (from each `sheet.url` query param `sheetId=...`)
- [ ] Choose approach: **Option A** (Google Sheets API) or **Option B** (CSV export/import)
- [ ] If Option A: Enable Google Sheets API, create service account, install `googleapis`
- [ ] Run migration script to:
  - [ ] Read all 78 sheets and merge into Companies tab with `counties` = slug per row
  - [ ] Populate Sites tab with slug, state, division_type, division_name, page_title, return_url, directory_intro, seo_title, seo_description, category_order, theme
- [ ] Verify row counts: Companies and Sites match expected counts

### Step 2.3: Populate Sites Tab (if not done by script)

**Ref**: [Step 3: Populate the Sites Tab](migrate-to-single-spreadsheet.md#step-3-populate-the-sites-tab)

- [ ] **Option A**: From [Comprehensive Counties List](https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY/edit) column B — parse slug, derive division_type (county/parish/area), division_name, state
- [ ] **Option B**: From `sites.json` for existing 78 — extract slug, derive division_type and division_name
- [ ] Skip "New State Below" and other non-county rows
- [ ] For Permian Basin: division_type = `area`, division_name = "Permian Basin"; never use "County" in display

### Step 2.4: Update Companies Counties (Optional)

**Ref**: [Counties Multi-Select and Sites Reference](migrate-to-single-spreadsheet.md#counties-multi-select-and-sites-reference)

- [ ] Migration script outputs comma-separated slugs per row (one per source sheet)
- [ ] For multi-county companies (deduped), ensure `counties` has all relevant slugs
- [ ] Optionally convert to `state:TX` or `*` for easier editing

---

## Phase 3: Apps Script

### Step 3.1: Create Apps Script

**Ref**: [Step 4: Create the New Apps Script](migrate-to-single-spreadsheet.md#step-4-create-the-new-apps-script), [Apps Script Code](migrate-to-single-spreadsheet.md#apps-script-code)

- [x] In master sheet: **Extensions → Apps Script**
- [x] Copy code from `scripts/AppsScript-Code.js` into the script editor (Code.gs)
- [x] Add `CountiesSidebar.html`: **File → New → HTML file**, name it `CountiesSidebar`, paste contents from `scripts/CountiesSidebar.html`
- [x] Build slug lookup: all slugs and slugs by state from Sites tab
- [x] Implement `expandCounties(val)`: `*`/empty → all slugs, `state:TX` → Texas slugs, else keep as-is
- [x] Expand `counties` for each company and ad row
- [x] Return `{ ok, companies, sites, ads, updated_at, etag }`
- [x] Deploy as web app: **Execute as: Me**, **Who has access: Anyone**
- [x] Copy deployment URL

### Step 3.2: Multi-Select Counties (Companies tab)

- [x] **Directory** menu appears in the sheet (from `onOpen`)
- [x] To edit counties: select a cell in Companies column J (counties), then **Directory → Select counties**
- [x] Sidebar opens with searchable list of ~700 counties, states, and `*` (all)
- [x] Check/uncheck, click **Apply** to write comma-separated values to the cell

### Step 3.3: Test Apps Script

- [x] `curl "YOUR_APPS_SCRIPT_URL"` returns valid JSON
- [x] Verify `companies`, `sites`, `ads` arrays present
- [x] Verify `counties` in companies are expanded (comma-separated slugs)
- [x] Verify `sites` have `slug`, `division_type`, `division_name`, `state`

---

## Phase 4: R2 Setup (for Ad Images)

**Ref**: [Ad Image Storage: GAM vs R2](migrate-to-single-spreadsheet.md#ad-image-storage-gam-vs-r2)

- [ ] Decide: **R2** (recommended) or **Google Ad Manager**
- [ ] If R2:
  - [ ] Create R2 bucket in Cloudflare dashboard
  - [ ] Configure public access or custom domain for image URLs
  - [ ] Document upload workflow: upload image → copy URL → paste in Ads tab `image_url`
- [ ] If GAM: Configure custom creatives and document tag/URL workflow

---

## Phase 5: Cloudflare Environment

### Step 5.1: Add Environment Variable

**Ref**: [Step 5: Add Environment Variable](migrate-to-single-spreadsheet.md#step-5-add-environment-variable)

- [x] Cloudflare Pages → **Settings → Environment Variables**
- [x] Add `MASTER_SHEET_URL` = your Apps Script deployment URL
- [x] Set for Production (and Preview if used)

---

## Phase 6: Code Changes

### Step 6.1: Update functions/_lib.js

**Ref**: [Step 7: Update functions/_lib.js](migrate-to-single-spreadsheet.md#step-7-update-functions_libjs), [Code Changes Reference](migrate-to-single-spreadsheet.md#functions_libjs--new-functions)

- [ ] Update `KV_KEYS(slug)` to use `directory:{slug}:*` prefix
- [ ] Add `getSlugFromPath(request)`, `loadDirectoryConfigFromKV(env, slug)`, `loadSitesRegistryFromKV(env)`
- [ ] Remove or keep `loadSitesRegistry` and `getSiteConfig` for rollback

### Step 6.2: Update functions/refresh.js

**Ref**: [Step 6: Update functions/refresh.js](migrate-to-single-spreadsheet.md#step-6-update-functions_refreshjs), [functions/refresh.js — New Logic](migrate-to-single-spreadsheet.md#functions_refreshjs--new-logic-pseudocode)

- [ ] Remove `getHost`, `loadSitesRegistry`, `getSiteConfig` imports
- [ ] Fetch `env.MASTER_SHEET_URL` (no query params)
- [ ] Parse `companies`, `sites`, `ads` (default ads to `[]`)
- [ ] For each site: filter companies by counties + hidden logic
- [ ] For each site: filter ads by counties (empty = all)
- [ ] Write `directory:{slug}:data`, `directory:{slug}:ads`, `directory:{slug}:config`, etag, updated_at
- [ ] Write `directory:index:config` with slug→config map
- [ ] Return `{ status: 'ok', sites_updated: N, duration_ms }`

### Step 6.3: Update functions/index.js and Routing

**Ref**: [Step 8: Update functions/index.js](migrate-to-single-spreadsheet.md#step-8-update-functions_indexjs-and-routing)

- [ ] Add path-based routing: GET /{slug} → county page; GET / → delegate to counties.js
- [ ] Use `getSlugFromPath(request)` and `loadDirectoryConfigFromKV(env, slug)`
- [ ] Load data from `directory:{slug}:data`, ads from `directory:{slug}:ads`
- [ ] In category section loop: for each category, filter ads by category, sort by priority desc, take first
- [ ] Prepend ad card to grid if ad exists: `<a href="${ad.link}"><img src="${ad.image_url}" alt="Sponsored" /></a>` with class `card card--ad`

### Step 6.4: Add Ad Card Styles

- [ ] Add `.card--ad` styles in `src/app.css` (image fills card, optional "Sponsored" label)
- [ ] Run `npm run build` to compile CSS

### Step 6.5: Update functions/counties.js

**Ref**: [Step 9: Update functions/counties.js](migrate-to-single-spreadsheet.md#step-9-update-functions_countiesjs)

- [ ] Replace `loadSitesRegistry()` with `loadSitesRegistryFromKV(env)`
- [ ] Update links to use path-based URLs: `https://directory.mineralrightsforum.com/${slug}`
- [ ] Use `display_label` from config for display

### Step 6.6: Update functions/sitemap.xml.js

**Ref**: [Step 10: Update functions/sitemap.xml.js](migrate-to-single-spreadsheet.md#step-10-update-functionssitemapxmljs)

- [ ] Load `directory:index:config` to get all slugs
- [ ] Generate sitemap: index (`/`) + one entry per slug (`/{slug}`)

### Step 6.7: Remove sites.json

**Ref**: [Step 11: Remove or Deprecate sites.json](migrate-to-single-spreadsheet.md#step-11-remove-or-deprecate-sitesjson)

- [ ] Delete `sites.json` from repo (or keep minimal fallback during transition)
- [ ] Ensure all code paths use KV; no imports of `sites.json`

---

## Phase 7: Deploy and Validate

### Step 7.1: Deploy

- [x] Commit all code changes
- [x] Push to `main` (or trigger Cloudflare Pages deploy)
- [x] Wait for deployment to complete

### Step 7.2: Run Initial Refresh

**Ref**: [Step 12: Run Initial Refresh](migrate-to-single-spreadsheet.md#step-12-run-initial-refresh)

- [x] **Immediately** after deploy, run refresh (before user traffic):
  ```bash
  curl -X POST https://directory.mineralrightsforum.com/refresh \
    -H "X-Refresh-Key: YOUR_REFRESH_KEY"
  ```
- [x] Verify response: `{ "status": "ok", "sites_updated": 78, ... }` (or your count)

### Step 7.3: Verify Endpoints

- [x] `curl https://directory.mineralrightsforum.com/reeves-county-texas` → 200, HTML page loads
- [x] Verify `/health` and `/data.json` for county pages (path structure depends on routing implementation)
- [x] Repeat for 2–3 other county slugs

### Step 7.4: Verify Pages in Browser

- [x] Visit `https://directory.mineralrightsforum.com/reeves-county-texas` — page loads, companies display
- [x] Visit `https://directory.mineralrightsforum.com` — counties index loads
- [x] Visit `https://directory.mineralrightsforum.com/sitemap.xml` — valid XML
- [ ] If Ads tab has data: verify ad card appears in category grid

### Step 7.5: Update Refresh Schedule

**Ref**: [Step 13: Update Refresh Schedule](migrate-to-single-spreadsheet.md#step-13-update-refresh-schedule)

- [ ] Update cron/trigger: **one** POST to `/refresh` (directory.mineralrightsforum.com)
- [ ] Remove per-site refresh calls (78 → 1)

### Step 7.6: Update DOCUMENTATION.md

**Ref**: [Step 14: Update DOCUMENTATION.md](migrate-to-single-spreadsheet.md#step-14-update-documentationmd)

- [ ] Update architecture: "Master Google Sheet (Companies + Sites + Ads)"
- [ ] Update Apps Script section: single script, `MASTER_SHEET_URL`
- [ ] Update KV structure: `directory:{slug}:config`, `directory:{slug}:ads`
- [ ] Document path-based URLs: `directory.mineralrightsforum.com/{slug}`
- [ ] Document counties multi-select and Ads tab
- [ ] Remove references to per-site `sheet.url` and `sites.json`

---

## Phase 8: Post-Migration

### Step 8.1: Add Test Ad (Optional)

- [ ] Add row to Ads tab: image_url (R2 URL), link, category (e.g. Attorneys), counties (e.g. `state:TX`), priority 10, active TRUE
- [ ] Run refresh
- [ ] Visit `https://directory.mineralrightsforum.com/reeves-county-texas` (or another Texas county), verify ad appears in Attorneys section

### Step 8.2: Rollback Plan (if needed)

**Ref**: [Rollback Plan](migrate-to-single-spreadsheet.md#rollback-plan)

- [ ] Keep `backup-pre-migration` branch
- [ ] If rollback: revert code, restore `sites.json`, remove `MASTER_SHEET_URL`, re-run per-site refresh

---

## Phase 9: Styling

- [ ] Apply real styling to directory pages (next session)

---

## Quick Reference: Key URLs and Commands

| Item | Value |
|------|-------|
| Refresh endpoint | `POST https://directory.mineralrightsforum.com/refresh` |
| County page | `GET https://directory.mineralrightsforum.com/{slug}` |
| Counties index | `GET https://directory.mineralrightsforum.com/` |
| Refresh header | `X-Refresh-Key: YOUR_REFRESH_KEY` |

---

## Validation Checklist Summary

**Ref**: [Validation Checklist](migrate-to-single-spreadsheet.md#validation-checklist)

- [ ] All items in migration plan Validation Checklist completed
- [ ] No 500/503 errors on county pages
- [ ] Counties index groups by state correctly
- [ ] Ads display when configured

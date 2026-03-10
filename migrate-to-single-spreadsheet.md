# Migration Plan: Single Master Spreadsheet (No Astro)

This document provides a detailed, step-by-step plan to migrate from **78 separate Google Sheets** to **one master spreadsheet** with three tabs (Companies + Sites + Ads). The existing Cloudflare Pages Functions architecture remains unchanged; only the data source and refresh logic change. The structure supports expansion to ~700 counties across ~20 states.

**For a sequential execution checklist**, see [MIGRATION-STEP-BY-STEP.md](MIGRATION-STEP-BY-STEP.md).

---

## Table of Contents

1. [Overview](#overview)
2. [Current vs Target Architecture](#current-vs-target-architecture)
3. [Master Spreadsheet Structure](#master-spreadsheet-structure)
4. [Counties Multi-Select and Sites Reference](#counties-multi-select-and-sites-reference)
5. [Sponsored Ads (Image Ads)](#sponsored-ads-image-ads)
6. [Ad Image Storage: GAM vs R2](#ad-image-storage-gam-vs-r2)
7. [Step-by-Step Migration](#step-by-step-migration)
8. [Adding a New County (Post-Migration)](#adding-a-new-county-post-migration)
9. [Code Changes Reference](#code-changes-reference)
10. [Apps Script Code](#apps-script-code)
11. [Migration Script (Node.js)](#migration-script-nodejs)
12. [Refresh Workflow](#refresh-workflow)
13. [Validation Checklist](#validation-checklist)
14. [Rollback Plan](#rollback-plan)

---

## Overview

**Goal**: Consolidate 78 county-specific Google Sheets into one master spreadsheet. Move all per-site metadata from `sites.json` into a Sites tab. Update the refresh logic to fetch once from the master sheet and populate Cloudflare KV for all sites.

**What stays the same**:
- Cloudflare Pages Functions (`functions/index.js`, `counties.js`, etc.)
- Tailwind CSS, deployment, custom domains
- Page rendering, search, filters, GTM, JSON-LD

**What changes**:
- Data source: 1 master sheet instead of 78
- Apps Script: 1 script reading 2 tabs instead of 78 scripts
- `sites.json`: Removed from repo; site config stored in KV
- `functions/refresh.js`: Fetches master, updates all sites in one call
- `functions/_lib.js`: Loads site config from KV instead of `sites.json`
- `functions/index.js`, `counties.js`, `sitemap.xml.js`: Use KV for config

---

## Current vs Target Architecture

### Current

```
78 Google Sheets → 78 Apps Script URLs → (per-site refresh) → Cloudflare KV
sites.json (in repo) → loadSitesRegistry() → getSiteConfig(host)
```

- Each site has its own sheet and Apps Script URL in `sites.json`
- POST to `https://reeves-county-texas.mineralrightsforum.com/refresh` fetches that site's sheet only
- Site config (SEO, titles, etc.) lives in `sites.json`

### Target

```
1 Master Google Sheet (Companies + Sites + Ads tabs) → 1 Apps Script → (single refresh) → Cloudflare KV
Path-based URLs: https://directory.mineralrightsforum.com/{slug}
KV keys: directory:{slug}:data, directory:{slug}:config, directory:{slug}:ads
```

- **Path-based URLs**: County pages live at `https://directory.mineralrightsforum.com/{slug}` (e.g. `/baldwin-county-alabama`). The index is at `https://directory.mineralrightsforum.com/`. (Base domain is `directory.mineralrightsforum.com` — singular.)
- One master sheet with Companies, Sites, and Ads tabs
- One Apps Script URL in env var `MASTER_SHEET_URL`
- POST to `https://directory.mineralrightsforum.com/refresh` fetches master sheet and updates KV for all directories
- Config and data loaded from `directory:{slug}:config`, `directory:{slug}:data`, etc. in KV

---

## Master Spreadsheet Structure

### Tab 1: Companies

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `name` | string | Yes | Company name | "Smith & Associates" |
| `category` | string | Yes | Service category | "Attorneys" |
| `description_short` | string | Yes | Brief description | "Oil & gas attorneys serving..." |
| `plan` | string | Yes | `premium`, `free`, or `hidden` | "premium" |
| `website_url` | string | No | Company website | "https://example.com?utm_adv=CompanyName" |
| `logo_url` | string | No | Logo image URL | "https://example.com/logo.png" |
| `contact_email` | string | No | Email | "info@example.com" |
| `contact_phone` | string | No | Phone | "(555) 123-4567" |
| `hidden` | boolean | No | Alternative to plan=hidden | FALSE |
| `counties` | string | Yes | Comma-separated county slugs | "reeves-county-texas, ward-county-texas" |

**`counties` format**: See [Counties Multi-Select and Sites Reference](#counties-multi-select-and-sites-reference) below. Supports `*` (all counties), `state:TX` (all Texas counties), or comma-separated slugs. The Apps Script expands state codes at read time using the Sites tab.

**Multi-county companies**: To list a company on multiple county pages, use the multi-select syntax: `*` for all, `state:TX` for all Texas, or `reeves-county-texas, ward-county-texas, midland-county-texas` for specific counties.

### Tab 2: Sites (Counties)

The Sites tab is the **source of truth for all directory pages**. It defines slug, division type (county/parish/area), display name, SEO, and metadata. Both Companies and Ads reference this tab for county selection (via `state` and slug).

**Data source**: The [Comprehensive Counties List](https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY/edit) spreadsheet has all counties in column B (URLs like `baldwin-county-alabama.mineralrightsforum.com`). Parse the slug from column B (everything before `.mineralrightsforum.com`). Skip rows with "New State Below" or other non-county entries.

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `slug` | string | Yes | URL path segment; full URL = `directory.mineralrightsforum.com/{slug}` | "baldwin-county-alabama" |
| `state` | string | No* | State code (2-letter) for grouping and multi-select. Blank for areas like Permian Basin. | "TX" |
| `division_type` | string | Yes | `county`, `parish`, or `area` — controls display wording | "county" |
| `division_name` | string | Yes | Display name (Baldwin, Orleans, Permian Basin, La Plata) | "Baldwin" |
| `page_title` | string | Yes | Main heading (use `\n` for line break) | "Baldwin County, AL Mineral Rights\nProfessionals Directory" |
| `return_url` | string | Yes | Back-to-forum link | "https://www.mineralrightsforum.com/c/alabama-mineral-rights/baldwin-county-al/741" |
| `directory_intro` | string | Yes | Page description (text at top). Use template with `{display_name}` placeholder; same for all except the name. | "Since 2009, the Mineral Rights Forum has helped thousands of mineral owners... Use this directory to find professionals serving {display_name}." |
| `seo_title` | string | Yes | Page title tag | "Baldwin County AL Mineral Rights \| Oil & Gas Directory" |
| `seo_description` | string | Yes | Meta description | "Find trusted Baldwin County, AL mineral rights..." |
| `category_order` | string | No | `alpha` or comma-separated custom order | "alpha" |
| `theme` | string | No | Theme name | "default" |

**Display logic** (built from `division_type` + `division_name` + `state`):
- `county` → "{division_name} County, {state}" (e.g. "Baldwin County, Alabama")
- `parish` → "{division_name} Parish, {state}" (e.g. "Orleans Parish, Louisiana")
- `area` → "{division_name}" only — **do not use "County" or "Parish"** (e.g. "Permian Basin")

**Permian Basin**: Slug `permian-basin` is an area, not a county. Use `division_type` = `area`, `division_name` = "Permian Basin", `state` = "TX" or blank. Never append "County" when displaying.

**Row order**: One row per directory. Include all counties, parishes, and areas (e.g. Permian Basin). Exclude "New State Below" and other separator rows. Structure supports ~700 counties across ~20 states.

**`page_title` newlines**: Use either (a) an actual line break in the cell (Alt+Enter in Google Sheets) or (b) the literal characters `\n`. The frontend expects a newline character for the break; if you use `\n`, the Apps Script or migration script should convert it to a real newline when building the config.

---

## Counties Multi-Select and Sites Reference

The `counties` column in **Companies** and **Ads** must reference the Sites tab. Valid values:

| Value | Meaning |
|-------|---------|
| `*` | All counties (all slugs from Sites tab) |
| `state:TX` | All counties in Texas (slugs where Sites.state = `TX`) |
| `state:OK` | All counties in Oklahoma |
| `reeves-county-texas, ward-county-texas` | Specific comma-separated slugs |
| *(empty)* | All counties (same as `*`) |

**State codes**: Use 2-letter codes (TX, OK, NM, LA, etc.) that match the `state` column in the Sites tab. The Apps Script expands `state:TX` to all slugs for that state from the Sites tab. For Companies, the migration script or manual entry must populate `counties`; for Ads, same logic.

**Multi-select UX**: Use the **Counties Reference** sheet in the master spreadsheet. It lists:
- `*` = All counties
- `state:TX` = All Texas (and `state:XX` for each state)
- Individual slugs for specific counties

Run `node scripts/add-counties-reference.js SPREADSHEET_ID` to create/update this sheet. Use Data Validation (list from range) on the Companies `counties` column, pointing to `Counties Reference!A2:A` for the dropdown (or copy-paste from the sheet).

---

## Sponsored Ads (Image Ads)

A third tab **Ads** stores sponsored image placements. Each ad appears as the first card in a category grid on matching county pages.

### Tab 3: Ads

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `image_url` | string | Yes | Image URL (R2 or any) | `https://pub-xxx.r2.dev/ads/attorney-banner.png` |
| `link` | string | Yes | Target URL on click | `https://example.com?utm_adv=attorneys` |
| `category` | string | Yes | Must match a Companies category | `Attorneys` |
| `counties` | string | No | Same format as Companies: `*`, `state:TX`, or comma-separated slugs | `state:TX` or blank |
| `priority` | number | No | Higher = shown when multiple match (default 0) | `10` |
| `active` | boolean | No | If false, skip (default true) | `TRUE` |

**Placement**: Ads appear as the first card in the category grid on matching county pages. One ad per category per page (highest priority wins).

**Category matching**: Must match exactly (case-insensitive) a category that exists in Companies data. If the category has no companies on a county page, the ad still shows if that category section exists.

---

## Ad Image Storage: GAM vs R2

**Recommendation: Use R2** for simplicity.

| Approach | Pros | Cons |
|----------|------|------|
| **R2** | Full control; upload image, get URL, paste in spreadsheet. No external ad server. Same Cloudflare stack as Pages. | No built-in impression/click reporting. |
| **Google Ad Manager (GAM)** | Impression and click reporting; ad serving infrastructure. | Requires GAM integration; custom creatives need to be configured in GAM; more complex setup. |

**R2 workflow**: Upload images to Cloudflare R2 bucket, set public access or use signed URLs. Copy the public URL into the `image_url` column. No code changes needed for storage; the app only consumes the URL.

**GAM workflow** (if chosen): Create custom creative in GAM, get the tag/URL. The spreadsheet would store the GAM creative ID or tag URL. The frontend would need to load the GAM tag instead of a simple `<img>` + `<a>`. More complex; only recommended if reporting is required.

---

## Step-by-Step Migration

### Step 0: Backup Before Migration

1. **Create a git branch**: `git checkout -b backup-pre-migration` and commit the current state.
2. **Backup sites.json**: Copy `sites.json` to a safe location (e.g. `sites.json.backup`).
3. **Backup the 78 sheets**: Consider exporting each sheet to CSV or making copies in Google Drive. If rollback is needed, you may need to re-run the migration from the original sheets.

---

### Step 1: Create the Master Google Sheet

1. Create a new Google Sheet (e.g. "MRF Directory Master").
2. Rename the first tab to **Companies**.
3. Add the header row in row 1:
   ```
   name | category | description_short | plan | website_url | logo_url | contact_email | contact_phone | hidden | counties
   ```
4. Create a second tab named **Sites**.
5. Add the header row in row 1:
   ```
   slug | state | division_type | division_name | page_title | return_url | directory_intro | seo_title | seo_description | category_order | theme
   ```
6. Create a third tab named **Ads**.
7. Add the header row in row 1:
   ```
   image_url | link | category | counties | priority | active
   ```
8. Do **not** populate data yet; that happens in Step 3 and 4.

---

### Step 2: Build and Run the Migration Script

The migration script does two things:
1. Reads all 78 existing Google Sheets and merges company rows into the Companies tab, adding the correct `counties` value for each row.
2. Populates the Sites tab (from `sites.json` or from the [Comprehensive Counties List](https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY/edit)).

**Prerequisites**:
- Node.js 18+
- Access to all 78 sheet IDs (from `sites.json` — extract from each `sheet.url` query param `sheetId=...`)
- Google Sheets API credentials (service account or OAuth) **or** manual export/import

**Google Sheets API credentials (Option A)**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/), create or select a project
2. Enable **Google Sheets API** (APIs & Services → Library → search "Google Sheets API")
3. Create a **Service Account** (APIs & Services → Credentials → Create Credentials → Service Account)
4. Download the JSON key file. Store securely (e.g. `./google-credentials.json`)
5. Add `google-credentials.json` to `.gitignore` — never commit it
6. Share the master sheet and source sheets with the service account email (e.g. `xxx@project.iam.gserviceaccount.com`) with Editor access
7. Set `GOOGLE_APPLICATION_CREDENTIALS` env var to the path of the JSON file, or pass the path as a CLI argument to the migration script

**Option A: Automated script with Google Sheets API**

- Enable Google Sheets API for your project.
- Create a service account, download JSON key.
- Use `googleapis` npm package to read each sheet and the master sheet.
- Script logic:
  - For each entry in `sites.json`: extract `sheetId` from `sheet.url`, read that sheet's data, append each row to Companies tab with `counties` = slug derived from domain (e.g. `reeves-county-texas`).
  - For each entry in `sites.json`: create a row in Sites tab with slug, serving_line, page_title, return_url, directory_intro, seo.title, seo.description, category_order, theme.

**Option B: Semi-manual with CSV export**

- Export each of the 78 sheets to CSV.
- Write a Node.js script that:
  - Reads each CSV, adds a `counties` column (from the sheet's domain in `sites.json`), concatenates into one Companies CSV.
  - Reads `sites.json`, outputs a Sites CSV.
- Import Companies CSV into the Companies tab and Sites CSV into the Sites tab.

**Slug derivation**: For domain `reeves-county-texas.mineralrightsforum.com`, slug = `reeves-county-texas` (everything before `.mineralrightsforum.com`).

**State derivation**: For slug `reeves-county-texas`, state = last segment after `county-` or `parish-` (e.g. `texas` → `TX`). The migration script should map full state names to 2-letter codes: texas→TX, oklahoma→OK, new-mexico→NM, louisiana→LA, etc. Populate the `state` column in the Sites tab from this mapping.

**Getting the exact site count**: Run this in Node to count county/parish entries in `sites.json`:
```javascript
const sites = require('./sites.json');
const count = Object.keys(sites).filter(d => 
  (d.includes('-county-') || d.includes('-parish-')) && 
  d.includes('.mineralrightsforum.com') &&
  !d.includes('mineral-services-directory') &&
  !d.includes('permian-basin')
).length;
console.log(count); // Use this for Sites tab row count
```

**Duplicate companies**: If the same company appears in multiple sheets (same name, category, etc.), you have two choices:
- **Deduplicate**: Keep one row and put all relevant county slugs in `counties`.
- **Keep separate**: Keep multiple rows if they have different data per county.

**Migration script column mapping**: Existing sheets may have columns in different orders. The migration script should map by **header name**, not column position. When appending to the master Companies tab, ensure the `counties` column is added and populated with the correct slug for each row.

---

### Step 3: Populate the Sites Tab

**Option A: From Comprehensive Counties List**

Use the [Comprehensive Counties List](https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY/edit) (column B has URLs). For each row in column B:
- Parse slug: `baldwin-county-alabama.mineralrightsforum.com` → `baldwin-county-alabama`
- Skip "New State Below" and other non-county rows
- Derive `division_type`: if slug contains `parish` → `parish`; if slug is `permian-basin` → `area`; else → `county`
- Derive `division_name`: parse from slug (e.g. `baldwin-county-alabama` → "Baldwin"; `la-plata-county-colorado` → "La Plata"; `permian-basin` → "Permian Basin")
- Derive `state`: last segment after `county-` or `parish-` (e.g. `alabama` → `AL`). Blank for `area` type.
- Populate remaining columns (page_title, return_url, directory_intro, seo_title, seo_description) — use templates with `{display_name}` for directory_intro

**Option B: From sites.json (for existing 78)**

If migrating from current `sites.json`:
1. For each county/parish domain (exclude `mineral-services-directory`, `permian-basin`):
2. Extract slug: `reeves-county-texas.mineralrightsforum.com` → `reeves-county-texas`
3. Set `division_type` = `parish` if slug contains `parish`, else `county`
4. Set `division_name` from slug (e.g. "Reeves", "Orleans")
5. Set `state` from slug (e.g. `texas` → `TX`)
6. Copy page_title, return_url, directory_intro, seo_title, seo_description, category_order, theme from `sites.json`

---

### Step 4: Create the New Apps Script

1. In the master Google Sheet, go to **Extensions → Apps Script**.
2. Create a new script (or replace existing).
3. Implement the `doGet` function to:
   - Read the **Companies** sheet: all rows, headers in row 1.
   - Read the **Sites** sheet: all rows, headers in row 1.
   - Read the **Ads** sheet (if present): all rows, headers in row 1.
   - Build `companies` array: each row becomes an object with keys from headers (lowercase, spaces to underscores). **Expand `counties`**: if value is `*` or empty, replace with comma-separated list of all slugs from Sites; if value starts with `state:`, expand to slugs for that state from Sites; otherwise keep as-is.
   - Build `sites` array: each row becomes an object with keys from headers. Add `domain = slug + '.mineralrightsforum.com'`. Ensure `seo` is `{ title: seo_title, description: seo_description }`.
   - Build `ads` array: each row becomes an object. **Expand `counties`** same as Companies. Filter out rows where `active` is false.
   - Return JSON: `{ ok: true, companies: [...], sites: [...], ads: [...], updated_at: ISO string, etag: hash }`.
4. Deploy as web app: **Execute as: Me**, **Who has access: Anyone**.
5. Copy the deployment URL (e.g. `https://script.google.com/macros/s/.../exec`).
6. Test: `curl "YOUR_APPS_SCRIPT_URL"` and verify you get valid JSON with `companies`, `sites`, and `ads` arrays.

See [Apps Script Code](#apps-script-code) below for a full implementation.

---

### Step 5: Add Environment Variable

1. In Cloudflare Pages dashboard: **Settings → Environment Variables**.
2. Add:
   - **Name**: `MASTER_SHEET_URL`
   - **Value**: Your Apps Script deployment URL (e.g. `https://script.google.com/macros/s/.../exec`)
   - **Environment**: Production (and Preview if you use it)

---

### Step 6: Update functions/refresh.js

Replace the refresh logic so that:

1. On POST `/refresh` (with valid `X-Refresh-Key`):
2. Fetch `env.MASTER_SHEET_URL` (no query params needed).
3. Parse response; validate `ok`, `companies` (array), `sites` (array). Accept `ads` (array) or default to `[]`.
4. For each site in `sites`:
   - Skip if `site.slug` is empty.
   - `slug` = `site.slug` (e.g. `baldwin-county-alabama`)
   - Filter `companies` where `counties` (split by comma, trim, lowercase) includes `slug` (case-insensitive).
   - Filter out hidden companies using the **full** hidden logic from current `refresh.js`: `plan` in (hidden, hide, h), `hidden` (true, 'true', 'yes', 1, 'hidden', 'hide'), `status === 'hidden'`, `visible === false`, `show === false`.
   - Filter `ads` for this site: `counties` (split by comma, trim, lowercase) includes `slug` OR `counties` is empty/whitespace (all counties).
   - Build config with: `division_type`, `division_name`, `state`, `page_title`, `return_url`, `directory_intro`, `seo: {title, description}`, `category_order`, `theme`. Build `display_label` from division_type + division_name + state (see Display logic in Sites tab).
   - Write to KV:
     - `directory:{slug}:data` = JSON.stringify(filtered companies)
     - `directory:{slug}:ads` = JSON.stringify(filtered ads for this site)
     - `directory:{slug}:config` = JSON.stringify(config)
     - `directory:{slug}:etag` = hash of companies
     - `directory:{slug}:updated_at` = ISO timestamp
     - Delete `directory:{slug}:last_error` on success
5. Write `directory:index:config` = JSON object mapping each `slug` to its config (for counties index). Shape: `{ "baldwin-county-alabama": { slug, division_type, division_name, state, page_title, ... }, ... }`.
6. Return JSON: `{ status: 'ok', sites_updated: 78, duration_ms: ... }`.

**Error handling**:
- If fetch fails or response invalid: return 502 immediately; do not write to KV.
- If a single site fails during the loop (e.g. invalid slug, write error): consider continuing with other sites and logging the failure. Optionally store `last_error` for the failed host. Return 200 with a warning in the response body if some sites failed (e.g. `{ status: 'ok', sites_updated: 77, sites_failed: 1, errors: [...] }`), or return 502 to fail the whole refresh. For simplicity, recommend: abort on first error and return 502.

**Empty rows**: The Apps Script may return company rows with empty `name`. The current `index.js` does not explicitly filter these. Consider filtering out rows where `name` is empty or whitespace in the refresh before writing to KV, to avoid blank cards on the directory page.

---

### Step 7: Update functions/_lib.js

1. Add `getSlugFromPath(request)`: Extract slug from path (e.g. `/baldwin-county-alabama` → `baldwin-county-alabama`). Root path `/` returns null.

2. Add new function `loadDirectoryConfigFromKV(env, slug)`:
   - `keys = KV_KEYS(slug)` (uses `directory:` prefix)
   - `configKey = 'directory:' + slug + ':config'`
   - `const raw = await env.DIRECTORIES_KV.get(configKey)`
   - If !raw, throw new Error(`No config for slug: ${slug}`)
   - Return `JSON.parse(raw)`

3. Add new function `loadSitesRegistryFromKV(env)`:
   - `const raw = await env.DIRECTORIES_KV.get('directory:index:config')`
   - If !raw, throw new Error('No sites registry in KV')
   - Return `JSON.parse(raw)` — this is the `{ [slug]: config }` map

4. **Keep** `loadSitesRegistry()` and `getSiteConfig()` for backward compatibility during transition, or remove them once all callers use KV. The plan assumes we **remove** usage of `sites.json` and use KV only.

---

### Step 8: Update functions/index.js and Routing

**Routing**: With path-based URLs, the county page handler must run for `GET /{slug}`. Use a dynamic route (e.g. `[[path]].js` or `[slug].js`) that catches paths like `/baldwin-county-alabama`. Root `GET /` is handled by counties.js (index page).

1. Change the import: add `getSlugFromPath`, `loadDirectoryConfigFromKV` from `_lib.js`.
2. Extract slug from request path: `slug = getSlugFromPath(request)`. If slug is null or empty, delegate to counties.js (index).
3. Replace the site config loading: `site = await loadDirectoryConfigFromKV(env, slug)`.
4. Load data from KV: `directory:{slug}:data` (companies), `directory:{slug}:ads` (JSON array). Default ads to `[]` if missing.
5. In the section loop (where category sections are built): for each category, filter ads where `category` matches (case-insensitive). Sort by `priority` descending. Take the first (highest priority). If an ad exists, prepend an ad card as the first item in the category grid: `<a href="${ad.link}" target="_blank" rel="noopener"><img src="${ad.image_url}" alt="Sponsored" /></a>` with class `card card--ad`.
6. Add `.card--ad` styles in `src/app.css` so the ad card fits the grid and is visually distinct (e.g. "Sponsored" label).
7. Replace `{display_name}` in `directory_intro` with the computed display label (from `division_type` + `division_name` + `state`).
8. The `site` object must have: `division_type`, `division_name`, `state`, `display_label`, `seo`, `page_title`, `return_url`, `directory_intro`, `category_order`, `theme`.

---

### Step 9: Update functions/counties.js

1. Change the import: use `loadSitesRegistryFromKV` instead of `loadSitesRegistry`.
2. Replace: `sites = await loadSitesRegistry()` with `sites = await loadSitesRegistryFromKV(env)`.
3. The structure of `sites` is now `{ [slug]: config }` (not domain). Update any logic that assumed domain keys — use slug for links: `https://directory.mineralrightsforum.com/${slug}`.
4. Use `display_label` from config for display (or build from `division_type` + `division_name` + `state`).

---

### Step 10: Update functions/sitemap.xml.js

1. **Path-based**: Base URL is `https://directory.mineralrightsforum.com`. Load `directory:index:config` to get all slugs.
2. Sitemap entries: index page (`/`), plus one entry per slug (`/{slug}`).
3. Ensure the handler receives `env` (Cloudflare Pages passes it to `onRequestGet`).

**Example logic**:
```javascript
const baseUrl = 'https://directory.mineralrightsforum.com';
const sitesMap = await loadSitesRegistryFromKV(env); // { slug: config }
const slugs = Object.keys(sitesMap);
// Build sitemap: baseUrl/, baseUrl/baldwin-county-alabama, baseUrl/butler-county-alabama, ...
```

---

### Step 11: Remove or Deprecate sites.json

1. **Option A**: Delete `sites.json` from the repo. The app will fail if KV is empty (no config), so ensure refresh has been run at least once before deploy.
2. **Option B**: Keep a minimal `sites.json` with only a comment or empty object as a fallback during transition. Not required if all code paths use KV.

**Recommended**: Remove `sites.json` after validation. The single source of truth is the master sheet; KV is the cache.

---

### Step 12: Run Initial Refresh

1. Deploy the updated code to Cloudflare Pages.
2. Ensure `MASTER_SHEET_URL` is set in the environment.
3. **Run refresh immediately** after deploy — before any user traffic. Until refresh runs, KV has no config and pages will return 500 "No config for host".
4. Trigger refresh:
   ```bash
   curl -X POST https://reeves-county-texas.mineralrightsforum.com/refresh \
     -H "X-Refresh-Key: YOUR_REFRESH_KEY"
   ```
4. The response should indicate `sites_updated: 78` (or similar).
5. Verify a few sites:
   ```bash
   curl https://reeves-county-texas.mineralrightsforum.com/health
   curl https://reeves-county-texas.mineralrightsforum.com/data.json
   ```
6. Visit `https://reeves-county-texas.mineralrightsforum.com` and `https://directory.mineralrightsforum.com` in a browser.

---

### Step 13: Update Refresh Schedule

If you use a cron or scheduled job to refresh:

- **Before**: 78 separate POST requests (one per site).
- **After**: One POST request to any site's `/refresh` (e.g. `https://directory.mineralrightsforum.com/refresh` or any county subdomain). That single call updates all 78 sites.

Update your cron script or Google Apps Script trigger to call the refresh endpoint once.

---

### Step 14: Update DOCUMENTATION.md

Update the project's `DOCUMENTATION.md` to reflect the new architecture:

- Change "Google Sheets (78 separate)" to "Master Google Sheet (Companies + Sites + Ads tabs)"
- Update the Apps Script section to describe the single script and `MASTER_SHEET_URL`
- Update the refresh workflow to "one call updates all sites"
- Update the KV namespace structure to include `directory:{slug}:config`, `directory:{slug}:ads`
- Document path-based URLs: `directory.mineralrightsforum.com/{slug}`
- Document counties multi-select (`*`, `state:TX`, comma-separated slugs)
- Document Ads tab and R2 image workflow
- Remove references to per-site `sheet.url` in `sites.json`

---

## Adding a New County (Post-Migration)

After the migration, to add a new directory page:

1. **Add row to Sites tab**: slug, state, division_type, division_name, page_title, return_url, directory_intro, seo_title, seo_description, category_order, theme.
2. **Add companies** (optional): Add rows to Companies tab with the new slug in the `counties` column (or use `state:TX` etc.).
3. **Run refresh**: `curl -X POST https://directory.mineralrightsforum.com/refresh -H "X-Refresh-Key: YOUR_KEY"`.

No code changes, DNS, or custom domains needed — path-based URLs use a single domain.

---

## Code Changes Reference

### functions/_lib.js — New Functions

```javascript
export const KV_KEYS = (slug) => ({
  data: `directory:${slug}:data`,
  config: `directory:${slug}:config`,
  ads: `directory:${slug}:ads`,
  etag: `directory:${slug}:etag`,
  updated: `directory:${slug}:updated_at`,
  lastError: `directory:${slug}:last_error`,
});

export function getSlugFromPath(request) {
  const path = new URL(request.url).pathname.replace(/^\/|\/$/g, '');
  return path || null;
}

export async function loadDirectoryConfigFromKV(env, slug) {
  const key = `directory:${slug}:config`;
  const raw = await env.DIRECTORIES_KV.get(key);
  if (!raw) throw new Error(`No config for slug: ${slug}`);
  return JSON.parse(raw);
}

export async function loadSitesRegistryFromKV(env) {
  const key = 'directory:index:config';
  const raw = await env.DIRECTORIES_KV.get(key);
  if (!raw) throw new Error('No sites registry in KV');
  return JSON.parse(raw);
}
```

Note: `functions/health.js` and `functions/data.json.js` need updates for path-based routing — they receive requests with path (e.g. `/baldwin-county-alabama`), so extract slug from path and use `directory:{slug}:*` keys. `data.json` returns companies only; ads are rendered server-side in the HTML.

### functions/refresh.js — New Logic (Pseudocode)

**Imports**: `import { json, KV_KEYS, quickHash } from './_lib.js';` (remove `getHost`, `loadSitesRegistry`, `getSiteConfig`).

```javascript
export const onRequestPost = async ({ request, env }) => {
  const provided = request.headers.get('X-Refresh-Key');
  if (!provided || provided !== env.REFRESH_KEY) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = env.MASTER_SHEET_URL;
  if (!url) return json({ ok: false, error: 'MASTER_SHEET_URL not set' }, { status: 500 });

  const t0 = Date.now();
  let upstream;
  try {
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`Apps Script ${res.status}`);
    upstream = await res.json();
  } catch (err) {
    return json({ ok: false, error: 'Fetch failed' }, { status: 502 });
  }

  if (!upstream?.ok || !Array.isArray(upstream.companies) || !Array.isArray(upstream.sites)) {
    return json({ ok: false, error: 'Invalid upstream response' }, { status: 502 });
  }
  const ads = Array.isArray(upstream.ads) ? upstream.ads : [];

  let sitesUpdated = 0;
  const sitesMap = {};

  for (const site of upstream.sites) {
    const slug = String(site.slug || '').trim();
    if (!slug) continue; // Skip sites with empty slug

    const slugLower = slug.toLowerCase();
    const companiesForSite = upstream.companies.filter(row => {
      const rowCounties = String(row.counties || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      if (!rowCounties.includes(slugLower)) return false;
      // Filter hidden (match current refresh.js logic)
      const plan = String(row.plan || '').toLowerCase().trim();
      if (plan === 'hidden' || plan === 'hide' || plan === 'h') return false;
      if (row.hidden === true || row.hidden === 'true' || row.hidden === 'yes' || row.hidden === 1) return false;
      if (String(row.hidden || '').toLowerCase().trim() === 'hidden' || String(row.hidden || '').toLowerCase().trim() === 'hide') return false;
      if (row.status === 'hidden' || String(row.status || '').toLowerCase().trim() === 'hidden') return false;
      if (row.visible === false || row.visible === 'false') return false;
      if (row.show === false || row.show === 'false') return false;
      return true;
    });

    const adsForSite = ads.filter(ad => {
      const adCounties = String(ad.counties || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      return adCounties.length === 0 || adCounties.includes(slugLower);
    });

    const displayLabel = buildDisplayLabel(site.division_type, site.division_name, site.state);
    const config = {
      slug,
      division_type: site.division_type || 'county',
      division_name: site.division_name || '',
      state: site.state || '',
      display_label: displayLabel,
      page_title: site.page_title,
      return_url: site.return_url,
      directory_intro: (site.directory_intro || '').replace(/\{display_name\}/g, displayLabel),
      seo: { title: site.seo_title, description: site.seo_description },
      category_order: site.category_order || 'alpha',
      theme: site.theme || 'default',
    };

    const keys = KV_KEYS(slug);
    await env.DIRECTORIES_KV.put(keys.data, JSON.stringify(companiesForSite));
    await env.DIRECTORIES_KV.put(keys.ads, JSON.stringify(adsForSite));
    await env.DIRECTORIES_KV.put(keys.config, JSON.stringify(config));
    await env.DIRECTORIES_KV.put(keys.etag, quickHash(companiesForSite));
    await env.DIRECTORIES_KV.put(keys.updated, upstream.updated_at || new Date().toISOString());
    await env.DIRECTORIES_KV.delete(keys.lastError);

    sitesMap[slug] = config;
    sitesUpdated++;
  }

  await env.DIRECTORIES_KV.put('directory:index:config', JSON.stringify(sitesMap));

  return json({
    status: 'ok',
    sites_updated: sitesUpdated,
    duration_ms: Date.now() - t0,
  });
};
```

**buildDisplayLabel helper**: `county` → "{division_name} County, {state}"; `parish` → "{division_name} Parish, {state}"; `area` → "{division_name}" only (no County/Parish).

**Important**: The filter for companies uses `row.counties` — ensure the Companies tab uses that exact column name. The slug comparison should be case-insensitive.

---

## Apps Script Code

```javascript
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const companiesSheet = ss.getSheetByName('Companies');
    const sitesSheet = ss.getSheetByName('Sites');
    const adsSheet = ss.getSheetByName('Ads');

    if (!companiesSheet || !sitesSheet) {
      return jsonResponse({ ok: false, error: 'Companies or Sites sheet not found' });
    }

    const companiesData = companiesSheet.getDataRange().getValues();
    const sitesData = sitesSheet.getDataRange().getValues();

    const companyHeaders = companiesData[0].map(h => String(h || '').toLowerCase().replace(/\s+/g, '_'));
    const siteHeaders = sitesData[0].map(h => String(h || '').toLowerCase().replace(/\s+/g, '_'));

    // Build sites array and slug lookup maps
    const sites = [];
    const allSlugs = [];
    const slugsByState = {};
    for (let i = 1; i < sitesData.length; i++) {
      const row = sitesData[i];
      const obj = {};
      siteHeaders.forEach((h, j) => { obj[h] = row[j] !== undefined && row[j] !== null ? row[j] : ''; });
      const slug = String(obj.slug || '').trim();
      if (!slug) continue;
      sites.push(obj);
      allSlugs.push(slug.toLowerCase());
      const state = String(obj.state || '').trim().toUpperCase();
      if (state) {
        if (!slugsByState[state]) slugsByState[state] = [];
        slugsByState[state].push(slug.toLowerCase());
      }
    }

    function expandCounties(val) {
      const v = String(val || '').trim();
      if (!v || v === '*') return allSlugs.join(', ');
      const m = v.match(/^state:([a-zA-Z]{2})$/i);
      if (m) {
        const stateSlugs = slugsByState[m[1].toUpperCase()] || [];
        return stateSlugs.join(', ');
      }
      return v; // Already comma-separated slugs
    }

    const companies = [];
    for (let i = 1; i < companiesData.length; i++) {
      const row = companiesData[i];
      const obj = {};
      companyHeaders.forEach((h, j) => { obj[h] = row[j] !== undefined && row[j] !== null ? row[j] : ''; });
      obj.counties = expandCounties(obj.counties);
      companies.push(obj);
    }

    let ads = [];
    if (adsSheet) {
      const adsData = adsSheet.getDataRange().getValues();
      const adHeaders = adsData[0].map(h => String(h || '').toLowerCase().replace(/\s+/g, '_'));
      for (let i = 1; i < adsData.length; i++) {
        const row = adsData[i];
        const obj = {};
        adHeaders.forEach((h, j) => { obj[h] = row[j] !== undefined && row[j] !== null ? row[j] : ''; });
        const active = obj.active;
        if (active === false || active === 'false' || active === 'FALSE' || active === 0) continue;
        obj.counties = expandCounties(obj.counties);
        ads.push(obj);
      }
    }

    const updated_at = new Date().toISOString();
    const etag = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify({ companies, sites, ads }))
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

    return jsonResponse({
      ok: true,
      companies,
      sites,
      ads,
      updated_at,
      etag,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Note**: The Apps Script normalizes headers to lowercase with underscores. Ensure your sheet headers match the expected names (`seo_title`, `seo_description`, `state`, `division_type`, `division_name`, etc.). The `expandCounties` helper expands `*` or empty to all slugs, `state:TX` to all Texas slugs, and leaves comma-separated slugs as-is.

**Optional**: Filter out company rows where `name` is empty or whitespace before adding to the `companies` array, to avoid blank entries. Similarly, filter out site rows where `slug` is empty.

---

## Migration Script (Node.js)

Example structure for a Node.js migration script (Option A with API or Option B with CSV):

```javascript
// migrate-to-master-sheet.js
// Prerequisites: npm install googleapis (for API) or use csv-parse/fs for CSV

const fs = require('fs');
const path = require('path');

const sitesJson = JSON.parse(fs.readFileSync('./sites.json', 'utf8'));

// Extract spreadsheet IDs from sites.json
// Each sheet.url looks like: .../exec?sheetId=14mYC8VVnHew6GzDr-FjHt__gRKnZy4xMKsn_X_M0b9M
// The sheetId param is the Google Spreadsheet ID (not a tab gid)
function getSheetIdFromUrl(url) {
  const m = (url || '').match(/sheetId=([^&]+)/);
  return m ? m[1] : null;
}

// Build Companies rows: for each (domain, config) in sites.json,
// fetch that sheet's data, add counties = slug for each row
// Build Sites rows: for each (domain, config), output slug, serving_line, page_title, etc.

// Pseudocode:
// 1. For each domain in sitesJson:
//    - slug = domain.replace('.mineralrightsforum.com', '')
//    - Skip if domain includes 'mineral-services-directory' or 'permian-basin'
//    - sheetId = getSheetIdFromUrl(config.sheet?.url)
//    - Fetch sheet data (via API or read local CSV)
//    - For each company row, add counties: slug
//    - Append to allCompanies (dedupe if needed)
// 2. For each domain in sitesJson (county/parish only):
//    - Output Sites row
// 3. Write to master sheet (API) or output CSV for manual import
```

A full implementation would use `googleapis` to read each source sheet and write to the master sheet. Alternatively, export each sheet to CSV, run the script to produce two CSVs, then import into the master sheet.

---

## Refresh Workflow

### Manual Refresh

```bash
curl -X POST https://directory.mineralrightsforum.com/refresh \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY"
```

Or use any county subdomain:

```bash
curl -X POST https://reeves-county-texas.mineralrightsforum.com/refresh \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY"
```

One call updates all 78 sites.

### Scheduled Refresh

- **Google Apps Script**: Create a time-driven trigger that calls the refresh URL every 2 hours.
- **Cloudflare Worker**: Cron trigger that POSTs to the refresh endpoint.
- **GitHub Actions**: Scheduled workflow.
- **External cron**: cron-job.org, EasyCron, etc.

---

## Validation Checklist

- [ ] Backup created (git branch, sites.json copy, optional sheet exports)
- [ ] Master sheet has Companies tab with correct headers and data
- [ ] Master sheet has Sites tab with `slug`, `state`, `division_type`, `division_name` and correct row count
- [ ] Master sheet has Ads tab with correct headers (image_url, link, category, counties, priority, active)
- [ ] Apps Script returns valid JSON with `companies`, `sites`, and `ads`
- [ ] Apps Script expands `counties` (`*`, `state:TX`, comma-separated slugs) correctly
- [ ] `MASTER_SHEET_URL` is set in Cloudflare Pages env
- [ ] `functions/refresh.js` updated and deployed (with full hidden-company filter and ads)
- [ ] `functions/_lib.js` has `getSlugFromPath`, `loadDirectoryConfigFromKV`, `loadSitesRegistryFromKV`, and `directory:{slug}:*` in `KV_KEYS`
- [ ] `functions/index.js` uses path-based routing, `loadDirectoryConfigFromKV(env, slug)`, loads ads from KV, renders ad cards in category grids
- [ ] `functions/counties.js` uses `loadSitesRegistryFromKV(env)`
- [ ] `functions/sitemap.xml.js` handles directory host (no config load) and county paths (load from KV)
- [ ] `sites.json` removed or deprecated
- [ ] Initial refresh run immediately after deploy
- [ ] Spot-check 5 counties: page loads, companies display, SEO correct, ads display (if any)
- [ ] Counties index page loads and lists all directories
- [ ] `directory.mineralrightsforum.com/sitemap.xml` returns valid sitemap
- [ ] `/health` and `/data.json` work for county pages (extract slug from path; use `directory:{slug}:*` keys)
- [ ] GTM events still fire (optional manual check)
- [ ] `DOCUMENTATION.md` updated

---

## Rollback Plan

If something goes wrong:

1. **Revert code**: Restore `functions/refresh.js`, `_lib.js`, `index.js`, `counties.js`, `sitemap.xml.js` to versions that use `sites.json` and per-site sheet URLs.
2. **Restore sites.json**: Ensure `sites.json` is back in the repo with all 78 entries and `sheet.url` for each.
3. **Remove MASTER_SHEET_URL**: Optional; the old code ignores it.
4. **Re-run per-site refresh**: Trigger refresh for each of the 78 sites using their individual sheet URLs (old behavior). You may need a script to POST to each `/refresh` endpoint.

**Before cutover**: Keep a git branch or backup of the pre-migration code and `sites.json`.

---

## Checklist by Phase

### Phase 1: Master Sheet Setup

- [ ] Create backup (git branch, sites.json, optional sheet exports)
- [ ] Create new Google Sheet
- [ ] Add Companies tab with header row
- [ ] Add Sites tab with header row: `slug | state | division_type | division_name | page_title | return_url | directory_intro | seo_title | seo_description | category_order | theme`
- [ ] Add Ads tab with header row
- [ ] Run migration script to populate Companies from 78 sheets
- [ ] Populate Sites from [Comprehensive Counties List](https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY/edit) (column B) or sites.json
- [ ] Verify row counts and sample data

### Phase 2: Apps Script

- [ ] Create Apps Script in master sheet
- [ ] Implement doGet to read Companies, Sites, and Ads tabs
- [ ] Implement counties expansion (`*`, `state:TX`, comma-separated slugs)
- [ ] Return { ok, companies, sites, ads, updated_at, etag }
- [ ] Deploy as web app (Anyone)
- [ ] Test with curl, verify JSON shape

### Phase 3: R2 and Ad Assets (Optional)

- [ ] Create R2 bucket for ad images (if using R2)
- [ ] Configure public access or signed URLs
- [ ] Document upload workflow for ad creatives

### Phase 4: Code Changes

- [ ] Add MASTER_SHEET_URL to Cloudflare Pages env
- [ ] Update KV_KEYS to use `directory:{slug}:*` prefix
- [ ] Add getSlugFromPath, loadDirectoryConfigFromKV, loadSitesRegistryFromKV to _lib.js
- [ ] Rewrite refresh.js for master sheet flow (including ads, path-based)
- [ ] Update index.js for path-based routing (GET /{slug}), loadDirectoryConfigFromKV, render ad cards
- [ ] Add .card--ad styles in src/app.css
- [ ] Update counties.js to use loadSitesRegistryFromKV
- [ ] Update sitemap.xml.js to use loadSiteConfigFromKV
- [ ] Remove or deprecate sites.json

### Phase 5: Deploy and Validate

- [ ] Deploy to Cloudflare Pages
- [ ] Run initial refresh immediately (before traffic)
- [ ] Verify health and data.json for 3–5 sites
- [ ] Visit 3–5 county pages in browser
- [ ] Verify ads display (if Ads tab has data)
- [ ] Visit directory.mineralrightsforum.com
- [ ] Verify directory.mineralrightsforum.com/sitemap.xml
- [ ] Update cron/schedule to single refresh call
- [ ] Update DOCUMENTATION.md

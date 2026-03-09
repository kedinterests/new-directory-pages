# Migration Plan: Single Master Spreadsheet (No Astro)

This document provides a detailed, step-by-step plan to migrate from **78 separate Google Sheets** to **one master spreadsheet** with two tabs (Companies + Sites). The existing Cloudflare Pages Functions architecture remains unchanged; only the data source and refresh logic change.

---

## Table of Contents

1. [Overview](#overview)
2. [Current vs Target Architecture](#current-vs-target-architecture)
3. [Master Spreadsheet Structure](#master-spreadsheet-structure)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Adding a New County (Post-Migration)](#adding-a-new-county-post-migration)
6. [Code Changes Reference](#code-changes-reference)
7. [Apps Script Code](#apps-script-code)
8. [Migration Script (Node.js)](#migration-script-nodejs)
9. [Refresh Workflow](#refresh-workflow)
10. [Validation Checklist](#validation-checklist)
11. [Rollback Plan](#rollback-plan)

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
1 Master Google Sheet (Companies + Sites tabs) → 1 Apps Script → (single refresh) → Cloudflare KV
Site config in KV: site:{host}:config
Companies in KV: site:{host}:data
```

- One master sheet with Companies tab and Sites tab
- One Apps Script URL in env var `MASTER_SHEET_URL`
- POST to any site's `/refresh` fetches master sheet and updates KV for all 78 sites
- Site config loaded from `site:{host}:config` in KV (populated at refresh from Sites tab)

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

**`counties` format**: Comma-separated list of slugs. Slug = domain stem without `.mineralrightsforum.com`. Example: `reeves-county-texas.mineralrightsforum.com` → slug is `reeves-county-texas`.

**Multi-county companies**: To list a company on multiple county pages, put all slugs in the `counties` column: `reeves-county-texas, ward-county-texas, midland-county-texas`.

### Tab 2: Sites

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `slug` | string | Yes | County slug; domain = `{slug}.mineralrightsforum.com` | "reeves-county-texas" |
| `serving_line` | string | Yes | Display text | "Serving Reeves County, Texas" |
| `page_title` | string | Yes | Main heading (use `\n` for line break) | "Reeves County, TX Mineral Rights\nProfessionals Directory" |
| `return_url` | string | Yes | Back-to-forum link | "https://www.mineralrightsforum.com/c/texas-mineral-rights/reeves-county-tx/741" |
| `directory_intro` | string | Yes | Intro paragraph | "Since 2009, the Mineral Rights Forum..." |
| `seo_title` | string | Yes | Page title tag | "Reeves County TX Mineral Rights \| Oil & Gas Directory" |
| `seo_description` | string | Yes | Meta description | "Find trusted Reeves County, TX mineral rights..." |
| `category_order` | string | No | `alpha` or comma-separated custom order | "alpha" |
| `theme` | string | No | Theme name | "default" |

**Row order**: One row per county. The slug must exactly match the domain stem. Include all 78 county/parish directories. Exclude non-county domains (e.g. `mineral-services-directory`, `permian-basin`) if they exist in current `sites.json`.

**`page_title` newlines**: Use either (a) an actual line break in the cell (Alt+Enter in Google Sheets) or (b) the literal characters `\n`. The frontend expects a newline character for the break; if you use `\n`, the Apps Script or migration script should convert it to a real newline when building the config.

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
   slug | serving_line | page_title | return_url | directory_intro | seo_title | seo_description | category_order | theme
   ```
6. Do **not** populate data yet; that happens in Step 3 and 4.

---

### Step 2: Build and Run the Migration Script

The migration script does two things:
1. Reads all 78 existing Google Sheets and merges company rows into the Companies tab, adding the correct `counties` value for each row.
2. Reads `sites.json` and populates the Sites tab.

**Prerequisites**:
- Node.js 18+
- Access to all 78 sheet IDs (from `sites.json` — extract from each `sheet.url` query param `sheetId=...`)
- Google Sheets API credentials (service account or OAuth) **or** manual export/import

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

### Step 3: Populate the Sites Tab from sites.json

If not done by the migration script, manually create the Sites tab:

1. For each entry in `sites.json` where the domain is a county/parish directory (exclude `mineral-services-directory`, `permian-basin`, etc.):
2. Extract the slug: `reeves-county-texas.mineralrightsforum.com` → `reeves-county-texas`
3. Add a row:
   - `slug` = slug
   - `serving_line` = from `serving_line`
   - `page_title` = from `page_title` (preserve `\n` if present)
   - `return_url` = from `return_url`
   - `directory_intro` = from `directory_intro`
   - `seo_title` = from `seo.title`
   - `seo_description` = from `seo.description`
   - `category_order` = from `category_order` (default "alpha")
   - `theme` = from `theme` (default "default")

**Important**: The Sites tab must include a row for every county/parish domain that currently exists in `sites.json`. Do **not** add `directories.mineralrightsforum.com` — that host is the index page and gets its data from the sites map, not from the Sites tab. Count the county/parish entries in `sites.json` (exclude `mineral-services-directory`, `permian-basin`, and any other non-county domains) to get the exact row count.

---

### Step 4: Create the New Apps Script

1. In the master Google Sheet, go to **Extensions → Apps Script**.
2. Create a new script (or replace existing).
3. Implement the `doGet` function to:
   - Read the **Companies** sheet: all rows, headers in row 1.
   - Read the **Sites** sheet: all rows, headers in row 1.
   - Build `companies` array: each row becomes an object with keys from headers (lowercase, spaces to underscores).
   - Build `sites` array: each row becomes an object with keys from headers.
   - For each site object, add a `domain` field: `domain = slug + '.mineralrightsforum.com'`.
   - For each site object, ensure `seo` is an object: `{ title: seo_title, description: seo_description }` (to match current `site.seo` shape).
   - Return JSON: `{ ok: true, companies: [...], sites: [...], updated_at: ISO string, etag: hash }`.
4. Deploy as web app: **Execute as: Me**, **Who has access: Anyone**.
5. Copy the deployment URL (e.g. `https://script.google.com/macros/s/.../exec`).
6. Test: `curl "YOUR_APPS_SCRIPT_URL"` and verify you get valid JSON with `companies` and `sites` arrays.

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
3. Parse response; validate `ok`, `companies` (array), `sites` (array).
4. For each site in `sites`:
   - Skip if `site.slug` is empty (would produce invalid domain).
   - `host` = `site.domain` (e.g. `reeves-county-texas.mineralrightsforum.com`)
   - Filter `companies` where `counties` (split by comma, trim, lowercase) includes `site.slug` (case-insensitive).
   - Filter out hidden companies using the **full** hidden logic from current `refresh.js`: `plan` in (hidden, hide, h), `hidden` (true, 'true', 'yes', 1, 'hidden', 'hide'), `status === 'hidden'`, `visible === false`, `show === false`.
   - Write to KV:
     - `site:{host}:data` = JSON.stringify(filtered companies)
     - `site:{host}:config` = JSON.stringify(site config object: serving_line, page_title, return_url, directory_intro, seo: {title, description}, category_order, theme — **no** sheet or url)
     - `site:{host}:etag` = hash of companies
     - `site:{host}:updated_at` = ISO timestamp
     - Delete `site:{host}:last_error` on success
5. Write `site:directories.mineralrightsforum.com:config` = JSON object mapping each `site.domain` to its config (for counties index). Shape: `{ "reeves-county-texas.mineralrightsforum.com": { serving_line, page_title, ... }, ... }`.
6. Return JSON: `{ status: 'ok', sites_updated: 78, duration_ms: ... }`.

**Error handling**:
- If fetch fails or response invalid: return 502 immediately; do not write to KV.
- If a single site fails during the loop (e.g. invalid slug, write error): consider continuing with other sites and logging the failure. Optionally store `last_error` for the failed host. Return 200 with a warning in the response body if some sites failed (e.g. `{ status: 'ok', sites_updated: 77, sites_failed: 1, errors: [...] }`), or return 502 to fail the whole refresh. For simplicity, recommend: abort on first error and return 502.

**Empty rows**: The Apps Script may return company rows with empty `name`. The current `index.js` does not explicitly filter these. Consider filtering out rows where `name` is empty or whitespace in the refresh before writing to KV, to avoid blank cards on the directory page.

---

### Step 7: Update functions/_lib.js

1. Add new function `loadSiteConfigFromKV(env, host)`:
   - `keys = KV_KEYS(host)`
   - `configKey = 'site:' + host + ':config'`
   - `const raw = await env.DIRECTORIES_KV.get(configKey)`
   - If !raw, throw new Error(`No config for host: ${host}`)
   - Return `JSON.parse(raw)`

2. Add new function `loadSitesRegistryFromKV(env)`:
   - `const raw = await env.DIRECTORIES_KV.get('site:directories.mineralrightsforum.com:config')`
   - If !raw, throw new Error('No sites registry in KV')
   - Return `JSON.parse(raw)` — this is the `{ domain: config }` map

3. **Keep** `loadSitesRegistry()` and `getSiteConfig()` for backward compatibility during transition, or remove them once all callers use KV. The plan assumes we **remove** usage of `sites.json` and use KV only.

---

### Step 8: Update functions/index.js

1. Change the import: add `loadSiteConfigFromKV` from `_lib.js`.
2. Replace the site config loading block:
   - **Before**: `sites = await loadSitesRegistry(); site = getSiteConfig(sites, host);`
   - **After**: `site = await loadSiteConfigFromKV(env, host);`
3. Remove the `sites` variable if unused.
4. The rest of the logic (KV data, grouping, rendering) stays the same. The `site` object must have: `serving_line`, `seo`, `page_title`, `return_url`, `directory_intro`, `category_order`, `theme`.

---

### Step 9: Update functions/counties.js

1. Change the import: use `loadSitesRegistryFromKV` instead of `loadSitesRegistry`.
2. Replace: `sites = await loadSitesRegistry()` with `sites = await loadSitesRegistryFromKV(env)`.
3. The `counties.js` handler receives `{ request, env }`; ensure `env` is passed (it is in the current `onRequestGet`).
4. The structure of `sites` must remain `{ [domain]: config }` so that `Object.entries(sites)` and the filter/map logic work unchanged.

---

### Step 10: Update functions/sitemap.xml.js

1. **Special case for directories**: When `host === 'directories.mineralrightsforum.com'`, generate the sitemap without loading site config (the base URL is all that's needed). Do not call `loadSiteConfigFromKV` for this host — the KV key for directories stores the sites map, not a single-site config.
2. **For county hosts**: Replace `loadSitesRegistry` + `getSiteConfig` with `loadSiteConfigFromKV(env, host)`.
3. Ensure the handler receives `env` (Cloudflare Pages passes it to `onRequestGet`).

**Example logic**:
```javascript
const host = getHost(request);
if (host === 'directories.mineralrightsforum.com') {
  // No config needed; generate sitemap for index page only
} else {
  try {
    await loadSiteConfigFromKV(env, host); // Validates host exists
  } catch (err) {
    return new Response(`<!-- Error: ${String(err)} -->`, { status: 500, ... });
  }
}
const baseUrl = `https://${host}`;
// ... build sitemap XML
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
6. Visit `https://reeves-county-texas.mineralrightsforum.com` and `https://directories.mineralrightsforum.com` in a browser.

---

### Step 13: Update Refresh Schedule

If you use a cron or scheduled job to refresh:

- **Before**: 78 separate POST requests (one per site).
- **After**: One POST request to any site's `/refresh` (e.g. `https://directories.mineralrightsforum.com/refresh` or any county subdomain). That single call updates all 78 sites.

Update your cron script or Google Apps Script trigger to call the refresh endpoint once.

---

### Step 14: Update DOCUMENTATION.md

Update the project's `DOCUMENTATION.md` to reflect the new architecture:

- Change "Google Sheets (78 separate)" to "Master Google Sheet (Companies + Sites tabs)"
- Update the Apps Script section to describe the single script and `MASTER_SHEET_URL`
- Update the refresh workflow to "one call updates all sites"
- Update the KV namespace structure to include `site:{host}:config`
- Remove references to per-site `sheet.url` in `sites.json`

---

## Adding a New County (Post-Migration)

After the migration, to add a new county directory:

1. **Add row to Sites tab**: slug, serving_line, page_title, return_url, directory_intro, seo_title, seo_description, category_order, theme.
2. **Add companies** (optional): Add rows to Companies tab with the new county slug in the `counties` column.
3. **Cloudflare DNS**: Add CNAME record for `{slug}.mineralrightsforum.com` pointing to your Pages project.
4. **Cloudflare Pages**: Add custom domain `{slug}.mineralrightsforum.com` in the Pages dashboard.
5. **Run refresh**: `curl -X POST https://directories.mineralrightsforum.com/refresh -H "X-Refresh-Key: YOUR_KEY"`.

No code changes or redeploy needed.

---

## Code Changes Reference

### functions/_lib.js — New Functions

```javascript
export const KV_KEYS = (host) => ({
  data: `site:${host}:data`,
  config: `site:${host}:config`,
  etag: `site:${host}:etag`,
  updated: `site:${host}:updated_at`,
  lastError: `site:${host}:last_error`,
});

export async function loadSiteConfigFromKV(env, host) {
  const key = `site:${host}:config`;
  const raw = await env.DIRECTORIES_KV.get(key);
  if (!raw) throw new Error(`No config for host: ${host}`);
  return JSON.parse(raw);
}

export async function loadSitesRegistryFromKV(env) {
  const key = 'site:directories.mineralrightsforum.com:config';
  const raw = await env.DIRECTORIES_KV.get(key);
  if (!raw) throw new Error('No sites registry in KV');
  return JSON.parse(raw);
}
```

Note: Add `config` to `KV_KEYS` if not present. Existing keys (`data`, `etag`, `updated`, `lastError`) stay the same.

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

  let sitesUpdated = 0;
  const sitesMap = {};

  for (const site of upstream.sites) {
    const slug = String(site.slug || '').trim();
    if (!slug) continue; // Skip sites with empty slug

    const host = site.domain;
    const companiesForSite = upstream.companies.filter(row => {
      const rowCounties = String(row.counties || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      if (!rowCounties.includes(slug.toLowerCase())) return false;
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

    const config = {
      serving_line: site.serving_line,
      page_title: site.page_title,
      return_url: site.return_url,
      directory_intro: site.directory_intro,
      seo: { title: site.seo_title, description: site.seo_description },
      category_order: site.category_order || 'alpha',
      theme: site.theme || 'default',
    };

    const keys = KV_KEYS(host);
    await env.DIRECTORIES_KV.put(keys.data, JSON.stringify(companiesForSite));
    await env.DIRECTORIES_KV.put(keys.config, JSON.stringify(config));
    await env.DIRECTORIES_KV.put(keys.etag, quickHash(companiesForSite));
    await env.DIRECTORIES_KV.put(keys.updated, upstream.updated_at || new Date().toISOString());
    await env.DIRECTORIES_KV.delete(keys.lastError);

    sitesMap[host] = config;
    sitesUpdated++;
  }

  await env.DIRECTORIES_KV.put('site:directories.mineralrightsforum.com:config', JSON.stringify(sitesMap));

  return json({
    status: 'ok',
    sites_updated: sitesUpdated,
    duration_ms: Date.now() - t0,
  });
};
```

**Important**: The filter for companies uses `row.counties` — ensure the Companies tab uses that exact column name. The slug comparison should be case-insensitive.

---

## Apps Script Code

```javascript
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const companiesSheet = ss.getSheetByName('Companies');
    const sitesSheet = ss.getSheetByName('Sites');

    if (!companiesSheet || !sitesSheet) {
      return jsonResponse({ ok: false, error: 'Companies or Sites sheet not found' });
    }

    const companiesData = companiesSheet.getDataRange().getValues();
    const sitesData = sitesSheet.getDataRange().getValues();

    const companyHeaders = companiesData[0].map(h => String(h || '').toLowerCase().replace(/\s+/g, '_'));
    const siteHeaders = sitesData[0].map(h => String(h || '').toLowerCase().replace(/\s+/g, '_'));

    const companies = [];
    for (let i = 1; i < companiesData.length; i++) {
      const row = companiesData[i];
      const obj = {};
      companyHeaders.forEach((h, j) => { obj[h] = row[j] !== undefined && row[j] !== null ? row[j] : ''; });
      companies.push(obj);
    }

    const sites = [];
    for (let i = 1; i < sitesData.length; i++) {
      const row = sitesData[i];
      const obj = {};
      siteHeaders.forEach((h, j) => { obj[h] = row[j] !== undefined && row[j] !== null ? row[j] : ''; });
      const slug = String(obj.slug || '').trim();
      obj.domain = slug ? slug + '.mineralrightsforum.com' : '';
      sites.push(obj);
    }

    const updated_at = new Date().toISOString();
    const etag = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify({ companies, sites }))
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

    return jsonResponse({
      ok: true,
      companies,
      sites,
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

**Note**: The Apps Script normalizes headers to lowercase with underscores. Ensure your sheet headers match the expected names (`seo_title`, `seo_description`, etc.). The `sites` array includes a `domain` field derived from `slug`.

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
curl -X POST https://directories.mineralrightsforum.com/refresh \
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
- [ ] Master sheet has Sites tab with correct row count (county/parish only; exclude directories, mineral-services-directory, permian-basin)
- [ ] Apps Script returns valid JSON with `companies` and `sites`
- [ ] `MASTER_SHEET_URL` is set in Cloudflare Pages env
- [ ] `functions/refresh.js` updated and deployed (with full hidden-company filter)
- [ ] `functions/_lib.js` has `loadSiteConfigFromKV`, `loadSitesRegistryFromKV`, and `config` in `KV_KEYS`
- [ ] `functions/index.js` uses `loadSiteConfigFromKV(env, host)`
- [ ] `functions/counties.js` uses `loadSitesRegistryFromKV(env)`
- [ ] `functions/sitemap.xml.js` handles directories host (no config load) and county hosts (load from KV)
- [ ] `sites.json` removed or deprecated
- [ ] Initial refresh run immediately after deploy
- [ ] Spot-check 5 counties: page loads, companies display, SEO correct
- [ ] Counties index page loads and lists all directories
- [ ] `directories.mineralrightsforum.com/sitemap.xml` returns valid sitemap
- [ ] `/health` and `/data.json` return expected data for county sites
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
- [ ] Add Sites tab with header row
- [ ] Run migration script to populate Companies from 78 sheets
- [ ] Populate Sites from sites.json (via script or manual)
- [ ] Verify row counts and sample data

### Phase 2: Apps Script

- [ ] Create Apps Script in master sheet
- [ ] Implement doGet to read both tabs
- [ ] Return { ok, companies, sites, updated_at, etag }
- [ ] Deploy as web app (Anyone)
- [ ] Test with curl, verify JSON shape

### Phase 3: Code Changes

- [ ] Add MASTER_SHEET_URL to Cloudflare Pages env
- [ ] Update KV_KEYS to include config key
- [ ] Add loadSiteConfigFromKV and loadSitesRegistryFromKV to _lib.js
- [ ] Rewrite refresh.js for master sheet flow
- [ ] Update index.js to use loadSiteConfigFromKV
- [ ] Update counties.js to use loadSitesRegistryFromKV
- [ ] Update sitemap.xml.js to use loadSiteConfigFromKV
- [ ] Remove or deprecate sites.json

### Phase 4: Deploy and Validate

- [ ] Deploy to Cloudflare Pages
- [ ] Run initial refresh immediately (before traffic)
- [ ] Verify health and data.json for 3–5 sites
- [ ] Visit 3–5 county pages in browser
- [ ] Visit directories.mineralrightsforum.com
- [ ] Verify directories.mineralrightsforum.com/sitemap.xml
- [ ] Update cron/schedule to single refresh call
- [ ] Update DOCUMENTATION.md

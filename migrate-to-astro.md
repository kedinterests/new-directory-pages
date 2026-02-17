# Migration Plan: County Directory Pages to Astro + Starwind UI

## Executive Summary

This document outlines a phased migration from the current Cloudflare Pages Functions architecture to **Astro + Tailwind CSS v4 + Starwind UI**, combined with a **hybrid master spreadsheet** data model. All content and per-site metadata live in the spreadsheet; the repo keeps only minimal bootstrap config (master sheet URL, infra). The migration improves maintainability, enables component reuse, and gives non-developers a single place to edit companies and site metadata.

---

## Current State

### Architecture

```
Google Sheets (78 separate) → Apps Script (78 URLs) → Cloudflare KV → Cloudflare Pages Functions → HTML
```

- **78 county sites**, each with its own Google Sheet and Apps Script URL
- **Cloudflare Pages Functions**: `functions/index.js` (~1,900 lines) builds full HTML via template literals
- **Tailwind CSS v3** compiled to `public/styles.css`
- **Cloudflare KV**: Per-site keys (`site:{host}:data`, `site:{host}:etag`, etc.)
- **Special host**: `directories.mineralrightsforum.com` uses `counties.js` for the index of all directories

### Key Files

| File | Purpose |
|------|---------|
| `sites.json` | Registry of 78 sites with sheet URLs, SEO, theme config |
| `functions/index.js` | Main SSR: loads KV data, groups companies, renders HTML |
| `functions/counties.js` | Index page listing all county directories by state |
| `functions/refresh.js` | POST `/refresh` – fetches from Apps Script, writes to KV |
| `functions/_lib.js` | Shared utilities: `getHost`, `loadSitesRegistry`, `KV_KEYS` |
| `functions/health.js`, `data.json.js`, `sitemap.xml.js`, `robots.txt.js` | Supporting endpoints |

### Features to Preserve

- Multi-subdomain routing (host-based)
- Search and filter (category, featured-only, text search)
- Premium vs free listings (different card layouts)
- JSON-LD structured data (WebPage, ItemList, LocalBusiness)
- GTM + GA4 tracking (`directory_page_view`, `directory_advertiser_present`)
- Mobile drawer for filters
- Sticky header, category jump pills
- Zoho form iframe modal
- Tips card (expandable)
- Return-to-forum button and branding

---

## Target State

### Architecture

```
Master Google Sheet (Companies + Sites tabs) → Single Apps Script → Cloudflare KV → Astro (SSR) → HTML
```

- **One master spreadsheet** with two tabs:
  - **Companies**: Company listings with `counties` column (comma-separated slugs)
  - **Sites**: Per-site metadata (serving_line, page_title, SEO, etc.) — one row per county
- **One Apps Script** returns both companies and site config; refresh filters and writes per-site data to KV
- **Astro v5** with `@astrojs/cloudflare` adapter for SSR
- **Tailwind CSS v4** + **Starwind UI** components
- **Same deployment**: Cloudflare Pages with KV binding

### Hybrid Model: What Lives Where

| In Spreadsheet | In Repo / Env |
|----------------|---------------|
| Companies (with `counties` column) | Master sheet URL (or Apps Script URL) |
| Per-site metadata: `serving_line`, `page_title`, `return_url`, `directory_intro`, `seo`, `category_order`, `theme` | Build/deploy config |
| Site registry (Sites tab defines which counties exist) | Base domain (`mineralrightsforum.com`) — domain = `{slug}.mineralrightsforum.com` |
| | DNS + Pages custom domains (infra; add when new county goes live) |

**Why hybrid**: Content and metadata in the spreadsheet = single source of truth, non-dev editing, no redeploy for config changes. Repo keeps only what cannot live in a sheet: the master URL, base domain, and infra.

### Benefits

- **Data**: Single source of truth; add a company to multiple counties without duplication
- **Config**: SEO, titles, intros editable in spreadsheet — no PRs or deploys for content changes
- **Code**: Component-based, easier to maintain and extend
- **UI**: Starwind UI provides cards, forms, dialogs, tables; copy-paste model for full control
- **DX**: Astro’s file-based routing, TypeScript, and component composition

---

## Phased Migration Plan

### Phase 1: Master Spreadsheet (Hybrid Data Model)

**Goal**: Consolidate 78 sheets into one master sheet with Companies + Sites tabs; move all per-site metadata from `sites.json` into the spreadsheet.

**Tasks**:

1. **Create master Google Sheet with two tabs**

   **Companies tab** — columns: `name`, `category`, `description_short`, `plan`, `website_url`, `logo_url`, `contact_email`, `contact_phone`, `hidden`, **`counties`** (comma-separated slugs, e.g. `reeves-county-texas, ward-county-texas`)

   **Sites tab** — one row per county: `slug`, `serving_line`, `page_title`, `return_url`, `directory_intro`, `seo_title`, `seo_description`, `category_order`, `theme`. Domain = `{slug}.mineralrightsforum.com`.

2. **Define county slug format**
   - Use domain stem: `reeves-county-texas.mineralrightsforum.com` → `reeves-county-texas`

3. **Build migration script**
   - Read all 78 existing sheets and merge into Companies tab
   - Read `sites.json` and populate Sites tab with per-site metadata

4. **Create new Apps Script**
   - Reads both tabs
   - Returns `{ ok: true, companies: [...], sites: [...], updated_at, etag }`
   - `sites` = array of `{ slug, serving_line, page_title, ... }`

5. **Update repo config**
   - Add `MASTER_SHEET_URL` (or Apps Script URL) to env
   - Keep minimal bootstrap during transition; `sites.json` deprecated once Sites tab is source of truth

6. **Update `functions/refresh.js`**
   - Fetch from master Apps Script
   - For each site in `sites`: filter companies where `counties` includes slug; write `site:{host}:data` and `site:{host}:config` to KV
   - `site:{host}:config` = site metadata from Sites tab
   - Write `site:directories.mineralrightsforum.com:config` = full sites array (for counties index page)

7. **Update `functions/index.js` and `_lib.js`**
   - Load site config from KV (`site:{host}:config`) instead of `sites.json`
   - Fallback to `sites.json` during transition if needed

8. **Validate**
   - Compare KV data and rendered output before/after
   - Confirm company counts, metadata, and SEO match

**Deliverable**: Master sheet (Companies + Sites) in use; all 78 sites served by current Functions; site config loaded from KV.

---

### Phase 2: Astro Project Setup

**Goal**: New Astro project that can eventually replace the Functions.

**Tasks**:

1. **Create Astro project**
   ```bash
   npm create astro@latest county-directory-astro -- --template minimal --install --no-git
   cd county-directory-astro
   ```

2. **Add Cloudflare adapter**
   ```bash
   npx astro add cloudflare
   ```

3. **Add Tailwind v4**
   ```bash
   npx astro add tailwind
   ```
   - Upgrade to Tailwind v4 if needed (Starwind UI requirement)

4. **Initialize Starwind UI**
   ```bash
   npx starwind@latest init
   ```

5. **Configure for Cloudflare Pages**
   - `astro.config.mjs`: `output: 'server'`, `adapter: cloudflare()`
   - Ensure `wrangler.toml` or Pages config binds `DIRECTORIES_KV`

6. **Set up KV access**
   - Use `Astro.locals` or `getRuntimeConfig()` to access `env.DIRECTORIES_KV`
   - Load site config from KV (`site:{host}:config`); no `sites.json` in repo

**Deliverable**: Astro app that can read from KV and render a minimal directory page.

---

### Phase 3: Component Migration

**Goal**: Rebuild the directory page using Astro components and Starwind UI.

**Tasks**:

1. **Layout**
   - `src/layouts/DirectoryLayout.astro`: `<html>`, `<head>`, GTM, GA4, CSS, common meta
   - Preserve CSS variables (`--mrf-primary`, `--mrf-accent`, etc.)

2. **Components to create**
   - `DirectoryHeader.astro` – sticky bar, title, return button
   - `DirectoryFilters.astro` – search input, category select, featured checkbox, mobile drawer trigger
   - `CompanyCard.astro` – premium vs free layout (use Starwind Card as base)
   - `CategorySection.astro` – section header + grid of cards
   - `TipsCard.astro` – expandable tips block
   - `ApplyModal.astro` – Zoho form iframe dialog (use Starwind Dialog)

3. **Starwind UI components to add**
   - Card, Input, Select, Checkbox, Button, Dialog
   - Run `npx starwind add <component>` as needed

4. **Page**
   - `src/pages/[...path].astro` or middleware-based routing
   - Middleware: read host from request, load site config, fetch KV data
   - Pass `companies`, `site`, `groups` to layout and components

5. **Client-side behavior**
   - Search, filter, category jump: keep vanilla JS or use Alpine.js (Astro-friendly)
   - Mobile drawer: same logic, wired to new components
   - GTM `directory_page_view` and `directory_advertiser_present`: preserve event structure

6. **JSON-LD**
   - `DirectoryStructuredData.astro` – render `<script type="application/ld+json">` from `companies` and `site`

7. **Counties index**
   - `src/pages/index.astro` or conditional routing for `directories.mineralrightsforum.com`
   - Load sites list from KV (`site:directories:config` or similar — populated at refresh from Sites tab)
   - Port `counties.js` logic into Astro (state grouping, flags, links)

**Deliverable**: Astro app that renders directory pages and counties index with equivalent behavior.

---

### Phase 4: Cloudflare Integration

**Goal**: Deploy Astro to Cloudflare Pages with KV and custom domains.

**Tasks**:

1. **KV binding**
   - In `wrangler.toml` or Pages dashboard: `[[kv_namespaces]]` for `DIRECTORIES_KV`

2. **Environment variables**
   - `REFRESH_KEY` for the refresh endpoint

3. **Refresh endpoint**
   - Implement `POST /refresh` in Astro (API route or server endpoint)
   - Reuse logic from `functions/refresh.js` (fetch companies + sites from master sheet, filter by county, write data + config to KV)

4. **Supporting routes**
   - `/health`, `/data.json`, `/sitemap.xml`, `/robots.txt`
   - Port from current `functions/` into Astro routes

5. **Build and deploy**
   - Build command: `npm run build`
   - Output: Cloudflare Pages with Functions (Astro SSR)
   - Custom domains: same 78 subdomains + `directories.mineralrightsforum.com`

6. **Host-based routing**
   - Astro middleware or `getStaticPaths`/dynamic routes
   - Ensure each request uses correct host for config and KV keys

**Deliverable**: Astro app deployed to Cloudflare Pages, serving all directories.

---

### Phase 5: Cutover and Cleanup

**Goal**: Switch production to Astro and retire the old Functions.

**Tasks**:

1. **Parallel deployment**
   - Deploy Astro to a staging subdomain or alternate path
   - Compare output with production (HTML, JSON-LD, GTM events)

2. **Smoke tests**
   - Spot-check 5–10 counties: layout, search, filters, mobile
   - Verify GTM events in preview
   - Check sitemap and robots.txt

3. **Cutover**
   - Update Cloudflare Pages project to use Astro build
   - Or: new Pages project, then switch DNS/build config

4. **Monitor**
   - Watch errors, KV reads, and latency
   - Confirm refresh still works for all sites

5. **Cleanup**
   - Remove old `functions/` (or archive in a branch)
   - Update `DOCUMENTATION.md`
   - Repo has no `sites.json`; all config lives in spreadsheet + KV

**Deliverable**: Production running on Astro; old Functions deprecated.

---

## Proposed File Structure (Astro)

```
county-directory-astro/
├── astro.config.mjs
├── package.json
├── wrangler.toml           # KV binding, env (MASTER_SHEET_URL in Pages dashboard)
├── public/
│   └── (static assets)
├── src/
│   ├── layouts/
│   │   └── DirectoryLayout.astro
│   ├── components/
│   │   ├── DirectoryHeader.astro
│   │   ├── DirectoryFilters.astro
│   │   ├── CompanyCard.astro
│   │   ├── CategorySection.astro
│   │   ├── TipsCard.astro
│   │   ├── ApplyModal.astro
│   │   └── DirectoryStructuredData.astro
│   ├── lib/
│   │   ├── kv.ts           # KV_KEYS, loadCompanies, loadSiteConfig
│   │   └── companies.ts    # groupCompanies, filter logic
│   ├── pages/
│   │   ├── index.astro     # Counties index (or conditional)
│   │   ├── [...path].astro # Catch-all for directory pages
│   │   ├── refresh.ts      # POST /refresh
│   │   ├── health.ts       # GET /health
│   │   ├── data.json.ts    # GET /data.json
│   │   ├── sitemap.xml.ts
│   │   └── robots.txt.ts
│   └── middleware.ts       # Host detection, locals
└── components/             # Starwind UI (copy-pasted)
    ├── ui/
    │   ├── card.astro
    │   ├── button.astro
    │   └── ...
```

---

## Master Spreadsheet Schema

### Companies Tab

| Column | Type | Description |
|--------|------|-------------|
| `name` | string | Company name |
| `category` | string | Attorneys, Landmen, etc. |
| `description_short` | string | Brief description |
| `plan` | string | `premium`, `free`, or `hidden` |
| `website_url` | string | Company website |
| `logo_url` | string | Logo image URL |
| `contact_email` | string | Email |
| `contact_phone` | string | Phone |
| `hidden` | boolean | Alternative to `plan=hidden` |
| **`counties`** | string | Comma-separated slugs: `reeves-county-texas, ward-county-texas` |

### Sites Tab (per-site metadata)

| Column | Type | Description |
|--------|------|-------------|
| `slug` | string | County slug; domain = `{slug}.mineralrightsforum.com` |
| `serving_line` | string | e.g. "Serving Reeves County, Texas" |
| `page_title` | string | Main heading |
| `return_url` | string | Back-to-forum link |
| `directory_intro` | string | Intro paragraph |
| `seo_title` | string | Page title tag |
| `seo_description` | string | Meta description |
| `category_order` | string | `alpha` or comma-separated custom order |
| `theme` | string | `default`, etc. |

**County slug format**: Domain stem without `.mineralrightsforum.com` (e.g. `reeves-county-texas`).

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss during sheet migration | Run migration script in copy first; validate before switching |
| Astro/Cloudflare compatibility | Test adapter and KV access early in Phase 2 |
| GTM/GA4 regression | Preserve event names and payloads; test in GTM preview |
| Performance regression | KV reads are unchanged; monitor TTFB and Core Web Vitals |
| Starwind UI learning curve | Start with Card, Button, Input; expand as needed |

---

## Rollback Plan

- **Phase 1**: Revert to per-site sheets and `sites.json`; re-run refresh from legacy URLs
- **Phase 2–4**: Keep current Pages project; deploy Astro to a separate project until validated
- **Phase 5**: Cloudflare Pages supports instant rollback to a previous deployment

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Master Spreadsheet | 2–3 days | None |
| Phase 2: Astro Setup | 1 day | None |
| Phase 3: Component Migration | 4–6 days | Phase 2 |
| Phase 4: Cloudflare Integration | 1–2 days | Phase 3 |
| Phase 5: Cutover | 1 day | Phase 4 |

**Total**: ~2–3 weeks, depending on testing and iteration.

---

## Next Steps

1. Confirm master spreadsheet schema (Companies + Sites tabs) and county slug format
2. Create master sheet and migration script; populate Sites tab from `sites.json` (Phase 1)
3. Initialize Astro project and validate Cloudflare adapter (Phase 2)
4. Migrate one directory page end-to-end as a proof of concept before full rollout

---

## Checklist by Phase

### Phase 1: Master Spreadsheet (Hybrid Data Model)

- [ ] Create master Google Sheet with Companies tab (name, category, description_short, plan, website_url, logo_url, contact_email, contact_phone, hidden, counties)
- [ ] Create Sites tab (slug, serving_line, page_title, return_url, directory_intro, seo_title, seo_description, category_order, theme)
- [ ] Define county slug format (domain stem without .mineralrightsforum.com)
- [ ] Build migration script: merge 78 sheets into Companies tab with counties column
- [ ] Build migration script: populate Sites tab from sites.json
- [ ] Create new Apps Script that reads both tabs
- [ ] Apps Script returns `{ ok: true, companies: [...], sites: [...], updated_at, etag }`
- [ ] Add MASTER_SHEET_URL to env
- [ ] Update functions/refresh.js: fetch from master, filter by county, write data + config to KV
- [ ] Update functions/refresh.js: write site:directories.mineralrightsforum.com:config for counties index
- [ ] Update functions/index.js and _lib.js: load site config from KV
- [ ] Validate: compare KV data and rendered output before/after

### Phase 2: Astro Project Setup

- [ ] Create Astro project (`npm create astro@latest`)
- [ ] Add Cloudflare adapter (`npx astro add cloudflare`)
- [ ] Add Tailwind v4 (`npx astro add tailwind`)
- [ ] Initialize Starwind UI (`npx starwind@latest init`)
- [ ] Configure astro.config.mjs: output server, adapter cloudflare
- [ ] Configure wrangler.toml or Pages: bind DIRECTORIES_KV
- [ ] Set up KV access in Astro (load site config from KV)

### Phase 3: Component Migration

- [ ] Create DirectoryLayout.astro (html, head, GTM, GA4, CSS variables)
- [ ] Create DirectoryHeader.astro
- [ ] Create DirectoryFilters.astro
- [ ] Create CompanyCard.astro (premium vs free)
- [ ] Create CategorySection.astro
- [ ] Create TipsCard.astro
- [ ] Create ApplyModal.astro
- [ ] Create DirectoryStructuredData.astro (JSON-LD)
- [ ] Add Starwind UI components: Card, Input, Select, Checkbox, Button, Dialog
- [ ] Implement page routing (middleware, host detection, KV load)
- [ ] Implement client-side: search, filter, category jump, mobile drawer
- [ ] Preserve GTM events (directory_page_view, directory_advertiser_present)
- [ ] Create counties index page (load sites from KV, state grouping, flags)

### Phase 4: Cloudflare Integration

- [ ] Configure KV namespace binding in wrangler.toml or Pages dashboard
- [ ] Set REFRESH_KEY environment variable
- [ ] Implement POST /refresh endpoint in Astro
- [ ] Port /health endpoint
- [ ] Port /data.json endpoint
- [ ] Port /sitemap.xml endpoint
- [ ] Port /robots.txt endpoint
- [ ] Build and deploy to Cloudflare Pages
- [ ] Add custom domains (78 subdomains + directories.mineralrightsforum.com)
- [ ] Verify host-based routing

### Phase 5: Cutover and Cleanup

- [ ] Deploy Astro to staging; compare with production
- [ ] Smoke test: 5–10 counties (layout, search, filters, mobile)
- [ ] Verify GTM events in preview
- [ ] Check sitemap.xml and robots.txt
- [ ] Cutover: update Pages project to Astro build
- [ ] Monitor errors, KV reads, latency
- [ ] Confirm refresh works for all sites
- [ ] Archive or remove old functions/
- [ ] Update DOCUMENTATION.md

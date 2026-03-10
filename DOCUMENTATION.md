# County Directory Pages - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Workflow: Adding a New Directory](#workflow-adding-a-new-directory)
4. [Workflow: Editing an Existing Directory](#workflow-editing-an-existing-directory)
5. [File Structure & Purpose](#file-structure--purpose)
6. [Google Sheets & Apps Script Setup](#google-sheets--apps-script-setup)
7. [Cloudflare Pages Configuration](#cloudflare-pages-configuration)
8. [Data Refresh Workflow](#data-refresh-workflow)
9. [Deployment Process](#deployment-process)
10. [Troubleshooting](#troubleshooting)
11. [Additional Resources](#additional-resources)

---

## Project Overview

This project hosts multiple county-specific mineral rights professional directories on Cloudflare Pages. Each directory displays a list of service providers (attorneys, landmen, engineers, etc.) organized by category, with premium and free listings.

**Key Features:**
- Multiple subdomains (one per county/region)
- Server-side rendered HTML pages
- Data stored in Cloudflare KV
- Data sourced from Google Sheets via Apps Script
- Automatic data refresh via API endpoint
- SEO-optimized with structured data (JSON-LD)
- Google Analytics 4 and Google Tag Manager integration

---

## Architecture

### High-Level Flow

```
Google Sheets → Apps Script → Cloudflare KV → Cloudflare Pages Functions → HTML Pages
```

1. **Data Source**: Google Sheets contains directory listings
2. **Apps Script**: Converts sheet data to JSON API endpoint
3. **Cloudflare KV**: Stores cached JSON data per site
4. **Cloudflare Pages Functions**: Server-side render HTML from KV data
5. **End Users**: View rendered HTML pages

### Key Components

- **Cloudflare Pages**: Hosts the static site and Functions
- **Cloudflare KV**: Key-value store for directory data (`DIRECTORIES_KV`)
- **Google Sheets**: Source of truth for directory listings
- **Google Apps Script**: Converts sheets to JSON API
- **Tailwind CSS**: Styling framework (compiled to `public/styles.css`)

---

## Workflow: Adding a New Directory

### Step 1: Create Google Sheet

1. Create a new Google Sheet for the directory
2. Set up columns (see [Google Sheets Setup](#google-sheets-setup) section)
3. Add initial data entries

### Step 2: Create Apps Script

1. In Google Sheets, go to **Extensions** → **Apps Script**
2. Create a new Apps Script project (or copy from existing one)
3. Configure the script to:
   - Read data from the sheet
   - Convert to JSON format
   - Return `{ ok: true, companies: [...], updated_at: "...", etag: "..." }`
4. Deploy as a web app with "Execute as: Me" and "Who has access: Anyone"
5. Copy the deployment URL (will look like: `https://script.google.com/macros/s/.../exec`)

### Step 3: Add Domain Configuration

1. Open `sites.json` in the repository
2. Add a new entry with the subdomain as the key:

```json
{
  "county-name-state.mineralrightsforum.com": {
    "sheet": {
      "type": "apps_script_json",
      "url": "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?sheetId=YOUR_SHEET_ID"
    },
    "serving_line": "Serving County Name, State",
    "page_title": "County Name, ST Mineral Rights\nProfessionals Directory",
    "return_url": "https://www.mineralrightsforum.com/",
    "directory_intro": "Since 2009, the Mineral Rights Forum has helped thousands of mineral owners...",
    "seo": {
      "title": "County Name ST Mineral Rights | Oil & Gas Directory",
      "description": "Find trusted County Name, ST mineral rights attorneys, landmen, oil & gas lawyers..."
    },
    "category_order": "alpha",
    "theme": "default"
  }
}
```

**Important Fields:**
- **Domain key**: Must match the subdomain you'll configure in Cloudflare
- **sheet.url**: Apps Script deployment URL with `sheetId` query parameter
- **serving_line**: Text displayed on the page (e.g., "Serving Reeves County, Texas")
- **page_title**: Main heading (use `\n` for line breaks)
- **return_url**: Where the "Back to Forum" button links
- **seo.title**: Page title tag
- **seo.description**: Meta description
- **category_order**: `"alpha"` for alphabetical, or array of category names for custom order

### Step 4: Configure Cloudflare DNS

1. Log into Cloudflare dashboard
2. Add a CNAME record:
   - **Name**: `county-name-state` (or your subdomain)
   - **Target**: Your Cloudflare Pages domain (e.g., `your-project.pages.dev`)
   - **Proxy**: Enabled (orange cloud)

### Step 5: Configure Cloudflare Pages Custom Domain

1. In Cloudflare Pages dashboard, go to your project
2. Navigate to **Custom Domains**
3. Add custom domain: `county-name-state.mineralrightsforum.com`
4. Cloudflare will automatically configure SSL

### Step 6: Set Environment Variables

1. In Cloudflare Pages dashboard, go to **Settings** → **Environment Variables**
2. Ensure these are set:
   - `REFRESH_KEY`: Secret key for refresh endpoint authentication
   - `DIRECTORIES_KV`: KV namespace binding (configured in `wrangler.toml` or Pages dashboard)

### Step 7: Initial Data Refresh

1. Make a POST request to `https://county-name-state.mineralrightsforum.com/refresh`:
   ```bash
   curl -X POST https://county-name-state.mineralrightsforum.com/refresh \
     -H "X-Refresh-Key: YOUR_REFRESH_KEY"
   ```
2. Verify data loaded:
   ```bash
   curl https://county-name-state.mineralrightsforum.com/health
   ```

### Step 8: Verify Site

1. Visit `https://county-name-state.mineralrightsforum.com`
2. Check that companies appear correctly
3. Verify filters and search work
4. Test mobile responsiveness

---

## Workflow: Editing an Existing Directory

### Updating Directory Content

1. **Edit Google Sheet**: Make changes to company listings, categories, etc.
2. **Trigger Refresh**: 
   - Manually: POST to `/refresh` endpoint
   - Automatically: Set up a scheduled trigger (see [Data Refresh Workflow](#data-refresh-workflow))
3. **Verify Changes**: Check `/health` endpoint or visit the site

### Updating Directory Configuration

1. **Edit `sites.json`**:
   - Update SEO fields, titles, descriptions
   - Change `return_url` if needed
   - Modify `category_order` for custom sorting
2. **Deploy Changes**: Push to repository (Cloudflare Pages auto-deploys)
3. **No refresh needed**: Configuration changes take effect immediately on next deployment

### Adding/Removing Companies

1. **In Google Sheet**: Add new rows or mark rows as hidden
2. **Hidden Companies**: Set `plan` column to `"hidden"` or `"hide"` (or use `hidden` column)
3. **Refresh Data**: POST to `/refresh` endpoint
4. **Verify**: Hidden companies won't appear on the site

---

## File Structure & Purpose

### Root Level Files

- **`sites.json`**: Registry of all directory sites and their configurations
- **`package.json`**: NPM dependencies and build scripts
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`readme.md`**: Basic project information

### `/functions/` Directory

Cloudflare Pages Functions (serverless endpoints):

#### `index.js`
**Purpose**: Main page renderer for directory sites

**Routes**: `GET /`

**Functionality**:
- Loads site config from `sites.json` based on hostname
- Fetches company data from Cloudflare KV
- Filters out hidden companies
- Groups companies by category (premium vs free)
- Renders full HTML page with:
  - Search and filter functionality
  - Category sections
  - Company cards
  - SEO meta tags
  - JSON-LD structured data
  - Google Analytics tracking

**Special Handling**:
- If host is `directory.mineralrightsforum.com`, delegates to `counties.js`

#### `counties.js`
**Purpose**: Index page listing all county directories

**Routes**: `GET /` (only for `directory.mineralrightsforum.com`)

**Functionality**:
- Lists all county-specific directories from `sites.json`
- Groups by state
- Provides search and expand/collapse functionality
- Displays state flags

#### `refresh.js`
**Purpose**: Refresh directory data from Google Sheets

**Routes**: `POST /refresh`

**Authentication**: Requires `X-Refresh-Key` header matching `env.REFRESH_KEY`

**Functionality**:
- Fetches latest data from Apps Script URL
- Validates data structure
- Filters hidden companies
- Stores in Cloudflare KV
- Updates etag and timestamp
- Returns refresh status

**Response**:
```json
{
  "status": "ok" | "noop",
  "count": 25,
  "etag": "abc123",
  "updated_at": "2024-01-01T00:00:00Z",
  "duration_ms": 150
}
```

#### `data.json.js`
**Purpose**: API endpoint to get directory data as JSON

**Routes**: `GET /data.json`

**Functionality**:
- Returns raw company data from KV
- Includes metadata (etag, updated_at, count)
- Useful for debugging or external integrations

**Response**:
```json
{
  "ok": true,
  "updated_at": "2024-01-01T00:00:00Z",
  "etag": "abc123",
  "count": 25,
  "companies": [...]
}
```

#### `health.js`
**Purpose**: Health check endpoint

**Routes**: `GET /health`

**Functionality**:
- Checks if data exists in KV
- Reports data freshness (stale if > 2 hours old)
- Returns last error if any
- Returns 503 if no data or errors exist

**Response**:
```json
{
  "ok": true,
  "host": "reeves-county-texas.mineralrightsforum.com",
  "updated_at": "2024-01-01T00:00:00Z",
  "etag": "abc123",
  "count": 25,
  "stale": false,
  "last_error": null
}
```

#### `robots.txt.js`
**Purpose**: Dynamic robots.txt generator

**Routes**: `GET /robots.txt`

**Functionality**:
- Generates robots.txt with sitemap reference
- Allows all crawlers
- Points to `/sitemap.xml`

#### `sitemap.xml.js`
**Purpose**: Dynamic sitemap generator

**Routes**: `GET /sitemap.xml`

**Functionality**:
- Generates XML sitemap for SEO
- Includes homepage URL
- Sets daily change frequency

#### `_lib.js`
**Purpose**: Shared utility functions

**Exports**:
- `json()`: Create JSON response
- `getHost()`: Extract hostname from request
- `loadSitesRegistry()`: Load `sites.json`
- `getSiteConfig()`: Get config for specific host
- `KV_KEYS()`: Generate KV key names for a host
- `isStale()`: Check if timestamp is stale
- `quickHash()`: Generate hash for etag

### `/public/` Directory

Static files served directly:

- **`styles.css`**: Compiled Tailwind CSS (generated by build process)
- **`robots.txt`**: Static robots.txt (may be overridden by `robots.txt.js`)
- **`llms.txt`**: LLM training data file

### `/src/` Directory

Source files for CSS:

- **`app.css`**: Tailwind CSS source file
- **`brand.css`**: Brand-specific styles (if any)

---

## Google Sheets & Apps Script Setup

### Google Sheets Structure

Each directory sheet should have these columns:

| Column Name | Description | Required | Example |
|------------|-------------|----------|---------|
| `name` | Company name | Yes | "Smith & Associates" |
| `category` | Service category | Yes | "Attorneys" |
| `description_short` | Brief description | Yes | "Oil & gas attorneys serving..." |
| `plan` | Listing type | Yes | "premium" or "free" or "hidden" |
| `website_url` | Company website | No | "https://example.com?utm_adv=CompanyName" |
| `logo_url` | Company logo URL | No | "https://example.com/logo.png" |
| `contact_email` | Email address | No | "info@example.com" |
| `contact_phone` | Phone number | No | "(555) 123-4567" |
| `hidden` | Hide from directory | No | true/false (alternative to plan="hidden") |

**Notes**:
- `plan` values: `"premium"` (featured), `"free"` (standard), `"hidden"` (excluded)
- Premium listings show logo, email, phone buttons
- Free listings show only website link
- Hidden companies are filtered out completely

### Apps Script Requirements

The Apps Script must:

1. **Read Sheet Data**: Access the Google Sheet data
2. **Convert to JSON**: Transform rows into company objects
3. **Return Standard Format**:
   ```json
   {
     "ok": true,
     "companies": [
       {
         "name": "Company Name",
         "category": "Attorneys",
         "description_short": "...",
         "plan": "premium",
         "website_url": "...",
         "logo_url": "...",
         "contact_email": "...",
         "contact_phone": "..."
       }
     ],
     "updated_at": "2024-01-01T00:00:00Z",
     "etag": "unique-hash-or-version"
   }
   ```

4. **Handle Errors**: Return `{ ok: false, error: "..." }` on failure

### Apps Script Example Template

```javascript
function doGet(e) {
  try {
    const sheetId = e.parameter.sheetId || 'DEFAULT_SHEET_ID';
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const companies = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const company = {};
      headers.forEach((header, idx) => {
        company[header.toLowerCase().replace(/\s+/g, '_')] = row[idx] || '';
      });
      companies.push(company);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({
        ok: true,
        companies: companies,
        updated_at: new Date().toISOString(),
        etag: Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(companies))
          .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2))
          .join('')
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        ok: false,
        error: error.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Apps Script Deployment

1. **Deploy as Web App**:
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Version: "New" (for updates)

2. **Get Deployment URL**:
   - Copy the web app URL
   - Append `?sheetId=YOUR_SHEET_ID` query parameter
   - Use this URL in `sites.json`

3. **Test Deployment**:
   ```bash
   curl "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?sheetId=YOUR_SHEET_ID"
   ```

---

## Cloudflare Pages Configuration

### Required Setup

1. **KV Namespace**:
   - Create a KV namespace named `DIRECTORIES_KV`
   - Bind it to your Pages project in the dashboard

2. **Environment Variables**:
   - `REFRESH_KEY`: Secret key for `/refresh` endpoint authentication
   - Set in Pages dashboard → Settings → Environment Variables

3. **Custom Domains**:
   - Add each subdomain in Pages dashboard → Custom Domains
   - Cloudflare handles SSL automatically

4. **Build Configuration**:
   - **Build command**: `npm run build`
   - **Build output directory**: `public`
   - **Root directory**: `/` (project root)

### KV Namespace Structure

Keys are prefixed by site hostname:

```
site:{hostname}:data        → JSON array of companies
site:{hostname}:etag        → Content hash/version
site:{hostname}:updated_at  → ISO timestamp
site:{hostname}:last_error   → Error message (if any)
```

Example:
```
site:reeves-county-texas.mineralrightsforum.com:data
site:reeves-county-texas.mineralrightsforum.com:etag
site:reeves-county-texas.mineralrightsforum.com:updated_at
```

### DNS Configuration

For each subdomain:

1. **CNAME Record**:
   - Name: `county-name-state`
   - Target: `your-project.pages.dev` (or your Pages domain)
   - Proxy: Enabled (orange cloud)

2. **Custom Domain in Pages**:
   - Add `county-name-state.mineralrightsforum.com` in Pages dashboard
   - Cloudflare auto-configures SSL

---

## Data Refresh Workflow

### Manual Refresh

Trigger a refresh for a specific site:

```bash
curl -X POST https://county-name-state.mineralrightsforum.com/refresh \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY"
```

### Automatic Refresh Options

#### Option 1: Cloudflare Workers Cron Trigger

Create a Worker that runs on a schedule:

```javascript
export default {
  async scheduled(event, env, ctx) {
    const sites = ['site1', 'site2', 'site3']; // Your site hostnames
    for (const host of sites) {
      await fetch(`https://${host}/refresh`, {
        method: 'POST',
        headers: { 'X-Refresh-Key': env.REFRESH_KEY }
      });
    }
  }
}
```

Configure in `wrangler.toml`:
```toml
[triggers]
crons = ["0 */2 * * *"]  # Every 2 hours
```

#### Option 2: Google Apps Script Time-Driven Trigger

Add to your Apps Script:

```javascript
function createTimeDrivenTrigger() {
  ScriptApp.newTrigger('refreshDirectories')
    .timeBased()
    .everyHours(2)  // Every 2 hours
    .create();
}

function refreshDirectories() {
  const refreshKey = 'YOUR_REFRESH_KEY';
  const sites = [
    'reeves-county-texas.mineralrightsforum.com',
    'atascosa-county-texas.mineralrightsforum.com',
    // ... other sites
  ];
  
  sites.forEach(site => {
    UrlFetchApp.fetch(`https://${site}/refresh`, {
      method: 'post',
      headers: { 'X-Refresh-Key': refreshKey }
    });
  });
}
```

#### Option 3: External Cron Service

Use a service like:
- **cron-job.org**
- **EasyCron**
- **GitHub Actions** (scheduled workflow)

Example GitHub Actions workflow:

```yaml
name: Refresh Directories
on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh Sites
        run: |
          curl -X POST https://site1.mineralrightsforum.com/refresh \
            -H "X-Refresh-Key: ${{ secrets.REFRESH_KEY }}"
          # ... repeat for other sites
```

### Refresh Frequency Recommendations

- **Active directories**: Every 1-2 hours
- **Low-traffic directories**: Every 4-6 hours
- **After bulk edits**: Manual refresh immediately

---

## Deployment Process

### Initial Setup

1. **Connect Repository**:
   - Link GitHub repository to Cloudflare Pages
   - Configure build settings

2. **Build Configuration**:
   - Build command: `npm run build`
   - Output directory: `public`
   - Node version: `18` or `20`

3. **Environment Variables**:
   - Set `REFRESH_KEY` in Pages dashboard
   - Bind `DIRECTORIES_KV` namespace

4. **Deploy**:
   - Cloudflare Pages auto-deploys on git push to `main`
   - Or trigger manual deployment from dashboard

### Ongoing Deployments

1. **Make Changes**:
   - Edit files in repository
   - Commit and push to `main` branch

2. **Auto-Deploy**:
   - Cloudflare Pages detects push
   - Runs build command
   - Deploys new version

3. **Verify**:
   - Check deployment status in Pages dashboard
   - Visit site to confirm changes

### Build Process

The build process:

1. **Runs `npm run build`**:
   - Executes `npm run build:css`
   - Compiles Tailwind CSS from `src/app.css` to `public/styles.css`

2. **Deploys**:
   - `/public` directory → Static assets
   - `/functions` directory → Serverless functions

### Rollback

If a deployment fails:

1. Go to Pages dashboard → Deployments
2. Find previous successful deployment
3. Click "Retry deployment" or "Rollback to this deployment"

---

## Troubleshooting

### Site Shows "No data yet"

**Cause**: KV doesn't have data for this site

**Solution**:
1. Check `/health` endpoint: `curl https://site.mineralrightsforum.com/health`
2. If `count: 0`, trigger refresh: `POST /refresh`
3. Verify Apps Script URL is correct in `sites.json`
4. Check Apps Script returns valid JSON

### Refresh Endpoint Returns 401

**Cause**: Missing or incorrect `X-Refresh-Key` header

**Solution**:
1. Verify `REFRESH_KEY` environment variable is set
2. Check header matches exactly: `X-Refresh-Key: YOUR_KEY`
3. Ensure no extra spaces or characters

### Refresh Endpoint Returns 502

**Cause**: Apps Script error or invalid response

**Solution**:
1. Test Apps Script URL directly: `curl "https://script.google.com/..."`
2. Verify Apps Script returns `{ ok: true, companies: [...] }`
3. Check Apps Script execution logs in Google Apps Script dashboard
4. Verify `sheetId` parameter is correct

### Companies Not Appearing

**Cause**: Companies marked as hidden or filtering issue

**Solution**:
1. Check `plan` column in Google Sheet (should be "premium" or "free", not "hidden")
2. Check `hidden` column (should be empty or false)
3. Verify refresh completed successfully
4. Check `/data.json` endpoint to see raw data

### Styling Issues

**Cause**: CSS not compiled or outdated

**Solution**:
1. Run `npm run build` locally
2. Verify `public/styles.css` is updated
3. Commit and push changes
4. Clear browser cache

### Domain Not Resolving

**Cause**: DNS or custom domain configuration issue

**Solution**:
1. Verify CNAME record exists in Cloudflare DNS
2. Check custom domain is added in Pages dashboard
3. Wait for SSL certificate provisioning (can take a few minutes)
4. Verify DNS propagation: `dig county-name-state.mineralrightsforum.com`

### Health Check Shows Stale Data

**Cause**: Refresh hasn't run recently

**Solution**:
1. Data is considered stale if > 2 hours old
2. Trigger manual refresh: `POST /refresh`
3. Set up automatic refresh (see [Data Refresh Workflow](#data-refresh-workflow))

### Google Analytics Not Tracking

**Cause**: GTM/GA4 configuration issue

**Solution**:
1. Check GTM container ID in `index.js` (should be `GTM-M6JQPF`)
2. Verify GA4 measurement ID (should be `G-ZS0JTM2XTR`)
3. Check browser console for errors
4. Verify GTM preview mode shows events firing
5. See `GTM_GA4_SETUP.md` for detailed setup

---

## Additional Resources

### Related Documentation

- **`GTM_GA4_SETUP.md`**: Google Tag Manager and Analytics 4 setup guide
- **`readme.md`**: Basic project information

### Key URLs

- **Cloudflare Pages Dashboard**: https://dash.cloudflare.com/
- **Google Apps Script**: https://script.google.com/
- **Google Sheets**: https://sheets.google.com/

### Useful Endpoints

- **Health Check**: `GET /health` - Check site status
- **Data API**: `GET /data.json` - Get raw company data
- **Refresh**: `POST /refresh` - Update data from Google Sheets
- **Sitemap**: `GET /sitemap.xml` - SEO sitemap
- **Robots**: `GET /robots.txt` - Crawler instructions

### Development Commands

```bash
# Install dependencies
npm install

# Build CSS
npm run build

# Build everything
npm run build
```

### Testing Locally

Cloudflare Pages Functions can be tested locally with Wrangler:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Start local dev server
wrangler pages dev public --functions functions
```

### Code Style Notes

- **Functions**: Use ES6 modules (`import`/`export`)
- **Async/Await**: Prefer over callbacks
- **Error Handling**: Always handle errors gracefully
- **Security**: Never expose `REFRESH_KEY` in client-side code
- **Performance**: Cache data in KV, minimize external requests

---

## Handoff Checklist

When handing off this project to someone else, ensure they have:

- [ ] Access to Cloudflare account (Pages, KV, DNS)
- [ ] Access to Google Workspace (Sheets, Apps Script)
- [ ] `REFRESH_KEY` value documented securely
- [ ] List of all Google Sheet IDs and Apps Script URLs
- [ ] Understanding of `sites.json` structure
- [ ] Knowledge of refresh workflow and schedule
- [ ] Access to GitHub repository
- [ ] Understanding of deployment process
- [ ] Contact information for domain/DNS management

---

## Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Check `/health` endpoints for all sites
2. **Monthly**: Review Google Sheets for data quality
3. **Quarterly**: Audit Apps Script performance
4. **As Needed**: Update Tailwind CSS or dependencies

### Common Updates

- **Adding Companies**: Edit Google Sheet → Refresh
- **Updating SEO**: Edit `sites.json` → Deploy
- **Changing Styles**: Edit CSS → Build → Deploy
- **Adding Features**: Edit Functions → Deploy

---

**Last Updated**: 2024-01-01  
**Maintained By**: [Your Name/Team]  
**Repository**: [GitHub URL]

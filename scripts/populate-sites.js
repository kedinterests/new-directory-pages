#!/usr/bin/env node
/**
 * Populate the Sites tab in the master spreadsheet.
 * Source: Comprehensive Counties List (column B) or sites.json fallback.
 *
 * Prerequisites:
 * - Share Comprehensive Counties List with service account (Editor)
 *   https://docs.google.com/spreadsheets/d/13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY
 *
 * Usage: node scripts/populate-sites.js MASTER_SPREADSHEET_ID [--source counties|sites] [--credentials ./google-credentials.json]
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const COUNTIES_LIST_ID = '13x6qveVTnRR1GPe7gF7ilAiFgsIATnETLkeriJBRDcY';
const SITES_HEADERS = [
  'slug', 'state', 'division_type', 'division_name', 'page_title', 'return_url',
  'directory_intro', 'seo_title', 'seo_description', 'category_order', 'theme'
];

// State name (from slug) → 2-letter code
const STATE_TO_CODE = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new-hampshire': 'NH', 'new-jersey': 'NJ', 'new-mexico': 'NM', 'new-york': 'NY',
  'north-carolina': 'NC', 'north-dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode-island': 'RI', 'south-carolina': 'SC',
  'south-dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west-virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
};

function toTitleCase(str) {
  return str.split(/[- ]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parseSlugFromUrl(val) {
  if (!val || typeof val !== 'string') return null;
  const s = String(val).trim();
  if (s.includes('.mineralrightsforum.com')) {
    return s.split('.mineralrightsforum.com')[0].trim().toLowerCase();
  }
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) return s;
  return null;
}

function buildSiteFromSlug(slug) {
  if (!slug || slug === 'permian-basin') {
    return slug === 'permian-basin' ? {
      slug: 'permian-basin',
      state: '',
      division_type: 'area',
      division_name: 'Permian Basin',
      page_title: 'Permian Basin Mineral Rights\nProfessionals Directory',
      return_url: 'https://www.mineralrightsforum.com/c/texas-mineral-rights/permian-basin/',
      directory_intro: 'Since 2009, the Mineral Rights Forum has helped thousands of mineral owners understand oil & gas leasing terms, negotiate fair royalties, resolve title issues, and navigate oil & gas development. Use this directory to find professionals serving Permian Basin.',
      seo_title: 'Permian Basin Mineral Rights | Oil & Gas Directory',
      seo_description: 'Find trusted Permian Basin mineral rights attorneys, landmen, oil & gas lawyers, royalty buyers & lease consultants. Free directory for mineral owners.',
      category_order: 'alpha',
      theme: 'default',
    } : null;
  }

  const isParish = slug.includes('-parish-');
  const divisionType = isParish ? 'parish' : 'county';

  // Extract state: last segment after -county- or -parish-
  const match = slug.match(/-county-(.+)$/) || slug.match(/-parish-(.+)$/);
  const stateName = match ? match[1] : '';
  const stateCode = STATE_TO_CODE[stateName] || stateName.toUpperCase().slice(0, 2);

  // Extract division_name: everything before -county- or -parish-
  const nameMatch = slug.match(/^(.+?)-(?:county|parish)-/);
  const divisionName = nameMatch ? toTitleCase(nameMatch[1]) : toTitleCase(slug.split('-')[0]);

  const displayLabel = divisionType === 'area'
    ? divisionName
    : `${divisionName} ${divisionType === 'parish' ? 'Parish' : 'County'}, ${stateCode}`;

  const forumSlug = slug.replace(new RegExp('-' + stateName + '$'), '-' + stateCode.toLowerCase());
  const stateForumSlug = stateName.replace(/-/g, '-');
  const returnUrl = `https://www.mineralrightsforum.com/c/${stateForumSlug}-mineral-rights/${forumSlug}/`;

  return {
    slug,
    state: stateCode,
    division_type: divisionType,
    division_name: divisionName,
    page_title: `${displayLabel} Mineral Rights\nProfessionals Directory`,
    return_url: returnUrl,
    directory_intro: `Since 2009, the Mineral Rights Forum has helped thousands of mineral owners understand oil & gas leasing terms, negotiate fair royalties, resolve title issues, and navigate oil & gas development. Use this directory to find professionals serving ${displayLabel}.`,
    seo_title: `${displayLabel} Mineral Rights | Oil & Gas Directory`,
    seo_description: `Find trusted ${displayLabel} mineral rights attorneys, landmen, oil & gas lawyers, royalty buyers & lease consultants. Free directory for mineral owners.`,
    category_order: 'alpha',
    theme: 'default',
  };
}

async function fetchSitesFromCountiesList(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: COUNTIES_LIST_ID,
    range: "'County Names'!B:B",
  });
  const rows = res.data.values || [];
  const sites = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const val = rows[i][0];
    if (!val || typeof val !== 'string') continue;
    const trimmed = String(val).trim();
    if (trimmed === 'New State Below' || trimmed.toLowerCase().includes('new state')) continue;
    const slug = parseSlugFromUrl(trimmed);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const site = buildSiteFromSlug(slug);
    if (site) sites.push(site);
  }
  // Always include Permian Basin (area type)
  if (!seen.has('permian-basin')) {
    sites.push(buildSiteFromSlug('permian-basin'));
  }
  return sites;
}

function fetchSitesFromSitesJson() {
  const p = path.resolve(__dirname, '../sites.json');
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const sites = [];
  for (const [domain, config] of Object.entries(data)) {
    if (domain.includes('mineral-services-directory')) continue;
    const slug = domain.replace('.mineralrightsforum.com', '').toLowerCase();
    if (slug === 'permian-basin') {
      sites.push(buildSiteFromSlug('permian-basin'));
      continue;
    }
    if (!domain.includes('-county-') && !domain.includes('-parish-')) continue;
    const existing = buildSiteFromSlug(slug);
    if (!existing) continue;
    sites.push({
      ...existing,
      page_title: config.page_title || existing.page_title,
      return_url: config.return_url || existing.return_url,
      directory_intro: config.directory_intro || existing.directory_intro,
      seo_title: config.seo?.title || existing.seo_title,
      seo_description: config.seo?.description || existing.seo_description,
      category_order: config.category_order || 'alpha',
      theme: config.theme || 'default',
    });
  }
  return sites;
}

async function main() {
  const masterId = process.argv.slice(2).find(a => !a.startsWith('--') && /^[a-zA-Z0-9_-]{40,}$/.test(a));
  if (!masterId) {
    console.error('Usage: node scripts/populate-sites.js MASTER_SPREADSHEET_ID [--source counties|sites] [--credentials ./path]');
    process.exit(1);
  }

  let source = 'counties';
  const srcIdx = process.argv.indexOf('--source');
  if (srcIdx !== -1 && process.argv[srcIdx + 1]) {
    source = process.argv[srcIdx + 1].toLowerCase();
  }

  let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credIdx = process.argv.indexOf('--credentials');
  if (credIdx !== -1 && process.argv[credIdx + 1]) {
    credentialsPath = path.resolve(process.argv[credIdx + 1]);
  }
  if (!credentialsPath) {
    credentialsPath = path.resolve(__dirname, '../google-credentials.json');
  }
  if (!fs.existsSync(credentialsPath)) {
    console.error('Error: Google credentials required. Use --credentials ./google-credentials.json');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  let siteRows;
  if (source === 'sites') {
    console.log('Using sites.json as source...');
    siteRows = fetchSitesFromSitesJson();
    console.log(`Found ${siteRows.length} sites from sites.json`);
  } else {
    console.log('Fetching from Comprehensive Counties List...');
    try {
      siteRows = await fetchSitesFromCountiesList(sheets);
      console.log(`Found ${siteRows.length} sites from Counties List`);
    } catch (e) {
      console.error('Counties List access failed:', e.message);
      console.log('Falling back to sites.json...');
      siteRows = fetchSitesFromSitesJson();
      console.log(`Found ${siteRows.length} sites from sites.json`);
    }
  }

  if (siteRows.length === 0) {
    console.error('No sites to write.');
    process.exit(1);
  }

  const values = [
    SITES_HEADERS,
    ...siteRows.map(s => [
      s.slug, s.state, s.division_type, s.division_name, s.page_title, s.return_url,
      s.directory_intro, s.seo_title, s.seo_description, s.category_order, s.theme,
    ]),
  ];

  console.log('Writing to master spreadsheet Sites tab...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: masterId,
    range: "'Sites'!A1",
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  console.log(`Done! Wrote ${siteRows.length} sites to Sites tab.`);
  console.log(`URL: https://docs.google.com/spreadsheets/d/${masterId}/edit`);
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});

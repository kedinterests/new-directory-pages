#!/usr/bin/env node
/**
 * Migrate company rows from the 78 source sheets into the master spreadsheet Companies tab.
 * Deduplicates by company name (normalized): each company appears ONCE with all counties
 * in the counties field (comma-separated) from every sheet where it appears.
 *
 * Prerequisites: Share all 78 source sheets with the service account (Editor).
 *
 * Usage: node scripts/migrate-companies.js MASTER_SPREADSHEET_ID [--credentials ./path]
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const COMPANIES_HEADERS = [
  'name', 'category', 'description_short', 'plan', 'website_url', 'logo_url',
  'contact_email', 'contact_phone', 'hidden', 'counties'
];

function getSheetIdFromUrl(url) {
  const m = (url || '').match(/sheetId=([^&]+)/);
  return m ? m[1] : null;
}

function normalizeHeader(h) {
  return String(h || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Normalize company name for deduplication: trim, lowercase, collapse spaces */
function normalizeCompanyName(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function mapRowToMaster(row, headers, slug) {
  const headerMap = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key && row[i] !== undefined && row[i] !== null && row[i] !== '') {
      headerMap[key] = String(row[i]).trim();
    }
  });
  const get = (keys, def = '') => {
    for (const k of keys) {
      const v = headerMap[normalizeHeader(k)];
      if (v !== undefined) return v;
    }
    return def;
  };
  const plan = get(['plan'], '').toLowerCase();
  const hidden = plan === 'hidden' || plan === 'hide' || plan === 'h' ||
    headerMap.hidden === 'true' || headerMap.hidden === 'yes' || headerMap.hidden === '1';
  return {
    name: get(['name']),
    category: get(['category']),
    description_short: get(['description_short', 'description']),
    plan: get(['plan']),
    website_url: get(['website_url', 'website']),
    logo_url: get(['logo_url', 'logo']),
    contact_email: get(['contact_email', 'email']),
    contact_phone: get(['contact_phone', 'phone']),
    hidden: hidden ? 'TRUE' : 'FALSE',
    counties: new Set([slug]),
  };
}

async function main() {
  const masterId = process.argv.slice(2).find(a => !a.startsWith('--') && /^[a-zA-Z0-9_-]{40,}$/.test(a));
  if (!masterId) {
    console.error('Usage: node scripts/migrate-companies.js MASTER_SPREADSHEET_ID [--credentials ./path]');
    process.exit(1);
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
    console.error('Error: Google credentials required.');
    process.exit(1);
  }

  const sitesPath = path.resolve(__dirname, '../sites.json');
  if (!fs.existsSync(sitesPath)) {
    console.error('Error: sites.json not found.');
    process.exit(1);
  }
  const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const entries = Object.entries(sites).filter(([d]) => !d.includes('mineral-services-directory'));
  const companyMap = new Map(); // key: normalized company name
  const failed = [];
  const listFailedOnly = process.argv.includes('--list-failed');
  const total = entries.length;

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < entries.length; i++) {
    if (i > 0) await delay(1000); // Rate limit: 60/min to stay under Sheets API quota
    const [domain, config] = entries[i];
    if (listFailedOnly) {
      process.stderr.write(`Checking ${i + 1}/${total} ${domain}...\r`);
    }
    const sheetId = getSheetIdFromUrl(config.sheet?.url);
    if (!sheetId) {
      failed.push({ domain, reason: 'No sheetId in url' });
      continue;
    }
    const slug = domain.includes('permian-basin') ? 'permian-basin' : domain.replace('.mineralrightsforum.com', '');
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:Z',
      });
      const rows = res.data.values || [];
      if (rows.length < 2) continue;
      const headers = rows[0];
      const nameIdx = headers.findIndex(h => normalizeHeader(h) === 'name');
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = (row[nameIdx >= 0 ? nameIdx : 0] ?? '').toString().trim();
        if (!name) continue;
        const mapped = mapRowToMaster(row, headers, slug);
        const key = normalizeCompanyName(mapped.name);
        if (!key) continue;
        if (companyMap.has(key)) {
          const existing = companyMap.get(key);
          mapped.counties.forEach(c => existing.counties.add(c));
          // Prefer non-empty values from either row (keep first seen, but fill blanks from new)
          if (!existing.category && mapped.category) existing.category = mapped.category;
          if (!existing.description_short && mapped.description_short) existing.description_short = mapped.description_short;
          if (!existing.website_url && mapped.website_url) existing.website_url = mapped.website_url;
          if (!existing.logo_url && mapped.logo_url) existing.logo_url = mapped.logo_url;
          if (!existing.contact_email && mapped.contact_email) existing.contact_email = mapped.contact_email;
          if (!existing.contact_phone && mapped.contact_phone) existing.contact_phone = mapped.contact_phone;
          if (!existing.plan && mapped.plan) existing.plan = mapped.plan;
        } else {
          companyMap.set(key, mapped);
        }
      }
    } catch (e) {
      failed.push({ domain, slug, reason: e.message || 'Permission denied' });
    }
  }

  if (listFailedOnly) {
    process.stderr.write('\n'); // clear progress line
    if (failed.length === 0) {
      console.log('All sheets accessible. No action needed.');
    } else {
      console.log(`Share these ${failed.length} sheets with cursor@mrf-county-directories.iam.gserviceaccount.com (Editor):\n`);
      for (const f of failed) {
        const sheetId = getSheetIdFromUrl(sites[f.domain]?.sheet?.url);
        console.log(`${f.domain}`);
        if (sheetId) console.log(`  https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
        if (f.reason) console.log(`  Error: ${f.reason}`);
      }
    }
    process.exit(0);
  }

  if (failed.length > 0) {
    console.warn(`\nWarning: ${failed.length} sheets could not be read. Share each with cursor@mrf-county-directories.iam.gserviceaccount.com (Editor):`);
    failed.forEach(f => console.warn(`  - ${f.domain}`));
    console.warn(`\nThen re-run this script to pull companies and counties from all 78 sheets.`);
  }

  const allRows = [
    COMPANIES_HEADERS,
    ...Array.from(companyMap.values()).map(c => [
      c.name,
      c.category,
      c.description_short,
      c.plan,
      c.website_url,
      c.logo_url,
      c.contact_email,
      c.contact_phone,
      c.hidden,
      [...c.counties].sort().join(', '),
    ]),
  ];

  if (allRows.length <= 1) {
    console.error('No company rows to write.');
    process.exit(1);
  }

  const uniqueCount = allRows.length - 1;
  console.log(`Writing ${uniqueCount} unique companies (deduplicated) from ${entries.length - failed.length} sheets...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: masterId,
    range: "'Companies'!A:Z",
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: masterId,
    range: "'Companies'!A1",
    valueInputOption: 'RAW',
    requestBody: { values: allRows },
  });
  console.log(`Done! Companies tab updated (each company listed once with all counties).`);
  console.log(`URL: https://docs.google.com/spreadsheets/d/${masterId}/edit`);
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});

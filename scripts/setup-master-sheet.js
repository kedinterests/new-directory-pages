#!/usr/bin/env node
/**
 * Set up an existing spreadsheet with Companies, Sites, and Ads tabs + headers.
 * The sheet must be shared with the service account (Editor).
 *
 * Usage: node scripts/setup-master-sheet.js SPREADSHEET_ID [--credentials ./google-credentials.json]
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const COMPANIES_HEADERS = [
  'name', 'category', 'description_short', 'plan', 'website_url', 'logo_url',
  'contact_email', 'contact_phone', 'hidden', 'counties'
];

const SITES_HEADERS = [
  'slug', 'state', 'division_type', 'division_name', 'page_title', 'return_url',
  'directory_intro', 'seo_title', 'seo_description', 'category_order', 'theme'
];

const ADS_HEADERS = [
  'image_url', 'link', 'category', 'counties', 'priority', 'active'
];

async function main() {
  const spreadsheetId = process.argv.slice(2).find(a => !a.startsWith('--') && /^[a-zA-Z0-9_-]{40,}$/.test(a));
  if (!spreadsheetId) {
    console.error('Usage: node scripts/setup-master-sheet.js SPREADSHEET_ID [--credentials ./google-credentials.json]');
    process.exit(1);
  }

  let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const argIdx = process.argv.indexOf('--credentials');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    credentialsPath = path.resolve(process.argv[argIdx + 1]);
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

  console.log('Fetching spreadsheet...');
  let meta;
  try {
    meta = (await sheets.spreadsheets.get({ spreadsheetId })).data;
  } catch (e) {
    console.error('GET failed:', e.response?.status, e.message);
    throw e;
  }
  const existingSheets = meta.sheets || [];

  const requests = [];
  const updates = [];

  // Find or create Companies
  let companiesSheetId = existingSheets.find(s => s.properties.title === 'Companies')?.properties.sheetId;
  if (!companiesSheetId) {
    const sheet1 = existingSheets[0];
    if (sheet1 && sheet1.properties.title === 'Sheet1') {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: sheet1.properties.sheetId, title: 'Companies' },
          fields: 'title',
        },
      });
      companiesSheetId = sheet1.properties.sheetId;
    } else {
      requests.push({
        addSheet: {
          properties: { title: 'Companies' },
        },
      });
    }
  }

  // Add Sites if missing
  const hasSites = existingSheets.some(s => s.properties.title === 'Sites');
  if (!hasSites) {
    requests.push({
      addSheet: {
        properties: { title: 'Sites' },
      },
    });
  }

  // Add Ads if missing
  const hasAds = existingSheets.some(s => s.properties.title === 'Ads');
  if (!hasAds) {
    requests.push({
      addSheet: {
        properties: { title: 'Ads' },
      },
    });
  }

  if (requests.length > 0) {
    console.log('Updating sheet structure...');
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    } catch (e) {
      console.error('batchUpdate failed:', e.response?.status, e.message);
      throw e;
    }
  }

  // Re-fetch to get sheet IDs after adds
  const meta2 = (await sheets.spreadsheets.get({ spreadsheetId })).data;
  const sheetsByName = {};
  for (const s of meta2.sheets || []) {
    sheetsByName[s.properties.title] = s.properties.sheetId;
  }

  // Write headers
  console.log('Writing headers...');
  try {
    await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: "'Companies'!A1:J1", values: [COMPANIES_HEADERS] },
        { range: "'Sites'!A1:K1", values: [SITES_HEADERS] },
        { range: "'Ads'!A1:F1", values: [ADS_HEADERS] },
      ],
    },
  });
  } catch (e) {
    console.error('values.batchUpdate failed:', e.response?.status, e.message);
    throw e;
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  console.log('');
  console.log('Done! Master spreadsheet is ready.');
  console.log('URL:', url);
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});

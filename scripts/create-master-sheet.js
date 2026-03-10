#!/usr/bin/env node
/**
 * Create the MRF Directory Master spreadsheet via Google Sheets API.
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON,
 * or pass --credentials path/to/credentials.json
 *
 * Usage: node scripts/create-master-sheet.js [--credentials ./google-credentials.json]
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
  let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const argIdx = process.argv.indexOf('--credentials');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    credentialsPath = path.resolve(process.argv[argIdx + 1]);
  }

  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    console.error('Error: Google credentials required.');
    console.error('  Option 1: Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON');
    console.error('  Option 2: node scripts/create-master-sheet.js --credentials ./google-credentials.json');
    console.error('');
    console.error('Get credentials: Google Cloud Console → APIs & Services → Credentials → Create Service Account → Download JSON');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  console.log('Creating spreadsheet "MRF Directory Master"...');

  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'MRF Directory Master' },
      sheets: [
        {
          properties: { title: 'Companies' },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{ values: COMPANIES_HEADERS.map(h => ({ userEnteredValue: { stringValue: h } })) }],
          }],
        },
        {
          properties: { title: 'Sites' },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{ values: SITES_HEADERS.map(h => ({ userEnteredValue: { stringValue: h } })) }],
          }],
        },
        {
          properties: { title: 'Ads' },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{ values: ADS_HEADERS.map(h => ({ userEnteredValue: { stringValue: h } })) }],
          }],
        },
      ],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const shareIdx = process.argv.indexOf('--share-with');
  if (shareIdx !== -1 && process.argv[shareIdx + 1]) {
    const email = process.argv[shareIdx + 1];
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: email,
      },
    });
    console.log(`Shared with ${email}`);
  }

  console.log('');
  console.log('Done! Master spreadsheet created.');
  console.log('');
  console.log('Spreadsheet ID:', spreadsheetId);
  console.log('URL:', spreadsheetUrl);
  console.log('');
  if (!shareIdx) {
    console.log('Tip: Run with --share-with your@email.com to share the sheet with yourself.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.response?.data) {
    console.error('Details:', JSON.stringify(err.response.data, null, 2));
    const msg = err.response.data?.error?.message;
    if (msg?.includes('permission')) {
      console.error('\nTroubleshooting: Enable Google Drive API at https://console.developers.google.com/apis/api/drive.googleapis.com');
      console.error('If using Google Workspace, your org admin may need to allow the service account.');
    }
  }
  process.exit(1);
});

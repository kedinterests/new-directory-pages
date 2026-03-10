#!/usr/bin/env node
/**
 * Add/update Counties Reference sheet to the master spreadsheet.
 * Provides multiselect options: * (All counties), state:XX (All TX, etc.), and individual slugs.
 * Use for Data Validation on Companies.counties and Ads.counties columns.
 *
 * Usage: node scripts/add-counties-reference.js MASTER_SPREADSHEET_ID [--credentials ./path]
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

async function main() {
  const masterId = process.argv.slice(2).find(a => !a.startsWith('--') && /^[a-zA-Z0-9_-]{40,}$/.test(a));
  if (!masterId) {
    console.error('Usage: node scripts/add-counties-reference.js MASTER_SPREADSHEET_ID [--credentials ./path]');
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

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: masterId,
    range: "'Sites'!A1:C",
  });
  const rows = res.data.values || [];
  if (rows.length < 2) {
    console.error('Sites tab is empty or missing.');
    process.exit(1);
  }

  const headers = rows[0].map(h => String(h || '').toLowerCase().replace(/\s+/g, '_'));
  const slugIdx = headers.indexOf('slug');
  const stateIdx = headers.indexOf('state');
  if (slugIdx < 0 || stateIdx < 0) {
    console.error('Sites tab must have slug and state columns.');
    process.exit(1);
  }

  const states = new Set();
  const slugs = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const slug = String(row[slugIdx] || '').trim();
    const state = String(row[stateIdx] || '').trim().toUpperCase();
    if (slug) slugs.push(slug);
    if (state) states.add(state);
  }

  const refRows = [
    ['Value', 'Label'],
    ['*', 'All counties'],
  ];
  const sortedStates = [...states].sort();
  for (const st of sortedStates) {
    refRows.push([`state:${st}`, `All ${STATE_NAMES[st] || st}`]);
  }
  refRows.push(['', '--- Individual counties (copy slugs below) ---']);
  for (const s of slugs.sort()) {
    refRows.push([s, s]);
  }

  const meta = (await sheets.spreadsheets.get({ spreadsheetId: masterId })).data;
  const hasRef = (meta.sheets || []).some(s => s.properties.title === 'Counties Reference');

  if (hasRef) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterId,
      range: "'Counties Reference'!A1",
      valueInputOption: 'RAW',
      requestBody: { values: refRows },
    });
    console.log('Updated Counties Reference sheet.');
  } else {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: masterId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: 'Counties Reference' },
          },
        }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterId,
      range: "'Counties Reference'!A1",
      valueInputOption: 'RAW',
      requestBody: { values: refRows },
    });
    console.log('Created Counties Reference sheet.');
  }

  console.log(`  * = All counties`);
  console.log(`  state:XX = All ${sortedStates.length} states`);
  console.log(`  ${slugs.length} individual slugs`);

  // Apply Data Validation: Companies counties = free text (comma-separated slugs); Ads = single-select from list
  const meta2 = (await sheets.spreadsheets.get({ spreadsheetId: masterId })).data;
  const companiesSheet = (meta2.sheets || []).find(s => s.properties.title === 'Companies');
  const adsSheet = (meta2.sheets || []).find(s => s.properties.title === 'Ads');
  const refSheet = (meta2.sheets || []).find(s => s.properties.title === 'Counties Reference');

  if (!companiesSheet || !refSheet) {
    console.log('Skipping Data Validation (Companies or Counties Reference not found).');
  } else {
    const companiesSheetId = companiesSheet.properties.sheetId;
    const refRowCount = refRows.length;
    const listRange = `'Counties Reference'!A2:A${refRowCount + 1}`;

    const requests = [
      // Clear validation on Companies counties (column J) - stores comma-separated slugs; dropdown is single-select only
      {
        setDataValidation: {
          range: {
            sheetId: companiesSheetId,
            startRowIndex: 0,
            endRowIndex: 10000,
            startColumnIndex: 9,
            endColumnIndex: 10,
          },
          // Omit rule to clear validation - allows comma-separated county slugs
        },
      },
    ];

    if (adsSheet) {
      requests.push({
        setDataValidation: {
          range: {
            sheetId: adsSheet.properties.sheetId,
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 3,
            endColumnIndex: 4,
          },
          rule: {
            condition: {
              type: 'ONE_OF_RANGE',
              values: [{ userEnteredValue: `=${listRange}` }],
            },
            showCustomUi: true,
            strict: false,
          },
        },
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: masterId,
      requestBody: { requests },
    });
    console.log('Companies counties: validation cleared (comma-separated slugs). Ads counties: validation applied.');
  }

  console.log(`URL: https://docs.google.com/spreadsheets/d/${masterId}/edit`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

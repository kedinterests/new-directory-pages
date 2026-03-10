#!/usr/bin/env node
/** Quick test: can the service account access this spreadsheet? */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const spreadsheetId = process.argv[2] || '1KHAw1w5_1ykLpsIsSiICHyCUnaf1yLYYBqTYfvrXwrw';
const credPath = path.resolve(__dirname, '../google-credentials.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
  });

  console.log('Service account:', (JSON.parse(fs.readFileSync(credPath, 'utf8'))).client_email);
  console.log('Testing spreadsheet:', spreadsheetId);
  console.log('');

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('Sheets API: OK');
    console.log('Title:', res.data.properties?.title);
    console.log('Sheets:', (res.data.sheets || []).map(s => s.properties?.title).join(', '));
  } catch (e) {
    console.log('Sheets API:', e.response?.status, e.message);
  }

  try {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.get({ fileId: spreadsheetId, fields: 'id,name,owners' });
    console.log('Drive API: OK');
    console.log('File name:', res.data.name);
  } catch (e) {
    console.log('Drive API:', e.response?.status, e.message);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

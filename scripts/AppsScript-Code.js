/**
 * Apps Script for MRF Directory Master spreadsheet.
 * Copy this into Extensions → Apps Script in the master sheet.
 * Deploy as web app: Execute as Me, Who has access: Anyone.
 *
 * Multi-select counties: Use menu Directory → Select counties (with a cell in Companies.counties selected).
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Directory')
    .addItem('Select counties (multi-select)', 'showCountiesSidebar')
    .addToUi();
}

function showCountiesSidebar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const range = ss.getActiveRange();
  if (!range) {
    SpreadsheetApp.getUi().alert('Select a cell in the counties column first.');
    return;
  }
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const col = range.getColumn();
  const companiesSheet = ss.getSheetByName('Companies');
  const COUNTIES_COL = 10; // J
  if (sheetName !== 'Companies' || col !== COUNTIES_COL) {
    SpreadsheetApp.getUi().alert('Select a cell in the Companies sheet, counties column (J) first.');
    return;
  }
  const row = range.getRow();
  const currentValue = String(range.getValue() || '').trim();
  const data = getCountiesForSidebar();
  const template = HtmlService.createTemplateFromFile('CountiesSidebar');
  template.data = JSON.stringify(data);
  template.currentValue = JSON.stringify(currentValue);
  template.row = row;
  template.col = col;
  const html = template.evaluate().setTitle('Select counties').setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getCountiesForSidebar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const refSheet = ss.getSheetByName('Counties Reference');
  if (!refSheet) return { items: [] };
  const data = refSheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const val = String(data[i][0] || '').trim();
    const label = String(data[i][1] || val).trim();
    if (val && !label.startsWith('---')) items.push({ value: val, label: label });
  }
  return { items };
}

function setCountiesInCell(row, col, selectedValues) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Companies');
  if (!sheet) return;
  const cell = sheet.getRange(row, col);
  cell.setValue(selectedValues.filter(Boolean).join(', '));
}

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
      return v;
    }

    const companies = [];
    for (let i = 1; i < companiesData.length; i++) {
      const row = companiesData[i];
      const obj = {};
      companyHeaders.forEach((h, j) => { obj[h] = row[j] !== undefined && row[j] !== null ? row[j] : ''; });
      if (!String(obj.name || '').trim()) continue;
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

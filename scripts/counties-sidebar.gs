/**
 * Counties sidebar script — handles multi-select county picker.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Directory')
    .addItem('Refresh site from this sheet', 'refreshDirectory')
    .addSeparator()
    .addItem('Select counties (multi-select)', 'showCountiesSidebar')
    .addSeparator()
    .addItem('Set refresh key…', 'setRefreshKey')
    .addToUi();
}

const COUNTY_PICKER_SHEETS = ['Companies', 'Ads'];

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
  if (!COUNTY_PICKER_SHEETS.includes(sheetName)) {
    SpreadsheetApp.getUi().alert('Select a cell in the counties column on the Companies or Ads sheet first.');
    return;
  }
  const headerRow = sheet.getRange(1, col).getValue();
  if (String(headerRow || '').toLowerCase().trim() !== 'counties') {
    SpreadsheetApp.getUi().alert('Select a cell in the counties column first.');
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
  template.sheetName = JSON.stringify(sheetName);
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

function setCountiesInCell(row, col, selectedValues, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || 'Companies');
  if (!sheet) return;
  const cell = sheet.getRange(row, col);
  cell.setValue((selectedValues || []).filter(function(v) { return v && String(v).trim(); }).join(', '));
}

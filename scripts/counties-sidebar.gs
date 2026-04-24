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
  const filtered = (selectedValues || []).filter(function(v) { return v && String(v).trim(); });
  const finalValue = filtered.length > 0 ? filtered.join(', ') : '';
  Logger.log('DEBUG: selectedValues = ' + JSON.stringify(selectedValues));
  Logger.log('DEBUG: filtered = ' + JSON.stringify(filtered));
  Logger.log('DEBUG: finalValue = "' + finalValue + '"');
  cell.setValue(finalValue);
}

/**
 * Refresh script — handles pushing data to Cloudflare Pages.
 * Deploy separately or keep with main script.
 */

const REFRESH_URL = 'https://mrf-county-directories.pages.dev/refresh';

/** Set the refresh key (one-time setup). */
function setRefreshKey() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'Set refresh key',
    'Paste the REFRESH_KEY for the Cloudflare Pages project:',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const key = (res.getResponseText() || '').trim();
  if (!key) {
    ui.alert('No key entered.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('REFRESH_KEY', key);
  ui.alert('Refresh key saved. You can now use Directory → Refresh site from this sheet.');
}

/** Push sheet data to the Pages /refresh endpoint. */
function refreshDirectory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const key = PropertiesService.getScriptProperties().getProperty('REFRESH_KEY');
  if (!key) {
    ui.alert('No refresh key set. Run Directory → Set refresh key… first.');
    return;
  }
  ss.toast('Pushing sheet data to the live site…', 'Directory', -1);
  let res;
  try {
    res = UrlFetchApp.fetch(REFRESH_URL, {
      method: 'post',
      headers: { 'X-Refresh-Key': key },
      muteHttpExceptions: true,
      followRedirects: true,
    });
  } catch (err) {
    ss.toast('', 'Directory', 1);
    ui.alert('Refresh error', String(err), ui.ButtonSet.OK);
    return;
  }
  const code = res.getResponseCode();
  const body = res.getContentText();
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (e) {}
  if (code === 200 && parsed && parsed.status === 'ok') {
    const secs = Math.round((parsed.duration_ms || 0) / 1000);
    ss.toast(
      `Updated ${parsed.sites_updated} site${parsed.sites_updated === 1 ? '' : 's'} in ${secs}s.`,
      'Directory refreshed',
      8
    );
  } else {
    ss.toast('', 'Directory', 1);
    ui.alert('Refresh failed', `HTTP ${code}\n\n${body.slice(0, 500)}`, ui.ButtonSet.OK);
  }
}

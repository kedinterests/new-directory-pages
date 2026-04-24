/**
 * Data export script — handles /refresh endpoint requests.
 */

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

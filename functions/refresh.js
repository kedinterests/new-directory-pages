// /functions/refresh.js
import { json, KV_KEYS, quickHash } from './_lib.js';

function buildDisplayLabel(divisionType, divisionName, state) {
  if (divisionType === 'area' || divisionType === 'national') return divisionName || '';
  const word = divisionType === 'parish' ? 'Parish' : 'County';
  return `${divisionName || ''} ${word}, ${state || ''}`.trim();
}

export const onRequestPost = async ({ request, env }) => {
  const provided = request.headers.get('X-Refresh-Key');
  if (!provided || provided !== env.REFRESH_KEY) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = env.MASTER_SHEET_URL;
  if (!url) {
    return json({ ok: false, error: 'MASTER_SHEET_URL not set' }, { status: 500 });
  }

  const t0 = Date.now();
  let upstream;
  try {
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`Apps Script ${res.status}`);
    upstream = await res.json();
  } catch (err) {
    return json({ ok: false, error: 'Fetch failed' }, { status: 502 });
  }

  if (!upstream?.ok || !Array.isArray(upstream.companies) || !Array.isArray(upstream.sites)) {
    return json({ ok: false, error: 'Invalid upstream response' }, { status: 502 });
  }
  const ads = Array.isArray(upstream.ads) ? upstream.ads : [];
  const sheetCategoryOrder = Array.isArray(upstream.categories) && upstream.categories.length > 0
    ? upstream.categories
    : null;

  // Pre-index companies by county slug and collect nationwide companies — avoids O(sites × companies) scan
  const byCounty = {};
  const nationwideCompanies = [];

  for (const row of upstream.companies) {
    const plan = String(row.plan || '').toLowerCase().trim();
    if (plan === 'hidden' || plan === 'hide' || plan === 'h') continue;
    if (row.hidden === true || row.hidden === 'true' || row.hidden === 'yes' || row.hidden === 1) continue;
    if (String(row.hidden || '').toLowerCase().trim() === 'hidden' || String(row.hidden || '').toLowerCase().trim() === 'hide') continue;
    if (row.status === 'hidden' || String(row.status || '').toLowerCase().trim() === 'hidden') continue;
    if (row.visible === false || row.visible === 'false') continue;
    if (row.show === false || row.show === 'false') continue;

    const nw = row['nationwide?'];
    if (nw === true || nw === 'TRUE' || nw === 'true' || nw === 'yes' || nw === 'YES') {
      nationwideCompanies.push(row);
    } else {
      const rowCounties = String(row.counties || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      for (const c of rowCounties) {
        if (!byCounty[c]) byCounty[c] = [];
        byCounty[c].push(row);
      }
    }
  }

  const sitesMap = {};
  const payloads = [];

  for (const site of upstream.sites) {
    const slug = String(site.slug || '').trim();
    if (!slug) continue;

    const slugLower = slug.toLowerCase();
    const isNational = (site.division_type || '').toLowerCase() === 'national';
    const rawCompanies = isNational ? nationwideCompanies : (byCounty[slugLower] || []);

    const companiesForSite = rawCompanies.map(row => {
      const baseUrl = (row.website_url || '').trim();
      if (!baseUrl) return row;
      const withUtm = { ...row };
      const divisionName = String(site.division_name || '').trim().toLowerCase().replace(/\s+/g, '_');
      const state = String(site.state || '').trim().toLowerCase();
      const utmCampaign = `${divisionName}_county_${state}_specific`;
      const utmAdv = String(row.utm_adv || '').trim();
      let utmUrl = `${baseUrl}?utm_source=mrf&utm_medium=referral&utm_campaign=${encodeURIComponent(utmCampaign)}`;
      if (utmAdv) utmUrl += `&utm_adv=${encodeURIComponent(utmAdv)}`;
      withUtm.website_url = utmUrl;
      return withUtm;
    });

    const isNationalSite = (site.division_type || '').toLowerCase() === 'national';
    const adsForSite = ads.filter(ad => {
      const adCounties = String(ad.counties || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      const adNationwide = ad.nationwide === true || String(ad.nationwide || '').toUpperCase() === 'TRUE';
      if (!adCounties.length && !adNationwide) return true;
      if (adNationwide && isNationalSite) return true;
      if (adCounties.length && adCounties.includes(slugLower)) return true;
      return false;
    });

    const displayLabel = buildDisplayLabel(site.division_type, site.division_name, site.state);
    const config = {
      slug,
      division_type: site.division_type || 'county',
      division_name: site.division_name || '',
      state: site.state || '',
      display_label: displayLabel,
      page_title: site.page_title,
      return_url: site.return_url,
      directory_intro: (site.directory_intro || '').replace(/\{display_name\}/g, displayLabel),
      seo: { title: site.seo_title, description: site.seo_description },
      category_order: site.category_order || 'alpha',
      categoryOrder: sheetCategoryOrder || null,
      theme: site.theme || 'default',
    };

    sitesMap[slug] = config;
    const keys = KV_KEYS(slug);
    payloads.push({
      keys,
      data: JSON.stringify(companiesForSite),
      ads: JSON.stringify(adsForSite),
      config: JSON.stringify(config),
      etag: quickHash(companiesForSite),
      updated: upstream.updated_at || new Date().toISOString(),
    });
  }

  // Batch KV writes in parallel (50 sites at a time) to stay under function timeout
  const BATCH_SIZE = 50;
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.flatMap(({ keys, data, ads, config, etag, updated }) => [
        env.DIRECTORIES_KV.put(keys.data, data),
        env.DIRECTORIES_KV.put(keys.ads, ads),
        env.DIRECTORIES_KV.put(keys.config, config),
        env.DIRECTORIES_KV.put(keys.etag, etag),
        env.DIRECTORIES_KV.put(keys.updated, updated),
        env.DIRECTORIES_KV.delete(keys.lastError),
      ])
    );
  }

  await env.DIRECTORIES_KV.put('directory:index:config', JSON.stringify(sitesMap));

  return json({
    status: 'ok',
    sites_updated: payloads.length,
    duration_ms: Date.now() - t0,
  });
};

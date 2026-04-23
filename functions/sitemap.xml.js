// /functions/sitemap.xml.js
import { loadSitesRegistryFromKV, KV_KEYS } from './_lib.js';

/** Generate sitemap.xml — index + one entry per directory slug (excluding empty dirs) */
export const onRequestGet = async ({ request, env }) => {
  const baseUrl = new URL(request.url).origin;
  const currentDate = new Date().toISOString().split('T')[0];

  let sitesMap;
  try {
    sitesMap = await loadSitesRegistryFromKV(env);
  } catch (err) {
    return new Response(`<!-- Error: ${String(err)} -->`, {
      status: 500,
      headers: { 'content-type': 'text/xml; charset=utf-8' },
    });
  }

  const slugs = Object.keys(sitesMap || {}).filter(Boolean);

  // Filter out empty directories (those with no companies)
  const nonEmptySlugs = [];
  for (const slug of slugs) {
    try {
      const dataKey = KV_KEYS(slug).data;
      const companiesJson = await env.DIRECTORIES_KV.get(dataKey);
      if (companiesJson) {
        const companies = JSON.parse(companiesJson);
        if (Array.isArray(companies) && companies.length > 0) {
          nonEmptySlugs.push(slug);
        }
      }
    } catch (e) {
      // If we can't determine, include it to be safe
      nonEmptySlugs.push(slug);
    }
  }

  const urlEntries = [
    `<url><loc>${baseUrl}/</loc><lastmod>${currentDate}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...nonEmptySlugs.map(slug => `<url><loc>${baseUrl}/${slug}</loc><lastmod>${currentDate}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlEntries.join('\n  ')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};

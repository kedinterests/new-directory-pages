// /functions/_lib.js

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  });
}

export function getHost(request) {
  return new URL(request.url).host.toLowerCase();
}

/** Extract slug from path: /reeves-county-texas → reeves-county-texas; / → null */
export function getSlugFromPath(request) {
  const path = new URL(request.url).pathname.replace(/^\/|\/$/g, '');
  return path || null;
}

/** Path-based KV keys (directory:{slug}:*) */
export const KV_KEYS = (slug) => ({
  data: `directory:${slug}:data`,
  config: `directory:${slug}:config`,
  ads: `directory:${slug}:ads`,
  etag: `directory:${slug}:etag`,
  updated: `directory:${slug}:updated_at`,
  lastError: `directory:${slug}:last_error`,
});

/** Legacy host-based KV keys (for rollback) */
export const KV_KEYS_HOST = (host) => ({
  data: `site:${host}:data`,
  etag: `site:${host}:etag`,
  updated: `site:${host}:updated_at`,
  lastError: `site:${host}:last_error`,
});

export async function loadSitesRegistry() {
  const mod = await import('../sites.json', { assert: { type: 'json' } });
  return mod.default || mod;
}

export function getSiteConfig(sites, host) {
  const site = sites[host];
  if (!site) throw new Error(`Site not found in registry for host: ${host}`);
  if (!site.sheet?.url) throw new Error(`Missing Apps Script URL for host: ${host}`);
  return site;
}

export async function loadDirectoryConfigFromKV(env, slug) {
  const key = `directory:${slug}:config`;
  const raw = await env.DIRECTORIES_KV.get(key);
  if (!raw) throw new Error(`No config for slug: ${slug}`);
  return JSON.parse(raw);
}

export async function loadSitesRegistryFromKV(env) {
  const key = 'directory:index:config';
  const raw = await env.DIRECTORIES_KV.get(key);
  if (!raw) throw new Error('No sites registry in KV');
  return JSON.parse(raw);
}

export function isStale(updatedAtISO, minutes = 120) {
  if (!updatedAtISO) return true;
  const ageMs = Date.now() - Date.parse(updatedAtISO);
  return ageMs > minutes * 60 * 1000;
}

// Fallback etag if upstream didn't provide one
export function quickHash(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

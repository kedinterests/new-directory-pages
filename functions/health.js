// /functions/health.js
import { json } from './_lib.js';

/** Global health: checks directory:index:config. For /{slug}/health use [slug]/health.js */
export const onRequestGet = async ({ request, env }) => {
  const raw = await env.DIRECTORIES_KV.get('directory:index:config');
  const hasConfig = !!raw;
  let sitesCount = 0;
  if (raw) {
    try {
      const map = JSON.parse(raw);
      sitesCount = Object.keys(map || {}).length;
    } catch (_) {}
  }

  const body = { ok: true, sites_count: sitesCount, has_config: hasConfig };
  const status = hasConfig ? 200 : 503;
  return json(body, { status });
};

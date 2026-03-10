// /functions/[slug]/health.js — GET /{slug}/health
import { json, KV_KEYS, isStale } from '../_lib.js';

export const onRequestGet = async ({ env, params }) => {
  const slug = params?.slug;
  if (!slug) return json({ ok: false, error: 'Missing slug' }, { status: 400 });

  const keys = KV_KEYS(slug);
  const [raw, etag, updated_at, lastError] = await Promise.all([
    env.DIRECTORIES_KV.get(keys.data),
    env.DIRECTORIES_KV.get(keys.etag),
    env.DIRECTORIES_KV.get(keys.updated),
    env.DIRECTORIES_KV.get(keys.lastError),
  ]);

  const count = raw ? JSON.parse(raw).length : 0;
  const stale = isStale(updated_at, 120);
  const body = { ok: true, slug, updated_at, etag, count, stale };
  if (lastError) body.last_error = lastError;

  const status = (count === 0 || lastError) ? 503 : 200;
  return json(body, { status });
};

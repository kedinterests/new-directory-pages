// /functions/[slug]/data.json.js — GET /{slug}/data.json
import { json, KV_KEYS } from '../_lib.js';

export const onRequestGet = async ({ env, params }) => {
  const slug = params?.slug;
  if (!slug) return json({ ok: false, error: 'Missing slug' }, { status: 400 });

  const keys = KV_KEYS(slug);
  const [raw, etag, updated_at] = await Promise.all([
    env.DIRECTORIES_KV.get(keys.data),
    env.DIRECTORIES_KV.get(keys.etag),
    env.DIRECTORIES_KV.get(keys.updated),
  ]);

  if (!raw) return json({ ok: false, error: 'no data yet' }, { status: 503 });

  const companies = JSON.parse(raw);
  return json({ ok: true, updated_at, etag, count: companies.length, companies });
};

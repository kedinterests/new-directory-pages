// /functions/data.json.js
/** Root /data.json — returns empty (index has no companies). Use /{slug}/data.json for county data. */
import { json } from './_lib.js';

export const onRequestGet = async () => {
  return json({ ok: true, companies: [], count: 0, message: 'Use /{slug}/data.json for county data' });
};

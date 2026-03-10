// /functions/index.js
/** SSR "/" — delegates to counties index (path-based: directory.mineralrightsforum.com/) */
export const onRequestGet = async ({ request, env }) => {
  const { onRequestGet: countiesHandler } = await import('./counties.js');
  return countiesHandler({ request, env });
};

export const DEAL_PREVIEW_PATH = "/preview/deal";

export function dealPath(id) {
  return `/deals/${encodeURIComponent(id)}`;
}

export function resolveDealRoute(pathname) {
  if ([DEAL_PREVIEW_PATH, `${DEAL_PREVIEW_PATH}/`, "/deal.html"].includes(pathname)) {
    return { dealId: "layout-preview", preview: true };
  }
  const match = pathname.match(/^\/deals\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const dealId = decodeURIComponent(match[1]);
    return dealId && !dealId.includes("/") ? { dealId, preview: false } : null;
  } catch {
    return null;
  }
}

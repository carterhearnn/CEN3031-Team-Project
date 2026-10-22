// Public host-app interface. Keep this module free of UI and stylesheet imports.
import { fetchProductPreview, productFields } from "./lib/productPreview.js";

export { dealPath, DEAL_PREVIEW_PATH } from "./routes.js";
export { fetchProductPreview as loadDealPreview } from "./lib/productPreview.js";

export async function enrichDealRecord(record) {
  try {
    const preview = await fetchProductPreview(record.link);
    return { ...record, ...productFields(preview) };
  } catch {
    // Retailer availability must never prevent submitting the original link.
    return { ...record };
  }
}

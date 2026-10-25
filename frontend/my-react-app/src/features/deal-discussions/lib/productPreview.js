import { externalUrl } from "./deals.js";

export async function fetchProductPreview(link, { signal } = {}) {
  const url = externalUrl(link);
  if (!url) throw new Error("Enter an http or https product link.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetch(`/api/deal-preview?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Thumbnail unavailable.");
    const data = await response.json();
    return { ...data, image: externalUrl(data.image) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function productFields(preview) {
  const fields = {};
  const image = externalUrl(preview?.image);
  if (image) fields.imageUrl = image;
  if (typeof preview?.title === "string" && preview.title.trim()) fields.title = preview.title.trim();
  if (typeof preview?.description === "string" && preview.description.trim()) fields.description = preview.description.trim();
  if (preview?.price !== null && preview?.price !== undefined && preview?.price !== "" &&
    Number.isFinite(Number(preview.price)) && Number(preview.price) >= 0) {
    fields.price = Number(preview.price);
    if (typeof preview.currency === "string") fields.currency = preview.currency;
  }
  return fields;
}

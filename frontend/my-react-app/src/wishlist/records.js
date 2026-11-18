import { externalUrl } from "../shared/urls.js";

export function wishlistRecordID(userID, dealID) {
  if (typeof userID !== "string" || !userID || typeof dealID !== "string" || !dealID || dealID.includes("/")) {
    throw new Error("This deal can't be saved to your wishlist.");
  }
  const id = `${encodeURIComponent(userID)}:${encodeURIComponent(dealID)}`;
  if (new TextEncoder().encode(id).length > 1500) throw new Error("This deal can't be saved to your wishlist.");
  return id;
}

export function buildWishlistRecord(deal, userID, timestamp) {
  wishlistRecordID(userID, deal?.id);
  const link = externalUrl(deal.link);
  if (!link) throw new Error("This deal doesn't have a valid item link.");
  const title = typeof deal.title === "string" ? deal.title.trim() : "";
  const name = title && !externalUrl(title) ? title : new URL(link).hostname.replace(/^www\./, "");
  return { dealID: deal.id, name: name.slice(0, 200), link, userID, dateCreated: timestamp() };
}

export function findWishlistItem(items, deal) {
  const link = externalUrl(deal.link);
  return items.find((item) => item.dealID ? item.dealID === deal.id : link && externalUrl(item.link) === link);
}

export function wishlistDealRows(items, deals) {
  const byID = new Map(deals.map((deal) => [deal.id, deal]));
  const byLink = new Map(deals.map((deal) => [externalUrl(deal.link), deal]));
  return items.map((item) => {
    const dealID = typeof item.dealID === "string" ? item.dealID : "";
    const link = externalUrl(item.link);
    const source = (dealID ? byID.get(dealID) : link && byLink.get(link)) || {};
    return {
      ...source,
      id: source.id || dealID,
      title: source.title || item.name || item.itemName || "",
      link: source.link || link,
      dateSaved: item.dateCreated,
      wishlistID: item.id,
      wishlistItem: item,
    };
  });
}

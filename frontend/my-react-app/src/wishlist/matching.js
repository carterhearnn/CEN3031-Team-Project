import { isApproved } from "../leaderboard/ranking";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
const words = (s) => norm(s).split(/\s+/).filter(Boolean);

// Does this deal satisfy this wishlist item?
export function dealMatchesWish(deal, wish) {
  if (!isApproved(deal)) return false;
  if (wish.brand && norm(deal.brand) !== norm(wish.brand)) return false;

  const dealWords = new Set(words(deal.itemName));
  const wanted = words(wish.itemName);
  if (wanted.length === 0 || !wanted.every((w) => dealWords.has(w))) return false;

  const price = Number(deal.price);
  return Number.isFinite(price) && price <= Number(wish.desiredPrice);
}

// All matching deals for one wish, cheapest first
export function matchesForWish(deals, wish) {
  return deals
    .filter((d) => dealMatchesWish(d, wish))
    .sort((a, b) => Number(a.price) - Number(b.price));
}
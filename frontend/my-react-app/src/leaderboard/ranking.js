export const POINTS_PER_DEAL = 10;

const time = (v) => (v?.toDate ? v.toDate().getTime() : v ? new Date(v).getTime() : 0);
const num = (v) => Number(v) || 0;

// A deal counts once it has been approved
export const isApproved = (deal) => Boolean(deal.dateApproved) && deal.status !== "denied";

// Net score = upvotes - downvotes
export const netScore = (deal) => num(deal.upvotes) - num(deal.downvotes);

// Top deals: highest net score first, then most upvotes, then newest
export function rankDeals(deals, limit = 10) {
  return deals
    .filter(isApproved)
    .map((d) => ({ ...d, upvotes: num(d.upvotes), downvotes: num(d.downvotes), score: netScore(d) }))
    .sort((a, b) =>
      b.score - a.score || b.upvotes - a.upvotes || time(b.dateApproved) - time(a.dateApproved))
    .slice(0, limit);
}

// Top users: 10 pts per approved deal + net score of those deals
export function rankUsers(users, deals, limit = 10) {
  const stats = new Map();
  for (const deal of deals.filter(isApproved)) {
    if (deal.userID == null) continue;
    const s = stats.get(deal.userID) ?? { deals: 0, upvotes: 0, downvotes: 0 };
    s.deals += 1;
    s.upvotes += num(deal.upvotes);
    s.downvotes += num(deal.downvotes);
    stats.set(deal.userID, s);
  }
  return users
    .map((u) => {
      const s = stats.get(u.userID) ?? { deals: 0, upvotes: 0, downvotes: 0 };
      return { ...u, ...s, points: s.deals * POINTS_PER_DEAL + s.upvotes - s.downvotes };
    })
    .filter((u) => u.deals > 0)
    .sort((a, b) => b.points - a.points || b.deals - a.deals ||
      String(a.username ?? "").localeCompare(String(b.username ?? "")))
    .slice(0, limit);
}
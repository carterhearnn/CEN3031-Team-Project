export const POINTS_PER_DEAL = 10;

const time = (v) => (v?.toDate ? v.toDate().getTime() : v ? new Date(v).getTime() : 0);

// Deal is counted once it has been approved
export const isApproved = (deal) => Boolean(deal.dateApproved) && deal.status !== "denied";

// Top deals: most upvotes first, newest first on ties
export function rankDeals(deals, limit = 10) {
  return deals
    .filter(isApproved)
    .map((d) => ({ ...d, upvotes: Number(d.upvotes) || 0 }))
    .sort((a, b) => b.upvotes - a.upvotes || time(b.dateApproved) - time(a.dateApproved))
    .slice(0, limit);
}

// Top users: 10 pts per approved deal + every upvote those deals received
export function rankUsers(users, deals, limit = 10) {
  const stats = new Map();
  for (const deal of deals.filter(isApproved)) {
    if (deal.userID == null) continue;
    const s = stats.get(deal.userID) ?? { deals: 0, upvotes: 0 };
    s.deals += 1;
    s.upvotes += Number(deal.upvotes) || 0;
    stats.set(deal.userID, s);
  }
  return users
    .map((u) => {
      const s = stats.get(u.userID) ?? { deals: 0, upvotes: 0 };
      return { ...u, ...s, points: s.deals * POINTS_PER_DEAL + s.upvotes };
    })
    .filter((u) => u.points > 0)
    .sort((a, b) => b.points - a.points || b.deals - a.deals ||
      String(a.username ?? "").localeCompare(String(b.username ?? "")))
    .slice(0, limit);
}
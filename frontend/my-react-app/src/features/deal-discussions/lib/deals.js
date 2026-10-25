export { externalUrl } from "../../../shared/urls.js";

export function formatDate(value) {
  const date = typeof value === "number" ? new Date(value) : value?.toDate?.();
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Just now";
}

export function formatPrice(price, currency) {
  if (price === null || price === undefined || price === "") return "";
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount}${currency ? ` ${currency}` : ""}`;
  }
}

export function buildCommentTree(comments) {
  const nodes = new Map(comments.map((comment) => [comment.id, { ...comment, replies: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    // Invalid historical data should never disappear or recurse forever.
    let ancestor = parent;
    const visited = new Set([node.id]);
    while (ancestor && !visited.has(ancestor.id)) {
      visited.add(ancestor.id);
      ancestor = nodes.get(ancestor.parentId);
    }
    if (parent && !ancestor) parent.replies.push(node);
    else roots.push(node);
  }
  const sort = (items) => {
    items.sort((a, b) => Number(b.pinned) - Number(a.pinned) ||
      (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
      a.id.localeCompare(b.id));
    items.forEach((item) => sort(item.replies));
    return items;
  };
  return sort(roots);
}

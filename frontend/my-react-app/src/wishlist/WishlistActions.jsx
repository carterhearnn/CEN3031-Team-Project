export function AddToWishlist({ deal, wishlist }) {
  const saved = wishlist.isSaved(deal);
  const action = wishlist.action("save", deal.id);
  const unavailable = wishlist.status === "loading";
  return <div className="deal-list-action-content">
    <button className={`deal-list-action${saved ? " deal-list-action-saved" : ""}`} type="button"
      disabled={saved || action.busy || unavailable} aria-busy={action.busy} onClick={() => wishlist.save(deal)}>
      {saved ? "Saved" : action.busy ? "Saving..." : "Add to wishlist"}
    </button>
    {action.error && <p className="deal-list-action-error" role="alert">{action.error}</p>}
  </div>;
}

export function RemoveFromWishlist({ item, wishlist }) {
  const action = wishlist.action("remove", item.id);
  return <div className="deal-list-action-content">
    <button className="deal-list-action" type="button" disabled={action.busy} aria-busy={action.busy} onClick={() => wishlist.remove(item)}>
      {action.busy ? "Removing..." : "Remove"}
    </button>
    {action.error && <p className="deal-list-action-error" role="alert">{action.error}</p>}
  </div>;
}

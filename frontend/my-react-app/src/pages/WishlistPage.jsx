import { useMemo } from "react";
import DealList from "../home/DealList.jsx";
import { useDeals } from "../home/useDeals.js";
import { useSubmitters } from "../home/useSubmitters.js";
import { useWishlist } from "../wishlist/useWishlist.js";
import { wishlistDealRows } from "../wishlist/records.js";
import { RemoveFromWishlist } from "../wishlist/WishlistActions.jsx";
import "./WishlistPage.css";

export default function WishlistPage() {
  const wishlist = useWishlist();
  const { deals } = useDeals();
  const submitters = useSubmitters();
  const savedDeals = useMemo(() => wishlistDealRows(wishlist.items, deals), [wishlist.items, deals]);

  return <main className="wishlist-page" id="main">
    <div className="site-container">
      {wishlist.status === "signed-out" ? <>
        <h1>Wishlist</h1><p className="deal-list-status">Log in to view your wishlist.</p>
      </> : <DealList heading="Wishlist" sectionId="wishlist" searchLabel="Search wishlist" emptyText="No saved deals yet."
        deals={savedDeals} status={wishlist.status} error={wishlist.error} submitters={submitters} actionHeading=""
        renderAction={(model) => <RemoveFromWishlist item={model.deal.wishlistItem} wishlist={wishlist} />} />}
    </div>
  </main>;
}

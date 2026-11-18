import DealList from "./DealList.jsx";
import { useDeals } from "./useDeals.js";
import { useSubmitters } from "./useSubmitters.js";
import { useWishlist } from "../wishlist/useWishlist.js";
import { AddToWishlist } from "../wishlist/WishlistActions.jsx";
import DealDeleteButton, { DealDeletionProvider } from "../shared/DealDeleteButton.jsx";
import "./HomePage.css";

export default function HomePage() {
  const { deals, status, error } = useDeals();
  const submitters = useSubmitters();
  const wishlist = useWishlist();

  return <main className="home-page" id="main">
    <div className="site-container home-layout">
      <div className="home-results">
        <DealDeletionProvider>
          <DealList deals={deals} status={status} error={error} submitters={submitters}
            actionHeading="Actions" renderAction={(model) => <div className="home-deal-actions">
              <AddToWishlist deal={{ ...model.deal, title: model.title }} wishlist={wishlist} />
              <DealDeleteButton dealId={model.deal.id} className="deal-list-action" />
            </div>} />
        </DealDeletionProvider>
      </div>
    </div>
  </main>;
}

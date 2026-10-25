import Leaderboard from "../leaderboard/Leaderboard.jsx";
import Wishlist from "../wishlist/Wishlist.jsx";        // ← add
import DealCarousel from "./DealCarousel.jsx";
import { useDeals } from "./useDeals.js";
import "./HomePage.css";

export default function HomePage() {
  const { deals, status, error } = useDeals();

  return <main className="home-page" id="main">
    <section className="home-intro">
      <div className="site-container home-intro-inner">
        <div className="home-intro-copy">
          <h1>Discover <span>deals.</span></h1>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <div className="home-intro-actions"><a className="site-button site-button-primary" href="/submit">Submit a record <span aria-hidden="true">+</span></a></div>
        </div>
      </div>
    </section>

    <div className="site-container home-top-content">
      <DealCarousel deals={deals} status={status} error={error} />
      <Leaderboard />
      <Wishlist />                                       {/* ← add */}
    </div>

    <section className="home-how" aria-labelledby="home-how-title">
      <div className="site-container">
        <h2 id="home-how-title">How it works</h2>
        <div className="home-how-grid">
          <article><span>01</span><h3>Browse deals</h3><p>Open a deal to view its product details.</p></article>
          <article><span>02</span><h3>View comments</h3><p>Reply to a comment, vote, or start a discussion.</p></article>
          <article><span>03</span><h3>Submit a record</h3><p>Use the form to add a deal, user, or wishlist record.</p></article>
        </div>
      </div>
    </section>
  </main>;
}

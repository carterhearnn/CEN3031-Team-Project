import { useEffect } from "react";
import HomePage from "./home/HomePage.jsx";
import GoogleLogin from "./login/login.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import RecordPage from "./pages/RecordPage.jsx";
import WishlistPage from "./pages/WishlistPage.jsx";
import GatorByteLogo from "./shared/GatorByteLogo.jsx";
import "./App.css";

export default function App() {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const isSubmit = pathname === "/submit";
  const isHome = pathname === "/" || pathname === "/index.html" || pathname === "/deals";
  const isLeaderboard = pathname === "/leaderboard";
  const isWishlist = pathname === "/wishlist";
  const title = isSubmit ? "Add a Deal" : isLeaderboard ? "Leaderboard" : isWishlist ? "Wishlist" : "Deals";

  useEffect(() => {
    document.title = `${title} | GatorByte`;
  }, [title]);

  return <div className="site-shell">
    <a className="site-skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="site-container site-header-inner">
        <GatorByteLogo />
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/" aria-current={isHome ? "page" : undefined}>Deals</a>
          <a href="/leaderboard" aria-current={isLeaderboard ? "page" : undefined}>Leaderboard</a>
          <a href="/wishlist" aria-current={isWishlist ? "page" : undefined}>Wishlist</a>
          <GoogleLogin className="site-button site-button-secondary" />
          <a className="site-button site-button-primary" href="/submit" aria-current={isSubmit ? "page" : undefined}>Add a Deal <span aria-hidden="true">+</span></a>
        </nav>
      </div>
    </header>

    {isSubmit ? <div id="main"><RecordPage /></div> : isLeaderboard ? <LeaderboardPage /> : isWishlist ? <WishlistPage /> : isHome ? <HomePage /> : <main className="site-container site-not-found" id="main">
      <h1>Page not found.</h1><a className="site-button site-button-primary" href="/">Back to home</a>
    </main>}

    <footer className="site-footer">
      <div className="site-container site-footer-inner">
        <GatorByteLogo />
        <nav aria-label="Footer navigation"><a href="/">Deals</a><a href="/leaderboard">Leaderboard</a><a href="/wishlist">Wishlist</a><a href="/submit">Add a Deal</a></nav>
        <span>CEN3031 Team Project</span>
      </div>
    </footer>
  </div>;
}

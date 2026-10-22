import { useEffect } from "react";
import HomePage from "./home/HomePage.jsx";
import RecordPage from "./pages/RecordPage.jsx";
import "./App.css";

export default function App() {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const isSubmit = pathname === "/submit";
  const isHome = pathname === "/" || pathname === "/index.html";

  useEffect(() => {
    document.title = isSubmit ? "Add a record | GatorByte" : "GatorByte";
  }, [isSubmit]);

  return <div className="site-shell">
    <a className="site-skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="site-container site-header-inner">
        <a className="site-brand" href="/" aria-label="GatorByte home"><span className="site-brand-mark" aria-hidden="true">G</span>GatorByte</a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/#deals">Deals</a>
          <a href="/#leaderboard">Leaderboard</a>
          <a className="site-button site-button-primary" href="/submit" aria-current={isSubmit ? "page" : undefined}>Submit a record <span aria-hidden="true">+</span></a>
        </nav>
      </div>
    </header>

    {isSubmit ? <div id="main"><RecordPage /></div> : isHome ? <HomePage /> : <main className="site-container site-not-found" id="main">
      <h1>Page not found.</h1><a className="site-button site-button-primary" href="/">Back to home</a>
    </main>}

    <footer className="site-footer">
      <div className="site-container site-footer-inner">
        <a className="site-brand" href="/">GatorByte</a>
        <nav aria-label="Footer navigation"><a href="/#deals">Deals</a><a href="/#leaderboard">Leaderboard</a><a href="/submit">Submit a record</a></nav>
        <span>CEN3031 Team Project</span>
      </div>
    </footer>
  </div>;
}

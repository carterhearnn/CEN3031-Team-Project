import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DealPage from "./DealPage.jsx";
import { resolveDealRoute } from "./routes.js";
import "./base.css";

const route = resolveDealRoute(window.location.pathname);

createRoot(document.getElementById("deal-root")).render(
  <StrictMode>
    {route ? <DealPage key={route.dealId} {...route} /> : <main className="deal-page deal-state">
      <h1>Deal not found.</h1><a href="/">Back to all deals</a>
    </main>}
  </StrictMode>,
);

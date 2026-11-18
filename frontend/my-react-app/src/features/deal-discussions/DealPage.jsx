import { useEffect, useState } from "react";
import { watchDeal } from "./data/deals.js";
import Comments from "./components/Comments";
import { externalUrl, formatDate, formatPrice } from "./lib/deals";
import { fetchProductPreview } from "./lib/productPreview";
import GoogleLogin from "../../login/login.jsx";
import GatorByteLogo from "../../shared/GatorByteLogo.jsx";
import DealDeleteButton, { DealDeletionProvider } from "../../shared/DealDeleteButton.jsx";
import "./DealPage.css";

function Product({ deal }) {
  const link = externalUrl(deal.link);
  const [brokenImages, setBrokenImages] = useState([]);
  const [remote, setRemote] = useState({ link: "", status: "idle", data: null });
  const [shareStatus, setShareStatus] = useState("");
  const merchant = deal.preview ? "Example retailer" : link ? new URL(link).hostname.replace(/^www\./, "") : "Product link unavailable";
  const needsPreview = !deal.preview && Boolean(link) && (!externalUrl(deal.imageUrl) || !deal.title || !deal.description);

  useEffect(() => {
    if (!needsPreview) return;
    const controller = new AbortController();
    fetchProductPreview(link, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setRemote({ link, status: "ready", data });
    }).catch(() => {
      if (!controller.signal.aborted) setRemote({ link, status: "unavailable", data: null });
    });
    return () => controller.abort();
  }, [link, needsPreview]);

  const metadata = remote.link === link ? remote.data : null;
  const loadingPreview = needsPreview && (remote.link !== link || remote.status === "loading");
  const title = deal.title || metadata?.title || (link ? `Deal from ${merchant}` : "Deal details");
  const image = [externalUrl(deal.imageUrl), externalUrl(metadata?.image)].find((url) => url && !brokenImages.includes(url));
  const description = deal.description || metadata?.description;
  const price = formatPrice(deal.price ?? metadata?.price, deal.currency || metadata?.currency);
  const ImageContainer = link ? "a" : "div";

  return <>
    <section className="product-showcase" aria-labelledby="product-title">
      <ImageContainer
        className={`product-image-wrap${link ? " product-image-link" : ""}`}
        href={link || undefined}
        rel={link ? "noreferrer" : undefined}
        aria-label={link ? `View ${title} at ${merchant}` : undefined}
      >
        {image ? <img className="product-image" src={image} alt={title} referrerPolicy="no-referrer" onError={() => setBrokenImages((previous) => [...previous, image])} /> :
          <div className="product-image-fallback">
            {deal.preview ? <svg className="sample-product" width="260" height="260" viewBox="0 0 260 260" fill="none" role="img" aria-label="Illustration of sample headphones"><ellipse cx="130" cy="229" rx="75" ry="9" fill="#1f7a4d" opacity=".09" /><path d="M58 151V105a72 72 0 0 1 144 0v46" stroke="#243f32" strokeWidth="19" strokeLinecap="round" /><path d="M58 124v-19a72 72 0 0 1 144 0v19" stroke="#739b83" strokeWidth="10" strokeLinecap="round" /><rect x="38" y="122" width="42" height="82" rx="20" fill="#243f32" /><rect x="48" y="128" width="26" height="70" rx="13" fill="#436d55" /><rect x="180" y="122" width="42" height="82" rx="20" fill="#243f32" /><rect x="186" y="128" width="26" height="70" rx="13" fill="#436d55" /><path d="M84 102a46 46 0 0 1 92 0" stroke="#d2e3d6" strokeWidth="5" strokeLinecap="round" /></svg> : <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true"><rect x="15" y="22" width="58" height="51" rx="9" stroke="currentColor" strokeWidth="2" /><path d="M32 30v-9a12 12 0 0 1 24 0v9M15 43h58M35 56h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
            {!deal.preview && <p role="status">{loadingPreview ? "Loading thumbnail…" : "Thumbnail unavailable"}</p>}
          </div>}
      </ImageContainer>
      <div className="product-details">
        <span className="merchant-pill">{merchant}</span>
        <h1 id="product-title">{title}</h1>
        {price && <p className="product-price">{price}{deal.preview && <span>Sample price</span>}</p>}
        {description && <p className="product-description">{description}</p>}
        {deal.dateSubmitted && <p className="product-submitted">Posted {formatDate(deal.dateSubmitted)}</p>}
        <div className="product-cta">
          {link && <a className="primary-button" href={link} rel="noreferrer">{deal.preview ? "Open example listing" : "View original deal"}</a>}
          <button className="secondary-button" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(window.location.href); setShareStatus("Link copied."); }
          catch { setShareStatus("Couldn't copy. You can copy the link from your address bar."); }
        }}>Copy link</button>
          <DealDeleteButton dealId={deal.id} className="secondary-button" />
        </div>
        <p className="share-status" role="status">{shareStatus}</p>
      </div>
    </section>
  </>;
}

export default function DealPage({ dealId, preview = false }) {
  const [{ deal, state }, setListing] = useState({ deal: null, state: "loading" });

  useEffect(() => {
    if (preview) return;
    return watchDeal(dealId, (record) => {
      setListing({ deal: record, state: record ? "ready" : "missing" });
    }, () => setListing({ deal: null, state: "error" }));
  }, [dealId, preview]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${deal?.title || "Deal details"} | GatorByte`;
    return () => { document.title = previous; };
  }, [deal?.title]);

  return <div className="deal-page">
    <nav className="deal-nav" aria-label="Main navigation"><GatorByteLogo /><a href="/">Back to all deals</a><GoogleLogin className="deal-login-button" /></nav>
    <main><DealDeletionProvider>
      {preview || state === "ready" ? <div className="deal-post"><Product key={`product-${dealId}`} deal={preview ? {
        preview: true, title: "Wireless over-ear headphones", price: "79.99", currency: "USD", link: "https://example.com",
      } : deal} /><Comments key={`comments-${dealId}`} dealId={dealId} /></div> : <section className="deal-state" role="status">
        {state === "loading" && <h1>Loading deal…</h1>}
        {state === "missing" && <><h1>Deal not found.</h1><p>It may have been removed, or the link may be incomplete.</p></>}
        {state === "error" && <><h1>Couldn't load this deal.</h1><p>Check your connection, then refresh to try again.</p></>}
        {state !== "loading" && <a className="primary-button" href="/">Back to all deals</a>}
      </section>}
    </DealDeletionProvider></main>
  </div>;
}

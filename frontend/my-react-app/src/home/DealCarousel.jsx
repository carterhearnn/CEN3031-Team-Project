import { useCallback, useEffect, useId, useRef, useState } from "react";
import { dealPath, loadDealPreview } from "../features/deal-discussions/integration.js";
import { externalUrl } from "../shared/urls.js";
import "./DealCarousel.css";

// Cards share cached product previews. Only three retailer previews run at a
// time, and requests without any remaining subscribers are cancelled.
const previews = new Map();
const previewQueue = [];
let runningPreviews = 0;

function runPreviewQueue() {
  while (runningPreviews < 3 && previewQueue.length) {
    const entry = previewQueue.shift();
    if (entry.controller.signal.aborted) {
      if (previews.get(entry.url) === entry) previews.delete(entry.url);
      entry.resolve(null);
      continue;
    }
    runningPreviews++;
    loadDealPreview(entry.url, { signal: entry.controller.signal })
      .then((data) => {
        entry.data = data;
        entry.expires = Date.now() + 5 * 60 * 1000;
      })
      .catch(() => {
        entry.data = null;
        entry.expires = entry.controller.signal.aborted ? 0 : Date.now() + 30000;
      })
      .finally(() => {
        entry.resolve(entry.data);
        entry.promise = null;
        runningPreviews--;
        if (entry.controller.signal.aborted && previews.get(entry.url) === entry) previews.delete(entry.url);
        if (previews.size > 100) {
          for (const [key, value] of previews) {
            if (!value.promise) previews.delete(key);
            if (previews.size <= 100) break;
          }
        }
        runPreviewQueue();
      });
  }
}

function subscribeToPreview(url) {
  let entry = previews.get(url);
  if (entry && !entry.promise && entry.expires > Date.now()) return { promise: Promise.resolve(entry.data), release() {} };
  if (!entry?.promise || entry.controller.signal.aborted) {
    entry = { url, controller: new AbortController(), subscribers: 0, data: null, expires: 0 };
    entry.promise = new Promise((resolve) => { entry.resolve = resolve; });
    previews.set(url, entry);
    previewQueue.push(entry);
  }
  entry.subscribers++;
  const promise = entry.promise;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.subscribers--;
    if (!entry.subscribers && entry.promise) entry.controller.abort();
  };
  runPreviewQueue();
  return { promise, release };
}

function useCardPreview(link, needsPreview, element) {
  const [result, setResult] = useState({ link: "", data: null });
  useEffect(() => {
    if (!link || !needsPreview) return;
    let active = true;
    let subscription;
    const subscribe = () => {
      if (subscription) return;
      subscription = subscribeToPreview(link);
      subscription.promise.then((data) => { if (active) setResult({ link, data }); });
    };
    let observer;
    if (typeof IntersectionObserver === "function" && element.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          subscribe();
        }
      }, { rootMargin: "180px" });
      observer.observe(element.current);
    } else subscribe();
    return () => {
      active = false;
      observer?.disconnect();
      subscription?.release();
    };
  }, [link, needsPreview, element]);
  return result.link === link ? result.data : null;
}

function priceLabel(value, currency) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return amount.toFixed(2); }
}

export function DealCard({ deal, className = "" }) {
  const card = useRef(null);
  const link = externalUrl(deal.link);
  const metadata = useCardPreview(link, !deal.title || !externalUrl(deal.imageUrl), card);
  const [brokenImages, setBrokenImages] = useState([]);
  const merchant = link ? new URL(link).hostname.replace(/^www\./, "") : "Product listing";
  const title = deal.title || metadata?.title || `Deal from ${merchant}`;
  const image = [externalUrl(deal.imageUrl), externalUrl(metadata?.image)].find((value) => value && !brokenImages.includes(value));
  const price = priceLabel(deal.price ?? metadata?.price, deal.currency || metadata?.currency);

  return <a ref={card} className={`home-deal-card ${className}`} href={dealPath(deal.id)} target="_blank" rel="noopener noreferrer"
    aria-label={`${title} — view deal and comments (opens in a new tab)`}>
    <div className="home-deal-image">
      {image ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImages((current) => [...current, image])} /> :
        <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="7" y="10" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" /><path d="M14 14V9a6 6 0 0 1 12 0v5M15 24h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
    </div>
    <div className="home-deal-copy"><span className="home-deal-merchant">{merchant}</span><h3>{title}</h3>
      <div className="home-deal-bottom">{price && <strong>{price}</strong>}<span>{Number(deal.upvotes) || 0} upvotes</span></div>
    </div>
  </a>;
}

export default function DealCarousel({ deals = [], status = "ready", error = "" }) {
  const track = useRef(null);
  const headingId = useId();
  const [scrollable, setScrollable] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const [interacting, setInteracting] = useState(false);
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const items = deals.filter((deal) =>
    [deal.title, deal.link, deal.category, deal.store, deal.description].filter(Boolean).join(" ").toLowerCase().includes(search));

  const scroll = useCallback((direction) => {
    const element = track.current;
    if (!element) return;
    const card = element.querySelector(".home-deal-card");
    const width = card?.getBoundingClientRect().width || 224;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 16;
    const max = Math.max(0, element.scrollWidth - element.clientWidth);
    const atEnd = element.scrollLeft >= max - 2;
    const atStart = element.scrollLeft <= 2;
    const left = direction > 0 && atEnd ? 0 : direction < 0 && atStart ? max : Math.max(0, Math.min(max, element.scrollLeft + direction * (width + gap)));
    element.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => setScrollable(element.scrollWidth > element.clientWidth + 2);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", measure); };
  }, [items.length, status]);

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motion = (event) => setReducedMotion(event.matches);
    document.addEventListener("visibilitychange", visibility);
    media?.addEventListener("change", motion);
    return () => { document.removeEventListener("visibilitychange", visibility); media?.removeEventListener("change", motion); };
  }, []);

  useEffect(() => {
    if (!scrollable || interacting || hovered || focused || hidden || reducedMotion) return;
    const timer = setInterval(() => scroll(1), 5000);
    return () => clearInterval(timer);
  }, [scrollable, interacting, hovered, focused, hidden, reducedMotion, scroll]);

  return <section className="home-deal-strip" id="deals" aria-labelledby={headingId}>
    <div className="home-deal-strip-heading"><h2 id={headingId}>All deals</h2>
      <div className="home-deal-strip-toolbar">
        <label className="home-search"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span className="home-sr-only">Search deals</span><input type="search" placeholder="Search deals" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {items.length > 1 && <div className="home-deal-strip-controls" role="group" aria-label="Deal carousel controls">
        <button type="button" onClick={() => scroll(-1)} disabled={!scrollable} aria-label="Previous deals">←</button>
        <button type="button" onClick={() => scroll(1)} disabled={!scrollable} aria-label="Next deals">→</button>
      </div>}
      </div>
    </div>
    {status === "loading" ? <p className="home-deal-status" role="status">Loading deals…</p> : status === "error" ?
      <p className="home-deal-status" role="alert">{error || "Couldn't load deals. Refresh to try again."}</p> : items.length === 0 ?
        <p className="home-deal-status" role="status">{search ? "No matching deals." : "No deals yet."}</p> : <div ref={track} className="home-deal-track" role="group" aria-label="All deals" aria-live="off" tabIndex={0}
          onPointerEnter={() => setHovered(true)} onPointerLeave={() => { setHovered(false); setInteracting(false); }}
          onPointerDown={() => setInteracting(true)} onPointerUp={() => setInteracting(false)} onPointerCancel={() => setInteracting(false)}
          onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
          {items.map((deal) => <DealCard key={deal.id} deal={deal} />)}
        </div>}
  </section>;
}

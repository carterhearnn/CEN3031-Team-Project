import { useCallback, useId, useMemo, useRef, useState } from "react";
import { dealPath } from "../features/deal-discussions/integration.js";
import { externalUrl } from "../shared/urls.js";
import { useDealPreview } from "./useDealPreview.js";
import "./DealList.css";

const EMPTY_SUBMITTERS = new Map();

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value) {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function dealDate(deal) {
  for (const value of [deal.dateSubmitted, deal.dateApproved]) {
    const date = value?.toDate?.() ?? (value === undefined || value === null || value === "" ? null : new Date(value));
    if (date instanceof Date && Number.isFinite(date.getTime())) return date;
  }
  return null;
}

function linkLabel(link) {
  if (!link) return "Deal details";
  const url = new URL(link);
  const host = url.hostname.replace(/^www\./, "");
  const segment = url.pathname.split("/").filter(Boolean)[0];
  if (!segment) return `Deal from ${host}`;
  let slug = segment;
  try { slug = decodeURIComponent(segment); } catch { /* Keep invalid escapes as ordinary text. */ }
  return /[-_]/.test(slug) && /[a-z]{3}/i.test(slug)
    ? slug.replace(/[-_]+/g, " ")
    : `Deal from ${host}`;
}

function priceLabel(price, currency) {
  if (price === null) return "";
  if (currency) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price); }
    catch { /* An unknown currency must not hide a saved price. */ }
  }
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
}

function rowModel(deal, previews, submitters) {
  const link = externalUrl(deal.link);
  const metadata = previews.get(link);
  const savedTitle = text(deal.title);
  const title = (savedTitle && !externalUrl(savedTitle) ? savedTitle : "") || text(metadata?.title) || linkLabel(link);
  const merchant = text(deal.store) || (link ? new URL(link).hostname.replace(/^www\./, "") : "");
  const price = amount(deal.price) ?? amount(metadata?.price);
  const votes = Number(deal.upvotes);
  const userID = typeof deal.userID === "string" ? deal.userID.trim() :
    typeof deal.userID === "number" && Number.isFinite(deal.userID) ? String(deal.userID) : "";
  const submitter = submitters.get(userID) || "Unknown user";
  return {
    deal, link, title, merchant, price, submitter,
    formattedPrice: priceLabel(price, text(deal.currency) || text(metadata?.currency)),
    images: [externalUrl(deal.imageUrl), externalUrl(metadata?.image)].filter(Boolean),
    date: dealDate(deal),
    sortDate: dealDate({ dateSubmitted: deal.dateSaved }) || dealDate(deal),
    upvotes: Number.isFinite(votes) ? Math.max(0, votes) : 0,
    hasPreview: previews.has(link),
    needsPreview: !savedTitle || !externalUrl(deal.imageUrl) || amount(deal.price) === null,
    searchText: [title, deal.link, merchant, submitter, deal.category, deal.description, metadata?.description].filter(Boolean).join(" ").toLowerCase(),
  };
}

function sortRows(rows, sort) {
  const newest = (a, b) => (b.sortDate?.getTime() || 0) - (a.sortDate?.getTime() || 0) || String(a.deal.id).localeCompare(String(b.deal.id));
  return [...rows].sort((a, b) => {
    if (sort === "upvotes") return b.upvotes - a.upvotes || newest(a, b);
    if (sort === "price-asc" || sort === "price-desc") {
      if (a.price === null && b.price !== null) return 1;
      if (b.price === null && a.price !== null) return -1;
      if (a.price !== null && b.price !== null && a.price !== b.price) return sort === "price-asc" ? a.price - b.price : b.price - a.price;
    }
    return newest(a, b);
  });
}

function DealRow({ model, onPreview, renderAction }) {
  const element = useRef(null);
  const [brokenImages, setBrokenImages] = useState([]);
  useDealPreview(model.link, model.needsPreview && !model.hasPreview, element, onPreview);
  const image = model.images.find((url) => !brokenImages.includes(url));
  return <li>
    <div className="deal-list-row">
      <a ref={element} className="deal-list-main" href={model.deal.id ? dealPath(model.deal.id) : model.link || undefined}
        rel={!model.deal.id && model.link ? "noreferrer" : undefined}>
        <div className="deal-list-thumbnail">
          {image ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImages((current) => [...current, image])} /> :
            <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="7" y="10" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" /><path d="M14 14V9a6 6 0 0 1 12 0v5M15 24h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
        </div>
        <div className="deal-list-copy">
          <h2 className="deal-list-title">{model.title}</h2>
          <p className="deal-list-meta">
            {model.merchant && <span>{model.merchant}</span>}
            {model.merchant && model.date && <span aria-hidden="true">·</span>}
            {model.date && <time dateTime={model.date.toISOString()}>{model.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>}
            {(model.merchant || model.date) && <span aria-hidden="true">·</span>}
            <span>Submitted by <span className="deal-list-submitter">{model.submitter}</span></span>
          </p>
        </div>
      </a>
      <div className="deal-list-price">
        <span className="deal-list-sr-only">Price: </span>
        {model.formattedPrice ? <strong>{model.formattedPrice}</strong> : <span className="deal-list-unavailable" aria-label="Price unavailable">—</span>}
      </div>
      <div className="deal-list-votes">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 5-8a3 3 0 0 1 2 3l-1 5h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        <span>{model.upvotes}<span className="deal-list-sr-only"> upvotes</span></span>
      </div>
      {renderAction && <div className="deal-list-actions">{renderAction(model)}</div>}
    </div>
  </li>;
}

export default function DealList({ deals = [], status = "ready", error = "", submitters = EMPTY_SUBMITTERS,
  heading = "All deals", sectionId = "deals", searchLabel = "Search deals", emptyText = "No deals yet.", actionHeading = "", renderAction }) {
  const headingId = useId();
  const searchId = useId();
  const sortId = useId();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [previews, setPreviews] = useState(() => new Map());
  const onPreview = useCallback((link, data) => {
    setPreviews((current) => current.has(link) ? current : new Map(current).set(link, data));
  }, []);
  const search = query.trim().toLowerCase();
  const rows = useMemo(() => sortRows(deals.map((deal) => rowModel(deal, previews, submitters))
    .filter((row) => row.searchText.includes(search)), sort), [deals, previews, search, sort, submitters]);

  return <section className="deal-list-section" id={sectionId} aria-labelledby={headingId}>
    <div className="deal-list-heading">
      <h1 id={headingId}>{heading}</h1>
      <label className="deal-list-search" htmlFor={searchId}>
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span className="deal-list-sr-only">{searchLabel}</span>
        <input id={searchId} type="search" placeholder={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
    </div>
    <div className="deal-list-toolbar">
      <p className="deal-list-count" role="status">{status === "ready" ? `${rows.length} ${rows.length === 1 ? "deal" : "deals"}${search ? " found" : ""}` : ""}</p>
      <div className="deal-list-sort"><label htmlFor={sortId}>Sort by</label><select id={sortId} value={sort} onChange={(event) => setSort(event.target.value)}>
        <option value="newest">Newest</option><option value="upvotes">Most upvoted</option>
        <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
      </select></div>
    </div>
    {status === "loading" ? <p className="deal-list-status" role="status">Loading deals...</p> : status === "error" ?
      <p className="deal-list-status" role="alert">{error || "Couldn't load deals. Refresh to try again."}</p> : rows.length === 0 ?
        <p className="deal-list-status">{search ? "No matching deals." : emptyText}</p> :
        <div className={`deal-list-panel${renderAction ? " deal-list-has-actions" : ""}`}>
          <div className="deal-list-column-head" aria-hidden="true"><span>Deal</span><span>Price</span><span>Upvotes</span>{renderAction && <span>{actionHeading}</span>}</div>
          <ul className="deal-list-rows">{rows.map((model) => <DealRow key={model.deal.wishlistID || model.deal.id} model={model} onPreview={onPreview} renderAction={renderAction} />)}</ul>
        </div>}
  </section>;
}

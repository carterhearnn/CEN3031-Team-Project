import { externalUrl } from "../shared/urls.js";
import { ADMIN, OWNER } from "../login/roles.js";

const APPROVAL_STATES = new Set(["pending", "approved", "denied"]);

function fieldText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value, label, fromDate) {
  const input = fieldText(value);
  if (!input) return null;
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return fromDate(date);
}

function ownerUserID(value, fallback) {
  const input = fieldText(value);
  if (!input) return fallback;
  if (/^(0|[1-9]\d*)$/.test(input) && Number.isSafeInteger(Number(input))) return Number(input);
  return input;
}

export function buildDealRecord(values, { userID, role, now, fromDate }) {
  if (typeof userID !== "string" || !userID.trim()) throw new Error("Log in to submit a deal.");
  const link = externalUrl(fieldText(values.link));
  if (!link) throw new Error("Enter a valid http or https deal link.");

  const canApprove = role === ADMIN || role === OWNER;
  const isOwner = role === OWNER;
  const status = canApprove ? fieldText(values.status) || "pending" : "pending";
  if (!APPROVAL_STATES.has(status)) throw new Error("Choose a valid approval status.");
  const timestamp = now();
  let upvotes = 0;
  if (isOwner && fieldText(values.upvotes)) {
    const input = fieldText(values.upvotes);
    upvotes = Number(input);
    if (!/^\d+$/.test(input) || !Number.isSafeInteger(upvotes) || upvotes < 0) {
      throw new Error("Upvotes must be a nonnegative whole number.");
    }
  }

  return {
    link,
    userID: isOwner ? ownerUserID(values.userID, userID) : userID,
    status,
    dateSubmitted: isOwner ? optionalDate(values.dateSubmitted, "Submission date", fromDate) || timestamp : timestamp,
    dateApproved: status === "approved" ? (isOwner ? optionalDate(values.dateApproved, "Approval date", fromDate) : null) || timestamp : null,
    upvotes,
  };
}

export function mergeDealMetadata(record, enriched) {
  const metadata = {};
  for (const field of ["title", "description", "currency"]) {
    const value = fieldText(enriched?.[field]);
    if (value) metadata[field] = value;
  }
  const image = externalUrl(enriched?.imageUrl);
  if (image) metadata.imageUrl = image;
  const price = enriched?.price;
  if ((typeof price === "number" || (typeof price === "string" && price.trim())) &&
    Number.isFinite(Number(price)) && Number(price) >= 0) metadata.price = Number(price);
  return { ...metadata, ...record };
}

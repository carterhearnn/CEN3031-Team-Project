import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import { isApproved } from "../leaderboard/ranking.js";

function timestamp(value) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export function useDeals() {
  const [result, setResult] = useState({ deals: [], status: "loading", error: "" });

  useEffect(() => onSnapshot(collection(db, "deals"), (snapshot) => {
    const deals = snapshot.docs
      .map((document) => ({ ...document.data(), id: document.id }))
      .filter(isApproved)
      .sort((a, b) => timestamp(b.dateSubmitted || b.dateApproved) - timestamp(a.dateSubmitted || a.dateApproved) || a.id.localeCompare(b.id));
    setResult({ deals, status: "ready", error: "" });
  }, () => setResult({ deals: [], status: "error", error: "Couldn't load deals. Refresh to try again." })), []);

  return result;
}

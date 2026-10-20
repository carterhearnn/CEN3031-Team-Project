import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { matchesForWish } from "./matching";
import "./Wishlist.css";

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const money = (n) => `$${Number(n).toFixed(2)}`;
const label = (x) => (x.brand ? `${x.itemName} (${x.brand})` : x.itemName);   // ← add

export default function Wishlist() {
  const [data, setData] = useState({ users: [], deals: [], wishlist: [] });
  const [userID, setUserID] = useState("");
  const [status, setStatus] = useState("loading");

  async function load() {
    setStatus("loading");
    try {
      const [u, d, w] = await Promise.all(
        ["users", "deals", "wishlist"].map((name) => getDocs(collection(db, name))),
      );
      setData({ users: rows(u), deals: rows(d), wishlist: rows(w) });
      setStatus("ready");
    } catch (err) {
      console.error("Wishlist load failed:", err);
      setStatus("error");
    }
  }

  useEffect(() => { load(); }, []);

  const wishes = data.wishlist.filter((w) => String(w.userID) === userID);

  return (
    <section className="wishlist" id="wishlist">
      <div className="wl-head">
        <h2>Wishlist</h2>
        <div className="wl-controls">
          <select value={userID} onChange={(e) => setUserID(e.target.value)} aria-label="Choose user">
            <option value="">Choose a user…</option>
            {data.users.map((u) => (
              <option key={u.id} value={String(u.userID)}>
                {u.username || `User ${u.userID}`}
              </option>
            ))}
          </select>
          <button onClick={load} aria-label="Refresh">↻</button>
        </div>
      </div>

      {status === "loading" && <p className="wl-note">Loading…</p>}
      {status === "error" && <p className="wl-note error">Couldn't load the wishlist.</p>}
      {status === "ready" && !userID && <p className="wl-note">Pick a user to see their wishlist.</p>}
      {status === "ready" && userID && wishes.length === 0 && (
        <p className="wl-note">This user has no wishlist items yet.</p>
      )}

      {status === "ready" && wishes.map((wish) => {
        const matches = matchesForWish(data.deals, wish);
        return (
          <div className="wl-item" key={wish.id}>
            <div className="wl-item-head">
              <strong>
                {wish.link
                  ? <a href={wish.link} target="_blank" rel="noreferrer">{label(wish)}</a>
                  : label(wish)}
              </strong>
              <span>Wants it at {money(wish.desiredPrice)} or less</span>
            </div>
            {matches.length === 0 ? (
              <p className="wl-note">No matching deals yet.</p>
            ) : (
              <ul className="wl-matches">
                {matches.map((deal) => (
                  <li key={deal.id}>
                    <a href={deal.link} target="_blank" rel="noreferrer">
                      {label(deal)}
                    </a>
                    <strong>{money(deal.price)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { rankDeals, rankUsers } from "./ranking";
import "./Leaderboard.css";

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export default function Leaderboard() {
  const [view, setView] = useState("users");
  const [data, setData] = useState({ users: [], deals: [] });
  const [status, setStatus] = useState("loading");

  async function load() {
    setStatus("loading");
    try {
      const [userSnap, dealSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "deals")),
      ]);
      setData({ users: rows(userSnap), deals: rows(dealSnap) });
      setStatus("ready");
    } catch (err) {
      console.error("Leaderboard load failed:", err);
      setStatus("error");
    }
  }

  useEffect(() => { load(); }, []);

  const names = new Map(data.users.map((u) => [u.userID, u.username]));
  const list = view === "users"
    ? rankUsers(data.users, data.deals)
    : rankDeals(data.deals);

  return (
    <section className="leaderboard" id="leaderboard">
      <div className="lb-head">
        <h2>Leaderboard</h2>
        <div className="lb-tabs" role="tablist">
          <button role="tab" aria-selected={view === "users"} onClick={() => setView("users")}>Top users</button>
          <button role="tab" aria-selected={view === "deals"} onClick={() => setView("deals")}>Top deals</button>
          <button onClick={load} aria-label="Refresh">↻</button>
        </div>
      </div>

      {status === "loading" && <p className="lb-note">Loading…</p>}
      {status === "error" && <p className="lb-note error">Couldn't load the leaderboard.</p>}
      {status === "ready" && list.length === 0 && (
        <p className="lb-note">No ranked {view} yet. Add an approved deal with a User ID to see it here.</p>
      )}

      {status === "ready" && list.length > 0 && (
        <ol className="lb-list">
          {list.map((item, i) => (
            <li className="lb-row" key={item.id}>
              <span className="lb-rank">{i + 1}</span>
              {view === "users" ? (
                <>
                  <div className="lb-main">
                    <strong>{item.username ?? `User ${item.userID}`}</strong>
                    <span>{item.deals} deals · ▲ {item.upvotes} · ▼ {item.downvotes}</span>
                  </div>
                  <strong className="lb-score">{item.points} pts</strong>
                </>
              ) : (
                <>
                  <div className="lb-main">
                    <a href={item.link} target="_blank" rel="noreferrer">
                      {item.itemName ? (item.brand ? `${item.itemName} (${item.brand})` : item.itemName) : item.link}
                    </a>
                    <span>by {names.get(item.userID) ?? "unknown"}</span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
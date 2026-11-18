import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { rankDeals, rankUsers } from "./ranking";
import { dealPath } from "../features/deal-discussions/integration.js";
import { externalUrl } from "../shared/urls.js";
import "./Leaderboard.css";

const rows = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));

function userName(user) {
  for (const value of [user.username, user.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.userID == null ? "Unknown user" : `User ${user.userID}`;
}

function dealTitle(deal) {
  if (typeof deal.title === "string" && deal.title.trim() && !externalUrl(deal.title)) return deal.title.trim();
  const link = externalUrl(deal.link);
  if (!link) return "View deal";
  const url = new URL(link);
  const segment = url.pathname.split("/").filter(Boolean)[0];
  if (segment) {
    let label = segment;
    try { label = decodeURIComponent(segment); } catch { /* Use the original path text. */ }
    if (/[-_]/.test(label) && /[a-z]{3}/i.test(label)) return label.replace(/[-_]+/g, " ");
  }
  return url.hostname.replace(/^www\./, "");
}

async function loadLeaderboard() {
  const [users, deals] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "deals")),
  ]);
  return { users: rows(users), deals: rows(deals) };
}

export default function Leaderboard() {
  const [view, setView] = useState("users");
  const [data, setData] = useState({ users: [], deals: [] });
  const [status, setStatus] = useState("loading");

  async function load() {
    setStatus("loading");
    try {
      setData(await loadLeaderboard());
      setStatus("ready");
    } catch (err) {
      console.error("Leaderboard load failed:", err);
      setStatus("error");
    }
  }

  useEffect(() => {
    let active = true;
    loadLeaderboard().then((result) => {
      if (active) { setData(result); setStatus("ready"); }
    }).catch((err) => {
      console.error("Leaderboard load failed:", err);
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, []);

  const names = new Map(data.users.map((user) => [user.userID, userName(user)]));
  const list = view === "users"
    ? rankUsers(data.users, data.deals)
    : rankDeals(data.deals);

  return (
    <section className="leaderboard" id="leaderboard" aria-labelledby="leaderboard-title">
      <div className="lb-head">
        <h2 id="leaderboard-title">Leaderboard</h2>
        <button className="lb-refresh" type="button" onClick={load} disabled={status === "loading"} aria-label="Refresh leaderboard" title="Refresh leaderboard">↻</button>
      </div>
      <div className="lb-tabs" role="group" aria-label="Leaderboard view">
        <button type="button" aria-pressed={view === "users"} onClick={() => setView("users")}>Top users</button>
        <button type="button" aria-pressed={view === "deals"} onClick={() => setView("deals")}>Top deals</button>
      </div>

      {status === "loading" && <p className="lb-note" role="status">Loading…</p>}
      {status === "error" && <p className="lb-note error" role="alert">Couldn't load the leaderboard.</p>}
      {status === "ready" && list.length === 0 && (
        <p className="lb-note">No ranked {view} yet.</p>
      )}

      {status === "ready" && list.length > 0 && (
        <ol className="lb-list">
          {list.map((item, i) => (
            <li className="lb-row" key={item.id}>
              <span className="lb-rank">{i + 1}</span>
              {view === "users" ? (
                <>
                  <div className="lb-main">
                    <strong title={userName(item)}>{userName(item)}</strong>
                    <span>{item.deals} deals · {item.upvotes} upvotes</span>
                  </div>
                  <strong className="lb-score">{item.points} pts</strong>
                </>
              ) : (
                <>
                  <div className="lb-main">
                    <a href={dealPath(item.id)} title={dealTitle(item)}>{dealTitle(item)}</a>
                    <span>by {names.get(item.userID) || (item.userID == null ? "Unknown user" : `User ${item.userID}`)}</span>
                  </div>
                  <strong className="lb-score" aria-label={`${item.upvotes} upvotes`}>↑ {item.upvotes}</strong>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
